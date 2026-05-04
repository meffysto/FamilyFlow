# FamilyFlow

## What This Is

Application mobile familiale (React Native / Expo) qui centralise la vie quotidienne d'une famille : tâches, calendrier, repas, budget, recettes, journal bébé, photos/souvenirs, et un système de gamification avec mascotte/ferme pixel. Les données vivent dans un vault Obsidian (Markdown + frontmatter) synchronisé via iCloud — aucun backend.

## Core Value

L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

## Requirements

### Validated

- ✓ Gestion de tâches avec récurrence et assignation — existing
- ✓ Calendrier familial avec RDVs et rappels — existing
- ✓ Planification de repas hebdomadaire — existing
- ✓ Suivi budget mensuel par catégories — existing
- ✓ Recettes au format Cooklang avec import URL — existing
- ✓ Journal bébé (tétées, couches, sommeil, Live Activities) — existing
- ✓ Photos/souvenirs avec éditeur mémoire — existing
- ✓ Gamification (XP, niveaux, loot boxes, défis) — existing
- ✓ Mascotte pixel avec arbre évolutif — existing
- ✓ Mini ferme (planter, récolter, animaux) — existing
- ✓ Sagas/aventures narratives — existing
- ✓ Boutique d'items et personnalisation — existing
- ✓ 9 thèmes de profil (voitures, pokemon, etc.) — existing
- ✓ Mode nuit avec luminosité adaptée — existing
- ✓ Contrôle parental avec PIN/biométrie — existing
- ✓ Partage via WhatsApp/iMessage — existing
- ✓ Widgets iOS (WidgetKit) et Android — existing
- ✓ i18n français/anglais — existing
- ✓ Assistant IA (Claude) pour suggestions et import — existing
- ✓ Notifications locales planifiées — existing
- ✓ Reconnaissance vocale — existing
- ✓ Vault Obsidian avec sync iCloud — existing
- ✓ Préférences alimentaires famille + invités (allergies, intolérances, régimes, aversions) avec détection automatique des conflits recettes et bandeau P0 non-dismissible — v1.2
- ✓ Saisie vocale des préférences alimentaires via DictaphoneRecorder + extraction IA — v1.2
- ✓ Codex ferme — 111 entrées sur 11 catégories (Cultures, Animaux, Bâtiments, Craft, Tech, Compagnons, Loot, Saisonnier, Sagas, Quêtes, Aventures), sprites pixel art natifs, recherche normalisée FR+EN, zéro drift via 220 tests Jest anti-drift — v1.2
- ✓ Tutoriel ferme immersif (5 étapes mixtes cartes + coach marks spotlight) au premier lancement, skippable, rejouable depuis le codex — v1.2
- ✓ Détection sémantique de la catégorie des tâches (filepath + sections + tags) sans écrire dans les fichiers Obsidian — v1.3
- ✓ Moteur de couplage sémantique — 10 catégories de tâches couplées chacune à un effet wow spécifique sur la ferme, dispatcher applyTaskEffect() câblé dans completeTask — v1.3
- ✓ Anti-abus via caps quotidiens/hebdomadaires persistés dans SecureStore, 68 tests Jest — v1.3
- ✓ Feedback visuel et compagnon différenciés par catégorie d'effet (toast, haptic, HarvestBurst, messages i18n FR+EN) — v1.3
- ✓ Écran Réglages — Couplage sémantique (toggle par catégorie, preview, stats semaine) — v1.3
- ✓ Musée des effets — chronologie persistée des effets déclenchés (SEED-002 lite) — v1.3
- ✓ Compagnon étendu — 4 event types activés (weekly_recap, morning_greeting, gentle_nudge, comeback) + persistance messages SecureStore + bulle dashboard — v1.3
- ✓ Fondation données village — module lib/village/ isolé (types, grille 4 éléments, 7 templates thématisés, parseur bidirectionnel append-only), 24 tests Jest — v1.4
- ✓ Hook domaine jardin — useGarden.ts isolé (génération objectif hebdomadaire, contributions, claim anti-double-abus), câblage useVault.ts +13 lignes — v1.4
- ✓ Écran Village — carte tilemap cobblestone plein écran, barre progression LiquidXPBar, feed contributions, indicateurs membres, historique avec détail par membre — v1.4
- ✓ Portail animé ferme → village (sprite pierre pixel art + glow Reanimated loop + fade cross-dissolve 400ms) remplaçant le FAB temporaire — v1.4
- ✓ Auto-contribution village — récoltes ferme (useFarm) et tâches IRL complétées (useGamification) ajoutent automatiquement une contribution, toast discret "+1 Village 🏡" — v1.4
- ✓ Récompense collective — bonus +25 XP + 1 loot box cosmétique équitable pour tous les profils actifs + suggestion d'activité IRL saisonnière (20 activités curatées × 4 saisons) — v1.4

