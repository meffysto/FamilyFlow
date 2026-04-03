/**
 * secret-missions.ts — Pool de missions secrètes pour enfants
 *
 * Chaque mission est catégorisée et illustrée d'un emoji.
 * Le parent pioche dans ce pool pour assigner des missions.
 */

import { t } from 'i18next';

export interface MissionSuggestion {
  id: string;
  text: string;
  category: 'tendresse' | 'responsabilité' | 'créativité' | 'entraide';
  emoji: string;
}

/** Retourne le texte traduit d'une mission */
export function getMissionText(mission: MissionSuggestion): string {
  return t(`gamification:missions.${mission.id}`, { defaultValue: mission.text });
}

/** Retourne le label traduit d'une catégorie de mission */
export function getMissionCategoryLabel(category: MissionSuggestion['category']): string {
  return t(`gamification:missionCategory.${category}`, { defaultValue: category });
}

export const MISSION_POOL: MissionSuggestion[] = [
  // ─── Tendresse ──────────────────────────────────────────────────────────────
  { id: 'tendresse_1', text: 'Faire un câlin surprise à quelqu\'un', category: 'tendresse', emoji: '🤗' },
  { id: 'tendresse_2', text: 'Dire "je t\'aime" à chaque membre de la famille', category: 'tendresse', emoji: '❤️' },
  { id: 'tendresse_3', text: 'Dessiner un cœur et le cacher quelque part', category: 'tendresse', emoji: '💝' },
  { id: 'tendresse_4', text: 'Faire un compliment sincère à chacun', category: 'tendresse', emoji: '🌟' },
  { id: 'tendresse_5', text: 'Écrire une petite lettre ou un dessin pour un parent', category: 'tendresse', emoji: '💌' },
  { id: 'tendresse_6', text: 'Préparer un bisou-surprise au réveil', category: 'tendresse', emoji: '😘' },

  // ─── Responsabilité ─────────────────────────────────────────────────────────
  { id: 'responsabilite_1', text: 'Ranger sa chambre en secret', category: 'responsabilité', emoji: '🧹' },
  { id: 'responsabilite_2', text: 'Mettre la table sans qu\'on le demande', category: 'responsabilité', emoji: '🍽️' },
  { id: 'responsabilite_3', text: 'Préparer le petit-déjeuner pour la famille', category: 'responsabilité', emoji: '🥐' },
  { id: 'responsabilite_4', text: 'Arroser les plantes de la maison', category: 'responsabilité', emoji: '🌱' },
  { id: 'responsabilite_5', text: 'Trier ses jouets et donner ceux qu\'on n\'utilise plus', category: 'responsabilité', emoji: '📦' },
  { id: 'responsabilite_6', text: 'Vider le lave-vaisselle sans qu\'on le demande', category: 'responsabilité', emoji: '✨' },

  // ─── Créativité ─────────────────────────────────────────────────────────────
  { id: 'creativite_1', text: 'Inventer une histoire et la raconter à la famille', category: 'créativité', emoji: '📖' },
  { id: 'creativite_2', text: 'Faire un dessin pour décorer la maison', category: 'créativité', emoji: '🎨' },
  { id: 'creativite_3', text: 'Créer un petit spectacle (chanson, danse, magie)', category: 'créativité', emoji: '🎭' },
  { id: 'creativite_4', text: 'Écrire ou inventer une chanson', category: 'créativité', emoji: '🎵' },
  { id: 'creativite_5', text: 'Construire quelque chose avec ce qu\'on trouve à la maison', category: 'créativité', emoji: '🏗️' },

  // ─── Entraide ───────────────────────────────────────────────────────────────
  { id: 'entraide_1', text: 'Aider un frère ou une sœur dans une tâche', category: 'entraide', emoji: '🤝' },
  { id: 'entraide_2', text: 'Proposer son aide sans qu\'on le demande', category: 'entraide', emoji: '💪' },
  { id: 'entraide_3', text: 'Partager un jouet ou un livre préféré', category: 'entraide', emoji: '🎁' },
  { id: 'entraide_4', text: 'Consoler quelqu\'un qui est triste', category: 'entraide', emoji: '🫂' },
];
