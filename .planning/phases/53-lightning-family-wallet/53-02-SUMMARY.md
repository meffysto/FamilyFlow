---
phase: 53-lightning-family-wallet
plan: 02
subsystem: lightning
tags: [lightning, listener, integration, hooks, useVault, migration, runtime-wiring, faceid]
dependency_graph:
  requires:
    - "53-01 (module pur Lightning — types Member, audit-log, daily-cap, trigger-mode, payout-queue, parent-notif, migration, lightning-events, family-credentials)"
  provides:
    - "lib/lightning/process-task-completion — orchestrateur listener (flag → resolve → idempotence → cap → dispatch → payout-or-queue)"
    - "lib/lightning/payout-executor — exécution effective avec lock in-memory (Pitfall #2), gate FaceID per pay-out (SPEC #4), source-aware enqueue"
    - "lib/lightning/flush-queue — drain offline reason uniquement, retry cap 5 (REQ-5), source 'flush-offline' = pas de re-enqueue"
    - "isNetworkError helper exporté (TypeError fetch | LnbitsError sans httpStatus)"
    - "Runtime listener Lightning dans hooks/useVault.ts — 3 useEffects (subscriber + migration + AppState flush)"
  affects:
    - "hooks/useVault.ts (3 insertions chirurgicales ~69 lignes ajoutées, Phase 40 widget + Phase 46 Auberge préservés)"
    - "Aucune UI modifiée — Plan 03a/03b en charge"
tech_stack:
  added: []
  patterns:
    - "Subscriber pattern verbatim Phase 46 (refs live + errors silencieuses .catch(() => {}))"
    - "Lock in-memory Map<lockKey, Promise<void>> anti-double-toggle (Pitfall #2)"
    - "Source-aware payout-executor : 'listener' / 'flush-offline' / 'flush-review' — pas de re-enqueue depuis flush"
    - "FaceID gate AVANT chaque createInvoice (SPEC Constraint #4, disableDeviceFallback=!__DEV__)"
    - "Migration bootstrap effect avec useRef intra-session (1× par process)"
    - "AppState listener foreground transition pour retry queue"
key_files:
  created:
    - lib/lightning/process-task-completion.ts
    - lib/lightning/payout-executor.ts
    - lib/lightning/flush-queue.ts
    - lib/lightning/__tests__/process-task-completion.test.ts
    - lib/lightning/__tests__/flush-queue.test.ts
    - .planning/phases/53-lightning-family-wallet/deferred-items.md
  modified:
    - hooks/useVault.ts (imports l.98-105 + 3 useEffects l.855-914)
    - lib/lightning/index.ts (barrel — 6 nouveaux exports : 3 fonctions + 3 types + isNetworkError)
decisions:
  - "Source-aware executePayout — paramètre `source` (listener/flush-offline/flush-review) évite la double-enqueue depuis flush-queue (correction architecturale par rapport au plan brut)"
  - "isNetworkError exporté depuis payout-executor pour réutilisation flush-queue — single source of truth (TypeError | LnbitsError sans httpStatus)"
  - "FaceID gate appelé via allowDevicePasscode=__DEV__ (inverse logique de disableDeviceFallback=!__DEV__ du SPEC — biometric-gate.ts utilise le sens positif). Sémantique strictement équivalente."
  - "Boot timeout 1s sur flush queue — laisse le réseau se réveiller post-mount, évite un fail immédiat sur AppState 'active' initial"
  - "REQ-6 audit 'undone' DEFERRED Plan 04 — la protection anti-double-payout (findPaidEntry) reste effective, seule la trace audit du dé-cochage est différée"
  - "Refs Lightning dédiées (profilesRefForLightning + activeProfileIdRefForLightning) plutôt que réutilisation des refs widget/Auberge — découplage explicite des subscribers Phase 53 vs Phase 40/46"
