/**
 * vault-cache.ts — Cache mémoire persistant pour accélérer le re-launch
 *
 * Objectif : éviter le layout shift au démarrage en réhydratant le dashboard
 * depuis un snapshot de la session précédente, pendant que loadVaultData()
 * lit les vrais fichiers en arrière-plan.
 *
 * **API synchrone** (depuis SDK 54) — utilise expo-file-system File.textSync()
 * et file.write() pour permettre l'hydratation des useState dès le mount,
 * avant le premier render. Plus de double-paint vide → rempli.
 *
 * Exclusions volontaires (toujours chargés frais depuis le vault) :
 * - gamiData, defis, skillTrees, familyQuests (gamification)
 * - gardenRaw (jardin du village)
 * - Profil : champs farm/mascot/companion/saga + compteurs points/coins/level
 * - courses (Phase D 260428-huh : multi-listes — useVaultCourses gère son mount)
 *
 * Garde-fous :
 * - CACHE_VERSION : incrémenter à chaque changement de shape → cache invalidé
 * - try/catch silencieux partout : une panne cache = fallback au comportement actuel
 * - Cache hit n'empêche jamais loadVaultData() de tourner après
 */

import { File, Paths } from 'expo-file-system';
import type {
  Anniversary,
  BedtimeStory,
  ChildQuote,
  CourseItem,
  GratitudeDay,
  HealthRecord,
  LoveNote,
  MealItem,
  Memory,
  MoodEntry,
  NotificationPreferences,
  Note,
  Profile,
  RDV,
  Routine,
  SkillTreeData,
  StockItem,
  StoryDefaults,
  Task,
  VacationConfig,
  WishlistItem,
  AgeCategory,
  Gender,
  ProfileTheme,
} from './types';
import type { FamilyQuest } from './quest-engine';
import type { JournalSummaryEntry } from './ai-service';

// v5 : Phase 40 — shape WagerModifier étendu (tasksCompletedToday, lastDailyResetDate, totalDays)
//                + FarmProfileData.wagerLastRecomputeDate frontmatter
// v6 : Phase B grades (260421-obd) — HarvestInventory shape change (cropId → grade → qty)
//                + CraftedItem.grade optional
// v7 : Phase 42 — CompanionData étendu (lastFedAt?: string + feedBuff?: FeedBuff | null)
// v8 : Stories — Profile étendu (voiceCloneType, voiceTrainingStatus, voiceTrainingStartedAt, voiceTrainingMessage)
// v9 : RDV.rappels?: string[] — rappels personnalisés par RDV (1w|3d|1d|3h|1h|30m)
// v10: Profile.voiceTrainingProgress?: number — progression PVC ElevenLabs (0..1)
// v11: Profile.voiceElevenLabsIvcId / voiceElevenLabsPvcId — slots IVC + PVC indépendants
// v12: Ajout familyQuests, gardenRaw, skillTrees, stories pour que skipPhase2
//      n'efface pas ces sections (elles n'étaient pas dans le cache avant donc
//      le skip Phase 2 les laissait à leur état initial vide).
// v13: Phase B Histoires — Profile.storyDefaults (préférences durables wizard)
// Phase 48 (Export PDF Lulu) : aucun bump — manifeste impressions est un
// nouveau domaine NON inclus dans VaultCacheState (lecture rare, volume
// faible). Voir lib/pdf/manifest-parser.ts + .planning/phases/48-*/48-RESEARCH.md
// section "CACHE_VERSION Decision".
// v14: Phase quick-260516-oj6 — Task.timeSlot? ('matin'|'midi'|'aprem'|'soir')
//      ajouté au parser (nouveau champ optionnel). Bump pour éviter shape
//      desync entre cache v13 (sans timeSlot) et runtime v14.
const CACHE_VERSION = 14;
const CACHE_FILENAME = 'vault-cache-v14.json';

/** Profil allégé : uniquement les champs stables (nom, avatar, thème, diététique). */
export interface ProfileCacheEntry {
  id: string;
  name: string;
  role: Profile['role'];
  avatar: string;
  birthdate?: string;
  ageCategory?: AgeCategory;
  propre?: boolean;
  gender?: Gender;
  statut?: Profile['statut'];
  dateTerme?: string;
  theme?: ProfileTheme;
  voiceElevenLabsId?: string;
  voiceFishAudioId?: string;
  voicePersonalId?: string;
  voiceSource?: Profile['voiceSource'];
  voiceCloneType?: Profile['voiceCloneType'];
  voiceTrainingStatus?: Profile['voiceTrainingStatus'];
  voiceTrainingStartedAt?: string;
  voiceTrainingMessage?: string;
  storyDefaults?: StoryDefaults;
  foodAllergies?: string[];
  foodIntolerances?: string[];
  foodRegimes?: string[];
  foodAversions?: string[];
}

