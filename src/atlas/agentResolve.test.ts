import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ATLAS_WRITES, REVIEW_ACTIONS, quizRefusal, resolveStructure, ROTATE_SPEEDS, autoRotating, turnOnShow} from './agentResolve';
import type {Concept} from './anatomy';

const c = (id: string, name: string): Concept => ({id, name, elements: [id]});
const concepts = [
  c('FMA7088', 'heart'),
  c('FMA7101', 'heart left ventricle'),
  c('FMA7309', 'right lung'),
  c('FMA7310', 'left lung'),
  c('FMA7197', 'liver'),
];
const fr: Record<string, string> = {FMA7088: 'cœur', FMA7197: 'foie'};
const label = (x: Concept) => fr[x.id] ?? x.name;

describe('resolveStructure', () => {
  it('takes an exact atlas id first', () => {
    expect(resolveStructure(concepts, 'FMA7310')).toEqual({kind: 'found', concept: concepts[3]});
  });

  it('takes the exact name over the longer names that contain it', () => {
    const r = resolveStructure(concepts, 'Heart');
    expect(r.kind === 'found' && r.concept.id).toBe('FMA7088');
  });

  it('finds the reader\'s language, typed without the ligature', () => {
    const r = resolveStructure(concepts, 'coeur', label);
    expect(r.kind === 'found' && r.concept.id).toBe('FMA7088');
  });

  it('takes the one name that starts with the word asked (« coeur » for « cœur humain »), never two', () => {
    const veins = [c('FMA7088', 'heart'), c('FMA7165', 'right side of heart'), c('FMA4707', 'great cardiac vein'), c('FMA7309', 'right lung'), c('FMA7310', 'left lung')];
    const frLong: Record<string, string> = {FMA7088: 'cœur humain', FMA7165: 'cœur droit', FMA4707: 'grande veine du cœur', FMA7309: 'poumon droit', FMA7310: 'poumon gauche'};
    const lbl = (x: Concept) => frLong[x.id] ?? x.name;
    const r = resolveStructure(veins, 'coeur', lbl);
    expect(r.kind === 'found' && r.concept.id).toBe('FMA7088');
    expect(resolveStructure(veins, 'poumon', lbl).kind).toBe('ambiguous');
  });

  it('takes the one name that starts with the words even when the search finds more, and its English name is two words', () => {
    const lungs = [c('FMA7309', 'right lung'), c('FMA7333', 'lobe of lung')];
    const frLungs: Record<string, string> = {FMA7309: 'poumon droit', FMA7333: 'lobe du poumon'};
    const r = resolveStructure(lungs, 'poumon', (x: Concept) => frLungs[x.id] ?? x.name);
    expect(r.kind === 'found' && r.concept.id).toBe('FMA7309');
  });

  it('takes a single search hit', () => {
    const r = resolveStructure(concepts, 'live');
    expect(r.kind === 'found' && r.concept.id).toBe('FMA7197');
  });

  it('calls several hits ambiguous and returns them', () => {
    const r = resolveStructure(concepts, 'lung');
    expect(r.kind).toBe('ambiguous');
    expect(r.kind === 'ambiguous' && r.candidates.map(x => x.id).sort()).toEqual(['FMA7309', 'FMA7310']);
  });

  it('names the closest structures, word by word, when the phrase finds nothing', () => {
    const r = resolveStructure(concepts, 'show me the liver please');
    expect(r.kind).toBe('none');
    expect(r.kind === 'none' && r.near.map(x => x.id)).toEqual(['FMA7197']);
  });

  it('offers nothing for an empty request or a structure the atlas lacks', () => {
    expect(resolveStructure(concepts, '  ')).toEqual({kind: 'none', near: []});
    expect(resolveStructure(concepts, 'spleen')).toEqual({kind: 'none', near: []});
  });
});