metrics:
  duration_minutes: 30
  completed_date: 2026-05-18
  tasks_completed: 2
  files_created: 5
  files_modified: 2
  tests_added: 24
  commits: 3
---

# Phase 53 Plan 02 : Runtime wiring Lightning — listener + migration + flush queue

Le module pur Lightning (Plan 01) est branché dans `hooks/useVault.ts` via 3 useEffects chirurgicaux : 3ᵉ subscriber `subscribeTaskComplete` qui orchestre le pay-out, effect bootstrap pour la migration single→family, et AppState listener pour le drain de queue offline. Zéro UI. FaceID per pay-out exigé verbatim SPEC #4.

## Résumé exécutif

Plan 02 livre le **runtime wiring** non-UI nécessaire pour que le pay-out fonctionne bout-en-bout dès qu'un dev active le flag :

- **3 orchestrateurs purs** dans `lib/lightning/` (process-task-completion, payout-executor, flush-queue) — 551 lignes de code, 24 tests Jest (14 + 10).
- **3 useEffects** ajoutés dans `hooks/useVault.ts` (~69 lignes) sans toucher aux 2 subscribers existants (Phase 40 widget + Phase 46 Auberge).
- **127 tests Lightning verts** au total (103 Plan 01 + 24 Plan 02), 12 suites — TSC clean.

Avec `LIGHTNING_ENABLED=true` + family config valide + 1 wallet member configuré, l'utilisateur peut cocher une tâche `@Lucas range tes legos` → prompt FaceID natif iOS → audit log enregistre `paid` avec `paymentHash`. Sans UI feedback à ce stade (Plan 03a livrera la pulse + toast).

## Files created / modified

### Créés

| Fichier | Lignes | Rôle |
| ------- | ------ | ---- |
| `lib/lightning/process-task-completion.ts` | 170 | Orchestrateur listener — flow 6 étapes (flag/config/resolve/idempotence/cap/dispatch). |
| `lib/lightning/payout-executor.ts` | 245 | Exécution effective — lock in-memory, FaceID gate, member.createInvoice + family.payInvoice, gestion erreurs source-aware. |
| `lib/lightning/flush-queue.ts` | 136 | Drain offline-reason items, retry cap MAX_ATTEMPTS=5, removeFromQueue + audit `failed` sur 4xx ou cap. |
| `lib/lightning/__tests__/process-task-completion.test.ts` | 608 | 14 cas couvrant flag/config/resolve/idempotence/cap/trigger/payout (instant + network + lnbits 4xx + lock + FaceID gate). |
| `lib/lightning/__tests__/flush-queue.test.ts` | 260 | 10 cas couvrant flag OFF, queue vide, succès, review skip, cap 5 attempts, wallet manquant, FIFO order, source-aware enqueue. |
| `.planning/phases/53-lightning-family-wallet/deferred-items.md` | 25 | Log des 5 suites Jest projet pré-existantes en échec (hors scope, vérifiées en stash). |

### Modifiés

| Fichier | Δ lignes | Insertion |
| ------- | -------- | --------- |
| `hooks/useVault.ts` | +69 | 4 insertions (1 import + 3 useEffects). |
| `lib/lightning/index.ts` | +8 | Barrel — 3 nouvelles fonctions + 3 types + isNetworkError. |

## Les 3 insertions dans `hooks/useVault.ts`

### 1. Imports barrel — lignes 98-105

```typescript
// Phase 53 — orchestrateurs Lightning (consommés en 3 useEffects ci-dessous,
// après le subscriber Phase 46 Auberge). Le module est gardé OFF par flag :
// processTaskCompletionForLightning early-return si isLightningEnabled() === false.
import {
  flushOfflineQueue,
  migrateSingleToFamily,
  processTaskCompletionForLightning,
} from '../lib/lightning';
```

