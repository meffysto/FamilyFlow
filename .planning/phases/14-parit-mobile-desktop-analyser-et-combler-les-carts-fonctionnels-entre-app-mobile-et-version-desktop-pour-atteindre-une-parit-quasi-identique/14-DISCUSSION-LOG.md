# Phase 14: Parité Mobile ↔ Desktop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 14-parite-mobile-desktop
**Areas discussed:** Scope écrans, Interactions desktop, Animations, OCR Budget, Gamification desktop
**Mode:** --auto (all decisions auto-selected)

---

## Scope des écrans

| Option | Description | Selected |
|--------|-------------|----------|
| Tous les 10 écrans manquants | Implémenter Skills, Health, Routines, Pregnancy, Night-Mode, Compare, Stats, RDV, Notes, More | ✓ |
| Écrans prioritaires seulement | Seulement Tier 1-2 (RDV, Notes, Stats, Skills) | |
| Écrans essentiels | Seulement les écrans avec données critiques (Health, Budget OCR) | |

**User's choice:** [auto] Tous les 10 écrans manquants (recommended — parité complète demandée)
**Notes:** L'utilisateur a explicitement demandé une "version quasiment identique"

---

## Interactions desktop

| Option | Description | Selected |
|--------|-------------|----------|
| Hover menus + boutons contextuels + raccourcis clavier | Pattern desktop standard — hover reveal, context menus, keyboard shortcuts | ✓ |
| Boutons visibles uniquement | Pas de hover states, tous les boutons toujours visibles | |
| Minimal — clics seulement | Pas de raccourcis, pas de hover, interface simplifiée | |

**User's choice:** [auto] Hover menus + boutons contextuels + raccourcis clavier (recommended)
**Notes:** Mapping complet des gestes mobiles vers équivalents desktop documenté dans D-02

---

## Animations desktop

| Option | Description | Selected |
|--------|-------------|----------|
| CSS transitions + Framer Motion | CSS pour le simple, Framer Motion pour le complexe (loot box, harvest) | ✓ |
| CSS-only | Pas de librairie JS, tout en CSS keyframes | |
| Framer Motion partout | Cohérence avec une seule librairie d'animation | |

**User's choice:** [auto] CSS transitions + Framer Motion (recommended — bon équilibre perf/fidélité)
**Notes:** Framer Motion n'est pas encore dans les dépendances desktop — à ajouter

---

## OCR Budget

| Option | Description | Selected |
|--------|-------------|----------|
| Drag & drop fichier + bouton upload | Zone drag & drop + fallback file input, même pipeline Claude Vision | ✓ |
| Bouton upload seulement | File input classique, pas de drag & drop | |
| Copier-coller image | Ctrl+V pour coller une image du clipboard | |

**User's choice:** [auto] Drag & drop + upload (recommended — naturel sur desktop)
**Notes:** L'utilisateur a cité cet exemple spécifiquement comme manquant

---

## Gamification desktop

| Option | Description | Selected |
|--------|-------------|----------|
| Parité complète | Loot animé, companions, sagas, seasonal events, tech tree, badges | ✓ |
| Essentiel seulement | Loot box + XP/niveaux, pas de companions ni sagas | |
| Lecture seule | Afficher les données gamification sans interactions | |

**User's choice:** [auto] Parité complète (recommended — cohérence cross-platform)
**Notes:** Inclut companion system, sagas immersives, événements saisonniers

---

## Claude's Discretion

- Choix librairie charts (recharts, victory, chart.js)
- Structure CSS (pattern existant desktop)
- Ordre d'implémentation des écrans
- Librairie confetti

## Deferred Ideas

None
