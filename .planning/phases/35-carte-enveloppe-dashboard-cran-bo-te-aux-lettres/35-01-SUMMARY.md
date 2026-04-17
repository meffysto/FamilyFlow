---
phase: 35-carte-enveloppe-dashboard-cran-bo-te-aux-lettres
plan: 01
subsystem: lovenotes
tags: [lovenotes, selectors, route, dashboard]
requires:
  - hooks/useVaultLoveNotes.ts (Phase 34-03)
  - lib/types.ts LoveNote (Phase 34-01)
provides:
  - lib/lovenotes/selectors.ts (5 selecteurs purs : isRevealed, unreadForProfile, receivedForProfile, sentByProfile, archivedForProfile)
  - lib/lovenotes/index.ts (barrel)
  - app/(tabs)/lovenotes.tsx (ecran Boite aux lettres skeleton)
  - Route /(tabs)/lovenotes navigable (hidden via href:null)
affects:
  - app/(tabs)/_layout.tsx (+1 ligne declaration Tabs.Screen lovenotes)
tech-stack:
  added: []
  patterns:
    - now-injectable pour tests deterministes (pattern getCompanionMood Phase 10)
    - tri 3-tier comparator pour preserver la surprise (Open Question 5)
    - heure locale ISO sans Z (coherent LoveNote.revealAt)
key-files:
  created:
    - lib/lovenotes/selectors.ts
    - lib/lovenotes/index.ts
    - lib/__tests__/lovenotes-selectors.test.ts
    - app/(tabs)/lovenotes.tsx
  modified:
    - app/(tabs)/_layout.tsx
decisions:
  - isRevealed compare en heure locale (pad manuel) plutot que toISOString — cohesion avec LoveNote.revealAt local-ISO sans Z
  - tri 3-tier preserve la surprise des notes pending programmees futures (en bas)
  - Stub LoveNoteCard inline dans l'ecran — Plan 02 le remplacera par le vrai composant
metrics:
  duration: 4min
  completed: 2026-04-17
  tasks: 2
  files: 5
---

# Phase 35 Plan 01: Selecteurs lovenotes + Ecran Boite aux lettres skeleton

Sélecteurs dérivés purs testables (5 fonctions, tri 3-tier preservant la surprise) + écran route /(tabs)/lovenotes minimal (3 segments) qui débloque les Plans 02-03 sans risque de crash route inconnue.

## Résultats

| Tâche | Status | Commit |
|-------|--------|--------|
| Task 1 — Sélecteurs + 19 tests Jest + barrel | ✓ | 74e5245 |
| Task 2 — Écran lovenotes.tsx + déclaration _layout.tsx href:null | ✓ | b00abb3 |

## Vérification

- `npx jest lib/__tests__/lovenotes-selectors.test.ts --no-coverage` → **19/19 tests verts**
- `npx tsc --noEmit` (hors pré-existants MemoryEditor/cooklang/useVault) → **0 erreur nouvelle**
- Privacy : `grep -iE "(gabriel|marie|pierre|sophie|julien)" lib/__tests__/lovenotes-selectors.test.ts` → 0 résultat (fixtures lucas/emma/dupont uniquement)

## Décisions

1. **isRevealed compare en heure locale (pad manuel)** plutôt que `toISOString().slice(0,19)` comme suggéré dans le plan — la convention LoveNote stocke `revealAt` en heure locale sans Z (cf. types.ts:585), or `toISOString()` shift en UTC. Le plan d'origine aurait failli sur les TZ ≠ UTC. Décision Rule 1 (bug fix : la version naïve faisait échouer 2 tests sur 19, dont le test "now injecté déterministe" qui valide le contrat).
2. **Tri 3-tier dans receivedForProfile** : tier 1 (révélées non-lues, top) → tier 2 (déjà lues, milieu) → tier 3 (pending futures, bas). Préserve la surprise (Open Question 5 RESEARCH).
3. **Stub LoveNoteCard inline** dans l'écran — Plan 02 le remplacera. Évite couplage prématuré avec le visuel.

## Déviations

### Auto-fixed Issues

**1. [Rule 1 — Bug] isRevealed comparait en UTC au lieu d'heure locale**
- **Found during:** Task 1 — `npx jest` initial échouait 2/19 tests
- **Issue:** Le plan suggérait `now.toISOString().slice(0, 19)` mais `LoveNote.revealAt` est stocké en heure locale (ISO sans Z, cf. types.ts:585 et convention Phase 34). Sur une machine non-UTC, le `toISOString()` shift et casse la comparaison.
- **Fix:** Construction manuelle d'un ISO local : `${year}-${month}-${day}T${hh}:${mm}:${ss}` avec pad. Les 19/19 tests passent, contrat préservé.
- **Files modified:** lib/lovenotes/selectors.ts (1 fonction)
- **Commit:** 74e5245

## Suite

- **Plan 02 (Wave 2)** : composants visuels EnvelopeCard / WaxSeal / LoveNoteCard — peut consommer la route et les sélecteurs sans risque
- **Plan 03 (Wave 2)** : injection dashboard (carte enveloppe pinned) + entrée more — peut appeler `router.push('/(tabs)/lovenotes')` sans crash

## Self-Check: PASSED

- [x] lib/lovenotes/selectors.ts — FOUND
- [x] lib/lovenotes/index.ts — FOUND
- [x] lib/__tests__/lovenotes-selectors.test.ts — FOUND (19 tests verts)
- [x] app/(tabs)/lovenotes.tsx — FOUND
- [x] app/(tabs)/_layout.tsx — modifié (lovenotes déclarée href:null)
- [x] Commit 74e5245 — FOUND in git log
- [x] Commit b00abb3 — FOUND in git log
- [x] tsc clean (hors pré-existants)
- [x] privacy grep clean
