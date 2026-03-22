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
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { VaultManager } from '../lib/vault';
import { restoreAccess } from '../modules/vault-access/src';
import {
  parseTaskFile,
  parseRoutines,
  serializeRoutines,
  parseHealthRecord,
  serializeHealthRecord,
  parseCourses,
  parseMeals,
  parseRDV,
  parseStock,
  serializeStockRow,
  parseStockSections,
  serializeRDV,
  rdvFileName,
  parseJalons,
  insertJalonInContent,
  updateJalonInContent,
  mergeProfiles,
  parseGamification,
  parseFamille,
  serializeGamification,
  formatMealLine,
  parseDefis,
  serializeDefis,
  GRATITUDE_FILE,
  parseGratitude,
  serializeGratitude,
  WISHLIST_FILE,
  parseWishlist,
  serializeWishlist,
  ANNIVERSAIRES_FILE,
  parseAnniversaries,
  serializeAnniversaries,
  NOTES_DIR,
  parseNote,
  serializeNote,
  noteFileName,
  noteCategoryLabel,
  SKILLS_DIR,
  parseSkillTree,
  serializeSkillTree,
  QUOTES_FILE,
  parseQuotes,
  serializeQuotes,
  MOODS_FILE,
  parseMoods,
  serializeMoods,
  SECRET_MISSIONS_FILE,
  parseSecretMissions,
  serializeSecretMissions,
} from '../lib/parser';
import { processActiveRewards, addPoints } from '../lib/gamification';
import { XP_PER_BRACKET, getSkillById } from '../lib/gamification/skill-tree';
import { Task, RDV, CourseItem, MealItem, StockItem, Profile, Gender, GamificationData, NotificationPreferences, ProfileTheme, Memory, VacationConfig, Recipe, AgeUpgrade, AgeCategory, BudgetEntry, BudgetConfig, Routine, HealthRecord, GrowthEntry, VaccineEntry, Defi, DefiDayEntry, GratitudeDay, WishlistItem, WishBudget, WishOccasion, Anniversary, Note, SkillTreeData, ChildQuote, MoodEntry, MoodLevel } from '../lib/types';
import {
  parseBudgetConfig,
  parseBudgetMonth,
  serializeBudgetMonth,
  serializeBudgetConfig,
  DEFAULT_BUDGET_CONFIG,
} from '../lib/budget';
import { parseRecipe, generateCookFile } from '../lib/cooklang';
import {
  parseNotificationPrefs,
  serializeNotificationPrefs,
  getDefaultNotificationPrefs,
} from '../lib/notifications';
import { setupAllNotifications, loadNotifConfig, scheduleRDVAlerts } from '../lib/scheduled-notifications';
import { generateThumbnail } from '../lib/thumbnails';
import { nextOccurrence } from '../lib/recurrence';
import { format, startOfWeek } from 'date-fns';
import { parseJournalStats } from '../lib/journal-stats';
import type { JournalSummaryEntry } from '../lib/ai-service';
import { refreshWidget, refreshJournalWidget } from '../lib/widget-bridge';
import { syncWidgetFeedingsToVault } from '../lib/widget-sync';
import { shouldSendWeeklySummary, buildAndSendWeeklySummary } from '../lib/telegram';
import { buildSectionHeader, type EmplacementId } from '../constants/stock';

export const VAULT_PATH_KEY = 'vault_path';
export const ACTIVE_PROFILE_KEY = 'active_profile_id';

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
  updateProfile: (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender }) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  updateStockQuantity: (lineIndex: number, newQuantity: number) => Promise<void>;
  addStockItem: (item: Omit<StockItem, 'lineIndex'>) => Promise<void>;
  deleteStockItem: (lineIndex: number) => Promise<void>;
  updateStockItem: (lineIndex: number, updates: Partial<StockItem>) => Promise<void>;
  stockSections: string[];
  toggleTask: (task: Task, completed: boolean) => Promise<void>;
  addRDV: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  updateRDV: (sourceFile: string, rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  deleteRDV: (sourceFile: string) => Promise<void>;
  addTask: (text: string, targetFile: string, dueDate?: string, recurrence?: string, sectionOverride?: string) => Promise<void>;
  editTask: (task: Task, updates: { text?: string; dueDate?: string; recurrence?: string; targetFile?: string }) => Promise<void>;
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
  recipes: Recipe[];
  loadRecipes: (force?: boolean) => Promise<void>;
  addRecipe: (category: string, data: { title: string; tags?: string[]; servings?: number; prepTime?: string; cookTime?: string; ingredients: { name: string; quantity?: string; unit?: string }[]; steps: string[] }) => Promise<void>;
  deleteRecipe: (sourceFile: string) => Promise<void>;
  renameRecipe: (sourceFile: string, newTitle: string) => Promise<void>;
  /** Scan tout le vault pour des .cook en dehors de 03 - Cuisine/Recettes/ */
  scanAllCookFiles: () => Promise<{ path: string; title: string }[]>;
  /** Déplacer un .cook vers le dossier Recettes */
  moveCookToRecipes: (sourcePath: string, category: string) => Promise<void>;
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
  gratitudeDays: GratitudeDay[];
  addGratitudeEntry: (date: string, profileId: string, profileName: string, text: string) => Promise<void>;
  deleteGratitudeEntry: (date: string, profileId: string) => Promise<void>;
  wishlistItems: WishlistItem[];
  addWishItem: (text: string, profileName: string, budget?: WishBudget, occasion?: WishOccasion, notes?: string) => Promise<void>;
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
}

// Static task files (non-enfant)
const STATIC_TASK_FILES = [
  '02 - Maison/Tâches récurrentes.md',
];

const COURSES_FILE = '02 - Maison/Liste de courses.md';
const RDV_DIR = '04 - Rendez-vous';
const RDV_ARCHIVES_DIR = 'Archives/Rendez-vous';
const FAMILLE_FILE = 'famille.md';
const GAMI_FILE = 'gamification.md';
const MEALS_DIR = '02 - Maison';
/** Retourne le chemin du fichier repas pour la semaine contenant `date` (lundi = début de semaine) */
function mealsFileForWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=dimanche
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  const monday = new Date(d);
  monday.setDate(diff);
  const iso = format(monday, 'yyyy-MM-dd');
  return `${MEALS_DIR}/Repas semaine du ${iso}.md`;
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
const PHOTOS_DIR = '07 - Photos';
const MEMOIRES_DIR = '06 - Mémoires';
const NOTIF_FILE = 'notifications.md';
const RECIPES_DIR = '03 - Cuisine/Recettes';
const VACATION_FILE = '02 - Maison/Vacances.md';
const BUDGET_DIR = '05 - Budget';
const BUDGET_CONFIG_FILE = '05 - Budget/config.md';
const ROUTINES_FILE = '02 - Maison/Routines.md';
const DEFIS_FILE = 'defis.md';
const HEALTH_DIR = '01 - Enfants';
const VACATION_STORE_KEY = 'vacation_mode';
const VACATION_TEMPLATE = `# Checklist Vacances

## Avant le départ

### Documents
- [ ] Vérifier passeports (dates de validité)
- [ ] Carte d'identité à jour
- [ ] Carte européenne d'assurance maladie
- [ ] Ordonnances médicaments
- [ ] Confirmation réservation (hôtel / location)
- [ ] Billets de transport (avion / train)
- [ ] Assurance voyage

### Santé
- [ ] Trousse à pharmacie (doliprane, pansements, thermomètre)
- [ ] Crème solaire
- [ ] Médicaments habituels
- [ ] Carnet de santé des enfants

### Valises
- [ ] Vêtements enfants (prévoir 1 tenue/jour + 2 extras)
- [ ] Vêtements adultes
- [ ] Pyjamas
- [ ] Maillots de bain
- [ ] Chaussures confortables
- [ ] Vestes / pulls (soirées fraîches)

### Bébé / Jeunes enfants
- [ ] Couches en quantité suffisante
- [ ] Lait / biberons
- [ ] Petits pots / compotes
- [ ] Doudou + tétine de rechange
- [ ] Poussette / porte-bébé
- [ ] Lit parapluie

### Maison
- [ ] Couper l'eau (si absence longue)
- [ ] Baisser le chauffage / clim
- [ ] Vider le frigo (périssables)
- [ ] Sortir les poubelles
- [ ] Arrosage plantes (demander au voisin ?)
- [ ] Fermer volets et vérifier serrures
- [ ] Débrancher appareils électriques

### Divers
- [ ] Charger les appareils (téléphone, tablette, appareil photo)
- [ ] Télécharger films / jeux pour le trajet
- [ ] Snacks pour la route
- [ ] GPS / itinéraire vérifié
- [ ] Prévenir la nounou / école / crèche

## Retour de vacances
- [ ] Lancer une machine de linge
- [ ] Faire les courses de base
- [ ] Relever le courrier
- [ ] Remettre le chauffage / clim
- [ ] Déballer et ranger les valises
`;

// --- Migration ménage hebdo → tâches récurrentes (one-time, idempotente) ---
const MENAGE_FILE = '02 - Maison/Ménage hebdo.md';
const TACHES_RECURRENTES_FILE = '02 - Maison/Tâches récurrentes.md';

const DAY_MAP: Record<string, number> = {
  'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4,
  'vendredi': 5, 'samedi': 6, 'dimanche': 0,
};

/** Calcule la prochaine occurrence d'un jour de la semaine (jamais aujourd'hui) */
function nextWeekday(targetDay: number): string {
  const today = new Date();
  const todayDay = today.getDay();
  const diff = (targetDay - todayDay + 7) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  return format(next, 'yyyy-MM-dd');
}

