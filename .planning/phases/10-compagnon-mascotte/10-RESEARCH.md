# Phase 10: Compagnon Mascotte — Research

**Researched:** 2026-03-30
**Domain:** React Native / Expo — compagnon interactif pixel art, gamification, persistance vault Markdown
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Choix initial parmi ~5 compagnons animaux mignons (chat, chien, lapin, renard, hérisson) style pixel art Mana Seed, déclenché quand le profil atteint un certain niveau (ex: niveau 5)
- **D-02:** Un seul compagnon actif à la fois par profil — l'utilisateur peut switcher s'il en débloque d'autres
- **D-03:** Nouveaux compagnons débloquables via lootbox (raretés rare/épique) — encourage la progression
- **D-04:** Système complètement séparé des inhabitants cosmétiques existants — le compagnon a son propre slot dédié dans la scène, les 15 inhabitants restent des décos
- **D-05:** 3 stades d'évolution visuelle : Bébé → Jeune → Adulte, liés au niveau XP du profil (comme les stades de l'arbre)
- **D-06:** L'utilisateur peut nommer son compagnon (nom custom, persisté dans le vault)
- **D-07:** Système d'humeur simple : le compagnon change d'état (content, endormi, excité, triste) selon l'activité récente — pas de jauge à maintenir, juste du feedback visuel
- **D-08:** Tap sur le compagnon = réaction animée (saut, cœurs, étoiles) + haptic feedback. Pas de mécanique nourrir/jauge de faim
- **D-09:** Bonus passif léger : +5% XP ou +1 récolte bonus/jour. Présent mais pas game-breaking
- **D-10:** Bulles d'émotion sur événements de l'app (tâche complétée, lootbox ouverte, level up) — réutilise le pattern bulle de pensée existant dans AnimatedAnimal
- **D-11:** Le compagnon vit visuellement uniquement sur l'écran arbre (pas de widget flottant global)
- **D-12:** Le compagnon est "conscient" des actions faites dans l'app : quand l'utilisateur arrive sur l'écran arbre, le compagnon affiche un message contextuel sur les dernières actions
- **D-13:** Messages hybrides : pool de phrases prédéfinies i18n par défaut + IA générative optionnelle (Claude Haiku) si clé API configurée. Fallback automatique sur prédéfini quand hors ligne
- **D-14:** Le compagnon sert d'avatar de profil dans la tab bar et le sélecteur de profil

### Claude's Discretion

- Mapping exact niveau XP → stade d'évolution (quels niveaux déclenchent bébé/jeune/adulte)
- Nombre exact de compagnons au choix initial (3-5)
- Pool exact de phrases prédéfinies et structure des templates
- Valeur exacte du bonus passif (+5% XP ou alternative équivalente)
- Format de sérialisation des données compagnon dans le vault markdown

### Deferred Ideas (OUT OF SCOPE)

- Accessoires/cosmétiques pour le compagnon (chapeaux, écharpes, lunettes)
- Présence globale hors écran arbre (dashboard, toasts)
- Traits de personnalité influençant les animations
- Mini-jeux avec le compagnon
</user_constraints>

---

## Summary

Cette phase greffe un compagnon interactif sur le système mascotte/ferme existant. Toute l'infrastructure nécessaire est déjà en place : `AnimatedAnimal` dans `TreeView.tsx` fournit exactement le pattern (idle frames, walk, bulles de pensée), `getTreeStage()` dans `engine.ts` est le modèle à cloner pour les stades du compagnon, le parser `famille.md` a déjà des patterns CSV pour tous les champs farm/mascot, et `ai-service.ts` + `AIContext` sont prêts pour les messages IA.

Le principal travail nouveau est : (1) créer les sprites pixel art pour 5 animaux compagnons (chat, chien, lapin, renard, hérisson) aux 3 stades chacun — aucun asset de compagnon n'existe encore dans `assets/garden/animals/` (seulement poussin, poulet, canard, cochon, vache), (2) un moteur `companion-engine.ts` pur pour les stades/humeurs/messages, (3) l'intégration dans `famille.md` via un nouveau champ `companion` en CSV, et (4) un `CompanionSlot` distinct dans `TreeView.tsx`.

