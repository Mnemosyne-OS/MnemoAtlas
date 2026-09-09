import { describe, it, expect } from 'vitest';
import { duration, endRun, isComplete, LENGTHS, lengthLabel, rankOf, record, runStats, startRun } from './session';
import type { Answered } from './review';

const T0 = 20_694 * 86_400_000;
const a = (correct: boolean, i = 0): Answered =>
  ({ id: `FMA${i}`, name: `s${i}`, system: 'skeletal', correct, n: 1 });

const play = (results: boolean[], length: (typeof LENGTHS)[number] = 10) =>
  results.reduce((run, ok, i) => record(run, a(ok, i)), startRun(length, T0));

describe('the streak', () => {
  it('counts consecutive right answers', () => {
    expect(play([true, true, true]).streak).toBe(3);
  });

  it('is cut by a miss, not decremented', () => {
    // A streak that survived a wrong answer would be a lie about the run —
    // the whole point of the number is that it is unbroken.
    expect(play([true, true, false]).streak).toBe(0);
  });

  it('remembers the best run even after it is broken', () => {
    const run = play([true, true, true, false, true]);
    expect(run.streak).toBe(1);
    expect(run.bestStreak).toBe(3);
  });

  it('starts at zero and stays there through a wrong first answer', () => {
    expect(play([false]).bestStreak).toBe(0);
  });
});

describe('when a run is finished', () => {
  it('ends at the length it committed to', () => {
    expect(isComplete(play([true, true, true, true], 5))).toBe(false);
    expect(isComplete(play([true, true, true, true, true], 5))).toBe(true);
  });

  it('never ends on its own when it is endless', () => {
    const run = play(Array(200).fill(true), null);
    expect(isComplete(run)).toBe(false);
  });

  it('ends an endless run when the human says stop, without inventing a length', () => {
    const run = endRun(play([true, true, true], null));
    expect(isComplete(run)).toBe(true);
    // The length stays null: they never committed to three, they chose to stop
    // at three, and the results screen must not claim otherwise.
    expect(run.length).toBeNull();
    expect(run.answers).toHaveLength(3);
  });
});

describe('what the results screen is allowed to say', () => {
  it('has no accuracy at all before anything was asked', () => {
    // Zero would read as "you got everything wrong". Nothing was asked.
    const s = runStats(startRun(10, T0), T0);
    expect(s.accuracy).toBeNull();
    expect(s.asked).toBe(0);
  });

  it('reports accuracy as right over asked', () => {
    const s = runStats(play([true, false, true, true]), T0);
    expect(s.right).toBe(3);
    expect(s.accuracy).toBeCloseTo(0.75);
  });

  it('hands back exactly the ones that were missed', () => {
    const s = runStats(play([true, false, false]), T0);
    expect(s.missed.map((m) => m.id)).toEqual(['FMA1', 'FMA2']);
  });

  it('never reports negative time when the clock moves backwards', () => {
    // Clocks do go backwards: NTP, a laptop waking up, a manual change.
    // A negative duration is a value nobody measured.
    expect(runStats(startRun(10, T0), T0 - 60_000).elapsedMs).toBe(0);
  });
});

describe('the rank', () => {
  it('is a name for the accuracy and nothing else', () => {
    expect(rankOf(1)).toBe('Perfect');
    expect(rankOf(0.9)).toBe('Excellent');
    expect(rankOf(0.75)).toBe('Solid');
    expect(rankOf(0.5)).toBe('Getting there');
    expect(rankOf(0.2)).toBe('Worth another pass');
  });

  it('refuses to judge a run that never happened', () => {
    expect(rankOf(null)).toBeNull();
  });

  it('does not call 99% perfect', () => {
    // The one boundary that matters: "Perfect" has to mean it.
    expect(rankOf(0.99)).not.toBe('Perfect');
  });
});

describe('small things that show on screen', () => {
  it('writes a duration in minutes and seconds', () => {
    expect(duration(0)).toBe('0:00');
    expect(duration(65_000)).toBe('1:05');
    expect(duration(600_000)).toBe('10:00');
  });

  it('leaves the endless run for the panel to name, in the reader own language', () => {
    expect(lengthLabel(null)).toBeNull();
    expect(lengthLabel(50)).toBe('50');
  });
});
