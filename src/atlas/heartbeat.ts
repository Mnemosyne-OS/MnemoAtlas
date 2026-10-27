/**
 * heartbeat.ts — a schematic beat for the heart meshes the atlas already has.
 *
 * No dataset carries a beating heart under an open licence (BodyParts3D and
 * the HRA organ set are end-diastolic stills), so the beat is CODE: each
 * chamber mesh is scaled about its own centre by a factor that follows the
 * cardiac cycle. The scene applies the factor in the vertex shader, next to
 * the per-part offset of the exploded view, so no geometry is rewritten.
 *
 * What it is, said plainly in the interface: a schematic rhythm at 72 per
 * minute. The atria contract first, the ventricles after them, the atria
 * refill while the ventricles squeeze. What it is not: valves do not open or
 * close, vessels do not pulse, and the amplitudes are chosen to be visible,
 * not measured on anyone.
 *
 * Everything here is pure so the rules can be tested without WebGL, on the
 * two real bodies.
 */

export const BEATS_PER_MINUTE = 72;

export type Chamber = 'atrium' | 'ventricle';
/** A cavity is the blood pool inside a wall (the male body ships both as separate meshes). */
export type Tissue = 'wall' | 'cavity';
export interface HeartRole {chamber: Chamber; tissue: Tissue}

/** The part of the mesh name that marks a vessel, a valve or a cusp: those hold still. */
const STILL = /\b(valve|cusp|leaflet|artery|arteries|vein|veins|branch|trunk|aorta|arch)\b/;

/**
 * Which chamber a mesh belongs to, or null when it holds still.
 *
 * 🚨 Gated on the cardiac system FIRST: « Third ventricle » is in the brain,
 * « interventricular branch » is a coronary, and the female cardiac system
 * carries twenty-two great vessels, one of which reaches the navel. Inside
 * the system, a vessel-named mesh (« Posterior ventricular branch of
 * circumflex coronary artery ») is still a vessel.
 */
export function heartRole(part: {name: string; system: string}): HeartRole | null {
  if (part.system !== 'cardiac') return null;
  const n = part.name.toLowerCase();
  if (STILL.test(n)) return null;
  const tissue: Tissue = /\bcavity\b/.test(n) ? 'cavity' : 'wall';
  if (/\batrium\b/.test(n)) return {chamber: 'atrium', tissue};
  // ventricle, ventricles, interventricular septum, papillary muscle of the left ventricle
  if (/ventric/.test(n)) return {chamber: 'ventricle', tissue};
  return null;
}

/**
 * Where in the cycle (0 at the atrial kick, 1 at the next) `seconds` falls.
 * A rate of 0 or less, or not a number, is no beat: phase 0, where every
 * chamber is at rest — never a frozen mid-contraction.
 */
export function beatPhase(seconds: number, bpm = BEATS_PER_MINUTE): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(bpm) || bpm <= 0) return 0;
  const cycles = seconds * bpm / 60;
  return cycles - Math.floor(cycles);
}

/** A raised-cosine bump: 0 before `from` and after `to`, 1 at `peak`, smooth in between. */
function bump(phase: number, from: number, peak: number, to: number): number {
  if (phase <= from || phase >= to) return 0;
  const t = phase < peak ? (phase - from) / (peak - from) : (to - phase) / (to - peak);
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** Linear shrink at the peak of a contraction, per chamber and tissue. */
export const CONTRACTION: Record<Chamber, Record<Tissue, number>> = {
  atrium: {wall: 0.05, cavity: 0.08},
  ventricle: {wall: 0.07, cavity: 0.12},
};
/** The atria swell a little while the ventricles squeeze: they are filling. */
export const ATRIAL_FILLING = 0.02;

/** The atria contract in the first fifth of the cycle, the ventricles in the second and third. */
export const ATRIAL_SYSTOLE = {from: 0, peak: 0.07, to: 0.18} as const;
export const VENTRICULAR_SYSTOLE = {from: 0.14, peak: 0.34, to: 0.58} as const;
const FILLING = {from: 0.22, peak: 0.45, to: 0.7} as const;

/**
 * The scale of a chamber mesh at `phase`: 1 at rest, under 1 while it
 * contracts, a touch over 1 for an atrium that fills.
 */
export function beatScale(role: HeartRole, phase: number): number {
  const shrink = CONTRACTION[role.chamber][role.tissue];
  if (role.chamber === 'atrium') {
    return 1 - shrink * bump(phase, ATRIAL_SYSTOLE.from, ATRIAL_SYSTOLE.peak, ATRIAL_SYSTOLE.to)
      + ATRIAL_FILLING * bump(phase, FILLING.from, FILLING.peak, FILLING.to);
  }
  return 1 - shrink * bump(phase, VENTRICULAR_SYSTOLE.from, VENTRICULAR_SYSTOLE.peak, VENTRICULAR_SYSTOLE.to);
}
