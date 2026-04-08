---
phase: 13-evenements-saisonniers
verified: 2026-04-03T19:10:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Activer un événement test dans seasonal.ts et lancer l'app sur device"
    expected: "Un visiteur pixel apparaît côté gauche (x≈28%) de la scène arbre avec animation d'arrivée, distinct du visiteur saga côté droit"
    why_human: "Animation et positionnement pixel ne peuvent pas être vérifiés statiquement — nécessite rendu natif sur device physique"
  - test: "Taper sur le visiteur événementiel → compléter le dialogue → vérifier SecureStore"
    expected: "Dialogue s'ouvre avec le contenu de l'événement, les choix s'affichent, compléter donne XP+récompense et le visiteur disparaît sans réapparaître"
    why_human: "Flux interaction complet nécessite l'app en cours d'exécution"
---

# Phase 13: Événements Saisonniers — Rapport de Vérification

**Phase Goal:** Quand un événement saisonnier est actif (Pâques, Halloween, Noël...), un personnage visiteur thématique apparaît dans la scène ferme/arbre — même pattern que les sagas immersives (tap → dialogue → choix → récompenses loot saisonnières) mais déclenché par le calendrier au lieu du cycle saga

**Verified:** 2026-04-03T19:10:00Z
**Status:** PASSED
**Re-verification:** No — vérification initiale

---

## Goal Achievement

### Observable Truths (Success Criteria ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Quand un événement calendrier est actif, un visiteur pixel thématique apparaît dans la scène arbre avec animation d'arrivée | ✓ VERIFIED | `activeEventId` calculé via `getVisibleEventId()`, rendu VisitorSlot couche 3.7 conditionné `{activeEventId && activeEventContent && isOwnTree}` avec `targetFX={0.28}` (tree.tsx:1553) |
| 2 | Taper sur le visiteur ouvre un dialogue narratif thématique avec choix (même UX que les sagas) | ✓ VERIFIED | `onTap={() => setShowEventDialogue(true)}` (tree.tsx:1566), SagaWorldEvent rendu avec `overrideSaga={saga}` à la couche 5.1 (tree.tsx:1639-1652) |
| 3 | Compléter l'interaction donne des récompenses loot box saisonnières garanties (pas 20% chance) | ✓ VERIFIED | `drawGuaranteedSeasonalReward()` avec fallback cascade épique→rare→commun + fallback absolu (engine.ts:64-111), appelé dans `handleEventComplete` (tree.tsx:1095) |
| 4 | Chaque événement est indépendant — ajouter un événement = ajouter un contenu sans modifier le moteur | ✓ VERIFIED | `SEASONAL_EVENT_DIALOGUES: Record<string, SeasonalEventContent>` dans content.ts — le moteur ne connaît pas les eventIds individuels, tout passe par `getActiveEvent()` + la map |
| 5 | `npx tsc --noEmit` passe sans nouvelles erreurs | ✓ VERIFIED | Résultat: 0 erreurs TypeScript |

