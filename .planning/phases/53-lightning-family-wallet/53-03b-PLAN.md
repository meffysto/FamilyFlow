---
phase: 53-lightning-family-wallet
plan: 03b
type: execute
wave: 4
depends_on: [53-03a]
files_modified:
  - app/lightning-wallet.tsx
  - app/(tabs)/tree.tsx
  - app/_layout.tsx
  - components/lightning/CashOutModal.tsx
  - components/lightning/PayoutQueueModal.tsx
  - components/lightning/QrScannerOverlay.tsx
  - components/settings/SettingsLightning.tsx
autonomous: false
requirements: [REQ-1, REQ-8, REQ-9, REQ-10, REQ-3, REQ-4, REQ-12]
requirements_addressed: [REQ-1, REQ-8, REQ-9, REQ-10, REQ-3, REQ-4, REQ-12]
tags: [lightning, ui, modal, qr-scanner, encaissement, settings, integration, checkpoint-device]

user_setup:
  - service: expo-camera-build
    why: "Plan 01 a ajouté expo-camera à package.json + Info.plist. Plan 03b utilise CameraView pour scan QR — requiert un rebuild dev-client natif."
    env_vars: []
    dashboard_config:
      - task: "AVANT exécution Plan 03b : exécuter `npx expo run:ios --device` pour rebuilder le dev-client avec expo-camera natively. Tester ensuite le scan QR sur device physique (le simulateur ne supporte pas la caméra). Préparer aussi une instance LNbits BYO (ex: `demo.lnbits.com` avec 2 wallets : family + member) pour tester le flow end-to-end."
        location: "Terminal local + iOS dev-client + LNbits dashboard"
  - service: gsd-execute-phase
    why: "Plan 03b est `autonomous: false` avec un checkpoint:human-verify gating. `/gsd-execute-phase 53` doit honorer les checkpoint gates : il s'arrête à `checkpoint:human-verify` en attendant le `resume-signal` (`approved` / `issues:` / `skip-cash-out` / `skip-qr-scan`)."
    env_vars: []
    dashboard_config:
      - task: "Run `/gsd-execute-phase 53` avec device iPhone connecté + LNbits BYO instance préparée. Le plan bloquera sur le checkpoint device en fin de tâches automatisées jusqu'à ce que tu réponde via resume-signal."
        location: "Terminal Claude Code + iOS device"

must_haves:
  truths:
    - "Un bouton ⚡ apparaît dans le HUD ferme UNIQUEMENT si `LIGHTNING_ENABLED === true` ET `activeProfile.id ∈ memberWallets` — D-01 + D-02 + REQ-8"
    - "Tap sur le bouton ⚡ navigue vers la route `/lightning-wallet` — D-03"
    - "Un pay-out reçu (foreground) déclenche : toast `+100 sats ⚡` (ToastSeal V2 avec subtitle = nomProfil) + pulse animation Reanimated 4 sur HudLightningButton.triggerPulse() + `Haptics.impactAsync(Light)` — D-04"
    - "L'écran `/lightning-wallet` affiche BalanceCard + timestamp + 10 dernières entrées audit log filtrées sur activeProfile + bouton 'Effacer l'historique' — REQ-8 + REQ-9"
    - "Balance refresh : (a) après chaque pay-out local émis par le listener (subscribe `onPayoutSuccess`), (b) sur AppState 'active' transition — D-05 (event-driven, pas de polling)"
    - "Le bouton 'Encaisser' est désactivé avec accessibilityHint 'Admin key requise pour encaisser' si `memberWallet.adminKey` absent — REQ-10"
    - "La modal Encaisser (pageSheet + drag-to-dismiss) propose paste bolt11 + scan QR + disclaimer warning + FaceID gate (`authenticatePayOut({ reason, disableDeviceFallback: !__DEV__ })`) avant payInvoice — REQ-9 + REQ-10 + SPEC #4"
    - "Le scan QR utilise `expo-camera` CameraView (`presentationStyle=fullScreen` au-dessus de la pageSheet, cf. Pitfall #7 stacking) avec permission demandée au mount du modal Encaisser, fallback Linking.openSettings() si refusée — Pitfall #6"
    - "Réglages → Labo → Lightning expose 3 options trigger mode (radio cards) + input dailyCap (number-pad, clamp 100-10000) — UI-SPEC Surface 6 + REQ-3 + REQ-4"
    - "Une entrée 'Pay-outs en attente (N)' apparaît dans SettingsLightning UNIQUEMENT si queue de validation (reason `'review'`) contient ≥ 1 item — D-06"
    - "AUCUNE notification locale 20h pour ouvrir la queue de validation — D-07 (decision NÉGATIVE : non-action explicite, à reconsidérer v2). Aucune planification expo-notifications scheduledAt 20:00 dans ce plan."
    - "Tap 'Pay-outs en attente' ouvre PayoutQueueModal (pageSheet) avec liste verticale items + bouton bas plein largeur 'Valider les N pay-outs (N×100 sats)' — D-08"
    - "Le batch validation gate FaceID UNE SEULE FOIS avant la boucle for…of payInvoice (D-08), items réussis sortent de la queue + audit 'paid', items échoués restent + attemptCount++ + audit 'queued' (D-09), toast résumé `X/Y pay-outs réussis · N en attente de retry`"
    - "Les 2 liens TouchableOpacity 'Ouvrir l'écran de test' vers `/lightning-spike` et `/lightning-family-spike` sont RETIRÉS de SettingsLightning.tsx (Plan 04 supprime les fichiers — Plan 03b retire les liens et handlers pour éviter crash navigation, Pitfall #10)"
    - "Toutes les couleurs proviennent de `useThemeColors()` (zéro `#FFFFFF` ou hex hardcoded) — CLAUDE.md conventions + UI-SPEC"
    - "Tous les libellés sont en français strict (jamais 'Bravo !', 'Récompense !') — UI-SPEC Copywriting Contract + CLAUDE.md"
    - "Animations Reanimated 4 uniquement (jamais RN Animated) — CLAUDE.md Animations"
    - "Modals = `presentationStyle=\"pageSheet\"` + drag-to-dismiss (SAUF QrScannerOverlay = `fullScreen` par convention caméra) — CLAUDE.md Conventions"
    - "`npx tsc --noEmit` clean + ferme/Auberge/widget non régressés"
    - "Checkpoint device approved (humain valide les flows 1-7 sur iPhone physique avec LNbits BYO)"
  artifacts:
    - path: "app/lightning-wallet.tsx"
      provides: "Écran hors tabs avec BalanceCard hero + audit list + Encaisser button + Effacer historique"
      contains: "export default function LightningWallet"
    - path: "app/(tabs)/tree.tsx"
      provides: "Bouton ⚡ HUD inséré après bouton 📷 screenshot ligne ~3524 ; subscribe onPayoutSuccess pour pulse + toast"
      contains: "HudLightningButton"
    - path: "components/lightning/PayoutQueueModal.tsx"
      provides: "Modal validation batch (pageSheet) + bouton bas + FaceID gate + boucle for…of"
      contains: "authenticatePayOut"
    - path: "components/lightning/CashOutModal.tsx"
      provides: "Modal encaissement bolt11 (pageSheet) + paste + scan QR + disclaimer + FaceID gate"
      contains: "expo-clipboard"
    - path: "components/lightning/QrScannerOverlay.tsx"
      provides: "Modal fullScreen avec CameraView + cadre 240×240 + bouton fermer + fallback permission refusée"
      contains: "CameraView"
    - path: "components/settings/SettingsLightning.tsx"
      provides: "Étendu : TriggerModeSelector + dailyCap input + entrée Pay-outs en attente conditionnelle ; liens spike RETIRÉS"
      contains: "TriggerModeSelector"
    - path: "app/_layout.tsx"
      provides: "Route `/lightning-wallet` non-tab référencée (hors tabs, comme `/impressions` Phase 51)"
      contains: "lightning-wallet"
  key_links:
    - from: "app/(tabs)/tree.tsx HudLightningButton"
      to: "/lightning-wallet (expo-router)"
      via: "router.push('/lightning-wallet')"
      pattern: "router\\.push\\(['\"]/(lightning-wallet)"
    - from: "app/(tabs)/tree.tsx"
      to: "lib/lightning/lightning-events.ts (onPayoutSuccess)"
      via: "useEffect subscribe → triggerPulse + showToast + setNeedsBalanceRefresh"
      pattern: "onPayoutSuccess"
    - from: "app/lightning-wallet.tsx"
      to: "lib/lightning (loadAudit, loadFamilyConfig, LnbitsClient)"
      via: "useEffect mount + AppState 'active' + onPayoutSuccess"
      pattern: "loadAudit|getWallet"
    - from: "components/lightning/PayoutQueueModal.tsx"
      to: "lib/lightning (loadQueue, executePayout, removeFromQueue, incrementAttempt, authenticatePayOut)"
      via: "FaceID gate puis for…of executePayout"
      pattern: "authenticatePayOut.*for.*executePayout"
    - from: "components/lightning/CashOutModal.tsx"
      to: "LnbitsClient.payInvoice"
      via: "FaceID gate puis client.payInvoice(bolt11, member.adminKey)"
      pattern: "payInvoice"
    - from: "components/lightning/QrScannerOverlay.tsx"
      to: "CashOutModal.tsx (paste bolt11 dans textarea)"
      via: "onScan(data: string)"
      pattern: "onScan"
    - from: "components/settings/SettingsLightning.tsx"
      to: "PayoutQueueModal.tsx"
      via: "TouchableOpacity 'Pay-outs en attente (N)' → setShowQueueModal(true)"
      pattern: "PayoutQueueModal"
