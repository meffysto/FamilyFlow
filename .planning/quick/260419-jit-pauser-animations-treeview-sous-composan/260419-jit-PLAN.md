---
phase: 260419-jit
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/mascot/TreeView.tsx
autonomous: true
requirements:
  - JIT-01
must_haves:
  truths:
    - "Quand le tab Tree n'est pas focus (ou app en background), les sous-composants AnimatedAnimal, SeasonalParticle et Particle cessent leurs setInterval/withRepeat"
    - "Les animations reprennent normalement quand le tab redevient actif"
    - "Aucune régression visuelle quand le tab est actif (animations identiques)"
  artifacts:
    - path: "components/mascot/TreeView.tsx"
      provides: "Propagation du prop `paused` aux 3 sous-composants qui l'ignoraient"
      contains: "paused"
  key_links:
    - from: "TreeViewInner (paused prop ligne 88)"
      to: "AnimatedAnimal / SeasonalParticles / Particle wrappers"
      via: "prop drilling paused"
      pattern: "paused=\\{paused\\}"
    - from: "sous-composants useEffect"
      to: "early return if paused"
      via: "dep array inclut paused"
      pattern: "if \\(.*paused.*\\) return"
---

<objective>
Propager le prop `paused` de `TreeViewInner` aux 3 sous-composants internes (`AnimatedAnimal`, `SeasonalParticle`/`SeasonalParticles`, `Particle`) qui l'ignorent actuellement. Ces 3 composants drivent 80+ worklets infinis (`withRepeat(-1)`) + 3 `setInterval` même quand le tab Tree n'est pas focus.

Purpose: Éliminer le drain batterie confirmé par Instruments (ShadowTree::commit 62% CPU, Hermes 82.7%) quand l'utilisateur navigue hors du tab Tree mais que l'app reste au premier plan. `tree.tsx:599` calcule déjà `animationsPaused`, `TreeView` lui-même gate sway/breathe — il ne reste qu'à propager aux feuilles.

Output: `components/mascot/TreeView.tsx` modifié, les 3 sous-composants acceptent `paused` et gatent leurs `useEffect` avec early return + dep array updated.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@components/mascot/TreeView.tsx
@app/(tabs)/tree.tsx

<interfaces>
<!-- Contexte déjà vérifié (voir specifics du prompt) : -->

app/(tabs)/tree.tsx:
```typescript
// Ligne 599 — déjà calculé, ne pas toucher
const animationsPaused = !isAppActive || !isScreenFocused;
// Ligne ~2182 — déjà propagé à WorldGridView
```

components/mascot/TreeView.tsx (état actuel):
```typescript
// Ligne 88 — TreeViewInnerProps accepte déjà paused
paused?: boolean;

// Ligne 200 — utilisé pour sway/breathe
const animate = interactive && !reducedMotion && !paused;

// Ligne 1564 — Particle, 4 withRepeat(-1), useEffect dep [reducedMotion]
// Ligne ~1466 — SeasonalParticle, 4 withRepeat(-1), useEffect dep [reducedMotion]
// Ligne 1938 — AnimatedAnimal, 3 setInterval, useEffect dep [animalId] + [isWalking, activeWalkFrames]
```

