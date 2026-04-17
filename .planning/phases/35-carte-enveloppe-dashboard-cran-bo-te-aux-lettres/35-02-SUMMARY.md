---
phase: 35-carte-enveloppe-dashboard-cran-bo-te-aux-lettres
plan: 02
subsystem: lovenotes
tags: [lovenotes, ui, components, reanimated, svg]
requires:
  - lib/lovenotes/selectors.ts (Phase 35-01)
  - app/(tabs)/lovenotes.tsx skeleton (Phase 35-01)
  - hooks/useVaultLoveNotes.ts (Phase 34-03)
  - lib/types.ts LoveNote / Profile (Phase 34-01)
provides:
  - components/lovenotes/WaxSeal.tsx (cachet cire pulse Reanimated, size-paramétrable)
  - components/lovenotes/EnvelopeFlap.tsx (rabat triangulaire SVG Polygon)
  - components/lovenotes/EnvelopeCard.tsx (carte enveloppe hero pinned dashboard)
  - components/lovenotes/LoveNoteCard.tsx (item FlatList mémoïsé)
  - components/lovenotes/index.ts (barrel 4 composants)
affects:
  - app/(tabs)/lovenotes.tsx (stub inline du Plan 01 remplacé par <LoveNoteCard>)
tech-stack:
  added: []
  patterns:
    - WaxSeal scale-paramétrable (prop size?: number) — réutilisé en hero (72) et mini (32)
    - cancelAnimation cleanup au unmount (Pitfall 1 — fuites worklet Reanimated)
    - Pressable EXTERNE au transform rotate (Pitfall 8 — hit-box stable)
    - LinearGradient SVG via Defs + Stop (compat RN, pas de clip-path CSS)
    - React.memo + comparator custom (prevProps/nextProps) sur LoveNoteCard
    - Constantes cosmétiques inline (PAPER, INK, WAX, TILT_DEG) — zero ajout dans constants/colors.ts
key-files:
  created:
    - components/lovenotes/WaxSeal.tsx
    - components/lovenotes/EnvelopeFlap.tsx
    - components/lovenotes/EnvelopeCard.tsx
    - components/lovenotes/LoveNoteCard.tsx
    - components/lovenotes/index.ts
  modified:
    - app/(tabs)/lovenotes.tsx
decisions:
  - WaxSeal expose `size?: number` (default 72) qui scale width/height/borderRadius/fontSize — un seul composant pour hero ET mini, pas de duplication
  - LoveNoteCard utilise WaxSeal `initial="✉"` en variante mini revealed — réutilise la pulse Reanimated existante au lieu d'un emoji statique
  - Wrapper externe non-tourné autour de l'enveloppe pour préserver la hit-box rectangle (Pitfall 8) — le Pressable enveloppe le `View` qui contient le rotate
  - EnvelopeFlap rendu seulement quand `size.width > 0` (post onLayout) — évite SVG 0×0 au premier render
  - Cosmétiques (#f5ecd5, #c0392b, #442434) inline en constantes module — scope Phase 35 minimal, pas de pollution constants/colors.ts
metrics:
  duration: 6min
  completed: 2026-04-17
  tasks: 2
  files: 6
---

# Phase 35 Plan 02: Composants visuels Love Notes (WaxSeal + EnvelopeCard + LoveNoteCard)

Quatre composants visuels du domaine Love Notes (cachet cire animé Reanimated, rabat triangulaire SVG, carte enveloppe hero, item liste mémoïsé) + remplacement du stub Plan 01 dans l'écran Boîte aux lettres par un LoveNoteCard riche (expéditeur, preview, état, date).

## Résultats

| Tâche | Status | Commit |
|-------|--------|--------|
| Task 1 — WaxSeal + EnvelopeFlap + EnvelopeCard + barrel | ✓ | c5de6bf |
| Task 2 — LoveNoteCard mémoïsé + câblage écran | ✓ | 3bbb06e |

## Vérification

- `npx tsc --noEmit` (hors pré-existants MemoryEditor/cooklang/useVault) → **0 erreur nouvelle** (baseline 0 → final 0)
- `npx jest lib/__tests__/lovenotes-selectors.test.ts --no-coverage` → **19/19 tests verts** (Plan 01 sélecteurs intacts)
- Fichier `components/lovenotes/index.ts` exporte les 4 composants attendus
- Écran `/(tabs)/lovenotes` consomme `<LoveNoteCard>` (stub Plan 01 supprimé)

## Décisions

1. **WaxSeal scale-paramétrable** : prop `size?: number` (default 72). `width/height/borderRadius` dérivés directement, `fontSize` proportionnel (`size * 0.45`). Un seul composant sert le hero EnvelopeCard (72px) ET la mini variant LoveNoteCard (32px), pas de duplication.
2. **Cleanup cancelAnimation au unmount** dans WaxSeal (Pitfall 1) — `cancelAnimation(scale); scale.value = 1;` dans le cleanup du `useEffect` pour éviter les fuites worklet quand un item disparaît du FlatList.
3. **Pressable externe au rotate** (Pitfall 8) — la carte tournée -1.5° vit dans un wrapper non-tourné. Le `PressableScale` enveloppe le wrapper, donc la hit-box reste rectangulaire et le tap reste précis sur les coins.
4. **EnvelopeFlap rendu post-onLayout** — Le SVG ne se rend qu'après que `onLayout` ait fourni `size.width > 0`, sinon RN-svg renderait un Polygon dégénéré (0×0) qu'il faudrait re-layout après coup.
5. **WaxSeal mini avec initiale "✉"** dans LoveNoteCard pour les notes revealed — réutilise le pulse Reanimated comme signal visuel "à lire", évite un emoji statique secondaire.
6. **Cosmétiques inline** (PAPER, INK, WAX, FLAP_LIGHT/DARK, TILT_DEG) — scope Phase 35 strict, pas d'enrichissement de `constants/colors.ts` per RESEARCH Open Question 1.

## Déviations

Aucune. Plan exécuté exactement comme écrit. Les tokens `FontSize.xs/md/xl` mentionnés dans le plan ont été mappés vers les vrais tokens existants (`FontSize.caption/body/titleLg`) — adaptation cosmétique non bloquante.

## Suite

- **Plan 03 (Wave 2)** — Injection de `EnvelopeCard` dans le dashboard `app/(tabs)/index.tsx` (carte pinned conditionnelle si unreadCount > 0) + entrée more.tsx vers `/(tabs)/lovenotes`. Tous les composants nécessaires sont prêts à être importés depuis `components/lovenotes`.

## Self-Check: PASSED

- [x] components/lovenotes/WaxSeal.tsx — FOUND
- [x] components/lovenotes/EnvelopeFlap.tsx — FOUND
- [x] components/lovenotes/EnvelopeCard.tsx — FOUND
- [x] components/lovenotes/LoveNoteCard.tsx — FOUND
- [x] components/lovenotes/index.ts — FOUND (4 exports)
- [x] app/(tabs)/lovenotes.tsx — modifié (LoveNoteCard branché)
- [x] Commit c5de6bf — FOUND in git log
- [x] Commit 3bbb06e — FOUND in git log
- [x] tsc clean (hors pré-existants)
- [x] jest selectors 19/19 verts
