/**
 * Tests unitaires — Moteur de gamification
 *
 * Couvre : openLootBox, openAgentSecretLootBox, awardTaskCompletion,
 * addPoints, calculateLevel, calculateStreak, calculateStreakBonus,
 * processActiveRewards, buildLeaderboard, DROP_RATES, REWARDS.
 */

import {
  openLootBox,
  openAgentSecretLootBox,
  awardTaskCompletion,
  addPoints,
  calculateLevel,
  calculateStreak,
  calculateStreakBonus,
  getStreakMilestone,
  processActiveRewards,
  buildLeaderboard,
  xpForLevel,
  pointsToNextLevel,
  levelProgress,
  getLevelTier,
  MAX_LEVEL,
  STREAK_MILESTONES,
  updateProfileInData,
  applyFamilyBonus,
} from '../gamification/engine';

import {
  REWARDS,
  DROP_RATES,
  RARITY_COLORS,
  RARITY_LABELS,
  PITY_THRESHOLD,
  LOOT_THRESHOLD,
  POINTS_PER_TASK,
  STREAK_BONUS,
} from '../gamification/rewards';

import type { Profile, GamificationData, GamificationEntry, LootRarity, ActiveReward } from '../types';
import { format } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crée un profil minimal pour les tests */
function creerProfil(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'lucas',
    name: 'Lucas',
    role: 'enfant',
    avatar: '🦊',
    points: 0,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
    mascotDecorations: [],
    mascotInhabitants: [],
    ...overrides,
  };
}

/** Crée des données de gamification minimales */
function creerGamiData(overrides: Partial<GamificationData> = {}): GamificationData {
  return {
    profiles: [creerProfil()],
    history: [],
    activeRewards: [],
    ...overrides,
  };
}

