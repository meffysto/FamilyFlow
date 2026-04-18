/**
 * Phase 38 (SPOR-13) — Tests fondations économie Sporée.
 * Privacy : noms génériques Lucas/Emma/parent1 uniquement (CLAUDE.md).
 */
import {
  SPOREE_MAX_INVENTORY,
  SPOREE_DROP_RATES,
  SPOREE_SHOP_PRICE,
  SPOREE_SHOP_DAILY_CAP,
  SPOREE_SHOP_MIN_TREE_STAGE,
  SPOREE_EXPEDITION_DROP_RATE,
  SPOREE_EXPEDITION_ELIGIBLE,
  classifyHarvestTier,
  rollSporeeDropOnHarvest,
  rollSporeeDropOnExpedition,
  tryIncrementSporeeCount,
  canBuySporee,
  applyDailyResetIfNeeded,
  getLocalDateKey,
  shouldGiftOnboardingSporee,
  rollWagerDropBack,
  DROP_BACK_CHANCE,
} from '../mascot/sporee-economy';

describe('Constantes économie Sporée (SPOR-08, SPOR-09)', () => {
  it('cap inventaire = 10', () => {
    expect(SPOREE_MAX_INVENTORY).toBe(10);
  });
  it('drop rates exactes 3/8/15%', () => {
    expect(SPOREE_DROP_RATES.base).toBe(0.03);
    expect(SPOREE_DROP_RATES.rare).toBe(0.08);
    expect(SPOREE_DROP_RATES.expedition).toBe(0.15);
  });
  it('shop : 400 feuilles, cap 2/jour, stade arbuste', () => {
    expect(SPOREE_SHOP_PRICE).toBe(400);
    expect(SPOREE_SHOP_DAILY_CAP).toBe(2);
    expect(SPOREE_SHOP_MIN_TREE_STAGE).toBe('arbuste');
  });
  it('expedition : 5% sur Pousse+, easy exclu', () => {
    expect(SPOREE_EXPEDITION_DROP_RATE).toBe(0.05);
    expect(SPOREE_EXPEDITION_ELIGIBLE).toEqual(['pousse', 'medium', 'hard', 'expert', 'legendary']);
    expect(SPOREE_EXPEDITION_ELIGIBLE).not.toContain('easy');
  });
});

describe('classifyHarvestTier', () => {
  it('carrot → base', () => expect(classifyHarvestTier('carrot')).toBe('base'));
  it('tomato → base', () => expect(classifyHarvestTier('tomato')).toBe('base'));
  it('orchidee → rare (dropOnly)', () => expect(classifyHarvestTier('orchidee')).toBe('rare'));
  it('rose_doree → rare', () => expect(classifyHarvestTier('rose_doree')).toBe('rare'));
  it('fleur_lave → expedition (expeditionExclusive)', () => expect(classifyHarvestTier('fleur_lave')).toBe('expedition'));
  it('cristal_noir → expedition', () => expect(classifyHarvestTier('cristal_noir')).toBe('expedition'));
  it('cropId inconnu → base par défaut', () => expect(classifyHarvestTier('inconnu_xyz')).toBe('base'));
});

describe('rollSporeeDropOnHarvest (SPOR-08, Math.random spy)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('base 3% : 0.02 → true', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.02);
    expect(rollSporeeDropOnHarvest('base')).toBe(true);
  });
  it('base 3% : 0.05 → false', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.05);
    expect(rollSporeeDropOnHarvest('base')).toBe(false);
  });
  it('rare 8% : 0.07 → true', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.07);
    expect(rollSporeeDropOnHarvest('rare')).toBe(true);
  });
  it('rare 8% : 0.09 → false', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.09);
    expect(rollSporeeDropOnHarvest('rare')).toBe(false);
  });
  it('expedition 15% : 0.14 → true', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.14);
    expect(rollSporeeDropOnHarvest('expedition')).toBe(true);
  });
  it('expedition 15% : 0.20 → false', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.20);
    expect(rollSporeeDropOnHarvest('expedition')).toBe(false);
  });
});

