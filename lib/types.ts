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
  xpOverride?: number;                        // XP personnalisé (⭐ N) — remplace POINTS_PER_TASK
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

/** Catégorie d'âge utilisée pour pondérer les profils dans le moteur Sporée (Phase 39) */
export type WagerAgeCategory = 'adulte' | 'ado' | 'enfant' | 'jeune' | 'bebe';

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
  weight_override?: WagerAgeCategory; // Phase 39 — override poids pondération Sporée
  dateTerme?: string;        // YYYY-MM-DD expected due date (grossesse only)
  theme?: import('../constants/themes').ProfileTheme;  // visual theme
  // ─── Voix TTS (IVC + PVC ElevenLabs + iOS Personal Voice) ──────
  voiceElevenLabsId?: string;   // voice_id ElevenLabs (cloné ou prédéfini)
  voiceFishAudioId?: string;    // reference_id Fish Audio (cloné via /model)
  voicePersonalId?: string;     // identifier iOS Personal Voice
  voiceSource?: 'ios-personal' | 'elevenlabs-cloned' | 'elevenlabs-preset' | 'fish-audio-cloned' | 'expo-speech';
  // ─── Clonage Pro (PVC) — précisions sur voiceElevenLabsId ──────
  voiceCloneType?: 'instant' | 'professional';                                // type de clonage (défaut 'instant' si absent)
  voiceTrainingStatus?: 'idle' | 'samples' | 'training' | 'ready' | 'failed'; // état du training PVC
  voiceTrainingStartedAt?: string;                                            // ISO datetime du déclenchement /train
  voiceTrainingMessage?: string;                                              // dernier message d'erreur/info ElevenLabs
  gardenName?: string;           // nom personnalisé du jardin (fallback "Mon jardin")
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
  plotLevels?: number[];  // niveaux d'amélioration des parcelles (1-5)
  // Phase 38/40 — économie Sporée (mergés depuis FarmProfileData via useVault runtime merge)
  sporeeCount?: number;                    // inventaire Sporée 0-10
  sporeeShopBoughtToday?: number;          // achats shop du jour 0-2
  sporeeShopLastResetDate?: string;        // YYYY-MM-DD local — dernier reset cap quotidien
  // Phase 20 — bonus temporels effets sémantiques (mergés depuis FarmProfileData)
  growthSprintUntil?: string;       // ISO datetime — EFFECTS-05 : -1 task/stage temporaire
  wearEvents?: import('./mascot/wear-engine').WearEvent[];          // Evenements d'usure ferme
  companion?: import('./mascot/companion-types').CompanionData | null; // Compagnon actif du profil
  giftHistory?: string;       // CSV historique cadeaux (pipe-separe, 10 derniers)
  giftsSentToday?: string;    // Anti-abus format "count|YYYY-MM-DD"
  foodAllergies?: string[];      // PREF-02 : IDs canoniques EU_ALLERGENS ou texte libre
  foodIntolerances?: string[];   // PREF-02 : IDs COMMON_INTOLERANCES ou texte libre
  foodRegimes?: string[];        // PREF-02 : IDs COMMON_REGIMES ou texte libre
  foodAversions?: string[];      // PREF-02 : texte libre uniquement (pas de catalogue)
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
  | 'gift_received'
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

// ─── Love Notes (messages affectifs programmes — Phase 34) ──────────────────

/** Statut de revelation d'une love note (cycle pending -> revealed -> read -> archived) */
export type LoveNoteStatus = 'pending' | 'revealed' | 'read' | 'archived';

/**
 * Une note affective programmee entre membres de la famille.
 * Un fichier = une note, classe par destinataire dans `03 - Famille/LoveNotes/{to}/`.
 * revealAt stocke en heure locale de l'appareil au moment de la composition
 * (convention ISO sans Z, cohérente avec museum/village). La reveal logic
 * (Phase 36) interpretera cette string comme heure locale a la lecture.
 */
