/**
 * EntitlementContext.tsx — Provider central de la monétisation (Phase 54, Plan 54-03).
 *
 * Câble la couche pure (lib/entitlements/, Wave 2) au natif RevenueCat (Wave 1) :
 *   - init RevenueCat + lecture du statut LIFETIME (source de vérité — D-03)
 *   - lecture/écriture du fichier vault quota.md (D-07)
 *   - détection grandfather posée UNE SEULE fois quand le vault est prêt (D-04/D-05, Piège 3)
 *   - actions d'achat (lifetime + pack consommable) / restauration (Apple 3.1.1)
 *   - listener temps réel CustomerInfo
 *
 * D-02 : AUCUNE donnée vault n'est transmise à RevenueCat (identifiant anonyme RevenueCat,
 *         jamais d'ID dérivé du contenu familial).
 * Défensif : si la clé RevenueCat est absente/placeholder, l'init échoue en silence et
 * l'app continue de se lancer (statut FREE par défaut). Aucune feature gratuite n'est cassée.
 *
 * Analogue : contexts/AIContext.tsx (init async au mount, useMemo sur la valeur,
 * useCallback sur les actions, hook useXxx qui throw hors provider).
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Platform, Alert } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { useVault } from './VaultContext';
import {
  parseQuota,
  serializeQuota,
  QUOTA_FILE,
  DEFAULT_QUOTA,
  canGenerateStory as canGenerateStoryPure,
  decrementQuota,
  detectGrandfatherEligibility,
  currentLocalMonth,
} from '../lib/entitlements';
import type {
  EntitlementStatus,
  EntitlementState,
  QuotaData,
} from '../lib/entitlements';

// ─── Constantes module ────────────────────────────────────────────────────────────

/** Clé publique RevenueCat iOS (placeholder/absente en dev → init défensif). */
const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
/** Entitlement RevenueCat Dashboard (verrouillé Wave 1). */
const ENTITLEMENT_PREMIUM = 'familyflow_premium';
/** Product IDs App Store Connect (verrouillés Wave 1). */
const PRODUCT_LIFETIME = 'familyflow_lifetime_v1';
const PRODUCT_STORY_PACK = 'familyflow_story_pack_30';
/** Crédits crédités au vault après achat du Pack Histoires (RevenueCat ne gère pas le solde — Piège 2). */
const STORY_PACK_CREDITS = 30;

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Actions exposées par le contexte (en plus de EntitlementState). */
interface EntitlementActions {
  /** Peut-on générer une nouvelle histoire IA ? (règle d'or — D-06). */
  canGenerateStory: () => boolean;
  /** Lance l'achat « FamilyFlow à Vie » (non-consommable). */
  purchaseLifetime: () => Promise<void>;
  /** Lance l'achat du « Pack Histoires » (consommable, +30 crédits vault). */
  purchaseStoryPack: () => Promise<void>;
  /** Restaure les achats (obligatoire Apple 3.1.1). */
  restorePurchases: () => Promise<void>;
  /** Décrémente le quota APRÈS un succès de génération (D-09, Piège 6). */
  decrementStoryQuota: () => Promise<void>;
  /** Prix localisé du lifetime (priceString RevenueCat — jamais hardcodé). */
  lifetimePrice: string;
  /** Prix localisé du Pack Histoires. */
  packPrice: string;
}

type EntitlementContextValue = EntitlementState & EntitlementActions;

// ─── Helpers internes ──────────────────────────────────────────────────────────────

/** Statut dérivé EXCLUSIVEMENT de l'entitlement RevenueCat (D-03, T-54-07). */
function statusFromCustomerInfo(info: CustomerInfo): EntitlementStatus {
  return info.entitlements.active[ENTITLEMENT_PREMIUM] ? 'LIFETIME' : 'FREE';
}

/** Cherche un package par identifiant de produit dans l'offering courant. */
function findPackageByProduct(
  packages: PurchasesPackage[] | undefined,
  productId: string,
): PurchasesPackage | undefined {
  return packages?.find((p) => p.product.identifier === productId);
}

