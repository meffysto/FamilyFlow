# Phase 18: Tutoriel ferme — Research

**Researched:** 2026-04-08
**Domain:** React Native / Reanimated coach-mark overlay + HelpContext extension + WorldGridView animation pause
**Confidence:** HIGH (all findings from direct code inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Format mixte 5 étapes)** : Étape 1 → carte narrative plein écran. Étapes 2-4 → coach marks classiques (bulle + cutout spotlight). Étape 5 → carte narrative plein écran finale.
- **D-02 (Cible étape 1)** : Sprite arbre mascotte du profil actif depuis `assets/garden/trees/{fruit_id}/` (via mapping `SPECIES_TO_FRUIT`). Fallback emoji 🌳 si espèce absente.
- **D-03 (Cible étape 5)** : Grand emoji 📖 + texte FR pointant vers le bouton livre du HUD. Pas d'ouverture automatique du codex.
- **D-04 (Tutoriel passif)** : Chaque étape = lire + taper "Suivant". Aucune action réelle requise.
- **D-04bis (Bouton "Passer")** : Visible à toutes les étapes 1-5. Tap → `markScreenSeen('farm_tutorial')` immédiatement + fermeture overlay + réactivation animations.
- **D-05 (Rectangle arrondi)** : Cutout des étapes 2-4 = rectangle arrondi. Étendre `CoachMarkOverlay` avec `borderRadius?: number`. Approche technique (4-Views + corners ou View unique borderWidth épais) à la discrétion de l'implémenteur.
- **D-05bis (Pas de SVG)** : Rejeter `react-native-svg` `<Mask>` pour le cutout. `CoachMarkOverlay` existant en 4-Views sans dépendance SVG.
- **D-06 (Prop `paused` explicite)** : `WorldGridView` reçoit `paused?: boolean` (défaut `false`). Quand `true` : gèle `frameIdx`, `whisperCellId`, et saute les `withRepeat`/`withTiming` pour animations ambiantes (buildings idle, crop pulse, expansion pulse).
- **D-06bis (Source de vérité)** : `tree.tsx` pilote le `paused` via `activeFarmTutorialStep !== null` depuis `useHelp()`.
- **D-07 (Nouveau composant `FarmTutorialOverlay`)** : Créer `components/mascot/FarmTutorialOverlay.tsx` (préférence `components/mascot/`). Orchestrateur avec state local `currentStep`. Se monte dans `tree.tsx` au niveau absolu au-dessus du HUD.
- **D-08 (Pas de réécriture de ScreenGuide)** : `ScreenGuide.tsx` reste inchangé. `FarmTutorialOverlay` est un nouveau composant sibling.
- **D-09 (Minimal invasive sur HelpContext)** : Deux ajouts uniquement : `activeFarmTutorialStep: number | null` + setter `setActiveFarmTutorialStep: (step: number | null) => void`.
- **D-10 (Namespace `help`)** : Clés i18n sous `help.farm_tutorial.*` avec parité FR+EN obligatoire.

### Claude's Discretion

- Durée d'animation entrée/sortie des cartes narratives (recommandation : spring damping 12, stiffness 140)
- Position finale et offset des bulles coach mark étapes 2-4 (above/below selon espace)
- Padding autour du cutout (défaut 8 comme `CoachMarkOverlay` actuel)
- Approche technique rectangle arrondi dans `CoachMarkOverlay`
- Placement exact de `FarmTutorialOverlay` dans `tree.tsx`
- Gestion du cas "profil sans arbre choisi" (fallback arbre défaut ou emoji 🌳)
- Délai avant déclenchement (réutiliser 600ms de `ScreenGuide`)

### Deferred Ideas (OUT OF SCOPE)

