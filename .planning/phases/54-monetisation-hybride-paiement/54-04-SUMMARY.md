---
phase: 54-monetisation-hybride-paiement
plan: 04
subsystem: monetisation-ui
tags: [paywall, feature-gate, entitlements, revenuecat, stories, quota]
requires:
  - "contexts/EntitlementContext.tsx (Wave 3 — useEntitlements: canGenerateStory/decrementStoryQuota/purchaseLifetime/purchaseStoryPack/restorePurchases/lifetimePrice/packPrice/status/isLoadingPurchase)"
  - "components/ui (ModalHeader, Button)"
  - "contexts/ThemeContext.tsx (useThemeColors)"
provides:
  - "components/paywalls/PaywallModal.tsx — modal pageSheet achat lifetime/pack + restauration"
  - "components/paywalls/PremiumBanner.tsx — bannière aperçu + CTA (mode D-11)"
  - "components/paywalls/index.ts — barrel paywalls"
  - "Cap dur free tier câblé sur la génération d'histoires (app/(tabs)/stories.tsx)"
affects:
  - "app/(tabs)/stories.tsx (gate canGenerateStory avant API + décrément après succès + paywall au point de friction)"
tech-stack:
  added: []
  patterns:
    - "Modal pageSheet + drag-to-dismiss (analogue BookExportModal) : Modal > SafeAreaView > ModalHeader + ScrollView + footer CTA"
    - "Prix localisés RevenueCat (priceString) affichés tels quels, fallback '…' offline — jamais hardcodé"
    - "Gate de friction en double barrière : point d'entrée (PersonnaliserStep, avant mount) + défensif (GenerationStep, avant l'appel API)"
    - "Décrément quota APRÈS succès génération + saveStory uniquement (jamais avant, jamais sur relecture cache)"
key-files:
  created:
    - "components/paywalls/PaywallModal.tsx"
    - "components/paywalls/PremiumBanner.tsx"
    - "components/paywalls/index.ts"
  modified:
    - "app/(tabs)/stories.tsx"
decisions:
  - "Gate primaire placé dans PersonnaliserStep.generate (avant goTo etape:'generation') plutôt qu'uniquement dans GenerationStep : GenerationStep appelle generate() automatiquement dans un useEffect([]) au mount → gater là afficherait d'abord le loading des étoiles. Le gate au point d'entrée évite ce flash. Un 2e gate défensif reste dans GenerationStep avant l'appel API (T-54-11)."
  - "Le re-roll qualité (2e generateBedtimeStory, ligne ~2151) est gardé par canGenerateStory() mais NE déclenche PAS le paywall : si le cap est dépassé, il throw → le pipeline retombe sur l'histoire originale (déjà valide). La génération courante a déjà passé le gate primaire ; ouvrir un paywall en plein milieu casserait l'UX."
  - "decrementStoryQuota placé après saveStory(finalStory) du flux de génération principal uniquement. Les autres saveStory (alignment, llm_judge enrichi, replay) ne décrémentent pas — ce ne sont pas de nouvelles générations."
metrics:
  duration: "~20min"
  completed: "2026-06-24"
  tasks: 2
  files: 4
---

# Phase 54 Plan 04 : Paywall + cap dur génération d'histoires — Summary

Couche UI de monétisation + point de friction : `PaywallModal` (pageSheet + drag-to-dismiss, achat lifetime « FamilyFlow à Vie » + Pack Histoires + « Restaurer mes achats », prix localisés RevenueCat, zéro hardcoded), `PremiumBanner` (aperçu + CTA D-11, `React.memo`), et le cap dur free tier câblé sur la génération d'histoires dans `app/(tabs)/stories.tsx` : gate `canGenerateStory()` avant tout appel API (4e histoire/mois → paywall, jamais d'appel coûteux), décrément du quota **après succès uniquement** (D-09/Piège 6), relecture MP3 en cache **jamais décrémentée**, flux LIFETIME/grandfathered **inchangé**. `tsc` propre (zéro nouvelle erreur), golden set Phase 52 + suite entitlements vertes, zéro régression introduite.

## Ce qui a été construit

### Task 1 — paywalls (commit `db83eb1d`)
- **`components/paywalls/PaywallModal.tsx`** : `Modal animationType="slide" presentationStyle="pageSheet" onRequestClose` > `SafeAreaView` (fond `colors.bg`) > `ModalHeader title="FamilyFlow à Vie"` > `ScrollView` (sous-titre contextuel `story_limit`/`premium_feature` + 7 bénéfices premium cœur en ton chaleureux FR) > footer.
  - Footer : bloc lifetime (« Payez une fois. Pour toujours. » + `{lifetimePrice || '…'}` + `Button "Obtenir FamilyFlow à Vie" size="lg"`), bloc Pack Histoires (« 30 histoires » + `{packPrice || '…'}` + `Button "Acheter un Pack Histoires" variant="secondary"`), `Button "Restaurer mes achats" variant="ghost"` (Apple 3.1.1).
  - Handlers : `handleLifetime`/`handlePack` → `Haptics.impactAsync(Medium)` + action ; `handleRestore` → `Haptics.selectionAsync()` + restore. Boutons `disabled={isLoadingPurchase}` + `ActivityIndicator` pendant l'achat.
  - Fermeture auto sur succès lifetime via `useEffect` (statut bascule `LIFETIME` par le listener temps réel du provider).
  - Couleurs **uniquement** via `useThemeColors()` ; styles statiques en `StyleSheet.create`.
