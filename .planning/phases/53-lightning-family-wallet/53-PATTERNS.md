# Phase 53 : Lightning Family Wallet — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 24 (créés ou modifiés)
**Analogs found:** 24 / 24

## File Classification

### Module pur Lightning (lib/lightning/) — étendu ou nouveau

| Fichier (créé/modifié) | Rôle | Data flow | Analog le plus proche | Match |
|------------------------|------|-----------|-----------------------|-------|
| `lib/lightning/types.ts` (modifié) | types | data-shape | `lib/lightning/types.ts` (existant) — étendre | exact (self) |
| `lib/lightning/family-credentials.ts` (modifié) | persistence SecureStore | CRUD JSON | `lib/lightning/family-credentials.ts` (existant) — étendre champs + backward-compat children→members | exact (self) |
| `lib/lightning/feature-flag.ts` (réutilisé tel quel) | feature flag | runtime override | `lib/eval/feature-flag.ts` (Phase 52) — même posture | exact |
| `lib/lightning/credentials.ts` (à SUPPRIMER) | persistence legacy | — | — | n/a |
| `lib/lightning/lnbits-client.ts` (modifié, ajouter `extra` REQ-6) | API client REST | request-response | `lib/lightning/lnbits-client.ts` (existant) — étendre `createInvoice` | exact (self) |
| `lib/lightning/biometric-gate.ts` (réutilisé tel quel) | OS interop | request-response | — | reused as-is |
| `lib/lightning/resolve-recipient.ts` (NEW) | pure function | transform | tests Jest pour fonctions pures `lib/lightning/__tests__/*` (pattern Phase 52) | role-match |
| `lib/lightning/audit-log.ts` (NEW) | persistence (Secure ou Async) | CRUD JSON + purge temporelle | `lib/lightning/family-credentials.ts` (load/save/clear avec validation défensive) | role-match |
| `lib/lightning/payout-queue.ts` (NEW) | persistence + retry orchestrator | event-driven enqueue/flush | `lib/lightning/family-credentials.ts` (load/save) + retry logic à inventer | partial (no analog for retry) |
| `lib/lightning/daily-cap.ts` (NEW) | pure function + read | transform + read | resolveRecipient + audit-log read | role-match |
| `lib/lightning/parent-notif.ts` (NEW) | OS interop (expo-notifications) | event-driven aggregation | `lib/scheduled-notifications.ts` | role-match |
| `lib/lightning/migration.ts` (NEW) | bootstrap migration | one-shot transform | `lib/vault-cache.ts` `CACHE_VERSION` bumper (cleanup idempotent) | partial |
| `lib/lightning/trigger-mode.ts` (NEW) | pure function | dispatch/router | `resolveRecipient` (pattern pure function) | role-match |
| `lib/lightning/lightning-events.ts` (NEW) | event bus (in-memory) | pub-sub | `subscribeTaskComplete` Set<Listener> pattern (hooks/useVaultTasks.ts:76-82) | exact |
| `lib/lightning/index.ts` (modifié — barrel) | barrel | re-export | `lib/lightning/index.ts` (existant) | exact (self) |
| `lib/lightning/__tests__/*.test.ts` (NEW × 6) | test | unit | `lib/eval/__tests__/non-regression-baseline.test.ts` (Phase 52 — Jest + fixtures) | role-match |

### Intégration `hooks/useVault.ts` — listener

| Fichier (créé/modifié) | Rôle | Data flow | Analog le plus proche | Match |
|------------------------|------|-----------|-----------------------|-------|
| `hooks/useVault.ts` (modifié — 3ᵉ subscriber) | domain hook orchestrator | event-driven | `hooks/useVault.ts:837-845` (Phase 46 Auberge) ET `hooks/useVault.ts:795-807` (Phase 40 widget refresh) | exact |
| `hooks/useVault.ts` (modifié — bootstrap migration effect) | bootstrap effect | one-shot side-effect | `hooks/useVault.ts:849-855` (backup gamiData 1×/jour) | role-match |

### UI — bouton HUD + écran wallet + modals + settings

