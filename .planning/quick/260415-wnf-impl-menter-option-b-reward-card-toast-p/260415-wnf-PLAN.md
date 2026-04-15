---
phase: quick-260415-wnf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/gamification/RewardCardToast.tsx
  - contexts/ToastContext.tsx
  - app/(tabs)/tasks.tsx
autonomous: true
requirements: [REWARD-CARD]
must_haves:
  truths:
    - "Quand une tache est completee, une carte reward slide-up depuis le bas avec avatar+nom+XP anime"
    - "La carte se dismiss automatiquement apres ~3s avec spring out vers le bas"
    - "Les toasts erreur/info restent inchanges (ancien systeme)"
  artifacts:
    - path: "components/gamification/RewardCardToast.tsx"
      provides: "Composant RewardCard avec animation spring, compteur XP, barre progression, sparkles"
      min_lines: 80
    - path: "contexts/ToastContext.tsx"
      provides: "Nouveau type reward_card et methode showRewardCard"
    - path: "app/(tabs)/tasks.tsx"
      provides: "handleTaskToggle appelle showRewardCard au lieu de showToast pour completed=true"
  key_links:
    - from: "app/(tabs)/tasks.tsx"
      to: "contexts/ToastContext.tsx"
      via: "showRewardCard() appel"
      pattern: "showRewardCard"
    - from: "contexts/ToastContext.tsx"
      to: "components/gamification/RewardCardToast.tsx"
      via: "rendu conditionnel du composant RewardCardToast"
      pattern: "RewardCardToast"
---

<objective>
Remplacer le toast texte standard par une carte reward animee (slide-up spring depuis le bas) lors de la validation d'une tache.

Purpose: Feedback visuel riche et gratifiant quand l'utilisateur complete une tache — avatar emoji, nom, tache barree, compteur XP anime 0->N, barre de progression niveau, sparkles.
Output: Composant RewardCardToast + integration dans ToastContext + branchement dans tasks.tsx
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@contexts/ToastContext.tsx
@app/(tabs)/tasks.tsx
@lib/gamification/engine.ts (levelProgress, xpForLevel, calculateLevel exports)
@lib/gamification/rewards.ts (POINTS_PER_TASK = 10)
@packages/core/src/types.ts (Profile: id, name, avatar emoji, points, level)
@constants/spacing.ts (Spacing, Radius, Layout)
@constants/typography.ts (FontSize, FontWeight)

<interfaces>
<!-- Types cles pour l'executeur -->

From packages/core/src/types.ts:
```typescript
export interface Profile {
  id: string;
  name: string;
  avatar: string; // single emoji
  // ... points, level geres par gamification
}
```

From lib/gamification/engine.ts:
```typescript
export function levelProgress(points: number): number; // 0-1
export function calculateLevel(points: number): number;
export function xpForLevel(level: number): number; // XP cumule pour un niveau
export function pointsToNextLevel(points: number): number;
```

From contexts/ToastContext.tsx:
```typescript
type ToastType = 'success' | 'error' | 'info';
interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction, options?: ToastOptions) => void;
}
```

