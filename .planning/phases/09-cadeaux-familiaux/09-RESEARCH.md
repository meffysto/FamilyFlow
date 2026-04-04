# Phase 9: Cadeaux Familiaux - Research

**Researched:** 2026-04-04
**Domain:** Transfert d'inventaire cross-profil, fichier pending Markdown, animation réception cadeau
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**UX du Partage**
- Long-press sur un item d'inventaire ouvre un menu contextuel avec option "Offrir"
- Bottom sheet avec avatars des profils familiaux pour choisir le destinataire (tap = envoi)
- Tous les items sauf décorations/habitants sont partageables : récoltes, graines rares, items craftés, ressources bâtiments (oeuf, lait, farine, miel)
- Sélecteur de quantité (+/- ou slider) pour envoyer plusieurs items d'un coup

**Popup de Réception**
- Animation "cadeau qui tombe" avec spring bounce — paquet animé qui s'ouvre, haptic feedback, confetti léger
- La popup apparaît au prochain refresh/ouverture de l'app via fichier `gifts-pending-{id}.md`
- Affiche avatar de l'expéditeur + nom de l'item + animation d'ajout à l'inventaire ("Lucas t'a envoyé 3 fraises !")
- Section "Cadeaux récents" dans le profil — 10 derniers échanges avec date/expéditeur/item

**Mécanique & Données**
- Format : `gifts-pending-{profileId}.md` avec frontmatter YAML, un fichier par destinataire, consommé à l'ouverture
- +5 XP par cadeau envoyé + badge "Généreux" après 10 cadeaux
- Max 5 cadeaux/jour par expéditeur (anti-abus enfants)
- Notification Telegram au destinataire via template `gift_received` existant

### Claude's Discretion
- Animations exactes et spring configs
- Layout précis du bottom sheet de sélection de destinataire
- Format exact du fichier gifts-pending YAML
- Ordre d'affichage dans l'historique des cadeaux

### Deferred Ideas (OUT OF SCOPE)
- Système d'échange (troc) — demander un item en retour
- Wishlist partagée — dire aux autres ce qu'on veut recevoir
- Cadeaux programmés — envoyer à une date future (anniversaire)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOC-01 | Un membre peut envoyer une récolte ou un item crafté à un autre membre de la famille | Inventaire dans `farm-{id}.md` — 4 buckets déjà parsés. Pattern d'écriture cross-profil via `writeProfileFields`. Long-press sur items CraftSheet. |
| SOC-02 | Le destinataire reçoit une notification et l'item apparaît dans son inventaire | `dispatchNotificationAsync` existant pour Telegram. Pattern fichier pending `gifts-pending-{id}.md` — lu au refresh via `refreshFarm`. |
</phase_requirements>

---

## Summary

Phase 9 implémente un système de cadeaux cross-profil entièrement local (pas de backend). Un profil peut offrir des items de son inventaire à un autre profil familial. Le mécanisme repose sur un fichier Markdown intermédiaire `gifts-pending-{recipientId}.md` (frontmatter YAML) déposé dans le vault — le destinataire le consomme à son prochain refresh, animant la réception puis transférant l'item dans son propre `farm-{id}.md`.

La complexité principale est la séquence de lecture-modification-écriture atomique sur deux fichiers distincts (expéditeur et destinataire), plus la fenêtre de temps entre dépôt et consommation du pending. Le pattern `enqueueWrite` + `writeProfileFields` existant couvre déjà les écritures sur `farm-{id}.md`. Un nouveau hook `useGifts` (ou extension de `useFarm`) encapsulera la logique send/receive.

L'animation de réception est la pièce la plus inventive : modal spring avec confetti léger (ConfettiCannon déjà importé), haptic feedback, puis interpolation vers l'inventaire. La popup est déclenchée par détection du fichier pending au `refreshFarm` dans `VaultContext`.

