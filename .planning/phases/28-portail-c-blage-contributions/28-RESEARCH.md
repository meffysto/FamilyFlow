# Phase 28: Portail + câblage contributions — Research

**Researched:** 2026-04-11
**Domain:** React Native / Reanimated — intégration coopérative ferme-village
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Portail = arche en pierre pixel art, sprite statique + effet lumineux subtil (glow ou particules via Reanimated). Cohérence univers ferme.
- **D-02:** Transition ferme → village = fade cross-dissolve Reanimated ~400ms. Pas de zoom ni de slide.
- **D-03:** 1 récolte = 1 point, 1 tâche complétée = 1 point. Pas de pondération. Cible hebdo gérée par `computeWeekTarget()`.
- **D-04:** Feedback contribution = toast discret « +1 Village 🏡 » en bas d'écran (~2s), non-bloquant. L'action principale conserve son propre feedback.
- **D-05:** Point d'insertion récoltes = `useFarm.ts` après `harvestCrop()` (ligne ~287). Point d'insertion tâches = `useGamification.ts` dans `applyTaskEffect()` (ligne ~234). Les deux appellent `addContribution(type, profileId)` de `useGarden.ts`.
- **D-06:** Suggestion activité IRL = carte sur l'écran village quand objectif atteint. Liste curatée ~20 activités filtrées par saison. Dismiss par tap.
- **D-07:** Bonus XP + item cosmétique à discrétion Claude. Équitable (même bonus tous profils). Réutiliser le système loot existant si pertinent.
- **D-08:** Le portail remplace le FAB temporaire de `tree.tsx` (ligne 2031). Un seul point d'entrée vers le village = le portail. Depuis le village, bouton retour classique.

### Claude's Discretion

- **D-07:** Montant bonus XP et nature item cosmétique. Doit être équitable (non proportionnel à la contribution individuelle). Réutiliser `lib/gamification/` si pertinent.

### Deferred Ideas (OUT OF SCOPE)

- Enrichissement interactif du village (avatars, ambiance, arbre familial) — v1.5
- Portail inverse village → ferme (portail bidirectionnel visuel) — v1.5 potentiel
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-03 | Un portail interactif dans la scène ferme perso permet de naviguer vers le village avec une transition visuelle | `PortalSprite` inline dans `tree.tsx`, remplace le FAB ligne 2031 ; glow Reanimated loop + fade `withTiming` 400ms sur navigation |
| COOP-01 | Récolte ferme → contribution automatique au village | Injecter `addContribution('harvest', profileId)` dans `useFarm.ts::harvest()` après `harvestCrop()` — pattern identique au `onQuestProgress` existant |
| COOP-02 | Tâche IRL complétée → contribution automatique au village | Injecter `addContribution('task', profileId)` dans `useGamification.ts::completeTask()` après `applyTaskEffect()` — pattern identique au bloc Museum et Semantic coupling |
| OBJ-03 | Objectif atteint → tous les profils reçoivent bonus XP + item cosmétique | `RewardCard` dans `village.tsx` ; `claimReward()` déjà en place dans `useGarden.ts` ; bonus XP via `addPoints()` de `lib/gamification/engine.ts` |
| OBJ-04 | Récompense inclut suggestion activité familiale IRL pondérée par saison | `getCurrentSeason()` déjà importé dans `village.tsx` ; liste curatée statique à créer dans `lib/village/` |
</phase_requirements>

---

## Summary

Phase 28 est la dernière phase du milestone v1.4. Elle cable trois fonctionnalités distinctes qui doivent coexister sans régression : (1) un portail animé Reanimated dans `tree.tsx` qui remplace un FAB temporaire, (2) un câblage automatique de contributions dans deux hooks existants (`useFarm.ts` et `useGamification.ts`), et (3) une carte de récompense collective dans `village.tsx` avec suggestion d'activité IRL.

