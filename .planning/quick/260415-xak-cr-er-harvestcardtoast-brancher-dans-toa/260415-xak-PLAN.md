---
phase: quick-260415-xak
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/gamification/HarvestCardToast.tsx
  - contexts/ToastContext.tsx
autonomous: true
requirements: [HARVEST-TOAST]
must_haves:
  truths:
    - "1er tap affiche la carte harvest avec spring-in depuis le bas + sparkles + haptic"
    - "Taps suivants accumulent items (merge qty si meme emoji, nouveau chip sinon) + pulse + sparkles + timer reset 3s"
    - "Timer 3s ecoule -> dismiss spring vers le bas"
    - "Couleur accent = primary du theme actif (pas de vert hardcode)"
    - "Badge loot affiche si hasLoot=true"
  artifacts:
    - path: "components/gamification/HarvestCardToast.tsx"
      provides: "Carte harvest animee avec chips items, sparkles, timer bar"
      min_lines: 150
    - path: "contexts/ToastContext.tsx"
      provides: "showHarvestCard + logique accumulation dans ToastProvider"
      exports: ["showHarvestCard", "HarvestItem"]
  key_links:
    - from: "contexts/ToastContext.tsx"
      to: "components/gamification/HarvestCardToast.tsx"
      via: "import + render <HarvestCardToast> a cote de <RewardCardToast>"
      pattern: "HarvestCardToast"
---

<objective>
Creer HarvestCardToast — carte de recompense recolte animee avec accumulation live — et brancher dans ToastContext.

Purpose: Feedback visuel satisfaisant lors des recoltes (ferme/expedition) — la carte pop au 1er tap, accumule les items aux taps suivants, dismiss apres 3s d'inactivite.
Output: HarvestCardToast.tsx + ToastContext etendu avec showHarvestCard()
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/gamification/RewardCardToast.tsx
@contexts/ToastContext.tsx
@docs/harvest-card-mockup.html

<interfaces>
<!-- Patterns a reproduire depuis RewardCardToast.tsx -->

```typescript
// Spring constants (identiques)
const SPRING_IN = { damping: 26, stiffness: 200 } as const;
const SPRING_OUT = { damping: 28, stiffness: 180 } as const;

// Pattern Sparkle existant — reutiliser le meme composant interne
// Pattern animation : useSharedValue + useAnimatedStyle + withSpring/withTiming/withDelay
```

<!-- ToastContext — interface actuelle a etendre -->

```typescript
interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction, options?: ToastOptions) => void;
  showRewardCard: (data: RewardCardData) => void;
  // A ajouter : showHarvestCard
}
```

<!-- Design tokens disponibles -->
```typescript
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
// useThemeColors() => { primary, tint, colors, isDark }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tache 1 : Creer HarvestCardToast.tsx</name>
  <files>components/gamification/HarvestCardToast.tsx</files>
  <action>
Creer `components/gamification/HarvestCardToast.tsx` en suivant le pattern RewardCardToast.tsx :

**Type HarvestItem (exporte) :**
```typescript
export interface HarvestItem {
  emoji: string;
  label: string;
  qty: number;
}
```

**Props :**
- `visible: boolean` — controle entree/sortie spring
- `items: HarvestItem[]` — liste items accumules (geree par ToastContext)
- `onDismiss: () => void`
- `hasLoot?: boolean` — badge loot optionnel

**Constantes spring identiques a RewardCardToast :**
- `SPRING_IN = { damping: 26, stiffness: 200 }`
- `SPRING_OUT = { damping: 28, stiffness: 180 }`

**Structure carte (ref mockup HTML) :**
1. **Container** — position absolute, bottom: insets.bottom + Spacing['3xl'], left/right: Spacing['2xl'], zIndex 9999
2. **4 Sparkles** — reutiliser le pattern Sparkle de RewardCardToast (memes offsets/delays). Ajouter un prop `sparkleKey: number` pour re-trigger les sparkles a chaque merge (passer items.length ou un compteur)
3. **Card** — flexDirection column, backgroundColor colors.card (ou `primary + '12'` background subtil), border `primary + '33'`, borderRadius Radius.xl, padding Spacing.xl / Spacing['2xl']
4. **Header row** — emoji building generique (premier item emoji ou '📦'), titre "Recolte !", subtitle items.length > 1 ? "Recoltes en cours..." : "Recolte prete !", badge loot 🎁 si hasLoot
5. **Items chips (FlexWrap)** — chaque HarvestItem rendu comme chip : `{ emoji } x{qty}` — background `primary + '18'`, border `primary + '30'`, borderRadius Radius.md
6. **Timer bar** — hauteur 2px, track rgba fond, fill couleur `primary + '70'`, animation withTiming scaleX 1->0 en 3000ms linear. **Cle** : la timer bar doit etre resetable — utiliser un `timerKey` shared value ou state pour re-trigger

**Animations chips :**
- Nouveau chip : scale 0->1 avec withSpring (SPRING_IN) + withDelay base sur index
- Mise a jour qty (pulse) : scale 1->1.15->1 withSpring rapide. Detecter via useEffect sur item.qty ou un `pulseKey` incrementant

**Haptics :**
- `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` au pop initial (visible passe a true)
- `Haptics.selectionAsync()` a chaque merge (sparkleKey change)

**Couleurs CLAUDE.md :**
- `const { primary, tint, colors } = useThemeColors()` — JAMAIS de vert hardcode
- Accent chips/timer = `primary`, texte = `colors.text`, subtexte = `colors.textSub`

**Animation entree/sortie (identique RewardCardToast) :**
- Entree : translateY 200->0 withSpring(SPRING_IN), opacity 0->1 withTiming 250ms
- Sortie : translateY 0->200 withSpring(SPRING_OUT), opacity 1->0 withTiming 250ms
- Support reduceMotion : assignation directe sans animation

**Timer bar reset :**
- Utiliser un `timerProgress` useSharedValue(1) — quand visible ou sparkleKey change, reset a 1 puis withTiming vers 0 en 3000ms linear
- La barre affiche `width: timerProgress * 100%`
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -i "HarvestCard" || echo "Pas d'erreur HarvestCardToast"</automated>
  </verify>
  <done>HarvestCardToast.tsx existe, exporte HarvestItem + HarvestCardToast, compile sans erreur TS, memes spring constants que RewardCardToast, couleurs via useThemeColors()</done>
</task>

<task type="auto">
  <name>Tache 2 : Brancher HarvestCardToast dans ToastContext</name>
  <files>contexts/ToastContext.tsx</files>
  <action>
Modifier `contexts/ToastContext.tsx` pour integrer le systeme harvest :

**1. Imports :**
```typescript
import { HarvestCardToast } from '../components/gamification/HarvestCardToast';
import type { HarvestItem } from '../components/gamification/HarvestCardToast';
```

**2. Re-exporter HarvestItem** depuis le fichier (pour que les consommateurs importent depuis ToastContext) :
```typescript
export type { HarvestItem } from '../components/gamification/HarvestCardToast';
```

**3. Etendre ToastContextValue :**
```typescript
interface ToastContextValue {
  showToast: (...) => void;
  showRewardCard: (data: RewardCardData) => void;
  showHarvestCard: (item: HarvestItem, hasLoot?: boolean) => void;  // NOUVEAU
}
```

**4. Default context** : ajouter `showHarvestCard: () => {}` dans le createContext.

**5. State dans ToastProvider :**
```typescript
const [harvestItems, setHarvestItems] = useState<HarvestItem[]>([]);
const [harvestVisible, setHarvestVisible] = useState(false);
const [harvestHasLoot, setHarvestHasLoot] = useState(false);
const [harvestSparkleKey, setHarvestSparkleKey] = useState(0);
const harvestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**6. hideHarvestCard callback :**
- Clear harvestTimerRef
- setHarvestVisible(false)
- setTimeout(() => { setHarvestItems([]); setHarvestHasLoot(false); }, 400) — delai pour laisser l'animation de sortie

