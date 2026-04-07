# Phase 15: Quêtes Coopératives Ferme — Research

**Researched:** 2026-04-06
**Domain:** Gamification coopérative, persistance Markdown vault, React Native UI (react-native-reanimated)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUEST-01 | Quête familiale démarrable, progressée par n'importe quel membre, complétée avec récompense ferme distribuée à tous | Patterns depuis completeDefi (multi-profil gami-{id}.md), harvestCrop (farm-{id}.md), awardTaskCompletion (useGamification) |
| QUEST-02 | Widget bannière sur l'écran ferme montrant quête active, barre de progression globale, contributions par membre | Pattern WeeklyGoal.tsx existant dans tree.tsx (même emplacement, même structure) |
| QUEST-03 | Récompenses quête = effets ferme distinctifs (cultures accélérées, graines rares, bâtiment offert, trophée familial permanent) — distinctes des XP individuels | Intégration dans les engines existants : farm-engine (advance), tech-engine (unlock), building-engine, craft-engine |
</phase_requirements>

---

## Summary

Phase 15 ajoute un système de quêtes coopératives familiales — des objectifs partagés (tasks, récoltes, défis, craft, streaks) dont la progression est agrégée depuis tous les profils et persistée dans un nouveau fichier `family-quests.md`. C'est une feature entièrement nouvelle qui ne remplace rien de l'existant.

Les patterns de référence sont déjà tous présents dans le codebase : `useVaultDefis.ts` pour le hook domaine (parse/serialize/state/CRUD), `serializeDefis`/`parseDefis` pour le format Markdown clé-valeur par section H2, `completeDefi` pour la distribution multi-profil des récompenses dans `gami-{id}.md`, et `WeeklyGoal.tsx` pour le widget bannière dans `tree.tsx`.

La principale nouveauté est l'application des `FamilyFarmReward` — des effets concrets sur les données ferme (`farm-{id}.md` de tous les profils) plutôt que des points XP individuels. Ces effets doivent s'appliquer à chaque `farm-{profileId}.md` de la famille, en réutilisant les engines existants (farm-engine, building-engine, tech-engine).

**Recommandation principale :** Suivre exactement le pattern `useVaultDefis.ts` pour créer `useVaultFamilyQuests.ts` — même signature, même architecture de hook domaine, même format de fichier Markdown. Les intégrations de progression se font dans `useGamification.completeTask`, `useFarm.harvest`, et `useVaultDefis.checkInDefi` via callback optionnel.

---

## Project Constraints (from CLAUDE.md)

- Animations : `react-native-reanimated` obligatoire (pas RN Animated) — `useSharedValue`, `useAnimatedStyle`, `withSpring`/`withTiming`
- Couleurs : TOUJOURS `useThemeColors()` / `colors.*` — jamais de hardcoded
- Langue UI/commits/commentaires : **français**
- Validation : `npx tsc --noEmit` — seule validation (pas de test suite)
- Erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts — ignorer
- Format date affiché : JJ/MM/AAAA
- Modals : présentation `pageSheet` + drag-to-dismiss
- Tokens design pour les valeurs numériques (`Spacing['2xl']` pas `16`)
- `React.memo()` sur les list items, `useCallback()` sur handlers passés en props
- `SectionErrorBoundary` autour des sections dashboard indépendamment
- Barrel files à maintenir : `components/ui/index.ts`, `components/dashboard/index.ts`
- `gamiFile()` défini localement dans chaque fichier (évite dépendance circulaire)
- write queue : toutes les écritures critiques via `vault.writeFile()` (enqueueWrite interne)

---

## Standard Stack

### Core (déjà disponible — aucune installation requise)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1 | Animations widget bannière | Obligatoire CLAUDE.md |
| gray-matter | existant | Pas utilisé pour quests (format custom key-value) | Cohérence parser.ts |
| expo-haptics | existant | Feedback tactile sur completion | Pattern établi |
| date-fns | existant | Calcul dates endDate/expired | Déjà utilisé partout |

### Aucune nouvelle dépendance requise

Toutes les briques nécessaires sont présentes :
- `lib/vault.ts` VaultManager (readFile/writeFile avec enqueueWrite)
- `lib/gamification/engine.ts` (awardTaskCompletion, addPoints)
- `lib/mascot/farm-engine.ts` (advanceFarmCrops, harvestCrop)
- `lib/mascot/building-engine.ts` (constructBuilding)
- `lib/mascot/tech-engine.ts` (unlockTechNode)

