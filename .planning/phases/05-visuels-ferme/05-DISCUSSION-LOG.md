# Phase 5: Visuels Ferme - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 05-visuels-ferme
**Areas discussed:** Cycle jour/nuit ferme, Animation des cultures, Animation des animaux, Sourcing des assets

---

## Cycle jour/nuit ferme

| Option | Description | Selected |
|--------|-------------|----------|
| Etendre ambiance.ts | Reutiliser getTimeSlot() + overlay teinte semi-transparent. Coherent avec l'arbre. | ✓ |
| Fond gradient anime | Background change de gradient via LinearGradient + transition smooth. | |
| Les deux combines | Gradient de fond + overlay teinte. | |

**User's choice:** Etendre ambiance.ts (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Changement instantane | Le slot change immediatement au changement d'heure. | |
| Fondu progressif | Transition animee (~2s) entre les colorOverlay. | ✓ |
| Tu decides | Claude choisit. | |

**User's choice:** Fondu progressif (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, memes particules | Reutiliser AmbientParticles sur le diorama ferme. | |
| Particules adaptees ferme | Particules differentes pour la ferme. | |
| Non, overlay couleur suffit | Juste le colorOverlay, pas de particules. | ✓ |

**User's choice:** Non, overlay couleur suffit
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Legerement teinte | Overlay bleu/violet subtil (~10-15% opacite). | ✓ |
| Ambiance marquee | Overlay plus dense (~25-30% opacite). | |
| Tu decides | Claude calibre. | |

**User's choice:** Legerement teinte (Recommended)
**Notes:** Adapte aux enfants, tout reste visible.

---

## Animation des cultures

| Option | Description | Selected |
|--------|-------------|----------|
| Swap PNG | Alterner stage_X_a.png et stage_X_b.png avec timer. | ✓ |
| Spritesheet animee | Un seul fichier spritesheet par culture decoupe en frames. | |
| Tu decides | Claude choisit. | |

**User's choice:** Swap PNG (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| 2 frames (minimum VIS-02) | Leger mouvement — 100 PNGs total. | ✓ |
| 3-4 frames | Animation plus fluide — triple/quadruple les assets. | |
| Tu decides | Claude decide le nombre optimal. | |

**User's choice:** 2 frames (minimum VIS-02)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Balancement doux | Frame A neutre, Frame B penchee/agrandie. Effet brise. | ✓ |
| Scintillement/pulse | Variation de couleur/brillance. Effet magique. | |
| Tu decides | Claude choisit par culture. | |

**User's choice:** Balancement doux (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Meme animation + lisere | Meme balancement, lisere dore suffit. | ✓ |
| Animation speciale doree | Frames uniques avec scintillement or. | |
| Tu decides | Claude juge. | |

**User's choice:** Meme animation + lisere
**Notes:** —

---

## Animation des animaux

| Option | Description | Selected |
|--------|-------------|----------|
| Idle + marche aleatoire | Animal reste en idle puis se deplace toutes les X secondes. Stardew style. | ✓ |
| Idle sur place uniquement | Juste animation idle en boucle, pas de deplacement. | |
| Tu decides | Claude choisit. | |

**User's choice:** Idle sur place + marche aleatoire
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Rarement (10-20s idle) | Longues pauses, deplacements occasionnels. Calme. | |
| Regulierement (5-10s idle) | Deplacements frequents. Ferme active et vivante. | ✓ |
| Tu decides | Claude calibre. | |

**User's choice:** Regulierement (5-10s idle)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Zone libre du diorama | Espace non-occupe par les parcelles. Pas de collision complexe. | ✓ |
| Confine a un enclos | Chaque animal dans une petite zone dediee. | |
| Tu decides | Claude decide. | |

**User's choice:** Zone libre du diorama (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| 2 frames idle + 4 frames marche | Minimum viable. | |
| 2 idle + walk existant (8 frames) | Garder structure actuelle avec vrais sprites. Plus fluide. | ✓ |
| Tu decides | Claude optimise. | |

**User's choice:** 2 idle + walk existant (8 frames)
**Notes:** —

---

## Sourcing des assets

| Option | Description | Selected |
|--------|-------------|----------|
| Generation IA | Generer sprites via IA. Rapide, pas de licence. | |
| Assets Mana Seed / itch.io | Pack sprites pixel achete. Style coherent garanti. | ✓ |
| Dessin manuel | Creer sprites a la main. Controle total. | |
| Tu decides | Claude choisit. | |

**User's choice:** Assets Mana Seed / itch.io
**Notes:** Les assets sont deja achetes et disponibles localement.

| Option | Description | Selected |
|--------|-------------|----------|
| 16x16 pixels | Style retro compact. | |
| 32x32 pixels | Plus de detail, standard Mana Seed. | ✓ |
| 48x48 pixels | Sprites detailles. | |
| Tu decides | Claude decide. | |

**User's choice:** 32x32 pixels
**Notes:** "on a deja les assets. Ils sont dans les dossiers de download ou de l'app"

| Option | Description | Selected |
|--------|-------------|----------|
| Tout Mana Seed | Uniformiser — remplacer tous les placeholders par Mana Seed. | ✓ |
| Mana Seed + complements IA | Mana Seed base + IA pour manquants. | |
| Tu decides | Claude adapte. | |

**User's choice:** Tout Mana Seed (Recommended)
**Notes:** —

---

## Claude's Discretion

- Vitesse exacte d'animation des cultures (intervalle entre frames)
- Algorithme de pathfinding simple pour le deplacement animal
- Organisation exacte des fichiers dans assets/garden/
- Gestion de useReducedMotion pour les nouvelles animations

## Deferred Ideas

None — discussion stayed within phase scope
