# Phase 54 : Monétisation hybride — infrastructure de paiement - Pattern Map

**Mappé :** 2026-06-24
**Fichiers analysés :** 10 fichiers nouveaux / modifiés
**Analogues trouvés :** 9 / 10

---

## Classification des fichiers

| Fichier nouveau / modifié | Rôle | Data Flow | Analogue le plus proche | Qualité |
|---------------------------|------|-----------|-------------------------|---------|
| `lib/entitlements/types.ts` | types | — | `lib/types.ts` (types partagés) | role-match |
| `lib/entitlements/entitlement-engine.ts` | utility | transform | `lib/elevenlabs-quota.ts` | exact |
| `lib/entitlements/quota-parser.ts` | utility | file-I/O | `lib/parser.ts` (parseFrontmatter + serializeRDV) | exact |
| `lib/entitlements/index.ts` | config | — | `lib/gamification/index.ts` (barrel) | role-match |
| `contexts/EntitlementContext.tsx` | provider | request-response | `contexts/AIContext.tsx` | exact |
| `components/paywalls/PaywallModal.tsx` | component | request-response | `components/pdf/BookExportModal.tsx` | exact |
| `components/paywalls/PremiumBanner.tsx` | component | request-response | `components/ui/Button.tsx` + `ModalHeader.tsx` | role-match |
| `contexts/AIContext.tsx` *(modification)* | provider | request-response | lui-même (wrap entitlement) | self |
| `hooks/useVaultStories.ts` *(modification)* | hook | file-I/O | lui-même (décompte quota après succès IA) | self |
| `app/_layout.tsx` *(modification)* | config | — | lui-même (insertion EntitlementProvider) | self |

---

## Assignments par fichier

---

### `lib/entitlements/types.ts` (types)

**Analogue :** `lib/types.ts` (section types gamification / QuotaData)

**Pattern imports** (lignes 1-3 de lib/types.ts) :
```typescript
// Pas d'imports — fichier types pur, zéro dépendance runtime
// Convention projet : types partagés dans un fichier dédié sans import circulaire
```

**Pattern types à copier :**
```typescript
// Convention : union string literals pour les statuts, interface pour les objets état

export type EntitlementStatus = 'FREE' | 'LIFETIME';

export interface QuotaData {
  grandfather: boolean;
  grandfatherDetectedAt: string;   // ISO date ou "" si pas détecté
  storyCredits: number;            // solde Pack Histoires (D-07)
  storyUsedThisMonth: number;      // histoires générées ce mois (D-08)
  storyResetMonth: string;         // "YYYY-MM" — mois local (D-08, Piège 7)
}

export interface EntitlementState {
  status: EntitlementStatus;
  isGrandfathered: boolean;
  quota: QuotaData;
  isReady: boolean;               // init async terminée (pattern AuthContext ligne 143)
  isLoadingPurchase: boolean;     // spinner pendant achat RevenueCat
}
```

---

### `lib/entitlements/entitlement-engine.ts` (utility, transform)

**Analogue :** `lib/elevenlabs-quota.ts` — même rôle : logique pure de quota, sans UI, testable Jest.

**Pattern imports** (`lib/elevenlabs-quota.ts` lignes 1-18) :
```typescript
// elevenlabs-quota.ts — pas de dépendance React, pas de SecureStore pour le vault
// Pour entitlement-engine.ts : aucune dépendance externe — logique pure seulement
import { format } from 'date-fns';  // pour todayLocalMonth() → "YYYY-MM"
```

**Pattern logique quota** (extrait de `lib/elevenlabs-quota.ts` lignes 33-68) :
```typescript
// Pattern : fonction pure qui compare la date stockée vs la date locale courante
function todayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// Application pour le reset mensuel quota histoires (D-08, Piège 7) :
export function currentLocalMonth(): string {
  return format(new Date(), 'yyyy-MM');   // "YYYY-MM" en heure locale (PAS UTC)
}

export function shouldResetMonth(storedMonth: string): boolean {
  return storedMonth !== currentLocalMonth();
}
```