**Recommandation principale :** Commencer par les sprites (blocker artistique), puis le moteur pure functions, puis l'intégration dans TreeView et le hook useVault.

---

## Project Constraints (from CLAUDE.md)

Directives extraites de `CLAUDE.md` que le planner doit vérifier :

| Directive | Implication pour cette phase |
|-----------|------------------------------|
| `react-native-reanimated ~4.1` obligatoire (pas RN Animated) | Toutes les animations compagnon = `useSharedValue` + `withSpring` |
| `useThemeColors()` / `colors.*` — jamais de hardcoded | Pas de couleurs hardcodées dans les composants compagnon |
| `ReanimatedSwipeable` (PAS `Swipeable`) | Non pertinent ici (pas de swipe) |
| Langue UI/commits/commentaires : français | Toutes les chaînes i18n en français, clés `locales/fr/` |
| Éviter `perspective` dans les transform arrays | Utiliser `scaleX: -1` pour flip directionnel comme `AnimatedAnimal` le fait déjà |
| `expo-haptics` pour feedback tactile important | Tap sur compagnon → `Haptics.impactAsync()` |
| Pure functions dans `lib/` — pas d'import React | `lib/mascot/companion-engine.ts` : zéro import React |
| Format serialisation CSV vault | Nouveau champ `companion` dans `famille.md` : CSV à plat |
| `npx tsc --noEmit` comme validation | Tous les nouveaux types doivent compiler sans erreur |
| Modals : présentation `pageSheet` + drag-to-dismiss | Modal choix compagnon en `pageSheet` |
| `expo-haptics` sur interactions importantes | Tap compagnon, choix initial, évolution |

---

## Standard Stack

### Core (existant — rien à installer)

| Bibliothèque | Version | Rôle dans cette phase | Source |
|---|---|---|---|
| `react-native-reanimated` | ~4.1.1 | Animations idle/saut/spring compagnon | CLAUDE.md |
| `react-native-gesture-handler` | ~2.28.0 | Tap sur compagnon dans la scène | CLAUDE.md |
| `expo-haptics` | ~15.0.8 | Feedback tap + évolution | CLAUDE.md |
| `react-native-svg` | ^15.12.1 | Rendu SVG scène arbre (TreeView) | CLAUDE.md |
| `i18next` + `react-i18next` | ^25 / ^16 | Phrases prédéfinies compagnon | CLAUDE.md |
| `expo-secure-store` | ~15.0.8 | Non utilisé directement — vault markdown | CLAUDE.md |

Aucune nouvelle dépendance npm n'est nécessaire pour cette phase. Tout est fourni par le stack existant.

### Alternatives Considérées

| Standard | Alternative | Pourquoi standard retenu |
|----------|-------------|--------------------------|
| Sprites PNG frame-by-frame (pattern existant) | Lottie / GIF | Cohérence avec `AnimatedAnimal` existant, contrôle total |
| CSV dans `famille.md` (pattern existant) | Nouveau fichier `companion-{id}.md` | Simplicité — pattern établi pour farm_crops, mascot_placements |
| Pure functions `lib/mascot/companion-engine.ts` | Logique inline dans le hook | Cohérence avec farm-engine, tech-engine, building-engine |

---

## Architecture Patterns

### Structure fichiers recommandée

