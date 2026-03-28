# Phase 6: Bâtiments Productifs - Research

**Researched:** 2026-03-28
**Domain:** Farm buildings system — idle resource generation, upgrade tiers, vault persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Types de bâtiments (BAT-01)**
- D-01: 3 bâtiments au total : poulailler (existant), grange (existant), moulin (nouveau). Garder les 2 existants du BUILDING_CATALOG + ajouter 1.
- D-02: Le moulin transforme le blé en farine — prépare le terrain pour Phase 7 (Craft). Nécessite un 3ème slot building dans world-grid.ts.
- D-03: Chaque bâtiment a un `minTreeStage` requis pour le débloquer (poulailler = arbuste, grange = arbre, moulin = arbre ou majestueux)

**Production passive (BAT-02)**
- D-04: Check au lancement — quand l'app s'ouvre, calculer le temps écoulé depuis la dernière collecte et générer les ressources accumulées. Pas de timer en background.
- D-05: Ressources spécifiques par bâtiment — poulailler → oeufs, grange → lait, moulin → farine. Nouveau système d'inventaire de ressources.
- D-06: Bulle/badge sur le bâtiment quand des ressources sont prêtes à collecter. Tap pour collecter (style Stardew Valley / Hay Day).
- D-07: Fréquence de production : 4-8 heures par unité. 1-2 collectes par jour, rythme adapté au quotidien familial.
- D-08: Les ressources produites sont persistées dans le vault (gamification.md ou fichier dédié) et survivent à un redémarrage.

**Améliorations bâtiments (BAT-03)**
- D-09: 3 niveaux par bâtiment : Niveau 1 (base), Niveau 2 (+50% production, ou fréquence réduite), Niveau 3 (+100% production)
- D-10: Coût en feuilles (monnaie existante) croissant par niveau. Pas de coût en ressources.
- D-11: Sprite différent par niveau — 3 sprites par bâtiment (petit → moyen → grand/orné). Changement visuel immédiat après upgrade.
- D-12: 3 bâtiments x 3 niveaux = 9 sprites de bâtiment au total

**Interface construction**
- D-13: Tap cellule building vide → bottom sheet avec liste des bâtiments constructibles, coût, et bouton construire. Pattern similaire au tap parcelle crop.
- D-14: Tap bâtiment placé → bottom sheet détail : production actuelle, ressources accumulées (bouton collecter), et bouton améliorer avec coût du prochain niveau.
- D-15: Sprites de bâtiments générés par IA dans le style Mana Seed pixel 32x32 (pas de pack Mana Seed bâtiments disponible).

### Claude's Discretion
- Structure exacte de la persistance inventaire dans le vault (nouveau fichier ou extension gamification.md)
- Calibration précise des coûts de construction/amélioration contre le modèle XP budget
- Fréquence exacte de production par bâtiment (4h, 6h, ou 8h)
- Animation de collecte (burst particules, son, haptics)
- Ajout du 3ème slot building dans world-grid.ts (position exacte)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BAT-01 | L'utilisateur peut construire un bâtiment productif (moulin, serre, étable) sur une parcelle dédiée | BUILDING_CATALOG extensible, BUILDING_CELLS (b0/b1) déjà dans world-grid, b2 à ajouter. BuildingDefinition à étendre avec `level` et `resourceType`. |
| BAT-02 | Les bâtiments génèrent des ressources passivement (une récolte toutes les X heures) | collectPassiveIncome() existe dans useFarm mais produit des coins. À remplacer par un système d'inventaire de ressources spécifiques. Persistance via famille.md (pattern farm_last_collect déjà établi). |
| BAT-03 | Les bâtiments ont au moins 2 niveaux d'amélioration qui augmentent la production | BuildingDefinition actuelle sans concept de niveau. Nécessite PlacedBuilding{buildingId, level, cellId, lastCollectAt} persisté dans famille.md, et upgradeBuilding() dans useFarm. |
</phase_requirements>

