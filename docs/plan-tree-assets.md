# Plan Assets — My Tree

> Inventaire complet, prompts de generation, specs techniques et integration code.

---

## 1. Inventaire des lacunes

### 1.1 Illustrations arbres (`assets/trees/`)

| Espece | Stages existants | Stages manquants | Total a generer |
|--------|-----------------|------------------|-----------------|
| cerisier | 1-4 (graine, pousse, arbuste, arbre) | 5, 6 (majestueux, legendaire) | **2** |
| chene | aucun | 1-6 | **6** |
| bambou | aucun | 1-6 | **6** |
| oranger | aucun | 1-6 | **6** |
| palmier | aucun | 1-6 | **6** |
| **Sous-total** | | | **26** |

### 1.2 Illustrations decorations (`assets/items/`)

| ID | Nom | Rarity | PNG existant | A generer |
|----|-----|--------|-------------|-----------|
| balancoire | Balancoire | commun | oui | - |
| guirlandes | Guirlandes | commun | oui | - |
| lanterne | Lanterne | rare | oui | - |
| cabane | Cabane | rare | oui | - |
| nid | Nid | rare | oui | - |
| hamac | Hamac | epique | oui | - |
| fontaine | Fontaine | epique | oui | - |
| couronne | Couronne | legendaire | oui | - |
| portail | Portail | prestige | oui | - |
| cristal | Cristal | prestige | oui | - |
| **lanterne_argent** | Lanterne d'argent | epique (saga) | **NON** | **oui** |
| **masque_ombre** | Masque d'ombre | legendaire (saga) | **NON** | **oui** |
| **Sous-total** | | | | **2** |

### 1.3 Illustrations habitants (`assets/items/`)

| ID | Nom | Rarity | PNG existant | A generer |
|----|-----|--------|-------------|-----------|
| **oiseau** | Oiseau | commun | NON | **oui** |
| **ecureuil** | Ecureuil | commun | NON | **oui** |
| **papillons** | Papillons | commun | NON | **oui** |
| **coccinelle** | Coccinelle | commun | NON | **oui** |
| **chat** | Chat | rare | NON | **oui** |
| **hibou** | Hibou | rare | NON | **oui** |
| **fee** | Fee | epique | NON | **oui** |
| **dragon** | Dragon | legendaire | NON | **oui** |
| **phoenix** | Phoenix | prestige | NON | **oui** |
| **licorne** | Licorne | prestige | NON | **oui** |
| **esprit_eau** | Esprit d'eau | epique (saga) | NON | **oui** |
| **ancien_gardien** | Ancien Gardien | legendaire (saga) | NON | **oui** |
| **Sous-total** | | | | **12** |

### Total general : **40 assets**

---

## 2. Specs techniques

### 2.1 Arbres (illustrations principales)

| Propriete | Valeur |
|-----------|--------|
| Format | PNG transparent (fond supprime) |
| Ratio | 3:4 portrait |
| Taille cible | 600 x 800 px (@2x retina) |
| Style | Aquarelle storybook, pastels chauds, texture papier |
| Sol | Conserver la base terre/herbe (ancrage visuel) |
| Nommage | `assets/trees/{espece}/stage_{N}.png` |
| Poids cible | < 500 Ko par image |

**Structure fichiers cible :**
```
assets/trees/
  cerisier/   stage_1..6.png   (2 manquants: 5, 6)
  chene/      stage_1..6.png   (6 manquants)
  bambou/     stage_1..6.png   (6 manquants)
  oranger/    stage_1..6.png   (6 manquants)
  palmier/    stage_1..6.png   (6 manquants)
```

### 2.2 Items (decorations + habitants)

| Propriete | Valeur |
|-----------|--------|
| Format | PNG transparent |
| Ratio | ~1:1 (carre ou libre) |
| Taille cible | 256 x 256 px (@2x retina) |
| Style | Meme aquarelle que les arbres, coherence visuelle |
| Nommage | `assets/items/{id}.png` |
| Poids cible | < 150 Ko par image |

---

## 3. Prompts de generation

### 3.1 Arbres — Prompts existants

Les 30 prompts Midjourney sont deja documentes dans `docs/tree-mascot-prompts.md`.
Utiliser ces prompts tels quels pour les 26 illustrations manquantes.