describe('rollSporeeDropOnExpedition (SPOR-08)', () => {
  afterEach(() => jest.restoreAllMocks());

  it("'easy' → toujours false (court-circuit, pas de roll)", () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(rollSporeeDropOnExpedition('easy')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("'pousse' 5% : 0.04 → true", () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.04);
    expect(rollSporeeDropOnExpedition('pousse')).toBe(true);
  });
  it("'pousse' 5% : 0.06 → false", () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.06);
    expect(rollSporeeDropOnExpedition('pousse')).toBe(false);
  });
  it("'legendary' 5% : 0.01 → true", () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.01);
    expect(rollSporeeDropOnExpedition('legendary')).toBe(true);
  });
});

describe('tryIncrementSporeeCount (cap 10, SPOR-09)', () => {
  it('9 + 1 → accepté, newCount=10', () => {
    expect(tryIncrementSporeeCount(9, 1)).toEqual({ accepted: true, newCount: 10 });
  });
  it('10 + 1 → refusé inventory_full', () => {
    expect(tryIncrementSporeeCount(10, 1)).toEqual({ accepted: false, newCount: 10, reason: 'inventory_full' });
  });
  it('0 + 3 → accepté newCount=3', () => {
    expect(tryIncrementSporeeCount(0, 3)).toEqual({ accepted: true, newCount: 3 });
  });
  it('qty par défaut = 1', () => {
    expect(tryIncrementSporeeCount(5).newCount).toBe(6);
  });
  it('clamp : 8 + 5 → accepté newCount=10 (partiel accepté, pas de débordement)', () => {
    expect(tryIncrementSporeeCount(8, 5)).toEqual({ accepted: true, newCount: 10 });
  });
});

describe('applyDailyResetIfNeeded (reset minuit local)', () => {
  it('today > lastReset → boughtToday reset à 0, lastReset=today', () => {
    expect(applyDailyResetIfNeeded(2, '2026-04-17', '2026-04-18')).toEqual({ boughtToday: 0, lastResetDate: '2026-04-18' });
  });
  it('today === lastReset → no-op', () => {
    expect(applyDailyResetIfNeeded(1, '2026-04-18', '2026-04-18')).toEqual({ boughtToday: 1, lastResetDate: '2026-04-18' });
  });
  it('lastReset vide → init today, reset à 0', () => {
    expect(applyDailyResetIfNeeded(0, '', '2026-04-18')).toEqual({ boughtToday: 0, lastResetDate: '2026-04-18' });
  });
});

