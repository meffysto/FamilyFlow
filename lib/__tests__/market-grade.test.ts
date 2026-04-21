// Phase B (260421-obd) — Vente marché par grade avec multiplicateur.
// Couvre : canSellItem × multiplier, executeSell transaction, défaut 'ordinaire',
// achat toujours en 'ordinaire' (règle anti-triche via buyItem côté hook).

import {
  canSellItem,
  executeSell,
  findMarketItem,
  getSellPrice,
  initializeMarketStock,
} from '../village/market-engine';
import {
  addToGradedInventory,
  gradeSellMultiplier,
  type HarvestGrade,
} from '../mascot/grade-engine';
import type { HarvestInventory } from '../mascot/types';

describe('canSellItem — multiplicateur de grade', () => {
  const stock = initializeMarketStock();
  const def = findMarketItem('tomato')!;
  const currentStock = stock[def.itemId];
  const baseSell = getSellPrice(def, currentStock);

  it('ordinaire (×1) = prix brut', () => {
    const res = canSellItem('tomato', 1, stock, 5, 'ordinaire');
    expect(res.canSell).toBe(true);
    expect(res.totalGain).toBe(Math.floor(baseSell * 1) * 1);
  });

  it('beau (×1.5) = prix ×1.5 floor', () => {
    const res = canSellItem('tomato', 1, stock, 5, 'beau');
    expect(res.canSell).toBe(true);
    expect(res.totalGain).toBe(Math.floor(baseSell * 1.5));
  });

  it('superbe (×2.5)', () => {
    const res = canSellItem('tomato', 2, stock, 5, 'superbe');
    expect(res.canSell).toBe(true);
    expect(res.totalGain).toBe(Math.floor(baseSell * 2.5) * 2);
  });

  it('parfait (×4) = prix ×4 floor', () => {
    const res = canSellItem('tomato', 1, stock, 5, 'parfait');
    expect(res.canSell).toBe(true);
    expect(res.totalGain).toBe(Math.floor(baseSell * 4));
  });

  it('sans grade fourni → défaut ordinaire (×1)', () => {
    const res = canSellItem('tomato', 1, stock, 5);
    expect(res.canSell).toBe(true);
    expect(res.totalGain).toBe(Math.floor(baseSell * 1));
  });

  it('refuse la vente si profil ne possède pas assez (qty demandée > count)', () => {
    const res = canSellItem('tomato', 3, stock, 2, 'parfait');
    expect(res.canSell).toBe(false);
    expect(res.reason).toContain('2');
  });

  it('item introuvable → erreur', () => {
    const res = canSellItem('unknown_item', 1, stock, 5, 'ordinaire');
    expect(res.canSell).toBe(false);
    expect(res.reason).toBe('Article introuvable');
  });
});

describe('executeSell — transaction par grade', () => {
  const stock = initializeMarketStock();
  const def = findMarketItem('strawberry')!;

  it('crédite le multiplicateur dans totalGain', () => {
    const now = new Date('2026-04-21T10:00:00Z');
    const baseSell = getSellPrice(def, stock[def.itemId]);
    const { totalGain, transaction, newStock } = executeSell(
      'strawberry', 1, 'p1', stock, now, 'parfait',
    );
    expect(totalGain).toBe(Math.floor(baseSell * 4));
    expect(transaction.unitPrice).toBe(Math.floor(baseSell * 4));
    expect(transaction.action).toBe('sell');
    // Le stock marché monte
    expect(newStock[def.itemId]).toBe(stock[def.itemId] + 1);
  });

  it('défaut ordinaire si grade non fourni', () => {
    const now = new Date('2026-04-21T10:00:00Z');
    const baseSell = getSellPrice(def, stock[def.itemId]);
    const { totalGain } = executeSell('strawberry', 1, 'p1', stock, now);
    expect(totalGain).toBe(Math.floor(baseSell * 1));
  });

  it('ne mute pas le stock d\'entrée', () => {
    const now = new Date('2026-04-21T10:00:00Z');
    const before = { ...stock };
    executeSell('strawberry', 1, 'p1', stock, now, 'beau');
    expect(stock).toEqual(before);
  });
});

describe('Plusieurs grades possédés — UI multi-lignes (simulation)', () => {
  // Le hook useGarden.sellItem éclate les lignes par grade côté UI.
  // Ici on vérifie que chaque grade donne un prix différent (source de vérité pour MarketSheet).
  const stock = initializeMarketStock();
  const def = findMarketItem('tomato')!;
  const baseSell = getSellPrice(def, stock[def.itemId]);

  it('4 lignes distinctes pour un item en 4 grades', () => {
    const grades: HarvestGrade[] = ['ordinaire', 'beau', 'superbe', 'parfait'];
    const prices = grades.map(g => canSellItem('tomato', 1, stock, 10, g).totalGain);
    expect(prices).toEqual([
      Math.floor(baseSell * 1),
      Math.floor(baseSell * 1.5),
      Math.floor(baseSell * 2.5),
      Math.floor(baseSell * 4),
    ]);
    // Tous distincts (sauf collision arithmétique peu probable sur baseSell>1)
    expect(new Set(prices).size).toBe(4);
  });

  it('les multiplicateurs correspondent à gradeSellMultiplier', () => {
    expect(gradeSellMultiplier('ordinaire')).toBe(1);
    expect(gradeSellMultiplier('beau')).toBe(1.5);
    expect(gradeSellMultiplier('superbe')).toBe(2.5);
    expect(gradeSellMultiplier('parfait')).toBe(4);
  });
});

describe('Achat marché — toujours ordinaire (règle anti-triche)', () => {
  // Cette règle vit dans useGarden.buyItem : quand on achète au marché,
  // l'item est TOUJOURS ajouté avec grade='ordinaire'. On reproduit la logique
  // ici pour geler le contrat (test unitaire sur l'inventaire gradé).
  it('addToGradedInventory avec grade ordinaire simulant un achat', () => {
    const inv: HarvestInventory = {};
    // Simulation : achat de 3 tomates
    addToGradedInventory(inv, 'tomato', 'ordinaire', 3);
    expect(inv.tomato).toEqual({ ordinaire: 3 });
    // Aucune ligne autre grade créée
    const entry = inv.tomato as Partial<Record<HarvestGrade, number>>;
    expect(entry.beau).toBeUndefined();
    expect(entry.superbe).toBeUndefined();
    expect(entry.parfait).toBeUndefined();
  });

  it('achats répétés cumulent uniquement dans ordinaire', () => {
    const inv: HarvestInventory = {};
    addToGradedInventory(inv, 'wheat', 'ordinaire', 2);
    addToGradedInventory(inv, 'wheat', 'ordinaire', 5);
    expect(inv.wheat).toEqual({ ordinaire: 7 });
  });

  it('achat n\'efface pas les grades existants', () => {
    const inv: HarvestInventory = { tomato: { beau: 3, parfait: 1 } };
    addToGradedInventory(inv, 'tomato', 'ordinaire', 2);
    expect(inv.tomato).toEqual({ beau: 3, parfait: 1, ordinaire: 2 });
  });
});
