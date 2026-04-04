// ─────────────────────────────────────────────
// Cadeaux familiaux — Moteur pur (sans React)
// Parsing fichier pending YAML, validation anti-abus,
// transfert inventaire 4 types, historique CSV
// ─────────────────────────────────────────────

import matter from 'gray-matter';
import { format } from 'date-fns';
import type { FarmProfileData } from '../types';
import type { FarmInventory, HarvestInventory, RareSeedInventory, CraftedItem } from './types';

// ── Constantes ───────────────────────────────────────────────────────────────

export const MAX_GIFTS_PER_DAY = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GiftEntry {
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  item_type: 'harvest' | 'rare_seed' | 'crafted' | 'building_resource';
  item_id: string;
  quantity: number;
  sent_at: string;
}

export interface PendingGifts {
  gifts: GiftEntry[];
}

export interface GiftHistoryEntry {
  date: string;
  direction: 'sent' | 'received';
  fromId: string;
  toId: string;
  itemType: string;
  itemId: string;
  quantity: number;
}

// ── Parsing / Serialisation fichier pending ───────────────────────────────────

/**
 * Parse le contenu d'un fichier pending-gifts-{id}.md (YAML frontmatter).
 * Retourne { gifts: [] } si vide ou absent.
 */
export function parsePendingGifts(content: string): PendingGifts {
  if (!content || content.trim() === '') {
    return { gifts: [] };
  }
  // Try JSON first (new format)
  try {
    const gifts: GiftEntry[] = JSON.parse(content);
    return { gifts: Array.isArray(gifts) ? gifts : [] };
  } catch {
    // noop
  }
  // Fallback: parse YAML frontmatter manually (Hermes-safe, no gray-matter)
  try {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return { gifts: [] };
    const yaml = fmMatch[1];
    const gifts: GiftEntry[] = [];
    let current: Record<string, string> = {};
    for (const line of yaml.split('\n')) {
      if (line.match(/^\s+-\s+\w+:/)) {
        // New item — flush previous
        if (current.sender_id) gifts.push(yamlObjToGift(current));
        current = {};
        const [k, v] = splitYamlKV(line.replace(/^\s+-\s+/, ''));
        if (k) current[k] = v;
      } else if (line.match(/^\s+\w+:/) && Object.keys(current).length > 0) {
        const [k, v] = splitYamlKV(line.trim());
        if (k) current[k] = v;
      }
    }
    if (current.sender_id) gifts.push(yamlObjToGift(current));
    return { gifts };
  } catch {
    return { gifts: [] };
  }
}

function splitYamlKV(line: string): [string, string] {
  const idx = line.indexOf(':');
  if (idx < 0) return ['', ''];
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  return [k, v];
}

function yamlObjToGift(obj: Record<string, string>): GiftEntry {
  return {
    sender_id: obj.sender_id ?? '',
    sender_name: obj.sender_name ?? '',
    sender_avatar: obj.sender_avatar ?? '',
    item_type: (obj.item_type ?? 'harvest') as GiftEntry['item_type'],
    item_id: obj.item_id ?? '',
    quantity: parseInt(obj.quantity ?? '1', 10) || 1,
    sent_at: obj.sent_at ?? '',
  };
}

/**
 * Serialise une liste de GiftEntry en JSON (Hermes-safe).
 */
export function serializePendingGifts(gifts: GiftEntry[]): string {
  return JSON.stringify(gifts);
}

// ── Anti-abus journalier ──────────────────────────────────────────────────────

/**
 * Verifie si l'utilisateur peut encore envoyer un cadeau aujourd'hui.
 * Le champ giftsSentField a le format "count|YYYY-MM-DD".
 * Retourne true si count < MAX_GIFTS_PER_DAY ou si la date est differente.
 */
export function canSendGiftToday(
  giftsSentField: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!giftsSentField) return true;
  const todayStr = format(now, 'yyyy-MM-dd');
  const parts = giftsSentField.split('|');
  if (parts.length !== 2) return true;
  const [countStr, dateStr] = parts;
  if (dateStr !== todayStr) return true;
  const count = parseInt(countStr, 10);
  if (isNaN(count)) return true;
  return count < MAX_GIFTS_PER_DAY;
}

/**
 * Incremente le compteur d'envois journaliers.
 * Retourne le nouveau format "count|YYYY-MM-DD".
 * Remet le compteur a 1 si la date a change.
 */
export function incrementGiftsSent(
  giftsSentField: string | undefined,
  now: Date = new Date(),
): string {
  const todayStr = format(now, 'yyyy-MM-dd');
  if (!giftsSentField) return `1|${todayStr}`;
  const parts = giftsSentField.split('|');
  if (parts.length !== 2) return `1|${todayStr}`;
  const [countStr, dateStr] = parts;
  if (dateStr !== todayStr) return `1|${todayStr}`;
  const count = parseInt(countStr, 10);
  if (isNaN(count)) return `1|${todayStr}`;
  return `${count + 1}|${todayStr}`;
}

// ── Transfert d'inventaire ────────────────────────────────────────────────────

/**
 * Ajoute un GiftEntry dans le bon inventaire de FarmProfileData.
 * Supporte 4 types : harvest, rare_seed, crafted, building_resource.
 * Retourne une copie modifiee de farmData (ne mute pas l'original).
 */
