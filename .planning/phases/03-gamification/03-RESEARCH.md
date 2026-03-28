# Phase 3: Gamification — Research

**Researched:** 2026-03-28
**Domain:** Gamification engine, seasonal calendar, cooperative family quests, Markdown persistence
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-02 | Événements saisonniers liés au calendrier réel (printemps, été, automne, hiver) | `getCurrentSeason()` et les palettes saisonnières existent déjà dans `lib/mascot/seasons.ts` ; `PixelDiorama` et `TreeView` acceptent déjà un prop `season`. Le gap est que la saison n'est pas transmise à `AmbientParticles` et que les SEASONAL_PARTICLES (flocons, feuilles) ne sont pas encore rendus dans le diorama ferme. |
| GAME-03 | Quêtes familiales coopératives (objectifs partagés entre membres) | Le type `Defi` dans `lib/types.ts` a déjà `participants: string[]`, `progress: DefiDayEntry[]` (multi-profil), `rewardPoints`, `rewardLootBoxes`. L'infrastructure parse/serialize existe. Il faut un modèle de quête avec `questType`, `target`, et distribution des récompenses à tous les participants à la complétion. |

</phase_requirements>

---

## Summary

Phase 3 est en grande partie une **intégration** de systèmes existants plutôt qu'une construction from-scratch. Les deux besoins — saisons automatiques et quêtes coopératives — ont des fondations solides dans le codebase.

Pour GAME-02, `lib/mascot/seasons.ts` fournit déjà `getCurrentSeason()`, des palettes `SKY_COLORS`, `GROUND_COLORS`, `SEASONAL_OVERRIDES` par espèce, et `SEASONAL_PARTICLES`. `PixelDiorama.tsx` accepte déjà un prop `season` et l'utilise pour les couleurs de sol. `TreeView.tsx` appelle `getCurrentSeason()` et `getSeasonalPalette()`. Le gap principal est que `AmbientParticles.tsx` (particules ambiantes du diorama) ne render pas les `SEASONAL_PARTICLES` — il n'utilise que la configuration horaire (`lib/mascot/ambiance.ts`). La complétion de GAME-02 consiste à coupler `SEASONAL_PARTICLES` au rendu `AmbientParticles` ou à créer un composant `SeasonalParticles` séparé qui se superpose au diorama.

Pour GAME-03, le type `Defi` existant (dans `lib/types.ts`) est le meilleur point d'ancrage : il a déjà `participants: string[]`, `progress: DefiDayEntry[]` per-profil, `rewardPoints`, et `rewardLootBoxes`. Les quêtes familiales coopératives peuvent être un sous-type enrichi de Défi avec `questType: 'cooperative'` et `target: number` (objectif de contribution cumulée). La distribution de récompenses à la complétion devra appeler `addPoints` pour chaque participant dans `gamification.md`. Le fichier `defis.md` reste la source de persistance.

**Primary recommendation:** Construire sur les deux systèmes existants — augmenter `AmbientParticles` avec les particules saisonnières pour GAME-02, et étendre le type `Defi` avec un discriminant `questType: 'cooperative'` pour GAME-03, en réutilisant `parseDefis`/`serializeDefis` sans nouveau fichier.

---

## Standard Stack

### Core (existant, confirmé par lecture directe du code)

| Composant | Fichier | Rôle | Statut |
|-----------|---------|------|--------|
| `getCurrentSeason()` | `lib/mascot/seasons.ts` | Détection saison hémisphère nord | Existe — 4 saisons par mois |
| `getSeasonalPalette()` | `lib/mascot/seasons.ts` | Couleurs feuillage par saison/espèce | Existe |
| `SEASONAL_PARTICLES` | `lib/mascot/seasons.ts` | Config particules émoji par saison | Existe — non encore rendu dans diorama ferme |
| `AmbientParticles.tsx` | `components/mascot/AmbientParticles.tsx` | Particules animées superposées au diorama | Existe — horaire seulement |
| `PixelDiorama.tsx` | `components/mascot/PixelDiorama.tsx` | Sol pixelart avec couleurs saisonnières | Existe — prop `season` déjà câblé |
| `Defi` type + `parseDefis` / `serializeDefis` | `lib/types.ts`, `lib/parser.ts` | Défis familiaux multi-profil | Existe — structure idéale pour quêtes coop |
| `addPoints()` | `lib/gamification/engine.ts` | Ajout XP à un profil | Existe — à appeler pour chaque participant |
| `GamificationData` | `lib/types.ts` | État gamification global | Existe |
| `REWARDS` / `XP_BUDGET` | `lib/gamification/rewards.ts` | Pool de récompenses + budget XP | Existe — toute récompense doit passer ici |

