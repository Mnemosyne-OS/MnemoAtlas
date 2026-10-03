/**
 * search.ts — how a typed term finds atlas concepts.
 *
 * Two tiers. Direct hits come first: the term is inside the English name, the
 * translated label, or the atlas id. Synonym hits come after them, and only
 * exist for organs the source atlas does not model as one piece.
 *
 * The lungs are the case that forced this (upstream human-atlas #429).
 * BodyParts3D has no whole-lung mesh: a lung is 100+ bronchial and pulmonary
 * vessel pieces, most of whose names never contain the word « lung ». Typing
 * « lung » found 7 concepts and missed the rest of the organ.
 *
 * Both sides go through fold(), so the triggers are written folded: « pulmón »
 * and « poumon » reach the same table as « lung ».
 */
import {fold} from './fold';
import type {Concept} from './anatomy';

/** Folded trigger → folded fragments that also count as a match. */
const SYNONYMS: {when: string[]; also: string[]}[] = [
  {when: ['lung', 'poumon', 'pulmon'], also: ['pulmon', 'bronch']},
  {when: ['bronch'], also: ['lung', 'pulmon']},
  {when: ['airway', 'voie aerienne', 'via aerea'], also: ['bronch', 'trachea']},
];

/** The fragments a synonym match may use. Never contains the term itself. */
export function synonymsOf(query: string): string[] {
  const term = fold(query.trim());
  if (!term) return [];
  const out = new Set<string>();
  for (const row of SYNONYMS) if (row.when.some(w => term.includes(w))) row.also.forEach(a => out.add(a));
  out.delete(term);
  return [...out];
}

/**
 * Concepts matching `query`, direct hits first, each tier shortest name
 * first. `label` gives the translated name; pass none and only the English
 * name and id are searched (the agent tool has no translation table).
 */
export function searchConcepts(concepts: Concept[], query: string, label?: (c: Concept) => string, limit = 80): Concept[] {
  const term = fold(query.trim());
  if (!term) return [];
  const haystack = (c: Concept) => [fold(c.name), fold(c.id), label ? fold(label(c)) : ''];
  const byLength = (a: Concept, b: Concept) => a.name.length - b.name.length;
  const direct = concepts.filter(c => haystack(c).some(h => h.includes(term))).sort(byLength);
  const extra = synonymsOf(query);
  if (!extra.length || direct.length >= limit) return direct.slice(0, limit);
  const seen = new Set(direct);
  const viaSynonym = concepts.filter(c => !seen.has(c) && haystack(c).some(h => extra.some(e => h.includes(e)))).sort(byLength);
  return [...direct, ...viaSynonym].slice(0, limit);
}
