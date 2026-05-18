# Phase 53: Lightning Family Wallet — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Brancher un pay-out 100 sats automatique sur chaque complétion de tâche d'un membre famille ayant un sub-wallet configuré (attribution par mentions @ avec fallback `activeProfile`), exposer la cagnotte via un bouton ⚡ dans le HUD ferme + écran dédié `/lightning-wallet` (balance, audit, encaissement out par bolt11/QR), implémenter les 3 modes de déclenchement (instant / daily-review / hybrid), le plafond quotidien, la queue offline, l'audit log 90j, la migration single→family, et le cleanup des playgrounds spike — le tout derrière `LIGHTNING_ENABLED` off par défaut, branche `feat/lightning-farm` isolée, jamais mergée sur `main` sans validation App Store explicite.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `53-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `53-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Listener Lightning sur `taskCompleteListenersRef` (intégration non-intrusive dans `VaultProvider`)
- Fonction d'attribution `resolveRecipient` + unit tests
- 3 modes de déclenchement (instant / daily-review / hybrid) + écran « Pay-outs en attente » pour validation parent
- Plafond quotidien par membre, configurable, par défaut 1000 sats
- Queue offline JSON SecureStore + retry au foreground + reachability listener
- Audit log SecureStore 90j glissants + bouton effacer
- Carte cagnotte dans la ferme (conditionnelle au profil actif + wallet configuré)
- Écran `/lightning-wallet` (balance, historique, bouton encaisser)
- Encaissement out via paste bolt11 + scan QR (caméra)
- Admin key par sub-wallet membre (optionnelle, gated FaceID)
- Migration auto config single → family
- Cleanup playgrounds + renommage `Child*` → `Member*` + suppression `credentials.ts` single
- Notification locale parent agrégée (1/jour max) quand plafond atteint ou pay-out failed après retry max
- Section Réglages → Labo conservée comme point d'entrée unique de configuration

**Out of scope (from SPEC.md):**
- LNURL-withdraw (pull-style encaissement) — version 2
- Provisioning automatique des sub-wallets via LNbits User Manager API
- Push notifications cross-device pour les pay-outs
- Conversion fiat (€/$/sats) — affichage en sats uniquement
- Multi-instance LNbits (1 famille = N instances)
- Édition des `xpOverride` sats personnalisés par tâche — version 2
- Conversion de la « feuille » ferme en sats — design séparé
- Promotion de la feature hors de Labo — décision App Store explicite requise
- Merge vers `main` — branche isolée tant que posture App Store pas validée

</spec_lock>

<decisions>
## Implementation Decisions

### UX cagnotte dans la ferme (HUD)

