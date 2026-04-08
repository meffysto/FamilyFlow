# Research Summary — FamilyFlow v1.2 Confort & Découverte

**Project:** FamilyFlow v1.2 "Confort & Découverte"
**Domain:** React Native / Expo family app — 3 additive features on mature codebase
**Researched:** 2026-04-07
**Confidence:** HIGH (direct codebase audit + verified external sources)

---

## Executive Summary

- **Zero new dependencies.** Every UI primitive, storage mechanism, and animation pattern needed for all 3 features already exists in the codebase. The work is integration and composition, not installation.
- **Allergen safety is a P0 hard requirement.** All 4 research agents independently converged on this: the `allergie` severity level must be rendered with a non-dismissible badge, stored via canonical IDs (not free-text), and checked via a pure lib function — never in component render logic. This cannot be retrofitted after data lands in the vault.
- **Two architectural decisions require user input before work begins** (storage file for dietary preferences, and profile-scoped vs. device-global tutorial seen-flag). These are the only real scope/design forks the research surfaced.
- **Phase order is clear:** Dietary Preferences first (self-contained, daily value, P0 safety), then Codex Content (data-only, no UI), then Codex UI, then Tutorial last (depends on both codex content for text reuse and codex modal for replay button).
- **The god hook (`useVault.ts`, 3431 lines) must not grow.** Dietary constraints belong on the `Profile` type, not as a new top-level state slice. This is the single most important architectural constraint for Phase 1.

FamilyFlow v1.2 adds features that are valuable on day one of delivery: dietary preferences let the app warn about allergens in planned meals, the codex makes the farm navigable for every family member, and the tutorial removes the "I have no idea what to do" friction at first launch. None of these require rethinking the architecture — they extend patterns that already exist and have been proven in production.

The main risk is not technical difficulty but safety correctness (allergen dismissibility), content drift (hardcoding farm stats instead of reading from engine constants), and animation perf on a screen (`tree.tsx`) that already had an OOM crash. All three risks have documented mitigations in PITFALLS.md and are preventable with explicit constraints in the phase specs.

---

## The 3 Features at a Glance

| Feature | Table Stakes | Differentiators | Complexity |
|---------|-------------|-----------------|------------|
| **Préférences alimentaires** | Per-profile saisie (allergie / intolérance / régime / aversion), flag badge sur recette, flag sur planning repas, édition depuis écran profil | Invités légers (type `Guest`, sans profil complet), résumé combiné pour repas partagé | LOW–MEDIUM — extend parser + new domain hook + badge UI |
| **Codex ferme** | Modal "?" sur tree.tsx, catégories (cultures/bâtiments/tech/mécaniques), stats lus depuis constantes, bouton "Revoir le tutoriel" | Entrées locked "???" pour crops dropOnly non encore découverts, tri par pertinence selon niveau profil actif | LOW — static TS constants + existing UI components |
| **Tutoriel ferme** | Déclenchement auto au premier accès, skippable dès l'étape 1, rejouable depuis codex, explique la boucle de base en 3–5 étapes | Spotlight overlay sur éléments UI réels, narration par le compagnon actif, récompense XP à la complétion | LOW (MVP sans spotlight) → MEDIUM (spotlight via react-native-svg déjà installé) |

---

## Key Findings

### Stack — Aucune dépendance ajoutée

Le codebase contient déjà tout le nécessaire. Récapitulatif confirmé par l'agent STACK :

| Besoin | Solution existante |
|--------|--------------------|
| Overlay/spotlight tutoriel | `react-native-svg ^15.12.1` déjà installé — `<Mask>` + `<Rect>` ~20 lignes |
| Coach marks séquentiels | `CoachMark`, `CoachMarkOverlay`, `ScreenGuide` dans `components/help/` |
| Vu/pas vu + replay | `HelpContext` — `hasSeenScreen`, `markScreenSeen`, `resetScreen` via SecureStore |
| Codex UI | `ScrollView`, `CollapsibleSection`, `MarkdownText`, `Chip`, `Badge`, `ModalHeader` |
| Recherche codex | `lib/search.ts` — `normalize()` déjà implémentée ; `Array.filter` suffisant pour <100 entrées |
| Stockage préférences | `lib/parser.ts` + `lib/types.ts` — patterns existants à étendre |
| Liste allergènes | Constante statique `constants/allergens.ts` — liste EU fixe à 14 items, pas de lib |

