# Phase 27: Ecran Village + Composants - Research

**Researched:** 2026-04-10
**Domain:** React Native / Expo — écran coopératif village (tilemap, feed, barre progression, historique)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** L'écran village est un sous-écran de la ferme, accessible via `router.push('/(tabs)/village')` — pas un nouvel onglet tab visible dans la barre de navigation
- **D-02:** Layout : carte tilemap fixe en haut (~40-50% écran), puis sections scrollables en dessous (objectif, feed, indicateurs, historique) — pattern similaire à tree.tsx
- **D-03:** Un bouton flottant (FAB) sur l'écran ferme permet d'accéder au village — temporaire, sera remplacé par le portail animé en Phase 28
- **D-04:** Feed chronologique (plus récent en haut) — chaque ligne : avatar emoji du profil + nom + type (récolte/tâche) + montant + heure relative
- **D-05:** Limiter à 5 contributions visibles par défaut + lien "Voir tout" qui déplie la liste complète
- **D-06:** Indicateurs par membre : rangée horizontale d'avatars (ReactiveAvatar existant) avec le total de contribution sous chaque avatar
- **D-07:** Réutiliser le composant `LiquidXPBar` existant avec couleurs village (vert communautaire au lieu de bleu XP) — zéro nouveau composant de barre
- **D-08:** Quand l'objectif est atteint : la barre passe en couleur dorée/festive et un bouton "Réclamer la récompense" apparaît (le claim appelle `useGarden.claimReward`)
- **D-09:** Chaque semaine passée est un `CollapsibleSection` (composant existant) — résumé visible (thème, cible, total, statut), déplier pour détail par membre
- **D-10:** Le panneau historique est directement dans le scroll de l'écran village, en bas après le feed — pas d'élément interactif sur la carte

### Claude's Discretion

- Style exact du FAB (icône, couleur, position) — cohérent avec le thème village
- Animations de transition vers l'écran village (fade/slide standard)
- Détail du layout interne de chaque section (padding, espacement)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | Carte "Place du Village" avec son propre terrain tilemap (cobblestone dominant, fontaine, étals) rendue via TileMapRenderer | TileMapRenderer supporte déjà cobblestone comme TerrainType — besoin d'une fonction buildVillageMap() parallèle à buildFarmMap() |
| COOP-03 | Feed de contributions affiché sur l'écran village : qui a fait quoi cette semaine | useGarden expose gardenData.contributions[] avec timestamp/profileId/type/amount — feed à construire depuis ces données |
| COOP-04 | Indicateur per-membre : contribution de chaque profil cette semaine | useGarden.gardenData.contributions[] + profiles[] du VaultContext — agrégation par profileId |
| OBJ-02 | Barre de progression collective vers l'objectif de la semaine | useGarden expose progress et currentTarget — LiquidXPBar réutilisable avec color=colors.success |
| HIST-01 | Panneau interactif listant l'historique des semaines accomplies | useGarden.weekHistory (VillageWeekRecord[]) — CollapsibleSection par semaine |
| HIST-02 | Chaque semaine enregistre cible, total, contributions par membre, récompense claimée | VillageWeekRecord contient weekStart/target/total/claimed — contributions par membre à dériver des contributions courantes (non archivées par membre) |
</phase_requirements>

---

## Summary

La Phase 27 est une phase UI pure : toute la logique métier est déjà en place (Phases 25-26). Le travail consiste à créer `app/(tabs)/village.tsx` (nouvel écran expo-router), adapter `TileMapRenderer` pour une carte village cobblestone, et câbler les composants existants (`LiquidXPBar`, `CollapsibleSection`, `ReactiveAvatar`) avec les données de `useGarden`.

Le pattern de référence est `tree.tsx` : carte tilemap fixe en haut via `onLayout` pour mesurer les dimensions du conteneur, puis `ScrollView` pour les panels informels en dessous. Tout le code de données est fourni par `useGarden` — zéro logique métier à écrire.

