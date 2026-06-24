---
phase: 54-monetisation-hybride-paiement
plan: 03
subsystem: monetisation-context
tags: [entitlements, revenuecat, context-provider, quota, grandfather]
requires:
  - "lib/entitlements/ (barrel Wave 2 — parseQuota/decrementQuota/detectGrandfatherEligibility/...)"
  - "react-native-purchases@10.4.0 (Wave 1)"
  - "contexts/VaultContext.tsx (vault, vaultPath, tasks, meals, profiles, memories)"
provides:
  - "contexts/EntitlementContext.tsx — EntitlementProvider + useEntitlements()"
  - "status FREE/LIFETIME + quota + canGenerateStory/purchaseLifetime/purchaseStoryPack/restorePurchases/decrementStoryQuota + lifetimePrice/packPrice"
affects:
  - "app/_layout.tsx (EntitlementProvider monté entre ThemeProvider et AIProvider)"
tech-stack:
  added: []
  patterns:
    - "Provider init async au mount (analogue AIContext) + useMemo sur la valeur + hook qui throw hors provider"
    - "Init RevenueCat défensif : chaque appel SDK isolé en try/catch → app se lance même sans clé"
    - "Statut d'achat dérivé EXCLUSIVEMENT de CustomerInfo.entitlements.active (D-03, jamais d'écriture vault)"
    - "Détection grandfather one-shot conditionnée à vault non-null (anti faux négatif iCloud — Piège 3)"
key-files:
  created:
    - "contexts/EntitlementContext.tsx"
  modified:
    - "app/_layout.tsx"
decisions:
  - "Lookup des packages par product.identifier (availablePackages.find) plutôt que getPackage(packageId) : nos IDs verrouillés Wave 1 sont des Product IDs ASC, pas des identifiants de package RevenueCat."
  - "Cleanup du listener via Purchases.removeCustomerInfoUpdateListener(listener) au lieu de listener.remove() : dans react-native-purchases@10.4.0, addCustomerInfoUpdateListener retourne void (pas un EmitterSubscription)."
  - "Chaque appel RevenueCat (configure/getCustomerInfo/getOfferings) isolé dans son propre try/catch : une clé absente/placeholder ne propage jamais d'exception → l'app publiée garde son lancement (statut FREE)."
metrics:
  duration: "~25min"
  completed: "2026-06-24"
  tasks: 2
  files: 2
---

# Phase 54 Plan 03 : EntitlementContext — câblage RevenueCat ↔ quota vault — Summary

`contexts/EntitlementContext.tsx` câble la couche pure des entitlements (Wave 2) au natif RevenueCat (Wave 1) : init défensif, statut LIFETIME source de vérité RevenueCat (D-03), quota/grandfather persistés dans le vault (D-07), détection grandfather posée une seule fois quand le vault est prêt (D-05/Piège 3), achats lifetime + pack consommable (+30 crédits vault, Piège 2), restauration (Apple 3.1.1) et listener temps réel. Le provider est monté entre `ThemeProvider` et `AIProvider` sans déplacer aucun provider existant. `tsc` propre, suite entitlements (26 tests) verte, zéro régression introduite.

## Ce qui a été construit

### Task 1 — contexts/EntitlementContext.tsx (commit `f049f7cf`)
- **EntitlementProvider** : init async au mount (analogue `AIContext`), dépendant de `vault`/`vaultPath`.
  1. `Purchases.setLogLevel(DEBUG)` en `__DEV__` (isolé).
  2. `Purchases.configure({ apiKey })` — **aucun identifiant dérivé du vault** (D-02, ID anonyme RevenueCat) ; isolé en try/catch (clé absente/placeholder → pas de crash).
  3. `getCustomerInfo()` → statut `LIFETIME` ssi `entitlements.active['familyflow_premium']` (D-03, T-54-07).
  4. `getOfferings()` → `priceString` localisés du lifetime et du pack (jamais hardcodé ; offline → `''` → UI affiche `…`).
  5. Quota vault (D-07) **seulement si `vault` non-null** : fichier présent → `parseQuota` ; absent → détection grandfather **one-shot** via `detectGrandfatherEligibility({tasks,meals,profiles,memories})`, écriture `quota.md`, set state.
  6. `finally { setIsReady(true) }`.