### Active

- [ ] (v1.7) Sporée de Régularité : objet consommable appliqué à la plantation, engage un pari cumulatif bienveillant sur tâches ménagères avec multiplier de reward à la récolte
- [ ] (v1.7) Pollen de Chimère : objet consommable pour greffer 2 graines en 1 plant, combine rewards et drop tables (optionnel v1.7 ou reporté v1.8)
- [ ] (Deferred v1.6) Garde-parent sur love notes (toggle par profil enfant + modération anti-bullying)
- [ ] (Deferred v1.5) Ambiance dynamique village (cycle jour/nuit + effets saisonniers)
- [ ] (Deferred v1.5) Arbre familial commun au centre du village (stade évolutif collectif)

- [ ] (Backlog) Nettoyage code mort et fonctions dépréciées
- [ ] (Backlog) Refacto progressive du god hook useVault (3400 lignes → hooks domaine)
- [ ] (Backlog) Consolidation HealthRecord.allergies (santé) avec préférences alimentaires (cuisine) — migration parser dédiée
- [ ] (Backlog) Sélecteur "qui mange ce soir" sur les MealItem du planning hebdomadaire
- [ ] (Backlog) Suggestion automatique de recettes compatibles selon les convives sélectionnés
- [ ] (Backlog) Tutoriels contextuels pour autres écrans complexes (budget OCR, sagas, quêtes)
- [ ] (Backlog) Mécanique "Pokédex" — tracking de découverte codex par profil avec statistiques de complétion

### Out of Scope

- Backend serveur / base de données — l'app reste 100% locale + iCloud
- Refonte UI complète — on stabilise, on ne redesign pas
- Publication App Store grand public — TestFlight famille pour l'instant
- Migration hors Obsidian — le vault Markdown reste la source de vérité
- Accessibilité complète (WCAG) — pas prioritaire pour usage familial privé

## Current Milestone: v1.8 Export PDF imprimable des histoires

**Goal:** Permettre d'exporter chaque chapitre d'histoire généré en PDF imprimable aux specs imprimeur (carré 21×21cm, saddle-stitch 16 pages, bleed 0.32cm, polices embarquées), avec QR code audio en 4ème de couverture pointant vers un deep link `familyvault://story/:id` qui rejoue l'audio dans l'app — sans backend, tout reste local. Architecture pensée pour évoluer vers une intégration API Lulu Direct + coffret modulaire ultérieurement, sans casser les livres déjà imprimés.

**Target features:**
- Export PDF côté client avec specs Lulu Direct (format carré 21×21, bleed, 300 DPI, polices embarquées Patrick Hand titres + Andika corps lisible)
- Layout livre 16 pages : couverture, page de garde, page de titre personnalisée, 6 scènes en double page (illustration gauche / texte droite), 4ème de couverture avec résumé + QR audio
- QR code 3×3cm pointant vers deep link `familyvault://story/:id` — ouvre l'app, lance l'histoire et l'audio depuis le vault local
- Universal Links / scheme `familyvault://` configurés dans app.json + route `app/story/[id].tsx` autoplay
- Modal aperçu PDF (couverture + 2-3 pages) avant export depuis bibliothèque stories ou écran fin de génération
- Manifeste `12 - Impressions/manifeste.md` traçant les exports (id story, hash PDF, date, format)
- Lien manuel vers lulu.com avec instructions claires (pas d'intégration API — Option 1 du plan d'évolution)
- Fallback gracieux pour univers sans illustrations bundled (actuellement seul foret) → mise en page texte seul cohérente

