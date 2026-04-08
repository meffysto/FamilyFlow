---
phase: 15-pr-f-rences-alimentaires
plan: "05"
subsystem: dietary
tags: [hooks, ui, crud, dietary, preferences, guests]
dependency_graph:
  requires:
    - 15-01 (lib/dietary/types.ts, lib/dietary/catalogs.ts)
    - 15-02 (parseInvites, serializeInvites, parseFamille food_* keys)
    - 15-04 (components/dietary/AllergenBanner.tsx, index.ts)
  provides:
    - hooks/useVaultDietary.ts
    - app/dietary.tsx
    - components/dietary/ProfileFoodCard.tsx
    - components/dietary/DietaryAutocomplete.tsx
  affects:
    - hooks/useVault.ts (VaultState + dietaryHook init)
    - contexts/VaultContext.tsx (via useVault.ts re-export)
    - app/(tabs)/more.tsx (entrée navigation ajoutée)
    - components/dietary/index.ts (barrel étendu)
tech_stack:
  added: []
  patterns:
    - "domain hook séparé (ARCH-04) : useVaultDietary distinct de useVaultProfiles"
    - "enqueueWrite pour updateFoodPreferences (cohérence pattern 260403-q6y)"
    - "ReanimatedSwipeable swipe-to-delete avec Haptics.impactAsync(Medium)"
    - "useSharedValue + withSpring pour apparition chips (SPRING_CONFIG damping:15 stiffness:200)"
    - "CollapsibleSection 4× par profil avec état persisté SecureStore"
    - "DietaryAutocomplete : filtre live normalisé (NFD + lowercase), max 5 items"
key_files:
  created:
    - hooks/useVaultDietary.ts
    - app/dietary.tsx
    - components/dietary/ProfileFoodCard.tsx
    - components/dietary/DietaryAutocomplete.tsx
  modified:
    - hooks/useVault.ts
    - components/dietary/index.ts
    - app/(tabs)/more.tsx
decisions:
  - "refreshGamification() utilisé comme reloadProfiles — re-lit famille.md et synchro tous les profils"
  - "getItems() cast via GuestProfile (commun à Profile et GuestProfile) pour éviter Record<string,unknown>"
  - "deleteActionText couleur via colors.onPrimary (pas de hex hardcodé)"
  - "SectionErrorBoundary avec prop name obligatoire — famille / invités"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-04-07"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 7
---

# Phase 15 Plan 05: Hook + Écran Préférences alimentaires — Summary

Domain hook `useVaultDietary` (CRUD préférences famille + invités) + écran `dietary.tsx` avec `ProfileFoodCard` et `DietaryAutocomplete`, accessible depuis `more.tsx`.

## What Was Built

### Tâche 1 — Domain hook useVaultDietary + intégration VaultContext

**Fichier créé :** `hooks/useVaultDietary.ts`

- `updateFoodPreferences(profileId, category, items)` : lit famille.md frais, trouve la section `### {profileId}`, met à jour/supprime la clé `food_{category}`, écrit via `enqueueWrite`, appelle `reloadProfiles` (refreshGamification) pour synchroniser React state
- `reloadGuests()` : lit `INVITES_FILE`, parse via `parseInvites`, stocke dans state local
- `upsertGuest(guest)` : charge/remplace/ajoute dans Invités.md, écrit via `serializeInvites`
- `deleteGuest(guestId)` : filtre et réécrit Invités.md
- Au mount : `useEffect` charge les invités automatiquement

**Modifications `hooks/useVault.ts` :**
- Import de `useVaultDietary` et `VaultDietaryState`
- Initialisation `dietaryHook` après `profilesHook` (ARCH-04 : ordre correct)
- Extension `VaultState` avec champ `dietary: VaultDietaryState`
- Ajout `dietary: dietaryHook` dans le `useMemo` retourné

### Tâche 2 — Écran + composants UI

**`components/dietary/DietaryAutocomplete.tsx`**
- Props : `{ severity, value, onChange, onSubmit }`
- Filtre live sur le catalogue (`findCatalogForSeverity(severity)`) via normalisation NFD
- Max 5 suggestions, `accessibilityRole="list"` / `"button"`
- Haptic `selectionAsync` à la sélection, texte libre sur Entrée
- Aversions : aucun catalogue — texte libre uniquement (retour `[]`)
- Placeholders per UI-SPEC : "14 allergènes UE" / "Intolérance courante…" / "Végétarien, halal…" / "Texte libre…"

**`components/dietary/ProfileFoodCard.tsx`**
- `React.memo` sur le composant principal et les sous-composants
- 4 `<CollapsibleSection>` par profil (id unique `dietary-{profileId}-{category}`)
- Chips avec animation spring (scale 0.8→1.0, SPRING_CONFIG)
- `ReanimatedSwipeable` avec renderRightActions rouge → Haptics.impactAsync(Medium)
- `DietaryAutocomplete` + bouton "+" (44px touch target, `accessibilityLabel="Ajouter une préférence alimentaire"`)
- Avatar profil si disponible, placeholder initiale sinon
- Bouton suppression invité avec `Alert.alert` confirmation (UI-SPEC)

**`app/dietary.tsx`**
- `useVault()` → `profiles` + `dietary`
- `ScrollView` avec header (titre + retour + stub PREF-13)
- Section "Membres de la famille" + Section "Invités récurrents"
- `SectionErrorBoundary` autour de chaque section
- `Alert.prompt` pour créer un invité (génère ID stable via slugify)
- Zéro hex hardcodé, `useThemeColors()` partout

**`app/(tabs)/more.tsx`** : entrée `{ emoji: '🥗', label: 'Préférences alimentaires', route: '/dietary', ... }`

**`components/dietary/index.ts`** : exports `ProfileFoodCard`, `DietaryAutocomplete` ajoutés

## Deviations from Plan

### Auto-approvals (--auto mode)

**Tâche 3 (checkpoint:human-verify)** : auto-approuvé en mode --auto.
- Ce qui a été construit est visuellement vérifiable en lançant `npx expo run:ios --device`
- Navigation : onglet "Plus" → "🥗 Préférences alimentaires"
- Le comportement attendu (autocomplete, swipe-delete, invités) est implémenté conformément à l'UI-SPEC

### Rule 1 — Bug auto-fixé

**Type error `getItems` cast via `Record<string, unknown>`** (trouvé lors de `tsc --noEmit`)
- Problème : `Profile | GuestProfile` n'est pas compatible avec `Record<string, unknown>` (GuestProfile sans index signature)
- Fix : cast via `GuestProfile` (le seul ancêtre commun pour les champs `food_*`) avec typage strict
- Fichier : `components/dietary/ProfileFoodCard.tsx`

**Hex hardcodé `#FFFFFF` dans `deleteActionText`**
- Fix : remplacé par `colors.onPrimary` (token sémantique disponible dans tous les thèmes)
- Fichier : `components/dietary/ProfileFoodCard.tsx`

## Known Stubs

- `{/* PREF-13 voice input — Plan 07 */}` dans `app/dietary.tsx` ligne ~90 : bouton micro non câblé, zone réservée pour le Plan 07 (saisie vocale)

## Commits

| Hash | Description |
|------|-------------|
| 8d00e66 | feat(15-05): domain hook useVaultDietary + intégration VaultContext |
| 29deea5 | feat(15-05): écran dietary.tsx + ProfileFoodCard + DietaryAutocomplete + lien more.tsx |

## Self-Check: PASSED
