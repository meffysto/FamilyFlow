# Deferred Items — Phase 54

## Suites Jest pré-existantes en échec (hors périmètre Plan 54-03)

Découvertes lors de l'exécution de 54-03 (Task 2, `npx jest --no-coverage`). Vérifiées
comme PRÉ-EXISTANTES : elles échouent à l'identique sans la modification `app/_layout.tsx`
(testé par stash du fichier). Aucune ne touche `contexts/`, `lib/entitlements/`, ni
`app/_layout.tsx`. Domaines sans rapport avec la monétisation.

| Suite | Domaine |
|-------|---------|
| `lib/lightning/__tests__/process-task-completion.test.ts` | Lightning (Phase 53) |
| `lib/lightning/__tests__/trigger-mode.test.ts` | Lightning (Phase 53) |
| `lib/__tests__/pdf-html-template.test.ts` | Export PDF |
| `lib/__tests__/codex-content.test.ts` | Codex |
| `hooks/__tests__/useVaultCourses.test.ts` | Courses |
| `lib/__tests__/auberge-auto-tick.test.ts` | Auberge |
| `lib/__tests__/insights.test.ts` | Insights |

Total : 7 suites / 164 tests. À traiter dans une passe de maintenance dédiée
(probablement dérive de fixtures/constantes hors monétisation).

La suite `lib/entitlements/__tests__/` (26 tests, Plan 54-02) reste VERTE.
