# Requirements: FamilyFlow

**Defined:** 2026-04-07
**Milestone:** v1.2 — Confort & Découverte
**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

## v1.2 Requirements

Requirements for milestone v1.2 — Confort & Découverte. L'app retient les détails que la famille oublie (préférences alimentaires) et explique enfin la ferme (codex + tutoriel).

### Préférences alimentaires (Famille)

- [x] **PREF-01**: Le modèle de données distingue 4 sévérités : `allergie` (vital, jamais ignorable), `intolerance` (gênant), `regime` (choix : végé, halal…), `aversion` (préférence personnelle)
- [x] **PREF-02**: Chaque membre famille a ses préférences alimentaires stockées comme clés plates dans `famille.md` (pattern identique à `farm_crops`/`farm_tech`) — une nouvelle clé par catégorie : `food_allergies`, `food_intolerances`, `food_regimes`, `food_aversions`
- [x] **PREF-03**: Un catalogue canonique des 14 allergènes UE (gluten, œufs, arachides, lait…) sert d'autocomplete et garantit la stabilité des IDs même quand l'utilisateur tape en français ou anglais
- [x] **PREF-04**: L'utilisateur peut ajouter, modifier et supprimer une préférence alimentaire pour un membre famille via une UI dans le détail profil
- [x] **PREF-05**: La compatibilité bidirectionnelle Obsidian est préservée — modifier `famille.md` à la main reste valide, le parser tolère l'absence de toutes les clés food_*

### Préférences alimentaires (Invités)

- [x] **PREF-06**: Un fichier dédié `02 - Famille/Invités.md` stocke la liste des invités récurrents avec une section H2 par invité (nom + préférences, pas de gamification ni profil complet) — pattern identique à `wishlist`
- [x] **PREF-07**: L'utilisateur peut créer, modifier et supprimer un invité avec ses préférences depuis l'écran préférences alimentaires
- [x] **PREF-08**: Les invités apparaissent dans le sélecteur de "qui mange ce soir" au même titre que les membres famille

### Détection des conflits recettes / repas

- [x] **PREF-09**: Une fonction pure `checkAllergens(recipe, profileIds)` dans `lib/dietary.ts` croise les ingrédients d'une recette `.cook` avec les préférences des convives sélectionnés et retourne la liste des conflits par sévérité
- [x] **PREF-10**: L'écran détail recette affiche un badge de conflit visuel quand une préférence est touchée — couleurs et iconographie distinctes par sévérité (rouge non-dismissible pour `allergie`, orange pour `intolerance`, jaune pour `regime`/`aversion`)
- [x] **PREF-11**: **[P0 SAFETY]** Un conflit de sévérité `allergie` ne peut JAMAIS être masqué ou dismissé par l'utilisateur — le badge reste visible en permanence sur l'affichage recette
- [x] **PREF-12**: Le planificateur de repas hebdomadaire affiche un récap des contraintes combinées quand plusieurs convives sont sélectionnés pour un repas
- [x] **PREF-13**: L'utilisateur peut saisir des préférences alimentaires à la voix via le `DictaphoneRecorder` existant — la transcription est interprétée par l'IA (Claude via `lib/ai-service.ts`) pour extraire les contraintes structurées (sévérité + items canoniques) et les ajouter au profil cible

### Codex ferme — Contenu

- [x] **CODEX-01**: Le contenu du codex est défini dans `lib/codex/content.ts` qui **importe directement** les constantes d'engine existantes (`CROP_CATALOG`, `BUILDING_CATALOG`, `TECH_TREE`, etc.) — interdiction de dupliquer les valeurs numériques pour éviter le drift
- [x] **CODEX-02**: Le codex couvre 10 catégories : Cultures, Animaux, Bâtiments productifs, Craft & recettes, Tech tree, Compagnons, Loot box & raretés, Drops saisonniers & événements, Sagas immersives, Quêtes coopératives
- [x] **CODEX-03**: Chaque entrée affiche les stats précises (cycle de pousse, rendement, conditions de déblocage, bonus, taux de drop) — pas de vulgarisation
- [x] **CODEX-04**: La mécanique des "pluies dorées" (drops aléatoires à la récolte) est documentée explicitement avec le taux de déclenchement et la liste des drops possibles
- [x] **CODEX-05**: Les contenus rares marqués `dropOnly` (orchidée, rose dorée, truffe, fruit du dragon) sont affichés en silhouette `???` tant que le profil ne les a pas découverts — basé sur `harvestInventory`

### Codex ferme — UI

- [x] **CODEX-06**: Une icône bouton "?" intégrée au HUD existant de l'écran ferme (`app/(tabs)/tree.tsx`) ouvre la modale codex — pas de nouveau bouton flottant qui surcharge l'UI
- [x] **CODEX-07**: La modale codex utilise le pattern existant `pageSheet` + drag-to-dismiss, avec navigation par catégories (liste à gauche / contenu à droite, ou tabs si plus simple)
- [x] **CODEX-08**: Une recherche textuelle filtre les entrées du codex avec normalisation accents/casse via `lib/search.ts` (pattern existant) — pas de Fuse.js
- [x] **CODEX-09**: Le rendu des listes utilise `FlatList` virtualisé (pas `ScrollView`) — anti-régression performance
- [x] **CODEX-10**: La modale codex contient un bouton "Rejouer le tutoriel" qui appelle `resetScreen('farm_tutorial')` puis ferme le codex

### Tutoriel ferme

