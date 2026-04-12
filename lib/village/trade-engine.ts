// lib/village/trade-engine.ts
// Moteur pur Village Échange inter-familles — encode/decode code-cadeau, validation,
// rate limiting, helpers inventaire.
// Module pur TypeScript — zéro import hook/context (pattern identique à atelier-engine.ts).
// Per ARCH-05 : zéro nouvelle dépendance npm. base36 natif JS (parseInt/toString(36)).

import type { VillageInventory } from './types';
import type { FarmInventory, HarvestInventory } from '../mascot/types';
import { BUILDINGS_CATALOG } from './catalog';
import { CROP_CATALOG } from '../mascot/types';

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
};

const CHAR_CATEGORY: Record<string, TradeCategory> = {
  V: 'village',
  F: 'farm',
  H: 'harvest',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TradeCategory = 'village' | 'farm' | 'harvest';

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
// Encodage / Décodage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode un TradePayload en code-cadeau partageable.
 * Format : FF-{catChar}{itemId8}{qty2}{timestamp6b36}{nonce3b36}{checksum2b36}
 * Utilise base36 pour timestamp et nonce. Checksum 2 chars (base36, mod 1296).
 */
export function encodeTrade(payload: TradePayload): string {
  const catChar = CATEGORY_CHAR[payload.category];
  // itemId tronqué/paddé à 8 chars, alphanumeric uniquement
  const itemIdClean = payload.itemId.replace(/[^a-z0-9_]/gi, '').slice(0, 8).padEnd(8, '0');
  // quantity sur 2 digits décimaux (max 99)
  const qtyStr = Math.min(99, Math.max(1, payload.quantity)).toString().padStart(2, '0');
  // timestamp epoch seconds en base36, 6 chars
  const tsB36 = Math.floor(payload.timestamp).toString(36).padStart(6, '0').slice(-6);
  // nonce 0-9999 en base36, 3 chars
  const nonceB36 = payload.nonce.toString(36).padStart(3, '0').slice(-3);

  const payloadStr = `${catChar}${itemIdClean}${qtyStr}${tsB36}${nonceB36}`;

  // Checksum = somme des code-points modulo 1296, encodée base36 2 chars
  let sum = 0;
  for (let i = 0; i < payloadStr.length; i++) {
    sum += payloadStr.charCodeAt(i);
  }
  const checksum = (sum % 1296).toString(36).padStart(2, '0');

  return `${CODE_PREFIX}${payloadStr}${checksum}`;
}

/**
 * Décode un code-cadeau. Retourne null si format invalide ou checksum incorrect.
 */
export function decodeTrade(code: string): TradePayload | null {
  const trimmed = code.trim().toUpperCase().replace(/\s/g, '');

  if (!trimmed.startsWith(CODE_PREFIX.toUpperCase())) return null;

  const body = trimmed.slice(CODE_PREFIX.length);
  // Structure attendue : catChar(1) + itemId8(8) + qty2(2) + ts6(6) + nonce3(3) + checksum2(2) = 22 chars
  if (body.length !== 22) return null;

  const catChar = body[0];
  const category = CHAR_CATEGORY[catChar];
  if (!category) return null;

  // Retirer le padding de zéros trailing de l'itemId
  const itemId = body.slice(1, 9).toLowerCase().replace(/0+$/, '');
  if (!itemId) return null;

  const qtyStr = body.slice(9, 11);
  const quantity = parseInt(qtyStr, 10);
  if (isNaN(quantity) || quantity < 1) return null;

  const tsB36 = body.slice(11, 17).toLowerCase();
  const timestamp = parseInt(tsB36, 36);
  if (isNaN(timestamp) || timestamp <= 0) return null;

  const nonceB36 = body.slice(17, 20).toLowerCase();
  const nonce = parseInt(nonceB36, 36);
  if (isNaN(nonce)) return null;

  const givenChecksum = body.slice(20, 22).toLowerCase();

  // Recalculer le checksum sur la partie payload (sans checksum)
  const payloadStr = body.slice(0, 20).toLowerCase();
  let sum = 0;
  for (let i = 0; i < payloadStr.length; i++) {
    sum += payloadStr.charCodeAt(i);
  }
  const expectedChecksum = (sum % 1296).toString(36).padStart(2, '0');

  if (givenChecksum !== expectedChecksum) return null;

  return { category, itemId, quantity, timestamp, nonce };
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
