// =============================================================================
// Arbre de compétences — données complètes (~180 compétences)
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillCategoryId =
  | 'autonomie'
  | 'cuisine'
  | 'menage'
  | 'social'
  | 'organisation'
  | 'responsabilite'
  | 'motricite_globale'
  | 'motricite_fine'
  | 'langage'
  | 'proprete';

export type SkillType = 'jalon' | 'pratique';

export type AgeBracketId =
  | '0-1'
  | '1-2'
  | '2-3'
  | '3-5'
  | '6-8'
  | '9-11'
  | '12-14'
  | '15+';

export interface SkillCategory {
  id: SkillCategoryId;
  label: string;
  emoji: string;
  color: string;
}

export interface AgeBracket {
  id: AgeBracketId;
  label: string;
  subtitle: string;
  minAge: number;
  maxAge: number;
}

export interface SkillDefinition {
  id: string;
  label: string;
  categoryId: SkillCategoryId;
  ageBracketId: AgeBracketId;
  order: number;
  type: SkillType;
  /** Âge attendu en mois (jalons 0-3 ans uniquement) */
  expectedMonths?: number;
  /** Drapeau rouge si absent à cet âge (en mois) */
  redFlagMonths?: number;
}

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

export const SKILL_CATEGORIES: SkillCategory[] = [
  // Catégories petite enfance (0-3 ans) — jalons développementaux
  { id: 'motricite_globale', label: 'Motricité globale', emoji: '🏃', color: '#EF4444' },
  { id: 'motricite_fine', label: 'Motricité fine', emoji: '✋', color: '#F97316' },
  { id: 'langage', label: 'Langage / communication', emoji: '💬', color: '#06B6D4' },
  { id: 'proprete', label: 'Propreté / autonomie', emoji: '🚿', color: '#14B8A6' },
  // Catégories transversales (tous âges)
  { id: 'autonomie', label: 'Autonomie personnelle', emoji: '👕', color: '#6366F1' },
  { id: 'cuisine', label: 'Cuisine / alimentation', emoji: '🍳', color: '#F59E0B' },
  { id: 'menage', label: 'Ménage / responsabilités', emoji: '🧹', color: '#10B981' },
  { id: 'social', label: 'Social / émotionnel', emoji: '🗣️', color: '#EC4899' },
  { id: 'organisation', label: 'Organisation / scolaire', emoji: '📋', color: '#3B82F6' },
  { id: 'responsabilite', label: 'Responsabilité / finances', emoji: '💰', color: '#8B5CF6' },
];

/** Catégories pertinentes par tranche d'âge */
export function getCategoriesForBracket(bracketId: AgeBracketId): SkillCategory[] {
  const skills = getSkillsForBracket(bracketId);
  const catIds = new Set(skills.map((s) => s.categoryId));
  return SKILL_CATEGORIES.filter((c) => catIds.has(c.id));
}

// ---------------------------------------------------------------------------
// Tranches d'âge
// ---------------------------------------------------------------------------

export const AGE_BRACKETS: AgeBracket[] = [
  { id: '0-1', label: '0-1 an', subtitle: 'Bébé', minAge: 0, maxAge: 0 },
  { id: '1-2', label: '1-2 ans', subtitle: 'Tout-petit', minAge: 1, maxAge: 1 },
  { id: '2-3', label: '2-3 ans', subtitle: 'Petit enfant', minAge: 2, maxAge: 2 },
  { id: '3-5', label: '3-5 ans', subtitle: 'Maternelle', minAge: 3, maxAge: 5 },
  { id: '6-8', label: '6-8 ans', subtitle: 'Début primaire', minAge: 6, maxAge: 8 },
  { id: '9-11', label: '9-11 ans', subtitle: 'Fin primaire', minAge: 9, maxAge: 11 },
  { id: '12-14', label: '12-14 ans', subtitle: 'Collège', minAge: 12, maxAge: 14 },
  { id: '15+', label: '15+ ans', subtitle: 'Lycée / Ado', minAge: 15, maxAge: 99 },
];

// ---------------------------------------------------------------------------
// XP par tranche d'âge
// ---------------------------------------------------------------------------

export const XP_PER_BRACKET: Record<AgeBracketId, number> = {
  '0-1': 25,
  '1-2': 25,
  '2-3': 35,
  '3-5': 50,
  '6-8': 75,
  '9-11': 100,
  '12-14': 125,
  '15+': 150,
};

