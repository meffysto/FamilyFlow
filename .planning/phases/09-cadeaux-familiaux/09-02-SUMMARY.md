---
phase: 09-cadeaux-familiaux
plan: "02"
subsystem: mascot/gifts-ui
tags: [gift-ui, useFarm, CraftSheet, GiftSenderSheet, GiftReceiptModal, reanimated, confetti, haptics]
dependency_graph:
  requires:
    - phase: 09-01
      provides: gift-engine-core (parsePendingGifts, serializePendingGifts, canSendGiftToday, incrementGiftsSent, removeFromInventory, addGiftToInventory, buildGiftHistoryEntry, GiftEntry)
  provides:
    - sendGift callback dans useFarm (anti-abus, inventaire, pending file, +XP)
    - receiveGifts callback dans useFarm (claim-first, historique)
    - GiftSenderSheet (Modal pageSheet, grille profils, selecteur quantite)
    - GiftReceiptModal (spring bounce, ConfettiCannon, Haptics.impactAsync)
    - CraftSheet onLongPress sur items inventaire et creations
    - Section historique cadeaux dans CraftSheet onglet inventaire
    - Cablage complet dans tree.tsx
  affects: [hooks/useFarm, components/mascot/CraftSheet, app/(tabs)/tree]
tech_stack:
  added: []
  patterns:
    - "claim-first : deleteFile pending AVANT addGiftToInventory (evite double-consommation)"
    - "receiveGifts declenche au changement de profil (useEffect sur profile.id)"
    - "ConfettiCannon chargement lazy (require dans try/catch) identique au pattern LootBoxOpener"
    - "GiftSenderSheet : Modal pageSheet + ModalHeader, grille profils, quantite min/max"
    - "GiftReceiptModal : useSharedValue translateY/scale/opacity + withSequence pulse + runOnJS confetti"
key_files:
  created:
    - components/mascot/GiftSenderSheet.tsx
    - components/mascot/GiftReceiptModal.tsx
  modified:
    - hooks/useFarm.ts
    - components/mascot/CraftSheet.tsx
    - app/(tabs)/tree.tsx
    - lib/types.ts
key_decisions:
  - "receiveGifts appelé dans useEffect [profile.id] dans tree.tsx — une seule detection par profil, pas a chaque re-render"
  - "giftHistory et giftsSentToday ajoutés à l'interface Profile (déjà dans FarmProfileData) pour accès depuis tree.tsx"
  - "applyFarmField étendu avec gift_history et gifts_sent_today pour writeProfileFields"
  - "GiftReceiptModal utilise runOnJS pour déclencher confetti+haptic depuis worklet Reanimated"
requirements_completed: [SOC-01, SOC-02]
duration: 10min
completed: "2026-04-04T17:02:00Z"
---

# Phase 09 Plan 02: Cadeaux familiaux — Integration UI complète Summary

GiftSenderSheet (pageSheet profils+quantite), GiftReceiptModal (spring bounce + confetti + haptic), sendGift/receiveGifts dans useFarm, long-press inventaire CraftSheet, historique cadeaux, detection pending au changement de profil dans tree.tsx.

## Performance

- **Duration:** 10min
- **Started:** 2026-04-04T16:52:35Z
- **Completed:** 2026-04-04T17:02:00Z
- **Tasks:** 2 (+ checkpoint human-verify)
- **Files modified:** 6

## Accomplishments

- sendGift retire l'item de l'expediteur, dépose le fichier pending, met à jour l'historique et le compteur anti-abus — refus si limite 5/jour dépassée
- receiveGifts claim-first (deleteFile avant addGiftToInventory), applique tous les cadeaux, met à jour l'historique destinataire
- GiftSenderSheet : Modal pageSheet, avatars circulaires 56x56, selecteur +/-, bouton envoi avec feedback toast success/erreur
- GiftReceiptModal : paquet qui tombe avec spring damping:12, pulse withSequence, confetti via ConfettiCannon, haptic Medium
- CraftSheet : onLongPress+delayLongPress=400 sur récoltes, ressources batiments, items craftés — section historique 10 derniers echanges
- tree.tsx cablé : giftOffer state, pendingGiftsToShow state, detection au changement de profil

