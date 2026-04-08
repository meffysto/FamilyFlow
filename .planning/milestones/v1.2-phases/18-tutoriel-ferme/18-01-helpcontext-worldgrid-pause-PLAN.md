---
phase: 18-tutoriel-ferme
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - contexts/HelpContext.tsx
  - components/mascot/WorldGridView.tsx
autonomous: true
requirements: [TUTO-06, TUTO-08]
must_haves:
  truths:
    - "HelpContext expose activeFarmTutorialStep (number|null) et setActiveFarmTutorialStep via useHelp()"
    - "WorldGridView accepte prop paused?: boolean (défaut false)"
    - "Quand paused=true, les 2 setInterval (frame swap + whisper) sont gatés et les withRepeat sont stoppés via cancelAnimation"
    - "npx tsc --noEmit passe sans nouvelle erreur"
  artifacts:
    - path: "contexts/HelpContext.tsx"
      provides: "activeFarmTutorialStep state + setter"
      contains: "activeFarmTutorialStep"
    - path: "components/mascot/WorldGridView.tsx"
      provides: "paused prop pour geler animations"
      contains: "paused"
  key_links:
    - from: "contexts/HelpContext.tsx"
      to: "useHelp consumers"
      via: "HelpContextValue type"
      pattern: "setActiveFarmTutorialStep"
    - from: "components/mascot/WorldGridView.tsx"
      to: "withRepeat/setInterval animation sources"
      via: "paused in dependency arrays"
      pattern: "paused"
---

<objective>
Étendre l'infrastructure existante sans créer de nouveau provider : ajouter à HelpContext l'état session `activeFarmTutorialStep` (D-09) et ajouter à WorldGridView un prop `paused` qui gèle toutes les animations ambiantes (D-06). C'est le fondement câblé par toutes les autres plans de la phase 18.

Purpose: TUTO-06 (60fps pendant tutoriel) + TUTO-08 (pas de nouveau provider).
Output: 2 fichiers modifiés, compile clean.
</objective>

<context>
@.planning/phases/18-tutoriel-ferme/18-CONTEXT.md
@.planning/phases/18-tutoriel-ferme/18-RESEARCH.md
@CLAUDE.md
@contexts/HelpContext.tsx
@components/mascot/WorldGridView.tsx

<interfaces>
Additions requises sur HelpContextValue (D-09) :
```typescript
interface HelpContextValue {
  // ... champs existants (hasSeenScreen, markScreenSeen, resetScreen, isLoaded, etc.)
  activeFarmTutorialStep: number | null;
  setActiveFarmTutorialStep: (step: number | null) => void;
}
```

