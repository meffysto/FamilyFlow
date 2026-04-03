// ─────────────────────────────────────────────
// Sagas narratives — Contenu des 4 sagas
// ─────────────────────────────────────────────

import type { Saga } from './sagas-types';

/**
 * Pool de sagas disponibles.
 *
 * Chaque saga est une histoire en 3-5 chapitres avec des choix qui
 * accumulent des traits et mènent à une récompense exclusive.
 *
 * Convention clés i18n : mascot.saga.{sagaId}.{...}
 */
export const SAGAS: Saga[] = [

  // ─── Saga 1 : Le Voyageur d'Argent (4 chapitres) ────────────
  {
    id: 'voyageur_argent',
    emoji: '🧙',
    titleKey: 'mascot.saga.voyageur_argent.title',
    descriptionKey: 'mascot.saga.voyageur_argent.desc',
    sceneEmoji: '🧙',
    chapters: [
      {
        id: 1,
        narrativeKey: 'mascot.saga.voyageur_argent.ch1.narrative',
        cliffhangerKey: 'mascot.saga.voyageur_argent.ch1.cliffhanger',
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.voyageur_argent.ch1.choiceA',
            emoji: '🏡',
            traits: { générosité: 2 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.voyageur_argent.ch1.choiceB',
            emoji: '🔍',
            traits: { curiosité: 2 },
            points: 8,
          },
        ],
      },
      {
        id: 2,
        narrativeKey: 'mascot.saga.voyageur_argent.ch2.narrative',
        cliffhangerKey: 'mascot.saga.voyageur_argent.ch2.cliffhanger',
        narrativeVariants: {
          générosité: 'mascot.saga.voyageur_argent.ch2.narrative_generosity',
          curiosité: 'mascot.saga.voyageur_argent.ch2.narrative_curiosity',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.voyageur_argent.ch2.choiceA',
            emoji: '🤫',
            traits: { sagesse: 2 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.voyageur_argent.ch2.choiceB',
            emoji: '📢',
            traits: { générosité: 1, courage: 1 },
            points: 8,
          },
        ],
      },
      {
        id: 3,
        narrativeKey: 'mascot.saga.voyageur_argent.ch3.narrative',
        cliffhangerKey: 'mascot.saga.voyageur_argent.ch3.cliffhanger',
        narrativeVariants: {
          sagesse: 'mascot.saga.voyageur_argent.ch3.narrative_sagesse',
          courage: 'mascot.saga.voyageur_argent.ch3.narrative_courage',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.voyageur_argent.ch3.choiceA',
            emoji: '⚔️',
            traits: { courage: 2 },
            points: 12,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.voyageur_argent.ch3.choiceB',
            emoji: '🕊️',
            traits: { sagesse: 2 },
            points: 10,
          },
          {
            id: 'C',
            labelKey: 'mascot.saga.voyageur_argent.ch3.choiceC',
            emoji: '🎁',
            traits: { générosité: 2 },
            points: 10,
          },
        ],
      },
      {
        id: 4,
        narrativeKey: 'mascot.saga.voyageur_argent.ch4.narrative',
        cliffhangerKey: 'mascot.saga.voyageur_argent.ch4.cliffhanger',
        narrativeVariants: {
          courage: 'mascot.saga.voyageur_argent.ch4.narrative_courage',
          sagesse: 'mascot.saga.voyageur_argent.ch4.narrative_sagesse',
          générosité: 'mascot.saga.voyageur_argent.ch4.narrative_generosity',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.voyageur_argent.ch4.choiceA',
            emoji: '🤝',
            traits: { générosité: 1, sagesse: 1 },
            points: 15,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.voyageur_argent.ch4.choiceB',
            emoji: '💪',
            traits: { courage: 2 },
            points: 12,
          },
        ],
      },
    ],
    finale: {
      defaultTrait: 'générosité',
      variants: {
        générosité: {
          narrativeKey: 'mascot.saga.voyageur_argent.finale.generosity',
          rewardItemId: 'lanterne_argent',
          rewardType: 'mascot_deco',
          bonusXP: 40,
          titleKey: 'mascot.saga.voyageur_argent.title_generosity',
        },
        sagesse: {
          narrativeKey: 'mascot.saga.voyageur_argent.finale.sagesse',
          rewardItemId: 'lanterne_argent',
          rewardType: 'mascot_deco',
          bonusXP: 35,
          titleKey: 'mascot.saga.voyageur_argent.title_sagesse',
        },
        courage: {
          narrativeKey: 'mascot.saga.voyageur_argent.finale.courage',
          rewardItemId: 'lanterne_argent',
          rewardType: 'mascot_deco',
          bonusXP: 35,
          titleKey: 'mascot.saga.voyageur_argent.title_courage',
        },
        curiosité: {
          narrativeKey: 'mascot.saga.voyageur_argent.finale.curiosity',
          rewardItemId: 'lanterne_argent',
          rewardType: 'mascot_deco',
          bonusXP: 30,
          titleKey: 'mascot.saga.voyageur_argent.title_curiosity',
        },
      },
    },
  },

  // ─── Saga 2 : La Source Cachée (3 chapitres) ────────────────
  {
    id: 'source_cachee',
    emoji: '💧',
    titleKey: 'mascot.saga.source_cachee.title',
    descriptionKey: 'mascot.saga.source_cachee.desc',
    sceneEmoji: '💧',
    chapters: [
      {
        id: 1,
        narrativeKey: 'mascot.saga.source_cachee.ch1.narrative',
        cliffhangerKey: 'mascot.saga.source_cachee.ch1.cliffhanger',
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.source_cachee.ch1.choiceA',
            emoji: '🕳️',
            traits: { curiosité: 2 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.source_cachee.ch1.choiceB',
            emoji: '🛡️',
            traits: { sagesse: 2 },
            points: 8,
          },
        ],
      },
      {
        id: 2,
        narrativeKey: 'mascot.saga.source_cachee.ch2.narrative',
        cliffhangerKey: 'mascot.saga.source_cachee.ch2.cliffhanger',
        narrativeVariants: {
          curiosité: 'mascot.saga.source_cachee.ch2.narrative_curiosity',
          sagesse: 'mascot.saga.source_cachee.ch2.narrative_sagesse',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.source_cachee.ch2.choiceA',
            emoji: '🤲',
            traits: { générosité: 2 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.source_cachee.ch2.choiceB',
            emoji: '🔒',
            traits: { sagesse: 1, malice: 1 },
            points: 8,
          },
          {
            id: 'C',
            labelKey: 'mascot.saga.source_cachee.ch2.choiceC',
            emoji: '🧪',
            traits: { curiosité: 2 },
            points: 10,
          },
        ],
      },
      {
        id: 3,
        narrativeKey: 'mascot.saga.source_cachee.ch3.narrative',
        cliffhangerKey: 'mascot.saga.source_cachee.ch3.cliffhanger',
        narrativeVariants: {
          générosité: 'mascot.saga.source_cachee.ch3.narrative_generosity',
          curiosité: 'mascot.saga.source_cachee.ch3.narrative_curiosity',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.source_cachee.ch3.choiceA',
            emoji: '🌊',
            traits: { courage: 2, générosité: 1 },
            points: 15,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.source_cachee.ch3.choiceB',
            emoji: '🌿',
            traits: { sagesse: 2, générosité: 1 },
            points: 12,
          },
        ],
      },
    ],
    finale: {
      defaultTrait: 'générosité',
      variants: {
        générosité: {
          narrativeKey: 'mascot.saga.source_cachee.finale.generosity',
          rewardItemId: 'esprit_eau',
          rewardType: 'mascot_hab',
          bonusXP: 35,
          titleKey: 'mascot.saga.source_cachee.title_generosity',
        },
        curiosité: {
          narrativeKey: 'mascot.saga.source_cachee.finale.curiosity',
          rewardItemId: 'esprit_eau',
          rewardType: 'mascot_hab',
          bonusXP: 30,
          titleKey: 'mascot.saga.source_cachee.title_curiosity',
        },
        sagesse: {
          narrativeKey: 'mascot.saga.source_cachee.finale.sagesse',
          rewardItemId: 'esprit_eau',
          rewardType: 'mascot_hab',
          bonusXP: 30,
          titleKey: 'mascot.saga.source_cachee.title_sagesse',
        },
      },
    },
  },

  // ─── Saga 3 : Le Carnaval des Ombres (4 chapitres) ──────────
  {
    id: 'carnaval_ombres',
    emoji: '🎭',
    titleKey: 'mascot.saga.carnaval_ombres.title',
    descriptionKey: 'mascot.saga.carnaval_ombres.desc',
    sceneEmoji: '🎭',
    chapters: [
      {
        id: 1,
        narrativeKey: 'mascot.saga.carnaval_ombres.ch1.narrative',
        cliffhangerKey: 'mascot.saga.carnaval_ombres.ch1.cliffhanger',
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.carnaval_ombres.ch1.choiceA',
            emoji: '🎪',
            traits: { courage: 2 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.carnaval_ombres.ch1.choiceB',
            emoji: '👀',
            traits: { sagesse: 1, curiosité: 1 },
            points: 8,
          },
        ],
      },
      {
        id: 2,
        narrativeKey: 'mascot.saga.carnaval_ombres.ch2.narrative',
        cliffhangerKey: 'mascot.saga.carnaval_ombres.ch2.cliffhanger',
        narrativeVariants: {
          courage: 'mascot.saga.carnaval_ombres.ch2.narrative_courage',
          sagesse: 'mascot.saga.carnaval_ombres.ch2.narrative_sagesse',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.carnaval_ombres.ch2.choiceA',
            emoji: '🎭',
            traits: { malice: 2 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.carnaval_ombres.ch2.choiceB',
            emoji: '💡',
            traits: { sagesse: 2 },
            points: 10,
          },
          {
            id: 'C',
            labelKey: 'mascot.saga.carnaval_ombres.ch2.choiceC',
            emoji: '🕺',
            traits: { courage: 1, curiosité: 1 },
            points: 8,
          },
        ],
      },
      {
        id: 3,
        narrativeKey: 'mascot.saga.carnaval_ombres.ch3.narrative',
        cliffhangerKey: 'mascot.saga.carnaval_ombres.ch3.cliffhanger',
        narrativeVariants: {
          malice: 'mascot.saga.carnaval_ombres.ch3.narrative_malice',
          courage: 'mascot.saga.carnaval_ombres.ch3.narrative_courage',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.carnaval_ombres.ch3.choiceA',
            emoji: '🔥',
            traits: { courage: 2 },
            points: 12,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.carnaval_ombres.ch3.choiceB',
            emoji: '🎵',
            traits: { sagesse: 1, générosité: 1 },
            points: 10,
          },
        ],
      },
      {
        id: 4,
        narrativeKey: 'mascot.saga.carnaval_ombres.ch4.narrative',
        cliffhangerKey: 'mascot.saga.carnaval_ombres.ch4.cliffhanger',
        narrativeVariants: {
          courage: 'mascot.saga.carnaval_ombres.ch4.narrative_courage',
          sagesse: 'mascot.saga.carnaval_ombres.ch4.narrative_sagesse',
          malice: 'mascot.saga.carnaval_ombres.ch4.narrative_malice',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.carnaval_ombres.ch4.choiceA',
            emoji: '☀️',
            traits: { courage: 2, générosité: 1 },
            points: 15,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.carnaval_ombres.ch4.choiceB',
            emoji: '🌙',
            traits: { sagesse: 2, malice: 1 },
            points: 12,
          },
        ],
      },
    ],
    finale: {
      defaultTrait: 'courage',
      variants: {
        courage: {
          narrativeKey: 'mascot.saga.carnaval_ombres.finale.courage',
          rewardItemId: 'masque_ombre',
          rewardType: 'mascot_deco',
          bonusXP: 45,
          titleKey: 'mascot.saga.carnaval_ombres.title_courage',
        },
        sagesse: {
          narrativeKey: 'mascot.saga.carnaval_ombres.finale.sagesse',
          rewardItemId: 'masque_ombre',
          rewardType: 'mascot_deco',
          bonusXP: 40,
          titleKey: 'mascot.saga.carnaval_ombres.title_sagesse',
        },
        malice: {
          narrativeKey: 'mascot.saga.carnaval_ombres.finale.malice',
          rewardItemId: 'masque_ombre',
          rewardType: 'mascot_deco',
          bonusXP: 35,
          titleKey: 'mascot.saga.carnaval_ombres.title_malice',
        },
      },
    },
  },

  // ─── Saga 4 : La Graine des Anciens (5 chapitres) ───────────
  {
    id: 'graine_anciens',
    emoji: '🌿',
    titleKey: 'mascot.saga.graine_anciens.title',
    descriptionKey: 'mascot.saga.graine_anciens.desc',
    sceneEmoji: '🌿',
    chapters: [
      {
        id: 1,
        narrativeKey: 'mascot.saga.graine_anciens.ch1.narrative',
        cliffhangerKey: 'mascot.saga.graine_anciens.ch1.cliffhanger',
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.graine_anciens.ch1.choiceA',
            emoji: '🌱',
            traits: { sagesse: 2 },
            points: 8,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.graine_anciens.ch1.choiceB',
            emoji: '🔬',
            traits: { curiosité: 2 },
            points: 10,
          },
        ],
      },
      {
        id: 2,
        narrativeKey: 'mascot.saga.graine_anciens.ch2.narrative',
        cliffhangerKey: 'mascot.saga.graine_anciens.ch2.cliffhanger',
        narrativeVariants: {
          sagesse: 'mascot.saga.graine_anciens.ch2.narrative_sagesse',
          curiosité: 'mascot.saga.graine_anciens.ch2.narrative_curiosity',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.graine_anciens.ch2.choiceA',
            emoji: '💧',
            traits: { générosité: 2 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.graine_anciens.ch2.choiceB',
            emoji: '📖',
            traits: { sagesse: 2 },
            points: 10,
          },
        ],
      },
      {
        id: 3,
        narrativeKey: 'mascot.saga.graine_anciens.ch3.narrative',
        cliffhangerKey: 'mascot.saga.graine_anciens.ch3.cliffhanger',
        narrativeVariants: {
          générosité: 'mascot.saga.graine_anciens.ch3.narrative_generosity',
          sagesse: 'mascot.saga.graine_anciens.ch3.narrative_sagesse',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.graine_anciens.ch3.choiceA',
            emoji: '🌙',
            traits: { sagesse: 1, curiosité: 1 },
            points: 10,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.graine_anciens.ch3.choiceB',
            emoji: '☀️',
            traits: { courage: 2 },
            points: 12,
          },
          {
            id: 'C',
            labelKey: 'mascot.saga.graine_anciens.ch3.choiceC',
            emoji: '🎶',
            traits: { générosité: 2 },
            points: 10,
          },
        ],
      },
      {
        id: 4,
        narrativeKey: 'mascot.saga.graine_anciens.ch4.narrative',
        cliffhangerKey: 'mascot.saga.graine_anciens.ch4.cliffhanger',
        narrativeVariants: {
          courage: 'mascot.saga.graine_anciens.ch4.narrative_courage',
          sagesse: 'mascot.saga.graine_anciens.ch4.narrative_sagesse',
          curiosité: 'mascot.saga.graine_anciens.ch4.narrative_curiosity',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.graine_anciens.ch4.choiceA',
            emoji: '🤝',
            traits: { générosité: 2, sagesse: 1 },
            points: 12,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.graine_anciens.ch4.choiceB',
            emoji: '🔮',
            traits: { curiosité: 2, malice: 1 },
            points: 10,
          },
        ],
      },
      {
        id: 5,
        narrativeKey: 'mascot.saga.graine_anciens.ch5.narrative',
        cliffhangerKey: 'mascot.saga.graine_anciens.ch5.cliffhanger',
        narrativeVariants: {
          générosité: 'mascot.saga.graine_anciens.ch5.narrative_generosity',
          curiosité: 'mascot.saga.graine_anciens.ch5.narrative_curiosity',
          sagesse: 'mascot.saga.graine_anciens.ch5.narrative_sagesse',
        },
        choices: [
          {
            id: 'A',
            labelKey: 'mascot.saga.graine_anciens.ch5.choiceA',
            emoji: '🌳',
            traits: { sagesse: 2, générosité: 1 },
            points: 15,
          },
          {
            id: 'B',
            labelKey: 'mascot.saga.graine_anciens.ch5.choiceB',
            emoji: '✨',
            traits: { courage: 2, curiosité: 1 },
            points: 12,
          },
        ],
      },
    ],
    finale: {
      defaultTrait: 'sagesse',
      variants: {
        sagesse: {
          narrativeKey: 'mascot.saga.graine_anciens.finale.sagesse',
          rewardItemId: 'ancien_gardien',
          rewardType: 'mascot_hab',
          bonusXP: 50,
          titleKey: 'mascot.saga.graine_anciens.title_sagesse',
        },
        générosité: {
          narrativeKey: 'mascot.saga.graine_anciens.finale.generosity',
          rewardItemId: 'ancien_gardien',
          rewardType: 'mascot_hab',
          bonusXP: 45,
          titleKey: 'mascot.saga.graine_anciens.title_generosity',
        },
        curiosité: {
          narrativeKey: 'mascot.saga.graine_anciens.finale.curiosity',
          rewardItemId: 'ancien_gardien',
          rewardType: 'mascot_hab',
          bonusXP: 40,
          titleKey: 'mascot.saga.graine_anciens.title_curiosity',
        },
        courage: {
          narrativeKey: 'mascot.saga.graine_anciens.finale.courage',
          rewardItemId: 'ancien_gardien',
          rewardType: 'mascot_hab',
          bonusXP: 40,
          titleKey: 'mascot.saga.graine_anciens.title_courage',
        },
      },
    },
  },
];
