# Phase 23: Musée des effets (SEED-002 lite) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 23-mus-e-des-effets-seed-002-lite
**Areas discussed:** Format persistance, Structure écran, Point d'enregistrement, Groupement temporel
**Mode:** --auto (all decisions auto-selected)

---

## Format persistance

| Option | Description | Selected |
|--------|-------------|----------|
| Section `## Musée` dans gami-{id}.md | Cohérent MUSEUM-03, pas de nouveau fichier | ✓ |
| Fichier séparé milestones-{id}.md | SEED-002 full design, mais overkill pour lite |  |
| SecureStore JSON | Pas de persistance vault, limite taille |  |

**User's choice:** [auto] Section dans gami-{id}.md (recommended default)

---

## Structure écran

| Option | Description | Selected |
|--------|-------------|----------|
| Modal pageSheet pattern FarmCodexModal | MUSEUM-05 exige patterns Codex Phase 17 | ✓ |
| Tab dans l'écran More | Moins immersif |  |
| Écran dédié via router | Plus lourd à naviguer |  |

**User's choice:** [auto] Modal pageSheet pattern Codex (recommended default)

---

## Point d'enregistrement

| Option | Description | Selected |
|--------|-------------|----------|
| Dans useGamification après applyTaskEffect | Point unique, hot path existant | ✓ |
| Dans un hook séparé useMuseum | Découplé mais duplication de logique |  |
| Via événement/callback | Over-engineering pour 1 consumer |  |

**User's choice:** [auto] Dans useGamification (recommended default)

---

## Groupement temporel

| Option | Description | Selected |
|--------|-------------|----------|
| SectionList par semaine (lun→dim) | MUSEUM-04, natif RN | ✓ |
| FlatList plat avec séparateurs date | Plus simple mais pas groupé |  |
| Tabs mois + FlatList jours | Trop complexe pour lite |  |

**User's choice:** [auto] SectionList par semaine (recommended default)

---

## Claude's Discretion

- Taille/densité des rows
- Icône bouton Musée
- Ordre chronologique des entrées
- Clés i18n

## Deferred Ideas

- Hub cross-feature (SEED-002 full)
- Groupement mois
- Filtrage par catégorie
- Carte d'inauguration narrative
