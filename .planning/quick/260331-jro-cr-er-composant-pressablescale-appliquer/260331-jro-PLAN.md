# Quick Task 260331-jro: Créer composant PressableScale + appliquer sur DashboardCard

**Mode:** quick
**Created:** 2026-03-31

## Plan 1: PressableScale + intégration DashboardCard

### Task 1: Créer le composant PressableScale

**files:** `components/ui/PressableScale.tsx`, `components/ui/index.ts`
**action:** Créer un composant wrapper qui applique une animation scale on press avec Reanimated. Props: children, onPress?, style?, scaleValue? (default 0.97), disabled?. Utilise useSharedValue + useAnimatedStyle + withSpring (damping: 15, stiffness: 150). Ajouter haptic feedback léger (selectionAsync) au onPressIn. Exporter depuis le barrel index.ts.
**verify:** Le fichier existe, compile sans erreur, est exporté depuis components/ui/index.ts
**done:** Le composant PressableScale est créé et exporté

### Task 2: Intégrer PressableScale dans DashboardCard

**files:** `components/DashboardCard.tsx`
**action:** Wrapper le contenu rendu par DashboardCard (le View/GlassView final) dans un PressableScale quand onPressMore est fourni. Le scale s'applique sur toute la carte. Respecter useReducedMotion (pas d'animation si activé). Ne pas casser le comportement collapsible existant.
**verify:** DashboardCard utilise PressableScale, compile sans erreur (npx tsc --noEmit)
**done:** Les cartes du dashboard ont l'effet scale on press
