---
id: 260512-ezj
description: "FAM-24 — Fix saga voyageur_argent stalker + reset versionné"
status: in-progress
date: 2026-05-12
linear: FAM-24
---

# FAM-24 — Le vieux stalker

## Contexte

Le visiteur "le vieux" (saga `voyageur_argent` 🧙) revient en boucle pour le user. Les autres sagas ne sont jamais déclenchées.

## Cause racine

Deux sources de vérité divergentes pour `completedSagas` :

- **`app/(tabs)/tree.tsx:755`** lit via `loadCompletedSagas()` (SecureStore) — cohérent avec ce qui est écrit lors de la complétion d'un chapitre final (`saveCompletedSagas`).
- **`components/dashboard/DashboardGarden.tsx:198`** lit `activeProfile?.completedSagas ?? []` — un champ Profile **jamais écrit** par `completeSagaChapter` dans `hooks/useVault.ts`.
- **`apps/desktop/src/pages/Tree.tsx:2501`** lit également `activeProfile.completedSagas ?? []` et ne persiste rien à la complétion.

Résultat : `DashboardGarden` (et le desktop) voient toujours `completedSagas = []` → `getNextSagaForProfile` retourne toujours la même saga déterministe pour le profil (souvent `voyageur_argent`). Pire encore, `DashboardGarden:275` appelle `saveSagaProgress(newProgress)` ce qui peut **écraser la saga choisie par tree.tsx**.

Le précédent fix (commit b28525ea) a câblé la rotation seulement dans le mobile `tree.tsx` ; le dashboard et le desktop sont passés à la trappe.

## Plan

### Task 1 — Unifier la source `completedSagas` sur SecureStore (mobile)

**Fichier :** `components/dashboard/DashboardGarden.tsx`

- Charger `completedSagas` via `loadCompletedSagas(profileId)` (SecureStore) au lieu de `activeProfile?.completedSagas`.
- Utiliser un state local + useEffect pour le load.
- Garder la dépendance sur `profileId` / `today`.

### Task 2 — Ajouter localStorage `completedSagas` desktop + persister

**Fichier :** `apps/desktop/src/pages/Tree.tsx`

- Ajouter `loadCompletedSagasLocal(profileId)` et `saveCompletedSagasLocal(profileId, ids)` (localStorage, clé `saga_completed_${profileId}`).
- Charger via ces helpers dans le composant `SagasPanel` au lieu de la prop.
- Persister l'ID terminé à la fin du dernier chapitre (autour de la ligne `clearSagaProgressLocal`).
- Supprimer la prop `completedSagas` puisque la source est désormais locale.

### Task 3 — Reset versionné des sagas (one-time migration)

**Fichier :** `lib/mascot/sagas-storage.ts`

- Ajouter une constante `SAGA_RESET_VERSION = 'v2-fam24'`.
- Ajouter une fonction `maybeResetSagasForVersion(profileIds: string[]): Promise<boolean>` :
  - Lit la clé SecureStore `saga_reset_version`.
  - Si identique à la constante → no-op (idempotent).
  - Sinon → appelle `resetAllSagaState(id)` pour chaque profile, puis écrit la nouvelle version.

### Task 4 — Câbler la migration au boot (mobile + desktop)

**Fichiers :** `app/(tabs)/tree.tsx`, `apps/desktop/src/pages/Tree.tsx`

- Mobile : useEffect qui appelle `maybeResetSagasForVersion(profiles.map(p => p.id))` une fois quand `profiles.length > 0`.
- Desktop : équivalent dans le SagasPanel ou en haut de la page (avec localStorage côté desktop — pas SecureStore).

Pour le desktop, on duplique la logique avec localStorage clé `saga_reset_version` car SecureStore n'existe pas.

## must_haves

- `DashboardGarden.tsx` ne lit plus `activeProfile.completedSagas` — au moins une référence à `loadCompletedSagas` dans le fichier.
- Tests unitaires existants (`sagas-engine.test.ts`) passent toujours.
- `npx tsc --noEmit` propre (hors erreurs préexistantes documentées dans CLAUDE.md).
- `SAGA_RESET_VERSION` est lu / écrit via une clé SecureStore stable.

## Hors scope

- Migrer `profile.completedSagas` au vault (envisagé puis écarté : SecureStore est déjà la source canonique pour la persistance saga sur mobile).
- Refactor du `SagasPanel` desktop pour utiliser le même flux que mobile.
- Ré-équilibrer `simpleHash` ou la rotation déterministe.
