import {describe, it, expect} from 'vitest';
import {searchConcepts, synonymsOf} from './search';
import type {Concept} from './anatomy';

const c = (id: string, name: string): Concept => ({id, name, elements: [id]});
const concepts = [
  c('FMA7309', 'right lung'),
  c('FMA7310', 'left lung'),
  c('FMA50735', 'right superior lobar bronchus'),
  c('FMA66326', 'pulmonary trunk'),
  c('FMA7088', 'heart'),
  // Shorter than « left lung »: only the tier split keeps it below the direct hits.
  c('FMA7396', 'bronchus'),
];

describe('searchConcepts', () => {
  it('finds the pieces of a lung that never say « lung »', () => {
    const names = searchConcepts(concepts, 'lung').map(x => x.name);
    expect(names).toContain('pulmonary trunk');
    expect(names).toContain('right superior lobar bronchus');
    expect(names).not.toContain('heart');
  });

  it('puts direct hits before synonym hits, even when a synonym hit is shorter', () => {
    const names = searchConcepts(concepts, 'lung').map(x => x.name);
    expect(names.slice(0, 2)).toEqual(['left lung', 'right lung']);
  });

  it('reaches the same table from French and Spanish, accents or not', () => {
    for (const q of ['poumon', 'pulmón', 'pulmon']) {
      expect(searchConcepts(concepts, q).map(x => x.name)).toContain('right superior lobar bronchus');
    }
  });

  it('searches the translated label when one is given', () => {
    const fr = (x: Concept) => (x.id === 'FMA7088' ? 'cœur' : x.name);
    expect(searchConcepts(concepts, 'coeur', fr).map(x => x.id)).toEqual(['FMA7088']);
    expect(searchConcepts(concepts, 'coeur')).toEqual([]);
  });

  it('adds nothing to a term without synonyms', () => {
    expect(searchConcepts(concepts, 'heart').map(x => x.name)).toEqual(['heart']);
    expect(synonymsOf('heart')).toEqual([]);
  });

  it('never lists a concept twice', () => {
    const ids = searchConcepts(concepts, 'bronch').map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns nothing for a blank term', () => {
    expect(searchConcepts(concepts, '   ')).toEqual([]);
  });
});
