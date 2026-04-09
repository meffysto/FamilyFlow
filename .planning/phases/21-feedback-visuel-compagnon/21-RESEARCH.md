# Phase 21: Feedback visuel + compagnon - Research

**Researched:** 2026-04-09
**Domain:** React Native animations, haptics, toast system, i18n, companion engine
**Confidence:** HIGH

## Summary

Phase 21 wires up the ten semantic effects (Phase 20) to visible, audible, and tactile feedback. Every piece of infrastructure already exists: `HarvestBurst.tsx` for particle bursts, `ToastContext.tsx` for rich toasts (icon + subtitle layout), `lib/mascot/haptics.ts` for structured haptic patterns, `lib/mascot/companion-engine.ts` for templated companion messages, and i18next with FR/EN locale files. The phase is purely additive — no new files in the critical path except `lib/semantic/effect-toasts.ts` (pure constant dictionary), and targeted extensions to four existing files plus locale JSONs.

The main integration point is `useGamification.ts::completeTask()`. After `applyTaskEffect()` returns an `EffectResult`, the caller currently discards the result — Phase 21 reads `effectResult.effectApplied` and `category.id` to dispatch toast, haptic, and HarvestBurst variant. The companion `subType` path is a separate concern: `tree.tsx` drives companion messages independently via its own `useFocusEffect`; the `subType` is injected into `CompanionMessageContext` and `pickCompanionMessage` reads it.

A critical finding: `tasks.tsx` calls `completeTask(activeProfile, task.text)` with **no `taskMeta`** today. For semantic coupling (Phase 20 and now Phase 21 feedback) to fire, `taskMeta` must be passed. The task object in `tasks.tsx` has `task.tags`, `task.section`, and `task.sourceFile` available — they simply are not forwarded. This must be addressed in the implementation.

**Primary recommendation:** Implement feedback in a single Wave adding `effect-toasts.ts` constant, haptic functions, HarvestBurst variant prop, companion sub-type extension, and locale keys — with the feedback dispatch assembled in `useGamification.ts::completeTask()` post-`applyTaskEffect()`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Toast design par effet**
- D-01: Mapping fixe emoji + texte FR/EN — un dictionnaire `EFFECT_TOASTS` avec emoji, message FR et EN par `EffectId`. Pas de templates dynamiques avec placeholders.
- D-02: Toast immédiat en parallèle du HarvestBurst — tout le feedback arrive d'un coup à la complétion de la tâche, pas de séquencement.
- D-03: Silencieux si cappé — pas de toast quand `isCapExceeded = true`. Évite la frustration.

**Messages compagnon**
- D-04: Templates fixes avec sub_type — ajouter `subType?: CategoryId` dans `CompanionMessageContext`. `pickCompanionMessage` vérifie si des templates sub_type existent, sinon fallback générique `task_completed`.
- D-05: 2 templates par catégorie — 20 templates total (10 catégories × 2), chaque template référence la catégorie + l'effet déclenché.
- D-06: Bulle arbre uniquement — le compagnon parle dans sa bulle sur tree.tsx comme aujourd'hui. Pas de notification toast cross-écran pour les messages compagnon.

### Claude's Discretion

