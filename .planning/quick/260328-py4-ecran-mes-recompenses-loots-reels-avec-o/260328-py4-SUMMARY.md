---
phase: quick
plan: 260328-py4
subsystem: gamification
tags: [loot, recompenses, gamification, parser, useVault]
dependency_graph:
  requires: []
  provides: [UsedLoot model, markLootUsed action, Mes récompenses tab]
  affects: [lib/types.ts, lib/parser.ts, hooks/useVault.ts, app/(tabs)/loot.tsx]
tech_stack:
  added: []
  patterns: [inline component, useMemo callback, parser extension]
key_files:
  created: []
  modified:
    - lib/types.ts
    - lib/parser.ts
    - hooks/useVault.ts
    - app/(tabs)/loot.tsx
decisions:
  - "Loots physiques détectés via action.startsWith('loot:') && !note.includes('Badge') — évite regex complexe"
  - "ID du UsedLoot = profileId_timestamp pour correspondance avec GamificationEntry"
  - "Bouton désactivé pour enfant/ado via opacity 0.4 (pas de onPress), pas de composant séparé"
metrics:
  duration: "6 minutes"
  completed: 2026-03-28
  tasks_completed: 2
  files_modified: 4
---

# Phase quick Plan 260328-py4: Écran Mes récompenses — loots réels avec suivi parent

Suivi des récompenses physiques gagnées en loot box, avec persistance dans gamification.md et contrôle parental sur la validation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | UsedLoot modèle + parser + markLootUsed | b8fefcf | lib/types.ts, lib/parser.ts, hooks/useVault.ts |
| 2 | Section "Mes récompenses" dans loot.tsx | 90ea420 | app/(tabs)/loot.tsx |

## What Was Built

**Tâche 1 — Modèle de données et persistance**

- Interface `UsedLoot` dans `lib/types.ts` avec champs `id`, `profileId`, `emoji`, `label`, `earnedAt`, `usedAt`
- `GamificationData.usedLoots: UsedLoot[]` ajouté à l'interface existante
- `parseGamification()` étendu pour parser la section `## Récompenses utilisées` (format pipe-délimité en 6 colonnes)
- `serializeGamification()` écrit la section `## Récompenses utilisées` entre les récompenses actives et le journal des gains
- Action `markLootUsed(loot: UsedLoot)` dans `VaultState` — écrit dans gamification.md et met à jour l'état local
- Compatibilité backward garantie : si la section est absente du fichier, `usedLoots` vaut `[]`

**Tâche 2 — Onglet "Mes récompenses"**

- Troisième onglet dans la tab bar avec badge count `(N)` quand des loots sont en attente
- Deux sous-onglets locaux : "À utiliser" et "Historique"
- Détection des loots physiques : `action.startsWith('loot:') && !note.includes('Badge')`
- Carte par loot : avatar profil, emoji + label extrait du `note`, bouton d'action
- Profil adulte : bouton "✓ Utilisé" vert actif → appelle `markLootUsed` + haptic `NotificationFeedbackType.Success`
- Profil enfant/ado : bouton désactivé visuellement (`opacity: 0.4`, texte "Parent requis", sans `onPress`)
- Onglet Historique : badge "✓ Utilisé" + date `usedAt` au format `JJ/MM/AAAA` via `date-fns/format`
- Styles cohérents avec le design system (tokens typography, shadows, couleurs sémantiques)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Checking created/modified files exist:
- lib/types.ts: interface UsedLoot and GamificationData.usedLoots present
- lib/parser.ts: parseGamification handles inUsedLoots, serializeGamification writes section
- hooks/useVault.ts: markLootUsed in VaultState and implementation
- app/(tabs)/loot.tsx: 'mes-recompenses' tab present

Checking commits exist:
- b8fefcf: feat(260328-py4): UsedLoot modèle + parser + markLootUsed action
- 90ea420: feat(260328-py4): section "Mes récompenses" dans loot.tsx

TypeScript: `npx tsc --noEmit` — aucune nouvelle erreur TS.

## Self-Check: PASSED
