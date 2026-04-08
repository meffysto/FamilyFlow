---
status: complete
phase: 17-codex-ui
source: [17-VERIFICATION.md]
started: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Ouverture du codex depuis le HUD ferme
expected: Ouvrir l'écran ferme, taper le bouton 📖 (5e item HUD à droite de la saison) — la modale FarmCodexModal s'ouvre en pageSheet avec drag-to-dismiss iOS natif, header "Codex de la ferme", barre de recherche, tabs horizontaux scrollables (Cultures/Animaux/...), grille 2 colonnes
result: pass

### 2. Latence recherche normalisée
expected: Dans la barre de recherche, taper 'cafe' (sans accent), puis 'epinard', puis 'CAFE' — les entrées contenant 'Café'/'Épinards' apparaissent instantanément cross-catégories (tabs masqués pendant la recherche), aucune latence perceptible (≤16ms par frame)
result: pass

### 3. Silhouette dropOnly non découverte
expected: Sur un profil sans farmAnimals saga/fantasy complets, ouvrir le codex > onglet Animaux — les animaux dropOnly non possédés affichent icône '❓' + texte '???' (via t('codex.card.locked')) ; les animaux possédés affichent leur nom réel
result: pass

### 4. Détail d'une entrée loot (fallback getLootStats)
expected: Naviguer à l'onglet Butin, taper une carte — CodexEntryDetailModal s'ouvre, affiche lore + section Stats avec '—' (fallback car getLootStats absent). Validation UX : l'utilisateur doit comprendre que ce n'est pas un bug.
result: pass
note: "Refactor in-phase — section Caractéristiques masquée entièrement quand la whitelist est vide (loot/saga/seasonal/adventure) au lieu d'afficher '—'. UX propre, plus de fallback ambigu."

### 5. Scroll FlatList virtualisé
expected: Scroller la FlatList à travers 110+ entrées — scroll fluide, pas de dégradation perf vs écran ferme seul, FlatList virtualise correctement
result: pass

### 6. Bouton "Rejouer le tutoriel"
expected: Taper le bouton "Rejouer le tutoriel" en footer de la modale — la modale se ferme et le flag farm_tutorial est reseté (via HelpContext.resetScreen). Phase 18 câblera l'effet tutoriel lui-même.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

## Notes de session

Durant le UAT humain, 9 bugs additionnels de Phase 16 ont été détectés et
corrigés in-phase (cascade de fixes i18n et sources) :

1. **Namespace i18n codex** (235a9ec) — defaultNS='common' vs key 'codex.X' →
   toutes les traductions cassées. Corrigé en passant à `codex:X` (:)
2. **Tabs layout** (e76862f) — ScrollView horizontale sans flexGrow:0 +
   Radius.full causait des pills géantes verticales
3. **Stats camelCase** (595596e) — toDisplayRows dumpait l'objet catalogue
   brut → refactor whitelist + labels/valeurs traduits via codex:stats/values
4. **Quêtes mauvaise source** (85f2c89) — pointait ADVENTURES (mini-aventures
   narratives) au lieu de QUEST_TEMPLATES (7 quêtes familiales Phase 14)
5. **Saisonniers sans emoji** (85f2c89) — seasonal.ts ignorait content.emoji
6. **Onglet Aventures manquant** (67f78a5) — ADVENTURES consommé par
   DashboardGarden mérite sa propre catégorie → 11e kind 'adventure'
7. **Sprites animaux/compagnons** (7ad254c) — emoji → sprites Mana Seed 68x68
8. **Sprites sagas** (9def616) — emoji → sprites visiteurs
9. **Sprites bâtiments** (c5a7855) — emoji → BUILDING_SPRITES lv1

Phase 17 livre donc bien au-delà du scope initial : codex avec 11 catégories,
sprites pixel art natifs pour 30 entrées (17 animaux + 5 compagnons + 4 sagas
+ 4 bâtiments), et architecture de stats kid-friendly. Les cultures restent
sur emoji pour l'instant (prochain incrément possible — 14 sprites existent).