Rejetés explicitement : `react-native-copilot` (broken new arch RN 0.81 + Expo 54, 101 issues ouverts), `fuse.js` (surcoût bundle disproportionné pour <100 entrées), toute lib d'allergènes npm (web-focused, liste EU est fixe et réglementaire).

**Commande npm install : aucune.**

### Features — Périmètre v1.2

**À livrer en v1.2 (consensus des 4 agents) :**
- Saisie préférences alimentaires par profil (4 types : allergie / intolérance / régime / aversion)
- Type `Guest` minimal + CRUD (nom + emoji + contraintes, sans profil complet)
- Flag badge sur carte recette selon profil actif
- Flag warning sur planning repas hebdomadaire
- Codex ferme modal (bouton "?" sur tree.tsx) — 5 catégories, stats lus depuis constantes
- Entrées cultures dropOnly affichées "???" si non encore découvertes par le profil
- Tutoriel ferme 4 étapes, skippable, déclenchement auto, rejouable depuis codex

**À déférer à v1.3 :**
- Sélection "qui mange ce repas" (`attendees` sur `MealItem`) — change le modèle de données
- Tutoriel progressif par paliers (phases 2 et 3 déclenchées à la découverte de nouvelles mécaniques)
- Spotlight overlay sur UI réelle (post-validation du tutoriel de base)
- Invité épinglé sur créneau repas

**À déférer à v2+ :**
- Résumé contraintes combinées pour repas partagé (dépend des attendees)
- Narration compagnon dans tutoriel

### Architecture — Nouveaux fichiers et fichiers modifiés

**Nouveaux fichiers :**

| Fichier | Rôle |
|---------|------|
| `lib/types.ts` additions | `DietaryConstraint`, `DietaryProfile`, `DietaryConstraintSeverity` |
| `lib/parser.ts` additions | `PREFERENCES_FILE`, `parsePreferences`, `serializePreferences` |
| `lib/dietary-utils.ts` | Pure function `computeRecipeConflicts()` |
| `lib/codex/content.ts` | `CODEX_ENTRIES[]` — importe depuis engine constants, ajoute prose |
| `lib/codex/index.ts` | Barrel export |
| `hooks/useVaultPreferences.ts` | Domain hook CRUD préférences |
| `constants/allergens.ts` | `EU_ALLERGENS` (14 items) + `keywords[]` pour matching |
| `components/mascot/FarmCodexModal.tsx` | Codex modal (tabs + search + drill-down) |
| `components/mascot/FarmTutorialOverlay.tsx` | Tutorial overlay absolu sur tree.tsx |

**Fichiers modifiés :**

| Fichier | Changement |
|---------|-----------|
| `hooks/useVault.ts` | Wire `useVaultPreferences` dans VaultState — pas de nouveau `useState` top-level |
| `lib/types.ts` | Extend `Profile` avec `dietaryConstraints?` ; ajouter `convives?` sur `MealItem` |
| `lib/parser.ts` | Pair parse/serialize pour le fichier préférences ; `convives` parsing |
| `app/(tabs)/tree.tsx` | `showCodex` state ; bouton "?" dans HUD existant ; `FarmCodexModal` ; `FarmTutorialOverlay` |
| `app/(tabs)/meals.tsx` | Conflict badge sur meal cards ; convives picker ; conflits dans détail recette |
| `contexts/HelpContext.tsx` | Support profil-scoped keys si décision prise en ce sens (voir Open Questions) |

### Critical Pitfalls

1. **Allergen silencing — classe de bug à gravité fatale.** Toute contrainte de type `allergie` doit avoir un badge non-dismissible, stocké via ID canonique (pas free-text), et vérifié dans une pure function `lib/dietary-utils.ts`. Jamais de logique "Ne plus afficher" sur les allergènes. Jamais de `string[]` plat sans sévérité. Jamais de check dans le composant sans `useMemo` avec dépendances correctes.

2. **Codex content drift.** Tous les chiffres dans le codex (tâches par stade, coût de récolte, drops, prix tech) doivent être lus depuis `CROP_CATALOG`, `BUILDING_CATALOG`, `TECH_TREE` au render time. Zéro chiffre hardcodé dans les strings. Un PR qui change `tasksPerStage` sans toucher le codex doit être rejeté.