La principale décision technique à confirmer est la carte village : `TileMapRenderer` est câblé sur `buildFarmMap(treeStage)` et contient de nombreuses décorations spécifiques ferme. Pour le village, il faut soit (a) créer un `buildVillageMap()` dans `lib/mascot/farm-map.ts` qui génère une grille cobblestone dominante, soit (b) créer un composant `VillageTileMap` dédié plus simple. L'option (a) réutilise le moteur Wang existant sans dupliquer le rendu. L'option (b) risque la duplication du rendu tileset. La décision CONTEXT D-10 et D-02 implique que la carte est fixe et non interactive — l'option (a) est préférable.

**Recommandation principale:** Ajouter `buildVillageMap()` dans `lib/mascot/farm-map.ts`, passer via prop `mode: 'farm' | 'village'` à `TileMapRenderer` pour conditionner les décorations, et créer `app/(tabs)/village.tsx` avec le pattern layout de `tree.tsx`.

---

## Standard Stack

### Core (déjà installé — zéro nouvelle dépendance)

| Composant | Version | Usage | Justification |
|-----------|---------|-------|---------------|
| `expo-router` | v6 | Navigation `router.push('/(tabs)/village')` | Stack standard du projet |
| `react-native-reanimated` | ~4.1 | Animations FAB, transition, barre progression | Obligatoire per CLAUDE.md |
| `react-native-gesture-handler` | existant | ScrollView + FAB touch | Déjà utilisé partout |
| `expo-haptics` | existant | Feedback claim récompense | Pattern établi (Haptics.impactAsync) |
| `react-native-svg` | existant | Via LiquidXPBar (WaveSVG) | Pas d'import direct nécessaire |
| `date-fns` | existant | Calcul heure relative dans le feed | Déjà importé par useGarden |

**Aucune installation npm requise.** Toutes les dépendances existent déjà dans le projet.

---

## Architecture Patterns

### Structure de l'écran village

```
app/(tabs)/village.tsx       ← Nouvel écran (route expo-router automatique)
lib/mascot/farm-map.ts       ← Ajouter buildVillageMap() (nouveau export)
app/(tabs)/tree.tsx          ← Ajouter FAB vers village (modification)
```

### Pattern 1: Layout carte fixe + ScrollView (hérité de tree.tsx)

**Ce que fait tree.tsx:**
```typescript
// 1. Mesurer le conteneur via onLayout
const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
const handleLayout = useCallback((e: LayoutChangeEvent) => {
  setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
}, []);

// 2. Conteneur fixe en haut (pas dans ScrollView)
<View style={styles.mapContainer} onLayout={handleLayout}>
  <TileMapRenderer
    treeStage={treeStage}
    containerWidth={containerSize.width}
    containerHeight={containerSize.height}
    season={currentSeason}
  />
</View>

// 3. ScrollView pour le reste
<ScrollView>
  {/* panels */}
</ScrollView>
```

**Pour village.tsx:** Même pattern, avec une hauteur fixe du conteneur carte (~40% écran):
```typescript
const MAP_HEIGHT = Math.round(SCREEN_H * 0.42);
// mapContainer: { height: MAP_HEIGHT }
// TileMapRenderer avec mode='village' (prop à ajouter)
```

### Pattern 2: buildVillageMap() — grille Wang cobblestone dominante

La carte village doit être cobblestone dominant (≠ herbe ferme). `buildFarmMap()` génère farmland + dirt + cobblestone sur fond herbe. Pour le village:

```typescript
// lib/mascot/farm-map.ts — nouveau export
export function buildVillageMap(): FarmMapData {
  const cols = FARM_MAP_COLS;
  const rows = FARM_MAP_ROWS;
  const cobblestone = emptyVertices(cols, rows);
  const dirt = emptyVertices(cols, rows);
  const water = emptyVertices(cols, rows);
  const farmland = emptyVertices(cols, rows);

  // Cobblestone couvre ~60-70% de la surface (place centrale + allées)
  fillRect(cobblestone, 2, 4, 10, 16); // place centrale

  // Chemin dirt en bordure (transitions douces via Wang)
  fillRect(dirt, 0, 0, 12, 3);  // haut
  fillRect(dirt, 0, 17, 12, 20); // bas

  // Petit espace eau optionnel (fontaine centrale — position VILLAGE_GRID: x=0.50, y=0.45)
  fillRect(water, 5, 8, 7, 10);

  return {
    cols, rows,
    layers: { grass: emptyVertices(cols, rows), dirt, farmland, water, cobblestone },
  };
}
```

