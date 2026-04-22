/**
 * useVault.ts — Vault state management hook
 *
 * Reads all vault data and refreshes on:
 * - App coming to foreground (AppState 'active')
 * - Manual call to refresh()
 *
 * Data sources (relative paths from vault root):
 * - 01 - Enfants/Maxence/Tâches récurrentes.md
 * - 01 - Enfants/Enfant 2/Tâches récurrentes.md
 * - 02 - Maison/Tâches récurrentes.md
 * - 02 - Maison/Liste de courses.md
 * - 04 - Rendez-vous/*.md
 * - famille.md
 * - gamification.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVaultAnniversaires } from './useVaultAnniversaires';
import { useVaultGratitude } from './useVaultGratitude';
import { useVaultQuotes } from './useVaultQuotes';
import { useVaultMoods } from './useVaultMoods';
import { useVaultRoutines } from './useVaultRoutines';
import { useVaultRDV } from './useVaultRDV';
import { useVaultMeals, mealsFileForWeek } from './useVaultMeals';
import { useVaultPhotos } from './useVaultPhotos';
import { useVaultMemories } from './useVaultMemories';
import { useVaultStories } from './useVaultStories';
import { useVaultVacation, VACATION_STORE_KEY, VACATION_FILE } from './useVaultVacation';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { VaultManager } from '../lib/vault';
import { restoreAccess, consumePendingTaskToggles } from '../modules/vault-access/src';
import {
  parseTaskFile,
  parseRoutines,
  parseHealthRecord,
  parseCourses,
  parseMeals,
  parseRDV,
  parseStock,
  parseStockSections,
  parseJalons,
  mergeProfiles,
  parseGamification,
  parseFamille,
  serializeGamification,
  parseDefis,
  serializeDefis,
  GRATITUDE_FILE,
  parseGratitude,
  WISHLIST_FILE,
  parseWishlist,
  ANNIVERSAIRES_FILE,
  parseAnniversaries,
  serializeAnniversaries,
  SKILLS_DIR,
  parseSkillTree,
  serializeSkillTree,
  QUOTES_FILE,
  parseQuotes,
  MOODS_FILE,
  parseMoods,
  SECRET_MISSIONS_FILE,
  parseSecretMissions,
  serializeCompanion,
  parseFarmProfile,
  serializeFarmProfile,
} from '../lib/parser';
import type { FarmProfileData } from '../lib/types';
import type { CompanionData, CompanionSpecies, HarvestGrade as CompanionHarvestGrade } from '../lib/mascot/companion-types';
import { feedCompanion as feedCompanionEngine, buildFeedMessage, type FeedResult } from '../lib/mascot/companion-engine';
import { loadCompanionMessages, saveCompanionMessages } from '../lib/mascot/companion-storage';
import { CROP_CATALOG } from '../lib/mascot/types';
import type { HarvestGrade as FarmHarvestGrade } from '../lib/mascot/grade-engine';
import { processActiveRewards, addPoints, calculateLevel } from '../lib/gamification';
import { XP_PER_BRACKET, getSkillById } from '../lib/gamification/skill-tree';
import { Task, RDV, CourseItem, MealItem, StockItem, Profile, Gender, GamificationData, NotificationPreferences, ProfileTheme, Memory, VacationConfig, Recipe, AgeUpgrade, AgeCategory, BudgetEntry, BudgetConfig, Routine, HealthRecord, GrowthEntry, VaccineEntry, Defi, GratitudeDay, WishlistItem, WishBudget, WishOccasion, Anniversary, Note, SkillTreeData, ChildQuote, MoodEntry, MoodLevel, UsedLoot, BedtimeStory, LoveNote, LoveNoteStatus } from '../lib/types';
import { useVaultBudget } from './useVaultBudget';
import {
  parseNotificationPrefs,
  serializeNotificationPrefs,
  getDefaultNotificationPrefs,
} from '../lib/notifications';
import * as Notifications from 'expo-notifications';
import { setupAllNotifications, loadNotifConfig, scheduleLoveNoteReveal } from '../lib/scheduled-notifications';
import i18n from '../lib/i18n';
import { format, startOfWeek } from 'date-fns';
import { enqueueWrite } from '../lib/famille-queue';
import { parseJournalStats } from '../lib/journal-stats';
import type { JournalSummaryEntry } from '../lib/ai-service';
import { refreshWidget, refreshJournalWidget } from '../lib/widget-bridge';
import { patchMascotte, loadCompanionSpriteBase64 } from '../lib/mascotte-live-activity';
import { getCompanionStage } from '../lib/mascot/companion-engine';
import { pickLABubbleShort, type LAStage } from '../lib/mascot/la-bubbles';
import { syncWidgetFeedingsToVault } from '../lib/widget-sync';
import { useVaultNotes } from './useVaultNotes';
import { useVaultLoveNotes } from './useVaultLoveNotes';
import { useVaultWishlist } from './useVaultWishlist';
import { useVaultStock } from './useVaultStock';
import { useVaultCourses } from './useVaultCourses';
import { useVaultHealth } from './useVaultHealth';
import { useVaultSecretMissions } from './useVaultSecretMissions';
import { useVaultTasks, type TaskCompleteListener } from './useVaultTasks';
import { useVaultRecipes } from './useVaultRecipes';
import { useVaultDefis } from './useVaultDefis';
import { useVaultFamilyQuests } from './useVaultFamilyQuests';
import { parseFamilyQuests, FAMILY_QUESTS_FILE } from '../lib/parser';
import type { FamilyQuest } from '../lib/quest-engine';
import { useVaultProfiles, ACTIVE_PROFILE_KEY } from './useVaultProfiles';
import { useVaultDietary } from './useVaultDietary';
import type { VaultDietaryState } from './useVaultDietary';
import { VILLAGE_FILE } from '../lib/village';
import {
  hydrateFromCache,
  hydrateProfileFromCache,
  saveCache,
  stripProfileForCache,
} from '../lib/vault-cache';

export const VAULT_PATH_KEY = 'vault_path';
export { ACTIVE_PROFILE_KEY } from './useVaultProfiles';

/** Distinguer "fichier inexistant" (attendu) des vraies erreurs */
function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVault] ${context}:`, e);
}

/** Compute age category from birthdate (YYYY or YYYY-MM-DD) */
function getAgeCategoryFromBirthdate(birthdate: string): AgeCategory {
  const year = parseInt(birthdate.slice(0, 4), 10);
  if (isNaN(year)) return 'bebe';
  const age = new Date().getFullYear() - year;
  if (age <= 2) return 'bebe';
  if (age <= 5) return 'petit';
  if (age <= 11) return 'enfant';
  return 'ado';
}

export interface VaultState {
  vaultPath: string | null;
  isLoading: boolean;
  error: string | null;
  tasks: Task[];          // all tasks from all tâches récurrentes files
  courses: CourseItem[];  // shopping list
  stock: StockItem[];     // baby stock levels
  meals: MealItem[];      // weekly meal plan
  rdvs: RDV[];            // upcoming appointments
  profiles: Profile[];    // family profiles with gamification data
  activeProfile: Profile | null;  // currently selected profile
  gamiData: GamificationData | null;
  notifPrefs: NotificationPreferences;
  vault: VaultManager | null;
  refresh: () => Promise<void>;
  setVaultPath: (path: string) => Promise<void>;
  setActiveProfile: (profileId: string) => Promise<void>;
  saveNotifPrefs: (prefs: NotificationPreferences) => Promise<void>;
  updateMeal: (day: string, mealType: string, text: string, recipeRef?: string, weekDate?: Date) => Promise<void>;
  loadMealsForWeek: (date: Date) => Promise<MealItem[]>;
  photoDates: Record<string, string[]>;  // enfantId → dates with photos
  addPhoto: (enfantName: string, date: string, imageUri: string) => Promise<void>;
  getPhotoUri: (enfantName: string, date: string) => string | null;
  updateProfileTheme: (profileId: string, theme: ProfileTheme) => Promise<void>;
  renameGarden: (profileId: string, name: string) => Promise<void>;
  updateTreeSpecies: (profileId: string, species: string) => Promise<void>;
  buyMascotItem: (profileId: string, itemId: string, itemType: 'decoration' | 'inhabitant') => Promise<void>;
  buySporee: (profileId: string) => Promise<void>;
  placeMascotItem: (profileId: string, slotId: string, itemId: string) => Promise<void>;
  unplaceMascotItem: (profileId: string, slotId: string) => Promise<void>;
  updateProfile: (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender; voiceElevenLabsId?: string; voiceFishAudioId?: string; voicePersonalId?: string; voiceSource?: 'ios-personal' | 'elevenlabs-cloned' | 'elevenlabs-preset' | 'fish-audio-cloned' | 'expo-speech' }) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  updateStockQuantity: (lineIndex: number, newQuantity: number) => Promise<void>;
  addStockItem: (item: Omit<StockItem, 'lineIndex'>) => Promise<void>;
  deleteStockItem: (lineIndex: number) => Promise<void>;
  updateStockItem: (lineIndex: number, updates: Partial<StockItem>) => Promise<void>;
  stockSections: string[];
  toggleTask: (task: Task, completed: boolean) => Promise<void>;
  skipTask: (task: Task) => Promise<void>;
  /** Phase 40 — Souscrit un listener appelé sur transition false→true d'une tâche.
   *  Pattern event-driven consommé par useFarm.incrementWagerCumul (câblage Sporée).
   *  Retourne une fonction unsubscribe à appeler au cleanup. */
  subscribeTaskComplete: (listener: TaskCompleteListener) => () => void;
  /** Handler complet (toggle + gamification + reward) pour tâches cochées depuis
   *  la Live Activity. Setté par un bridge component qui a accès à
   *  `useGamification`. Si null → fallback sur toggleTask seul (pas de XP). */
  liveActivityTaskCompleteRef: React.MutableRefObject<((task: Task) => Promise<void>) | null>;
  /** Compteur de tâches complétées aujourd'hui (event-driven — inclut les récurrentes) */
  tasksCompletedToday: number;
  addRDV: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  updateRDV: (sourceFile: string, rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  deleteRDV: (sourceFile: string) => Promise<void>;
  addTask: (text: string, targetFile: string, dueDate?: string, recurrence?: string, reminderTime?: string) => Promise<void>;
  editTask: (task: Task, updates: { text?: string; dueDate?: string; recurrence?: string; reminderTime?: string; targetFile?: string }) => Promise<void>;
  deleteTask: (sourceFile: string, lineIndex: number) => Promise<void>;
  addCourseItem: (text: string, section?: string) => Promise<void>;
  mergeCourseIngredients: (items: { text: string; name: string; quantity: number | null; section: string }[]) => Promise<{ added: number; merged: number }>;
  toggleCourseItem: (item: CourseItem, completed: boolean) => Promise<void>;
  removeCourseItem: (lineIndex: number) => Promise<void>;
  moveCourseItem: (lineIndex: number, text: string, newSection: string) => Promise<void>;
  clearCompletedCourses: () => Promise<void>;
  memories: Memory[];
  addMemory: (enfant: string, memory: Omit<Memory, 'enfant' | 'enfantId'>) => Promise<void>;
  updateMemory: (oldMemory: Memory, newMemory: Omit<Memory, 'enfant' | 'enfantId'>) => Promise<void>;
  vacationConfig: VacationConfig | null;
  vacationTasks: Task[];
  isVacationActive: boolean;
  activateVacation: (startDate: string, endDate: string) => Promise<void>;
  deactivateVacation: () => Promise<void>;
  refreshGamification: () => Promise<void>;
  refreshFarm: (profileId: string) => Promise<void>;
  recipes: Recipe[];
  loadRecipes: (force?: boolean) => Promise<void>;
  addRecipe: (category: string, data: { title: string; tags?: string[]; servings?: number; prepTime?: string; cookTime?: string; ingredients: { name: string; quantity?: string; unit?: string }[]; steps: string[] }) => Promise<void>;
  deleteRecipe: (sourceFile: string) => Promise<void>;
  renameRecipe: (sourceFile: string, newTitle: string) => Promise<void>;
  saveRecipeImage: (sourceFile: string, imageUri: string) => Promise<void>;
  getRecipeImageUri: (sourceFile: string) => string | null;
  /** Scan tout le vault pour des .cook en dehors de 03 - Cuisine/Recettes/ */
  scanAllCookFiles: () => Promise<{ path: string; title: string }[]>;
  /** Déplacer un .cook vers le dossier Recettes */
  moveCookToRecipes: (sourcePath: string, category: string) => Promise<void>;
  /** Déplacer une recette vers une autre catégorie */
  moveRecipeCategory: (sourceFile: string, newCategory: string) => Promise<void>;
  // Recipe favorites per profile
  toggleFavorite: (profileId: string, recipePath: string) => Promise<void>;
  isFavorite: (profileId: string, recipePath: string) => boolean;
  getFavorites: (profileId: string) => string[];
  ageUpgrades: AgeUpgrade[];
  applyAgeUpgrade: (upgrade: AgeUpgrade) => Promise<void>;
  dismissAgeUpgrade: (profileId: string) => void;
  addChild: (child: { name: string; avatar: string; birthdate: string; propre?: boolean; gender?: Gender; statut?: 'grossesse'; dateTerme?: string }) => Promise<void>;
  convertToBorn: (profileId: string, birthdate: string) => Promise<void>;
  budgetEntries: BudgetEntry[];
  budgetConfig: BudgetConfig;
  budgetMonth: string;
  setBudgetMonth: (month: string) => void;
  addExpense: (date: string, category: string, amount: number, label: string) => Promise<void>;
  deleteExpense: (lineIndex: number) => Promise<void>;
  updateBudgetConfig: (config: BudgetConfig) => Promise<void>;
  loadBudgetData: (month?: string) => Promise<void>;
  loadBudgetMonths: (count: number) => Promise<BudgetEntry[]>;
  routines: Routine[];
  saveRoutines: (routines: Routine[]) => Promise<void>;
  healthRecords: HealthRecord[];
  saveHealthRecord: (record: HealthRecord) => Promise<void>;
  addGrowthEntry: (enfant: string, entry: GrowthEntry) => Promise<void>;
  updateGrowthEntry: (enfant: string, oldDate: string, newEntry: GrowthEntry) => Promise<void>;
  deleteGrowthEntry: (enfant: string, date: string) => Promise<void>;
  addVaccineEntry: (enfant: string, entry: VaccineEntry) => Promise<void>;
  defis: Defi[];
  createDefi: (defi: Omit<Defi, 'progress' | 'status'>) => Promise<void>;
  checkInDefi: (defiId: string, profileId: string, completed: boolean, value?: number, note?: string) => Promise<void>;
  completeDefi: (defiId: string) => Promise<void>;
  deleteDefi: (defiId: string) => Promise<void>;
  familyQuests: FamilyQuest[];
  unlockedRecipes: string[];
  startFamilyQuest: (templateId: string, profileId: string, profiles: Profile[]) => Promise<void>;
  contributeFamilyQuest: (profileId: string, type: string, amount: number) => Promise<void>;
  completeFamilyQuest: (questId: string, activeProfileId?: string) => Promise<void>;
  deleteFamilyQuest: (questId: string) => Promise<void>;
  gratitudeDays: GratitudeDay[];
  addGratitudeEntry: (date: string, profileId: string, profileName: string, text: string) => Promise<void>;
  deleteGratitudeEntry: (date: string, profileId: string) => Promise<void>;
  wishlistItems: WishlistItem[];
  addWishItem: (text: string, profileName: string, budget?: WishBudget, occasion?: WishOccasion, notes?: string, url?: string) => Promise<void>;
  updateWishItem: (item: WishlistItem, updates: Partial<WishlistItem>) => Promise<void>;
  deleteWishItem: (item: WishlistItem) => Promise<void>;
  toggleWishBought: (item: WishlistItem, boughtBy: string) => Promise<void>;
  /** Stats journal bébé des 7 derniers jours (pour contexte IA) */
  journalStats: JournalSummaryEntry[];
  anniversaries: Anniversary[];
  addAnniversary: (anniversary: Omit<Anniversary, 'sourceFile'>) => Promise<void>;
  updateAnniversary: (oldName: string, anniversary: Omit<Anniversary, 'sourceFile'>) => Promise<void>;
  removeAnniversary: (name: string) => Promise<void>;
  importAnniversaries: (anniversaries: Omit<Anniversary, 'sourceFile'>[]) => Promise<void>;
  notes: Note[];
  addNote: (note: Omit<Note, 'sourceFile'>) => Promise<void>;
  updateNote: (sourceFile: string, note: Omit<Note, 'sourceFile'>) => Promise<void>;
  deleteNote: (sourceFile: string) => Promise<void>;
  quotes: ChildQuote[];
  addQuote: (enfant: string, citation: string, contexte?: string) => Promise<void>;
  editQuote: (lineIndex: number, citation: string, contexte?: string) => Promise<void>;
  deleteQuote: (lineIndex: number) => Promise<void>;
  moods: MoodEntry[];
  addMood: (profileId: string, profileName: string, level: MoodLevel, note?: string) => Promise<void>;
  deleteMood: (lineIndex: number) => Promise<void>;
  skillTrees: SkillTreeData[];
  unlockSkill: (childProfileId: string, skillId: string) => Promise<void>;
  secretMissions: Task[];
  addSecretMission: (text: string, targetProfileId: string) => Promise<void>;
  completeSecretMission: (missionId: string) => Promise<void>;
  validateSecretMission: (missionId: string) => Promise<void>;
  completeAdventure: (profileId: string, points: number, adventureNote: string) => Promise<void>;
  completeSagaChapter: (profileId: string, points: number, sagaNote: string, rewardItem?: { id: string; type: 'decoration' | 'inhabitant' }, bonusCropId?: string) => Promise<void>;
  markLootUsed: (loot: UsedLoot) => Promise<void>;
  awardProfileXP: (profileId: string, xp: number, note: string) => Promise<void>;
  setCompanion: (profileId: string, companion: CompanionData) => Promise<void>;
  unlockCompanion: (profileId: string, speciesId: CompanionSpecies) => Promise<void>;
  feedCompanion: (profileId: string, cropId: string, grade: CompanionHarvestGrade) => Promise<FeedResult | null>;
  /** Préférences alimentaires famille + invités (Phase 15 — PREF-02/06/07) */
  dietary: VaultDietaryState;
  gardenRaw: string;
  setGardenRaw: React.Dispatch<React.SetStateAction<string>>;
  loveNotes: LoveNote[];
  addLoveNote: (note: Omit<LoveNote, 'sourceFile'>) => Promise<string>;
  updateLoveNoteStatus: (sourceFile: string, status: LoveNoteStatus, readAt?: string) => Promise<void>;
  deleteLoveNote: (sourceFile: string) => Promise<void>;
  stories: BedtimeStory[];
  saveStory: (story: BedtimeStory) => Promise<void>;
  deleteStory: (sourceFile: string) => Promise<void>;
}

// Static task files (non-enfant)
const STATIC_TASK_FILES = [
  '02 - Maison/Tâches récurrentes.md',
];

const COURSES_FILE = '02 - Maison/Liste de courses.md';
const RDV_DIR = '04 - Rendez-vous';
const RDV_ARCHIVES_DIR = 'Archives/Rendez-vous';
const FAMILLE_FILE = 'famille.md';
/** Retourne le chemin du fichier gamification per-profil */
function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}
/** Retourne le chemin du fichier ferme per-profil */
function farmFile(profileId: string): string {
  return `farm-${profileId}.md`;
}
/**
 * Identifie un event d'économie ferme (vente, bonus craft, récolte). Utilisé
 * pour filtrer le compteur "XP effort quotidien" de la Live Activity mascotte :
 * on veut refléter l'effort fait aujourd'hui (tâches, saga, défis) — pas les
 * gains d'un stock vendu qui peuvent exploser le compteur.
 */
export function isFarmEconomyEvent(note: string): boolean {
  if (!note) return false;
  return note.includes('Vente craft') || note.includes('Bonus craft') || note.includes('Vente ');
}

/**
 * Construit le texte du prochain RDV dans les prochaines 24h pour la Live Activity.
 * Retourne null si aucun RDV planifié sur cette fenêtre. Format : "Pédiatre 14:30"
 * (aujourd'hui) ou "Dentiste demain 9:00" (lendemain). Tronqué à 40 chars.
 */
export function computeNextRdvText(rdvs: RDV[]): string | null {
  if (!rdvs || rdvs.length === 0) return null;
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);
  const upcoming = rdvs
    .filter(r => r.statut === 'planifié')
    .map(r => {
      const [hh, mm] = (r.heure || '00:00').split(':').map(Number);
      const d = new Date(`${r.date_rdv}T00:00:00`);
      d.setHours(hh || 0, mm || 0, 0, 0);
      return { r, when: d };
    })
    .filter(({ when }) => when > now && when <= in24h)
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  const next = upcoming[0];
  if (!next) return null;
  const label = next.r.type_rdv
    ? next.r.type_rdv.charAt(0).toUpperCase() + next.r.type_rdv.slice(1)
    : 'RDV';
  const prefix = next.r.date_rdv === today ? '' : 'demain ';
  const text = `${label} ${prefix}${next.r.heure}`;
  return text.length > 40 ? text.slice(0, 39) + '…' : text;
}

/**
 * Migration one-shot + récupération : si gamification.md existe et qu'un profil n'a pas
 * encore son gami-{id}.md (ou l'a eu corrompu — fichier vide/farm-format sans profils), le créer/réparer.
 */
async function migrateGamification(vault: VaultManager, profiles: { id: string }[]): Promise<void> {
  const legacyExists = await vault.exists('gamification.md');
  if (!legacyExists) return;

  // Lire le contenu de chaque fichier per-profil (absent = '', corrompu = sans profils)
  const checks = await Promise.all(
    profiles.map(async p => {
      const content = await vault.readFile(gamiFile(p.id)).catch(() => '');
      const parsed = parseGamification(content);
      const hasProfile = parsed.profiles.some(g => g.id === p.id);
      return { id: p.id, content, hasProfile };
    })
  );

  const needsRepair = checks.some(c => !c.hasProfile);
  if (!needsRepair) return;

  const legacyContent = await vault.readFile('gamification.md');
  const legacyData = parseGamification(legacyContent);

  for (const check of checks) {
    if (check.hasProfile) continue;
    const prof = legacyData.profiles.find(p => p.id === check.id);
    if (!prof) continue;
    // Si le fichier existait déjà mais était corrompu, on préserve son historique
    const existingGami = check.content ? parseGamification(check.content) : null;
    const singleData = {
      profiles: [prof],
      history: [
        ...(existingGami?.history ?? []),
        ...legacyData.history.filter(e => e.profileId === check.id),
      ],
      activeRewards: (legacyData.activeRewards ?? []).filter(r => r.profileId === check.id),
      usedLoots: (legacyData.usedLoots ?? []).filter(u => u.profileId === check.id),
    };
    await vault.writeFile(gamiFile(check.id), serializeGamification(singleData));
  }
  // NE PAS supprimer gamification.md — le garder comme backup
}

/**
 * Migration one-shot : si farm-{id}.md n'existe pas mais famille.md contient
 * des champs farm/mascot/companion, les migrer vers farm-{id}.md.
 * Backward-compatible — ne modifie pas famille.md.
 */
async function migrateFarmData(vault: VaultManager, baseProfiles: Array<{ id: string; name: string }>): Promise<void> {
  const FARM_KEYS = new Set([
    'tree_species', 'mascot_decorations', 'mascot_inhabitants', 'mascot_placements',
    'farm_crops', 'farm_buildings', 'farm_inventory', 'farm_harvest_inventory',
    'farm_crafted_items', 'farm_tech', 'farm_rare_seeds', 'wear_events', 'companion',
  ]);

  let familleContent = '';
  try {
    familleContent = await vault.readFile(FAMILLE_FILE);
  } catch {
    return;
  }

  for (const profile of baseProfiles) {
    const fp = farmFile(profile.id);
    const exists = await vault.readFile(fp).then(() => true).catch(() => false);
    if (exists) continue; // déjà migré

    // Extraire les champs farm/mascot de la section ### {profile.id} dans famille.md
    const lines = familleContent.split('\n');
    const farmFields: Record<string, string> = {};
    let inSection = false;
    for (const line of lines) {
      if (line.startsWith('### ')) {
        if (inSection) break;
        if (line.replace('### ', '').trim() === profile.id) inSection = true;
      } else if (inSection && line.includes(': ')) {
        const colonIdx = line.indexOf(': ');
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 2).trim();
        if (FARM_KEYS.has(key) && val) farmFields[key] = val;
      }
    }

    // Construire le FarmProfileData à partir des champs extraits
    const rawContent = Object.entries(farmFields)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    const farmData = parseFarmProfile(rawContent);
    await vault.writeFile(fp, serializeFarmProfile(profile.name, farmData));
  }
}

/** Ancien fichier (migration) */
const MEALS_LEGACY_FILE = '02 - Maison/Repas de la semaine.md';
const MEALS_TEMPLATE = `# Repas de la semaine