**Score:** 5/5 success criteria vérifiés

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/mascot/seasonal-events-types.ts` | SeasonalEventProgress, SeasonalEventContent types | ✓ VERIFIED | 32 lignes, deux interfaces exportées avec SagaChapter import — substantiel et correct |
| `lib/mascot/seasonal-events-engine.ts` | shouldShowEventVisitor, getVisibleEventId, drawGuaranteedSeasonalReward, buildSeasonalEventAsSaga | ✓ VERIFIED | 140 lignes, 4 fonctions + 2 constantes exportées, fallback cascade implémenté |
| `lib/mascot/seasonal-events-storage.ts` | loadEventProgressList, saveEventProgress | ✓ VERIFIED | 45 lignes, SecureStoreCompat utilisé, clé composite eventId+year dans le filtre |
| `lib/mascot/seasonal-events-content.ts` | SEASONAL_EVENT_DIALOGUES (8 événements), getEventContent | ✓ VERIFIED | 315 lignes, exactement 8 entrées (nouvel-an, st-valentin, poisson-avril, paques, ete, rentree, halloween, noel) |
| `locales/fr/gamification.json` | mascot.event avec 8 sous-clés FR | ✓ VERIFIED | 8 sous-clés présentes, chacune avec title/visitor_name/narrative/choiceA/choiceB/cliffhanger |
| `locales/en/gamification.json` | mascot.event avec 8 sous-clés EN | ✓ VERIFIED | 8 sous-clés présentes, symétrie FR/EN confirmée |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/mascot/VisitorSlot.tsx` | Props targetFX/targetFY pour position personnalisée | ✓ VERIFIED | Lignes 55-58: `targetFX?: number` et `targetFY?: number`, déstructuré lignes 168-169, utilisé via `propTargetFX ?? TARGET_FX` lignes 187-188 |
| `components/mascot/SagaWorldEvent.tsx` | Prop overrideSaga?: Saga pour bypasser getSagaById | ✓ VERIFIED | Ligne 65: prop documentée, ligne 102: déstructurée, ligne 109: `const activeSaga = overrideSaga ?? getSagaById(...)` |
| `app/(tabs)/tree.tsx` | Couche visiteur événementiel + dialogue + complétion récompense | ✓ VERIFIED | Imports lignes 101-104, état lignes 288-292, useEffect lignes 305-313, calcul dérivé lignes 322-325, handleEventComplete lignes 1084-1129, couche 3.7 lignes 1552-1576, couche 5.1 lignes 1638-1652 |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `seasonal-events-engine.ts` | `lib/gamification/seasonal.ts` | `import getActiveEvent` | ✓ WIRED | Ligne 6: `import { getActiveEvent } from '../gamification/seasonal'` — utilisé dans shouldShowEventVisitor et getVisibleEventId |
| `seasonal-events-engine.ts` | `lib/mascot/sagas-types.ts` | `import Saga, SagaProgress, createEmptySagaProgress` | ✓ WIRED | Lignes 7-8: imports présents — `buildSeasonalEventAsSaga` retourne `{ saga: Saga; progress: SagaProgress }` avec `createEmptySagaProgress` |
| `seasonal-events-storage.ts` | `expo-secure-store` | `SecureStoreCompat` | ✓ WIRED | Ligne 5: `import { SecureStoreCompat as SecureStore } from './utils'` — `getItemAsync`/`setItemAsync` appelés dans les deux fonctions |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tree.tsx` | `seasonal-events-engine.ts` | `import getVisibleEventId, buildSeasonalEventAsSaga, drawGuaranteedSeasonalReward, SEASONAL_EVENT_BONUS_XP` | ✓ WIRED | Ligne 102 — toutes les 4 fonctions/constantes importées et utilisées dans le corps du composant |
| `tree.tsx` | `seasonal-events-storage.ts` | `import loadEventProgressList, saveEventProgress` | ✓ WIRED | Ligne 103 — `loadEventProgressList` dans useEffect (ligne 307), `saveEventProgress` dans handleEventComplete (ligne 1120) |
| `tree.tsx` | `VisitorSlot.tsx` | Second VisitorSlot avec `targetFX={0.28}` | ✓ WIRED | Ligne 1563 — `targetFX={0.28} targetFY={0.62}`, couche 3.7 correctement positionnée |
| `tree.tsx` | `SagaWorldEvent.tsx` | SagaWorldEvent avec `overrideSaga` prop | ✓ WIRED | Ligne 1645 — `overrideSaga={saga}` passé avec la saga construite par `buildSeasonalEventAsSaga` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produit des données réelles | Status |
|----------|--------------|--------|----------------------------|--------|
| `tree.tsx` couche 3.7 | `activeEventId` | `getVisibleEventId(eventProgressList, ...)` → `getActiveEvent()` dans seasonal.ts | Oui — `getActiveEvent` compare la date avec les périodes des 8 événements dans `SEASONAL_EVENTS` | ✓ FLOWING |
| `tree.tsx` couche 5.1 | `activeEventContent` | `getEventContent(activeEventId)` → `SEASONAL_EVENT_DIALOGUES[eventId]` | Oui — 8 entrées réelles avec chapitres et choix (content.ts:15-306) | ✓ FLOWING |
| `handleEventComplete` | `reward` | `drawGuaranteedSeasonalReward(activeEvent, choiceIndex)` → pools `event.rewards[rarity]` | Oui — fallback cascade garantit une récompense non-null, avec fallback absolu hardcodé en dernier recours | ✓ FLOWING |
| `seasonal-events-storage.ts` | `eventProgressList` | `SecureStore.getItemAsync(eventKey(profileId))` | Oui — lit depuis SecureStore par clé profil, retourne `[]` si absent | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SEASONAL_EVENT_DIALOGUES contient 8 entrées | `Object.keys(SEASONAL_EVENT_DIALOGUES).length === 8` | 8 clés confirmées via analyse statique du fichier | ✓ PASS |
| drawGuaranteedSeasonalReward ne retourne jamais null | Fallback absolu en lignes 102-110 de engine.ts | Retour hardcodé `{ emoji: '🎁', reward: 'Récompense saisonnière', bonusPoints: 5, rewardType: 'points' }` garantit la non-nullité | ✓ PASS |
| saveEventProgress filtre par eventId ET year | Ligne 36: `!(p.eventId === progress.eventId && p.year === progress.year)` | Clé composite vérifiée dans le filtre | ✓ PASS |
| buildSeasonalEventAsSaga retourne chapters de longueur 1 | `chapters: [content.chapter]` ligne 128 | Un seul élément dans le tableau | ✓ PASS |
| TSC compile sans erreurs | `npx tsc --noEmit` | 0 erreurs | ✓ PASS |
| i18n FR/EN symétriques | Analyse JSON des deux fichiers | 8 clés identiques dans les deux locales, st-valentin a 2 choix (A/B) dans les deux | ✓ PASS |
| pointerEvents mutuellement exclusifs | tree.tsx:1529 saga bloc: `pointerEvents={showEventDialogue ? 'none' : 'box-none'}` / tree.tsx:1556 event bloc: `pointerEvents={showSagaEvent ? 'none' : 'box-none'}` | Exclusion mutuelle confirmée | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EVT-01 | 13-01-PLAN.md, 13-02-PLAN.md | "Evenements aleatoires sur la ferme (visiteur mystere, tempete, marche ambulant)" — dans REQUIREMENTS.md "Future Requirements" (EVT-01 est le seul ID documenté) | ✓ SATISFIED (partiellement) | Le moteur de détection calendaire + visiteur pixel + dialogue + récompenses est implémenté. Note: l'implémentation couvre des événements saisonniers calendaires fixes, pas "aléatoires" comme décrit dans REQUIREMENTS.md — le scope a évolué entre la rédaction du req et le ROADMAP.md |
| EVT-02 | 13-01-PLAN.md, 13-02-PLAN.md | Non défini dans REQUIREMENTS.md | ⚠ ORPHANED dans REQUIREMENTS.md | EVT-02 et EVT-03 apparaissent dans ROADMAP.md Phase 13 `Requirements: EVT-01, EVT-02, EVT-03` mais sont absents de REQUIREMENTS.md. Ces IDs ont été définis dans le ROADMAP sans être rétropropagés dans REQUIREMENTS.md |
| EVT-03 | 13-01-PLAN.md, 13-02-PLAN.md | Non défini dans REQUIREMENTS.md | ⚠ ORPHANED dans REQUIREMENTS.md | Même note que EVT-02 |

**Note sur la traçabilité:** EVT-02 et EVT-03 sont référencés dans ROADMAP.md Phase 13 mais n'existent pas dans REQUIREMENTS.md. Le ROADMAP.md définit clairement les 3 critères de succès correspondants (visiteur visible, dialogue interactif, récompenses garanties) — ces critères sont implémentés. Il s'agit d'un manque de synchronisation documentaire, pas d'un manque d'implémentation.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `app/(tabs)/tree.tsx:1648` | `require('../../assets/garden/animals/voyageur/idle_1.png')` comme frame par défaut pour le visiteur événementiel | ℹ Info | Sprite du voyageur utilisé à la place d'un sprite dédié — intentionnel (décision D-05 du CONTEXT.md : sprites PixelLab à créer dans une future phase). Ne bloque pas le fonctionnement. |

Aucun stub bloquant, aucun `TODO`/`FIXME` dans les fichiers phase 13, aucun `return null` ou `return []` sans source de données réelle.

---

## Human Verification Required

### 1. Vérification Visuelle du Visiteur Événementiel

**Test:** Modifier temporairement `getActiveEvent()` dans `lib/gamification/seasonal.ts` pour retourner un événement fixe (ex: 'paques'), lancer l'app sur device (`npx expo run:ios --device`), naviguer vers l'onglet Arbre.

**Expected:** Un personnage pixel apparaît côté gauche du diorama (environ 28% de la largeur), avec une animation d'arrivée depuis hors-écran. Le visiteur saga existant (si présent) reste côté droit sans conflit visuel.

**Why human:** Le positionnement pixel, l'animation Reanimated, et la coexistence visuelle des deux visiteurs ne peuvent pas être vérifiés statiquement.

### 2. Flux Complet Tap → Dialogue → Récompense → Disparition

**Test:** Avec l'événement actif (setup ci-dessus), taper sur le visiteur événementiel, compléter les choix du dialogue, vérifier que le toast de récompense s'affiche et que le visiteur quitte la scène. Relancer l'app — le visiteur ne doit plus apparaître.

**Expected:** Dialogue s'ouvre avec le contenu thématique de l'événement, les choix sont affichés avec leurs emojis, compléter donne XP (points choix + 15 bonus) + récompense saisonnière avec toast. Après rechargement, le visiteur n'est plus visible (SecureStore a persisté la complétion).

**Why human:** Persistance SecureStore, cycle de vie de l'animation de départ, et affichage du toast nécessitent l'app en cours d'exécution.

---

## Gaps Summary

Aucun gap bloquant. Les 9 must-haves des deux plans sont vérifiés. Les 5 critères de succès du ROADMAP.md sont implémentés.

Un seul point documentaire à noter sans impact sur la qualité : EVT-02 et EVT-03 sont listés dans les plans comme requirements réalisés, mais ces IDs n'existent pas dans REQUIREMENTS.md (seulement EVT-01 y figure, dans la section "Future Requirements"). Le ROADMAP.md Phase 13 définit les critères correspondants et ils sont tous satisfaits.

---

_Verified: 2026-04-03T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
