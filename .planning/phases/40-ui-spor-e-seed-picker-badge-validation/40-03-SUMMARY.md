---
phase: 40-ui-spor-e-seed-picker-badge-validation
plan: 03
subsystem: ui-overlay-plants-scelles
tags: [sporee, wager, badge, ring, overlay, react-memo, reanimated-aware]
requires:
  - lib/mascot/wager-ui-helpers (Plan 40-01)
  - lib/mascot/sporee-economy.getLocalDateKey (Phase 38)
  - WagerModifier B1/B2 shape (Plan 40-01)
provides:
  - components/mascot/PlantWagerBadge.tsx (badge 2-lignes pure, React.memo, zéro animation)
  - components/mascot/WagerReadyRing.tsx (anneau vert double-gate, breathing reduceMotion-aware)
  - CropCell étendu dans WorldGridView.tsx (injection conditionnelle, paceLevel/tasksTargetToday dérivés)
affects:
  - components/mascot/WorldGridView.tsx (imports + dérivation wager dans CropCell + 2 overlays + 1 style)
tech-stack:
  added: []
  patterns:
    - "Pure component + React.memo pour overlay rendered N fois en parallèle (zéro shared clock)"
    - "useReducedMotion() gate → View statique vs Animated.View (fallback accessibilité)"
    - "Consommation directe valeurs persistées (wager.totalDays, wager.tasksCompletedToday) — zéro recalcul UI"
key-files:
  created:
    - components/mascot/PlantWagerBadge.tsx
    - components/mascot/WagerReadyRing.tsx
  modified:
    - components/mascot/WorldGridView.tsx
decisions:
  - "Badge 2 lignes strict — CONTEXT.md D-03 verrouillé, jamais dégradé à 1 ligne"
  - "Palette pace via tokens existants (successBg/warningBg/errorBg + successText/warningText/errorText) — aucun nouveau token inventé"
  - "Anneau vert rendu comme wrapper centré autour du sprite (alignItems/justifyContent center) au lieu de top:0/left:0 — évite décalage si sprite pas en haut-gauche du cell"
  - "useReducedMotion() de react-native-reanimated retenu vs AccessibilityInfo (cohérent avec reste du fichier WorldGridView)"
  - "Fallback P2 cumulTarget=0 → line1='—/—' line2='✓' plutôt que '0/0' bancal"
  - "wagerRingWrapper en zIndex 11, badge en zIndex 12 (style), overlays ordonnés au-dessus du sprite sans conflit whispers (zIndex 15)"
  - "Size anneau = min(size - Spacing.xs, 44) — adapté aux cells small/medium/large sans dépasser visuellement"
metrics:
  duration_min: ~28
  completed_date: 2026-04-18
  task_count: 3
  file_count: 3
---

# Phase 40 Plan 03 : Badge Sporée 2-lignes + anneau prêt à valider Summary

