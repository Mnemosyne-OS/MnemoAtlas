import {describe, expect, it} from 'vitest';
import {findNamed, matchNamed, nameWords, type Named} from './agentFind';

const entry = (id: string, ...names: string[]): Named<string> => ({item: id, id, names: [id, ...names], label: names[0] ?? id});
const SYSTEMS = [entry('skeletal', 'Squelette', 'Skeleton'), entry('nervous', 'Système nerveux', 'Nervous system'), entry('arterial', 'Artères', 'Arteries')];
const OPTIONS = [entry('FMA7197', 'Foie', 'liver'), entry('FMA1', 'Lobe droit du foie'), entry('FMA2', 'Lobe gauche du foie'), entry('FMA7148', 'Estomac', 'stomach')];
const kind = {code: 'NO_OPTION', noun: 'choice'};

describe('a name said the way a person says it', () => {
  it('folds case, accents, the ligature, fillers and a plural, and takes « système » for no word', () => {
    expect(nameWords("Irina, c'est le Foie")).toEqual(['foie']);
    expect(nameWords('I think it is the LIVER')).toEqual(['liver']);
    expect(nameWords('les artères')).toEqual(['artere']);
    expect(nameWords('le cœur')).toEqual(['coeur']);
    expect(nameWords('système nerveux')).toEqual(['nerveu']);
  });

  it('an id, the whole name, every word of it, or its English name', () => {
    expect(findNamed(SYSTEMS, 'skeletal', {code: 'NO_SYSTEM', noun: 'system'})).toBe('skeletal');
    expect(findNamed(SYSTEMS, 'le système nerveux', {code: 'NO_SYSTEM', noun: 'system'})).toBe('nervous');
    expect(findNamed(SYSTEMS, 'les artères', {code: 'NO_SYSTEM', noun: 'system'})).toBe('arterial');
    // « Foie » is a whole name: it wins over the lobes that hold the word.
    expect(findNamed(OPTIONS, "c'est le foie", kind)).toBe('FMA7197');
    expect(findNamed(OPTIONS, 'the liver', kind)).toBe('FMA7197');
    expect(findNamed(OPTIONS, 'le lobe gauche', kind)).toBe('FMA2');
  });

  it('several matches are refused with their names, never the first taken', () => {
    expect(() => findNamed(OPTIONS, 'le lobe', kind)).toThrow('AMBIGUOUS: "le lobe" names several choices: Lobe droit du foie, Lobe gauche du foie; say which');
    expect(matchNamed(OPTIONS, 'lobe')).toEqual({kind: 'ambiguous', labels: ['Lobe droit du foie', 'Lobe gauche du foie']});
  });

  it('no match is refused with the names that exist; nothing said is a bad argument', () => {
    expect(() => findNamed(OPTIONS, 'le cœur', kind)).toThrow('NO_OPTION: no choice named "le cœur"; choices: Foie, Lobe droit du foie, Lobe gauche du foie, Estomac');
    expect(() => findNamed(OPTIONS, "c'est le", kind)).toThrow(/^NO_OPTION/);
    expect(() => findNamed(OPTIONS, '  ', kind)).toThrow(/^BAD_ARG/);
    expect(() => findNamed([], 'foie', kind)).toThrow('choices: none');
  });
});