**Installation :** Aucune installation requise.

---

## Architecture Patterns

### Fichier de persistance

```
family-quests.md          ← fichier partagé à la racine du vault (comme defis.md)
```

Format Markdown clé-valeur par section H2 — exactement comme `defis.md` :

```markdown
---
tags:
  - quests
---
# Quêtes familiales

## 🌾 Moisson Collective
id: quest_1712345678_abc
type: harvest
target: 25
current: 12
contributions: emma:5,lucas:4,papa:3
status: active
startDate: 2026-04-06
endDate: 2026-04-20
reward: loot_legendary:2
emoji: 🌾
description: Récolter 25 cultures ensemble → Coffre Légendaire pour tous
```

### Recommended Project Structure

```
lib/
├── quest-engine.ts          # Types FamilyQuest + FamilyFarmReward + applyQuestReward()
├── parser.ts                # + parseFamilyQuests() + serializeFamilyQuests()
hooks/
├── useVaultFamilyQuests.ts  # Hook domaine — CRUD + progress + completion
components/mascot/
├── FamilyQuestBanner.tsx    # Widget bannière (pattern WeeklyGoal)
├── FamilyQuestDetailSheet.tsx # Modal détail quête (pageSheet)
constants/
├── questTemplates.ts        # Templates quêtes (pattern defiTemplates.ts)
```

### Pattern 1: Hook domaine (useVaultFamilyQuests.ts)

Copie exacte du pattern `useVaultDefis.ts` — même signature, même structure :

```typescript
// Source: hooks/useVaultDefis.ts (pattern établi)
export function useVaultFamilyQuests(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  gamiDataRef: React.MutableRefObject<GamificationData | null>,
  setGamiData: React.Dispatch<React.SetStateAction<GamificationData | null>>,
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>,
): UseVaultFamilyQuestsResult {
  const [familyQuests, setFamilyQuests] = useState<FamilyQuest[]>([]);
  // createQuest, contributeToQuest, completeQuest, deleteQuest
}
```

Branché dans `useVault.ts` via le même pattern que `defisHook`.

### Pattern 2: Parse/Serialize (parser.ts)

Exactement comme `parseDefis`/`serializeDefis` — format clé-valeur H2 :

```typescript
// Source: lib/parser.ts parseDefis() (ligne 940) — pattern à reproduire
export function parseFamilyQuests(content: string): FamilyQuest[] {
  // H2 = titre quête, clés/valeurs ligne par ligne
  // contributions: "emma:5,lucas:4" → Record<string, number>
}

export function serializeFamilyQuests(quests: FamilyQuest[]): string {
  // Même format que serializeDefis, avec reward sérialisé en "type:param"
}
```

### Pattern 3: Application des récompenses ferme

```typescript
// lib/quest-engine.ts — applyQuestReward()
// Lit farm-{id}.md de chaque profil, applique la récompense, réécrit
export async function applyQuestReward(
  vault: VaultManager,
  profileIds: string[],
  reward: FamilyFarmReward,
): Promise<void> {
  for (const pid of profileIds) {
    const farmContent = await vault.readFile(`farm-${pid}.md`).catch(() => '');
    const farmData = parseFarmProfile(farmContent);
    // switch reward.type:
    //   'rare_seeds': farmData.farmRareSeeds[seedId] += qty
    //   'loot_legendary': addLootBoxesToProfile(pid, count)
    //   'building': constructBuilding() sur premier slot libre
    //   'rain_bonus': activer flag temporaire via SecureStore
    //   'golden_rain': activer flag temporaire via SecureStore
    //   'production_boost': activer flag temporaire via SecureStore
    //   'tech_unlock': unlockTechNode()
    //   'family_trophy': ajouter à farmData.mascotDecorations
    //   'unlock_plot': ajouter tech_node via unlockTechNode()
    const profile = profiles.find(p => p.id === pid);
    await vault.writeFile(`farm-${pid}.md`, serializeFarmProfile(profile?.name ?? pid, farmData));
  }
}
```

### Pattern 4: Widget bannière (FamilyQuestBanner.tsx)

