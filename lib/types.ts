// ─────────────────────────────────────────────
// Family Vault — TypeScript types
// All data lives in plain Markdown files (.md)
// ─────────────────────────────────────────────

export type { ProfileTheme } from '../constants/themes';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;       // YYYY-MM-DD from 📅
  recurrence?: string;    // "every day|week|month" from 🔁
  completedDate?: string; // YYYY-MM-DD from ✅
  reminderTime?: string;  // HH:MM from ⏰
  tags: string[];         // #tag extracted from text
  mentions: string[];     // @user extracted from text
  sourceFile: string;     // relative path in vault
  lineIndex: number;      // line index in file (0-based, for writes)
  section?: string;       // H2/H3 section header above this task
  secret?: boolean;                           // mission secrète
  targetProfileId?: string;                   // profil ciblé par la mission
  secretStatus?: 'active' | 'pending' | 'validated'; // statut de la mission secrète
}

export interface RDV {
  title: string;
  date_rdv: string;         // YYYY-MM-DD
  heure: string;            // HH:MM
  type_rdv: string;         // pédiatre|vaccin|pmi|dentiste|urgences|autre
  enfant: string;           // Maxence|Enfant 2
  médecin: string;
  lieu: string;
  statut: 'planifié' | 'fait' | 'annulé';
  sourceFile: string;
  questions?: string[];     // Questions à poser au médecin
  reponses?: string;        // Réponses / notes post-consultation
}

export interface JournalEntry {
  date: string;             // YYYY-MM-DD
  enfant: string;
  sourceFile: string;
  alimentation: JournalTableRow[];
  couches: JournalTableRow[];
  sommeil: JournalTableRow[];
  humeur: string[];
  raw: string;              // full raw content for display
}

export interface JournalTableRow {
  heure?: string;
  type?: string;
  detail?: string;
  notes?: string;
}

export type AgeCategory = 'bebe' | 'petit' | 'enfant' | 'ado';

export type Gender = 'garçon' | 'fille';

/** Vérifie si une valeur est un genre valide */
export function isValidGender(value: unknown): value is Gender {
  return value === 'garçon' || value === 'fille';
}

export interface Profile {
  id: string;               // snake_case key used in files
  name: string;
  role: 'enfant' | 'ado' | 'adulte';
  avatar: string;           // single emoji
  birthdate?: string;       // YYYY-MM-DD or YYYY
  ageCategory?: AgeCategory; // stored at scaffold, used for upgrade detection
  propre?: boolean;          // potty-trained — hides diaper sections in journal/tasks
  gender?: Gender;              // sexe — utilisé pour les courbes de croissance
  statut?: 'grossesse' | 'ne'; // pregnancy mode vs born (absent = born)
  dateTerme?: string;        // YYYY-MM-DD expected due date (grossesse only)
  theme?: import('../constants/themes').ProfileTheme;  // visual theme
  treeSpecies?: import('../lib/mascot/types').TreeSpecies; // espèce d'arbre mascotte
  mascotDecorations: string[];   // IDs des décorations achetées
  mascotInhabitants: string[];   // IDs des habitants achetés
  mascotPlacements: Record<string, string>;  // slotId → itemId (placement sur la scène)
  farmCrops?: string;             // CSV cultures plantees (plotIndex:cropId:stage:tasks:date)
  farmBuildings?: import('../lib/mascot/types').PlacedBuilding[];  // Batiments places sur la grille
  farmInventory?: import('../lib/mascot/types').FarmInventory;     // Inventaire ressources (oeuf, lait, farine)
  harvestInventory?: import('../lib/mascot/types').HarvestInventory;  // Recoltes brutes en stock
  craftedItems?: import('../lib/mascot/types').CraftedItem[];         // Items craftes en inventaire
  farmTech?: string[];    // IDs des noeuds tech debloques
  farmRareSeeds?: import('../lib/mascot/types').RareSeedInventory;  // Graines rares en stock
  wearEvents?: import('./mascot/wear-engine').WearEvent[];          // Evenements d'usure ferme
  companion?: import('./mascot/companion-types').CompanionData | null; // Compagnon actif du profil
  points: number;
  coins: number;            // 🍃 Feuilles — monnaie dépensable (boutique)
  level: number;
  streak: number;
  lootBoxesAvailable: number;
  multiplier: number;       // point multiplier (default 1)
  multiplierRemaining: number; // tasks remaining with multiplier
  pityCounter: number;       // boxes opened without épique+ (pity system)
  sagaTitle?: string;         // titre temporaire affiché après complétion saga (7 jours)
  sagaItems?: SagaItem[];     // items temporaires obtenus via sagas (expirent après 7 jours)
  completedSagas?: string[];  // IDs des sagas terminées
}