**Note importante:** `TileMapRenderer` doit accepter la map depuis l'extérieur OU via un prop `mode`. La solution la moins invasive est d'ajouter un prop optionnel:

```typescript
interface TileMapRendererProps {
  treeStage: TreeStage;
  containerWidth: number;
  containerHeight: number;
  season: Season;
  mode?: 'farm' | 'village'; // NOUVEAU — 'farm' par défaut
}

// Dans le corps:
const farmMap = useMemo(
  () => mode === 'village' ? buildVillageMap() : buildFarmMap(treeStage),
  [treeStage, mode]
);

// Décorations: si mode === 'village', afficher VILLAGE_DECOS au lieu de getFarmDecos()
```

### Pattern 3: Feed contributions — agrégation et heure relative

**Source de données:** `useGarden().gardenData.contributions` est un tableau chronologique (append-only = déjà trié asc). Le feed veut les 5 plus récentes en premier:

```typescript
const recentContribs = useMemo(
  () => [...gardenData.contributions].reverse().slice(0, showAll ? undefined : 5),
  [gardenData.contributions, showAll]
);
```

**Heure relative** (D-04 — "il y a 2h", "hier", "lun."):
```typescript
function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffH = diffMs / 3600000;
  const diffD = diffMs / 86400000;

  if (diffH < 1) return 'à l\'instant';
  if (diffH < 24) return `il y a ${Math.floor(diffH)}h`;
  if (diffD < 2) return 'hier';
  // Pour les jours plus anciens: "lun.", "mar.", etc.
  return new Date(isoTimestamp).toLocaleDateString('fr-FR', { weekday: 'short' });
}
```

### Pattern 4: Indicateurs par membre — agrégation par profileId

```typescript
// Calculer la contribution de chaque profil actif pour la semaine
const memberContributions = useMemo(() => {
  const map: Record<string, number> = {};
  for (const c of gardenData.contributions) {
    map[c.profileId] = (map[c.profileId] ?? 0) + c.amount;
  }
  return map; // { profileId: total }
}, [gardenData.contributions]);
```

Rendu: rangée `ScrollView horizontal` de tuiles `ReactiveAvatar` + total en dessous. Mood fixé à `'idle'` pour les indicateurs (contexte non pertinent pour mood automatique ici).

### Pattern 5: Barre progression village avec état objectif atteint

```typescript
// LiquidXPBar couleur village
const barColor = isGoalReached ? '#FFD700' : colors.success; // doré si atteint, vert si en cours

<LiquidXPBar
  current={progress}
  total={currentTarget}
  label={`${currentTemplate.icon} ${currentTemplate.name}`}
  color={barColor}
  height={24}
/>

{isGoalReached && !gardenData.rewardClaimed && (
  <TouchableOpacity onPress={handleClaim}>
    <Text>Réclamer la récompense</Text>
  </TouchableOpacity>
)}
```

**Note:** `gardenData.rewardClaimed` est le flag partagé dans jardin-familial.md. `claimReward(profileId)` retourne `boolean` — retourne `false` si déjà claimé par ce profil (via village_claimed_week dans gami-{id}.md).

### Pattern 6: Panneau historique — CollapsibleSection par semaine

```typescript
// HIST-02: chaque VillageWeekRecord contient weekStart/target/total/claimed
// Note: les contributions par membre NE SONT PAS dans l'archive (VillageWeekRecord n'a pas ce champ)
// → Pour le détail par membre, seul total + claimed est disponible dans l'historique

{weekHistory.map((week) => (
  <CollapsibleSection
    key={week.weekStart}
    id={`village_week_${week.weekStart}`}  // clé unique pour SecureStore
    title={`Semaine du ${formatDate(week.weekStart)}`}
    defaultCollapsed={true}
  >
    <Text>Cible: {week.target} | Total: {week.total}</Text>
    <Text>{week.claimed ? '✅ Récompense réclamée' : '⏳ Non réclamée'}</Text>
  </CollapsibleSection>
))}
```

