# Phase 54 : Monétisation hybride — infrastructure de paiement - Research

**Recherché :** 2026-06-24
**Domaine :** In-app purchases (IAP) iOS · RevenueCat · Entitlements · Expo dev-client
**Confiance globale :** MEDIUM-HIGH (SDK RevenueCat vérifié via Context7 + docs officielles ; plugin Expo non-confirmé par source primaire — voir A1)

---

<user_constraints>
## Contraintes utilisateur (depuis CONTEXT.md)

### Décisions verrouillées

- **D-01 :** RevenueCat (`react-native-purchases`) comme brique d'achat — gère lifetime + consommable + restauration + sandbox.
- **D-02 :** Phone-home RevenueCat = events d'achat uniquement. Aucune donnée vault ne quitte l'appareil.
- **D-03 :** RevenueCat est la source de vérité du statut d'achat (entitlements). L'app ne réimplémente pas la validation des reçus.
- **D-04 :** Grandfather complet. Tout utilisateur avec données vault pré-existantes = accès premium core à vie. Paywall pour nouveaux utilisateurs seulement.
- **D-05 :** Détection grandfather par présence de données vault au premier lancement de la version payante. Flag persisté dans le vault (suit iCloud, survit réinstall). Posé une seule fois.
- **D-06 :** Grandfather = access features premium core (non-IA). Le cap 3 histoires/mois et les crédits IA restent actifs même pour un utilisateur grandfathered.
- **D-07 :** Compteur histoires + solde crédits IA stockés dans le vault (fichier frontmatter dédié). Pas dans SecureStore.
- **D-08 :** Reset du compteur au mois calendaire (1er du mois).
- **D-09 :** Seule une nouvelle génération IA décrémente le quota. La relecture d'un MP3 en cache est gratuite et illimitée.
- **D-10 :** Paywall contextuel au point de friction uniquement (après la 3e histoire du mois OU tap sur feature premium). Jamais d'interstitiel au lancement.
- **D-11 :** Écrans premium en mode aperçu + CTA quand raisonnable. Hard gate acceptable si aperçu n'a pas de sens.
- **D-12 :** 2 produits dans cette phase : lifetime 29,99 € (non-consommable) + Pack Histoires 4,99 €/30 crédits (consommable). Architecture extensible pour abonnement futur.
- **Règle d'or (invariant) :** L'IA se finance toujours elle-même. Jamais d'IA illimitée à perte.

### Discrétion de Claude

- Affichage des prix : toujours via les price strings localisées RevenueCat (jamais hardcodé).
- Structure exacte de `lib/entitlements/` et du fichier vault crédits/quota.
- DA précise du paywall : `pageSheet` + drag-to-dismiss + `useThemeColors()` obligatoires.
- Garde-fous coûts IA secondaires (fallback Haiku/TTS local) : optionnel.

### Idées reportées (HORS PÉRIMÈTRE)

- Abo Histoires (3,99 €/mois · 24,99 €/an) — Phase C stratégie.
- Variante tout-en-un 39,99 € — non retenue v1.
- Offres saisonnières, bundles, récupération de churn — Phase C.
- Nouvelles features premium IA (voix clonées, scan tickets, suggestions recettes, prép RDV).
- Fallback Haiku/TTS local si quota API atteint (optionnel, Discrétion).
</user_constraints>

---

## Résumé

Cette phase installe pour la première fois une couche de monétisation par-dessus une app iOS publiée (App Store, Team `AKMNXGVVGX`). Le modèle hybride est verrouillé : achat unique lifetime 29,99 € (non-consommable) + Pack Histoires 4,99 €/30 crédits (consommable). RevenueCat (`react-native-purchases` v10.4.0, la version latest au moment de la recherche) est le SDK IAP choisi ; il gère la validation des reçus, le sandbox StoreKit, la restauration, et expose les entitlements via `CustomerInfo`.

L'enjeu principal de planification est **l'intégration native sans casser le dev-client existant** : `react-native-purchases` est un module natif — il requiert un rebuild du dev-client après installation. La bonne nouvelle est que le projet utilise déjà un dev-client (PAS Expo Go), donc le chemin est clair : `npm install react-native-purchases`, ajouter le plugin dans `app.json`, puis `npx expo run:ios --device`.

Côté produit : RevenueCat ne décrémente PAS automatiquement les consommables — c'est l'app qui doit gérer le solde crédits (D-07). Le compteur vit dans le vault (fichier frontmatter dédié, pattern `parse*`/`serialize*`) pour suivre iCloud et survivre à une réinstallation.

