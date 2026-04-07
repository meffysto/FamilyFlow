# Feature Research

**Domain:** Mobile family app — v1.2 "Confort & Découverte" milestone
**Researched:** 2026-04-07
**Confidence:** MEDIUM (ecosystem patterns from WebSearch + direct codebase analysis for integration points)

---

## Feature 1 — Préférences alimentaires

### Context

Existing vault: `Profile` type in `lib/types.ts` has no dietary fields today. Meals stored in
`02 - Maison/Repas semaine du YYYY-MM-DD.md` as plain text lines. Recipes are Cooklang files in
`03 - Cuisine/Recettes/{Category}/{Name}.cook`. The `useVaultProfiles` hook owns Profile r/w.
The `useVaultMeals` and `useVaultRecipes` hooks are the integration targets for flagging.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Saisie préférences par profil famille | Base pour tout le reste — sans ça rien ne fonctionne | LOW | Nouveau champ dans `Profile` + parser. Stocké en frontmatter `famille.md`. |
| Types distincts : allergie / intolérance / régime / aversion | Les allergies sont potentiellement mortelles — les mélanger avec « je n'aime pas les poireaux » est une faute UX grave (confirmé par apps médicales et Yummly) | LOW | 4 catégories : `allergie` (bloquant, pictogramme rouge), `intolerance` (avertissement orange), `regime` (filtre passif : vegan/végé/halal/casher/sans gluten/etc.), `aversion` (indicatif, jaune). |
| Flag visuel sur carte recette | Les apps Yummly et Mealime marquent les ingrédients problématiques sur la carte recette elle-même — c'est ce que les utilisateurs attendent | MEDIUM | Croiser la liste d'ingrédients Cooklang avec les préférences du profil actif. Badge coloré sur la carte + liste des conflits dans le détail recette. |
| Flag sur le planning repas | Un repas planifié doit afficher un warning si un membre de la famille présent ne peut pas le manger | MEDIUM | Le planning repas actuel n'a pas de notion « qui mange ce repas » — la solution minimaliste est de flagguer si n'importe quel membre de la famille active a un conflit. |
| Édition depuis l'écran profil | Naturel : préférences alimentaires = données personnelles = profil | LOW | Section nouvelle dans la vue profil existante. `updateProfile()` étendu. |

### Differentiators (What Would Make This Delightful)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Invités avec préférences légères | Grand-mère coeliaque vient dimanche — pouvoir la saisir rapidement sans créer un profil complet famille | MEDIUM | Voir section Feature 4 ci-dessous pour le design détaillé. |
| Sélection « qui mange ce repas » sur la fiche repas | Permet de ne flagguer que les membres réellement présents au repas (ex : enfant chez papy le soir) | HIGH | Dépend d'un champ `attendees` dans `MealItem` — change le modèle de données. Déférer à v1.3. |
| Résumé des contraintes combinées pour un repas planifié | « Pour ce dîner : Emma (sans gluten), Lucas (végétarien) — recette compatible : OUI / NON » | MEDIUM | Valeur réelle pour la cuisine quotidienne. Faisable avec les préférences profil sans gérer les attendees. |
| Stocker dans vault Obsidian (frontmatter `famille.md`) | Compatibilité bidirectionnelle Obsidian. L'utilisateur peut éditer depuis Obsidian si besoin. Zéro backend. | LOW | Cohérent avec l'architecture globale. Clé dans frontmatter : `dietary_preferences: [{type, value}]`. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Système de notation sévérité numérique (1-5) | Semble précis | Crée de la friction lors de la saisie, peu actionnable (quelle est la différence entre 3 et 4 ?) | 4 catégories sémantiques claires : allergie / intolérance / régime / aversion — plus rapide à saisir, plus clair à l'affichage |
| Base de données d'ingrédients avec matching automatique NLP | Impressionnant techniquement | Complexité énorme, 0 backend, vault Obsidian = texte libre. Le matching sur les noms d'ingrédients Cooklang est suffisant (string includes). | Matching textuel simple sur les noms d'ingrédients. Accepter les faux négatifs. |
| Suggestions de substitutions automatiques | Utile en théorie | Dépend d'une base de données nutritionnelle, hors scope (100% local) | Afficher le conflit ; laisser l'utilisateur décider de la substitution |
| Notifications push « attention ton repas contient X » | Sécurité allergène | Pas de backend push, app familiale privée TestFlight | Warning inline lors de l'ouverture du planning repas |
| Import depuis MyFitnessPal / bases USDA | Demandé par des power users | Hors scope, aucun backend | Saisie manuelle. Les cas d'usage famille sont limités (10-15 ingrédients problématiques max par famille). |

