# Phase 10: Compagnon Mascotte - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 10-compagnon-mascotte
**Areas discussed:** Obtention & choix, Evolution & perso, Interactions & bonus, Presence app-wide

---

## Obtention & choix

### Comment l'utilisateur obtient-il son compagnon ?

| Option | Description | Selected |
|--------|-------------|----------|
| Choix au debut | L'utilisateur choisit parmi 3-5 compagnons de base des qu'il atteint un niveau | ✓ |
| Oeuf en lootbox | Le compagnon s'obtient via un oeuf special dans une lootbox | |
| Quete d'introduction | Une mini-saga dediee ou le compagnon est rencontre et adopte | |

**User's choice:** Choix au debut (Recommended)

### Combien de compagnons actifs en meme temps ?

| Option | Description | Selected |
|--------|-------------|----------|
| Un seul actif | Un compagnon unique = lien emotionnel fort. Peut en debloquer d'autres plus tard | ✓ |
| Plusieurs actifs | Jusqu'a 3 compagnons en meme temps sur la scene | |
| Un seul, definitif | On choisit une fois pour toutes, pas de changement | |

**User's choice:** Un seul actif (Recommended)

### Quel lien avec les inhabitants existants ?

| Option | Description | Selected |
|--------|-------------|----------|
| Systemes separes | Le compagnon est un concept a part, inhabitants restent des decos cosmetiques | ✓ |
| Promotion d'inhabitant | Choisir un inhabitant existant pour le promouvoir en compagnon | |
| Remplacement | Le compagnon remplace le systeme d'inhabitants | |

**User's choice:** Systemes separes (Recommended)

### Quel type de compagnons ? (style visuel)

| Option | Description | Selected |
|--------|-------------|----------|
| Animaux mignons | Chat, chien, lapin, renard, herisson — style pixel art Mana Seed | ✓ |
| Creatures fantaisie | Dragon, fee, slime, golem | |
| Mix des deux | 3 animaux + 2 creatures fantaisie | |

**User's choice:** Animaux mignons (Recommended)

### Peut-on debloquer de nouveaux compagnons plus tard ?

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, via lootbox | Nouveaux compagnons dans les lootbox (rares/epiques) | ✓ |
| Oui, via niveaux | Debloques a certains paliers de niveau | |
| Non, juste le choix initial | Un seul compagnon, on le fait evoluer | |

**User's choice:** Oui, via lootbox

---

## Evolution & perso

### Qu'est-ce qui fait evoluer le compagnon visuellement ?

| Option | Description | Selected |
|--------|-------------|----------|
| Affection (interactions) | Evolue quand on interagit avec lui | |
| Niveau XP du profil | Grandit avec le niveau du joueur (comme l'arbre) | ✓ |
| Les deux combines | Niveau XP debloque les stades, affection accelere ou debloque variantes | |

**User's choice:** Niveau XP du profil (Recommended)

### Combien de stades d'evolution visuelle ?

| Option | Description | Selected |
|--------|-------------|----------|
| 3 stades | Bebe → Jeune → Adulte | ✓ |
| 5 stades | Comme les stades de l'arbre mais en 5 | |
| 2 stades | Petit → Grand | |

**User's choice:** 3 stades (Recommended)

### Le compagnon a-t-il une personnalite / un nom ?

| Option | Description | Selected |
|--------|-------------|----------|
| Nom custom + humeur | Nom + humeur qui change selon l'activite | ✓ |
| Nom custom seulement | Nom mais pas de systeme d'humeur | |
| Nom + traits de personnalite | Nom + 3-4 traits influencant animations | |

**User's choice:** Nom custom + humeur (Recommended)

### Le compagnon a-t-il des accessoires ?

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, via lootbox | Chapeaux, echarpes, lunettes | |
| Non, pas pour cette phase | Garder simple, accessoires en phase future | ✓ |
| Oui, achetables avec feuilles | Accessoires achetables avec la monnaie ferme | |

**User's choice:** Non, pas pour cette phase

---

## Interactions & bonus

### Quelles interactions avec le compagnon ?

| Option | Description | Selected |
|--------|-------------|----------|
| Tap = reaction animee | Tap declenche animation (saut, coeurs, etoiles) + haptic | ✓ |
| Nourrir + caresser | Systeme de faim/bonheur a maintenir | |
| Mini-interactions contextuelles | Micro-actions selon le contexte | |

**User's choice:** Tap = reaction animee (Recommended)

### Le compagnon donne-t-il des bonus de gameplay ?

| Option | Description | Selected |
|--------|-------------|----------|
| Bonus passif leger | +5% XP ou +1 recolte bonus/jour | ✓ |
| Pas de bonus mecanique | Purement emotionnel/visuel | |
| Bonus actif (cooldown) | Capacite speciale activable 1x/jour | |

**User's choice:** Bonus passif leger (Recommended)

### Le compagnon reagit-il aux evenements de l'app ?

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, bulles d'emotion | Bulle (coeur, etoile, exclamation) sur evenements | ✓ |
| Oui, animation + texte | Animation speciale + petit texte/dialogue | |
| Non, juste present | Visuellement present mais ne reagit pas | |

**User's choice:** Oui, bulles d'emotion (Recommended)

---

## Presence app-wide

### Ou le compagnon apparait-il hors de l'ecran arbre ?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard + toasts | Mini-avatar sur le dashboard + dans les toasts | |
| Partout (global) | Petit compagnon flottant visible sur tous les ecrans | |
| Arbre seulement pour cette phase | Le compagnon ne vit que dans l'ecran arbre | ✓ |

**User's choice:** Arbre seulement, mais avec conscience des actions de l'app (felicite pour taches, photos, etc.)
**Notes:** L'utilisateur veut que le compagnon soit conscient des evenements meme s'il ne vit que sur l'ecran arbre — messages contextuels sur les dernieres actions.

### Le compagnon sert-il d'avatar de profil ?

| Option | Description | Selected |
|--------|-------------|----------|
| Oui | Remplace ou complete l'avatar du profil dans la tab bar et le selecteur | ✓ |
| Non | Avatar de profil reste separe | |

**User's choice:** Oui (Recommended)

### Quelle approche pour les messages du compagnon ?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybride | Phrases predefinies par defaut + IA optionnelle si cle API configuree | ✓ |
| Predefini seulement | Pool de ~30-50 phrases templates, 0 EUR | |
| IA seulement | Toujours via Claude Haiku, ~1 EUR/mois | |

**User's choice:** Hybride (Recommended)
**Notes:** L'utilisateur a demande une estimation du cout IA generative avant de decider. Estimation: ~0.03 EUR/jour (~1 EUR/mois) pour Haiku avec un usage familial normal.

---

## Claude's Discretion

- Mapping exact niveau XP → stade d'evolution
- Nombre exact de compagnons au choix initial
- Pool exact de phrases predefinies et templates
- Valeur exacte du bonus passif
- Format de serialisation vault markdown

## Deferred Ideas

- Accessoires/cosmetiques compagnon (phase future)
- Presence globale dashboard/toasts (phase future)
- Traits de personnalite influencant animations (phase future)
- Mini-jeux avec le compagnon (phase future)