**Recommandation principale :** Découper en 4 vagues séquentielles — (1) Installation native + produits ASC + sandbox, (2) `lib/entitlements/` + `EntitlementContext`, (3) Fichier vault crédits/quota + hook, (4) Paywall + feature gates.

---

## Carte des responsabilités architecturales

| Capacité | Tier principal | Tier secondaire | Rationale |
|----------|---------------|-----------------|-----------|
| Validation reçus IAP | Serveur RevenueCat | — | D-03 — ne pas réimplémenter |
| Statut d'achat (LIFETIME possédé ?) | RevenueCat SDK (`CustomerInfo`) | `EntitlementContext` (cache React) | Source unique de vérité |
| Solde crédits IA (compteur) | Vault iCloud (fichier frontmatter) | `EntitlementContext` (état React) | D-07 — suit iCloud, survit réinstall |
| Flag grandfather | Vault iCloud | `EntitlementContext` | D-05 — suit iCloud |
| Feature gating | `EntitlementContext` → wraps `AIContext` | Composants UI (mode aperçu) | Couche unique entre achats et features |
| Paywall UI | Composants (`components/paywalls/`) | `pageSheet` + `useThemeColors()` | Convention projet |
| Prix localisés | RevenueCat Offerings → `storeProduct.priceString` | — | Jamais hardcodé (CLAUDE.md) |

---

## Stack standard

### Core

| Bibliothèque | Version | Rôle | Pourquoi standard |
|--------------|---------|------|-------------------|
| `react-native-purchases` | 10.4.0 (latest) | SDK IAP — validation reçus, entitlements, sandbox | D-01 — RevenueCat est la source de vérité |
| `expo-secure-store` | déjà installé | Stockage clé API RevenueCat (côté app) | Déjà utilisé dans le projet (AuthContext, AIContext) |
| `gray-matter` | déjà installé | Frontmatter fichier vault quota/crédits | Déjà le standard du projet (lib/parser.ts) |

[VERIFIED: npm registry] `react-native-purchases@10.4.0` est la version `latest`.  
[VERIFIED: Context7 /revenuecat/react-native-purchases] Peer dependency : `react-native >= 0.73.0` (le projet est sur 0.81.5 — compatible).

### Support

| Bibliothèque | Version | Rôle | Quand utiliser |
|--------------|---------|------|----------------|
| `react-native-purchases-ui` | même version | Paywalls React Native (optionnel) | Uniquement si on veut les paywalls no-code RevenueCat — NON retenu (D-11 impose une DA custom chaleur maison) |

### Installation

```bash
npm install react-native-purchases@10.4.0
npx expo run:ios --device   # rebuild dev-client obligatoire
```

**Vérification version :**
```bash
npm view react-native-purchases version
# → 10.4.0 (vérifié 2026-06-24)
```

---

## Patterns d'architecture

### Diagramme de flux

```
Lancement app
     │
     ▼
EntitlementProvider (init)
     ├─► Purchases.configure({ apiKey })          ← RevenueCat SDK
     ├─► Purchases.getCustomerInfo()              ← statut achat (LIFETIME)
     ├─► vault.readFile('quota.md')               ← solde crédits + flag grandfather
     └─► setEntitlementState({ status, credits, isGrandfathered })
                │
                ▼
         useEntitlements()
                │
     ┌──────────┴───────────┐
     │                      │
 AIProvider              Écrans premium
 (wrappé par             (aperçu + CTA
  entitlement)            ou hard gate)
     │
     ▼
useAI().generateStory()
     ├─► [CHECK] status === 'LIFETIME' OU isGrandfathered → features core OK
     ├─► [CHECK] credits > 0 OU status === 'LIFETIME' (hors règle d'or) → génération OK
     ├─► décrémenter credits dans vault (écriture disque)
     └─► appeler API Anthropic
```

### Structure de fichiers recommandée

```
lib/entitlements/
  ├── index.ts              # barrel
  ├── types.ts              # EntitlementStatus, EntitlementState
  ├── entitlement-engine.ts # logique pure (testable Jest) : detectGrandfatherEligibility, shouldDecrement
  └── quota-parser.ts       # parse/serialize fichier vault quota (pattern lib/parser.ts)

contexts/
  └── EntitlementContext.tsx  # EntitlementProvider + useEntitlements()

components/paywalls/
  ├── PaywallModal.tsx       # pageSheet + drag-to-dismiss + useThemeColors()
  └── PremiumBanner.tsx      # bannière aperçu + CTA (pour mode aperçu D-11)
```

