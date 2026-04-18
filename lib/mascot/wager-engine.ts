/**
 * Moteur prorata Sporée — Phase 39
 *
 * Fonctions pures, zéro I/O, zéro new Date() sans paramètre, zéro import hook/UI.
 * Pattern identique à sporee-economy.ts (Phase 38) : toute date est injectée,
 * toutes les dépendances (Profile, Task, FamilySnapshot) sont des types data.
 *
 * Consommé exclusivement par la Phase 40 (câblage hooks + UI) — ce module ne
 * connaît ni le vault, ni les hooks, ni les composants.
 *
 * Requirements couverts : SPOR-03, SPOR-04, SPOR-05, SPOR-06, SPOR-13.
 */

import type { Profile, Task, WagerAgeCategory } from '../types';
import type { FamilySnapshot } from '../village/parser';
import { getLocalDateKey } from './sporee-economy';

// ─────────────────────────────────────────────
// Constantes poids par catégorie d'âge (D-02)
// ─────────────────────────────────────────────

/** Poids de pondération par catégorie d'âge (D-02). Somme pondérée -> prorata SPOR-04. */
export const WEIGHT_BY_CATEGORY: Record<WagerAgeCategory, number> = {
  adulte: 1.0,
  ado: 0.7,
  enfant: 0.4,
  jeune: 0.15,
  bebe: 0.0,
};

// ─────────────────────────────────────────────
// 1. yearsDiff + computeAgeCategory (D-02)
// ─────────────────────────────────────────────

/**
 * Différence en années révolues entre deux dates — équivalent de differenceInYears
 * sans dépendance externe (date-fns). Anniversaire non encore passé dans l'année
 * de référence → retourne age - 1.
 */
export function yearsDiff(from: Date, to: Date): number {
  let age = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) age--;
  return age;
}

/**
 * Dérive la catégorie d'âge depuis un birthdate (YYYY-MM-DD ou YYYY) et une
 * date de référence (YYYY-MM-DD). Bornes inclusives :
 *   0-2 bebe | 3-5 jeune | 6-12 enfant | 13-17 ado | 18+ adulte.
 */
export function computeAgeCategory(birthdate: string, today: string): WagerAgeCategory {
  const normalizedBirth = birthdate.length === 4 ? `${birthdate}-01-01` : birthdate;
  const birth = new Date(normalizedBirth + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  const age = yearsDiff(birth, now);
  if (age <= 2) return 'bebe';
  if (age <= 5) return 'jeune';
  if (age <= 12) return 'enfant';
  if (age <= 17) return 'ado';
  return 'adulte';
}

// ─────────────────────────────────────────────
// 2. resolveWeight (D-03)
// ─────────────────────────────────────────────

/**
 * Résout le poids effectif d'un profil pour le prorata.
 * Priorité : weight_override > birthdate dérivé > fallback adulte 1.0.
 * Sans override ni birthdate, émet un console.warn (__DEV__ uniquement).
 */
export function resolveWeight(profile: Profile, today: string): number {
  if (profile.weight_override) {
    return WEIGHT_BY_CATEGORY[profile.weight_override];
  }
  if (!profile.birthdate) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        `[wager-engine] profil ${profile.id} sans birthdate ni weight_override — fallback adulte 1.0`,
      );
    }
    return 1.0;
  }
  return WEIGHT_BY_CATEGORY[computeAgeCategory(profile.birthdate, today)];
}

// ─────────────────────────────────────────────
// 3. isProfileActive7d (SPOR-05)
// ─────────────────────────────────────────────

/**
 * Détecte si un profil a complété ≥1 tâche dans la fenêtre [today - 7j, today].
 * Attribution tâche→profil : triple check (mentions.includes(id), mentions.includes(name),
 * sourceFile.includes(name) — toutes case-insensitive pour le nom).
 * Requiert completedDate explicite : tâches completed=true sans date sont ignorées (Pitfall 3).
 * Bornes [t-7j, t] inclusives.
 */
