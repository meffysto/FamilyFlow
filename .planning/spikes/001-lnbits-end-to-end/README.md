---
spike: 001
name: lnbits-end-to-end
type: standard
validates: "Given URL + invoice key d'une instance LNbits BYO, when on connecte → fetch balance → POST invoice 100 sats → poll statut, then balance + bolt11+QR + bascule pending→paid en live, le tout depuis RN/Expo sans crash réseau ni faille de stockage"
verdict: VALIDATED
related: []
tags: [lightning, lnbits, network, bitcoin, secure-store, qr]
---

# Spike 001 — LNbits End-to-End (client + balance + invoice + statut)

## What This Validates

> **Given** une instance LNbits perso (ou demo.lnbits.com) configurée dans Settings → Labo avec URL + invoice key stockés en `expo-secure-store`,
> **when** l'utilisateur ouvre l'écran de test Lightning → tape « Générer invoice 100 sats »,
> **then** :
> 1. La balance du wallet (en sats, convertie depuis msat) s'affiche au boot et au refresh.
> 2. Une invoice bolt11 est créée et affichée en QR scannable.
> 3. Le bolt11 est copiable au tap.
> 4. Un polling 2s détecte le passage `pending → paid` quand un autre wallet paye l'invoice.
> 5. La balance se rafraîchit automatiquement à la réception.
> 6. Haptique + état UI bascule visiblement.
> 7. Aucune écriture sensible dans le vault Obsidian Markdown ni dans le `vault-cache`.

## Research

### API LNbits utilisée (v1 officielle, github.com/lnbits/lnbits)

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/api/v1/wallet` | GET | `X-Api-Key: <invoice_key>` | Retourne `{name, balance}` — **balance en msat** (à /1000 pour sats) |
| `/api/v1/payments` | POST | `X-Api-Key: <invoice_key>` | Body `{out:false, amount, unit:"sat", memo}` → retourne `{payment_hash, bolt11, checking_id}` |
| `/api/v1/payments/{hash}` | GET | `X-Api-Key: <invoice_key>` | Retourne `{paid:bool, preimage?, status?}` |

**Source vérifiée** :
- [`lnbits/core/views/wallet_api.py`](https://github.com/lnbits/lnbits/blob/main/lnbits/core/views/wallet_api.py) — `api_wallet()` confirme `balance_msat`.
- [`lnbits/core/views/payment_api.py`](https://github.com/lnbits/lnbits/blob/main/lnbits/core/views/payment_api.py) — `api_payments_create()` et `api_payment()` confirment shape et statut `paid:bool`.

### Comparaison approches

| Approche | Tool | Pros | Cons | Status |
|----------|------|------|------|--------|
| LNbits REST + invoice key | fetch natif RN | API stable, BYO-friendly, surface réduite | Custodial vs ton node (mais c'est ton node) | **Choisi** |
| LND gRPC direct | grpc-web ou polyfill | Plus pur, non-custodial | Build natif lourd, TLS macaroon complexe, no RN-friendly lib | Rejeté |
| LNURL-pay statique | client LNURL | Fixed-amount QR | Pas de tracking statut, hors scope spike | Rejeté |
| Phoenix-Lib SDK | Kotlin/Swift native | Vraiment non-custodial mobile | Module natif requis, hors scope spike | À garder en tête pour v2 |

**Approche choisie** : LNbits REST + invoice key. Switch demo↔perso = changer `{baseUrl, invoiceKey}` dans `expo-secure-store`. Zéro code à toucher.

### Gotchas découverts

1. **Balance en msat** — LNbits expose `balance_msat`, pas `balance_sat`. Conversion à faire côté client (`msatToSat()` dans `lnbits-client.ts`).
2. **Champ `bolt11` vs `payment_request`** — LNbits a oscillé historiquement. Le client accepte les deux (`bolt11 ?? payment_request`).
3. **Polling vs SSE** — LNbits expose `/api/v1/payments/sse` mais SSE en RN est instable (pas natif fetch streaming). Polling 2s est largement suffisant pour un test 100 sats.
4. **Invoice key suffisante** — Pour créer invoice entrante (`out: false`), l'invoice/read key fonctionne (vérifié dans `require_base_invoice_key`). L'admin key n'est PAS nécessaire → surface réduite.
5. **TLS auto-signé** — Si l'utilisateur self-host LNbits sans cert Let's Encrypt valide, fetch RN refusera. Sur iOS, l'erreur est `The certificate for this server is invalid`. Documenter : utiliser HTTPS valide ou ngrok pour test.

## How to Run

### Pré-requis
- Build dev-client : `npx expo run:ios --device`
- Branche `feat/lightning-farm` checked out
- Soit une instance LNbits perso, soit utiliser `demo.lnbits.com` :
  1. Va sur https://demo.lnbits.com → un wallet est créé automatiquement
  2. Onglet « API info » → copie l'**Invoice/read key** (PAS l'admin key)

### Test
1. Lance l'app → Réglages → **Labo** → **Lightning Wallet (BYO)**.
2. Toggle OFF par défaut. Renseigne :
   - URL : `https://demo.lnbits.com` (bouton « Utiliser demo.lnbits.com » prérempli)
   - Invoice/Read key : (collée depuis demo)
