/**
 * companion-house-engine.ts — logique pure de la maison du compagnon.
 *
 * (Dé)sérialisation du meublage + état de déblocage, et helpers d'achat/placement.
 * Aucune I/O ici (pattern « marché du village » : les helpers sont purs, l'écriture
 * vault vit dans les actions). Coords fractionnaires strictement clampées/validées [0,1].
 * Duplicatas de meubles autorisés → sink infini.
 *
 * Format frontmatter (farm-{id}.md) :
 *   companion_house_unlocked: true
 *   companion_house_unlocked_at: <ISO>
 *   companion_house: "furnitureId:x:y:placedAtISO|..."   (meublage uniquement)
 */

import {
  COMPANION_HOUSE_UNLOCK_COST,
  findFurniture,
  type CompanionHouseData,
  type PlacedFurniture,
} from './companion-house-types';

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

// ─── Sérialisation meublage ──────────────────────────────────────────────────

/** Sérialise les meubles posés en CSV. x/y arrondis à 4 décimales. */
export function serializePlacedFurniture(items: PlacedFurniture[]): string {
  return items
    .map(f => `${f.furnitureId}:${clamp01(f.x).toFixed(4)}:${clamp01(f.y).toFixed(4)}:${f.placedAt}`)
    .join('|');
}

/**
 * Parse le CSV des meubles. Rejette les entrées invalides (id manquant,
 * coords NaN ou hors [0,1]). placedAt = tout ce qui suit x,y (un ISO contient des `:`).
 */
export function parsePlacedFurniture(csv: string | undefined): PlacedFurniture[] {
  if (!csv || !csv.trim()) return [];
  return csv
    .split('|')
    .map(entry => {
      const parts = entry.trim().split(':');
      if (parts.length < 3) return null;
      const [furnitureId, xStr, yStr, ...rest] = parts;
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      if (!furnitureId || isNaN(x) || isNaN(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
      return { furnitureId, x, y, placedAt: rest.join(':') } as PlacedFurniture;
    })
    .filter((f): f is PlacedFurniture => f !== null);
}

// ─── (Dé)sérialisation de l'état maison (flags frontmatter séparés) ───────────

export interface CompanionHouseRaw {
  unlocked?: string;    // props.companion_house_unlocked
  unlockedAt?: string;  // props.companion_house_unlocked_at
  furniture?: string;   // props.companion_house
}

/**
 * Reconstruit l'état maison depuis les champs frontmatter.
 * Renvoie null si la maison n'est ni débloquée ni meublée (pas de bloc à écrire).
 */
export function parseCompanionHouse(raw: CompanionHouseRaw): CompanionHouseData | null {
  const unlocked = raw.unlocked === 'true';
  const placedFurniture = parsePlacedFurniture(raw.furniture);
  if (!unlocked && placedFurniture.length === 0) return null;
  return { unlocked, unlockedAt: raw.unlockedAt || undefined, placedFurniture };
}

/** Produit les lignes frontmatter à pousser (vide si rien à persister). */
export function serializeCompanionHouseLines(data: CompanionHouseData): string[] {
  const lines: string[] = [];
  if (data.unlocked) {
    lines.push('companion_house_unlocked: true');
    if (data.unlockedAt) lines.push(`companion_house_unlocked_at: ${data.unlockedAt}`);
  }
  const furn = serializePlacedFurniture(data.placedFurniture);
  if (furn) lines.push(`companion_house: ${furn}`);
  return lines;
}

// ─── Helpers d'achat (pur — façon canBuyItem du marché) ──────────────────────

/** Peut-on débloquer la maison ? (100k 🍃, one-shot) */
export function canUnlockCompanionHouse(
  coins: number,
  alreadyUnlocked: boolean,
): { ok: boolean; cost: number; reason?: string } {
  const cost = COMPANION_HOUSE_UNLOCK_COST;
  if (alreadyUnlocked) return { ok: false, cost, reason: 'Maison déjà débloquée' };
  if (coins < cost) return { ok: false, cost, reason: `Pas assez de 🍃 (${coins} / ${cost})` };
  return { ok: true, cost };
}

/** Peut-on acheter ce meuble ? (duplicatas autorisés) */
export function canBuyFurniture(
  furnitureId: string,
  coins: number,
): { ok: boolean; cost: number; reason?: string } {
  const def = findFurniture(furnitureId);
  if (!def) return { ok: false, cost: 0, reason: 'Meuble introuvable' };
  if (coins < def.cost) return { ok: false, cost: def.cost, reason: `Pas assez de 🍃 (${coins} / ${def.cost})` };
  return { ok: true, cost: def.cost };
}

// ─── Helpers de placement (pur) ──────────────────────────────────────────────

/** Ajoute un meuble (coords clampées). Retourne une nouvelle liste. */
export function placeFurniture(
  items: PlacedFurniture[],
  furnitureId: string,
  x: number,
  y: number,
  placedAt: string,
): PlacedFurniture[] {
  return [...items, { furnitureId, x: clamp01(x), y: clamp01(y), placedAt }];
}

/** Déplace l'instance à `index` (coords clampées). No-op si index invalide. */
export function moveFurniture(
  items: PlacedFurniture[],
  index: number,
  x: number,
  y: number,
): PlacedFurniture[] {
  if (index < 0 || index >= items.length) return items;
  return items.map((f, i) => (i === index ? { ...f, x: clamp01(x), y: clamp01(y) } : f));
}

/** Retire l'instance à `index`. No-op si index invalide. */
export function removeFurniture(items: PlacedFurniture[], index: number): PlacedFurniture[] {
  if (index < 0 || index >= items.length) return items;
  return items.filter((_, i) => i !== index);
}
