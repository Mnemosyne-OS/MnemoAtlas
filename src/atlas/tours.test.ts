/** Guided visits, checked on both real bodies. */
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {TOURS, stepSelection, tourFrame, tourSteps, toursFor} from './tours';
import type {Atlas} from './anatomy';

const load = (f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/models', f), 'utf8')) as Atlas;
const male = load('atlas.json'), female = load('atlas-female.json');
const names = (a: Atlas, id: string) => tourSteps(a, TOURS.find(t => t.id === id)!).map(c => c.name);

describe('tourSteps', () => {
  it('walks blood through the male heart in order', () => {
    expect(names(male, 'heart')).toEqual(['right atrium', 'tricuspid valve', 'right ventricle', 'pulmonary valve', 'left atrium', 'mitral valve', 'left ventricle', 'aortic valve', 'heart']);
  });

  it('walks the male reproductive tract, not the female one', () => {
    expect(names(male, 'reproductive')).toEqual(['right testis', 'epididymis', 'deferent duct', 'seminal vesicle', 'prostate', 'corpus cavernosum of penis']);
  });

  it('serves the female body from the same tour, skipping what it does not have', () => {
    expect(names(female, 'reproductive')).toEqual(['ovary', 'fallopian tube', 'uterus', 'vagina']);
    expect(names(female, 'heart')).toEqual(['right cardiac atrium', 'tricuspid valve', 'heart right ventricle', 'pulmonary valve', 'left cardiac atrium', 'mitral valve', 'heart left ventricle', 'aortic valve', 'heart']);
  });
});

describe('nerves and fascial lines', () => {
  const steps = (a: Atlas, id: string) => tourSteps(a, TOURS.find(t => t.id === id)!);
  const systemOf = new Map(male.parts.map(p => [p.id, p.system]));

  it('walks the trigeminal nerve trunk, then V1, V2, V3, then all three together', () => {
    const s = steps(male, 'trigeminal');
    expect(s.map(c => c.id)).toEqual(['ZNTRIGEMIN-LC', 'ZNOPHTHALM-LC', 'ZNMAXILLAR-LC', 'ZNMANDIBUL-LC', 'station.trigeminal.all']);
    expect(s[4].elements).toHaveLength(4);
  });

  it('a station lights every structure it names, on both sides', () => {
    const hamstrings = steps(male, 'lineBack').find(c => c.id === 'station.lineBack.hamstrings')!;
    const names = male.parts.filter(p => hamstrings.elements.includes(p.id)).map(p => p.name);
    for (const n of ['Right semitendinosus', 'Left semitendinosus', 'Right semimembranosus', 'Left semimembranosus']) expect(names).toContain(n);
  });

  it('a line ends on a stop that lights all of it, and every station is muscle or fascia', () => {
    for (const id of ['lineBack', 'lineFront', 'lineLateral', 'lineDeep']) {
      const s = steps(male, id);
      const last = s[s.length - 1];
      expect(last.id).toBe(`station.${id}.all`);
      expect(new Set(last.elements)).toEqual(new Set(s.slice(0, -1).flatMap(c => c.elements)));
      for (const c of s) expect(c.elements.every(e => ['muscular', 'connective'].includes(systemOf.get(e)!)), `${c.id}`).toBe(true);
    }
  });

  it('the female reference has none of these structures, so it is offered none of these visits', () => {
    const ids = toursFor(female).map(t => t.tour.id);
    for (const id of ['trigeminal', 'lineBack', 'lineFront', 'lineLateral', 'lineDeep']) expect(ids).not.toContain(id);
  });
});

describe('toursFor', () => {
  it('offers every tour in the male body', () => {
    expect(toursFor(male).map(t => t.tour.id)).toEqual(TOURS.map(t => t.id));
  });

  it('never offers a one-stop visit', () => {
    for (const {steps} of toursFor(female)) expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(toursFor({...male, concepts: male.concepts.filter(c => c.name !== 'ureter' && c.name !== 'urinary bladder' && c.name !== 'urethra')}).map(t => t.tour.id)).not.toContain('urinary');
  });
});

describe('tourFrame', () => {
  it('frames the organ, never a brain ventricle filed as cardiac', () => {
    const tour = TOURS.find(t => t.id === 'heart')!;
    const frame = tourFrame(tourSteps(male, tour), male, tour.systems);
    const ys = male.parts.filter(p => frame.includes(p.id)).map(p => (p.bounds[0][1] + p.bounds[1][1]) / 2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.25);
    // The frame is the stops' selection, never the raw concepts (« heart » owns
    // muscle and vessel meshes that would widen the frame).
    expect(frame.every(id => male.parts.find(p => p.id === id)!.system === 'cardiac')).toBe(true);
  });

  it('a station keeps what the body has and is skipped when it has nothing', () => {
    const tour = {id: 'lineBack' as const, group: 'line' as const, systems: ['muscular' as const], steps: [
      {station: 'half', all: ['FMA22357', 'NOPE1']}, {station: 'none', all: ['NOPE2', 'NOPE3']}, ['FMA22438']]};
    const s = tourSteps(male, tour);
    expect(s.map(c => c.id)).toEqual(['station.lineBack.half', 'FMA22438']);
    expect(s[0].elements).toEqual(male.concepts.find(c => c.id === 'FMA22357')!.elements);
  });
});

describe('stepSelection', () => {
  it('keeps a stop inside the tour systems', () => {
    const heart = male.concepts.find(c => c.id === 'FMA7088')!;
    const systemOf = new Map(male.parts.map(p => [p.id, p.system]));
    const picked = stepSelection(heart, male, ['cardiac']);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every(id => systemOf.get(id) === 'cardiac')).toBe(true);
    expect(picked.length).toBeLessThan(heart.elements.length);
  });
});
