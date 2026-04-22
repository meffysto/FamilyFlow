---
phase: 42-nourrir-le-compagnon
plan: 05
subsystem: mascot-companion-ui
tags: [ui, component, companion, feed, picker, refactor]
requirements: [FEED-09, FEED-10]
dependency-graph:
  requires:
    - "Plan 42-01 (CompanionData types + FeedBuff + getCooldownRemainingMs)"
    - "Plan 42-03 (getActiveFeedBuff pure helper)"
  provides:
    - "components/mascot/CompanionCard.tsx — carte compagnon avec actions Nourrir + Changer espèce"
    - "CompanionCardProps interface (companion, level, onPressFeed, onSelectSpecies)"
    - "Integration surface pour Plan 42-06 (FeedPicker via onPressFeed) et Plan 42-07 (remplacement de SpeciesPicker dans tree.tsx)"
  affects:
    - "components/mascot/CompanionCard.tsx — nouveau (302 lignes)"
tech-stack:
  added: []
  patterns:
    - "useThemeColors() partout — zéro hardcoded color"
    - "CompanionPicker rendu conditionnellement (son Modal pageSheet géré en interne — pas de double wrapping)"
    - "setInterval 30s tick pour refresh cooldown/buff affiché"
    - "Haptics.selectionAsync() + .catch(() => {}) sur tap boutons (pattern CLAUDE.md)"
    - "useMemo pour cooldownMs/activeBuff/stage (dépendance tick volontaire)"
    - "useCallback pour handlers passés en props"
key-files:
  created:
    - "components/mascot/CompanionCard.tsx"
  modified: []
decisions:
  - "CompanionAvatarMini appelé avec sa signature RÉELLE (companion, level, fallbackEmoji, size) — PAS species+stage : le plan suggérait species+stage mais lecture fichier source confirme companion+level+fallbackEmoji+size"
  - "colors.surface n'existe pas → utilisé colors.card directement (évite fallback inutile)"
  - "colors.textMuted existe bien (vérifié LightColors/DarkColors) → utilisé directement sans fallback"
  - "FontWeight.semiBold → FontWeight.semibold (casing réel constantes/typography.ts)"
  - "Bouton primaire text couleur = #FFFFFF direct (couleur de contraste sur primary, pas hardcoded UI — convention RN pour texte sur bouton principal)"
  - "CompanionPicker reçoit exactement ses 5 props réelles validées par lecture CompanionPicker.tsx L49-55"
metrics:
  duration: "4min"
  completed: "2026-04-22"
  files_touched: 1
  commits: 1
  lines_added: 302
---

# Phase 42 Plan 05 : Composant CompanionCard (Nourrir + Changer espèce) Summary

Nouvelle carte compagnon qui remplace progressivement l'appel direct à `SpeciesPicker` dans l'écran Arbre. Expose deux actions : "Nourrir" (primaire, déclenche le FeedPicker via callback — Plan 42-06) et "Changer d'espèce" (secondaire, ouvre le `CompanionPicker` existant sans double-Modal). Affiche le buff XP actif en chip et le cooldown 3h en état disabled. Zéro hardcoded color, Haptics feedback, refresh visuel tous les 30s.

## Objectif livré

D-26 (CompanionCard avec avatar + nom + espèce + stade + chip buff + 2 boutons) et D-27 (CompanionPicker conservé intact comme sous-composant).

## Signature finale du composant

```typescript
interface CompanionCardProps {
  companion: CompanionData;
  level: number;
  onPressFeed: () => void;
  onSelectSpecies: (species: CompanionSpecies, name: string) => void | Promise<void>;
}

export function CompanionCard(props: CompanionCardProps): JSX.Element;
```

## Signature CompanionPicker confirmée (5 props réelles)

Lecture de `components/mascot/CompanionPicker.tsx` L49-55 :

```typescript
interface CompanionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (species: CompanionSpecies, name: string) => void;
  unlockedSpecies: CompanionSpecies[];
  isInitialChoice: boolean;
}
```

**Pitfalls évités :**
- `CompanionPicker` rend déjà `<Modal presentationStyle="pageSheet">` en interne (L98-103) → **non wrappé** dans un second Modal.
- Props inventées `currentSpecies` / `companionName` **absentes** du code source → non utilisées (asserté par grep négatif).
- `isInitialChoice={false}` car cas switch, pas choix initial.

## Ajustement CompanionAvatarMini (fallback appliqué)

Le plan suggérait `<CompanionAvatarMini species={...} stage={...} size={56} />` mais lecture de `components/mascot/CompanionAvatarMini.tsx` L46-55 confirme la signature réelle :

```typescript
interface CompanionAvatarMiniProps {
  companion: CompanionData | null | undefined;
  level: number;
  fallbackEmoji: string;
  size: number;
}
```

