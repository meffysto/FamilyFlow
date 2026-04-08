---
phase: 15-pr-f-rences-alimentaires
plan: 05
type: execute
wave: 3
depends_on: [15-01, 15-02, 15-04]
files_modified:
  - hooks/useVaultDietary.ts
  - contexts/VaultContext.tsx
  - hooks/useVault.ts
  - app/dietary.tsx
  - components/dietary/ProfileFoodCard.tsx
  - components/dietary/DietaryAutocomplete.tsx
  - components/dietary/index.ts
  - app/(tabs)/more.tsx
autonomous: false
requirements: [PREF-02, PREF-04, PREF-06, PREF-07, ARCH-04]

must_haves:
  truths:
    - "L'utilisateur peut ouvrir l'écran Préférences alimentaires depuis more.tsx"
    - "L'écran liste tous les membres famille puis une section 'Invités récurrents'"
    - "Chaque profil expose 4 sections pliables : Allergies / Intolérances / Régimes / Aversions"
    - "L'utilisateur peut ajouter une préférence via autocomplete (allergies/intolérances/régimes) ou texte libre (aversions)"
    - "L'utilisateur peut supprimer une préférence via swipe-to-delete (ReanimatedSwipeable)"
    - "L'utilisateur peut créer/modifier/supprimer un invité récurrent"
    - "Les préférences famille sont persistées dans famille.md via food_* CSV"
    - "Les invités sont persistés dans 02 - Famille/Invités.md"
    - "useVaultDietary est un domain hook séparé — useVaultProfiles n'inflate pas (ARCH-04)"
  artifacts:
    - path: "hooks/useVaultDietary.ts"
      provides: "Domain hook CRUD préférences famille + invités"
      exports: ["useVaultDietary"]
    - path: "app/dietary.tsx"
      provides: "Écran Préférences alimentaires (nouvel écran)"
    - path: "components/dietary/ProfileFoodCard.tsx"
      provides: "Card profil avec 4 CollapsibleSection"
      exports: ["ProfileFoodCard"]
    - path: "components/dietary/DietaryAutocomplete.tsx"
      provides: "TextInput + dropdown catalogue"
      exports: ["DietaryAutocomplete"]
  key_links:
    - from: "app/dietary.tsx"
      to: "hooks/useVaultDietary"
      via: "useVault() → dietary slice"
      pattern: "useVault\\(\\)\\.(dietary|updateFoodPreferences)"
    - from: "app/(tabs)/more.tsx"
      to: "app/dietary.tsx"
      via: "router.push('/dietary')"
      pattern: "route:.*'/dietary'"
    - from: "hooks/useVaultDietary.ts"
      to: "lib/parser.ts"
      via: "parseInvites / serializeInvites"
      pattern: "parseInvites|serializeInvites"
---

<objective>
Livrer l'écran `Préférences alimentaires` et son domain hook `useVaultDietary`. CRUD complet pour les préférences des membres famille et pour les invités récurrents. Point d'entrée via `more.tsx`.

Purpose: Point d'entrée utilisateur principal de la feature. Assemble tout ce qui a été construit en Waves 1-2.
Output: Nouvel écran + hook domain + 2 composants UI + entrée dans more.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md
@.planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md
@.planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md
@lib/dietary/types.ts
@lib/dietary/catalogs.ts
@components/ui/CollapsibleSection.tsx
@components/ui/Chip.tsx
@components/ui/Button.tsx
@hooks/useVaultProfiles.ts
@app/(tabs)/wishlist.tsx
@app/(tabs)/more.tsx
@CLAUDE.md

<interfaces>
<!-- Contracts available from previous plans -->
From lib/dietary/types.ts: DietarySeverity, DietaryItem, GuestProfile
From lib/dietary/catalogs.ts: EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES, findCatalogForSeverity
From lib/parser.ts: parseFamille (étendu), parseInvites, serializeInvites, INVITES_FILE, FAMILLE_FILE
From lib/types.ts Profile: foodAllergies?, foodIntolerances?, foodRegimes?, foodAversions?

<!-- Pattern domain hook existant -->
From hooks/useVaultProfiles.ts : updateProfile(profileId, updates) à la ligne 301 — préserve les clés file-by-file via approche ligne-par-ligne. Les food_* doivent être lues à la volée.