- Toast type par effet : Claude choisit le mapping success/info le plus adapté par catégorie
- HarvestBurst variants : Claude décide des variantes visuelles (golden/rare/ambient) — couleurs, animations, nombre de particules
- Haptic patterns : Claude conçoit les 10 patterns haptiques distincts en s'appuyant sur les patterns existants de `lib/mascot/haptics.ts`

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEEDBACK-01 | User sees a specific toast when an effect is triggered | `ToastContext.showToast(msg, type, undefined, { icon, subtitle })` — rich layout already supports emoji icon + subtitle. `EFFECT_TOASTS[categoryId]` dict drives the mapping. |
| FEEDBACK-02 | User feels a distinct haptic pattern per effect category | `lib/mascot/haptics.ts` provides `delay()` helper + `isWeb` guard pattern. 4 new exported functions cover 10 categories by intensity group per UI-SPEC. |
| FEEDBACK-03 | User sees a visual burst (HarvestBurst variant) adapted to the effect | `HarvestBurst` accepts `cropColor` and `reward`; extend with `variant` prop to control particle count, size, label color, travel distance and duration. |
| FEEDBACK-04 | User reads a contextual companion message referencing the real task category | `CompanionMessageContext` gains `subType?: CategoryId`; `pickCompanionMessage` gains sub-type lookup in `MESSAGE_TEMPLATES`; 20 new i18n keys added. |
| FEEDBACK-05 | User sees i18n FR+EN parity for all feedback strings | All new strings: EFFECT_TOASTS dict (fr/en/subtitle_fr/subtitle_en), 20 companion template keys in both locales JSON. Pattern: existing test `cohérence des fichiers de traduction` auto-validates parity. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1 | Particle animations, HarvestBurst | CLAUDE.md mandatory — no RN Animated |
| expo-haptics | SDK 54 bundle | Haptic feedback | Already used in HarvestBurst.tsx |
| i18next + react-i18next | In package.json | FR/EN translations | Existing infrastructure in `lib/i18n.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-localization | SDK 54 bundle | Device locale detection | Already wired in `lib/i18n.ts` |

**Installation:** No new npm dependencies — ARCH-04 milestone constraint enforced.

---

## Architecture Patterns

### Files Modified (exhaustive list)

```
lib/
├── semantic/
│   └── effect-toasts.ts         # NEW — EFFECT_TOASTS constant dictionary
├── mascot/
│   ├── haptics.ts               # EXTEND — 4 new exported haptic functions
│   ├── companion-engine.ts      # EXTEND — 20 MESSAGE_TEMPLATES sub-type keys + pickCompanionMessage subType logic
│   └── companion-types.ts       # EXTEND — subType?: CategoryId on CompanionMessageContext
components/
└── mascot/
    └── HarvestBurst.tsx         # EXTEND — variant prop (golden/rare/ambient)
locales/
├── fr/common.json               # EXTEND — 20 companion sub-type template keys
└── en/common.json               # EXTEND — 20 companion sub-type template keys
hooks/
└── useGamification.ts           # EXTEND — feedback dispatch after applyTaskEffect()
app/(tabs)/
└── tasks.tsx                    # FIX — pass taskMeta to completeTask()
```

### Pattern 1: EFFECT_TOASTS Constant Dictionary

**What:** A pure constant module `lib/semantic/effect-toasts.ts` mapping each `CategoryId` to display data for the rich toast.
**When to use:** Called in `useGamification.ts` after `applyTaskEffect()` returns a non-null `effectApplied`.

```typescript
// lib/semantic/effect-toasts.ts
import type { CategoryId } from './categories';
import type { ToastType } from '../../contexts/ToastContext'; // or inline the type

export interface EffectToastDef {
  icon: string;
  fr: string;
  en: string;
  subtitle_fr: string;
  subtitle_en: string;
  type: 'success' | 'info';
}