**Rappel Style Anchor :**
```
soft watercolor illustration, hand-painted storybook art style, warm pastel
color palette, visible delicate brushstrokes, painterly texture with subtle
paper grain, gentle color bleeds and wet-on-wet edges, centered composition
on a simple soft gradient wash background, slight front-facing isometric
perspective, rich earthy brown soil base with small grass tufts, children's
book illustration quality, single subject centered, soft diffused lighting
from upper left, no harsh outlines, warm ambient glow
--ar 3:4 --s 750 --v 6.1
```

### 3.2 Decorations saga — Nouveaux prompts

#### lanterne_argent (Lanterne d'Argent)

```
[STYLE ANCHOR] A delicate silver lantern floating slightly above the ground,
hand-forged silver metalwork with intricate filigree patterns, the lantern
emits a soft cool blue-white inner glow, delicate chain links at the top,
frosted glass panels with etched star patterns, small wisps of silvery mist
curl around the base, the silver has a slightly tarnished antique patina with
warm highlights, tiny silver sparkles drift from the top opening, the whole
object sits on a small mossy stone, warm cream and cool silver watercolor
background wash, gentle moonlight quality lighting from the left
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### masque_ombre (Masque d'Ombre)

```
[STYLE ANCHOR] A mysterious ornate mask floating ethereally, crafted from
dark polished wood with deep purple and midnight blue accents, intricate
carved patterns resembling intertwining vines and crescent moons, the eye
openings emit a soft violet inner glow, wisps of dark shadowy mist curl
from the edges like smoke, small purple gemstones embedded along the brow,
the mask has an elegant theatrical quality reminiscent of Venetian masquerade,
subtle gold leaf accents on the carved details, the whole piece radiates
quiet mysterious power, warm cream and deep violet watercolor background
wash, dramatic side lighting creating depth in the carved patterns
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

### 3.3 Habitants — Nouveaux prompts

> Meme Style Anchor global. Chaque habitant est un petit personnage/creature
> destine a etre place sur l'arbre ou au sol dans la scene.

#### oiseau (Oiseau)

```
[STYLE ANCHOR] A small cheerful songbird perched on a tiny branch, round
fluffy body in warm russet-brown and cream with a bright orange breast, small
sharp beak slightly open as if singing, bright dark round eye with a tiny
white highlight, delicate feet gripping the branch, soft wing feathers
with subtle barring pattern, the tail curves gently upward, a few loose
feathers suggest recent preening, warm cream and soft green watercolor
background wash, gentle morning light, cozy and lively character
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### ecureuil (Ecureuil)

```
[STYLE ANCHOR] A small adorable red squirrel sitting upright on a branch,
bushy tail curved elegantly over its back in warm russet-orange, tiny paws
holding an acorn close to its chest, bright alert dark eyes with white ring,
soft cream belly fur, tufted ears with characteristic points, small pink
nose, the fur has beautiful watercolor texture showing individual hair strokes,
tiny claws visible on the bark, warm amber and forest green watercolor
background wash, dappled woodland light, curious and endearing expression
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### papillons (Papillons)

```
[STYLE ANCHOR] A small cluster of three delicate butterflies in flight, each
with slightly different wing patterns in soft lavender, pale blue, and warm
peach, the wings show beautiful watercolor gradient washes with subtle vein
patterns, the bodies are tiny and fuzzy, antennae curve gracefully, the wings
are translucent where light passes through showing gentle color bleeds, small
sparkle dots trail behind their flight path, they form an elegant triangular
composition, warm cream and soft lavender watercolor background wash, diffused
sunlight making the wings glow, ethereal and joyful movement
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### coccinelle (Coccinelle)

```
[STYLE ANCHOR] A cute ladybug sitting on the edge of a small green leaf,
bright cherry-red wing covers with seven perfect black dots, shiny black
head with two white spots, tiny delicate antennae, six small black legs
gripping the leaf edge, the wing covers slightly parted showing a hint of
folded transparent wings beneath, the leaf has realistic vein detail and
soft green watercolor rendering, a tiny dewdrop nearby for scale, warm
green and soft red watercolor background wash, gentle close-up perspective,
charming and detailed miniature
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### chat (Chat)