**Primary recommendation:** Ajouter `sendGift` dans `useFarm` (écriture expéditeur + dépôt pending), détecter et consommer le pending dans `refreshFarm`, et créer `GiftReceiptModal` + `GiftSenderSheet` comme composants isolés dans `components/mascot/`.

---

## Standard Stack

### Core — déjà présent dans le projet

| Librairie | Version | Usage dans cette phase | Statut |
|-----------|---------|----------------------|--------|
| react-native-reanimated | ~4.1.1 | Animation spring du paquet cadeau | Installé |
| expo-haptics | ~15.0.8 | Feedback tactile à la réception | Installé |
| react-native-confetti-cannon | ^1.5.2 | Confetti léger réception cadeau | Installé |
| gray-matter | ^4.0.3 | Frontmatter YAML pour `gifts-pending-{id}.md` | Installé |
| i18next / react-i18next | ^25 / ^16 | Traductions FR/EN nouveaux strings | Installé |
| expo-notifications | ^0.32.16 | Notification locale optionnelle | Installé |

**Aucune nouvelle dépendance requise.** Tout est déjà dans le projet.

---

## Architecture Patterns

### Fichiers vault concernés

```
vault/
├── farm-{senderId}.md         # Inventaire expéditeur — item retiré ici
├── farm-{recipientId}.md      # Inventaire destinataire — item ajouté ici
├── gami-{senderId}.md         # +5 XP expéditeur, compteur gifts_sent
└── gifts-pending-{recipientId}.md   # Fichier intermédiaire (NOUVEAU)
```

### Format `gifts-pending-{recipientId}.md`

```yaml
---
gifts:
  - sender_id: lucas
    sender_name: Lucas
    sender_avatar: "🐉"
    item_type: harvest        # harvest | rare_seed | crafted | building_resource
    item_id: strawberry       # cropId, recipeId, ou resource key
    quantity: 3
    sent_at: "2026-04-04T10:30:00.000Z"
  - sender_id: lucas
    item_type: crafted
    item_id: confiture_fraise
    quantity: 1
    sent_at: "2026-04-04T10:35:00.000Z"
---
```

Un seul fichier par destinataire. Les cadeaux s'accumulent si le destinataire n'a pas ouvert l'app. Le fichier est **supprimé** après consommation (pas remis à zéro — suppression propre via `vault.deleteFile`).

### Pattern 1 : Envoi (sendGift dans useFarm)

**Ce qui se passe :**
1. Lire `farm-{senderId}.md` — vérifier quantité disponible
2. Retirer la quantité de l'inventaire expéditeur
3. Lire `gifts-pending-{recipientId}.md` — si existe, merger ; sinon créer
4. Écrire le pending mis à jour
5. Écrire `farm-{senderId}.md` avec inventaire réduit
6. Lire `gami-{senderId}.md` — ajouter +5 XP via `addPoints`, incrémenter `gifts_sent`
7. Écrire `gami-{senderId}.md`
8. `dispatchNotificationAsync('gift_received', context, notifPrefs)`

**Atomicité :** Les étapes 2-5 ne sont PAS dans `enqueueWrite(famille.md)` car elles touchent des fichiers différents. Les writes farm-{id}.md sont indépendants entre profils — pas de race condition cross-profil possible sur iCloud (chaque fichier est son propre document coordiné par NSFileCoordinator).

**Anti-abus (max 5/jour) :** `gifts_sent` dans `gami-{senderId}.md` stocke la date du dernier reset + le compteur journalier. Vérifier côté expéditeur avant d'autoriser l'envoi.

### Pattern 2 : Réception (dans refreshFarm)

```typescript
// Dans refreshFarm(profileId) — déjà appelé au refresh app
const pendingFile = `gifts-pending-${profileId}.md`;
const pendingContent = await vault.readFile(pendingFile).catch(() => null);
if (pendingContent) {
  const pending = parsePendingGifts(pendingContent);  // NOUVELLE fonction
  if (pending.gifts.length > 0) {
    // 1. Appliquer chaque gift sur farm-{profileId}.md
    // 2. Supprimer le fichier pending
    // 3. Stocker les gifts dans state React pour déclencher la modal
    setPendingGiftsToShow(pending.gifts);
  }
}
```

