---
phase: 52-stories-pipeline-d-valuation-auto-re-roll-qualit
plan: 03
subsystem: stories-eval
tags: [eval, llm-judge, haiku, zod, ui, badge, async-fire-and-forget, flag-gated]
requires:
  - lib/eval/feature-flag.ts:isEvalEnabled (Plan 52-01)
  - lib/eval/rubric-helpers.ts:anonymizeStoryText (Plan 52-01)
  - lib/types.ts:BedtimeStory.llm_judge (Plan 52-02)
  - lib/types.ts:BedtimeStory.quality_score (Plan 52-02)
provides:
  - lib/eval/llm-eval.ts:evaluateStoryWithLlm
  - lib/eval/llm-eval.ts:LlmEvalSchema
  - lib/eval/llm-eval.ts:LlmEvalResponse
  - lib/eval/prompts.ts:LLM_EVAL_SYSTEM_PROMPT
  - lib/eval/prompts.ts:LLM_EVAL_RETRY_PROMPT
  - components/stories/QualityBadge.tsx:QualityBadge
affects:
  - app/(tabs)/stories.tsx:GenerationStep.generate (LLM-judge async post-save)
  - app/(tabs)/stories.tsx:StoryCard (intégration <QualityBadge>)
tech-stack:
  added:
    - "zod ^4.4.3 (validation runtime de la réponse Haiku)"
  patterns:
    - "LLM-judge async fire-and-forget — jamais await sur le chemin critique bedtime"
    - "Zod safeParse + retry 1 + fallback neutre 5/10 (jamais d'exception remontée)"
    - "Anonymisation pré-LLM via rubric-helpers (T-52-03-01)"
    - "Modal pageSheet + drag-to-dismiss (convention CLAUDE.md)"
    - "Couleurs sémantiques (success/warning/error) via useThemeColors() — 0 hex hardcoded"
key-files:
  created:
    - lib/eval/llm-eval.ts
    - lib/eval/__tests__/llm-eval.test.ts
    - components/stories/QualityBadge.tsx
  modified:
    - lib/eval/prompts.ts
    - app/(tabs)/stories.tsx
    - package.json
    - package-lock.json
decisions:
  - "Emplacement badge : intégré dans la badgeRow existante (haut-droit) de StoryCard (app/(tabs)/stories.tsx ligne 247) — premier élément du flexRow, à gauche des badges audio/spectacle. Non-intrusif (rend null si flag off ou score absent, donc baseline strictement identique)."
  - "Zod 4.4.3 retenu (latest npm). API safeParse identique à 3.x — pas de breaking change pour notre usage. Documenté dans tech-stack.added."
  - "Couleur du dot intérieur badge : colors.onAccent (#FFFFFF light / dark) — garantit contraste sur fond success/warning/error sans hardcoder #fff (CLAUDE.md)."
  - "FALLBACK_NEUTRAL.justification = 'Score neutre — validation JSON échouée, fallback automatique.' (FR + factuel — l'utilisateur sait que c'est un fallback technique, pas un vrai score)."
  - "Strip markdown fences regex tolérant : `^\`\`\`(?:json)?\\s*` + `\\s*\`\`\`\\s*$` (Haiku met parfois des fences malgré l'instruction system)."
metrics:
  duration: ~30min
  completed: 2026-05-06
  tasks: 2
  files: 7
  tests-added: 10
  tests-total-eval-suite: 62 (45 + 7 + 10 — toutes vertes)
  tests-jest-full: 2098 passed (+10 vs baseline 52-02), 17 failed pré-existants (4 suites identiques à 52-02)
---

# Phase 52 Plan 03 : LLM-judge async + UI badge qualité

