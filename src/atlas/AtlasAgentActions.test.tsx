/**
 * The Atlas driven by voice (doc 149): the agent actions mounted with the REAL
 * review panel, the way the page mounts them, so a review run from the orb is
 * the run on screen — its question isolated, its schedule written, its lock.
 *
 * The names are French (the person says « c'est le foie »), loaded the way
 * the app loads them; the store answers like an empty host mirror.
 */
import {act, render, waitFor} from '@testing-library/react';
import {useState} from 'react';
import type {Atlas, Concept, Part, SceneState, SystemId} from './anatomy';
import {translate, type Key} from '@/i18n/strings';
import {ReviewPanel} from '@/mnemo/ReviewPanel';
import {reviewDoor} from '@/mnemo/reviewDoor';
import {setStoreInvoker} from '@/mnemo/cartridgeStore';
import type {Tour, TourId} from './tours';

type Handlers = Record<string, (args: Record<string, unknown>) => unknown>;
const door = vi.hoisted(() => ({handlers: null as Handlers | null}));

vi.mock('@mnemosyne_os/cartridge-sdk', async (orig) => {
  const real = await orig<typeof import('@mnemosyne_os/cartridge-sdk')>();
  class FakeSDK {
    onAgentActions(h: Handlers) { door.handlers = h; return {ready: Promise.resolve(), off: () => {}}; }
    invoke() { return Promise.reject(new Error('No Mnemosyne host')); }
  }
  return {...real, MnemoCartridgeSDK: FakeSDK};
});

import {AtlasAgentActions} from './AtlasAgentActions';

// ── a small body: four digestive structures (four options, all of them on screen), four bones, a heart ──
const part = (id: string, name: string, system: SystemId, y: number): Part =>
  ({id, name, conceptId: id, system, chunk: 0, positions: 0, normals: 0, indices: 0, vertexCount: 0, indexCount: 0, bounds: [[0, y, 0], [1, y + 1, 1]]});
const PARTS: Part[] = [
  part('FMA7197', 'liver', 'digestive', 62), part('FMA7148', 'stomach', 'digestive', 63),
  part('FMA1001', 'right lobe of liver', 'digestive', 61), part('FMA1002', 'left lobe of liver', 'digestive', 61.5),
  part('FMA9611', 'femur', 'skeletal', 0), part('FMA16580', 'tibia', 'skeletal', 10),
  part('FMA13303', 'humerus', 'skeletal', 75), part('FMA46565', 'skull', 'skeletal', 99),
  part('FMA7088', 'heart', 'cardiac', 74),
  // The chamber the heartbeat moves: the 'heart' above is a name the beat does not read.
  part('FMA7101', 'left ventricle', 'cardiac', 74.2),
];
const concept = (p: Part): Concept => ({id: p.id, name: p.name, elements: [p.id]});
const ATLAS: Atlas = {version: 't', parts: PARTS, concepts: PARTS.map(concept), chunks: [], triangles: 0};
const FR: Record<string, string> = {
  FMA7197: 'Foie', FMA7148: 'Estomac', FMA1001: 'Lobe droit du foie', FMA1002: 'Lobe gauche du foie',
  FMA9611: 'Fémur', FMA16580: 'Tibia', FMA13303: 'Humérus', FMA46565: 'Crâne', FMA7088: 'Cœur', FMA7101: 'Ventricule gauche',
};
const t = (key: Key, vars?: Record<string, string | number>) => translate('fr', key, vars);
const label = (id: string, english: string) => FR[id] ?? english;
const TOURS = [
  {tour: {id: 'lineLateral', group: 'line', systems: ['muscular'], steps: []} as Tour, steps: [concept(PARTS[4]!), concept(PARTS[5]!)]},
  {tour: {id: 'lineFront', group: 'line', systems: ['muscular'], steps: []} as Tour, steps: [concept(PARTS[6]!), concept(PARTS[7]!)]},
];
const INITIAL: SceneState = {explode: 0, visible: ['skeletal', 'digestive'], hidden: [], selected: [], isolate: false, region: null, area: null, view: 'three-quarter', rotate: false, beat: false, reset: 0};

const spies = {
  showOnly: vi.fn(), toggle: vi.fn(), chooseRegion: vi.fn(), chooseArea: vi.fn(), hideSelected: vi.fn(), startTour: vi.fn(), goStep: vi.fn(), endTour: vi.fn(),
};

