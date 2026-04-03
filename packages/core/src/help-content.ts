/**
 * help-content.ts — Contenu textuel centralisé pour les coach marks
 *
 * Chaque écran a une liste ordonnée de coach marks (max 3).
 * Le contenu est en français avec accents.
 * Traductions disponibles dans locales/{fr,en}/help.json.
 */

import { t } from 'i18next';

export interface CoachMarkContent {
  /** Titre court (optionnel) */
  title?: string;
  /** Texte explicatif (1-2 phrases max) */
  body: string;
  /** Position de la bulle par rapport à la cible */
  position: 'above' | 'below';
  /** Variante enfant (texte simplifié, optionnel) */
  childBody?: string;
}

export interface ScreenHelpContent {
  /** ID unique de l'écran */
  screenId: string;
  /** Coach marks ordonnés */
  marks: CoachMarkContent[];
}

export const HELP_CONTENT: Record<string, CoachMarkContent[]> = {
  dashboard: [
    {
      title: 'Votre tableau de bord',
      body: 'Les sections s\'adaptent à votre journée. Glissez vers le bas pour actualiser.',
      position: 'below',
      childBody: 'Voici ta page principale ! Tout ce qui est important est ici.',
    },
    {
      title: 'Ajout rapide',
      body: 'Ce bouton permet de créer une tâche, un RDV ou une entrée journal en un tap.',
      position: 'above',
      childBody: 'Appuie ici pour ajouter quelque chose de nouveau !',
    },
    {
      title: 'Tout le reste',
      body: 'Repas, stock, budget, routines… Retrouvez toutes les fonctions ici.',
      position: 'above',
      childBody: 'Plein d\'autres choses à découvrir ici !',
    },
  ],

  tasks: [
    {
      title: 'Gérez vos tâches',
      body: 'Cochez une tâche pour gagner des points. Glissez vers la gauche pour supprimer.',
      position: 'below',
      childBody: 'Coche tes missions pour gagner des points !',
    },
    {
      title: 'Filtrez par personne',
      body: 'Touchez un nom pour voir uniquement ses tâches.',
      position: 'below',
    },
  ],

  rdv: [
    {
      title: 'Vos rendez-vous',
      body: 'Touchez un RDV pour voir les détails, ajouter des questions ou un compte-rendu.',
      position: 'below',
    },
    {
      title: 'Recherche rapide',
      body: 'Trouvez un rendez-vous par nom de médecin ou spécialité.',
      position: 'below',
    },
  ],

  journal: [
    {
      title: 'Journal quotidien',
      body: 'Sélectionnez un enfant puis remplissez les sections : repas, sommeil, couches, humeur.',
      position: 'below',
    },
    {
      title: 'Suivi rapide',
      body: 'Chaque section se met à jour instantanément. Les stats se calculent automatiquement.',
      position: 'below',
    },
  ],

  photos: [
    {
      title: 'Album familial',
      body: 'Ajoutez une photo par jour pour créer un album souvenirs. Les photos restent sur votre appareil.',
      position: 'below',
    },
  ],

  meals: [
    {
      title: 'Planning repas',
      body: 'Touchez un créneau (midi/soir) pour ajouter un plat. Les ingrédients s\'ajoutent aux courses automatiquement.',
      position: 'below',
    },
    {
      title: 'Depuis les recettes',
      body: 'Choisissez directement depuis votre livre de recettes pour remplir le planning.',
      position: 'below',
    },
  ],

  stock: [
    {
      title: 'Suivi de stock',
      body: 'Quand le stock passe sous le seuil, l\'article est ajouté automatiquement à la liste de courses.',
      position: 'below',
    },
  ],

  budget: [
    {
      title: 'Budget mensuel',
      body: 'Définissez un plafond et suivez les dépenses par catégorie. Le total se met à jour en temps réel.',
      position: 'below',
    },
  ],

  routines: [
    {
      title: 'Routines quotidiennes',
      body: 'Créez des routines matin/soir pour toute la famille. Chaque complétion rapporte des points.',
      position: 'below',
      childBody: 'Tes routines du matin et du soir sont ici !',
    },
  ],

  loot: [
    {
      title: 'Récompenses',
      body: 'Complétez des tâches pour gagner des points et débloquer des coffres. Chaque coffre contient une surprise !',
      position: 'below',
      childBody: 'Finis tes missions pour ouvrir des coffres surprise !',
    },
  ],

  defis: [
    {
      title: 'Défis familiaux',
      body: 'Lancez des défis à la famille : « 7 jours sans écran », « Ranger sa chambre toute la semaine »…',
      position: 'below',
      childBody: 'Relève des défis pour gagner des points bonus !',
    },
  ],

  more: [
    {
      title: 'Toutes vos fonctions',
      body: 'Chaque carte ouvre une section de l\'app. Les badges indiquent les actions en attente.',
      position: 'below',
      childBody: 'Toutes les fonctions de l\'app sont ici !',
    },
  ],
  skills: [
    {
      title: 'Arbre de compétences',
      body: 'Suivez la progression de chaque enfant par catégorie. Les parents valident les compétences acquises.',
      position: 'below',
      childBody: 'Regarde toutes tes compétences ! Demande à un parent de valider celles que tu maîtrises.',
    },
  ],
};

