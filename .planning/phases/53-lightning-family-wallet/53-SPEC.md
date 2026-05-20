# Phase 53: Lightning Family Wallet — Specification

**Created:** 2026-05-18
**Ambiguity score:** 0.16 (gate: ≤ 0.20)
**Requirements:** 12 locked

## Goal

Une **tâche complétée par un membre de la famille** (enfant, ado ou adulte, à condition qu'il ait un sub-wallet LNbits configuré) déclenche un **pay-out automatique de 100 sats** depuis le wallet famille (trésorerie LNbits BYO) vers le sub-wallet du membre, sous trois modes configurables (instant / validation parent quotidienne / hybride), avec plafond quotidien anti-abus, queue offline, audit log local glissant sur 90 jours, et UX cagnotte visible dans la ferme avec encaissement vers wallet externe par bolt11/QR. La feature reste dans **Réglages → Labo** (feature flag off par défaut, App Store-safe, jamais mergée sur main sans validation explicite).

## Background

**État actuel** (branche `feat/lightning-farm`, 4 spikes validés) :

- `lib/lightning/` — module complet : `LnbitsClient` (REST), `credentials.ts` (single-wallet), `family-credentials.ts` (multi-wallet), `feature-flag.ts`, `biometric-gate.ts` (FaceID).
- `app/lightning-spike.tsx` + `app/lightning-family-spike.tsx` — playgrounds de spike, à supprimer à l'intégration.
- `components/settings/SettingsLightning.tsx` — UI Réglages → Labo avec config + 2 liens vers playgrounds.
- Système de tâches : `hooks/useVaultTasks.ts:90-128` expose `taskCompleteListenersRef` qui fire sur transition `false→true` (utilisé par Phase 40 gamification XP). C'est le hook d'intégration.
- Modèle Task : `mentions: string[]` (extrait des @user), `targetProfileId` (missions secrètes uniquement), `recurrence`, `completed`, `completedDate`.
- Pas de champ `completedBy` dans Task — l'attribution se fera par mentions + fallback `activeProfile`.

**Manque à construire** :
- Trigger pay-out branché sur `taskCompleteListenersRef`.
- Logique d'attribution (mentions → activeProfile) + résolution profileId → memberWallet.
- 3 modes de déclenchement (instant / validation quotidienne / hybride) configurables.
- Plafond quotidien par membre.
- Queue offline + retry.
- Audit log SecureStore 90j glissants.
- Carte cagnotte dans la ferme (visible si le profil a un wallet).
- Écran détail cagnotte + historique + encaissement out (paste bolt11 ou scan QR).
- Migration config single-wallet → family au boot.
- Cleanup : suppression playgrounds + `credentials.ts` (single-wallet).
- Renommage interne `Child*` → `Member*` (l'attribution n'est pas réservée aux enfants).

## Requirements

1. **Trigger sur completion de tâche** : un membre avec un sub-wallet configuré qui complète une tâche déclenche un pay-out 100 sats.
   - Current : `taskCompleteListenersRef` fire à chaque toggle false→true, mais aucun listener Lightning enregistré.
   - Target : un listener Lightning est attaché dans `VaultProvider`. Quand une tâche bascule completed, il identifie le profil destinataire (mentions puis fallback activeProfile), vérifie les conditions (flag ON, wallet configuré pour ce profil, plafond non atteint, mode trigger), puis effectue le pay-out via `LnbitsClient.payInvoice()`.
   - Acceptance : test manuel — créer une tâche `@Lucas brush teeth` avec Lucas configuré comme wallet membre, la cocher → le sub-wallet Lucas reçoit 100 sats sans intervention parent (en mode Instant) ou apparaît dans la queue de validation (en mode quotidien).

2. **Attribution du destinataire** : 1 seule mention enfant ⇒ destinataire = ce profil. Aucune mention ⇒ destinataire = activeProfile si c'est un profil avec wallet configuré. Mentions multiples ou activeProfile sans wallet ⇒ skip + log debug.
   - Current : pas de logique d'attribution.
   - Target : fonction pure `resolveRecipient(task, profiles, memberWallets, activeProfileId)` retourne `profileId | null` avec règles strictes.
   - Acceptance : 6 unit tests couvrent : 1 mention enfant configuré → OK, 1 mention enfant non configuré → null, 0 mention + activeProfile configuré → OK, 0 mention + activeProfile non configuré → null, 2 mentions enfants configurés → null, 1 mention adulte avec wallet → OK.

3. **3 modes de déclenchement configurables** : Instant / Validation quotidienne / Hybride (instant si <= 100 sats cumulés/jour, validation parent au-delà).
   - Current : aucun mode.
   - Target : `FamilyLightningConfig.triggerMode: 'instant' | 'daily-review' | 'hybrid'` (default `'instant'`). Mode stocké dans SecureStore family config. Sélectionnable dans le setup famille.
   - Acceptance : changer le mode dans la config et compléter une tâche teste les 3 comportements : instant pay-out immédiat ; daily-review enqueue + visible dans écran « Pay-outs en attente » ; hybrid jusqu'à 100 sats instant puis bascule en queue.

4. **Plafond quotidien par membre** : 1000 sats/profil/jour par défaut, configurable 100–10000 dans le setup famille.
   - Current : pas de plafond.
   - Target : `FamilyLightningConfig.dailyCapPerMember: number` (default 1000). Calcul du cumul du jour depuis l'audit log (timezone locale, reset à 00:00). Si pay-out dépasse le plafond, skip silencieux + entrée audit log `status: 'capped'`. Notif locale au parent (1 par jour max, agrégée).
   - Acceptance : configurer plafond à 200 sats, cocher 3 tâches @Lucas dans la même journée → seules 2 fire le pay-out, la 3ème est `capped` dans l'audit, notif parent 1x.

5. **Queue offline + retry** : si réseau indisponible au pay-out, la transaction est enquêtée et retentée au retour réseau.
   - Current : `LnbitsClient` jette une `LnbitsError` réseau, aucune persistance.
   - Target : queue JSON dans SecureStore sous `lightning_payout_queue_v1`. Items : `{taskId, profileId, amountSats, attemptCount, lastError?, queuedAt}`. Retry au foreground app + sur reachability change. Cap 5 tentatives, ensuite `failed` + notif parent.
   - Acceptance : mode avion + cocher une tâche éligible → toast « En attente de réseau », item dans la queue. Rétablir réseau → pay-out effectif dans les 10s, queue vidée.

6. **Pas de rollback** : un toggle dé-validation après pay-out n'annule pas la transaction Lightning.
   - Current : N/A.
   - Target : si la tâche est dé-cochée après pay-out, l'audit log ajoute un événement `'task_undone_after_payout'` avec le `paymentHash` original. Re-cocher la même tâche ne re-déclenche PAS un nouveau pay-out (idempotence par `taskId` + `completedDate`).
   - Acceptance : compléter tâche → audit montre `paid`. Décocher → audit ajoute `undone`. Re-cocher même jour → pas de nouveau pay-out (skip + log `'already_paid_today'`).

7. **Audit log SecureStore glissant 90 jours** : historique persistant, rotation auto.
   - Current : aucun log.
   - Target : tableau JSON sous `lightning_audit_v1`. Entrée : `{ts: ISO, profileId, taskId, sats, status: 'paid'|'capped'|'queued'|'failed'|'undone'|'already_paid_today', paymentHash?, error?}`. Au boot et à chaque écriture, purge les entrées > 90 jours. Bouton « Effacer l'historique » dans l'écran détail wallet.
   - Acceptance : créer 3 entrées audit, avancer l'horloge système de 91 jours (test unitaire), rebooter l'app → seules les entrées récentes restent.

8. **Carte cagnotte dans la ferme** : visible uniquement pour le profil actif s'il a un wallet membre configuré.
   - Current : ferme n'affiche aucune info Lightning.
   - Target : carte sous la mascotte/arbre montrant « Ma cagnotte · N sats » + petit pictogramme ⚡️. Visible si `LIGHTNING_ENABLED && activeProfile.id ∈ memberWallets`. Tap → navigation vers `/lightning-wallet`.
   - Acceptance : profil sans wallet → carte invisible. Profil avec wallet → carte visible, balance live (refresh sur foreground app + après chaque pay-out).

9. **Écran détail wallet + encaissement out** : historique + bouton « Encaisser vers wallet externe ».
   - Current : pas d'écran utilisateur final (juste les playgrounds spike).
   - Target : route `/lightning-wallet` accessible depuis la carte ferme. Affiche balance + 10 dernières entrées audit log filtrées sur le profil actif. Bouton « Encaisser » → modal avec champ paste bolt11 + bouton scan QR (caméra). Sur confirmation → `payInvoice` depuis le sub-wallet du membre (admin key du membre — ⚠️ exception au modèle de base : voir Requirement 10).
   - Acceptance : compléter 3 tâches puis ouvrir l'écran wallet → balance et historique cohérents. Coller un bolt11 valide d'un wallet externe → confirmation + pay-out effectif + balance décrémentée + entrée audit `'cash_out'`.

10. **Admin key des sub-wallets pour l'encaissement out** : chaque membre a SON admin key stockée séparément (gate FaceID).
    - Current : sub-wallets stockés avec invoice key seulement (modèle spike — réception uniquement).
    - Target : `MemberWalletMapping.adminKey?: string` optionnel. Sans admin key, le membre peut recevoir mais pas encaisser out (« Encaisser » désactivé). Avec admin key, encaissement disponible derrière FaceID. Le parent décide au setup s'il fournit l'admin key d'un wallet membre.
    - Acceptance : configurer un wallet membre sans admin key → bouton « Encaisser » désactivé avec tooltip. Ajouter l'admin key plus tard → bouton actif, FaceID prompt, paiement effectif.

11. **Migration auto single-wallet → family au premier boot Phase 53** : zéro perte de donnée.
    - Current : 2 configs SecureStore coexistent (`lightning_lnbits_config_v1` et `lightning_family_config_v1`).
    - Target : au boot, si `lightning_lnbits_config_v1` présent et `lightning_family_config_v1` absent, on migre en créant une famille avec ce wallet en trésorerie (admin key inconnue → reste vide, à compléter manuellement). Puis on supprime la clé single. Idempotent.
    - Acceptance : démarrer avec uniquement la config single → après migration auto, family config existe avec baseUrl + family.invoiceKey hérités, 0 membres, family.adminKey vide. La clé single est supprimée.

12. **Cleanup spike playgrounds + renommage `Child*` → `Member*`** : code production-grade.
    - Current : `app/lightning-spike.tsx`, `app/lightning-family-spike.tsx`, `lib/lightning/credentials.ts` (single-wallet), types `ChildWalletMapping`.
    - Target : playgrounds supprimés. `credentials.ts` supprimé (consolidé sur `family-credentials.ts`). Types renommés `ChildWalletMapping` → `MemberWalletMapping`. Aucun usage de `Child*` dans le code Lightning.
    - Acceptance : `find app lib components -name "*lightning-spike*"` retourne vide. `grep "ChildWallet\|loadLnbitsConfig\|saveLnbitsConfig" lib/lightning components` retourne vide.

## Boundaries

**In scope:**

- Listener Lightning sur `taskCompleteListenersRef` (intégration non-intrusive dans `VaultProvider`).
- Fonction d'attribution `resolveRecipient` + unit tests.
- 3 modes de déclenchement (instant / daily-review / hybrid) + écran « Pay-outs en attente » pour validation parent.
- Plafond quotidien par membre, configurable, par défaut 1000 sats.
- Queue offline JSON SecureStore + retry au foreground + reachability listener.
- Audit log SecureStore 90j glissants + bouton effacer.
- Carte cagnotte dans la ferme (conditionnelle au profil actif + wallet configuré).
- Écran `/lightning-wallet` (balance, historique, bouton encaisser).
- Encaissement out via paste bolt11 + scan QR (caméra).
- Admin key par sub-wallet membre (optionnelle, gated FaceID).
- Migration auto config single → family.
- Cleanup playgrounds + renommage `Child*` → `Member*` + suppression `credentials.ts` single.
- Notification locale parent agrégée (1/jour max) quand plafond atteint ou pay-out failed après retry max.
- Section Réglages → Labo conservée comme point d'entrée unique de configuration.

**Out of scope:**

- LNURL-withdraw (pull-style encaissement) — version 2 ; le paste bolt11 + scan QR couvre le MVP.
- Provisioning automatique des sub-wallets via LNbits User Manager API — rejeté en spike 004 (requiert super-admin instance, pas BYO-friendly).
- Push notifications cross-device pour les pay-outs — les notifs locales suffisent.
- Conversion fiat (€/$/sats) — affichage en sats uniquement (cf. spike 003 App Store posture, évite 3.1.5(iii) exchange).
- Multi-instance LNbits (1 famille = N instances) — 1 instance unique partagée, modèle BYO standard.
- Édition des `xpOverride` sats personnalisés par tâche (ex: « cette tâche vaut 500 sats au lieu de 100 ») — version 2.
- Conversion de la « feuille » de la ferme en sats — design séparé non lié aux tâches, peut être traité ultérieurement.
- Promotion de la feature en dehors de la section Labo — décision App Store explicite requise (cf. spike 003).
- Merge vers `main` — la branche `feat/lightning-farm` reste isolée tant que la posture App Store n'est pas validée juridiquement.

## Constraints

- **Feature flag obligatoire** : `LIGHTNING_ENABLED` off par défaut. Aucun appel réseau LN ni listener actif tant que le flag est OFF.
- **SecureStore uniquement** : creds, queue, audit log. Jamais dans le vault Obsidian Markdown ni dans `lib/vault-cache.ts`.
- **Admin key famille jamais affichée en clair** : input `secureTextEntry`, jamais loggée même en `__DEV__`.
- **FaceID/TouchID obligatoire** avant chaque pay-out famille → membre ET membre → externe. `disableDeviceFallback: true` en prod (bypass dev en `__DEV__` documenté).
- **Offline-first ferme préservée** : si Lightning est OFF ou réseau down, la ferme, les tâches, et tout le reste fonctionnent identiquement à avant Phase 53. Aucune dépendance critique.
- **Branche `feat/lightning-farm`** : tout le code Phase 53 vit sur cette branche. Pas de merge vers `main` sans décision explicite documentée (cf. spike 003).
- **Plafonnage par construction** : un bug qui ferait dépasser le plafond doit être impossible — le check du plafond est in-process et atomic avant tout appel réseau de pay-out.
- **Idempotence** : un `taskId` payé un jour donné ne peut pas être re-payé dans la même journée, même si la tâche est dé-cochée puis re-cochée.
- **`npx tsc --noEmit` clean** sur la branche après chaque commit Phase 53.
- **Ferme non régressée** : la ferme actuelle (mascotte, plantes, jardin, expéditions, auberge, ferme classique) ne change pas. La carte cagnotte est un ajout conditionnel.

## Acceptance Criteria

- [ ] Compléter une tâche `@Lucas X` avec Lucas configuré + mode Instant → 100 sats au sub-wallet Lucas en < 5s.
- [ ] Compléter la même tâche après dé-coche → audit log montre `undone` puis `already_paid_today` ; pas de double pay-out.
- [ ] Mode `daily-review` : compléter 3 tâches → 0 pay-out immédiat, 3 items dans la queue de validation parent ; valider en batch → 3 pay-outs effectifs.
- [ ] Mode `hybrid` avec seuil 100 : 1ère tâche instant, 2ème tâche en queue (cumul jour ≥ 100).
- [ ] Plafond 200 sats configuré : 3ème tâche du jour est `capped`, audit log enregistre, notif parent agrégée 1x/jour.
- [ ] Mode avion + cocher tâche éligible → toast « en attente », queue contient 1 item. Rétablir réseau → pay-out effectif < 10s, queue vidée.
- [ ] Mention ambiguë (2 enfants mentionnés) → skip silencieux, audit log `attribution_failed`, aucun pay-out.
- [ ] Aucune mention + activeProfile sans wallet → skip silencieux.
- [ ] Audit log : créer 3 entrées, simuler 91 jours, reboot → seules les entrées récentes restent.
- [ ] Carte cagnotte ferme : profil sans wallet → invisible ; profil avec wallet → visible, balance live refresh sur foreground.
- [ ] `/lightning-wallet` : balance + historique 10 dernières entrées filtrées sur profil actif, bouton encaisser fonctionnel.
- [ ] Encaisser : coller bolt11 valide → FaceID → paiement effectif, balance décrémentée, entrée audit `cash_out`.
- [ ] Encaisser sans admin key membre : bouton désactivé avec tooltip explicatif.
- [ ] Migration : démarrer avec config single-wallet seule → après reboot Phase 53, family config créée, single key supprimée, données préservées.
- [ ] Cleanup : `find` ne trouve plus `lightning-spike*` files. `grep` ne trouve plus `ChildWallet*` ni `loadLnbitsConfig` dans `lib/lightning` ou `components`.
- [ ] `npx tsc --noEmit` clean.
- [ ] Désactiver `LIGHTNING_ENABLED` → ferme, tâches, gamification XP identiques à avant Phase 53 ; aucun listener Lightning actif (vérifiable par grep dans Sentry/console).

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                  |
|--------------------|-------|------|--------|--------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Mécanisme complet : attribution, trigger, plafond     |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | In/Out scope explicites, 9 items out of scope         |
| Constraint Clarity | 0.80  | 0.65 | ✓      | 9 contraintes durables verrouillées                   |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | 17 critères pass/fail                                  |
| **Ambiguity**      | 0.16  | ≤0.20| ✓      | Gate passé après 4 rounds                              |

## Interview Log

| Round | Perspective      | Question summary                              | Decision locked                                                   |
|-------|------------------|-----------------------------------------------|-------------------------------------------------------------------|
| 1     | Researcher       | Comment attribuer une tâche à un enfant ?    | `mentions` source primaire (mais voir round 2 pour fallback)      |
| 1     | Researcher       | Quand le pay-out se déclenche ?              | Configurable par famille : instant / daily-review / hybrid       |
| 1     | Researcher       | Comportement offline ?                        | Queue JSON SecureStore + retry au retour réseau                  |
| 2     | Simplifier       | Fallback si pas de mention ?                  | `activeProfile` si profil configuré (enfant OU adulte)            |
| 2     | Simplifier       | Plafond par défaut ?                          | 1000 sats/membre/jour, configurable 100–10000                    |
| 2     | Simplifier       | Rollback si dé-validation ?                  | Pas de rollback (LN final), audit log marque l'événement         |
| 3     | Boundary Keeper  | Où le destinataire voit sa cagnotte ?         | Carte dédiée dans la ferme + écran détail `/lightning-wallet`    |
| 3     | Boundary Keeper  | Encaissement out ?                            | Paste bolt11 + scan QR (in scope) — LNURL-withdraw (out of scope) |
| 3     | Boundary Keeper  | Sort des spike playgrounds ?                  | Supprimer à l'intégration + consolidation single→family          |
| 4     | Failure Analyst  | Quelles tâches éligibles ?                    | Toutes y compris récurrentes (plafond fait le travail)            |
| 4     | Failure Analyst  | Audit log persistence ?                       | SecureStore JSON 90j glissants, bouton effacer                   |
| 4     | Failure Analyst  | Migration des 2 configs SecureStore ?         | Migration auto au boot + suppression clé single                  |

---

*Phase: 53-lightning-family-wallet*
*Spec created: 2026-05-18*
*Next step: /gsd-discuss-phase 53 — décisions d'implémentation (où brancher le listener, structure de la queue, UX du modal validation parent, etc.)*