export interface LoveNote {
  /** ID du profil emetteur (expediteur) */
  from: string;
  /** ID du profil destinataire (recipiendaire) */
  to: string;
  /** Timestamp ISO 8601 de creation — YYYY-MM-DDTHH:mm:ss (sans Z) */
  createdAt: string;
  /** Timestamp ISO 8601 de revelation programmee — YYYY-MM-DDTHH:mm:ss */
  revealAt: string;
  /** Statut actuel : pending (en attente), revealed (revealee, non lue), read (lue) */
  status: LoveNoteStatus;
  /** Timestamp ISO 8601 de lecture (present uniquement si status === 'read') */
  readAt?: string;
  /** Corps markdown de la note (message de l'expediteur) */
  body: string;
  /** Chemin relatif dans le vault — non serialise, utilise pour update/delete */
  sourceFile: string;
}

// ─── Farm profile data (farm-{profileId}.md) ─────────────────────────────────

/** Données ferme/mascot/compagnon per-profil — stockées dans farm-{profileId}.md */
export interface FarmProfileData {
  gardenName?: string;
  treeSpecies?: import('../lib/mascot/types').TreeSpecies;
  mascotDecorations: string[];
  mascotInhabitants: string[];
  mascotPlacements: Record<string, string>;
  farmCrops?: string;
  farmBuildings?: import('../lib/mascot/types').PlacedBuilding[];
  farmInventory?: import('../lib/mascot/types').FarmInventory;
  harvestInventory?: import('../lib/mascot/types').HarvestInventory;
  craftedItems?: import('../lib/mascot/types').CraftedItem[];
  farmTech?: string[];
  farmRareSeeds?: import('../lib/mascot/types').RareSeedInventory;
  wearEvents?: import('./mascot/wear-engine').WearEvent[];
  companion?: import('./mascot/companion-types').CompanionData | null;
  giftHistory?: string; // CSV pipe-separe des 10 derniers echanges
  giftsSentToday?: string; // format "count|YYYY-MM-DD" anti-abus
  // Phase 20 — bonus temporels effets semantiques
  buildingTurboUntil?: string;      // ISO datetime — EFFECTS-03
  growthSprintUntil?: string;       // ISO datetime — EFFECTS-05
  capacityBoostUntil?: string;      // ISO datetime — EFFECTS-08
  nextHarvestGolden?: boolean;      // EFFECTS-09
  unlockedEffectRecipes?: string[]; // IDs recettes debloquees via EFFECTS-10
  effectGoldenMultiplier?: number;  // EFFECTS-09 : x3 (distinct du GOLDEN_HARVEST_MULTIPLIER = 5)
  village_claimed_week?: string;    // ISO 'YYYY-MM-DD' — semaine village la plus recente claimee (per D-08)
  // Q49 — Échange inter-familles via Port
  trade_claimed_codes?: string[];   // Codes-cadeaux déjà réclamés (max 200 entrees)
  trade_sent_today?: string;        // Anti-abus format "count|YYYY-MM-DD" (per MAX_TRADES_PER_DAY)
  // Phase 33 — Expeditions
  activeExpeditions?: ActiveExpedition[];
  expeditionPity?: number;
  // Amélioration des parcelles (sink feuilles)
  plotLevels?: number[];  // niveau 1-5 par plotIndex (absent = tout niveau 1)
  // Deal du jour — quota per-profil (stock séparé du marché)
  dailyDealPurchases?: { dateKey: string; itemId: string; purchased: number };
  // Phase 38 — économie Sporée per-profil (MOD/SPOR v1.7)
  sporeeCount?: number;                    // inventaire 0-10, default undefined
  sporeeShopBoughtToday?: number;          // achats shop du jour 0-2
  sporeeShopLastResetDate?: string;        // YYYY-MM-DD local — dernier reset cap quotidien
  sporeeOnboardingGiftClaimed?: boolean;   // true = cadeau stade 3 déjà donné (anti-rejeu)
  // Phase 40 — Bootstrap maybeRecompute (W3 : persistance vault-first, pas SecureStore)
  wagerLastRecomputeDate?: string;         // ISO YYYY-MM-DD — dernier passage de maybeRecompute pour ce profil
  // Phase 41 — Compteur codex vanité long terme (SPOR-10)
  wagerMarathonWins?: number;              // total paris Sporée gagnés (vanité, jamais reset)
}

// ─── Phase 33 — Expeditions ──────────────────────────────────────────────────

export type ExpeditionDifficulty = 'easy' | 'pousse' | 'medium' | 'hard' | 'expert' | 'legendary';
export type ExpeditionOutcome = 'success' | 'partial' | 'failure' | 'rare_discovery';

