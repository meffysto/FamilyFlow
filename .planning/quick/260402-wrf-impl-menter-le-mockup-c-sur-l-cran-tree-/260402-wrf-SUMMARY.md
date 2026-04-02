---
phase: quick
plan: 260402-wrf
subsystem: ui/tree
tags: [layout, diorama, animation, tree-screen]
dependency_graph:
  requires: []
  provides: [mockup-c-tree-layout]
  affects: [app/(tabs)/tree.tsx]
tech_stack:
  added: []
  patterns: [marginTop-overlap, borderRadius-clip, shadow-token]
key_files:
  created: []
  modified:
    - app/(tabs)/tree.tsx
decisions:
  - "borderBottomLeftRadius/Right: 28 sur treeBg et clip interne — coins arrondis sans overflow visible sur l'ombre"
  - "Ombre manuelle (shadowOpacity 0.15) plutot que Shadows.md token — valeur specifique validee visuellement"
  - "LinearGradient supprime entierement — import, JSX et style groundTransition"
  - "marginTop: -22 + zIndex: 10 sur la carte Actions pour chevauchement propre du diorama"
  - "Carte Progression: marginTop Spacing.sm (isOwnTree) ou marginTop: -22 zIndex: 10 (!isOwnTree)"
metrics:
  duration: ~15min
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_modified: 1
---

# Quick 260402-wrf: Mockup C — Diorama arrondi + chevauchement cartes (Ecran Arbre)

**One-liner:** Diorama ecran arbre avec coins arrondis bas (28px), ombre portee, et chevauchement des cartes via marginTop negatif — suppression du LinearGradient de transition.

## Objective

Implementer le mockup C sur l'ecran arbre : supprimer le LinearGradient de transition diorama->contenu, ajouter des coins arrondis bas sur le conteneur diorama avec ombre portee, et faire chevaucher les cartes sous le diorama via marginTop negatif + zIndex eleve.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Mockup C — coins arrondis diorama, ombre portee, chevauchement cartes | bae5fd5 | app/(tabs)/tree.tsx |
| 2 | Checkpoint human-verify | approved | — |

## Changes Made

### app/(tabs)/tree.tsx

**Style treeBg** — ajout coins arrondis bas + ombre portee :
- `borderBottomLeftRadius: 28` et `borderBottomRightRadius: 28`
- `shadowColor: '#000'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.15`, `shadowRadius: 8`, `elevation: 6`
- `overflow: 'visible'` conserve pour les tooltips/bulles companion

**Clip interne** (View absoluteFill) — memes borderRadius pour que le terrain soit clippe aux coins arrondis

**LinearGradient supprime** :
- Import `LinearGradient` supprime de la ligne d'imports
- Bloc JSX `<LinearGradient colors={[PIXEL_GROUND_DARK[season], colors.bg]} style={styles.groundTransition} />` supprime
- Style `groundTransition` supprime du StyleSheet

**Chevauchement cartes** :
- Carte Actions : `marginTop: -22, zIndex: 10` sur le conteneur `Animated.View`
- Carte Progression (isOwnTree) : `marginTop: Spacing.sm` inchange (suit naturellement)
- Carte Progression (!isOwnTree) : `marginTop: -22, zIndex: 10` (seule carte affichee)

## Deviations from Plan

None — plan execute exactement tel qu'ecrit. Le checkpoint a ete approuve par l'utilisateur.

## Known Stubs

None.

## Self-Check: PASSED

- [x] Commit bae5fd5 existe : `feat(quick-260402-wrf): mockup C — coins arrondis diorama, ombre port...`
- [x] Fichier app/(tabs)/tree.tsx modifie avec borderBottomLeftRadius: 28, ombre portee, marginTop: -22
- [x] LinearGradient import et style groundTransition supprimes
- [x] Checkpoint approuve par l'utilisateur