Modèle exact : `WeeklyGoal.tsx` (78 lignes, même structure) :

```typescript
// Source: components/mascot/WeeklyGoal.tsx (pattern bannière)
export function FamilyQuestBanner({ quest, profiles, colors, t, onPress }: FamilyQuestBannerProps) {
  const progress = Math.min(1, quest.current / quest.target);
  // Animated.View entering={FadeInDown} (react-native-reanimated)
  // Barre de progression + avatars contributions
  // TouchableOpacity onPress → sheet détail
}
```

Insertion dans `tree.tsx` juste avant `<WeeklyGoal>` (ligne 1935) :

```typescript
// app/(tabs)/tree.tsx ~ligne 1935
{activeQuest && (
  <FamilyQuestBanner
    quest={activeQuest}
    profiles={profiles}
    colors={colors}
    t={t}
    onPress={() => setShowQuestDetail(true)}
  />
)}
{gamiData && profile && (
  <WeeklyGoal ... />
)}
```

### Pattern 5: Intégration progression (3 points d'entrée)

**a) Tâches complétées** — dans `useGamification.completeTask` :
```typescript
// hooks/useGamification.ts completeTask (ligne 74)
// Après l'écriture gami, appeler:
if (onQuestProgress) {
  await onQuestProgress(profile.id, 'tasks', 1);
}
```

**b) Récoltes** — dans `useFarm.harvest` :
```typescript
// hooks/useFarm.ts harvest (ligne 273)
// Après writeProfileFields, appeler:
if (onQuestProgress) {
  const isGolden = result.isGolden;
  await onQuestProgress(profileId, isGolden ? 'golden_harvest' : 'harvest', 1);
}
```

**c) Défis check-in** — dans `useVaultDefis.checkInDefi` :
```typescript
// hooks/useVaultDefis.ts checkInDefi (ligne 67)
// Après écriture gami, appeler:
if (isNewCheckIn && onQuestProgress) {
  await onQuestProgress(profileId, 'defis', 1);
}
```

**Mécanisme de callback :** Passer `onQuestProgress?: (profileId, type, amount) => Promise<void>` en argument optionnel aux hooks existants — **ne pas modifier leurs signatures contractuelles**.

### Pattern 6: Types FamilyQuest

```typescript
// lib/quest-engine.ts — données de design confirmées
export type FamilyQuestType =
  | 'tasks' | 'defis' | 'checkins' | 'harvest' | 'craft'
  | 'production' | 'streak' | 'golden_harvest' | 'composite';

export type FamilyFarmReward =
  | { type: 'unlock_plot' }
  | { type: 'rare_seeds'; quantity: number }
  | { type: 'building'; buildingId: string }
  | { type: 'rain_bonus'; durationHours: number }
  | { type: 'golden_rain'; durationHours: number }
  | { type: 'production_boost'; durationHours: number }
  | { type: 'loot_legendary'; count: number }
  | { type: 'crafting_recipe'; recipeId: string }
  | { type: 'tech_unlock'; nodeId: string }
  | { type: 'family_trophy'; trophyId: string }
  | { type: 'seasonal_decoration'; id: string };

export interface FamilyQuest {
  id: string;                              // "quest_<timestamp>_<rand>"
  title: string;
  description: string;
  emoji: string;
  type: FamilyQuestType;
  target: number;
  current: number;
  contributions: Record<string, number>;   // profileId → count
  farmReward: FamilyFarmReward;
  status: 'active' | 'completed' | 'expired';
  startDate: string;                       // YYYY-MM-DD
  endDate: string;                         // YYYY-MM-DD
}
```

### Pattern 7: Sérialisation FamilyFarmReward (compact, robuste)

Le reward doit être sérialisable sur une seule ligne :

```
reward: loot_legendary:2
reward: rare_seeds:10
reward: rain_bonus:48
reward: building:moulin
reward: tech_unlock:speed_boost
reward: family_trophy:champions_famille
```

Fonctions : `serializeReward(r: FamilyFarmReward): string` et `parseReward(s: string): FamilyFarmReward`.

### Anti-Patterns à éviter