/** Item temporaire obtenu via saga */
export interface SagaItem {
  itemId: string;            // ID de la décoration ou habitant
  type: 'decoration' | 'inhabitant';
  expiresAt: string;         // YYYY-MM-DD (date d'expiration)
}

const SAGA_ITEM_DURATION_DAYS = 7;

/** Crée un SagaItem expirant dans 7 jours */
export function createSagaItem(itemId: string, type: 'decoration' | 'inhabitant'): SagaItem {
  const expires = new Date();
  expires.setDate(expires.getDate() + SAGA_ITEM_DURATION_DAYS);
  return { itemId, type, expiresAt: expires.toISOString().split('T')[0] };
}

/** Filtre les saga items expirés */
export function filterActiveSagaItems(items: SagaItem[]): SagaItem[] {
  const today = new Date().toISOString().split('T')[0];
  return items.filter(i => i.expiresAt >= today);
}

/** Détecte un profil bébé : ageCategory === 'bebe' OU birthdate < 2 ans (fallback si ageCategory absent) */
export function isBabyProfile(p: Profile): boolean {
  if (p.role !== 'enfant') return false;
  if (p.ageCategory === 'bebe') return true;
  if (p.ageCategory) return false; // catégorie définie mais pas bébé
  // Fallback : calculer depuis birthdate quand ageCategory absent
  if (!p.birthdate) return false;
  const birth = new Date(p.birthdate);
  if (isNaN(birth.getTime())) return false;
  const ageMs = Date.now() - birth.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  return ageYears < 2;
}

export interface AgeUpgrade {
  profileId: string;
  childName: string;
  oldCategory: AgeCategory;
  newCategory: AgeCategory;
}

export interface LootBox {
  rarity: LootRarity;
  reward: string;           // display text
  emoji: string;
  bonusPoints: number;
  requiresParent?: boolean; // needs parent approval
  multiplier?: number;      // optional point multiplier reward
  multiplierTasks?: number; // how many tasks the multiplier lasts
  rewardType?: RewardType;  // type of reward for active rewards
  openedAt?: string;        // ISO timestamp
  seasonal?: string;        // event id si reward saisonnière (ex: 'halloween', 'noel')
  mascotItemId?: string;    // ID de la décoration/habitant droppé
}

export interface RewardDefinition {
  emoji: string;
  reward: string;
  bonusPoints: number;
  requiresParent?: boolean;
  multiplier?: number;
  multiplierTasks?: number;  // how many tasks for multiplier rewards
  rewardType: RewardType;
  mascotItemId?: string;     // ID de la décoration/habitant pour drops mascotte
}

export interface GamificationEntry {
  profileId: string;
  action: string;           // e.g. "+10" or "loot:commun"
  points: number;
  note: string;             // e.g. "Tâche: Ménage cuisine" or "🐻 Badge Ourson"
  timestamp: string;        // ISO string
}

export interface UsedLoot {
  id: string;          // unique : `${profileId}_${timestamp}` du loot entry original
  profileId: string;
  emoji: string;
  label: string;
  earnedAt: string;    // timestamp ISO original (de GamificationEntry)
  usedAt: string;      // timestamp ISO quand marqué utilisé
}

export interface GamificationData {
  profiles: Profile[];
  history: GamificationEntry[];
  activeRewards: ActiveReward[];
  usedLoots?: UsedLoot[];
}

// ─── Recipes (Cooklang) ─────────────────────────────────────────────────────

export type { AppRecipe as Recipe, AppIngredient as RecipeIngredient, AppStep as RecipeStep } from './cooklang';

export type { BudgetEntry, BudgetConfig, BudgetCategory } from './budget';

