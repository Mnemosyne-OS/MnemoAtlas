/**
 * regions.ts — study the body the way anatomy is taught: by region, then by
 * the small teaching areas inside it (orbit, cubital fossa, porta hepatis…).
 *
 * From upstream human-atlas #1 (Steven Frohlich). A region is decided from
 * where a mesh sits in the body's bounding box; an area is decided from its
 * name. Both are filters on top of the systems, never instead of them: a
 * region with the skeleton only shows the bones of that region.
 *
 * Changes from upstream: the areas also catch the peripheral nerves this
 * cartridge ships (the brachial plexus itself, the median nerve at the elbow,
 * the tibial nerve behind the knee), and an area with nothing to show in the
 * current body is not offered — the female reference has other names.
 */
import type {Part} from './anatomy';

export type RegionId = 'head-neck' | 'torso' | 'abdomen' | 'arm' | 'pelvis' | 'legs';
export const REGIONS: RegionId[] = ['head-neck', 'torso', 'abdomen', 'arm', 'pelvis', 'legs'];

export type AreaId = 'orbit' | 'willis' | 'brainstem' | 'larynx' | 'heart' | 'lung-root' | 'porta' | 'celiac' | 'kidneys' | 'brachial-plexus' | 'axilla' | 'cubital' | 'wrist' | 'hand' | 'pelvic-viscera' | 'popliteal' | 'foot';
export const AREAS: {id: AreaId; regions: RegionId[]; match: RegExp}[] = [
  {id: 'orbit', regions: ['head-neck'], match: /(choroid|cornea|iris|sclera|lens|eyeball|optic nerve|optic chiasm|optic tract|ophthalmic nerve|lacrimal nerve|oculomotor|trochlear nerve|nasociliary|ciliary ganglion|ciliary nerve|frontal nerve|infratrochlear|supra-orbital nerve|supratrochlear|check ligament|levator palpebrae|trochlea of (left|right) superior oblique|(left|right) (inferior|superior|lateral|medial) rectus|(left|right) (inferior|superior) oblique)/i},
  {id: 'willis', regions: ['head-neck'], match: /(anterior communicating|posterior communicating|precommunicating part|cerebral arterial circle|basilar artery|internal carotid|vertebral artery|postcommunicating)/i},
  {id: 'brainstem', regions: ['head-neck'], match: /(medulla oblongata|^pons$|midbrain|cerebral aqueduct|(inferior|superior) colliculus|peduncle of midbrain|interpeduncular)/i},
  {id: 'larynx', regions: ['head-neck'], match: /(crico-arytenoid|thyro-arytenoid|arytenoid|epiglot|vocalis|cricoid|thyroid cartilage|hyoid bone|cricothyroid|vocal ligament|conus elasticus|aryepiglottic)/i},
  {id: 'heart', regions: ['torso'], match: /(cavity of (left|right) (ventricle|atrium)|mitral|tricuspid|(aortic|pulmonary) valve|cusp of|wall of ventricle|papillary muscle|coronary (artery|sinus)|ascending aorta|arch of aorta)/i},
  {id: 'lung-root', regions: ['torso'], match: /(main bronchus|pulmonary arter|pulmonary vein)/i},
  {id: 'porta', regions: ['abdomen'], match: /(portal vein|hepatic artery|bile duct|cystic duct|hepatic duct|gallbladder|caudate lobe of liver)/i},
  {id: 'celiac', regions: ['abdomen'], match: /(celiac trunk|celiac artery|splenic artery|left gastric|common hepatic artery|hepatic artery proper)/i},
  {id: 'kidneys', regions: ['abdomen'], match: /(kidney|adrenal|suprarenal|renal arter|renal vein)/i},
  {id: 'brachial-plexus', regions: ['arm', 'head-neck'], match: /(brachial plexus|suprascapular nerve|dorsal scapular nerve|long thoracic nerve|axillary nerve|scalenus|subclavius|subclavian artery|subclavian vein|axillary artery|axillary vein|clavicle|thoraco-acromial|circumflex humeral|circumflex scapular|subscapular artery|subscapular vein|thoracodorsal artery|thoracodorsal vein|vertebral artery)/i},
  {id: 'axilla', regions: ['arm'], match: /(axillary (artery|vein|nerve)|subscapular|thoracodorsal|circumflex (humeral|scapular)|latissimus|teres major|teres minor|pectoralis minor)/i},
  {id: 'cubital', regions: ['arm'], match: /(median cubital|brachialis|anconeus|ulnar recurrent|radial recurrent|ulnar collateral|recurrent interosseous|median nerve|ulnar nerve|radial nerve|musculocutaneous nerve)/i},
  {id: 'wrist', regions: ['arm'], match: /(flexor retinaculum of .+ wrist|scaphoid|lunate|triquetral|pisiform|hamate|capitate|trapezium|trapezoid)/i},
  {id: 'hand', regions: ['arm'], match: /(finger|thumb|pollic|metacar|thenar|palmar digital|interossei of (left|right) hand|lumbricals of (left|right) hand|opponens|abductor digiti minimi of (left|right) hand|dorsal venous network of .+ hand)/i},
  {id: 'pelvic-viscera', regions: ['pelvis'], match: /(urinary bladder|prostate|rectum|seminal|deferent|epididymis|testis)/i},
  {id: 'popliteal', regions: ['legs'], match: /(popliteal|popliteus|genicular|tibial nerve|common fibular nerve)/i},
  {id: 'foot', regions: ['legs'], match: /\b(foot|toe|talus|calcaneus|metatars|cuneiform|navicular|cuboid|plantar|hallucis|dorsal venous arch of .+ foot)/i},
];