### MVP pour v1.2

- Nouveau type `DietaryPreference = { type: 'allergie' | 'intolerance' | 'regime' | 'aversion', value: string }[]` dans `Profile`
- Parser : lecture/écriture de `dietary_preferences` en frontmatter `famille.md`
- UI édition dans écran profil (section collapsible)
- Flag sur carte recette (badge couleur par sévérité)
- Flag sur planning repas hebdo (avertissement en haut de section jour si conflit avec profil actif)

---

## Feature 2 — Codex / Wiki Ferme

### Context

La ferme (écran `tree.tsx`, 105K) est le composant le plus complexe de l'app. Elle comporte :
cultures (14 variétés dont 4 dropOnly), bâtiments (poulailler, vacherie, moulin, ruche), arbre de
tech (10 nœuds, 3 branches), compagnons, sagas, événements saisonniers, quêtes coopératives,
usure, pluies dorées, graines rares. Aucune documentation in-app n'existe. Le `HelpContext`
gère des coach marks par écran (1-3 marques max) — non extensible à un wiki de référence.
L'app a déjà un `HelpProvider` dans la hiérarchie providers.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Accès via bouton « ? » visible sur l'écran ferme | Pattern universel dans les jeux mobiles (Clash of Clans, Hay Day, etc.) — les utilisateurs cherchent ce bouton | LOW | Bouton HeaderRight ou icône flottante sur `tree.tsx`. |
| Catégories organisées (pas un mur de texte) | Les wikis de jeux (Stardew Valley wiki, Fandom) sont tous organisés par catégorie d'objet | LOW | Catégories minimales : Cultures, Bâtiments, Tech, Compagnons, Sagas & Événements, Mécaniques générales. |
| Stats précises et à jour (tasksPerStage, costs, drops) | Les joueurs consultent le codex précisément pour vérifier des chiffres — des approximations annulent l'utilité | LOW | Les données sont déjà dans le code (`CROP_CATALOG`, `TECH_TREE`, `BUILDING_CATALOG`). Le codex doit lire les constantes directement, pas les dupliquer. |
| Accessible depuis l'écran ferme sans quitter le contexte | Un modal ou une bottom sheet — pas une navigation vers un écran séparé | LOW | `pageSheet` modal (pattern standard du projet). |

### Differentiators (What Would Make This Delightful)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Stats calculées dynamiquement depuis les constantes de jeu | Impossible d'avoir un désync codex/jeu. Exemple : si `tasksPerStage` change, le codex se met à jour automatiquement. | LOW | Avantage clé vs wikis externes (Fandom) qui deviennent rapidement obsolètes. Passer les objets du catalogue directement aux composants codex. |
| Entrée du codex verrouillée si non encore découvert | Mechanic « fog of war » : les cultures dropOnly apparaissent comme « ??? » jusqu'à ce que l'utilisateur en obtienne une. Ajoute du mystère. | MEDIUM | Croiser `profile.farmRareSeeds` et `profile.harvestInventory` pour déterminer les entrées découvertes. Cultures standard toujours visibles. |
| Lien « Replayer le tutoriel » dans le codex | Point d'entrée unique pour l'onboarding rejouable — naturel de le chercher dans le wiki | LOW | Un bouton en bas du codex qui lance le tutoriel ferme. Appelle `resetScreen('farm')` du HelpContext. |
| Contexte actuel du profil dans le codex | Afficher les cultures actuellement disponibles (selon `treeStage` actuel) en premier, les locked en grisé après | MEDIUM | Lire `activeProfile.level` → `treeStage` pour filtrer/ordonner. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Codex éditable par l'utilisateur | Flexibilité | La source de vérité doit être le code — un codex éditable diverge et crée de la confusion | Codex 100% read-only, généré depuis les constantes |
| Système de favoris/bookmarks dans le codex | Feature des grands wikis | Surcharge UX pour un usage familial privé (4-5 utilisateurs max) | Ordre par pertinence : cultures disponibles en premier |
| Recherche full-text dans le codex | Utile si beaucoup d'entrées | Complexité disproportionnée pour 14 cultures + 4 bâtiments + 10 nœuds tech = ~40 entrées max | Navigation par catégorie suffit pour ce volume |
| Historique des modifications / changelogs | Developer UX | Pas pertinent pour des joueurs familiaux | Hors scope |
| Export PDF / partage du codex | Gadget | Vault local, usage privé | Hors scope |

