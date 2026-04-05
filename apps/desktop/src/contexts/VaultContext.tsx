import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { listVaultFiles, readVaultFile, writeVaultFile, deleteVaultFile, type VaultFile } from '../lib/vault-service';
import {
  parseTaskFile, parseRDV, parseFamille, parseGamification,
  mergeProfiles,
  parseMeals, parseCourses, parseStock, parseDefis,
  parseGratitude, parseQuotes, parseMoods, parseWishlist,
  parseAnniversaries, parseNote, parseSecretMissions,
  parseHealthRecord, parseRoutines, parseSkillTree, parsePregnancyJournal,
  parseBuildings, parseInventory, parseCrops, parseWearEvents,
  serializeRDV, serializeNote, serializeDefis, serializeGamification,
  serializeHealthRecord, serializeRoutines, serializeSkillTree, serializePregnancyJournal,
  noteFileName,
  openLootBox,
  type Task, type RDV, type MealItem, type CourseItem,
  type StockItem, type Profile, type Defi, type GratitudeDay,
  type ChildQuote, type MoodEntry, type WishlistItem,
  type Anniversary, type Note, type GamificationData,
  type HealthRecord, type Routine, type SkillTreeData,
  type PregnancyWeekEntry, type LootBox, type GamificationEntry,
  type TreeSpecies,
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
  healthRecords: HealthRecord[];
  routines: Routine[];
  skillTrees: SkillTreeData[];
  pregnancyEntries: PregnancyWeekEntry[];
}

