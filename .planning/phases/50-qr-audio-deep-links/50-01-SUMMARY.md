---
phase: 50-qr-audio-deep-links
plan: 01
subsystem: deep-links
tags: [config, deep-link, ios, universal-links]
requires: []
provides:
  - "scheme family-vault confirmé"
  - "placeholder ios.associatedDomains prêt pour migration Universal Links"
affects:
  - app.json
key_files:
  modified:
    - app.json
created: []
decisions:
  - "Conserver scheme `family-vault://` (avec tiret) — divergence assumée vs ROADMAP `familyvault://` pour ne pas casser les deep links existants `import-note` et `open/*`"
  - "Placeholder `applinks:placeholder.familyflow.app` plutôt qu'un domaine réel — explicite l'intention non-active"
  - "Pas de modif Android `intentFilters` — focus iOS, scheme custom Android suit automatiquement"
metrics:
  tasks_completed: 3
  tasks_total: 3
  duration: "~5min"
  completed: 2026-05-05
---

# Phase 50 Plan 01 : Configuration scheme + Universal Links placeholder — Summary

Confirmation du scheme `family-vault` et ajout d'un placeholder `ios.associatedDomains` dans `app.json` pour préparer la future migration Universal Links sans en activer le mécanisme. Base stable pour les Plans 02 (route `app/story/[id].tsx`) et 03 (génération QR encodant `family-vault://story/{id}`).

## Tâches complétées

| # | Tâche | Status | Commit |
|---|-------|--------|--------|
| 1 | Confirmer scheme `family-vault` dans app.json | ✅ Vérifié (déjà en place ligne 6) | — (pas de modif) |
| 2 | Ajouter placeholder `ios.associatedDomains` | ✅ Ajouté ligne 25 | f2f32f13 |
| 3 | Validation TypeScript + commit atomique | ✅ TS clean, commit FR | f2f32f13 |

## Fichiers modifiés

- `app.json` : ajout d'une ligne `"associatedDomains": ["applinks:placeholder.familyflow.app"]` sous `expo.ios`, juste après `appleTeamId`. Scheme `family-vault` inchangé.

## Commits

- **f2f32f13** — `feat(50-01): confirme scheme family-vault + placeholder associatedDomains`

## Vérifications

- ✅ `node -e "..."` : `expo.scheme === "family-vault"`
- ✅ `node -e "..."` : `expo.ios.associatedDomains === ["applinks:placeholder.familyflow.app"]`
- ✅ `JSON.parse(app.json)` : syntaxe valide
- ✅ `npx tsc --noEmit` : pas de nouvelle erreur (modifs `app.json` n'affectent pas les types)
- ✅ `app/+native-intent.ts` non touché — pas de conflit avec règles existantes `import-note` / `open/*`

## Divergences assumées

### ROADMAP `familyvault://` vs app.json `family-vault://`

Le ROADMAP mentionnait initialement le scheme `familyvault://` (sans tiret). Décision actée dans `50-CONTEXT.md` §21-22 : **conserver `family-vault://`** car :

1. Le scheme est déjà en production (TestFlight) depuis plusieurs versions.
2. Changer casserait les deep links existants utilisés par `app/+native-intent.ts` (`import-note?url=…` et `open/*`).
3. Les schemes avec tiret sont valides RFC 3986 — aucun bug iOS/Android.

→ Les futurs Plans 02 et 03 encoderont donc `family-vault://story/{id}`.

## Étapes future migration Universal Links (hors scope Phase 50)

Le placeholder `applinks:placeholder.familyflow.app` est inerte tant qu'aucun fichier AASA n'est servi. Pour activer plus tard les Universal Links HTTPS réels :

1. **Acquérir un domaine** : `familyflow.app` (ou `links.familyflow.app`).
2. **Héberger l'AASA** sur `https://<domaine>/.well-known/apple-app-site-association` :
   - MIME `application/json`
   - **Pas d'extension `.json`** dans l'URL
   - Servi en HTTPS valide (cert non expiré)
3. **Contenu AASA** :
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "AKMNXGVVGX.com.familyvault.dev",
           "paths": ["/story/*"]
         }
       ]
     }
   }
   ```
4. **Mettre à jour `app.json`** : remplacer `placeholder.familyflow.app` par le domaine réel dans `ios.associatedDomains`.
5. **Pour Android App Links** :
   - Héberger `https://<domaine>/.well-known/assetlinks.json`
   - Ajouter `android.intentFilters` dans `app.json` avec `autoVerify: true`
6. **Re-build dev-client** : `npx expo run:ios --device` puis tester scan QR HTTPS.

## Décisions ouvertes léguées au Plan 02

- Choix entre `Linking.parseInitialURLAsync` vs hooks expo-router pour le handler de la route `app/story/[id].tsx` (RESEARCH §4 recommande hooks expo-router).
- Déclencheur exact de l'autoplay audio (`useEffect` au mount vs après préchargement asset).
- Wording exact de la légende QR sous le code dans le PDF (Plan 03).

## Self-Check: PASSED

- ✅ `app.json` modifié et committé (f2f32f13)
- ✅ `expo.scheme === "family-vault"` confirmé
- ✅ `expo.ios.associatedDomains` présent et valide
- ✅ TypeScript clean
- ✅ Commit en français au format `feat(50-01): ...`