**Limitation identifiée (HIST-02):** `VillageWeekRecord` ne stocke pas les contributions par membre — uniquement le total agrégé. Les contributions par membre ne sont disponibles que pour la semaine courante (dans `gardenData.contributions[]`). L'historique peut afficher cible/total/statut réclamé mais pas le détail par profil. C'est un écart avec HIST-02 ("contributions par membre"). Options:
- Option A (recommandée): Afficher cible/total/statut uniquement pour les semaines passées — conforme aux données disponibles
- Option B: Modifier `VillageWeekRecord` pour ajouter `memberContribs: Record<string, number>` — requires changement de schema et parser — hors scope Phase 27

### Pattern 7: FAB sur tree.tsx vers village

tree.tsx utilise déjà `useRouter` et `router.push`. Ajouter un `TouchableOpacity` flottant en `position: 'absolute'` en bas de l'écran (ou en bas à droite de la carte):

```typescript
import { useRouter } from 'expo-router';
// ...
const router = useRouter();
// Dans le JSX, en superposition sur la carte:
<TouchableOpacity
  style={[styles.villageFAB, { backgroundColor: colors.success }]}
  onPress={() => router.push('/(tabs)/village')}
>
  <Text style={styles.villageFABText}>🏘️ Village</Text>
</TouchableOpacity>
```

**Style FAB:** Position absolute, bottom-right de la zone carte, `zIndex: 10`, `borderRadius: 20`, padding confortable. Cohérent avec les FABs existants dans le projet (voir `_layout.tsx` qui utilise le composant `FAB`). Peut réutiliser le composant `FAB` de `components/FAB.tsx` si disponible.

### Pattern 8: Navigation expo-router vers village

`app/(tabs)/village.tsx` sera automatiquement enregistré comme route `/(tabs)/village` par expo-router (file-based routing). Pas de modification de `_layout.tsx` requise puisque D-01 stipule que ce n'est pas un onglet visible dans la tab bar.

**Retour:** `router.back()` ou bouton retour natif. Utiliser `useSafeAreaInsets()` pour le padding top (pattern établi dans les autres écrans).

### Anti-Patterns à éviter

- **Ne pas ajouter village dans la tab bar:** D-01 est explicite — pas un onglet visible
- **Ne pas écrire de logique métier dans village.tsx:** Tout passe par `useGarden()` — zéro logique de calcul dans l'écran
- **Ne pas appeler `setGardenRaw` directement depuis village.tsx:** Uniquement via `useGarden` qui expose `addContribution` et `claimReward`
- **Ne pas dupliquer TileMapRenderer:** Adapter via prop `mode` — pas de nouveau composant de rendu tilemap
- **Ne pas utiliser RN Animated:** Toujours `react-native-reanimated` per CLAUDE.md
- **Ne pas hardcoder les couleurs:** `useThemeColors()` pour tout sauf les constantes cosmétiques (doré `#FFD700` peut être constante locale per décision Phase 4)
- **Ne pas swiper dans ScrollView:** Per CLAUDE.md — les conflits de geste causent des bugs; utiliser boutons tap

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser à la place | Pourquoi |
|----------|-------------------|---------------------|----------|
| Barre progression | Composant barre custom | `LiquidXPBar` existant avec `color` prop | D-07 — décision locked, composant existant complet avec animation vague |
| Sections pliables | Accordion custom avec état local | `CollapsibleSection` existant | D-09 — décision locked, persiste état dans SecureStore automatiquement |
| Avatars profil | Affichage emoji simple | `ReactiveAvatar` existant | D-06 — composant avec animations mood intégrées |
| Rendu tilemap | Canvas custom ou image statique | `TileMapRenderer` + `buildVillageMap()` | MAP-01 — réutiliser le moteur Wang existant |
| Calcul semaine courante | `new Date().getDay()` maison | `date-fns` `startOfWeek` (déjà utilisé dans `useGarden`) | Utilisé et testé dans useGarden — cohérence |
| Données village | Fetch/state local | `useGarden()` hook | Hook complet exposant gardenData, progress, currentTarget, isGoalReached, weekHistory, claimReward |