Complète la pipeline avec la couche qualitative subjective : LLM-judge Claude Haiku 4.5 (temp 0, max_tokens=300, JSON+Zod, fallback neutre), branché en **fire-and-forget post-saveStory** pour zéro impact sur l'UX bedtime. Affichage UI : `QualityBadge` couleur vert/ambre/rouge dans la badgeRow de chaque story de la bibliothèque, modal pageSheet listant les warnings + 4 sous-scores LLM + justification.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `lib/eval/llm-eval.ts` | `evaluateStoryWithLlm(story, child, config)` — call Haiku, Zod validate, 1 retry, fallback neutre, anonymisation. |
| `lib/eval/__tests__/llm-eval.test.ts` | 10 scenarios : parse OK, strip fences, retry, fallback 2 échecs, fetch error, HTTP 500, flag off, idempotence G7, model/max_tokens/temp, anonymisation. |
| `components/stories/QualityBadge.tsx` | Composant React badge couleur + modal détails FR. |

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `lib/eval/prompts.ts` | Implémentation `LLM_EVAL_SYSTEM_PROMPT` (FR, 4 dimensions, format JSON strict, 2 few-shot exemples) + `LLM_EVAL_RETRY_PROMPT` (durci). |
| `app/(tabs)/stories.tsx` | Import `evaluateStoryWithLlm` + `QualityBadge`. Branchement async fire-and-forget post-`saveStory(finalStory)`. Badge intégré dans `StoryCard.badgeRow`. |
| `package.json` | Ajout dependency `zod ^4.4.3`. |
| `package-lock.json` | Lock zod + sous-deps (auto). |

## Coverage tests llm-eval (10 scenarios)

1. **Parse JSON valide** — réponse propre `{"rythme":8,...}` ⇒ retourne objet validé Zod.
2. **Strip markdown fences** — `\`\`\`json\n{...}\n\`\`\`` ⇒ parse OK après strip.
3. **Retry sur JSON invalide puis valide** — 1ère réponse "pas du json" + 2ème valide ⇒ retourne 2ème, fetch appelé 2 fois.
4. **Fallback neutre sur 2 échecs JSON** — 2 réponses non-JSON ⇒ retourne `{rythme:5,...,justification:"Score neutre…"}`.
5. **Fallback neutre sur fetch error** — `fetch throw` ⇒ catch global, fallback neutre.
6. **Fallback neutre sur HTTP 500** — `r.ok=false` ⇒ throw interne, catch, fallback neutre.
7. **Skip si flag off** (G7) — `isEvalEnabled()=false` ⇒ retourne null, **fetch jamais appelé** (assertion explicite).
8. **Skip si llm_judge déjà rempli** (idempotence G7) — `story.llm_judge` truthy ⇒ retourne null, fetch jamais appelé.
9. **Body request** — body.model === `'claude-haiku-4-5-20251001'`, body.max_tokens === 300, body.temperature === 0.
10. **Anonymisation pré-LLM** (T-52-03-01) — story texte = `"Lucas marchait..."`, child.name = `"Lucas"` ⇒ user content envoyé contient `"Enfant"` et **ne contient pas** `"Lucas"`.

## Garanties baseline (EVAL-07)

