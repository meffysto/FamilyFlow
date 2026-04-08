# Phase 15: Préférences alimentaires - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

La famille peut saisir, modifier et supprimer les contraintes alimentaires de chaque membre famille et des invités récurrents (4 sévérités : allergie / intolérance / régime / aversion). L'app détecte automatiquement les conflits dans les recettes via une fonction pure `lib/dietary.ts`, affiche des badges colorés hiérarchisés non-dismissibles pour les allergies, et offre une saisie vocale via le `DictaphoneRecorder` existant interprété par `lib/ai-service.ts`. Le planificateur de repas affiche un récap des contraintes combinées.

**Hors-scope (déféré explicitement):**
- Mutation du modèle `meals` avec un champ `convives[]` (PREF-FUT-01)
- Consolidation `HealthRecord.allergies` ↔ préférences alimentaires (PREF-FUT-02)
- Suggestion automatique de recettes compatibles (PREF-FUT-03)
- Création d'un écran "détail profil" générique réutilisable (le roadmap mentionne "écran détail profil" mais l'utilisateur a tranché : écran dédié Préférences alimentaires)

</domain>

<decisions>
## Implementation Decisions

### Point d'entrée UI
- **D-01:** Créer un nouvel écran dédié `Préférences alimentaires` accessible depuis `more.tsx` (pattern existant des écrans secondaires). Liste tous les membres famille puis tous les invités côte à côte dans un seul écran — un seul endroit pour toutes les contraintes alimentaires.
- **D-02:** Pas de "ProfileDetailModal" générique créée dans cette phase. L'écran est spécifique à la feature préférences alimentaires.
- **D-03:** Les invités récurrents (PREF-06/07) sont gérés dans le **même écran** que les membres, dans une section visuelle distincte (titre H2 "Invités récurrents") sous la liste famille.

### Structure d'input par catégorie
- **D-04:** L'écran présente **4 sections visuelles** par profil (membre ou invité), une par catégorie : Allergies / Intolérances / Régimes / Aversions. Chaque section affiche les chips actuels + un champ d'ajout adapté à la catégorie.
- **D-05:** Catalogues canoniques à créer dans `lib/dietary.ts` (ou fichier dédié `lib/dietary/catalogs.ts` à laisser au planner) :
  - **14 allergènes UE** (PREF-03 obligatoire) : gluten, crustacés, œufs, poissons, arachides, soja, lait, fruits à coque, céleri, moutarde, sésame, sulfites, lupin, mollusques. IDs canoniques stables, libellés FR.
  - **Catalogue intolérances courantes** (~10 items) : lactose, gluten (non cœliaque), fructose, histamine, FODMAP, sorbitol, caféine, etc.
  - **Catalogue régimes courants** : végétarien, végan, halal, casher, sans-porc, sans-alcool, pescétarien, sans-bœuf.
  - **Aversions** : pas de catalogue, texte libre uniquement.
- **D-06:** Pour les 3 sections cataloguées (allergies/intolérances/régimes), input = `TextInput` avec autocomplete dropdown sur le catalogue correspondant. Texte libre autorisé en fallback (mais non mappé canoniquement). Pour aversions = texte libre pur.

### Sélecteur "qui mange ce soir"
- **D-07:** Bouton ad hoc **dans l'écran détail recette** : "Vérifier conflits pour…" → ouvre une modale `pageSheet` avec chips multiselect (membres famille + invités). Le résultat alimente `checkAllergens()` côté UI uniquement, sans persistance dans le modèle `meals`. Préserve PREF-FUT-01.
- **D-08:** Par défaut (avant interaction utilisateur sur ce sélecteur), le badge de conflit affiché dans l'écran recette se base sur **l'union de tous les profils famille** (sécurité maximale). Les invités ne sont **pas** inclus par défaut — l'utilisateur doit les ajouter explicitement via le sélecteur.

### Affichage badges recette (PREF-10/11)
- **D-09:** Affichage **double** : un bandeau global en tête de l'écran recette + un petit badge inline à côté de chaque ingrédient touché. Visibilité maximale + contexte précis.
- **D-10:** Le bandeau global affiche **toutes les sévérités**, hiérarchisées : rouge si au moins une allergie présente, sinon orange si intolérance, sinon jaune si régime/aversion. Une ligne par sévérité, expandable/collapsible — **sauf** la ligne allergie qui reste toujours visible (non-dismissible).
- **D-11:** **PREF-11 P0 SAFETY enforcement technique** : le composant Badge allergie n'expose **aucune** prop `onDismiss`, **aucun** bouton X visible, et `pointerEvents='none'` sur la zone de swipe pour résister aux gestes accidentels. Test unitaire dédié vérifie l'absence d'API dismiss. Toute PR future qui ajouterait un dismiss sur ce composant doit être bloquée par revue de code.
- **D-12:** Pas de modale bloquante au mount de la recette — le bandeau visible permanent suffit.