export function addGiftToInventory(
  farmData: FarmProfileData,
  entry: GiftEntry,
): FarmProfileData {
  const { item_type, item_id, quantity } = entry;

  switch (item_type) {
    case 'harvest': {
      const inv: HarvestInventory = { ...(farmData.harvestInventory ?? {}) };
      inv[item_id] = (inv[item_id] ?? 0) + quantity;
      return { ...farmData, harvestInventory: inv };
    }

    case 'rare_seed': {
      const inv: RareSeedInventory = { ...(farmData.farmRareSeeds ?? {}) };
      inv[item_id] = (inv[item_id] ?? 0) + quantity;
      return { ...farmData, farmRareSeeds: inv };
    }

    case 'crafted': {
      const existingItems: CraftedItem[] = [...(farmData.craftedItems ?? [])];
      // Verifier si un item avec le meme recipeId existe deja (non-golden)
      // Pour simplifier le transfert cadeau on ajoute toujours un nouvel item
      existingItems.push({ recipeId: item_id, craftedAt: entry.sent_at });
      return { ...farmData, craftedItems: existingItems };
    }

    case 'building_resource': {
      const inv: FarmInventory = { ...(farmData.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 }) };
      const key = item_id as keyof FarmInventory;
      if (key in inv) {
        inv[key] = (inv[key] ?? 0) + quantity;
      }
      return { ...farmData, farmInventory: inv };
    }

    default:
      return farmData;
  }
}

/**
 * Retire une quantite d'un item de l'inventaire.
 * Retourne { success: false, updated: farmData } si quantite insuffisante.
 * Retourne { success: true, updated } si la retrait a reussi.
 */
export function removeFromInventory(
  farmData: FarmProfileData,
  itemType: string,
  itemId: string,
  qty: number,
): { success: boolean; updated: FarmProfileData } {
  const failure = { success: false, updated: farmData };

  switch (itemType) {
    case 'harvest': {
      const inv: HarvestInventory = { ...(farmData.harvestInventory ?? {}) };
      const current = inv[itemId] ?? 0;
      if (current < qty) return failure;
      inv[itemId] = current - qty;
      return { success: true, updated: { ...farmData, harvestInventory: inv } };
    }

    case 'rare_seed': {
      const inv: RareSeedInventory = { ...(farmData.farmRareSeeds ?? {}) };
      const current = inv[itemId] ?? 0;
      if (current < qty) return failure;
      inv[itemId] = current - qty;
      return { success: true, updated: { ...farmData, farmRareSeeds: inv } };
    }

    case 'crafted': {
      const items: CraftedItem[] = [...(farmData.craftedItems ?? [])];
      const idx = items.findIndex(i => i.recipeId === itemId);
      if (idx < 0) return failure;
      items.splice(idx, 1);
      return { success: true, updated: { ...farmData, craftedItems: items } };
    }

    case 'building_resource': {
      const inv: FarmInventory = { ...(farmData.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 }) };
      const key = itemId as keyof FarmInventory;
      const current = (inv[key] ?? 0);
      if (current < qty) return failure;
      inv[key] = current - qty;
      return { success: true, updated: { ...farmData, farmInventory: inv } };
    }

    default:
      return failure;
  }
}

// ── Historique CSV ────────────────────────────────────────────────────────────

/**
 * Construit une entree d'historique au format pipe-separe.
 * Format : "ISO|direction|fromId->toId|type:itemId:qty"
 */
export function buildGiftHistoryEntry(
  direction: 'sent' | 'received',
  fromId: string,
  toId: string,
  itemType: string,
  itemId: string,
  qty: number,
  now: Date = new Date(),
): string {
  const iso = now.toISOString();
  return `${iso}|${direction}|${fromId}->${toId}|${itemType}:${itemId}:${qty}`;
}

/**
 * Parse un CSV (entrees separees par virgule) d'historique de cadeaux.
 * Chaque entree a le format "ISO|direction|fromId->toId|type:itemId:qty".
 * Limite le resultat a 10 entrees maximum.
 */
export function parseGiftHistory(csv: string | undefined): GiftHistoryEntry[] {
  if (!csv || csv.trim() === '') return [];

  const entries = csv.split(',').slice(0, 10);
  const result: GiftHistoryEntry[] = [];

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Format: ISO|direction|fromId->toId|type:itemId:qty
    const pipeParts = trimmed.split('|');
    if (pipeParts.length < 4) continue;

    const [date, direction, participants, itemPart] = pipeParts;
    if (!date || !direction || !participants || !itemPart) continue;

    const arrowIdx = participants.indexOf('->');
    if (arrowIdx < 0) continue;
    const fromId = participants.slice(0, arrowIdx);
    const toId = participants.slice(arrowIdx + 2);

    const itemColons = itemPart.split(':');
    if (itemColons.length < 3) continue;
    const [itemType, itemId, qtyStr] = itemColons;
    const quantity = parseInt(qtyStr, 10);
    if (isNaN(quantity)) continue;

    result.push({
      date,
      direction: direction as 'sent' | 'received',
      fromId,
      toId,
      itemType,
      itemId,
      quantity,
    });
  }

  return result;
}
