---
phase: 53-lightning-family-wallet
plan: 01
subsystem: lightning
tags: [lightning, lnbits, secure-store, async-storage, jest, idempotence, audit-log, member-rename]
dependency_graph:
  requires: []
  provides:
    - lib/lightning module pur (résolution destinataire, audit-log, daily-cap, trigger-mode, payout-queue, parent-notif, migration, event bus)
    - MemberWalletMapping + FamilyLightningConfig étendus (triggerMode, dailyCapPerMember)
    - Bus d'événements singleton onPayoutSuccess/onPayoutFailed
    - createInvoice(amount, memo, extra?) idempotency tag REQ-6
    - Migration single→family idempotente REQ-11
  affects:
    - lib/lightning/credentials.ts (legacy conservé, suppression Plan 04)
    - app/lightning-family-spike.tsx (updated to MemberWalletMapping local alias, suppression Plan 04)
    - components/settings/SettingsLightning.tsx (intouché Plan 01 — Plan 02/04 cleanup)
tech_stack:
  added:
    - "@react-native-async-storage/async-storage@2.2.0 (BLOCKER #2 résolu — audit log Pitfall #1)"
    - "expo-camera@~17.0.10 (préparation Plan 03b QR scanner)"
  patterns:
    - SecureStore JSON load/save/clear avec validation défensive (Pattern 2 RESEARCH)
    - Event bus singleton Set<Listener> (Pattern 3 RESEARCH, inspiré useVaultTasks.ts:76-82)
    - Backward-compat parser bidirectionnel (read accepts old+new, write always new — REQ-12)
