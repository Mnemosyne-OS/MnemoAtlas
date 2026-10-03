import {describe, it, expect} from 'vitest';
import {themeFromQuery} from './theme';

describe('themeFromQuery', () => {
  it('reads the theme the host opened the frame with', () => {
    expect(themeFromQuery('?widget=x&theme=dark&lang=fr')).toBe('dark');
    expect(themeFromQuery('?theme=light')).toBe('light');
  });

  it('ignores anything else: no theme means stay light', () => {
    expect(themeFromQuery('')).toBeNull();
    expect(themeFromQuery('?theme=purple')).toBeNull();
  });
});
