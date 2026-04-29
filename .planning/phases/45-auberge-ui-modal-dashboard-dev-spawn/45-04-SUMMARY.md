---
phase: 45-auberge-ui-modal-dashboard-dev-spawn
plan: 04
subsystem: mascot/auberge
tags: [auberge, ui, modal, wiring, building-detail]
requires:
  - 45-02 (AubergeSheet)
  - 44-04 (placeholder Phase 44 dans BuildingDetailSheet)
provides:
  - Point d'entrée fonctionnel pour AubergeSheet depuis la grille ferme
affects:
  - components/mascot/BuildingDetailSheet.tsx
tech-stack:
  added: []
  patterns:
    - "Fragment racine <></> pour co-rendre Modal + AubergeSheet"
    - "State local useState pour ouverture/fermeture imbriquée de modale"
key-files:
  created: []
  modified:
    - components/mascot/BuildingDetailSheet.tsx
decisions:
  - "Co-rendu du AubergeSheet hors du Modal principal via fragment — autorise modale par-dessus modale (pageSheet stack iOS)"
  - "isAuberge basé sur def.id === 'auberge' — préserve la rétrocompat pour futurs bâtiments non-productifs"
metrics:
  duration: ~5min
  completed: 2026-04-29
  tasks: 1
  files_modified: 1
  commits: 1
---

# Phase 45 Plan 04 : Wiring AubergeSheet dans BuildingDetailSheet — Summary

CTA "Voir l'auberge" branché sur AubergeSheet depuis BuildingDetailSheet, remplaçant le placeholder Phase 44 uniquement pour le bâtiment auberge.

## Objectif

Connecter physiquement la modale Auberge (Plan 45-02) au point d'entrée principal côté ferme. Sans ce wiring, l'utilisateur n'avait aucun moyen d'ouvrir l'AubergeSheet en cliquant sur l'auberge dans la grille ferme.

## Changements

### components/mascot/BuildingDetailSheet.tsx

1. Import `AubergeSheet` + `useState`
2. State local `aubergeOpen` (default false)
3. Flag dérivé `isAuberge = def.id === 'auberge'`
4. Branchement conditionnel dans la carte non-productive :
   - Si `isAuberge` : titre "Auberge", body explicatif, CTA primaire "🛖 Voir l'auberge"
   - Sinon : placeholder Phase 44 inchangé ("Voir l'intérieur prochainement")
5. Return wrappé en fragment `<>...</>` pour co-rendre `<AubergeSheet visible={aubergeOpen} onClose={...} />` hors du Modal principal

### Rétrocompat

- Bâtiments productifs (poulailler, grange, moulin, ruche) : chemin `isProductive === true` totalement intact
- Futurs bâtiments non-productifs (def.id ≠ 'auberge') : placeholder Phase 44 préservé

## Vérifications

- `npx tsc --noEmit` : clean (aucune erreur introduite, erreurs pré-existantes hors scope)
- `git diff --name-only` : `components/mascot/BuildingDetailSheet.tsx` uniquement
- `grep "isAuberge"` : 2 matches (déclaration + ternaire)
- `grep "AubergeSheet"` : 2 matches (import + JSX)
- `grep "aubergeOpen"` : 3 matches (state + setter + prop)

## Deviations from Plan

None - plan exécuté tel qu'écrit. Petit ajustement cosmétique : le titre du card affiche "Auberge" pour `isAuberge`, "Bâtiment social" sinon (au lieu d'avoir un titre statique avant le ternaire).

## Commit

- `4cc39db` feat(45-04): wirer CTA Voir l'auberge dans BuildingDetailSheet

## Self-Check: PASSED

- FOUND: components/mascot/BuildingDetailSheet.tsx (modified)
- FOUND: commit 4cc39db
