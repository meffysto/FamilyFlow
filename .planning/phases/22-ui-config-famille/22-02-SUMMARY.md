---
phase: 22-ui-config-famille
plan: "02"
subsystem: components/settings
tags: [semantic-coupling, settings-ui, master-toggle, category-rows, stats, badges, i18n]
dependency_graph:
  requires: [22-01-coupling-overrides-module, phase-21-effect-toasts, phase-19-categories]
  provides: [settings-coupling-screen, coupling-ui-wired]
  affects: [app/(tabs)/settings.tsx]
tech_stack:
  added: []
  patterns: [React.memo-list-items, Promise.all-parallel-async, fire-and-forget-save, opacity-disabled-pattern]
key_files:
  created:
    - components/settings/SettingsCoupling.tsx
  modified:
    - app/(tabs)/settings.tsx
decisions:
  - "Badge variant inline (View+Text) sans Badge.tsx — evite couplage composant generique sur couleurs semantiques specifiques"
  - "DISPLAY_ORDER golden>rare>ambient — ordre visuel par importance percue de l'effet"
  - "opacity 0.4 + pointerEvents none sur le container categories quand master OFF — pattern natif sans Reanimated pour simplicite"
  - "Handlers fire-and-forget (void prefix) — consistant avec pattern SecureStore du codebase (aucun await dans les handlers UI)"
metrics:
  duration: "2min"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 2
requirements_satisfied: [COUPLING-01, COUPLING-02, COUPLING-04]
---

# Phase 22 Plan 02: SettingsCoupling UI — Ecran Couplage Semantique Summary

**One-liner:** Composant SettingsCoupling.tsx complet avec master toggle + 10 category rows ordonnees par variant tier + badges colores inline + stats semaine + cable dans settings.tsx entre gamification et automations.

## What Was Built

### components/settings/SettingsCoupling.tsx (nouveau — 354 lignes)

Composant ecran complet couplage semantique :

- **Master toggle** : lit `isSemanticCouplingEnabled()` au mount, ecrit `setSemanticCouplingEnabled()` au toggle (fire and forget). Affiche le total des effets de la semaine.
- **10 CategoryRow** (React.memo) en `DISPLAY_ORDER` golden > rare > ambient :
  - `bebe_soins`, `rendez_vous` (golden — 2 entrees)
  - `budget_admin`, `cuisine_repas`, `gratitude_famille` (rare — 3 entrees)
  - `courses`, `enfants_devoirs`, `enfants_routines`, `menage_hebdo`, `menage_quotidien` (ambient — 5 entrees)
- **Par row** : icone emoji (EFFECT_TOASTS[catId].icon), label (CATEGORY_LABEL[catId][lang]), description (toast.fr ou .en selon langue), badge variant colore inline, compteur semaine, Switch.
- **Badge variant inline** : `backgroundColor: variantColor + '33'` (20% opacity hex), `color: variantColor` — sans Badge.tsx (Research anti-pattern evite).
- **Langue** : `i18n.language?.startsWith('en') ? 'en' : 'fr'` pour EFFECT_TOASTS et CATEGORIES labels.
- **Disabled master** : container categories avec `opacity: 0.4` + `pointerEvents: 'none'` + hint texte secondaire.
- **Chargement async** : `Promise.all([isSemanticCouplingEnabled(), loadOverrides(), loadWeekStats()])` en parallele avec mounted guard. ActivityIndicator pendant le chargement.
- **Styles** : `StyleSheet.create({})` statique en bas de fichier. Couleurs via `useThemeColors()`. Tokens `Spacing`, `Radius`, `FontSize`, `FontWeight`, `Shadows`.

### app/(tabs)/settings.tsx (modifie — 5 modifications chirurgicales)

1. **Import** : `import { SettingsCoupling } from '../../components/settings/SettingsCoupling'`
2. **SectionId** : `'coupling'` ajoute entre `'gamification'` et `'automations'`
3. **sectionTitles** : `coupling: t('settingsScreen.modalTitles.coupling')`
4. **SettingsRow coupling** : emoji 🔗, titre/sous-titre depuis i18n, rendue uniquement si `!isChildMode`, inseree entre gamification et automations
5. **Modal rendering** : `{activeSection === 'coupling' && <SettingsCoupling />}` avant automations

## Commits

| Task | Nom | Commit | Fichiers |
|------|-----|--------|----------|
| 1 | Creer SettingsCoupling.tsx | f1343a6 | components/settings/SettingsCoupling.tsx |
| 2 | Cabler SettingsCoupling dans settings.tsx | 2043cb9 | app/(tabs)/settings.tsx |

## Decisions Made

1. **Badge inline sans Badge.tsx** — Le composant Badge.tsx du codebase est generique et ne supporte pas les couleurs dynamiques par string hex arbitraire. Inline View+Text avec `variantColor + '33'` (suffix hex 20% opacity) est la solution la plus simple et directe.
2. **DISPLAY_ORDER golden > rare > ambient** — L'utilisateur voit d'abord les effets les plus spectaculaires (bebe_soins golden, rendez_vous golden), puis les effets speciaux (rare), puis les effets courants (ambient). Ordre par valeur percue, pas par ID canonique.
3. **opacity + pointerEvents natif** — Pattern simple sans react-native-reanimated pour le disabled state du container. L'animation n'est pas necessaire ici, le toggle master est instantane.
4. **Handlers fire-and-forget** — `void setSemanticCouplingEnabled(val)` et `void saveOverrides(next)` — pattern consistant avec flag.ts et coupling-overrides.ts qui ne throwent pas (try/catch interne). L'UI est mise a jour immediatement en state local.

## Deviations from Plan

None — plan execute exactement comme ecrit.

## Known Stubs

None — toutes les donnees sont lues depuis les modules reels (coupling-overrides.ts, flag.ts, categories.ts, effect-toasts.ts, HarvestBurst.tsx). Les cles i18n (settingsScreen.rows.coupling, settingsScreen.modalTitles.coupling, settings.coupling.*) ont ete creees en Plan 01.

## Self-Check: PASSED

- `components/settings/SettingsCoupling.tsx` — FOUND (354 lignes, > 120 min)
- `app/(tabs)/settings.tsx` contient 'coupling' SectionId, sectionTitles, SettingsRow, modal — FOUND
- Commits f1343a6, 2043cb9 — FOUND
- `npx tsc --noEmit` — PASSED (0 nouvelles erreurs)
- Acceptance criteria Task 1 (10/10) — PASSED
- Acceptance criteria Task 2 (4/4) — PASSED