// ─── Context ────────────────────────────────────────────────────────────────────

const EntitlementCtx = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const {
    vault,
    vaultPath,
    tasks: vaultTasks,
    meals: vaultMeals,
    profiles: vaultProfiles,
    memories: vaultMemories,
  } = useVault();

  const [status, setStatus] = useState<EntitlementStatus>('FREE');
  const [isGrandfathered, setIsGrandfathered] = useState(false);
  const [quota, setQuota] = useState<QuotaData>(DEFAULT_QUOTA);
  const [isReady, setIsReady] = useState(false);
  const [isLoadingPurchase, setIsLoadingPurchase] = useState(false);
  const [lifetimePrice, setLifetimePrice] = useState('');
  const [packPrice, setPackPrice] = useState('');

  // ─── Init async au mount (dépend du vault — Piège 3 : ne pas poser le flag si vault loading) ───
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (__DEV__) {
          try {
            await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
          } catch {
            /* setLogLevel non-critique */
          }
        }

        // 1. Configurer RevenueCat — JAMAIS d'identifiant dérivé du vault (D-02) :
        //    on n'appelle configure() qu'avec la clé → ID anonyme RevenueCat.
        //    Défensif : si la clé est absente/placeholder, configure peut échouer ;
        //    on l'isole pour que l'app continue de se lancer (statut FREE).
        try {
          Purchases.configure({
            apiKey: Platform.select({ ios: RC_IOS_KEY, default: 'test_' }) ?? '',
          });
        } catch (e) {
          if (__DEV__) console.warn('[EntitlementProvider] configure failed:', e);
        }

        // 2. Statut d'achat = source de vérité RevenueCat (D-03).
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          if (!cancelled) {
            setStatus(statusFromCustomerInfo(customerInfo));
          }
        } catch (e) {
          if (__DEV__) console.warn('[EntitlementProvider] getCustomerInfo failed:', e);
        }

        // 3. Prix localisés (jamais hardcodé — offline → '' → UI affiche '…').
        try {
          const offerings = await Purchases.getOfferings();
          const packages = offerings.current?.availablePackages;
          const lifetimePkg = findPackageByProduct(packages, PRODUCT_LIFETIME);
          const packPkg = findPackageByProduct(packages, PRODUCT_STORY_PACK);
          if (!cancelled) {
            if (lifetimePkg) setLifetimePrice(lifetimePkg.product.priceString);
            if (packPkg) setPackPrice(packPkg.product.priceString);
          }
        } catch (e) {
          if (__DEV__) console.warn('[EntitlementProvider] getOfferings failed:', e);
        }

        // 4. Quota vault (D-07) + grandfather one-shot (D-05, Piège 3) — vault non-null requis.
        if (vault) {
          try {
            const content = await vault.readFile(QUOTA_FILE);
            const q = parseQuota(content);
            if (!cancelled) {
              setQuota(q);
              setIsGrandfathered(q.grandfather);
            }
          } catch {
            // Fichier absent → premier lancement de la version payante.
            // Détection grandfather appliquée EXACTEMENT une fois (D-05).
            const eligible = detectGrandfatherEligibility({
              tasks: vaultTasks,
              meals: vaultMeals,
              profiles: vaultProfiles,
              memories: vaultMemories,
            });
            const initial: QuotaData = {
              ...DEFAULT_QUOTA,
              grandfather: eligible,
              grandfatherDetectedAt: eligible ? new Date().toISOString() : '',
              storyResetMonth: currentLocalMonth(),
            };
            try {
              await vault.writeFile(QUOTA_FILE, serializeQuota(initial));
            } catch (e) {
              if (__DEV__) console.warn('[EntitlementProvider] quota write failed:', e);
            }
            if (!cancelled) {
              setQuota(initial);
              setIsGrandfathered(initial.grandfather);
            }
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[EntitlementProvider] init failed:', e);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Dépend du vault chargé : la détection grandfather n'a lieu que lorsque le
    // VaultProvider expose un vault non-null (anti faux négatif iCloud — Piège 3).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, vaultPath]);

  // ─── Listener temps réel CustomerInfo (achat / restauration) ───
  useEffect(() => {
    const listener = (info: CustomerInfo) => {
      setStatus(statusFromCustomerInfo(info));
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  // ─── Actions ───

  const purchaseLifetime = useCallback(async () => {
    setIsLoadingPurchase(true);
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = findPackageByProduct(
        offerings.current?.availablePackages,
        PRODUCT_LIFETIME,
      );
      if (!pkg) throw new Error('Produit indisponible');
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setStatus(statusFromCustomerInfo(customerInfo));
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert('Erreur', "L'achat a échoué. Réessayez plus tard.");
      }
    } finally {
      setIsLoadingPurchase(false);
    }
  }, []);

  const purchaseStoryPack = useCallback(async () => {
    setIsLoadingPurchase(true);
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = findPackageByProduct(
        offerings.current?.availablePackages,
        PRODUCT_STORY_PACK,
      );
      if (!pkg) throw new Error('Produit indisponible');
      await Purchases.purchasePackage(pkg);

      // RevenueCat NE gère PAS le solde des consommables (Piège 2) →
      // créditer +30 dans le vault, source de vérité des crédits (D-07).
      if (vault) {
        let current = quota;
        try {
          current = parseQuota(await vault.readFile(QUOTA_FILE));
        } catch {
          current = quota;
        }
        const next: QuotaData = {
          ...current,
          storyCredits: current.storyCredits + STORY_PACK_CREDITS,
        };
        await vault.writeFile(QUOTA_FILE, serializeQuota(next));
        setQuota(next);
      }
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert('Erreur', "L'achat a échoué. Réessayez plus tard.");
      }
    } finally {
      setIsLoadingPurchase(false);
    }
  }, [vault, quota]);

  const restorePurchases = useCallback(async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      setStatus(statusFromCustomerInfo(customerInfo));
    } catch {
      Alert.alert('Erreur', 'Impossible de restaurer les achats. Réessayez plus tard.');
    }
  }, []);

  const decrementStoryQuota = useCallback(async () => {
    if (!vault) return;
    try {
      let current = quota;
      try {
        current = parseQuota(await vault.readFile(QUOTA_FILE));
      } catch {
        current = quota;
      }
      const next = decrementQuota(current, status === 'LIFETIME');
      await vault.writeFile(QUOTA_FILE, serializeQuota(next));
      setQuota(next);
    } catch (e) {
      if (__DEV__) console.warn('[EntitlementProvider] decrement failed:', e);
    }
  }, [vault, quota, status]);

  const canGenerateStory = useCallback(
    () => canGenerateStoryPure(quota, status === 'LIFETIME'),
    [quota, status],
  );

  // ─── Valeur mémoïsée (évite les re-renders en cascade) ───
  const value: EntitlementContextValue = useMemo(
    () => ({
      status,
      isGrandfathered,
      quota,
      isReady,
      isLoadingPurchase,
      lifetimePrice,
      packPrice,
      canGenerateStory,
      purchaseLifetime,
      purchaseStoryPack,
      restorePurchases,
      decrementStoryQuota,
    }),
    [
      status,
      isGrandfathered,
      quota,
      isReady,
      isLoadingPurchase,
      lifetimePrice,
      packPrice,
      canGenerateStory,
      purchaseLifetime,
      purchaseStoryPack,
      restorePurchases,
      decrementStoryQuota,
    ],
  );

  return <EntitlementCtx.Provider value={value}>{children}</EntitlementCtx.Provider>;
}

export function useEntitlements(): EntitlementContextValue {
  const ctx = useContext(EntitlementCtx);
  if (!ctx) {
    throw new Error('useEntitlements doit être utilisé dans un EntitlementProvider');
  }
  return ctx;
}