/** Body-normalized heights: head/neck starts at C7, the arm floor sits below hanging fingertips. */
const REGION_Y = {head: 0.835, torso: 0.7, abdomen: 0.56, pelvis: 0.45, arm: 0.41, shoulder: 0.73} as const;
const ARM_LATERAL = 0.22, SHOULDER_LATERAL = 0.165;
/** The shoulder girdle sits too medial for the box rule, so its names decide. */
const ARM_NAME = /\b(clavicle|scapula|subclavius)\b/i;

export type Box = [number[], number[]];

export function bodyBounds(parts: Pick<Part, 'bounds'>[]): Box {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p.bounds[0][i]); max[i] = Math.max(max[i], p.bounds[1][i]); }
  return [min, max];
}

/** One region per mesh, from the centre of its box inside the body's box. */
export function partRegion(part: Pick<Part, 'name' | 'bounds'>, body: Box): RegionId {
  if (ARM_NAME.test(part.name)) return 'arm';
  const [min, max] = body, size = [max[0] - min[0], max[1] - min[1]];
  const cx = (part.bounds[0][0] + part.bounds[1][0]) / 2, cy = (part.bounds[0][1] + part.bounds[1][1]) / 2;
  const ny = size[1] > 0 ? (cy - min[1]) / size[1] : 0, lat = size[0] > 0 ? Math.abs((cx - min[0]) / size[0] - 0.5) : 0;
  if (ny >= REGION_Y.head) return 'head-neck';
  if (ny >= REGION_Y.arm && ny < REGION_Y.head && (lat >= ARM_LATERAL || (ny >= REGION_Y.shoulder && lat >= SHOULDER_LATERAL))) return 'arm';
  if (ny >= REGION_Y.torso) return 'torso';
  if (ny >= REGION_Y.abdomen) return 'abdomen';
  if (ny >= REGION_Y.pelvis) return 'pelvis';
  return 'legs';
}

export function partInArea(part: Pick<Part, 'name' | 'bounds'>, areaId: AreaId, body: Box): boolean {
  const area = AREAS.find(a => a.id === areaId);
  if (!area || !area.match.test(part.name)) return false;
  // « finger » and « toe » words cross the body; the hand stays in the arm, the foot in the legs.
  if (area.id === 'hand' && partRegion(part, body) !== 'arm') return false;
  if (area.id === 'foot' && partRegion(part, body) !== 'legs') return false;
  return true;
}

/**
 * The place filter for a scene state, or undefined when no region or area is
 * chosen. An area wins over its region: the brachial plexus reaches into the
 * neck, and choosing it from the arm must still show the scalenes.
 */
export function placeFilter(s: {region?: RegionId | null; area?: AreaId | null}, body: Box): ((p: Pick<Part, 'name' | 'bounds'>) => boolean) | undefined {
  if (s.area) { const area = s.area; return p => partInArea(p, area, body); }
  if (s.region) { const region = s.region; return p => partRegion(p, body) === region; }
  return undefined;
}

/** The regions this body has something in. The female reference has no arm meshes. */
export function regionsFor(parts: Pick<Part, 'name' | 'bounds'>[], body: Box): RegionId[] {
  const found = new Set(parts.map(p => partRegion(p, body)));
  return REGIONS.filter(r => found.has(r));
}

/** Fewer meshes than this is not a study area, it is a few stray pieces. */
export const MIN_AREA_PARTS = 8;

/** The areas worth offering: inside the chosen region (all when none), and a real cluster in this body. */
export function areasFor(parts: Pick<Part, 'name' | 'bounds'>[], body: Box, region: RegionId | null): AreaId[] {
  return AREAS.filter(a => (!region || a.regions.includes(region)) && parts.filter(p => partInArea(p, a.id, body)).length >= MIN_AREA_PARTS).map(a => a.id);
}
