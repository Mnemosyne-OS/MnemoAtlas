/**
 * The level grid is the first thing anyone sees, and every number on it is a
 * claim about their own progress. These tests pin the claims that would be
 * wrong without ever turning the screen red.
 */
import { describe, it, expect } from 'vitest';
import { askablePool, canStudy, levelProgress, levelsOf, ALL_LEVEL, MIN_FOR_QUIZ } from './levels';
import { TOP_BOX, dayOf, emptyState, type ReviewState } from './review';
import type { Atlas, Part } from '../atlas/anatomy';

const DAY = 86_400_000;
const T0 = 20_694 * DAY;

const part = (id: string, system: Part['system'], conceptId: string): Part => ({
  id, name: id, conceptId, system, chunk: 0, positions: 0, normals: 0, indices: 0,
  vertexCount: 3, indexCount: 3, bounds: [[0, 0, 0], [1, 1, 1]],
});

/** Five bones (one concept covering two meshes), two arteries, one lone gland. */
const atlas = {
  version: 'test', triangles: 0, chunks: [],
  parts: [
    part('m1', 'skeletal', 'C_FEMUR'), part('m2', 'skeletal', 'C_FEMUR'),
    part('m3', 'skeletal', 'C_TIBIA'), part('m4', 'skeletal', 'C_FIBULA'),
    part('m5', 'skeletal', 'C_PATELLA'),
    part('m6', 'arterial', 'C_AORTA'), part('m7', 'arterial', 'C_RENAL'),
    part('m8', 'endocrine', 'C_THYROID'),
  ],
  concepts: [
    { id: 'C_FEMUR', name: 'femur', elements: ['m1', 'm2'] },
    { id: 'C_TIBIA', name: 'tibia', elements: ['m3'] },
    { id: 'C_FIBULA', name: 'fibula', elements: ['m4'] },
    { id: 'C_PATELLA', name: 'patella', elements: ['m5'] },
    { id: 'C_AORTA', name: 'aorta', elements: ['m6'] },
    { id: 'C_RENAL', name: 'renal artery', elements: ['m7'] },
    { id: 'C_THYROID', name: 'thyroid gland', elements: ['m8'] },
  ],
} as unknown as Atlas;

describe('the pool a level draws from', () => {
  it('counts concepts, not meshes, so one structure is one thing to learn', () => {
    // Five skeletal MESHES, but the femur is one concept across two of them.
    expect(atlas.parts.filter((p) => p.system === 'skeletal')).toHaveLength(5);
    expect(askablePool(atlas, ['skeletal'])).toHaveLength(4);
  });

  it('leaves out systems that were not asked for', () => {
    expect(askablePool(atlas, ['arterial']).map((a) => a.name)).toEqual(['aorta', 'renal artery']);
  });
});

describe('the tiles', () => {
  it('offers the whole body first, then the biggest systems', () => {
    const ls = levelsOf(atlas);
    expect(ls[0]!.id).toBe(ALL_LEVEL);
    // Its name is empty on purpose: the panel names it in the reader's language.
    expect(ls[0]!.name).toBe('');
    expect(ls.slice(1).map((l) => l.id)).toEqual(['skeletal', 'arterial', 'endocrine']);
  });

  it('never shows a system this body does not have', () => {
    // The fixture has no muscles at all. A hand-written tile list would show
    // a Muscles tile reading 0, on a body that simply has none.
    expect(levelsOf(atlas).map((l) => l.id)).not.toContain('muscular');
  });

  it('puts on the tile the same total the quiz will draw from', () => {
    const skeletal = levelsOf(atlas).find((l) => l.id === 'skeletal')!;
    expect(skeletal.total).toBe(askablePool(atlas, ['skeletal']).length);
  });
});

describe('whether a level can be studied', () => {
  it('refuses a level too small for four honest options', () => {
    const endocrine = levelsOf(atlas).find((l) => l.id === 'endocrine')!;
    expect(endocrine.total).toBeLessThan(MIN_FOR_QUIZ);
    const v = canStudy(endocrine);
    expect(v.ok).toBe(false);
    // A code, not a sentence — and it still carries the count, which is what
    // makes the message say something rather than just going grey.
    expect(v.why).toBe('tooSmall');
    expect(v.n).toBe(1);
  });

  it('allows a level that exactly reaches the floor', () => {
    const skeletal = levelsOf(atlas).find((l) => l.id === 'skeletal')!;
    expect(skeletal.total).toBe(MIN_FOR_QUIZ);
    expect(canStudy(skeletal).ok).toBe(true);
  });
});

describe('progress on a tile', () => {
  it('counts only cards inside that level', () => {
    const state: ReviewState = {
      v: 1,
      cards: {
        C_FEMUR: { b: TOP_BOX, d: dayOf(T0) + 35, n: 6 },
        C_AORTA: { b: 1, d: dayOf(T0) - 2, n: 2 },
      },
    };
    const ls = levelsOf(atlas);
    const skeletal = levelProgress(ls.find((l) => l.id === 'skeletal')!, atlas, state, T0);
    expect(skeletal).toMatchObject({ studied: 1, mastered: 1, due: 0 });
    const arterial = levelProgress(ls.find((l) => l.id === 'arterial')!, atlas, state, T0);
    // The aorta is overdue; the femur is not, and belongs to another tile.
    expect(arterial).toMatchObject({ studied: 1, mastered: 0, due: 1 });
  });

  it('reports an untouched level as nothing studied, and a ratio of zero', () => {
    const l = levelsOf(atlas).find((l) => l.id === 'skeletal')!;
    expect(levelProgress(l, atlas, emptyState(), T0)).toEqual({ studied: 0, mastered: 0, due: 0, ratio: 0 });
  });

  it('measures mastery against the level, not against what has been studied', () => {
    // One of four mastered is a quarter of the level. Reporting it against
    // "cards you have opened" would say 100%, which is the number someone
    // would screenshot and believe.
    const state: ReviewState = { v: 1, cards: { C_FEMUR: { b: TOP_BOX, d: 0, n: 6 } } };
    const l = levelsOf(atlas).find((l) => l.id === 'skeletal')!;
    expect(levelProgress(l, atlas, state, T0).ratio).toBeCloseTo(0.25);
  });

  it('ignores cards for structures that are not in this atlas at all', () => {
    // Switching from the male body to the female one leaves cards behind for
    // structures the new atlas has never heard of. They must not inflate it.
    const state: ReviewState = { v: 1, cards: { FMA_NOT_HERE: { b: TOP_BOX, d: 0, n: 9 } } };
    const l = levelsOf(atlas).find((l) => l.id === ALL_LEVEL)!;
    expect(levelProgress(l, atlas, state, T0).studied).toBe(0);
  });
});
