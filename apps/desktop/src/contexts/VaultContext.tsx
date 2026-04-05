import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { listVaultFiles, readVaultFile, writeVaultFile, type VaultFile } from '../lib/vault-service';
import {
  parseTaskFile, parseRDV, parseFamille, parseGamification, serializeGamification,
  openLootBox as openLootBoxEngine,
  parseMeals, parseCourses, parseStock, parseDefis,
  parseGratitude, parseQuotes, parseMoods, parseWishlist,
  parseAnniversaries, parseNote, parseSecretMissions,
  type Task, type RDV, type MealItem, type CourseItem,
  type StockItem, type Profile, type Defi, type GratitudeDay,
  type ChildQuote, type MoodEntry, type WishlistItem,
  type Anniversary, type Note, type GamificationData,
  type LootBox, type GamificationEntry,
} from '@family-vault/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VaultState {
  vaultPath: string | null;
  files: VaultFile[];
  loading: boolean;
  tasks: Task[];
  rdvs: RDV[];
  stock: StockItem[];
  profiles: Profile[];
  activeProfile: Profile | null;
  meals: MealItem[];
  courses: CourseItem[];
  defis: Defi[];
  gratitude: GratitudeDay[];
  quotes: ChildQuote[];
  moods: MoodEntry[];
  wishlist: WishlistItem[];
  anniversaries: Anniversary[];
  notes: Note[];
  secretMissions: Task[];
  gamiData: GamificationData | null;
}

