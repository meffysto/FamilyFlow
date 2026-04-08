---
phase: 18-tutoriel-ferme
gathered: 2026-04-08
status: ready-for-planning
---

# Phase 18: Tutoriel ferme — Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Livrer un **tutoriel immersif 5 étapes** expliquant la boucle de jeu de la ferme (intro → plantation → croissance/récolte → XP/loot → codex), qui se déclenche **automatiquement** au premier affichage de `app/(tabs)/tree.tsx` sur l'appareil, est **skippable** à tout moment, **rejouable** depuis le bouton déjà câblé dans `FarmCodexModal` (Phase 17 CODEX-10), et **pause les animations** de `WorldGridView` pendant son affichage pour garantir 60 fps.

**Cette phase ne fait PAS** :
- Créer un nouveau provider (extension stricte de `HelpContext`)
- Ajouter un tutoriel sur un autre écran (uniquement ferme)
- Implémenter une interactivité "faire l'action réelle" (tutoriel passif)
- Ajouter des étapes au-delà des 5 prescrites par TUTO-03
</domain>

<carryover>
## Carrying forward from earlier phases

- **Phase 17 CODEX-10** : Le bouton "Rejouer le tutoriel" dans `FarmCodexModal` appelle déjà `HelpContext.resetScreen('farm_tutorial')` puis ferme la modale. Phase 18 doit rendre cet appel fonctionnel côté `tree.tsx`.
- **Phase 16/17 i18n** : Namespace `codex` réservé au codex — les textes du tutoriel utilisent le namespace `help.*` (déjà utilisé par les coach marks existants via `components/help/`).
- **Convention providers** (PROJECT.md) : Pile déjà à 8 niveaux, interdiction d'en ajouter. Confirmé par TUTO-08.
- **react-native-reanimated ~4.1** obligatoire pour toutes les animations (pas RN Animated). Spring configs comme constantes module.
- **`useThemeColors()`** pour toutes les couleurs, jamais de hardcoded.
- **UI en français**, commits en français.
</carryover>

<decisions>
## Implementation Decisions

### Format du tutoriel

- **D-01 (Format mixte 5 étapes)** : Le tutoriel alterne deux formats selon l'étape :
  - **Étape 1 "Bienvenue à la ferme"** → **carte narrative plein écran** (modal pageSheet ou overlay full-width), pas de spotlight
  - **Étapes 2, 3, 4 (plantation, récolte, XP/loot)** → **coach marks classiques** (bulle + cutout spotlight) pointant vers de vrais éléments de l'écran ferme (parcelle vide, culture mûre, HUD XP)
  - **Étape 5 "Où aller plus loin"** → **carte narrative plein écran finale**, pas de spotlight
- **D-02 (Cible étape 1)** : La carte narrative de l'étape 1 affiche le **sprite de l'arbre mascotte du profil actif** en illustration — source : `assets/garden/trees/{profile.tree}/` (le champ `tree` sur `Profile`). Prévoir un fallback si le profil n'a pas encore d'arbre choisi (utiliser le premier arbre du catalogue ou un emoji 🌳).
- **D-03 (Cible étape 5)** : La carte finale affiche un gros emoji **📖** + texte FR indiquant que le codex s'ouvre depuis le bouton livre du HUD (référence visuelle au bouton Phase 17 sans ouvrir le codex automatiquement).

### Interactivité

- **D-04 (Tutoriel passif)** : À chaque étape, l'utilisateur **lit le texte** et tape **"Suivant"** pour progresser. Aucune action réelle requise (pas d'obligation de planter une carotte, pas d'attente de récolte). Garde le flux simple, prévisible, et évite la complexité d'un état "tutorial step 2 waiting for plantation event". Les animations d'étapes restent celles de la bulle CoachMark existante (spring reanimated).
- **D-04bis (Bouton "Passer")** : Un bouton **"Passer"** (i18n FR) est visible **à toutes les étapes** du tutoriel. Son tap :
  1. Appelle `markScreenSeen('farm_tutorial')` immédiatement
  2. Ferme l'overlay tutoriel
  3. Réactive les animations de `WorldGridView` (pause = false)

### Spotlight

