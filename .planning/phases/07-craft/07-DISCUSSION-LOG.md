# Phase 7: Craft - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 07-craft
**Areas discussed:** Recettes & ingredients, Interface craft, Destin items craftes, Bonus XP

---

## Recettes & ingredients

### Nombre de recettes

| Option | Description | Selected |
|--------|-------------|----------|
| 3-4 recettes | Starter set : confiture, bouquet, gateau, omelette. Simple, extensible. | ✓ |
| 6-8 recettes | Plus de variete des le depart. | |
| 10+ recettes | Catalogue complet. Risque de surcharge sans tech tree. | |

**User's choice:** 3-4 recettes
**Notes:** Choix recommande pour garder le scope maitrise.

### Type d'ingredients

| Option | Description | Selected |
|--------|-------------|----------|
| Mix des deux | Recoltes cultures + ressources batiments. Connecte les deux systemes. | ✓ |
| Ressources batiments seulement | Plus simple mais deconnecte les cultures du craft. | |
| Recoltes cultures seulement | Pas de lien avec batiments. Le moulin perdrait son sens. | |

**User's choice:** Mix des deux
**Notes:** Logique vu que le moulin a ete concu pour alimenter le craft (Phase 6 D-02).

### Stockage recoltes

| Option | Description | Selected |
|--------|-------------|----------|
| Inventaire recoltes | Recolter stocke l'item. Joueur choisit : vendre OU craft. Plus strategique. | ✓ |
| Double recompense | Feuilles + item. Pas de choix strategique. | |
| Token generique | Craft coute feuilles + ressources. Simple mais moins immersif. | |

**User's choice:** Inventaire recoltes
**Notes:** Changement breaking sur harvestCrop(). Le joueur devra vendre manuellement.

### Recettes concretes

| Option | Description | Selected |
|--------|-------------|----------|
| Set classique | Confiture (fraise+fraise), Gateau (farine+oeuf+fraise), Omelette (oeuf+tomate), Bouquet (tulipe+tournesol) | ✓ |
| Set cuisine | Pain, Omelette, Salade, Gateau. Tout lie a la nourriture. | |
| Tu decides | Claude choisit selon CROP_CATALOG + FarmInventory. | |

**User's choice:** Set classique
**Notes:** Varie en difficulte et en type d'ingredients requis.

---

## Interface craft

### Acces au craft

| Option | Description | Selected |
|--------|-------------|----------|
| Bouton sur la ferme | Bouton "Atelier" sur tree.tsx, ouvre bottom sheet. Coherent avec TreeShop/BuildingShop. | ✓ |
| Batiment dedie | Batiment "Atelier" sur la grille. Plus immersif mais 4e batiment. | |
| Onglet inventaire | Dans l'ecran loot. Separe de la ferme. | |

**User's choice:** Bouton sur la ferme
**Notes:** Suit le pattern etabli.

### Flow craft

| Option | Description | Selected |
|--------|-------------|----------|
| Catalogue + tap | Liste recettes avec ingredients/stock. Bouton "Crafter" actif si disponible. | ✓ |
| Drag & drop | Glisser ingredients dans slot. Complexe (conflit geste/scroll). | |
| Selection sequentielle | Choisir ingredients un par un. Decouverte par combinaison. | |

**User's choice:** Catalogue + tap
**Notes:** Simple, une seule etape.

### Feedback craft

| Option | Description | Selected |
|--------|-------------|----------|
| Burst + haptic | Animation burst (HarvestBurst) + haptic impact + spring. Pattern existant. | ✓ |
| Simple toast | Toast "Confiture craftee !". Minimaliste. | |
| Tu decides | Claude choisit le feedback. | |

**User's choice:** Burst + haptic
**Notes:** Reutilise le pattern existant.

---

## Destin items craftes

### Usage des items

| Option | Description | Selected |
|--------|-------------|----------|
| Vendre pour XP+feuilles | Items en inventaire, vendables. Prepare Phase 9. | ✓ |
| Auto-vente immediate | Recompense immediate. Pas d'inventaire. Bloque Phase 9. | |
| Multi-usage | Vendre OU decorer OU cadeau. Scope plus large. | |

**User's choice:** Vendre pour XP+feuilles
**Notes:** Prepare Phase 9 (cadeaux) sans l'implementer.

### Visibilite inventaire

| Option | Description | Selected |
|--------|-------------|----------|
| Section dans le craft sheet | Onglet "Mes creations" dans l'Atelier. Centralise. | ✓ |
| Ecran loot existant | Dans loot.tsx. Reutilise l'existant. | |
| Inventaire separe | Nouvel ecran dedie. | |

**User's choice:** Section dans le craft sheet
**Notes:** Tout au meme endroit.

---

## Bonus XP

### Multiplicateur

| Option | Description | Selected |
|--------|-------------|----------|
| x2 | Item crafte vaut 2x la somme des ingredients. Motive sans desequilibrer. | ✓ |
| x1.5 | Bonus modere. Vente directe reste viable. | |
| x3 | Fort incitatif. Risque de desequilibre. | |
| Tu decides | Claude calibre selon modele XP. | |

**User's choice:** x2
**Notes:** Equilibre entre motivation craft et viabilite vente directe.

### Application du bonus

| Option | Description | Selected |
|--------|-------------|----------|
| XP et feuilles x2 | Bonus unifie. Simple a comprendre. | ✓ |
| XP x2, feuilles x1.5 | Craft surtout pour XP. Feuilles par les taches. | |
| Tu decides | Claude calibre le ratio. | |

**User's choice:** XP et feuilles x2
**Notes:** Recompense unifiee.

---

## Claude's Discretion

- Structure exacte inventaire recoltes dans le vault
- Calibration valeurs de vente par item crafte
- Sprites items craftes
- Transition UX pour changement harvestCrop
- Organisation code craft

## Deferred Ideas

None — discussion stayed within phase scope