**7. showHarvestCard callback :**
```typescript
const showHarvestCard = useCallback((item: HarvestItem, hasLoot?: boolean) => {
  // Clear timer precedent
  if (harvestTimerRef.current) clearTimeout(harvestTimerRef.current);

  // Merge items
  setHarvestItems(prev => {
    const existing = prev.find(i => i.emoji === item.emoji);
    if (existing) {
      return prev.map(i => i.emoji === item.emoji ? { ...i, qty: i.qty + item.qty } : i);
    }
    return [...prev, item];
  });

  if (hasLoot) setHarvestHasLoot(true);

  // Afficher si pas encore visible
  if (!harvestVisible) setHarvestVisible(true);

  // Incrementer sparkleKey pour re-trigger sparkles+pulse
  setHarvestSparkleKey(k => k + 1);

  // Reset timer 3s
  harvestTimerRef.current = setTimeout(() => {
    hideHarvestCard();
    harvestTimerRef.current = null;
  }, 3000);
}, [harvestVisible, hideHarvestCard]);
```

**8. Provider value** : ajouter `showHarvestCard` dans l'objet value.

**9. Render** : Ajouter `<HarvestCardToast>` juste apres `<RewardCardToast>` :
```tsx
<HarvestCardToast
  visible={harvestVisible}
  items={harvestItems}
  onDismiss={hideHarvestCard}
  hasLoot={harvestHasLoot}
  sparkleKey={harvestSparkleKey}
/>
```

**Note :** Ajouter `sparkleKey` comme prop optionnel dans HarvestCardToast si pas deja prevu dans Tache 1 — c'est le signal pour re-trigger sparkles et pulse animations lors d'un merge.
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -c "error" || echo "0 erreurs"</automated>
  </verify>
  <done>ToastContext expose showHarvestCard(), accumulation merge fonctionne (meme emoji = additionner qty, nouveau emoji = nouveau chip), timer 3s reset a chaque appel, HarvestCardToast rendu dans le provider</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans erreur nouvelle
- HarvestCardToast.tsx utilise SPRING_IN/SPRING_OUT identiques a RewardCardToast
- Aucune couleur hardcodee — tout via useThemeColors()
- HarvestItem exporte et accessible via ToastContext
- showHarvestCard merge items (additionne qty si meme emoji)
- Timer 3s avec reset a chaque appel
</verification>

<success_criteria>
- HarvestCardToast.tsx cree avec chips items animes, sparkles, timer bar, haptics
- ToastContext.tsx etendu avec showHarvestCard() + logique accumulation
- `npx tsc --noEmit` passe
- Couleurs dynamiques via primary/tint du theme actif
</success_criteria>

<output>
After completion, create `.planning/quick/260415-xak-cr-er-harvestcardtoast-brancher-dans-toa/260415-xak-01-SUMMARY.md`
</output>
