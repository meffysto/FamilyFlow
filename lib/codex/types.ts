// lib/codex/types.ts — Types discriminés du codex ferme (Phase 16, per D-01/D-03)
//
// Ce fichier ne dépend d'AUCUN engine. Il définit l'union discriminée CodexEntry
// utilisée par les arrays statiques du codex (plans 02-04) et les helpers de stats
// (lib/codex/stats.ts) qui, eux, réfèrent les constantes engine à la demande (D-02).

export type CodexKind =
  | 'crop'
  | 'animal'
  | 'building'
  | 'craft'
  | 'tech'
  | 'companion'
  | 'loot'
  | 'seasonal'
  | 'saga'
  | 'quest';

export interface CodexEntryBase {
  /** Identifiant unique de l'entrée codex (slug stable) */
  id: string;
  /** Discriminant pour le narrowing TypeScript */
  kind: CodexKind;
  /** ID dans la constante engine référencée (CROP_CATALOG, INHABITANTS, ...) */
  sourceId: string;
  /** Clé i18n pour le nom : `codex.{kind}.{sourceId}.name` */
  nameKey: string;
  /** Clé i18n pour la lore/description : `codex.{kind}.{sourceId}.lore` */
  loreKey: string;
  /** Référence visuelle optionnelle (sprite, emoji, asset path) */
  iconRef?: string;
}

export interface CropEntry extends CodexEntryBase {
  kind: 'crop';
}

export interface AnimalEntry extends CodexEntryBase {
  kind: 'animal';
  /** Sous-groupe pour la classification UI (ferme classique vs créature fantastique vs animal de saga) */
  subgroup: 'farm' | 'fantasy' | 'saga';
  /** True si l'animal n'apparaît que via drop (pas dans INHABITANTS) */
  dropOnly: boolean;
}

export interface BuildingEntry extends CodexEntryBase {
  kind: 'building';
}

export interface CraftEntry extends CodexEntryBase {
  kind: 'craft';
}

export interface TechEntry extends CodexEntryBase {
  kind: 'tech';
}

export interface CompanionEntry extends CodexEntryBase {
  kind: 'companion';
}

export interface LootEntry extends CodexEntryBase {
  kind: 'loot';
  /** Type de loot pour l'agrégation des stats (plan 02) */
  lootType: 'golden_crop' | 'harvest_event' | 'rare_seed_drop';
}

export interface SeasonalEntry extends CodexEntryBase {
  kind: 'seasonal';
}

export interface SagaEntry extends CodexEntryBase {
  kind: 'saga';
}

export interface QuestEntry extends CodexEntryBase {
  kind: 'quest';
}

export type CodexEntry =
  | CropEntry
  | AnimalEntry
  | BuildingEntry
  | CraftEntry
  | TechEntry
  | CompanionEntry
  | LootEntry
  | SeasonalEntry
  | SagaEntry
  | QuestEntry;