**Pattern canConsume** (`lib/elevenlabs-quota.ts` lignes 118-129) :
```typescript
// Pattern : vérifier AVANT de consommer, enregistrer APRÈS succès (Piège 6)
export async function canConsume(chars: number): Promise<{ ok: boolean; ... }> {
  const state = await loadState();
  const limit = await getDailyLimit();
  if (limit === 0) return { ok: true, ... };
  const ok = state.used + chars <= limit;
  ...
}

// Application pour les histoires (D-09 — seule la génération décrémente) :
export function canGenerateStory(quota: QuotaData, hasLifetime: boolean): boolean {
  if (hasLifetime) return true;          // LIFETIME = crédits illimités (hors règle d'or IA)
  // Free tier : 3 histoires/mois OU crédits Pack Histoires
  const resetted = shouldResetMonth(quota.storyResetMonth)
    ? 0
    : quota.storyUsedThisMonth;
  const freeSlots = Math.max(0, 3 - resetted);
  return freeSlots > 0 || quota.storyCredits > 0;
}

export function decrementQuota(quota: QuotaData, hasLifetime: boolean): QuotaData {
  // Appeler APRÈS succès API (Piège 6 — ne jamais décrémenter avant)
  if (hasLifetime) return quota;  // LIFETIME — pas de décompte
  const resetted = shouldResetMonth(quota.storyResetMonth);
  const base: QuotaData = resetted
    ? { ...quota, storyUsedThisMonth: 0, storyResetMonth: currentLocalMonth() }
    : quota;

  // Priorité : épuiser les crédits Pack avant les slots gratuits
  if (base.storyCredits > 0) {
    return { ...base, storyCredits: base.storyCredits - 1 };
  }
  return { ...base, storyUsedThisMonth: base.storyUsedThisMonth + 1 };
}
```

**Pattern detectGrandfather** (logique pure, testable) :
```typescript
// Détecter au premier lancement de la version payante uniquement (D-05)
// Ne jamais rejouer la détection si flag déjà posé
export function detectGrandfatherEligibility(vaultState: {
  tasks: unknown[];
  meals: unknown[];
  profiles: unknown[];
  memories: unknown[];
}): boolean {
  return (
    vaultState.tasks.length > 0 ||
    vaultState.meals.length > 0 ||
    vaultState.profiles.length > 0 ||
    vaultState.memories.length > 0
  );
}
```

**Pattern error user-facing** (`lib/elevenlabs-quota.ts` ligne 148) :
```typescript
// Convention projet : message d'erreur user-facing comme fonction pure exportée
export function quotaExceededMessage(): string {
  return "Tu as utilisé tes 3 histoires du mois. Recharge avec un Pack Histoires ou passe à FamilyFlow à Vie.";
}
```

---

### `lib/entitlements/quota-parser.ts` (utility, file-I/O)

**Analogue :** `lib/parser.ts` — paire `parseRDV` / `serializeRDV` (frontmatter simple, fichier unique).

**Pattern imports** (`lib/parser.ts` lignes 13-14) :
```typescript
import matter from 'gray-matter';
// Convention projet : gray-matter pour le frontmatter YAML
// Toujours utiliser parseFrontmatter() (wrapper avec fallback manuel) pour React Native
import { parseFrontmatter } from '../parser';
// OU copier parseFrontmatter localement si on veut éviter l'import depuis parser.ts
```

**Pattern parseRDV** (`lib/parser.ts` lignes 361-383) — adapté pour quota :
```typescript
// Pattern : parseFrontmatter → accès data.field avec coercions défensives + valeurs par défaut
export function parseQuota(content: string): QuotaData {
  const { data } = parseFrontmatter(content);
  return {
    grandfather: data.grandfather === 'true' || data.grandfather === true,
    grandfatherDetectedAt: String(data.grandfather_detected_at ?? ''),
    storyCredits: Number(data.story_credits) || 0,
    storyUsedThisMonth: Number(data.story_used_this_month) || 0,
    storyResetMonth: String(data.story_reset_month ?? ''),
  };
}
```