/** The page's wiring, with the page's own rules for the lock (onShow raises it, the panel's X lowers it). */
function Page() {
  const [panel, setPanel] = useState<'review' | null>(null);
  const [quizLock, setQuizLock] = useState(false);
  const [state, setState] = useState<SceneState>(INITIAL);
  const [chosen, setChosen] = useState<Concept | null>(null);
  const [tourNow, setTourNow] = useState<{id: TourId; steps: Concept[]; index: number} | null>(null);
  return <>
    {panel === 'review' && <ReviewPanel atlas={ATLAS} body="male" source="BodyParts3D"
      onShow={els => { setQuizLock(true); setChosen(null); setState(v => ({...v, selected: els, isolate: true})); }}
      onInspect={() => {}} onStudyingChange={() => {}}
      onClose={() => { setQuizLock(false); setPanel(null); setState(v => ({...v, selected: [], isolate: false})); }}/>}
    <AtlasAgentActions atlas={ATLAS} sex="male" state={state} chosen={chosen} quizLock={quizLock} progress={100} error="" label={label} t={t}
      choose={c => { setChosen(c); setState(s => ({...s, selected: c.elements, isolate: false})); }}
      toggleIsolate={() => setState(s => ({...s, isolate: !s.isolate}))}
      toggle={spies.toggle} showOnly={ids => { spies.showOnly(ids); setState(s => ({...s, visible: ids, selected: []})); }}
      setExplode={() => {}} chooseView={() => {}} setRotate={() => {}} setBeat={on => setState(s => ({...s, beat: on}))} reset={() => {}} switchBody={() => {}}
      openReview={() => setPanel('review')}
      chooseRegion={id => { spies.chooseRegion(id); setState(s => ({...s, region: id, area: null})); }}
      chooseArea={id => { spies.chooseArea(id); setState(s => ({...s, area: id})); }}
      hideSelected={() => { spies.hideSelected(); setState(s => ({...s, hidden: [...s.hidden, ...s.selected], selected: []})); setChosen(null); }}
      clearSelection={() => setState(s => ({...s, selected: [], isolate: false}))}
      tours={TOURS} tourNow={tourNow}
      startTour={id => { spies.startTour(id); const found = TOURS.find(x => x.tour.id === id)!; setTourNow({id, steps: found.steps, index: 0}); }}
      goStep={i => { spies.goStep(i); setTourNow(n => n && {...n, index: i}); }}
      endTour={() => { spies.endTour(); setTourNow(null); }}/>
  </>;
}

// The refusal is caught INSIDE act: an act whose callback throws leaves React's
// act queue behind, and every later update (the schedule read) is lost in it.
const attempt = (name: string, args: Record<string, unknown>): {out?: unknown; error?: string} => {
  let r: {out?: unknown; error?: string} = {};
  act(() => {
    try { r = {out: door.handlers![name]!(args)}; } catch (e) { r = {error: (e as Error).message}; }
  });
  return r;
};
const call = (name: string, args: Record<string, unknown> = {}) => {
  const r = attempt(name, args);
  if (r.error !== undefined) throw new Error(r.error);
  return r.out as Record<string, unknown>;
};
const refused = (name: string, args: Record<string, unknown> = {}): string => {
  const r = attempt(name, args);
  if (r.error === undefined) throw new Error(`${name} was not refused`);
  return r.error;
};
/** The subject of the question on screen, read behind the agent's back (the agent is never told). */
const subject = () => FR[reviewDoor.current!.question!.subject.id]!;

beforeEach(() => {
  door.handlers = null;
  for (const s of Object.values(spies)) s.mockClear();
  window.history.replaceState({}, '', '/?lang=fr');
  vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, json: async () => FR})));
  setStoreInvoker(async <T,>() => ({}) as T);
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

/** Opens the review by voice: the first call waits (NOT_READY) while the schedule and names load, as the orb's retry does. */
async function start(args: Record<string, unknown>) {
  render(<Page/>);
  expect(refused('reviewStart', args)).toMatch(/^NOT_READY/);
  await waitFor(() => expect(reviewDoor.current?.ready).toBe(true));
  return call('reviewStart', args);
}