- **D-05 (Rectangle arrondi)** : La forme du cutout des étapes 2-4 est un **rectangle aux coins arrondis**. On **étend** `components/help/CoachMarkOverlay.tsx` pour accepter un nouveau prop `borderRadius?: number` (défaut 0 pour ne pas casser les consommateurs actuels de coach marks dashboard/tasks/...). L'implémentation actuelle (4 Views rectangulaires) **ne peut pas** gérer directement des coins arrondis sans artefact visuel ; on utilisera **une `View` unique positionnée absolument sur la zone cutout avec `borderWidth` très épais et couleur `rgba(0,0,0,0.6)` + `borderRadius`**, ou — si plus propre — un wrapper qui superpose les 4 vues rectangulaires existantes (haut/bas/gauche/droite) **plus** 4 petites vues de coin avec masque arrondi. **Claude's Discretion** pour choisir l'approche la plus propre au moment de l'implémentation.
- **D-05bis (Pas de SVG)** : On **rejette** explicitement l'option `react-native-svg` `<Mask>` + `<Circle>`. Raison : `CoachMarkOverlay` existant est déjà optimisé 4-Views sans dépendance SVG, la complexité SVG masking n'apporte rien de visible à cette échelle pour un rectangle arrondi, et préserver l'existant simplifie la PR.

### Pause des animations

- **D-06 (Prop `paused` explicite)** : `components/mascot/WorldGridView.tsx` reçoit un **nouveau prop optionnel** `paused?: boolean` (défaut `false`). Quand `true`, le composant :
  - Saute les `useAnimatedStyle`/`withTiming`/`withSpring` qui animent les sprites ambiants (papillons, oiseaux, coccinelles, particules)
  - Fige les `frameIdx` des crops/animals sur leur frame courante
  - Les `useSharedValue` continuent d'exister mais ne sont plus mis à jour par animation frame
- **D-06bis (Source de vérité)** : `app/(tabs)/tree.tsx` pilote le `paused` en lisant un **nouvel état `activeFarmTutorialStep` ajouté à `HelpContext`** — un simple `number | null` exposé via le hook `useHelp()`. Pattern :
  ```ts
  const { activeFarmTutorialStep } = useHelp();
  <WorldGridView paused={activeFarmTutorialStep !== null} />
  ```
  Avantage : une seule source de vérité, pas de prop drilling, aligné avec TUTO-08 (extension de HelpContext, pas de nouveau provider).

### Orchestrateur tutoriel