- **D-01 :** **Placement = bouton tappable ⚡ dans le HUD top** de `app/(tabs)/tree.tsx` (zone ligne ~3508-3525), à côté de 📖 codex et 📷 screenshot. Même style `styles.hudCodexButton`, même emoji-only treatment (pas de balance affichée dans le HUD).
- **D-02 :** **Visibilité conditionnelle** : le bouton n'apparaît QUE si `LIGHTNING_ENABLED === true` ET `activeProfile.id ∈ memberWallets`. Conforme SPEC #8 (acceptance « profil sans wallet → invisible »). Pas de bouton mort, pas de modal éducative pour les profils non-configurés.
- **D-03 :** **Tap → navigation vers `/lightning-wallet`** (écran défini SPEC #9). Pas de balance inline dans le HUD — l'utilisateur tape pour voir détail.
- **D-04 :** **Feedback pay-out reçu (app au foreground) = toast + pulse**. Quand un pay-out arrive (listener émet `payout-success`), afficher un toast éphémère `+100 sats ⚡` (style cohérent avec `HarvestCardToast` existant, lib `contexts/ToastContext`) ET déclencher un pulse animation sur le bouton HUD (scale 1→1.2→1 + glow via `withSpring`/`withTiming`, ~600ms). Haptic `Haptics.impactAsync('Light')`.
- **D-05 :** **Refresh strategy balance = event-driven, pas de polling**. La balance affichée dans `/lightning-wallet` (et utilisée pour le pulse logic) refresh dans deux cas : (a) immédiatement après chaque pay-out local validé via le listener, (b) sur `AppState` transition vers `'active'` (foreground). Aucun polling périodique — économique réseau et conforme aux contraintes offline-first.

### UX mode validation parent (daily-review + hybrid)

- **D-06 :** **Accès à l'écran « Pay-outs en attente » = Réglages → Labo → Lightning**. Bouton « Pay-outs en attente (N) » ajouté dans `components/settings/SettingsLightning.tsx`, juste sous les options de config famille, visible uniquement si la queue de validation contient au moins 1 item. Conforme à la posture App Store-safe (feature reste cachée dans Labo).
- **D-07 :** **Pas de notif locale 20h pour ouvrir la queue** (décision implicite par sélection D-06 sans option « combinaison ») — le parent va chercher dans Settings quand il a un moment. À reconsidérer en version 2 si UX feedback le demande.
- **D-08 :** **Validation = batch tout-en-un avec 1 FaceID**. Liste verticale des items en attente (taskTitle, profileDisplayName, sats, timestamp), un seul bouton bas pleine largeur « Valider les N pay-outs (N×100 sats) ». 1 seul prompt FaceID au tap → boucle interne `for…of` qui appelle `payInvoice` séquentiellement pour chaque item. Pas de validation par item, pas de sélection partielle, pas de swipe — UX simple et rapide.
- **D-09 :** **Comportement en cas d'échec mid-batch = transparent per item**. Si un pay-out N échoue dans la boucle batch, les items 1→N-1 déjà payés sortent de la queue (audit log `paid` per item), les items N→fin restent dans la queue avec `attemptCount++` (audit log `queued` per item). Toast résumé en fin de batch : `X/Y pay-outs réussis · N en attente de retry`. Le retry se fait automatiquement au prochain foreground app + reachability change (logique SPEC #5 partagée avec la queue offline). Cohérent avec la finalité Lightning (pas de rollback) et conforme SPEC #5.
- **D-10 :** **Notifs locales parent = expo-notifications + agrégation max 1/jour**. Canal `expo-notifications` (déjà utilisé dans le projet pour rappels tâches/RDV). Agrégation : une seule notif/jour maximum, qui regroupe les événements de la journée (« Plafond atteint pour Lucas · 1 pay-out en attente · 0 failed »). Wording chaleureux et factuel, pas de promotion sats. **Silencieuse pendant 9h-16h** (heures école — éviter de notifier pendant qu'on travaille). Timestamp de dernière notif stocké dans SecureStore pour le cap 1/jour.

### Claude's Discretion (delegated to planner / researcher)

- **Architecture du listener Lightning** : implémenter comme un 3ᵉ `subscribeTaskComplete` dans `hooks/useVault.ts` (pattern établi par Phase 40 widget refresh ligne 795-807, et Phase 46 Auberge ligne 837-845) OU comme un hook domaine dédié `hooks/useVaultLightning.ts`. Planner tranche selon analyse du couplage. Préférence faible pour le pattern subscribe direct (moindre divergence avec l'existant).
- **Structure SecureStore queue + audit log** : 2 clés distinctes (`lightning_payout_queue_v1`, `lightning_audit_v1`) ou 1 clé consolidée. Tester la limite SecureStore iOS (~2KB par item) avec 90j × 4 membres × ~3 entrées/jour = ~1080 entrées audit. Si dépassement, partitionner par mois ou compresser.
- **Mutex / lock concurrent** : deux toggles rapides simultanés ne doivent pas double-trigger un pay-out (idempotence par `taskId+date`, SPEC #6). Planner décide entre lock in-memory simple (Promise queue) vs vérif idempotence atomique avant chaque pay-out.
- **Renommage `Child*` → `Member*`** : codemod atomique en 1 commit (rename + update tous les imports). Conservation backward-compat lecture du JSON SecureStore : le parser `loadFamilyConfig` accepte `children: [...]` ET `members: [...]` à la lecture, mais écrit toujours `members: [...]`. Migration silencieuse au prochain `saveFamilyConfig`.
- **Cleanup playgrounds** : suppression `app/lightning-spike.tsx`, `app/lightning-family-spike.tsx`, `lib/lightning/credentials.ts` en un seul commit final de la phase (après que tout le reste fonctionne). Retirer aussi les 2 liens « Ouvrir l'écran de test » dans `SettingsLightning.tsx`.
- **Migration single→family au boot** : exécutée dans un effect bootstrap dans `VaultProvider` (ou `AuthProvider` — planner décide), silencieuse (pas de toast/modal — l'utilisateur ne doit pas voir l'opération). Idempotente : si déjà migré, no-op. Log `__DEV__` only.
- **Scan QR pour encaissement out** : réutiliser `expo-camera` (déjà dans le projet pour OCR recettes). Modal plein écran avec cadre de scan, fallback paste bolt11 textarea.
- **i18n FR strict** : tous les libellés, toasts, alerts, notifs en français. Suivre les conventions CLAUDE.md (langue UI = français).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 53 — Specifications locked
- `.planning/phases/53-lightning-family-wallet/53-SPEC.md` — **MUST READ FIRST.** 12 requirements + 17 acceptance criteria + boundaries + constraints. Locked via `/gsd-spec-phase`, ambiguity score 0.16.

### Spike validation (background)
- `.planning/spikes/MANIFEST.md` — Convention BYO + decisions actées (1 tâche = 100 sats, invoice key vs admin key, feature flag, branche dédiée)
- `.planning/spikes/001-lnbits-end-to-end/README.md` — Validates LNbits REST client (`/api/v1/wallet`, `/api/v1/payments`, `/api/v1/payments/:hash`). Status: ✓ VALIDATED.
- `.planning/spikes/002-settings-labo-flag/README.md` — Validates feature flag posture (off par défaut, build prod safe). Status: ✓ VALIDATED.
- `.planning/spikes/003-appstore-posture/README.md` — **CRITICAL** posture App Store : feature reste en Labo, sats uniquement (pas de fiat = pas de 3.1.5(iii) exchange rule), branche isolée. Status: ⚠ PARTIAL — décision release juridique à prendre avant merge.
- `.planning/spikes/004-family-multi-wallet/README.md` — Validates le modèle multi-wallet (1 famille + N sub-wallets membres, admin keys séparées, FaceID gate). Status: PENDING (test manuel requis — Phase 53 va le valider en construisant la vraie feature).

### Lightning module (existant à étendre — branche `feat/lightning-farm`)
- `lib/lightning/index.ts` — Barrel des exports publics
- `lib/lightning/types.ts` — `LnbitsConfig`, `FamilyLightningConfig`, `ChildWalletMapping` (à renommer `MemberWalletMapping`), `WalletInfo`, `LnbitsError`. **À étendre** : `triggerMode`, `dailyCapPerMember`, `MemberWalletMapping.adminKey?`.
- `lib/lightning/lnbits-client.ts` — Client REST avec `getWallet`, `createInvoice`, `payInvoice` (admin key override), `getPaymentStatus`. Réutilisable tel quel.
- `lib/lightning/family-credentials.ts` — `loadFamilyConfig` / `saveFamilyConfig` / `clearFamilyConfig` via expo-secure-store sous clé `lightning_family_config_v1`. **À étendre** : ajouter champs config trigger + cap, accepter lecture backward-compat `children` puis migrer vers `members`.
- `lib/lightning/credentials.ts` — Single-wallet legacy. **À SUPPRIMER** après migration auto (SPEC #11 + #12).
- `lib/lightning/biometric-gate.ts` — `authenticatePayOut({ reason, allowDevicePasscode })` — FaceID/TouchID via `expo-local-authentication`. Réutilisable tel quel pour validation batch + encaissement out.
- `lib/lightning/feature-flag.ts` — `isLightningEnabled` / `setLightningEnabled` via SecureStore sous `lightning_enabled_v1`. Réutilisable tel quel.

### Intégration tâches (point d'attache du listener)
- `hooks/useVaultTasks.ts:54,76-125,331` — `subscribeTaskComplete(listener)` exposé. Fire sur transition `false→true` uniquement (un-check ignoré). Pattern fire-and-forget, errors caught en `__DEV__`.
- `hooks/useVault.ts:198,597,790-807,837-845,2759` — Pattern de souscription existant. Phase 40 (widget refresh) ligne 795-807, Phase 46 (Auberge tick) ligne 837-845. Phase 53 ajoute le 3ᵉ subscriber Lightning.
- `lib/types.ts` (Task type) — Champs pertinents : `mentions: string[]` (extrait `@user`), `targetProfileId` (missions secrètes), `recurrence`, `completed`, `completedDate`. Pas de `completedBy` → l'attribution se fait par mentions + fallback `activeProfile`.

### UI ferme (point d'ancrage du bouton HUD)
- `app/(tabs)/tree.tsx:3470-3526` — Layout du HUD ferme. Le bouton ⚡ s'insère ligne ~3508-3525 (entre 📖 codex et 📷 screenshot), style `styles.hudCodexButton` à dupliquer.
- `app/(tabs)/tree.tsx` (general) — Animations Reanimated 4 (sharedValues, withSpring/withTiming), pattern à suivre pour le pulse animation D-04.

### Settings (point d'entrée config + queue validation)
- `components/settings/SettingsLightning.tsx` — UI Réglages → Labo. **À étendre** : ajouter section config trigger mode + dailyCap + entrée « Pay-outs en attente (N) » conditionnelle. **À nettoyer** : retirer les 2 liens vers playgrounds spike.

### Conventions projet
- `CLAUDE.md` (root) — Stack, conventions FR, animations Reanimated, paths quotés, format date, modals pageSheet, etc.
- `.planning/PROJECT.md` — Constraints projet (offline-first, stack RN+Expo, vault Markdown, stabilité App Store).

### Patterns réutilisables
- `contexts/ToastContext.tsx` — Provider pour les toasts éphémères (style `HarvestCardToast`).
- `components/HarvestCardToast.tsx` (si existant — vérifier path exact) — Style de toast à imiter pour `+100 sats ⚡`.
- `expo-notifications` (déjà installé) — Pour notif locale parent agrégée 1/jour (D-10).
- `expo-camera` (déjà installé pour OCR recettes) — Pour scan QR bolt11.
- `expo-clipboard` (déjà installé pour QR Phase 50) — Pour paste bolt11.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `LnbitsClient` (lib/lightning/lnbits-client.ts) : client REST complet, supporte `payInvoice(bolt11, adminKey)` — utilisable directement pour pay-out famille → membre et membre → externe.
- `authenticatePayOut` (lib/lightning/biometric-gate.ts) : déjà gère le `disableDeviceFallback`, le bypass `__DEV__`, et retourne un `AuthGateResult` avec error codes — utilisable pour les 2 gates FaceID (validation batch + encaissement out).
- `subscribeTaskComplete` pattern (hooks/useVault.ts ligne 795-807 et 837-845) : 2 subscribers existent déjà (Phase 40 widget, Phase 46 Auberge). Phase 53 ajoute le 3ᵉ — pattern bien établi, fire-and-forget, errors caught silently.
- `expo-secure-store` : déjà utilisé pour creds Lightning, feature flag, et autres prefs. Pas de surprise.
- `expo-notifications` : déjà utilisé pour rappels tâches/RDV (vérifier exemples dans `lib/` ou `hooks/`). Réutilisable pour notif parent agrégée.
- `expo-camera` : déjà utilisé pour OCR recettes (cf. quick-260410-rie). Réutilisable pour scan QR bolt11.
- `expo-clipboard` : déjà ajouté Phase 50 pour QR audio deep links. Réutilisable pour paste bolt11.
- `Haptics` (expo-haptics) : conventions CLAUDE.md — `Haptics.selectionAsync()` (D-04 pulse), `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` (D-08 batch success).

### Established Patterns

- **Listener subscribe via ref + useEffect dans VaultProvider** : pattern décrit dans useVaultTasks.ts ligne 70-75 (commentaire). Phase 53 réutilise sans déviation.
- **Animations Reanimated 4** : `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming`. Spring configs comme constante module (cf. CLAUDE.md section Animations).
- **Couleurs via `useThemeColors()`** : JAMAIS de hardcoded (#FFFFFF). Le bouton HUD ⚡ doit suivre cette règle.
- **i18n FR strict** : libellés via i18next (déjà en place). Nouveau namespace possible : `lightning` (toasts, alerts, instructions).
- **Modals pageSheet + drag-to-dismiss** : convention CLAUDE.md pour les modals (cf. encaissement out, validation batch).
- **`console.warn`/`console.error` sous `if (__DEV__)`** : convention obligatoire (cf. CLAUDE.md).
- **Errors non-critiques silencieuses** : `catch { /* Lightning — non-critical, vault domain unaffected */ }` — la ferme ne doit JAMAIS être impactée par une erreur Lightning.

### Integration Points

- **Listener Lightning dans `useVault.ts`** : nouveau `useEffect` ajouté entre l'existant Phase 46 (ligne ~845) et le bloc backup gamiData (ligne ~847). Souscrit à `tasksHook.subscribeTaskComplete` et appelle `processTaskCompletionForLightning(task, { profiles, activeProfileId, familyConfig })`.
- **Bouton HUD ⚡ dans `tree.tsx`** : insertion dans `hudContent` ligne ~3508-3525, après screenshot 📷. Conditionnel sur `LIGHTNING_ENABLED && activeProfile.id ∈ memberWallets`.
- **Section queue dans `SettingsLightning.tsx`** : nouveau bloc UI affichant `Pay-outs en attente (N)` conditionnel sur queue non vide, tap → modal/route validation batch.
- **Migration single→family au boot** : effect bootstrap dans `VaultProvider` ou hook dédié `useLightningMigration`. Idempotent. Silent.
- **AppState listener pour refresh balance + retry queue** : pattern déjà utilisé dans le projet (cf. autres hooks/contexts). Phase 53 ajoute une callback dans son init.

</code_context>

<specifics>
## Specific Ideas

- Le bouton HUD ⚡ doit avoir le **même look** que 📖 codex et 📷 screenshot — pas de glow permanent, pas de couleur accent particulière, juste l'emoji dans la même `hudCodexButton` style. Le glow/pulse n'apparaît QUE temporairement après un pay-out (D-04).
- Toast `+100 sats ⚡` : wording exact à valider mais doit rester **factuel et chaleureux**, pas promotionnel. Éviter « Bravo ! », « Tu as gagné ! », « Récompense ! » — préférer un format calme aligné avec le ton FamilyFlow.
- Validation batch : le bouton « Valider les N pay-outs » doit afficher le total en sats (ex: « Valider 3 pay-outs (300 sats) ») pour que le parent sache à quoi il s'engage AVANT FaceID.
- Notif parent agrégée : doit ressembler à un récap calme de fin de journée, pas à une alerte. Exemple cible : « Lumière Lightning · 2 pay-outs validés, plafond atteint pour Lucas · 1 en attente ».

</specifics>

<deferred>
## Deferred Ideas

- **Notif locale 20h pour ouvrir la queue de validation** — discutée puis non retenue (D-07). À reconsidérer en v2 si UX feedback indique que le parent oublie de vérifier la queue.
- **Badge numérique sur app icon iOS** — discuté en alternative à la notif, non retenu. Possible v2.
- **Validation par item (swipe / checkboxes)** — discutée en alternative, non retenue pour MVP. Si feedback indique besoin de granularité (ex: refuser un pay-out spécifique), à ajouter v2.
- **LNURL-withdraw, multi-instance LNbits, fiat conversion, xpOverride par tâche, transformation feuille→sats** — déjà listés Out of Scope dans SPEC.md (héritage).

</deferred>

---

*Phase: 53-lightning-family-wallet*
*Context gathered: 2026-05-18*
