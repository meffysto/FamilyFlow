---
phase: 13-evenements-saisonniers
plan: "01"
subsystem: gamification
tags: [seasonal-events, saga, i18n, secure-store, mascot]

requires:
  - phase: 11-sagas-immersives
    provides: sagas-types.ts (Saga, SagaProgress, createEmptySagaProgress), sagas-storage.ts pattern, SagaChapter structure
  - phase: 03-gamification
    provides: SEASONAL_EVENTS + getActiveEvent() depuis seasonal.ts et seasonal-rewards.ts

provides:
  - Moteur complet événements saisonniers (types, détection, récompenses garanties, adaptateur saga)
  - Persistance SecureStore par profil avec clé composite eventId+year
  - Contenu narratif i18n des 8 événements (FR + EN) dans SEASONAL_EVENT_DIALOGUES
  - API prête pour câblage UI : shouldShowEventVisitor, getVisibleEventId, buildSeasonalEventAsSaga

affects:
  - 13-02 (câblage UI — consomme tous les exports de ce plan)
  - tree.tsx (ajout du visiteur événementiel dans la scène)

tech-stack:
  added: []
  patterns:
    - "SeasonalEventProgress avec clé composite eventId+year (évite duplication inter-annuelle)"
    - "drawGuaranteedSeasonalReward avec fallback en cascade (cible → pool inférieur → commun)"
    - "buildSeasonalEventAsSaga adapte un SeasonalEventContent en {saga, progress} réutilisant le système saga existant"
    - "loadEventProgressList / saveEventProgress suit exactement le pattern sagas-storage.ts"

key-files:
  created:
    - lib/mascot/seasonal-events-types.ts
    - lib/mascot/seasonal-events-engine.ts
    - lib/mascot/seasonal-events-storage.ts
    - lib/mascot/seasonal-events-content.ts
  modified:
    - locales/fr/gamification.json
    - locales/en/gamification.json

key-decisions:
  - "SeasonalEventProgress utilise clé composite eventId+year : évite qu'un événement soit marqué complété pour toutes les années futures"
  - "drawGuaranteedSeasonalReward descend en cascade (épique → rare → commun) si pool cible vide — jamais de retour null/undefined"
  - "buildSeasonalEventAsSaga produit un objet Saga standard avec finale.variants={} pour compatibilité avec SagaWorldEvent existant"
  - "SEASONAL_EVENT_BONUS_XP = 15 comme constante exportée pour cohérence entre moteur et contenu"
  - "st-valentin n'a que 2 choix (thème amour/tendresse), tous les autres événements ont 3 choix"

patterns-established:
  - "Chaque événement dans SEASONAL_EVENT_DIALOGUES : 1 chapitre, 2-3 choix, traits SagaTrait, points: 5"
  - "Clés i18n : mascot.event.{eventId}.{title|visitor_name|narrative|choiceA|choiceB|choiceC|cliffhanger}"
  - "Symétrie FR/EN obligatoire : toutes les clés présentes dans les deux locales"

requirements-completed: [EVT-01, EVT-02, EVT-03]

duration: 4min
completed: 2026-04-03
---

# Phase 13 Plan 01: Moteur Événements Saisonniers Summary

**Moteur d'événements saisonniers complet : types SeasonalEventProgress/SeasonalEventContent, détection calendaire, tirage garanti avec fallback cascade, persistance SecureStore clé composite, et contenu narratif i18n pour les 8 événements via SEASONAL_EVENT_DIALOGUES**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T18:27:27Z
- **Completed:** 2026-04-03T18:31:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- 4 fichiers `lib/mascot/seasonal-events-*.ts` créés — moteur complet prêt pour le Plan 02
- `drawGuaranteedSeasonalReward` garantit une récompense non-null (fallback cascade épique → rare → commun)
- 8 événements avec contenu narratif complet en FR et EN (title, visitor_name, narrative, 2-3 choices, cliffhanger)

## Task Commits

1. **Task 1: Types + engine + storage des événements saisonniers** - `a24e745` (feat)
2. **Task 2: Contenu narratif i18n des 8 événements saisonniers** - `c01a3ee` (feat)

## Files Created/Modified

- `lib/mascot/seasonal-events-types.ts` — SeasonalEventProgress (avec year pour clé composite) + SeasonalEventContent
- `lib/mascot/seasonal-events-engine.ts` — shouldShowEventVisitor, getVisibleEventId, drawGuaranteedSeasonalReward, buildSeasonalEventAsSaga, SEASONAL_EVENT_BONUS_XP, CHOICE_RARITY_MAP
- `lib/mascot/seasonal-events-storage.ts` — loadEventProgressList, saveEventProgress (SecureStore, pattern identique sagas-storage)
- `lib/mascot/seasonal-events-content.ts` — SEASONAL_EVENT_DIALOGUES (8 événements), getEventContent()
- `locales/fr/gamification.json` — ajout `mascot.event` avec 8 sous-clés FR
- `locales/en/gamification.json` — ajout `mascot.event` avec 8 sous-clés EN

## Decisions Made

- Clé composite eventId+year dans SeasonalEventProgress : évite la situation où un événement complété une année serait considéré complété pour toutes les années futures
- `drawGuaranteedSeasonalReward` descend en cascade plutôt que de remonter : le choix de l'utilisateur détermine la rareté cible, mais le fallback assure qu'il y a toujours une récompense
- `buildSeasonalEventAsSaga` produit `finale: { variants: {}, defaultTrait: 'courage' }` — compatible avec le composant SagaWorldEvent existant sans modification
- St-Valentin limité à 2 choix (thème amour/tendresse — A/B suffit), tous les autres événements ont 3 choix (A/B/C)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 peut câbler l'UI directement : shouldShowEventVisitor, getVisibleEventId, buildSeasonalEventAsSaga, getEventContent sont tous exportés et typés
- Les sprites visiteurs sont des placeholders (décision D-05 du CONTEXT.md) — à remplacer via PixelLab après le code
- tree.tsx devra être modifié pour orchestrer le visiteur événementiel (en plus du visiteur saga existant)

## Self-Check: PASSED

- lib/mascot/seasonal-events-types.ts: FOUND
- lib/mascot/seasonal-events-engine.ts: FOUND
- lib/mascot/seasonal-events-storage.ts: FOUND
- lib/mascot/seasonal-events-content.ts: FOUND
- Commit a24e745: FOUND
- Commit c01a3ee: FOUND

---
*Phase: 13-evenements-saisonniers*
*Completed: 2026-04-03*
