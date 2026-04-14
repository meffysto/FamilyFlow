# Phase 33: Expéditions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 33-exp-ditions
**Areas discussed:** Catalogue & difficulté, Timer & déroulement, Résultats & loot table, UI & point d'entrée

---

## Catalogue & difficulté

| Option | Description | Selected |
|--------|-------------|----------|
| 5-6 missions fixes | Catalogue statique avec difficulté croissante | |
| 3 zones × 3 niveaux | 3 destinations × 3 niveaux de difficulté (9 combos) | |
| Pool rotatif | 3-4 missions disponibles qui changent chaque jour | ✓ |

**User's choice:** Pool rotatif
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Feuilles + récoltes | Double sink, style OGame (métal+cristal+deutérium) | ✓ |
| Feuilles uniquement | Plus simple, un seul levier | |
| Récoltes uniquement | Feuilles non consommées | |

**User's choice:** Feuilles + récoltes
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Quotidien | 3-4 nouvelles missions chaque jour, seed date-based | ✓ |
| Toutes les 12h | 2 rotations/jour | |
| Hebdomadaire | Pool stable la semaine | |

**User's choice:** Quotidien
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| 3 missions | Choix restreint, Facile/Moyen/Dur | ✓ |
| 4 missions | Plus de variété | |
| 5 missions | Large choix | |

**User's choice:** 3 missions
**Notes:** —

---

## Timer & déroulement

| Option | Description | Selected |
|--------|-------------|----------|
| Courtes : 1h / 4h / 12h | Résultats rapides, style idle game | |
| Moyennes : 4h / 12h / 24h | Bon rythme pour app familiale quotidienne | ✓ |
| Longues : 12h / 24h / 48h | Plus de patience, meilleures récompenses | |

**User's choice:** Moyennes : 4h / 12h / 24h
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| 1 seule à la fois | Simple, force à choisir | |
| 2 simultanées | Permet courte + longue en parallèle | ✓ |
| 3 simultanées | Plus de flux | |

**User's choice:** 2 simultanées
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Résultat en attente | Calculé au retour, effet surprise | ✓ |
| Notification push | expo-notifications | |
| Badge sur l'icône app | Compromis discret | |

**User's choice:** Résultat en attente (le plus cohérent avec le pattern existant)
**Notes:** User note: "Le plus cohérent"

---

## Résultats & loot table

| Option | Description | Selected |
|--------|-------------|----------|
| Perte totale | Mise perdue, OGame-style | ✓ |
| Perte partielle (50%) | Récupère la moitié | |
| Pas de perte | Juste pas de récompense | |

**User's choice:** Perte totale
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| 40/30/20/10 | Réussite 40%, Partielle 30%, Échec 20%, Rare 10% | ✓ |
| 50/25/15/10 | Plus généreux | |
| 30/30/25/15 | Plus risqué, plus de rare | |

**User's choice:** 40/30/20/10
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Habitants exclusifs | Renard, Aigle, Dauphin, Kraken, Yeti | ✓ |
| Décos exclusives | Trésor pirate, Statue antique | |
| Graines rares boostées | Fleur de lave, Algue magique | ✓ |
| Boosters temporaires | x2 récolte, x2 production, +chance dorée | ✓ |

**User's choice:** Habitants exclusifs + Graines rares boostées + Boosters temporaires (multiselect)
**Notes:** Pas de décos exclusives expédition

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, après 5 échecs | Même pattern que loot box existant | ✓ |
| Oui, après 3 échecs | Plus généreux | |
| Non, pur aléatoire | Hardcore | |

**User's choice:** Oui, après 5 échecs
**Notes:** —

---

## UI & point d'entrée

| Option | Description | Selected |
|--------|-------------|----------|
| Depuis la ferme | Bâtiment "Camp d'exploration" sur la grille | ✓ |
| Depuis le village | Bâtiment "Guilde d'aventuriers" | |
| Tab dédié ferme | Onglet supplémentaire | |

**User's choice:** Depuis la ferme
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Modal pageSheet | Comme BuildingsCatalog, drag-to-dismiss | ✓ |
| Écran plein | Navigation push | |
| Bottom sheet | Sheet compact | |

**User's choice:** Modal pageSheet
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Coffre animé | Tap pour ouvrir, animation + haptic | ✓ |
| Carte de résultat | Statique, sobre | |
| Toast enrichi | Discret, pas de modal | |

**User's choice:** Coffre animé
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Badge + timer sur le bâtiment | Badge numérique (1/2) + countdown | ✓ |
| Animation du bâtiment | Fumée, lumière | |
| Les deux | Badge + animation | |

**User's choice:** Badge + timer sur le bâtiment
**Notes:** —

---

## Claude's Discretion

- Thèmes/noms des destinations
- Coûts exacts par difficulté
- Probabilités Facile et Dur
- Identité des habitants/graines exclusifs
- Durée et puissance des boosters
- Algorithme de génération du pool rotatif

## Deferred Ideas

- Bâtiments à niveaux infinis OGame-style (phase séparée)
- Expéditions familiales collectives
- Marché rotatif
- Défense de ferme
