---
phase: 54-monetisation-hybride-paiement
verified: 2026-06-24T00:00:00Z
status: human_needed
score: 13/13 statically-verifiable must-haves verified
overrides_applied: 0
human_verification:
  - test: "Générer 3 histoires en compte FREE (grandfather:false), vérifier que story_used_this_month s'incrémente 1→2→3 dans quota.md APRÈS chaque succès"
    expected: "story_used_this_month passe à 1, 2, 3 dans 09 - Entitlements/quota.md, jamais avant le succès API (Piège 6)"
    why_human: "I/O vault réel + appel API réel — non vérifiable statiquement"
  - test: "Tenter une 4e génération d'histoire gratuite/mois"
    expected: "PaywallModal s'ouvre en pageSheet drag-to-dismiss, AUCUN appel à generateBedtimeStory (cap dur), prix affichés depuis le store (pas '…' si offerings dispo)"
    why_human: "Déclenchement runtime du gate + ouverture modale + offerings RevenueCat live — nécessite device + sandbox"
  - test: "Relire une histoire déjà générée (MP3 en cache)"
    expected: "Lecture libre, story_used_this_month NE bouge PAS (D-09 — relecture gratuite)"
    why_human: "Chemin replay cache runtime — non observable statiquement"
  - test: "Achat sandbox du lifetime depuis le paywall"
    expected: "Flux StoreKit sandbox s'ouvre, achat confirmé → status passe LIFETIME via listener temps réel, paywall se ferme"
    why_human: "Flux StoreKit sandbox + RevenueCat live — nécessite device physique + compte sandbox"
  - test: "Achat sandbox du Pack Histoires"
    expected: "story_credits passe à 30 dans quota.md (RevenueCat ne gère pas le solde — Piège 2)"
    why_human: "Achat consommable sandbox + I/O vault — nécessite device + sandbox"
  - test: "Bouton « Restaurer mes achats »"
    expected: "Retrouve le lifetime sandbox, status repasse LIFETIME"
    why_human: "RevenueCat restore live — nécessite device + sandbox"
  - test: "Premier lancement version payante avec vault existant (tâches/profils présents)"
    expected: "09 - Entitlements/quota.md créé avec grandfather: true, posé UNE SEULE fois (relance ne réécrit pas le flag — D-05)"
    why_human: "Détection grandfather one-shot + I/O vault iCloud — nécessite device avec vault réel"
  - test: "Dev-client rebuild (npx expo run:ios --device) après install react-native-purchases"
    expected: "App se lance SANS crash Invariant Violation 'new NativeEventEmitter()' requires a non-null argument (module natif lié)"
    why_human: "Rebuild natif sur device physique — non vérifiable statiquement (Piège 1)"
  - test: "Produits IAP App Store Connect + entitlement/offering RevenueCat + compte sandbox"
    expected: "familyflow_lifetime_v1 (non-conso, ~29,99€) + familyflow_story_pack_30 (conso, ~4,99€) créés, entitlement familyflow_premium, offering default current, sandbox connecté, EXPO_PUBLIC_RC_IOS_KEY renseignée dans .env"
    why_human: "Config dashboards externes (ASC Team AKMNXGVVGX + RevenueCat) — actions humaines hors codebase"
  - test: "Vérifier ID anonyme RevenueCat"
    expected: "Dashboard RevenueCat → Customer : ID = $RCAnonymousID, aucun ID dérivé du contenu vault (D-02)"
    why_human: "Inspection dashboard RevenueCat live — non observable dans le code (le code ne passe pas d'appUserID, mais la confirmation live est requise)"
  - test: "DA paywall en mode clair ET sombre"
    expected: "useThemeColors respecté, aucune couleur figée, ton chaleureux FR"
    why_human: "Rendu visuel — non vérifiable statiquement"
---

# Phase 54 : Monétisation hybride — Verification Report

