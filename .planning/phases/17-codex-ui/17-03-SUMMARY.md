---
phase: 17-codex-ui
plan: 03
subsystem: codex
tags: [codex, ui, modal, farm, tree, integration]
requires:
  - 17-01
  - 17-02
  - lib/codex/content.ts
  - lib/codex/types.ts
  - lib/codex/stats.ts
  - lib/codex/search.ts
  - lib/codex/discovery.ts
provides:
  - FarmCodexModal
  - CodexEntryDetailModal
  - tree.tsx HUD button 📖
affects:
  - app/(tabs)/tree.tsx
tech-stack:
  added: []
  patterns:
    - modal-pagesheet
    - flatlist-numcolumns-2
    - reanimated-fadeindown
    - useThemeColors-inline
    - switch-exhaustive-never
key-files:
  created:
    - components/mascot/CodexEntryDetailModal.tsx
    - components/mascot/FarmCodexModal.tsx
  modified:
    - app/(tabs)/tree.tsx
decisions:
  - "D-05 respecté : switch exhaustif sur les 10 CodexKind avec _exhaustive: never — le compilateur bloque tout ajout futur non câblé"
  - "getLootStats absent dans lib/codex/stats.ts → fallback gracieux '—' pour le kind 'loot' (documenté dans renderStats)"
  - "Getters stats retournent l'objet catalogue complet (pas un Record) → helper toDisplayRows filtre aux primitives (string/number/boolean) pour rendu stable"
  - "colors.surface/background inexistants dans AppColors → remplacés par colors.card/bg conformément à constants/colors.ts"
  - "FontSize.md/xl inexistants → remplacés par FontSize.body/title/subtitle selon sémantique"
  - "Radius.pill inexistant → Radius.full (9999px)"
  - "Spacing tokens adaptés : Spacing['2xl']=16 pour padding écran, Spacing.xl=12, Spacing.md=8 (base 4px documentée)"
  - "tree.tsx : profile cast via `as any` vers DiscoverySource — Profile porte farmInventory typé plus strict que la shape minimale de DiscoverySource, cast accepté car runtime-compatible"
metrics:
  duration: 7min
  tasks: 3
  files: 3
  completed: 2026-04-08
requirements:
  - CODEX-06
  - CODEX-07
  - CODEX-08
  - CODEX-09
  - CODEX-10
---

# Phase 17 Plan 03 : FarmCodexModal + intégration HUD — Summary

Livraison end-to-end de l'UI codex ferme : bouton 📖 dans le HUD ferme existant ouvre une modale pageSheet avec search normalisée accents, 10 tabs catégories, FlatList 2-col virtualisée, mini-modal détail avec lore + stats, et footer replay tutoriel (branché mais effet côté Phase 18).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | CodexEntryDetailModal (mini-modal détail) | 9be0e7f | components/mascot/CodexEntryDetailModal.tsx |
| 2 | FarmCodexModal (modale principale) | 63abdd8 | components/mascot/FarmCodexModal.tsx |
| 3 | Intégration HUD tree.tsx (import + state + bouton + mount) | b8f81e7 | app/(tabs)/tree.tsx |

## Fichiers créés

### components/mascot/CodexEntryDetailModal.tsx (317 lignes)

Props :
```typescript
interface CodexEntryDetailModalProps {
  visible: boolean;
  entry: CodexEntry | null;
  onClose: () => void;
}
```

