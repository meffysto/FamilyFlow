# Phase 30: Décorations persistantes — Research

**Researched:** 2026-04-11
**Domain:** Village bâtiments persistants — data schema, unlock engine, catalogue UI, village render integration
**Confidence:** HIGH — all findings from direct source code inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope shift (décorations → bâtiments):** Les 8 bâtiments sont puits, boulangerie, marché, café, forge, moulin, port, bibliothèque — pas de guirlandes/fanions. REQUIREMENTS.md sera mis à jour avant le plan.

**Métrique de déblocage:** Somme `profile.points` sur tous les profils actifs (feuilles lifetime, jamais décroissant). Pas de streak hebdomadaire.

**Paliers:** 100 / 300 / 700 / 1 500 / 3 000 / 6 000 / 12 000 / 25 000 feuilles famille.

**Sprites:** 128×128 PNG dans `assets/buildings/village/` — **déjà générés et committés** (confirm: 8 fichiers présents). Le plan ne génère pas de sprites.

**Slots fixes:** 8 slots `'building'` dans `VILLAGE_GRID`, nomenclature `village_building_{id}`.

**Coordonnées fractionnelles proposées (à calibrer):**
- puits 0.08/0.15, boulangerie 0.22/0.10, marché 0.45/0.08, café 0.68/0.10, forge 0.90/0.20, moulin 0.08/0.50, port 0.45/0.92, bibliothèque 0.92/0.55

**Taille rendu village:** 72×72. Taille catalogue: 96×96.

**Format ligne append-only:** `- {timestamp ISO} | {building_id} | {palier}`

**Section fichier:** `## Constructions` dans `jardin-familial.md`, insérée avant `## Historique`.

**Catalogue:** Modal `pageSheet` + drag-to-dismiss. Grille 2 colonnes. Pas de route expo-router.

**Badge "Nouveau":** Persisté via `expo-secure-store` clé `"village_buildings_seen_at"`. Pas dans le vault.

**Tap bâtiment village:** Tooltip auto-dismiss 2.5s (pattern AvatarTooltip). `Haptics.selectionAsync()`.

**Tap tuile locked catalogue:** Toast "Encore {remaining} feuilles" + `Haptics.impactAsync(ImpactFeedbackStyle.Light)`.

**Erreurs non-critiques:** `catch { /* Constructions — non-critical */ }` — silencieux.

**ARCH-05 reconduit:** Zéro nouvelle dépendance npm.

### Claude's Discretion

- Extension `AvatarTooltip` vs nouveau composant `BuildingTooltip` — décision selon divergence structurelle.
- Calibration visuelle finale des 8 coordonnées building (test device).
- Icône header bouton catalogue (`castle` ou `home-city` MaterialCommunityIcons).
- Timing exact du check palier franchi dans `useGarden` (mount vs effet réactif vs claimReward).
- Animation badge "Nouveau" — spring config, stagger.

### Deferred Ideas (OUT OF SCOPE)

- VILL-13 météo dynamique, VILL-14 interactions inter-avatars, VILL-15 placement manuel.
- Ambiance jour/nuit + saisons (Phase 31), Arbre familial (Phase 32).
- Toast popup in-village au déblocage (abandonné — badge catalogue retenu).
- Tap bâtiment ouvre catalogue (abandonné — tooltip local retenu).
- Mystery box silhouette '?' (abandonné — silhouette sombre + nom visible retenu).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VILL-04 | User voit une nouvelle décoration (bâtiment) apparaître sur la carte village quand un palier feuilles famille est atteint | BuildingSprite overlay dans mapContainer, slot `'building'` dans VILLAGE_GRID, `unlockedBuildings` parsé depuis `jardin-familial.md` |
| VILL-05 | User retrouve toutes les décorations accumulées après restart (persistance append-only dans `jardin-familial.md`) | Section `## Constructions` append-only, `appendBuilding()` miroir de `appendContribution()`, parsing dans `parseGardenFile()` |
| VILL-06 | User voit un catalogue listant les ~8 bâtiments par palier, avec statut débloqué/verrouillé | `BuildingsCatalog.tsx` modal pageSheet, `BUILDINGS_CATALOG` statique, badge "Nouveau" via SecureStore |
</phase_requirements>

---

## Summary

Phase 30 s'appuie sur une infrastructure village déjà complète (Phases 25-29). Le parser `lib/village/parser.ts` a un pattern `appendContribution` directement réutilisable pour les bâtiments. Le hook `useGarden.ts` consomme déjà `profiles` via `useVault()` — il suffit de calculer `familyLifetimeLeaves` et de détecter les paliers franchis. Les 8 sprites PNG sont déjà présents dans `assets/buildings/village/`.

Le travail se découpe en 3 couches orthogonales : (1) data layer — étendre `VillageData`, `parseGardenFile`, `serializeGardenFile`, ajouter `appendBuilding`; (2) unlock engine — effet réactif dans `useGarden` qui compare `familyLifetimeLeaves` aux paliers et appelle `appendBuilding` si idempotence non satisfaite; (3) UI layer — `BuildingSprite` (overlay village), `BuildingTooltip` (tap), `BuildingsCatalog` (modal pageSheet), bouton header `village.tsx`.