- Tutoriel interactif (attente plantation/récolte réelle)
- Spotlight circulaire SVG
- Ouverture automatique du codex à l'étape 5
- Tutoriels supplémentaires sur d'autres écrans
- Narration vocale TTS
- Animation d'entrée ludique de l'arbre sur l'étape 1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TUTO-01 | Premier affichage écran ferme → tutoriel se déclenche automatiquement | `HelpContext.hasSeenScreen('farm_tutorial')` + `isLoaded` guard dans `FarmTutorialOverlay` — pattern `ScreenGuide` identique |
| TUTO-02 | Flag persisté globalement par appareil via `HelpContext.markScreenSeen('farm_tutorial')` | `HelpContext.markScreenSeen` existe, accepte string arbitraire, persiste en SecureStore via `HELP_SCREENS_KEY` JSON |
| TUTO-03 | 5 étapes ordonnées : intro narrative, plantation, cycle croissance/récolte, gain XP/loot, où aller plus loin | State `currentStep: 0..4` dans `FarmTutorialOverlay`. Étapes 1,5 = carte narrative. Étapes 2,3,4 = CoachMark + CoachMarkOverlay étendu |
| TUTO-04 | Overlay spotlight cutout rectangle arrondi autour des cibles étapes 2-4 | Étendre `CoachMarkOverlay` avec `borderRadius` prop. Cibles mesurées via `measureInWindow` (pattern `ScreenGuide`) |
| TUTO-05 | Bouton "Passer" à tout moment → flag vu positionné immédiatement | Prop `onSkip` sur `FarmTutorialOverlay` : `markScreenSeen` + `setActiveFarmTutorialStep(null)` + step=-1 |
| TUTO-06 | Animations WorldGridView mises en pause pendant tutoriel ≥ 58 fps | Nouveau prop `paused` sur `WorldGridView` gate le `setInterval` frame + `setInterval` whisper + useEffect `withRepeat` dans `BuildingIdleAnim` et `NextExpansionCell` |
| TUTO-07 | Rejouable depuis codex (CODEX-10) | `FarmCodexModal.handleReplayTutorial` appelle déjà `resetScreen('farm_tutorial')`. `FarmTutorialOverlay` surveille `hasSeenScreen('farm_tutorial')` via `useEffect [seen]` et reset `hasStarted.current = false` — pattern identique à `ScreenGuide` |
| TUTO-08 | Aucun nouveau provider — HelpContext étendu exclusivement | `HelpContext` reçoit `activeFarmTutorialStep` + setter. Pile providers reste à 8 niveaux |
</phase_requirements>

---

## Summary

La Phase 18 est une extension chirurgicale de l'infrastructure d'aide existante (`HelpContext`, `CoachMark`, `CoachMarkOverlay`, `ScreenGuide`) pour créer un nouveau composant orchestrateur `FarmTutorialOverlay` spécifique à l'écran ferme.