- [ ] **TUTO-01**: Au premier affichage de l'écran ferme (`tree.tsx`) sur l'appareil, le tutoriel se déclenche automatiquement
- [ ] **TUTO-02**: Le flag "tutoriel vu" est persisté **globalement par appareil** dans `SecureStore` via `HelpContext.markScreenSeen('farm_tutorial')` — pas de scope par profil
- [ ] **TUTO-03**: Le tutoriel couvre minimum 5 étapes : (1) intro narrative, (2) plantation d'une culture, (3) cycle de croissance & récolte, (4) gain XP/loot, (5) où aller plus loin (codex)
  > **Note setup initial**: Avant le niveau 3 (stage `Graine`), l'utilisateur a 0 plots et aucune culture visible — la ferme est un terrain vide. Le tutoriel doit gérer ce cas : soit se déclencher seulement à partir du stage `Pousse` (quand il y a réellement quelque chose à montrer), soit adapter l'étape plantation en expliquant que les crops se débloquent au niveau 3.
- [x] **TUTO-04**: Chaque étape utilise un overlay spotlight avec cutout SVG (rond ou rectangle arrondi) qui met en évidence l'élément cible de la ferme tout en gardant le décor visible
- [ ] **TUTO-05**: Le tutoriel est skippable à tout moment via un bouton "Passer" qui marque le tutoriel comme vu
- [x] **TUTO-06**: Pendant les étapes du tutoriel, les animations de la ferme (`WorldGridView`) sont mises en pause pour garantir 60fps sur le tutoriel — anti-régression perf
- [ ] **TUTO-07**: Le tutoriel est rejouable à tout moment depuis le codex (CODEX-10)
- [x] **TUTO-08**: Le tutoriel utilise `HelpContext` étendu — interdiction de créer un nouveau provider (anti-pattern : pile de providers déjà à 8 niveaux)

### Architecture & Sécurité

- [x] **ARCH-03**: La fonction `checkAllergens` est testée unitairement avec au moins 5 cas (allergie évidente, intolérance évidente, faux positif évité, faux négatif détecté, recette sans ingrédient critique) — la sécurité allergène ne tolère pas de bug silencieux
- [x] **ARCH-04**: Le hook `useVault.ts` n'inflate pas — les préférences alimentaires sont embarquées dans le `Profile` existant via `parseProfile`/`serializeProfile` étendus, pas un nouveau slice de state ni un nouveau `useMemo`
- [ ] **ARCH-05**: Aucune nouvelle dépendance npm — toutes les UI primitives, le SVG (`react-native-svg` déjà installé) et les patterns sont déjà disponibles dans le codebase

## Future Requirements

Deferred to v1.3+.

- **PREF-FUT-01**: Sélecteur "qui mange ce soir" sur les `MealItem` du planning hebdomadaire (mutation du modèle de données meals — préférable de stabiliser PREF-12 d'abord)
- **PREF-FUT-02**: Consolidation `HealthRecord.allergies` (santé) avec les préférences alimentaires (cuisine) — chantier de migration parser dédié
- **CODEX-FUT-01**: Mécanique "Pokédex" avec tracking de découverte par profil et statistiques de complétion
- **TUTO-FUT-01**: Tutoriels contextuels pour les autres écrans complexes (budget OCR, sagas, quêtes coopératives)
- **PREF-FUT-03**: Suggestion de recettes compatibles automatique selon les convives sélectionnés

## Out of Scope

| Feature | Reason |
|---------|--------|
| Achat / IAP de packs codex | App familiale privée, pas de monétisation |
| Wiki en ligne / synchronisation cloud | Tout reste local + iCloud, le codex est généré du code |
| Édition utilisateur du codex | Le codex est statique, lié au code — pas d'édition libre |
| Tutoriel multi-langues alternatif | i18n FR/EN existant suffit, pas de doublage vidéo/audio |
| Reconnaissance d'image d'allergènes (photo recette manuscrite) | Hors scope, complexité disproportionnée pour valeur famille |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PREF-01 | Phase 15 | Complete |
| PREF-02 | Phase 15 | Complete |
| PREF-03 | Phase 15 | Complete |
| PREF-04 | Phase 15 | Complete |
| PREF-05 | Phase 15 | Complete |
| PREF-06 | Phase 15 | Complete |
| PREF-07 | Phase 15 | Complete |
| PREF-08 | Phase 15 | Complete |
| PREF-09 | Phase 15 | Complete |
| PREF-10 | Phase 15 | Complete |
| PREF-11 | Phase 15 | Complete |
| PREF-12 | Phase 15 | Complete |
| PREF-13 | Phase 15 | Complete |
| CODEX-01 | Phase 16 | Complete |
| CODEX-02 | Phase 16 | Complete |
| CODEX-03 | Phase 16 | Complete |
| CODEX-04 | Phase 16 | Complete |
| CODEX-05 | Phase 16 | Complete |
| CODEX-06 | Phase 17 | Complete |
| CODEX-07 | Phase 17 | Complete |
| CODEX-08 | Phase 17 | Complete |
| CODEX-09 | Phase 17 | Complete |
| CODEX-10 | Phase 17 | Complete |
| TUTO-01 | Phase 18 | Pending |
| TUTO-02 | Phase 18 | Pending |
| TUTO-03 | Phase 18 | Pending |
| TUTO-04 | Phase 18 | Complete |
| TUTO-05 | Phase 18 | Pending |
| TUTO-06 | Phase 18 | Complete |
| TUTO-07 | Phase 18 | Pending |
| TUTO-08 | Phase 18 | Complete |
| ARCH-03 | Phase 15 | Complete |
| ARCH-04 | Phase 15 | Complete |
| ARCH-05 | Phase 15-18 | Pending |