3. **Tutorial animation jank sur tree.tsx.** Cet écran a déjà eu un crash OOM (commit `260404-qvz`). L'overlay tutoriel doit : (a) utiliser `runOnUI` / `useAnimatedStyle` pour les animations de spotlight, (b) mettre en pause les timers WorldGridView pendant les étapes actives, (c) rester sous 5 `useSharedValue` nouveaux, (d) préférer `withTiming` à `withSpring` pour les mouvements de spotlight. Frame rate minimum acceptable : 58 fps sur device TestFlight.

4. **useVault.ts god hook — ne pas le gonfler.** Les contraintes alimentaires voyagent dans le type `Profile`, pas comme slice top-level. Zéro nouveau `useState` dans `useVaultInternal`. Zéro nouvelle entrée dans le `Promise.allSettled` de `loadVaultData`. Zéro nouvelle dépendance dans le `useMemo` à 90 dépendances.

5. **Tutorial seen-flag — scope profil vs device.** Décision à prendre avant d'écrire une ligne de code : `markScreenSeen('farm_tutorial')` global ou `markProfileScreenSeen(profileId, 'farm_tutorial')`. Le choix impacte l'API de `HelpContext` et la mécanique replay du codex.

---

## Décision de Stockage — Divergence à Arbitrer

Les agents STACK et ARCHITECTURE ont recommandé deux approches différentes. Cette décision doit être arrêtée avant la Phase 1.

**Option A — STACK.md + PITFALLS.md : flat keys dans le bloc profil de `famille.md`**

```
food_allergies: arachides,noix
food_intolerances: lactose
food_regimes: végétarien
food_aversions: champignons
```

- Avantage : colocalisé avec les données profil existantes, pattern identique à `farm_crops`/`farm_tech`
- Avantage PITFALLS : les contraintes voyagent avec le profil déjà chargé — aucun nouveau top-level state dans `useVault.ts`
- Risque : `parseFamille()` est le chemin critique de parse — modification de blast radius élevé
- Obsidian : lisible mais moins structuré qu'une section dédiée

**Option B — ARCHITECTURE.md : fichier dédié `05 - Famille/Préférences alimentaires.md` avec H2 par personne**

```markdown
## Papa
- allergie: arachides
- régime: végétarien

## Invités
- invité: Grand-mère | allergie: noix
```

- Avantage : isolé du chemin critique `parseFamille`, pattern éprouvé (identique à `Souhaits.md`)
- Avantage : invités dans la section `## Invités` du même fichier, sans fichier supplémentaire
- Inconvénient : nouveau fichier vault, nouveau branch dans `loadVaultData`, nouveau pair parse/serialize
- Obsidian : plus lisible, structure claire

**Recommandation de synthèse :** Option A est préférable si la priorité est de limiter la surface de changement dans `useVault.ts` et `lib/parser.ts`. Option B est préférable si la lisibilité Obsidian et l'isolation du parse path sont prioritaires. Les deux sont implémentables correctement.

---

## Chevauchement HealthRecord — Question Ouverte

`HealthRecord.allergies` existe déjà comme `string[]` dans le domaine santé, jamais cross-référencé avec les recettes.

**Recommandation :** Séparation pour v1.2. Le nouveau champ `dietaryConstraints` sur `Profile` est indépendant de `HealthRecord`. Documenter la duplication connue avec un commentaire `// TODO: consolider avec HealthRecord.allergies en v1.3`. Une consolidation en v1.2 dépasse le scope du milestone et touche au parser santé.

---

## Implications pour le Roadmap

### Phase 1 — Préférences alimentaires
**Rationale :** Indépendant des 2 autres features, valeur quotidienne immédiate, contient le seul risque P0 (sécurité allergènes) qui doit être établi correctement avant tout le reste.
**Delivers :** Type `DietaryConstraint` + `DietaryConstraintSeverity` + `constants/allergens.ts` + parser pair + domain hook `useVaultPreferences` + UI édition profil + badge recette + warning planning repas + type `Guest` + CRUD invités
**Avoids :** Allergen silencing (P1), stale profile check (P2), i18n mismatch (P3), god hook inflation (P10)
**Research flag :** Aucune recherche de phase nécessaire — patterns directs du codebase

