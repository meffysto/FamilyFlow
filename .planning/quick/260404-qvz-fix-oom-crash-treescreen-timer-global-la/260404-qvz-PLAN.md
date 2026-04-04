---
phase: quick-260404-qvz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/mascot/WorldGridView.tsx
  - components/mascot/TreeView.tsx
  - components/mascot/TileMapRenderer.tsx
  - components/mascot/AmbientParticles.tsx
  - components/mascot/SeasonalParticles.tsx
  - lib/mascot/ambiance.ts
autonomous: true
requirements: [OOM-FIX]
must_haves:
  truths:
    - "L'ecran arbre ne crash plus apres 4+ minutes de navigation"
    - "Les cultures affichent toujours l'animation frame swap 800ms"
    - "Les whispers apparaissent toujours periodiquement sur les crops"
    - "Les particules ambiantes et saisonnieres restent visibles (moins nombreuses)"
    - "Les arbres affichent le bon sprite pour la saison courante"
  artifacts:
    - path: "components/mascot/WorldGridView.tsx"
      provides: "Timer global unique pour frame swap + whisper consolide"
    - path: "components/mascot/TreeView.tsx"
      provides: "Sprites arbres charges uniquement pour la saison courante"
    - path: "components/mascot/TileMapRenderer.tsx"
      provides: "Sprites decos saisonniers charges uniquement pour la saison courante"
    - path: "lib/mascot/ambiance.ts"
      provides: "particleCount reduit (7->4, 6->3, 4->3)"
  key_links:
    - from: "WorldGridView (parent)"
      to: "CropCell (child)"
      via: "frameIdx prop + whisperCellId prop"
      pattern: "frameIdx={sharedFrameIdx}"
---

<objective>
Corriger le crash OOM (WatchdogTermination) sur l'ecran arbre apres ~4 minutes.

Purpose: L'ecran arbre cumule ~330 require() au module level, ~64 withRepeat, et ~40+ setInterval (2 par crop cell). Ce plan reduit drastiquement la pression memoire via 3 axes : timer global, lazy-load saisonnier, reduction particules.

Output: WorldGridView avec 1 seul timer au lieu de 2×N, TreeView/TileMapRenderer avec require() conditionnel par saison, particules reduites.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/mascot/WorldGridView.tsx
@components/mascot/TreeView.tsx
@components/mascot/TileMapRenderer.tsx
@components/mascot/AmbientParticles.tsx
@components/mascot/SeasonalParticles.tsx
@lib/mascot/ambiance.ts
@lib/mascot/seasons.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Timer global WorldGridView — eliminer 2×N setInterval par CropCell</name>
  <files>components/mascot/WorldGridView.tsx</files>
  <action>
  Dans WorldGridView (le composant parent, ligne ~571) :

  1. **Frame swap global** : Ajouter un state `sharedFrameIdx` avec un SEUL setInterval(800ms) qui toggle 0/1. Passer `sharedFrameIdx` comme prop a chaque CropCell.

  ```tsx
  // Dans WorldGridView, avant le return
  const reducedMotion = useReducedMotion();
  const [sharedFrameIdx, setSharedFrameIdx] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setSharedFrameIdx(i => 1 - i), 800);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  ```

  2. **Whisper global** : Ajouter un state `whisperCellId` avec un SEUL setInterval(~18s) qui choisit un cellId aleatoire parmi les crops non-matures, et un setTimeout(2500ms) pour le cacher. Passer `whisperCellId` comme prop a CropCell.

  ```tsx
  const [whisperCellId, setWhisperCellId] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      // Choisir une crop non-mature au hasard
      const nonMature = unlockedCrops.filter((cell, idx) => {
        const crop = crops.find(c => c.plotIndex === idx);
        return crop && crop.currentStage < 4;
      });
      if (nonMature.length === 0) return;
      const pick = nonMature[Math.floor(Math.random() * nonMature.length)];
      setWhisperCellId(pick.id);
      setTimeout(() => setWhisperCellId(null), 2500);
    }, 18000);
    return () => clearInterval(timer);
  }, [farmCropsCSV, treeStage]);
  ```

  3. **Modifier CropCell** :
  - Supprimer le useState/useEffect local pour `frameIdx` (lignes ~91-97)
  - Supprimer le useState/useEffect local pour whisper timer (lignes ~100-115)
  - Ajouter props `frameIdx: number` et `whisperCellId: string | null` au type de CropCell
  - Utiliser `frameIdx` depuis les props directement (au lieu du state local)
  - Deriver `bubble` via : `const bubble = whisperCellId === cell.id ? CROP_WHISPERS[Math.floor(Math.random() * CROP_WHISPERS.length)] : null;` — ATTENTION : le random dans render cause un re-render flicker. A la place, utiliser un useMemo stabilise sur whisperCellId :

  ```tsx
  const bubble = useMemo(() => {
    if (whisperCellId !== cell.id) return null;
    return CROP_WHISPERS[Math.floor(Math.random() * CROP_WHISPERS.length)];
  }, [whisperCellId, cell.id]);
  ```

  - Supprimer le `const [bubble, setBubble] = useState<string | null>(null);` local

  4. **Passer les nouvelles props** dans chaque `<CropCell>` (lignes ~618-634 et ~645-660) :
  ```tsx
  frameIdx={sharedFrameIdx}
  whisperCellId={whisperCellId}
  ```

  Resultat : 1 setInterval(800ms) + 1 setInterval(18s) au lieu de ~40 (2 par crop × ~20 crops).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "WorldGridView|error" | head -20</automated>
  </verify>
  <done>WorldGridView compile sans erreur. Un seul setInterval pour frame swap et un seul pour whispers, au niveau parent. CropCell n'a plus de timer propre.</done>
