# Phase 47: Auberge — Sprites pixel art + animations + microcopy - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Source:** Conversation design + survey codebase

<domain>
## Phase Boundary

Phase de polish visuel/feel : remplace les emojis fallback par des sprites pixel art, ajoute une animation de livraison satisfaisante, et corrige les loose ends accumulés. C'est la dernière phase obligatoire avant que l'Auberge soit shippable.

**IN scope :**
- 3 sprites bâtiment auberge (L1/L2/L3, 64×64 PNG, palette DB16, lumière top-left) → `assets/buildings/auberge_lv{1,2,3}.png`.
- 6 portraits PNJ visiteurs (32×32 ou 48×48 PNG, palette DB16) → `assets/visitors/{boulanger,lucette,voyageuse,apiculteur,marchand,comtesse}.png`.
- Registries : extension de `lib/mascot/building-sprites.ts` + nouveau `lib/mascot/visitor-sprites.ts`.
- Wiring : `BuildingShopSheet`/`BuildingDetailSheet`/grille → utilisent le sprite auberge ; `AubergeSheet` + `DashboardAuberge` → utilisent les portraits si disponibles, fallback emoji sinon.
- Animation livraison Reanimated dans `AubergeSheet` (LootBoxOpener-like : scale + flash + +X 🍃 floating).
- Loose ends correction :
  - `TIMER_AMBER`/`TIMER_RED` (hardcoded dans `AubergeSheet.tsx` et `DashboardAuberge.tsx`) → migrés vers le thème (`colors.warning`/`colors.danger` ou équivalents existants).
  - Loot chance affichée en dur (`18%`) → soit snapshot dans `ActiveVisitor` au spawn, soit calcul à la volée depuis le catalogue (selon ce qui est plus simple).
- Microcopy polish via skills `clarify` puis `delight` :
  - Empty state Auberge.
  - Bios des 6 PNJ.
  - Toast/Alert de livraison réussie.
  - Texte des notifs (`scheduleAubergeVisitorArrival`/`Reminder`).

**OUT of scope :**
- Migration i18n complète vers `locales/fr/common.json` (peut être Phase 48 ou Quick task ultérieure — pour 47 on reste avec FR direct, juste plus joli).
- Badges & achievements (Phase 48).
- Équilibrage formules (Phase 48).
- Sprites alternatifs jour/nuit ou saisons.

</domain>

<decisions>
## Implementation Decisions

### Sprites — pipeline & dimensions

**Bâtiment auberge (64×64) :**
- 3 niveaux progressifs : L1 cabane simple, L2 toit étoffé + lanterne, L3 bâtiment complet avec enseigne.
- Palette DB16 stricte (pas de pur noir/blanc), lumière top-left, ombres bottom-right.
- Style cohérent avec `poulailler_lv1/2/3.png`, `grange_lv1/2/3.png` (regarder ces fichiers comme références visuelles).

**Portraits PNJ (32×32) :**
- 6 personnages distincts, lisibles à petite taille.
- Style "buste/tête" (visible dans une carte ~64-80px de hauteur).
- Cohérent avec les `assets/garden/animals/*` (24×24) et le compagnon.
- Personnalités visuelles :
  - 🧑‍🍳 **Hugo le boulanger** — tablier blanc, toque, sourire chaleureux.
  - 👵 **Mémé Lucette** — cheveux gris en chignon, châle, regard tendre.
  - 🐝 **Yann l'apiculteur** — chapeau de paille, voile relevé, abeilles autour.
  - 🧙 **La Voyageuse** — capuche, sac, regard mystérieux.
  - 🪙 **Le Marchand ambulant** — chapeau pointu, balance, monocle.
  - 👑 **La Comtesse** — couronne discrète, robe élégante, port noble.

### Pipeline de génération sprites

**Préférence : MCP pixellab** (`mcp__pixellab__create_object` pour bâtiment, `mcp__pixellab__create_character` pour PNJ).

