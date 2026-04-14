# Phase 33: Expéditions - Research

**Researched:** 2026-04-14
**Domain:** Système de missions à timer avec économie de ressources, probabilités pondérées, et persistance Markdown
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Catalogue & difficulté**
- D-01: Pool rotatif de 3 missions par jour (seed basé sur la date = même pool pour toute la famille)
- D-02: Coût d'entrée double : feuilles + récoltes (style OGame métal+cristal+deutérium). Les deux ressources sont consommées, créant un double sink.
- D-03: 3 niveaux de difficulté par rotation : Facile / Moyen / Dur — les thèmes et destinations varient chaque jour

**Timer & déroulement**
- D-04: Durées par difficulté : Facile 4h, Moyen 12h, Dur 24h
- D-05: Maximum 2 expéditions simultanées par profil — permet de lancer une courte + une longue en parallèle
- D-06: Résultat calculé au retour dans l'app (pattern `lastCollectAt` des bâtiments). Pas de notification push. Effet surprise à l'ouverture.

**Résultats & loot table**
- D-07: Perte totale de la mise en cas d'échec — le risque est réel, OGame-style. Confirmation claire avant lancement.
- D-08: Probabilités pour difficulté moyenne (12h) : Réussite 40%, Partielle 30%, Échec 20%, Découverte rare 10%. Ajuster par difficulté (facile = plus de succès, dur = plus de rare).
- D-09: Types de récompenses exclusives : habitants exclusifs (Renard, Aigle, etc.), graines rares boostées (Fleur de lave, etc.), boosters temporaires (x2 récolte, x2 production, +chance dorée). Pas de décos exclusives expédition.
- D-10: Pity system : après 5 échecs consécutifs, prochaine expédition garantie réussite minimum. Même pattern que le loot box existant (gamification/rewards.ts).

**UI & point d'entrée**
- D-11: Point d'entrée : bâtiment "Camp d'exploration" sur la grille ferme. Tap → ouvre le modal expéditions.
- D-12: Modal pageSheet (pattern BuildingsCatalog) pour le catalogue d'expéditions. Drag-to-dismiss, spring animations.
- D-13: Résultat : coffre animé à ouvrir (tap) avec animation d'ouverture + haptic + révélation du contenu
- D-14: Indicateur en cours : badge numérique (1/2) + mini countdown sur le bâtiment Camp d'exploration

### Claude's Discretion
- Thèmes/noms des destinations d'expédition (Forêt, Montagne, Océan, etc.)
- Coûts exacts par niveau de difficulté (scaling feuilles + quelles récoltes)
- Probabilités exactes pour Facile et Dur (ajustement depuis la baseline Moyen 40/30/20/10)
- Nombre et identité des habitants/graines exclusifs
- Durée et puissance des boosters temporaires
- Algorithme de génération du pool rotatif quotidien (seed date-based)

### Deferred Ideas (OUT OF SCOPE)
- Bâtiments à niveaux infinis OGame-style : upgrade exponentiels des bâtiments existants
- Expéditions familiales collectives : toute la famille contribue vers une mission commune
- Marché rotatif : marchand avec items exclusifs qui changent
- Défense de ferme : événements aléatoires menaçant la ferme + structures de protection
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VILL-16 | User peut lancer une expédition depuis la ferme en misant des feuilles et/ou des récoltes du stock | expedition-engine.ts : deductCost() consomme coins + harvestInventory de FarmProfileData ; confirmLaunch → Alert.alert() français |
| VILL-17 | User voit un timer d'expédition en cours avec la durée restante et la difficulté choisie | Pattern lastCollectAt de building-engine.ts directement réutilisable ; mini-countdown sur CampExplorationCell |
| VILL-18 | User reçoit un résultat aléatoire pondéré à la fin de l'expédition avec feedback visuel | rollExpeditionResult() calqué sur rewards.ts ; coffre animé + expo-haptics ; résolution lazy au focus de l'écran |
| VILL-19 | User peut consulter un catalogue d'expéditions disponibles avec coûts, durées et niveaux de difficulté | EXPEDITION_CATALOG + pool rotatif seed date ; modal ExpeditionsSheet pageSheet |
| VILL-20 | User retrouve les résultats d'expéditions et les objets découverts après un restart | Champs active_expeditions + expedition_pity dans farm-{profileId}.md ; parse/serialize CSV pipe-séparé |
</phase_requirements>