```
[STYLE ANCHOR] A small cozy cat curled up on a tree branch, soft tabby
fur in warm grey and cream stripes with beautiful watercolor blending,
eyes half-closed in contentment showing golden-amber irises, fluffy tail
wrapped around its body, pink nose and small pink inner ears, one paw
dangling lazily over the branch edge, whiskers catching the light, the
fur texture shows visible soft brushstrokes, small satisfied expression,
warm amber and soft grey watercolor background wash, warm afternoon
sunlight creating a sleepy peaceful atmosphere
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### hibou (Hibou)

```
[STYLE ANCHOR] A small wise owl perched in a tree hollow, round fluffy body
in warm brown and cream with beautiful feather barring patterns, large round
golden-amber eyes with dark pupils giving an alert wise expression, distinctive
ear tufts pointing upward, short curved beak in dark grey, the breast feathers
show detailed watercolor streaking, small talons gripping the branch, the tree
hollow forms a natural frame around the owl, warm brown and golden amber
watercolor background wash, soft moonlit quality with warm tones, mysterious
yet friendly character
--ar 1:1 --s 750 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### fee (Fee)

```
[STYLE ANCHOR] A tiny magical fairy hovering in mid-air, translucent
iridescent wings catching rainbow light in lavender pink and soft gold,
a small graceful figure in a flowing dress made of flower petals in soft
green and white, delicate pointed ears, long flowing hair in warm golden
blonde, holding a tiny glowing star-tipped wand that emits soft sparkles,
bare feet with tiny pointed toes, a gentle aura of golden-pink light
surrounds the whole figure, small luminous particles drift around like
tiny stars, warm cream and soft lavender-gold watercolor background wash,
magical diffused lighting, enchanting and delicate presence
--ar 1:1 --s 800 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### dragon (Dragon)

```
[STYLE ANCHOR] A small baby dragon sitting on a mossy rock, warm emerald-green
scales with golden-amber belly, small wings partially unfurled showing
translucent membrane in warm gold, a tiny curl of friendly smoke wisps from
one nostril, bright amber eyes with vertical pupils showing playful expression,
small curved horns in dark gold, a row of tiny dorsal spines along the back,
the tail curls around the rock, the scales have beautiful watercolor rendering
with individual scale detail, tiny clawed feet, warm green and golden amber
watercolor background wash, warm magical lighting with subtle glow around
the dragon, cute and majestic simultaneously
--ar 1:1 --s 800 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### phoenix (Phoenix)

```
[STYLE ANCHOR] A magnificent small phoenix bird with wings spread in display,
feathers in blazing gradient from deep crimson at the body through bright
orange to golden-yellow at the wing tips, long flowing tail feathers that
curl elegantly like flames frozen in watercolor, bright amber eyes radiating
warmth, a small crown of flame-like feathers on the head, the feathers have
beautiful individual brushstroke detail, subtle warm light emanates from the
body as if the bird contains inner fire, tiny golden sparks and ember-like
particles drift upward, warm crimson and golden-orange watercolor background
wash, dramatic warm lighting, noble and radiant presence
--ar 1:1 --s 800 --v 6.1 --q 2
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### licorne (Licorne)

```
[STYLE ANCHOR] A small elegant unicorn standing gracefully, pure white coat
with subtle lavender and pale blue watercolor shading in the shadows, long
flowing mane and tail in soft pastel rainbow gradient from pink through
lavender to pale blue, a spiraling golden horn on the forehead emitting
soft warm light, large gentle dark eyes with long lashes, small golden
hooves, the mane flows as if in a gentle breeze, tiny star-like sparkles
drift around the horn, delicate build suggesting youth and grace, warm
cream and soft lavender-pink watercolor background wash, ethereal diffused
lighting with subtle golden glow, pure and magical presence
--ar 1:1 --s 800 --v 6.1 --q 2
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### esprit_eau (Esprit d'Eau — saga exclusive)

