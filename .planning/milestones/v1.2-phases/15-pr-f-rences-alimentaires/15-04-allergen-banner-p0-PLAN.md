---
phase: 15-pr-f-rences-alimentaires
plan: 04
type: execute
wave: 2
depends_on: [15-01]
files_modified:
  - components/dietary/AllergenBanner.tsx
  - components/dietary/index.ts
  - lib/__tests__/allergen-banner.test.ts
autonomous: true
requirements: [PREF-10, PREF-11]

must_haves:
  truths:
    - "AllergenBanner rend la ligne 'allergie' avec fond errorBg et border gauche error, sans aucun bouton dismiss visible"
    - "Le type AllergenBannerProps n'expose aucune prop onDismiss, onClose ou dismissible"
    - "Le container du bandeau a pointerEvents='none' pour résister aux gestes accidentels"
    - "Si conflicts=[] alors le composant retourne null (bandeau absent)"
    - "Si au moins un conflit allergie : la ligne rouge est TOUJOURS rendue, non-collapsible"
    - "Test unitaire vérifie statiquement que AllergenBannerProps n'a pas 'onDismiss' dans ses clés"
  artifacts:
    - path: "components/dietary/AllergenBanner.tsx"
      provides: "Composant AllergenBanner P0 SAFETY (PREF-11)"
      exports: ["AllergenBanner", "AllergenBannerProps"]
    - path: "components/dietary/index.ts"
      provides: "Barrel export du sous-dossier dietary"
      exports: ["AllergenBanner"]
    - path: "lib/__tests__/allergen-banner.test.ts"
      provides: "Test statique TS + test runtime no dismiss API"
      contains: "onDismiss"
  key_links:
    - from: "AllergenBanner.tsx"
      to: "lib/dietary/types.ts DietaryConflict"
      via: "import type"
      pattern: "import.*DietaryConflict"
    - from: "AllergenBanner.tsx"
      to: "contexts/ThemeContext useThemeColors"
      via: "useThemeColors() pour errorBg/warningBg/infoBg"
      pattern: "useThemeColors"
---

<objective>
Implémenter le composant `AllergenBanner` P0 SAFETY (PREF-11). Enforcement architectural : aucune prop de dismiss dans le type, `pointerEvents='none'` sur le container, ligne allergie toujours rendue. Test unitaire dédié.

Purpose: Ce composant est le garde-fou central de la phase. Toute PR future qui ajouterait une API dismiss doit être bloquée par le test.
Output: Composant + test + barrel export.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md
@.planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md
@lib/dietary/types.ts
@components/ui/Badge.tsx
@components/ui/CollapsibleSection.tsx
@CLAUDE.md

<interfaces>
<!-- DietaryConflict from Plan 01 -->
From lib/dietary/types.ts:
```typescript
export interface DietaryConflict {
  ingredientName: string;
  matchedAllergen: string;
  severity: 'allergie' | 'intolerance' | 'regime' | 'aversion';
  profileIds: string[];
  profileNames: string[];
}
```