</task>

<task type="auto">
  <name>Task 2: Lazy-load sprites par saison — TreeView et TileMapRenderer</name>
  <files>components/mascot/TreeView.tsx, components/mascot/TileMapRenderer.tsx</files>
  <action>
  **TreeView.tsx** (107 require() au module level pour PIXEL_TREE_SPRITES) :

  1. Remplacer la constante `PIXEL_TREE_SPRITES` (lignes ~131-167) par une fonction `getSeasonTreeSprites(season: Season)` qui retourne uniquement les sprites de la saison demandee + shadow. La fonction utilise un cache Map pour ne pas re-executer require() a chaque appel.

  ```tsx
  const _spriteCache = new Map<string, Record<string, Record<number, any>>>();

  function getSeasonTreeSprites(season: Season): Record<string, Record<string, Record<number, any>>> {
    const key = SEASON_TO_KEY[season];
    if (_spriteCache.has(key)) return _spriteCache.get(key)!;

    const sprites: Record<string, Record<string, Record<number, any>>> = {};
    // Dynamically build only for the requested season + shadow
    // NOTE: require() calls are static in React Native Metro bundler — 
    // they are ALL bundled regardless. The optimization here is about
    // not creating 100 Image objects in memory simultaneously.
    // We keep ALL requires but only reference the current season's set.
    const result = buildSpriteSubset(key);
    _spriteCache.set(key, result);
    return result;
  }
  ```

  IMPORTANT: Dans React Native, `require()` est resolu statiquement par Metro. On ne peut PAS faire de require() dynamique. Donc la vraie optimisation est de garder PIXEL_TREE_SPRITES tel quel (les require sont resolus au bundle time, pas au runtime) mais de creer une fonction `getSeasonSprites(season)` qui ne retourne que le sous-ensemble saison courante, evitant de passer les 100+ refs aux composants enfants.

  En realite, les require() au module level ne causent PAS d'allocation image — c'est Metro qui les resolve en IDs numeriques. Le vrai probleme memoire vient des `<Image source={}>` qui instancient des bitmaps natifs. Donc l'optimisation correcte est :

  - Modifier `getPixelTreeSprite()` et `getPixelShadowSprite()` pour accepter la saison en parametre (deja fait).
  - S'assurer que seuls les sprites de la saison courante sont passes aux composants `<Image>` — ce qui est deja le cas via `currentSeason`.

  **CONCLUSION TreeView :** Les require() module-level dans TreeView ne sont PAS le probleme (Metro les resolve en IDs numeriques). Le composant utilise deja `currentSeason` pour ne charger qu'une saison. **Ne pas modifier TreeView** — il est deja optimise pour la saison courante.

  **TileMapRenderer.tsx** (94 require() module-level) :

  Meme analyse : `SEASON_TREE_SPRITES` (lignes ~77-127) charge les 4 saisons de sprites d'arbres decos. Contrairement a TreeView, TileMapRenderer utilise `season` prop pour indexer `SEASON_TREE_SPRITES[seasonKey]` et ne passe que cette saison aux `<Image>`. Les require() sont statiques (IDs Metro), donc pas de fuite memoire.

  **CONCLUSION TileMapRenderer :** Meme chose — deja optimise. Les require() sont des IDs Metro, pas des allocations.

  **CompanionSlot.tsx** (93 require()) :

  Meme chose — les sprites walk sont des IDs Metro statiques. Seul le sprite actif est passe a `<Image>`.

  **VRAI impact memoire :** Le probleme n'est PAS les require() mais les **composants Image montes simultanement**. Chaque `<Image>` monte cree un bitmap natif. Le nombre d'Images montees simultanement sur l'ecran arbre est le vrai facteur OOM.

  **Action reelle Task 2 :** Puisque les require() ne sont pas le probleme, recentrer sur la reduction du nombre de composants Animated montes :

  1. Dans **AmbientParticles.tsx** : Reduire `particleCount` dans `lib/mascot/ambiance.ts` — rosee: 7->4, nuit: 6->3, soir: 4->3.

  2. Dans **SeasonalParticles.tsx** : Les counts sont deja bas (2-4). Pas de changement necessaire.

  3. Dans **AmbientParticles.tsx** : Le setInterval(60s) pour re-polling timeSlot est OK (1 seul timer, intervalle long).

  **Modifier `lib/mascot/ambiance.ts` :**
  - Ligne ~33: `particleCount: 7` -> `particleCount: 4` (rosee matin)
  - Ligne ~43: `particleCount: 4` -> `particleCount: 3` (ambre soir)
  - Ligne ~52: `particleCount: 6` -> `particleCount: 3` (lucioles nuit)

  Cela reduit de 17 a 10 les Animated.View avec 3 withRepeat chacun (soit 51 -> 30 withRepeat pour AmbientParticles, reduction de 21 animations).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "ambiance|AmbientParticles|error" | head -20</automated>
  </verify>
  <done>particleCount reduit dans ambiance.ts (total 17 -> 10 particules). TreeView/TileMapRenderer non modifies car les require() Metro sont des IDs statiques, pas des allocations memoire.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` compile sans nouvelles erreurs
- L'ecran arbre s'affiche correctement avec crops animees (frame swap visible)
- Les whispers apparaissent periodiquement sur des crops aleatoires
- Les particules ambiantes sont visibles mais moins nombreuses
- Aucun crash apres 5+ minutes sur l'ecran arbre
</verification>

<success_criteria>
- WorldGridView : 2 timers globaux (frame swap 800ms + whisper 18s) au lieu de ~40 timers locaux
- AmbientParticles : 10 particules max au lieu de 17 (reduction 41% des Animated.View + withRepeat)
- Total withRepeat reduit de ~64 a ~43 (elimination ~21)
- Total setInterval reduit de ~40+ a 3 (2 dans WorldGridView + 1 dans AmbientParticles)
- npx tsc --noEmit passe
</success_criteria>

<output>
After completion, create `.planning/quick/260404-qvz-fix-oom-crash-treescreen-timer-global-la/260404-qvz-SUMMARY.md`
</output>
