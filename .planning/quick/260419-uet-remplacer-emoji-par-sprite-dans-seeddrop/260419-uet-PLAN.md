---
phase: quick-260419-uet
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/mascot/HarvestEventOverlay.tsx
autonomous: true
requirements:
  - QUICK-260419-UET
must_haves:
  truths:
    - "Quand une graine rare connue (orchidee, rose_doree, truffe, fruit_dragon) drop, le sprite pixel art assets/garden/crops/{seedId}/icon.png s'affiche à la place de l'emoji"
    - "Si le seedId n'est pas dans le mapping, le fallback emoji Text continue de s'afficher"
    - "Le reste du composant SeedDropOverlay (sparkles, animation scale, label, dismiss) fonctionne à l'identique"
  artifacts:
    - path: "components/mascot/HarvestEventOverlay.tsx"
      provides: "Constante RARE_SEED_SPRITES + rendu conditionnel Image/Text dans SeedDropOverlay"
      contains: "RARE_SEED_SPRITES"
  key_links:
    - from: "components/mascot/HarvestEventOverlay.tsx"
      to: "assets/garden/crops/{orchidee,rose_doree,truffe,fruit_dragon}/icon.png"
      via: "require() statique dans RARE_SEED_SPRITES"
      pattern: "require\\('\\.\\./\\.\\./assets/garden/crops/.*icon\\.png'\\)"
---

<objective>
Remplacer l'affichage emoji du SeedDropOverlay par un sprite pixel art quand la graine rare est connue.

Purpose: Cohérence visuelle avec le reste de l'app (crops/récoltes déjà en pixel art) — l'emoji détonne dans l'overlay de drop de graine rare.
Output: SeedDropOverlay affiche `assets/garden/crops/{seedId}/icon.png` pour les 4 graines rares connues, avec fallback emoji pour les inconnues.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@components/mascot/HarvestEventOverlay.tsx

<interfaces>
<!-- RareSeedDrop type (from lib/mascot/farm-engine.ts) -->
```typescript
export interface RareSeedDrop {
  seedId: string;    // ex: 'orchidee', 'rose_doree', 'truffe', 'fruit_dragon'
  emoji: string;     // fallback visuel existant
  name: string;
  // ... autres champs non pertinents
}
```

<!-- Sprites disponibles (vérifiés existants) -->
- assets/garden/crops/orchidee/icon.png
- assets/garden/crops/rose_doree/icon.png
- assets/garden/crops/truffe/icon.png
- assets/garden/crops/fruit_dragon/icon.png
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter mapping RARE_SEED_SPRITES et rendre Image conditionnelle dans SeedDropOverlay</name>
  <files>components/mascot/HarvestEventOverlay.tsx</files>
  <action>
    Dans `components/mascot/HarvestEventOverlay.tsx` :

    1. **Vérifier les imports** (haut du fichier) :
       - S'assurer que `Image` est importé depuis `'react-native'` (ajouter si absent à la ligne d'import existante).

    2. **Ajouter la constante RARE_SEED_SPRITES** juste avant le composant `SeedDropOverlay` (vers ligne 480, après `SeedSparkle` et avant `interface SeedDropOverlayProps`) :

       ```typescript
       // Mapping statique seedId → sprite icon pixel art.
       // require() obligatoirement statique (Metro bundler — cf. Phase 30-01 Pitfall 4).
       const RARE_SEED_SPRITES: Record<string, number> = {
         orchidee: require('../../assets/garden/crops/orchidee/icon.png'),
         rose_doree: require('../../assets/garden/crops/rose_doree/icon.png'),
         truffe: require('../../assets/garden/crops/truffe/icon.png'),
         fruit_dragon: require('../../assets/garden/crops/fruit_dragon/icon.png'),
       };
       ```

    3. **Modifier le rendu dans `SeedDropOverlay`** (ligne ~532-534). Remplacer :

       ```tsx
       <Animated.View style={emojiStyle}>
         <Text style={styles.seedEmoji}>{seedDrop.emoji}</Text>
       </Animated.View>
       ```

       Par :

       ```tsx
       <Animated.View style={emojiStyle}>
         {RARE_SEED_SPRITES[seedDrop.seedId] ? (
           <Image
             source={RARE_SEED_SPRITES[seedDrop.seedId]}
             style={styles.seedSprite}
             resizeMode="contain"
           />
         ) : (
           <Text style={styles.seedEmoji}>{seedDrop.emoji}</Text>
         )}
       </Animated.View>
       ```

    4. **Ajouter le style `seedSprite`** dans le `StyleSheet.create({...})` en bas du fichier (à côté de `seedEmoji`) :

       ```typescript
       seedSprite: {
         width: 80,
         height: 80,
       },
       ```

       Note : `resizeMode` est passé en prop sur `<Image>`, pas dans le StyleSheet (pattern RN standard).

    5. **Ne PAS toucher** :
       - Le style `seedEmoji` existant (reste pour fallback).
       - Les sparkles, les animations (`emojiScale`, `labelOpacity`), le `Haptics`, le `setTimeout(onDismiss)`.
       - Le titre "🌟 Graine rare trouvée !" (reste en emoji — cosmétique).
       - Les autres overlays du fichier (`PluieDoreeContent`, `MutationContent`, etc.).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "HarvestEventOverlay" || echo "OK: pas d'erreur TS nouvelle dans HarvestEventOverlay"</automated>
  </verify>
  <done>
    - `RARE_SEED_SPRITES` exporte les 4 sprites via `require()` statique
    - `SeedDropOverlay` rend `<Image>` pour les seedId connus, `<Text>` fallback sinon
    - Style `seedSprite` 80×80 ajouté
    - `Image` importé depuis 'react-native'
    - `npx tsc --noEmit` : aucune nouvelle erreur sur HarvestEventOverlay.tsx
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` : aucune nouvelle erreur dans `HarvestEventOverlay.tsx`
2. Grep sanity check : `grep -n "RARE_SEED_SPRITES" components/mascot/HarvestEventOverlay.tsx` retourne au moins 3 lignes (déclaration + 2 usages dans le ternaire)
3. Grep sanity check : `grep -n "seedSprite" components/mascot/HarvestEventOverlay.tsx` retourne 2 lignes (StyleSheet + usage)
</verification>

<success_criteria>
- Les 4 graines rares connues (orchidee, rose_doree, truffe, fruit_dragon) affichent leur sprite `icon.png` dans l'overlay de drop
- Une graine inconnue (seedId non mappé) retombe sur l'affichage emoji sans crash
- Animations (scale spring, sparkles, label fade, auto-dismiss 2s, haptic) inchangées
- Zéro nouvelle erreur TypeScript
</success_criteria>

<output>
After completion, create `.planning/quick/260419-uet-remplacer-emoji-par-sprite-dans-seeddrop/260419-uet-01-SUMMARY.md`
</output>
