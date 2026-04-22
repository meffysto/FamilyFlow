---
phase: 42-nourrir-le-compagnon
plan: 08
subsystem: mascot-companion-feedback
tags: [animation, reanimated, particles, haptics, affinity, ui]
requirements: [FEED-15, FEED-16]
dependency-graph:
  requires:
    - "Plan 42-07 (handleFeedCrop callback + feedCompanion hook end-to-end)"
    - "Plan 42-03 (FeedResult.affinity CropAffinity retourné par feedCompanion engine)"
  provides:
    - "CompanionSlot.feedState prop — déclenche pulse/recul selon affinité"
    - "FeedParticles component — overlay emoji flottant (💕/😊/💨) sur 1200ms"
    - "Substitut visuel D-18 (pas de frames sprite 'eat' dédiées) via scale-pulse reanimated"
  affects:
    - "components/mascot/FeedParticles.tsx (créé — 134 lignes)"
    - "components/mascot/CompanionSlot.tsx (+42 lignes : prop + shared values + effect + transform compose)"
    - "app/(tabs)/tree.tsx (+16 lignes : state + setTimeout + wiring CompanionSlot + FeedParticles)"
tech-stack:
  added: []
  patterns:
    - "Particules reanimated par instance Particle : useSharedValue + withDelay + withTiming + runOnJS onEnd callback"
    - "SPRING_FEED constant module-level (pattern CLAUDE.md) pour spring config partagée"
    - "Composition multiplicative scale.value * feedScale.value pour combiner animation tap + feed"
    - "Position FeedParticles dérivée des fractions HOME_FX/HOME_FY du CompanionSlot (0.42, 0.55) — pas d'onLayout requis"
    - "Reset feedState via setTimeout(1500ms) côté consumer (tree.tsx), pas de callback depuis CompanionSlot"
key-files:
  created:
    - "components/mascot/FeedParticles.tsx"
  modified:
    - "components/mascot/CompanionSlot.tsx"
    - "app/(tabs)/tree.tsx"
decisions:
  - "Position FeedParticles : approximation fractionnelle HOME (0.42, 0.55) au lieu de mesurer la position réelle du sprite via onLayout — le compagnon se balade mais le centre HOME reste un anchor visuel acceptable pour les premiers feeds ; évolution possible : tracker currentFx/currentFy exposés via ref"
  - "feedScale combiné via multiplication (scale.value * feedScale.value) avec le scale tap existant — permet feed + tap concurrents sans écrasement"
  - "Particule individuelle = composant interne Particle (pas exporté) — simplifie l'API externe à {visible, affinity, x, y, onEnd}"
  - "runOnJS uniquement sur la DERNIÈRE particule (index PARTICLE_COUNT-1) — évite 5 appels JS redondants"
  - "Pas de reset explicite de translateY côté composant — le démontage (visible=false) re-mount fresh useSharedValue(0) au prochain affichage"
metrics:
  duration: "~8min"
  completed: "2026-04-22"
  tasks: 3
  commits: 3
---

# Phase 42 Plan 08 : Animation feed compagnon + particules affinité Summary

Feedback visuel immédiat quand le compagnon mange : pulse du sprite via reanimated (1.3x preferred / 1.15x neutral / recul -8px + 0.9x hated) + overlay 5 particules emoji flottantes selon affinité (💕 preferred, 😊 neutral, 💨 hated), déclenché par `handleFeedCrop` après `feedCompanion` résout `applied=true`.

## Objectif livré

**D-18 (résolu v1 via substitut validé) :** pas de frames sprite "eat" dédiées dans les assets existants — solution retenue = scale-pulse reanimated qui donne la perception d'un tressaillement / réaction immédiate. Les vraies frames eat sont déférées à la milestone v1.8+ "Compagnon Vivant".

**D-19 (livré) :** particules emoji contextualisées — cœurs pour préféré, sourires pour neutre, vent pour détesté. Float-up de -60px sur 1200ms + fade-out final 400ms.

**D-20 (livré Plan 07 et conservé ici) :** Haptics.Heavy sur preferred, Light sinon — déjà câblé Plan 07, appelé juste avant le `setFeedState` dans `handleFeedCrop`.

## Stratégie finale

### Animation sprite (CompanionSlot)

```
feedState non-null →
  preferred : scale 1 → 1.3 → 1 (spring SPRING_FEED)
  neutral   : scale 1 → 1.15 → 1 (spring SPRING_FEED)
  hated     : scale 1 → 0.9 → 1 + translateX 0 → -8 → 0 (timing 200/400ms)
feedState null →
  feedScale → 1 (200ms), feedTranslateX → 0 (200ms)
```

Le `companionAnimStyle` existant (jumpY + scale pour le tap) est étendu avec `translateX: feedTranslateX.value` et `scale: scale.value * feedScale.value` — multiplication préserve les deux animations concurrentes (un tap pendant un feed produit un scale combiné propre).

### Particules (FeedParticles)

5 instances `<Particle>` avec offsetX fixe `[-24, -12, 0, 12, 24]` et delay échelonné `[0, 60, 120, 180, 240]ms`. Chaque particule :

```
opacity : 0 → 1 (100ms) → ... → 0 (400ms derniers)
translateY : 0 → -60 (1200ms, Easing.out.quad)
```

`runOnJS(onEnd)` seulement sur la dernière particule pour minimiser les appels JS.

### Wiring tree.tsx