## Lundi
- Petit-déj:
- Déjeuner:
- Dîner:

## Mardi
- Petit-déj:
- Déjeuner:
- Dîner:

## Mercredi
- Petit-déj:
- Déjeuner:
- Dîner:

## Jeudi
- Petit-déj:
- Déjeuner:
- Dîner:

## Vendredi
- Petit-déj:
- Déjeuner:
- Dîner:

## Samedi
- Petit-déj:
- Déjeuner:
- Dîner:

## Dimanche
- Petit-déj:
- Déjeuner:
- Dîner:
`;
const STOCK_FILE = '01 - Enfants/Commun/Stock & fournitures.md';
const MEMOIRES_DIR = '06 - Mémoires';
const NOTIF_FILE = 'notifications.md';
const RECIPES_DIR = '03 - Cuisine/Recettes';
const ROUTINES_FILE = '02 - Maison/Routines.md';
const DEFIS_FILE = 'defis.md';
const HEALTH_DIR = '01 - Enfants';

export function useVaultInternal(): VaultState {
  const [vaultPath, setVaultPathState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vaultRef = useRef<VaultManager | null>(null);
  const busyRef = useRef(false); // Guard against AppState race condition

  // ─── Sous-hooks par domaine ───────────────────────────────────────────────

  const notesHook = useVaultNotes(vaultRef);

  // Domaine Stock délégué à useVaultStock
  const stockHook = useVaultStock(vaultRef);
  const { stock, stockSections, resetStock } = stockHook;

  // Domaine Courses délégué à useVaultCourses
  const coursesHook = useVaultCourses(vaultRef);
  const { courses, resetCourses } = coursesHook;

  // Domaine Budget délégué à useVaultBudget
  const budget = useVaultBudget(vaultRef);
  const { resetBudget, ...budgetState } = budget;

  // triggerWidgetRefresh dépend de mealsRef/rdvsRef/tasksRef — déclaré avant les hooks
  const mealsRef = useRef<MealItem[]>([]);
  const rdvsRef = useRef<RDV[]>([]);
  const tasksRefForWidget = useRef<Task[]>([]);
  // Snapshot du total de tâches max observé aujourd'hui.
  // Évite de dépendre d'un compteur événementiel (subscription fragile).
  // Les récurrentes cochées bumpent dueDate au lendemain et sortent du filtre,
  // réduisant todayTasks.length — le max préserve le vrai total du jour.
  const tasksTotalSnapshotRef = useRef<{ date: string; total: number }>({ date: '', total: 0 });
  // Mis à jour via useEffect après déclaration de gamiData / activeProfileId
  const gamiDataForWidgetRef = useRef<GamificationData | null>(null);
  const activeProfileIdForWidgetRef = useRef<string | null>(null);
  const widgetRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerWidgetRefresh = useCallback(() => {
    if (widgetRefreshTimer.current) clearTimeout(widgetRefreshTimer.current);
    widgetRefreshTimer.current = setTimeout(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      // Tâches dues aujourd'hui (récurrentes ou non). Les récurrentes cochées sortent
      // car dueDate est bumpé au lendemain — compensé par le counter événementiel.
      const todayTasks = tasksRefForWidget.current.filter(t => {
        if (t.recurrence) return t.dueDate && t.dueDate <= todayStr;
        return t.dueDate === todayStr;
      });
      // Snapshot total : retient le max observé ce jour pour absorber les récurrentes
      // cochées (dueDate bumpé → elles sortent du filtre, todayTasks.length décroît).
      // Approche plus robuste que le compteur événementiel (pas de subscription fragile).
      if (tasksTotalSnapshotRef.current.date !== todayStr) {
        tasksTotalSnapshotRef.current = { date: todayStr, total: todayTasks.length };
      } else {
        tasksTotalSnapshotRef.current.total = Math.max(tasksTotalSnapshotRef.current.total, todayTasks.length);
      }
      const totalCount = tasksTotalSnapshotRef.current.total;
      const pendingCount = todayTasks.filter(t => !t.completed).length;
      // doneCount = total - pending (fonctionne pour récurrentes ET ponctuelles)
      const doneCount = Math.max(0, totalCount - pendingCount);
      // Widget JSON — même formule que la LA
      refreshWidget(mealsRef.current, rdvsRef.current, tasksRefForWidget.current, { done: doneCount, total: totalCount });
      const nowHour = new Date().getHours();
      const dayName = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][new Date().getDay()];
      const todayMeals = mealsRef.current.filter(m => m.day === dayName);
      const mealText = nowHour < 14
        ? (todayMeals.find(m => m.mealType === 'Déjeuner')?.text || null)
        : (todayMeals.find(m => m.mealType === 'Dîner')?.text || null);
      // Prochain RDV < 24h (affiché pendant le stage midi). Format : "Pédiatre 14:30"
      // ou "Dentiste demain 9:00". Tronqué à 40 chars pour le budget ContentState.
      const nextRdvText = computeNextRdvText(rdvsRef.current);
      // Bulle compagnon : template court synchrone (l'IA est utilisée uniquement au start
      // via DashboardCompanionDay pour ne pas brûler le budget sur chaque refresh).
      const laStage: LAStage = nowHour < 9 ? 'reveil'
        : nowHour < 12 ? 'travail'
        : nowHour < 14 ? 'midi'
        : nowHour < 18 ? 'jeu'
        : nowHour < 20 ? 'routine'
        : nowHour < 22 ? 'dodo'
        : 'recap';
      const speechBubble = pickLABubbleShort(laStage);
      // XP "effort quotidien" du profil actif (tâches, saga, défis, quêtes…)
      // Exclut les gains d'économie ferme (ventes, bonus craft) qui gonflent artificiellement
      // le compteur et ne reflètent pas l'effort fait par l'utilisateur aujourd'hui.
      const activeId = activeProfileIdForWidgetRef.current;
      const xpGainedToday = (gamiDataForWidgetRef.current?.history ?? [])
        .filter(e =>
          e.profileId === activeId &&
          e.timestamp?.slice(0, 10) === todayStr &&
          !isFarmEconomyEvent(e.note)
        )
        .reduce((sum, e) => sum + (e.points || 0), 0);
      // Level-up détecté aujourd'hui (comparaison avec le niveau au début de journée)
      const activeProfileForBonus = profilesRef.current.find(p => p.id === activeId);
      const currentPoints = activeProfileForBonus?.points ?? 0;
      const currentLevel = calculateLevel(currentPoints);
      const levelBeforeToday = calculateLevel(currentPoints - xpGainedToday);
      const bonusText = currentLevel > levelBeforeToday
        ? `⬆️ Niveau ${currentLevel} atteint !`
        : null;
      // Prochaine tâche : récurrente non-cochée d'abord, sinon première non-cochée
      const uncompletedToday = todayTasks.filter(t => !t.completed);
      const nextTask = uncompletedToday.find(t => t.recurrence) ?? uncompletedToday[0] ?? null;
      const nextTaskText = nextTask?.text ?? null;
      const nextTaskId = nextTask?.id ?? null;
      // patchMascotte : merge avec le lastSnapshot → préserve mascotteName et companionSpriteBase64
      patchMascotte({
        tasksDone: doneCount,
        tasksTotal: totalCount,
        xpGained: xpGainedToday,
        currentMeal: mealText,
        bonusText,
        nextTaskText,
        nextTaskId,
        nextRdvText,
        speechBubble,
      });
    }, 300);
  }, []);

  const mealsHook = useVaultMeals(vaultRef, triggerWidgetRefresh);
  const { meals, setMeals } = mealsHook;
  useEffect(() => { mealsRef.current = meals; }, [meals]);

  const {
    rdvs,
    setRdvs,
    addRDV,
    updateRDV,
    deleteRDV,
    resetRDV,
  } = useVaultRDV(vaultRef, triggerWidgetRefresh);
  useEffect(() => { rdvsRef.current = rdvs; }, [rdvs]);

  const {
    photoDates,
    setPhotoDates,
    addPhoto,
    getPhotoUri,
    resetPhotos,
  } = useVaultPhotos(vaultRef, busyRef);

  const {
    routines,
    setRoutines,
    saveRoutines,
    resetRoutines,
  } = useVaultRoutines(vaultRef);

  const {
    memories,
    setMemories,
    addMemory,
    updateMemory,
    resetMemories,
  } = useVaultMemories(vaultRef);

  const {
    vacationConfig,
    setVacationConfig,
    vacationTasks,
    setVacationTasks,
    isVacationActive,
    activateVacation,
    deactivateVacation,
    resetVacation,
  } = useVaultVacation(vaultRef);

  // Domaine Tasks délégué à useVaultTasks
  const tasksHook = useVaultTasks(vaultRef, triggerWidgetRefresh, setVacationTasks);
  const { tasks, tasksRef } = tasksHook;
  useEffect(() => { tasksRefForWidget.current = tasks; }, [tasks]);

  // Compteur "tâches complétées aujourd'hui" pour Live Activity + carte dashboard
  // (événementiel car les récurrentes reset completed=false après toggle)
  const [tasksCompletedToday, setTasksCompletedToday] = useState(0);
  const tasksCompletedTodayRef = useRef<{ date: string; count: number }>({ date: '', count: 0 });
  useEffect(() => {
    const unsub = tasksHook.subscribeTaskComplete(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (tasksCompletedTodayRef.current.date !== today) {
        tasksCompletedTodayRef.current = { date: today, count: 1 };
      } else {
        tasksCompletedTodayRef.current.count += 1;
      }
      setTasksCompletedToday(tasksCompletedTodayRef.current.count);
      triggerWidgetRefresh();
    });
    return unsub;
  }, [tasksHook, triggerWidgetRefresh]);

  const [gamiData, setGamiData] = useState<GamificationData | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotificationPrefs());
  const [journalStats, setJournalStats] = useState<JournalSummaryEntry[]>([]);
  const [skillTrees, setSkillTrees] = useState<SkillTreeData[]>([]);

  // Domaine Profils délégué à useVaultProfiles
  const profilesHook = useVaultProfiles(vaultRef, setGamiData, tasksHook.setTasks);
  const { profiles, setProfiles, activeProfileId, setActiveProfileId, activeProfile, ageUpgrades, setAgeUpgrades } = profilesHook;

  // Domaine Préférences alimentaires — initialisé APRÈS profilesHook (dépend de reloadProfiles)
  const dietaryHook = useVaultDietary(vaultRef, profiles, profilesHook.refreshGamification);

  // Domaine Recettes délégué à useVaultRecipes
  const recipesHook = useVaultRecipes(vaultRef, profiles);
  const { recipes } = recipesHook;

  // Domaine Quêtes coopératives — initialisé EN PREMIER pour que contribute soit disponible pour defisHook
  const gamiDataRef = useRef(gamiData);
  gamiDataRef.current = gamiData;

  // Refs déclarés en haut pour triggerWidgetRefresh, tenus à jour ici
  gamiDataForWidgetRef.current = gamiData;
  activeProfileIdForWidgetRef.current = activeProfileId ?? null;

  // ─── Backup consolidé : flush gamiData → gamification.md (1×/jour) ─────────
  const lastGamiBackupDate = useRef<string | null>(null);
  useEffect(() => {
    if (!gamiData || !vaultRef.current) return;
    const today = new Date().toISOString().slice(0, 10);
    if (lastGamiBackupDate.current === today) return;
    lastGamiBackupDate.current = today;
    vaultRef.current.writeFile('gamification.md', serializeGamification(gamiData)).catch(() => {});
  }, [gamiData]);

  const questsHook = useVaultFamilyQuests(vaultRef, gamiDataRef, setGamiData, setProfiles);

  // Domaine Défis délégué à useVaultDefis — reçoit questsHook.contribute comme onQuestProgress
  const defisHook = useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles, questsHook.contribute);
  const { defis } = defisHook;

  // Domaine Health délégué à useVaultHealth
  const healthHook = useVaultHealth(vaultRef);
  const { healthRecords, resetHealth } = healthHook;

  // Domaine Missions secrètes délégué à useVaultSecretMissions
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const missionsHook = useVaultSecretMissions(vaultRef, profilesRef);
  const { secretMissions, resetSecretMissions: resetMissions } = missionsHook;

  // Domaine Histoires du soir délégué à useVaultStories
  const storiesHook = useVaultStories(vaultRef);

  // Domaine Love Notes delegue a useVaultLoveNotes (Phase 34)
  const loveNotesHook = useVaultLoveNotes(vaultRef);

  // Jardin familial — contenu brut du fichier partagé (Phase 26)
  const [gardenRaw, setGardenRaw] = useState<string>('');

  // ─── Hooks domaine ─────────────────────────────────────────────────────────
  const {
    anniversaries,
    setAnniversaries,
    addAnniversary,
    updateAnniversary,
    removeAnniversary,
    importAnniversaries,
    resetAnniversaires,
  } = useVaultAnniversaires(vaultRef);

  // ─── Sous-hooks par domaine ───────────────────────────────────────────────
  const {
    wishlistItems,
    setWishlistItems,
    addWishItem,
    updateWishItem,
    deleteWishItem,
    toggleWishBought,
    resetWishlist,
  } = useVaultWishlist(vaultRef);

  const {
    gratitudeDays,
    setGratitudeDays,
    addGratitudeEntry,
    deleteGratitudeEntry,
    resetGratitude,
  } = useVaultGratitude(vaultRef);

  const {
    quotes,
    setQuotes,
    addQuote,
    editQuote,
    deleteQuote,
    resetQuotes,
  } = useVaultQuotes(vaultRef);

  const {
    moods,
    setMoods,
    addMood,
    deleteMood,
    resetMoods,
  } = useVaultMoods(vaultRef);

  // Load vault path + active profile from SecureStore on mount
  useEffect(() => {
    (async () => {
      try {
        // Restaurer l'accès security-scoped (iOS) ou SAF persistable (Android)
        const restoredUri = await restoreAccess();

        const [stored, storedProfileId] = await Promise.all([
          SecureStore.getItemAsync(VAULT_PATH_KEY),
          SecureStore.getItemAsync(ACTIVE_PROFILE_KEY),
        ]);
        if (storedProfileId) setActiveProfileId(storedProfileId);
        if (stored) {
          // Vérifier que la permission est toujours valide (SAF peut la révoquer)
          if (stored.startsWith('content://') && !restoredUri) {
            setError('L\'accès au vault a été révoqué. Reconnectez le dossier dans les Réglages.');
            return;
          }
          setVaultPathState(stored);
          vaultRef.current = new VaultManager(stored);

          // Hydrate depuis le cache local — dashboard visible immédiatement.
          // loadVaultData() écrasera ensuite avec les vraies données du vault.
          // Exclut jardin/ferme/gamification : toujours chargés frais (voir vault-cache.ts).
          const cached = await hydrateFromCache();
          if (cached && cached.vaultPath === stored) {
            try {
              setProfiles(cached.profiles.map(hydrateProfileFromCache));
              tasksHook.setTasks(cached.tasks);
              setRoutines(cached.routines);
              coursesHook.setCourses(cached.courses);
              stockHook.setStock(cached.stock);
              stockHook.setStockSections(cached.stockSections);
              setMeals(cached.meals);
              setRdvs(cached.rdvs);
              setPhotoDates(cached.photoDates);
              setMemories(cached.memories);
              healthHook.setHealthRecords(cached.healthRecords);
              setJournalStats(cached.journalStats);
              setGratitudeDays(cached.gratitudeDays);
              setWishlistItems(cached.wishlistItems);
              setAnniversaries(cached.anniversaries);
              setNotifPrefs(cached.notifPrefs);
              setVacationConfig(cached.vacationConfig);
              setVacationTasks(cached.vacationTasks);
              notesHook.setNotes(cached.notes);
              setQuotes(cached.quotes);
              setMoods(cached.moods);
              missionsHook.setSecretMissions(cached.secretMissions);
              loveNotesHook.setLoveNotes(cached.loveNotes);
              setIsLoading(false);
            } catch (e) {
              if (__DEV__) console.warn('[vault-cache] hydration apply failed:', e);
            }
          }

          await loadVaultData(vaultRef.current);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Refresh on foreground (with delay to avoid race with image picker)
  const lastVaultLoadRef = useRef<number>(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && vaultRef.current) {
        // Re-acquire security-scoped access (iOS revokes it on app suspend)
        restoreAccess().catch(() => {});
        // Throttle: skip reload si données fraîches (< 30s)
        const now = Date.now();
        if (now - lastVaultLoadRef.current < 30_000) return;
        // Delay reload to let pending operations (addPhoto etc.) finish first
        setTimeout(() => {
          if (!busyRef.current && vaultRef.current) {
            lastVaultLoadRef.current = Date.now();
            loadVaultData(vaultRef.current);
          }
        }, 1000);
      }
    });
    return () => sub.remove();
  }, []);

  // Consommer les pending task toggles écrits par ToggleNextTaskIntent depuis
  // la Live Activity (bouton "Cocher" de la DI, iOS 17+). Pattern claim-first :
  // consumePendingTaskToggles() supprime les fichiers côté natif avant de
  // retourner les taskIds. On toggle chaque tâche trouvée via tasksRef (fallback
  // silencieux si la tâche n'existe plus ou si les données ne sont pas encore
  // chargées — le fichier est déjà supprimé, no-op acceptable).
  // Bridge setté par <LiveActivityGamificationBridge> (rendu dans ToastProvider
   // pour avoir accès à useGamification). null tant que pas monté → fallback
   // sur toggleTask seul.
  const liveActivityTaskCompleteRef = useRef<((task: Task) => Promise<void>) | null>(null);

  const consumeLiveActivityToggles = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    // Tant que les tâches ne sont pas chargées, on ne consomme pas (sinon les
    // fichiers seraient supprimés côté natif sans pouvoir être appliqués).
    // L'effet init (dépendance tasks.length) les traite dès que le vault est prêt.
    if (tasksRef.current.length === 0) return;
    try {
      const taskIds = await consumePendingTaskToggles();
      if (!taskIds.length) return;
      for (const taskId of taskIds) {
        const target = tasksRef.current.find((t) => t.id === taskId);
        if (!target || target.completed) continue;
        try {
          // Si le bridge gamification est monté → full flow (toggle + XP + loot).
          // Sinon fallback silencieux sur toggleTask seul.
          if (liveActivityTaskCompleteRef.current) {
            await liveActivityTaskCompleteRef.current(target);
          } else {
            await tasksHook.toggleTask(target, true);
          }
        } catch (e) {
          if (__DEV__) console.warn('[useVault] toggleTask from Live Activity failed:', e);
        }
      }
    } catch {
      // silencieux — feature non critique
    }
  }, [tasksHook, tasksRef]);

  // Au boot : tenter la consommation dès que les tâches sont chargées (1er render
  // avec tasks non-vide). Si l'utilisateur a cliqué sur le bouton DI pendant que
  // l'app était fermée, on rattrape au prochain lancement.
  const didInitialToggleConsumeRef = useRef(false);
  useEffect(() => {
    if (didInitialToggleConsumeRef.current) return;
    if (tasks.length === 0) return;
    didInitialToggleConsumeRef.current = true;
    consumeLiveActivityToggles();
  }, [tasks.length, consumeLiveActivityToggles]);

  // À chaque retour en foreground : consommer les toggles posés pendant que
  // l'app était en background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        // Petit délai pour laisser restoreAccess + éventuel reload finir
        setTimeout(() => consumeLiveActivityToggles(), 300);
      }
    });
    return () => sub.remove();
  }, [consumeLiveActivityToggles]);

  // Programmer les notifications de révélation sur CE téléphone pour les love notes
  // reçues en attente (multi-device : le téléphone de l'expéditeur ne peut pas
  // programmer les notifs du destinataire — chaque appareil le fait pour lui-même).
  useEffect(() => {
    if (!activeProfileId) return;
    loveNotesHook.loveNotes
      .filter((n) => n.to === activeProfileId && n.status === 'pending')
      .forEach((n) => scheduleLoveNoteReveal(n).catch(() => {}));
  }, [loveNotesHook.loveNotes, activeProfileId]);

  const loadVaultData = useCallback(async (vault: VaultManager) => {
    setError(null);
    const debugErrors: string[] = [];

    try {
      // Load profiles first (needed for dynamic task file paths)
      let familleContent = '';
      let gamiContent = '';
      let enfantNames: string[] = [];
      // Snapshot des profils pour saveCache() en fin de fonction (évite la
      // lecture de state React potentiellement stale dans le closure).
      let profilesSnapshot: Profile[] = [];
      try {
        familleContent = await vault.readFile(FAMILLE_FILE);
        const baseProfiles = parseFamille(familleContent);
        enfantNames = baseProfiles.filter((p) => p.role === 'enfant').map((p) => p.name);

        // Migration one-shot depuis gamification.md → gami-{id}.md
        await migrateGamification(vault, baseProfiles);

        // Migration one-shot depuis famille.md → farm-{id}.md
        await migrateFarmData(vault, baseProfiles);

        // Consommer les pending-reward-{id}.md (rewards village/quêtes écrits par un autre appareil)
        // Pattern claim-first : supprimer le fichier AVANT d'appliquer pour éviter double-consommation
        for (const p of baseProfiles) {
          try {
            const pendingFile = `pending-reward-${p.id}.md`;
            const pendingContent = await vault.readFile(pendingFile).catch(() => '');
            if (!pendingContent) continue;
            // Supprimer immédiatement (claim-first)
            await vault.deleteFile(pendingFile);
            // Parser les rewards (séparés par ---)
            const entries = pendingContent.split('\n---\n').filter(Boolean);
            for (const entry of entries) {
              try {
                const reward = JSON.parse(entry.trim());
                if (reward.type === 'village' && reward.xp) {
                  // Village reward : +XP + loot boxes dans gami-{id}.md
                  const gamiPath = gamiFile(p.id);
                  const gamiRaw = await vault.readFile(gamiPath).catch(() => '');
                  if (!gamiRaw) continue;
                  const gami = parseGamification(gamiRaw);
                  const gamiProfile = gami.profiles.find((gp: any) => gp.id === p.id || gp.name === p.name);
                  if (!gamiProfile) continue;
                  const { profile: updated } = addPoints(gamiProfile, reward.xp, reward.note ?? 'Récompense village');
                  gamiProfile.points = updated.points;
                  gamiProfile.coins = updated.coins;
                  gamiProfile.level = updated.level;
                  gamiProfile.lootBoxesAvailable = (gamiProfile.lootBoxesAvailable ?? 0) + (reward.lootBoxes ?? 0);
                  const newEntry = { profileId: p.id, action: `+${reward.xp}`, points: reward.xp, note: reward.note ?? 'Récompense village', timestamp: reward.at ?? new Date().toISOString() };
                  const singleData = {
                    profiles: [gamiProfile],
                    history: [...gami.history.filter((e: any) => e.profileId === p.id), newEntry],
                    activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === p.id),
                    usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === p.id),
                  };
                  await vault.writeFile(gamiPath, serializeGamification(singleData));
                } else if (reward.type === 'quest' && reward.reward) {
                  // Quest reward : appliquer directement (ce profil est local)
                  const { applyQuestReward } = await import('../lib/quest-engine');
                  await applyQuestReward(vault, [p.id], reward.reward);
                }
              } catch { /* Pending reward parse — non-critical */ }
            }
          } catch { /* Pending reward — non-critical */ }
        }

        // Lecture multi-fichier per-profil + merge en mémoire
        const [gamiFileResults, farmFileResults] = await Promise.all([
          Promise.allSettled(baseProfiles.map(p => vault.readFile(gamiFile(p.id)))),
          Promise.allSettled(baseProfiles.map(p => vault.readFile(farmFile(p.id)))),
        ]);

        const mergedProfiles: any[] = [];
        const mergedHistory: any[] = [];
        const mergedActiveRewards: any[] = [];
        const mergedUsedLoots: any[] = [];
        for (let i = 0; i < baseProfiles.length; i++) {
          const result = gamiFileResults[i];
          const content = result.status === 'fulfilled' ? result.value : '';
          if (!content) continue;
          const g = parseGamification(content);
          mergedProfiles.push(...g.profiles);
          mergedHistory.push(...g.history);
          mergedActiveRewards.push(...(g.activeRewards ?? []));
          mergedUsedLoots.push(...(g.usedLoots ?? []));
        }

        // Lire les données farm per-profil
        const farmDataByProfile: Record<string, FarmProfileData> = {};
        for (let i = 0; i < baseProfiles.length; i++) {
          const result = farmFileResults[i];
          const content = result.status === 'fulfilled' ? result.value : '';
          farmDataByProfile[baseProfiles[i].id] = parseFarmProfile(content);
        }

        const gami: GamificationData = {
          profiles: mergedProfiles,
          history: mergedHistory,
          activeRewards: mergedActiveRewards,
          usedLoots: mergedUsedLoots,
        };
        gamiContent = serializeGamification(gami);
        const merged = mergeProfiles(familleContent, gamiContent);
        // Enrichir les profils avec les données farm
        const mergedWithFarm = merged.map(p => ({
          ...p,
          ...(farmDataByProfile[p.id] ?? { mascotDecorations: [], mascotInhabitants: [], mascotPlacements: {} }),
        }));
        setProfiles(mergedWithFarm);
        profilesSnapshot = mergedWithFarm;

        // Clean up expired active rewards + sync multiplier remainingTasks
        if (gami.activeRewards?.length > 0) {
          let cleaned = processActiveRewards(gami.activeRewards);
          // Sync remainingTasks depuis profile.multiplierRemaining
          let synced = false;
          cleaned = cleaned.map(r => {
            if (r.type === 'multiplier' && r.profileId) {
              const prof = mergedWithFarm.find(p => p.id === r.profileId);
              if (prof && r.remainingTasks !== prof.multiplierRemaining) {
                synced = true;
                return { ...r, remainingTasks: prof.multiplierRemaining };
              }
            }
            return r;
          });
          if (cleaned.length !== gami.activeRewards.length || synced) {
            const updatedGami = { ...gami, activeRewards: cleaned };
            // Écrire per-profil les activeRewards nettoyées
            for (const p of baseProfiles) {
              const file = gamiFile(p.id);
              const existingContent = await vault.readFile(file).catch(() => '');
              if (!existingContent) continue;
              const existing = parseGamification(existingContent);
              const singleData: GamificationData = {
                profiles: existing.profiles,
                history: existing.history,
                activeRewards: cleaned.filter(r => r.profileId === p.id),
                usedLoots: existing.usedLoots ?? [],
              };
              await vault.writeFile(file, serializeGamification(singleData));
            }
            setGamiData(updatedGami);
          } else {
            setGamiData(gami);
          }
        } else {
          setGamiData(gami);
        }
        // Detect age category upgrades
        const upgrades: AgeUpgrade[] = [];
        for (const p of mergedWithFarm) {
          if (p.role !== 'enfant' || !p.birthdate) continue;
          const currentCat = getAgeCategoryFromBirthdate(p.birthdate);
          if (p.ageCategory && p.ageCategory !== currentCat) {
            upgrades.push({
              profileId: p.id,
              childName: p.name,
              oldCategory: p.ageCategory,
              newCategory: currentCat,
            });
          }
        }
        setAgeUpgrades(upgrades);
      } catch (e) {
        debugErrors.push(`profiles: ${e}`);
        setProfiles([]);
        setGamiData(null);
      }

      // --- Parallel loading: batch all independent sections ---
      // Build task file paths dynamically from enfant names
      const taskFiles = [
        ...enfantNames.map((name) => `01 - Enfants/${name}/Tâches récurrentes.md`),
        ...STATIC_TASK_FILES,
      ];

      const results = await Promise.allSettled([
        // [0] Tasks — avec reset hebdo des sections récurrentes
        (async () => {
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const RECURRING_SECTIONS = /hebdo|mensuel|tous les|quotid/i;

          const results = await Promise.all(taskFiles.map(async (relPath) => {
            try {
              let content = await vault.readFile(relPath);
              const lines = content.split('\n');
              let fileChanged = false;
              let currentSection = '';

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith('## ') || line.startsWith('### ')) {
                  currentSection = line.replace(/^#{2,3}\s+/, '').trim();
                }
                if (!RECURRING_SECTIONS.test(currentSection)) continue;
                const isChecked = /^- \[x\]/i.test(line.trim());
                if (!isChecked) continue;

                const dateMatch = line.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                  const completedDate = new Date(dateMatch[1] + 'T00:00:00');
                  if (completedDate < weekStart) {
                    lines[i] = line.replace(/- \[x\]/i, '- [ ]').replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
                    fileChanged = true;
                  }
                } else {
                  lines[i] = line.trimEnd() + ` ✅ ${todayStr}`;
                  fileChanged = true;
                }
              }

              if (fileChanged) {
                content = lines.join('\n');
                await vault.writeFile(relPath, content);
              }
              return parseTaskFile(relPath, content);
            } catch (e) { debugErrors.push(`tasks[${relPath}]: ${e}`); return []; }
          }));
          return results.flat();
        })(),

        // [1] Routines
        vault.readFile(ROUTINES_FILE).then((c) => parseRoutines(c)).catch((e): Routine[] => {
          debugErrors.push(`routines: ${e}`); return [];
        }),

        // [2] Courses
        vault.readFile(COURSES_FILE).then((c) => parseCourses(c, COURSES_FILE)).catch((e) => {
          debugErrors.push(`courses: ${e}`); return [] as CourseItem[];
        }),

        // [3] Stock
        vault.readFile(STOCK_FILE).then((c) => ({
          items: parseStock(c),
          sections: parseStockSections(c),
        })).catch((e) => {
          debugErrors.push(`stock: ${e}`); return { items: [] as StockItem[], sections: [] as string[] };
        }),

        // [4] Meals (fichier par semaine, migration auto depuis l'ancien fichier unique)
        (async () => {
          const currentFile = mealsFileForWeek();
          if (!(await vault.exists(currentFile))) {
            // Migration : si l'ancien fichier existe, le renommer pour cette semaine
            if (await vault.exists(MEALS_LEGACY_FILE)) {
              const legacy = await vault.readFile(MEALS_LEGACY_FILE);
              await vault.writeFile(currentFile, legacy);
              // Supprimer l'ancien fichier
              try { await vault.deleteFile(MEALS_LEGACY_FILE); } catch (e) { warnUnexpected('meals-legacy-delete', e); }
            } else {
              await vault.writeFile(currentFile, MEALS_TEMPLATE);
            }
          }
          const c = await vault.readFile(currentFile);
          return parseMeals(c, currentFile);
        })().catch((e) => { debugErrors.push(`meals: ${e}`); return [] as MealItem[]; }),

        // [5] RDVs
        (async () => {
          await vault.ensureDir(RDV_DIR);
          const loadedRdvs: RDV[] = [];
          const loadRdvsFromDir = async (dir: string) => {
            let files: string[] = [];
            try { files = await vault.listDir(dir); } catch (e) { warnUnexpected(`rdv-listDir(${dir})`, e); return; }
            const rdvResults = await Promise.all(files.filter(f => f.endsWith('.md')).map(async (file) => {
              try {
                const content = await vault.readFile(`${dir}/${file}`);
                const rdv = parseRDV(`${dir}/${file}`, content);
                return (rdv && rdv.statut !== 'annulé') ? rdv : null;
              } catch (e) { warnUnexpected(`rdv-read(${file})`, e); return null; }
            }));
            loadedRdvs.push(...rdvResults.filter((r): r is RDV => r !== null));
          };
          await Promise.all([loadRdvsFromDir(RDV_DIR), loadRdvsFromDir(RDV_ARCHIVES_DIR)]);
          loadedRdvs.sort((a, b) => a.date_rdv.localeCompare(b.date_rdv));
          return loadedRdvs;
        })().catch((e) => { debugErrors.push(`rdv: ${e}`); return [] as RDV[]; }),

        // [6] Photos
        (async () => {
          const photoMap: Record<string, string[]> = {};
          await Promise.all(enfantNames.map(async (name) => {
            try {
              const dates = await vault.listPhotoDates(name);
              const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
              photoMap[id] = dates;
            } catch (e) { warnUnexpected(`photos(${name})`, e); }
          }));
          return photoMap;
        })().catch((e) => { debugErrors.push(`photos: ${e}`); return {} as Record<string, string[]>; }),

        // [7] Memories/jalons
        (async () => {
          const allMemories: Memory[] = [];
          await Promise.all(enfantNames.map(async (name) => {
            const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
            try {
              const jalonsPath = `${MEMOIRES_DIR}/${name}/Jalons.md`;
              if (await vault.exists(jalonsPath)) {
                const content = await vault.readFile(jalonsPath);
                allMemories.push(...parseJalons(name, id, content));
              }
            } catch (e) { warnUnexpected(`jalons(${name})`, e); }
          }));
          allMemories.sort((a, b) => b.date.localeCompare(a.date));
          return allMemories;
        })().catch(() => [] as Memory[]),

        // [8] Health records
        Promise.all(
          enfantNames.map(async (name) => {
            const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
            try {
              const content = await vault.readFile(`${HEALTH_DIR}/${name}/Carnet de santé.md`);
              return parseHealthRecord(name, id, content);
            } catch (e) { warnUnexpected(`health(${name})`, e); return null; }
          })
        ).then((r) => r.filter((x): x is HealthRecord => x !== null)).catch(() => [] as HealthRecord[]),

        // [9] Journal — aujourd'hui + hier seulement au boot
        (async () => {
          const today = new Date();
          const last2 = Array.from({ length: 2 }, (_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            return format(d, 'yyyy-MM-dd');
          });
          const entries: JournalSummaryEntry[] = [];
          await Promise.all(enfantNames.flatMap((name) =>
            last2.map(async (dateStr) => {
              try {
                const path = `03 - Journal/${name}/${dateStr} ${name}.md`;
                const content = await vault.readFile(path);
                if (content) {
                  entries.push({ enfant: name, date: dateStr, stats: parseJournalStats(content) });
                }
              } catch (e) { warnUnexpected(`journal(${name}/${dateStr})`, e); }
            })
          ));
          return entries;
        })().catch(() => [] as JournalSummaryEntry[]),

        // [10] Défis familiaux
        (async () => {
          const defisContent = await vault.readFile(DEFIS_FILE);
          const parsed = parseDefis(defisContent);
          const todayStr = new Date().toISOString().slice(0, 10);
          let changed = false;
          const autoCompleted: typeof parsed = [];
          for (const d of parsed) {
            // Jour de grâce (daily/abstinence uniquement) : 1 jour après la fin pour valider
            const hasGrace = d.type === 'daily' || d.type === 'abstinence';
            const expiry = hasGrace ? (() => { const g = new Date(d.endDate + 'T12:00:00'); g.setDate(g.getDate() + 1); return g.toISOString().slice(0, 10); })() : d.endDate;
            if (d.status === 'active' && expiry < todayStr) {
              const uniqueDays = new Set(d.progress.filter((p) => p.completed).map((p) => p.date)).size;
              if (d.type === 'abstinence') {
                const hasFail = d.progress.some((p) => !p.completed);
                d.status = hasFail ? 'failed' : uniqueDays >= d.targetDays ? 'completed' : 'failed';
              } else {
                d.status = uniqueDays >= d.targetDays ? 'completed' : 'failed';
              }
              changed = true;
              if (d.status === 'completed') autoCompleted.push(d);
            }
          }
          if (changed) {
            await vault.writeFile(DEFIS_FILE, serializeDefis(parsed));
            if (autoCompleted.length > 0 && gamiContent) {
              try {
                const gami = parseGamification(gamiContent);
                const allProfileIds = parseFamille(familleContent).map((p) => p.id);
                for (const d of autoCompleted) {
                  const participantIds = d.participants.length > 0 ? d.participants : allProfileIds;
                  for (const pid of participantIds) {
                    const profile = gami.profiles.find((p) => p.name.toLowerCase().replace(/\s+/g, '') === pid);
                    if (profile) {
                      profile.points += d.rewardPoints;
                      profile.lootBoxesAvailable += d.rewardLootBoxes;
                      gami.history.push({
                        profileId: pid,
                        action: `+${d.rewardPoints}`,
                        points: d.rewardPoints,
                        note: `Défi: ${d.title}`,
                        timestamp: new Date().toISOString(),
                      });
                    }
                  }
                }
                // Écrire per-profil
                const allBaseProfiles = parseFamille(familleContent);
                for (const bp of allBaseProfiles) {
                  const file = gamiFile(bp.id);
                  const profContent = await vault.readFile(file).catch(() => '');
                  if (!profContent) continue;
                  const profGami = parseGamification(profContent);
                  const updatedProf = gami.profiles.find(p => p.id === bp.id || p.name.toLowerCase().replace(/\s+/g, '') === bp.id);
                  const singleData: GamificationData = {
                    profiles: updatedProf ? [updatedProf] : profGami.profiles,
                    history: gami.history.filter(e => e.profileId === bp.id),
                    activeRewards: (gami.activeRewards ?? []).filter(r => r.profileId === bp.id),
                    usedLoots: (gami.usedLoots ?? []).filter(u => u.profileId === bp.id),
                  };
                  await vault.writeFile(file, serializeGamification(singleData));
                }
                const gamiStr = serializeGamification(gami);
                setProfiles(mergeProfiles(familleContent, gamiStr));
                setGamiData(gami);
              } catch (e) { warnUnexpected('defis-gamification', e); }
            }
          }
          return parsed;
        })().catch((): Defi[] => []),

        // [11] Gratitude
        vault.readFile(GRATITUDE_FILE).then((c) => parseGratitude(c)).catch((): GratitudeDay[] => []),

        // [12] Wishlist
        vault.readFile(WISHLIST_FILE).then((c) => parseWishlist(c)).catch((): WishlistItem[] => []),

        // [13] Anniversaires
        vault.readFile(ANNIVERSAIRES_FILE).then((c) => parseAnniversaries(c)).catch(() => [] as Anniversary[]),

        // [14] Notification preferences
        (async () => {
          if (await vault.exists(NOTIF_FILE)) {
            const notifContent = await vault.readFile(NOTIF_FILE);
            return parseNotificationPrefs(notifContent);
          }
          return getDefaultNotificationPrefs();
        })().catch(() => getDefaultNotificationPrefs()),

        // [15] Vacation mode
        (async () => {
          const vacRaw = await SecureStore.getItemAsync(VACATION_STORE_KEY);
          let config: VacationConfig | null = null;
          if (vacRaw) {
            config = JSON.parse(vacRaw);
            const todayISO = new Date().toISOString().slice(0, 10);
            if (config!.active && config!.endDate < todayISO) {
              config = { ...config!, active: false };
              await SecureStore.setItemAsync(VACATION_STORE_KEY, JSON.stringify(config));
            }
          }
          let vacTasks: Task[] = [];
          try {
            if (await vault.exists(VACATION_FILE)) {
              const vacContent = await vault.readFile(VACATION_FILE);
              vacTasks = parseTaskFile(VACATION_FILE, vacContent);
            }
          } catch (e) { warnUnexpected('vacation-tasks', e); }
          return { config, vacTasks };
        })().catch(() => ({ config: null as VacationConfig | null, vacTasks: [] as Task[] })),

        // [16] Notes & Articles
        notesHook.loadNotes(vault),

        // [17] Mots d'enfants
        vault.readFile(QUOTES_FILE).then((c) => parseQuotes(c)).catch(() => [] as ChildQuote[]),

        // [18] Météo des humeurs
        vault.readFile(MOODS_FILE).then((c) => parseMoods(c)).catch(() => [] as MoodEntry[]),

        // [19] Skill trees (compétences enfants)
        (async () => {
          try {
            const files = await vault.listDir(SKILLS_DIR);
            const trees = await Promise.all(
              files.filter((f) => f.endsWith('.md')).map(async (file) => {
                const content = await vault.readFile(`${SKILLS_DIR}/${file}`);
                return parseSkillTree(content);
              })
            );
            return trees;
          } catch (e) { warnUnexpected('skill-trees', e); return [] as SkillTreeData[]; }
        })(),

        // [20] Missions secrètes
        vault.readFile(SECRET_MISSIONS_FILE).then((c) => parseSecretMissions(c)).catch(() => [] as Task[]),

        // [21] Village garden — fichier partagé
        vault.readFile(VILLAGE_FILE).catch(() => ''),

        // [22] Histoires du soir
        storiesHook.loadStories(vault, enfantNames).catch(() => [] as BedtimeStory[]),

        // [23] Love Notes — 1 fichier par note classe par destinataire (Phase 34)
        loveNotesHook.loadLoveNotes(vault).catch(() => [] as LoveNote[]),
      ]);

      // Apply results — use helper to extract settled values
      const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === 'fulfilled' ? r.value : fallback;

      const tasksResult = val(results[0], [] as Task[]);
      tasksHook.setTasks(tasksResult);
      setRoutines(val(results[1], []));
      coursesHook.setCourses(val(results[2], []));
      const stockResult = val(results[3], { items: [] as StockItem[], sections: [] as string[] });
      stockHook.setStock(stockResult.items);
      stockHook.setStockSections(stockResult.sections);
      setMeals(val(results[4], []));
      const rdvResult = val(results[5], [] as RDV[]);
      setRdvs(rdvResult);
      // Planifier toutes les notifications locales
      setupAllNotifications({
        rdvs: rdvResult,
        tasks: tasksResult,
        stock: stockResult.items,
        hasGrossesse: profiles.some(p => p.statut === 'grossesse' && p.dateTerme),
        lang: i18n.language,
      }).catch(() => {});
      setPhotoDates(val(results[6], {}));
      setMemories(val(results[7], []));
      healthHook.setHealthRecords(val(results[8], []));
      setJournalStats(val(results[9], []));
      const newDefis: Defi[] = val(results[10], []);
      // Détecter les nouveaux défis actifs (arrivés via sync iCloud)
      const prevDefis = defisHook.defis;
      if (prevDefis.length > 0) {
        const prevIds = new Set(prevDefis.map(d => d.id));
        const hasNew = newDefis.some(d => d.status === 'active' && !prevIds.has(d.id));
        if (hasNew) {
          loadNotifConfig().then(cfg => {
            if (!cfg.defiEnabled) return;
            for (const d of newDefis) {
              if (d.status === 'active' && !prevIds.has(d.id)) {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: `${d.emoji} Nouveau défi !`,
                    body: `${d.title} — du ${d.startDate} au ${d.endDate}. Ouvrez l'app pour participer !`,
                    sound: 'default',
                    data: { type: 'defi_launched', defiId: d.id },
                  },
                  trigger: null,
                }).catch(() => {});
              }
            }
          }).catch(() => {});
        }
      }
      defisHook.setDefis(newDefis);

      // Quêtes coopératives familiales : chargement + détection expiration
      const questsContent = await vault.readFile(FAMILY_QUESTS_FILE).catch(() => '');
      let loadedQuests = parseFamilyQuests(questsContent);
      // Détection expiration au chargement — notification locale si quête expirée
      loadedQuests = await questsHook.checkAndExpireQuests(loadedQuests);
      questsHook.setFamilyQuests(loadedQuests);

      setGratitudeDays(val(results[11], []));
      setWishlistItems(val(results[12], []));
      setAnniversaries(val(results[13], []));
      setNotifPrefs(val(results[14], getDefaultNotificationPrefs()));
      const vacResult = val(results[15], { config: null as VacationConfig | null, vacTasks: [] as Task[] });
      setVacationConfig(vacResult.config);
      setVacationTasks(vacResult.vacTasks);
      notesHook.setNotes(val(results[16], []));
      setQuotes(val(results[17], []));
      setMoods(val(results[18], []));
      setSkillTrees(val(results[19], []));
      missionsHook.setSecretMissions(val(results[20], []));
      setGardenRaw(val(results[21], '') as string);
      storiesHook.setStories(val(results[22] as PromiseSettledResult<BedtimeStory[]>, []));
      loveNotesHook.setLoveNotes(val(results[23] as PromiseSettledResult<LoveNote[]>, []));

      // Mettre à jour les widgets iOS
      refreshWidget(val(results[4], []), rdvResult, tasksResult);
      refreshJournalWidget(profiles);

      // Sync feedings du widget vers le vault markdown (fire-and-forget)
      syncWidgetFeedingsToVault(vault).catch(() => {});

      // Persister un snapshot pour accélérer le prochain re-launch.
      // Exclut volontairement jardin/ferme/gamification (toujours chargés frais).
      saveCache({
        vaultPath: vault.vaultPath,
        profiles: profilesSnapshot.map(stripProfileForCache),
        tasks: tasksResult,
        routines: val(results[1], []) as Routine[],
        courses: val(results[2], []) as CourseItem[],
        stock: stockResult.items,
        stockSections: stockResult.sections,
        meals: val(results[4], []) as MealItem[],
        rdvs: rdvResult,
        photoDates: val(results[6], {}) as Record<string, string[]>,
        memories: val(results[7], []) as Memory[],
        healthRecords: val(results[8], []) as HealthRecord[],
        journalStats: val(results[9], []) as JournalSummaryEntry[],
        gratitudeDays: val(results[11], []) as GratitudeDay[],
        wishlistItems: val(results[12], []) as WishlistItem[],
        anniversaries: val(results[13], []) as Anniversary[],
        notifPrefs: val(results[14], getDefaultNotificationPrefs()),
        vacationConfig: vacResult.config,
        vacationTasks: vacResult.vacTasks,
        notes: val(results[16], []) as Note[],
        quotes: val(results[17], []) as ChildQuote[],
        moods: val(results[18], []) as MoodEntry[],
        secretMissions: val(results[20], []) as Task[],
        loveNotes: val(results[23] as PromiseSettledResult<LoveNote[]>, []) as LoveNote[],
      }).catch(() => { /* Cache save non-critical */ });

    } catch (e) {
      debugErrors.push(`global: ${e}`);
    }

    if (debugErrors.length > 0) {
      setError(debugErrors.join('\n'));
    }
  }, [notesHook.loadNotes, notesHook.setNotes]);

  const refresh = useCallback(async () => {
    if (!vaultRef.current) return;
    setIsLoading(true);
    await loadVaultData(vaultRef.current);
    setIsLoading(false);
  }, [loadVaultData]);

  const setVaultPath = useCallback(async (path: string) => {
    await SecureStore.setItemAsync(VAULT_PATH_KEY, path);
    // Reset all state before loading new vault to avoid stale data
    profilesHook.resetProfiles();
    setGamiData(null);
    tasksHook.resetTasks();
    resetCourses();
    resetStock();
    mealsHook.resetMeals();
    resetRDV();
    resetPhotos();
    resetMemories();
    resetVacation();
    recipesHook.resetRecipes();
    resetBudget();
    notesHook.resetNotes();
    resetAnniversaires();
    resetWishlist();
    resetGratitude();
    resetQuotes();
    resetMoods();
    resetRoutines();
    resetHealth();
    resetMissions();
    defisHook.resetDefis();
    questsHook.resetQuests();
    storiesHook.resetStories();
    loveNotesHook.resetLoveNotes();
    setVaultPathState(path);
    const vault = new VaultManager(path);
    vaultRef.current = vault;
    setIsLoading(true);
    await loadVaultData(vault);
    setIsLoading(false);
  }, [loadVaultData, resetAnniversaires]);

  // Recettes déléguées au hook useVaultRecipes

  // setActiveProfile délégué au hook useVaultProfiles

  const saveNotifPrefs = useCallback(async (prefs: NotificationPreferences) => {
    if (!vaultRef.current) return;
    setNotifPrefs(prefs);
    await vaultRef.current.writeFile(NOTIF_FILE, serializeNotificationPrefs(prefs));
  }, []);

  // Meals, Photos délégués aux hooks extraits
  const { updateMeal, loadMealsForWeek } = mealsHook;

  // Profils, mascotte, âge, enfants, routines, health, défis, gratitude, quotes, moods,
  // wishlist, anniversaires et notes : tous délégués aux hooks extraits

  // ─── Skill Trees (compétences enfants) ────────────────────────────────────

  const unlockSkill = useCallback(async (childProfileId: string, skillId: string) => {
    if (!vaultRef.current || !gamiData) return;

    const child = profiles.find((p) => p.id === childProfileId);
    if (!child) return;

    const skill = getSkillById(skillId);
    if (!skill) return;

    const xp = XP_PER_BRACKET[skill.ageBracketId];
    const now = new Date().toISOString();
    const currentActiveProfile = profiles.find((p) => p.id === activeProfileId);
    const unlockedBy = currentActiveProfile?.id ?? 'parent';

    // Trouver ou créer le skill tree
    const existing = skillTrees.find((t) => t.profileId === childProfileId);
    const treeData: SkillTreeData = existing ?? {
      profileId: childProfileId,
      profileName: child.name,
      unlocked: [],
    };

    // Ajouter l'unlock
    const updated: SkillTreeData = {
      ...treeData,
      unlocked: [...treeData.unlocked, { skillId, unlockedAt: now, unlockedBy }],
    };

    // Écrire le fichier
    const filePath = `${SKILLS_DIR}/${child.name}.md`;
    await vaultRef.current.ensureDir(SKILLS_DIR);
    await vaultRef.current.writeFile(filePath, serializeSkillTree(updated));

    // Mettre à jour le state local
    setSkillTrees((prev) => {
      const idx = prev.findIndex((t) => t.profileId === childProfileId);
      if (idx >= 0) return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      return [...prev, updated];
    });

    // Award XP via gamification (per-profil)
    const childProfile = gamiData.profiles.find((p) => p.id === childProfileId);
    if (childProfile) {
      const { profile: updatedProfile, entry, activeRewards: updatedRewards } = addPoints(childProfile, xp, `Compétence: ${skill.label}`, gamiData.activeRewards);
      // Merge partiel dans le state global
      setGamiData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          profiles: prev.profiles.map((p) => p.id === childProfileId ? updatedProfile : p),
          history: [...prev.history, entry],
          activeRewards: updatedRewards ?? prev.activeRewards,
        };
      });
      // Écrire uniquement le fichier per-profil de l'enfant concerné
      const file = gamiFile(childProfileId);
      const existingContent = await vaultRef.current.readFile(file).catch(() => '');
      const existingGami = parseGamification(existingContent);
      // Garde : ne pas écraser avec profiles vide si lecture échouée
      const existingProfile = existingGami.profiles.find(p => p.id === childProfileId || p.name.toLowerCase().replace(/\s+/g, '') === childProfileId.toLowerCase());
      const safeProfiles = existingProfile
        ? existingGami.profiles.map(p => (p.id === childProfileId || p.name.toLowerCase().replace(/\s+/g, '') === childProfileId.toLowerCase()) ? updatedProfile : p)
        : [updatedProfile];
      const singleData: GamificationData = {
        profiles: safeProfiles,
        history: [...existingGami.history, entry],
        activeRewards: updatedRewards ? updatedRewards.filter(r => r.profileId === childProfileId) : (existingGami.activeRewards ?? []),
        usedLoots: existingGami.usedLoots ?? [],
      };
      await vaultRef.current.writeFile(file, serializeGamification(singleData));
    }
  }, [gamiData, profiles, skillTrees, activeProfileId]);

  // Missions secrètes déléguées au hook extrait

  // ─── Saga narratives — compléter un chapitre ou une saga ──────────────────

  const completeSagaChapter = useCallback(async (
    profileId: string,
    points: number,
    sagaNote: string,
    rewardItem?: { id: string; type: 'decoration' | 'inhabitant' },
    bonusCropId?: string,
  ) => {
    if (!vaultRef.current) return;
    try {
      const file = gamiFile(profileId);
      const gamiContent = await vaultRef.current.readFile(file).catch(() => '');
      const gami = parseGamification(gamiContent);
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const currentProfiles = mergeProfiles(familleContent, gamiContent);
      const profile = currentProfiles.find((p) => p.id === profileId);
      if (!profile) return;

      const { profile: updated, entry, activeRewards: updatedRewards } = addPoints(profile, points, sagaNote, gami.activeRewards);
      const newGami = {
        ...gami,
        profiles: gami.profiles.map((p) => (p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()) ? { ...p, points: updated.points, level: updated.level, multiplierRemaining: updated.multiplierRemaining, multiplier: updated.multiplier } : p),
        history: [...gami.history, entry],
        activeRewards: updatedRewards ?? gami.activeRewards,
      };

      // Si récompense item → écrire saga_items dans famille.md (reste dans ce fichier)
      if (rewardItem) {
        await enqueueWrite(async () => {
          const famContent = await vaultRef.current!.readFile(FAMILLE_FILE);
          const lines = famContent.split('\n');

          const { createSagaItem } = require('../lib/types');
          const sagaItem = createSagaItem(rewardItem.id, rewardItem.type);
          let inSection = false;
          let fieldLine = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(new RegExp(`^###?\\s+.*${profileId}`, 'i')) || lines[i].match(new RegExp(`^id:\\s*${profileId}`, 'i'))) {
              inSection = true;
            } else if (inSection && lines[i].match(/^###?\s+/)) {
              break;
            }
            if (inSection && lines[i].startsWith('saga_items:')) {
              fieldLine = i;
              break;
            }
          }
          const itemEntry = `${sagaItem.itemId}|${sagaItem.type}|${sagaItem.expiresAt}`;
          if (fieldLine >= 0) {
            const current = lines[fieldLine].replace('saga_items:', '').trim();
            const items = current ? current.split(',').map((s: string) => s.trim()) : [];
            items.push(itemEntry);
            lines[fieldLine] = `saga_items: ${items.join(', ')}`;
          } else {
            let lastProp = -1;
            let inSec = false;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].match(new RegExp(`^###?\\s+.*${profileId}`, 'i')) || lines[i].match(new RegExp(`^id:\\s*${profileId}`, 'i'))) inSec = true;
              else if (inSec && lines[i].match(/^###?\s+/)) break;
              if (inSec && lines[i].includes(': ')) lastProp = i;
            }
            if (lastProp >= 0) lines.splice(lastProp + 1, 0, `saga_items: ${itemEntry}`);
          }
          await vaultRef.current!.writeFile(FAMILLE_FILE, lines.join('\n'));
        });
      }

      // Récolte bonus saga → écrire farm_harvest_inventory dans farm-{id}.md
      if (bonusCropId) {
        const fp = farmFile(profileId);
        const farmContent = await vaultRef.current.readFile(fp).catch(() => '');
        const farmData = parseFarmProfile(farmContent);
        // Phase B — bonus saga arrive en grade 'ordinaire'
        const harvestInv = { ...(farmData.harvestInventory ?? {}) };
        const existing = harvestInv[bonusCropId];
        if (existing == null) {
          harvestInv[bonusCropId] = { ordinaire: 1 };
        } else if (typeof existing === 'number') {
          harvestInv[bonusCropId] = { ordinaire: existing + 1 };
        } else {
          harvestInv[bonusCropId] = { ...existing, ordinaire: (existing.ordinaire ?? 0) + 1 };
        }
        farmData.harvestInventory = harvestInv;
        const profileNameSaga = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vaultRef.current.writeFile(fp, serializeFarmProfile(profileNameSaga, farmData));
      }

      const singleData: GamificationData = {
        profiles: newGami.profiles.filter(p => p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()),
        history: newGami.history.filter(e => e.profileId === profileId),
        activeRewards: (newGami.activeRewards ?? []).filter(r => r.profileId === profileId),
        usedLoots: (newGami.usedLoots ?? []).filter(u => u.profileId === profileId),
      };
      // Merge partiel dans le state global
      setGamiData(prev => {
        if (!prev) return prev;
        const updatedProf = singleData.profiles[0];
        return {
          ...prev,
          profiles: updatedProf ? prev.profiles.map(p => (p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()) ? updatedProf : p) : prev.profiles,
          history: [...prev.history, ...singleData.history.filter(e => !prev.history.some(h => h.timestamp === e.timestamp))],
          activeRewards: newGami.activeRewards ?? prev.activeRewards,
        };
      });
      await vaultRef.current.writeFile(gamiFile(profileId), serializeGamification(singleData));
    } catch (e) {
      if (__DEV__) console.warn('[completeSagaChapter]', e);
    }
  }, []);

  // ─── Aventure quotidienne ─────────────────────────────────────────────────

  const completeAdventure = useCallback(async (profileId: string, points: number, adventureNote: string) => {
    if (!vaultRef.current) return;
    try {
      const file = gamiFile(profileId);
      const gamiContent = await vaultRef.current.readFile(file).catch(() => '');
      const gami = parseGamification(gamiContent);
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const currentProfiles = mergeProfiles(familleContent, gamiContent);
      const profile = currentProfiles.find((p) => p.id === profileId);
      if (profile) {
        const { profile: updated, entry, activeRewards: updatedRewards } = addPoints(profile, points, adventureNote, gami.activeRewards);
        const newGami = {
          ...gami,
          profiles: gami.profiles.map((p) => (p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()) ? { ...p, points: updated.points, level: updated.level, multiplierRemaining: updated.multiplierRemaining, multiplier: updated.multiplier } : p),
          history: [...gami.history, entry],
          activeRewards: updatedRewards ?? gami.activeRewards,
        };
        const singleData: GamificationData = {
          profiles: newGami.profiles.filter(p => p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()),
          history: newGami.history.filter(e => e.profileId === profileId),
          activeRewards: (newGami.activeRewards ?? []).filter(r => r.profileId === profileId),
          usedLoots: (newGami.usedLoots ?? []).filter(u => u.profileId === profileId),
        };
        // Merge partiel dans le state global
        setGamiData(prev => {
          if (!prev) return prev;
          const updatedProf = singleData.profiles[0];
          return {
            ...prev,
            profiles: updatedProf ? prev.profiles.map(p => (p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()) ? updatedProf : p) : prev.profiles,
            history: [...prev.history, ...singleData.history.filter(e => !prev.history.some(h => h.timestamp === e.timestamp))],
            activeRewards: newGami.activeRewards ?? prev.activeRewards,
          };
        });
        await vaultRef.current.writeFile(file, serializeGamification(singleData));
      }
    } catch {}
  }, []);

  // ─── Compagnon mascotte ───────────────────────────────────────────────────

  /** Persiste les données compagnon dans farm-{profileId}.md */
  const setCompanion = useCallback(async (profileId: string, companion: CompanionData) => {
    if (!vaultRef.current) return;
    try {
      const fp = farmFile(profileId);
      const farmContent = await vaultRef.current.readFile(fp).catch(() => '');
      const farmData = parseFarmProfile(farmContent);
      farmData.companion = companion;
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vaultRef.current.writeFile(fp, serializeFarmProfile(profileName, farmData));
      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, companion } : p
      ));
    } catch (e) {
      if (__DEV__) console.warn('[setCompanion]', e);
    }
  }, [profiles]);

  /** Ajoute une espèce à unlockedSpecies du profil (si compagnon actif et espèce pas encore débloquée) */
  const unlockCompanion = useCallback(async (profileId: string, speciesId: CompanionSpecies) => {
    if (!vaultRef.current) return;
    try {
      const fp = farmFile(profileId);
      const farmContent = await vaultRef.current.readFile(fp).catch(() => '');
      const farmData = parseFarmProfile(farmContent);
      if (!farmData.companion) return;
      if (farmData.companion.unlockedSpecies.includes(speciesId)) return;
      const updatedCompanion: CompanionData = {
        ...farmData.companion,
        unlockedSpecies: [...farmData.companion.unlockedSpecies, speciesId],
      };
      await setCompanion(profileId, updatedCompanion);
    } catch (e) {
      if (__DEV__) console.warn('[unlockCompanion]', e);
    }
  }, [setCompanion]);

  /**
   * Phase 42 — Nourrir le compagnon avec un crop de grade donné.
   *
   * Transaction single-file : companion + harvestInventory vivent dans farm-{id}.md,
   * une seule écriture suffit. Si l'I/O échoue, retour null (fail-open).
   *
   * Note grades : le moteur (companion-engine) utilise les grades EN
   * ('ordinary' | 'good' | 'excellent' | 'perfect'), mais l'inventaire récolte
   * stocke les grades FR ('ordinaire' | 'beau' | 'superbe' | 'parfait'). Un
   * mapping EN→FR est appliqué avant de décrémenter harvestInventory.
   *
   * @returns null si I/O échoue ou profil/compagnon introuvable.
   * @returns FeedResult avec applied=false si cooldown actif (pas d'écriture).
   * @returns FeedResult avec applied=true + updated=nouveau CompanionData si succès.
   */
  const feedCompanion = useCallback(
    async (
      profileId: string,
      cropId: string,
      grade: CompanionHarvestGrade,
    ): Promise<FeedResult | null> => {
      if (!vaultRef.current) return null;
      const profile = profiles.find(p => p.id === profileId);
      if (!profile || !profile.companion) return null;
      // 1. Appliquer le feed pur (cooldown check inclus, aucune mutation)
      const result = feedCompanionEngine(profile.companion, cropId, grade);
      if (!result.applied) return result; // cooldown — UI affiche message, pas d'I/O
      // 2. Lire + mutate farm-{id}.md (companion + harvestInventory) en une seule transaction
      try {
        const fp = farmFile(profileId);
        const farmContent = await vaultRef.current.readFile(fp).catch(() => '');
        const farmData = parseFarmProfile(farmContent);
        // 2a. Mutate companion
        farmData.companion = result.updated;
        // 2b. Décrémenter harvestInventory[cropId][gradeFr] de 1 (pattern inverse L1776-1789)
        const GRADE_EN_TO_FR: Record<CompanionHarvestGrade, FarmHarvestGrade> = {
          ordinary: 'ordinaire',
          good: 'beau',
          excellent: 'superbe',
          perfect: 'parfait',
        };
        const gradeFr = GRADE_EN_TO_FR[grade];
        const harvestInv = { ...(farmData.harvestInventory ?? {}) };
        const existing = harvestInv[cropId];
        if (existing != null && typeof existing === 'object') {
          const currentQty = (existing as Partial<Record<FarmHarvestGrade, number>>)[gradeFr] ?? 0;
          if (currentQty > 0) {
            harvestInv[cropId] = { ...existing, [gradeFr]: currentQty - 1 };
            farmData.harvestInventory = harvestInv;
          }
        } else if (typeof existing === 'number' && gradeFr === 'ordinaire' && existing > 0) {
          // Legacy pré-Phase B — qty numérique traitée comme 'ordinaire'
          harvestInv[cropId] = { ordinaire: existing - 1 };
          farmData.harvestInventory = harvestInv;
        }
        // 3. Écriture unique
        const profileName = profile.name ?? profileId;
        await vaultRef.current.writeFile(fp, serializeFarmProfile(profileName, farmData));
        // 4. Update local state (pattern setCompanion L1868-1870)
        //    On met aussi à jour profile.harvestInventory pour que l'UI reflète le décrément
        //    sans attendre un refresh complet du vault (FeedPicker lit profile.harvestInventory).
        setProfiles(prev => prev.map(p =>
          p.id === profileId
            ? {
                ...p,
                companion: result.updated,
                harvestInventory: farmData.harvestInventory,
              }
            : p,
        ));
        // Phase 42 — Push message contextualisé + Live Activity (fire-and-forget, D-21/D-22/D-24)
        try {
          const cropDef = CROP_CATALOG.find(c => c.id === cropId);
          // labelKey format "farm.crop.carrot" → extrait "carrot" comme fallback label
          const cropLabel = cropDef?.labelKey?.replace(/^farm\.crop\./, '') ?? cropId;
          const msg = buildFeedMessage({
            affinity: result.affinity,
            grade,
            cropLabel,
            cropEmoji: cropDef?.emoji,
          });
          const existing = await loadCompanionMessages(profileId);
          const updatedMsgs = [...existing, {
            text: msg,
            event: `feed_${result.affinity}`,
            timestamp: new Date().toISOString(),
          }].slice(-5);
          await saveCompanionMessages(profileId, updatedMsgs);
        } catch { /* non-critical */ }
        try {
          // Phase 42 — Live Activity : sprite happy temporaire (4s) + buff actif
          // Seul le "preferred" et "neutral" déclenchent happy ; "hated" garde idle
          // (cohérent avec l'anim in-app : scale-pulse pour happy, recul pour beurk)
          const shouldFlashHappy = result.affinity !== 'hated';
          const stage = getCompanionStage(profile.level ?? 1);
          const buffPayload = result.newBuff
            ? { multiplier: result.newBuff.multiplier, expiresAtIso: result.newBuff.expiresAt }
            : null;

          if (shouldFlashHappy) {
            const [happySprite, idleSprite] = await Promise.all([
              loadCompanionSpriteBase64(profile.companion.activeSpecies, stage, 'happy'),
              loadCompanionSpriteBase64(profile.companion.activeSpecies, stage, 'idle'),
            ]);
            // Push sprite happy + buff dès maintenant
            await patchMascotte({
              feedBuffActive: buffPayload,
              ...(happySprite ? { companionSpriteBase64: happySprite } : {}),
            });
            // Revenir au sprite idle après 4s (buff reste affiché via feedBuffActive)
            if (idleSprite) {
              setTimeout(() => {
                patchMascotte({ companionSpriteBase64: idleSprite }).catch(() => {});
              }, 4000);
            }
          } else {
            // Détesté : pas de flash happy, juste le buff nul
            await patchMascotte({ feedBuffActive: buffPayload });
          }
        } catch { /* non-critical */ }
        return result;
      } catch (e) {
        if (__DEV__) console.warn('[feedCompanion]', e);
        return null;
      }
    },
    [profiles],
  );

  const markLootUsed = useCallback(async (loot: UsedLoot) => {
    if (!vaultRef.current || !gamiData) return;
    const updated: GamificationData = {
      ...gamiData,
      usedLoots: [...(gamiData.usedLoots ?? []), loot],
    };
    setGamiData(updated);
    // Écrire uniquement dans le fichier per-profil du propriétaire du loot
    const profileId = loot.profileId;
    const file = gamiFile(profileId);
    const existingContent = await vaultRef.current.readFile(file).catch(() => '');
    const existingGami = parseGamification(existingContent);
    // Même garde que awardProfileXP : ne pas écraser avec profiles vide si lecture échouée
    const existingProfile = existingGami.profiles.find(p => p.id === profileId);
    const safeProfiles = existingProfile
      ? existingGami.profiles
      : gamiData.profiles.filter(p => p.id === profileId);
    const singleData: GamificationData = {
      profiles: safeProfiles,
      history: existingGami.history,
      activeRewards: existingGami.activeRewards ?? [],
      usedLoots: [...(existingGami.usedLoots ?? []), loot],
    };
    await vaultRef.current.writeFile(file, serializeGamification(singleData));
  }, [gamiData]);

  // ─── XP générique (craft village, etc.) ──────────────────────────────────

  const awardProfileXP = useCallback(async (profileId: string, xp: number, note: string) => {
    if (!vaultRef.current || !gamiData) return;
    const profile = gamiData.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    const { profile: updated, entry, activeRewards: updatedRewards } = addPoints(profile, xp, note, gamiData.activeRewards);
    setGamiData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        profiles: prev.profiles.map((p) => p.id === profileId ? updated : p),
        history: [...prev.history, entry],
        activeRewards: updatedRewards ?? prev.activeRewards,
      };
    });
    const file = gamiFile(profileId);
    const existingContent = await vaultRef.current.readFile(file).catch(() => '');
    const existingGami = parseGamification(existingContent);
    // Si le fichier est vide ou illisible (ex: iCloud pas syncé), ne pas écraser avec une liste vide.
    // On part du profil issu de gamiData (déjà en mémoire) pour construire le fichier minimal.
    const existingProfile = existingGami.profiles.find(p => p.id === profileId);
    const safeProfiles = existingProfile
      ? existingGami.profiles.map(p => p.id === profileId ? updated : p)
      : [updated]; // fallback : profil en mémoire si fichier vide
    const singleData: GamificationData = {
      profiles: safeProfiles,
      history: [...existingGami.history, entry],
      activeRewards: updatedRewards ? updatedRewards.filter(r => r.profileId === profileId) : (existingGami.activeRewards ?? []),
      usedLoots: existingGami.usedLoots ?? [],
    };
    await vaultRef.current.writeFile(file, serializeGamification(singleData));
  }, [gamiData]);

  // Mémoïser la valeur du contexte pour éviter les re-renders en cascade
  const vault = vaultRef.current;
  return useMemo(() => ({
    vaultPath,
    isLoading,
    error,
    tasks,
    courses,
    stock,
    meals,
    rdvs,
    profiles,
    activeProfile,
    gamiData,
    notifPrefs,
    vault,
    refresh,
    setVaultPath,
    setActiveProfile: profilesHook.setActiveProfile,
    saveNotifPrefs,
    updateMeal,
    loadMealsForWeek,
    photoDates,
    addPhoto,
    getPhotoUri,
    updateProfileTheme: profilesHook.updateProfileTheme,
    renameGarden: profilesHook.renameGarden,
    updateTreeSpecies: profilesHook.updateTreeSpecies,
    buyMascotItem: profilesHook.buyMascotItem,
    buySporee: profilesHook.buySporee,
    placeMascotItem: profilesHook.placeMascotItem,
    unplaceMascotItem: profilesHook.unplaceMascotItem,
    updateProfile: profilesHook.updateProfile,
    deleteProfile: profilesHook.deleteProfile,
    updateStockQuantity: stockHook.updateStockQuantity,
    addStockItem: stockHook.addStockItem,
    deleteStockItem: stockHook.deleteStockItem,
    updateStockItem: stockHook.updateStockItem,
    stockSections,
    toggleTask: tasksHook.toggleTask,
    skipTask: tasksHook.skipTask,
    subscribeTaskComplete: tasksHook.subscribeTaskComplete,
    liveActivityTaskCompleteRef,
    tasksCompletedToday,
    addRDV,
    updateRDV,
    deleteRDV,
    addTask: tasksHook.addTask,
    editTask: tasksHook.editTask,
    deleteTask: tasksHook.deleteTask,
    addCourseItem: coursesHook.addCourseItem,
    mergeCourseIngredients: coursesHook.mergeCourseIngredients,
    toggleCourseItem: coursesHook.toggleCourseItem,
    removeCourseItem: coursesHook.removeCourseItem,
    moveCourseItem: coursesHook.moveCourseItem,
    clearCompletedCourses: coursesHook.clearCompletedCourses,
    memories,
    addMemory,
    updateMemory,
    vacationConfig,
    vacationTasks,
    isVacationActive,
    activateVacation,
    deactivateVacation,
    refreshGamification: profilesHook.refreshGamification,
    refreshFarm: profilesHook.refreshFarm,
    recipes,
    loadRecipes: recipesHook.loadRecipes,
    addRecipe: recipesHook.addRecipe,
    deleteRecipe: recipesHook.deleteRecipe,
    renameRecipe: recipesHook.renameRecipe,
    saveRecipeImage: recipesHook.saveRecipeImage,
    getRecipeImageUri: recipesHook.getRecipeImageUri,
    scanAllCookFiles: recipesHook.scanAllCookFiles,
    moveCookToRecipes: recipesHook.moveCookToRecipes,
    moveRecipeCategory: recipesHook.moveRecipeCategory,
    toggleFavorite: recipesHook.toggleFavorite,
    isFavorite: recipesHook.isFavorite,
    getFavorites: recipesHook.getFavorites,
    ageUpgrades,
    applyAgeUpgrade: profilesHook.applyAgeUpgrade,
    dismissAgeUpgrade: profilesHook.dismissAgeUpgrade,
    addChild: profilesHook.addChild,
    convertToBorn: profilesHook.convertToBorn,
    ...budgetState,
    routines,
    saveRoutines,
    healthRecords,
    saveHealthRecord: healthHook.saveHealthRecord,
    addGrowthEntry: healthHook.addGrowthEntry,
    updateGrowthEntry: healthHook.updateGrowthEntry,
    deleteGrowthEntry: healthHook.deleteGrowthEntry,
    addVaccineEntry: healthHook.addVaccineEntry,
    defis,
    createDefi: defisHook.createDefi,
    checkInDefi: defisHook.checkInDefi,
    completeDefi: defisHook.completeDefi,
    deleteDefi: defisHook.deleteDefi,
    familyQuests: questsHook.familyQuests,
    unlockedRecipes: questsHook.unlockedRecipes,
    startFamilyQuest: questsHook.startQuest,
    contributeFamilyQuest: questsHook.contribute,
    completeFamilyQuest: questsHook.completeQuest,
    deleteFamilyQuest: questsHook.deleteQuest,
    gratitudeDays,
    addGratitudeEntry,
    deleteGratitudeEntry,
    wishlistItems,
    addWishItem,
    updateWishItem,
    deleteWishItem,
    toggleWishBought,
    journalStats,
    anniversaries,
    addAnniversary,
    updateAnniversary,
    removeAnniversary,
    importAnniversaries,
    notes: notesHook.notes,
    addNote: notesHook.addNote,
    updateNote: notesHook.updateNote,
    deleteNote: notesHook.deleteNote,
    quotes,
    addQuote,
    editQuote,
    deleteQuote,
    moods,
    addMood,
    deleteMood,
    skillTrees,
    unlockSkill,
    secretMissions,
    addSecretMission: missionsHook.addSecretMission,
    completeSecretMission: missionsHook.completeSecretMission,
    validateSecretMission: missionsHook.validateSecretMission,
    completeAdventure,
    completeSagaChapter,
    markLootUsed,
    awardProfileXP,
    setCompanion,
    unlockCompanion,
    feedCompanion,
    dietary: dietaryHook,
    gardenRaw,
    setGardenRaw,
    loveNotes: loveNotesHook.loveNotes,
    addLoveNote: loveNotesHook.addLoveNote,
    updateLoveNoteStatus: loveNotesHook.updateLoveNoteStatus,
    deleteLoveNote: loveNotesHook.deleteLoveNote,
    stories: storiesHook.stories,
    saveStory: storiesHook.saveStory,
    deleteStory: storiesHook.deleteStory,
  }), [
    // State values (déclenchent un re-render quand ils changent)
    vaultPath, isLoading, error, tasks, courses, stock, meals,
    rdvs, profiles, activeProfile, gamiData, notifPrefs, vault, photoDates,
    stockSections, memories, vacationConfig, vacationTasks, isVacationActive,
    recipes, ageUpgrades, budgetState, routines,
    healthRecords, defis, questsHook.familyQuests, questsHook.unlockedRecipes, gratitudeDays, wishlistItems, journalStats, anniversaries,
    notesHook.notes,
    quotes, moods, skillTrees, secretMissions, gardenRaw, storiesHook.stories, loveNotesHook.loveNotes,
    // Callbacks (stables grâce à useCallback)
    refresh, setVaultPath, saveNotifPrefs, updateMeal, loadMealsForWeek,
    addPhoto, getPhotoUri,
    stockHook, coursesHook, tasksHook, recipesHook, defisHook, questsHook, profilesHook,
    addRDV, updateRDV, deleteRDV,
    addMemory, updateMemory, activateVacation,
    deactivateVacation,
    saveRoutines, healthHook,
    addGratitudeEntry, deleteGratitudeEntry,
    addWishItem, updateWishItem, deleteWishItem, toggleWishBought,
    addAnniversary, updateAnniversary, removeAnniversary, importAnniversaries,
    notesHook.addNote, notesHook.updateNote, notesHook.deleteNote,
    addQuote, editQuote, deleteQuote, addMood, deleteMood, unlockSkill,
    missionsHook,
    completeAdventure, completeSagaChapter, markLootUsed, awardProfileXP,
    setCompanion, unlockCompanion, feedCompanion,
    dietaryHook,
    storiesHook,
    loveNotesHook,
  ]);
}
