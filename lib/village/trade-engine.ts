// lib/village/trade-engine.ts
// Moteur pur Village Échange inter-familles — encode/decode code-cadeau, validation,
// rate limiting, helpers inventaire.
// Module pur TypeScript — zéro import hook/context (pattern identique à atelier-engine.ts).
// Per ARCH-05 : zéro nouvelle dépendance npm. base36 natif JS (parseInt/toString(36)).

import type { VillageInventory } from './types';
import type { FarmInventory, HarvestInventory, CraftedItem } from '../mascot/types';
import { BUILDINGS_CATALOG } from './catalog';
import { CROP_CATALOG } from '../mascot/types';
import { CRAFT_RECIPES } from '../mascot/craft-engine';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_TRADES_PER_DAY = 5;

/** Durée de validité d'un code-cadeau en millisecondes (48h) */
const TRADE_EXPIRY_MS = 48 * 60 * 60 * 1000;

/** Préfixe identifiant les codes FamilyFlow */
const CODE_PREFIX = 'FF-';

/** Mapping catégorie → char 1 lettre (pour l'encodage) */
const CATEGORY_CHAR: Record<TradeCategory, string> = {
  village: 'V',
  farm: 'F',
  harvest: 'H',
  crafted: 'C',
};

const CHAR_CATEGORY: Record<string, TradeCategory> = {
  V: 'village',
  F: 'farm',
  H: 'harvest',
  C: 'crafted',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TradeCategory = 'village' | 'farm' | 'harvest' | 'crafted';

export interface TradePayload {
  category: TradeCategory;
  itemId: string;
  quantity: number;
  timestamp: number; // epoch seconds
  nonce: number;     // random 0-9999
}

export interface TradeItemOption {
  itemId: string;
  label: string;
  emoji: string;
  available: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registre d'index compact — chaque item échangeable = 2 chars base36
// Évite la troncation des itemIds longs (eau_fraiche, coffre_maritime, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function buildItemRegistry(): { idToCode: Map<string, string>; codeToId: Map<string, string> } {
  const allItems: string[] = [];
  // Village
  for (const b of BUILDINGS_CATALOG) allItems.push(`V:${b.production.itemId}`);
  // Farm
  for (const k of ['oeuf', 'lait', 'farine', 'miel']) allItems.push(`F:${k}`);
  // Harvest
  for (const c of CROP_CATALOG) allItems.push(`H:${c.id}`);
  // Crafted
  for (const r of CRAFT_RECIPES) allItems.push(`C:${r.id}`);

  const idToCode = new Map<string, string>();
  const codeToId = new Map<string, string>();
  for (let i = 0; i < allItems.length; i++) {
    const code = i.toString(36).padStart(2, '0');
    idToCode.set(allItems[i], code);
    codeToId.set(code, allItems[i]);
  }
  return { idToCode, codeToId };
}

const ITEM_REGISTRY = buildItemRegistry();

function itemToCode(category: TradeCategory, itemId: string): string | null {
  const key = `${CATEGORY_CHAR[category]}:${itemId}`;
  return ITEM_REGISTRY.idToCode.get(key) ?? null;
}

function codeToItem(code: string): { category: TradeCategory; itemId: string } | null {
  const entry = ITEM_REGISTRY.codeToId.get(code);
  if (!entry) return null;
  const [catChar, ...rest] = entry.split(':');
  const category = CHAR_CATEGORY[catChar];
  if (!category) return null;
  return { category, itemId: rest.join(':') };
}

// ─────────────────────────────────────────────────────────────────────────────
// Encodage / Décodage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode un TradePayload en code-cadeau partageable.
 * Format : FF-{itemCode2}{qty2}{timestamp6b36}{nonce3b36}{checksum2b36}
 * Total : FF- + 15 chars = 18 chars. Court et partageable.
 */
export function encodeTrade(payload: TradePayload): string {
  const ic = itemToCode(payload.category, payload.itemId);
  if (!ic) return `${CODE_PREFIX}ERR`;
  const qtyStr = Math.min(99, Math.max(1, payload.quantity)).toString().padStart(2, '0');
  const tsB36 = Math.floor(payload.timestamp).toString(36).padStart(6, '0').slice(-6);
  const nonceB36 = payload.nonce.toString(36).padStart(3, '0').slice(-3);

  const payloadStr = `${ic}${qtyStr}${tsB36}${nonceB36}`;

  let sum = 0;
  for (let i = 0; i < payloadStr.length; i++) sum += payloadStr.charCodeAt(i);
  const checksum = (sum % 1296).toString(36).padStart(2, '0');

  return `${CODE_PREFIX}${payloadStr}${checksum}`.toUpperCase();
}

/**
 * Décode un code-cadeau. Retourne null si format invalide ou checksum incorrect.
 */
export function decodeTrade(code: string): TradePayload | null {
  const trimmed = code.trim().toUpperCase().replace(/\s/g, '');
  if (!trimmed.startsWith(CODE_PREFIX.toUpperCase())) return null;

  const body = trimmed.slice(CODE_PREFIX.length).toLowerCase();
  // itemCode(2) + qty(2) + ts(6) + nonce(3) + checksum(2) = 15 chars
  if (body.length !== 15) return null;

  const itemCode = body.slice(0, 2);
  const resolved = codeToItem(itemCode);
  if (!resolved) return null;

  const qtyStr = body.slice(2, 4);
  const quantity = parseInt(qtyStr, 10);
  if (isNaN(quantity) || quantity < 1) return null;

  const tsB36 = body.slice(4, 10);
  const timestamp = parseInt(tsB36, 36);
  if (isNaN(timestamp) || timestamp <= 0) return null;

  const nonceB36 = body.slice(10, 13);
  const nonce = parseInt(nonceB36, 36);
  if (isNaN(nonce)) return null;

  const givenChecksum = body.slice(13, 15);
  const payloadStr = body.slice(0, 13);
  let sum = 0;
  for (let i = 0; i < payloadStr.length; i++) sum += payloadStr.charCodeAt(i);
  const expectedChecksum = (sum % 1296).toString(36).padStart(2, '0');
  if (givenChecksum !== expectedChecksum) return null;

  return { category: resolved.category, itemId: resolved.itemId, quantity, timestamp, nonce };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne true si le code est expiré (plus de 48h depuis le timestamp).
 */
export function isTradeExpired(payload: TradePayload, now: Date = new Date()): boolean {
  const nowMs = now.getTime();
  const createdMs = payload.timestamp * 1000;
  return nowMs - createdMs > TRADE_EXPIRY_MS;
}

/**
 * Retourne true si ce code a déjà été réclamé (lookup dans la liste locale).
 */
export function isTradeAlreadyClaimed(code: string, claimedCodes: string[]): boolean {
  const normalized = code.trim().toUpperCase().replace(/\s/g, '');
  return claimedCodes.some(c => c.trim().toUpperCase().replace(/\s/g, '') === normalized);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers anti-abus journalier (pattern identique à gift-engine.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si l'utilisateur peut encore envoyer un échange aujourd'hui.
 * Champ trade_sent_today au format "count|YYYY-MM-DD".
 */
export function canSendTradeToday(
  tradeSentField: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!tradeSentField) return true;
  const todayStr = formatDateYMD(now);
  const parts = tradeSentField.split('|');
  if (parts.length !== 2) return true;
  const [countStr, dateStr] = parts;
  if (dateStr !== todayStr) return true;
  const count = parseInt(countStr, 10);
  if (isNaN(count)) return true;
  return count < MAX_TRADES_PER_DAY;
}

/**
 * Incrémente le compteur d'envois journaliers.
 * Retourne le nouveau format "count|YYYY-MM-DD".
 */
export function incrementTradesSent(
  tradeSentField: string | undefined,
  now: Date = new Date(),
): string {
  const todayStr = formatDateYMD(now);
  if (!tradeSentField) return `1|${todayStr}`;
  const parts = tradeSentField.split('|');
  if (parts.length !== 2) return `1|${todayStr}`;
  const [countStr, dateStr] = parts;
  if (dateStr !== todayStr) return `1|${todayStr}`;
  const count = parseInt(countStr, 10);
  if (isNaN(count)) return `1|${todayStr}`;
  return `${count + 1}|${todayStr}`;
}

/**
 * Retourne le nombre d'envois restants aujourd'hui.
 */
export function tradesRemainingToday(
  tradeSentField: string | undefined,
  now: Date = new Date(),
): number {
  if (!tradeSentField) return MAX_TRADES_PER_DAY;
  const todayStr = formatDateYMD(now);
  const parts = tradeSentField.split('|');
  if (parts.length !== 2) return MAX_TRADES_PER_DAY;
  const [countStr, dateStr] = parts;
  if (dateStr !== todayStr) return MAX_TRADES_PER_DAY;
  const count = parseInt(countStr, 10);
  if (isNaN(count)) return MAX_TRADES_PER_DAY;
  return Math.max(0, MAX_TRADES_PER_DAY - count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers inventaire — liste des items disponibles par catégorie
// ─────────────────────────────────────────────────────────────────────────────

/** Noms lisibles des ressources ferme */
const FARM_ITEM_META: Record<string, { label: string; emoji: string }> = {
  oeuf:   { label: 'Œufs',   emoji: '🥚' },
  lait:   { label: 'Lait',   emoji: '🥛' },
  farine: { label: 'Farine', emoji: '🌾' },
  miel:   { label: 'Miel',   emoji: '🍯' },
};

/**
 * Retourne la liste des items disponibles à l'envoi pour une catégorie donnée.
 * Filtre les items avec quantité > 0.
 */
export function getAvailableTradeItems(
  category: TradeCategory,
  villageInv: VillageInventory,
  farmInv: FarmInventory,
  harvestInv: HarvestInventory,
  craftedItems?: CraftedItem[],
): TradeItemOption[] {
  switch (category) {
    case 'village': {
      const result: TradeItemOption[] = [];
      for (const entry of BUILDINGS_CATALOG) {
        const { itemId, itemLabel, itemEmoji } = entry.production;
        const available = villageInv[itemId] ?? 0;
        if (available > 0) {
          result.push({ itemId, label: itemLabel, emoji: itemEmoji, available });
        }
      }
      return result;
    }

    case 'farm': {
      const result: TradeItemOption[] = [];
      for (const key of ['oeuf', 'lait', 'farine', 'miel'] as const) {
        const available = farmInv[key] ?? 0;
        if (available > 0) {
          const meta = FARM_ITEM_META[key];
          result.push({ itemId: key, label: meta.label, emoji: meta.emoji, available });
        }
      }
      return result;
    }

    case 'harvest': {
      const result: TradeItemOption[] = [];
      for (const [cropId, available] of Object.entries(harvestInv)) {
        if (available > 0) {
          const cropDef = CROP_CATALOG.find(c => c.id === cropId);
          const label = cropDef?.id ?? cropId;
          const emoji = cropDef?.emoji ?? '🌱';
          result.push({ itemId: cropId, label, emoji, available });
        }
      }
      return result;
    }

    case 'crafted': {
      const result: TradeItemOption[] = [];
      if (!craftedItems) return result;
      // Grouper par recipeId pour compter les quantités
      const counts: Record<string, number> = {};
      for (const item of craftedItems) {
        counts[item.recipeId] = (counts[item.recipeId] ?? 0) + 1;
      }
      for (const [recipeId, available] of Object.entries(counts)) {
        const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
        if (recipe && available > 0) {
          result.push({ itemId: recipeId, label: recipe.labelKey.replace('craft.recipe.', ''), emoji: recipe.emoji, available });
        }
      }
      return result;
    }
  }
}

/**
 * Retourne les métadonnées (label + emoji) d'un item trade à partir de son id et catégorie.
 * Utilisé par la réception pour afficher ce qui a été reçu.
 */
export function getTradeItemMeta(
  category: TradeCategory,
  itemId: string,
): { label: string; emoji: string } {
  switch (category) {
    case 'village': {
      const entry = BUILDINGS_CATALOG.find(b => b.production.itemId === itemId);
      if (entry) {
        return { label: entry.production.itemLabel, emoji: entry.production.itemEmoji };
      }
      return { label: itemId, emoji: '📦' };
    }
    case 'farm': {
      const meta = FARM_ITEM_META[itemId];
      if (meta) return meta;
      return { label: itemId, emoji: '🐾' };
    }
    case 'harvest': {
      const cropDef = CROP_CATALOG.find(c => c.id === itemId);
      if (cropDef) return { label: cropDef.id, emoji: cropDef.emoji };
      return { label: itemId, emoji: '🌱' };
    }
    case 'crafted': {
      const recipe = CRAFT_RECIPES.find(r => r.id === itemId);
      if (recipe) return { label: recipe.labelKey.replace('craft.recipe.', ''), emoji: recipe.emoji };
      return { label: itemId, emoji: '🍳' };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaire interne
// ─────────────────────────────────────────────────────────────────────────────

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
