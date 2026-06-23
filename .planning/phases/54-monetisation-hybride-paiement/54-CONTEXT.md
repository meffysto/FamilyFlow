# Phase 54: Monétisation hybride — infrastructure de paiement - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Premier modèle payant de FamilyFlow, posé **par-dessus une app déjà publiée**, sans rien casser. Cette phase livre l'infrastructure de monétisation hybride verrouillée par la ROADMAP :

- **Système d'entitlements** : `lib/entitlements/` + `contexts/EntitlementContext.tsx` (`useEntitlements()`, statut `FREE | LIFETIME`, solde de crédits IA persistant).
- **Intégration RevenueCat** : achat unique « FamilyFlow à Vie » (29,99 €, non-consommable) + « Pack Histoires » (4,99 €/30, consommable) + restauration d'achats.
- **Paywall** : `components/paywalls/` en `pageSheet` + drag-to-dismiss, `useThemeColors()`, DA chaleureuse.
- **Feature gates** : wrapper d'entitlement sur l'IA (`contexts/AIContext.tsx`) + écrans premium ; cap dur free tier de 3 histoires/mois.
- **Produits App Store Connect** (Team Apple `AKMNXGVVGX`) : IDs, prix, sandbox testés.

**Règle d'or (invariant) :** l'IA se finance toujours elle-même — les crédits/Pack Histoires couvrent toujours le coût marginal API. Jamais d'IA illimitée à perte adossée au seul lifetime.

**Gratuit pour toujours (ne JAMAIS verrouiller) :** organisation complète (dashboard, tâches, calendrier, RDV, courses, notes, wishlist, anniversaires), journal bébé, photos/souvenirs, gamification de base (XP, mascotte, ferme, village/Sporée), zéro publicité, 3 histoires du soir/mois.

**Hors périmètre de cette phase :** construire de nouvelles features premium IA (voix clonées, scan tickets, suggestions recettes IA, prép RDV IA) — on gate l'IA existante, on n'en crée pas. Voir Deferred.

</domain>

<decisions>
## Implementation Decisions

### Infrastructure d'achat
- **D-01:** Utiliser **RevenueCat** (`react-native-purchases`) comme brique d'achat. Gère lifetime (non-consommable) + Pack Histoires (consommable) + restauration + sandbox out-of-the-box. Choisi pour minimiser le code critique et le risque de bug sur le chemin paiement chez un solo dev.
- **D-02:** Le phone-home RevenueCat ne concerne **que les events d'achat** — jamais le contenu du vault. L'argument « vos souvenirs ne quittent jamais votre téléphone » reste 100 % vrai et doit être préservé (aucune donnée familiale envoyée à RevenueCat).
- **D-03:** **RevenueCat est la source de vérité du statut d'achat** (LIFETIME possédé ou non, achats consommables). L'app ne réimplémente pas la validation des reçus.

### Grandfathering des utilisateurs existants
- **D-04:** **Grandfather complet.** Toute install antérieure à la version payante conserve l'accès premium (équivalent LIFETIME) gratuitement à vie. Le paywall ne s'applique qu'aux nouveaux utilisateurs. Décision prise pour éviter tout backlash / mauvaises notes sur une app publiée — on ne retire jamais une feature déjà utilisée.
- **D-05:** **Détection « pré-payant » par présence de données vault.** Au premier lancement de la version payante, si le vault contient déjà du contenu créé (tâches/repas/profils/etc. préexistants), poser un **flag grandfather persistant**. Le flag est persisté dans le vault lui-même afin de suivre l'iCloud et de survivre à une réinstallation. Posé exactement une fois.
- **D-06:** Le grandfather accorde l'accès aux features premium **cœur** (non-IA). Il ne contourne PAS la règle d'or IA : le cap de 3 histoires/mois et les crédits restent gérés par le système de quota (un grandfathered n'a pas d'IA illimitée gratuite — sinon perte à l'API). *(À confirmer en planning : si conflit avec l'esprit « premium à vie », trancher en faveur de la règle d'or — l'IA reste toujours auto-financée.)*