| Fichier (créé/modifié) | Rôle | Data flow | Analog le plus proche | Match |
|------------------------|------|-----------|-----------------------|-------|
| `app/(tabs)/tree.tsx` (modifié — bouton ⚡ HUD + listener pulse) | UI screen | event-driven | `app/(tabs)/tree.tsx:3508-3524` (boutons codex 📖 et screenshot 📷) | exact (self) |
| `app/lightning-wallet.tsx` (NEW) | UI screen route hors tabs | vault read → state → UI | `app/impressions.tsx` (Phase 51 — route hors tabs, parser → state → list) | exact |
| `components/lightning/HudLightningButton.tsx` (NEW, optionnel) | UI component | event-driven | `app/(tabs)/tree.tsx:3508-3515` (style `hudCodexButton`) + Reanimated 4 pulse (CLAUDE.md pattern) | role-match |
| `components/lightning/BalanceCard.tsx` (NEW) | UI component | read-only | `components/settings/SettingsLightning.tsx:236-247` (resultCard pattern) | role-match |
| `components/lightning/AuditLogItem.tsx` (NEW, memoïsé) | UI list item | read-only | `components/ui/SettingsRow.tsx` (memo-ready row + icône) | role-match |
| `components/lightning/PayoutQueueModal.tsx` (NEW) | UI modal pageSheet | user action → batch loop | `app/(tabs)/tree.tsx:3528-3541` (Modal pageSheet pattern) + `components/AnniversaryEditor.tsx:144` | exact |
| `components/lightning/CashOutModal.tsx` (NEW) | UI modal pageSheet | user input → action | `app/(tabs)/tree.tsx:3528-3541` + `components/CalendarImporter.tsx:348` | exact |
| `components/lightning/QrScannerOverlay.tsx` (NEW) | UI modal fullScreen + caméra | OS interop | RESEARCH.md Example C (expo-camera CameraView) — pas d'analog projet | new pattern |
| `components/settings/SettingsLightning.tsx` (modifié — étendre, retirer liens spike) | UI form | user input → SecureStore write | `components/settings/SettingsLightning.tsx` (existant) | exact (self) |

### Cleanup (Plan 4 final)

| Fichier (à supprimer) | Action |
|-----------------------|--------|
| `app/lightning-spike.tsx` | DELETE |
| `app/lightning-family-spike.tsx` | DELETE |
| `lib/lightning/credentials.ts` | DELETE |
| `components/settings/SettingsLightning.tsx` | Retirer 2 `TouchableOpacity` "Ouvrir l'écran de test" (lignes 268-307 actuelles) |
| `lib/lightning/index.ts` | Retirer exports `loadLnbitsConfig`, `saveLnbitsConfig`, `clearLnbitsConfig`, `ChildWalletMapping` |

---

## Pattern Assignments

### `hooks/useVault.ts` (modifié — 3ᵉ subscriber Lightning)

**Analog primaire :** `hooks/useVault.ts:833-845` (Phase 46 Auberge tick) — pattern le plus récent et le plus proche du couplage souhaité.

**Pattern à copier — refs partagées + subscribe via useEffect** (lignes 833-845) :
```typescript
// Phase 46 : tick Auberge auto sur chaque tâche complétée (transition false→true)
// Utilise les refs live pour éviter les re-souscriptions à chaque rerender.
const profilesRefForAuberge = useRef(profiles);
profilesRefForAuberge.current = profiles;
useEffect(() => {
  const unsub = tasksHook.subscribeTaskComplete(() => {
    const activeId = activeProfileIdForWidgetRef.current;
    const vault = vaultRef.current;
    if (!activeId || !vault) return;
    tickAubergeAuto(activeId, { vault, profiles: profilesRefForAuberge.current }).catch(() => {});
  });
  return unsub;
}, [tasksHook]);
```

**Pattern à copier — subscribe avec compteur + side-effect** (lignes 795-807, Phase 40) :
```typescript
useEffect(() => {
  const unsub = tasksHook.subscribeTaskComplete(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (tasksCompletedTodayRef.current.date !== today) {
      tasksCompletedTodayRef.current = { date: today, count: 1 };
    } else {
      tasksCompletedTodayRef.current.count += 1;
    }
    setTasksCompletedToday(tasksCompletedTodayRef.current.count);
    triggerWidgetRefresh();
  });
  return unsub;
}, [tasksHook, triggerWidgetRefresh]);
```

**Point d'insertion :** entre ligne 845 (fin Phase 46) et ligne 847 (backup gamiData). Le 3ᵉ subscriber Phase 53 vient juste après Phase 46.

**Errors silent pattern :** `.catch(() => { /* Lightning — non-critical, vault domain unaffected */ })` — copier verbatim depuis ligne 842.

**Refs à déclarer :** suivre nommage `profilesRefForLightning`, `activeProfileIdRefForLightning` (cohérence avec `profilesRefForAuberge`, `activeProfileIdForWidgetRef`).

---

### `lib/lightning/audit-log.ts` (NEW)

**Analog primaire :** `lib/lightning/family-credentials.ts:19-69` — pattern SecureStore load/save/clear avec validation défensive.

**Imports pattern** (lignes 14-15) :
```typescript
import * as SecureStore from 'expo-secure-store';
import type { ChildWalletMapping, FamilyLightningConfig } from './types';
```

