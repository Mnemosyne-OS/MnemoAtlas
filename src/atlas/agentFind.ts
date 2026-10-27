/**
 * agentFind — a system, a region, a tour or a review answer named the way a
 * person says it (doc 149). The orb plans a spoken sentence in ONE model call
 * and never reads the Atlas first, so « révise le système digestif » or
 * « c'est le foie » reach an action with words, never an id. An id still works.
 *
 * Structures of the whole atlas go through `resolveStructure` (agentResolve):
 * it knows the search panel's ranking. This module is for the SHORT lists
 * (sixteen systems, six regions, four review options), where every word said
 * must be found in the name.
 *
 * 🚨 Several matches are REFUSED with their names (AMBIGUOUS), never the first
 *    one taken: the refusal is what the orb's second planner call reads to
 *    pick the right one. No match is refused with the names that exist.
 *
 * Copied from Vitrine Studio's agentFind (never imported across cartridges),
 * with the cartridge's own `fold` (it spells out œ, « cœur » = « coeur ») and
 * fillers for anatomy and for an answer said aloud.
 */
import {fold} from './fold';

/**
 * Words that carry no name: articles, and the words a sentence wraps a name
 * or an answer in (« c'est le foie », « I think it's the liver »).
 * 🪤 Matched BEFORE the accents come off: folded, « thé » is « the ».
 */
const FILLER = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'mon', 'ma', 'mes', 'ce', 'cette', 'ces', 'et', 'en', 'au', 'aux', 'à',
  'c', 'est', 'ça', 'je', 'pense', 'crois', 'que', 'qu', 'réponse', 'voilà', 'irina',
  'the', 'a', 'an', 'of', 'my', 'and', 'it', 'is', 'its', 's', 'i', 'think', 'answer', 'that',
  'el', 'los', 'las', 'del', 'mi', 'y', 'es', 'creo',
  'système', 'systèmes', 'system', 'systems', 'sistema', 'appareil',
]);

/** The words of a name, folded, fillers out, a plural « s »/« x » off so « artères » finds « artère ». */
export function nameWords(s: string): string[] {
  return s.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !FILLER.has(w))
    .map((w) => fold(w))
    .map((w) => (w.length > 3 ? w.replace(/[sx]$/, '') : w));
}

export interface Named<T> { item: T; id: string; names: string[]; label: string }

export type Match<T> =
  | {kind: 'found'; item: T}
  | {kind: 'ambiguous'; labels: string[]}
  | {kind: 'none'};

const LIST_MAX = 12;
/** A list a refusal can carry: unique, at most twelve, the rest counted. */
export function listed(labels: string[]): string {
  const unique = [...new Set(labels)];
  return unique.length > LIST_MAX ? `${unique.slice(0, LIST_MAX).join(', ')} (+${unique.length - LIST_MAX})` : unique.join(', ');
}

/**
 * The one entry `ref` names, without throwing: its id; else the entry whose
 * whole name is the words said; else the one whose words hold every word said.
 */
export function matchNamed<T>(entries: ReadonlyArray<Named<T>>, ref: string): Match<T> {
  const raw = ref.trim();
  if (!raw) return {kind: 'none'};
  const byId = entries.find((e) => e.id === raw);
  if (byId) return {kind: 'found', item: byId.item};
  const asked = nameWords(raw);
  if (!asked.length) return {kind: 'none'};
  // The whole name said as written wins over a partial match (« Muscles » against « Muscles » and « Muscles du dos »).
  const whole = entries.filter((e) => e.names.some((n) => nameWords(n).join(' ') === asked.join(' ')));
  if (whole.length === 1) return {kind: 'found', item: whole[0]!.item};
  const hits = entries.filter((e) => {
    const have = new Set(e.names.flatMap(nameWords));
    return asked.every((w) => have.has(w));
  });
  if (hits.length === 1) return {kind: 'found', item: hits[0]!.item};
  if (hits.length > 1) return {kind: 'ambiguous', labels: hits.map((e) => e.label)};
  return {kind: 'none'};
}

/**
 * The one item `ref` names, or a refusal the orb's repair call can read.
 * `kind` names the error (NO_SYSTEM, NO_OPTION…) and the noun said.
 */
export function findNamed<T>(entries: ReadonlyArray<Named<T>>, ref: string, kind: {code: string; noun: string}): T {
  const raw = ref.trim();
  if (!raw) throw new Error(`BAD_ARG: name the ${kind.noun}`);
  const m = matchNamed(entries, raw);
  if (m.kind === 'found') return m.item;
  if (m.kind === 'ambiguous') throw new Error(`AMBIGUOUS: "${raw}" names several ${kind.noun}s: ${listed(m.labels)}; say which`);
  throw new Error(`${kind.code}: no ${kind.noun} named "${raw}"; ${kind.noun}s: ${listed(entries.map((e) => e.label)) || 'none'}`);
}