`FEATURE_EVAL_ENABLED = false` (toujours, jusqu'au Plan 52-04).

Sous flag off, runtime baseline strictement préservé :

- **`evaluateStoryWithLlm`** retourne `null` instantanément ⇒ aucun appel `fetch`, aucune écriture vault, aucun coût.
- **`<QualityBadge>`** retourne `null` instantanément (early-return sur `isEvalEnabled()`) ⇒ DOM React identique baseline. La `badgeRow` reste visuellement inchangée.
- **Modal** jamais montée car `<Pressable>` n'est jamais rendu.

Quand le flag passera à `true` (Plan 52-04), il faudra que `quality_score` soit présent (rempli par le pipeline 52-02) ET, en parallèle async, `llm_judge` arrive ~1-3s après (fire-and-forget). L'UI bibliothèque s'enrichit progressivement sans bloquer la lecture.

## Cap coût (AI-SPEC §595)

| Constraint | Valeur | Vérification |
|---|---|---|
| Modèle | `claude-haiku-4-5-20251001` | Test `body.model === ...` ✓ |
| `max_tokens` | 300 | Test ✓ |
| `temperature` | 0 (déterminisme) | Test ✓ |
| Retry max | 1 (puis fallback) | Tests retry + fallback ✓ |
| Idempotence | skip si `story.llm_judge` truthy | Test ✓ — fetch jamais appelé |
| Coût borné/story | ≤ $0.005 (input ~600 tokens + output ≤300) | Cap dur via max_tokens ✓ |

Coût annuel borné par famille : ~$2.34/an (470 stories × $0.005, AI-SPEC §595).

## Threat mitigations vérifiées

| Threat | Mitigation | Test |
|---|---|---|
| T-52-03-01 (Information Disclosure) | `anonymizeStoryText` appelé avant envoi | ✓ Test "anonymise le prénom enfant" — Lucas → Enfant |
| T-52-03-02 (Prompt Injection) | System prompt strict + Zod schema borné | ✓ Tests parse rejettent toute structure non-conforme |
| T-52-03-03 (DoS / Cost) | Idempotence G7 + cap retry 1 + fallback sans 3ème call | ✓ Test "skip si llm_judge déjà rempli" — 0 fetch |

## Tests

```
$ npx jest lib/eval --no-coverage
PASS lib/eval/__tests__/helpers.test.ts (17 tests)
PASS lib/eval/__tests__/rubric.test.ts (28 tests)
PASS lib/eval/__tests__/pipeline.test.ts (7 tests)
PASS lib/eval/__tests__/llm-eval.test.ts (10 tests)
Tests: 62 passed, 62 total
```

```
$ npx tsc --noEmit
TypeScript compilation completed
```

```
$ npx jest --no-coverage
Test Suites: 4 failed, 88 passed, 92 total
Tests: 17 failed, 2098 passed, 2115 total
```

Les 4 suites failing sont **identiques à celles documentées dans 52-02-SUMMARY** (codex-content, auberge-auto-tick, useVaultCourses, insights — causées par `react-native-svg` / `lucide-react-native` sous Jest). Aucune régression introduite par ce plan ; +10 tests passants vs baseline 52-02 (2088 → 2098).

## Non-régression "Aucun await sur chemin critique"

```
$ grep -E "await\s+evaluateStoryWithLlm" "app/(tabs)/stories.tsx" components/stories/*.tsx
(vide — exit 1)
```

Le seul appel à `evaluateStoryWithLlm` est dans une chaîne `.then().catch()`, exécutée **après** `saveStory(finalStory)`. La latence d'affichage de la story n'est jamais bloquée par le LLM-judge.

## Calibration LLM-judge (optionnel — Plan 52-04)

La calibration "5 stories du golden set × 3 runs = 15 mesures + corrélation Spearman avec verdict humain" est mentionnée dans le PLAN comme **optionnelle pour Plan 52-04**. Non-exécutée ici (nécessite une clé API Haiku valide en environnement dev). Le test logique est couvert par les mocks ; la calibration empirique sera faite quand le toggle settings (Plan 52-04) sera activé sur un device de dev.

## Déviations

### Auto-fixed Issues

**1. [Rule 1 — Bug latent] Champs colors.background / colors.danger inexistants dans le PLAN**
- **Trouvé pendant :** Task 2 (premier `npx tsc --noEmit`)
- **Issue :** Le PLAN référence `colors.colors.success`, `colors.colors.danger`, `colors.colors.background`. Or `AppColors` expose `bg` (pas `background`), `error` (pas `danger`), et `useThemeColors()` retourne `{ colors, primary, ... }` directement (pas un wrapper `colors.colors`).
- **Fix :** Mappé sur les noms réels — `colors.success`, `colors.warning`, `colors.error`, `colors.bg` pour le background modal, `colors.onAccent` pour le texte sur badge coloré, `primary` (top-level) + `colors.onPrimary` pour le bouton Fermer.
- **Files modifiés :** `components/stories/QualityBadge.tsx`
- **Commit :** `a49c4088`

**2. [Rule 1 — Bug latent] FontSize.h2 inexistant**
- **Trouvé pendant :** Task 2 (review tokens avant tsc)
- **Issue :** Le PLAN stylait le titre modal avec `FontSize.h2` (taille 22 implicite). `constants/typography.ts` n'expose pas `h2` mais `titleLg: 22` (sémantique équivalent).
- **Fix :** `FontSize.titleLg`.
- **Files modifiés :** `components/stories/QualityBadge.tsx`
- **Commit :** `a49c4088`

### Limites documentées (non un bug)

- **Pas de calibration empirique** — la corrélation Spearman LLM↔humain sera mesurée en Plan 52-04 (toggle activé sur un device de dev).
- **Modal détails ne montre pas l'historique de re-roll** — si `quality_retried=true`, on l'indique en bas du modal mais on ne montre pas les scores de la version pré-re-roll (perdus volontairement, cf. 52-02 décision callback inline).

## Notes d'intégration

- **Flag toujours OFF** : Plan 52-04 ajoutera le toggle utilisateur dans Réglages.
- **Aucun bump CACHE_VERSION** : les stories sont volontairement exclues du cache (cf. CLAUDE.md, lib/vault-cache.ts:53).
- **`zod` est en dependencies (pas devDependencies)** — utilisé en runtime dans `lib/eval/llm-eval.ts:LlmEvalSchema.safeParse()`.
- **Aucun import depuis `lib/eval/llm-eval.ts` ailleurs que `app/(tabs)/stories.tsx`** : isolation respectée.

## Self-Check : PASSED

**Fichiers créés (vérifiés via Read tool) :**
- ✓ `lib/eval/llm-eval.ts`
- ✓ `lib/eval/__tests__/llm-eval.test.ts`
- ✓ `components/stories/QualityBadge.tsx`

**Fichiers modifiés (vérifiés via Edit tool) :**
- ✓ `lib/eval/prompts.ts` — system + retry prompts FR avec 2 few-shot
- ✓ `app/(tabs)/stories.tsx` — imports + branchement async + badge dans badgeRow
- ✓ `package.json` — zod ^4.4.3 ajouté en dependencies

**Commits (vérifiés `git log`) :**
- ✓ `ae821682` — test(52-03): ajoute tests llm-eval (RED) + installe zod
- ✓ `f019948e` — feat(52-03): implémente LLM-judge async (Haiku 4.5 + Zod + fallback neutre)
- ✓ `a49c4088` — feat(52-03): badge qualité UI + branchement LLM-judge async post-saveStory

**Vérifications automatisées :**
- ✓ `npx jest lib/eval/__tests__/llm-eval.test.ts --no-coverage` → 10 passed
- ✓ `npx jest lib/eval --no-coverage` → 62 passed (45 + 7 + 10)
- ✓ `npx jest --no-coverage` → 2098 passed (+10 vs 52-02), 17 failed pré-existants identiques à 52-02
- ✓ `npx tsc --noEmit` → clean
- ✓ `grep "claude-haiku-4-5-20251001" lib/eval/llm-eval.ts` → présent
- ✓ `grep "max_tokens: 300" lib/eval/llm-eval.ts` → présent
- ✓ `grep "temperature: 0" lib/eval/llm-eval.ts` → présent
- ✓ `grep "FALLBACK_NEUTRAL" lib/eval/llm-eval.ts` → présent
- ✓ `grep "anonymizeStoryText" lib/eval/llm-eval.ts` → présent
- ✓ `grep "isEvalEnabled" components/stories/QualityBadge.tsx` → présent (early-return flag off)
- ✓ `grep "pageSheet" components/stories/QualityBadge.tsx` → présent
- ✓ `grep -E "await\s+evaluateStoryWithLlm" "app/(tabs)/stories.tsx"` → vide (jamais await sur chemin critique)
- ✓ Aucune chaîne EN dans QualityBadge.tsx ni prompts.ts (FR strict)
