// ─────────────────────────────────────────────
// Phase 43 — Catalogue des 6 visiteurs Auberge
// ─────────────────────────────────────────────
// Mirror du pattern BUILDING_CATALOG (lib/mascot/types.ts:514).
// i18n : labelKey/descriptionKey réservées ici (pattern auberge.visitor.{id}.{name|bio}),
// branchage en phase UI ultérieure — non consommées en Phase 43.
//
// itemId référencent :
//  - source 'building' → BUILDING_RESOURCE_VALUE keys (oeuf | lait | farine | miel)
//  - source 'crop'     → CROP_CATALOG.id (carrot, wheat, potato, beetroot, tomato,
//                       cabbage, cucumber, corn, strawberry, pumpkin, sunflower,
//                       orchidee, rose_doree, truffe, fruit_dragon, ...)
//  - source 'crafted'  → CRAFT_RECIPES.id (soupe, bouquet, crepe, fromage,
//                       confiture, pain, hydromel, parfum_orchidee, ...)

import type { TreeStage, VisitorRarity, VisitorRequestSource } from './types';

/**
 * Template d'une requête possible pour un visiteur.
 * - `weight` : poids de tirage relatif au sein de `requestPool` (somme libre).
 * - `items[].quantity` : intervalle [min, max] inclusif, résolu au spawn vers un entier figé.
 */
export interface VisitorRequestTemplate {
  weight: number;
  items: {
    itemId: string;
    source: VisitorRequestSource;
    quantity: [number, number];
  }[];
}

/**
 * Définition statique d'un visiteur (PNJ) du catalogue Auberge.
 * Champs verrouillés Phase 43 — Plans 03/04 consomment cette shape.
 */
export interface VisitorDefinition {
  id: string;
  labelKey: string;        // 'auberge.visitor.{id}.name' — i18n branchée phase ultérieure
  descriptionKey: string;  // 'auberge.visitor.{id}.bio'
  emoji: string;
  rarity: VisitorRarity;
  deadlineHours: number;   // 48 (common) | 60 (uncommon) | 72 (rare)
  rewardMultiplier: number; // 1.4 (common) | 1.6 (uncommon) | 1.8 (rare)
  minTreeStage: TreeStage;
  unlockMinReputation?: number; // gating réputation totale (Comtesse: 15)
  requestPool: VisitorRequestTemplate[];
  preferredLoot?: string[]; // ids de loot préféré pour drops rares (Phase ultérieure)
}

/**
 * Les 6 visiteurs au lancement Phase 43.
 *
 * Tiers :
 *  - common (Hugo, Lucette)         : 48h / ×1.4 / minTreeStage 'pousse'
 *  - uncommon (Yann, Voyageuse, Marchand) : 60h / ×1.6 / minTreeStage 'arbuste'
 *  - rare (Comtesse)                : 72h / ×1.8 / minTreeStage 'arbre' + unlockMinReputation 15
 */