export const EFFECT_TOASTS: Record<CategoryId, EffectToastDef> = {
  menage_quotidien: { icon: '🌿', fr: 'Ménage : mauvaises herbes retirées !', en: 'Housework: weeds removed!', subtitle_fr: 'Ferme plus propre', subtitle_en: 'Cleaner farm', type: 'success' },
  menage_hebdo:     { icon: '🔧', fr: 'Grand ménage : usure réparée !', en: 'Deep clean: wear repaired!', subtitle_fr: 'Ferme comme neuve', subtitle_en: 'Farm like new', type: 'success' },
  courses:          { icon: '🚀', fr: 'Courses faites : turbo bâtiments 24h !', en: 'Shopping done: building turbo 24h!', subtitle_fr: 'Production ×2', subtitle_en: 'Production ×2', type: 'success' },
  enfants_routines: { icon: '💛', fr: 'Routines enfants : compagnon heureux !', en: 'Child routines: happy companion!', subtitle_fr: 'Humeur au max', subtitle_en: 'Mood maxed', type: 'success' },
  enfants_devoirs:  { icon: '📚', fr: 'Devoirs : sprint de croissance activé !', en: 'Homework: growth sprint active!', subtitle_fr: 'Stade plus vite', subtitle_en: 'Faster growth', type: 'info' },
  rendez_vous:      { icon: '💎', fr: 'Rendez-vous : graine rare obtenue !', en: 'Appointment: rare seed earned!', subtitle_fr: 'Récolte précieuse', subtitle_en: 'Precious harvest', type: 'success' },
  gratitude_famille:{ icon: '✨', fr: 'Gratitude : trait de saga boosté !', en: 'Gratitude: saga trait boosted!', subtitle_fr: 'Voyageur renforcé', subtitle_en: 'Traveler empowered', type: 'info' },
  budget_admin:     { icon: '🏦', fr: 'Budget réglé : capacité ×2 pendant 24h !', en: 'Budget done: capacity ×2 for 24h!', subtitle_fr: 'Bâtiments pleins vite', subtitle_en: 'Buildings fill fast', type: 'success' },
  bebe_soins:       { icon: '🌟', fr: 'Soins bébé : récolte dorée ×3 !', en: 'Baby care: golden harvest ×3!', subtitle_fr: 'Prochaine récolte épique', subtitle_en: 'Next harvest epic', type: 'success' },
  cuisine_repas:    { icon: '🍳', fr: 'Repas préparé : recette rare débloquée !', en: 'Meal done: rare recipe unlocked!', subtitle_fr: 'Nouveau craft disponible', subtitle_en: 'New craft available', type: 'info' },
};
```

### Pattern 2: HarvestBurst Variant Prop

**What:** Extend `HarvestBurstProps` with an optional `variant` prop that controls particle count, size, travel distance, duration, and label color.
**When to use:** Variant is passed from `useGamification` result to the component mounting point.

```typescript
// components/mascot/HarvestBurst.tsx — extended props
export type HarvestBurstVariant = 'ambient' | 'rare' | 'golden';

interface HarvestBurstProps {
  x: number;
  y: number;
  reward: number;
  cropColor: string;
  onComplete: () => void;
  variant?: HarvestBurstVariant;  // NEW — defaults to 'ambient' (unchanged behavior)
}

// Variant config mapping (add as module constant)
const VARIANT_CONFIG: Record<HarvestBurstVariant, {
  particleCount: number;
  particleSize: number;
  travelMin: number;
  travelMax: number;
  labelTravelY: number;
  labelDuration: number;
  labelColor: string;
  particleColor: string;
}> = {
  ambient: { particleCount: 8,  particleSize: 6, travelMin: 25, travelMax: 45, labelTravelY: -45,  labelDuration: 800,  labelColor: '#FFD700', particleColor: '#34D399' },
  rare:    { particleCount: 10, particleSize: 6, travelMin: 30, travelMax: 50, labelTravelY: -50,  labelDuration: 900,  labelColor: '#C4B5FD', particleColor: '#A78BFA' },
  golden:  { particleCount: 12, particleSize: 8, travelMin: 35, travelMax: 60, labelTravelY: -60,  labelDuration: 1000, labelColor: '#FFD700', particleColor: '#FFD700' },
};
```

Category-to-variant mapping (for use in `useGamification.ts`):

```typescript
// Inline in useGamification.ts or in effect-toasts.ts
const CATEGORY_VARIANT: Record<CategoryId, HarvestBurstVariant> = {
  bebe_soins:       'golden',
  rendez_vous:      'golden',
  cuisine_repas:    'rare',
  gratitude_famille:'rare',
  budget_admin:     'rare',
  menage_quotidien: 'ambient',
  menage_hebdo:     'ambient',
  courses:          'ambient',
  enfants_routines: 'ambient',
  enfants_devoirs:  'ambient',
};
```

### Pattern 3: Haptic Functions (extend haptics.ts)

**What:** 4 new exported functions following exact existing patterns (`if (isWeb) return;`, `async function`, `delay()` helper).
**Per UI-SPEC decision:**

```typescript
// lib/mascot/haptics.ts — append after existing exports