### MVP pour v1.2

- Modal `pageSheet` ouvert depuis bouton « ? » sur `tree.tsx`
- 5 sections : Cultures (tableau avec stats depuis `CROP_CATALOG`), Bâtiments (depuis `BUILDING_CATALOG`), Arbre Tech (depuis `TECH_TREE`), Mécaniques (texte statique : cycles, golden, dropOnly, saisons), Compagnons & Sagas (résumé statique)
- Cultures dropOnly affichées en « ??? » si `harvestInventory` ne contient pas encore cette ressource
- Bouton « Revoir le tutoriel » en bas → déclenche tutoriel ferme

---

## Feature 3 — Tutoriel Ferme

### Context

Il existe déjà un onboarding app (`onboarding.tsx`, 57K) pour le premier lancement global — flow
conversationnel en 10 étapes. Le `HelpContext` gère les coach marks par écran (flag vu/pas vu,
reset possible). Il n'y a pas de tutoriel spécifique à la ferme. L'écran ferme est `tree.tsx`
(105K) qui gère tout : plantation, récolte, bâtiments, tech, compagnons.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Se déclenche automatiquement au premier accès à la ferme | Pattern universel — les jeux mobiles déclenchent le tutoriel quand l'utilisateur arrive pour la première fois dans un sous-système | LOW | Utiliser `HelpContext.hasSeenScreen('farm')` — déjà existant mais pas utilisé pour la ferme. |
| Skippable immédiatement | Les joueurs expérimentés (ou qui reprennent l'app) ne veulent pas être forcés — forcer = frustration (pattern TV Tropes « Forced Tutorial ») | LOW | Bouton « Passer » visible dès le premier écran. Marque quand même `hasSeenScreen('farm')` pour ne pas re-déclencher. |
| Rejouable depuis le codex | Indispensable pour un mini-jeu complexe avec saisons et mécaniques qui se débloquent progressivement | LOW | `resetScreen('farm')` depuis le codex (Feature 2) ou depuis Paramètres. |
| Explique les 3 mécaniques fondamentales | Les études de jeux mobiles montrent qu'un tutoriel doit couvrir la boucle de jeu principale en max 3-5 étapes pour éviter l'abandon | LOW | Boucle de base ferme : (1) tâches → points → plantations ; (2) attendre + tâches → récolte → feuilles ; (3) feuilles → graines / bâtiments. |

### Differentiators (What Would Make This Delightful)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Spotlight overlay sur les éléments UI réels | Montre l'interface réelle au lieu d'une animation fictive — le joueur voit exactement sur quoi cliquer | MEDIUM | Overlay semi-transparent + highlight du composant cible. Requis : les composants de `tree.tsx` doivent exposer des `ref` ou des positions mesurables. |
| Narration par le compagnon ferme (si actif) | Utilise le compagnon existant (`companion-engine.ts`) comme narrateur — cohérent avec l'univers, donne de la personnalité | MEDIUM | Vérifier si `activeProfile.companion` est défini et utiliser l'emoji/nom du compagnon dans les bulles de dialogue. Fallback sur mascotte arbre si pas de compagnon. |
| Progression par paliers (pas tout d'un coup) | Les meilleures pratiques jeux mobiles (Google Play guidelines, inworld.ai) recommandent d'introduire les mécaniques au moment où elles sont pertinentes, pas toutes au premier lancement | MEDIUM | Phase 1 au premier lancement : boucle de base (planter/récolter/feuilles). Phase 2 déclenché quand premier bâtiment débloqué. Phase 3 quand premier nœud tech acheté. Flag par phase dans HelpContext (`farm_tutorial_p1`, `farm_tutorial_p2`, `farm_tutorial_p3`). |
| Récompense XP pour avoir terminé le tutoriel | Encourage la completion — incentivize tutorial completion with in-game rewards (pattern documenté) | LOW | +50 XP au profil actif via `addXP()` existant dans `useGamification`. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Tutoriel forcé non-skippable | Garantir que l'utilisateur le voit | Frustration maximale, notamment pour la famille qui reprend l'app après une pause | Skippable + rejouable depuis codex |
| Tutoriel interactif avec actions obligatoires (« now plant this carrot ») | Engagement fort | Casse si l'utilisateur n'a pas les ressources nécessaires (pas de feuilles, profil vide). Aussi plus long à dev. | Tutoriel contemplatif : spotlight + explication. L'utilisateur agit quand il veut, pas pendant le tutoriel. |
| Vidéo embarquée | Aspect professionnel | Taille du bundle, pas de backend, localisation fr/en = 2 vidéos. Pas adapté TestFlight family app. | Spotlight overlay animé avec Reanimated (pattern déjà utilisé dans l'app) |
| Tutoriel couvrant toutes les mécaniques (compagnons, sagas, événements saisonniers, usure, drops rares, golden rain) | Exhaustivité | Tutoriel de 20 étapes = abandon garanti. La plupart de ces mécaniques sont rares/avancées. | Tutoriel = boucle de base seulement. Mécaniques avancées → codex. |

### MVP pour v1.2

- Overlay tutoriel en 4 étapes, déclenché par `!hasSeenScreen('farm')` à l'ouverture de `tree.tsx`
- Étapes : (1) Présentation de la ferme + lien avec les tâches ; (2) Comment planter ; (3) Comment récolter ; (4) Feuilles et graines
- Bouton « Passer » à chaque étape
- Appel `markScreenSeen('farm')` à la fin ou au skip
- Bouton « Revoir » dans le codex via `resetScreen('farm')`
- Pas de spotlight complexe pour le MVP — bullles de dialogue avec flèche pointant vers la zone concernée (plus simple, suffisant)

---

## Feature 4 — Invités / Contacts avec préférences alimentaires

### Context

Les profils famille (`Profile`) sont des entités lourdes (arbre mascotte, ferme, gamification, XP,
coins, thème…). Un invité « grand-mère coeliaque qui vient le dimanche » ne doit pas avoir un
profil complet. Il faut un type de données distinct et léger.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Saisir un invité avec un nom et ses préférences alimentaires | Besoin direct : cuisiner pour quelqu'un hors famille sans créer un profil complet | LOW | Nouveau type `Guest = { id, name, emoji, preferences: DietaryPreference[] }` dans vault (frontmatter ou fichier dédié `invites.md`). |
| Invités listés séparément des profils famille | Distinction claire : membre de la famille permanent vs. invité occasionnel | LOW | Section dédiée dans l'écran profils ou dans les préférences alimentaires. |
| Flag recette / repas prend en compte les invités sélectionnés | Sinon les préférences invités sont inutilisables | MEDIUM | Nécessite de sélectionner quels invités sont présents pour un repas donné — lié à la mécanique « qui mange ce repas » (déféré à v1.3). Pour v1.2 : option de sélection manuelle de l'invité dans le planning repas. |

### Differentiators (What Would Make This Delightful)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Invité épinglé sur un créneau repas spécifique | « Grand-mère : dimanche midi » — le flag apparaît automatiquement le dimanche | MEDIUM | Champ `scheduledDay?: string` sur `Guest`. Complexité modérée. Déférer à v1.3. |
| Invités dans vault Obsidian (`invites.md`) | Compatible avec l'architecture existante. Éditable depuis Obsidian. | LOW | Fichier `04 - Personnes/invites.md` avec un profil YAML par invité. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Import depuis carnet d'adresses iOS | Convenience | Accès permissions contacts, données personnelles, complexité d'implémentation disproportionnée pour un usage familial privé | Saisie manuelle. 5-10 invités récurrents max dans une famille. |
| Profil invité complet (avatar, thème, gamification) | Uniformité | Un invité n'a pas de progression dans l'app — alourdirait inutilement le code et l'UX | Type `Guest` minimal (nom + emoji + préférences) |
| Gestion de droits d'accès pour les invités | Sécurité | Hors scope. App familiale privée sur TestFlight, contrôle parental déjà existant pour autres besoins | Hors scope |

### MVP pour v1.2

- Type `Guest` minimal dans `lib/types.ts`
- Fichier vault `04 - Personnes/invites.md` (ou frontmatter `famille.md` si simple)
- UI de gestion dans écran profils (liste invités + CRUD)
- Pour le flag recette/repas : les invités sont un filtre optionnel activable manuellement (pas automatique — garde la complexité basse pour v1.2)

---

## Feature Dependencies

```
DietaryPreference type (Profile + Guest)
    └──required by──> Flag recette
    └──required by──> Flag repas hebdo
    └──required by──> Résumé contraintes combinées

Guest type
    └──required by──> Flag recette/repas avec invités
    └──enhances──> DietaryPreference (périmètre élargi)

Codex ferme
    └──required by──> Bouton « Revoir tutoriel » (lien entrant du codex vers tutoriel)
    └──enhances──> Tutoriel ferme (contexte de référence post-tutoriel)

Tutoriel ferme
    └──requires──> HelpContext.hasSeenScreen('farm') — déjà existant
    └──enhances──> Codex ferme (point d'entrée pour rejouer)

Spotlight tutorial (differentiator)
    └──requires──> Composants tree.tsx avec positions mesurables (ref ou onLayout)
    └──complexifie──> Tutoriel ferme MVP
```

### Dependency Notes

- **DietaryPreference requires Profile extension :** Nouveau champ dans `Profile` et mise à jour de `parseFamille` / `serializeFamille` dans `parser.ts`. Risque de régression sur `famille.md` existant — migration douce requise (champ absent = tableau vide).
- **Codex requires lecture des constantes de jeu :** Les composants codex doivent importer `CROP_CATALOG`, `TECH_TREE`, `BUILDING_CATALOG` de `lib/mascot/types.ts` et `lib/mascot/tech-engine.ts`. Pas de duplication de données.
- **Tutoriel ferme conflicts with « forced tutorial » antipattern :** Le tutoriel doit être skippable immédiatement — ne pas bloquer l'accès à la ferme.

---

## MVP pour v1.2 — Priorisation

### Lancer avec (v1.2)

- [ ] **Préférences alimentaires profil famille** — type `DietaryPreference` + édition dans profil + stockage vault. Valeur immédiate, complexité basse, pas de dépendance.
- [ ] **Flag recette** — badge couleur sur carte recette selon profil actif. Dépend de (1).
- [ ] **Flag repas hebdo** — warning sur planning si conflit profil actif. Dépend de (1).
- [ ] **Codex ferme** — modal « ? » avec stats depuis constantes de jeu + section cultures/bâtiments/tech. Indépendant des autres features.
- [ ] **Tutoriel ferme** — 4 étapes skippables, déclenchement auto premier accès. Dépend de l'existence du codex (bouton « Revoir »).
- [ ] **Invités (type Guest + CRUD)** — type minimal + liste dans écran profil + stockage vault. Dépend de `DietaryPreference` type.

### Ajouter après validation (v1.3)

- [ ] **Sélection « qui mange ce repas »** — champ `attendees` sur `MealItem`, flag contextuel. Complexité model data.
- [ ] **Tutoriel ferme progressif par paliers** — phases 2 et 3 déclenchées à la découverte de nouvelles mécaniques.
- [ ] **Spotlight overlay sur UI réelle** — après validation du tutoriel de base.
- [ ] **Invité épinglé sur créneau repas** — quand les attendees sont implémentés.

### Future Consideration (v2+)

- [ ] **Résumé contraintes combinées pour repas partagé** — dépend de la mécanique attendees + invités actifs.
- [ ] **Narration compagnon dans tutoriel** — polish, pas de valeur fonctionnelle.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Préférences alimentaires profil (saisie) | HIGH | LOW | P1 |
| Flag recette selon profil actif | HIGH | LOW | P1 |
| Codex ferme (stats + catégories) | HIGH | LOW | P1 |
| Tutoriel ferme skippable (4 étapes) | HIGH | LOW | P1 |
| Invités avec préférences | MEDIUM | LOW | P1 |
| Flag repas hebdo | MEDIUM | MEDIUM | P1 |
| Tutoriel progressif par paliers | MEDIUM | MEDIUM | P2 |
| Spotlight overlay UI réelle | MEDIUM | HIGH | P2 |
| Sélection attendees par repas | HIGH | HIGH | P2 |
| Invité épinglé sur créneau | LOW | MEDIUM | P3 |
| Narration compagnon tutoriel | LOW | MEDIUM | P3 |

---

## Integration Points with Existing FamilyFlow Features

| Feature v1.2 | Intègre avec | Risque régressions |
|--------------|--------------|-------------------|
| Préférences alimentaires | `Profile` type + `parseFamille` / `serializeFamille` dans `parser.ts` | MEDIUM — mutation du modèle `Profile` et du parser. Migration douce obligatoire (valeur absente = `[]`). |
| Flag recette | `useVaultRecipes` + composants liste/détail recette | LOW — lecture seule, pas de modification du vault |
| Flag repas | `useVaultMeals` + `meals.tsx` | LOW — badge additionnel, pas de changement modèle |
| Codex ferme | `tree.tsx` + `lib/mascot/types.ts` + `lib/mascot/tech-engine.ts` | LOW — nouveau modal, lecture seule des constantes |
| Tutoriel ferme | `tree.tsx` + `HelpContext` (déjà existant) | LOW — `hasSeenScreen('farm')` est un nouveau screenId, pas de conflit |
| Invités | `lib/types.ts` (nouveau type) + `parser.ts` + `useVaultProfiles` | MEDIUM — nouveau fichier vault ou extension `famille.md` |

---

## Sources

- Yummly meal planning review: https://www.reviewed.com/cooking/content/yummly-meal-planning-app-review
- Food allergy app UX patterns: https://blog.foodsconnected.com/the-best-food-allergy-apps-and-how-they-work
- Dietary severity level design: https://pmc.ncbi.nlm.nih.gov/articles/PMC7527917/
- Mobile game onboarding best practices 2025: https://www.zigpoll.com/content/how-can-we-optimize-the-onboarding-experience-to-reduce-player-dropoff-rates-in-our-mobile-game
- Apple Developer — Onboarding for Games: https://developer.apple.com/app-store/onboarding-for-games/
- Progressive disclosure (NNG): https://www.nngroup.com/articles/progressive-disclosure/
- Tutorial design patterns (TV Tropes — Forced Tutorial): https://tvtropes.org/pmwiki/pmwiki.php/Main/ForcedTutorial
- Game UX tutorial methods: https://jontopielski.com/blog/methods-for-onboarding.html
- Family meal planning app patterns 2025: https://ollie.ai/2025/10/05/best-meal-planning-app-2025/
- UX for food & drink apps: https://www.testingtime.com/en/blog/5-ux-design-principles-for-the-food-and-drink-industry/
- FamilyFlow codebase: `lib/types.ts`, `lib/mascot/types.ts`, `lib/mascot/tech-engine.ts`, `contexts/HelpContext.tsx`, `hooks/useVaultProfiles.ts`, `hooks/useVaultMeals.ts`, `app/onboarding.tsx`

---

*Feature research for: FamilyFlow v1.2 "Confort & Découverte"*
*Researched: 2026-04-07*
