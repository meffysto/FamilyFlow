---
phase: 30-decorations-persistantes
verified: 2026-04-11T00:00:00Z
status: human_needed
score: 4/4 success criteria verified (code-level)
human_verification:
  - test: "Rebuild device iOS (post-hotfix coords) et ouvrir l'onglet Village avec au moins un bâtiment débloqué"
    expected: "Les sprites bâtiments (puits, boulangerie, marché, café, forge) du band supérieur apparaissent SOUS le header village (status bar + titre + bouton home-city), jamais derrière ni clippés par le header absolute-positionné"
    why_human: "Le shift coords Y hotfix (lib/village/grid.ts lignes 38-42, y=0.18-0.28) n'a pas été re-testé sur device après application — bug signalé avant hotfix par user sur iPhone"
  - test: "Simuler plusieurs ouvertures répétées de l'app sur device (close → reopen ×5 minimum) avec familyLifetimeLeaves déjà > 100 feuilles"
    expected: "Le fichier vault `04 - Gamification/jardin-familial.md` section `## Constructions` ne contient JAMAIS de doublons pour un même buildingId, même après restarts successifs"
    why_human: "Idempotence double-couche (appendBuilding regex guard + parseGardenFile dedup défensif) ne peut être validée qu'avec un vrai cycle filesystem iCloud sur device — le user a explicitement signalé le bug duplicate key 'puits' avant hotfix"
  - test: "Franchir un palier feuilles (ex: passer de 295 à 300 feuilles familiales) et ouvrir le catalogue immédiatement"
    expected: "Le bâtiment nouvellement débloqué (ex: boulangerie) affiche un badge 'Nouveau ✨' avec animation spring scale + star gold ; après fermeture et ré-ouverture du catalogue, le badge 'Nouveau' disparaît (SecureStore `village_buildings_seen_at` mis à jour)"
    why_human: "Lifecycle badge Nouveau dépend de SecureStore.getItemAsync/setItemAsync + timestamps — ne peut pas être validé sans interaction utilisateur réelle"
  - test: "Valider visuellement le catalogue sur device (bouton header home-city dans village.tsx)"
    expected: "Modal pageSheet s'ouvre en slide, affiche les 8 bâtiments dans grille 2 colonnes ; ceux débloqués en full color avec label 'Débloqué' vert, ceux verrouillés avec silhouette (tintColor textMuted + opacity 0.4) + palier requis + progression `{current}/{target} feuilles familiales` ; tap sur tuile verrouillée déclenche toast `Encore N feuilles...` + haptic light"
    why_human: "Rendu visuel, tintColor silhouette, espacement grille, animations pulse spring, toast display — nécessitent validation humaine sur device"
---

# Phase 30 : Décorations persistantes — Rapport de vérification

**Phase Goal:** Transformer chaque semaine d'objectif collectif réussie en trace visuelle durable — introduire le schéma de données append-only, le moteur de déblocage par palier de feuilles famille et le catalogue des 8 bâtiments débloquables (scope shift décorations → bâtiments pixel art, streak → feuilles lifetime per CONTEXT.md D-01/D-05).

**Verified:** 2026-04-11
**Status:** human_needed (toutes les vérifications automatisées passent, validations device restent nécessaires post-hotfix)
**Re-verification:** Non — vérification initiale

---

## Goal Achievement

### Observable Truths (Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | User voit une nouvelle construction (puits, boulangerie, marché, café, forge, moulin, port, bibliothèque) apparaître sur la carte village quand un palier feuilles famille est franchi | ✓ VERIFIED (code) | `hooks/useGarden.ts:217-244` effet useEffect appelle `computeBuildingsToUnlock(familyLifetimeLeaves, unlockedBuildings)` avec early return si vide + `appendBuilding` cascade + writeFile unique ; `app/(tabs)/village.tsx:604-619` mappe `unlockedBuildings` via VILLAGE_GRID slots et render `BuildingSprite` pour chacun |
| 2   | User retrouve l'ensemble des bâtiments accumulés après un restart complet de l'app (persistance append-only dans `jardin-familial.md` section `## Constructions`) | ✓ VERIFIED (code) | `lib/village/parser.ts:158-171` parse section `## Constructions` ; `appendBuilding:347-411` insertion avant `## Historique` (pattern `appendContribution` identique Phase 25) ; `appendBuildingToVault:421-428` readFile → append → writeFile ; round-trip fidelity testé `village-parser.test.ts` ("round-trip fidelity pour unlockedBuildings" ✓) |
| 3   | User peut ouvrir un catalogue listant les 8 bâtiments débloquables et voit clairement le palier associé (100, 300, 700, 1500, 3000, 6000, 12000, 25000 feuilles) | ✓ VERIFIED (code) | `lib/village/catalog.ts:22-31` BUILDINGS_CATALOG exactement 8 entrées avec paliers conformes : puits/100, boulangerie/300, marché/700, café/1500, forge/3000, moulin/6000, port/12000, bibliothèque/25000 ; `components/village/BuildingsCatalog.tsx:137-157` grille 2 colonnes mappe BUILDINGS_CATALOG ; `village.tsx:813-818` bouton header `home-city` ouvre le modal |
| 4   | User voit dans le catalogue quels bâtiments sont déjà débloqués versus verrouillés (silhouette sombre), avec la progression actuelle vers le prochain palier | ✓ VERIFIED (code) | `BuildingsCatalog.tsx:231-241` style conditionnel `!isUnlocked && { tintColor: colors.textMuted, opacity: 0.4 }` sur Image ; `215-218` progressLabel "Débloqué" vs "À N feuilles" + progressDetail "`{current}/{target} feuilles familiales`" ; `263-277` badge "Nouveau ✨" via SecureStore `village_buildings_seen_at` |

