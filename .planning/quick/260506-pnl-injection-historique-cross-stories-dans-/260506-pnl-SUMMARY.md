---
phase: 260506-pnl-injection-historique
plan: "01"
subsystem: ai-stories
tags: [ai-service, stories, anti-redundancy, memory]
dependency_graph:
  requires: []
  provides: [recentHistory-in-prompt]
  affects: [lib/ai-service.ts, app/(tabs)/stories.tsx]
tech_stack:
  added: []
  patterns: [conditional-prompt-injection, anonymization-pipeline]
key_files:
  created: []
  modified:
    - lib/ai-service.ts
    - app/(tabs)/stories.tsx
decisions:
  - "recentHistory optionnel : undefined quand l'enfant n'a aucune histoire — prompt inchangé (zero bloc parasite)"
  - "memoryReuseCount case-insensitive sur s.texte.includes(currentMemoryTitle) — simple et robuste"
  - "incipits = stripMarkdownHeading + slice(0,80) + anonymize — retire heading markdown avant l'extrait"
  - "Bloc HISTOIRES RÉCENTES injecté entre antiRedundancyRules et performanceTagsRules dans systemPrompt"
metrics:
  duration: "8min"
  completed: "2026-05-06"
  tasks: 2
  files: 2
---

# Phase 260506-pnl Plan 01: Injection historique cross-stories dans le prompt Summary

## One-liner

Injection conditionnelle des 5 dernières histoires (titres + incipits anonymisés) dans le system prompt de génération, avec compteur de réutilisation du memory courant pour cibler P3/P5/P7 de l'audit golden set.

## What Was Built

### Task 1 — Étendre StoryGenerationConfig + injecter recentHistorySection (lib/ai-service.ts)

- Ajout du champ optionnel `recentHistory?: { titles, incipits, memoryReuseCount }` dans `StoryGenerationConfig` (après `trancheAge`, avant `book`)
- Construction conditionnelle de `recentHistorySection` après le bloc `antiRedundancyRules`
- Interpolation `${recentHistorySection}` dans `systemPrompt` entre `${antiRedundancyRules}` et `${performanceTagsRules}`
- Avertissement explicite quand `memoryReuseCount >= 3` : le pivot est déclaré épuisé
- Log `__DEV__` pour tracer `titlesCount` et `memoryReuseCount` à chaque génération

### Task 2 — Populate recentHistory au call site (app/(tabs)/stories.tsx)

- Calcul de `childRecentStories` : filtre sur `s.enfantId === enfantId`, tri `date` desc, slice(0, 5)
- `stripMarkdownHeading()` : retire le heading `# Titre\n\n` en tête du texte vault avant l'extrait
- `memoryReuseCount` : compte les histoires récentes dont le texte contient le titre du memory courant (case-insensitive)
- `recentHistory` construit avec titres + incipits anonymisés via `anonymize(..., anonMap)` existant
- Passé à `generateBedtimeStory` juste après `trancheAge` ; `undefined` si aucune histoire passée

## Exemple de bloc HISTOIRES RÉCENTES généré

Quand un enfant a 3 histoires dans le vault :

```
HISTOIRES RÉCENTES de cet enfant (de la plus récente à la plus ancienne) — RÈGLE ANTI-DOUBLON :
  1. "La licorne de la rivière enchantée" — incipit : « Par un matin d'été, [Enfant] décide de suivre un ruisseau jusqu'à… »
  2. "Le premier vol du petit dragon" — incipit : « Dans la forêt des Grands Chênes, un petit dragon s'entraîne à… »
  3. "La fête des étoiles filantes" — incipit : « Ce soir, le ciel est plein de lumières et [Enfant] lève la tête vers… »

CONTRAINTES STRICTES :
- Le titre que tu produis DOIT être substantiellement différent de chacun des titres ci-dessus...
- Le PREMIER paragraphe de ton histoire DOIT ouvrir sur un cadre/lieu/personnage clairement différent...
- Si une scène d'ouverture évidente revient..., choisis une AUTRE accroche.
```

Quand `memoryReuseCount >= 3`, une ligne `⚠️ ATTENTION : ...Il est ÉPUISÉ...` est ajoutée.

## Coût tokens additionnel (estimé)

- 5 titres × ~10 tokens = ~50 tokens
- 5 incipits × ~25 tokens = ~125 tokens
- Règles + structure = ~80 tokens
- **Total ≈ 255 tokens** par génération quand recentHistory présent (0 si absent)

## Deviations from Plan

None — plan exécuté exactement comme spécifié.

## Known Stubs

None.

## Threat Flags

None — pas de nouvelle surface réseau ni endpoint.

## Todo de suivi

- Relancer un golden set 20 histoires pour confirmer la baisse de P3 (saturation memory), P5 (titres dupliqués) et P7 (quasi-clones)
- Envisager d'augmenter le slice à 7 si les patterns persistent (coût ~+100 tokens)
- `memoryReuseCount` basé sur `s.texte.includes(title)` — peut faux-positiver sur des titres courts (ex : "forêt") ; affiner avec un seuil de longueur minimum si nécessaire

## Self-Check: PASSED

- `lib/ai-service.ts` modifié et commité : d6bd54b1
- `app/(tabs)/stories.tsx` modifié et commité : f9a51d06
- `npx tsc --noEmit` : 0 nouvelle erreur dans les deux fichiers cibles
- Les 25 erreurs TS existantes sont dans `video/src/` (remotion — pré-existantes)