describe('canBuySporee (matrice validation SPOR-08)', () => {
  const BASE: Parameters<typeof canBuySporee>[0] = {
    coins: 500,
    treeStage: 'arbre',
    boughtToday: 0,
    lastResetDate: '2026-04-18',
    today: '2026-04-18',
    sporeeCount: 5,
  };

  it('stade pousse → insufficient_stage', () => {
    expect(canBuySporee({ ...BASE, treeStage: 'pousse' })).toEqual({ ok: false, reason: 'insufficient_stage' });
  });
  it('stade graine → insufficient_stage', () => {
    expect(canBuySporee({ ...BASE, treeStage: 'graine' })).toEqual({ ok: false, reason: 'insufficient_stage' });
  });
  it('stade arbuste → OK (= min)', () => {
    expect(canBuySporee({ ...BASE, treeStage: 'arbuste' }).ok).toBe(true);
  });
  it('stade majestueux → OK (≥ arbuste)', () => {
    expect(canBuySporee({ ...BASE, treeStage: 'majestueux' }).ok).toBe(true);
  });
  it('coins 399 → insufficient_coins', () => {
    expect(canBuySporee({ ...BASE, coins: 399 })).toEqual({ ok: false, reason: 'insufficient_coins' });
  });
  it('boughtToday=2 (cap) même jour → daily_cap', () => {
    expect(canBuySporee({ ...BASE, boughtToday: 2 })).toEqual({ ok: false, reason: 'daily_cap' });
  });
  it('sporeeCount=10 → inventory_full (prioritaire sur cap et coins)', () => {
    expect(canBuySporee({ ...BASE, sporeeCount: 10 })).toEqual({ ok: false, reason: 'inventory_full' });
  });
  it('valide : projection nextCoins, nextBoughtToday, nextSporeeCount', () => {
    const res = canBuySporee({ ...BASE, coins: 500, boughtToday: 1, sporeeCount: 3 });
    expect(res.ok).toBe(true);
    expect(res.nextCoins).toBe(100);
    expect(res.nextBoughtToday).toBe(2);
    expect(res.nextSporeeCount).toBe(4);
    expect(res.nextLastResetDate).toBe('2026-04-18');
  });
  it('day change avec boughtToday=5 (corrupt state) → reset appliqué, achat accepté', () => {
    const res = canBuySporee({ ...BASE, boughtToday: 5, lastResetDate: '2026-04-17', today: '2026-04-18' });
    expect(res.ok).toBe(true);
    expect(res.nextBoughtToday).toBe(1);
    expect(res.nextLastResetDate).toBe('2026-04-18');
  });
});

describe('shouldGiftOnboardingSporee (cadeau transition 2→3)', () => {
  it('arbuste → arbre, jamais claimed : true', () => {
    expect(shouldGiftOnboardingSporee({ fromStage: 'arbuste', toStage: 'arbre', alreadyClaimed: false })).toBe(true);
  });
  it('arbuste → arbre, déjà claimed : false', () => {
    expect(shouldGiftOnboardingSporee({ fromStage: 'arbuste', toStage: 'arbre', alreadyClaimed: true })).toBe(false);
  });
  it('pousse → arbuste : false', () => {
    expect(shouldGiftOnboardingSporee({ fromStage: 'pousse', toStage: 'arbuste', alreadyClaimed: false })).toBe(false);
  });
  it('arbre → majestueux : false (stade 3 déjà dépassé)', () => {
    expect(shouldGiftOnboardingSporee({ fromStage: 'arbre', toStage: 'majestueux', alreadyClaimed: false })).toBe(false);
  });
  it('undefined stages : false', () => {
    expect(shouldGiftOnboardingSporee({ fromStage: undefined, toStage: undefined, alreadyClaimed: false })).toBe(false);
  });
});

describe('rollWagerDropBack (Phase 40 — drop-back 15% sur pari gagné)', () => {
  it('constante DROP_BACK_CHANCE = 0.15', () => {
    expect(DROP_BACK_CHANCE).toBe(0.15);
  });
  it('injection random=() => 0.1 → true (< 0.15)', () => {
    expect(rollWagerDropBack(() => 0.1)).toBe(true);
  });
  it('injection random=() => 0.15 → false (strictement <)', () => {
    expect(rollWagerDropBack(() => 0.15)).toBe(false);
  });
  it('injection random=() => 0.5 → false', () => {
    expect(rollWagerDropBack(() => 0.5)).toBe(false);
  });
  it('default Math.random utilisé si pas d\'injection', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(rollWagerDropBack()).toBe(true);
    spy.mockRestore();
  });
});

describe('getLocalDateKey (minuit LOCAL, pas UTC)', () => {
  it('retourne format YYYY-MM-DD avec padding zéros', () => {
    const d = new Date(2026, 0, 5); // 5 janvier 2026 LOCAL (month 0-indexed)
    expect(getLocalDateKey(d)).toBe('2026-01-05');
  });
  it('utilise getDate/getMonth/getFullYear (pas toISOString UTC)', () => {
    const d = new Date(2026, 3, 18); // 18 avril 2026 LOCAL
    expect(getLocalDateKey(d)).toBe('2026-04-18');
  });
});
