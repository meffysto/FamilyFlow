# Phase 29: Avatars vivants + portail retour - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Peupler la carte `app/(tabs)/village.tsx` d'avatars par profil actif reflétant l'activité hebdo de chacun, et refermer la boucle de navigation avec un portail retour village → ferme visuel + transition fade cross-dissolve cohérente avec l'aller (Phase 28). Aucun changement de schéma de données village (pas de nouveau champ append-only dans `jardin-familial.md`), aucune nouvelle dépendance npm.

Requirements couverts : **VILL-01** (avatar positionné fixe par profil), **VILL-02** (indicateur actif/inactif hebdo), **VILL-03** (bulle tap dismiss auto), **VILL-11** (portail retour visuel symétrique), **VILL-12** (fade cross-dissolve Reanimated 400ms).

Hors scope Phase 29 (reportés milestone v1.5) : décorations persistantes (Phase 30), ambiance jour/nuit + saisons (Phase 31), arbre familial commun (Phase 32).

</domain>

<decisions>
## Implementation Decisions

### Avatars sur la carte village — Style visuel
- **D-01:** Les avatars sur la carte village sont des **sprites compagnon pixel art**, pas d'emojis. On lit `profile.companion.activeSpecies` (5 espèces : chat/chien/lapin/renard/herisson) et on dérive le stade via `getCompanionStage(profileLevel)` depuis `lib/mascot/companion-engine.ts` (bebe/jeune/adulte). Sprites utilisés : `assets/garden/animals/{species}/{stage}/idle_1.png` et `idle_2.png` en alternance pour la respiration (pattern existant dans `components/mascot/CompanionSlot.tsx:95-119` et :730).
- **D-02:** Nouveau composant dédié **`components/village/VillageAvatar.tsx`** (ou `components/mascot/VillageAvatar.tsx` selon la localisation des composants village). Ne réutilise PAS `ReactiveAvatar` qui est emoji-only (`<Animated.Text>`). Props : `{ profile, contributionsThisWeek, isActive, onPress }`. Rend le sprite compagnon en `<Animated.Image>` avec alternance idle_1/idle_2 Reanimated.
- **D-03:** Fallback si `profile.companion` est null/undefined (edge case early game avant déblocage niveau 1) : **skip ce profil** (pas d'avatar affiché). Justification : `COMPANION_UNLOCK_LEVEL = 1`, donc tous les profils actifs dans un usage normal ont déjà un compagnon. Pas de placeholder générique, cohérent avec le principe "on montre ce qui est réellement dans le vault".

### Avatars sur la carte village — Positionnement
- **D-04:** Les positions des avatars sont des **slots fixes dans `VILLAGE_GRID`** (`lib/village/grid.ts`). Ajout de **6 entrées** avec nouveau role `'avatar'` : `village_avatar_slot_0` à `village_avatar_slot_5`. Chaque slot a des coordonnées `{ x, y }` fractionnelles fixes par rapport au conteneur carte.
- **D-05:** Le type `VillageRole` dans `lib/village/types.ts` gagne deux nouveaux rôles : `'avatar'` et `'portal'` (ajoutés à l'union `'fountain' | 'stall' | 'board' | 'portal'` — note : `'portal'` existait déjà dans le type mais n'était pas utilisé dans la grille, on l'utilise enfin).
- **D-06:** **Layout des 6 slots** : répartis autour de la fontaine centrale (0.5/0.45), entre les stalls (0.22/0.65 et 0.78/0.65) et le board (0.15/0.25), sans collision. Proposition initiale (à affiner visuellement dans le plan) :
  - `village_avatar_slot_0` : 0.35/0.40 (gauche fontaine, haut)
  - `village_avatar_slot_1` : 0.65/0.40 (droite fontaine, haut)
  - `village_avatar_slot_2` : 0.30/0.55 (gauche fontaine, milieu-bas)
  - `village_avatar_slot_3` : 0.70/0.55 (droite fontaine, milieu-bas)
  - `village_avatar_slot_4` : 0.40/0.72 (devant, entre stalls)
  - `village_avatar_slot_5` : 0.60/0.72 (devant, entre stalls)
  Le planner peut ajuster ces valeurs après test visuel — l'important est : 6 slots non-collisionnants avec les 4 éléments existants et suffisamment espacés pour que les sprites (~24-32px) ne se chevauchent pas.
- **D-07:** **Assignation profil → slot** : déterministe par tri alphabétique sur `profile.id`. L'index du profil dans `activeProfiles.sort((a,b) => a.id.localeCompare(b.id))` détermine le slot (index 0 → `village_avatar_slot_0`, etc.). Stable entre restarts, pas de persistance mapping dans `jardin-familial.md`, pas de mutation du vault.
- **D-08:** **Edge cases** :
  - Si `activeProfiles.length > 6` : les profils après index 5 ne sont pas affichés (edge case rare — familles standards 2-6 membres).
  - Si `activeProfiles.length < 6` : les slots non utilisés restent vides (pas de placeholder).
  - Nouveau profil ajouté : il prend automatiquement le prochain slot libre après re-tri alphabétique. Possibilité que ça "bouge" un autre profil si le nouvel `id` s'intercale — c'est acceptable vu la rareté (un ajout de profil est un événement rare de setup).

### Avatars sur la carte village — Indicateur actif/inactif (VILL-02) [Claude's Discretion]
- **D-09:** Un profil est **"actif cette semaine"** si `gardenData.contributions` contient au moins une entrée avec `profileId === profile.id` ET dont le `timestamp` tombe dans la semaine courante (`gardenData.currentWeekStart`). Cette détermination est calculée en mémoire (pas de nouveau champ dans le vault).
- **D-10:** **Rendu visuel** laissé à la discrétion de Claude lors du planning, avec cette guidance :
  - **Actif** : halo glow coloré `colors.success` (vert village, cohérent avec la barre de progression village.tsx:354) en fond circulaire derrière le sprite, animé subtilement (pulse léger via `withRepeat` de `withTiming` sur opacity 0.5↔0.8, ~2s). Sprite à opacité pleine.
  - **Inactif** : pas de halo, sprite à opacité réduite (~0.55). Pas d'animation.
  - Le but est de rendre le scan visuel immédiat : "qui a joué cette semaine ?" → les profils actifs brillent, les inactifs sont ternes.

### Bulle tap avatar (VILL-03)
- **D-11:** **Mécanisme** : tooltip absolute-positionné flottant au-dessus de l'avatar tapé, rendu dans `village.tsx` comme overlay au-dessus de la carte (pas via ToastProvider global). Nouveau composant `components/village/AvatarTooltip.tsx` (ou équivalent). State local dans `VillageScreen` : `const [tooltip, setTooltip] = useState<{ profileId, x, y } | null>(null)`.
- **D-12:** **Contenu** : texte mono-ligne `"[Prénom] — X contributions cette semaine"`, avec X = contributions du profil dans `currentWeekStart`. Si X === 0 : `"[Prénom] — pas encore contribué"` (pour ne pas afficher "0 contributions" qui sonne négatif).
- **D-13:** **Dismiss** : auto après **2.5 secondes** (setTimeout stocké dans un ref, cleared au unmount ou au tap suivant). Tap sur un autre avatar → dismiss immédiat et ouvre le nouveau tooltip. Tap en dehors → dismiss immédiat via overlay transparent de la zone tooltip (ou simplement replacer le state à `null`).
- **D-14:** **Animation entrée/sortie** : Reanimated `withTiming`. Entrée : opacity 0→1 + translateY -4→0 en 180ms. Sortie : opacity 1→0 + translateY 0→-4 en 150ms. Aligné avec les conventions projet (`useSharedValue` + `useAnimatedStyle`, pas RN Animated).
- **D-15:** **Interaction avec l'avatar** : le `VillageAvatar` est wrappé dans un `Pressable`/`TouchableOpacity` (hitSlop pour zone de tap large), `onPress` déclenche `Haptics.selectionAsync()` + set du state tooltip avec la position calculée à partir du slot.

### Portail retour village → ferme (VILL-11)
- **D-16:** **Sprite** : pixel art **`assets/items/portail.png`** (existant, 178 KB, spirale magique violet/beige). Le même sprite est utilisé des deux côtés de la navigation (symétrie visuelle). Rendu via `<Image source={require('@/assets/items/portail.png')} />`.
- **D-17:** **Remplacement obligatoire côté ferme** : dans `app/(tabs)/tree.tsx:357`, l'emoji `<Text style={styles.portalEmoji}>🏛️</Text>` est **remplacé par le même sprite `portail.png`**. Justification : le requirement VILL-11 impose symétrie, et le user a explicitement demandé pixel art des deux côtés ("pas d'emojis pour les avatars ni pour le portail"). L'animation glow loop + scale spring existante de `PortalSprite` est conservée — seul le `<Text emoji>` devient `<Image>`.
- **D-18:** **Position sur la carte village** : nouvelle entrée dans `VILLAGE_GRID` avec id `village_portal_home` et role `'portal'`. Coordonnées proposées : `{ x: 0.85, y: 0.85 }` (coin bas-droit), à ajuster par le planner selon rendu visuel. Ne doit pas collisionner avec les 6 slots avatars ni avec fountain/stalls/board.
- **D-19:** **Suppression du bouton header `‹`** : dans `app/(tabs)/village.tsx:407-418`, le `TouchableOpacity` `styles.backBtn` est supprimé, ainsi que l'arrow `‹`. Le header conserve uniquement le titre "Place du Village" centré. Le portail devient le **seul point de sortie** vers la ferme — coherent avec Phase 28 D-08 qui a établi le même principe pour l'entrée ("un seul point d'entrée vers le village : le portail").
- **D-20:** **Composant portail village** : nouveau composant `components/village/VillagePortalHome.tsx` (ou mutualisation avec le `PortalSprite` de tree.tsx dans `components/village/PortalSprite.tsx` partagé). Décision d'architecture laissée au planner : soit on duplique la logique glow + scale spring, soit on extrait `PortalSprite` dans un composant partagé consommé par les deux écrans. Recommandation : **extraire** dans `components/mascot/PortalSprite.tsx` (ou `components/village/PortalSprite.tsx`) avec prop `onPress`, réutilisé par tree.tsx ET village.tsx. Un seul point de vérité pour le glow animé + pixel art sprite.

### Transition fade cross-dissolve retour (VILL-12)
- **D-21:** **Animation** : `screenOpacity` sharedValue dans `VillageScreen` (symétrique à tree.tsx:408-409), `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })`, callback `runOnJS(router.replace)('/(tabs)/tree')`. Durée 400ms exacte comme l'aller (Phase 28 D-02).
- **D-22:** **Reset au focus** : `useFocusEffect` qui reset `screenOpacity.value = 1` quand l'écran village regagne le focus (symétrique à tree.tsx:422-425). Gère le cas où l'user revient au village via le portail ferme.
- **D-23:** **Navigation** : `router.replace('/(tabs)/tree')` (conserve le pattern actuel de village.tsx:409, évite l'empilement de stack infini sur ping-pong ferme↔village). L'aller utilise `router.push` (tree.tsx:417) qui reste inchangé — la combinaison push-aller / replace-retour donne un stack propre.

### Claude's Discretion
- **CD-01 (D-10)** : Couleur exacte, intensité et durée de l'animation pulse du halo actif. Guidance : `colors.success` de `useThemeColors()`, pulse subtil ~2s via `withRepeat(withTiming, -1, true)`.
- **CD-02 (D-06)** : Coordonnées fines des 6 slots avatars — les valeurs proposées (0.35/0.40 etc.) sont un point de départ, le planner peut ajuster après test visuel sur device pour éviter chevauchement avec fountain/stalls/board.
- **CD-03 (D-18)** : Coordonnées fines du slot `village_portal_home` — 0.85/0.85 proposé, ajustable.
- **CD-04 (D-20)** : Mutualisation ou duplication du composant `PortalSprite` entre tree.tsx et village.tsx. Recommandation forte pour mutualiser, mais le planner évalue le coût de refacto.
- **CD-05** : Tailles exactes des sprites sur la carte (compagnons ~24-32px, portails ~40-56px) — ajustables selon lisibilité sur device physique.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Infrastructure village existante (Phases 25-28)
- `lib/village/types.ts` — `VillageRole`, `VillageCell`, `VillageData`, `VillageContribution`, `ContributionType`. **Sera étendu en Phase 29** : nouveaux rôles `'avatar'` et usage effectif de `'portal'`.
- `lib/village/grid.ts` — `VILLAGE_GRID: VillageCell[]` actuelle (fountain, 2 stalls, board). **Sera étendue en Phase 29** : +6 slots avatars + 1 portail retour.
- `lib/village/parser.ts` — `parseGardenFile`, `serializeGardenFile`, `appendContributionToVault`, `VILLAGE_FILE`. Aucun changement attendu en Phase 29 (pas de nouveau champ persisté).
- `hooks/useGarden.ts` — `gardenData.contributions[]`, `gardenData.currentWeekStart`, `progress`, `isGoalReached`. Source unique pour calcul "actif cette semaine" (D-09).
- `.planning/phases/25-fondation-donnees-village/25-CONTEXT.md` — Décisions schéma vault + grille initiale
- `.planning/phases/26-hook-domaine-jardin/26-CONTEXT.md` — Décisions useGarden
- `.planning/phases/27-cran-village-composants/27-CONTEXT.md` — Décisions écran village initial (D-01 à D-10)
- `.planning/phases/28-portail-c-blage-contributions/28-CONTEXT.md` — Décisions portail ferme→village (D-01 à D-08)

### Écran village existant
- `app/(tabs)/village.tsx` — `VillageScreen` complet (833 lignes). Points de modification Phase 29 :
  - §407-418 : **supprimer** le `backBtn` header (D-19)
  - §427-440 : TileMapRenderer + ajout overlay avatars au-dessus
  - §337-341 : `activeProfiles = profiles.filter(p => p.statut !== 'grossesse')` — réutiliser pour les avatars map
  - §329-335 : `memberContribs` — source pour le compte de contributions/profil
  - §291-306 : `useGarden()` déstructuré — source `gardenData.contributions`

### Écran ferme (portail aller — à modifier côté sprite)
- `app/(tabs)/tree.tsx:303-361` — `PortalSprite` composant actuel (glow loop + scale spring + emoji 🏛️). **Modification Phase 29** : remplacer `<Text>🏛️</Text>` §357 par `<Image source={require('@/assets/items/portail.png')} />` (D-17).
- `app/(tabs)/tree.tsx:407-425` — `handlePortalPress` + `useFocusEffect` opacity reset (référence pattern à dupliquer symétriquement côté village).
- `app/(tabs)/tree.tsx:2129-2130` — `<PortalSprite onPress={handlePortalPress} />` dans le diorama ferme.

### Système compagnons (source pour avatars map)
- `lib/mascot/companion-types.ts` — `CompanionSpecies` (5 espèces), `CompanionStage` (bebe/jeune/adulte), `CompanionData`, `COMPANION_UNLOCK_LEVEL = 1`, `COMPANION_STAGES`.
- `lib/mascot/companion-engine.ts` — `getCompanionStage(level: number): CompanionStage`. Utilisé pour dériver le stade visuel à partir de `profile.level`.
- `components/mascot/CompanionSlot.tsx:95-119` — Pattern `COMPANION_SPRITES` (mapping species×stage → idle_1/idle_2 require). À répliquer dans `VillageAvatar.tsx`.
- `components/mascot/CompanionSlot.tsx:730` — Pattern alternance idle_1/idle_2 pour respiration. À répliquer.
- `components/mascot/CompanionAvatarMini.tsx` — Référence existante mais actuellement fallback emoji — ne PAS utiliser telle quelle pour Phase 29.
- `assets/garden/animals/{chat|chien|lapin|renard|herisson}/{bebe|jeune|adulte}/idle_1.png` et `idle_2.png` — Sprites confirmés existants.

### Profils & types
- `lib/types.ts:91` — `Profile.companion?: CompanionData | null`
- `lib/types.ts:584` — Second usage (possiblement guest profile)
- `hooks/useVault.ts:272,1448` — `setCompanion`, `gamiData`, `profile.level`, etc.

### Assets portails
- `assets/items/portail.png` — Sprite pixel art spirale magique (178 KB) — à utiliser dans les deux sens (D-16, D-17).
- (Non utilisé) `assets/items/cabane.png` — Alternative écartée (D-17 symétrique).

### Composants UI réutilisables
- `components/mascot/TileMapRenderer.tsx` — `StyleSheet.absoluteFill` + `pointerEvents="none"`. **Important** : les avatars et portail retour sont rendus comme **siblings absolute-positioned** au-dessus du TileMapRenderer dans le même parent (`styles.mapContainer` de village.tsx:430), PAS comme children (renderer est pointerEvents none).
- `components/ui/ReactiveAvatar.tsx` — Composant existant emoji-only. **Ne PAS réutiliser** pour les avatars carte village (D-01). Peut rester pour la section "Membres actifs" du panneau scrollable (village.tsx:524-553) qui utilise emoji `profile.avatar` — hors scope Phase 29.
- `contexts/ThemeContext.tsx` — `useThemeColors()` → `{ colors: { success, text, textMuted, card, bg, warning } }`.
- `react-native-reanimated` — `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withRepeat`, `withSpring`, `runOnJS`, `Easing.out(Easing.ease)`.
- `expo-router` — `useRouter()`, `router.replace`, `useFocusEffect`.
- `expo-haptics` — `Haptics.selectionAsync()` pour le tap avatar et le tap portail.

### Conventions projet
- `CLAUDE.md` — Stack, conventions, patterns animations, hierarchy providers, conventions langue FR, dates JJ/MM/AAAA
- `.planning/codebase/ARCHITECTURE.md` — Architecture générale (si besoin d'une vue d'ensemble)
- `.planning/codebase/CONVENTIONS.md` — Styles/naming/patterns
- `.planning/REQUIREMENTS.md` — Définition des 12 REQ-IDs v1.5 et traceability

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (à consommer directement)
- `profile.companion: CompanionData | null` — déjà dans le type Profile, lu via `useVault().profiles`
- `getCompanionStage(level)` — retourne 'bebe'/'jeune'/'adulte' selon niveau
- Sprites `assets/garden/animals/{species}/{stage}/idle_{1,2}.png` — pattern `require()` confirmé fonctionnel dans CompanionSlot.tsx
- `VILLAGE_GRID` de `lib/village/grid.ts` — à étendre avec 6 slots avatars + 1 portail retour
- `TileMapRenderer` mode='village' — inchangé, les avatars se rendent en overlay au-dessus
- `gardenData.contributions[]` + `gardenData.currentWeekStart` — source "qui a contribué cette semaine"
- `memberContribs` memo déjà calculé dans village.tsx:329-335 — total global par profil, utile pour la bulle tooltip (mais la bulle affiche les contributions de la SEMAINE — nouveau memo à calculer)
- `activeProfiles` memo déjà calculé dans village.tsx:337-341 — filtre grossesse, à trier alphabétique pour l'assignation slot
- `colors.success` via `useThemeColors()` — vert village, pour halo actif
- `Haptics.selectionAsync()` — feedback tactile tap avatar + tap portail
- `PortalSprite` de tree.tsx:303-361 — logique glow + scale spring **à extraire en composant partagé** (CD-04)
- `screenOpacity` + `runOnJS(router.push)` pattern de tree.tsx:407-425 — à dupliquer symétriquement dans village.tsx avec `router.replace`

### Established Patterns
- **Animations Reanimated** : `useSharedValue` + `useAnimatedStyle` + `withTiming`/`withSpring`/`withRepeat`. Spring config en constante module (`const SPRING_CONFIG = { damping, stiffness }`). Pattern cancellation via cleanup effect.
- **Alternance sprites** : CompanionSlot.tsx utilise `frameIdx` state qui toggle via `setTimeout` 500ms pour alterner idle_1/idle_2.
- **Overlay absolute sur map** : le renderer est `pointerEvents="none"`, les éléments interactifs sont positionnés en absolute dans le même parent container (`styles.mapContainer`). Calcul des pixels : `x * containerWidth`, `y * containerHeight`.
- **Navigation expo-router avec animation** : sharedValue opacity + callback `runOnJS` dans le withTiming. `useFocusEffect` pour reset au retour.
- **Haptics** : `Haptics.selectionAsync()` pour tap léger, `Haptics.impactAsync()` pour feedback plus marqué.
- **Theme colors dynamiques** : inline avec `useThemeColors()` pour tout ce qui dépend du thème, `StyleSheet.create()` pour les valeurs statiques (layout, spacing).
- **Conventions langue** : français UI + commits + commentaires. Prénoms génériques dans les commits publics (pas de vrais noms famille).

### Integration Points
- `app/(tabs)/village.tsx` :
  - Supprimer `backBtn` du header (§407-418)
  - Ajouter overlay `<VillageAvatar />` × 6 au-dessus du `<TileMapRenderer />` dans `styles.mapContainer` (§429-440)
  - Ajouter overlay `<PortalSprite onPress={handleReturnPortal} />` dans le même container
  - Ajouter state `tooltip` + overlay `<AvatarTooltip />` conditionnel
  - Ajouter `screenOpacity` sharedValue + `handleReturnPortal` callback fadeout 400ms + `router.replace`
  - Ajouter `useFocusEffect` reset opacity
  - Ajouter memo `weeklyContribs` par profil (contributions de la semaine courante, distinct de `memberContribs` global)
- `app/(tabs)/tree.tsx:357` : remplacer `<Text>🏛️</Text>` par `<Image source={require('@/assets/items/portail.png')} />` (ajuster styles.portalEmoji → nouveau style portalImage avec width/height pixel art).
- `lib/village/grid.ts` : ajouter 7 entrées (6 avatar + 1 portal).
- `lib/village/types.ts` : étendre `VillageRole` avec `'avatar'` (le role `'portal'` existe déjà).
- Nouveau fichier : `components/village/VillageAvatar.tsx` (ou `components/mascot/VillageAvatar.tsx`) — sprite compagnon + halo + pressable
- Nouveau fichier : `components/village/AvatarTooltip.tsx` — tooltip absolute
- Nouveau fichier (recommandé) : `components/village/PortalSprite.tsx` — extraction commune avec tree.tsx

### Contraintes infra (non-négociables)
- **Zéro nouvelle dépendance npm** (ARCH-05 respecté sur 4 phases v1.4)
- **Backward compat Obsidian vault** : aucun nouveau champ dans `jardin-familial.md` pour Phase 29. Les slots avatars sont calculés en mémoire à partir des données existantes.
- **react-native-reanimated obligatoire** (pas RN Animated)
- **Pas de refonte TileMapRenderer** : c'est un `pointerEvents="none"` stable, on overlay dessus
- **Stabilité TestFlight** : Phase 29 ne doit pas régresser la ferme ni le village existants. Le remplacement emoji→sprite du portail aller (D-17) doit être testé en priorité.

</code_context>

<specifics>
## Specific Ideas

- **Symétrie visuelle aller/retour** : le même sprite `portail.png` des deux côtés renforce l'idée narrative "même passage magique, deux directions". Cohabite avec le fade cross-dissolve 400ms qui donne un effet "traversée". Le user a explicitement insisté là-dessus.
- **Avatars compagnon, pas emoji** : le village doit être vivant avec des **personnages pixel art animés** (chats, chiens, lapins, renards, hérissons selon le compagnon de chaque membre), pas des têtes emoji. C'est un signal fort sur l'identité visuelle du milestone v1.5 : on s'engage sur le pixel art propriétaire au détriment des emojis Apple.
- **Actif cette semaine = au moins 1 contribution** : pas de seuil, pas de ratio, pas de proportion. Un seul harvest ou une seule tâche suffit pour qu'un profil soit "vivant" cette semaine. C'est l'inclusion maximale — on célèbre la participation, pas la performance (cohérent avec Phase 28 D-07 "équitable, pas proportionnel").
- **Le portail est le seul point d'entrée ET le seul point de sortie** du village — principe de symétrie narrative. Le bouton `‹` header actuel disparaît, le portail magique devient le seul rituel de passage dans les deux sens.
- **Alternance idle_1/idle_2 pour la respiration** : pattern existant dans CompanionSlot.tsx à répliquer. Pas besoin d'animations marche ou autre — statique respirant est suffisant sur la place du village (les avatars "habitent" un lieu, ils ne se déplacent pas).

</specifics>

<deferred>
## Deferred Ideas

- **Indicateur actif/inactif visuel final** — partiellement discuté, laissé en Claude's Discretion (D-10 guidance). Si le rendu implémenté ne plaît pas, re-discuter avant Phase 30.
- **Tailles exactes sprites** — ajustables après test visuel, pas bloquant (CD-05).
- **Interactions inter-avatars** — VILL-14 future deferred (membres qui "se croisent" animé), pas dans v1.5 v1.
- **Personnalisation manuelle placement** — VILL-15 future deferred (enfants qui placent décos), pas dans v1.5 v1.
- **Animations marche des avatars** — explicitement Out of Scope (v1.5 Requirements) : "Positions fixes, pas de pathfinding".
- **Fallback profil sans compagnon** — si un user report remonte cet edge case, revoir D-03 (actuellement : skip le profil).
- **Placement manuel / édition slots avatars** — si dans le futur le user veut déplacer "son" avatar, ça devient VILL-15 territory.
- **Nouveau sprite portail dédié ferme vs village** — écarté par D-17 (portail.png symétrique). Si le user change d'avis, trivial à changer.
- **Bulle riche (ajout rôle, emoji, etc.)** — écarté en zone 2, restera comme est.

</deferred>

---

*Phase: 29-avatars-vivants-portail-retour*
*Context gathered: 2026-04-11*