describe('quizRefusal: during a review the view belongs to the person', () => {
  const root = join(__dirname, '..', '..');
  const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as {agentActions: {id: string; effect: string}[]};
  const allWrites = manifest.agentActions.filter(a => a.effect === 'write').map(a => a.id);
  // The review's own gestures are writes the review lets through: they ARE the review.
  const writes = allWrites.filter(id => !REVIEW_ACTIONS.includes(id));
  const reads = manifest.agentActions.filter(a => a.effect !== 'write').map(a => a.id);
  const source = readFileSync(join(root, 'src', 'atlas', 'AtlasAgentActions.tsx'), 'utf8');

  it("knows the same writes the manifest declares, the review's own apart", () => {
    expect([...ATLAS_WRITES, ...REVIEW_ACTIONS].sort()).toEqual([...allWrites].sort());
    expect(ATLAS_WRITES.filter(id => REVIEW_ACTIONS.includes(id))).toEqual([]);
  });

  it("lets the review's own gestures through a running review, and none of them takes the view lock", () => {
    for (const id of REVIEW_ACTIONS) {
      expect(quizRefusal(id, true)).toBeNull();
      const start = source.indexOf(`\n      ${id}: (`);
      expect(start, id).toBeGreaterThan(0);
      expect(source.slice(start, source.indexOf('\n      },', start)), id).not.toContain('writable(');
    }
  });

  it('refuses every write while a review question is on screen, and lets reads answer', () => {
    for (const id of writes) expect(quizRefusal(id, true)).toMatch(/^QUIZ_RUNNING/);
    for (const id of reads) expect(quizRefusal(id, true)).toBeNull();
    for (const id of writes) expect(quizRefusal(id, false)).toBeNull();
  });

  it('every write handler goes through the refusal under its own name', () => {
    for (const id of writes) {
      const start = source.indexOf(`\n      ${id}: (`);
      expect(start, id).toBeGreaterThan(0);
      const body = source.slice(start, source.indexOf('\n      },', start));
      expect(body, id).toContain(`writable('${id}')`);
    }
    // a text check (no mounted body here): writable throws, to the person, when quizRefusal refuses
    expect(source).toMatch(/const writable = \(action: string\)[^]*?const refused = quizRefusal\(action, locked\(\)\);\s*if \(refused\) throw toPerson\(say\('voice\.running'\)\);/);
  });
});

describe('the camera turning by itself (2026-10-12)', () => {
  it('turns an isolated structure too, and never a body coming apart', () => {
    expect(autoRotating({rotate: true, explode: 0})).toBe(true);
    expect(autoRotating({rotate: true, explode: 0.39})).toBe(true);
    expect(autoRotating({rotate: true, explode: 0.4})).toBe(false);
    expect(autoRotating({rotate: false, explode: 0})).toBe(false);
  });

  it('the scene asks the shared rule, at the pace asked, and the person taking the camera stops it', () => {
    const scene = readFileSync(join(__dirname, 'scene.tsx'), 'utf8');
    expect(scene).toContain('controls.autoRotate=autoRotating({rotate:s.rotate,explode:amount});');
    expect(scene).toContain('controls.autoRotateSpeed=getRotateSpeed()*(s.rotatePace??1);controls.update(dt);');
    expect(scene).toContain("controls.addEventListener('start',()=>{if(controls.autoRotate)rotateStop.current?.();});");
    expect(Object.keys(ROTATE_SPEEDS)).toEqual(['slow', 'normal', 'fast']);
    // paces are multiples of the person's speed: « normal » is exactly what the button turns at
    expect(ROTATE_SPEEDS).toEqual({slow: 0.5, normal: 1, fast: 2});
  });
});

describe('showing systems turns the body (2026-10-13)', () => {
  it("starts the turn at the person's own speed, and leaves a body coming apart as it was", () => {
    expect(turnOnShow({rotate: false, explode: 0})).toEqual({rotate: true, rotatePace: undefined});
    // an agent's « fast » gives way to the person's speed once the person shows a system
    expect(turnOnShow({rotate: true, explode: 0, rotatePace: 2})).toEqual({rotate: true, rotatePace: undefined});
    expect(turnOnShow({rotate: false, explode: 0.4})).toEqual({rotate: false, rotatePace: undefined});
    expect(turnOnShow({rotate: true, explode: 0.6, rotatePace: 2})).toEqual({rotate: true, rotatePace: 2});
  });

  it('a switch turned on, a preset and « All » start it; a switch turned off and « Hide all » do not', () => {
    const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    const line = (start: string) => page.slice(page.indexOf(start), page.indexOf('\n', page.indexOf(start)));
    const toggle = line(' const toggle=');
    const showOnly = line(' const showOnly=');
    // hiding branch first, without the turn; showing branch with it
    expect(toggle).toMatch(/s\.visible\.includes\(id\)\?\{\.\.\.s,selected:\[\],isolate:false,visible:s\.visible\.filter\(x=>x!==id\)\}:\{\.\.\.s,\.\.\.turnOnShow\(s\),/);
    expect(showOnly).toContain('...(ids.length?turnOnShow(s):{})');
    expect(page).toContain("onClick={()=>setState(s=>({...s,visible:[],selected:[],isolate:false}))}");
  });
});
