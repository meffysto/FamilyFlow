---
phase: 40
phase_name: UI Sporée — seed picker + badge + validation
researched: 2026-04-18
domain: React Native / Expo UI (pageSheet modals, reanimated, gamification ferme)
confidence: HIGH
requirements: [MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11]
---

# Phase 40 : UI Sporée — Research

## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Slot "Sceller" N'apparaît PAS dans la liste seed picker.** Il apparaît **après** sélection de la graine, uniquement si `sporeeCount ≥ 1`. Flow : seed picker → choix graine → (si Sporées dispo) étape intermédiaire "Sceller cette plantation ?" → plantation.
2. **3 durées toujours offertes** (Chill ×1.3 / Engagé ×1.7 / Sprint ×2.5). Ce qui varie selon la taille du plant (`tasksPerStage × 4`) c'est la **durée absolue** de chaque mode, pas les multipliers.
3. **Badge pace (Claude's Discretion)** : affichage `X/Y tâches aujourd'hui • cumul Z/N`, code couleur pace (vert ≥100% / jaune 70-99% / orange <70%), **pas d'animation continue lourde**. Positionnement + typographie à la discrétion du planner/designer.
4. **Anneau "prêt à valider"** : halo vert statique OU très discrète opacity breathing lente (ex: `withRepeat(withTiming(opacity 0.7→1, 2s))`). Affiché uniquement si **plant mûr ET cumul atteint**. Pas de pulse rapide, pas de rainbow.
5. **Toast victoire + drop-back inline** : utiliser `ToastContext` existant. Si drop-back 15% déclenché → mention inline dans toast victoire (ex: `"Victoire ! +30 🍃 (×2.5) · Sporée retrouvée 🎁"`). Si défaite → toast neutre/bienveillant (`"Plant récolté · Sporée consommée"`), jamais punitif.
6. **Preview prorata théorique** : texte compact (ex: `Sprint ×2.5 · 24h · ~3 tâches/jour requis`). Pas de graphique. Consommé depuis `wager-engine.computeWagerTarget()`.

### Claude's Discretion

- Position exacte du badge sur le sprite de plant, gabarit, typographie (tokens design obligatoires).
- Pattern technique pour l'étape intermédiaire "Sceller" (nested modal / remplacement contenu pageSheet / action sheet). La recherche tranche ci-dessous.
- Seuils exacts code couleur pace (proposition validée : ≥100% / 70-99% / <70%).
- Formule précise durées × taille plant (proposition validée ci-dessous).
- Emplacement du RNG drop-back 15% (hook vs moteur). La recherche tranche ci-dessous.

### Deferred Ideas (OUT OF SCOPE)

- **Onboarding tooltip premier drop Sporée** → Phase 41 (SPOR-10).
- **Compteur codex `wager.marathonWins`** → Phase 41 (SPOR-12).
- **Animation spectaculaire victoire (overlay plein écran)** → Phase 41 / future polish.
- **Stats historique Sporées** (nb gagnés/perdus) → Backlog.
- **Sporées cumulables** (plusieurs sur un même plant) → Backlog (scope exclu, 1 Sporée/plant).

## Project Constraints (from CLAUDE.md)

- **Langue** : UI, commits, commentaires, toasts — **français** obligatoire.
- **Couleurs** : toujours `useThemeColors()` / `colors.*` — jamais de hardcoded (`#FFFFFF`, `#F59E0B`, etc.). Exception historique `#F59E0B` (saisonnier) tolérée dans `seedPicker` existant mais **NE PAS étendre** aux nouveaux composants Sporée.
- **Animations** : `react-native-reanimated` ~4.1 obligatoire — `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming`. Jamais `RN Animated`.
- **Modals** : `presentationStyle="pageSheet"` + `ModalHeader` + drag-to-dismiss natif iOS.
- **Tokens design** : `Spacing.*`, `Radius.*`, `FontSize.*`, `FontWeight.*` — jamais de magic numbers (16, 8, etc.).
- **Stack verrouillée** : RN 0.81.5 + Expo SDK 54 + reanimated ~4.1 — aucune nouvelle dépendance npm.
- **Backward compat vault Obsidian** : `FarmCrop.modifiers` déjà sérialisé Phase 38 — shape intouchée.
- **Farm engine pur & synchrone** : `wager-engine.ts` livré Phase 39 consommé tel quel, zéro refactor moteur.
- **Bump `CACHE_VERSION`** : non nécessaire pour cette phase (shape `FarmCrop` + `FarmProfileData` stables depuis Phase 38).
- **Perf list items** : `React.memo`, `useCallback` handlers, `useMemo` providers.
- **Privacy** : zéro nom réel dans commits/docs (Lucas, Emma, Dupont OK).
- **`__DEV__` guard** pour tout `console.warn`/`console.error`.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MOD-03** | Seed picker étendu avec slot "Sceller" (apparaît uniquement si ≥1 Sporée), zéro nouvelle modale, pattern extensible | Section "Architecture — étape intermédiaire", Plan 2 |
| **SPOR-01** | Application Sporée via 3 durées dérivées de la taille du plant + multiplier et prorata visibles avant confirmation | Section "Mapping durées × taille plant", "Preview prorata", Plan 2 |
| **SPOR-02** | Badge sur plant scellé `X/Y tâches aujourd'hui • cumul Z/N` + code couleur pace, sans animation lourde | Section "Badge pace", Plan 3 |
| **SPOR-07** | Récolte plant scellé : si cumul atteint → reward × multiplier + toast victoire + 15% drop-back Sporée ; sinon reward normale | Section "RNG drop-back", "Branche récolte", Plan 4 |
| **SPOR-11** | État visuel "prêt à valider" sur plant scellé mûr (anneau vert) — distingue fenêtre de décision | Section "Anneau prêt-à-valider", Plan 3 |

## Summary

La Phase 40 est une phase **100% UI + câblage hook** : aucun moteur à créer, `wager-engine.ts` (Phase 39) + `sporee-economy.ts` (Phase 38) exposent déjà toutes les primitives. Le travail consiste à :

1. Étendre `useFarm` avec 3 actions : `startWager(profileId, plotIndex, duration)`, `validateWagerOnHarvest` intégré à `harvest()`, et `incrementWagerCumul` déclenché quand le sealeur complète une tâche du domaine Tasks.
2. Créer **un seul nouveau modal** `WagerSealerSheet` (pageSheet secondaire, empilé) affiché après `handleSeedSelect` quand `sporeeCount ≥ 1` — pattern validé par React Native iOS (stacking pageSheets).
3. Ajouter un composant `PlantWagerBadge` léger (pure View + Text memoïsé), positionné en overlay absolu **au-dessus** du sprite dans `CropCell` (`components/mascot/WorldGridView.tsx`), visible uniquement si `crop.modifiers?.wager` présent.
4. Ajouter un overlay `WagerReadyRing` (View static avec `borderWidth` vert + optionnel reanimated `useAnimatedStyle` breathing très lent), conditionnel double : `isMature && cumulCurrent >= cumulTarget`.
5. Brancher le toast victoire/défaite + drop-back dans la branche `harvest()` de `useFarm.ts` — pattern identique au bloc Sporée drop existant (lignes 337-351).

**Primary recommendation :** Découper en **4 plans** (1 data/hook + 1 UI sealer flow + 1 UI badge/anneau + 1 récolte/toast) — voir Section "Découpage suggéré". Sizing : ~4-6h total, zéro nouvelle dépendance, zéro refonte moteur.

## Architecture proposée

### Vue d'ensemble data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  UI                                                             │
│  ┌──────────────┐    ┌────────────────┐    ┌──────────────────┐ │
│  │ SeedPicker   │───▶│ WagerSealerSheet│──▶│ CropCell + Badge │ │
│  │ (inchangé)   │    │ (NEW pageSheet) │    │ + WagerReadyRing │ │
│  └──────────────┘    └────────────────┘    └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                      │                         │
        ▼                      ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  useFarm (extended)                                             │
│  - plant() [existant]                                           │
│  - startWager() [NEW] ──▶ consomme Sporée + set modifier        │
│  - harvest() [extended] ─▶ validateWagerOnHarvest + drop-back   │
│  - incrementWagerCumul() [NEW] ─▶ trigger par useTasks complete │
└─────────────────────────────────────────────────────────────────┘
        │                      │                         │
        ▼                      ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Moteurs purs (Phase 38/39 — consommés tel quels)               │
│  - wager-engine.ts (9 fonctions : computeCumulTarget, canSeal…) │
│  - sporee-economy.ts (classifyHarvestTier, tryIncrementSporee…) │
└─────────────────────────────────────────────────────────────────┘
        │                      │                         │
        ▼                      ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Vault markdown (Phase 38 shape stable)                         │
│  - FarmCrop.modifiers.wager (cumulTarget/cumulCurrent/duration) │
│  - FarmProfileData.sporeeCount                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Fichiers à créer

| Path | Rôle | Sizing |
|------|------|--------|
| `components/mascot/WagerSealerSheet.tsx` | Modal secondaire pageSheet — choix 3 durées + preview prorata + confirmation | ~250 lignes |
| `components/mascot/PlantWagerBadge.tsx` | Badge overlay `X/Y · Z/N` + code couleur pace, `React.memo`, zéro animation | ~80 lignes |
| `components/mascot/WagerReadyRing.tsx` | Anneau vert statique (ou breathing reanimated optionnel) — overlay conditionnel | ~60 lignes |
| `lib/mascot/wager-ui-helpers.ts` | 2 fonctions pures : `computeWagerDurations(tasksPerStage)` + `computePaceLevel(cumulCurrent, target, daysElapsed, totalDays)` | ~50 lignes |
| `lib/__tests__/wager-ui-helpers.test.ts` | Suite Jest helpers UI (tests ~10) | ~80 lignes |

### Fichiers à modifier

| Path | Modif | Notes |
|------|-------|-------|
| `hooks/useFarm.ts` | +3 callbacks : `startWager`, `incrementWagerCumul`, extension `harvest` | Existant 956 lignes — ajouts ~150 |
| `app/(tabs)/tree.tsx` | Gère `showWagerSealer` state + ouverture après `handleSeedSelect` si `sporeeCount ≥ 1` | Ajouts localisés ~40 lignes |
| `components/mascot/WorldGridView.tsx` | Injection `<PlantWagerBadge>` + `<WagerReadyRing>` dans `CropCell` | Ajouts ~15 lignes dans `CropCell` existant |
| `lib/mascot/index.ts` (barrel) | Export `wager-ui-helpers` | 2 lignes |
| `hooks/useTasks.ts` ou callback VaultContext | Hook `onTaskComplete` → `incrementWagerCumul` | À identifier précisément en plan 1 — voir "Câblage tâche→pari" |

## Décisions techniques clés

### 1. Pattern étape intermédiaire "Sceller" — pageSheet secondaire empilé

**Décision : nouveau `<Modal presentationStyle="pageSheet">` empilé au-dessus du seed picker existant.**

**Rationale :**
- **Pattern déjà utilisé dans le codebase** : `tree.tsx` empile déjà `showShop` + `showItemPicker` (lignes 1256-1257 : `setTimeout(() => setShowItemPicker(true), 400)` après close). iOS gère nativement les pageSheets empilés.
- **Cohérence UX** : l'utilisateur reste dans un contexte "plantation" — la transition pageSheet → pageSheet est plus fluide qu'une `Alert.alert` (moins de champs) ou action sheet (pas assez de place pour preview prorata + 3 boutons + skip).
- **Remplacement du contenu** rejeté : couplerait fortement le composant `tree.tsx` et rendrait le sealer non testable en isolation.
- **Action sheet natif** rejeté : n'accepte pas de layout riche (preview prorata + preview multiplier avec émojis).

**Implémentation :**

```typescript
// Dans tree.tsx (existant)
const [showSeedPicker, setShowSeedPicker] = useState(false);
const [showWagerSealer, setShowWagerSealer] = useState(false);
const [pendingPlant, setPendingPlant] = useState<{ plotIndex: number; cropId: string } | null>(null);

const handleSeedSelect = useCallback(async (cropId: string) => {
  if (!profile || selectedPlotIndex === null) return;
  const sporeeCount = profile.sporeeCount ?? 0;
  const canSealResult = canSealWager({
    sealerProfileId: profile.id,
    allProfiles: profiles,
    today: getLocalDateKey(new Date()),
  });

  if (sporeeCount >= 1 && canSealResult.ok) {
    // Ne PAS planter tout de suite — ouvrir sealer
    setPendingPlant({ plotIndex: selectedPlotIndex, cropId });
    setShowSeedPicker(false);
    setTimeout(() => setShowWagerSealer(true), 300); // attendre dismiss animation
    return;
  }

  // Comportement actuel (plantation directe)
  await plant(profile.id, selectedPlotIndex, cropId);
  // ...
}, [profile, profiles, selectedPlotIndex, plant, ...]);
```

**Gotcha :** Le `setTimeout(300)` est indispensable sur iOS — sinon le pageSheet secondaire refuse de s'ouvrir car le premier est en cours de dismiss. Pattern déjà établi dans `handleSlotSelect` (ligne 1257).

### 2. Mapping durées × taille plant — formule linéaire par multiplier

**Décision : durée absolue = `tasksPerStage × 4 × facteur_mode`**

| Mode | Multiplier | Facteur durée | Exemple plant petit (4 tasks) | Exemple plant géant (24 tasks) |
|------|-----------|---------------|-------------------------------|--------------------------------|
| **Chill** | ×1.3 | **1.0** | 4 tâches / ~24h | 24 tâches / ~5j |
| **Engagé** | ×1.7 | **0.7** | 3 tâches / ~16h | 17 tâches / ~3.5j |
| **Sprint** | ×2.5 | **0.5** | 2 tâches / ~12h | 12 tâches / ~2.5j |

**Rationale :**
- **Chill = durée normale** : le pari n'ajoute AUCUNE pression temporelle — c'est le prix d'entrée (×1.3 "bonus régularité").
- **Engagé = 0.7×** : serrage modéré, récompense intermédiaire.
- **Sprint = 0.5×** : mode "vibe coder" — durée divisée par 2, mais multiplier attrayant.
- **`Math.max(1, Math.ceil(tasksPerStage × 4 × facteur))`** pour éviter `targetTasks < 1`.
- Le cumul cible est calculé via `wager-engine.computeCumulTarget()` (prorata famille) ; ici on détermine seulement la **durée absolue** du pari (fenêtre où le sealeur doit atteindre le cumul). Les 2 dimensions sont orthogonales.

**Placement :** `lib/mascot/wager-ui-helpers.ts` (pur, testable, réutilisable) :

```typescript
export type WagerDurationOption = {
  duration: WagerDuration;
  multiplier: WagerMultiplier;
  targetTasks: number;   // cumul cible famille-pondéré
  absoluteTasks: number; // nombre de tâches du plant (info UI)
  estimatedHours: number;// projection ~6h/tâche pour preview
};

export function computeWagerDurations(
  tasksPerStage: number,
  computeCumulTarget: (p: {...}) => FamilyWeightResult,
  // … contexte famille
): WagerDurationOption[] { /* ... */ }
```

### 3. Preview prorata théorique — format texte compact

**Décision : 2 lignes de texte par option :**

```
Sprint ×2.5
24h · ~3 tâches/jour requis · cumul 5/10
```

- **Ligne 1** : nom + multiplier (plus gros, `FontSize.h3`).
- **Ligne 2** : durée absolue · cadence requise · cumul cible/total `pendingCount` (`FontSize.caption`, `colors.textMuted`).
- Le cumul cible est livré par `wager-engine.computeCumulTarget({ sealerProfileId, allProfiles, tasks, today, pendingCount })` — snapshot matinal ou appel live à l'ouverture du sealer.

### 4. Badge pace sur PlantSprite — overlay View + Text mémoïsé

**Décision : `PlantWagerBadge` = pure `View` (absolute positioning) + `Text` + `React.memo`. Zéro reanimated. Injecté dans `CropCell` (`WorldGridView.tsx`).**

**Structure :**

```typescript
interface PlantWagerBadgeProps {
  cumulCurrent: number;
  cumulTarget: number;
  tasksToday: number;
  tasksTargetToday: number;   // cumulTarget / daysRemaining
  paceLevel: 'green' | 'yellow' | 'orange';
}

export const PlantWagerBadge = React.memo(function PlantWagerBadge({
  cumulCurrent, cumulTarget, tasksToday, tasksTargetToday, paceLevel
}: PlantWagerBadgeProps) {
  const { colors } = useThemeColors();
  const paceBg = {
    green:  colors.successBg,
    yellow: colors.warningBg,
    orange: colors.errorBg,
  }[paceLevel];
  // 2 lignes compactes, positioning = top: -4, right: -4 au-dessus sprite
});
```

**Positionnement** : overlay `position: 'absolute'`, `top: -Spacing.xs`, `right: -Spacing.xs` du `cropContainer` dans `CropCell`. Taille visée : ~32-44px large × 22px haut. Lisible sans zoom sur iPhone 13+.

**Code couleur pace** (formule `computePaceLevel`) :

```typescript
// Tokens thème (jamais hardcoded)
const progress = cumulCurrent / Math.max(1, cumulTarget);
const expected = daysElapsed / Math.max(1, totalDays);
const ratio = progress / Math.max(0.01, expected);
if (ratio >= 1.0)  return 'green';
if (ratio >= 0.7)  return 'yellow';
return 'orange';
```

**Perf** : `React.memo` + pas d'animation = 0 CPU quand pas de re-render parent. Plusieurs plants scellés simultanés → N badges indépendants, aucun shared clock, aucun `useSharedValue` — testé pattern identique au `stageRow` existant (lignes 210-222 de `WorldGridView.tsx`).

### 5. Anneau "prêt à valider" — View statique + optionnel breathing très lent

**Décision : `WagerReadyRing` = `View` absolu avec `borderWidth: 2`, `borderColor: colors.successText`, `borderRadius` matché au sprite. Breathing optionnel avec `useSharedValue(opacity)` + `withRepeat(withTiming(1.0, 2000))` — démarré uniquement à l'apparition, jamais pendant growth.**

**Conditions d'affichage** (double gate) :

```typescript
const showReadyRing =
  crop.currentStage >= 4 &&                           // plant mûr
  crop.modifiers?.wager &&                            // scellé
  (crop.modifiers.wager.cumulCurrent ?? 0) >=
    (crop.modifiers.wager.cumulTarget ?? Infinity);   // cumul atteint
```

**Rationale "breathing optionnel"** : user tolère "très discrète" — `opacity 0.7→1.0 sur 2000ms linear easing` est imperceptible sauf attention soutenue, cohérent avec `reduceMotion` ignoré (pattern `ToastContext` lignes 87-99 expose `useReducedMotion` → si `true`, skip l'animation, sinon démarrer).

**Perf** : même logique que badge — 1 shared value par plant mûr+scellé+cumulé (cas rare, typiquement 0-2 plants simultanés). Impact négligeable.

### 6. RNG drop-back 15% — placement dans moteur pur, consommé par hook

**Décision : ajouter fonction pure `rollWagerDropBack(random?: () => number): boolean` dans `lib/mascot/sporee-economy.ts`, consommée dans `useFarm.harvest()` branche "wager won".**

**Rationale :**
- **Pureté** : toutes les RNG Sporée vivent dans `sporee-economy.ts` (`rollSporeeDropOnHarvest`, `rollSporeeDropOnExpedition`). Pattern cohérent, testable avec injection `random`.
- **Le hook fait l'I/O** : le moteur retourne un `boolean`, le hook décide d'appeler `tryIncrementSporeeCount` si `true`.
- **Jamais dans le toast** : le toast est un effet de bord UI — pas de RNG là.
- **Jamais dans `wager-engine.ts`** : ce moteur est le calcul prorata pur (famille, poids), pas les drops cosmétiques.

**Implémentation :**

```typescript
// Dans lib/mascot/sporee-economy.ts
const DROP_BACK_CHANCE = 0.15;

export function rollWagerDropBack(random: () => number = Math.random): boolean {
  return random() < DROP_BACK_CHANCE;
}
```

**Dans `useFarm.harvest`** (branche standard, lignes 337-351 étendues) :

```typescript
// Après validateWagerOnHarvest si modifier.wager présent
const wager = profile.farmCrops /* parsed crop */.modifiers?.wager;
if (wager) {
  const validation = validateWagerOnHarvest(
    wager.cumulCurrent ?? 0,
    wager.cumulTarget ?? 0,
  );
  if (validation.won) {
    finalQty = Math.round(finalQty * wager.multiplier);
    // Drop-back 15%
    let dropBack = false;
    if (rollWagerDropBack()) {
      const inc = tryIncrementSporeeCount(profile.sporeeCount ?? 0, 1);
      if (inc.accepted) {
        profile.sporeeCount = inc.newCount;
        dropBack = true;
      }
    }
    showToast(
      `Victoire ! +${finalQty} 🍃 (×${wager.multiplier})${dropBack ? ' · Sporée retrouvée 🎁' : ''}`,
      'success'
    );
  } else {
    showToast('Plant récolté · Sporée consommée', 'info');
  }
}
```

**Reproductibilité testable** : suite Jest peut injecter `rollWagerDropBack(() => 0.1)` (accept) vs `() => 0.5` (reject).

### 7. Câblage tâche → incrément `cumulCurrent`

**Décision : ajouter callback `onWagerTaskComplete` dans `useFarm`, déclenché depuis le handler de validation tâche existant, filtré par `filterTasksForWager` + `completedDate === today` + `profileId === wager.sealerProfileId`.**

**Règle métier (Phase 39 Plan 02 contrat) :**
```
cumulCurrent++ SSI task.completed && task.completedDate === today
  && task.sourceFile est Tasks domain (filterTasksForWager)
  && profile.id === wager.sealerProfileId
```

**Implémentation** : plan 1 détaillera **où exactement** câbler. 2 options à investiguer en plan :
- **Option A** : dans `useTasks` existant, ajouter un callback `onTaskComplete` passé par `VaultContext` qui appelle `useFarm.incrementWagerCumul(profileId, taskSourceFile)`.
- **Option B** : dans le provider `VaultContext`, après chaque `writeTask`, déclencher un refresh qui re-scan les wagers actifs et recompte depuis le snapshot de tâches.

**Recommandation** : **Option A** — moins de I/O, incrément immédiat visible dans le badge, pattern event-driven cohérent avec `onQuestProgress` existant (`useFarm.ts` ligne 297).

## Gotchas identifiés

### G1 — Stacking pageSheets iOS (Modal après Modal)
Sur iOS, deux `Modal presentationStyle="pageSheet"` ne peuvent PAS s'ouvrir simultanément — le second est refusé silencieusement si le premier est en cours de dismiss. **Mitigation** : `setTimeout(300ms)` entre `setShowSeedPicker(false)` et `setShowWagerSealer(true)`. Pattern déjà établi ligne 1257 de `tree.tsx`.

### G2 — Incrément `cumulCurrent` multi-wagers
Un sealeur peut avoir **plusieurs plants scellés simultanés** sur différentes plotIndex. Chaque tâche complétée par le sealeur doit incrémenter **TOUS** les wagers actifs dont il est le sealeur. Le plan 1 doit boucler sur `crops.filter(c => c.modifiers?.wager?.sealerProfileId === profileId)` et incrémenter chaque `cumulCurrent`.

### G3 — Race condition vault write
`useFarm.harvest` lit déjà le vault + fait 1 writeFile (pattern Phase 38). L'incrément `cumulCurrent` doit suivre le même pattern : read → mutate in-place → writeFile unique. **Ne pas** faire `plant()` + `startWager()` en 2 I/O séparés — fusionner dans `startWager` qui encapsule plant + set modifier dans un seul write.

### G4 — `canSealWager` avant ouverture du sealer
Si le profil actif a poids 0 (bébé override), l'UI doit **désactiver** le slot "Sceller" avec tooltip explicatif (Phase 39 contrat ligne 201-207). Gate à appeler côté `handleSeedSelect` AVANT d'ouvrir le sealer. Sinon user perd une Sporée sur un pari non gagnable.

### G5 — Snapshot matinal vs prorata live
Le `wager-engine.computeCumulTarget` attend un `pendingCount` — utiliser le **snapshot matinal** (`parseSnapshots`) au moment de `startWager` pour cohérence avec D-05/D-06 Phase 39. À l'ouverture du sealer, on peut afficher un prorata **théorique** basé sur `tasks.filter(t => !t.completed).length` (live), avec un disclaimer compact ("recalculé chaque matin").

### G6 — Badge visible même pendant growth stages (0-3)
Le badge DOIT s'afficher dès la plantation scellée, pas seulement à maturité — c'est le feedback de progression quotidien. Conditions : `crop.modifiers?.wager` présent, quel que soit `currentStage`. L'anneau "prêt à valider" lui vient EN PLUS à `currentStage === 4 && cumulCurrent >= cumulTarget`.

### G7 — Reward × multiplier : Math.round ou Math.ceil ?
Le multiplier peut créer des décimales (ex: `30 × 1.3 = 39`, `30 × 1.7 = 51`, `30 × 2.5 = 75` — tous entiers pour les rewards actuels). Mais si un `harvestEvent` modifier est appliqué AVANT (lignes 325 `useFarm.ts`), on peut avoir `finalQty * multiplier` fractionnaire. **Recommandation** : `Math.round(finalQty * multiplier)` — cohérent avec ligne 329 existante (`Math.round(finalQty * EFFECT_GOLDEN_MULTIPLIER)`).

### G8 — Toast RewardCard vs showToast standard
`ToastContext` expose 3 API : `showToast`, `showRewardCard`, `showHarvestCard`. La décision user locked = "utiliser ToastContext existant". Pour la victoire Sporée, **`showToast` simple** suffit (message 1 ligne inline) — inutile d'étendre `HarvestCardToast` qui est déjà pris par les récoltes normales.

## Runtime State Inventory

Phase UI pure, aucun rename/refactor. Section omise.

## Environment Availability

Phase code-only, aucune dépendance externe à auditer. Tout est déjà installé :
- `react-native-reanimated ~4.1` ✓
- `react-native-gesture-handler` ✓
- `expo-haptics` ✓
- `expo-secure-store` ✓ (non utilisé en Phase 40 mais dispo pour Phase 41)

## Standard Stack (consommation — zéro ajout)

| Library | Version | Purpose | Usage Phase 40 |
|---------|---------|---------|----------------|
| react-native-reanimated | ~4.1 | Animations UI | Breathing opacity anneau (optionnel) |
| expo-router | v6 | Navigation | Aucune nouvelle route |
| react-native Modal | RN 0.81.5 | pageSheet empilé | WagerSealerSheet |
| ToastContext (interne) | - | Notifications | victoire/défaite/drop-back inline |
| wager-engine.ts (Phase 39) | - | Calcul prorata pur | `computeCumulTarget`, `canSealWager`, `validateWagerOnHarvest` |
| sporee-economy.ts (Phase 38) | - | Économie Sporée | `tryIncrementSporeeCount`, nouveau `rollWagerDropBack` |

**Aucune nouvelle dépendance npm.**

## Architecture Patterns (existants réutilisés)

### Pattern 1 : `React.memo` + pure View pour overlay léger
Source : `components/mascot/WorldGridView.tsx` CropCell (lignes 88-254) — `stageRow` (dots progression) est une pure View memoïsée sans animation. Appliqué à `PlantWagerBadge`.

### Pattern 2 : pageSheet empilé avec delay de dismiss
Source : `app/(tabs)/tree.tsx` lignes 1256-1258 (handleSlotSelect). Appliqué à `WagerSealerSheet` après `handleSeedSelect`.

### Pattern 3 : ToastContext pour feedback unifié
Source : `hooks/useFarm.ts` lignes 366, 401 (overflow Sporée). Appliqué à victoire/défaite/drop-back.

### Pattern 4 : Hook callback avec useCallback + deps propres
Source : `hooks/useFarm.ts` `harvest` (ligne 302-414). Appliqué à `startWager` + `incrementWagerCumul`.

### Pattern 5 : RNG pure avec injection random pour testabilité
Source : `sporee-economy.ts` `rollSporeeDropOnHarvest`. Appliqué à `rollWagerDropBack`.

### Anti-patterns à éviter

- **RN Animated** → interdit par CLAUDE.md, reanimated uniquement.
- **Hardcoded couleurs** → `useThemeColors()` obligatoire, même pour le vert pace (utiliser `colors.successText`).
- **Nested Swipeable dans ScrollView** → non applicable ici.
- **`useState` pour computed data** → préférer `useMemo` pour paceLevel, computed durations.
- **Animation continue sur badge** → explicitement refusé (CONTEXT décision 3).

## Don't Hand-Roll

| Problème | Ne PAS réinventer | Utiliser |
|----------|-------------------|----------|
| Calcul prorata famille | Formule live dans UI | `wager-engine.computeCumulTarget` (Phase 39) |
| Check peut-on sceller | Check manuel poids/profil | `wager-engine.canSealWager` |
| Validation victoire pari | Compare `current >= target` ad-hoc | `wager-engine.validateWagerOnHarvest` |
| Increment Sporée avec cap 10 | Mutation directe | `sporee-economy.tryIncrementSporeeCount` |
| Snapshot famille matin | Re-scan live | `parseSnapshots` (Phase 39 Plan 01) |
| Attribution tâche→profil | Matching basique | `isProfileActive7d` triple attribution (Phase 39) |
| Catégorie âge profil | Switch case à la main | `computeAgeCategory` (Phase 39) |
| Date locale YYYY-MM-DD | `toISOString().split('T')[0]` | `getLocalDateKey` (Phase 38) |

## Common Pitfalls

### P1 — Plant planté mais pari non scellé (cancel sealer)
**Ce qui se passe mal** : user ouvre sealer, clique "Annuler / Ne pas sceller" — le plant doit être planté en mode normal, pas abandonné.
**Prévention** : le sealer a 2 boutons "Sceller (Chill/Engagé/Sprint)" + 1 bouton "Pas cette fois — planter normalement". Le second appelle `plant()` sans `startWager`. Cancel dismiss = planter normalement également.
**Signal** : vérifier que `pendingPlant` est consommé dans tous les paths (confirm sceller / confirm skip / dismiss sans bouton).

### P2 — Badge affiche 0/0 avant premier recompute
**Ce qui se passe mal** : plant scellé en fin d'après-midi, `maybeRecompute` ne s'est pas encore déclenché (pattern boot/minuit) — `cumulTarget = 0` → badge lit `0/0 — 0/0`.
**Prévention** : `startWager` déclenche un **recompute immédiat** via `maybeRecompute` forcé (ignorer `shouldRecompute` check à la création). Alternative : fallback display `—` quand `cumulTarget === 0` ET `appliedAt === today`.

### P3 — Multiplier non appliqué si `harvestEvent` modifie qty avant
**Ce qui se passe mal** : ligne 325 `finalQty = harvestEvent ? Math.max(0, Math.round(harvestQty * harvestEvent.modifier)) : harvestQty` — puis ligne 329 golden `Math.round(finalQty * EFFECT_GOLDEN_MULTIPLIER)`. Le wager multiplier doit s'appliquer APRÈS les deux.
**Prévention** : inclure le bloc wager après le bloc golden (nouvelle ligne ~332), pattern `if (wager && validation.won) finalQty = Math.round(finalQty * wager.multiplier)`.

### P4 — Drop-back déclenché sur défaite
**Ce qui se passe mal** : le drop-back 15% est une récompense de VICTOIRE. Si appelé sur défaite, c'est un bug.
**Prévention** : garde stricte `if (validation.won && rollWagerDropBack())`.

### P5 — Modifier non nettoyé après récolte
**Ce qui se passe mal** : le plant est récolté, la parcelle redevient vide, mais le `modifiers.wager` reste dans le CSV → ghost data au prochain boot.
**Prévention** : `harvestCrop()` (`lib/mascot/farm-engine.ts`) efface déjà le plant entier lors de la récolte — le modifier disparaît avec. Vérifier en plan 1 que c'est bien le cas (pas de fuite de state entre sessions).

### P6 — Incrément cumul double si user recomplète la même tâche
**Ce qui se passe mal** : user coche/décoche/recoche une tâche → 3 incréments.
**Prévention** : incrémenter uniquement sur la **transition completed=false → true** (event-driven, pas scan). Ou utiliser une dedupe via `task.id` + `today` stockée dans un Set volatile.
**Recommandation** : event-driven simple (callback `onTaskComplete` déclenché uniquement sur transition false→true dans `useTasks`) — pattern déjà appliqué à `onQuestProgress`.

### P7 — Plusieurs Sporées en inventaire mais 1 seule consommée par plant
Explicitement scope exclu (CONTEXT Deferred : "Sporées cumulables — 1 Sporée/plant"). Le sealer doit consommer `-1` et cap un plant = 1 wager max. Si l'user plante 5 parcelles scellées, c'est 5 Sporées × -1.

## Code Examples (pattern de référence)

### Exemple : consume Sporée + set modifier (startWager)

```typescript
// hooks/useFarm.ts — nouveau callback
const startWager = useCallback(async (
  profileId: string,
  plotIndex: number,
  cropId: string,
  duration: WagerDuration,
): Promise<void> => {
  if (!vault) return;
  const content = await vault.readFile(farmFile(profileId)).catch(() => '');
  const farmData = parseFarmProfile(content);
  const currentSporee = farmData.sporeeCount ?? 0;
  if (currentSporee < 1) throw new Error('Pas de Sporée disponible');

  // 1. Plant (pattern existant)
  const currentCrops = parseCrops(farmData.farmCrops ?? '');
  const newCrops = plantCrop(currentCrops, plotIndex, cropId);

  // 2. Set modifier
  const multiplier = { chill: 1.3, engage: 1.7, sprint: 2.5 }[duration];
  const today = getLocalDateKey(new Date());
  const allProfiles = profiles;
  const allTasks = /* depuis VaultContext */ [];
  const snapshot = /* parseSnapshots … */;
  const result = computeCumulTarget({
    sealerProfileId: profileId,
    allProfiles,
    tasks: filterTasksForWager(allTasks),
    today,
    pendingCount: snapshot?.pending ?? allTasks.filter(t => !t.completed).length,
  });

  const newPlant = newCrops[newCrops.length - 1];
  newPlant.modifiers = {
    wager: {
      sporeeId: `sporee-${Date.now()}`,
      duration,
      multiplier: multiplier as WagerMultiplier,
      appliedAt: today,
      sealerProfileId: profileId,
      cumulTarget: result.cumulTarget,
      cumulCurrent: 0,
    },
  };

  // 3. Consume Sporée + écrire vault en 1 seul I/O
  farmData.sporeeCount = currentSporee - 1;
  farmData.farmCrops = serializeCrops(newCrops);
  // Déduire coins standard
  await writeProfileFields(profileId, {
    farm_crops: serializeCrops(newCrops),
    sporee_count: String(currentSporee - 1),
  });
  await deductCoins(profileId, CROP_CATALOG.find(c => c.id === cropId)!.cost, `🌱 Graine scellée : ${cropId}`);
  await refreshFarm(profileId);
}, [vault, profiles, writeProfileFields, deductCoins, refreshFarm]);
```

### Exemple : branche wager dans harvest (extrait)

```typescript
// Dans useFarm.harvest après le bloc golden (ligne ~331)
const wager = /* crop parsed */.modifiers?.wager;
if (wager) {
  const validation = validateWagerOnHarvest(
    wager.cumulCurrent ?? 0,
    wager.cumulTarget ?? 0,
  );
  if (validation.won) {
    finalQty = Math.round(finalQty * wager.multiplier);
    let dropBack = false;
    if (rollWagerDropBack()) {
      const inc = tryIncrementSporeeCount(profile.sporeeCount ?? 0, 1);
      if (inc.accepted) {
        profile.sporeeCount = inc.newCount;
        dropBack = true;
      }
    }
    showToast(
      `Victoire ! +${finalQty} 🍃 (×${wager.multiplier})${dropBack ? ' · Sporée retrouvée 🎁' : ''}`,
      'success',
    );
  } else {
    showToast('Plant récolté · Sporée consommée', 'info');
  }
}
```

## State of the Art

| Legacy approach | Current approach | Why |
|-----------------|------------------|-----|
| Inline RNG dans composant UI | RNG dans moteur pur + injection `random` | Testabilité Jest (Phase 38 pattern) |
| `setTimeout` pour state sequences | `useCallback` + deps claires | Pas applicable (pageSheets = iOS timing, `setTimeout(300)` requis) |
| `StyleSheet.create` couleurs | `useThemeColors()` inline pour dynamiques | CLAUDE.md rule |
| Alert.alert pour confirmations | pageSheet Modal + ModalHeader | Pattern projet (recettes, tâches, sealer) |

## Open Questions

1. **Où exactement câbler `onWagerTaskComplete` ?**
   - Ce qu'on sait : doit être event-driven (transition false→true), pas polling.
   - Ce qui est flou : `useTasks` expose-t-il déjà un callback `onTaskComplete` ou faut-il l'ajouter ?
   - Recommandation : **plan 1 investigue** `hooks/useTasks.ts` + `contexts/VaultContext.tsx`. Pattern `onQuestProgress` (passé en prop à `useFarm`) est probablement déjà calqué.

2. **Snapshot matinal live vs cache au moment du sealer ?**
   - Ce qu'on sait : `maybeRecompute` devrait tourner au boot (Phase 39 contrat).
   - Ce qui est flou : si l'user scelle à 14h alors que le snapshot date de 8h, doit-on recompute à la volée dans `startWager` ?
   - Recommandation : **oui**, recompute à `startWager` avec `tasks: filterTasksForWager(allTasks)` live. Pattern pur, déterministe, cohérent.

3. **Où déclencher le bootstrap `maybeRecompute` ?**
   - Ce qu'on sait : Phase 39 contrat ligne 175 suggère "au boot + au passage minuit".
   - Ce qui est flou : scope de Phase 40 ou différé ?
   - Recommandation : **inclure dans plan 1** — sans bootstrap, les badges lisent `cumulTarget = 0` au premier boot. À placer dans `useFarm` init effet via `useEffect`.

## Découpage suggéré en plans

**4 plans séquentiels** (dépendances strictes entre 1 et 2-4 ; 2-3-4 peuvent paralléliser partiellement mais s'imbriquent dans le même fichier `tree.tsx` → séquence recommandée).

### Plan 40-01 — Data & hook : extension `useFarm` avec startWager + cumul + drop-back
**Sizing :** M (~1.5-2h)
**Wave :** Wave 0 (fondation — tout le reste en dépend)
**Fichiers :**
- `hooks/useFarm.ts` (+ 3 callbacks : `startWager`, `incrementWagerCumul`, extension `harvest`)
- `lib/mascot/sporee-economy.ts` (+ `rollWagerDropBack`)
- `lib/mascot/wager-ui-helpers.ts` (new — `computeWagerDurations`, `computePaceLevel`)
- `lib/__tests__/wager-ui-helpers.test.ts` (new — ~10 tests)
- `lib/__tests__/sporee-economy.test.ts` (+ tests `rollWagerDropBack`)
- Câblage `onWagerTaskComplete` dans `useTasks` ou VaultContext (à confirmer)
- Bootstrap `maybeRecompute` dans effet d'init `useFarm`

**Requirements couverts :** MOD-03 (shape data côté hook), SPOR-01 fondation, SPOR-07 logique, SPOR-11 logique.

**Dépend de :** Phase 39 (moteur livré) + Phase 38 (sporee-economy).

### Plan 40-02 — UI seed flow : sealer pageSheet + choix 3 durées + preview prorata
**Sizing :** M (~1.5h)
**Wave :** Wave 1 (après plan 01)
**Fichiers :**
- `components/mascot/WagerSealerSheet.tsx` (new — pageSheet empilé, 3 options + skip)
- `app/(tabs)/tree.tsx` (modification `handleSeedSelect` + ajout state `showWagerSealer` + `pendingPlant`)
- `lib/i18n/*.json` (traductions FR nouvelles clés : `farm.wager.seal`, `farm.wager.chill`, `farm.wager.engaged`, `farm.wager.sprint`, `farm.wager.skip`, `farm.wager.preview`)

**Requirements couverts :** MOD-03 (UI slot étendu après select), SPOR-01 (3 durées visibles + preview).

**Dépend de :** Plan 40-01 (`startWager` dispo).

### Plan 40-03 — UI badge + anneau prêt-à-valider sur plants
**Sizing :** S-M (~1h)
**Wave :** Wave 1 (après plan 01, peut parallel avec plan 02)
**Fichiers :**
- `components/mascot/PlantWagerBadge.tsx` (new — pure View memoïsée)
- `components/mascot/WagerReadyRing.tsx` (new — overlay statique + breathing optionnel)
- `components/mascot/WorldGridView.tsx` (injection dans `CropCell`)

**Requirements couverts :** SPOR-02 (badge pace), SPOR-11 (anneau prêt à valider).

**Dépend de :** Plan 40-01 (données `modifiers.wager.cumulCurrent/Target` à jour).

### Plan 40-04 — Récolte + toast victoire/défaite/drop-back
**Sizing :** S (~30-45min)
**Wave :** Wave 2 (après plan 01 + plan 02 pour validation end-to-end)
**Fichiers :**
- `hooks/useFarm.ts` (finalisation branche wager dans `harvest` — toast + drop-back)
- `lib/i18n/*.json` (traductions FR : `farm.wager.victory`, `farm.wager.defeat`, `farm.wager.dropBack`)
- `lib/__tests__/useFarm-wager.test.ts` (new — smoke test validation + drop-back injection)

**Requirements couverts :** SPOR-07 (validation récolte + toast + drop-back).

**Dépend de :** Plan 40-01 (logique), Plan 40-02 (plant scellé existant pour E2E test).

### Dépendances visualisées

```
        Plan 01 (data/hook)
         │
    ┌────┴────┬────────┐
    ▼         ▼        ▼
Plan 02    Plan 03   (Plan 04 attend 01+02)
(sealer)   (badge)
    │         │
    └────┬────┘
         ▼
      Plan 04 (récolte+toast)
```

**Wave grouping recommandé :**
- Wave 0 : Plan 01
- Wave 1 : Plan 02 + Plan 03 (parallélisables, composants indépendants)
- Wave 2 : Plan 04 (finalisation end-to-end, nécessite 01 + 02)

## Sources

### Primary (HIGH confidence)
- `.planning/phases/39-moteur-prorata-calcul-famille/39-02-SUMMARY.md` — contrat moteur `wager-engine.ts` (ligne 171-215)
- `.planning/phases/38-fondation-modifiers-conomie-spor-e/38-03-SUMMARY.md` — économie Sporée câblée
- `lib/mascot/wager-engine.ts` — 9 fonctions pures disponibles (305 lignes)
- `lib/mascot/types.ts:305-325` — types `WagerModifier` / `FarmCropModifiers` stables
- `lib/types.ts:615-655` — `FarmProfileData` avec `sporeeCount` Phase 38
- `hooks/useFarm.ts:302-414` — pattern `harvest` avec drop Sporée (lignes 337-351)
- `contexts/ToastContext.tsx` — API `showToast(message, type, action, options)`
- `components/mascot/WorldGridView.tsx:88-254` — pattern `CropCell` avec stageRow (memo pure)
- `app/(tabs)/tree.tsx:1751-1950` — pattern pageSheet seed picker
- `./CLAUDE.md` — conventions projet (FR, reanimated, useThemeColors, pageSheet)

### Secondary (MEDIUM confidence)
- `app/(tabs)/tree.tsx:1245-1262` — pattern stacking pageSheets avec `setTimeout(400)`
- `components/ui/Badge.tsx` — pattern `React.memo` + tokens design

### Tertiary (LOW confidence)
- Aucune recherche externe effectuée — tout le contexte est interne au codebase et aux phases précédentes livrées.

## Metadata

**Confidence breakdown :**
- Standard stack : **HIGH** — stack verrouillée, zéro dépendance, primitives Phase 38/39 livrées et testées (84 tests verts).
- Architecture : **HIGH** — patterns existants (pageSheet empilé, Toast, CropCell memo) éprouvés dans le codebase.
- Pitfalls : **HIGH** — G1 (stacking pageSheets) et P3 (ordre multiplier/golden) identifiés par inspection directe du code existant.
- Découpage plans : **HIGH** — 4 plans mappent 1:1 sur les 4 livrables CONTEXT.md §Artefacts en aval.
- Open questions : **MEDIUM** — Q1 (câblage `onTaskComplete`) dépend de l'inspection fine de `useTasks` / `VaultContext` par le plan 01.

**Research date :** 2026-04-18
**Valid until :** 2026-05-18 (stack RN/Expo stable 30 jours, moteurs Phase 38/39 verrouillés)
