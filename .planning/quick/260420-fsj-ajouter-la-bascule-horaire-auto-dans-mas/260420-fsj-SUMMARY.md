---
phase: quick-260420-fsj
plan: 01
subsystem: ios-widget
tags: [live-activity, timeline-view, swift, mascotte, stage-auto]
key-files:
  modified:
    - ios/MaJourneeWidget/MascotteLiveActivity.swift
decisions:
  - "TimelineView(.explicit) par région DynamicIsland (pas un wrapper global) — l'API DynamicIsland exige des View conformes pour chaque closure"
  - "schedule calculé une seule fois dans le closure `dynamicIsland:` via let schedule = MascotteStage.upcomingTransitionDates() et partagé entre toutes les régions"
  - "horizonHours: 48 pour couvrir 2 jours de transitions — équilibre mémoire/couverture"
metrics:
  duration: "~10min"
  completed: "2026-04-20"
  tasks: 1
  files: 1
---

# Quick Task 260420-fsj: Bascule horaire auto dans la Live Activity mascotte

**One-liner:** TimelineView(.explicit) wrappé sur chaque région LockScreen + DynamicIsland pour bascule stage autonome aux heures de transition (9h/12h/14h/18h/21h/0h) sans update ActivityKit.

## Ce qui a été fait

### Task 1 — TimelineView + upcomingTransitionDates

**Fichier modifié:** `ios/MaJourneeWidget/MascotteLiveActivity.swift`

**Ajout dans `MascotteStage`:**
```swift
static func upcomingTransitionDates(from now: Date = Date(), horizonHours: Int = 48) -> [Date]
```
Calcule les prochaines heures de transition sur 48h en heure locale device. Inclut `now` en première entry pour le render initial.

**LockScreen:** `MascotteLockScreenView.body` — le `let stage = MascotteStage.resolve(date: Date(), ...)` top-level et le `Group { }` wrapper remplacés par `TimelineView(.explicit(MascotteStage.upcomingTransitionDates())) { timeline in ... }`. Le stage est résolu depuis `timeline.date`.

**DynamicIsland:** Le `let stage = MascotteStage.resolve(date: Date(), ...)` top-level supprimé. Un `let schedule = MascotteStage.upcomingTransitionDates()` calculé en tête du closure `dynamicIsland:`. Chaque région (expanded leading, center, bottom, compactLeading, compactTrailing, minimal) est wrappée individuellement dans `TimelineView(.explicit(schedule)) { timeline in ... }`.

## Vérifications passées

- `swiftc -typecheck` passe sans erreur sur le fichier
- `ContentState` inchangé (5 champs: tasksDone, tasksTotal, xpGained, currentMeal, stageOverride)
- Aucun `MascotteStage.resolve(date: Date(), ...)` top-level ne subsiste
- `stageOverride` transmis à chaque `MascotteStage.resolve(date:override:)` — mode dev préservé
- Les updates ActivityKit (tasksDone, currentMeal, xpGained) passent toujours via ContentState sans modification

## Note sur le versionning

Le répertoire `ios/` est exclu par `.gitignore` (code Xcode natif non versionné). La modification est effective sur disque. Le commit inclut uniquement les artefacts de planification (.planning/).

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Self-Check: PASSED

- Fichier `/Users/gabrielwaltio/Documents/family-vault/ios/MaJourneeWidget/MascotteLiveActivity.swift` : FOUND (246 lignes, contient TimelineView + upcomingTransitionDates)
- swiftc type-check : PASSED (aucune erreur)
- ContentState shape : INCHANGÉ