**Pattern serializeRDV** (`lib/parser.ts` lignes 389-418) — adapté pour quota :
```typescript
// Convention : construire le frontmatter ligne par ligne (pas matter.stringify)
// pour rester cohérent avec le style manuel du projet (voir serializeRDV)
export function serializeQuota(q: QuotaData): string {
  const lines = [
    '---',
    `grandfather: ${q.grandfather}`,
    `grandfather_detected_at: "${q.grandfatherDetectedAt}"`,
    `story_credits: ${q.storyCredits}`,
    `story_used_this_month: ${q.storyUsedThisMonth}`,
    `story_reset_month: "${q.storyResetMonth}"`,
    'tags:',
    '  - entitlements',
    '---',
    '',
    '# Entitlements & Quota',
    '',
    '> Géré automatiquement par FamilyFlow — ne pas modifier manuellement.',
    '',
  ];
  return lines.join('\n');
}
```

**Constante chemin fichier vault** (convention `useVaultBudget.ts` ligne 33) :
```typescript
// Convention : constante de chemin en haut de fichier
const QUOTA_DIR = '09 - Entitlements';
export const QUOTA_FILE = '09 - Entitlements/quota.md';
```

---

### `lib/entitlements/index.ts` (barrel)

**Analogue :** `lib/gamification/index.ts` (barrel exports)

**Pattern barrel** :
```typescript
// Convention projet : barrel = re-export nommé de tout ce qui est public
// Pas d'export default dans les barrels
export * from './types';
export * from './entitlement-engine';
export * from './quota-parser';
```

---

### `contexts/EntitlementContext.tsx` (provider, request-response)

**Analogue :** `contexts/AIContext.tsx` — init async au mount, état dérivé via `useMemo`, `useCallback` sur toutes les actions, `isReady` pattern depuis `contexts/AuthContext.tsx` ligne 143.

**Pattern imports** (`contexts/AIContext.tsx` lignes 10-12) :
```typescript
import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
} from 'react';
// EntitlementContext ajoute :
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useVault } from './VaultContext';           // lire vault au mount (D-05, D-07)
import { parseQuota, serializeQuota, QUOTA_FILE } from '../lib/entitlements';
import {
  detectGrandfatherEligibility,
  canGenerateStory,
  decrementQuota,
  shouldResetMonth,
  currentLocalMonth,
} from '../lib/entitlements';
import type { EntitlementStatus, EntitlementState, QuotaData } from '../lib/entitlements';
```

**Pattern constantes module** (`contexts/AIContext.tsx` lignes 14-25) :
```typescript
// Convention : constantes en haut de fichier comme constantes nommées
const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
const ENTITLEMENT_PREMIUM = 'familyflow_premium';    // ID entitlement RevenueCat Dashboard
const PRODUCT_LIFETIME = 'familyflow_lifetime_v1';   // ID produit ASC
const PRODUCT_STORY_PACK = 'familyflow_story_pack_30';
const FREE_STORIES_PER_MONTH = 3;
const STORY_PACK_CREDITS = 30;
```

**Pattern init async au mount** (`contexts/AIContext.tsx` lignes 66-77 + `contexts/AuthContext.tsx` lignes 164-178) :
```typescript
// Pattern : useEffect IIFE async → Promise.all → setState → setIsReady(true)
useEffect(() => {
  (async () => {
    try {
      // 1. Configurer RevenueCat
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({
        apiKey: Platform.select({ ios: RC_IOS_KEY, default: 'test_' }),
        // D-02 : ne JAMAIS passer d'appUserID dérivé du vault
      });

      // 2. Charger CustomerInfo (source vérité achat — D-03)
      const customerInfo = await Purchases.getCustomerInfo();
      const hasLifetime = !!customerInfo.entitlements.active[ENTITLEMENT_PREMIUM];
      setStatus(hasLifetime ? 'LIFETIME' : 'FREE');

      // 3. Charger quota vault (D-07) — attendre que VaultProvider soit prêt (Piège 3)
      if (vault && vaultPath) {
        try {
          const content = await vault.readFile(QUOTA_FILE);
          const q = parseQuota(content);
          setQuotaState(q);
          setIsGrandfathered(q.grandfather);
        } catch {
          // fichier absent = premier lancement → quota par défaut
          setQuotaState(DEFAULT_QUOTA);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[EntitlementProvider] init failed:', e);
    } finally {
      setIsReady(true);
    }
  })();
}, [vault, vaultPath]);  // dépend du vault chargé (Piège 3 — ne pas poser flag si vault loading)
```