From app/(tabs)/tasks.tsx (handleTaskToggle, lignes 311-324):
```typescript
const { lootAwarded, pointsGained, effectCategoryId } = await completeTask(
  activeProfile, task.text,
  { tags: task.tags, section: task.section, sourceFile: task.sourceFile }
);
// Actuellement: showToast(`Bravo ${name} ! ${taskShort} -> +${pointsGained} pts`)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Creer RewardCardToast + etendre ToastContext</name>
  <files>components/gamification/RewardCardToast.tsx, contexts/ToastContext.tsx</files>
  <action>
1. **components/gamification/RewardCardToast.tsx** — Nouveau composant:

Props: `{ visible: boolean; data: RewardCardData | null; onDismiss: () => void }`

```typescript
interface RewardCardData {
  profileEmoji: string;   // avatar emoji du profil
  profileName: string;
  taskTitle: string;       // texte de la tache
  xpGained: number;        // points gagnes (ex: 10)
  currentXP: number;       // points totaux APRES gain
  levelProgress: number;   // 0-1 progression dans le niveau courant
  level: number;           // niveau actuel
  xpForNextLevel: number;  // XP total necessaire pour prochain niveau
  hasLoot: boolean;        // badge cadeau si loot
}
```

Animation (react-native-reanimated obligatoire):
- Position: bas de l'ecran (bottom: insets.bottom + Spacing.xl), full-width avec marges Spacing['2xl']
- Entree: translateY depuis +200 vers 0 avec `withSpring({ damping: 14, stiffness: 160 })` + opacity 0->1 `withTiming(250ms)`
- Layout carte: flexDirection row, backgroundColor colors.cardBg ou colors.successBg, borderRadius Radius.xl, padding Spacing.xl, shadow (Shadows.md), borderWidth 1 borderColor primary+'33'
  - Gauche: avatar emoji (fontSize 32) + nom profil en dessous (FontSize.label, FontWeight.medium)
  - Centre (flex 1):
    - Tache barree (textDecorationLine: 'line-through', FontSize.sm, opacity 0.7, numberOfLines 1)
    - Compteur XP anime: useSharedValue(0) -> xpGained avec withTiming(800ms, Easing.out(Easing.cubic)), affiche via useAnimatedProps sur un Text (ou useDerivedValue + useAnimatedStyle pour le formattage). Afficher "+{N} pts" en gras, FontSize['2xl'], couleur colors.success ou '#4CAF50' via useThemeColors().
    - Barre XP niveau: View container (height 6, borderRadius 3, backgroundColor colors.border), View fill interieur (backgroundColor primary) avec width animee de (levelProgress - xpGained/range) vers levelProgress via withTiming(600ms, delay 300ms). Afficher "Niv. {level}" a droite de la barre (FontSize.label).
  - Droite: si hasLoot, afficher badge emoji "🎁" (fontSize 24)
- Sparkles: 4 Animated.View (contenu Text "✨") positionnees en absolute autour de la carte. Au mount visible, chaque sparkle: translateX/Y aleatoire (40-80px) + opacity 1->0 + scale 1->0.3 via withTiming(700ms, delay aleatoire 0-200ms). Utiliser useSharedValue pour chaque sparkle.
- Dismiss: setTimeout 3000ms appelle onDismiss. Animation sortie: translateY vers +200 avec withSpring({ damping: 18, stiffness: 140 }) + opacity 1->0.
- Respecter useReducedMotion: si true, pas de spring, valeurs directes.

Utiliser UNIQUEMENT useThemeColors() pour les couleurs (jamais de hardcoded sauf les fallback emoji).

2. **contexts/ToastContext.tsx** — Etendre sans casser l'existant:

- Ajouter l'import de RewardCardToast et de RewardCardData.
- Ajouter un state: `const [rewardCard, setRewardCard] = useState<RewardCardData | null>(null)`.
- Ajouter shared values pour la reward card: `rewardTranslateY = useSharedValue(200)`, `rewardOpacity = useSharedValue(0)`.
- Ajouter fonction `showRewardCard(data: RewardCardData)` qui: set rewardCard state, anime les shared values (spring in), setTimeout 3000ms pour hideRewardCard.
- Ajouter fonction `hideRewardCard()` qui: anime spring out (translateY 200, opacity 0), apres 350ms setRewardCard(null).
- Exposer `showRewardCard` dans ToastContextValue (ajouter au type + au Provider value).
- Rendre `<RewardCardToast>` dans le JSX du Provider (apres le toast standard existant), passer visible={!!rewardCard}, data={rewardCard}, onDismiss={hideRewardCard}. NE PAS passer les shared values — le composant gere ses propres animations internes basees sur `visible`.
- Le toast standard existant (showToast) reste 100% inchange pour erreurs/info.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>RewardCardToast rend une carte animee avec avatar, tache barree, compteur XP anime, barre progression, sparkles. ToastContext expose showRewardCard() sans casser showToast().</done>
</task>

<task type="auto">
  <name>Task 2: Brancher showRewardCard dans handleTaskToggle</name>
  <files>app/(tabs)/tasks.tsx</files>
  <action>
Dans app/(tabs)/tasks.tsx:

1. Importer showRewardCard depuis useToast: `const { showToast, showRewardCard } = useToast();`
2. Importer `levelProgress, calculateLevel, xpForLevel` depuis `../../lib/gamification`.
3. Dans handleTaskToggle, lignes 320-324, remplacer le bloc `if (lootAwarded) { showToast(...) } else { showToast(...) }` par:

```typescript
// Calculer les donnees pour la reward card
const newPoints = (activeProfile.points ?? 0) + pointsGained;
const newLevel = calculateLevel(newPoints);
const progress = levelProgress(newPoints);
const nextLevelXP = xpForLevel(newLevel);

showRewardCard({
  profileEmoji: activeProfile.avatar,
  profileName: name,
  taskTitle: task.text,
  xpGained: pointsGained,
  currentXP: newPoints,
  levelProgress: progress,
  level: newLevel,
  xpForNextLevel: nextLevelXP,
  hasLoot: lootAwarded,
});
```

4. Ajouter `showRewardCard` dans le tableau de dependances du useCallback (ligne 356).
5. NE PAS toucher au `showToast(String(e), 'error')` du catch (ligne 352) — les erreurs restent sur l'ancien systeme.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>handleTaskToggle completed=true affiche la RewardCard au lieu du toast texte. Les toasts erreur restent inchanges.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelles erreurs
- Lancer l'app, completer une tache -> la carte reward slide-up depuis le bas avec avatar, tache barree, compteur XP anime, barre progression, sparkles
- Attendre ~3s -> la carte se dismiss avec spring out vers le bas
- Provoquer une erreur (ex: vault inaccessible) -> le toast erreur standard apparait en haut (inchange)
</verification>

<success_criteria>
- Validation tache = carte reward animee (slide-up spring, dismiss auto 3s)
- Compteur XP anime de 0 a +N pts
- Barre XP progression niveau animee
- 4 sparkles qui s'ejectent au pop
- Avatar emoji + nom profil + tache barree + badge loot si applicable
- Toasts erreur/info inchanges
- tsc --noEmit passe
</success_criteria>

<output>
After completion, create `.planning/quick/260415-wnf-impl-menter-option-b-reward-card-toast-p/260415-wnf-SUMMARY.md`
</output>
