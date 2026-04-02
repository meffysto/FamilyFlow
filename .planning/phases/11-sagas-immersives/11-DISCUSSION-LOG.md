# Phase 11: Sagas Immersives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 11-sagas-immersives
**Areas discussed:** Personnage visiteur, Style d'interaction, Animation arrivée/départ, Indicateur dashboard
**Mode:** --auto (all decisions auto-selected)

---

## Personnage Visiteur

| Option | Description | Selected |
|--------|-------------|----------|
| Un personnage unique avec variations par saga | Voyageur mystérieux, tint/overlay par saga | ✓ |
| Un personnage différent par saga | 4 personnages distincts, plus de travail PixelLab | |
| Emoji/icône animée (pas de pixel art) | Plus simple mais moins immersif | |

**User's choice:** [auto] Un personnage unique avec variations par saga (recommended default)
**Notes:** Réaliste pour PixelLab, cohérent narrativement. Les variations visuelles par saga (couleur, effet particules) ajoutent de la variété sans multiplier les assets.

---

## Style d'Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Tap direct sur le personnage | Style Animal Crossing, bulle "!" indicateur | ✓ |
| Déclenchement automatique à l'entrée | Le dialogue s'ouvre tout seul en arrivant sur l'écran | |
| Bouton dédié dans le HUD | Un bouton "Parler" apparaît quand visiteur présent | |

**User's choice:** [auto] Tap direct sur le personnage (recommended default)
**Notes:** Le plus immersif et fidèle au style RPG/Animal Crossing voulu par l'utilisateur.

---

## Animation Arrivée / Départ

| Option | Description | Selected |
|--------|-------------|----------|
| Marche depuis le bord + idle + départ | Full animation cycle, le plus immersif | ✓ |
| Téléportation avec effet magique | Apparition/disparition instantanée avec particules | |
| Fondu enchaîné simple | Fade in/out, minimal | |

**User's choice:** [auto] Marche depuis le bord + idle + départ (recommended default)
**Notes:** Réutilise le pattern AnimatedAnimal (walk frames + translateX). Plus cohérent avec le monde pixel art.

---

## Indicateur Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Texte inline discret dans section jardin | "Un visiteur attend..." + tap vers arbre | ✓ |
| Mini-carte compacte | Petite carte avec emoji + 1 ligne de texte | |
| Badge/notification sur l'onglet arbre | Point rouge sur le tab | |

**User's choice:** [auto] Texte inline discret dans section jardin (recommended default)
**Notes:** Minimaliste, crée de la curiosité, pousse naturellement vers l'écran arbre.

---

## Claude's Discretion

- Position exacte du visiteur dans le viewBox TreeView
- Timing des animations (spring configs, delays)
- Design de la bulle "!" (taille, couleur, animation pulse)
- Prompt PixelLab pour la génération du personnage
- Adaptation responsive

## Deferred Ideas

- Personnages multiples par saga — phase future
- Dialogues IA adaptatifs — phase future
- Mini-cutscene avec camera pan — trop ambitieux
