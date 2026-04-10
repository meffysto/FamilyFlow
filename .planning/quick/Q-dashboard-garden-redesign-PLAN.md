# Quick Plan — Refonte DashboardGarden.tsx (Timeline + Production v2)

## Objectif

Remplacer le rendu en grille 2x2 de `DashboardGarden.tsx` par le design v2 "Timeline + Production" :
crop timeline lane horizontale avec anneaux SVG, buildings production row, wear event badges/banner,
et family toggle solo/famille avec persistence SecureStore.

**Fichier unique modifie :** `components/dashboard/DashboardGarden.tsx`

## Contexte

- **Mockup cible :** `docs/dashboard-farm-v2.html` (Option B Timeline)
- **Donnees deja disponibles sur Profile :** `farmCrops` (CSV), `farmBuildings` (PlacedBuilding[]), `wearEvents` (WearEvent[])
- **APIs disponibles :** `parseCrops`, `getMainPlotIndex`, `parseWearEvents`, `getActiveWearEffects`, `getPendingResources`, `parseBuildings`, `CROP_CATALOG`, `BUILDING_CATALOG`
- **SVG :** `react-native-svg` v15 deja installe (Svg, Circle)

## Tache unique

### Reecrire DashboardGarden.tsx selon le mockup v2

**Action detaillee :**

#### 1. Imports a ajouter
```typescript
import { ScrollView, LayoutAnimation } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { parseWearEvents, getActiveWearEffects } from '../../lib/mascot/wear-engine';
import { getMainPlotIndex } from '../../lib/mascot/farm-engine';
import { parseBuildings } from '../../lib/mascot/building-engine';
```

#### 2. State: Family Toggle
- `const [familyMode, setFamilyMode] = useState(false);`
- Au mount, charger depuis `SecureStore.getItemAsync('dashboard_family_toggle')` → `'true'` = actif
- Handler toggle : `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`, sauver en SecureStore, inverser state

#### 3. Rendu par profil — `renderProfileSection(profile: Profile, isCompact: boolean)`