export function isProfileActive7d(
  tasks: Task[],
  profile: Profile,
  today: string,
): boolean {
  const todayMs = new Date(today + 'T00:00:00').getTime();
  const sevenDaysAgoMs = todayMs - 7 * 86400000;
  const nameLower = profile.name.toLowerCase();
  return tasks.some(t => {
    if (!t.completed || !t.completedDate) return false;
    const byProfile =
      t.mentions.includes(profile.id) ||
      t.mentions.includes(profile.name) ||
      t.sourceFile.toLowerCase().includes(nameLower);
    if (!byProfile) return false;
    const tMs = new Date(t.completedDate + 'T00:00:00').getTime();
    return tMs >= sevenDaysAgoMs && tMs <= todayMs;
  });
}

// ─────────────────────────────────────────────
// 4. filterTasksForWager (SPOR-06)
// ─────────────────────────────────────────────

/**
 * Ne conserve que les tâches du domaine "Tasks" — celles dont le sourceFile
 * pointe vers un fichier `Tâches récurrentes.md` (avec ou sans accent).
 * Exclut explicitement Courses / Repas / Routines / Anniversaires / Notes / Moods.
 */
export function filterTasksForWager(tasks: Task[]): Task[] {
  return tasks.filter(t => {
    const sf = t.sourceFile.toLowerCase();
    return sf.includes('tâches récurrentes') || sf.includes('taches recurrentes');
  });
}

// ─────────────────────────────────────────────
// 5. computeCumulTarget (SPOR-03/04/05, formule prorata D-04)
// ─────────────────────────────────────────────

/** Résultat du calcul pondéré famille pour un pari donné. */
export interface FamilyWeightResult {
  cumulTarget: number;
  activeProfileIds: string[];
  weights: Record<string, number>;
  sealerWeight: number;
  familyWeightSum: number;
}

/**
 * Calcule la cible cumulative SPOR-04 : Math.ceil((sealerWeight / familyWeightSum) * pendingCount).
 *
 * Règles :
 *  - Profils en statut 'grossesse' exclus du dénominateur (Pitfall 2).
 *  - Un profil est "actif" s'il est le sealeur OU s'il a complété ≥1 tâche dans les 7j.
 *  - Seuls les actifs à poids > 0 contribuent à familyWeightSum.
 *  - Fallback D-04 : si familyWeightSum === 0 OU sealeur introuvable, cumulTarget = pendingCount.
 */
export function computeCumulTarget(opts: {
  sealerProfileId: string;
  allProfiles: Profile[];
  tasks: Task[];            // tâches déjà filtrées filterTasksForWager
  today: string;
  pendingCount: number;
}): FamilyWeightResult {
  const { sealerProfileId, allProfiles, tasks, today, pendingCount } = opts;

  // Exclure profils en statut grossesse (Pitfall 2)
  const eligible = allProfiles.filter(p => p.statut !== 'grossesse');

  // Résoudre poids par profil + détection actifs
  const weights: Record<string, number> = {};
  const activeProfileIds: string[] = [];
  let familyWeightSum = 0;
  for (const p of eligible) {
    const w = resolveWeight(p, today);
    weights[p.id] = w;
    const isActive = p.id === sealerProfileId || isProfileActive7d(tasks, p, today);
    if (isActive && w > 0) {
      activeProfileIds.push(p.id);
      familyWeightSum += w;
    }
  }

  const sealer = eligible.find(p => p.id === sealerProfileId);
  const sealerWeight = sealer ? (weights[sealerProfileId] ?? 0) : 0;

  // D-04 fallback : diviseur = 0 OU sealeur introuvable → cumulTarget = pendingCount
  if (familyWeightSum === 0 || !sealer) {
    return { cumulTarget: pendingCount, activeProfileIds, weights, sealerWeight, familyWeightSum };
  }

  const ratio = sealerWeight / familyWeightSum;
  return {
    cumulTarget: Math.ceil(ratio * pendingCount),
    activeProfileIds,
    weights,
    sealerWeight,
    familyWeightSum,
  };
}