La modal de réception est déclenchée par `pendingGiftsToShow.length > 0` — un effet dans `app/(tabs)/tree.tsx` ou dans `WorldGridView` détecte et affiche `GiftReceiptModal`.

### Pattern 3 : Historique des cadeaux

Le champ `gift_history` dans `farm-{profileId}.md` stocke les 10 derniers échanges (envoyés et reçus) :

```
gift_history: 2026-04-04T10:30Z|sent|lucas→emma|harvest:strawberry:3, 2026-04-04T11:00Z|received|emma←lucas|harvest:strawberry:3
```

Format CSV pipe-séparé, même pattern que `farm_buildings` et `wear_events`. Limité à 10 entrées au serializing (slice des 10 plus récentes).

### Structure fichiers nouveaux

```
components/mascot/
├── GiftSenderSheet.tsx     # Bottom sheet : choix destinataire + quantité
└── GiftReceiptModal.tsx    # Modal animée : animation paquet + confetti

lib/mascot/
└── gift-engine.ts          # parsePendingGifts, serializePendingGifts, buildGiftContext
```

### Intégration dans CraftSheet (long-press inventaire)

Le long-press sur les items d'inventaire est ajouté dans `CraftSheet.tsx` (onglet "Inventaire"). La `FarmPlot` (`FarmPlots.tsx`) n'est **pas** le point d'entrée — c'est le catalogue d'inventaire dans CraftSheet qui liste récoltes, crafts, graines rares et ressources.

```typescript
// Dans renderInventoryItem (CraftSheet ou nouveau InventoryGrid)
<Pressable
  onLongPress={() => onOfferItem(itemType, itemId, maxQty)}
  onPress={() => { /* comportement existant sell/details */ }}
  delayLongPress={400}
>
```

`onOfferItem` remonte vers `tree.tsx` qui ouvre `GiftSenderSheet`.

### Anti-Patterns à éviter

- **Ne pas stocker l'historique dans `gami-{id}.md`** — ce fichier n'est pas conçu pour des données texte volumineuses. Utiliser `farm-{id}.md` comme les autres champs inventory.
- **Ne pas bloquer le UI sur l'écriture du pending** — `sendGift` doit être `fire-and-forget` avec `showToast` optimiste. Retourner l'erreur uniquement si la lecture de l'inventaire expéditeur échoue.
- **Ne pas lire `famille.md` pour les transferts** — le split per-profil est l'invariant architectural depuis Phase 08.1. Les gifts s'écrivent uniquement dans les fichiers `farm-{id}.md` et `gami-{id}.md` per-profil.
- **Ne pas supprimer l'item de l'expéditeur après affichage modal** — l'item doit être retiré **avant** le dépôt du pending, pas à la réception. Évite la duplication si l'app crash entre les deux.
- **Ne pas utiliser `perspective` dans les transforms d'animation** — CLAUDE.md : utiliser `scaleX` pour les flips, éviter la clipping 3D.

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser plutôt | Pourquoi |
|----------|------------------|-----------------|----------|
| XP expéditeur | Écriture manuelle gami | `addPoints(profile, 5, '🎁 Cadeau envoyé')` + pattern existant | Même que awardTaskCompletion, gère multiplier |
| Confetti réception | Canvas custom | `react-native-confetti-cannon` déjà importé dans `EvolutionOverlay.tsx` | Déjà utilisé, loot boxes pattern identique |
| Notification Telegram | sendTelegram direct | `dispatchNotificationAsync('gift_received', ctx, notifPrefs)` | Infrastructure de template existante |
| Serialization YAML | gray-matter custom | `parsePendingGifts` simple (frontmatter standard) | gray-matter gère YAML array natif |
| Bottom sheet avatars | Modal custom | Pattern `Modal` + `presentationStyle="pageSheet"` + `ModalHeader` | CompanionPicker.tsx est le modèle exact |
| Write queue | Mutex custom | `enqueueWrite` de `lib/famille-queue.ts` **si** un fichier commun est touché | Farm-{id}.md files sont indépendants |