### Dépendances GAME-02 — gap identifié

`SEASONAL_PARTICLES` définit:
```typescript
// Source: lib/mascot/seasons.ts
export const SEASONAL_PARTICLES: Record<Season, SeasonalParticle> = {
  printemps: { emoji: '🌸', color: '#FFB7C5', count: 6, speed: 'slow', direction: 'down' },
  ete:       { emoji: '✨', color: '#FFE082', count: 4, speed: 'slow', direction: 'float' },
  automne:   { emoji: '🍂', color: '#D4A373', count: 8, speed: 'normal', direction: 'down' },
  hiver:     { emoji: '❄️', color: '#E3F2FD', count: 10, speed: 'slow', direction: 'down' },
};
```

`AmbientParticles.tsx` n'utilise que `AMBIENT_CONFIGS` de `lib/mascot/ambiance.ts` (horaire). Il faut soit :
- Ajouter un nouveau prop `seasonalParticle?: SeasonalParticle` à `AmbientParticles` et le superposer aux particules horaires
- Créer un composant `SeasonalParticles.tsx` distinct (approche plus propre pour les animations)

La prop `season` arrive déjà jusqu'au diorama via `getCurrentSeason()` dans `tree.tsx` ligne 248.

---

## Architecture Patterns

### GAME-02 : Saison → Diorama ferme

**Flux actuel :**
```
tree.tsx: season = getCurrentSeason()
  └─> TreeView (prop season)       ✅ anime l'arbre
  └─> PixelDiorama (prop season)   ✅ couleurs sol
  └─> AmbientParticles             ❌ ignore la saison — horaire seulement
  └─> WorldGridView                ❌ pas de visuel saisonnier
```

**Flux cible :**
```
tree.tsx: season = getCurrentSeason()
  └─> TreeView (prop season)         ✅ (déjà fait)
  └─> PixelDiorama (prop season)     ✅ (déjà fait)
  └─> AmbientParticles               → ajouter prop `seasonalParticle`
       OU nouveau SeasonalParticles  → composant dédié saison
  └─> WorldGridView                  → optionnel: badge 🌸/🍂 sur diorama
```

### Pattern composant `SeasonalParticles`

```typescript
// Nouveau fichier: components/mascot/SeasonalParticles.tsx
// Source pattern: AmbientParticles.tsx existant

interface SeasonalParticlesProps {
  season: Season;
  containerWidth: number;
  containerHeight: number;
}

export function SeasonalParticles({ season, containerWidth, containerHeight }: SeasonalParticlesProps) {
  const config = SEASONAL_PARTICLES[season];
  // Même pattern Reanimated que AmbientParticles
  // useSharedValue + withRepeat + withTiming/withSpring
  // Animer emoji sur l'axe Y avec direction config.direction
}
```

**Alternative plus légère :** Ajouter un prop optionnel `seasonConfig?: SeasonalParticle` à `AmbientParticles` existant — moins d'un nouveau fichier, moins de risque de régression.

### GAME-03 : Quête familiale coopérative

**Type étendu :**
```typescript
// Étendre lib/types.ts — Defi
// questType 'cooperative' = tous les participants contribuent vers un objectif commun

// Option A (minimal, rétrocompatible) : ajouter un champ optionnel
export interface Defi {
  // ... champs existants ...
  questType?: 'individual' | 'cooperative';  // défaut: 'individual' (backward compat)
  target?: number;                           // objectif cumulé global (pour 'cooperative')
}

// Pas de nouveau fichier — defis.md reste la source de vérité
```

**Calcul de progression coopérative :**
```typescript
// lib/gamification/quests.ts (nouveau fichier pure logic)
export function getCoopProgress(defi: Defi): number {
  return defi.progress
    .filter(e => e.completed)
    .length;
}

export function isCoopQuestComplete(defi: Defi): boolean {
  if (!defi.target) return false;
  return getCoopProgress(defi) >= defi.target;
}
```

**Distribution des récompenses à la complétion :**
```typescript
// Dans hooks/useVault.ts (où updateDefiProgress est déjà implémenté)
// Quand une quête coopérative atteint le target:

for (const participantId of defi.participants) {
  const participantProfile = gami.profiles.find(p => p.id === participantId);
  if (!participantProfile) continue;
  const { profile: rewarded, entry } = addPoints(
    participantProfile,
    defi.rewardPoints,         // depuis constants/rewards.ts via REWARDS pool
    `🌟 Quête: ${defi.title}`,
  );
  // updateProfileInData(gami, rewarded)
  // history.push(entry)
}
// + ajouter loot boxes disponibles si rewardLootBoxes > 0
```

