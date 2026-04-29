/**
 * vault-cache.ts — Cache mémoire persistant pour accélérer le re-launch
 *
 * Objectif : éviter le layout shift au démarrage en réhydratant le dashboard
 * depuis un snapshot de la session précédente, pendant que loadVaultData()
 * lit les vrais fichiers en arrière-plan.
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

import * as FileSystem from 'expo-file-system/legacy';
import type {
  Anniversary,
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
  StockItem,
  Task,
  VacationConfig,
  WishlistItem,
  AgeCategory,
  Gender,
  ProfileTheme,
} from './types';
import type { JournalSummaryEntry } from './ai-service';

// v5 : Phase 40 — shape WagerModifier étendu (tasksCompletedToday, lastDailyResetDate, totalDays)
//                + FarmProfileData.wagerLastRecomputeDate frontmatter
// v6 : Phase B grades (260421-obd) — HarvestInventory shape change (cropId → grade → qty)
//                + CraftedItem.grade optional
// v7 : Phase 42 — CompanionData étendu (lastFedAt?: string + feedBuff?: FeedBuff | null)
// v8 : Stories — Profile étendu (voiceCloneType, voiceTrainingStatus, voiceTrainingStartedAt, voiceTrainingMessage)
// v9 : RDV.rappels?: string[] — rappels personnalisés par RDV (1w|3d|1d|3h|1h|30m)
const CACHE_VERSION = 9;
const CACHE_FILE_URI = FileSystem.documentDirectory + 'vault-cache-v9.json';

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

export async function saveCache(payload: VaultCachePayload): Promise<void> {
  try {
    const data: VaultCacheState = {
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      ...payload,
    };
    await FileSystem.writeAsStringAsync(CACHE_FILE_URI, JSON.stringify(data));
  } catch (e) {
    if (__DEV__) console.warn('[vault-cache] saveCache failed:', e);
  }
}

export async function hydrateFromCache(): Promise<VaultCacheState | null> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_FILE_URI);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(CACHE_FILE_URI);
    const parsed = JSON.parse(raw) as Partial<VaultCacheState>;
    if (parsed.version !== CACHE_VERSION) {
      await FileSystem.deleteAsync(CACHE_FILE_URI, { idempotent: true }).catch(() => {});
      return null;
    }
    return parsed as VaultCacheState;
  } catch (e) {
    if (__DEV__) console.warn('[vault-cache] hydrateFromCache failed:', e);
    try {
      await FileSystem.deleteAsync(CACHE_FILE_URI, { idempotent: true });
    } catch { /* silent */ }
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_FILE_URI, { idempotent: true });
  } catch { /* silent */ }
}