Import statique (PAS dynamic) — le module Lightning est tree-shaken par le bundler Metro via le gate `isLightningEnabled()` interne. Aucun side-effect au `require` (Pitfall #8 RESEARCH).

### 2. 3ᵉ subscriber `subscribeTaskComplete` Lightning — lignes 855-874

```typescript
const profilesRefForLightning = useRef(profiles);
profilesRefForLightning.current = profiles;
const activeProfileIdRefForLightning = useRef<string | null>(activeProfileId ?? null);
activeProfileIdRefForLightning.current = activeProfileId ?? null;
useEffect(() => {
  const unsub = tasksHook.subscribeTaskComplete((task) => {
    processTaskCompletionForLightning(task, {
      profiles: profilesRefForLightning.current,
      activeProfileId: activeProfileIdRefForLightning.current,
    }).catch(() => {
      /* Lightning — non-critical, vault domain unaffected */
    });
  });
  return unsub;
}, [tasksHook]);
```

Pattern strictement verbatim de Phase 46 Auberge (l.841-853) :
- Refs live pour `profiles` + `activeProfileId` (pas de stale closure)
- Dépendance `[tasksHook]` — re-souscription si l'instance du hook change
- `.catch(() => {})` silencieux — toute erreur Lightning n'affecte PAS le vault/widget/gamification

### 3. Migration bootstrap effect — lignes 876-888

```typescript
const lightningMigrationRanRef = useRef(false);
useEffect(() => {
  if (lightningMigrationRanRef.current) return;
  lightningMigrationRanRef.current = true;
  migrateSingleToFamily()
    .then((result) => {
      if (__DEV__) console.warn('[lightning] migration result:', result.reason);
    })
    .catch(() => {
      /* Lightning — non-critical */
    });
}, []);
```

Idempotence intra-session via `useRef` + idempotence cross-session via `migrateSingleToFamily()` (Pitfall #9 — check `family !== null` AVANT migration). Log `__DEV__` only.

### 4. AppState listener flush queue — lignes 890-914

```typescript
useEffect(() => {
  const bootTimeout = setTimeout(() => {
    flushOfflineQueue({ profiles: profilesRefForLightning.current }).catch(() => {});
  }, 1000);

  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      flushOfflineQueue({ profiles: profilesRefForLightning.current }).catch(() => {});
    }
  });

  return () => {
    clearTimeout(bootTimeout);
    sub.remove();
  };
}, []);
```

Boot timeout 1s (laisse réseau se réveiller) + AppState 'active' (retour foreground). Cleanup propre via `clearTimeout` + `sub.remove()`. Ré-utilise `profilesRefForLightning.current` du subscriber pour rester DRY.

## Nouvelle API publique `lib/lightning`

### `processTaskCompletionForLightning(task, deps)`

```typescript
export interface ProcessTaskDeps {
  profiles: Profile[];
  activeProfileId: string | null;
}

export async function processTaskCompletionForLightning(
  task: Task,
  deps: ProcessTaskDeps,
): Promise<void>
```

Orchestrateur listener — exécute 6 étapes séquentielles :
1. `isLightningEnabled()` strict — gate SPEC Constraint #1
2. `loadFamilyConfig()` — no-op si null
3. `resolveRecipient()` — REQ-2 ; null → audit `attribution_failed` + emit
4. `findPaidEntry(audit, taskId, completedDate)` — REQ-6 ; true → audit `already_paid_today`
5. `checkDailyCap(profileId, 100, audit, cap)` atomic — REQ-4 ; capped → audit `capped` + parent-notif
6. `dispatchTrigger(cumul, mode, 100)` — REQ-3 ; queue → `enqueuePayout(... 'review')` + audit `queued` ; instant → `executePayout({source:'listener'})`

### `executePayout(input)`

```typescript
export interface ExecutePayoutInput {
  task: Task;
  recipient: { profileId: string; profile: Profile; wallet: MemberWalletMapping };
  config: FamilyLightningConfig;
  source?: 'listener' | 'flush-offline' | 'flush-review';
}

export async function executePayout(input: ExecutePayoutInput): Promise<void>
```

Exécution effective avec :
- **Lock in-memory** `Map<lockKey, Promise<void>>` (`lockKey = taskId|completedDate`) — Pitfall #2 anti-double-toggle. 2ᵉ appel reçoit le Promise du 1ᵉʳ sans relancer.
- **FaceID gate** : `authenticatePayOut({reason, allowDevicePasscode: __DEV__})` AVANT toute opération réseau. `auth.success === false` → audit `'failed'` `error:'auth_cancelled'` + emit `reason:'biometric'`. PAS d'enqueue.
- **createInvoice MEMBER** : `new LnbitsClient({baseUrl, invoiceKey: recipient.wallet.invoiceKey})` + idempotency tag dans `extra` (REQ-6 ceinture+bretelles).
- **payInvoice FAMILY** : `familyClient.payInvoice(bolt11, config.family.adminKey)` — adminKey passé explicitement.
- **Gestion erreurs source-aware** :
  - Network (`TypeError` ou `LnbitsError` sans httpStatus) + `source !== 'flush-offline'` → enqueue offline + audit `queued` + emit `network`.
  - Network + `source === 'flush-offline'` → **re-throw** (caller flushQueue gère incrementAttempt).
  - LnbitsError 4xx → audit `failed` + emit `lnbits_error`. PAS d'enqueue.

### `flushOfflineQueue(deps)`

```typescript
export interface FlushQueueDeps { profiles: Profile[]; }
export interface FlushQueueResult { paid: number; remaining: number; failed: number; }

export async function flushOfflineQueue(deps: FlushQueueDeps): Promise<FlushQueueResult>
```

Drain `reason === 'offline'` uniquement (`'review'` reste en queue pour Plan 03b PayoutQueueModal). Pour chaque item :
- Re-resolve wallet (`config.members`) + profile (`deps.profiles`) — manquant → removeFromQueue + audit `failed`.
- `executePayout({source: 'flush-offline'})` — succès → removeFromQueue + `paid++`.
- Network error catch → `incrementAttempt()` ; si `attemptCount >= MAX_ATTEMPTS (5)` → removeFromQueue + audit `failed` `error:'max_attempts'` + `failed++`.
- LnbitsError 4xx catch → executePayout a déjà audit `failed` ; removeFromQueue (pas de retry sur 4xx) + `failed++`.

### `isNetworkError(err): boolean` (helper exporté)

```typescript
export function isNetworkError(err: unknown): boolean
```

`true` si `err instanceof TypeError` OU `err instanceof LnbitsError && !err.cause?.httpStatus`. Source of truth partagée entre payout-executor et flush-queue.

## Tests Jest

### Suite `process-task-completion.test.ts` — 14 cas (608 lignes)

| # | Cas | Vérifie |
| - | --- | ------- |
| 1 | Flag OFF → no-op | audit vide après appel |
| 2 | Flag ON + no family config → no-op | audit vide |
| 3 | Attribution failed (0 mention + no active) | audit `attribution_failed` + executePayout PAS appelé |
| 4 | déjà paid today (findPaidEntry true) | audit `already_paid_today` + PAS executePayout |
| 5 | Cap dépassé | audit `capped` + emit + maybeSendParentNotif tentée |
| 6 | Mode `daily-review` | audit `queued` + queue reason `'review'` |
| 7 | Mode `hybrid` cumul >= 100 | audit `queued` reason `'review'` |
| 8 | Mode `hybrid` cumul < 100 | executePayout appelé (instant) |
| 9 | Mode `instant` + succès createInvoice + payInvoice | audit `paid` + paymentHash + emitPayoutSuccess |
| 10 | Network error (`new TypeError('fetch failed')`) | enqueuePayout reason `'offline'` + audit `queued` + emit `network` |
| 11 | LnbitsError 4xx (`httpStatus:400`) | audit `failed` + emit `lnbits_error` + PAS d'enqueue |
| 12 | Pitfall #2 — 2 toggles rapides même taskId+date | 1 seul createInvoice appelé (lock in-memory) |
| 13 | BLOCKER #1 — FaceID user_cancel | audit `failed` `auth_cancelled` + emit `biometric` + PAS createInvoice |
| 14 | BLOCKER #1 — `allowDevicePasscode` flag respecté | mock spy assert paramètre `__DEV__` |

### Suite `flush-queue.test.ts` — 10 cas (260 lignes)

| # | Cas | Vérifie |
| - | --- | ------- |
| 1 | Flag OFF | retourne `{paid:0, remaining:0, failed:0}` |
| 2 | No family config | idem |
| 3 | Queue vide | idem (avec remaining=length actuelle) |
| 4 | 1 item offline + mock success | `paid=1, remaining=0` |
| 5 | 1 item review (pas drainé) | `remaining=1, paid=0` |
| 6 | Wallet manquant entre enqueue et flush | removeFromQueue + audit `failed` `wallet_or_profile_missing` |
| 7 | Profile manquant | idem |
| 8 | 1 item offline + 5 échecs successifs (network) | au 5ᵉ : removeFromQueue + audit `failed` `max_attempts` |
| 9 | 1 item offline + LnbitsError 4xx | removeFromQueue + failed++ (pas de retry) |
| 10 | Source-aware : executePayout re-throw sur `flush-offline` | flush incrémente attempt sans double-enqueue |

### Résultats Jest

```
PASS lib/lightning/__tests__/migration.test.ts
PASS lib/lightning/__tests__/family-credentials.test.ts
PASS lib/lightning/__tests__/lightning-events.test.ts
PASS lib/lightning/__tests__/daily-cap.test.ts
PASS lib/lightning/__tests__/idempotence.test.ts
PASS lib/lightning/__tests__/trigger-mode.test.ts
PASS lib/lightning/__tests__/resolve-recipient.test.ts
PASS lib/lightning/__tests__/audit-log.test.ts
PASS lib/lightning/__tests__/payout-queue.test.ts
PASS lib/lightning/__tests__/flush-queue.test.ts
PASS lib/lightning/__tests__/lnbits-client.test.ts
PASS lib/lightning/__tests__/process-task-completion.test.ts

Test Suites: 12 passed, 12 total
Tests:       127 passed, 127 total
```

TSC clean (`npx tsc --noEmit` exit 0).

## Stratégie race condition (lock in-memory)

**Pitfall #2 RESEARCH.** Deux toggles rapides de la même tâche peuvent provoquer 2 callbacks `subscribeTaskComplete` concurrents avant que le 1ᵉʳ ait écrit l'audit `paid`. Sans lock, 2 invoices seraient créées + 2 paiements partis → double pay-out.

**Solution mise en place dans `payout-executor.ts`** :

```typescript
const inFlightLocks: Map<string, Promise<void>> = new Map();

export async function executePayout(input: ExecutePayoutInput): Promise<void> {
  const dateKey = input.task.completedDate ?? localTodayISO();
  const lockKey = `${input.task.id}|${dateKey}`;
  const existing = inFlightLocks.get(lockKey);
  if (existing) return existing;  // 2ᵉ appel attend le 1ᵉʳ
  const promise = doExecute(input, dateKey);
  inFlightLocks.set(lockKey, promise);
  try { await promise; }
  finally { inFlightLocks.delete(lockKey); }
}
```

Combinaison ceinture + bretelles :
1. **Lock intra-session** (Map) — empêche 2 invoices en vol simultanément.
2. **`findPaidEntry(audit)` cross-session** — REQ-6 ; vérifie l'audit AVANT chaque pay-out (couvre relaunch, double-process, etc.).
3. **Idempotency tag LNbits** `extra: {taskId, completedDate, profileId}` (Plan 01) — serveur LNbits peut détecter une création dupliquée.

Test cas 12 `process-task-completion.test.ts` vérifie le comportement : 2 appels parallèles → un seul `createInvoice` mocké invoqué.

## FaceID per pay-out (SPEC Constraint #4)

**Verbatim SPEC** : *"FaceID/TouchID obligatoire avant chaque pay-out famille → membre ET membre → externe. `disableDeviceFallback: true` en prod (bypass dev en `__DEV__` documenté)."*

**Implémentation dans `payout-executor.ts:106-125`** :

```typescript
const auth = await authenticatePayOut({
  reason: `Pay-out Lightning automatique → ${recipient.profile.name}`,
  allowDevicePasscode: __DEV__,  // équivalent inverse à disableDeviceFallback=!__DEV__
});
if (!auth.success) {
  await appendAudit({ ... status:'failed', error:'auth_cancelled' });
  emitPayoutFailed({ reason:'biometric' });
  return;  // PAS d'enqueue — refus utilisateur explicite
}
```

**UX trade-off accepté** : 1 prompt FaceID natif iOS par tâche cochée en mode instant. Si l'UX devient inacceptable post-TestFlight, c'est une décision discuss-phase pour amender le SPEC #4 (PAS une décision planner). `flushOfflineQueue` déclenche un FaceID par item drainé — Plan 03b PayoutQueueModal pourra décider d'un SEUL FaceID pour le batch (D-08).

Tests cas 13+14 vérifient :
- `auth.success === false` → audit `failed` `auth_cancelled` + emit `biometric` + PAS createInvoice
- `authenticatePayOut` appelé avec `allowDevicePasscode: __DEV__` (assert via mock spy)

## UX limitation acceptée MVP (RESEARCH Q2 / WARNING #5)

Le retry queue offline est déclenchée par :
1. **Boot useVault** (1s timeout post-mount)
2. **AppState transition `'active'`** (retour foreground)

**Edge case NON couvert MVP** : "mode avion levé sans backgrounding" — si l'utilisateur garde l'app au premier plan en activant/désactivant le réseau, aucun flush automatique ne se déclenche. L'utilisateur doit minimiser puis rouvrir l'app, OU attendre que l'app revienne au foreground (transition naturelle).

**Decision** : NetInfo deferred v2. Pas de dépendance supplémentaire pour cet edge case marginal. Documenté ici pour traçabilité future.

## Open items deferred

### REQ-6 audit `'undone'` → Plan 04

Plan 02 couvre les audit statuses suivants :
- `paid` (executePayout succès)
- `failed` (LNbits 4xx, auth_cancelled, max_attempts, wallet_or_profile_missing)
- `queued` (network error → offline, ou mode review/hybrid)
- `already_paid_today` (idempotence findPaidEntry)
- `capped` (daily cap dépassé)
- `attribution_failed` (resolveRecipient null)

**NON couvert** : `'undone'` (toggle true→false sur tâche déjà payée). Plan 04 ajoutera :
- `subscribeTaskUncomplete` dans `hooks/useVaultTasks.ts`
- 2ᵉ `useEffect` dans `useVault.ts` qui appelle `appendAudit({status:'undone', ...})` quand une tâche `paid` est dé-cochée

**Mitigation actuelle** : `findPaidEntry` empêche le re-cochage de re-déclencher un pay-out le même jour — la protection anti-double-payout reste effective. Seule la trace audit du dé-cochage est différée. SPEC acceptance non bloqué.

### UI affordances → Plan 03a / 03b

Aucune UI ajoutée Plan 02. Plan 03a livrera la pulse + toast post-pay-out (consomme `onPayoutSuccess`). Plan 03b livrera `PayoutQueueModal` pour drainer les items `reason='review'` (mode daily-review/hybrid) avec validation parentale batch.

### Cleanup → Plan 04

`lib/lightning/credentials.ts` (legacy single-wallet) et les écrans spike (`app/lightning-family-spike.tsx`, etc.) restent en place — Plan 04 cleanup.

## Threat surface (rappel)

Aucun nouveau threat introduit hors du `<threat_model>` du PLAN. T-53-02-08 (credential exposure / pay-out fraudulent) **mitigated** via FaceID per pay-out (SPEC #4). Plus aucun risque high non mitigé.

## Commit log

```
73ea65b3 docs(53-02): log pré-existant Jest failures hors-scope Lightning
e3cbab7f feat(53-02): brancher Lightning dans hooks/useVault.ts — 3 useEffects
f6909cfc feat(53-02): orchestrateurs runtime Lightning (process-task / payout-executor / flush-queue)
```

**Dernier hash : `73ea65b3`** (HEAD `feat/lightning-farm`).

## Decisions clés

1. **Source-aware executePayout** (correction architecturale plan) — paramètre `source` (listener / flush-offline / flush-review) évite la double-enqueue depuis flush-queue. Sur `'flush-offline'` + network error → re-throw (caller incremente attempt sans enqueue).
2. **`isNetworkError` exporté** — single source of truth partagée payout-executor + flush-queue (`TypeError` OU `LnbitsError` sans `httpStatus`).
3. **`allowDevicePasscode: __DEV__`** plutôt que `disableDeviceFallback: !__DEV__` — `biometric-gate.ts` (Plan 01) utilise le sens positif. Sémantique strictement équivalente, validée test cas 14.
4. **Boot timeout 1s avant flush** — laisse le réseau se réveiller post-mount, évite un fail immédiat sur AppState 'active' initial déclenché par expo-router boot.
5. **Refs Lightning dédiées** plutôt que réutilisation widget/Auberge refs — découplage explicite, plus facile à raisonner.
6. **REQ-6 audit `'undone'` différé Plan 04** — protection anti-double-payout `findPaidEntry` couvre le besoin SPEC critique, seule la trace audit du dé-cochage est différée.

## Note pour tester manuellement (dev-client)

1. `LIGHTNING_ENABLED=true` dans `SettingsLightning.tsx` (UI Plan 04 ou via debug screen Plan 01)
2. Configurer family wallet + 1 wallet member avec `demo.lnbits.com` (admin key + invoice key)
3. Créer une tâche `@<member_name> range tes legos`
4. Cocher la tâche → prompt FaceID natif iOS → confirmer
5. Vérifier l'audit log : `await loadAudit()` en console dev doit contenir une entrée `status:'paid'` avec `paymentHash` non vide
6. Re-cocher la même tâche le même jour → audit `'already_paid_today'`, PAS de 2ᵉ pay-out

## Self-Check: PASSED

**Fichiers créés (vérification disque)** :

- `lib/lightning/process-task-completion.ts` ✓ FOUND (170 lignes)
- `lib/lightning/payout-executor.ts` ✓ FOUND (245 lignes)
- `lib/lightning/flush-queue.ts` ✓ FOUND (136 lignes)
- `lib/lightning/__tests__/process-task-completion.test.ts` ✓ FOUND (608 lignes)
- `lib/lightning/__tests__/flush-queue.test.ts` ✓ FOUND (260 lignes)
- `.planning/phases/53-lightning-family-wallet/deferred-items.md` ✓ FOUND

**Commits (vérification git log)** :

- `f6909cfc` (T1 — orchestrateurs + tests) ✓ FOUND
- `e3cbab7f` (T2 — useVault.ts wiring) ✓ FOUND
- `73ea65b3` (docs deferred-items) ✓ FOUND

**TSC** : `npx tsc --noEmit` exit 0 ✓
**Jest Lightning** : 12 suites / 127 tests passés ✓
**Jest projet** : 5 suites pré-existantes en échec (out-of-scope, vérifié en stash — voir `deferred-items.md`) ✓
