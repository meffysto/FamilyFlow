---
phase: 27-cran-village-composants
plan: 01
subsystem: mascot/village
tags: [tilemap, village, farm-map, navigation, FAB]
requirements: [MAP-01]

dependency_graph:
  requires: []
  provides: [buildVillageMap(), TileMapRenderer.mode, FAB village]
  affects: [lib/mascot/farm-map.ts, components/mascot/TileMapRenderer.tsx, app/(tabs)/tree.tsx]

tech_stack:
  added: []
  patterns: [Wang tilemap cobblestone, conditional useMemo mode, absolute FAB overlay]

key_files:
  created: []
  modified:
    - lib/mascot/farm-map.ts
    - components/mascot/TileMapRenderer.tsx
    - app/(tabs)/tree.tsx

decisions:
  - "FAB route castée 'as any' — l'écran /(tabs)/village n'existe pas encore (Plan 02), expo-router exige des routes connues au compile-time"
  - "FAB placé dans treeBg View (pas dans ScrollView) — position absolute pour superposition sur la carte sans conflit de geste"
  - "if (mode === 'village') return [] dans decos useMemo — guard strict contre les décos ferme sur la carte village (arbres fruitiers, koi, etc.)"

metrics:
  duration: "4min"
  completed: "2026-04-10"
  tasks: 2
  files: 3
---

# Phase 27 Plan 01: Moteur tilemap village + FAB navigation Summary

**One-liner:** Carte cobblestone village via buildVillageMap() dans farm-map.ts, prop mode='village' sur TileMapRenderer, FAB 🏘️ sur l'écran ferme naviguant vers /(tabs)/village.

## What Was Built

Fondation du moteur tilemap pour la Place du Village et navigation depuis la ferme :

1. **buildVillageMap()** (lib/mascot/farm-map.ts) — Génère une carte avec terrain cobblestone dominant (~60% surface, fillRect 2,4→10,16), fontaine eau centrale (cols 5-7, rows 8-10), et chemins dirt d'entrée haut/bas. Réutilise les helpers existants emptyVertices et fillRect.

2. **prop mode sur TileMapRenderer** (components/mascot/TileMapRenderer.tsx) — Ajoute `mode?: 'farm' | 'village'` dans TileMapRendererProps avec valeur par défaut 'farm'. Le useMemo farmMap conditionne sur le mode. Le useMemo decos retourne [] en mode village (guard contre les décos ferme).

3. **FAB village** (app/(tabs)/tree.tsx) — TouchableOpacity 56×56 position absolute bottom-right (bottom:24, right:16) de la zone diorama. Background colors.catJeux, emoji 🏘️, Haptics.selectionAsync() au tap, navigation vers /(tabs)/village.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e337958 | feat(27-01): buildVillageMap() et prop mode sur TileMapRenderer |
| 2 | f3461db | feat(27-01): FAB village sur l'ecran ferme tree.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cast 'as any' pour route non encore existante**
- **Found during:** Task 2
- **Issue:** expo-router génère des types stricts pour les routes connues. `/(tabs)/village` n'existe pas encore (sera créé en Plan 02), donc TypeScript rejetait `router.push('/(tabs)/village')` avec TS2345.
- **Fix:** Ajout de `as any` sur la chaîne de route avec commentaire eslint-disable. La navigation fonctionnera à l'exécution dès que le fichier app/(tabs)/village.tsx existera.
- **Files modified:** app/(tabs)/tree.tsx
- **Commit:** f3461db

## Verification

- `npx tsc --noEmit` passe sans nouvelles erreurs
- `buildVillageMap` exportée depuis lib/mascot/farm-map.ts
- TileMapRenderer accepte mode='village' et utilise buildVillageMap() dans ce mode
- Les décorations ferme ne sont PAS rendues en mode village (guard `if (mode === 'village') return []`)
- tree.tsx contient un FAB qui navigue vers `/(tabs)/village`

## Known Stubs

Aucun stub. Le FAB est fonctionnel (naviguera quand l'écran village sera créé en Plan 02).

## Self-Check: PASSED

- `lib/mascot/farm-map.ts` — modifié et commité (e337958) ✓
- `components/mascot/TileMapRenderer.tsx` — modifié et commité (e337958) ✓
- `app/(tabs)/tree.tsx` — modifié et commité (f3461db) ✓
- Commits e337958, f3461db existent dans git log ✓
