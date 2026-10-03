/**
 * visibility.ts — the one rule deciding whether a piece is drawn.
 *
 * The scene, the explosion layout and the « N pieces visible » counter all ask
 * this, so they can never disagree about what is on screen.
 *
 * A selected piece is ALWAYS shown, hidden or not. That is what keeps the
 * review honest: it shows a structure by selecting and isolating it, and a
 * question about a piece the reader once hid would otherwise ask about an
 * empty scene. Hiding is for clearing the view, never for losing a structure.
 */
import type {SystemId} from './anatomy';

type Placed = {id: string; system: SystemId; name: string; bounds: [number[], number[]]};
/** `place` is the region or area filter (regions.ts); absent means the whole body. */
export interface ShownBy {visible: Set<SystemId>; hidden: Set<string>; selected: Set<string>; isolate: boolean; place?: (p: Placed) => boolean}

export function shownBy(s: {visible: SystemId[]; hidden: string[]; selected: string[]; isolate: boolean}, place?: (p: Placed) => boolean): ShownBy {
  return {visible: new Set(s.visible), hidden: new Set(s.hidden), selected: new Set(s.selected), isolate: s.isolate, place};
}

export function isShown(p: Placed, v: ShownBy): boolean {
  if (v.selected.has(p.id)) return true;
  if (v.isolate) return false;
  return v.visible.has(p.system) && !v.hidden.has(p.id) && (!v.place || v.place(p));
}

/** Hide what is selected; the selection itself is cleared so the hide takes effect. */
export function hideSelection<S extends {hidden: string[]; selected: string[]; isolate: boolean}>(s: S): S {
  return {...s, hidden: [...new Set([...s.hidden, ...s.selected])], selected: [], isolate: false};
}

/** Choosing a structure on purpose brings it back from hidden. */
export function unhide(hidden: string[], ids: string[]): string[] {
  if (!hidden.length) return hidden;
  const back = new Set(ids);
  return hidden.filter(id => !back.has(id));
}
