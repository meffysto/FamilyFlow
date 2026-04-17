---
phase: 36-composition-programmation-reveal
plan: 04
subsystem: lovenotes
tags: [lovenotes, reanimated, animation, unfold, modal, haptics, LOVE-13]
dependency-graph:
  requires:
    - components/lovenotes/EnvelopeFlap.tsx
    - components/lovenotes/WaxSeal.tsx
    - components/lovenotes/LoveNoteCard.tsx (onPress prop Phase 35)
    - hooks/useVault.ts (updateLoveNoteStatus)
    - lib/lovenotes/selectors.ts (isRevealed)
  provides:
    - EnvelopeUnfoldModal (full-screen unfold animation)
    - Cycle Love Notes complet (compose → program → reveal → read)
  affects:
    - app/(tabs)/lovenotes.tsx (handleCardPress + handleUnfoldComplete + state unfoldNote)
tech-stack:
  added: []
  patterns:
    - "Reanimated 3 sharedValues orchestrées via useEffect [visible]"
    - "withSequence + withSpring + withTiming composés en parallèle"
    - "runOnJS(haptic) + runOnJS(callback) dans withTiming(finish callback)"
    - "requestAnimationFrame wrap pour garantir premier frame posé (Pitfall 5)"
    - "Patch state domaine APRÈS animation (Pitfall 6 — évite flicker re-render)"
    - "PAS de perspective dans transform array (conformité stricte CLAUDE.md)"
key-files:
  created:
    - components/lovenotes/EnvelopeUnfoldModal.tsx (167 lignes)
  modified:
    - components/lovenotes/index.ts (+1 export)
    - app/(tabs)/lovenotes.tsx (+45 -3)
decisions:
  - "rotateX 0→175° sans perspective — feel 2D acceptable, respect strict CLAUDE.md (per RESEARCH Open Q 1)"
  - "transformOrigin: 'top' — pivot haut rabat, fallback natif si worklet ne supporte pas"
  - "Couleurs PAPER/INK inline (identitaires hors thème) — commentaires justificatifs"
  - "Backdrop rgba(0,0,0,0.6) standard modal — commenté pour W1"
  - "handleUnfoldComplete patch read APRÈS finish callback — évite flicker pendant animation"
  - "pending due upgradé via updateLoveNoteStatus('revealed') puis ouverture modal"
metrics:
  duration: "5min"
  tasks: 2
  files: 3
  completed-date: "2026-04-17"
---

# Phase 36 Plan 04: EnvelopeUnfoldModal — Reveal animation Summary

Animation unfold Reanimated qui déplie le rabat de l'enveloppe, fait sauter le cachet de cire, révèle le contenu, tire un Haptics Success et bascule la note en `read` au callback final — boucle LOVE-13 fermée.

## Tasks

### Task 1: EnvelopeUnfoldModal component

Créé `components/lovenotes/EnvelopeUnfoldModal.tsx` (167 lignes) :

- Props `{ visible, fromName, body, onClose, onUnfoldComplete }`
- 3 `useSharedValue` orchestrés dans `useEffect [visible]` avec `requestAnimationFrame` wrap :
  - `flapRotate` 0→175° (`withTiming`, 800ms, `Easing.out.cubic`)
  - `sealScale` 1→1.4→0 (`withSequence` de `withTiming` + `withSpring` `{ damping: 8, stiffness: 200 }`)
  - `contentOpacity` 0→1 (`withTiming`, 400ms, `Easing.linear`)
- Callback de fin sur `contentOpacity` : `runOnJS(triggerHaptic)()` + `runOnJS(onUnfoldComplete)()`
- Reset des valeurs sur `!visible` pour réouvertures propres
- `transformOrigin: 'top'` — pivot haut rabat. **PAS de perspective** (conformité stricte CLAUDE.md, per RESEARCH Open Q 1)
- Constantes `PAPER` / `INK` inline avec commentaire justificatif (identitaires enveloppe, hors thème)
- Backdrop `rgba(0,0,0,0.6)` commenté comme standard modal
- Barrel `components/lovenotes/index.ts` réexporte `EnvelopeUnfoldModal`

