#!/usr/bin/env node
/**
 * borrow-female-names.mjs — give a female structure the translated name its
 * male twin already has.
 *
 * The female reference names its concepts `HRA:VH_F_*`, with no ontology id,
 * so Wikidata cannot be joined on them. But many carry EXACTLY the English
 * name of a male BodyParts3D concept (« corpus callosum », « Right femur »),
 * and that one has a Wikidata label. Same name in two anatomical datasets is
 * the same structure: the label is borrowed, never invented. Measured
 * 2026-10-03: 144 French, 123 Spanish, and no English name is shared by two
 * male concepts, so no borrow is ambiguous (the script refuses one if it ever
 * is).
 *
 * Idempotent: it only adds ids that have no name yet. Run after
 * fetch-names.mjs (which calls it), or alone:  node scripts/borrow-female-names.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

export function borrowFemaleNames(langs) {
  const male = read('public/models/atlas.json'), female = read('public/models/atlas-female.json');
  const byName = new Map();
  for (const c of male.concepts) {
    const k = c.name.toLowerCase().trim();
    byName.set(k, byName.has(k) ? null : c.id); // null = ambiguous, never borrowed
  }
  for (const lang of langs) {
    const file = join(root, 'public/names', `${lang}.json`);
    if (!existsSync(file)) continue;
    const map = JSON.parse(readFileSync(file, 'utf8'));
    let added = 0;
    for (const c of female.concepts) {
      if (map[c.id]) continue;
      const twin = byName.get(c.name.toLowerCase().trim());
      if (twin && map[twin]) { map[c.id] = map[twin]; added++; }
    }
    const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
    writeFileSync(file, `${JSON.stringify(sorted)}\n`);
    console.log(`  ${lang}  +${added} female names borrowed from their male twin`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) borrowFemaleNames(['fr', 'es', 'de', 'pt', 'ru', 'zh']);