export const VISITOR_CATALOG: VisitorDefinition[] = [
  // 🧑‍🍳 Hugo le boulanger — commun, 48h, ×1.4 (farine + œuf + wheat)
  {
    id: 'hugo_boulanger',
    labelKey: 'auberge.visitor.hugo_boulanger.name',
    descriptionKey: 'auberge.visitor.hugo_boulanger.bio',
    emoji: '🧑‍🍳',
    rarity: 'common',
    deadlineHours: 48,
    rewardMultiplier: 1.4,
    minTreeStage: 'pousse',
    requestPool: [
      { weight: 3, items: [
        { itemId: 'farine', source: 'building', quantity: [2, 4] },
        { itemId: 'oeuf',   source: 'building', quantity: [3, 5] },
      ]},
      { weight: 2, items: [
        { itemId: 'wheat', source: 'crop', quantity: [4, 8] },
      ]},
    ],
  },

  // 👵 Mémé Lucette — commun, 48h, ×1.4 (lait + légumes racine)
  // CONTEXT.md mentionnait chou/patate/betterave : tous présents dans CROP_CATALOG
  // (cabbage, potato, beetroot) — pas de fallback nécessaire.
  {
    id: 'meme_lucette',
    labelKey: 'auberge.visitor.meme_lucette.name',
    descriptionKey: 'auberge.visitor.meme_lucette.bio',
    emoji: '👵',
    rarity: 'common',
    deadlineHours: 48,
    rewardMultiplier: 1.4,
    minTreeStage: 'pousse',
    requestPool: [
      { weight: 3, items: [
        { itemId: 'lait',     source: 'building', quantity: [2, 4] },
        { itemId: 'potato',   source: 'crop',     quantity: [3, 6] },
      ]},
      { weight: 2, items: [
        { itemId: 'cabbage',  source: 'crop',     quantity: [2, 4] },
        { itemId: 'beetroot', source: 'crop',     quantity: [2, 4] },
      ]},
    ],
  },

  // 🐝 Yann l'apiculteur — uncommon, 60h, ×1.6 (miel + farine)
  {
    id: 'yann_apiculteur',
    labelKey: 'auberge.visitor.yann_apiculteur.name',
    descriptionKey: 'auberge.visitor.yann_apiculteur.bio',
    emoji: '🐝',
    rarity: 'uncommon',
    deadlineHours: 60,
    rewardMultiplier: 1.6,
    minTreeStage: 'arbuste',
    requestPool: [
      { weight: 3, items: [
        { itemId: 'miel',   source: 'building', quantity: [2, 4] },
        { itemId: 'farine', source: 'building', quantity: [2, 3] },
      ]},
      { weight: 2, items: [
        { itemId: 'miel', source: 'building', quantity: [3, 5] },
      ]},
    ],
  },

  // 🧙 La Voyageuse — uncommon, 60h, ×1.6 (fruits saisonniers + craftés simples)
  // Items craftés simples dispo : soupe (150), bouquet (200), bortsch (130), confiture (460).
  // Fruits/herbes saisonniers : strawberry, tomato (CROP_CATALOG).
  {
    id: 'voyageuse',
    labelKey: 'auberge.visitor.voyageuse.name',
    descriptionKey: 'auberge.visitor.voyageuse.bio',
    emoji: '🧙',
    rarity: 'uncommon',
    deadlineHours: 60,
    rewardMultiplier: 1.6,
    minTreeStage: 'arbuste',
    requestPool: [
      { weight: 3, items: [
        { itemId: 'bouquet',    source: 'crafted', quantity: [1, 2] },
        { itemId: 'tomato',     source: 'crop',    quantity: [3, 5] },
      ]},
      { weight: 2, items: [
        { itemId: 'soupe',      source: 'crafted', quantity: [1, 2] },
        { itemId: 'strawberry', source: 'crop',    quantity: [2, 4] },
      ]},
    ],
  },

  // 🪙 Le Marchand ambulant — uncommon, 60h, ×1.6 (craftés à fort sellValue)
  // Cibles ≥ 400 : fromage 480, hydromel 660, pain 480, gateau 540, popcorn 540.
  {
    id: 'marchand_ambulant',
    labelKey: 'auberge.visitor.marchand_ambulant.name',
    descriptionKey: 'auberge.visitor.marchand_ambulant.bio',
    emoji: '🪙',
    rarity: 'uncommon',
    deadlineHours: 60,
    rewardMultiplier: 1.6,
    minTreeStage: 'arbuste',
    requestPool: [
      { weight: 3, items: [
        { itemId: 'fromage',  source: 'crafted', quantity: [1, 2] },
        { itemId: 'pain',     source: 'crafted', quantity: [1, 2] },
      ]},
      { weight: 2, items: [
        { itemId: 'hydromel', source: 'crafted', quantity: [1, 2] },
        { itemId: 'gateau',   source: 'crafted', quantity: [1, 1] },
      ]},
    ],
  },

  // 👑 La Comtesse — rare, 72h, ×1.8, unlockMinReputation 15
  // Crafté rare : parfum_orchidee (1200, sellValue le plus haut). Récolte golden : strawberry / corn.
  // Note : plusieurs craftés rares (galette_royale, confiture_royale, elixir_dragon...) existent au catalogue,
  // parfum_orchidee retenu pour son sellValue dominant et sa rareté narrative.
  {
    id: 'comtesse',
    labelKey: 'auberge.visitor.comtesse.name',
    descriptionKey: 'auberge.visitor.comtesse.bio',
    emoji: '👑',
    rarity: 'rare',
    deadlineHours: 72,
    rewardMultiplier: 1.8,
    minTreeStage: 'arbre',
    unlockMinReputation: 15,
    requestPool: [
      { weight: 2, items: [
        { itemId: 'parfum_orchidee', source: 'crafted', quantity: [1, 1] },
      ]},
      { weight: 3, items: [
        { itemId: 'fromage', source: 'crafted', quantity: [2, 3] },
        { itemId: 'corn',    source: 'crop',    quantity: [3, 5] },
      ]},
    ],
  },
];
