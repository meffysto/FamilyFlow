# Phase 9: Cadeaux Familiaux - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Les membres de la famille peuvent s'envoyer des récoltes, graines rares, items craftés et ressources de bâtiments. Un système de cadeaux en attente (fichiers Markdown) permet la réception asynchrone. L'envoi se fait par long-press sur un item d'inventaire, la réception via une animation cadeau au prochain refresh. Historique des échanges visible dans le profil.

</domain>

<decisions>
## Implementation Decisions

### UX du Partage
- Long-press sur un item d'inventaire ouvre un menu contextuel avec option "Offrir"
- Bottom sheet avec avatars des profils familiaux pour choisir le destinataire (tap = envoi)
- Tous les items sauf décorations/habitants sont partageables : récoltes, graines rares, items craftés, ressources bâtiments (oeuf, lait, farine, miel)
- Sélecteur de quantité (+/- ou slider) pour envoyer plusieurs items d'un coup

### Popup de Réception
- Animation "cadeau qui tombe" avec spring bounce — paquet animé qui s'ouvre, haptic feedback, confetti léger
- La popup apparaît au prochain refresh/ouverture de l'app via fichier `gifts-pending-{id}.md`
- Affiche avatar de l'expéditeur + nom de l'item + animation d'ajout à l'inventaire ("Lucas t'a envoyé 3 fraises !")
- Section "Cadeaux récents" dans le profil — 10 derniers échanges avec date/expéditeur/item

### Mécanique & Données
- Format : `gifts-pending-{profileId}.md` avec frontmatter YAML, un fichier par destinataire, consommé à l'ouverture
- +5 XP par cadeau envoyé + badge "Généreux" après 10 cadeaux
- Max 5 cadeaux/jour par expéditeur (anti-abus enfants)
- Notification Telegram au destinataire via template `gift_received` existant

### Claude's Discretion
- Animations exactes et spring configs
- Layout précis du bottom sheet de sélection de destinataire
- Format exact du fichier gifts-pending YAML
- Ordre d'affichage dans l'historique des cadeaux

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FarmPlots.tsx` — grille de plots avec TouchableOpacity, peut être étendu pour long-press
- `parseFarmProfile()` / `serializeFarmProfile()` dans `lib/parser.ts` — parse farm-{id}.md
- `parseGamification()` / `serializeGamification()` — parse gami-{id}.md
- Bottom sheet pattern existant dans CompanionPicker, shop overlays
- `dispatchNotificationAsync()` dans `lib/notifications.ts` — dispatch Telegram templated
- `applyFamilyBonus()` dans gamification engine — seul transfert cross-profil existant
- Confetti cannon (`react-native-confetti-cannon`) déjà utilisé pour loot boxes

### Established Patterns
- Inventaire stocké dans `farm-{profileId}.md` avec 4 buckets : HarvestInventory, RareSeedInventory, FarmInventory (building resources), CraftedItem[]
- Profils parsés via `parseFamille()` depuis `famille.md`
- Per-profile files : `gami-{id}.md` (XP/coins) + `farm-{id}.md` (ferme/inventaire)
- `mergeProfiles()` joint identité + runtime state
- Animations : react-native-reanimated avec withSpring, useSharedValue, useAnimatedStyle
- Haptics : `expo-haptics` sur interactions importantes

### Integration Points
- `hooks/useFarm.ts` — callbacks pour modifier inventaire (plant, harvest, craft, sell)
- `hooks/useGamification.ts` — addXP, badges, loot
- `components/mascot/` — scene ferme, TreeView, overlays
- `lib/notifications.ts` — ajout template `gift_received`
- `contexts/VaultContext.tsx` — refresh() pour recharger les données

</code_context>

<specifics>
## Specific Ideas

- L'utilisateur veut pouvoir partager TOUT ce qui est possible (graines, crafts, récoltes, ressources bâtiments)
- Pop-up inventive pour la réception — pas juste un toast, une vraie animation cadeau
- Bouton de partage quelque part d'accessible — long-press choisi comme solution
- "Soit inventif" — animation cadeau spring avec confetti, avatar expéditeur, message personnalisé

</specifics>

<deferred>
## Deferred Ideas

- Système d'échange (troc) — demander un item en retour
- Wishlist partagée — dire aux autres ce qu'on veut recevoir
- Cadeaux programmés — envoyer à une date future (anniversaire)

</deferred>