### Cap free tier & crédits IA
- **D-07:** **Compteur d'histoires consommées + solde de crédits IA stockés dans le vault** (fichier dédié, frontmatter). Suit l'iCloud, survit à la réinstall, synchro entre appareils famille, cohérent avec l'archi « tout dans le vault ». Le statut d'achat reste côté RevenueCat (D-03).
- **D-08:** **Reset au mois calendaire** (remise à zéro le 1er du mois). Lisible (« 3/mois »), facile à afficher.
- **D-09:** **Seule une nouvelle génération IA décrémente le quota** (coût API réel). La relecture d'un MP3 déjà en cache est **gratuite et illimitée** — cohérent avec la règle d'or (cache = 0 €). Ne jamais punir la relecture d'une histoire préférée.

### Paywall — déclencheurs & gate
- **D-10:** **Paywall contextuel au point de friction uniquement.** Présenté quand l'utilisateur atteint une limite réelle : après la 3e histoire du mois, ou au tap sur une feature premium verrouillée. **Jamais d'interstitiel au lancement.** Zéro dark pattern.
- **D-11:** **Écrans premium en mode aperçu + CTA** quand c'est raisonnable : l'écran s'ouvre en aperçu (montre la valeur, ex. budget d'exemple partiel/flouté) avec un CTA paywall, plutôt qu'un blocage sec. Hard gate acceptable là où l'aperçu n'a pas de sens.

### Périmètre produits
- **D-12:** **2 produits seulement dans cette phase** : lifetime 29,99 € (non-consommable) + Pack Histoires 4,99 €/30 (consommable), conformes à la ROADMAP. L'architecture entitlement doit rester **extensible** pour ajouter l'Abo Histoires et les offres plus tard (Phase « offres » / C de la stratégie).