export interface VaultContextValue extends VaultState {
  setVaultPath: (path: string) => void;
  clearVaultPath: () => void;
  refresh: () => Promise<void>;
  readFile: (relativePath: string) => Promise<string>;
  writeFile: (relativePath: string, content: string) => Promise<void>;
  setActiveProfile: (profile: Profile) => void;
  toggleTask: (task: Task) => Promise<void>;
  // RDV CRUD
  addRDV: (rdv: Omit<RDV, 'sourceFile'>) => Promise<void>;
  updateRDV: (rdv: RDV) => Promise<void>;
  deleteRDV: (rdv: RDV) => Promise<void>;
  // Notes CRUD
  addNote: (note: Omit<Note, 'sourceFile'>) => Promise<void>;
  updateNote: (note: Note) => Promise<void>;
  deleteNote: (note: Note) => Promise<void>;
  // Defis
  addDefi: (defi: Defi) => Promise<void>;
  updateDefi: (defi: Defi) => Promise<void>;
  // Loot
  openLootBox: () => Promise<{ box: LootBox; entries: GamificationEntry[] } | null>;
  markLootUsed: (rewardId: string) => Promise<void>;
  // Skills
  unlockSkill: (skillId: string, profileId?: string) => Promise<void>;
  // Health
  saveHealthRecord: (record: HealthRecord) => Promise<void>;
  addGrowthEntry: (enfantId: string, entry: HealthRecord['croissance'][number]) => Promise<void>;
  addVaccineEntry: (enfantId: string, entry: HealthRecord['vaccins'][number]) => Promise<void>;
  // Routines
  saveRoutines: (routines: Routine[]) => Promise<void>;
  completeRoutineStep: (routineId: string, stepIdx: number) => void;
  // Grossesse
  addPregnancyEntry: (entry: PregnancyWeekEntry, enfant: string) => Promise<void>;
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
  // Nouvelles données
  const [gamiData, setGamiData] = useState<GamificationData | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [skillTrees, setSkillTrees] = useState<SkillTreeData[]>([]);
  const [pregnancyEntries, setPregnancyEntries] = useState<PregnancyWeekEntry[]>([]);

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
    async (path: string): Promise<{ profiles: Profile[]; activeProfile: Profile | null }> => {
      try {
        // famille.md is at vault root
        const content = await readVaultFile(`${path}/famille.md`);
        const partial = parseFamille(content);

        // Load gamification per profile, merge with mergeProfiles (same as mobile)
        const gamiResults = await Promise.allSettled(
          partial.map((p) => readVaultFile(`${path}/gami-${p.id}.md`))
        );
        // Reconstruct combined gami data
        const allGamiProfiles: any[] = [];
        for (const result of gamiResults) {
          if (result.status === 'fulfilled' && result.value) {
            const g = parseGamification(result.value);
            allGamiProfiles.push(...g.profiles);
          }
        }
        const combinedGami: GamificationData = {
          profiles: allGamiProfiles,
          history: [],
          activeRewards: [],
          usedLoots: [],
        };
        const gamiContent = serializeGamification(combinedGami);
        const withGami = mergeProfiles(content, gamiContent);

        // Load farm data per profile from farm-{id}.md (mobile stores farm data separately)
        const farmResults = await Promise.allSettled(
          partial.map((p) => readVaultFile(`${path}/farm-${p.id}.md`))
        );
        const merged = withGami.map((profile, i) => {
          const result = farmResults[i];
          if (result?.status !== 'fulfilled' || !result.value) return profile;
          const props: Record<string, string> = {};
          for (const line of result.value.split('\n')) {
            if (line.startsWith('#') || !line.includes(': ')) continue;
            const idx = line.indexOf(': ');
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 2).trim();
            if (key && val) props[key] = val;
          }
          const validSpecies = new Set(['cerisier', 'chene', 'bambou', 'oranger', 'palmier']);
          return {
            ...profile,
            ...(props.tree_species && validSpecies.has(props.tree_species) ? { treeSpecies: props.tree_species as TreeSpecies } : {}),
            ...(props.farm_crops ? { farmCrops: props.farm_crops } : {}),
            ...(props.farm_buildings ? { farmBuildings: parseBuildings(props.farm_buildings) } : {}),
            ...(props.farm_inventory ? { farmInventory: parseInventory(props.farm_inventory) } : {}),
            ...(props.farm_tech ? { farmTech: props.farm_tech.split(',').map(s => s.trim()).filter(Boolean) } : {}),
            ...(props.mascot_decorations ? { mascotDecorations: props.mascot_decorations.split(',').map(s => s.trim()).filter(Boolean) } : {}),
            ...(props.mascot_inhabitants ? { mascotInhabitants: props.mascot_inhabitants.split(',').map(s => s.trim()).filter(Boolean) } : {}),
          };
        });

        const storedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
        const found = storedId
          ? merged.find((p) => p.id === storedId) ?? merged[0] ?? null
          : merged[0] ?? null;

        return { profiles: merged, activeProfile: found };
      } catch {
        return { profiles: [], activeProfile: null };
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

    // GamiData (profil actif — chargé via activeProfile dans loadProfiles mais aussi ici pour mutations)
    (async () => {
      try {
        const storedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
        if (!storedId) return;
        const content = await readVaultFile(`${path}/gami-${storedId}.md`);
        setGamiData(parseGamification(content));
      } catch {
        setGamiData(null);
      }
    })();

    // Health records (01 - Enfants/{Name}/Carnet de santé.md)
    (async () => {
      try {
        const healthFiles = vaultFiles.filter(
          (f) =>
            !f.is_directory &&
            f.relative_path.startsWith('01 - Enfants/') &&
            f.name === 'Carnet de santé.md' &&
            !f.relative_path.startsWith('01 - Enfants/Commun/'),
        );
        const results = await Promise.all(
          healthFiles.map(async (f) => {
            try {
              const content = await readVaultFile(f.path);
              // Extract enfant name from path: "01 - Enfants/{Name}/Carnet de santé.md"
              const parts = f.relative_path.split('/');
              const enfantName = parts[1] ?? '';
              const enfantId = enfantName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
              return parseHealthRecord(enfantName, enfantId, content) as HealthRecord;
            } catch {
              return null;
            }
          }),
        );
        setHealthRecords(results.filter((r): r is HealthRecord => r !== null));
      } catch {
        setHealthRecords([]);
      }
    })();

    // Routines
    (async () => {
      try {
        const content = await readVaultFile(`${path}/05 - Famille/Routines.md`);
        setRoutines(parseRoutines(content) as Routine[]);
      } catch {
        setRoutines([]);
      }
    })();

    // Skill trees (08 - Compétences/*.md)
    (async () => {
      try {
        const skillFiles = vaultFiles.filter(
          (f) =>
            !f.is_directory &&
            f.relative_path.startsWith('08 - Compétences/') &&
            f.name.endsWith('.md'),
        );
        const results = await Promise.all(
          skillFiles.map(async (f) => {
            try {
              const content = await readVaultFile(f.path);
              return parseSkillTree(content);
            } catch {
              return null;
            }
          }),
        );
        setSkillTrees(results.filter((r): r is SkillTreeData => r !== null));
      } catch {
        setSkillTrees([]);
      }
    })();

    // Pregnancy entries (03 - Journal/Grossesse/*.md)
    (async () => {
      try {
        const pregnancyFiles = vaultFiles.filter(
          (f) =>
            !f.is_directory &&
            f.relative_path.startsWith('03 - Journal/Grossesse/') &&
            f.name.endsWith('.md'),
        );
        const results = await Promise.all(
          pregnancyFiles.map(async (f) => {
            try {
              const content = await readVaultFile(f.path);
              return parsePregnancyJournal(content, f.relative_path);
            } catch {
              return [] as PregnancyWeekEntry[];
            }
          }),
        );
        setPregnancyEntries(results.flat());
      } catch {
        setPregnancyEntries([]);
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
  // Actions — base
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
    setHealthRecords([]);
    setRoutines([]);
    setSkillTrees([]);
    setPregnancyEntries([]);
  }, []);

  const setActiveProfile = useCallback((profile: Profile) => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    setActiveProfileState(profile);
    // Recharger gamiData pour le nouveau profil actif
    if (vaultPath) {
      readVaultFile(`${vaultPath}/gami-${profile.id}.md`)
        .then((content) => setGamiData(parseGamification(content)))
        .catch(() => setGamiData(null));
    }
  }, [vaultPath]);

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
  // Actions — RDV CRUD
  // -------------------------------------------------------------------------

  const addRDV = useCallback(
    async (rdv: Omit<RDV, 'sourceFile'>) => {
      if (!vaultPath) return;
      try {
        const filename = `${rdv.title || `rdv-${rdv.date_rdv}`}.md`;
        const relPath = `04 - Rendez-vous/${filename}`;
        const { title: _t, ...rdvWithoutTitle } = rdv;
        const content = serializeRDV(rdvWithoutTitle);
        await writeVaultFile(`${vaultPath}/${relPath}`, content);
        const newRdv: RDV = { ...rdv, sourceFile: relPath };
        setRdvs((prev) => [...prev, newRdv]);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur addRDV:', e);
      }
    },
    [vaultPath],
  );

  const updateRDV = useCallback(
    async (rdv: RDV) => {
      if (!vaultPath) return;
      try {
        const { title: _t, sourceFile, ...rdvData } = rdv;
        const content = serializeRDV(rdvData);
        await writeVaultFile(`${vaultPath}/${sourceFile}`, content);
        setRdvs((prev) => prev.map((r) => r.sourceFile === rdv.sourceFile ? rdv : r));
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur updateRDV:', e);
      }
    },
    [vaultPath],
  );

  const deleteRDV = useCallback(
    async (rdv: RDV) => {
      if (!vaultPath) return;
      try {
        await deleteVaultFile(`${vaultPath}/${rdv.sourceFile}`);
        setRdvs((prev) => prev.filter((r) => r.sourceFile !== rdv.sourceFile));
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur deleteRDV:', e);
      }
    },
    [vaultPath],
  );

  // -------------------------------------------------------------------------
  // Actions — Notes CRUD
  // -------------------------------------------------------------------------

  const addNote = useCallback(
    async (note: Omit<Note, 'sourceFile'>) => {
      if (!vaultPath) return;
      try {
        const filename = noteFileName(note.title);
        const relPath = `08 - Notes/${filename}`;
        const content = serializeNote(note);
        await writeVaultFile(`${vaultPath}/${relPath}`, content);
        const newNote: Note = { ...note, sourceFile: relPath };
        setNotes((prev) => [...prev, newNote]);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur addNote:', e);
      }
    },
    [vaultPath],
  );

  const updateNote = useCallback(
    async (note: Note) => {
      if (!vaultPath) return;
      try {
        const { sourceFile, ...noteData } = note;
        const content = serializeNote(noteData);
        await writeVaultFile(`${vaultPath}/${sourceFile}`, content);
        setNotes((prev) => prev.map((n) => n.sourceFile === note.sourceFile ? note : n));
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur updateNote:', e);
      }
    },
    [vaultPath],
  );

  const deleteNote = useCallback(
    async (note: Note) => {
      if (!vaultPath) return;
      try {
        await deleteVaultFile(`${vaultPath}/${note.sourceFile}`);
        setNotes((prev) => prev.filter((n) => n.sourceFile !== note.sourceFile));
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur deleteNote:', e);
      }
    },
    [vaultPath],
  );

  // -------------------------------------------------------------------------
  // Actions — Defis
  // -------------------------------------------------------------------------

  const addDefi = useCallback(
    async (defi: Defi) => {
      if (!vaultPath) return;
      try {
        const updatedDefis = [...defis, defi];
        const content = serializeDefis(updatedDefis);
        await writeVaultFile(`${vaultPath}/defis.md`, content);
        setDefis(updatedDefis);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur addDefi:', e);
      }
    },
    [vaultPath, defis],
  );

  const updateDefi = useCallback(
    async (defi: Defi) => {
      if (!vaultPath) return;
      try {
        const updatedDefis = defis.map((d) => d.id === defi.id ? defi : d);
        const content = serializeDefis(updatedDefis);
        await writeVaultFile(`${vaultPath}/defis.md`, content);
        setDefis(updatedDefis);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur updateDefi:', e);
      }
    },
    [vaultPath, defis],
  );

  // -------------------------------------------------------------------------
  // Actions — Loot
  // -------------------------------------------------------------------------

  const openLootBoxMutation = useCallback(
    async (): Promise<{ box: LootBox; entries: GamificationEntry[] } | null> => {
      if (!vaultPath || !activeProfile) return null;
      if (activeProfile.lootBoxesAvailable <= 0) return null;
      try {
        const gamiContent = await readVaultFile(`${vaultPath}/gami-${activeProfile.id}.md`);
        const currentGamiData = parseGamification(gamiContent);
        const result = openLootBox(activeProfile, currentGamiData);
        // Update gamiData with new profile state
        const updatedProfiles = currentGamiData.profiles.map((p) =>
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
          (r) => r.id !== rewardId,
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
  // Actions — Skills
  // -------------------------------------------------------------------------

  const unlockSkill = useCallback(
    async (skillId: string, profileId?: string) => {
      if (!vaultPath || !activeProfile) return;
      const targetProfileId = profileId ?? activeProfile.id;
      try {
        const relPath = `08 - Compétences/${targetProfileId}.md`;
        let currentData: SkillTreeData;
        try {
          const content = await readVaultFile(`${vaultPath}/${relPath}`);
          currentData = parseSkillTree(content);
        } catch {
          currentData = { profileId: targetProfileId, profileName: targetProfileId, unlocked: [] };
        }
        const alreadyUnlocked = currentData.unlocked.some((u) => u.skillId === skillId);
        if (alreadyUnlocked) return;
        const updatedData: SkillTreeData = {
          ...currentData,
          unlocked: [
            ...currentData.unlocked,
            { skillId, unlockedAt: new Date().toISOString().slice(0, 10), unlockedBy: activeProfile.id },
          ],
        };
        await writeVaultFile(`${vaultPath}/${relPath}`, serializeSkillTree(updatedData));
        setSkillTrees((prev) => {
          const idx = prev.findIndex((t) => t.profileId === targetProfileId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = updatedData;
            return updated;
          }
          return [...prev, updatedData];
        });
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur unlockSkill:', e);
      }
    },
    [vaultPath, activeProfile],
  );

  // -------------------------------------------------------------------------
  // Actions — Health
  // -------------------------------------------------------------------------

  const saveHealthRecord = useCallback(
    async (record: HealthRecord) => {
      if (!vaultPath) return;
      try {
        const relPath = `01 - Enfants/${record.enfant}/Carnet de santé.md`;
        const content = serializeHealthRecord(record);
        await writeVaultFile(`${vaultPath}/${relPath}`, content);
        setHealthRecords((prev) => {
          const idx = prev.findIndex((r) => r.enfantId === record.enfantId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = record;
            return updated;
          }
          return [...prev, record];
        });
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur saveHealthRecord:', e);
      }
    },
    [vaultPath],
  );

  const addGrowthEntry = useCallback(
    async (enfantId: string, entry: HealthRecord['croissance'][number]) => {
      if (!vaultPath) return;
      const record = healthRecords.find((r) => r.enfantId === enfantId);
      if (!record) return;
      const updatedRecord: HealthRecord = {
        ...record,
        croissance: [...record.croissance, entry].sort((a, b) => a.date.localeCompare(b.date)),
      };
      await saveHealthRecord(updatedRecord);
    },
    [vaultPath, healthRecords, saveHealthRecord],
  );

  const addVaccineEntry = useCallback(
    async (enfantId: string, entry: HealthRecord['vaccins'][number]) => {
      if (!vaultPath) return;
      const record = healthRecords.find((r) => r.enfantId === enfantId);
      if (!record) return;
      const updatedRecord: HealthRecord = {
        ...record,
        vaccins: [...record.vaccins, entry],
      };
      await saveHealthRecord(updatedRecord);
    },
    [vaultPath, healthRecords, saveHealthRecord],
  );

  // -------------------------------------------------------------------------
  // Actions — Routines
  // -------------------------------------------------------------------------

  const saveRoutinesMutation = useCallback(
    async (newRoutines: Routine[]) => {
      if (!vaultPath) return;
      try {
        const content = serializeRoutines(newRoutines);
        await writeVaultFile(`${vaultPath}/05 - Famille/Routines.md`, content);
        setRoutines(newRoutines);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur saveRoutines:', e);
      }
    },
    [vaultPath],
  );

  // completeRoutineStep is purely local state (no persistence needed — ephemeral session progress)
  const completeRoutineStep = useCallback(
    (_routineId: string, _stepIdx: number) => {
      // Routine step completion is session-only — no vault write needed
      // Screens track RoutineProgress locally via useState
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Actions — Grossesse
  // -------------------------------------------------------------------------

  const addPregnancyEntry = useCallback(
    async (entry: PregnancyWeekEntry, enfant: string) => {
      if (!vaultPath) return;
      try {
        const relPath = `03 - Journal/Grossesse/${enfant}.md`;
        let current: PregnancyWeekEntry[] = [];
        try {
          const existing = await readVaultFile(`${vaultPath}/${relPath}`);
          current = parsePregnancyJournal(existing, relPath);
        } catch {
          // File doesn't exist yet — start fresh
        }
        const updated = [...current.filter((e) => e.week !== entry.week), { ...entry, sourceFile: relPath }];
        const content = serializePregnancyJournal(updated, enfant);
        await writeVaultFile(`${vaultPath}/${relPath}`, content);
        setPregnancyEntries((prev) => {
          const filtered = prev.filter((e) => !(e.sourceFile === relPath && e.week === entry.week));
          return [...filtered, { ...entry, sourceFile: relPath }];
        });
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur addPregnancyEntry:', e);
      }
    },
    [vaultPath],
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
      healthRecords,
      routines,
      skillTrees,
      pregnancyEntries,
      setVaultPath,
      clearVaultPath,
      refresh,
      readFile,
      writeFile,
      setActiveProfile,
      toggleTask,
      addRDV,
      updateRDV,
      deleteRDV,
      addNote,
      updateNote,
      deleteNote,
      addDefi,
      updateDefi,
      openLootBox: openLootBoxMutation,
      markLootUsed,
      unlockSkill,
      saveHealthRecord,
      addGrowthEntry,
      addVaccineEntry,
      saveRoutines: saveRoutinesMutation,
      completeRoutineStep,
      addPregnancyEntry,
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
      healthRecords,
      routines,
      skillTrees,
      pregnancyEntries,
      setVaultPath,
      clearVaultPath,
      refresh,
      readFile,
      writeFile,
      setActiveProfile,
      toggleTask,
      addRDV,
      updateRDV,
      deleteRDV,
      addNote,
      updateNote,
      deleteNote,
      addDefi,
      updateDefi,
      openLootBoxMutation,
      markLootUsed,
      unlockSkill,
      saveHealthRecord,
      addGrowthEntry,
      addVaccineEntry,
      saveRoutinesMutation,
      completeRoutineStep,
      addPregnancyEntry,
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