---

## Summary

Phase 33 implémente un système d'expéditions inspiré d'OGame : le joueur envoie des missions à timer en misant des ressources (feuilles + récoltes), reçoit un résultat probabiliste au retour, et peut obtenir des items exclusifs. L'architecture s'appuie entièrement sur l'infrastructure existante : le pattern `lastCollectAt` de `building-engine.ts` pour les timers, `rewards.ts` pour le système de pity et les tables de probabilités, et `serializeFarmProfile` / `parseFarmProfile` pour la persistance dans `farm-{profileId}.md`.

Le système se décompose en 4 couches : (1) `lib/mascot/expedition-engine.ts` — logique pure (catalogue, roll, coût, pity), (2) `hooks/useExpeditions.ts` — orchestration lecture/écriture vault, (3) `components/mascot/ExpeditionsSheet.tsx` — modal catalogue + active + résultat, (4) intégration dans `app/(tabs)/tree.tsx` pour le bâtiment Camp d'exploration. Aucune nouvelle dépendance npm n'est nécessaire.

Le point d'attention principal est la sérialisation des expéditions actives dans le format CSV existant de `farm-{profileId}.md`, en suivant scrupuleusement les patterns établis (séparateur `|` pour les arrays, `:` pour les sous-champs, pas d'append en fin de fichier). La mise-à-jour des champs dans le fichier doit utiliser le même mécanisme de remplacement de ligne utilisé par `serializeFarmProfile`.

**Primary recommendation:** Modéliser expedition-engine.ts sur le couple building-engine.ts (timer via startedAt ISO) + rewards.ts (weighted roll + pity), et persister dans FarmProfileData avec deux nouveaux champs CSV.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1 | Animation coffre + spring modal | Obligatoire CLAUDE.md — pas RN Animated |
| expo-haptics | (Expo SDK 54) | Feedback tactile révélation résultat | Patron établi dans tout le codebase |
| expo-secure-store | (Expo SDK 54) | Badge "nouveau résultat" lifecycle | Patron SecureStore badge établi Phase 30 |
| gray-matter | existant | Pas utilisé pour ce format (farm files custom) | farm-{id}.md est format key:value non YAML |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | existant | Formatage durées countdowns | Déjà importé dans parser.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nouveau fichier expedition-{id}.md | Champs dans farm-{id}.md | Farm-{id}.md est la source de vérité pour tout ce qui est per-profil — cohérence > isolation |
| Notifications push pour timer expiré | Pattern lazy (D-06) | Pas de permission push nécessaire, surprise à l'ouverture = effet OGame voulu |

**Installation:** Aucune nouvelle dépendance npm.

---

## Architecture Patterns

### Structure fichiers nouveaux

```
lib/mascot/
├── expedition-engine.ts     # Logique pure : catalogue, roll, coût, pity, seed quotidien
hooks/
├── useExpeditions.ts        # Orchestration : lire/écrire FarmProfileData, lancer, collecter
components/mascot/
├── ExpeditionsSheet.tsx     # Modal pageSheet : catalogue, onglet actives, onglet résultats
├── CampExplorationCell.tsx  # Cellule bâtiment spéciale : badge + mini countdown
```

### Modifications fichiers existants

```
lib/types.ts                 # + ActiveExpedition interface, + champs dans FarmProfileData
lib/parser.ts                # + parseActiveExpeditions(), serializeActiveExpeditions()
lib/mascot/types.ts          # + TREE_INHABITANTS : renard_expedition, aigle_expedition
                             # + CROP_CATALOG : fleur_de_lave (dropOnly + expeditionExclusive)
app/(tabs)/tree.tsx          # + import ExpeditionsSheet, CampExplorationCell, + état showExpeditions
lib/mascot/world-grid.ts     # + cellule camp_exploration (slot spécial non-building standard)
```

### Pattern 1 : Timer Expédition (calqué sur building-engine.ts)

**What:** Chaque expédition active stocke `startedAt` (ISO string) et `durationHours`. Le résultat est calculé à la lecture, pas à l'écriture — comme `lastCollectAt` + elapsed time dans building-engine.
**When to use:** Dès qu'une expédition est lancée — `startedAt = new Date().toISOString()`.

