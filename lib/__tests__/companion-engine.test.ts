/**
 * companion-engine.test.ts — Tests du moteur compagnon
 */

import {
  getCompanionStage,
  getCompanionMood,
  getCompanionXpBonus,
  pickCompanionMessage,
  MESSAGE_TEMPLATES,
  computeMoodScore,
  detectProactiveEvent,
  generateCompanionAIMessage,
  getRemainingAIBudget,
  _resetCacheForTests,
} from '../mascot/companion-engine';
import {
  COMPANION_STAGES,
  COMPANION_SPECIES_CATALOG,
  COMPANION_UNLOCK_LEVEL,
  COMPANION_XP_BONUS,
  SPECIES_PERSONALITY,
  type CompanionData,
} from '../mascot/companion-types';

beforeEach(() => {
  _resetCacheForTests();
});

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

// ─── getCompanionMood (API rétrocompatible) ─────────────────────────────────

describe('getCompanionMood', () => {
  it('retourne triste si inactif depuis plus de 48h', () => {
    expect(getCompanionMood(0, 50)).toBe('triste');
  });

  it('retourne triste si 2 taches mais 50h depuis activite', () => {
    expect(getCompanionMood(2, 50)).toBe('triste');
  });

  it('retourne content si actif (peu de taches, heure diurne)', () => {
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
    expect(getCompanionMood(5, 1, 23)).toBe('excite');
  });
});

// ─── computeMoodScore (mood dynamique) ──────────────────────────────────────

describe('computeMoodScore', () => {
  it('retourne excite avec score élevé quand beaucoup de tâches + streak', () => {
    const result = computeMoodScore({
      recentTasksCompleted: 5,
      hoursSinceLastActivity: 1,
      currentHour: 10,
      streak: 7,
    });
    expect(result.mood).toBe('excite');
    expect(result.score).toBeGreaterThanOrEqual(8);
  });

  it('retourne triste si >48h inactif (cas absolu)', () => {
    const result = computeMoodScore({
      recentTasksCompleted: 0,
      hoursSinceLastActivity: 50,
      currentHour: 10,
    });
    expect(result.mood).toBe('triste');
  });

  it('bonus gratitude augmente le score', () => {
    const sans = computeMoodScore({
      recentTasksCompleted: 3,
      hoursSinceLastActivity: 1,
      currentHour: 10,
    });
    const avec = computeMoodScore({
      recentTasksCompleted: 3,
      hoursSinceLastActivity: 1,
      currentHour: 10,
      hasGratitudeToday: true,
    });
    expect(avec.score).toBeGreaterThan(sans.score);
  });

  it('tâches en retard diminuent le score', () => {
    const sans = computeMoodScore({
      recentTasksCompleted: 2,
      hoursSinceLastActivity: 1,
      currentHour: 10,
    });
    const avec = computeMoodScore({
      recentTasksCompleted: 2,
      hoursSinceLastActivity: 1,
      currentHour: 10,
      hasOverdueTasks: true,
    });
    expect(avec.score).toBeLessThan(sans.score);
  });
});

// ─── getCompanionXpBonus ─────────────────────────────────────────────────────

