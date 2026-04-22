// ─────────────────────────────────────────────
// Compagnon Mascotte — Types & constantes
// ─────────────────────────────────────────────

/** 5 espèces de compagnons disponibles */
export type CompanionSpecies = 'chat' | 'chien' | 'lapin' | 'renard' | 'herisson';

/** 3 stades de croissance du compagnon */
export type CompanionStage = 'bebe' | 'jeune' | 'adulte';

/** Humeur du compagnon */
export type CompanionMood = 'content' | 'endormi' | 'excite' | 'triste';

/** Événements déclenchant un message du compagnon */
export type CompanionEvent =
  | 'task_completed'
  | 'loot_opened'
  | 'level_up'
  | 'greeting'
  | 'streak_milestone'
  | 'harvest'
  | 'craft'
  // Événements enrichis
  | 'routine_completed'
  | 'budget_alert'
  | 'meal_planned'
  | 'gratitude_written'
  | 'photo_added'
  | 'defi_completed'
  | 'family_milestone'
  | 'weekly_recap'
  // Messages proactifs
  | 'morning_greeting'
  | 'gentle_nudge'
  | 'comeback'
  | 'celebration'
  // Événements d'usure & bâtiments
  | 'building_full'
  | 'fence_broken'
  | 'roof_damaged'
  | 'weeds_growing'
  | 'pests_attacking'
  | 'wear_repaired';

/** Données persistées du compagnon dans le profil */
export interface CompanionData {
  activeSpecies: CompanionSpecies;
  name: string;
  unlockedSpecies: CompanionSpecies[];
  // Phase 20 — propagation événement sémantique (EFFECTS-04)
  lastEventType?: string;  // ex: 'task_completed' — rendu Phase 21
  lastEventAt?: string;    // ISO datetime du dernier événement
  /** Phase 42 — ISO du dernier nourrissage (cooldown 3h) */
  lastFedAt?: string;
  /** Phase 42 — buff XP actif (null = aucun) */
  feedBuff?: FeedBuff | null;
}

// ─────────────────────────────────────────────
// Phase 42 — Nourrir le compagnon (types & constantes)
// ─────────────────────────────────────────────

/** Phase 42 — Grade d'une récolte consommée pour nourrir (depuis HarvestInventory). */
export type HarvestGrade = 'ordinary' | 'good' | 'excellent' | 'perfect';

/** Phase 42 — Affinité crop↔espèce compagnon. */
export type CropAffinity = 'preferred' | 'neutral' | 'hated';

/** Phase 42 — Buff XP actif appliqué au compagnon. */
export interface FeedBuff {
  /** Multiplicateur XP final (ex: 1.15 × 1.3 = 1.495) */
  multiplier: number;
  /** ISO datetime d'expiration du buff */
  expiresAt: string;
}

/** Mapping stade → plage de niveaux */
export interface CompanionStageInfo {
  stage: CompanionStage;
  minLevel: number;
  maxLevel: number;
  labelKey: string;
}

/** Informations sur une espèce de compagnon */
export interface CompanionSpeciesInfo {
  id: CompanionSpecies;
  nameKey: string;
  descriptionKey: string;
  rarity: 'initial' | 'rare' | 'epique';
}

/** Contexte passé aux fonctions de message */
export interface CompanionMessageContext {
  profileName: string;
  companionName: string;
  companionSpecies: CompanionSpecies;
  tasksToday: number;
  streak: number;
  level: number;
  lastAction?: string;
  recentTasks?: string[];       // noms des dernières tâches complétées aujourd'hui
  nextRdv?: { title: string; date: string } | null;  // prochain RDV à venir
  todayMeals?: string[];        // repas planifiés aujourd'hui (ex: "Pâtes carbonara")
  recentMessages?: string[];    // 3 derniers messages du compagnon (mémoire courte)
  mood?: CompanionMood;          // humeur actuelle du compagnon
  moodScore?: number;            // score numérique de mood
  pendingTasks?: string[];       // tâches à faire aujourd'hui (pas encore complétées)
  timeOfDay?: 'matin' | 'apres-midi' | 'soir' | 'nuit';
  subType?: string;  // Phase 21 — CategoryId de la tache semantique, passe a pickCompanionMessage pour templates sub-type
}