---

## Common Pitfalls

### Pitfall 1 : Race condition sur gifts-pending lors d'envois simultanés

**Ce qui se passe :** Deux profils envoient un cadeau au même destinataire en même temps (multi-device iCloud). Le deuxième écrase le premier.

**Pourquoi :** Read-modify-write non atomique sur `gifts-pending-{recipientId}.md`.

**Comment éviter :** Merger en append-only : lire le pending existant, ajouter le nouveau gift à la liste, réécrire. Si le fichier n'existe pas, créer. NSFileCoordinator (via le module natif vault-access) serialise les accès iCloud — un seul device écrit à la fois. Pour les cas multi-device, la liste YAML accumule les entrées sans perte.

**Signes d'alerte :** Un cadeau reçu est "mangé" silencieusement — vérifier que `parsePendingGifts` retourne un array et non un objet scalaire.

### Pitfall 2 : Double-consommation du pending

**Ce qui se passe :** `refreshFarm` est appelé deux fois rapidement (AppState change + manuel). Le pending est consommé deux fois — l'item est ajouté deux fois à l'inventaire.

**Pourquoi :** `setPendingGiftsToShow` est asynchrone, le fichier n'est pas encore supprimé quand le second refresh lit.

**Comment éviter :** Supprimer le fichier **avant** d'appliquer les gifts à l'inventaire (approche "claim first"). Si l'écriture de l'inventaire échoue ensuite, le gift est perdu plutôt que dupliqué — le bon tradeoff pour une app familiale (jamais de duplication de ressources).

```typescript
// Ordre correct :
await vault.deleteFile(pendingFile);     // 1. Claim
await applyGiftsToInventory(gifts);      // 2. Apply
setPendingGiftsToShow(gifts);            // 3. Animate
```

### Pitfall 3 : Anti-abus enfants — reset du compteur journalier

**Ce qui se passe :** `gifts_sent` dans `gami-{id}.md` stocke un entier brut sans date. Le compteur n'est jamais resetté → blocage permanent après 5 envois totaux.

**Comment éviter :** Stocker `gifts_sent_today: 5|2026-04-04` (compteur + date ISO). Au read, si la date est différente d'aujourd'hui, remettre le compteur à 0.

### Pitfall 4 : Long-press conflit avec ScrollView

**Ce qui se passe :** `delayLongPress` trop court → le scroll est interrompu. CLAUDE.md précise ce pattern.

**Comment éviter :** `delayLongPress={400}` minimum sur les Pressable dans une ScrollView. Ne pas utiliser `GestureDetector` (conflits gesture handler). Utiliser `Pressable` avec `onLongPress` natif RN — fonctionnel dans ScrollView.

### Pitfall 5 : `parsePendingGifts` échoue sur fichier vide

**Ce qui se passe :** gray-matter retourne `{ data: {} }` sur un fichier vide. `data.gifts` est undefined → crash `.length`.

**Comment éviter :** Defensive default : `const gifts = (parsed.data?.gifts as GiftEntry[]) ?? []`.

---

## Code Examples

### Exemple : parsePendingGifts

```typescript
// lib/mascot/gift-engine.ts
import matter from 'gray-matter';

export interface GiftEntry {
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  item_type: 'harvest' | 'rare_seed' | 'crafted' | 'building_resource';
  item_id: string;
  quantity: number;
  sent_at: string;
}

export function parsePendingGifts(content: string): { gifts: GiftEntry[] } {
  try {
    const parsed = matter(content);
    const gifts = (parsed.data?.gifts as GiftEntry[]) ?? [];
    return { gifts };
  } catch {
    return { gifts: [] };
  }
}

export function serializePendingGifts(gifts: GiftEntry[]): string {
  return matter.stringify('', { gifts });
}
```