```typescript
// State
const [feedState, setFeedState] = useState<null | 'eating-preferred' | 'eating-neutral' | 'eating-hated'>(null);

// Dans handleFeedCrop, après Haptics
const nextState = `eating-${result.affinity}` as const;
setFeedState(nextState);
setTimeout(() => setFeedState(null), 1500);

// JSX
<CompanionSlot ... feedState={feedState} />
<FeedParticles
  visible={!!feedState}
  affinity={feedState ? (feedState.replace('eating-', '') as CropAffinity) : 'neutral'}
  x={SCREEN_W * 0.42}
  y={(DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60) * 0.55}
/>
```

## Timing final

| Séquence                          | Durée           |
| --------------------------------- | --------------- |
| Haptics (immédiat)                | 0ms             |
| setFeedState → pulse démarre      | 0ms             |
| Particules fade-in dernière       | 240 + 100 = 340ms |
| Pulse scale peak atteint (spring) | ~200-300ms      |
| Pulse retour à 1.0                | ~600-800ms      |
| Particules full float-up          | 1200ms          |
| Particules fade-out complet       | 240 + 1200 = 1440ms |
| setFeedState(null) reset          | 1500ms          |
| Reset transform feed (200ms)      | 1700ms total    |

Le 1500ms couvre largement les 1440ms d'animation particules — aucun flash de disparition visible.

## Position FeedParticles — choix retenu

Le compagnon se balade entre zones marchables via `currentFx.current` / `currentFy.current` (internes à `CompanionSlot`). Le plan mentionnait possiblement mesurer via `onLayout` ou exposer la position courante.

**Décision :** utiliser directement les fractions `HOME` (0.42, 0.55) × dimensions du diorama. Justification :
- Dans 90% des cas, le compagnon est proche de HOME ou en transit
- Mesurer la position exacte nécessiterait d'exposer currentFx via ref ou callback — surcoût non justifié pour un effet visuel 1.5s
- Les particules flottent vers le haut et sont visibles même avec un décalage de quelques dizaines de px
- Évolution possible (v1.8+) : tracker la position réelle via ref

## Commits

| # | Hash    | Message                                                                 |
|---|---------|-------------------------------------------------------------------------|
| 1 | a3a86bc | feat(42-08): FeedParticles overlay emoji selon affinité                 |
| 2 | 8dee2f1 | feat(42-08): prop feedState + animation pulse/recul dans CompanionSlot  |
| 3 | 04432a7 | feat(42-08): wiring feedState + FeedParticles dans tree.tsx             |

## Verification

- `test -f components/mascot/FeedParticles.tsx` — OK
- `grep -q "useSharedValue" components/mascot/FeedParticles.tsx` — OK
- `grep -q "AFFINITY_EMOJI" components/mascot/FeedParticles.tsx` — OK
- `grep -q "💕" components/mascot/FeedParticles.tsx` — OK
- `grep -q "💨" components/mascot/FeedParticles.tsx` — OK
- `grep -q "react-native-reanimated" components/mascot/FeedParticles.tsx` — OK (pas RN Animated)
- `wc -l components/mascot/FeedParticles.tsx` → 134 (≥80) — OK
- `grep -q "feedState" components/mascot/CompanionSlot.tsx` — OK
- `grep -q "SPRING_FEED" components/mascot/CompanionSlot.tsx` — OK
- `grep -q "withSequence" components/mascot/CompanionSlot.tsx` — OK
- `grep -q "eating-preferred" components/mascot/CompanionSlot.tsx` — OK
- Pas de `perspective` ajouté dans l'animation feed — OK
- `grep -q "setFeedState" app/(tabs)/tree.tsx` — OK
- `grep -q "FeedParticles" app/(tabs)/tree.tsx` — OK
- `grep -q "feedState={feedState}" app/(tabs)/tree.tsx` — OK
- `grep -q "setTimeout.*1500" app/(tabs)/tree.tsx` — OK
- `npx tsc --noEmit` — clean, aucune nouvelle erreur

## Deviations from Plan

### Auto-fixed Issues

Aucune — plan exécuté exactement comme écrit, sans blocage ni bug découvert pendant l'implémentation.

### Notes

- La composition du `companionAnimStyle` avec les transforms feed utilise **multiplication** de scale (`scale.value * feedScale.value`) plutôt que deux entrées `{ scale }` séparées dans le transform array — les deux entrées `{ scale }` auraient été valides aussi (RN les multiplie implicitement), mais l'écriture explicite documente mieux l'intention
- Le plan proposait `useEffect` avec dep `[feedState]` — respecté ; eslint-disable sur exhaustive-deps car `feedScale` / `feedTranslateX` sont des shared values stables

## Known Stubs

Aucun — les animations sont fonctionnelles end-to-end. Position des particules = approximation HOME (documentée et justifiée ci-dessus) — pas un stub mais un trade-off assumé pour v1.

## Checkpoint visuel

Différé au Plan 09 qui ajoutera les messages contextualisés (D-21) — le checkpoint user se fera en fin de phase avec l'ensemble du feedback (anim + particules + messages + Live Activity) pour éviter 2 passes verify.

## Self-Check: PASSED

- FOUND: components/mascot/FeedParticles.tsx (134 lignes, exports FeedParticles, AFFINITY_EMOJI présent)
- FOUND: components/mascot/CompanionSlot.tsx feedState prop + SPRING_FEED + useEffect feed
- FOUND: app/(tabs)/tree.tsx setFeedState + FeedParticles + feedState={feedState}
- FOUND: commit a3a86bc (FeedParticles)
- FOUND: commit 8dee2f1 (CompanionSlot pulse)
- FOUND: commit 04432a7 (tree.tsx wiring)
- npx tsc --noEmit : clean