### Schéma persistance (gamification.md) — pas de changement requis

Le `serializeGamification` / `parseGamification` existant gère déjà les points et l'historique. La distribution des récompenses coopératives s'intègre sans modification du format de fichier.

### Contrainte XP Budget (GAME-01 acquis depuis Phase 2)

La règle établie dans `lib/gamification/rewards.ts` :
```
- Complétion aventure quotidienne = 1 équivalent tâche (10 pts)
- Chapitre saga = 3 équivalents (30 pts)
- Défi complété = configurable, défaut 50 pts (5 tâches)
```

Pour GAME-03, les quêtes coopératives doivent utiliser `rewardPoints` depuis `Defi` (déjà configurable). Ne pas hardcoder de valeurs XP inline — tout passe par `REWARDS` ou les champs `rewardPoints`/`rewardLootBoxes` du `Defi`.

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser à la place | Raison |
|----------|-------------------|---------------------|--------|
| Détection de saison | Logique date custom | `getCurrentSeason()` dans `lib/mascot/seasons.ts` | Hémisphère nord correct, testé |
| Animations particules | Système custom | Copier le pattern `AmbientParticles.tsx` (Reanimated `useSharedValue` + `withRepeat`) | Pattern déjà établi dans la codebase |
| Persistence quêtes | Nouveau fichier Markdown | Réutiliser `defis.md` + `parseDefis`/`serializeDefis` | Déjà câblé dans `useVault.ts` |
| Distribution XP | Calcul inline | `addPoints()` de `lib/gamification/engine.ts` | Gère multiplier, pity counter, history |
| Pool de récompenses | Valeurs hardcodées | `REWARDS` de `lib/gamification/rewards.ts` | Contrainte explicite GAME-03 success criteria |
| Calcul Pâques | Algorithme date | `getEasterDate()` de `lib/gamification/seasonal.ts` | Déjà implémenté (Meeus/Jones/Butcher) |

---

## Common Pitfalls

### Pitfall 1 : Superposition AmbientParticles + SeasonalParticles
**Ce qui se passe :** Deux couches de particules animées simultanément — la nuit avec les lucioles (ambiance) ET les flocons (hiver) — peut surcharger visuellement et impacter les performances.
**Cause :** Phase 4 (AMB-01) a ajouté `AmbientParticles` qui couvre déjà la scène. GAME-02 veut ajouter une couche saisonnière par-dessus.
**Comment éviter :** Conditionner les particules saisonnières — si un effet ambiance est actif (matin/soir/nuit), réduire le count des particules saisonnières de 50%. Ou bien intégrer les particules saisonnières comme variante dans `AmbientParticles` plutôt qu'un composant séparé. Limite : `count: 10` pour hiver est déjà le max raisonnable.
**Signes d'alerte :** FPS perceptiblement réduit sur l'écran `tree.tsx`.

### Pitfall 2 : Saison non transmise à WorldGridView
**Ce qui se passe :** `WorldGridView.tsx` affiche les crops sans contexte saisonnier. Le badge "bonus saisonnier" visible sur une culture (`hasCropSeasonalBonus()`) ne change pas visuellement avec la saison.
**Cause :** `WorldGridView` appelle `hasCropSeasonalBonus()` qui appelle `getCurrentSeason()` en interne — la saison est bien calculée mais le sol reste identique visuellement.
**Comment éviter :** Passer `season` en prop à `WorldGridView` pour que le fond du diorama ferme reflète la saison (changer `PIXEL_GROUND` couleurs selon saison — déjà dans `PixelDiorama`).

### Pitfall 3 : Quête coopérative récompensant des profils non-participants
**Ce qui se passe :** `defi.participants` peut être vide (`[]` = toute la famille). Lors de la distribution des récompenses, itérer sur `gami.profiles` sans filtre distribue les XP à des profils non-impliqués dans la quête.
**Cause :** La sémantique `participants: []` dans le type `Defi` signifie "tous", ce qui nécessite un cas spécial dans la boucle de distribution.
**Comment éviter :**
```typescript
const targets = defi.participants.length > 0
  ? gami.profiles.filter(p => defi.participants.includes(p.id))
  : gami.profiles;  // [] = toute la famille
```

