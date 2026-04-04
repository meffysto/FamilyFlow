/**
 * gift-engine.test.ts — Tests unitaires pour lib/mascot/gift-engine.ts
 * Couvre : parsePendingGifts, serializePendingGifts, canSendGiftToday,
 *          incrementGiftsSent, addGiftToInventory, removeFromInventory,
 *          buildGiftHistoryEntry, parseGiftHistory, MAX_GIFTS_PER_DAY
 */

import {
  parsePendingGifts,
  serializePendingGifts,
  canSendGiftToday,
  incrementGiftsSent,
  addGiftToInventory,
  removeFromInventory,
  buildGiftHistoryEntry,
  parseGiftHistory,
  MAX_GIFTS_PER_DAY,
  type GiftEntry,
  type PendingGifts,
  type GiftHistoryEntry,
} from '../mascot/gift-engine';
import type { FarmProfileData } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function baseFarmData(): FarmProfileData {
  return {
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
    harvestInventory: { carrot: 5, wheat: 2 },
    farmInventory: { oeuf: 3, lait: 2, farine: 1, miel: 0 },
    craftedItems: [],
    farmRareSeeds: { orchidee: 1 },
  };
}

function makeGiftEntry(overrides: Partial<GiftEntry> = {}): GiftEntry {
  return {
    sender_id: 'papa',
    sender_name: 'Papa',
    sender_avatar: '👨‍💻',
    item_type: 'harvest',
    item_id: 'carrot',
    quantity: 2,
    sent_at: '2026-04-04T10:00:00.000Z',
    ...overrides,
  };
}

// ── MAX_GIFTS_PER_DAY ─────────────────────────────────────────────────────────

describe('MAX_GIFTS_PER_DAY', () => {
  it('vaut 5', () => {
    expect(MAX_GIFTS_PER_DAY).toBe(5);
  });
});

// ── parsePendingGifts ─────────────────────────────────────────────────────────

describe('parsePendingGifts', () => {
  it('retourne { gifts: [] } pour un contenu vide', () => {
    const result = parsePendingGifts('');
    expect(result).toEqual({ gifts: [] });
  });

  it('retourne { gifts: [] } pour du contenu sans gifts', () => {
    const result = parsePendingGifts('---\ntitle: test\n---\n');
    expect(result.gifts).toEqual([]);
  });

  it('parse un fichier YAML avec 2 gifts et retourne GiftEntry[]', () => {
    const content = `---
gifts:
  - sender_id: papa
    sender_name: Papa
    sender_avatar: "👨‍💻"
    item_type: harvest
    item_id: carrot
    quantity: 2
    sent_at: "2026-04-04T10:00:00.000Z"
  - sender_id: maman
    sender_name: Maman
    sender_avatar: "👩"
    item_type: rare_seed
    item_id: orchidee
    quantity: 1
    sent_at: "2026-04-04T11:00:00.000Z"
---
`;
    const result = parsePendingGifts(content);
    expect(result.gifts).toHaveLength(2);
    expect(result.gifts[0].sender_id).toBe('papa');
    expect(result.gifts[0].item_type).toBe('harvest');
    expect(result.gifts[0].quantity).toBe(2);
    expect(result.gifts[1].sender_id).toBe('maman');
    expect(result.gifts[1].item_type).toBe('rare_seed');
  });

  it('retourne { gifts: [] } si gifts est null/undefined dans le frontmatter', () => {
    const content = `---\ngifts:\n---\n`;
    const result = parsePendingGifts(content);
    expect(result.gifts).toEqual([]);
  });
});

// ── serializePendingGifts ─────────────────────────────────────────────────────

describe('serializePendingGifts', () => {
  it('produit un string re-parsable par parsePendingGifts', () => {
    const gifts: GiftEntry[] = [makeGiftEntry()];
    const serialized = serializePendingGifts(gifts);
    const parsed = parsePendingGifts(serialized);
    expect(parsed.gifts).toHaveLength(1);
    expect(parsed.gifts[0].sender_id).toBe('papa');
    expect(parsed.gifts[0].item_id).toBe('carrot');
    expect(parsed.gifts[0].quantity).toBe(2);
  });

  it('produit un string valide pour une liste vide', () => {
    const serialized = serializePendingGifts([]);
    const parsed = parsePendingGifts(serialized);
    expect(parsed.gifts).toEqual([]);
  });
});

// ── canSendGiftToday ──────────────────────────────────────────────────────────