## Task Commits

1. **Task 1: sendGift et receiveGifts dans useFarm** - `3ff46e5` (feat)
2. **Task 2: GiftSenderSheet + GiftReceiptModal + CraftSheet + tree.tsx** - `658b807` (feat)

## Files Created/Modified

- `hooks/useFarm.ts` — sendGift, receiveGifts, applyFarmField étendu, imports gift-engine
- `components/mascot/GiftSenderSheet.tsx` — NOUVEAU : bottom sheet envoi cadeau
- `components/mascot/GiftReceiptModal.tsx` — NOUVEAU : modal animée reception cadeau
- `components/mascot/CraftSheet.tsx` — onLongPress+delayLongPress, section historique cadeaux, import parseGiftHistory
- `app/(tabs)/tree.tsx` — imports, states giftOffer+pendingGiftsToShow, useEffect receiveGifts, GiftSenderSheet+GiftReceiptModal rendus
- `lib/types.ts` — giftHistory et giftsSentToday ajoutés à l'interface Profile

## Decisions Made

- `receiveGifts` appelé dans `useEffect [profile.id]` dans tree.tsx — détection ponctuelle au changement de profil, pas sur chaque refresh pour éviter les doubles appels
- `giftHistory` et `giftsSentToday` ajoutés à l'interface `Profile` (ils existaient déjà dans `FarmProfileData` et sont mergés via `refreshFarm`) — permet l'accès depuis tree.tsx sans cast
- `applyFarmField` dans useFarm étendu avec les cases `gift_history` et `gifts_sent_today` pour que `writeProfileFields` les gère correctement
- `GiftReceiptModal` utilise `runOnJS(triggerConfettiAndHaptic)()` depuis un callback Reanimated pour appeler confetti et haptic depuis le thread JS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] applyFarmField manquait gift_history et gifts_sent_today**
- **Found during:** Task 1
- **Issue:** writeProfileFields passe par applyFarmField pour mapper les clés aux proprietes FarmProfileData. Sans les cases gift_history et gifts_sent_today, les valeurs auraient été ignorées silencieusement
- **Fix:** Ajout des deux cases dans le switch de applyFarmField
- **Files modified:** hooks/useFarm.ts
- **Commit:** 3ff46e5

**2. [Rule 2 - Missing critical functionality] giftHistory absent de l'interface Profile**
- **Found during:** Task 2 — erreur TypeScript TS2339 lors du passage de profile?.giftHistory a CraftSheet
- **Issue:** Profile interface ne déclarait pas giftHistory (ni giftsSentToday), même si ces champs sont mergés depuis FarmProfileData par refreshFarm
- **Fix:** Ajout des deux champs optionnels dans lib/types.ts interface Profile
- **Files modified:** lib/types.ts
- **Commit:** 658b807

---

**Total deviations:** 2 auto-fixed (Rule 2 — missing critical functionality)
**Impact on plan:** Corrections nécessaires pour l'exactitude TypeScript et le bon fonctionnement des writes. Aucun changement de scope.

## Issues Encountered

Aucun problème bloquant. Le plan était précis et les interfaces de Plan 01 cohérentes.

## Known Stubs

Aucun stub — tous les composants sont câblés à de vraies données. Le flow complet envoi→pending→reception est fonctionnel.

## Next Phase Readiness

- Système de cadeaux familiaux complet et livré
- Task 3 est un checkpoint human-verify (vérification sur device)
- Phase 09 complète après validation humaine

## Self-Check: PASSED

- GiftSenderSheet.tsx : FOUND
- GiftReceiptModal.tsx : FOUND
- SUMMARY.md : FOUND
- Commit 3ff46e5 : FOUND
- Commit 658b807 : FOUND

---
*Phase: 09-cadeaux-familiaux*
*Completed: 2026-04-04*