---

## Common Pitfalls

### Pitfall 1: TileMapRenderer — décorations ferme affichées sur la carte village

**Ce qui se passe:** `TileMapRenderer` appelle `getFarmDecos(season, stageIdx)` qui retourne ~50+ sprites de ferme (arbres fruitiers, poissons koi, botte de foin, etc.). Sans filtrage, ces décorations ferme apparaîtraient sur la carte village.

**Cause:** Le composant est monolithique — décorations et tilemap couplés.

**Comment éviter:** Ajouter le prop `mode?: 'farm' | 'village'` et conditionner `getFarmDecos()` — en mode village, retourner uniquement les décorations village (bancs, étals, panneaux) basées sur `VILLAGE_GRID` positions.

**Signe d'alerte:** Des arbres fruitiers ou des poissons koi apparaissent dans la carte village.

### Pitfall 2: CollapsibleSection id collision avec ferme

**Ce qui se passe:** `CollapsibleSection` persiste son état (ouvert/fermé) dans SecureStore via clé `section_collapsed_{id}`. Si l'id de village réutilise un id existant dans tree.tsx, les états se conflictuent.

**Cause:** Les ids de section ne sont pas namespacés.

**Comment éviter:** Toujours préfixer les ids des sections village avec `village_` — ex: `village_week_2026-04-07`, `village_feed`, `village_members`.

### Pitfall 3: gardenData.contributions — performances avec longue liste

**Ce qui se passe:** Avec le temps, `gardenData.contributions` peut accumuler des centaines d'entrées (toutes les contributions de la semaine courante). Mapper chaque ligne sans `React.memo()` ni `FlatList` peut ralentir le rendu.

**Cause:** `ScrollView` avec beaucoup d'enfants n'est pas virtualisé.

**Comment éviter:** Le feed est limité à 5 par défaut (D-05). Pour "Voir tout", si la liste devient grande (>50), utiliser `FlatList` au lieu de `.map()`. En pratique pour une semaine ~15-30 contributions max (BASE_TARGET=15 par 1-4 profils) — `ScrollView + .map()` reste acceptable. Appliquer `React.memo()` sur le composant de ligne feed.

### Pitfall 4: claimReward — affichage bouton reward après claim

**Ce qui se passe:** Après `claimReward(profileId)`, `gardenData.rewardClaimed` reste `false` dans l'état local jusqu'à ce que le vault soit relu. Le bouton "Réclamer" reste visible.

**Cause:** `claimReward` écrit dans `gami-{id}.md` (flag per-profil) mais NE met pas à jour `jardin-familial.md` (flag partagé). `gardenRaw` n'est pas rechargé.

**Comment éviter:** Gérer un état local `claimedThisSession: boolean` dans village.tsx pour masquer le bouton immédiatement après un claim réussi. Alternative: `claimReward` devrait retourner `true` → mettre à jour l'UI localement sans attendre le rechargement.

### Pitfall 5: HIST-02 — contributions par membre dans l'historique non disponibles

**Ce qui se passe:** `VillageWeekRecord` (type dans `lib/village/types.ts`) ne contient pas le détail des contributions par membre — uniquement `weekStart`, `target`, `total`, `claimed`. HIST-02 demande "contributions par membre", mais l'archive ne les contient pas.

**Cause:** La décision d'architecture Phase 25 a fait un historique compact — total seulement, pas le détail.

**Comment éviter:** Afficher cible/total/statut réclamé pour l'historique (données disponibles) et documenter la limitation. Ne pas inventer des données. Note: le détail par membre est disponible pour la semaine COURANTE uniquement.

### Pitfall 6: expo-router — route `/(tabs)/village` nécessite parenthèses quotées en bash

**Ce qui se passe:** Les commandes bash sur le fichier `app/(tabs)/village.tsx` échouent sans quoting.

**Comment éviter:** Toujours quoter: `"app/(tabs)/village.tsx"` dans les commandes bash. Per CLAUDE.md: "Paths avec parenthèses `app/(tabs)/` doivent être quotés dans git/bash".

