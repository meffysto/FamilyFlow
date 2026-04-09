# Phase 20: Moteur d'effets + anti-abus — Research

**Researched:** 2026-04-09
**Domain:** Semantic effect dispatcher, SecureStore caps, farm engine wiring (wear/farm/buildings/companion/saga/craft)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md found for Phase 20 — constraints derived from REQUIREMENTS.md, CLAUDE.md, and STATE.md accumulated decisions.

### Locked Decisions (from CLAUDE.md + STATE.md)

- Stack: React Native 0.81.5 + Expo SDK 54 — pas de migration majeure
- Persistance temporelle: expo-secure-store (déjà utilisé pour le flag SEMANTIC-05 et giftsSentToday anti-abus)
- ARCH-04: zéro nouvelle dépendance npm sur le milestone v1.3
- ARCH-01: les fichiers tâches Obsidian ne sont JAMAIS écrits
- ARCH-02: le feature flag (`semantic-coupling-enabled`) doit désactiver instantanément tout effet
- ARCH-03: zéro régression quand catégorie inconnue (standard XP, applyTaskEffect = no-op)
- Animations: react-native-reanimated obligatoire (pas RN Animated) — mais Phase 20 est pure logique métier, pas d'UI
- Couleurs: `useThemeColors()` uniquement (pas de hardcoded) — Phase 20 est backend logic, pas de composants
- Format date affiché: JJ/MM/AAAA

### Claude's Discretion

- Nommage des clés SecureStore caps (suggestion roadmap: `coupling-caps-{profileId}`)
- Structure interne du dispatcher `applyTaskEffect()` (interface EffectResult)
- Stratégie de persistance des bonus temporels (ISO timestamp dans FarmProfileData ou champ dédié)
- Ordre d'injection dans `completeTask` (avant ou après `advanceFarmCrops`)

### Deferred Ideas (OUT OF SCOPE)

- Phase 21: feedback visuel (toasts, haptic, HarvestBurst) — hors scope Phase 20
- Phase 22: UI config famille (toggles catégories) — hors scope
- Phase 23: Musée des effets — hors scope
- Effets négatifs / malus — explicitement exclus des requirements
- Catégories custom utilisateur — hors scope (10 hardcodées)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEMANTIC-06 | Les 10 catégories sont mappées 1:1 à un effet wow | Mapping `CategoryId → EffectId` dans `lib/semantic/categories.ts` — l'ordre EFFECTS-01..10 est déjà aligné avec l'ordre des `CategoryId` |
| SEMANTIC-07 | User ne peut pas dépasser le cap daily/weekly d'un effet | Caps persistés dans SecureStore `coupling-caps-{profileId}` — pattern identique `giftsSentToday` |
| SEMANTIC-08 | Tâche `#urgent` → ×2 multiplier sur 5 tâches suivantes | `profile.multiplier` + `profile.multiplierRemaining` déjà existants dans `Profile` + `addPoints()` |
| SEMANTIC-09 | Streak >7j → Double Loot Cascade | `calculateStreak()` disponible, pattern `extraLootBoxes` déjà dans `doOpenLootBox` |
| EFFECTS-01 | Ménage quotidien → retire un weeds de la ferme | `repairWearEvent()` / mutation directe `wearEvents[]` dans FarmProfileData |
| EFFECTS-02 | Ménage hebdo/saisonnier → répare gratuitement un wear event | `repairWearEvent()` avec `cost=0` forcé (bypass paiement) |
| EFFECTS-03 | Courses → turbo production bâtiments 24h | Nouveau champ temporel dans FarmProfileData (`buildingTurboUntil: string ISO`) |
| EFFECTS-04 | Routines enfants → companion mood spike + message IA | `computeMoodScore()` override via `generateCompanionAIMessage('task_completed', ...)` |
| EFFECTS-05 | Devoirs → Growth Sprint 24h (tasksPerStage -1) | Nouveau champ `growthSprintUntil: string ISO` dans FarmProfileData |
| EFFECTS-06 | Rendez-vous médical → rare seed drop garanti | `RARE_SEED_DROP_RULES` bypass (drop forcé), `farmRareSeeds` dans FarmProfileData |
| EFFECTS-07 | Gratitude/anniversaire → saga trait boost | `SagaProgress.traits` dans sagas-storage + `completeSagaChapter` pattern |
| EFFECTS-08 | Budget/admin → Building Capacity Boost 24h (×2) | Nouveau champ `capacityBoostUntil: string ISO` dans FarmProfileData |
| EFFECTS-09 | Soins bébé → prochaine récolte golden ×3 | Nouveau flag `nextHarvestGolden: boolean` dans FarmProfileData |
| EFFECTS-10 | Cuisine/repas → craft recipe rare unlock (hebdo) | `craftedItems` / déblocage d'une `CraftRecipe` rare dans CRAFT_RECIPES |
</phase_requirements>

---

## Summary