### Phase 2 — Codex Contenu
**Rationale :** Fichier de données pur, zéro UI, zéro risque de régression. Séparer du codex UI permet de valider la précision du contenu indépendamment.
**Delivers :** `lib/codex/content.ts` avec `CODEX_ENTRIES[]` important depuis `CROP_CATALOG`, `BUILDING_CATALOG`, `TECH_TREE`, `CRAFT_RECIPES` + barrel `lib/codex/index.ts`
**Avoids :** Codex content drift (P5) — contrainte architecturale établie dès la première PR
**Research flag :** Aucune recherche de phase nécessaire

### Phase 3 — Codex UI
**Rationale :** Dépend de Phase 2 (contenu), indépendant du tutoriel. Livrable visible utilisateur. Bouton "Revoir le tutoriel" inclus mais pointe vers tutoriel vide jusqu'à Phase 4.
**Delivers :** `FarmCodexModal.tsx` (tabs + search + drill-down) + bouton "?" intégré dans HUD existant de tree.tsx + entrées dropOnly "???" + `FlatList` avec virtualisation + lazy-load
**Avoids :** Crowded tree.tsx UI (P11), codex perf ScrollView (P6), `useVault()` pour contenu statique (P11)
**Research flag :** Aucune recherche de phase nécessaire

### Phase 4 — Tutoriel Ferme
**Rationale :** Dépend de Phase 2 (réutilise entrées catégorie `mécanique`) et Phase 3 (bouton replay). Vient en dernier pour être testé sur device avec ferme entièrement fonctionnelle.
**Delivers :** `FarmTutorialOverlay.tsx` (overlay absolu, 4 étapes, Reanimated 4) + déclenchement via `HelpContext` + "Passer" dès l'étape 1 + `markScreenSeen` sur fin/skip + replay via codex + pause WorldGridView pendant tutoriel + validation `TutorialStep.targetId` contre catalogs + validation frame rate 58+ fps sur TestFlight
**Avoids :** Tutorial jank (P8), content breaks (P9), HelpProvider duplication (P12), seen-flag scope (P7)
**Research flag :** Spike recommandé de 2h en début de phase pour valider SVG spotlight + Reanimated 4 worklet thread si spotlight choisi pour v1.2

### Phase Ordering Rationale

- Préférences en premier : risque P0 (sécurité allergènes) doit être établi en production et validé avant d'ajouter de la complexité
- Codex contenu séparé de codex UI : la précision des données peut être relue sans dépendre d'une UI compilable
- Tutorial en dernier : le composant `FarmTutorialOverlay` réutilise les entrées catégorie `mécanique` de `lib/codex/content.ts` pour ses descriptions d'étapes — la dépendance est explicite
- Chaque phase est non-cassante et livrable indépendamment sur TestFlight

### Research Flags

Phases nécessitant une recherche approfondie pendant la planification :
- **Phase 4 (optionnel) :** Si spotlight SVG retenu pour v1.2, spike de validation Reanimated 4 worklet thread requis — le pattern est documenté mais absent du codebase

Phases avec patterns standards (pas de recherche-phase nécessaire) :
- **Phase 1 :** Parser patterns directement lus dans `lib/parser.ts` et `lib/types.ts`
- **Phase 2 :** Import direct depuis engine constants, zero dépendance externe
- **Phase 3 :** Tous les composants UI existent, pattern modal documenté dans `BuildingDetailSheet.tsx`

---

## Open Questions pour le Développeur

Ces questions doivent être résolues avant ou pendant la rédaction des specs de phase.

**Q1 — Stockage préférences (bloquant Phase 1 spec) :**
Option A (flat keys dans le bloc profil de `famille.md`, pattern `farm_crops`) ou Option B (fichier dédié `05 - Famille/Préférences alimentaires.md`, pattern `Souhaits.md`) ? PITFALLS penche vers A. ARCHITECTURE penche vers B. Décidez avant de toucher à `lib/parser.ts`.

**Q2 — Tutorial seen-flag : profil ou device ? (bloquant Phase 4 spec) :**
Chaque profil famille doit-il avoir sa propre expérience "premier lancement" ferme, ou un seul vu par device suffit ? Si profil-scoped, `HelpContext` doit être étendu avec `markProfileScreenSeen(profileId, screenId)` avant la Phase 4.

