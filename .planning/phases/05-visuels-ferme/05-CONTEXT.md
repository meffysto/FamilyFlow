# Phase 5: Visuels Ferme - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Rendre la ferme visuellement vivante : cycle jour/nuit cohérent avec l'heure réelle, animations de cultures (2 frames par stade), et animations d'animaux (idle + marche autonome). Pas de nouvelle mécanique de gameplay — uniquement des améliorations visuelles sur le diorama ferme existant.

</domain>

<decisions>
## Implementation Decisions

### Cycle jour/nuit (VIS-01)
- **D-01:** Étendre `ambiance.ts` existant — réutiliser `getTimeSlot()` + ajouter un overlay teinté semi-transparent sur le diorama ferme (comme le `colorOverlay` déjà défini)
- **D-02:** Transition progressive entre les slots horaires — fondu animé (`withTiming` ~2s) quand le slot change, pas de changement brusque
- **D-03:** Pas de particules ambiantes sur la ferme — l'overlay couleur seul suffit (particules restent exclusives au diorama arbre)
- **D-04:** Intensité nuit légère (~10-15% opacité overlay bleu/violet) — tout reste visible, adapté aux enfants

### Animation des cultures (VIS-02)
- **D-05:** Technique swap PNG — alterner entre 2 frames (stage_X_a.png / stage_X_b.png) avec un timer (~800ms). Pas de spritesheet.
- **D-06:** 2 frames par stade de croissance (minimum requis par VIS-02) — 10 cultures x 5 stades x 2 frames = 100 PNGs total
- **D-07:** Mouvement balancement doux — frame A = position neutre, frame B = légèrement penchée/agrandie. Effet brise légère.
- **D-08:** Cultures dorées (mutation 3%) gardent la même animation que les normales — le liseré doré existant suffit à les distinguer

### Animation des animaux (VIS-03)
- **D-09:** Idle sur place + marche aléatoire — l'animal reste en idle, puis se déplace vers un point voisin toutes les 5-10 secondes (Stardew Valley style)
- **D-10:** Zone de déplacement = espace libre du diorama non-occupé par les parcelles de culture. Pas de collision complexe, juste éviter les plots.
- **D-11:** 2 frames idle + 8 frames marche par animal (garder la structure existante idle_1/2 + walk_1..8 mais avec de vrais sprites)
- **D-12:** 5 animaux existants : poussin, poulet, canard, cochon, vache

### Sourcing des assets
- **D-13:** Assets Mana Seed (itch.io) exclusivement — style pixel 32x32 uniforme. Pas de mix avec d'autres styles.
- **D-14:** Les assets Mana Seed sont déjà disponibles localement (achetés précédemment) — la première tâche est de les localiser et auditer avant tout code
- **D-15:** Remplacer tous les placeholders actuels (~300 bytes) par les vrais sprites Mana Seed

### Claude's Discretion
- Vitesse exacte d'animation des cultures (intervalle entre frames)
- Algorithme de pathfinding simple pour le déplacement animal
- Organisation exacte des fichiers dans `assets/garden/`
- Gestion de `useReducedMotion` pour les nouvelles animations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Système d'ambiance existant
- `lib/mascot/ambiance.ts` — Définit TimeSlot, getTimeSlot(), AMBIENT_CONFIGS (source de vérité pour les slots horaires)
- `components/mascot/AmbientParticles.tsx` — Implémentation particules ambiantes arbre (pattern à ne PAS reproduire sur la ferme, ref D-03)

### Ferme existante
- `lib/mascot/farm-engine.ts` — Logique planter/pousser/récolter, GOLDEN_CROP_CHANCE, parseCrops()
- `lib/mascot/crop-sprites.ts` — Mapping require() des sprites cultures actuels (à étendre pour 2 frames)
- `lib/mascot/farm-grid.ts` — Grille de placement des parcelles (FARM_GRID, PLOT_SIZE)
- `lib/mascot/types.ts` — PlantedCrop, CropDefinition, CROP_CATALOG, INHABITANTS, ITEM_ILLUSTRATIONS
- `components/mascot/FarmPlots.tsx` — Composant parcelles avec animation pulse mature (à étendre pour frame swap)

### Diorama principal
- `components/mascot/TreeView.tsx` — Diorama arbre principal (82KB, point d'intégration overlay ferme)
- `components/mascot/WorldGridView.tsx` — Vue monde/grille

### Design tokens
- `constants/colors.ts` — LightColors & DarkColors (pas de hardcoded)
- `constants/spacing.ts` — Spacing tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ambiance.ts` getTimeSlot() + AMBIENT_CONFIGS: réutiliser directement pour déterminer le slot horaire sur la ferme
- `AmbientParticles.tsx` pattern useReducedMotion: copier le pattern pour les nouvelles animations
- `FarmPlots.tsx` FarmPlot component: base pour intégrer le frame swap des cultures
- `CROP_SPRITES` mapping: structure à étendre (ajouter frame B pour chaque stade)
- `ITEM_ILLUSTRATIONS` record: animaux déjà référencés avec idle_1.png

### Established Patterns
- Animations via react-native-reanimated (useSharedValue + withRepeat + withTiming/withSequence)
- Assets sprites via require() dans des constantes (CROP_SPRITES, ITEM_ILLUSTRATIONS)
- Overlay couleur via View absoluteFill avec backgroundColor + opacity
- useReducedMotion pour accessibilité

### Integration Points
- `FarmPlots.tsx` — Point d'entrée pour l'animation des cultures (modifier FarmPlot pour alterner frames)
- `TreeView.tsx` ou écran `tree.tsx` — Point d'entrée pour l'overlay jour/nuit sur le diorama
- `lib/mascot/types.ts` — Ajouter les références des nouvelles frames dans ITEM_ILLUSTRATIONS
- `crop-sprites.ts` — Restructurer pour supporter 2 frames par stade

</code_context>

<specifics>
## Specific Ideas

- Les assets Mana Seed sont déjà achetés et disponibles localement — les localiser en premier
- Le style doit être 100% Mana Seed pixel 32x32 — pas de mélange avec les anciennes illustrations aquarelle pour les items ferme
- L'utilisateur veut auditer les assets disponibles AVANT de commencer le code — c'est la priorité 1 du plan

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-visuels-ferme*
*Context gathered: 2026-03-28*
