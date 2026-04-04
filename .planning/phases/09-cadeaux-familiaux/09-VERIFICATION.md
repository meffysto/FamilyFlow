---
phase: 09-cadeaux-familiaux
verified: 2026-04-04T17:30:00Z
status: human_needed
score: 15/15 must-haves verified
human_verification:
  - test: "Long-press sur un item d'inventaire (récolte, ressource bâtiment, item crafté) dans CraftSheet onglet Inventaire"
    expected: "Le GiftSenderSheet s'ouvre après 400ms, affiche les avatars des autres profils et un sélecteur +/-"
    why_human: "Geste tactile et rendu modal ne peuvent pas être vérifiés programmatiquement"
  - test: "Sélectionner un destinataire, ajuster la quantité, appuyer Envoyer"
    expected: "Toast succès, item retiré de l'inventaire expéditeur, fichier gifts-pending-{id}.md créé dans le vault"
    why_human: "Persistance fichier iCloud + feedback visuel toast nécessitent device physique"
  - test: "Changer de profil vers le destinataire (ou relancer l'app sur ce profil)"
    expected: "GiftReceiptModal s'affiche avec animation paquet qui tombe (spring bounce), confetti, haptic Medium, message expéditeur"
    why_human: "Animation spring + confetti + haptic ne peuvent pas être vérifiés sans rendu natif"
  - test: "Fermer la GiftReceiptModal, vérifier l'onglet Inventaire du destinataire"
    expected: "L'item cadeau est présent dans l'inventaire, section 'Cadeaux récents' montre l'échange"
    why_human: "État de l'inventaire post-réception nécessite vault réel + rendu"
  - test: "Envoyer 5 cadeaux depuis le même profil le même jour"
    expected: "Le 6ème envoi affiche le toast d'erreur 'Tu as atteint la limite de 5 cadeaux aujourd'hui'"
    why_human: "Flow complet anti-abus nécessite device avec profils multiples"
---

# Phase 09: Cadeaux Familiaux — Rapport de Vérification

**Phase Goal:** Les membres de la famille peuvent s'envoyer des récoltes et items craftés, renforçant la dimension coopérative et la motivation partagée
**Verified:** 2026-04-04T17:30:00Z
**Status:** human_needed
**Re-verification:** Non — vérification initiale

---

## Goal Achievement

### Observable Truths

#### Plan 01 — Moteur de cadeaux (logique pure)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | parsePendingGifts parse un fichier YAML frontmatter avec un array gifts et retourne GiftEntry[] | VERIFIED | `lib/mascot/gift-engine.ts` l.48-59 — gray-matter avec fallback `?? []` |
| 2 | serializePendingGifts produit un fichier Markdown valide avec frontmatter YAML contenant gifts array | VERIFIED | `lib/mascot/gift-engine.ts` l.65-67 — `matter.stringify('', { gifts })` |
| 3 | canSendGiftToday retourne false après 5 envois le même jour et true après changement de date | VERIFIED | `lib/mascot/gift-engine.ts` l.76-89 — split `|`, compare date, `count < MAX_GIFTS_PER_DAY` |
| 4 | incrementGiftsSent produit le format count\|YYYY-MM-DD | VERIFIED | `lib/mascot/gift-engine.ts` l.96-109 — reset si date différente, sinon `count+1` |
| 5 | addGiftToInventory ajoute correctement un item dans les 4 buckets (harvest, rare_seed, crafted, building_resource) | VERIFIED | `lib/mascot/gift-engine.ts` l.118-157 — switch complet, copies défensives |
| 6 | removeFromInventory retire la quantité exacte et retourne false si insuffisant | VERIFIED | `lib/mascot/gift-engine.ts` l.164-209 — vérifie quantité, retourne `{ success, updated }` |
| 7 | buildGiftHistoryEntry produit le format CSV pipe-séparé | VERIFIED | `lib/mascot/gift-engine.ts` l.217-228 — format `ISO|direction|fromId->toId|type:itemId:qty` |
| 8 | Le template gift_received est enregistré dans BUILTIN_NOTIFICATIONS | VERIFIED | `lib/notifications.ts` l.171-181 — objet complet avec `id: 'gift_received'`, `event: 'gift_received'` |

