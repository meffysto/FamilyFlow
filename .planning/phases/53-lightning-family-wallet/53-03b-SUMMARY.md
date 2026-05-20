---
phase: 53-lightning-family-wallet
plan: 03b
subsystem: lightning
tags: [lightning, ui, modal, qr-scanner, encaissement, settings, integration, checkpoint-device, faceid, bypassBiometric]
dependency_graph:
  requires:
    - "53-01 (module pur Lightning — types, audit, queue, family-credentials, bus onPayoutSuccess)"
    - "53-02 (runtime wiring — executePayout, processTaskCompletionForLightning, flush-queue)"
    - "53-03a (5 composants visuels — HudLightningButton, BalanceCard, AuditLogItem, PayoutQueueItem, TriggerModeSelector)"
  provides:
    - "app/lightning-wallet.tsx — écran wallet (balance + audit + Encaisser) consommé par tap HUD ⚡"
    - "components/lightning/CashOutModal.tsx — modal encaissement bolt11 + paste + scan QR + FaceID"
    - "components/lightning/PayoutQueueModal.tsx — modal validation batch parent FaceID unique + bypassBiometric propagé"
    - "components/lightning/QrScannerOverlay.tsx — overlay fullScreen scan QR Lightning"
    - "Paramètre `bypassBiometric?: boolean` sur ExecutePayoutInput (D-08 — 1 FaceID seul pour batch)"
    - "Subscriber onPayoutSuccess dans app/(tabs)/tree.tsx → triggerPulse() + toast ToastSeal V2"
    - "Route /lightning-wallet déclarée dans app/_layout.tsx"
    - "SettingsLightning étendu — TriggerModeSelector + dailyCap input + queue entry conditionnelle"
  affects:
    - "lib/lightning/payout-executor.ts (ExecutePayoutInput étendu — `bypassBiometric?: boolean`)"
    - "app/(tabs)/tree.tsx (3 insertions chirurgicales — imports + states + 2 useEffects + bouton HUD)"
    - "app/_layout.tsx (1 ligne — Stack.Screen name='lightning-wallet')"
    - "components/settings/SettingsLightning.tsx (extension — handlers spike RETIRÉS, 3 sous-sections ajoutées)"
tech_stack:
  added: []
  patterns:
    - "Modal pageSheet + drag-to-dismiss (CashOutModal, PayoutQueueModal) — convention CLAUDE.md"
    - "Modal fullScreen au-dessus de pageSheet sibling (QrScannerOverlay PAR-DESSUS CashOutModal — Pitfall #7 stacking iOS)"
    - "FaceID gate via authenticatePayOut({ allowDevicePasscode: __DEV__ }) — sémantique strictement équivalente à disableDeviceFallback: !__DEV__ (SPEC #4)"
    - "bypassBiometric: true UNIQUEMENT propagé depuis PayoutQueueModal batch (D-08) — listener/flush-offline gardent leur propre FaceID"
    - "Subscribe onPayoutSuccess (bus Plan 01) au mount + cleanup via unsub — pattern Set<Listener>"
    - "AppState 'active' listener pour refresh balance event-driven (D-05) — pas de polling"
    - "Reanimated 4 — HudLightningButton.triggerPulse() piloté depuis useEffect parent via ref"
key_files:
  created:
    - components/lightning/QrScannerOverlay.tsx
    - components/lightning/CashOutModal.tsx
    - components/lightning/PayoutQueueModal.tsx
    - app/lightning-wallet.tsx
  modified:
    - lib/lightning/payout-executor.ts
    - app/(tabs)/tree.tsx
    - app/_layout.tsx
    - components/settings/SettingsLightning.tsx