```
lib/mascot/
├── companion-engine.ts      # NOUVEAU — pure functions : stades, humeurs, messages, bonus
├── companion-types.ts       # NOUVEAU — CompanionState, CompanionSpecies, CompanionMood, etc.
├── types.ts                 # MODIFIER — ajouter companion fields à Profile (ou garder dans lib/types.ts)
├── engine.ts                # EXISTANT — getTreeStage() — modèle à cloner
└── ...

components/mascot/
├── CompanionSlot.tsx        # NOUVEAU — AnimatedAnimal-style, slot dédié compagnon dans la scène
├── CompanionPicker.tsx      # NOUVEAU — modal pageSheet choix initial / switch compagnon
├── CompanionMessage.tsx     # NOUVEAU — bulle de message contextuel (distinct des thought bubbles)
└── TreeView.tsx             # MODIFIER — ajouter prop companion + rendu CompanionSlot

app/(tabs)/
├── tree.tsx                 # MODIFIER — orchestration : tap handler, message trigger, CompanionPicker
└── _layout.tsx              # MODIFIER — avatar profil = sprite compagnon bébé (si possède compagnon)

lib/
├── parser.ts                # MODIFIER — parseCompanion / champ companion dans parseFamille
└── types.ts                 # MODIFIER — ajouter CompanionData à Profile

hooks/
└── useVault.ts              # MODIFIER — exposer companion state + actions

assets/garden/animals/
├── chat/                    # NOUVEAU — idle_1/2, walk_down_1-8, walk_left_1-8 (3 stades)
├── chien/                   # NOUVEAU — même structure
├── lapin/                   # NOUVEAU — même structure
├── renard/                  # NOUVEAU — même structure
└── herisson/                # NOUVEAU — même structure

locales/fr/common.json       # MODIFIER — ajouter companion.* keys
locales/en/common.json       # MODIFIER — idem
```

### Pattern 1 : Moteur compagnon — miroir de getTreeStage()

```typescript
// Source: lib/mascot/engine.ts (pattern existant)
// lib/mascot/companion-engine.ts

export type CompanionSpecies = 'chat' | 'chien' | 'lapin' | 'renard' | 'herisson';
export type CompanionStage = 'bebe' | 'jeune' | 'adulte';
export type CompanionMood = 'content' | 'endormi' | 'excite' | 'triste';

export interface CompanionStageInfo {
  stage: CompanionStage;
  minLevel: number;
  maxLevel: number;
  labelKey: string;
}

// Aligné sur les TREE_STAGES : bébé jusqu'au stade arbuste (~niv 5),
// jeune jusqu'à arbre (~niv 10), adulte ensuite — cohérence avec progression
export const COMPANION_STAGES: CompanionStageInfo[] = [
  { stage: 'bebe',   minLevel: 1,  maxLevel: 5,  labelKey: 'companion.stage.bebe' },
  { stage: 'jeune',  minLevel: 6,  maxLevel: 10, labelKey: 'companion.stage.jeune' },
  { stage: 'adulte', minLevel: 11, maxLevel: 999, labelKey: 'companion.stage.adulte' },
];

export function getCompanionStage(level: number): CompanionStage {
  for (let i = COMPANION_STAGES.length - 1; i >= 0; i--) {
    if (level >= COMPANION_STAGES[i].minLevel) return COMPANION_STAGES[i].stage;
  }
  return 'bebe';
}

// Humeur : calculée depuis les actions récentes (dernières 24h)
export function getCompanionMood(
  recentTasksCompleted: number,
  hoursSinceLastActivity: number,
): CompanionMood {
  if (hoursSinceLastActivity > 48) return 'triste';
  if (new Date().getHours() >= 22 || new Date().getHours() < 7) return 'endormi';
  if (recentTasksCompleted >= 5) return 'excite';
  return 'content';
}
```

### Pattern 2 : Sérialisation companion dans famille.md

```
### lucas
name: Lucas
role: enfant
avatar: 🦊
companion: chat:mon-chat:1:content
```

Format CSV : `speciesId:nom:compagnonsDebloqués:humeurCourante`

Compagnons débloqués multiples (si switch possible) : `chat,lapin` séparés par pipe `|` :
```
companion: chat:Minou:chat|lapin:content
```

Pattern de lecture/écriture : identique à `writeFarmCrops()` dans `useFarm.ts` — lire les lignes, trouver `companion:`, éditer en place ou insérer après `lastPropIdx`.

### Pattern 3 : CompanionSlot dans TreeView — miroir d'AnimatedAnimal