Pattern cible (cohérent avec WorldGridView/CropCell Phase 14+):
```typescript
// 1. Ajouter paused à la signature
function SubComponent({ ..., paused = false }: { ...; paused?: boolean }) {
  useEffect(() => {
    if (reducedMotion || paused) return;
    // ... withRepeat / setInterval logic existant ...
    return () => { /* cleanup existant */ };
  }, [reducedMotion, paused]);  // AJOUTER paused au dep array
}

// 2. Au site de rendu (dans TreeViewInner), propager paused
<Particle ... paused={paused} />
<SeasonalParticles ... paused={paused} />
<AnimatedAnimal ... paused={paused} />
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gater les useEffect des 3 sous-composants avec `paused`</name>
  <files>components/mascot/TreeView.tsx</files>
  <action>
    Dans `components/mascot/TreeView.tsx`, modifier les 3 sous-composants pour accepter un prop `paused?: boolean` (default `false`) et gater leurs `useEffect` :

    **1. `Particle` (ligne ~1564)** — signature actuelle `{ color, index, containerSize }` :
    - Ajouter `paused = false` à la signature et au type de props
    - Dans le `useEffect` (dep `[reducedMotion]`), ajouter early return : `if (reducedMotion || paused) return;` AVANT les 4 `withRepeat(-1)` (translateY, translateX, opacity, scale)
    - Mettre à jour le dep array → `[reducedMotion, paused]`
    - Conserver le cleanup existant `cancelAnimation(...)` tel quel (se déclenche au re-run si paused passe true→false→true)

    **2. `SeasonalParticle` (ligne ~1466)** — même pattern :
    - Ajouter `paused = false` à la signature + type
    - Early return dans le `useEffect` (dep `[reducedMotion]`) : `if (reducedMotion || paused) return;` AVANT les 4 `withRepeat(-1)` (translateY, translateX, opacity, rotation)
    - Dep array → `[reducedMotion, paused]`
    - Propager `paused` depuis le wrapper `SeasonalParticles` (ligne ~1440) vers chaque `<SeasonalParticle>` rendu — ajouter `paused?: boolean` aux props de `SeasonalParticles` et forward

    **3. `AnimatedAnimal` (ligne ~1938)** — signature `{ frames, x, y, size, animalId, containerWidth }` :
    - Ajouter `paused = false` à la signature + type
    - Dans le `useEffect` dep `[animalId]` (ligne ~1949) : early return `if (paused) return;` AVANT les 3 `setInterval` (idle 600ms, walk 3-6s, bubble 15-30s)
    - Dep array → `[animalId, paused]`
    - Dans le `useEffect` dep `[isWalking, activeWalkFrames]` (ligne ~2002) : early return `if (paused) return;` AVANT le walkFrameIdx interval (200ms)
    - Dep array → `[isWalking, activeWalkFrames, paused]`
    - Conserver les `clearInterval` existants dans les cleanups (ils se déclenchent au re-run)
    - NB : `AnimatedAnimal` ne dépend pas de `reducedMotion` — garder le gate simple `if (paused) return;`

    **Contraintes :**
    - Ne PAS toucher à la logique d'animation elle-même (valeurs, timings, interpolations) — juste les gates et dep arrays
    - Ne PAS toucher à `WorldGridView`, `TreeView` sway/breathe, ou `tree.tsx`
    - Utiliser `Edit` (pas `Write`) — modifications chirurgicales
    - Commits/comments en français conformément à CLAUDE.md
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "TreeView\.tsx" | grep -v "MemoryEditor\|cooklang\|useVault"</automated>
  </verify>
  <done>
    - Les 3 sous-composants (`Particle`, `SeasonalParticle`, `AnimatedAnimal`) acceptent `paused?: boolean`
    - Chaque `useEffect` concerné a un early return `if (... paused) return;` AVANT les `withRepeat`/`setInterval`
    - Tous les dep arrays incluent `paused`
    - `SeasonalParticles` wrapper forward `paused` à chaque enfant
    - `npx tsc --noEmit` n'ajoute aucune nouvelle erreur sur TreeView.tsx (les erreurs pré-existantes MemoryEditor/cooklang/useVault sont ignorées)
  </done>
</task>

<task type="auto">
  <name>Task 2: Propager `paused` aux sites de rendu dans TreeViewInner + validation finale</name>
  <files>components/mascot/TreeView.tsx</files>
  <action>
    Dans `TreeViewInner` (le composant parent qui reçoit `paused` ligne 88) :

    **1. Sites de rendu à mettre à jour :**
    - Rendu `<AnimatedAnimal>` (ligne ~349) : ajouter `paused={paused}`
    - Rendu `<SeasonalParticles>` (ligne ~372) : ajouter `paused={paused}`
    - Rendu `<Particle>` (à trouver — normalement dans un wrapper type `AmbientParticles` ou directement dans le JSX de `TreeViewInner`) : ajouter `paused={paused}`. Si `Particle` est rendu dans un wrapper intermédiaire, propager `paused` à travers ce wrapper aussi.

    **2. Vérification exhaustive :**
    Exécuter `grep -n "paused" components/mascot/TreeView.tsx` et vérifier que :
    - Le prop `paused` apparaît dans les signatures de `Particle`, `SeasonalParticle`, `SeasonalParticles` (wrapper), `AnimatedAnimal`
    - Le prop `paused` apparaît dans chaque site de rendu de ces composants dans `TreeViewInner`
    - Les early returns `if (... paused) return;` sont présents dans les useEffect concernés
    - Les dep arrays incluent `paused`

    **3. Validation TypeScript :**
    `npx tsc --noEmit` — aucune nouvelle erreur (les erreurs pré-existantes MemoryEditor.tsx, cooklang.ts, useVault.ts sont à ignorer conformément à CLAUDE.md).

    **Contraintes :**
    - Utiliser `Edit` tool, pas de réécriture
    - Français pour tout commentaire ajouté
    - Ne pas toucher aux autres props ni à la logique sway/breathe du TreeView lui-même
  </action>
  <verify>
    <automated>grep -c "paused" components/mascot/TreeView.tsx && npx tsc --noEmit 2>&1 | grep -E "TreeView\.tsx" | grep -v "MemoryEditor\|cooklang\|useVault" | wc -l</automated>
  </verify>
  <done>
    - `grep -n "paused" components/mascot/TreeView.tsx` montre `paused` dans : signature de `Particle`, `SeasonalParticle`, `SeasonalParticles`, `AnimatedAnimal`, leurs useEffect gates, leurs sites de rendu dans `TreeViewInner`
    - Occurrences `paused` ≥ 15 (4 signatures + 4 early returns + 4 dep arrays + 3-4 sites de rendu + 1 prop d'origine ligne 88)
    - `npx tsc --noEmit` retourne 0 nouvelle erreur sur TreeView.tsx
    - Test manuel (optionnel, non-bloquant) : `rtk git diff components/mascot/TreeView.tsx` montre uniquement les gates et la propagation, aucune modif de valeur d'animation
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelle erreur sur TreeView.tsx
- `grep -n "paused" components/mascot/TreeView.tsx` confirme la présence du prop dans les 3 sous-composants + leurs sites de rendu
- Test fonctionnel (à valider manuellement par le user après exécution) : naviguer hors du tab Tree → les worklets et setInterval cessent (vérifiable via Instruments si besoin, ou simplement confirmation que rien ne régresse à l'œil sur le tab Tree actif)
</verification>

<success_criteria>
- Les 3 sous-composants (`AnimatedAnimal`, `SeasonalParticle`, `Particle`) gatent leurs animations sur `paused`
- Aucune régression TypeScript introduite
- Aucune régression visuelle quand `paused=false` (comportement identique à avant)
- Quand `paused=true` (tab pas focus ou app background) : les 3+ `setInterval` et 8+ `withRepeat(-1)` de ces sous-composants s'arrêtent via leurs cleanups
</success_criteria>

<output>
After completion, create `.planning/quick/260419-jit-pauser-animations-treeview-sous-composan/260419-jit-SUMMARY.md`
</output>
