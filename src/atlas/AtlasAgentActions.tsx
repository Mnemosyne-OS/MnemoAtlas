/**
 * What an agent may do in the Atlas (doc 149), declared in
 * `mnemo-plugin.json` › agentActions and served here while the Atlas is open.
 *
 * Each handler calls the SAME function as the Atlas's own control (the search
 * panel's choice, the Isolate button, a system switch, the slider, the view
 * buttons, Reset, the body choice), passed down from the page, so the person
 * watches the body move and nothing has a second path. Renders nothing.
 *
 * 🚨 While a review run is on screen (`quizLock` and the review panel's door
 * says a run), every view write is refused and `screen` does not name the
 * selected structure: the selection IS the question, and an agent that named
 * or moved it would hand over the answer. The review's own gestures
 * (`review*`) go through the panel's door (mnemo/reviewDoor): a review driven
 * entirely by voice is the review on screen, its buttons pressed.
 *
 * Everything that targets a thing takes it by the words a person says (a
 * structure, a system, a region, a tour, a review answer) and still by its id;
 * several matches are refused with their names, never the first one taken.
 *
 * The memory lookup of the detail sheet (AtlasMemory) is NOT exposed: it is a
 * model call with RAG on the person's route, never a free read.
 */
import {useEffect, useRef} from 'react';
import {flushSync} from 'react-dom';
import {MnemoCartridgeSDK} from '@mnemosyne_os/cartridge-sdk';
import type {Key} from '@/i18n/strings';
import {quizRefusal, ROTATE_SPEEDS, autoRotating, type Resolved, type RotatePace} from './agentResolve';
import {searchConcepts, STARTER_ORGANS} from './search';
import {FLAT_AT} from './camera-fit';
import {BEATS_PER_MINUTE, heartRole} from './heartbeat';
import {findNamed, listed, matchNamed} from './agentFind';
import {placeEntries, resolveReviewScope, resolveSaid, systemEntries, type Translate} from './agentScope';
import type {AreaId, RegionId} from './regions';
import type {Tour, TourId} from './tours';
import {SYSTEMS, type Atlas, type Concept, type SceneState, type SystemId, type View} from './anatomy';
import {reviewDoor, type ReviewDoor} from '@/mnemo/reviewDoor';
import {ALL_COLOR, canStudy, type Level} from '@/mnemo/levels';
import {runStats} from '@/mnemo/session';

// Must match "name" in mnemo-plugin.json: the host keys the agent actions on it.
const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-atlas');

const VIEWS: View[] = ['three-quarter', 'front', 'side', 'back'];
const SYSTEM_IDS = SYSTEMS.map(s => s.id) as string[];
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map(str).filter(Boolean);
/** A run's length said aloud: 0 is endless, else 1..100 (10 when unsaid). */
const QUESTIONS_MAX = 100;
const TOUR_MOVES = ['next', 'previous', 'first', 'last', 'stop'] as const;
/** A review choice by its place on screen, as said (« la deuxième »). */
const ORDINALS = [
  ['1', 'première', 'premier', 'first', 'primera'],
  ['2', 'deuxième', 'seconde', 'second', 'segunda'],
  ['3', 'troisième', 'third', 'tercera'],
  ['4', 'quatrième', 'fourth', 'cuarta'],
];