```typescript
// Source: lib/mascot/building-engine.ts (getPendingResources pattern)
export function isExpeditionComplete(exp: ActiveExpedition, now: Date = new Date()): boolean {
  const startedAt = new Date(exp.startedAt);
  const durationMs = exp.durationHours * 3600 * 1000;
  return now.getTime() - startedAt.getTime() >= durationMs;
}

export function getExpeditionRemainingMinutes(exp: ActiveExpedition, now: Date = new Date()): number {
  const startedAt = new Date(exp.startedAt);
  const durationMs = exp.durationHours * 3600 * 1000;
  const elapsedMs = now.getTime() - startedAt.getTime();
  const remainingMs = durationMs - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 60000));
}
```

### Pattern 2 : Roll résultat pondéré (calqué sur rewards.ts DROP_RATES)

**What:** Table de probabilités par difficulté, même algorithme de tirage aléatoire que les loot boxes.
**When to use:** Quand `isExpeditionComplete()` est true et que l'expédition n'a pas encore de résultat.

```typescript
// Source: lib/gamification/rewards.ts (DROP_RATES pattern)
export type ExpeditionOutcome = 'success' | 'partial' | 'failure' | 'rare_discovery';

export const EXPEDITION_DROP_RATES: Record<ExpeditionDifficulty, Record<ExpeditionOutcome, number>> = {
  easy:   { success: 0.55, partial: 0.30, failure: 0.10, rare_discovery: 0.05 },
  medium: { success: 0.40, partial: 0.30, failure: 0.20, rare_discovery: 0.10 },
  hard:   { success: 0.25, partial: 0.25, failure: 0.30, rare_discovery: 0.20 },
};

export function rollExpeditionResult(
  difficulty: ExpeditionDifficulty,
  pityCount: number,
): ExpeditionOutcome {
  // Pity system: 5 échecs consécutifs → réussite garantie (même seuil que PITY_THRESHOLD)
  if (pityCount >= 5) return 'success';
  const rates = EXPEDITION_DROP_RATES[difficulty];
  const rand = Math.random();
  let cumul = 0;
  for (const [outcome, prob] of Object.entries(rates)) {
    cumul += prob;
    if (rand < cumul) return outcome as ExpeditionOutcome;
  }
  return 'failure';
}
```

### Pattern 3 : Pool rotatif quotidien (seed date-based)

**What:** Algorithme déterministe basé sur la date, garantissant le même pool pour toute la famille.
**When to use:** À chaque ouverture du modal, recalculer le pool du jour depuis la date locale.

```typescript
// Source: Discretion — algorithme simple et éprouvé
export function getDailyExpeditionPool(date: string = new Date().toISOString().slice(0, 10)): ExpeditionMission[] {
  // Seed numérique depuis YYYYMMDD
  const seed = parseInt(date.replace(/-/g, ''), 10);
  const pseudo = (n: number) => ((seed * 1103515245 + n * 12345) & 0x7fffffff) / 0x7fffffff;
  // Sélectionner 1 mission par difficulté depuis EXPEDITION_CATALOG
  const easy = EXPEDITION_CATALOG.filter(m => m.difficulty === 'easy');
  const medium = EXPEDITION_CATALOG.filter(m => m.difficulty === 'medium');
  const hard = EXPEDITION_CATALOG.filter(m => m.difficulty === 'hard');
  return [
    easy[Math.floor(pseudo(1) * easy.length)],
    medium[Math.floor(pseudo(2) * medium.length)],
    hard[Math.floor(pseudo(3) * hard.length)],
  ];
}
```

### Pattern 4 : Sérialisation CSV expéditions actives (calqué sur farm-buildings)

**What:** Les expéditions actives et le pity counter sont persistés dans `farm-{profileId}.md` via deux nouvelles clés. Format pipe-séparé pour le tableau des actives.
**When to use:** Après chaque launch ou collect d'expédition, appeler `serializeFarmProfile()`.

