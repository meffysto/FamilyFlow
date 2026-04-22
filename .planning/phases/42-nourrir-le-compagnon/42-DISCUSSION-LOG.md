# Phase 42: Nourrir le compagnon - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 42-nourrir-le-compagnon
**Mode:** --auto (décisions préalablement validées en chat avec le user avant lancement de la phase)
**Areas discussed:** Concept global, Mécaniques buff, Affinités, Cooldown, Live Activity, UX refonte picker

---

## Concept global

| Option | Description | Selected |
|--------|-------------|----------|
| A — Faim simple | Hunger bar + feed picker, pattern Tamagotchi | |
| B — Préférences + bonus XP | A + affinités espèce/crop + buff XP gradé | ✓ |
| C — Évolution par régime | B + traits visuels long-terme + refus | |

**User's choice:** Option B
**Notes:** Le user a explicitement écarté Option A (trop basique) et Option C (scope trop large, sprites custom nécessaires). Option C notée comme candidate pour milestone v1.8 future.

---

## Cible du buff

| Option | Description | Selected |
|--------|-------------|----------|
| XP tâches uniquement | Buff appliqué sur XP gagné des tâches/routines/défis | ✓ |
| XP + récompenses récolte | Buff aussi sur feuilles/drops récolte | |
| Croissance crops accélérée | Buff raccourcit temps de croissance | |
| Mix | Combinaison | |

**User's choice:** XP tâches uniquement
**Notes:** Le user a clarifié que les grades donnent déjà plus de feuilles via les crafts. Faire buffer les récoltes créerait une boucle auto-alimentée. XP tâches uniquement = deux ressources distinctes (feuilles via crafts vs XP via feed) → vraie décision pour le joueur quand il a un crop parfait.

---

## Grille grade → buff

| Option | Description | Selected |
|--------|-------------|----------|
| Grille proposée | Ordinaire +5%/30min, Bon +10%/45min, Excellent +12%/60min, Parfait +15%/90min | ✓ |
| Linéaire simple | Tous grades = +10% / 60min | |
| Courbe exponentielle | Ordinaire +2%, Parfait +25% | |

**User's choice:** Grille proposée (validée tacitement)
**Notes:** La grille respecte la progression des grades et maintient l'intérêt de chercher le parfait sans rendre les bas grades inutiles.

---

## Affinités par espèce

| Option | Description | Selected |
|--------|-------------|----------|
| Préférences figées (×1.3 préféré, détesté sans buff) | Mapping hardcodé dans companion-types.ts | ✓ |
| Sans affinité | Tous les crops traités égaux | |
| Apprentissage dynamique | Le compagnon développe ses goûts selon ce qu'on lui donne | |

**User's choice:** Préférences figées
**Notes:** Chat=poisson, Chien=os, Lapin=carotte, Renard=fraise, Hérisson=champignon. Dégoûts symétriques (chat=oignon, etc.). "Second préféré" écarté pour v1.

---

## Cooldown

| Option | Description | Selected |
|--------|-------------|----------|
| 3h | 2-3 feeds/jour, rythme organique | ✓ |
| 1 fois/jour | Ultra simple, mais rate une journée = puni | |
| Basé sur faim | Peut nourrir dès que faim<20 | |
| Pas de cooldown | Spam possible | |

**User's choice:** 3h
**Notes:** Évite le stacking infini, laisse agency au joueur sur le timing stratégique.

---

## Points d'entrée UX

| Option | Description | Selected |
|--------|-------------|----------|
| Tap long sprite + bouton carte | Deux entrées (gesture + CTA) | ✓ |
| Tap long uniquement | Invisible, découvrabilité faible | |
| Bouton uniquement | OK mais moins naturel avec le sprite | |

**User's choice:** Deux entrées
**Notes:** Transformer le bouton "choisir compagnon" existant en carte compagnon avec action Nourrir primaire + Changer espèce secondaire.

---

## Live Activity

| Option | Description | Selected |
|--------|-------------|----------|
| speechBubble override (MVP) | Réutilise champ existant, zéro changement module natif | ✓ |
| Champ dédié buffLabel | Plus propre, nécessite update module natif iOS | |
| Pas de LA pour le buff | Juste in-app | |

**User's choice:** speechBubble override
**Notes:** MVP rapide, module natif inchangé pour v1. Champ dédié déféré v1.8+.

---

## Claude's Discretion

- Format exact de sérialisation `feedBuff` en frontmatter (flat vs nested JSON)
- Timing exact des animations (springs)
- Layout CompanionCard (vertical vs horizontal)
- Grid vs list dans le picker crops
- Wording exact des messages (le ton est donné, variantes acceptables)
- Durée précise du tap long (500-800ms)

## Deferred Ideas

- Barre de faim explicite (système actuel = implicite via cooldown)
- Second préféré par espèce
- Évolution visuelle long-terme (Option C entière)
- Plat préféré du jour rotatif
- Carnet de santé stats long terme
- Buff sur récoltes/feuilles/croissance crops (risque de boucle)
- Champ dédié `buffLabel` dans module natif Live Activity
- Sound design
