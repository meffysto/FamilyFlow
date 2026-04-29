/**
 * Phase 43-03 — Suite Jest exhaustive du moteur pur Auberge.
 *
 * Couvre les axes obligatoires (CONTEXT.md §Tests Jest) :
 *  - Spawn : éligibilité par stade, anti-spam PNJ 24h, cooldown global 6h, cap actifs.
 *  - Deliver : déduction items, reward, réputation +1 cap 5, items manquants.
 *  - Dismiss : pas de pénalité réputation, cooldown enregistré.
 *  - Expire : status='expired', −1 réputation floor 0.
 *  - Round-trip serializeAuberge / parseAuberge (état vide, multi-visiteurs, archive +7j).
 *  - Gating Comtesse à totalReputation ≥ 15.
 *  - Pitfall 4 (déjà-actif filtré), Pitfall 5 (silencieux), Pitfall 6 (id inconnu).
 *  - estimatedSellValue dispatch correct sur les 3 sources.
 *  - pickWeighted déterminisme avec rng mocké (via spawnVisitor).
 */
import {
  getEligibleVisitors,
  shouldSpawnVisitor,
  spawnVisitor,
  canDeliver,
  deliverVisitor,
  dismissVisitor,
  expireVisitors,
  getActiveVisitors,
  getReputation,
  getTotalReputation,
  isVisitorUnlocked,
  getRemainingMinutes,
  estimatedSellValue,
  serializeAuberge,
  parseAuberge,
} from '../mascot/auberge-engine';
import type {
  AubergeState,
  ActiveVisitor,
  VisitorReputation,
  VisitorRequestItem,
  FarmInventory,
  HarvestInventory,
  CraftedItem,
} from '../mascot/types';

// ─────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────

const FIXED_NOW = new Date('2026-04-29T12:00:00.000Z');

const emptyState = (): AubergeState => ({
  visitors: [],
  reputations: [],
  totalDeliveries: 0,
});

const makeReputation = (
  visitorId: string,
  level: number,
  lastSeenISO: string,
): VisitorReputation => ({
  visitorId,
  level,
  successCount: level,
  failureCount: 0,
  lastSeenAt: lastSeenISO,
});

const makeVisitor = (overrides: Partial<ActiveVisitor> = {}): ActiveVisitor => ({
  visitorId: 'hugo_boulanger',
  instanceId: 'vis_1',
  arrivedAt: '2026-04-28T12:00:00.000Z',
  deadlineAt: '2026-04-30T12:00:00.000Z',
  request: [
    { itemId: 'farine', source: 'building', quantity: 2 },
    { itemId: 'oeuf', source: 'building', quantity: 3 },
  ],
  status: 'active',
  rewardCoins: 500,
  ...overrides,
});

const emptyFarmInventory = (): FarmInventory => ({ oeuf: 0, lait: 0, farine: 0, miel: 0 });

// ─────────────────────────────────────────────
// shouldSpawnVisitor — cooldown global
// ─────────────────────────────────────────────

