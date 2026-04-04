---
phase: quick
plan: anniversaires
subsystem: hooks
tags: [refactor, extraction, anniversaires, useVault]
key-files:
  created:
    - hooks/useVaultAnniversaires.ts
  modified:
    - hooks/useVault.ts
decisions:
  - Conserver ANNIVERSAIRES_FILE et parseAnniversaries dans les imports parser de useVault.ts pour le chargement inline dans loadVaultData (section [13])
  - Exposer setAnniversaries depuis le sous-hook pour permettre à useVaultInternal de mettre à jour l'état lors du chargement
  - Ajouter resetAnniversaires dans les dépendances de useCallback setVaultPath pour la cohérence
metrics:
  completed: 2026-04-05
---

# Extraction du domaine Anniversaires — useVaultAnniversaires.ts

Extraction du domaine Anniversaires hors du monolithe `useVaultInternal()` vers un hook dédié `useVaultAnniversaires(vaultRef)`, suivant le pattern établi par `useVaultBudget.ts`.

## Ce qui a été fait

### Fichier créé : hooks/useVaultAnniversaires.ts

- Utilitaires locaux `isFileNotFound` / `warnUnexpected` (même pattern que useVaultBudget)
- Constante `ANNIVERSAIRES_FILE` et fonctions parse/serialize importées depuis `lib/parser`
- Interface `UseVaultAnniversairesResult` exportée
- Hook `useVaultAnniversaires(vaultRef)` avec :
  - État : `anniversaries` (useState)
  - Actions : `addAnniversary`, `updateAnniversary`, `removeAnniversary`, `importAnniversaries`
  - Utilitaire interne : `reloadAnniversaries` (non exposé)
  - Reset : `resetAnniversaires`
  - Setter brut : `setAnniversaries` (pour chargement inline depuis useVaultInternal)

### Modifications : hooks/useVault.ts

- Import de `useVaultAnniversaires` ajouté
- Appel du hook après `vaultRef` avec destructuring complet
- Suppression du `useState<Anniversary[]>` dupliqué
- Suppression des 5 `useCallback` CRUD (reloadAnniversaries, addAnniversary, updateAnniversary, removeAnniversary, importAnniversaries)
- `resetAnniversaires()` appelé dans `setVaultPath` (reset au changement de vault)
- `resetAnniversaires` ajouté dans les dépendances de `setVaultPath`
- Interface `VaultState` inchangée — aucun consommateur impacté

## Décisions

**Conserver ANNIVERSAIRES_FILE/parseAnniversaries dans useVault.ts** : Le chargement des anniversaires reste inline dans `loadVaultData` (section [13] du Promise.all). Ces imports parser sont gardés uniquement pour cette section. Les callbacks CRUD délèguent au sous-hook.

**Exposer setAnniversaries** : Contrairement à useVaultBudget qui expose `loadBudgetData`, le chargement des anniversaires est inline dans le Promise.all principal. `setAnniversaries` est exposé pour que `useVaultInternal` puisse appliquer le résultat du chargement.

## Résultat tsc

Aucune nouvelle erreur. Les 30 erreurs restantes sont toutes pré-existantes (remotion, TabletSidebar, docs/).

## Commits

- `61578f0` feat(refactor): extraire domaine Anniversaires dans useVaultAnniversaires.ts
- `eed77b1` refactor(useVault): intégrer useVaultAnniversaires dans useVaultInternal

## Self-Check: PASSED

- hooks/useVaultAnniversaires.ts : créé (119 lignes)
- hooks/useVault.ts : modifié (-64 lignes, +14 lignes)
- Commits 61578f0 et eed77b1 vérifiés dans git log
