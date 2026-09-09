/**
 * ReviewPanel — pick a category, pick a length, get asked, see how it went,
 * and file the run in your memory.
 *
 * Four screens, one panel: LEVELS → LENGTH → RUN → RESULTS.
 *
 * This is the surface that makes the cartridge a memory tool rather than a
 * viewer. It isolates a structure in the 3D body without naming it, offers four
 * candidates from the same system, and files the answer against the structure's
 * FMA id — stable across languages, spellings and datasets, so a card written
 * today still means the same thing next year.
 *
 * Two stores, on purpose, because they answer different questions:
 *
 *  - the SCHEDULE lives in the host-side state mirror (doc 73). Machinery:
 *    boxes and day numbers, rewritten on every answer, nobody should read it.
 *  - the RUN goes into this cartridge's own vault as one chronicle a human
 *    would want back. That is the half the chat can answer from, and it is
 *    written on a GESTURE: an ingest is permanent and shared with every future
 *    agent, so never automatically and never one row per answer.
 *
 * The panel's job is to never overstate. Progress never read shows `—`, not
 * `0`. With no host the quiz still runs and the panel SAYS answers are not
 * kept. A level too small for four honest options is offered as unavailable
 * WITH its count, instead of going grey for a reason nobody can see. Every
 * figure on the results screen — streak, accuracy, time — is a quantity that
 * was measured; there is no invented currency sitting beside them in the same
 * typeface.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Brain, Check, ChevronRight, Flame, RotateCcw, Save, Trophy, X } from 'lucide-react';
import { MnemoCartridgeSDK } from '@mnemosyne_os/cartridge-sdk';
import { Button } from '@/components/ui/button';
import {
  emptyState, grade, nextQuestion, parseState, progress, sessionNote, stateSize, STUDY_SPINE,
  type Askable, type Question, type ReviewState,
} from './review';
import { askablePool, ALL_LEVEL, canStudy, levelProgress, levelsOf, type Level } from './levels';
import {
  duration, endRun, isComplete, LENGTHS, lengthLabel, rankOf, record, runStats, startRun,
  type Rank, type Run, type RunLength,
} from './session';
import { SYSTEMS, type Atlas, type Concept } from '../atlas/anatomy';
/** session.ts names a rank; the strings table words it. */
const RANK_KEY: Record<Rank, Key> = { Perfect: 'rank.perfect', Excellent: 'rank.excellent', Solid: 'rank.solid',
  'Getting there': 'rank.getting', 'Worth another pass': 'rank.again' };
import { useI18n } from '../i18n/useI18n';
import type { Key } from '../i18n/strings';
import { askableIn, nameOf, useAnatomyNames } from '../i18n/anatomyNames';

const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-atlas');

/** Where the schedule lives inside the cartridge's host-side mirror. */
const KEY = 'review';

type Store =
  | { kind: 'loading' }
  | { kind: 'ready'; state: ReviewState }
  | { kind: 'unsaved'; state: ReviewState; why: string };

type Saving =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; vault: string; unlocked: boolean }
  | { kind: 'failed'; why: string };

interface Props {
  atlas: Atlas;
  /** 'male' | 'female' — travels into the chronicle so it reads on its own. */
  body: string;
  /** 'BodyParts3D' | 'HuBMAP HRA' — same reason. */
  source: string;
  onShow: (elements: string[]) => void;
  onInspect: (concept: Concept) => void;
  /** True while a run is on, so the shell can get out of the way. */
  onStudyingChange: (studying: boolean) => void;
  onClose: () => void;
}