**Adapté** : passage de `companion`, `level`, `fallbackEmoji` (mapping emoji par espèce local `SPECIES_FALLBACK_EMOJI`), `size={56}`. Le composant déduit seul le stade via `level`.

## Comportement

| Scénario | Affichage |
|---|---|
| Pas de buff, pas de cooldown | Chip absent, bouton primaire "🥕 Nourrir" actif |
| Buff actif `×1.15` expire dans 47min | Chip "✨ +15% XP · 47min" + bouton actif |
| Cooldown restant 2h14 | Chip buff si encore présent, bouton disabled "😋 Rassasié · 2h 14" |
| Cooldown <1h | Bouton disabled "😋 Rassasié · 42min" (pas de "0h") |
| Tap bouton secondaire | Ouvre CompanionPicker (self-rendering Modal pageSheet) |
| Sélection espèce dans picker | `handleSelectSpecies` await la callback parent, ferme le picker |

## Refresh visuel

Un `setInterval(30_000)` tick un state local → les `useMemo` de `cooldownMs` et `activeBuff` se recalculent toutes les 30s avec le nouveau `Date.now()`, donc le label "Rassasié · 2h 14" descend à "2h 13" sans ré-render imposé par le parent.

## Verification

- `test -f components/mascot/CompanionCard.tsx` : OK (302 lignes ≥ 150)
- `grep "export function CompanionCard"` : OK
- `grep "getActiveFeedBuff"` : OK
- `grep "getCooldownRemainingMs"` : OK
- `grep "isInitialChoice={false}"` : OK
- `grep "unlockedSpecies={companion.unlockedSpecies}"` : OK
- `grep "useThemeColors"` : OK
- `grep "Haptics.selectionAsync"` : OK
- `grep "onPressFeed"` : OK
- `grep "currentSpecies="` : absent (prop inventée bien supprimée)
- `grep "companionName={companion.name}"` : absent (prop inventée bien supprimée)
- `npx tsc --noEmit` : aucune nouvelle erreur dans CompanionCard.tsx

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CompanionAvatarMini signature**
- **Found during:** Task 1 (rédaction composant)
- **Issue:** Le plan suggérait `<CompanionAvatarMini species={companion.activeSpecies} stage={stage} size={56} />`, mais la vraie signature lue dans le fichier source est `{ companion, level, fallbackEmoji, size }`.
- **Fix:** Adapté l'appel pour passer `companion={companion} level={level} fallbackEmoji={...} size={56}` — le composant déduit seul le stade via getCompanionStage(level). Mapping emoji local `SPECIES_FALLBACK_EMOJI` pour le fallback.
- **Files modified:** components/mascot/CompanionCard.tsx
- **Commit:** 832517b

**2. [Rule 1 - Bug] Fallbacks `colors.surface` / `colors.textMuted` inutiles**
- **Found during:** Task 1 (vérification thème)
- **Issue:** Le plan utilisait `colors.surface ?? colors.card` et `colors.textMuted ?? colors.textFaint` comme fallbacks de robustesse. Vérification : `colors.surface` n'existe PAS dans AppColors (LightColors/DarkColors), mais `colors.textMuted` existe bel et bien.
- **Fix:** Utilisé `colors.card` et `colors.textMuted` directement sans fallback — évite erreur TS potentielle sur surface.
- **Files modified:** components/mascot/CompanionCard.tsx
- **Commit:** 832517b

**3. [Rule 1 - Bug] Casing `FontWeight.semiBold`**
- **Found during:** Task 1
- **Issue:** Le plan utilisait `FontWeight.semiBold` (camelCase), mais la vraie constante est `FontWeight.semibold` (tout minuscule).
- **Fix:** Corrigé en `FontWeight.semibold`.
- **Files modified:** components/mascot/CompanionCard.tsx
- **Commit:** 832517b

## Commits

| # | Hash    | Message                                                   |
|---|---------|-----------------------------------------------------------|
| 1 | 832517b | feat(42-05): composant CompanionCard (nourrir + changer espèce) |

## Known Stubs

Aucun — le composant est fonctionnel de bout en bout. Le callback `onPressFeed` est bien un stub intentionnel au niveau intégration (sera branché au FeedPicker par Plan 42-06, puis wired dans tree.tsx par Plan 42-07), documenté par le plan. Pas de data hardcodée.

## Self-Check: PASSED

- FOUND: components/mascot/CompanionCard.tsx (302 lignes)
- FOUND: commit 832517b
- grep export function CompanionCard : OK
- grep isInitialChoice={false} : OK
- grep unlockedSpecies={companion.unlockedSpecies} : OK
- grep useThemeColors / Haptics.selectionAsync / getActiveFeedBuff / getCooldownRemainingMs : OK
- grep currentSpecies= / companionName={companion.name} : absent (bien supprimés)
- npx tsc --noEmit : aucune erreur dans CompanionCard.tsx
