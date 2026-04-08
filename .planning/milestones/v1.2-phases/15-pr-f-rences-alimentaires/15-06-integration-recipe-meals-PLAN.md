---
phase: 15-pr-f-rences-alimentaires
plan: 06
type: execute
wave: 3
depends_on: [15-03, 15-04, 15-05]
files_modified:
  - components/RecipeViewer.tsx
  - components/dietary/ConvivesPickerModal.tsx
  - components/dietary/MealConflictRecap.tsx
  - components/dietary/index.ts
  - app/(tabs)/meals.tsx
autonomous: false
requirements: [PREF-08, PREF-10, PREF-11, PREF-12]

must_haves:
  truths:
    - "RecipeViewer affiche AllergenBanner en tête quand des conflits existent"
    - "Par défaut le calcul de conflits prend l'union des profils famille (pas d'invités)"
    - "Un bouton 'Vérifier les conflits pour…' ouvre une modale de sélection multiselect famille+invités"
    - "Chaque ingrédient conflictuel affiche un Badge inline à côté de son nom"
    - "Le planificateur de repas (meals.tsx) affiche un récap 'X allergies, Y intolérances' quand des conflits sont détectés"
    - "La modale sélecteur convives est volatile : aucune persistance dans le modèle meals (PREF-FUT-01 respecté)"
  artifacts:
    - path: "components/RecipeViewer.tsx"
      provides: "Intégration bandeau + badges inline + bouton ConvivesPicker"
    - path: "components/dietary/ConvivesPickerModal.tsx"
      provides: "Modal pageSheet multiselect famille+invités"
      exports: ["ConvivesPickerModal"]
    - path: "components/dietary/MealConflictRecap.tsx"
      provides: "Bandeau compact récap pour MealItem"
      exports: ["MealConflictRecap"]
  key_links:
    - from: "components/RecipeViewer.tsx"
      to: "components/dietary/AllergenBanner"
      via: "import et rendu en tête"
      pattern: "AllergenBanner"
    - from: "components/RecipeViewer.tsx"
      to: "lib/dietary checkAllergens"
      via: "appel avec profileIds par défaut = tous les profils famille"
      pattern: "checkAllergens"
    - from: "app/(tabs)/meals.tsx"
      to: "components/dietary/MealConflictRecap"
      via: "rendu en tête de chaque MealItem"
      pattern: "MealConflictRecap"
---

<objective>
Intégrer la détection de conflits dans les écrans consommateurs : RecipeViewer (bandeau + badges inline + bouton sélecteur convives) et meals.tsx (bandeau récap par repas). PREF-11 P0 SAFETY devient visible pour l'utilisateur.

Purpose: Le plan matérialise la valeur finale de la feature — l'app signale automatiquement les conflits.
Output: RecipeViewer modifié + 2 nouveaux composants + intégration meals.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md
@.planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md
@components/dietary/AllergenBanner.tsx
@lib/dietary.ts
@components/RecipeViewer.tsx
@app/(tabs)/meals.tsx
@components/ui/Badge.tsx
@components/ui/Chip.tsx
@components/ui/ModalHeader.tsx
@CLAUDE.md

<interfaces>
<!-- Contracts available -->
From components/dietary/AllergenBanner.tsx:
```typescript
export interface AllergenBannerProps { conflicts: DietaryConflict[]; }
export function AllergenBanner({ conflicts }: AllergenBannerProps): JSX.Element | null;
```

From lib/dietary.ts:
```typescript
export function checkAllergens(
  recipe: AppRecipe,
  profileIds: string[],
  allProfiles: Profile[],
  guests: GuestProfile[],
): DietaryConflict[];
```

