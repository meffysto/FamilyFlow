# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1-4 (shipped 2026-03-28)
- ✅ **v1.1 Ferme Enrichie** — Phases 5-14 (shipped 2026-04-07)
- 🚧 **v1.2 Confort & Découverte** — Phases 15-18 (en cours)

## Active Milestone: v1.2 Confort & Découverte

**Goal:** L'app retient les détails que la famille oublie et explique enfin la ferme — confort quotidien (préférences alimentaires) et découvrabilité du jeu (codex + tutoriel).

**Global constraint (ARCH-05):** Aucune nouvelle dépendance npm sur toutes les phases — toutes les UI primitives, SVG et patterns sont déjà disponibles dans le codebase.

## Phases

- [x] **Phase 15: Préférences alimentaires** — Mémoire des contraintes alimentaires par membre famille et invités, avec détection automatique des conflits dans les recettes et le planning repas (completed 2026-04-08)
- [x] **Phase 16: Codex contenu** — Fichier de données pur `lib/codex/content.ts` important les constantes engine existantes, zéro UI, zéro risque de dérive des stats (completed 2026-04-08)
- [x] **Phase 17: Codex UI** — Modale `FarmCodexModal` avec bouton "?" dans le HUD ferme, navigation par catégories, recherche textuelle et virtualisation (completed 2026-04-08)
- [ ] **Phase 18: Tutoriel ferme** — Overlay tutoriel immersif au premier lancement, skippable, rejouable depuis le codex, avec pause des animations ferme pendant les étapes

## Phase Details

### Phase 15: Préférences alimentaires
**Goal**: La famille peut saisir et gérer les contraintes alimentaires de chaque membre et des invités récurrents, et l'app signale automatiquement tout conflit dans les recettes et le planning repas
**Depends on**: Rien (feature auto-contenue)
**Requirements**: PREF-01, PREF-02, PREF-03, PREF-04, PREF-05, PREF-06, PREF-07, PREF-08, PREF-09, PREF-10, PREF-11 (P0 SAFETY), PREF-12, PREF-13 (saisie vocale via DictaphoneRecorder + ai-service), ARCH-03, ARCH-04
**Critical**: PREF-11 est un impératif de sécurité — les badges allergie sont non-dismissibles et implémentés en priorité absolue avant tout autre badge
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut ajouter, modifier et supprimer une préférence alimentaire (allergie / intolérance / régime / aversion) pour n'importe quel membre famille depuis l'écran détail profil, avec autocomplete sur les 14 allergènes UE
  2. **[P0 SAFETY]** Un conflit de sévérité `allergie` reste visible en permanence sur l'affichage recette et ne peut être dismissé sous aucune interaction utilisateur
  3. L'écran détail recette affiche un badge coloré distinct par sévérité (rouge allergie, orange intolérance, jaune régime/aversion) quand un conflit est détecté pour le profil actif
  4. L'utilisateur peut créer un invité récurrent avec ses contraintes alimentaires et cet invité apparaît dans le sélecteur "qui mange ce soir" aux mêmes conditions que les membres famille
  5. Modifier `famille.md` directement dans Obsidian reste valide — le parser tolère l'absence de toutes les clés `food_*` sans crash ni perte de données
  6. L'utilisateur peut dicter une préférence ("Lucas est allergique aux arachides") via le `DictaphoneRecorder` existant — la transcription est interprétée par `ai-service.ts` qui extrait sévérité + item canonique et ajoute la préférence au profil cible
**Plans**: 7 plans
- [x] 15-01-catalogues-types-PLAN.md — Types DietarySeverity/Conflict/GuestProfile + 3 catalogues canoniques (EU allergens, intolérances, régimes)
- [x] 15-02-parser-famille-invites-PLAN.md — Extension parseFamille/serializeFamille food_* + parseInvites/serializeInvites + tests round-trip PREF-05
- [x] 15-03-check-allergens-PLAN.md — Fonction pure checkAllergens TDD + 5 tests ARCH-03
- [x] 15-04-allergen-banner-p0-PLAN.md — Composant AllergenBanner P0 SAFETY (PREF-11) + test enforcement statique
- [x] 15-05-hook-ecran-dietary-PLAN.md — Hook useVaultDietary + écran dietary.tsx + ProfileFoodCard + lien more.tsx
- [x] 15-06-integration-recipe-meals-PLAN.md — RecipeViewer (bandeau + badges inline + ConvivesPickerModal) + MealConflictRecap dans meals.tsx
- [x] 15-07-saisie-vocale-PLAN.md — extractDietaryConstraints + VoicePreviewModal + câblage DictaphoneRecorder
**UI hint**: yes

### Phase 16: Codex contenu
**Goal**: Le fichier `lib/codex/content.ts` existe et produit un tableau `CodexEntry[]` typé, précis et non-drifté, importé directement depuis les constantes engine existantes — validé en isolation avant toute UI
**Depends on**: Rien (pure data, aucune UI)
**Requirements**: CODEX-01, CODEX-02, CODEX-03, CODEX-04, CODEX-05
**Success Criteria** (what must be TRUE):
  1. `lib/codex/content.ts` compile sans erreur TypeScript et exporte un tableau `CodexEntry[]` couvrant les 10 catégories définies (Cultures, Animaux, Bâtiments productifs, Craft, Tech tree, Compagnons, Loot box, Drops saisonniers, Sagas, Quêtes)
  2. Zéro valeur numérique (cycles, rendements, taux de drop, coûts) n'est codée en dur dans le fichier — chaque stat est lue depuis `CROP_CATALOG`, `BUILDING_CATALOG`, `TECH_TREE` ou les constantes engine correspondantes
  3. La mécanique "pluies dorées" est documentée avec le taux de déclenchement exact et la liste des drops possibles, tels que définis dans les constantes engine
  4. Les entrées `dropOnly` (orchidée, rose dorée, truffe, fruit du dragon) sont marquées avec le flag approprié permettant à l'UI de Phase 17 d'afficher "???" selon l'inventaire du profil