Additions sur WorldGridViewProps (D-06) :
```typescript
interface WorldGridViewProps {
  // ... props existants
  paused?: boolean;  // défaut false
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Étendre HelpContext avec activeFarmTutorialStep (D-09)</name>
  <files>contexts/HelpContext.tsx</files>
  <read_first>
    - contexts/HelpContext.tsx (fichier à modifier intégralement lu)
    - .planning/phases/18-tutoriel-ferme/18-RESEARCH.md section "HelpContext Extension — Détail technique"
  </read_first>
  <action>
    Ajouter exactement 2 éléments à HelpContext (D-09, minimal invasive) :

    1. Dans l'interface `HelpContextValue` (ou le type équivalent exposé), ajouter :
    ```typescript
    activeFarmTutorialStep: number | null;
    setActiveFarmTutorialStep: (step: number | null) => void;
    ```

    2. Dans `HelpProvider`, ajouter un nouveau useState :
    ```typescript
    const [activeFarmTutorialStep, setActiveFarmTutorialStep] = useState<number | null>(null);
    ```

    3. Ajouter les deux valeurs dans l'objet `value` (useMemo ou direct) retourné au Provider :
    ```typescript
    activeFarmTutorialStep,
    setActiveFarmTutorialStep,
    ```
    Si l'objet value est construit via useMemo, ajouter `activeFarmTutorialStep` aux dépendances. `setActiveFarmTutorialStep` est stable et n'a pas besoin d'être en deps.

    **NE PAS** :
    - Persister `activeFarmTutorialStep` dans SecureStore (c'est un état session in-memory, reset au restart)
    - Modifier l'API existante (hasSeenScreen, markScreenSeen, resetScreen, isLoaded, etc.)
    - Ajouter 'farm_tutorial' à SCREEN_IDS (screenId accepte string arbitraire)
    - Créer un nouveau provider (TUTO-08 : extension stricte)
  </action>
  <verify>
    <automated>grep -q "activeFarmTutorialStep" contexts/HelpContext.tsx &amp;&amp; grep -q "setActiveFarmTutorialStep" contexts/HelpContext.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep `activeFarmTutorialStep: number \| null` trouve la déclaration dans l'interface HelpContextValue
    - grep `useState&lt;number \| null&gt;\(null\)` trouve le state init
    - grep `setActiveFarmTutorialStep` trouve au moins 2 occurrences (state setter + value object)
    - `npx tsc --noEmit` exit code 0 (pas de nouvelle erreur TS introduite par ce fichier)
    - Aucune nouvelle clé SecureStore ajoutée (pas de nouvelle constante `HELP_*_KEY`)
  </acceptance_criteria>
  <done>HelpContext expose activeFarmTutorialStep et setter, tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Ajouter prop paused à WorldGridView et conditionner animations (D-06)</name>
  <files>components/mascot/WorldGridView.tsx</files>
  <read_first>
    - components/mascot/WorldGridView.tsx (lecture intégrale obligatoire)
    - .planning/phases/18-tutoriel-ferme/18-RESEARCH.md sections "Pause des animations WorldGridView" et "Pitfall 1 : Animations withRepeat qui continuent après paused=true"
  </read_first>
  <action>
    Ajouter un prop optionnel `paused?: boolean` (défaut `false`) à l'interface `WorldGridViewProps` et au composant `WorldGridView` (+ destructure `paused = false`).

    Conditionner TOUTES les sources d'animation ambiante identifiées dans RESEARCH.md :

    **Sources setInterval (2 occurrences) :**
    1. setInterval frame swap `sharedFrameIdx` (800ms) — ajouter `if (reducedMotion || paused) return;` en tête du useEffect ET ajouter `paused` au tableau de dépendances
    2. setInterval whisper `whisperCellId` (18000ms) — ajouter `if (paused) return;` en tête du useEffect ET ajouter `paused` au tableau de dépendances

    **Sources withRepeat (3+ occurrences) :** Pour chaque useEffect qui lance un `withRepeat(...)` (buildings idle, crop pulse, expansion pulse, etc.) :
    - Importer `cancelAnimation` depuis `react-native-reanimated` si pas déjà importé
    - Ajouter `paused` au tableau de dépendances du useEffect
    - Ajouter en tête du useEffect : `if (reducedMotion || paused) { cancelAnimation(sharedValueRef); return; }` (remplacer `sharedValueRef` par le nom réel du useSharedValue de l'animation)
    - Optionnel : après cancelAnimation, réinitialiser à la valeur neutre (ex. `sharedValueRef.value = 1` pour un scale) pour éviter freeze visuel sur frame intermédiaire
    - Exemple pattern :
    ```typescript
    useEffect(() => {
      if (reducedMotion || paused) {
        cancelAnimation(scaleSV);
        scaleSV.value = 1;
        return;
      }
      scaleSV.value = withRepeat(withTiming(1.1, { duration: 800 }), -1, true);
    }, [reducedMotion, paused, /* autres deps existantes */]);
    ```

    **Important :** Quand `paused` repasse à `false`, les useEffect se re-exécutent automatiquement grâce à la dep `paused`, et les animations reprennent.

    **NE PAS** :
    - Changer la signature publique autre que l'ajout du prop `paused`
    - Toucher à la logique métier (farm engine, crop growth, etc.)
    - Supprimer `reducedMotion` existant — juste ajouter `|| paused` à côté
  </action>
  <verify>
    <automated>grep -q "paused" components/mascot/WorldGridView.tsx &amp;&amp; grep -q "cancelAnimation" components/mascot/WorldGridView.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep `paused\?: boolean` ou `paused: boolean` trouve la déclaration de prop dans l'interface
    - grep `paused = false` ou équivalent destructure trouve la valeur par défaut
    - grep `cancelAnimation` trouve au moins 1 import et 1 appel (pour stopper les withRepeat)
    - grep compte `paused` au minimum 5 fois (prop + destructure + 2 setInterval guards + 3+ withRepeat guards)
    - `npx tsc --noEmit` exit code 0
    - Aucune nouvelle dépendance npm (ARCH-05)
  </acceptance_criteria>
  <done>WorldGridView accepte paused, les 2 setInterval et tous les withRepeat sont conditionnés par paused, cancelAnimation est appelé quand paused devient true.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelle erreur
- HelpContext expose `activeFarmTutorialStep` + setter
- WorldGridView accepte `paused` et conditionne ses animations
- Aucune nouvelle dépendance npm ajoutée
</verification>

<success_criteria>
- [ ] TUTO-06 câblé côté composant (WorldGridView peut être mis en pause)
- [ ] TUTO-08 respecté (pas de nouveau provider, HelpContext étendu)
- [ ] tsc clean
</success_criteria>

<output>
After completion, create `.planning/phases/18-tutoriel-ferme/18-01-helpcontext-worldgrid-pause-SUMMARY.md`
</output>