```typescript
// Source: lib/mascot/building-engine.ts serializeBuildings pattern
// Format: expeditionId:difficulty:startedAt:durationHours:resultOutcome
// resultOutcome = '' si pas encore résolu, sinon 'success'|'partial'|'failure'|'rare_discovery'
export function serializeActiveExpeditions(exps: ActiveExpedition[]): string {
  return exps
    .map(e => `${e.missionId}:${e.difficulty}:${e.startedAt}:${e.durationHours}:${e.result ?? ''}`)
    .join('|');
}

export function parseActiveExpeditions(csv: string | undefined): ActiveExpedition[] {
  if (!csv) return [];
  return csv.split('|').map(entry => {
    const parts = entry.trim().split(':');
    if (parts.length < 5) return null;
    const [missionId, difficulty, ...rest] = parts;
    // startedAt est ISO avec ':', reconstruire depuis parts[2..-2]
    const durationHours = parseInt(parts[parts.length - 2], 10);
    const result = parts[parts.length - 1] || undefined;
    const startedAt = parts.slice(2, parts.length - 2).join(':');
    return { missionId, difficulty, startedAt, durationHours, result } as ActiveExpedition;
  }).filter((e): e is ActiveExpedition => e !== null && !!e.missionId);
}
```

**Attention:** Le champ `startedAt` est une ISO date avec des ':'. Le serializer doit prendre en compte que les ':' internes à l'ISO ne sont pas des séparateurs de champs. Utiliser `parts.slice(2, parts.length - 2).join(':')` pour reconstruire la date — exactement comme `building-engine.ts` fait pour `lastCollectAt` (`restParts.join(':')` ligne 68).

### Pattern 5 : Confirmation risque OGame-style

**What:** `Alert.alert()` en français avec deux boutons — annuler / confirmer avec description du risque explicite.
**When to use:** Juste avant de déduire les ressources et de lancer l'expédition.

```typescript
// Source: CLAUDE.md "Erreurs user-facing: Alert.alert() en français"
Alert.alert(
  'Lancer l\'expédition ?',
  `Coût : ${cost.coins} 🍃 + ${costDescription}\n\nEn cas d'échec, toute la mise est perdue.`,
  [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', onPress: handleLaunch, style: 'destructive' },
  ],
);
```

### Pattern 6 : Coffre animé (calqué sur loot box opening)

**What:** Tap sur le coffre déclenche une animation withSpring scale + opacity, haptic Heavy, puis révèle le contenu.
**When to use:** Quand l'expédition est terminée et que l'utilisateur ouvre le résultat.

```typescript
// Source: CLAUDE.md "useSharedValue + useAnimatedStyle + withSpring"
const chestScale = useSharedValue(1);
const contentOpacity = useSharedValue(0);

const handleOpenChest = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  chestScale.value = withSpring(0.8, SPRING_CONFIG, () => {
    chestScale.value = withSpring(1.2, SPRING_CONFIG, () => {
      chestScale.value = withSpring(1, SPRING_CONFIG);
      contentOpacity.value = withTiming(1, { duration: 400 });
      runOnJS(markExpeditionCollected)(expeditionId);
    });
  });
};
```

### Anti-Patterns à Éviter

- **Stocker le résultat au moment du lancement :** Le résultat doit être calculé à la *collecte*, pas au lancement. Permet la cohérence avec D-06 (effet surprise) et le pity system qui doit tenir compte des états au moment de la résolution.
- **ISO date split naïf :** Ne pas faire `csv.split(':')` à plat pour parser le startedAt — l'ISO contient des ':'. Toujours utiliser le pattern de building-engine (reconstruire via `join`).
- **Mutation directe FarmProfileData :** Toujours lire le fichier vault, appliquer la mutation, réécrire — même pattern que `useFarm.ts` (readFile → modify → writeFile).
- **Append en fin de fichier :** Ne jamais appender au fichier farm-{id}.md. Toujours réécrire complètement via `serializeFarmProfile()`.
- **Max 2 expéditions non vérifiées :** Vérifier `activeExpeditions.length < MAX_EXPEDITIONS` avant de lancer. Afficher un message si la limite est atteinte.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted random | Switch + rand | Même algo que rewards.ts DROP_RATES | Déjà testé, pattern connu |
| Timer display | setInterval React | getExpeditionRemainingMinutes() + AppState focus | Cohérent avec building-engine, pas de leak |
| Pity tracking | Compteur custom | Même pattern PITY_THRESHOLD de rewards.ts | Déjà documenté dans XP_BUDGET |
| Seed date-based | Random pur | LCG simple avec seed numérique date | Déterministe, même résultat pour toute la famille |
| Markdown persistence | Nouveau format | Deux clés CSV dans farm-{id}.md via parseFarmProfile/serializeFarmProfile | Infrastructure existante, pas de nouveau fichier |
| Spring animations | RN Animated | react-native-reanimated (CLAUDE.md obligatoire) | Worklet thread, performances |
| Haptic feedback | Custom vibration | expo-haptics (Haptics.impactAsync) | Patron établi, pas de permission |

**Key insight:** Toute la complexité algorithmique de ce système existe déjà dans building-engine.ts (timers) et rewards.ts (probabilités). L'expédition est un assemblage de ces deux patterns, pas un nouveau problème.

---

## Modèle de données : Nouveaux types

### ActiveExpedition

```typescript
// À ajouter dans lib/types.ts
export interface ActiveExpedition {
  missionId: string;           // ID mission du catalogue (ex: 'foret_facile')
  difficulty: ExpeditionDifficulty;
  startedAt: string;           // ISO string (même format que lastCollectAt)
  durationHours: number;       // 4 | 12 | 24
  result?: ExpeditionOutcome;  // undefined = pas encore collecté, string = déjà ouvert
  lootItemId?: string;         // ID de l'item obtenu (si result = success | rare_discovery)
  lootType?: 'inhabitant' | 'seed' | 'booster'; // type de récompense
}

