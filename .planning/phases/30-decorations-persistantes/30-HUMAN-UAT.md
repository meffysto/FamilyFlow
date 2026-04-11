---
status: partial
phase: 30-decorations-persistantes
source: [30-VERIFICATION.md]
started: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Rebuild device iOS (post-hotfix coords) — ouvrir Village avec au moins un bâtiment débloqué
expected: Les sprites bâtiments (puits, boulangerie, marché, café, forge) du band supérieur apparaissent SOUS le header village (status bar + titre + bouton home-city), jamais derrière ni clippés par le header absolute-positionné. Coords Y hotfix : puits 0.22, boulangerie/marché/café 0.18, forge 0.28.
result: [pending]

### 2. Cycle d'idempotence réel iCloud — restart app ×5 minimum avec familyLifetimeLeaves > 100
expected: Le fichier vault `04 - Gamification/jardin-familial.md` section `## Constructions` ne contient JAMAIS de doublons pour un même buildingId, même après restarts successifs. La double-couche (regex guard appendBuilding + dedup parseGardenFile) doit garantir zéro ligne dupliquée.
result: [pending]

### 3. Badge "Nouveau ✨" lifecycle — franchir un palier feuilles puis ouvrir catalogue
expected: Le bâtiment nouvellement débloqué affiche un badge "Nouveau ✨" avec animation spring scale + star gold ; après fermeture et ré-ouverture du catalogue, le badge disparaît (SecureStore `village_buildings_seen_at` mis à jour).
result: [pending]

### 4. Rendu visuel catalogue — bouton header home-city dans village.tsx
expected: Modal pageSheet s'ouvre en slide, affiche les 8 bâtiments en grille 2 colonnes. Débloqués : full color + label "Débloqué" vert. Verrouillés : silhouette (tintColor textMuted + opacity 0.4) + "À N feuilles" + progression `{current}/{target} feuilles familiales`. Tap verrouillé → toast "Encore N feuilles..." + haptic light. Tap débloqué → pulse spring + haptic selection.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
