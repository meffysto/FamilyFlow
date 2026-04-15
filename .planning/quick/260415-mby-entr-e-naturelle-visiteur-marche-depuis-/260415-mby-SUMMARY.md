---
phase: quick-260415-mby
plan: "01"
subsystem: mascot/visitor
tags: [animation, visitor, VisitorSlot, direction, sprite-flip]
dependency_graph:
  requires: []
  provides: [entrée-directionnelle-visiteur]
  affects: [components/mascot/VisitorSlot.tsx]
tech_stack:
  added: []
  patterns: [enterFromLeft-condition, flipForEntry-state, dynamic-ENTRY_X]
key_files:
  created: []
  modified:
    - components/mascot/VisitorSlot.tsx
decisions:
  - enterFromLeft calculé via effectiveFX < 0.5 — saisonnier (gauche) vs saga (droite)
  - opacity.value = 1 direct (pas withTiming) — le personnage est hors-écran, pas de fade nécessaire
  - posX.value = ENTRY_X avant le spring — useSharedValue(ENTRY_X) ne se met pas à jour après le premier render
  - flipForEntry reset dans le callback finished du spring — transition propre vers idle sans flip résiduel
  - setFlipForDepart(!enterFromLeft) — flip départ uniquement si direction vers la droite (saga)
metrics:
  duration: 5min
  completed: 2026-04-15
  tasks: 1
  files: 1
---

# Quick Task 260415-mby: Entrée naturelle du visiteur depuis hors-écran

**One-liner:** Entrée directionnelle du visiteur depuis hors-écran (gauche ou droite selon targetFX) sans fade-in, avec flip sprite correct à l'entrée et au départ.

## What Was Built

VisitorSlot.tsx modifié pour que l'animation d'entrée du visiteur soit naturelle et directionnelle :

- **Visiteur saga** (targetFX=0.72, > 0.5) : entre par la droite, marche vers la gauche (sprites normaux), repart vers la droite (flip scaleX: -1)
- **Visiteur saisonnier** (targetFX=0.28, < 0.5) : entre par la gauche, marche vers la droite (flip scaleX: -1), repart vers la gauche (pas de flip)
- Aucun fade-in — opacité 1 immédiate, le personnage est simplement hors-écran et marche dans la map

## Changes

### components/mascot/VisitorSlot.tsx

**Variables ajoutées (positions calculées) :**
```typescript
const effectiveFX = propTargetFX ?? TARGET_FX;
const enterFromLeft = effectiveFX < 0.5;
const ENTRY_X = enterFromLeft ? -VISITOR_SIZE : containerWidth * 1.15;
const DEPART_X = enterFromLeft ? -VISITOR_SIZE * 1.5 : containerWidth * 1.20;
```

**State ajouté :**
```typescript
const [flipForEntry, setFlipForEntry] = useState(false);
```

**useEffect entrée (was: fade-in + spring depuis droite fixe) :**
```typescript
posX.value = ENTRY_X;        // position hors-écran correcte
opacity.value = 1;           // direct, pas withTiming
setFlipForEntry(enterFromLeft);
posX.value = withSpring(TARGET_X, SPRING_WALK, (finished) => {
  if (finished) {
    runOnJS(setFlipForEntry)(false); // reset quand idle
    ...
  }
});
```

**Départ :**
```typescript
setFlipForDepart(!enterFromLeft); // flip seulement si départ vers la droite
```

**Image :**
```typescript
(flipForDepart || flipForEntry) ? { transform: [{ scaleX: -1 }] } : {}
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] components/mascot/VisitorSlot.tsx modifié
- [x] Commit 51aa26e existe
- [x] npx tsc --noEmit — aucune nouvelle erreur (3 erreurs ExpeditionsSheet.tsx pré-existantes ignorées per CLAUDE.md)

## Self-Check: PASSED
