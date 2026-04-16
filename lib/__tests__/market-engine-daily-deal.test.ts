/**
 * Tests unitaires — Deal du jour (stock séparé du marché, quota per-profil)
 *
 * Couvre :
 *  - Pool stable basé sur initialStock > 0 (exclut tresor_familial, grand_festin)
 *  - Signature étendue getDailyDeal(marketStock, now, profileDealPurchases?)
 *  - Round-trip parser pour FarmProfileData.dailyDealPurchases
 */

import {
  getDailyDeal,
  DAILY_DEAL_STOCK_PER_PROFILE,
  MARKET_ITEMS,
} from '../village/market-engine';
import { parseFarmProfile, serializeFarmProfile } from '../parser';
import type { FarmProfileData } from '../types';

// Helper : construit un FarmProfileData "vide" valide pour les round-trip tests
function emptyFarm(): FarmProfileData {
  return {
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
  };
}

describe('getDailyDeal — pool stable basé sur initialStock > 0', () => {
  test('retourne un deal même si marketStock est vide', () => {
    const deal = getDailyDeal({}, new Date('2026-04-16'));
    expect(deal).not.toBeNull();
    expect(deal?.def.itemId).toBeTruthy();
  });

  test('n\'inclut jamais tresor_familial ni grand_festin (initialStock=0)', () => {
    // Boucler sur 400 jours pour couvrir largement tout le modulo
    const excluded = new Set<string>();
    for (let offset = 0; offset < 400; offset++) {
      const d = new Date('2026-01-01');
      d.setDate(d.getDate() + offset);
      const deal = getDailyDeal({}, d);
      if (deal) {
        excluded.add(deal.def.itemId);
      }
    }
    expect(excluded.has('tresor_familial')).toBe(false);
    expect(excluded.has('grand_festin')).toBe(false);
  });

  test('pool éligible = MARKET_ITEMS avec initialStock > 0 (exclut tresor_familial + grand_festin)', () => {
    const excluded = MARKET_ITEMS.filter(i => i.initialStock === 0).map(i => i.itemId);
    const eligible = MARKET_ITEMS.filter(i => i.initialStock > 0);
    // Les 2 items volontairement exclus du pool (unlocks spéciaux, pas du deal)
    expect(excluded).toEqual(expect.arrayContaining(['tresor_familial', 'grand_festin']));
    expect(excluded.length).toBe(2);
    // Pool = total - 2
    expect(eligible.length).toBe(MARKET_ITEMS.length - 2);
    // Sanité : pool non-vide (au moins la vingtaine d'items historiques)
    expect(eligible.length).toBeGreaterThanOrEqual(50);
  });
});

describe('getDailyDeal — signature étendue (profileDealPurchases)', () => {
  const date = new Date('2026-04-16');
  const dateKey = '2026-04-16';

  test('remaining === 2 quand profileDealPurchases est undefined', () => {
    const deal = getDailyDeal({}, date, undefined);
    expect(deal).not.toBeNull();
    expect(deal?.remaining).toBe(DAILY_DEAL_STOCK_PER_PROFILE);
    expect(deal?.remaining).toBe(2);
  });

  test('remaining === 1 après 1 achat sur le même item aujourd\'hui', () => {
    const firstDeal = getDailyDeal({}, date);
    const pickedId = firstDeal!.def.itemId;
    const deal = getDailyDeal({}, date, {
      dateKey,
      itemId: pickedId,
      purchased: 1,
    });
    expect(deal).not.toBeNull();
    expect(deal?.remaining).toBe(1);
  });

  test('null (deal disparaît) quand purchased >= 2 pour le même item', () => {
    const firstDeal = getDailyDeal({}, date);
    const pickedId = firstDeal!.def.itemId;
    const deal = getDailyDeal({}, date, {
      dateKey,
      itemId: pickedId,
      purchased: 2,
    });
    expect(deal).toBeNull();
  });

  test('reset à minuit — dateKey d\'hier → remaining === 2', () => {
    const firstDeal = getDailyDeal({}, date);
    const pickedId = firstDeal!.def.itemId;
    const deal = getDailyDeal({}, date, {
      dateKey: '2026-04-15', // hier
      itemId: pickedId,
      purchased: 2,
    });
    expect(deal).not.toBeNull();
    expect(deal?.remaining).toBe(2);
  });

  test('reset quand itemId différent — remaining === 2', () => {
    const deal = getDailyDeal({}, date, {
      dateKey,
      itemId: 'un_autre_item_qui_nest_pas_le_deal_du_jour',
      purchased: 2,
    });
    expect(deal).not.toBeNull();
    expect(deal?.remaining).toBe(2);
  });
});

describe('parser — round-trip FarmProfileData.dailyDealPurchases', () => {
  test('round-trip préserve dailyDealPurchases', () => {
    const data: FarmProfileData = {
      ...emptyFarm(),
      dailyDealPurchases: {
        dateKey: '2026-04-16',
        itemId: 'eau_fraiche',
        purchased: 2,
      },
    };
    const serialized = serializeFarmProfile('Test', data);
    const parsed = parseFarmProfile(serialized);
    expect(parsed.dailyDealPurchases).toEqual({
      dateKey: '2026-04-16',
      itemId: 'eau_fraiche',
      purchased: 2,
    });
  });

  test('fichier sans ligne daily_deal_purchases → dailyDealPurchases undefined', () => {
    const content = `# Farm — Test

garden_name: Le Jardin
`;
    const parsed = parseFarmProfile(content);
    expect(parsed.dailyDealPurchases).toBeUndefined();
  });

  test('ligne malformée daily_deal_purchases: abc|def (count non-numérique) → undefined', () => {
    const content = `# Farm — Test

daily_deal_purchases: abc|def
`;
    const parsed = parseFarmProfile(content);
    expect(parsed.dailyDealPurchases).toBeUndefined();
  });

  test('serializeFarmProfile avec dailyDealPurchases=undefined → pas de ligne émise', () => {
    const data: FarmProfileData = emptyFarm();
    const serialized = serializeFarmProfile('Test', data);
    expect(serialized).not.toContain('daily_deal_purchases');
  });

  test('ligne malformée avec seulement 2 parties → undefined', () => {
    const content = `# Farm — Test

daily_deal_purchases: 2026-04-16|eau_fraiche
`;
    const parsed = parseFarmProfile(content);
    expect(parsed.dailyDealPurchases).toBeUndefined();
  });
});