Toute l'infrastructure de données est déjà en place : `useGarden.addContribution()` est prête à appeler, `useGarden.claimReward()` gère l'anti-double-claim via le flag `village_claimed_week` dans `gami-{id}.md`, et `village.tsx` affiche déjà le bouton "Réclamer la récompense". Ce qui manque : le câblage des deux hooks (fire-and-forget non-critique), le composant portail, et la carte activité IRL avec la liste curatée.

**Décision majeure pour le planner :** `useFarm.ts` accepte déjà un callback `onQuestProgress` — le pattern pour injecter `addContribution` est identique (callback optionnel passé à l'instanciation). `useGamification.ts` utilise `useToast()` directement — le toast « +1 Village 🏡 » peut être déclenché dans le même bloc que les effets semantiques existants.

**Primary recommendation:** Traiter les trois features en plans séparés — portail d'abord (le plus visible), câblage contributions ensuite (deux hooks), récompense collective en dernier (s'appuie sur le câblage).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1 | Glow portail (loop), fade transition, scale spring | Obligatoire CLAUDE.md — `useSharedValue` + `useAnimatedStyle` |
| expo-router | v6 | Navigation `router.push('/(tabs)/village')` | Déjà utilisé dans `tree.tsx` |
| expo-haptics | — | `Haptics.selectionAsync()` au tap portail | Déjà importé dans `tree.tsx` |
| expo-secure-store | — | Toast et state session | Via ToastContext existant |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| useGarden (hook interne) | Phase 26 | `addContribution`, `claimReward`, `isGoalReached` | Câblage contributions + récompense |
| useToast (context interne) | Phase 21 | Toast « +1 Village 🏡 » | Dans `useFarm.ts` et `useGamification.ts` |
| getCurrentSeason (lib/mascot/seasons) | Phase locale | Filtrage activités IRL par saison | Dans la carte activité village.tsx |

**Zéro nouvelle dépendance npm** (per décision ARCH-05 milestone v1.2, réaffirmée en v1.4).

---

## Architecture Patterns

### Portail dans tree.tsx