```
[STYLE ANCHOR] A small translucent water spirit floating gracefully, the body
is formed from crystalline blue water with visible flowing currents inside,
a gentle humanoid form with flowing liquid hair that streams upward like
underwater currents, soft blue and teal with hints of aquamarine, small
luminous white eyes with a serene expression, tiny water droplets orbit the
figure like satellites, ripple patterns emanate from where it floats, the
translucent body catches and refracts light creating soft rainbow prisms,
small bubbles rise from the spirit, warm cream and soft teal-blue watercolor
background wash, cool diffused lighting with warm accents, peaceful and
mysterious aquatic presence
--ar 1:1 --s 800 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

#### ancien_gardien (Ancien Gardien — saga exclusive)

```
[STYLE ANCHOR] A small ancient tree spirit guardian, a gentle figure made
of intertwined roots and vines forming a humanoid shape, moss and tiny
flowers growing from the shoulders and head like natural hair, bark-textured
skin in warm grey-brown with green moss patches, small glowing green eyes
with a wise ancient expression, tiny mushrooms growing from one arm, small
leaves sprout from the fingers, a gentle warm green aura emanates from
the figure, the roots that form the legs merge naturally into the ground,
a small glowing seed held gently in one cupped hand, warm earth-brown and
soft green watercolor background wash, warm dappled forest light, ancient
protective and nurturing presence
--ar 1:1 --s 800 --v 6.1
--no photorealistic, 3D render, cartoon, anime, harsh shadows, text, watermark
```

---

## 4. Integration code

### 4.1 Arbres — `components/mascot/TreeView.tsx`

Ajouter les require() dans `TREE_ILLUSTRATIONS` :

```typescript
const TREE_ILLUSTRATIONS: Partial<Record<TreeSpecies, Partial<Record<TreeStage, any>>>> = {
  cerisier: {
    graine:     require('../../assets/trees/cerisier/stage_1.png'),
    pousse:     require('../../assets/trees/cerisier/stage_2.png'),
    arbuste:    require('../../assets/trees/cerisier/stage_3.png'),
    arbre:      require('../../assets/trees/cerisier/stage_4.png'),
    majestueux: require('../../assets/trees/cerisier/stage_5.png'), // NOUVEAU
    legendaire: require('../../assets/trees/cerisier/stage_6.png'), // NOUVEAU
  },
  chene: {
    graine:     require('../../assets/trees/chene/stage_1.png'),
    pousse:     require('../../assets/trees/chene/stage_2.png'),
    arbuste:    require('../../assets/trees/chene/stage_3.png'),
    arbre:      require('../../assets/trees/chene/stage_4.png'),
    majestueux: require('../../assets/trees/chene/stage_5.png'),
    legendaire: require('../../assets/trees/chene/stage_6.png'),
  },
  bambou: {
    graine:     require('../../assets/trees/bambou/stage_1.png'),
    pousse:     require('../../assets/trees/bambou/stage_2.png'),
    arbuste:    require('../../assets/trees/bambou/stage_3.png'),
    arbre:      require('../../assets/trees/bambou/stage_4.png'),
    majestueux: require('../../assets/trees/bambou/stage_5.png'),
    legendaire: require('../../assets/trees/bambou/stage_6.png'),
  },
  oranger: {
    graine:     require('../../assets/trees/oranger/stage_1.png'),
    pousse:     require('../../assets/trees/oranger/stage_2.png'),
    arbuste:    require('../../assets/trees/oranger/stage_3.png'),
    arbre:      require('../../assets/trees/oranger/stage_4.png'),
    majestueux: require('../../assets/trees/oranger/stage_5.png'),
    legendaire: require('../../assets/trees/oranger/stage_6.png'),
  },
  palmier: {
    graine:     require('../../assets/trees/palmier/stage_1.png'),
    pousse:     require('../../assets/trees/palmier/stage_2.png'),
    arbuste:    require('../../assets/trees/palmier/stage_3.png'),
    arbre:      require('../../assets/trees/palmier/stage_4.png'),
    majestueux: require('../../assets/trees/palmier/stage_5.png'),
    legendaire: require('../../assets/trees/palmier/stage_6.png'),
  },
};
```

### 4.2 Items — `lib/mascot/types.ts`

Ajouter les require() dans `ITEM_ILLUSTRATIONS` :

```typescript
export const ITEM_ILLUSTRATIONS: Record<string, number> = {
  // Decorations existantes
  guirlandes: require('../../assets/items/guirlandes.png'),
  cabane:     require('../../assets/items/cabane.png'),
  balancoire: require('../../assets/items/balancoire.png'),
  lanterne:   require('../../assets/items/lanterne.png'),
  nid:        require('../../assets/items/nid.png'),
  hamac:      require('../../assets/items/hamac.png'),
  fontaine:   require('../../assets/items/fontaine.png'),
  couronne:   require('../../assets/items/couronne.png'),
  portail:    require('../../assets/items/portail.png'),
  cristal:    require('../../assets/items/cristal.png'),
  // NOUVEAUX — decorations saga
  lanterne_argent: require('../../assets/items/lanterne_argent.png'),
  masque_ombre:    require('../../assets/items/masque_ombre.png'),
  // NOUVEAUX — habitants
  oiseau:          require('../../assets/items/oiseau.png'),
  ecureuil:        require('../../assets/items/ecureuil.png'),
  papillons:       require('../../assets/items/papillons.png'),
  coccinelle:      require('../../assets/items/coccinelle.png'),
  chat:            require('../../assets/items/chat.png'),
  hibou:           require('../../assets/items/hibou.png'),
  fee:             require('../../assets/items/fee.png'),
  dragon:          require('../../assets/items/dragon.png'),
  phoenix:         require('../../assets/items/phoenix.png'),
  licorne:         require('../../assets/items/licorne.png'),
  esprit_eau:      require('../../assets/items/esprit_eau.png'),
  ancien_gardien:  require('../../assets/items/ancien_gardien.png'),
};
```

### 4.3 Rien d'autre a changer

Le code existant gere deja le fallback :
- **TreeView** : si `TREE_ILLUSTRATIONS[species][stage]` existe → affiche l'illustration, sinon → SVG procedural
- **InhabitantOverlay** : si `ITEM_ILLUSTRATIONS[id]` existe → affiche le PNG, sinon → emoji
- **DecorationOverlay** : idem

Donc l'ajout des assets est **plug-and-play** : poser les PNG + ajouter les require().

---

## 5. Workflow de generation

### Phase 1 — Arbres prioritaires (26 images)

**Ordre recommande** (completer une espece a la fois pour la coherence) :

1. **Cerisier stages 5-6** (2 images) — completer l'espece existante
2. **Chene stages 1-6** (6 images)
3. **Bambou stages 1-6** (6 images)
4. **Oranger stages 1-6** (6 images)
5. **Palmier stages 1-6** (6 images)

**Process par espece :**
1. Generer le stage 1 (graine) avec le Style Anchor
2. Utiliser le resultat comme `--sref` pour les stages suivants
3. Generer 4 variations par stage (`--repeat 4`), selectionner la meilleure
4. Stages legendaires (6) : utiliser `--q 2` et `--s 800`
5. Post-traitement : suppression fond, conservation sol, export PNG transparent 600x800

### Phase 2 — Habitants (12 images)

**Ordre par rarete (du plus visible au plus rare) :**

1. coccinelle, papillons, oiseau, ecureuil (communs — vus en premier)
2. chat, hibou (rares)
3. fee, esprit_eau (epiques)
4. dragon, ancien_gardien (legendaires)
5. phoenix, licorne (prestige)

### Phase 3 — Decorations saga (2 images)

1. lanterne_argent
2. masque_ombre

### Post-traitement global

- Suppression du fond (transparent PNG)
- Arbres : conserver le sol/base
- Items : detourage propre
- Correction colorimetrique pour coherence avec les assets existants
- Compression : `pngquant --quality=65-80` pour respecter les poids cibles
- Verification retina : netteté a 50% de la taille native

---

## 6. Checklist d'integration

- [ ] Creer les dossiers `assets/trees/{chene,bambou,oranger,palmier}/`
- [ ] Placer les 26 PNG arbres dans leurs dossiers respectifs
- [ ] Placer les 14 PNG items dans `assets/items/`
- [ ] Mettre a jour `TREE_ILLUSTRATIONS` dans `TreeView.tsx`
- [ ] Mettre a jour `ITEM_ILLUSTRATIONS` dans `types.ts`
- [ ] Verifier sur device : chaque espece x chaque stage affiche l'illustration
- [ ] Verifier boutique : chaque habitant affiche le PNG au lieu de l'emoji
- [ ] Verifier sagas : lanterne_argent et masque_ombre s'affichent correctement
- [ ] Verifier les 4 saisons sur chaque espece (pas de clipping/artefact)
- [ ] Poids total assets < 20 Mo supplementaires