/** Personnalité propre à chaque espèce de compagnon */
export interface CompanionPersonality {
  tone: string;       // description du ton pour le prompt IA
  traits: string[];   // traits de caractère
  quirk: string;      // particularité comportementale unique
}

/** Personnalités par espèce — injectées dans le prompt IA */
export const SPECIES_PERSONALITY: Record<CompanionSpecies, CompanionPersonality> = {
  chat: {
    tone: 'nonchalant et un peu moqueur, mais affectueux au fond',
    traits: ['indépendant', 'curieux', 'joueur'],
    quirk: 'fait parfois des remarques ironiques ou parle de siestes',
  },
  chien: {
    tone: 'enthousiaste et loyal, débordant de joie',
    traits: ['fidèle', 'énergique', 'protecteur'],
    quirk: 'célèbre chaque petite victoire comme un exploit énorme',
  },
  lapin: {
    tone: 'doux et timide, toujours encourageant',
    traits: ['calme', 'attentionné', 'sensible'],
    quirk: 'fait souvent référence à la nature, aux saisons ou au jardin',
  },
  renard: {
    tone: 'malin et stratégique, donne des astuces',
    traits: ['rusé', 'observateur', 'complice'],
    quirk: 'propose des stratégies ou remarque des détails que les autres manquent',
  },
  herisson: {
    tone: 'sage et philosophe, parle avec douceur',
    traits: ['patient', 'réfléchi', 'bienveillant'],
    quirk: 'partage parfois de petites sagesses ou métaphores sur la vie',
  },
};

/** Niveau requis pour débloquer le système compagnon */
export const COMPANION_UNLOCK_LEVEL = 1;

/** Bonus XP apporté par la présence d'un compagnon actif (+5%) */
export const COMPANION_XP_BONUS = 1.05;

/** Phase 42 — Cooldown entre feeds (3h en ms) — D-10 */
export const FEED_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 10_800_000

/** Phase 42 — Table grade → (multiplicateur, durée secondes) — D-05 */
export const GRADE_BUFF_TABLE: Record<HarvestGrade, { multiplier: number; durationSec: number }> = {
  ordinary:  { multiplier: 1.05, durationSec: 1800 },  // 30min
  good:      { multiplier: 1.10, durationSec: 2700 },  // 45min
  excellent: { multiplier: 1.12, durationSec: 3600 },  // 60min
  perfect:   { multiplier: 1.15, durationSec: 5400 },  // 90min
};

/** Phase 42 — Multiplicateur par affinité espèce/crop — D-06 */
export const AFFINITY_MULTIPLIER: Record<CropAffinity, number> = {
  preferred: 1.3,
  neutral:   1.0,
  hated:     0, // produit un buff null
};

/** Phase 42 — Préférence alimentaire par espèce — D-13 (OPTION A validée user 2026-04-22)
 *  Mapping officiel : redistribution parmi CROP_CATALOG existant.
 *  Chaque espèce a un préféré ET un détesté UNIQUES (pas de collision).
 *  Rationale : poisson/os/champignon/oignon absents de CROP_CATALOG.
 *  Extension future (fish/bone/mushroom/onion) = deferred v1.8+ (D-13-bis CONTEXT.md).
 */
export const COMPANION_PREFERENCES: Record<CompanionSpecies, { preferred: string; hated: string }> = {
  chat:     { preferred: 'strawberry', hated: 'cucumber' }, // fraise / concombre
  chien:    { preferred: 'pumpkin',    hated: 'tomato'   }, // potiron / tomate
  lapin:    { preferred: 'carrot',     hated: 'corn'     }, // carotte / maïs
  renard:   { preferred: 'beetroot',   hated: 'wheat'    }, // betterave / blé
  herisson: { preferred: 'potato',     hated: 'cabbage'  }, // pomme de terre / chou
};

