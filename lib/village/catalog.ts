// lib/village/catalog.ts
// Catalogue statique des 8 bâtiments village + fonction pure de calcul des déblocages.
// Phase 30 — décorations persistantes (v1.5). Per D-01, D-02, D-06 CONTEXT.md.
//
// Module pur — zéro import hook/context. Les require() de sprites sont STATIQUES
// (Pitfall 4 : Metro bundler ne supporte pas les require() dynamiques).

import type { UnlockedBuilding } from './types';

/** Définition de la production d'un bâtiment village */
export interface BuildingProductionDef {
  itemId: string;        // identifiant item : 'eau_fraiche', 'pain_frais', etc.
  itemLabel: string;     // libellé français : 'Eau fraîche', 'Pain frais', etc.
  itemEmoji: string;     // emoji de l'item : '💧', '🍞', etc.
  ratePerItem: number;   // contributions lifetime nécessaires pour produire 1 item
}

export interface BuildingCatalogEntry {
  id: string;          // 'puits', 'boulangerie', etc.
  labelFR: string;     // 'Puits', 'Boulangerie', etc.
  palier: number;      // 100, 300, 700, ...
  sprite: ReturnType<typeof require>;
  production: BuildingProductionDef;
}

/**
 * Liste verrouillée des 8 bâtiments village débloquables par paliers de feuilles famille.
 * Per D-02, D-06 CONTEXT.md. Ordre = ordre narratif hameau → ville vivante (per D-07).
 * Sprites dans assets/buildings/village/ (sous-dossier obligatoire — collision moulin.png ferme, Pitfall 5).
 */
export const BUILDINGS_CATALOG: BuildingCatalogEntry[] = [
  {
    id: 'puits', labelFR: 'Puits', palier: 100,
    sprite: require('../../assets/buildings/village/puits.png'),
    production: { itemId: 'eau_fraiche', itemLabel: 'Eau fraîche', itemEmoji: '💧', ratePerItem: 1 },
  },
  {
    id: 'boulangerie', labelFR: 'Boulangerie', palier: 300,
    sprite: require('../../assets/buildings/village/boulangerie.png'),
    production: { itemId: 'pain_frais', itemLabel: 'Pain frais', itemEmoji: '🍞', ratePerItem: 2 },
  },
  {
    id: 'marche', labelFR: 'Marché', palier: 700,
    sprite: require('../../assets/buildings/village/marche.png'),
    production: { itemId: 'panier_surprise', itemLabel: 'Panier surprise', itemEmoji: '🛒', ratePerItem: 3 },
  },
  {
    id: 'cafe', labelFR: 'Café', palier: 1500,
    sprite: require('../../assets/buildings/village/cafe.png'),
    production: { itemId: 'cafe_matin', itemLabel: 'Café du matin', itemEmoji: '☕', ratePerItem: 3 },
  },
  {
    id: 'forge', labelFR: 'Forge', palier: 3000,
    sprite: require('../../assets/buildings/village/forge.png'),
    production: { itemId: 'outil_forge', itemLabel: 'Outil forgé', itemEmoji: '🔨', ratePerItem: 5 },
  },
  {
    id: 'moulin', labelFR: 'Moulin', palier: 6000,
    sprite: require('../../assets/buildings/village/moulin.png'),
    production: { itemId: 'farine_moulee', itemLabel: 'Farine moulue', itemEmoji: '🌾', ratePerItem: 4 },
  },
  {
    id: 'port', labelFR: 'Port', palier: 8000,
    sprite: require('../../assets/buildings/village/port.png'),
    production: { itemId: 'coffre_maritime', itemLabel: 'Coffre maritime', itemEmoji: '⚓', ratePerItem: 6 },
  },
  {
    id: 'bibliotheque', labelFR: 'Bibliothèque', palier: 25000,
    sprite: require('../../assets/buildings/village/bibliotheque.png'),
    production: { itemId: 'parchemin', itemLabel: 'Parchemin', itemEmoji: '📚', ratePerItem: 7 },
  },
];

/**
 * Retourne les entrées catalogue qui devraient être débloquées mais ne le sont pas encore.
 * Pure — testable sans vault. Idempotent : si tout est déjà débloqué, retourne [].
 * Per D-23 CONTEXT.md + Pitfall 1 RESEARCH.md.
 */
export function computeBuildingsToUnlock(
  familyLifetimeLeaves: number,
  alreadyUnlocked: UnlockedBuilding[],
): BuildingCatalogEntry[] {
  const unlockedIds = new Set(alreadyUnlocked.map(b => b.buildingId));
  return BUILDINGS_CATALOG.filter(
    entry => entry.palier <= familyLifetimeLeaves && !unlockedIds.has(entry.id),
  );
}
