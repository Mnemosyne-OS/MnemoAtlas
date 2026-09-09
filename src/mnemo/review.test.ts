/**
 * The rules that decide what someone is told they know.
 *
 * Every test here pins a way this could lie rather than crash: a score that
 * counts structures nobody was ever asked, a question whose distractors give
 * the answer away, a progress file that loses the cards it could not parse.
 * None of those throw, none turn the screen red, and all of them would be
 * discovered months later by someone who trusted the number.
 */
import { describe, it, expect } from 'vitest';
import {
  BOXES, TOP_BOX, dayOf, emptyState, grade, nextQuestion, parseState, progress,
  sessionNote, stateSize, STATE_LIMIT_BYTES,
  type Answered, type Askable, type ReviewState,
} from './review';

const DAY = 86_400_000;
// Midnight UTC exactly (day 20694). It has to be aligned: at 10:40 UTC, which
// is where the round number 1_788_000_000_000 falls, "the same day plus 23h"
// really is the next day, and the fixture accuses the code of a bug it does
// not have. A fixture that is wrong about time is the cheapest way to spend
// an evening fixing nothing.
const T0 = 20_694 * DAY;

const pool: Askable[] = [
  { id: 'FMA1', name: 'femur', system: 'skeletal' },
  { id: 'FMA2', name: 'tibia', system: 'skeletal' },
  { id: 'FMA3', name: 'fibula', system: 'skeletal' },
  { id: 'FMA4', name: 'patella', system: 'skeletal' },
  { id: 'FMA5', name: 'hepatic artery', system: 'arterial' },
  { id: 'FMA6', name: 'renal artery', system: 'arterial' },
];

describe('grading', () => {
  it('never leaves a structure you got right due on the same day', () => {
    // Box 0 means "come back today" and belongs to a miss. A first correct
    // answer landing there made the panel report six structures due straight
    // after studying six. Observed on screen, not by a failing test.
    const c = grade(undefined, true, T0);
    expect(c.n).toBe(1);
    expect(c.b).toBe(1);
    expect(c.d).toBeGreaterThan(dayOf(T0));
  });

  it('moves up one box on each further right answer', () => {
    let c = grade(undefined, true, T0);
    c = grade(c, true, T0);
    expect(c.b).toBe(2);
    expect(c.d).toBe(dayOf(T0) + BOXES[2]);
    expect(c.n).toBe(2);
  });

  it('lets a missed card climb back out on the next right answer', () => {
    const missed = grade({ b: 3, d: 0, n: 5 }, false, T0);
    expect(missed.b).toBe(0);
    expect(missed.d).toBe(dayOf(T0)); // today, which is what box 0 is for
    const recovered = grade(missed, true, T0);
    expect(recovered.b).toBe(1);
  });

  it('sends a wrong answer back to the start but never forgets it was asked', () => {
    let c = { b: 4, d: dayOf(T0) + 16, n: 9 };
    c = grade(c, false, T0);
    expect(c.b).toBe(0);
    expect(c.d).toBe(dayOf(T0));
    // The count is history. Resetting it would erase the fact that someone
    // has struggled with this structure nine times.
    expect(c.n).toBe(10);
  });

  it('stops climbing at the last box instead of running off the end of the table', () => {
    let c = { b: TOP_BOX, d: 0, n: 20 };
    c = grade(c, true, T0);
    expect(c.b).toBe(TOP_BOX);
    expect(c.d).toBe(dayOf(T0) + BOXES[TOP_BOX]);
  });

  it('is measured in whole days, so the hour you studied does not follow you', () => {
    const morning = grade(undefined, true, T0);
    const almostMidnight = grade(undefined, true, T0 + 23 * 3_600_000);
    expect(almostMidnight.d).toBe(morning.d);
  });
});

describe('progress', () => {
  it('counts only structures that have actually been asked', () => {
    const s: ReviewState = { v: 1, cards: { FMA1: { b: 0, d: dayOf(T0), n: 1 } } };
    // Six structures exist in the pool; one has been asked. "seen" is one.
    expect(progress(s, T0).seen).toBe(1);
  });

  it('reports an empty store as empty, never as a zero score', () => {
    const p = progress(emptyState(), T0);
    expect(p).toEqual({ seen: 0, due: 0, mastered: 0 });
  });

  it('counts a card due today as due', () => {
    const s: ReviewState = {
      v: 1,
      cards: {
        FMA1: { b: 0, d: dayOf(T0), n: 1 },      // today
        FMA2: { b: 1, d: dayOf(T0) - 3, n: 2 },  // overdue
        FMA3: { b: 2, d: dayOf(T0) + 5, n: 3 },  // later
      },
    };
    expect(progress(s, T0).due).toBe(2);
  });
});

