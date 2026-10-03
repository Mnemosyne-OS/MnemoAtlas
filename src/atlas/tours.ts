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
 *
 * A step is either a list of candidates (one structure) or a STATION: several
 * structures lit together, named by an i18n key `station.<tour>.<name>`. The
 * fascial lines need stations (a line passes through muscle groups, both
 * sides), and so does the last stop of a line, which lights all of it.
 *
 * The fascial lines follow Thomas Myers' model of myofascial chains, which
 * anatomists still debate; the visit says so. Upstream #236 / #237 drew them
 * in a fork with its own export pipeline; these lists are written here from
 * the structures this atlas actually has. BodyParts3D 4.0 lacks the plantar
 * aponeurosis, the sacrotuberous ligament, the scalp aponeurosis, rectus
 * abdominis, internal oblique and the intercostal muscles, so those stations
 * are absent and each line's text names the gap. The spiral line crosses
 * sides; the bilateral concepts here cannot draw it, so it is left out.
 */
import type {Atlas, Concept, SystemId} from './anatomy';

export type TourId = 'heart' | 'respiratory' | 'digestive' | 'urinary' | 'reproductive' | 'trigeminal'
  | 'lineBack' | 'lineFront' | 'lineLateral' | 'lineDeep';

export type TourGroup = 'organ' | 'nerve' | 'line';

/** One structure (first candidate present wins), or a station lighting several. */
export type Step = string[] | {station: string; all: string[]};

export interface Tour {id: TourId; group: TourGroup; systems: SystemId[]; steps: Step[]}

/** The stations of a line, then a last stop that lights the whole line. */
function line(stations: {station: string; all: string[]}[]): Step[] {
  return [...stations, {station: 'all', all: stations.flatMap(s => s.all)}];
}

const LINE_SYSTEMS: SystemId[] = ['muscular', 'connective'];