#### Plan 02 — Intégration UI

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | Un long-press sur un item d'inventaire dans CraftSheet ouvre le GiftSenderSheet | VERIFIED | `CraftSheet.tsx` l.557, 604, 692 — `onLongPress={() => onOfferItem?.(…)}` avec `delayLongPress={400}` sur 3 types |
| 10 | Le GiftSenderSheet affiche les avatars des profils familiaux et un sélecteur de quantité | VERIFIED | `GiftSenderSheet.tsx` l.147-220 — grille profils, boutons `+`/`-`, quantité min/max |
| 11 | Envoyer un cadeau retire l'item de l'inventaire expéditeur et dépose un fichier gifts-pending-{recipientId}.md | VERIFIED | `hooks/useFarm.ts` l.672-693 — `removeFromInventory` puis `writeFile(pendingFile, …)` |
| 12 | Au refresh, si un fichier gifts-pending-{profileId}.md existe, les items sont ajoutés à l'inventaire et la GiftReceiptModal s'affiche | VERIFIED | `app/(tabs)/tree.tsx` l.362-366 — `useEffect [profile.id]` → `receiveGifts(profile.id)` → `setPendingGiftsToShow` ; `hooks/useFarm.ts` l.733 — deleteFile AVANT addGiftToInventory (claim-first) |
| 13 | La GiftReceiptModal anime un paquet qui tombe avec spring bounce, confetti, haptic | VERIFIED | `GiftReceiptModal.tsx` l.20, 35-37, 65-94 — `withSpring`, `ConfettiCannon`, `Haptics.impactAsync` ; pas de `perspective` dans les transforms |
| 14 | L'historique des 10 derniers cadeaux est visible dans le CraftSheet onglet inventaire | VERIFIED | `CraftSheet.tsx` l.625 — section `gift_history_title` avec `parseGiftHistory` ; `lib/parser.ts` l.617-618 et l.653-654 — lecture/écriture `gift_history` |
| 15 | Le compteur anti-abus bloque après 5 envois/jour avec message d'erreur | VERIFIED | `hooks/useFarm.ts` l.668-670 — `canSendGiftToday` → `return { success: false, error: 'daily_limit' }` ; `GiftSenderSheet.tsx` l.90-91 — toast `gift_sent_limit` |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/mascot/gift-engine.ts` | Logique cadeau — parse, serialize, validation, transfer | VERIFIED | 275 lignes, exporte GiftEntry, PendingGifts, parsePendingGifts, serializePendingGifts, canSendGiftToday, incrementGiftsSent, addGiftToInventory, removeFromInventory, buildGiftHistoryEntry, parseGiftHistory, MAX_GIFTS_PER_DAY |
| `lib/parser.ts` | Champ gift_history dans parseFarmProfile/serializeFarmProfile | VERIFIED | l.617-618 lit `gift_history`/`gifts_sent_today` ; l.653-654 écrit si présents |
| `lib/types.ts` | Champ giftHistory dans FarmProfileData | VERIFIED | `FarmProfileData` l.581-582 et `Profile` l.92-93 — deux interfaces étendues |
| `components/mascot/GiftSenderSheet.tsx` | Bottom sheet sélection destinataire + quantité + envoi | VERIFIED | 347 lignes, Modal pageSheet, ModalHeader, grille profils, sélecteur +/-, haptic |
| `components/mascot/GiftReceiptModal.tsx` | Modal animée réception cadeau avec spring + confetti + haptic | VERIFIED | 260 lignes, withSpring, ConfettiCannon, Haptics.impactAsync, pas de perspective |
| `hooks/useFarm.ts` | sendGift et receiveGifts callbacks | VERIFIED | sendGift l.652-718, receiveGifts l.720-759, les deux dans le return l.776-777 |
| `lib/__tests__/gift-engine.test.ts` | Tests TDD gift-engine | VERIFIED | 334 lignes, 38 tests, tous verts |
| `lib/mascot/index.ts` | Re-export gift-engine | VERIFIED | l.16 — `export * from './gift-engine'` |
| `locales/fr/gamification.json` | 13 clés gift_* | VERIFIED | 13 clés gift_ confirmées |
| `locales/en/gamification.json` | 13 clés gift_* | VERIFIED | 13 clés gift_ confirmées |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/mascot/gift-engine.ts` | `lib/mascot/types.ts` | import HarvestInventory, FarmInventory, CraftedItem, RareSeedInventory | WIRED | l.10 — `import type { FarmInventory, HarvestInventory, RareSeedInventory, CraftedItem } from './types'` |
| `lib/parser.ts` | `lib/mascot/gift-engine.ts` | parseGiftHistory pour le champ gift_history | NOT_WIRED | `parser.ts` lit `gift_history` comme string brute — `parseGiftHistory` est appelé dans `CraftSheet.tsx`, pas dans `parser.ts`. Conforme à la décision de design (string CSV stockée telle quelle). |
| `components/mascot/CraftSheet.tsx` | `components/mascot/GiftSenderSheet.tsx` | onLongPress -> onOfferItem prop -> ouvre GiftSenderSheet | WIRED | `CraftSheet.tsx` l.557/604/692 — onLongPress → `onOfferItem?.(…)` passé via prop depuis `tree.tsx` |
| `hooks/useFarm.ts` | `lib/mascot/gift-engine.ts` | import removeFromInventory, addGiftToInventory, parsePendingGifts | WIRED | l.57-66 — import complet de gift-engine |
| `hooks/useVault.ts` | `hooks/useFarm.ts` | refreshFarm détecte et consomme gifts-pending-{id}.md | WIRED (via tree.tsx) | Selon décision de plan : détection dans `tree.tsx` `useEffect [profile.id]` → `receiveGifts(profile.id)` |
| `app/(tabs)/tree.tsx` | `components/mascot/GiftReceiptModal.tsx` | pendingGiftsToShow state déclenche GiftReceiptModal | WIRED | `tree.tsx` l.2018-2022 — `<GiftReceiptModal visible={pendingGiftsToShow.length > 0} …>` |

Note sur le lien parser→gift-engine : le plan indiquait "parseGiftHistory pour le champ gift_history" mais `parser.ts` stocke `gift_history` comme string CSV brute et la délégation du parsing à `parseGiftHistory` est faite côté composant (`CraftSheet.tsx`). C'est une déviation acceptable, documentée dans `09-02-SUMMARY.md`.

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produit des données réelles | Status |
|----------|---------------|--------|----------------------------|--------|
| `GiftSenderSheet.tsx` | `profiles` prop | `tree.tsx` → `profiles` state → `parseFamille` vault | Oui — profils chargés depuis famille.md | FLOWING |
| `GiftReceiptModal.tsx` | `gifts` prop | `pendingGiftsToShow` → `receiveGifts` → `parsePendingGifts` | Oui — lu depuis fichier vault réel | FLOWING |
| `CraftSheet.tsx` section historique | `giftHistory` prop | `profile?.giftHistory` → `parseFarmProfile` → vault | Oui — lu depuis farm-{id}.md | FLOWING |
| `sendGift` in `useFarm.ts` | `senderFarm.giftsSentToday` | `parseFarmProfile` → `vault.readFile(farmFile(senderId))` | Oui — lu depuis farm-{id}.md | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests gift-engine (38 tests) | `npx jest lib/__tests__/gift-engine.test.ts --no-coverage` | 38 passed, 0 failed | PASS |
| TypeScript — aucune erreur gift-related | `npx tsc --noEmit 2>&1 \| grep -E "gift\|Gift"` | Aucune sortie | PASS |
| gift-engine exporte ≥11 symboles | `grep -c "^export" lib/mascot/gift-engine.ts` | Compté manuellement : 11 exports (MAX_GIFTS_PER_DAY, GiftEntry, PendingGifts, GiftHistoryEntry, parsePendingGifts, serializePendingGifts, canSendGiftToday, incrementGiftsSent, addGiftToInventory, removeFromInventory, buildGiftHistoryEntry, parseGiftHistory) | PASS |
| Claim-first dans receiveGifts | Lecture `useFarm.ts` l.733-742 | `vault.deleteFile(pendingFile)` à l.734 AVANT `addGiftToInventory` à l.742 | PASS |
| Pas de `perspective` dans GiftReceiptModal | `grep "perspective" components/mascot/GiftReceiptModal.tsx` | Aucune correspondance | PASS |

---

### Requirements Coverage

| Requirement | Plan source | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SOC-01 | 09-01 + 09-02 | Un membre peut envoyer une récolte ou un item crafté à un autre membre | SATISFIED | sendGift (useFarm.ts l.652) + GiftSenderSheet (long-press CraftSheet) + pending file deposit |
| SOC-02 | 09-01 + 09-02 | Le destinataire reçoit une notification et l'item apparaît dans son inventaire | SATISFIED (in-app) | GiftReceiptModal (animation spring + confetti + haptic) + addGiftToInventory dans receiveGifts. La notification Telegram (`dispatchNotificationAsync`) est absente du code, mais la notification in-app animée satisfait le requirement. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `hooks/useFarm.ts` | 653-718 | `sendGift` ne déclenche pas `dispatchNotificationAsync('gift_received', …)` | Info | Notification Telegram absente — in-app modal remplace. Non bloquant pour le goal. |
| `hooks/useFarm.ts` | 653-718 | `sendGift` ne déclenche pas `addPoints(+5 XP)` pour l'expéditeur | Info | XP par cadeau envoyé absent (mentionné dans CONTEXT, pas dans must_haves du plan). Non bloquant. |
| `components/mascot/CraftSheet.tsx` | — | Graines rares (`rare_seed`) absentes de l'onglet inventaire — pas de long-press pour ce type | Warning | Le gift-engine supporte `rare_seed` mais CraftSheet n'affiche pas cet inventaire. Le type `rare_seed` reste envoyable si appelé programmatiquement mais sans UI long-press. |

---

### Human Verification Required

#### 1. Long-press inventaire ouvre GiftSenderSheet

**Test:** Ouvrir l'app, aller sur l'écran Arbre (`/tree`), ouvrir l'Atelier (bouton marteau), onglet "Inventaire". Maintenir 400ms sur une récolte (ex : une fraise).
**Expected:** GiftSenderSheet s'ouvre en pageSheet avec : titre "Offrir un cadeau", item affiché en haut, liste des avatars des autres profils, sélecteur +/-.
**Why human:** Geste long-press 400ms et rendu modal nécessitent device physique.

#### 2. Flow complet envoi cadeau

**Test:** Sélectionner un destinataire dans le GiftSenderSheet, ajuster la quantité, appuyer "Envoyer".
**Expected:** Toast "Cadeau envoyé à [Nom] !", sheet se ferme, l'item est retiré de l'inventaire de l'expéditeur.
**Why human:** Persistance vault (iCloud) et feedback toast nécessitent device réel.

#### 3. Réception animée (GiftReceiptModal)

**Test:** Changer de profil vers le destinataire (ou ouvrir l'écran Arbre sur ce profil).
**Expected:** GiftReceiptModal s'affiche spontanément — paquet qui tombe avec spring bounce, confetti, haptic Medium. Affiche "X t'a envoyé Nx Y !". Bouton "Super !" pour fermer.
**Why human:** Animation spring + confetti + haptic ne se vérifient pas programmatiquement.

#### 4. Inventaire mis à jour après réception

**Test:** Fermer la GiftReceiptModal, ouvrir l'Atelier onglet Inventaire du destinataire.
**Expected:** L'item reçu est présent dans l'inventaire (quantité ajoutée). La section "Cadeaux récents" montre l'échange avec date/expéditeur/item.
**Why human:** État de l'inventaire post-réception nécessite vault réel + rendu UI.

#### 5. Anti-abus 5 cadeaux/jour

**Test:** Envoyer 5 cadeaux depuis le même profil le même jour. Tenter un 6ème envoi.
**Expected:** Toast d'erreur "Tu as atteint la limite de 5 cadeaux aujourd'hui".
**Why human:** Nécessite device avec profils multiples et envois réels.

---

### Gaps Summary

Aucun gap bloquant — tous les must-haves des deux plans sont vérifiés. Les points informatifs (XP manquant, notification Telegram absente, rare_seed sans UI long-press) sont des déviations mineures par rapport au CONTEXT mais ne figuraient pas dans les `must_haves` ni `acceptance_criteria` des plans.

La vérification humaine est requise pour confirmer que le flow complet envoi→pending→réception fonctionne correctement sur device physique avec un vault iCloud réel.

---

_Verified: 2026-04-04T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
