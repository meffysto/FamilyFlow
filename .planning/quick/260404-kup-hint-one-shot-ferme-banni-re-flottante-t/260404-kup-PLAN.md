---
phase: quick
plan: 260404-kup
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/tree.tsx
autonomous: true
requirements: [QUICK-kup]
must_haves:
  truths:
    - "La banniere hint ferme s'affiche la premiere fois que l'utilisateur visite l'ecran arbre"
    - "La banniere ne s'affiche plus apres avoir tape 'J'ai compris'"
    - "La banniere est positionnee en bas du diorama, au-dessus du bottom panel"
  artifacts:
    - path: "app/(tabs)/tree.tsx"
      provides: "FarmHintBanner composant inline + integration useHelp"
      contains: "FarmHintBanner"
  key_links:
    - from: "app/(tabs)/tree.tsx"
      to: "contexts/HelpContext.tsx"
      via: "useHelp() hook — hasSeenScreen('farm'), markScreenSeen('farm')"
      pattern: "hasSeenScreen.*farm"
---

<objective>
Ajouter un hint one-shot ferme dans tree.tsx : banniere flottante qui s'affiche la premiere fois, explique le mecanisme cultures + plot prioritaire, et se dismiss definitivement.

Purpose: Onboarding utilisateur — expliquer le lien taches/cultures et le plot prioritaire avant meme qu'il plante.
Output: Banniere FarmHintBanner dans le diorama tree.tsx, persistee via useHelp('farm').
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/(tabs)/tree.tsx
@contexts/HelpContext.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Creer FarmHintBanner et integrer dans le diorama tree.tsx</name>
  <files>app/(tabs)/tree.tsx</files>
  <action>
1. **Import useHelp** : Ajouter `import { useHelp } from '../../contexts/HelpContext';` dans les imports existants (vers ligne 39, apres les autres imports de contexts).

2. **Hook useHelp** : Dans le composant principal (vers ligne 235, zone des hooks d'etat), ajouter :
   ```ts
   const { hasSeenScreen, markScreenSeen, isLoaded: helpLoaded } = useHelp();
   const showFarmHint = helpLoaded && !hasSeenScreen('farm');
   ```

3. **Composant FarmHintBanner** : Creer un composant memo AVANT le composant principal de l'ecran (vers ligne 150, zone des sous-composants inline). Structure :
   ```tsx
   const FarmHintBanner = React.memo(function FarmHintBanner({ onDismiss }: { onDismiss: () => void }) {
     const { colors } = useThemeColors();
     return (
       <Animated.View
         entering={FadeInUp.delay(800).duration(500).springify()}
         style={{
           position: 'absolute',
           bottom: Spacing.lg,
           left: Spacing.md,
           right: Spacing.md,
           zIndex: 25,
           backgroundColor: colors.card,
           borderRadius: Radius.lg,
           padding: Spacing.md,
           ...Shadows.md,
           borderWidth: 1,
           borderColor: colors.borderLight,
         }}
       >
         <Text style={{ fontSize: FontSize.sm, color: colors.text, marginBottom: Spacing.xs, lineHeight: FontSize.sm * 1.5 }}>
           {'🌱 Complete des taches pour faire pousser tes cultures ! Le plot ⚡ avance en priorite.'}
         </Text>
         <TouchableOpacity
           onPress={onDismiss}
           activeOpacity={0.7}
           style={{
             alignSelf: 'flex-end',
             paddingVertical: Spacing.xxs,
             paddingHorizontal: Spacing.sm,
             backgroundColor: colors.primary + '20',
             borderRadius: Radius.md,
           }}
         >
           <Text style={{ fontSize: FontSize.xs, color: colors.primary, fontWeight: '600' }}>
             {"J'ai compris"}
           </Text>
         </TouchableOpacity>
       </Animated.View>
     );
   });
   ```
   - Utiliser `useThemeColors()` pour toutes les couleurs (jamais de hardcoded).
   - Utiliser les tokens `Spacing`, `Radius`, `FontSize`, `Shadows` deja importes dans tree.tsx.
   - `entering={FadeInUp.delay(800)}` pour laisser le diorama se charger avant d'afficher le hint.
   - `zIndex: 25` pour etre au-dessus des couches saga (zIndex 20) et particules (zIndex 5).

4. **Insertion JSX** : Dans le treeBg View (le conteneur diorama), inserer juste avant la fermeture `</View>` de treeBg (ligne ~1735), apres les overlays saga/evenement et avant le closing tag :
   ```tsx
   {/* Couche 6 : Hint one-shot ferme */}
   {showFarmHint && (
     <FarmHintBanner onDismiss={() => markScreenSeen('farm')} />
   )}
   ```

5. **Pas de modification** de SCREEN_IDS dans HelpContext.tsx — `hasSeenScreen` et `markScreenSeen` acceptent deja n'importe quel string, pas seulement les IDs du tableau. La persistance fonctionne pour tout screenId arbitraire.
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - FarmHintBanner s'affiche dans le diorama la premiere visite (hasSeenScreen('farm') === false)
    - Le tap "J'ai compris" appelle markScreenSeen('farm') et la banniere disparait
    - La banniere ne reapparait plus aux visites suivantes
    - Positionnement : absolute en bas du diorama, zIndex 25, au-dessus de toutes les couches
    - Couleurs via useThemeColors(), tokens design system
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` compile sans nouvelles erreurs
- Sur device/simulateur : premiere visite ecran arbre affiche la banniere en bas du diorama
- Tap "J'ai compris" fait disparaitre la banniere
- Retour sur l'ecran arbre : banniere absente
</verification>

<success_criteria>
Banniere hint ferme fonctionnelle, one-shot, positionnee dans le diorama, respectant le design system.
</success_criteria>

<output>
After completion, create `.planning/quick/260404-kup-hint-one-shot-ferme-banni-re-flottante-t/260404-kup-SUMMARY.md`
</output>
