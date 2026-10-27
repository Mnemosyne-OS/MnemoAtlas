/**
 * agentScope — systems, places and review scopes named the way a person says
 * them (doc 149): « le squelette », « système digestif », « tête et cou »,
 * « révise-moi le cœur et les poumons ».
 *
 * A system is matched on its id, its English name, its name in the reader's
 * language and a few words people use for it (« os », « nerfs »). A place is a
 * region or a teaching area of the layers panel. A review scope word is tried
 * as a system, then as a place, then as a structure of the atlas (an organ:
 * its own parts are asked); several systems add up, places and organs narrow.
 */
import {SYSTEMS, type Atlas, type Concept, type Part, type SystemId} from './anatomy';
import {areasFor, bodyBounds, partInArea, partRegion, regionsFor, type AreaId, type RegionId} from './regions';
import {listed, matchNamed, nameWords, type Named} from './agentFind';
import {resolveStructure, type Resolved} from './agentResolve';
import {fold} from './fold';

/**
 * A structure of the atlas from a sentence's words: as said first, then with
 * the words a sentence wraps it in taken off (« le foie », « the left lung »),
 * which the search panel's ranking was never written to expect.
 */
export function resolveSaid(concepts: Concept[], said: string, label: (c: Concept) => string): Resolved {
  const r = resolveStructure(concepts, said, label);
  if (r.kind !== 'none') return r;
  const bare = nameWords(said).join(' ');
  if (!bare || bare === fold(said.trim())) return r;
  const again = resolveStructure(concepts, bare, label);
  return again.kind === 'none' ? r : again;
}

/** The translated name of a key (`system.digestive`, `region.torso`…). */
export type Translate = (key: string) => string;

/** Words people say for a system that its names do not hold. */
const SYSTEM_WORDS: Partial<Record<SystemId, string[]>> = {
  skeletal: ['skeleton', 'bone', 'os', 'osseux', 'squelettique', 'huesos'],
  muscular: ['muscle', 'musculaire', 'musculature', 'músculo'],
  cardiac: ['cardiac', 'cardiaque', 'heart'],
  sensory: ['sens', 'sense', 'sentidos'],
  arterial: ['artery', 'artériel', 'arterial'],
  venous: ['vein', 'veineux', 'venoso'],
  nervous: ['nerve', 'nerf', 'nerveux', 'nervio'],
  respiratory: ['respiration', 'breathing', 'respiratoire'],
  digestive: ['digestion', 'digestif'],
  urinary: ['urinaire', 'urinario'],
  lymphatic: ['lymphatique'],
  endocrine: ['endocrinien', 'hormone', 'glande'],
  reproductive: ['reproduction', 'génital', 'genital', 'reproducteur'],
  integumentary: ['skin', 'peau', 'piel'],
  connective: ['conjonctif', 'cartilage', 'ligament'],
  pregnancy: ['grossesse', 'embarazo'],
};

/** The systems this body has pieces in, in the panel's order. */
export function systemsIn(atlas: Atlas): SystemId[] {
  const present = new Set(atlas.parts.map((p) => p.system));
  return SYSTEMS.filter((s) => present.has(s.id)).map((s) => s.id);
}

/** One entry per system of THIS body, named every way it is said. */
export function systemEntries(atlas: Atlas, t: Translate): Named<SystemId>[] {
  return systemsIn(atlas).map((id) => {
    const english = SYSTEMS.find((s) => s.id === id)!.name;
    const shown = t(`system.${id}`);
    return {item: id, id, names: [id, english, shown, ...(SYSTEM_WORDS[id] ?? [])], label: shown === id ? id : `${shown} (${id})`};
  });
}

export type Place = {kind: 'region'; id: RegionId} | {kind: 'area'; id: AreaId};

