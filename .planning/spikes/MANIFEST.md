# Spike Manifest

## Idea

Intégrer un wallet Bitcoin Lightning **non-custodial vis-à-vis du dev** dans FamilyFlow via **LNbits BYO** (l'utilisateur fournit URL d'instance + invoice key). Objectif test : permettre dans la ferme une option où les « feuilles » (récompenses) peuvent devenir des satoshis réels via Lightning. Ce spike valide la faisabilité technique (client REST depuis RN/Expo, génération d'invoice end-to-end, intégration propre derrière un feature flag) **avant** de décider d'investir dans une feature complète.

## Requirements

Décisions actées qui contraignent le build futur :

- **BYO LNbits** : l'app est cliente d'une instance LNbits que l'utilisateur héberge (ou de demo.lnbits.com pour test). Aucune instance hébergée par le dev.
- **Switchable demo ↔ perso** : `{baseUrl, invoiceKey}` en config → changer ces deux valeurs suffit, zéro code à toucher.
- **Stockage credentials** : `expo-secure-store` uniquement. **Jamais** dans le vault Obsidian Markdown.
- **Feature flag `LIGHTNING_ENABLED`** : off par défaut, build prod ne ship pas la feature tant que le flag dev n'est pas validé.
- **Offline-first respecté** : la ferme classique doit rester 100 % fonctionnelle sans réseau et sans creds LN. Aucun appel LN si flag off.
- **API officielle** : github.com/lnbits/lnbits, endpoints REST v1 (`/api/v1/wallet`, `/api/v1/payments`, `/api/v1/payments/:hash`).
- **Invoice key, pas admin key** : le spike utilise la clé read+invoice (lecture balance + génération invoice), jamais l'admin key — minimise la surface de risque en cas de fuite.
- **Branche dédiée** : `feat/lightning-farm`. Pas de merge dans `main` tant que tous les spikes ne sont pas verts ET App Store tranché.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | lnbits-end-to-end | standard | Given URL+invoice key, when connect→balance→invoice 100 sats→poll statut, then balance + bolt11+QR + bascule pending→paid en live | ✓ VALIDATED | lightning, lnbits, network, qr, secure-store |
| 002 | settings-labo-flag | standard | Given LIGHTNING_ENABLED off, when relance app, then ferme 100% offline + zéro appel LN ; on → form connexion + test | ✓ VALIDATED (par construction) | feature-flag, settings, ui |
| 003 | appstore-posture | research | Documente posture "remote-node client" (cf. Zeus, BlueWallet, Phoenix) + checklist metadata App Store | ⚠ PARTIAL (technique OK, décision release à prendre) | research, appstore, compliance |
