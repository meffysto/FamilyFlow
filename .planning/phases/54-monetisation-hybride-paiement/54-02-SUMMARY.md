---
phase: 54-monetisation-hybride-paiement
plan: 02
subsystem: entitlements
tags: [entitlements, quota, monetisation, logique-pure, jest]
requires:
  - "lib/parser.ts (parseFrontmatter)"
  - "date-fns 4.1.0 (format)"
provides:
  - "lib/entitlements/ (types, engine pur, parser vault, barrel)"
  - "canGenerateStory/decrementQuota/shouldResetMonth/currentLocalMonth/detectGrandfatherEligibility/quotaExceededMessage"
  - "parseQuota/serializeQuota/QUOTA_FILE/DEFAULT_QUOTA"
  - "EntitlementStatus/QuotaData/EntitlementState"
affects:
  - "contexts/EntitlementContext.tsx (Wave 2, Plan 54-03 — consommateur du barrel)"
tech-stack:
  added: []
  patterns:
    - "Logique pure testable Jest (analogue lib/elevenlabs-quota.ts)"
    - "Frontmatter ligne par ligne (analogue serializeRDV), pas de sérialisation gray-matter"
    - "Reset mensuel en heure locale (date-fns format yyyy-MM), jamais UTC"
key-files:
  created:
    - "lib/entitlements/types.ts"
    - "lib/entitlements/entitlement-engine.ts"
    - "lib/entitlements/quota-parser.ts"
    - "lib/entitlements/index.ts"
    - "lib/entitlements/__tests__/entitlement-engine.test.ts"
    - "lib/entitlements/__tests__/quota-parser.test.ts"
  modified: []
decisions:
  - "Reset mensuel en heure LOCALE via date-fns format yyyy-MM (Piège 7) — jamais de conversion UTC"
  - "Priorité d'épuisement : crédits Pack AVANT slots gratuits dans decrementQuota (D-07)"
  - "LIFETIME ne décompte jamais (decrementQuota retourne le quota inchangé — D-06)"
  - "FREE_STORIES_PER_MONTH = 3 constante exportée (cap dur SC-4)"
metrics:
  duration: "~10min"
  completed: "2026-06-24"
  tasks: 2
  files: 6
---

# Phase 54 Plan 02 : Couche logique pure des entitlements — Summary

Livré la couche LOGIQUE PURE des entitlements : types partagés, moteur de quota testable, parser du fichier vault quota, et barrel. Zéro dépendance React, zéro RevenueCat, zéro I/O — uniquement des fonctions pures + parse/serialize de chaînes. La règle d'or IA (SC-7) est encodée et verrouillée par les tests : aucun chemin n'autorise une génération sans slot/crédit/lifetime.

## Ce qui a été construit

### Task 1 — types + moteur pur + tests (commit `a39970a2`)
- `lib/entitlements/types.ts` : `EntitlementStatus` (`'FREE' | 'LIFETIME'`), `QuotaData`, `EntitlementState`. Fichier de types purs, zéro import runtime.
- `lib/entitlements/entitlement-engine.ts` : 6 fonctions exportées + constante `FREE_STORIES_PER_MONTH = 3`.
  - `currentLocalMonth()` → mois local "YYYY-MM" via `date-fns format` (jamais UTC — Piège 7).
  - `shouldResetMonth(storedMonth)` → reset si mois stocké ≠ mois courant.
  - `canGenerateStory(quota, hasLifetime)` → règle d'or : LIFETIME toujours true ; free tier true tant qu'il reste un slot gratuit ce mois (après reset éventuel) OU un crédit Pack.
  - `decrementQuota(quota, hasLifetime)` → immutable, applique le reset mensuel puis épuise les crédits Pack EN PRIORITÉ, sinon incrémente le compteur mensuel ; LIFETIME inchangé.
  - `detectGrandfatherEligibility(vaultState)` → true ssi au moins un domaine (tasks/meals/profiles/memories) a des données.
  - `quotaExceededMessage()` → message FR invitant au Pack Histoires / lifetime.
- `__tests__/entitlement-engine.test.ts` : **18 tests** (cap 3/mois, reset, priorité crédits, no-decrement LIFETIME, grandfather true/false, immutabilité, mois local).

### Task 2 — parser vault + barrel + tests (commit `fb1b0852`)
- `lib/entitlements/quota-parser.ts` : `parseQuota`/`serializeQuota` + `QUOTA_FILE` (`'09 - Entitlements/quota.md'`) + `DEFAULT_QUOTA`.
  - Frontmatter construit ligne par ligne (analogue `serializeRDV`), round-trip loss-less.
  - Coercions défensives : `story_credits` string `"30"` → number 30 ; `grandfather` `"true"`/`true` → boolean (T-54-05).
  - Fichier vide/absent → `DEFAULT_QUOTA`.
- `lib/entitlements/index.ts` : barrel `export *` des 3 modules.
- `__tests__/quota-parser.test.ts` : **8 tests** (round-trip sur 2 objets distincts, fichier vide, coercions string→number et bool).

## Vérification

- `npx jest --no-coverage --testPathPattern="entitlement"` : **2 suites PASS, 26 tests**.
- `npx tsc --noEmit` : aucune nouvelle erreur dans `lib/entitlements/` (erreurs pré-existantes ignorées : MemoryEditor.tsx, cooklang.ts, useVault.ts).
- Aucun usage de `toISOString()` pour le calcul du mois (vérifié : 0).
- Aucune sérialisation gray-matter dans le parser (vérifié : 0).
- Barrel exporte types + engine + parser (3 `export *`).

## Critères de succès (SC)

- **SC-1** (infra entitlements pure) : `lib/entitlements/` contient types, engine, parser, barrel. ✅
- **SC-4** (cap 3/mois) : `FREE_STORIES_PER_MONTH = 3` encodé et testé. ✅
- **SC-7** (règle d'or IA auto-financée) : `canGenerateStory`/`decrementQuota` testés exhaustivement, aucun chemin ne retourne true sans slot/crédit/lifetime. ✅

## Déviations par rapport au plan

Aucune déviation fonctionnelle. Deux ajustements cosmétiques de commentaires : reformulation des mentions littérales `toISOString()` et `matter.stringify` (présentes uniquement dans des docstrings d'avertissement) pour satisfaire sans ambiguïté les `grep` des critères d'acceptation. Aucun impact sur le code exécuté.

## Threat surface

Aucune nouvelle surface de menace au-delà du `<threat_model>` du plan. Le parser couvre T-54-05 (coercions défensives, fallback). T-54-04 (édition manuelle) reste accepté par design (app familiale solo).

## Known Stubs

Aucun stub. La couche est complète et autonome ; le câblage UI/contexte (`EntitlementContext.tsx`) est explicitement le périmètre du Plan 54-03 (Wave 2).

## Self-Check: PASSED

- 6/6 fichiers créés présents sur disque.
- 2/2 commits (`a39970a2`, `fb1b0852`) présents dans l'historique git.