- **`components/paywalls/PremiumBanner.tsx`** : `React.memo`, `TouchableOpacity` (fond `tint`, bordure `primary`, message `colors.text`, CTA `primary`), props `{ message, ctaLabel?, onPress }`. Réutilisable par les écrans premium différés (mode aperçu + CTA D-11).
- **`components/paywalls/index.ts`** : barrel (`export * from './PaywallModal'` + `'./PremiumBanner'`).

### Task 2 — gate stories.tsx (commit `ace5588f`)
- Imports `useEntitlements` + `PaywallModal` ; au niveau écran (`StoriesScreen`) : `const { canGenerateStory, decrementStoryQuota } = useEntitlements();` + `const [paywallVisible, setPaywallVisible] = useState(false);`.
- **Gate primaire** (`PersonnaliserStep.generate`, avant `goTo({ etape: 'generation' })`) : `if (!canGenerateStory()) { Haptics.notificationAsync(Warning); setPaywallVisible(true); return; }` — bloque la transition avant tout mount/appel API, évite le flash de loading.
- **Gate défensif** (`GenerationStep.generate`, juste avant le 1er `generateBedtimeStory`) : même garde → garantit zéro appel API au-delà du cap (T-54-11).
- **Re-roll** (2e `generateBedtimeStory`, ligne ~2151) : gardé par `canGenerateStory()` → throw si épuisé (pipeline retombe sur l'histoire originale), pas de paywall mid-génération.
- **Décrément** : `decrementStoryQuota().catch(() => {})` placé **après** `saveStory(finalStory)` du flux principal — non bloquant, après succès uniquement. La relecture MP3 cache ne passe pas par `generate()` → jamais décrémentée (D-09).
- **Rendu paywall** : `<PaywallModal visible={paywallVisible} onClose={...} context="story_limit" />` monté au niveau écran, jamais dans un `useEffect([])` (D-10/Piège 4).

## Vérification

- `npx tsc --noEmit` : **zéro nouvelle erreur**. Les 4 erreurs restantes sont pré-existantes (`MemoryEditor.tsx`, `cooklang.ts`, `useVault.ts` — CLAUDE.md §Testing, à ignorer). Aucune dans `components/paywalls/` ni `app/(tabs)/stories.tsx`.
- Critères grep Task 1 : `presentationStyle="pageSheet"` (1), « Restaurer mes achats » (2), `lifetimePrice` (3), hardcoded `#hex`/`29,99`/`4,99` = **0**, `useThemeColors` modal (3) + banner (3), barrel `export *` = **2**.
- Critères grep Task 2 : `canGenerateStory()` = **3** (≥2), `setPaywallVisible(true)` = **2**, `decrementStoryQuota` = **3**, `PaywallModal` monté = **2**, paywall au mount = **0**.
- **Non-régression (SC-6)** : suite Jest complète = 7 suites / 164 tests en échec, **identiques au baseline documenté** du Plan 03 (lightning, pdf, courses, auberge, codex, insights — tous échecs d'import `react-native-svg`/`lucide-react-native`, indépendants des entitlements). Suite `lib/entitlements` + golden set Phase 52 (`lib/eval`) = **97 tests verts**. Zéro test cassé par ce plan (mes fichiers n'ont pas de test ; aucun test entitlement/eval impacté).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — UX] Gate primaire déplacé au point d'entrée plutôt que seulement dans GenerationStep**
- **Trouvé pendant :** Task 2 (lecture du flux).
- **Problème :** `GenerationStep` appelle `generate()` automatiquement dans un `useEffect([])` au mount. Gater uniquement dans `GenerationStep.generate` (ligne ~1958) afficherait d'abord la vue de chargement (étoiles animées) AVANT d'ouvrir le paywall — mauvaise UX et état "génération en cours" déjà monté.
- **Fix :** gate primaire ajouté dans `PersonnaliserStep.generate` (avant `goTo({ etape: 'generation' })`), donc avant tout mount/appel API ; le gate dans `GenerationStep` est conservé comme **double barrière défensive** (T-54-11, garantit zéro appel API même si la vue est atteinte directement). Le `return` dans `PersonnaliserStep` n'a aucun état `isGenerating` à réinitialiser (le set `voiceConfig` arrive après le gate).
- **Fichier :** `app/(tabs)/stories.tsx`.
- **Commit :** `ace5588f`.

