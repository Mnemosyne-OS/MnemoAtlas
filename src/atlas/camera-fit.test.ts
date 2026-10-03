import {describe, it, expect} from 'vitest';
import {fitTarget, withExplode} from './camera-fit';
import type {View} from './anatomy';

describe('fitTarget', () => {
  it('keeps the two resting positions it always had', () => {
    expect(fitTarget(0, false, 2)).toEqual({x: -0, y: 0.68});
    const flat = fitTarget(1, false, 2);
    expect(flat.x).toBeCloseTo(-0.24);
    expect(flat.y).toBeCloseTo(0.85);
    expect(fitTarget(0.5, true, 2)).toEqual({x: 0, y: 0.85});
  });

  it('never jumps between two neighbouring amounts (the 37% jump)', () => {
    for (let e = 0; e < 1; e += 0.001) {
      const a = fitTarget(e, false, 3), b = fitTarget(e + 0.001, false, 3);
      expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
      expect(Math.abs(a.y - b.y)).toBeLessThan(0.01);
    }
  });
});

const at = (explode: number, view: View, viewBeforeExplode?: View) => ({explode, view, viewBeforeExplode, rotate: false});

describe('withExplode', () => {
  it('going flat forces the front view and remembers the old one', () => {
    const next = withExplode(at(0.5, 'side'), 0.9);
    expect(next.view).toBe('front');
    expect(next.viewBeforeExplode).toBe('side');
  });

  it('coming back restores the remembered view and forgets it', () => {
    const next = withExplode(at(0.9, 'front', 'side'), 0.6);
    expect(next.view).toBe('side');
    expect(next.viewBeforeExplode).toBeUndefined();
  });

  it('moving while flat keeps the memory', () => {
    const next = withExplode(at(0.9, 'front', 'back'), 1);
    expect(next.view).toBe('front');
    expect(next.viewBeforeExplode).toBe('back');
  });

  it('moving below flat leaves the view alone', () => {
    expect(withExplode(at(0.2, 'side'), 0.6).view).toBe('side');
  });

  it('coming back with nothing remembered stays in front', () => {
    expect(withExplode(at(1, 'front'), 0).view).toBe('front');
  });

  it('keeps every other field', () => {
    expect(withExplode({...at(0.2, 'side'), rotate: true}, 0.3).rotate).toBe(true);
  });
});
