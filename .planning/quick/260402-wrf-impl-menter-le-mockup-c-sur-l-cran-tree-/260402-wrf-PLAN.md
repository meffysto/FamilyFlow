---
phase: quick
plan: 260402-wrf
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/tree.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Le diorama a des coins arrondis en bas (borderBottomLeftRadius/borderBottomRightRadius: 28)"
    - "Le gradient de transition entre diorama et contenu est supprime"
    - "Le diorama projette une ombre portee visible"
    - "Les cartes Actions et Progression chevauchent le bas du diorama avec un marginTop negatif"
    - "Le contenu sous le diorama reste scrollable normalement"
  artifacts:
    - path: "app/(tabs)/tree.tsx"
      provides: "Layout mockup C — diorama arrondi + chevauchement ScrollView"
  key_links: []
---

<objective>
Implementer le mockup C sur l'ecran arbre : supprimer le LinearGradient de transition diorama->contenu, ajouter des coins arrondis bas sur le conteneur diorama avec ombre portee, et faire chevaucher les cartes sous le diorama via marginTop negatif + zIndex eleve.

Purpose: Transition visuelle plus nette et moderne entre le diorama et le contenu scrollable.
Output: Ecran arbre avec le layout mockup C.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/(tabs)/tree.tsx

Structure actuelle du fichier (lignes cles) :
- L985 : `<ScrollView` principal avec `contentContainerStyle={[styles.scroll, Layout.contentContainer]}`
- L1250-1334 : Bloc diorama `<Animated.View entering={FadeIn}>` > `<View style={[styles.treeBg, ...]}>`
  - treeBg = full-bleed, pas de borderRadius, overflow: visible, marginHorizontal: -Spacing['2xl']
- L1371-1375 : `<LinearGradient>` de transition diorama->fond de page (style `groundTransition`)
- L1378-1413 : Carte Actions (actionCard)
- L1416-1453 : Carte Progression (progressCard)
- L1700-1704 : Style `groundTransition` : height: 48, marginHorizontal: -Spacing['2xl'], marginTop: -1

Imports deja presents : LinearGradient (expo-linear-gradient), Shadows, Spacing, Radius
</context>

<tasks>

<task type="auto">
  <name>Task 1: Appliquer mockup C — coins arrondis diorama, supprimer gradient, chevauchement cartes</name>
  <files>app/(tabs)/tree.tsx</files>
  <action>
Modifications dans `app/(tabs)/tree.tsx` :

1. **Style `treeBg`** (L1634) — ajouter coins arrondis bas + ombre :
   - Ajouter `borderBottomLeftRadius: 28` et `borderBottomRightRadius: 28`
   - Garder `overflow: 'visible'` (necessaire pour tooltips/bulles companion)
   - Le conteneur clippe interne (L1263, `<View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>`) doit aussi recevoir `borderBottomLeftRadius: 28` et `borderBottomRightRadius: 28` pour que le terrain/tilemap soit clippe correctement aux coins arrondis

2. **Ombre portee sur le diorama** — ajouter un style d'ombre sur le conteneur `treeBg` :
   - Utiliser `Shadows.md` (token existant dans constants/shadows.ts) OU appliquer manuellement :
     ```
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.15,
     shadowRadius: 8,
     elevation: 6,
     ```

3. **Supprimer le LinearGradient de transition** (L1371-1375) :
   - Supprimer le bloc `<LinearGradient colors={[PIXEL_GROUND_DARK[season], colors.bg]} style={styles.groundTransition} />`
   - Supprimer le style `groundTransition` (L1700-1704) du StyleSheet
   - L'import `PIXEL_GROUND_DARK` peut rester (utilise ailleurs potentiellement) ou etre supprime si plus utilise — verifier avec grep

4. **Chevauchement des cartes** — faire monter les cartes sous le diorama :
   - Sur le conteneur de la carte Actions (L1380, le `<Animated.View>`), ajouter `style={{ marginTop: -22, zIndex: 10, position: 'relative' }}`
   - La carte Progression suit naturellement en dessous (garder son marginTop: Spacing.sm existant)
   - Le `position: 'relative'` + `zIndex: 10` garantit que les cartes passent visuellement au-dessus de l'ombre du diorama
   - Pour le cas `!isOwnTree` (arbre d'un autre profil), appliquer le marginTop: -22 sur le conteneur de la carte Progression (L1417) a la place

5. **Verifier** que le `treeContainer` (L1630) n'a pas de style qui bloquerait l'ombre (pas de `overflow: 'hidden'`).

6. **Optionnel** : si l'import `LinearGradient` n'est plus utilise nulle part dans le fichier apres suppression du gradient de transition, le supprimer de la ligne d'import (L25).
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
  - Le LinearGradient de transition entre diorama et contenu est supprime
  - Le conteneur diorama (treeBg) a borderBottomLeftRadius: 28 et borderBottomRightRadius: 28
  - Le conteneur diorama a une ombre portee visible
  - Les cartes Actions/Progression chevauchent le bas du diorama avec marginTop: -22
  - Le terrain tilemap est correctement clippe aux coins arrondis (clip interne)
  - La compilation TypeScript passe sans nouvelles erreurs
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Layout mockup C sur l'ecran arbre : diorama avec coins arrondis bas + ombre portee, cartes qui chevauchent le diorama, gradient de transition supprime.</what-built>
  <how-to-verify>
    1. Lancer l'app sur device/simulateur : `npx expo run:ios --device`
    2. Naviguer vers l'ecran arbre (onglet arbre)
    3. Verifier visuellement :
       - Le bas du diorama a des coins arrondis (pas de bords droits)
       - Le terrain/tilemap est bien clippe aux coins (pas de debordement)
       - Une ombre portee est visible sous le diorama
       - La carte Actions chevauche legerement le bas du diorama (~22px)
       - Pas de gap/ligne blanche entre le diorama et les cartes
    4. Scroller le contenu — tout reste fluide, pas de glitch visuel
    5. Verifier en dark mode aussi (les ombres sont visibles)
  </how-to-verify>
  <resume-signal>Taper "approved" ou decrire les ajustements necessaires</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` ne montre pas de nouvelles erreurs
- Verification visuelle sur device : coins arrondis, ombre, chevauchement
</verification>

<success_criteria>
- Le gradient de transition LinearGradient est supprime du rendu et du StyleSheet
- Le diorama a des coins arrondis bas (28px) avec ombre portee
- Les cartes chevauchent le diorama avec marginTop: -22 et zIndex eleve
- La compilation TypeScript passe
- Verification visuelle approuvee par l'utilisateur
</success_criteria>

<output>
After completion, create `.planning/quick/260402-wrf-impl-menter-le-mockup-c-sur-l-cran-tree-/260402-wrf-SUMMARY.md`
</output>
