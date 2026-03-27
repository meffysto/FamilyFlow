# Plan Assets — My Tree (Pixel Art Mana Seed)

> Refonte complete du systeme visuel "Mon Arbre" : remplacement des aquarelles/SVG
> par les spritesheets pixel art Mana Seed. 5 phases progressives.

---

## 1. Inventaire des packs disponibles

### 1.1 Growable Fruit Trees (`25.09a`)

Spritesheets 336x512 px (grille 48x64 par cellule = 7 colonnes x 8 lignes).

**Structure de chaque sheet :**
| Ligne | Contenu | Colonnes |
|-------|---------|----------|
| 1 | Ete/fruits (feuillage + fruits) | 4 tailles croissantes |
| 2 | Printemps (feuillage vert frais) | 4 tailles |
| 3 | Automne (feuillage orange/rouge) | 4 tailles |
| 4 | Hiver nu (branches seules) | 4 tailles |
| 5 | Hiver neige (branches + neige) | 4 tailles |
| 6 | Mort/souche | 4 tailles |
| 7 | Ombres au sol | 4 tailles |

**8 varietes disponibles :**
| Fichier | Couleur fruits | Feuillage ete |
|---------|---------------|---------------|
| apple, green | Vert | Vert sombre |
| apple, red | Rouge | Vert sombre + rouge |
| apple, yellow | Jaune | Vert dore |
| apricot | Blanc/creme | Vert + orange clair |
| orange | Orange vif | Vert + jaune dore |
| peach | Rose/fuschia | Vert + rose |
| pear | Jaune/vert | Vert sombre + jaune |
| plum | Violet/rose | Vert + violet |

**Extras (16x16 / 16x32) :** souches, petits buissons, caisses en bois.
**Icones (16x16 / 16x32) :** icone fruit par variete (pour la boutique/UI).

### 1.2 Animated Livestock (`20.09a`)

Spritesheets 512x512 par animal. Chaque sheet contient les animations :
- Lignes 1-4 : marche 4 directions (6 frames)
- Lignes 5-6 : idle (2-3 frames)
- Lignes 7-8 : action speciale (manger/picorer)

| Animal | Variantes | Fichiers |
|--------|-----------|----------|
| Poulet (chicken) | ~15 coloris (AAA, AAB, ABA, etc.) | 512x512 chacun |
| Poussin (chick) | Plusieurs coloris | Petit sprite |
| Canard (duck) | 8 variantes | 512x512 chacun |
| Cochon (pig) | 2 variantes (A, B) + 4 coloris | 512x512 chacun |
| Vache (cattle) | Bull + Cow, 6 variantes chacun | 512x512 chacun |

### 1.3 Livestock Accessories (`23.11a`)

| Asset | Taille cellule | Contenu |
|-------|---------------|---------|
| livestock accessories.png | 256x128 mix | Grange, etageres, tonneaux, outils |
| livestock accessories 48x32.png | 48x32 | Caisses fruits/legumes, etals |
| livestock accessories 16x16.png | 16x16 | Oeufs, plumes, outils, nourriture |
| hay pile 48x48.png | 48x48 | Botte de foin |
| chicken coop samples.png | Variable | Poulaillers (plusieurs styles) |

### 1.4 Fishing Gear (`23.09a`)

| Asset | Contenu |
|-------|---------|
| fishing objects.png (192x192) | Tonneaux, etals poisson, guirlandes fanions, bancs bois |
| fishing objects 32x32.png | Etals poisson, clotures poisson |
| fishing objects 16x32.png | Cannes a peche, filets |
| fishing icons 16x16.png | Icones poissons (pour UI boutique) |
| fishing anim 32x32.png | Animation peche |

### 1.5 Farming Crops #1 & #2 (`20.02a` / `22.05a`)

Grilles 144x512, cellules 16x32. Chaque ligne = 1 culture (icone + sac + graines + 5 stades).

**Extras communs aux 2 packs (16x16) :** arrosoir, houe, outils, panneaux bois, sacs graines.
**Giant veggies (32x80) :** citrouille geante, chou geant, tomate geante.

### 1.6 Tiny Garden (gratuit)

| Asset | Contenu |
|-------|---------|
| objects.png (144x128) | 30+ fleurs (tulipes, roses, etc.), champignons, papillons |
| tileset.png | Sol herbe, mare, clotures, arbre, maison, nuages |

---

## 2. Mapping especes → fruit trees

Les 5 especes actuelles sont remplacees par 5 varietes de fruit trees :

