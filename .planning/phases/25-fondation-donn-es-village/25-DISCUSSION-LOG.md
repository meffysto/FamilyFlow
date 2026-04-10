# Phase 25: Fondation donnees village - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 25-fondation-donnees-village
**Areas discussed:** Grille village, Templates d'objectif, Emplacement parser

---

## Grille village (village-grid.ts)

### Elements interactifs

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | Fontaine, panneau historique, 1-2 etals. Suffisant pour le MVP. | ✓ |
| Riche | Fontaine, panneau, 4 etals, banc, arbre commun placeholder. | |
| Tu decides | Claude choisit le layout adapte au scope MVP. | |

**User's choice:** Minimal
**Notes:** Fontaine centre, panneau historique, 2 etals. Elements supplementaires en v1.5.

### Type de cellule

| Option | Description | Selected |
|--------|-------------|----------|
| VillageCell dedie | Type specifique avec id, x, y, role. Pas de champs inutiles. | ✓ |
| Reutiliser WorldCell | Meme type que la ferme, unlockOrder=0 pour tout. | |

**User's choice:** VillageCell dedie
**Notes:** Plus clair pour le domaine village, pas de champs unlockOrder/cellType inutiles.

### Terrain

| Option | Description | Selected |
|--------|-------------|----------|
| Positions seulement | village-grid.ts definit VILLAGE_GRID. Terrain en Phase 27. | ✓ |
| Positions + terrain | Inclure aussi village-farm-map.ts avec layout cobblestone. | |

**User's choice:** Positions seulement
**Notes:** Terrain cobblestone reporte en Phase 27 quand TileMapRenderer en aura besoin.

---

## Templates d'objectif

### Type de cibles

| Option | Description | Selected |
|--------|-------------|----------|
| Contributions unifiees | 1 recolte = 1 pt, 1 tache IRL = 1 pt. Compteur unique. | ✓ |
| Contributions ponderees | Taches IRL = 3 pts, recoltes = 1 pt. | |
| Multi-objectif | 2-3 sous-objectifs par semaine. | |

**User's choice:** Contributions unifiees
**Notes:** Simple, tout le monde contribue de la meme facon.

### Adaptation au nombre de profils

| Option | Description | Selected |
|--------|-------------|----------|
| Base x profils | Cible = BASE_TARGET x nb_profils_actifs. | ✓ |
| Paliers fixes | Cibles predefinies par taille de famille. | |
| Tu decides | Claude choisit la formule. | |

**User's choice:** Base x profils
**Notes:** Simple, equitable, facile a ajuster.

### Theme narratif

| Option | Description | Selected |
|--------|-------------|----------|
| Thematises | Nom, icone, description courte. Themes rotent aleatoirement. | ✓ |
| Numeriques purs | Juste un nombre cible, pas de narratif. | |

**User's choice:** Thematises
**Notes:** Donne du sens a l'effort collectif.

---

## Emplacement parser

### Fichier parser

| Option | Description | Selected |
|--------|-------------|----------|
| lib/village/parser.ts | Module isole comme lib/mascot/ et lib/museum/. | ✓ |
| Dans parser.ts existant | Meme pattern que tous les autres parseurs. | |
| lib/garden/parser.ts | Module isole sous le nom 'garden'. | |

**User's choice:** lib/village/parser.ts
**Notes:** Coherent avec la decision useGarden.ts isole. Ne grossit pas le monolithe parser.ts.

### Barrel index.ts

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, barrel index.ts | Re-exporte parser.ts, grid.ts, types.ts, templates.ts. | ✓ |
| Pas encore | Import directs, barrel quand le module grandit. | |

**User's choice:** Oui, barrel index.ts
**Notes:** Coherent avec les patterns lib/mascot/ et lib/gamification/.

### Chemin vault

| Option | Description | Selected |
|--------|-------------|----------|
| 04 - Gamification/ | A cote des gami-{id}.md. Lie a la gamification. | ✓ |
| Racine du vault | Top-level comme famille.md. | |
| Nouveau dossier dedie | Ex: 09 - Village/jardin-familial.md. | |

**User's choice:** 04 - Gamification/
**Notes:** Le village est lie a la gamification (recompenses XP, progression).

---

## Claude's Discretion

- Structure exacte du frontmatter YAML de jardin-familial.md
- Format des lignes de contribution append-only
- Nombre exact de templates d'objectif MVP
- Constante BASE_TARGET valeur initiale

## Deferred Ideas

None — discussion stayed within phase scope.