### Pattern 1 : Configuration RevenueCat

[VERIFIED: Context7 /revenuecat/react-native-purchases]

```typescript
// lib/entitlements/index.ts ou contexts/EntitlementContext.tsx (useEffect au mount)
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

export function configurePurchases() {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({
    apiKey: Platform.select({
      ios: process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '',
      default: 'test_',   // Expo Go fallback (non utilisé — dev-client obligatoire)
    }),
    // Pas d'appUserID — RevenueCat génère un ID anonyme
    // Ne jamais transmettre de données vault à RevenueCat (D-02)
  });
}
```

**Clé API iOS :** préfixe `appl_` (App Store Connect, Team `AKMNXGVVGX`).  
Stocker dans `EXPO_PUBLIC_RC_IOS_KEY` (variable d'environnement Expo, non secrète côté client).

### Pattern 2 : Lecture CustomerInfo + entitlement lifetime

[VERIFIED: Context7 /revenuecat/react-native-purchases]

```typescript
const customerInfo = await Purchases.getCustomerInfo();

// Lifetime = non-consommable → expirationDate === null dans l'entitlement
const hasLifetime = !!customerInfo.entitlements.active['familyflow_lifetime'];
// OU via nonSubscriptionTransactions si l'entitlement n'est pas configuré
const hasPurchased = customerInfo.nonSubscriptionTransactions.some(
  t => t.productIdentifier === 'familyflow_lifetime_v1'
);
```

**Point important :** Pour un non-consommable (lifetime), `PurchasesEntitlementInfo.expirationDate` est `null` et `willRenew` est `false`. `isActive` reste `true` indéfiniment. [VERIFIED: Context7 — champ `expirationDate: Date | null`]

### Pattern 3 : Restauration d'achats

[VERIFIED: Context7 /revenuecat/react-native-purchases]

```typescript
// Bouton "Restaurer mes achats" obligatoire Apple (règle App Store)
const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    // customerInfo contient le statut à jour — mettre à jour EntitlementContext
  } catch (e) {
    Alert.alert('Erreur', 'Impossible de restaurer les achats. Réessayez plus tard.');
  }
};
```

### Pattern 4 : Listener temps réel CustomerInfo

[VERIFIED: Context7 /revenuecat/react-native-purchases]

```typescript
useEffect(() => {
  const listener = Purchases.addCustomerInfoUpdateListener((info) => {
    // Mise à jour automatique après achat ou restauration
    updateEntitlementStatus(info);
  });
  return () => listener.remove();
}, []);
```

### Pattern 5 : Achat consommable (Pack Histoires)

[VERIFIED: Context7 /revenuecat/react-native-purchases]

```typescript
const buyStoryPack = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    const packPackage = offerings.current?.getPackage('story_pack_30');
    if (!packPackage) throw new Error('Produit indisponible');
    const { customerInfo } = await Purchases.purchasePackage(packPackage);
    // RevenueCat NE décrémente PAS les consommables automatiquement
    // → l'app doit enregistrer +30 crédits dans le vault (D-07)
    await addCreditsToVault(30);
  } catch (e: any) {
    if (e.code !== Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      Alert.alert('Erreur', "L'achat a échoué. Réessayez plus tard.");
    }
  }
};
```

**Point critique :** Les achats consommables iOS sont signalés comme "consommés" automatiquement par StoreKit après achat — RevenueCat reçoit l'event mais n'expose PAS de compteur de crédits. La source de vérité des crédits reste dans le vault (D-07). [ASSUMED — A2]

### Pattern 6 : Fichier vault quota (parse/serialize)

Pattern dérivé de `serializeGratitude` / `parseGratitude` dans `lib/parser.ts`.

```
# 09 - Entitlements/quota.md
---
grandfather: false
grandfather_detected_at: ""
story_credits: 0
story_used_this_month: 0
story_reset_month: "2026-06"
---
```

```typescript
// lib/entitlements/quota-parser.ts
import matter from 'gray-matter';

export interface QuotaData {
  grandfather: boolean;
  grandfatherDetectedAt: string;
  storyCredits: number;         // solde Pack Histoires (D-07)
  storyUsedThisMonth: number;   // histoires générées ce mois (D-08)
  storyResetMonth: string;      // "YYYY-MM" (D-08)
}

export function parseQuota(content: string): QuotaData {
  const { data } = matter(content);
  return {
    grandfather: data.grandfather === true,
    grandfatherDetectedAt: data.grandfather_detected_at ?? '',
    storyCredits: Number(data.story_credits) || 0,
    storyUsedThisMonth: Number(data.story_used_this_month) || 0,
    storyResetMonth: data.story_reset_month ?? '',
  };
}

export function serializeQuota(q: QuotaData): string {
  return matter.stringify('', {
    grandfather: q.grandfather,
    grandfather_detected_at: q.grandfatherDetectedAt,
    story_credits: q.storyCredits,
    story_used_this_month: q.storyUsedThisMonth,
    story_reset_month: q.storyResetMonth,
  });
}
```

### Pattern 7 : Détection grandfather (D-05)

```typescript
// lib/entitlements/entitlement-engine.ts
export function detectGrandfatherEligibility(vaultState: {
  tasks: unknown[];
  meals: unknown[];
  profiles: unknown[];
  memories: unknown[];
}): boolean {
  // Si au moins un domaine contient des données, l'utilisateur est pré-payant
  return (
    vaultState.tasks.length > 0 ||
    vaultState.meals.length > 0 ||
    vaultState.profiles.length > 0 ||
    vaultState.memories.length > 0
  );
}
```

**Risque faux positifs :** Un nouvel utilisateur qui crée une première tâche AVANT d'avoir vu le paywall pourrait être faussement grandfathered. Mitigation : détecter au premier lancement de la **version payante** (AppVersion bump), pas à chaque launch. Poser le flag exactement une fois et ne plus rejouer la détection. [ASSUMED — A3]

### Pattern 8 : Hiérarchie providers (app/_layout.tsx)

Hiérarchie actuelle vérifiée dans le code :
```
SafeAreaProvider > GestureHandlerRootView > VaultProvider > AuthProvider >
ThemeProvider > AIProvider > StoryVoiceProvider > HelpProvider >
ParentalControlsProvider > ToastProvider
```

**Placement recommandé pour `EntitlementProvider` :**

```
... > VaultProvider > AuthProvider > ThemeProvider >
EntitlementProvider >   ← ICI (après VaultProvider pour lire quota.md, avant AIProvider)
AIProvider >            ← AIProvider wrappé lit useEntitlements()
...
```

Raison : `EntitlementProvider` doit lire le vault (a besoin de `VaultProvider`) et doit être disponible AVANT `AIProvider` qui gate l'IA. [VERIFIED: code lu dans app/_layout.tsx + CONTEXT.md §code_context]

### Anti-patterns à éviter

- **Hardcoder les prix (« 29,99 € »)** : toujours utiliser `storeProduct.priceString` depuis RevenueCat — gère la localisation et les changements de prix automatiquement.
- **Stocker le statut d'achat dans SecureStore** : la source de vérité = RevenueCat + vault pour les crédits. SecureStore est volatile (réinstall sans iCloud).
- **Utiliser Expo Go pour tester les achats** : les modules natifs ne fonctionnent pas dans Expo Go. dev-client obligatoire.
- **Appeler `getCustomerInfo()` en synchrone au render** : appel réseau — toujours dans un `useEffect` avec état de chargement.
- **Décrémenter les crédits avant succès de la génération IA** : décrémenter APRÈS la réponse API réussie pour éviter de pénaliser les erreurs réseau.

---

## À ne pas construire soi-même

| Problème | Ne pas construire | Utiliser | Pourquoi |
|----------|-------------------|----------|----------|
| Validation des reçus IAP | Validation côté app (côté client) | RevenueCat backend | Fragile, contournable, cas limites iOS infinis |
| Gestion des abonnements / expiration | Logique expiration maison | RevenueCat `CustomerInfo.entitlements.active` | Gère grace periods, renouvellements, refunds |
| Sandbox testing flows | Mocks de paiement | StoreKit Sandbox Apple (compte test créé dans ASC) | Les flows réels sont complexes (restore, interruption) |
| Prix localisés par pays | Base de données prix | `storeProduct.priceString` RevenueCat | Apple gère 170+ monnaies |

---

## Configuration App Store Connect (Team AKMNXGVVGX)

[CITED: docs.revenuecat.com/docs/getting-started/installation/expo] [ASSUMED partiellement — A4 pour les IDs précis]

### Produits à créer dans App Store Connect

| Produit | Type | ID suggéré | Prix |
|---------|------|-----------|------|
| FamilyFlow à Vie | Non-consommable | `familyflow_lifetime_v1` | Tier 29 (~29,99 €) |
| Pack Histoires 30 crédits | Consommable | `familyflow_story_pack_30` | Tier 4 (~4,99 €) |

**Étapes ASC :**
1. App Store Connect > Mon app > In-App Purchases > (+)
2. Non-consommable : « FamilyFlow à Vie » — cocher « Disponible pour achat »
3. Consommable : « Pack Histoires 30 crédits »
4. Pour chaque produit : ajouter la description FR + EN + prix localisé
5. Soumettre pour review (les produits doivent être approuvés avant la sortie)

### Compte sandbox

- ASC > Utilisateurs > Testeurs Sandbox : créer un compte email de test `@privaterelay`
- Sur l'iPhone physique : Réglages > App Store > Compte Sandbox → connecter le testeur
- Achats en sandbox : aucun débit réel, restauration fonctionne, consommables se "rechargent"

### RevenueCat Dashboard

1. Créer l'app iOS dans le dashboard RevenueCat
2. App Store Connect API key (sous Users & Access → Keys)
3. Créer 2 **Products** avec les mêmes identifiants qu'ASC
4. Créer 1 **Entitlement** : `familyflow_lifetime` → lié à `familyflow_lifetime_v1`
5. Créer 1 **Offering** « default » avec 2 packages :
   - `familyflow_lifetime` → type LIFETIME
   - `story_pack_30` → type CONSUMABLE

---

## Pièges courants

### Piège 1 : Rebuild dev-client oublié

**Ce qui se passe :** Après `npm install react-native-purchases`, l'app plante avec `Invariant Violation: 'new NativeEventEmitter()' requires a non-null argument`.  
**Pourquoi :** Module natif non lié — Metro ne peut pas le bundler sans rebuild.  
**Comment éviter :** Toujours `npx expo run:ios --device` après installation. La Wave 1 du plan doit commencer par cette étape.  
**Signe d'alerte :** App qui crash au launch immédiatement après ajout de la dep.

### Piège 2 : Consommables et solde RevenueCat

**Ce qui se passe :** Après achat du Pack Histoires, le développeur cherche `customerInfo.credits` → n'existe pas.  
**Pourquoi :** RevenueCat ne gère pas les soldes de consommables. Il confirme l'achat ; l'app doit gérer le solde.  
**Comment éviter :** Sur `purchasePackage` succès → écrire `+30` dans `quota.md` (vault). Traiter le fichier vault comme source unique du solde. [VERIFIED: D-07 CONTEXT.md]

### Piège 3 : Flag grandfather faux négatif (iCloud lent)

**Ce qui se passe :** Au premier lancement de la version payante, le vault iCloud n'est pas encore syncronisé → le vault semble vide → flag grandfather = false → l'utilisateur existant voit le paywall.  
**Pourquoi :** iCloud peut prendre 10-30 secondes à synchroniser après une réinstall.  
**Comment éviter :** Attendre que `VaultProvider` ait terminé son chargement complet avant de poser le flag. Afficher un écran "chargement" si le vault est encore en cours de sync. Ne pas poser le flag à 0 si le vault est en état `loading`. [ASSUMED — A3]

### Piège 4 : Paywall interstitiel au lancement (rejet App Store)

**Ce qui se passe :** App présentant un paywall à chaque lancement → rejet de la review Apple.  
**Pourquoi :** Règle App Store : pas de paywalls au lancement intrusifs.  
**Comment éviter :** D-10 verrouille : paywall uniquement au point de friction. Ne jamais appeler `PaywallModal` dans le root layout.

### Piège 5 : Restauration d'achats absente (rejet App Store)

**Ce qui se passe :** App sans bouton "Restaurer mes achats" → rejet Apple.  
**Pourquoi :** Règle App Store 3.1.1 : obligation d'un mécanisme de restauration.  
**Comment éviter :** Bouton "Restaurer mes achats" visible dans le paywall (et idéalement dans les Réglages). [CITED: developer.apple.com/app-store/review/guidelines/]

### Piège 6 : Décrémentation quota avant succès API

**Ce qui se passe :** L'utilisateur voit son quota baisser même si la génération échoue (erreur réseau, timeout Anthropic).  
**Pourquoi :** Décrémentation trop tôt dans le flux.  
**Comment éviter :** Ordre : (1) vérifier quota > 0, (2) appeler API Anthropic, (3) si succès → décrémenter quota → sauvegarder histoire. Si erreur → quota inchangé + toast d'erreur.

### Piège 7 : Reset mensuel via comparaison UTC vs local

**Ce qui se passe :** Le reset arrive le 31 à 23h (UTC) alors que l'utilisateur est en France (UTC+2, 1er du mois 1h) → reset trop tôt ou trop tard selon implémentation.  
**Pourquoi :** `new Date().toISOString()` retourne UTC — conflit timezone.  
**Comment éviter :** Comparer `"YYYY-MM"` en heure locale (pattern établi dans codebase : `getLocalDateKey()` Phase 38). `storyResetMonth` = mois local du device.

---

## Inventaire d'état runtime

> Section requise (modification d'une app publiée avec utilisateurs existants).

| Catégorie | Éléments trouvés | Action requise |
|-----------|------------------|----------------|
| Données stockées | Vault iCloud (tâches, repas, profils, souvenirs) — présence = critère grandfather D-05 | Lecture au premier lancement v. payante ; pas de migration |
| Config service live | RevenueCat Dashboard : produits et entitlements à créer | Config manuelle ASC + RevenueCat avant release |
| État OS enregistré | Aucun — pas de background tasks liés aux achats | Aucune |
| Secrets / env vars | `EXPO_PUBLIC_RC_IOS_KEY` — clé iOS RevenueCat à créer | Ajouter dans `.env` + EAS secrets |
| Artefacts build | dev-client à reconstruire après `npm install react-native-purchases` | `npx expo run:ios --device` |

**Rien trouvé dans « État OS enregistré » :** vérifié — pas de Task Scheduler, pm2, ni systemd impliqués.

---

## Disponibilité environnement

| Dépendance | Requise par | Disponible | Version | Fallback |
|------------|------------|------------|---------|----------|
| Xcode / iOS SDK | Build natif dev-client | ✓ (macOS darwin 25.5.0 + projet actif) | présumé recent | — |
| `react-native-purchases` | IAP RevenueCat | ✗ (non installé) | — | Aucun — à installer |
| Compte App Store Connect (Team AKMNXGVVGX) | Produits IAP | ✓ (mentionné dans CONTEXT.md) | — | — |
| Compte RevenueCat | Dashboard entitlements | [ASSUMED — A5] | — | — |
| Device physique iOS | Test sandbox | ✓ (dev-client existant) | — | Simulateur (limité pour IAP) |

**Dépendances bloquantes sans fallback :**
- `react-native-purchases` non installé → bloque toute l'implémentation.
- Produits ASC non créés → impossible de tester le flux d'achat réel.

---

## État de l'art

| Ancienne approche | Approche actuelle | Depuis | Impact |
|-------------------|------------------|--------|--------|
| `react-native-iap` (wrapper bas niveau) | RevenueCat `react-native-purchases` | 2020+ | Validation reçus serveur, API haut niveau |
| `expo-in-app-purchases` | Déprécié dans Expo SDK 51+ | SDK 51 | Ne PAS utiliser — remplacé par `react-native-purchases` |
| StoreKit 1 | StoreKit 2 (iOS 16+) | iOS 16 (2022) | RevenueCat gère les deux — `storeKitVersion` optionnel |
| Paywalls custom | RevenueCat Paywalls UI (`react-native-purchases-ui`) | 2023 | Optionnel — non retenu (DA custom requise par D-11) |

**Déprécié / obsolète :**
- `expo-in-app-purchases` : déprécié, NE PAS utiliser. [CITED: docs.expo.dev/guides/in-app-purchases/]
- `react-native-iap` : fonctionnel mais plus bas niveau, nécessite validation côté serveur maison (contraire à D-03).

---

## Log des hypothèses

| # | Hypothèse | Section | Risque si fausse |
|---|-----------|---------|-----------------|
| A1 | `react-native-purchases` s'auto-lie via autolinking Expo (comme `expo-notifications`) sans entrée plugin explicite dans `app.json` | Stack standard / Installation | Pourrait nécessiter une entrée `"react-native-purchases"` dans le tableau `plugins` de `app.json` — à vérifier lors du prebuild |
| A2 | Les consommables iOS via RevenueCat sont marqués "consumés" automatiquement par StoreKit dès l'achat — RevenueCat ne conserve pas de compteur | Pattern 5 | Si RevenueCat conservait un solde, la logique vault pourrait entrer en conflit — vérifier dans le dashboard après premier achat sandbox |
| A3 | La détection grandfather au premier lancement peut produire des faux négatifs si iCloud n'a pas fini de syncer | Piège 3 | L'utilisateur existant pourrait voir le paywall — nécessite un garde-fou (état "loading vault") |
| A4 | Les IDs produits `familyflow_lifetime_v1` et `familyflow_story_pack_30` ne sont pas encore créés dans ASC | Config ASC | À confirmer avec le développeur avant la Wave 1 — les IDs sont librement choisis mais doivent correspondre entre ASC et RevenueCat |
| A5 | Un compte RevenueCat (gratuit jusqu'à 2500 MAR) existe ou sera créé avant l'implémentation | Disponibilité env. | Sans compte RevenueCat, impossible de configurer les entitlements |

**Si ce tableau est vide :** toutes les informations auraient été vérifiées ou citées — ce n'est pas le cas ici. Les hypothèses A1-A5 doivent être confirmées avant ou pendant la Wave 1.

---

## Questions ouvertes (RESOLVED)

1. **Plugin Expo pour react-native-purchases**
   - Ce qu'on sait : le module s'auto-lie via autolinking RN.
   - Ce qui est flou : certains modules natifs Expo requièrent une entrée dans `plugins[]` de `app.json` (ex. `expo-notifications`) ; d'autres non. Les docs officielles RevenueCat ne précisent pas.
   - **RÉSOLU :** traité dans le Plan 54-01 Task 1 — exécuter `npx expo prebuild --clean` après `npm install`, inspecter les warnings, et n'ajouter une entrée `plugins[]` dans `app.json` QUE si le prebuild la réclame. Hypothèse par défaut (A1) : pas d'entrée plugin requise (autolinking suffit). La tâche est conçue pour gérer les deux cas — pas de blocage de planification.

2. **ID entitlement RevenueCat pour le lifetime**
   - Ce qu'on sait : l'entitlement doit être nommé dans le dashboard RC et correspondre à la clé `customerInfo.entitlements.active['KEY']` dans le code.
   - **RÉSOLU :** entitlement ID verrouillé à `familyflow_premium` (englobe lifetime + abonnement futur D-12), produits `familyflow_lifetime_v1` (non-consommable) et `familyflow_story_pack_30` (consommable). IDs propagés dans tous les plans (54-01 ASC/RC, 54-03 lecture statut).

3. **Compte test RevenueCat Sandbox**
   - Ce qu'on sait : sandbox Apple fonctionne hors RevenueCat (StoreKit seul).
   - Ce qui est flou : RevenueCat intercepte les reçus sandbox et les valide contre son serveur — s'assurer que l'app bundle ID dans RC correspond exactement à celui dans ASC.
   - **RÉSOLU :** traité dans le Plan 54-01 Task 2 (checkpoint human-action) — la création du compte RevenueCat, l'alignement du bundle ID RC↔ASC, et le test sandbox sur device sont des étapes manuelles explicites du checkpoint. Le bundle ID de référence est celui d'`app.json` (source de vérité projet).

---

## Validation architecture

### Framework de test

| Propriété | Valeur |
|-----------|--------|
| Framework | Jest (déjà installé — `lib/__tests__/*.test.ts`) + `npx tsc --noEmit` |
| Config | `package.json` (jest config existante) |
| Commande rapide | `npx jest --no-coverage --testPathPattern="entitlement"` |
| Suite complète | `npx jest --no-coverage && npx tsc --noEmit` |

### Carte requirements → tests

| Comportement | Type de test | Commande automatisée | Fichier |
|---|---|---|---|
| `parseQuota` round-trip (frontmatter → objet → frontmatter) | Jest unitaire | `npx jest --no-coverage --testPathPattern="quota-parser"` | `lib/entitlements/__tests__/quota-parser.test.ts` — Wave 0 |
| `detectGrandfatherEligibility` (vault vide = false, vault avec tâches = true) | Jest unitaire | `npx jest --no-coverage --testPathPattern="entitlement-engine"` | `lib/entitlements/__tests__/entitlement-engine.test.ts` — Wave 0 |
| Reset mensuel (même mois = pas de reset, mois différent = reset) | Jest unitaire | inclus dans entitlement-engine | idem |
| Décrémentation quota (génération réussie → -1) | Jest unitaire | idem | idem |
| `tsc --noEmit` clean | Type check | `npx tsc --noEmit` | CI |
| Flux d'achat lifetime + restauration | Manuel device | test sandbox device | — (manuel) |
| Paywall affiché au point de friction (pas au lancement) | Manuel | Naviguer dans l'app jusqu'à la 4e histoire | — (manuel) |

### Wave 0 — Fichiers à créer

- [ ] `lib/entitlements/__tests__/quota-parser.test.ts` — round-trip parse/serialize
- [ ] `lib/entitlements/__tests__/entitlement-engine.test.ts` — logique pure grandfather + reset + décrémentation
- [ ] `lib/entitlements/index.ts` — barrel
- [ ] `lib/entitlements/types.ts` — types partagés

---

## Domaine sécurité

### Catégories ASVS applicables

| Catégorie ASVS | Applicable | Contrôle standard |
|---|---|---|
| V2 Authentification | Non (auth existante, non modifiée) | — |
| V3 Gestion de session | Non | — |
| V4 Contrôle d'accès | Oui — feature gating | `useEntitlements()` → vérification statut avant action IA |
| V5 Validation des entrées | Oui — parsing quota vault | `parseQuota` avec valeurs par défaut, `zod` disponible si besoin |
| V6 Cryptographie | Non — RevenueCat gère la validation des reçus côté serveur | — |

### Menaces spécifiques au modèle IAP

| Pattern | STRIDE | Mitigation standard |
|---------|--------|---------------------|
| Client-side receipt bypass (jailbreak) | Tampering | RevenueCat validation serveur (D-03) — ne jamais faire confiance au seul bool côté app |
| Manipulation du fichier vault quota (édition Obsidian) | Tampering | Acceptable — l'app est sans backend, single-user, le modèle de menace est familial. Ne pas sur-sécuriser un fichier local. |
| Envoi de données vault vers RevenueCat (D-02) | Information disclosure | Ne jamais passer `appUserID` dérivé du contenu du vault. Utiliser l'ID anonyme RevenueCat. |
| Achat consommable rejoué (exploit) | Tampering | StoreKit + RevenueCat invalident automatiquement les reçus déjà consommés |

---

## Sources

### Primaires (confiance HIGH)

- Context7 `/revenuecat/react-native-purchases` — configuration SDK, CustomerInfo, entitlements, offerings, purchasePackage, restorePurchases, listener (vérifié en session)
- Code source projet vérifié : `contexts/AIContext.tsx`, `hooks/useVaultStories.ts`, `app/_layout.tsx`, `lib/vault-cache.ts`, `lib/parser.ts`
- `npm view react-native-purchases version` → 10.4.0 (vérifié en session)

### Secondaires (confiance MEDIUM)

- [RevenueCat Expo install guide](https://www.revenuecat.com/docs/getting-started/installation/expo) — étapes install + dev-client rebuild (WebFetch)
- [Expo in-app purchases guide](https://docs.expo.dev/guides/in-app-purchases/) — `expo-in-app-purchases` déprécié, `react-native-purchases` recommandé (WebSearch)
- [RevenueCat React Native install guide](https://www.revenuecat.com/docs/getting-started/installation/reactnative) — iOS deployment target 13.4 min, autolinking (WebFetch)
- `CONTEXT.md` Phase 54 — décisions produit verrouillées D-01 à D-12

### Tertiaires (confiance LOW — à valider)

- Plugin Expo pour `react-native-purchases` : aucune source primaire trouvée précisant si une entrée `app.json plugins[]` est nécessaire — signalé comme A1.

---

## Métadonnées

**Ventilation de la confiance :**
- Stack (RevenueCat SDK, versions) : HIGH — vérifié npm + Context7
- Patterns d'architecture : HIGH — dérivés du code existant + API RevenueCat vérifiée
- Config ASC (IDs produits) : MEDIUM — convention standard, IDs non encore créés (A4)
- Plugin Expo : LOW — aucune source primaire, signalé A1
- Pièges : MEDIUM — combinaison docs officielles + raisonnement sur architecture existante

**Date de recherche :** 2026-06-24
**Valide jusqu'à :** 2026-07-24 (RevenueCat SDK évolue rapidement — revérifier si >30j)
