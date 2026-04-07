---
phase: 15-pr-f-rences-alimentaires
plan: "01"
subsystem: dietary
tags: [typescript, types, catalog, allergens, dietary, phase-15]

requires: []

provides:
  - "DietarySeverity, DietaryItem, DietaryConflict, GuestProfile, DietaryExtraction — types TypeScript fondamentaux"
  - "EU_ALLERGENS: 14 allergènes UE avec IDs canoniques stables et aliases FR"
  - "COMMON_INTOLERANCES: 8 intolérances courantes avec IDs canoniques"
  - "COMMON_REGIMES: 8 régimes courants avec IDs canoniques"
  - "findCatalogForSeverity(): helper autocomplete selon sévérité"

affects:
  - 15-02-parser-famille
  - 15-03-check-allergens
  - 15-04-ui-dietary
  - 15-05-integration-recette
  - 15-06-saisie-vocale

tech-stack:
  added: []
  patterns:
    - "Fichier types purement déclaratif sans import runtime — contrat partagé entre tous les plans"
    - "IDs canoniques stables snake_case jamais renommés après livraison (compatibilité vault)"
    - "Aliases FR codés en dur et versionnés — pas de fuzzy matching (sécurité allergènes)"
    - "findCatalogForSeverity() comme point d'entrée unique pour les autocompletes"

key-files:
  created:
    - lib/dietary/types.ts
    - lib/dietary/catalogs.ts
  modified: []

key-decisions:
  - "IDs canoniques stables (snake_case) — ne jamais renommer après livraison pour garantir la compatibilité des vaults existants"
  - "GuestProfile ne s'étend pas Profile — invités sans gamification, sans role, sans avatar (D-03, PREF-06)"
  - "Aversions sans catalogue (D-05) — findCatalogForSeverity retourne [] pour 'aversion', texte libre uniquement"
  - "Aliases FR manuels et exhaustifs pour couvrir les dérivés courants — conservatisme faux positif vs faux négatif (PREF-11 safety)"

patterns-established:
  - "Pattern types-only: fichier purement déclaratif sans import runtime, source de vérité pour tous les consommateurs aval"
  - "Pattern catalog-with-aliases: chaque DietaryItem a des aliases FR couvrant les dérivés culinaires courants"

requirements-completed: [PREF-01, PREF-03]

duration: 2min
completed: "2026-04-07"
---

# Phase 15 Plan 01: Catalogues et Types Summary

**Types TypeScript fondamentaux (DietarySeverity/DietaryItem/DietaryConflict/GuestProfile/DietaryExtraction) + 3 catalogues canoniques (14 allergènes UE, 8 intolérances, 8 régimes) avec aliases FR exhaustifs pour le matching ingrédients**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T21:41:34Z
- **Completed:** 2026-04-07T21:43:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fondations typées pour toute la phase 15 — tous les plans suivants peuvent importer sans dépendance circulaire
- 14 allergènes UE conformes au Règlement (UE) n°1169/2011 avec IDs stables et aliases FR couvrant les dérivés culinaires (ex: `lait` → beurre/crème/yaourt/fromage/mascarpone/mozzarella/ricotta/ghee/caséine/lactose/lactosérum)
- Helper `findCatalogForSeverity()` comme point d'entrée unique pour l'autocomplete — retourne `[]` pour les aversions (texte libre per D-05)

## Task Commits

Chaque tâche commitée atomiquement :

1. **Tâche 1: Créer lib/dietary/types.ts avec les types de base** — `4629458` (feat)
2. **Tâche 2: Créer lib/dietary/catalogs.ts avec les 3 catalogues canoniques** — `0cc486b` (feat)

**Métadonnées plan:** (dans ce commit docs)

## Files Created/Modified

- `/Users/gabrielwaltio/Documents/family-vault/lib/dietary/types.ts` — 5 types exportés : DietarySeverity, DietaryItem, DietaryConflict, GuestProfile, DietaryExtraction
- `/Users/gabrielwaltio/Documents/family-vault/lib/dietary/catalogs.ts` — 3 catalogues exportés (30 items total) + helper findCatalogForSeverity

## Decisions Made

- **IDs canoniques stables** : utilisé snake_case pour les IDs (`fruits_a_coque`, `gluten_ncg`) car les vaults existants stockeront ces IDs dans le frontmatter — un changement d'ID nécessiterait une migration data. Jamais renommer.
- **GuestProfile séparé de Profile** : les invités ne participent pas à la gamification, n'ont pas de role/avatar/points. Extension de Profile serait une surcharge inutile (D-03).
- **30 items exactement** : 14 allergènes UE + 8 intolérances + 8 régimes = 30, satisfait le critère de ≥30 de l'acceptance criteria.
- **Aliases exhaustifs pour la sécurité** : priorité aux dérivés laitiers (crème fraîche, babeurre, lait entier/demi-écrémé) et céréales (chapelure, amidon de blé, triticale) pour minimiser les faux négatifs sur allergènes vitaux.

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Issues Encountered

Aucun. La commande `grep -q` via rtk ne supporte pas le flag `-q` — utilisation du Grep tool à la place pour valider les critères d'acceptance. Aucun impact sur le code livré.

## User Setup Required

None — aucune configuration externe requise.

## Next Phase Readiness

- Plan 02 (parser famille.md avec clés food_*) peut importer `DietarySeverity` et `DietaryItem` immédiatement
- Plan 03 (checkAllergens) peut importer `DietaryConflict`, `EU_ALLERGENS` et `findCatalogForSeverity` immédiatement
- Plan 04 (UI dietary.tsx) peut importer `GuestProfile` et `findCatalogForSeverity` immédiatement
- Plan 06 (saisie vocale) peut importer `DietaryExtraction` immédiatement
- Aucun bloqueur — fondations livréees proprement

## Known Stubs

Aucun stub — ce plan est purement déclaratif (types + données constantes). Aucune donnée placeholder ni texte "coming soon".

---
*Phase: 15-pr-f-rences-alimentaires*
*Completed: 2026-04-07*
