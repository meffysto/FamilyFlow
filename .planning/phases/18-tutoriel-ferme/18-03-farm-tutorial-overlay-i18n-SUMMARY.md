---
phase: 18
plan: 03
subsystem: mascot/tutorial, i18n
tags: [tutoriel, farm, coach-mark, overlay, i18n, reanimated]
requires:
  - HelpContext.activeFarmTutorialStep (Plan 18-01)
  - WorldGridView.paused (Plan 18-01)
  - CoachMarkOverlay.borderRadius (Plan 18-02)
  - CoachMark existant
provides:
  - "FarmTutorialOverlay composant orchestrateur (5 étapes mixtes)"
  - "clés i18n help.farm_tutorial.* FR+EN"
affects:
  - "aucun consommateur actuel — sera intégré en Plan 18-04 (tree.tsx)"
tech-stack:
  added: []
  patterns:
    - "Format mixte : 2 cartes narratives plein écran + 3 coach marks contextuels orchestrés dans un seul composant"
    - "Fallback graceful : si cible non mesurable, rendu en carte narrative au lieu de planter"
    - "hasStarted.current ref reset via useEffect[seen] pour permettre relance via resetScreen() (Pitfall 2)"
    - "require statique TREE_SPRITES map pour compatibilité Metro bundler (pas de require dynamique)"
key-files:
  created:
    - components/mascot/FarmTutorialOverlay.tsx
  modified:
    - locales/fr/help.json
    - locales/en/help.json
decisions:
  - "Namespace i18n help: (avec : séparateur) par convention existante — Pitfall 4 respecté"
  - "Carte narrative utilise Pressable + View absolute au lieu de Modal RN — cohérent avec CoachMark déjà overlay"
  - "NarrativeCard sous-composant privé dans le même fichier (pas d'export) — réutilisation uniquement locale"
  - "Fallback carte narrative quand mesure cible échoue (étapes 1-3) plutôt que skip l'étape — utilisateur voit toujours le texte"
  - "step indicator N/5 affiché dans tous les footers (narratif + coach) — feedback de progression cohérent"
requirements: [TUTO-03, TUTO-04, TUTO-05, TUTO-07]
metrics:
  duration: "~5min"
  completed: 2026-04-08
tasks_completed: 2
tasks_total: 2
files_modified: 3
---

# Phase 18 Plan 03 : FarmTutorialOverlay + i18n — Summary

One-liner : Orchestrateur `FarmTutorialOverlay` qui pilote 5 étapes mixtes (2 cartes narratives plein écran + 3 coach marks rectangle arrondi) avec bouton Passer universel, déclenchement automatique 600ms après mount et relance possible via `resetScreen('farm_tutorial')`, plus 13 clés i18n FR+EN en parité stricte sous `help.farm_tutorial.*`.

## Objectif atteint

TUTO-03 (5 étapes), TUTO-04 (spotlight arrondi via `borderRadius=12` sur CoachMarkOverlay), TUTO-05 (skip visible à chaque étape), TUTO-07 (relance via reset du ref `hasStarted` en reaction au seen=false). Le composant est prêt à être consommé par Plan 18-04 (intégration dans `app/(tabs)/tree.tsx`).

## Tâches

### Task 1 : i18n help.farm_tutorial (FR + EN)

Ajouté à `locales/fr/help.json` et `locales/en/help.json` une section `farm_tutorial` avec 5 sous-objets step1..step5 (title + body chacun) et 3 labels boutons (skip, next, done). 13 clés au total, parité stricte vérifiée par script node (sort + stringify).

Textes FR : ton familier 2ᵉ personne singulier ("tu cultives", "tes cultures", "laisse-moi te montrer"). Textes EN : naturels ("Welcome to the farm!", "Let's go!"). Insérés juste avant la section `guide` existante pour préserver l'ordre.

Commit : `648ec10`

### Task 2 : FarmTutorialOverlay composant

Créé `components/mascot/FarmTutorialOverlay.tsx` (381 lignes) — orchestrateur sibling de ScreenGuide (D-08 : aucune modification de ScreenGuide).

**Structure** :
- Duplication locale `SPECIES_TO_FRUIT` et `TREE_SPRITES` (require statique) depuis TreeView.tsx (Pitfall 5 — évite le require dynamique non supporté par Metro)
- State `currentStep: number` (-1 = inactif) + `measuredRect: TargetRect | null`
- Ref `hasStarted` reset via `useEffect([seen])` → permet la relance quand `resetScreen('farm_tutorial')` est appelé
- Déclenchement initial : `setTimeout(600ms)` cohérent avec ScreenGuide
- Mesure cible : `measureInWindow` sur `targetRefs.plantation/harvest/hudXp` pour étapes 1, 2, 3
- Fallback graceful : si cible non mesurable, l'étape coach mark bascule en carte narrative

