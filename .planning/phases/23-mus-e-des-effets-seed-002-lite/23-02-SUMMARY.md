---
phase: 23-mus-e-des-effets-seed-002-lite
plan: 02
subsystem: museum
tags: [museum, gamification, ui, modal, sectionlist, reanimated]
dependency_graph:
  requires: [lib/museum/engine.ts, lib/semantic/effect-toasts.ts, components/mascot/HarvestBurst.tsx, app/(tabs)/tree.tsx]
  provides: [components/mascot/MuseumModal.tsx — modal pageSheet SectionList groupée par semaine]
  affects: [app/(tabs)/tree.tsx — bouton 🏛️ Musée dans actionBar + showMuseum state + MuseumModal rendu]
tech_stack:
  added: []
  patterns: [pageSheet modal, SectionList avec stickySectionHeadersEnabled, FadeInDown.delay par row, badge variant inline variantColor+33, React.memo sur row, useEffect chargement vault]
key_files:
  created:
    - components/mascot/MuseumModal.tsx
  modified:
    - app/(tabs)/tree.tsx
decisions:
  - "colors.cardAlt utilisé pour le fond des section headers (colors.surface absent du thème — cardAlt donne un contraste léger identique)"
  - "vault destructuré depuis useVault() dans tree.tsx pour le passer en prop à MuseumModal — évite import contexte dans le modal"
  - "MuseumRow en React.memo séparé — per CLAUDE.md list items"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-10T07:03:56Z"
  tasks: 2
  files: 2
---

# Phase 23 Plan 02: Écran Musée des effets Summary

Modal pageSheet `MuseumModal.tsx` avec SectionList groupée par semaine (FadeInDown, badges variant inline) câblé via bouton 🏛️ dans l'actionBar de `tree.tsx`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Créer MuseumModal.tsx + câbler dans tree.tsx | 2d97a4d | components/mascot/MuseumModal.tsx, app/(tabs)/tree.tsx |
| 2 | Vérification visuelle (checkpoint auto-approuvé) | — | — |

## What Was Built

### components/mascot/MuseumModal.tsx (nouveau)

- Props : `{ visible, onClose, profileId, vault }` — pattern identique aux autres modals de l'arbre
- `Modal` avec `presentationStyle="pageSheet"` + `animationType="slide"` + `onRequestClose`
- `SafeAreaView` englobant — pattern FarmCodexModal
- **Header maison** : `TouchableOpacity` ✕ + title centré + spacer — PAS ModalHeader (per anti-pattern RESEARCH.md)
- `useEffect` chargement vault quand `visible && profileId && vault` → `readFile(gami-{id}.md)` → `parseMuseumEntries()` → `groupEntriesByWeek()` → `setSections()`
- **SectionList** directement dans SafeAreaView (Pitfall 3 — PAS dans ScrollView) :
  - `renderSectionHeader` : fond `colors.cardAlt`, uppercase caption semibold
  - `renderItem` : `MuseumRow` (React.memo) avec `FadeInDown.delay(index * 50)`
  - `stickySectionHeadersEnabled={true}`
  - `ListEmptyComponent` : icône 🏛️ 48px + texte `museum.empty`
- **MuseumRow** (React.memo) : icône emoji | colonne label+date (flex:1) | badge variant inline
  - Badge : `CATEGORY_VARIANT[categoryId]` → `VARIANT_CONFIG[variant].particleColor` → View `backgroundColor: variantColor + '33'` + Text `color: variantColor`
  - Labels variant : `museum.variant.ambient` / `.rare` / `.golden` (clés créées Plan 01)
- Styles statiques via `StyleSheet.create({})` + valeurs dynamiques thème en inline
- Tokens design : `Spacing`, `Radius`, `FontSize`, `FontWeight` — zéro valeur hardcodée

### app/(tabs)/tree.tsx (modifié)

- `vault` ajouté au destructuring `useVault()` (ligne ~299)
- `const [showMuseum, setShowMuseum] = useState(false)` ajouté avec les autres states show* (~ligne 356)
- Bouton 🏛️ `Musée` ajouté dans l'actionBar après le bouton Badges
- `<MuseumModal visible={showMuseum} onClose={() => setShowMuseum(false)} profileId={activeProfile?.id ?? null} vault={vault} />` rendu après `<BadgesSheet />`
- Import `MuseumModal` depuis `'../../components/mascot/MuseumModal'`

## Decisions Made

- `colors.cardAlt` pour le fond des section headers — `colors.surface` absent du thème
- `vault` passé en prop depuis tree.tsx (destructuré de `useVault()`) plutôt qu'accédé via contexte dans le modal — isolation claire, cohérent avec le pattern des autres modals (FarmCodexModal, BadgesSheet)

## Deviations from Plan

### Auto-approuvé

**Task 2 (checkpoint:human-verify)** auto-approuvée — agent exécuté en mode `--auto` per directive prompt.

### Ajustement mineur

**[Rule 1 - Adaptation] colors.surface → colors.cardAlt**
- **Trouvé pendant :** Task 1
- **Issue :** `colors.surface` n'existe pas dans le thème (vérifié dans ThemeContext.tsx et constants/colors.ts)
- **Fix :** `colors.cardAlt` utilisé — donne un fond légèrement contrasté identique à l'intention du plan
- **Fichiers :** components/mascot/MuseumModal.tsx
- **Commit :** 2d97a4d

## Known Stubs

Aucun — le modal charge les données réelles depuis le vault via `parseMuseumEntries` + `groupEntriesByWeek`. L'empty state est intentionnel pour les profils sans effets enregistrés.

## Self-Check: PASSED

- [x] `components/mascot/MuseumModal.tsx` existe et exporte `MuseumModal`
- [x] `grep -q "SectionList" components/mascot/MuseumModal.tsx` — OK
- [x] `grep -q "FadeInDown" components/mascot/MuseumModal.tsx` — OK
- [x] `grep -q "groupEntriesByWeek" components/mascot/MuseumModal.tsx` — OK
- [x] `grep -q "pageSheet" components/mascot/MuseumModal.tsx` — OK
- [x] `grep -q "showMuseum" "app/(tabs)/tree.tsx"` — OK
- [x] `grep -q "MuseumModal" "app/(tabs)/tree.tsx"` — OK
- [x] `grep -q "🏛️" "app/(tabs)/tree.tsx"` — OK
- [x] Commit 2d97a4d existe
- [x] `npx tsc --noEmit` — zéro erreur nouvelle
