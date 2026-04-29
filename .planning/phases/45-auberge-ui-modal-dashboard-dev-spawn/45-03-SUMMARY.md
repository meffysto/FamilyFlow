---
phase: 45-auberge-ui-modal-dashboard-dev-spawn
plan: 03
subsystem: dashboard/auberge
tags: [auberge, dashboard, ui, mascot, conditional-card]
requires:
  - components/mascot/AubergeSheet.tsx (Phase 45-02)
  - hooks/useAuberge.ts (Phase 43-04 + Phase 45-01 forceSpawn)
  - lib/mascot/auberge-engine.ts (getRemainingMinutes)
  - lib/mascot/visitor-catalog.ts (VISITOR_CATALOG)
  - components/DashboardCard.tsx
provides:
  - components/dashboard/DashboardAuberge.tsx (export DashboardAuberge)
affects:
  - app/(tabs)/index.tsx (registration + zone + render switch)
  - components/dashboard/index.ts (barrel export)
tech-stack:
  added: []
  patterns:
    - section dashboard conditionnelle (return null si feature non activée)
    - pulse Reanimated léger (withRepeat + withSequence) avec respect useReducedMotion
    - lookup map FR locale réutilisée du pattern AubergeSheet (Plan 45-02)
    - couleurs sémantiques timer constantées (alignées AubergeSheet)
    - délégation SectionErrorBoundary au parent app/(tabs)/index.tsx
key-files:
  created:
    - components/dashboard/DashboardAuberge.tsx (308 lignes)
  modified:
    - components/dashboard/index.ts (+1 ligne export)
    - app/(tabs)/index.tsx (+5 lignes : import, getAllSections, SECTION_ZONE, CHILD_PROMOTED, switch)
decisions:
  - "Pas de wrap SectionErrorBoundary interne : le parent app/(tabs)/index.tsx ligne 1231 wrap déjà toutes les sections rendues via renderSection — pattern partagé avec DashboardGarden, DashboardCompanionDay, etc. Évite double wrap."
  - "Couleur de carte : colors.catFamille (terracotta) — colors.catSocial n'existe pas dans le palette (LightColors n'a que catOrganisation/Sante/Souvenirs/Jeux/Famille/Systeme). catFamille est sémantiquement le plus proche pour une feature 'PNJ qui rendent visite'."
  - "VISITOR_NAMES_FR (map locale) plutôt que d'importer VISITOR_LABELS_FR depuis AubergeSheet : évite couplage cross-component, copies courtes (juste le nom, pas la bio)."
  - "URGENT_THRESHOLD_MIN=120 (2h, déclenche pulse + couleur rouge), AMBER_THRESHOLD_MIN=360 (6h, couleur ambre) — alignés sur le pattern AubergeSheet (TIMER_AMBER/TIMER_RED) pour cohérence visuelle entre dashboard et modal."
  - "Pulse léger (1.04 scale, 750ms in/out via withSequence + withRepeat infinite) actif uniquement si hasAuberge && hasUrgent && !reducedMotion — cancelAnimation au unmount et changement d'état pour éviter fuites."
  - "Préview limitée à 2 visiteurs (les plus urgents en premier) + label '+N autres' si overflow — maintient la carte compacte dans le dashboard."
  - "CHILD_PROMOTED['auberge'] = { visible: true, priority: 'high' } : l'auberge est gameplay enfant-friendly (pas de contenu adulte, contrairement à courses/budget/quicknotifs)."
metrics:
  duration: ~12min
  completed: 2026-04-29
  tasks: 2
  files: 3
---

# Phase 45 Plan 03: DashboardAuberge — carte dashboard conditionnelle Summary

Créé `components/dashboard/DashboardAuberge.tsx` (308 lignes) — carte dashboard conditionnelle qui n'apparaît que si l'auberge est construite, affiche un aperçu des 1-2 visiteurs les plus urgents avec timer coloré, ouvre `AubergeSheet` (Plan 45-02) via state local, et pulse légèrement si un timer descend sous 2h.

## What Changed

- **`components/dashboard/DashboardAuberge.tsx`** (créé)
  - Export `DashboardAuberge = React.memo(DashboardAubergeInner)` consommant `DashboardSectionProps`.
  - Détection auberge construite : `Array.isArray(activeProfile?.farmBuildings)` + `.some(b => b.buildingId === 'auberge')`. Si absent → `return null` (carte invisible).
  - Header `DashboardCard` titre dynamique `"🛖 Auberge — N visiteur(s)"` (sans suffixe si 0), `color={colors.catFamille ?? primary}`, `tinted`, `collapsible`, `cardId="auberge"`.
  - Liste compacte `VisitorRow` (memo) : emoji 28px (depuis `VISITOR_CATALOG`) + nom FR (lookup map locale `VISITOR_NAMES_FR`) + meta `"N items demandés"` + timer coloré ambre/rouge.
  - Tri ascending par `getRemainingMinutes` (les plus urgents en premier), tronqué à 2.
  - Label `"+N autres visiteurs"` si overflow.
  - Empty state centré (emoji 🛖 36px, texte italique muted "L'auberge est calme... un visiteur arrivera bientôt.") si `activeVisitors.length === 0`.
  - CTA `TouchableOpacity` `"Voir l'auberge · ❤ totalReputation"` (compteur omis si 0) → `setSheetOpen(true)`.
  - Pulse Reanimated : `useSharedValue(1)` + `useAnimatedStyle({transform:[{scale}]})`, déclenché par `useEffect` quand `hasAuberge && hasUrgent && !reducedMotion`. Pattern `withRepeat(withSequence(withTiming(1.04, 750), withTiming(1, 750)), -1, false)`. `cancelAnimation` au cleanup et changement de conditions.
  - Sheet rendue conditionnellement : `<AubergeSheet visible={sheetOpen} onClose={handleClose} />`.