### Saisie vocale (PREF-13)
- **D-13:** **Un seul bouton micro flottant** dans le header de l'écran Préférences alimentaires. L'utilisateur dicte librement ("Lucas est allergique aux arachides et aux noisettes, Emma est intolérante au lactose") → `lib/ai-service.ts` extrait un **tableau d'extractions** structurées : `{ profilCible, catégorie, itemCanonique, sévérité }[]`.
- **D-14:** Après transcription, **modale preview éditable** s'affiche avec la liste complète des extractions. Chaque ligne est une checkbox cochée par défaut. L'utilisateur peut décocher les items faux et **éditer** chaque champ (profil cible / catégorie / item / sévérité) avant de valider tout en une fois. Pas d'auto-commit silencieux — sécurité élevée car allergie = vital.
- **D-15:** Si `ai-service.ts` échoue ou retourne une extraction de basse confiance, **ouvrir la modale d'ajout manuel** standard avec les champs pré-remplis au mieux possible (texte brut transcrit dans le champ "item", reste vide). User complète à la main. Pas de toast retry — fallback gracieux vers le flow manuel.

### Claude's Discretion

- **Matching ingrédients .cook ↔ catalogue canonique** (`lib/dietary.ts > checkAllergens`) : Claude décide. Approche par défaut recommandée :
  - Normalisation systématique des ingrédients : lowercase, accents supprimés, singulier (`arachides` → `arachide`).
  - Aliases manuels FR codés en dur dans le catalogue (ex: `arachide` → aussi matche "cacahuète", "cacahouète" ; `lait` → matche "lactose", "produits laitiers", "beurre", "crème", "yaourt", "fromage" ; `gluten` → matche "blé", "farine", "seitan", etc.).
  - Substring matching après normalisation. Pas de fuzzy matching probabiliste (risque faux positifs).
  - Conservatisme : en cas de doute sur un match, **toujours** déclencher le badge (faux positif acceptable, faux négatif inacceptable sur allergie).
- **Format du récap planificateur PREF-12** : Claude décide. Suggestion : bandeau compact en tête du `MealItem` du planning hebdo affichant "X allergies, Y intolérances pour les convives sélectionnés" avec drill-down au tap.
- **Composant CollapsibleSection** réutilisé pour les 4 catégories par profil dans l'écran Préférences alimentaires (déjà disponible dans `components/ui/`).
- **Persistance** : sérialisation des clés `food_*` dans `parseFamille`/`serializeFamille` (extension de `lib/parser.ts`) — format = liste séparée par virgules, IDs canoniques en priorité, texte libre autorisé en fallback.
- **Tests de non-régression Obsidian (PREF-05)** : Claude ajoute un test parser qui vérifie qu'un `famille.md` sans aucune clé `food_*` parse sans crash et qu'un round-trip parse → serialize → parse préserve les données.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §PREF — PREF-01 à PREF-13 + PREF-FUT-01/02/03 (déférés)
- `.planning/ROADMAP.md` §"Phase 15" — Goal, success criteria, P0 safety flag PREF-11
- `.planning/PROJECT.md` — Vision FamilyFlow, contraintes non-négociables (Obsidian bidir, no backend)

### Codebase patterns existants
- `lib/parser.ts` — `parseFamille()` (ligne ~672) et `serializeFamille()` (ligne ~852) à étendre avec les clés `food_*`. Pattern à imiter : `farm_crops` (clé plate dans frontmatter, valeur = string CSV)
- `lib/parser.ts` §`parseHealthRecord` (ligne ~2178) — référence du modèle `HealthRecord.allergies` existant (santé enfant). **Coexistence temporaire** — ne pas consolider (PREF-FUT-02 différé)
- `components/DictaphoneRecorder.tsx` — composant existant à réutiliser tel quel, pas de fork
- `lib/ai-service.ts` — étendre avec une fonction d'extraction `extractDietaryConstraints(transcription, profilesContext)` qui retourne le tableau structuré
- `components/ui/CollapsibleSection.tsx` — pour les 4 sections par profil
- `app/(tabs)/wishlist.tsx` — pattern de référence pour le fichier Invités (sections H2 par item, parser dédié, CRUD UI)
- `app/(tabs)/settings.tsx` — emplacement actuel de la gestion famille (point de départ pour ajouter le lien vers le nouvel écran Préférences alimentaires)
- `app/(tabs)/more.tsx` — point d'entrée recommandé pour le nouvel écran

### Standards projet
- `CLAUDE.md` §Conventions — UI française, useThemeColors, modals pageSheet+drag-to-dismiss, ReanimatedSwipeable, noms génériques dans fichiers publics
- `CLAUDE.md` §Patterns de code — React.memo sur list items, SectionErrorBoundary, console.warn sous `__DEV__`
- ARCH-05 (ROADMAP global constraint v1.2) — **Aucune nouvelle dépendance npm** sur toute la phase