describe('a review driven entirely by voice', () => {
  it('starts on a system said in French, answers « c\'est le … », goes on, and ends on the results', async () => {
    const first = await start({scope: ['système digestif'], questions: 2});
    expect(first).toMatchObject({question: 1, of: 2, answered: false, structures: 4});
    expect([...(first.options as string[])].sort()).toEqual(['Estomac', 'Foie', 'Lobe droit du foie', 'Lobe gauche du foie']);
    expect(first).not.toHaveProperty('answer');
    // Said by the orb, in the person's language, and the orb keeps listening for the answer.
    expect(first).toMatchObject({voice: 'hold', say: expect.stringMatching(/^Question 1 sur 2 : .+, .+, .+ ou .+ \?$/)});
    // The question is on the body, and the view is the person's: an organ named now is an answer, never a camera move.
    // The four choices come in the run's own order (ReviewPanel seeds it from Math.random), so « Foie » may be last.
    expect(refused('focus', {structure: 'cœur'})).toMatch(/^TO_PERSON: Laquelle : .*Foie.*\?$/);
    expect(refused('explode', {amount: 40})).toBe('TO_PERSON: Une révision est en cours. Dis arrête la révision pour la fermer.');
    expect((call('screen').selected as Record<string, unknown>).quiz).toBeTruthy();

    const right = subject();
    expect(refused('reviewNext')).toMatch(/^TO_PERSON: Réponds d’abord : /);
    const said = call('reviewAnswer', {answer: `Irina, c'est le ${right}`});
    expect(said).toMatchObject({correct: true, said: right, answer: right, asked: 1, right: 1, finished: false, voice: 'hold', say: `Bonne réponse, ${right}. Dis suivante.`});
    expect(refused('reviewAnswer', {answer: right})).toBe('TO_PERSON: Déjà répondu. Dis suivante.');
    // Answered: the view stays the person's until the next question.
    expect(refused('focus', {structure: 'cœur'})).toMatch(/^TO_PERSON: Une révision est en cours/);

    expect(call('reviewNext')).toMatchObject({question: 2, answered: false});
    const truth = reviewDoor.current!.question!.subject.id;
    const wrongAt = reviewDoor.current!.question!.options.findIndex(o => o.id !== truth);
    const wrong = call('reviewAnswer', {option: wrongAt + 1});
    expect(wrong).toMatchObject({correct: false, answer: FR[truth], asked: 2, right: 1, finished: true, voice: 'release', say: `Non, c’était ${FR[truth]}. Révision finie : 1 sur 2.`});

    expect(refused('reviewNext')).toMatch(/^RUN_OVER/);
    const stop = call('reviewStop', {close: true});
    expect(stop).toMatchObject({open: false, results: {asked: 2, right: 1}});
    expect(reviewDoor.current).toBeNull();
    // The body is the person's again.
    expect(call('focus', {structure: 'cœur', isolate: false})).toMatchObject({id: 'FMA7088'});
  });

  it('takes a focus on an organ as the answer while a question is open (an orb recipe of « le foie » is a focus)', async () => {
    await start({scope: ['système digestif'], questions: 2});
    const right = subject();
    expect(call('focus', {structure: `le ${right}`})).toMatchObject({review: true, correct: true, said: right, asked: 1});
    expect(reviewDoor.current?.answered).toBeTruthy();
  });

  it('refuses an answer that names two choices, or none of them, with the choices', async () => {
    await start({scope: ['digestif']});
    expect(refused('reviewAnswer', {answer: 'le lobe'})).toMatch(/^TO_PERSON: Laquelle : .*Lobe droit du foie/);
    expect(refused('reviewAnswer', {answer: 'le cœur'})).toMatch(/^TO_PERSON: Laquelle : .*Foie/);
    expect(refused('reviewAnswer', {option: 7})).toMatch(/^BAD_ARG/);
    expect(reviewDoor.current!.answered).toBeNull();
    // « la deuxième »: the choice by its place on screen.
    const second = reviewDoor.current!.question!.options[1]!.name;
    expect(call('reviewAnswer', {answer: 'la deuxième'})).toMatchObject({said: second});
  });

  it('passes a question without grading it, says what it was, repeats, and changes what is asked between questions', async () => {
    await start({scope: ['digestif'], questions: 0});
    const was = subject();
    const skipped = call('reviewSkip');
    expect(skipped).toMatchObject({skipped: was, graded: false, question: 1, of: null});
    expect(reviewDoor.current!.run!.answers).toHaveLength(0);

    expect(call('reviewRepeat')).toMatchObject({question: 1, answered: false});
    expect(call('reviewScope', {scope: ['le squelette']})).toMatchObject({scope: 'Squelette', structures: 4});
    call('reviewSkip');
    expect([...(call('reviewState').options as string[])].sort()).toEqual(['Crâne', 'Fémur', 'Humérus', 'Tibia']);

    expect(call('reviewStop')).toMatchObject({open: true, results: {asked: 0}});
    expect(reviewDoor.current!.screen).toBe('results');
  });

  it('refuses a scope too small to ask fairly, and one that names nothing, with what exists', async () => {
    render(<Page/>);
    expect(refused('reviewStart', {})).toMatch(/^NOT_READY/);
    await waitFor(() => expect(reviewDoor.current?.ready).toBe(true));
    expect(refused('reviewStart', {scope: ['le foie']})).toMatch(/^TOO_SMALL: Foie has 1 structure/);
    expect(refused('reviewStart', {scope: ['la lune']})).toMatch(/^NO_SCOPE: "la lune" is no system, region or structure of this body; systems: .*Squelette \(skeletal\)/);
    expect(refused('reviewAnswer', {answer: 'foie'})).toMatch(/^NO_RUN/);
    // A region narrows: the abdomen holds the four digestive structures.
    expect(call('reviewStart', {scope: ['abdomen']})).toMatchObject({structures: 4, scope: 'Abdomen'});
  });
});

