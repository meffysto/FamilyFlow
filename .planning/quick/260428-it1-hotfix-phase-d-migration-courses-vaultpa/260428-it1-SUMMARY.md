# Hotfix Phase D — Migration courses bloquée

## Bug

`useVaultCourses` lance un `useEffect` au mount qui lit `vaultRef.current`. Mais `vaultRef.current` est assigné plus tard, dans un async effect de `useVault.ts`. Au premier render, le hook voit `null`, return early, et comme les deps sont `[]`, l'effet ne re-fire jamais → migration jamais exécutée → `Liste de courses.md` legacy intact.

## Fix

Ajouter `vaultPath: string | null` (state, pas ref) en 2e argument du hook. Inclure `vaultPath` dans les deps du mount useEffect : quand le vault est ready (vaultPath devient non-null), l'effet re-fire et trouve `vaultRef.current` correctement assigné.

## Modifs

- `hooks/useVaultCourses.ts` : signature `(vaultRef, vaultPath)`, dep `[vaultPath]` sur le mount effect.
- `hooks/useVault.ts:555` : passer `vaultPath` (state existant) en 2e arg.
- `hooks/__tests__/useVaultCourses.test.ts` : 9 invocations adaptées (`useVaultCourses(vaultRef, 'test://mock')`).

## Validation

- `npx tsc --noEmit` propre.
- Logique de migration intacte (pas touché à `migrateIfNeeded`).
- Au prochain reload du dev-client, la migration s'exécute : `Liste de courses.md` → `Listes/principale.md` + `.bak`.
