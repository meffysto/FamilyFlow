# Deferred items — Phase 53 Lightning Family Wallet

Items hors-scope découverts pendant l'exécution.

## Plan 02 (executor)

### Pré-existant — suites Jest cassées non liées à Lightning

5 suites Jest échouent en pré-existant (vérifié en stash de `hooks/useVault.ts` :
les mêmes suites échouent SANS la modification Lightning). Failures liées à des
mocks `lucide-react-native` / `react-native-svg` / `async-storage` qui ne sont
pas configurés au setup Jest projet.

Out of scope Plan 02 (les 12 suites `lib/lightning/__tests__/*` passent à 100% —
127/127 tests verts).

- `lib/__tests__/pdf-html-template.test.ts` — pdf html template mocks
- `hooks/__tests__/useVaultCourses.test.ts` — courses hook test setup
- `lib/__tests__/codex-content.test.ts` — codex content mocks
- `lib/__tests__/auberge-auto-tick.test.ts` — 3/7 fail (mocks)
- `lib/__tests__/insights.test.ts` — lucide-react-native + react-native-svg

À traiter dans un Quick ticket dédié `quick/260518-fix-jest-pre-existing-mocks/`
si besoin d'un suite verte complète. Ne bloque PAS Phase 53 (chaque sous-domaine
testé en isolation par sa propre suite).