- **`components/dashboard/index.ts`** (modifié)
  - Ajout `export { DashboardAuberge } from './DashboardAuberge';` après `DashboardCompanionDay`.

- **`app/(tabs)/index.tsx`** (modifié — 5 emplacements)
  - Import : ajout `DashboardAuberge,` dans le bloc d'imports `from '../../components/dashboard'`.
  - `getAllSections()` : entrée `{ id: 'auberge', label: '🛖 Auberge', emoji: '🛖', visible: true, priority: 'high', size: 'full' }` insérée juste après `companionDay`.
  - `SECTION_ZONE` : `auberge: 'farm'` (regroupé avec garden/companionDay).
  - `CHILD_PROMOTED` : `auberge: { visible: true, priority: 'high' }` (gameplay enfant-friendly).
  - `renderSection` switch : `case 'auberge': return <DashboardAuberge key={id} {...sectionProps} />;` avant `default`.

## Why This Approach

- **Conditional render à l'intérieur du composant** plutôt qu'au niveau de l'orchestrateur : chaque utilisateur peut avoir un état différent (auberge construite ou pas), et la décision dépend de `activeProfile.farmBuildings` qui change à la volée. Garder le check dans le composant lui-même évite de polluer le sélecteur de sections du dashboard avec une logique de feature flag par profil.
- **Pas de toggle modal séparé** : le système Préférences existant (`DashboardPrefsModal` lit le tableau `getAllSections()`) gère déjà la visibilité — pas besoin de câbler manuellement. L'utilisateur peut masquer la carte via les préférences même si l'auberge est construite. La double-gate (préférences ET feature présence) est intentionnelle.
- **Délégation `SectionErrorBoundary` au parent** : `app/(tabs)/index.tsx` ligne 1231 wrap toutes les sections rendues. Wrapper localement créerait un double bouclier inutile et casserait la cohérence avec les autres dashboards (DashboardGarden, DashboardCompanionDay, etc. ne wrappent pas non plus en interne).
- **Pulse léger plutôt qu'un badge** : la carte est déjà signalée par son contenu (timer rouge sur les visiteurs urgents). Un badge supplémentaire ferait redondance. Le pulse reste discret (1.04 max, transitions douces) et respecte `useReducedMotion`.

## Deviations from Plan

Aucune déviation fonctionnelle. Le plan suggérait d'utiliser `colors.catSocial` qui n'existe pas dans `LightColors/DarkColors` — fallback documenté sur `colors.catFamille` (terracotta). Le plan mentionnait aussi `VisitorCard` simplifié vs catalog — j'ai fait un sous-composant memo `VisitorRow` au lieu d'inline pour cohérence avec les autres dashboards (memo sur list items, CLAUDE.md).

Le champ `ActiveVisitor` est `request` (et non `requestItems` comme suggéré dans certaines docs internes) — vérifié sur `lib/mascot/types.ts:600`, code adapté.

## Verification

- `npx tsc --noEmit` : "TypeScript compilation completed" — aucune nouvelle erreur.
- `git status --short` : ne liste que les 3 fichiers attendus (`components/dashboard/DashboardAuberge.tsx`, `components/dashboard/index.ts`, `app/(tabs)/index.tsx`).
- `wc -l components/dashboard/DashboardAuberge.tsx` : 308 lignes (≥ 150 requis, ≥ 120 minimum).
- `grep -n "if (!hasAuberge) return null"` : 1 match (ligne 181).
- `grep -c "AubergeSheet"` : 6 matches (import + JSX usage + commentaires).
- `grep -n "DashboardAuberge\|'auberge'" "app/(tabs)/index.tsx"` : 4 matches (import, getAllSections entry, SECTION_ZONE, renderSection case) + CHILD_PROMOTED entry.
- Aucune couleur hardcoded à part `TIMER_AMBER`/`TIMER_RED` (déjà autorisées par CLAUDE.md, alignées AubergeSheet).
- `useThemeColors()` utilisé pour : `primary`, `tint`, `colors.text`, `colors.textMuted`, `colors.borderLight`, `colors.cardAlt`, `colors.catFamille`.

## Commits

- `803cc29` — feat(45-03): ajoute DashboardAuberge — carte dashboard conditionnelle

## Self-Check: PASSED

- FOUND: components/dashboard/DashboardAuberge.tsx
- FOUND: components/dashboard/index.ts (export ajouté)
- FOUND: app/(tabs)/index.tsx (5 emplacements modifiés)
- FOUND: commit 803cc29