**Pattern listener temps réel** (RESEARCH.md Pattern 4) :
```typescript
// Pattern : addCustomerInfoUpdateListener avec cleanup (pattern AppState.addEventListener
// dans useVault.ts lignes 132-142 — même structure listener + remove)
useEffect(() => {
  const listener = Purchases.addCustomerInfoUpdateListener((info) => {
    const hasLifetime = !!info.entitlements.active[ENTITLEMENT_PREMIUM];
    setStatus(hasLifetime ? 'LIFETIME' : 'FREE');
  });
  return () => listener.remove();
}, []);
```

**Pattern valeur contexte mémoïsée** (`contexts/AIContext.tsx` lignes 160-167) :
```typescript
// Convention : TOUJOURS useMemo sur la valeur du contexte (évite re-renders en cascade)
const value: EntitlementState & EntitlementActions = useMemo(
  () => ({
    status, isGrandfathered, quota, isReady, isLoadingPurchase,
    canGenerateStory: () => canGenerateStory(quota, status === 'LIFETIME'),
    purchaseLifetime,
    purchaseStoryPack,
    restorePurchases,
    decrementStoryQuota,
    setGrandfathered,
  }),
  [status, isGrandfathered, quota, isReady, isLoadingPurchase,
   purchaseLifetime, purchaseStoryPack, restorePurchases, decrementStoryQuota, setGrandfathered],
);

return <EntitlementCtx.Provider value={value}>{children}</EntitlementCtx.Provider>;
```

**Pattern hook consumer** (`contexts/AIContext.tsx` lignes 172-178) :
```typescript
// Convention : hook nommé useXxx qui throw si hors provider
export function useEntitlements() {
  const ctx = useContext(EntitlementCtx);
  if (!ctx) throw new Error('useEntitlements doit être utilisé dans un EntitlementProvider');
  return ctx;
}
```

**Pattern achat avec guard cancel** (RESEARCH.md Pattern 5) :
```typescript
// Convention : catch PURCHASES_CANCELLED_ERROR en silence (user a annulé = OK)
const purchaseLifetime = useCallback(async () => {
  setIsLoadingPurchase(true);
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.getPackage(PRODUCT_LIFETIME);
    if (!pkg) throw new Error('Produit indisponible');
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasLifetime = !!customerInfo.entitlements.active[ENTITLEMENT_PREMIUM];
    if (hasLifetime) setStatus('LIFETIME');
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code !== Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      Alert.alert('Erreur', "L'achat a échoué. Réessayez plus tard.");
    }
  } finally {
    setIsLoadingPurchase(false);
  }
}, []);
```

**Pattern restauration d'achats** (RESEARCH.md Pattern 3 + règle App Store) :
```typescript
// Obligatoire Apple App Store Rule 3.1.1
const restorePurchases = useCallback(async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasLifetime = !!customerInfo.entitlements.active[ENTITLEMENT_PREMIUM];
    if (hasLifetime) setStatus('LIFETIME');
  } catch {
    Alert.alert('Erreur', 'Impossible de restaurer les achats. Réessayez plus tard.');
  }
}, []);
```

---

### `components/paywalls/PaywallModal.tsx` (component, request-response)

**Analogue :** `components/pdf/BookExportModal.tsx` — modal pageSheet + drag-to-dismiss + useThemeColors + ModalHeader + SafeAreaView + ScrollView + footer CTA.

**Pattern imports** (`components/pdf/BookExportModal.tsx` lignes 11-44) :
```typescript
import React, { useState, useCallback } from 'react';
import {
  Modal, View, Text, Pressable, Alert,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useEntitlements } from '../../contexts/EntitlementContext';
import { ModalHeader } from '../ui';
import { Button } from '../ui';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
```