/** Effet léger — ménage quotidien et hebdomadaire */
export function hapticsEffectLight() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Effet modéré — courses, routines enfants, devoirs, budget */
export async function hapticsEffectMedium() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(80);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Effet chaleureux — cuisine, gratitude */
export async function hapticsEffectStrong() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(80);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Effet épique — soins bébé, rendez-vous (mirrors hapticsEvolution cadence) */
export async function hapticsEffectGolden() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(100);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(80);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await delay(150);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
```

Category-to-haptic mapping:
```typescript
const CATEGORY_HAPTIC_FN: Record<CategoryId, () => void | Promise<void>> = {
  menage_quotidien: hapticsEffectLight,
  menage_hebdo:     hapticsEffectLight,
  courses:          hapticsEffectMedium,
  enfants_routines: hapticsEffectMedium,
  enfants_devoirs:  hapticsEffectMedium,
  budget_admin:     hapticsEffectMedium,
  cuisine_repas:    hapticsEffectStrong,
  gratitude_famille:hapticsEffectStrong,
  rendez_vous:      hapticsEffectGolden,
  bebe_soins:       hapticsEffectGolden,
};
```

### Pattern 4: Companion sub-type extension

**What:** Add `subType?: CategoryId` to `CompanionMessageContext`. Update `pickCompanionMessage` to resolve sub-type templates before the generic pool.

```typescript
// companion-types.ts
export interface CompanionMessageContext {
  // ... existing fields ...
  subType?: CategoryId;  // NEW — Phase 21 semantic category context
}
```

```typescript
// companion-engine.ts — updated pickCompanionMessage
export function pickCompanionMessage(
  event: CompanionEvent,
  context: CompanionMessageContext,
): string {
  // Sub-type lookup for task_completed events (Phase 21)
  if (event === 'task_completed' && context.subType) {
    const subKey = `task_completed_${context.subType}` as keyof typeof MESSAGE_TEMPLATES;
    const subTemplates = MESSAGE_TEMPLATES[subKey];
    if (subTemplates && subTemplates.length > 0) {
      return subTemplates[Math.floor(Math.random() * subTemplates.length)];
    }
  }
  // Fallback — existing behavior
  const templates = MESSAGE_TEMPLATES[event];
  if (!templates || templates.length === 0) {
    return MESSAGE_TEMPLATES.greeting[0];
  }
  return templates[Math.floor(Math.random() * templates.length)];
}
```

New MESSAGE_TEMPLATES sub-type keys (10 entries, 2 strings each):
```typescript
// Pattern: key = `task_completed_${categoryId}` — e.g. `task_completed_menage_quotidien`
// In MESSAGE_TEMPLATES Record, these require the CompanionEvent union to be widened OR
// the Record type be changed to Record<string, string[]>
// DECISION: Use Record<string, string[]> for MESSAGE_TEMPLATES to avoid modifying CompanionEvent union
```

**Important:** `MESSAGE_TEMPLATES` is typed `Record<CompanionEvent, string[]>`. Adding sub-type keys with form `task_completed_menage_quotidien` requires either: (a) extending `CompanionEvent` union with 10 new literal types, or (b) widening `MESSAGE_TEMPLATES` to `Record<string, string[]>`. Option (b) is simpler and non-breaking — `pickCompanionMessage` casts the lookup key as `string` and TypeScript is satisfied. Use `Record<string, string[]>` for the extended type or use a separate `SUB_TYPE_TEMPLATES` dictionary.

**Recommended approach:** Use a separate constant `SUB_TYPE_TEMPLATES: Partial<Record<string, string[]>>` in `companion-engine.ts` — this avoids widening the core `MESSAGE_TEMPLATES` type and keeps the type boundary clean.

### Pattern 5: Feedback dispatch in useGamification.ts

**What:** After `applyTaskEffect()` returns in `completeTask()`, dispatch all feedback when `effectResult.effectApplied !== null`.

```typescript
// hooks/useGamification.ts — inside completeTask(), after effectResult is set
if (effectResult?.effectApplied && category) {
  const catId = category.id;
  // 1. Toast (requires i18n language from context — pass language or read from i18n.language)
  const toastDef = EFFECT_TOASTS[catId];
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  if (toastDef && showToast) {
    showToast(
      lang === 'en' ? toastDef.en : toastDef.fr,
      toastDef.type,
      undefined,
      { icon: toastDef.icon, subtitle: lang === 'en' ? toastDef.subtitle_en : toastDef.subtitle_fr }
    );
  }
  // 2. Haptics (fire-and-forget, non-critical)
  try { CATEGORY_HAPTIC_FN[catId]?.(); } catch { /* non-critical */ }
  // 3. HarvestBurst variant — returned to caller, caller triggers the animation
  // (see return type change below)
}
```

**Return type extension:** `completeTask` currently returns `{ updatedProfile, lootAwarded, pointsGained, cropsMatured, effectResult }`. Add `effectVariant?: HarvestBurstVariant` and `effectCategoryId?: CategoryId` so the UI layer (tasks.tsx or future callers) can trigger HarvestBurst at the right screen position.

**i18n access in hook:** `useGamification` is a React hook — it can call `useTranslation()` from react-i18next to get `i18n.language`, or import `i18n` directly from `lib/i18n.ts`. Direct import is simpler since the hook doesn't render UI. Use `import i18n from '../lib/i18n'` and read `i18n.language`.

### Pattern 6: i18n locale key structure

Existing companion message keys live in `locales/fr/common.json` under `companion.msg.*`. The sub-type keys follow the same nesting:

```json
// locales/fr/common.json — inside companion.msg
{
  "companion": {
    "msg": {
      "taskDone": { "1": "...", "2": "...", "3": "..." },
      "taskDone_menage_quotidien": {
        "1": "Tu as fait le ménage quotidien — {{companionName}} est content, plus d'herbes sur la ferme !",
        "2": "Bien joue pour le ménage ! {{companionName}} a vu les herbes disparaître de la parcelle."
      },
      "taskDone_menage_hebdo": { ... },
      // ... 8 more categories
    }
  }
}
```

**Key naming:** The `MESSAGE_TEMPLATES` keys use format `companion.msg.taskDone.{n}` which maps to the JSON path `companion.msg.taskDone.{n}`. For sub-types, the key will be `companion.msg.taskDone_menage_quotidien.{n}` — note the underscore join, not dot, to avoid collision with existing `taskDone` object. Alternatively use the flat key pattern already used in MESSAGE_TEMPLATES (e.g. `companion.msg.taskDone.menage_quotidien.1`). Either works; use the dot-path pattern for consistency with existing keys.

### Pattern 7: taskMeta fix in tasks.tsx

`completeTask` currently receives no `taskMeta`. The task object has all needed fields:

```typescript
// app/(tabs)/tasks.tsx — handleTaskToggle
const { lootAwarded, pointsGained } = await completeTask(
  activeProfile,
  task.text,
  { tags: task.tags, section: task.section, sourceFile: task.sourceFile }  // ADD THIS
);
```

This is the prerequisite for ANY semantic coupling to fire — it was likely already wired in Phase 20 execution but must be verified during implementation.

### Anti-Patterns to Avoid

- **Sequencing toast after HarvestBurst:** D-02 is explicit — both fire in parallel immediately at completion.
- **Showing toast when cap exceeded:** D-03 — the cap check happens in `useGamification` before `applyTaskEffect`. If cap exceeded, `effectResult.effectApplied` is `null`, so the `if (effectResult?.effectApplied)` guard handles this correctly.
- **Widening CompanionEvent union:** Adding 10 new literal types to `CompanionEvent` would break the exhaustive `MESSAGE_TEMPLATES` Record and all switch statements. Use a separate `SUB_TYPE_TEMPLATES` dictionary instead.
- **Hardcoding colors inside useThemeColors scope:** Golden and rare particle colors are cosmetic constants (per `#FFD700` precedent in existing HarvestBurst). Ambient uses `colors.success` from theme. Do not hardcode ambient color.
- **Calling haptics from UI component:** Haptics should fire from `useGamification.ts` alongside toast, not from a React render. HarvestBurst already calls its own haptic (`Haptics.impactAsync(Light)` + `Haptics.notificationAsync(Success)`) — the new effect haptic adds on top. Consider skipping the HarvestBurst internal haptic for effect bursts to avoid double haptic, OR accept the layering (two haptics close together is intentional for celebration).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notification UI | Custom overlay component | `ToastContext.showToast()` with `options.icon` + `options.subtitle` | Rich layout already built and tested |
| Particle animation | New animation system | `HarvestBurst` extended with `variant` prop | All Reanimated wiring exists |
| Haptic sequencing | setTimeout chains without pattern | `delay()` helper in `haptics.ts` + existing patterns | Consistent async pattern throughout codebase |
| i18n parity testing | Manual comparison | Existing `cohérence des fichiers de traduction` Jest test | Auto-validates FR key = EN key coverage |
| Companion message picking | Custom selection logic | `pickCompanionMessage()` extended with sub-type lookup | Existing random selection + AI fallback chain |