Le village-parser.test.ts existant a un test `VILLAGE_GRID.toHaveLength(4)` qui cassera quand on ajoute 8 slots `'building'` — ce test doit être mis à jour. C'est le seul brise de test prévisible.

**Primary recommendation:** Construire dans l'ordre data → engine → village render → catalogue, avec un plan par couche.

---

## Standard Stack

### Core (tout existant — ARCH-05, zéro nouvelle dépendance)

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| react-native-reanimated | ~4.1 | Toutes animations | OBLIGATOIRE per CLAUDE.md |
| expo-haptics | SDK 54 | Feedback tactile | selectionAsync / impactAsync |
| expo-secure-store | SDK 54 | `village_buildings_seen_at` | Préférence locale appareil |
| expo-router | v6 | Modal pageSheet | Pas de route dédiée — modal only |
| @expo/vector-icons | SDK 54 | MaterialCommunityIcons header | `castle` ou `home-city` |

### Assets déjà committés

```
assets/buildings/village/
├── puits.png          7.1K  128×128
├── boulangerie.png   10.1K  128×128
├── marche.png         6.9K  128×128
├── cafe.png          11.0K  128×128
├── forge.png         10.1K  128×128
├── moulin.png         7.2K  128×128
├── port.png          11.9K  128×128
└── bibliotheque.png   7.5K  128×128
```

**Collision évitée:** `assets/buildings/moulin.png` (ferme) ≠ `assets/buildings/village/moulin.png` (village) — sous-répertoire `village/` obligatoire, déjà en place.

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
lib/village/
├── types.ts          # + VillageRole 'building', UnlockedBuilding, VillageData.unlockedBuildings
├── parser.ts         # + parseBuildings(), serializeBuildings(), appendBuilding(), appendBuildingToVault()
├── grid.ts           # + 8 VillageCell role 'building'
├── catalog.ts        # NEW — BUILDINGS_CATALOG statique (id, labelFR, palier, spriteRequire)
└── index.ts          # + export catalog

hooks/
└── useGarden.ts      # + familyLifetimeLeaves, unlockedBuildingIds, effet unlock-on-threshold

components/village/
├── BuildingSprite.tsx    # NEW — positioned sprite 72×72 sur carte
├── BuildingTooltip.tsx   # NEW (ou extension AvatarTooltip)
└── BuildingsCatalog.tsx  # NEW — modal pageSheet 2-col grille

app/(tabs)/
└── village.tsx           # + BuildingSprite overlays + bouton header catalogue
```

### Pattern 1 : Append-only section (miroir appendContribution)

L'existant dans `lib/village/parser.ts` définit le pattern canonique. La nouvelle fonction `appendBuilding` suit exactement la même mécanique : trouver `## Constructions`, insérer avant la section suivante `## Historique`.

**Format de ligne:**
```
- 2026-04-12T14:32:00 | puits | 100
```

**Parsing:** section `'constructions'` dans la boucle de sections du parser. Chaque ligne `- timestamp | buildingId | palier`.

```typescript
// Source: lib/village/parser.ts pattern (appendContribution)
export function appendBuilding(content: string, entry: UnlockedBuilding): string {
  const newLine = `- ${entry.timestamp} | ${entry.buildingId} | ${entry.palier}`;
  // Même logique insert-before-next-section que appendContribution
  // Section cible: ## Constructions (insérée avant ## Historique si absente)
}
```

### Pattern 2 : Unlock-on-threshold dans useGarden

Le hook `useGarden` consomme déjà `profiles` via `useVault()` (ligne 75 : `const { vault, gardenRaw, setGardenRaw, profiles } = useVault()`). `profile.points` est disponible (type `number` dans `lib/types.ts` ligne 98).

```typescript
// Source: hooks/useGarden.ts structure existante
const familyLifetimeLeaves = useMemo(
  () => profiles.reduce((sum, p) => sum + (p.points ?? 0), 0),
  [profiles],
);

// Effet réactif — se déclenche au mount + à chaque changement de familyLifetimeLeaves
useEffect(() => {
  if (!vault || !gardenData) return;
  // Pour chaque palier BUILDINGS_CATALOG où palier <= familyLifetimeLeaves
  // ET buildingId pas déjà dans gardenData.unlockedBuildings
  // → appendBuildingToVault(vault, entry) puis setGardenRaw(updated)
}, [vault, gardenData, familyLifetimeLeaves, setGardenRaw]);
```

**Idempotence:** `gardenData.unlockedBuildings.some(b => b.buildingId === id)` — skip silencieux si déjà présent.

**Timing:** Effet réactif sur `familyLifetimeLeaves` (pas au mount uniquement) pour capturer les déblocages mid-session quand un profil gagne des points.

### Pattern 3 : BuildingSprite (miroir VillageAvatar)