Phase 20 doit câbler un dispatcher `applyTaskEffect()` qui reçoit une `CategoryMatch` (produite par Phase 19's `deriveTaskCategory()`) et applique un effet spécifique sur les moteurs existants de la ferme. La logique est entièrement en TypeScript pur — aucun nouveau composant UI n'est créé (Phase 21 gère le feedback visuel).

L'injection se fait dans `useGamification.completeTask()`, après le bloc `advanceFarmCrops`, en appelant `applyTaskEffect()` uniquement si `isSemanticCouplingEnabled()` retourne `true`. Le dispatcher retourne un `EffectResult` décrivant ce qui s'est passé (utilisé plus tard par Phase 21 pour les toasts).

L'anti-abus repose sur des caps daily/weekly persistés dans SecureStore avec la clé `coupling-caps-{profileId}`. La structure est un objet JSON sérialisé contenant, pour chaque `CategoryId`, un compteur journalier et un compteur hebdomadaire avec leur timestamp de début de période. Le pattern est identique à `giftsSentToday` déjà en production.

Les 10 effets opèrent sur des champs déjà existants dans `FarmProfileData` (wearEvents, farmBuildings, farmCrops, companion, farmRareSeeds, craftedItems) plus 4 nouveaux champs temporels à ajouter (`buildingTurboUntil`, `growthSprintUntil`, `capacityBoostUntil`, `nextHarvestGolden`). Ces champs sont persistés dans `farm-{profileId}.md` via les fonctions `parseFarmProfile`/`serializeFarmProfile` existantes.

**Primary recommendation:** Créer `lib/semantic/effects.ts` (dispatcher pur + 10 handlers) + `lib/semantic/caps.ts` (SecureStore caps), les injecter dans `useGamification.completeTask()`, et étendre `FarmProfileData` + parseur.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-secure-store | ~14.x (SDK 54) | Caps anti-abus daily/weekly | Déjà utilisé pour flag sémantique + ParentalControls — pattern établi |
| lib/mascot/wear-engine | interne | Retrait weeds (EFFECTS-01) + réparation gratuite (EFFECTS-02) | `repairWearEvent()`, `getActiveWearEffects()` — fonctions pures, déjà disponibles |
| lib/mascot/farm-engine | interne | Growth Sprint, golden harvest, rare seed | `advanceFarmCrops()`, `rollSeedDrop()` — fonctions pures disponibles |
| lib/mascot/building-engine | interne | Turbo production (EFFECTS-03), capacity boost (EFFECTS-08) | `getPendingResources()` lit `questSpeedMultiplier` et `techBonuses.buildingCapacityMultiplier` |
| lib/mascot/companion-engine | interne | Mood spike (EFFECTS-04) | `computeMoodScore()`, `generateCompanionAIMessage()` |
| lib/mascot/sagas-engine | interne | Trait boost (EFFECTS-07) | `getDominantTrait()`, progression via sagas-storage |
| lib/mascot/craft-engine | interne | Recipe rare unlock (EFFECTS-10) | `CRAFT_RECIPES` array, pattern `craftedItems` |
| lib/semantic/derive | interne (Phase 19) | Détection catégorie | `deriveTaskCategory()` → `CategoryMatch | null` |
| lib/semantic/flag | interne (Phase 19) | Feature flag on/off | `isSemanticCouplingEnabled()` async |

### Aucune dépendance externe requise

ARCH-04 confirmé : zéro nouvelle dépendance npm. Tous les leviers sont déjà dans le codebase.

---

## Architecture Patterns

### Structure de fichiers recommandée

```
lib/semantic/
├── categories.ts        # Phase 19 — intact
├── derive.ts            # Phase 19 — intact
├── flag.ts              # Phase 19 — intact
├── index.ts             # Phase 19 — à étendre avec exports Phase 20
├── effects.ts           # NOUVEAU — dispatcher applyTaskEffect() + 10 handlers
└── caps.ts              # NOUVEAU — SecureStore caps daily/weekly
```

### Pattern 1: Dispatcher `applyTaskEffect()`

**What:** Fonction async pure — reçoit `CategoryMatch + FarmProfileData + profile + caps` et retourne `{ farmData: FarmProfileData, effectApplied: EffectId | null, reason?: string }`.

**When to use:** Appelé par `useGamification.completeTask()` après `advanceFarmCrops`.

```typescript
// lib/semantic/effects.ts
export type EffectId =
  | 'weeds_removed'        // EFFECTS-01
  | 'wear_repaired'        // EFFECTS-02
  | 'building_turbo'       // EFFECTS-03
  | 'companion_mood'       // EFFECTS-04
  | 'growth_sprint'        // EFFECTS-05
  | 'rare_seed_drop'       // EFFECTS-06
  | 'saga_trait_boost'     // EFFECTS-07
  | 'capacity_boost'       // EFFECTS-08
  | 'golden_harvest'       // EFFECTS-09
  | 'recipe_unlock';       // EFFECTS-10

export interface EffectResult {
  effectApplied: EffectId | null;
  farmData: FarmProfileData;          // mutable — farm-{id}.md à réécrire
  sagaTraitDelta?: { trait: SagaTrait; amount: number }; // EFFECTS-07
  companionEvent?: CompanionEvent;    // EFFECTS-04
  message?: string;                   // pour Phase 21 toasts (evidence brute)
}

export async function applyTaskEffect(
  match: CategoryMatch,
  farmData: FarmProfileData,
  profile: Profile,
  caps: CouplingCaps,
  now?: Date,
): Promise<EffectResult>
```

### Pattern 2: Caps SecureStore

**What:** Objet JSON persisté dans SecureStore, clé `coupling-caps-{profileId}`.

**Sérialisation:** JSON.stringify/parse — simple, déjà utilisé pour ParentalControls PIN.

```typescript
// lib/semantic/caps.ts
export interface EffectCap {
  daily: number;    // compteur jour courant
  weekly: number;   // compteur semaine courante
  dayStart: string; // YYYY-MM-DD — reset daily si différent de today
  weekStart: string; // YYYY-MM-DD (lundi) — reset weekly si différent de thisWeek
}

export type CouplingCaps = Partial<Record<CategoryId, EffectCap>>;

// Limites (à définir dans caps.ts)
export const DAILY_CAPS: Record<CategoryId, number> = {
  menage_quotidien: 1,    // max 1 weeds retiré / jour
  menage_hebdo: 1,        // max 1 réparation gratuite / jour
  courses: 1,             // max 1 turbo / jour
  enfants_routines: 2,    // max 2 mood spikes / jour
  enfants_devoirs: 1,     // max 1 growth sprint / jour
  rendez_vous: 1,         // max 1 rare seed / jour
  gratitude_famille: 2,   // max 2 trait boosts / jour
  budget_admin: 1,        // max 1 capacity boost / jour
  bebe_soins: 1,          // max 1 golden harvest / jour
  cuisine_repas: 0,       // 0 = pas de cap daily (cap hebdo uniquement)
};

export const WEEKLY_CAPS: Record<CategoryId, number> = {
  menage_quotidien: 5,
  menage_hebdo: 3,
  courses: 3,
  enfants_routines: 10,
  enfants_devoirs: 5,
  rendez_vous: 3,
  gratitude_famille: 7,
  budget_admin: 3,
  bebe_soins: 5,
  cuisine_repas: 1,       // EFFECTS-10 : 1 recipe unlock / semaine
};
```

### Pattern 3: Injection dans `completeTask`

**Point d'injection:** `hooks/useGamification.ts`, après le bloc `advanceFarmCrops` (ligne ~141), avant `dispatchNotificationAsync`.

```typescript
// Dans useGamification.completeTask — APRÈS advanceFarmCrops
let effectResult: EffectResult | null = null;
const enabled = await isSemanticCouplingEnabled();
if (enabled) {
  const category = deriveTaskCategory(taskAsTask); // task text → Task shape
  if (category) {
    const caps = await loadCaps(profile.id);
    if (!isCapExceeded(category.id, caps)) {
      const fp = farmFile(profile.id);
      const farmContent = await vault.readFile(fp).catch(() => '');
      const farmData = parseFarmProfile(farmContent);
      effectResult = await applyTaskEffect(category, farmData, profile, caps);
      if (effectResult.effectApplied) {
        await vault.writeFile(fp, serializeFarmProfile(profile.name, effectResult.farmData));
        await saveCaps(profile.id, incrementCap(caps, category.id));
      }
    }
  }
}
```

**Note critique:** `completeTask` dans `useGamification` ne reçoit que `taskText: string` (pas l'objet `Task` complet). Phase 20 devra soit (a) enrichir la signature pour accepter un objet `Task` partiel, soit (b) construire un `Task` minimal depuis la vue appelante. L'approche (a) est préférable — signature rétrocompatible avec `taskText` comme champ `text` du Task.

### Pattern 4: Bonus temporels dans FarmProfileData

**What:** 4 nouveaux champs ISO datetime dans `FarmProfileData` + `FarmProfile` type, persistés dans `farm-{id}.md`.

```typescript
// Ajout à lib/types.ts FarmProfileData
buildingTurboUntil?: string;  // ISO — EFFECTS-03 : productionRateHours * 0.5 jusqu'à cette date
growthSprintUntil?: string;   // ISO — EFFECTS-05 : tasksPerStageReduction +1 supplémentaire
capacityBoostUntil?: string;  // ISO — EFFECTS-08 : buildingCapacityMultiplier * 2
nextHarvestGolden?: boolean;  // EFFECTS-09 : force isGolden=true sur la prochaine récolte

// parseFarmProfile lit ces champs :
buildingTurboUntil: props.building_turbo_until || undefined,
growthSprintUntil:  props.growth_sprint_until  || undefined,
capacityBoostUntil: props.capacity_boost_until || undefined,
nextHarvestGolden:  props.next_harvest_golden === 'true',

// serializeFarmProfile écrit ces champs :
if (data.buildingTurboUntil) lines.push(`building_turbo_until: ${data.buildingTurboUntil}`);
if (data.growthSprintUntil)  lines.push(`growth_sprint_until: ${data.growthSprintUntil}`);
if (data.capacityBoostUntil) lines.push(`capacity_boost_until: ${data.capacityBoostUntil}`);
if (data.nextHarvestGolden)  lines.push(`next_harvest_golden: true`);
```

**Consommation des bonus temporels:** Le hook `useFarm` doit vérifier ces champs à chaque appel de `getPendingResources()` et `advanceFarmCrops()`. Ce n'est pas une mutation de `TechBonuses` — les bonus temporels sont passés en argument séparé ou composés avec `getTechBonuses()`.

### Pattern 5: Multiplier urgent (SEMANTIC-08)

**What:** Tâche avec tag `#urgent` → active `profile.multiplier = 2` + `profile.multiplierRemaining = 5`.

**Mécanisme déjà existant:** `profile.multiplierRemaining` et `profile.multiplier` sont dans `Profile` et consommés par `addPoints()`. Il suffit de détecter `#urgent` dans `deriveTaskCategory` (categoryId = aucune, mais le tag `urgent` est dans les `tagPatterns` si on l'ajoute), ou de détecter séparément dans `applyTaskEffect`.

**Approche recommandée:** Détecter `#urgent` dans `applyTaskEffect` avant le switch sur `CategoryId`, en parallèle de la catégorie. Si `task.tags` contient `urgent`, forcer `profile.multiplier = 2; profile.multiplierRemaining = 5` via `writeFile gami-{id}.md`. Ce n'est PAS un effet sémantique de catégorie — c'est un modificateur cross-catégorie.

```typescript
// Dans applyTaskEffect OU dans completeTask (avant l'effet catégorie)
if (task.tags?.includes('urgent') && profile.multiplierRemaining === 0) {
  // Activer le multiplier ×2 sur 5 tâches — écrit dans gami-{profileId}.md
  updatedProfile = { ...profile, multiplier: 2, multiplierRemaining: 5 };
}
```

### Pattern 6: Double Loot Cascade streak (SEMANTIC-09)

**What:** Streak > 7j → ouvre automatiquement un loot box supplémentaire.

**Mécanisme déjà existant:** `doOpenLootBox()` retourne `extraLootBoxes` pour cascades. La détection du streak est dans `calculateStreak()`.

**Implémentation:** Dans `completeTask`, après `awardTaskCompletion`, si `currentStreak + 1 > 7` (multiple de 7 ou simple >7?) et que `lootAwarded`, déclencher un second `doOpenLootBox`. Selon SEMANTIC-09 : streak **>7j** — donc seuil fixe à 7, pas multiple.

```typescript
// Après awardTaskCompletion dans completeTask
if ((currentStreak + 1) > 7 && lootAwarded) {
  // Double Loot Cascade — ouvrir un second loot box immédiatement
  const cascadeResult = doOpenLootBox(updatedProfile, newData);
  // Fusionner dans newData
}
```

### Anti-Patterns à éviter

- **Écrire dans les fichiers tâche Obsidian:** ARCH-01 — jamais.
- **Charger farm-{id}.md dans chaque handler d'effet séparément:** Lire le fichier une seule fois avant le switch, le passer en argument à chaque handler.
- **Mutation directe d'un `TechBonuses` existant pour les bonus temporels:** Créer un `EffectiveTechBonuses` composé à la lecture, ne pas altérer le `TechBonuses` calculé par `getTechBonuses()`.
- **Utiliser `Math.random()` pour le rare seed dans EFFECTS-06:** EFFECTS-06 requiert un drop **garanti** — bypasser `rollSeedDrop()` et ajouter directement dans `farmRareSeeds`.
- **Appeler `isSemanticCouplingEnabled()` en dehors d'un try/catch:** SecureStore peut échouer — ARCH-03 exige fallback silencieux.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compteur anti-abus | Custom DB en mémoire | SecureStore JSON + date check | Déjà utilisé pour `giftsSentToday` — pattern éprouvé, résiste aux redémarrages |
| Retrait weeds | Nouvelle logique mutation | `repairWearEvent()` + filtrage sur `type='weeds'` | API existante dans wear-engine.ts |
| Réparation gratuite | Override coût repair | `repairWearEvent()` avec `currentCoins=Infinity` OU mutation directe `repairedAt` | 1 ligne de code |
| Turbo production | Nouveau paramètre buildingEngine | Champ `buildingTurboUntil` ISO + check dans `getPendingResources()` | Le param `questSpeedMultiplier` existe déjà |
| Détection streak | Re-calculer streak | `calculateStreak()` déjà dans lib/gamification/engine.ts | Déjà appelé dans `completeTask` |
| Multiplier urgent | Nouveau système reward | `profile.multiplier` + `profile.multiplierRemaining` déjà dans Profile | `addPoints()` les consomme automatiquement |

---

## Mapping des 10 effets — Détail d'implémentation

### EFFECTS-01: Ménage quotidien → Weeds removed

**Levier:** `wearEvents` dans `FarmProfileData`
**Action:** Trouver le premier `WearEvent` de type `'weeds'` non réparé → marquer `repairedAt = now.toISOString()` (bypass coût car `REPAIR_COSTS.weeds = 0`).
**Si aucun weeds actif:** effet = no-op (cap non consommé).
**Persist:** `farmData.wearEvents` mis à jour → `serializeFarmProfile` → `farm-{id}.md`.

```typescript
// handler EFFECTS-01
const weedEvent = farmData.wearEvents?.find(e => e.type === 'weeds' && !e.repairedAt);
if (!weedEvent) return { effectApplied: null, farmData }; // no-op
const result = repairWearEvent(farmData.wearEvents!, weedEvent.id, Infinity);
if (!result) return { effectApplied: null, farmData };
return { effectApplied: 'weeds_removed', farmData: { ...farmData, wearEvents: result.events } };
```

### EFFECTS-02: Ménage hebdo → Wear repair gratuit

**Levier:** Premier `WearEvent` actif non-weeds (broken_fence ou damaged_roof — les plus impactants).
**Action:** `repairWearEvent()` avec `currentCoins = Infinity`.
**Si aucun wear event actif:** no-op.

### EFFECTS-03: Courses → Building turbo 24h

**Levier:** Nouveau champ `buildingTurboUntil: string ISO`.
**Action:** Setter `farmData.buildingTurboUntil = new Date(now + 24*3600*1000).toISOString()`.
**Consommation:** Dans `useFarm` hook, avant d'appeler `getPendingResources()`, vérifier si `farmData.buildingTurboUntil` est dans le futur → passer `questSpeedMultiplier=2` (production 2x plus rapide = intervalle ×0.5).

### EFFECTS-04: Routines enfants → Companion mood spike

**Levier:** `generateCompanionAIMessage('task_completed', context)` avec mood forcé à `'excite'`.
**Persistence:** Le message compagnon est RAM-only pour l'instant (Phase 24 le persiste) — Phase 20 retourne juste `companionEvent: 'task_completed'` dans `EffectResult`.
**Note:** L'override du mood se fait via `context.mood = 'excite'` dans le contexte passé à l'IA.

### EFFECTS-05: Devoirs → Growth Sprint 24h

**Levier:** Nouveau champ `growthSprintUntil: string ISO`.
**Action:** `farmData.growthSprintUntil = new Date(now + 24h).toISOString()`.
**Consommation:** Dans `completeTask`, avant `advanceFarmCrops`, si `growthSprintUntil` est dans le futur → passer `techBonuses` avec `tasksPerStageReduction += 1` en plus de la tech normale.

### EFFECTS-06: Rendez-vous → Rare seed drop garanti

**Levier:** `farmRareSeeds` dans `FarmProfileData` — type `RareSeedInventory`.
**Action:** Forcer l'ajout d'une graine rare choisie aléatoirement dans le catalogue des graines `dropOnly`, sans passer par `rollSeedDrop()`.

```typescript
// Choisir une graine rare au hasard (hors fruit_dragon — trop rare)
const rarePool = ['orchidee', 'rose_doree', 'truffe'];
const seedId = rarePool[Math.floor(Math.random() * rarePool.length)];
const existing = farmData.farmRareSeeds ?? {};
const updated = { ...existing, [seedId]: (existing[seedId] ?? 0) + 1 };
return { effectApplied: 'rare_seed_drop', farmData: { ...farmData, farmRareSeeds: updated } };
```

**Note sur `RareSeedInventory`:** Vérifier le type exact — il s'agit probablement d'un `Record<string, number>` basé sur le pattern `parseRareSeeds`.

### EFFECTS-07: Gratitude/famille → Saga trait boost

**Levier:** `SagaProgress.traits` persisté dans `sagas-storage`.
**Action:** Lire la saga active via `sagas-storage`, incrémenter le trait `joy` ou `wonder` de +1.
**Persist:** Via `sagas-storage.saveSagaProgress()`.
**Retour:** `sagaTraitDelta: { trait: 'joy', amount: 1 }` dans `EffectResult`.

**Note critique:** La saga active est dans `sagas-storage` (mobile: SecureStore) et non dans `farm-{id}.md`. Le handler EFFECTS-07 nécessite un accès à `sagas-storage` via import direct (pas via le vault).

### EFFECTS-08: Budget/admin → Building Capacity Boost 24h ×2

**Levier:** Nouveau champ `capacityBoostUntil: string ISO`.
**Action:** `farmData.capacityBoostUntil = new Date(now + 24h).toISOString()`.
**Consommation:** Dans `useFarm`, si `capacityBoostUntil` dans le futur → `techBonuses.buildingCapacityMultiplier * 2` (stacking avec tech existante).

### EFFECTS-09: Soins bébé → Golden harvest ×3

**Levier:** Nouveau flag `nextHarvestGolden: boolean`.
**Action:** `farmData.nextHarvestGolden = true`.
**Consommation:** Dans `harvestCrop` ou `useFarm.handleHarvest` — si flag actif, forcer `isGolden = true` sur la prochaine récolte ET reset le flag. Le GOLDEN_HARVEST_MULTIPLIER existant = 5 mais EFFECTS-09 spécifie ×3. Résolution: créer `GOLDEN_EFFECT_MULTIPLIER = 3` séparé ou surcharger le multiplicateur dans le handler de récolte.

**Note:** `GOLDEN_HARVEST_MULTIPLIER = 5` est le multiplicateur normal (mutation aléatoire). EFFECTS-09 impose ×3 explicitement (not ×5). Cette distinction est importante pour ne pas modifier le comportement des golden crops normaux.

### EFFECTS-10: Cuisine/repas → Craft recipe rare unlock (weekly)

**Levier:** `craftedItems` dans `FarmProfileData` ou un set de recettes débloquées.
**Complication:** Les recettes `CRAFT_RECIPES` ne sont pas "verrouillées" par défaut — elles sont disponibles selon `minTreeStage`. Il n'y a pas de concept de "recette rare verrouillée" dans l'engine actuel.
**Recommandation:** Créer une liste `unlockedRareRecipes: string[]` dans `FarmProfileData` (IDs des recettes débloquées via effets). Identifier 3-4 recettes "rares" dans `CRAFT_RECIPES` marquées `requiresEffect: true` ou choisir parmi les recettes niveau `majestueux`/`legendaire`.

**Alternative simplifiée (forte recommandation):** Ajouter une propriété `effectUnlocked?: boolean` à `CraftRecipe` pour marquer les recettes accessibles uniquement via EFFECTS-10. Cela évite de modifier `FarmProfileData` pour juste une liste de strings.

---

## Common Pitfalls

### Pitfall 1: `completeTask` ne reçoit pas l'objet `Task` complet

**What goes wrong:** `useGamification.completeTask(profile, taskText: string)` — `deriveTaskCategory()` a besoin d'un `Task` avec `.tags`, `.section`, `.sourceFile`. Avec juste `taskText`, la détection est impossible.
**Why it happens:** L'API historique de `completeTask` ne passait que le texte pour la note gami.
**How to avoid:** Enrichir la signature en `completeTask(profile, task: Pick<Task, 'text' | 'tags' | 'section' | 'sourceFile'>)`. Les appelants existants construisent déjà l'objet `Task` en amont — ils pourront passer l'objet complet. Rétrocompatibilité: `task.text` remplace l'ancien `taskText`.
**Warning signs:** TypeScript erreur si les appelants ne passent que `string`.

### Pitfall 2: Race condition write farm-{id}.md

**What goes wrong:** `completeTask` fait déjà un `vault.writeFile(fp, serializeFarmProfile(...))` pour mettre à jour `farmCrops`. Si Phase 20 fait un second write pour les effets, on a une race condition et le premier write est écrasé.
**How to avoid:** Faire un seul `parseFarmProfile` + toutes les mutations (farmCrops + effets) + un seul `serializeFarmProfile` + un seul `writeFile`. Ne JAMAIS avoir 2 writes sur le même fichier dans le même `completeTask`.
**Warning signs:** Perte de progression ferme après complétion tâche.

### Pitfall 3: Caps cross-day non réinitialisés

**What goes wrong:** Si le compteur daily n'est pas comparé à la date courante, un utilisateur dont le cap daily est atteint hier reste bloqué indéfiniment.
**How to avoid:** Dans `isCapExceeded()`, toujours comparer `cap.dayStart` à `today = new Date().toISOString().slice(0,10)` — reset `daily = 0` si différent.
**Warning signs:** Test d'abus cross-day ne fonctionne pas.

### Pitfall 4: EFFECTS-07 saga trait boost sur un profil sans saga active

**What goes wrong:** Si aucune saga active n'existe pour le profil, `saveSagaProgress()` échoue silencieusement ou crée une saga corrompue.
**How to avoid:** Dans le handler EFFECTS-07, vérifier `loadSagaProgress(profileId) !== null` avant la mutation. Si null → effect = no-op, cap non consommé.

### Pitfall 5: Double Loot Cascade (SEMANTIC-09) → loop infinie

**What goes wrong:** Si le second `doOpenLootBox` dans la cascade déclenche à nouveau un streak bonus (si la logique est dans `doOpenLootBox`), on pourrait avoir une récursion.
**How to avoid:** Le Double Loot Cascade est déclenché **une seule fois** en dehors de `doOpenLootBox`, avec un flag `isCascade=true` pour éviter le re-check.

### Pitfall 6: EFFECTS-09 golden multiplier ×3 vs ×5

**What goes wrong:** Utiliser `GOLDEN_HARVEST_MULTIPLIER = 5` pour EFFECTS-09 donne ×5 au lieu de ×3 spécifié.
**How to avoid:** Créer une constante séparée `EFFECT_GOLDEN_MULTIPLIER = 3` dans `effects.ts`. Ne pas modifier `GOLDEN_HARVEST_MULTIPLIER` dans `farm-engine.ts` (breaking change pour les golden crops naturels).

### Pitfall 7: `isSemanticCouplingEnabled()` appelé plusieurs fois dans le même tick

**What goes wrong:** SecureStore est async — appeler `isSemanticCouplingEnabled()` + `loadCaps()` en série ajoute ~4 ms de latence perçue. Si appelé 2 fois séparément, 2 round-trips SecureStore.
**How to avoid:** Combiner en un seul appel `checkSemanticState(profileId)` qui retourne `{ enabled, caps }` en parallèle (`Promise.all`).

---

## Code Examples

### Chargement et sauvegarde caps

```typescript
// lib/semantic/caps.ts
import * as SecureStore from 'expo-secure-store';
import type { CategoryId } from './categories';

const CAPS_KEY_PREFIX = 'coupling-caps-';

export async function loadCaps(profileId: string): Promise<CouplingCaps> {
  try {
    const raw = await SecureStore.getItemAsync(`${CAPS_KEY_PREFIX}${profileId}`);
    if (!raw) return {};
    return JSON.parse(raw) as CouplingCaps;
  } catch {
    return {};
  }
}

export async function saveCaps(profileId: string, caps: CouplingCaps): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      `${CAPS_KEY_PREFIX}${profileId}`,
      JSON.stringify(caps),
    );
  } catch { /* non-critical */ }
}
```

### Vérification cap

```typescript
export function isCapExceeded(categoryId: CategoryId, caps: CouplingCaps): boolean {
  const cap = caps[categoryId];
  const today = new Date().toISOString().slice(0, 10);
  const thisWeek = getWeekStart(); // YYYY-MM-DD du lundi courant

  const daily = DAILY_CAPS[categoryId];
  const weekly = WEEKLY_CAPS[categoryId];

  if (!cap) return false; // jamais utilisé = pas cappé

  const dailyCount = cap.dayStart === today ? cap.daily : 0;
  const weeklyCount = cap.weekStart === thisWeek ? cap.weekly : 0;

  if (daily > 0 && dailyCount >= daily) return true;
  if (weekly > 0 && weeklyCount >= weekly) return true;
  return false;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Écriture farm/gami directe sans queue | `enqueueWrite` via `famille-queue.ts` | Phase 260403-qoo | Phase 20 doit passer par `enqueueWrite` pour les writes `farm-{id}.md` si applicable |
| `giftsSentToday` format "count|YYYY-MM-DD" | Même pattern pour caps anti-abus | Phase 09 | Pattern établi — JSON.parse plus flexible pour caps multi-catégories |
| `advanceFarmCrops` sans bonus temporels | Champs ISO datetime dans FarmProfileData | Phase 20 (nouveau) | Nouveaux champs à ajouter dans types.ts + parser |

---

## Open Questions

1. **Signature de `completeTask` — migration des appelants**
   - What we know: L'API actuelle prend `taskText: string`. Phase 20 a besoin d'un `Task` avec `.tags`, `.section`, `.sourceFile`.
   - What's unclear: Combien d'appelants de `completeTask` passent juste un string vs un objet Task ? (à vérifier avec grep).
   - Recommendation: Enrichir la signature en `task: Pick<Task, 'text' | 'tags' | 'section' | 'sourceFile'>` — le `text` field remplace l'ancien string.

2. **EFFECTS-10 : concept de "recette rare verrouillée"**
   - What we know: `CRAFT_RECIPES` n'a pas de notion de "recette verrouillée par effet". Le système actuel déblocage par `minTreeStage`.
   - What's unclear: Doit-on marquer des recettes existantes comme `effectUnlocked` ou créer de nouvelles recettes ?
   - Recommendation: Ajouter `effectOnly?: boolean` dans `CraftRecipe` type pour 2-3 recettes spéciales (ex: `confiture_truffee`, `gateau_doré`). Ajouter `unlockedEffectRecipes: string[]` dans `FarmProfileData`.

3. **`enqueueWrite` pour les writes farm-{id}.md de Phase 20**
   - What we know: Phase 260403-qoo a wrappé les writes via `enqueueWrite`. Les writes dans `completeTask` utilisent `vault.writeFile` directement.
   - What's unclear: Le write farm dans `completeTask` (ligne ~148 de `useGamification.ts`) utilise-t-il `enqueueWrite` ou `writeFile` direct ?
   - Recommendation: Vérifier et aligner — si `completeTask` fait un write direct, Phase 20 maintient le pattern (single write farm, pas double).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 20 est code/logique pur. Aucune dépendance externe au-delà de `expo-secure-store` déjà installé et vérifié fonctionnel (utilisé par Phase 19).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (configuré en Phase 19) |
| Config file | `jest.config.js` (racine projet) |
| Quick run command | `npx jest lib/semantic/__tests__/ --testNamePattern "effects\|caps" --no-coverage` |
| Full suite command | `npx jest lib/semantic/__tests__/ lib/__tests__/ --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEMANTIC-06 | `applyTaskEffect` retourne le bon `EffectId` pour chaque `CategoryId` | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "SEMANTIC-06"` | Wave 0 |
| SEMANTIC-07 | Cap daily/weekly bloque le déclenchement | unit | `npx jest lib/semantic/__tests__/caps.test.ts -t "SEMANTIC-07"` | Wave 0 |
| SEMANTIC-08 | Tag `#urgent` active multiplier ×2 / 5 tâches | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "SEMANTIC-08"` | Wave 0 |
| SEMANTIC-09 | Streak >7j déclenche Double Loot Cascade | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "SEMANTIC-09"` | Wave 0 |
| EFFECTS-01 | weeds retiré de wearEvents | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-01"` | Wave 0 |
| EFFECTS-02 | wear event réparé gratuitement | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-02"` | Wave 0 |
| EFFECTS-03 | buildingTurboUntil positionné +24h | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-03"` | Wave 0 |
| EFFECTS-04 | companionEvent: 'task_completed' retourné avec mood spike | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-04"` | Wave 0 |
| EFFECTS-05 | growthSprintUntil positionné +24h | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-05"` | Wave 0 |
| EFFECTS-06 | farmRareSeeds incrémenté (garanti, pas random) | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-06"` | Wave 0 |
| EFFECTS-07 | sagaTraitDelta retourné avec trait+amount | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-07"` | Wave 0 |
| EFFECTS-08 | capacityBoostUntil positionné +24h | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-08"` | Wave 0 |
| EFFECTS-09 | nextHarvestGolden flag positionné à true | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-09"` | Wave 0 |
| EFFECTS-10 | unlockedEffectRecipes augmenté (cap hebdo) | unit | `npx jest lib/semantic/__tests__/effects.test.ts -t "EFFECTS-10"` | Wave 0 |

### Sampling Rate

- **Par task commit:** `npx jest lib/semantic/__tests__/ --no-coverage --silent`
- **Par wave merge:** `npx jest lib/semantic/__tests__/ lib/__tests__/ --no-coverage`
- **Phase gate:** Suite complète verte avant `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/semantic/__tests__/effects.test.ts` — couvre SEMANTIC-06/08/09 + EFFECTS-01..10
- [ ] `lib/semantic/__tests__/caps.test.ts` — couvre SEMANTIC-07 (daily/weekly/cross-day/spam/undo)
- [ ] Mock `expo-secure-store` déjà configuré en Phase 19 (`__mocks__/expo-secure-store.ts`) — réutiliser

---

## Sources

### Primary (HIGH confidence)

- Code source `lib/semantic/` (Phase 19 livré) — types CategoryId, CategoryMatch, flag.ts
- Code source `lib/mascot/wear-engine.ts` — API repairWearEvent, getActiveWearEffects
- Code source `lib/mascot/farm-engine.ts` — advanceFarmCrops, rollSeedDrop, GOLDEN_HARVEST_MULTIPLIER
- Code source `lib/mascot/building-engine.ts` — getPendingResources, questSpeedMultiplier
- Code source `lib/mascot/companion-engine.ts` — computeMoodScore, generateCompanionAIMessage
- Code source `lib/mascot/craft-engine.ts` — CRAFT_RECIPES
- Code source `lib/mascot/tech-engine.ts` — TechBonuses, getTechBonuses
- Code source `hooks/useGamification.ts` — completeTask, awardTaskCompletion, point d'injection
- Code source `lib/types.ts` — FarmProfileData (ligne 571)
- Code source `lib/parser.ts` — parseFarmProfile, serializeFarmProfile
- Code source `lib/gamification/engine.ts` — addPoints, multiplierRemaining, calculateStreakBonus
- `.planning/REQUIREMENTS.md` — specs SEMANTIC-06..09, EFFECTS-01..10 (source de vérité)
- `CLAUDE.md` + `STATE.md` — contraintes architecturales ARCH-01..04

### Secondary (MEDIUM confidence)

- `STATE.md` decisions log — pattern `giftsSentToday` anti-abus (Phase 09), `enqueueWrite` (Phase 260403-qoo)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tous les leviers vérifiés dans le code source
- Architecture: HIGH — points d'injection identifiés avec numéros de ligne précis
- Mapping effets: HIGH — chaque effet a un levier existant identifié, sauf EFFECTS-10 (MEDIUM — concept "recette verrouillée" absent)
- Pitfalls: HIGH — identifiés à partir du code existant (race conditions, API signatures)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable — aucune dépendance externe volatile)