### Pitfall 7: useGarden — profileId pour claimReward

**Ce qui se passe:** `claimReward(profileId)` a besoin du `profileId` du profil actif. village.tsx doit récupérer `activeProfile` depuis `useVault()` — useGarden ne l'expose pas.

**Comment éviter:** Dans village.tsx, importer les deux hooks: `const { activeProfile } = useVault()` et `const { claimReward, ... } = useGarden()`. Appeler `claimReward(activeProfile.id)`.

---

## Code Examples

### Squelette de village.tsx

```typescript
// app/(tabs)/village.tsx
import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useGarden } from '../../hooks/useGarden';
import { TileMapRenderer } from '../../components/mascot/TileMapRenderer';
import { LiquidXPBar } from '../../components/ui/LiquidXPBar';
import { CollapsibleSection } from '../../components/ui/CollapsibleSection';
import { ReactiveAvatar } from '../../components/ui/ReactiveAvatar';
import { getCurrentSeason } from '../../lib/mascot/seasons';
import { Spacing } from '../../constants/spacing';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = Math.round(SCREEN_H * 0.42);
const VILLAGE_GREEN = '#22C55E';   // couleur communautaire (ou colors.success)
const GOLD = '#FFD700';            // objectif atteint (constante cosmétique — per Phase 4)

export default function VillageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { activeProfile, profiles } = useVault();
  const { gardenData, progress, currentTarget, isGoalReached, currentTemplate, weekHistory, claimReward } = useGarden();

  const [showAllFeed, setShowAllFeed] = useState(false);
  const [claimedThisSession, setClaimedThisSession] = useState(false);
  const [mapSize, setMapSize] = useState({ width: SCREEN_W, height: MAP_HEIGHT });

  const season = getCurrentSeason();

  // Feed: plus récent en haut, limité à 5 par défaut
  const feedItems = useMemo(
    () => [...(gardenData.contributions ?? [])].reverse().slice(0, showAllFeed ? undefined : 5),
    [gardenData.contributions, showAllFeed],
  );

  // Contributions par profileId pour indicateurs membres
  const memberContribs = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of gardenData.contributions ?? []) {
      map[c.profileId] = (map[c.profileId] ?? 0) + c.amount;
    }
    return map;
  }, [gardenData.contributions]);

  const barColor = isGoalReached ? GOLD : colors.success;
  const canClaim = isGoalReached && !gardenData.rewardClaimed && !claimedThisSession;

  const handleClaim = useCallback(async () => {
    if (!activeProfile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const success = await claimReward(activeProfile.id);
    if (success) setClaimedThisSession(true);
  }, [activeProfile, claimReward]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Carte tilemap village fixe en haut */}
      <View
        style={[styles.mapContainer, { height: MAP_HEIGHT }]}
        onLayout={(e) => setMapSize({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })}
      >
        <TileMapRenderer
          treeStage="arbre"
          containerWidth={mapSize.width}
          containerHeight={mapSize.height}
          season={season}
          mode="village"
        />
      </View>

      {/* Scroll panels */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ... sections: objectif, feed, membres, historique */}
      </ScrollView>
    </View>
  );
}
```

### buildVillageMap() dans farm-map.ts

```typescript
// lib/mascot/farm-map.ts — ajouter après buildFarmMap()

/**
 * Genere la carte de terrain de la place du village.
 * Cobblestone dominant (~60% surface), fontaine centrale (eau), chemins dirt en bordure.
 * Statique — pas de stade progressif (contrairement à buildFarmMap).
 */
export function buildVillageMap(): FarmMapData {
  const cols = FARM_MAP_COLS;  // 12
  const rows = FARM_MAP_ROWS;  // 20

  const cobblestone = emptyVertices(cols, rows);
  const dirt = emptyVertices(cols, rows);
  const water = emptyVertices(cols, rows);
  const farmland = emptyVertices(cols, rows);

  // Place centrale cobblestone (x: 15%-85%, y: 20%-80% de la surface)
  fillRect(cobblestone, 2, 4, 10, 16);

  // Chemins d'entrée en terre (bordures haut et bas)
  fillRect(dirt, 4, 0, 8, 3);
  fillRect(dirt, 4, 17, 8, 20);

  // Fontaine: petit espace eau au centre (VILLAGE_GRID: fountain x=0.50, y=0.45)
  // x=0.50*12=6, y=0.45*20=9 → cols 5-7, rows 8-10
  fillRect(water, 5, 8, 7, 10);

  return {
    cols, rows,
    layers: { grass: emptyVertices(cols, rows), farmland, dirt, water, cobblestone },
  };
}
```

