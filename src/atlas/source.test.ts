import {describe, it, expect} from 'vitest';
import {SOURCE_URL, sourceUrlOf} from './source';

describe('sourceUrlOf', () => {
  it('credits each dataset with its own source', () => {
    expect(sourceUrlOf('FMA7088')).toBe(SOURCE_URL.bodyparts3d);
    expect(sourceUrlOf('HRA:VH_F_lungs')).toBe(SOURCE_URL.hra);
    expect(sourceUrlOf('ZNSCIATICN-LC')).toBe(SOURCE_URL.zAnatomy);
  });
});
