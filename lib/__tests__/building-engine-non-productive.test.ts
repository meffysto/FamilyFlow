/**
 * Tests Phase 44-01 — Court-circuit `producesResource: false`
 *
 * Vérifie que les 3 fonctions productrices de building-engine
 * (getPendingResources, getMinutesUntilNext, collectBuilding) court-circuitent
 * proprement pour un bâtiment dont la définition a `producesResource: false`.
 * Vérifie également la non-régression sur les bâtiments existants (poulailler).
 */

import {
  getPendingResources,
  getMinutesUntilNext,
  collectBuilding,
} from '../mascot/building-engine';
import {
  BUILDING_CATALOG,
  type PlacedBuilding,
  type FarmInventory,
  type BuildingDefinition,
} from '../mascot/types';

const FAKE_ID = 'auberge_test_fixture';

const FAKE_DEF: BuildingDefinition = {
  id: FAKE_ID,
  labelKey: 'farm.building.fake',
  emoji: '🛖',
  cost: 0,
  dailyIncome: 0,
  minTreeStage: 'pousse',
  resourceType: 'oeuf', // non-utilisé mais requis par le type
  producesResource: false,
  tiers: Array.from({ length: 10 }, (_, i) => ({
    level: i + 1,
    productionRateHours: 8,
    upgradeCoins: i === 0 ? 0 : 100 * (i + 1),
    spriteSuffix: '',
  })),
};

describe('building-engine — court-circuit producesResource: false', () => {
  beforeAll(() => {
    BUILDING_CATALOG.push(FAKE_DEF);
  });

  afterAll(() => {
    const idx = BUILDING_CATALOG.findIndex(b => b.id === FAKE_ID);
    if (idx >= 0) BUILDING_CATALOG.splice(idx, 1);
  });

  const fakePlaced: PlacedBuilding = {
    buildingId: FAKE_ID,
    cellId: 'b0',
    level: 1,
    lastCollectAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // -48h
  };

  it('getPendingResources retourne 0 pour un bâtiment non-productif (même avec 48h écoulées)', () => {
    expect(getPendingResources(fakePlaced)).toBe(0);
  });

  it('getMinutesUntilNext retourne 0 pour un bâtiment non-productif', () => {
    expect(getMinutesUntilNext(fakePlaced)).toBe(0);
  });

  it('collectBuilding ne mute rien et retourne collected: 0', () => {
    const inventory: FarmInventory = { oeuf: 5, lait: 2, farine: 0, miel: 1 };
    const buildings: PlacedBuilding[] = [fakePlaced];
    const result = collectBuilding(buildings, inventory, 'b0');
    expect(result.collected).toBe(0);
    expect(result.inventory).toEqual(inventory);
    expect(result.buildings).toEqual(buildings);
  });

  it('rétrocompat : poulailler (sans flag producesResource) produit toujours après 24h', () => {
    const placed: PlacedBuilding = {
      buildingId: 'poulailler',
      cellId: 'b1',
      level: 1,
      lastCollectAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    };
    expect(getPendingResources(placed)).toBeGreaterThan(0);
  });
});
