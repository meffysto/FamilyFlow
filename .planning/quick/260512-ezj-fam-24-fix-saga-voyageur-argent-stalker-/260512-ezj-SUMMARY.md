---
id: 260512-ezj
status: complete
date: 2026-05-12
linear: FAM-24
---

# FAM-24 — Le vieux stalker — SUMMARY

## Cause racine

`completedSagas` avait deux sources de vérité :
- `app/(tabs)/tree.tsx` lit/écrit via `loadCompletedSagas/saveCompletedSagas` (SecureStore) — fonctionnel.
- `components/dashboard/DashboardGarden.tsx` et `apps/desktop/src/pages/Tree.tsx` lisaient `activeProfile.completedSagas` — un champ vault jamais écrit par `completeSagaChapter`.

Conséquence : `getNextSagaForProfile(profileId, [])` retournait toujours la même saga déterministe (souvent `voyageur_argent` 🧙 = "le vieux") + `DashboardGarden` écrasait la saga choisie par tree.tsx via `saveSagaProgress`.

## Changements

1. **`lib/mascot/sagas-storage.ts`** — Ajout de `maybeResetSagasForVersion(profileIds)` + constante `SAGA_RESET_VERSION = 'v2-fam24'`. Idempotent, basé sur clé SecureStore `saga_reset_version`.

2. **`components/dashboard/DashboardGarden.tsx`** — Remplace `activeProfile?.completedSagas ?? []` par un state chargé via `loadCompletedSagas(profileId)` (SecureStore). Source unique côté mobile.

3. **`app/(tabs)/tree.tsx`** — Nouvel useEffect qui appelle `maybeResetSagasForVersion(profiles.map(p => p.id))` au boot, avant `initSaga`.

4. **`apps/desktop/src/pages/Tree.tsx`** — Ajout helpers localStorage `loadCompletedSagasLocal/saveCompletedSagasLocal` (clé `saga_completed_${profileId}`) + reset versionné desktop. Le `SagasPanel` :
   - Lit `completedSagas` depuis localStorage (au lieu de la prop `activeProfile.completedSagas`).
   - Persiste l'ID complété à la fin du dernier chapitre.
   - Plus de prop `completedSagas` (call site simplifié).

## Reset versionné

Bumper `SAGA_RESET_VERSION` dans `lib/mascot/sagas-storage.ts` (et `SAGA_RESET_VERSION_DESKTOP` dans le desktop Tree.tsx) forcera un wipe complet de l'état saga de tous les profils au prochain boot. Utile pour les futures mises à jour de contenu saga.

À ce déploiement (v2-fam24), tous les utilisateurs verront leurs sagas réinitialisées une seule fois — fini le coincement sur voyageur_argent.

## Validation

- `npx tsc --noEmit` : clean.
- `npx jest lib/__tests__/sagas-engine.test.ts` : 19/19 ✓ (dont les tests de rotation).
- Pas de modification de `sagas-engine.ts` ni de la logique de tirage — comportement déterministe préservé.

## Hors scope (non fait)

- Migration de `profile.completedSagas` au vault (rejeté : SecureStore reste la source canonique).
- Refactor approfondi du `SagasPanel` desktop.