/**
 * Les 3 stades du compagnon avec leurs plages de niveaux.
 * Bébé : 1-5, Jeune : 6-10, Adulte : 11+
 */
export const COMPANION_STAGES: CompanionStageInfo[] = [
  { stage: 'bebe',   minLevel: 1,  maxLevel: 5,  labelKey: 'companion.stage.bebe' },
  { stage: 'jeune',  minLevel: 6,  maxLevel: 10, labelKey: 'companion.stage.jeune' },
  { stage: 'adulte', minLevel: 11, maxLevel: 99, labelKey: 'companion.stage.adulte' },
];

/**
 * Catalogue des 5 espèces de compagnons.
 * chat/chien/lapin : disponibles au choix initial (per D-01 et D-03)
 * renard : rare (via lootbox)
 * herisson : épique (via lootbox)
 */
export const COMPANION_SPECIES_CATALOG: CompanionSpeciesInfo[] = [
  { id: 'chat',     nameKey: 'companion.species.chat',     descriptionKey: 'companion.speciesDesc.chat',     rarity: 'initial' },
  { id: 'chien',    nameKey: 'companion.species.chien',    descriptionKey: 'companion.speciesDesc.chien',    rarity: 'initial' },
  { id: 'lapin',    nameKey: 'companion.species.lapin',    descriptionKey: 'companion.speciesDesc.lapin',    rarity: 'initial' },
  { id: 'renard',   nameKey: 'companion.species.renard',   descriptionKey: 'companion.speciesDesc.renard',   rarity: 'rare' },
  { id: 'herisson', nameKey: 'companion.species.herisson', descriptionKey: 'companion.speciesDesc.herisson', rarity: 'epique' },
];

// ─────────────────────────────────────────────
// Phase 42 — Helpers purs (aucune dépendance)
// ─────────────────────────────────────────────

/** Phase 42 — Retourne l'affinité d'un crop pour une espèce donnée. */
export function getAffinity(species: CompanionSpecies, cropId: string): CropAffinity {
  const prefs = COMPANION_PREFERENCES[species];
  if (!prefs) return 'neutral';
  if (cropId === prefs.preferred) return 'preferred';
  if (cropId === prefs.hated) return 'hated';
  return 'neutral';
}

/** Phase 42 — Calcule le FeedBuff à appliquer, ou null si crop détesté. */
export function getBuffForCrop(
  grade: HarvestGrade,
  species: CompanionSpecies,
  cropId: string,
  nowMs: number = Date.now(),
): FeedBuff | null {
  const base = GRADE_BUFF_TABLE[grade];
  if (!base) return null;
  const affinity = getAffinity(species, cropId);
  const affMul = AFFINITY_MULTIPLIER[affinity];
  if (affMul === 0) return null; // détesté — pas de buff
  const multiplier = +(base.multiplier * affMul).toFixed(4);
  const expiresAt = new Date(nowMs + base.durationSec * 1000).toISOString();
  return { multiplier, expiresAt };
}

/** Phase 42 — Buff actif si expiresAt dans le futur. */
export function isBuffActive(
  feedBuff: FeedBuff | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!feedBuff) return false;
  const exp = new Date(feedBuff.expiresAt).getTime();
  if (isNaN(exp)) return false;
  return exp > nowMs;
}

/** Phase 42 — Retourne ms restants avant qu'un nouveau feed soit permis (0 si feed possible). */
export function getCooldownRemainingMs(
  lastFedAt: string | undefined,
  nowMs: number = Date.now(),
): number {
  if (!lastFedAt) return 0;
  const last = new Date(lastFedAt).getTime();
  if (isNaN(last)) return 0;
  const elapsed = nowMs - last;
  return Math.max(0, FEED_COOLDOWN_MS - elapsed);
}
