/**
 * Family Lightning credentials — persistance via expo-secure-store
 *
 * Phase 53 — wallet famille parent + sub-wallets membres (REQ-12 rename Child→Member).
 *
 * Stockée sous une clé SecureStore distincte de la config single-wallet
 * (lightning_lnbits_config_v1) pour éviter les conflits. La migration auto
 * single→family (REQ-11) vit dans `migration.ts`.
 *
 * Format : JSON FamilyLightningConfig complet (famille + tous les membres +
 * triggerMode + dailyCapPerMember).
 * Clé : lightning_family_config_v1
 *
 * Backward-compat REQ-12 :
 * - `loadFamilyConfig` accepte un JSON contenant SOIT `members: [...]` SOIT
 *   le champ legacy `children: [...]` (configs écrites par les anciennes
 *   versions du spike 004). À la lecture, le retour est toujours normalisé
 *   avec `members`.
 * - `saveFamilyConfig` écrit TOUJOURS `members` (jamais `children`). La
 *   migration silencieuse se fait au prochain save.
 *
 * REQ-3 / REQ-4 :
 * - `triggerMode` default 'instant' si absent ou invalide.
 * - `dailyCapPerMember` clampé 100-10000, default 1000 si absent ou non
 *   numérique.
 *
 * Logs `__DEV__` only — JAMAIS le contenu des keys (adminKey, invoiceKey).
 */

import * as SecureStore from 'expo-secure-store';
import {
  DEFAULT_HYBRID_THRESHOLD_SATS,
  HYBRID_THRESHOLD_MIN_SATS,
} from './trigger-mode';
import type { FamilyLightningConfig, MemberWalletMapping } from './types';

const FAMILY_KEY = 'lightning_family_config_v1';

const DEFAULT_DAILY_CAP = 1000;
const DAILY_CAP_MIN = 100;
const DAILY_CAP_MAX = 10000;

function parseTriggerMode(value: unknown): FamilyLightningConfig['triggerMode'] {
  if (value === 'daily-review' || value === 'hybrid') return value;
  return 'instant';
}

function parseDailyCap(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DAILY_CAP;
  return Math.max(DAILY_CAP_MIN, Math.min(DAILY_CAP_MAX, Math.floor(value)));
}

/**
 * Parse + clamp le seuil hybrid. Min 100 sats, max = plafond quotidien
 * (un seuil > plafond n'a aucun sens — la bascule arriverait après le cap).
 * Défaut `DEFAULT_HYBRID_THRESHOLD_SATS` (500) si absent ou non numérique.
 */
function parseHybridThreshold(value: unknown, dailyCap: number): number {
  const raw = typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value)
    : DEFAULT_HYBRID_THRESHOLD_SATS;
  return Math.max(HYBRID_THRESHOLD_MIN_SATS, Math.min(dailyCap, raw));
}

export async function loadFamilyConfig(): Promise<FamilyLightningConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(FAMILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.baseUrl !== 'string' ||
      !parsed.family ||
      typeof parsed.family !== 'object'
    ) {
      return null;
    }
    const family = parsed.family as Record<string, unknown>;
    if (
      typeof family.invoiceKey !== 'string' ||
      typeof family.adminKey !== 'string'
    ) {
      return null;
    }

    // Backward-compat REQ-12 : accepter `members` OU `children` à la lecture.
    const membersArrayRaw = Array.isArray(parsed.members)
      ? parsed.members
      : Array.isArray((parsed as { children?: unknown }).children)
        ? (parsed as { children: unknown[] }).children
        : [];

    const members: MemberWalletMapping[] = (membersArrayRaw as unknown[])
      .filter((m): m is Record<string, unknown> =>
        !!m &&
        typeof m === 'object' &&
        typeof (m as Record<string, unknown>).profileId === 'string' &&
        typeof (m as Record<string, unknown>).displayName === 'string' &&
        typeof (m as Record<string, unknown>).invoiceKey === 'string',
      )
      .map((m) => {
        const adminKeyRaw = m.adminKey;
        const adminKey = typeof adminKeyRaw === 'string' && adminKeyRaw.trim()
          ? adminKeyRaw
          : undefined;
        return {
          profileId: m.profileId as string,
          displayName: m.displayName as string,
          invoiceKey: m.invoiceKey as string,
          adminKey,
        };
      });

    const dailyCap = parseDailyCap(parsed.dailyCapPerMember);
    return {
      baseUrl: parsed.baseUrl,
      family: {
        name: typeof family.name === 'string' ? family.name : 'Famille',
        invoiceKey: family.invoiceKey,
        adminKey: family.adminKey,
      },
      members,
      triggerMode: parseTriggerMode(parsed.triggerMode),
      dailyCapPerMember: dailyCap,
      hybridThresholdSats: parseHybridThreshold(parsed.hybridThresholdSats, dailyCap),
    };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] loadFamilyConfig failed:', err);
    return null;
  }
}

export async function saveFamilyConfig(config: FamilyLightningConfig): Promise<void> {
  const dailyCap = parseDailyCap(config.dailyCapPerMember);
  const normalized: FamilyLightningConfig = {
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
    family: {
      name: config.family.name.trim() || 'Famille',
      invoiceKey: config.family.invoiceKey.trim(),
      adminKey: config.family.adminKey.trim(),
    },
    members: config.members.map((m) => {
      const trimmedAdmin = typeof m.adminKey === 'string' ? m.adminKey.trim() : '';
      return {
        profileId: m.profileId,
        displayName: m.displayName.trim(),
        invoiceKey: m.invoiceKey.trim(),
        adminKey: trimmedAdmin ? trimmedAdmin : undefined,
      };
    }),
    triggerMode: parseTriggerMode(config.triggerMode),
    dailyCapPerMember: dailyCap,
    hybridThresholdSats: parseHybridThreshold(config.hybridThresholdSats, dailyCap),
  };
  await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(normalized));
}

export async function clearFamilyConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(FAMILY_KEY);
}
