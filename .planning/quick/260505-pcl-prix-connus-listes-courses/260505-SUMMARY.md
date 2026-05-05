---
phase: quick-260505-pcl
title: FAM-16 Prix connus pour les listes de courses
status: complete
linear: FAM-16
completedAt: 2026-05-03
---

# Phase quick-260505-pcl : Prix connus pour les listes de courses — Summary

Override manuel des prix d'articles dans les listes de courses, via un pricebook persistant `04 - Budget/Prix connus.md`. Le pricebook gagne sur l'inférence statistique des BudgetEntries — déclaration explicite utilisateur > inférence.

## Commits

| # | Hash | Type | Message |
| - | ---- | ---- | ------- |
| 1 | `ac04f371` | feat | parser pour le pricebook (parsePriceBook + serializePriceBook) |
| 2 | `05855230` | feat | lookup priorité au pricebook dans getLastPriceFor |
| 3 | `be333c65` | feat | hook usePriceBook (load/setPrice/removePrice) |
| 4 | `3b20ddc3` | feat | UI prix manuel tappable + slot vide |

## Files

### Created
- `hooks/useVaultPriceBook.ts` — hook dédié, pattern enqueueWrite identique à useVaultCourses

### Modified
- `lib/parser.ts` — `parsePriceBook` / `serializePriceBook` + `PriceBookEntry` / `PriceBookState`
- `lib/courses-prices.ts` — `confidence: 'manual'`, `PriceBookMap`, `priceBookKey`, `getLastPriceFor` accepte `priceBook`, `computeRemainingEstimate` accepte `priceBook`
- `lib/__tests__/parser.test.ts` — 6 tests unitaires (`describe('parsePriceBook / serializePriceBook')`)
- `hooks/useVault.ts` — import + intégration du hook + exposition dans `VaultState`
- `app/(tabs)/meals.tsx` — branchement `priceBook` dans `coursePriceByItemId` / `courseRemainingEstimate`, handlers `handleCoursePriceTap` / `handleCoursePriceLongPress`, bloc d'affichage devient `TouchableOpacity` (slot vide "+ €" + display différencié manual)
- `components/ShoppingModeView.tsx` — `PriceInfo['confidence']` accepte `'manual'`
- `locales/fr/common.json` — 9 clés sous `meals.shopping`
- `locales/en/common.json` — 9 clés sous `meals.shopping`

## Tests

```
npx jest --no-coverage lib/__tests__/parser.test.ts
Test Suites: 1 passed, 1 total
Tests:       59 passed, 59 total
```

Les 6 nouveaux tests pricebook couvrent :
- parse vide (frontmatter seul)
- parse virgule décimale FR
- tolérance espace avant `:` et `€` en suffixe
- roundtrip serialize → parse
- lignes invalides ignorées sans crash
- canonical key matche `parseCanonical` (Pain, "2 pains", "Pain bio")

```
npx tsc --noEmit
TypeScript compilation completed
```

Aucune nouvelle erreur. Erreurs pré-existantes documentées (MemoryEditor.tsx, cooklang.ts, useVault.ts) non touchées.

## Décisions techniques

- **Clé pricebook** : tokens canoniques triés joints (`canonical.slice().sort().join(' ')`) — stable même si l'utilisateur saisit "Lait demi-écrémé" puis "demi-écrémé Lait".
- **Lazy init** : le fichier `Prix connus.md` est créé au premier `setPrice` (pas au mount) pour ne pas polluer les vaults sans usage de la fonctionnalité.
- **Replace vs append** : `setPrice` remplace si la clé canonique existe déjà (idempotent), sinon append.
- **Frontmatter `updatedAt`** : `YYYY-MM-DD` (heure locale), réécrit à chaque write.
- **Hors VaultCacheState** : le pricebook est chargé frais à chaque boot. Pas besoin de bumper `CACHE_VERSION` (per CLAUDE.md exclusions).
- **Format prix vault** : virgule FR (humain-friendly Obsidian) ; parse tolère virgule OU point.
- **Display manual** : `colors.primary` + `fontWeight: '700'`, **pas** de préfixe `≈`/`~` — distingue visuellement la déclaration utilisateur de l'inférence statistique.

## Déviations du plan

Aucune. Implémentation conforme au plan + clarifications fournies dans le prompt d'exécution.

Note mineure : un fichier précédemment modifié (`lib/pdf/html-template.ts`) a été committé par une autre tâche entre-temps (commit `806445af`) — pas en lien avec FAM-16, simplement constaté.

## Risques connus / suivis

- **Android** : `Alert.prompt` est iOS-only. Fallback : `Alert.alert("Prix de X", "Disponible bientôt sur Android")`. Acceptable v1 (TestFlight iOS-first).
- **Saisie invalide** : "12,5,5" → `parseFloat` → `12.5` (acceptable). NaN/négatif/>10000 → `Alert("Prix invalide")` sans crash.
- **Pricebook entries** : pas de pagination/recherche pour l'instant. À surveiller si la liste explose au-delà de 200 articles (la Map reste O(1) mais le serialize grossit linéairement).

## Self-Check: PASSED

- Created file exists: `hooks/useVaultPriceBook.ts` ✓
- Commits exist:
  - `ac04f371` ✓
  - `05855230` ✓
  - `be333c65` ✓
  - `3b20ddc3` ✓
- `npx tsc --noEmit` : clean ✓
- `npx jest --no-coverage lib/__tests__/parser.test.ts` : 59/59 ✓