export interface ActiveExpedition {
  missionId: string;
  difficulty: ExpeditionDifficulty;
  startedAt: string;           // ISO string
  durationHours: number;       // 4 | 12 | 24
  result?: ExpeditionOutcome;  // undefined = pas encore collecte
  lootItemId?: string;         // ID item obtenu
  lootType?: 'inhabitant' | 'seed' | 'booster';
}

// ─── Histoires du soir ───────────────────────────────────────────────────────

export type StoryUniverseId =
  | 'espace' | 'ocean' | 'foret' | 'dinosaures'
  | 'princesse' | 'super-heros' | 'pirates' | 'robots' | 'surprise';

export type StoryReadingSpeed = 0.8 | 1.0 | 1.2;

export type StoryVoiceEngine = 'expo-speech' | 'elevenlabs' | 'fish-audio';

export type StoryLength = 'courte' | 'moyenne' | 'longue' | 'tres-longue';

export type StoryAudioMode = 'off' | 'doux' | 'spectacle';

export type ElevenLabsModel = 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' | 'eleven_flash_v2_5';

export interface StoryVoiceConfig {
  engine: StoryVoiceEngine;
  language: 'fr' | 'en';
  elevenLabsVoiceId?: string;
  fishAudioReferenceId?: string; // reference_id voix Fish Audio (clonée ou prédéfinie)
  voiceIdentifier?: string; // identifier voix iOS Enhanced/Premium (expo-speech)
  length?: StoryLength;     // préférence taille histoire — défaut 'moyenne'
  /** @deprecated remplacé par audioMode — conservé pour compatibilité ascendante */
  spectacle?: boolean;
  audioMode?: StoryAudioMode;   // off = voix seule, doux = + ambiance, spectacle = + SFX
  ambienceVolume?: number;      // 0..1 — défaut 0.4 (constante AMBIENCE_VOLUME)
  elevenLabsModel?: ElevenLabsModel; // défaut multilingual_v2 — turbo et flash = -50% coût (flash = qualité ↓)
  multiVoice?: boolean; // V2.4 — distribue les dialogues sur des voix de personnages (ElevenLabs only)
}

/** Tranche d'âge cible d'une histoire — applique des règles de vocabulaire et de thèmes (Phase livre/chapitres) */
export type StoryAgeRange = '3-5' | '6-8' | '9+';

export interface BedtimeStory {
  id: string;
  titre: string;
  enfant: string;
  enfantId: string;
  univers: StoryUniverseId;
  detail?: string;
  texte: string;
  date: string;
  duree_lecture: number;
  voice: StoryVoiceConfig;
  length?: StoryLength; // taille choisie à la génération (pour info/réutilisation)
  /** @deprecated remplacé par audioMode — conservé pour compatibilité ascendante */
  spectacle?: boolean;
  audioMode?: StoryAudioMode;   // off = voix seule, doux = + ambiance, spectacle = + SFX
  ambienceVolume?: number;      // 0..1 — défaut 0.4
  script?: StoryScript; // V2 — screenplay structuré avec SFX (chargé depuis sidecar .script.json)
  alignment?: StoryAudioAlignment; // V2.3 — alignement caractère→timestamp (sidecar .alignment.json)
  version: number;
  sourceFile: string;
  // ─── Livre/chapitres (rétrocompat 100% — tous optionnels) ───────────────
  /** Slug stable du livre auquel appartient ce chapitre (absent = histoire isolée legacy) */
  livreId?: string;
  /** Titre du livre (peut différer du titre du chapitre) */
  livreTitre?: string;
  /** Numéro du chapitre dans le livre, base 1 */
  chapitre?: number;
  /** Titre spécifique du chapitre (souvent identique à `titre`) */
  chapitreTitre?: string;
  /** Slugs des personnages (casting du livre) introduits dans ce chapitre */
  personnages?: string[];
  /** Résumé neutre 4-5 phrases pour transmettre la continuité au chapitre suivant */
  memorySummary?: string;
  /** Tranche d'âge appliquée à ce chapitre — verrouillée par le livre */
  trancheAge?: StoryAgeRange;
}