describe('the other gestures, by the words a person says', () => {
  it('systems by their names; an unknown one lists what exists', () => {
    render(<Page/>);
    expect(call('showSystems', {mode: 'only', systems: ['le squelette', 'digestive']})).toEqual({visible: ['skeletal', 'digestive']});
    expect(refused('showSystems', {systems: ['la lune']})).toMatch(/^NO_SYSTEM: no system named "la lune"; systems: Squelette \(skeletal\)/);
  });

  it('a structure hidden by its name; a name that fits two is refused with both', () => {
    render(<Page/>);
    expect(call('hideStructure', {structure: 'estomac'})).toMatchObject({hidden: 'Estomac'});
    expect(spies.hideSelected).toHaveBeenCalledTimes(1);
    expect(refused('hideStructure', {structure: 'lobe'})).toMatch(/^AMBIGUOUS: "lobe" names several structures: /);
    expect(refused('hideStructure')).toMatch(/^NO_SELECTION/);
  });

  it('isolate and deselect what is selected, refused with nothing selected', () => {
    render(<Page/>);
    expect(refused('isolate')).toMatch(/^NO_SELECTION/);
    call('focus', {structure: 'foie', isolate: false});
    expect(call('isolate', {on: true})).toEqual({isolated: true, structure: 'Foie'});
    expect(call('isolate', {on: false})).toMatchObject({isolated: false});
    expect(call('clearSelection')).toEqual({selected: 0});
  });

  it('a region by its French name, the whole body back', () => {
    render(<Page/>);
    expect(call('showPlace', {place: 'abdomen'})).toMatchObject({region: 'abdomen', area: null});
    expect(spies.chooseRegion).toHaveBeenLastCalledWith('abdomen');
    expect(call('showPlace', {place: 'corps entier'})).toEqual({region: null, area: null});
    expect(refused('showPlace', {place: 'la lune'})).toMatch(/^NO_PLACE: no place named "la lune"; places: /);
  });

  it('the heartbeat on and off, said on screen, and refused while a review question is open', async () => {
    render(<Page/>);
    expect(call('screen')).toMatchObject({beating: false});
    expect(call('heartbeat')).toEqual({beating: true, beatsPerMinute: 72, schematic: true});
    expect(call('screen')).toMatchObject({beating: true});
    expect(call('heartbeat', {on: false})).toEqual({beating: false});
    expect(call('screen')).toMatchObject({beating: false});
    // A review run owns the view: the beat is a write like the others.
    expect(refused('reviewStart', {scope: ['système digestif'], questions: 1})).toMatch(/^NOT_READY/);
    await waitFor(() => expect(reviewDoor.current?.ready).toBe(true));
    call('reviewStart', {scope: ['système digestif'], questions: 1});
    expect(refused('heartbeat')).toBe('TO_PERSON: Une révision est en cours. Dis arrête la révision pour la fermer.');
  });

  it('a tour by its name, stepped through and stopped; « ligne » names two', () => {
    render(<Page/>);
    expect(refused('tourStep')).toMatch(/^NO_TOUR: no tour is running; startTour starts one of Ligne latérale, Ligne antérieure superficielle/);
    expect(refused('startTour', {tour: 'ligne'})).toMatch(/^AMBIGUOUS: "ligne" names several tours/);
    expect(call('startTour', {tour: 'la ligne latérale'})).toEqual({tour: 'Ligne latérale', stop: 1, of: 2, structure: 'Fémur'});
    expect(refused('tourStep', {go: 'previous'})).toMatch(/^TOUR_END: this is the first stop/);
    expect(call('tourStep', {go: 'next'})).toMatchObject({stop: 2, structure: 'Tibia'});
    expect(call('tourStep', {go: 'stop'})).toEqual({tour: null});
    expect(spies.endTour).toHaveBeenCalledTimes(1);
  });
});
