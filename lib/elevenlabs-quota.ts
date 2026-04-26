/**
 * elevenlabs-quota.ts — Garde-fou coût ElevenLabs (cap quotidien en caractères).
 *
 * Protection contre les boucles UI/bugs qui cramerai­ent le quota EL :
 * tarif ~$0.30 / 10k chars (Cinéma v3) → cap par défaut 50 000 chars/jour ≈ 1,50€.
 *
 * Persistance dans expo-secure-store (cohérent avec rewards.ts, notifications.ts).
 * Reset automatique à minuit local : si la date stockée ≠ aujourd'hui, le compteur
 * repart à 0 sans intervention.
 *
 * Hook d'intégration : appeler `canConsume(charCount)` AVANT chaque appel TTS,
 * `recordConsumption(charCount)` APRÈS un succès. Les caractères consommés sont
 * ceux envoyés à ElevenLabs (texte sanitizé), pas les caractères Claude.
 */

import * as SecureStore from 'expo-secure-store';
import { format } from 'date-fns';

const QUOTA_KEY = 'elevenlabs_daily_quota_v1';
const LIMIT_KEY = 'elevenlabs_daily_limit_v1';
const DEFAULT_DAILY_LIMIT = 50_000; // ~1,50€ en Cinéma v3

type QuotaState = {
  /** Date locale du compteur au format YYYY-MM-DD */
  date: string;
  /** Caractères consommés ce jour */
  used: number;
};

let memCache: QuotaState | null = null;
let limitCache: number | null = null;

function todayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

async function loadState(): Promise<QuotaState> {
  if (memCache && memCache.date === todayLocal()) return memCache;

  try {
    const raw = await SecureStore.getItemAsync(QUOTA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuotaState;
      // Reset auto si on a changé de jour
      if (parsed.date !== todayLocal()) {
        const fresh: QuotaState = { date: todayLocal(), used: 0 };
        memCache = fresh;
        return fresh;
      }
      memCache = parsed;
      return parsed;
    }
  } catch (e) {
    if (__DEV__) console.warn('[quota] load failed:', e);
  }
  const fresh: QuotaState = { date: todayLocal(), used: 0 };
  memCache = fresh;
  return fresh;
}

async function saveState(state: QuotaState): Promise<void> {
  memCache = state;
  try {
    await SecureStore.setItemAsync(QUOTA_KEY, JSON.stringify(state));
  } catch (e) {
    if (__DEV__) console.warn('[quota] save failed:', e);
  }
}

/** Récupère la limite quotidienne configurée (caractères/jour) */
export async function getDailyLimit(): Promise<number> {
  if (limitCache !== null) return limitCache;
  try {
    const raw = await SecureStore.getItemAsync(LIMIT_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) {
        limitCache = n;
        return n;
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[quota] limit load failed:', e);
  }
  limitCache = DEFAULT_DAILY_LIMIT;
  return DEFAULT_DAILY_LIMIT;
}

/** Met à jour la limite quotidienne (caractères/jour). 0 ou négatif → désactive le cap. */
export async function setDailyLimit(limit: number): Promise<void> {
  const clean = Math.max(0, Math.floor(limit));
  limitCache = clean;
  await SecureStore.setItemAsync(LIMIT_KEY, String(clean));
}

export type QuotaUsage = {
  used: number;
  limit: number;
  remaining: number;
  /** % consommé (0..100) */
  percentage: number;
  date: string;
};

/** Snapshot du compteur du jour — utile pour l'UI de paramètres. */
export async function getDailyUsage(): Promise<QuotaUsage> {
  const state = await loadState();
  const limit = await getDailyLimit();
  const remaining = Math.max(0, limit - state.used);
  const percentage = limit > 0 ? Math.min(100, Math.round((state.used / limit) * 100)) : 0;
  return { used: state.used, limit, remaining, percentage, date: state.date };
}

/**
 * Vérifie si on peut consommer `chars` caractères supplémentaires aujourd'hui.
 * Si la limite est 0 (désactivée), retourne toujours { ok: true }.
 */
export async function canConsume(chars: number): Promise<{ ok: boolean; remaining: number; limit: number; used: number }> {
  const state = await loadState();
  const limit = await getDailyLimit();
  if (limit === 0) return { ok: true, remaining: Number.POSITIVE_INFINITY, limit: 0, used: state.used };
  const wouldUse = state.used + chars;
  const ok = wouldUse <= limit;
  const remaining = Math.max(0, limit - state.used);
  if (__DEV__ && !ok) {
    console.warn(`[quota] cap atteint — ${state.used}/${limit} ce jour, demande de ${chars} chars refusée`);
  }
  return { ok, remaining, limit, used: state.used };
}

/** Enregistre la consommation effective. À appeler APRÈS un appel TTS réussi. */
export async function recordConsumption(chars: number): Promise<void> {
  if (chars <= 0) return;
  const state = await loadState();
  const updated: QuotaState = { date: state.date, used: state.used + Math.floor(chars) };
  await saveState(updated);
  if (__DEV__) console.log(`[quota] +${chars} chars → ${updated.used} ce jour`);
}

/** Reset manuel (utile pour l'UI ou les tests). */
export async function resetDailyQuota(): Promise<void> {
  const fresh: QuotaState = { date: todayLocal(), used: 0 };
  await saveState(fresh);
  if (__DEV__) console.log('[quota] reset manuel');
}

/** Message d'erreur user-facing standard. */
export function quotaExceededError(used: number, limit: number): string {
  const usedK = Math.round(used / 1000);
  const limitK = Math.round(limit / 1000);
  return `Limite quotidienne ElevenLabs atteinte (${usedK}k / ${limitK}k caractères). Réessaie demain ou augmente la limite dans Paramètres → Histoires.`;
}