---

<objective>
Brancher les 5 composants visuels Lightning (Plan 03a) dans l'application — créer les 3 modals (CashOutModal, PayoutQueueModal, QrScannerOverlay), l'écran route `/lightning-wallet`, étendre `app/(tabs)/tree.tsx` (insertion HUD + listener pulse+toast), étendre `components/settings/SettingsLightning.tsx` (TriggerModeSelector + dailyCap + queue entry, retirer liens spike), déclarer la route dans `app/_layout.tsx`. Cette wave a un checkpoint humain en fin de plan pour valider le rendu visuel + flows interactifs sur device (FaceID, scan QR, batch validation).

Purpose: Rendre la cagnotte VISIBLE et MANIPULABLE pour le membre (balance, audit, encaisser) et CONFIGURABLE pour le parent (trigger mode, cap, validation batch). Strict respect de UI-SPEC (FontSize.display 24px pour balance, ToastSeal V2 pour toast pay-out, Pulse Reanimated 4 600ms, palette useThemeColors, FR strict, format JJ/MM/AAAA, pageSheet + drag-to-dismiss). Pitfall #6 (caméra permission au mount) + Pitfall #7 (stacking pageSheets iOS) explicitement gérés.

Output: 3 nouveaux modals `components/lightning/{QrScannerOverlay, CashOutModal, PayoutQueueModal}.tsx` + 1 écran `app/lightning-wallet.tsx` + extension `tree.tsx` (insertion HUD + listener pulse+toast) + extension `SettingsLightning.tsx` (3 sections : trigger mode, dailyCap, queue entry — liens spike retirés) + route layout `app/_layout.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-lightning-family-wallet/53-SPEC.md
@.planning/phases/53-lightning-family-wallet/53-CONTEXT.md
@.planning/phases/53-lightning-family-wallet/53-UI-SPEC.md
@.planning/phases/53-lightning-family-wallet/53-RESEARCH.md
@.planning/phases/53-lightning-family-wallet/53-PATTERNS.md
@.planning/phases/53-lightning-family-wallet/53-02-SUMMARY.md
@.planning/phases/53-lightning-family-wallet/53-03a-SUMMARY.md
@CLAUDE.md
@lib/lightning/index.ts
@lib/lightning/lnbits-client.ts
@lib/lightning/biometric-gate.ts
@app/(tabs)/tree.tsx
@app/impressions.tsx
@app/_layout.tsx
@components/settings/SettingsLightning.tsx
@components/ui/ModalHeader.tsx
@components/lightning/HudLightningButton.tsx
@components/lightning/BalanceCard.tsx
@components/lightning/AuditLogItem.tsx
@components/lightning/PayoutQueueItem.tsx
@components/lightning/TriggerModeSelector.tsx
@contexts/ToastContext.tsx
@contexts/ThemeContext.tsx

<interfaces>
<!-- API consommées (Plan 01-02-03a) + à produire ici. -->

Depuis lib/lightning (déjà exportés Plans 01-02) :
```typescript
import {
  isLightningEnabled, setLightningEnabled,
  loadFamilyConfig, saveFamilyConfig,
  loadAudit, appendAudit, clearAudit, type AuditEntry, type AuditStatus,
  loadQueue, removeFromQueue, incrementAttempt, type PayoutQueueItem as PayoutQueueItemData,
  executePayout,
  onPayoutSuccess, onPayoutFailed,
  type FamilyLightningConfig, type MemberWalletMapping,
  LnbitsClient,
} from '../../lib/lightning';
import { authenticatePayOut } from '../../lib/lightning/biometric-gate';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useToast } from '../../contexts/ToastContext';
import { useThemeColors } from '../../contexts/ThemeContext';
```

Composants visuels Plan 03a (consommés ici verbatim) :
```typescript
import { HudLightningButton, type HudLightningButtonRef } from '../../components/lightning/HudLightningButton';
import { BalanceCard } from '../../components/lightning/BalanceCard';
import { AuditLogItem } from '../../components/lightning/AuditLogItem';
import { PayoutQueueItem } from '../../components/lightning/PayoutQueueItem';
import { TriggerModeSelector } from '../../components/lightning/TriggerModeSelector';
```

Toast signature exacte (contexts/ToastContext.tsx:55-58) :
```typescript
showToast(
  message: string,
  type?: 'success' | 'error' | 'info',
  action?: ToastAction,
  options?: { icon?: string; subtitle?: string },
): void;
```
ToastSeal V2 trigger : passer `icon + subtitle` simultanément → render ToastSeal style.

PayoutQueueModal batch flow (D-08 + D-09) :
```typescript
async function handleValidateBatch() {
  setLoading(true);
  const auth = await authenticatePayOut({ reason: 'Valider les pay-outs Lightning', disableDeviceFallback: !__DEV__ });
  if (!auth.success) { setLoading(false); showToast('Validation annulée', 'info'); return; }

  let paid = 0, remaining = 0;
  const config = await loadFamilyConfig();
  if (!config) { setLoading(false); showToast('Configuration manquante', 'error'); return; }

  // Snapshot queue au début (D-09 : 1→N-1 sortent, N→fin restent en cas d'échec mid-batch)
  const items = await loadQueue();
  const reviewItems = items.filter(i => i.reason === 'review');
  for (const item of reviewItems) {
    const wallet = config.members.find(m => m.profileId === item.profileId);
    const profile = profiles.find(p => p.id === item.profileId);
    if (!wallet || !profile) {
      await removeFromQueue(item.taskId, item.profileId);
      continue;
    }
    try {
      await executePayout({
        task: { id: item.taskId, text: '(validation batch)', completed: true, mentions: [] } as any,
        recipient: { profileId: item.profileId, profile, wallet },
        config,
        source: 'flush-review',
      });
      await removeFromQueue(item.taskId, item.profileId);
      paid++;
    } catch (err) {
      await incrementAttempt(item.taskId, item.profileId, String(err));
      remaining++;
    }
  }
  setLoading(false);
  const total = reviewItems.length;
  if (paid === total) showToast(`${paid} pay-outs validés · ${paid*100} sats envoyés`, 'success');
  else if (paid === 0) showToast('Aucun pay-out n\'a abouti — tous en attente', 'error');
  else showToast(`${paid}/${total} pay-outs réussis · ${remaining} en attente de retry`, 'info');
  onClose();
}
```

**Note D-08 / SPEC #4 interaction** : `executePayout` (Plan 02) inclut maintenant un FaceID gate per pay-out. Dans le batch, ce gate sera bypassé par un état "batch authenticated" propagé via le `source: 'flush-review'` (Plan 02 doit détecter ce source et SKIPPER le FaceID interne car le batch a déjà gate UNE FOIS au début per D-08 — `executePayout` accepte explicitement ce paramètre et bypass le gate pour `source === 'flush-review'`). En `flush-offline`, chaque item déclenche son propre FaceID (l'utilisateur n'a pas pré-authentifié). En `listener` (instant), chaque pay-out déclenche son propre FaceID.

**Implication Plan 02** : `executePayout` doit accepter un paramètre `bypassBiometric?: boolean` (default false). Le caller Batch (Plan 03b PayoutQueueModal) passe `bypassBiometric: true` après son propre FaceID. Tous les autres callers (listener, flush-offline) passent `false` / undefined → le gate s'applique.

CashOutModal flow (REQ-9 + REQ-10 + SPEC #4) :
```typescript
async function handleConfirm() {
  if (!bolt11 || !member.adminKey) return;
  setLoading(true);
  const auth = await authenticatePayOut({ reason: "Confirmer l'encaissement Lightning", disableDeviceFallback: !__DEV__ });
  if (!auth.success) { setLoading(false); return; }
  try {
    const client = new LnbitsClient({ baseUrl: config.baseUrl, invoiceKey: '' /* unused for payInvoice */ });
    const result = await client.payInvoice(bolt11, member.adminKey);
    await appendAudit({ ts: new Date().toISOString(), profileId: member.profileId, taskId: '(cash_out)', sats: 0, status: 'cash_out', paymentHash: result.paymentHash });
    showToast('Encaissement effectué', 'success');
    onSuccess();
  } catch (err: any) {
    showToast(`Échec de l'encaissement : ${err.message ?? 'inconnu'}`, 'error');
  } finally {
    setLoading(false);
  }
}
```

QrScannerOverlay pattern (RESEARCH Example C + Pitfall #6) — voir Plan 03 original block, adapté.

Stacking Pitfall #7 — modal QR rendue PAR-DESSUS modal Encaisser via Modal natif présenté en fullScreen.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1 : 3 modals + écran route + extension tree.tsx HUD + extension SettingsLightning + route layout</name>
  <read_first>
    - .planning/phases/53-lightning-family-wallet/53-UI-SPEC.md (sections Surface 3, 4, 5, 6, Copywriting Contract)
    - .planning/phases/53-lightning-family-wallet/53-RESEARCH.md (Pitfall #6 caméra permission, Pitfall #7 stacking pageSheets, Pitfall #10 cleanup ordre)
    - .planning/phases/53-lightning-family-wallet/53-PATTERNS.md (sections app/lightning-wallet.tsx, CashOutModal, PayoutQueueModal, SettingsLightning)
    - .planning/phases/53-lightning-family-wallet/53-03a-SUMMARY.md (API des composants Plan 03a)
    - app/impressions.tsx (pattern écran hors tabs, loadManifeste pattern, RefreshControl)
    - app/(tabs)/tree.tsx lignes 3470-3526 (HUD layout) + lignes 3508-3524 (pattern bouton)
    - app/_layout.tsx (route registration pattern hors tabs)
    - components/settings/SettingsLightning.tsx lignes 157-307 (handlers existants + TouchableOpacity à retirer)
    - components/ui/ModalHeader.tsx (signature)
    - contexts/ToastContext.tsx (showToast signature)
    - lib/lightning/lnbits-client.ts (méthodes getWallet pour balance, payInvoice)
    - **lib/lightning/payout-executor.ts** (Plan 02 — vérifier signature `executePayout` qui doit accepter `bypassBiometric?: boolean`. Si pas encore implémenté, ce plan ajoute le paramètre.)
  </read_first>
  <behavior>
    - **QrScannerOverlay** : permission demandée au mount, overlay fullScreen avec CameraView + cadre 240×240, bouton close, fallback permission refusée → Linking.openSettings()
    - **CashOutModal** : pageSheet drag-to-dismiss, textarea bolt11, bouton Coller (Clipboard.getStringAsync), bouton Scanner QR (ouvre QrScannerOverlay en fullScreen STACK au-dessus, Pitfall #7), disclaimer warning, FaceID gate (`disableDeviceFallback: !__DEV__`), payInvoice avec member.adminKey
    - **PayoutQueueModal** : pageSheet, liste PayoutQueueItem, bouton bas plein largeur "Valider les N pay-outs (N×100 sats)", FaceID UNE FOIS (D-08 — propagation `bypassBiometric: true` aux executePayout suivants), boucle for…of, toast résumé (3 cas D-09)
    - **app/lightning-wallet.tsx** : route hors tabs, header back + titre "Ma cagnotte", BalanceCard hero, liste 10 dernières AuditLogItem filtrées sur activeProfile, bouton "Effacer l'historique" centré bas. Subscribe `onPayoutSuccess` pour refresh balance. AppState 'active' → refresh balance.
    - **SettingsLightning** : ajout TriggerModeSelector + dailyCap input + SettingsRow conditionnel "Pay-outs en attente (N)". 2 liens spike RETIRÉS (handlers + TouchableOpacity).
    - **tree.tsx** : bouton HUD inséré après 📷, conditionnel `LIGHTNING_ENABLED && memberWallets[activeProfile.id]`. Subscribe onPayoutSuccess → triggerPulse + showToast ToastSeal V2.
    - **_layout.tsx** : déclarer `<Stack.Screen name="lightning-wallet" ... />`.
  </behavior>
  <action>
    1. **components/lightning/QrScannerOverlay.tsx** — Implémenter selon RESEARCH Example C + Pitfall #6. Imports `expo-camera` (`CameraView`, `useCameraPermissions`), `expo-linking`, `expo-haptics`. Demander permission au mount via `useEffect([permission])`. 3 états : `null` (loading initial) → return null ; `!granted && !canAskAgain` (ou refus initial) → fallback UI permission refusée (texte FR + bouton `Linking.openSettings()` + bouton Fermer) ; `granted` → `<CameraView style={{flex:1}} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={...}>` avec overlay cadre 240×240 centré (View absolu) + bouton close ✕ en haut à droite (44×44 Radius.full bg colors.overlay). `onBarcodeScanned` : `if (scanned) return; setScanned(true); Haptics.notificationAsync(Success); onScan(data);`. Props `{ onScan: (bolt11: string) => void; onClose: () => void }`.

    2. **components/lightning/CashOutModal.tsx** — pageSheet + drag-to-dismiss. Props `{ visible: boolean; member: MemberWalletMapping; config: FamilyLightningConfig; onClose: () => void; onSuccess: () => void }`. ModalHeader "Encaisser vers wallet externe" + close. KeyboardAvoidingView. TextInput multiline 4 lignes pour bolt11 (colors.inputBg/Border, FontSize.sm, placeholder "lnbc1...", autoCapitalize="none"). Bouton "Coller depuis le presse-papiers" (icon Clipboard 16px, variante secondaire) → `Clipboard.getStringAsync().then(setBolt11)`. Bouton "Scanner un QR code" (icon Camera 16px, variante secondaire) → `setShowQrScanner(true)`. Disclaimer card bg colors.warningBg + bordure colors.warning + icon AlertTriangle + texte "La transaction Lightning est définitive. Vérifiez l'invoice avant de confirmer." Bouton Confirmer (primaire, disabled si !bolt11) → handleConfirm() verbatim de `<interfaces>` avec `disableDeviceFallback: !__DEV__`. Modal QrScannerOverlay rendu PAR-DESSUS avec `presentationStyle="fullScreen"` (stacking Pitfall #7 — pas dismiss+present). `onScan` : `setBolt11(data); setShowQrScanner(false);`.

    3. **components/lightning/PayoutQueueModal.tsx** — pageSheet drag-to-dismiss. Props `{ visible: boolean; profiles: Profile[]; onClose: () => void }`. ModalHeader "Pay-outs en attente". Au mount : `loadQueue().then(q => setQueue(q.filter(i => i.reason === 'review')))`. FlatList ou ScrollView (gap Spacing.md) de PayoutQueueItem (composant Plan 03a). Bouton bas plein largeur (52pt FontSize.subtitle semibold bg primary) "Valider les N pay-outs (N×100 sats)" → handleValidateBatch() verbatim de `<interfaces>`. État loading : ActivityIndicator inline dans le bouton. **Note importante** : appeler `executePayout({ ..., source: 'flush-review', bypassBiometric: true })` pour TOUS les items du batch (D-08 — 1 seul FaceID au lancement du batch). Le paramètre `bypassBiometric` doit être ajouté à la signature `executePayout` (Plan 02 — si pas déjà fait, ce plan corrige Plan 02 ou ajoute le paramètre dans la même PR). Après batch : `onClose()` + toast déjà émis dans handleValidateBatch.

    4. **Vérification / extension Plan 02 `executePayout`** : Si la signature de `executePayout` ne contient pas encore `bypassBiometric?: boolean`, AJOUTER ce paramètre maintenant dans `lib/lightning/payout-executor.ts`. Comportement : si `bypassBiometric === true`, SKIPPER l'appel `authenticatePayOut` (le caller a déjà gate). Sinon (default), exécuter le gate per SPEC #4. Mettre à jour aussi `lib/lightning/__tests__/process-task-completion.test.ts` Cas 14 + ajouter un cas Cas 16 : `bypassBiometric: true` → PAS d'appel `authenticatePayOut` (verifié via mock spy).

    5. **app/lightning-wallet.tsx** — Imports : useState/useEffect/useCallback, AppState, Stack, useRouter, useVault, useThemeColors, useToast, LnbitsClient, loadFamilyConfig, loadAudit, clearAudit, onPayoutSuccess, BalanceCard (Plan 03a), AuditLogItem (Plan 03a), CashOutModal. Au mount : (a) `loadFamilyConfig()` → set config, find member matching activeProfile.id ; (b) `refreshBalance()` = appeler `new LnbitsClient({baseUrl, invoiceKey: member.invoiceKey}).getWallet()` → setBalance(walletInfo.balanceSats) + setLastUpdatedAt(new Date()) ; (c) `loadAudit()` → filter sur profileId === activeProfile.id, slice(-10), setAudit. useEffect onPayoutSuccess : refresh balance + reload audit. AppState listener : 'active' → refresh balance. Render : SafeAreaView + header back + ScrollView avec BalanceCard (hero) + Section "Historique" + liste AuditLogItem + bouton "Effacer l'historique" (Alert.alert confirmation → `clearAudit()` + setAudit([])). canCashOut = !!member?.adminKey. onCashOut → setShowCashOutModal(true). Modal CashOutModal en bas avec props member + config.

    6. **components/settings/SettingsLightning.tsx** — Étendre l'existant (NE PAS réécrire complètement). Ajouter (a) au-dessus ou en dessous de la card config existante : `<SectionHeader title="Déclenchement des pay-outs" icon={<Clock size={16} color={primary} />} />` + `<TriggerModeSelector value={triggerMode} onChange={setTriggerMode} />`. Persister le changement : `useEffect([triggerMode]) → saveFamilyConfig({...currentConfig, triggerMode})`. (b) Sous-section "Plafond quotidien (sats)" : label + sous-label "Par défaut 1000. Plage : 100–10 000." + TextInput keyboardType="number-pad" + clamp 100-10000 + persist via saveFamilyConfig. (c) SettingsRow conditionnel "Pay-outs en attente (N)" : monter compteur via `loadQueue().then(q => setPendingCount(q.filter(i=>i.reason==='review').length))` au mount + après chaque navigation focus. Si pendingCount > 0 : render SettingsRow icon Clock title "Pay-outs en attente" subtitle "{N} pay-out{N>1?'s':''} à valider · {N*100} sats" onPress → setShowQueueModal(true). PayoutQueueModal au bas de SettingsLightning. (d) **CLEANUP** : RETIRER `handleOpenSpike` (lignes ~157-159) et `handleOpenFamily` (lignes ~161-163), RETIRER le bloc `{enabled && (<>{savedConfigured && (<TouchableOpacity ... />)}<TouchableOpacity ... /></>)}` (lignes ~268-307) — Pitfall #10. (NE PAS supprimer les fichiers spike — Plan 04).

    7. **app/(tabs)/tree.tsx** — Insertion bouton HUD ligne ~3525 (juste après bouton 📷 ligne 3524). Imports en haut : `import { HudLightningButton, type HudLightningButtonRef } from '../../components/lightning/HudLightningButton';` + `import { isLightningEnabled, loadFamilyConfig, onPayoutSuccess } from '../../lib/lightning';` + `import { useToast } from '../../contexts/ToastContext';`. État : `const [lightningVisible, setLightningVisible] = useState(false);` + `const [memberWallet, setMemberWallet] = useState<MemberWalletMapping | null>(null);` + `const hudLightningRef = useRef<HudLightningButtonRef>(null);` + `const { showToast } = useToast();`. useEffect au mount + à chaque changement `activeProfile?.id` : `Promise.all([isLightningEnabled(), loadFamilyConfig()]).then(([flag, config]) => { if (!flag || !config) { setLightningVisible(false); return; } const m = config.members.find(m => m.profileId === activeProfile.id); setMemberWallet(m ?? null); setLightningVisible(!!m); });`. useEffect onPayoutSuccess subscribe : `const unsub = onPayoutSuccess((e) => { hudLightningRef.current?.triggerPulse(); showToast('+100 sats ⚡', 'success', undefined, { icon: '⚡', subtitle: e.profileName }); }); return unsub;`. Render conditionnel : `{lightningVisible && <HudLightningButton ref={hudLightningRef} onPress={() => router.push('/lightning-wallet')} />}` inséré après bouton 📷.

    8. **app/_layout.tsx** — Ajouter `<Stack.Screen name="lightning-wallet" options={{ headerShown: false, presentation: 'card' }} />` dans le Stack racine (hors tabs), à côté des autres routes hors tabs comme `impressions`.

    9. **Type check** : `npx tsc --noEmit` doit être clean (hors pré-existants). Le scan QR ne PEUT PAS être testé en simulateur — checkpoint device requis (sous-tâche checkpoint suivante).
  </action>
  <verify>
    <automated>test -f app/lightning-wallet.tsx && test -f components/lightning/QrScannerOverlay.tsx && test -f components/lightning/CashOutModal.tsx && test -f components/lightning/PayoutQueueModal.tsx</automated>
    <automated>grep -c "CameraView" components/lightning/QrScannerOverlay.tsx # >= 1</automated>
    <automated>grep -c "useCameraPermissions" components/lightning/QrScannerOverlay.tsx # >= 1</automated>
    <automated>grep -c "Linking.openSettings" components/lightning/QrScannerOverlay.tsx # >= 1 (Pitfall #6)</automated>
    <automated>grep -c "presentationStyle=\"fullScreen\"" components/lightning/CashOutModal.tsx # >= 1 (stacking Pitfall #7)</automated>
    <automated>grep -c "presentationStyle=\"pageSheet\"" components/lightning/CashOutModal.tsx # >= 1 (modal Encaisser elle-même)</automated>
    <automated>grep -c "authenticatePayOut" components/lightning/CashOutModal.tsx # >= 1 (FaceID gate)</automated>
    <automated>grep -c "disableDeviceFallback" components/lightning/CashOutModal.tsx # >= 1 (SPEC #4 strict)</automated>
    <automated>grep -c "authenticatePayOut" components/lightning/PayoutQueueModal.tsx # >= 1 (D-08 FaceID 1×)</automated>
    <automated>grep -c "bypassBiometric" components/lightning/PayoutQueueModal.tsx # >= 1 (D-08 propagation au batch executePayout)</automated>
    <automated>grep -c "for (const item of" components/lightning/PayoutQueueModal.tsx # >= 1 (for…of batch D-08)</automated>
    <automated>grep -c "bypassBiometric" lib/lightning/payout-executor.ts # >= 1 (param ajouté)</automated>
    <automated>grep -c "onPayoutSuccess" app/lightning-wallet.tsx # >= 1 (refresh balance D-05)</automated>
    <automated>grep -c "AppState" app/lightning-wallet.tsx # >= 1 (D-05)</automated>
    <automated>grep -c "clearAudit" app/lightning-wallet.tsx # >= 1 (Effacer historique REQ-7)</automated>
    <automated>grep -c "HudLightningButton" app/\(tabs\)/tree.tsx # >= 2 (import + render)</automated>
    <automated>grep -c "onPayoutSuccess" app/\(tabs\)/tree.tsx # >= 1 (pulse + toast D-04)</automated>
    <automated>grep -c "100 sats" app/\(tabs\)/tree.tsx # >= 1 (toast D-04)</automated>
    <automated>grep -c "TriggerModeSelector" components/settings/SettingsLightning.tsx # >= 1</automated>
    <automated>grep -c "Pay-outs en attente" components/settings/SettingsLightning.tsx # >= 1 (D-06)</automated>
    <automated>grep -c "handleOpenSpike\|handleOpenFamily" components/settings/SettingsLightning.tsx # == 0 (handlers retirés Pitfall #10)</automated>
    <automated>grep -c "lightning-spike\|lightning-family-spike" components/settings/SettingsLightning.tsx # == 0 (liens retirés)</automated>
    <automated>grep -c "lightning-wallet" app/_layout.tsx # >= 1 (route déclarée)</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -E "(app/lightning-wallet|app/_layout|components/lightning|components/settings/SettingsLightning|app/\(tabs\)/tree|lib/lightning/payout-executor)" | grep -v "MemoryEditor\|cooklang\|useVault.ts" | wc -l # == 0</automated>
  </verify>
  <done>
    Écran `/lightning-wallet` opérationnel avec BalanceCard hero + audit list + Encaisser. Modals (Cash-out + Queue validation) implémentés avec FaceID gate (`disableDeviceFallback: !__DEV__`), scan QR (Pitfall #6+7 traités), stacking iOS géré, paramètre `bypassBiometric` propagé pour D-08. SettingsLightning étendu avec trigger mode + dailyCap + queue entry ; liens spike retirés. Bouton HUD ⚡ inséré dans tree.tsx avec pulse + toast event-driven. Route lightning-wallet déclarée dans _layout. TSC clean.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint device : valider rendu visuel + flows interactifs sur iPhone physique</name>
  <what-built>
    - Bouton ⚡ HUD dans la ferme (conditionnel flag + wallet)
    - Écran `/lightning-wallet` (balance + audit + Encaisser)
    - Modal Encaisser (bolt11 + paste + scan QR + FaceID)
    - Modal Pay-outs en attente (batch FaceID + boucle for…of avec bypassBiometric propagé)
    - SettingsLightning étendu (trigger mode + dailyCap + queue entry)
    - Toast "+100 sats ⚡" + pulse animation sur le bouton HUD au pay-out reçu
    - FaceID per pay-out instant (SPEC Constraint #4)
  </what-built>
  <how-to-verify>
    **Pré-requis device :**
    - iPhone physique connecté (le simulateur ne supporte pas la caméra)
    - `npx expo run:ios --device` exécuté APRÈS Plan 01 (expo-camera + AsyncStorage natively linked)
    - Instance LNbits BYO accessible (ex : `https://demo.lnbits.com` avec 2 wallets créés manuellement : 1 famille + 1 membre)
    - FaceID enrolled sur le device

    **Setup config (Settings → Labo → Lightning) :**
    1. Activer `LIGHTNING_ENABLED` toggle
    2. Renseigner baseUrl, family.invoiceKey, family.adminKey
    3. Ajouter 1 membre : profileId = `<id du profil actif>` (ex: 'lucas'), displayName "Lucas", invoiceKey du wallet membre, adminKey OPTIONNEL pour tester l'encaissement
    4. Choisir trigger mode "Instantané"
    5. dailyCap = 1000

    **Flow 1 : Pay-out instant + FaceID + toast + pulse (SPEC #4)**
    1. Aller à la ferme (tree)
    2. **Vérifier** : bouton ⚡ apparait dans le HUD à côté de 📷 (même style, même taille — 40×40, borderWidth 2, palette farm)
    3. Créer une tâche `@lucas brosse les dents`
    4. Cocher la tâche
    5. **Vérifier** : prompt FaceID natif iOS apparaît AVANT le pay-out (reason "Pay-out Lightning automatique → Lucas") — SPEC #4 obligation
    6. Confirmer FaceID
    7. **Vérifier** : toast `+100 sats ⚡` apparaît en haut avec subtitle "Lucas" (ToastSeal style chaleureux)
    8. **Vérifier** : le bouton ⚡ pulse (scale 1→1.2→1 ~600ms)
    9. **Vérifier** : Haptics léger ressenti
    10. **Test FaceID refusé** : cocher une autre tâche `@lucas X`, refuser FaceID au prompt → **Vérifier** : audit log contient entrée `failed` avec error `auth_cancelled` ; PAS de pay-out réseau

    **Flow 2 : Écran wallet**
    1. Taper le bouton ⚡ → écran `/lightning-wallet` s'ouvre
    2. **Vérifier** : header "Ma cagnotte" + back button
    3. **Vérifier** : balance affichée en sats (FontSize.display 24px) + timestamp "Mis à jour il y a 0 min"
    4. **Vérifier** : historique liste l'entrée `paid` 100 sats "Lucas · JJ/MM/AAAA" + chip vert "Reçu"
    5. **Vérifier** : si `member.adminKey` configurée → bouton "Encaisser vers wallet externe" actif ; sinon disabled + accessibilityHint "Admin key requise pour encaisser"

    **Flow 3 : Encaissement (si adminKey configurée)**
    1. Taper "Encaisser vers wallet externe"
    2. **Vérifier** : modal pageSheet glisse depuis le bas, drag-to-dismiss OK
    3. **Vérifier** : disclaimer warning visible (texte FR factuel)
    4. Coller un bolt11 valide (depuis un autre wallet)
    5. **Alternative** : taper "Scanner un QR code" → modal fullScreen s'ouvre PAR-DESSUS la pageSheet (Pitfall #7) → cadre 240×240 + bouton close → scanner un QR → modal se ferme + bolt11 collé automatiquement dans le textarea
    6. Taper "Confirmer l'encaissement"
    7. **Vérifier** : prompt FaceID natif iOS apparaît avec reason "Confirmer l'encaissement Lightning"
    8. Confirmer FaceID
    9. **Vérifier** : toast "Encaissement effectué" + balance décrémentée + audit entry `cash_out` (chip "Encaissé" vert)

    **Flow 4 : Validation batch parent (mode daily-review, D-08 — 1 FaceID seul)**
    1. Settings → Labo → Lightning → changer trigger mode en "Validation parentale"
    2. Cocher 3 tâches @lucas
    3. **Vérifier** : aucun pay-out instantané (pas de toast, pas de pulse, AUCUN prompt FaceID)
    4. Settings → Labo → Lightning → **Vérifier** : "Pay-outs en attente (3)" apparait avec icône Clock
    5. Taper l'entrée → modal pageSheet PayoutQueueModal s'ouvre
    6. **Vérifier** : 3 items listés avec avatar + prénom + "100 sats" + titre tâche + JJ/MM
    7. **Vérifier** : bouton bas "Valider les 3 pay-outs (300 sats)"
    8. Taper → **Vérifier** : prompt FaceID UNE SEULE FOIS (D-08 — `bypassBiometric: true` propagé aux 3 executePayout suivants)
    9. Confirmer FaceID
    10. **Vérifier** : boucle exécute les 3 pay-outs séquentiellement (chargement bouton)
    11. **Vérifier** : toast résumé "3 pay-outs validés · 300 sats envoyés" + modal se ferme + entrée "Pay-outs en attente" disparaît

    **Flow 5 : Plafond + notif parent (D-10)**
    1. Settings → Labo → Lightning → dailyCap = 200
    2. Cocher 3 tâches @lucas (mode instant) — accepter FaceID 2 fois (les 2 premiers pay-outs)
    3. **Vérifier** : 2 pay-outs réussis (200 sats cumul), le 3ᵉ → audit `capped` SANS prompt FaceID (le cap check est avant le pay-out, donc avant le gate)
    4. **Vérifier** : si heure locale 16h-9h (hors heures école), notif iOS reçue "Lumière Lightning · 2 pay-outs validés, plafond atteint pour Lucas"
    5. Si heure 9h-16h : silencieuse (D-10) — vérifier le timestamp `lightning_last_parent_notif_v1` n'est pas mis à jour

    **Flow 6 : Non-régression**
    1. Désactiver `LIGHTNING_ENABLED`
    2. **Vérifier** : bouton ⚡ disparaît du HUD ferme
    3. Cocher une tâche → **Vérifier** : aucun appel réseau Lightning, aucun toast, aucun pulse, AUCUN prompt FaceID
    4. Vérifier Auberge : un visiteur arrive comme avant (Phase 46 préservée)
    5. Vérifier widget : compteur tâches du jour fonctionne (Phase 40 préservée)
    6. Vérifier gamification : XP gagné à la complétion de tâche (gamification préservée)

    **Flow 7 : Cleanup SettingsLightning**
    1. Settings → Labo → Lightning
    2. **Vérifier** : aucun bouton "Ouvrir l'écran de test (1 wallet)" / "Mode famille (multi-wallet)" — ils ont été retirés
    3. **Vérifier** : la section Lightning contient bien : toggle ENABLED, form config family, TriggerModeSelector, dailyCap input, (et entrée "Pay-outs en attente (N)" si queue non vide)
    4. Tap "Enregistrer" sur le form de config → **vérifier** : pas de crash, pas d'alert "fichier introuvable"
  </how-to-verify>
  <resume-signal>
    Réponds :
    - "approved" si tous les flows fonctionnent comme attendu
    - "issues: [description]" si tu vois des problèmes (animations cassées, FaceID skip, scan QR ne fonctionne pas, balance désync, FaceID prompt manquant sur instant, etc.)
    - "skip-cash-out" si tu n'as pas configuré adminKey membre et que tu valides sans tester l'encaissement
    - "skip-qr-scan" si pas de QR de test sous la main (paste bolt11 manuel suffisant pour valider la modal)
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI tree.tsx → /lightning-wallet | Navigation côté client uniquement, gate flag+wallet. |
| CashOutModal → LNbits payInvoice | Sortie réseau sensible (membre→externe). FaceID gate obligatoire avec `disableDeviceFallback: !__DEV__` (REQ-9 + SPEC #4). |
| PayoutQueueModal → executePayout (boucle) | FaceID gate UNIQUE (D-08), `bypassBiometric: true` propagé aux executePayout suivants pour éviter les prompts répétés. Consentement explicite parent pour N pay-outs simultanés. |
| CameraView → bolt11 string | Entrée non-sollicitée (QR scanné depuis monde extérieur). Pas de exec côté client, juste setBolt11 → LNbits valide. |
| Clipboard → bolt11 textarea | Entrée non-sollicitée. Idem CameraView : LNbits valide en payInvoice. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-03b-01 | Spoofing | bolt11 entrée (paste OU scan QR) | mitigate | LnbitsClient.payInvoice retourne une LnbitsError 4xx si invoice invalide → toast erreur visible. UI-SPEC disclaimer "La transaction Lightning est définitive. Vérifiez l'invoice avant de confirmer." rappelle à l'utilisateur de vérifier. Pas de décodage bolt11 côté client en MVP (RESEARCH Q3 RESOLVED, v2). |
| T-53-03b-02 | Tampering | Pay-out vers attaquant via QR malicieux | mitigate | FaceID gate obligatoire avant payInvoice (REQ-9 + SPEC #4). UI-SPEC disclaimer prominent. Si user FaceID-confirme un bolt11 attaquant, c'est un risque utilisateur résiduel acceptable pour un MVP en Labo. v2 : décodage bolt11 pour afficher montant pré-FaceID. |
| T-53-03b-03 | Repudiation | Encaissement non audité | mitigate | appendAudit `status:'cash_out'` avec paymentHash AVANT toast success. Trace immuable. |
| T-53-03b-04 | Information Disclosure | adminKey affichée en clair | mitigate | TextInput admin key (existant SettingsLightning) : déjà `secureTextEntry={true}` côté input. Plan 03b ne touche PAS cette UI — vérifier qu'aucune modif accidentelle l'expose. Jamais loggé. |
| T-53-03b-05 | Information Disclosure | Audit log visible pour profil non-concerné | mitigate | app/lightning-wallet.tsx filter `audit.filter(e => e.profileId === activeProfile.id)`. Un parent qui regarde l'audit Lucas ne verra que les transactions de Lucas (pas celles d'Emma). |
| T-53-03b-06 | Denial of Service | Permission caméra refusée bloque encaissement | mitigate | Fallback paste bolt11 toujours disponible. Linking.openSettings() proposé. Pitfall #6. |
| T-53-03b-07 | Denial of Service | Stacking pageSheets bug iOS | mitigate | QrScannerOverlay présenté en `presentationStyle="fullScreen"` PAR-DESSUS la pageSheet Encaisser, pas dismiss+present. Pitfall #7. |
| T-53-03b-08 | Elevation of Privilege | FaceID bypass `__DEV__` | mitigate | `authenticatePayOut` avec `disableDeviceFallback: !__DEV__` → strict en prod (FaceID/TouchID exclusivement, pas de PIN fallback). Build release (TestFlight) testera FaceID réel obligatoire. Bypass dev documenté. Pitfall #5. |
| T-53-03b-09 | Tampering | Bouton "Effacer l'historique" altère traces | accept | Le user a le contrôle de son propre audit local (qui est une copie ; les payments sont sur la blockchain LN). `clearAudit` ne supprime PAS les paiements LNbits ; il vide juste la copie locale. Documenté. |
| T-53-03b-10 | Information Disclosure | Toast "+100 sats" visible en public | accept | Le toast disparaît en 2500ms et contient uniquement `+100 sats ⚡` + prénom. Pas d'info financière sensible. Acceptable. |
| T-53-03b-11 | Spoofing | Mauvais membre destinataire (profileId mismatch) | mitigate | resolveRecipient (Plan 01) + check `config.members.find(m.profileId === activeProfile.id)` côté tree.tsx (gate visibility). Le bouton ⚡ n'apparaît que si activeProfile a un wallet. |
| T-53-03b-12 | Elevation of Privilege | bypassBiometric utilisé hors batch | mitigate | `bypassBiometric: true` est UNIQUEMENT passé depuis PayoutQueueModal (qui FaceID 1× avant le for…of). Tests Jest Plan 02 cas 16 vérifient le bypass propre. Le listener instant + flushOfflineQueue ne passent JAMAIS bypassBiometric (default false). |

**Block-on severity:** high. Aucun risque high non mitigé. T-53-03b-02 (QR malicieux) reste un risque résiduel utilisateur — mitigation MVP = FaceID + disclaimer. v2 = décodage bolt11. T-53-03b-09 (effacer historique) accepté car audit local = copie informationnelle.
</threat_model>

<verification>
- 3 modals + 1 écran route + 4 fichiers étendus (tree.tsx, SettingsLightning.tsx, _layout.tsx, optionnellement payout-executor.ts pour bypassBiometric)
- `app/_layout.tsx` déclare la route `lightning-wallet`
- `app/(tabs)/tree.tsx` contient `HudLightningButton`, subscribe `onPayoutSuccess`, `showToast` avec wording exact "+100 sats ⚡"
- `components/settings/SettingsLightning.tsx` contient `TriggerModeSelector`, dailyCap input, "Pay-outs en attente" entry conditionnelle
- 2 handlers `handleOpenSpike` et `handleOpenFamily` SUPPRIMÉS de SettingsLightning (Pitfall #10)
- Aucun `lightning-spike` ou `lightning-family-spike` référencé dans SettingsLightning
- FaceID gate présent dans CashOutModal (encaissement) ET PayoutQueueModal (batch validation D-08) avec `disableDeviceFallback: !__DEV__`
- `bypassBiometric` propagé depuis PayoutQueueModal vers executePayout (D-08 — 1 FaceID seul)
- Boucle `for…of` séquentielle dans PayoutQueueModal (D-08 + D-09)
- CameraView + useCameraPermissions + Linking.openSettings fallback (Pitfall #6)
- Stacking fullScreen pour QrScannerOverlay au-dessus du pageSheet CashOutModal (Pitfall #7)
- AppState 'active' listener dans `app/lightning-wallet.tsx` pour refresh balance (D-05)
- `onPayoutSuccess` subscribe dans `app/(tabs)/tree.tsx` pour pulse + toast + dans `app/lightning-wallet.tsx` pour refresh balance
- `npx tsc --noEmit` clean (hors pré-existants)
- Aucune couleur hardcoded dans `components/lightning/*.tsx` (grep `#[0-9A-Fa-f]{3,6}|rgba?\(` retourne 0 ligne non-commentaire)
- Checkpoint device approved par le développeur (resume-signal "approved" ou "skip-cash-out/skip-qr-scan" justifié)
</verification>

<success_criteria>
- Le bouton ⚡ HUD apparaît dans la ferme conditionnellement et navigue vers `/lightning-wallet`
- L'écran `/lightning-wallet` affiche balance + audit + Encaisser/Effacer
- La modal Encaisser permet paste + scan QR + FaceID (`disableDeviceFallback: !__DEV__`) + payInvoice
- La modal Pay-outs en attente exécute la boucle batch avec FaceID unique (D-08 + bypassBiometric propagé) et gère les échecs mid-batch (D-09)
- SettingsLightning expose les 3 trigger modes + dailyCap + entry queue conditionnelle
- Les 2 liens vers playgrounds spike sont retirés (cleanup partiel — fichiers supprimés Plan 04)
- Toast "+100 sats ⚡" et pulse animation déclenchés event-driven (D-04)
- Balance refresh event-driven uniquement (D-05) : pay-out + AppState 'active' (pas de polling)
- Wording FR strict UI-SPEC (jamais "Bravo !", format JJ/MM/AAAA)
- Toutes les couleurs via useThemeColors() (zéro hardcoded)
- Animations Reanimated 4 uniquement
- Modals pageSheet + drag-to-dismiss (sauf QR scanner = fullScreen)
- FaceID gate par opération sensible (avec bypassBiometric uniquement pour batch D-08)
- `npx tsc --noEmit` clean
- Checkpoint device validé
</success_criteria>

<output>
After completion, create `.planning/phases/53-lightning-family-wallet/53-03b-SUMMARY.md` listing :
- 3 modals + 1 écran + extensions tree.tsx/_layout.tsx/SettingsLightning.tsx/payout-executor.ts (bypassBiometric)
- Statut checkpoint device : approved | issues found | skip-cash-out | skip-qr-scan
- Liste des bugs trouvés lors du checkpoint device et leur résolution
- Note pour le développeur : **Plan exécuté avec `/gsd-execute-phase 53` device + LNbits BYO instance prepared** ; le plan a bloqué sur checkpoint:human-verify jusqu'à resume-signal.
- Note pour le développeur : Plan 04 = cleanup final (suppression fichiers spike + barrel cleanup + `find/grep` verification + REQ-6 'undone' audit entry deferred depuis Plan 02)
</output>