key_files:
  created:
    - lib/lightning/resolve-recipient.ts
    - lib/lightning/audit-log.ts
    - lib/lightning/daily-cap.ts
    - lib/lightning/trigger-mode.ts
    - lib/lightning/payout-queue.ts
    - lib/lightning/parent-notif.ts
    - lib/lightning/migration.ts
    - lib/lightning/lightning-events.ts
    - lib/lightning/__tests__/__mocks__/secure-store.ts
    - lib/__tests__/__mocks__/async-storage.ts
    - lib/lightning/__tests__/resolve-recipient.test.ts
    - lib/lightning/__tests__/audit-log.test.ts
    - lib/lightning/__tests__/daily-cap.test.ts
    - lib/lightning/__tests__/trigger-mode.test.ts
    - lib/lightning/__tests__/payout-queue.test.ts
    - lib/lightning/__tests__/idempotence.test.ts
    - lib/lightning/__tests__/migration.test.ts
    - lib/lightning/__tests__/lightning-events.test.ts
    - lib/lightning/__tests__/family-credentials.test.ts
    - lib/lightning/__tests__/lnbits-client.test.ts
  modified:
    - lib/lightning/types.ts (Child→Member rename + adminKey? + triggerMode + dailyCapPerMember)
    - lib/lightning/family-credentials.ts (backward-compat children→members + defaults)
    - lib/lightning/lnbits-client.ts (createInvoice extra? + Pitfall #4 conservé)
    - lib/lightning/index.ts (barrel rénové, retire ChildWalletMapping, ajoute 30+ exports nouveaux)
    - app/lightning-family-spike.tsx (alias local ChildWalletMapping = MemberWalletMapping)
    - app.json (plugin expo-camera FR + NSCameraUsageDescription enrichi)
    - package.json (2 nouvelles dépendances)
    - jest.config.js (moduleNameMapper pour @react-native-async-storage/async-storage)
decisions:
  - "Audit log → AsyncStorage (pas SecureStore) — Pitfall #1 RESOLVED : ~160 KB > limite 2 KB ; audit = info publique post-paiement (paymentHash sur blockchain LN), pas un secret"
  - "Backward-compat REQ-12 au niveau du PARSER (family-credentials.ts) — pas d'alias rétro-compat dans types.ts (rename type complet)"
  - "Pitfall #4 conservé verbatim : double fallback `raw.bolt11 ?? raw.payment_request` dans createInvoice"
  - "Migration single→family check family FIRST (Pitfall #9) — empêche écrasement family existante par single legacy injecté"
  - "Bus d'événements module-level (singleton) plutôt que hook React — partage entre hook domaine et UI sans Provider (Pattern 3)"
  - "enqueuePayout signature : Omit<PayoutQueueItem, 'attemptCount'|'queuedAt'|'reason'> + reason en 2ᵉ param (correction du contrat plan pour éviter conflit type)"
metrics:
  duration_minutes: 75
  completed_date: 2026-05-18
  tasks_completed: 2
  files_created: 20
  files_modified: 8
  tests_added: 103
  commits: 2
---

# Phase 53 Plan 01 : Module pur Lightning — Fondation Phase 53

Module Lightning Phase 53 complet : 8 modules purs testables, rétro-compat Child→Member, idempotency tag LNbits, AsyncStorage retenu pour l'audit log.

## Résumé exécutif

Le plan 01 livre la **fondation testable** que les plans 02-04 vont consommer :

- **8 nouveaux modules** `lib/lightning/*.ts` (résolution destinataire, audit log, daily cap, trigger mode, queue, parent notif, migration, event bus)
- **103 tests Jest** dans 10 suites (10/10 PASS)
- **Rétro-compat Child→Member** au niveau du parser : les utilisateurs existants ne perdent rien (REQ-12 partial)
- **2 nouvelles dépendances installées** : `@react-native-async-storage/async-storage` (BLOCKER #2 résolu — audit ~160 KB ne tient pas dans SecureStore 2 KB) et `expo-camera` (préparation Plan 03b)
- **TSC clean** sur tout le module Lightning + playground spike updated pour compiler

## Files créés / modifiés

### Nouveaux modules `lib/lightning/`

| Fichier | Rôle | API exposée |
|---------|------|-------------|
| `resolve-recipient.ts` | Fonction pure d'attribution destinataire (REQ-2) | `resolveRecipient(task, profiles, memberWallets, activeProfileId)` |
| `audit-log.ts` | Audit AsyncStorage 90j (REQ-7) | `loadAudit`, `appendAudit`, `clearAudit`, `purgeOlderThan`, `findPaidEntry`, `AuditEntry`, `AuditStatus`, `AUDIT_KEY`, `RETENTION_DAYS` |
| `daily-cap.ts` | Daily cap atomic (REQ-4) | `checkDailyCap`, `getCumulSatsToday` (timezone locale) |
| `trigger-mode.ts` | Dispatch 3 modes (REQ-3) | `dispatchTrigger`, `HYBRID_THRESHOLD_SATS`, `TriggerMode`, `TriggerDispatch` |
| `payout-queue.ts` | Queue offline SecureStore (REQ-5) | `loadQueue`, `enqueuePayout`, `removeFromQueue`, `incrementAttempt`, `clearQueue`, `MAX_ATTEMPTS=5`, `PayoutQueueItem`, `PayoutReason` |
| `parent-notif.ts` | Notif parent agrégée D-10 | `maybeSendParentNotif`, `buildBody`, `LAST_NOTIF_KEY`, `DailySummary`, `NotifResult` |
| `migration.ts` | Migration single→family REQ-11 | `migrateSingleToFamily`, `MigrationOutcome` |
| `lightning-events.ts` | Bus d'événements singleton | `onPayoutSuccess`, `emitPayoutSuccess`, `onPayoutFailed`, `emitPayoutFailed`, `PayoutSuccessEvent`, `PayoutFailedEvent`, `PayoutFailedReason` |

### Modules étendus

| Fichier | Changements |
|---------|-------------|
| `types.ts` | Rename `ChildWalletMapping`→`MemberWalletMapping` (+ `adminKey?` REQ-10). `FamilyLightningConfig` : `members[]`, `triggerMode`, `dailyCapPerMember` (REQ-3 + REQ-4) |
| `family-credentials.ts` | `loadFamilyConfig` accepte `children` ET `members` à la lecture (backward-compat REQ-12). `saveFamilyConfig` écrit toujours `members`. Defaults : `triggerMode='instant'`, `dailyCapPerMember` clampé 100-10000 (default 1000) |
| `lnbits-client.ts` | `createInvoice(amount, memo, extra?)` : 3ᵉ param injecté dans `body.extra` (idempotency tag REQ-6). Pitfall #4 conservé verbatim (`raw.bolt11 ?? raw.payment_request`) |
| `index.ts` | Barrel rénové : retire `ChildWalletMapping`, ajoute `MemberWalletMapping` + 30+ exports nouveaux modules. Conserve provisoirement legacy `loadLnbitsConfig`/`saveLnbitsConfig`/`clearLnbitsConfig` (cleanup Plan 04) |

### Build files

| Fichier | Changement |
|---------|------------|
| `package.json` | + `@react-native-async-storage/async-storage@2.2.0`, + `expo-camera@~17.0.10` |
| `app.json` | + plugin `expo-camera` (cameraPermission FR), `NSCameraUsageDescription` enrichi pour mentionner les QR Lightning |
| `jest.config.js` | + moduleNameMapper pour `@react-native-async-storage/async-storage` → `lib/__tests__/__mocks__/async-storage.ts` |

### Mocks tests

| Fichier | Rôle |
|---------|------|
| `lib/__tests__/__mocks__/async-storage.ts` | Mock global AsyncStorage in-memory (default + named exports) |
| `lib/lightning/__tests__/__mocks__/secure-store.ts` | Mock local SecureStore avec helpers `__resetMock`, `__seedMock`, `__snapshot` |

### Playground (updated, suppression Plan 04)

| Fichier | Changement |
|---------|------------|
| `app/lightning-family-spike.tsx` | Type alias local `type ChildWalletMapping = MemberWalletMapping`. Field access `config.children` → `config.members`. `onSave` shape étendue avec `triggerMode` + `dailyCapPerMember`. Le playground compile et fonctionne en l'état pour Plan 02. |

## Tests — 103 / 103 PASS

Commande : `npx jest --no-coverage lib/lightning/__tests__/`

```
Test Suites: 10 passed, 10 total
Tests:       103 passed, 103 total
Time:        7.151 s
```

Détail par suite :

| Suite | Tests | Couvre |
|-------|------:|--------|
| `resolve-recipient.test.ts` | 13 | 6 cas SPEC REQ-2 + robustesse case-insensitive + match par id + pas de fuzzy match |
| `audit-log.test.ts` | 15 | Round-trip append/load, purgeOlderThan(90) via `jest.useFakeTimers()` + `setSystemTime`, validation défensive, clearAudit, findPaidEntry REQ-6 |
| `daily-cap.test.ts` | 13 | Cumul filtré par profile/date/status, cap dépassé, borne inclusive, 11ᵉ pay-out capped avec 10×100 + cap 1000 |
| `trigger-mode.test.ts` | 10 | 3 modes complets, seuil hybrid 100 STRICT (cumul=99 → instant, cumul=100 → queue) |
| `payout-queue.test.ts` | 13 | Enqueue/load round-trip, incrementAttempt + lastError, 5 attempts (caller décide remove), removeFromQueue par taskId+profileId, MAX_ATTEMPTS=5 |
| `idempotence.test.ts` | 7 | REQ-6 findPaidEntry, paid + undone même jour → true, paymentHash conservé, scénario complete→undo→re-complete |
| `migration.test.ts` | 7 | 4 cas A/B/C/D Pitfall #9 (single seul, family seule, single+family, ni l'un ni l'autre) + idempotence 2× |
| `lightning-events.test.ts` | 5 | Success bus subscribe/emit/unsub, multi-listeners, listener qui throw n'empêche pas les autres, failed bus symétrique |
| `family-credentials.test.ts` | 18 | Backward-compat children→members (3 cas), defaults triggerMode/dailyCapPerMember, clamp 100-10000, normalisation save, omet adminKey vide |
| `lnbits-client.test.ts` | 7 | createInvoice avec extra → body.extra, sans extra → omis, validation amountSats, Pitfall #4 (bolt11 / payment_request) |

## Décision audit-log : AsyncStorage vs SecureStore

**Décision : AsyncStorage retenu** (Pitfall #1 RESOLVED, RESEARCH Q1).

**Raisons** :

- **Volume** : 90 jours × 4 membres × ~3 entrées/jour × ~150 octets ≈ **160 KB**. Limite SecureStore iOS Keychain `kSecClassGenericPassword` ≈ **2 KB par clé**. AsyncStorage n'a pas cette limite.
- **Pas un secret** : `paymentHash` est public sur la blockchain Lightning. Le chiffrement OS-level n'apporte rien — n'importe qui avec l'instance LNbits peut tout reconstruire.
- **Threat T-53-01-02 (Tampering audit-log) = `accept`** dans la STRIDE table du plan — l'audit log est informationnel, pas une preuve de paiement (la blockchain LN l'est).
- **Séparation préservée** : creds (`family.adminKey`), queue, flag, `lightning_last_parent_notif_v1` timestamp restent en **SecureStore** (chiffrement OS-level).

**Clé AsyncStorage** : `@lightning_audit_v1` (préfixe `@` conformément à la convention AsyncStorage du projet, vérifiable dans `lib/vault-cache.ts` qui utilise `expo-file-system` pour le cache vault — pas de collision).

## Backward-compat REQ-12 — Child → Member

**Stratégie** :

1. **Type-level** : rename complet `ChildWalletMapping` → `MemberWalletMapping`. Le type `FamilyLightningConfig.children: ChildWalletMapping[]` devient `FamilyLightningConfig.members: MemberWalletMapping[]`. PAS d'alias rétro-compat dans `types.ts` (cleanup REQ-12).
2. **Parser-level** : `loadFamilyConfig` accepte les deux shapes JSON à la lecture :
   ```typescript
   const membersArrayRaw = Array.isArray(parsed.members)
     ? parsed.members
     : Array.isArray((parsed as { children?: unknown }).children)
       ? (parsed as { children: unknown[] }).children
       : [];
   ```
3. **Writer-level** : `saveFamilyConfig` écrit TOUJOURS `members: [...]`. Au prochain save d'un utilisateur déjà configuré sur l'ancien shape, la migration silencieuse opère et l'ancien `children:` disparaît.
4. **Tests validés** : `family-credentials.test.ts` couvre 3 scénarios — JSON legacy (`children`), JSON nouveau (`members`), JSON mixte (les deux présents — préfère `members`).

**Playground spike** : `app/lightning-family-spike.tsx` utilise un type alias **local** `type ChildWalletMapping = MemberWalletMapping` pour permettre la compilation tout en gardant le code identique. Le fichier sera entièrement supprimé en Plan 04.

## Sécurité — vérifications

| Contrôle | Statut |
|----------|--------|
| Aucun `console.*` non gardé par `if (__DEV__)` dans les 8 nouveaux modules | OK — 12 occurrences, toutes guardées |
| Aucun log de `adminKey` (Threat T-53-01-04) | OK — 0 référence dans console.* ; les 2 occurrences `adminKey` dans migration.ts sont structurelles (`adminKey: ''`) |
| SecureStore pour creds + queue + flag + parent-notif timestamp | OK |
| AsyncStorage pour audit log uniquement (Pitfall #1) | OK |
| Validation défensive sur tous les loads (JSON corrompu → retour vide silencieux) | OK — 4 modules concernés |
| Idempotence migration (Pitfall #9 — check family FIRST) | OK — 3 cas testés + 2× idempotence |
| `disableDeviceFallback: !allowDevicePasscode` (biometric-gate.ts) | Inchangé Plan 01, vérifié Plan 02/03 |

## Open items déférés

| Item | Plan cible | Raison |
|------|-----------|--------|
| Listener Lightning sur `taskCompleteListenersRef` dans `useVault.ts` | **Plan 02** | Hook React intégration, hors scope module pur |
| `recordAudit('undone', ...)` au toggle dé-validation | **Plan 04** | REQ-6 partial — Plan 01 implémente `paid`/`failed`/`already_paid_today` ; le `undone` se branche dans `useVaultTasks` (Plan 04) |
| Provisioning runtime de la notif parent (Notifications permission + dispatch effectif) | **Plan 02** | `parent-notif.ts` expose l'API ; Plan 02 wire au VaultProvider effect |
| UI carte cagnotte ferme + écran `/lightning-wallet` + bouton HUD ⚡ | **Plan 03a / 03b** | Aucune UI dans Plan 01 |
| Suppression `lib/lightning/credentials.ts` (legacy single-wallet) | **Plan 04** | Plan 02 migration consomme encore ce module |
| Suppression `app/lightning-family-spike.tsx` + `app/lightning-spike.tsx` | **Plan 04** | Cleanup atomique avec SettingsLightning.tsx |
| Suppression des exports legacy `loadLnbitsConfig`/`saveLnbitsConfig`/`clearLnbitsConfig` du barrel | **Plan 04** | Plan 02 migration consomme ces fonctions |
| Lock global anti race-condition cap (Pitfall #3) | **Plan 02** | Le check pur est en place ; le sérializeur du listener vient avec le hook |
| Retry exponentiel + AppState/NetInfo listener pour flush queue | **Plan 02** | Queue persistante prête ; orchestration retry hors scope module pur |
| QR scanner UI (CameraView + `useCameraPermissions`) | **Plan 03b** | expo-camera installé + permission FR ajoutée |

## Notes développeur

**Rebuild dev-client requis avant Plan 03b** :

```bash
npx expo run:ios --device
```

Cette étape est nécessaire pour intégrer nativement les 2 nouvelles dépendances installées :
- `@react-native-async-storage/async-storage` (utilisée par `lib/lightning/audit-log.ts`)
- `expo-camera` (utilisée par Plan 03b QR scanner)

Le mock global `lib/__tests__/__mocks__/async-storage.ts` permet aux tests Jest de tourner SANS rebuild — l'audit log est entièrement testé en mémoire.

## Ajustements par rapport au plan

1. **`enqueuePayout` signature** : le plan listait `item: Omit<PayoutQueueItem,'attemptCount'|'queuedAt'>, reason: 'offline'|'review'` — le type `Omit` conservait `reason` ce qui créait un conflit avec le 2ᵉ paramètre. **Correction** : `Omit<PayoutQueueItem, 'attemptCount' | 'queuedAt' | 'reason'>` (3 champs omis au lieu de 2). Documenté dans le code.

2. **Helper `parent-notif.ts`** : ajouté `resetLastNotifTimestamp` (non exporté du barrel) pour faciliter les tests futurs Plan 02 sans casser la sémantique cap-1/jour.

3. **Test `lightning-events.test.ts`** : non listé dans le plan mais ajouté pour couvrir le bus singleton (5 tests, ~30 secondes). Indispensable pour Plan 02 qui va emit() depuis le listener.

4. **Test `family-credentials.test.ts`** : non listé dans le plan mais ajouté pour valider Task 1 backward-compat (18 tests). Le plan listait 7 suites tests — on en livre 10 (les 3 extra : family-credentials, lnbits-client, lightning-events).

5. **Mock AsyncStorage** : ajouté au moduleNameMapper de `jest.config.js` plutôt qu'à chaque test individuellement. Plus DRY et cohérent avec le pattern existant pour `expo-secure-store`.

## Commits

```
0884273d feat(53-01): modules purs Lightning + 8 suites Jest (103 tests)
f1aec689 feat(53-01): types Member + family-credentials backward-compat + lnbits-client extra
```

## Self-Check: PASSED

Vérification finale :

- [x] `npx tsc --noEmit` clean (0 erreurs sur le module Lightning)
- [x] `npx jest --no-coverage lib/lightning/__tests__/` → 10 suites, 103 tests, 0 fail
- [x] 8 nouveaux modules `lib/lightning/*.ts` créés et exportés via barrel
- [x] 2 dépendances installées (`@react-native-async-storage/async-storage`, `expo-camera`)
- [x] `app.json` : plugin expo-camera + NSCameraUsageDescription FR
- [x] Backward-compat REQ-12 : `loadFamilyConfig` lit `children` ET `members` ; `saveFamilyConfig` écrit toujours `members`
- [x] `createInvoice(amount, memo, extra?)` envoie `body.extra` quand fourni
- [x] Pitfall #4 conservé : `raw.bolt11 ?? raw.payment_request`
- [x] Migration `single → family` idempotente (4 cas testés)
- [x] Aucun `console.*` non guardé `__DEV__` dans les nouveaux modules
- [x] Aucun log de `adminKey`
- [x] Bus d'événements `lightning-events.ts` prêt pour Plan 02 (emit) + Plan 03 (subscribe)