### Claude's Discretion
- **Affichage des prix :** toujours via les **price strings localisées du store** retournées par RevenueCat (jamais de « 29,99 € » hardcodé) — gère devises/régions automatiquement et respecte la convention anti-hardcoded du projet.
- **Structure exacte** de `lib/entitlements/` (types, hook, helpers) et du fichier vault crédits/quota : à dériver par le planner selon les patterns existants.
- **DA précise** du paywall et des bannières d'aperçu : `pageSheet` + drag-to-dismiss + `useThemeColors()` obligatoires ; ton chaleureux slice-of-life aligné sur l'app.
- **Garde-fous coûts IA secondaires** (fallback Haiku/TTS local si quota API atteint) : optionnel, à intégrer si peu coûteux ; le cache MP3 agressif existe déjà.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stratégie & périmètre
- `.planning/quick/260619-monetisation-strategie/strategie-monetisation.html` — modèle hybride verrouillé : découpage gratuit/lifetime/IA, grille tarifaire, scénarios chiffrés, règle d'or coûts IA, roadmap A/B/C. **Référence de vérité de la stratégie.**
- `.planning/ROADMAP.md` §Phase 54 — goal + 7 success criteria (entitlements, RevenueCat, paywall, feature gates, ASC products, non-cassant, règle d'or).

### Conventions projet
- `CLAUDE.md` — stack (RN 0.81.5 / Expo SDK 54 / expo-router v6), conventions (français, `useThemeColors()` jamais hardcoded, modals `pageSheet` + drag-to-dismiss, reanimated obligatoire), section Cache (`lib/vault-cache.ts` — bumper `CACHE_VERSION` si nouveau domaine entitlement caché), hiérarchie providers `app/_layout.tsx`.

### Intégration code (existant à brancher)
- `contexts/AIContext.tsx` — point de wrapper d'entitlement pour gater l'IA + appliquer le cap/quota.
- `hooks/useVaultStories.ts` — génération/lecture des histoires du soir ; point d'application du décompte de quota (génération uniquement).
- `lib/vault.ts` / `lib/parser.ts` — I/O vault + parse/serialize ; modèle pour le fichier vault crédits/quota et le flag grandfather.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useThemeColors()` (`contexts/ThemeContext.tsx`)** : couleurs du paywall et bannières — obligatoire, zéro hardcoded.
- **Pattern modal `pageSheet` + drag-to-dismiss** : présent partout (`app/(tabs)/*`, `app/dietary.tsx`) — réutiliser pour le paywall (`components/paywalls/`).
- **`components/ui/` (ModalHeader, Button, Chip, Badge, CollapsibleSection)** : briques UI du paywall.
- **SecureStore via contextes** (`AuthContext`, `ParentalControlsContext`, `StoryVoiceContext`, etc.) : pattern de persistance de prefs — mais ici le compteur/solde va dans le **vault** (D-07), pas SecureStore.
- **`lib/vault-cache.ts`** : si un domaine entitlement stable est mis en cache, bumper `CACHE_VERSION` ; sinon (statut volatil/crédits) l'exclure du cache comme gamification/points.

### Established Patterns
- **Hooks domaine** orchestrés par `hooks/useVault.ts` + `contexts/VaultContext.tsx` (source unique d'état) : le système entitlement/crédits suit ce modèle (hook domaine + expose via contexte).
- **Provider hierarchy** (`app/_layout.tsx`) : `EntitlementProvider` à insérer (probablement après `VaultProvider`, avant/around `AIProvider` pour gater l'IA). À trancher en planning.
- **`parse*`/`serialize*` pairs (`lib/parser.ts`)** : pour lire/écrire le fichier vault crédits/quota + flag grandfather.

### Integration Points
- **`contexts/AIContext.tsx`** : wrapper d'entitlement + check quota avant génération.
- **`hooks/useVaultStories.ts`** : décompte du quota sur génération IA (pas sur relecture cache).
- **Écrans premium** : budget avancé, planif repas/recettes illimitées, `app/impressions.tsx` (export livres PDF), Lightning Wallet (Phase 53), mascotte/ferme/village avancés, carnet santé/courbes/grossesse — points de gate (aperçu + CTA).
- **`app/_layout.tsx`** : ajout du `EntitlementProvider` dans la hiérarchie.

</code_context>

<specifics>
## Specific Ideas

- **Ancrage marketing** (pour cohérence du paywall, pas du copywriting de cette phase) : « Payez une fois. Pour toujours. » — anti-fatigue abonnement, argument unique sans backend.
- **Variante tout-en-un 39,99 €** (lifetime incluant 10 histoires/mois + recharges) évoquée dans la stratégie : NON retenue pour cette phase (voir Deferred), mais l'archi ne doit pas l'interdire.
- **Team Apple `AKMNXGVVGX`** : compte App Store Connect pour configurer les produits.

</specifics>

<deferred>
## Deferred Ideas

- **Abo Histoires** (3,99 €/mois · 24,99 €/an) — reporté à la phase « offres » (Phase C stratégie). L'archi entitlement doit rester extensible (D-12).
- **Variante tout-en-un 39,99 €** — alternative de packaging, non retenue pour la v1 du modèle.
- **Offres saisonnières** (Noël « offrez Premium »), bundles, récupération de churn — Phase C « Optimisation & offres ».
- **Impression livre à l'acte (Lulu)** — revenu additionnel physique, hors infra paiement de cette phase (pipeline PDF existe déjà, Phases 48-51).
- **Nouvelles features premium IA** (voix clonées premium, scan tickets de caisse, suggestions recettes « Cuisiner ce soir », prép RDV IA enrichie) — features à construire dans leurs propres phases ; ici on ne fait que poser le système de gate/crédits qu'elles consommeront.
- **Fallback Haiku / TTS local** si quota API atteint — garde-fou coût secondaire, optionnel (Claude's Discretion).

</deferred>

---

*Phase: 54-monetisation-hybride-paiement*
*Context gathered: 2026-06-24*
