// lib/semantic/categories.ts
// Mapping table des 10 catégories sémantiques v1.3 Seed (Phase 19).
// Décisions : D-01 (hardcoded, zéro dépendance), D-02 (priorité tag > section > filepath),
// D-08 (10 CategoryId canoniques alignés 1:1 avec EFFECTS-01..10 de Phase 20).
// ARCH-01 : aucun import vault.ts — module pur consommé uniquement par derive.ts.

/**
 * Identifiants canoniques des 10 catégories. L'ordre correspond à EFFECTS-01..10.
 * Ne JAMAIS renommer une valeur après livraison — Phase 20 dispatcher mappe dessus.
 */
export type CategoryId =
  | 'menage_quotidien'   // EFFECTS-01 — weeds removed
  | 'menage_hebdo'       // EFFECTS-02 — wear repair
  | 'courses'            // EFFECTS-03 — building turbo
  | 'enfants_routines'   // EFFECTS-04 — companion mood spike
  | 'enfants_devoirs'    // EFFECTS-05 — Growth Sprint
  | 'rendez_vous'        // EFFECTS-06 — rare seed drop
  | 'gratitude_famille'  // EFFECTS-07 — saga trait boost
  | 'budget_admin'       // EFFECTS-08 — building capacity ×2
  | 'bebe_soins'         // EFFECTS-09 — golden harvest ×3
  | 'cuisine_repas';     // EFFECTS-10 — rare craft recipe

/**
 * Résultat d'une détection réussie. `evidence` est la valeur BRUTE (non normalisée)
 * qui a matché — Phase 21 l'utilisera dans les toasts utilisateurs (D-04b).
 */
export type CategoryMatch = {
  id: CategoryId;
  matchedBy: 'tag' | 'section' | 'filepath';
  evidence: string;
};

/**
 * Une entrée de la table de mapping. Tous les patterns sont DÉJÀ normalisés
 * (lowercase + sans accent + trim) pour permettre une comparaison directe
 * après passage de l'entrée par normalize() dans derive.ts (D-03).
 */
export type SemanticCategory = {
  id: CategoryId;
  labelFr: string;
  labelEn: string;
  /** Premier segment de sourceFile après strip du préfixe "NN - ", normalisé (D-03b). */
  filepathPatterns: string[];
  /** Sous-chaînes cherchées via .includes() sur task.section normalisée (D-03c). */
  sectionPatterns: string[];
  /** Tags (sans '#') comparés via === après normalisation (D-03d). */
  tagPatterns: string[];
};

/**
 * Table des 10 catégories. Ordre important : lors d'une ambiguïté (ex : section
 * "quotidien" qui existe dans plusieurs catégories), la PREMIÈRE entrée dans
 * l'ordre ci-dessous qui matche gagne. Voir RESEARCH.md Pitfall 3.
 *
 * Stratégie de disambiguïsation filepath / section / tag :
 *  - `02 - Maison` : overlap menage_quotidien / menage_hebdo / courses → les tags
 *    `#courses` et les sections `menage` / `hebdomadaire` disambiguent ; le
 *    filepath `maison` retombe sur `menage_hebdo` (catégorie la plus commune).
 *  - `01 - Enfants` : overlap enfants_routines / enfants_devoirs / bebe_soins →
 *    les sections (`devoirs`, `biberons`, `couches`, `langer`, `tetine`)
 *    disambiguent ; le filepath `enfants` retombe sur `enfants_routines`.
 *  - Les autres dossiers (cuisine, rendez-vous, budget, memoires) sont 1:1.
 */
export const CATEGORIES: readonly SemanticCategory[] = [
  // --- Ordre priorité : spécifique avant générique ---
  {
    id: 'courses',
    labelFr: 'Courses',
    labelEn: 'Shopping',
    filepathPatterns: [],                       // disambiguïsation via tag/section uniquement
    sectionPatterns: ['courses', 'liste de courses', 'frais', 'fruits & legumes'],
    tagPatterns: ['courses', 'liste', 'shopping'],
  },
  {
    id: 'bebe_soins',
    labelFr: 'Soins bébé',
    labelEn: 'Baby care',
    filepathPatterns: [],                       // overlap enfants → section/tag disambigue
    sectionPatterns: ['bebe', 'soins', 'biberons', 'couches', 'langer', 'tetine'],
    tagPatterns: ['bebe', 'baby', 'biberon'],
  },
  {
    id: 'enfants_devoirs',
    labelFr: 'Devoirs enfants',
    labelEn: 'Homework',
    filepathPatterns: [],
    sectionPatterns: ['devoirs', 'scolaire', 'ecole', 'homework'],
    tagPatterns: ['devoirs', 'ecole', 'homework', 'scolaire'],
  },
  {
    id: 'menage_quotidien',
    labelFr: 'Ménage quotidien',
    labelEn: 'Daily housework',
    filepathPatterns: [],                       // priorité section pour séparer de hebdo
    sectionPatterns: ['quotidien', 'tous les 3 jours'],
    tagPatterns: ['menage_quotidien', 'quotidien'],
  },
  {
    id: 'menage_hebdo',
    labelFr: 'Ménage hebdomadaire',
    labelEn: 'Weekly cleaning',
    filepathPatterns: ['maison'],               // fallback large pour 02 - Maison (Pitfall 3)
    sectionPatterns: ['menage', 'hebdomadaire', 'mensuel'],
    tagPatterns: ['menage', 'menage_hebdo', 'nettoyage'],
  },
  {
    id: 'enfants_routines',
    labelFr: 'Routines enfants',
    labelEn: 'Child routines',
    filepathPatterns: ['enfants'],              // fallback large pour 01 - Enfants
    sectionPatterns: ['routine'],
    tagPatterns: ['routine', 'enfants'],
  },
  {
    id: 'cuisine_repas',
    labelFr: 'Cuisine & repas',
    labelEn: 'Cooking & meals',
    filepathPatterns: ['cuisine'],              // 03 - Cuisine → cuisine_repas (1:1)
    sectionPatterns: ['repas', 'cuisine', 'recettes', 'menu'],
    tagPatterns: ['cuisine', 'repas', 'recette', 'menu'],
  },
  {
    id: 'rendez_vous',
    labelFr: 'Rendez-vous',
    labelEn: 'Appointments',
    filepathPatterns: ['rendez-vous'],          // 04 - Rendez-vous → rendez_vous (1:1)
    sectionPatterns: ['rendez-vous', 'medical', 'sante'],
    tagPatterns: ['rdv', 'medical', 'sante', 'rendez-vous'],
  },
  {
    id: 'budget_admin',
    labelFr: 'Budget & admin',
    labelEn: 'Budget & admin',
    filepathPatterns: ['budget'],               // 05 - Budget → budget_admin (1:1)
    sectionPatterns: ['budget', 'admin', 'factures', 'impots'],
    tagPatterns: ['budget', 'admin', 'factures', 'impots'],
  },
  {
    id: 'gratitude_famille',
    labelFr: 'Gratitude & famille',
    labelEn: 'Gratitude & family',
    filepathPatterns: ['memoires'],             // 06 - Mémoires → gratitude_famille
    sectionPatterns: ['gratitude', 'famille', 'anniversaire'],
    tagPatterns: ['gratitude', 'famille', 'anniversaire'],
  },
];