**Load avec validation défensive** (lignes 19-52) :
```typescript
export async function loadFamilyConfig(): Promise<FamilyLightningConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(FAMILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FamilyLightningConfig>;
    if (
      typeof parsed.baseUrl !== 'string' ||
      !parsed.family ||
      typeof parsed.family.invoiceKey !== 'string' ||
      ...
    ) {
      return null;
    }
    return {
      baseUrl: parsed.baseUrl,
      family: { ... },
      children: parsed.children.filter(
        (c): c is ChildWalletMapping =>
          !!c &&
          typeof c.profileId === 'string' &&
          ...
      ),
    };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] loadFamilyConfig failed:', err);
    return null;
  }
}
```

**Save avec normalisation** (lignes 54-69) :
```typescript
export async function saveFamilyConfig(config: FamilyLightningConfig): Promise<void> {
  const normalized: FamilyLightningConfig = { ... };
  await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(normalized));
}
```

**Clear pattern** (lignes 71-73) :
```typescript
export async function clearFamilyConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(FAMILY_KEY);
}
```

**Spécificité audit-log :** ajouter une fonction `purgeOlderThan(entries, days)` exécutée au load ET avant chaque append (RESEARCH.md Pattern 2). Voir RESEARCH.md Pitfall #1 — recommandation forte d'utiliser **AsyncStorage** plutôt que SecureStore pour l'audit log (90j × 4 membres × 3/j ≈ 160 KB > limite SecureStore 2 KB). Le pattern reste identique (load/append/clear), juste le store sous-jacent change.

---

### `lib/lightning/family-credentials.ts` (modifié — backward-compat children→members)

**Analog primaire :** `lib/lightning/family-credentials.ts` (existant, self).

**Pattern à copier — backward-compat parser** (à inspirer de la pattern défensive ligne 40-46) :
```typescript
// Lecture : accepter `children` ET `members` (backward-compat)
const membersArray = Array.isArray(parsed.members)
  ? parsed.members
  : Array.isArray(parsed.children)
    ? parsed.children
    : [];

return {
  baseUrl: parsed.baseUrl,
  family: { ... },
  members: membersArray.filter(
    (m): m is MemberWalletMapping =>
      !!m &&
      typeof m.profileId === 'string' &&
      typeof m.displayName === 'string' &&
      typeof m.invoiceKey === 'string',
  ),
  // NEW Phase 53
  triggerMode: parsed.triggerMode === 'daily-review' || parsed.triggerMode === 'hybrid'
    ? parsed.triggerMode
    : 'instant',
  dailyCapPerMember: typeof parsed.dailyCapPerMember === 'number'
    ? Math.max(100, Math.min(10000, parsed.dailyCapPerMember))
    : 1000,
};
```

**Save :** toujours écrire `members: [...]` (jamais `children` en sortie) — migration silencieuse au prochain `saveFamilyConfig`.

---

### `lib/lightning/feature-flag.ts` (réutilisé tel quel)

**Analog primaire :** `lib/eval/feature-flag.ts` (Phase 52) — même posture runtime override.

**Pattern d'override runtime — Phase 52** :
```typescript
const DEFAULT_FEATURE_EVAL_ENABLED = true;
let runtimeOverride: boolean | null = null;

export function setEvalEnabledOverride(enabled: boolean | null): void {
  runtimeOverride = enabled;
}

export function isEvalEnabled(): boolean {
  if (runtimeOverride !== null) return runtimeOverride;
  return DEFAULT_FEATURE_EVAL_ENABLED;
}
```

**Pattern Lightning existant** (à conserver) :
```typescript
const FLAG_KEY = 'lightning_enabled_v1';
const BUILD_DEFAULT_ENABLED = false;  // ≠ Phase 52 — OFF par défaut pour Lightning (App Store posture)

let cached: boolean | null = null;

export async function isLightningEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const raw = await SecureStore.getItemAsync(FLAG_KEY);
    if (raw === null) { cached = BUILD_DEFAULT_ENABLED; return cached; }
    cached = raw === '1';
    return cached;
  } catch { cached = BUILD_DEFAULT_ENABLED; return cached; }
}
```

**À noter :** Lightning persiste le flag en SecureStore (override permanent), Phase 52 reste in-memory (override temporaire). Différence volontaire : Lightning doit survivre au reboot, Phase 52 c'est un kill-switch dev/tests.

---

### `app/lightning-wallet.tsx` (NEW)

**Analog primaire :** `app/impressions.tsx` (Phase 51) — route expo-router hors tabs, parser → state → list + actions.

**Imports pattern** (lignes 10-38) :
```typescript
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable, Alert, StyleSheet, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
```

