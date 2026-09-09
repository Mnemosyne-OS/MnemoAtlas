/**
 * The Mnemosyne seam: what this cartridge adds to the upstream viewer.
 *
 * A named anatomical structure carries an FMA identifier (`FMA14769`,
 * `hepatic artery`) that is stable across languages, spellings and sources.
 * That makes the 3D body a spatial INDEX into the human's own memory: select a
 * structure, and ask what you already know about it — your course notes, the
 * figures pulled out of your PDFs, the chronicle you wrote after a lecture.
 *
 * Three rules shape this panel, and each one was a decision, not a default.
 *
 * 1. IT IS A BUTTON, NOT A SUBSCRIPTION. `mnemosyne.query` is an LLM call with
 *    RAG attached (pluginCartridgeActions.ts → model.infer), so it costs a
 *    cloud inference on a cloud route. Firing one every time a bone is clicked
 *    would bill someone for browsing. A retrieval-only host action would let
 *    this panel fill itself in silently — that action does not exist today and
 *    is named as the follow-up in the doc, not faked here.
 *
 * 2. THE ANSWER IS BOUND TO THE STRUCTURE IT WAS ASKED ABOUT. Every state
 *    resets when `concept.id` changes. Showing the liver's answer under the
 *    heart's title is not a stale render, it is a fabricated fact about a
 *    human body, which is the single worst thing this surface could do.
 *
 * 3. THE THREE SILENCES ARE THREE DIFFERENT SENTENCES. "Opened outside the
 *    shell", "memory refused the request" and "your memory holds nothing about
 *    this structure" send a reader to three different next steps. Merged into
 *    one grey line, two of the three people are sent to fix the wrong thing —
 *    and the third, who simply has no notes yet, is told the feature is broken.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Brain, Loader2 } from 'lucide-react';
import { MnemoCartridgeSDK } from '@mnemosyne_os/cartridge-sdk';
import { Button } from '@/components/ui/button';
import { useI18n } from '../i18n/useI18n';

// Must match "name" in mnemo-plugin.json — the host keys permissions on it.
const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-atlas');

type Phase =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'answered'; text: string }
  | { kind: 'empty' }
  | { kind: 'no-host' }
  | { kind: 'failed'; message: string };

/** The host's own words for "you are not embedded" (cartridge-sdk index.ts). */
const NO_HOST = 'No Mnemosyne host';

export function AtlasMemory({ concept }: { concept: { id: string; name: string } | null }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  // Guards a reply that lands after the human has already moved to another
  // structure: the promise cannot be cancelled, so the ANSWER is dropped.
  const asked = useRef<string | null>(null);

  useEffect(() => {
    setPhase({ kind: 'idle' });
    asked.current = null;
  }, [concept?.id]);

  // The panel is unmounted with a request in flight every time the detail
  // sheet closes. Nothing to abort over postMessage, so mark the token dead.
  useEffect(() => () => { asked.current = null; }, []);

  if (!concept) return null;

  const ask = async () => {
    const token = concept.id;
    asked.current = token;
    setPhase({ kind: 'asking' });
    try {
      const result = await sdk.query(
        `What do my own notes say about the ${concept.name} (anatomical reference ${concept.id})? ` +
          `Answer only from my memory. If my memory holds nothing about it, say exactly: NOTHING IN MEMORY.`,
      );
      if (asked.current !== token) return;
      const text = (result?.text ?? result?.response ?? result?.content ?? result?.answer ?? '').trim();
      if (result?.success === false) {
        setPhase({ kind: 'failed', message: result.error || 'Memory did not answer.' });
        return;
      }
      // An empty reply and a "nothing found" reply are the same fact for the
      // reader, and neither is an error. Naming it is the whole point: silence
      // here means "no notes yet", never "this does not work".
      if (!text || /NOTHING IN MEMORY/i.test(text)) {
        setPhase({ kind: 'empty' });
        return;
      }
      setPhase({ kind: 'answered', text });
    } catch (err) {
      if (asked.current !== token) return;
      const message = err instanceof Error ? err.message : String(err);
      // Never swallowed: a cartridge that fails quietly is indistinguishable
      // from one that is thinking.
      console.warn('[atlas] memory query failed:', message);
      setPhase(message.includes(NO_HOST) ? { kind: 'no-host' } : { kind: 'failed', message });
    }
  };

  return (
    <div className="atlas-memory">
      <h3>
        <Brain size={14} /> {t('memory.title')}
      </h3>

      {phase.kind === 'idle' && (
        <>
          <Button variant="ghost" className="memory-ask" onClick={ask}>
            {t('memory.ask')} <ArrowUpRight size={14} />
          </Button>
          <p className="memory-note">
            {t('memory.note')}
          </p>
        </>
      )}

      {phase.kind === 'asking' && (
        <p className="memory-note memory-busy" role="status">
          <Loader2 size={14} className="spin" /> {t('memory.reading')}
        </p>
      )}

      {phase.kind === 'answered' && (
        <>
          <p className="memory-answer">{phase.text}</p>
          <Button variant="ghost" className="memory-ask" onClick={ask}>
            {t('memory.askAgain')}
          </Button>
        </>
      )}

      {phase.kind === 'empty' && (
        <>
          <p className="memory-note">{t('memory.nothing', { name: concept.name })}</p>
          <Button variant="ghost" className="memory-ask" onClick={ask}>
            {t('memory.askAgain')}
          </Button>
        </>
      )}

      {phase.kind === 'no-host' && (
        <p className="memory-note">{t('memory.outside')}</p>
      )}

      {phase.kind === 'failed' && (
        <>
          <p className="memory-note memory-error" role="alert">{t('memory.failed', { why: phase.message })}</p>
          <Button variant="ghost" className="memory-ask" onClick={ask}>
            {t('memory.tryAgain')}
          </Button>
        </>
      )}
    </div>
  );
}

export default AtlasMemory;