export interface VaultContextValue extends VaultState {
  setVaultPath: (path: string) => void;
  clearVaultPath: () => void;
  refresh: () => Promise<void>;
  readFile: (relativePath: string) => Promise<string>;
  writeFile: (relativePath: string, content: string) => Promise<void>;
  setActiveProfile: (profile: Profile) => void;
  toggleTask: (task: Task) => Promise<void>;
  openLootBox: () => Promise<{ box: LootBox; entries: GamificationEntry[] } | null>;
  markLootUsed: (rewardId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const VaultContext = createContext<VaultContextValue | null>(null);

const VAULT_PATH_KEY = 'vault_path';
const ACTIVE_PROFILE_KEY = 'active_profile_id';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [vaultPath, setVaultPathState] = useState<string | null>(
    () => localStorage.getItem(VAULT_PATH_KEY),
  );
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rdvs, setRdvs] = useState<RDV[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [defis, setDefis] = useState<Defi[]>([]);
  const [gratitude, setGratitude] = useState<GratitudeDay[]>([]);
  const [quotes, setQuotes] = useState<ChildQuote[]>([]);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [secretMissions, setSecretMissions] = useState<Task[]>([]);
  const [gamiData, setGamiData] = useState<GamificationData | null>(null);

  // -------------------------------------------------------------------------
  // File I/O helpers
  // -------------------------------------------------------------------------

  const resolveAbsPath = useCallback(
    (relativePath: string): string => {
      if (!vaultPath) throw new Error('Vault path not set');
      return `${vaultPath}/${relativePath}`;
    },
    [vaultPath],
  );

  const readFile = useCallback(
    (relativePath: string) => readVaultFile(resolveAbsPath(relativePath)),
    [resolveAbsPath],
  );

  const writeFile = useCallback(
    (relativePath: string, content: string) =>
      writeVaultFile(resolveAbsPath(relativePath), content),
    [resolveAbsPath],
  );

  // -------------------------------------------------------------------------
  // Wave 1 — critical data
  // -------------------------------------------------------------------------

  const loadTasks = useCallback(async (path: string, vaultFiles: VaultFile[]): Promise<Task[]> => {
    const taskRelPaths: string[] = [];

    // Fixed task files
    taskRelPaths.push('02 - Maison/Tâches récurrentes.md');
    taskRelPaths.push('02 - Maison/Vacances.md');

    // Dynamic child task files: 01 - Enfants/{Name}/Tâches récurrentes.md
    const childTaskFiles = vaultFiles.filter(
      (f) =>
        !f.is_directory &&
        f.relative_path.startsWith('01 - Enfants/') &&
        f.name === 'Tâches récurrentes.md' &&
        // Exclude the Commun subfolder
        !f.relative_path.startsWith('01 - Enfants/Commun/'),
    );
    for (const f of childTaskFiles) {
      taskRelPaths.push(f.relative_path);
    }

    const results = await Promise.all(
      taskRelPaths.map(async (relPath) => {
        try {
          const content = await readVaultFile(`${path}/${relPath}`);
          return parseTaskFile(relPath, content);
        } catch {
          return [] as Task[];
        }
      }),
    );

    return results.flat();
  }, []);

  const loadRdvs = useCallback(
    async (path: string, vaultFiles: VaultFile[]): Promise<RDV[]> => {
      const rdvFiles = vaultFiles.filter(
        (f) =>
          !f.is_directory &&
          f.relative_path.startsWith('04 - Rendez-vous/') &&
          f.name.endsWith('.md'),
      );
      const results = await Promise.all(
        rdvFiles.map(async (f) => {
          try {
            const content = await readVaultFile(f.path);
            return parseRDV(f.relative_path, content);
          } catch {
            return null;
          }
        }),
      );
      return results.filter((r): r is RDV => r !== null);
    },
    [],
  );

  const loadProfiles = useCallback(
    async (path: string): Promise<{ profiles: Profile[]; activeProfile: Profile | null; gamiData: GamificationData | null }> => {
      try {
        // famille.md is at vault root
        const content = await readVaultFile(`${path}/famille.md`);
        const partial = parseFamille(content);

        // Build full profiles with gamification defaults
        const fullProfiles: Profile[] = partial.map((p) => ({
          points: 0,
          coins: 0,
          level: 1,
          streak: 0,
          lootBoxesAvailable: 0,
          multiplier: 1,
          multiplierRemaining: 0,
          pityCounter: 0,
          ...p,
        }));

        // Load gamification per profile and merge
        const merged = await Promise.all(
          fullProfiles.map(async (profile) => {
            try {
              const gamiContent = await readVaultFile(`${path}/gami-${profile.id}.md`);
              const gamiData: GamificationData = parseGamification(gamiContent);
              const gamiProfile = gamiData.profiles.find((gp) => gp.id === profile.id);
              if (gamiProfile) {
                return { ...profile, ...gamiProfile };
              }
            } catch {
              // File may not exist — keep defaults
            }
            return profile;
          }),
        );

        const storedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
        const found = storedId
          ? merged.find((p) => p.id === storedId) ?? merged[0] ?? null
          : merged[0] ?? null;

        // Load gamiData for the active profile
        let resolvedGamiData: GamificationData | null = null;
        if (found) {
          try {
            const gamiContent = await readVaultFile(`${path}/gami-${found.id}.md`);
            resolvedGamiData = parseGamification(gamiContent);
          } catch {
            // No gami file yet
          }
        }

        return { profiles: merged, activeProfile: found, gamiData: resolvedGamiData };
      } catch {
        return { profiles: [], activeProfile: null, gamiData: null };
      }
    },
    [],
  );

  const loadMeals = useCallback(async (path: string): Promise<MealItem[]> => {
    try {
      const monday = getCurrentMonday();
      const relPath = `02 - Maison/Repas semaine du ${monday}.md`;
      const content = await readVaultFile(`${path}/${relPath}`);
      return parseMeals(content, relPath);
    } catch {
      return [];
    }
  }, []);

  // -------------------------------------------------------------------------
  // Wave 2 — secondary data (non-blocking)
  // -------------------------------------------------------------------------

  const loadSecondaryData = useCallback(async (path: string, vaultFiles: VaultFile[]) => {
    // Stock
    (async () => {
      try {
        const content = await readVaultFile(`${path}/01 - Enfants/Commun/Stock & fournitures.md`);
        setStock(parseStock(content));
      } catch {
        setStock([]);
      }
    })();

    // Courses
    (async () => {
      try {
        const relPath = '02 - Maison/Liste de courses.md';
        const content = await readVaultFile(`${path}/${relPath}`);
        setCourses(parseCourses(content, relPath));
      } catch {
        setCourses([]);
      }
    })();

    // Defis
    (async () => {
      try {
        const content = await readVaultFile(`${path}/defis.md`);
        setDefis(parseDefis(content));
      } catch {
        setDefis([]);
      }
    })();

    // Gratitude
    (async () => {
      try {
        const content = await readVaultFile(`${path}/06 - Mémoires/Gratitude familiale.md`);
        setGratitude(parseGratitude(content));
      } catch {
        setGratitude([]);
      }
    })();

    // Quotes (mots d'enfants)
    (async () => {
      try {
        const content = await readVaultFile(`${path}/06 - Mémoires/Mots d'enfants.md`);
        setQuotes(parseQuotes(content));
      } catch {
        setQuotes([]);
      }
    })();

    // Moods
    (async () => {
      try {
        const content = await readVaultFile(`${path}/05 - Famille/Humeurs.md`);
        setMoods(parseMoods(content));
      } catch {
        setMoods([]);
      }
    })();

    // Wishlist
    (async () => {
      try {
        const content = await readVaultFile(`${path}/05 - Famille/Souhaits.md`);
        setWishlist(parseWishlist(content));
      } catch {
        setWishlist([]);
      }
    })();

    // Anniversaries
    (async () => {
      try {
        const content = await readVaultFile(`${path}/01 - Enfants/Commun/Anniversaires.md`);
        setAnniversaries(parseAnniversaries(content));
      } catch {
        setAnniversaries([]);
      }
    })();

    // Notes (08 - Notes/*.md)
    (async () => {
      try {
        const noteFiles = vaultFiles.filter(
          (f) =>
            !f.is_directory &&
            f.relative_path.startsWith('08 - Notes/') &&
            f.name.endsWith('.md'),
        );
        const results = await Promise.all(
          noteFiles.map(async (f) => {
            try {
              const content = await readVaultFile(f.path);
              return parseNote(f.relative_path, content);
            } catch {
              return null;
            }
          }),
        );
        setNotes(results.filter((n): n is Note => n !== null));
      } catch {
        setNotes([]);
      }
    })();

    // Secret missions
    (async () => {
      try {
        const content = await readVaultFile(`${path}/05 - Famille/Missions secrètes.md`);
        setSecretMissions(parseSecretMissions(content));
      } catch {
        setSecretMissions([]);
      }
    })();
  }, []);

  // -------------------------------------------------------------------------
  // Main load / refresh
  // -------------------------------------------------------------------------

  const loadVault = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        // Fetch file index first — needed for dynamic task discovery and RDV listing
        const vaultFiles = await listVaultFiles(path);
        setFiles(vaultFiles);

        // Wave 1: critical data — parallel
        const [parsedTasks, parsedRdvs, familyData, parsedMeals] = await Promise.all([
          loadTasks(path, vaultFiles),
          loadRdvs(path, vaultFiles),
          loadProfiles(path),
          loadMeals(path),
        ]);

        setTasks(parsedTasks);
        setRdvs(parsedRdvs);
        setProfiles(familyData.profiles);
        setActiveProfileState(familyData.activeProfile);
        setGamiData(familyData.gamiData);
        setMeals(parsedMeals);

        // Wave 2: secondary data — fire and forget, no UI blocking
        loadSecondaryData(path, vaultFiles);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur chargement vault:', e);
      } finally {
        setLoading(false);
      }
    },
    [loadTasks, loadRdvs, loadProfiles, loadMeals, loadSecondaryData],
  );

  const refresh = useCallback(async () => {
    if (vaultPath) await loadVault(vaultPath);
  }, [vaultPath, loadVault]);

  useEffect(() => {
    if (vaultPath) loadVault(vaultPath);
  }, [vaultPath, loadVault]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const setVaultPath = useCallback((path: string) => {
    localStorage.setItem(VAULT_PATH_KEY, path);
    setVaultPathState(path);
  }, []);

  const clearVaultPath = useCallback(() => {
    localStorage.removeItem(VAULT_PATH_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    setVaultPathState(null);
    setFiles([]);
    setTasks([]);
    setRdvs([]);
    setStock([]);
    setProfiles([]);
    setActiveProfileState(null);
    setMeals([]);
    setCourses([]);
    setDefis([]);
    setGratitude([]);
    setQuotes([]);
    setMoods([]);
    setWishlist([]);
    setAnniversaries([]);
    setNotes([]);
    setSecretMissions([]);
    setGamiData(null);
  }, []);

  const setActiveProfile = useCallback((profile: Profile) => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    setActiveProfileState(profile);
  }, []);

  const toggleTask = useCallback(
    async (task: Task) => {
      if (!vaultPath) return;
      try {
        const absPath = `${vaultPath}/${task.sourceFile}`;
        const content = await readVaultFile(absPath);
        const lines = content.split('\n');

        const line = lines[task.lineIndex];
        if (line === undefined) return;

        let newLine: string;
        if (task.completed) {
          // Mark incomplete: replace - [x] with - [ ]
          newLine = line.replace(/^(\s*-\s*)\[x\]/i, '$1[ ]');
        } else {
          // Mark complete: replace - [ ] with - [x]
          newLine = line.replace(/^(\s*-\s*)\[ \]/, '$1[x]');
        }

        if (newLine === line) return; // nothing changed

        lines[task.lineIndex] = newLine;
        await writeVaultFile(absPath, lines.join('\n'));

        // Refresh task list from affected file only for performance
        try {
          const updatedContent = await readVaultFile(absPath);
          const updatedTasks = parseTaskFile(task.sourceFile, updatedContent);
          setTasks((prev) => {
            const otherTasks = prev.filter((t) => t.sourceFile !== task.sourceFile);
            return [...otherTasks, ...updatedTasks];
          });
        } catch {
          // Fall back to full refresh
          if (vaultPath) {
            const vaultFiles = await listVaultFiles(vaultPath);
            const allTasks = await loadTasks(vaultPath, vaultFiles);
            setTasks(allTasks);
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur toggleTask:', e);
      }
    },
    [vaultPath, loadTasks],
  );

  // -------------------------------------------------------------------------
  // Actions — Loot
  // -------------------------------------------------------------------------

  const openLootBoxMutation = useCallback(
    async (): Promise<{ box: LootBox; entries: GamificationEntry[] } | null> => {
      if (!vaultPath || !activeProfile) return null;
      if ((activeProfile.lootBoxesAvailable ?? 0) <= 0) return null;
      try {
        const gamiContent = await readVaultFile(`${vaultPath}/gami-${activeProfile.id}.md`);
        const currentGamiData = parseGamification(gamiContent);
        const result = openLootBoxEngine(activeProfile, currentGamiData);
        const updatedProfiles = currentGamiData.profiles.map((p: Profile) =>
          p.id === activeProfile.id ? result.profile : p,
        );
        const updatedGamiData: GamificationData = {
          ...currentGamiData,
          profiles: updatedProfiles,
          history: [...currentGamiData.history, ...result.entries],
          activeRewards: [...(currentGamiData.activeRewards ?? []), ...result.newActiveRewards],
        };
        await writeVaultFile(`${vaultPath}/gami-${activeProfile.id}.md`, serializeGamification(updatedGamiData));
        setGamiData(updatedGamiData);
        setActiveProfileState(result.profile);
        setProfiles((prev) => prev.map((p) => p.id === activeProfile.id ? result.profile : p));
        return { box: result.box, entries: result.entries };
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur openLootBox:', e);
        return null;
      }
    },
    [vaultPath, activeProfile],
  );

  const markLootUsed = useCallback(
    async (rewardId: string) => {
      if (!vaultPath || !activeProfile) return;
      try {
        const gamiContent = await readVaultFile(`${vaultPath}/gami-${activeProfile.id}.md`);
        const currentGamiData = parseGamification(gamiContent);
        const updatedActiveRewards = (currentGamiData.activeRewards ?? []).filter(
          (r: { id: string }) => r.id !== rewardId,
        );
        const updatedGamiData: GamificationData = {
          ...currentGamiData,
          activeRewards: updatedActiveRewards,
        };
        await writeVaultFile(`${vaultPath}/gami-${activeProfile.id}.md`, serializeGamification(updatedGamiData));
        setGamiData(updatedGamiData);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur markLootUsed:', e);
      }
    },
    [vaultPath, activeProfile],
  );

  // -------------------------------------------------------------------------
  // Context value (stable reference via useMemo)
  // -------------------------------------------------------------------------

  const value = useMemo<VaultContextValue>(
    () => ({
      vaultPath,
      files,
      loading,
      tasks,
      rdvs,
      stock,
      profiles,
      activeProfile,
      meals,
      courses,
      defis,
      gratitude,
      quotes,
      moods,
      wishlist,
      anniversaries,
      notes,
      secretMissions,
      gamiData,
      setVaultPath,
      clearVaultPath,
      refresh,
      readFile,
      writeFile,
      setActiveProfile,
      toggleTask,
      openLootBox: openLootBoxMutation,
      markLootUsed,
    }),
    [
      vaultPath,
      files,
      loading,
      tasks,
      rdvs,
      stock,
      profiles,
      activeProfile,
      meals,
      courses,
      defis,
      gratitude,
      quotes,
      moods,
      wishlist,
      anniversaries,
      notes,
      secretMissions,
      gamiData,
      setVaultPath,
      clearVaultPath,
      refresh,
      readFile,
      writeFile,
      setActiveProfile,
      toggleTask,
      openLootBoxMutation,
      markLootUsed,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>');
  return ctx;
}