### Exemple : Spring config animation cadeau

```typescript
// GiftReceiptModal.tsx — animation paquet qui tombe
const GIFT_SPRING: WithSpringConfig = { damping: 12, stiffness: 180 };
const OPEN_SPRING: WithSpringConfig = { damping: 8, stiffness: 200 };

// translateY: -300 → 0 (tombe du haut)
translateY.value = withSpring(0, GIFT_SPRING, () => {
  // Après atterrissage : ouverture du paquet (scale pulse)
  scale.value = withSequence(
    withSpring(1.2, OPEN_SPRING),
    withSpring(1, GIFT_SPRING),
  );
});
```

### Exemple : addPoints pour le cadeau (pattern existant)

```typescript
// Dans sendGift() — identique à completeSagaChapter
const gamiContent = await vault.readFile(gamiFile(senderId)).catch(() => '');
const gami = parseGamification(gamiContent);
const profile = currentProfiles.find(p => p.id === senderId);
if (profile) {
  const { profile: updated, entry } = addPoints(profile, 5, '🎁 Cadeau envoyé');
  // ... write back to gami-{senderId}.md
}
```

### Exemple : Anti-abus compteur journalier

```typescript
// gift-engine.ts
export function canSendGiftToday(giftsSentField: string | undefined): boolean {
  if (!giftsSentField) return true;
  const [countStr, dateStr] = giftsSentField.split('|');
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr !== today) return true;  // Reset
  return parseInt(countStr, 10) < 5;
}

export function incrementGiftsSent(giftsSentField: string | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!giftsSentField) return `1|${today}`;
  const [countStr, dateStr] = giftsSentField.split('|');
  const count = dateStr === today ? parseInt(countStr, 10) + 1 : 1;
  return `${count}|${today}`;
}
```

Le champ `gifts_sent` est stocké dans `gami-{senderId}.md` comme ligne plate : `gifts_sent: 3|2026-04-04`.

---

## State of the Art

| Ancien Approche | Approche actuelle (projet) | Impact pour Phase 9 |
|----------------|--------------------------|---------------------|
| `gamification.md` unique | `gami-{id}.md` per-profil (Phase 08.1) | Les +5 XP expéditeur s'écrivent dans `gami-{senderId}.md` uniquement |
| `famille.md` pour tout l'inventaire | `farm-{id}.md` per-profil (quick 260404-h6l) | Tous les transferts d'inventaire touchent `farm-{id}.md`, pas `famille.md` |
| `enqueueWrite` global famille | `enqueueWrite` ciblé famille.md | Les gifts n'ont pas besoin d'enqueueWrite (fichiers séparés par profil) |

---

## Open Questions

1. **Où stocker `gifts_sent` (compteur anti-abus) ?**
   - Ce qu'on sait : `gami-{id}.md` est le bon fichier per-profil pour la gamification
   - Ce qui est flou : parseGamification n'a pas de champ `gifts_sent` prévu
   - Recommandation : Ajouter `gifts_sent` comme champ plat dans `gami-{id}.md` (ligne `gifts_sent: 3|2026-04-04`), parséé dans `parseGamification` avec default `undefined`. Alternative : stocker dans `farm-{id}.md` pour éviter de modifier parseGamification — plus simple, retenu.

2. **Section "Cadeaux récents" — dans quel écran ?**
   - Ce qu'on sait : Le profil familial est visible dans `app/(tabs)/index.tsx` (dashboard)
   - Ce qui est flou : Il n'y a pas d'écran profil dédié visible dans la navigation
   - Recommandation : Afficher les 10 derniers cadeaux dans `CraftSheet` onglet "Inventaire" ou dans `TreeView` section profil. Le planner doit choisir l'emplacement exact.

3. **Notification locale (expo-notifications) vs Telegram uniquement ?**
   - Le CONTEXT.md dit "Notification Telegram au destinataire via template `gift_received`"
   - Il n'y a pas de mention de notification locale push
   - Recommandation : Telegram uniquement (fire-and-forget via `dispatchNotificationAsync`), pas de `Notifications.scheduleNotificationAsync`. La popup in-app au refresh est la notification principale.

