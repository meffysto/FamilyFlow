---
phase: 42-nourrir-le-compagnon
plan: 06
subsystem: mascot-companion-ui
tags: [ui, modal, picker, inventory, affinity, grades]
requirements: [FEED-11, FEED-12]
dependency-graph:
  requires:
    - "Plan 42-01 (getAffinity, CropAffinity, HarvestGrade EN)"
    - "Plan 42-03 (feedCompanion consumme HarvestGrade EN)"
  provides:
    - "FeedPicker — sheet picker crops pour action Nourrir"
    - "Conversion grades FR (inventaire) → EN (feed engine)"
  affects:
    - "components/mascot/FeedPicker.tsx — nouveau (327 lignes)"
tech-stack:
  added: []
  patterns:
    - "Modal pageSheet + drag-to-dismiss natif iOS"
    - "Conversion map FR↔EN pour pontage grade-engine ↔ companion-types"
    - "Tri multi-critères : affinité puis grade desc"
    - "Backward compat HarvestInventoryEntry (number legacy + Record par grade)"
key-files:
  created:
    - "components/mascot/FeedPicker.tsx"
  modified: []
decisions:
  - "Conversion FR→EN centralisée dans GRADE_FR_TO_EN (ordinaire→ordinary, beau→good, superbe→excellent, parfait→perfect)"
  - "Réutilisation getGradeEmoji + getGradeLabelKey de grade-engine pour cohérence visuelle avec le reste de la ferme (⚪🟢🟡🟣)"
  - "Détestés sélectionnables (opacity 0.55 sans disabled=true) — respect D-03"
  - "Préférés accentués par bordure 2px + couleur primary, pas juste badge — visibilité immédiate D-04"
  - "Titre modal en dur 'Nourrir le compagnon' (FR) — i18n key à ajouter si besoin, pas bloquant"
metrics:
  duration: "~8min"
  completed: "2026-04-22"
  lines: 327
  commits: 1
---

# Phase 42 Plan 06 : FeedPicker crops par grade avec affinités Summary

Sheet modale qui présente les combinaisons (cropId × grade) récoltables de `HarvestInventory` avec marqueurs visuels d'affinité espèce/crop. Composant UI pur, contrôlé par parent, callback `onPick(cropId, gradeEn)` prêt à être câblé à `feedCompanion()`.

## Objectif livré

D-02 (sheet picker crops groupés par grade), D-03 (détestés visibles & sélectionnables), D-04 (préférés mis en avant), D-18 (emojis grades). Composant consommable immédiatement par `CompanionCard` (Plan 42-08) ou tout parent qui possède `HarvestInventory` + `CompanionData`.

## Shape `HarvestInventoryEntry` rencontré

```typescript
// lib/mascot/types.ts L479-481
export type HarvestInventoryEntry =
  | number                                      // legacy pré-Phase B
  | Partial<Record<HarvestGrade, number>>;      // Phase B
```

**Stratégie :** branche `typeof entry === 'number'` conservée — traite la qty comme `ordinaire`. Aucune migration forcée, non-cassant pour vaults existants.

## Pontage grades FR ↔ EN

Deux types `HarvestGrade` coexistent dans le codebase :

| Fichier                                 | Valeurs                                   | Usage                          |
| --------------------------------------- | ----------------------------------------- | ------------------------------ |
| `lib/mascot/grade-engine.ts`            | `ordinaire` / `beau` / `superbe` / `parfait` | Stockage inventaire (Phase B)  |
| `lib/mascot/companion-types.ts` (Ph 42) | `ordinary` / `good` / `excellent` / `perfect` | Moteur feed (buff XP)          |

Le picker **affiche** les labels/emojis FR (cohérence ferme) mais **retourne** les grades EN au callback (compat `feedCompanion`). Conversion via :

```typescript
const GRADE_FR_TO_EN: Record<HarvestGradeFr, HarvestGradeEn> = {
  ordinaire: 'ordinary',
  beau:      'good',
  superbe:   'excellent',
  parfait:   'perfect',
};
```

