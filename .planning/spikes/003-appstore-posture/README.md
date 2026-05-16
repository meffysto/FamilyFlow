---
spike: 003
name: appstore-posture
type: research
validates: "Documente la posture App Store du wallet Lightning (BYO LNbits, non-custodial vis-à-vis du dev) au regard du Guideline 3.1.5 et donne une checklist de ce qui peut/doit/ne doit pas figurer dans la metadata"
verdict: PARTIAL
related: [001, 002]
tags: [research, appstore, compliance, legal]
---

# Spike 003 — App Store Posture & Metadata Checklist

## What This Validates

> **Given** une feature Lightning Wallet où FamilyFlow est cliente d'une instance LNbits que l'utilisateur héberge (BYO, posture "remote-node client" type Zeus / BlueWallet remote node / Phoenix),
> **when** on soumet à l'App Review,
> **then** :
> - On sait quelle guideline s'applique (3.1.5(i) wallet vs 3.1.5(ii) mining vs 3.1.5(iii)/(iv) exchange/ICO).
> - On a une posture de défense écrite si Apple challenge.
> - On a une checklist de ce qu'il faut / ne faut pas dire dans la metadata, la description App Store, les screenshots.

## Findings

### Guideline 3.1.5(i) — Wallets

Texte officiel (App Store Review Guidelines, version en vigueur 05/2026) :

> **(i) Wallets**: Apps may facilitate virtual currency storage, provided they are offered by developers enrolled as an organization.

**Interprétation pour FamilyFlow** :
- FamilyFlow ne **stocke** aucune cryptocurrency. C'est l'instance LNbits de l'utilisateur qui détient la garde. L'app est un **client REST**, pas un wallet custodial.
- Le compte développeur d'Apple doit être **Organization** (pas Individual) pour ne serait-ce que toucher au sujet. **À vérifier** : statut actuel du compte de publication FamilyFlow.

### Guideline 3.1.5(ii) — Mining

> **(ii) Mining**: Apps may not mine for cryptocurrencies unless the processing is performed off device.

Non applicable — pas de mining côté FamilyFlow.

### Guideline 3.1.5(iii) — Exchanges

> **(iii) Exchanges**: Apps may facilitate transactions or transmissions of cryptocurrency on an approved exchange, provided they are offered only in countries or regions where the app has appropriate licensing and permissions.

**Risque ici** : Apple peut considérer que "convertir feuilles en sats" est une forme de "facilitate transactions". La feature actuelle du spike (générer une invoice 100 sats) est de la **réception** simple, pas de l'échange. Mais si l'évolution prévue inclut une conversion explicite "feuilles → sats", on bascule dans cette catégorie.

**Mitigation possible** :
- Cadrer la feature comme « ton wallet, tes sats, on n'organise aucun échange ».
- Ne pas afficher de taux de conversion fiat ($, €) — uniquement sats.
- Pas de feature d'achat de sats in-app.

### Guideline 3.1.5(iv) — Initial Coin Offerings, Cryptocurrency Futures Trading

Non applicable.

### Précédents apps comparables

| App | Modèle | App Store ? | Note |
|-----|--------|-------------|------|
| **Zeus** | Remote LND node client | ✅ Oui | Posture "tu fournis ton node, on est juste un client" — la plus proche de notre cas |
| **BlueWallet** | Multi-wallet (HD + remote LndHub) | ✅ Oui | BlueWallet a un mode LndHub similaire à LNbits |
| **Phoenix** | Self-custodial mobile LSP | ✅ Oui | Non-custodial natif, plus complexe |
| **Wallet of Satoshi** | Fully custodial | ✅ Oui | Custodial mais avec license |
| **Bitcoin Beach** | LNbits-based community | ✅ Oui (régional) | Précédent direct LNbits |

**Précédent direct** : Zeus est l'analog le plus proche. Le fait que Zeus est sur l'App Store depuis des années valide la posture "client de node remote" comme acceptable.

### Posture de défense pour FamilyFlow

Si Apple challenge :

1. **« FamilyFlow ne stocke pas de cryptocurrency »**
   - L'app est un client REST d'un service tiers (LNbits) que l'utilisateur héberge lui-même.
   - Aucune clé privée n'est générée ni stockée par l'app.
   - L'utilisateur fournit explicitement URL + API key d'un service dont il a la garde.