**Phase Goal:** Introduire le premier modèle payant de FamilyFlow sans casser l'app publiée. Modèle hybride : achat unique « FamilyFlow à Vie » (29,99 €, non-consommable) + IA à la carte « Pack Histoires » (4,99 €/30, consommable) au-delà de 3 histoires/mois gratuites. Règle d'or : l'IA se finance toujours elle-même. Non-cassant : app publiée préservée, aucune régression, tsc clean.
**Verified:** 2026-06-24
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truths split into STATICALLY VERIFIABLE (checked against the codebase) and DEVICE/RUNTIME (routed to human verification per phase scope — external SaaS + native rebuild unavailable during execution).

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | react-native-purchases installé (10.4.0) | ✓ VERIFIED | package.json:68 `^10.4.0` + node_modules/react-native-purchases@10.4.0 présent |
| 2 | EXPO_PUBLIC_RC_IOS_KEY documentée (placeholder, pas de vraie clé) | ✓ VERIFIED | .env.example:3 `appl_xxxxxxxxxxxx` |
| 3 | canGenerateStory autorise 3 histoires/mois free puis exige crédits/lifetime | ✓ VERIFIED | entitlement-engine.ts:37-42 (freeSlots = max(0, 3-used) > 0 OU storyCredits > 0) + 26 tests Jest PASS |
| 4 | LIFETIME génère sans décrémenter (règle d'or préservée) | ✓ VERIFIED | engine:38 (hasLifetime → true) + 52 (decrementQuota hasLifetime → quota inchangé) |
| 5 | Reset mensuel quand storyResetMonth ≠ mois local courant | ✓ VERIFIED | engine:27-29 shouldResetMonth + 22-24 currentLocalMonth via date-fns (zéro toISOString pour le mois) |
| 6 | parseQuota/serializeQuota round-trip loss-less + coercions défensives | ✓ VERIFIED | quota-parser.ts:33-70 (ligne par ligne, pas matter.stringify) + quota-parser.test.ts PASS |
| 7 | detectGrandfatherEligibility true ssi au moins un domaine vault non vide | ✓ VERIFIED | engine:70-82 (tasks/meals/profiles/memories .length > 0) |
| 8 | useEntitlements() expose status/quota/canGenerateStory/purchaseLifetime/purchaseStoryPack/restorePurchases/decrementStoryQuota | ✓ VERIFIED | EntitlementContext.tsx:66-81 (interface) + 325-354 (value) + 359 hook |
| 9 | EntitlementProvider monté entre ThemeProvider et AIProvider | ✓ VERIFIED | app/_layout.tsx:313-351 (`<ThemeProvider>`→`<EntitlementProvider>`→`<AIProvider>`) |
| 10 | Aucune donnée vault transmise à RevenueCat (pas d'appUserID) | ✓ VERIFIED | EntitlementContext: configure sans appUserID (grep appUserID == 0); statut dérivé de entitlements.active uniquement |
| 11 | Paywall pageSheet + drag-to-dismiss, useThemeColors zéro hardcoded, prix localisés, lifetime+pack+restore | ✓ VERIFIED | PaywallModal.tsx:95 presentationStyle pageSheet, :96 onRequestClose, :53 useThemeColors, :124 lifetimePrice (jamais hardcodé), :151 « Restaurer mes achats », grep #hex/29,99/4,99 == 0 |
| 12 | Gate cap dur AVANT generateBedtimeStory + décrément APRÈS saveStory uniquement | ✓ VERIFIED | stories.tsx:1501/1976/2178 gate canGenerateStory()→return avant API (1981/2181), décrément 2240 après saveStory 2229; replay cache ne passe pas par ce chemin |
| 13 | Non-cassant : tsc clean (zéro erreur phase 54), suite entitlements verte, paywall jamais au mount | ✓ VERIFIED | tsc = 4 erreurs PRÉ-EXISTANTES (meals.tsx x3, useVault.ts x1 — CLAUDE.md), zéro fichier phase 54; jest entitlements 26/26 PASS; PaywallModal monté en JSX (stories.tsx:2689), pas dans useEffect[] |

**Score:** 13/13 statically-verifiable truths verified. 11 device/runtime truths routed to human verification (see below).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| package.json | react-native-purchases dep | ✓ VERIFIED | :68 ^10.4.0, installé node_modules |
| .env.example | EXPO_PUBLIC_RC_IOS_KEY | ✓ VERIFIED | :3 placeholder, pas de vraie clé |
| lib/entitlements/types.ts | EntitlementStatus/QuotaData/EntitlementState | ✓ VERIFIED | 3 types exportés |
| lib/entitlements/entitlement-engine.ts | logique pure 6 exports | ✓ VERIFIED | canGenerateStory/decrementQuota/shouldResetMonth/currentLocalMonth/detectGrandfatherEligibility/quotaExceededMessage + FREE_STORIES_PER_MONTH |
| lib/entitlements/quota-parser.ts | parseQuota/serializeQuota/QUOTA_FILE/DEFAULT_QUOTA | ✓ VERIFIED | QUOTA_FILE = '09 - Entitlements/quota.md', round-trip ligne par ligne |
| lib/entitlements/index.ts | barrel 3 export * | ✓ VERIFIED | types + engine + parser |
| contexts/EntitlementContext.tsx | provider + useEntitlements | ✓ VERIFIED | 366 lignes, init RevenueCat + quota vault + grandfather one-shot + 5 actions + listener |
| app/_layout.tsx | EntitlementProvider monté | ✓ VERIFIED | import :40, mount :314-350 |
| components/paywalls/PaywallModal.tsx | modal pageSheet achat+restore | ✓ VERIFIED | substantive, useThemeColors, prix localisés |
| components/paywalls/PremiumBanner.tsx | bannière memo CTA | ✓ VERIFIED | React.memo, useThemeColors |
| components/paywalls/index.ts | barrel | ✓ VERIFIED | 2 export * |
| app/(tabs)/stories.tsx | gate + décrément câblés | ✓ VERIFIED | 3 gates, décrément après succès, PaywallModal monté JSX |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| EntitlementContext | RevenueCat CustomerInfo | getCustomerInfo + addCustomerInfoUpdateListener | ✓ WIRED | :150 getCustomerInfo, :227 addCustomerInfoUpdateListener, :229 removeCustomerInfoUpdateListener (cleanup) |
| EntitlementContext | quota.md | readFile/writeFile + parseQuota/serializeQuota | ✓ WIRED | :175 readFile, :197/:280/:312 writeFile, QUOTA_FILE constant |
| _layout.tsx | EntitlementProvider | insertion ThemeProvider→AIProvider | ✓ WIRED | :314-350 ordre respecté |
| stories.tsx | canGenerateStory | gate avant generateBedtimeStory | ✓ WIRED | gate :1501/:1976/:2178 avant API :1981/:2181 |
| stories.tsx | decrementStoryQuota | après succès + saveStory | ✓ WIRED | :2240 après saveStory :2229 |
| PaywallModal | purchaseLifetime/purchaseStoryPack/restorePurchases | boutons CTA | ✓ WIRED | 9 références aux 3 actions |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Suite entitlements verte | jest --testPathPattern=entitlements | 2 suites / 26 tests PASS | ✓ PASS |
| tsc zéro erreur phase 54 | tsc --noEmit | 4 erreurs pré-existantes (meals.tsx, useVault.ts), 0 phase 54 | ✓ PASS |
| Achat/paywall/quota runtime | device + sandbox | n/a | ? SKIP — routé humain (pas d'entry point testable sans device/SaaS) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| SC-1 infra entitlements | 54-02, 54-03 | ✓ SATISFIED | lib/entitlements/ + EntitlementContext (useEntitlements, FREE/LIFETIME, solde crédits) |
| SC-2 RevenueCat achat+restore | 54-01, 54-03 | ⚠ CODE COMPLET, runtime humain | purchaseLifetime/purchaseStoryPack/restorePurchases codés; sandbox device requis |
| SC-3 paywall pageSheet | 54-04 | ✓ SATISFIED | PaywallModal pageSheet + useThemeColors + prix localisés + restore |
| SC-4 feature gate cap 3/mois | 54-02, 54-04 | ✓ SATISFIED (code) | cap encodé+testé; gate sur generateBedtimeStory (point d'appel API réel). Voir note SC-4 ci-dessous |
| SC-5 produits ASC + sandbox | 54-01 | ⚠ HUMAIN | config dashboards externes — hors codebase |
| SC-6 non-cassant tsc clean | tous | ✓ SATISFIED | tsc 0 erreur phase 54, jest entitlements vert, 7 suites pré-existantes rouges documentées (deferred-items.md) |
| SC-7 règle d'or IA auto-financée | 54-02, 54-03, 54-04 | ✓ SATISFIED | aucun chemin canGenerateStory→true sans slot/crédit/lifetime; gate return avant API; LIFETIME no-decrement |

**Note SC-4 :** Le success criterion ROADMAP mentionne « wrapper d'entitlement sur `hooks/useAI.ts` ». Le plan 54-04 a délibérément placé le gate au point d'appel réel de l'API IA (`generateBedtimeStory` dans `app/(tabs)/stories.tsx`), seul point à coût marginal réel (règle d'or). C'est une implémentation équivalente — le gate EST sur le chemin de génération IA, avec triple barrière (gate primaire avant mount + gate défensif avant API + gate sur re-roll). Le scope a été documenté dans le plan (les autres écrans premium consommeront PremiumBanner/useEntitlements dans leurs phases dédiées). Non considéré comme un gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Aucun stub/placeholder/TODO bloquant détecté | — | Tous les fichiers phase 54 substantifs et câblés |

Note : les `catch { /* non-critique */ }` dans EntitlementContext et stories.tsx sont volontaires (pattern projet CLAUDE.md pour erreurs non-critiques), pas des stubs.

### Human Verification Required

Cette phase DIFFÈRE intentionnellement la vérification runtime sur device : la config externe (RevenueCat dashboard, App Store Connect, compte sandbox) et le rebuild dev-client natif (`npx expo run:ios --device`) requièrent un device physique + comptes SaaS externes non disponibles pendant l'exécution. Le CODE des 4 plans est complet, câblé et committé. Voir le frontmatter `human_verification` pour les 11 tests détaillés :

1. Décompte quota après chaque succès (3 histoires, Piège 6)
2. 4e histoire → paywall sans appel API (cap dur)
3. Relecture MP3 cache → quota inchangé (D-09)
4. Achat lifetime sandbox → LIFETIME
5. Achat Pack Histoires sandbox → +30 crédits
6. Restaurer mes achats
7. Grandfather one-shot au premier lancement payant (D-05)
8. Dev-client rebuild sans crash NativeEventEmitter (Piège 1)
9. Produits ASC + entitlement/offering RevenueCat + sandbox
10. ID anonyme RevenueCat (D-02)
11. DA paywall clair/sombre

### Gaps Summary

**Aucun gap bloquant.** Les 13 must-haves statiquement vérifiables sont VERIFIED contre le codebase réel (pas seulement les claims du SUMMARY) : artefacts existants + substantifs + câblés + data-flow tracé. Le statut est `human_needed` (et non `passed`) car 11 vérifications runtime/device restent nécessaires — explicitement hors de portée de l'exécution statique de cette phase (device physique + RevenueCat + App Store Connect + sandbox indisponibles). Non-régression confirmée : tsc 0 erreur phase 54, suite entitlements 26/26 verte ; les 7 suites Jest rouges sont pré-existantes et documentées (deferred-items.md), pas des régressions.

---

_Verified: 2026-06-24_
_Verifier: Claude (gsd-verifier)_