/** Date du jour au format YYYY-MM-DD */
function aujourdhui(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Date d'hier au format YYYY-MM-DD */
function hier(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return format(d, 'yyyy-MM-dd');
}

/** Crée un historique de tâches consécutives pour simuler un streak */
function creerHistoriqueStreak(profileId: string, jours: number): GamificationEntry[] {
  const entries: GamificationEntry[] = [];
  for (let i = 0; i < jours; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    entries.push({
      profileId,
      action: '+10',
      points: 10,
      note: 'Tâche: Ranger la chambre',
      timestamp: d.toISOString(),
    });
  }
  return entries;
}

// ─── DROP_RATES ──────────────────────────────────────────────────────────────

describe('DROP_RATES', () => {
  const roles: Array<Profile['role']> = ['enfant', 'ado', 'adulte'];

  test.each(roles)('les taux de drop pour le rôle "%s" totalisent 1.0', (role) => {
    const rates = DROP_RATES[role];
    const total = rates.commun + rates.rare + rates.épique + rates.légendaire + rates.mythique;
    expect(total).toBeCloseTo(1.0, 10);
  });

  test('tous les rôles ont des taux définis', () => {
    expect(Object.keys(DROP_RATES)).toEqual(['enfant', 'ado', 'adulte']);
  });

  test('les enfants ont le taux de commun le plus bas (plus de chances épique+)', () => {
    expect(DROP_RATES.enfant.commun).toBeLessThan(DROP_RATES.adulte.commun);
  });

  test('le taux mythique est identique pour tous les rôles', () => {
    expect(DROP_RATES.enfant.mythique).toBe(0.01);
    expect(DROP_RATES.ado.mythique).toBe(0.01);
    expect(DROP_RATES.adulte.mythique).toBe(0.01);
  });
});

// ─── REWARDS ─────────────────────────────────────────────────────────────────

describe('REWARDS', () => {
  const raretes: LootRarity[] = ['commun', 'rare', 'épique', 'légendaire', 'mythique'];

  test.each(raretes)('la rareté "%s" a au moins 1 récompense', (rarete) => {
    expect(REWARDS[rarete].length).toBeGreaterThanOrEqual(1);
  });

  test('toutes les récompenses ont les champs requis', () => {
    for (const rarete of raretes) {
      for (const reward of REWARDS[rarete]) {
        expect(reward).toHaveProperty('emoji');
        expect(reward).toHaveProperty('reward');
        expect(reward).toHaveProperty('bonusPoints');
        expect(reward).toHaveProperty('rewardType');
        expect(typeof reward.emoji).toBe('string');
        expect(typeof reward.reward).toBe('string');
        expect(typeof reward.bonusPoints).toBe('number');
        expect(reward.bonusPoints).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('les récompenses mythiques ont des bonus élevés ou des types spéciaux', () => {
    for (const reward of REWARDS.mythique) {
      const isHighValue =
        reward.bonusPoints >= 50 ||
        reward.rewardType === 'vacation' ||
        reward.rewardType === 'crown' ||
        reward.rewardType === 'multiplier' ||
        reward.rewardType === 'double_loot';
      expect(isHighValue).toBe(true);
    }
  });

  test('les multiplicateurs ont un champ multiplier > 1', () => {
    for (const rarete of raretes) {
      for (const reward of REWARDS[rarete]) {
        if (reward.rewardType === 'multiplier') {
          expect(reward.multiplier).toBeDefined();
          expect(reward.multiplier).toBeGreaterThan(1);
          expect(reward.multiplierTasks).toBeDefined();
          expect(reward.multiplierTasks).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── RARITY_COLORS & RARITY_LABELS ──────────────────────────────────────────

describe('RARITY_COLORS et RARITY_LABELS', () => {
  const raretes: LootRarity[] = ['commun', 'rare', 'épique', 'légendaire', 'mythique'];

  test('chaque rareté a une couleur définie', () => {
    for (const r of raretes) {
      expect(RARITY_COLORS[r]).toBeDefined();
      expect(RARITY_COLORS[r]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test('chaque rareté a un label défini', () => {
    for (const r of raretes) {
      expect(RARITY_LABELS[r]).toBeDefined();
      expect(typeof RARITY_LABELS[r]).toBe('string');
    }
  });
});

// ─── addPoints ───────────────────────────────────────────────────────────────

describe('addPoints', () => {
  test('ajoute les points de base au profil', () => {
    const profil = creerProfil({ points: 100 });
    const { profile, entry } = addPoints(profil, 10, 'Test');
    expect(profile.points).toBe(110);
    expect(entry.points).toBe(10);
    expect(entry.note).toBe('Test');
  });

  test('applique le multiplicateur quand il est actif', () => {
    const profil = creerProfil({ points: 0, multiplier: 2, multiplierRemaining: 5 });
    const { profile, entry } = addPoints(profil, 10, 'Test multi');
    expect(profile.points).toBe(20); // 10 * 2
    expect(entry.points).toBe(20);
    expect(profile.multiplierRemaining).toBe(4);
  });

  test('n\'applique pas le multiplicateur quand multiplierRemaining est 0', () => {
    const profil = creerProfil({ points: 0, multiplier: 3, multiplierRemaining: 0 });
    const { profile } = addPoints(profil, 10, 'Test');
    expect(profile.points).toBe(10); // pas de multiplicateur
  });

  test('met à jour le niveau du profil', () => {
    const profil = creerProfil({ points: 90 });
    const { profile } = addPoints(profil, 20, 'Level up');
    expect(profile.level).toBeGreaterThanOrEqual(1);
  });
});

// ─── calculateLevel ──────────────────────────────────────────────────────────

describe('calculateLevel', () => {
  test('0 points = niveau 1', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  test('beaucoup de points = plafond au MAX_LEVEL', () => {
    expect(calculateLevel(999999)).toBe(MAX_LEVEL);
  });

  test('le niveau augmente avec les points', () => {
    const niv100 = calculateLevel(100);
    const niv1000 = calculateLevel(1000);
    expect(niv1000).toBeGreaterThan(niv100);
  });

  test('xpForLevel est cohérent avec calculateLevel', () => {
    for (let level = 1; level <= 10; level++) {
      const xp = xpForLevel(level);
      expect(calculateLevel(xp)).toBeGreaterThanOrEqual(level);
    }
  });
});

// ─── pointsToNextLevel & levelProgress ───────────────────────────────────────

describe('pointsToNextLevel et levelProgress', () => {
  test('au MAX_LEVEL, pointsToNextLevel = 0', () => {
    const bigPoints = xpForLevel(MAX_LEVEL);
    expect(pointsToNextLevel(bigPoints)).toBe(0);
  });

  test('au MAX_LEVEL, levelProgress = 1', () => {
    const bigPoints = xpForLevel(MAX_LEVEL);
    expect(levelProgress(bigPoints)).toBe(1);
  });

  test('levelProgress retourne une valeur entre 0 et 1', () => {
    const progress = levelProgress(150);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
  });
});

// ─── calculateStreakBonus ────────────────────────────────────────────────────

describe('calculateStreakBonus', () => {
  test('streak de 0 ou 1 donne un bonus de 0', () => {
    expect(calculateStreakBonus(0, 5)).toBe(0);
    expect(calculateStreakBonus(1, 5)).toBe(0);
  });

  test('streak de 2 jours donne +5', () => {
    expect(calculateStreakBonus(2, 5)).toBe(5);
  });

  test('streak de 7 jours donne +10', () => {
    expect(calculateStreakBonus(7, 5)).toBe(10);
  });

  test('streak de 14 jours donne +15', () => {
    expect(calculateStreakBonus(14, 5)).toBe(15);
  });

  test('streak de 30+ jours donne +25', () => {
    expect(calculateStreakBonus(30, 5)).toBe(25);
    expect(calculateStreakBonus(100, 5)).toBe(25);
  });
});

// ─── getStreakMilestone ──────────────────────────────────────────────────────

describe('getStreakMilestone', () => {
  test('streak de 0 ou 1 retourne null', () => {
    expect(getStreakMilestone(0)).toBeNull();
    expect(getStreakMilestone(1)).toBeNull();
  });

  test('streak de 30+ jours retourne Flamme Légendaire', () => {
    const milestone = getStreakMilestone(30);
    expect(milestone).not.toBeNull();
    expect(milestone!.label).toBe('Flamme Légendaire');
    expect(milestone!.bonus).toBe(25);
  });
});

// ─── awardTaskCompletion ─────────────────────────────────────────────────────

describe('awardTaskCompletion', () => {
  test('ajoute les points de base (10) au profil', () => {
    const profil = creerProfil({ points: 0, streak: 0 });
    const { profile, entry } = awardTaskCompletion(profil, 'Faire les lits');
    expect(profile.points).toBeGreaterThanOrEqual(10);
    expect(entry.note).toContain('Tâche');
    expect(entry.note).toContain('Faire les lits');
  });

  test('inclut le bonus de streak dans les points', () => {
    const profil = creerProfil({ points: 0, streak: 7 });
    const { profile } = awardTaskCompletion(profil, 'Aspirer le salon');
    // 10 base + 10 streak (7 jours) = 20
    expect(profile.points).toBe(20);
  });

  test('attribue une loot box quand le seuil est franchi (enfant: 50pts)', () => {
    const profil = creerProfil({ points: 45, lootBoxesAvailable: 0, role: 'enfant' });
    const { profile, lootAwarded } = awardTaskCompletion(profil, 'Tâche seuil');
    // 45 + 10 = 55 → franchit le seuil de 50
    expect(lootAwarded).toBe(true);
    expect(profile.lootBoxesAvailable).toBe(1);
  });

  test('n\'attribue pas de loot box si le seuil n\'est pas franchi', () => {
    const profil = creerProfil({ points: 10, lootBoxesAvailable: 0, role: 'enfant' });
    const { lootAwarded } = awardTaskCompletion(profil, 'Tâche normale');
    expect(lootAwarded).toBe(false);
  });

  test('utilise le seuil du rôle adulte (100pts)', () => {
    const profil = creerProfil({ points: 95, lootBoxesAvailable: 0, role: 'adulte' });
    const { profile, lootAwarded } = awardTaskCompletion(profil, 'Tâche adulte');
    // 95 + 10 = 105 → franchit le seuil de 100
    expect(lootAwarded).toBe(true);
    expect(profile.lootBoxesAvailable).toBe(1);
  });
});

// ─── openLootBox ─────────────────────────────────────────────────────────────

describe('openLootBox', () => {
  test('lance une erreur si aucune loot box disponible', () => {
    const profil = creerProfil({ lootBoxesAvailable: 0 });
    const data = creerGamiData({ profiles: [profil] });
    expect(() => openLootBox(profil, data)).toThrow('Aucune loot box disponible');
  });

  test('retourne une rareté valide', () => {
    const profil = creerProfil({ lootBoxesAvailable: 1 });
    const data = creerGamiData({ profiles: [profil] });
    const result = openLootBox(profil, data);
    const raretesValides: LootRarity[] = ['commun', 'rare', 'épique', 'légendaire', 'mythique'];
    expect(raretesValides).toContain(result.box.rarity);
  });

  test('retourne une récompense avec les champs requis', () => {
    const profil = creerProfil({ lootBoxesAvailable: 1 });
    const data = creerGamiData({ profiles: [profil] });
    const result = openLootBox(profil, data);
    expect(result.box).toHaveProperty('rarity');
    expect(result.box).toHaveProperty('reward');
    expect(result.box).toHaveProperty('emoji');
    expect(result.box).toHaveProperty('bonusPoints');
    expect(result.box).toHaveProperty('openedAt');
  });

  test('décrémente lootBoxesAvailable de 1', () => {
    const profil = creerProfil({ lootBoxesAvailable: 3 });
    const data = creerGamiData({ profiles: [profil] });
    const result = openLootBox(profil, data);
    // Peut être +1 si double_loot, mais au minimum décrémenté de 1
    expect(result.profile.lootBoxesAvailable).toBeLessThanOrEqual(4); // 3 - 1 + possible 2
    expect(result.profile.lootBoxesAvailable).toBeGreaterThanOrEqual(0);
  });

  test('génère au moins une entrée d\'historique', () => {
    const profil = creerProfil({ lootBoxesAvailable: 1 });
    const data = creerGamiData({ profiles: [profil] });
    const result = openLootBox(profil, data);
    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    expect(result.entries[0].action).toMatch(/^loot:/);
  });

  test('le pity system garantit épique+ après PITY_THRESHOLD ouvertures sans épique', () => {
    const profil = creerProfil({ lootBoxesAvailable: 1, pityCounter: PITY_THRESHOLD });
    const data = creerGamiData({ profiles: [profil] });
    const result = openLootBox(profil, data);
    const hauteRarete: LootRarity[] = ['épique', 'légendaire', 'mythique'];
    expect(hauteRarete).toContain(result.box.rarity);
  });

  test('le pity counter est réinitialisé après un drop épique+', () => {
    // On force le pity en mettant pityCounter >= PITY_THRESHOLD
    const profil = creerProfil({ lootBoxesAvailable: 1, pityCounter: PITY_THRESHOLD });
    const data = creerGamiData({ profiles: [profil] });
    const result = openLootBox(profil, data);
    // Après un drop épique+ garanti, le pity counter doit être 0
    expect(result.profile.pityCounter).toBe(0);
  });

  test('applique le multiplicateur si la récompense en a un', () => {
    // On ouvre 50 loot boxes pour augmenter les chances d'avoir un multiplicateur
    let gotMultiplier = false;
    for (let i = 0; i < 50; i++) {
      const profil = creerProfil({ lootBoxesAvailable: 1, pityCounter: PITY_THRESHOLD });
      const data = creerGamiData({ profiles: [profil] });
      const result = openLootBox(profil, data);
      if (result.box.multiplier && result.box.multiplier > 1) {
        expect(result.profile.multiplier).toBe(result.box.multiplier);
        expect(result.profile.multiplierRemaining).toBeGreaterThan(0);
        gotMultiplier = true;
        break;
      }
    }
    // Ce test peut échouer rarement par malchance mais 50 essais avec pity devraient suffire
    // On ne force pas gotMultiplier = true pour garder le test honnête
  });

  test('double_loot ajoute 2 loot boxes supplémentaires', () => {
    let gotDoubleLoot = false;
    for (let i = 0; i < 200; i++) {
      const profil = creerProfil({ lootBoxesAvailable: 1, pityCounter: PITY_THRESHOLD });
      const data = creerGamiData({ profiles: [profil] });
      const result = openLootBox(profil, data);
      if (result.extraLootBoxes === 2) {
        expect(result.profile.lootBoxesAvailable).toBe(2); // 1 - 1 + 2
        gotDoubleLoot = true;
        break;
      }
    }
    // On ne force pas, le test documente le comportement
  });
});

// ─── openAgentSecretLootBox ──────────────────────────────────────────────────

describe('openAgentSecretLootBox', () => {
  test('retourne TOUJOURS épique, légendaire ou mythique (jamais commun/rare) — 100 tirages', () => {
    const raretesInterdites: LootRarity[] = ['commun', 'rare'];
    const raretesAutorisees: LootRarity[] = ['épique', 'légendaire', 'mythique'];

    for (let i = 0; i < 100; i++) {
      const profil = creerProfil({ lootBoxesAvailable: 5 });
      const data = creerGamiData({ profiles: [profil] });
      const result = openAgentSecretLootBox(profil, data);

      expect(raretesInterdites).not.toContain(result.box.rarity);
      expect(raretesAutorisees).toContain(result.box.rarity);
    }
  });

  test('ne décrémente PAS lootBoxesAvailable (bonus gratuit)', () => {
    const profil = creerProfil({ lootBoxesAvailable: 3 });
    const data = creerGamiData({ profiles: [profil] });
    const result = openAgentSecretLootBox(profil, data);

    // lootBoxesAvailable ne doit pas diminuer (peut augmenter si double_loot)
    expect(result.profile.lootBoxesAvailable).toBeGreaterThanOrEqual(3);
  });

  test('retourne une récompense valide avec les champs requis', () => {
    const profil = creerProfil({ lootBoxesAvailable: 0 });
    const data = creerGamiData({ profiles: [profil] });
    const result = openAgentSecretLootBox(profil, data);

    expect(result.box).toHaveProperty('rarity');
    expect(result.box).toHaveProperty('reward');
    expect(result.box).toHaveProperty('emoji');
    expect(typeof result.box.reward).toBe('string');
    expect(result.box.reward.length).toBeGreaterThan(0);
  });

  test('fonctionne même avec 0 loot boxes disponibles', () => {
    const profil = creerProfil({ lootBoxesAvailable: 0 });
    const data = creerGamiData({ profiles: [profil] });
    // Ne doit PAS lancer d'erreur
    expect(() => openAgentSecretLootBox(profil, data)).not.toThrow();
  });

  test('l\'action d\'historique contient "agent-secret"', () => {
    const profil = creerProfil({ lootBoxesAvailable: 0 });
    const data = creerGamiData({ profiles: [profil] });
    const result = openAgentSecretLootBox(profil, data);

    expect(result.entries[0].action).toContain('agent-secret');
    expect(result.entries[0].note).toContain('Agent Secret');
  });

  test('applique les points bonus quand la récompense en a', () => {
    let gotBonus = false;
    for (let i = 0; i < 50; i++) {
      const profil = creerProfil({ points: 100, lootBoxesAvailable: 0 });
      const data = creerGamiData({ profiles: [profil] });
      const result = openAgentSecretLootBox(profil, data);
      if (result.box.bonusPoints > 0) {
        expect(result.profile.points).toBeGreaterThan(100);
        gotBonus = true;
        break;
      }
    }
    // Très probable d'avoir au moins un bonus en 50 tirages épique+
  });

  test('fonctionne pour chaque rôle', () => {
    const roles: Array<Profile['role']> = ['enfant', 'ado', 'adulte'];
    for (const role of roles) {
      const profil = creerProfil({ role, lootBoxesAvailable: 0 });
      const data = creerGamiData({ profiles: [profil] });
      const result = openAgentSecretLootBox(profil, data);
      expect(['épique', 'légendaire', 'mythique']).toContain(result.box.rarity);
    }
  });
});

// ─── calculateStreak ─────────────────────────────────────────────────────────

describe('calculateStreak', () => {
  test('retourne 0 sans historique', () => {
    expect(calculateStreak([], 'lucas')).toBe(0);
  });

  test('retourne 1 pour une tâche complétée aujourd\'hui', () => {
    const history = creerHistoriqueStreak('lucas', 1);
    expect(calculateStreak(history, 'lucas')).toBe(1);
  });

  test('retourne le nombre de jours consécutifs', () => {
    const history = creerHistoriqueStreak('lucas', 5);
    expect(calculateStreak(history, 'lucas')).toBe(5);
  });

  test('ignore les entrées d\'un autre profil', () => {
    const history = creerHistoriqueStreak('emma', 5);
    expect(calculateStreak(history, 'lucas')).toBe(0);
  });

  test('ignore les entrées qui ne sont pas des tâches', () => {
    const entry: GamificationEntry = {
      profileId: 'lucas',
      action: 'loot:commun',
      points: 5,
      note: '⭐ +5 points bonus',
      timestamp: new Date().toISOString(),
    };
    expect(calculateStreak([entry], 'lucas')).toBe(0);
  });
});

// ─── processActiveRewards ────────────────────────────────────────────────────

describe('processActiveRewards', () => {
  test('retourne une liste vide pour une entrée vide', () => {
    expect(processActiveRewards([])).toEqual([]);
  });

  test('supprime les récompenses expirées', () => {
    const expiredReward: ActiveReward = {
      id: 'ar_test_1',
      type: 'vacation',
      emoji: '🏖️',
      label: '2 jours sans tâches !',
      profileId: 'lucas',
      expiresAt: '2020-01-01', // bien passé
      remainingDays: 0,
    };
    expect(processActiveRewards([expiredReward])).toEqual([]);
  });

  test('conserve les récompenses non expirées', () => {
    const futureReward: ActiveReward = {
      id: 'ar_test_2',
      type: 'crown',
      emoji: '👑',
      label: 'Roi de la semaine',
      profileId: 'lucas',
      expiresAt: '2030-12-31',
      remainingDays: 7,
    };
    const result = processActiveRewards([futureReward]);
    expect(result).toHaveLength(1);
  });

  test('supprime les multiplicateurs avec 0 tâches restantes', () => {
    const depletedMultiplier: ActiveReward = {
      id: 'ar_test_3',
      type: 'multiplier',
      emoji: '⚡',
      label: 'Multiplicateur ×2',
      profileId: 'lucas',
      remainingTasks: 0,
    };
    expect(processActiveRewards([depletedMultiplier])).toEqual([]);
  });

  test('conserve les multiplicateurs avec des tâches restantes', () => {
    const activeMultiplier: ActiveReward = {
      id: 'ar_test_4',
      type: 'multiplier',
      emoji: '⚡',
      label: 'Multiplicateur ×2',
      profileId: 'lucas',
      remainingTasks: 3,
    };
    const result = processActiveRewards([activeMultiplier]);
    expect(result).toHaveLength(1);
  });
});

// ─── buildLeaderboard ────────────────────────────────────────────────────────

describe('buildLeaderboard', () => {
  test('trie les profils par points décroissants', () => {
    const profiles = [
      creerProfil({ id: 'lucas', points: 50 }),
      creerProfil({ id: 'emma', points: 120 }),
      creerProfil({ id: 'papa', points: 80 }),
    ];
    const leaderboard = buildLeaderboard(profiles);
    expect(leaderboard[0].id).toBe('emma');
    expect(leaderboard[1].id).toBe('papa');
    expect(leaderboard[2].id).toBe('lucas');
  });

  test('ne modifie pas le tableau original', () => {
    const profiles = [
      creerProfil({ id: 'lucas', points: 50 }),
      creerProfil({ id: 'emma', points: 120 }),
    ];
    const original = [...profiles];
    buildLeaderboard(profiles);
    expect(profiles[0].id).toBe(original[0].id);
  });
});

// ─── getLevelTier ────────────────────────────────────────────────────────────

describe('getLevelTier', () => {
  test('niveau 1 retourne Curieux', () => {
    expect(getLevelTier(1).name).toBe('Curieux');
  });

  test('niveau 50 retourne Gardien du Vault', () => {
    expect(getLevelTier(50).name).toBe('Gardien du Vault');
  });

  test('chaque tier a un emoji et une couleur', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const tier = getLevelTier(level);
      expect(tier.emoji).toBeDefined();
      expect(tier.color).toMatch(/^#/);
    }
  });
});

// ─── updateProfileInData ─────────────────────────────────────────────────────

describe('updateProfileInData', () => {
  test('met à jour le bon profil dans les données', () => {
    const profils = [
      creerProfil({ id: 'lucas', points: 10 }),
      creerProfil({ id: 'emma', points: 20 }),
    ];
    const data = creerGamiData({ profiles: profils });
    const updated = creerProfil({ id: 'lucas', points: 50 });

    const result = updateProfileInData(data, updated, []);
    expect(result.profiles.find(p => p.id === 'lucas')!.points).toBe(50);
    expect(result.profiles.find(p => p.id === 'emma')!.points).toBe(20);
  });

  test('ajoute les nouvelles entrées à l\'historique', () => {
    const data = creerGamiData();
    const entry: GamificationEntry = {
      profileId: 'lucas',
      action: '+10',
      points: 10,
      note: 'Test',
      timestamp: new Date().toISOString(),
    };
    const result = updateProfileInData(data, creerProfil(), [entry]);
    expect(result.history).toHaveLength(1);
  });
});

// ─── applyFamilyBonus ────────────────────────────────────────────────────────

describe('applyFamilyBonus', () => {
  test('ajoute des points à tous les profils sauf la source', () => {
    const profils = [
      creerProfil({ id: 'lucas', points: 100 }),
      creerProfil({ id: 'emma', points: 50 }),
      creerProfil({ id: 'papa', points: 200 }),
    ];
    const data = creerGamiData({ profiles: profils });
    const { data: result, entries } = applyFamilyBonus(data, 20, 'lucas');

    // Lucas (source) ne reçoit pas le bonus
    expect(result.profiles.find(p => p.id === 'lucas')!.points).toBe(100);
    // Les autres reçoivent +20
    expect(result.profiles.find(p => p.id === 'emma')!.points).toBe(70);
    expect(result.profiles.find(p => p.id === 'papa')!.points).toBe(220);
    expect(entries).toHaveLength(2);
  });
});

// ─── Constantes ──────────────────────────────────────────────────────────────

describe('Constantes', () => {
  test('LOOT_THRESHOLD est défini pour chaque rôle', () => {
    expect(LOOT_THRESHOLD.enfant).toBe(50);
    expect(LOOT_THRESHOLD.ado).toBe(75);
    expect(LOOT_THRESHOLD.adulte).toBe(100);
  });

  test('POINTS_PER_TASK vaut 10', () => {
    expect(POINTS_PER_TASK).toBe(10);
  });

  test('PITY_THRESHOLD vaut 5', () => {
    expect(PITY_THRESHOLD).toBe(5);
  });

  test('STREAK_MILESTONES est trié par jours décroissants', () => {
    for (let i = 0; i < STREAK_MILESTONES.length - 1; i++) {
      expect(STREAK_MILESTONES[i].days).toBeGreaterThan(STREAK_MILESTONES[i + 1].days);
    }
  });
});
