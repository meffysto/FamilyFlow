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

### Active

- [ ] Nettoyage code mort et fonctions dépréciées
- [ ] Remplacement des 228 couleurs hardcodées par tokens sémantiques
- [ ] Correction des types `any` et renforcement TypeScript
- [ ] Tests unitaires pour les zones critiques (parser, gamification, ferme, budget)
- [ ] Refacto progressive du god hook useVault (3400 lignes → hooks domaine)
- [ ] Enrichissement de la ferme/gamification (scope à définir)

### Out of Scope

- Backend serveur / base de données — l'app reste 100% locale + iCloud
- Refonte UI complète — on stabilise, on ne redesign pas
- Publication App Store grand public — TestFlight famille pour l'instant
- Migration hors Obsidian — le vault Markdown reste la source de vérité
- Accessibilité complète (WCAG) — pas prioritaire pour usage familial privé

## Current Milestone: v1.1 Ferme Enrichie

**Goal:** Enrichir la ferme pour qu'elle soit un vrai moteur de motivation — plus de profondeur, plus de raisons de revenir faire ses tâches

**Target features:**
- Cycle jour/nuit sur la ferme
- Sprites pixel améliorés (cultures + animaux)
- Bâtiments productifs (moulin, serre, étable)
- Recettes de craft (combiner récoltes → items spéciaux)
- Arbre de technologies ferme
- Zones déblocables
- Cadeaux entre profils

**Key insight:** La ferme n'est PAS le produit — c'est le levier de motivation pour faire les tâches. Chaque feature doit renforcer la boucle : tâches → XP/récoltes → progression ferme → envie de refaire des tâches.

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
| Ferme/gamification après stabilisation | Stabiliser d'abord, enrichir ensuite | — Pending |

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
*Last updated: 2026-03-28 — Milestone v1.1 Ferme Enrichie started*