describe('canSendGiftToday', () => {
  const today = new Date('2026-04-04T12:00:00.000Z');

  it('retourne true si giftsSentField est undefined', () => {
    expect(canSendGiftToday(undefined, today)).toBe(true);
  });

  it('retourne false apres 5 envois le meme jour', () => {
    expect(canSendGiftToday('5|2026-04-04', today)).toBe(false);
  });

  it('retourne true si count < 5 le meme jour', () => {
    expect(canSendGiftToday('4|2026-04-04', today)).toBe(true);
  });

  it('retourne true si la date est differente (reset quotidien)', () => {
    expect(canSendGiftToday('5|2026-04-03', today)).toBe(true);
  });

  it('retourne true si count = 1 le meme jour', () => {
    expect(canSendGiftToday('1|2026-04-04', today)).toBe(true);
  });

  it('retourne true si count = 3 le meme jour', () => {
    expect(canSendGiftToday('3|2026-04-04', today)).toBe(true);
  });
});

// ── incrementGiftsSent ────────────────────────────────────────────────────────

describe('incrementGiftsSent', () => {
  const today = new Date('2026-04-04T12:00:00.000Z');

  it('retourne "1|2026-04-04" si giftsSentField est undefined', () => {
    expect(incrementGiftsSent(undefined, today)).toBe('1|2026-04-04');
  });

  it('incremente le count le meme jour', () => {
    expect(incrementGiftsSent('3|2026-04-04', today)).toBe('4|2026-04-04');
  });

  it('remet le compteur a 1 si la date est differente (reset)', () => {
    expect(incrementGiftsSent('5|2026-04-03', today)).toBe('1|2026-04-04');
  });

  it('incremente de 4 a 5 le meme jour', () => {
    expect(incrementGiftsSent('4|2026-04-04', today)).toBe('5|2026-04-04');
  });

  it('retourne le format count|YYYY-MM-DD', () => {
    const result = incrementGiftsSent(undefined, today);
    expect(result).toMatch(/^\d+\|\d{4}-\d{2}-\d{2}$/);
  });
});

// ── addGiftToInventory ────────────────────────────────────────────────────────

describe('addGiftToInventory', () => {
  it('ajoute correctement un item de type harvest au HarvestInventory', () => {
    const farm = baseFarmData();
    const gift = makeGiftEntry({ item_type: 'harvest', item_id: 'carrot', quantity: 3 });
    const updated = addGiftToInventory(farm, gift);
    expect(updated.harvestInventory?.carrot).toBe(8); // 5 + 3
  });

  it('ajoute un nouveau crop de type harvest (absent de l inventaire)', () => {
    const farm = baseFarmData();
    const gift = makeGiftEntry({ item_type: 'harvest', item_id: 'tomato', quantity: 1 });
    const updated = addGiftToInventory(farm, gift);
    expect(updated.harvestInventory?.tomato).toBe(1);
  });

  it('ajoute correctement un item de type rare_seed au RareSeedInventory', () => {
    const farm = baseFarmData();
    const gift = makeGiftEntry({ item_type: 'rare_seed', item_id: 'orchidee', quantity: 2 });
    const updated = addGiftToInventory(farm, gift);
    expect(updated.farmRareSeeds?.orchidee).toBe(3); // 1 + 2
  });

  it('ajoute correctement un item de type building_resource au FarmInventory', () => {
    const farm = baseFarmData();
    const gift = makeGiftEntry({ item_type: 'building_resource', item_id: 'oeuf', quantity: 2 });
    const updated = addGiftToInventory(farm, gift);
    expect(updated.farmInventory?.oeuf).toBe(5); // 3 + 2
  });

  it('ajoute correctement un item de type crafted au CraftedItem[]', () => {
    const farm = baseFarmData();
    const gift = makeGiftEntry({ item_type: 'crafted', item_id: 'confiture', quantity: 1 });
    const updated = addGiftToInventory(farm, gift);
    expect(updated.craftedItems).toHaveLength(1);
    expect(updated.craftedItems?.[0].recipeId).toBe('confiture');
  });

  it('ne mute pas la farm originale (copie defensive)', () => {
    const farm = baseFarmData();
    const originalHarvest = { ...farm.harvestInventory };
    const gift = makeGiftEntry({ item_type: 'harvest', item_id: 'carrot', quantity: 1 });
    addGiftToInventory(farm, gift);
    expect(farm.harvestInventory).toEqual(originalHarvest);
  });
});

// ── removeFromInventory ───────────────────────────────────────────────────────