// ---------------------------------------------------------------------------
// Helper pour construire l'arbre
// ---------------------------------------------------------------------------

function skill(
  categoryId: SkillCategoryId,
  ageBracketId: AgeBracketId,
  order: number,
  label: string,
  type: SkillType = 'pratique',
  expectedMonths?: number,
  redFlagMonths?: number,
): SkillDefinition {
  return {
    id: `${categoryId}_${ageBracketId}_${order}`,
    label,
    categoryId,
    ageBracketId,
    order,
    type,
    expectedMonths,
    redFlagMonths,
  };
}

// ---------------------------------------------------------------------------
// SKILL_TREE — ~180 compétences
// ---------------------------------------------------------------------------

export const SKILL_TREE: SkillDefinition[] = [
  // =========================================================================
  // 0-1 an (Bébé) — Jalons développementaux + pratique
  // =========================================================================

  // Motricité globale (jalons)
  skill('motricite_globale', '0-1', 1, 'Soulève la tête sur le ventre', 'jalon', 2),
  skill('motricite_globale', '0-1', 2, 'Tient sa tête droite', 'jalon', 3, 4),
  skill('motricite_globale', '0-1', 3, 'Appui sur les avant-bras', 'jalon', 4),
  skill('motricite_globale', '0-1', 4, 'Se retourne ventre-dos', 'jalon', 6, 8),
  skill('motricite_globale', '0-1', 5, 'Tient assis avec appui', 'jalon', 7),
  skill('motricite_globale', '0-1', 6, 'Tient assis sans appui', 'jalon', 9, 10),
  skill('motricite_globale', '0-1', 7, 'Rampe sur le ventre', 'jalon', 8),
  skill('motricite_globale', '0-1', 8, 'Se déplace à 4 pattes', 'jalon', 10),
  skill('motricite_globale', '0-1', 9, 'Se met debout avec appui', 'jalon', 11, 12),

  // Motricité fine (jalons)
  skill('motricite_fine', '0-1', 1, 'Ouvre les mains, les observe', 'jalon', 3, 4),
  skill('motricite_fine', '0-1', 2, 'Joue avec ses mains', 'jalon', 4),
  skill('motricite_fine', '0-1', 3, 'Préhension palmaire volontaire', 'jalon', 5, 6),
  skill('motricite_fine', '0-1', 4, 'Passe un objet d\'une main à l\'autre', 'jalon', 6),
  skill('motricite_fine', '0-1', 5, 'Pince pouce-index inférieure', 'jalon', 9, 12),
  skill('motricite_fine', '0-1', 6, 'Pince pouce-index fine', 'jalon', 12),
  skill('motricite_fine', '0-1', 7, 'Lâcher volontaire d\'un objet', 'jalon', 12),

  // Langage (jalons)
  skill('langage', '0-1', 1, 'Gazouille (sons de gorge)', 'jalon', 2),
  skill('langage', '0-1', 2, 'Vocalise en réponse', 'jalon', 3, 4),
  skill('langage', '0-1', 3, 'Babille (ba-ba, da-da)', 'jalon', 6, 9),
  skill('langage', '0-1', 4, 'Babillage varié (mamama, papapa)', 'jalon', 9),
  skill('langage', '0-1', 5, 'Réagit à son prénom', 'jalon', 9, 12),
  skill('langage', '0-1', 6, 'Dit 2-3 mots (papa, mama, non)', 'jalon', 12),
  skill('langage', '0-1', 7, 'Pointe du doigt', 'jalon', 12, 12),

  // Social / émotionnel (jalons)
  skill('social', '0-1', 1, 'Sourire social (en réponse)', 'jalon', 2, 3),
  skill('social', '0-1', 2, 'Rit aux éclats', 'jalon', 4),
  skill('social', '0-1', 3, 'Sourit aux visages familiers', 'jalon', 6),
  skill('social', '0-1', 4, 'Angoisse du 8e mois', 'jalon', 8),
  skill('social', '0-1', 5, 'Joue à « coucou-caché »', 'jalon', 9, 12),
  skill('social', '0-1', 6, 'Imite les gestes simples', 'jalon', 9),
  skill('social', '0-1', 7, 'Fait « au revoir » de la main', 'jalon', 12),

  // Alimentation (pratique)
  skill('cuisine', '0-1', 1, 'Début diversification alimentaire', 'jalon', 5),
  skill('cuisine', '0-1', 2, 'Mange à la cuillère (purées)', 'jalon', 6),
  skill('cuisine', '0-1', 3, 'Boit au verre/tasse avec aide', 'pratique', 6),
  skill('cuisine', '0-1', 4, 'Mange un biscuit seul', 'pratique', 9),
  skill('cuisine', '0-1', 5, 'Saisit petits morceaux (pince)', 'jalon', 10),
  skill('cuisine', '0-1', 6, 'S\'intéresse à la cuillère', 'pratique', 12),

  // =========================================================================
  // 1-2 ans (Tout-petit) — Jalons développementaux + pratique
  // =========================================================================

  // Motricité globale (jalons)
  skill('motricite_globale', '1-2', 1, 'Premiers pas (avec appui)', 'jalon', 13),
  skill('motricite_globale', '1-2', 2, 'Marche acquise (seul, stable)', 'jalon', 16, 18),
  skill('motricite_globale', '1-2', 3, 'Monte un escalier tenu par la main', 'jalon', 18),
  skill('motricite_globale', '1-2', 4, 'Se baisse pour ramasser un objet', 'jalon', 18),
  skill('motricite_globale', '1-2', 5, 'Court', 'jalon', 22, 24),
  skill('motricite_globale', '1-2', 6, 'Donne un coup de pied dans un ballon', 'jalon', 24),
  skill('motricite_globale', '1-2', 7, 'Monte escalier (2 pieds par marche)', 'jalon', 22),
  skill('motricite_globale', '1-2', 8, 'Descend escalier (2 pieds par marche)', 'jalon', 24),

  // Motricité fine (jalons)
  skill('motricite_fine', '1-2', 1, 'Empile 2 cubes', 'jalon', 14),
  skill('motricite_fine', '1-2', 2, 'Gribouille avec un crayon', 'jalon', 15),
  skill('motricite_fine', '1-2', 3, 'Empile 3-4 cubes', 'jalon', 18),
  skill('motricite_fine', '1-2', 4, 'Commence à tourner les pages', 'jalon', 18),
  skill('motricite_fine', '1-2', 5, 'Empile 6 cubes', 'jalon', 24),
  skill('motricite_fine', '1-2', 6, 'Copie un trait vertical', 'jalon', 24, 24),

  // Langage (jalons)
  skill('langage', '1-2', 1, 'Dit 3-5 mots reconnaissables', 'jalon', 14),
  skill('langage', '1-2', 2, 'Comprend des ordres simples', 'jalon', 15, 18),
  skill('langage', '1-2', 3, 'Dit au moins 5-10 mots', 'jalon', 18, 18),
  skill('langage', '1-2', 4, 'Montre des parties du corps', 'jalon', 18),
  skill('langage', '1-2', 5, 'Explosion lexicale (~50 mots)', 'jalon', 22, 24),
  skill('langage', '1-2', 6, 'Associe 2 mots (« papa parti »)', 'jalon', 24, 24),
  skill('langage', '1-2', 7, 'Dit son prénom', 'jalon', 24),

  // Social / émotionnel (jalons)
  skill('social', '1-2', 1, 'Imite les activités quotidiennes', 'jalon', 14),
  skill('social', '1-2', 2, 'Joue seul quelques minutes', 'jalon', 16),
  skill('social', '1-2', 3, 'Montre du doigt pour partager', 'jalon', 18, 18),
  skill('social', '1-2', 4, 'Comprend le « non »', 'jalon', 18),
  skill('social', '1-2', 5, 'Phase d\'opposition (« non ! »)', 'jalon', 20),
  skill('social', '1-2', 6, 'Jeu symbolique simple (nourrir poupée)', 'jalon', 24, 24),
  skill('social', '1-2', 7, 'Joue à côté d\'autres enfants', 'jalon', 24),

  // Alimentation (pratique)
  skill('cuisine', '1-2', 1, 'Boit seul à la tasse', 'pratique', 14),
  skill('cuisine', '1-2', 2, 'Utilise une cuillère (maladroit)', 'pratique', 16),
  skill('cuisine', '1-2', 3, 'Mange à la cuillère seul', 'pratique', 20),
  skill('cuisine', '1-2', 4, 'Boit proprement au verre', 'pratique', 24),
  skill('cuisine', '1-2', 5, 'Mastique tous les aliments', 'pratique', 24),

  // Propreté / autonomie (pratique + jalons)
  skill('proprete', '1-2', 1, 'Maturation sphinctérienne', 'jalon', 18),
  skill('proprete', '1-2', 2, 'Signale la couche sale', 'pratique', 20),
  skill('proprete', '1-2', 3, 'S\'intéresse au pot', 'pratique', 24),
  skill('proprete', '1-2', 4, 'Enlève chaussettes / chaussures', 'pratique', 24),

  // Ménage / responsabilités (pratique)
  skill('menage', '1-2', 1, 'Met un objet dans la poubelle', 'pratique'),
  skill('menage', '1-2', 2, 'Range un jouet dans son bac', 'pratique'),
  skill('menage', '1-2', 3, 'Aide à essuyer une surface', 'pratique'),
  skill('menage', '1-2', 4, 'Rapporte un objet à sa place', 'pratique'),

  // =========================================================================
  // 2-3 ans (Petit enfant) — Jalons développementaux + pratique
  // =========================================================================

  // Motricité globale (jalons)
  skill('motricite_globale', '2-3', 1, 'Saute sur place (2 pieds)', 'jalon', 26),
  skill('motricite_globale', '2-3', 2, 'Se tient sur 1 pied (bref)', 'jalon', 30),
  skill('motricite_globale', '2-3', 3, 'Monte escalier en alternant pieds', 'jalon', 30),
  skill('motricite_globale', '2-3', 4, 'Pédale sur un tricycle', 'jalon', 36, 36),
  skill('motricite_globale', '2-3', 5, 'Lance un ballon en l\'air', 'jalon', 36),
  skill('motricite_globale', '2-3', 6, 'Monte escalier seul', 'jalon', 34),
  skill('motricite_globale', '2-3', 7, 'Descend escalier seul', 'jalon', 36),

  // Motricité fine (jalons)
  skill('motricite_fine', '2-3', 1, 'Dévisse un couvercle', 'jalon', 26),
  skill('motricite_fine', '2-3', 2, 'Empile 8 cubes', 'jalon', 30),
  skill('motricite_fine', '2-3', 3, 'Tient un crayon (prise digitale)', 'jalon', 32),
  skill('motricite_fine', '2-3', 4, 'Copie un cercle', 'jalon', 36, 36),
  skill('motricite_fine', '2-3', 5, 'Découpe avec des ciseaux (début)', 'jalon', 36),
  skill('motricite_fine', '2-3', 6, 'Enfile de grosses perles', 'jalon', 36),

  // Langage (jalons)
  skill('langage', '2-3', 1, 'Phrases de 3 mots', 'jalon', 26),
  skill('langage', '2-3', 2, 'Utilise « je / moi »', 'jalon', 30),
  skill('langage', '2-3', 3, 'Vocabulaire > 200 mots', 'jalon', 30, 30),
  skill('langage', '2-3', 4, 'Pose des questions (« c\'est quoi ? »)', 'jalon', 32),
  skill('langage', '2-3', 5, 'Phrases sujet + verbe + complément', 'jalon', 36, 36),
  skill('langage', '2-3', 6, 'Se fait comprendre par l\'entourage', 'jalon', 36, 36),
  skill('langage', '2-3', 7, 'Raconte un petit événement vécu', 'jalon', 36),

  // Social / émotionnel (jalons)
  skill('social', '2-3', 1, 'Jeu symbolique élaboré (scénarios)', 'jalon', 26),
  skill('social', '2-3', 2, 'Exprime des émotions (content, triste)', 'jalon', 28),
  skill('social', '2-3', 3, 'Joue avec d\'autres enfants (début)', 'jalon', 30, 36),
  skill('social', '2-3', 4, 'Comprend les tours de rôle', 'jalon', 32),
  skill('social', '2-3', 5, 'Joue à faire semblant (jeu de rôle)', 'jalon', 36),
  skill('social', '2-3', 6, 'Manifeste de l\'empathie', 'jalon', 36),
  skill('social', '2-3', 7, 'Connaît son âge et son sexe', 'jalon', 36),

  // Alimentation (pratique)
  skill('cuisine', '2-3', 1, 'Mange seul proprement (cuillère)', 'pratique', 26),
  skill('cuisine', '2-3', 2, 'Utilise une fourchette', 'pratique', 32),
  skill('cuisine', '2-3', 3, 'Mange de tout (repas familiaux)', 'pratique', 36),
  skill('cuisine', '2-3', 4, 'Verse un ingrédient dans un bol', 'pratique'),
  skill('cuisine', '2-3', 5, 'Mélange avec une cuillère en bois', 'pratique'),
  skill('cuisine', '2-3', 6, 'Lave un fruit sous le robinet', 'pratique'),

  // Propreté / autonomie (jalons + pratique)
  skill('proprete', '2-3', 1, 'Va sur le pot quand on lui propose', 'jalon', 26),
  skill('proprete', '2-3', 2, 'Reste sec 2 heures en journée', 'jalon', 28),
  skill('proprete', '2-3', 3, 'Propreté diurne acquise', 'jalon', 32),
  skill('proprete', '2-3', 4, 'Demande à aller aux toilettes', 'jalon', 36, 36),
  skill('proprete', '2-3', 5, 'S\'habille avec aide', 'pratique', 36),
  skill('proprete', '2-3', 6, 'Se lave les mains avec aide', 'pratique', 36),

  // Ménage / responsabilités (pratique)
  skill('menage', '2-3', 1, 'Range ses jouets en fin de journée', 'pratique'),
  skill('menage', '2-3', 2, 'Met son linge sale dans le panier', 'pratique'),
  skill('menage', '2-3', 3, 'Essuie une petite flaque avec une éponge', 'pratique'),
  skill('menage', '2-3', 4, 'Aide à mettre les serviettes sur la table', 'pratique'),
  skill('menage', '2-3', 5, 'Arrose une plante', 'pratique'),

  // Organisation (pratique)
  skill('organisation', '2-3', 1, 'Suit une routine visuelle', 'pratique'),
  skill('organisation', '2-3', 2, 'Choisit entre deux options', 'pratique'),
  skill('organisation', '2-3', 3, 'Reconnaît ses affaires', 'pratique'),
  skill('organisation', '2-3', 4, 'Comprend « avant » et « après »', 'pratique'),

  // =========================================================================
  // 3-5 ans (Maternelle)
  // =========================================================================

  // autonomie
  skill('autonomie', '3-5', 1, 'S\'habille seul (vêtements simples)'),
  skill('autonomie', '3-5', 2, 'Ferme une fermeture éclair'),
  skill('autonomie', '3-5', 3, 'Boutonne un gilet / chemise'),
  skill('autonomie', '3-5', 4, 'Se mouche seul'),
  skill('autonomie', '3-5', 5, 'Va aux toilettes seul'),
  skill('autonomie', '3-5', 6, 'Se douche avec supervision légère'),

  // cuisine
  skill('cuisine', '3-5', 1, 'Tartine son pain'),
  skill('cuisine', '3-5', 2, 'Épluche une banane, une clémentine'),
  skill('cuisine', '3-5', 3, 'Coupe des aliments mous'),
  skill('cuisine', '3-5', 4, 'Verse de l\'eau depuis une petite carafe'),
  skill('cuisine', '3-5', 5, 'Prépare un bol de céréales seul'),

  // menage
  skill('menage', '3-5', 1, 'Met et débarrasse son couvert'),
  skill('menage', '3-5', 2, 'Passe un coup d\'éponge sur la table'),
  skill('menage', '3-5', 3, 'Range sa chambre (lit + jouets)'),
  skill('menage', '3-5', 4, 'Trie le linge par couleur'),
  skill('menage', '3-5', 5, 'Passe le balai'),
  skill('menage', '3-5', 6, 'Nourrit un animal de compagnie'),

  // social
  skill('social', '3-5', 1, 'Dit « bonjour » et « au revoir »'),
  skill('social', '3-5', 2, 'Partage un jouet'),
  skill('social', '3-5', 3, 'Raconte sa journée en quelques phrases'),
  skill('social', '3-5', 4, 'Résout un petit conflit avec des mots'),
  skill('social', '3-5', 5, 'Attend son tour sans rappel fréquent'),

  // organisation
  skill('organisation', '3-5', 1, 'Prépare son sac avec une liste'),
  skill('organisation', '3-5', 2, 'Se repère dans un emploi du temps visuel'),
  skill('organisation', '3-5', 3, 'Reste concentré 10-15 minutes'),
  skill('organisation', '3-5', 4, 'Range ses affaires scolaires'),
  skill('organisation', '3-5', 5, 'Reconnaît et écrit son prénom'),

  // responsabilite
  skill('responsabilite', '3-5', 1, 'Prend soin de ses affaires'),
  skill('responsabilite', '3-5', 2, 'Comprend la notion de « fragile »'),
  skill('responsabilite', '3-5', 3, 'Suit une règle simple même sans surveillance'),
  skill('responsabilite', '3-5', 4, 'Rapporte un problème à un adulte'),

  // =========================================================================
  // 6-8 ans (Début primaire)
  // =========================================================================

  // autonomie
  skill('autonomie', '6-8', 1, 'Choisit ses vêtements adaptés à la météo'),
  skill('autonomie', '6-8', 2, 'Se douche seul, se lave les cheveux'),
  skill('autonomie', '6-8', 3, 'Se coiffe / attache ses cheveux'),
  skill('autonomie', '6-8', 4, 'Fait ses lacets'),
  skill('autonomie', '6-8', 5, 'Prépare ses affaires la veille'),

  // cuisine
  skill('cuisine', '6-8', 1, 'Prépare un petit-déjeuner simple'),
  skill('cuisine', '6-8', 2, 'Utilise un couteau pour couper fruits et fromage'),
  skill('cuisine', '6-8', 3, 'Fait un sandwich complet'),
  skill('cuisine', '6-8', 4, 'Suit une recette simple illustrée'),
  skill('cuisine', '6-8', 5, 'Utilise le micro-ondes en sécurité'),

  // menage
  skill('menage', '6-8', 1, 'Fait son lit chaque matin'),
  skill('menage', '6-8', 2, 'Passe l\'aspirateur dans sa chambre'),
  skill('menage', '6-8', 3, 'Vide le lave-vaisselle'),
  skill('menage', '6-8', 4, 'Plie et range son linge propre'),
  skill('menage', '6-8', 5, 'Sort les poubelles'),
  skill('menage', '6-8', 6, 'Aide à étendre le linge'),

  // social
  skill('social', '6-8', 1, 'Écrit un petit mot'),
  skill('social', '6-8', 2, 'Passe un appel téléphonique simple'),
  skill('social', '6-8', 3, 'Gère un désaccord en parlant calmement'),
  skill('social', '6-8', 4, 'Invite un ami et propose des activités'),
  skill('social', '6-8', 5, 'Respecte les règles d\'un jeu'),

  // organisation
  skill('organisation', '6-8', 1, 'Note ses devoirs dans un agenda'),
  skill('organisation', '6-8', 2, 'Fait ses devoirs en autonomie'),
  skill('organisation', '6-8', 3, 'Prépare son cartable seul'),
  skill('organisation', '6-8', 4, 'Gère un petit projet sur plusieurs jours'),
  skill('organisation', '6-8', 5, 'Lit l\'heure sur une horloge analogique'),

  // responsabilite
  skill('responsabilite', '6-8', 1, 'Reçoit et gère un petit budget'),
  skill('responsabilite', '6-8', 2, 'Comprend la différence besoin / envie'),
  skill('responsabilite', '6-8', 3, 'S\'occupe d\'un animal'),
  skill('responsabilite', '6-8', 4, 'Respecte un horaire'),
  skill('responsabilite', '6-8', 5, 'Assume une erreur et cherche à réparer'),

  // =========================================================================
  // 9-11 ans (Fin primaire)
  // =========================================================================

  // autonomie
  skill('autonomie', '9-11', 1, 'Gère sa routine matin/soir sans rappel'),
  skill('autonomie', '9-11', 2, 'Prépare un sac pour un voyage'),
  skill('autonomie', '9-11', 3, 'Utilise un réveil et se lève seul'),
  skill('autonomie', '9-11', 4, 'Gère son hygiène dentaire'),
  skill('autonomie', '9-11', 5, 'Commence à faire une lessive'),

  // cuisine
  skill('cuisine', '9-11', 1, 'Prépare un repas simple complet'),
  skill('cuisine', '9-11', 2, 'Utilise la plaque de cuisson avec supervision'),
  skill('cuisine', '9-11', 3, 'Suit une recette écrite'),
  skill('cuisine', '9-11', 4, 'Fait la vaisselle correctement'),
  skill('cuisine', '9-11', 5, 'Planifie une liste de courses pour une recette'),

  // menage
  skill('menage', '9-11', 1, 'Nettoie la salle de bain'),
  skill('menage', '9-11', 2, 'Passe l\'aspirateur dans plusieurs pièces'),
  skill('menage', '9-11', 3, 'Change ses draps de lit'),
  skill('menage', '9-11', 4, 'Aide au jardin'),
  skill('menage', '9-11', 5, 'Organise et trie ses affaires'),

  // social
  skill('social', '9-11', 1, 'Rédige un message poli'),
  skill('social', '9-11', 2, 'Se présente à un nouvel adulte'),
  skill('social', '9-11', 3, 'Gère un conflit avec un ami'),
  skill('social', '9-11', 4, 'Participe à une activité de groupe'),
  skill('social', '9-11', 5, 'Reconnaît et exprime ses émotions'),

  // organisation
  skill('organisation', '9-11', 1, 'Planifie ses devoirs sur la semaine'),
  skill('organisation', '9-11', 2, 'Prépare un exposé en autonomie'),
  skill('organisation', '9-11', 3, 'Gère son temps libre'),
  skill('organisation', '9-11', 4, 'Utilise un dictionnaire, des ressources'),
  skill('organisation', '9-11', 5, 'Fixe un objectif personnel'),

  // responsabilite
  skill('responsabilite', '9-11', 1, 'Gère un budget hebdomadaire'),
  skill('responsabilite', '9-11', 2, 'Épargne pour un achat précis'),
  skill('responsabilite', '9-11', 3, 'Compare les prix'),
  skill('responsabilite', '9-11', 4, 'Est responsable d\'une tâche régulière'),
  skill('responsabilite', '9-11', 5, 'Garde brièvement un plus jeune enfant'),

  // =========================================================================
  // 12-14 ans (Collège)
  // =========================================================================

  // autonomie
  skill('autonomie', '12-14', 1, 'Fait sa lessive complète'),
  skill('autonomie', '12-14', 2, 'Repasse des vêtements simples'),
  skill('autonomie', '12-14', 3, 'Gère ses rendez-vous dans un agenda'),
  skill('autonomie', '12-14', 4, 'Prépare sa valise seul'),
  skill('autonomie', '12-14', 5, 'Choisit des vêtements appropriés au contexte'),

  // cuisine
  skill('cuisine', '12-14', 1, 'Prépare un repas complet pour la famille'),
  skill('cuisine', '12-14', 2, 'Utilise le four en autonomie'),
  skill('cuisine', '12-14', 3, 'Adapte une recette'),
  skill('cuisine', '12-14', 4, 'Fait les courses au supermarché'),
  skill('cuisine', '12-14', 5, 'Compose un repas équilibré'),

  // menage
  skill('menage', '12-14', 1, 'Nettoie une pièce entière'),
  skill('menage', '12-14', 2, 'Gère le tri sélectif'),
  skill('menage', '12-14', 3, 'Effectue un petit bricolage'),
  skill('menage', '12-14', 4, 'Organise un rangement saisonnier'),
  skill('menage', '12-14', 5, 'Tond la pelouse'),

  // social
  skill('social', '12-14', 1, 'Rédige un email formel'),
  skill('social', '12-14', 2, 'Gère ses relations amicales'),
  skill('social', '12-14', 3, 'Résout un malentendu par la discussion'),
  skill('social', '12-14', 4, 'Prend la parole en groupe'),
  skill('social', '12-14', 5, 'Utilise les réseaux sociaux de façon responsable'),

  // organisation
  skill('organisation', '12-14', 1, 'Planifie ses révisions pour un contrôle'),
  skill('organisation', '12-14', 2, 'Prend des notes efficaces'),
  skill('organisation', '12-14', 3, 'Gère plusieurs matières en parallèle'),
  skill('organisation', '12-14', 4, 'Identifie ses lacunes'),
  skill('organisation', '12-14', 5, 'Utilise des outils numériques'),

  // responsabilite
  skill('responsabilite', '12-14', 1, 'Gère un budget mensuel'),
  skill('responsabilite', '12-14', 2, 'Ouvre et suit un compte bancaire jeune'),
  skill('responsabilite', '12-14', 3, 'Comprend dépense, épargne, don'),
  skill('responsabilite', '12-14', 4, 'Baby-sitting rémunéré'),
  skill('responsabilite', '12-14', 5, 'Prend des décisions d\'achat réfléchies'),

  // =========================================================================
  // 15+ ans (Lycée / Ado)
  // =========================================================================

  // autonomie
  skill('autonomie', '15+', 1, 'Gère l\'intégralité de sa routine'),
  skill('autonomie', '15+', 2, 'Prend rendez-vous seul'),
  skill('autonomie', '15+', 3, 'Se déplace seul en transports'),
  skill('autonomie', '15+', 4, 'Gère ses papiers'),
  skill('autonomie', '15+', 5, 'Fait un premier secours basique'),

  // cuisine
  skill('cuisine', '15+', 1, 'Planifie les repas d\'une semaine'),
  skill('cuisine', '15+', 2, 'Fait les courses avec un budget'),
  skill('cuisine', '15+', 3, 'Cuisine pour des invités'),
  skill('cuisine', '15+', 4, 'Connaît les bases de la nutrition'),
  skill('cuisine', '15+', 5, 'Gère le stock alimentaire'),

  // menage
  skill('menage', '15+', 1, 'Prend en charge le ménage complet'),
  skill('menage', '15+', 2, 'Effectue des réparations simples'),
  skill('menage', '15+', 3, 'Gère le linge de toute la famille'),
  skill('menage', '15+', 4, 'Organise un grand tri / don'),
  skill('menage', '15+', 5, 'Entretient un véhicule de base'),

  // social
  skill('social', '15+', 1, 'Passe un entretien'),
  skill('social', '15+', 2, 'Rédige un CV et une lettre de motivation'),
  skill('social', '15+', 3, 'Communique avec des administrations'),
  skill('social', '15+', 4, 'Gère un conflit de façon constructive'),
  skill('social', '15+', 5, 'Encadre des plus jeunes'),

  // organisation
  skill('organisation', '15+', 1, 'Planifie ses révisions du bac'),
  skill('organisation', '15+', 2, 'Gère un projet long'),
  skill('organisation', '15+', 3, 'Priorise ses tâches et gère le stress'),
  skill('organisation', '15+', 4, 'S\'informe sur les filières'),
  skill('organisation', '15+', 5, 'Travaille en autonomie complète'),

  // responsabilite
  skill('responsabilite', '15+', 1, 'Gère un budget mensuel réaliste'),
  skill('responsabilite', '15+', 2, 'Épargne avec un objectif moyen terme'),
  skill('responsabilite', '15+', 3, 'Comprend un relevé bancaire'),
  skill('responsabilite', '15+', 4, 'Déclare un job d\'été'),
  skill('responsabilite', '15+', 5, 'Prend des responsabilités civiques'),
];