**Pattern Modal pageSheet + drag-to-dismiss** (`app/dietary.tsx` lignes 303-315 + `app/_layout.tsx` ligne 329) :
```typescript
// Deux patterns coexistent selon le cas :
// 1. Modal RN direct (depuis un écran, le plus simple) :
<Modal
  visible={visible}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={onClose}
>
  <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
    <ModalHeader title="FamilyFlow à Vie" onClose={onClose} />
    <ScrollView contentContainerStyle={styles.content}>
      {/* contenu paywall */}
    </ScrollView>
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      <Button label="Obtenir FamilyFlow à Vie" onPress={handlePurchaseLifetime} fullWidth size="lg" />
      <Button label="Restaurer mes achats" onPress={handleRestore} variant="ghost" fullWidth />
    </View>
  </SafeAreaView>
</Modal>

// 2. Stack.Screen avec presentation: 'pageSheet' (depuis expo-router) — voir _layout.tsx ligne 327-329
// Pour PaywallModal : utiliser le pattern Modal RN direct (lancé depuis n'importe quel écran)
```

**Pattern prix localisés** (CONTEXT.md Claude's Discretion + RESEARCH.md Pattern 1) :
```typescript
// JAMAIS hardcoder "29,99 €" — toujours utiliser priceString RevenueCat
const [lifetimePrice, setLifetimePrice] = useState<string>('');
const [packPrice, setPackPrice] = useState<string>('');

useEffect(() => {
  Purchases.getOfferings().then(offerings => {
    const lifetime = offerings.current?.getPackage(PRODUCT_LIFETIME);
    const pack = offerings.current?.getPackage(PRODUCT_STORY_PACK);
    if (lifetime) setLifetimePrice(lifetime.product.priceString);
    if (pack) setPackPrice(pack.product.priceString);
  }).catch(() => { /* offline → afficher "…" */ });
}, []);

// Dans le JSX :
<Text style={{ color: colors.text }}>{lifetimePrice || '…'}</Text>
```

**Pattern structure StyleSheet** (`components/pdf/BookExportModal.tsx` + `components/ui/Button.tsx`) :
```typescript
// Convention : StyleSheet.create en bas de fichier, styles statiques uniquement
// Styles dynamiques (couleurs thème) → inline avec colors.*
const styles = StyleSheet.create({
  content: {
    padding: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  footer: {
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    borderTopWidth: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
});
```

---

### `components/paywalls/PremiumBanner.tsx` (component, request-response)

**Analogue :** `components/ui/Button.tsx` + `components/ui/Badge.tsx` — composant UI simple, React.memo, useThemeColors.

**Pattern imports et structure** (`components/ui/Button.tsx` lignes 1-6) :
```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
```

**Pattern React.memo** (`components/ui/Button.tsx` lignes 23-76) :
```typescript
// Convention : React.memo sur tous les composants list/item/banner réutilisables
export const PremiumBanner = React.memo(function PremiumBanner({
  message,
  ctaLabel = 'Voir les offres',
  onPress,
}: {
  message: string;
  ctaLabel?: string;
  onPress: () => void;
}) {
  const { primary, tint, colors } = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={ctaLabel}
      style={[styles.banner, { backgroundColor: tint, borderColor: primary }]}
    >
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      <Text style={[styles.cta, { color: primary }]}>{ctaLabel} →</Text>
    </TouchableOpacity>
  );
});
```

---

### `contexts/AIContext.tsx` *(modification — wrapper entitlement)*

**Self-analog** — modification minime : ajouter un check `useEntitlements()` avant les appels IA.

**Point d'insertion** (`contexts/AIContext.tsx` lignes 120-138 — fonction `ask`) :
```typescript
// Pattern : guard entitlement AVANT l'appel API, APRÈS le check isLoading
// Extraire canGenerateStory depuis useEntitlements() via prop ou import direct
// AIProvider est SOUS EntitlementProvider dans la hiérarchie → peut utiliser useEntitlements()
const ask = useCallback(
  async (question: string, vaultCtx: AIVaultContext, history: AIMessage[] = []): Promise<AIResponse> => {
    if (!config) return { text: '', error: 'IA non configurée' };
    if (isLoading) return { text: '', error: '' };
    // ← NOUVEAU : gate entitlement (ajouter ici, après les guards existants)
    // const { canGenerateStory } = useEntitlements();  // NE PAS appeler un hook dans une fonction
    // → passer canGenerateStory en paramètre OU lire l'état via un ref/prop
    ...
  },
  [config, isLoading],
);
```

**Note architecture** : pour éviter d'appeler un hook dans une callback, passer le check entitlement en paramètre `ask(question, vaultCtx, history, { checkEntitlement?: () => boolean })` ou stocker `canGenerateStory` dans un `useRef` mis à jour via `useEffect`. Voir pattern `lastCallRef` dans AIContext ligne 80.

---

### `hooks/useVaultStories.ts` *(modification — décompte quota)*

**Self-analog** — modification de `saveStory` pour appeler `decrementStoryQuota` après succès vault.

**Point d'insertion** (`hooks/useVaultStories.ts` lignes 161-228 — fonction `saveStory`) :
```typescript
// Pattern existant (ligne 183) : "persistance vault en best-effort"
// NOUVEAU : décrémenter après succès écriture vault (Piège 6 — ordre strict)
// Ordre : (1) appel API Anthropic → (2) vault.writeFile → (3) decrementStoryQuota

// Dans saveStory, après vault.writeFile réussi (ligne 186) :
try {
  await vault.writeFile(story.sourceFile, content);
  // ← NOUVEAU : signaler au caller qu'une décrémentation est requise
  // useVaultStories n'a pas accès direct à EntitlementContext
  // → passer un callback en paramètre de saveStory : onQuotaDecrement?: () => Promise<void>
  if (options?.onQuotaDecrement) await options.onQuotaDecrement();
} catch (e) {
  if (__DEV__) console.warn('[useVaultStories] vault persist failed:', e);
  throw e;
}
```

**Alternative recommandée** : le caller (écran histoires) appelle `decrementStoryQuota()` depuis `useEntitlements()` après que `saveStory` ait résolu. Plus simple, respecte la séparation des couches.

---

### `app/_layout.tsx` *(modification — insertion EntitlementProvider)*

**Self-analog** — insertion dans la hiérarchie providers existante.

**Point d'insertion** (`app/_layout.tsx` lignes 309-348) :
```typescript
// Hiérarchie actuelle (lignes 310-350) :
// VaultProvider > AuthProvider > ThemeProvider > AIProvider > StoryVoiceProvider > ...

// Hiérarchie cible (RESEARCH.md Pattern 8) :
// VaultProvider > AuthProvider > ThemeProvider > EntitlementProvider > AIProvider > ...
// Raison : EntitlementProvider lit le vault (besoin VaultProvider) et doit être
// disponible AVANT AIProvider qui gate l'IA.

// Modification minime :
<VaultProvider>
  <AuthProvider>
  <ThemeProvider>
    <EntitlementProvider>   {/* ← NOUVEAU, ici */}
    <AIProvider>
    <StoryVoiceProvider>
    ...
    </StoryVoiceProvider>
    </AIProvider>
    </EntitlementProvider>  {/* ← fermeture */}
  </ThemeProvider>
  </AuthProvider>
</VaultProvider>

// Import à ajouter en tête de fichier (ligne ~39, après les imports contextes existants) :
import { EntitlementProvider } from '../contexts/EntitlementContext';
```

---

## Patterns transversaux

### Pattern useThemeColors (obligatoire sur TOUT fichier UI)

**Source :** `contexts/ThemeContext.tsx` — utilisé dans 100% des composants
**Appliquer à :** `components/paywalls/PaywallModal.tsx`, `components/paywalls/PremiumBanner.tsx`

```typescript
// Destructuring standard — JAMAIS de couleur hardcodée (#FFFFFF, etc.)
const { primary, tint, colors } = useThemeColors();
// colors.text, colors.textMuted, colors.bg, colors.card, colors.border,
// colors.error, colors.errorBg, colors.onPrimary
```

### Pattern Modal pageSheet + SafeAreaView

**Source :** `components/pdf/BookExportModal.tsx` lignes 11-24 + `app/dietary.tsx` lignes 303-315
**Appliquer à :** `components/paywalls/PaywallModal.tsx`

```typescript
// Structure obligatoire : Modal > SafeAreaView > ModalHeader + ScrollView + footer
<Modal
  visible={visible}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={onClose}
>
  <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
    <ModalHeader title="..." onClose={onClose} />
    <ScrollView>...</ScrollView>
    <View style={[styles.footer, { borderTopColor: colors.border }]}>...</View>
  </SafeAreaView>
</Modal>
```

### Pattern Haptics feedback

**Source :** `components/pdf/BookExportModal.tsx` ligne 282
**Appliquer à :** boutons d'achat et sélection dans PaywallModal

```typescript
import * as Haptics from 'expo-haptics';
// Sur tap sélection : Haptics.selectionAsync()
// Sur action principale (achat) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
```

### Pattern erreurs user-facing

**Source :** `contexts/AIContext.tsx` ligne 122 + `lib/elevenlabs-quota.ts` ligne 148
**Appliquer à :** `contexts/EntitlementContext.tsx` — toutes les erreurs achat / quota

```typescript
// Convention : Alert.alert() en français pour les erreurs user-facing
Alert.alert('Erreur', "L'achat a échoué. Réessayez plus tard.");

// Convention : console.warn/__DEV__ pour les erreurs techniques non-critiques
if (__DEV__) console.warn('[EntitlementProvider] init failed:', e);
```

### Pattern StyleSheet statique + styles dynamiques inline

**Source :** `components/ui/Button.tsx` lignes 44-59 + `components/pdf/BookExportModal.tsx`
**Appliquer à :** `components/paywalls/PaywallModal.tsx`, `components/paywalls/PremiumBanner.tsx`

```typescript
// Styles STATIQUES → StyleSheet.create en bas de fichier
const styles = StyleSheet.create({ content: { padding: Spacing['3xl'] } });
// Styles DYNAMIQUES (couleurs) → inline avec colors.*
<View style={[styles.content, { backgroundColor: colors.bg }]} />
```

### Pattern constants de spring Reanimated

**Source :** `CLAUDE.md` — conventions animations
**Appliquer à :** animations éventuelles dans PaywallModal (entrée, feedback)

```typescript
// Convention : constante module, pas inline
const SPRING_CONFIG = { damping: 10, stiffness: 180 };
// Pas de perspective dans transform arrays
```

### Pattern isReady + loading guard

**Source :** `contexts/AuthContext.tsx` lignes 143-178
**Appliquer à :** `contexts/EntitlementContext.tsx`

```typescript
// Ne jamais exposer de données partielles avant la fin de l'init async
const [isReady, setIsReady] = useState(false);
// Dans les consumers : if (!entitlements.isReady) return null (ou spinner)
// Ne JAMAIS poser le flag grandfather si isReady = false (Piège 3)
```

---

## Cache vault — décision

**Source :** `lib/vault-cache.ts` lignes 54-74 + CLAUDE.md section Cache

Le domaine entitlement/quota **ne doit PAS être mis dans VaultCacheState** :
- Le statut d'achat (LIFETIME/FREE) est volatile : doit être rechargé depuis RevenueCat à chaque lancement.
- Le solde crédits change fréquemment après génération.
- Aucune régression visuelle si le quota charge en 200ms (dashboard non impacté).

**Conséquence :** `CACHE_VERSION` dans `lib/vault-cache.ts` **n'est pas à bumper** pour cette phase (aucun nouveau champ dans VaultCacheState). Confirmer si un champ entitlement est ajouté dans les types cachés.

---

## Fichiers sans analogue proche

| Fichier | Rôle | Data Flow | Raison |
|---------|------|-----------|--------|
| `lib/entitlements/index.ts` | barrel | — | Tous les barrels du projet sont identiques (convention connue) |

*(Aucun fichier véritablement sans analogue — tous ont un modèle clair dans le codebase.)*

---

## Métadonnées

**Périmètre de recherche :** `contexts/`, `hooks/`, `lib/`, `components/pdf/`, `components/ui/`, `app/_layout.tsx`, `app/dietary.tsx`
**Fichiers lus :** 14
**Analogues extraits :** 5 (AIContext, StoryVoiceContext, BookExportModal, useVaultBudget, elevenlabs-quota)
**Date de mapping :** 2026-06-24
