/**
 * camera-fit.ts — what the camera does while the body opens and closes.
 *
 * Two rules, both pure so they can be tested without WebGL.
 */
import type {View} from './anatomy';

/** Past this explode amount the pieces lie flat and only the front view makes sense. */
export const FLAT_AT = 0.8;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Where the orbit target sits for a fit at `extent` (0 assembled, 1 flat).
 *
 * It used to switch at extent 0.1 — explode 37% — so the model jumped
 * sideways and upward there while the slider moved by one percent (upstream
 * human-atlas issue #215). The two positions are unchanged; the move between
 * them is now a ramp. On desktop the flat layout shifts left to clear the
 * systems panel; a phone has no side panel.
 */
export function fitTarget(extent: number, mobile: boolean, packingWidth: number): {x: number; y: number} {
  if (mobile) return {x: 0, y: 0.85};
  const k = smoothstep(0.05, 0.2, extent);
  return {x: -packingWidth * 0.12 * k, y: 0.68 + (0.85 - 0.68) * k};
}

/**
 * Set the explode amount, and the view with it.
 *
 * Going flat forces the front view and remembers the one it replaced; coming
 * back below FLAT_AT restores it, instead of leaving someone who was on the
 * side view stuck in front (upstream human-atlas #213). Every writer of
 * `explode` goes through here — the slider, the hand, the explode action, the
 * isolate button and the review — so none of them can forget the view.
 */
export function withExplode<S extends {explode: number; view: View; viewBeforeExplode?: View}>(s: S, value: number): S {
  const up = s.explode <= FLAT_AT && value > FLAT_AT;
  const down = s.explode > FLAT_AT && value <= FLAT_AT;
  if (up) return {...s, explode: value, view: 'front', viewBeforeExplode: s.view};
  if (down) return {...s, explode: value, view: s.viewBeforeExplode ?? s.view, viewBeforeExplode: undefined};
  return {...s, explode: value, view: value > FLAT_AT ? 'front' : s.view};
}
