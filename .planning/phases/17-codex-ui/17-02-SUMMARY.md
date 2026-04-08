---
phase: 17-codex-ui
plan: 02
subsystem: i18n
tags: [codex, i18n, locales, ui]
requires: [CODEX-07, CODEX-10]
provides:
  - codex.modal.*
  - codex.search.*
  - codex.tabs.* (10 kinds)
  - codex.detail.*
  - codex.card.locked
  - codex.tutorial.replay
affects:
  - locales/fr/codex.json
  - locales/en/codex.json
tech-stack:
  added: []
  patterns: [i18next-interpolation]
key-files:
  created: []
  modified:
    - locales/fr/codex.json
    - locales/en/codex.json
decisions:
  - "D-16 appliqué : parité stricte FR+EN sur toutes les clés UI codex ajoutées"
  - "Fusion non destructive avec namespace Phase 16 (codex.{crop,animal,...}.{name,lore}) préservé intact"
metrics:
  duration: 3min
  completed: 2026-04-08
requirements: [CODEX-07, CODEX-10]
---

# Phase 17 Plan 02 : Clés i18n codex UI — Summary

Ajout de 17 clés UI FR+EN dans locales/{fr,en}/codex.json (modal, search, tabs des 10 kinds, detail, card locked, tutorial replay) pour découpler les textes UI du code TSX de 17-03.

## Clés ajoutées (par sous-namespace)

### codex.modal
- `modal.title` — FR « Codex de la ferme » / EN « Farm codex »

### codex.search
- `search.placeholder` — placeholder de la barre de recherche
- `search.empty` — empty state avec interpolation i18next `{{query}}`

### codex.tabs (10 kinds alignés sur CodexKind)
- `tabs.crop`, `tabs.animal`, `tabs.building`, `tabs.craft`, `tabs.tech`
- `tabs.companion`, `tabs.loot`, `tabs.seasonal`, `tabs.saga`, `tabs.quest`

### codex.detail
- `detail.lore` — en-tête section description
- `detail.stats` — en-tête section caractéristiques
- `detail.close` — bouton fermeture modale

### codex.card
- `card.locked` — libellé carte entrée verrouillée (« ??? »)

### codex.tutorial
- `tutorial.replay` — bouton rejouer tutoriel

Total : **17 clés × 2 langues = 34 valeurs** ajoutées.

## Parité FR+EN

Vérifiée par script node inline :

```
OK parité 17 clés
FR modal.title: Codex de la ferme
EN modal.title: Farm codex
```

Aucune clé présente dans une seule langue. D-16 respecté.

## Préservation Phase 16

Les namespaces `codex.{crop,animal,building,craft,tech,companion,loot,seasonal,saga,quest}.{id}.{name,lore}` sont intacts. Vérifié : `codex.crop.carrot.name === "Carotte"` toujours présent.

## Consommation en 17-03

Le composant FarmCodexModal consommera ces clés via :

```ts
t('codex.modal.title')
t('codex.search.placeholder')
t('codex.search.empty', { query })
t(`codex.tabs.${kind}`)  // où kind ∈ CodexKind
t('codex.detail.lore')
t('codex.detail.stats')
t('codex.card.locked')
t('codex.tutorial.replay')
```

Les labels des entrées restent consommés via les clés Phase 16 existantes (`codex.${kind}.${id}.name` / `.lore`).

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Commits

- `c87adf0` — feat(17-02): ajouter clés UI codex FR+EN (modal, search, tabs, detail, card, tutorial)

## Self-Check: PASSED

- FOUND: locales/fr/codex.json (modal.title = "Codex de la ferme")
- FOUND: locales/en/codex.json (modal.title = "Farm codex")
- FOUND: commit c87adf0
- FOUND: 17 clés UI parité stricte FR+EN
- FOUND: namespace Phase 16 préservé (codex.crop.carrot.name = "Carotte")