| Espece actuelle | Fruit tree | Raison |
|-----------------|-----------|--------|
| **cerisier** 🌸 | **peach** | Rose/fuschia → match parfait avec les fleurs de cerisier |
| **chene** 🌳 | **apple, red** | Arbre classique robuste, pommes rouges |
| **oranger** 🍊 | **orange** | Match direct, meme fruit |
| **bambou** 🎋 | **plum** | Violet/rose unique, visuellement distinct |
| **palmier** 🌴 | **pear** | Forme distincte, jaune/vert tropical-ish |

> Les 3 varietes restantes (apple green, apple yellow, apricot) sont disponibles
> pour de futures especes deblocables ou des variantes saisonnieres.

### Mapping tailles → stages

Les arbres ont 4 tailles dans les spritesheets mais on a 6 stages :

| Stage | Niveau | Taille spritesheet | Rendu |
|-------|--------|-------------------|-------|
| graine (1) | 1-3 | — | Sprite special : graine/terre (extras 16x16) |
| pousse (2) | 4-7 | Taille 1 (48x64) | Plus petit arbre |
| arbuste (3) | 8-18 | Taille 2 (48x64) | Arbre moyen-petit |
| arbre (4) | 19-32 | Taille 3 (48x64) | Arbre moyen-grand |
| majestueux (5) | 33-40 | Taille 4 (48x64) | Plus grand arbre |
| legendaire (6) | 41-50 | Taille 4 (48x64) | Taille 4 + effets speciaux (particules, lueur) |

> Le stage "graine" utilise le sprite extras (petite graine/pousse 16x16 upscale).
> Le stage "legendaire" reutilise la taille 4 avec des effets Reanimated par-dessus
> (particules dorees, lueur, aura).

### Mapping saisons

| Saison app | Ligne spritesheet |
|------------|------------------|
| printemps | Ligne 2 (spring/vert) |
| ete | Ligne 1 (summer/fruits) |
| automne | Ligne 3 (autumn/orange) |
| hiver | Ligne 5 (winter/neige) |

> Lignes 4 (bare) et 6 (dead) reservees pour effets speciaux ou evenements.

---

## 3. Nouveau catalogue decorations & habitants

### 3.1 Decorations gratuites (apparaissent avec la progression)

Sprites du pack Tiny Garden + Farming Crops extras. Apparaissent automatiquement
sur le sol du diorama selon le niveau, sans achat.

| ID | Source | Sprite | Condition |
|----|--------|--------|-----------|
| herbes | Tiny Garden tileset | Touffes d'herbe | Niveau 1+ |
| fleurs_sauvages | Tiny Garden objects | 2-3 fleurs aleatoires | Niveau 5+ |
| champignons | Tiny Garden objects | Petit champignon | Niveau 10+ |
| pierres | Tiny Garden tileset | Petites pierres | Niveau 8+ |
| mare | Tiny Garden tileset | Petite mare | Niveau 15+ |
| papillons_pixel | Tiny Garden objects | Papillons animes | Niveau 20+ |

### 3.2 Decorations achetables (feuilles)

| ID | Nom | Source | Cellule/sprite | Prix | Rarete | Min stage |
|----|-----|--------|---------------|------|--------|-----------|
| botte_foin | Botte de foin | Livestock Acc. | hay pile 48x48 | 150 | commun | pousse |
| cloture | Cloture en bois | Fishing Gear | fishing objects 32x32 | 200 | commun | arbuste |
| banc | Banc en bois | Fishing Gear | fishing objects.png | 250 | commun | arbuste |
| panneau | Panneau en bois | Crops extras | 16x16 panneau | 100 | commun | pousse |
| arrosoir | Arrosoir | Crops extras | 16x16 arrosoir | 150 | commun | pousse |
| lanterne_pixel | Lanterne | Fishing Gear | fishing objects.png | 300 | rare | arbuste |
| epouvantail | Epouvantail | Crops extras | 16x32 | 400 | rare | arbre |
| guirlande_fanions | Guirlande fanions | Fishing Gear | fishing objects.png | 350 | rare | arbuste |
| souche | Souche d'arbre | Fruit Trees extras | 16x16 souche | 200 | commun | arbuste |
| tonneau | Tonneau | Fishing Gear | fishing objects.png | 300 | rare | arbre |
| etal_fruits | Etal de fruits | Livestock Acc. 48x32 | caisse fruits | 500 | epique | arbre |
| caisse_bois | Caisse en bois | Fruit Trees extras | 16x16 caisse | 150 | commun | pousse |

