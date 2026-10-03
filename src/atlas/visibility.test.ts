import {describe, it, expect} from 'vitest';
import {hideSelection, isShown, shownBy, unhide} from './visibility';
import type {SystemId} from './anatomy';

const box: [number[], number[]] = [[0, 0, 0], [0, 0, 0]];
const femur = {id: 'FJ1', system: 'skeletal' as SystemId, name: 'Left femur', bounds: box};
const tibia = {id: 'FJ2', system: 'skeletal' as SystemId, name: 'Left tibia', bounds: box};
const base = {visible: ['skeletal'] as SystemId[], hidden: [] as string[], selected: [] as string[], isolate: false};

describe('isShown', () => {
  it('draws a piece of a visible system', () => {
    expect(isShown(femur, shownBy(base))).toBe(true);
  });

  it('does not draw a hidden piece, but keeps its neighbours', () => {
    const v = shownBy({...base, hidden: ['FJ1']});
    expect(isShown(femur, v)).toBe(false);
    expect(isShown(tibia, v)).toBe(true);
  });

  it('draws a selected piece even when it is hidden — the review asks about it', () => {
    expect(isShown(femur, shownBy({...base, hidden: ['FJ1'], selected: ['FJ1'], isolate: true}))).toBe(true);
    expect(isShown(femur, shownBy({...base, hidden: ['FJ1'], selected: ['FJ1']}))).toBe(true);
  });

  it('isolating draws the selection and nothing else', () => {
    const v = shownBy({...base, selected: ['FJ2'], isolate: true});
    expect(isShown(femur, v)).toBe(false);
    expect(isShown(tibia, v)).toBe(true);
  });

  it('a hidden system hides its pieces whatever the hidden list says', () => {
    expect(isShown(femur, shownBy({...base, visible: []}))).toBe(false);
  });
});

describe('place', () => {
  it('a region keeps only its pieces, and a selected piece outside it still shows', () => {
    const onlyTibia = (p: {id: string}) => p.id === 'FJ2';
    expect(isShown(femur, shownBy(base, onlyTibia))).toBe(false);
    expect(isShown(tibia, shownBy(base, onlyTibia))).toBe(true);
    expect(isShown(femur, shownBy({...base, selected: ['FJ1']}, onlyTibia))).toBe(true);
  });
});

describe('hideSelection', () => {
  it('moves the selection into the hidden list once, and clears it', () => {
    const next = hideSelection({...base, hidden: ['FJ1'], selected: ['FJ1', 'FJ2'], isolate: true});
    expect(next.hidden).toEqual(['FJ1', 'FJ2']);
    expect(next.selected).toEqual([]);
    expect(next.isolate).toBe(false);
    expect(isShown(tibia, shownBy(next))).toBe(false);
  });
});

describe('unhide', () => {
  it('brings back only the chosen pieces', () => {
    expect(unhide(['FJ1', 'FJ2'], ['FJ2'])).toEqual(['FJ1']);
  });
});