**Load + refresh pattern** (lignes 49-68) :
```typescript
const loadManifeste = useCallback(async () => {
  if (!vault) return;
  try {
    const raw = await vault.readFile(MANIFESTE_FILE);
    setEntries(parseManifeste(raw));
  } catch {
    setEntries([]);
  }
}, [vault]);

useEffect(() => { loadManifeste(); }, [loadManifeste]);

const onRefresh = useCallback(async () => {
  setRefreshing(true);
  await loadManifeste();
  setRefreshing(false);
}, [loadManifeste]);
```

**Adaptation Phase 53 :** remplacer `loadManifeste` par 2 effects : (a) charger `loadAudit()` filtré sur activeProfile, (b) appeler `LnbitsClient.getWallet()` pour la balance. Refresh balance event-driven (D-05) + `AppState` listener.

---

### `components/lightning/PayoutQueueModal.tsx` (NEW — validation batch parent)

**Analog primaire :** `app/(tabs)/tree.tsx:3528-3541` (Modal pageSheet pattern + ModalHeader).

**Pattern Modal pageSheet** :
```typescript
<Modal
  visible={showSpeciesPicker}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setShowSpeciesPicker(false)}
>
  <SpeciesPicker
    currentSpecies={species}
    level={level}
    onSelect={handleSpeciesSelect}
    onClose={() => setShowSpeciesPicker(false)}
  />
</Modal>
```

**ModalHeader pattern** (depuis `components/ui/ModalHeader.tsx:20-68`) :
```typescript
<ModalHeader
  title="Pay-outs en attente"
  onClose={onClose}
/>
```

**Batch loop pattern (D-08) :** boucle `for...of` séquentielle après FaceID gate unique. Pas d'analog projet — inventer en respectant :
- 1 seul appel `authenticatePayOut({ reason: 'Valider les pay-outs Lightning' })` AVANT la boucle
- Loop `for (const item of pending) { await payInvoice(...) }` avec catch per-item pour D-09 (items réussis sortent, items échoués restent avec `attemptCount++`)
- Toast résumé en fin via `useToast().showToast('X/Y pay-outs réussis · N en attente de retry', 'info')`

---

### `components/lightning/CashOutModal.tsx` (NEW — encaissement out bolt11 + scan QR)

**Analog primaire :** `app/(tabs)/tree.tsx:3528-3541` (Modal pageSheet) + `components/settings/SettingsLightning.tsx:196-265` (form pattern + warning tip).

**Form pattern (textarea + bouton paste + bouton scan)** — adapter le pattern SettingsLightning.tsx:204-226 :
```typescript
<TextInput
  style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
  value={bolt11}
  onChangeText={setBolt11}
  placeholder="lnbc1..."
  placeholderTextColor={colors.textFaint}
  autoCapitalize="none"
  autoCorrect={false}
  multiline={true}
  numberOfLines={4}
/>
```

**Warning tip pattern** (SettingsLightning.tsx:228-234) :
```typescript
<View style={[styles.tip, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
  <Lightbulb size={14} strokeWidth={1.75} color={colors.warningText} style={{ marginTop: 2 }} />
  <Text style={[styles.tipText, { color: colors.warningText, flex: 1 }]}>
    <Text style={styles.bold}>La transaction Lightning est définitive.</Text>
    Vérifiez l'invoice avant de confirmer.
  </Text>
</View>
```

**FaceID gate avant confirmation** : appel `authenticatePayOut({ reason: "Confirmer l'encaissement Lightning" })` (lib/lightning/biometric-gate.ts:30-60).

---

### `app/(tabs)/tree.tsx` (modifié — bouton HUD ⚡)

**Analog primaire :** `app/(tabs)/tree.tsx:3508-3524` (boutons 📖 codex et 📷 screenshot).

**Pattern à dupliquer verbatim** (lignes 3508-3524) :
```typescript
<TouchableOpacity
  style={styles.hudCodexButton}
  onPress={() => { Haptics.selectionAsync(); setShowCodex(true); }}
  accessibilityLabel={t('codex:modal.title')}
  accessibilityRole="button"
>
  <Text style={styles.hudEmoji}>{'📖'}</Text>
</TouchableOpacity>
{/* Capture d'écran sans HUD → partage iOS */}
<TouchableOpacity
  style={styles.hudCodexButton}
  onPress={handleScreenshot}
  accessibilityLabel="Capture d'écran"
  accessibilityRole="button"
>
  <Text style={styles.hudEmoji}>{'📷'}</Text>
</TouchableOpacity>
```

**Adaptation Phase 53 — bouton ⚡** :
- Insérer juste après le bouton 📷 (ligne 3524)
- `accessibilityLabel="Portefeuille Lightning"` (UI-SPEC Accessibility)
- `onPress` : `Haptics.selectionAsync(); router.push('/lightning-wallet')`
- Conditionnel strict : `LIGHTNING_ENABLED === true && memberWallets[activeProfile.id] !== undefined` (UI-SPEC Surface 1 visibility) — sinon `return null`
- Wrap dans `Animated.View` avec style anim pulse (Reanimated 4)