**3a. En-tete profil :** avatar + nom + badge `"{N} pretes"` (vert #4ADE80) si readyCount > 0

**3b. Section "Cultures" — Crop Timeline Lane :**
- Label "Cultures" en uppercase, muted, 10px
- `<ScrollView horizontal showsHorizontalScrollIndicator={false}>` avec gap 10
- Trier les crops : plus recent plante a gauche → plus proche recolte a droite (trier par `plantedAt` ASC puis `currentStage` ASC)
- Chaque crop card (largeur fixe 68) :
  - **Anneau SVG** (52x52) : `<Svg width={52} height={52} style={{ transform: [{ rotate: '-90deg' }] }}>`, deux `<Circle>` (bg stroke #2a2a40 strokeWidth 3, fill transparent, cx/cy 26 r 22) + (progress stroke coloree, strokeDasharray `${circumference}`, strokeDashoffset `${circumference * (1 - progress)}`, strokeLinecap "round")
  - Circumference = `2 * Math.PI * 22` ≈ 138.2
  - Couleurs stroke par stade : stage 0 → #555, stage 1 → #8B6914, stage 2 → #6b8a3e, stage 3/4 → #4ADE80, golden → #f0c040
  - Progress = `(currentStage * def.tasksPerStage + tasksCompleted) / (4 * def.tasksPerStage)`, clamp a 1 si stage >= 4
  - Emoji centre (fontSize 22) superpose absolument au milieu du ring-wrap
  - **Main plot** (plotIndex === getMainPlotIndex(crops)) : bordure bleue animee pulse (#60A5FA) autour du ring — utiliser `useSharedValue` + `useAnimatedStyle` + `withRepeat(withTiming(...))` pour opacity 0.4→1 et scale 1→1.06 sur un `Animated.View` wrap circulaire, border 2px solid #60A5FA, inset -3
  - **Mature** (stage >= 4) : glow vert — View absolute inset -2, borderRadius 999, backgroundColor rgba(74,222,128,0.15)
  - **Golden** (isGolden) : drop-shadow jaune (via shadow* RN props), badge "✨" absolute top -4 right -2 fontSize 10, anime sparkle (opacity 0.5↔1, scale 0.8↔1) avec `withRepeat(withTiming(...))`
  - **4 stage dots** sous le ring : 5px circles, filled si stade atteint. Couleur : main plot → #60A5FA, golden → #f0c040, mature → #f0c040, normal filled → #8B6914, unfilled → #333
  - **Label** crop sous les dots : fontSize 9, color #777 (colors.textMuted), utiliser la partie apres "farm.crop." du labelKey pour t(def.labelKey)
  - **Wear badge** sur crops affectes : broken_fence sur le plotIndex → badge rouge 20x20 circulaire absolute top -4 right 0, emoji "🔨". weeds sur le plotIndex → badge vert (#22C55E) emoji "🌿"

**3c. Section "Batiments" — Buildings Production Row :**
- Label "Batiments" si buildings.length > 0
- `<ScrollView horizontal>` row de building cards
- Chaque building card : flexDirection row, alignItems center, gap 6, backgroundColor colors.cardAlt, borderRadius 10, padding 6 10
  - Emoji 18px
  - Column : nom (11px semibold), row meta = level badge ("Nv{level}", 9px, bg #222, borderRadius 4, padding 1 5) + resource type emoji (BUILDING_CATALOG resourceType → oeuf=🥚, lait=🥛, farine=🌾, miel=🍯) + production rate ("{rate}h" fontSize 10 muted)
  - Pending badge a droite : count vert (#4ADE80 bg rgba(74,222,128,0.12)) ou "0" muted si rien
  - **damaged_roof** dans wearEffects.damagedBuildings : borderColor rouge rgba(239,68,68,0.4), badge 🏚️ absolute top -5 right -5, production rate en strikethrough (textDecorationLine: 'line-through')
  - **pests** dans wearEffects.pestBuildings : badge 🐛 absolute top -5 right -5

#### 4. Wear Alert Banner
- Si `activeWearCount > 0` (wearEvents actifs non repares du profil actif) :
  - Banner en bas : backgroundColor rgba(239,68,68,0.08), border 1px rgba(239,68,68,0.2), borderRadius 10
  - "⚠️" + texte "{N} reparation(s) necessaire(s)" + bouton "Reparer" → `router.push('/(tabs)/tree')`
- Compter les events actifs de TOUS les profils affiches pour la card-header badge rouge

#### 5. Card Header Badge
- Dans `<DashboardCard>` props ou juste apres le header : si totalWearCount > 0, badge rouge (18px circle, bg #ef4444, color white, fontSize 10 bold) avec le count

#### 6. Family Toggle Button
- Dans le card-header area (a droite du titre) : TouchableOpacity style pill
  - "👨‍👩‍👧" + "Famille" + count badge (nombre total profils)
  - Active state : borderColor vert, label vert, count badge vert
  - Inactive : border #2a2a40, label #666, count #555

#### 7. Layout principal
- **Solo mode (toggle off)** : renderProfileSection(activeProfile, false) — pleine largeur
- **Family mode (toggle on)** : activeProfile en haut pleine largeur, puis divider, puis les autres profils avec LayoutAnimation expand/collapse
- Les autres profils en mode compact (isCompact=true) : meme rendu mais peut-etre moins de padding

#### 8. Conserver les sections existantes
- Adventure card one-shot (renderOneShotAdventure) — garder tel quel
- Saga indicator — garder tel quel
- Quest compact indicator — garder tel quel
- CTA "Voir mon jardin" — garder tel quel
- DashboardCard wrapper avec collapsible — garder tel quel

#### 9. Animations (react-native-reanimated)
- Main plot pulse : `useSharedValue` + `withRepeat(withSequence(withTiming(1, {duration: 1000}), withTiming(0.4, {duration: 1000})))` pour opacity, meme pattern pour scale 1↔1.06
- Golden sparkle : meme pattern opacity 0.5↔1, scale 0.8↔1
- Family toggle expand : `LayoutAnimation.configureNext()` (natif, pas reanimated — acceptable car c'est un layout change)

#### 10. Style tokens
- Utiliser `useThemeColors()` pour TOUTES les couleurs dynamiques (colors.text, colors.textMuted, colors.textSub, colors.card, colors.cardAlt, colors.border, colors.borderLight, primary, tint)
- Les couleurs fixes du mockup (stade rings, alerts) peuvent rester en dur car elles sont semantiques au gameplay (pas au theme)
- Design tokens : `Spacing.*`, `Radius.*`, `FontSize.*`, `FontWeight.*`

#### 11. Resource type emoji mapping (constante locale)
```typescript
const RESOURCE_EMOJI: Record<string, string> = {
  oeuf: '🥚', lait: '🥛', farine: '🌾', miel: '🍯',
};
```

### Verify
```bash
npx tsc --noEmit 2>&1 | head -50
```
Le fichier compile sans nouvelles erreurs TypeScript.

### Done
- Crop timeline lane horizontale avec anneaux SVG, dots stade, labels — scrollable
- Main plot identifie avec pulse bleu anime
- Golden crops avec shimmer + badge sparkle
- Mature crops avec glow vert
- Buildings production row avec pending count, level badge, resource type
- Wear event badges sur crops et buildings affectes
- Wear alert banner avec count + bouton reparer
- Card header badge rouge quand events actifs
- Family toggle persiste en SecureStore, expand/collapse anime
- Solo = profil actif pleine largeur, famille = actif + autres en dessous
- Adventure, saga, quest, CTA preserves
- Toutes les couleurs via useThemeColors() sauf couleurs gameplay fixes
- Animations reanimated (pulse, sparkle)
