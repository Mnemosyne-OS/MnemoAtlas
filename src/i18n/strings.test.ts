/**
 * The rules that keep a translated interface from lying in a language nobody
 * on the team reads.
 */
import { describe, it, expect } from 'vitest';
import { LANGS, translate, isLang, type Key } from './strings';

describe('translation', () => {
  it('falls back to English rather than showing the key', () => {
    // A missing key rendered as `review.tooSmall` is the failure nobody
    // notices, because nobody on the team reads the locale it happens in.
    expect(translate('de', 'review.title')).toBe('Review');
    expect(translate('zh', 'rank.perfect')).toBe('Perfect');
  });

  it('fills placeholders', () => {
    expect(translate('fr', 'review.andMore', { n: 7 })).toContain('7');
    expect(translate('en', 'review.mastered.of', { done: 3, total: 91 })).toBe('3 / 91 mastered');
  });

  it('leaves an unknown placeholder visible instead of blanking it', () => {
    // `{total}` on screen gets reported. A silent gap does not.
    expect(translate('en', 'review.mastered.of', { done: 3 })).toContain('{total}');
  });

  it('keeps every placeholder a sentence needs, in every language that writes it', () => {
    // A translator who drops `{n}` produces a grammatical sentence with the
    // number missing — it reads fine and says nothing. This is the check that
    // catches it without anyone having to speak the language.
    const withVars: [Key, string[]][] = [
      ['review.mastered.of', ['done', 'total']],
      ['review.scope', ['n', 'level']],
      ['review.andMore', ['n']],
      ['review.tooSmall', ['n']],
      ['review.saved', ['vault']],
      ['review.notWritten', ['why']],
      ['memory.nothing', ['name']],
      ['memory.failed', ['why']],
    ];
    for (const lang of LANGS) {
      for (const [key, vars] of withVars) {
        const raw = translate(lang, key);
        for (const v of vars) {
          expect(raw, `${lang} / ${key} lost {${v}}`).toContain(`{${v}}`);
        }
      }
    }
  });

  it('recognises the locales the shell ships and nothing else', () => {
    for (const l of ['en', 'fr', 'es', 'de', 'pt', 'ru', 'zh']) expect(isLang(l)).toBe(true);
    for (const l of ['', 'klingon', 'FR', 'fr-CA', null, 42]) expect(isLang(l)).toBe(false);
  });
});