// ─────────────────────────────────────────────
// 6. canSealWager (D-04 — refus poids 0)
// ─────────────────────────────────────────────

/** Résultat typé discriminé du check "peut-on sceller un pari ?". */
export type CanSealResult =
  | { ok: true }
  | { ok: false; reason: 'zero_weight' | 'profile_not_found' };

/**
 * Vérifie si un profil peut sceller un pari.
 * Refus si le profil est introuvable ou si son poids résolu = 0 (bébé par défaut
 * ou override='bebe'). Jamais d'exception — toujours un résultat discriminé.
 */
export function canSealWager(opts: {
  sealerProfileId: string;
  allProfiles: Profile[];
  today: string;
}): CanSealResult {
  const { sealerProfileId, allProfiles, today } = opts;
  const sealer = allProfiles.find(p => p.id === sealerProfileId);
  if (!sealer) return { ok: false, reason: 'profile_not_found' };
  const w = resolveWeight(sealer, today);
  if (w === 0) return { ok: false, reason: 'zero_weight' };
  return { ok: true };
}

// ─────────────────────────────────────────────
// 7. shouldRecompute + maybeRecompute (D-05, D-06)
// ─────────────────────────────────────────────

/**
 * Retourne true si un recompute du prorata est nécessaire :
 *  - lastRecomputeDate < today (catchup boot / jour différent)
 *  - lastRecomputeDate vide ('' ou undefined) — premier recompute
 * Retourne false si lastRecomputeDate === today (no-op même jour) ou > today (défensif).
 */
export function shouldRecompute(now: Date, lastRecomputeDate: string): boolean {
  const todayKey = getLocalDateKey(now);
  if (!lastRecomputeDate) return true;
  if (lastRecomputeDate === todayKey) return false;
  if (lastRecomputeDate < todayKey) return true;
  // lastRecomputeDate > todayKey : ne devrait jamais arriver en prod, défensif.
  return false;
}

/** Résultat typé discriminé du wrapper `maybeRecompute`. */
export type MaybeRecomputeResult =
  | { recomputed: false }
  | { recomputed: true; result: FamilyWeightResult; newRecomputeDate: string };

/**
 * Wrapper qui délègue à computeCumulTarget si shouldRecompute=true, sinon no-op.
 * Le hook Phase 40 gère l'I/O (lecture/écriture snapshot + persistance
 * lastRecomputeDate). Pure : n'effectue aucune mutation.
 */
export function maybeRecompute(opts: {
  now: Date;
  lastRecomputeDate: string;
  snapshot: FamilySnapshot | null;
  sealerProfileId: string;
  allProfiles: Profile[];
  tasks: Task[];
}): MaybeRecomputeResult {
  if (!shouldRecompute(opts.now, opts.lastRecomputeDate)) {
    return { recomputed: false };
  }
  const today = getLocalDateKey(opts.now);
  const pendingCount = opts.snapshot?.pending ?? 0;
  const result = computeCumulTarget({
    sealerProfileId: opts.sealerProfileId,
    allProfiles: opts.allProfiles,
    tasks: opts.tasks,
    today,
    pendingCount,
  });
  return { recomputed: true, result, newRecomputeDate: today };
}

// ─────────────────────────────────────────────
// 8. validateWagerOnHarvest (SPOR-07 fondation, consommé Phase 40)
// ─────────────────────────────────────────────

/** Résultat de la validation d'un pari au moment de la récolte. */
export interface WagerHarvestResult {
  won: boolean;
  cumulCurrent: number;
  cumulTarget: number;
}

/**
 * Valide un pari au moment de la récolte.
 * won = true SSI cumulTarget === 0 (pari auto-gagné D-04) OU cumulCurrent >= cumulTarget.
 */
export function validateWagerOnHarvest(
  cumulCurrent: number,
  cumulTarget: number,
): WagerHarvestResult {
  return {
    won: cumulTarget === 0 || cumulCurrent >= cumulTarget,
    cumulCurrent,
    cumulTarget,
  };
}