- **Ne pas stocker la progression dans les fichiers farm-{id}.md individuels** : la progression est partagée → seul `family-quests.md` contient les données de progression.
- **Ne pas créer un nouveau context** : utiliser le pattern hook-domaine existant, branché dans `useVault.ts` comme `defisHook`.
- **Ne pas modifier les signatures publiques de `completeTask`/`harvest`** : passer des callbacks optionnels.
- **Ne pas utiliser `Animated` (RN)** pour les animations du widget — utiliser `react-native-reanimated`.
- **Ne pas hardcoder de couleurs** dans `FamilyQuestBanner.tsx` — `colors.*` uniquement.

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser à la place | Pourquoi |
|----------|-------------------|---------------------|----------|
| Persistance quêtes | Nouveau format JSON/SQLite | Format Markdown clé-valeur H2 (comme defis.md) | Compatibilité vault Obsidian obligatoire |
| Distribution récompenses | Logique ad hoc | Pattern `completeDefi` (useVaultDefis.ts:122) — itérer profiles, lire/écrire gami-{id}.md | Gestion multi-profil déjà résolue |
| Animations bannière | Interpolations custom | `FadeInDown` reanimated (pattern WeeklyGoal) | Conventions CLAUDE.md |
| Calcul contribution | Agrégation custom | Lire `family-quests.md` et incrémenter `contributions[profileId]` | Simple et déjà dans le pattern defis |
| Effets temporaires (rain_bonus) | State en mémoire | `SecureStore` avec clé `quest_rain_bonus_active` + expiry ISO | Survie au redémarrage requise (QUEST-01 critère 4) |
| Construct building reward | Logique custom | `constructBuilding()` de `building-engine.ts` | Moteur existant avec toutes les validations |

---

## Common Pitfalls

### Pitfall 1: Race condition sur family-quests.md

**Ce qui se passe mal :** Deux profils complètent une tâche quasi simultanément — les deux lisent `current: 10`, les deux écrivent `current: 11`, un incrément est perdu.

**Pourquoi :** `vault.writeFile()` utilise `enqueueWrite()` qui sérialise les écritures *par fichier*. Si les deux profils passent par le même processus (même device, app ouverte), la queue protège. Mais iCloud sync peut créer des conflits inter-device.

**Comment éviter :** La queue `enqueueWrite` de VaultManager protège pour un seul device. Pour les conflits iCloud, utiliser la même stratégie que `famille.md` — lire le fichier frais juste avant chaque incrément (pattern read-modify-write dans la queue), pas depuis l'état React.

**Signes d'alerte :** `current` dépasse `target` ou contributions ne correspondent pas au total.

### Pitfall 2: Récompenses ferme temporaires qui ne survivent pas au redémarrage

**Ce qui se passe mal :** `rain_bonus` applique un effet en mémoire qui disparaît au redémarrage — l'utilisateur perd sa récompense.

**Pourquoi :** Les effets temporaires comme `rain_bonus` ne sont pas des données farm-{id}.md — ils sont orthogonaux aux cultures.

**Comment éviter :** Stocker les effets actifs dans `SecureStore` avec une clé structurée `quest_active_effects` → JSON `[{ type, expiresAt, profileId }]`. Lire au démarrage dans `useFarm` ou `useGamification`. Appliquer le bonus lors du `advanceFarmCrops` si un effet actif est trouvé.

**Alternative plus simple :** Stocker l'effet actif comme champ dans `family-quests.md` sous `activeEffect: rain_bonus:2026-04-08T10:00:00Z` — rechargé à chaque refresh vault.

### Pitfall 3: Widget bannière qui cause un re-render global coûteux

**Ce qui se passe mal :** `FamilyQuestBanner` dans `tree.tsx` déclenche des re-renders sur chaque tick de timer (crops animation).

**Pourquoi :** `tree.tsx` contient un timer global (`sharedFrameIdx`) qui update régulièrement l'état.