---

## Common Pitfalls

### Pitfall 1: taskMeta not passed in tasks.tsx
**What goes wrong:** Semantic coupling never fires — `deriveTaskCategory()` returns null because `task.tags`, `task.section`, `task.sourceFile` are all missing. No feedback, no effect.
**Why it happens:** `tasks.tsx` was written before Phase 20 and passes only `task.text` to `completeTask`.
**How to avoid:** Pass `{ tags: task.tags, section: task.section, sourceFile: task.sourceFile }` as `taskMeta`. This is the **first thing to verify** before testing feedback.
**Warning signs:** Toast never appears even with debug tasks in known categories.

### Pitfall 2: Companion sub-type key collision with CompanionEvent union
**What goes wrong:** Adding `task_completed_menage_quotidien` to `MESSAGE_TEMPLATES: Record<CompanionEvent, string[]>` causes a TypeScript error because the key is not in the `CompanionEvent` union.
**Why it happens:** `CompanionEvent` is a strict discriminated union used elsewhere (switch statements, message templates).
**How to avoid:** Use a separate exported constant `SUB_TYPE_TEMPLATES: Partial<Record<string, string[]>>` in `companion-engine.ts`, lookup there first in `pickCompanionMessage`.

### Pitfall 3: Double haptic on HarvestBurst
**What goes wrong:** Two haptic sequences fire nearly simultaneously — the existing `HarvestBurst` internal `Haptics.impactAsync(Light)` + `Haptics.notificationAsync(Success)` plus the new effect haptic pattern.
**Why it happens:** `HarvestBurst.tsx` unconditionally fires haptics in its `useEffect`. The new effect haptic fires from `useGamification`.
**How to avoid:** Either (a) add a `skipHaptic?: boolean` prop to `HarvestBurst` for the variant case, or (b) accept the layering intentionally — golden variant haptic + HarvestBurst haptic together creates a richer sensation. Per UI-SPEC the variant animations already reference the golden haptic cadence. Accept layering.

