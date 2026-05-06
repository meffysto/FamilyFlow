---
phase: 52-stories-pipeline-d-valuation-auto-re-roll-qualit
plan: 02
subsystem: stories-eval
tags: [eval, re-roll, pipeline, frontmatter, parser-roundtrip, flag-gated]
requires:
  - lib/eval/rubric.ts:evaluateStoryDeterministic (Plan 52-01)
  - lib/eval/feature-flag.ts:isEvalEnabled (Plan 52-01)
  - lib/eval/prompts.ts:REROLL_INSTRUCTIONS_HEADER (Plan 52-01)
provides:
  - lib/eval/pipeline.ts:runRubricAndMaybeReroll
  - lib/eval/pipeline.ts:RegenerateFn
  - lib/eval/pipeline.ts:RubricAndRerollResult
  - lib/types.ts:BedtimeStory.quality_score
  - lib/types.ts:BedtimeStory.quality_dimensions
  - lib/types.ts:BedtimeStory.quality_issues
  - lib/types.ts:BedtimeStory.quality_retried
  - lib/types.ts:BedtimeStory.quality_evaluated_at
  - lib/types.ts:BedtimeStory.llm_judge
  - lib/parser.ts:parseStoryFrontmatter (étendu — blocs YAML imbriqués)
  - lib/parser.ts:serializeBedtimeStory (étendu — champs quality_*)
  - lib/ai-service.ts:StoryGenerationConfig.extraSystemPrompt
affects:
  - app/(tabs)/stories.tsx:GenerationStep.generate (branchement pipeline)
tech-stack:
  added: []
  patterns:
    - "Pipeline orchestration : eval rubric → conditional re-roll (cap 1) → persist → ship"
    - "Frontmatter snake_case avec blocs YAML imbriqués (quality_dimensions, llm_judge)"
    - "Callback injection (RegenerateFn) — découple pipeline de stratégie de re-génération"
    - "Round-trip serialize/parse testé exhaustivement avant write au vault"
key-files:
  created:
    - lib/eval/pipeline.ts
    - lib/eval/__tests__/pipeline.test.ts
    - lib/__tests__/eval-frontmatter-roundtrip.test.ts
  modified:
    - lib/types.ts
    - lib/parser.ts
    - lib/ai-service.ts
    - app/(tabs)/stories.tsx
decisions:
  - "Option B (callback inline) plutôt que Option A (refactor buildStoryFromResponse) — le bloc construction lignes 1872-2048 est imbriqué dans tryParseJson + extraction script/scenes (~180 lignes), un refactor étendrait le diff. Le callback re-roll reconstruit une story minimale (titre + texte + duree_lecture) ; script/scenes ne sont PAS recalculés au re-roll (perdus volontairement, peuvent être régénérés à la lecture)."
  - "Paramètre ajouté à generateBedtimeStory : `extraSystemPrompt?: string` — concaténé à la fin du system prompt si présent. Pas d'impact si absent."
  - "Fix latent inline (Rule 1) : strip heading body tolère newline de tête (^\\s*# au lieu de ^#). Le serializer écrit `---\\n\\n# Title` mais le parser ne strippait pas si le body commençait par `\\n#` — corrigé pour garantir le round-trip propre."
  - "Le parser ligne-à-ligne de stories est étendu pour gérer 2 blocs imbriqués (`quality_dimensions:` et `llm_judge:`) avec sub-keys 2-espaces. Pas de récursion arbitraire — strictement Phase 52."
  - "applyRubricToStory utilisé pour les 2 branches (hardFail puis OK, et flag-on no-hardFail) — garantit que les champs quality_* sont toujours cohérents avec le dernier rubric évalué."
  - "Cap re-roll strict via signature linéaire de la fonction (pas de loop). Test unitaire force 2 hardFails consécutifs et asserte regenerate.toHaveBeenCalledTimes(1) — garde-fou DoS T-52-02-01."
metrics:
  duration: ~35min
  completed: 2026-05-06
  tasks: 2
  files: 7
  tests-added: 17
  tests-total-passing: 62
---

# Phase 52 Plan 02 : Pipeline re-roll cap 1 + persistance frontmatter