### Pitfall 4 : Récompenser plusieurs fois la même quête complétée
**Ce qui se passe :** Si `updateDefiProgress` est appelé après que `defi.status === 'completed'`, la vérification de complétion se déclenche à nouveau et distribue des XP une deuxième fois.
**Cause :** La logique de complétion est dans le chemin hot de mise à jour de progression.
**Comment éviter :** Guard explicite : ne distribuer les récompenses que si `defi.status` passe de `'active'` à `'completed'` dans cette transaction (comparer avant/après).

### Pitfall 5 : Valeurs XP hardcodées dans les composants quêtes
**Ce qui se passe :** Écrire `rewardPoints: 100` inline dans un template de quête, contournant `REWARDS` et le budget XP.
**Cause :** Les quêtes coopératives sont une nouvelle feature, tentation d'y mettre des valeurs arbitraires.
**Comment éviter :** Toutes les valeurs de points des quêtes doivent être exprimées en multiples de `POINTS_PER_TASK` (10 pts). Une quête standard = 5 équivalents-tâches = 50 pts. Une quête hebdomadaire difficile = max 10 équivalents = 100 pts.

---

## Code Examples

### Détection de saison (existant, HIGH confidence)
```typescript
// Source: lib/mascot/seasons.ts
export function getCurrentSeason(date: Date = new Date()): Season {
  const month = date.getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'printemps';  // mars–mai
  if (month >= 5 && month <= 7) return 'ete';         // juin–août
  if (month >= 8 && month <= 10) return 'automne';    // sept–nov
  return 'hiver';                                      // déc–fév
}
```

### Particule saisonnière animée (pattern AmbientParticles, HIGH confidence)
```typescript
// Pattern d'animation existant dans AmbientParticles.tsx
// Pour SeasonalParticles: même structure, props depuis SEASONAL_PARTICLES[season]
const opacity = useSharedValue(0);
useEffect(() => {
  opacity.value = withRepeat(
    withSequence(
      withTiming(config.opacity, { duration: config.duration }),
      withTiming(0, { duration: config.duration }),
    ),
    -1,
    true,
  );
}, []);
```

### Extension type Defi pour quêtes coopératives (à créer)
```typescript
// Modifier lib/types.ts — champs optionnels (backward compat)
export interface Defi {
  // ... champs existants inchangés ...
  questType?: 'individual' | 'cooperative';  // nouveau — défaut undefined = 'individual'
  target?: number;  // pour 'cooperative': nb de contributions cumulées pour gagner
}
```

### Distribution récompenses coopératives (pattern addPoints existant)
```typescript
// Dans hooks/useVault.ts, quand une quête coopérative est complétée
// Source pattern: awardTaskCompletion dans lib/gamification/engine.ts
for (const p of participatingProfiles) {
  const { profile: rewarded, entry } = addPoints(
    p,
    defi.rewardPoints,  // valeur depuis Defi (pas inline)
    `🌟 Quête: ${defi.title}`,
    gami.activeRewards,
  );
  gami = updateProfileInData(gami, rewarded);
  gami.history.push(entry);
  if (defi.rewardLootBoxes > 0) {
    rewarded.lootBoxesAvailable += defi.rewardLootBoxes;
  }
}
defi.status = 'completed';
```

### Pattern saisonniers dans PixelDiorama (existant)
```typescript
// Source: components/mascot/PixelDiorama.tsx
export const PIXEL_GROUND: Record<Season, string> = {
  printemps: '#5A8C32',
  ete:       '#6B9E3A',
  automne:   '#7A6B3A',
  hiver:     '#C8D0C8',
};
// usage: backgroundColor: PIXEL_GROUND[season]
```

---

## Architecture de persistance — Résumé

| Donnée | Fichier vault | Format | Parse/Serialize |
|--------|--------------|--------|-----------------|
| Points/XP/Streaks | `gamification.md` | `## Nom\npoints: N\n...` | `parseGamification` / `serializeGamification` |
| Profils (nom, rôle, arbre) | `famille.md` | `### id\nname: X\n...` | `parseFamille` / dans `serializeProfile` |
| Quêtes familiales | `defis.md` | `## Titre\nid: X\nparticipants: a,b\n...` | `parseDefis` / `serializeDefis` |
| Progression saga | `SecureStore` | JSON par profil | `saveSagaProgress` / `loadSagaProgress` |

Pour GAME-03, les quêtes coopératives s'écrivent dans `defis.md` — même infrastructure, aucun nouveau fichier vault.

---

## State of the Art