async function migrateMenageToTasks(vault: VaultManager): Promise<{ migrated: number; skipped: number }> {
  // Vérifier si le fichier ménage existe
  if (!(await vault.exists(MENAGE_FILE))) {
    return { migrated: 0, skipped: 0 };
  }

  // Vérifier idempotence : si la section existe déjà, on skip
  let tachesContent = '';
  try {
    tachesContent = await vault.readFile(TACHES_RECURRENTES_FILE);
  } catch {
    // Le fichier n'existe pas encore, on le créera
  }
  if (tachesContent.includes('## Ménage hebdomadaire')) {
    return { migrated: 0, skipped: 0 };
  }

  // Lire et parser le fichier ménage
  const menageContent = await vault.readFile(MENAGE_FILE);
  const lines = menageContent.split('\n');

  let migrated = 0;
  let skipped = 0;
  let currentDay: string | null = null;
  let currentDayNum: number | null = null;
  const sections: { header: string; tasks: string[] }[] = [];
  let currentSection: { header: string; tasks: string[] } | null = null;

  for (const line of lines) {
    // Détecter les sections ## Lundi — ..., ## Mardi — ..., etc.
    const sectionMatch = line.match(/^##\s+(\w+)/);
    if (sectionMatch) {
      const dayName = sectionMatch[1].toLowerCase();
      if (dayName in DAY_MAP) {
        currentDay = dayName;
        currentDayNum = DAY_MAP[dayName];
        currentSection = { header: line.replace(/^##/, '###'), tasks: [] };
        sections.push(currentSection);
        continue;
      }
    }

    // Détecter les tâches (cochées ou non)
    const taskMatch = line.match(/^- \[[ xX]\]\s+(.+)/);
    if (taskMatch && currentDayNum !== null && currentSection) {
      // Nettoyer : retirer ✅ et date de complétion
      let taskText = taskMatch[1]
        .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '')
        .replace(/\s*✅/, '')
        .trim();

      if (!taskText) {
        skipped++;
        continue;
      }

      const nextDate = nextWeekday(currentDayNum);
      currentSection.tasks.push(`- [ ] ${taskText} 🔁 every week 📅 ${nextDate}`);
      migrated++;
    }
  }

  if (migrated === 0) {
    return { migrated: 0, skipped };
  }

  // Construire la nouvelle section
  const newSection = ['', '## Ménage hebdomadaire', ''];
  for (const section of sections) {
    if (section.tasks.length > 0) {
      newSection.push(section.header);
      newSection.push(...section.tasks);
      newSection.push('');
    }
  }

  // Ajouter à la fin du fichier tâches récurrentes
  const updatedContent = tachesContent.trimEnd() + '\n' + newSection.join('\n');
  await vault.writeFile(TACHES_RECURRENTES_FILE, updatedContent);

  return { migrated, skipped };
}

export function useVaultInternal(): VaultState {
  const [vaultPath, setVaultPathState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [rdvs, setRdvs] = useState<RDV[]>([]);

  // Refs pour le widget (accès à jour dans les useCallback sans dépendances)
  const mealsRef = useRef(meals);
  const rdvsRef = useRef(rdvs);
  const tasksRef = useRef(tasks);
  useEffect(() => { mealsRef.current = meals; }, [meals]);
  useEffect(() => { rdvsRef.current = rdvs; }, [rdvs]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const triggerWidgetRefresh = useCallback(() => {
    refreshWidget(mealsRef.current, rdvsRef.current, tasksRef.current);
  }, []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [gamiData, setGamiData] = useState<GamificationData | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotificationPrefs());
  const [photoDates, setPhotoDates] = useState<Record<string, string[]>>({});
  const [stockSections, setStockSections] = useState<string[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [vacationConfig, setVacationConfig] = useState<VacationConfig | null>(null);
  const [vacationTasks, setVacationTasks] = useState<Task[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeFavorites, setRecipeFavorites] = useState<Record<string, string[]>>({});
  const [ageUpgrades, setAgeUpgrades] = useState<AgeUpgrade[]>([]);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>(DEFAULT_BUDGET_CONFIG);
  const [budgetMonth, setBudgetMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [journalStats, setJournalStats] = useState<JournalSummaryEntry[]>([]);
  const [defis, setDefis] = useState<Defi[]>([]);
  const [gratitudeDays, setGratitudeDays] = useState<GratitudeDay[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quotes, setQuotes] = useState<ChildQuote[]>([]);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [skillTrees, setSkillTrees] = useState<SkillTreeData[]>([]);
  const [secretMissions, setSecretMissions] = useState<Task[]>([]);
  const vaultRef = useRef<VaultManager | null>(null);
  const busyRef = useRef(false); // Guard against AppState race condition

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
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && vaultRef.current) {
        // Delay reload to let pending operations (addPhoto etc.) finish first
        setTimeout(() => {
          if (!busyRef.current && vaultRef.current) {
            loadVaultData(vaultRef.current);
          }
        }, 1000);
      }
    });
    return () => sub.remove();
  }, []);

  const loadVaultData = useCallback(async (vault: VaultManager) => {
    setError(null);
    const debugErrors: string[] = [];

    try {
      // Migration ménage → tâches récurrentes (one-time, idempotente)
      try {
        await migrateMenageToTasks(vault);
      } catch { /* migration optionnelle, on ignore les erreurs */ }

      // Load profiles first (needed for dynamic task file paths)
      let familleContent = '';
      let gamiContent = '';
      let enfantNames: string[] = [];
      try {
        familleContent = await vault.readFile(FAMILLE_FILE);
        gamiContent = await vault.readFile(GAMI_FILE);
        const baseProfiles = parseFamille(familleContent);
        enfantNames = baseProfiles.filter((p) => p.role === 'enfant').map((p) => p.name);
        const merged = mergeProfiles(familleContent, gamiContent);
        setProfiles(merged);
        const gami = parseGamification(gamiContent);

        // Clean up expired active rewards
        if (gami.activeRewards?.length > 0) {
          const cleaned = processActiveRewards(gami.activeRewards);
          if (cleaned.length !== gami.activeRewards.length) {
            const updatedGami = { ...gami, activeRewards: cleaned };
            await vault.writeFile(GAMI_FILE, serializeGamification(updatedGami));
            setGamiData(updatedGami);
          } else {
            setGamiData(gami);
          }
        } else {
          setGamiData(gami);
        }
        // Detect age category upgrades
        const upgrades: AgeUpgrade[] = [];
        for (const p of merged) {
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
        vault.readFile(ROUTINES_FILE).then((c) => parseRoutines(c)).catch((e) => {
          debugErrors.push(`routines: ${e}`); return [] as any[];
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
            if (d.status === 'active' && d.endDate < todayStr) {
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
                const gamiStr = serializeGamification(gami);
                await vault.writeFile(GAMI_FILE, gamiStr);
                setProfiles(mergeProfiles(familleContent, gamiStr));
                setGamiData(gami);
              } catch (e) { warnUnexpected('defis-gamification', e); }
            }
          }
          return parsed;
        })().catch(() => [] as any[]),

        // [11] Gratitude
        vault.readFile(GRATITUDE_FILE).then((c) => parseGratitude(c)).catch(() => [] as any[]),

        // [12] Wishlist
        vault.readFile(WISHLIST_FILE).then((c) => parseWishlist(c)).catch(() => [] as any[]),

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
        (async () => {
          await vault.ensureDir(NOTES_DIR);
          const files = await vault.listFilesRecursive(NOTES_DIR, '.md');
          const noteResults = await Promise.all(
            files.map(async (file) => {
              try {
                const content = await vault.readFile(file);
                return parseNote(file, content);
              } catch (e) { warnUnexpected(`note(${file})`, e); return null; }
            })
          );
          const loaded = noteResults.filter((n): n is Note => n !== null);
          loaded.sort((a, b) => b.created.localeCompare(a.created));
          return loaded;
        })().catch(() => [] as Note[]),

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
      ]);

      // Apply results — use helper to extract settled values
      const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === 'fulfilled' ? r.value : fallback;

      const tasksResult = val(results[0], [] as Task[]);
      setTasks(tasksResult);
      setRoutines(val(results[1], []));
      setCourses(val(results[2], []));
      const stockResult = val(results[3], { items: [] as StockItem[], sections: [] as string[] });
      setStock(stockResult.items);
      setStockSections(stockResult.sections);
      setMeals(val(results[4], []));
      const rdvResult = val(results[5], [] as RDV[]);
      setRdvs(rdvResult);
      // Planifier toutes les notifications locales
      setupAllNotifications({
        rdvs: rdvResult,
        tasks: tasksResult,
        stock: stockResult.items,
        hasGrossesse: profiles.some(p => p.statut === 'grossesse' && p.dateTerme),
      }).catch(() => {});
      setPhotoDates(val(results[6], {}));
      setMemories(val(results[7], []));
      setHealthRecords(val(results[8], []));
      setJournalStats(val(results[9], []));
      setDefis(val(results[10], []));
      setGratitudeDays(val(results[11], []));
      setWishlistItems(val(results[12], []));
      setAnniversaries(val(results[13], []));
      setNotifPrefs(val(results[14], getDefaultNotificationPrefs()));
      const vacResult = val(results[15], { config: null as VacationConfig | null, vacTasks: [] as Task[] });
      setVacationConfig(vacResult.config);
      setVacationTasks(vacResult.vacTasks);
      setNotes(val(results[16], []));
      setQuotes(val(results[17], []));
      setMoods(val(results[18], []));
      setSkillTrees(val(results[19], []));
      setSecretMissions(val(results[20], []));

      // Mettre à jour les widgets iOS
      refreshWidget(val(results[4], []), rdvResult, tasksResult);
      refreshJournalWidget(profiles);

      // Sync feedings du widget vers le vault markdown (fire-and-forget)
      syncWidgetFeedingsToVault(vault).catch(() => {});

      // Auto-envoi bilan de semaine IA le dimanche (fire-and-forget)
      loadNotifConfig().then(async (notifCfg) => {
        if (!notifCfg.weeklyAISummaryEnabled) return;
        const shouldSend = await shouldSendWeeklySummary();
        if (!shouldSend) return;
        buildAndSendWeeklySummary({
          tasks: tasksResult,
          meals: val(results[4], [] as MealItem[]),
          moods: val(results[18], [] as MoodEntry[]),
          quotes: val(results[17], [] as ChildQuote[]),
          defis: val(results[10], [] as Defi[]),
          profiles,
          stock: stockResult.items,
        }).catch(() => {});
      }).catch(() => {});

    } catch (e) {
      debugErrors.push(`global: ${e}`);
    }

    if (debugErrors.length > 0) {
      setError(debugErrors.join('\n'));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!vaultRef.current) return;
    setIsLoading(true);
    await loadVaultData(vaultRef.current);
    setIsLoading(false);
  }, [loadVaultData]);

  const setVaultPath = useCallback(async (path: string) => {
    await SecureStore.setItemAsync(VAULT_PATH_KEY, path);
    // Reset all state before loading new vault to avoid stale data
    setProfiles([]);
    setGamiData(null);
    setTasks([]);
    setCourses([]);
    setStock([]);
    setStockSections([]);
    setMeals([]);
    setRdvs([]);
    setPhotoDates({});
    setMemories([]);
    setRecipes([]);
    recipesLoadedRef.current = false;
    setBudgetEntries([]);
    setBudgetConfig(DEFAULT_BUDGET_CONFIG);
    setVaultPathState(path);
    const vault = new VaultManager(path);
    vaultRef.current = vault;
    setIsLoading(true);
    await loadVaultData(vault);
    setIsLoading(false);
  }, [loadVaultData]);

  // Lazy-load recettes (appelé quand on accède à l'écran recettes/meals)
  const recipesLoadedRef = useRef(false);
  const loadRecipes = useCallback(async (force?: boolean) => {
    if (!vaultRef.current || (!force && recipesLoadedRef.current)) return;
    recipesLoadedRef.current = true;
    try {
      const cookFiles = await vaultRef.current.listFilesRecursive(RECIPES_DIR, '.cook');
      const results = await Promise.all(cookFiles.map(async (relPath) => {
        try {
          const content = await vaultRef.current!.readFile(relPath);
          return parseRecipe(relPath, content);
        } catch (e) { warnUnexpected('recipe-read', e); return null; }
      }));
      const loaded = results.filter((r): r is Recipe => r !== null);
      loaded.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      setRecipes(loaded);
    } catch (e) { warnUnexpected('loadRecipes', e);
      setRecipes([]);
    }
  }, []);

  const setActiveProfile = useCallback(async (profileId: string) => {
    await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, profileId);
    setActiveProfileId(profileId);
  }, []);

  const saveNotifPrefs = useCallback(async (prefs: NotificationPreferences) => {
    if (!vaultRef.current) return;
    setNotifPrefs(prefs);
    await vaultRef.current.writeFile(NOTIF_FILE, serializeNotificationPrefs(prefs));
  }, []);

  const updateMeal = useCallback(async (day: string, mealType: string, text: string, recipeRef?: string, weekDate?: Date) => {
    if (!vaultRef.current) return;
    try {
      const file = mealsFileForWeek(weekDate);
      // Créer le fichier s'il n'existe pas (semaine future)
      if (!(await vaultRef.current.exists(file))) {
        await vaultRef.current.writeFile(file, MEALS_TEMPLATE);
      }
      const content = await vaultRef.current.readFile(file);
      const lines = content.split('\n');
      let currentDay: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) {
          currentDay = lines[i].replace('## ', '').trim();
        }
        if (currentDay === day) {
          const match = lines[i].match(/^-\s+(.+?):\s*(.*)$/);
          if (match && match[1].trim() === mealType) {
            lines[i] = formatMealLine(mealType, text, recipeRef);
            break;
          }
        }
      }

      await vaultRef.current.writeFile(file, lines.join('\n'));
      // Ne mettre à jour l'état global que pour la semaine courante
      if (!weekDate || mealsFileForWeek() === file) {
        setMeals(parseMeals(lines.join('\n'), file));
        setTimeout(triggerWidgetRefresh, 0);
      }
    } catch (e) {
      throw new Error(`updateMeal: ${e}`);
    }
  }, [triggerWidgetRefresh]);

  const loadMealsForWeek = useCallback(async (date: Date): Promise<MealItem[]> => {
    if (!vaultRef.current) return [];
    const file = mealsFileForWeek(date);
    try {
      const isFuture = date > new Date();
      if (!(await vaultRef.current.exists(file))) {
        if (isFuture) {
          // Créer le fichier template pour les semaines futures (éditable)
          await vaultRef.current.writeFile(file, MEALS_TEMPLATE);
        } else {
          return [];
        }
      }
      const c = await vaultRef.current.readFile(file);
      return parseMeals(c, file);
    } catch {
      return [];
    }
  }, []);

  const addPhoto = useCallback(async (enfantName: string, date: string, imageUri: string) => {
    if (!vaultRef.current) throw new Error('Vault non initialisé');
    busyRef.current = true; // Block AppState reload while saving
    try {
      const relativePath = `${PHOTOS_DIR}/${enfantName}/${date}.jpg`;
      // copyFileToVault verifies the copy succeeded internally
      await vaultRef.current.copyFileToVault(imageUri, relativePath);

      // Update local state optimistically
      const id = enfantName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      setPhotoDates((prev) => {
        const existing = prev[id] ?? [];
        if (existing.includes(date)) return prev;
        return { ...prev, [id]: [...existing, date].sort() };
      });

      // Générer la miniature en arrière-plan (ne bloque pas l'UI)
      const photoUri = vaultRef.current.getPhotoUri(enfantName, date);
      if (photoUri) {
        generateThumbnail(photoUri, enfantName, date).catch(() => {
          // Silencieux — fallback vers la photo originale
        });
      }
    } finally {
      busyRef.current = false;
    }
  }, []);

  const getPhotoUri = useCallback((enfantName: string, date: string): string | null => {
    if (!vaultRef.current) return null;
    return vaultRef.current.getPhotoUri(enfantName, date);
  }, []);

  const updateProfileTheme = useCallback(async (profileId: string, theme: ProfileTheme) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(FAMILLE_FILE);
      const lines = content.split('\n');
      let inSection = false;
      let themeLineIdx = -1;
      let lastPropIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ')) {
          if (inSection) break; // hit next section, stop
          if (lines[i].replace('### ', '').trim() === profileId) {
            inSection = true;
          }
        } else if (inSection && lines[i].includes(': ')) {
          lastPropIdx = i;
          if (lines[i].trim().startsWith('theme:')) {
            themeLineIdx = i;
          }
        }
      }

      if (themeLineIdx >= 0) {
        lines[themeLineIdx] = `theme: ${theme}`;
      } else if (lastPropIdx >= 0) {
        lines.splice(lastPropIdx + 1, 0, `theme: ${theme}`);
      }

      await vaultRef.current.writeFile(FAMILLE_FILE, lines.join('\n'));

      // Update local profile state
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, theme } : p))
      );
    } catch (e) {
      throw new Error(`updateProfileTheme: ${e}`);
    }
  }, []);

  const updateProfile = useCallback(async (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender }) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(FAMILLE_FILE);
      const lines = content.split('\n');
      let inSection = false;
      let sectionStart = -1;
      let sectionEnd = lines.length;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ')) {
          if (inSection) { sectionEnd = i; break; }
          if (lines[i].replace('### ', '').trim() === profileId) {
            inSection = true;
            sectionStart = i;
          }
        }
      }

      if (sectionStart === -1) return;

      // Update each field in the section
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        let found = false;
        for (let i = sectionStart + 1; i < sectionEnd; i++) {
          if (lines[i].trim().startsWith(`${key}:`)) {
            lines[i] = `${key}: ${value}`;
            found = true;
            break;
          }
        }
        if (!found) {
          // Insert after the last property line in the section
          let lastProp = sectionStart;
          for (let i = sectionStart + 1; i < sectionEnd; i++) {
            if (lines[i].includes(': ')) lastProp = i;
          }
          lines.splice(lastProp + 1, 0, `${key}: ${value}`);
          sectionEnd++;
        }
      }

      const newFamilleContent = lines.join('\n');
      await vaultRef.current.writeFile(FAMILLE_FILE, newFamilleContent);

      // Mise à jour optimiste du state local
      try {
        const gamiContent = await vaultRef.current.readFile(GAMI_FILE);
        setProfiles(mergeProfiles(newFamilleContent, gamiContent));
      } catch (e) {
        warnUnexpected('updateProfile-optimistic', e);
        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...updates } : p));
      }
    } catch (e) {
      throw new Error(`updateProfile: ${e}`);
    }
  }, []);

  const deleteProfile = useCallback(async (profileId: string) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(FAMILLE_FILE);
      const lines = content.split('\n');
      let sectionStart = -1;
      let sectionEnd = lines.length;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ')) {
          if (sectionStart >= 0) { sectionEnd = i; break; }
          if (lines[i].replace('### ', '').trim() === profileId) {
            sectionStart = i;
          }
        }
      }

      if (sectionStart === -1) return;

      // Supprimer les lignes du profil
      lines.splice(sectionStart, sectionEnd - sectionStart);
      // Nettoyer les lignes vides consécutives
      const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n');
      await vaultRef.current.writeFile(FAMILLE_FILE, cleaned);

      // Mise à jour optimiste du state local
      setProfiles(prev => prev.filter(p => p.id !== profileId));
    } catch (e) {
      throw new Error(`deleteProfile: ${e}`);
    }
  }, []);

  const updateStockQuantity = useCallback(async (lineIndex: number, newQuantity: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const line = lines[lineIndex];
      // Utiliser slice(1,-1) pour garder les cellules vides à leur position
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 4) return;

      // cells[0]=produit, cells[1]=detail, cells[2]=quantite, cells[3]=seuil, cells[4]=qteAchat
      const qty = Math.max(0, newQuantity);
      // Retrouver l'emplacement depuis l'état local pour le préserver
      const existingItem = stock.find(s => s.lineIndex === lineIndex);
      const updated: Omit<StockItem, 'lineIndex'> = {
        produit: cells[0],
        detail: cells[1] || undefined,
        quantite: qty,
        seuil: parseInt(cells[3], 10) || 0,
        qteAchat: cells[4] ? parseInt(cells[4], 10) || 1 : 1,
        emplacement: existingItem?.emplacement ?? 'bebe',
        section: existingItem?.section,
      };
      lines[lineIndex] = serializeStockRow(updated);
      await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

      // Mise à jour locale immédiate
      setStock((prev) =>
        prev.map((s) => s.lineIndex === lineIndex ? { ...s, quantite: Math.max(0, newQuantity) } : s)
      );
    } catch (e) {
      throw new Error(`updateStockQuantity: ${e}`);
    }
  }, [stock]);

  const addStockItem = useCallback(async (item: Omit<StockItem, 'lineIndex'>) => {
    if (!vaultRef.current) return;
    try {
      let content: string;
      try {
        content = await vaultRef.current.readFile(STOCK_FILE);
      } catch (e) {
        warnUnexpected('addStockItem-read', e);
        content = '# Stock & fournitures\n';
        await vaultRef.current.writeFile(STOCK_FILE, content);
      }
      const lines = content.split('\n');
      const newRow = serializeStockRow(item);

      // Construire le header de section depuis emplacement + sous-catégorie
      const sectionHeader = buildSectionHeader(
        (item.emplacement || 'bebe') as EmplacementId,
        item.section,
      );

      // Trouver le point d'insertion : dernière ligne de table dans la section cible
      let insertIdx = -1;
      let inSection = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) {
          if (inSection) break; // section suivante atteinte
          if (lines[i].slice(3).trim() === sectionHeader) inSection = true;
        }
        if (inSection && lines[i].startsWith('|') && !lines[i].includes('---')) {
          insertIdx = i;
        }
      }

      if (insertIdx === -1) {
        // Section inexistante → la créer en fin de fichier
        const tableHeader = [
          '',
          `## ${sectionHeader}`,
          '| Produit | Détail | Quantité | Seuil alerte | Qté/achat |',
          '| --- | --- | --- | --- | --- |',
          newRow,
        ];
        lines.push(...tableHeader);
      } else {
        lines.splice(insertIdx + 1, 0, newRow);
      }

      const newContent = lines.join('\n');
      await vaultRef.current.writeFile(STOCK_FILE, newContent);
      // Re-parser le fichier localement pour recalculer les lineIndex
      setStock(parseStock(newContent));
      setStockSections(parseStockSections(newContent));
    } catch (e) {
      throw new Error(`addStockItem: ${e}`);
    }
  }, []);

  const deleteStockItem = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines.splice(lineIndex, 1);
        const newContent = lines.join('\n');
        await vaultRef.current.writeFile(STOCK_FILE, newContent);
        // Re-parser le fichier localement pour recalculer les lineIndex
        setStock(parseStock(newContent));
        setStockSections(parseStockSections(newContent));
      }
    } catch (e) {
      throw new Error(`deleteStockItem: ${e}`);
    }
  }, []);

  const updateStockItem = useCallback(async (lineIndex: number, updates: Partial<StockItem>) => {
    if (!vaultRef.current) return;
    try {
      // Retrouver l'emplacement/section actuels depuis l'état local
      const existingItem = stock.find(s => s.lineIndex === lineIndex);
      const oldEmplacement = existingItem?.emplacement ?? 'bebe';
      const oldSection = existingItem?.section;
      const newEmplacement = updates.emplacement ?? oldEmplacement;
      const newSection = updates.section !== undefined ? updates.section : oldSection;

      // Si l'emplacement ou la section change, il faut déplacer la ligne
      if (newEmplacement !== oldEmplacement || newSection !== oldSection) {
        const content = await vaultRef.current.readFile(STOCK_FILE);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        // Lire les valeurs actuelles
        const cells = lines[lineIndex].split('|').slice(1, -1).map(c => c.trim());
        if (cells.length < 4) return;

        const current: Omit<StockItem, 'lineIndex'> = {
          produit: cells[0],
          detail: cells[1] || undefined,
          quantite: parseInt(cells[2], 10) || 0,
          seuil: parseInt(cells[3], 10) || 0,
          qteAchat: cells[4] ? parseInt(cells[4], 10) || 1 : 1,
          emplacement: oldEmplacement,
          section: oldSection,
        };

        // Supprimer l'ancienne ligne
        lines.splice(lineIndex, 1);
        await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

        // Réinsérer dans la bonne section via addStockItem
        const updated = { ...current, ...updates };
        delete (updated as any).lineIndex;
        await addStockItem(updated);
        return; // addStockItem fait déjà le reload
      }

      // Pas de changement d'emplacement → mise à jour in-place
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const cells = lines[lineIndex].split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 4) return;

      const current: Omit<StockItem, 'lineIndex'> = {
        produit: cells[0],
        detail: cells[1] || undefined,
        quantite: parseInt(cells[2], 10) || 0,
        seuil: parseInt(cells[3], 10) || 0,
        qteAchat: cells[4] ? parseInt(cells[4], 10) || 1 : 1,
        emplacement: oldEmplacement,
        section: oldSection,
      };

      const updated = { ...current, ...updates };
      lines[lineIndex] = serializeStockRow(updated);
      await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

      // Optimistic update
      setStock(prev => prev.map(s =>
        s.lineIndex === lineIndex
          ? { ...s, ...updates }
          : s
      ));
    } catch (e) {
      throw new Error(`updateStockItem: ${e}`);
    }
  }, [stock, addStockItem]);

  /**
   * Toggle task + optimistic state update.
   * Writes to file AND immediately updates tasks state
   * without waiting for a full vault reload (avoids iOS file timing issues).
   */
  const toggleTask = useCallback(async (task: Task, completed: boolean) => {
    if (!vaultRef.current) return;

    // 1. Write to file
    await vaultRef.current.toggleTask(task.sourceFile, task.lineIndex, completed);

    // 2. Optimistic state update — immediately reflect the change in UI
    const updateTask = (t: Task): Task => {
      if (t.id !== task.id) return t;
      if (completed && t.recurrence && t.dueDate) {
        // Recurring task: advance date, keep unchecked
        const newDate = nextOccurrence(t.dueDate, t.recurrence);
        return { ...t, dueDate: newDate, completed: false };
      }
      const today = format(new Date(), 'yyyy-MM-dd');
      return { ...t, completed, completedDate: completed ? today : undefined };
    };

    setTasks(prev => prev.map(updateTask));
    setVacationTasks(prev => prev.map(updateTask));
    setTimeout(triggerWidgetRefresh, 0);

    // No background loadVaultData — optimistic state is authoritative.
    // Next foreground event will fully sync.
  }, [triggerWidgetRefresh]);

  const addRDV = useCallback(async (rdv: Omit<RDV, 'sourceFile' | 'title'>) => {
    if (!vaultRef.current) return;
    const fileName = rdvFileName(rdv);
    const relPath = `${RDV_DIR}/${fileName}`;
    const content = serializeRDV(rdv);

    // Ensure directory exists, write file, verify
    await vaultRef.current.ensureDir(RDV_DIR);
    await vaultRef.current.writeFile(relPath, content);

    // Verify the file was actually written
    const exists = await vaultRef.current.exists(relPath);
    if (!exists) {
      throw new Error(`Échec écriture RDV: le fichier n'existe pas après écriture.\nPath: ${relPath}`);
    }

    // Optimistic state update — add RDV to state immediately
    const newRDV: RDV = {
      ...rdv,
      title: fileName.replace('.md', ''),
      sourceFile: relPath,
    };
    setRdvs(prev => [...prev, newRDV].sort((a, b) => a.date_rdv.localeCompare(b.date_rdv)));
    setTimeout(triggerWidgetRefresh, 0);

    // Replanifier les alertes RDV (fire-and-forget)
    loadNotifConfig().then(config =>
      scheduleRDVAlerts([...rdvs, newRDV], config)
    ).catch(() => {});
  }, [rdvs, triggerWidgetRefresh]);

  const updateRDV = useCallback(async (sourceFile: string, rdv: Omit<RDV, 'sourceFile' | 'title'>) => {
    if (!vaultRef.current) return;
    const content = serializeRDV(rdv);
    await vaultRef.current.writeFile(sourceFile, content);
    const newFileName = rdvFileName(rdv);
    const newPath = `${RDV_DIR}/${newFileName}`;
    if (newPath !== sourceFile) {
      await vaultRef.current.writeFile(newPath, content);
      await vaultRef.current.deleteFile(sourceFile);
    }

    // Optimistic state update
    setRdvs(prev => prev.map(r => {
      if (r.sourceFile !== sourceFile) return r;
      return { ...rdv, title: newFileName.replace('.md', ''), sourceFile: newPath };
    }).sort((a, b) => a.date_rdv.localeCompare(b.date_rdv)));
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh]);

  const deleteRDV = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    // Optimistic: remove from state immediately
    setRdvs(prev => prev.filter(r => r.sourceFile !== sourceFile));
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh]);

  const addTask = useCallback(async (text: string, targetFile: string, dueDate?: string, recurrence?: string, sectionOverride?: string) => {
    if (!vaultRef.current) return;
    let taskText = text;
    if (recurrence) taskText += ` 🔁 ${recurrence}`;
    if (dueDate) taskText += ` 📅 ${dueDate}`;
    // Section explicite (ex: "Lundi — Cuisine") ou auto selon récurrence
    let section: string | null = sectionOverride || null;
    if (!section && recurrence) {
      if (/every\s+day/i.test(recurrence)) section = 'Quotidien';
      else if (/every\s+week/i.test(recurrence)) section = 'Hebdomadaire';
      else if (/every\s+month/i.test(recurrence)) section = 'Mensuel';
    }
    await vaultRef.current.appendTask(targetFile, section, taskText);
    // Re-parser le fichier modifié pour recalculer les lineIndex
    const updatedContent = await vaultRef.current.readFile(targetFile);
    const updatedTasks = parseTaskFile(targetFile, updatedContent);
    setTasks(prev => {
      // Remplacer les tâches de ce fichier par les nouvelles
      const otherTasks = prev.filter(t => t.sourceFile !== targetFile);
      return [...otherTasks, ...updatedTasks];
    });
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh]);

  const editTask = useCallback(async (task: Task, updates: { text?: string; dueDate?: string; recurrence?: string; targetFile?: string }) => {
    if (!vaultRef.current) return;
    const newText = updates.text ?? task.text;
    const newRecurrence = updates.recurrence !== undefined ? updates.recurrence : (task.recurrence ?? '');
    const newDueDate = updates.dueDate !== undefined ? updates.dueDate : (task.dueDate ?? '');
    const newTargetFile = updates.targetFile ?? task.sourceFile;

    // Déterminer la section cible selon la récurrence
    let newSection: string | null = null;
    if (newRecurrence) {
      if (/every\s+day/i.test(newRecurrence)) newSection = 'Quotidien';
      else if (/every\s+week/i.test(newRecurrence)) newSection = 'Hebdomadaire';
      else if (/every\s+month/i.test(newRecurrence)) newSection = 'Mensuel';
    }

    // Déterminer la section actuelle de la tâche
    let currentSection: string | null = null;
    if (task.recurrence) {
      if (/every\s+day/i.test(task.recurrence)) currentSection = 'Quotidien';
      else if (/every\s+week/i.test(task.recurrence)) currentSection = 'Hebdomadaire';
      else if (/every\s+month/i.test(task.recurrence)) currentSection = 'Mensuel';
    }

    // Construire la nouvelle ligne markdown
    let taskLine = newText;
    if (newRecurrence) taskLine += ` 🔁 ${newRecurrence}`;
    if (newDueDate) taskLine += ` 📅 ${newDueDate}`;
    const fullLine = `- [${task.completed ? 'x' : ' '}] ${taskLine}`;

    const fileChanged = newTargetFile !== task.sourceFile;
    const sectionChanged = newSection !== currentSection;

    if (fileChanged || sectionChanged) {
      // Supprimer l'ancienne ligne
      const content = await vaultRef.current.readFile(task.sourceFile);
      const lines = content.split('\n');
      if (task.lineIndex >= 0 && task.lineIndex < lines.length) {
        lines.splice(task.lineIndex, 1);
        await vaultRef.current.writeFile(task.sourceFile, lines.join('\n'));
      }
      // Ajouter dans le nouveau fichier/section
      await vaultRef.current.appendTask(newTargetFile, newSection, taskLine);

      // Re-parser les fichiers modifiés pour recalculer les lineIndex
      const filesToReparse = new Set([task.sourceFile, newTargetFile]);
      const vault = vaultRef.current;
      const reparsed = await Promise.all(
        [...filesToReparse].map(async (f) => {
          try {
            const c = await vault.readFile(f);
            return parseTaskFile(f, c);
          } catch (e) { warnUnexpected('moveTask-reparse', e); return [] as Task[]; }
        })
      );
      setTasks(prev => {
        const otherTasks = prev.filter(t => !filesToReparse.has(t.sourceFile));
        return [...otherTasks, ...reparsed.flat()];
      });
    } else {
      // Remplacement en place
      const content = await vaultRef.current.readFile(task.sourceFile);
      const lines = content.split('\n');
      if (task.lineIndex >= 0 && task.lineIndex < lines.length) {
        lines[task.lineIndex] = fullLine;
        await vaultRef.current.writeFile(task.sourceFile, lines.join('\n'));
      }

      // Mise à jour optimiste du state local
      setTasks(prev => prev.map(t => {
        if (t.sourceFile !== task.sourceFile || t.lineIndex !== task.lineIndex) return t;
        return { ...t, text: newText, recurrence: newRecurrence || undefined, dueDate: newDueDate || undefined };
      }));
    }
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh]);

  const deleteTask = useCallback(async (sourceFile: string, lineIndex: number) => {
    if (!vaultRef.current) return;
    const content = await vaultRef.current.readFile(sourceFile);
    const lines = content.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines.splice(lineIndex, 1);
      const newContent = lines.join('\n');
      await vaultRef.current.writeFile(sourceFile, newContent);
      // Re-parser le fichier pour recalculer les lineIndex
      setTasks(prev => {
        const updatedTasks = parseTaskFile(sourceFile, newContent);
        const otherTasks = prev.filter(t => t.sourceFile !== sourceFile);
        return [...otherTasks, ...updatedTasks];
      });
      setTimeout(triggerWidgetRefresh, 0);
    }
  }, [triggerWidgetRefresh]);

  const addCourseItem = useCallback(async (text: string, section?: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.appendTask(COURSES_FILE, section ?? null, text);
    // Re-parser le fichier pour recalculer les lineIndex
    const newContent = await vaultRef.current.readFile(COURSES_FILE);
    setCourses(parseCourses(newContent, COURSES_FILE));
  }, []);

  const toggleCourseItem = useCallback(async (item: CourseItem, completed: boolean) => {
    if (!vaultRef.current) return;
    await vaultRef.current.toggleTask(COURSES_FILE, item.lineIndex, completed);
    setCourses((prev) => prev.map((c) => (c.id === item.id ? { ...c, completed } : c)));
  }, []);

  const removeCourseItem = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(COURSES_FILE);
      const lines = content.split('\n');
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines.splice(lineIndex, 1);
        await vaultRef.current.writeFile(COURSES_FILE, lines.join('\n'));
        // Update local courses state (sans loadVaultData qui écraserait le stock)
        const updated = parseCourses(lines.join('\n'), COURSES_FILE);
        setCourses(updated);
      }
    } catch (e) {
      throw new Error(`removeCourseItem: ${e}`);
    }
  }, []);

  /** Déplace un article de courses dans une autre section (une seule écriture fichier) */
  const moveCourseItem = useCallback(async (lineIndex: number, text: string, newSection: string) => {
    if (!vaultRef.current) return;
    const content = await vaultRef.current.readFile(COURSES_FILE);
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    // 1. Supprimer l'ancienne ligne
    lines.splice(lineIndex, 1);

    // 2. Trouver ou créer la section cible, insérer l'article
    const sectionHeader = `## ${newSection}`;
    let sectionIdx = lines.findIndex(l => l.trim() === sectionHeader);
    if (sectionIdx === -1) {
      // Section n'existe pas — l'ajouter à la fin
      lines.push('', sectionHeader, `- [ ] ${text}`);
    } else {
      // Insérer après le header de section (et après les items existants)
      let insertIdx = sectionIdx + 1;
      while (insertIdx < lines.length && lines[insertIdx].startsWith('- [')) {
        insertIdx++;
      }
      lines.splice(insertIdx, 0, `- [ ] ${text}`);
    }

    // 3. Écriture unique + mise à jour state locale
    const newContent = lines.join('\n');
    await vaultRef.current.writeFile(COURSES_FILE, newContent);
    setCourses(parseCourses(newContent, COURSES_FILE));
  }, []);

  /** Batch merge ingredients into the shopping list (single file write) */
  const mergeCourseIngredients = useCallback(async (items: { text: string; name: string; quantity: number | null; section: string }[]): Promise<{ added: number; merged: number }> => {
    if (!vaultRef.current) return { added: 0, merged: 0 };
    let added = 0;
    let merged = 0;

    try {
      let content = '';
      try { content = await vaultRef.current.readFile(COURSES_FILE); } catch (e) { warnUnexpected('mergeCourses-read', e); }
      const lines = content.split('\n');

      for (const item of items) {
        // Normalize ingredient name for matching (accent-insensitive)
        const nameNorm = item.name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Find existing unchecked line containing the same ingredient name
        let foundIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.match(/^-\s+\[ \]/)) continue;
          const lineText = line.replace(/^-\s+\[ \]\s*/, '');
          const lineNorm = lineText.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (lineNorm.includes(nameNorm)) {
            foundIdx = i;
            break;
          }
        }

        if (foundIdx >= 0) {
          if (item.quantity === null) {
            // No quantity (e.g. "sel", "poivre") — already exists, skip
            merged++;
            continue;
          }
          // Merge: parse existing qty, add, rewrite line
          const existingLine = lines[foundIdx].replace(/^-\s+\[ \]\s*/, '');
          const existingMatch = existingLine.match(/^(\d+(?:[.,]\d+)?)\s+/);
          if (existingMatch) {
            const existingQty = parseFloat(existingMatch[1].replace(',', '.'));
            const mergedQty = existingQty + item.quantity;
            const mergedText = existingLine.replace(/^\d+(?:[.,]\d+)?/, String(mergedQty));
            lines[foundIdx] = `- [ ] ${mergedText}`;
            merged++;
            continue;
          }
        }

        // Add new item under the right section header
        const sectionHeader = `## ${item.section}`;
        let sectionIdx = lines.findIndex((l) => l.trim() === sectionHeader);
        if (sectionIdx === -1) {
          lines.push('', sectionHeader);
          sectionIdx = lines.length - 1;
        }
        let insertIdx = sectionIdx + 1;
        while (insertIdx < lines.length && (lines[insertIdx].startsWith('- ') || lines[insertIdx].trim() === '')) {
          if (lines[insertIdx].trim() !== '' && !lines[insertIdx].startsWith('- ')) break;
          insertIdx++;
        }
        lines.splice(insertIdx, 0, `- [ ] ${item.text}`);
        added++;
      }

      const newContent = lines.join('\n');
      await vaultRef.current.writeFile(COURSES_FILE, newContent);
      // Re-parser le fichier localement
      setCourses(parseCourses(newContent, COURSES_FILE));
    } catch (e) {
      throw new Error(`mergeCourseIngredients: ${e}`);
    }

    return { added, merged };
  }, []);

  const clearCompletedCourses = useCallback(async () => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(COURSES_FILE);
      const lines = content.split('\n');
      const cleaned = lines.filter((l) => !l.match(/^-\s+\[x\]/i));
      const newContent = cleaned.join('\n');
      await vaultRef.current.writeFile(COURSES_FILE, newContent);
      // Re-parser localement
      setCourses(parseCourses(newContent, COURSES_FILE));
    } catch (e) {
      throw new Error(`clearCompletedCourses: ${e}`);
    }
  }, []);

  const updateMemory = useCallback(async (oldMemory: Memory, newMemory: Omit<Memory, 'enfant' | 'enfantId'>) => {
    if (!vaultRef.current) return;
    const jalonsPath = `${MEMOIRES_DIR}/${oldMemory.enfant}/Jalons.md`;
    const content = await vaultRef.current.readFile(jalonsPath);
    const updated = updateJalonInContent(content, oldMemory, newMemory);
    await vaultRef.current.writeFile(jalonsPath, updated);

    // Optimistic update
    const updatedMemory: Memory = { ...newMemory, enfant: oldMemory.enfant, enfantId: oldMemory.enfantId };
    setMemories(prev =>
      prev
        .map(m =>
          m.date === oldMemory.date && m.title === oldMemory.title && m.enfantId === oldMemory.enfantId
            ? updatedMemory
            : m
        )
        .sort((a, b) => b.date.localeCompare(a.date))
    );
  }, []);

  const addMemory = useCallback(async (enfant: string, memory: Omit<Memory, 'enfant' | 'enfantId'>) => {
    if (!vaultRef.current) return;
    const jalonsPath = `${MEMOIRES_DIR}/${enfant}/Jalons.md`;
    const vault = vaultRef.current;

    // Ensure directory and file exist
    await vault.ensureDir(`${MEMOIRES_DIR}/${enfant}`);
    let content: string;
    try {
      content = await vault.readFile(jalonsPath);
    } catch (e) {
      warnUnexpected('addMemory-read', e);
      content = [
        '---',
        `enfant: ${enfant}`,
        'tags:',
        '  - jalons',
        '---',
        '',
        `# Jalons & Mémoires — ${enfant}`,
        '',
        '## 🌟 Premières fois',
        '',
        '## 💛 Moments forts',
        '',
      ].join('\n');
    }

    const updated = insertJalonInContent(content, memory);
    await vault.writeFile(jalonsPath, updated);

    // Optimistic update
    const enfantId = enfant.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const newMemory: Memory = { ...memory, enfant, enfantId };
    setMemories(prev => [newMemory, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const addRecipe = useCallback(async (category: string, data: { title: string; tags?: string[]; servings?: number; prepTime?: string; cookTime?: string; ingredients: { name: string; quantity?: string; unit?: string }[]; steps: string[] }) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const fileName = data.title.replace(/[/\\:*?"<>|]/g, '').trim();
    const relPath = `${RECIPES_DIR}/${category}/${fileName}.cook`;
    await vault.ensureDir(`${RECIPES_DIR}/${category}`);
    const content = generateCookFile(data);
    await vault.writeFile(relPath, content);
    // Force reload recipes
    recipesLoadedRef.current = false;
    await loadRecipes(true);
  }, [loadRecipes]);

  const deleteRecipe = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setRecipes(prev => prev.filter(r => r.sourceFile !== sourceFile));
  }, []);

  const renameRecipe = useCallback(async (sourceFile: string, newTitle: string) => {
    if (!vaultRef.current) return;
    const content = await vaultRef.current.readFile(sourceFile);
    let updated: string;
    // Mettre à jour ou ajouter le title dans le frontmatter/metadata
    if (/^>> title:.*$/m.test(content)) {
      updated = content.replace(/^>> title:.*$/m, `>> title: ${newTitle}`);
    } else if (/^---/.test(content)) {
      // Frontmatter YAML — ajouter title
      updated = content.replace(/^---\n/, `---\ntitle: "${newTitle}"\n`);
    } else {
      // Pas de metadata — ajouter en haut
      updated = `>> title: ${newTitle}\n\n${content}`;
    }
    await vaultRef.current.writeFile(sourceFile, updated);
    // Mettre à jour le state local
    const { parseRecipe } = require('../lib/cooklang');
    setRecipes(prev => prev.map(r =>
      r.sourceFile === sourceFile ? parseRecipe(sourceFile, updated) : r
    ));
  }, []);

  /** Scanner tout le vault pour des .cook en dehors du dossier Recettes */
  const scanAllCookFiles = useCallback(async (): Promise<{ path: string; title: string }[]> => {
    if (!vaultRef.current) return [];
    const vault = vaultRef.current;
    // Scanner les dossiers racine du vault
    const topDirs = await vault.listDir('');
    const results: { path: string; title: string }[] = [];
    for (const dir of topDirs) {
      // Ignorer le dossier Recettes (déjà scanné) et les dossiers cachés
      if (dir.startsWith('.') || dir === '03 - Cuisine') continue;
      try {
        const cookFiles = await vault.listFilesRecursive(dir, '.cook');
        for (const filePath of cookFiles) {
          // Extraire le titre du nom de fichier
          const parts = filePath.split('/');
          const fileName = parts[parts.length - 1].replace('.cook', '');
          results.push({ path: filePath, title: fileName });
        }
      } catch (e) {
        warnUnexpected(`findOrphanCook(${dir})`, e);
      }
    }
    // Scanner aussi les .cook à la racine
    const rootEntries = await vault.listDir('');
    for (const entry of rootEntries) {
      if (entry.endsWith('.cook')) {
        results.push({ path: entry, title: entry.replace('.cook', '') });
      }
    }
    return results;
  }, []);

  /** Déplacer un .cook vers le dossier Recettes */
  const moveCookToRecipes = useCallback(async (sourcePath: string, category: string) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const content = await vault.readFile(sourcePath);
    const parts = sourcePath.split('/');
    const fileName = parts[parts.length - 1];
    const destPath = `${RECIPES_DIR}/${category}/${fileName}`;
    await vault.ensureDir(`${RECIPES_DIR}/${category}`);
    await vault.writeFile(destPath, content);
    await vault.deleteFile(sourcePath);

    // Mise à jour optimiste : ajouter la recette déplacée au state
    try {
      const recipe = parseRecipe(destPath, content);
      if (recipe) {
        setRecipes(prev => [...prev, recipe].sort((a, b) => a.title.localeCompare(b.title, 'fr')));
      }
    } catch (e) {
      warnUnexpected('moveCookToRecipes-optimistic', e);
      recipesLoadedRef.current = false;
      await loadRecipes(true);
    }
  }, [loadRecipes]);

  // ─── Recipe Favorites (per-profile, persisted in SecureStore) ────────────

  const FAVORITES_KEY_PREFIX = 'recipe_favorites_';

  const loadFavorites = useCallback(async (profileId: string): Promise<string[]> => {
    try {
      const raw = await SecureStore.getItemAsync(`${FAVORITES_KEY_PREFIX}${profileId}`);
      if (raw) return JSON.parse(raw) as string[];
    } catch (e) { warnUnexpected('loadFavorites', e); }
    return [];
  }, []);

  // Load favorites for all profiles on init
  useEffect(() => {
    (async () => {
      const all: Record<string, string[]> = {};
      for (const p of profiles) {
        all[p.id] = await loadFavorites(p.id);
      }
      setRecipeFavorites(all);
    })();
  }, [profiles, loadFavorites]);

  const toggleFavorite = useCallback(async (profileId: string, recipePath: string) => {
    setRecipeFavorites(prev => {
      const current = prev[profileId] ?? [];
      const exists = current.includes(recipePath);
      const updated = exists ? current.filter(p => p !== recipePath) : [...current, recipePath];
      // Persist async (fire-and-forget)
      SecureStore.setItemAsync(`${FAVORITES_KEY_PREFIX}${profileId}`, JSON.stringify(updated)).catch(() => {});
      return { ...prev, [profileId]: updated };
    });
  }, []);

  const isFavorite = useCallback((profileId: string, recipePath: string): boolean => {
    return (recipeFavorites[profileId] ?? []).includes(recipePath);
  }, [recipeFavorites]);

  const getFavorites = useCallback((profileId: string): string[] => {
    return recipeFavorites[profileId] ?? [];
  }, [recipeFavorites]);

  const refreshGamification = useCallback(async () => {
    if (!vaultRef.current) return;
    try {
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const gamiContent = await vaultRef.current.readFile(GAMI_FILE);
      const merged = mergeProfiles(familleContent, gamiContent);
      setProfiles(merged);
      const gami = parseGamification(gamiContent);
      setGamiData(gami);
    } catch (e) {
      warnUnexpected('refreshGamification', e);
    }
  }, []);

  const activateVacation = useCallback(async (startDate: string, endDate: string) => {
    const config: VacationConfig = { active: true, startDate, endDate };
    await SecureStore.setItemAsync(VACATION_STORE_KEY, JSON.stringify(config));
    setVacationConfig(config);
    // Create Vacances.md if it doesn't exist
    if (vaultRef.current) {
      const exists = await vaultRef.current.exists(VACATION_FILE);
      if (!exists) {
        await vaultRef.current.writeFile(VACATION_FILE, VACATION_TEMPLATE);
      }
      // Reload vacation tasks
      const content = await vaultRef.current.readFile(VACATION_FILE);
      setVacationTasks(parseTaskFile(VACATION_FILE, content));
    }
  }, []);

  const deactivateVacation = useCallback(async () => {
    if (vacationConfig) {
      const deactivated = { ...vacationConfig, active: false };
      await SecureStore.setItemAsync(VACATION_STORE_KEY, JSON.stringify(deactivated));
      setVacationConfig(deactivated);
    }
  }, [vacationConfig]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const isVacationActive = !!(vacationConfig?.active && vacationConfig.endDate >= todayISO);

  // Resolve active profile from ID → Profile object
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  /** Apply age upgrade: regenerate tasks file + update ageCategory in famille.md */
  const applyAgeUpgrade = useCallback(async (upgrade: AgeUpgrade) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const profile = profiles.find((p) => p.id === upgrade.profileId);
    if (!profile) return;

    // Regenerate tasks file with new age category templates
    const today = format(new Date(), 'yyyy-MM-dd');
    const tasksPath = `01 - Enfants/${upgrade.childName}/Tâches récurrentes.md`;
    const slug = upgrade.childName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const catLabels: Record<AgeCategory, string> = { bebe: 'bébé', petit: 'petit', enfant: 'enfant', ado: 'ado' };
    const taskTemplates: Record<AgeCategory, string> = {
      bebe: `## Quotidien\n- [ ] Préparer les biberons 🔁 every day 📅 ${today}\n- [ ] Laver biberons / tétines 🔁 every day 📅 ${today}\n- [ ] Vider la poubelle à couches 🔁 every day 📅 ${today}\n- [ ] Nettoyer le tapis à langer 🔁 every day 📅 ${today}\n- [ ] Bain 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de couches 🔁 every day 📅 ${today}\n- [ ] Vérifier le stock de lait 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge bébé 🔁 every week 📅 ${today}\n- [ ] Stériliser les accessoires 🔁 every week 📅 ${today}\n- [ ] Nettoyer le lit / berceau 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier la taille des vêtements 🔁 every month 📅 ${today}\n- [ ] Trier les vêtements trop petits 🔁 every month 📅 ${today}\n- [ ] Vérifier les produits de soin 🔁 every month 📅 ${today}\n`,
      petit: `## Quotidien\n- [ ] Brossage de dents matin 🔁 every day 📅 ${today}\n- [ ] Brossage de dents soir 🔁 every day 📅 ${today}\n- [ ] S'habiller tout seul 🔁 every day 📅 ${today}\n- [ ] Ranger les jouets 🔁 every day 📅 ${today}\n- [ ] Bain / douche 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge 🔁 every week 📅 ${today}\n- [ ] Nettoyer la chambre 🔁 every week 📅 ${today}\n- [ ] Activité / sortie 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier la taille des vêtements 🔁 every month 📅 ${today}\n- [ ] Vérifier les chaussures 🔁 every month 📅 ${today}\n- [ ] Trier les jouets 🔁 every month 📅 ${today}\n`,
      enfant: `## Quotidien\n- [ ] Préparer le cartable 🔁 every day 📅 ${today}\n- [ ] Faire les devoirs 🔁 every day 📅 ${today}\n- [ ] Douche 🔁 every day 📅 ${today}\n- [ ] Ranger la chambre 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Laver le linge 🔁 every week 📅 ${today}\n- [ ] Ranger le bureau 🔁 every week 📅 ${today}\n- [ ] Activité extra-scolaire 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Vérifier les fournitures scolaires 🔁 every month 📅 ${today}\n- [ ] Vérifier les vêtements 🔁 every month 📅 ${today}\n`,
      ado: `## Quotidien\n- [ ] Ranger la chambre 🔁 every day 📅 ${today}\n- [ ] Mettre le linge sale au panier 🔁 every day 📅 ${today}\n- [ ] Faire les devoirs 🔁 every day 📅 ${today}\n\n## Hebdomadaire\n- [ ] Faire sa lessive 🔁 every week 📅 ${today}\n- [ ] Ménage de la chambre 🔁 every week 📅 ${today}\n- [ ] Aider en cuisine 🔁 every week 📅 ${today}\n\n## Mensuel\n- [ ] Gérer son argent de poche 🔁 every month 📅 ${today}\n- [ ] Vérifier les fournitures scolaires 🔁 every month 📅 ${today}\n`,
    };

    const header = `---\ntags:\n  - taches\n  - ${slug}\n---\n> ← [[00 - Dashboard/Dashboard|Dashboard]]\n\n# Tâches récurrentes — ${upgrade.childName}\n\n`;
    await vault.writeFile(tasksPath, header + taskTemplates[upgrade.newCategory]);

    // Update ageCategory in famille.md
    const familleContent = await vault.readFile(FAMILLE_FILE);
    const lines = familleContent.split('\n');
    let inSection = false;
    let ageCatLineIdx = -1;
    let lastPropIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === upgrade.profileId) {
          inSection = true;
        }
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        if (lines[i].trim().startsWith('ageCategory:')) {
          ageCatLineIdx = i;
        }
      }
    }

    if (ageCatLineIdx >= 0) {
      lines[ageCatLineIdx] = `ageCategory: ${upgrade.newCategory}`;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, `ageCategory: ${upgrade.newCategory}`);
    }
    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));

    // Remove this upgrade from the list
    setAgeUpgrades((prev) => prev.filter((u) => u.profileId !== upgrade.profileId));

    // Mise à jour optimiste des profils (ageCategory mis à jour)
    try {
      const newFamilleContent = lines.join('\n');
      const gamiContent = await vault.readFile(GAMI_FILE);
      setProfiles(mergeProfiles(newFamilleContent, gamiContent));
    } catch (e) {
      warnUnexpected('applyAgeUpgrade-optimistic', e);
      setProfiles(prev => prev.map(p =>
        p.id === upgrade.profileId ? { ...p, ageCategory: upgrade.newCategory } : p
      ));
    }

    // Re-parser les tâches du fichier régénéré
    try {
      const newTaskContent = await vault.readFile(tasksPath);
      const newTasks = parseTaskFile(tasksPath, newTaskContent);
      setTasks(prev => {
        const otherTasks = prev.filter(t => t.sourceFile !== tasksPath);
        return [...otherTasks, ...newTasks];
      });
    } catch (e) { warnUnexpected('applyAgeUpgrade-tasks', e); }
  }, [profiles]);

  /** Dismiss an age upgrade notification without applying */
  const dismissAgeUpgrade = useCallback((profileId: string) => {
    setAgeUpgrades((prev) => prev.filter((u) => u.profileId !== profileId));
  }, []);

  const addChild = useCallback(async (child: { name: string; avatar: string; birthdate: string; propre?: boolean; gender?: Gender; statut?: 'grossesse'; dateTerme?: string }) => {
    if (!vaultRef.current) return;
    await vaultRef.current.addChild(child);

    // Mise à jour optimiste des profils et gamification
    try {
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const gamiContent = await vaultRef.current.readFile(GAMI_FILE);
      const merged = mergeProfiles(familleContent, gamiContent);
      setProfiles(merged);
      setGamiData(parseGamification(gamiContent));
    } catch (e) { warnUnexpected('addChild-optimistic', e); }
  }, []);

  const convertToBorn = useCallback(async (profileId: string, birthdate: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.convertToBorn(profileId, birthdate);

    // Mise à jour optimiste des profils
    try {
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const gamiContent = await vaultRef.current.readFile(GAMI_FILE);
      setProfiles(mergeProfiles(familleContent, gamiContent));
    } catch (e) { warnUnexpected('convertToBorn-optimistic', e); }
  }, []);

  // ─── Budget CRUD ────────────────────────────────────────────────────────

  const loadBudgetData = useCallback(async (month?: string) => {
    if (!vaultRef.current) return;
    const m = month || budgetMonth;
    if (month) setBudgetMonth(m);

    try {
      // Load config (try read, fallback to default + scaffold)
      try {
        const configContent = await vaultRef.current.readFile(BUDGET_CONFIG_FILE);
        setBudgetConfig(parseBudgetConfig(configContent));
      } catch (e) {
        warnUnexpected('loadBudgetConfig', e);
        await vaultRef.current.ensureDir(BUDGET_DIR);
        await vaultRef.current.writeFile(BUDGET_CONFIG_FILE, serializeBudgetConfig(DEFAULT_BUDGET_CONFIG));
        setBudgetConfig(DEFAULT_BUDGET_CONFIG);
      }
      // Load month entries (try read, fallback to empty)
      try {
        const content = await vaultRef.current.readFile(`${BUDGET_DIR}/${m}.md`);
        setBudgetEntries(parseBudgetMonth(content));
      } catch (e) {
        warnUnexpected(`loadBudgetMonth(${m})`, e);
        setBudgetEntries([]);
      }
    } catch (e) {
      warnUnexpected('loadBudgetData', e);
      setBudgetEntries([]);
    }
  }, [budgetMonth]);

  const addExpense = useCallback(async (date: string, category: string, amount: number, label: string) => {
    if (!vaultRef.current) return;
    const month = date.slice(0, 7); // YYYY-MM
    const monthFile = `${BUDGET_DIR}/${month}.md`;
    await vaultRef.current.ensureDir(BUDGET_DIR);

    let entries: BudgetEntry[] = [];
    try {
      const content = await vaultRef.current.readFile(monthFile);
      entries = parseBudgetMonth(content);
    } catch (e) {
      warnUnexpected('addExpense-read', e);
    }

    const newEntry: BudgetEntry = { date, category, amount, label, lineIndex: -1 };
    entries.push(newEntry);
    const serialized = serializeBudgetMonth(month, entries);
    await vaultRef.current.writeFile(monthFile, serialized);

    // Update state from serialized content (re-parse for accurate lineIndex)
    if (month === budgetMonth) {
      setBudgetEntries(parseBudgetMonth(serialized));
    }
  }, [budgetMonth]);

  const deleteExpense = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    const monthFile = `${BUDGET_DIR}/${budgetMonth}.md`;

    let content: string;
    try {
      content = await vaultRef.current.readFile(monthFile);
    } catch (e) {
      warnUnexpected('deleteExpense-read', e);
      return;
    }
    const lines = content.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines.splice(lineIndex, 1);
      const updated = lines.join('\n');
      await vaultRef.current.writeFile(monthFile, updated);
      setBudgetEntries(parseBudgetMonth(updated));
    }
  }, [budgetMonth]);

  const updateBudgetConfig = useCallback(async (config: BudgetConfig) => {
    if (!vaultRef.current) return;
    await vaultRef.current.ensureDir(BUDGET_DIR);
    await vaultRef.current.writeFile(BUDGET_CONFIG_FILE, serializeBudgetConfig(config));
    setBudgetConfig(config);
  }, []);

  const saveRoutines = useCallback(async (newRoutines: Routine[]) => {
    if (!vaultRef.current) return;
    await vaultRef.current.writeFile(ROUTINES_FILE, serializeRoutines(newRoutines));
    setRoutines(newRoutines);
  }, []);

  const saveHealthRecord = useCallback(async (record: HealthRecord) => {
    if (!vaultRef.current) return;
    const healthPath = `${HEALTH_DIR}/${record.enfant}/Carnet de santé.md`;
    await vaultRef.current.ensureDir(`${HEALTH_DIR}/${record.enfant}`);
    await vaultRef.current.writeFile(healthPath, serializeHealthRecord(record));
    setHealthRecords(prev => {
      const without = prev.filter(r => r.enfantId !== record.enfantId);
      return [...without, record];
    });
  }, []);

  const healthRecordsRef = useRef(healthRecords);
  healthRecordsRef.current = healthRecords;

  const addHealthEntry = useCallback(async (
    enfant: string,
    field: 'croissance' | 'vaccins',
    entry: GrowthEntry | VaccineEntry,
  ) => {
    const existing = healthRecordsRef.current.find(r => r.enfant === enfant);
    const record: HealthRecord = existing || {
      enfant,
      enfantId: enfant.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'),
      allergies: [], antecedents: [], medicamentsEnCours: [],
      croissance: [], vaccins: [],
    };
    const updated: HealthRecord = {
      ...record,
      [field]: [...record[field], entry].sort((a: any, b: any) => a.date.localeCompare(b.date)),
    };
    await saveHealthRecord(updated);
  }, [saveHealthRecord]);

  const addGrowthEntry = useCallback(async (enfant: string, entry: GrowthEntry) => {
    await addHealthEntry(enfant, 'croissance', entry);
  }, [addHealthEntry]);

  const updateGrowthEntry = useCallback(async (enfant: string, oldDate: string, newEntry: GrowthEntry) => {
    const existing = healthRecordsRef.current.find(r => r.enfant === enfant);
    if (!existing) return;
    const updated: HealthRecord = {
      ...existing,
      croissance: existing.croissance
        .map(e => e.date === oldDate ? newEntry : e)
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
    await saveHealthRecord(updated);
  }, [saveHealthRecord]);

  const deleteGrowthEntry = useCallback(async (enfant: string, date: string) => {
    const existing = healthRecordsRef.current.find(r => r.enfant === enfant);
    if (!existing) return;
    const updated: HealthRecord = {
      ...existing,
      croissance: existing.croissance.filter(e => e.date !== date),
    };
    await saveHealthRecord(updated);
  }, [saveHealthRecord]);

  const addVaccineEntry = useCallback(async (enfant: string, entry: VaccineEntry) => {
    await addHealthEntry(enfant, 'vaccins', entry);
  }, [addHealthEntry]);

  // ─── Défis familiaux CRUD ──────────────────────────────────────────────────

  const createDefi = useCallback(async (defi: Omit<Defi, 'progress' | 'status'>) => {
    if (!vaultRef.current) return;
    const newDefi: Defi = { ...defi, status: 'active', progress: [] };
    let updated: Defi[] = [];
    setDefis(prev => {
      updated = [...prev, newDefi];
      return updated;
    });
    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
  }, []);

  const checkInDefi = useCallback(async (defiId: string, profileId: string, completed: boolean, value?: number, note?: string) => {
    if (!vaultRef.current) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    let updated: Defi[] = [];
    let isNewCheckIn = false;
    let defiTitle = '';
    setDefis(prev => {
      updated = prev.map((d) => {
        if (d.id !== defiId) return d;
        defiTitle = d.title;
        // Vérifier si c'est un nouveau check-in (pas un remplacement)
        const existing = d.progress.find((p) => p.date === todayStr && p.profileId === profileId);
        isNewCheckIn = !existing && completed;
        // Retirer l'entrée existante pour ce profil + date (pour remplacer)
        const filtered = d.progress.filter((p) => !(p.date === todayStr && p.profileId === profileId));
        const entry: DefiDayEntry = { date: todayStr, profileId, completed, value, note };
        const newProgress = [...filtered, entry];

        // Pour abstinence, un échec = défi raté
        let newStatus = d.status;
        if (d.type === 'abstinence' && !completed) {
          newStatus = 'failed';
        }

        return { ...d, progress: newProgress, status: newStatus };
      });
      return updated;
    });
    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));

    // Mini-points (+3) pour chaque check-in réussi d'un défi
    if (isNewCheckIn && completed) {
      try {
        const gamiContent = await vaultRef.current.readFile(GAMI_FILE);
        const gami = parseGamification(gamiContent);
        const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
        const currentProfiles = mergeProfiles(familleContent, gamiContent);
        const profile = currentProfiles.find((p) => p.id === profileId);
        if (profile) {
          const { profile: updated, entry } = addPoints(profile, 3, `Défi: ${defiTitle}`);
          const newGami = {
            ...gami,
            profiles: gami.profiles.map((p) => p.id === profileId ? { ...p, points: updated.points, level: updated.level } : p),
            history: [...gami.history, entry],
          };
          await vaultRef.current.writeFile(GAMI_FILE, serializeGamification(newGami));
        }
      } catch {}
    }
  }, []);

  const completeDefi = useCallback(async (defiId: string) => {
    if (!vaultRef.current) return;

    // Lire le state frais via setter fonctionnel
    let defi: Defi | undefined;
    let updated: Defi[] = [];
    setDefis(prev => {
      defi = prev.find((d) => d.id === defiId);
      updated = prev.map((d) => d.id === defiId ? { ...d, status: 'completed' as const } : d);
      return updated;
    });
    if (!defi) return;

    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));

    // Distribuer les récompenses via gamification
    try {
      const gamiContent = await vaultRef.current.readFile(GAMI_FILE);
      const gami = parseGamification(gamiContent);
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const currentProfiles = mergeProfiles(familleContent, gamiContent);
      const participantIds = defi.participants.length > 0
        ? defi.participants
        : currentProfiles.map((p) => p.id);

      for (const pid of participantIds) {
        const matchProfile = currentProfiles.find((p) => p.id === pid);
        const gamiName = matchProfile?.name;
        const profile = gamiName
          ? gami.profiles.find((p) => p.name === gamiName)
          : gami.profiles.find((p) => p.name.toLowerCase().replace(/\s+/g, '') === pid);
        if (profile) {
          profile.points += defi.rewardPoints;
          profile.lootBoxesAvailable += defi.rewardLootBoxes;
          gami.history.push({
            profileId: pid,
            action: `+${defi.rewardPoints}`,
            points: defi.rewardPoints,
            note: `Défi: ${defi.title}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
      const gamiStr = serializeGamification(gami);
      await vaultRef.current.writeFile(GAMI_FILE, gamiStr);
      setProfiles(mergeProfiles(familleContent, gamiStr));
      setGamiData(gami);
    } catch (e) {
      warnUnexpected('completeDefi-gamification', e);
    }
  }, []);

  const deleteDefi = useCallback(async (defiId: string) => {
    if (!vaultRef.current) return;
    let updated: Defi[] = [];
    setDefis(prev => {
      updated = prev.filter((d) => d.id !== defiId);
      return updated;
    });
    if (updated.length > 0) {
      await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
    } else {
      // Supprimer le fichier si plus aucun défi
      try { await vaultRef.current.deleteFile(DEFIS_FILE); } catch (e) { warnUnexpected('deleteDefi-file', e); }
    }
  }, []);

  // ─── Gratitude CRUD ──────────────────────────────────────────────────────

  const addGratitudeEntry = useCallback(async (date: string, profileId: string, profileName: string, text: string) => {
    if (!vaultRef.current) return;
    let days: GratitudeDay[];
    try {
      const content = await vaultRef.current.readFile(GRATITUDE_FILE);
      days = parseGratitude(content);
    } catch (e) {
      warnUnexpected('addGratitude-read', e);
      days = [];
    }

    // Trouver ou créer le jour
    let day = days.find((d) => d.date === date);
    if (!day) {
      day = { date, entries: [] };
      days.push(day);
    }

    // Ajouter/remplacer l'entry du profil
    day.entries = day.entries.filter((e) => e.profileId !== profileId);
    day.entries.push({ date, profileId, profileName, text });

    await vaultRef.current.writeFile(GRATITUDE_FILE, serializeGratitude(days));
    // parseGratitude and serializeGratitude both sort desc — no need to re-sort
    setGratitudeDays(days);
  }, []);

  const deleteGratitudeEntry = useCallback(async (date: string, profileId: string) => {
    if (!vaultRef.current) return;
    let days: GratitudeDay[];
    try {
      const content = await vaultRef.current.readFile(GRATITUDE_FILE);
      days = parseGratitude(content);
    } catch (e) {
      warnUnexpected('deleteGratitude-read', e);
      return;
    }

    const day = days.find((d) => d.date === date);
    if (!day) return;

    day.entries = day.entries.filter((e) => e.profileId !== profileId);
    if (day.entries.length === 0) {
      days = days.filter((d) => d.date !== date);
    }

    if (days.length > 0) {
      await vaultRef.current.writeFile(GRATITUDE_FILE, serializeGratitude(days));
    } else {
      try { await vaultRef.current.deleteFile(GRATITUDE_FILE); } catch (e) { warnUnexpected('deleteGratitude-file', e); }
    }
    setGratitudeDays(days);
  }, []);

  // ─── Wishlist CRUD ────────────────────────────────────────────────────────

  const reloadWishlist = useCallback(async (): Promise<WishlistItem[]> => {
    if (!vaultRef.current) return [];
    try {
      const content = await vaultRef.current.readFile(WISHLIST_FILE);
      return parseWishlist(content);
    } catch (e) {
      warnUnexpected('reloadWishlist', e);
      return [];
    }
  }, []);

  const addWishItem = useCallback(async (text: string, profileName: string, budget?: WishBudget, occasion?: WishOccasion, notes?: string) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const newItem: WishlistItem = {
      id: `wish_${Date.now()}`,
      text,
      budget: budget || '',
      occasion: occasion || '',
      notes: notes || '',
      bought: false,
      boughtBy: '',
      profileName,
      sourceFile: WISHLIST_FILE,
      lineIndex: -1,
    };
    items.push(newItem);
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(items));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist]);

  const updateWishItem = useCallback(async (item: WishlistItem, updates: Partial<WishlistItem>) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const idx = items.findIndex((w) => w.lineIndex === item.lineIndex && w.profileName === item.profileName);
    if (idx === -1) return;
    items[idx] = { ...items[idx], ...updates };
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(items));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist]);

  const deleteWishItem = useCallback(async (item: WishlistItem) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const filtered = items.filter((w) => !(w.lineIndex === item.lineIndex && w.profileName === item.profileName));
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(filtered));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist]);

  const toggleWishBought = useCallback(async (item: WishlistItem, boughtBy: string) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const idx = items.findIndex((w) => w.lineIndex === item.lineIndex && w.profileName === item.profileName);
    if (idx === -1) return;
    if (items[idx].bought) {
      items[idx].bought = false;
      items[idx].boughtBy = '';
    } else {
      items[idx].bought = true;
      items[idx].boughtBy = boughtBy;
    }
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(items));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist]);

  // ─── Anniversaires CRUD ──────────────────────────────────────────────────

  const reloadAnniversaries = useCallback(async (): Promise<Anniversary[]> => {
    if (!vaultRef.current) return [];
    try {
      const content = await vaultRef.current.readFile(ANNIVERSAIRES_FILE);
      return parseAnniversaries(content);
    } catch (e) {
      warnUnexpected('reloadAnniversaries', e);
      return [];
    }
  }, []);

  const addAnniversary = useCallback(async (anniversary: Omit<Anniversary, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const items = await reloadAnniversaries();
    items.push({ ...anniversary, sourceFile: ANNIVERSAIRES_FILE });
    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(items));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries]);

  const updateAnniversary = useCallback(async (oldName: string, anniversary: Omit<Anniversary, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const items = await reloadAnniversaries();
    const idx = items.findIndex((a) => a.name === oldName);
    if (idx === -1) return;
    items[idx] = { ...anniversary, sourceFile: ANNIVERSAIRES_FILE };
    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(items));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries]);

  const removeAnniversary = useCallback(async (name: string) => {
    if (!vaultRef.current) return;
    const items = await reloadAnniversaries();
    const filtered = items.filter((a) => a.name !== name);
    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(filtered));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries]);

  const importAnniversaries = useCallback(async (newItems: Omit<Anniversary, 'sourceFile'>[]) => {
    if (!vaultRef.current) return;
    const existing = await reloadAnniversaries();
    // Merge : skip les doublons par contactId (si présent), sinon par nom+date
    const existingContactIds = new Set(existing.filter((a) => a.contactId).map((a) => a.contactId));
    const existingKeys = new Set(existing.map((a) => `${a.name}|${a.date}`));

    for (const item of newItems) {
      // Skip si contactId déjà présent
      if (item.contactId && existingContactIds.has(item.contactId)) continue;
      // Skip si même nom+date
      if (existingKeys.has(`${item.name}|${item.date}`)) continue;

      existing.push({ ...item, sourceFile: ANNIVERSAIRES_FILE });
      if (item.contactId) existingContactIds.add(item.contactId);
      existingKeys.add(`${item.name}|${item.date}`);
    }

    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(existing));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries]);

  // ─── Notes & Articles CRUD ──────────────────────────────────────────────────

  const addNote = useCallback(async (note: Omit<Note, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const categoryDir = noteCategoryLabel(note.category);
    const dir = `${NOTES_DIR}/${categoryDir}`;
    await vaultRef.current.ensureDir(dir);
    const relPath = `${dir}/${noteFileName(note.title)}`;
    await vaultRef.current.writeFile(relPath, serializeNote(note));
    const exists = await vaultRef.current.exists(relPath);
    if (!exists) throw new Error('Échec de l\'écriture');
    setNotes((prev) => [{ ...note, sourceFile: relPath }, ...prev]);
  }, []);

  const updateNote = useCallback(async (sourceFile: string, note: Omit<Note, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const categoryDir = noteCategoryLabel(note.category);
    const newDir = `${NOTES_DIR}/${categoryDir}`;
    const newPath = `${newDir}/${noteFileName(note.title)}`;
    // Si le chemin a changé (catégorie ou titre modifié), supprimer l'ancien
    if (newPath !== sourceFile) {
      try { await vaultRef.current.deleteFile(sourceFile); } catch (e) { warnUnexpected('updateNote-deleteOld', e); }
    }
    await vaultRef.current.ensureDir(newDir);
    await vaultRef.current.writeFile(newPath, serializeNote(note));
    setNotes((prev) => prev.map((n) =>
      n.sourceFile === sourceFile ? { ...note, sourceFile: newPath } : n
    ));
  }, []);

  const deleteNote = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setNotes((prev) => prev.filter((n) => n.sourceFile !== sourceFile));
  }, []);

  // ─── Mots d'enfants CRUD ─────────────────────────────────────────────────

  const addQuote = useCallback(async (enfant: string, citation: string, contexte?: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    const newQuote: ChildQuote = { date, enfant, citation, contexte, sourceFile: QUOTES_FILE, lineIndex: -1 };
    let existing: ChildQuote[] = [];
    try {
      const content = await vaultRef.current.readFile(QUOTES_FILE);
      existing = parseQuotes(content);
    } catch (e) { warnUnexpected('addQuote-read', e); }
    const updated = [newQuote, ...existing];
    await vaultRef.current.ensureDir('06 - Mémoires');
    const serialized = serializeQuotes(updated);
    await vaultRef.current.writeFile(QUOTES_FILE, serialized);
    setQuotes(parseQuotes(serialized));
  }, []);

  const deleteQuote = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(QUOTES_FILE);
      const existing = parseQuotes(content);
      const filtered = existing.filter(q => q.lineIndex !== lineIndex);
      const serialized = serializeQuotes(filtered);
      await vaultRef.current.writeFile(QUOTES_FILE, serialized);
      setQuotes(parseQuotes(serialized));
    } catch (e) {
      warnUnexpected('deleteQuote', e);
    }
  }, []);

  // ─── Météo des humeurs CRUD ──────────────────────────────────────────────

  const addMood = useCallback(async (profileId: string, profileName: string, level: MoodLevel, note?: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    let existing: MoodEntry[] = [];
    try {
      const content = await vaultRef.current.readFile(MOODS_FILE);
      existing = parseMoods(content);
    } catch (e) { warnUnexpected('addMood-read', e); }
    // Remplacer l'entrée du même profil pour aujourd'hui si elle existe
    const filtered = existing.filter(m => !(m.date === date && m.profileId === profileId));
    const newEntry: MoodEntry = { date, profileId, profileName, level, note, sourceFile: MOODS_FILE, lineIndex: -1 };
    const updated = [newEntry, ...filtered];
    try {
      await vaultRef.current.ensureDir('05 - Famille');
      const serialized = serializeMoods(updated);
      await vaultRef.current.writeFile(MOODS_FILE, serialized);
      setMoods(parseMoods(serialized));
    } catch (e) {
      warnUnexpected('addMood-write', e);
      throw e;
    }
  }, []);

  const deleteMood = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(MOODS_FILE);
      const existing = parseMoods(content);
      const filtered = existing.filter(m => m.lineIndex !== lineIndex);
      const serialized = serializeMoods(filtered);
      await vaultRef.current.writeFile(MOODS_FILE, serialized);
      setMoods(parseMoods(serialized));
    } catch (e) {
      warnUnexpected('deleteMood', e);
    }
  }, []);

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

    // Award XP via gamification
    const childProfile = gamiData.profiles.find((p) => p.id === childProfileId);
    if (childProfile) {
      const { profile: updatedProfile, entry } = addPoints(childProfile, xp, `Compétence: ${skill.label}`);
      const updatedGami = {
        ...gamiData,
        profiles: gamiData.profiles.map((p) => p.id === childProfileId ? updatedProfile : p),
        history: [...gamiData.history, entry],
      };
      setGamiData(updatedGami);
      await vaultRef.current.writeFile('gamification.md', serializeGamification(updatedGami));
    }
  }, [gamiData, profiles, skillTrees, activeProfileId]);

  // ─── Missions secrètes CRUD ───────────────────────────────────────────────

  const addSecretMission = useCallback(async (text: string, targetProfileId: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    const newMission: Task = {
      id: `${SECRET_MISSIONS_FILE}:-1`,
      text,
      completed: false,
      dueDate: date,
      tags: [],
      mentions: [],
      sourceFile: SECRET_MISSIONS_FILE,
      lineIndex: -1,
      secret: true,
      targetProfileId,
      secretStatus: 'active',
    };
    let existing: Task[] = [];
    try {
      const content = await vaultRef.current.readFile(SECRET_MISSIONS_FILE);
      existing = parseSecretMissions(content);
    } catch (e) { warnUnexpected('addSecretMission-read', e); }
    const updated = [...existing, newMission];
    await vaultRef.current.ensureDir('05 - Famille');
    const serialized = serializeSecretMissions(updated, profiles);
    await vaultRef.current.writeFile(SECRET_MISSIONS_FILE, serialized);
    setSecretMissions(parseSecretMissions(serialized));
  }, [profiles]);

  const completeSecretMission = useCallback(async (missionId: string) => {
    if (!vaultRef.current) return;
    const updated = secretMissions.map((m) =>
      m.id === missionId ? { ...m, secretStatus: 'pending' as const } : m
    );
    setSecretMissions(updated);
    const serialized = serializeSecretMissions(updated, profiles);
    await vaultRef.current.writeFile(SECRET_MISSIONS_FILE, serialized);
  }, [secretMissions, profiles]);

  const validateSecretMission = useCallback(async (missionId: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    const updated = secretMissions.map((m) =>
      m.id === missionId ? { ...m, secretStatus: 'validated' as const, completed: true, completedDate: date } : m
    );
    setSecretMissions(updated);
    const serialized = serializeSecretMissions(updated, profiles);
    await vaultRef.current.writeFile(SECRET_MISSIONS_FILE, serialized);
  }, [secretMissions, profiles]);

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
    setActiveProfile,
    saveNotifPrefs,
    updateMeal,
    loadMealsForWeek,
    photoDates,
    addPhoto,
    getPhotoUri,
    updateProfileTheme,
    updateProfile,
    deleteProfile,
    updateStockQuantity,
    addStockItem,
    deleteStockItem,
    updateStockItem,
    stockSections,
    toggleTask,
    addRDV,
    updateRDV,
    deleteRDV,
    addTask,
    editTask,
    deleteTask,
    addCourseItem,
    mergeCourseIngredients,
    toggleCourseItem,
    removeCourseItem,
    moveCourseItem,
    clearCompletedCourses,
    memories,
    addMemory,
    updateMemory,
    vacationConfig,
    vacationTasks,
    isVacationActive,
    activateVacation,
    deactivateVacation,
    refreshGamification,
    recipes,
    loadRecipes,
    addRecipe,
    deleteRecipe,
    renameRecipe,
    scanAllCookFiles,
    moveCookToRecipes,
    toggleFavorite,
    isFavorite,
    getFavorites,
    ageUpgrades,
    applyAgeUpgrade,
    dismissAgeUpgrade,
    addChild,
    convertToBorn,
    budgetEntries,
    budgetConfig,
    budgetMonth,
    setBudgetMonth,
    addExpense,
    deleteExpense,
    updateBudgetConfig,
    loadBudgetData,
    routines,
    saveRoutines,
    healthRecords,
    saveHealthRecord,
    addGrowthEntry,
    updateGrowthEntry,
    deleteGrowthEntry,
    addVaccineEntry,
    defis,
    createDefi,
    checkInDefi,
    completeDefi,
    deleteDefi,
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
    notes,
    addNote,
    updateNote,
    deleteNote,
    quotes,
    addQuote,
    deleteQuote,
    moods,
    addMood,
    deleteMood,
    skillTrees,
    unlockSkill,
    secretMissions,
    addSecretMission,
    completeSecretMission,
    validateSecretMission,
  }), [
    // State values (déclenchent un re-render quand ils changent)
    vaultPath, isLoading, error, tasks, courses, stock, meals,
    rdvs, profiles, activeProfile, gamiData, notifPrefs, vault, photoDates,
    stockSections, memories, vacationConfig, vacationTasks, isVacationActive,
    recipes, ageUpgrades, budgetEntries, budgetConfig, budgetMonth, routines,
    healthRecords, defis, gratitudeDays, wishlistItems, journalStats, anniversaries, notes,
    quotes, moods, skillTrees, secretMissions,
    // Callbacks (stables grâce à useCallback)
    refresh, setVaultPath, setActiveProfile, saveNotifPrefs, updateMeal, loadMealsForWeek,
    addPhoto, getPhotoUri, updateProfileTheme, updateProfile, deleteProfile,
    updateStockQuantity, addStockItem, deleteStockItem, updateStockItem,
    toggleTask, addRDV, updateRDV, deleteRDV, addTask, editTask, deleteTask,
    addCourseItem, mergeCourseIngredients, toggleCourseItem, removeCourseItem, moveCourseItem,
    clearCompletedCourses, addMemory, updateMemory, activateVacation,
    deactivateVacation, refreshGamification, addRecipe, deleteRecipe, renameRecipe,
    loadRecipes, scanAllCookFiles, moveCookToRecipes, toggleFavorite, isFavorite,
    getFavorites, applyAgeUpgrade, dismissAgeUpgrade, addChild, convertToBorn,
    setBudgetMonth, addExpense, deleteExpense, updateBudgetConfig, loadBudgetData,
    saveRoutines, saveHealthRecord, addGrowthEntry, updateGrowthEntry, deleteGrowthEntry, addVaccineEntry,
    createDefi, checkInDefi, completeDefi, deleteDefi,
    addGratitudeEntry, deleteGratitudeEntry,
    addWishItem, updateWishItem, deleteWishItem, toggleWishBought,
    addAnniversary, updateAnniversary, removeAnniversary, importAnniversaries,
    addNote, updateNote, deleteNote, addQuote, deleteQuote, addMood, deleteMood, unlockSkill,
    addSecretMission, completeSecretMission, validateSecretMission,
  ]);
}
