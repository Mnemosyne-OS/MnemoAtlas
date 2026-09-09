/**
 * anatomyNames.ts — structure names in the reader's language, and the rule
 * that keeps a half-translated corpus from ruining the quiz.
 *
 * The names come from Wikidata, joined on the FMA identifier the atlas already
 * carries (`scripts/fetch-names.mjs`). Coverage is partial and always will be:
 * measured on the full male corpus, French reaches 1,231 of 3,432 structures
 * and Spanish 718. The female body has no FMA ids at all — its concepts are
 * `HRA:VH_F_*` — so it has no translations and none are coming from this
 * source.
 *
 * 🚨 THE RULE. A question offering four structures where two are French and
 * two are English hands the answer to anyone who notices, and the score stops
 * measuring anatomy. So the quiz asks ONLY about structures that have a name
 * in the current language. French is not "36% translated with English gaps",
 * it is a smaller, wholly French pool of 1,231 structures. The tiles count
 * that pool, so the number on screen is the number that will be asked.
 *
 * ⚠️ And none of it is certified. Wikidata renders `thorax` as `torse` in
 * French, which is a different structure. The notice says so once per language
 * and names English as the reference; it is not a disclaimer buried in an
 * About panel, because someone learning from a wrong name will not go looking.
 */
import { useEffect, useState } from 'react';
import { assetUrl } from '../atlas/asset-url';
import type { Lang } from './strings';

export type NameMap = Record<string, string>;

export interface AnatomyNames {
  /** FMA id → name in this language. Empty for English and for a missing file. */
  map: NameMap;
  /** False while the file is in flight — the quiz must not start on a half pool. */
  ready: boolean;
  /** How many structures this language can be asked about at all. */
  count: number;
  /** True when names are translated and therefore uncertified. */
  translated: boolean;
}

const EMPTY: AnatomyNames = { map: {}, ready: true, count: 0, translated: false };

/** In-memory so switching back and forth does not refetch. */
const cache = new Map<Lang, NameMap>();

export function useAnatomyNames(lang: Lang): AnatomyNames {
  const [state, setState] = useState<AnatomyNames>(() =>
    lang === 'en' ? EMPTY : { map: cache.get(lang) ?? {}, ready: cache.has(lang), count: Object.keys(cache.get(lang) ?? {}).length, translated: true });

  useEffect(() => {
    if (lang === 'en') { setState(EMPTY); return; }
    const known = cache.get(lang);
    if (known) {
      setState({ map: known, ready: true, count: Object.keys(known).length, translated: true });
      return;
    }
    let cancelled = false;
    setState({ map: {}, ready: false, count: 0, translated: true });
    fetch(assetUrl(`/names/${lang}.json`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((map: NameMap) => {
        if (cancelled) return;
        cache.set(lang, map);
        setState({ map, ready: true, count: Object.keys(map).length, translated: true });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A language with no file is not an error the reader caused, and it is
        // not a blank screen either: the atlas falls back to English names and
        // says nothing, which is what an untranslated corpus honestly is.
        console.warn('[atlas] no names for', lang, err instanceof Error ? err.message : err);
        cache.set(lang, {});
        setState({ map: {}, ready: true, count: 0, translated: true });
      });
    return () => { cancelled = true; };
  }, [lang]);

  return state;
}

/**
 * The name to show. Falls back to English, which is right for a detail panel
 * and NOT right for a quiz option — the quiz filters its pool instead, so it
 * never reaches this fallback.
 */
export function nameOf(names: AnatomyNames, id: string, english: string): string {
  return names.map[id] ?? english;
}

/** True when this structure can be asked about in the current language. */
export function askableIn(names: AnatomyNames, id: string): boolean {
  return !names.translated || id in names.map;
}
