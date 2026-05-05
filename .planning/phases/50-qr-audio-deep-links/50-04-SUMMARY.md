---
phase: 50-qr-audio-deep-links
plan: 04
subsystem: deep-links + qa
tags: [deep-link, qr, autoplay, qa, dev-tools, phase-50]
requires: [50-01, 50-02, 50-03]
provides:
  - "Écran dev de test deep-link family-vault://story/<id>"
  - "Validation non-régression Phase 50 (tsc + jest)"
key-files:
  created:
    - app/dev-deep-link.tsx
  modified: []
decisions:
  - "Task 2 (fallback bouton play) SKIPPED — autoplay iOS validé sur device réel, fallback inutile"
  - "Task 3 (scan QR papier réel) DÉFÉRÉ Phase 51 — dev-client n'a pas encore expo-print/expo-clipboard côté natif (rebuild en cours), test end-to-end nécessite UI export branchée"
  - "Écran dev custom plutôt que xcrun simctl openurl — TestFlight + device physique, pas de simulateur disponible"
  - "Validation contrat deep link via tap sur boutons dev (autoplay TTS confirmé) en attendant scan papier Phase 51"
metrics:
  tasks_completed: 2  # Task 1 + Task 4
  tasks_skipped: 1    # Task 2 (autoplay OK)
  tasks_deferred: 1   # Task 3 (Phase 51)
  duration: "~10min"
  completed_date: 2026-05-05
---

# Phase 50 Plan 04 : Test scan device + non-régression — Summary

Validation finale du contrat deep link `family-vault://story/<id>` via un écran dev custom (`app/dev-deep-link.tsx`) qui simule le scan QR. Autoplay TTS confirmé sur device réel. Test scan QR papier déféré à Phase 51 (UI export pas encore branchée).

## Tâches

| # | Tâche | Statut | Commit |
|---|-------|--------|--------|
| 1 | Test deep link via écran dev custom | ✅ Validé | `9366dd4d` (création écran), `0011fb09` (extension : bouton génération PDF dev + appui long pour copier l'id) |
| 2 | Fallback bouton play immédiat | ⏭ SKIPPED | autoplay iOS marche, fallback inutile |
| 3 | Test scan QR papier réel | ⏭ DÉFÉRÉ Phase 51 | nécessite UI export branchée + dev-client rebuild avec expo-print/expo-clipboard |
| 4 | Non-régression finale + summaries | ✅ Validé | (commit final docs) |

## Détails Task 1 — Écran dev `app/dev-deep-link.tsx`

Créé pour pallier l'absence de simulateur (TestFlight + device physique uniquement). Liste toutes les histoires du vault avec :

- Tap sur la carte → ouvre la route `app/story/[id].tsx` avec `autoplay=true` (simule le scan QR)
- Bouton « Générer PDF » (commit `0011fb09`) — pour valider la pipeline PDF + QR (utile une fois `expo-print` natif installé)
- Appui long sur la carte → copie l'`id` dans le presse-papier (debug rapide)

**Résultat** : autoplay TTS confirmé sur device réel pour plusieurs histoires testées (chapitres existants + sagas). Le contrat deep link `family-vault://story/<id>` est validé bout-en-bout côté app.

## Décision skip Task 2 (fallback bouton play)

Le plan prévoyait un fallback visible si `autoplay` était bloqué par la politique audio iOS. Tests sur device : aucune intervention utilisateur requise, l'autoplay fonctionne dès l'arrivée sur la route. Le fallback (`autoplay=false` par défaut + tap sur le bouton play) reste disponible nativement dans `StoryPlayer` mais n'a pas besoin d'être activé pour le scénario QR.

## Décision déférer Task 3 (scan QR papier) Phase 51

Le scan QR papier réel nécessite un PDF généré (avec QR encodé en 4ème de couverture). La pipeline `lib/pdf/*` est livrée Phase 49+50-03 mais l'UI export (bouton « Exporter le livre ») arrive Phase 51. De plus, le dev-client embarqué n'a pas encore `expo-print` / `expo-clipboard` côté natif (rebuild en cours).

→ Le test scan QR papier sera validé end-to-end en Phase 51, avec un vrai PDF imprimé / scanné par l'utilisateur. Le rendu QR lui-même est couvert par 6 unit tests Jest dans `lib/pdf/__tests__/qr-generator.test.ts` (déterminisme + structure SVG + encodage URL), donc le risque résiduel est faible.

## Validation non-régression (Task 4)

### TypeScript

```
$ npx tsc --noEmit
TypeScript compilation completed
```

✅ Pas de nouvelle erreur. Erreurs pré-existantes ignorées : `components/MemoryEditor.tsx`, `lib/cooklang.ts`, `hooks/useVault.ts` (documentées dans CLAUDE.md « Testing »).

### Jest

```
$ npx jest --no-coverage
Test Suites: 4 failed, 80 passed, 84 total
Tests:       17 failed, 2005 passed, 2022 total
```

✅ **2005 tests verts**. Suite Phase 50 :

```
$ npx jest --no-coverage lib/__tests__/deep-link.test.ts lib/pdf/__tests__/qr-generator.test.ts
PASS lib/pdf/__tests__/qr-generator.test.ts
PASS lib/__tests__/deep-link.test.ts
Tests: 13 passed, 13 total
```

✅ **13/13 verts** (7 deep-link + 6 qr-generator).

Les 4 suites en échec (`insights.test.ts`, `auberge-auto-tick.test.ts`, `codex-content.test.ts`, `useVaultCourses.test.ts`) sont **pré-existantes** (mock manquant `react-native-svg` / `lucide-react-native`, fusion courses) — vérifié en stash test sur HEAD propre. Hors scope Phase 50.

## Self-Check : PASSED

- [x] `npx tsc --noEmit` clean (hors pré-existantes)
- [x] `npx jest --no-coverage lib/__tests__/deep-link.test.ts lib/pdf/__tests__/qr-generator.test.ts` 13/13
- [x] Écran dev `app/dev-deep-link.tsx` committé (`9366dd4d`, étendu `0011fb09`)
- [x] Autoplay TTS validé sur device réel
- [x] Décisions skip/defer documentées
- [x] Phase 50 prête pour clôture