describe('removeFromInventory', () => {
  it('retire la quantite exacte de harvest et retourne success=true', () => {
    const farm = baseFarmData();
    const { success, updated } = removeFromInventory(farm, 'harvest', 'carrot', 3);
    expect(success).toBe(true);
    expect(updated.harvestInventory?.carrot).toBe(2); // 5 - 3
  });

  it('retourne success=false si quantite insuffisante (harvest)', () => {
    const farm = baseFarmData();
    const { success } = removeFromInventory(farm, 'harvest', 'carrot', 10);
    expect(success).toBe(false);
  });

  it('retourne success=false si item absent de l inventaire', () => {
    const farm = baseFarmData();
    const { success } = removeFromInventory(farm, 'harvest', 'tomato', 1);
    expect(success).toBe(false);
  });

  it('retire la quantite exacte de building_resource et retourne success=true', () => {
    const farm = baseFarmData();
    const { success, updated } = removeFromInventory(farm, 'building_resource', 'oeuf', 2);
    expect(success).toBe(true);
    expect(updated.farmInventory?.oeuf).toBe(1); // 3 - 2
  });

  it('retourne success=false si building_resource insuffisante', () => {
    const farm = baseFarmData();
    const { success } = removeFromInventory(farm, 'building_resource', 'oeuf', 10);
    expect(success).toBe(false);
  });

  it('ne mute pas la farm originale en cas d echec', () => {
    const farm = baseFarmData();
    const originalHarvest = { ...farm.harvestInventory };
    removeFromInventory(farm, 'harvest', 'carrot', 10);
    expect(farm.harvestInventory).toEqual(originalHarvest);
  });
});

// ── buildGiftHistoryEntry ─────────────────────────────────────────────────────

describe('buildGiftHistoryEntry', () => {
  const now = new Date('2026-04-04T10:00:00.000Z');

  it('produit le format ISO|direction|fromId->toId|type:itemId:qty', () => {
    const entry = buildGiftHistoryEntry('sent', 'papa', 'lucas', 'harvest', 'carrot', 2, now);
    expect(entry).toBe('2026-04-04T10:00:00.000Z|sent|papa->lucas|harvest:carrot:2');
  });

  it('fonctionne pour la direction received', () => {
    const entry = buildGiftHistoryEntry('received', 'lucas', 'papa', 'rare_seed', 'orchidee', 1, now);
    expect(entry).toBe('2026-04-04T10:00:00.000Z|received|lucas->papa|rare_seed:orchidee:1');
  });

  it('utilise la date actuelle si now non fourni', () => {
    const entry = buildGiftHistoryEntry('sent', 'papa', 'lucas', 'harvest', 'carrot', 1);
    expect(entry).toMatch(/^[\d-T:.Z]+\|sent\|papa->lucas\|harvest:carrot:1$/);
  });
});

// ── parseGiftHistory ──────────────────────────────────────────────────────────

describe('parseGiftHistory', () => {
  it('retourne [] si csv est undefined', () => {
    expect(parseGiftHistory(undefined)).toEqual([]);
  });

  it('retourne [] si csv est une chaine vide', () => {
    expect(parseGiftHistory('')).toEqual([]);
  });

  it('parse une entree CSV en GiftHistoryEntry', () => {
    const csv = '2026-04-04T10:00:00.000Z|sent|papa->lucas|harvest:carrot:2';
    const result = parseGiftHistory(csv);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-04-04T10:00:00.000Z');
    expect(result[0].direction).toBe('sent');
    expect(result[0].fromId).toBe('papa');
    expect(result[0].toId).toBe('lucas');
    expect(result[0].itemType).toBe('harvest');
    expect(result[0].itemId).toBe('carrot');
    expect(result[0].quantity).toBe(2);
  });

  it('parse plusieurs entrees separees par virgule', () => {
    const csv = '2026-04-04T10:00:00.000Z|sent|papa->lucas|harvest:carrot:2,2026-04-04T11:00:00.000Z|received|maman->papa|rare_seed:orchidee:1';
    const result = parseGiftHistory(csv);
    expect(result).toHaveLength(2);
    expect(result[1].direction).toBe('received');
  });

  it('limite le resultat a 10 entrees maximum', () => {
    const entries = Array.from({ length: 15 }, (_, i) =>
      `2026-04-04T${String(i).padStart(2, '0')}:00:00.000Z|sent|papa->lucas|harvest:carrot:1`
    ).join(',');
    const result = parseGiftHistory(entries);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