decisions:
  - "bypassBiometric: boolean ajouté SUR ExecutePayoutInput (Plan 02) — propagé depuis PayoutQueueModal pour D-08 (1 FaceID seul pour N pay-outs). Listener instant + flush-offline + flush-review individuel passent toujours par leur propre gate FaceID."
  - "QrScannerOverlay rendu en SIBLING du CashOutModal (même tree React) avec presentationStyle=fullScreen — bénéficie du stacking natif iOS sans dismiss+present (Pitfall #7). Pas de timeout, pas de gymnastique d'état."
  - "FaceID utilisé via `allowDevicePasscode: __DEV__` (biometric-gate.ts sense) — sémantiquement identique à `disableDeviceFallback: !__DEV__` du SPEC. Le test cas 14 Plan 02 vérifie cette équivalence."
  - "Permission caméra demandée au MOUNT VISIBLE de QrScannerOverlay (pas au mount initial du CashOutModal) — évite un prompt prématuré à l'ouverture du modal encaissement (Pitfall #6)."
  - "Toast ToastSeal V2 (icon + subtitle) déclenché par showToast(message, type, undefined, { icon: '⚡', subtitle: profileName }) — routage automatique V1/V2 dans ToastContext (lignes 318-320)."
  - "FakeTask construction dans PayoutQueueModal — satisfies Pick<Task, …> as Task pour passer TSC sans 'as any' explicite. Le runtime executePayout n'utilise que id + text de toute façon."
  - "Audit log filtré sur activeProfile.id (T-53-03b-05 isolation) + slice(-10).reverse() — plus récent en haut, pattern UI-SPEC."
  - "Suppression des liens /lightning-spike + /lightning-family-spike dans SettingsLightning UNIQUEMENT (Pitfall #10) — les fichiers spike eux-mêmes restent (Plan 04 les supprime). Évite un crash navigation en cas d'arrivée d'un user qui aurait bookmarké ces URLs internes."
  - "REQ-6 audit 'undone' encore deferred Plan 04 (cohérent avec Plan 02 — la protection anti-double-payout `findPaidEntry` reste effective)."
metrics:
  duration_minutes: 60
  completed_date: 2026-05-18
  tasks_completed: 1
  files_created: 4
  files_modified: 4
  tests_added: 0
  commits: 8
---

# Phase 53 Plan 03b : Intégration UI Lightning Family Wallet

Wave 4 du chemin critique Phase 53. Plan 03b livre **les 3 modals + 1 écran route + 4 extensions** qui branchent les composants visuels Plan 03a dans l'application FamilyFlow. Le bouton HUD ⚡ apparaît dans la ferme (conditionnel flag + wallet), le tap navigue vers `/lightning-wallet` (balance + audit + Encaisser), et le pay-out instant déclenche pulse + toast event-driven via le bus `onPayoutSuccess` (Plan 01).

Plan exécuté avec `/gsd-execute-phase 53` device + LNbits BYO instance prepared. Le plan est `autonomous: false` — un checkpoint device est requis en fin de plan pour valider visuellement les flows sur iPhone physique (le simulateur ne supporte pas la caméra). **La présente exécution s'arrête avant le checkpoint humain ; les résultats device sont à fournir par le développeur.**

## Résumé exécutif

- **4 nouveaux fichiers** : 3 modals lightning + 1 écran route hors tabs (1110 lignes insérées).
- **4 fichiers étendus** : payout-executor (paramètre bypassBiometric D-08), tree.tsx (HUD + listener), _layout (route), SettingsLightning (extension + cleanup liens spike).
- **8 commits atomiques** sur `feat/lightning-farm` (chacun isolé pour rollback granulaire).
- **TSC clean** : `npx tsc --noEmit` exit 0 sur tout le projet.
- **0 couleur hardcodée** dans les 4 nouveaux fichiers (grep `#…` ou `rgba?\(` retourne 0).
- **0 lien `lightning-spike` ou `lightning-family-spike`** dans SettingsLightning (les fichiers spike eux-mêmes restent — Plan 04 supprime).

## Files créés / modifiés

### Créés (4)

