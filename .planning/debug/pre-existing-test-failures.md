---
status: resolved
trigger: "Investigate and fix pre-existing test failures in 4 test suites. 145 tests échouent dans world-grid, lovenotes-selectors, companion-engine, codex-content"
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:01:00Z
---

## Current Focus

hypothesis: RESOLVED — toutes les causes racines trouvées et corrigées
test: npx jest --no-coverage → 1609 passed, 0 failed
expecting: n/a
next_action: archive

## Symptoms

expected: Tous les tests passent (npx jest --no-coverage)
actual: 145 tests échouent dans 4 suites (codex-content ~140, world-grid 1, companion-engine 1, lovenotes-selectors 3)
errors: |
  1. codex-content: clés i18n manquantes FR+EN + dropOnly liste incorrecte
  2. world-grid: getUnlockedCropCells retourne 0 pour stade 'graine'
  3. companion-engine: detectProactiveEvent ne retourne pas 'celebration' pour streak multiple de 7 hors matin
  4. lovenotes-selectors: archivedForProfile n'inclut pas notes reçues+lues / envoyées+lues, tri readAt desc incorrect
reproduction: npx jest --no-coverage --testPathPattern="world-grid|lovenotes-selectors|companion-engine|codex-content"
started: Pre-existing — jamais passé

## Eliminated

- hypothesis: "codex nameKey format est correct (codex:kind.id.name)"
  evidence: "Le test utilise replace(/^codex\./, '') qui attend un point, pas un deux-points. La clé codex:crop.carrot.name ne match pas → hasNestedKey échoue."
  timestamp: 2026-04-18

- hypothesis: "archivedForProfile doit filtrer status === 'archived' uniquement"
  evidence: "Les tests passent des notes status:'read' et attendent qu'elles soient dans l'archive. Le design: read = déjà vue = archivée."
  timestamp: 2026-04-18

- hypothesis: "PLOTS_BY_TREE_STAGE.graine === 3 (unifié avec pousse)"
  evidence: "Le test attend 0 pour graine. Commentaire explique une ancienne décision unifiée, mais le test dit différent."
  timestamp: 2026-04-18

- hypothesis: "celebration est désactivée définitivement (Phase 24)"
  evidence: "Le test attend 'celebration' pour streak multiple de 7 + isFirstVisitToday=true. Le commentaire dit 'réactiver dans un futur milestone'."
  timestamp: 2026-04-18

## Evidence

- timestamp: 2026-04-18
  checked: lib/mascot/world-grid.ts + lib/mascot/types.ts PLOTS_BY_TREE_STAGE
  found: graine = 3 mais test attend 0
  implication: PLOTS_BY_TREE_STAGE.graine doit être 0

- timestamp: 2026-04-18
  checked: lib/mascot/companion-engine.ts detectProactiveEvent()
  found: celebration commenté ligne 582 avec TODO "réactiver futur milestone"
  implication: Décommenter la condition streak % 7 === 0

- timestamp: 2026-04-18
  checked: lib/lovenotes/selectors.ts archivedForProfile()
  found: filtre status === 'archived' seulement, tests passent status:'read'
  implication: Ajouter status === 'read' dans le filtre archived

- timestamp: 2026-04-18
  checked: lib/codex/cultures.ts + locales/fr/codex.json
  found: nameKey format 'codex:crop.id.name' vs test expects 'codex.crop.id.name' (replace /^codex\./)
  implication: Changer ':' en '.' dans tous les fichiers codex entries

- timestamp: 2026-04-18
  checked: CROP_CATALOG pour dropOnly — 4 non-expedition + 5 expedition exclusive
  found: cropEntries inclut tous, test attend exactement 4 (orchidee, rose_doree, truffe, fruit_dragon)
  implication: Filtrer expeditionExclusive dans cultures.ts

- timestamp: 2026-04-18
  checked: INHABITANTS + CRAFT_RECIPES pour missing i18n
  found: 9 animaux expedition-exclusive et 4 craft expedition-exclusive sans entrées i18n
  implication: Ajouter les entrées manquantes dans fr/codex.json et en/codex.json

## Resolution

root_cause: |
  4 causes indépendantes:
  1. world-grid: PLOTS_BY_TREE_STAGE.graine était 3 au lieu de 0
  2. companion-engine: celebration était commentée avec un TODO "réactiver futur milestone"
  3. lovenotes: archivedForProfile ne filtrait que status='archived', pas status='read'
  4. codex-content: (a) nameKey format 'codex:' vs 'codex.' attendu par le test; (b) crops expedition exclus pas filtrés; (c) 9 animaux + 4 crafts d'expédition sans clés i18n

fix: |
  1. lib/mascot/types.ts: PLOTS_BY_TREE_STAGE.graine: 3 → 0
  2. lib/mascot/companion-engine.ts: décommenter la ligne celebration streak % 7 === 0
  3. lib/lovenotes/selectors.ts: filtre archivedForProfile inclut status === 'read' || status === 'archived'
  4. lib/codex/cultures.ts: filter expeditionExclusive + 'codex:' → 'codex.'
     lib/codex/animals.ts + buildings.ts + craft.ts + tech.ts + companions.ts + sagas.ts + quests.ts + adventures.ts + seasonal.ts + loot.ts: 'codex:' → 'codex.'
     locales/fr/codex.json + locales/en/codex.json: 9 animaux + 4 crafts d'expédition ajoutés

verification: "npx jest --no-coverage → 1609 passed, 0 failed (61 suites)"
files_changed:
  - lib/mascot/types.ts
  - lib/mascot/companion-engine.ts
  - lib/lovenotes/selectors.ts
  - lib/codex/cultures.ts
  - lib/codex/animals.ts
  - lib/codex/buildings.ts
  - lib/codex/craft.ts
  - lib/codex/tech.ts
  - lib/codex/companions.ts
  - lib/codex/sagas.ts
  - lib/codex/quests.ts
  - lib/codex/adventures.ts
  - lib/codex/seasonal.ts
  - lib/codex/loot.ts
  - locales/fr/codex.json
  - locales/en/codex.json