```typescript
// Source: components/village/VillageAvatar.tsx pattern
// BuildingSprite reçoit: buildingId, slotX, slotY (pixels convertis depuis slot fractionnel)
// Render: <Animated.Image source={BUILDING_SPRITES[buildingId]} style={72×72} />
// appear animation: opacity 0→1 withTiming 300ms au premier render
// Tap: Haptics.selectionAsync() + onPress callback
```

**Overlay dans village.tsx** — même pattern que VillageAvatar (sibling du TileMapRenderer, `pointerEvents="box-none"` sur le container):
```tsx
{gardenData.unlockedBuildings.map(ub => {
  const slot = VILLAGE_GRID.find(s => s.id === `village_building_${ub.buildingId}`);
  if (!slot) return null;
  return (
    <BuildingSprite
      key={ub.buildingId}
      buildingId={ub.buildingId}
      slotX={slot.x * mapSize.width}
      slotY={slot.y * mapSize.height}
      onPress={() => handleBuildingPress(ub)}
    />
  );
})}
```

### Pattern 4 : BuildingTooltip (extension ou fork AvatarTooltip)

`AvatarTooltip` a 3 props spécifiques au contenu: `profileName`, `count`, et le label FR calculé. Pour un `BuildingTooltip`, le contenu est une seule string statique: `"{Label FR} — Débloqué à {palier} feuilles familiales"`.

**Decision structurelle:** La seule différence est la prop `label: string` vs `profileName + count`. Si le composant est extrait avec une prop `label` générique, les deux cas peuvent être couverts. Recommandation: factoriser en `BaseTooltip({ label, x, y, containerWidth, onDismiss })` et l'utiliser pour les deux types. Mais si cela complexifie AvatarTooltip, un fork `BuildingTooltip` de 30 lignes est plus simple.

**Animation contract identique:** `withTiming(1, { duration: 180 })` entrer, `withTiming(0, { duration: 150 })` + `runOnJS(onDismiss)()` sortir, 2500ms auto-dismiss.

### Pattern 5 : BuildingsCatalog (modal pageSheet)

```typescript
// Source: CLAUDE.md convention modals
// expo-router: <Stack.Screen options={{ presentation: 'pageSheet' }} />
// Ou: Modal component avec modalPresentationStyle="pageSheet"
// Drag-to-dismiss: enableDismissOnClose
```

**Badge "Nouveau" lifecycle:**
```typescript
// Au mount:
const lastSeen = await SecureStore.getItemAsync('village_buildings_seen_at');
const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
const newBuildings = unlockedBuildings.filter(
  b => new Date(b.timestamp) > lastSeenDate
);
// Au close:
await SecureStore.setItemAsync('village_buildings_seen_at', new Date().toISOString());
```

### Pattern 6 : BUILDINGS_CATALOG statique

Nouveau fichier `lib/village/catalog.ts` (module pur, pas de hook) :
```typescript
export interface BuildingCatalogEntry {
  id: string;          // 'puits', 'boulangerie', etc.
  labelFR: string;     // 'Puits', 'Boulangerie', etc.
  palier: number;      // 100, 300, 700, ...
  sprite: ReturnType<typeof require>; // require('../../assets/buildings/village/puits.png')
}
export const BUILDINGS_CATALOG: BuildingCatalogEntry[] = [
  { id: 'puits',       labelFR: 'Puits',        palier: 100,   sprite: require(...) },
  { id: 'boulangerie', labelFR: 'Boulangerie',  palier: 300,   sprite: require(...) },
  { id: 'marche',      labelFR: 'Marché',       palier: 700,   sprite: require(...) },
  { id: 'cafe',        labelFR: 'Café',         palier: 1500,  sprite: require(...) },
  { id: 'forge',       labelFR: 'Forge',        palier: 3000,  sprite: require(...) },
  { id: 'moulin',      labelFR: 'Moulin',       palier: 6000,  sprite: require(...) },
  { id: 'port',        labelFR: 'Port',         palier: 12000, sprite: require(...) },
  { id: 'bibliotheque',labelFR: 'Bibliothèque', palier: 25000, sprite: require(...) },
];
```

Ce module évite les `require()` inline dans les composants et sert de source unique pour useGarden (paliers) et BuildingsCatalog (sprites + labels).

### Anti-Patterns to Avoid

