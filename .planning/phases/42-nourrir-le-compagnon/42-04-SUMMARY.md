---
phase: 42-nourrir-le-compagnon
plan: 04
subsystem: gamification-companion-xp
tags: [gamification, xp, companion, feedBuff, stacking, refactor, jest, tdd]
requirements: [FEED-08]
dependency-graph:
  requires:
    - "Plan 42-01 (types feedBuff + helpers purs)"
    - "Plan 42-03 (getActiveFeedBuff disponible)"
  provides:
    - "getCompanionXpBonus étendu : empile feedBuff multiplicativement sur 1.05 (D-07)"
    - "useGamification.completeTask : site d'appel clarifié (> 1.0) + commenté Phase 42"
  affects:
    - "lib/mascot/companion-engine.ts — getCompanionXpBonus signature +nowMs optional, corps multiplié par activeBuff.multiplier"
    - "hooks/useGamification.ts — 2 conditions `!== 1.0` → `> 1.0` + commentaire bloc Phase 42"
    - "lib/__tests__/companion-feed.test.ts — +6 tests (total 26)"
tech-stack:
  added: []
  patterns:
    - "TDD RED → GREEN (2 tests stacking failent puis passent)"
    - "Délégation getActiveFeedBuff (évite duplication logique expiration)"
    - "Arrondi toFixed(4) pour stabilité numérique"
    - "Condition > 1.0 exprime intention multiplicative (plus safe que !== 1.0)"
key-files:
  created: []
  modified:
    - "lib/mascot/companion-engine.ts"
    - "hooks/useGamification.ts"
    - "lib/__tests__/companion-feed.test.ts"
decisions:
  - "getCompanionXpBonus délègue à getActiveFeedBuff plutôt que de dupliquer la logique d'expiration"
  - "Param nowMs optionnel (défaut Date.now) pour testabilité déterministe — cohérent Plan 42-03"
  - "toFixed(4) : évite les float drifts sur 1.05 × 1.15 × 1.3 (eval JS = 1.5697499999...)"
  - "Refactor `> 1.0` préféré à `!== 1.0` : plus lisible, safe si companionBonus devenait < 1.0 un jour"
  - "Aucun second site d'appel à patcher — grep hooks/ + lib/ confirme site unique (completeTask)"
metrics:
  duration: "6min"
  completed: "2026-04-22"
  tests: "26/26 companion-feed, 47/47 companion-engine (non-régression)"
  files_touched: 3
  commits: 3
---

# Phase 42 Plan 04 : Empilage feedBuff dans calcul XP compagnon Summary

Extension de `getCompanionXpBonus()` pour empiler le `feedBuff` actif sur le bonus compagnon de base (1.05) selon D-07 (empilage multiplicatif). Site d'appel dans `useGamification.completeTask` clarifié (`> 1.0` au lieu de `!== 1.0`) et commenté Phase 42. Couverture Jest TDD de 6 tests supplémentaires (stacking, expiration lazy, null).

## Objectif livré