### FAB village dans tree.tsx

```typescript
// Ajouter dans tree.tsx, dans le JSX de la zone carte (après TileMapRenderer)
import { useRouter } from 'expo-router';

// Dans le composant:
const router = useRouter();

// FAB
<TouchableOpacity
  style={[styles.villageFAB, { backgroundColor: colors.success }]}
  onPress={() => {
    Haptics.selectionAsync();
    router.push('/(tabs)/village');
  }}
  activeOpacity={0.8}
>
  <Text style={styles.villageFABIcon}>🏘️</Text>
</TouchableOpacity>

// Styles:
villageFAB: {
  position: 'absolute',
  bottom: Spacing.xl,
  right: Spacing.xl,
  borderRadius: 20,
  paddingHorizontal: Spacing.md,
  paddingVertical: Spacing.sm,
  flexDirection: 'row',
  alignItems: 'center',
  zIndex: 10,
  ...Shadows.medium,
},
```

### Formatage heure relative

```typescript
// Fonction utilitaire locale dans village.tsx
function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffH = diffMs / 3_600_000;
  const diffD = diffMs / 86_400_000;
  if (diffH < 1) return 'à l\'instant';
  if (diffH < 24) return `il y a ${Math.floor(diffH)}h`;
  if (diffD < 2) return 'hier';
  return new Date(isoTimestamp).toLocaleDateString('fr-FR', { weekday: 'short' });
}
```

---

## State of the Art