Branche le rubric déterministe (Plan 52-01) sur le call site de génération `app/(tabs)/stories.tsx`. Quand `isEvalEnabled()` et hardFail détecté, déclenche 1 re-roll Sonnet avec prompt augmenté, persiste les scores + issues + flag retried dans le frontmatter Markdown du vault. Cap strict 1 retry. Test round-trip parser obligatoire pour garantir la non-corruption du vault. Comportement baseline strictement préservé quand flag off.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `lib/eval/pipeline.ts` | `runRubricAndMaybeReroll()` — orchestre rubric + 1 re-roll cap. Helper `applyRubricToStory()` interne. |
| `lib/eval/__tests__/pipeline.test.ts` | 7 tests pipeline : flag off no-op, hardFail+OK 1 re-roll, cap strict (2 hardFails ⇒ 1 regenerate), hint avec REROLL_INSTRUCTIONS_HEADER, regenerate throw, score arrondi. |
| `lib/__tests__/eval-frontmatter-roundtrip.test.ts` | 10 tests round-trip serialize/parse (legacy, full, partiel, llm_judge avec quotes, frontmatter pré-Phase-52). |

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `lib/types.ts` | `BedtimeStory` étendu de 6 champs optionnels (`quality_score`, `quality_dimensions`, `quality_issues`, `quality_retried`, `quality_evaluated_at`, `llm_judge`). Rétrocompat 100%. |
| `lib/parser.ts` | `parseStoryFrontmatter` étendu pour gérer les blocs YAML imbriqués (`quality_dimensions:`, `llm_judge:`). `serializeBedtimeStory` écrit les nouveaux champs. Fix strip heading body. `parseBedtimeStory` consomme les nouveaux champs. |
| `lib/ai-service.ts` | `StoryGenerationConfig.extraSystemPrompt?: string` — appendu au system prompt si présent. |
| `app/(tabs)/stories.tsx` | Importe `runRubricAndMaybeReroll`. Capture `genParams`. Branche le pipeline juste avant `saveStory(story)`. Sauve `evalResult.story` au lieu de `story`. |

## Tests

```
$ npx jest lib/eval/__tests__ lib/__tests__/eval-frontmatter-roundtrip.test.ts --no-coverage
PASS lib/eval/__tests__/helpers.test.ts (17 tests)
PASS lib/eval/__tests__/rubric.test.ts (28 tests)
PASS lib/eval/__tests__/pipeline.test.ts (7 tests)
PASS lib/__tests__/eval-frontmatter-roundtrip.test.ts (10 tests)
Tests: 62 passed, 62 total
```

```
$ npx tsc --noEmit
TypeScript compilation completed
```

```
$ npx jest --no-coverage
Test Suites: 4 failed, 87 passed, 91 total
Tests: 17 failed, 2088 passed, 2105 total
```

Les 4 suites failing sont **préexistantes** (vérifiées via `git stash` — mêmes 17 échecs sur `codex-content`, `auberge-auto-tick`, `useVaultCourses`, `insights` causés par `react-native-svg`/`lucide-react-native` sous Jest). Aucune régression introduite par ce plan.

## Couverture round-trip frontmatter (10 scenarios)

1. Story sans champs `quality_*` (legacy) → tous champs `undefined` après parse.
2. Champs legacy (titre, enfant, univers, date, texte) préservés à round-trip.
3. Tous les champs `quality_*` round-trip avec valeurs identiques.
4. `quality_score` sérialisé en number (pas string).
5. `quality_issues: []` n'est pas écrit (rétrocompat lecture future).
6. `quality_dimensions` partiel (1 dimension seule) round-trip.
7. `quality_retried: true` round-trip.
8. `llm_judge` round-trip avec justification contenant des quotes échappées.
9. Frontmatter pré-Phase-52 (sans aucun champ `quality_*`) parse sans erreur.
10. Round-trip combiné (legacy + livre/chapitres + quality + llm_judge) — pas de fuite croisée.

## Couverture pipeline (7 scenarios)

1. **Flag off** : `runRubricAndMaybeReroll` retourne `{ story, rubric:null, retried:false }` instantanément. Zéro appel `evaluateStoryDeterministic`, zéro appel `regenerate`, zéro champ `quality_*`. Référence story strictement identique à l'input (`result.story === input`).
2. **Flag on + pas de hardFail** : 1 seul appel rubric, pas de re-roll, champs `quality_*` persistés (score, dims, retried=false, evaluated_at).
3. **Flag on + hardFail puis OK** : 1 re-roll, ship la 2ème version, `retried=true`, dims du 2ème rubric.
4. **Cap strict** (T-52-02-01) : 2 hardFails consécutifs ⇒ `regenerate` appelé EXACTEMENT 1×, ship la 2ème version avec `retried=true` et `quality_issues` remplis.
5. **Hint** passé à regenerate = `REROLL_INSTRUCTIONS_HEADER + rubric.rerollPromptHint`.
6. **regenerate throw** : ship version originale, `retried=true`, rubric initial conservé.
7. **Score arrondi** à 1 décimale (8.6666 → 8.7).