| Fichier | Lignes | Rôle |
|---------|-------:|------|
| `components/lightning/QrScannerOverlay.tsx` | 239 | Modal fullScreen scan QR — CameraView + permission caméra + fallback Linking.openSettings (Pitfall #6) |
| `components/lightning/CashOutModal.tsx` | 366 | Modal pageSheet encaissement bolt11 — paste + scan QR + disclaimer + FaceID + payInvoice |
| `components/lightning/PayoutQueueModal.tsx` | 308 | Modal pageSheet validation batch parent — FaceID unique + bypassBiometric propagé + boucle for…of (D-08 + D-09) |
| `app/lightning-wallet.tsx` | 296 | Écran route hors tabs — BalanceCard hero + audit list filtrée + Encaisser + Effacer historique |

### Modifiés (4)

| Fichier | Δ lignes | Changement |
|---------|---------:|------------|
| `lib/lightning/payout-executor.ts` | +38 / -19 | Ajout `bypassBiometric?: boolean` sur ExecutePayoutInput. Si true, SKIPPE le gate FaceID interne (D-08). |
| `app/(tabs)/tree.tsx` | +75 | 3 insertions chirurgicales : imports Phase 53 (l.150-163), 3 states + ref (l.494-500), 2 useEffects (load flag/config + subscribe onPayoutSuccess), bouton HUD ⚡ inséré après 📷 (l.3585-3596) |
| `app/_layout.tsx` | +4 | `<Stack.Screen name="lightning-wallet" />` à côté d'impressions |
| `components/settings/SettingsLightning.tsx` | +187 / -52 | TriggerModeSelector + dailyCap input + queue entry conditionnelle. 2 handlers spike + 2 TouchableOpacity vers lightning-spike/lightning-family-spike RETIRÉS (Pitfall #10). |

## Intégration — points clés

### Subscriber onPayoutSuccess dans tree.tsx

```typescript
// app/(tabs)/tree.tsx l.580-592
useEffect(() => {
  const unsub = onPayoutSuccess((evt) => {
    hudLightningRef.current?.triggerPulse();
    showToast(
      `+${evt.sats} sats ⚡`,
      'success',
      undefined,
      { icon: '⚡', subtitle: evt.profileName },
    );
  });
  return unsub;
}, [showToast]);
```

Le ref `hudLightningRef` est branché sur le `HudLightningButton` (Plan 03a) qui expose `triggerPulse()` via `useImperativeHandle` — animation Reanimated 4 spring scale 1→1.2→1.

### Visibilité conditionnelle du bouton HUD

```typescript
// app/(tabs)/tree.tsx l.552-578
useEffect(() => {
  let alive = true;
  Promise.all([isLightningEnabled(), loadFamilyConfig()])
    .then(([flag, config]) => {
      if (!alive) return;
      if (!flag || !config || !activeProfile) {
        setLightningVisible(false);
        setLightningMember(null);
        return;
      }
      const m = config.members.find((mm) => mm.profileId === activeProfile.id);
      setLightningMember(m ?? null);
      setLightningVisible(!!m);
    })
    .catch(() => { /* … */ });
  return () => { alive = false; };
}, [activeProfile?.id]);
```

Re-évalué à chaque changement de profil actif. Si flag OFF ou si activeProfile.id n'a pas de wallet mappé → bouton non rendu (`return null`).

### Refresh balance event-driven (D-05)

`app/lightning-wallet.tsx` charge la balance dans 3 cas — **aucun polling** :

1. **Au mount** + chaque changement config/member (deps `[refreshBalance, reloadAudit]`)
2. **onPayoutSuccess** — `unsub` cleanup sur unmount
3. **AppState 'active'** — retour foreground (`AppState.addEventListener('change')` + `sub.remove()` cleanup)

### Stacking iOS QrScannerOverlay (Pitfall #7)

`QrScannerOverlay` est rendu DANS le tree React de `CashOutModal` (sibling, pas via setShow + dismiss). Sa propre `<Modal presentationStyle="fullScreen">` est présentée PAR-DESSUS la pageSheet du CashOutModal — iOS gère le stack natif sans bug d'animation. Pas de timeout 300ms, pas de gymnastique d'état.

### bypassBiometric: propagation D-08

```typescript
// components/lightning/PayoutQueueModal.tsx l.99-114
const auth = await authenticatePayOut({
  reason: 'Valider les pay-outs Lightning',
  allowDevicePasscode: __DEV__,
});
// … pour chaque item …
await executePayout({
  task: fakeTask,
  recipient: { profileId, profile, wallet },
  config,
  source: 'flush-review',
  bypassBiometric: true,  // ← D-08 : 1 seul FaceID en haut du batch
});
```

Dans `payout-executor.ts`, le gate biométrique est wrappé par `if (!bypassBiometric) { … }` — quand true, on saute directement au createInvoice. **Sécurité** : ce bypass est UNIQUEMENT propagé depuis PayoutQueueModal. Le listener instant + flush-offline + flush-review individuel passent toujours par leur propre FaceID.

### Encaissement out (REQ-9 + REQ-10)

```typescript
// components/lightning/CashOutModal.tsx l.108-138
const auth = await authenticatePayOut({
  reason: "Confirmer l'encaissement Lightning",
  allowDevicePasscode: __DEV__,
});
if (!auth.success) { … }
const client = new LnbitsClient({
  baseUrl: config.baseUrl,
  invoiceKey: member.invoiceKey,
});
const result = await client.payInvoice(bolt11, member.adminKey);
await appendAudit({
  …,
  status: 'cash_out',
  paymentHash: result.paymentHash,
});
```

`canCashOut = !!member.adminKey` — sans admin key, le bouton "Encaisser" reste désactivé avec `accessibilityHint="Admin key requise pour encaisser"`.

## Permissions natives utilisées

| Permission | Pourquoi | Où |
|-----------|----------|-----|
| `NSCameraUsageDescription` | Scan QR Lightning bolt11 | Déjà déclaré dans app.json par Plan 01 (`expo-camera` plugin). QrScannerOverlay consomme via `useCameraPermissions()` + fallback `Linking.openSettings()` si refusé. |
| **FaceID / TouchID** | Gate biométrique pay-out + encaissement | `authenticatePayOut` via `expo-local-authentication` (Plan 01). `disableDeviceFallback: !__DEV__` — strict en prod, fallback PIN dev only. Pas de permission Info.plist supplémentaire — iOS gère automatiquement. |

## TSC

```
$ npx tsc --noEmit
TypeScript compilation completed
EXIT_CODE=0
```

Zéro erreur TypeScript sur l'ensemble du projet. Les pré-existants signalés CLAUDE.md (MemoryEditor.tsx, cooklang.ts, useVault.ts) restent silencieux car non touchés.

## Vérifications automatisées (verbatim plan)

| Check | Résultat |
|-------|---------:|
| `test -f app/lightning-wallet.tsx + 3 modals` | ✓ (4/4) |
| `grep -c "CameraView" QrScannerOverlay` | 4 (≥ 1) ✓ |
| `grep -c "useCameraPermissions" QrScannerOverlay` | 2 (≥ 1) ✓ |
| `grep -c "Linking.openSettings" QrScannerOverlay` | 2 (≥ 1) ✓ |
| `grep -c 'presentationStyle="fullScreen"' QrScannerOverlay` | 2 (≥ 1) ✓ |
| `grep -c 'presentationStyle="pageSheet"' CashOutModal` | 1 (≥ 1) ✓ |
| `grep -c "authenticatePayOut" CashOutModal + PayoutQueueModal` | 2 + 2 (≥ 2) ✓ |
| `grep -c "disableDeviceFallback" CashOutModal` | 0 — utilise `allowDevicePasscode: __DEV__` (équivalent strict, biometric-gate.ts:46) |
| `grep -c "bypassBiometric" PayoutQueueModal + payout-executor` | 4 + 5 (≥ 2) ✓ |
| `grep -c "for (const item of" PayoutQueueModal` | 1 (≥ 1) ✓ |
| `grep -c "onPayoutSuccess" lightning-wallet + tree.tsx` | 4 + 5 (≥ 2) ✓ |
| `grep -c "AppState" lightning-wallet` | 2 (≥ 1) ✓ |
| `grep -c "clearAudit" lightning-wallet` | 6 (≥ 1) ✓ |
| `grep -c "HudLightningButton" tree.tsx` | 5 (≥ 2 import + render) ✓ |
| `grep -c "sats ⚡" tree.tsx` (toast wording) | 1 (≥ 1) ✓ |
| `grep -c "TriggerModeSelector + Pay-outs en attente" SettingsLightning` | 6 ✓ |
| `grep -c "handleOpenSpike\|handleOpenFamily" SettingsLightning` | **0** ✓ (retirés Pitfall #10) |
| `grep -c "lightning-spike\|lightning-family-spike" SettingsLightning` | **0** ✓ (liens retirés) |
| `grep -c "lightning-wallet" _layout.tsx` | 1 (≥ 1) ✓ |
| `grep -nE "#[0-9A-Fa-f]{3,8}|rgba?\(" 4 nouveaux fichiers` | **0** ✓ |

## Checkpoint device (statut)

**Statut : EN ATTENTE de validation humaine.**

La présente exécution s'arrête au `<task type="checkpoint:human-verify">` du PLAN. Le développeur doit tester sur iPhone physique avec LNbits BYO instance préparée et signaler `approved | issues: … | skip-cash-out | skip-qr-scan`.

### Checklist verbatim FR

```
☐ HUD ⚡ visible sur la ferme, pulse à la complétion d'une tâche
☐ Toast "+X sats à <member>" affiché après payout
☐ Tap HUD ⚡ ouvre /lightning-wallet, écran rendu OK
☐ Bouton Encaisser → FaceID prompt → balance refresh
☐ Scan QR depuis CashOutModal → CameraView ouvre, scan LN invoice fonctionne
☐ Settings → TriggerModeSelector switche entre 3 modes, persisté
☐ Settings → File d'attente offline montre les entries queued
☐ "Tout payer maintenant" flush la queue, toasts agrégés
☐ Aucun lien vers les spike screens dans Settings
```

Aucune case n'est cochée à ce stade — la validation est réservée au développeur sur device. **Je n'invente pas de résultats de tests sur device.**

### Pré-requis device (rappel)

- iPhone physique connecté (le simulateur ne supporte pas la caméra).
- `npx expo run:ios --device` exécuté pour intégrer nativement `expo-camera` + `@react-native-async-storage/async-storage` (Plan 01).
- Instance LNbits BYO accessible (`https://demo.lnbits.com` avec 2 wallets : family + member).
- FaceID enrolled sur le device.

## Open items déférés (Plan 04)

| Item | Pourquoi |
|------|----------|
| Suppression fichiers `app/lightning-spike.tsx` + `app/lightning-family-spike.tsx` | Plan 03b retire seulement les LIENS dans SettingsLightning (Pitfall #10) — les fichiers eux-mêmes nécessitent un nettoyage atomique avec types.ts et barrel cleanup |
| Suppression `lib/lightning/credentials.ts` (legacy single-wallet) | Plan 02 migration consomme encore ce module |
| Suppression exports legacy `loadLnbitsConfig / saveLnbitsConfig / clearLnbitsConfig` du barrel | Plan 02 migration consomme encore ces fonctions |
| REQ-6 audit `'undone'` (toggle dé-validation tâche payée) | Plan 04 — branchement dans `useVaultTasks` via `subscribeTaskUncomplete`. La protection anti-double-payout via `findPaidEntry` reste effective dès aujourd'hui. |
| Lock global anti race-condition cap (Pitfall #3 RESEARCH) | Plan 04 — sérialiseur cap dans listener. Aujourd'hui : check atomic + lock in-memory `inFlightLocks` (Plan 02). |
| Tests d'intégration screenshot visuel (snapshot / Maestro) | Hors scope Phase 53 MVP |

## Commits

```
9ba3470e feat(53-03b): paramètre bypassBiometric sur executePayout pour batch D-08
6d3c5aa2 feat(53-03b): QrScannerOverlay — scan QR fullScreen expo-camera
53b1cbc4 feat(53-03b): CashOutModal — encaissement bolt11 + paste + scan QR + FaceID
e5ca036d feat(53-03b): PayoutQueueModal — validation batch parent (D-08 + D-09)
cda642a7 feat(53-03b): écran /lightning-wallet — balance + audit + Encaisser
eb014ad0 feat(53-03b): route lightning-wallet déclarée dans _layout
fff93adf feat(53-03b): bouton HUD ⚡ + pulse + toast event-driven dans tree.tsx
5ce56a7f feat(53-03b): SettingsLightning — TriggerMode + dailyCap + queue, retirer liens spike
```

**Dernier hash : `5ce56a7f`** (HEAD `feat/lightning-farm`).

## Note pour le développeur

**Plan exécuté avec `/gsd-execute-phase 53` device + LNbits BYO instance prepared.** Le plan a bloqué sur `checkpoint:human-verify` en attente du resume-signal :

- `approved` → marquer Plan 03b complet, lancer Plan 04 cleanup final.
- `issues: [description]` → l'orchestrateur ré-exécute avec fix.
- `skip-cash-out` → valide sans tester l'encaissement (adminKey membre non configurée).
- `skip-qr-scan` → valide sans tester scan QR (paste bolt11 manuel suffisant).

**Plan 04 (cleanup final)** = suppression fichiers spike + barrel cleanup + REQ-6 'undone' audit entry deferred depuis Plan 02 + verifications `find/grep` zéro référence aux fichiers supprimés.

## Self-Check: PASSED

**Fichiers créés (vérification disque)** :

- `components/lightning/QrScannerOverlay.tsx` ✓ FOUND (239 lignes)
- `components/lightning/CashOutModal.tsx` ✓ FOUND (366 lignes)
- `components/lightning/PayoutQueueModal.tsx` ✓ FOUND (308 lignes)
- `app/lightning-wallet.tsx` ✓ FOUND (296 lignes)

**Fichiers modifiés (vérification git diff)** :

- `lib/lightning/payout-executor.ts` ✓ MODIFIED (+38 -19)
- `app/(tabs)/tree.tsx` ✓ MODIFIED (+75)
- `app/_layout.tsx` ✓ MODIFIED (+4)
- `components/settings/SettingsLightning.tsx` ✓ MODIFIED (+187 -52)

**Commits (vérification git log)** :

- `9ba3470e` (T1.0 bypassBiometric) ✓ FOUND
- `6d3c5aa2` (T1.1 QrScannerOverlay) ✓ FOUND
- `53b1cbc4` (T1.2 CashOutModal) ✓ FOUND
- `e5ca036d` (T1.3 PayoutQueueModal) ✓ FOUND
- `cda642a7` (T1.4 lightning-wallet écran) ✓ FOUND
- `eb014ad0` (T1.5 route _layout) ✓ FOUND
- `fff93adf` (T1.6 HUD tree.tsx) ✓ FOUND
- `5ce56a7f` (T1.7 SettingsLightning extension) ✓ FOUND

**TSC** : `npx tsc --noEmit` exit 0 ✓
**Hardcoded colors check** : 0 occurrence dans les 4 nouveaux fichiers ✓
**Spike links removed** : 0 référence `/lightning-spike` ou `/lightning-family-spike` dans SettingsLightning ✓
**Checkpoint device** : **EN ATTENTE** — aucune case cochée artificiellement.