- **Listener temps réel** : `addCustomerInfoUpdateListener` → maj statut ; cleanup `removeCustomerInfoUpdateListener`.
- **Actions (useCallback)** :
  - `purchaseLifetime` — package lifetime → `purchasePackage` → maj statut ; annulation (`PURCHASE_CANCELLED_ERROR`) silencieuse, sinon `Alert` FR.
  - `purchaseStoryPack` — package consommable → après succès, **relit le quota et crédite +30** dans le vault (RevenueCat ne gère pas le solde — Piège 2).
  - `restorePurchases` — `Purchases.restorePurchases()` → maj statut (Apple 3.1.1) ; échec → `Alert` FR.
  - `decrementStoryQuota` — relit `quota.md` → `decrementQuota(q, status==='LIFETIME')` → réécrit (D-09, Piège 6).
  - `canGenerateStory` exposé → `canGenerateStoryPure(quota, status==='LIFETIME')`.
- **Value mémoïsée** (`useMemo`) + **hook `useEntitlements()`** qui throw hors provider.

### Task 2 — app/_layout.tsx (commit `c9576c6f`)
- Import `EntitlementProvider` ajouté après l'import `AIProvider`.
- `<EntitlementProvider>` inséré **immédiatement après `<ThemeProvider>` et avant `<AIProvider>`**, fermeture symétrique. Aucun autre provider déplacé (diff = import + 2 lignes JSX). `AIProvider` est désormais sous `EntitlementProvider` → pourra consommer `useEntitlements()` pour gater l'IA (Plan ultérieur Wave 3).

## Vérification

- `contexts/EntitlementContext.tsx` : `tsc` **propre** (0 erreur sur ce fichier).
- `app/_layout.tsx` : `tsc` **propre**, `<EntitlementProvider>` ouvert/fermé 1×, import 1×.
- Critères grep Task 1 satisfaits : `useEntitlements` exporté, `ENTITLEMENT_PREMIUM = 'familyflow_premium'`, `addCustomerInfoUpdateListener` présent, **0 `appUserID`**, **0 prix hardcodé** (`29,99`/`4,99`), `PURCHASE_CANCELLED_ERROR` présent.
- Suite `lib/entitlements/__tests__/` (26 tests) **verte**.
- Non-régression (SC-6) : la modification `app/_layout.tsx` n'introduit **aucune régression** — vérifié par stash du fichier, les suites en échec échouent à l'identique sans la modification (voir Deferred).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] API de cleanup du listener incompatible avec react-native-purchases@10.4.0**
- **Trouvé pendant :** Task 1 (tsc).
- **Problème :** le plan/PATTERNS prescrivait `const listener = addCustomerInfoUpdateListener(...); return () => listener.remove();`. Dans la version installée (10.4.0), `addCustomerInfoUpdateListener` retourne `void` → `.remove()` ne compile pas (`TS2339`). Le critère d'acceptation `grep -q "listener.remove"` n'est donc **pas applicable** à cette version du SDK.
- **Fix :** stocker la fonction listener et la retirer via `Purchases.removeCustomerInfoUpdateListener(listener)` (API correcte du SDK 10.4.0), enveloppée dans une closure `() => { ... }` pour respecter `EffectCallback` (la fonction renvoie un boolean).
- **Fichier :** `contexts/EntitlementContext.tsx`.
- **Commit :** `f049f7cf`.

**2. [Rule 1 - Bug] Lookup des packages : product.identifier au lieu de getPackage(packageId)**
- **Trouvé pendant :** Task 1.
- **Problème :** le plan suggérait `offerings.current?.getPackage(PRODUCT_LIFETIME)`. `getPackage` attend un **identifiant de package** RevenueCat, alors que nos constantes verrouillées Wave 1 (`familyflow_lifetime_v1`, `familyflow_story_pack_30`) sont des **Product IDs App Store Connect**. Utiliser `getPackage` avec un Product ID renverrait toujours `undefined`.
- **Fix :** helper `findPackageByProduct(availablePackages, productId)` = `packages?.find(p => p.product.identifier === productId)`. Robuste quel que soit le nommage des packages dans l'offering RevenueCat.
- **Fichier :** `contexts/EntitlementContext.tsx`.
- **Commit :** `f049f7cf`.