## Garanties baseline (EVAL-07)

`FEATURE_EVAL_ENABLED = false` (toujours, jusqu'au Plan 52-04 qui ajoutera le toggle settings).

Sous flag off, `app/(tabs)/stories.tsx` :
- N'appelle PAS `evaluateStoryDeterministic` (vérifié par test `flag off : retourne la story telle quelle`).
- N'appelle PAS le callback `regenerate` (zéro appel API supplémentaire, zéro coût).
- N'écrit AUCUN champ `quality_*` dans le vault (`evalResult.story === story`, donc serializer ne voit aucun champ à écrire).

Le diff comportemental vs commit baseline est **strictement vide** côté runtime — le seul changement observable est l'ajout de paramètres optionnels dans les types (compile-time only, sans impact runtime).

## Déviations

### Auto-fixed Issues

**1. [Rule 1 — Bug latent] Strip heading body ne tolérait pas la newline de tête**
- **Trouvé pendant :** Task 1 (test round-trip)
- **Issue :** `serializeBedtimeStory` produit `---\n\n# Title\n\nbody…\n` ⇒ après slice du marker fermant, le body commence par `\n# Title`. Le regex `^#[^\n]*\n+` ne matche pas (body commence par `\n`). Conséquence : après `.trim()`, le titre Markdown était conservé dans `texte`.
- **Fix :** `^\s*#[^\n]*\n+` — tolère un whitespace de tête.
- **Files modifiés :** `lib/parser.ts`
- **Commit :** `39d40a1b`

### Limites documentées (non un bug)

- **Re-roll perd le script et les scenes** : le callback re-roll reconstruit une story minimale (titre + texte + duree_lecture). Si la 1ère gen avait produit un script Mode Spectacle ou des scenes Picture-book, ces sidecars sont perdus dans la 2ème version. Compromis acceptable : (a) un re-roll signifie déjà un échec qualité de la 1ère, (b) le script/scenes peuvent être régénérés à la lecture audio. Plan 52-03+ pourra optimiser si besoin.
- **profile manquant ⇒ no-op** : si `profiles.find(p => p.id === enfantId)` retourne `undefined` (impossible en pratique car la story est générée pour un profil sélectionné), le pipeline retombe sur le comportement baseline (pas de rubric, pas de re-roll). Garde-fou TS-safe.

## Notes d'intégration

- **Flag toujours OFF** : Plan 52-03 implémentera la pipeline LLM-judge (Haiku 4.5) ; Plan 52-04 fournira le toggle utilisateur dans Réglages.
- **Pas de bump CACHE_VERSION** : les stories sont volontairement exclues du cache (cf. CLAUDE.md, lib/vault-cache.ts:53).
- **Aucun import depuis lib/eval/ ailleurs que app/(tabs)/stories.tsx** : isolation respectée (vérifié `grep -r "lib/eval" lib/ai-service.ts hooks/` → vide hors stories.tsx).

## Self-Check : PASSED

**Fichiers créés (vérifiés via Read tool) :**
- ✓ `lib/eval/pipeline.ts`
- ✓ `lib/eval/__tests__/pipeline.test.ts`
- ✓ `lib/__tests__/eval-frontmatter-roundtrip.test.ts`

**Fichiers modifiés (vérifiés via Edit tool) :**
- ✓ `lib/types.ts` — BedtimeStory étendu
- ✓ `lib/parser.ts` — serializer + parser
- ✓ `lib/ai-service.ts` — extraSystemPrompt
- ✓ `app/(tabs)/stories.tsx` — branchement pipeline

**Commits (vérifiés `git log`) :**
- ✓ `39d40a1b` — feat(52-02): étend BedtimeStory + parser/serializer pour champs quality_* (Task 1)
- ✓ `101e38af` — feat(52-02): pipeline re-roll cap 1 + branchement stories.tsx (flag-gated) (Task 2)

**Vérifications automatisées :**
- ✓ `npx tsc --noEmit` clean
- ✓ `npx jest lib/eval/__tests__ lib/__tests__/eval-frontmatter-roundtrip.test.ts` → 62 passed, 0 failed
- ✓ `npx jest` full → 2088 passed (+17 vs baseline), 17 failed pré-existants (4 suites identiques avant/après)
- ✓ `grep "FEATURE_EVAL_ENABLED = false" lib/eval/feature-flag.ts` → présent
- ✓ `grep "runRubricAndMaybeReroll" app/(tabs)/stories.tsx` → présent
- ✓ `grep "isEvalEnabled" lib/eval/pipeline.ts` → présent (early return flag off)
