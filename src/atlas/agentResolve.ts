/**
 * agentResolve.ts — how an agent's words become ONE structure (doc 149).
 *
 * An agent says « heart », « coeur », « FMA7088 » or « the left lung ». The
 * search panel can offer a list and let the person pick; an agent call must
 * land on one structure or be refused, and a refusal must say what to ask
 * instead, or the agent guesses again blind.
 *
 * The order: an exact atlas id, then an exact name in English or in the
 * reader's language, then the ONE name that starts with the words asked (and
 * between several, the organ whose English name is one word), then the page's
 * own search (`searchConcepts`) when it finds exactly one structure. Several
 * hits are AMBIGUOUS and returned for the agent to choose from; none are
 * retried word by word to name the closest.
 */
import {fold} from './fold';
import {searchConcepts} from './search';
import type {Concept} from './anatomy';

export type Resolved =
  | {kind: 'found'; concept: Concept}
  | {kind: 'ambiguous'; candidates: Concept[]}
  | {kind: 'none'; near: Concept[]};

/** How many names a refusal offers. Past this an agent reads a list, not a hint. */
export const HINT_COUNT = 8;
/** Words shorter than this (« the », « of », « my ») match half the atlas. */
const MIN_WORD = 4;

export function resolveStructure(concepts: Concept[], query: string, label?: (c: Concept) => string): Resolved {
  const raw = query.trim();
  const term = fold(raw);
  if (!term) return {kind: 'none', near: []};
  const byId = concepts.find(c => c.id === raw) ?? concepts.find(c => fold(c.id) === term);
  if (byId) return {kind: 'found', concept: byId};
  const exact = concepts.find(c => fold(c.name) === term || (label ? fold(label(c)) === term : false));
  if (exact) return {kind: 'found', concept: exact};
  // « coeur » for « cœur humain »: the ONE name that starts with the words
  // asked. The translations add a qualifier the English name has not, and the
  // search then found every vein of the heart (the orb's first run, 2026-10-13).
  // Several such names: the organ itself is the one whose English name is one
  // word (« cœur humain » = heart, « cœur droit » = right side of heart).
  // « poumon droit » and « poumon gauche » stay ambiguous.
  const lead = concepts.filter(c => fold(c.name).startsWith(`${term} `) || (label ? fold(label(c)).startsWith(`${term} `) : false));
  if (lead.length === 1) return {kind: 'found', concept: lead[0]};
  const organ = lead.filter(c => !/\s/.test(c.name.trim()));
  if (organ.length === 1) return {kind: 'found', concept: organ[0]};
  const hits = searchConcepts(concepts, raw, label, HINT_COUNT);
  if (hits.length === 1) return {kind: 'found', concept: hits[0]};
  if (hits.length > 1) return {kind: 'ambiguous', candidates: hits};
  const near: Concept[] = [];
  for (const word of term.split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= MIN_WORD)) {
    for (const c of searchConcepts(concepts, word, label, HINT_COUNT)) if (!near.includes(c)) near.push(c);
    if (near.length >= HINT_COUNT) break;
  }
  return {kind: 'none', near: near.slice(0, HINT_COUNT)};
}

/**
 * The actions that change what the person sees, as `mnemo-plugin.json`
 * declares them (`effect: "write"`); a test holds the two lists equal.
 */
export const ATLAS_WRITES: readonly string[] = [
  'focus', 'showSystems', 'switchBody', 'explode', 'cameraView', 'resetView', 'rotate',
  'isolate', 'clearSelection', 'hideStructure', 'showPlace', 'startTour', 'tourStep', 'heartbeat',
];

/**
 * The review's own gestures (a review driven by voice): writes too, and the
 * only ones a running review lets through, because they ARE the review.
 */
export const REVIEW_ACTIONS: readonly string[] = [
  'reviewStart', 'reviewAnswer', 'reviewNext', 'reviewSkip', 'reviewRepeat', 'reviewScope', 'reviewStop',
];

/**
 * Why an agent's action is refused while a review run is on screen, or null.
 * 🚨 During a review the view is the person's: a write would move the camera
 * off the question or name its answer. Reads and the review's own gestures
 * still answer.
 */
export function quizRefusal(action: string, quizLock: boolean): string | null {
  if (quizLock && ATLAS_WRITES.includes(action)) return "QUIZ_RUNNING: a review run is on screen and the view is the person's; reviewStop ends it (close true gives the body back)";
  return null;
}

/**
 * Each pace as a multiple of the speed the person chose (rotateSettings): the
 * button and an agent's « normal » turn alike, and one setting moves both.
 */
export const ROTATE_SPEEDS = {slow: 0.5, normal: 1, fast: 2} as const;
export type RotatePace = keyof typeof ROTATE_SPEEDS;

/**
 * Whether the camera turns by itself now. 🚨 An isolated structure turns too:
 * the camera then circles what is isolated (its target is the structure's
 * centre). The rule once left it out, so the button lit up and nothing moved.
 * A body coming apart does not turn (its pieces fly from the centre).
 */
export function autoRotating(s: {rotate: boolean; explode: number}): boolean {
  return s.rotate && s.explode < 0.4;
}

/**
 * Showing systems starts the turn, at the person's own speed (asked on
 * 2026-10-13: every system shown should turn by itself). A switch, a
 * preset, « All » and the agent's showSystems all go through it.
 * Hiding never starts it, and a body coming apart keeps what it had: it does
 * not turn, and a rotate flag set under it would start the turn the moment
 * the person closes it again.
 */
export function turnOnShow(s: {rotate: boolean; explode: number; rotatePace?: number}): {rotate: boolean; rotatePace?: number} {
  return autoRotating({rotate: true, explode: s.explode}) ? {rotate: true, rotatePace: undefined} : {rotate: s.rotate, rotatePace: s.rotatePace};
}
