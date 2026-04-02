# Phase 11: Sagas Immersives - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Transformer l'expérience saga d'une interface de boutons dans le dashboard en une expérience immersive dans la scène de l'arbre. Un personnage visiteur pixel art (généré via PixelLab MCP) apparaît dans la scène pour raconter son histoire, style Animal Crossing / Stardew Valley. Le dashboard ne garde qu'un petit indicateur texte.

Cette phase refactore l'UI/UX des sagas existantes — le moteur saga (sagas-engine, sagas-content, sagas-storage, sagas-types) reste inchangé.

</domain>

<decisions>
## Implementation Decisions

### Personnage Visiteur
- **D-01:** Un seul personnage visiteur pixel art "voyageur mystérieux" pour toutes les sagas — généré via PixelLab MCP (create_character). Variations subtiles par saga (accessoire ou palette) gérées côté code (tint/overlay), pas des sprites séparés
- **D-02:** Le personnage est généré en pixel art style cohérent avec les sprites Mana Seed existants (16x16 ou 32x32 base, rendu agrandi) — il doit s'intégrer visuellement au diorama
- **D-03:** Le personnage a au minimum 3 directions de vue : face, gauche (walk), droite (walk miroir via scaleX) — réutilise le pattern AnimatedAnimal existant
- **D-04:** Le personnage vit dans la scène du diorama comme un élément du monde, PAS comme un overlay UI — il est au même niveau z que les inhabitants/compagnon

### Style d'Interaction
- **D-05:** Tap direct sur le personnage dans la scène pour ouvrir le dialogue — style Animal Crossing. Le personnage affiche un indicateur visuel "!" (bulle d'exclamation animée) au-dessus de sa tête quand un chapitre est disponible
- **D-06:** Le dialogue s'ouvre comme un bottom sheet ou une bulle narrative ancrée au personnage (réutiliser/adapter le pattern SagaWorldEvent existant) — PAS une navigation vers un autre écran
- **D-07:** Les choix narratifs sont présentés dans le dialogue (cards slide-in existantes dans SagaWorldEvent) — même mécanique de sélection, mais déclenchée par le tap sur le personnage plutôt qu'automatiquement

### Animation Arrivée / Départ
- **D-08:** Arrivée : le personnage marche depuis le bord droit de la scène et s'installe à un point fixe près de l'arbre (côté droit, à côté du CompanionSlot). Animation de marche via frames walk + translateX spring
- **D-09:** Idle : une fois installé, le personnage a une animation idle subtile (léger bounce ou balancement) + bulle "!" pulsante
- **D-10:** Départ : après complétion du chapitre quotidien, le personnage repart en marchant vers le bord, avec un petit wave/salut. Si c'est le dernier chapitre (saga terminée), animation spéciale plus dramatique (flash + disparition étoilée)
- **D-11:** Le personnage n'apparaît QUE quand un chapitre de saga est disponible (status 'active' + pas encore joué aujourd'hui). Sinon il est absent de la scène

### Indicateur Dashboard
- **D-12:** Supprimer entièrement la carte saga de DashboardGarden.tsx — plus de boutons, plus de carte dédiée
- **D-13:** Remplacer par un texte inline discret dans la section jardin : "🌟 Un visiteur attend près de ton arbre..." avec un tap qui navigue vers l'écran arbre. Si chapitre déjà fait aujourd'hui : "Suite de la saga demain..." Si pas de saga active : rien
- **D-14:** Le texte indicateur montre aussi la progression compacte (ex: "Chapitre 2/4 — Le Voyageur d'Argent")

### Refactoring SagaWorldEvent
- **D-15:** SagaWorldEvent.tsx est refactoré mais pas supprimé — il devient le système de dialogue/bulle narrative, déclenché par le tap sur le visiteur au lieu d'être un overlay automatique
- **D-16:** L'esprit emoji (spiritGlow) est remplacé par le sprite du personnage visiteur — le reste du système (typewriter, choix cards, trait flash, cliffhanger) est conservé

