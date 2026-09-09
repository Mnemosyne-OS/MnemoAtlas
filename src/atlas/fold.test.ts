import { describe, it, expect } from 'vitest';
import { fold } from './fold';

describe('folding a search term', () => {
  it('lets a normal keyboard find a ligature', () => {
    // The one that made this necessary: a French reader types `coeur`, the
    // atlas holds `cœur`, and the search found nothing at all.
    expect(fold('cœur')).toBe(fold('coeur'));
    expect(fold('CŒUR')).toBe(fold('coeur'));
  });

  it('lets an unaccented term find an accented name', () => {
    expect(fold('artère')).toBe(fold('artere'));
    expect(fold('œsophage')).toBe(fold('oesophage'));
    expect(fold('músculo')).toBe(fold('musculo'));
    expect(fold('vértebra')).toBe(fold('vertebra'));
  });

  it('handles æ, which decomposes to nothing on its own', () => {
    expect(fold('cæcum')).toBe(fold('caecum'));
  });

  it('leaves scripts without diacritics alone', () => {
    // Nothing to fold, and folding something here would be a silent change to
    // what a reader typed.
    expect(fold('心臓')).toBe('心臓');
    expect(fold('сердце')).toBe('сердце');
  });

  it('does not collapse two different words into one', () => {
    // Folding is for keyboards, not for spelling correction.
    expect(fold('artere')).not.toBe(fold('arteriole'));
    expect(fold('cote')).not.toBe(fold('cotes'));
  });
});
