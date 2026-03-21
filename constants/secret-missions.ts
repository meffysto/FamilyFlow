/**
 * secret-missions.ts — Pool de missions secrètes pour enfants
 *
 * Chaque mission est catégorisée et illustrée d'un emoji.
 * Le parent pioche dans ce pool pour assigner des missions.
 */

export interface MissionSuggestion {
  text: string;
  category: 'tendresse' | 'responsabilité' | 'créativité' | 'entraide';
  emoji: string;
}

export const MISSION_POOL: MissionSuggestion[] = [
  // ─── Tendresse ──────────────────────────────────────────────────────────────
  { text: 'Faire un câlin surprise à quelqu\'un', category: 'tendresse', emoji: '🤗' },
  { text: 'Dire "je t\'aime" à chaque membre de la famille', category: 'tendresse', emoji: '❤️' },
  { text: 'Dessiner un cœur et le cacher quelque part', category: 'tendresse', emoji: '💝' },
  { text: 'Faire un compliment sincère à chacun', category: 'tendresse', emoji: '🌟' },
  { text: 'Écrire une petite lettre ou un dessin pour un parent', category: 'tendresse', emoji: '💌' },
  { text: 'Préparer un bisou-surprise au réveil', category: 'tendresse', emoji: '😘' },

  // ─── Responsabilité ─────────────────────────────────────────────────────────
  { text: 'Ranger sa chambre en secret', category: 'responsabilité', emoji: '🧹' },
  { text: 'Mettre la table sans qu\'on le demande', category: 'responsabilité', emoji: '🍽️' },
  { text: 'Préparer le petit-déjeuner pour la famille', category: 'responsabilité', emoji: '🥐' },
  { text: 'Arroser les plantes de la maison', category: 'responsabilité', emoji: '🌱' },
  { text: 'Trier ses jouets et donner ceux qu\'on n\'utilise plus', category: 'responsabilité', emoji: '📦' },
  { text: 'Vider le lave-vaisselle sans qu\'on le demande', category: 'responsabilité', emoji: '✨' },

  // ─── Créativité ─────────────────────────────────────────────────────────────
  { text: 'Inventer une histoire et la raconter à la famille', category: 'créativité', emoji: '📖' },
  { text: 'Faire un dessin pour décorer la maison', category: 'créativité', emoji: '🎨' },
  { text: 'Créer un petit spectacle (chanson, danse, magie)', category: 'créativité', emoji: '🎭' },
  { text: 'Écrire ou inventer une chanson', category: 'créativité', emoji: '🎵' },
  { text: 'Construire quelque chose avec ce qu\'on trouve à la maison', category: 'créativité', emoji: '🏗️' },

  // ─── Entraide ───────────────────────────────────────────────────────────────
  { text: 'Aider un frère ou une sœur dans une tâche', category: 'entraide', emoji: '🤝' },
  { text: 'Proposer son aide sans qu\'on le demande', category: 'entraide', emoji: '💪' },
  { text: 'Partager un jouet ou un livre préféré', category: 'entraide', emoji: '🎁' },
  { text: 'Consoler quelqu\'un qui est triste', category: 'entraide', emoji: '🫂' },
];