describe('parsing what came back from the host', () => {
  it('turns anything unreadable into an empty store, never a partial one', () => {
    for (const junk of [null, undefined, 'nope', 42, [], {}, { v: 2, cards: {} }]) {
      expect(parseState(junk)).toEqual(emptyState());
    }
  });

  it('drops malformed cards but keeps the readable ones', () => {
    const parsed = parseState({
      v: 1,
      cards: {
        FMA1: { b: 2, d: 100, n: 3 },
        FMA2: { b: 'two', d: 100, n: 3 },
        FMA3: { b: NaN, d: 1, n: 1 },
      },
    });
    expect(Object.keys(parsed.cards)).toEqual(['FMA1']);
  });

  it('clamps a box from a corrupted file instead of trusting it into the interval table', () => {
    const parsed = parseState({ v: 1, cards: { FMA1: { b: 99, d: 1, n: 1 } } });
    expect(parsed.cards.FMA1!.b).toBe(TOP_BOX);
    // Which is what stops grade() from reading past the end of BOXES.
    expect(BOXES[parsed.cards.FMA1!.b]).toBeDefined();
  });
});

describe('building a question', () => {
  it('refuses to ask when there is nothing to choose between', () => {
    expect(nextQuestion([], emptyState(), T0, 1)).toBeNull();
    expect(nextQuestion([pool[0]!], emptyState(), T0, 1)).toBeNull();
  });

  it('always includes the right answer among the options', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = nextQuestion(pool, emptyState(), T0, seed)!;
      expect(q.options.map((o) => o.id)).toContain(q.subject.id);
    }
  });

  it('never repeats an option', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = nextQuestion(pool, emptyState(), T0, seed)!;
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    }
  });

  it('draws distractors from the same system, so a right answer is evidence', () => {
    // The subject's system has 4 members, enough to fill a 4-option question
    // without leaving it. If it ever reaches outside, the question becomes
    // "which of these is a bone", which anyone passes without knowing anything.
    for (let seed = 1; seed < 40; seed++) {
      const q = nextQuestion(pool, emptyState(), T0, seed)!;
      if (q.subject.system !== 'skeletal') continue;
      expect(q.options.every((o) => o.system === 'skeletal')).toBe(true);
    }
  });

  it('widens beyond the system rather than asking a two-option question', () => {
    // 'arterial' has only 2 members, so a 4-option question must borrow.
    const arterialOnly = pool.filter((p) => p.system === 'arterial' || p.system === 'skeletal');
    const q = nextQuestion(arterialOnly, emptyState(), T0, 7, 4)!;
    expect(q.options.length).toBe(4);
  });

  it('asks a due card before an unseen one', () => {
    const state: ReviewState = { v: 1, cards: { FMA5: { b: 0, d: dayOf(T0) - 1, n: 1 } } };
    for (let seed = 1; seed < 20; seed++) {
      expect(nextQuestion(pool, state, T0, seed)!.subject.id).toBe('FMA5');
    }
  });

  it('asks an unseen structure before one that is not due yet', () => {
    const state: ReviewState = { v: 1, cards: {} };
    for (const p of pool) if (p.id !== 'FMA3') state.cards[p.id] = { b: 3, d: dayOf(T0) + 7, n: 4 };
    for (let seed = 1; seed < 20; seed++) {
      expect(nextQuestion(pool, state, T0, seed)!.subject.id).toBe('FMA3');
    }
  });

  it('still asks something when nothing is due and nothing is new', () => {
    const state: ReviewState = { v: 1, cards: {} };
    pool.forEach((p, i) => { state.cards[p.id] = { b: 3, d: dayOf(T0) + 2 + i, n: 4 }; });
    const q = nextQuestion(pool, state, T0, 3);
    // The one closest to being due — studying ahead is allowed, going blank is not.
    expect(q!.subject.id).toBe('FMA1');
  });

  it('is reproducible for a given seed', () => {
    const a = nextQuestion(pool, emptyState(), T0, 123)!;
    const b = nextQuestion(pool, emptyState(), T0, 123)!;
    expect(a.subject.id).toBe(b.subject.id);
    expect(a.options.map((o) => o.id)).toEqual(b.options.map((o) => o.id));
  });
});

describe('the size of what we ask the host to hold', () => {
  it('reports pressure before the 256 KB ceiling, not after', () => {
    const state = emptyState();
    for (let i = 0; i < 9000; i++) state.cards[`FMA${i}`] = { b: 3, d: 20000, n: 5 };
    const s = stateSize(state);
    expect(s.bytes).toBeGreaterThan(0);
    expect(s.tight).toBe(true);
    // The warning has to arrive while there is still room to act on it.
    expect(s.bytes).toBeLessThan(STATE_LIMIT_BYTES * 1.5);
  });

  it('a realistic store is nowhere near the ceiling', () => {
    const state = emptyState();
    // Every named concept in the male atlas, all reviewed.
    for (let i = 0; i < 3432; i++) state.cards[`FMA${i}`] = { b: 2, d: 19999, n: 3 };
    expect(stateSize(state).tight).toBe(false);
  });
});

