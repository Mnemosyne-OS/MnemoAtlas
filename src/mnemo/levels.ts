/**
 * levels.ts — what you can choose to study, and how far along you are in it.
 *
 * A level is one anatomical system, plus one tile for the whole body. They are
 * DERIVED from the atlas that is loaded, never listed by hand: the male body
 * has fifteen systems, the female one has fourteen and a different mix, and a
 * hand-written list would quietly show a bone tile on a body with no bones in
 * it, or hide a system a future dataset adds.
 *
 * Everything here is pure and takes `now` as an argument, so the same rules
 * can be tested against a date rather than against whatever the clock says.
 *
 * Three decisions, each one a way this screen could mislead:
 *
 * 1. THE TILE'S TOTAL IS WHAT THE QUIZ WILL ACTUALLY ASK. Both come from the
 *    same function. Counting meshes on the tile and asking about concepts in
 *    the quiz would put "296 structures" on a tile that runs out after 90, and
 *    the progress bar would never reach the end for a reason nobody could see.
 *
 * 2. A LEVEL TOO SMALL FOR A FAIR QUESTION SAYS SO INSTEAD OF STARTING. Four
 *    options need four candidates. With three, either the quiz shows fewer
 *    options — a question that is easier without saying it got easier — or it
 *    borrows from another system, which is the one thing that makes a right
 *    answer meaningless.
 *
 * 3. PROGRESS IS A COUNT OF CARDS, NEVER A COUNT OF STRUCTURES. A level you
 *    have never opened has no cards, so it reads zero-of-many. It must never
 *    read as "mastered 0%" of something measured — the panel decides how to
 *    render an unread store; this file only reports what the cards say.
 */
import { SYSTEMS, type Atlas, type SystemId } from '../atlas/anatomy';
import { dayOf, TOP_BOX, type Askable, type ReviewState } from './review';

/** Four options need four candidates; below that a question cannot be fair. */
export const MIN_FOR_QUIZ = 4;

/** The id of the tile that covers the whole body. */
export const ALL_LEVEL = '__all__';

export interface Level {
  id: string;
  name: string;
  color: string;
  /** Systems this level draws from. */
  systems: SystemId[];
  /** Structures askable in it — the same number the quiz will draw from. */
  total: number;
}

export interface LevelProgress {
  /** Cards that exist for this level. */
  studied: number;
  /** Cards in the last box. */
  mastered: number;
  /** Cards whose due day has arrived. */
  due: number;
  /** 0..1 of the level's structures that have reached the last box. */
  ratio: number;
}

/**
 * The structures a quiz can ask about, for a set of systems.
 *
 * Built from CONCEPTS, not parts: "femur" is one thing to learn even though it
 * is two meshes, and asking the same question twice under two mesh ids would
 * inflate every count on the screen.
 */
export function askablePool(atlas: Atlas, systems: SystemId[]): Askable[] {
  const wanted = new Set(systems);
  const partSystem = new Map(atlas.parts.map((p) => [p.id, p.system]));
  const out: Askable[] = [];
  for (const c of atlas.concepts) {
    let system: SystemId | undefined;
    for (const e of c.elements) {
      const s = partSystem.get(e);
      if (s && wanted.has(s)) { system = s; break; }
    }
    if (system) out.push({ id: c.id, name: c.name, system });
  }
  return out;
}

/**
 * Every level this atlas can offer, biggest first, with the whole-body tile
 * in front. Systems the atlas does not use produce no tile at all.
 */
export function levelsOf(atlas: Atlas): Level[] {
  const present = SYSTEMS.filter((s) => atlas.parts.some((p) => p.system === s.id));
  const perSystem = present
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      systems: [s.id],
      total: askablePool(atlas, [s.id]).length,
    }))
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total);

  const all: Level = {
    id: ALL_LEVEL,
    name: '',   // named by the panel: `level.all` in the strings table
    color: '#7d8a97',
    systems: present.map((s) => s.id),
    total: askablePool(atlas, present.map((s) => s.id)).length,
  };
  return [all, ...perSystem];
}

export function levelProgress(level: Level, atlas: Atlas, state: ReviewState, now: number): LevelProgress {
  const today = dayOf(now);
  const ids = askablePool(atlas, level.systems).map((a) => a.id);
  let studied = 0, mastered = 0, due = 0;
  for (const id of ids) {
    const c = state.cards[id];
    if (!c) continue;
    studied++;
    if (c.b >= TOP_BOX) mastered++;
    if (c.d <= today) due++;
  }
  // A level with no structures has no ratio to report; zero would read as
  // "none of them mastered", which is a different statement from "empty".
  return { studied, mastered, due, ratio: ids.length ? mastered / ids.length : 0 };
}

/**
 * Whether a level can be studied, and why not when it cannot.
 *
 * The refusal is a CODE, not a sentence. A pure module that returned English
 * prose would have to know the reader's language, and the language is a fact
 * about the screen — the panel turns `why` into words.
 */
export type NoQuizReason = 'empty' | 'tooSmall';

export function canStudy(level: Level): { ok: boolean; why?: NoQuizReason; n: number } {
  if (level.total >= MIN_FOR_QUIZ) return { ok: true, n: level.total };
  return { ok: false, why: level.total === 0 ? 'empty' : 'tooSmall', n: level.total };
}