**2. [Rule 1 — UX] Re-roll qualité gardé sans paywall (throw → fallback histoire originale)**
- **Trouvé pendant :** Task 2.
- **Problème :** le plan demande un gate `canGenerateStory()` avant le 2e `generateBedtimeStory` (ligne ~2151). Mais ce 2e appel est le **re-roll qualité interne** (Phase 52, cap 1) au sein d'une génération déjà autorisée par le gate primaire — ouvrir un paywall ici interromprait une génération en cours (UX cassée).
- **Fix :** garde `if (!canGenerateStory()) throw new Error(...)` dans le callback de re-roll → `runRubricAndMaybeReroll` capture l'échec et **conserve l'histoire originale** (déjà valide). Satisfait T-54-11 (aucun appel API non capé) sans casser le flux ni afficher de paywall mid-génération.
- **Fichier :** `app/(tabs)/stories.tsx`.
- **Commit :** `ace5588f`.

## Vérifications différées sur device (Task 3 — checkpoint:human-verify)

Le déclenchement réel du paywall, le décompte du quota et la gratuité de la relecture cache ne se vérifient **que sur iPhone physique** avec dev-client rebuild (Wave 1) + sandbox RevenueCat/ASC configurés — **non disponibles dans cet environnement** (pas de device, clé RevenueCat encore placeholder, setup externe reporté à un checkpoint consolidé). `tsc` propre + suites vertes ; les vérités ci-dessous restent **à vérifier sur device** :

1. Avec compte FREE (`grandfather: false`, `story_used_this_month: 0`), générer 3 histoires : chacune réussit et le compteur s'incrémente à 1, 2, 3 **APRÈS** chaque succès (Piège 6).
2. Tentative 4e génération : `PaywallModal` s'ouvre (pageSheet, drag-to-dismiss), **AUCUN appel API**, prix affichés depuis le store (pas `…` si offerings dispo, pas de « 29,99 € » hardcodé).
3. Relecture d'une histoire en cache (MP3) : fonctionne librement, `story_used_this_month` **ne bouge pas** (D-09 — relecture gratuite).
4. Achat lifetime sandbox dans le paywall → statut `LIFETIME` → 5e génération réussit sans décrémenter (exemption D-06).
5. **Aucun paywall au lancement** de l'app (D-10/Piège 4).
6. DA `useThemeColors` respectée en mode clair ET sombre (aucune couleur figée), ton chaleureux FR.

## Threat surface

Aucune nouvelle surface au-delà du `<threat_model>` du plan. Mitigations en place côté code :
- **T-54-11** (génération au-delà du cap sans payer) : gate `if (!canGenerateStory()) return;` AVANT chaque `generateBedtimeStory` (entrée + défensif) ; re-roll garde throw → fallback. Aucun appel API ne passe le cap. *(vérif device étape 2).*
- **T-54-12** (décrément avant succès) : `decrementStoryQuota` appelé APRÈS `saveStory` ; erreur API → `return` plus haut → quota intact.
- **T-54-13** (relecture cache facturée) : décrément uniquement dans le chemin `generate()` ; la relecture MP3 n'y passe pas (D-09). *(vérif device étape 3).*
- **T-54-14** (paywall au lancement → rejet Apple) : `PaywallModal` jamais monté au mount/`useEffect([])` ; uniquement sur `setPaywallVisible(true)` au point de friction ; bouton « Restaurer mes achats » présent (3.1.1). *(vérif device étape 5).*

## Known Stubs

Aucun stub introduit. `lifetimePrice`/`packPrice` valent `''` → affichés `…` tant que `getOfferings` RevenueCat n'a pas répondu (offline ou avant setup clé réelle, Wave 1 device) — comportement attendu et documenté, résolu au runtime.

## Deferred Issues

7 suites Jest **pré-existantes** en échec (164 tests), **hors périmètre**, confirmées indépendantes de ce plan (mêmes échecs `react-native-svg`/`lucide-react-native` que le baseline du Plan 03) — voir `.planning/phases/54-monetisation-hybride-paiement/deferred-items.md`. Domaines : lightning, pdf, codex, courses, auberge, insights. À traiter en maintenance dédiée.

## Self-Check: PASSED

- FOUND: `components/paywalls/PaywallModal.tsx`
- FOUND: `components/paywalls/PremiumBanner.tsx`
- FOUND: `components/paywalls/index.ts`
- FOUND: `app/(tabs)/stories.tsx` (modifié — gate + décrément + PaywallModal monté)
- FOUND commit `db83eb1d` (Task 1)
- FOUND commit `ace5588f` (Task 2)