| Aspect | Pattern établi projet | Application Phase 27 |
|--------|----------------------|----------------------|
| Layouts écrans | Carte fixe + ScrollView (tree.tsx) | Copier ce pattern pour village.tsx |
| Couleur communautaire | `colors.success` (#10B981 light / #34D399 dark) | Barre progression village verte |
| Couleur cosmétique festive | `#FFD700` (Phase 4 décision) | Barre dorée objectif atteint |
| Animations | `useSharedValue` + `withSpring`/`withTiming` | FadeIn sur les sections au montage |
| Sections pliables avec persistance | `CollapsibleSection` avec SecureStore | Historique semaines village |
| Navigation sous-écran | `router.push('/(tabs)/...')` | router.push('/(tabs)/village') |

---

## Open Questions

1. **Décorations village dans TileMapRenderer**
   - Ce qu'on sait: TileMapRenderer est monolithique avec getFarmDecos() hard-coded pour la ferme
   - Ce qui est flou: quelles décorations afficher pour le village (étals, panneau, bancs) — positions définies dans VILLAGE_GRID mais les sprites correspondants ne semblent pas exister dans les assets
   - Recommandation: Pour MVP Phase 27, le mode `'village'` retourne une liste vide de décorations (`[]`) — la carte cobblestone tilemap suffit à la distinction visuelle. Les sprites village peuvent être ajoutés en Phase 28+ si nécessaire.

2. **HIST-02 — Contributions par membre dans l'historique**
   - Ce qu'on sait: `VillageWeekRecord` ne stocke pas le détail par membre
   - Ce qui est flou: s'agit-il d'un must-have pour l'acceptance criteria?
   - Recommandation: Afficher cible/total/statut. Mentionner dans RESEARCH que c'est une limitation de l'architecture décidée en Phase 25. Si c'est bloquant, il faut modifier `VillageWeekRecord` + parser + sérialisation — scope étendu, à discuter.

3. **FAB sur tree.tsx — position et conflit**
   - Ce qu'on sait: tree.tsx est très dense (117KB) avec beaucoup de vues superposées
   - Ce qui est flou: la position exacte du FAB sans couvrir les contrôles existants
   - Recommandation: Placer le FAB en bas-droite de la zone carte (`position: 'absolute', bottom: 12, right: 12` dans le conteneur carte) — zone habituellement libre.

---

## Environment Availability

Step 2.6: SKIPPED — phase purement UI/code, zéro dépendance externe au-delà du projet existant. Toutes les bibliothèques requises sont déjà dans `node_modules`.

---

## Project Constraints (from CLAUDE.md)

Directives applicables à cette phase:

| Directive | Impact sur Phase 27 |
|-----------|---------------------|
| `react-native-reanimated` obligatoire pour toutes les animations | FadeIn sur sections, animations FAB — pas de `Animated` API RN |
| `useThemeColors()` pour toutes les couleurs — jamais hardcoded | `colors.success` pour vert village, `colors.background`, etc. — sauf `#FFD700` (constante cosmétique per Phase 4) |
| `ReanimatedSwipeable` si swipe nécessaire | Pas de swipe dans cette phase — feed et historique sans swipe (per CLAUDE.md: swipe dans ScrollView = conflit) |
| Modals: présentation `pageSheet` + drag-to-dismiss | Aucun modal dans cette phase — navigation Stack standard |
| `React.memo()` sur list items | Composant de ligne feed doit être memoïsé |
| `useCallback()` sur handlers passés en props | `handleClaim`, handlers feed |
| `console.warn`/`console.error` sous `if (__DEV__)` | Tout logging conditionnel |
| Erreurs user-facing: `Alert.alert()` en français | Si claimReward échoue de manière inattendue |
| Type check: `npx tsc --noEmit` avant commit | Valider le typage de `mode?: 'farm' \| 'village'` dans TileMapRendererProps |
| Langue UI/commits/commentaires: français | Tous les textes UI, commentaires code et messages commit en français |
| Format date affiché: JJ/MM/AAAA | Pour `weekStart` dans l'historique: convertir YYYY-MM-DD → JJ/MM/AAAA |
| Pas de nouvelle dépendance npm (ARCH-05 v1.2) | Confirmé — zéro nouvelle dépendance |

---

## Sources

### Primary (HIGH confidence)

- Code source lu directement: `lib/village/types.ts`, `lib/village/grid.ts`, `lib/village/templates.ts`, `lib/village/parser.ts`
- Code source lu directement: `hooks/useGarden.ts`
- Code source lu directement: `components/mascot/TileMapRenderer.tsx` (interface, props, structure)
- Code source lu directement: `components/ui/LiquidXPBar.tsx` (interface complète)
- Code source lu directement: `components/ui/CollapsibleSection.tsx` (interface complète, comportement SecureStore)
- Code source lu directement: `components/ui/ReactiveAvatar.tsx` (interface, moods)
- Code source lu directement: `lib/mascot/farm-map.ts` (FarmMapData, buildFarmMap, emptyVertices, fillRect)
- Code source lu directement: `app/(tabs)/_layout.tsx`, `app/_layout.tsx` (navigation, providers)
- Code source lu directement: `contexts/VaultContext.tsx`, `hooks/useVault.ts` (gardenRaw, setGardenRaw)
- Code source lu directement: `constants/colors.ts` (colors.success: #10B981/#34D399)
- Code source lu directement: `CLAUDE.md` (contraintes projet)
- Code source lu directement: `.planning/phases/27-cran-village-composants/27-CONTEXT.md`
- Code source lu directement: `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)

- Expo Router v6 file-based routing: pattern `app/(tabs)/village.tsx` → route `/(tabs)/village` est standard et identique aux autres écrans `(tabs)/*.tsx` du projet

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — tout est déjà installé, vérifié dans le code
- Architecture: HIGH — patterns lus directement depuis le code source (tree.tsx, TileMapRenderer)
- Composants réutilisables: HIGH — interfaces vérifiées directement
- Pitfalls: HIGH — identifiés depuis le code réel (types, comportements SecureStore)
- HIST-02 limitation: HIGH — VillageWeekRecord vérifié dans types.ts

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stack stable, pas de deps changeantes)