export interface VaultCacheState {
  version: number;
  savedAt: string;
  vaultPath: string | null;
  profiles: ProfileCacheEntry[];
  tasks: Task[];
  routines: Routine[];
  courses: CourseItem[];
  stock: StockItem[];
  stockSections: string[];
  meals: MealItem[];
  rdvs: RDV[];
  photoDates: Record<string, string[]>;
  memories: Memory[];
  healthRecords: HealthRecord[];
  journalStats: JournalSummaryEntry[];
  gratitudeDays: GratitudeDay[];
  wishlistItems: WishlistItem[];
  anniversaries: Anniversary[];
  notifPrefs: NotificationPreferences;
  vacationConfig: VacationConfig | null;
  vacationTasks: Task[];
  notes: Note[];
  quotes: ChildQuote[];
  moods: MoodEntry[];
  secretMissions: Task[];
  loveNotes: LoveNote[];
  familyQuests: FamilyQuest[];
  gardenRaw: string;
  skillTrees: SkillTreeData[];
  stories: BedtimeStory[];
}

/** Payload fourni par useVault — version et savedAt sont ajoutés lors du save. */
export type VaultCachePayload = Omit<VaultCacheState, 'version' | 'savedAt'>;

export function stripProfileForCache(p: Profile): ProfileCacheEntry {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    avatar: p.avatar,
    birthdate: p.birthdate,
    ageCategory: p.ageCategory,
    propre: p.propre,
    gender: p.gender,
    statut: p.statut,
    dateTerme: p.dateTerme,
    theme: p.theme,
    voiceElevenLabsId: p.voiceElevenLabsId,
    voiceFishAudioId: p.voiceFishAudioId,
    voicePersonalId: p.voicePersonalId,
    voiceSource: p.voiceSource,
    voiceCloneType: p.voiceCloneType,
    voiceTrainingStatus: p.voiceTrainingStatus,
    voiceTrainingStartedAt: p.voiceTrainingStartedAt,
    voiceTrainingMessage: p.voiceTrainingMessage,
    storyDefaults: p.storyDefaults,
    foodAllergies: p.foodAllergies,
    foodIntolerances: p.foodIntolerances,
    foodRegimes: p.foodRegimes,
    foodAversions: p.foodAversions,
  };
}

/**
 * Reconstitue un Profile à partir d'une entry cache + defaults sûrs pour
 * les champs exclus. loadVaultData() remplacera ces defaults par les vraies
 * valeurs (farmCrops, points, companion, etc.) dès qu'il aura fini.
 */
export function hydrateProfileFromCache(entry: ProfileCacheEntry): Profile {
  return {
    ...entry,
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
    points: 0,
    coins: 0,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
  };
}

function getCacheFile(): File {
  return new File(Paths.document, CACHE_FILENAME);
}

// Mémoïsation de la première lecture — évite de relire le fichier si plusieurs
// consommateurs appellent readCacheSync au boot (useState initializers).
let _memoizedSnapshot: VaultCacheState | null | undefined;

/**
 * Lit le snapshot mis en cache de manière **synchrone**. Utilisable dans un
 * `useState(() => readCacheSync()?.tasks ?? [])` pour pré-remplir l'état au
 * mount, avant le premier render.
 *
 * Retourne `null` si le cache n'existe pas, est corrompu, ou si la version
 * ne correspond pas (le fichier est alors supprimé silencieusement).
 */
export function readCacheSync(): VaultCacheState | null {
  if (_memoizedSnapshot !== undefined) return _memoizedSnapshot;
  try {
    const file = getCacheFile();
    if (!file.exists) {
      _memoizedSnapshot = null;
      return null;
    }
    const raw = file.textSync();
    const parsed = JSON.parse(raw) as Partial<VaultCacheState>;
    if (parsed.version !== CACHE_VERSION) {
      try { file.delete(); } catch { /* silent */ }
      _memoizedSnapshot = null;
      return null;
    }
    _memoizedSnapshot = parsed as VaultCacheState;
    return _memoizedSnapshot;
  } catch (e) {
    if (__DEV__) console.warn('[vault-cache] readCacheSync failed:', e);
    _memoizedSnapshot = null;
    return null;
  }
}

export function saveCache(payload: VaultCachePayload): void {
  try {
    const data: VaultCacheState = {
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      ...payload,
    };
    const file = getCacheFile();
    if (!file.exists) {
      file.create();
    }
    file.write(JSON.stringify(data));
    _memoizedSnapshot = data;
  } catch (e) {
    if (__DEV__) console.warn('[vault-cache] saveCache failed:', e);
  }
}

export function clearCache(): void {
  try {
    const file = getCacheFile();
    if (file.exists) file.delete();
  } catch { /* silent */ }
  _memoizedSnapshot = null;
}