const placesOf = new WeakMap<Atlas, Place[]>();
/** The regions and areas the layers panel can offer for this body (the same rules: an area is a real cluster). */
export function placesIn(atlas: Atlas): Place[] {
  let out = placesOf.get(atlas);
  if (!out) {
    const body = bodyBounds(atlas.parts);
    out = [
      ...regionsFor(atlas.parts, body).map((id): Place => ({kind: 'region', id})),
      ...areasFor(atlas.parts, body, null).map((id): Place => ({kind: 'area', id})),
    ];
    placesOf.set(atlas, out);
  }
  return out;
}

export function placeEntries(atlas: Atlas, t: Translate): Named<Place>[] {
  return placesIn(atlas).map((p) => {
    const shown = t(`${p.kind}.${p.id}`);
    return {item: p, id: p.id, names: [p.id.replace(/-/g, ' '), shown], label: shown};
  });
}

/** The concepts all of whose pieces pass `ok` (a structure half in the region is not « of » the region). */
function conceptsWithin(atlas: Atlas, ok: (p: Part) => boolean): string[] {
  const parts = new Map(atlas.parts.map((p) => [p.id, p]));
  return atlas.concepts.filter((c) => c.elements.length > 0 && c.elements.every((e) => {
    const p = parts.get(e);
    return !!p && ok(p);
  })).map((c) => c.id);
}

export interface ReviewScope {
  /** Stable for the same words: `voice:` and what was resolved. */
  id: string;
  label: string;
  systems: SystemId[];
  /** Concept ids the place or organ narrows to; absent when only systems were said. */
  only?: string[];
}

/**
 * The scope a review is asked on, from the words said, or null for the whole
 * body. Throws AMBIGUOUS with the candidates, and NO_SCOPE with what exists.
 */
export function resolveReviewScope(atlas: Atlas, words: string[], t: Translate, label: (c: Concept) => string): ReviewScope | null {
  const said = words.map((w) => w.trim()).filter(Boolean);
  if (!said.length) return null;
  const systems = systemEntries(atlas, t);
  const places = placeEntries(atlas, t);
  const body = bodyBounds(atlas.parts);
  const chosen: SystemId[] = [];
  let only: Set<string> | null = null;
  const names: string[] = [];
  const keys: string[] = [];
  const narrow = (ids: string[]) => { only ??= new Set(); for (const id of ids) only.add(id); };
  for (const w of said) {
    const s = matchNamed(systems, w);
    if (s.kind === 'ambiguous') throw new Error(`AMBIGUOUS: "${w}" names several systems: ${listed(s.labels)}; say which`);
    if (s.kind === 'found') {
      if (!chosen.includes(s.item)) { chosen.push(s.item); names.push(t(`system.${s.item}`)); keys.push(s.item); }
      continue;
    }
    const p = matchNamed(places, w);
    if (p.kind === 'ambiguous') throw new Error(`AMBIGUOUS: "${w}" names several places: ${listed(p.labels)}; say which`);
    if (p.kind === 'found') {
      const place = p.item;
      narrow(conceptsWithin(atlas, place.kind === 'region' ? (part) => partRegion(part, body) === place.id : (part) => partInArea(part, place.id, body)));
      names.push(t(`${place.kind}.${place.id}`));
      keys.push(`${place.kind}:${place.id}`);
      continue;
    }
    const r = resolveSaid(atlas.concepts, w, label);
    if (r.kind === 'ambiguous') throw new Error(`AMBIGUOUS: "${w}" names several structures: ${listed(r.candidates.map(label))}; say which`);
    if (r.kind === 'found') {
      const inside = new Set(r.concept.elements);
      narrow(conceptsWithin(atlas, (part) => inside.has(part.id)));
      names.push(label(r.concept));
      keys.push(r.concept.id);
      continue;
    }
    throw new Error(`NO_SCOPE: "${w}" is no system, region or structure of this body; systems: ${listed(systems.map((e) => e.label))}; places: ${listed(places.map((e) => e.label))}`);
  }
  const narrowed = only as Set<string> | null;
  return {
    id: `voice:${keys.join('+')}`,
    label: names.join(' + '),
    systems: chosen.length ? chosen : systemsIn(atlas),
    ...(narrowed ? {only: [...narrowed]} : {}),
  };
}