export interface VacationConfig {
  active: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface VaultConfig {
  vaultPath: string;
  telegramToken?: string;
  telegramChatId?: string;
}

export interface CourseItem {
  id: string;
  text: string;
  completed: boolean;
  lineIndex: number;
  section?: string;     // section header (e.g. "🥩 Frais")
}

export interface MealItem {
  id: string;           // "lundi:déjeuner"
  day: string;          // "Lundi"
  mealType: string;     // "Petit-déj" | "Déjeuner" | "Dîner"
  text: string;         // "Pâtes carbonara" (empty string if not planned)
  recipeRef?: string;   // relative path inside Recettes/ e.g. "Plats/Pates Carbonara"
  lineIndex: number;    // 0-based line in file
  sourceFile: string;
}

export interface PhotoEntry {
  date: string;       // "2026-03-06"
  enfantId: string;   // "maxence"
  enfantName: string; // "Maxence"
  uri: string;        // file:///vault/07 - Photos/Maxence/2026-03-06.jpg
}

export type MemoryType = 'premières-fois' | 'moment-fort';

export interface Memory {
  date: string;          // "2026-03-07"
  title: string;         // "Premier sourire"
  description: string;   // "Grand sourire ce matin"
  type: MemoryType;
  enfant: string;        // "Maxence"
  enfantId: string;      // "maxence"
}

// ─── Mots d'enfants ──────────────────────────────────────────────────────────

export interface ChildQuote {
  date: string;          // YYYY-MM-DD
  enfant: string;        // prénom
  citation: string;      // la perle
  contexte?: string;     // "Au parc", "Avant de dormir"
  sourceFile: string;
  lineIndex: number;
}

// ─── Météo des humeurs ───────────────────────────────────────────────────────

export type MoodLevel = 1 | 2 | 3 | 4 | 5;
export const MOOD_EMOJIS: Record<MoodLevel, string> = { 1: '😢', 2: '😐', 3: '😊', 4: '😄', 5: '🤩' };

export interface MoodEntry {
  date: string;        // YYYY-MM-DD
  profileId: string;
  profileName: string;
  level: MoodLevel;
  note?: string;
  sourceFile: string;
  lineIndex: number;
}

// ─── Journal grossesse ───────────────────────────────────────────────────────

export interface PregnancyWeekEntry {
  week: number;          // SA (semaine d'aménorrhée)
  date: string;          // YYYY-MM-DD (date de la saisie)
  poids?: number;        // kg
  symptomes?: string;    // texte libre
  notes?: string;        // texte libre
  sourceFile: string;
  lineIndex: number;
}

export interface StockItem {
  produit: string;
  detail?: string;
  quantite: number;
  seuil: number;
  qteAchat?: number;
  tracked?: boolean;     // alertes stock bas actives (défaut true si absent)
  emplacement: string;  // 'frigo' | 'congelateur' | 'placards' | 'bebe'
  section?: string;      // sous-catégorie dans l'emplacement (e.g. "Couches", "Épicerie")
  lineIndex: number;     // 0-based line index in file (for writes)
}

export type LootRarity = 'commun' | 'rare' | 'épique' | 'légendaire' | 'mythique';

export type RewardType =
  | 'points'
  | 'badge'
  | 'reward'
  | 'multiplier'
  | 'skip'
  | 'skip_all'
  | 'vacation'
  | 'crown'
  | 'family_bonus'
  | 'double_loot'
  | 'mascot_deco'
  | 'mascot_hab'
  | 'farm_seed'
  | 'companion';

export interface ActiveReward {
  id: string;
  type: RewardType;
  emoji: string;
  label: string;
  profileId: string;
  expiresAt?: string;         // ISO date (vacation, crown)
  remainingDays?: number;
  remainingTasks?: number;    // multiplier tasks remaining
}

// ─── Événements saisonniers ──────────────────────────────────────────────────

export interface SeasonalEvent {
  id: string;              // 'halloween' | 'noel' | 'paques' | ...
  name: string;            // 'Halloween'
  emoji: string;           // '🎃'
  startDate: string;       // 'MM-DD' ou 'dynamic' pour Pâques
  endDate: string;         // 'MM-DD' ou 'dynamic'
  themeColor: string;      // couleur du bandeau
  rewards: Partial<Record<LootRarity, RewardDefinition[]>>;
}

// ─── Mode nuit bébé ──────────────────────────────────────────────────────────

export type FeedType = 'allaitement' | 'biberon';
export type BreastSide = 'gauche' | 'droite';

export interface NightFeedEntry {
  id: string;
  type: FeedType;
  startedAt: string;       // ISO timestamp
  durationSeconds: number;
  side?: BreastSide;       // allaitement seulement
  volumeMl?: number;       // biberon seulement
  enfant: string;
  enfantId: string;
  note?: string;
}

// ─── Suivi médical ────────────────────────────────────────────────────────────

export interface GrowthEntry {
  date: string;       // YYYY-MM-DD
  poids?: number;     // kg
  taille?: number;    // cm
  perimetre?: number; // périmètre crânien cm (bébé)
  note?: string;
}

export interface VaccineEntry {
  nom: string;        // ex: "ROR", "DTP", "BCG"
  date: string;       // YYYY-MM-DD de l'injection
  dose?: string;      // "1ère dose", "Rappel"
  note?: string;
}

export interface HealthRecord {
  enfant: string;
  enfantId: string;
  allergies: string[];
  antecedents: string[];     // maladies passées
  medicamentsEnCours: string[];
  groupeSanguin?: string;
  contactMedecin?: string;   // nom + tel du médecin traitant
  contactPediatre?: string;
  contactUrgences?: string;
  croissance: GrowthEntry[];
  vaccins: VaccineEntry[];
}

// ─── Routines ─────────────────────────────────────────────────────────────────

export interface RoutineStep {
  text: string;
  durationMinutes?: number; // durée optionnelle du timer (en minutes)
}

export interface Routine {
  id: string;         // "matin" | "soir" | slug custom
  label: string;      // titre affiché ("Matin", "Soir")
  emoji: string;      // ☀️ | 🌙
  steps: RoutineStep[];
  profileId?: string;        // lié à un profil enfant (mode visuel)
  timeOfDay?: 'matin' | 'soir';  // pour auto-affichage dashboard
  isVisual?: boolean;        // active le mode plein écran gros emojis
}

export interface RoutineProgress {
  completedSteps: number[];  // indices des étapes terminées
  startedAt?: string;        // ISO timestamp du début de la routine
}

// ─── Notifications ──────────────────────────────────────────────────────────

// ─── Défis familiaux ─────────────────────────────────────────────────────────

export type DefiType = 'daily' | 'abstinence' | 'cumulative';
export type DefiStatus = 'active' | 'completed' | 'failed' | 'archived';

export interface Defi {
  id: string;                    // "defi_<timestamp>_<rand>"
  title: string;
  description: string;
  type: DefiType;
  startDate: string;             // YYYY-MM-DD
  endDate: string;
  targetDays: number;
  targetMetric?: number;         // pour cumulative (ex: 900 min)
  metricUnit?: string;           // "min", "pas", "pages"
  emoji: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
  participants: string[];        // profile IDs (vide = toute la famille)
  status: DefiStatus;
  progress: DefiDayEntry[];
  rewardPoints: number;
  rewardLootBoxes: number;
  templateId?: string;
}

export interface DefiDayEntry {
  date: string;
  profileId: string;
  completed: boolean;
  value?: number;                // pour cumulative
  note?: string;
}

// ─── Gratitude ──────────────────────────────────────────────────────────────

export interface GratitudeEntry {
  date: string;           // YYYY-MM-DD
  profileId: string;
  profileName: string;
  text: string;
}

export interface GratitudeDay {
  date: string;           // YYYY-MM-DD
  entries: GratitudeEntry[];
}

// ─── Wishlist / Idées cadeaux ────────────────────────────────────────────────

export type WishBudget = '' | '💰' | '💰💰' | '💰💰💰';
export type WishOccasion = '' | '🎂' | '🎄';

export interface WishlistItem {
  id: string;
  text: string;
  budget: WishBudget;
  occasion: WishOccasion;
  notes: string;
  url: string;             // lien produit (Amazon, etc.)
  bought: boolean;
  boughtBy: string;        // profileName du parent qui a acheté
  profileName: string;     // propriétaire du souhait (section ##)
  sourceFile: string;
  lineIndex: number;
}

// ─── Anniversaires ──────────────────────────────────────────────────────────

export interface Anniversary {
  name: string;           // Nom de la personne
  date: string;           // MM-DD (jour et mois, sans année)
  birthYear?: number;     // Année de naissance (optionnel)
  contactId?: string;     // ID contact iOS (pour déduplication import)
  category?: string;      // famille, ami, collègue, etc.
  notes?: string;         // Notes optionnelles
  sourceFile: string;     // Chemin fichier vault
}

export type NotifEvent =
  | 'task_completed'
  | 'loot_box_opened'
  | 'all_tasks_done'
  | 'leaderboard'
  | 'daily_summary'
  | 'defi_launched'
  | 'manual';

export interface TemplateVariable {
  key: string;      // e.g. "profile.name"
  label: string;    // e.g. "Nom du profil"
  example: string;  // e.g. "Papa"
}

export interface NotificationConfig {
  id: string;
  label: string;
  emoji: string;
  enabled: boolean;
  template: string;
  defaultTemplate: string;
  event: NotifEvent;
  availableVariables: TemplateVariable[];
  isCustom: boolean;
}

export interface NotificationPreferences {
  version: 1;
  notifications: NotificationConfig[];
}

// ─── Arbre de compétences ────────────────────────────────────────────────────

export interface SkillUnlock {
  skillId: string;          // ex: "autonomie_3-5_1"
  unlockedAt: string;       // ISO timestamp
  unlockedBy: string;       // profileId du parent validateur
}

export interface SkillTreeData {
  profileId: string;        // enfant id
  profileName: string;      // enfant name
  unlocked: SkillUnlock[];
}

// ─── Notes & Articles ────────────────────────────────────────────────────────

export const NOTE_CATEGORIES = [
  '📋 Administratif',
  '🏥 Santé',
  '🎓 École',
  '💰 Finances',
  '📖 Articles',
  '📌 Divers',
] as const;

export type NoteCategory = typeof NOTE_CATEGORIES[number];

export interface Note {
  title: string;
  url?: string;           // URL source (articles importés)
  category: string;       // ex: "📋 Administratif"
  created: string;        // YYYY-MM-DD
  tags: string[];
  content: string;        // corps markdown
  sourceFile: string;     // chemin relatif vault
}
