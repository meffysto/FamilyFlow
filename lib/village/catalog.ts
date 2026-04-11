// lib/village/catalog.ts
// Catalogue statique des 8 bâtiments village + fonction pure de calcul des déblocages.
// Phase 30 — décorations persistantes (v1.5). Per D-01, D-02, D-06 CONTEXT.md.
//
// Module pur — zéro import hook/context. Les require() de sprites sont STATIQUES
// (Pitfall 4 : Metro bundler ne supporte pas les require() dynamiques).

import type { UnlockedBuilding } from './types';

export interface BuildingCatalogEntry {
  id: string;          // 'puits', 'boulangerie', etc.
  labelFR: string;     // 'Puits', 'Boulangerie', etc.
  palier: number;      // 100, 300, 700, ...
  sprite: ReturnType<typeof require>;
}

/**
 * Liste verrouillée des 8 bâtiments village débloquables par paliers de feuilles famille.
 * Per D-02, D-06 CONTEXT.md. Ordre = ordre narratif hameau → ville vivante (per D-07).
 * Sprites dans assets/buildings/village/ (sous-dossier obligatoire — collision moulin.png ferme, Pitfall 5).
 */
export const BUILDINGS_CATALOG: BuildingCatalogEntry[] = [
  { id: 'puits',        labelFR: 'Puits',        palier: 100,   sprite: require('../../assets/buildings/village/puits.png') },
  { id: 'boulangerie',  labelFR: 'Boulangerie',  palier: 300,   sprite: require('../../assets/buildings/village/boulangerie.png') },
  { id: 'marche',       labelFR: 'Marché',       palier: 700,   sprite: require('../../assets/buildings/village/marche.png') },
  { id: 'cafe',         labelFR: 'Café',         palier: 1500,  sprite: require('../../assets/buildings/village/cafe.png') },
  { id: 'forge',        labelFR: 'Forge',        palier: 3000,  sprite: require('../../assets/buildings/village/forge.png') },
  { id: 'moulin',       labelFR: 'Moulin',       palier: 6000,  sprite: require('../../assets/buildings/village/moulin.png') },
  { id: 'port',         labelFR: 'Port',         palier: 12000, sprite: require('../../assets/buildings/village/port.png') },
  { id: 'bibliotheque', labelFR: 'Bibliothèque', palier: 25000, sprite: require('../../assets/buildings/village/bibliotheque.png') },
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