**Comment éviter :** Wrapper `FamilyQuestBanner` avec `React.memo()`. Passer uniquement `quest` et `profiles` comme props (pas d'objets instables). Ne pas recalculer dans le rendu — `useMemo` pour le progress ratio.

### Pitfall 4: Contributions — utiliser profileId ou profileName?

**Ce qui se passe mal :** Mixer profileId (stable) et profileName (mutable) dans `contributions` crée des incohérences si un profil est renommé.

**Comment éviter :** Toujours stocker `contributions` avec `profileId` (pas le nom). En serialization : `contributions: emma:5,lucas:4` où `emma`/`lucas` sont des IDs (lowercase, snake_case). Cohérent avec le pattern `participants` dans `Defi`.

### Pitfall 5: Quête complétée mais reward non appliqué (crash partiel)

**Ce qui se passe mal :** `completeQuest` marque `status: completed` dans `family-quests.md` mais le crash arrive avant l'écriture des rewards dans `farm-{id}.md`.

**Comment éviter :** Appliquer d'abord les rewards à tous les profils, puis marquer `status: completed`. Si une étape échoue, la quête reste `active` et peut être re-tentée. (Pattern "reward-first, complete-last".)

### Pitfall 6: Progression type 'streak' — définition ambiguë

**Ce qui se passe mal :** "Tous actifs 5 jours" peut signifier 5 jours calendaire consécutifs ou 5 jours cumulés pendant la durée.

**Comment éviter :** Pour la phase initiale, implémenter `streak` comme "chaque profil a au moins un check-in dans les X derniers jours calendaires". Lire les `contributions` sur la fenêtre glissante. Documenter explicitement la règle dans `questTemplates.ts`.

---

## Code Examples

### Serialisation reward (compact)

```typescript
// Source: patterns lib/mascot/building-engine.ts (format CSV colon-séparé)
export function serializeReward(r: FamilyFarmReward): string {
  switch (r.type) {
    case 'loot_legendary': return `loot_legendary:${r.count}`;
    case 'rare_seeds': return `rare_seeds:${r.quantity}`;
    case 'rain_bonus': return `rain_bonus:${r.durationHours}`;
    case 'golden_rain': return `golden_rain:${r.durationHours}`;
    case 'production_boost': return `production_boost:${r.durationHours}`;
    case 'building': return `building:${r.buildingId}`;
    case 'tech_unlock': return `tech_unlock:${r.nodeId}`;
    case 'family_trophy': return `family_trophy:${r.trophyId}`;
    case 'crafting_recipe': return `crafting_recipe:${r.recipeId}`;
    case 'seasonal_decoration': return `seasonal_decoration:${r.id}`;
    case 'unlock_plot': return 'unlock_plot';
  }
}
```

### Sérialisation contributions

```typescript
// contributions: Record<string, number> → "emma:5,lucas:3,papa:4"
function serializeContributions(c: Record<string, number>): string {
  return Object.entries(c).map(([id, n]) => `${id}:${n}`).join(',');
}

function parseContributions(s: string): Record<string, number> {
  const result: Record<string, number> = {};
  if (!s?.trim()) return result;
  for (const part of s.split(',')) {
    const [id, n] = part.split(':');
    if (id && n) result[id.trim()] = parseInt(n.trim(), 10) || 0;
  }
  return result;
}
```

### Intégration progression dans useGamification.completeTask

```typescript
// hooks/useGamification.ts — ajout callback optionnel
interface UseGamificationArgs {
  vault: VaultManager | null;
  notifPrefs: NotificationPreferences;
  onDataChange?: (profiles: Profile[]) => void;
  onQuestProgress?: (profileId: string, type: string, amount: number) => Promise<void>;
}

// Dans completeTask, après vault.writeFile(file, ...):
if (onQuestProgress) {
  try {
    await onQuestProgress(profile.id, 'tasks', 1);
  } catch { /* Quest — non-critical */ }
}
```

### Insertion dans useVault.ts

```typescript
// hooks/useVault.ts — même pattern que defisHook
const questsHook = useVaultFamilyQuests(vaultRef, gamiDataRef, setGamiData, setProfiles);
const { familyQuests } = questsHook;

// Dans loadVault(), après newDefis:
const questsContent = await vault.readFile(FAMILY_QUESTS_FILE).catch(() => '');
questsHook.setFamilyQuests(parseFamilyQuests(questsContent));

// Dans VaultState (exposé via context):
familyQuests,
createFamilyQuest: questsHook.createQuest,
contributeToQuest: questsHook.contribute,
completeFamilyQuest: questsHook.completeQuest,
```

---

## State of the Art

| Ancien | Actuel dans ce codebase | Impact |
|--------|------------------------|--------|
| Quêtes coopératives inexistantes (Phase 3 avait un stub) | Phase 15 : feature complète avec types, engine, UI | Première implémentation réelle |
| `famille.md` monolithique | `gami-{id}.md` + `farm-{id}.md` per-profil | Les récompenses quête s'appliquent aux fichiers per-profil |
| Récompenses = XP individuels uniquement | `FamilyFarmReward` = effets farm concrets | Nécessite de nouveaux chemins d'application dans les engines |

**Aucun élément déprécié** à gérer dans cette phase.

---

## Open Questions

1. **Récompenses temporaires (rain_bonus, golden_rain, production_boost) — stockage**
   - Ce qu'on sait : `farm-{id}.md` stocke l'état ferme per-profil. `SecureStore` stocke les préférences.
   - Ce qui est flou : où stocker l'effet actif pour qu'il s'applique au bon moment dans `advanceFarmCrops` / `harvest`. SecureStore est per-device, pas synchronisé iCloud.
   - Recommandation : stocker dans `family-quests.md` sous forme de champ `activeEffect: type:expiresAt` — rechargé à chaque `loadVault()`. Cela synchronise via iCloud automatiquement.

2. **Démarrage de quête depuis l'écran défis vs ferme**
   - Ce qu'on sait : `defis.tsx` a une UI de création (Modal avec templates).
   - Ce qui est flou : faut-il dupliquer l'UI ou avoir un seul point d'entrée ?
   - Recommandation : un seul composant `FamilyQuestPickerSheet` (pageSheet) accessible depuis les deux écrans. Dans `defis.tsx`, ajouter un onglet "Quêtes" ou un bouton "+" distinct.

3. **Quête 'streak' — définition précise des règles**
   - Ce qu'on sait : "Streak Collectif: tous actifs 5 jours"
   - Ce qui est flou : "actifs" = au moins 1 tâche complétée ce jour-là ? Ou check-in dans le défi ?
   - Recommandation : "actifs" = `contributions[profileId]` augmente ce jour-là (toute action : tâche, récolte ou défi). Calculer à chaque `contribute()`.

---

## Environment Availability

Skipped — phase purement code/config, aucune dépendance externe nouvelle.

---

## Sources

### Primary (HIGH confidence)

- `hooks/useVaultDefis.ts` — pattern exact du hook domaine à reproduire (parse, serialize, state, CRUD, multi-profil rewards)
- `lib/parser.ts` lignes 940-1040 — `parseDefis`/`serializeDefis` pattern à reproduire pour `parseFamilyQuests`/`serializeFamilyQuests`
- `hooks/useGamification.ts` — point d'intégration `completeTask` pour progression `tasks`
- `hooks/useFarm.ts` lignes 273-321 — point d'intégration `harvest` pour progression `harvest`/`golden_harvest`
- `components/mascot/WeeklyGoal.tsx` — template exact pour `FamilyQuestBanner.tsx`
- `app/(tabs)/tree.tsx` lignes 1935-1942 — emplacement d'insertion du widget dans le ScrollView
- `constants/defiTemplates.ts` — template exact pour `questTemplates.ts`
- `lib/mascot/farm-engine.ts` — `advanceFarmCrops`, `harvestCrop` pour les récompenses ferme
- `lib/mascot/building-engine.ts` — `constructBuilding` pour récompense `building`
- `lib/mascot/tech-engine.ts` — `unlockTechNode` pour récompenses `tech_unlock` et `unlock_plot`
- `lib/types.ts` — `FarmProfileData`, `Profile`, `Defi` types de référence
- `CLAUDE.md` — toutes les contraintes projet (animations, couleurs, langue, etc.)

### Confidence Assessment

- Types `FamilyQuest` / `FamilyFarmReward` : HIGH — définis explicitement dans les design decisions
- Format sérialisation `family-quests.md` : HIGH — déduit directement de `serializeDefis` (pattern identique)
- Points d'intégration progression : HIGH — tous les hooks existants sont lus en détail
- Application récompenses temporaires (rain_bonus) : MEDIUM — mécanisme de stockage à confirmer en planification

---

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — aucune nouvelle dépendance, tous les outils disponibles
- Architecture patterns : HIGH — dérivés directement du codebase existant (defis/farm/gami)
- Pitfalls : HIGH — identifiés depuis les patterns d'écriture concurrente existants
- Récompenses temporaires : MEDIUM — mécanisme de persistance à préciser

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stack stable, pas de dépendances externes)
