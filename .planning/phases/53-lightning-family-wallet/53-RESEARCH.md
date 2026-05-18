# Phase 53: Lightning Family Wallet — Research

**Researched:** 2026-05-18
**Domain:** Lightning Network REST integration + offline queue + biometric gate + audit log + feature flag UX (React Native / Expo SDK 54)
**Confidence:** HIGH (codebase est exhaustivement lu ; libs vérifiées ; spike code dispo localement)

## Summary

La Phase 53 promeut 4 spikes Lightning déjà sur la branche `feat/lightning-farm` en feature de production-grade derrière `LIGHTNING_ENABLED` et la section Labo. Le SPEC est verrouillé (ambiguity 0.16) avec 12 requirements et 17 acceptance criteria, et la CONTEXT lock 10 décisions UX (D-01 … D-10) plus 7 zones de discrétion confiées au planner. Le module `lib/lightning/` existe déjà (client REST LNbits validé spike 001, biometric-gate, family-credentials SecureStore, feature-flag avec cache mémoire) — la phase ajoute la **boucle de pay-out attachée à `subscribeTaskComplete`**, la **queue offline**, l'**audit log 90 jours glissants**, l'**écran `/lightning-wallet`**, le **bouton HUD ⚡ + pulse + toast**, la **migration single→family**, et le **cleanup des playgrounds** + le **renommage `Child*` → `Member*`**.

Quatre tensions techniques à arbitrer côté planner : (a) granularité de la persistance SecureStore vs la **limite réelle ~2 KB / clé** côté iOS (un audit 90 j × 4 membres × 3 entrées/j ≈ 1 080 entrées dépassera très probablement la limite ; partitionnement mensuel ou clé par profil-mois recommandé) ; (b) absence d'`@react-native-community/netinfo` dans `package.json` aujourd'hui — le SPEC #5 réclame un **reachability listener**, soit on ajoute la dépendance (Expo SDK 54 ships NetInfo, autolinking OK) soit on se rabat sur `AppState 'active'` + retry par timer ; (c) absence d'`expo-camera` dans `package.json` — le SPEC #9 réclame un **scan QR** : la phase doit installer `expo-camera` (recommandation Expo SDK 52+ : abandonner `expo-barcode-scanner` au profit du scanner intégré à `CameraView`) ; (d) **idempotence multi-toggle** — le LNbits POST `/api/v1/payments` n'a pas de dédoublonnage natif, le client doit injecter une clé d'idempotence (taskId+completedDate) côté audit + lock in-memory avant chaque pay-out.

**Primary recommendation:** Plan en 4 plans sériels — **(1) Module pur Lightning étendu** (types `MemberWalletMapping`, audit-log, queue, daily-cap, resolveRecipient avec tests Jest ; PAS de UI), **(2) Listener + intégration `useVault.ts`** (3ᵉ subscriber pattern Phase 40/46, migration single→family au boot, mode 3-way trigger), **(3) UI Lightning** (bouton HUD ⚡ tree.tsx, écran `/lightning-wallet`, modal validation batch, modal encaissement out + scan QR, SettingsLightning étendu), **(4) Cleanup + renommage atomique** (suppression playgrounds, `credentials.ts` single, `Child*`→`Member*` codemod). Le sequencing 1→2→3→4 isole les tests Jest avant UI (le moteur doit être stable), et garantit que le cleanup final ne se fait qu'une fois tout le reste fonctionnel.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Placement = bouton tappable ⚡ dans le HUD top de `app/(tabs)/tree.tsx` (zone ligne ~3508-3525), à côté de 📖 codex et 📷 screenshot. Même style `styles.hudCodexButton`, même emoji-only treatment (pas de balance affichée dans le HUD).
- **D-02** Visibilité conditionnelle : le bouton n'apparaît QUE si `LIGHTNING_ENABLED === true` ET `activeProfile.id ∈ memberWallets`. Pas de bouton mort, pas de modal éducative.
- **D-03** Tap → navigation vers `/lightning-wallet`. Pas de balance inline dans le HUD.
- **D-04** Feedback pay-out reçu (foreground) = toast `+100 sats ⚡` (style ToastSeal `showToast(msg,'success',undefined,{icon:'⚡',subtitle:nomProfil})`) + pulse animation sur le bouton HUD (scale 1→1.2→1 via withSpring spring={damping:10,stiffness:180}, ~600 ms) + `Haptics.impactAsync('Light')`.
- **D-05** Refresh balance = event-driven (pas de polling). Refresh dans 2 cas : (a) immédiatement après chaque pay-out local validé, (b) sur `AppState` transition vers `'active'`.
- **D-06** Accès à l'écran « Pay-outs en attente » = Réglages → Labo → Lightning. Bouton conditionnel visible si queue de validation ≥ 1.
- **D-07** Pas de notif locale 20h pour ouvrir la queue (le parent va dans Settings quand il a un moment).
- **D-08** Validation = batch tout-en-un avec 1 FaceID. Liste verticale + bouton bas pleine largeur « Valider les N pay-outs (N×100 sats) » → 1 prompt FaceID → boucle interne `for…of` `payInvoice` séquentielle. Pas de validation par item, pas de sélection partielle.
- **D-09** Échec mid-batch = transparent per item. Items 1→N-1 payés sortent de la queue (audit `paid`), items N→fin restent (audit `queued`, `attemptCount++`). Toast résumé `X/Y pay-outs réussis · N en attente de retry`. Retry auto au prochain foreground app + reachability change.
- **D-10** Notifs locales parent = `expo-notifications` + agrégation max 1/jour. Une seule notif/jour qui regroupe les événements (« Lumière Lightning · 2 pay-outs validés, plafond atteint pour Lucas · 1 en attente »). **Silencieuse pendant 9 h–16 h** (heures école). Timestamp dernière notif stocké dans SecureStore pour le cap 1/jour.

### Claude's Discretion

