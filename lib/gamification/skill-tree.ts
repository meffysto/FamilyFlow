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
  | 'responsabilite';

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
}

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

export const SKILL_CATEGORIES: SkillCategory[] = [
  { id: 'autonomie', label: 'Autonomie personnelle', emoji: '👕' },
  { id: 'cuisine', label: 'Cuisine / alimentation', emoji: '🍳' },
  { id: 'menage', label: 'Ménage / responsabilités', emoji: '🧹' },
  { id: 'social', label: 'Social / communication', emoji: '🗣️' },
  { id: 'organisation', label: 'Organisation / scolaire', emoji: '📋' },
  { id: 'responsabilite', label: 'Responsabilité / finances', emoji: '💰' },
];

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
): SkillDefinition {
  return {
    id: `${categoryId}_${ageBracketId}_${order}`,
    label,
    categoryId,
    ageBracketId,
    order,
  };
}

// ---------------------------------------------------------------------------
// SKILL_TREE — ~180 compétences
// ---------------------------------------------------------------------------

export const SKILL_TREE: SkillDefinition[] = [
  // =========================================================================
  // 0-1 an (Bébé)
  // =========================================================================

  // autonomie
  skill('autonomie', '0-1', 1, 'Tient sa tétine / son biberon avec aide'),
  skill('autonomie', '0-1', 2, 'Tient son biberon seul'),
  skill('autonomie', '0-1', 3, 'Commence à porter la cuillère à la bouche'),
  skill('autonomie', '0-1', 4, 'Tend les bras pour aider à l\'habillage'),

  // cuisine
  skill('cuisine', '0-1', 1, 'Tète / prend le biberon'),
  skill('cuisine', '0-1', 2, 'Accepte les purées à la cuillère'),
  skill('cuisine', '0-1', 3, 'Mange des morceaux fondants (DME)'),
  skill('cuisine', '0-1', 4, 'Boit au gobelet avec aide'),

  // menage
  skill('menage', '0-1', 1, 'Attrape un objet qu\'on lui tend'),
  skill('menage', '0-1', 2, 'Passe un objet d\'une main à l\'autre'),
  skill('menage', '0-1', 3, 'Explore les objets du quotidien'),
  skill('menage', '0-1', 4, 'Range un objet dans un contenant'),

  // social
  skill('social', '0-1', 1, 'Sourit en réponse'),
  skill('social', '0-1', 2, 'Gazouille, babille'),
  skill('social', '0-1', 3, 'Fait « coucou » de la main'),
  skill('social', '0-1', 4, 'Pointe du doigt pour demander'),

  // organisation
  skill('organisation', '0-1', 1, 'S\'endort avec un rituel'),
  skill('organisation', '0-1', 2, 'Commence à différencier jour/nuit'),
  skill('organisation', '0-1', 3, 'Participe au rituel du bain'),
  skill('organisation', '0-1', 4, 'Montre des signes de fatigue reconnaissables'),

  // responsabilite — aucune pour 0-1

  // =========================================================================
  // 1-2 ans (Tout-petit)
  // =========================================================================

  // autonomie
  skill('autonomie', '1-2', 1, 'Enlève ses chaussettes / chapeau'),
  skill('autonomie', '1-2', 2, 'Essaie d\'enfiler ses chaussures'),
  skill('autonomie', '1-2', 3, 'Aide à retirer son manteau'),
  skill('autonomie', '1-2', 4, 'Se lave les mains avec aide'),
  skill('autonomie', '1-2', 5, 'Commence à signaler la couche sale'),

  // cuisine
  skill('cuisine', '1-2', 1, 'Mange seul à la cuillère'),
  skill('cuisine', '1-2', 2, 'Boit au gobelet sans couvercle'),
  skill('cuisine', '1-2', 3, 'Utilise une fourchette pour piquer'),
  skill('cuisine', '1-2', 4, 'Commence à exprimer ses préférences'),

  // menage
  skill('menage', '1-2', 1, 'Met un objet dans la poubelle'),
  skill('menage', '1-2', 2, 'Range un jouet dans son bac'),
  skill('menage', '1-2', 3, 'Aide à essuyer une surface'),
  skill('menage', '1-2', 4, 'Rapporte un objet à sa place'),

  // social
  skill('social', '1-2', 1, 'Dit quelques mots'),
  skill('social', '1-2', 2, 'Montre ce qu\'il veut du doigt'),
  skill('social', '1-2', 3, 'Comprend des consignes simples'),
  skill('social', '1-2', 4, 'Commence à jouer à côté d\'autres enfants'),

  // organisation
  skill('organisation', '1-2', 1, 'Participe au brossage de dents'),
  skill('organisation', '1-2', 2, 'Va chercher ses chaussures avant de sortir'),
  skill('organisation', '1-2', 3, 'Suit une routine simple'),
  skill('organisation', '1-2', 4, 'S\'assied sur le pot quand on le propose'),

  // responsabilite — aucune pour 1-2

  // =========================================================================
  // 2-3 ans (Petit enfant)
  // =========================================================================

  // autonomie
  skill('autonomie', '2-3', 1, 'Enfile un t-shirt avec aide'),
  skill('autonomie', '2-3', 2, 'Met et enlève ses chaussures à scratch'),
  skill('autonomie', '2-3', 3, 'Se lave les mains seul'),
  skill('autonomie', '2-3', 4, 'Se brosse les dents (parent termine)'),
  skill('autonomie', '2-3', 5, 'Va aux toilettes avec aide'),

  // cuisine
  skill('cuisine', '2-3', 1, 'Verse un ingrédient dans un bol'),
  skill('cuisine', '2-3', 2, 'Mélange avec une cuillère en bois'),
  skill('cuisine', '2-3', 3, 'Étale du beurre sur une tartine'),
  skill('cuisine', '2-3', 4, 'Lave un fruit sous le robinet'),

  // menage
  skill('menage', '2-3', 1, 'Range ses jouets en fin de journée'),
  skill('menage', '2-3', 2, 'Met son linge sale dans le panier'),
  skill('menage', '2-3', 3, 'Essuie une petite flaque avec une éponge'),
  skill('menage', '2-3', 4, 'Aide à mettre les serviettes sur la table'),
  skill('menage', '2-3', 5, 'Arrose une plante'),

  // social
  skill('social', '2-3', 1, 'Dit « s\'il te plaît » et « merci »'),
  skill('social', '2-3', 2, 'Attend son tour (avec aide)'),
  skill('social', '2-3', 3, 'Exprime ses émotions avec des mots simples'),
  skill('social', '2-3', 4, 'Joue à faire semblant'),

  // organisation
  skill('organisation', '2-3', 1, 'Suit une routine visuelle'),
  skill('organisation', '2-3', 2, 'Choisit entre deux options'),
  skill('organisation', '2-3', 3, 'Reconnaît ses affaires'),
  skill('organisation', '2-3', 4, 'Comprend « avant » et « après »'),

  // responsabilite — aucune pour 2-3

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

/** Retourne l'ID de la compétence précédente (prérequis), ou undefined si c'est la première */
export function getPrerequisiteId(skill: SkillDefinition): string | undefined {
  if (skill.order <= 1) return undefined;
  return `${skill.categoryId}_${skill.ageBracketId}_${skill.order - 1}`;
}

/** Calcule l'état d'une compétence par rapport aux déverrouillages */
export function getSkillState(skillId: string, unlockedIds: Set<string>): SkillState {
  if (unlockedIds.has(skillId)) return 'unlocked';
  const skill = SKILL_BY_ID.get(skillId);
  if (!skill) return 'locked';
  if (skill.order === 1) return 'unlockable';
  const prevId = getPrerequisiteId(skill);
  if (prevId && unlockedIds.has(prevId)) return 'unlockable';
  return 'locked';
}