2. **« La feature est opt-in, en Labo, derrière un flag désactivé par défaut »**
   - Pas mise en avant dans l'onboarding, les screenshots App Store, le tagline.
   - Accessible uniquement via Réglages → Labo (3 niveaux de navigation).
   - Toggle off par défaut, refuse l'activation sans configuration manuelle.

3. **« Pas d'échange, pas de mining, pas d'achat in-app »**
   - Pas de conversion fiat affichée.
   - Pas de tutoriel "comment acheter des sats".
   - Pas de fonctionnalité de paiement out (admin key non sollicitée).

4. **« Précédent : Zeus, BlueWallet (mode LndHub), Bitcoin Beach »**
   - Tous présents sur l'App Store avec le même modèle "client d'un node remote".

## Checklist Metadata App Store

### Description / What's New
- [ ] **NE PAS** mentionner "Bitcoin", "Lightning", "wallet", "crypto" dans la description principale tant que la feature est en Labo.
- [ ] **NE PAS** mettre de screenshot du wallet ou de l'écran lightning-spike dans l'App Store.
- [ ] **NE PAS** prendre un screenshot ferme qui inclut "encaisser en sats".
- [ ] La feature reste **invisible** depuis l'onboarding et les CTA principaux.

### Privacy / Data Collection
- [ ] Mettre à jour le manifeste de privacy : aucune collecte de données crypto, tout reste local (SecureStore).
- [ ] Préciser que les communications réseau se font vers une URL fournie par l'utilisateur (pas de serveur FamilyFlow).

### Compte développeur
- [ ] Vérifier que le compte de publication est en statut **Organization** (pas Individual). Bloquant pour 3.1.5(i).

### Code / Comportement
- [ ] Pas d'analytics envoyé hors de l'instance LNbits de l'utilisateur.
- [ ] Pas de tracking d'usage de la feature dans des SDK tiers.
- [ ] Bouton "désinstaller / effacer les clés" facile d'accès.

## Risques résiduels

1. **Apple peut quand même refuser** — la review est subjective. Le pire scénario : on retire la feature avant submission ou on la laisse derrière un mécanisme d'activation server-side (remote feature flag).
2. **Évolution "feuilles → sats" = bascule 3.1.5(iii)** — si on implémente une vraie conversion programmatique, on entre potentiellement dans le périmètre exchange. À refaire passer en review (003-bis ou nouveau spike).
3. **TestFlight** — la feature reste utilisable en TestFlight sans souci (moins regardant que App Store public).

## Decision

**Recommandation pour ce spike** :
- Garder le code sur la branche `feat/lightning-farm`.
- **Ne pas merger sur `main` ni inclure dans une release App Store** tant que la posture n'est pas validée avec un expert App Store / juridique.
- Possible chemin de release : **TestFlight uniquement** dans un premier temps, ou **build interne dev-client** seulement.
- Si on décide de ship un jour : checklist ci-dessus + soumission précédée d'un avis pré-review Apple via le canal "App Store Connect Resolution Center".

## Results

**Verdict : PARTIAL** — la posture technique est défendable (cf. précédent Zeus), mais la décision de release reste à prendre par l'utilisateur après consultation experte. Aucun blocage technique pour le **spike en branche**.

### À investiguer ensuite

- [ ] Vérifier le statut Organization du compte développeur FamilyFlow.
- [ ] Demander un avis App Store Connect Resolution avant submission.
- [ ] Si feature évolue vers "feuilles → sats", rouvrir un spike 003-bis pour clarifier la posture exchange.

## Sources

- [App Store Review Guidelines — Apple Developer](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Crypto Wallet Approval Requirements — gipresearch](https://gipresearch.com/patent-attorney/apple-app-store-crypto-wallet-approval-requirements/)
- [Apple cryptocurrency App Store rules update — AppleInsider](https://appleinsider.com/articles/22/10/24/apple-has-new-app-store-rules-for-nfts-and-cryptocurrency)
- [App Store Review Guideline updates — Apple Developer News](https://developer.apple.com/news/?id=xk8d7p8c)
