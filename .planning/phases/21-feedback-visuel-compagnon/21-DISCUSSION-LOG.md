# Phase 21: Feedback visuel + compagnon - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 21-feedback-visuel-compagnon
**Areas discussed:** Toast design par effet, Messages compagnon

---

## Toast design par effet

### Q1: Structure des 10 toasts d'effet

| Option | Description | Selected |
|--------|-------------|----------|
| Mapping fixe emoji + texte FR/EN | Dictionnaire EFFECT_TOASTS avec emoji, message FR et EN par EffectId | ✓ |
| Template dynamique avec valeurs | Messages avec placeholders remplis dynamiquement (quantité, durée) | |
| You decide | Claude choisit l'approche | |

**User's choice:** Mapping fixe emoji + texte FR/EN
**Notes:** Simple, prévisible, parité i18n garantie

### Q2: Timing du toast

| Option | Description | Selected |
|--------|-------------|----------|
| Immédiat (en parallèle du burst) | Toast apparaît en même temps que le HarvestBurst | ✓ |
| Séquencé après le burst | Burst joue d'abord (~800ms), puis toast | |
| You decide | Claude choisit | |

**User's choice:** Immédiat (en parallèle du burst)

### Q3: Type de toast

| Option | Description | Selected |
|--------|-------------|----------|
| Tous 'success' avec emoji différent | Type reste 'success' pour tous les effets | |
| Varier success/info selon l'effet | Effets actifs en success, passifs en info | |
| You decide | Claude choisit le mapping | ✓ |

**User's choice:** You decide

### Q4: Comportement quand cap atteint

| Option | Description | Selected |
|--------|-------------|----------|
| Silencieux si cappé | Pas de toast si isCapExceeded = true | ✓ |
| Toast info quand cappé | Afficher "🔒 Limite atteinte" | |
| You decide | Claude choisit | |

**User's choice:** Silencieux si cappé

---

## Messages compagnon

### Q1: Approche de contextualisation

| Option | Description | Selected |
|--------|-------------|----------|
| Templates fixes avec sub_type | Ajouter subType au CompanionEvent, templates dédiés par sub_type | ✓ |
| IA Haiku contextualisée | Passer catégorie dans generateCompanionAIMessage | |
| Mix templates + IA en bonus | Template fixe immédiat, IA async en remplacement | |

**User's choice:** Templates fixes avec sub_type

### Q2: Nombre de templates par catégorie

| Option | Description | Selected |
|--------|-------------|----------|
| 2 templates par catégorie | 20 templates total (10 × 2) | ✓ |
| 1 template par catégorie | 10 templates total, minimaliste | |
| 3 templates par catégorie | 30 templates total, plus de variété | |

**User's choice:** 2 templates par catégorie

### Q3: Canal d'affichage

| Option | Description | Selected |
|--------|-------------|----------|
| Bulle arbre uniquement | Compagnon parle dans sa bulle sur tree.tsx | ✓ |
| Toast partout + bulle arbre | Toast cross-écran + bulle sur retour arbre | |
| You decide | Claude choisit | |

**User's choice:** Bulle arbre uniquement

### Q4: Implémentation du sub_type

| Option | Description | Selected |
|--------|-------------|----------|
| Champ sub_type dans le contexte | Garder CompanionEvent = 'task_completed', ajouter subType? dans context | ✓ |
| Nouveaux events spécifiques | Créer 'task_completed_menage', etc. comme CompanionEvents | |
| You decide | Claude choisit | |

**User's choice:** Champ sub_type dans le contexte

---

## Claude's Discretion

- Toast type mapping (success vs info) par catégorie d'effet
- HarvestBurst variants visuels (golden/rare/ambient) — couleurs, animations, particules
- Haptic patterns — 10 patterns distincts basés sur lib/mascot/haptics.ts

## Deferred Ideas

None
