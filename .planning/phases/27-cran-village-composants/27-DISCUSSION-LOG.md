# Phase 27: Ecran Village + composants - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 27-cran-village-composants
**Areas discussed:** Structure ecran & navigation, Feed contributions & indicateurs, Barre progression objectif, Panneau historique

---

## Structure ecran & navigation

### Q1: Comment accede-t-on a l'ecran Village ?

| Option | Description | Selected |
|--------|-------------|----------|
| Sous-ecran ferme | Accessible depuis un bouton/portail sur l'ecran ferme (tree.tsx). Coherent avec le portail prevu en Phase 28. | ✓ |
| Nouvel onglet tab | Onglet dedie dans la barre de navigation du bas. Toujours visible, acces direct. | |
| Modal depuis ferme | S'ouvre en modal pageSheet (drag-to-dismiss) depuis la ferme. | |

**User's choice:** Sous-ecran ferme (Recommande)
**Notes:** Navigation via router.push('/(tabs)/village'), pas de nouvel onglet tab visible.

### Q2: Quel layout general pour l'ecran Village ?

| Option | Description | Selected |
|--------|-------------|----------|
| Carte + panels scroll | Carte tilemap fixe en haut (40-50% ecran), puis sections scrollables en dessous. | ✓ |
| Plein ecran immersif | Carte tilemap occupe tout l'ecran, panels en overlay ou bottom sheet. | |
| Tu decides | Claude choisit le layout le plus adapte. | |

**User's choice:** Carte + panels scroll (Recommande)
**Notes:** Pattern similaire a tree.tsx.

### Q3: Le bouton pour acceder au village depuis la ferme ?

| Option | Description | Selected |
|--------|-------------|----------|
| Bouton flottant | FAB sur l'ecran ferme avec icone village. Temporaire avant portail Phase 28. | ✓ |
| Bouton dans header | Bouton dans la barre de navigation en haut. | |
| Tu decides | Claude choisit le placement. | |

**User's choice:** Bouton flottant (Recommande)

---

## Feed contributions & indicateurs

### Q4: Comment presenter le feed des contributions ?

| Option | Description | Selected |
|--------|-------------|----------|
| Liste chronologique | Contributions du plus recent au plus ancien. Avatar + nom + type + montant + heure relative. | ✓ |
| Groupe par membre | Contributions regroupees par profil avec total par membre. | |
| Compact resume | Juste les totaux par membre avec avatars, sans detail. | |

**User's choice:** Liste chronologique (Recommande)

### Q5: Comment afficher l'indicateur de contribution par membre ?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatars + chiffres en ligne | Rangee horizontale d'avatars avec total sous chaque avatar. | ✓ |
| Mini barres par membre | Petite barre de progression proportionnelle par membre. | |
| Tu decides | Claude choisit la presentation. | |

**User's choice:** Avatars + chiffres en ligne (Recommande)

### Q6: Limiter le feed a combien d'entrees visibles ?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 dernieres + "voir tout" | 5 contributions les plus recentes avec lien pour deplier. | ✓ |
| Tout afficher | Toutes les contributions sans limite. | |
| Tu decides | Claude decide du nombre optimal. | |

**User's choice:** 5 dernieres + "voir tout" (Recommande)

---

## Barre progression objectif

### Q7: Quel style pour la barre de progression ?

| Option | Description | Selected |
|--------|-------------|----------|
| LiquidXPBar reutilisee | Reutiliser LiquidXPBar avec couleurs village (vert). Zero nouveau composant. | ✓ |
| Barre custom village | Composant dedie avec segments par membre, plus distinctif. | |
| Tu decides | Claude choisit entre reutilisation et custom. | |

**User's choice:** LiquidXPBar reutilisee (Recommande)

### Q8: Que montrer quand l'objectif est atteint ?

| Option | Description | Selected |
|--------|-------------|----------|
| Barre complete + bouton claim | Barre 100% doree/festive + bouton "Reclamer la recompense". | ✓ |
| Barre complete sans bouton | Barre 100% avec texte felicitant, bouton claim reporte a Phase 28. | |
| Tu decides | Claude gere l'etat visuel. | |

**User's choice:** Barre complete + bouton claim (Recommande)

---

## Panneau historique

### Q9: Comment presenter l'historique des semaines ?

| Option | Description | Selected |
|--------|-------------|----------|
| CollapsibleSection par semaine | Chaque semaine est un CollapsibleSection. Resume visible, detail au depliement. | ✓ |
| Liste plate scrollable | Toutes les semaines en liste simple sans expansion. | |
| Tu decides | Claude choisit le format. | |

**User's choice:** CollapsibleSection par semaine (Recommande)

### Q10: Placement du panneau historique ?

| Option | Description | Selected |
|--------|-------------|----------|
| Dans le scroll | Section en bas de l'ecran, apres le feed. Tout dans le meme scroll. | ✓ |
| Element interactif carte | Panneau cliquable sur la carte tilemap, ouvre un bottom sheet. | |
| Les deux | Section dans le scroll ET element cliquable sur la carte. | |

**User's choice:** Dans le scroll (Recommande)

---

## Claude's Discretion

- Style exact du FAB (icone, couleur, position)
- Animations de transition vers l'ecran village
- Detail du layout interne de chaque section (padding, espacement)

## Deferred Ideas

None -- discussion stayed within phase scope.