### Claude's Discretion
- Position exacte du visiteur dans le viewBox TreeView (coordonnées cx/cy)
- Timing exact des animations (durées spring, delays)
- Design exact de la bulle "!" (taille, couleur, animation)
- Adaptation responsive du positionnement
- Détails du prompt PixelLab pour la génération du personnage

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Saga Engine (NE PAS MODIFIER)
- `lib/mascot/sagas-engine.ts` — Moteur saga (getDominantTrait, shouldStartSaga, etc.) — inchangé
- `lib/mascot/sagas-types.ts` — Types SagaProgress, SagaChoice, SagaChapter — inchangé
- `lib/mascot/sagas-content.ts` — Les 4 sagas (contenu narratif) — inchangé
- `lib/mascot/sagas-storage.ts` — Persistance SecureStore — inchangé

### Composants à Modifier
- `components/mascot/SagaWorldEvent.tsx` — Overlay saga immersif actuel (550 lignes) — refactorer pour devenir dialogue déclenché par tap
- `components/dashboard/DashboardGarden.tsx` — Carte saga actuelle à supprimer, remplacer par indicateur texte
- `components/mascot/TreeView.tsx` — Scène arbre (82KB) — ajouter le slot visiteur saga
- `app/(tabs)/tree.tsx` — Écran arbre (56KB) — orchestration saga visiteur

### Patterns Existants à Réutiliser
- `components/mascot/TreeView.tsx` > AnimatedAnimal — Pattern animation habitants (idle, marche, direction, scaleX flip)
- `components/mascot/TreeView.tsx` > CompanionSlot — Pattern slot personnage dans le diorama
- `lib/mascot/types.ts` — HAB_SLOTS positions existantes dans le viewBox

### PixelLab MCP
- Utiliser `mcp__pixellab__create_character` pour générer le sprite du visiteur
- Style pixel art cohérent avec les sprites Mana Seed existants dans `assets/sprites/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SagaWorldEvent.tsx` : Système complet de dialogue saga (typewriter, choix cards, trait flash, cliffhanger, finale) — à refactorer mais pas réécrire
- `AnimatedAnimal` dans TreeView.tsx : Animation walk/idle/direction pour les habitants — pattern identique pour le visiteur
- `CompanionSlot` dans TreeView.tsx : Slot dédié pour un personnage dans le diorama — pattern similaire pour le visiteur
- Saga engine 100% fonctionnel (4 sagas, traits, choix, persistence) — aucun changement nécessaire

### Established Patterns
- Sprites pixel art chargés via `require()` ou `Image` depuis `assets/sprites/`
- `useSharedValue` + `withSpring` pour toutes les animations de mouvement
- Positions dans le viewBox SVG (cx/cy) pour les éléments du diorama
- `scaleX: -1` sur Image (pas Animated.View) pour flip directionnel
- Indicateur "!" type bulle de pensée existe déjà sur AnimatedAnimal (thoughtBubble)

### Integration Points
- `tree.tsx` charge déjà `sagaProgress` via `loadSagaProgress` — le state est prêt
- `tree.tsx` a déjà `handleSagaChapterComplete` — la logique de complétion est prête
- `DashboardGarden.tsx` utilise `sagaProgress` et les fonctions saga — à simplifier vers indicateur texte
- Le visiteur s'intègre au même niveau que les HAB_SLOTS et CompanionSlot dans TreeView

</code_context>

<specifics>
## Specific Ideas

- **Style Animal Crossing / Stardew Valley** : Le visiteur doit donner l'impression d'un PNJ qui vient te voir avec une quête — pas une UI froide
- **Fun et surprenant** : L'arrivée du personnage doit être un moment "oh!" — animation de marche avec un petit bounce, peut-être des particules étoilées
- **Chaque saga a son identité** : Le Voyageur d'Argent arrive avec un effet argenté, la Source Cachée avec des bulles d'eau, etc. — via tint/overlay pas des sprites séparés
- **Le dashboard pousse vers l'arbre** : L'indicateur texte crée de la curiosité ("Qui est ce visiteur?") — l'expérience complète est dans la tree view

</specifics>

<deferred>
## Deferred Ideas

- **Personnages multiples** : Un personnage différent par saga (nécessiterait 4+ générations PixelLab) — phase future si le concept marche
- **Dialogues IA** : Narratif saga généré/adapté par Claude en temps réel — phase future
- **Mini-cutscene** : Animation type RPG avec camera pan sur le personnage à l'arrivée — trop ambitieux pour cette phase

</deferred>

---

*Phase: 11-sagas-immersives*
*Context gathered: 2026-04-03*