// ─── Helpers i18n ───────────────────────────────────────────────────────────

/** Retourne le coach mark traduit pour un écran donné */
export function getCoachMark(screenId: string, index: number): CoachMarkContent | undefined {
  const marks = HELP_CONTENT[screenId];
  if (!marks || !marks[index]) return undefined;
  const mark = marks[index];
  const i = index + 1;
  return {
    ...mark,
    title: mark.title ? t(`help:coach.${screenId}.${i}.title`, { defaultValue: mark.title }) : undefined,
    body: t(`help:coach.${screenId}.${i}.body`, { defaultValue: mark.body }),
    childBody: mark.childBody ? t(`help:coach.${screenId}.${i}.childBody`, { defaultValue: mark.childBody }) : undefined,
  };
}

/** Retourne tous les coach marks traduits pour un écran */
export function getCoachMarks(screenId: string): CoachMarkContent[] {
  const marks = HELP_CONTENT[screenId];
  if (!marks) return [];
  return marks.map((_, i) => getCoachMark(screenId, i)!);
}

/** Retourne le nom traduit d'un écran pour le guide */
export function getScreenName(screenId: string, fallback: string): string {
  return t(`help:guide.screens.${screenId}.name`, { defaultValue: fallback });
}

/** Retourne la description traduite d'un écran pour le guide */
export function getScreenDescription(screenId: string, fallback: string): string {
  return t(`help:guide.screens.${screenId}.description`, { defaultValue: fallback });
}

/** Retourne le label traduit d'une catégorie du guide */
export function getGuideCategoryLabel(category: string): string {
  const key = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t(`help:guide.categories.${key}`, { defaultValue: category });
}

// ─── Guide sections ─────────────────────────────────────────────────────────

/** Contenu pour le guide revisitable (HelpModal) */
export interface HelpGuideSection {
  category: string;
  items: Array<{
    screenId: string;
    emoji: string;
    name: string;
    description: string;
    route: string;
  }>;
}

export const HELP_GUIDE_SECTIONS: HelpGuideSection[] = [
  {
    category: 'Quotidien',
    items: [
      { screenId: 'dashboard', emoji: '🏠', name: 'Tableau de bord', description: 'Votre vue d\'ensemble quotidienne', route: '/(tabs)/' },
      { screenId: 'tasks', emoji: '📋', name: 'Tâches', description: 'Gestion des tâches familiales', route: '/(tabs)/tasks' },
      { screenId: 'routines', emoji: '⏰', name: 'Routines', description: 'Routines matin/soir', route: '/(tabs)/routines' },
      { screenId: 'meals', emoji: '🍽️', name: 'Repas', description: 'Planning des repas de la semaine', route: '/(tabs)/meals' },
    ],
  },
  {
    category: 'Famille',
    items: [
      { screenId: 'journal', emoji: '📖', name: 'Journal', description: 'Suivi quotidien des enfants', route: '/(tabs)/journal' },
      { screenId: 'rdv', emoji: '📅', name: 'Rendez-vous', description: 'RDV médicaux et administratifs', route: '/(tabs)/rdv' },
      { screenId: 'photos', emoji: '📸', name: 'Photos', description: 'Album photo quotidien', route: '/(tabs)/photos' },
      { screenId: 'defis', emoji: '🏆', name: 'Défis', description: 'Challenges familiaux', route: '/(tabs)/defis' },
    ],
  },
  {
    category: 'Outils',
    items: [
      { screenId: 'stock', emoji: '📦', name: 'Stock', description: 'Suivi des fournitures', route: '/(tabs)/stock' },
      { screenId: 'budget', emoji: '💰', name: 'Budget', description: 'Gestion du budget familial', route: '/(tabs)/budget' },
      { screenId: 'loot', emoji: '🎁', name: 'Loot Box', description: 'Système de récompenses', route: '/(tabs)/loot' },
    ],
  },
];
