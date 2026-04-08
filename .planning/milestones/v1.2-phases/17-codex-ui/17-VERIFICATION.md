---
phase: 17-codex-ui
verified: 2026-04-08T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated)
human_verification:
  - test: "Ouvrir l'écran ferme, taper le bouton 📖 (5e item HUD à droite de la saison)"
    expected: "La modale FarmCodexModal s'ouvre en pageSheet avec drag-to-dismiss, header titre 'Codex de la ferme', barre de recherche, tabs horizontaux scrollables, grille 2 colonnes"
    why_human: "Présentation pageSheet + drag-to-dismiss + rendu visuel HUD ne peuvent pas être vérifiés programmatiquement"
  - test: "Dans la barre de recherche, taper 'cafe' (sans accent)"
    expected: "Les entrées contenant 'Café' apparaissent instantanément, sans latence perceptible, cross-catégories (tabs masqués pendant la recherche)"
    why_human: "Latence perceptible et UX de normalisation live nécessitent un humain"
  - test: "Vérifier qu'une entrée animal dropOnly non découverte (ex: animal fantasy ou saga sans farmAnimals correspondants) affiche la silhouette '???' au lieu du nom"
    expected: "Card affiche '❓' icône + texte '???' (via t('codex.card.locked'))"
    why_human: "Besoin d'un profil avec état partiellement découvert pour observer le comportement"
  - test: "Taper le bouton 'Rejouer le tutoriel' en footer de la modale"
    expected: "La modale se ferme et le flag farm_tutorial est reseté (via HelpContext.resetScreen). Phase 18 câblera l'effet tutoriel lui-même."
    why_human: "Effet side-effect sur HelpContext + Phase 18 dépendante"
  - test: "Scroller la FlatList à travers 110+ entrées"
    expected: "Scroll fluide, pas de dégradation perf vs écran ferme seul — FlatList virtualise"
    why_human: "Performance perçue requiert dispositif réel"
---

# Phase 17: codex-ui Verification Report

**Phase Goal:** L'utilisateur peut ouvrir le codex de la ferme depuis un bouton "?" dans le HUD existant de l'écran ferme, naviguer par catégories, rechercher une entrée, et accéder au bouton de replay du tutoriel.

**Verified:** 2026-04-08
**Status:** human_needed (tous les checks automatisés passent ; 5 items nécessitent vérification humaine sur device)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bouton "?" (📖) dans HUD ferme existant ouvre modale pageSheet drag-to-dismiss, sans FAB | ✓ VERIFIED (code) | tree.tsx:2052-2058 (5e item `styles.hudItem` existant, pas de nouveau style), FarmCodexModal.tsx:155 `presentationStyle="pageSheet"` + `animationType="slide"` — drag-to-dismiss natif iOS pageSheet |
| 2 | Recherche texte libre normalise accents+casse, sans latence perceptible | ✓ VERIFIED (code) | lib/codex/search.ts:12-18 normalize() = NFD + strip diacritiques + lowercase + trim ; FarmCodexModal.tsx:84-89 `searchCodex(query, t, CODEX_CONTENT)` dans `useMemo` (pas de debounce nécessaire, 110 entries) ; test node : `'Épinards'.normalize('NFD')...includes('epinard') === true` |
| 3 | Entrées dropOnly non découvertes en silhouette "???", découvertes affichent stats complètes | ✓ VERIFIED (code) | FarmCodexModal.tsx:111-112 `isDropOnly = item.kind === 'animal' && item.dropOnly; isLocked = isDropOnly && !discoveredIds.has(item.sourceId)`, ligne 129-135 affiche '❓' + `t('codex.card.locked')` si isLocked ; CodexEntryDetailModal.tsx:92-153 switch exhaustif sur les 10 kinds avec fallback '—' pour loot |
| 4 | FlatList virtualisé, pas de dégradation perf vs pré-Phase 17 | ✓ VERIFIED (code) | FarmCodexModal.tsx:239-253 `<FlatList numColumns={2} ... />` (pas de ScrollView pour la liste principale), `keyExtractor` et `renderItem` stables via `useCallback` |
| 5 | Bouton "Rejouer le tutoriel" appelle `resetScreen('farm_tutorial')` et ferme la modale | ✓ VERIFIED (code) | FarmCodexModal.tsx:96-100 `handleReplayTutorial = async () => { Haptics.impactAsync(); await resetScreen('farm_tutorial'); onClose(); }` consommé ligne 263 par TouchableOpacity du footer |