- **D-07 (Nouveau composant `FarmTutorialOverlay`)** : Créer `components/mascot/FarmTutorialOverlay.tsx` (ou `components/help/FarmTutorialOverlay.tsx` — **Claude's Discretion**, préférence `components/mascot/` pour garder la famille ferme cohérente). Ce composant :
  - Lit `hasSeenScreen('farm_tutorial')` + `isLoaded` de `HelpContext`
  - Séquence interne de 5 étapes avec state local `currentStep`
  - Orchestrate les 2 formats (carte narrative vs coach mark) via un discriminated union
  - Appelle `setActiveFarmTutorialStep(n)` et `markScreenSeen('farm_tutorial')` au bon moment
  - Se monte dans `tree.tsx` en haut de la hiérarchie (après `WorldGridView`, au niveau absolu)
- **D-08 (Pas de réécriture de `ScreenGuide`)** : `ScreenGuide.tsx` reste inchangé pour les autres écrans (dashboard, tasks, etc.). `FarmTutorialOverlay` est **un nouveau orchestrateur sibling**, pas un remplacement, parce que le format mixte (carte narrative + coach marks) ne rentre pas dans le contrat de `ScreenGuide`.

### Extension de HelpContext

- **D-09 (Minimal invasive)** : `HelpContext` reçoit exactement **deux** ajouts :
  1. State `activeFarmTutorialStep: number | null` (initial `null`)
  2. Setter exposé sur le contexte value : `setActiveFarmTutorialStep: (step: number | null) => void`
  Aucune autre modification de l'API `HelpContext` existante (`hasSeenScreen`, `markScreenSeen`, `resetScreen` restent intactes). Le contrat `screen_id = 'farm_tutorial'` est déjà supporté par l'API générique existante — aucun enum à étendre côté types.

### i18n

- **D-10 (Namespace `help`)** : Les textes des 5 étapes vivent sous `locales/{fr,en}/help.json` dans une sous-section `farm_tutorial`. Clés proposées :
  - `help.farm_tutorial.step1.title`, `.body`
  - `help.farm_tutorial.step2.title`, `.body`
  - ... (idem pour 3, 4, 5)
  - `help.farm_tutorial.skip` → "Passer"
  - `help.farm_tutorial.next` → "Suivant"
  - `help.farm_tutorial.done` → "C'est parti !" (libellé bouton dernière étape)
  - Parité FR/EN obligatoire (convention Phase 16 D-16 étendue à ce namespace).

### Claude's Discretion

Les points suivants sont laissés au jugement lors de l'implémentation et du planning :
- **Durée d'animation d'entrée/sortie** des cartes narratives (recommandation : spring damping 12 stiffness 140, cohérent avec CoachMark)
- **Position finale et offset** des bulles coach mark sur les étapes 2-4 (calcul automatique above/below selon espace dispo)
- **Padding autour du cutout** (défaut 8 comme `CoachMarkOverlay` actuel, à ajuster si visuellement juste)
- **Approche technique exacte** pour rectangle arrondi dans `CoachMarkOverlay` (4-Views + masks coin ou View unique borderWidth)
- **Placement exact de `FarmTutorialOverlay`** dans `tree.tsx` (sous ou au-dessus du HUD ; préférence : au-dessus pour que les coach marks puissent pointer le HUD)
- **Gestion du cas "profil sans arbre choisi"** pour l'illustration de l'étape 1 (fallback arbre défaut ou emoji 🌳 — à juger à la vue des sprites dispo)
- **Délai avant déclenchement** au premier affichage (existant : `ScreenGuide` utilise 600ms — réutiliser cette constante pour cohérence)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §Phase 18 — Goal, success criteria, dépendances Phase 16/17
- `.planning/REQUIREMENTS.md` §TUTO-01..08 — 8 acceptance criteria, ligne 51-59

### Phase 17 carry-over
- `.planning/phases/17-codex-ui/17-CONTEXT.md` — Décisions Phase 17, notamment D-15 (replay button contract)
- `.planning/phases/17-codex-ui/17-VERIFICATION.md` — État vérifié de CODEX-10 (replay button branché sur `resetScreen('farm_tutorial')`)
- `components/mascot/FarmCodexModal.tsx` — Site du bouton replay à garder aligné

### Infrastructure à étendre
- `contexts/HelpContext.tsx` — Provider à étendre (ajouter `activeFarmTutorialStep` + setter)
- `components/help/CoachMark.tsx` — Composant bulle réutilisable pour étapes 2-4
- `components/help/CoachMarkOverlay.tsx` — Composant overlay à étendre avec `borderRadius`
- `components/help/ScreenGuide.tsx` — Patron de référence (mais pas à modifier)

### Intégration
- `app/(tabs)/tree.tsx` — Écran ferme hôte du tutoriel, déjà point d'entrée du codex (Phase 17)
- `components/mascot/WorldGridView.tsx` — Composant à étendre avec prop `paused`

### Assets
- `assets/garden/trees/` — Sprites arbres mascotte (apple_red, orange, peach, pear, plum) pour l'illustration de l'étape 1

### Conventions projet
- `./CLAUDE.md` — Conventions React Native / Expo / FR / react-native-reanimated / theme tokens
- `.planning/PROJECT.md` — Principes non négociables (stabilité, pas de pile de providers)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`contexts/HelpContext.tsx`** — API `hasSeenScreen('farm_tutorial')` + `markScreenSeen` + `resetScreen` déjà fonctionnelles. Persistance SecureStore via `HELP_SCREENS_KEY` JSON consolidé. Cible exacte pour TUTO-01 / TUTO-02 / TUTO-05 / TUTO-07 / TUTO-08.
- **`components/help/CoachMark.tsx`** — Bulle reanimated spring, positionnement above/below, compteur étape, onNext/onDismiss. Réutilisable tel quel pour étapes 2-4. **Note** : manque un bouton "Passer" explicite — à ajouter comme nouveau prop optionnel `skipLabel?: string` + `onSkip?: () => void`, sinon créer un wrapper.
- **`components/help/CoachMarkOverlay.tsx`** — Overlay 4-Views cutout rectangulaire, animation fade-in. À étendre pour `borderRadius` (D-05).
- **`components/help/ScreenGuide.tsx`** — Patron orchestrateur (mesure cibles via `measureInWindow`, séquence, fallback si cible non montée). **Patron à dupliquer** pour `FarmTutorialOverlay` — pas à modifier.
- **`assets/garden/trees/{id}/`** — 5 arbres mascotte disponibles avec sprites prêts pour illustration.

### Established Patterns
- **Modal pageSheet + drag-to-dismiss** — convention projet (CLAUDE.md). Applicable si on choisit une Modal plutôt qu'un overlay absolu pour les cartes narratives 1 et 5.
- **`useThemeColors()`** inline pour toutes les couleurs. Aucun hardcoded.
- **Spring configs constantes module** : ex. `const SPRING_CONFIG = { damping: 10, stiffness: 180 }` (CLAUDE.md).
- **`expo-haptics`** pour feedback tactile : `Haptics.selectionAsync()` sur boutons "Suivant"/"Passer".
- **i18n namespace via `:`** — séparateur codex documenté après bug Phase 17 (`codex:key` pas `codex.key`). Appliquer à `help:farm_tutorial.step1.title` pour éviter le même piège si `help` n'est PAS le default namespace. À vérifier dans `lib/i18n.ts`.
- **`pointerEvents="box-none"`** sur overlays pour laisser passer les taps (convention CoachMarkOverlay).

### Integration Points
- **`app/(tabs)/tree.tsx`** — Monter `<FarmTutorialOverlay />` au top-level du render, au-dessus du HUD et du WorldGridView. Lire `activeFarmTutorialStep` de `useHelp()` pour passer le prop `paused` à `<WorldGridView />`.
- **`components/mascot/FarmCodexModal.tsx:97`** — La fonction `handleReplayTutorial` appelle déjà `resetScreen('farm_tutorial')`. Phase 18 doit garantir que ce reset relance effectivement la séquence (via `hasStarted` ref ou équivalent dans `FarmTutorialOverlay`).
- **`components/mascot/WorldGridView.tsx`** — Ajouter prop `paused` qui gate les animations ambiantes. Toutes les animations RN Reanimated doivent être réversibles (quand `paused` repasse à `false`, elles reprennent sans reset).

### Creative Options (not taken)
- `react-native-svg` `<Mask>` + `<Circle>` pour spotlights circulaires — rejeté D-05bis
- Nouveau provider `TutorialContext` — rejeté D-09 (extension HelpContext)
- Tutorial interactive avec attente d'événements réels (plantation, récolte) — rejeté D-04 (passive)
- Ouverture automatique du codex à l'étape 5 — rejeté D-03 (carte narrative statique)
</code_context>

<specifics>
## Specific Ideas

- **Étape 1 — Illustration** : Afficher le sprite du profil actif depuis `assets/garden/trees/{profile.tree}/` pour que l'intro soit personnalisée ("Voici TON arbre"). Fallback si pas d'arbre choisi : emoji 🌳 XL.
- **Étape 5 — Call to action** : Gros 📖 + phrase FR pointant vers le bouton livre du HUD. Pas d'ouverture automatique du codex — laisser le joueur découvrir par lui-même pour ne pas casser l'immersion.
- **Bouton "Passer"** visible **à toutes** les étapes (1-5), pas seulement dans un menu caché. Tap = "vu" immédiat + fin de séquence.
- **Animations WorldGridView en pause** pour 60 fps pendant le tutoriel — TUTO-06 explicite. Le prop `paused` doit geler papillons, oiseaux, coccinelles, particules ambiantes, et l'animation idle des crops/animals.
</specifics>

<deferred>
## Deferred Ideas

- **Tutoriel interactif** (attente de plantation/récolte réelle) — Rejeté pour cette phase, pourrait revenir comme "Tutoriel avancé Phase 18.1" si le passive ne suffit pas à engager.
- **Spotlight circulaire SVG** — Rejeté D-05bis, pourrait revenir si on ajoute un tutoriel pour des cibles rondes comme l'arbre mascotte central dans une future phase.
- **Ouverture automatique du codex à l'étape 5** — Version immersive, rejetée pour simplicité. Pourrait revenir comme variante si le tutoriel passif ne convertit pas les utilisateurs vers le codex.
- **Tutoriels supplémentaires sur d'autres écrans** (dashboard, tasks, meals) — Hors scope Phase 18, appartient à une phase "Onboarding complet" future.
- **Narration vocale TTS des étapes** — Pas demandé par les requirements, pourrait enrichir l'accessibilité en v1.3+.
- **Animation d'entrée ludique de l'arbre** sur l'étape 1 (fade + bounce) — Laissé à Claude's Discretion au moment de l'implémentation, pas une décision bloquante.

None folded todos from the backlog — `/gsd:todo match-phase 18` retourné zéro match.
</deferred>

---

*Phase: 18-tutoriel-ferme*
*Context gathered: 2026-04-08*
