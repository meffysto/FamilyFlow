---
spike: 004
name: family-multi-wallet
type: standard
validates: "Given un wallet famille parent (admin key) + N sub-wallets enfants (invoice key) crées manuellement dans LNbits, when l'app simule une tâche complétée par X, then 100 sats sont automatiquement payés depuis le wallet famille vers le wallet de X (FaceID gated), les balances rafraîchies en live, et l'admin key ne quitte jamais SecureStore"
verdict: PENDING
related: [001, 003]
tags: [lightning, lnbits, multi-wallet, family, biometric, pay-out, admin-key]
---

# Spike 004 — Wallet famille + Sub-wallets enfants + Pay-out auto

## What This Validates

> **Given** :
> - 1 wallet « Famille » dans LNbits avec admin key + invoice key.
> - N wallets « Enfant » dans LNbits, chacun avec son invoice key.
> - Une configuration stockée en SecureStore qui mappe `profileId → childInvoiceKey`.
>
> **when** le parent tape « Tâche complétée → +100 sats » à côté d'un enfant,
>
> **then** :
> 1. FaceID/TouchID s'affiche pour autoriser le pay-out.
> 2. L'app crée une invoice 100 sats sur le wallet de l'enfant (invoice key).
> 3. L'app paye cette invoice depuis le wallet famille (admin key).
> 4. Les deux balances sont rafraîchies dans la même UI.
> 5. L'admin key famille ne quitte jamais SecureStore (utilisée uniquement dans `payInvoice`).
> 6. Les enfants n'ont aucune admin key dans l'app — par construction, impossible d'envoyer depuis leur wallet.

## Research

### API LNbits utilisée pour le pay-out

| Endpoint | Méthode | Auth | Body | Notes |
|----------|---------|------|------|-------|
| `/api/v1/payments` (in) | POST | `X-Api-Key: <child_invoice_key>` | `{out:false, amount:100, unit:"sat", memo:"..."}` | Crée invoice sur le wallet enfant |
| `/api/v1/payments` (out) | POST | `X-Api-Key: <family_admin_key>` | `{out:true, bolt11:"lnbc..."}` | Paye depuis le wallet famille |

**Validation source** : `lnbits/core/views/payment_api.py`, fonction `api_payments_create()`. Confirmation que `out:true` exige `KeyType.admin` (`if invoice_data.out is True and key_info.key_type == KeyType.admin`).

### User Manager API — pas retenu

Tentative initiale : utiliser `POST /users/api/v1/user/{user_id}/wallet` pour créer les sub-wallets programmatiquement. Abandonné car :
1. L'endpoint exige `check_admin` = super-user de l'instance LNbits (pas la wallet admin key). demo.lnbits.com ne donne pas ce niveau d'accès.
2. Workflow utilisateur plus naturel : le parent crée les wallets dans l'UI LNbits (clic « + NEW WALLET »), copie l'invoice key, la colle dans l'app. 2 clics par enfant, pas de complexité d'auth super-user.

### Gate biométrique

Utilise `expo-local-authentication` (déjà en deps via AuthContext). Pattern :
```ts
await LocalAuthentication.authenticateAsync({
  promptMessage: `Verser ${amount} sats à ${child.name} ?`,
  cancelLabel: 'Annuler',
  disableDeviceFallback: true, // pas de fallback passcode (un mineur pourrait connaître le PIN)
});
```

En `__DEV__` (simulateur, pas de FaceID), on accepte par défaut pour ne pas bloquer le test.

### Trade-off admin key

L'admin key famille = pouvoir vider tout le wallet. Mitigations en place dans le spike :
- ✅ Stockée en SecureStore (chiffré système).
- ✅ Jamais dans le vault Markdown ni le vault-cache.
- ✅ Passée explicitement à `payInvoice()` — le client n'est pas instancié avec.
- ✅ Gate FaceID systématique avant chaque pay-out.
- ⚠️ Hors scope spike (à implémenter en phase planifiée) :
  - **Plafond quotidien** (« max 1000 sats/jour, alerte au-delà »).
  - **Batching** (option : un seul pay-out le soir qui solde la journée).
  - **Cooldown anti-bouton-cliqué-15x**.
  - **Audit log** local des pay-outs (pour vérifier après coup).

## How to Run

### Pré-requis
- Branche `feat/lightning-farm` checked out.
- Build dev-client : `npx expo run:ios --device`.
- Spike 001 testé OK (single-wallet end-to-end validé).