---

## Summary

Phase 6 s'appuie sur un système de bâtiments déjà partiellement scaffoldé dans le codebase. `BuildingDefinition`, `BUILDING_CATALOG`, `BUILDING_CELLS`, et `buyBuilding()`/`collectPassiveIncome()` existent, mais le modèle actuel est incomplet : les bâtiments sont stockés sous forme de liste d'IDs (`farmBuildings: string[]`), sans notion de niveau ni de ressource spécifique, et la production passive génère uniquement des feuilles (coins) au lieu de ressources typées (oeufs/lait/farine).

L'implémentation doit migrer le stockage vers une structure `PlacedBuilding` (buildingId + level + cellId + lastCollectAt) persistée dans famille.md, introduire un inventaire de ressources (`farmInventory`), et étendre `BuildingDefinition` avec `levels` (array de tiers avec productionRate + upgradeCoins + spritePath). Le pattern de persistence (lecture/écriture ligne-par-ligne dans famille.md) est bien établi et doit être reproduit. L'UI suit le pattern tap-cellule → bottom sheet existant dans WorldGridView/FarmPlots.

**Recommandation principale:** Migrer `farmBuildings: string[]` vers `farmBuildings: PlacedBuilding[]` serialisé en CSV compact dans famille.md, ajouter `farmInventory` pour les ressources, et créer `BuildingCell` dans WorldGridView sur le modèle `CropCell`.

---

## Standard Stack

### Core (tout est déjà dans le projet)

| Bibliothèque | Version | Usage pour cette phase | Confiance |
|---|---|---|---|
| react-native-reanimated | ~4.1.1 | Animations collecte (burst, badge pulse) | HIGH |
| expo-haptics | ~15.0.8 | Feedback tactile sur collecte/upgrade | HIGH |
| gray-matter | ^4.0.3 | Déjà utilisé pour famille.md via parser.ts | HIGH |
| date-fns | ^4.1.0 | Calcul heures écoulées depuis lastCollectAt | HIGH |

Pas de nouvelles dépendances requises pour cette phase.

---

## Architecture Patterns

### Structures de données à créer

**PlacedBuilding** — remplace `farmBuildings: string[]`

```typescript
// Source: analyse du codebase existant + décisions CONTEXT.md
export interface PlacedBuilding {
  buildingId: string;   // 'poulailler' | 'grange' | 'moulin'
  cellId: string;       // 'b0' | 'b1' | 'b2'
  level: number;        // 1 | 2 | 3
  lastCollectAt: string; // ISO date YYYY-MM-DDTHH:mm ou YYYY-MM-DD
}
```

**BuildingTier** — niveaux d'un bâtiment

```typescript
export interface BuildingTier {
  level: number;            // 1, 2, 3
  productionRateHours: number;  // heures entre chaque unité produite
  upgradeCoins: number;     // coût pour passer au niveau suivant (0 pour le Niv 1 = construction initiale)
  spritePath: string;       // require() path — ex: '../../assets/buildings/poulailler_1.png'
}
```

**BuildingDefinition étendu**

```typescript
export interface BuildingDefinition {
  id: string;
  labelKey: string;
  emoji: string;
  buildCost: number;        // coût construction initiale (Niveau 1)
  resourceType: 'oeuf' | 'lait' | 'farine';
  minTreeStage: TreeStage;
  tiers: BuildingTier[];    // index 0 = Niveau 1, index 1 = Niveau 2, etc.
  // dailyIncome supprimé — remplacé par productionRateHours par tier
}
```

**FarmInventory** — ressources collectées

```typescript
export type ResourceType = 'oeuf' | 'lait' | 'farine';

export interface FarmInventory {
  oeuf: number;
  lait: number;
  farine: number;
}
```

**Profile étendu** — champs à ajouter dans `lib/types.ts`

```typescript
// Dans l'interface Profile existante :
farmBuildings: PlacedBuilding[];   // remplace farmBuildings: string[]
farmInventory: FarmInventory;      // nouvelle propriété
```

