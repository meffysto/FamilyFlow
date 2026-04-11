# Phase 30: Constructions persistantes - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Transformer chaque palier de feuilles gagnées par la famille en **bâtiment pixel art permanent** ajouté à la carte village (`app/(tabs)/village.tsx`). Persistance append-only dans `jardin-familial.md` (nouvelle section `## Constructions`), catalogue UI accessible en modal depuis le header village listant les 8 bâtiments par palier.

Requirements couverts : **VILL-04** (nouveau bâtiment à chaque palier franchi), **VILL-05** (persistance restart append-only), **VILL-06** (catalogue 8 bâtiments).

**Scope shift assumé vs REQUIREMENTS.md** : la formulation initiale "décoration (guirlande, fanion, lanterne, banc)" est élargie à **"bâtiment"** (puits, boulangerie, marché, café, forge, moulin, port, bibliothèque). L'intention "trace visuelle persistante de la progression collective" est mieux servie par des bâtiments qui transforment le village en vraie ville qui grandit, plutôt que par des décorations ponctuelles. REQUIREMENTS.md "etc." dans la liste d'exemples est suffisamment flexible.

**Scope shift trigger vs REQUIREMENTS.md** : la formulation initiale "palier de streak collectif (1, 3, 5, 10, 15, 20, 25, 30 semaines)" est remplacée par **"palier de feuilles gagnées lifetime famille"** (`sum(profile.points)` sur tous les profils). Rationale : les feuilles lifetime sont monotones croissantes (jamais de régression, pas de risque de pénalisation en cas de semaine ratée), plus faciles à calculer, et reflètent mieux "l'activité économique totale de la famille" plutôt qu'une ponctualité qui stresse les parents.

Hors scope Phase 30 (reportés milestone v1.5) : ambiance jour/nuit + saisons (Phase 31), arbre familial commun (Phase 32), personnalisation manuelle du placement (VILL-15 deferred).

</domain>

<decisions>
## Implementation Decisions

### Catalogue & sprites — Liste des 8 bâtiments

- **D-01:** Les 8 bâtiments sont des **sprites pixel art pleine couleur**, générés via MCP pixellab (pattern Phase 29.1 : `create_map_object` 128×128 transparent). Aucun asset existant dans `assets/items/` ne correspond à un bâtiment de ville — génération complète nécessaire. Style prompt unifié : `"cozy medieval fantasy village building, stone and wood, warm colors, standalone transparent background, no ground, no grass, side view pixel art"`.
- **D-02:** **Liste verrouillée** des 8 bâtiments avec id interne et label FR :

  | # | id | Label FR | Prompt detail |
  |---|-----|----------|----------------|
  | 1 | `puits` | Puits | "small stone water well with wooden roof and bucket" |
  | 2 | `boulangerie` | Boulangerie | "small medieval bakery with stone chimney and bread sign" |
  | 3 | `marche` | Marché | "small wooden market stall with striped awning and fruit baskets" |
  | 4 | `cafe` | Café | "small cozy tavern with wooden sign and warm window glow" |
  | 5 | `forge` | Forge | "blacksmith forge with stone anvil and glowing fire" |
  | 6 | `moulin` | Moulin | "small windmill with wooden blades on stone base" |
  | 7 | `port` | Port | "small wooden fishing pier with lantern and fishing nets" |
  | 8 | `bibliotheque` | Bibliothèque | "small medieval library with stone walls and round window" |

- **D-03:** **Fichiers sprites** stockés dans `assets/buildings/village/` (nouveau sous-dossier à créer) : `puits.png`, `boulangerie.png`, `marche.png`, `cafe.png`, `forge.png`, `moulin.png`, `port.png`, `bibliotheque.png`. **IMPORTANT** : sous-répertoire `village/` obligatoire car `assets/buildings/` contient déjà les bâtiments ferme (`grange.png`, `moulin.png`, `poulailler.png`, etc. + variantes `_lv1/2/3`) — collision de noms sur `moulin.png`. Pattern aligné avec `assets/items/portail-v2.png` Phase 29.1 pour la provenance pixellab.
- **D-04:** **Génération pré-plan** : les 8 sprites sont générés par le discuss-phase orchestrator (pas le planner) et committés comme asset avant le plan. Le plan n'a donc pas à s'occuper de la génération, seulement du wiring.

