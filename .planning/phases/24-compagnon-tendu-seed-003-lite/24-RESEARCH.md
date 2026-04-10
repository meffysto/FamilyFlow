# Phase 24: Compagnon étendu (SEED-003 lite) — Research

**Researched:** 2026-04-10
**Domain:** React Native companion engine extension — SecureStore persistence, proactive event wiring, dashboard integration
**Confidence:** HIGH (all findings derived from existing codebase — no new dependencies)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Persistance messages (COMPANION-06)**
- D-01: SecureStore JSON — clé unique par profil (`companion_messages_{profileId}`), même pattern que les caps anti-abus Phase 20
- D-02: Garder les 5 derniers messages — suffisant pour l'anti-répétition IA (mémoire courte actuelle = 3) et léger en SecureStore
- D-03: Chaque message persisté contient : `text` (message affiché), `event` (CompanionEvent type), `timestamp` (ISO datetime)
- D-04: Au mount, charger les messages persistés dans `companionRecentMessagesRef` pour alimenter l'anti-répétition IA dès le premier message

**Triggers cross-feature**
- D-05: Dashboard seulement — le dashboard affiche `morning_greeting` (première ouverture matin) et `weekly_recap` (dimanche soir). Les events d'action (task_completed, harvest, etc.) restent sur tree.tsx
- D-06: Affichage par bulle inline — petite section compagnon en haut du dashboard avec avatar + bulle de texte, discret et cohérent avec l'UI existante
- D-07: Pas de provider global pour cette phase — le compagnon reste câblé localement (tree.tsx + dashboard)