### Persistance dans famille.md

Reproduire le pattern `farm_crops` / `farm_buildings` existant dans `lib/parser.ts`.

**Serialisation PlacedBuilding** — CSV compact, un bâtiment par segment :
```
farm_buildings: poulailler:b0:1:2026-03-28T10:00,grange:b1:2:2026-03-27T08:00
```
Format : `buildingId:cellId:level:lastCollectAt` séparés par virgule.

**Serialisation FarmInventory** :
```
farm_inventory: oeuf:3,lait:1,farine:0
```

Les deux champs coexistent dans la section `### profileId` de famille.md, comme `farm_crops` et `farm_buildings` actuels.

**Migration nécessaire** : l'ancien format `farm_buildings: poulailler,grange` (liste d'IDs) doit être migré vers le nouveau format au premier parse. La fonction `parseFamille()` dans `lib/parser.ts` doit gérer les deux formats.

### Structure du module building-engine

Créer `lib/mascot/building-engine.ts` sur le modèle de `farm-engine.ts` :

```typescript
// Source: pattern farm-engine.ts
export function constructBuilding(
  buildings: PlacedBuilding[],
  buildingId: string,
  cellId: string,
): PlacedBuilding[]

export function upgradeBuilding(
  buildings: PlacedBuilding[],
  cellId: string,
): PlacedBuilding[]

export function collectBuilding(
  buildings: PlacedBuilding[],
  inventory: FarmInventory,
  cellId: string,
  now?: Date,
): { buildings: PlacedBuilding[]; inventory: FarmInventory; collected: number }

export function getPendingResources(
  building: PlacedBuilding,
  now?: Date,
): number  // unités en attente (cappées à MAX_PENDING)

export function serializeBuildings(buildings: PlacedBuilding[]): string
export function parseBuildings(csv: string): PlacedBuilding[]
export function serializeInventory(inv: FarmInventory): string
export function parseInventory(csv: string): FarmInventory
```

### Pattern useFarm étendu

Ajouter dans `hooks/useFarm.ts` :

```typescript
// Pattern: calqué sur buyBuilding() existant — lecture/écriture famille.md
const upgradeBuilding = useCallback(async (profileId: string, cellId: string) => { ... }, [...])

// Pattern: calqué sur collectPassiveIncome() existant
const collectBuildingResources = useCallback(async (profileId: string, cellId: string) => { ... }, [...])

// collectPassiveIncome() refactoré pour gérer le nouveau format
const collectPassiveIncome = useCallback(async (profileId: string): Promise<number> => { ... }, [...])
```

### WorldGridView — BuildingCell

Créer `BuildingCell` dans `components/mascot/WorldGridView.tsx` à côté de `CropCell` existant :

```typescript
// Pattern: reproduire CropCell avec état "vide" / "construit" / "ressources prêtes"
function BuildingCell({ cell, placedBuilding, ... }: BuildingCellProps) {
  // Badge count quand pendingResources > 0
  // Sprite selon building.level (BUILDING_SPRITES[buildingId][level])
  // Pulse animation si ressources en attente
}
```

### WorldGridView — props étendues

```typescript
interface WorldGridViewProps {
  treeStage: TreeStage;
  farmCropsCSV: string;
  ownedBuildings: PlacedBuilding[];  // ÉTAIT string[] — migration nécessaire
  containerWidth: number;
  containerHeight: number;
  farmInventory?: FarmInventory;     // nouveau
  onCropPlotPress?: (cellId: string, crop: PlantedCrop | null) => void;
  onBuildingCellPress?: (cellId: string, building: PlacedBuilding | null) => void;  // nouveau
}
```

### Slot b2 dans world-grid.ts

Ajouter une 3ème cellule bâtiment. Position recommandée : row 1 (milieu haut), col 5 — symétrique avec b0 (row 2, col 5). Cela conserve les bâtiments groupés à droite de la grille.

