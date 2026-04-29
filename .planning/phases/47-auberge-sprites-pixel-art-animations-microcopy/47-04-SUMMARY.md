---
phase: 47-auberge-sprites-pixel-art-animations-microcopy
plan: 04
subsystem: mascot/auberge
tags: [animation, reanimated, microcopy, polish, ux]
requirements:
  - AUBERGE-DELIVERY-ANIMATION
  - AUBERGE-MICROCOPY-POLISH
dependency-graph:
  requires:
    - 47-03 (loose ends + theme colors timer + lootChance snapshot)
  provides:
    - Animation festive de livraison Reanimated dans AubergeSheet
    - Microcopy revue (empty states, bios PNJ, toast, notifs)
  affects:
    - components/mascot/AubergeSheet.tsx
    - components/dashboard/DashboardAuberge.tsx
    - lib/scheduled-notifications.ts
tech-stack:
  added: []
  patterns:
    - useSharedValue + useAnimatedStyle + withSequence/withSpring/withTiming
    - useReducedMotion gating pour accessibilité
    - Trigger optimiste (compteur par instanceId) — l'animation démarre avant le démontage
key-files:
  created: []
  modified:
    - components/mascot/AubergeSheet.tsx
    - components/dashboard/DashboardAuberge.tsx
    - lib/scheduled-notifications.ts
decisions:
  - Trigger anim optimiste (avant await deliverVisitor) → garantit que l'effet joue avant que le visiteur soit retiré du state
  - SPRING_CONFIG = { damping: 10, stiffness: 180 } module-level (pattern CLAUDE.md)
  - Particule "+X 🍃" en absolute positionné top: 8, alignSelf center → lisible sans casser la mise en page de la card
  - overflow: 'hidden' sur la card pour clipper le flash overlay aux bords arrondis
  - useReducedMotion court-circuite l'animation (pas de fallback partiel — soit tout, soit rien)
metrics:
  duration: ~10min
  completed: 2026-04-29
  tasks: 2
  files: 3
  commits: 2
---

# Phase 47 Plan 04: Animations livraison + microcopy polish Summary

Animation festive Reanimated lors de la livraison d'un visiteur (scale + flash + particule "+X 🍃" qui flotte) ; microcopy enrichie sur les empty states, bios PNJ, toast nominatif et notifs Auberge.

## What Was Built

### Animation livraison (AubergeSheet.tsx)

Au moment où l'utilisateur tape "Livrer", la carte du visiteur joue trois animations parallèles :

1. **Scale bounce** — `withSequence(withTiming(1.15, 150ms), withSpring(1, SPRING_CONFIG))`
2. **Flash overlay** — un voile `colors.success` qui passe de 0 → 0.4 → 0 sur 500ms (couvert par `StyleSheet.absoluteFill` + `borderRadius: Radius.lg` + `overflow: 'hidden'` sur la card)
3. **Particule "+X 🍃"** — texte en absolute positionné `top: 8, alignSelf: 'center'`, qui flotte de `translateY: 0 → -50` sur 600ms avec un fade in/out

Total : ~600-700ms. Trigger contrôlé par un compteur `deliveryTriggers[instanceId]` incrémenté **avant** `await deliverVisitor` (optimiste) → garantit que l'effet joue même si le moteur retire le visiteur immédiatement.

`useReducedMotion()` court-circuite tout (skip silencieux, livraison instantanée comme avant).

### Toast nominatif

Avant : `Livré ! +X 🍃`
Après : `<Nom du visiteur> repart ravi(e) ! +X 🍃 [+ 🎁]`

Lookup via `VISITOR_LABELS_FR[visitor.visitorId].name` avec fallback sur `def.id`.

### Microcopy

**Empty state AubergeSheet :**
> L'auberge est paisible ce soir
> Quelqu'un poussera la porte d'ici peu — fais bouillir l'eau du thé.

**Empty state DashboardAuberge :**
> Tout est calme à l'auberge — un voyageur est en chemin.

**Bios des 6 PNJ** (1 ligne, ton varié) :
- **Hugo le boulanger** : Son four ronfle déjà — il lui faut juste farine et œufs frais.
- **Mémé Lucette** : Mijote une soupe pour ses petits — lait et légumes feront l'affaire.
- **Yann l'apiculteur** : Parle à ses abeilles ; troque volontiers son miel contre le tien.
- **La Voyageuse** : Fait halte avant de repartir — un bouquet ou une soupe suffira.
- **Le Marchand ambulant** : Toujours preneur d'un crafté de qualité — il paie en sonnant.
- **La Comtesse** : Sa carriole patiente dehors. Elle ne descend que pour le très raffiné.

**Notifs Auberge** (`lib/scheduled-notifications.ts`) :

Arrival :
- title : `${emoji} ${visitorName} pousse la porte`
- body  : `Une commande l'attend — ${deadlineHours}h pour l'honorer.`

Reminder (H-4) :
- title : `⏰ ${emoji} ${visitorName} s'impatiente`
- body  : `Plus que 4h avant son départ — la commande t'attend toujours.`

## Files Touched

| File | Change |
| --- | --- |
| `components/mascot/AubergeSheet.tsx` | +101 −11 — animation livraison Reanimated, trigger map, toast nominatif, bios polies, empty state, particule overlay |
| `components/dashboard/DashboardAuberge.tsx` | +1 −1 — empty state plus chaleureux |
| `lib/scheduled-notifications.ts` | +4 −4 — copies arrival/reminder polies |

## Commits

- `53d956e` — feat(47-04): animation livraison Reanimated + microcopy AubergeSheet
- `c0f93f8` — feat(47-04): microcopy polish empty state dashboard + notifs Auberge

## Verification

- `npx tsc --noEmit` — clean (aucune erreur introduite ; les warnings pré-existants restent inchangés)
- `npx jest auberge --no-coverage` — **64 tests passent** (3 suites : auberge-engine, parser-auberge, auberge-auto-tick)
- Animation contrôlée par useEffect listening sur `deliverTrigger` — pas de risque de double-déclenchement (compteur unique)
- `useReducedMotion` testé via la branche : `if (reducedMotion) return` → animation skipped, livraison reste fonctionnelle
- Aucun hex hardcodé introduit (toutes couleurs via `colors.success`, `colors.text`, etc.)
- Pas de bump CACHE_VERSION nécessaire (changements UI/microcopy uniquement, aucune shape de type cachée modifiée)

## Deviations from Plan

None — plan exécuté tel qu'écrit. Les deux checkpoints `human-verify` ont été auto-approuvés (auto mode actif), conformément à la consigne.

## Self-Check: PASSED

- File `components/mascot/AubergeSheet.tsx` modifié : FOUND
- File `components/dashboard/DashboardAuberge.tsx` modifié : FOUND
- File `lib/scheduled-notifications.ts` modifié : FOUND
- Commit `53d956e` : FOUND
- Commit `c0f93f8` : FOUND
- tsc clean, 64 tests Auberge passent
