/**
 * reviewDoor — the review panel's own gestures, reachable by the agents' door
 * (doc 149: a review driven entirely by voice).
 *
 * The run lives in ReviewPanel's state and nowhere else. The panel publishes
 * its functions here on every render (a plain assignment, NO hook: the panel
 * is mounted in a running app, and a hook added to it breaks the hook order
 * of the window that is open). AtlasAgentActions reads `reviewDoor.current`
 * at call time; null means the panel is not open.
 *
 * Each function is the one the panel's own button calls, so a review driven by
 * voice is the review on screen: the same question isolated on the body, the
 * same schedule written, the same results screen.
 *
 * Lives apart from ReviewPanel.tsx: a module exporting a component AND a value
 * is one React Fast Refresh refuses, and every save reloads the whole window.
 */
import type {Askable, Question} from './review';
import type {Level} from './levels';
import type {Run, RunLength} from './session';

export interface ReviewDoor {
  /** Identifies the panel instance that published it (its unmount clears only its own). */
  owner: object;
  /** The schedule has been read and the names are loaded: a run can start. */
  ready: boolean;
  /** Answers are written to the schedule (false: the host could not be reached, they live until the window closes). */
  kept: boolean;
  screen: 'levels' | 'length' | 'run' | 'results';
  level: Level | null;
  run: Run | null;
  question: Question | null;
  answered: {picked: string; correct: boolean} | null;
  /** A level's name as the panel shows it. */
  levelName: (lv: Level) => string;
  /** The tiles, each counted in the reader's language (the number the quiz will ask). */
  levels: () => Level[];
  /** How many structures a level can ask in the reader's language. */
  poolSize: (lv: Level) => number;
  /** A structure's English name, for an answer said in English while the options read in French. */
  english: (id: string) => string | undefined;
  /** Starts a run on a level (the length buttons, with the level given rather than read from the screen). */
  start: (lv: Level, length: RunLength) => void;
  /** Draws the next questions from another level; the run, its count and its streak go on. */
  rescope: (lv: Level) => void;
  /** An option pressed. */
  answer: (option: Askable) => void;
  /** The Next button. */
  next: () => void;
  /** The question set aside unanswered (nothing graded) and the next one asked. */
  skip: () => void;
  /** The question's structure isolated and framed again. */
  reshow: () => void;
  /** The run ended where it stands (« Finish here »): the results screen. */
  finish: () => void;
  /** The panel's X. */
  close: () => void;
}

export const reviewDoor: {current: ReviewDoor | null} = {current: null};
