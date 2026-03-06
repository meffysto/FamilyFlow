// ─────────────────────────────────────────────
// Family Vault — TypeScript types
// All data lives in plain Markdown files (.md)
// ─────────────────────────────────────────────

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;       // YYYY-MM-DD from 📅
  recurrence?: string;    // "every day|week|month" from 🔁
  completedDate?: string; // YYYY-MM-DD from ✅
  tags: string[];         // #tag extracted from text
  mentions: string[];     // @user extracted from text
  sourceFile: string;     // relative path in vault
  lineIndex: number;      // line index in file (0-based, for writes)
  section?: string;       // H2/H3 section header above this task
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

export interface Profile {
  id: string;               // snake_case key used in files
  name: string;
  role: 'enfant' | 'ado' | 'adulte';
  avatar: string;           // single emoji
  birthdate?: string;       // YYYY-MM-DD
  points: number;
  level: number;
  streak: number;
  lootBoxesAvailable: number;
  multiplier: number;       // point multiplier (default 1)
  multiplierRemaining: number; // tasks remaining with multiplier
  pityCounter: number;       // boxes opened without épique+ (pity system)
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
}

export interface RewardDefinition {
  emoji: string;
  reward: string;
  bonusPoints: number;
  requiresParent?: boolean;
  multiplier?: number;
  multiplierTasks?: number;  // how many tasks for multiplier rewards
  rewardType: RewardType;
}

export interface GamificationEntry {
  profileId: string;
  action: string;           // e.g. "+10" or "loot:commun"
  points: number;
  note: string;             // e.g. "Tâche: Ménage cuisine" or "🐻 Badge Ourson"
  timestamp: string;        // ISO string
}

export interface GamificationData {
  profiles: Profile[];
  history: GamificationEntry[];
  activeRewards: ActiveReward[];
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
}

export interface MealItem {
  id: string;           // "lundi:déjeuner"
  day: string;          // "Lundi"
  mealType: string;     // "Petit-déj" | "Déjeuner" | "Dîner"
  text: string;         // "Pâtes carbonara" (empty string if not planned)
  lineIndex: number;    // 0-based line in file
  sourceFile: string;
}

export interface PhotoEntry {
  date: string;       // "2026-03-06"
  enfantId: string;   // "maxence"
  enfantName: string; // "Maxence"
  uri: string;        // file:///vault/07 - Photos/Maxence/2026-03-06.jpg
}

export interface StockItem {
  produit: string;
  detail?: string;
  quantite: number;
  seuil: number;
  qteAchat?: number;
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
  | 'double_loot';

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

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotifEvent =
  | 'task_completed'
  | 'loot_box_opened'
  | 'all_tasks_done'
  | 'leaderboard'
  | 'daily_summary'
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
