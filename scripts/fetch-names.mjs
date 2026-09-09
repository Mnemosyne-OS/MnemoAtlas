#!/usr/bin/env node
/**
 * fetch-names.mjs — anatomical structure names in other languages, from
 * Wikidata, keyed on the FMA identifier the atlas already carries.
 *
 * Why Wikidata and not a model: these are medical terms shown to people who
 * are learning them. A wrong French name for an artery, learned and repeated,
 * is worse than an English one. Wikidata labels are written and corrected by
 * people, published CC0, and — the part that makes this possible at all —
 * addressable by `P1402` (Foundational Model of Anatomy) and `P1554` (UBERON),
 * so the join is exact rather than fuzzy. Both are queried: the male atlas is
 * FMA throughout, the female one names its concepts `HRA:VH_F_*` but its PARTS
 * carry 266 FMA ids and 256 UBERON ones.
 *
 * Measured before building: of 60 ids sampled at random, 60 exist in Wikidata,
 * but only a third carry a French label (fr 37%, ru 35%, es 28%, zh 28%,
 * de 25%, pt 20%). That sparseness is the whole design constraint — see
 * `src/i18n/anatomyNames.ts` for what the quiz does with a partial language.
 *
 * ⚠️ Nothing here is certified. Wikidata renders `thorax` as `torse` in French,
 * which is not the same structure. The app says so, in a notice the reader
 * has to dismiss once per language.
 *
 * Usage:  node scripts/fetch-names.mjs [lang...]      (default: fr es de pt ru zh)
 * Writes: public/names/<lang>.json  =  { "FMA7088": "cœur", … }
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['fr', 'es', 'de', 'pt', 'ru', 'zh'];
const ENDPOINT = 'https://query.wikidata.org/sparql';
/** Wikidata asks for a real agent and a way to reach whoever is hammering it. */
const AGENT = 'MnemosyneOS-Atlas/0.1 (https://mnemosyne-os.io) anatomy label sync';
const BATCH = 250;

/**
 * Every identifier the two atlases name, split by the ontology it belongs to.
 *
 * Both the CONCEPT list and the PARTS are read: the female atlas names its
 * concepts `HRA:VH_F_*` — untranslatable — but 266 of its 888 parts carry an
 * FMA id and 256 an UBERON one, and the detail sheet shows a part id whenever
 * someone clicks a mesh. Reading only the concepts left that whole body in
 * English for no reason.
 */
function allIds() {
  const fma = new Set(), uberon = new Set();
  const take = (id) => {
    if (typeof id !== 'string') return;
    if (id.startsWith('FMA')) fma.add(id.slice(3));
    else if (id.startsWith('UBERON:')) uberon.add(id.slice(7));
  };
  for (const file of ['atlas.json', 'atlas-female.json']) {
    const p = join(root, 'public/models', file);
    if (!existsSync(p)) continue;
    const atlas = JSON.parse(readFileSync(p, 'utf8'));
    for (const c of atlas.concepts) take(c.id);
    for (const part of atlas.parts) take(part.conceptId);
  }
  return { fma: [...fma], uberon: [...uberon] };
}

async function query(sparql) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  const res = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`Wikidata answered ${res.status} ${res.statusText}`);
  return (await res.json()).results.bindings;
}

const chunks = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

const { fma, uberon } = allIds();
console.log(`${fma.length} FMA ids and ${uberon.length} UBERON ids in the atlases`);

const found = Object.fromEntries(LANGS.map((l) => [l, {}]));
const langs = LANGS.map((l) => `"${l}"`).join(', ');

/**
 * One ontology, in batches.
 *
 * `prop` is the Wikidata property that holds the id (P1402 for FMA, P1554 for
 * UBERON) and `prefix` is what the atlas writes in front of it, so the keys in
 * the output file are exactly the ids the app looks up.
 */
async function harvest(label, list, prop, prefix) {
  if (!list.length) return;
  const batches = chunks(list, BATCH);
  let failed = 0;
  for (const [i, batch] of batches.entries()) {
    const values = batch.map((x) => `"${x}"`).join(' ');
    const sparql = `SELECT ?id ?lang (SAMPLE(?label) AS ?l) WHERE {
      VALUES ?id { ${values} }
      ?item wdt:${prop} ?id .
      ?item rdfs:label ?label .
      BIND(LANG(?label) AS ?lang)
      FILTER(?lang IN (${langs}))
    } GROUP BY ?id ?lang`;
    let rows;
    try {
      rows = await query(sparql);
    } catch (err) {
      // A failed batch is REPORTED and skipped, never silently dropped: a name
      // file that is quietly short would shrink the quiz pool for a whole
      // language and nobody would know why.
      console.error(`\n  ${label} batch ${i + 1}/${batches.length} FAILED — ${err.message}`);
      failed++;
      continue;
    }
    for (const r of rows) found[r.lang.value][`${prefix}${r.id.value}`] = r.l.value;
    process.stdout.write(`\r  ${label} ${i + 1}/${batches.length}`);
    // Wikidata's public endpoint is a shared resource; do not hammer it.
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(failed ? `  (${failed} batch(es) failed — the file below is short by that much)` : '');
}

await harvest('FMA   ', fma, 'P1402', 'FMA');
await harvest('UBERON', uberon, 'P1554', 'UBERON:');

mkdirSync(join(root, 'public/names'), { recursive: true });
const total = fma.length + uberon.length;
for (const lang of LANGS) {
  const map = found[lang];
  const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
  writeFileSync(join(root, 'public/names', `${lang}.json`), `${JSON.stringify(sorted)}\n`);
  const n = Object.keys(map).length;
  console.log(`  ${lang}  ${n} / ${total}  (${((n / total) * 100).toFixed(0)}%)`);
}
