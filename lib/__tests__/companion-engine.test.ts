/**
 * companion-engine.test.ts — Tests du moteur compagnon
 * TDD: ces tests sont écrits avant l'implémentation
 */

import {
  getCompanionStage,
  getCompanionMood,
  getCompanionXpBonus,
  pickCompanionMessage,
  MESSAGE_TEMPLATES,
} from '../mascot/companion-engine';
import {
  COMPANION_STAGES,
  COMPANION_SPECIES_CATALOG,
  COMPANION_UNLOCK_LEVEL,
  COMPANION_XP_BONUS,
  type CompanionData,
} from '../mascot/companion-types';

// ─── getCompanionStage ────────────────────────────────────────────────────────

describe('getCompanionStage', () => {
  it('retourne bebe pour le niveau 1', () => {
    expect(getCompanionStage(1)).toBe('bebe');
  });

  it('retourne bebe pour le niveau 5 (max bebe)', () => {
    expect(getCompanionStage(5)).toBe('bebe');
  });

  it('retourne jeune pour le niveau 6 (min jeune)', () => {
    expect(getCompanionStage(6)).toBe('jeune');
  });

  it('retourne jeune pour le niveau 10 (max jeune)', () => {
    expect(getCompanionStage(10)).toBe('jeune');
  });

  it('retourne adulte pour le niveau 11 (min adulte)', () => {
    expect(getCompanionStage(11)).toBe('adulte');
  });

  it('retourne adulte pour le niveau 50', () => {
    expect(getCompanionStage(50)).toBe('adulte');
  });

  it('retourne bebe pour niveau 0 ou négatif', () => {
    expect(getCompanionStage(0)).toBe('bebe');
    expect(getCompanionStage(-1)).toBe('bebe');
  });
});

// ─── getCompanionMood ────────────────────────────────────────────────────────

describe('getCompanionMood', () => {
  it('retourne triste si inactif depuis plus de 48h', () => {
    // 0 taches, 50 heures depuis dernière activité
    expect(getCompanionMood(0, 50)).toBe('triste');
  });

  it('retourne triste si 2 taches mais 50h depuis activite', () => {
    expect(getCompanionMood(2, 50)).toBe('triste');
  });

  it('retourne content si actif (peu de taches, heure diurne)', () => {
    // 0 taches, 1h depuis activite (diurne — heure passee via currentHour=10)
    expect(getCompanionMood(0, 1, 10)).toBe('content');
  });

  it('retourne excite si 5 taches ou plus completees recemment', () => {
    expect(getCompanionMood(5, 1, 10)).toBe('excite');
    expect(getCompanionMood(6, 1, 10)).toBe('excite');
  });

  it('retourne endormi si heure nocturne (22h-7h)', () => {
    expect(getCompanionMood(0, 1, 23)).toBe('endormi');
    expect(getCompanionMood(0, 1, 2)).toBe('endormi');
    expect(getCompanionMood(0, 1, 7)).toBe('endormi');
  });

  it('retourne content a 8h (plus nocturne)', () => {
    expect(getCompanionMood(0, 1, 8)).toBe('content');
  });

  it('retourne excite prioritaire sur nuit si 5+ taches', () => {
    // 5 taches meme en nuit → excite (la recompense prime)
    expect(getCompanionMood(5, 1, 23)).toBe('excite');
  });
});

// ─── getCompanionXpBonus ─────────────────────────────────────────────────────

describe('getCompanionXpBonus', () => {
  const mockCompanion: CompanionData = {
    activeSpecies: 'chat',
    name: 'Minou',
    unlockedSpecies: ['chat'],
    mood: 'content',
  };

  it('retourne 1.05 si compagnon actif', () => {
    expect(getCompanionXpBonus(mockCompanion)).toBe(1.05);
  });

  it('retourne 1.0 si compagnon null', () => {
    expect(getCompanionXpBonus(null)).toBe(1.0);
  });

  it('retourne 1.0 si compagnon undefined', () => {
    expect(getCompanionXpBonus(undefined)).toBe(1.0);
  });
});

// ─── pickCompanionMessage ────────────────────────────────────────────────────

describe('pickCompanionMessage', () => {
  const context = {
    profileName: 'Lucas',
    companionName: 'Minou',
    companionSpecies: 'chat' as const,
    tasksToday: 3,
    streak: 5,
    level: 10,
  };

  it('retourne une string non-vide pour task_completed', () => {
    const msg = pickCompanionMessage('task_completed', context);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('retourne une string non-vide pour loot_opened', () => {
    const msg = pickCompanionMessage('loot_opened', context);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('retourne une string non-vide pour level_up', () => {
    const msg = pickCompanionMessage('level_up', context);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('retourne une string non-vide pour greeting', () => {
    const msg = pickCompanionMessage('greeting', context);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('retourne une cle i18n (commence par companion.msg.)', () => {
    const msg = pickCompanionMessage('task_completed', context);
    expect(msg).toMatch(/^companion\.msg\./);
  });
});

// ─── Constantes ──────────────────────────────────────────────────────────────

describe('constantes compagnon', () => {
  it('COMPANION_UNLOCK_LEVEL === 5', () => {
    expect(COMPANION_UNLOCK_LEVEL).toBe(5);
  });

  it('COMPANION_XP_BONUS === 1.05', () => {
    expect(COMPANION_XP_BONUS).toBe(1.05);
  });

  it('COMPANION_STAGES a exactement 3 entrees', () => {
    expect(COMPANION_STAGES).toHaveLength(3);
  });

  it('COMPANION_STAGES contient bebe, jeune, adulte', () => {
    const stages = COMPANION_STAGES.map(s => s.stage);
    expect(stages).toContain('bebe');
    expect(stages).toContain('jeune');
    expect(stages).toContain('adulte');
  });

  it('COMPANION_SPECIES_CATALOG a exactement 5 entrees', () => {
    expect(COMPANION_SPECIES_CATALOG).toHaveLength(5);
  });

  it('COMPANION_SPECIES_CATALOG contient chat, chien, lapin, renard, herisson', () => {
    const ids = COMPANION_SPECIES_CATALOG.map(s => s.id);
    expect(ids).toContain('chat');
    expect(ids).toContain('chien');
    expect(ids).toContain('lapin');
    expect(ids).toContain('renard');
    expect(ids).toContain('herisson');
  });

  it('MESSAGE_TEMPLATES couvre tous les evenements', () => {
    const events = ['task_completed', 'loot_opened', 'level_up', 'greeting', 'streak_milestone', 'harvest', 'craft'];
    events.forEach(evt => {
      expect(MESSAGE_TEMPLATES).toHaveProperty(evt);
      const templates = MESSAGE_TEMPLATES[evt as keyof typeof MESSAGE_TEMPLATES];
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(2);
    });
  });
});
