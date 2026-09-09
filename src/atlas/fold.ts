/**
 * fold.ts — the shape a search term has to be reduced to before it can match.
 *
 * Once the structure names are translated, the search has to survive a real
 * keyboard. A French reader types `coeur`, not `cœur`; `artere`, not `artère`.
 * Matching the raw string finds nothing and reads as a broken search rather
 * than as a missing ligature — the failure looks like the app, not like the
 * input.
 *
 * So: lowercase, strip diacritics, and expand the two Latin ligatures that a
 * standard layout has no key for. Both sides of the comparison go through it,
 * so `CŒUR` matches `coeur` and the other way round.
 *
 * ⚠️ Not a general normaliser. It does nothing for scripts without diacritics
 * (Chinese, Russian) and is not meant to: those readers type what they read.
 */
export function fold(s: string): string {
  return s
    .toLowerCase()
    // œ and æ decompose to nothing under NFD — they are single letters, not
    // an accented o or a, so they have to be spelled out by hand.
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