export interface AtlasAgentProps {
  atlas: Atlas | null;
  sex: 'male' | 'female';
  state: SceneState;
  chosen: Concept | null;
  quizLock: boolean;
  progress: number;
  error: string;
  label: (id: string, english: string) => string;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** The search panel's choice: select the structure, open its sheet. */
  choose: (c: Concept) => void;
  /** The sheet's Isolate button: the camera frames the selection. */
  toggleIsolate: () => void;
  /** A system's switch. */
  toggle: (id: SystemId) => void;
  /** A preset or a system's « show only ». */
  showOnly: (ids: SystemId[]) => void;
  /** The explode slider, 0..1. */
  setExplode: (amount: number) => void;
  /** A view button. */
  chooseView: (view: View) => void;
  /** The rotate button (with a pace for the agent, a multiple of the person's speed). */
  setRotate: (on: boolean, pace?: number) => void;
  /** The heartbeat button: the chambers follow a schematic cycle (heartbeat.ts). */
  setBeat: (on: boolean) => void;
  /** The Reset button. */
  reset: () => void;
  /** The body choice. */
  switchBody: (sex: 'male' | 'female') => void;
  /** The Review button: opens the review panel (its gestures then go through reviewDoor). */
  openReview: () => void;
  /** A region of the layers panel, or the whole body (null). */
  chooseRegion: (id: RegionId | null) => void;
  /** An area of the layers panel (pressing the one chosen clears it). */
  chooseArea: (id: AreaId) => void;
  /** The sheet's Hide button: the selection hidden (Reset brings it back). */
  hideSelected: () => void;
  /** The sheet's Clear button. */
  clearSelection: () => void;
  /** The guided visits this body offers. */
  tours: {tour: Tour; steps: Concept[]}[];
  /** The visit on screen, if any. */
  tourNow: {id: TourId; steps: Concept[]; index: number} | null;
  /** A visit's button in the tours panel. */
  startTour: (id: TourId) => void;
  /** The visit bar's previous / next. */
  goStep: (index: number) => void;
  /** The visit bar's « End the visit ». */
  endTour: () => void;
}