```typescript
// Source: components/mascot/TreeView.tsx (AnimatedAnimal existant)
// Différences : position fixe (slot dédié), tap handler, message bubble

function CompanionSlot({
  species,
  stage,
  mood,
  name,
  message,
  onTap,
  containerWidth,
}: CompanionSlotProps) {
  // idle frames par espèce + stade (ex: chat_bebe/idle_1.png)
  // useSharedValue pour saut au tap
  // scaleX: -1 sur Image pour flip directionnel (même pattern)
  // bulle message avec texte plus long que thought bubble
}
```

**Position dans la scène** : zone `ground-center` (~cx:100, cy:210 sur viewbox 200×240) ou zone dédiée juste devant l'arbre — distinct des SCENE_SLOTS used by inhabitants.

### Pattern 4 : Messages contextuels hybrides

```typescript
// lib/mascot/companion-engine.ts

// Pool prédéfini par événement + humeur
export const MESSAGE_TEMPLATES: Record<CompanionEvent, string[]> = {
  task_completed: [
    'companion.msg.taskDone.1',  // "Bravo {profileName} !"
    'companion.msg.taskDone.2',  // "Encore une tâche de moins !"
  ],
  loot_opened: ['companion.msg.loot.1', 'companion.msg.loot.2'],
  level_up: ['companion.msg.levelUp.1'],
  greeting: ['companion.msg.greeting.{mood}.1'],
  // ...
};

// IA optionnelle (si AIContext.isConfigured)
export async function generateCompanionMessage(
  event: CompanionEvent,
  context: CompanionMessageContext,
  aiConfig: AIConfig | null,
): Promise<string> {
  if (!aiConfig) return pickRandomTemplate(event, context);
  try {
    // Appel Claude Haiku via ai-service.ts existant
    // Prompt court : < 200 tokens
    // Timeout 3s, fallback sur template si échec
  } catch {
    return pickRandomTemplate(event, context);
  }
}
```

### Pattern 5 : Avatar compagnon dans tab bar / profile picker

```typescript
// app/(tabs)/_layout.tsx — MODIFIER
// Remplacer <Text style={pickerStyles.avatar}>{p.avatar}</Text>
// Par <CompanionAvatarMini profile={p} size={40} />

function CompanionAvatarMini({ profile, size }: { profile: Profile; size: number }) {
  if (!profile.companion) {
    return <Text style={{ fontSize: size * 0.8 }}>{profile.avatar}</Text>;
  }
  const { species, stage } = parseCompanionSimple(profile.companion);
  const frame = COMPANION_IDLE_FRAMES[species]?.[stage]?.[0];
  if (!frame) return <Text style={{ fontSize: size * 0.8 }}>{profile.avatar}</Text>;
  return <Image source={frame} style={{ width: size, height: size }} />;
}
```

### Anti-Patterns à éviter

- **Stocker le compagnon dans GamificationData** : doit rester dans `famille.md` comme `treeSpecies`, `mascotDecorations` — c'est un état de profil, pas un état de gamification
- **Modifier MascotState** pour y inclure le compagnon : créer un `CompanionData` séparé sur `Profile`, pas dans `MascotState` (qui gère tree/décos/inhabitants)
- **Utiliser perspective dans les transforms** : toujours `scaleX: -1` pour flip
- **Rendre le compagnon dans le SVG `<G>`** : utiliser un `Animated.View` natif superposé (comme `AnimatedAnimal` — les animaux pixel ne sont PAS dans le SVG mais dans un overlay natif)
- **Faire un appel IA à chaque visite** : appel IA uniquement au premier focus sur l'écran arbre, résultat mis en cache en mémoire (pas persisté) jusqu'au prochain refresh

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser à la place | Pourquoi |
|----------|-------------------|---------------------|----------|
| Animation idle frame-swap | Nouveau système | `AnimatedAnimal` pattern (setInterval + useState frameIdx) | Identique — copier/adapter |
| Balade aléatoire | Nouveau pathfinding | `withTiming` sur `useSharedValue` offsetX/offsetY | Pattern existant dans AnimatedAnimal |
| Détection stade | Logique ad-hoc | `getCompanionStage(level)` miroir de `getTreeStage()` | Cohérence, testable |
| Messages IA | Nouveau fetch | `lib/ai-service.ts` existant | Déjà configuré, gestion erreurs, anonymisation |
| Feedback tactile | Platform API direct | `expo-haptics` — `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` | Pattern établi dans tout l'app |
| Sérialisation CSV | JSON complexe | Pattern `key: val1:val2:val3` identique à `farm_crops`, `mascot_placements` | Compatibilité Obsidian |
| Drop lootbox | Nouveau système | `lib/gamification/rewards.ts` — ajouter `rewardType: 'companion'` entries | Évite de dupliquer le pity system |