### 3.3 Habitants achetables (animaux animes)

| ID | Nom | Source | Sprite | Prix | Rarete | Min stage |
|----|-----|--------|--------|------|--------|-----------|
| poussin | Poussin | Livestock chick | chick_v01 | 150 | commun | pousse |
| poulet | Poulet | Livestock chicken | chicken_AAA_v01 | 250 | commun | arbuste |
| canard | Canard | Livestock duck | duck_v01 | 300 | commun | arbuste |
| cochon | Cochon | Livestock pig | pig_A_v01 | 500 | rare | arbre |
| vache | Vache | Livestock cattle | cattle-cow_A_v01 | 800 | rare | arbre |

### 3.4 Batiments (rares/chers)

| ID | Nom | Source | Sprite | Prix | Rarete | Min stage |
|----|-----|--------|--------|------|--------|-----------|
| poulailler | Poulailler | Livestock Acc. | chicken coop | 1000 | epique | majestueux |
| grange | Grange | Livestock Acc. | livestock accessories.png | 2000 | legendaire | majestueux |
| etal_peche | Etal de peche | Fishing Gear | fishing objects.png | 1500 | epique | arbre |

---

## 4. Specs techniques

### 4.1 Decoupe des spritesheets

Les spritesheets source ne sont PAS utilisees directement — elles doivent etre
decoupees en sprites individuels PNG transparents.

**Script de decoupe necessaire** (`scripts/slice-sprites.ts` ou outil externe) :

```
Fruit trees (48x64 par cellule, 7 cols x 8 lignes) :
  → Pour chaque espece : 4 tailles x 5 saisons = 20 sprites
  → Nommage : {espece}_{saison}_{taille}.png
  → Ex: peach_spring_1.png, peach_summer_4.png

Livestock (32x32 par frame dans grille 512x512) :
  → Extraire les frames idle (ligne 5-6) pour l'affichage statique
  → Extraire walk frames pour l'animation
  → Nommage : {animal}_{anim}_{frame}.png

Decorations :
  → Decoupe manuelle depuis les sheets composites
  → Nommage : deco_{id}.png
```

### 4.2 Structure fichiers cible

```
assets/garden/
  trees/
    peach/          (cerisier)
      spring_1.png .. spring_4.png
      summer_1.png .. summer_4.png
      autumn_1.png .. autumn_4.png
      winter_1.png .. winter_4.png
    apple_red/      (chene)
      spring_1.png .. winter_4.png
    orange/         (oranger)
      spring_1.png .. winter_4.png
    plum/           (bambou)
      spring_1.png .. winter_4.png
    pear/           (palmier)
      spring_1.png .. winter_4.png
    seed.png        (sprite graine commun)

  animals/
    poussin/
      idle_1.png, idle_2.png
      walk_down_1..6.png  (optionnel phase 5)
    poulet/
      idle_1.png, idle_2.png
      walk_down_1..6.png
    canard/
      idle_1.png, idle_2.png
    cochon/
      idle_1.png, idle_2.png
    vache/
      idle_1.png, idle_2.png

  decos/
    botte_foin.png
    cloture.png
    banc.png
    panneau.png
    arrosoir.png
    lanterne_pixel.png
    epouvantail.png
    guirlande_fanions.png
    souche.png
    tonneau.png
    etal_fruits.png
    caisse_bois.png
    poulailler.png
    grange.png
    etal_peche.png

  ground/
    herbes.png
    fleurs_1.png .. fleurs_5.png
    champignons.png
    pierres.png
    mare.png
    papillons.png

  bg/
    tileset_spring.png
    tileset_summer.png
    tileset_autumn.png
    tileset_winter.png

  spritesheets/          (sources originales, pas bundlees)
    fruit_trees_peach.png
    fruit_trees_apple_red.png
    ...
```

### 4.3 Tailles rendues (upscale pixel-perfect)

Le pixel art est petit (48x64, 32x32, 16x16). Pour le rendu mobile on upscale
en **nearest-neighbor** (pas de lissage) pour garder le look pixelise net.

| Type | Taille source | Facteur upscale | Taille rendue |
|------|--------------|-----------------|---------------|
| Arbre | 48x64 | x4 | 192x256 |
| Animal | 32x32 | x4 | 128x128 |
| Deco petite | 16x16 | x4 | 64x64 |
| Deco moyenne | 32x32 | x4 | 128x128 |
| Deco grande | 48x48 | x4 | 192x192 |
| Batiment | 48x32+ | x4 | 192x128+ |