### Setup LNbits (5 min)
1. Va sur https://demo.lnbits.com → un wallet par défaut est créé (« My wallet »).
2. **Renomme-le « Famille »** : tape sur le nom → édite. Note **Admin key** + **Invoice key**.
3. En haut à gauche, dropdown → **+ NEW WALLET** → nomme-le « Lucas » (ou n'importe quoi). Note son **Invoice key** uniquement.
4. Recommence pour « Emma ». Note son Invoice key.
5. Pour avoir des sats dans le wallet famille : Wallet famille → « Receive » → 5000 sats → utilise la faucet demo (LNbits Demo Hub) pour le payer, ou un autre wallet LN.

### Test dans l'app
1. Réglages → **Labo** → **Lightning Wallet (BYO)** → vérifie que Lightning est activé (sinon repasse par spike 001).
2. Tape **« Mode famille (multi-wallet) »** → tu arrives sur `/lightning-family-spike`.
3. **« Configurer la famille »** :
   - URL : `https://demo.lnbits.com`
   - Nom : `Famille`
   - Invoice key famille : (collée)
   - Admin key famille : (collée)
   - **Tester la connexion** → doit afficher la balance famille.
4. Pour chaque profil enfant éligible dans la liste : tape `+`, colle l'invoice key, **Ajouter ce wallet**.
5. **Sauver**.
6. Tu vois maintenant : carte wallet famille avec balance, et 1 carte par enfant configuré.
7. Tape **« Tâche complétée → +100 sats »** sur un enfant :
   - FaceID se déclenche (ou skip auto en simulateur).
   - Balance famille décrémente de 100.
   - Balance enfant incrémente de 100.
   - Haptique success.

## What to Expect

**Setup vide** :
- Carte « Aucune configuration famille » avec bouton « Configurer la famille ».
- Le modal de setup propose les profils existants du vault (avatar + nom).
- Les profils déjà mappés à un wallet sont absents de la liste « Ajouter un enfant ».

**Setup OK, pas d'enfants** :
- Carte famille avec balance affichée.
- Section enfants vide avec invitation à les ajouter.

**Setup OK, N enfants** :
- Carte famille en haut.
- 1 carte par enfant avec balance + bouton de pay-out.
- Bouton « Modifier la config » + bouton « Effacer » en bas.

**Pendant pay-out** :
- FaceID prompt.
- Bouton désactivé + label « Pay-out... ».
- Si annulé : alerte (sauf user_cancel silencieux).
- Si erreur LNbits : alerte avec message.

**Après pay-out réussi** :
- Haptique success.
- Balance famille décrémentée de 100 + petit fee LN (~0-1 sat sur demo, comptabilisé par LNbits).
- Balance enfant incrémentée de 100.

## Observability

Logs sous `__DEV__` :
- `[lightning] biometric unavailable — hasHardware= ... enrolled= ...`
- `[lightning] biometric error: ...`
- `[lightning] loadFamilyConfig failed: ...`

Pas de forensic log dédié pour ce spike — les balances live et l'alerte d'erreur sont la trace de vérité.

## Investigation Trail

1. **Premier réflexe : User Manager API** pour créer les sub-wallets programmatiquement. Lecture du code (`user_api.py`) montre `check_admin` requis = super-user de l'instance. Pas adapté au BYO sur demo.lnbits.com.
2. **Pivot : création manuelle des wallets** dans LNbits UI, app consomme les keys. Plus BYO-friendly, plus simple, marche sur n'importe quelle instance.
3. **Choix : 1 base URL partagée + N keys**. Tous les wallets dans la même instance LNbits, distinguées par leur X-Api-Key uniquement. Pas besoin de stocker N URLs.
4. **Admin key isolée** : le client est instancié avec l'invoice key par défaut. `payInvoice()` accepte l'admin key en paramètre explicite — surface réduite, plus dur de la fuiter par accident.
5. **FaceID en `__DEV__`** : bypass auto sinon le simulateur bloque. Documenté.

## Results

**Verdict : PENDING — nécessite test manuel** (l'utilisateur doit créer 3 wallets dans demo.lnbits.com + tester le flow).

### Code livré sur la branche `feat/lightning-farm`

- `lib/lightning/types.ts` — types `FamilyLightningConfig`, `ChildWalletMapping`.
- `lib/lightning/lnbits-client.ts` — méthode `payInvoice(bolt11, adminKey)` avec admin key isolée.
- `lib/lightning/biometric-gate.ts` — `authenticatePayOut()` via expo-local-authentication, bypass dev.
- `lib/lightning/family-credentials.ts` — `loadFamilyConfig` / `saveFamilyConfig` / `clearFamilyConfig` (SecureStore, clé `lightning_family_config_v1`).
- `lib/lightning/index.ts` — barrel mis à jour.
- `app/lightning-family-spike.tsx` — playground complet (setup modal + cartes balance + boutons pay-out FaceID gated).
- `components/settings/SettingsLightning.tsx` — second lien « Mode famille (multi-wallet) ».

### Garanties posées par construction

✓ **Admin key famille en SecureStore seulement** — jamais en clair côté UI affichée.
✓ **Pas d'admin key enfant** — par design impossible d'envoyer depuis un wallet enfant via l'app.
✓ **FaceID systématique** avant chaque pay-out.
✓ **1 URL partagée** — toute la famille est dans la même instance LNbits.
✓ **Pas de mass action** — chaque pay-out est un bouton dédié, pas de bulk-pay.

### À tester manuellement

- [ ] Création 3 wallets dans demo.lnbits.com (Famille + 2 enfants).
- [ ] Setup modal sauvegarde correctement, test connexion famille OK.
- [ ] Ajout de profils enfants depuis la liste vault.
- [ ] Affichage parallèle des 3 balances.
- [ ] Pay-out → FaceID prompt → succès → balances rafraîchies.
- [ ] Annuler FaceID → pay-out skippé, pas d'erreur visible.
- [ ] Effacer la config → modal vidé, retour à l'empty state.