### Pitfall 4: showToast called from a hook (not component)
**What goes wrong:** `useToast()` can only be called inside a React component. `useGamification` is a hook — it CAN call `useToast()` since hooks can call other hooks.
**Why it happens:** Misread of React hook rules.
**How to avoid:** Add `const { showToast } = useToast();` inside `useGamification`. It is a hook calling another hook — this is valid. No prop drilling needed.
**Alternative (if preferred):** Return `effectVariant` and `effectCategoryId` from `completeTask` and let `tasks.tsx` call `showToast`. This avoids coupling the hook to ToastContext. Either approach is valid; hook-level dispatch is simpler.

### Pitfall 5: HarvestBurst state in tasks.tsx vs tree.tsx
**What goes wrong:** `HarvestBurst` is rendered in `tree.tsx` (farm screen). When a task is completed from `tasks.tsx` (tasks screen), the user may not be on the farm — the burst would be invisible.
**Why it happens:** The burst animation is position-anchored to farm crop cells.
**How to avoid:** The burst for effect completion is NOT the farm crop harvest burst. It should be a new full-screen burst triggered by a shared state — OR the burst is only shown when the user IS on the farm tab. Per the UI-SPEC design contract, the burst fires "in parallel" but is a separate state trigger. The simplest implementation: `completeTask` returns `{ effectVariant, effectCategoryId }`, and the consumer (tasks.tsx, or a shared context) triggers it only if on the farm screen. OR: use a simple full-screen position (center of screen) regardless of farm layout — the burst is not tied to a crop cell position for effect bursts.

