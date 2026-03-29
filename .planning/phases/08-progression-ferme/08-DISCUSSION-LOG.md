# Phase 8: Progression Ferme - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 08-progression-ferme
**Areas discussed:** Structure tech tree, Deblocage zones, Interface, Persistance
**Mode:** Auto (all recommended defaults selected)

---

## Structure du tech tree

[auto] Selected: Arbre lineaire avec 3 branches thematiques (Culture, Elevage, Expansion)
**Rationale:** 3 branches donnent suffisamment de choix sans complexite excessive. Pattern courant dans les jeux ferme (Stardew Valley, Hay Day).

## Deblocage de zones

[auto] Selected: Extension du WORLD_GRID existant avec parcelles verrouillees visibles
**Rationale:** Reutilise l'infrastructure existante. Les cadenas motivent le deblocage.

## Interface tech tree

[auto] Selected: Bottom sheet avec arbre vertical a 3 branches
**Rationale:** Coherent avec les patterns Boutique/Atelier. Pas besoin d'un ecran dedie.

## Persistance

[auto] Selected: CSV dans famille.md (farm_tech field)
**Rationale:** Pattern identique a farm_harvest_inventory et farm_crafted_items. Simple et Obsidian-compatible.

## Claude's Discretion

- Noms et icones des noeuds tech
- Calibration des couts
- Design visuel de l'arbre
- Nouvelles cultures/ressources specifiques
- Placement des nouvelles parcelles
