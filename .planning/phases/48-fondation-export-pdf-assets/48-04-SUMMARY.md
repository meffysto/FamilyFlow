---
phase: 48-fondation-export-pdf-assets
plan: 04
subsystem: pdf-export
tags: [cache, non-regression, decision-doc]
requires: [48-03]
provides:
  - Décision "no bump CACHE_VERSION" documentée dans le code
  - Sweep non-régression Phase 48 verte (TS clean + suite Jest stable)
affects:
  - lib/vault-cache.ts (commentaire Phase 48 ajouté ligne ~67)
tech-stack:
  added: []
  patterns: [commentaire de décision in-code + référence RESEARCH.md]
key-files:
  created: []
  modified:
    - lib/vault-cache.ts
decisions:
  - "CACHE_VERSION reste à 13 — manifeste impressions est un nouveau domaine NON inclus dans VaultCacheState (lecture rare, volume ≤50 entrées). Bumper inutilement invaliderait le cache de tous les utilisateurs (Pitfall 3 RESEARCH.md ligne 361)."
  - "Commentaire de décision ajouté dans lib/vault-cache.ts ligne 67 + référence à .planning/phases/48-*/48-RESEARCH.md (T-48-09 mitigé)"
metrics:
  duration: ~3min
  completed: 2026-05-04
requirements: [PDF-05, QA-01, QA-02]
---

# Phase 48 Plan 04 : Décision cache + non-régression — Summary

Décision finale Phase 48 : **`CACHE_VERSION` reste à 13 (inchangé)**. Justification documentée dans le code (`lib/vault-cache.ts` ligne ~67) et dans RESEARCH.md section "CACHE_VERSION Decision". Suite Jest et TS validées : aucune régression introduite par les plans 48-01 → 48-04.

## Décision finale

`lib/vault-cache.ts` ligne 67 : `const CACHE_VERSION = 13;` **inchangé**. Le manifeste impressions n'est pas dans `VaultCacheState` :
- Aucun import `lib/pdf` dans `vault-cache.ts` (vérifié `grep` → 0)
- Aucune référence `manifeste` / `BookManifest` / `BookExport` dans le fichier
- Volume attendu très faible, lecture rare → pas de gain à cacher

Commentaire ajouté ligne 67 :
```typescript
// v13: Phase B Histoires — Profile.storyDefaults (préférences durables wizard)
// Phase 48 (Export PDF Lulu) : aucun bump — manifeste impressions est un
// nouveau domaine NON inclus dans VaultCacheState (lecture rare, volume
// faible). Voir lib/pdf/manifest-parser.ts + .planning/phases/48-*/48-RESEARCH.md
// section "CACHE_VERSION Decision".
const CACHE_VERSION = 13;
```

## Sweep non-régression

| Commande | Résultat |
|----------|----------|
| `npx tsc --noEmit` | exit 0 — clean |
| `npx jest --no-coverage` | 73 suites passed / 4 failed (17 tests failed sur 1952). **Tous les fails sont pré-existants** : `auberge-auto-tick`, `codex-content`, `useVaultCourses`, `insights` — non touchés par Phase 48. Vérifié via `git stash` (mêmes échecs sans la modif). |
| `PASS lib/__tests__/pdf-manifest-parser.test.ts` | 10/10 (Phase 48-03 confirmé) |
| `npm list expo-print react-native-qrcode-svg` | `expo-print@15.0.8`, `react-native-qrcode-svg@6.3.21` |

## Critères de succès ROADMAP Phase 48

- [x] **#1** Deps installées : `expo-print@15.0.8` + `react-native-qrcode-svg@6.3.21`
- [x] **#2** Andika Regular+Bold+OFL bundlés (`assets/fonts/Andika/`) + chargés au boot via `useFonts`
- [x] **#3** `lib/pdf/index.ts` exporte `TRIM_SIZE_CM`, `BLEED_CM`, `PAGE_COUNT`, `BookExportSpec`, `BookManifestEntry` (10 exports total)
- [x] **#4** Round-trip parser test : `parseManifeste(serializeManifeste(SAMPLE_THREE)) toEqual SAMPLE_THREE` ✓ (10/10 tests pdf)
- [x] **#5** TS clean (hors erreurs pré-existantes CLAUDE.md) + Jest sans nouvelle régression

## Deviations from Plan

Aucune. Plan exécuté tel quel : ajout du commentaire Phase 48 + sweep + aucun bump. Note méthodologique : la commande `--listFailing` du PLAN ligne 140 n'existe pas dans Jest 29 — remplacée par `tail` + comparaison `git stash` pour distinguer fails pré-existants vs nouveaux. Pas un deviation au sens code (aucun fichier différent), juste un ajustement de la méthode de vérification.

## Self-Check: PASSED

- `lib/vault-cache.ts` contient "Phase 48" — FOUND (ligne 67)
- `CACHE_VERSION = 13` inchangé — FOUND
- `CACHE_FILENAME = 'vault-cache-v13.json'` inchangé — FOUND
- Aucun import `lib/pdf` dans `vault-cache.ts` — VERIFIED (grep 0)
- TS clean, Jest fails pré-existants confirmés
- Phase 48 prête pour Phase 49 (génération PDF effective)
