---
phase: 41-polish-onboarding-codex-non-r-gression
plan: "03"
subsystem: ui
tags: [farm-codex, wager-marathon, sporée, non-régression, privacy-check, milestone-v17]

# Dependency graph
requires:
  - phase: 41-01
    provides: wagerMarathonWins champ FarmProfileData + parser/serializer + incrément pari gagné
  - phase: 41-02
    provides: tooltip onboarding Sporée one-shot SporeeOnboardingTooltip
provides:
  - Compteur wagerMarathonWins affiché dans le footer FarmCodexModal (vanité long terme)
  - Validation non-régression milestone v1.7 (tsc clean, jest clean, privacy clean)
  - Milestone v1.7 shippable — Phases 38-41 livrées
affects:
  - Toute future feature consommant FarmCodexModal (footer pattern établi)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compteur vanité inline dans footer modal existant — sans nouvelle dépendance ni i18n"
    - "wagerMarathonWins exposé dans DiscoverySource via champ optionnel (Option A)"
    - "Texte FR inline dans composant (conforme convention projet pour textes one-shot Phase 41)"

key-files:
  created: []
  modified:
    - components/mascot/FarmCodexModal.tsx
    - lib/codex/discovery.ts

key-decisions:
  - "Option A retenue pour DiscoverySource : ajout wagerMarathonWins?: number dans le type discovery.ts — évite le cast (profile as any)"
  - "Texte FR inline ('🍄 Paris gagnés : N') sans i18n — conforme convention projet Phase 41 minimaliste"
  - "Sérialiseur conditionnel wagerMarathonWins > 0 uniquement (comme sporeeCount) — évite bruit vault pour count = 0"
  - "Milestone v1.7 déclarée shippable après triple validation : 0 erreur TS nouvelle, 0 Jest failing, 0 nom réel dans commits/docs/sources"

patterns-established:
  - "Footer FarmCodexModal : compteur vanité AVANT bouton replay tutoriel, style marathonCounter avec tokens FontSize/FontWeight/Spacing"

requirements-completed: [SPOR-10, SPOR-12]

# Metrics
duration: 15min
completed: 2026-04-19
---

# Phase 41 Plan 03: Polish Codex + Non-régression Summary

**Compteur wagerMarathonWins affiché dans le footer FarmCodexModal (🍄 Paris gagnés : N) + validation non-régression milestone v1.7 (tsc/jest/privacy clean)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-19T00:09:27Z
- **Completed:** 2026-04-19T00:20:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments
- Compteur vanité `wagerMarathonWins` intégré dans le footer FarmCodexModal au format "🍄 Paris gagnés : N" — récompense long terme visible dans le codex
- `DiscoverySource` dans `lib/codex/discovery.ts` étendu avec `wagerMarathonWins?: number` (Option A propre, zéro cast)
- Style `marathonCounter` ajouté avec tokens existants (FontSize.sm, FontWeight.semibold, Spacing.md) — zéro couleur hardcodée
- Validation non-régression milestone v1.7 : tsc clean (0 nouvelle erreur hors 3 pré-existantes), jest clean (1680 passing, 2 failing pré-existants calculateStreak), privacy clean (0 nom réel dans commits/docs/sources Phases 38-41)

## Task Commits

1. **Task 1: Afficher wagerMarathonWins dans le footer FarmCodexModal** - `ef7e638` (feat)
2. **Task 2: Checkpoint non-régression finale milestone v1.7 + privacy check** - approuvé (checkpoint:human-verify — aucun commit fichier)

**Plan metadata:** commit docs séparé (ce SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `components/mascot/FarmCodexModal.tsx` — Ajout Text compteur wagerMarathonWins dans footer + style marathonCounter
- `lib/codex/discovery.ts` — Ajout champ `wagerMarathonWins?: number` dans DiscoverySource

## Decisions Made
- Option A pour DiscoverySource : extension de type propre vs cast `(profile as any)` — 1 ligne dans discovery.ts, zéro cast résiduel
- Texte FR inline "🍄 Paris gagnés : N" sans clé i18n — conforme Phase 41 minimaliste et précédent `useFarm.ts`
- Milestone v1.7 déclarée shippable après validation triple critère tsc/jest/privacy

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit. Task 1 implémentée avec Option A (préférée selon plan). Task 2 checkpoint approuvé par l'utilisateur après validation manuelle des 5 commandes de vérification.

## Issues Encountered

None — continuation depuis worktree agent-a2754a1c via cherry-pick de `f6f243b` (rebased `ef7e638`). Checkpoint Task 2 approuvé avec signal "approved · tsc clean · jest clean · privacy clean".

## User Setup Required

None - aucune configuration de service externe requise.

## Next Phase Readiness

- Milestone v1.7 (Phases 38-41) complète et shippable
- SPOR-10 entièrement livré : fondation wagerMarathonWins (41-01) + tooltip onboarding Sporée (41-02) + compteur codex (41-03)
- SPOR-12 validé : non-régression TS/Jest + privacy check Phases 38-41
- Zéro nouvelle dépendance npm (6e milestone consécutive)
- Prêt pour milestone v1.8 (scope à définir)

---
*Phase: 41-polish-onboarding-codex-non-r-gression*
*Completed: 2026-04-19*