describe('getCompanionXpBonus', () => {
  const mockCompanion: CompanionData = {
    activeSpecies: 'chat',
    name: 'Minou',
    unlockedSpecies: ['chat'],
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

  it('retourne une string non-vide pour les nouveaux événements', () => {
    const newEvents = [
      'routine_completed', 'budget_alert', 'meal_planned',
      'gratitude_written', 'photo_added', 'defi_completed',
      'family_milestone', 'weekly_recap', 'morning_greeting',
      'gentle_nudge', 'comeback', 'celebration',
    ] as const;
    for (const event of newEvents) {
      const msg = pickCompanionMessage(event, context);
      expect(msg).toMatch(/^companion\.msg\./);
    }
  });
});

// ─── detectProactiveEvent ───────────────────────────────────────────────────

describe('detectProactiveEvent', () => {
  const baseCtx = {
    hoursSinceLastVisit: 2,
    currentHour: 10,
    tasksToday: 3,
    totalTasksToday: 5,
    streak: 3,
    hasGratitudeToday: false,
    hasMealsPlanned: true,
    isFirstVisitToday: false,
  };

  it('retourne comeback si >24h absence', () => {
    expect(detectProactiveEvent({ ...baseCtx, hoursSinceLastVisit: 30 })).toBe('comeback');
  });

  it('retourne morning_greeting le matin à la première visite', () => {
    expect(detectProactiveEvent({
      ...baseCtx,
      isFirstVisitToday: true,
      currentHour: 8,
    })).toBe('morning_greeting');
  });

  it('retourne null si rien de spécial', () => {
    expect(detectProactiveEvent(baseCtx)).toBeNull();
  });

  it('retourne celebration si streak multiple de 7 à la première visite (hors matin)', () => {
    expect(detectProactiveEvent({ ...baseCtx, streak: 14, isFirstVisitToday: true, currentHour: 13 })).toBe('celebration');
  });

  it('retourne null si streak multiple de 7 mais pas première visite', () => {
    expect(detectProactiveEvent({ ...baseCtx, streak: 14, isFirstVisitToday: false })).toBeNull();
  });

  it('retourne gentle_nudge l\'après-midi sans tâches faites (première visite)', () => {
    expect(detectProactiveEvent({
      ...baseCtx,
      currentHour: 15,
      tasksToday: 0,
      totalTasksToday: 3,
      isFirstVisitToday: true,
    })).toBe('gentle_nudge');
  });
});

// ─── Cache intelligent + budget ─────────────────────────────────────────────

describe('cache intelligent et budget', () => {
  it('budget commence à DAILY_AI_BUDGET', () => {
    expect(getRemainingAIBudget()).toBe(15);
  });

  it('utilise le cache au second appel même contexte', async () => {
    let callCount = 0;
    const mockAI = async () => { callCount++; return 'Message IA'; };
    const ctx = {
      profileName: 'Lucas',
      companionName: 'Minou',
      companionSpecies: 'chat' as const,
      tasksToday: 3,
      streak: 5,
      level: 10,
    };

    const msg1 = await generateCompanionAIMessage('greeting', ctx, mockAI);
    const msg2 = await generateCompanionAIMessage('greeting', ctx, mockAI);

    expect(msg1).toBe('Message IA');
    expect(msg2).toBe('Message IA');
    expect(callCount).toBe(1); // un seul appel IA
  });

  it('retourne fallback si aiCall est null', async () => {
    const ctx = {
      profileName: 'Lucas',
      companionName: 'Minou',
      companionSpecies: 'chat' as const,
      tasksToday: 3,
      streak: 5,
      level: 10,
    };

    const msg = await generateCompanionAIMessage('greeting', ctx, null);
    expect(msg).toMatch(/^companion\.msg\./);
  });

  it('retourne fallback si IA échoue', async () => {
    const mockAI = async () => { throw new Error('API down'); };
    const ctx = {
      profileName: 'Lucas',
      companionName: 'Minou',
      companionSpecies: 'chat' as const,
      tasksToday: 3,
      streak: 5,
      level: 10,
    };

    const msg = await generateCompanionAIMessage('greeting', ctx, mockAI);
    expect(msg).toMatch(/^companion\.msg\./);
  });
});

// ─── Personnalité par espèce ────────────────────────────────────────────────

describe('personnalité par espèce', () => {
  it('chaque espèce a une personnalité définie', () => {
    const species = ['chat', 'chien', 'lapin', 'renard', 'herisson'] as const;
    for (const s of species) {
      const p = SPECIES_PERSONALITY[s];
      expect(p.tone).toBeTruthy();
      expect(p.traits.length).toBeGreaterThanOrEqual(2);
      expect(p.quirk).toBeTruthy();
    }
  });

  it('les personnalités sont toutes différentes', () => {
    const tones = Object.values(SPECIES_PERSONALITY).map(p => p.tone);
    const unique = new Set(tones);
    expect(unique.size).toBe(tones.length);
  });
});

// ─── Constantes ──────────────────────────────────────────────────────────────

describe('constantes compagnon', () => {
  it('COMPANION_UNLOCK_LEVEL === 1', () => {
    expect(COMPANION_UNLOCK_LEVEL).toBe(1);
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

  it('MESSAGE_TEMPLATES couvre tous les evenements de base', () => {
    const events = ['task_completed', 'loot_opened', 'level_up', 'greeting', 'streak_milestone', 'harvest', 'craft'];
    events.forEach(evt => {
      expect(MESSAGE_TEMPLATES).toHaveProperty(evt);
      const templates = MESSAGE_TEMPLATES[evt as keyof typeof MESSAGE_TEMPLATES];
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('MESSAGE_TEMPLATES couvre les nouveaux evenements', () => {
    const newEvents = [
      'routine_completed', 'budget_alert', 'meal_planned',
      'gratitude_written', 'photo_added', 'defi_completed',
      'family_milestone', 'weekly_recap', 'morning_greeting',
      'gentle_nudge', 'comeback', 'celebration',
    ];
    newEvents.forEach(evt => {
      expect(MESSAGE_TEMPLATES).toHaveProperty(evt);
      const templates = MESSAGE_TEMPLATES[evt as keyof typeof MESSAGE_TEMPLATES];
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(2);
    });
  });
});