/**
 * V2.3 — Alignement caractère→timestamp retourné par ElevenLabs `/with-timestamps`.
 * Stocké dans un sidecar `<storyId>.alignment.json` à côté du `.md`.
 *
 * - `chars[i]` : caractère i du texte tel qu'envoyé à l'API
 * - `starts[i]` : timestamp début de prononciation en secondes
 * - `ends[i]`   : timestamp fin de prononciation en secondes
 * Les trois tableaux ont la même longueur.
 */
export interface StoryAudioAlignment {
  chars: string[];
  starts: number[];
  ends: number[];
}

// ─── V2 : Script structuré (Mode Spectacle enrichi) ───────────────────────────
// Stocké dans un fichier sidecar `<storyId>.script.json` à côté du .md.
// Quand présent, le StoryPlayer joue les SFX bundlés aux moments clés du récit.

/**
 * Tags SFX disponibles. Chaque tag correspond à un MP3 court bundlé dans
 * `assets/stories/sfx/<tag>.mp3` (généré one-shot via ElevenLabs).
 * Claude ne peut citer que ces tags dans le script — bibliothèque fermée.
 */
export type StorySfxTag =
  // Portes / portails
  | 'door_creak_slow' | 'door_slam' | 'door_open_squeak'
  // Pas
  | 'footsteps_wood' | 'footsteps_grass' | 'footsteps_snow' | 'footsteps_stone'
  // Grands animaux
  | 'roar_dragon' | 'roar_lion' | 'roar_bear' | 'growl_wolf'
  // Petits animaux
  | 'meow_cat' | 'bark_dog' | 'hoot_owl' | 'chirp_bird' | 'squeak_mouse' | 'whimper_puppy'
  // Vent / météo
  | 'wind_soft' | 'wind_storm' | 'rain_light' | 'thunder_distant'
  // Eau / feu
  | 'fire_crackle' | 'water_splash' | 'water_drip' | 'water_stream'
  // Magie
  | 'sparkle_short' | 'magic_whoosh' | 'transform_shimmer' | 'spell_zap' | 'magic_chime'
  // Mécanique
  | 'clock_tick' | 'gear_creak' | 'robot_beep' | 'machine_hum'
  // Cloches / musique
  | 'bell_small' | 'bell_large' | 'harp_glissando' | 'music_box'
  // Véhicules
  | 'ship_creak' | 'horse_gallop' | 'train_whistle'
  // Réactions humaines
  | 'laugh_child' | 'gasp_surprise' | 'sneeze_cute' | 'yawn_sleepy'
  // Trésors
  | 'coin_drop' | 'treasure_chest_open' | 'jingle_keys'
  // Mystère
  | 'mysterious_whoosh' | 'ghost_woo' | 'creak_floorboard'
  // Petites actions
  | 'book_page_turn' | 'pop_bubble' | 'splash_small' | 'tap_knock'
  // Foule
  | 'crowd_cheer' | 'crowd_gasp';

/** Speaker reconnu par le player (V2.0 = narrateur seul, multi-voix V2.4) */
export type StoryBeatSpeaker = 'narrator' | 'character';

/** Émotion narrative (utilisée plus tard par v3 multi-voix, ignorée pour l'instant) */
export type StoryBeatEmotion = 'calm' | 'excited' | 'scared' | 'tender' | 'playful' | 'mysterious';

/** Un beat = un atome de la mise en scène (texte, SFX, ou pause) */
export type StoryBeat =
  | { kind: 'narration'; text: string; emotion?: StoryBeatEmotion }
  | { kind: 'dialogue'; speaker: string; text: string; emotion?: StoryBeatEmotion }
  | {
      kind: 'sfx';
      tag: StorySfxTag;
      /** V2.3 — mot/phrase exact dans la narration précédente qui déclenche
       * le SFX. Le player cherche ce mot dans l'alignment et fait jouer le
       * SFX au début de sa pronunciation (overlap word-level). Si absent,
       * fallback : SFX joué à la fin du beat narration précédent. */
      triggerWord?: string;
    }
  | { kind: 'pause'; durationSec: number };

/** Script structuré complet d'une histoire */
export interface StoryScript {
  version: 2;
  beats: StoryBeat[];
}

export interface StoryUniverse {
  id: StoryUniverseId;
  titre: string;
  description: string;
  emoji: string;
  couleurAccent: string;
  couleurGlow: string;
}
