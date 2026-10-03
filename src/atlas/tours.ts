/**
 * tours.ts — guided visits: an ordered walk through named structures, each
 * one framed, selected and explained. The thing a system toggle cannot do.
 *
 * From upstream human-atlas #5 (Carson Rodrigues). Each step lists candidate
 * concept ids and the first one present in the loaded body wins, so one tour
 * serves both bodies: BodyParts3D speaks FMA, the female reference speaks HRA.
 * A step missing from the body is skipped, and a tour left with fewer than
 * two steps is not offered — a « visit » of one stop is a search result.
 *
 * Changes from upstream: the reproductive tour walks the male tract too
 * (testis to penis, ids read from our atlas), and no data was repacked.
 */
import type {Atlas, Concept, SystemId} from './anatomy';

export type TourId = 'heart' | 'respiratory' | 'digestive' | 'urinary' | 'reproductive';

export interface Tour {id: TourId; systems: SystemId[]; steps: string[][]}

export const TOURS: Tour[] = [
  {id: 'heart', systems: ['cardiac'], steps: [
    ['FMA7096', 'HRA:VH_F_right_cardiac_atrium'], ['FMA7234', 'HRA:VH_F_tricuspid_valve'], ['FMA7098', 'HRA:VH_F_right_ventricle'],
    ['FMA7246', 'HRA:VH_F_pulmonary_valve'], ['FMA7097', 'HRA:VH_F_left_cardiac_atrium'], ['FMA7235', 'HRA:VH_F_mitral_valve'],
    ['FMA7101', 'HRA:VH_F_left_ventricle'], ['FMA7236', 'HRA:VH_F_aortic_valve'], ['FMA7088', 'HRA:VH_F_heart']]},
  {id: 'respiratory', systems: ['respiratory'], steps: [
    ['FMA7394', 'HRA:VH_F_trachea'], ['FMA7409'], ['FMA7309'], ['FMA7310'], ['HRA:VH_F_lungs']]},
  {id: 'digestive', systems: ['digestive'], steps: [
    ['FMA7131'], ['FMA7148'], ['FMA7206', 'HRA:VH_F_duodenum'], ['FMA7200', 'HRA:VH_F_small_intestine'], ['FMA7201', 'HRA:VH_F_colon'], ['FMA14541'],
    ['FMA14544', 'HRA:VH_F_rectum'], ['FMA7197', 'HRA:VH_F_liver'], ['FMA7202', 'HRA:VH_F_gallbladder'], ['FMA7198', 'HRA:VH_F_pancreas']]},
  {id: 'urinary', systems: ['urinary'], steps: [
    ['FMA7203', 'HRA:VH_F_kidney'], ['FMA9704', 'HRA:VH_F_renal_pelvis_ureter'], ['FMA15900', 'HRA:VH_F_urinary_bladder'], ['FMA19667']]},
  {id: 'reproductive', systems: ['reproductive'], steps: [
    // Male: testis, epididymis, deferent duct, seminal vesicle, prostate, penis.
    ['FMA7211', 'HRA:VH_F_ovary'], ['FMA18255', 'HRA:VH_F_fallopian_tube'], ['FMA19234', 'HRA:VH_F_uterus'],
    ['FMA19386', 'HRA:VH_F_vagina'], ['FMA9600'], ['FMA19618']]},
];

/** The steps of `tour` this body can show, in order, each with geometry in the tour's systems. */
export function tourSteps(atlas: Atlas, tour: Tour): Concept[] {
  const byId = new Map(atlas.concepts.map(c => [c.id, c]));
  const systemOf = new Map(atlas.parts.map(p => [p.id, p.system]));
  const steps: Concept[] = [];
  for (const candidates of tour.steps) {
    const concept = candidates.map(id => byId.get(id)).find((c): c is Concept => !!c);
    if (!concept || steps.some(s => s.id === concept.id)) continue;
    if (concept.elements.some(e => tour.systems.includes(systemOf.get(e) as SystemId))) steps.push(concept);
  }
  return steps;
}

/** Every piece a tour selects across all its stops: what the camera frames, so it holds still from stop to stop. */
export function tourFrame(steps: Concept[], atlas: Atlas, systems: SystemId[]): string[] {
  return [...new Set(steps.flatMap(c => stepSelection(c, atlas, systems)))];
}

/** The tours worth offering in this body: two steps or more. */
export function toursFor(atlas: Atlas): {tour: Tour; steps: Concept[]}[] {
  return TOURS.map(tour => ({tour, steps: tourSteps(atlas, tour)})).filter(t => t.steps.length >= 2);
}

/**
 * The pieces of a step to select. A concept can reach past the tour's systems
 * (« heart » owns muscle and vessel meshes too); those would be drawn anyway,
 * since a selected piece always shows, and pull the eye off the stop. Falls
 * back to every element when the filter leaves nothing.
 */
export function stepSelection(concept: Concept, atlas: Atlas, systems: SystemId[]): string[] {
  const systemOf = new Map(atlas.parts.map(p => [p.id, p.system]));
  const inside = concept.elements.filter(e => systems.includes(systemOf.get(e) as SystemId));
  return inside.length ? inside : concept.elements;
}