Le FAB temporaire `villageFAB` (ligne 2031, Couche 7) est à remplacer par un composant `PortalSprite` inline (< 80 lignes, pas besoin d'extraction).

**Structure du PortalSprite :**
```typescript
// Inline dans tree.tsx — Couche 7
const SPRING_PORTAL = { damping: 12, stiffness: 200 } as const;

function PortalSprite({ onPress }: { onPress: () => void }) {
  const glowOpacity = useSharedValue(0.4);
  const scaleAnim = useSharedValue(1);

  // Glow loop idle
  useEffect(() => {
    glowOpacity.value = withRepeat(withTiming(0.8, { duration: 1200 }), -1, true);
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleAnim.value }] }));

  const handlePress = useCallback(() => {
    scaleAnim.value = withSpring(0.92, SPRING_PORTAL, () => {
      scaleAnim.value = withSpring(1, SPRING_PORTAL);
    });
    Haptics.selectionAsync();
    onPress();
  }, [scaleAnim, onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Portail vers le village"
      accessibilityRole="button"
    >
      <Animated.View style={scaleStyle}>
        <Text style={styles.portalEmoji}>🏛️</Text>
        {/* Glow overlay */}
        <Animated.View style={[styles.portalGlow, glowStyle, { backgroundColor: colors.catJeux }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
```

**Transition navigation :** La navigation vers `/(tabs)/village` se fait après le tap via `router.push`. Le fade cross-dissolve est géré par une `Animated.View` wrapper autour du contenu ferme, opacity → 0 avec `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` avant le push. Cette approche est cohérente avec les `FadeIn*` de l'écran existant.

### Câblage contributions dans useFarm.ts

`useFarm.ts` accepte déjà `onQuestProgress` comme callback optionnel à l'instanciation. Le pattern pour `addContribution` est identique :

```typescript
// hooks/useFarm.ts — signature modifiée
export function useFarm(
  onQuestProgress?: (profileId: string, type: string, amount: number) => Promise<void>,
  onContribution?: (type: ContributionType, profileId: string) => Promise<void>,
) { ... }

// Dans harvest(), après refreshFarm() et onQuestProgress :
if (onContribution) {
  try { await onContribution('harvest', profileId); } catch { /* Village — non-critical */ }
}
```

**Point d'appel dans tree.tsx :**
```typescript
// tree.tsx — instanciation useFarm avec le nouveau callback
const { addContribution } = useGarden();
const { plant, harvest, ... } = useFarm(contributeFamilyQuest, addContribution);
```

### Câblage contributions dans useGamification.ts

`useGamification.ts` utilise une fonction `completeTask` avec `useToast` en interne. Le bloc d'injection est après le bloc `applyTaskEffect` (ligne ~234), dans le même try/catch pattern non-critique :

```typescript
// useGamification.ts — dans completeTask(), après le bloc Museum (ligne ~315)
// Contribution village (COOP-02) — fire-and-forget non-critique
if (effectResult?.effectApplied && onContribution) {
  try { await onContribution('task', profile.id); } catch { /* Village — non-critical */ }
}

// Toast contribution village (D-04)
if (effectResult?.effectApplied && showToast) {
  try { showToast('+1 Village 🏡', 'success', undefined, { icon: '🏘️' }); } catch {}
}
```

**Signature UseGamificationArgs étendue :**
```typescript
interface UseGamificationArgs {
  vault: VaultManager | null;
  notifPrefs: NotificationPreferences;
  onDataChange?: (profiles: Profile[]) => void;
  onQuestProgress?: (profileId: string, type: string, amount: number) => Promise<void>;
  onContribution?: (type: ContributionType, profileId: string) => Promise<void>;
}
```

**Point d'appel dans tasks.tsx / dashboard** : vérifier tous les endroits où `useGamification` est instancié et passer `addContribution` de `useGarden`.

### RewardCard dans village.tsx

Composant conditionnel inline (< 60 lignes) affiché après la barre de progression quand `isGoalReached`. Contient :
1. Le CTA « Récupérer la récompense » (existant `handleClaim`)
2. La carte activité IRL (nouvelle)

```typescript
// village.tsx — nouveau composant RewardCard inline
function RewardCard({
  canClaim,
  alreadyClaimed,
  activity,
  onClaim,
  onDismiss,
  colors,
}: RewardCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const opacity = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleDismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 }, () => { runOnJS(setDismissed)(true); });
  }, [opacity]);

  if (dismissed) return null;

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(350)} style={[styles.rewardCard, cardStyle]}>
      {/* Suggestion activité IRL */}
      <Text style={[styles.rewardTitle, { color: colors.text }]}>Activité famille cette semaine</Text>
      <Text style={[styles.rewardActivity, { color: colors.textMuted }]}>{activity}</Text>

      {canClaim && (
        <TouchableOpacity onPress={onClaim} style={[styles.claimBtn, { backgroundColor: colors.success }]}>
          <Text style={[styles.claimBtnText, { color: '#FFFFFF' }]}>Récupérer la récompense</Text>
        </TouchableOpacity>
      )}
      {alreadyClaimed && (
        <Text style={{ color: colors.textMuted }}>Récompense réclamée ✓</Text>
      )}
      <TouchableOpacity onPress={handleDismiss}>
        <Text style={{ color: colors.textSub }}>Fermer la carte</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
```

### Liste activités IRL — placement et structure

Nouvelle constante dans `lib/village/activities.ts` (ou inline dans `village.tsx` si < 30 lignes) :

```typescript
// lib/village/activities.ts
import type { Season } from '../mascot/seasons';

export const IRL_ACTIVITIES: Record<Season, string[]> = {
  printemps: [
    'Pique-nique au parc 🌳',
    'Planter des fleurs ensemble 🌸',
    'Balade à vélo en famille 🚴',
    'Marché aux fleurs 💐',
    'Jeu de piste dans le jardin 🗺️',
  ],
  ete: [
    'Sortie à la plage ou à la piscine 🏖️',
    'Barbecue en famille 🍖',
    'Glaces artisanales en promenade 🍦',
    'Soirée cinéma en plein air 🎬',
    'Cueillette de fruits 🍓',
  ],
  automne: [
    'Ramasser des châtaignes 🌰',
    'Balade en forêt feuilles colorées 🍂',
    'Cuisiner une tarte aux pommes 🍎',
    'Visite d\'un marché artisanal 🎃',
    'Jeux de société en famille 🎲',
  ],
  hiver: [
    'Soirée crêpes 🥞',
    'Promenade sous la neige ❄️',
    'Regarder un film ensemble au chaud 🎥',
    'Faire un puzzle en famille 🧩',
    'Préparer des biscuits de Noël 🍪',
  ],
};

/** Sélectionne une activité déterministe pour la semaine courante */
export function pickSeasonalActivity(season: Season, weekStart: string): string {
  const activities = IRL_ACTIVITIES[season];
  // Hash simple sur weekStart pour rotation déterministe
  const hash = weekStart.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0);
  return activities[hash % activities.length];
}
```

**Exported depuis lib/village/index.ts.**

### Bonus XP collectif — D-07

`useGarden.claimReward()` retourne `true` si le claim réussit. Le bonus XP doit être appliqué à TOUS les profils actifs. Deux approches :

1. **Approche retenue (recommandée) :** Dans `village.tsx`, après un `claimReward` réussi, appeler `addPoints()` pour chaque profil actif via le VaultContext. Montant suggéré : **+25 XP** (équivalent à une rare lootbox reward, cohérent avec les paliers existants dans `engine.ts`). Pas d'item cosmétique separate — le bonus de 25 XP est lui-même équitable et utilise l'infrastructure existante.

2. **Approche alternative non retenue :** Modifier `useGarden.claimReward()` pour écrire le bonus — évité car `useGarden` ne doit pas connaître la logique gamification (séparation des responsabilités D-01 de la Phase 26).

**Implémentation bonus XP :**
```typescript
// village.tsx — handleClaim étendu
const handleClaim = useCallback(async () => {
  if (!activeProfile) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const success = await claimReward(activeProfile.id);
  if (success) {
    setClaimedThisSession(true);
    // Bonus XP pour tous les profils actifs (D-07 — équitable)
    for (const p of activeProfiles) {
      try {
        await addPointsToProfile(p.id, 25, '🏘️ Objectif village atteint');
      } catch { /* Gamification — non-critical */ }
    }
    showToast('+25 XP pour tous les membres 🎉', 'success');
  }
}, [activeProfile, claimReward, activeProfiles, addPointsToProfile, showToast]);
```

`addPointsToProfile` doit être exposé par `useVault()` ou créé via un helper local qui lit/écrit `gami-{id}.md` directement (pattern identique à `addCoins` dans `useFarm.ts`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast « +1 Village » | Composant toast custom | `showToast()` de `useToast()` | Déjà intégré dans la hiérarchie providers, supporte `icon` + `subtitle` |
| Anti-double-claim | Guard custom | `useGarden.claimReward()` + `village_claimed_week` | Déjà implémenté Phase 26, pattern testé |
| Fade de navigation | CSS/transform custom | `withTiming(0, { duration: 400 })` Reanimated | Obligatoire per CLAUDE.md + pattern établi |
| Sélection activité IRL | Appel API IA | Constante statique + `pickSeasonalActivity()` | D-06 est explicitement une liste curatée statique — pas d'IA |
| Calcul bonus XP | Logique custom | `addPoints()` de `lib/gamification/engine.ts` | Utilise le multiplicateur profile, les entrées history, le streak |

---

## Common Pitfalls

### Pitfall 1 : Toast contribution doublon
**What goes wrong:** La récolte ferme déclenche déjà un toast de feedback (HarvestBurst, effet sémantique). Ajouter le toast village dans le même flush affiche deux toasts simultanément.
**Why it happens:** `useToast` queue non-visible — le deuxième toast écrase le premier ou les deux se superposent.
**How to avoid:** Déclencher le toast « +1 Village » avec un délai de 300ms (`setTimeout`) ou le déclencher depuis l'appelant (tree.tsx) plutôt que depuis l'intérieur du hook — séparation claire. Option: montrer le toast uniquement si `effectResult?.effectApplied === false` (aucun effet sémantique appliqué).
**Warning signs:** Dans tree.tsx, après une récolte, deux toasts visibles simultanément.

### Pitfall 2 : useGamification instancié dans plusieurs endroits
**What goes wrong:** `useGamification` est instancié dans `tasks.tsx`, `dashboard/`, et potentiellement d'autres écrans. Si le callback `onContribution` n'est pas passé dans TOUS les points d'instanciation, les contributions tâches ne seront câblées que partiellement.
**Why it happens:** La refactorisation n'est pas exhaustive — grep insuffisant.
**How to avoid:** Grep `useGamification(` dans tout le projet avant de coder. Passer `addContribution` depuis `useGarden()` à chaque point d'appel.
**Warning signs:** `addContribution` appelé depuis `tree.tsx` mais pas depuis `tasks.tsx`.

### Pitfall 3 : Boucle infinie dans useGarden après addContribution
**What goes wrong:** `addContribution` relit `VILLAGE_FILE` et appelle `setGardenRaw`, ce qui peut re-trigger le `useEffect` de génération d'objectif si les guards ne sont pas corrects.
**Why it happens:** `gardenRaw` est dans les dépendances du `useEffect` de génération d'objectif dans `useGarden.ts`.
**How to avoid:** Le guard `if (gardenData.currentWeekStart === currentMonday) return;` est déjà en place (Phase 26). Ne pas modifier ce guard. Vérifier que `addContribution` ne modifie pas `currentWeekStart` (il ne le fait pas — append-only contribution).
**Warning signs:** Spam de writes vault visible dans les logs __DEV__.

### Pitfall 4 : Portail mal positionné dans la tilemap ferme
**What goes wrong:** Le portail est positionné en absolu sans tenir compte du stade de l'arbre (`treeStage`) qui change la hauteur du `DIORAMA_HEIGHT`.
**Why it happens:** La ferme utilise des heights dynamiques (`DIORAMA_HEIGHT_BY_STAGE`). Le FAB existant est positionné avec `styles.villageFAB` en absolute dans un View de hauteur fixe.
**How to avoid:** Vérifier la position du FAB existant dans les styles (`styles.villageFAB`) et conserver la même logique de positionnement pour `PortalSprite`. Ne pas hardcoder une position qui dépend d'un stade de l'arbre spécifique.
**Warning signs:** Portail hors de l'écran sur un profil avec arbre stade 1.

### Pitfall 5 : Bonus XP appliqué uniquement au profil actif
**What goes wrong:** `claimReward()` retourne `true` uniquement pour le profil actif. Si le bonus XP est ajouté uniquement pour `activeProfile.id`, les autres membres ne reçoivent pas leur récompense.
**Why it happens:** `claimReward()` est per-profil (anti-double-claim per-profil). La sémantique "collectif" doit être portée par l'appelant.
**How to avoid:** Itérer sur `activeProfiles` (pas `profiles`) et appeler `addPointsToProfile(p.id, 25, ...)` pour chacun. Différencier `claimReward` (flag anti-double-claim per-profil actif) du bonus XP (tous profils actifs).
**Warning signs:** Seul le profil qui clique reçoit les 25 XP.

### Pitfall 6 : Fade navigation bloquant l'UI
**What goes wrong:** Si le fade (opacity 0) est appliqué sur un `View` parent qui contient des `TouchableOpacity`, les touches sont toujours capturées même quand opacity = 0.
**Why it happens:** `opacity` n'affecte pas le hit testing en React Native.
**How to avoid:** Utiliser `pointerEvents="none"` sur le View wrappé pendant la transition, ou déclencher le `router.push` dans le callback de fin d'animation Reanimated (`withTiming(..., () => { runOnJS(router.push)(...)(); })`).
**Warning signs:** Double navigation possible si l'utilisateur tape rapidement pendant le fade.

---

## Code Examples

### Glow loop Reanimated (idle portail)

```typescript
// Source : CLAUDE.md pattern + Reanimated docs withRepeat
const glowOpacity = useSharedValue(0.4);
useEffect(() => {
  glowOpacity.value = withRepeat(
    withTiming(0.8, { duration: 1200 }),
    -1,   // infini
    true, // reverse
  );
}, []);
```

### Fade + navigation (transition portail)

```typescript
// Source : pattern Reanimated withTiming + runOnJS
const screenOpacity = useSharedValue(1);

const handlePortalPress = useCallback(() => {
  screenOpacity.value = withTiming(
    0,
    { duration: 400, easing: Easing.out(Easing.ease) },
    (finished) => {
      if (finished) runOnJS(router.push)('/(tabs)/village' as any);
    },
  );
}, [screenOpacity, router]);
```

### Injection addContribution dans useFarm.ts

```typescript
// hooks/useFarm.ts — signature + injection dans harvest()
export function useFarm(
  onQuestProgress?: (profileId: string, type: string, amount: number) => Promise<void>,
  onContribution?: (type: ContributionType, profileId: string) => Promise<void>,
) {
  // ...
  // Dans harvest(), après onQuestProgress :
  if (onContribution) {
    try { await onContribution('harvest', profileId); } catch { /* Village — non-critical */ }
  }
}
```

### Instanciation useGamification avec onContribution

```typescript
// tasks.tsx et autres écrans
const { addContribution } = useGarden();
const { completeTask, openLootBox } = useGamification({
  vault,
  notifPrefs,
  onDataChange: handleDataChange,
  onQuestProgress: contributeFamilyQuest,
  onContribution: addContribution,
});
```

### pickSeasonalActivity — sélection déterministe

```typescript
// lib/village/activities.ts
export function pickSeasonalActivity(season: Season, weekStart: string): string {
  const activities = IRL_ACTIVITIES[season];
  const hash = weekStart.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0);
  return activities[hash % activities.length];
}
// Usage dans village.tsx :
const activity = useMemo(
  () => pickSeasonalActivity(season, gardenData.currentWeekStart),
  [season, gardenData.currentWeekStart],
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FAB temporaire `villageFAB` dans `tree.tsx` | `PortalSprite` animé Reanimated | Phase 28 | Remplace navigation bouton flottant |
| Récompense collective non implémentée | `claimReward()` + bonus XP multi-profil | Phase 28 | Complète la boucle coopérative v1.4 |
| Contributions manuelles (inexistantes) | Câblage automatique récolte + tâche | Phase 28 | Automatise l'alimentation de l'objectif |

**Code existant à ne PAS modifier :**
- `useGarden.addContribution()` — prêt, aucune modification
- `useGarden.claimReward()` — prêt, aucune modification
- `village.tsx` bouton claim existant — réutiliser `handleClaim`, l'étendre seulement
- `lib/village/parser.ts` — intouché

---

## Open Questions

1. **Où instancier `useGarden` pour le câblage dans `useFarm` et `useGamification` ?**
   - Ce qu'on sait : `useFarm` et `useGamification` sont des hooks qui reçoivent des callbacks à l'instanciation (pattern `onQuestProgress`).
   - Ce qui est clair : `useGarden` doit être appelé dans un composant React (pas dans un hook natif), puis `addContribution` passé comme callback.
   - Recommandation : Appeler `useGarden()` dans `tree.tsx` et passer `addContribution` à la fois à `useFarm` et via le contexte à `useGamification`. Pour les tâches (tasks.tsx), appeler `useGarden()` directement dans `tasks.tsx` et passer le callback.

2. **Faut-il extraire `PortalSprite` en fichier séparé ?**
   - Ce qu'on sait : la règle CLAUDE.md dit "< 80 lignes = inline acceptable".
   - Recommandation : Rester inline dans `tree.tsx` si ≤ 80 lignes. Sinon, extraire dans `components/mascot/PortalSprite.tsx`.

3. **`addPointsToProfile` pour le bonus XP collectif — helper local ou via VaultContext ?**
   - Ce qu'on sait : `useFarm.ts` a déjà un `addCoins` local qui lit/écrit `gami-{id}.md`. Le pattern est réutilisable.
   - Recommandation : Créer un helper local dans `village.tsx` ou étendre `useGarden.claimReward()` pour retourner les profils à récompenser (sans appliquer le bonus lui-même). Le bonus XP est appliqué dans `village.tsx` via un helper `addVillageBonus(profileId, amount)` calqué sur `addCoins`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase purement code/config. Aucune dépendance externe au-delà du stack React Native/Expo déjà installé. `react-native-reanimated ~4.1`, `expo-haptics`, `expo-router v6` tous présents et vérifiés dans le codebase existant.

---

## Validation Architecture

`workflow.nyquist_validation` est `false` dans `.planning/config.json` — section omise.

---

## Sources

### Primary (HIGH confidence)

- `/Users/gabrielwaltio/Documents/family-vault/hooks/useGarden.ts` — API complète `addContribution`, `claimReward`, `isGoalReached`, pattern hook domaine
- `/Users/gabrielwaltio/Documents/family-vault/hooks/useFarm.ts` — Signature `useFarm(onQuestProgress?)`, code `harvest()` complet, pattern injection callback
- `/Users/gabrielwaltio/Documents/family-vault/hooks/useGamification.ts` — `completeTask()`, bloc `applyTaskEffect`, `UseGamificationArgs`, pattern `useToast`
- `/Users/gabrielwaltio/Documents/family-vault/app/(tabs)/tree.tsx` — FAB ligne 2031, imports existants, `useFarm` instanciation ligne 339, pattern Reanimated
- `/Users/gabrielwaltio/Documents/family-vault/app/(tabs)/village.tsx` — Structure complète, `handleClaim`, `useGarden()`, imports Reanimated, `getCurrentSeason`
- `/Users/gabrielwaltio/Documents/family-vault/lib/village/` — types.ts, templates.ts, index.ts — schéma complet
- `/Users/gabrielwaltio/Documents/family-vault/lib/gamification/engine.ts` — `addPoints()`, `awardTaskCompletion()`, paliers XP
- `/Users/gabrielwaltio/Documents/family-vault/contexts/ToastContext.tsx` — API `showToast(message, type, action, options)` avec `icon` et `subtitle`
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/seasons.ts` — `getCurrentSeason()`, type `Season`
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/28-portail-c-blage-contributions/28-UI-SPEC.md` — Contrat visuel complet, animations, copie, composants

### Secondary (MEDIUM confidence)

- `CLAUDE.md` du projet — Contraintes animation Reanimated, `useThemeColors()`, zéro dépendance npm, patterns StyleSheet

---

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — tout est code existant vérifié directement
- Architecture : HIGH — patterns d'injection identiques à `onQuestProgress` déjà en production
- Pitfalls : HIGH — issus de l'analyse directe des hooks et des décisions Phase 26

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stack stable, pas de bibliothèques en mouvement rapide)