**Pattern pulse Reanimated 4** (CLAUDE.md Animations + UI-SPEC Animation 1) :
```typescript
const LIGHTNING_PULSE_SPRING = { damping: 10, stiffness: 180 } as const;

const pulseScale = useSharedValue(1);

function triggerPulse() {
  pulseScale.value = withSpring(1.2, LIGHTNING_PULSE_SPRING, () => {
    pulseScale.value = withSpring(1.0, LIGHTNING_PULSE_SPRING);
  });
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

const pulseAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: pulseScale.value }],
}));
```

---

### `components/settings/SettingsLightning.tsx` (modifié — étendre, retirer liens spike)

**Analog primaire :** `components/settings/SettingsLightning.tsx` (existant, self) + `components/settings/SettingsRow.tsx` pour l'entrée "Pay-outs en attente".

**SectionHeader pattern** (existant ligne 167-171) :
```typescript
<SectionHeader
  title="Lightning Wallet (BYO)"
  icon={<Zap size={16} strokeWidth={1.75} color={primary} />}
  flush
/>
```

**Card config form** (existant lignes 174-265) — à étendre avec :
- Sous-section "Mode de déclenchement" (UI-SPEC Surface 6) : 3 options radio `instant` / `daily-review` / `hybrid`
- Sous-section "Plafond quotidien" (UI-SPEC) : `TextInput keyboardType="number-pad"`, plage 100-10000, default 1000
- Entrée conditionnelle "Pay-outs en attente (N)" (UI-SPEC + D-06) : pattern `SettingsRow` (icon `Clock`, title, subtitle, onPress)

**Pattern à RETIRER (Plan 4 cleanup)** (existant lignes 268-307) :
```typescript
// Tout ce bloc DOIT être supprimé :
{enabled && (
  <>
    {savedConfigured && (
      <TouchableOpacity ... onPress={handleOpenSpike} ...>
        <Text>Écran de test (1 wallet)</Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity ... onPress={handleOpenFamily} ...>
      <Text>Mode famille (multi-wallet)</Text>
    </TouchableOpacity>
  </>
)}
```

Et retirer les handlers `handleOpenSpike` (lignes 157-159) + `handleOpenFamily` (lignes 161-163).

---

### `lib/lightning/lightning-events.ts` (NEW — bus d'événements local)

**Analog primaire :** `hooks/useVaultTasks.ts:76-82` (Set<Listener> + subscribe via ref).

**Pattern à copier** :
```typescript
// hooks/useVaultTasks.ts:76-82
const taskCompleteListenersRef = useRef<Set<TaskCompleteListener>>(new Set());
const subscribeTaskComplete = useCallback((listener: TaskCompleteListener) => {
  taskCompleteListenersRef.current.add(listener);
  return () => {
    taskCompleteListenersRef.current.delete(listener);
  };
}, []);
```

**Fire pattern** (useVaultTasks.ts:111-124) :
```typescript
const listeners = Array.from(taskCompleteListenersRef.current);
for (const listener of listeners) {
  try {
    const maybePromise = listener(task);
    if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
      (maybePromise as Promise<void>).catch(e => {
        if (__DEV__) console.warn('[useVaultTasks] taskComplete listener error:', e);
      });
    }
  } catch (e) {
    if (__DEV__) console.warn('[useVaultTasks] taskComplete listener sync error:', e);
  }
}
```

**Adaptation Phase 53 :** module-level (pas hook-level) car partagé entre hook domaine et UI tree.tsx. Singleton `Set<Listener>` global, fonctions exportées `onPayoutSuccess`/`emitPayoutSuccess` (RESEARCH.md Pattern 3 Example).

---

### `lib/lightning/__tests__/resolve-recipient.test.ts` (NEW × 6)

**Analog primaire :** `lib/eval/__tests__/non-regression-baseline.test.ts` (Phase 52 — Jest + ts-jest + fixtures JSON).

**Pattern Jest projet** (CLAUDE.md Testing) : `npx jest --no-coverage lib/lightning/__tests__/` (commande standard).

**Structure attendue** (par RESEARCH.md REQ-2) :
- 6 cas de test pour `resolveRecipient` (mention unique configurée, mention non configurée, no mention + active configuré, no mention + active non configuré, 2 mentions, mention adulte)
- Mock `Task`, `Profile[]`, `MemberWalletMapping[]` en TS literals (pas besoin de fixtures externes pour un test pure-function)

---

### `lib/lightning/lnbits-client.ts` (modifié — ajouter param `extra` REQ-6)

**Analog primaire :** `lib/lightning/lnbits-client.ts:117-148` (createInvoice existant).