> IMPORTANT : `Image` en React Native → `resizeMode="nearest"` n'existe pas
> nativement. Solution : pre-upscaler les sprites x4 avec nearest-neighbor
> lors de la decoupe, OU utiliser un shader/style CSS `imageRendering: pixelated`.

---

## 5. Phases d'implementation

### Phase 1 — Assets : decoupe et copie (`assets/garden/`)

**Objectif :** Avoir tous les sprites individuels prets dans le projet.

1. Creer le script `scripts/slice-sprites.ts` (Node.js + sharp)
   - Lit chaque spritesheet source
   - Decoupe en cellules selon la grille
   - Upscale x4 nearest-neighbor
   - Exporte en PNG transparent
   - Nommage automatique selon la convention

2. Executer la decoupe :
   - 5 fruit trees → 5 x 20 = 100 sprites arbres + 1 graine
   - 5 animaux → ~10 sprites idle (2 par animal)
   - ~15 decorations → 15 sprites
   - ~6 elements sol → 6+ sprites
   - **Total : ~130 sprites**

3. Copier dans `assets/garden/` selon la structure definie

4. Supprimer les anciennes aquarelles (`assets/trees/`, `assets/items/`)

### Phase 2 — PixelTreeView : remplacer le SVG

**Objectif :** Nouveau composant `PixelTreeView` qui affiche le bon sprite
selon species + level + saison, en remplacement du SVG procedural.

**Fichiers a modifier :**
- `components/mascot/TreeView.tsx` → refonte complete ou nouveau composant
- `lib/mascot/types.ts` → nouveau mapping `PIXEL_TREE_SPRITES`

**Logique :**
```typescript
function getTreeSprite(species: TreeSpecies, level: number, season: Season) {
  const stage = getTreeStage(level);
  if (stage === 'graine') return require('assets/garden/trees/seed.png');

  const fruitTree = SPECIES_TO_FRUIT[species]; // 'peach', 'apple_red', etc.
  const size = STAGE_TO_SIZE[stage];           // 1, 2, 3, 4
  const seasonKey = SEASON_TO_KEY[season];     // 'spring', 'summer', etc.

  return PIXEL_TREE_SPRITES[fruitTree][seasonKey][size];
}
```

**Rendu :**
- `<Image>` React Native au lieu de `<Svg>`
- `imageRendering: 'pixelated'` (web) / sprites pre-upscales (native)
- Ombre au sol : sprite de la ligne 7 du spritesheet

**Stage legendaire :** meme sprite taille 4 + overlay Reanimated :
- Particules dorees (SharedValue + transform)
- Lueur pulsante (opacity animee)
- Aura coloree selon l'espece

### Phase 3 — Jardin/Diorama pixel complet

**Objectif :** Remplacer le fond saisonnier JPEG par un diorama pixel art
compose de tiles Mana Seed.

**Fichiers a modifier :**
- `app/(tabs)/tree.tsx` → nouveau systeme de fond
- Nouveau : `components/mascot/PixelDiorama.tsx`

**Composition du diorama :**
```
┌─────────────────────────────┐
│         Ciel (gradient)     │  ← Couleur unie ou gradient doux
│                             │
│      [Arbre pixel]          │  ← PixelTreeView centre
│     /    |    \             │
│   [deco] [deco] [habitant]  │  ← Items places sur les slots
│                             │
│ ═══ Sol pixel (tileset) ═══ │  ← Tiles herbe saisonniers
│ fleurs  pierres  champis    │  ← Decos gratuites auto
└─────────────────────────────┘
```

**Sol saisonnier :** tiles du pack Mana Seed Seasonal Forest.
**Decos gratuites :** apparaissent progressivement selon le niveau.

### Phase 4 — Decorations refonte : vrais sprites

**Objectif :** Remplacer tout le catalogue DECORATIONS/INHABITANTS par les
nouveaux sprites pixel art.

**Fichiers a modifier :**
- `lib/mascot/types.ts` → nouveau catalogue complet
- `components/mascot/TreeShop.tsx` → affichage sprites au lieu d'emojis
- `components/mascot/TreeView.tsx` → overlay sprites au lieu d'emojis

**Animaux animes :** les habitants poulet/canard/etc. ont des spritesheets
d'animation. En phase 4 on affiche le frame idle statique. L'animation
sera ajoutee en phase 5.