From useVault().dietary (Plan 05): { guests, updateFoodPreferences, upsertGuest, deleteGuest }
From useVault(): profiles: Profile[]
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tâche 1: Intégration RecipeViewer + ConvivesPickerModal</name>
  <files>components/RecipeViewer.tsx, components/dietary/ConvivesPickerModal.tsx, components/dietary/index.ts</files>
  <read_first>
    - components/RecipeViewer.tsx (lire structure complète, identifier où les ingrédients sont rendus)
    - components/dietary/AllergenBanner.tsx
    - lib/dietary.ts (signature checkAllergens)
    - .planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md (section "Bandeau conflit recette" + "Modal sélecteur convives")
    - components/ui/ModalHeader.tsx
    - components/ui/Chip.tsx (prop selected)
    - hooks/useVault.ts (structure profiles + dietary.guests)
  </read_first>
  <action>
    1. Créer `components/dietary/ConvivesPickerModal.tsx` :
    ```typescript
    export interface ConvivesPickerModalProps {
      visible: boolean;
      onClose: () => void;
      onConfirm: (selectedProfileIds: string[], selectedGuestIds: string[]) => void;
      profiles: Profile[];
      guests: GuestProfile[];
      initialSelectedProfileIds?: string[];
      initialSelectedGuestIds?: string[];
    }
    ```
    - `Modal` React Native avec `presentationStyle="pageSheet"` + drag-to-dismiss natif iOS
    - ModalHeader avec titre "Vérifier les conflits" et bouton fermer
    - Deux sections "Famille" et "Invités", chacune une rangée de `Chip` multiselect
    - Footer sticky : `<Button variant="primary" label="Vérifier les convives">` qui appelle `onConfirm`
    - useThemeColors, pas de hex, commentaires FR

    2. Dans `components/RecipeViewer.tsx` :
    - Import `{ AllergenBanner } from './dietary'` + `{ ConvivesPickerModal } from './dietary'`
    - Import `{ checkAllergens } from '../lib/dietary'`
    - Import `{ Badge } from './ui/Badge'`
    - Ajouter des états locaux :
      ```typescript
      const { profiles, dietary } = useVault();
      const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(() => profiles.map(p => p.id)); // D-08 : union par défaut
      const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
      const [pickerVisible, setPickerVisible] = useState(false);
      const conflicts = useMemo(
        () => checkAllergens(recipe, [...selectedProfileIds, ...selectedGuestIds], profiles, dietary.guests.filter(g => selectedGuestIds.includes(g.id))),
        [recipe, selectedProfileIds, selectedGuestIds, profiles, dietary.guests],
      );
      ```
    - Rendre `<AllergenBanner conflicts={conflicts} />` en tête du body du RecipeViewer (AVANT la liste des ingrédients)
    - Juste sous le bandeau, un `<Button variant="outline" label="Vérifier les conflits pour…" onPress={() => setPickerVisible(true)} />`
    - Dans la liste des ingrédients existante, pour chaque ingredient, chercher si un conflit existe via `conflicts.find(c => c.ingredientName === ing.name)`. Si oui, afficher un `<Badge variant="sm">` à côté du nom avec le texte "⚠ {matchedAllergen}" (allergie) ou "{matchedAllergen}" (intolérance). Couleur via variant du Badge existant ou style inline avec tokens sémantiques.
    - Modal `<ConvivesPickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} onConfirm={(p, g) => { setSelectedProfileIds(p); setSelectedGuestIds(g); setPickerVisible(false); }} profiles={profiles} guests={dietary.guests} initialSelectedProfileIds={selectedProfileIds} initialSelectedGuestIds={selectedGuestIds} />`
    - NE PAS toucher le reste du RecipeViewer (édition, cooking mode, etc.)

    3. Mettre à jour `components/dietary/index.ts` pour exporter `ConvivesPickerModal`.

    Contraintes : useThemeColors, pas de hex hardcoded, commentaires FR, `useMemo`/`useCallback` sur les handlers passés.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "AllergenBanner" components/RecipeViewer.tsx`
    - `grep -q "checkAllergens" components/RecipeViewer.tsx`
    - `grep -q "ConvivesPickerModal" components/RecipeViewer.tsx`
    - `grep -q 'label="Vérifier les conflits pour…"' components/RecipeViewer.tsx` OR `grep -q "Vérifier les conflits pour" components/RecipeViewer.tsx`
    - `grep -q "profiles.map(p => p.id)" components/RecipeViewer.tsx` (D-08 union par défaut)
    - `components/dietary/ConvivesPickerModal.tsx` existe
    - `grep -q 'presentationStyle="pageSheet"' components/dietary/ConvivesPickerModal.tsx`
    - `grep -q "Vérifier les convives" components/dietary/ConvivesPickerModal.tsx`
    - `! grep -qE "#[0-9A-Fa-f]{3,}" components/dietary/ConvivesPickerModal.tsx`
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>RecipeViewer affiche bandeau + badges + bouton picker, modal multiselect fonctionnelle</done>
</task>

<task type="auto">
  <name>Tâche 2: Récap planificateur meals.tsx (PREF-12)</name>
  <files>components/dietary/MealConflictRecap.tsx, components/dietary/index.ts, app/(tabs)/meals.tsx</files>
  <read_first>
    - app/(tabs)/meals.tsx (structure du rendu des MealItem, identifier où ajouter le bandeau compact — recherche `MealItem` et renderItem)
    - lib/dietary.ts
    - components/dietary/AllergenBanner.tsx (pour réutiliser les couleurs sémantiques)
    - .planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md (ligne 191 : "X allergie(s), Y intolérance(s) pour les convives sélectionnés")
  </read_first>
  <action>
    1. Créer `components/dietary/MealConflictRecap.tsx` :
    ```typescript
    export interface MealConflictRecapProps {
      conflicts: DietaryConflict[];
      onPress?: () => void; // drill-down optionnel — ouvre AllergenBanner ou le RecipeViewer
    }

    export const MealConflictRecap = React.memo(function MealConflictRecap({ conflicts, onPress }: MealConflictRecapProps) {
      const colors = useThemeColors();
      if (conflicts.length === 0) return null;
      const allergies = conflicts.filter(c => c.severity === 'allergie').length;
      const intolerances = conflicts.filter(c => c.severity === 'intolerance').length;
      const preferences = conflicts.filter(c => c.severity === 'regime' || c.severity === 'aversion').length;

      const bgColor = allergies > 0 ? colors.errorBg : intolerances > 0 ? colors.warningBg : (colors.infoBg ?? colors.tagMention);
      const textColor = allergies > 0 ? colors.errorText : intolerances > 0 ? colors.warningText : (colors.info ?? colors.tagMentionText);

      return (
        <Pressable onPress={onPress} style={{ backgroundColor: bgColor, padding: Spacing.md, borderRadius: Radius.xs, marginBottom: Spacing.md }}>
          <Text style={{ color: textColor, fontSize: FontSize.label }}>
            {`${allergies} allergie(s), ${intolerances} intolérance(s) pour les convives sélectionnés`}
          </Text>
        </Pressable>
      );
    });
    ```
    - Copywrite exact per UI-SPEC ligne 191
    - `React.memo` car il apparaît dans une liste

    2. Dans `app/(tabs)/meals.tsx` :
    - Import `{ MealConflictRecap } from '../../components/dietary'`
    - Import `{ checkAllergens } from '../../lib/dietary'`
    - Dans le renderItem d'un MealItem (repérer dans le fichier — probablement une section `renderMealItem` ou dans le JSX map), si le `MealItem` a une `recipe` associée, calculer `const mealConflicts = useMemo(() => recipe ? checkAllergens(recipe, profiles.map(p => p.id), profiles, dietary.guests) : [], [recipe, profiles, dietary.guests]);` et rendre `<MealConflictRecap conflicts={mealConflicts} />` AU-DESSUS du contenu principal de l'item
    - IMPORTANT : si le renderItem ne peut pas contenir de hook (list render), créer un sous-composant `MealItemWithRecap` qui encapsule le hook et le MealConflictRecap
    - Ne PAS muter le modèle `MealItem` (PREF-FUT-01 hors scope)

    3. Mettre à jour `components/dietary/index.ts` pour exporter `MealConflictRecap`.

    Contraintes : useThemeColors, hex interdit, commentaires FR, React.memo.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `components/dietary/MealConflictRecap.tsx` existe
    - `grep -q "React.memo" components/dietary/MealConflictRecap.tsx`
    - `grep -q "allergie(s)" components/dietary/MealConflictRecap.tsx`
    - `grep -q "MealConflictRecap" app/\(tabs\)/meals.tsx`
    - `grep -q "checkAllergens" app/\(tabs\)/meals.tsx`
    - `! grep -qE "#[0-9A-Fa-f]{3,}" components/dietary/MealConflictRecap.tsx`
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Récap visible dans le planificateur de repas pour chaque MealItem avec recipe</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Tâche 3: Checkpoint visuel PREF-11 P0 SAFETY end-to-end</name>
  <files>(checkpoint — verification manuelle)</files>
  <action>Checkpoint utilisateur : voir &lt;what-built&gt; et &lt;how-to-verify&gt; ci-dessous pour les étapes de vérification visuelle.</action>
  <verify>Vérification manuelle selon &lt;how-to-verify&gt;</verify>
  <done>L'utilisateur a tapé "approuvé" dans &lt;resume-signal&gt;</done>
  <what-built>
    - Bandeau allergie rouge en tête du RecipeViewer (PREF-11)
    - Badges inline à côté des ingrédients conflictuels
    - Bouton "Vérifier les conflits pour…" ouvrant la modal multiselect
    - Récap compact sur les MealItem du planificateur
  </what-built>
  <how-to-verify>
    1. Lancer `npx expo run:ios --device`
    2. Préparer : via l'écran Préférences alimentaires (Plan 05), ajouter "arachides" dans les allergies d'un profil famille
    3. Ouvrir une recette qui contient "cacahuètes" ou "arachides" dans ses ingrédients (ou en ajouter une temporairement dans le vault)
    4. Vérifier en tête de la recette : bandeau ROUGE avec texte "Allergie : arachides — Risque vital pour [Prénom]"
    5. Tenter de swipe le bandeau vers la gauche ou la droite → le bandeau NE bouge PAS (pointerEvents='none')
    6. Tenter de trouver un bouton X ou "Fermer" sur le bandeau → il N'Y EN A AUCUN (PREF-11 P0 SAFETY)
    7. Vérifier qu'un badge inline rouge apparaît à côté de l'ingrédient "cacahuètes" dans la liste
    8. Tap sur "Vérifier les conflits pour…" → modal pageSheet s'ouvre avec drag-to-dismiss
    9. Cocher un invité ayant lui aussi une allergie → confirmer → le bandeau se met à jour avec les deux prénoms
    10. Aller dans l'onglet Repas / Planning : un MealItem avec une recette problématique affiche le récap compact "X allergie(s), Y intolérance(s)"
    11. Vérifier dans le code du bandeau : `grep -rE "onDismiss|onClose|dismissible" components/dietary/AllergenBanner.tsx` ne retourne QUE des commentaires interdisant ces props
  </how-to-verify>
  <resume-signal>Tapez "approuvé" après avoir confirmé que le bandeau allergie est non-dismissible ET que toute la chaîne fonctionne</resume-signal>
</task>

</tasks>

<verification>
- `npx jest lib/__tests__/allergen-banner.test.ts` passe toujours
- `npx tsc --noEmit` passe
- Test manuel : bandeau allergie résistant à tous les gestes utilisateur
- PREF-11 P0 SAFETY validé end-to-end
</verification>

<success_criteria>
La valeur finale de la phase est livrée : la famille ouvre une recette et voit immédiatement les conflits, avec le bandeau allergie non-dismissible en tête. Le planificateur de repas affiche un récap.
</success_criteria>

<output>
`.planning/phases/15-pr-f-rences-alimentaires/15-06-SUMMARY.md`
</output>