D-07 opérationnel : XP tâche = base × 1.05 × feedBuff.multiplier si compagnon avec buff actif. D-08 respecté : le feedBuff affecte uniquement les XP (le site d'appel unique dans `completeTask` utilise `getCompanionXpBonus`, inexistant sur feuilles/harvest/ferme).

## Audit sites d'appel `getCompanionXpBonus`

| Fichier | Ligne | Usage | Statut |
|---|---|---|---|
| `hooks/useGamification.ts` | 126 | `completeTask` — XP tâches | ✅ Refactoré (Phase 42) |
| `lib/mascot/companion-engine.ts` | 110 | Déclaration | ✅ Étendue (Phase 42) |
| `lib/__tests__/companion-engine.test.ts` | 162-170 | Tests legacy (1.05/1.0) | ✅ Non régressé (47/47) |
| `packages/core/src/mascot/companion-engine.ts` | 103 | Copie packages (unused) | — Hors scope (non utilisé par l'app) |

**Site d'appel runtime unique** : `hooks/useGamification.ts:126` (completeTask). Aucun autre consommateur actif. Les routines/défis passent par le même `completeTask` via le flow gamification — donc le buff s'applique automatiquement (D-08).

## Before / After

### `getCompanionXpBonus` (lib/mascot/companion-engine.ts)

**Before** (L110-113) :
```typescript
export function getCompanionXpBonus(companion: CompanionData | null | undefined): number {
  if (!companion) return 1.0;
  return COMPANION_XP_BONUS;
}
```

**After** :
```typescript
export function getCompanionXpBonus(
  companion: CompanionData | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!companion) return 1.0;
  const base = COMPANION_XP_BONUS;
  const activeBuff = getActiveFeedBuff(companion, nowMs);
  if (!activeBuff) return base;
  return +(base * activeBuff.multiplier).toFixed(4);
}
```

### `useGamification.completeTask` (L120-143)

**Before** :
```typescript
// Bonus compagnon +5% XP (per D-09)
const companionBonus = getCompanionXpBonus(profileWithStreak.companion);
let profileWithCompanionBonus: Profile = companionBonus !== 1.0
  ? { ...profileWithStreak, points: Math.round(profileWithStreak.points) }
  : profileWithStreak;
// ...
const bonusPoints = companionBonus !== 1.0 ? Math.round(basePointsGained * companionBonus) - basePointsGained : 0;
```

**After** :
```typescript
// Phase 42 — getCompanionXpBonus intègre le feedBuff actif (empilage multiplicatif D-07).
//   - pas de compagnon : 1.0
//   - compagnon sans buff : COMPANION_XP_BONUS = 1.05
//   - compagnon + buff actif : 1.05 × feedBuff.multiplier (ex: 1.2075 ou 1.56975)
// Condition `> 1.0` : intention explicite (bonus multiplicatif uniquement).
const companionBonus = getCompanionXpBonus(profileWithStreak.companion);
let profileWithCompanionBonus: Profile = companionBonus > 1.0
  ? { ...profileWithStreak, points: Math.round(profileWithStreak.points) }
  : profileWithStreak;
// ...
// Phase 42 — appliquer le bonus compagnon (base 1.05 ± feedBuff) sur le delta de points gagnés.
const bonusPoints = companionBonus > 1.0 ? Math.round(basePointsGained * companionBonus) - basePointsGained : 0;
```

## Tests (RED → GREEN)

### Phase RED (commit eb4784b)

Ajout de 6 tests dans `describe('Phase 42 — getCompanionXpBonus stacking')` :

| # | Test | Attendu |
|---|------|---------|
| 1 | null → 1.0 | ✅ pass (legacy) |
| 2 | undefined → 1.0 | ✅ pass (legacy) |
| 3 | pas de feedBuff → 1.05 | ✅ pass (legacy) |
| 4 | feedBuff actif mul 1.15 → 1.05 × 1.15 | ❌ fail RED |
| 5 | feedBuff expiré → 1.05 (lazy) | ✅ pass (pas encore consommé) |
| 6 | stacking max (1.15 × 1.3) → 1.05 × 1.495 | ❌ fail RED |

**2 fails attendus** en RED (la signature mono-param ignorait feedBuff).

### Phase GREEN (commit fb23865)

Après extension `getCompanionXpBonus` :

```
Test Suites: 1 passed, 1 total
Tests:       26 passed, 26 total
Time:        1.986 s
```

## Résultats Jest (full suite post-refactor)

```
Test Suites: 1 failed, 68 passed, 69 total
Tests:       1 failed, 1819 passed, 1820 total
```

**1 failure pré-existante** dans `codex-content.test.ts` (parité i18n FR/EN codex tech_culture-5) — **hors scope Plan 42-04**, aucun lien avec compagnon/XP/gamification.

Tests companion-engine non régressés : **47/47 pass** (includes legacy `getCompanionXpBonus` tests validant 1.0/1.05).

## TypeScript

```
npx tsc --noEmit → TypeScript compilation completed
```

Aucune nouvelle erreur. Signature `getCompanionXpBonus(companion, nowMs?)` rétrocompatible (param optionnel).

## Deviations from Plan

None — plan exécuté exactement comme écrit. Les 2 commits Task 1 (RED + GREEN) respectent le pattern TDD spécifié dans la directive `tdd="true"` ; Task 2 en un commit refactor unique.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | eb4784b | test(42-04): ajouter tests stacking feedBuff dans getCompanionXpBonus (RED) |
| 2 | fb23865 | feat(42-04): empilage feedBuff dans getCompanionXpBonus (GREEN) |
| 3 | 6fa0b29 | refactor(42-04): useGamification — condition companionBonus > 1.0 + commentaire Phase 42 |

## Verification

- `grep -q "nowMs: number = Date.now" lib/mascot/companion-engine.ts` — OK
- `grep -q "getActiveFeedBuff(companion, nowMs)" lib/mascot/companion-engine.ts` — OK
- `grep -c "it(" lib/__tests__/companion-feed.test.ts` → 26 (≥17 requis)
- `grep -q "Phase 42" hooks/useGamification.ts` — OK
- `grep -c "companionBonus > 1.0" hooks/useGamification.ts` → 2
- `! grep -q "companionBonus !== 1.0" hooks/useGamification.ts` — OK (ancien pattern éliminé)
- `npx jest lib/__tests__/companion-feed.test.ts --no-coverage` → 26/26 passed
- `npx tsc --noEmit` → aucune nouvelle erreur

## Self-Check: PASSED

- FOUND: lib/mascot/companion-engine.ts (getCompanionXpBonus étendu avec nowMs + activeBuff multiplication)
- FOUND: hooks/useGamification.ts (2x `companionBonus > 1.0` + commentaire Phase 42)
- FOUND: lib/__tests__/companion-feed.test.ts (26 tests, 6 nouveaux stacking)
- FOUND: commit eb4784b (RED)
- FOUND: commit fb23865 (GREEN)
- FOUND: commit 6fa0b29 (refactor useGamification)