**Migration :** les joueurs qui ont deja achete des items de l'ancien catalogue
gardent leurs feuilles — les items sont remplaces par les equivalents pixel.

| Ancien ID | Nouveau ID | Notes |
|-----------|-----------|-------|
| balancoire | banc | Equivalent fonctionnel |
| guirlandes | guirlande_fanions | Match direct |
| lanterne | lanterne_pixel | Match direct |
| cabane | poulailler | Upgrade batiment |
| nid | botte_foin | Equivalent rustique |
| hamac | banc | Equivalent repos |
| fontaine | mare (gratuit) | Downgrade en gratuit |
| couronne | — | Supprime (pas de match pixel) |
| portail | grange | Equivalent batiment |
| cristal | — | Supprime (pas de match pixel) |
| oiseau | poulet | Match animal |
| ecureuil | poussin | Match petit animal |
| papillons | canard | Match animal |
| coccinelle | poussin | Match petit animal |
| chat | cochon | Match animal moyen |
| hibou | vache | Match animal gros |
| fee | — | Supprime (pas de match pixel) |
| dragon | — | Supprime (pas de match pixel) |
| phoenix | — | Supprime (pas de match pixel) |
| licorne | — | Supprime (pas de match pixel) |

> Note : les items fantastiques (fee, dragon, phoenix, licorne, cristal,
> couronne) n'ont pas d'equivalent dans les packs Mana Seed fermier.
> Option : les garder en emoji comme items "magiques" deblocables a haut niveau,
> ou les supprimer completement pour un univers 100% pixel fermier coherent.

### Phase 5 — Polish

**Objectif :** Animations, transitions, particules, haptics.

1. **Animaux animes** : cycle idle (2-3 frames) avec `useSharedValue` + `useAnimatedStyle`
   - Alternance frame toutes les 500ms
   - Leger mouvement de position (drift aleatoire)

2. **Particules saisonnieres pixel** : remplacer les emojis actuels par des
   micro-sprites (feuilles automne, flocons, petales, lucioles)

3. **Transition saison** : fondu enchaine quand la saison change

4. **Evolution** : animation d'evolution pixel (flash blanc → nouveau sprite)

5. **Haptics** : conserver les patterns actuels (deja bien calibres)

6. **Ombre dynamique** : sprite ombre (ligne 7 spritesheet) sous l'arbre,
   opacity selon l'heure de la journee

---

## 6. Checklist globale

### Phase 1
- [ ] Script de decoupe spritesheets (`scripts/slice-sprites.ts`)
- [ ] Decoupe 5 fruit trees → 100 sprites arbres
- [ ] Decoupe animaux → 10 sprites idle
- [ ] Decoupe decorations → 15 sprites
- [ ] Decoupe elements sol → 6+ sprites
- [ ] Creer `assets/garden/` avec la structure complete
- [ ] Verifier : chaque sprite est transparent, upscale x4, bien nomme

### Phase 2
- [ ] Nouveau `PixelTreeView` (ou refonte `TreeView.tsx`)
- [ ] Mapping `SPECIES_TO_FRUIT` dans types.ts
- [ ] Mapping `PIXEL_TREE_SPRITES` avec require()
- [ ] Rendu pixel-perfect (nearest-neighbor / pre-upscale)
- [ ] Stage graine : sprite special
- [ ] Stage legendaire : effets Reanimated par-dessus
- [ ] Ombre au sol dynamique
- [ ] Test : 5 especes x 6 stages x 4 saisons

### Phase 3
- [ ] `PixelDiorama.tsx` : fond sol saisonnier
- [ ] Gradient ciel saisonnier (conserver `SKY_COLORS`)
- [ ] Decos gratuites auto-placees selon le niveau
- [ ] Integration dans `tree.tsx`

### Phase 4
- [ ] Nouveau catalogue `DECORATIONS` pixel
- [ ] Nouveau catalogue `INHABITANTS` pixel (animaux)
- [ ] Nouveau catalogue `BUILDINGS` pixel
- [ ] Migration anciens achats → nouveaux IDs
- [ ] TreeShop : affichage sprites dans la boutique
- [ ] Overlay placement : sprites au lieu d'emojis
- [ ] Decision : garder ou supprimer les items fantastiques

### Phase 5
- [ ] Animation idle animaux (cycle frames)
- [ ] Particules saisonnieres pixel
- [ ] Transition saison fondu
- [ ] Evolution pixel animation
- [ ] Ombre dynamique heure du jour
