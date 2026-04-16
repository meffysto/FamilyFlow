// ─────────────────────────────────────────────────────────────────────────────
// lib/dietary/catalogs.ts
// Catalogues canoniques pour la détection des contraintes alimentaires.
//
// IMPORTANT — IDs stables : ne jamais renommer les IDs après livraison.
// Tous les profils stockent les IDs canoniques dans famille.md.
// Tout changement d'ID romprait la compatibilité avec les vaults existants.
//
// Aucun import runtime. Seul l'import du type DietaryItem est autorisé.
// ─────────────────────────────────────────────────────────────────────────────

import type { DietaryItem, DietarySeverity } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Les 14 allergènes à déclaration obligatoire — Règlement (UE) n°1169/2011
//
// Les aliases couvrent les dérivés culinaires les plus courants.
// Règle de conservatisme (PREF-11) : en cas de match ambigu, toujours déclencher.
// Un faux positif est préférable à un faux négatif sur une allergie vitale.
// ─────────────────────────────────────────────────────────────────────────────
export const EU_ALLERGENS: DietaryItem[] = [
  {
    id: 'gluten',
    label: 'Gluten',
    aliases: [
      'blé',
      'farine',
      'orge',
      'seigle',
      'épeautre',
      'kamut',
      'seitan',
      'pain',
      'pâtes',
      'semoule',
      'boulgour',
      'triticale',
      'amidon de blé',
      'chapelure',
    ],
  },
  {
    id: 'crustaces',
    label: 'Crustacés',
    aliases: [
      'crevette',
      'homard',
      'crabe',
      'langoustine',
      'écrevisse',
      'langouste',
      'araignée de mer',
    ],
  },
  {
    id: 'oeufs',
    label: 'Œufs',
    aliases: [
      'oeuf',
      'mayonnaise',
      'meringue',
      'hollandaise',
      'albumen',
      'lysozyme',
      'ovoproduit',
    ],
  },
  {
    id: 'poissons',
    label: 'Poissons',
    aliases: [
      'saumon',
      'thon',
      'cabillaud',
      'merlu',
      'sardine',
      'anchois',
      'surimi',
      'hareng',
      'maquereau',
      'truite',
      'espadon',
      'sole',
      'bar',
      'lotte',
    ],
  },
  {
    id: 'arachides',
    label: 'Arachides',
    aliases: [
      'cacahuète',
      'cacahouète',
      'cacahuètes',
      "huile d'arachide",
      'beurre de cacahuète',
      'peanut',
    ],
  },
  {
    id: 'soja',
    label: 'Soja',
    aliases: [
      'tofu',
      'tempeh',
      'miso',
      'edamame',
      'lécithine de soja',
      'sauce soja',
      'tamari',
    ],
  },
  {
    id: 'lait',
    label: 'Lait',
    aliases: [
      'beurre',
      'crème',
      'yaourt',
      'fromage',
      'mascarpone',
      'mozzarella',
      'ricotta',
      'ghee',
      'caséine',
      'lactose',
      'lactosérum',
      'lait écrémé',
      'babeurre',
      'parmesan',
      'emmental',
      'comté',
      'gruyère',
      'crème fraîche',
      'lait entier',
      'lait demi-écrémé',
    ],
  },
  {
    id: 'fruits_a_coque',
    label: 'Fruits à coque',
    aliases: [
      'noisette',
      'noix',
      'amande',
      'cajou',
      'pistache',
      'noix de pécan',
      'noix du brésil',
      'macadamia',
      'praline',
      'praliné',
      'noix de cajou',
      'noix de coco',
      'pignon',
    ],
  },
  {
    id: 'celeri',
    label: 'Céleri',
    aliases: ['céleri rave', 'céleri branche', 'céleri-rave'],
  },
  {
    id: 'moutarde',
    label: 'Moutarde',
    aliases: ['graines de moutarde', 'farine de moutarde', 'sauce moutarde'],
  },
  {
    id: 'sesame',
    label: 'Sésame',
    aliases: [
      'tahini',
      'huile de sésame',
      'graines de sésame',
      'tahin',
      'farine de sésame',
    ],
  },
  {
    id: 'sulfites',
    label: 'Sulfites / SO₂',
    aliases: [
      'dioxyde de soufre',
      'e220',
      'e221',
      'e222',
      'e223',
      'e224',
      'e225',
      'e226',
      'e227',
      'e228',
      'vin',
      'bisulfite',
      'métabisulfite',
    ],
  },
  {
    id: 'lupin',
    label: 'Lupin',
    aliases: ['farine de lupin', 'graine de lupin', 'lupine'],
  },
  {
    id: 'mollusques',
    label: 'Mollusques',
    aliases: [
      'moule',
      'huître',
      'calamar',
      'pieuvre',
      'escargot',
      'palourde',
      'coque',
      'seiche',
      'bulot',
      'poulpe',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Intolérances courantes
//
// Contraintes digestives sans danger vital immédiat.
// IDs distincts des allergènes UE même si certains concepts se recoupent
// (ex : 'lactose' != 'lait') — la sévérité diffère.
// ─────────────────────────────────────────────────────────────────────────────
export const COMMON_INTOLERANCES: DietaryItem[] = [
  {
    id: 'lactose',
    label: 'Lactose',
    aliases: ['lait', 'produits laitiers', 'beurre', 'crème', 'yaourt', 'fromage'],
  },
  {
    id: 'gluten_ncg',
    label: 'Gluten (non cœliaque)',
    aliases: ['blé', 'farine', 'pain', 'pâtes', 'orge', 'seigle'],
  },
  {
    id: 'fructose',
    label: 'Fructose',
    aliases: ['fructose', 'sirop de fructose', 'sirop de maïs', 'miel'],
  },
  {
    id: 'histamine',
    label: 'Histamine',
    aliases: [
      'vin rouge',
      'fromage affiné',
      'charcuterie',
      'thon',
      'anchois',
      'épinards',
      'tomate',
      'aubergine',
    ],
  },
  {
    id: 'fodmap',
    label: 'FODMAP',
    aliases: [
      'oignon',
      'ail',
      'poireau',
      'pomme',
      'poire',
      'légumineuses',
      'haricots',
      'lentilles',
      'blé',
      'seigle',
    ],
  },
  {
    id: 'sorbitol',
    label: 'Sorbitol',
    aliases: ['e420', 'sirop de sorbitol', 'pomme', 'poire', 'prune', 'cerise'],
  },
  {
    id: 'cafeine',
    label: 'Caféine',
    aliases: ['café', 'thé', 'cola', 'énergie', 'guarana', 'yerba mate', 'cacao'],
  },
  {
    id: 'sulfites_intol',
    label: 'Sulfites (intolérance)',
    aliases: ['vin', 'vinaigre', 'fruits secs', 'conserves', 'e220', 'e221'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Régimes courants
//
// Choix délibérés éthiques, religieux ou médicaux.
// Les aliases sont minimalistes : ces contraintes sont déclaratives
// (l'utilisateur sait ce qu'il choisit), pas déduites par matching d'ingrédient.
// ─────────────────────────────────────────────────────────────────────────────
export const COMMON_REGIMES: DietaryItem[] = [
  {
    id: 'vegetarien',
    label: 'Végétarien',
    aliases: ['végé', 'végétarisme'],
  },
  {
    id: 'vegan',
    label: 'Vegan',
    aliases: ['végétalien', 'végétalisme', 'plant-based'],
  },
  {
    id: 'halal',
    label: 'Halal',
    aliases: [],
  },
  {
    id: 'casher',
    label: 'Casher',
    aliases: ['kosher'],
  },
  {
    id: 'sans_porc',
    label: 'Sans porc',
    aliases: ['sans porc'],
  },
  {
    id: 'sans_alcool',
    label: 'Sans alcool',
    aliases: ['sans alcool', 'abstinent'],
  },
  {
    id: 'pescetarien',
    label: 'Pescétarien',
    aliases: ['pescatarian', 'pescétarisme'],
  },
  {
    id: 'sans_boeuf',
    label: 'Sans bœuf',
    aliases: ['sans boeuf'],
  },
  {
    id: 'femme_enceinte',
    label: 'Femme enceinte',
    aliases: ['enceinte', 'grossesse', 'pregnant'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. Helper — retourne le catalogue correspondant à une sévérité
//
// Utilisé par l'autocomplete de l'écran dietary.tsx pour proposer les suggestions
// en fonction de la catégorie en cours d'édition.
//
// Aversions (D-05) : texte libre uniquement — aucun catalogue retourné ([]).
// ─────────────────────────────────────────────────────────────────────────────
export function findCatalogForSeverity(severity: DietarySeverity): DietaryItem[] {
  switch (severity) {
    case 'allergie':
      return EU_ALLERGENS;
    case 'intolerance':
      return COMMON_INTOLERANCES;
    case 'regime':
      return COMMON_REGIMES;
    case 'aversion':
      // Les aversions sont du texte libre — pas de catalogue canonique (D-05)
      return [];
  }
}
