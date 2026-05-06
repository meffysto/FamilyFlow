/**
 * Tests unitaires — lib/eval/rubric-helpers.ts + feature-flag.ts
 *
 * Phase 52-01 — Fonctions pures utilisées par le rubric déterministe :
 *   typeTokenRatio, countOccurrences, ngramOverlap, anonymizeStoryText, isEvalEnabled
 */

import {
  typeTokenRatio,
  countOccurrences,
  ngramOverlap,
  anonymizeStoryText,
} from '../rubric-helpers';
import { isEvalEnabled } from '../feature-flag';
import type { Profile } from '../../types';

function makeChild(name: string): Profile {
  return {
    id: name.toLowerCase(),
    name,
    role: 'enfant',
    avatar: '👶',
    points: 0,
    coins: 0,
    level: 1,
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
  } as unknown as Profile;
}

describe('typeTokenRatio', () => {
  it('retourne ~0.667 pour "le chat le chien le rat" (4 unique / 6 total)', () => {
    const r = typeTokenRatio('le chat le chien le rat');
    expect(r).toBeGreaterThan(0.65);
    expect(r).toBeLessThan(0.7);
  });

  it('retourne 0 sur entrée vide (pas de division par zéro)', () => {
    expect(typeTokenRatio('')).toBe(0);
    expect(typeTokenRatio('   ')).toBe(0);
  });

  it('lowercase pour ne pas distinguer "Le" et "le"', () => {
    const r = typeTokenRatio('Le chat Le chat');
    // 2 unique / 4 total = 0.5
    expect(r).toBeCloseTo(0.5, 2);
  });

  it('gère les accents FR (à, ç, é, ÿ) sans crash', () => {
    const r = typeTokenRatio('forêt enchantée doucement');
    expect(r).toBe(1); // tous uniques
  });

  it('ignore la ponctuation pure', () => {
    const r = typeTokenRatio('chat , chat .');
    // tokens valides : "chat" "chat" → 1 unique / 2 total = 0.5
    expect(r).toBeCloseTo(0.5, 2);
  });
});

describe('countOccurrences', () => {
  it('compte 3 occurrences de "doucement" (case insensitive)', () => {
    const text = 'doucement, tout doucement, tout doucement';
    expect(countOccurrences(text, /\bdoucement\b/gi)).toBe(3);
  });

  it('retourne 0 si aucun match', () => {
    expect(countOccurrences('rien à voir', /\bdoucement\b/gi)).toBe(0);
  });

  it('lance une erreur si la regex n\'est pas global', () => {
    expect(() => countOccurrences('foo', /foo/i)).toThrow(/global/);
  });
});

describe('ngramOverlap', () => {
  it('overlap > 0 quand 3-grams communs', () => {
    const r = ngramOverlap('le petit chat dort', 'le petit chat ronfle', 3);
    expect(r).toBeGreaterThan(0);
  });

  it('overlap = 0 si aucun 3-gram commun', () => {
    expect(ngramOverlap('a b c d', 'x y z w', 3)).toBe(0);
  });

  it('lowercase + strip prénoms enfants connus avant comparaison', () => {
    // Avec le strip, les deux phrases deviennent "enfant marche dans la forêt"
    // donc overlap quasi-total
    const a = 'Lucas marche dans la forêt';
    const b = 'Emma marche dans la forêt';
    const r = ngramOverlap(a, b, 3, ['Lucas', 'Emma']);
    expect(r).toBe(1);
  });

  it('sans strip de prénoms, deux phrases avec prénoms différents ont moins d\'overlap', () => {
    const a = 'Lucas marche dans la forêt';
    const b = 'Emma marche dans la forêt';
    const r = ngramOverlap(a, b, 3);
    // 3-grams de A: "lucas marche dans","marche dans la","dans la forêt"
    // 3-grams de B: "emma marche dans","marche dans la","dans la forêt"
    // intersection: 2/3
    expect(r).toBeCloseTo(2 / 3, 2);
  });

  it('retourne 0 si A est vide', () => {
    expect(ngramOverlap('', 'foo bar baz', 3)).toBe(0);
  });
});

describe('anonymizeStoryText', () => {
  it('remplace le prénom de l\'enfant par "Enfant"', () => {
    const child = makeChild('Lucas');
    const text = 'Lucas marche dans la forêt. Lucas est content.';
    const out = anonymizeStoryText(text, child);
    expect(out).not.toMatch(/Lucas/);
    expect(out).toMatch(/Enfant marche/);
    expect(out.match(/Enfant/g)?.length).toBe(2);
  });

  it('case-insensitive (LUCAS, lucas, Lucas)', () => {
    const child = makeChild('Lucas');
    const text = 'LUCAS et lucas';
    const out = anonymizeStoryText(text, child);
    expect(out).not.toMatch(/[Ll][Uu][Cc][Aa][Ss]/);
  });

  it('retourne le texte inchangé si pas de prénom', () => {
    const child = { ...makeChild(''), name: '' } as Profile;
    const text = 'rien à anonymiser';
    expect(anonymizeStoryText(text, child)).toBe(text);
  });
});

describe('isEvalEnabled (EVAL-07)', () => {
  it('retourne false par défaut — flag off ⇒ baseline strict', () => {
    expect(isEvalEnabled()).toBe(false);
  });
});