**Timing & fréquence**
- D-08: Pas de `celebration` (streak%7) dans cette phase — retirer de `detectProactiveEvent()` ou le laisser dormant (Claude's discretion)
- D-09: `weekly_recap` déclenché dimanche entre 18h et 21h, première ouverture dans ce créneau
- D-10: `gentle_nudge` limité à 1 seul par jour — persister un flag `nudge_shown_today` pour éviter les doublons
- D-11: Conserver les créneaux existants inchangés : morning 6h-11h, nudge 14h-19h, comeback >24h

### Claude's Discretion
- Implémentation technique de la bulle inline sur le dashboard (composant, animation)
- Comment gérer le flag `celebration` : supprimer de detectProactiveEvent ou simplement désactiver
- Structure exacte du weekly recap (layout, quelles stats de couplage afficher)
- Pattern de chargement async des messages persistés au mount

### Deferred Ideas (OUT OF SCOPE)
- Provider global CompanionProvider pour messages sur tous les écrans — futur milestone
- Celebration streak (multiples de 7) — réactiver dans un futur milestone si demandé
- Historique complet des messages compagnon consultable (au-delà des 5 derniers) — futur milestone
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMPANION-01 | User sees a weekly_recap companion message on Sunday evenings with coupling stats | D-09, loadWeekStats() already available in lib/semantic/coupling-overrides.ts; detectProactiveEvent needs weekly_recap condition |
| COMPANION-02 | User sees a morning_greeting message on first daily open (6h-11h) | detectProactiveEvent already handles morning_greeting in tree.tsx; needs wiring into dashboard |
| COMPANION-03 | User sees a celebration message on streak multiples of 7 | **EXCLUDED from this phase per D-08** — celebration stays dormant |
| COMPANION-04 | User sees a gentle_nudge message if no task completed by afternoon | detectProactiveEvent already handles nudge 14h-19h; needs D-10 flag `nudge_shown_today` |
| COMPANION-05 | User sees a comeback message after >24h absence | detectProactiveEvent already returns 'comeback' for hoursSinceLastVisit > 24; works from tree.tsx and dashboard |
| COMPANION-06 | User's companion messages are persisted across app restarts (not RAM-only) | saveToMemory in tree.tsx writes only to ref; needs SecureStore persistence using D-01/D-02/D-03 pattern |
</phase_requirements>

---

## Summary

Phase 24 extends an already-built companion engine to wire 4 proactive event types (morning_greeting, gentle_nudge, comeback, weekly_recap) into actual triggers, persist messages beyond RAM, and integrate the companion bubble into the dashboard screen.

The companion engine in `lib/mascot/companion-engine.ts` already contains all the logic: `detectProactiveEvent()` handles all 4 target event types, `MESSAGE_TEMPLATES` has string arrays for each, `buildCompanionPrompt()` generates personalised AI prompts per species, and the daily AI budget system is fully implemented. The `celebration` case in `detectProactiveEvent()` should be commented-out or guarded, not deleted, to keep it dormant per D-08.

The dashboard integration is the new integration point. `app/(tabs)/index.tsx` currently imports `CompanionAvatarMini` and accesses `activeProfile.companion` for the header avatar — the companion data is already flowing into the dashboard. What's missing is: (1) a `DashboardCompanion` section component that triggers proactive messages on mount, (2) a `saveToMemory` equivalent that also writes to SecureStore, and (3) the `nudge_shown_today` flag. The weekly recap stats are already available via `loadWeekStats()` from `lib/semantic/coupling-overrides.ts`.

**Primary recommendation:** Build the phase in two plans — Plan 01 persists messages (SecureStore I/O, hydration at mount), Plan 02 wires the dashboard bubble (new component + weekly_recap trigger + nudge flag).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-secure-store | ~14.x (SDK 54) | Persist messages JSON per profile | Already used for companion_last_visit, coupling-caps, semantic-stats-week |
| react-native-reanimated | ~4.1 | Bubble entrance animation | CLAUDE.md mandatory for all animations |
| expo-haptics | ~14.x | Tactile feedback on message show | Already used in tree.tsx companion tap |

### Already-Built (Reuse Directly)
| Module | What to Reuse | Where |
|--------|---------------|-------|
| `lib/semantic/caps.ts` | `loadCaps` / `saveCaps` pattern | Template for `loadCompanionMessages` / `saveCompanionMessages` |
| `lib/semantic/coupling-overrides.ts` | `loadWeekStats()` | Weekly recap stats for COMPANION-01 |
| `lib/mascot/companion-engine.ts` | `detectProactiveEvent`, `pickCompanionMessage`, `generateCompanionAIMessage` | All proactive logic |
| `lib/mascot/companion-engine.ts` | `MESSAGE_TEMPLATES.weekly_recap` / `morning_greeting` / `gentle_nudge` / `comeback` | Template fallbacks — already declared |
| `components/mascot/CompanionAvatarMini` | Avatar sprite component | Reuse in dashboard bubble |
| `app/(tabs)/tree.tsx` `showCompanionMsg` | Message display + timer pattern | Port into dashboard section |

**No new npm dependencies required** (satisfies ARCH-04).

---

## Architecture Patterns

### Recommended File Structure (New Files)

```
lib/mascot/
└── companion-storage.ts      # loadCompanionMessages / saveCompanionMessages

components/dashboard/
└── DashboardCompanion.tsx    # New dashboard section: avatar + bulle
```

### Existing Files to Modify

```
lib/mascot/companion-engine.ts   # Comment-out celebration in detectProactiveEvent (D-08)
app/(tabs)/tree.tsx              # saveToMemory → also write to SecureStore; hydrate at mount
app/(tabs)/index.tsx             # Add DashboardCompanion section (D-05, D-06)
components/dashboard/index.ts   # Export DashboardCompanion
```

### Pattern 1: Message Persistence — companion-storage.ts

Mirror `lib/semantic/caps.ts` pattern exactly:

```typescript
// lib/mascot/companion-storage.ts
import * as SecureStore from 'expo-secure-store';

export interface PersistedCompanionMessage {
  text: string;                // message affiché (traduit)
  event: string;               // CompanionEvent type
  timestamp: string;           // ISO datetime
}

const MESSAGES_KEY_PREFIX = 'companion_messages_';

export async function loadCompanionMessages(profileId: string): Promise<PersistedCompanionMessage[]> {
  try {
    const raw = await SecureStore.getItemAsync(`${MESSAGES_KEY_PREFIX}${profileId}`);
    if (!raw) return [];
    return JSON.parse(raw) as PersistedCompanionMessage[];
  } catch {
    return [];
  }
}

export async function saveCompanionMessages(
  profileId: string,
  messages: PersistedCompanionMessage[],
): Promise<void> {
  try {
    // Keep last 5 only (D-02)
    const toSave = messages.slice(-5);
    await SecureStore.setItemAsync(
      `${MESSAGES_KEY_PREFIX}${profileId}`,
      JSON.stringify(toSave),
    );
  } catch { /* non-critical */ }
}
```

Confidence: HIGH — identical to caps.ts already in production.

### Pattern 2: Hydration at Mount in tree.tsx

```typescript
// In tree.tsx useEffect([profile.id])
useEffect(() => {
  if (!activeProfile?.id) return;
  loadCompanionMessages(activeProfile.id).then(msgs => {
    // Inject text-only into recentMessages ref for anti-repetition
    companionRecentMessagesRef.current = msgs.map(m => m.text).slice(-5);
  });
}, [activeProfile?.id]);
```

Then extend `saveToMemory` to also write to SecureStore:

```typescript
const saveToMemory = useCallback((msg: string, event: CompanionEvent = 'greeting') => {
  if (!companionRef.current || !activeProfileRef.current || !msg) return;
  const recent = companionRecentMessagesRef.current;
  if (recent.length > 0 && recent[recent.length - 1] === msg) return;
  const updated = [...recent, msg].slice(-5);
  companionRecentMessagesRef.current = updated;
  // Persist — fire and forget
  const profileId = activeProfileRef.current.id;
  loadCompanionMessages(profileId).then(existing => {
    const entry: PersistedCompanionMessage = {
      text: msg, event, timestamp: new Date().toISOString(),
    };
    saveCompanionMessages(profileId, [...existing, entry]);
  });
}, []);
```

### Pattern 3: Dashboard Companion Bubble (DashboardCompanion.tsx)

The dashboard already imports `CompanionAvatarMini` and has `activeProfile.companion`. The new section follows the standard dashboard section pattern:

```typescript
// Follows DashboardInsights pattern: read vault data, generate on mount
export function DashboardCompanion({ isChildMode, ... }: DashboardSectionProps) {
  const { activeProfile, tasks } = useVault();
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const [message, setMessage] = useState<string | null>(null);
  const ai = useAI();

  useEffect(() => {
    // Trigger morning_greeting or weekly_recap on mount
    // (gentle_nudge and comeback handled by tree.tsx via detectProactiveEvent)
    ...
  }, [activeProfile?.id]);

  if (!activeProfile?.companion || !message) return null;

  return (
    <SectionErrorBoundary>
      <View style={styles.container}>
        <CompanionAvatarMini ... />
        <Animated.View entering={FadeInDown} style={styles.bubble}>
          <Text>{message}</Text>
        </Animated.View>
      </View>
    </SectionErrorBoundary>
  );
}
```

### Pattern 4: weekly_recap Detection

The dashboard `index.tsx` already calls `SecureStore` on mount. Add a `weekly_recap` gate alongside existing patterns:

```typescript
// Sunday 18h-21h gate (D-09)
function shouldShowWeeklyRecap(): boolean {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() >= 18 && now.getHours() < 21;
}
```

Weekly stats passed to companion context come from `loadWeekStats()` — already available.

### Pattern 5: nudge_shown_today Flag (D-10)

Use the same SecureStore per-profile pattern with a date-keyed string:

```typescript
const NUDGE_FLAG_KEY_PREFIX = 'companion_nudge_shown_';

async function hasNudgeShownToday(profileId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const stored = await SecureStore.getItemAsync(`${NUDGE_FLAG_KEY_PREFIX}${profileId}`);
  return stored === today;
}

async function markNudgeShownToday(profileId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await SecureStore.setItemAsync(`${NUDGE_FLAG_KEY_PREFIX}${profileId}`, today).catch(() => {});
}
```

### Pattern 6: celebration — Keep Dormant

Per D-08, the simplest approach is to comment-out the celebration condition in `detectProactiveEvent()` rather than delete it. This preserves the code for future milestone reactivation:

```typescript
// D-08: celebration désactivée en Phase 24 — réactiver dans un futur milestone
// if (ctx.streak > 0 && ctx.streak % 7 === 0) return 'celebration';
```

### Anti-Patterns to Avoid

- **Creating a CompanionProvider**: D-07 explicitly prohibits a global provider for this phase. Wire locally in tree.tsx and dashboard only.
- **Swipe inside ScrollView**: dashboard uses ScrollView — use tap to dismiss the companion bubble, not swipe gesture.
- **Deleting celebration from detectProactiveEvent**: Comment it out so the future milestone can uncomment, do not delete.
- **AI call blocking mount**: Always show the template fallback immediately, fire AI call async (existing pattern in tree.tsx must be preserved in dashboard).
- **Hardcoded colors**: Always use `useThemeColors()` / `colors.*` for the bubble background, border, text — never hardcoded hex values.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message persistence | Custom AsyncStorage wrapper | SecureStore via caps.ts pattern | Already in production; handles parse errors, returns safe defaults |
| Anti-repetition | Custom deduplication logic | `companionRecentMessagesRef` + hydration from SecureStore | Already works; just needs hydration on mount |
| Coupling stats for weekly recap | Re-derive from caps | `loadWeekStats()` from coupling-overrides.ts | Already persists per-category weekly counts, auto-resets Monday |
| AI message generation | New AI pipeline | `generateCompanionAIMessage()` | Already handles cache TTL, daily budget, timeout, species personality |
| Companion avatar in bubble | New avatar component | `CompanionAvatarMini` | Already renders correct species/stage sprites |
| Animation | RN Animated or CSS | `useSharedValue` + `FadeInDown` from Reanimated 4 | CLAUDE.md mandatory |

---

## Common Pitfalls

### Pitfall 1: `saveToMemory` loses the `event` type when extending
**What goes wrong:** The current `saveToMemory` in tree.tsx only stores the message text. When extending to SecureStore (D-03 requires `event` + `timestamp`), the caller must also pass the `CompanionEvent` type.
**Why it happens:** `showCompanionMsg` calls `saveToMemory(displayMsg)` without the original event — the event type is only known at the `generateCompanionAIMessage` call site.
**How to avoid:** Thread the `event` parameter through: `showCompanionMsg(msg, context, duration, event)` → `saveToMemory(msg, event)`. The current signature has `msg` + `context` + `duration`; add `event` as optional last parameter with fallback `'greeting'`.

### Pitfall 2: Dashboard fires morning_greeting on every re-render
**What goes wrong:** If the `DashboardCompanion` useEffect depends on `activeProfile`, it reruns on any profile data update, potentially showing the morning greeting multiple times.
**Why it happens:** `activeProfile` is derived from vault state and mutates frequently.
**How to avoid:** Gate on the same `companion_last_visit` SecureStore key already used in tree.tsx. Check `isFirstVisitToday` (today's date !== stored date) before triggering. The two screens share this SecureStore key — once tree.tsx marks it, dashboard won't fire again.
**Warning signs:** Morning greeting appears twice in rapid succession.

### Pitfall 3: Race between tree.tsx and dashboard companion triggers
**What goes wrong:** User lands on tree.tsx tab first (companion trigger fires), then switches to dashboard (second trigger fires). Both screens check `isFirstVisitToday` against the same key, but tree.tsx may write first.
**Why it happens:** `companion_last_visit` is written in tree.tsx `useFocusEffect` — by the time dashboard mounts, the key is already today's date.
**How to avoid:** Dashboard trigger for `morning_greeting` reads `companion_last_visit` before triggering; if it's already today's date, skip — tree.tsx already fired. This is the correct behavior.

### Pitfall 4: weekly_recap triggered outside the Sunday 18h-21h window (D-09)
**What goes wrong:** The existing `detectProactiveEvent()` has no weekly_recap condition — if naively added at the wrong priority level, it could override `morning_greeting` on Sunday morning.
**Why it happens:** The proactive cascade in `detectProactiveEvent` checks conditions in order; weekly_recap must only trigger outside the 6h-11h morning window.
**How to avoid:** Add weekly_recap detection AFTER the morning_greeting block (after line 572 in companion-engine.ts), not before. Condition: `dayOfWeek === 0 && hour >= 18 && hour < 21`.

### Pitfall 5: `nudge_shown_today` flag not respected when dashboard is the trigger point
**What goes wrong:** If gentle_nudge is triggered by tree.tsx (existing detectProactiveEvent) AND dashboard, the user can see it twice on the same day.
**Why it happens:** Two independent trigger points with no shared state.
**How to avoid:** gentle_nudge triggers remain ONLY in tree.tsx (per D-05 — "les events d'action restent sur tree.tsx"). Dashboard only fires `morning_greeting` and `weekly_recap`. The nudge flag is still needed to guard tree.tsx re-entry.

### Pitfall 6: Hydration overwrites messages already accumulated in the current session
**What goes wrong:** If tree.tsx hydrates `companionRecentMessagesRef` from SecureStore on profile ID change, it may overwrite messages collected during the current session.
**Why it happens:** The useEffect fires on `activeProfile?.id` change; if profile switches mid-session, old session messages replace current ones.
**How to avoid:** Only hydrate when `companionRecentMessagesRef.current.length === 0` (cold start). If the ref already has messages (active session), skip hydration.

---

## Code Examples

### Weekly Stats Shape (from coupling-overrides.ts)

```typescript
// loadWeekStats() returns:
{
  weekKey: '2026-04-06',          // Monday of current week
  counts: {
    menage_quotidien: 3,
    courses: 1,
    rendez_vous: 2,
    // ... other CategoryIds with their trigger counts
  }
}
// totalEffects = Object.values(counts).reduce((a, b) => a + b, 0)
// topCategories = Object.entries(counts).sort(([,a],[,b]) => b - a).slice(0, 3)
```

### detectProactiveEvent — Current Implementation (to modify)

```typescript
// Current cascade in companion-engine.ts (lines 564-593):
export function detectProactiveEvent(ctx: ProactiveContext): CompanionEvent | null {
  if (ctx.hoursSinceLastVisit > 24) return 'comeback';
  if (!ctx.isFirstVisitToday) return null;
  if (ctx.currentHour >= 6 && ctx.currentHour <= 11) return 'morning_greeting';
  if (ctx.familyMilestone) return 'family_milestone';
  // D-08: comment out ↓
  if (ctx.streak > 0 && ctx.streak % 7 === 0) return 'celebration';
  // Add weekly_recap here (after morning window):
  // if (dayOfWeek === 0 && ctx.currentHour >= 18 && ctx.currentHour < 21) return 'weekly_recap';
  if (ctx.currentHour >= 14 && ctx.currentHour <= 19 && ctx.tasksToday === 0 && ctx.totalTasksToday > 0) return 'gentle_nudge';
  return null;
}
```

Note: `ProactiveContext` does not yet have `dayOfWeek` — needs adding for weekly_recap, or the check can be done at the call site before calling `detectProactiveEvent`.

### SecureStore Keys Summary (all keys for this phase)

| Key | Owner | Content | Reset |
|-----|-------|---------|-------|
| `companion_messages_{profileId}` | NEW Phase 24 | JSON array of 5 PersistedCompanionMessage | Never (rolling 5) |
| `companion_nudge_shown_{profileId}` | NEW Phase 24 | YYYY-MM-DD string | Daily (auto via comparison) |
| `companion_last_visit` | Existing (tree.tsx) | YYYY-MM-DD string | Daily |

---

## Open Questions

1. **weekly_recap trigger site: engine vs. call site?**
   - What we know: `detectProactiveEvent` has no `dayOfWeek` param in `ProactiveContext`
   - What's unclear: Should we add `dayOfWeek` to `ProactiveContext` (cleaner, testable) or check `new Date().getDay()` in the dashboard `useEffect` before calling `detectProactiveEvent` (no engine change needed)?
   - Recommendation: Add `isWeeklyRecapWindow?: boolean` to `ProactiveContext` — this keeps the engine testable (test can pass `true` to simulate Sunday evening) without hardcoding `Date` calls inside the engine.

2. **gentle_nudge: does it also need a dashboard trigger?**
   - What we know: D-05 says `gentle_nudge` stays on tree.tsx (action triggers only). D-04 (COMPANION-04) says "if no task completed by afternoon" — this condition is time-based, not action-based.
   - What's unclear: User who opens only the dashboard (not tree.tsx) in the afternoon will never see the nudge.
   - Recommendation: The CONTEXT.md D-05 is explicit — keep nudge on tree.tsx only for this phase. Dashboard handles only morning_greeting and weekly_recap. Document this scope limitation.

3. **`saveToMemory` signature change — backward compatible?**
   - What we know: `showCompanionMsg` → `saveToMemory(displayMsg)` is called from 3 places in tree.tsx.
   - What's unclear: Can we add an optional `event` param without touching all 3 call sites?
   - Recommendation: Make `event` optional with `'greeting'` default. Only the `useFocusEffect` call site knows the actual event; the others can keep the default. SecureStore entries will have `event: 'greeting'` for non-focus messages, which is acceptable — the field is for UI display, not logic.

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code/config changes with no new external dependencies beyond already-installed expo-secure-store.

---

## Sources

### Primary (HIGH confidence)
- `lib/mascot/companion-engine.ts` — Full engine: `detectProactiveEvent`, `generateCompanionAIMessage`, `MESSAGE_TEMPLATES`, `buildCompanionPrompt`, cache/budget system
- `lib/mascot/companion-types.ts` — `CompanionEvent` union type, `CompanionMessageContext`, `SPECIES_PERSONALITY`
- `lib/semantic/coupling-overrides.ts` — `loadWeekStats()` shape and SecureStore key
- `lib/semantic/caps.ts` — SecureStore pattern to replicate for companion-storage.ts
- `app/(tabs)/tree.tsx` — Current companion trigger points, `saveToMemory`, `companionRecentMessagesRef`, `showCompanionMsg`, `useFocusEffect` proactive detection
- `app/(tabs)/index.tsx` — Dashboard structure, existing `activeProfile.companion` access, `SectionErrorBoundary` usage pattern
- `components/dashboard/types.ts` — `DashboardSectionProps` interface
- `components/mascot/CompanionAvatarMini.tsx` — Reusable avatar component API
- `.planning/phases/24-compagnon-tendu-seed-003-lite/24-CONTEXT.md` — All locked decisions

### Secondary (MEDIUM confidence)
- `components/dashboard/DashboardBilanSemaine.tsx` — Pattern for Sunday-gated dashboard sections (shows Sunday + Saturday 18h)
- `components/settings/SettingsCoupling.tsx` — How to compute `totalEffects` from weekStats.counts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns directly lifted from existing production code
- Pitfalls: HIGH — derived from code analysis of existing trigger logic

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable — no new dependencies, all patterns from existing codebase)