export const TOURS: Tour[] = [
  {id: 'heart', group: 'organ', systems: ['cardiac'], steps: [
    ['FMA7096', 'HRA:VH_F_right_cardiac_atrium'], ['FMA7234', 'HRA:VH_F_tricuspid_valve'], ['FMA7098', 'HRA:VH_F_right_ventricle'],
    ['FMA7246', 'HRA:VH_F_pulmonary_valve'], ['FMA7097', 'HRA:VH_F_left_cardiac_atrium'], ['FMA7235', 'HRA:VH_F_mitral_valve'],
    ['FMA7101', 'HRA:VH_F_left_ventricle'], ['FMA7236', 'HRA:VH_F_aortic_valve'], ['FMA7088', 'HRA:VH_F_heart']]},
  {id: 'respiratory', group: 'organ', systems: ['respiratory'], steps: [
    ['FMA7394', 'HRA:VH_F_trachea'], ['FMA7409'], ['FMA7309'], ['FMA7310'], ['HRA:VH_F_lungs']]},
  {id: 'digestive', group: 'organ', systems: ['digestive'], steps: [
    ['FMA7131'], ['FMA7148'], ['FMA7206', 'HRA:VH_F_duodenum'], ['FMA7200', 'HRA:VH_F_small_intestine'], ['FMA7201', 'HRA:VH_F_colon'], ['FMA14541'],
    ['FMA14544', 'HRA:VH_F_rectum'], ['FMA7197', 'HRA:VH_F_liver'], ['FMA7202', 'HRA:VH_F_gallbladder'], ['FMA7198', 'HRA:VH_F_pancreas']]},
  {id: 'urinary', group: 'organ', systems: ['urinary'], steps: [
    ['FMA7203', 'HRA:VH_F_kidney'], ['FMA9704', 'HRA:VH_F_renal_pelvis_ureter'], ['FMA15900', 'HRA:VH_F_urinary_bladder'], ['FMA19667']]},
  {id: 'reproductive', group: 'organ', systems: ['reproductive'], steps: [
    // Male: testis, epididymis, deferent duct, seminal vesicle, prostate, penis.
    ['FMA7211', 'HRA:VH_F_ovary'], ['FMA18255', 'HRA:VH_F_fallopian_tube'], ['FMA19234', 'HRA:VH_F_uterus'],
    ['FMA19386', 'HRA:VH_F_vagina'], ['FMA9600'], ['FMA19618']]},
  // Upstream issue #430 asked for the three sensory zones of the face. The
  // skin zones are not drawn (the male body has no skin mesh); the branches
  // that serve them are shown, and each stop's text names its zone.
  {id: 'trigeminal', group: 'nerve', systems: ['nervous'], steps: [
    ['ZNTRIGEMIN-LC'], ['ZNOPHTHALM-LC'], ['ZNMAXILLAR-LC'], ['ZNMANDIBUL-LC'],
    {station: 'all', all: ['ZNTRIGEMIN-LC', 'ZNOPHTHALM-LC', 'ZNMAXILLAR-LC', 'ZNMANDIBUL-LC']}]},
  {id: 'lineBack', group: 'line', systems: LINE_SYSTEMS, steps: line([
    {station: 'sole', all: ['FMA37450']},
    {station: 'calf', all: ['FMA45950', 'FMA51061']},
    {station: 'hamstrings', all: ['FMA45881', 'FMA22357', 'FMA22438']},
    {station: 'spine', all: ['FMA77177', 'FMA77178', 'FMA77179']}])},
  {id: 'lineFront', group: 'line', systems: LINE_SYSTEMS, steps: line([
    {station: 'shin', all: ['FMA22532', 'FMA22534', 'FMA22533']},
    {station: 'thigh', all: ['FMA22430', 'FMA22431', 'FMA22432', 'FMA22433']},
    {station: 'neck', all: ['FMA13407']}])},
  {id: 'lineLateral', group: 'line', systems: LINE_SYSTEMS, steps: line([
    {station: 'fibular', all: ['FMA22539', 'FMA22540']},
    {station: 'hip', all: ['FMA51048', 'FMA22423', 'FMA22314', 'FMA22315']},
    {station: 'flank', all: ['FMA13335']},
    {station: 'neck', all: ['FMA22653', 'FMA13407']}])},
  {id: 'lineDeep', group: 'line', systems: LINE_SYSTEMS, steps: line([
    {station: 'deepCalf', all: ['FMA51099', 'FMA51071', 'FMA22593']},
    {station: 'knee', all: ['FMA22590']},
    {station: 'adductors', all: ['FMA22443', 'FMA22441', 'FMA22442']},
    {station: 'psoas', all: ['FMA18060', 'FMA22310']},
    {station: 'diaphragm', all: ['FMA13295']},
    {station: 'neck', all: ['FMA46308', 'FMA46279', 'FMA13385', 'FMA13386']}])},
];

/** The id of a station's synthetic concept; its title is the i18n key of the same name. */
export const isStation = (id: string) => id.startsWith('station.');

/** The steps of `tour` this body can show, in order, each with geometry in the tour's systems. */
export function tourSteps(atlas: Atlas, tour: Tour): Concept[] {
  const byId = new Map(atlas.concepts.map(c => [c.id, c]));
  const systemOf = new Map(atlas.parts.map(p => [p.id, p.system]));
  const steps: Concept[] = [];
  for (const step of tour.steps) {
    let concept: Concept | undefined;
    if (Array.isArray(step)) concept = step.map(id => byId.get(id)).find((c): c is Concept => !!c);
    else {
      // A station keeps whatever of its structures this body has.
      const elements = [...new Set(step.all.flatMap(id => byId.get(id)?.elements ?? []))];
      if (elements.length) concept = {id: `station.${tour.id}.${step.station}`, name: step.station, elements};
    }
    if (!concept || steps.some(s => s.id === concept!.id)) continue;
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
