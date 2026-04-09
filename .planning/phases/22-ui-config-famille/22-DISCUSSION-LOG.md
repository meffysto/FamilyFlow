# Phase 22: UI config famille - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 22-ui-config-famille
**Areas discussed:** Placement écran, Persistance toggles, Preview des effets, Source données stats
**Mode:** --auto (all decisions auto-selected)

---

## Placement écran

| Option | Description | Selected |
|--------|-------------|----------|
| Section Expérience (après Gamification) | Cohérent avec les features gameplay existantes | ✓ |
| Nouvelle section dédiée | Séparer le couplage du reste |  |
| Sous-menu dans Gamification | Nicher dans l'écran gamification existant |  |

**User's choice:** [auto] Section Expérience après Gamification (recommended default)
**Notes:** Pattern SettingsRow + modal pageSheet déjà établi

---

## Persistance toggles

| Option | Description | Selected |
|--------|-------------|----------|
| Un objet JSON SecureStore (`semantic-overrides`) | 1 clé, `Record<CategoryId, boolean>`, absent = toutes ON | ✓ |
| 10 clés SecureStore individuelles | Plus simple par clé mais 10 reads |  |
| Section dans gami-{id}.md | Persistance vault mais mutation fichier |  |

**User's choice:** [auto] Un objet JSON SecureStore (recommended default)
**Notes:** Master toggle global (Phase 19 D-05) reste le kill switch. Per-catégorie = layer additionnel.

---

## Preview des effets

| Option | Description | Selected |
|--------|-------------|----------|
| Carte statique (icône + description + badge variant) | Réutilise EFFECT_TOASTS, pas d'animation | ✓ |
| Mini HarvestBurst animé dans la preview | Spectaculaire mais lourd pour un écran Settings |  |
| Texte seul (description effet) | Minimal, peu engageant |  |

**User's choice:** [auto] Carte statique avec badge variant (recommended default)
**Notes:** Les animations sont testables via le bouton DEV ⚡ dans l'arbre

---

## Source données stats

| Option | Description | Selected |
|--------|-------------|----------|
| Compteur SecureStore (`semantic-stats-week`) | Minimal, reset auto hebdo, 1 JSON | ✓ |
| Section stats dans gami-{id}.md | Persist long-terme mais c'est Phase 23 |  |
| Calcul à la volée depuis les effets appliqués | Pas de stockage supplémentaire mais pas de source de données |  |

**User's choice:** [auto] Compteur SecureStore hebdo (recommended default)
**Notes:** Phase 23 (Musée) gèrera la chronologie persistante

---

## Claude's Discretion

- Style visuel des cartes catégorie
- Ordre d'affichage des 10 catégories
- Style du toggle (Switch natif RN)

## Deferred Ideas

None
