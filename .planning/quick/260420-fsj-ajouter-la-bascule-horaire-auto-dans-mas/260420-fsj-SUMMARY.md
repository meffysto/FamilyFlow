---
phase: quick-260420-fsj
plan: 01
subsystem: ios-widget
tags: [live-activity, activitykit, stale-date, swift, mascotte, stage-auto]
key-files:
  modified:
    - widgets/MaJournee/MascotteLiveActivity.swift
    - modules/vault-access/ios/VaultAccessModule.swift
    - ios/MaJourneeWidget/MascotteLiveActivity.swift
    - app/(tabs)/tree.tsx
research:
  - .planning/quick/260420-fsj-ajouter-la-bascule-horaire-auto-dans-mas/260420-fsj-TIMELINEVIEW-RESEARCH.md
decisions:
  - "TimelineView NE FONCTIONNE PAS dans les Live Activities (bug iOS FB15590204) — widget extension suspendu ~10s après lancement, aucun schedule (.explicit/.everyMinute/.periodic) n'est réveillé"
  - "Pattern final : staleDate pointant la prochaine transition horaire → iOS re-render best-effort à ce moment → Date() au render calcule le bon stage"
  - "Seules primitives fiables d'auto-update dans une LA : Text(timerInterval:) et ProgressView(timerInterval:) — pas applicables ici (changement d'UI conditionnel, pas un compteur)"
metrics:
  duration: "~90min (1 itération TimelineView ratée + research + implementation staleDate)"
  completed: "2026-04-20"
  tasks: 1
  files: 4
---

# Quick Task 260420-fsj: Bascule horaire auto dans la Live Activity mascotte

**One-liner:** Stage narratif mascotte bascule automatiquement aux heures clés (9h/12h/14h/18h/21h/0h) via `staleDate` sur chaque `activity.update()` — iOS re-render best-effort près de la transition, le view body évalue `Date()` et résout le bon stage.

## Contexte

La Live Activity affiche 6 stages narratifs selon l'heure (réveil/travail/midi/jeu/routine/dodo). Objectif : le stage change tout seul à 12h00 sans que l'app pousse d'update, même téléphone verrouillé.

## Ce qui a été essayé et NE MARCHE PAS

### ❌ `TimelineView(.explicit([dates]))`

Première tentative. Idée : SwiftUI TimelineView avec les dates de transition explicites → re-render aux heures précises.

**Résultat sur device :** stage figé à l'heure de démarrage. À 12h02, encore "travail" ⛏️.

### ❌ `TimelineView(.everyMinute)`

Fallback plus robuste testé ensuite. Même résultat — aucune bascule.

### Cause racine (research)

Bug Apple documenté (FB15590204) : le widget extension est **suspendu ~10 secondes après le démarrage de la Live Activity**. Aucun schedule SwiftUI (`.explicit` / `.everyMinute` / `.periodic`) n'est réveillé par iOS ensuite. Contrairement aux WidgetKit widgets, **les Live Activities n'ont pas de TimelineProvider**.

Sources : Apple Dev Forum threads 766932, 715138, Apple doc officielle ActivityKit.

Détails : `260420-fsj-TIMELINEVIEW-RESEARCH.md`

## Solution finale : `staleDate`

### Changements

**`widgets/MaJournee/MascotteLiveActivity.swift`** + sync vers `ios/MaJourneeWidget/`
- Retrait complet de tous les `TimelineView` (code mort dans les LA)
- Retrait de `MascotteStage.upcomingTransitionDates()` (plus utilisé côté widget)
- `MascotteLockScreenView.body` et closure `dynamicIsland:` reviennent à `let stage = MascotteStage.resolve(date: Date(), override: context.state.stageOverride)` au render time

**`modules/vault-access/ios/VaultAccessModule.swift`**
- Nouveau helper `mascotteNextTransitionDate(from:)` : renvoie la prochaine heure de transition (0/9/12/14/18/21h) en heure locale
- `startMascotteActivity` : `ActivityContent(state: ..., staleDate: mascotteNextTransitionDate())`
- `updateMascotteActivity` : idem → chaque update repousse la staleDate à la prochaine transition

**`app/(tabs)/tree.tsx`** (bug collatéral découvert pendant les tests)
- Violation des Rules of Hooks : `if (!profile) return null` à la ligne 1155 suivie de ~30 hooks (useMemo, useCallback)
- Fix : guard déplacé juste avant le `return` JSX + 4 accès directs à `profile` rendus null-safe (`profile?.`)
- Bug pré-existant, non lié à la feature, mais bloquant le test device

## Comment ça fonctionne maintenant

1. App pousse un `activity.update()` (au lancement, ou quand tu coches une tâche) avec `staleDate = prochaine heure de transition`
2. À cette heure, iOS marque le contenu comme stale (hint système, best-effort)
3. iOS tente de re-render le widget extension → le view body évalue `Date()` → `MascotteStage.for(date: Date())` renvoie le nouveau stage → UI mise à jour
4. Chaque interaction utilisateur (déverrouillage, app ouverte, tâche cochée) déclenche aussi un render → stage quasi-toujours à jour en usage réel

## Limites connues

- **Téléphone verrouillé pendant plusieurs heures sans interaction** : iOS peut retarder le re-render post-staleDate (best-effort, pas garanti pile à l'heure). Lag observé < 1 minute en test.
- **Mode batterie faible** : iOS peut skip les re-renders opportunistes entièrement
- **Activité >8h** : iOS tue automatiquement la Live Activity, à relancer le lendemain

Si un jour on veut du pile-poile garanti, bascule sur `BGTaskScheduler` via bridge natif (option B du research doc).

## Vérifications passées

- `swiftc -typecheck` OK (pas d'erreur widget extension)
- `tsc --noEmit` OK (fix tree.tsx n'a pas cassé le typage)
- Test device iOS : stage passe bien en `midi` 🍽️ à ~12h01 avec téléphone verrouillé depuis 11:58 ✅
- `stageOverride` dev menu toujours fonctionnel (bypass staleDate, forçage immédiat)
- Updates ActivityKit (tâches, repas, XP) continuent de s'afficher correctement

## Notes pour le futur

- **Ne plus tenter TimelineView dans une Live Activity** — c'est un cul-de-sac documenté par Apple
- Les seules primitives auto-animées dans une LA sont `Text(timerInterval:)` et `ProgressView(timerInterval:)`
- Pour tout changement d'UI conditionnel : `staleDate` + `activity.update()` + re-évaluation au render
- `ios/` reste gitignored — les `.swift` sources de vérité vivent dans `widgets/MaJournee/` et `modules/vault-access/ios/`

## Deviations from Plan

Plan initial basé sur TimelineView (approche recommandée à tort). Pivot complet après test device et research documentée. La solution finale est différente du plan mais l'objectif fonctionnel est atteint.