**Plans**: 5 plans
- [x] 16-01-fondations-types-i18n-PLAN.md — Types CodexEntry, helpers stats getters, squelette i18n FR+EN et namespace codex câblé
- [x] 16-02-cultures-animaux-loot-PLAN.md — 15 crops + ~18 inhabitants + 8 loot entries avec lore bilingue (CODEX-04, CODEX-05)
- [x] 16-03-batiments-craft-tech-companions-PLAN.md — 4 buildings + 24 craft + 10 tech + 5 companions avec lore bilingue
- [x] 16-04-sagas-quetes-seasonal-PLAN.md — 4 sagas + 15 quests + 8 seasonal events avec lore bilingue
- [x] 16-05-aggregation-validation-PLAN.md — lib/codex/content.ts agrège les 10 catégories + test Jest d'intégrité sourceId + parité i18n + dropOnly

### Phase 17: Codex UI
**Goal**: L'utilisateur peut ouvrir le codex de la ferme depuis un bouton "?" dans le HUD existant, naviguer par catégories, rechercher une entrée, et accéder au bouton de replay du tutoriel
**Depends on**: Phase 16
**Requirements**: CODEX-06, CODEX-07, CODEX-08, CODEX-09, CODEX-10
**Success Criteria** (what must be TRUE):
  1. Un bouton "?" dans le HUD existant de l'écran ferme ouvre la modale codex en `pageSheet` avec drag-to-dismiss, sans ajouter un nouveau bouton flottant qui surcharge l'UI
  2. L'utilisateur peut filtrer les entrées du codex par texte libre — la recherche normalise les accents et la casse, et s'exécute sans latence perceptible sur la liste complète
  3. Les entrées `dropOnly` non encore découvertes par le profil actif s'affichent en silhouette "???" — les entrées découvertes affichent leurs stats complètes
  4. La liste du codex utilise `FlatList` virtualisé, sans dégradation de performance mesurable par rapport à l'état pré-Phase 17 de l'écran ferme
  5. La modale contient un bouton "Rejouer le tutoriel" fonctionnel qui appelle `resetScreen('farm_tutorial')` et ferme la modale
**Plans**: TBD
**UI hint**: yes

### Phase 18: Tutoriel ferme
**Goal**: Un utilisateur arrivant pour la première fois sur l'écran ferme voit un tutoriel immersif qui explique la boucle de jeu en 5 étapes, peut le passer à tout moment, et peut le rejouer depuis le codex
**Depends on**: Phase 16, Phase 17
**Requirements**: TUTO-01, TUTO-02, TUTO-03, TUTO-04, TUTO-05, TUTO-06, TUTO-07, TUTO-08
**Success Criteria** (what must be TRUE):
  1. Le tutoriel se déclenche automatiquement au premier affichage de l'écran ferme sur l'appareil (flag persisté dans SecureStore via `HelpContext.markScreenSeen('farm_tutorial')`) et ne se redéclenche pas lors des visites suivantes
  2. L'utilisateur peut passer le tutoriel à n'importe quelle étape via un bouton "Passer" — le flag "vu" est positionné immédiatement au skip, sans retrigger
  3. Le tutoriel couvre 5 étapes ordonnées (intro narrative, plantation, cycle croissance et récolte, gain XP/loot, où aller plus loin) avec un overlay spotlight SVG qui met en évidence l'élément cible tout en laissant le décor visible
  4. Pendant toutes les étapes du tutoriel, les animations de `WorldGridView` sont mises en pause — le frame rate du tutoriel reste à 58 fps minimum sur le device TestFlight
  5. Le tutoriel est rejouable depuis le bouton "Rejouer le tutoriel" du codex (CODEX-10) et aucun nouveau provider n'est créé — le tutoriel s'appuie exclusivement sur `HelpContext` étendu
**Plans**: TBD
**UI hint**: yes

## Progress (v1.2)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 15. Préférences alimentaires | v1.2 | 7/7 | Complete    | 2026-04-08 |
| 16. Codex contenu | v1.2 | 5/5 | Complete    | 2026-04-08 |
| 17. Codex UI | v1.2 | 3/3 | Complete    | 2026-04-08 |
| 18. Tutoriel ferme | v1.2 | 0/? | Not started | - |

## Archived Milestones

- **v1.0 Stabilisation** — détails dans `milestones/v1.0-ROADMAP.md` *(si archivé rétro)*
- **v1.1 Ferme Enrichie** — détails dans `milestones/v1.1-ROADMAP.md`
  - 9 phases initialement planifiées + Phase 8.1 insérée + Phases événements/parité/quêtes ajoutées en cours de route
  - 22 plans, 36 tâches livrées
  - Phase 12 (Templates onboarding) supprimée explicitement avant clôture
  - COMP-07 abandonné (compagnon avatar tab bar)
