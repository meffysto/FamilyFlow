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

- [ ] (v1.6) Love notes : messages privés programmés entre membres de la famille avec boîte aux lettres dédiée
- [ ] (v1.6) Carte enveloppe pinned en tête du dashboard quand au moins une note à révéler/non lue
- [ ] (v1.6) Garde-parent sur love notes (toggle par profil enfant + modération anti-bullying)
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

## Current Milestone: v1.6 Love Notes

**Goal:** Permettre aux membres de la famille d'échanger des messages privés programmés ("love notes") qui apparaissent à une date future, avec un système de boîte aux lettres visualisé en carte enveloppe pinned en tête du dashboard — renforcer le lien affectif familial via des micro-moments de surprise asynchrones.

**Target features:**
- Composer une love note destinée à un profil famille avec date/heure de révélation future
- Boîte aux lettres dédiée (3 segments : reçues, envoyées en attente, archivées)
- Carte enveloppe pinned en tête du dashboard — apparition conditionnelle quand au moins 1 note à révéler/non lue
- Animation dévoilement Reanimated (rabat qui s'ouvre) + haptic success au reveal
- Notifications locales planifiées au revealAt via `expo-notifications`
- Garde-parent : toggle d'activation par profil enfant + modération notes envoyées par enfants (anti-bullying)

**Key context:**
- Stockage markdown : `03 - Famille/LoveNotes/{to-profileId}/{YYYY-MM-DD-slug}.md` — compat Obsidian bidirectionnelle
- Pattern hook à répliquer : `useVaultNotes.ts` / `useVaultGratitude.ts` (21 hooks domaine existants)
- Cache : love notes cachables, bump `CACHE_VERSION` dans `lib/vault-cache.ts:41`
- Aucune nouvelle dépendance npm — `expo-notifications`, `expo-haptics`, `react-native-reanimated` déjà installés
- v1.5 Village Vivant : Phases 31 (ambiance dynamique) + 32 (arbre familial commun) deferred — reprise ultérieure

## Previous State

**Last shipped:** v1.5 Village Vivant (partiel, 2026-04-14) — 3/5 phases livrées (avatars vivants, décorations persistantes, expéditions). Phases 31-32 différées pour prioriser Love Notes.
**Previously shipped:** v1.4 Jardin Familial (2026-04-11) — Place du Village coopérative avec portail animé, contributions auto, objectif hebdo, récompense collective IRL.

## Previous Milestones

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
*Last updated: 2026-04-17 — Phase 34 complete (fondation données + hook domaine LoveNote)*