**Resolution:** For Phase 21, position the effect HarvestBurst at screen center (position `{ x: screenWidth/2, y: screenHeight/3 }`), independent of farm crop positions. This allows it to fire from any screen without farm layout knowledge. A dedicated `effectBurst` state separate from `harvestBurst` should be used.

### Pitfall 6: Locale key format mismatch between MESSAGE_TEMPLATES and i18n JSON
**What goes wrong:** `MESSAGE_TEMPLATES` uses `companion.msg.taskDone.1` (dot-separated string) but `useTranslation` resolves `companion.msg.taskDone.1` as nested JSON path `companion → msg → taskDone → 1`. If template key format changes for sub-types, the translation lookup fails silently.
**Why it happens:** i18next resolves keys as JSON paths using dots as separators.
**How to avoid:** Keep sub-type keys consistent with existing pattern: `companion.msg.taskDone_menage_quotidien.1` where the underscore-joined category name is one path segment at the `taskDone_` level. Verify in JSON: `{ "companion": { "msg": { "taskDone_menage_quotidien": { "1": "...", "2": "..." } } } }`.

---

## Code Examples

### Dispatch block in useGamification.ts (verified pattern)

```typescript
// After effectResult = applyTaskEffect(category, farmData) and effectApplied is non-null:
if (effectResult.effectApplied && category) {
  const catId = category.id;
  const toastDef = EFFECT_TOASTS[catId];
  if (toastDef) {
    const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
    showToast(
      lang === 'en' ? toastDef.en : toastDef.fr,
      toastDef.type,
      undefined,
      { icon: toastDef.icon, subtitle: lang === 'en' ? toastDef.subtitle_en : toastDef.subtitle_fr }
    );
  }
  try { await CATEGORY_HAPTIC_FN[catId]?.(); } catch { /* haptic — non-critical */ }
}
```

### HarvestBurst variant rendering (verified pattern)

```typescript
// HarvestBurst.tsx — inside the component, derive config from variant prop
const variant: HarvestBurstVariant = props.variant ?? 'ambient';
const cfg = VARIANT_CONFIG[variant];

// Pass cfg.particleCount to Array.from({ length: cfg.particleCount })
// Pass cfg.particleColor as color, cfg.particleSize as PARTICLE_SIZE
// Pass cfg.labelTravelY and cfg.labelDuration to withTiming
// Pass cfg.labelColor to rewardLabel style
```