**Q3 — Consolidation `HealthRecord.allergies` (non bloquant v1.2) :**
Laisser la duplication documentée pour v1.2 ou consolider maintenant ? La consolidation touche au parser santé et dépasse le scope du milestone — recommandé de déférer, mais confirmez.

**Q4 — Invités : section dans le fichier préférences ou fichier vault séparé ? (lié à Q1) :**
ARCHITECTURE.md propose `## Invités` dans le fichier préférences. FEATURES.md mentionne `04 - Personnes/invites.md`. Une fois Q1 arbitrée, confirmez si les invités vivent dans le même fichier que les préférences ou dans un fichier séparé.

**Q5 — Spotlight overlay : v1.2 ou v1.3 ? (scope MVP tutoriel) :**
Le MVP tutoriel sans spotlight (bulles de dialogue avec flèches) est livrable et plus sûr pour tree.tsx. Le spotlight via `react-native-svg` est MEDIUM complexity avec risque perf documenté. Voulez-vous le spotlight en v1.2 (avec validation frame rate obligatoire) ou le déférer à v1.3 ?

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Codebase lu directement ; dépendances vérifiées via npm registry et GitHub issues |
| Features | MEDIUM | Patterns écosystème (Yummly, jeux mobiles) + analyse codebase directe ; scope invités légèrement incertain |
| Architecture | HIGH | Basé sur lecture directe de `useVault.ts`, `lib/parser.ts`, `lib/types.ts`, `HelpContext.tsx`, `tree.tsx` |
| Pitfalls | HIGH | Audit direct du codebase + `CONCERNS.md` + patterns RN/Expo connus ; crash OOM tree.tsx documenté dans git |

**Overall confidence : HIGH**

### Gaps résiduels

- **Matching allergen/ingredient en Cooklang :** Le matching textuel (`keywords[]` normalisé vs nom ingrédient) aura des faux négatifs pour noms composés ou orthographes créatives. Acceptable pour v1.2 — documenter comme limitation connue dans la spec Phase 1.
- **Perf codex sur anciens iPhones :** Le `FlatList` avec `windowSize={5}` est la mitigation recommandée mais n'a pas été benchmarké sur le device TestFlight cible. Valider en Phase 3.
- **SVG spotlight worklet thread (Reanimated 4) :** Classé MEDIUM confidence dans STACK.md. Pattern absent du codebase actuel. Spike de validation recommandé en début de Phase 4 si spotlight retenu pour v1.2.

---

## Sources

### Primary (HIGH confidence — lecture directe codebase)
- `hooks/useVault.ts`, `lib/parser.ts`, `lib/types.ts`, `lib/mascot/types.ts`, `lib/mascot/tech-engine.ts`, `lib/mascot/farm-engine.ts`
- `contexts/HelpContext.tsx`, `components/help/CoachMark.tsx`, `components/help/ScreenGuide.tsx`
- `app/(tabs)/tree.tsx`, `app/(tabs)/meals.tsx`, `components/mascot/BuildingDetailSheet.tsx`
- `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/STATE.md`
- EU Regulation 1169/2011 — liste des 14 allergènes majeurs (fixe, réglementaire)

### Secondary (MEDIUM confidence — sources externes vérifiées)
- npm registry — `react-native-copilot@3.3.3`, `fuse.js@7.3.0`, `react-native-walkthrough-tooltip@1.6.0`
- GitHub Issues `mohebifar/react-native-copilot` — #332 (new arch broken), #351 (Expo 54 scroll/position broken), 101 open issues, vérifié 2026-04-07
- Apple Developer — Onboarding for Games guidelines
- Nielsen Norman Group — Progressive Disclosure
- EUFIC — EU 14 allergen list

### Tertiary (MEDIUM confidence — patterns jeux mobiles)
- Zigpoll — Mobile game onboarding best practices 2025
- jontopielski.com — Tutorial design methods
- Food allergy app UX patterns (foodsconnected.com)

---
*Research completed: 2026-04-07*
*Ready for roadmap: yes*
*Agents: STACK (HIGH), FEATURES (MEDIUM), ARCHITECTURE (HIGH), PITFALLS (HIGH)*