Tout le code nécessaire existe déjà : `HelpContext` accepte des `screenId` arbitraires (string générique, pas d'enum fermé), `CoachMark` a déjà un bouton "Passer" intégré (`onDismiss` avec label `coachMark.skip`), `CoachMarkOverlay` est prêt à recevoir `borderRadius`, et `ScreenGuide` donne le patron exact d'orchestration (mesure cibles, séquence, fallback, reset au `resetScreen`). La seule partie absente est : (1) les deux ajouts à `HelpContext`, (2) le prop `paused` sur `WorldGridView`, et (3) le composant `FarmTutorialOverlay` lui-même.

Le risque principal identifié est la **gestion de la pause des animations** dans `WorldGridView` : les animations `withRepeat` lancées dans des `useEffect` continuent à tourner tant que le composant est monté. Il faut utiliser `cancelAnimation` de Reanimated ou conditionner les `withRepeat` au prop `paused`, et les deux `setInterval` (frame swap + whisper) doivent être clearés/conditionnés.

**Recommandation principale :** Découper en 4 plans : (1) extension HelpContext + prop `paused` WorldGridView, (2) extension `CoachMarkOverlay` borderRadius, (3) composant `FarmTutorialOverlay` + textes i18n, (4) intégration `tree.tsx` + validation manuelle.

---

## File Inventory

### Fichiers à modifier

| Fichier | Changement | Effort |
|---------|-----------|--------|
| `contexts/HelpContext.tsx` | Ajouter `activeFarmTutorialStep: number \| null` + setter dans le state/value/type | Faible (< 20 lignes) |
| `components/mascot/WorldGridView.tsx` | Ajouter prop `paused?: boolean`, conditionner les 2 `setInterval` + `withRepeat` dans `BuildingIdleAnim` + `CropCell` + `NextExpansionCell` | Moyen (lecture des ~6 animations à conditionner) |
| `components/help/CoachMarkOverlay.tsx` | Ajouter prop `borderRadius?: number` (défaut 0) — implémentation technique cutout arrondi | Moyen (logique cutout à repenser) |
| `locales/fr/help.json` | Ajouter section `farm_tutorial` avec clés step1..5 + skip/next/done | Faible |
| `locales/en/help.json` | Parité obligatoire FR/EN — mêmes clés | Faible |
| `app/(tabs)/tree.tsx` | Monter `<FarmTutorialOverlay />`, passer `paused={activeFarmTutorialStep !== null}` à `<WorldGridView />` | Faible (2 insertions) |

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `components/mascot/FarmTutorialOverlay.tsx` | Orchestrateur principal du tutoriel 5 étapes (carte narrative + coach marks) |

### Fichiers à NE PAS modifier

| Fichier | Raison |
|---------|--------|
| `components/help/ScreenGuide.tsx` | D-08 : patron de référence, inchangé |
| `components/help/CoachMark.tsx` | Déjà un bouton "Passer" via `onDismiss` + `coachMark.skip`. Réutilisable sans modification — voir note ci-dessous |
| `components/mascot/FarmCodexModal.tsx` | `handleReplayTutorial` appelle déjà `resetScreen('farm_tutorial')` + `onClose`. Phase 18 rend cet appel fonctionnel côté `tree.tsx` sans modifier la modale |

---

## Architecture Patterns

### Patron d'orchestration (copié de ScreenGuide)

`FarmTutorialOverlay` duplique la structure de `ScreenGuide` :

```typescript
// Source: components/help/ScreenGuide.tsx (référence directe)
const hasStarted = useRef(false);
const seen = hasSeenScreen('farm_tutorial');

// Reset quand resetScreen() est appelé depuis FarmCodexModal
useEffect(() => {
  if (!seen) { hasStarted.current = false; }
}, [seen]);

// Déclenchement initial (600ms délai — constante ScreenGuide)
useEffect(() => {
  if (!isLoaded || hasStarted.current || seen) return;
  hasStarted.current = true;
  const timer = setTimeout(() => { /* mesurer + démarrer */ }, 600);
  return () => clearTimeout(timer);
}, [isLoaded, seen]);
```

### Format mixte (discriminated union)

```typescript
type TutorialStep =
  | { kind: 'narrative'; index: 0 | 4 }   // étapes 1 et 5
  | { kind: 'coachmark'; index: 1 | 2 | 3; targetRef: React.RefObject<View | null> };
```

### Mesure des cibles (measureInWindow)

Même fonction que `ScreenGuide` :
```typescript
// Source: components/help/ScreenGuide.tsx
function measureTarget(ref: React.RefObject<View | null>): Promise<TargetRect | null> {
  return new Promise((resolve) => {
    if (!ref.current) { resolve(null); return; }
    ref.current.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) { resolve(null); return; }
      resolve({ x, y, width, height });
    });
  });
}
```

### Pause des animations WorldGridView

Les animations à conditionner (trouvées par inspection du code) :

```typescript
// Pattern à appliquer pour chaque withRepeat dans WorldGridView
useEffect(() => {
  if (reducedMotion || paused) return;  // ← ajouter || paused
  // ... withRepeat(...)
}, [reducedMotion, paused, buildingId]);  // ← ajouter paused

// setInterval frame swap
useEffect(() => {
  if (reducedMotion || paused) return;  // ← conditionner
  const timer = setInterval(() => setSharedFrameIdx(i => 1 - i), 800);
  return () => clearInterval(timer);
}, [reducedMotion, paused]);  // ← ajouter paused

// setInterval whisper
useEffect(() => {
  if (paused) return;  // ← conditionner
  const timer = setInterval(() => { /* ... */ }, 18000);
  return () => clearInterval(timer);
}, [allCropCells, paused]);  // ← ajouter paused
```

**Important :** Quand `paused` repasse à `false`, les `useEffect` se re-exécutent automatiquement grâce à la dépendance `paused` dans le tableau — les animations reprennent sans reset explicite.

### Sprite arbre pour illustration étape 1

La `TreeSpecies` du profil (`cerisier`, `chene`, `bambou`, `oranger`, `palmier`) mappe vers un `fruit_id` via `SPECIES_TO_FRUIT` dans `TreeView.tsx` :

```typescript
// Source: components/mascot/TreeView.tsx
const SPECIES_TO_FRUIT: Record<TreeSpecies, string> = {
  cerisier: 'peach',
  chene:    'apple_red',
  oranger:  'orange',
  bambou:   'plum',
  palmier:  'pear',
};
// Sprite : assets/garden/trees/{fruitId}/{season}_{size}.png
// Ex : assets/garden/trees/peach/spring_3.png
```

`FarmTutorialOverlay` doit importer `SPECIES_TO_FRUIT` depuis `TreeView` (ou dupliquer la constante localement) pour résoudre le sprite de l'étape 1. La saison courante est disponible via `getCurrentSeason()`.

---

## HelpContext Extension — Détail technique

### État actuel de HelpContext

- State : `seenScreens: Set<string>` + `installedTemplates: Set<string>` + `isLoaded: boolean`
- API exposée : `hasSeenScreen`, `markScreenSeen`, `resetAllHints`, `resetScreen`, `isLoaded`, `isTemplateInstalled`, `markTemplateInstalled`
- Stockage : SecureStore `help_screens_v1` (JSON consolidé)
- `screenId` = string générique — `'farm_tutorial'` n'a pas besoin d'être ajouté à `SCREEN_IDS` (ce tableau sert uniquement à la migration legacy)

### Ajouts requis (D-09)

```typescript
// Dans HelpContextValue interface (contexts/HelpContext.tsx)
activeFarmTutorialStep: number | null;
setActiveFarmTutorialStep: (step: number | null) => void;

// Dans HelpProvider state
const [activeFarmTutorialStep, setActiveFarmTutorialStep] = useState<number | null>(null);

// Dans la value useMemo (ajouter les deux)
activeFarmTutorialStep,
setActiveFarmTutorialStep,
```

Pas de persistance SecureStore pour `activeFarmTutorialStep` — c'est un état de session in-memory uniquement. Il reset à `null` à chaque redémarrage de l'app (comportement souhaité).

---

## CoachMarkOverlay Extension — Approche rectangle arrondi

### Contrainte

La technique actuelle (4 Views rectangulaires haut/bas/gauche/droite) ne peut pas exprimer des coins arrondis sur la zone de découpe sans artefacts visuels (chevauchement des coins).

### Deux approches valides (D-05 : Claude's Discretion)

**Option A — 4 Views + 4 vues coin arrondies :**
- Les 4 vues existantes couvrent les bords droits
- 4 petites vues `position: absolute` aux coins avec `borderRadius` sur le coin concerné et `overflow: hidden` pour masquer le fond du corner
- Complexe, fragile aux changements de taille

**Option B — View unique avec borderWidth ultra-épais :**
```typescript
// Zone cutout rendue comme une View unique avec bordure épaisse
<View style={{
  position: 'absolute',
  left: cutout.x,
  top: cutout.y,
  width: cutout.width,
  height: cutout.height,
  borderRadius: borderRadius,
  borderWidth: Math.max(screenWidth, screenHeight),  // couvre tout l'écran
  borderColor: OVERLAY_COLOR,
  // Problème : overflow clip coupe la bordure sur les bords de l'écran
}} />
```
Cette option a un problème de clipping aux bords si `overflow: hidden` est activé.

**Option C — Recommandée : View unique avec `box-shadow` outset :**
React Native ne supporte pas `box-shadow` outset côté JS. Pas viable.

**Option D — Recommandée : overlay background + hole via View interne :**
```typescript
// Fond semi-transparent full-screen
<View style={StyleSheet.absoluteFill, { backgroundColor: OVERLAY_COLOR }}>
  {/* "Trou" : View transparente qui efface le fond via backgroundColor: 'transparent' */}
  {/* Sauf que ça ne fonctionne pas — backgroundColor transparent ne perce pas le parent */}
</View>
```
Pas viable avec Views React Native standard.

**Option E — Recommandée (la plus propre en pratique) :**
Conserver les 4 Views rectangulaires pour les bords principaux + une 5ème View centrée exactement sur le cutout avec `borderRadius` et `backgroundColor: 'transparent'` mais avec `borderWidth: 0` — non, ça ne fonctionne pas non plus.

**Verdict pratique :** Option B avec une technique de borderWidth géant reste la plus simple. Le problème de clipping aux bords peut être évité en ajoutant `overflow: visible` (défaut sur React Native View) et en s'assurant que la View parente ne clamp pas. La seule limitation est que les quatre bords de la "bordure" dépasseront du viewport, ce qui est invisible à l'utilisateur. **L'implémenteur doit tester Option B en premier sur device.**

Nouveau prop sur `CoachMarkOverlay` :
```typescript
interface CoachMarkOverlayProps {
  targetRect: TargetRect;
  onPress: () => void;
  padding?: number;
  borderRadius?: number;  // ← nouveau, défaut 0 pour rétrocompat
}
```

---

## CoachMark — Compatibilité "Passer"

`CoachMark.tsx` a **déjà** un bouton "Passer" via `onDismiss` avec le label `t('coachMark.skip')` = "Passer". La clé `coachMark.skip` existe dans `locales/fr/common.json` (ligne 2422).

`FarmTutorialOverlay` peut passer `onDismiss={handleSkip}` directement à `<CoachMark>`. **Aucune modification de CoachMark.tsx n'est nécessaire.**

---

## i18n — Structure des clés

### Namespace et séparateur

- `defaultNS = 'common'`, `ns` inclut `'help'`
- Pour accéder au namespace `help` : `t('help:farm_tutorial.step1.title')` (séparateur `:` comme pour `codex:`)
- Note Phase 17 (STATE.md) : le séparateur namespace est `:` pas `.` — appliquer à tous les appels `t()` de `FarmTutorialOverlay`

### Clés à créer dans `locales/fr/help.json` et `locales/en/help.json`

```json
{
  "farm_tutorial": {
    "step1": { "title": "Bienvenue à la ferme !", "body": "..." },
    "step2": { "title": "Plante ta première culture", "body": "..." },
    "step3": { "title": "Le cycle de croissance", "body": "..." },
    "step4": { "title": "Récolte et gains XP", "body": "..." },
    "step5": { "title": "Et ensuite ?", "body": "..." },
    "skip": "Passer",
    "next": "Suivant",
    "done": "C'est parti !"
  }
}
```

---

## Intégration tree.tsx

### Où monter FarmTutorialOverlay

Le rendu de `tree.tsx` utilise une `ScrollView` contenant un diorama + des cartes sous-jacentes. Le HUD est en `position: absolute` à `zIndex: 10` avec `top: insets.top`. La `FarmCodexModal` et autres modals sont montés hors de la `ScrollView`.

`FarmTutorialOverlay` doit être monté **après le diorama, au même niveau que les autres modals** dans le JSX, et être lui-même en `position: absolute` via `StyleSheet.absoluteFill` avec un `zIndex` supérieur au HUD (>10, recommandé 50+).

Les refs pour `measureInWindow` sur les cibles des étapes 2-4 doivent être créées dans `tree.tsx` et passées comme props à `FarmTutorialOverlay`. Les cibles à identifier :
- **Étape 2 (plantation)** : Un plot de culture vide dans `WorldGridView`. Problème : `WorldGridView` n'expose pas de ref vers ses cellules internes. Le tutoriel doit soit (a) utiliser une ref sur le conteneur `WorldGridView` comme approximation, soit (b) mesurer un élément proche dans le HUD.
- **Étape 3 (récolte)** : Idem — culture mûre non accessible par ref directe.
- **Étape 4 (XP/loot)** : Le HUD affiche XP/coins via des `View` non-ref-forwarded dans `tree.tsx` inline.

**Contrainte identifiée :** `WorldGridView` est un composant complexe sans `forwardRef` ni exposition de refs internes. Les étapes 2-4 ne peuvent pas mesurer des cellules individuelles depuis `tree.tsx`. **Solution recommandée :** créer des refs dans `tree.tsx` sur des éléments du HUD ou du diorama container comme cibles approximatives, ou exposer des `ref` sur le container `WorldGridView` via `View` ref + `forwardRef`. L'étape 2 peut pointer le container entier du diorama (la "zone ferme") comme cible générique.

### Props à passer

```tsx
// tree.tsx
const { activeFarmTutorialStep, setActiveFarmTutorialStep } = useHelp();

// Dans le JSX
<WorldGridView
  // ... props existants ...
  paused={activeFarmTutorialStep !== null}  // ← nouveau
/>

<FarmTutorialOverlay
  profile={profile}
  season={season}
  // refs vers cibles si disponibles
/>
```

---

## Common Pitfalls

### Pitfall 1 : Animations withRepeat qui continuent après paused=true

**Ce qui va mal :** Passer `paused=true` n'arrête pas une animation `withRepeat` déjà lancée par un `useEffect` précédent. La boucle continue sur le JS thread.
**Pourquoi :** `withRepeat` est déclenché dans le `useEffect` une seule fois. Changer `paused` ne re-exécute pas le `useEffect` si `paused` n'est pas dans les dépendances.
**Comment éviter :** Ajouter `paused` dans le tableau de dépendances des `useEffect` qui lancent des `withRepeat`. Quand `paused=true`, le `useEffect` se re-exécute mais le `if (reducedMotion || paused) return` empêche la relance. Il faut aussi appeler `cancelAnimation(sharedValue)` explicitement avant le return pour stopper l'animation en cours.
**Signe d'alerte :** Animations qui continuent à jouer pendant le tutoriel en testant sur device.

### Pitfall 2 : hasStarted.current ne se reset pas après resetScreen

**Ce qui va mal :** Le bouton "Rejouer le tutoriel" appelle `resetScreen('farm_tutorial')` → `seenScreens` se vide → `seen = false` → mais `hasStarted.current` reste `true` → le tutoriel ne se relance pas.
**Pourquoi :** Pattern oublié de `ScreenGuide`.
**Comment éviter :** Copier exactement le `useEffect([seen])` de `ScreenGuide` :
```typescript
useEffect(() => {
  if (!seen) { hasStarted.current = false; }
}, [seen]);
```

### Pitfall 3 : measureInWindow retourne 0,0,0,0 sur les cibles WorldGridView

**Ce qui va mal :** Les cellules individuelles de `WorldGridView` ne sont pas accessibles via ref depuis `tree.tsx`.
**Pourquoi :** `WorldGridView` est un composant opaque sans forwarding de refs internes.
**Comment éviter :** Utiliser des refs sur des éléments du `tree.tsx` lui-même (container diorama, items HUD) comme cibles approximatives pour les étapes 2-4. Documenter que les highlights sont "sur la zone" et non "sur la cellule exacte".

### Pitfall 4 : Namespace i18n avec point au lieu de deux-points

**Ce qui va mal :** `t('help.farm_tutorial.step1.title')` retourne la clé au lieu du texte.
**Pourquoi :** `defaultNS = 'common'`, donc `help` est interprété comme une clé dans `common.json` et non comme un namespace.
**Comment éviter :** Toujours utiliser `t('help:farm_tutorial.step1.title')` (séparateur `:` pour les namespaces non-default). Vérifier dans `lib/i18n.ts` : `defaultNS: 'common'`.

### Pitfall 5 : TreeSpecies vers sprite arbre pour étape 1

**Ce qui va mal :** Utiliser directement `profile.species` (ex. `'cerisier'`) comme chemin vers les sprites → chemin `assets/garden/trees/cerisier/` inexistant.
**Pourquoi :** Les sprites sont nommés par fruit (`peach`, `apple_red`, etc.), pas par espèce.
**Comment éviter :** Toujours passer par `SPECIES_TO_FRUIT[profile.species]` importé de (ou dupliqué depuis) `TreeView.tsx`.

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser | Pourquoi |
|----------|------------------|----------|----------|
| Mesure position éléments | Custom layout système | `ref.current.measureInWindow()` | Pattern `ScreenGuide` déjà validé |
| Animation fade-in overlay | Interpolation manuelle | `withTiming(1, { duration: 200 })` sur `useSharedValue(0)` | `CoachMarkOverlay` existant |
| Spring entrée bulle | Calcul manuel | `withSpring(0, { damping: 15, stiffness: 150, mass: 0.8 })` | `CoachMark.tsx` existant |
| Cutout spotlight | SVG Mask + react-native-svg | 4-Views + borderRadius (D-05bis) | Décision locked — pas de SVG |
| Persistance flag vu | AsyncStorage custom | `HelpContext.markScreenSeen()` | Infrastructure SecureStore existante |
| Feedback tactile | Custom vibration | `Haptics.selectionAsync()` | Convention CLAUDE.md |

---

## State of the Art

| Ancien pattern | Pattern Phase 18 | Impact |
|----------------|-----------------|--------|
| `ScreenGuide` : coach marks uniformes, une seule forme | `FarmTutorialOverlay` : format mixte carte narrative + coach mark | Expérience narrative plus riche pour la ferme |
| `CoachMarkOverlay` : cutout rectangulaire strict | `CoachMarkOverlay` avec `borderRadius` optionnel | Plus esthétique pour les cibles pixel-art |
| `WorldGridView` : animations toujours actives | `WorldGridView` avec prop `paused` | Performance garantie pendant le tutoriel |

---

## Environment Availability

Step 2.6: SKIPPED (pas de dépendances externes nouvelles — toutes les libs requises déjà installées : `react-native-reanimated`, `expo-haptics`, `expo-secure-store`, `react-i18next`).

---

## Open Questions

1. **Refs vers cibles étapes 2-4**
   - Ce qu'on sait : `WorldGridView` n'expose pas de refs vers ses cellules internes. Les éléments HUD (`<View style={styles.hudItem}>`) sont des Views non-ref dans `tree.tsx`.
   - Ce qui est flou : Quelle est la meilleure cible approximative pour chaque étape ? Le diorama container entier pour étape 2 ? Le 1er hudItem (🍃 coins) pour étape 4 ?
   - Recommandation : Le planner doit décider si on ajoute `ref` aux `<View style={styles.hudItem}>` dans `tree.tsx` pour avoir des cibles précises, ou si on utilise des positions fixes relatives au screen pour les coach marks des étapes 2-4. La décision affecte la tâche "intégration tree.tsx".

2. **Import SPECIES_TO_FRUIT pour étape 1**
   - Ce qu'on sait : `SPECIES_TO_FRUIT` est déclaré localement dans `TreeView.tsx` (non exporté).
   - Recommandation : Soit exporter `SPECIES_TO_FRUIT` depuis `TreeView.tsx` dans la tâche de `FarmTutorialOverlay`, soit dupliquer les 5 entrées localement dans `FarmTutorialOverlay`. La duplication est plus simple.

3. **cancelAnimation explicite pour WorldGridView**
   - Ce qu'on sait : `withRepeat` en cours ne s'arrête pas automatiquement quand les dépendances du `useEffect` changent.
   - Recommandation : Appeler `cancelAnimation(sharedValue)` suivi de `sharedValue.value = defaultValue` dans la branche `if (paused) return`. Ceci réinitialise l'animation à son état neutre (scale=1, rotation=0) pour éviter un freeze visuel sur une frame intermédiaire.

---

## Sources

### Primary (HIGH confidence)
- Code source direct : `contexts/HelpContext.tsx` — API complète, stockage SecureStore, pattern reset
- Code source direct : `components/help/CoachMark.tsx` — API props, animations, bouton Passer existant
- Code source direct : `components/help/CoachMarkOverlay.tsx` — technique 4-Views, API à étendre
- Code source direct : `components/help/ScreenGuide.tsx` — patron complet à dupliquer
- Code source direct : `components/mascot/WorldGridView.tsx` — toutes les animations (buildingIdle, cropPulse, frameSwap, whisper, expansionPulse)
- Code source direct : `app/(tabs)/tree.tsx` — structure render, HUD, WorldGridView props, showCodex state
- Code source direct : `components/mascot/FarmCodexModal.tsx` — `handleReplayTutorial` confirmé
- Code source direct : `lib/i18n.ts` — `defaultNS: 'common'`, namespaces `['common', 'gamification', 'help', 'insights', 'skills', 'codex']`
- Code source direct : `locales/fr/help.json` + `locales/en/help.json` — structure actuelle sans `farm_tutorial`
- Code source direct : `components/mascot/TreeView.tsx` — `SPECIES_TO_FRUIT` mapping (non exporté)

### Secondary (MEDIUM confidence)
- `.planning/phases/18-tutoriel-ferme/18-CONTEXT.md` — toutes les décisions D-01..D-10 verrouillées par l'utilisateur

---

## Metadata

**Confidence breakdown:**
- File inventory : HIGH — inspection directe de tous les fichiers concernés
- Architecture patterns : HIGH — tous issus du code existant, pas d'hypothèses
- HelpContext extension : HIGH — API claire, ajouts minimaux confirmés
- WorldGridView pause : HIGH — toutes les animations identifiées par lecture du code
- CoachMarkOverlay borderRadius : MEDIUM — l'approche technique exacte reste à valider sur device (Options A/B)
- Targets refs étapes 2-4 : MEDIUM — dépend de décisions d'implémentation sur les refs dans tree.tsx

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (code stable, aucune migration de stack prévue)
