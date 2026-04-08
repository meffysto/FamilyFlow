---
phase: 14-parite-mobile-desktop
plan: "04"
subsystem: desktop-skills-stats
tags: [desktop, skills, stats, recharts, rpg, visualisation]
dependency_graph:
  requires: [14-01]
  provides: [desktop-skills-screen, desktop-stats-screen]
  affects: [apps/desktop/src/pages/]
tech_stack:
  added: [recharts@^3.8.1]
  patterns: [glass-card-wrap div pattern, SkillState inline type, inline getSkillById helper]
key_files:
  created:
    - apps/desktop/src/pages/Skills.tsx
    - apps/desktop/src/pages/Skills.css
    - apps/desktop/src/pages/Stats.tsx
    - apps/desktop/src/pages/Stats.css
  modified: []
decisions:
  - GlassCard n'accepte pas de prop className — utiliser div.glass-card-wrap avec styles CSS équivalents
  - SkillState non exporté depuis @family-vault/core/gamification/index.ts — défini localement comme type union
  - getSkillById/getSkillState non exposés dans core barrel — fonctions inline simples dans Skills.tsx
  - XP history non structurée par profil dans GamificationData — utiliser gamiData.history avec filtre timestamp pour LineChart XP
  - Profile.streak disponible directement sur Profile (via gamiData.profiles) — no separate streak model needed
metrics:
  duration: "6min"
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 14 Plan 04: Skills & Stats Desktop Summary

Création des écrans Skills (arbre RPG de compétences enfants) et Stats (6 visualisations recharts) pour la version desktop.

## What Was Built

### Task 1 — Écran Skills desktop (arbre RPG compétences)
**Commit:** `78c30d8`

Fichiers créés : `apps/desktop/src/pages/Skills.tsx` (436 lignes), `apps/desktop/src/pages/Skills.css` (506 lignes).

Fonctionnalités :
- En-tête avec titre + sélecteur de profil enfant (boutons avatar cliquables, parent avec plusieurs enfants)
- Anneau SVG de progression : % complété, nombre débloqué/total, XP gagné
- Sélecteur de tranche d'âge (AGE_BRACKETS) avec indicateur tranche détectée automatiquement
- Filtre par catégorie (chips horizontaux, getCategoriesForBracket)
- Grille `auto-fill minmax(180px, 1fr)` de SkillCard par catégorie
- États visuels : `locked` (grayscale + opacity 0.45), `unlockable` (couleur catégorie), `unlocked` (badge ✓)
- Overlay détail au clic : nom, catégorie, tranche, XP, bouton "Débloquer" (parent uniquement)
- `useTranslation('skills')` pour tous les textes — namespace skills existant
- Données depuis `@family-vault/core` : SKILL_TREE, AGE_BRACKETS, XP_PER_BRACKET, SKILL_CATEGORIES, getSkillsForBracket, getCategoriesForBracket, detectAgeBracket
- Mutation via `unlockSkill(skillId, profileId)` depuis VaultContext

### Task 2 — Écran Stats desktop (6 visualisations recharts)
**Commit:** `7f3138e`

Fichiers créés : `apps/desktop/src/pages/Stats.tsx` (457 lignes), `apps/desktop/src/pages/Stats.css` (122 lignes).

6 visualisations dans une grille 2×3 responsive (1 colonne <800px) :
1. **Tâches/semaine** — BarChart avec navigation semaine (◀ ▶), couleur success
2. **Répartition défis** — PieChart par statut (en_cours/complété/abandonné), 4 couleurs
3. **Humeurs 30 jours** — LineChart, domaine 0-5, couleur warning
4. **Repas planifiés** — BarChart horizontal top fréquence (aggregateMealFrequency), couleur info
5. **XP par jour** — LineChart 14 jours depuis gamiData.history, couleur primary
6. **Streak par profil** — BarChart par profil (Profile.streak), Cell coloré par index

Section bonus : Stock à réapprovisionner (aggregateStockTurnover, BarChart horizontal full-width).

Import recharts : `BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GlassCard ne supporte pas prop className**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `GlassCard` n'expose pas de prop `className` dans son interface — erreur TS2322 sur toutes les cards
- **Fix:** Utilisation de `div.glass-card-wrap` avec styles CSS équivalents (border, background, backdropFilter, boxShadow) au lieu de GlassCard
- **Files modified:** Skills.tsx, Stats.tsx, Skills.css, Stats.css
- **Commit:** inclus dans commits des tasks

**2. [Rule 1 - Bug] SkillState non exporté depuis @family-vault/core**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `SkillState` est défini dans le fichier `core/gamification/skill-tree.ts` mais non ré-exporté via `gamification/index.ts`
- **Fix:** Type défini localement `type SkillState = 'locked' | 'unlockable' | 'unlocked'` dans Skills.tsx
- **Files modified:** Skills.tsx
- **Commit:** inclus dans commit task 1

**3. [Rule 1 - Bug] getSkillById/getSkillState non exposés dans barrel core**
- **Found during:** Task 1
- **Issue:** Fonctions définies dans skill-tree.ts mais non exportées via gamification/index.ts
- **Fix:** Fonctions simples inline dans Skills.tsx (lookup SKILL_TREE.find + Set.has)
- **Files modified:** Skills.tsx
- **Commit:** inclus dans commit task 1

**4. [Rule 1 - Bug] GamificationData.profiles est Profile[] (pas gami-profiles)**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** Tentative d'accès à `prof.profileId` et `prof.xpHistory` sur Profile — ces champs n'existent pas
- **Fix:** Utilisation de `prof.id`, `prof.streak` (champs réels de Profile) + `gamiData.history` filtré par date pour XP/jour
- **Files modified:** Stats.tsx
- **Commit:** inclus dans commit task 2

## Known Stubs

Aucun stub — toutes les visualisations sont branchées sur les données réelles du VaultContext.

## Self-Check: PASSED

- `apps/desktop/src/pages/Skills.tsx` — FOUND ✓
- `apps/desktop/src/pages/Skills.css` — FOUND ✓
- `apps/desktop/src/pages/Stats.tsx` — FOUND ✓
- `apps/desktop/src/pages/Stats.css` — FOUND ✓
- Commit `78c30d8` (feat(14-04): Skills) — FOUND ✓
- Commit `7f3138e` (feat(14-04): Stats) — FOUND ✓
- `npx tsc --noEmit` — PASSED (no errors) ✓
