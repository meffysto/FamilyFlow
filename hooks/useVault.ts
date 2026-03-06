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
  parseCourses,
  parseMeals,
  parseRDV,
  mergeProfiles,
  parseGamification,
  parseFamille,
  serializeGamification,
} from '../lib/parser';
import { processActiveRewards } from '../lib/gamification';
import { Task, RDV, CourseItem, MealItem, Profile, GamificationData, NotificationPreferences } from '../lib/types';
import {
  parseNotificationPrefs,
  serializeNotificationPrefs,
  getDefaultNotificationPrefs,
} from '../lib/notifications';

export const VAULT_PATH_KEY = 'vault_path';
export const ACTIVE_PROFILE_KEY = 'active_profile_id';

export interface VaultState {
  vaultPath: string | null;
  isLoading: boolean;
  error: string | null;
  tasks: Task[];          // all tasks from all tâches récurrentes files
  menageTasks: Task[];    // today's ménage tasks
  courses: CourseItem[];  // shopping list
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
  updateMeal: (day: string, mealType: string, text: string) => Promise<void>;
}

// Static task files (non-enfant)
const STATIC_TASK_FILES = [
  '02 - Maison/Tâches récurrentes.md',
];

const MENAGE_FILE = '02 - Maison/Ménage hebdo.md';
const COURSES_FILE = '02 - Maison/Liste de courses.md';
const RDV_DIR = '04 - Rendez-vous';
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
const NOTIF_FILE = 'notifications.md';

export function useVault(): VaultState {
  const [vaultPath, setVaultPathState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [menageTasks, setMenageTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [rdvs, setRdvs] = useState<RDV[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [gamiData, setGamiData] = useState<GamificationData | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotificationPrefs());
  const vaultRef = useRef<VaultManager | null>(null);

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

  // Refresh on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && vaultRef.current) {
        loadVaultData(vaultRef.current);
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

      // Load courses
      try {
        const coursesContent = await vault.readFile(COURSES_FILE);
        setCourses(parseCourses(coursesContent, COURSES_FILE));
      } catch (e) {
        debugErrors.push(`courses: ${e}`);
        setCourses([]);
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

      // Load RDVs from directory
      try {
        const rdvFiles = await vault.listDir(RDV_DIR);
        const loadedRdvs: RDV[] = [];
        for (const file of rdvFiles) {
          if (!file.endsWith('.md')) continue;
          const relPath = `${RDV_DIR}/${file}`;
          try {
            const content = await vault.readFile(relPath);
            const rdv = parseRDV(relPath, content);
            if (rdv && rdv.statut !== 'annulé') loadedRdvs.push(rdv);
          } catch {
            // skip individual rdv
          }
        }
        loadedRdvs.sort((a, b) => a.date_rdv.localeCompare(b.date_rdv));
        setRdvs(loadedRdvs);
      } catch (e) {
        debugErrors.push(`rdv: ${e}`);
        setRdvs([]);
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

  const updateMeal = useCallback(async (day: string, mealType: string, text: string) => {
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
            lines[i] = `- ${mealType}: ${text}`;
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

  // Resolve active profile from ID → Profile object
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  return {
    vaultPath,
    isLoading,
    error,
    tasks,
    menageTasks,
    courses,
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
  };
}
