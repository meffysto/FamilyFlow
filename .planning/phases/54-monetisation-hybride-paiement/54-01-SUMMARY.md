---
phase: 54-monetisation-hybride-paiement
plan: 01
subsystem: monetisation-iap
tags: [revenuecat, iap, native, config, app-store-connect]
status: paused-checkpoint
requires:
  - "App publiée iOS (Team Apple AKMNXGVVGX)"
provides:
  - "Dépendance react-native-purchases@10.4.0 (brique IAP)"
  - "Documentation EXPO_PUBLIC_RC_IOS_KEY (.env.example)"
affects:
  - "package.json"
  - "package-lock.json"
  - ".env.example"
tech-stack:
  added:
    - "react-native-purchases@10.4.0 (SDK IAP RevenueCat — D-01)"
  patterns:
    - "Module natif autolinké (aucun config plugin Expo requis)"
    - "Secret côté client documenté en .env.example (placeholder), vraie valeur en .env gitignored / EAS secrets"
key-files:
  created:
    - ".env.example"
  modified:
    - "package.json"
    - "package-lock.json"
decisions:
  - "react-native-purchases ne ship AUCUN config plugin Expo (pas de app.plugin.js, pas de champ expo) → autolinking pur, AUCUNE entrée plugins[] ajoutée à app.json (A1 résolu, hypothèse par défaut confirmée). prebuild --clean volontairement non exécuté pour ne pas perturber le working tree."
  - "Dépendance figée en ^10.4.0 (résolu sur 10.4.0 exact) — conforme acceptance criteria."
metrics:
  duration: "~5min"
  completed: "2026-06-24"
---

# Phase 54 Plan 01: Installation native RevenueCat + config IAP Summary

`react-native-purchases@10.4.0` installé (autolinking pur, aucun plugin Expo) et `EXPO_PUBLIC_RC_IOS_KEY` documentée ; reste un checkpoint human-action bloquant (rebuild dev-client device + config App Store Connect / RevenueCat / sandbox).

## Ce qui a été fait (code/config — Task 1)

- **Dépendance ajoutée :** `react-native-purchases@10.4.0` dans `package.json` (`^10.4.0`) + `package-lock.json`. Peer dep `react-native >= 0.73.0` satisfaite (projet sur 0.81.5).
- **Décision plugin Expo (A1 résolu) :** vérifié que le package ne contient ni `app.plugin.js` ni champ `expo` dans son `package.json`. Il s'auto-lie via l'autolinking React Native (podspec `RNPurchases.podspec` pour iOS). **Aucune entrée `plugins[]` ajoutée à `app.json`** — en ajouter une ferait échouer le prebuild (plugin introuvable). `prebuild --clean` n'a volontairement PAS été lancé pour préserver le working tree managed (config app.json intacte, dont le bump buildNumber 28).
- **`.env.example` créé** à la racine documentant `EXPO_PUBLIC_RC_IOS_KEY` avec placeholder `appl_xxxxxxxxxxxx` (jamais de vraie clé). `.env` est gitignored (.gitignore ligne 34) ; `.env.example` est suivi (non couvert par `.env*.local`).

## Vérification

- `grep "react-native-purchases" package.json` → `"react-native-purchases": "^10.4.0"` ✓
- `grep "EXPO_PUBLIC_RC_IOS_KEY" .env.example` → présent, placeholder ✓
- Aucune vraie clé `appl_` réelle committée ✓
- `npx tsc --noEmit` : exit non-zéro, MAIS uniquement des erreurs **pré-existantes** dans `app/(tabs)/meals.tsx` et `hooks/useVault.ts` (fichiers non touchés par ce plan ; CLAUDE.md documente ces erreurs comme à ignorer). Aucune régression introduite par Task 1 (ajout dep + fichier .env.example ne peut pas créer d'erreur TS).

## Deviations from Plan

Aucune déviation fonctionnelle. Une précision sur l'étape plugin Expo : le plan prévoyait `npx expo prebuild --clean` pour détecter le besoin de plugin. Cette commande régénère les projets natifs et écraserait des éléments du working tree managed. Le besoin de plugin a été tranché de façon non-destructive en inspectant directement le package npm (absence de `app.plugin.js` + champ `expo`), ce qui donne une réponse définitive (autolinking pur) sans risque. Résultat identique à celui attendu (pas d'entrée plugin).

## Checkpoint bloquant — actions humaines requises (Task 2)

Task 2 (`checkpoint:human-action`, gate blocking) ne peut PAS être automatisée : elle requiert un device physique (que je n'ai pas) et des dashboards externes. Détail dans la section « CHECKPOINT REACHED » du message de l'exécuteur. Résumé :

1. **Rebuild dev-client (Piège 1) :** `npx expo run:ios --device` → l'app doit se lancer sans `Invariant Violation: 'new NativeEventEmitter()' requires a non-null argument`.
2. **App Store Connect (Team AKMNXGVVGX) :** 2 produits IAP — non-consommable `familyflow_lifetime_v1` (~29,99 €) + consommable `familyflow_story_pack_30` (~4,99 €), descriptions FR+EN, « disponible pour achat ».
3. **RevenueCat Dashboard :** app iOS (bundle ID = `com.familyvault.dev`, identique ASC), ASC API key, 2 Products (mêmes IDs), Entitlement `familyflow_premium` lié à `familyflow_lifetime_v1`, Offering `default` (current) avec 2 packages. Récupérer la clé `appl_…` → `.env` (EXPO_PUBLIC_RC_IOS_KEY).
4. **Sandbox :** testeur Sandbox ASC (@privaterelay) connecté sur l'iPhone (Réglages → App Store → Compte Sandbox).
5. **Vérif IDs :** Product IDs identiques caractère par caractère ASC↔RevenueCat ; entitlement = `familyflow_premium` (lu en dur Wave 2/3).

## Deferred Issues

Erreurs TS pré-existantes hors périmètre (CLAUDE.md « Erreurs pré-existantes … ignorer ») :
- `app/(tabs)/meals.tsx:3417/3458/3483` — expression `void` testée pour truthiness.
- `hooks/useVault.ts:2876` — incompatibilité type `setListParcours` (Promise<boolean> vs Promise<void>).

## Self-Check: PASSED

- FOUND: `.env.example`
- FOUND: `.planning/phases/54-monetisation-hybride-paiement/54-01-SUMMARY.md`
- FOUND: commit `aa26c8d0`