---

## Common Pitfalls

### Pitfall 1 : Sprites compagnon manquants (blocker)

**Ce qui se passe :** Les animaux compagnons (chat, chien, lapin, renard, hérisson) n'existent PAS encore dans `assets/garden/animals/`. Le projet a poussin, poulet, canard, cochon, vache — mais pas les 5 compagnons requis (D-01).
**Pourquoi :** Les sprites Mana Seed de ces 5 espèces doivent être générés/achetés/créés avant toute implémentation du rendu.
**Comment éviter :** Wave 0 du plan doit inclure la création des assets. En attendant les sprites finaux, utiliser les sprites `poussin` comme placeholder (même structure, même nommage) pour débloquer le développement.
**Signaux d'alerte :** `require()` sur un fichier inexistant crash Metro bundler au démarrage — crash immédiat si les assets ne sont pas là.

### Pitfall 2 : Champ `companion` dans parseFamille — backward compatibility

**Ce qui se passe :** Les profils existants n'ont pas de champ `companion` dans `famille.md`. `parseFamille()` renvoie `companion: undefined`, ce qui casse les composants qui supposent la présence du champ.
**Pourquoi :** Même problème rencontré en Phase 08.1 avec `gami-{id}.md` — toujours traiter l'absence du champ comme état initial valide.
**Comment éviter :** `parseCompanion(raw?: string)` retourne `null` si absent — le compagnon est affiché uniquement si non-null. Déclenchement du modal `CompanionPicker` quand `companion === null && level >= COMPANION_UNLOCK_LEVEL`.

### Pitfall 3 : Overlay natif CompanionSlot vs SVG InhabitantOverlay

**Ce qui se passe :** Les animaux pixel dans `TreeView.tsx` sont rendus via un `Animated.View` natif superposé (pas dans le `<G>` SVG), car `Animated.View` est nécessaire pour les animations React Native. Si on tente de mettre le compagnon dans le SVG, les animations ne fonctionnent pas.
**Pourquoi :** Pattern établi à la Phase 05 — `AnimatedAnimal` retourne un `Animated.View` positionné en `absolute`, pas un composant SVG.
**Comment éviter :** `CompanionSlot` suit exactement le même pattern : composant natif `Animated.View` avec `position: 'absolute'`, positionné par des coordonnées calculées depuis le viewbox SVG vers le pixel space du container.

### Pitfall 4 : Position compagnon vs inhabitants — collision visuelle