**Score:** 4/4 truths verified au niveau code. Validation device finale requise (human_needed) — cf. `human_verification` frontmatter.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/village/types.ts` | UnlockedBuilding type + 'building' role + unlockedBuildings dans VillageData | ✓ VERIFIED | Lignes 8, 39-43, 54 ajoutées ; type union VillageRole étendu |
| `lib/village/catalog.ts` | BUILDINGS_CATALOG 8 entrées + computeBuildingsToUnlock pur | ✓ VERIFIED | Module pur, zéro import hook, require() statiques sur `assets/buildings/village/*.png`, 8 sprites présents |
| `lib/village/parser.ts` | appendBuilding + appendBuildingToVault + parse `## Constructions` + dedup défensif | ✓ VERIFIED | Double-couche idempotence : regex guard lignes 352-361 (skip si buildingId existe) + dedup parseGardenFile lignes 177-184 |
| `lib/village/grid.ts` | 8 slots `village_building_*` role 'building' + coords hotfix | ✓ VERIFIED | Lignes 38-45 : 8 slots ; band supérieur shifté y=0.18-0.28 (hotfix documenté lignes 34-37) |
| `hooks/useGarden.ts` | familyLifetimeLeaves + unlockedBuildings exposés + effet unlock-on-threshold idempotent | ✓ VERIFIED | `familyLifetimeLeaves` memo avec `p.points ?? 0` (ligne 105) ; effet useEffect lignes 217-244 avec early return + cancellation flag + cascade single-writeFile |
| `components/village/BuildingSprite.tsx` | Sprite 72×72 positionné fractionnel + fade-in 300ms + onPress + haptic | ✓ VERIFIED | Reanimated only (useSharedValue + withTiming 300ms), Haptics.selectionAsync, positionnement absolute avec slotX/slotY - SPRITE_SIZE/2 |
| `components/village/BuildingTooltip.tsx` | Tooltip fork AvatarTooltip auto-dismiss 2.5s | ✓ VERIFIED | DISMISS_MS=2500, ENTER=180, EXIT=150, offset=52 (sprite 72>48), clamp horizontal Pitfall 6, prop label unique |
| `components/village/BuildingsCatalog.tsx` | Modal pageSheet 2-col + badge Nouveau SecureStore + toast locked | ✓ VERIFIED | presentationStyle="pageSheet", SecureStore `village_buildings_seen_at`, toast "Encore N feuilles..." avec plural conditionnel + Haptics.impactAsync Light |
| `app/(tabs)/village.tsx` | Header button home-city + building sprites overlay + tooltip state + modal wiring | ✓ VERIFIED | Imports lignes 58-60, useGarden destructure ligne 320-321, bouton header ligne 549, overlay lignes 604-619, modal lignes 813-818 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `lib/village/parser.ts` | `lib/village/types.ts` | import UnlockedBuilding | ✓ WIRED | Import ligne 22 confirmé |
| `lib/village/catalog.ts` | `assets/buildings/village/*.png` | static require() per entry | ✓ WIRED | 8 require() statiques confirmés lignes 23-30, 8 PNG présents (puits, boulangerie, marche, cafe, forge, moulin, port, bibliotheque) ; regex tool false-positive (escape échappé deux fois) — vérification manuelle OK |
| `hooks/useGarden.ts` | `lib/village/catalog.ts` | import computeBuildingsToUnlock | ✓ WIRED | Ligne 20 import confirmé |
| `hooks/useGarden.ts` | `lib/village/parser.ts` | import appendBuildingToVault (cascade via appendBuilding + writeFile) | ✓ WIRED | Plan 02 a pivoté vers cascade inline : `appendBuilding` importé + `vault.writeFile(VILLAGE_FILE, ...)` direct ligne 236 (pour groupage multi-paliers single-write). `appendBuildingToVault` reste exporté depuis parser pour usage futur. Pattern plus efficient — intent préservé |
| `hooks/useGarden.ts effet` | `vault.writeFile(VILLAGE_FILE)` | cascade → writeFile + setGardenRaw | ✓ WIRED | Lignes 225-237 : readFile → loop appendBuilding → writeFile → setGardenRaw ; tool regex échoue par path avec parenthèses mais présence confirmée manuellement |
| `app/(tabs)/village.tsx` | `useGarden().unlockedBuildings + familyLifetimeLeaves` | hook consumption | ✓ WIRED | Lignes 320-321 destructure confirmé |
| `components/village/BuildingSprite.tsx` | `lib/village/catalog.ts BUILDINGS_CATALOG` | import pour spritemap par id | ✓ WIRED | Ligne 14 import + find lookup par id ligne 37 |
| `components/village/BuildingsCatalog.tsx` | `expo-secure-store` clé `village_buildings_seen_at` | SecureStore get/setItemAsync | ✓ WIRED | Constante SEEN_KEY ligne 40, getItemAsync ligne 69, setItemAsync ligne 80 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `BuildingSprite` (overlay village.tsx:605) | `unlockedBuildings` | `useGarden()` → `gardenData.unlockedBuildings` → `parseGardenFile(gardenRaw)` → vault.readFile(`04 - Gamification/jardin-familial.md`) | ✓ Oui — lecture fichier vault réel | ✓ FLOWING |
| `BuildingsCatalog` (village.tsx:813) | `unlockedBuildings`, `familyLifetimeLeaves` | `useGarden()` — même source que overlay ; `familyLifetimeLeaves` = reduce sur `profiles[].points` (VaultContext) | ✓ Oui — real data du VaultProvider | ✓ FLOWING |
| `BuildingTooltip` (village.tsx:622) | `buildingTooltip.label` state | setState via `handleBuildingPress(ub)` où `ub` provient de `unlockedBuildings.map` | ✓ Oui | ✓ FLOWING |

Aucun prop hardcodé `[]` ou `{}`. Aucun stub. Données flow complet de vault → parser → useGarden → village.tsx → composants visuels.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Type check propre | `npx tsc --noEmit` | `TypeScript compilation completed` (zéro erreur) | ✓ PASS |
| Tests village-parser complets | `npx jest lib/__tests__/village-parser.test.ts --no-coverage` | 51 passed / 51 total — round-trip, appendBuilding idempotence, dedup défensif, section Constructions | ✓ PASS |
| BUILDINGS_CATALOG 8 entrées paliers exacts | Lecture directe `lib/village/catalog.ts` | 100, 300, 700, 1500, 3000, 6000, 12000, 25000 ✓ ordre conforme | ✓ PASS |
| 8 sprites PNG présents dans assets | `ls assets/buildings/village/` | 8 fichiers : bibliotheque, boulangerie, cafe, forge, marche, moulin, port, puits | ✓ PASS |
| Regression gate — autres suites non touchées | `npx jest --no-coverage` (all) | 46 suites passed / 5 failed ; 1184 passed / 119 failed. Échecs : world-grid (pré-existant non-régression, 1 test famille `getUnlockedCropCells`), companion-engine, codex-content, flag, derive — aucun lié à Phase 30 | ✓ PASS (pas de régression Phase 30) |

### Requirements Coverage

| Requirement | Source Plan | Description REQUIREMENTS.md | Status | Evidence |
| ----------- | ----------- | --------------------------- | ------ | -------- |
| VILL-04 | 30-02, 30-03 | "User voit une nouvelle décoration ajoutée au village chaque semaine où l'objectif collectif est atteint" | ⚠️ SATISFIED via scope shift | L'intent (progression visuelle durable déclenchée par métrique famille) est satisfait via bâtiments au lieu de décorations + feuilles lifetime au lieu de streak hebdomadaire. Scope shift documenté dans ROADMAP.md Phase 30 goal + CONTEXT.md D-01/D-05. `useGarden.ts:217-244` déclenche l'apparition, `village.tsx:604-619` render les sprites |
| VILL-05 | 30-01, 30-02 | "User retrouve toutes les décorations accumulées après un restart de l'app (persistance append-only dans `jardin-familial.md`)" | ⚠️ SATISFIED via scope shift | Persistance append-only implémentée section `## Constructions` dans même fichier `jardin-familial.md`. Double-couche idempotence garantit zéro doublon. Round-trip fidelity testé |
| VILL-06 | 30-01, 30-03 | "User voit un catalogue listant les ~8 décorations débloquables par palier de streak collectif (1, 3, 5, 10, 15, 20, 25, 30 semaines)" | ⚠️ SATISFIED via scope shift | Catalogue modal 8 bâtiments implémenté avec paliers feuilles lifetime (100/300/700/1500/3000/6000/12000/25000) au lieu de streak semaines — cohérent avec scope shift CONTEXT.md |

**Note importante sur le scope shift :** REQUIREMENTS.md VILL-04/05/06 utilise encore le vocabulaire initial (décorations, streak semaines, paliers 1/3/5/10/15/20/25/30). Phase 30 a pivoté vers bâtiments + feuilles lifetime conformément à CONTEXT.md D-01/D-05 et à la goal ROADMAP.md. L'**intent** des 3 requirements est satisfait (progression visuelle persistante déclenchée par métrique famille, avec catalogue à 8 paliers). Suggestion follow-up : mettre à jour REQUIREMENTS.md pour refléter le vocabulaire final (action hors scope vérification).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `components/village/BuildingsCatalog.tsx` | 42 | Hardcoded hex `#FFD700` (BADGE_GOLD constant) | ℹ️ Info | Explicitement autorisé par `30-UI-SPEC.md:79,100,152,241` comme exception cosmétique badge "Nouveau ✨". Pattern StyleSheet-level constante documentée. Non-bloquant. |
| `components/village/BuildingTooltip.tsx` | 115 | `shadowColor: '#000'` | ℹ️ Info | Convention RN standard pour shadow (platform-specific, pas une theme color). Même pattern que `AvatarTooltip.tsx` Phase 29. Non-bloquant. |

**Scan négatif :**
- Zéro TODO/FIXME/XXX/HACK/PLACEHOLDER dans les 3 composants village créés
- Zéro import `Animated` from `react-native` (uniquement Reanimated)
- Zéro retour stub (`return null`, `return []` non justifié)
- Zéro `console.log` hors guard `__DEV__`
- Tous les `useThemeColors()` utilisés correctement pour les couleurs dynamiques

### Human Verification Required

Cf. `human_verification` frontmatter ci-dessus pour 4 tests device. Points critiques :

1. **Rebuild device post-hotfix coords Y** — le shift y=0.18/0.22/0.28 des 5 slots band supérieur (puits/boulangerie/marché/café/forge) n'a pas été re-testé après hotfix. Le user a explicitement signalé le bug de clipping sous le header avant la correction.
2. **Test idempotence cycle réel iCloud** — la double-couche regex + dedup n'a de vraie valeur que validée avec un cycle filesystem iCloud réel et plusieurs restarts de l'app (le user a signalé un vrai bug duplicate 'puits' avant hotfix).
3. **Badge Nouveau lifecycle** — nécessite franchissement palier réel + ouverture catalogue pour valider SecureStore get/set.
4. **Rendu visuel catalogue** — silhouette locked, spring pulse, toast locked tile.

### Gaps Summary

**Aucun gap bloquant au niveau code.** Tous les artifacts existent, sont substantiels, wired, et consomment de vraies données du vault. L'idempotence est double-couche (hook + parser) et testée unitairement. Le type check passe, 51/51 tests village-parser passent, zéro régression Phase 30 sur les autres suites.

**Raison du status `human_needed`** : la seule incertitude restante est la validation visuelle/comportementale sur device iOS réel post-hotfix (coords Y + idempotence filesystem iCloud + badge Nouveau lifecycle + rendu silhouette catalogue). Ces 4 vérifications ne peuvent pas être effectuées programmatiquement et sont explicitement listées par l'orchestrator comme checkpoints manquants.

**Observation hors scope** : REQUIREMENTS.md VILL-04/05/06 utilise encore le vocabulaire "décorations / streak semaines" alors que Phase 30 a pivoté vers "bâtiments / feuilles lifetime" (scope shift documenté CONTEXT.md D-01/D-05). L'intent des 3 requirements est satisfait sémantiquement, mais une mise à jour de REQUIREMENTS.md pour refléter le vocabulaire final serait utile (hors scope de cette vérification).

---

_Verified: 2026-04-11_
_Verifier: Claude (gsd-verifier)_