<!-- Theme contract -->
useThemeColors() returns colors containing: errorBg, errorText, error, warningBg, warningText, warning, tagMention, tagMentionText, infoBg, info.
Spacing tokens: Spacing.xs=4, Spacing.md=8, Spacing.xl=12, Spacing['2xl']=16, Radius.lg=12.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1: AllergenBanner P0 SAFETY + test enforcement</name>
  <files>components/dietary/AllergenBanner.tsx, components/dietary/index.ts, lib/__tests__/allergen-banner.test.ts</files>
  <read_first>
    - .planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md (section "Bandeau conflit recette" lignes ~130-145 et "Copywriting Contract")
    - .planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md (Pattern 7 enforcement)
    - lib/dietary/types.ts
    - components/ui/CollapsibleSection.tsx (pour les lignes non-allergie expandables)
    - contexts/ThemeContext.tsx (useThemeColors API)
  </read_first>
  <behavior>
    - Test 1 (statique TS) : `type HasDismiss = 'onDismiss' extends keyof AllergenBannerProps ? true : false;` → doit s'assigner à `false`. Si quelqu'un ajoute `onDismiss?: () => void`, le test compile échoue.
    - Test 2 (statique TS) : même check pour `onClose` et `dismissible`
    - Test 3 (runtime) : `React.renderToString(<AllergenBanner conflicts={[]} />)` retourne une chaîne vide (bandeau absent si pas de conflits)
    - Test 4 (runtime) : avec 1 conflit allergie, le rendu contient le texte copywrite "Allergie :" et le nom du profil
    - Test 5 : la prop `conflicts` est typée `DietaryConflict[]` (jamais undefined) — vérifier par TS
  </behavior>
  <action>
    1. Créer `components/dietary/AllergenBanner.tsx` :

    ```typescript
    import React from 'react';
    import { View, Text, StyleSheet } from 'react-native';
    import type { DietaryConflict } from '../../lib/dietary/types';
    import { useThemeColors } from '../../contexts/ThemeContext';
    import { Spacing, Radius } from '../../constants/spacing'; // vérifier imports réels
    import { FontSize, FontWeight } from '../../constants/typography';
    import { CollapsibleSection } from '../ui/CollapsibleSection';

    /**
     * P0 SAFETY (PREF-11) : ce composant n'expose JAMAIS de prop dismiss.
     * Toute PR ajoutant onDismiss / onClose / dismissible doit être rejetée.
     * Enforcement : pointerEvents='none' sur le container + test statique
     * lib/__tests__/allergen-banner.test.ts qui vérifie l'absence de ces clés.
     */
    export interface AllergenBannerProps {
      conflicts: DietaryConflict[];
      // ⚠ AUCUNE prop onDismiss / onClose / dismissible — PREF-11 P0 SAFETY
    }

    export function AllergenBanner({ conflicts }: AllergenBannerProps) {
      const colors = useThemeColors();
      if (conflicts.length === 0) return null;

      const allergyConflicts = conflicts.filter(c => c.severity === 'allergie');
      const intoleranceConflicts = conflicts.filter(c => c.severity === 'intolerance');
      const preferenceConflicts = conflicts.filter(c => c.severity === 'regime' || c.severity === 'aversion');

      return (
        <View pointerEvents="none" style={{ marginBottom: Spacing['2xl'] }}>
          {/* Ligne allergie TOUJOURS rendue, non-collapsible, jamais enfant d'un CollapsibleSection */}
          {allergyConflicts.length > 0 && (
            <View style={{
              backgroundColor: colors.errorBg,
              borderLeftWidth: 3,
              borderLeftColor: colors.error,
              borderRadius: Radius.lg,
              padding: Spacing.xl,
              marginBottom: Spacing.md,
            }}>
              <Text style={{ color: colors.errorText, fontSize: FontSize.body, fontWeight: FontWeight.semibold }}>
                {`Allergie : ${allergyConflicts.map(c => c.matchedAllergen).join(', ')} — Risque vital pour ${allergyConflicts[0].profileNames.join(', ')}`}
              </Text>
            </View>
          )}

          {/* Ligne intolérance : non-collapsible si allergie présente, collapsible sinon */}
          {intoleranceConflicts.length > 0 && (
            <View style={{ backgroundColor: colors.warningBg, borderRadius: Radius.lg, padding: Spacing.xl, marginBottom: Spacing.md }}>
              <Text style={{ color: colors.warningText, fontSize: FontSize.body }}>
                {`Intolérance : ${intoleranceConflicts.map(c => c.matchedAllergen).join(', ')} — Inconfort pour ${intoleranceConflicts[0].profileNames.join(', ')}`}
              </Text>
            </View>
          )}

          {/* Ligne régime/aversion */}
          {preferenceConflicts.length > 0 && (
            <View style={{ backgroundColor: colors.infoBg ?? colors.tagMention, borderRadius: Radius.lg, padding: Spacing.xl }}>
              <Text style={{ color: colors.info ?? colors.tagMentionText, fontSize: FontSize.body }}>
                {`Régime / Aversion : ${preferenceConflicts.map(c => c.matchedAllergen).join(', ')} — Préférence de ${preferenceConflicts[0].profileNames.join(', ')}`}
              </Text>
            </View>
          )}
        </View>
      );
    }
    ```

    Notes :
    - Vérifier les chemins réels d'import `Spacing`/`Radius`/`FontSize` dans le projet avant de finaliser
    - Si `colors.infoBg` n'existe pas, utiliser `colors.tagMention` + `colors.tagMentionText` (per pitfall 7 RESEARCH)
    - AUCUN hardcoded hex
    - Copywrite EXACT per UI-SPEC lignes 176-178

    2. Créer `components/dietary/index.ts` :
    ```typescript
    export { AllergenBanner } from './AllergenBanner';
    export type { AllergenBannerProps } from './AllergenBanner';
    ```

    3. Créer `lib/__tests__/allergen-banner.test.ts` :
    ```typescript
    import type { AllergenBannerProps } from '../../components/dietary/AllergenBanner';

    describe('AllergenBanner P0 SAFETY (PREF-11)', () => {
      it("AllergenBannerProps n'expose pas de prop 'onDismiss'", () => {
        type HasDismiss = 'onDismiss' extends keyof AllergenBannerProps ? true : false;
        const check: HasDismiss = false; // si ceci ne compile pas, c'est que onDismiss a été ajouté
        expect(check).toBe(false);
      });

      it("AllergenBannerProps n'expose pas de prop 'onClose'", () => {
        type HasClose = 'onClose' extends keyof AllergenBannerProps ? true : false;
        const check: HasClose = false;
        expect(check).toBe(false);
      });

      it("AllergenBannerProps n'expose pas de prop 'dismissible'", () => {
        type HasDismissible = 'dismissible' extends keyof AllergenBannerProps ? true : false;
        const check: HasDismissible = false;
        expect(check).toBe(false);
      });
    });
    ```
  </action>
  <verify>
    <automated>npx jest lib/__tests__/allergen-banner.test.ts &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `components/dietary/AllergenBanner.tsx` existe
    - `grep -q "export interface AllergenBannerProps" components/dietary/AllergenBanner.tsx`
    - `grep -qE "onDismiss|onClose|dismissible" components/dietary/AllergenBanner.tsx` doit retourner UNIQUEMENT des commentaires interdisant ces props (vérifier manuellement que ces mots n'apparaissent pas dans la définition du type)
    - `grep -q 'pointerEvents="none"' components/dietary/AllergenBanner.tsx`
    - `grep -q "colors.errorBg" components/dietary/AllergenBanner.tsx`
    - `grep -q "borderLeftColor: colors.error" components/dietary/AllergenBanner.tsx`
    - `grep -q "Risque vital pour" components/dietary/AllergenBanner.tsx` (copywrite PREF-11)
    - Pas de hex hardcoded : `! grep -qE "#[0-9A-Fa-f]{3,}" components/dietary/AllergenBanner.tsx`
    - `components/dietary/index.ts` exporte `AllergenBanner`
    - `npx jest lib/__tests__/allergen-banner.test.ts` : 3 tests passent
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Composant P0 SAFETY créé, enforcement test-driven, 3 tests statiques bloquent l'ajout futur de dismiss</done>
</task>

</tasks>

<verification>
- Test statique empêche l'ajout futur de `onDismiss`/`onClose`/`dismissible`
- `pointerEvents='none'` présent sur le container
- Couleurs via `useThemeColors()`, zéro hex hardcoded
- Copywrite exact conforme à UI-SPEC lignes 176-178
</verification>

<success_criteria>
Le Plan 06 (intégration RecipeViewer) peut importer `<AllergenBanner conflicts={...} />` sans avoir besoin d'ajouter de prop supplémentaire. PREF-11 est contractualisé architecturalement.
</success_criteria>

<output>
`.planning/phases/15-pr-f-rences-alimentaires/15-04-SUMMARY.md`
</output>
