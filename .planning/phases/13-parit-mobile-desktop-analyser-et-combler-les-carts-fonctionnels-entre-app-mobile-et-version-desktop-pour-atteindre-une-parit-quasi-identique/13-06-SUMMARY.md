---
phase: 14-parite-mobile-desktop
plan: 06
subsystem: desktop-loot
tags: [loot, gamification, framer-motion, confetti, desktop, badges, inventory]
dependency_graph:
  requires: [14-01]
  provides: [loot-screen-desktop]
  affects: [apps/desktop/src/pages/Loot.tsx, apps/desktop/src/contexts/VaultContext.tsx]
tech_stack:
  added: [framer-motion card flip, canvas-confetti, VaultContext gamiData]
  patterns: [AnimatePresence, motion.div rotateY, RARITY_GLOW map, SegmentedControl tabs, badge tiers]
key_files:
  created: []
  modified:
    - apps/desktop/src/pages/Loot.tsx
    - apps/desktop/src/pages/Loot.css
    - apps/desktop/src/contexts/VaultContext.tsx
decisions:
  - "Loot desktop sans useTranslation — react-i18next non installé dans le desktop app (worktree), textes FR hardcodés cohérents avec reste du code"
  - "VaultContext étendu avec gamiData + openLootBox + markLootUsed pour garder monofichier (<600 lignes)"
  - "RARITY_GLOW map (5 raretés) + RARITY_COLOR map inline dans Loot.tsx — pas de tokens globaux car spécifique à la page"
  - "Companion strip via (profile as any).companion — évite cast d'import additionnel pour worktree sans types companion"
metrics:
  duration: "10min"
  completed_date: "2026-04-05"
  tasks_completed: 1
  files_modified: 3
requirements: [PAR-01, PAR-02]
---

# Phase 14 Plan 06: Loot Desktop — Coffre Animé + Inventaire + Badges Summary

Réécriture complète de l'écran Loot desktop : animation card flip Framer Motion style Pokemon TCG, confetti canvas-confetti au reveal, inventaire filtrable par catégorie, collection de badges avec tiers, et strip compagnon.

## What Was Built

### Task 1: Écran Loot desktop — ouverture coffre animée + inventaire + badges

**Loot.tsx** (229 → 641 lignes) réécrit avec 3 sections principales :

**Section 1 — Coffre à ouvrir :**
- Coffre tremble avant ouverture (Framer Motion `animate={{ x: [-3,3,...], rotate: [-2,2,0] }}` sur 0.5s)
- Card flip reveal : `initial={{ rotateY: 180, scale: 0.85, opacity: 0 }}` → `animate={{ rotateY: 0, scale: 1, opacity: 1 }}` avec spring (stiffness 160, damping 18)
- `style={{ perspective: 1200 }}` sur le parent + `transform-style: preserve-3d; backface-visibility: hidden` en CSS
- Glow par rareté : `RARITY_GLOW` map (commun 8px gris → mythique 40px rouge)
- Confetti : `confetti({ particleCount: 100, spread: 70 })` standard, `200 particules + 3 vagues` pour légendaire/mythique
- Bouton "Continuer" animé (delay 0.8s) pour dismiss

**Section 2 — Inventaire :**
- SegmentedControl : Tous / Décorations / Habitants / Compagnons / Cosmétiques
- Grille `auto-fill, minmax(140px, 1fr)` avec hover scale (CSS transition)
- Affiche badge rareté coloré, remaining tasks/days si applicable
- Bouton "Utiliser" → appel `markLootUsed(id)`

**Section 3 — Badges :**
- `getAllBadgeProgress()` depuis `@family-vault/core/mascot/badges`
- Tiers : none → bronze → argent → or → diamant
- Badges obtenus colorés (bordure selon tier), non obtenus grisés + filtre grayscale
- Barre de progression globale `earnedCount / totalBadges`
- Mini progress bar vers prochain tier par badge

**Companion strip** : affiche espèce (emoji), nom, niveau, bonus XP si `profile.companion` présent.

**VaultContext.tsx** étendu :
- `gamiData: GamificationData | null` dans l'état
- `loadProfiles` charge `gami-{id}.md` pour le profil actif et stocke `gamiData`
- `openLootBoxMutation` : appelle `openLootBoxEngine(profile, gamiData)`, écrit `gami-{id}.md`, met à jour état
- `markLootUsed` : filtre `activeRewards`, réécrit le fichier

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8a7b0f1 | feat(14-06): écran Loot desktop — ouverture coffre animée + inventaire + badges |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] VaultContext worktree manquait gamiData/openLootBox/markLootUsed**
- **Found during:** Task 1 — tsc révèle que le worktree VaultContext n'a pas ces propriétés
- **Issue:** Le worktree est basé sur une version plus ancienne du code sans les actions loot
- **Fix:** Étendu VaultContext avec gamiData state, loadProfiles retourne gamiData, ajout openLootBoxMutation + markLootUsed
- **Files modified:** apps/desktop/src/contexts/VaultContext.tsx
- **Commit:** 8a7b0f1

**2. [Deliberate] Pas d'i18n useTranslation**
- **Found during:** Analyse — react-i18next absent du package.json desktop dans ce worktree
- **Issue:** Le plan D-07 demande `useTranslation('gamification')`, mais la librairie n'est pas installée dans ce worktree
- **Fix:** Textes français hardcodés (cohérent avec tous les autres écrans desktop de ce worktree)
- **Impact:** Légère dette i18n, non bloquant — à résoudre quand react-i18next sera intégré dans le desktop

## Verification

- `cd apps/desktop && npx tsc --noEmit` — passe sans erreur Loot.tsx ni VaultContext.tsx
- Loot.tsx importe `framer-motion` et `canvas-confetti`
- Loot.tsx ne contient plus "bientôt disponible"
- Loot.css contient `preserve-3d` et `backface-visibility`
- Fichier fait 641 lignes (> 250 requis)

## Self-Check: PASSED

- [x] apps/desktop/src/pages/Loot.tsx — 641 lignes, framer-motion + confetti + openLootBox
- [x] apps/desktop/src/pages/Loot.css — preserve-3d + backface-visibility
- [x] apps/desktop/src/contexts/VaultContext.tsx — gamiData + openLootBox + markLootUsed
- [x] Commit 8a7b0f1 existe
- [x] tsc --noEmit passe (0 erreurs Loot/VaultContext)