| Approche précédente | Approche actuelle | Impact |
|--------------------|------------------|--------|
| Saison ignorée dans le diorama ferme | `PixelDiorama` reçoit `season` et change les couleurs de sol | Visuel saisonnier partiel — SEASONAL_PARTICLES non rendu |
| Défis individuels uniquement | Type `Defi` avec `participants: string[]` | Infrastructure prête pour coop — sans `questType` discriminant |
| `SEASONAL_PARTICLES` définis mais inutilisés dans la ferme | À connecter dans `AmbientParticles` ou nouveau composant | C'est le travail de GAME-02 |

**Aucune dépendance externe supplémentaire.** Toutes les briques sont présentes.

---

## Open Questions

1. **Particules saisonnières : augmenter AmbientParticles ou composant séparé ?**
   - Ce qu'on sait : `AmbientParticles` a un design single-purpose (horaire). Ajouter un second concern alourdit le composant.
   - Ce qui n'est pas clair : est-ce que les particules saisonnières doivent se superposer aux particules horaires ou les remplacer la nuit (ex : pas de lucioles en hiver) ?
   - Recommandation : Créer `SeasonalParticles.tsx` indépendant, plus simple à tester isolément. Décision cosmétique pure — superposer avec opacité réduite la nuit.

2. **Quêtes prédéfinies vs quêtes ad-hoc créées par les parents ?**
   - Ce qu'on sait : Le type `Defi` a `templateId?` qui suggère un système de templates. Les `constants/defi-templates.ts` existent dans le projet.
   - Ce qui n'est pas clair : GAME-03 demande "peut être démarrée" — faut-il un catalogue de quêtes coopératives prédéfinies, ou créer la quête manuellement ?
   - Recommandation : Créer un catalogue statique minimal (3-5 quêtes coopératives types dans `constants/quest-templates.ts`) + laisser les parents créer des quêtes custom via l'UI Défis existante.

3. **L'écran Défis existant suffit-il pour les quêtes coopératives ou faut-il une vue dédiée ?**
   - Ce qu'on sait : `app/(tabs)/defis.tsx` affiche déjà tous les défis avec progress bars et boutons de complétion.
   - Ce qui n'est pas clair : L'UI actuelle montre-t-elle bien l'aspect "coopératif" (qui a contribué quoi) ?
   - Recommandation : Enrichir l'écran Défis existant plutôt que créer un écran séparé. Ajouter un badge "🤝 Coopératif" et une barre de progression globale cumulée pour les quêtes `questType: 'cooperative'`.

---

## Sources

### Primary (HIGH confidence — lecture directe du code)
- `lib/mascot/seasons.ts` — `getCurrentSeason`, `SEASONAL_PARTICLES`, `SKY_COLORS`, `GROUND_COLORS`, `getSeasonalPalette`, `SEASONAL_OVERRIDES`
- `lib/mascot/farm-engine.ts` — `SEASONAL_CROP_BONUS`, `hasCropSeasonalBonus`, pattern persistence CSV
- `lib/gamification/rewards.ts` — `REWARDS`, `XP_BUDGET`, `POINTS_PER_TASK`, contraintes budget XP
- `lib/gamification/engine.ts` — `addPoints`, `updateProfileInData`, pattern distribution rewards
- `lib/types.ts` — `Defi`, `DefiDayEntry`, `GamificationData`, `Profile`, `SeasonalEvent`
- `lib/parser.ts` — `parseDefis`, `serializeDefis`, `parseGamification`, `serializeGamification`, format gamification.md
- `components/mascot/PixelDiorama.tsx` — `PIXEL_GROUND`, prop `season`, pattern couleurs saisonnières
- `components/mascot/TreeView.tsx` — prop `season`, utilisation de `getSeasonalPalette`
- `components/mascot/AmbientParticles.tsx` — pattern animation particules Reanimated
- `app/(tabs)/tree.tsx` — `season = getCurrentSeason()`, câblage complet diorama
- `lib/mascot/sagas-storage.ts` — pattern persistance SecureStore (à NE PAS utiliser pour quêtes coop — vault seulement)
- `hooks/useVault.ts` — `DEFIS_FILE = 'defis.md'`, `updateDefiProgress`, pattern read/write vault

### Secondary (MEDIUM confidence)
- `constants/defi-templates.ts` présumé (fichier référencé par `templateId?` dans `Defi`) — à vérifier à l'implémentation

---

## Metadata

**Confidence breakdown:**
- Standard stack (saisons) : HIGH — systèmes existants, lus directement
- Standard stack (quêtes coop) : HIGH — type `Defi` avec tous les champs nécessaires
- Architecture patterns : HIGH — patterns copie-conformes de l'existant
- Pitfalls : MEDIUM — basés sur lecture du code et analyse logique

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (stable — pas de migration framework prévue)