<!-- Pattern wishlist pour invités -->
From app/(tabs)/wishlist.tsx : modèle CRUD dédié avec load/save/delete sur un fichier vault unique.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tâche 1: Domain hook useVaultDietary + intégration VaultContext/useVault</name>
  <files>hooks/useVaultDietary.ts, hooks/useVault.ts, contexts/VaultContext.tsx</files>
  <read_first>
    - hooks/useVaultProfiles.ts (pattern updateProfile, VaultManager usage)
    - hooks/useVault.ts (structure useVaultInternal, composition des domain hooks)
    - contexts/VaultContext.tsx (type VaultState exposé)
    - lib/famille-queue.ts si existe (enqueueWrite pattern)
    - lib/parser.ts (parseFamille, parseInvites, INVITES_FILE, FAMILLE_FILE)
  </read_first>
  <action>
    1. Créer `hooks/useVaultDietary.ts` — domain hook dédié (ARCH-04 : ne pas inflater useVaultProfiles) exposant :

    ```typescript
    export interface VaultDietaryState {
      guests: GuestProfile[];
      reloadGuests: () => Promise<void>;
      updateFoodPreferences: (
        profileId: string,
        category: 'allergies' | 'intolerances' | 'regimes' | 'aversions',
        items: string[],
      ) => Promise<void>;
      upsertGuest: (guest: GuestProfile) => Promise<void>;
      deleteGuest: (guestId: string) => Promise<void>;
    }

    export function useVaultDietary(vaultRef, profiles, reloadProfiles): VaultDietaryState { ... }
    ```

    Implémentation :
    - `updateFoodPreferences` : lit le fichier `FAMILLE_FILE` frais, trouve la section `### {profileId}`, met à jour la clé `food_{category}` (CSV join), écrit via vaultRef.writeFile. Si `items.length === 0`, supprimer la ligne. Utiliser `enqueueWrite` si disponible (cohérent avec pattern 260403-q6y). Après l'écriture, déclencher `reloadProfiles()` pour synchroniser le state.
    - `reloadGuests` : lit `INVITES_FILE`, appelle `parseInvites(content)`, stocke dans un useState local
    - `upsertGuest` : charge tous les invités, remplace/ajoute, serialize via `serializeInvites`, écrit, reloadGuests
    - `deleteGuest` : même pattern
    - Au mount, `useEffect(() => { reloadGuests(); }, [])`

    2. Dans `hooks/useVault.ts`, initialiser `const dietaryHook = useVaultDietary(vaultRef, profilesHook.profiles, profilesHook.reloadProfiles)` APRÈS `profilesHook` (cohérent avec pattern quêtes 15-01 : init ordering). Ajouter `dietary: dietaryHook` dans le retour.

    3. Dans `contexts/VaultContext.tsx`, étendre `VaultState` :
    ```typescript
    dietary: {
      guests: GuestProfile[];
      updateFoodPreferences: (...);
      upsertGuest: (...);
      deleteGuest: (...);
      reloadGuests: (...);
    };
    ```

    Commentaires en français. Aucun hardcoded hex. Erreurs via `Alert.alert` en français, `console.warn` sous `if (__DEV__)`.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function useVaultDietary" hooks/useVaultDietary.ts`
    - `grep -q "updateFoodPreferences" hooks/useVaultDietary.ts`
    - `grep -q "upsertGuest" hooks/useVaultDietary.ts`
    - `grep -q "parseInvites\|serializeInvites" hooks/useVaultDietary.ts`
    - `grep -q "useVaultDietary" hooks/useVault.ts`
    - `grep -q "dietary:" contexts/VaultContext.tsx` (dans VaultState)
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Domain hook créé, exposé via VaultContext, tsc passe, CRUD pur fonctionnel</done>
</task>

