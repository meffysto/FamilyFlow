# Phase 42: Nourrir le compagnon - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** --auto (décisions verrouillées en amont par le user, Option B validée)

<domain>
## Phase Boundary

Permettre au joueur de **nourrir son compagnon** avec les crops de son inventaire récolte pour déclencher un **buff XP temporaire**, dont la puissance dépend du **grade** du crop et de l'**affinité espèce/crop**. Connecte la ferme (récoltes) au gameplay compagnon et donne un second usage aux crops en plus des crafts.

**Livré :**
- Action "Nourrir" accessible depuis la carte compagnon (tap long sur compagnon OU bouton dédié)
- Sheet picker des crops de l'inventaire avec grade
- Buff XP empilé sur `COMPANION_XP_BONUS` (1.05) actuel
- Animation manger + particules + message contextualisé
- Live Activity mise à jour avec buff actif
- Refonte `SpeciesPicker` → `CompanionCard` (Nourrir primaire, Changer espèce secondaire)

**Non livré (scope creep) :**
- Barre de faim visible (système implicite via cooldown, pas de hunger bar)
- Traits visuels long-terme (Option C)
- Buff sur les feuilles ou la ferme
- Modifications grades existants (grades = feuilles via crafts, reste intact)

</domain>

<decisions>
## Implementation Decisions

### Déclenchement & UX
- **D-01:** Action "Nourrir" accessible depuis deux points d'entrée — (a) tap long sur compagnon dans scene ferme, (b) bouton "Nourrir" primaire sur la carte compagnon refondue (ex-SpeciesPicker)
- **D-02:** Picker = sheet modale présentant les crops disponibles groupés par espèce, avec badge grade visible (ordinaire/bon/excellent/parfait)
- **D-03:** Crops détestés visibles mais marqués (pastille 😖 ou opacité réduite) — le joueur peut quand même choisir, mais l'anim sera "beurk" sans buff
- **D-04:** Crops préférés mis en avant (badge ❤️ ou ordre de tri remontant) pour guider le choix

### Buff XP — calcul
- **D-05:** Tableau grade → (multiplicateur, durée) :
  - Ordinaire : ×1.05 / 30min
  - Bon : ×1.10 / 45min
  - Excellent : ×1.12 / 60min
  - Parfait : ×1.15 / 90min
