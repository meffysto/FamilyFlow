# Phase 54: Monétisation hybride — infrastructure de paiement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 54-monetisation-hybride-paiement
**Areas discussed:** RevenueCat vs StoreKit, Grandfathering existants, Cap free tier 3 histoires, Paywall triggers & gate, Périmètre produits

---

## RevenueCat vs StoreKit

| Option | Description | Selected |
|--------|-------------|----------|
| RevenueCat (recommandé) | react-native-purchases. Gère lifetime + consommable + restore + sandbox. Moins de code critique. Phone-home limité aux events d'achat. Free tier large. | ✓ |
| StoreKit 2 / expo-iap pur | Zéro tiers, cohérence privacy totale. Reçus/restore/consommables/sandbox à gérer soi-même — plus de surface de bug. | |
| Tu décides | — | |

**User's choice:** RevenueCat
**Notes:** Le phone-home ne concerne que les transactions, jamais le vault — l'argument « vos souvenirs ne quittent jamais votre téléphone » reste vrai. RevenueCat = source de vérité du statut d'achat.

---

## Grandfathering existants

| Option | Description | Selected |
|--------|-------------|----------|
| Grandfather complet (recommandé) | Installs antérieures à la version payante gardent premium gratuit à vie. Paywall uniquement pour les nouveaux. Zéro backlash. | ✓ |
| Aucun grandfather | Tout le monde passe au paywall. Revenu max mais risque de 1-étoiles. | |
| Grandfather partiel | Épargne seulement certaines features déjà utilisées. Plus juste, plus complexe. | |
| Tu décides | — | |

**User's choice:** Grandfather complet

### Détection « pré-payant » (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Présence de données vault (recommandé) | Au 1er lancement payant, si vault contient du contenu préexistant → flag grandfather persistant. Suit l'iCloud. | ✓ |
| Flag SecureStore au 1er boot | Simple mais perdu à la réinstall. | |
| Combinaison vault + flag | vault OU pref + flag persisté dans le vault. Plus robuste, plus de code. | |
| Tu décides | — | |

**User's choice:** Présence de données vault
**Notes:** Flag persisté dans le vault pour survivre à la réinstall via iCloud. Le grandfather ne contourne pas la règle d'or IA (cap histoires maintenu).

---

## Cap free tier 3 histoires

### Stockage compteur + solde crédits

| Option | Description | Selected |
|--------|-------------|----------|
| Vault (recommandé) | Compteur + solde dans un fichier vault. Suit iCloud, survit réinstall, synchro famille. RevenueCat = statut achat. | ✓ |
| SecureStore | Local chiffré. Perdu à la réinstall, non synchro. | |
| Tu décides | — | |

**User's choice:** Vault

### Reset du cap

| Option | Description | Selected |
|--------|-------------|----------|
| Mois calendaire (recommandé) | Reset le 1er du mois. Lisible « 3/mois ». | ✓ |
| Glissant 30 jours | Plus juste mais opaque. | |
| Tu décides | — | |

**User's choice:** Mois calendaire

### Comptage du quota

| Option | Description | Selected |
|--------|-------------|----------|
| Génération uniquement (recommandé) | Seule une nouvelle génération IA compte. Relecture MP3 cache gratuite illimitée. | ✓ |
| Toute lecture | Chaque écoute compte. Punit la relecture. | |
| Tu décides | — | |

**User's choice:** Génération uniquement

---

## Paywall : triggers & gate

### Déclencheurs

| Option | Description | Selected |
|--------|-------------|----------|
| Contextuel au point de friction (recommandé) | Après 3e histoire ou tap feature premium verrouillée. Jamais d'interstitiel au lancement. | ✓ |
| Contextuel + bandeaux doux | Idem + bandeaux discrets dismissibles. | |
| Tu décides | — | |

**User's choice:** Contextuel au point de friction (sans bandeaux)

### Profondeur de gate

| Option | Description | Selected |
|--------|-------------|----------|
| Aperçu + CTA (recommandé) | Écran premium en aperçu (montre la valeur) + CTA paywall. Plus de travail UI. | ✓ |
| Hard gate direct | Tap → paywall immédiat. Simple, montre moins la valeur. | |
| Tu décides | — | |

**User's choice:** Aperçu + CTA (hard gate où l'aperçu n'a pas de sens)

---

## Périmètre produits

| Option | Description | Selected |
|--------|-------------|----------|
| 2 produits verrouillés (recommandé) | Lifetime 29,99 € + Pack Histoires 4,99 €/30. Archi extensible pour l'abo plus tard. | ✓ |
| + Abo Histoires | Ajoute aussi l'abonnement (3,99/mois · 24,99/an) dès cette phase. | |
| Tu décides | — | |

**User's choice:** 2 produits verrouillés

---

## Claude's Discretion

- Affichage des prix via price strings localisées RevenueCat (jamais hardcodé).
- Structure exacte de `lib/entitlements/` et du fichier vault crédits/quota.
- DA précise du paywall (pageSheet + drag-to-dismiss + useThemeColors() obligatoires).
- Fallback Haiku/TTS local si quota API atteint (optionnel).

## Deferred Ideas

- Abo Histoires (3,99 €/mois · 24,99 €/an) — phase offres.
- Variante tout-en-un 39,99 €.
- Offres saisonnières, bundles, récupération churn — Phase C.
- Impression livre à l'acte (Lulu).
- Nouvelles features premium IA (voix clonées, scan tickets, suggestions recettes IA, prép RDV IA).
