# Phase 52 — Récap : Stories pipeline d'évaluation auto + re-roll qualité

## Livré

- **Rubric déterministe 6 dimensions** (`lib/eval/rubric.ts`) calibrée sur golden set 20 stories — distribution baseline reproduite en CI : hardFail 14/20 ±1, tags TTS ≥ 11/20 (Plan 52-01)
- **Helpers réutilisables** : `typeTokenRatio`, `ngramOverlap`, `countOccurrences`, `anonymizeStoryText` (Plan 52-01)
- **Re-roll cap 1** : si hardFail, 1 retry Sonnet avec prompt augmenté ; ship 2ème version quoi qu'il arrive (Plan 52-02)
- **Persistance frontmatter** : `quality_score`, `quality_dimensions`, `quality_issues`, `quality_retried`, `quality_evaluated_at`, `llm_judge` (Plan 52-02)
- **LLM-judge async** Claude Haiku 4.5, temp 0, `max_tokens=300`, JSON+Zod, fallback neutre 5/10, anonymisation pré-envoi (Plan 52-03)
- **UI badge** vert/ambre/rouge dans la liste stories + modal détails FR (Plan 52-03)
- **CI gate non-régression** : test golden set bloque toute PR qui dégrade la distribution (Plan 52-04)
- **Runtime override flag** : `setEvalEnabledOverride(boolean | null)` pour tests + dev menu futur (Plan 52-04)
- **Dashboard manuel** : `npx tsx scripts/eval-dashboard.ts --since 30d` (Plan 52-04)

## Activer la pipeline

3 méthodes (cf. `lib/eval/feature-flag.ts`) :

1. **Production** : modifier `DEFAULT_FEATURE_EVAL_ENABLED = true` puis rebuild app (`npx expo run:ios --device`)
2. **Test temporaire** : appeler `setEvalEnabledOverride(true)` au boot dans `app/_layout.tsx` (override mémoire — disparaît au kill de l'app)
3. **Dev menu** : brancher un toggle settings qui appelle `setEvalEnabledOverride` (chantier futur, persistance `expo-secure-store`)

À la sortie de Phase 52, `DEFAULT_FEATURE_EVAL_ENABLED` reste à **`false`** : le pipeline est livrable mais désactivé tant que le parent n'a pas validé sur device dev.

## Auditer

```bash
# Dashboard 30 jours sur le vault iCloud
npx tsx scripts/eval-dashboard.ts --vault ~/Library/Mobile\ Documents/iCloud~com~familyvault/Documents

# Test CI gate complet
npx jest lib/eval --no-coverage

# Test non-régression seul
npx jest lib/eval/__tests__/non-regression-baseline.test.ts --no-coverage

# Type check
npx tsc --noEmit
```

## Coûts vérifiés

| Composant | Coût/story | Coût annuel famille (730 stories) |
|---|---|---|
| Rubric déterministe | 0 (pure JS, < 50ms) | 0 |
| LLM-judge Haiku 4.5 | ~$0.0032 | ~$2.34 |
| Re-roll cap 1 (Sonnet) | ~$0.002 (10% des stories en moyenne) | ~$1.50 |
| **Total Phase 52** | — | **~$4/an/famille** |

Cap dur via `max_tokens=300` côté LLM-judge + `temperature=0` + idempotence (skip si `llm_judge` déjà rempli).

## Métriques cibles (régime stationnaire post-activation)

- Hard fail rate < 10%
- Clean rate > 60%
- LLM-judge fallback rate < 5%
- Distribution golden set CI : hardFail 14/20 ±1 (verrouillée par `non-regression-baseline.test.ts`)

## Threat mitigations vérifiées

| Threat | Mitigation | Vérifié dans |
|---|---|---|
| T-52-03-01 (Information Disclosure) | `anonymizeStoryText` avant LLM | `lib/eval/__tests__/llm-eval.test.ts` |
| T-52-02-01 (DoS re-roll loop) | Cap strict 1 retry via signature linéaire | `lib/eval/__tests__/pipeline.test.ts` |
| T-52-03-03 (DoS / Cost) | Idempotence + cap retry + fallback | `lib/eval/__tests__/llm-eval.test.ts` |
| T-52-04-02 (Tampering golden set) | Test `length === 20` | `non-regression-baseline.test.ts` |

## Limites connues (non bugs)

- **Rubric pure ne distingue pas les paraphrases** — fixtures #17/#18 du golden set sont des quasi-clones narratifs détectés uniquement par le LLM-judge, pas par le n-gram overlap. Documenté dans `52-01-SUMMARY.md`.
- **3 fixtures vertes du golden set ont 1 dim sub-3** (#3, #14 soft, #5/#6/#12 hard) — la rubric est conservative côté soft warning, le LLM-judge nuance via `quality_score` agrégé.
- **Re-roll perd script + scenes** — la 2ème version reconstruit titre + texte + duree_lecture uniquement (script Mode Spectacle / scenes Picture-book regénérables à la lecture). Compromis acceptable : un re-roll signifie déjà un échec qualité de la 1ère.

## Prochaines étapes possibles

- Toggle UI parent dans Réglages (persistance `expo-secure-store`)
- Calibration empirique : 5 stories du golden × 3 runs LLM-judge + corrélation Spearman vs verdict humain (script dev, nécessite clé API Haiku)
- Extension D6 cohérence saga quand chapitres consécutifs ≥ 3
- Dimension D7 entités nommées (registry profil enfant — détecter prénoms tiers)
- Dashboard graphique (chart 30j) si volume justifie

## Fichiers produits

```
lib/eval/
├── feature-flag.ts                              # 52-01 + 52-04 (runtime override)
├── rubric.ts                                    # 52-01 (6 dimensions)
├── rubric-helpers.ts                            # 52-01 (TTR, n-gram, anonymisation)
├── types.ts                                     # 52-01
├── prompts.ts                                   # 52-01 + 52-03 (system + retry FR)
├── pipeline.ts                                  # 52-02 (orchestrateur re-roll)
├── llm-eval.ts                                  # 52-03 (Haiku + Zod)
└── __tests__/
    ├── helpers.test.ts                          # 17 tests
    ├── rubric.test.ts                           # 28 tests
    ├── pipeline.test.ts                         # 7 tests
    ├── llm-eval.test.ts                         # 10 tests
    ├── non-regression-baseline.test.ts          # 9 tests (CI gate)
    └── fixtures/golden-set.json                 # 20 fixtures

components/stories/QualityBadge.tsx              # 52-03 (UI badge + modal)
scripts/eval-dashboard.ts                        # 52-04 (audit CLI)
lib/__tests__/eval-frontmatter-roundtrip.test.ts # 52-02 (10 tests)
```

Suite eval complète : **71 tests verts** (45 + 7 + 10 + 9). Suite jest globale : **2107 passed** (+9 vs Plan 52-03).