```typescript
// world-grid.ts — à ajouter dans WORLD_GRID
{ id: 'b2', col: 5, row: 1, x: 0.90, y: 0.32, cellType: 'building', unlockOrder: 19, size: 'large' },
```

`unlockOrder: 19` (après b1 à 18) — le moulin est le bâtiment le plus tardif.

### Sprites bâtiments

Créer `lib/mascot/building-sprites.ts` sur le modèle de `crop-sprites.ts` :

```typescript
// Source: pattern CROP_SPRITES dans lib/mascot/crop-sprites.ts
export const BUILDING_SPRITES: Record<string, Record<number, number>> = {
  poulailler: {
    1: require('../../assets/buildings/poulailler_1.png'),
    2: require('../../assets/buildings/poulailler_2.png'),
    3: require('../../assets/buildings/poulailler_3.png'),
  },
  grange: {
    1: require('../../assets/buildings/grange_1.png'),
    2: require('../../assets/buildings/grange_2.png'),
    3: require('../../assets/buildings/grange_3.png'),
  },
  moulin: {
    1: require('../../assets/buildings/moulin_1.png'),
    2: require('../../assets/buildings/moulin_2.png'),
    3: require('../../assets/buildings/moulin_3.png'),
  },
};
```

Les assets (9 sprites 32x32) doivent être générés par IA dans le style Mana Seed pixel avant l'implémentation ou au Wave 0 du plan.

### Bottom sheets

Deux bottom sheets distinctes (modals `pageSheet`) :

**BuildingShopSheet** — tap sur cellule vide
- Liste les bâtiments disponibles pour ce slot (filtrés par `minTreeStage`)
- Affiche coût construction, ressource produite, fréquence
- Bouton construire (désactivé si coins insuffisants)
- Pattern : reproduire `TreeShop.tsx`

**BuildingDetailSheet** — tap sur bâtiment placé
- Nom, niveau actuel, ressource produite
- Ressources accumulées en attente + bouton "Collecter"
- Prochain niveau + coût + bouton "Améliorer" (si niveau < 3)
- Animation burst à la collecte (reproduire `HarvestBurst.tsx`)

### Anti-Patterns à éviter