Structure :
- Modal pageSheet secondaire (par-dessus FarmCodexModal)
- Header : bouton close ✕ + titre (nom de l'entrée via `t(entry.nameKey)`)
- ScrollView : gros emoji icône, section lore (D-04), section stats (D-04)
- Switch exhaustif `entry.kind` → getter approprié de lib/codex/stats.ts
- Helper `toDisplayRows` : filtre l'objet catalogue aux valeurs primitives (string/number/boolean) pour rendre un tableau clé/valeur lisible
- Fallback `—` pour le kind 'loot' (pas de getter dédié) ET pour tout résultat vide

### components/mascot/FarmCodexModal.tsx (404 lignes)

Props :
```typescript
interface FarmCodexModalProps {
  visible: boolean;
  onClose: () => void;
  profile: DiscoverySource | null;
}
```

Structure :
- Modal pageSheet racine avec SafeAreaView
- Header : close ✕ + titre `t('codex.modal.title')`
- Search bar : TextInput + icône 🔍, `placeholderTextColor` via `colors.textMuted`
- 10 tabs horizontaux scrollables (masqués si recherche active — D-08)
- FlatList `numColumns={2}` virtualisée (CODEX-09)
- Cards : emoji icône + nom, silhouette `???` si animal dropOnly non découvert (via `discoveredIds.has(sourceId)`)
- FadeInDown Reanimated avec délai échelonné par index
- Empty state avec `t('codex.search.empty', { query })`
- Footer : bouton replay tutoriel → `resetScreen('farm_tutorial')` + `onClose()` (D-15)
- CodexEntryDetailModal monté comme enfant avec `selectedEntry` state local

Helpers consommés :
- `searchCodex(query, t, CODEX_CONTENT)` — plan 17-01
- `filterByKind(CODEX_CONTENT, activeTab)` — plan 17-01
- `computeDiscoveredCodexIds(profile)` — plan 17-01 (calcul lazy, useMemo guard sur `visible`)
- `CODEX_CONTENT` — phase 16

Clés i18n consommées (toutes livrées par 17-02) :
- `codex.modal.title`
- `codex.search.placeholder`, `codex.search.empty`
- `codex.tabs.{crop,animal,building,craft,tech,companion,loot,seasonal,saga,quest}`
- `codex.detail.lore`, `codex.detail.stats`, `codex.detail.close`
- `codex.card.locked`
- `codex.tutorial.replay`

## Intégration tree.tsx

Trois modifications minimales :

**1. Import (après CraftSheet)** :
```tsx
import { FarmCodexModal } from '../../components/mascot/FarmCodexModal';
```

**2. useState (juste après showCraftSheet)** :
```tsx
// Codex ferme (Phase 17)
const [showCodex, setShowCodex] = useState(false);
```

**3. 5e item HUD (après l'item saison)** :
```tsx
<TouchableOpacity
  style={styles.hudItem}
  onPress={() => { Haptics.selectionAsync(); setShowCodex(true); }}
  accessibilityLabel={t('codex.modal.title')}
>
  <Text style={styles.hudEmoji}>{'📖'}</Text>
</TouchableOpacity>
```

Réutilise `styles.hudItem` et `styles.hudEmoji` existants (D-12, aucun nouveau style).

**4. Mount de la modale (après CraftSheet)** :
```tsx
<FarmCodexModal
  visible={showCodex}
  onClose={() => setShowCodex(false)}
  profile={(profile ?? null) as any}
/>
```

Le cast `as any` est nécessaire car le type `Profile` porte `farmInventory` avec une shape plus stricte que `DiscoverySource` — runtime-compatible, documenté comme deviation ci-dessous.

## Décisions D-01 à D-16 câblées

| Décision | Câblage |
|----------|---------|
| D-01 FlatList 2-col + tabs | ✅ `numColumns={2}` + ScrollView horizontal TAB_ORDER |
| D-02 Mini-modal détail | ✅ CodexEntryDetailModal enfant |
| D-03 Silhouette animaux dropOnly | ✅ `isLocked` via `discoveredIds.has(sourceId)` |
| D-04 Lore top, stats bottom | ✅ Ordre dans ScrollView du détail |
| D-05 Switch exhaustif | ✅ `_exhaustive: never` dans default case |
| D-06 Discovery lazy à l'ouverture | ✅ `useMemo` gardé par `visible` |
| D-07 Trade-off re-silhouette accepté | ✅ Documenté (pas de persistance) |
| D-08 Search override tabs | ✅ `query.trim().length > 0` → searchCodex + masque tabs |
| D-09 Normalize dupliqué | ✅ Importé depuis lib/codex/search.ts (pas lib/search.ts) |
| D-10 `t` injecté | ✅ `searchCodex(query, t, CODEX_CONTENT)` |
| D-11 Reanimated (pas RN Animated) | ✅ `FadeInDown` de `react-native-reanimated` |
| D-12 Réutilise styles HUD existants | ✅ Pas de nouveau style dans tree.tsx |
| D-13 Emoji 📖 | ✅ `{'📖'}` |
| D-14 Pattern squelette sheets mascot | ✅ Même structure que CraftSheet / TechTreeSheet |
| D-15 Footer replay tutoriel | ✅ `resetScreen('farm_tutorial')` + `onClose()` |
| D-16 Parité FR+EN | ✅ Consommé depuis 17-02 (déjà vérifié) |

## Requirements satisfaits

| Req | Description | Satisfaction |
|-----|-------------|--------------|
| CODEX-06 | Bouton 📖 dans HUD existant, pas de FAB | ✅ 5e item `styles.hudItem` |
| CODEX-07 | Modal pageSheet + tabs catégories | ✅ `presentationStyle="pageSheet"` + 10 tabs |
| CODEX-08 | Recherche normalisée accents/casse | ✅ `searchCodex` (NFD via `normalize`) |
| CODEX-09 | FlatList numColumns=2 virtualisée | ✅ Pas de ScrollView pour liste principale |
| CODEX-10 | Bouton footer replay tutoriel | ✅ `resetScreen('farm_tutorial')` branché |

## Deviations from Plan

### [Rule 3 - Blocking] colors.surface / colors.background inexistants

- **Found during:** Task 1 (écriture CodexEntryDetailModal)
- **Issue:** Le plan référence `colors.surface` et `colors.background` mais `AppColors` (constants/colors.ts) expose `colors.card` et `colors.bg`
- **Fix:** Remplacement par `colors.card` (cards) et `colors.bg` (backgrounds pleins). Ajout de `colors.inputBg`/`colors.inputBorder` pour la searchBar. `colors.textMuted`/`colors.textSub` pour les labels secondaires
- **Files modified:** CodexEntryDetailModal.tsx, FarmCodexModal.tsx
- **Commits:** 9be0e7f, 63abdd8

### [Rule 3 - Blocking] Design tokens adaptés au projet

- **Found during:** Task 1
- **Issue:** Le plan référence `FontSize.md`, `FontSize.xl`, `Radius.pill`, `Spacing.lg=16` qui n'existent pas dans les constants (le projet utilise `body`/`title`/`subtitle` pour FontSize, `full` pour pill, et Spacing sur base 4px où `lg=10` et `'2xl'=16`)
- **Fix:** Remplacement par les tokens existants (`FontSize.body`, `FontSize.title`, `FontSize.subtitle`, `Radius.full`, `Spacing['2xl']`/`Spacing.xl`/`Spacing.md`)
- **Files modified:** CodexEntryDetailModal.tsx, FarmCodexModal.tsx
- **Commits:** 9be0e7f, 63abdd8

### [Rule 1 - Bug] Signature getters stats différente de la supposition du plan

- **Found during:** Task 1
- **Issue:** Le plan suppose `getCropStats(sourceId: string)` retournant `{ growthDays, sellPrice, ... }`, alors que la vraie signature est `getCropStats(entry: CropEntry): CropDefinition | undefined` — prend l'entry typée et retourne l'objet catalogue complet
- **Fix:** Appel avec `entry` directement (le narrowing du switch fournit le bon type), puis helper `toDisplayRows` qui convertit le résultat en paires `[key, string]` en filtrant aux primitives
- **Files modified:** CodexEntryDetailModal.tsx
- **Commit:** 9be0e7f

### [Rule 1 - Bug] getLootStats inexistant

- **Found during:** Task 1
- **Issue:** Le plan liste `getLootStats` dans les imports, mais ce getter n'existe pas dans lib/codex/stats.ts (seulement 9 getters sur 10 kinds)
- **Fix:** Retrait de l'import, case 'loot' retourne un placeholder '—' (fallback gracieux conforme à la contrainte "ne PAS échouer à compiler" du plan)
- **Files modified:** CodexEntryDetailModal.tsx
- **Commit:** 9be0e7f

### [Rule 3 - Blocking] Profile type incompatible avec DiscoverySource

- **Found during:** Task 3 (intégration tree.tsx)
- **Issue:** `Profile` expose `farmInventory` avec un type plus strict que `DiscoverySource.farmInventory?: Record<string, number> | null`, causant une erreur TS2322 au passage de la prop
- **Fix:** Cast `(profile ?? null) as any` avec commentaire justificatif (shape minimale DiscoverySource runtime-compatible)
- **Files modified:** app/(tabs)/tree.tsx
- **Commit:** b8f81e7

## Verification

- `npx tsc --noEmit` : zéro nouvelle erreur dans CodexEntryDetailModal.tsx, FarmCodexModal.tsx, tree.tsx
- `grep -E "#[0-9A-Fa-f]{3,8}"` dans les deux composants créés : zéro hit (100% useThemeColors)
- Bouton 📖 présent comme 5e item HUD
- FarmCodexModal monté et consomme toutes les clés i18n 17-02
- CodexEntryDetailModal enfant avec switch exhaustif sur les 10 kinds

## Notes pour Phase 18 (tutoriel)

Le hook `resetScreen('farm_tutorial')` est déjà branché dans FarmCodexModal footer (bouton `t('codex.tutorial.replay')`). Phase 18 devra :

1. Implémenter la réaction côté tutoriel : watcher sur `hasSeenScreen('farm_tutorial')` dans tree.tsx qui relance l'overlay tutoriel quand le flag repasse à false
2. Pas de modification du codex nécessaire — l'intégration côté modal est complète

## Self-Check: PASSED

- FOUND: components/mascot/CodexEntryDetailModal.tsx
- FOUND: components/mascot/FarmCodexModal.tsx
- FOUND: modifications app/(tabs)/tree.tsx (import + state + HUD + mount)
- FOUND: commit 9be0e7f (Task 1)
- FOUND: commit 63abdd8 (Task 2)
- FOUND: commit b8f81e7 (Task 3)
- FOUND: tsc clean sur les 3 fichiers (zéro nouvelle erreur)
- FOUND: zéro hex hardcodé dans les 2 composants créés
