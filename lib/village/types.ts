// lib/village/types.ts
// Interfaces du module Village — Jardin Familial (Phase 25, v1.4).
// Module pur TypeScript — zéro import hook/context.

// Phase 29 : ajout role 'avatar' (VILL-01)
// Phase 30 : ajout role 'building' (VILL-05)
/** Role d'un element interactif sur la place du village */
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal' | 'avatar' | 'building';

/** Position d'un element interactif dans la grille village (per D-02 — type dedie, pas WorldCell) */
export interface VillageCell {
  id: string;        // DOIT commencer par 'village_' (per D-11)
  x: number;         // fraction largeur conteneur (0-1)
  y: number;         // fraction hauteur conteneur (0-1)
  role: VillageRole;
}

/** Type de contribution au village (per D-04 — 1 point chacun) */
export type ContributionType = 'harvest' | 'task';

/** Une contribution au village — ligne append-only (per D-10) */
export interface VillageContribution {
  timestamp: string;          // ISO 8601 sans Z — ex: 2026-04-10T14:32:00 (convention museum)
  profileId: string;
  type: ContributionType;
  amount: number;             // toujours 1 per D-04
}

/** Record d'une semaine passee dans l'historique */
export interface VillageWeekRecord {
  weekStart: string;          // YYYY-MM-DD
  target: number;
  total: number;
  claimed: boolean;
  contributionsByMember?: Record<string, number>; // profileId → total contributions (HIST-02)
}

/** Un bâtiment débloqué — ligne append-only dans ## Constructions (Phase 30, VILL-05) */
export interface UnlockedBuilding {
  timestamp: string;   // ISO 8601 sans Z — ex: 2026-04-12T14:32:00
  buildingId: string;  // 'puits' | 'boulangerie' | 'marche' | 'cafe' | 'forge' | 'moulin' | 'port' | 'bibliotheque'
  palier: number;      // palier franchi au déblocage (100, 300, 700, 1500, 3000, 6000, 8000, 25000)
}

/** Item crafté dans l'atelier village — ligne append-only dans ## Atelier Crafts */
export interface VillageAtelierCraft {
  timestamp: string;   // ISO 8601
  recipeId: string;
  profileId: string;   // qui a déclenché le craft
}

/** Inventaire collectif village — stocké dans ## Inventaire (Phase 31+) */
export interface VillageInventory {
  [itemId: string]: number;  // itemId → quantité totale collectée
}

/** Contributions consommées par bâtiment pour la production — stocké dans ## Production */
export interface BuildingProductionState {
  [buildingId: string]: number;  // buildingId → nb contributions lifetime consommées
}

/** Stock du marché boursier village — itemId → quantité disponible */
export interface MarketStock {
  [itemId: string]: number;
}

/** Transaction enregistrée au marché */
export interface MarketTransaction {
  timestamp: string;       // ISO 8601
  profileId: string;
  action: 'buy' | 'sell';
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** Donnees completes du village parsees depuis jardin-familial.md */
export interface VillageData {
  version: number;
  createdAt: string;
  currentWeekStart: string;   // ISO date YYYY-MM-DD
  currentThemeIndex: number;  // index dans OBJECTIVE_TEMPLATES
  rewardClaimed: boolean;
  contributions: VillageContribution[];
  pastWeeks: VillageWeekRecord[];
  unlockedBuildings: UnlockedBuilding[]; // Phase 30 — bâtiments débloqués par paliers (VILL-05)
  inventory: VillageInventory;           // Inventaire collectif (items produits par les bâtiments)
  productionState: BuildingProductionState; // Contributions consommées par bâtiment
  atelierCrafts: VillageAtelierCraft[];  // Historique crafts collectifs
  atelierTechs: string[];               // CSV des techs village débloquées
  marketStock: MarketStock;              // Stock du marché boursier
  marketTransactions: MarketTransaction[]; // Log des 50 dernières transactions
}

/** Template d'objectif hebdomadaire thematise (per D-06) */
export interface ObjectiveTemplate {
  id: string;
  name: string;       // ex: "La Grande Recolte"
  icon: string;       // emoji
  description: string; // courte, motivante
}