**Commit:** `1b5beaa`

### Task 2: Câblage écran lovenotes.tsx

Étendu `app/(tabs)/lovenotes.tsx` (Wave 3, APRÈS Plan 03) :

- Imports : `EnvelopeUnfoldModal`, `isRevealed`
- État : `const [unfoldNote, setUnfoldNote] = useState<LoveNote | null>(null)`
- `handleCardPress(note)` 3 cas :
  - `status === 'revealed'` → ouvre direct
  - `status === 'pending' && isRevealed(note)` → `updateLoveNoteStatus('revealed')` puis ouvre
  - sinon (pending future, read) → noop
- `handleUnfoldComplete` → `updateLoveNoteStatus(sourceFile, 'read')` **APRÈS** la fin de l'animation (Pitfall 6)
- `renderItem` passe `onPress={handleCardPress}` à `<LoveNoteCard>`
- `<EnvelopeUnfoldModal>` rendu conditionnellement quand `unfoldNote` non null
- Plan 03 (FAB, LoveNoteEditor, useRevealOnForeground, handleSave) intact — non-régression

**Commit:** `66af81b`

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Success Criteria

- [x] User tap LoveNoteCard `revealed` → modal full-screen s'ouvre
- [x] Animation Reanimated : seal jump + rabat unfold + body reveal (~1200ms total)
- [x] `Haptics.notificationAsync(Success)` au callback final de `contentOpacity`
- [x] Note passée en `read` APRÈS animation (pas de flicker — Pitfall 6 résolu)
- [x] Pending due upgradé via `updateLoveNoteStatus(revealed)` puis ouvert
- [x] Dismiss via tap backdrop ou `onRequestClose`
- [x] PAS de `perspective` dans EnvelopeUnfoldModal.tsx (grep returns 0)
- [x] `tsc --noEmit` clean (hors pré-existante `ModalHeader.onClose` non liée au plan)

## Must-Haves Verification

### Truths

- ✅ Tap LoveNoteCard `status='revealed'` → EnvelopeUnfoldModal full-screen (via `handleCardPress` → `setUnfoldNote`)
- ✅ Animation rabat rotateX 0→175° (800ms) + cachet scale 1→1.4→0 + body opacity 0→1 (cf. Task 1)
- ✅ Haptics Success au peak (callback `withTiming(contentOpacity)` → `runOnJS(triggerHaptic)`)
- ✅ Passage `'read'` APRÈS animation (callback `onUnfoldComplete` → `updateLoveNoteStatus(sourceFile, 'read')`)

### Artifacts

- ✅ `components/lovenotes/EnvelopeUnfoldModal.tsx` (167 lignes > 100)
- ✅ Export `EnvelopeUnfoldModal`

### Key Links

- ✅ `LoveNoteCard.onPress` → `handleCardPress` → `setUnfoldNote(note)` pour notes `revealed`
- ✅ `EnvelopeUnfoldModal.onUnfoldComplete` → `updateLoveNoteStatus(sourceFile, 'read')`

## Requirements Completed

- LOVE-13 (animation unfold + haptic + passage read)

## Known Stubs

Aucun. Le cycle Love Notes est entièrement fonctionnel de bout en bout (compose → schedule → reveal → unfold → read).

## Self-Check

Verification des artefacts produits :

- Fichier `components/lovenotes/EnvelopeUnfoldModal.tsx` : créé (167 lignes, commit `1b5beaa`)
- Barrel `components/lovenotes/index.ts` : export ajouté (commit `1b5beaa`)
- `app/(tabs)/lovenotes.tsx` : étendu Wave 3 (commit `66af81b`)
- Aucune occurrence de `perspective` dans `EnvelopeUnfoldModal.tsx` (vérifié : 0 match)
- Callback final `onUnfoldComplete` câblé sur `updateLoveNoteStatus(..., 'read')`

## Self-Check: PASSED
