// lib/village/market-engine.ts
// Moteur pur Marché Boursier Village — prix dynamiques offre/demande, FOMO.
// Module pur TypeScript — zéro import hook/context.
// Le marché a un stock propre. Les prix fluctuent selon le stock courant vs stock d'équilibre.
// Formule : price = basePrice * (refStock / currentStock) ^ elasticity

import { BUILDINGS_CATALOG } from './catalog';
import { CROP_CATALOG } from '../mascot/types';
import { CRAFT_RECIPES } from '../mascot/craft-engine';
import { VILLAGE_RECIPES } from './atelier-engine';
import type { MarketStock, MarketTransaction } from './types';

// Re-export pour accès direct depuis le barrel
export type { MarketStock, MarketTransaction } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Élasticité prix — 0.7 = volatilité modérée, stock /4 → prix ×2.6 */
const ELASTICITY = 0.7;

/** Plancher prix (ratio vs base) — jamais en dessous de 25% du prix de base */
const MIN_PRICE_RATIO = 0.25;

/** Plafond prix (ratio vs base) — jamais au-dessus de 4x le prix de base */
const MAX_PRICE_RATIO = 4.0;

/** Le marché achète à 70% du prix courant (spread 30%) */
const SELL_SPREAD = 0.7;

/** Nombre max de transactions par jour par profil */
export const MAX_MARKET_TXN_PER_DAY = 10;

/** Taille max du log de transactions (les plus anciennes sont purgées) */
export const MAX_TRANSACTION_LOG = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MarketCategory = 'village' | 'farm' | 'harvest' | 'crafted' | 'village_craft';

export interface MarketItemDef {
  itemId: string;
  category: MarketCategory;
  label: string;
  emoji: string;
  basePrice: number;       // prix de base en 🍃
  initialStock: number;    // stock de départ du marché
  referenceStock: number;  // stock d'équilibre (calcul prix)
}

/** Tendance de prix (vs prix de base) */
export type PriceTrend = 'tres_cher' | 'cher' | 'normal' | 'bon_prix' | 'brade';

/** Niveau de stock du marché */
export type StockLevel = 'rupture' | 'faible' | 'normal' | 'abondant';

