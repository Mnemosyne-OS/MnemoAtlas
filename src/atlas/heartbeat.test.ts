/** The schematic heartbeat, checked on both real bodies and along one cycle. */
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ATRIAL_FILLING, ATRIAL_SYSTOLE, BEATS_PER_MINUTE, CONTRACTION, VENTRICULAR_SYSTOLE, beatPhase, beatScale, heartRole, type HeartRole} from './heartbeat';
import type {Atlas} from './anatomy';

const load = (f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/models', f), 'utf8')) as Atlas;
const male = load('atlas.json'), female = load('atlas-female.json');
const beating = (a: Atlas) => a.parts.filter(p => heartRole(p)).map(p => `${p.name} → ${heartRole(p)!.chamber}:${heartRole(p)!.tissue}`).sort();

describe('heartRole: which meshes beat', () => {
  it('in the male body: the four cavities and the three walls, never a cusp or a leaflet', () => {
    expect(beating(male)).toEqual([
      'Cavity of left atrium → atrium:cavity',
      'Cavity of left ventricle → ventricle:cavity',
      'Cavity of right atrium → atrium:cavity',
      'Cavity of right ventricle → ventricle:cavity',
      'Wall of left atrium → atrium:wall',
      'Wall of right atrium → atrium:wall',
      'Wall of ventricle → ventricle:wall',
    ]);
  });

  it('in the female body: the chambers, the septum and the papillary muscles, never a valve or a vessel', () => {
    expect(beating(female)).toEqual([
      'Anterior papillary muscle of left ventricle → ventricle:wall',
      'Anterolateral head of lateral papillary muscle of left ventricle → ventricle:wall',
      'Posterior papillary muscle of right ventricle → ventricle:wall',
      'Posteromedial head of posterior papillary muscle of left ventricle → ventricle:wall',
      'Septal papillary muscle of right ventricle → ventricle:wall',
      'heart left ventricle → ventricle:wall',
      'heart right ventricle → ventricle:wall',
      'interventricular septum → ventricle:wall',
      'left cardiac atrium → atrium:wall',
      'right cardiac atrium → atrium:wall',
    ]);
  });

  it('a coronary named after a ventricle is a vessel, and holds still', () => {
    // The one female cardiac mesh a bare « ventric » match would have set pumping.
    expect(heartRole({name: 'Posterior ventricular branch of circumflex coronary artery', system: 'cardiac'})).toBeNull();
    expect(heartRole({name: 'descending aorta', system: 'cardiac'})).toBeNull();
  });

  it('a ventricle outside the cardiac system is not a heart', () => {
    // The brain has four; the male papillary muscles are filed under muscles and are left out on purpose.
    expect(heartRole({name: 'Fourth ventricle', system: 'nervous'})).toBeNull();
    expect(heartRole({name: 'Anterior papillary muscle of right ventricle', system: 'muscular'})).toBeNull();
    expect(male.parts.filter(p => p.system !== 'cardiac').filter(p => heartRole(p))).toEqual([]);
  });
});

describe('beatPhase', () => {
  it('runs one cycle per beat at 72 per minute', () => {
    const period = 60 / BEATS_PER_MINUTE;
    expect(beatPhase(0)).toBe(0);
    expect(beatPhase(period / 2)).toBeCloseTo(0.5, 9);
    expect(beatPhase(period)).toBeCloseTo(0, 9);
    expect(beatPhase(period * 3.25)).toBeCloseTo(0.25, 9);
  });

  it('a rate of 0 or less, or no number at all, is no beat: phase 0, every chamber at rest', () => {
    for (const bpm of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(beatPhase(10, bpm)).toBe(0);
    expect(beatPhase(Number.NaN)).toBe(0);
    for (const role of ROLES) expect(beatScale(role, 0)).toBe(1);
  });
});

const ROLES: HeartRole[] = [
  {chamber: 'atrium', tissue: 'wall'}, {chamber: 'atrium', tissue: 'cavity'},
  {chamber: 'ventricle', tissue: 'wall'}, {chamber: 'ventricle', tissue: 'cavity'},
];
const samples = Array.from({length: 1000}, (_, i) => i / 1000);
const argmin = (role: HeartRole) => samples.reduce((best, p) => beatScale(role, p) < beatScale(role, best) ? p : best, 0);

describe('beatScale along one cycle', () => {
  it('the atria contract first, then the ventricles', () => {
    const atrium = argmin({chamber: 'atrium', tissue: 'wall'}), ventricle = argmin({chamber: 'ventricle', tissue: 'wall'});
    expect(atrium).toBeCloseTo(ATRIAL_SYSTOLE.peak, 2);
    expect(ventricle).toBeCloseTo(VENTRICULAR_SYSTOLE.peak, 2);
    expect(atrium).toBeLessThan(ventricle);
  });

  it('at the peak each chamber is shrunk by its own amount, the cavity more than the wall', () => {
    for (const role of ROLES) {
      const peak = role.chamber === 'atrium' ? ATRIAL_SYSTOLE.peak : VENTRICULAR_SYSTOLE.peak;
      expect(beatScale(role, peak)).toBeCloseTo(1 - CONTRACTION[role.chamber][role.tissue], 6);
    }
    expect(CONTRACTION.atrium.cavity).toBeGreaterThan(CONTRACTION.atrium.wall);
    expect(CONTRACTION.ventricle.cavity).toBeGreaterThan(CONTRACTION.ventricle.wall);
  });

  it('the atria fill while the ventricles squeeze, and never beyond their small swell', () => {
    const atriumAt = (p: number) => beatScale({chamber: 'atrium', tissue: 'wall'}, p);
    expect(atriumAt(VENTRICULAR_SYSTOLE.peak)).toBeGreaterThan(1);
    expect(Math.max(...samples.map(atriumAt))).toBeCloseTo(1 + ATRIAL_FILLING, 6);
    // A ventricle never grows past its resting size.
    expect(Math.max(...samples.map(p => beatScale({chamber: 'ventricle', tissue: 'cavity'}, p)))).toBe(1);
  });

  it('the end of the cycle is rest: every chamber back at exactly 1', () => {
    for (const role of ROLES) for (const p of [0.75, 0.85, 0.999]) expect(beatScale(role, p)).toBe(1);
  });

  it('is continuous: no step larger than 1% between two neighbouring samples', () => {
    for (const role of ROLES) {
      for (let i = 1; i < samples.length; i++) expect(Math.abs(beatScale(role, samples[i]!) - beatScale(role, samples[i - 1]!))).toBeLessThan(0.01);
      // And across the wrap: the last sample meets the first.
      expect(Math.abs(beatScale(role, 0.999) - beatScale(role, 0))).toBeLessThan(0.01);
    }
  });
});
