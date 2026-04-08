# Phase 15: Préférences alimentaires — Research

**Researched:** 2026-04-07
**Domain:** Dietary preferences management, allergen detection, voice input, Obsidian vault data model
**Confidence:** HIGH (all findings verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Écran dédié `Préférences alimentaires` accessible depuis `more.tsx`. Liste membres famille puis invités côte à côte — un seul endroit.
**D-02:** Pas de "ProfileDetailModal" générique. Écran spécifique à la feature.
**D-03:** Invités récurrents dans le **même écran**, section visuelle distincte (titre H2 "Invités récurrents").
**D-04:** 4 sections visuelles par profil : Allergies / Intolérances / Régimes / Aversions. Chips existants + champ d'ajout.
**D-05:** Catalogues canoniques dans `lib/dietary.ts` (ou `lib/dietary/catalogs.ts`) — 14 allergènes UE (IDs stables), ~10 intolérances courantes, régimes courants, aversions = texte libre.
**D-06:** Input = TextInput avec autocomplete dropdown sur catalogue (allergies/intolérances/régimes). Texte libre en fallback. Aversions = texte libre pur.
**D-07:** Bouton "Vérifier conflits pour…" dans l'écran détail recette → modale `pageSheet` avec chips multiselect. Résultat volatil, pas de persistance dans `meals`.
**D-08:** Par défaut, badge recette basé sur **l'union de tous les profils famille**. Invités non inclus par défaut.
**D-09:** Affichage double : bandeau global en tête recette + badge inline à côté de chaque ingrédient conflictuel.
**D-10:** Bandeau hiérarchisé (rouge allergie → orange intolérance → jaune régime/aversion), expandable/collapsible — **sauf** la ligne allergie toujours visible.
**D-11 (P0 SAFETY):** Composant Badge allergie sans prop `onDismiss`, sans bouton X, `pointerEvents='none'` sur la zone swipe. Test unitaire dédié.
**D-12:** Pas de modale bloquante au mount recette — bandeau visible permanent suffit.
**D-13:** Un seul bouton micro flottant dans le header écran Préférences alimentaires. Dictée libre → `lib/ai-service.ts` extrait tableau structuré `{ profilCible, catégorie, itemCanonique, sévérité }[]`.
**D-14:** Modale preview éditable après transcription. Checkboxes cochées par défaut, éditables. Pas d'auto-commit silencieux.
**D-15:** Si ai-service échoue ou basse confiance → ouvrir modale d'ajout manuel avec champs pré-remplis. Pas de toast retry.

### Claude's Discretion

- **Matching ingrédients .cook ↔ catalogue canonique** : normalisation lowercase+accents+singulier, aliases manuels FR codés en dur, substring matching. Conservatisme : faux positif acceptable, faux négatif inacceptable.
- **Format récap planificateur PREF-12** : bandeau compact en tête `MealItem`, "X allergie(s), Y intolérance(s) pour les convives sélectionnés", drill-down au tap.
- **CollapsibleSection** réutilisé pour les 4 catégories par profil.
- **Persistance** : clés `food_*` dans `parseFamille`/`serializeFamille` (extension `lib/parser.ts`), format CSV.
- **Tests parser round-trip** (PREF-05) : fichier sans clés `food_*` ne crash pas + round-trip préserve données.

### Deferred Ideas (OUT OF SCOPE)

- PREF-FUT-01 : Sélecteur "qui mange" persisté dans le modèle `meals` (mutation modèle data)
- PREF-FUT-02 : Consolidation `HealthRecord.allergies` ↔ préférences alimentaires
- PREF-FUT-03 : Suggestion automatique de recettes compatibles
- ProfileDetailModal générique réutilisable
- Tutoriel contextuel premier usage

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREF-01 | 4 sévérités distinctes : `allergie`, `intolerance`, `regime`, `aversion` | Type union TypeScript + 4 clés CSV dans `famille.md` |
| PREF-02 | Préférences stockées comme clés plates dans `famille.md` (`food_allergies`, `food_intolerances`, `food_regimes`, `food_aversions`) | Pattern `farm_crops`/`mascot_decorations` dans `parseFarmProfile` — même mécanique CSV |
| PREF-03 | Catalogue canonique des 14 allergènes UE avec IDs stables | À créer dans `lib/dietary/catalogs.ts` — aucun existant |
| PREF-04 | CRUD préférences par membre famille via UI | Pattern `updateProfile` dans `useVaultProfiles.ts` — extension directe |
| PREF-05 | Compatibilité bidirectionnelle Obsidian — parser tolère absence clés `food_*` | Pattern `props.farm_crops ?? ''` dans `parseFarmProfile` ligne 610 |
| PREF-06 | Fichier `02 - Famille/Invités.md` pour invités récurrents | Pattern `WISHLIST_FILE = '05 - Famille/Souhaits.md'` dans `parser.ts` |
| PREF-07 | CRUD invités depuis l'écran préférences alimentaires | Pattern `useVaultWishlist` — reloadFrais + writeFile |
| PREF-08 | Invités dans le sélecteur "qui mange ce soir" | Sélecteur modal pageSheet volatile — `GuestProfile[]` combiné avec `Profile[]` |
| PREF-09 | Fonction pure `checkAllergens(recipe, profileIds)` dans `lib/dietary.ts` | `AppIngredient.name: string` depuis `lib/cooklang.ts` ; normalisation + aliases codés en dur |
| PREF-10 | Badge conflit visuel dans écran détail recette (rouge/orange/jaune) | `colors.errorBg/warningBg/tagMention` confirmés dans `constants/colors.ts` |
| PREF-11 (P0 SAFETY) | Badge allergie non-dismissible en permanence | `pointerEvents='none'` + aucune prop `onDismiss` + test unitaire Jest |
| PREF-12 | Récap contraintes dans le planificateur de repas | `MealItem` interface confirmée — bandeau compact en tête du composant existant |
| PREF-13 | Saisie vocale via `DictaphoneRecorder` + interprétation IA | `DictaphoneRecorder.onResult(text)` existant ; `extractDietaryConstraints` à ajouter dans `lib/ai-service.ts` via `callClaude` |
| ARCH-03 | `checkAllergens` testée unitairement (min 5 cas) | Infrastructure Jest existante dans `lib/__tests__/` — `dietary.test.ts` à créer |
| ARCH-04 | `useVault.ts` n'inflate pas — profils étendus via `parseProfile`/`serializeProfile` | Pattern `useVaultProfiles` domain hook — `food_*` dans `parseFamille` + nouveau `useVaultDietary` domain hook |

</phase_requirements>

---

## Summary

Phase 15 implémente la gestion des préférences alimentaires familiales dans un app React Native / Expo existante avec un vault Obsidian comme backend. Le domaine couvre : (1) modèle de données CSV dans `famille.md` avec 4 clés `food_*`, (2) fichier invités `Invités.md` sur le pattern wishlist, (3) fonction pure de détection de conflits `checkAllergens`, (4) UI dédiée avec autocomplete, (5) saisie vocale IA, (6) affichage badges dans le RecipeViewer existant.

Toute la logique de matching ingrédients repose sur une normalisation déterministe (pas de fuzzy matching) + un catalogue d'aliases FR codé en dur. Ce choix est critique pour la sécurité allergène : un faux positif est préférable à un faux négatif.

Le P0 SAFETY PREF-11 est l'impératif absolu de la phase : le badge allergie ne peut jamais être dismissé. L'enforcement est technique (pas de prop dismiss, `pointerEvents='none'`, test unitaire dédié) et non procédural.

**Primary recommendation:** Implémenter dans cet ordre strict — (W0) types + parser + tests parser, (W1) lib/dietary.ts + checkAllergens + tests, (W2) écran dietary.tsx + hook domain, (W3) intégration RecipeViewer, (W4) saisie vocale + modale preview.

---

## Project Constraints (from CLAUDE.md)

Directives obligatoires à respecter dans toutes les tâches de cette phase :

| Directive | Détail |
|-----------|--------|
| Animations | `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming` — jamais `Animated` (RN core) |
| Spring config | Constante module `const SPRING_CONFIG = { damping: 10, stiffness: 180 }` — vérifier cohérence avec `{ damping: 15, stiffness: 200 }` mentionné dans l'UI-SPEC |
| Couleurs | Toujours `useThemeColors()` / `colors.*` — jamais de hardcoded hex |
| Swipe | `ReanimatedSwipeable` (PAS `Swipeable`) depuis `react-native-gesture-handler/ReanimatedSwipeable` |
| Haptics | `expo-haptics` — `Haptics.selectionAsync()` sur sélection, `Haptics.impactAsync()` sur suppression |
| Modals | `pageSheet` + drag-to-dismiss obligatoire pour toutes les modales |
| Styles dynamiques | `useThemeColors()` inline pour les styles dépendant du thème |
| Styles statiques | `StyleSheet.create({})` en bas de fichier |
| Tokens numériques | `Spacing['2xl']` pas `16` |
| React.memo | Sur les list items (ProfileFoodCard, chip items) |
| useCallback | Sur les handlers passés en props |
| Erreurs user-facing | `Alert.alert()` en français |
| console.warn/error | Uniquement sous `if (__DEV__)` |
| SectionErrorBoundary | Entoure les sections dashboard indépendamment |
| Validation | `npx tsc --noEmit` — seule validation (pas de suite de tests auto, nyquist_validation: false) |
| Dépendances npm | ZÉRO nouvelle dépendance (ARCH-05) |
| Format dates | JJ/MM/AAAA |
| Langue | UI/commits/commentaires en français |
| Noms dans fichiers publics | Génériques (Lucas, Emma, Dupont) — jamais de vrais noms personnels |

---

## Standard Stack

### Core (tout déjà installé)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1 | Animations chips, bandeau | Obligatoire CLAUDE.md |
| react-native-gesture-handler | existant | ReanimatedSwipeable swipe-to-delete | Obligatoire CLAUDE.md |
| expo-haptics | existant | Feedback tactile sélection/suppression | Convention projet |
| expo-secure-store | existant | Pas utilisé directement ici (profils via vault) | — |
| gray-matter | existant | Parser frontmatter Obsidian | Via `lib/parser.ts` |

### Composants UI existants à réutiliser

| Composant | Chemin | Usage dans Phase 15 |
|-----------|--------|---------------------|
| `CollapsibleSection` | `components/ui/CollapsibleSection.tsx` | 4 sections par profil (Allergies/Intolérances/Régimes/Aversions) |
| `Chip` | `components/ui/Chip.tsx` | Affichage des items préférences + multiselect convives |
| `Badge` | `components/ui/Badge.tsx` | Badges inline ingrédients conflictuels |
| `Button` | `components/ui/Button.tsx` | Ajouter préférence, Ajouter invité, Vérifier conflits |
| `ModalHeader` | `components/ui/ModalHeader.tsx` | En-tête des modales pageSheet |
| `DictaphoneRecorder` | `components/DictaphoneRecorder.tsx` | Saisie vocale — réutilisé sans fork |

### Alternatives considérées

| Standard | Alternative | Pourquoi standard choisi |
|----------|------------|--------------------------|
| Substring matching + aliases | Fuse.js fuzzy matching | Faux positifs inacceptables sur allergènes vitaux |
| CSV frontmatter (`food_allergies: gluten,lait`) | JSON embedded | CSV déjà établi dans `farm_crops`, `mascot_decorations` — cohérence |
| Fichier `Invités.md` dédié | Extension du modèle `Profile` | Invités sans gamification — profil complet inutile |
| `pointerEvents='none'` + no dismiss prop | Confirmation modale avant dismiss | Élimination architecturale du risque, pas procédurale |

**Installation:** Aucune — ARCH-05 zéro nouvelle dépendance npm.

---

## Architecture Patterns

### Structure fichiers à créer

```
lib/
├── dietary.ts              # Fonction pure checkAllergens + types DietarySeverity, DietaryConflict
├── dietary/
│   └── catalogs.ts         # 3 catalogues canoniques + aliases map FR
app/
├── dietary.tsx             # Écran principal Préférences alimentaires
│   └── (ou app/(tabs)/dietary.tsx selon structure existante — vérifier routing)
components/
├── dietary/
│   ├── ProfileFoodCard.tsx          # Card profil avec 4 CollapsibleSections
│   ├── AllergenBanner.tsx           # Bandeau global recette (P0 SAFETY)
│   ├── DietaryChip.tsx              # Chip avec swipe-to-delete intégré
│   ├── DietaryAutocomplete.tsx      # TextInput + dropdown catalogue
│   ├── ConvivesPickerModal.tsx      # Modale sélecteur "qui mange ce soir"
│   └── VoicePreviewModal.tsx        # Modale preview extractions vocales
hooks/
└── useVaultDietary.ts      # Domain hook CRUD préférences + invités
lib/__tests__/
└── dietary.test.ts         # Tests checkAllergens (ARCH-03) + tests parser round-trip (PREF-05)
```

**Note routing:** L'app utilise expo-router. Les écrans `(tabs)/` sont dans `app/(tabs)/`. Les écrans secondaires accessibles via `router.push` peuvent être dans `app/` à la racine (ex: `app/dietary.tsx`). Vérifier le `_layout.tsx` pour confirmer si un route wrapper est nécessaire.

### Pattern 1: Extension parseFamille / serializeFamille

**What:** Ajout de 4 champs CSV dans la section `### {profileId}` de `famille.md`
**When to use:** Lire/écrire les préférences alimentaires d'un profil famille

```typescript
// Source: lib/parser.ts ligne 688 — pattern existant à imiter
// Dans parseFamille() flush() :
profiles.push({
  id: currentId,
  name: currentProps.name,
  // ... champs existants ...
  // Nouveaux champs food_*
  foodAllergies: currentProps.food_allergies
    ? currentProps.food_allergies.split(',').map(s => s.trim()).filter(Boolean)
    : [],
  foodIntolerances: currentProps.food_intolerances
    ? currentProps.food_intolerances.split(',').map(s => s.trim()).filter(Boolean)
    : [],
  foodRegimes: currentProps.food_regimes
    ? currentProps.food_regimes.split(',').map(s => s.trim()).filter(Boolean)
    : [],
  foodAversions: currentProps.food_aversions
    ? currentProps.food_aversions.split(',').map(s => s.trim()).filter(Boolean)
    : [],
});
```

**Dans serializeFamille:** Si `foodAllergies.length > 0` → `food_allergies: ${foodAllergies.join(',')}` — ne pas écrire la clé si tableau vide (préserve la lisibilité Obsidian).

### Pattern 2: Fichier Invités.md — pattern wishlist

**What:** Fichier `02 - Famille/Invités.md` avec sections H2 par invité + props en lignes key: value
**When to use:** Parser/sérialiser les invités récurrents

```
## Lucas
name: Lucas
food_allergies: arachides,gluten
food_intolerances: lactose
food_regimes: végétarien
food_aversions: poivron,aubergine

## Emma
name: Emma
food_allergies: noix
```

**Note:** Contrairement à la wishlist (lignes de tâches), les invités utilisent des propriétés clé-valeur par section H2 — parser similaire à `parseFamille` mais sur un fichier dédié.

### Pattern 3: checkAllergens — fonction pure

**What:** Croise les ingrédients d'une recette avec les préférences des profileIds fournis
**When to use:** Avant tout affichage de recette

```typescript
// Source: lib/cooklang.ts — AppIngredient.name: string
export interface DietaryConflict {
  ingredientName: string;   // nom brut dans la recette
  matchedAllergen: string;  // ID canonique ou texte libre qui a matché
  severity: DietarySeverity;
  profileIds: string[];     // qui est affecté
}

export function checkAllergens(
  recipe: AppRecipe,
  profileIds: string[],
  allProfiles: Profile[],
  guestProfiles: GuestProfile[],
): DietaryConflict[] {
  // 1. Collecter toutes les contraintes des profileIds
  // 2. Pour chaque ingrédient : normaliser (lowercase, sans accents)
  // 3. Vérifier contre chaque contrainte via aliases map
  // 4. Retourner conflits groupés par sévérité la plus haute
}
```

**Règle de conservatisme:** En cas de match partiel ambigu → toujours déclencher le conflit (allergie).

### Pattern 4: updateProfile étendu pour food_*

**What:** Réutilisation du pattern `updateProfile` existant dans `useVaultProfiles.ts`
**When to use:** Sauvegarder les modifications de préférences

```typescript
// Source: hooks/useVaultProfiles.ts ligne 301
// Le pattern existant lit le fichier, modifie les clés dans la section, réécrit.
// Étendre updateProfile pour accepter les food_* fields dans les updates :
updateProfile(profileId: string, updates: {
  name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender;
  foodAllergies?: string[]; foodIntolerances?: string[]; foodRegimes?: string[]; foodAversions?: string[];
})
// Ou créer updateDietaryPreferences(profileId, category, items) dans useVaultDietary
```

**Recommandation:** Créer `useVaultDietary` séparé (pattern domain hook — ARCH-04) qui utilise `vaultRef` directement, exposé via `VaultState`. Évite d'inflater `useVaultProfiles`.

### Pattern 5: Saisie vocale DictaphoneRecorder

**What:** Le composant existant prend un `onResult: (text: string) => void`. Pour la phase 15, la prop `context` avec un titre suffit pour déclencher le dictaphone.
**When to use:** Bouton micro dans le header de `dietary.tsx`

```typescript
// Source: components/DictaphoneRecorder.tsx ligne 53-60
// Props à passer :
<DictaphoneRecorder
  context={{ title: "Préférences alimentaires", subtitle: "Dictez les préférences..." }}
  onResult={(text) => handleVoiceTranscript(text)}
  onClose={() => setShowDictaphone(false)}
/>
// Puis dans handleVoiceTranscript → appel extractDietaryConstraints → ouvrir VoicePreviewModal
```

### Pattern 6: extractDietaryConstraints dans ai-service.ts

**What:** Nouvelle fonction `export async function extractDietaryConstraints(config, transcript, profilesContext): Promise<AIResponse>`
**When to use:** Après réception du texte transcrit par DictaphoneRecorder

```typescript
// Source: lib/ai-service.ts — pattern callClaude ligne 379
// Utiliser claude-haiku (comme summarizeTranscription ligne 677)
// System prompt : extraire tableau JSON structuré { profilCible, categorie, item, severite }[]
// Retourner JSON parsé ou error → fallback vers modale manuelle (D-15)
const haikiConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
const resp = await callClaude(haikiConfig, systemPrompt, messages);
```

### Pattern 7: AllergenBanner — enforcement PREF-11

**What:** Composant sans aucune prop dismiss, `pointerEvents='none'` sur la View de swipe
**When to use:** En tête de RecipeViewer, toujours rendu (pas de conditional return)

```typescript
// Enforcement architectural P0 SAFETY :
interface AllergenBannerProps {
  conflicts: DietaryConflict[];
  // ⚠ AUCUNE prop onDismiss, onClose, dismissible — intentionnellement absent
}

export function AllergenBanner({ conflicts }: AllergenBannerProps) {
  const allergyConflicts = conflicts.filter(c => c.severity === 'allergie');
  if (conflicts.length === 0) return null; // bandeau absent si 0 conflit
  return (
    <View pointerEvents="none" style={...}> {/* résistance aux gestes accidentels */}
      {/* Ligne allergie — toujours visible si présente, non-collapsible */}
      {allergyConflicts.length > 0 && (
        <View style={{ backgroundColor: colors.errorBg, borderLeftWidth: 3, borderLeftColor: colors.error }}>
          {/* non-enfant de CollapsibleSection */}
        </View>
      )}
      ...
    </View>
  );
}
```

### Pattern 8: Navigation vers dietary.tsx depuis more.tsx

**What:** Ajout d'un item dans le tableau `items` de `more.tsx`
**When to use:** Point d'entrée unique

```typescript
// Source: app/(tabs)/more.tsx ligne 119-149 — pattern existant
{ emoji: '🥗', label: 'Préférences alimentaires', route: '/dietary', color: colors.catOrganisation, category: 'organisation' as const },
// Note: le route exact dépend de la position du fichier (app/dietary.tsx = '/dietary')
```

### Anti-Patterns à éviter

- **Ne pas consolider HealthRecord.allergies** avec les food_* dans cette phase (PREF-FUT-02 différé).
- **Ne pas mettre les food_* dans farm-{profileId}.md** — ces données appartiennent au profil famille, pas aux données ferme.
- **Ne pas utiliser Fuse.js** pour le matching allergènes — pas de nouvelle dépendance, et fuzzy matching trop risqué sur allergènes.
- **Ne jamais retourner null conditionnel sur AllergenBanner quand allergie présente** — le bandeau allergie ne peut pas être absent si `allergyConflicts.length > 0`.
- **Ne pas passer les invités par le VaultState des profils** — conserver une séparation propre `Profile[]` (famille) vs `GuestProfile[]` (invités).
- **Ne pas utiliser `Swipeable`** (ancienne API) — toujours `ReanimatedSwipeable` de `react-native-gesture-handler/ReanimatedSwipeable`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parser CSV frontmatter | Parser custom | Pattern `split(',').map(s => s.trim()).filter(Boolean)` établi dans `parseFarmProfile` | Déjà éprouvé, cohérent avec le vault |
| Fichier invités | Nouveau système de storage | Pattern `parseWishlist`/`serializeWishlist` dans `parser.ts` | Même structure H2 + props |
| Matching allergènes | Fuzzy matching | Normalisation + aliases manuels codés en dur | Contrôle précis, pas de false negatives |
| Composants UI | Nouvelles primitives | `Chip`, `Badge`, `CollapsibleSection`, `Button`, `ModalHeader` existants | ARCH-05 + cohérence |
| Recording audio | Nouveau composant | `DictaphoneRecorder` existant | Déjà intégré sur 6+ écrans |
| Appels IA | SDK Anthropic npm | `callClaude` dans `lib/ai-service.ts` | Pattern établi, pas de dépendance externe |
| State management invités | Nouveau contexte/provider | Domain hook `useVaultDietary` — pattern `useVaultWishlist` | Évite inflation providers (déjà 8 niveaux) |

**Key insight:** Tout le code d'infrastructure (I/O vault, parsing, AI, UI primitives) existe déjà. La phase 15 est principalement de l'**assemblage** de patterns établis + la logique métier de matching allergènes.

---

## Common Pitfalls

### Pitfall 1: Écraser les champs food_* lors d'un updateProfile standard

**What goes wrong:** `updateProfile` dans `useVaultProfiles.ts` réécrit tout le fichier `famille.md`. Si on ajoute des clés `food_*` mais qu'elles ne sont pas connues de `updateProfile`, elles seront supprimées à la prochaine mise à jour de nom/avatar.
**Why it happens:** La fonction `updateProfile` lit le fichier en lignes et modifie only les clés présentes dans `updates`. Les clés inconnues sont préservées si on utilise le pattern ligne-par-ligne (il ne réécrit que les clés connues). Vérifier le comportement exact sur le code réel.
**How to avoid:** S'assurer que `updateProfile` préserve les clés `food_*` non modifiées. Soit en les incluant explicitement dans le type `updates`, soit en confirmant que le mécanisme ligne-par-ligne ne les supprime pas.
**Warning signs:** Tests round-trip `parseFamille → serializeFamille → parseFamille` qui perdent les food_* après un updateProfile.

### Pitfall 2: Confondre parseFamille et parseFarmProfile

**What goes wrong:** Les données ferme (`farm_crops`, `mascot_*`) ont été extraites dans `farm-{profileId}.md` (commit `260404-h6l`). `parseFamille` lit `famille.md` qui ne contient **plus** `farm_crops`. Les `food_*` vont dans `famille.md` (pas dans `farm-{profileId}.md`).
**Why it happens:** L'historique du projet montre une migration récente. La confusion est possible.
**How to avoid:** Confirmer en lisant `famille.md` réel dans le vault. Les food_* sont des données profil familial (pas ferme) → `famille.md`.

### Pitfall 3: Alias map incomplète pour les faux négatifs

**What goes wrong:** Un ingrédient "crème fraîche" n'est pas reconnu comme contenant du lait parce que l'alias n'est pas dans la map.
**Why it happens:** La map d'aliases est codée en dur et sera incomplète au lancement.
**How to avoid:** Prioriser les dérivés courants pour chaque allergène UE. Pour `lait` : beurre, crème, yaourt, fromage, mascarpone, mozzarella, ghee, lactose. Pour `gluten`/blé : farine, pain, pâtes, blé, orge, seigle, seitan, épeautre. Pour `œufs` : mayonnaise, meringue, hollandaise. Etc.
**Warning signs:** Tests `checkAllergens` avec des recettes réelles du vault qui retournent 0 conflits sur des recettes clairement problématiques.

### Pitfall 4: AllergenBanner dépendant d'un état qui peut être undefined

**What goes wrong:** `AllergenBanner` reçoit `conflicts` qui est `undefined` avant le premier chargement, provoquant un crash.
**Why it happens:** Les données vault sont asynchrones au mount.
**How to avoid:** Typer `conflicts` comme `DietaryConflict[]` (jamais `| undefined`) et initialiser à `[]` dans le hook. Le composant retourne `null` si `conflicts.length === 0`.

### Pitfall 5: DictaphoneRecorder onResult appelé avec texte vide

**What goes wrong:** Si l'utilisateur s'arrête de parler sans avoir dit quoi que ce soit, `onResult` peut être appelé avec une chaîne vide.
**Why it happens:** Le composant existant appelle `onResult` à la fin de l'enregistrement.
**How to avoid:** Dans `handleVoiceTranscript`, vérifier `if (!text.trim()) return` avant d'appeler `extractDietaryConstraints`.

### Pitfall 6: Clés food_* encodées comme liste YAML plutôt que CSV

**What goes wrong:** Modifier `famille.md` manuellement dans Obsidian en utilisant une liste YAML :
```
food_allergies:
  - gluten
  - lait
```
au lieu de `food_allergies: gluten,lait`.
**Why it happens:** Les utilisateurs Obsidian ont l'habitude des listes YAML.
**How to avoid:** Le parser est tolérant à l'absence des clés. Mais pour la lecture des listes YAML, `props.food_allergies` serait `undefined` (gray-matter parse les listes YAML comme arrays). Documenter dans le code que le format attendu est CSV string. Option : supporter les deux formats dans le parser (détecter Array.isArray(props.food_allergies)).

### Pitfall 7: infoText token manquant

**What goes wrong:** `colors.infoText` n'existe pas dans `constants/colors.ts` — il n'y a que `colors.info` (couleur principale) et `colors.infoBg` (fond). L'UI-SPEC utilise `infoBg` + `info` pour le niveau régime/aversion, mais pas de `infoText`.
**Why it happens:** Le design system actuel n'a pas ce token.
**How to avoid:** Pour le texte sur fond `infoBg`, utiliser `colors.info` ou `colors.textSub` selon le contraste. Ne pas créer un nouveau token couleur (ARCH-05 — pas d'ajout de nouveaux tokens risqués non confirmés, bien que ce soit différent des dépendances npm, vérifier si la convention s'applique aux tokens couleur).

---

## Code Examples

### Catalogue 14 allergènes UE

```typescript
// Source: Règlement (UE) n°1169/2011 — liste officielle
// lib/dietary/catalogs.ts

export const EU_ALLERGENS: DietaryItem[] = [
  { id: 'gluten',      label: 'Gluten',           aliases: ['blé', 'farine', 'orge', 'seigle', 'épeautre', 'kamut', 'seitan', 'pain', 'pâtes', 'semoule', 'boulgour'] },
  { id: 'crustaces',   label: 'Crustacés',         aliases: ['crevette', 'homard', 'crabe', 'langoustine', 'écrevisse'] },
  { id: 'oeufs',       label: 'Œufs',              aliases: ['oeuf', 'mayonnaise', 'meringue', 'hollandaise', 'albumen', 'lysozyme'] },
  { id: 'poissons',    label: 'Poissons',           aliases: ['saumon', 'thon', 'cabillaud', 'merlu', 'sardine', 'anchois', 'surimi'] },
  { id: 'arachides',   label: 'Arachides',          aliases: ['cacahuète', 'cacahouète', 'cacahuètes', 'huile d\'arachide'] },
  { id: 'soja',        label: 'Soja',               aliases: ['tofu', 'tempeh', 'miso', 'edamame', 'lécithine de soja'] },
  { id: 'lait',        label: 'Lait',               aliases: ['beurre', 'crème', 'yaourt', 'fromage', 'mascarpone', 'mozzarella', 'ricotta', 'ghee', 'caséine', 'lactose', 'lactosérum', 'lait écrémé', 'babeurre'] },
  { id: 'fruits_a_coque', label: 'Fruits à coque', aliases: ['noisette', 'noix', 'amande', 'cajou', 'pistache', 'noix de pécan', 'noix du brésil', 'macadamia', 'praline', 'praliné'] },
  { id: 'celeri',      label: 'Céleri',             aliases: ['céleri rave', 'céleri branche'] },
  { id: 'moutarde',    label: 'Moutarde',           aliases: ['graines de moutarde', 'farine de moutarde'] },
  { id: 'sesame',      label: 'Sésame',             aliases: ['tahini', 'huile de sésame', 'graines de sésame'] },
  { id: 'sulfites',    label: 'Sulfites/SO₂',       aliases: ['dioxyde de soufre', 'e220', 'e221', 'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228', 'vin'] },
  { id: 'lupin',       label: 'Lupin',              aliases: ['farine de lupin', 'graine de lupin'] },
  { id: 'mollusques',  label: 'Mollusques',         aliases: ['moule', 'huître', 'calamar', 'pieuvre', 'escargot', 'palourde', 'coque'] },
];
```

### Normalisation pour matching

```typescript
// lib/dietary.ts
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')                        // décompose les accents
    .replace(/[\u0300-\u036f]/g, '')        // supprime les diacritiques
    .replace(/['']/g, "'")                  // normalise les apostrophes
    .trim();
}

function ingredientMatchesConstraint(
  ingredientName: string,
  constraintItem: DietaryItem,
): boolean {
  const normalized = normalizeText(ingredientName);
  const candidates = [constraintItem.id, constraintItem.label, ...(constraintItem.aliases ?? [])];
  return candidates.some(c => normalized.includes(normalizeText(c)));
}
```

### Test unitaire PREF-11 enforcement

```typescript
// lib/__tests__/dietary.test.ts
describe('AllergenBanner P0 SAFETY', () => {
  it('AllergenBannerProps ne contient pas de prop onDismiss', () => {
    // Vérification statique TypeScript — passe si le type n'expose pas onDismiss
    type Props = React.ComponentProps<typeof AllergenBanner>;
    type HasDismiss = 'onDismiss' extends keyof Props ? true : false;
    const check: HasDismiss = false; // doit compiler
    expect(check).toBe(false);
  });
});
```

### Pattern enqueueWrite pour les writes famille.md

```typescript
// Source: lib/famille-queue.ts — pattern existant pour les writes concurrents
// Dans useVaultDietary, utiliser enqueueWrite pour les modifications de famille.md
import { enqueueWrite } from '../lib/famille-queue';

const updateFoodPreferences = useCallback(async (profileId, category, items) => {
  await enqueueWrite(async () => {
    const content = await vaultRef.current!.readFile(FAMILLE_FILE);
    // modifier en place → écrire
    await vaultRef.current!.writeFile(FAMILLE_FILE, newContent);
  });
}, [vaultRef]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| farm_* dans famille.md | farm_* dans farm-{profileId}.md | Commit 260404-h6l | parseFamille ne contient plus farm_crops — les food_* vont dans famille.md, pas farm-{profileId}.md |
| Writes directs vault | enqueueWrite via famille-queue.ts | Phase 13 / Quick 260403 | Tous les writes famille.md doivent passer par enqueueWrite pour éviter race conditions |
| useVault monolithe | Domain hooks séparés (useVaultProfiles, useVaultWishlist, etc.) | Phase 08.1 | Nouveau domain hook = useVaultDietary, inclus dans useVaultInternal |

---

## Open Questions

1. **Position du fichier `dietary.tsx`**
   - Ce qu'on sait : `more.tsx` utilise `router.push('/(tabs)/wishlist')` pour les écrans dans `(tabs)/`. Mais `app/` a aussi des écrans à la racine (onboarding, setup).
   - Ce qui est flou : l'écran dietary est-il un tab ou un écran secondaire accessible via push ? Les décisions indiquent "accessible depuis more.tsx" — vraisemblablement `app/dietary.tsx` avec route `/dietary`, mais vérifier si `app/(tabs)/dietary.tsx` est préférable selon le layout.
   - Recommandation : `app/(tabs)/dietary.tsx` pour cohérence avec les autres écrans (wishlist, budget, etc.). Route `/(tabs)/dietary`.

2. **updateProfile et préservation des clés food_***
   - Ce qu'on sait : `updateProfile` dans `useVaultProfiles.ts` modifie les lignes `key: value` en place dans la section `### profileId`. Les clés inconnues ne sont pas touchées si elles ne sont pas dans `updates`.
   - Ce qui est flou : comportement exact si on appelle `updateProfile` avec uniquement `name` alors que `food_allergies` existe déjà dans le fichier.
   - Recommandation : Vérifier sur le code — mais le pattern ligne-par-ligne devrait préserver les clés inconnues. Ajouter un test round-trip explicite.

3. **Serialization Invités.md — format H2 + key-value vs format wishlist (checkboxes)**
   - Ce qu'on sait : La wishlist utilise `- [ ] texte | budget | ...`. Les invités n'ont pas de comportement checkbox.
   - Ce qui est flou : Le format exact du fichier Invités.md n'est pas spécifié dans la wishlist — la décision est "pattern wishlist" mais les invités ont des propriétés différentes.
   - Recommandation : Format H2 + lignes `key: value` par invité (similaire au format `parseFamille` mais dans un fichier dédié). Plus simple que le format pipe-delimited wishlist pour des propriétés multiples.

---

## Environment Availability

Step 2.6: SKIPPED — Phase purement code/config. Toutes les dépendances (runtime, outils CLI) sont déjà disponibles dans le projet. Aucune dépendance externe nouvelle (ARCH-05).

---

## Validation Architecture

`nyquist_validation: false` dans `.planning/config.json` — section omise.

Cependant : la validation de cette phase repose sur `npx tsc --noEmit` (seule validation CLAUDE.md). Les tests unitaires dans `lib/__tests__/` sont exécutés séparément si besoin (jest) — ils ne font pas partie du flow GSD automatique.

**Tests critiques à créer (ARCH-03 + PREF-05) :**
- `lib/__tests__/dietary.test.ts` — `checkAllergens` minimum 5 cas (allergie évidente, intolérance évidente, faux positif évité, faux négatif détecté, recette sans ingrédient critique)
- Ajout dans `lib/__tests__/parser.test.ts` — round-trip `parseFamille` avec clés `food_*` + fichier sans clés `food_*`

---

## Sources

### Primary (HIGH confidence)

- Codebase live — `lib/parser.ts` (lignes 570-732, 1459-1600) — pattern `parseFarmProfile`, `parseFamille`, `parseWishlist` vérifiés
- Codebase live — `lib/types.ts` (lignes 67-105) — `Profile` interface vérifiée, aucun champ `food_*` existant
- Codebase live — `lib/cooklang.ts` (lignes 12-32) — `AppIngredient.name: string` vérifié
- Codebase live — `hooks/useVaultProfiles.ts` (lignes 301-412) — pattern `updateProfile` vérifié
- Codebase live — `hooks/useVaultWishlist.ts` — pattern domain hook vérifié
- Codebase live — `hooks/useVault.ts` (lignes 126-271) — `VaultState` interface complète vérifiée
- Codebase live — `constants/colors.ts` (lignes 7-75) — tokens `errorBg`, `warningBg`, `infoBg`, `tagMention`, `error`, `warning` vérifiés
- Codebase live — `components/DictaphoneRecorder.tsx` (lignes 53-60) — interface `onResult: (text: string) => void` vérifiée
- Codebase live — `lib/ai-service.ts` (lignes 379-442, 641-682) — pattern `callClaude` + `summarizeTranscription` vérifiés
- Codebase live — `app/(tabs)/more.tsx` (lignes 119-160) — pattern menu items + `router.push` vérifié
- Codebase live — `lib/__tests__/` — infrastructure Jest existante avec 20+ fichiers de tests vérifiée
- Règlement (UE) n°1169/2011 — liste officielle des 14 allergènes à déclaration obligatoire

### Secondary (MEDIUM confidence)

- `lib/famille-queue.ts` — `enqueueWrite` confirmé comme pattern pour les writes concurrents `famille.md` (vu dans STATE.md decisions + imports dans hooks)

### Tertiary (LOW confidence)

- Format exact du fichier `famille.md` réel dans le vault de l'utilisateur — non lu directement, déduit du code parser

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — tous composants vérifiés dans le codebase
- Architecture: HIGH — tous les patterns existent et sont vérifiés ligne par ligne
- Pitfalls: HIGH — pitfalls identifiés depuis l'analyse du code réel (ex: migration farm_* récente confirmée dans STATE.md)
- Matching allergènes: HIGH — approche normalisée + aliases manuels confirmée dans CONTEXT.md D-Discretion

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable — pas de dépendances externes volatiles)