**Key context:**
- Évolution future planifiée (NE PAS implémenter ici) : Option 2 = Cloudflare Worker proxy pour API Lulu Direct + Stripe paiement ; Étape 3 = coffret personnalisé "livre qui s'emboîte" + abonnement chapitres récurrents
- PDF généré ici doit être directement réutilisable pour Option 2 (specs Lulu déjà respectées dès le départ)
- Deep link `familyvault://` doit rester valide pour les livres déjà imprimés quand on ajoutera le hosting audio CDN
- Audio reste 100% local dans le vault iCloud, JAMAIS uploadé vers un serveur tiers
- Cohérence existant : scenes V3 (`lib/story-scenes.ts`), illustrations bundled (`lib/story-illustrations.ts` MVP foret), structure `BedtimeStory` (`lib/types.ts:761-797`)
- Polices : Patrick Hand (déjà bundled) pour titres + Andika à télécharger et bundler dans `assets/fonts/` (Google Fonts, OFL)
- Palette PDF : cream `#F5EFE0`, ink `#2C3E50`, teal `#4F9396` (cohérence visuelle avec l'app)
- Saddle-stitch impose un multiple de 4 pages — 16 pages fixes verrouillées peu importe la longueur de l'histoire (on adapte la respiration des scènes)

## Previous State

**Last shipped:** v1.7 Modifiers de plants (2026-04-19) — Sporée de Régularité complète (fondation modifiers extensible, moteur prorata cumulatif famille pondérée par âge, UI seed picker + badge plant scellé, polish onboarding + codex wagerMarathonWins). Pollen de Chimère reporté v1.9.
**Previously shipped:** v1.6 Love Notes (partiel, 2026-04-17) — 3/4 phases livrées. Phase 37 garde-parent & polish différée.

## Previous Milestones

- ✅ **v1.7 Modifiers de plants** — Shipped 2026-04-19. Phases 38-41. Sporée de Régularité (pari cumulatif bienveillant), fondation `modifiers` extensible. Pollen de Chimère reporté v1.9.
- 🟡 **v1.6 Love Notes** — Partiel (2026-04-17). Phases 34 Fondation données, 35 Carte enveloppe + écran, 36 Composition + reveal livrées. Phase 37 Garde-parent & polish deferred.
- 🟡 **v1.5 Village Vivant** — Partiel (2026-04-14). Phases 29 Avatars, 30 Décorations, 33 Expéditions livrées. Phases 31 Ambiance dynamique + 32 Arbre familial deferred.
- ✅ **v1.4 Jardin Familial** — Shipped 2026-04-11. Place du Village coopérative (carte tilemap, contributions auto, objectif hebdo, récompense collective IRL). Phases 25-28. Voir `.planning/milestones/v1.4-ROADMAP.md`.
- ✅ **v1.3 Seed** — Shipped 2026-04-10. Couplage sémantique tâches↔ferme (10 catégories, effets wow, anti-abus, musée des effets, compagnon étendu 4 event types). Phases 19-24.
- ✅ **v1.2 Confort & Découverte** — Shipped 2026-04-08. Préférences alimentaires famille/invités + détection conflits recettes, codex ferme 111 entrées sur 11 catégories, tutoriel immersif 5 étapes. Voir `.planning/milestones/v1.2-ROADMAP.md`.
- ✅ **v1.1 Ferme Enrichie** — Shipped 2026-04-07. Voir `.planning/milestones/v1.1-ROADMAP.md`.
- ✅ **v1.0 Stabilisation** — Shipped 2026-03-28.

## Context

- App en production sur TestFlight pour la famille
- ~90 composants, 3400 lignes dans le hook principal, 2400 lignes dans le parser
- 13 fichiers de test existants (lib uniquement, 0 tests composants)
- Données sensibles : vault familial privé, pas de données transmises sauf API Claude (anonymisé)
- Le codebase map complet est dans `.planning/codebase/`
- Erreurs TypeScript pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts (ignorées)

## Constraints

- **Stack**: React Native + Expo SDK 54 — pas de migration majeure
- **Données**: Vault Obsidian Markdown — compatibilité bidirectionnelle obligatoire
- **Stabilité**: App sur TestFlight — chaque phase doit être non-cassante
- **Solo dev**: Un seul développeur — phases incrémentales, pas de big bang
- **Animations**: react-native-reanimated obligatoire (pas RN Animated)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Nettoyage avant refacto | Tests + nettoyage créent le filet de sécurité pour refactorer sans risque | — Pending |
| Refacto progressive du hook | Splitter useVault en hooks domaine progressivement plutôt que big bang | — Pending |
| Ferme/gamification après stabilisation | Stabiliser d'abord, enrichir ensuite | ✓ Good (v1.1 + v1.2) |
| PREF-11 P0 SAFETY allergène non-dismissible | La sécurité allergène n'accepte pas de bug silencieux — enforcement statique TypeScript via zéro prop dismiss | ✓ Good (v1.2) |
| Phase codex contenu séparée de l'UI | Valider la précision des 111 entrées en isolation (220 tests anti-drift) avant toute UI | ✓ Good (v1.2) |
| ARCH-05 zéro nouvelle dépendance npm | Prouver que les primitives du codebase suffisent — anti-drift dépendances | ✓ Good (v1.2, respecté sur 4 phases) |
| TUTO-02 flag tutoriel device-global | Persistance SecureStore par appareil (pas par profil) — évite re-trigger lors du switch profil | ✓ Good (v1.2) |
| HelpContext étendu plutôt que nouveau provider | Stack providers déjà à 8 niveaux — réutiliser l'existant | ✓ Good (v1.2) |
| Format tutoriel mixte cartes + coach marks | Cartes narratives pour intro/outro, spotlight pour étapes contextuelles — fallback graceful si cible non mesurable | ✓ Good (v1.2) |
| GuestProfile séparé de Profile | Invités sans gamification/avatar/role — pattern dédié dans `02 - Famille/Invités.md` | ✓ Good (v1.2) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-04 — Milestone v1.8 "Export PDF imprimable des histoires" started — phases 48+ planifiées*
