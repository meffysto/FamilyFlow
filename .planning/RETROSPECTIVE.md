# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2 — Confort & Découverte

**Shipped:** 2026-04-08
**Phases:** 4 (15-18) | **Plans:** 19 | **Tasks:** 14
**Timeline:** 2026-04-07 → 2026-04-08 (2 jours)
**Stats:** 107 commits, 125 fichiers, +19 678 / -1 643 lignes

### What Was Built

- **Préférences alimentaires** (Phase 15) — Types + 3 catalogues canoniques (14 allergènes UE, 8 intolérances, 8 régimes), parser bidirectionnel `famille.md` + nouveau fichier `Invités.md`, fonction pure `checkAllergens` TDD, AllergenBanner P0 SAFETY non-dismissible avec enforcement statique TypeScript, RecipeViewer enrichi (bandeau + badges + ConvivesPickerModal), MealConflictRecap planificateur, saisie vocale via DictaphoneRecorder + extractDietaryConstraints IA
- **Codex contenu** (Phase 16) — `lib/codex/content.ts` agrège 111 entrées sur 10 catégories importées directement des constantes engine (CROP_CATALOG, BUILDING_CATALOG, TECH_TREE…), 220 tests Jest d'intégrité anti-drift, parité i18n FR+EN, flags `dropOnly` pour contenus rares
- **Codex UI** (Phase 17) — FarmCodexModal livré avec 11 catégories (onglet Aventures ajouté in-phase), sprites pixel art natifs, recherche normalisée NFD, FlatList virtualisée, mini-modal détail kid-friendly, bouton "Rejouer le tutoriel"
- **Tutoriel ferme** (Phase 18) — FarmTutorialOverlay 5 étapes format mixte (cartes narratives plein écran + coach marks contextuels spotlight), HelpContext étendu avec `activeFarmTutorialStep`, pause WorldGridView (60fps garanti), CoachMarkOverlay étendu avec prop `borderRadius` (technique borderWidth géant, zéro SVG), rejouabilité depuis codex

### What Worked

- **Séparation contenu/UI en phases distinctes** — Phase 16 (contenu pur) validée en isolation via 220 tests anti-drift avant toute UI Phase 17. Aucun rework nécessaire au moment du câblage UI.
- **P0 SAFETY first** — PREF-11 (bandeau allergène non-dismissible) implémenté en tout premier (Plan 15-04) avec enforcement statique TypeScript (zéro prop dismiss dans AllergenBannerProps). Impossible d'introduire un bug de sécurité par régression.
- **ARCH-05 tenue sur 4 phases** — contrainte "zéro nouvelle dépendance npm" respectée bout à bout. Preuve que les primitives du codebase suffisent pour des features complexes (spotlight tutoriel, codex virtualisé, badges conflits).
- **Helpers anti-drift D-02** — chaque entrée codex dérive ses stats via `.map(source => CodexEntry)` sans jamais dupliquer de valeur numérique. Le compilateur TypeScript + les tests Jest garantissent zéro drift entre codex et engine.
- **Parser défensif Obsidian** — `parseFoodCsv` gère CSV et YAML liste natif (Array.isArray), `serializeFamille` omet les clés `food_*` vides. Compatibilité bidirectionnelle PREF-05 préservée.

### What Was Inefficient

- **Phase 18 Plan 04** — 10 fixes itératifs pour caler précisément les anchors CROP_CELLS du tutoriel spotlight. Le plan initial sous-estimait la friction entre coordonnées Modal/layout WorldGridView (wrapping dans Modal pour aligner les coords est un fix tardif).
- **Phase 16 — 9 bugs rattrapés in-phase en Phase 17** — le namespace i18n Phase 16 avait des trous que seule l'UI Phase 17 a révélés (clés manquantes, sprites absents). La validation 220 tests Jest ne couvrait pas les sprites ni certaines clés dynamiques.
- **Auto-extract des SUMMARY.md** — plusieurs plans ont des sections one_liner manquantes ou pointant sur "1. [Rule 3 - Blocking]" (artefact du plan-check). L'extraction automatique du MILESTONES.md a produit du bruit qu'il a fallu réécrire à la main.

### Patterns Established

- **P0 SAFETY enforcement statique** — quand une contrainte de sécurité existe, l'exprimer dans les types TypeScript (ex: zéro prop dismiss dans le composant) pour interdire la régression par compilation plutôt que par convention
- **Séparation contenu/UI pour les grosses features data-driven** — livrer d'abord un fichier de données pur + tests d'intégrité, ensuite l'UI qui consomme. Évite le rework UI quand le contenu change.
- **CoachMarkOverlay avec borderRadius** — technique borderWidth géant (Option B) réutilisable pour tous futurs tutoriels spotlight sans ajouter de dépendance SVG
- **Parser défensif food_* sur famille.md** — pattern plat (une clé par catégorie) cohérent avec `farm_crops`/`farm_tech` existants, tolère l'absence et les formats CSV ou YAML liste
- **i18n strict FR+EN D-16** — parité stricte enforced à chaque phase, pas de clé ajoutée à une seule langue

### Key Lessons

1. **Les tests anti-drift sont insuffisants si l'UI n'est pas testée en même temps** — les 220 tests Jest de Phase 16 n'ont pas détecté les clés i18n manquantes parce que l'UI n'existait pas encore. Pour la prochaine phase data-driven, prévoir un test "render smoke" qui instancie quelques entrées dans l'UI réelle dès la fin du contenu.
2. **Spotlight tutoriel ≠ Dialog modal** — envelopper l'overlay dans `<Modal>` pour aligner les coordonnées mesurées par `measureInWindow` est un détail critique facile à manquer. À documenter pour tout futur tutoriel spotlight.
3. **P0 SAFETY doit être tout premier plan de la phase** — PREF-11 avant tout autre badge a empêché toute tentative ultérieure d'ajouter un mécanisme de dismiss. Pattern à reproduire.
4. **ARCH-05 "zéro dépendance" est atteignable** — même pour un tutoriel spotlight, un codex virtualisé et de la détection d'allergènes. Force la créativité avec les primitives existantes et garde le bundle léger.

### Cost Observations

- Sessions : 2 jours intenses (2026-04-07 → 2026-04-08)
- Commits : 107 (moyenne ~54/jour)
- Lignes : +19 678 / -1 643 sur 125 fichiers — velocity élevée grâce à la parallélisation inter-plans (waves)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.1 | ~15 | 9 (+1) | 22 | Waves parallèles activées, branching `none` |
| v1.2 | 2 | 4 | 19 | Séparation contenu/UI pour Codex, ARCH-05 enforcement |

### Cumulative Quality

| Milestone | Tests ajoutés | Zero-Dep Additions |
|-----------|---------------|-------------------|
| v1.1 | ~13 fichiers | Respectée |
| v1.2 | +220 tests Jest codex anti-drift + tests dietary + tests parser | Respectée (4 phases) |

### Top Lessons (Verified Across Milestones)

1. **La ferme/gamification est le levier de motivation, pas le produit** — v1.1 + v1.2 confirment : chaque feature renforce la boucle tâches → XP/récoltes → progression ferme → envie de refaire
2. **Parser défensif Obsidian first** — toute nouvelle feature qui touche le vault doit prévoir parseur défensif + serialize propre + test round-trip. Vérifié sur v1.1 (gami-{id}.md) et v1.2 (food_*, Invités.md)
3. **Enforcement statique > convention** — TypeScript strict sur les contraintes critiques (P0 SAFETY, anti-drift) évite les régressions mieux que les revues de code