- **Append en fin de fichier:** `appendBuilding` DOIT insérer avant `## Historique` — même règle que `appendContribution` (Phase 25 Pitfall 4). Ne pas `content.trimEnd() + newLine`.
- **`matter.stringify()`:** Parser manuel uniquement dans `serializeGardenFile` — `gray-matter` utilise Node.js Buffer qui crash React Native (Phase 25-01 decision).
- **Swipe dans ScrollView:** Le catalogue utilise une grille FlatList ou ScrollView, pas de swipe — conflit de geste (CLAUDE.md).
- **`Swipeable` de react-native-gesture-handler:** Utiliser `ReanimatedSwipeable` si jamais un swipe est nécessaire, mais ici non applicable.
- **Hardcoded couleurs:** Toutes les couleurs via `useThemeColors()` — sauf `BADGE_GOLD = '#FFD700'` comme constante StyleSheet cosmétique (pattern Phase 4 / UI-SPEC.md).
- **RN Animated:** `react-native-reanimated` uniquement — pas `Animated` de React Native core.
- **`perspective` dans transform arrays:** Éviter (CLAUDE.md — clipping 3D). Utiliser `scaleX` si flip nécessaire.
- **Modification en place du fichier vault:** Append-only — jamais de mutation des lignes `## Constructions` existantes. Un bâtiment débloqué est acquis à vie même si `familyLifetimeLeaves` repasse sous le palier.
- **Écriture gardenRaw sans relecture:** Après `appendBuildingToVault`, relire le fichier et appeler `setGardenRaw(updated)` — pattern exact de `addContribution` dans useGarden.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip flottant village | Composant custom from scratch | Fork/extend `AvatarTooltip.tsx` | Auto-dismiss, clamp horizontal, animation identiques déjà codés |
| Animation spring catalogue | Config ad-hoc | `const SPRING_CATALOG = { damping: 12, stiffness: 180 }` constante module | Convention CLAUDE.md |
| Préférence "dernière vue" | État React session | `expo-secure-store` clé `village_buildings_seen_at` | Persiste entre sessions, entre restarts |
| Calcul palier franchi | Algorithme custom | Comparaison `palier <= familyLifetimeLeaves && !unlockedBuildings.some(b => b.buildingId === id)` | Logique triviale, idempotence simple |
| Toast locked tile | Composant custom | `showToast()` via `useToast()` existant | Déjà câblé dans `village.tsx` |

---

## Current State — What Exists from Phases 25-29

### Phase 25 — fondation-donnees-village

- `lib/village/types.ts` — `VillageData`, `VillageRole`, `VillageCell`, `VillageContribution`, `VillageWeekRecord`
- `lib/village/parser.ts` — `parseGardenFile`, `serializeGardenFile`, `appendContribution`, `appendContributionToVault`, `VILLAGE_FILE`
- `lib/village/grid.ts` — `VILLAGE_GRID` (11 slots actuels: fountain, 2 stalls, board, 6 avatars, portal)
- `lib/village/templates.ts`, `lib/village/activities.ts`, `lib/village/index.ts`
- Pattern clé: parser **manuel YAML** (pas gray-matter — crash React Native Buffer)
- Pattern clé: `appendContribution` insère avant `## Historique` (jamais fin de fichier)
- Pattern clé: `serializeGardenFile` construit la string manuellement (round-trip fidelity)

### Phase 26 — hook domaine jardin

- `hooks/useGarden.ts` — hook complet, consomme `useVault()` directement
- Expose: `gardenData`, `addContribution`, `claimReward`, `weekHistory`, `isGoalReached`, etc.
- Pattern clé: `const { vault, gardenRaw, setGardenRaw, profiles } = useVault()` — accès direct à `profiles` pour le calcul `familyLifetimeLeaves`
- Pattern clé: après écriture vault → relire le fichier → `setGardenRaw(updated)`

### Phase 29 — avatars vivants + portail retour

- `components/village/VillageAvatar.tsx` — positioned sprite 48×48, halo Reanimated, tap handler
- `components/village/AvatarTooltip.tsx` — tooltip auto-dismiss 2.5s, clamp horizontal, fade+translateY
- `components/village/PortalSprite.tsx` — sprite pixellab 64×64, glow loop, `require()` inline
- `app/(tabs)/village.tsx` — overlay avatars dans `mapContainer`, tooltip state, portal handler
- Pattern clé: avatars sont siblings de `TileMapRenderer`, positionnés absolus dans `mapContainer` via `slot.x * mapSize.width`
- Pattern clé: `onLayout` sur mapContainer → `setMapSize({ width, height })` pour conversions fractionnelles → pixels

### VaultState (hooks/useVault.ts)

- `gardenRaw: string` — contenu brut de jardin-familial.md
- `setGardenRaw: Dispatch<SetStateAction<string>>` — mise à jour après écriture vault
- `profiles: Profile[]` — tous les profils, chacun avec `profile.points: number` (XP lifetime)

### Tests existants (lib/__tests__/village-parser.test.ts)

- Tests: `parseGardenFile`, `serializeGardenFile`, `appendContribution`, `VILLAGE_GRID`, templates
- **Test à mettre à jour:** `expect(VILLAGE_GRID).toHaveLength(4)` — cassera quand 8 slots `'building'` seront ajoutés. Doit devenir `toHaveLength(20)` (4 originaux + 6 avatars Phase 29 + portail Phase 29 + 8 bâtiments Phase 30 = 20 ou 19 selon comptage exact actuel).