**Ce qui se passe :** Les inhabitants existants utilisent `HAB_SLOTS` et `SCENE_SLOTS` qui couvrent `ground-center`. Le compagnon sur `ground-center` va se superposer visuellement aux inhabitants.
**Pourquoi :** D-04 précise que le compagnon a "son propre slot dédié" — il faut une position réservée non utilisée par les inhabitants.
**Comment éviter :** Définir `COMPANION_SLOT_POSITION = { cx: 85, cy: 205 }` dans le viewbox — légèrement décalé du centre, hors des HAB_SLOTS existants. Ou réserver une position dans le viewbox (ex: cx:100, cy:192 = juste devant le tronc de l'arbre).

### Pitfall 5 : Messages IA — appels répétés et coût

**Ce qui se passe :** Si le message IA est déclenché à chaque `useEffect` ou focus, cela génère de nombreux appels API à Claude Haiku, avec latence visible et coût.
**Pourquoi :** `ai-service.ts` fait des appels `fetch` directs sans cache.
**Comment éviter :** Stocker le message généré dans `useRef` ou `useState` local à `tree.tsx`, ne régénérer que si les données vault ont changé depuis le dernier affichage (comparer un hash/timestamp des dernières actions). Le fallback prédéfini s'active immédiatement pendant le chargement IA.

### Pitfall 6 : Avatar compagnon dans tab bar — profileId `avatar` emoji vs sprite PNG

**Ce qui se passe :** `_layout.tsx` utilise `<Text>{p.avatar}</Text>` avec `fontSize: 40` pour l'emoji avatar. Remplacer par une `<Image>` de même taille nécessite de gérer le cas où le compagnon n'est pas encore débloqué (fallback sur l'emoji).
**Pourquoi :** Profils adultes ou profils en-dessous du niveau de déblocage n'ont pas de compagnon.
**Comment éviter :** `CompanionAvatarMini` vérifie `profile.companion !== null`, sinon retourne l'emoji. Composant mémoïsé avec `React.memo`.

### Pitfall 7 : Niveau de déblocage initial — attendre niveau 5

**Ce qui se passe :** D-01 fixe l'obtention du compagnon à un certain niveau (ex: niveau 5). L'arbre atteint le stade "pousse" à niveau 3. Pour beaucoup d'utilisateurs existants, niveau 5 peut déjà être atteint — déclencher le `CompanionPicker` au prochain lancement si `level >= 5 && companion === null`.
**Pourquoi :** Migration des données pour utilisateurs existants.
**Comment éviter :** Dans `tree.tsx`, `useEffect` sur `[activeProfile]` : si `level >= COMPANION_UNLOCK_LEVEL && !activeProfile.companion`, afficher le picker. Stocker un flag `companion_picker_shown` dans SecureStore pour ne pas le re-déclencher à chaque launch si l'utilisateur ferme sans choisir (éviter l'annoyance).

---

## Code Examples

### Calcul stade compagnon — depuis level profile

```typescript
// Source: pattern lib/mascot/engine.ts getTreeStage()
export function getCompanionStage(level: number): CompanionStage {
  for (let i = COMPANION_STAGES.length - 1; i >= 0; i--) {
    if (level >= COMPANION_STAGES[i].minLevel) return COMPANION_STAGES[i].stage;
  }
  return 'bebe';
}
// Usage: getCompanionStage(activeProfile.level) → 'bebe' | 'jeune' | 'adulte'
```

### Sérialisation companion dans famille.md

```typescript
// Format: "speciesId:nom:unlocked|species2:mood"
// Exemple: "chat:Minou:chat:content"
// Avec plusieurs débloqués: "chat:Minou:chat|lapin:excite"

export function serializeCompanion(data: CompanionData): string {
  const unlocked = data.unlockedSpecies.join('|');
  return `${data.activeSpecies}:${data.name}:${unlocked}:${data.mood}`;
}

export function parseCompanion(raw: string | undefined): CompanionData | null {
  if (!raw) return null;
  const [activeSpecies, name, unlockedRaw, mood] = raw.split(':');
  if (!activeSpecies || !name) return null;
  return {
    activeSpecies: activeSpecies as CompanionSpecies,
    name: name || '',
    unlockedSpecies: unlockedRaw ? unlockedRaw.split('|') as CompanionSpecies[] : [activeSpecies as CompanionSpecies],
    mood: (mood as CompanionMood) || 'content',
  };
}
```

### Écriture companion dans famille.md — pattern writeFarmCrops

```typescript
// Source: hooks/useFarm.ts writeFarmCrops() — pattern identique
const writeCompanion = useCallback(async (profileId: string, companionCSV: string) => {
  if (!vault) return;
  const content = await vault.readFile(FAMILLE_FILE);
  const lines = content.split('\n');
  let inSection = false;
  let fieldLine = -1;
  let lastPropIdx = -1;
  const fieldKey = 'companion';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('### ')) {
      if (inSection) break;
      if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
    } else if (inSection && lines[i].includes(': ')) {
      lastPropIdx = i;
      if (lines[i].trim().startsWith(`${fieldKey}:`)) fieldLine = i;
    }
  }
  const newValue = `${fieldKey}: ${companionCSV}`;
  if (fieldLine >= 0) {
    lines[fieldLine] = newValue;
  } else if (lastPropIdx >= 0) {
    lines.splice(lastPropIdx + 1, 0, newValue);
  }
  await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
}, [vault]);
```

### Animation tap compagnon — withSpring saut

```typescript
// Source: pattern Reanimated 4.x dans tout l'app
const jumpY = useSharedValue(0);
const scale = useSharedValue(1);

const handleTap = useCallback(() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  scale.value = withSequence(
    withSpring(1.3, { damping: 6, stiffness: 300 }),
    withSpring(1.0, { damping: 10, stiffness: 180 }),
  );
  jumpY.value = withSequence(
    withSpring(-20, { damping: 6, stiffness: 400 }),
    withSpring(0, { damping: 10, stiffness: 180 }),
  );
  // Afficher particules coeurs/étoiles pendant 1.5s
  showReactionBurst();
}, []);
```

### Ajout companion dans lootbox rewards.ts

```typescript
// Source: lib/gamification/rewards.ts REWARDS pool (pattern existant)
// Ajouter dans `rare` pool :
{ emoji: '🐱', reward: 'Compagnon Chat !', bonusPoints: 0, rewardType: 'companion', mascotItemId: 'chat' },
{ emoji: '🐰', reward: 'Compagnon Lapin !', bonusPoints: 0, rewardType: 'companion', mascotItemId: 'lapin' },
// Ajouter dans `épique` pool :
{ emoji: '🦊', reward: 'Compagnon Renard (Épique) !', bonusPoints: 0, rewardType: 'companion', mascotItemId: 'renard' },
```

Et dans `lib/types.ts` ajouter `'companion'` à `RewardType`.

---

## State of the Art

| Ancienne approche | Approche actuelle dans le projet | Impact |
|---|---|---|
| Inhabitants cosmétiques = seuls animaux | Compagnon = animal dédié avec slot propre | Ne pas mélanger les deux systèmes |
| `profile.avatar` = emoji seul | `profile.avatar` reste emoji, `profile.companion` = sprite PNG | Compatibilité profils sans compagnon |
| Thought bubbles = pool d'emojis/texte courts | Message compagnon = texte contextuel long + IA | Composant distinct de la thought bubble |

---

## Integration Points détaillés

### Fichiers à modifier

| Fichier | Modification | Complexité |
|---------|-------------|------------|
| `lib/types.ts` | Ajouter `CompanionData` interface + `companion?: CompanionData \| null` sur `Profile` + `'companion'` dans `RewardType` | Faible |
| `lib/parser.ts` | `parseCompanion()` + lire `companion:` dans `parseFamille()` flush() | Faible |
| `lib/gamification/rewards.ts` | Ajouter 5 entrées compagnon dans les pools rare/épique | Faible |
| `hooks/useVault.ts` | Exposer `setCompanion()`, `unlockCompanion()`, lire `companion` depuis profil | Moyen |
| `hooks/useGamification.ts` | Appliquer bonus passif +5% XP si compagnon actif | Faible |
| `components/mascot/TreeView.tsx` | Ajouter props `companion` + `onCompanionTap` + `CompanionSlot` overlay | Moyen |
| `app/(tabs)/tree.tsx` | Déclencher CompanionPicker si non débloqué, passer companion à TreeView | Moyen |
| `app/(tabs)/_layout.tsx` | `CompanionAvatarMini` dans profile picker | Faible |
| `locales/fr/common.json` + `locales/en/common.json` | Namespace `companion.*` : stades, humeurs, messages, picker | Moyen |

### Fichiers à créer

| Fichier | Contenu | Complexité |
|---------|---------|------------|
| `lib/mascot/companion-engine.ts` | Pure functions : stades, humeurs, messages, bonus XP | Moyen |
| `lib/mascot/companion-types.ts` | Types + constantes + catalogue espèces + COMPANION_STAGES | Faible |
| `components/mascot/CompanionSlot.tsx` | `AnimatedAnimal`-style + tap handler + message bubble | Moyen |
| `components/mascot/CompanionPicker.tsx` | Modal pageSheet, choix initial parmi 3-5 espèces, nommage | Moyen |
| `assets/garden/animals/chat/` | Sprites PNG : idle_1/2, walk_down_1-8, walk_left_1-8 (× 3 stades = 9 variants) | **Élevé — asset work** |
| `assets/garden/animals/chien/` | Même structure | Élevé |
| `assets/garden/animals/lapin/` | Même structure | Élevé |
| `assets/garden/animals/renard/` | Même structure | Élevé |
| `assets/garden/animals/herisson/` | Même structure | Élevé |

### Décisions restant à Claude (from Context.md)

Recommandations basées sur la recherche :

- **Mapping niveaux → stades** : Bébé niv 1-5 / Jeune niv 6-10 / Adulte niv 11+ — aligné sur les paliers d'arbre existants (pousse=3, arbuste=6-10, arbre=11+)
- **Nombre de compagnons initiaux** : 5 (chat, chien, lapin, renard, hérisson) — 5 donne assez de choix sans être overwhelming, et 5 espèces correspondent à l'attachment émotionnel visé (D-01)
- **Bonus passif** : +5% XP (multiplicateur 1.05 dans `addPoints()`) plutôt que +1 récolte — plus simple à implémenter, ne requiert pas de timer de récolte, impacte directement la progression principale. Ajouter un flag `companionBonusActive: boolean` dans `GamificationData` ou simplement tester `activeProfile.companion !== null` dans le hook
- **Format sérialisation** : `companion: speciesId:nom:unlockedSpecies1|speciesId2:mood` — 4 champs CSV, extensible, lisible dans Obsidian
- **Pool de phrases** : 3-5 phrases par événement (task_completed, loot_opened, level_up, greeting_morning, greeting_evening, streak_milestone), avec `{name}` et `{companionName}` comme variables de template

---

## Environment Availability

Step 2.6: SKIPPED — cette phase est purement code/assets React Native, aucune dépendance externe au-delà du stack Expo existant.

---

## Sources

### Primary (HIGH confidence)

- Code source `components/mascot/TreeView.tsx` (lu directement) — pattern `AnimatedAnimal` vérifié
- Code source `lib/mascot/engine.ts` (lu directement) — pattern `getTreeStage()` confirmé
- Code source `hooks/useFarm.ts` (lu directement) — pattern `writeFarmCrops()` confirmé
- Code source `lib/parser.ts` (lu directement) — `parseFamille()` flush() pattern confirmé
- Code source `lib/gamification/rewards.ts` (lu directement) — pool lootbox + RewardType confirmés
- Code source `lib/types.ts` (lu directement) — `Profile` interface + champs existants confirmés
- Code source `app/(tabs)/_layout.tsx` (lu directement) — avatar usage confirmé
- `assets/garden/animals/` inventaire (ls) — sprites existants inventoriés : poussin, poulet, canard, cochon, vache — AUCUN sprite compagnon existant

### Secondary (MEDIUM confidence)

- `CONTEXT.md` phase 10 — décisions utilisateur confirmées
- `STATE.md` — patterns et décisions des phases précédentes (CSV format, backward compat)

---

## Metadata

**Confidence breakdown:**

- Architecture patterns : HIGH — basé sur lecture directe du code existant, patterns déjà éprouvés dans les phases 5-8
- Standard stack : HIGH — aucune nouvelle dépendance, stack 100% connu
- Pitfalls : HIGH — identifiés depuis le code réel (AnimatedAnimal overlay natif vs SVG, absence sprites compagnon, backward compat parseFamille)
- Assets sprites : LOW (bloquant) — aucun sprite compagnon n'existe, création artistique requise avant implémentation

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stack Expo stable, pas de dépendances externes volatiles)