/** Résumé d'un item au marché (pour l'affichage UI) */
export interface MarketItemSummary {
  def: MarketItemDef;
  stock: number;
  buyPrice: number;
  sellPrice: number;
  trend: PriceTrend;
  stockLevel: StockLevel;
  trendEmoji: string;
  stockEmoji: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue des items échangeables au marché
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catalogue marché — TOUS les items échangeables (sauf décorations/inhabitants).
 *
 * Calibrage prix — logique boursière basée sur la valeur intrinsèque :
 *   - harvest  : basePrice ≈ harvestReward × 0.7 (coût d'opportunité récolte)
 *   - farm     : basePrice ≈ BUILDING_RESOURCE_VALUE × 0.7
 *   - crafted  : basePrice ≈ sellValue × 0.55 (sous la vente directe NPC)
 *   - village  : échelle propre (production collective, valeurs basses)
 *   - village_craft : xpBonus × 3 (crafts collectifs rares)
 *
 * Dynamique visée :
 *   - Cultiver soi-même + vente directe NPC = le plus rentable
 *   - Acheter au marché pour crafter = viable mais coûteux (~break-even marché-à-marché)
 *   - Vendre au marché = moins que NPC mais liquidité immédiate
 *   - Pas d'arbitrage facile (acheter pas cher → crafter → revendre x10)
 *
 * Stock initial ≈ referenceStock × 1.2 pour démarrer avec un marché sain.
 *
 * Catégories :
 * - village : items produits par les bâtiments village (inventaire collectif)
 * - farm : ressources des bâtiments ferme (oeuf/lait/farine/miel — per-profile)
 * - harvest : récoltes cultures (per-profile HarvestInventory)
 * - crafted : items craftés ferme (per-profile CraftedItem[])
 * - village_craft : items craftés atelier village (inventaire collectif — résultats des recettes)
 */
export const MARKET_ITEMS: MarketItemDef[] = [
  // ── Village items — production bâtiments collectifs ──
  { itemId: 'eau_fraiche',     category: 'village', label: 'Eau fraîche',     emoji: '💧', basePrice: 3,  initialStock: 25, referenceStock: 20 },
  { itemId: 'pain_frais',     category: 'village', label: 'Pain frais',      emoji: '🍞', basePrice: 5,  initialStock: 20, referenceStock: 15 },
  { itemId: 'cafe_matin',     category: 'village', label: 'Café du matin',   emoji: '☕', basePrice: 12, initialStock: 12, referenceStock: 10 },
  { itemId: 'outil_forge',    category: 'village', label: 'Outil forgé',     emoji: '🔨', basePrice: 25, initialStock: 8,  referenceStock: 8 },
  { itemId: 'farine_moulee',  category: 'village', label: 'Farine moulue',   emoji: '🌾', basePrice: 18, initialStock: 10, referenceStock: 10 },
  { itemId: 'coffre_maritime', category: 'village', label: 'Coffre maritime', emoji: '⚓', basePrice: 35, initialStock: 5,  referenceStock: 5 },
  { itemId: 'parchemin',      category: 'village', label: 'Parchemin',       emoji: '📚', basePrice: 50, initialStock: 4,  referenceStock: 4 },

  // ── Farm items — ressources bâtiments ferme (per-profile) ──
  // basePrice ≈ BUILDING_RESOURCE_VALUE × 0.7
  { itemId: 'oeuf',   category: 'farm', label: 'Œufs',   emoji: '🥚', basePrice: 55,  initialStock: 15, referenceStock: 12 },
  { itemId: 'lait',   category: 'farm', label: 'Lait',   emoji: '🥛', basePrice: 70,  initialStock: 12, referenceStock: 10 },
  { itemId: 'farine', category: 'farm', label: 'Farine', emoji: '🌾', basePrice: 65,  initialStock: 12, referenceStock: 10 },
  { itemId: 'miel',   category: 'farm', label: 'Miel',   emoji: '🍯', basePrice: 85, initialStock: 8,  referenceStock: 8 },

  // ── Harvest items — récoltes cultures (per-profile) ──
  // basePrice ≈ harvestReward × 0.7 (coût d'opportunité)
  // Rapides (tasksPerStage=1)
  { itemId: 'carrot',     category: 'harvest', label: 'Carotte',      emoji: '🥕', basePrice: 18,  initialStock: 20, referenceStock: 15 },
  { itemId: 'wheat',      category: 'harvest', label: 'Blé',          emoji: '🌾', basePrice: 28,  initialStock: 18, referenceStock: 15 },
  { itemId: 'potato',     category: 'harvest', label: 'Pomme de terre', emoji: '🥔', basePrice: 25, initialStock: 18, referenceStock: 15 },
  { itemId: 'beetroot',   category: 'harvest', label: 'Betterave',    emoji: '🫜', basePrice: 20,  initialStock: 18, referenceStock: 15 },
  // Moyennes (tasksPerStage=2)
  { itemId: 'tomato',     category: 'harvest', label: 'Tomate',       emoji: '🍅', basePrice: 55,  initialStock: 12, referenceStock: 10 },
  { itemId: 'cabbage',    category: 'harvest', label: 'Chou',         emoji: '🥬', basePrice: 50,  initialStock: 12, referenceStock: 10 },
  { itemId: 'cucumber',   category: 'harvest', label: 'Concombre',    emoji: '🥒', basePrice: 52,  initialStock: 12, referenceStock: 10 },
  { itemId: 'sunflower',  category: 'harvest', label: 'Tournesol',    emoji: '🌻', basePrice: 70, initialStock: 10, referenceStock: 8 },
  // Lentes (tasksPerStage=3+)
  { itemId: 'corn',       category: 'harvest', label: 'Maïs',         emoji: '🌽', basePrice: 105, initialStock: 6,  referenceStock: 5 },
  { itemId: 'strawberry', category: 'harvest', label: 'Fraise',       emoji: '🍓', basePrice: 85, initialStock: 8,  referenceStock: 6 },
  { itemId: 'pumpkin',    category: 'harvest', label: 'Citrouille',   emoji: '🎃', basePrice: 140, initialStock: 4,  referenceStock: 4 },
  // Rares (dropOnly) — très cher, stock très bas
  { itemId: 'orchidee',     category: 'harvest', label: 'Orchidée',       emoji: '🪻', basePrice: 210, initialStock: 2, referenceStock: 2 },
  { itemId: 'rose_doree',   category: 'harvest', label: 'Rose dorée',     emoji: '🌹', basePrice: 350, initialStock: 1, referenceStock: 1 },
  { itemId: 'truffe',       category: 'harvest', label: 'Truffe',         emoji: '🍄', basePrice: 560, initialStock: 1, referenceStock: 1 },
  { itemId: 'fruit_dragon', category: 'harvest', label: 'Fruit du dragon', emoji: '🐉', basePrice: 420, initialStock: 1, referenceStock: 1 },

  // ── Crafted items — recettes ferme (per-profile CraftedItem[]) ──
  // basePrice ≈ sellValue × 0.55 (sous la vente directe NPC, au-dessus du coût ingrédients)
  { itemId: 'soupe',             category: 'crafted', label: 'Soupe du potager',       emoji: '🥣', basePrice: 80,   initialStock: 5, referenceStock: 4 },
  { itemId: 'bouquet',           category: 'crafted', label: 'Bouquet champêtre',     emoji: '💐', basePrice: 110,  initialStock: 4, referenceStock: 3 },
  { itemId: 'crepe',             category: 'crafted', label: 'Crêpe fermière',        emoji: '🥞', basePrice: 120,  initialStock: 4, referenceStock: 3 },
  { itemId: 'bortsch',           category: 'crafted', label: 'Bortsch de betteraves', emoji: '🍲', basePrice: 70,   initialStock: 5, referenceStock: 4 },
  { itemId: 'fromage',           category: 'crafted', label: 'Fromage frais',         emoji: '🧀', basePrice: 265,  initialStock: 3, referenceStock: 2 },
  { itemId: 'gratin',            category: 'crafted', label: 'Gratin dauphinois',     emoji: '🫕', basePrice: 240,  initialStock: 3, referenceStock: 2 },
  { itemId: 'omelette',          category: 'crafted', label: 'Omelette fermière',     emoji: '🍳', basePrice: 240,  initialStock: 3, referenceStock: 2 },
  { itemId: 'hydromel',          category: 'crafted', label: 'Hydromel',           emoji: '🍯', basePrice: 365,  initialStock: 2, referenceStock: 2 },
  { itemId: 'nougat',            category: 'crafted', label: 'Nougat',             emoji: '🍬', basePrice: 420,  initialStock: 2, referenceStock: 2 },
  { itemId: 'pain_epices',       category: 'crafted', label: 'Pain d\'épices',     emoji: '🍪', basePrice: 310,  initialStock: 2, referenceStock: 2 },
  { itemId: 'parfum_orchidee',   category: 'crafted', label: 'Parfum d\'orchidée', emoji: '🪻', basePrice: 660, initialStock: 1, referenceStock: 1 },
  { itemId: 'gaspacho',          category: 'crafted', label: 'Gaspacho frais',        emoji: '🥗', basePrice: 200,  initialStock: 3, referenceStock: 3 },
  { itemId: 'pain',              category: 'crafted', label: 'Pain de campagne',      emoji: '🍞', basePrice: 265,  initialStock: 3, referenceStock: 2 },
  { itemId: 'confiture',         category: 'crafted', label: 'Confiture de fraises',  emoji: '🍓', basePrice: 255,  initialStock: 3, referenceStock: 2 },
  { itemId: 'popcorn',           category: 'crafted', label: 'Pop-corn',              emoji: '🍿', basePrice: 295,  initialStock: 2, referenceStock: 2 },
  { itemId: 'huile_tournesol',   category: 'crafted', label: 'Huile de tournesol', emoji: '🫙', basePrice: 275,  initialStock: 2, referenceStock: 2 },
  { itemId: 'brioche_tournesol', category: 'crafted', label: 'Brioche au tournesol', emoji: '🥐', basePrice: 240,  initialStock: 3, referenceStock: 2 },
  { itemId: 'gateau',            category: 'crafted', label: 'Gâteau fermier',      emoji: '🎂', basePrice: 295,  initialStock: 2, referenceStock: 2 },
  { itemId: 'confiture_royale',  category: 'crafted', label: 'Confiture royale',   emoji: '🌹', basePrice: 825, initialStock: 1, referenceStock: 1 },
  { itemId: 'soupe_citrouille',  category: 'crafted', label: 'Soupe de citrouille',  emoji: '🎃', basePrice: 310, initialStock: 2, referenceStock: 2 },
  { itemId: 'tarte_citrouille',  category: 'crafted', label: 'Tarte à la citrouille', emoji: '🥧', basePrice: 385,  initialStock: 2, referenceStock: 2 },
  { itemId: 'risotto_truffe',    category: 'crafted', label: 'Risotto de truffe',   emoji: '🍄', basePrice: 1100, initialStock: 1, referenceStock: 1 },
  { itemId: 'elixir_dragon',     category: 'crafted', label: 'Élixir du dragon',   emoji: '🐲', basePrice: 880, initialStock: 1, referenceStock: 1 },
  { itemId: 'galette_royale',    category: 'crafted', label: 'Galette des rois',    emoji: '👑', basePrice: 605, initialStock: 1, referenceStock: 1 },

  // ── Village craft items — recettes atelier village (inventaire collectif) ──
  // Prix basé sur xpBonus × 3 (les crafts village sont rares et collectifs)
  { itemId: 'soupe_village',     category: 'village_craft', label: 'Soupe du village',   emoji: '🍲', basePrice: 45,  initialStock: 2, referenceStock: 2 },
  { itemId: 'cafe_gourmand',     category: 'village_craft', label: 'Café gourmand',      emoji: '☕', basePrice: 60,  initialStock: 2, referenceStock: 2 },
  { itemId: 'fougasse',          category: 'village_craft', label: 'Fougasse',            emoji: '🥖', basePrice: 75,  initialStock: 2, referenceStock: 2 },
  { itemId: 'tarte_moulin',      category: 'village_craft', label: 'Tarte du moulin',    emoji: '🥧', basePrice: 165, initialStock: 1, referenceStock: 1 },
  { itemId: 'livre_recettes',    category: 'village_craft', label: 'Livre de recettes',  emoji: '📝', basePrice: 225, initialStock: 1, referenceStock: 1 },
  { itemId: 'outil_artisan',     category: 'village_craft', label: 'Outil d\'artisan',   emoji: '⚒️', basePrice: 360, initialStock: 1, referenceStock: 1 },
  { itemId: 'coffre_fort',       category: 'village_craft', label: 'Coffre-fort',        emoji: '💎', basePrice: 390, initialStock: 1, referenceStock: 1 },
  { itemId: 'parchemin_enluminé', category: 'village_craft', label: 'Parchemin enluminé', emoji: '📜', basePrice: 420, initialStock: 1, referenceStock: 1 },
  { itemId: 'tresor_familial',   category: 'village_craft', label: 'Trésor familial',    emoji: '🌟', basePrice: 1200, initialStock: 0, referenceStock: 1 },
  { itemId: 'grand_festin',      category: 'village_craft', label: 'Grand Festin',       emoji: '🎁', basePrice: 750, initialStock: 0, referenceStock: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Deal du jour — FOMO quotidien (stock séparé du marché, quota per-profil)
// ─────────────────────────────────────────────────────────────────────────────

/** Réduction appliquée au deal du jour (50% du prix d'achat courant) */
const DAILY_DEAL_DISCOUNT = 0.5;

/** Quota d'achats du deal du jour par profil et par jour */
export const DAILY_DEAL_STOCK_PER_PROFILE = 2;

export interface DailyDeal {
  def: MarketItemDef;
  discountedPrice: number;
  originalPrice: number;
  dateKey: string;           // YYYY-MM-DD — change chaque jour
  remaining: number;         // Achats restants pour ce profil aujourd'hui
}

/**
 * Hash déterministe simple d'une string → nombre positif.
 * Même date → même item chaque jour, pour tous les profils.
 */
function hashDateString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Retourne le deal du jour — un item tiré d'un pool STABLE (initialStock > 0) à -50%.
 *
 * Pool stable : on filtre sur `initialStock > 0` (pas sur le stock courant) donc
 *  - L'item ne disparaît jamais quand marketStock tombe à 0 (stock séparé du marché)
 *  - Exclut tresor_familial et grand_festin (initialStock=0, unlocks spéciaux)
 *
 * Quota per-profil : si profileDealPurchases est fourni ET concerne le même
 * itemId + dateKey, on calcule remaining. Au-delà du quota (>= DAILY_DEAL_STOCK_PER_PROFILE),
 * retourne null (la carte disparaît côté UI).
 *
 * Le deal change à minuit (nouveau dateKey) OU quand l'itemId change (reset compteur).
 */
export function getDailyDeal(
  marketStock: MarketStock,
  now: Date = new Date(),
  profileDealPurchases?: { dateKey: string; itemId: string; purchased: number },
): DailyDeal | null {
  const dateKey = formatDateYMD(now);
  const hash = hashDateString(`deal-${dateKey}`);

  // Pool STABLE basé sur initialStock > 0 (exclut tresor_familial, grand_festin)
  // → l'item du deal ne disparaît pas quand marketStock[item] tombe à 0
  // Exclut les items collectifs (village/village_craft) — ils vont dans l'inventaire commun, pas le deal perso
  const eligible = MARKET_ITEMS.filter(item => item.initialStock > 0 && item.category !== 'village_craft');
  if (eligible.length === 0) return null;

  const picked = eligible[hash % eligible.length];
  // Prix calculé sur le stock marché courant (ou referenceStock si rupture)
  // — pour garder un prix cohérent même si le marché est à 0
  const stockForPrice = Math.max(1, marketStock[picked.itemId] ?? picked.referenceStock);
  const originalPrice = getBuyPrice(picked, stockForPrice);
  const discountedPrice = Math.max(1, Math.round(originalPrice * DAILY_DEAL_DISCOUNT));

  // Calcul du remaining : seulement si même date ET même item
  const purchasedToday =
    profileDealPurchases &&
    profileDealPurchases.dateKey === dateKey &&
    profileDealPurchases.itemId === picked.itemId
      ? profileDealPurchases.purchased
      : 0;
  const remaining = DAILY_DEAL_STOCK_PER_PROFILE - purchasedToday;
  if (remaining <= 0) return null;

  return { def: picked, discountedPrice, originalPrice, dateKey, remaining };
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcul de prix — formule bourse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prix brut calculé selon l'offre et la demande.
 * Formule : basePrice × (refStock / currentStock) ^ elasticity
 * - Stock bas → ratio élevé → prix monte (FOMO)
 * - Stock haut → ratio bas → prix baisse (soldes)
 */
function rawPrice(basePrice: number, currentStock: number, referenceStock: number): number {
  const ratio = referenceStock / Math.max(1, currentStock);
  const multiplier = Math.pow(ratio, ELASTICITY);
  const clamped = Math.max(MIN_PRICE_RATIO, Math.min(MAX_PRICE_RATIO, multiplier));
  return Math.round(basePrice * clamped);
}

/** Prix d'achat (le profil paie ce prix pour acheter au marché) */
export function getBuyPrice(def: MarketItemDef, currentStock: number): number {
  return Math.max(1, rawPrice(def.basePrice, currentStock, def.referenceStock));
}

/**
 * Prix de vente (le marché paie ce prix pour racheter au profil).
 * Spread 30% — le marché prend toujours une marge.
 */
export function getSellPrice(def: MarketItemDef, currentStock: number): number {
  return Math.max(1, Math.floor(rawPrice(def.basePrice, currentStock, def.referenceStock) * SELL_SPREAD));
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicateurs FOMO
// ─────────────────────────────────────────────────────────────────────────────

/** Tendance prix par rapport au prix de base */
export function getPriceTrend(currentBuyPrice: number, basePrice: number): PriceTrend {
  const ratio = currentBuyPrice / basePrice;
  if (ratio >= 3.0) return 'tres_cher';
  if (ratio >= 1.5) return 'cher';
  if (ratio >= 0.7) return 'normal';
  if (ratio >= 0.4) return 'bon_prix';
  return 'brade';
}

/** Emoji indicateur de tendance */
export function getTrendEmoji(trend: PriceTrend): string {
  switch (trend) {
    case 'tres_cher': return '🔴';
    case 'cher':      return '🟠';
    case 'normal':    return '⚪';
    case 'bon_prix':  return '🟢';
    case 'brade':     return '🔵';
  }
}

/** Label tendance français */
export function getTrendLabel(trend: PriceTrend): string {
  switch (trend) {
    case 'tres_cher': return 'Très cher';
    case 'cher':      return 'En hausse';
    case 'normal':    return 'Normal';
    case 'bon_prix':  return 'Bon prix';
    case 'brade':     return 'Bradé !';
  }
}

/** Niveau de stock relatif */
export function getStockLevel(currentStock: number, referenceStock: number): StockLevel {
  const ratio = currentStock / Math.max(1, referenceStock);
  if (ratio <= 0.1) return 'rupture';
  if (ratio <= 0.35) return 'faible';
  if (ratio <= 1.5) return 'normal';
  return 'abondant';
}

/** Emoji indicateur de stock */
export function getStockEmoji(level: StockLevel): string {
  switch (level) {
    case 'rupture':  return '🚨';
    case 'faible':   return '⚠️';
    case 'normal':   return '📦';
    case 'abondant': return '📦📦';
  }
}

/** Label stock français */
export function getStockLabel(level: StockLevel): string {
  switch (level) {
    case 'rupture':  return 'En rupture !';
    case 'faible':   return 'Stock faible';
    case 'normal':   return 'Disponible';
    case 'abondant': return 'Abondant';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Résumé par item (pour l'UI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit le résumé complet d'un item pour l'affichage au marché.
 */
export function getMarketItemSummary(def: MarketItemDef, marketStock: MarketStock): MarketItemSummary {
  const stock = marketStock[def.itemId] ?? 0;
  const buyPrice = getBuyPrice(def, stock);
  const sellPrice = getSellPrice(def, stock);
  const trend = getPriceTrend(buyPrice, def.basePrice);
  const stockLevel = getStockLevel(stock, def.referenceStock);
  return {
    def,
    stock,
    buyPrice,
    sellPrice,
    trend,
    stockLevel,
    trendEmoji: getTrendEmoji(trend),
    stockEmoji: getStockEmoji(stockLevel),
  };
}

/** Résumé de tous les items du marché */
export function getAllMarketSummaries(marketStock: MarketStock): MarketItemSummary[] {
  return MARKET_ITEMS.map(def => getMarketItemSummary(def, marketStock));
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation & Exécution (fonctions pures)
// ─────────────────────────────────────────────────────────────────────────────

/** Trouve la définition d'un item marché par son ID */
export function findMarketItem(itemId: string): MarketItemDef | undefined {
  return MARKET_ITEMS.find(m => m.itemId === itemId);
}

/**
 * Vérifie si un achat est possible.
 * Le profil achète `quantity` items au marché → il paie des coins, le stock baisse.
 */
export function canBuyItem(
  itemId: string,
  quantity: number,
  marketStock: MarketStock,
  profileCoins: number,
  priceOverride?: number,
): { canBuy: boolean; totalCost: number; reason?: string } {
  const def = findMarketItem(itemId);
  if (!def) return { canBuy: false, totalCost: 0, reason: 'Article introuvable' };

  const stock = marketStock[def.itemId] ?? 0;
  if (stock < quantity) {
    return { canBuy: false, totalCost: 0, reason: `Stock insuffisant (${stock} dispo)` };
  }

  const unitPrice = priceOverride ?? getBuyPrice(def, stock);
  const totalCost = unitPrice * quantity;
  if (profileCoins < totalCost) {
    return { canBuy: false, totalCost, reason: `Pas assez de 🍃 (${profileCoins} / ${totalCost})` };
  }

  return { canBuy: true, totalCost };
}

/**
 * Vérifie si une vente est possible.
 * Le profil vend `quantity` items au marché → il reçoit des coins, le stock monte.
 * `profileItemCount` = quantité que le profil possède de cet item.
 */
export function canSellItem(
  itemId: string,
  quantity: number,
  marketStock: MarketStock,
  profileItemCount: number,
): { canSell: boolean; totalGain: number; reason?: string } {
  const def = findMarketItem(itemId);
  if (!def) return { canSell: false, totalGain: 0, reason: 'Article introuvable' };

  if (profileItemCount < quantity) {
    return { canSell: false, totalGain: 0, reason: `Vous n'avez que ${profileItemCount}` };
  }

  const stock = marketStock[def.itemId] ?? 0;
  const unitPrice = getSellPrice(def, stock);
  const totalGain = unitPrice * quantity;

  return { canSell: true, totalGain };
}

/**
 * Exécute un achat (pur — retourne le nouveau stock et la transaction).
 * NE mute PAS les entrées.
 */
export function executeBuy(
  itemId: string,
  quantity: number,
  profileId: string,
  marketStock: MarketStock,
  now: Date = new Date(),
  priceOverride?: number,
): { newStock: MarketStock; transaction: MarketTransaction; totalCost: number } {
  const def = findMarketItem(itemId)!;
  const stock = marketStock[def.itemId] ?? 0;
  const unitPrice = priceOverride ?? getBuyPrice(def, stock);
  const totalCost = unitPrice * quantity;

  const newStock = { ...marketStock };
  newStock[def.itemId] = Math.max(0, stock - quantity);

  const transaction: MarketTransaction = {
    timestamp: now.toISOString().replace('Z', '').split('.')[0],
    profileId,
    action: 'buy',
    itemId,
    quantity,
    unitPrice,
    totalPrice: totalCost,
  };

  return { newStock, transaction, totalCost };
}

/**
 * Exécute une vente (pur — retourne le nouveau stock et la transaction).
 * NE mute PAS les entrées.
 */
export function executeSell(
  itemId: string,
  quantity: number,
  profileId: string,
  marketStock: MarketStock,
  now: Date = new Date(),
): { newStock: MarketStock; transaction: MarketTransaction; totalGain: number } {
  const def = findMarketItem(itemId)!;
  const stock = marketStock[def.itemId] ?? 0;
  const unitPrice = getSellPrice(def, stock);
  const totalGain = unitPrice * quantity;

  const newStock = { ...marketStock };
  newStock[def.itemId] = stock + quantity;

  const transaction: MarketTransaction = {
    timestamp: now.toISOString().replace('Z', '').split('.')[0],
    profileId,
    action: 'sell',
    itemId,
    quantity,
    unitPrice,
    totalPrice: totalGain,
  };

  return { newStock, transaction, totalGain };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting — 10 transactions / jour / profil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compte les transactions d'un profil aujourd'hui.
 */
export function getTransactionsToday(
  transactions: MarketTransaction[],
  profileId: string,
  now: Date = new Date(),
): number {
  const todayStr = formatDateYMD(now);
  return transactions.filter(
    t => t.profileId === profileId && t.timestamp.startsWith(todayStr),
  ).length;
}

/**
 * Vérifie si le profil peut encore faire une transaction aujourd'hui.
 */
export function canTransactToday(
  transactions: MarketTransaction[],
  profileId: string,
  now: Date = new Date(),
): boolean {
  return getTransactionsToday(transactions, profileId, now) < MAX_MARKET_TXN_PER_DAY;
}

/**
 * Retourne le nombre de transactions restantes aujourd'hui.
 */
export function transactionsRemainingToday(
  transactions: MarketTransaction[],
  profileId: string,
  now: Date = new Date(),
): number {
  return Math.max(0, MAX_MARKET_TXN_PER_DAY - getTransactionsToday(transactions, profileId, now));
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock initial
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise le stock du marché avec les valeurs par défaut.
 * Utilisé à la première ouverture (stock vide → stock initial).
 */
export function initializeMarketStock(): MarketStock {
  const stock: MarketStock = {};
  for (const item of MARKET_ITEMS) {
    stock[item.itemId] = item.initialStock;
  }
  return stock;
}

/**
 * Purge le log de transactions pour ne garder que les N plus récentes.
 */
export function pruneTransactionLog(
  transactions: MarketTransaction[],
  maxSize: number = MAX_TRANSACTION_LOG,
): MarketTransaction[] {
  if (transactions.length <= maxSize) return transactions;
  return transactions.slice(transactions.length - maxSize);
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
