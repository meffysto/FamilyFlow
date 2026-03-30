# Phase 10: Compagnon Mascotte - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Un compagnon interactif (animal mignon) vit dans la scène de l'arbre et devient la mascotte de l'app. Il est lié au système de gamification existant (lootboxes, XP), évolue visuellement avec le niveau du joueur, a un nom et une humeur, et réagit aux actions faites dans l'app via des messages contextuels. Il sert aussi d'avatar de profil.

</domain>

<decisions>
## Implementation Decisions

### Obtention & Choix
- **D-01:** Choix initial parmi ~5 compagnons animaux mignons (chat, chien, lapin, renard, hérisson) style pixel art Mana Seed, déclenché quand le profil atteint un certain niveau (ex: niveau 5)
- **D-02:** Un seul compagnon actif à la fois par profil — l'utilisateur peut switcher s'il en débloque d'autres
- **D-03:** Nouveaux compagnons débloquables via lootbox (raretés rare/épique) — encourage la progression
- **D-04:** Système complètement séparé des inhabitants cosmétiques existants — le compagnon a son propre slot dédié dans la scène, les 15 inhabitants restent des décos

### Évolution & Personnalité
- **D-05:** 3 stades d'évolution visuelle : Bébé → Jeune → Adulte, liés au niveau XP du profil (comme les stades de l'arbre)
- **D-06:** L'utilisateur peut nommer son compagnon (nom custom, persisté dans le vault)
- **D-07:** Système d'humeur simple : le compagnon change d'état (content, endormi, excité, triste) selon l'activité récente — pas de jauge à maintenir, juste du feedback visuel

### Interactions & Bonus
- **D-08:** Tap sur le compagnon = réaction animée (saut, cœurs, étoiles) + haptic feedback. Pas de mécanique nourrir/jauge de faim
- **D-09:** Bonus passif léger : +5% XP ou +1 récolte bonus/jour. Présent mais pas game-breaking
- **D-10:** Bulles d'émotion sur événements de l'app (tâche complétée, lootbox ouverte, level up) — réutilise le pattern bulle de pensée existant dans AnimatedAnimal

### Présence & Conscience
- **D-11:** Le compagnon vit visuellement uniquement sur l'écran arbre (pas de widget flottant global)
- **D-12:** Le compagnon est "conscient" des actions faites dans l'app : quand l'utilisateur arrive sur l'écran arbre, le compagnon affiche un message contextuel sur les dernières actions (tâches complétées, photos ajoutées, streak, etc.)
- **D-13:** Messages hybrides : pool de phrases prédéfinies i18n par défaut (templates avec variables), + IA générative optionnelle (Claude Haiku) si clé API configurée. Fallback automatique sur prédéfini quand hors ligne
- **D-14:** Le compagnon sert d'avatar de profil dans la tab bar et le sélecteur de profil

### Claude's Discretion
- Mapping exact niveau XP → stade d'évolution (quels niveaux déclenchent bébé/jeune/adulte)
- Nombre exact de compagnons au choix initial (3-5)
- Pool exact de phrases prédéfinies et structure des templates
- Valeur exacte du bonus passif (+5% XP ou alternative équivalente)
- Format de sérialisation des données compagnon dans le vault markdown

### Hors scope cette phase
- Accessoires/cosmétiques pour le compagnon (phase future)
- Présence globale hors écran arbre (dashboard, toasts — phase future)
- Traits de personnalité influençant les animations
- Mini-jeux avec le compagnon

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mascot System
- `lib/mascot/types.ts` — Types tree, farm, decorations, inhabitants — comprendre la structure existante
- `lib/mascot/engine.ts` — Calcul des stades arbre et détection d'évolution — pattern à réutiliser pour les stades compagnon
- `lib/mascot/seasons.ts` — Palettes saisonnières — le compagnon devrait s'adapter aux saisons

### Gamification
- `lib/gamification/engine.ts` — XP, niveaux, streaks, loot boxes — point d'intégration pour bonus passif et évolution
- `lib/gamification/rewards.ts` — Pool de récompenses et drop rates — ajouter compagnons au pool lootbox
- `constants/rewards.ts` — Modèle XP budget — le bonus passif doit respecter l'équilibre

### Rendu & Interactions
- `components/mascot/TreeView.tsx` — Rendu de la scène arbre (89KB) — intégrer le slot compagnon ici
- `app/(tabs)/tree.tsx` — Écran arbre (56KB) — orchestration interactions compagnon

### Données & Persistance
- `lib/parser.ts` — Parse/serialize markdown vault — ajouter companion data
- `hooks/useVault.ts` — Hook central état — exposer companion state
- `hooks/useGamification.ts` — Hook gamification — intégrer bonus compagnon

### IA
- `lib/ai-service.ts` — Service Claude API existant — réutiliser pour messages IA compagnon
- `contexts/AIContext.tsx` — Provider clé API — vérifier disponibilité IA

### Profil
- `app/(tabs)/_layout.tsx` — Tab layout avec profil picker — intégrer avatar compagnon

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedAnimal` dans TreeView.tsx : déjà un système de bulles de pensée + animation idle + direction de marche — pattern réutilisable pour le compagnon
- `lib/mascot/engine.ts` : `getTreeStage(level)` — même pattern applicable pour `getCompanionStage(level)`
- `lib/gamification/rewards.ts` : système de raretés et pool de drops — étendre pour inclure des compagnons
- `lib/ai-service.ts` : fetch direct Claude API déjà en place — réutiliser pour messages IA
- Sprites Mana Seed existants pour les animaux (poulet, canard, etc.) — base pour les compagnons

### Established Patterns
- Sérialisation CSV dans vault markdown (crops, buildings, inventory) — même pattern pour companion data
- Pure functions dans `lib/mascot/` — companion engine sera aussi des pure functions
- `useSharedValue` + `withSpring` pour toutes les animations
- `expo-haptics` pour le feedback tactile
- i18n via `locales/fr/*.json` et `locales/en/*.json`

### Integration Points
- `TreeView.tsx` : ajouter un slot dédié compagnon (distinct des inhabitant slots)
- `tree.tsx` : ajouter UI choix compagnon + interaction tap
- `useGamification.ts` : appliquer bonus passif compagnon
- `parser.ts` : ajouter parseCompanion/serializeCompanion
- `rewards.ts` : ajouter compagnons au pool de lootbox
- `app/(tabs)/_layout.tsx` : remplacer/compléter avatar profil avec compagnon

</code_context>

<specifics>
## Specific Ideas

- Le compagnon commente des actions spécifiques : "Bravo pour le ménage !", "Belle photo aujourd'hui !" — pas juste des stats génériques
- L'arbre reste un arbre qui grandit passivement, le compagnon est le vrai élément interactif et émotionnel
- Style pixel art Mana Seed cohérent avec les animaux/cultures existants
- Animaux mignons réalistes (pas fantaisie) pour le choix initial — attachement immédiat pour les enfants

</specifics>

<deferred>
## Deferred Ideas

- **Accessoires/cosmétiques compagnon** — chapeaux, écharpes, lunettes via lootbox ou achat feuilles. Phase future.
- **Présence globale** — compagnon visible sur le dashboard, dans les toasts de félicitations, partout dans l'app. Phase future après validation du concept sur l'écran arbre.
- **Traits de personnalité** — joueur, câlin, gourmand influençant animations/réactions. Phase future si le système d'humeur simple fonctionne bien.
- **Mini-jeux** — interactions ludiques avec le compagnon. Phase future.

</deferred>

---

*Phase: 10-compagnon-mascotte*
*Context gathered: 2026-03-30*