describe('dayOf', () => {
  it('advances exactly once per day', () => {
    expect(dayOf(T0 + DAY) - dayOf(T0)).toBe(1);
    expect(dayOf(T0 + DAY - 1) - dayOf(T0)).toBe(0);
  });
});

describe('not repeating what was just asked', () => {
  it('moves on instead of asking the same structure again', () => {
    // A wrong answer files the card as due TODAY, so without this the "due"
    // branch hands back the same structure for the rest of the sitting.
    // Measured in the browser: six answers in a row landed on one structure.
    const state: ReviewState = { v: 1, cards: { FMA1: { b: 0, d: dayOf(T0), n: 1 } } };
    const asked = new Set(['FMA1']);
    for (let seed = 1; seed < 40; seed++) {
      expect(nextQuestion(pool, state, T0, seed, 4, asked)!.subject.id).not.toBe('FMA1');
    }
  });

  it('comes back to it rather than running out of questions', () => {
    // Every structure asked already. Refusing to repeat here would end the
    // sitting on a blank panel, which is worse than asking again.
    const asked = new Set(pool.map((p) => p.id));
    const q = nextQuestion(pool, emptyState(), T0, 5, 4, asked);
    expect(q).not.toBeNull();
    expect(pool.map((p) => p.id)).toContain(q!.subject.id);
  });

  it('leaves the options alone — only the SUBJECT steps aside', () => {
    // The distractors still come from the whole pool. Excluding them too would
    // shrink a small level's options below four after a few answers, quietly
    // making the quiz easier as you go.
    const asked = new Set(['FMA1', 'FMA2']);
    const q = nextQuestion(pool, emptyState(), T0, 11, 4, asked)!;
    expect(q.options.length).toBe(4);
  });
});

describe('the chronicle a session leaves behind', () => {
  const opts = { body: 'male', source: 'BodyParts3D', scopeNames: ['Skeleton'], now: T0 };
  const a = (id: string, name: string, correct: boolean, n = 1): Answered =>
    ({ id, name, system: 'skeletal', correct, n });

  it('writes nothing at all for a session with no answers', () => {
    // An ingest is permanent and has no file behind it, so it can never be
    // corrected. "Studied 0 structures" would be a record of an event that
    // did not happen, kept forever.
    expect(sessionNote([], opts)).toBeNull();
  });

  it('names the FMA ids, which is what makes the note usable a year later', () => {
    const note = sessionNote([a('FMA24474', 'femur', false)], opts)!;
    expect(note).toContain('FMA24474');
    expect(note).toContain('femur');
  });

  it('separates what was missed from what was recalled', () => {
    const note = sessionNote([a('FMA1', 'femur', false), a('FMA2', 'tibia', true)], opts)!;
    expect(note.indexOf('Missed:')).toBeGreaterThan(-1);
    expect(note.indexOf('Recalled:')).toBeGreaterThan(note.indexOf('Missed:'));
    expect(note).toMatch(/1 recalled, 1 missed/);
  });

  it('stands on its own: the date, the body and the dataset are in it', () => {
    const note = sessionNote([a('FMA1', 'femur', true)], opts)!;
    expect(note).toContain('2026-08-29'); // the day T0 actually falls on
    expect(note).toContain('male');
    expect(note).toContain('BodyParts3D');
    expect(note).toContain('Skeleton');
  });

  it('counts the rest instead of listing two hundred rows', () => {
    const many = Array.from({ length: 30 }, (_, i) => a(`FMA${i}`, `bone ${i}`, false));
    const note = sessionNote(many, opts)!;
    expect(note).toContain('and 18 more');
    expect(note).not.toContain('bone 25');
  });

  it('says how often a structure has tripped someone up, when it is more than once', () => {
    const note = sessionNote([a('FMA1', 'femur', false, 4)], opts)!;
    expect(note).toContain('asked 4 times');
    // But not on a first encounter — "asked 1 times" is noise and bad English.
    expect(sessionNote([a('FMA2', 'tibia', false, 1)], opts)!).not.toContain('asked 1');
  });
});

describe('the best streak carried in the store', () => {
  it('is absent, not zero, in a store that predates it', () => {
    // `0` would say someone played and never got two right in a row. Absent
    // says nobody has played yet, which is what the panel renders as a dash.
    expect(parseState({ v: 1, cards: {} }).best).toBeUndefined();
  });

  it('survives a round trip', () => {
    expect(parseState({ v: 1, cards: {}, best: 12 }).best).toBe(12);
  });

  it('drops a nonsense value rather than showing it as a record', () => {
    for (const junk of [-3, NaN, Infinity, 'nine', null]) {
      expect(parseState({ v: 1, cards: {}, best: junk }).best).toBeUndefined();
    }
  });
});
