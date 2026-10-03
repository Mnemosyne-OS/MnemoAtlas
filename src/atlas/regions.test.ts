/**
 * Regions and areas, checked on the real male atlas — a box rule is only as
 * good as where the real meshes land. Landmarks ported from upstream
 * human-atlas #1's validation script.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AREAS, REGIONS, areasFor, regionsFor, bodyBounds, partInArea, partRegion, placeFilter} from './regions';
import type {Atlas} from './anatomy';

const atlas = JSON.parse(readFileSync(resolve(__dirname, '../../public/models/atlas.json'), 'utf8')) as Atlas;
const body = bodyBounds(atlas.parts);
const named = new Map(atlas.parts.map(p => [p.name, p]));

describe('partRegion', () => {
  it('puts every mesh in exactly one region, and no region is empty', () => {
    const counts = Object.fromEntries(REGIONS.map(r => [r, 0]));
    for (const p of atlas.parts) counts[partRegion(p, body)]++;
    for (const r of REGIONS) expect(counts[r], r).toBeGreaterThan(0);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(atlas.parts.length);
  });

  it('places the landmarks where an anatomist would', () => {
    const expected: Record<string, string[]> = {
      'head-neck': ['Mandible', 'Frontal bone', 'Atlas', 'Seventh cervical vertebra', 'Hyoid bone'],
      torso: ['Body of sternum', 'First thoracic vertebra', 'Trachea', 'Cavity of left ventricle'],
      abdomen: ['Stomach', 'Spleen', 'Pancreas', 'Left kidney', 'Caudate lobe of liver'],
      arm: ['Left humerus', 'Left radius', 'Left scapula', 'Left clavicle', 'Left hamate', 'Distal phalanx of left index finger', 'Proximal phalanx of left thumb'],
      pelvis: ['Left hip bone', 'Sacrum', 'Urinary bladder', 'Prostate'],
      legs: ['Left femur', 'Left tibia', 'Left patella', 'Left talus', 'Distal phalanx of left big toe'],
    };
    for (const [region, names] of Object.entries(expected)) for (const name of names) {
      const p = named.get(name);
      expect(p, `missing landmark ${name}`).toBeDefined();
      expect(partRegion(p!, body), name).toBe(region);
    }
  });

  it('never leaves a hand in the pelvis or the legs', () => {
    const lost = atlas.parts.filter(p => ['pelvis', 'legs'].includes(partRegion(p, body)) && /finger|thumb|pollicis|of (left|right) hand/i.test(p.name) && !/\btoe\b/i.test(p.name));
    expect(lost.map(p => p.name)).toEqual([]);
  });
});

describe('areas', () => {
  it('every area is a real teaching cluster in the male body', () => {
    for (const a of AREAS) expect(atlas.parts.filter(p => partInArea(p, a.id, body)).length, a.id).toBeGreaterThanOrEqual(8);
  });

  it('the brachial plexus area shows the plexus itself, and its neck side', () => {
    const plexus = atlas.parts.filter(p => partInArea(p, 'brachial-plexus', body)).map(p => p.name);
    expect(plexus).toContain('Brachial plexus (left)');
    expect(plexus.some(n => /scalenus anterior/i.test(n))).toBe(true);
    expect(plexus).not.toContain('Left femur');
  });

  it('a hand piece is always in the arm, a foot piece always in the legs', () => {
    // Without the region guard, « opponens » of the foot and the metacarpal
    // veins slip across: six real meshes, measured.
    const hand = atlas.parts.filter(p => partInArea(p, 'hand', body));
    const foot = atlas.parts.filter(p => partInArea(p, 'foot', body));
    expect(hand.length).toBeGreaterThan(0);
    expect(hand.every(p => partRegion(p, body) === 'arm')).toBe(true);
    expect(foot.every(p => partRegion(p, body) === 'legs')).toBe(true);
    expect(atlas.parts.filter(p => /\bopponens\b/i.test(p.name) && /\bfoot\b/i.test(p.name)).some(p => partInArea(p, 'hand', body))).toBe(false);
  });

  it('the female body is offered only real clusters', () => {
    const female = JSON.parse(readFileSync(resolve(__dirname, '../../public/models/atlas-female.json'), 'utf8')) as Atlas;
    const fb = bodyBounds(female.parts);
    for (const a of areasFor(female.parts, fb, null)) expect(female.parts.filter(p => partInArea(p, a, fb)).length, a).toBeGreaterThanOrEqual(8);
    expect(areasFor(female.parts, fb, null)).not.toContain('brachial-plexus');
  });

  it('only offers areas this body has, inside the chosen region', () => {
    expect(areasFor(atlas.parts, body, 'legs')).toEqual(['popliteal', 'foot']);
    expect(areasFor([], body, null)).toEqual([]);
  });
});

describe('regionsFor', () => {
  it('offers only the regions a body has pieces in', () => {
    expect(regionsFor(atlas.parts, body)).toEqual(REGIONS);
    const noArms = atlas.parts.filter(p => partRegion(p, body) !== 'arm');
    expect(regionsFor(noArms, body)).not.toContain('arm');
  });
});

describe('placeFilter', () => {
  it('an area wins over its region', () => {
    const scalene = atlas.parts.find(p => /scalenus anterior/i.test(p.name))!;
    expect(placeFilter({region: 'arm', area: 'brachial-plexus'}, body)!(scalene)).toBe(true);
    expect(placeFilter({region: null, area: null}, body)).toBeUndefined();
  });
});