### À créer dans cette phase
- `lib/dietary.ts` (PREF-09) — fonction pure `checkAllergens(recipe, profileIds): Conflict[]`
- `lib/dietary/catalogs.ts` (suggestion) — 3 catalogues canoniques + map d'aliases FR
- `02 - Famille/Invités.md` (vault Obsidian, PREF-06) — fichier nouveau, pattern wishlist

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`components/DictaphoneRecorder.tsx`** : composant de capture audio prêt à l'emploi, déjà utilisé dans tree/meals/quotes/rdv/budget/gratitude. Réutilisation directe, zéro fork.
- **`lib/ai-service.ts`** : service Claude API existant, pattern établi. Ajouter une nouvelle fonction d'extraction sans toucher l'existant.
- **`lib/parser.ts > parseFamille / serializeFamille`** : fonctions à étendre avec les clés `food_*`. Pattern `farm_crops` (CSV string dans frontmatter) à imiter.
- **`components/ui/CollapsibleSection`** : pour structurer les 4 catégories par profil.
- **`components/ui/Chip`** + **`components/ui/Badge`** : pour afficher les items + badges de conflit.
- **`ReanimatedSwipeable`** : pour swipe-to-delete sur les chips de préférences (pattern projet).

### Established Patterns
- **Clés plates dans frontmatter** : `farm_crops`, `farm_buildings`, `mascot_inhabitants` — précédent direct pour `food_allergies`, etc.
- **Pattern wishlist** : fichier dédié avec sections H2 par item — précédent direct pour `Invités.md`.
- **Modal pageSheet + drag-to-dismiss** : convention pour toutes les modales (sélecteur convives, preview vocale).
- **Sérialisation tolérante** : `parseFamille` ignore silencieusement les clés inconnues — extension natural pour `food_*`.
- **Tests parser round-trip** : pattern à imiter pour PREF-05 (compatibilité bidirectionnelle Obsidian).

### Integration Points
- `app/(tabs)/more.tsx` : ajouter un lien vers le nouvel écran `Préférences alimentaires` (route `app/dietary.tsx` ou similaire — au planner de décider).
- `app/(tabs)/settings.tsx` : conserver la gestion famille existante. Pas de duplication — l'écran préférences alimentaires est complémentaire.
- Écran détail recette (à identifier précisément en planning — actuellement pas de fichier `recette*.tsx`, probablement géré inline ailleurs) : intégrer le bandeau global + badges inline + bouton "Vérifier conflits pour…".
- `contexts/VaultContext.tsx` + `hooks/useVault.ts` : ajouter un domain hook `useDietary` ou étendre `useProfiles` (au planner de décider — pattern domain hook préféré per CLAUDE.md).

### Constraints from prior phases
- **CLAUDE.md** : useThemeColors obligatoire, pas de hardcoded colors. Les couleurs rouge/orange/jaune des badges doivent passer par des tokens sémantiques (à créer si absents : `colors.severity.allergie`, `colors.severity.intolerance`, `colors.severity.preference`).
- **ARCH-05 v1.2** : **zéro nouvelle dépendance npm** sur toute la phase 15. Toutes les UI primitives sont déjà disponibles.
- **VaultManager** : path traversal prevention, iCloud coordination — utiliser via `useVault()`, jamais en direct.

</code_context>

<specifics>
## Specific Ideas

- **Sécurité par défaut** : toujours préférer le faux positif au faux négatif sur les conflits d'allergie. Le matching ingrédients doit être conservateur — un ingrédient ambigu déclenche le badge.
- **Confirmation manuelle obligatoire** sur toute saisie vocale d'allergie — pas d'auto-commit silencieux. L'utilisateur passe par la modale preview éditable avant validation.
- **PREF-11 enforcement test-driven** : tests unitaires vérifient l'absence d'API `onDismiss` sur le composant Badge allergie + tests de gesture qui simulent un swipe et vérifient que le badge reste visible.
- **Round-trip Obsidian** : tests parser obligatoires (PREF-05) qui vérifient que `parse → serialize → parse` préserve les données et qu'un `famille.md` sans clés `food_*` ne crash pas.
- **Aliases FR manuels** : la map d'aliases est codée en dur, versionnée, reviewable. Pas de fuzzy matching probabiliste — chaque alias est explicite et testable.
- **Pattern wishlist pour Invités.md** : copier mentalement la structure de `wishlist.md` (sections H2, props YAML par item) pour rester cohérent et bénéficier du pattern parser établi.

</specifics>

<deferred>
## Deferred Ideas

- **Sélecteur "qui mange" persisté dans le modèle `meals`** → PREF-FUT-01 (mutation modèle data, scope creep dans Phase 15). On reste sur un sélecteur ad hoc volatil dans l'écran recette.
- **Consolidation `HealthRecord.allergies` ↔ préférences alimentaires** → PREF-FUT-02 (chantier migration parser dédié). Coexistence temporaire des deux modèles dans Phase 15.
- **Suggestion automatique de recettes compatibles** → PREF-FUT-03 (feature recommandation, scope distinct).
- **ProfileDetailModal générique réutilisable** : pas créé dans Phase 15. À potentiellement extraire si plusieurs phases futures en ont besoin (refactoring opportuniste, pas une priorité).
- **Tutoriel contextuel** sur l'écran Préférences alimentaires (premier usage) → relève potentiellement de TUTO-FUT-01 (Phase 18+).

</deferred>

---

*Phase: 15-pr-f-rences-alimentaires*
*Context gathered: 2026-04-07*