### Catalogue & sprites — Trigger et paliers

- **D-05:** **Métrique de déblocage** : somme des `profile.points` sur tous les profils actifs de la famille (= feuilles lifetime gagnées, monotone croissant). Calculée dans `useGarden` via `useVault().profiles` :
  ```ts
  const familyLifetimeLeaves = profiles.reduce((sum, p) => sum + (p.points ?? 0), 0);
  ```
  `profile.points` est déjà exposé dans `useVaultProfiles` et persisté dans `gami-{profileId}.md`. Aucune nouvelle donnée à tracker.
- **D-06:** **Paliers** (progression douce, visée ~6-12 mois d'usage actif pour atteindre le dernier) :

  | # | Bâtiment | Palier (feuilles famille) |
  |---|----------|----------------------------|
  | 1 | Puits | **100** |
  | 2 | Boulangerie | **300** |
  | 3 | Marché | **700** |
  | 4 | Café | **1 500** |
  | 5 | Forge | **3 000** |
  | 6 | Moulin | **6 000** |
  | 7 | Port | **12 000** |
  | 8 | Bibliothèque | **25 000** |

- **D-07:** **Ordre narratif** (pas lié à la taille visuelle) : progression "hameau → ville vivante" — d'abord les besoins fondamentaux (eau, nourriture, commerce), puis le social (café), puis l'artisanat (forge, moulin), puis l'ouverture (port) et enfin la culture (bibliothèque). Cohérent avec le style "cozy medieval fantasy village".
- **D-08:** **Comportement si régression** : non-applicable — `profile.points` est monotone croissant (XP lifetime, jamais déduit). Si un profil est supprimé, la somme famille baisse et un bâtiment pourrait "techniquement" repasser sous son palier — mais les bâtiments déjà débloqués restent **dans le fichier append-only**, ils ne sont jamais retirés. Une fois débloqué, un bâtiment est acquis à vie, même si la métrique actuelle repasse en dessous.

### Placement sur la carte

- **D-09:** **8 slots fixes dédiés** dans `VILLAGE_GRID` (`lib/village/grid.ts`), rôle `'building'` (nouveau à ajouter à l'union `VillageRole`). Nomenclature : `village_building_puits`, `village_building_boulangerie`, etc. (1 slot = 1 bâtiment prédéterminé). Déterministe, cohérent avec le pattern `village_avatar_slot_N` de Phase 29.
- **D-10:** **Zone de placement** : **périphérie** de la carte — bords haut, gauche, droite, avec respect des slots existants (fountain 0.5/0.45, 2 stalls, board 0.15/0.25, 6 avatars centrés, portail 0.85/0.85). La fontaine et les avatars restent le centre de gravité visuel, les bâtiments encadrent.
- **D-11:** **Coordonnées fractionnelles proposées** (à calibrer visuellement dans le plan) :

  | Bâtiment | x | y | Rationale |
  |----------|---|---|-----------|
  | Puits | 0.08 | 0.15 | Coin haut-gauche, discret |
  | Boulangerie | 0.22 | 0.10 | Haut, à côté du board (board=0.15/0.25) |
  | Marché | 0.45 | 0.08 | Haut-centre, bien visible |
  | Café | 0.68 | 0.10 | Haut-droit |
  | Forge | 0.90 | 0.20 | Bord droit, haut |
  | Moulin | 0.08 | 0.50 | Bord gauche, milieu |
  | Port | 0.45 | 0.92 | Bas-centre (bord inférieur, près des stalls) |
  | Bibliothèque | 0.92 | 0.55 | Bord droit, milieu (entre forge et portail retour 0.85/0.85) |

  **Calibration finale au plan** : le planner ajuste visuellement ces coords après test device pour garantir zéro collision avec les slots existants (avatars, stalls, fountain, board, portail). Cible : marge minimale 48px entre centres de slots.
- **D-12:** **Taille rendu** : **72×72** (cohérent avec portail Phase 29.1 rendu 64px, avatars 48px). Les bâtiments sont légèrement plus grands que le portail pour refléter leur "statut" architectural. Source 128×128 → scale-down.
- **D-13:** **Tap bâtiment = tooltip nom + description courte** — pattern identique à `AvatarTooltip` Phase 29. Nouveau composant `components/village/BuildingTooltip.tsx` OU extension de `AvatarTooltip` pour accepter une prop `variant: 'avatar' | 'building'`. **Claude's discretion** : la décision extraction vs extension dépendra de la divergence du contenu (si bâtiment nécessite juste un titre différent, extension ; si contenu structuré différent, extraction). Auto-dismiss 2.5s comme avatars, Haptics.selectionAsync au tap.
- **D-14:** **Contenu tooltip bâtiment** : `"[Label FR] — Débloqué à {palier} feuilles familiales"`. Exemple : `"Café — Débloqué à 1 500 feuilles familiales"`.

### Catalogue UI (VILL-06)

- **D-15:** **Forme** : **modal plein écran pageSheet** (pattern CLAUDE.md standard : `presentation: 'pageSheet'` + drag-to-dismiss). Pas de nouvelle route expo-router. Ouverture via bouton dans le header de `village.tsx` — nouvelle icône (ex : `🏘️` via `MaterialCommunityIcons` name `"castle"` ou `"home-city"`) positionnée côté droit du header.
- **D-16:** **Localisation du composant** : `components/village/BuildingsCatalog.tsx` (ou équivalent). Consomme `gardenData.unlockedBuildings` + `familyLifetimeLeaves` + liste statique `BUILDINGS_CATALOG` pour rendre les 8 tuiles.
- **D-17:** **Layout** : **grille 2 colonnes** (8 items → 4 lignes). Chaque tuile montre :
  - Sprite centré (96×96, légèrement plus grand que le rendu village pour le catalogue)
  - Label FR en dessous (`Typography.titleSmall` ou équivalent token)
  - Statut : soit "Débloqué" (couleur success) soit "À {palier} feuilles" (couleur textMuted)
  - Pour verrouillés : progression `{familyLifetimeLeaves}/{palier}` en petit
- **D-18:** **État verrouillé** : sprite rendu en **silhouette sombre** (filter ou tint noir/gris, ex : `tintColor: colors.textMuted` avec `opacity: 0.4`). Nom FR visible (pas de mystère). Palier de déblocage affiché. Progression actuelle `{current}/{target}` visible. Motivation par la transparence.
- **D-19:** **Feedback déblocage** : badge **"Nouveau ✨"** sur les tuiles de bâtiments débloqués mais pas encore vus par l'utilisateur.
  - Persistence : champ `lastSeenBuildingsUnlock: string` dans les préférences `expo-secure-store` (non dans le vault car c'est une préférence UI locale par appareil).
  - Au mount du catalogue : compare `unlockedBuildings[]` à `lastSeenBuildingsUnlock` et flag les nouveaux.
  - Animation : scale spring (`withSpring` damping 12 stiffness 180) + opacity fade sur la tuile nouvelle au rendu.
  - Au close du catalogue : update `lastSeenBuildingsUnlock = now()` pour ne plus re-flagger les mêmes.
- **D-20:** **Tooltip vs tap sur tuile catalogue** : tap sur tuile **débloquée** = anim subtile + tooltip détail (ou aucun si déjà toutes infos visibles). Tap sur tuile **verrouillée** = toast "Encore {remaining} feuilles" + haptic. Décidé dans le plan selon la densité d'information de la tuile par défaut.

### Schéma de persistance append-only [Claude's Discretion]

- **D-21:** **Nouvelle section** dans `jardin-familial.md` : `## Constructions` (insérée avant `## Historique`). Format de ligne : `- {timestamp ISO} | {building_id} | {palier}` — exemple : `- 2026-04-12T14:32:00 | puits | 100`.
- **D-22:** **Étendre `VillageData`** dans `lib/village/types.ts` avec un champ `unlockedBuildings: UnlockedBuilding[]` où `UnlockedBuilding = { timestamp, buildingId, palier }`. Parser/serializer mis à jour dans `lib/village/parser.ts` (nouvelle fonction `appendBuilding` miroir de `appendContribution`).
- **D-23:** **Déclenchement du unlock** : dans `hooks/useGarden.ts`, effet reactif qui détecte quand `familyLifetimeLeaves` franchit un palier (comparaison à la liste statique `BUILDINGS_CATALOG`). Si un palier est franchi ET que `unlockedBuildings` ne contient pas déjà le `buildingId` correspondant → append au vault. **Idempotence** : si le building est déjà dans `unlockedBuildings`, skip silencieux.
- **D-24:** **Claude's discretion sur le timing du check** : au mount de `useGarden` (lazy), ou dans un effet qui écoute les changements de `familyLifetimeLeaves`, ou au moment du claim hebdo (`claimReward`). Le planner choisit selon les patterns existants de `useGarden`.

### Claude's Discretion

- **Choix final composant tooltip** (extension `AvatarTooltip` vs nouveau `BuildingTooltip`) — dépend de la divergence structurelle du contenu, décision au plan.
- **Calibration visuelle finale** des 8 coords building après test device (les coords D-11 sont des propositions).
- **Icône header exact** pour le bouton catalogue (MaterialCommunityIcons `castle` / `home-city` / autre) selon cohérence visuelle avec les autres icônes header.
- **Timing exact du check palier franchi** dans `useGarden` (mount vs effet réactif vs claimReward).
- **Animation précise du badge "Nouveau"** — spring config, durée, stagger entre tuiles si plusieurs nouveaux.

### Folded Todos

Aucun todo backlog remonté lors du cross-reference pour Phase 30.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Données village + append-only
- `lib/village/types.ts` — `VillageData`, `VillageRole`, `VillageCell`, `VillageContribution` (à étendre avec `'building'` role + `unlockedBuildings` champ)
- `lib/village/parser.ts` — `parseGardenFile`, `serializeGardenFile`, `appendContribution` (modèle pour `appendBuilding`). **Pitfall 4** : jamais append en fin de fichier, toujours avant la section suivante.
- `lib/village/grid.ts` — `VILLAGE_GRID` actuel (11 slots existants : fountain, 2 stalls, board, 6 avatars, portail retour)
- `lib/village/activities.ts` — patterns de consommation de `gardenData`

### Intégration avec feuilles / profils
- `hooks/useGarden.ts` — source unique d'état village, où brancher le unlock-on-threshold
- `hooks/useVaultProfiles.ts` — `profiles[]` avec `profile.points` (XP lifetime, jamais décroissant)
- `contexts/VaultContext.tsx` — provider, `useVault()` hook source

### Village screen et patterns UI Phase 29
- `app/(tabs)/village.tsx` — écran cible, déjà câblé avec `TileMapRenderer` + overlay avatars Phase 29
- `components/village/VillageAvatar.tsx` — pattern component Phase 29 pour sprite pixel art positionné
- `components/village/AvatarTooltip.tsx` — pattern tooltip auto-dismiss 2.5s (modèle pour BuildingTooltip)
- `components/village/PortalSprite.tsx` — pattern `<Image source={require('../../assets/items/portail-v2.png')}>` pour sprite pixellab

### Phase 29 CONTEXT (décisions héritées)
- `.planning/phases/29-avatars-vivants-portail-retour/29-CONTEXT.md` — D-01 à D-23 Phase 29 (sprites pixel art, placement fractionnel, Reanimated uniquement)

### Projet / conventions
- `CLAUDE.md` — conventions FR, `useThemeColors()`, Reanimated only, tokens `Spacing/Radius/Typography`, modals `pageSheet` + drag-to-dismiss, `expo-haptics`, `expo-secure-store`
- `.planning/REQUIREMENTS.md` §VILL-04/05/06 — acceptance criteria + note scope shifts (décoration→bâtiment, streak→feuilles lifetime)
- `.planning/ROADMAP.md` §Phase 30 — goal + success criteria
- `constants/spacing.ts`, `constants/typography.ts`, `constants/shadows.ts` — tokens utilisables

### Existing pipelines utiles
- `lib/gamification/` — XP / levels / rewards engine (pour contexte `profile.points`)

</canonical_refs>

<specifics>
## Specific Ideas

- **Pixellab pipeline Phase 29.1** : MCP wrapper OAuth cassé, contournement direct via curl avec Bearer token `88b6135f-0f93-461a-b1a8-a94eb5d35239` (stocké en `~/.claude.json`). Outil `create_map_object` 128×128 transparent prend ~30-90s par génération. Les 8 bâtiments Phase 30 sont générés par l'orchestrator discuss-phase (pas le planner) et committés AVANT le plan.
- **Style unifié verrouillé** : `"cozy medieval fantasy village building, stone and wood, warm colors, standalone transparent background, no ground, no grass, side view pixel art"` — à réutiliser verbatim comme préfixe commun.
- **Bordure "zone verte"** : Phase 29.1 a rencontré une petite touffe d'herbe résiduelle sur `portail-v2.png` malgré le prompt. À 64-72px de rendu final, ce détail devient invisible. Accepté comme fatality du modèle pixellab si ça se répète.
- **Familie standard 2-6 profils** : la métrique feuilles lifetime famille reste cohérente même avec 1 profil ou 6 profils. Pas de normalisation par nombre de profils (volontaire — plus de joueurs = progression plus rapide).

</specifics>

<deferred>
## Deferred Ideas

- **VILL-13 Météo dynamique village** — deferred Phase v1.6+ (indépendant saisons)
- **VILL-14 Interactions inter-avatars** — deferred, nécessite pathfinding
- **VILL-15 Personnalisation manuelle placement** — deferred, casse le déterminisme `VILLAGE_GRID`
- **Thème narratif alternatif (Studio Ghibli / contemporain)** — utilisateur a validé "fantasy médiéval chaleureux", autres styles non retenus
- **Modal vs route dédiée pour catalogue** — utilisateur a choisi modal pageSheet, route deferred
- **Carrousel horizontal pour catalogue** — abandonné, grille 2 colonnes retenue
- **Bottom sheet pour catalogue** — abandonné, modal pageSheet retenu (pattern standard CLAUDE.md)
- **Tap bâtiment ouvre catalogue** — abandonné, tap = tooltip local (cohérent avec avatars)
- **Réduction taille bâtiments 48-56px** — abandonné, 72px retenu pour présence visuelle
- **Anchors par type / zone thématique** — abandonné, slots fixes dédiés retenus
- **Placement aléatoire déterministe (hash)** — abandonné, contrôle visuel insuffisant
- **Mystery box verrouillés (silhouette '?')** — abandonné, silhouette sombre + nom visible retenu
- **Toast popup in-village au déblocage** — abandonné, badge "Nouveau" dans catalogue retenu
- **Aucun feedback déblocage** — abandonné, risque de rater le moment
- **Mapping palier → taille visuelle (progressif)** — abandonné, ordre thématique narratif retenu
- **Paliers hebdomadaires (1, 3, 5, 10, 15, 20, 25, 30 semaines)** — abandonné, remplacé par paliers feuilles lifetime famille (100 à 25000). Nécessite mise à jour REQUIREMENTS.md avant le plan.
- **Réutilisation assets existants (balancoire, cabane, guirlandes, hamac, lanterne, nid, cristal, couronne)** — abandonné, scope shift vers bâtiments génère tous nouveaux sprites via pixellab.

</deferred>

---

*Phase: 30-decorations-persistantes*
*Context gathered: 2026-04-11 via discuss-phase*