**Fallback : API HTTP directe** si MCP timeout/échec — `PIXELLAB_API_KEY` est dans `.env`.
```bash
curl -X POST https://api.pixellab.ai/v1/generate \
  -H "Authorization: Bearer $PIXELLAB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "prompt": "...", "size": "64x64", "palette": "db16" }'
```
(Vérifier la doc exacte avant — l'endpoint et la shape du body peuvent différer.)

L'exécuteur télécharge le PNG et le commit dans `assets/`. Si la qualité est insuffisante, peut itérer ou passer en MCP `dogsprite` pour retouches manuelles.

### Registries

**`lib/mascot/building-sprites.ts`** — étendre avec `auberge: expandSprites(AUBERGE_LV1, AUBERGE_LV2, AUBERGE_LV3)`.

**`lib/mascot/visitor-sprites.ts` (nouveau)** :
```ts
const HUGO = require('../../assets/visitors/boulanger.png');
const LUCETTE = require('../../assets/visitors/lucette.png');
// ... etc.

export const VISITOR_SPRITES: Record<string, any> = {
  boulanger: HUGO,
  lucette: LUCETTE,
  voyageuse: VOYAGEUSE,
  apiculteur: APICULTEUR,
  marchand: MARCHAND,
  comtesse: COMTESSE,
};
```

### Wiring sprites dans l'UI

**`AubergeSheet.tsx`** — remplacer le `<Text style={{fontSize:56}}>{visitorDef.emoji}</Text>` par :
```tsx
const sprite = VISITOR_SPRITES[visitor.visitorId];
return sprite
  ? <Image source={sprite} style={{ width: 64, height: 64 }} />
  : <Text style={{ fontSize: 56 }}>{visitorDef.emoji}</Text>;
```

**`DashboardAuberge.tsx`** — même pattern, taille adaptée (32-40px).

**Bâtiment auberge dans la grille** — déjà géré par `BUILDING_SPRITES`, l'ajout suffit.

### Animation livraison

Dans `AubergeSheet.tsx`, après `await deliverVisitor(...)` réussi :
- `useSharedValue` : `scale` (1 → 1.15 → 1), `opacity` (1 → 0), `coinY` (0 → -50).
- `withSequence(withTiming(1.15, {duration:150}), withSpring(1))` sur la card.
- Émettre une particule "+X 🍃" qui flotte au-dessus puis disparaît.
- Haptics.notificationAsync(Success) déjà présent — garder.

Référence : `components/LootBoxOpener.tsx` — inspirer mais simplifier (pas besoin du same scope).

### Loose ends

**TIMER colors** :
- Lire `useThemeColors()` : chercher si `warning` / `danger` ou `tints.warning` existent. Sinon ajouter dans `constants/themes.ts` ou utiliser le couple existant le plus proche.
- Remplacer les 2 hex constants dans `AubergeSheet` ET `DashboardAuberge`.

**Loot chance** :
- Décision : **snapshot** au spawn dans `ActiveVisitor.lootChance: number`. Calculé une fois selon la rareté (`common: 0.08, uncommon: 0.18, rare: 0.35`). Évite de relire le catalogue partout.
- Migration : ajouter `lootChance?: number` (optional, pour rétrocompat avec data existante).
- UI affiche `{Math.round(visitor.lootChance * 100)}%` au lieu de `18%`.

### Microcopy

Skills à invoquer pendant l'exécution :
- `clarify` sur les copies d'erreur, instructions, labels.
- `delight` sur les bios des PNJ et empty state.

**Cibles principales** :
- Empty state actuel : *"L'auberge est calme... Un visiteur arrivera bientôt."* → potentiellement plus chaleureux.
- Bios des 6 PNJ : 1 ligne FR par visiteur, charmante mais courte.
- Toast/feedback livraison : *"Livré ! +X 🍃"* → enrichir avec le nom du visiteur.
- Notif texte : *"🛖 Hugo arrive à l'auberge..."* → check ton et longueur.

### Tests
- Pas de tests sprites/UI (pattern projet).
- Vérification : `npx tsc --noEmit` clean + lancement dev-client manuel pour valider visuel.
- Tests existants Auberge (76 tests) ne doivent pas régresser.

### Claude's Discretion
- Style exact des prompts pixellab (l'exécuteur itère).
- Taille exacte des portraits (32 vs 48) — choisir selon rendu test.
- Animation timing exact (durée, easing).
- Choix nom de la couleur thème pour TIMER (`warning`/`danger`/`tint` selon ce qui existe).

</decisions>

<canonical_refs>
## Canonical References

### Patterns à imiter
- `lib/mascot/building-sprites.ts` — registry pattern.
- `assets/buildings/poulailler_lv{1,2,3}.png` — référence visuelle bâtiment progressif.
- `assets/garden/animals/{abeille,canard,...}/idle_1.png` — référence visuelle character (24×24).
- `components/LootBoxOpener.tsx` — référence animation festive.
- `components/HarvestCardToast.tsx` — pattern toast de succès.

### Code à modifier
- `lib/mascot/building-sprites.ts` — ajout auberge.
- `lib/mascot/visitor-sprites.ts` (nouveau) — registry portraits.
- `components/mascot/AubergeSheet.tsx` — wiring portraits, animation, theme colors, lootChance.
- `components/dashboard/DashboardAuberge.tsx` — wiring portraits, theme colors.
- `lib/mascot/auberge-engine.ts` — ajout `lootChance` dans `spawnVisitor` snapshot.
- `lib/mascot/types.ts` — `ActiveVisitor.lootChance?: number`.
- `lib/scheduled-notifications.ts` — texte notifs polish.

### Code nouveau
- `assets/buildings/auberge_lv1.png`, `auberge_lv2.png`, `auberge_lv3.png` (3 fichiers générés).
- `assets/visitors/{boulanger,lucette,voyageuse,apiculteur,marchand,comtesse}.png` (6 fichiers générés).

### API/MCP
- MCP `pixellab` (préféré) : `mcp__pixellab__create_object` (bâtiments), `mcp__pixellab__create_character` (PNJ).
- API HTTP fallback : `https://api.pixellab.ai`, clé dans `.env` (`PIXELLAB_API_KEY`).

### Conventions
- `CLAUDE.md` — useThemeColors, FR, tokens design, react-native-reanimated.

</canonical_refs>

<specifics>
## Specific Ideas

- **Critère de succès testable** :
  1. Construire l'auberge → voir un sprite pixel art à L1, qui évolue à L2 et L3.
  2. Spawner un visiteur (ou attendre un auto) → voir un portrait pixel art à la place de l'emoji.
  3. Livrer un visiteur → animation satisfaisante (scale + particule +X 🍃 + haptics).
  4. Timer urgent passe en couleurs du thème (pas de hex hardcodé).
  5. Loot chance affichée correspond à la rareté du visiteur (8/18/35%).
- L'animation doit être **rapide** (~600ms total) pour ne pas frustrer en livraisons répétées.
- Si pixellab échoue ou rend mal, l'exécuteur peut commit des sprites placeholder simples (générés via dogsprite MCP) en notant la dette dans SUMMARY pour reprise ultérieure.

</specifics>

<deferred>
## Deferred Ideas

- Phase 48 : badges (1ère livraison, 10 livraisons, ❤ max), équilibrage formules reward, +XP profil par livraison.
- Quick task ultérieur : migration complète des copies vers `locales/fr/common.json` (i18n key `auberge.*`).
- Variantes de sprites (jour/nuit, saisons) — décor uniquement, pas urgent.

</deferred>

---

*Phase: 47-auberge-sprites-pixel-art-animations-microcopy*
*Context gathered: 2026-04-29 via design + survey codebase (auto mode)*