**Comptage actuel VILLAGE_GRID:** 11 slots (fountain + 2 stalls + board + 6 avatars + portal). Le test `toHaveLength(4)` date de Phase 25 et est déjà obsolète (n'a pas été mis à jour après Phase 29 ajout avatars). Vérification à faire dans le plan.

---

## Data Schema Proposal

### Types à ajouter dans `lib/village/types.ts`

```typescript
// Phase 30 — VillageRole étendu
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal' | 'avatar' | 'building';

// Phase 30 — bâtiment débloqué (append-only)
export interface UnlockedBuilding {
  timestamp: string;   // ISO 8601 sans Z — ex: 2026-04-12T14:32:00
  buildingId: string;  // 'puits' | 'boulangerie' | 'marche' | 'cafe' | 'forge' | 'moulin' | 'port' | 'bibliotheque'
  palier: number;      // palier franchi au moment du déblocage (100, 300, ...)
}

// Phase 30 — VillageData étendu
export interface VillageData {
  // ... champs existants ...
  unlockedBuildings: UnlockedBuilding[];  // append-only — toujours présent (défaut [])
}
```

### Format markdown `jardin-familial.md` après Phase 30

```markdown
---
version: 1
created: 2026-04-01
current_week_start: 2026-04-07
current_theme_index: 2
reward_claimed: false
---

## Contributions
- 2026-04-10T14:32:00 | profile-abc | harvest | 1

## Constructions
- 2026-04-12T14:32:00 | puits | 100
- 2026-04-15T09:15:00 | boulangerie | 300

## Historique
- 2026-03-31 | cible:45 | total:52 | claimed:true
```

**Positionnement de `## Constructions`:** Entre `## Contributions` et `## Historique`. `appendBuilding` cherche `## Constructions`, insère avant la prochaine `##` (i.e. `## Historique`). Si `## Constructions` absent, créer avant `## Historique`.

### Backward compatibility

- `parseGardenFile` retourne `unlockedBuildings: []` si la section `## Constructions` est absente — aucune migration nécessaire pour les vaults existants.
- `serializeGardenFile` doit toujours émettre la section `## Constructions` (même vide) pour faciliter les appends futurs.

---

## Unlock Engine Design

### Pure function de vérification

```typescript
// lib/village/catalog.ts (ou utils)
// Pure — testable sans vault
export function computeBuildingsToUnlock(
  familyLifetimeLeaves: number,
  alreadyUnlocked: UnlockedBuilding[],
): BuildingCatalogEntry[] {
  const unlockedIds = new Set(alreadyUnlocked.map(b => b.buildingId));
  return BUILDINGS_CATALOG.filter(
    entry => entry.palier <= familyLifetimeLeaves && !unlockedIds.has(entry.id),
  );
}
```

### Effet dans useGarden

```typescript
useEffect(() => {
  if (!vault) return;
  const toUnlock = computeBuildingsToUnlock(familyLifetimeLeaves, gardenData.unlockedBuildings ?? []);
  if (toUnlock.length === 0) return;

  (async () => {
    try {
      let currentContent = await vault.readFile(VILLAGE_FILE).catch(() => '');
      for (const entry of toUnlock) {
        const building: UnlockedBuilding = {
          timestamp: new Date().toISOString(),
          buildingId: entry.id,
          palier: entry.palier,
        };
        currentContent = appendBuilding(currentContent, building);
      }
      await vault.writeFile(VILLAGE_FILE, currentContent);
      setGardenRaw(currentContent);
    } catch { /* Constructions — non-critical */ }
  })();
}, [vault, familyLifetimeLeaves, gardenData.unlockedBuildings, setGardenRaw]);
```

**Note sur la dépendance gardenData.unlockedBuildings:** Pour éviter une boucle infinie (l'effet écrit gardenRaw → gardenData change → l'effet se relance), l'idempotence `computeBuildingsToUnlock` garantit que si `toUnlock.length === 0` on sort immédiatement — pas d'écriture, pas de changement de gardenRaw.

### Return API de useGarden étendue

```typescript
export interface UseGardenReturn {
  // ... existant ...
  familyLifetimeLeaves: number;  // exposé pour le catalogue
}
```

---

## Integration Points

### Village map render (VILL-04)

Dans `app/(tabs)/village.tsx`, après le bloc avatars Phase 29, ajouter les overlays bâtiments :

```tsx
{/* Phase 30 — overlay bâtiments (VILL-04) */}
{(gardenData.unlockedBuildings ?? []).map(ub => {
  const slot = VILLAGE_GRID.find(s => s.id === `village_building_${ub.buildingId}`);
  if (!slot) return null;
  return (
    <BuildingSprite
      key={ub.buildingId}
      buildingId={ub.buildingId}
      slotX={slot.x * mapSize.width}
      slotY={slot.y * mapSize.height}
      onPress={() => handleBuildingPress(ub)}
    />
  );
})}
{buildingTooltip && (
  <BuildingTooltip
    label={buildingTooltip.label}
    x={buildingTooltip.x}
    y={buildingTooltip.y}
    containerWidth={mapSize.width}
    onDismiss={() => setBuildingTooltip(null)}
  />
)}
```

**Bouton header catalogue:** Dans le bloc `<View style={styles.header}>`, ajouter une icône à droite du titre. Actuellement le header n'a que `headerTitle` centré — ajouter un `TouchableOpacity` absolu right. Pattern MaterialCommunityIcons `"castle"` ou `"home-city"` à 22px.

### Catalogue modal (VILL-06)

Option A: `<Modal visible={showCatalog} presentationStyle="pageSheet" animationType="slide">` — composant inline.  
Option B: expo-router nested modal screen.  

**Recommandation: Option A** (cohérent avec le pattern VaultContext qui n'a pas de routes dédiées pour les catalogues secondaires). Utiliser un state local `[showCatalog, setShowCatalog]` dans `village.tsx`.

---

## File-Level Plan

### Fichiers à CRÉER

| Fichier | Contenu |
|---------|---------|
| `lib/village/catalog.ts` | `BUILDINGS_CATALOG`, `computeBuildingsToUnlock`, `BuildingCatalogEntry` |
| `components/village/BuildingSprite.tsx` | Sprite 72×72 positionné, fade-in 300ms, tap + tooltip |
| `components/village/BuildingTooltip.tsx` | Fork/extension AvatarTooltip avec prop `label: string` |
| `components/village/BuildingsCatalog.tsx` | Modal pageSheet, grille 2 colonnes, badge "Nouveau", SecureStore |

### Fichiers à MODIFIER

| Fichier | Modification |
|---------|-------------|
| `lib/village/types.ts` | + `'building'` dans `VillageRole`, + `UnlockedBuilding`, + `unlockedBuildings` dans `VillageData` |
| `lib/village/parser.ts` | + parsing section `## Constructions` dans `parseGardenFile`, + émission dans `serializeGardenFile`, + `appendBuilding()`, + `appendBuildingToVault()` |
| `lib/village/grid.ts` | + 8 `VillageCell` role `'building'` avec coordonnées fractionnelles D-11 |
| `lib/village/index.ts` | + export `catalog.ts` |
| `hooks/useGarden.ts` | + `familyLifetimeLeaves`, + effet unlock-on-threshold, + exposer `familyLifetimeLeaves` dans return |
| `app/(tabs)/village.tsx` | + import BuildingSprite/BuildingTooltip/BuildingsCatalog, + buildingSlots, + handleBuildingPress, + state showCatalog + buildingTooltip, + bouton header, + overlay bâtiments dans mapContainer |

### Fichiers TESTS à MODIFIER

| Fichier | Modification |
|---------|-------------|
| `lib/__tests__/village-parser.test.ts` | Mettre à jour `VILLAGE_GRID.toHaveLength(?)` — valeur actuelle 4 est déjà obsolète (VILLAGE_GRID contient 11 entrées depuis Phase 29). Corriger vers le bon count + ajouter tests pour `unlockedBuildings` parsing, `appendBuilding`, `computeBuildingsToUnlock` |

### Fichiers TESTS à CRÉER (optionnel mais recommandé)

| Fichier | Contenu |
|---------|---------|
| Tests dans `village-parser.test.ts` (extension) | `parseGardenFile` avec section `## Constructions`, round-trip avec `unlockedBuildings`, `appendBuilding` avant `## Historique`, `computeBuildingsToUnlock` idempotence |

---

## Common Pitfalls

### Pitfall 1 : Boucle infinie dans useGarden effet unlock

**Ce qui part mal:** L'effet `unlock-on-threshold` écrit `gardenRaw` → `gardenData` change → l'effet se relance → check encore → toUnlock est vide → OK. Mais si on oublie l'idempotence, chaque écriture déclenche un nouveau cycle.
**Pourquoi:** Les dépendances de l'effet incluent `gardenData.unlockedBuildings` qui change après l'écriture.
**Comment éviter:** `computeBuildingsToUnlock` retourne `[]` si tout est déjà débloqué → early return sans écriture → pas de changement de gardenRaw → cycle s'arrête. TOUJOURS vérifier `if (toUnlock.length === 0) return` en premier.

### Pitfall 2 : test VILLAGE_GRID.toHaveLength(4) obsolète

**Ce qui part mal:** Le test dans `village-parser.test.ts` teste `VILLAGE_GRID.toHaveLength(4)` — or VILLAGE_GRID contient déjà 11 entrées après Phase 29. Ce test passe probablement déjà en rouge ou a déjà été corrigé silencieusement. Vérifier avec `npx jest --no-coverage lib/__tests__/village-parser.test.ts` avant de commencer.
**Comment éviter:** Mettre à jour ce test pour refléter le vrai count (20 après Phase 30) ET vérifier que les counts par rôle sont corrects.

### Pitfall 3 : Append en fin de fichier

**Ce qui part mal:** `appendBuilding` appelle `content.trimEnd() + '\n' + newLine` → la section `## Constructions` se retrouve après `## Historique` → le parser ne la trouve pas dans le bon ordre → les bâtiments ne sont pas parsés.
**Comment éviter:** Même logique que `appendContribution` — chercher la section, insérer avant la suivante. Si `## Constructions` est absente, la créer AVANT `## Historique`.

### Pitfall 4 : `require()` dans une boucle ou dynamique

**Ce qui part mal:** `require(\`../../assets/buildings/village/${buildingId}.png\`)` — les requires dynamiques ne sont pas supportés par Metro bundler (React Native). Crash silencieux ou erreur de bundling.
**Comment éviter:** Le `BUILDINGS_CATALOG` dans `catalog.ts` déclare chaque `require()` statiquement par entrée. BuildingSprite reçoit le sprite préchargé depuis le catalogue, pas un ID string.

### Pitfall 5 : Collision de noms moulin

**Ce qui part mal:** `require('../../assets/buildings/moulin.png')` vs `require('../../assets/buildings/village/moulin.png')` — si un composant utilise le mauvais chemin, il charge le moulin de la ferme.
**Comment éviter:** TOUS les require dans `catalog.ts` utilisent `assets/buildings/village/` — jamais `assets/buildings/` directement.

### Pitfall 6 : Coordonnées fractionnelles sans mapSize ready

**Ce qui part mal:** Au premier render, `mapSize` est `{ width: SCREEN_W, height: MAP_HEIGHT }` par défaut. Les bâtiments se positionnent avec les bonnes dimensions de l'écran. `onLayout` met à jour `mapSize` si les dimensions diffèrent (rare sur device, mais possible).
**Comment éviter:** Pattern existant dans `village.tsx` — utiliser `mapSize.width` et `mapSize.height` (déjà correctement câblé pour les avatars).

### Pitfall 7 : Profile sans points (undefined)

**Ce qui part mal:** Un profil "grossesse" ou un profil nouvellement créé peut avoir `points` undefined.
**Comment éviter:** `p.points ?? 0` dans le reduce — déjà documenté dans CONTEXT.md D-05.

### Pitfall 8 : Badge "Nouveau" SecureStore async au mount

**Ce qui part mal:** `SecureStore.getItemAsync` est async. Si le catalogue rend avant que la lecture soit terminée, tous les bâtiments apparaissent comme "Nouveau" brièvement.
**Comment éviter:** Utiliser un state `lastSeen: Date | null` initialisé à `null`, et ne montrer les badges qu'après que la lecture SecureStore soit terminée (useEffect + setState).

---

## Code Examples

### parseGardenFile étendu (section Constructions)

```typescript
// Source: lib/village/parser.ts pattern à étendre
// Dans la boucle sections, ajouter :
if (header === '## constructions') {
  section = 'constructions';
} 
// Dans le traitement des lignes :
if (section === 'constructions') {
  // Format: timestamp | buildingId | palier
  const parts = raw.split(' | ');
  if (parts.length < 3) continue;
  const [timestamp, buildingId, rawPalier] = parts;
  if (!timestamp || !buildingId || !rawPalier) continue;
  const palier = parseInt(rawPalier.trim(), 10);
  if (isNaN(palier)) continue;
  unlockedBuildings.push({ timestamp: timestamp.trim(), buildingId: buildingId.trim(), palier });
}
```

### serializeGardenFile étendu

```typescript
// Source: lib/village/parser.ts serializeGardenFile pattern
// Après ## Contributions, avant ## Historique :
lines.push('## Constructions');
for (const b of data.unlockedBuildings ?? []) {
  lines.push(`- ${b.timestamp} | ${b.buildingId} | ${b.palier}`);
}
lines.push('');
```

### Tuile catalogue verrouillée

```typescript
// Source: 30-UI-SPEC.md D-18 pattern
// Sprite avec tintColor pour silhouette sombre
<Image
  source={entry.sprite}
  style={[
    styles.catalogSprite,
    !isUnlocked && { tintColor: colors.textMuted, opacity: 0.4 }
  ]}
  resizeMode="contain"
/>
```

### Animation badge "Nouveau"

```typescript
// Source: CLAUDE.md spring config + UI-SPEC animation contract
const SPRING_CATALOG = { damping: 12, stiffness: 180 } as const;
const badgeScale = useSharedValue(0);
useEffect(() => {
  if (isNew) {
    badgeScale.value = withSpring(1, SPRING_CATALOG);
  }
}, [isNew]);
```

---

## State of the Art

| Old Approach | Current Approach | Phase | Impact |
|--------------|------------------|-------|--------|
| gray-matter pour parser frontmatter | Parser manuel (split ':', pas de Buffer) | 25 | React Native compat |
| Append en fin de fichier | Insert avant section suivante `##` | 25 | Évite corruption structure |
| `Swipeable` react-native-gesture-handler | `ReanimatedSwipeable` | CLAUDE.md | Évite conflit geste dans ScrollView |
| RN Animated API | react-native-reanimated ~4.1 | CLAUDE.md | Worklet thread, fluidité |
| Avatar tooltip inline | `AvatarTooltip.tsx` composant dédié | 29 | Clamp horizontal, auto-dismiss |
| Route dédiée pour catalogues | Modal pageSheet in-screen | CLAUDE.md | Pas de stack expo-router polluée |

---

## Open Questions

1. **Test `village-parser.test.ts` VILLAGE_GRID count**
   - Connu: Le test dit `toHaveLength(4)` mais VILLAGE_GRID a déjà 11 entrées après Phase 29.
   - Inconnu: Ce test passe-t-il actuellement (peut-être le test n'a pas été lancé depuis Phase 25) ? Vérifier avec `npx jest --no-coverage lib/__tests__/village-parser.test.ts` en Wave 0 du plan data.
   - Recommandation: Corriger en même temps que l'ajout des 8 slots building.

2. **Extension AvatarTooltip vs fork BuildingTooltip**
   - La différence structurelle est minimale (une prop `label` string vs `profileName + count`). Le planner doit choisir: fork simple (30 lignes, zéro risk de régression AvatarTooltip) vs extraction d'un `BaseTooltip` (DRY mais touche Phase 29 code).
   - Recommandation: Fork BuildingTooltip — AvatarTooltip n'est pas un composant partagé entre projets, et le risque de régression Phase 29 VILL-03 est à éviter.

3. **Placement coordonnées: port à 0.45/0.92**
   - Port est en bas-centre, près des stalls (stall_0 à 0.22/0.65, stall_1 à 0.78/0.65). À y=0.92, il devrait être sous les stalls avec suffisamment de marge. À vérifier sur device car MAP_HEIGHT = 75% de SCREEN_H.
   - Recommandation: Le planner documente dans le plan que les coordonnées D-11 sont des propositions initiales et qu'une tâche de calibration visuelle doit suivre.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 30 est une modification pure code/assets. Tous les outils nécessaires (React Native, expo-router, expo-haptics, expo-secure-store) sont déjà utilisés dans le projet existant. Les assets sprites PNG sont déjà présents dans `assets/buildings/village/`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (Phase 19) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest --no-coverage lib/__tests__/village-parser.test.ts` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VILL-04 | BuildingSprite s'affiche quand buildingId dans unlockedBuildings | Smoke (manuel device) | N/A — render test React Native | Pas de test render automatisé |
| VILL-05 | parseGardenFile parse `## Constructions`, round-trip, appendBuilding | Unit | `npx jest --no-coverage lib/__tests__/village-parser.test.ts` | ✅ à étendre |
| VILL-05 | computeBuildingsToUnlock — idempotence, paliers corrects | Unit | `npx jest --no-coverage lib/__tests__/village-parser.test.ts` | ❌ Wave 0 |
| VILL-06 | Catalogue list statique BUILDINGS_CATALOG complète (8 entrées, paliers corrects) | Unit | `npx jest --no-coverage lib/__tests__/village-parser.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Par tâche commit:** `npx tsc --noEmit` (TypeScript gate obligatoire per CLAUDE.md)
- **Par wave merge:** `npx jest --no-coverage lib/__tests__/village-parser.test.ts`
- **Phase gate:** `npx tsc --noEmit && npx jest --no-coverage` full suite avant `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Tests `appendBuilding` dans `village-parser.test.ts` — couvre VILL-05 insert-before-Historique, backward compat (section absente), préservation contenu existant
- [ ] Tests `computeBuildingsToUnlock` dans `village-parser.test.ts` — couvre idempotence, palier exact, multiple déblocages en une passe
- [ ] Tests `BUILDINGS_CATALOG` dans `village-parser.test.ts` — smoke: 8 entrées, paliers triés croissants, IDs uniques
- [ ] Correction `VILLAGE_GRID.toHaveLength(4)` → valeur correcte après Phase 30

---

## Sources

### Primary (HIGH confidence)

- Source code direct: `lib/village/parser.ts` — pattern appendContribution, format fichier, sections
- Source code direct: `lib/village/types.ts` — interfaces existantes à étendre
- Source code direct: `lib/village/grid.ts` — pattern slots, nomenclature `village_`
- Source code direct: `hooks/useGarden.ts` — pattern effet réactif, accès `profiles`, `gardenRaw`/`setGardenRaw`
- Source code direct: `components/village/AvatarTooltip.tsx` — animation contract, auto-dismiss, clamp
- Source code direct: `components/village/VillageAvatar.tsx` — positioned sprite pattern
- Source code direct: `app/(tabs)/village.tsx` — overlay avatars pattern, mapSize, handleAvatarPress
- Source code direct: `lib/types.ts` lignes 98-99 — `profile.points: number`, `profile.coins: number`
- `.planning/phases/30-decorations-persistantes/30-CONTEXT.md` — toutes les décisions locked
- `.planning/phases/30-decorations-persistantes/30-UI-SPEC.md` — contrats animation, couleurs, typography

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — conventions FR, Reanimated, useThemeColors, modals pageSheet, expo-haptics, SecureStore
- `lib/__tests__/village-parser.test.ts` — structure de tests existante, fixtures FULL_GARDEN_FILE
- `hooks/useVault.ts` lignes 543, 1640-1641 — gardenRaw/setGardenRaw dans VaultState

---

## Metadata

**Confidence breakdown:**
- Data schema: HIGH — inspecté parser.ts existant + types.ts, pattern clair
- Unlock engine: HIGH — useGarden.ts lu, accès profiles confirmé, pattern effet réactif clair
- Village render integration: HIGH — village.tsx lu en entier, mapContainer pattern confirmé
- Catalogue UI: HIGH — AvatarTooltip/VillageAvatar patterns lus, CLAUDE.md conventions confirmées
- Test coverage: HIGH — village-parser.test.ts lu, gaps identifiés précisément

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable codebase, dépendances gelées ARCH-05)