- **D-06:** Affinité : préféré ×1.3 multiplicateur, neutre ×1, détesté = buff null (pas d'application)
- **D-07:** Empilage multiplicatif avec `COMPANION_XP_BONUS` existant (1.05) : XP = base × 1.05 × feedBuff.multiplier
- **D-08:** Buff agit UNIQUEMENT sur XP (tâches, routines, défis, missions secrètes, gratitude). Pas les feuilles, pas les récoltes, pas la croissance crops, pas la ferme.
- **D-09:** Un seul buff actif à la fois (nouveau buff remplace l'ancien si cooldown écoulé)

### Cooldown & persistence
- **D-10:** Cooldown 3h entre nourrissages — contrôle via `lastFedAt` ISO string persisté dans `CompanionData`
- **D-11:** Pendant cooldown, bouton "Nourrir" devient "😋 Rassasié · Xh Ym" (disabled)
- **D-12:** Buff peut expirer avant la fin du cooldown (ex: parfait buff 1h30 + cooldown 3h = 1h30 sans buff ni possibilité de renourrir)

### Affinités par espèce (constantes)
- **D-13:** Mapping figé dans `companion-types.ts` (REVISÉ 2026-04-22 : poisson/os/champignon/oignon absents du CROP_CATALOG → redistribution dans crops existants, toutes espèces uniques) :
  - Chat : préféré = `strawberry` (fraise), déteste = `cucumber` (concombre)
  - Chien : préféré = `pumpkin` (potiron), déteste = `tomato` (tomate)
  - Lapin : préféré = `carrot` (carotte), déteste = `corn` (maïs)
  - Renard : préféré = `beetroot` (betterave), déteste = `wheat` (blé)
  - Hérisson : préféré = `potato` (pomme de terre), déteste = `cabbage` (chou)
- **D-14:** Second préféré skippé pour v1 — toutes les autres crops sont neutres. Extension future possible.
- **D-13-bis (deferred v1.8+):** Étendre CROP_CATALOG avec fish/bone/mushroom/onion pour restaurer le design original "poisson pour chat, os pour chien, champignon pour hérisson" — nécessite emojis + grades + drops + nouveau loot expédition/lac. Hors scope Phase 42.

### État persisté (CompanionData)
- **D-15:** Ajout de deux champs optionnels dans `CompanionData` :
  - `lastFedAt?: string` (ISO)
  - `feedBuff?: { multiplier: number; expiresAt: string } | null`
- **D-16:** Absence (undefined/null) = aucun buff actif, nourrissable immédiatement. Non-cassant pour compagnons existants.
- **D-17:** `CACHE_VERSION` bumpé dans `lib/vault-cache.ts:41` car shape CompanionData change

### Animation & feedback
- **D-18:** Animation manger = 3-5 frames (réutiliser structure walk existante de `CompanionSlot.tsx`)
- **D-19:** Particules emoji selon affinité :
  - Préféré : cœurs 💕 (anim floating up)
  - Neutre : bulles 😊
  - Détesté : vent/dégout 💨 + compagnon recule
- **D-20:** Haptic feedback `Haptics.impactAsync(Heavy)` sur feed confirmé préféré, `Light` sinon
- **D-21:** Message contextualisé poussé dans `companion_messages` via storage existant :
  - Préféré + parfait : "🥕✨ Ma {crop} préférée en version parfaite ! Je t'adore !"
  - Préféré standard : "🥕 Mmm ma préférée, merci !"
  - Neutre : "🥔 Merci, c'était bon."
  - Détesté : "😖 Berk… je déteste ça."

### Live Activity
- **D-22:** Ajout champ `feedBuffActive?: { multiplier: number; expiresAtIso: string }` dans `MascotteSnapshot` (lib/mascotte-live-activity.ts)
- **D-23:** Quand buff actif, `speechBubble` devient `"Boosté ! +{X}% XP ⚡ ({Nmin})"` (≤44 chars, remplace subtitle par défaut)
- **D-24:** Trigger `refreshMascotte()` après un feed pour push immédiat au lock screen
- **D-25:** Module natif iOS (`modules/vault-access/src`) peut rester inchangé pour v1 — on transmet via `speechBubble` existante (MVP). Évolution possible : champ dédié `buffLabel` dans une phase future.

### UI — CompanionCard (refonte SpeciesPicker)
- **D-26:** Nouveau composant `CompanionCard` remplace/englobe `SpeciesPicker` :
  - Avatar animé du compagnon (réutilise `CompanionAvatarMini` ou `CompanionSlot` en format statique)
  - Nom + espèce + stade
  - Buff actif affiché en chip ("✨ +15% XP · 47min") si présent
  - Bouton primaire "Nourrir" (ou "Rassasié · 2h14" disabled)
  - Bouton secondaire "Changer d'espèce" → ouvre l'ancien picker existant
- **D-27:** `SpeciesPicker` actuel devient un sous-composant modal ouvert depuis "Changer d'espèce" — pas de suppression, juste réorganisation

### Intégration tree.tsx
- **D-28:** `CompanionCard` remplace l'appel actuel de `SpeciesPicker` dans l'écran Arbre/Jardin
- **D-29:** Tap long sur sprite compagnon dans scene déclenche aussi l'ouverture du picker crops (via handler de gesture)

### Parser & persistence
- **D-30:** Parser profil (parseProfile dans lib/parser.ts) étendu pour lire/écrire `lastFedAt` et `feedBuff` dans frontmatter companion
- **D-31:** Sérialisation ISO strings, JSON stringify pour `feedBuff` si stocké en frontmatter (ou split en `feedBuff.multiplier` / `feedBuff.expiresAt` — à trancher au plan)

### Claude's Discretion
- Format exact de sérialisation `feedBuff` dans markdown frontmatter (flat vs nested)
- Micro-animations exactes (timing springs)
- Layout final CompanionCard (stack vertical vs horizontal — doit respecter UX ferme existante)
- Structure du picker crops (grid vs list)
- Copy/wording exact des messages (D-21 donne le ton, variantes acceptables)
- Choix entre tap long (500-800ms) — Claude tranche au plan

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture compagnon & ferme
- `lib/mascot/companion-types.ts` — types CompanionData + espèces (shape à étendre)
- `lib/mascot/companion-engine.ts` — pure functions mood/stage (ajouter feedCompanion)
- `lib/mascot/companion-storage.ts` — persistance companion_messages (réutiliser pour push message après feed)
- `lib/mascot/types.ts` §362-389 — CROP_CATALOG (17 crops) + HarvestInventory par grade

### Gamification & XP
- `lib/gamification/engine.ts` — `COMPANION_XP_BONUS = 1.05` à empiler

### UI existante
- `components/mascot/SpeciesPicker.tsx` — picker actuel à refondre en CompanionCard
- `components/mascot/CompanionSlot.tsx` — sprite animé (animations walk à étendre avec eat)
- `components/mascot/CompanionAvatarMini.tsx` — avatar compact réutilisable
- `app/(tabs)/tree.tsx` — screen d'intégration

### Live Activity
- `lib/mascotte-live-activity.ts` — interface MascotteSnapshot + refreshMascotte
- `modules/vault-access/src` — module natif iOS (inchangé pour v1)

### Cache & persistence
- `lib/vault-cache.ts:41` — CACHE_VERSION à bumper
- `lib/parser.ts` — parseProfile/serializeProfile (étendre avec lastFedAt + feedBuff)

### Project
- `.planning/PROJECT.md` — Core Value: stabilité + non-régression
- `CLAUDE.md` — conventions FR, reanimated obligatoire, Haptics pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CompanionSlot.tsx`** — sprite 48px avec walk animations multi-directions, peut accueillir nouvelles frames "eat" via la même structure (6-8 frames par direction/stade déjà en place)
- **`CROP_CATALOG`** — 17 crops avec emojis + catégories, IDs stables utilisables comme clés de préférences
- **`HarvestInventory`** — structure par grade déjà prête (ordinaire/bon/excellent/parfait), itérable pour picker
- **`companion_messages`** — stockage SecureStore `companion_messages_{profileId}`, garde 5 derniers messages — réutilisable directement
- **`COMPANION_XP_BONUS`** — constante 1.05 déjà appliquée dans calcul XP, point d'ancrage naturel pour empilage
- **`Haptics.impactAsync`** — pattern établi pour feedback tactile
- **`MascotteSnapshot`** — interface Live Activity avec `speechBubble` ≤44 chars, push via `refreshMascotte()`

### Established Patterns
- **Animations** : react-native-reanimated (`useSharedValue` + `withSpring`) — PAS RN Animated
- **Thème** : `useThemeColors()` obligatoire, jamais de hardcoded
- **Modals** : présentation `pageSheet` + drag-to-dismiss
- **Errors non-critiques** : `catch { /* non-critical */ }` silencieux
- **Cache bump** : `CACHE_VERSION` dans `lib/vault-cache.ts:41` quand shape CompanionData change (documenté dans CLAUDE.md)
- **Parser pattern** : parse* / serialize* pairs dans `lib/parser.ts` avec gray-matter frontmatter

### Integration Points
- **VaultContext** (`contexts/VaultContext.tsx`) — source unique d'état, expose useVault() hook
- **useVault** (`hooks/useVault.ts`) — orchestrateur avec 21 hooks domaine — feedCompanion sera une mutation dans le hook companion
- **XP calculation site** dans `lib/gamification/engine.ts` — point unique où empiler feedBuff
- **ThemeColors** pour le buff chip couleurs (success/warning)
- **Dashboard** (`app/(tabs)/index.tsx`) — `CompanionAvatarMini` y est déjà utilisé, peut afficher buff chip

</code_context>

<specifics>
## Specific Ideas

- **Inspiration Tamagotchi/Stardew Valley** : nourrir un animal qui réagit — le joueur doit sentir l'**affect** du compagnon
- **Parfait + Préféré = jackpot** : buff max ×1.15 × 1.3 = +19.5% XP sur 1h30, célébré visuellement (particules renforcées, message enthousiaste)
- **Détesté = feedback clair** : anim "beurk", pas de punition autre que gâcher le crop (design bienveillant, conforme Core Value)
- **Boucle d'engagement quotidienne** : cooldown 3h → 2-3 feeds/jour max — rythme organique sans obligation
- **Affinité = vraie décision** : si le joueur a un chat et que sa meilleure récolte est un potiron, il doit *choisir* (stocker pour crafter OU feed en neutre)
- **Live Activity = visibilité** : le buff doit se voir sur le lock screen pour créer l'envie de renourrir

</specifics>

<deferred>
## Deferred Ideas

### Pour milestone v1.8+ "Compagnon Vivant" (si un jour)
- **Barre de faim explicite** (0-100) avec décroissance horaire et état visuel (affamé/rassasié)
- **Second préféré** par espèce (déjà pensé mais skippé pour v1)
- **Évolution visuelle long-terme** (Option C) : nourrir X fois avec type → trait visuel débloqué
- **Plat préféré du jour rotatif** avec bonus bonus
- **Carnet de santé** avec stats long terme
- **Buff autres pilier app** : gratitude, routines complétées, etc. (actuellement : tout XP uniformément)
- **Champ dédié `buffLabel` dans module natif Live Activity** (plus propre que speechBubble override)
- **Sound design** (hors scope Phase 42 — pas d'audio dans l'app aujourd'hui)
- **Compagnon qui refuse activement** (tombe malade si trop de détesté, etc.)

</deferred>

---

*Phase: 42-nourrir-le-compagnon*
*Context gathered: 2026-04-22 (auto mode — décisions pré-validées par user en amont)*
