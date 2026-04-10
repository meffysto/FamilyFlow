# Phase 28: Portail + câblage contributions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 28-portail-câblage-contributions
**Areas discussed:** Portail visuel, Câblage contributions, Récompense collective, Remplacement du FAB

---

## Portail visuel

### Style du portail

| Option | Description | Selected |
|--------|-------------|----------|
| Arche en pierre | Sprite pixel art d'une arche/porte en pierre avec effet lumineux subtil (particules ou glow Reanimated). Cohérent avec l'univers ferme pixel. | ✓ |
| Chemin pavé + panneau | Un chemin de pavés qui sort du bord de la ferme avec un panneau « Village ». Tap sur le panneau pour naviguer. Plus discret. | |
| Vortex/portail magique | Cercle lumineux tourbillonnant style fantasy. Plus spectaculaire mais peut détonner avec le style pixel art ferme. | |

**User's choice:** Arche en pierre
**Notes:** —

### Transition Reanimated

| Option | Description | Selected |
|--------|-------------|----------|
| Fade cross-dissolve | Fade out ferme → fade in village (~400ms). Simple, élégant, cohérent avec les transitions existantes de l'app. | ✓ |
| Zoom vers le portail | La caméra zoome vers le portail puis fade vers le village. Plus cinématique mais plus complexe. | |
| Tu décides | Claude choisit l'approche la plus adaptée au contexte technique. | |

**User's choice:** Fade cross-dissolve
**Notes:** —

---

## Câblage contributions

### Points par action

| Option | Description | Selected |
|--------|-------------|----------|
| 1 point chacun | 1 récolte = 1 point, 1 tâche = 1 point. Simple, équitable, l'objectif hebdo s'ajuste via computeWeekTarget(). | ✓ |
| Pondéré par difficulté | Tâches difficiles ou récoltes rares valent plus. Plus gratifiant mais plus complexe à calibrer. | |
| Tu décides | Claude choisit le système de points le plus adapté. | |

**User's choice:** 1 point chacun
**Notes:** —

### Feedback contribution automatique

| Option | Description | Selected |
|--------|-------------|----------|
| Toast discret | Petit toast « +1 Village 🏡 » en bas d'écran, 2s, non-bloquant. L'action principale garde son propre feedback existant. | ✓ |
| Silencieux | Aucun feedback visible — la contribution apparaît quand on ouvre le village. | |
| Animation dédiée | Petite icône qui vole vers un indicateur village en overlay. Spectaculaire mais risque de surcharger l'écran. | |

**User's choice:** Toast discret
**Notes:** —

---

## Récompense collective

### Bonus in-game

| Option | Description | Selected |
|--------|-------------|----------|
| XP fixe + item aléatoire | Chaque profil reçoit un montant fixe d'XP + un item cosmétique aléatoire du loot pool existant. | |
| XP proportionnel à la contribution | Plus tu as contribué, plus tu gagnes d'XP. Risque anti-pattern famille. | |
| Tu décides | Claude choisit le système de récompense le plus adapté au contexte. | ✓ |

**User's choice:** Tu décides
**Notes:** Claude a discrétion sur le montant XP et la nature de l'item cosmétique. Doit être équitable (même pour tous).

### Suggestion activité IRL

| Option | Description | Selected |
|--------|-------------|----------|
| Carte dans l'écran village | Quand l'objectif est atteint, une carte apparaît sur le village avec la suggestion. Dismiss par tap. Liste curated ~20 activités, filtrées par saison. | ✓ |
| Modal de célébration | Modal plein écran festif avec confettis + la suggestion. Plus spectaculaire, interrompt le flow. | |
| Tu décides | Claude choisit le format le plus adapté. | |

**User's choice:** Carte dans l'écran village
**Notes:** —

---

## Remplacement du FAB

### Accès au village

| Option | Description | Selected |
|--------|-------------|----------|
| Portail seul suffit | Le portail remplace le FAB. Un seul point d'entrée clair. Depuis le village, un bouton retour ramène à la ferme. | ✓ |
| Portail + bouton header | Garder un petit bouton dans le header de la ferme en complément du portail. Redondant mais plus accessible. | |
| Portail + tab bar | Ajouter le village comme onglet permanent. Augmente la visibilité mais encombre la tab bar. | |

**User's choice:** Portail seul suffit
**Notes:** —

---

## Claude's Discretion

- Montant du bonus XP et nature de l'item cosmétique (D-07)

## Deferred Ideas

- Enrichissement interactif du village (avatars, ambiance, arbre familial) — v1.5 (VILL-01 à VILL-05)
- Portail bidirectionnel visuel dans le village — v1.5 potentiel
