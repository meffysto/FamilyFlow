/**
 * lib/__tests__/eval-frontmatter-roundtrip.test.ts — Phase 52-02 (EVAL-03)
 *
 * Garantit que les champs Phase 52 (quality_score, quality_dimensions,
 * quality_issues, quality_retried, quality_evaluated_at, llm_judge)
 * survivent à un cycle serialize → parse sans perte ni corruption.
 *
 * Critique : ces données vivent dans le vault Obsidian iCloud — toute
 * régression du parser corrompt durablement les histoires existantes.
 */

import { serializeBedtimeStory, parseBedtimeStory } from '../parser';
import type { BedtimeStory, StoryVoiceConfig } from '../types';

const baseVoice: StoryVoiceConfig = {
  engine: 'expo-speech',
  language: 'fr',
};

const baseStory: BedtimeStory = {
  id: 'test-1',
  titre: 'Test',
  enfant: 'Enfant 1',
  enfantId: 'enfant_1',
  univers: 'foret',
  texte: 'Une histoire de test pour le round-trip.',
  date: '2026-05-06',
  duree_lecture: 60,
  voice: baseVoice,
  version: 1,
  sourceFile: 'test-1.md',
};

describe('Phase 52 — Round-trip frontmatter quality_* (EVAL-03)', () => {
  it('story sans champs quality_* (legacy) round-trip propre, champs undefined', () => {
    const serialized = serializeBedtimeStory(baseStory);
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(parsed).not.toBeNull();
    expect(parsed?.quality_score).toBeUndefined();
    expect(parsed?.quality_dimensions).toBeUndefined();
    expect(parsed?.quality_issues).toBeUndefined();
    expect(parsed?.quality_retried).toBeUndefined();
    expect(parsed?.quality_evaluated_at).toBeUndefined();
    expect(parsed?.llm_judge).toBeUndefined();
  });

  it('non-régression : champs legacy préservés (titre, enfant, univers, date)', () => {
    const serialized = serializeBedtimeStory(baseStory);
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(parsed?.titre).toBe('Test');
    expect(parsed?.enfant).toBe('Enfant 1');
    expect(parsed?.enfantId).toBe('enfant_1');
    expect(parsed?.univers).toBe('foret');
    expect(parsed?.date).toBe('2026-05-06');
    expect(parsed?.texte).toBe('Une histoire de test pour le round-trip.');
  });

  it('story avec tous les champs quality_* round-trip avec valeurs identiques', () => {
    const story: BedtimeStory = {
      ...baseStory,
      quality_score: 8.5,
      quality_dimensions: {
        longueur: 3,
        fin_paisible: 3,
        vocabulaire: 2,
        anti_clones: 3,
        tags_tts: 3,
        coherence_saga: 3,
      },
      quality_issues: ['TTR 0.43 limite', '"doucement" x5'],
      quality_retried: false,
      quality_evaluated_at: '2026-05-06T20:14:32Z',
    };
    const serialized = serializeBedtimeStory(story);
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(parsed?.quality_score).toBe(8.5);
    expect(parsed?.quality_dimensions).toEqual(story.quality_dimensions);
    expect(parsed?.quality_issues).toEqual(story.quality_issues);
    expect(parsed?.quality_retried).toBe(false);
    expect(parsed?.quality_evaluated_at).toBe('2026-05-06T20:14:32Z');
  });

  it('quality_score sérialisé en number (pas string)', () => {
    const story: BedtimeStory = { ...baseStory, quality_score: 7 };
    const serialized = serializeBedtimeStory(story);
    expect(serialized).toContain('quality_score: 7');
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(typeof parsed?.quality_score).toBe('number');
    expect(parsed?.quality_score).toBe(7);
  });

  it('quality_issues vide n\'est pas sérialisé (rétrocompat lecture future)', () => {
    const story: BedtimeStory = { ...baseStory, quality_issues: [] };
    const serialized = serializeBedtimeStory(story);
    expect(serialized).not.toContain('quality_issues');
  });

  it('quality_dimensions partiel (1 dimension seule) round-trip OK', () => {
    const story: BedtimeStory = {
      ...baseStory,
      quality_dimensions: { longueur: 2 },
    };
    const serialized = serializeBedtimeStory(story);
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(parsed?.quality_dimensions).toEqual({ longueur: 2 });
  });

  it('quality_retried=true round-trip OK', () => {
    const story: BedtimeStory = { ...baseStory, quality_retried: true };
    const serialized = serializeBedtimeStory(story);
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(parsed?.quality_retried).toBe(true);
  });

  it('llm_judge round-trip avec justification contenant des quotes échappées', () => {
    const story: BedtimeStory = {
      ...baseStory,
      llm_judge: {
        rythme: 8,
        originalite: 7,
        charge_emotionnelle: 9,
        fluidite: 9,
        justification: 'Arc fluide, image "marquante" de l\'étoile.',
        evaluated_at: '2026-05-06T20:14:55Z',
      },
    };
    const serialized = serializeBedtimeStory(story);
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(parsed?.llm_judge).not.toBeUndefined();
    expect(parsed?.llm_judge?.rythme).toBe(8);
    expect(parsed?.llm_judge?.originalite).toBe(7);
    expect(parsed?.llm_judge?.charge_emotionnelle).toBe(9);
    expect(parsed?.llm_judge?.fluidite).toBe(9);
    expect(parsed?.llm_judge?.justification).toBe('Arc fluide, image "marquante" de l\'étoile.');
    expect(parsed?.llm_judge?.evaluated_at).toBe('2026-05-06T20:14:55Z');
  });

  it('frontmatter pré-Phase-52 (sans aucun champ quality_*) parse sans erreur', () => {
    const legacyContent = [
      '---',
      'title: Histoire ancienne',
      'enfant: Enfant 1',
      'enfant_id: enfant_1',
      'univers: foret',
      'date: 2026-01-15',
      'duree_lecture: 90',
      'voice_engine: expo-speech',
      'voice_language: fr',
      'version: 1',
      '---',
      '',
      '# Histoire ancienne',
      '',
      'Le contenu legacy.',
      '',
    ].join('\n');
    const parsed = parseBedtimeStory('legacy.md', legacyContent);
    expect(parsed).not.toBeNull();
    expect(parsed?.titre).toBe('Histoire ancienne');
    expect(parsed?.quality_score).toBeUndefined();
    expect(parsed?.quality_dimensions).toBeUndefined();
    expect(parsed?.llm_judge).toBeUndefined();
  });

  it('round-trip complet (legacy + quality_* + livre) sans perte croisée', () => {
    const story: BedtimeStory = {
      ...baseStory,
      detail: 'Détail spécial',
      length: 'moyenne',
      audioMode: 'doux',
      ambienceVolume: 0.4,
      livreId: 'mon-livre',
      livreTitre: 'Mon livre',
      chapitre: 2,
      chapitreTitre: 'Chapitre 2',
      personnages: ['hero', 'amie'],
      memorySummary: 'Le hero a rencontré l\'amie au lac.',
      trancheAge: '6-8',
      quality_score: 9.2,
      quality_dimensions: {
        longueur: 3, fin_paisible: 3, vocabulaire: 3,
        anti_clones: 3, tags_tts: 3, coherence_saga: 3,
      },
      quality_retried: true,
      quality_evaluated_at: '2026-05-06T20:30:00Z',
      llm_judge: {
        rythme: 9, originalite: 9, charge_emotionnelle: 9, fluidite: 10,
        justification: 'Excellent.',
        evaluated_at: '2026-05-06T20:30:05Z',
      },
    };
    const serialized = serializeBedtimeStory(story);
    const parsed = parseBedtimeStory('test-1.md', serialized);
    expect(parsed?.titre).toBe(story.titre);
    expect(parsed?.detail).toBe(story.detail);
    expect(parsed?.length).toBe('moyenne');
    expect(parsed?.audioMode).toBe('doux');
    expect(parsed?.ambienceVolume).toBe(0.4);
    expect(parsed?.livreId).toBe('mon-livre');
    expect(parsed?.chapitre).toBe(2);
    expect(parsed?.personnages).toEqual(['hero', 'amie']);
    expect(parsed?.memorySummary).toBe(story.memorySummary);
    expect(parsed?.trancheAge).toBe('6-8');
    expect(parsed?.quality_score).toBe(9.2);
    expect(parsed?.quality_dimensions).toEqual(story.quality_dimensions);
    expect(parsed?.quality_retried).toBe(true);
    expect(parsed?.llm_judge?.fluidite).toBe(10);
    expect(parsed?.llm_judge?.justification).toBe('Excellent.');
  });
});