---

## Environment Availability

Step 2.6: SKIPPED — cette phase est une modification de code/config pure sur des fichiers existants. Aucune dépendance externe nouvelle identifiée.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact Phase 9 |
|-----------|---------------|
| Couleurs via `useThemeColors()` uniquement — jamais hardcodées | `GiftSenderSheet` et `GiftReceiptModal` doivent utiliser `colors.*` |
| `react-native-reanimated` obligatoire pour animations | Spring animation du paquet via `withSpring`, pas `RN.Animated` |
| `ReanimatedSwipeable` pas `Swipeable` | N/A (pas de swipe dans cette phase) |
| Éviter `perspective` dans transforms — préférer `scaleX` | Animations du paquet cadeau sans `perspective` |
| `expo-haptics` pour interactions importantes | Haptic à la réception du cadeau (`Haptics.impactAsync`) |
| Modals en `pageSheet` + drag-to-dismiss | `GiftSenderSheet` : `presentationStyle="pageSheet"` |
| Format date affiché : JJ/MM/AAAA | Historique cadeaux formaté en `dd/MM/yyyy` via `date-fns` |
| Langue UI : français | Nouveaux i18n keys dans `locales/fr/gamification.json` |
| `npx tsc --noEmit` pour valider | Typer `GiftEntry`, `PendingGifts`, props des nouveaux composants |
| Écrire dans `farm-{id}.md` uniquement pour l'inventaire | Jamais toucher `famille.md` pour les transferts d'items |
| `enqueueWrite` pour les écritures concurrentes sur famille.md | Non requis ici — gifts-pending et farm-{id} sont des fichiers indépendants |
| GSD Workflow Enforcement | Toutes les modifications via `/gsd:execute-phase` |

---

## Sources

### Primary (HIGH confidence)
- Code source `hooks/useFarm.ts` — pattern d'écriture `writeProfileFields`, `addCoins`/`deductCoins`
- Code source `hooks/useVault.ts` — `refreshFarm`, `refreshGamification`, pattern `addPoints`
- Code source `lib/parser.ts` — `parseFarmProfile`, `serializeFarmProfile` (format exact farm-{id}.md)
- Code source `lib/mascot/types.ts` — interfaces `HarvestInventory`, `FarmInventory`, `CraftedItem`, `RareSeedInventory`
- Code source `lib/gamification/engine.ts` — `addPoints` signature et retour
- Code source `lib/notifications.ts` — `dispatchNotificationAsync`, `BUILTIN_NOTIFICATIONS`, pattern templates
- Code source `lib/famille-queue.ts` — `enqueueWrite`, `patchProfileField`
- Code source `components/mascot/CompanionPicker.tsx` — pattern Modal pageSheet + ModalHeader
- Code source `components/mascot/CraftSheet.tsx` — inventaire props, handlers sell/craft
- Code source `lib/types.ts` — `Profile` (avatar, id, name), `FarmProfileData`
- `.planning/phases/09-cadeaux-familiaux/09-CONTEXT.md` — décisions locked

### Secondary (MEDIUM confidence)
- gray-matter documentation (API `matter()` et `matter.stringify()`) — pattern frontmatter YAML array connu
- react-native-reanimated `withSpring`/`withSequence` — pattern déjà utilisé dans EvolutionOverlay, CompanionSlot

---

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — tout est existant dans le projet, pas de nouvelle dépendance
- Architecture patterns : HIGH — basé sur code existant parsé directement
- Format fichier pending : HIGH (discretion Claude) — gray-matter + YAML array, pattern cohérent avec le projet
- Pitfalls : HIGH — basés sur l'architecture réelle (refreshFarm async, NSFileCoordinator)
- Anti-abus compteur : MEDIUM — format `count|date` est un choix Claude, plausible et simple

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stack stable, pas de dépendances externes en évolution)