Pas d'unification des deux types proposée ici — risque de régression sur les autres consumers de grade-engine (CraftGradePicker, harvestEngine, tests Jest existants). À consolider dans une phase dédiée si souhaité.

## Stratégie de tri finale

```
1. Affinité :  preferred (0)  <  neutral (1)  <  hated (2)
2. Grade desc : parfait > superbe > beau > ordinaire
```

Résultat : le joueur voit immédiatement en haut son meilleur crop préféré (jackpot potentiel), et les détestés tombent tout en bas (grisés mais visibles).

## Interface publique

```typescript
export interface FeedPickerProps {
  visible: boolean;
  onClose: () => void;
  inventory: HarvestInventory;
  companionSpecies: CompanionSpecies;
  onPick: (cropId: string, grade: HarvestGradeEn) => void;
}
```

## UX details

- `Modal` RN natif `presentationStyle="pageSheet"` → drag-to-dismiss iOS gratuit
- `SafeAreaView` avec `edges={['bottom']}` — header modal gère déjà le top
- `Haptics.selectionAsync()` au tap (silent catch — non-critical)
- Empty state : emoji 🌱 + message encourageant en FR
- Footer hint explicatif sous la liste (astuce préféré/détesté)
- `colors.card` pour le fond des lignes (pas `colors.surface` — absent du thème)

## Deviations from Plan

**[Rule 1 - Bug] Correction import HarvestGrade**

- **Trouvé pendant :** Task 1 (avant première écriture)
- **Issue :** Le plan importait `HarvestGrade` de `companion-types` et supposait que c'était le type utilisé dans l'inventaire. En réalité, l'inventaire utilise le `HarvestGrade` de `grade-engine.ts` (valeurs FR) tandis que le moteur feed attend les valeurs EN. Sans conversion, le tap passerait `'ordinaire'` à `feedCompanion()` qui attend `'ordinary'` → buff jamais calculé.
- **Fix :** Imports séparés `HarvestGradeFr` (grade-engine) + `HarvestGradeEn` (companion-types) + map `GRADE_FR_TO_EN` appliquée dans `handlePick`.
- **Files modified :** `components/mascot/FeedPicker.tsx`
- **Commit :** fe5f487

**[Ajustement mineur] Constantes emojis/labels grades**

- Le plan inline-définissait `GRADE_EMOJI` et `GRADE_LABEL` dans le fichier. Remplacés par `getGradeEmoji(gradeFr)` + `t(getGradeLabelKey(gradeFr))` de `grade-engine.ts` — source de vérité unique, cohérent avec le reste de la ferme (toast récolte, CraftGradePicker).
- Raison : éviter la dérive visuelle si les emojis grades changent ailleurs dans le projet.

**[Ajustement mineur] Tokens FontSize/FontWeight**

- Le plan utilisait `FontSize.md` et `FontWeight.semiBold` (camelCase). Le design system utilise `FontSize.body`/`FontSize.lg` et `FontWeight.semibold` (tout en minuscules). Corrigé.

## Commits

| #   | Hash    | Message                                              |
| --- | ------- | ---------------------------------------------------- |
| 1   | fe5f487 | feat(42-06): FeedPicker crops par grade avec affinités |

## Verification

- `test -f components/mascot/FeedPicker.tsx` — OK
- `grep "export function FeedPicker"` — OK (ligne 96)
- `grep "getAffinity(companionSpecies"` — OK (ligne 118)
- `grep "CROP_CATALOG"` — OK (imports + lookup)
- `grep 'presentationStyle="pageSheet"'` — OK
- `grep "useThemeColors"` — OK (import + call)
- `grep "❤️"` / `grep "😖"` — OK (badges affinité)
- `wc -l` — 327 lignes (≥180)
- `npx tsc --noEmit` — clean, aucune nouvelle erreur

## Self-Check: PASSED

- FOUND: `components/mascot/FeedPicker.tsx`
- FOUND: commit `fe5f487` (feat(42-06))
- All acceptance criteria verified via grep
- TypeScript clean