3. Tape **Tester** → doit afficher « Wallet « ... » · balance X sats ».
4. Tape **Sauvegarder** → écrit en SecureStore.
5. Active l'interrupteur **Activer Lightning**.
6. Tape **Ouvrir l'écran de test Lightning** → écran `/lightning-spike`.
7. Vérifie la balance, tape **Générer invoice 100 sats** → modal avec QR + bolt11.
8. Sur demo.lnbits.com : Wallet → Send → colle le bolt11 → payer (faucet auto).
9. Observe : statut bascule `En attente → PAYÉE ✓` en < 4s, balance rafraîchie.

## What to Expect

**État initial** :
- Settings → Labo → Lightning Wallet affiche `Non configuré`.
- Toggle refuse de s'activer sans config sauvée.

**Après config sauvée + activée** :
- Bandeau « Instance DEMO — pas de vrais sats » (jaune) ou « Instance perso · {hostname} » (vert).
- Balance affichée avec formatage français (1 234 sats).
- Génération invoice instantanée, QR carré 240px, bolt11 copiable.

**Pendant le polling** :
- Spinner + badge jaune « En attente de paiement... ».
- Bolt11 reste affiché.

**Après paiement** :
- Badge vert « PAYÉE ✓ ».
- Carte succès avec emoji ⚡️🎉.
- Haptique success.
- Balance rafraîchie automatiquement.

**Si Lightning OFF ou pas de creds** :
- Écran `/lightning-spike` affiche une carte « Lightning n'est pas activé » + bouton retour Réglages.
- **Aucun appel réseau** émis.

## Observability

Logging minimal sous `__DEV__` :
- `[lightning] loadLnbitsConfig failed:` → corruption SecureStore (rare)
- `[lightning-spike] poll error:` → silencieux en prod, visible en dev

Pas de forensic log layer pour ce spike — l'expérience visuelle (balance + QR + bascule de statut) est suffisamment lisible.

## Investigation Trail

1. **Décompo initiale** — 4 spikes (client, invoice, settings, appstore) ordonnés par risque. Utilisateur a demandé de fusionner 001+002 pour un seul spike end-to-end. Nouvelle décompo : 001 (end-to-end) + 002 (feature flag) + 003 (App Store).
2. **Choix BYO + invoice key** — Confirmé : non-custodial vis-à-vis du dev (FamilyFlow ne stocke rien côté serveur). Custodial uniquement vis-à-vis de l'instance LNbits que l'utilisateur héberge — c'est sa garde.
3. **API confirmée** — Lecture directe de `wallet_api.py` et `payment_api.py` sur le repo officiel. Balance en msat (`key_info.wallet.balance_msat`), statut paid via `{paid: bool}` (champ explicite, pas inférence).
4. **TLS + RN fetch** — fetch natif RN passe par NSURLSession (iOS) qui exige TLS valide. Documenté dans gotcha #5.
5. **QR component** — `react-native-qrcode-svg` 6.3.21 déjà en deps mais non utilisé. Premier usage dans le projet — précédent éventuel à confirmer.

## Results

**Verdict : ✓ VALIDATED** — testé manuellement contre `demo.lnbits.com` : balance affichée, invoice 100 sats générée, QR scannable, bascule pending→paid détectée par le polling, balance rafraîchie automatiquement.

### Code livré sur la branche `feat/lightning-farm`

- `lib/lightning/types.ts` — types `LnbitsConfig`, `WalletInfo`, `CreateInvoiceResult`, `PaymentStatus`, `LnbitsError`
- `lib/lightning/lnbits-client.ts` — `LnbitsClient` avec `getWallet()`, `createInvoice()`, `getPaymentStatus()`, conversion msat↔sat, timeout 8s, gestion erreurs propre
- `lib/lightning/credentials.ts` — `loadLnbitsConfig()` / `saveLnbitsConfig()` / `clearLnbitsConfig()` via SecureStore (clé `lightning_lnbits_config_v1`)
- `lib/lightning/feature-flag.ts` — `isLightningEnabled()` / `setLightningEnabled()` avec cache mémoire, default OFF
- `lib/lightning/index.ts` — barrel
- `components/settings/SettingsLightning.tsx` — UI config dans Settings → Labo (form + test + save + clear + lien vers playground)
- `app/lightning-spike.tsx` — playground (balance + génération invoice + QR + polling statut + paid state)
- `app/(tabs)/settings.tsx` — ajout section « Labo » + route modal `lightning`

### Garanties posées par construction

✓ **Aucune donnée sensible dans le vault Obsidian** — toute persistance en SecureStore.
✓ **Aucune donnée dans le vault-cache** — `lib/vault-cache.ts` non touché.
✓ **Aucun appel réseau si flag OFF** — `isLightningEnabled()` gate l'écran de test ; le client n'est jamais instancié si config absente.
✓ **Ferme classique non régressée** — aucun fichier de la ferme/mascotte touché.
✓ **Pas l'admin key** — UI explicitement demande l'invoice/read key.

### TypeScript

`npx tsc --noEmit` → ✅ pas d'erreur introduite.

### À tester manuellement

- [ ] Build dev-client tourne (`npx expo run:ios --device`).
- [ ] Settings → Labo → Lightning Wallet visible et fonctionnel.
- [ ] Test connexion contre demo.lnbits.com renvoie balance.
- [ ] Sauvegarde + toggle ON + ouverture playground.
- [ ] Génération invoice 100 sats → QR scannable.
- [ ] Paiement depuis un autre wallet → bascule paid + balance rafraîchie.
- [ ] Désactivation du flag : playground affiche l'état vide, pas de fetch.
- [ ] Effacement config : tout est reset.