**3. [Rule 2 - Robustesse] Init RevenueCat défensif par appel (app publiée ne doit pas crasher)**
- **Trouvé pendant :** Task 1 (consigne checkpoint : la clé RevenueCat est encore un placeholder, rebuild dev-client non fait).
- **Problème :** un `configure`/`getCustomerInfo`/`getOfferings` qui lève (clé invalide, module natif pas encore rebuild) propagerait l'exception et bloquerait l'init du provider, donc le lancement de l'app **déjà publiée**.
- **Fix :** chaque appel SDK isolé dans son propre try/catch + `finally { setIsReady(true) }`. En l'absence de clé/module, le provider reste en `FREE` et l'app se lance normalement. Aucune feature gratuite cassée.
- **Fichier :** `contexts/EntitlementContext.tsx`.
- **Commit :** `f049f7cf`.

## Vérifications différées sur device (Task 3 — checkpoint:human-verify)

Le comportement runtime RevenueCat + I/O vault ne se vérifie **que sur iPhone physique** avec le dev-client rebuild (Wave 1) et le sandbox ASC/RevenueCat configurés — **non disponibles dans cet environnement** (pas de device, clé placeholder, setup externe reporté à un checkpoint consolidé). Le `tsc` est propre ; les vérités ci-dessous restent **à vérifier sur device** :

1. Au 1er lancement avec un vault existant : `09 - Entitlements/quota.md` créé avec `grandfather: true` (D-04/D-05).
2. Logs DEV : `getCustomerInfo` répond, statut `FREE` (aucun achat).
3. Achat sandbox lifetime → statut `LIFETIME` via listener temps réel.
4. « Restaurer mes achats » retrouve le lifetime sandbox.
5. Achat Pack Histoires sandbox → `story_credits` = 30 dans `quota.md` (Piège 2).
6. Dashboard RevenueCat : ID `$RCAnonymousID` (aucune donnée vault — D-02, T-54-08).
7. Relance : `grandfather` non re-détecté/réécrit (one-shot — D-05, T-54-09).

## Threat surface

Aucune nouvelle surface au-delà du `<threat_model>` du plan. Les mitigations sont en place côté code :
- **T-54-07** : statut dérivé uniquement de `customerInfo.entitlements.active[ENTITLEMENT_PREMIUM]`, jamais écrit dans le vault.
- **T-54-08** : `configure` sans identifiant dérivé → ID anonyme (vérif device étape 6).
- **T-54-09** : détection grandfather conditionnée `vault` non-null + jamais rejouée si `quota.md` existe (vérif device étapes 1,7).
- **T-54-10** : `decrementStoryQuota` exempte uniquement `status === 'LIFETIME'`, pas `isGrandfathered` → règle d'or préservée (D-06).

## Known Stubs

Aucun stub introduit. `lifetimePrice`/`packPrice` valent `''` tant que `getOfferings` n'a pas répondu (offline ou avant setup RevenueCat) — comportement attendu et documenté (UI affichera `…`), résolu au runtime une fois la clé RevenueCat réelle posée (Wave 1 device). Le câblage UI (paywall) et le gate IA sont le périmètre des plans Wave 3/4.

## Deferred Issues

7 suites Jest **pré-existantes** en échec (164 tests), **hors périmètre** de ce plan et confirmées indépendantes de la modification (échec identique sans `app/_layout.tsx` modifié) — voir `.planning/phases/54-monetisation-hybride-paiement/deferred-items.md`. Domaines : lightning, pdf, codex, courses, auberge, insights. À traiter en maintenance dédiée.

## Self-Check: PASSED

- FOUND: `contexts/EntitlementContext.tsx`
- FOUND: `app/_layout.tsx` (modifié, `<EntitlementProvider>` présent)
- FOUND commit `f049f7cf` (Task 1)
- FOUND commit `c9576c6f` (Task 2)