describe('shouldSpawnVisitor — cooldown global 6h', () => {
  it('refuse spawn si lastSpawnAt < 6h', () => {
    const state: AubergeState = { ...emptyState(), lastSpawnAt: '2026-04-29T07:00:01Z' }; // -5h
    expect(shouldSpawnVisitor(state, FIXED_NOW, 'pousse')).toBe(false);
  });

  it('autorise spawn si lastSpawnAt >= 6h', () => {
    const state: AubergeState = { ...emptyState(), lastSpawnAt: '2026-04-29T06:00:00Z' }; // -6h
    expect(shouldSpawnVisitor(state, FIXED_NOW, 'pousse')).toBe(true);
  });

  it('autorise spawn si lastSpawnAt absent', () => {
    expect(shouldSpawnVisitor(emptyState(), FIXED_NOW, 'pousse')).toBe(true);
  });

  it('refuse spawn au stade graine (cap 0)', () => {
    expect(shouldSpawnVisitor(emptyState(), FIXED_NOW, 'graine')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// shouldSpawnVisitor — cap actifs simultanés
// ─────────────────────────────────────────────

describe('shouldSpawnVisitor — cap actifs', () => {
  it('cap 1 atteint sur pousse → refuse', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [makeVisitor({ instanceId: 'vis_a' })],
    };
    expect(shouldSpawnVisitor(state, FIXED_NOW, 'pousse')).toBe(false);
  });

  it('cap 2 sur arbuste — 1 actif → autorise, 2 actifs → refuse', () => {
    const oneActive: AubergeState = {
      ...emptyState(),
      visitors: [makeVisitor({ instanceId: 'vis_a' })],
    };
    expect(shouldSpawnVisitor(oneActive, FIXED_NOW, 'arbuste')).toBe(true);
    const twoActive: AubergeState = {
      ...emptyState(),
      visitors: [
        makeVisitor({ instanceId: 'vis_a' }),
        makeVisitor({ instanceId: 'vis_b', visitorId: 'meme_lucette' }),
      ],
    };
    expect(shouldSpawnVisitor(twoActive, FIXED_NOW, 'arbuste')).toBe(false);
  });

  it('cap 3 sur arbre — 3 actifs → refuse', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [
        makeVisitor({ instanceId: 'vis_a' }),
        makeVisitor({ instanceId: 'vis_b', visitorId: 'meme_lucette' }),
        makeVisitor({ instanceId: 'vis_c', visitorId: 'yann_apiculteur' }),
      ],
    };
    expect(shouldSpawnVisitor(state, FIXED_NOW, 'arbre')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// getEligibleVisitors — anti-spam, gating, déjà-actif
// ─────────────────────────────────────────────

describe('getEligibleVisitors — anti-spam PNJ 24h', () => {
  it('exclut PNJ vu il y a < 24h', () => {
    const state: AubergeState = {
      ...emptyState(),
      reputations: [makeReputation('hugo_boulanger', 1, '2026-04-29T00:00:00Z')], // -12h
    };
    const eligible = getEligibleVisitors(state, 'pousse', 0, FIXED_NOW);
    expect(eligible.find(v => v.id === 'hugo_boulanger')).toBeUndefined();
  });

  it('inclut PNJ vu il y a >= 24h', () => {
    const state: AubergeState = {
      ...emptyState(),
      reputations: [makeReputation('hugo_boulanger', 1, '2026-04-28T11:00:00Z')], // -25h
    };
    const eligible = getEligibleVisitors(state, 'pousse', 0, FIXED_NOW);
    expect(eligible.find(v => v.id === 'hugo_boulanger')).toBeDefined();
  });

  it('exclut un visiteur déjà actif (Pitfall 4)', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [makeVisitor({ visitorId: 'hugo_boulanger' })],
    };
    const eligible = getEligibleVisitors(state, 'pousse', 0, FIXED_NOW);
    expect(eligible.find(v => v.id === 'hugo_boulanger')).toBeUndefined();
  });

  it('filtre par stade min — arbuste exclus au stade pousse', () => {
    const eligible = getEligibleVisitors(emptyState(), 'pousse', 0, FIXED_NOW);
    expect(eligible.find(v => v.id === 'yann_apiculteur')).toBeUndefined();
    expect(eligible.find(v => v.id === 'hugo_boulanger')).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// isVisitorUnlocked — gating Comtesse
// ─────────────────────────────────────────────

describe('isVisitorUnlocked — gating Comtesse à 15', () => {
  it('bloque Comtesse si totalReputation < 15', () => {
    const state: AubergeState = {
      ...emptyState(),
      reputations: [makeReputation('hugo_boulanger', 5, '2026-04-01T00:00:00Z')],
    };
    expect(isVisitorUnlocked('comtesse', state, 'arbre')).toBe(false);
  });

  it('autorise Comtesse si totalReputation >= 15', () => {
    const state: AubergeState = {
      ...emptyState(),
      reputations: [
        makeReputation('hugo_boulanger', 5, '2026-04-01T00:00:00Z'),
        makeReputation('meme_lucette', 5, '2026-04-01T00:00:00Z'),
        makeReputation('yann_apiculteur', 5, '2026-04-01T00:00:00Z'),
      ],
    };
    expect(getTotalReputation(state)).toBe(15);
    expect(isVisitorUnlocked('comtesse', state, 'arbre')).toBe(true);
  });

  it('Comtesse exclue de getEligibleVisitors si rep < 15 même au stade arbre', () => {
    const eligible = getEligibleVisitors(emptyState(), 'arbre', 5, FIXED_NOW);
    expect(eligible.find(v => v.id === 'comtesse')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// spawnVisitor — instanciation
// ─────────────────────────────────────────────

describe('spawnVisitor', () => {
  // rng déterministe : retourne toujours 0 → premier élément du pool
  const rngZero = () => 0;

  it('retourne null si shouldSpawnVisitor false', () => {
    const state: AubergeState = { ...emptyState(), lastSpawnAt: '2026-04-29T11:00:00Z' };
    expect(spawnVisitor(state, 'pousse', FIXED_NOW, 0, rngZero)).toBeNull();
  });

  it('crée un visiteur actif avec rewardCoins snapshot', () => {
    const result = spawnVisitor(emptyState(), 'pousse', FIXED_NOW, 0, rngZero);
    expect(result).not.toBeNull();
    expect(result!.visitor.status).toBe('active');
    expect(result!.visitor.rewardCoins).toBeGreaterThan(0);
    expect(result!.visitor.instanceId).toMatch(/^vis_/);
    expect(result!.state.visitors).toHaveLength(1);
    expect(result!.state.lastSpawnAt).toBe(FIXED_NOW.toISOString());
  });

  it('met à jour reputation.lastSeenAt au spawn', () => {
    const result = spawnVisitor(emptyState(), 'pousse', FIXED_NOW, 0, rngZero);
    expect(result).not.toBeNull();
    const rep = result!.state.reputations.find(r => r.visitorId === result!.visitor.visitorId);
    expect(rep).toBeDefined();
    expect(rep!.lastSeenAt).toBe(FIXED_NOW.toISOString());
  });
});

// ─────────────────────────────────────────────
// canDeliver / deliverVisitor
// ─────────────────────────────────────────────

describe('canDeliver / deliverVisitor', () => {
  const visitorWithRequest = makeVisitor({
    request: [
      { itemId: 'farine', source: 'building', quantity: 2 },
      { itemId: 'wheat', source: 'crop', quantity: 3 },
      { itemId: 'soupe', source: 'crafted', quantity: 1 },
    ],
  });

  it('items insuffisants → canDeliver retourne missing', () => {
    const inv: FarmInventory = { ...emptyFarmInventory(), farine: 1 };
    const harvestInv: HarvestInventory = { wheat: 2 };
    const crafted: CraftedItem[] = [];
    const check = canDeliver(visitorWithRequest, inv, harvestInv, crafted);
    expect(check.ok).toBe(false);
    expect(check.missing).toHaveLength(3);
    expect(check.missing.find(m => m.itemId === 'farine')!.quantity).toBe(1);
    expect(check.missing.find(m => m.itemId === 'wheat')!.quantity).toBe(1);
    expect(check.missing.find(m => m.itemId === 'soupe')!.quantity).toBe(1);
  });

  it('items suffisants → canDeliver ok', () => {
    const inv: FarmInventory = { ...emptyFarmInventory(), farine: 5 };
    const harvestInv: HarvestInventory = { wheat: { ordinaire: 3 } };
    const crafted: CraftedItem[] = [{ recipeId: 'soupe', craftedAt: '2026-04-28T00:00:00Z' }];
    const check = canDeliver(visitorWithRequest, inv, harvestInv, crafted);
    expect(check.ok).toBe(true);
    expect(check.missing).toHaveLength(0);
  });

  it('deliverVisitor avec items insuffisants → null', () => {
    const state: AubergeState = { ...emptyState(), visitors: [visitorWithRequest] };
    const result = deliverVisitor(
      state,
      visitorWithRequest.instanceId,
      { farm: emptyFarmInventory(), harvest: {}, crafted: [] },
      FIXED_NOW,
    );
    expect(result).toBeNull();
  });

  it('deliverVisitor succès : totalDeliveries +1, reputation +1, status delivered', () => {
    const state: AubergeState = { ...emptyState(), visitors: [visitorWithRequest] };
    const inv: FarmInventory = { ...emptyFarmInventory(), farine: 5 };
    const harvestInv: HarvestInventory = { wheat: 3 };
    const crafted: CraftedItem[] = [{ recipeId: 'soupe', craftedAt: '2026-04-28T00:00:00Z' }];
    const result = deliverVisitor(
      state,
      visitorWithRequest.instanceId,
      { farm: inv, harvest: harvestInv, crafted },
      FIXED_NOW,
    );
    expect(result).not.toBeNull();
    expect(result!.state.totalDeliveries).toBe(1);
    expect(result!.reputationDelta).toBe(1);
    expect(result!.state.visitors[0].status).toBe('delivered');
    expect(result!.deductedItems).toHaveLength(3);
    expect(result!.reward.coins).toBe(visitorWithRequest.rewardCoins);
    const rep = result!.state.reputations.find(r => r.visitorId === 'hugo_boulanger');
    expect(rep!.level).toBe(1);
    expect(rep!.successCount).toBe(1);
  });

  it('réputation cap 5 — 6e livraison reste à 5', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [visitorWithRequest],
      reputations: [makeReputation('hugo_boulanger', 5, '2026-04-01T00:00:00Z')],
    };
    const inv: FarmInventory = { ...emptyFarmInventory(), farine: 5 };
    const harvestInv: HarvestInventory = { wheat: 3 };
    const crafted: CraftedItem[] = [{ recipeId: 'soupe', craftedAt: '2026-04-28T00:00:00Z' }];
    const result = deliverVisitor(
      state,
      visitorWithRequest.instanceId,
      { farm: inv, harvest: harvestInv, crafted },
      FIXED_NOW,
    );
    expect(result).not.toBeNull();
    const rep = result!.state.reputations.find(r => r.visitorId === 'hugo_boulanger');
    expect(rep!.level).toBe(5); // cap
    expect(rep!.successCount).toBe(6);
  });
});

// ─────────────────────────────────────────────
// dismissVisitor
// ─────────────────────────────────────────────

describe('dismissVisitor', () => {
  it('pas de pénalité réputation', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [makeVisitor()],
      reputations: [makeReputation('hugo_boulanger', 3, '2026-04-01T00:00:00Z')],
    };
    const result = dismissVisitor(state, 'vis_1', FIXED_NOW);
    const rep = result.state.reputations.find(r => r.visitorId === 'hugo_boulanger');
    expect(rep!.level).toBe(3); // inchangé
    expect(rep!.failureCount).toBe(0);
  });

  it('lastSeenAt et lastSpawnAt mis à now (cooldown)', () => {
    const state: AubergeState = { ...emptyState(), visitors: [makeVisitor()] };
    const result = dismissVisitor(state, 'vis_1', FIXED_NOW);
    expect(result.state.lastSpawnAt).toBe(FIXED_NOW.toISOString());
    const rep = result.state.reputations.find(r => r.visitorId === 'hugo_boulanger');
    expect(rep!.lastSeenAt).toBe(FIXED_NOW.toISOString());
  });

  it('retire le visiteur du tableau', () => {
    const state: AubergeState = { ...emptyState(), visitors: [makeVisitor()] };
    const result = dismissVisitor(state, 'vis_1', FIXED_NOW);
    expect(result.state.visitors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// expireVisitors
// ─────────────────────────────────────────────

describe('expireVisitors', () => {
  it('marque expired les actifs dont deadline passée', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [
        makeVisitor({
          instanceId: 'vis_old',
          deadlineAt: '2026-04-28T12:00:00Z', // -24h
        }),
        makeVisitor({
          instanceId: 'vis_fresh',
          visitorId: 'meme_lucette',
          deadlineAt: '2026-04-30T12:00:00Z',
        }),
      ],
    };
    const result = expireVisitors(state, FIXED_NOW);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].instanceId).toBe('vis_old');
    expect(result.state.visitors.find(v => v.instanceId === 'vis_old')!.status).toBe('expired');
    expect(result.state.visitors.find(v => v.instanceId === 'vis_fresh')!.status).toBe('active');
  });

  it('-1 réputation avec floor 0 (pas de niveau négatif)', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [makeVisitor({ deadlineAt: '2026-04-28T12:00:00Z' })],
      reputations: [makeReputation('hugo_boulanger', 0, '2026-04-26T12:00:00Z')],
    };
    const result = expireVisitors(state, FIXED_NOW);
    expect(result.expired).toHaveLength(1);
    expect(result.state.reputations[0].level).toBe(0); // floor 0
    expect(result.state.reputations[0].failureCount).toBe(1);
  });

  it('décrémente niveau 3 → 2', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [makeVisitor({ deadlineAt: '2026-04-28T12:00:00Z' })],
      reputations: [makeReputation('hugo_boulanger', 3, '2026-04-26T12:00:00Z')],
    };
    const result = expireVisitors(state, FIXED_NOW);
    expect(result.state.reputations[0].level).toBe(2);
  });
});

// ─────────────────────────────────────────────
// getActiveVisitors — Pitfall 5 silencieux
// ─────────────────────────────────────────────

describe('getActiveVisitors — Pitfall 5 silencieux', () => {
  it('exclut visiteurs dont deadline passée mais status=active non tickté', () => {
    const expiredButNotTicked = makeVisitor({
      instanceId: 'vis_x',
      deadlineAt: '2026-04-28T12:00:00Z', // -24h
    });
    const state: AubergeState = { ...emptyState(), visitors: [expiredButNotTicked] };
    expect(getActiveVisitors(state, FIXED_NOW)).toHaveLength(0);
  });

  it('inclut visiteurs actifs avec deadline future', () => {
    const fresh = makeVisitor({ deadlineAt: '2026-04-30T12:00:00Z' });
    const state: AubergeState = { ...emptyState(), visitors: [fresh] };
    expect(getActiveVisitors(state, FIXED_NOW)).toHaveLength(1);
  });

  it('exclut delivered et expired', () => {
    const state: AubergeState = {
      ...emptyState(),
      visitors: [
        makeVisitor({ instanceId: 'vis_d', status: 'delivered' }),
        makeVisitor({ instanceId: 'vis_e', status: 'expired' }),
      ],
    };
    expect(getActiveVisitors(state, FIXED_NOW)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// getRemainingMinutes
// ─────────────────────────────────────────────

describe('getRemainingMinutes', () => {
  it('retourne 0 si deadline passée', () => {
    const v = makeVisitor({ deadlineAt: '2026-04-28T12:00:00Z' });
    expect(getRemainingMinutes(v, FIXED_NOW)).toBe(0);
  });

  it('retourne minutes restantes positives', () => {
    const v = makeVisitor({ deadlineAt: '2026-04-29T13:00:00Z' });
    expect(getRemainingMinutes(v, FIXED_NOW)).toBe(60);
  });
});

// ─────────────────────────────────────────────
// estimatedSellValue — dispatch source
// ─────────────────────────────────────────────

describe('estimatedSellValue — dispatch source', () => {
  it('source building → BUILDING_RESOURCE_VALUE', () => {
    const item: VisitorRequestItem = { itemId: 'oeuf', source: 'building', quantity: 1 };
    expect(estimatedSellValue(item)).toBe(80); // BUILDING_RESOURCE_VALUE.oeuf
  });

  it('source crop → harvestReward du CROP_CATALOG', () => {
    const item: VisitorRequestItem = { itemId: 'wheat', source: 'crop', quantity: 1 };
    expect(estimatedSellValue(item)).toBeGreaterThan(0);
  });

  it('source crafted → CRAFT_RECIPES.sellValue', () => {
    const item: VisitorRequestItem = { itemId: 'soupe', source: 'crafted', quantity: 1 };
    expect(estimatedSellValue(item)).toBe(150);
  });

  it('item inconnu → 0', () => {
    const item: VisitorRequestItem = { itemId: 'inexistant_xyz', source: 'crop', quantity: 1 };
    expect(estimatedSellValue(item)).toBe(0);
  });
});

// ─────────────────────────────────────────────
// getReputation / getTotalReputation
// ─────────────────────────────────────────────

describe('getReputation / getTotalReputation', () => {
  it('getReputation 0 si PNJ inconnu', () => {
    expect(getReputation(emptyState(), 'inconnu')).toBe(0);
  });

  it('getTotalReputation somme les niveaux', () => {
    const state: AubergeState = {
      ...emptyState(),
      reputations: [
        makeReputation('a', 3, '2026-04-01T00:00:00Z'),
        makeReputation('b', 2, '2026-04-01T00:00:00Z'),
      ],
    };
    expect(getTotalReputation(state)).toBe(5);
  });
});

// ─────────────────────────────────────────────
// Round-trip serializeAuberge / parseAuberge
// ─────────────────────────────────────────────

describe('Round-trip serializeAuberge / parseAuberge', () => {
  it('état vide round-trip', () => {
    const empty = emptyState();
    const s = serializeAuberge(empty, FIXED_NOW);
    const parsed = parseAuberge(s);
    expect(parsed).toEqual(empty);
  });

  it('multiples visiteurs + réputations round-trip lossless', () => {
    const state: AubergeState = {
      visitors: [
        makeVisitor({ instanceId: 'vis_a' }),
        makeVisitor({
          instanceId: 'vis_b',
          visitorId: 'meme_lucette',
          request: [
            { itemId: 'lait', source: 'building', quantity: 3 },
            { itemId: 'potato', source: 'crop', quantity: 4 },
          ],
        }),
      ],
      reputations: [
        makeReputation('hugo_boulanger', 3, '2026-04-28T10:30:00.000Z'),
        makeReputation('meme_lucette', 2, '2026-04-29T08:15:00.000Z'),
      ],
      lastSpawnAt: '2026-04-29T11:00:00.000Z',
      totalDeliveries: 7,
    };
    const s = serializeAuberge(state, FIXED_NOW);
    const parsed = parseAuberge(s);
    expect(parsed).toEqual(state);
  });

  it('archive auto +7j : visiteurs delivered/expired vieux >7j supprimés', () => {
    const state: AubergeState = {
      visitors: [
        makeVisitor({
          instanceId: 'vis_old_delivered',
          status: 'delivered',
          arrivedAt: '2026-04-15T12:00:00Z', // -14j
        }),
        makeVisitor({
          instanceId: 'vis_recent_delivered',
          status: 'delivered',
          arrivedAt: '2026-04-26T12:00:00Z', // -3j
        }),
        makeVisitor({
          instanceId: 'vis_active_old',
          status: 'active',
          arrivedAt: '2026-04-15T12:00:00Z', // actif → toujours persisté
          deadlineAt: '2026-04-30T12:00:00Z',
        }),
      ],
      reputations: [],
      totalDeliveries: 5,
    };
    const s = serializeAuberge(state, FIXED_NOW);
    const parsed = parseAuberge(s);
    const ids = parsed.visitors.map(v => v.instanceId).sort();
    expect(ids).toEqual(['vis_active_old', 'vis_recent_delivered']);
    expect(parsed.totalDeliveries).toBe(5); // compteur préservé
  });

  it('Pitfall 6 : visitorId catalogue inconnu filtré silencieusement au parse', () => {
    // Encode manuellement un visiteur avec id inconnu (escape ,→| :→§)
    const ghost = JSON.stringify({
      visitorId: 'ghost_inconnu',
      instanceId: 'vis_ghost',
      arrivedAt: '2026-04-28T12:00:00.000Z',
      deadlineAt: '2026-04-30T12:00:00.000Z',
      request: [],
      status: 'active',
      rewardCoins: 100,
    })
      .replace(/,/g, '|')
      .replace(/:/g, '§');
    const parsed = parseAuberge({
      visitors: ghost,
      reputations: '',
      totalDeliveries: 0,
    });
    expect(parsed.visitors).toHaveLength(0);
  });

  it('parseAuberge tolérant aux entrées vides / undefined', () => {
    expect(parseAuberge({})).toEqual(emptyState());
    expect(parseAuberge({ visitors: '', reputations: '', totalDeliveries: 0 })).toEqual(emptyState());
  });

  it('reputations malformées ignorées', () => {
    const parsed = parseAuberge({
      visitors: '',
      reputations: 'broken|hugo_boulanger:3:1:0:2026-04-28T10:30:00Z',
      totalDeliveries: 0,
    });
    expect(parsed.reputations).toHaveLength(1);
    expect(parsed.reputations[0].visitorId).toBe('hugo_boulanger');
    expect(parsed.reputations[0].level).toBe(3);
  });
});