Livraison des 2 composants d'overlay visuel sur plants scellés : `PlantWagerBadge` (badge 2 lignes `X/Y tâches aujourd'hui` + `cumul Z/N`, pure React.memo zéro animation) et `WagerReadyRing` (anneau vert statique ou breathing très subtil reduceMotion-aware, double gate mûr + cumul atteint). Injection ciblée dans `CropCell` de `WorldGridView.tsx` avec consommation directe de `wager.totalDays` et `wager.tasksCompletedToday` persistés Plan 01 — zéro magic number, zéro fallback `/7`.

## Confirmations must-haves

### Badge 2 lignes strict (SPOR-02 / D-03)

PlantWagerBadge.tsx rend **OBLIGATOIREMENT 2 Text** :
- **Ligne 1** — `${tasksToday}/${tasksTargetToday}` en `FontSize.caption` + `FontWeight.semibold` + couleur pace-dépendante (successText/warningText/errorText).
- **Ligne 2** — `${cumulCurrent}/${cumulTarget}` en `FontSize.micro` + `colors.textMuted`.

Aucune branche ne dégrade à 1 ligne. Fallback P2 (`cumulTarget === 0`) affiche `—/—` (ligne 1) + `✓` (ligne 2) — 2 lignes conservées.

### Approche breathing finale

**Retenu : `useReducedMotion()` de `react-native-reanimated`** (cohérence avec `BuildingIdleAnim`, `BuildingCell`, `NextExpansionCell` dans le même fichier — tous consomment ce hook).

- Si `reducedMotion === true` → `<View>` statique, aucun `useSharedValue` branché.
- Sinon → `<Animated.View>` + `opacity` shared value 0.7 ↔ 1.0 sur 2000ms via `withRepeat(withTiming, -1, true)` + `Easing.inOut(Easing.sin)`.
- `BREATHING_CONFIG = { duration: 2000, minOpacity: 0.7, maxOpacity: 1.0 }` constante module (convention Phase 40).
- Cleanup `cancelAnimation` au unmount (guard).

### Tokens couleur pace exacts utilisés

| paceLevel | Background     | Texte ligne 1 | Bordure     |
| --------- | -------------- | ------------- | ----------- |
| green     | `successBg`    | `successText` | `success`   |
| yellow    | `warningBg`    | `warningText` | `warning`   |
| orange    | `errorBg`      | `errorText`   | `error`     |

Anneau vert : `colors.success` (border 2px, radius = size/2 par défaut).
**Zéro couleur hardcoded.** Tous tokens existants confirmés dans `constants/colors.ts` (Light + Dark).

### Consommation directe wager.totalDays + wager.tasksCompletedToday (B1/B2)

```tsx
// Zéro magic number 7, zéro fallback /7
const totalDays = wager.totalDays ?? 1; // rétro-compat paris pré-Phase 40 uniquement
const tasksToday = wager?.tasksCompletedToday ?? 0;
```

Les `?? 0` / `?? 1` sont documentés comme rétro-compatibilité avec paris créés AVANT Plan 40-01 (cas inexistant en pratique — Phase 40 est la 1ʳᵉ phase à exposer l'UI). `computePaceLevel` et `computeWagerTotalDays` importés depuis `lib/mascot/wager-ui-helpers`. `daysBetween` idem.

## Verification grep

| Check                                                                          | Result |
| ------------------------------------------------------------------------------ | ------ |
| `PlantWagerBadge` dans WorldGridView.tsx (import + usage)                      | 1 + 1  |
| `WagerReadyRing` dans WorldGridView.tsx (import + usage)                       | 1 + 1  |
| `useSharedValue` dans PlantWagerBadge.tsx                                      | 0      |
| `computePaceLevel` dans WorldGridView.tsx (useMemo)                            | 1      |
| `daysBetween` dans WorldGridView.tsx                                           | 2      |
| Magic `/ 7` ou `\* 7` dans bloc wager CropCell                                 | 0      |
| `wager.totalDays` dans WorldGridView.tsx                                       | ≥1     |
| `wager?.tasksCompletedToday` dans WorldGridView.tsx                            | 1      |
| Littéral `7` dans le bloc wager ajouté (lignes 170-202)                        | 0      |

## Commits

| Task | Commit    | Files                                              |
| ---- | --------- | -------------------------------------------------- |
| 1    | `4bc7082` | components/mascot/PlantWagerBadge.tsx              |
| 2    | `6656948` | components/mascot/WagerReadyRing.tsx               |
| 3    | `1188587` | components/mascot/WorldGridView.tsx                |

## Metrics

- **TypeScript :** `npx tsc --noEmit` clean (hors pré-existants MemoryEditor/cooklang/useVault ignorés).
- **Tests Jest :** non touchés (composants UI, pas de suite test dédiée Phase 40 Plan 03).
- **Zéro nouvelle dépendance npm** (ARCH-05 reconduit).
- **Zéro hardcoded couleur** dans les 3 fichiers livrés.
- **Zéro animation continue sur le badge** (React.memo pur, aucun `useSharedValue` dans PlantWagerBadge).

## Deviations from Plan

**1. [Rule 3 — Blocking] TS2322 sur `useSharedValue(1.0)` inference**

- **Found during:** Task 2, premier `npx tsc --noEmit`.
- **Issue:** `useSharedValue(BREATHING_CONFIG.maxOpacity)` inferait le type littéral `1` au lieu de `number`, provoquant TS2322 au `opacity.value = BREATHING_CONFIG.minOpacity` (0.7 non assignable à 1).
- **Fix:** Annotation explicite `useSharedValue<number>(...)`.
- **Files modified:** components/mascot/WagerReadyRing.tsx
- **Commit:** 6656948 (inclus dans le commit initial après fix rapide)

**2. [Adaptation plan/réalité] Anneau rendu via wrapper centré plutôt que top:0/left:0**

- **Found during:** Task 3, écriture JSX injection.
- **Issue:** Le plan proposait `<WagerReadyRing size={spriteSize} />` avec ring en position top:0/left:0 — or `spriteSize` n'est pas exposé par CropCell et le sprite `cropSprite` est centré verticalement par flex. Un ring top:0 serait décalé.
- **Fix:** Wrapper absolute `wagerRingWrapper` avec `alignItems: center / justifyContent: center` sur tout le cell, et size = `Math.min(size - Spacing.xs, 44)` pour rester dans les dimensions naturelles du sprite (36×44) sans dépasser.
- **Files modified:** components/mascot/WorldGridView.tsx
- **Commit:** 1188587

**3. [Adaptation] Palette pace étendue avec bordure colorée au lieu de simple `colors.border`**

- **Found during:** Task 1, implémentation palette.
- **Issue:** Plan proposait `borderColor: colors.border` neutre — mais un badge avec fond successBg et bordure border neutre fait visuellement "plat", le code couleur pace disparaît au scan rapide.
- **Fix:** Bordure = `colors.success` / `colors.warning` / `colors.error` (couleur pleine correspondant au paceLevel). Renforce le signal visuel sans casser la lisibilité (texte ligne 1 reste en successText/warningText/errorText = lisible contraste AA).
- **Files modified:** components/mascot/PlantWagerBadge.tsx
- **Commit:** 4bc7082

## Auth gates

Aucun — plan UI pur, zéro API externe, zéro login requis.

## Known Stubs

Aucun stub livré. Les 2 composants sont fonctionnels end-to-end : dès qu'un plant est scellé (Plan 02 à venir pour le seed picker, ou manipulation directe vault), le badge et l'anneau s'affichent automatiquement selon les gates.

**Point d'attention non-stub** : l'injection dans `CropCell` est déjà active — si un user crée un pari manuellement dans son vault (`modifiers: { wager: {...} }`), le badge s'affichera dès maintenant sans attendre Plan 02. Ce comportement est voulu (rétro-compat + découplage Plan 03 / Plan 02).

## Self-Check

Verification (files & commits exist) :
- FOUND: components/mascot/PlantWagerBadge.tsx
- FOUND: components/mascot/WagerReadyRing.tsx
- FOUND: Commit 4bc7082 (Task 1)
- FOUND: Commit 6656948 (Task 2)
- FOUND: Commit 1188587 (Task 3)
- FOUND: `PlantWagerBadge` import + usage in WorldGridView.tsx
- FOUND: `WagerReadyRing` import + usage in WorldGridView.tsx
- FOUND: `computePaceLevel` + `daysBetween` imports from wager-ui-helpers
- FOUND: `npx tsc --noEmit` clean
- FOUND: Zéro `useSharedValue` dans PlantWagerBadge.tsx
- FOUND: Zéro magic `7` dans bloc wager CropCell

## Self-Check: PASSED