export function AtlasAgentActions(props: AtlasAgentProps) {
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    // 🪤 A window opened before the SDK learned this method (doc 149 §8) must
    // keep working: say why the agent finds nothing, never throw.
    if (typeof sdk.onAgentActions !== 'function') {
      console.warn('[Atlas] agent actions not served: this window runs an older SDK, reload it');
      return;
    }

    const ready = (): Atlas => {
      const {atlas, progress, error} = latest.current;
      if (!atlas && error) throw new Error(`LOAD_FAILED: the body could not be loaded (${error}); the person can reload the Atlas`);
      if (!atlas) throw new Error(`NOT_READY: the body is loading (${progress}%); call screen again in a moment`);
      return atlas;
    };
    // The lock is the page's quizLock AND a run on the review panel: the page
    // keeps quizLock up after the panel is swapped for another one (only the
    // panel's X lowers it), and a lock with no review on screen is no lock.
    const locked = (): boolean => latest.current.quizLock && reviewDoor.current?.screen === 'run';
    const writable = (action: string): Atlas => {
      const atlas = ready();
      // Said to the person: a repair call reading « reviewStop ends it » would close their review.
      const refused = quizRefusal(action, locked());
      if (refused) throw toPerson(say('voice.running'));
      return atlas;
    };
    const tt: Translate = (key) => latest.current.t(key as Key);
    /** A line the orb says for the app (doc 149 §19): in the person's language, never the planner's guess. */
    const say = (key: string, vars?: Record<string, string | number>): string => latest.current.t(key as Key, vars);
    /** « A, B, C or D »: the choices read in the order they are on screen. */
    const choicesSaid = (names: readonly string[]): string =>
      names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${say('voice.or')} ${names[names.length - 1]}`;
    /**
     * A refusal for the PERSON while a question is open: said by the orb, never
     * read by its repair call, which would pick one of the choices in their place.
     */
    const toPerson = (line: string): Error => new Error(`TO_PERSON: ${line}`);
    /** The question on screen as the orb says it, and the orb kept listening for its answer. */
    const asked = (d: ReviewDoor) => {
      const shown = asking(d);
      if (shown.question === null || !d.question) return {...shown, say: undefined as string | undefined, voice: 'release' as const};
      const choices = choicesSaid(d.question.options.map(o => o.name));
      const line = shown.of ? say('voice.question', {n: shown.question, total: shown.of, choices}) : say('voice.questionOpen', {n: shown.question, choices});
      return {...shown, say: line, voice: 'hold' as const};
    };
    const named = (c: Concept) => latest.current.label(c.id, c.name);
    /** One structure from the words said, or the refusal the orb's repair call reads. */
    const structure = (atlas: Atlas, query: string): Concept => {
      if (!query) throw new Error('BAD_ARG: name the structure');
      const r: Resolved = resolveSaid(atlas.concepts, query, named);
      if (r.kind === 'ambiguous') throw new Error(`AMBIGUOUS: "${query}" names several structures: ${r.candidates.map(c => `${named(c)} (${c.id})`).join(', ')}; say which, or pass one id`);
      if (r.kind === 'none') {
        throw new Error(r.near.length
          ? `NO_STRUCTURE: no structure "${query}" in the ${latest.current.sex} body; the closest: ${r.near.map(c => `${named(c)} (${c.id})`).join(', ')}`
          : `NO_STRUCTURE: no structure "${query}" in the ${latest.current.sex} body; call structures with one word (heart, femur, vagus) to list what exists`);
      }
      return r.concept;
    };
    /** A system id, or a system named the way it is said (« squelette », « système digestif »). */
    const system = (atlas: Atlas, said: string): SystemId => {
      if (SYSTEM_IDS.includes(said)) return said as SystemId;
      return findNamed(systemEntries(atlas, tt), said, {code: 'NO_SYSTEM', noun: 'system'});
    };

    // ── the review (mnemo/reviewDoor) ────────────────────────────────────
    const door = (): ReviewDoor => {
      const d = reviewDoor.current;
      if (!d) throw new Error('NO_REVIEW: the review is not open; reviewStart opens it and asks the first question');
      return d;
    };
    /** The review panel, opened as the Review button opens it; waits (NOT_READY) for its schedule and names. */
    const openDoor = (): ReviewDoor => {
      ready();
      if (!reviewDoor.current) flushSync(() => latest.current.openReview());
      const d = reviewDoor.current as ReviewDoor | null;
      if (!d) throw new Error('WRITE_FAILED: the review panel did not open');
      if (!d.ready) throw new Error('NOT_READY: the review is reading its schedule and the structure names; call again in a moment');
      return d;
    };
    /** The level a scope said aloud names, counted in the reader's language; refused when too small to ask fairly. */
    const levelFor = (atlas: Atlas, d: ReviewDoor, words: string[]): Level => {
      const scope = resolveReviewScope(atlas, words, tt, named);
      const base: Level = scope
        ? {id: scope.id, name: scope.label, label: scope.label, color: ALL_COLOR, systems: scope.systems, total: 0, ...(scope.only ? {only: scope.only} : {})}
        : d.levels()[0]!;
      const lv = {...base, total: d.poolSize(base)};
      const v = canStudy(lv);
      if (!v.ok) throw new Error(`TOO_SMALL: ${d.levelName(lv)} has ${v.n} structure${v.n === 1 ? '' : 's'} to ask in this language, a question needs 4; name a wider scope (a system, a region) or none for the whole body`);
      return lv;
    };
    /** What a question shows, never its answer while it is open. */
    const asking = (d: ReviewDoor) => {
      const {run, question, answered} = d;
      if (!run || !question) return {question: null};
      const subject = question.options.find(o => o.id === question.subject.id);
      return {
        scope: d.level ? d.levelName(d.level) : null,
        question: run.answers.length + (answered ? 0 : 1),
        of: run.length,
        options: question.options.map(o => o.name),
        answered: !!answered,
        ...(answered && subject ? {answer: subject.name, correct: answered.correct} : {}),
      };
    };
    const tally = (d: ReviewDoor) => {
      if (!d.run) return null;
      const st = runStats(d.run, Date.now());
      return {asked: st.asked, right: st.right, accuracy: st.accuracy === null ? null : Math.round(st.accuracy * 100), streak: d.run.streak, bestStreak: st.bestStreak, missed: st.missed.map(m => m.name).slice(0, 12)};
    };
    /** The run on screen with a question open, or why not. */
    const running = (d: ReviewDoor): NonNullable<ReviewDoor['question']> => {
      if (d.screen === 'results') throw new Error('RUN_OVER: the run is finished; reviewStart starts another, reviewStop with close true gives the body back');
      if (d.screen !== 'run' || !d.question) throw new Error('NO_RUN: no review question is on screen; reviewStart asks the first one');
      return d.question;
    };
    /**
     * The answer to the question on screen: one of its four choices, by its words
     * or its number. reviewAnswer, and focus while a question is open.
     */
    const answerReview = (args: Record<string, unknown>) => {
      const d = door();
      const question = running(d);
      if (d.answered) throw toPerson(say('voice.answered'));
      const options = question.options.map((o, i) => ({item: o, id: o.id, names: [o.name, d.english(o.id) ?? o.name, ...(ORDINALS[i] ?? [])], label: o.name}));
      const pick = typeof args.option === 'number' ? options[Math.round(args.option) - 1]?.item : undefined;
      if (typeof args.option === 'number' && !pick) throw new Error(`BAD_ARG: option is 1 to ${options.length}`);
      const said = str(args.answer);
      if (!pick && !said) throw new Error(`BAD_ARG: answer is the structure the person said; the choices: ${listed(options.map(o => o.label))}`);
      // The answer is one of the four choices on screen, never a guess across the atlas.
      // Not understood: the choices are said again to the person, never handed to a repair call.
      let option = pick;
      if (!option) {
        try {
          option = findNamed(options, said, {code: 'NO_OPTION', noun: 'choice'});
        } catch (err) {
          console.info('[Atlas] review answer not understood:', err instanceof Error ? err.message : String(err));
          throw toPerson(say('voice.unclear', {choices: choicesSaid(options.map(o => o.label))}));
        }
      }
      flushSync(() => d.answer(option));
      const after = door();
      if (!after.answered) throw new Error('WRITE_FAILED: the answer was not taken');
      const subject = question.options.find(o => o.id === question.subject.id)!;
      const finished = after.screen === 'results';
      const counted = tally(after);
      const verdict = say(after.answered.correct ? 'voice.right' : 'voice.wrong', {answer: subject.name});
      const then = finished && counted ? say('voice.done', {right: counted.right, asked: counted.asked}) : say('voice.next');
      return {correct: after.answered.correct, said: option.name, answer: subject.name, ...counted, finished, kept: after.kept,
        say: `${verdict} ${then}`, voice: finished ? 'release' : 'hold'};
    };
    const counts = (atlas: Atlas): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const p of atlas.parts) out[p.system] = (out[p.system] ?? 0) + 1;
      return out;
    };
    const systemOf = new WeakMap<Atlas, Map<string, SystemId>>();
    const line = (atlas: Atlas, c: Concept) => {
      const {label} = latest.current;
      let bySystem = systemOf.get(atlas);
      if (!bySystem) { bySystem = new Map(atlas.parts.map(p => [p.id, p.system])); systemOf.set(atlas, bySystem); }
      const systems = new Set<string>();
      for (const id of c.elements) {
        const sys = bySystem.get(id);
        if (sys) systems.add(sys);
      }
      const shown = label(c.id, c.name);
      return {id: c.id, name: c.name, ...(shown !== c.name ? {label: shown} : {}), pieces: c.elements.length, systems: [...systems]};
    };

    const sub = sdk.onAgentActions({
      structures: (args) => {
        const atlas = ready();
        const query = str(args.query);
        const limit = typeof args.limit === 'number' ? Math.max(1, Math.min(80, Math.round(args.limit))) : 30;
        const {label} = latest.current;
        const found = query
          ? searchConcepts(atlas.concepts, query, c => label(c.id, c.name), limit)
          : STARTER_ORGANS.map(n => atlas.concepts.find(c => c.name.toLowerCase() === n)).filter((x): x is Concept => !!x);
        return {body: latest.current.sex, structures: found.map(c => line(atlas, c))};
      },

      focus: (args) => {
        // 🚨 While a question is open, an organ named IS the answer: the orb's recipe of « le foie »
        // is a focus, and refusing it would send the repair call to reviewStop.
        const d = reviewDoor.current;
        if (locked() && d && !d.answered && str(args.structure)) return {review: true, ...answerReview({answer: args.structure})};
        const atlas = writable('focus');
        const concept = structure(atlas, str(args.structure));
        const isolate = args.isolate !== false;
        flushSync(() => {
          latest.current.choose(concept);
          // choose() leaves the selection in place; the Isolate button is what flies the camera to it.
          if (isolate) latest.current.toggleIsolate();
        });
        return {...line(atlas, concept), isolated: latest.current.state.isolate};
      },

      showSystems: (args) => {
        const atlas = writable('showSystems');
        const mode = str(args.mode) || 'only';
        const n = counts(atlas);
        const offered = SYSTEMS.filter(s => (n[s.id] ?? 0) > 0).map(s => s.id);
        const ids: SystemId[] = [];
        if (mode !== 'all') {
          const raw = Array.isArray(args.systems) ? args.systems : [];
          if (!raw.length) throw new Error(`BAD_ARG: systems is needed for mode "${mode}"; one of ${offered.join(', ')}`);
          for (const x of raw) {
            // An id, or the system as it is said (« squelette », « système digestif »).
            const id = system(atlas, str(x));
            if (!offered.includes(id)) throw new Error(`NO_SYSTEM: the ${latest.current.sex} body has no "${id}"; one of ${offered.join(', ')}`);
            if (!ids.includes(id)) ids.push(id);
          }
        }
        flushSync(() => {
          const {state, showOnly, toggle} = latest.current;
          if (mode === 'all') showOnly(offered);
          else if (mode === 'only') showOnly(ids);
          else for (const id of ids) if (state.visible.includes(id) !== (mode === 'show')) toggle(id);
        });
        return {visible: latest.current.state.visible};
      },

      switchBody: (args) => {
        writable('switchBody');
        const sex = str(args.body);
        if (sex !== 'male' && sex !== 'female') throw new Error('BAD_ARG: body is male or female');
        if (sex === latest.current.sex) return {body: sex, changed: false};
        latest.current.switchBody(sex);
        return {body: sex, changed: true, loading: true, follow: 'call screen until loaded is true'};
      },

      explode: (args) => {
        writable('explode');
        const percent = typeof args.percent === 'number' ? Math.max(0, Math.min(100, args.percent)) : NaN;
        if (!Number.isFinite(percent)) throw new Error('BAD_ARG: percent is a number from 0 (assembled) to 100 (every piece apart)');
        flushSync(() => latest.current.setExplode(percent / 100));
        const s = latest.current.state;
        return {explode: Math.round(s.explode * 100), view: s.view};
      },

      rotate: (args) => {
        writable('rotate');
        const on = args.on !== false;
        const pace = (str(args.speed) || 'normal') as RotatePace;
        if (!(pace in ROTATE_SPEEDS)) throw new Error(`BAD_ARG: speed is one of ${Object.keys(ROTATE_SPEEDS).join(', ')}`);
        if (on && !autoRotating({rotate: true, explode: latest.current.state.explode})) throw new Error('EXPLODED: the body is coming apart (explode at 40% or more), it does not turn; call explode with 0 first');
        latest.current.setRotate(on, on ? ROTATE_SPEEDS[pace] : undefined);
        return {rotating: on, ...(on ? {speed: pace} : {})};
      },

      cameraView: (args) => {
        writable('cameraView');
        const view = str(args.view) as View;
        if (!VIEWS.includes(view)) throw new Error(`BAD_ARG: view is one of ${VIEWS.join(', ')}`);
        // The view buttons other than front are off while the body lies flat.
        if (latest.current.state.explode > FLAT_AT && view !== 'front') throw new Error(`FLAT: the body is laid flat (explode above ${Math.round(FLAT_AT * 100)}%), only the front view applies; call explode with a lower percent first`);
        latest.current.chooseView(view);
        return {view};
      },

      resetView: () => {
        writable('resetView');
        latest.current.reset();
        return {reset: true};
      },

      isolate: (args) => {
        writable('isolate');
        const {state, chosen} = latest.current;
        if (!state.selected.length) throw new Error('NO_SELECTION: nothing is selected; focus selects a structure');
        const on = args.on !== false;
        if (state.isolate !== on) flushSync(() => latest.current.toggleIsolate());
        return {isolated: latest.current.state.isolate, ...(chosen ? {structure: named(chosen)} : {})};
      },

      clearSelection: () => {
        writable('clearSelection');
        flushSync(() => latest.current.clearSelection());
        return {selected: latest.current.state.selected.length};
      },

      hideStructure: (args) => {
        const atlas = writable('hideStructure');
        const query = str(args.structure);
        // A name hides that structure (selected first, as the sheet's Hide does); none hides what is selected.
        const concept = query ? structure(atlas, query) : latest.current.chosen;
        if (!concept || (!query && !latest.current.state.selected.length)) throw new Error('NO_SELECTION: nothing is selected; name the structure to hide');
        flushSync(() => {
          if (query) latest.current.choose(concept);
          latest.current.hideSelected();
        });
        return {hidden: named(concept), hiddenPieces: latest.current.state.hidden.length, back: 'resetView shows every hidden piece again'};
      },

      showPlace: (args) => {
        const atlas = writable('showPlace');
        const said = str(args.place);
        const whole = !said || matchNamed([{item: true, id: 'body', names: ['whole body', 'body', 'all', 'corps entier', 'corps', 'tout', tt('ui.wholeBody')], label: tt('ui.wholeBody')}], said).kind === 'found';
        if (whole) {
          flushSync(() => latest.current.chooseRegion(null));
          return {region: null, area: null};
        }
        const place = findNamed(placeEntries(atlas, tt), said, {code: 'NO_PLACE', noun: 'place'});
        flushSync(() => {
          if (place.kind === 'region') latest.current.chooseRegion(place.id);
          // The area button toggles: pressed again on the area shown, it would clear it.
          else if (latest.current.state.area !== place.id) latest.current.chooseArea(place.id);
        });
        const s = latest.current.state;
        return {region: s.region, area: s.area, name: tt(`${place.kind}.${place.id}`)};
      },

      startTour: (args) => {
        writable('startTour');
        const said = str(args.tour);
        const entries = latest.current.tours.map(({tour}) => ({item: tour.id, id: tour.id, names: [tour.id, tt(`tour.name.${tour.id}`)], label: tt(`tour.name.${tour.id}`)}));
        const id = findNamed(entries, said, {code: 'NO_TOUR', noun: 'tour'});
        flushSync(() => latest.current.startTour(id));
        const now = latest.current.tourNow;
        if (!now || now.id !== id) throw new Error('WRITE_FAILED: the tour did not start');
        return {tour: tt(`tour.name.${id}`), stop: now.index + 1, of: now.steps.length, structure: named(now.steps[now.index]!)};
      },

      tourStep: (args) => {
        writable('tourStep');
        const now = latest.current.tourNow;
        if (!now) throw new Error(`NO_TOUR: no tour is running; startTour starts one of ${listed(latest.current.tours.map(({tour}) => tt(`tour.name.${tour.id}`)))}`);
        const go = (str(args.go) || 'next') as (typeof TOUR_MOVES)[number];
        if (!TOUR_MOVES.includes(go)) throw new Error(`BAD_ARG: go is one of ${TOUR_MOVES.join(', ')}`);
        if (go === 'stop') {
          flushSync(() => latest.current.endTour());
          return {tour: null};
        }
        const last = now.steps.length - 1;
        const index = go === 'first' ? 0 : go === 'last' ? last : now.index + (go === 'next' ? 1 : -1);
        if (index < 0 || index > last) throw new Error(`TOUR_END: this is the ${index < 0 ? 'first' : 'last'} stop (${now.index + 1} of ${now.steps.length}); go ${index < 0 ? 'next' : 'previous'}, or stop`);
        flushSync(() => latest.current.goStep(index));
        const after = latest.current.tourNow ?? now;
        return {tour: tt(`tour.name.${after.id}`), stop: after.index + 1, of: after.steps.length, structure: named(after.steps[after.index]!)};
      },

      heartbeat: (args) => {
        writable('heartbeat');
        const on = args.on !== false;
        // A body with no chamber mesh has nothing to beat; the button is not offered there either.
        if (on && !ready().parts.some(p => heartRole(p))) throw new Error('NO_HEART: this body has no heart chamber to beat');
        latest.current.setBeat(on);
        return {beating: on, ...(on ? {beatsPerMinute: BEATS_PER_MINUTE, schematic: true} : {})};
      },

      reviewStart: (args) => {
        const atlas = ready();
        const d = openDoor();
        const raw = args.questions;
        const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 10;
        if (n < 0 || n > QUESTIONS_MAX) throw new Error(`BAD_ARG: questions is 1 to ${QUESTIONS_MAX}, or 0 for no end`);
        const lv = levelFor(atlas, d, strs(args.scope));
        const before = d.screen === 'run' ? tally(d) : null;
        flushSync(() => d.start(lv, n === 0 ? null : n));
        const after = door();
        if (!after.question) throw new Error(`NO_QUESTION: no question could be drawn from ${after.level ? after.levelName(after.level) : 'this scope'}`);
        return {...asked(after), structures: lv.total, kept: after.kept, ...(before ? {restarted: before} : {})};
      },

      reviewAnswer: (args) => answerReview(args),

      reviewNext: () => {
        const d = door();
        running(d);
        if (!d.answered) throw toPerson(say('voice.answerFirst', {choices: choicesSaid(d.question!.options.map(o => o.name))}));
        flushSync(() => d.next());
        return asked(door());
      },

      reviewSkip: () => {
        const d = door();
        const question = running(d);
        // Already answered: passing is just the next question.
        if (d.answered) {
          flushSync(() => d.next());
          return asked(door());
        }
        const subject = question.options.find(o => o.id === question.subject.id)!;
        // Nothing is graded: the schedule and the run's count do not move.
        flushSync(() => d.skip());
        const next = asked(door());
        return {skipped: subject.name, graded: false, ...next, say: `${say('voice.skipped', {answer: subject.name})} ${next.say ?? ''}`.trim()};
      },

      reviewRepeat: () => {
        const d = door();
        running(d);
        flushSync(() => d.reshow());
        return asked(door());
      },

      reviewScope: (args) => {
        const atlas = ready();
        const d = door();
        if (d.screen !== 'run') throw new Error('NO_RUN: no review is running; reviewStart takes a scope too');
        const lv = levelFor(atlas, d, strs(args.scope));
        flushSync(() => d.rescope(lv));
        return {scope: d.levelName(lv), structures: lv.total, from: d.answered ? 'the next question' : 'the question after this one'};
      },

      reviewStop: (args) => {
        const d = reviewDoor.current;
        if (!d) return {open: false, voice: 'release'};
        if (d.screen === 'run') flushSync(() => d.finish());
        const done = reviewDoor.current ? tally(reviewDoor.current) : null;
        if (args.close === true) flushSync(() => (reviewDoor.current ?? d).close());
        const line = done && done.asked > 0 ? say('voice.done', {right: done.right, asked: done.asked}) : say('voice.closed');
        return {results: done, open: !!reviewDoor.current, say: line, voice: 'release'};
      },

      reviewState: () => {
        const d = reviewDoor.current;
        if (!d) return {open: false};
        return {
          open: true,
          screen: d.screen,
          ...(d.screen === 'levels' && d.ready ? {scopes: d.levels().map(lv => ({name: d.levelName(lv), structures: lv.total}))} : {}),
          ...(d.screen === 'run' ? asking(d) : {}),
          ...(d.run ? {results: tally(d)} : {}),
          kept: d.kept,
        };
      },

      screen: () => {
        const {atlas, sex, state, chosen, progress, error, t, label, tourNow} = latest.current;
        const quizLock = locked();
        const n = atlas ? counts(atlas) : {};
        const selected = quizLock
          ? {quiz: 'a review question is on screen; its structure is the question, so it is not named'}
          : chosen && state.selected.length
            ? {id: chosen.id, name: chosen.name, label: label(chosen.id, chosen.name), pieces: state.selected.length}
            : null;
        return {
          body: sex,
          loaded: !!atlas && progress >= 100,
          ...(atlas && progress < 100 ? {loadingPercent: progress} : {}),
          ...(error ? {error} : {}),
          pieces: atlas?.parts.length ?? null,
          selected,
          isolated: state.isolate,
          explode: Math.round(state.explode * 100),
          view: state.view,
          rotating: state.rotate,
          beating: state.beat,
          region: state.region,
          area: state.area,
          hiddenPieces: state.hidden.length,
          // A run on screen: the person's next words are probably an answer (reviewAnswer).
          review: reviewDoor.current ? {screen: reviewDoor.current.screen, question: quizLock && !reviewDoor.current.answered} : null,
          tour: tourNow ? {name: t(`tour.name.${tourNow.id}` as Key), stop: tourNow.index + 1, of: tourNow.steps.length} : null,
          systems: atlas
            ? SYSTEMS.filter(s => (n[s.id] ?? 0) > 0).map(s => ({id: s.id, name: t(`system.${s.id}` as Key), pieces: n[s.id], visible: state.visible.includes(s.id)}))
            : [],
        };
      },
    });
    sub.ready.catch((err: unknown) => console.warn('[Atlas] agent actions not served:', err instanceof Error ? err.message : err));
    return () => sub.off();
  }, []);

  return null;
}
