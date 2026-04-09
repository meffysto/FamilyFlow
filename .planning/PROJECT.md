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

### Active

- [ ] (Backlog) Nettoyage code mort et fonctions dépréciées
- [ ] (Backlog) Refacto progressive du god hook useVault (3400 lignes → hooks domaine)
- [ ] (Backlog) Consolidation HealthRecord.allergies (santé) avec préférences alimentaires (cuisine) — migration parser dédiée
- [ ] (Backlog) Sélecteur "qui mange ce soir" sur les MealItem du planning hebdomadaire
- [ ] (Backlog) Suggestion automatique de recettes compatibles selon les convives sélectionnés
- [ ] (Backlog) Tutoriels contextuels pour autres écrans complexes (budget OCR, sagas, quêtes)
- [ ] (Backlog) Mécanique "Pokédex" — tracking de découverte codex par profil avec statistiques de complétion
- ✓ Détection sémantique de la catégorie des tâches (filepath + sections + tags) sans écrire dans les fichiers Obsidian — v1.3 Phase 19
- ✓ Moteur de couplage sémantique — 10 catégories de tâches couplées chacune à un effet wow spécifique sur la ferme, dispatcher applyTaskEffect() câblé dans completeTask — v1.3 Phase 20
- ✓ Anti-abus via caps quotidiens/hebdomadaires persistés dans SecureStore, 68 tests Jest — v1.3 Phase 20
- [ ] (v1.3) Feedback visuel et compagnon différenciés par catégorie d'effet (toast, haptic, HarvestBurst, messages i18n FR+EN)
- [ ] (v1.3) Écran Réglages — Couplage sémantique (toggle par catégorie, preview, stats semaine)
- [ ] (v1.3) Musée des effets — chronologie persistée des effets déclenchés (SEED-002 lite)
- [ ] (v1.3) Compagnon étendu — 5 event types activés (weekly_recap, morning_greeting, celebration, gentle_nudge, comeback) + persistance messages (SEED-003 lite)

### Out of Scope

- Backend serveur / base de données — l'app reste 100% locale + iCloud
- Refonte UI complète — on stabilise, on ne redesign pas
- Publication App Store grand public — TestFlight famille pour l'instant
- Migration hors Obsidian — le vault Markdown reste la source de vérité
- Accessibilité complète (WCAG) — pas prioritaire pour usage familial privé

## Current Milestone: v1.3 Seed

**Goal:** Transformer la ferme en reflet différencié du quotidien familial en couplant sémantiquement chaque catégorie de tâche réelle à un effet ferme spécifique (wow moment tangible).

**Core insight:** Pas de champ `category` sur les tâches — la taxonomie est déjà organique via filepath Obsidian + sections H2/H3 + tags. Pure lecture des fichiers tâches (Obsidian-respect).

**Point d'injection :** `lib/gamification/engine.ts:awardTaskCompletion()` + nouveau module `lib/effects/semantic-coupling.ts`.

**Mapping 10 catégories → effets wow :**

| # | Catégorie | Effet | Cap |
|---|-----------|-------|-----|
| 1 | Ménage quotidien | Weeds-Free Ticket (retire 1 weeds) | 1/j |
| 2 | Ménage hebdo/saisonnier | Fence Repair Free (répare 1 wear) | 1/j |
| 3 | Courses alimentaires | Production Turbo 24h (buildings 0.5x) | 1/j |
| 4 | Routine enfant | Companion Mood Spike (+5 mood + msg IA) | 2/j |
| 5 | Devoirs/école | Growth Sprint 24h (tasksPerStage +1) | 1/j |
| 6 | Santé médicale | Rare Seed Jackpot (guaranteed rare drop) | 1/RDV |
| 7 | Gratitude/famille | Saga Trait Boost (entente +1) | 2/j |
| 8 | Budget/admin | Building Capacity Boost ×2 24h | 1/j |
| 9 | Soins bébé | Instant Harvest Gold (×3 golden rain) | 1/j |
| 10 | Cuisine/repas | Recipe Unlock Surprise (craft rare) | 1/sem |

**Effets universels :** `#urgent` → ×2 multiplier auto 5 tâches ; streak >7j → Double Loot Cascade.

**Target features (6 phases, 19→24) :**
- Phase 19 — Détection catégorie sémantique (mapping table + feature flag + tests)
- Phase 20 — Moteur d'effets + anti-abus (dispatcher, caps SecureStore, wiring 10 effets)
- ✅ Phase 21 — Feedback visuel + compagnon (HarvestBurst variants, toasts, haptic, i18n FR+EN) — completed 2026-04-09
- ✅ Phase 22 — UI config famille (écran Réglages Couplage sémantique, toggles, stats) — completed 2026-04-09
- Phase 23 — Musée des effets (SEED-002 lite — chronologie persistée dans gami-{id}.md)
- Phase 24 — Compagnon étendu (SEED-003 lite — 5 event types + persistance messages)

## Previous Milestones

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
*Last updated: 2026-04-09 — Phase 19 complète : module pur `lib/semantic/` livré (détection catégorie sémantique par filepath/section/tag, feature flag off par défaut, 37 tests Jest verts). Prochaine : Phase 20 moteur d'effets + anti-abus.*
