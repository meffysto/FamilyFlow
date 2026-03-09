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
 * - 02 - Maison/Ménage hebdo.md
 * - 04 - Rendez-vous/*.md
 * - famille.md
 * - gamification.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { VaultManager } from '../lib/vault';
import {
  parseTaskFile,
  parseMénage,
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
} from '../lib/parser';
import { processActiveRewards } from '../lib/gamification';
import { Task, RDV, CourseItem, MealItem, StockItem, Profile, GamificationData, NotificationPreferences, ProfileTheme, Memory, VacationConfig, Recipe, AgeUpgrade, AgeCategory, BudgetEntry, BudgetConfig, Routine, HealthRecord, GrowthEntry, VaccineEntry, Defi, DefiDayEntry, GratitudeDay } from '../lib/types';
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
import { scheduleRDVAlerts } from '../lib/scheduled-notifications';
import { nextOccurrence } from '../lib/recurrence';
import { format } from 'date-fns';

export const VAULT_PATH_KEY = 'vault_path';
export const ACTIVE_PROFILE_KEY = 'active_profile_id';

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
  menageTasks: Task[];    // today's ménage tasks
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
  updateMeal: (day: string, mealType: string, text: string, recipeRef?: string) => Promise<void>;
  photoDates: Record<string, string[]>;  // enfantId → dates with photos
  addPhoto: (enfantName: string, date: string, imageUri: string) => Promise<void>;
  getPhotoUri: (enfantName: string, date: string) => string | null;
  updateProfileTheme: (profileId: string, theme: ProfileTheme) => Promise<void>;
  updateProfile: (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string }) => Promise<void>;
  updateStockQuantity: (lineIndex: number, newQuantity: number) => Promise<void>;
  addStockItem: (item: Omit<StockItem, 'lineIndex'>) => Promise<void>;
  deleteStockItem: (lineIndex: number) => Promise<void>;
  updateStockItem: (lineIndex: number, updates: Partial<StockItem>) => Promise<void>;
  stockSections: string[];
  toggleTask: (task: Task, completed: boolean) => Promise<void>;
  addRDV: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  updateRDV: (sourceFile: string, rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  deleteRDV: (sourceFile: string) => Promise<void>;
  addTask: (text: string, targetFile: string, dueDate?: string, recurrence?: string) => Promise<void>;
  deleteTask: (sourceFile: string, lineIndex: number) => Promise<void>;
  addCourseItem: (text: string, section?: string) => Promise<void>;
  mergeCourseIngredients: (items: { text: string; name: string; quantity: number | null; section: string }[]) => Promise<{ added: number; merged: number }>;
  toggleCourseItem: (item: CourseItem, completed: boolean) => Promise<void>;
  removeCourseItem: (lineIndex: number) => Promise<void>;
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
  addRecipe: (category: string, data: { title: string; tags?: string[]; servings?: number; prepTime?: string; cookTime?: string; ingredients: { name: string; quantity?: string; unit?: string }[]; steps: string[] }) => Promise<void>;
  deleteRecipe: (sourceFile: string) => Promise<void>;
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
  addChild: (child: { name: string; avatar: string; birthdate: string; propre?: boolean; statut?: 'grossesse'; dateTerme?: string }) => Promise<void>;
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
  addVaccineEntry: (enfant: string, entry: VaccineEntry) => Promise<void>;
  defis: Defi[];
  createDefi: (defi: Omit<Defi, 'progress' | 'status'>) => Promise<void>;
  checkInDefi: (defiId: string, profileId: string, completed: boolean, value?: number, note?: string) => Promise<void>;
  completeDefi: (defiId: string) => Promise<void>;
  deleteDefi: (defiId: string) => Promise<void>;
  gratitudeDays: GratitudeDay[];
  addGratitudeEntry: (date: string, profileId: string, profileName: string, text: string) => Promise<void>;
  deleteGratitudeEntry: (date: string, profileId: string) => Promise<void>;
}

// Static task files (non-enfant)
const STATIC_TASK_FILES = [
  '02 - Maison/Tâches récurrentes.md',
];

const MENAGE_FILE = '02 - Maison/Ménage hebdo.md';
const COURSES_FILE = '02 - Maison/Liste de courses.md';
const RDV_DIR = '04 - Rendez-vous';
const RDV_ARCHIVES_DIR = 'Archives/Rendez-vous';
const FAMILLE_FILE = 'famille.md';
const GAMI_FILE = 'gamification.md';
const MEALS_FILE = '02 - Maison/Repas de la semaine.md';
const MEALS_TEMPLATE = `# Repas de la semaine

## Lundi
- Déjeuner:
- Dîner:

## Mardi
- Déjeuner:
- Dîner:

## Mercredi
- Déjeuner:
- Dîner:

## Jeudi
- Déjeuner:
- Dîner:

## Vendredi
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

export function useVaultInternal(): VaultState {
  const [vaultPath, setVaultPathState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [menageTasks, setMenageTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [rdvs, setRdvs] = useState<RDV[]>([]);
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
  const [defis, setDefis] = useState<Defi[]>([]);
  const [gratitudeDays, setGratitudeDays] = useState<GratitudeDay[]>([]);
  const vaultRef = useRef<VaultManager | null>(null);
  const busyRef = useRef(false); // Guard against AppState race condition

  // Load vault path + active profile from SecureStore on mount
  useEffect(() => {
    (async () => {
      try {
        const [stored, storedProfileId] = await Promise.all([
          SecureStore.getItemAsync(VAULT_PATH_KEY),
          SecureStore.getItemAsync(ACTIVE_PROFILE_KEY),
        ]);
        if (storedProfileId) setActiveProfileId(storedProfileId);
        if (stored) {
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

      // Build task file paths dynamically from enfant names
      const taskFiles = [
        ...enfantNames.map((name) => `01 - Enfants/${name}/Tâches récurrentes.md`),
        ...STATIC_TASK_FILES,
      ];

      // Load tasks
      const allTasks: Task[] = [];
      for (const relPath of taskFiles) {
        try {
          const content = await vault.readFile(relPath);
          const fileTasks = parseTaskFile(relPath, content);
          allTasks.push(...fileTasks);
        } catch (e) {
          debugErrors.push(`tasks[${relPath}]: ${e}`);
        }
      }
      setTasks(allTasks);

      // Load ménage tasks for today
      try {
        const menageContent = await vault.readFile(MENAGE_FILE);
        setMenageTasks(parseMénage(menageContent, MENAGE_FILE));
      } catch (e) {
        debugErrors.push(`ménage: ${e}`);
        setMenageTasks([]);
      }

      // Load routines
      try {
        const routinesContent = await vault.readFile(ROUTINES_FILE);
        setRoutines(parseRoutines(routinesContent));
      } catch (e) {
        debugErrors.push(`routines: ${e}`);
        setRoutines([]);
      }

      // Load courses
      try {
        const coursesContent = await vault.readFile(COURSES_FILE);
        setCourses(parseCourses(coursesContent, COURSES_FILE));
      } catch (e) {
        debugErrors.push(`courses: ${e}`);
        setCourses([]);
      }

      // Load stock
      try {
        const stockContent = await vault.readFile(STOCK_FILE);
        setStock(parseStock(stockContent));
        setStockSections(parseStockSections(stockContent));
      } catch (e) {
        debugErrors.push(`stock: ${e}`);
        setStock([]);
        setStockSections([]);
      }

      // Load meals (auto-create template if missing)
      try {
        if (!(await vault.exists(MEALS_FILE))) {
          const template = MEALS_TEMPLATE;
          await vault.writeFile(MEALS_FILE, template);
        }
        const mealsContent = await vault.readFile(MEALS_FILE);
        setMeals(parseMeals(mealsContent, MEALS_FILE));
      } catch (e) {
        debugErrors.push(`meals: ${e}`);
        setMeals([]);
      }

      // Load RDVs from active directory + archives
      try {
        await vault.ensureDir(RDV_DIR);
        const loadedRdvs: RDV[] = [];

        // Helper: load all .md files from a directory as RDVs
        const loadRdvsFromDir = async (dir: string) => {
          let files: string[] = [];
          try {
            files = await vault.listDir(dir);
          } catch {
            return;
          }
          for (const file of files) {
            if (!file.endsWith('.md')) continue;
            const relPath = `${dir}/${file}`;
            try {
              const content = await vault.readFile(relPath);
              const rdv = parseRDV(relPath, content);
              if (rdv && rdv.statut !== 'annulé') {
                loadedRdvs.push(rdv);
              }
            } catch {
              // skip unreadable files
            }
          }
        };

        // Active RDVs
        await loadRdvsFromDir(RDV_DIR);
        // Archived RDVs (past, moved by maintenance.py)
        await loadRdvsFromDir(RDV_ARCHIVES_DIR);

        loadedRdvs.sort((a, b) => a.date_rdv.localeCompare(b.date_rdv));
        setRdvs(loadedRdvs);
        // Schedule RDV notification alerts (fire-and-forget)
        scheduleRDVAlerts(loadedRdvs).catch(() => {});
      } catch (e) {
        debugErrors.push(`rdv: ${e}`);
        setRdvs([]);
      }

      // Load photo dates per child
      try {
        const photoMap: Record<string, string[]> = {};
        for (const name of enfantNames) {
          try {
            const dates = await vault.listPhotoDates(name);
            const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
            photoMap[id] = dates;
          } catch {
            // dir may not exist yet
          }
        }
        setPhotoDates(photoMap);
      } catch (e) {
        debugErrors.push(`photos: ${e}`);
        setPhotoDates({});
      }

      // Load souvenirs/jalons per child
      try {
        const allMemories: Memory[] = [];
        for (const name of enfantNames) {
          const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
          const jalonsPath = `${MEMOIRES_DIR}/${name}/Jalons.md`;
          try {
            if (await vault.exists(jalonsPath)) {
              const content = await vault.readFile(jalonsPath);
              allMemories.push(...parseJalons(name, id, content));
            }
          } catch {
            // file may not exist
          }
        }
        // Sort by date descending (most recent first)
        allMemories.sort((a, b) => b.date.localeCompare(a.date));
        setMemories(allMemories);
      } catch {
        setMemories([]);
      }

      // Load health records per child (parallel, no TOCTOU)
      try {
        const results = await Promise.all(
          enfantNames.map(async (name) => {
            const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
            try {
              const content = await vault.readFile(`${HEALTH_DIR}/${name}/Carnet de santé.md`);
              return parseHealthRecord(name, id, content);
            } catch { return null; }
          })
        );
        setHealthRecords(results.filter((r): r is HealthRecord => r !== null));
      } catch {
        setHealthRecords([]);
      }

      // Load défis familiaux
      try {
        const defisContent = await vault.readFile(DEFIS_FILE);
        const parsed = parseDefis(defisContent);
        // Auto-résolution statut : endDate passée → completed ou failed
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
          // Distribuer les récompenses pour les défis auto-complétés
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
            } catch { /* non-critique */ }
          }
        }
        setDefis(parsed);
      } catch {
        setDefis([]);
      }

      // Load gratitude
      try {
        const gratContent = await vault.readFile(GRATITUDE_FILE);
        setGratitudeDays(parseGratitude(gratContent));
      } catch {
        setGratitudeDays([]);
      }

      // Load notification preferences
      try {
        if (await vault.exists(NOTIF_FILE)) {
          const notifContent = await vault.readFile(NOTIF_FILE);
          setNotifPrefs(parseNotificationPrefs(notifContent));
        } else {
          // Create default notifications.md
          const defaults = getDefaultNotificationPrefs();
          await vault.writeFile(NOTIF_FILE, serializeNotificationPrefs(defaults));
          setNotifPrefs(defaults);
        }
      } catch (e) {
        debugErrors.push(`notifications: ${e}`);
      }

      // Load vacation mode
      try {
        const vacRaw = await SecureStore.getItemAsync(VACATION_STORE_KEY);
        if (vacRaw) {
          const config: VacationConfig = JSON.parse(vacRaw);
          const todayISO = new Date().toISOString().slice(0, 10);
          // Auto-deactivate if end date has passed
          if (config.active && config.endDate < todayISO) {
            const deactivated = { ...config, active: false };
            await SecureStore.setItemAsync(VACATION_STORE_KEY, JSON.stringify(deactivated));
            setVacationConfig(deactivated);
          } else {
            setVacationConfig(config);
          }
        } else {
          setVacationConfig(null);
        }
        // Load vacation tasks if file exists
        try {
          if (await vault.exists(VACATION_FILE)) {
            const vacContent = await vault.readFile(VACATION_FILE);
            setVacationTasks(parseTaskFile(VACATION_FILE, vacContent));
          } else {
            setVacationTasks([]);
          }
        } catch {
          setVacationTasks([]);
        }
      } catch (e) {
        debugErrors.push(`vacation: ${e}`);
        setVacationConfig(null);
        setVacationTasks([]);
      }

      // Load recipes (.cook files)
      try {
        const cookFiles = await vault.listFilesRecursive(RECIPES_DIR, '.cook');
        const loaded: Recipe[] = [];
        for (const relPath of cookFiles) {
          try {
            const content = await vault.readFile(relPath);
            loaded.push(parseRecipe(relPath, content));
          } catch {
            // skip unreadable .cook files
          }
        }
        loaded.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
        setRecipes(loaded);
      } catch {
        setRecipes([]);
      }

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
    setMenageTasks([]);
    setCourses([]);
    setStock([]);
    setStockSections([]);
    setMeals([]);
    setRdvs([]);
    setPhotoDates({});
    setMemories([]);
    setRecipes([]);
    setBudgetEntries([]);
    setBudgetConfig(DEFAULT_BUDGET_CONFIG);
    setVaultPathState(path);
    const vault = new VaultManager(path);
    vaultRef.current = vault;
    setIsLoading(true);
    await loadVaultData(vault);
    setIsLoading(false);
  }, [loadVaultData]);

  const setActiveProfile = useCallback(async (profileId: string) => {
    await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, profileId);
    setActiveProfileId(profileId);
  }, []);

  const saveNotifPrefs = useCallback(async (prefs: NotificationPreferences) => {
    if (!vaultRef.current) return;
    setNotifPrefs(prefs);
    await vaultRef.current.writeFile(NOTIF_FILE, serializeNotificationPrefs(prefs));
  }, []);

  const updateMeal = useCallback(async (day: string, mealType: string, text: string, recipeRef?: string) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(MEALS_FILE);
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

      await vaultRef.current.writeFile(MEALS_FILE, lines.join('\n'));
      setMeals(parseMeals(lines.join('\n'), MEALS_FILE));
    } catch (e) {
      throw new Error(`updateMeal: ${e}`);
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

      // Full reload to ensure consistency (file is already on disk)
      if (vaultRef.current) {
        await loadVaultData(vaultRef.current);
      }
    } finally {
      busyRef.current = false;
    }
  }, [loadVaultData]);

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

  const updateProfile = useCallback(async (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string; propre?: boolean }) => {
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

      await vaultRef.current.writeFile(FAMILLE_FILE, lines.join('\n'));
      await loadVaultData(vaultRef.current);
    } catch (e) {
      throw new Error(`updateProfile: ${e}`);
    }
  }, [loadVaultData]);

  const updateStockQuantity = useCallback(async (lineIndex: number, newQuantity: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const line = lines[lineIndex];
      // Table row: | Produit | Detail | Quantité | Seuil | QteAchat |
      // split('|') → ['', ' Produit ', ' Detail ', ' Quantité ', ' Seuil ', ' QteAchat ', '']
      // Column index 3 (0-based) is always the quantity
      const cells = line.split('|');
      if (cells.length >= 5) {
        const qty = Math.max(0, newQuantity);
        // Preserve padding by replacing just the number
        cells[3] = cells[3].replace(/\d+/, String(qty));
        if (!/\d/.test(cells[3])) {
          // Cell had no number (was empty/dash) — set it directly
          cells[3] = ` ${qty} `;
        }
      }

      lines[lineIndex] = cells.join('|');
      await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

      // Update local state immediately
      setStock((prev) =>
        prev.map((s) => s.lineIndex === lineIndex ? { ...s, quantite: Math.max(0, newQuantity) } : s)
      );
    } catch (e) {
      throw new Error(`updateStockQuantity: ${e}`);
    }
  }, []);

  const addStockItem = useCallback(async (item: Omit<StockItem, 'lineIndex'>) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      const newRow = serializeStockRow(item);

      // Find insertion point: last table row in the target section
      let insertIdx = -1;
      let inSection = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) {
          if (inSection) break; // hit next section
          if (lines[i].slice(3).trim() === item.section) inSection = true;
        }
        if (inSection && lines[i].startsWith('|') && !lines[i].includes('---')) {
          insertIdx = i;
        }
      }

      if (insertIdx === -1) {
        // Section not found or empty — append at end
        lines.push(newRow);
      } else {
        lines.splice(insertIdx + 1, 0, newRow);
      }

      await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));
      // Full reload to recalculate lineIndex values
      await loadVaultData(vaultRef.current);
    } catch (e) {
      throw new Error(`addStockItem: ${e}`);
    }
  }, [loadVaultData]);

  const deleteStockItem = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines.splice(lineIndex, 1);
        await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));
        await loadVaultData(vaultRef.current);
      }
    } catch (e) {
      throw new Error(`deleteStockItem: ${e}`);
    }
  }, [loadVaultData]);

  const updateStockItem = useCallback(async (lineIndex: number, updates: Partial<StockItem>) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      // Read current values from the existing line
      const cells = lines[lineIndex].split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length < 4) return;

      const current: Omit<StockItem, 'lineIndex'> = {
        produit: cells[0],
        detail: cells[1] || undefined,
        quantite: parseInt(cells[2], 10) || 0,
        seuil: parseInt(cells[3], 10) || 0,
        qteAchat: cells[4] ? parseInt(cells[4], 10) || undefined : undefined,
      };

      // Apply updates
      const updated = { ...current, ...updates };
      lines[lineIndex] = serializeStockRow(updated);
      await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

      // Optimistic update (lineIndex unchanged)
      setStock(prev => prev.map(s =>
        s.lineIndex === lineIndex
          ? { ...s, ...updates }
          : s
      ));
    } catch (e) {
      throw new Error(`updateStockItem: ${e}`);
    }
  }, []);

  /**
   * Toggle task + optimistic state update.
   * Writes to file AND immediately updates tasks/menageTasks state
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
      return { ...t, completed };
    };

    setTasks(prev => prev.map(updateTask));
    setMenageTasks(prev => prev.map(updateTask));
    setVacationTasks(prev => prev.map(updateTask));

    // No background loadVaultData — optimistic state is authoritative.
    // Next foreground event will fully sync.
  }, []);

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

    // Schedule alerts for the new RDV (fire-and-forget)
    scheduleRDVAlerts([newRDV]).catch(() => {});
  }, []);

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
  }, []);

  const deleteRDV = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    // Optimistic: remove from state immediately
    setRdvs(prev => prev.filter(r => r.sourceFile !== sourceFile));
  }, []);

  const addTask = useCallback(async (text: string, targetFile: string, dueDate?: string, recurrence?: string) => {
    if (!vaultRef.current) return;
    let taskText = text;
    if (recurrence) taskText += ` 🔁 ${recurrence}`;
    if (dueDate) taskText += ` 📅 ${dueDate}`;
    // Placer dans la bonne section selon la récurrence
    let section: string | null = null;
    if (recurrence) {
      if (/every\s+day/i.test(recurrence)) section = 'Quotidien';
      else if (/every\s+week/i.test(recurrence)) section = 'Hebdomadaire';
      else if (/every\s+month/i.test(recurrence)) section = 'Mensuel';
    }
    await vaultRef.current.appendTask(targetFile, section, taskText);
    await loadVaultData(vaultRef.current);
  }, [loadVaultData]);

  const deleteTask = useCallback(async (sourceFile: string, lineIndex: number) => {
    if (!vaultRef.current) return;
    const content = await vaultRef.current.readFile(sourceFile);
    const lines = content.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines.splice(lineIndex, 1);
      await vaultRef.current.writeFile(sourceFile, lines.join('\n'));
      await loadVaultData(vaultRef.current);
    }
  }, [loadVaultData]);

  const addCourseItem = useCallback(async (text: string, section?: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.appendTask(COURSES_FILE, section ?? null, text);
    await loadVaultData(vaultRef.current);
  }, [loadVaultData]);

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
        await loadVaultData(vaultRef.current);
      }
    } catch (e) {
      throw new Error(`removeCourseItem: ${e}`);
    }
  }, [loadVaultData]);

  /** Batch merge ingredients into the shopping list (single file write) */
  const mergeCourseIngredients = useCallback(async (items: { text: string; name: string; quantity: number | null; section: string }[]): Promise<{ added: number; merged: number }> => {
    if (!vaultRef.current) return { added: 0, merged: 0 };
    let added = 0;
    let merged = 0;

    try {
      let content = '';
      try { content = await vaultRef.current.readFile(COURSES_FILE); } catch { /* file may not exist */ }
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

      await vaultRef.current.writeFile(COURSES_FILE, lines.join('\n'));
      await loadVaultData(vaultRef.current);
    } catch (e) {
      throw new Error(`mergeCourseIngredients: ${e}`);
    }

    return { added, merged };
  }, [loadVaultData]);

  const clearCompletedCourses = useCallback(async () => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(COURSES_FILE);
      const lines = content.split('\n');
      const cleaned = lines.filter((l) => !l.match(/^-\s+\[x\]/i));
      await vaultRef.current.writeFile(COURSES_FILE, cleaned.join('\n'));
      await loadVaultData(vaultRef.current);
    } catch (e) {
      throw new Error(`clearCompletedCourses: ${e}`);
    }
  }, [loadVaultData]);

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
    } catch {
      // Create default Jalons.md
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
    // Reload to get parsed recipe
    await loadVaultData(vault);
  }, [loadVaultData]);

  const deleteRecipe = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setRecipes(prev => prev.filter(r => r.sourceFile !== sourceFile));
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
      } catch {
        // skip unreadable dirs
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
    await loadVaultData(vault);
  }, [loadVaultData]);

  // ─── Recipe Favorites (per-profile, persisted in SecureStore) ────────────

  const FAVORITES_KEY_PREFIX = 'recipe_favorites_';

  const loadFavorites = useCallback(async (profileId: string): Promise<string[]> => {
    try {
      const raw = await SecureStore.getItemAsync(`${FAVORITES_KEY_PREFIX}${profileId}`);
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* ignore */ }
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
    } catch {
      // ignore
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

    // Remove this upgrade from the list and reload
    setAgeUpgrades((prev) => prev.filter((u) => u.profileId !== upgrade.profileId));
    await loadVaultData(vault);
  }, [profiles, loadVaultData]);

  /** Dismiss an age upgrade notification without applying */
  const dismissAgeUpgrade = useCallback((profileId: string) => {
    setAgeUpgrades((prev) => prev.filter((u) => u.profileId !== profileId));
  }, []);

  const addChild = useCallback(async (child: { name: string; avatar: string; birthdate: string; propre?: boolean; statut?: 'grossesse'; dateTerme?: string }) => {
    if (!vaultRef.current) return;
    await vaultRef.current.addChild(child);
    await loadVaultData(vaultRef.current);
  }, [loadVaultData]);

  const convertToBorn = useCallback(async (profileId: string, birthdate: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.convertToBorn(profileId, birthdate);
    await loadVaultData(vaultRef.current);
  }, [loadVaultData]);

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
      } catch {
        await vaultRef.current.ensureDir(BUDGET_DIR);
        await vaultRef.current.writeFile(BUDGET_CONFIG_FILE, serializeBudgetConfig(DEFAULT_BUDGET_CONFIG));
        setBudgetConfig(DEFAULT_BUDGET_CONFIG);
      }
      // Load month entries (try read, fallback to empty)
      try {
        const content = await vaultRef.current.readFile(`${BUDGET_DIR}/${m}.md`);
        setBudgetEntries(parseBudgetMonth(content));
      } catch {
        setBudgetEntries([]);
      }
    } catch {
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
    } catch {
      // file doesn't exist yet — start fresh
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
    } catch {
      return; // file doesn't exist
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

  const addVaccineEntry = useCallback(async (enfant: string, entry: VaccineEntry) => {
    await addHealthEntry(enfant, 'vaccins', entry);
  }, [addHealthEntry]);

  // ─── Défis familiaux CRUD ──────────────────────────────────────────────────

  const createDefi = useCallback(async (defi: Omit<Defi, 'progress' | 'status'>) => {
    if (!vaultRef.current) return;
    const newDefi: Defi = { ...defi, status: 'active', progress: [] };
    const updated = [...defis, newDefi];
    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
    setDefis(updated);
  }, [defis]);

  const checkInDefi = useCallback(async (defiId: string, profileId: string, completed: boolean, value?: number, note?: string) => {
    if (!vaultRef.current) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = defis.map((d) => {
      if (d.id !== defiId) return d;
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
    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
    setDefis(updated);
  }, [defis]);

  const completeDefi = useCallback(async (defiId: string) => {
    if (!vaultRef.current) return;
    const defi = defis.find((d) => d.id === defiId);
    if (!defi) return;

    // Marquer comme complété
    const updated = defis.map((d) => d.id === defiId ? { ...d, status: 'completed' as const } : d);
    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
    setDefis(updated);

    // Distribuer les récompenses via gamification
    try {
      const gamiContent = await vaultRef.current.readFile(GAMI_FILE);
      const gami = parseGamification(gamiContent);
      const participantIds = defi.participants.length > 0
        ? defi.participants
        : profiles.map((p) => p.id);

      for (const pid of participantIds) {
        // Match par ID (profiles utilisent p.id = nom normalisé)
        const matchProfile = profiles.find((p) => p.id === pid);
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
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      setProfiles(mergeProfiles(familleContent, gamiStr));
      setGamiData(gami);
    } catch {
      // Non-critique — le défi est marqué complété quand même
    }
  }, [defis, profiles]);

  const deleteDefi = useCallback(async (defiId: string) => {
    if (!vaultRef.current) return;
    const updated = defis.filter((d) => d.id !== defiId);
    if (updated.length > 0) {
      await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
    } else {
      // Supprimer le fichier si plus aucun défi
      try { await vaultRef.current.deleteFile(DEFIS_FILE); } catch { /* ignore */ }
    }
    setDefis(updated);
  }, [defis]);

  // ─── Gratitude CRUD ──────────────────────────────────────────────────────

  const addGratitudeEntry = useCallback(async (date: string, profileId: string, profileName: string, text: string) => {
    if (!vaultRef.current) return;
    let days: GratitudeDay[];
    try {
      const content = await vaultRef.current.readFile(GRATITUDE_FILE);
      days = parseGratitude(content);
    } catch {
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
    } catch {
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
      try { await vaultRef.current.deleteFile(GRATITUDE_FILE); } catch { /* ignore */ }
    }
    setGratitudeDays(days);
  }, []);

  return {
    vaultPath,
    isLoading,
    error,
    tasks,
    menageTasks,
    courses,
    stock,
    meals,
    rdvs,
    profiles,
    activeProfile,
    gamiData,
    notifPrefs,
    vault: vaultRef.current,
    refresh,
    setVaultPath,
    setActiveProfile,
    saveNotifPrefs,
    updateMeal,
    photoDates,
    addPhoto,
    getPhotoUri,
    updateProfileTheme,
    updateProfile,
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
    deleteTask,
    addCourseItem,
    mergeCourseIngredients,
    toggleCourseItem,
    removeCourseItem,
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
    addRecipe,
    deleteRecipe,
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
    addVaccineEntry,
    defis,
    createDefi,
    checkInDefi,
    completeDefi,
    deleteDefi,
    gratitudeDays,
    addGratitudeEntry,
    deleteGratitudeEntry,
  };
}