// ---------------------------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------------------------

/**
 * Détecte la tranche d'âge à partir d'une date de naissance (YYYY-MM-DD ou YYYY).
 */
export function detectAgeBracket(birthdate: string): AgeBracketId {
  const now = new Date();
  let birthYear: number;
  let birthMonth = 0;
  let birthDay = 1;

  if (birthdate.includes('-')) {
    const parts = birthdate.split('-');
    birthYear = parseInt(parts[0], 10);
    birthMonth = parseInt(parts[1], 10) - 1;
    birthDay = parseInt(parts[2], 10);
  } else {
    birthYear = parseInt(birthdate, 10);
  }

  const birthDate = new Date(birthYear, birthMonth, birthDay);
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 0) age = 0;

  for (const bracket of AGE_BRACKETS) {
    if (age >= bracket.minAge && age <= bracket.maxAge) {
      return bracket.id;
    }
  }

  // Par défaut, retourner la dernière tranche
  return '15+';
}

/**
 * Retourne toutes les compétences d'une tranche d'âge donnée.
 */
export function getSkillsForBracket(bracketId: AgeBracketId): SkillDefinition[] {
  return SKILL_TREE.filter((s) => s.ageBracketId === bracketId);
}

// Index par ID pour lookups O(1)
const SKILL_BY_ID = new Map<string, SkillDefinition>(
  SKILL_TREE.map((s) => [s.id, s])
);

/**
 * Trouve une compétence par son identifiant (O(1)).
 */
export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILL_BY_ID.get(id);
}

// ─── Skill state (shared logic) ────────────────────────────────────────────

export type SkillState = 'locked' | 'unlockable' | 'unlocked';

/** Calcule l'état d'une compétence par rapport aux déverrouillages.
 * Pas de prérequis linéaire — chaque compétence est déblocable indépendamment. */
export function getSkillState(skillId: string, unlockedIds: Set<string>): SkillState {
  if (unlockedIds.has(skillId)) return 'unlocked';
  return 'unlockable';
}