**Rendu** :
- Étapes 0 et 4 : `<NarrativeCard>` sous-composant privé — plein écran, backdrop noir 70%, carte centrée avec animation spring (opacity + scale) via Reanimated 4, sprite arbre dynamique à l'étape 0 (emoji 🌳 fallback si species inconnu) et gros emoji 📖 à l'étape 4
- Étapes 1-3 : `<CoachMarkOverlay borderRadius={12}>` + `<CoachMark>` en position below, titre+body via `t('help:farm_tutorial.stepN.title/body')`

**Handlers** :
- `handleNext` : hapt selection + avance ou marque seen+reset si étape 4
- `handleSkip` : hapt selection + markScreenSeen + reset step+active

**Conventions CLAUDE.md** :
- SPRING_CONFIG constante module (`{ damping: 12, stiffness: 140 }`)
- `useThemeColors()` pour toutes les couleurs (backdrop hardcodé `rgba(0,0,0,0.7)` considéré cosmétique comme les overlays existants)
- Reanimated 4 (pas RN Animated)
- `React.memo` sur l'export principal
- i18n namespace avec `:` (pas `.`) — Pitfall 4

**Props** :
```typescript
interface FarmTutorialOverlayProps {
  profile: { species?: string; tree?: string; [k: string]: any };
  targetRefs?: {
    plantation?: React.RefObject<View | null>;
    harvest?: React.RefObject<View | null>;
    hudXp?: React.RefObject<View | null>;
  };
}
```

Commit : `25b3eb8`

## Verification

- `node -e "parité FR/EN farm_tutorial"` → OK 13 keys
- `npx tsc --noEmit` → exit 0, aucune nouvelle erreur
- `grep "FarmTutorialOverlay"` trouve export
- `grep "setActiveFarmTutorialStep"` trouve setActive+null reset
- `grep "markScreenSeen.*SCREEN_ID"` trouve l'appel skip/done
- `grep "help:farm_tutorial"` → 8 occurrences (namespace `:`)
- `grep "react-native-svg"` → 0 occurrences (D-05bis respecté)
- `grep "from 'react-native'"` → n'importe pas `Animated`
- `grep "useThemeColors"` → 2 usages (import + hook call)
- `grep "borderRadius={12}"` → 1 occurrence (CoachMarkOverlay prop Plan 02)

## Deviations from Plan

**1. [Rule 3 - Blocking] FontSize.xl n'existait pas**
- **Found during:** Task 2 vérification tsc
- **Issue:** Le plan suggérait des tailles de police mais le constants/typography.ts n'exporte pas `FontSize.xl` — erreur TS2339
- **Fix:** Remplacé par `FontSize.title` (20px) qui correspond sémantiquement au titre narratif
- **Files modified:** components/mascot/FarmTutorialOverlay.tsx
- **Commit:** inclus dans 25b3eb8 (fix appliqué avant commit initial)

**2. [Amplification mineure] Prop `position="below"` ajoutée aux CoachMark**
- L'API CoachMark réelle exige `position: 'above' | 'below'` (pas optionnel) — le plan ne le mentionnait pas explicitement dans l'exemple de code
- `below` choisi pour les 3 cibles (plantation, harvest, hudXp) car elles sont visuellement dans la partie haute/centrale de l'écran ferme
- Plan 18-04 pourra ajuster si nécessaire lors de l'intégration réelle

## Known Stubs

Aucun stub bloquant. Le composant est fonctionnellement complet mais non intégré — l'intégration dans `tree.tsx` est explicitement le scope du Plan 18-04. Les `targetRefs` sont optionnels et documentés ; en leur absence, les étapes 1-3 basculent en mode narratif fallback.

## Success Criteria

- [x] TUTO-03 : 5 étapes orchestrées (0-4 avec mix narratif/coach)
- [x] TUTO-04 : CoachMarkOverlay reçoit borderRadius=12
- [x] TUTO-05 : handleSkip exposé dans NarrativeCard footer + CoachMark onDismiss
- [x] TUTO-07 : pattern hasStarted.current reset via useEffect[seen]
- [x] tsc clean
- [x] i18n parité FR/EN 13 clés

## Self-Check: PASSED

- FOUND: components/mascot/FarmTutorialOverlay.tsx
- FOUND: locales/fr/help.json (farm_tutorial ajouté)
- FOUND: locales/en/help.json (farm_tutorial ajouté)
- FOUND commit: 648ec10 (Task 1)
- FOUND commit: 25b3eb8 (Task 2)
