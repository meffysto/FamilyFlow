---
status: partial
phase: 17-codex-ui
source: [17-VERIFICATION.md]
started: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Ouverture du codex depuis le HUD ferme
expected: Ouvrir l'écran ferme, taper le bouton 📖 (5e item HUD à droite de la saison) — la modale FarmCodexModal s'ouvre en pageSheet avec drag-to-dismiss iOS natif, header "Codex de la ferme", barre de recherche, tabs horizontaux scrollables (Cultures/Animaux/...), grille 2 colonnes
result: [pending]

### 2. Latence recherche normalisée
expected: Dans la barre de recherche, taper 'cafe' (sans accent), puis 'epinard', puis 'CAFE' — les entrées contenant 'Café'/'Épinards' apparaissent instantanément cross-catégories (tabs masqués pendant la recherche), aucune latence perceptible (≤16ms par frame)
result: [pending]

### 3. Silhouette dropOnly non découverte
expected: Sur un profil sans farmAnimals saga/fantasy complets, ouvrir le codex > onglet Animaux — les animaux dropOnly non possédés affichent icône '❓' + texte '???' (via t('codex.card.locked')) ; les animaux possédés affichent leur nom réel
result: [pending]

### 4. Détail d'une entrée loot (fallback getLootStats)
expected: Naviguer à l'onglet Butin, taper une carte — CodexEntryDetailModal s'ouvre, affiche lore + section Stats avec '—' (fallback car getLootStats absent). Validation UX : l'utilisateur doit comprendre que ce n'est pas un bug. Si UX insuffisante → Phase 17.1 créer getLootStats.
result: [pending]

### 5. Scroll FlatList virtualisé
expected: Scroller la FlatList à travers 110+ entrées — scroll fluide, pas de dégradation perf vs écran ferme seul, FlatList virtualise correctement
result: [pending]

### 6. Bouton "Rejouer le tutoriel"
expected: Taper le bouton "Rejouer le tutoriel" en footer de la modale — la modale se ferme et le flag farm_tutorial est reseté (via HelpContext.resetScreen). Phase 18 câblera l'effet tutoriel lui-même.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