export type ExpeditionDifficulty = 'easy' | 'medium' | 'hard';
export type ExpeditionOutcome = 'success' | 'partial' | 'failure' | 'rare_discovery';
```

### Champs à ajouter dans FarmProfileData (lib/types.ts)

```typescript
// Phase 33 — Expéditions
activeExpeditions?: string;   // CSV pipe-séparé (format serializeActiveExpeditions)
expeditionPity?: number;      // compteur d'échecs consécutifs (pity system)
```

### Champs à ajouter dans parseFarmProfile / serializeFarmProfile (lib/parser.ts)

```typescript
// parseFarmProfile : ajouter dans le return
activeExpeditions: parseActiveExpeditions(props.active_expeditions),
expeditionPity: props.expedition_pity ? parseInt(props.expedition_pity, 10) : 0,

// serializeFarmProfile : ajouter
if (data.activeExpeditions && data.activeExpeditions.length > 0) {
  lines.push(`active_expeditions: ${serializeActiveExpeditions(data.activeExpeditions)}`);
}
if (data.expeditionPity && data.expeditionPity > 0) {
  lines.push(`expedition_pity: ${data.expeditionPity}`);
}
```

---

## Catalogue EXPEDITION_CATALOG (discretion)

Recommandation pour les 9+ missions (3 par difficulté, rotation enrichie) :

| ID | Difficulté | Destination | Durée | Coût feuilles | Coût récolte |
|----|-----------|-------------|-------|---------------|-------------|
| `foret_facile` | easy | Forêt Enchantée | 4h | 50 🍃 | 2x carrot |
| `riviere_facile` | easy | Rivière Bleue | 4h | 40 🍃 | 2x wheat |
| `prairie_facile` | easy | Prairie Fleurie | 4h | 45 🍃 | 2x beetroot |
| `montagne_moyen` | medium | Montagne Cristal | 12h | 150 🍃 | 3x tomato |
| `ocean_moyen` | medium | Océan Profond | 12h | 120 🍃 | 3x cabbage |
| `caverne_moyen` | medium | Caverne Dorée | 12h | 140 🍃 | 2x oeuf + 1x lait |
| `volcan_dur` | hard | Volcan Ardent | 24h | 400 🍃 | 5x corn |
| `toundra_dur` | hard | Toundra Glacée | 24h | 350 🍃 | 4x pumpkin |
| `nuages_dur` | hard | Archipel des Nuages | 24h | 380 🍃 | 3x strawberry + 2x miel |

**Scaling économique :** les coûts en feuilles doivent rester significatifs même pour des joueurs avancés. Calibrer à 2-4 heures de production passive pour la difficulté facile, 6-8h pour moyen, 12-16h pour dur.

---

## Récompenses exclusives (discretion)

### Nouveaux habitants expedition-exclusive

Ajouter `expeditionExclusive: true` et `sagaExclusive: false` (ou un nouveau flag) dans `INHABITANTS` (lib/mascot/types.ts) :

| ID | Label | Rareté | Obtenu via |
|----|-------|--------|-----------|
| `renard_arctique` | Renard Arctique | rare | Réussite easy/medium |
| `aigle_doré` | Aigle Doré | épique | Réussite hard |
| `lynx_mystere` | Lynx Mystère | rare_discovery | Découverte rare (any) |
| `dragon_glace` | Dragon de Glace | rare_discovery | Découverte rare (hard only) |

### Nouvelles graines expedition-exclusive

Ajouter dans `CROP_CATALOG` (lib/mascot/types.ts) avec `dropOnly: true` + nouveau flag `expeditionExclusive: true` :

| ID | Label | Durée (stades) | Reward | Obtenu via |
|----|-------|----------------|--------|-----------|
| `fleur_lave` | Fleur de Lave | 4 stades × 3 tâches | 600 🍃 | Réussite hard |
| `cristal_noir` | Cristal Noir | 5 stades × 3 tâches | 900 🍃 | Découverte rare |

### Boosters temporaires

Réutiliser les champs `buildingTurboUntil`, `growthSprintUntil`, `capacityBoostUntil` de Phase 20 :
- Réussite easy → `growthSprintUntil` +6h (x2 vitesse pousse)
- Réussite medium → `buildingTurboUntil` +12h (x2 production bâtiments)
- Réussite hard → `capacityBoostUntil` +24h (capacité bâtiments +1)
- Partielle → petit bonus feuilles (10-30% du coût récupéré)

---

## Intégration grille ferme : Camp d'exploration

### Option A : Cellule spéciale dans world-grid.ts (recommandée)

Ajouter une cellule de type `'expedition'` dans `WORLD_GRID` — pas dans `BUILDING_CELLS` standard pour éviter que le BuildingShopSheet ne la traite comme un bâtiment ordinaire. Position recommandée : bas-gauche, au-dessus des décos, visible en permanence.

```typescript
// lib/mascot/world-grid.ts
export const CAMP_EXPLORATION_CELL: WorldCell = {
  id: 'camp_exp', col: 0, row: 5, x: 0.08, y: 0.70, cellType: 'any', unlockOrder: 0, size: 'large'
};
```

Dans `tree.tsx`, rendre la cellule séparément des `BUILDING_CELLS` avec le composant `CampExplorationCell` — pas via `WorldGridView`.

### CampExplorationCell : Badge + Countdown

Badge numérique (1 ou 2) : pattern SecureStore existant dans `BuildingsCatalog.tsx` (SEEN_KEY) adapté pour compter les expéditions actives.

Mini countdown : afficher "3h 24m" sous l'icône tant que des expéditions sont en cours. Calculé via `getExpeditionRemainingMinutes()` (la plus courte des deux).

```typescript
// CampExplorationCell.tsx
const activeCount = activeExpeditions.filter(e => !e.result).length;
const completedCount = activeExpeditions.filter(e => isExpeditionComplete(e) && !isCollected(e)).length;
// Badge rouge si résultats à collecter, badge bleu si en cours
```

---

## Common Pitfalls

### Pitfall 1 : Reconstruction de l'ISO date depuis CSV
**What goes wrong:** Splitter sur ':' à plat coupe l'ISO string (`2026-04-14T10:30:00.000Z` → 6 segments).
**Why it happens:** L'ISO 8601 utilise ':' comme séparateur d'heure.
**How to avoid:** Utiliser exactement le même pattern que building-engine.ts ligne 68 : `restParts.join(':')`. Tester avec une date qui contient des ':'.
**Warning signs:** Timer affiché négatif ou NaN.

### Pitfall 2 : Roll au lancement au lieu de la collecte
**What goes wrong:** Le résultat est tiré au moment du lancement, stocké, et le pity system ne peut pas prendre en compte les expéditions intermédiaires.
**Why it happens:** Semblait plus simple à implémenter.
**How to avoid:** Ne jamais stocker le résultat dans ActiveExpedition.result avant que `isExpeditionComplete()` soit true. Le roll se fait dans `collectExpedition()`.
**Warning signs:** Le pity system ne se déclenche jamais, ou se déclenche trop tôt.

### Pitfall 3 : Append en fin de farm-{id}.md
**What goes wrong:** Si on append `active_expeditions:` à la fin du fichier sans réécrire, `parseFarmProfile()` peut parser deux fois la même clé (la première instance gagne).
**Why it happens:** Semblait plus rapide qu'une réécriture complète.
**How to avoid:** Toujours écrire via `serializeFarmProfile()` qui reconstruit entièrement le fichier. Pattern confirmé Phase 30.

### Pitfall 4 : Coûts trop faibles = sink nul
**What goes wrong:** Si les coûts sont trop bas, le système ne draine pas l'économie et perd son intérêt après quelques semaines.
**Why it happens:** Sous-estimation de l'accumulation de feuilles sur un mois de jeu.
**How to avoid:** Calibrer le coût facile à ~50-80 feuilles (2-3 récoltes de carotte), le dur à ~350-450 feuilles (2-3 récoltes de maïs/potiron). Tester sur un profil avec 1000+ feuilles accumulées.
**Warning signs:** Les utilisateurs lancent toutes les expéditions sans hésitation — le risque ne semble pas réel.

### Pitfall 5 : Mauvaise résolution du compteur pity
**What goes wrong:** Le pity counter s'incrémente à chaque expédition échouée mais jamais pour partielle ou succès, ou ne se remet pas à zéro après réussite.
**Why it happens:** Ambiguité sur la définition d'"échec" pour le pity system.
**How to avoid:** Incrémenter `expeditionPity` uniquement sur `failure`. Remettre à 0 sur `success` et `rare_discovery`. Pour `partial`, incrémenter de 0.5 (arrondi à l'int, ou garder un float). Pattern aligné sur PITY_THRESHOLD = 5 de rewards.ts.

### Pitfall 6 : Limite 2 expéditions non gérée dans l'UI
**What goes wrong:** L'utilisateur peut lancer une 3e expédition si la vérification se fait uniquement au niveau du engine sans feedback UI.
**Why it happens:** La vérification engine retourne une erreur sans message visible.
**How to avoid:** Vérifier `activeExpeditions.length >= MAX_EXPEDITIONS` (2) dans le handler du bouton "Lancer" et afficher un message explicite ("2 expéditions en cours maximum").

---

## Code Examples

### Déduction du coût (double sink)

```typescript
// Source: hooks/useFarm.ts pattern (readFile → modify → writeFile)
export async function launchExpedition(
  profileId: string,
  mission: ExpeditionMission,
  farmData: FarmProfileData,
  profileCoins: number,
): Promise<{ success: false; reason: string } | { success: true; updatedFarm: FarmProfileData }> {
  // Vérifier limit
  const activeCount = (farmData.activeExpeditions ?? []).filter(e => !isExpeditionComplete(e)).length;
  if (activeCount >= MAX_ACTIVE_EXPEDITIONS) {
    return { success: false, reason: 'limit_reached' };
  }
  // Vérifier coûts
  if (profileCoins < mission.costCoins) return { success: false, reason: 'insufficient_coins' };
  for (const crop of mission.costCrops) {
    const stock = farmData.harvestInventory?.[crop.cropId] ?? 0;
    if (stock < crop.quantity) return { success: false, reason: 'insufficient_crops' };
  }
  // Déduire
  const updatedFarm = { ...farmData };
  // coins → déduits via updateCoins() dans useVault (pas modifié dans farm-{id}.md directement)
  const updatedHarvest = { ...(farmData.harvestInventory ?? {}) };
  for (const crop of mission.costCrops) {
    updatedHarvest[crop.cropId] = (updatedHarvest[crop.cropId] ?? 0) - crop.quantity;
  }
  updatedFarm.harvestInventory = updatedHarvest;
  // Ajouter expédition active
  const newExp: ActiveExpedition = {
    missionId: mission.id,
    difficulty: mission.difficulty,
    startedAt: new Date().toISOString(),
    durationHours: mission.durationHours,
  };
  updatedFarm.activeExpeditions = [...(farmData.activeExpeditions ?? []), newExp];
  return { success: true, updatedFarm };
}
```

### Collecte d'une expédition terminée

```typescript
// Source: building-engine.ts collectBuilding pattern
export function collectExpedition(
  farmData: FarmProfileData,
  missionId: string,
  pityCount: number,
): { updatedFarm: FarmProfileData; outcome: ExpeditionOutcome; loot?: ExpeditionLoot } {
  const exps = farmData.activeExpeditions ?? [];
  const exp = exps.find(e => e.missionId === missionId && isExpeditionComplete(e) && !e.result);
  if (!exp) return { updatedFarm: farmData, outcome: 'failure' };

  const outcome = rollExpeditionResult(exp.difficulty, pityCount);
  const loot = outcome !== 'failure' ? rollExpeditionLoot(exp.difficulty, outcome) : undefined;

  const updatedExps = exps.map(e =>
    e === exp ? { ...e, result: outcome, lootItemId: loot?.itemId, lootType: loot?.type } : e
  );

  return {
    updatedFarm: { ...farmData, activeExpeditions: updatedExps },
    outcome,
    loot,
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Swipeable (RNGH) | ReanimatedSwipeable | Phase 05 | Éviter conflit ScrollView |
| RN Animated | react-native-reanimated | CLAUDE.md global | Worklet thread requis |
| Résultats timer serveur | Lazy calculation à focus | building-engine Phase 06 | Pas de push, pas de backend |

**Patterns établis projet:**
- `lastCollectAt` ISO + elapsed time : timer bâtiments (building-engine.ts Phase 06)
- PITY_THRESHOLD=5 : garantie épique+ loot boxes (rewards.ts)
- Pipe `|` séparateur arrays dans farm CSV : buildings, crafted items
- `serializeFarmProfile` réécriture complète : jamais d'append (Phase 30 décision)

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure code/config changes, no external tools needed)

---

## Open Questions

1. **Position exacte du Camp d'exploration dans la grille**
   - Ce qu'on sait: 3 cellules bâtiment (b0-b2) + 1 extension tech (b3). Camp d'exploration doit être distinct des bâtiments productifs.
   - Ce qui est flou: Faut-il le placer comme cellule `'any'` dans un coin dédié, ou comme 4e bâtiment logique (b4) ?
   - Recommendation: Cellule spéciale `camp_exp` type `'any'` hors BUILDING_CELLS, position x:0.10 y:0.90 (bas-gauche, sous les décos). Rend dans tree.tsx séparément des autres buildings.

2. **Déduction des feuilles lors du lancement**
   - Ce qu'on sait: `coins` est dans `gami-{profileId}.md` (gamification data), pas dans `farm-{profileId}.md`.
   - Ce qui est flou: Le hook `useExpeditions` doit-il écrire les deux fichiers (farm + gami) en séquence ?
   - Recommendation: Oui. Pattern établi dans `useFarm.ts` qui écrit farm-{id}.md puis gami-{id}.md séparément. Utiliser le même pattern avec deux `writeFile` séquentiels, ou appeler `addCoins(-cost)` via le hook vault existant.

3. **Items exclusifs : nouveau flag dans INHABITANTS ou fichier séparé ?**
   - Ce qu'on sait: `sagaExclusive: true` existe déjà sur certains habitants.
   - Ce qui est flou: Utiliser le même flag `sagaExclusive` pour les exclusifs expédition risque la confusion sémantique.
   - Recommendation: Ajouter `expeditionExclusive?: boolean` dans `MascotInhabitant` et `CropDefinition`. Cela permet de filtrer les items hors boutique sans ambiguïté.

---

## Sources

### Primary (HIGH confidence)
- Code source `lib/mascot/building-engine.ts` — pattern timer lastCollectAt, elapsed time, parse ISO avec ':' dans join
- Code source `lib/gamification/rewards.ts` — DROP_RATES, PITY_THRESHOLD=5, structure table pondérée
- Code source `lib/mascot/types.ts` — FarmInventory, PlacedBuilding, CropDefinition, MascotInhabitant, sagaExclusive flag, BUILDING_CATALOG
- Code source `lib/parser.ts` — parseFarmProfile, serializeFarmProfile, format key:value, patterns existants
- Code source `lib/types.ts` — FarmProfileData interface complète, champs CSV existants
- Code source `lib/mascot/world-grid.ts` — WORLD_GRID, BUILDING_CELLS, CellType, structure WorldCell
- Code source `app/(tabs)/tree.tsx` — point d'entrée UI, gestion modales, intégration hooks
- Code source `components/village/BuildingsCatalog.tsx` — pattern pageSheet, spring SPRING_CATALOG, SecureStore badge lifecycle
- CONTEXT.md phase 33 — toutes les décisions verrouillées

### Secondary (MEDIUM confidence)
- STATE.md décisions accumulées — pattern sérialisation CSV, append-only rules, séparateurs
- CLAUDE.md — conventions techniques obligatoires (Reanimated, useThemeColors, Alert.alert français)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tout réutilise des libs déjà en production dans le projet
- Architecture: HIGH — directement calqué sur building-engine.ts et rewards.ts avec code source vérifié
- Pitfalls: HIGH — identifiés depuis l'analyse du code source réel (ISO split, append, pity)
- Discretion items (coûts, catalogue): MEDIUM — valeurs proposées à valider par le joueur/testeur

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stack stable, Expo SDK 54)