export function ReviewPanel({ atlas, body, source, onShow, onInspect, onStudyingChange, onClose }: Props) {
  const [store, setStore] = useState<Store>({ kind: 'loading' });
  const [level, setLevel] = useState<Level | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answered, setAnswered] = useState<{ picked: string; correct: boolean } | null>(null);
  const [saving, setSaving] = useState<Saving>({ kind: 'idle' });
  const { t, lang } = useI18n();
  const names = useAnatomyNames(lang);
  const [noticeSeen, setNoticeSeen] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const storeState = (s: Store): ReviewState => (s.kind === 'loading' ? emptyState() : s.state);
  const held = storeState(store);
  const conceptById = new Map(atlas.concepts.map((c) => [c.id, c]));
  const levels = levelsOf(atlas);
  // A system is named from the strings table, keyed by its id. `lv.name` is
  // the English label anatomy.ts carries for the 3D layers panel; using it
  // here would put one English word inside a translated tile.
  const levelName = (lv: Level) => (lv.id === ALL_LEVEL ? t('level.all') : t(`system.${lv.id}` as Key));
  const refusal = (lv: Level) => { const v = canStudy(lv); return v.ok ? '' : t(v.why === 'empty' ? 'review.empty' : 'review.tooSmall', { n: v.n }); };
  const askedIds = new Set(run?.answers.map((a) => a.id) ?? []);
  const finished = !!run && isComplete(run);

  // The shell hides its own panels while a run is on, and gets them back the
  // moment it ends — including on unmount, or closing the cartridge mid-run
  // would leave the window stripped with no way to bring the controls back.
  useEffect(() => {
    onStudyingChange(!!run && !finished);
    return () => onStudyingChange(false);
  }, [run, finished, onStudyingChange]);

  // ── the schedule ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    sdk.invoke<Record<string, unknown>>('state.get')
      .then((data) => {
        if (cancelled || !alive.current) return;
        setStore({ kind: 'ready', state: parseState(data?.[KEY]) });
      })
      .catch((err: unknown) => {
        if (cancelled || !alive.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Never swallowed: a cartridge that fails quietly is indistinguishable
        // from one that is working.
        console.warn('[atlas] review state unavailable:', msg);
        setStore({
          kind: 'unsaved',
          state: emptyState(),
          why: msg.includes('No Mnemosyne host')
            ? t('review.noHost')
            : t('review.noLoad'),
        });
      });
    return () => { cancelled = true; };
  }, []);

  const write = (next: ReviewState) => {
    if (store.kind === 'unsaved') { setStore({ ...store, state: next }); return; }
    setStore({ kind: 'ready', state: next });
    sdk.invoke('state.set', { state: { [KEY]: next } }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[atlas] review state not saved:', msg);
      if (alive.current) setStore({ kind: 'unsaved', state: next, why: 'The last answers could not be saved.' });
    });
  };

  // ── asking ───────────────────────────────────────────────────────────────
  /**
   * The pool for a level, in the reader's language.
   *
   * Filtered, not translated-with-gaps: a question whose four options mix two
   * languages hands the answer to anyone who notices. Names are swapped here
   * too, so what the option says is what the tile counted.
   */
  const poolFor = useCallback((lv: Level) => askablePool(atlas, lv.systems)
    .filter((a) => askableIn(names, a.id))
    .map((a) => ({ ...a, name: nameOf(names, a.id, a.name) })), [atlas, names]);

  const ask = useCallback((lv: Level, state: ReviewState, asked: ReadonlySet<string>) => {
    const q = nextQuestion(poolFor(lv), state, Date.now(), (Math.random() * 2 ** 31) | 0, 4, asked);
    setAnswered(null);
    setQuestion(q);
    if (q) onShow(conceptById.get(q.subject.id)?.elements ?? []);
  }, [poolFor, onShow]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (len: RunLength) => {
    if (!level) return;
    setSaving({ kind: 'idle' });
    setRun(startRun(len, Date.now()));
    ask(level, held, new Set());
  };

  const backToLevels = () => {
    setLevel(null); setRun(null); setQuestion(null); setAnswered(null);
    onShow([]);
  };

  const answer = (picked: Askable) => {
    if (!question || answered || !run) return;
    const correct = picked.id === question.subject.id;
    setAnswered({ picked: picked.id, correct });

    const card = grade(held.cards[question.subject.id], correct, Date.now());
    const nextRun = record(run, { ...question.subject, correct, n: card.n });
    setRun(nextRun);
    // A new answer invalidates the receipt from the last save: the note on
    // disk no longer describes this run.
    setSaving({ kind: 'idle' });

    const best = Math.max(held.best ?? 0, nextRun.bestStreak);
    write({ v: 1, cards: { ...held.cards, [question.subject.id]: card }, best });
  };

  // ── filing the run as a memory ───────────────────────────────────────────
  const saveRun = async () => {
    if (!run) return;
    const scopeNames = (level?.systems ?? []).map((s) => SYSTEMS.find((x) => x.id === s)?.name ?? s);
    const note = sessionNote(run.answers, { body, source, scopeNames, now: Date.now() });
    if (!note) return; // nothing happened, so there is nothing to record
    setSaving({ kind: 'busy' });
    try {
      // Permissions are read when the app boots. A cartridge that gained
      // `vault:write` after that is refused everything, and the refusal comes
      // from a layer BELOW the consent dialog: the host checks the manifest it
      // holds in memory, which is the old one, and never gets as far as asking
      // the human. `permissions.refresh` makes it re-read the manifests from
      // disk and then ask — so the dialog appears on this gesture, which is
      // where it belongs. Measured: the first save after adding the permission
      // failed with "not been allowed to write to your memory" on a cartridge
      // whose manifest declared it.
      const refreshed = await sdk.invoke<{ granted?: Record<string, boolean> }>(
        'permissions.refresh', { permissions: ['vault:write'] },
      );
      if (refreshed?.granted?.['vault:write'] === false) {
        if (alive.current) {
          setSaving({ kind: 'failed', why: t('review.why.declined') });
        }
        return;
      }
      const { vault, unlocked } = await sdk.ensureSandbox();
      await sdk.socialIngest(vault, note, STUDY_SPINE);
      if (alive.current) setSaving({ kind: 'done', vault, unlocked });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[atlas] run not written to memory:', msg);
      if (!alive.current) return;
      // Three refusals, three sentences. Merged into one they send people to
      // fix the wrong thing, and two of the three are not their fault at all.
      setSaving({
        kind: 'failed',
        why: msg.includes('No Mnemosyne host')
          ? t('review.why.noHost')
          : /permission/i.test(msg)
            ? t('review.why.noPermission')
            : msg,
      });
    }
  };

  // ── what the numbers are allowed to say ──────────────────────────────────
  // `—` while nothing has been READ, not merely while loading. When the store
  // could not be reached, "Studied 0" is a claim about someone's history that
  // nobody measured.
  const known = store.kind === 'ready' || Object.keys(held.cards).length > 0;
  const p = store.kind !== 'loading' && known ? progress(held, Date.now()) : null;
  const size = store.kind !== 'loading' ? stateSize(held) : null;
  const subject = question ? conceptById.get(question.subject.id) : undefined;
  const stats = run ? runStats(run, Date.now()) : null;

  const screen: 'levels' | 'length' | 'run' | 'results' =
    !level ? 'levels' : !run ? 'length' : finished ? 'results' : 'run';

  return (
    <section className={`review-panel glass ${screen === 'run' || screen === 'results' ? 'wide' : ''}`} aria-label="Review">
      <div className="panel-heading">
        <span className="review-title">
          {level ? (
            <Button variant="ghost" className="review-back" onClick={backToLevels} aria-label={t('review.back')}>
              <ArrowLeft size={14} /> {levelName(level)}
            </Button>
          ) : (
            <><Brain size={14} /> {t('review.title')}</>
          )}
        </span>
        <Button variant="ghost" className="icon-button" onClick={onClose} aria-label={t('review.close')}><X size={18} /></Button>
      </div>

      {screen !== 'run' && (
        <div className="review-stats">
          <span>{t('review.studied')}<strong>{p ? p.seen.toLocaleString() : '—'}</strong></span>
          <span>{t('review.due')}<strong>{p ? p.due.toLocaleString() : '—'}</strong></span>
          <span>{t('review.mastered')}<strong>{p ? p.mastered.toLocaleString() : '—'}</strong></span>
          <span>{t('review.best')}<strong>{held.best === undefined ? '—' : held.best.toLocaleString()}</strong></span>
        </div>
      )}

      {store.kind === 'unsaved' && screen !== 'run' && <p className="review-note review-warn" role="status">{store.why}</p>}
      {size?.tight && screen !== 'run' && <p className="review-note review-warn">{t('review.tight')}</p>}

      {/* ── 0. the translation notice ─────────────────────────────────── */}
      {/* Shown before anything can be studied, because someone learning from a
          wrong name will not go looking for a disclaimer in an About panel.
          Once per language per session — not a wall, a fact. */}
      {names.translated && names.ready && !noticeSeen && (
        <div className="names-notice" role="note">
          <strong>{t('names.title')}</strong>
          <p>{t('names.body')}</p>
          <p>{t('names.pool', { n: names.count.toLocaleString() })}</p>
          <p className="names-help">{t('names.help')}</p>
          <Button className="primary-action" onClick={() => setNoticeSeen(true)}>{t('names.ok')}</Button>
        </div>
      )}

      {names.translated && !names.ready && <p className="review-note">{t('names.loading')}</p>}

      {/* ── 1. categories ─────────────────────────────────────────────── */}
      {screen === 'levels' && names.ready && (names.translated ? noticeSeen : true) && (
        <>
          <p className="review-note">{t('review.pick')}</p>
          <div className="review-tiles">
            {levels.map((lv) => {
              const lp = levelProgress(lv, atlas, held, Date.now());
              // The tile counts what the quiz can actually ask in this
              // language, so the number on screen is the number asked.
              const inLang = { ...lv, total: poolFor(lv).length };
              const v = canStudy(inLang);
              return (
                <button key={lv.id} type="button" className={`review-tile ${v.ok ? '' : 'locked'}`} disabled={!v.ok}
                  onClick={() => v.ok && setLevel(inLang)}>
                  <span className="tile-top">
                    <span className="tile-dot" style={{ background: lv.color }} />
                    <span className="tile-name">{levelName(lv)}</span>
                    {v.ok && lp.due > 0 && <span className="tile-due">{lp.due}</span>}
                  </span>
                  <span className="tile-bar"><i style={{ width: `${Math.round(lp.ratio * 100)}%`, background: lv.color }} /></span>
                  <span className="tile-foot">
                    {v.ok ? t('review.mastered.of', { done: known ? lp.mastered.toLocaleString() : '—', total: inLang.total.toLocaleString() }) : refusal(inLang)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── 2. how long ───────────────────────────────────────────────── */}
      {screen === 'length' && level && (
        <>
          <p className="review-prompt">{t('review.howMany')}</p>
          <div className="review-lengths">
            {LENGTHS.map((n) => (
              <Button variant="ghost" key={String(n)} className="review-length" onClick={() => begin(n)}>
                {lengthLabel(n) ?? t('review.endless')}
              </Button>
            ))}
          </div>
          <p className="review-note">
{t('review.scope', { n: level.total.toLocaleString(), level: levelName(level).toLowerCase() })}
          </p>
        </>
      )}

      {/* ── 3. the run ────────────────────────────────────────────────── */}
      {screen === 'run' && run && question && (
        <>
          <div className="run-bar">
            <span className="run-count">{run.answers.length + 1}{run.length !== null && <> / {run.length}</>}</span>
            <span className="run-track">
              <i style={{ width: run.length ? `${Math.round((run.answers.length / run.length) * 100)}%` : '0%' }} />
            </span>
            {run.streak >= 2 && <span className="run-streak"><Flame size={12} /> {run.streak}</span>}
          </div>

          <p className="review-prompt">{answered ? t('review.answerIs') : t('review.question')}</p>
          <div className="review-options">
            {question.options.map((o) => {
              const isAnswer = o.id === question.subject.id;
              const picked = answered?.picked === o.id;
              const cls = !answered ? '' : isAnswer ? 'right' : picked ? 'wrong' : 'faded';
              return (
                <Button variant="ghost" key={o.id} className={`review-option ${cls}`} disabled={!!answered} onClick={() => answer(o)}>
                  <span>{o.name}</span>
                  {answered && isAnswer && <Check size={14} />}
                  {answered && picked && !isAnswer && <X size={14} />}
                </Button>
              );
            })}
          </div>
          {answered && (
            <div className="review-after">
              <Button variant="ghost" className="review-inspect" onClick={() => subject && onInspect(subject)}>
                {t('review.lookAt')} <ChevronRight size={14} />
              </Button>
              <Button className="primary-action" onClick={() => ask(level!, held, askedIds)}>
                {t('review.next')} <ChevronRight size={16} />
              </Button>
            </div>
          )}
          {run.length === null && (
            <Button variant="ghost" className="review-inspect" onClick={() => setRun(endRun(run))}>
              {t('review.finishHere')}
            </Button>
          )}
        </>
      )}

      {screen === 'run' && !question && (
        <p className="review-note">{refusal(level!) || t('review.noQuestion')}</p>
      )}

      {/* ── 4. results ────────────────────────────────────────────────── */}
      {screen === 'results' && stats && run && (
        <div className="run-results">
          <div className="result-head">
            <strong className="result-score">{stats.right} / {stats.asked}</strong>
            {/* A run with nothing in it has no rank. Inventing one would pass
                judgement on someone who has not done anything yet. */}
            {rankOf(stats.accuracy) && <span className="result-rank">{t(RANK_KEY[rankOf(stats.accuracy)!])}</span>}
          </div>
          <div className="result-grid">
            <span>{t('review.accuracy')}<strong>{stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%`}</strong></span>
            <span>{t('review.best')}<strong>{stats.bestStreak}</strong></span>
            <span>{t('review.time')}<strong>{duration(stats.elapsedMs)}</strong></span>
          </div>
          {held.best !== undefined && held.best === stats.bestStreak && stats.bestStreak > 1 && (
            <p className="result-record"><Trophy size={12} /> {t('review.record')}</p>
          )}

          {stats.missed.length > 0 && (
            <div className="result-missed">
              <h3>{t('review.comeBack')}</h3>
              {stats.missed.slice(0, 12).map((m, i) => {
                const c = conceptById.get(m.id);
                return (
                  <Button variant="ghost" key={`${m.id}-${i}`} onClick={() => c && onInspect(c)}>
                    <span>{m.name}</span><ChevronRight size={13} />
                  </Button>
                );
              })}
              {stats.missed.length > 12 && <p className="review-note">{t('review.andMore', { n: stats.missed.length - 12 })}</p>}
            </div>
          )}

          <div className="result-actions">
            {saving.kind === 'done' ? (
              <p className="review-note review-saved">
                {t('review.saved', { vault: saving.vault })}
                {!saving.unlocked && t('review.savedLocked')}
              </p>
            ) : saving.kind === 'failed' ? (
              <>
                <p className="review-note review-warn" role="alert">{t('review.notWritten', { why: saving.why })}</p>
                <Button variant="ghost" className="review-save" onClick={saveRun}><Save size={14} /> {t('review.retry')}</Button>
              </>
            ) : (
              <Button variant="ghost" className="review-save" disabled={saving.kind === 'busy'} onClick={saveRun}>
                <Save size={14} /> {saving.kind === 'busy' ? t('review.saving') : t('review.save')}
              </Button>
            )}
            <div className="result-again">
              <Button className="primary-action" onClick={() => begin(run.length)}>
                <RotateCcw size={15} /> {t('review.again')}
              </Button>
              <Button variant="ghost" className="review-inspect" onClick={backToLevels}>{t('review.another')}</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ReviewPanel;