- **Ne pas stocker lastCollectAt comme YYYY-MM-DD seul** : avec une granularité de 4-8h, la date seule ne suffit pas. Utiliser ISO datetime `YYYY-MM-DDTHH:mm`.
- **Ne pas cap à 1 jour de rattrapage** : le code actuel cappe à 7 jours (`Math.min(7, days)`). Pour les ressources typées, capper à un maximum sensé (ex : 3 collectes max en attente par bâtiment) pour éviter le stockpile excessif.
- **Ne pas recalculer les ressources à chaque render** : `getPendingResources()` doit être appelé une fois à l'ouverture, pas dans `useAnimatedStyle`.
- **Ne pas modifier `dailyIncome` dans BUILDING_CATALOG sans migration** : l'ancien format est lu par `collectPassiveIncome()`. Refactorer en même temps que la migration.

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser plutôt | Pourquoi |
|---|---|---|---|
| Calcul temps écoulé | Arithmétique manuelle sur strings | `date-fns` differenceInHours() | Gère DST, parsing robuste |
| Animations collecte | withTiming custom | `HarvestBurst.tsx` existant + withSpring | Déjà testé, cohérent visuellement |
| Lecture/écriture famille.md | Nouveau parser | Pattern writeFarmCrops() dans useFarm.ts | Pattern établi, fiable |
| Badge count sur bâtiment | Composant custom | View + Text en absolute (pattern existant dans l'app) | Simple suffit |

---

## Calibration économique

### XP Budget Model (depuis `lib/gamification/rewards.ts`)

```
POINTS_PER_TASK = 10
Scenario baseline : 3 tâches/jour x 5j/semaine = 150 feuilles/semaine
Niveau 10 atteint à ~5400 XP ~ 540 tâches
```

### Revenus cultures actives (pour comparaison)

| Culture | Tâches requises | Récompense | Feuilles/tâche | ROI (reward - cost) |
|---|---|---|---|---|
| carotte | 4 tâches | 25 feuilles | 6.25 | 20 (cost: 5) |
| blé | 4 tâches | 40 feuilles | 10 | 30 (cost: 10) |
| tomate | 8 tâches | 80 feuilles | 10 | 65 (cost: 15) |
| maïs | 12 tâches | 150 feuilles | 12.5 | 120 (cost: 30) |

**Règle BAT-02** : les bâtiments doivent générer 20-30% du revenu actif (cultures). Revenu actif estimé ~40 feuilles/jour (4 parcelles × 1 récolte/jour). Les bâtiments doivent générer 8-12 feuilles/jour équivalent (en valeur de ressources) pour respecter la règle de Phase 2.

### Calibration bâtiments recommandée

**Fréquence de production** — 6h pour le poulailler (accessible tôt), 8h pour grange et moulin (plus tardifs).

| Bâtiment | Niveau | Fréq. production | Coût construction | Coût upgrade | Ressource |
|---|---|---|---|---|---|
| Poulailler | 1 | 6h/oeuf | 300 | — | oeuf |
| Poulailler | 2 | 4h/oeuf | — | 500 | oeuf |
| Poulailler | 3 | 3h/oeuf | — | 1000 | oeuf |
| Grange | 1 | 8h/lait | 800 | — | lait |
| Grange | 2 | 6h/lait | — | 1200 | lait |
| Grange | 3 | 4h/lait | — | 2000 | lait |
| Moulin | 1 | 8h/farine | 1200 | — | farine |
| Moulin | 2 | 6h/farine | — | 1800 | farine |
| Moulin | 3 | 4h/farine | — | 3000 | farine |

**ROI construction** : poulailler Niv 1 à 300 feuilles = ~2 jours de cultures (150 feuilles/jour baseline). Remboursé en ~1 semaine de collectes actives — investissement stratégique cohérent.

**Cap ressources en attente** : limiter à 3 unités max par bâtiment (évite le stockpile et garde la motivation de revenir régulièrement).

### Valeur des ressources vs coins

Les ressources (oeufs, lait, farine) sont une nouvelle monnaie pour Phase 7 (Craft). Pour Phase 6, elles n'ont pas de valeur en coins — elles s'accumulent dans l'inventaire et seront consommées en Phase 7. Ne pas convertir en feuilles.

---

## Common Pitfalls

### Pitfall 1 : Migration farmBuildings string[] → PlacedBuilding[]

**Ce qui déraille** : l'ancien format `farm_buildings: poulailler,grange` (string CSV) existe déjà en production dans le vault Obsidian. Parser le nouveau format sur un vault avec l'ancien format silhouettera un crash ou des données perdues.

**Pourquoi** : `parseFamille()` lit `currentProps.farm_buildings` et fait `.split(',')`. Le nouveau format est `poulailler:b0:1:2026-03-28T10:00` — le split naïf cassera sur les colons.

**Comment éviter** : dans `parseFamille()`, détecter si la valeur contient des colons (nouveau format) ou non (ancien format). Si ancien format, migrer implicitement : assigner le premier bâtiment à b0, le second à b1, level 1, lastCollectAt = aujourd'hui.

```typescript
// Dans parseFamille() — détection format
const rawBuildings = currentProps.farm_buildings ?? '';
const farmBuildings: PlacedBuilding[] = rawBuildings
  ? parseBuildings(rawBuildings)   // gère les deux formats
  : [];
```

### Pitfall 2 : lastCollectAt en date seule vs datetime

**Ce qui déraille** : stocker `2026-03-28` au lieu de `2026-03-28T10:30` fait que toutes les collectes d'une même journée sont groupées — un bâtiment qui produit toutes les 6h ne peut être collecté qu'une fois par jour.

**Comment éviter** : toujours persister en ISO datetime (`new Date().toISOString().slice(0, 16)`). Lors du parse, traiter les valeurs sans heure comme `T00:00`.

### Pitfall 3 : collectPassiveIncome() toujours appelé à l'ouverture

**Ce qui déraille** : le code actuel dans `tree.tsx` appelle `collectPassiveIncome(profile.id)` dans un `useEffect` sans dépendances. La refactorisation ne doit pas casser ce point d'entrée, même si l'implémentation change radicalement.

**Comment éviter** : garder la signature `collectPassiveIncome(profileId: string): Promise<number>` inchangée. Retourner le nombre de feuilles collectées (pour compatibilité toast actuel) même si la vraie production est maintenant en ressources typées.

**Note** : le revenu passif actuel (`dailyIncome: 5/8 feuilles`) des bâtiments existants sera remplacé par les ressources typées — mais `collectPassiveIncome` peut retourner 0 coins pour les bâtiments upgrade et gérer la collecte via `collectBuildingResources`. Ou conserver une partie coins pour la cohérence de la progression.

### Pitfall 4 : Slot b2 sans mise à jour des guards existants

**Ce qui déraille** : `WorldGridView.tsx` itère sur `BUILDING_CELLS` directement. Ajouter b2 dans `WORLD_GRID` le rend visible immédiatement dans l'UI — sans guard de `unlockOrder` cohérent, le slot apparaît avant que le moulin soit déblocable.

**Comment éviter** : les bâtiments sont affichés selon `BUILDING_CELLS` (filtré par `cellType === 'building'`). Il n'y a pas de `getUnlockedBuildingCells()` équivalent à `getUnlockedCropCells()`. Créer `getUnlockedBuildingCells(treeStage)` en parallèle, ou ne jamais afficher b2 avant `minTreeStage` du moulin.

### Pitfall 5 : Conflit de nommage farm_buildings

**Ce qui déraille** : l'ancien champ `farm_buildings` dans famille.md sera écrasé avec le nouveau format lors de la première écriture. Si un utilisateur passe à la nouvelle version sans migration, ses bâtiments existants sont perdus.

**Comment éviter** : la migration implicite dans `parseBuildings()` (voir Pitfall 1) gère ce cas. Tester le round-trip parse → serialize → parse sur un vault avec ancien format avant de pousser.

---

## Code Examples

### Calcul ressources en attente (date-fns)

```typescript
// Source: pattern collectPassiveIncome() dans hooks/useFarm.ts
import { differenceInHours, parseISO } from 'date-fns';

export function getPendingResources(
  building: PlacedBuilding,
  buildingDef: BuildingDefinition,
  now: Date = new Date(),
  maxPending = 3,
): number {
  const tier = buildingDef.tiers[building.level - 1];
  if (!tier) return 0;

  const lastCollect = building.lastCollectAt
    ? parseISO(building.lastCollectAt)
    : new Date(0);

  const hoursElapsed = differenceInHours(now, lastCollect);
  const units = Math.floor(hoursElapsed / tier.productionRateHours);
  return Math.min(units, maxPending);
}
```

### Sérialisation PlacedBuilding (pattern farm-engine)

```typescript
// Source: pattern serializeCrops() dans lib/mascot/farm-engine.ts
export function serializeBuildings(buildings: PlacedBuilding[]): string {
  if (buildings.length === 0) return '';
  return buildings
    .map(b => `${b.buildingId}:${b.cellId}:${b.level}:${b.lastCollectAt}`)
    .join(',');
}

export function parseBuildings(csv: string): PlacedBuilding[] {
  if (!csv || csv.trim() === '') return [];

  return csv.split(',').map(entry => {
    const parts = entry.split(':');

    // Ancien format : "poulailler" (ID seul) — migration implicite
    if (parts.length === 1) {
      const LEGACY_CELL_MAP: Record<string, string> = { poulailler: 'b0', grange: 'b1' };
      return {
        buildingId: parts[0].trim(),
        cellId: LEGACY_CELL_MAP[parts[0].trim()] ?? 'b0',
        level: 1,
        lastCollectAt: new Date().toISOString().slice(0, 16),
      };
    }

    // Nouveau format : "poulailler:b0:1:2026-03-28T10:00"
    const [buildingId, cellId, levelStr, ...dateParts] = parts;
    return {
      buildingId: buildingId.trim(),
      cellId: cellId.trim(),
      level: Math.max(1, Math.min(3, parseInt(levelStr, 10) || 1)),
      lastCollectAt: dateParts.join(':').trim() || new Date().toISOString().slice(0, 16),
    };
  }).filter(b => b.buildingId && b.cellId);
}
```

### Parser famille.md — lecture farmBuildings et farmInventory

```typescript
// Dans parseFamille() — lib/parser.ts (à modifier)
// Après les lignes existantes pour farm_crops et farm_buildings :
const farmBuildings = currentProps.farm_buildings
  ? parseBuildings(currentProps.farm_buildings)  // gère l'ancien format
  : [];

const farmInventory: FarmInventory = currentProps.farm_inventory
  ? parseInventory(currentProps.farm_inventory)
  : { oeuf: 0, lait: 0, farine: 0 };
```

### Écriture vault dans useFarm (pattern writeFarmCrops)

```typescript
// Source: pattern writeFarmCrops() dans hooks/useFarm.ts
const writeBuildingField = useCallback(
  async (profileId: string, fieldKey: string, value: string) => {
    if (!vault) return;
    const content = await vault.readFile(FAMILLE_FILE);
    const lines = content.split('\n');
    let inSection = false;
    let fieldLine = -1;
    let lastPropIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        if (lines[i].trim().startsWith(`${fieldKey}:`)) fieldLine = i;
      }
    }

    const newValue = `${fieldKey}: ${value}`;
    if (fieldLine >= 0) {
      lines[fieldLine] = newValue;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, newValue);
    }
    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
  },
  [vault],
);
```

### BuildingCell dans WorldGridView

```typescript
// Pattern: CropCell dans WorldGridView.tsx (à reproduire)
function BuildingCell({ cell, placedBuilding, pendingCount, containerWidth, containerHeight, onPress }: BuildingCellProps) {
  const pulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!reducedMotion && pendingCount > 0) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    } else {
      pulse.value = 1;
    }
  }, [reducedMotion, pendingCount > 0]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const size = CELL_SIZES[cell.size]; // 64 pour 'large'
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animStyle]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flex: 1 }}>
        {placedBuilding
          ? <Image source={BUILDING_SPRITES[placedBuilding.buildingId][placedBuilding.level]} style={{ width: size, height: size }} />
          : <View style={styles.emptyBuildingCell}><Text style={styles.emptyBuildingPlus}>🏗️</Text></View>
        }
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
```

---

## State of the Art

| Avant (code existant) | Après (cette phase) | Impact |
|---|---|---|
| `farmBuildings: string[]` (IDs seuls) | `farmBuildings: PlacedBuilding[]` (avec level + cellId + lastCollectAt) | Migration vault nécessaire, rétrocompatible |
| `collectPassiveIncome()` → coins | `collectBuildingResources()` → inventory typé | Nouveau système parallèle |
| `BuildingDefinition.dailyIncome` | `BuildingDefinition.tiers[].productionRateHours` | Plus granulaire, heure-based |
| `BUILDING_CELLS` : b0, b1 | `BUILDING_CELLS` : b0, b1, b2 | +1 slot pour le moulin |
| `WorldGridView` : buildings = ownedBuildings (string[]) | Buildings = PlacedBuilding[] avec rendu BuildingCell | Affichage niveau + badge |

**Dépréciés après cette phase :**
- `BuildingDefinition.dailyIncome` (remplacé par tiers)
- `farmBuildings: string[]` dans Profile (remplacé par PlacedBuilding[])
- `collectPassiveIncome()` version pièces — à garder fonctionnel pour retour arrière éventuel ou retirer progressivement

---

## Open Questions

1. **Valeur d'exchange ressources → coins**
   - Ce qu'on sait : les ressources (oeufs, lait, farine) sont prévues pour Phase 7 (Craft)
   - Ce qui est flou : faut-il permettre de "vendre" des ressources en coins pour Phase 6 ? Sinon, l'inventaire grossit sans utilité jusqu'à Phase 7.
   - Recommandation : ajouter un bouton "Vendre" dans BuildingDetailSheet (1 ressource = X coins, X = moitié du revenu passif). Laisser à la discrétion du planner.

2. **Slot b2 — unlockOrder et minTreeStage du moulin**
   - Ce qu'on sait : poulailler = arbuste, grange = arbre. D-03 dit "moulin = arbre ou majestueux"
   - Ce qui est flou : si moulin = arbre (comme grange), les 3 slots b0/b1/b2 sont tous accessibles au même stade
   - Recommandation : moulin = majestueux (niveau 19+). Cela échelonne l'engagement et donne une raison de progresser vers majestueux.

3. **collectPassiveIncome() — coins ou ressources ?**
   - Ce qu'on sait : la fonction actuelle distribue des coins. Les bâtiments vont maintenant produire des ressources typées.
   - Ce qui est flou : faut-il supprimer le revenu en coins complètement, ou maintenir un revenu coins réduit en parallèle des ressources ?
   - Recommandation : convertir entièrement vers ressources. Supprimer `dailyIncome`. Le toast existant `🏠 +${income} 🍃` peut afficher les ressources collectées à la place.

---

## Sources

### Primary (HIGH confidence)
- `lib/mascot/types.ts` — BuildingDefinition, BUILDING_CATALOG (poulailler + grange), PlantedCrop comme modèle pour PlacedBuilding
- `lib/mascot/world-grid.ts` — WORLD_GRID, BUILDING_CELLS (b0, b1), CellType
- `lib/mascot/farm-engine.ts` — Pattern serialize/parse CSV, plantCrop/harvestCrop comme modèle
- `hooks/useFarm.ts` — buyBuilding(), collectPassiveIncome(), writeFarmCrops() — patterns de lecture/écriture vault
- `lib/parser.ts:550-611` — parseFamille(), format farm_crops / farm_buildings dans famille.md
- `lib/types.ts:67-96` — Interface Profile, farmBuildings: string[], coins: number
- `lib/gamification/rewards.ts:195-234` — XP Budget Model, POINTS_PER_TASK = 10, baseline 150 feuilles/semaine
- `components/mascot/WorldGridView.tsx` — CropCell pattern, WorldGridViewProps, BUILDING_CELLS rendu
- `components/mascot/FarmPlots.tsx` — Pattern tap → action, animations pulse/burst
- `.planning/phases/06-batiments-productifs/06-CONTEXT.md` — Décisions D-01 à D-15, locked + discretion

### Secondary (MEDIUM confidence)
- Pattern idle game "check on open" (D-04) — standard dans les jeux mobiles sans background processing. Cohérent avec l'absence de backend dans FamilyFlow.
- Calibration économique (coûts, fréquences) — déduite du XP budget model documenté. Valeurs précises à la discrétion du planner.

---

## Metadata

**Confidence breakdown:**
- Structure de données (PlacedBuilding, BuildingTier) : HIGH — déduite directement du code existant + CONTEXT.md
- Pattern persistance vault : HIGH — pattern identique déjà utilisé 3 fois (farm_crops, farm_buildings, farm_last_collect)
- Calibration économique (fréquences, coûts) : MEDIUM — calculée depuis XP budget, mais valeurs finales à valider par le planner
- Migration rétrocompatible : HIGH — format détectable par présence de colons dans la valeur

**Research date:** 2026-03-28
**Valid until:** 2026-05-01 (stable — pas de dépendances tierces nouvelles)
