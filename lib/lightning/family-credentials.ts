/**
 * Family Lightning credentials — persistance via expo-secure-store
 *
 * Spike 004 — wallet famille parent + sub-wallets enfants.
 *
 * Stockée sous une clé SecureStore distincte de la config single-wallet
 * (lightning_lnbits_config_v1) pour éviter les conflits. Les deux peuvent
 * coexister pendant la transition spike → feature.
 *
 * Format : JSON FamilyLightningConfig complet (famille + tous les enfants).
 * Clé : lightning_family_config_v1
 */

import * as SecureStore from 'expo-secure-store';
import type { ChildWalletMapping, FamilyLightningConfig } from './types';

const FAMILY_KEY = 'lightning_family_config_v1';

export async function loadFamilyConfig(): Promise<FamilyLightningConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(FAMILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FamilyLightningConfig>;
    if (
      typeof parsed.baseUrl !== 'string' ||
      !parsed.family ||
      typeof parsed.family.invoiceKey !== 'string' ||
      typeof parsed.family.adminKey !== 'string' ||
      !Array.isArray(parsed.children)
    ) {
      return null;
    }
    return {
      baseUrl: parsed.baseUrl,
      family: {
        name: parsed.family.name ?? 'Famille',
        invoiceKey: parsed.family.invoiceKey,
        adminKey: parsed.family.adminKey,
      },
      children: parsed.children.filter(
        (c): c is ChildWalletMapping =>
          !!c &&
          typeof c.profileId === 'string' &&
          typeof c.displayName === 'string' &&
          typeof c.invoiceKey === 'string',
      ),
    };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] loadFamilyConfig failed:', err);
    return null;
  }
}

export async function saveFamilyConfig(config: FamilyLightningConfig): Promise<void> {
  const normalized: FamilyLightningConfig = {
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
    family: {
      name: config.family.name.trim() || 'Famille',
      invoiceKey: config.family.invoiceKey.trim(),
      adminKey: config.family.adminKey.trim(),
    },
    children: config.children.map((c) => ({
      profileId: c.profileId,
      displayName: c.displayName.trim(),
      invoiceKey: c.invoiceKey.trim(),
    })),
  };
  await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(normalized));
}

export async function clearFamilyConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(FAMILY_KEY);
}