- **Architecture du listener Lightning** : implémenter comme un 3ᵉ `subscribeTaskComplete` dans `hooks/useVault.ts` (pattern Phase 40 widget ligne 795-807, Phase 46 Auberge ligne 837-845) OU comme un hook domaine dédié `hooks/useVaultLightning.ts`. **Préférence faible pour le pattern subscribe direct** (moindre divergence avec l'existant). Planner tranche selon analyse du couplage.
- **Structure SecureStore queue + audit log** : 2 clés distinctes (`lightning_payout_queue_v1`, `lightning_audit_v1`) ou 1 clé consolidée. Tester la limite SecureStore iOS (~2 KB par item) avec 90 j × 4 membres × ~3 entrées/jour = ~1 080 entrées audit. Si dépassement, partitionner par mois ou compresser.
- **Mutex / lock concurrent** : deux toggles rapides simultanés ne doivent pas double-trigger un pay-out (idempotence par `taskId+date`, SPEC #6). Planner décide entre lock in-memory simple (Promise queue) vs vérif idempotence atomique avant chaque pay-out.
- **Renommage `Child*` → `Member*`** : codemod atomique en 1 commit (rename + update tous les imports). Conservation backward-compat lecture du JSON SecureStore : le parser `loadFamilyConfig` accepte `children: [...]` ET `members: [...]` à la lecture, mais écrit toujours `members: [...]`. Migration silencieuse au prochain `saveFamilyConfig`.
- **Cleanup playgrounds** : suppression `app/lightning-spike.tsx`, `app/lightning-family-spike.tsx`, `lib/lightning/credentials.ts` en un seul commit final de la phase (après que tout le reste fonctionne). Retirer aussi les 2 liens « Ouvrir l'écran de test » dans `SettingsLightning.tsx`.
- **Migration single→family au boot** : exécutée dans un effect bootstrap dans `VaultProvider` (ou `AuthProvider` — planner décide), silencieuse. Idempotente : si déjà migré, no-op. Log `__DEV__` only.
- **Scan QR pour encaissement out** : réutiliser `expo-camera` (à installer — voir `## Environment Availability`). Modal plein écran avec cadre de scan, fallback paste bolt11 textarea.
- **i18n FR strict** : tous les libellés, toasts, alerts, notifs en français. Suivre les conventions CLAUDE.md.

### Deferred Ideas (OUT OF SCOPE)

- Notif locale 20h pour ouvrir la queue de validation — non retenue (D-07). Reconsidérer v2.
- Badge numérique sur app icon iOS — non retenu. Possible v2.
- Validation par item (swipe / checkboxes) — non retenue pour MVP. À ajouter v2 si feedback.
- LNURL-withdraw (pull-style encaissement) — version 2 ; paste bolt11 + scan QR couvre le MVP.
- Provisioning automatique des sub-wallets via LNbits User Manager API — rejeté en spike 004 (requiert super-admin instance).
- Push notifications cross-device pour les pay-outs — les notifs locales suffisent.
- Conversion fiat (€/$/sats) — affichage sats uniquement (spike 003 App Store posture).
- Multi-instance LNbits (1 famille = N instances) — 1 instance unique partagée.
- Édition des `xpOverride` sats personnalisés par tâche (ex: « cette tâche vaut 500 sats ») — v2.
- Conversion de la « feuille » de la ferme en sats — design séparé.
- Promotion de la feature en dehors de Labo — décision App Store explicite requise.
- Merge vers `main` — branche `feat/lightning-farm` reste isolée tant que la posture App Store n'est pas validée juridiquement.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-1 | Trigger pay-out sur completion de tâche | `subscribeTaskComplete` (hooks/useVaultTasks.ts:54,76-125,331) ; pattern Phase 40 ligne 795-807, Phase 46 ligne 837-845 ; `LnbitsClient.payInvoice(bolt11, adminKey)` lib/lightning/lnbits-client.ts:157 |
| REQ-2 | Attribution destinataire (mentions → activeProfile fallback) | `Task.mentions: string[]` (lib/types.ts:17) extrait par `@user` ; fonction pure `resolveRecipient` à créer + 6 unit tests Jest |
| REQ-3 | 3 modes trigger (instant / daily-review / hybrid) | Étendre `FamilyLightningConfig` (lib/lightning/types.ts:71) avec `triggerMode: 'instant'\|'daily-review'\|'hybrid'`, default `'instant'` |
| REQ-4 | Plafond quotidien par membre (default 1000, 100–10000) | `FamilyLightningConfig.dailyCapPerMember: number` ; calcul cumul depuis audit log (timezone locale, reset 00:00) ; check atomic in-process avant network call |
| REQ-5 | Queue offline + retry (cap 5 tentatives) | SecureStore JSON sous `lightning_payout_queue_v1` ; retry sur foreground (AppState) + reachability change (voir Environment Availability — NetInfo) |
| REQ-6 | Pas de rollback + idempotence par `taskId+date` | LNbits API n'a PAS de dédoublonnage natif (cf. payment_api.py) ; idempotence côté client : check audit log avant chaque pay-out ; statut `'already_paid_today'` |
| REQ-7 | Audit log SecureStore glissant 90 jours | Tableau JSON sous `lightning_audit_v1` ; entrée `{ts, profileId, taskId, sats, status, paymentHash?, error?}` ; purge > 90 j au boot et à chaque write ; bouton « Effacer » |
| REQ-8 | Carte cagnotte ferme conditionnelle activeProfile | Insertion HUD tree.tsx:3508-3525 ; condition `LIGHTNING_ENABLED && memberWallets[activeProfileId]` ; pulse animation D-04 |
| REQ-9 | Écran `/lightning-wallet` + encaissement out | Route expo-router `app/lightning-wallet.tsx` ; balance + 10 dernières entrées audit ; bouton encaisser → modal paste bolt11 + scan QR (expo-camera à installer) |
| REQ-10 | Admin key par sub-wallet membre (optionnelle, gated FaceID) | Étendre `MemberWalletMapping` avec `adminKey?: string` ; FaceID via `authenticatePayOut()` lib/lightning/biometric-gate.ts:30 (réutilisable tel quel) ; bouton encaisser désactivé sans admin key |
| REQ-11 | Migration auto single → family au boot | `loadLnbitsConfig` + `saveFamilyConfig` + `clearLnbitsConfig` — effect bootstrap `VaultProvider`, idempotent ; remplir `family.invoiceKey` + `baseUrl`, `family.adminKey` vide à compléter manuellement |
| REQ-12 | Cleanup playgrounds + renommage `Child*` → `Member*` | Supprimer `app/lightning-spike.tsx` (449 lignes), `app/lightning-family-spike.tsx` (751 lignes), `lib/lightning/credentials.ts` (50 lignes) ; rename type + tous les imports en 1 commit ; mettre à jour barrel `lib/lightning/index.ts` |

## Project Constraints (from CLAUDE.md)

| Directive | Source | Application Phase 53 |
|-----------|--------|---------------------|
| Langue UI/commits/commentaires = français | CLAUDE.md Conventions | Toasts, alerts, notifs, libellés UI, messages de commit, JSDoc en FR. Pas de wording promotionnel ("Bravo !", "Tu as gagné !"). |
| `useThemeColors()` obligatoire, jamais de hardcoded | CLAUDE.md Conventions | Bouton HUD ⚡, carte balance, chips audit, modals — tous via `colors.*` / `primary`. Aucun `#FFFFFF` etc. dans la phase. |
| `react-native-reanimated` ~4.1 obligatoire (pas RN Animated) | CLAUDE.md Stack | Pulse animation HUD via `useSharedValue` + `useAnimatedStyle` + `withSpring`. Spring config en constante module. Pas de `perspective` dans transform. |
| `expo-haptics` pour feedback tactile | CLAUDE.md Animations | `Haptics.impactAsync(Light)` sur pulse D-04, `Haptics.notificationAsync(Success)` sur scan QR réussi, `Haptics.selectionAsync()` sur tap HUD. |
| `console.warn`/`console.error` sous `if (__DEV__)` uniquement | CLAUDE.md Patterns | Tout log Lightning encadré par `__DEV__`. Patterns déjà respectés dans le module lib/lightning. |
| Errors non-critiques silencieuses | CLAUDE.md Patterns | `catch { /* Lightning — non-critical, vault domain unaffected */ }` — la ferme ne doit JAMAIS être impactée par une erreur Lightning. |
| Modals = `presentationStyle="pageSheet"` + drag-to-dismiss | CLAUDE.md Conventions | Modal validation batch + modal encaissement out + modal scan QR (sauf scan QR qui est plein écran par convention caméra). |
| Format date affiché JJ/MM/AAAA | CLAUDE.md Conventions | Timestamps dans audit log liste, items liste validation, etc. |
| Tokens design `Spacing['2xl']` pas `16` | CLAUDE.md Patterns | Toutes les valeurs numériques via `Spacing.*`, `Radius.*`, `FontSize.*`, `Shadows.*`. UI-SPEC déjà conforme. |
| `React.memo()` list items, `useCallback()` handlers en props | CLAUDE.md Patterns | Items audit log + items liste validation batch en `React.memo`. Handlers via `useCallback`. |
| `npx tsc --noEmit` clean avant commit | CLAUDE.md Testing | Gate obligatoire après chaque commit Phase 53 (SPEC Constraint). |
| Pas de noms personnels réels dans docs/commits | CLAUDE.md Conventions | Utiliser Lucas/Emma/Dupont dans tous les exemples docs Phase 53. |
| SecureStore uniquement, JAMAIS vault Markdown | SPEC Constraint | Creds, queue, audit log — tous en SecureStore. Pas de fichier `.md` Lightning dans le vault. |
| Branche `feat/lightning-farm` isolée, pas de merge main | SPEC Constraint + Spike 003 | Tout le code Phase 53 reste sur cette branche. Aucun commit vers main. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pay-out execution (LNbits REST) | API client (lib/lightning/) | — | Communication réseau pure vers l'instance LNbits BYO ; isolée du domaine vault et UI. |
| Idempotence + audit log + queue | Local persistence (SecureStore) | API client | Garantie par construction côté client — l'API LNbits n'a pas de dédoublonnage natif. |
| Trigger sur completion tâche | Domain hook (`useVault.ts` listener) | API client | Couplage event-driven via `subscribeTaskComplete` pattern Phase 40/46 ; consommateur du domaine tâches. |
| Attribution destinataire (resolveRecipient) | Pure function (lib/lightning/) | Domain types (lib/types.ts) | Fonction pure testable Jest ; lit `Task.mentions` + `Profile[]` + `memberWallets`. |
| FaceID gate | OS interop (expo-local-authentication) | UI trigger | Per-action gate `authenticatePayOut()` ; pas de session cache (sécurité). |
| Feature flag + Settings UI | UI (components/settings/) | Local persistence (SecureStore) | Toggle Labo + form config + entrée "Pay-outs en attente" — point unique de configuration. |
| Bouton HUD ⚡ + carte cagnotte | UI (app/(tabs)/tree.tsx) | Domain hook (active profile + memberWallets) | Affordance ferme conditionnelle ; pulse animation Reanimated 4. |
| Écran `/lightning-wallet` | UI (app/lightning-wallet.tsx) | API client (balance refresh) + Local persistence (audit log filter) | Vue détail balance + historique + encaissement out — route expo-router hors tabs. |
| Modal validation batch | UI (modal pageSheet) | Domain hook (queue iterator) + API client (payInvoice loop) | UI orchestrateur de la boucle batch FaceID-gated. |
| Notif parent agrégée | OS interop (expo-notifications) | Aggregator (1/jour, silencieuse 9-16h) | Canal système existant ; agrégation côté client. |
| Scan QR bolt11 | OS interop (expo-camera) | UI modal plein écran | À installer (pas dans `package.json` actuel). CameraView + barcodeScannerSettings={types:['qr']}. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-secure-store` | ~15.0.8 | Creds LNbits + flag + queue + audit log | Déjà installé, déjà utilisé par module Lightning ; chiffrement système iOS Keychain |
| `expo-local-authentication` | ~17.0.8 | FaceID/TouchID gate avant chaque pay-out | Déjà installé, déjà wrappé par `authenticatePayOut()` lib/lightning/biometric-gate.ts |
| `expo-notifications` | ~0.32.17 | Notif parent agrégée 1/jour (D-10) | Déjà installé, déjà utilisé pour scheduled-notifications.ts (RDV, tâches, Auberge) |
| `expo-haptics` | ~15.0.8 | Feedback tactile (pulse D-04, scan QR, batch) | Déjà installé, convention CLAUDE.md |
| `expo-clipboard` | ~8.0.8 | Paste bolt11 depuis presse-papiers | Déjà installé (Phase 50 QR audio) |
| `react-native-reanimated` | ~4.1.1 | Pulse animation HUD bouton ⚡ | Déjà installé, obligatoire CLAUDE.md (pas RN Animated) |
| `lucide-react-native` | ^1.11.0 | Icônes Zap/Bitcoin/Clock/CheckCircle2/AlertTriangle/Camera/Clipboard (UI-SPEC) | Déjà installé |
| `expo-router` | ~6.0.23 | Route `/lightning-wallet` hors tabs | Déjà installé |

[VERIFIED: package.json /Users/gabrielwaltio/Documents/family-vault/package.json]

### Supporting — À ajouter

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-camera` | ~17.0.x (Expo SDK 54) | Scanner QR bolt11 | REQ-9 encaissement out ; CONTEXT prétend qu'elle est installée pour OCR recettes, mais elle n'est **pas dans package.json** [VERIFIED: grep package.json]. Installation : `npx expo install expo-camera`. Add Info.plist `NSCameraUsageDescription`. [CITED: docs.expo.dev/versions/latest/sdk/camera/] |
| `@react-native-community/netinfo` | ^11.x | Reachability listener pour retry queue | REQ-5 ; Expo SDK 54 ships avec NetInfo via autolinking [CITED: docs.expo.dev/versions/latest/sdk/netinfo/]. **Pas installé aujourd'hui** [VERIFIED: grep package.json]. Si planner refuse une nouvelle dépendance : fallback `AppState 'active'` listener + retry périodique limité (déjà couvre 80 % des cas — réseau revient typiquement quand l'utilisateur revient sur l'app). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-camera` (nouvelle dep) | Saisie manuelle bolt11 + paste clipboard uniquement (skip scan QR) | -1 dépendance npm, -1 permission iOS — mais SPEC #9 acceptance criterion réclame le scan QR. Si planner refuse : descope D-09 vers v2 et **mettre à jour SPEC.md**. |
| `@react-native-community/netinfo` | `AppState 'active'` seul (sans reachability) | -1 dépendance, mais l'utilisateur en mode avion qui ouvre l'app, retire mode avion, et reste sur l'app sans backgrounding ne déclencherait jamais le retry. Acceptable pour MVP, dégrade UX edge case. |
| Audit log SecureStore JSON unique | Partitionnement par mois (`lightning_audit_2026-05_v1`) | +complexité parsing/cleanup, mais survit à la limite 2KB iOS (cf. Pitfall #1). Recommandé si > ~150 entrées attendues. |
| Lock in-memory (Promise queue) pour idempotence | Vérif atomique audit log avant chaque pay-out | Lock in-memory ne survit pas au reload app ; check audit log est plus robuste mais 1 read SecureStore extra. Combinaison des deux = ceinture+bretelles, recommandé. |
| `react-native-bolt11` (décodage invoice) | Pas de décodage côté client (LNbits valide) | Décodage côté client permettrait afficher le montant à l'utilisateur AVANT FaceID. Non bloquant pour MVP — LNbits renvoie une erreur lisible si invalide. Reporter v2. |

**Installation:**
```bash
npx expo install expo-camera
# Optionnel (si reachability listener retenu) :
npx expo install @react-native-community/netinfo
```

**Version verification:** Vérifié contre `package.json` actuel (/Users/gabrielwaltio/Documents/family-vault/package.json). Aucune des deps listées n'a besoin d'upgrade — toutes alignées Expo SDK 54 (~54.0.34). `expo-camera` non présent doit être ajouté via `npx expo install` qui pickera la version compatible SDK 54.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     USER ACTIONS (UI tier)                                │
│  Toggle task ✓     /lightning-wallet     Settings → Labo Lightning        │
└────────────┬──────────────────┬──────────────────┬─────────────────────────┘
             │                  │                  │
             ▼                  ▼                  ▼
┌────────────────────┐  ┌───────────────┐  ┌────────────────────┐
│  useVaultTasks     │  │ /lightning-   │  │ SettingsLightning   │
│  toggleTask()      │  │   wallet      │  │  - config           │
│  fires             │  │  - balance    │  │  - trigger mode     │
│  subscribeTask     │  │  - audit list │  │  - dailyCap         │
│  Complete listeners│  │  - encaisser  │  │  - "Pay-outs en     │
└────────┬───────────┘  └───────┬───────┘  │     attente (N)"    │
         │                      │           └──────┬──────────────┘
         │ (transition false→true)                 │
         ▼                                         ▼
┌────────────────────────────────────────────────────────────┐
│  Lightning Listener (3ᵉ subscriber dans useVault.ts)        │
│  processTaskCompletionForLightning(task, deps)              │
│   1. isLightningEnabled() ? sinon skip                       │
│   2. resolveRecipient(task, profiles, memberWallets,        │
│      activeProfileId)                                        │
│   3. Check audit log idempotence (taskId+date)              │
│   4. Check dailyCap (cumul from audit)                       │
│   5. Dispatch selon triggerMode :                            │
│      - instant   → executePayOut()                           │
│      - daily-review → enqueueForReview()                    │
│      - hybrid → cumul < 100 ? instant : enqueue             │
└────────┬──────────────────────┬──────────────────────────────┘
         │ instant              │ daily-review
         ▼                      ▼
┌────────────────────┐    ┌──────────────────────┐
│ executePayOut()    │    │  Queue validation    │
│ - lock in-memory   │    │  (SecureStore)       │
│ - createInvoice    │    │  Visible Settings →  │
│   (child invoice   │    │   Labo Lightning →   │
│   key)             │    │   "Pay-outs en       │
│ - payInvoice       │    │    attente (N)"      │
│   (family admin    │    │                      │
│   key) gated       │    │  → Modal validation  │
│ - audit 'paid'     │    │    batch (1 FaceID)  │
│   OR 'failed'      │    │  → boucle for…of     │
│ - if network err:  │    │    payInvoice        │
│   enqueue offline  │    └──────────────────────┘
└────────┬───────────┘
         │ success
         ▼
┌────────────────────────────────────────┐
│  Toast "+100 sats ⚡" + Pulse HUD ⚡    │
│  (event listener côté tree.tsx via     │
│   subscription ou Context)             │
└────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Offline retry orchestrateur                                │
│  - AppState 'active' → flush queue                          │
│  - NetInfo reachability change → flush queue                │
│  - Cap 5 tentatives → status 'failed' + notif parent        │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  SecureStore Layer (clés v1)                                │
│  - lightning_family_config_v1   (creds + triggerMode + cap) │
│  - lightning_enabled_v1         (flag)                      │
│  - lightning_payout_queue_v1    (queue offline + daily-review) │
│  - lightning_audit_v1           (90j glissants, purge auto) │
│  - lightning_last_parent_notif_v1 (cap 1 notif/jour)        │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  LNbits REST API (BYO instance — pas de backend FamilyFlow) │
│  POST /api/v1/payments {out:false, amount, unit, memo,      │
│                          extra:{taskId,date}}                │
│  POST /api/v1/payments {out:true, bolt11}                   │
│  GET  /api/v1/wallet                                         │
│  Auth : X-Api-Key (invoice OR admin selon endpoint)         │
└────────────────────────────────────────────────────────────┘
```

[VERIFIED: lib/lightning/lnbits-client.ts ; hooks/useVaultTasks.ts ; hooks/useVault.ts:795-845]

### Recommended Project Structure

```
lib/lightning/                        (étendu, déjà existant)
├── index.ts                          # Barrel — exposer nouveaux exports
├── types.ts                          # Étendre : MemberWalletMapping (rename), triggerMode, dailyCap
├── lnbits-client.ts                  # Réutilisé tel quel (REQ-1 + REQ-9)
├── biometric-gate.ts                 # Réutilisé tel quel (REQ-8 + REQ-9)
├── feature-flag.ts                   # Réutilisé tel quel (constraint feature flag)
├── family-credentials.ts             # Étendu : champs triggerMode/dailyCap, backward-compat read children→members
├── credentials.ts                    # ❌ À SUPPRIMER (REQ-12)
├── resolve-recipient.ts              # ✨ NEW — fonction pure REQ-2 + tests Jest
├── audit-log.ts                      # ✨ NEW — REQ-7 (load/append/purge/clear) SecureStore
├── payout-queue.ts                   # ✨ NEW — REQ-5 (enqueue/flush/retry) SecureStore
├── daily-cap.ts                      # ✨ NEW — REQ-4 (cumul depuis audit, check atomic)
├── parent-notif.ts                   # ✨ NEW — REQ-D-10 (agrégation 1/jour, silencieuse 9-16h)
├── migration.ts                      # ✨ NEW — REQ-11 single→family bootstrap
├── trigger-mode.ts                   # ✨ NEW — REQ-3 dispatch instant/daily-review/hybrid
├── lightning-events.ts               # ✨ NEW — bus d'événements local (payout-success → toast/pulse UI)
└── __tests__/                        # ✨ NEW — Jest tests pour les modules purs
    ├── resolve-recipient.test.ts
    ├── audit-log.test.ts
    ├── daily-cap.test.ts
    ├── trigger-mode.test.ts
    ├── payout-queue.test.ts
    └── migration.test.ts

app/
├── lightning-wallet.tsx              # ✨ NEW — REQ-8 + REQ-9 + REQ-D-04 (route hors tabs)
├── lightning-spike.tsx               # ❌ À SUPPRIMER (REQ-12)
└── lightning-family-spike.tsx        # ❌ À SUPPRIMER (REQ-12)

app/(tabs)/tree.tsx                   # Étendu : insertion bouton HUD ⚡ ligne ~3524 + listener pulse

components/settings/SettingsLightning.tsx  # Étendu : trigger mode + dailyCap + "Pay-outs en attente" + nettoyage liens spike

components/lightning/                 # ✨ NEW (composants UI dédiés)
├── PayoutQueueModal.tsx              # Modal batch validation (D-08, D-09)
├── CashOutModal.tsx                  # Modal encaissement out + scan QR (REQ-9, REQ-10)
├── QrScannerOverlay.tsx              # Modal plein écran scan QR bolt11
├── BalanceCard.tsx                   # Hero balance /lightning-wallet
├── AuditLogItem.tsx                  # Item liste audit (memoïsé) avec icône statut + chip
└── HudLightningButton.tsx            # Bouton HUD ⚡ extractable + pulse animation
```

[ASSUMED: structure recommandée — planner peut consolider components/lightning/* dans /app/lightning-wallet.tsx si plus pratique]

### Pattern 1: 3ᵉ subscriber Lightning dans useVault.ts

**What:** Souscription event-driven à `tasksHook.subscribeTaskComplete` exactement comme Phase 40 (widget refresh) ligne 795-807 et Phase 46 (Auberge tick) ligne 837-845.

**When to use:** Pour brancher la logique Lightning sur le complete d'une tâche sans coupler le domaine tâches avec Lightning.

**Example:**
```typescript
// hooks/useVault.ts — insertion entre ligne 845 (Phase 46) et ligne 847 (backup gamiData)

// Phase 53 : tick Lightning auto sur chaque tâche complétée (transition false→true)
const profilesRefForLightning = useRef(profiles);
profilesRefForLightning.current = profiles;
const activeProfileIdRefForLightning = useRef(activeProfileId);
activeProfileIdRefForLightning.current = activeProfileId ?? null;

useEffect(() => {
  const unsub = tasksHook.subscribeTaskComplete((task) => {
    processTaskCompletionForLightning(task, {
      profiles: profilesRefForLightning.current,
      activeProfileId: activeProfileIdRefForLightning.current,
    }).catch(() => { /* Lightning — non-critical, vault domain unaffected */ });
  });
  return unsub;
}, [tasksHook]);
```
[VERIFIED: hooks/useVault.ts:837-845 (pattern Phase 46 source)]

### Pattern 2: SecureStore JSON load/save/purge — réutiliser le pattern `family-credentials.ts`

**What:** Stocker un JSON normalisé sous une clé `v1` avec parser défensif au load (filter sur shape valide) et normalisation au save.

**When to use:** Pour `audit-log.ts`, `payout-queue.ts`, et tout nouveau bucket SecureStore Phase 53.

**Example:**
```typescript
// lib/lightning/audit-log.ts (esquisse)
import * as SecureStore from 'expo-secure-store';

const AUDIT_KEY = 'lightning_audit_v1';
const RETENTION_DAYS = 90;

export interface AuditEntry {
  ts: string; // ISO
  profileId: string;
  taskId: string;
  sats: number;
  status: 'paid'|'queued'|'capped'|'failed'|'undone'|'already_paid_today'|'cash_out'|'attribution_failed';
  paymentHash?: string;
  error?: string;
}

export async function loadAudit(): Promise<AuditEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((e): e is AuditEntry =>
      e && typeof e.ts === 'string' && typeof e.profileId === 'string' && typeof e.sats === 'number'
    );
    return purgeOlderThan(valid, RETENTION_DAYS);
  } catch { return []; }
}

export async function appendAudit(entry: AuditEntry): Promise<void> {
  const current = await loadAudit();
  current.push(entry);
  await SecureStore.setItemAsync(AUDIT_KEY, JSON.stringify(current));
}
```
[CITED: lib/lightning/family-credentials.ts:19-69 (pattern source)]

### Pattern 3: Bus d'événements local pour toast/pulse cross-screen

**What:** `payout-success` doit déclencher toast + pulse sur le bouton HUD, mais le listener est dans `useVault.ts` (pas sur l'écran tree.tsx). Besoin d'un canal de communication.

**When to use:** Pour découpler la logique pay-out (hook domaine) de la UI feedback (tree.tsx + n'importe quel écran avec wallet).

**Example:**
```typescript
// lib/lightning/lightning-events.ts (esquisse — EventEmitter natif)
type PayoutSuccessEvent = { profileId: string; profileName: string; sats: number };
type Listener<T> = (event: T) => void;

const successListeners = new Set<Listener<PayoutSuccessEvent>>();

export function onPayoutSuccess(listener: Listener<PayoutSuccessEvent>): () => void {
  successListeners.add(listener);
  return () => { successListeners.delete(listener); };
}

export function emitPayoutSuccess(event: PayoutSuccessEvent): void {
  for (const l of Array.from(successListeners)) {
    try { l(event); } catch (e) { if (__DEV__) console.warn('[lightning] event listener error:', e); }
  }
}
```

Puis dans tree.tsx, un `useEffect` qui subscribe + déclenche toast (via `useToast`) + pulse animation. Pattern identique à `subscribeTaskComplete` mais inversé (UI consomme événement émis par hook). [ASSUMED — alternative : passer par ToastContext directement, mais le pulse animation est local à tree.tsx, donc un bus reste utile]

### Anti-Patterns to Avoid

- **Mettre l'audit log dans le vault Markdown** : SPEC Constraint #2 — JAMAIS dans `lib/vault-cache.ts` ni dans le vault Obsidian. Si quelqu'un veut "voir l'historique sur PC", c'est out of scope (planner ne doit pas être tenté).
- **Polling périodique de la balance** : interdit par D-05 (event-driven uniquement). Économique réseau + offline-first respecté.
- **Cache session de FaceID** : SPEC Constraint #4 — FaceID obligatoire AVANT CHAQUE pay-out famille→membre ET membre→externe. Pas de "FaceID valable 5 min". Trop risqué (mineur qui prend le téléphone juste après).
- **Affichage admin key famille en clair** : SPEC Constraint — `secureTextEntry` obligatoire dans tous les inputs admin key. Jamais loggée même en `__DEV__`.
- **Toggle Lightning ON pendant config incomplète** : pattern déjà présent SettingsLightning.tsx:79-89 (Alert si pas savedConfigured) — préserver et étendre pour family config.
- **Wording promotionnel ou enfantin** : UI-SPEC + CONTEXT D-04 — pas de "Bravo !", "Tu as gagné !", "Récompense !". Factuel et chaleureux.
- **Try/catch silencieux qui mange les erreurs réseau ET les erreurs de logique** : séparer — `LnbitsError` (réseau, attendu, → queue) vs erreur logique (bug, → log __DEV__ ET continue).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Décoder/valider un bolt11 invoice | Parser bolt11 maison (bech32, tagged fields) | (a) Skip — laisser LNbits valider (erreur 4xx remontée) ; (b) `light-bolt11-decoder` npm si on veut afficher le montant pré-FaceID | bech32 + tagged fields = spec longue ; bug = perte de sats |
| QR code scanner | Caméra custom + librairie ZXing | `expo-camera` `CameraView` avec `barcodeScannerSettings={{barcodeTypes:['qr']}}` et `onBarcodeScanned` | Recommandé Expo SDK 54+, `expo-barcode-scanner` deprecated [CITED: docs.expo.dev/versions/latest/sdk/camera/] |
| Reachability network | `fetch` polling avec timeout | `@react-native-community/netinfo` `NetInfo.addEventListener()` (si dependency acceptée) ou fallback `AppState 'active'` | NetInfo gère iOS/Android, transitions wifi/cellular, captive portals |
| FaceID prompt | Manipulation directe LAContext native | `expo-local-authentication` `authenticateAsync({promptMessage, disableDeviceFallback})` | Déjà wrappé dans `authenticatePayOut()` — réutiliser tel quel |
| Idempotence côté serveur | Implémenter dans LNbits ou un proxy custom | Idempotence côté client : `extra: {taskId, completedDate}` injecté dans `createInvoice` + check audit avant `payInvoice` | LNbits n'a PAS de dédoublonnage natif [VERIFIED: lnbits/core/views/payment_api.py via WebFetch]. L'API accepte un champ `extra` arbitraire qui sert de marqueur. |
| Encryption au-dessus de SecureStore | AES + clé dérivée | `expo-secure-store` direct — il utilise iOS Keychain (kSecClassGenericPassword) | Déjà chiffré OS-level, double-chiffrement = source de bugs |
| Notification scheduling | Crontab maison | `expo-notifications` `scheduleNotificationAsync` + cap 1/jour côté client | Déjà utilisé pour Auberge/RDV/tâches (lib/scheduled-notifications.ts) |
| File watcher pour AppState | `setInterval` + check `document.visibilityState` | `AppState.addEventListener('change', ...)` natif RN | API stable RN, déjà utilisée |

**Key insight:** La complexité Phase 53 vient de la **chorégraphie** (listener + queue + retry + audit + idempotence + dailyCap + FaceID + UI feedback), pas des primitives bas niveau qui sont toutes wrappées par Expo. Le risque de hand-rolling est haut sur l'idempotence (tentation de "je vérifie juste le state in-memory") et sur le scan QR (tentation de "je copie-colle un sample StackOverflow").

## Runtime State Inventory

> Phase 53 = renommage `Child*` → `Member*` + suppression `credentials.ts` + cleanup playgrounds → inventaire requis.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | SecureStore `lightning_lnbits_config_v1` (single-wallet legacy) — peut contenir creds d'utilisateurs dev/spike. **Migration auto** REQ-11 : lire single, créer family, supprimer single. | Code edit (migration boot) + data migration (read+write+delete) |
| **Stored data** | SecureStore `lightning_family_config_v1` — JSON avec `children: ChildWalletMapping[]`. Après renommage, le code écrit `members: [...]`. | Code edit + data migration : `loadFamilyConfig` accepte `children` ET `members` à la lecture (backward-compat) ; `saveFamilyConfig` écrit `members` ; ancien tableau `children` est silencieusement migré au prochain save |
| **Stored data** | None pour la queue / audit log / parent notif — nouvelles clés `lightning_payout_queue_v1` / `lightning_audit_v1` / `lightning_last_parent_notif_v1` créées par Phase 53. Aucun legacy. | Aucune migration. Init fresh au premier write. |
| **Live service config** | LNbits instance BYO — wallets (Famille + sub-wallets Lucas, Emma, etc.) créés manuellement par l'utilisateur via UI LNbits. **Les noms/IDs des wallets côté LNbits ne changent pas** par cette phase. Seuls les types TS côté app changent. | Aucune action côté LNbits. Le renommage `Child*` → `Member*` est purement TypeScript côté app. |
| **OS-registered state** | `expo-notifications` notifs planifiées — auberge/RDV/tâches existantes restent intactes. Phase 53 ajoute son propre identifier prefix `lightning-parent-notif-{YYYY-MM-DD}`. | Aucune migration. Pas de cleanup d'identifiers anciens (Phase 53 démarre vierge). |
| **Secrets/env vars** | Aucune. Les "secrets" Lightning vivent en SecureStore (admin key famille). Pas de `.env`, pas de SOPS, pas d'env vars système touchés par Phase 53. | None. |
| **Build artifacts / installed packages** | `expo-camera` NON installé aujourd'hui [VERIFIED: grep package.json]. Doit être ajouté via `npx expo install expo-camera`. Pas d'egg-info ou autre artefact stale. | Installer dépendance : `npx expo install expo-camera` + ajouter `NSCameraUsageDescription` dans `app.json` (plugin section) ou Info.plist iOS. Rebuild dev-client requis : `npx expo run:ios --device`. |
| **Build artifacts / installed packages** | `@react-native-community/netinfo` NON installé aujourd'hui [VERIFIED: grep package.json]. Si planner retient le reachability listener strict (vs fallback AppState), à ajouter. | Conditionnel — `npx expo install @react-native-community/netinfo` + rebuild dev-client. |

**Nothing found in category:** Secrets/env vars (vraiment rien — tout vit en SecureStore, qui est un magasin chiffré OS-level qu'on touche déjà).

**Code references à mettre à jour pour `Child*` → `Member*` codemod** :
- `lib/lightning/types.ts:79` : `children: ChildWalletMapping[]` → `members: MemberWalletMapping[]`
- `lib/lightning/types.ts:82-89` : interface `ChildWalletMapping` → `MemberWalletMapping`
- `lib/lightning/index.ts:15,32` : exports
- `lib/lightning/family-credentials.ts:15,29,40,62` : import + tous les usages
- `app/lightning-family-spike.tsx` : à supprimer (REQ-12) — pas besoin de migrer
- `components/settings/SettingsLightning.tsx` : à étendre — pas de référence aujourd'hui à `Child*`

## Common Pitfalls

### Pitfall 1: SecureStore iOS limite 2 KB par clé — audit log 90 j × 4 membres explose
**What goes wrong:** Au-delà de ~2048 bytes par valeur SecureStore, iOS throw une erreur OU tronque silencieusement. Le SPEC #7 demande 90 jours glissants ; à 4 membres × ~3 entrées/jour × 90 j = ~1 080 entrées, chaque entrée ~150 octets en JSON → ~160 KB. **80× au-dessus de la limite.**
**Why it happens:** SecureStore = iOS Keychain `kSecClassGenericPassword`, conçu pour stocker des mots de passe, pas des datasets. [CITED: docs.expo.dev/versions/latest/sdk/securestore/]
**How to avoid:**
- **Option A (recommandée)** : partitionner l'audit log par mois (`lightning_audit_2026-05_v1`). Au boot, lister les clés du mois courant + mois précédent (90 j ≈ 3 mois). Purger les clés > 3 mois. Chaque partition ~30 j × 4 × 3 ≈ 360 entrées ≈ 55 KB → encore trop, mais partitionner aussi par profil (`lightning_audit_{profileId}_2026-05_v1`) → ~90 entrées par clé → ~14 KB → toujours trop.
- **Option B (alternative)** : utiliser AsyncStorage pour l'audit log (pas chiffré, mais audit = pas un secret — c'est de l'historique). Garder SecureStore uniquement pour creds + flag + queue (la queue reste petite, ~5-10 items max).
- **Option C** : compresser le JSON (LZ-string) avant `setItemAsync`. Gain ~3-5x. Plus complexe.
**Warning signs:** TypeError au write, audit log qui "oublie" des entrées, log `__DEV__` `[SecureStore] value too large`.
[ASSUMED: planner choisit l'option] — recommandation forte = **Option B (AsyncStorage pour l'audit, SecureStore pour creds+queue)**. Audit log = historique de transactions PUBLIC côté wallet (on peut tout retrouver sur la blockchain LN via paymentHash) ; le chiffrement OS-level n'apporte aucun secret. Garde la séparation : creds restent SecureStore.

### Pitfall 2: Double-toggle rapide → double pay-out
**What goes wrong:** Utilisateur tape "completed" puis re-tape "completed" en < 100 ms (geste double-tap rapide). `subscribeTaskComplete` fire 2× la transition. Sans lock, 2 invoices créées + 2 pay-outs.
**Why it happens:** `toggleTask` est async ; entre le moment où on lit `wasCompleted` et où la state se met à jour, un 2ᵉ tap peut passer.
**How to avoid:**
- Lock in-memory : `Map<taskId, Promise>` qui rejette les calls concurrents pour le même taskId.
- Idempotence audit log : avant tout pay-out, lire l'audit log et chercher `taskId+date` avec status `paid` → si trouvé, return `'already_paid_today'`.
- **Combiner les deux** : lock évite le race condition rapide, audit log survit au reload app.
**Warning signs:** Balance famille diminue de 200 sats au lieu de 100 pour la même tâche, audit log a 2 entrées `paid` pour le même taskId+date.
[VERIFIED: hooks/useVaultTasks.ts:90-140 — `wasCompleted` est lu de l'objet task qui peut être stale entre deux toggles ; `toggleTask` ne pose pas de lock]

### Pitfall 3: Race condition entre dailyCap check et payInvoice
**What goes wrong:** Utilisateur complète 2 tâches en parallèle (peu probable mais possible avec 2 enfants sur 2 devices ou… juste 2 toggles successifs avant que l'audit s'écrive). Les deux passent le check `dailyCap < 1000` (qui voit le même cumul stale), les deux invoices se créent, le wallet famille paye 2 × 100 sats même si la 2ᵉ aurait dû être `capped`.
**Why it happens:** Le check du cap est un read SecureStore + comparaison, le pay-out est un POST réseau. Entre les deux, plusieurs centaines de ms ; le cumul ne s'incrémente qu'à l'audit log write APRÈS le pay-out.
**How to avoid:**
- Combiner avec le lock du Pitfall 2 : un seul pay-out en vol à la fois (lock global ou per-profile).
- Réserver le slot dans l'audit log AVANT le pay-out : écrire `status: 'paying'` (nouveau statut intermédiaire) avec un placeholder, puis update vers `'paid'` ou rollback (delete) si échec. Plus complexe.
- **Simple suffit** : lock global serialise les pay-outs. Le throughput cible est ~1 pay-out / 5 s (humain qui tape), pas un système haute-fréquence.
**Warning signs:** Cumul du jour dépasse le `dailyCapPerMember`, audit log a une entrée `paid` qui aurait dû être `capped`.

### Pitfall 4: LNbits demo instance — la `bolt11` peut être `payment_request` (champ alias)
**What goes wrong:** `LnbitsClient.createInvoice` lit `raw.bolt11 ?? raw.payment_request` (lib/lightning/lnbits-client.ts:139). Sur certaines versions LNbits, seul `payment_request` est renvoyé ; sur d'autres, seul `bolt11`. Sur d'autres encore, les deux. Le client gère déjà ça, mais le PLANNER doit savoir que c'est défensif et ne PAS le simplifier.
**Why it happens:** Évolution de l'API LNbits ; les anciennes versions utilisent `payment_request`, les nouvelles `bolt11`. [VERIFIED: lib/lightning/lnbits-client.ts:139 — code défensif déjà en place]
**How to avoid:**
- Conserver le double fallback `raw.bolt11 ?? raw.payment_request` dans toute modification du client.
- Ne pas typer `bolt11: string` strict côté response — laisser optionnel et faire la résolution dans une fonction.
**Warning signs:** `LnbitsError: Réponse LNbits incomplète (payment_hash/bolt11 manquant)` sur des invoices qui passent côté UI LNbits.

### Pitfall 5: `__DEV__` bypass de FaceID — il NE doit PAS atteindre la prod
**What goes wrong:** `biometric-gate.ts:39` accepte success en `__DEV__` si pas de hardware/enrolled. Si un build prod est compilé avec `__DEV__` mal configuré, c'est un bypass de sécurité.
**Why it happens:** Expo dev-client a `__DEV__ = true`. Builds release `__DEV__ = false`. Tant qu'on est sur le pattern Expo standard, c'est OK. Mais des configs custom (eas.json env vars, etc.) peuvent changer ça.
**How to avoid:**
- Tester sur build release (TestFlight) avant de considérer la feature stable : sur device sans FaceID enrolled, le pay-out doit échouer avec un Alert clair, pas réussir silencieusement.
- Documenter dans le commit message du plan final que le bypass est intentionnellement `__DEV__`-only.
- Optionnel : ajouter un check supplémentaire `Constants.appOwnership !== 'standalone' && __DEV__` pour double-ceinture.
**Warning signs:** En TestFlight, un device sans FaceID enrolled qui peut quand même pay-out → BUG GRAVE.

### Pitfall 6: `expo-camera` permission demandée trop tard → user friction
**What goes wrong:** Au moment d'ouvrir le scan QR, la permission n'a jamais été demandée. iOS affiche le prompt système, l'utilisateur refuse, le bouton "Scanner" est inutile pour toujours.
**Why it happens:** L'utilisateur n'attend pas la permission dans le contexte d'encaisser. Et `Linking.openSettings()` pour récupérer = friction massive.
**How to avoid:**
- Demander la permission au mount du modal "Encaisser", PAS au tap sur "Scanner QR".
- Si refused : afficher un fallback explicite ("Permission caméra refusée. Tu peux toujours coller un bolt11 ci-dessus, ou activer la caméra dans Réglages iOS.") + bouton `Linking.openSettings()`.
- Utiliser `useCameraPermissions()` hook officiel `expo-camera` [CITED: docs.expo.dev/versions/latest/sdk/camera/].
**Warning signs:** Utilisateur tape "Scanner QR", rien ne se passe, pas de message d'erreur.

### Pitfall 7: `presentationStyle="pageSheet"` + scan QR modal plein écran = stacking de modals iOS
**What goes wrong:** La modal "Encaisser" est en `pageSheet`. Le scan QR par-dessus doit être `presentationStyle="fullScreen"`. Si on présente le 2ᵉ modal trop vite après l'ouverture du 1ᵉʳ (< 300 ms), iOS bloque l'animation et le 2ᵉ n'apparaît pas.
**Why it happens:** Phase 40 (Sporée) a documenté ce pitfall : `setTimeout(300ms)` entre 2 modals pageSheet successifs. Cf. STATE.md ligne 399.
**How to avoid:**
- `setTimeout(300ms)` après dismiss du picker QR avant present du 2ᵉ modal (ou inverse).
- Préférer ouvrir le scan QR comme un Modal natif `presentationStyle="fullScreen"` SANS dismiss du modal Encaisser dessous (le 2ᵉ stack au-dessus).
- Tester sur device réel — le simulateur peut masquer le bug.
**Warning signs:** Tap "Scanner QR" ne fait rien apparaître, scroll bug du modal parent.
[VERIFIED: .planning/STATE.md Phase 40 — pattern G1 stacking pageSheets]

### Pitfall 8: Ferme régressée silencieusement par un import Lightning au top du fichier
**What goes wrong:** Importer `lib/lightning/...` au top de `app/(tabs)/tree.tsx` charge le module entier au mount (même si `LIGHTNING_ENABLED === false`). Si une dépendance Lightning crash à l'import (ex: expo-camera mal installé), la ferme entière crash.
**Why it happens:** Metro bundler eager imports.
**How to avoid:**
- Imports dynamiques `await import('lib/lightning/...')` dans les handlers (pattern déjà utilisé pour `lib/time-blocking` cf. useVaultTasks.ts:132).
- OU : keep import statique mais s'assurer qu'aucune erreur au top-level (pas de side-effect au require).
- Le code lib/lightning actuel est OK (pas de side effect), mais le planner doit garder ça en tête en étendant.
**Warning signs:** Ferme white screen au boot après un commit Phase 53, stack trace mentionne `expo-camera` ou un module Lightning.

### Pitfall 9: Migration single→family non-idempotente écrase la family existante
**What goes wrong:** L'effect bootstrap migration lit `lightning_lnbits_config_v1` (single) et écrit `lightning_family_config_v1`. Si l'utilisateur a DÉJÀ une family config (cas du dev qui a testé spike 004), la migration écrase ses sub-wallets membres.
**Why it happens:** Manque de check "la family existe déjà".
**How to avoid:**
- Check `loadFamilyConfig() !== null` AVANT migration. Si déjà family : juste supprimer la single (cleanup) sans toucher à la family.
- Tests Jest unit pour les 3 cas : (a) single seul → migré, (b) family seul → no-op, (c) les deux → cleanup single sans modifier family.
**Warning signs:** Utilisateur dev qui rapporte "mes sub-wallets ont disparu après mise à jour".

### Pitfall 10: Cleanup playgrounds dans le mauvais ordre → app cassée pendant la phase
**What goes wrong:** Le SettingsLightning.tsx référence `/lightning-spike` et `/lightning-family-spike` (lignes 157-163). Si on supprime les fichiers `app/lightning-*-spike.tsx` AVANT de retirer les liens, l'app crash sur `router.push('/lightning-spike')`.
**Why it happens:** Ordre de cleanup.
**How to avoid:**
- Plan 4 = un seul commit cleanup avec : (1) retirer les `TouchableOpacity` "Ouvrir l'écran de test" de SettingsLightning.tsx, (2) supprimer les fichiers `app/lightning-*-spike.tsx`, (3) supprimer `lib/lightning/credentials.ts`, (4) update barrel `index.ts`, (5) tsc clean. Atomique.
**Warning signs:** Crash navigation après build.

## Code Examples

### Example A — Resolver attribution destinataire (REQ-2)

```typescript
// lib/lightning/resolve-recipient.ts
import type { Task, Profile } from '../types';
import type { MemberWalletMapping } from './types';

/**
 * Détermine le profileId destinataire d'un pay-out pour une tâche donnée.
 * Règles :
 *  - 1 seule mention enfant ⇒ destinataire = ce profil (si configuré)
 *  - 0 mention ⇒ destinataire = activeProfile (si configuré)
 *  - mentions multiples ⇒ skip (ambiguïté)
 *  - mention non-configurée ⇒ skip
 */
export function resolveRecipient(
  task: Task,
  profiles: Profile[],
  memberWallets: MemberWalletMapping[],
  activeProfileId: string | null,
): { profileId: string; profile: Profile; wallet: MemberWalletMapping } | null {
  const walletByProfile = new Map(memberWallets.map(m => [m.profileId, m]));

  // Cas 1 : mentions
  if (task.mentions && task.mentions.length === 1) {
    const mentionName = task.mentions[0].toLowerCase();
    const found = profiles.find(p =>
      p.name.toLowerCase() === mentionName || p.id.toLowerCase() === mentionName
    );
    if (!found) return null;
    const wallet = walletByProfile.get(found.id);
    if (!wallet) return null;
    return { profileId: found.id, profile: found, wallet };
  }

  // Cas 2 : mentions multiples → ambigu
  if (task.mentions && task.mentions.length > 1) return null;

  // Cas 3 : pas de mention → activeProfile fallback
  if (!activeProfileId) return null;
  const active = profiles.find(p => p.id === activeProfileId);
  if (!active) return null;
  const wallet = walletByProfile.get(active.id);
  if (!wallet) return null;
  return { profileId: active.id, profile: active, wallet };
}
```

### Example B — LNbits idempotency via `extra` field

```typescript
// Inside lib/lightning/lnbits-client.ts (étendre createInvoice)
async createInvoice(
  amountSats: number,
  memo: string,
  extra?: Record<string, string | number>,  // NEW — pour idempotency tag
): Promise<CreateInvoiceResult> {
  // ... validation ...
  const body: any = { out: false, amount: amountSats, unit: 'sat', memo };
  if (extra) body.extra = extra;  // LNbits accepte un champ extra arbitraire
  const raw = await this.request<...>('/api/v1/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  // ... pareil ...
}

// Usage dans la pay-out logic :
const invoice = await childClient.createInvoice(100, `Tâche : ${task.text}`, {
  taskId: task.id,
  completedDate: task.completedDate ?? new Date().toISOString().slice(0, 10),
  profileId: recipient.profileId,
});
```
[VERIFIED: lnbits/core/views/payment_api.py accepte le champ `extra` via WebFetch]

### Example C — expo-camera CameraView QR scanner

```typescript
// components/lightning/QrScannerOverlay.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

export function QrScannerOverlay({ onScan, onClose }: { onScan: (bolt11: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) return null;  // loading
  if (!permission.granted) {
    return (
      // Fallback UI : permission refusée + bouton Linking.openSettings()
      // (cf. Pitfall 6)
    );
  }

  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={scanned ? undefined : ({ data }) => {
        setScanned(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onScan(data);
      }}
    >
      {/* Overlay cadre 240×240 + bouton close */}
    </CameraView>
  );
}
```
[CITED: docs.expo.dev/versions/latest/sdk/camera/]

### Example D — Pulse animation Reanimated 4 (HUD bouton ⚡)

```typescript
// components/lightning/HudLightningButton.tsx (extrait)
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const PULSE_SPRING = { damping: 10, stiffness: 180 } as const;

export function HudLightningButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);

  // Exposé via ref forward ou via bus d'événements (lightning-events.ts)
  function triggerPulse() {
    scale.value = withSpring(1.2, PULSE_SPRING, () => {
      scale.value = withSpring(1.0, PULSE_SPRING);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity style={styles.hudCodexButton} onPress={onPress}>
        <Text style={styles.hudEmoji}>⚡</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
```
[VERIFIED: app/(tabs)/tree.tsx:3508 style source ; 53-UI-SPEC.md Animation 1 spec]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-barcode-scanner` separate package | `expo-camera` `CameraView` avec `barcodeScannerSettings` intégré | Expo SDK 52+ (2025) | `expo-barcode-scanner` DEPRECATED ; recommander `expo-camera` direct |
| Manual permission prompt via `LocalAuthentication.authenticateAsync({fallbackLabel:''})` | `disableDeviceFallback: true` parameter clean | expo-local-authentication 13+ | Plus simple, intent clair "biométrie ONLY" |
| `NetInfo.isConnected.fetch()` legacy API | `NetInfo.fetch()` + `NetInfo.addEventListener()` | @react-native-community/netinfo 5+ (2020) | Ancien API supprimé |
| Custom `useEffect + AppState` everywhere | Existing pattern + `AppState.currentState` au mount + listener | React Native standard | Phase 53 doit suivre pattern existant (vérifier hooks/contexts pour précédent) |
| LNbits single-wallet (`invoice_key` seule) | LNbits multi-wallet famille (admin key famille + invoice keys enfants) | Spike 004 (2026-05) | Phase 53 cleanup le single legacy |
| LNbits provisioning via User Manager API | Création manuelle dans UI LNbits par le parent | Spike 004 rejection | BYO-friendly, pas de super-admin requis |

**Deprecated/outdated:**
- `expo-barcode-scanner` : DEPRECATED [CITED: github.com/expo/fyi/barcode-scanner-to-expo-camera.md] — utiliser `expo-camera` CameraView à la place.
- `lib/lightning/credentials.ts` : DEPRECATED LEGACY single-wallet (à supprimer REQ-12).
- `app/lightning-spike.tsx`, `app/lightning-family-spike.tsx` : DEPRECATED playgrounds (à supprimer REQ-12).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Audit log JSON ~150 octets par entrée (timestamp ISO + profileId + taskId + sats + status + paymentHash optional + error optional) | Pitfall #1 | Underestimation → encore plus pressant de partitionner. Validation recommandée : faire un sample manual count après quelques pay-outs réels. |
| A2 | Le pattern `subscribeTaskComplete` actuel (Phase 40 + Phase 46) supporte un 3ᵉ subscriber sans modification du `taskCompleteListenersRef: Set` | Pattern 1 | Bug si le Set a une limite (il n'en a pas en JS). Aucun risque. [VERIFIED en lisant le code source] |
| A3 | Le bus d'événements (`lightning-events.ts`) est nécessaire pour découpler le hook domaine (où vit le listener pay-out) de la UI feedback (tree.tsx pulse + toast) | Pattern 3 | Alternative valide : passer par `ToastContext` direct depuis le hook + déclencher pulse via une ref forwarder à tree.tsx. Le planner peut choisir. |
| A4 | `expo-camera` permission demande peut se faire au mount du modal "Encaisser" sans friction (modal pageSheet déjà visible, l'utilisateur s'attend à interaction caméra) | Pitfall #6 | Risque UX : si l'utilisateur ouvre le modal pour paste manuel et ne veut PAS la caméra, le prompt apparaît quand même. Alternative : permission au tap "Scanner QR" mais gérer le case refused proprement avec fallback texte. |
| A5 | Le statut intermédiaire `paying` proposé dans Pitfall #3 n'est pas dans le SPEC. La majorité des cas est couverte par le lock global. | Pitfall #3 | Si planner adopte `paying`, étendre le tableau de statuts audit dans le code (et UI-SPEC tableau statuts ligne 226). |
| A6 | La queue offline et la queue daily-review peuvent partager la même structure SecureStore (un seul fichier `lightning_payout_queue_v1` avec champ `reason: 'offline' \| 'review'` par item) | Recommended structure | Alternative : 2 clés distinctes. Simplification : 1 clé, c'est plus simple à maintenir. |
| A7 | Le check FaceID se fait UNE fois par batch validation (pas par item) — D-08 dit "1 seul prompt FaceID au tap" | UI-SPEC validation batch | OK selon le contexte (parent qui décide consciemment de payer N tâches d'un coup), mais reconfirmer si le SPEC évolue. |
| A8 | Le `expo-camera` Info.plist `NSCameraUsageDescription` doit être en français : "Permet à FamilyFlow de scanner les QR codes des invoices Lightning." | Environment Availability | Texte exact à valider, mais doit être en français pour cohérence et clarté App Store. |
| A9 | La structure `components/lightning/*` (BalanceCard, AuditLogItem, etc.) est une organisation recommandée mais le planner peut tout consolider dans `app/lightning-wallet.tsx` si plus simple | Recommended Project Structure | Pas critique — purely organizational. |

**Si cette table est vide :** non — 9 assomptions à valider/confirmer par le planner ou le user en discuss complémentaire.

## Open Questions (RESOLVED)

1. **AsyncStorage vs SecureStore pour l'audit log 90 j ?**
   - What we know : SecureStore limite 2 KB / clé. Audit 90 j × 4 membres × 3/j = ~1080 entrées soit ~160 KB.
   - What's unclear : préférence du user — confidentialité audit log (qui voit quoi quand) vs simplicité.
   - Recommendation : **AsyncStorage** pour l'audit (pas un secret — un audit est consultable sur la blockchain LN), **SecureStore** pour creds + queue + flag (queue reste petite ~5-10 items). Le planner doit confirmer.
   - **RESOLVED: AsyncStorage** — l'audit log est non-secret (paymentHash retrouvable on-chain) et atteint ~160 KB en régime, dépassant largement la limite SecureStore iOS de ~2 KB par clé. AsyncStorage est ajouté via `npx expo install @react-native-async-storage/async-storage` au Plan 01 (dépendance neuve — `vault-cache.ts` utilise `expo-file-system`, pas AsyncStorage).

2. **Reachability listener strict (NetInfo) ou fallback AppState seul ?**
   - What we know : SPEC #5 dit "retry au foreground app + reachability change". AppState seul couvre ~80 % des cas. NetInfo = +1 dépendance.
   - What's unclear : tolérance du user à l'edge case "mode avion → désactivé sans backgrounding".
   - Recommendation : **NetInfo** (la dépendance est légère + Expo SDK 54 la ship via autolinking), mais si le user refuse strictement les nouvelles deps → fallback AppState avec retry périodique limité (toutes les 30 s tant que app foreground avec queue non vide).
   - **RESOLVED: AppState seul** — REQ-5 acceptance "retry au foreground" est couvert par `AppState.addEventListener('change')` + boot flush. NetInfo deferred v2. L'edge case "mode avion levé sans backgrounding" est une limitation acceptée MVP : la queue se vide au prochain foreground transition (la majorité des cas — l'utilisateur revient sur l'app après avoir levé le mode avion). Documenté en limitation accepted dans le SUMMARY Plan 02.

3. **Décodage bolt11 côté client pour afficher le montant pré-FaceID ?**
   - What we know : SPEC ne le mentionne pas. UX-SPEC dit "La transaction Lightning est définitive. Vérifiez l'invoice avant de confirmer." → invite à vérifier visuellement.
   - What's unclear : sans décodage, l'utilisateur ne SAIT pas combien il envoie tant qu'il n'a pas confirmé.
   - Recommendation : **MVP sans décodage** (LNbits remontera une erreur si invalide ou amount > balance). v2 : ajouter `light-bolt11-decoder` (npm, 25 KB) pour afficher montant + memo extraits.
   - **RESOLVED: deferred v2** — FaceID gate obligatoire + disclaimer prominent dans `CashOutModal` + LNbits qui rejette les invoices malformés/invalides (toast erreur) suffisent au MVP. Décodage bolt11 = enhancement v2 si feedback TestFlight indique besoin.

4. **Cleanup playgrounds = dernier commit OU plan 4 dédié ?**
   - What we know : Claude Discretion dit "1 commit final après que tout le reste fonctionne".
   - What's unclear : si "1 commit" = "1 plan dédié" (granularité Phase 53) ou juste "1 commit dans le dernier plan".
   - Recommendation : **Plan 4 dédié au cleanup** (suppression + renommage + tsc clean + grep verification). Permet de tester avant cleanup que tout marche, puis cleanup atomique. Couvre REQ-12 acceptance criterion explicite.
   - **RESOLVED: Plan dédié (renuméroté Plan 04, Wave 5)** — cleanup atomique + checkpoint device pour valider non-régression ferme/Auberge/widget avant suppression irréversible des fichiers legacy. Pitfall #10 (ordre cleanup critique) respecté : Plan 03b retire d'abord les consommateurs (liens TouchableOpacity dans SettingsLightning), Plan 04 supprime les fichiers.

5. **Si LNbits demo instance est down pendant test → comment certifier la phase ?**
   - What we know : Tous les tests fonctionnels sont contre `demo.lnbits.com` (BYO). Si demo est down, on ne peut pas tester end-to-end.
   - What's unclear : politique de fallback (mock LNbits ? jest-msw ? attendre que demo soit up ?).
   - Recommendation : **mock LNbits dans les tests Jest unitaires** (msw ou simple fetch mock), test manuel end-to-end facultatif si demo down (à reporter sur build TestFlight ultérieur).
   - **RESOLVED: tests Jest mockés suffisent CI** — `lib/lightning/__tests__/*` mockent `LnbitsClient` via `jest.mock('../lnbits-client', ...)` (Plan 02). Le test device manuel sur LNbits BYO (`demo.lnbits.com` ou instance perso) reste facultatif post-merge si la demo est dispo (checkpoint Plan 03b + Plan 04). Si demo down → la phase peut être livrée avec tests Jest verts ; les flows réseau sont validés au prochain accès LNbits.


## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-secure-store` | Creds + flag + queue + audit (some) + parent notif timestamp | ✓ | ~15.0.8 | — |
| `expo-local-authentication` | FaceID gate REQ-8 + REQ-9 + REQ-10 | ✓ | ~17.0.8 | — |
| `expo-notifications` | Notif parent agrégée D-10 | ✓ | ~0.32.17 | — |
| `expo-haptics` | Feedback D-04 + scan QR + batch | ✓ | ~15.0.8 | — |
| `expo-clipboard` | Paste bolt11 | ✓ | ~8.0.8 | — |
| `react-native-reanimated` | Pulse HUD D-04 | ✓ | ~4.1.1 | — |
| `lucide-react-native` | Icônes UI-SPEC | ✓ | ^1.11.0 | — |
| `expo-router` | Route `/lightning-wallet` | ✓ | ~6.0.23 | — |
| `react-native-qrcode-svg` | (optionnel) afficher invoice généré comme QR | ✓ | ^6.3.21 | — |
| **`expo-camera`** | **Scan QR bolt11 (REQ-9 + UI-SPEC Surface 5)** | **✗** | — | Skip scan QR + saisie manuelle bolt11 uniquement → **descope** acceptance criterion REQ-9, mettre à jour SPEC.md |
| **`@react-native-community/netinfo`** | **Reachability listener REQ-5 retry queue** | **✗** | — | Fallback AppState 'active' + retry périodique 30 s tant que app foreground + queue non vide |
| LNbits instance BYO (network) | Tous les flows pay-out + encaissement | Conditionnel — `demo.lnbits.com` au test, ou instance perso utilisateur | n/a | Jest tests avec fetch mock pour unit tests ; build dev-client testable sans live LNbits si pure UI ; end-to-end requiert instance live |
| iOS FaceID / TouchID hardware | FaceID gate prod | Conditionnel — physical device ; simulateur bypass `__DEV__` | n/a | Test build TestFlight sur device avec FaceID enrolled (REQ-8/9/10 valid only sur device réel) |

**Missing dependencies with no fallback:**
- `expo-camera` si le user REFUSE le descope du scan QR → **bloquant**, à installer avant Plan 3.

**Missing dependencies with fallback:**
- `@react-native-community/netinfo` → AppState fallback acceptable, dégradation UX mineure.
- `expo-camera` si user accepte descope → fallback paste bolt11 uniquement (à valider en discuss complémentaire si retenu).

**Action required from planner:**
1. Installer `expo-camera` via `npx expo install expo-camera` + ajouter `NSCameraUsageDescription` (FR) dans `app.json` `plugins` section ou Info.plist iOS.
2. Décider sur NetInfo (recommandation : install ; alternative : AppState fallback).
3. Rebuild dev-client après installs : `npx expo run:ios --device`.

## Validation Architecture

> Inclus malgré `workflow.nyquist_validation: false` dans `.planning/config.json` (instruction explicite de la spec utilisateur). À traiter comme surface utile au planner, non comme gate workflow.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest + @testing-library/react-native ^13.3.3 (jest-expo ~54.0.17) |
| Config file | `jest.config.js` (à vérifier dans la racine) |
| Quick run command | `npx jest --no-coverage lib/lightning/__tests__/` (tests unit module pur) |
| Full suite command | `npx jest --no-coverage` (suite complète projet) |
| Type check | `npx tsc --noEmit` (gate obligatoire CLAUDE.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-2 | `resolveRecipient` couvre 6 cas (mention unique configurée, mention non configurée, no mention + active configuré, no mention + active non configuré, 2 mentions, mention adulte) | unit Jest | `npx jest --no-coverage lib/lightning/__tests__/resolve-recipient.test.ts` | ❌ Wave 0 |
| REQ-3 | Trigger mode dispatch (instant/daily-review/hybrid) | unit Jest | `npx jest --no-coverage lib/lightning/__tests__/trigger-mode.test.ts` | ❌ Wave 0 |
| REQ-4 | DailyCap atomic check, cumul depuis audit | unit Jest | `npx jest --no-coverage lib/lightning/__tests__/daily-cap.test.ts` | ❌ Wave 0 |
| REQ-5 | Queue offline enqueue/flush/retry cap 5 | unit Jest | `npx jest --no-coverage lib/lightning/__tests__/payout-queue.test.ts` | ❌ Wave 0 |
| REQ-6 | Idempotence `taskId+date` (re-cocher = pas double pay) | unit Jest (mock audit log) | `npx jest --no-coverage lib/lightning/__tests__/idempotence.test.ts` | ❌ Wave 0 |
| REQ-7 | Audit log purge > 90 j | unit Jest (faketimers + advanceTime) | `npx jest --no-coverage lib/lightning/__tests__/audit-log.test.ts` | ❌ Wave 0 |
| REQ-11 | Migration single→family idempotente (3 cas) | unit Jest | `npx jest --no-coverage lib/lightning/__tests__/migration.test.ts` | ❌ Wave 0 |
| REQ-1, 8, 9, 10 | Flux end-to-end pay-out + UI feedback | manual (TestFlight ou dev-client + live demo.lnbits.com) | Manual sur device | n/a |
| REQ-12 | Cleanup playgrounds + renommage | shell verification | `find app lib -name '*lightning-spike*' \| wc -l` (doit retourner 0) + `grep -r 'ChildWallet\|loadLnbitsConfig' lib components` (doit retourner vide) | n/a |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (obligatoire CLAUDE.md) + `npx jest --no-coverage lib/lightning/__tests__/` (rapide, < 5 s pour tests purs)
- **Per wave merge:** `npx jest --no-coverage` (suite complète, ~30-60 s)
- **Phase gate:** `npx tsc --noEmit` clean + Jest full pass + manual end-to-end sur dev-client avec demo.lnbits.com + verification cleanup (find + grep)

### Wave 0 Gaps

- [ ] `lib/lightning/__tests__/resolve-recipient.test.ts` — covers REQ-2 (6 cas SPEC acceptance)
- [ ] `lib/lightning/__tests__/trigger-mode.test.ts` — covers REQ-3
- [ ] `lib/lightning/__tests__/daily-cap.test.ts` — covers REQ-4
- [ ] `lib/lightning/__tests__/payout-queue.test.ts` — covers REQ-5
- [ ] `lib/lightning/__tests__/audit-log.test.ts` — covers REQ-7 (incluant purge 90 j via fake timers)
- [ ] `lib/lightning/__tests__/idempotence.test.ts` — covers REQ-6
- [ ] `lib/lightning/__tests__/migration.test.ts` — covers REQ-11 (3 cas)
- [ ] (optionnel) `lib/lightning/__tests__/__mocks__/secure-store.ts` — mock SecureStore en memory pour tests
- [ ] Framework install : Jest déjà installé, pas de gap framework. `@testing-library/react-native` présent pour future tests UI si besoin.

**Critical invariants à protéger par tests :**
1. **Pas de double pay-out** pour le même `taskId+completedDate` (REQ-6) — test : 2× toggle même tâche → 1 entrée `paid` + 1 entrée `already_paid_today` dans audit.
2. **DailyCap jamais dépassé** même sous race condition (REQ-4) — test : 11 tâches simultanées avec cap 1000 → exactement 10 `paid` + 1 `capped`.
3. **Queue offline ne perd pas d'item** entre app kills (REQ-5) — test : enqueue → simulate kill (re-import) → load queue → item présent.
4. **Migration ne corrompt pas une family existante** (REQ-11) — test : single + family pré-existants → family inchangée + single deleted.
5. **`LIGHTNING_ENABLED === false` → AUCUN appel réseau** (Constraint feature flag) — test : mock fetch, vérifier 0 calls quand flag off.

### Branche feat/lightning-farm — invariant non-mergé sur main

Pas un test unitaire mais un check de release :
- Avant tout `/ship` ou push : `git branch --show-current` doit être `feat/lightning-farm` (jamais merger en main).
- Si CI : ajouter un check qui empêche un push direct vers main si des fichiers `lib/lightning/*` ou `app/lightning-*` sont touchés (à discuter avec user, hors scope Phase 53).

## Sources

### Primary (HIGH confidence)
- Local codebase `/Users/gabrielwaltio/Documents/family-vault/lib/lightning/*` — tous les fichiers du module lu intégralement (types.ts, lnbits-client.ts, biometric-gate.ts, family-credentials.ts, credentials.ts, feature-flag.ts, index.ts)
- Local codebase `/Users/gabrielwaltio/Documents/family-vault/hooks/useVaultTasks.ts` et `hooks/useVault.ts:780-850` — pattern subscribeTaskComplete vérifié
- Local codebase `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/53-lightning-family-wallet/{SPEC,CONTEXT,UI-SPEC,DISCUSSION-LOG}.md` — sources verrouillées par discuss-phase et spec-phase
- Local codebase `/Users/gabrielwaltio/Documents/family-vault/.planning/spikes/{MANIFEST,001,003,004}/README.md` — historique spike validé
- Local `/Users/gabrielwaltio/Documents/family-vault/package.json` — versions deps vérifiées
- Local `/Users/gabrielwaltio/Documents/family-vault/CLAUDE.md` — conventions projet

### Secondary (MEDIUM confidence — cited via WebFetch / WebSearch)
- [Expo Camera Documentation (SDK 54)](https://docs.expo.dev/versions/latest/sdk/camera/) — installation, permissions iOS, CameraView + barcodeScannerSettings
- [Expo NetInfo](https://docs.expo.dev/versions/latest/sdk/netinfo/) — autolinking SDK 54, NetInfo.addEventListener
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) — limite 2048 bytes / clé iOS Keychain
- [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/) — disableDeviceFallback per-call
- [LNbits payment_api.py source](https://github.com/lnbits/lnbits/blob/main/lnbits/core/views/payment_api.py) — POST /api/v1/payments accepte `out`, `amount`, `unit`, `memo`, `bolt11`, `extra`, pas de dédoublonnage natif
- [expo-barcode-scanner → expo-camera migration](https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md) — expo-barcode-scanner DEPRECATED

### Tertiary (LOW confidence — single source, requires validation)
- LNbits Swagger docs `https://demo.lnbits.com/docs` — non-fetchable directement (Swagger UI dynamique), inférée depuis le source code Python LNbits
- Discussion AsyncStorage vs SecureStore pour audit log — basée sur le raisonnement architectural, pas un précédent direct dans le projet (audit log = nouveau besoin Phase 53)

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — tous les packages vérifiés contre `package.json`, versions confirmées Expo SDK 54
- Architecture : HIGH — patterns existants (Phase 40 widget, Phase 46 Auberge) directement applicables, code source du listener lu intégralement
- Pitfalls : HIGH (Pitfalls 1, 2, 3, 5, 6, 7, 8, 9, 10) et MEDIUM (Pitfall 4) — la plupart sont vérifiés contre le code source ou des précédents Phase 40 documentés dans STATE.md
- Environment availability : HIGH — checks `package.json` et `lib/scheduled-notifications.ts` confirmant les présences/absences
- Validation architecture : HIGH — strategie Jest aligned avec patterns Phase 38/39 (tests purs avant UI)

**Critical gaps requiring user input or discuss-phase confirmation:**
- Open Question #1 (SecureStore vs AsyncStorage pour audit log) — bloquant si AsyncStorage refused car SecureStore 2 KB cap insuffisant
- Open Question #2 (NetInfo vs AppState fallback) — non-bloquant mais dégrade UX edge case si AppState seul
- Environment Availability — `expo-camera` à installer (ou descope scan QR)

**Research date:** 2026-05-18
**Valid until:** 2026-07-17 (60 jours — stable pour le module Lightning ; à re-vérifier si Expo SDK 55 sort, si LNbits API change, ou si Apple modifie 3.1.5 review guideline)
