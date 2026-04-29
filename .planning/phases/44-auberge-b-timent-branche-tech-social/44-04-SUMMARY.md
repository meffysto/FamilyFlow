---
phase: 44-auberge-b-timent-branche-tech-social
plan: 04
subsystem: mascot/farm/ui
tags: [ui, building-detail, branchement, retrocompat, non-productif]
requires:
  - "44-01 (BuildingDefinition.producesResource)"
provides:
  - "BuildingDetailSheet gère 2 modes : productif (existant) + non-productif (placeholder gracieux)"
affects:
  - components/mascot/BuildingDetailSheet.tsx
tech-stack:
  added: []
  patterns:
    - "Branchement conditionnel sur def.producesResource (default-treat undefined === true, rétrocompat)"
    - "Wrap React fragment dans ternaire pour switcher entre 2 sous-arbres UI sans casser les delays d'animation"
key-files:
  created: []
  modified:
    - components/mascot/BuildingDetailSheet.tsx
key-decisions:
  - "Texte FR direct dans le placeholder (pas d'i18n key réservée — choix discrétionnaire confirmé par CONTEXT.md, sera remplacé par CTA → AubergeSheet en Phase 45)"
  - "Panneau upgrade conservé même pour bâtiment non-productif (l'auberge sera upgradable via tech social-2 et social-3)"
  - "Banner toit endommagé caché pour non-productif (le wear n'a pas de sens sans production)"
  - "Override subtitle 'Bâtiment social' au lieu de 'Production d'œufs' (resourceType='oeuf' est requis par le type mais non-pertinent pour l'auberge)"
requirements-completed: []
metrics:
  duration: "~5 min"
  completed: 2026-04-29
---

# Phase 44 Plan 04: BuildingDetailSheet — affichage gracieux non-productif Summary

Branchement UI rétrocompatible dans `BuildingDetailSheet.tsx` qui détecte les bâtiments avec `producesResource: false` (Auberge & co.) et substitue le hero card production + CTA collecte par un placeholder informatif "Voir l'intérieur prochainement", tout en conservant le panneau d'upgrade. Aucune régression sur les 4 bâtiments existants.

## What Was Built

### Modifications dans `BuildingDetailSheet.tsx`

1. **Variable de garde** — ligne 291, juste après `if (!def) return null;` :
   ```typescript
   const isProductive = def.producesResource !== false;
   ```
   Default-treat `undefined === true` → poulailler/grange/moulin/ruche restent productifs.

2. **Override subtitle** — ligne 333 :
   ```typescript
   const titleSubtitle = isProductive ? labels.subtitle : 'Bâtiment social';
   ```
   Évite l'affichage erroné "Production d'œufs" pour l'auberge (qui a `resourceType: 'oeuf'` uniquement par contrainte de type).

3. **Banner toit endommagé** — wrap conditionnel : `{isProductive && isDamaged && onRepairRoof && (...)}`. Le wear n'est pas pertinent pour un bâtiment social.

4. **Hero card + CTA collecte** — wrappés dans un ternaire `{isProductive ? (<>...</>) : (<placeholder />)}`. Le placeholder est un `Animated.View` avec :
   - Icône emoji 🛖 (32px)
   - Titre "Bâtiment social" (15px, bold 800)
   - Body : *"Ce bâtiment ne produit pas de ressources passives. Voir l'intérieur prochainement."*
   - Animation `FadeIn.delay(100).springify()` cohérente avec le hero card existant.

5. **Panneau upgrade** — inchangé (lignes existantes), affiché dans tous les cas.

6. **4 styles ajoutés** en fin de StyleSheet : `nonProductiveCard`, `nonProductiveIcon`, `nonProductiveTitle`, `nonProductiveBody`. Pattern aligné avec les autres cards du fichier (T.surface2, T.accentLine, Spacing.xl, Shadows.sm).

## Verification

| Check | Result |
|-------|--------|
| `grep "isProductive" components/mascot/BuildingDetailSheet.tsx` | 4 occurrences (déclaration + subtitle + banner + ternaire) |
| `grep "nonProductiveCard"` | 2 (style + usage) |
| `grep "Voir l'intérieur prochainement"` | 1 (placeholder body) |
| `grep "Bâtiment social"` | 2 (subtitle override + titre placeholder) |
| `npx tsc --noEmit` | 1 erreur pré-existante dans TechTreeSheet.tsx (Plan 44-03 baseline, NON introduite par ce commit). Mes changements isolés : 0 nouvelle erreur. |
| Rétrocompat | Confirmée : `producesResource` undefined sur les 4 bâtiments existants → `isProductive = true` → comportement strictement préservé. |
| Vérification visuelle dev-client | Non effectuée — Phase 45 livre la vraie UI Auberge ; l'affichage Phase 44 est intermédiaire. Type-check + cohérence logique suffisent. |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | e577d7f | `feat(44-04): BuildingDetailSheet — affichage gracieux non-productif (auberge)` |

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Notes

- **Wave parallèle (Wave 2)** : Plan 44-02 (parallel) modifie `lib/mascot/types.ts` et `locales/fr/common.json` ; mon commit ne touche que `components/mascot/BuildingDetailSheet.tsx`. Aucune collision.
- **Commit avec `--no-verify`** comme requis pour wave parallèle (évite les fights de pre-commit hooks entre agents).
- **Erreur TS pré-existante** dans `TechTreeSheet.tsx:330` (Plan 44-03 a ajouté `'social'` à `TechBranchId` mais TechTreeSheet ne l'a pas encore typé) — hors scope (Phase 44-03's responsibility ou Phase 45).
- **Aucune couleur hardcodée** introduite : tous les styles utilisent les tokens `T.*` du module (qui est lui-même une constante du fichier — pas un theme dynamique mais cohérent avec le pattern existant du composant qui n'utilise pas `useThemeColors()`).
- **Phase 45** remplacera le placeholder par un CTA secondaire "Entrer dans l'auberge →" qui ouvrira `AubergeSheet`.

## Self-Check: PASSED

- components/mascot/BuildingDetailSheet.tsx → modifié (51 insertions, 3 deletions)
- 4 occurrences `isProductive` confirmées
- Texte placeholder "Voir l'intérieur prochainement" présent
- 4 styles `nonProductive*` ajoutés en fin de StyleSheet
- Commit e577d7f → présent dans `git log`
- `npx tsc --noEmit` → aucune nouvelle erreur introduite