### Locale JSON structure (verified from existing common.json)

```json
{
  "companion": {
    "msg": {
      "taskDone": { "1": "...", "2": "...", "3": "..." },
      "taskDone_menage_quotidien": {
        "1": "Tu as fait le ménage — {{companionName}} a vu les herbes disparaître !",
        "2": "Bien joué pour le ménage quotidien, la parcelle est plus propre !"
      }
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic `task_completed` companion message | Sub-typed `task_completed_${categoryId}` with category-specific text | Phase 21 | Companion references the actual task category + farm effect |
| Single HarvestBurst (8 particles, green) | 3 variants: ambient/rare/golden with distinct colors and counts | Phase 21 | Visual intensity matches effect importance |
| Shared haptic (Light impact) on harvest | 4 distinct patterns per effect intensity group | Phase 21 | Tactile differentiation between routine vs. epic moments |

---

## Open Questions

1. **HarvestBurst rendering location for tasks.tsx**
   - What we know: `harvestBurst` state lives in `tree.tsx`, anchored to farm crop cell positions.
   - What's unclear: Should effect-triggered bursts fire from `tasks.tsx` at screen center, or only fire on the farm screen?
   - Recommendation: Implement effect burst as center-screen overlay in `tasks.tsx` (or via a shared Toast-like context), using a fixed position. Keep farm crop bursts unchanged in `tree.tsx`. This is the simplest path — avoid cross-screen state sharing.

2. **showToast access in useGamification hook**
   - What we know: `useToast()` is a hook, `useGamification` is a hook — hooks can call hooks.
   - What's unclear: Whether the existing code prefers prop-drilling `showToast` or hook-level access.
   - Recommendation: Add `useToast()` directly inside `useGamification`. No interface change needed.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 21 is purely code/config changes using existing installed libraries. No external tools, CLIs, databases, or new runtimes are required. `expo-haptics` and `react-native-reanimated` are already in the project.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is skipped.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `components/mascot/HarvestBurst.tsx` — particle system, props, animation pattern
- Direct code inspection: `contexts/ToastContext.tsx` — `showToast(message, type, action?, options?)` API, `ToastOptions` type, rich layout trigger
- Direct code inspection: `lib/mascot/haptics.ts` — `delay()` helper, `isWeb` guard, existing function patterns
- Direct code inspection: `lib/mascot/companion-engine.ts` — `MESSAGE_TEMPLATES`, `pickCompanionMessage`, sub-type extension point
- Direct code inspection: `lib/mascot/companion-types.ts` — `CompanionMessageContext`, `CompanionEvent` union
- Direct code inspection: `lib/semantic/effects.ts` — `EffectResult`, `EffectId`, `applyTaskEffect()` return contract
- Direct code inspection: `lib/semantic/categories.ts` — `CategoryId` type, 10 canonical category IDs
- Direct code inspection: `hooks/useGamification.ts` — `completeTask` flow, `effectResult` return, farm write block
- Direct code inspection: `app/(tabs)/tasks.tsx` — current `completeTask` call site (no taskMeta)
- Direct code inspection: `locales/fr/common.json` + `locales/en/common.json` — companion message key format
- Direct code inspection: `lib/i18n.ts` — i18next setup, namespace list, `i18n.language` access
- Direct code inspection: `.planning/phases/21-feedback-visuel-compagnon/21-UI-SPEC.md` — all visual/haptic/copy contracts locked by UI design phase

### Secondary (MEDIUM confidence)
- `.planning/phases/21-feedback-visuel-compagnon/21-CONTEXT.md` — user decisions D-01..D-06

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new deps
- Architecture: HIGH — all integration points read from live code
- Pitfalls: HIGH — derived from actual code inspection (taskMeta gap in tasks.tsx confirmed, CompanionEvent union constraint confirmed, HarvestBurst screen-scope gap confirmed)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable codebase — no external dependencies)