**Pattern existant à étendre** :
```typescript
async createInvoice(
  amountSats: number,
  memo: string,
): Promise<CreateInvoiceResult> {
  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    throw new LnbitsError('amountSats doit être un entier positif');
  }
  const raw = await this.request<...>('/api/v1/payments', {
    method: 'POST',
    body: JSON.stringify({
      out: false,
      amount: amountSats,
      unit: 'sat',
      memo,
    }),
  });
  ...
}
```

**Extension Phase 53 (REQ-6 idempotency tag)** :
```typescript
async createInvoice(
  amountSats: number,
  memo: string,
  extra?: Record<string, string | number>,  // NEW — idempotency tag
): Promise<CreateInvoiceResult> {
  // ... validation inchangée ...
  const body: any = { out: false, amount: amountSats, unit: 'sat', memo };
  if (extra) body.extra = extra;  // LNbits accepte un champ extra arbitraire
  const raw = await this.request<...>('/api/v1/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  // ... reste inchangé ...
}
```

**À conserver impérativement (Pitfall #4) :** le double fallback `raw.bolt11 ?? raw.payment_request` ligne 139.

---

## Shared Patterns

### 1. Errors silencieuses non-critiques

**Source :** CLAUDE.md Patterns + `hooks/useVault.ts:842` (Phase 46 Auberge)

**Apply to :** TOUT code Lightning qui peut échouer sans casser le vault/ferme.

```typescript
// Pattern Phase 46 — verbatim
tickAubergeAuto(activeId, { vault, profiles: profilesRefForAuberge.current }).catch(() => {});

// Pattern Lightning équivalent (à utiliser dans hooks/useVault.ts listener Phase 53)
processTaskCompletionForLightning(task, deps).catch(() => {
  /* Lightning — non-critical, vault domain unaffected */
});
```

**Règle CLAUDE.md :** `catch { /* Domain — non-critical */ }` — la ferme ne doit JAMAIS être impactée par une erreur Lightning. Cf. RESEARCH.md Pitfall #8 (imports dynamiques pour éviter crash boot).

---

### 2. Logging `__DEV__` only

**Source :** CLAUDE.md Patterns + tout le module `lib/lightning/` existant

**Apply to :** TOUT log dans `lib/lightning/` et code Phase 53.

```typescript
// Pattern verbatim (family-credentials.ts:49)
if (__DEV__) console.warn('[lightning] loadFamilyConfig failed:', err);

// Pattern verbatim (biometric-gate.ts:35-37)
if (__DEV__) {
  console.warn('[lightning] biometric unavailable — hasHardware=', hasHardware, 'enrolled=', isEnrolled);
}
```

**Prefix de log :** `[lightning]` (cohérence avec module existant).

---

### 3. SecureStore JSON load/save/clear

**Source :** `lib/lightning/family-credentials.ts:19-73`

**Apply to :** Tous les nouveaux modules Phase 53 qui persistent — `audit-log.ts`, `payout-queue.ts`, `parent-notif.ts` (timestamp dernière notif).

```typescript
import * as SecureStore from 'expo-secure-store';

const KEY = 'lightning_<bucket>_v1';

export async function load(): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<T>;
    // Validation défensive sur le shape (cf. family-credentials.ts:24-31)
    if (/* shape invalide */) return null;
    return /* T normalisé */;
  } catch (err) {
    if (__DEV__) console.warn('[lightning] load <bucket> failed:', err);
    return null;
  }
}

export async function save(value: T): Promise<void> {
  const normalized: T = /* ... */;
  await SecureStore.setItemAsync(KEY, JSON.stringify(normalized));
}

export async function clear(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
```

**Convention de nommage clé :** `lightning_<bucket>_v1` (bumper `_v2` si shape break — cf. credentials.ts:7-10 et CLAUDE.md Cache section).

**Exception audit-log :** RESEARCH.md Pitfall #1 — recommandation forte d'utiliser AsyncStorage (pas chiffré, mais l'audit n'est pas un secret — on peut tout retrouver sur la blockchain LN). Garder SecureStore pour creds + queue + flag + timestamp parent-notif.

---

### 4. Modal pageSheet + drag-to-dismiss

**Source :** CLAUDE.md Conventions + `app/(tabs)/tree.tsx:3528-3541` + `components/AnniversaryEditor.tsx:144`

**Apply to :** `PayoutQueueModal.tsx`, `CashOutModal.tsx`. Scan QR overlay = `presentationStyle="fullScreen"` (exception caméra).

```typescript
<Modal
  visible={isOpen}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={onClose}  // drag-to-dismiss déclenche aussi onRequestClose
>
  <ModalHeader title="Pay-outs en attente" onClose={onClose} />
  {/* contenu */}
</Modal>
```

**Pitfall :** RESEARCH.md Pitfall #7 — empiler 2 modals pageSheet successifs sans `setTimeout(300ms)` cause un bug d'animation iOS. Le scan QR doit être présenté DIRECTEMENT en `fullScreen` PAR-DESSUS le `CashOutModal` (pas dismiss → present, mais stack).

---

### 5. Couleurs via `useThemeColors()` — JAMAIS de hardcoded

**Source :** CLAUDE.md Conventions + module Lightning existant (SettingsLightning.tsx:53 + tous les fichiers)

**Apply to :** TOUS les nouveaux composants UI Phase 53.

```typescript
import { useThemeColors } from '../../contexts/ThemeContext';

export function MyLightningComponent() {
  const { primary, colors } = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={{ color: colors.text }}>Balance</Text>
      <Zap size={16} color={primary} />
    </View>
  );
}
```

**Tokens disponibles** (UI-SPEC + CLAUDE.md) : `primary`, `colors.bg`, `colors.card`, `colors.text`, `colors.textSub`, `colors.textMuted`, `colors.textFaint`, `colors.success`, `colors.successBg`, `colors.successText`, `colors.warning`, `colors.warningBg`, `colors.warningText`, `colors.error`, `colors.errorBg`, `colors.errorText`, `colors.border`, `colors.separator`, `colors.inputBg`, `colors.inputBorder`, `colors.cardAlt`, `colors.overlay`, `colors.brand.or`.

**Interdiction stricte :** AUCUN `#FFFFFF`, `rgba(...)`, ou hex hardcodé dans les nouveaux fichiers.

---

### 6. Tokens design Spacing/Radius/FontSize/FontWeight/Shadows

**Source :** CLAUDE.md Patterns + tous les fichiers projet

**Apply to :** TOUS les `StyleSheet.create({})` Phase 53.

```typescript
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.md },
  title: { fontSize: FontSize.heading, fontWeight: FontWeight.semibold },
  // ...Shadows.sm, Shadows.md, Shadows.xs
});
```

**Interdiction :** valeurs numériques en dur (pas de `padding: 16`, écrire `padding: Spacing['2xl']`).

---

### 7. Toast via `useToast()` — ToastSeal pour pay-out reçu

**Source :** `contexts/ToastContext.tsx:55-58` (signature) + UI-SPEC Surface 2

**Apply to :** Feedback pay-out reçu (D-04), batch result (D-09), encaissement out result.

**Signature exacte** :
```typescript
showToast(message: string, type?: 'success'|'error'|'info', action?: ToastAction, options?: { icon?: string; subtitle?: string })
```

**Toast "+100 sats ⚡" (ToastSeal V2 — déclenchée par `icon + subtitle` présents)** :
```typescript
showToast(
  '+100 sats ⚡',
  'success',
  undefined,
  { icon: '⚡', subtitle: 'Lucas' }  // nomProfil destinataire
);
```

**Toast batch résumé (V1 tag, sans icon+subtitle)** :
```typescript
showToast('2/3 pay-outs réussis · 1 en attente de retry', 'info');
```

**Wording :** factuel, jamais "Bravo !", "Tu as gagné !", "Récompense !" (UI-SPEC Copywriting Contract).

---

### 8. Haptics

**Source :** CLAUDE.md Animations + UI-SPEC Surface 1/4/5

**Apply to :**
- Tap bouton HUD ⚡ : `Haptics.selectionAsync()` (cohérent avec tree.tsx:3510)
- Pulse pay-out reçu : `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`
- Scan QR réussi : `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`
- Batch success : `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`

---

### 9. Animations Reanimated 4 (jamais RN Animated)

**Source :** CLAUDE.md Stack + Animations + UI-SPEC Animation 1

**Apply to :** Pulse bouton HUD ⚡ (D-04).

```typescript
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const PULSE_SPRING = { damping: 10, stiffness: 180 } as const;  // constante module

const scale = useSharedValue(1);
const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

scale.value = withSpring(1.2, PULSE_SPRING, () => {
  scale.value = withSpring(1.0, PULSE_SPRING);
});
```

**Interdiction :** pas de `perspective` dans transform (CLAUDE.md). Pas de RN `Animated` import.

---

### 10. Format date affiché JJ/MM/AAAA

**Source :** CLAUDE.md Conventions

**Apply to :** Timestamps dans audit log liste, items liste validation batch, balance hero "Mis à jour il y a X min".

```typescript
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const dateAffichee = format(parseISO(audit.ts), 'dd/MM/yyyy', { locale: fr });
```

---

### 11. React.memo + useCallback

**Source :** CLAUDE.md Patterns

**Apply to :** `AuditLogItem` (list item dans `/lightning-wallet`), `PayoutQueueItem` (list item dans modal validation batch), handlers passés en props.

```typescript
export const AuditLogItem = React.memo(function AuditLogItem({ entry, onPress }) {
  // ...
});

// Dans le parent :
const handlePress = useCallback((entry) => { /* ... */ }, [deps]);
```

---

### 12. i18n FR strict + pas de noms réels dans docs

**Source :** CLAUDE.md Conventions

**Apply to :** TOUS les libellés, alerts, toasts, notifs, commentaires, commits Phase 53.

**Noms d'exemple dans docs/commits :** Lucas, Emma, Dupont (génériques — UI-SPEC utilise Lucas, conforme).

**Wording verbatim :** UI-SPEC Copywriting Contract (Surface 4 batch label, Surface 5 disclaimer, etc.).

---

### 13. Feature flag check AVANT toute opération réseau

**Source :** SPEC Constraint + `lib/lightning/feature-flag.ts:24-38`

**Apply to :** TOUT entry point Lightning (listener pay-out, refresh balance, scan QR, etc.).

```typescript
import { isLightningEnabled } from '../lib/lightning';

async function processTaskCompletionForLightning(task: Task, deps) {
  if (!(await isLightningEnabled())) return;  // ← gate strict
  // ... reste du flow
}
```

**Garantie :** SPEC Constraint #1 — "Aucun appel réseau LN ni listener actif tant que le flag est OFF". Le pattern feature-flag.ts existe déjà — réutiliser.

---

## No Analog Found

Files sans match exact dans le codebase (planner doit s'appuyer sur RESEARCH.md ou inventer) :

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/lightning/QrScannerOverlay.tsx` | UI + caméra | OS interop | `expo-camera` PAS encore installé dans le projet (CONTEXT prétendait à tort qu'elle est installée). Pattern à suivre = RESEARCH.md Example C (CameraView + barcodeScannerSettings + useCameraPermissions). |
| `lib/lightning/payout-queue.ts` (retry/backoff) | persistence + retry orchestrator | event-driven | Aucune queue offline avec retry n'existe dans le projet aujourd'hui. La partie load/save suit `family-credentials.ts`. La partie retry/backoff/AppState/NetInfo est inédite — voir RESEARCH.md Pitfall #6 et Code Example sections. |
| `lib/lightning/parent-notif.ts` (agrégation 1/jour, silencieuse 9-16h) | scheduling + aggregation | event-driven | `lib/scheduled-notifications.ts` planifie des notifs récurrentes via `Notifications.scheduleNotificationAsync` mais pas d'agrégation temporelle avec window de silence. Pattern à inventer en réutilisant le canal `expo-notifications` existant. |
| AppState listener pattern (utilisé dans `app/lightning-wallet.tsx` et `payout-queue.ts`) | OS interop | event-driven | `grep AppState` retourne 0 résultats dans hooks/contexts/app projet. Le pattern doit être inventé : `AppState.addEventListener('change', (state) => { if (state === 'active') { ... } })`. |
| Migration single→family idempotente (`lib/lightning/migration.ts`) | bootstrap one-shot | one-shot transform | Aucun précédent de migration de creds dans le projet. Pattern simple à inventer : check `loadFamilyConfig() !== null` AVANT migration (Pitfall #9), idempotent. |

---

## Metadata

**Analog search scope :**
- `lib/lightning/` (module existant — 8 fichiers, 1 à supprimer)
- `lib/eval/` (Phase 52 — pattern feature-flag runtime override)
- `lib/parser.ts` (1900+ lignes — pattern parse/serialize bidirectionnel non applicable Phase 53)
- `lib/pdf/manifest-parser.ts` (Phase 51 — pattern parser/serializer si planner décide de logger l'audit en .md, mais SPEC interdit)
- `lib/scheduled-notifications.ts` (Phase 36-45 — pattern expo-notifications)
- `hooks/useVault.ts` (orchestrateur — patterns subscriber Phase 40 ligne 795-807, Phase 46 ligne 837-845)
- `hooks/useVaultTasks.ts` (pattern subscribe Set<Listener>, ligne 76-82, 111-124)
- `contexts/ToastContext.tsx` (pattern ToastSeal V2)
- `app/impressions.tsx` (Phase 51 — pattern route hors tabs)
- `app/(tabs)/tree.tsx` (HUD buttons + Modal pageSheet)
- `components/ui/ModalHeader.tsx` (pattern modal header)
- `components/ui/SettingsRow.tsx` (pattern row navigable)
- `components/settings/SettingsLightning.tsx` (form pattern + warning tip)

**Files scanned :** ~30 fichiers projet + 7 fichiers de référence Phase 52/51/46/40.

**Pattern extraction date :** 2026-05-18

---

*Phase: 53-lightning-family-wallet*
*Pattern map created: 2026-05-18*