<task type="auto">
  <name>Tâche 2: Écran app/dietary.tsx + composants ProfileFoodCard + DietaryAutocomplete + lien more.tsx</name>
  <files>app/dietary.tsx, components/dietary/ProfileFoodCard.tsx, components/dietary/DietaryAutocomplete.tsx, components/dietary/index.ts, app/(tabs)/more.tsx</files>
  <read_first>
    - .planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md (sections "Écran principal" + "Autocomplete dropdown" + "Copywriting Contract" + "Interaction Contracts")
    - app/(tabs)/wishlist.tsx (pattern CRUD écran avec ReanimatedSwipeable)
    - components/ui/CollapsibleSection.tsx (API)
    - components/ui/Chip.tsx (API)
    - components/ui/Button.tsx (API)
    - components/ui/ModalHeader.tsx
    - app/(tabs)/more.tsx lignes 119-149 (pattern ajout d'un item)
    - contexts/ThemeContext.tsx
  </read_first>
  <action>
    1. Créer `components/dietary/DietaryAutocomplete.tsx` :
    - Props : `{ severity: DietarySeverity; value: string; onChange: (v: string) => void; onSubmit: (item: string) => void; }`
    - Utilise `findCatalogForSeverity(severity)` pour obtenir le catalogue
    - TextInput avec dropdown : filtre live sur `label` normalisé (lowercase+accents). Max 5 items visibles.
    - Tap sur item → appelle `onSubmit(item.id)` + Haptics.selectionAsync + vide le TextInput
    - Touche Entrée ou valeur hors catalogue + submit → `onSubmit(value.trim())` (texte libre)
    - Aversion : pas de dropdown, texte libre uniquement
    - `accessibilityRole="list"` sur le container du dropdown, `accessibilityRole="button"` sur chaque item
    - Placeholder per UI-SPEC ligne 181-184 : "14 allergènes UE" / "Intolérance courante…" / "Végétarien, halal…" / "Texte libre…"

    2. Créer `components/dietary/ProfileFoodCard.tsx` :
    - Props : `{ profile: Profile | GuestProfile; onUpdate: (category, items) => void; onDelete?: () => void; }`
    - Row avatar (si Profile) + nom
    - 4× `<CollapsibleSection title="Allergies|Intolérances|Régimes alimentaires|Aversions">` per D-04, UI-SPEC labels
    - Dans chaque section : rangée de `Chip` existants pour les items actuels. Chaque Chip est enveloppé dans `ReanimatedSwipeable` (import `react-native-gesture-handler/ReanimatedSwipeable`) qui révèle un bouton "Supprimer" rouge à swipe gauche → appelle `onUpdate(cat, items.filter(i => i !== chipItem))` + `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`
    - Bas de chaque section : `<DietaryAutocomplete severity={...} ... />` + bouton "+" avec `accessibilityLabel="Ajouter une préférence alimentaire"`
    - Empty state dans section fermée : "Aucune allergie enregistrée — appuyez + pour ajouter"
    - `React.memo` sur le composant
    - `useCallback` sur les handlers

    3. Créer `app/dietary.tsx` :
    - `useVault()` → récupère `profiles` et `dietary` (guests, updateFoodPreferences, upsertGuest, deleteGuest)
    - `ScrollView` avec `contentContainerStyle` contenant :
      - Header : titre "Préférences alimentaires" + bouton micro (DictaphoneRecorder zone — STUB pour cette tâche, sera câblé en Plan 07) : accepter un TODO `{/* PREF-13 voice input — Plan 07 */}`
      - Section "Membres de la famille" : map sur `profiles` → `<ProfileFoodCard profile={p} onUpdate={(cat, items) => dietary.updateFoodPreferences(p.id, cat, items)} />`
      - Séparateur `Spacing['4xl']`
      - Section "Invités récurrents" : map sur `dietary.guests` → `<ProfileFoodCard profile={g} onUpdate={(cat, items) => dietary.upsertGuest({...g, ['food'+Cat]: items})} onDelete={() => Alert.alert('Supprimer ' + g.name + ' ?', ..., [{ text: 'Ne pas supprimer' }, { text: 'Supprimer', style: 'destructive', onPress: () => dietary.deleteGuest(g.id) }])} />`
      - Empty invités : "Aucun invité récurrent enregistré" + `<Button>Ajouter un invité</Button>` (ouvre simple `Alert.prompt` pour le nom, puis appelle `upsertGuest({ id: slug, name, foodAllergies: [], ...}`))
    - `useThemeColors()` pour toutes les couleurs
    - `SectionErrorBoundary` autour de chaque section famille / invités
    - Styles statiques : `StyleSheet.create` en bas de fichier
    - Pas de hex hardcoded
    - `accessibilityLabel` descriptifs

    4. Barrel `components/dietary/index.ts` : ajouter `ProfileFoodCard` et `DietaryAutocomplete` aux exports (ne pas supprimer AllergenBanner du Plan 04).

    5. Dans `app/(tabs)/more.tsx`, ajouter une entrée dans le tableau `items` (ligne ~119, chercher pattern existant) :
    ```typescript
    { emoji: '🥗', label: 'Préférences alimentaires', route: '/dietary', color: colors.catOrganisation, category: 'organisation' as const },
    ```
    Respecter la structure existante du tableau (ne pas casser les autres items).

    Contraintes projet (CLAUDE.md) :
    - useThemeColors() obligatoire — jamais de hex
    - ReanimatedSwipeable (pas Swipeable)
    - Spring config constante module si animations
    - Haptics.selectionAsync / Haptics.impactAsync
    - Commentaires FR
    - React.memo sur les list items
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Tous les 5 fichiers existent
    - `grep -q "Préférences alimentaires" app/dietary.tsx`
    - `grep -q "Membres de la famille" app/dietary.tsx`
    - `grep -q "Invités récurrents" app/dietary.tsx`
    - `grep -q "ReanimatedSwipeable" components/dietary/ProfileFoodCard.tsx`
    - `grep -q "CollapsibleSection" components/dietary/ProfileFoodCard.tsx`
    - `grep -q "findCatalogForSeverity\|EU_ALLERGENS" components/dietary/DietaryAutocomplete.tsx`
    - `grep -q "accessibilityLabel" components/dietary/ProfileFoodCard.tsx`
    - `grep -q "/dietary" app/\(tabs\)/more.tsx` OR `grep -q "Préférences alimentaires" app/\(tabs\)/more.tsx`
    - `grep -q "useThemeColors" app/dietary.tsx`
    - Pas de hex hardcoded : `! grep -qE "#[0-9A-Fa-f]{3,}" app/dietary.tsx components/dietary/ProfileFoodCard.tsx components/dietary/DietaryAutocomplete.tsx`
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Écran fonctionnel, CRUD famille+invités opérationnel, lien more.tsx ajouté, tsc passe</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Tâche 3: Checkpoint visuel écran dietary.tsx</name>
  <files>(checkpoint — verification manuelle)</files>
  <action>Checkpoint utilisateur : voir &lt;what-built&gt; et &lt;how-to-verify&gt; ci-dessous pour les étapes de vérification visuelle.</action>
  <verify>Vérification manuelle selon &lt;how-to-verify&gt;</verify>
  <done>L'utilisateur a tapé "approuvé" dans &lt;resume-signal&gt;</done>
  <what-built>
    - Nouvel écran `Préférences alimentaires` accessible via more.tsx → "Préférences alimentaires"
    - Liste des membres famille avec 4 sections pliables (Allergies / Intolérances / Régimes / Aversions)
    - Autocomplete sur allergies/intolérances/régimes, texte libre sur aversions
    - Section "Invités récurrents" avec bouton "Ajouter un invité"
    - Swipe-to-delete sur les chips de préférences
  </what-built>
  <how-to-verify>
    1. Lancer `npx expo run:ios --device`
    2. Naviguer vers l'onglet "Plus" → "🥗 Préférences alimentaires"
    3. Vérifier que l'écran s'ouvre avec le titre correct
    4. Déplier "Allergies" sous le premier profil famille → taper dans le TextInput → vérifier que le dropdown autocomplete apparaît avec des allergènes UE
    5. Sélectionner "Gluten" → un Chip apparaît dans la section
    6. Swipe-gauche sur le Chip → bouton "Supprimer" rouge → tap → le Chip disparaît avec un haptic feedback
    7. Vérifier que la modification persiste : quitter l'écran et revenir → le Chip ajouté est toujours là
    8. Vérifier le fichier `famille.md` dans le vault : la clé `food_allergies: gluten` est présente sous la section du profil modifié
    9. Tap "Ajouter un invité" → créer "Lucas" → vérifier que l'invité apparaît avec ses 4 sections
    10. Vérifier la création du fichier `02 - Famille/Invités.md` avec la section `## Lucas`
  </how-to-verify>
  <resume-signal>Tapez "approuvé" ou décrivez les problèmes observés</resume-signal>
</task>

</tasks>

<verification>
- Écran s'ouvre sans crash
- CRUD famille persiste dans famille.md
- CRUD invités persiste dans 02 - Famille/Invités.md
- useVaultProfiles n'a pas été gonflé (ARCH-04) — hook séparé `useVaultDietary`
- `npx tsc --noEmit` passe
</verification>

<success_criteria>
L'utilisateur a un endroit unique pour saisir toutes les préférences alimentaires de sa famille et des invités. Les données persistent en CSV dans famille.md et Invités.md.
</success_criteria>

<output>
`.planning/phases/15-pr-f-rences-alimentaires/15-05-SUMMARY.md`
</output>