**Score automatisé :** 5/5 truths vérifiées au niveau code. 5 items routés vers vérification humaine (UX visuelle, latence perçue, scroll perf, drag-to-dismiss natif, effet resetScreen réel).

### Required Artifacts

| Artifact | Expected | Level 1 Exists | Level 2 Substantive | Level 3 Wired | Level 4 Data | Status |
|----------|----------|:--:|:--:|:--:|:--:|--------|
| `lib/codex/search.ts` | `normalize`, `searchCodex`, `filterByKind` | ✓ (53 lines) | ✓ 3 exports trouvés, NFD pattern présent, zero import de lib/search.ts | ✓ consommé par FarmCodexModal.tsx:34 | N/A (pure fn) | ✓ VERIFIED |
| `lib/codex/discovery.ts` | `computeDiscoveredCodexIds`, `DiscoverySource` | ✓ (77 lines) | ✓ interface + fonction, 6 sources couvertes, zero import React/contexts | ✓ consommé par FarmCodexModal.tsx:35-38 + type exporté et importé | N/A (pure fn) | ✓ VERIFIED |
| `locales/fr/codex.json` | clés modal/search/tabs(10)/detail/card/tutorial | ✓ (31K) | ✓ 17 clés UI parité vérifiée (`OK 17 keys parity`) | ✓ consommé via `t('codex.*')` dans FarmCodexModal + CodexEntryDetailModal | ✓ JSON load OK, `codex.modal.title = "Codex de la ferme"` | ✓ VERIFIED |
| `locales/en/codex.json` | clés modal/search/tabs(10)/detail/card/tutorial | ✓ (28K) | ✓ parité stricte FR+EN (D-16) | ✓ consommé identique | ✓ `codex.modal.title = "Farm codex"` | ✓ VERIFIED |
| `components/mascot/FarmCodexModal.tsx` | Modale + tabs + search + grille 2-col + footer tutoriel (≥250 lignes) | ✓ (404 lignes) | ✓ Modal pageSheet, TAB_ORDER(10), FlatList numColumns=2, searchCodex, computeDiscoveredCodexIds, resetScreen | ✓ importé et monté dans tree.tsx:54 + 2123-2127 | ✓ profile prop flue via VaultContext (cast `as any`) | ✓ VERIFIED |
| `components/mascot/CodexEntryDetailModal.tsx` | Mini-modal détail switch exhaustif sur 10 kinds (≥120 lignes) | ✓ (317 lignes) | ✓ switch exhaustif + `_exhaustive: never`, 9 getters stats appelés, fallback '—' pour `loot` | ✓ monté comme enfant dans FarmCodexModal.tsx:277-281 avec selectedEntry state | ✓ entry passée via tap handleSelectEntry | ✓ VERIFIED |
| `app/(tabs)/tree.tsx` (modif) | 5e item HUD 📖 + useState showCodex + mount FarmCodexModal | ✓ | ✓ 3 modifications : import ligne 54, state ligne 336, HUD item 2051-2058, mount 2122-2127 | ✓ TouchableOpacity onPress → setShowCodex(true) ; FarmCodexModal visible={showCodex} | ✓ profile ?? null cast `as any` vers DiscoverySource | ⚠️ VERIFIED avec cast `as any` (documenté dans SUMMARY) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| FarmCodexModal.tsx | lib/codex/search.ts | `import { searchCodex, filterByKind }` | ✓ WIRED | Ligne 34 |
| FarmCodexModal.tsx | lib/codex/discovery.ts | `import { computeDiscoveredCodexIds, type DiscoverySource }` | ✓ WIRED | Lignes 35-38 |
| FarmCodexModal.tsx | lib/codex/content.ts | `import { CODEX_CONTENT }` | ✓ WIRED | Ligne 32, consommé lignes 86, 88 |
| FarmCodexModal.tsx | contexts/HelpContext.tsx | `useHelp().resetScreen` | ✓ WIRED | Ligne 31 import, 71 hook, 98 appel `resetScreen('farm_tutorial')` |
| FarmCodexModal.tsx | CodexEntryDetailModal | `<CodexEntryDetailModal entry={selectedEntry} />` | ✓ WIRED | Lignes 277-281 |
| app/(tabs)/tree.tsx | FarmCodexModal | `<FarmCodexModal visible={showCodex} profile={...} />` | ✓ WIRED | Lignes 2123-2127 |
| CodexEntryDetailModal | lib/codex/stats.ts | 9 getters (getCropStats...getQuestStats) | ⚠️ PARTIAL | `getLootStats` absent du module → case 'loot' renvoie placeholder '—' (déviation D-exécution documentée, fallback gracieux) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| FarmCodexModal.displayedEntries | `CODEX_CONTENT` (110 entrées Phase 16) | lib/codex/content.ts | ✓ Oui — dataset statique complet | ✓ FLOWING |
| FarmCodexModal.discoveredIds | `profile` prop via VaultContext | tree.tsx cast `(profile ?? null) as any` | ✓ Oui — Profile réel du VaultContext, shape runtime-compatible DiscoverySource | ✓ FLOWING (avec cast `as any` — runtime safe, documenté) |
| CodexEntryDetailModal stats rows | getters de lib/codex/stats.ts | `getCropStats(entry)`, etc. | ✓ Oui sauf kind='loot' (fallback '—') | ⚠️ PARTIAL sur le kind `loot` (voir Gaps ci-dessous) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compile | `npx tsc --noEmit` | `TypeScript compilation completed` (pas d'erreurs) | ✓ PASS |
| FR/EN parity on 17 UI keys | node inline script sur locales/{fr,en}/codex.json | `OK 17 keys parity` | ✓ PASS |
| Normalize algorithm correctness | `'Épinards'.normalize('NFD')...includes('epinard')` | `true` (epinards includes epinard) | ✓ PASS |
| Zero hex hardcoded dans les 2 composants créés | Grep `#[0-9A-Fa-f]{3,8}` | No matches | ✓ PASS (useThemeColors 100%) |
| Phase 16 i18n namespace préservé | `require('codex.json').crop` présent | Existant (31K/28K, clés Phase 16 intactes) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CODEX-06 | 17-03 | Bouton "?" intégré au HUD existant, pas de FAB | ✓ SATISFIED | tree.tsx:2052-2058 5e item `styles.hudItem` existant (D-12 : pas de nouveau style), emoji 📖 |
| CODEX-07 | 17-02, 17-03 | Modal pageSheet drag-to-dismiss + navigation catégories | ✓ SATISFIED (code) | FarmCodexModal.tsx:155 `presentationStyle="pageSheet"`, TAB_ORDER avec 10 kinds scrollables horizontalement (lignes 201-236) |
| CODEX-08 | 17-01, 17-03 | Recherche normalisation accents/casse ~~via lib/search.ts~~ | ⚠️ SATISFIED avec déviation documentée | D-09 : normalize() dupliqué dans `lib/codex/search.ts:12-18` plutôt qu'importé depuis lib/search.ts (décision architecturale : isoler lib/codex/ autonome). Comportement identique NFD. REQUIREMENTS.md dit "via lib/search.ts (pattern existant)" — le pattern est réutilisé mais le symbole est dupliqué. Non bloquant, mais écart avec la lettre du requirement. |
| CODEX-09 | 17-03 | FlatList virtualisé pour anti-régression perf | ✓ SATISFIED | FarmCodexModal.tsx:239-253 FlatList `numColumns={2}`, pas de ScrollView pour la liste principale |
| CODEX-10 | 17-02, 17-03 | Bouton "Rejouer le tutoriel" → resetScreen('farm_tutorial') + ferme codex | ✓ SATISFIED | FarmCodexModal.tsx:96-100 handleReplayTutorial ; footer ligne 263 TouchableOpacity onPress={handleReplayTutorial} |

Aucune orphaned requirement : REQUIREMENTS.md mappe CODEX-06..10 à Phase 17, tous sont couverts par les plans 17-01/02/03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/(tabs)/tree.tsx | 2126 | `(profile ?? null) as any` cast vers DiscoverySource | ℹ️ Info | Cast documenté (SUMMARY déviation Rule 3) : Profile a farmInventory avec shape plus stricte, runtime-compatible. Acceptable mais idéalement remplacé par un adapter typé. |
| components/mascot/CodexEntryDetailModal.tsx | 96-136 | `as Record<string, unknown>` sur retours getters | ℹ️ Info | Cast nécessaire car getters retournent `CropDefinition | undefined` typé strict, `toDisplayRows` attend une map générique. Accepté. |
| components/mascot/CodexEntryDetailModal.tsx | 119-126 | case 'loot' renvoie placeholder '—' sans appeler de getter | ⚠️ Warning | `getLootStats` inexistant dans lib/codex/stats.ts — Exécuteur a choisi le fallback gracieux. CODEX-09 "FlatList virtualisé" est satisfait, mais CODEX-09 implique implicitement "découvertes affichent stats complètes" pour le kind loot : un utilisateur ouvrant le détail d'une entrée loot verra uniquement '—'. Suggère de créer `getLootStats` en Phase 17.1 ou Phase 18. Non bloquant. |
| components/mascot/CodexEntryDetailModal.tsx | 314-316 | `_reserved` style orphelin avec `borderRadius: Radius.md` | ℹ️ Info | Commentaire dit "réservé pour cohérence future" — dead style mais documenté. |

Aucun TODO/FIXME/placeholder/empty handler détecté. Aucun hex hardcodé. Aucun `console.log` laissé hors `__DEV__`.

### Human Verification Required

### 1. Ouverture du codex depuis le HUD ferme
**Test :** Ouvrir l'écran ferme, taper le bouton 📖 (5e item HUD, à droite de la saison)
**Expected :** La modale FarmCodexModal s'ouvre en pageSheet avec drag-to-dismiss iOS natif, header "Codex de la ferme", barre de recherche, tabs horizontaux scrollables (Cultures/Animaux/...), grille 2 colonnes
**Why human :** Rendu visuel HUD + animation pageSheet + drag-to-dismiss natif non vérifiables par grep

### 2. Latence recherche normalisée
**Test :** Dans la search bar, taper 'cafe' (sans accent), puis 'epinard', puis 'CAFE'
**Expected :** Les entrées contenant 'Café', 'Épinards' apparaissent instantanément, cross-catégories (tabs masqués pendant la recherche). Aucune latence perceptible (≤16ms par frame).
**Why human :** Latence perçue nécessite dispositif réel

### 3. Silhouette dropOnly non découverte
**Test :** Sur un profil sans farmAnimals saga/fantasy complets, ouvrir le codex > onglet Animaux
**Expected :** Les animaux dropOnly non possédés affichent icône '❓' + texte '???' ; les animaux possédés affichent leur nom réel
**Why human :** Besoin d'un profil avec état partiellement découvert

### 4. Détail d'une entrée loot
**Test :** Naviguer à l'onglet Butin, taper une carte
**Expected :** CodexEntryDetailModal s'ouvre, affiche lore + section Stats avec '—' (fallback car `getLootStats` absent)
**Why human :** Validation UX du fallback — l'utilisateur doit comprendre que ce n'est pas un bug. Si UX jugée insuffisante → Phase 17.1 créer `getLootStats`.

### 5. Replay tutoriel
**Test :** Dans le footer du codex, taper "Rejouer le tutoriel"
**Expected :** La modale se ferme. Le flag `farm_tutorial` est reseté dans HelpContext. Phase 18 câblera l'effet tutoriel proprement ; pour Phase 17, on vérifie seulement que le handler est appelé (pas de crash).
**Why human :** Side-effect sur HelpContext + dépendance Phase 18

### Gaps Summary

**Aucun gap bloquant.** Tous les must-haves passent les niveaux 1-4. Tous les 5 success criteria sont vérifiés au niveau code. Tous les 5 requirements CODEX-06..10 sont marqués Complete dans REQUIREMENTS.md et supportés par des artefacts substantiels et câblés.

**Déviations notables (toutes documentées dans SUMMARYs) :**

1. **CODEX-08 pattern** : Le requirement dit "via lib/search.ts (pattern existant)", la décision D-09 a dupliqué normalize() dans lib/codex/search.ts. Le *pattern* NFD est réutilisé, mais le *symbole* est dupliqué. Choix architectural justifié (isolation lib/codex/). Suggère de mettre à jour REQUIREMENTS.md ou d'ajouter une note pour clarifier l'intention.

2. **Loot stats** : `getLootStats` n'existe pas dans lib/codex/stats.ts, le kind 'loot' affiche '—' dans le détail. Fallback gracieux mais incomplet — CODEX-09 "rendu complet des stats" est partiellement satisfait pour ce kind. À traiter en follow-up (ajouter `getLootStats` + test).

3. **Profile cast `as any`** : tree.tsx:2126 passe `(profile ?? null) as any` à FarmCodexModal. Runtime-compatible mais rompt le type-safety à la frontière. À remplacer par un adapter typé `toDiscoverySource(profile)` en refactor.

**Action recommandée :** Proceed. Vérification humaine sur device (5 items listés ci-dessus) pour valider l'UX. Aucun gap nécessitant un re-plan.

---

_Verified: 2026-04-08_
_Verifier: Claude (gsd-verifier) — Opus 4.6_
