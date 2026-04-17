---
phase: 36
plan: 03
subsystem: lovenotes
tags: [lovenotes, composition, ui, modal, foreground-reveal]
requires: [phase-36-plan-01]
provides:
  - components/lovenotes/LoveNoteEditor (Modal pageSheet composition)
  - app/(tabs)/lovenotes.tsx : FAB Écrire + useRevealOnForeground branché
  - boucle UX complète composition → schedule → bascule auto pending→revealed
affects:
  - app/(tabs)/lovenotes.tsx (ajout FAB + state editor + handlers + hook foreground)
  - components/lovenotes/index.ts (réexport LoveNoteEditor)
tech_stack:
  added: []
  patterns:
    - "Modal pageSheet drag-to-dismiss iOS natif (pattern NoteEditor.tsx)"
    - "Reset state via useEffect([visible]) — préremplit preset au mount"
    - "Chips presets + DateInput date/time cohabitent (preset sélectionne les 2 champs, édition manuelle bascule en 'custom')"
    - "Source unique de vérité : const sourceFile = await addLoveNote(note) — zéro reconstruction côté écran"
key_files:
  created:
    - components/lovenotes/LoveNoteEditor.tsx
  modified:
    - components/lovenotes/index.ts
    - app/(tabs)/lovenotes.tsx
decisions:
  - "Preset 'Demain matin' pré-rempli au mount (per RESEARCH Open Q 5) — 0 friction, couvre 80% des cas"
  - "Chip déclenche son propre Haptics.selectionAsync() en interne — caller N'AJOUTE PAS de haptic (évite double-trigger)"
  - "revealTime est 'HH:MM' (DateInput.toHHMM sans secondes) → handleSave compose revealAt = `${date}T${time}:00` pour respecter format LoveNote.revealAt local-ISO"
  - "recipientProfiles calculé dans lovenotes.tsx (profiles.filter(p.id !== profileId)) PUIS passé en prop — LoveNoteEditor reste agnostique du contexte profil actif"
  - "FAB utilise primary (top-level useThemeColors) + Shadows.md token — pas de hardcoded '#fff', fabText via colors.onPrimary"
  - "Bouton preview toggle couleur = primary (top-level), pas colors.tint (tint est ThemeColors-level, pas AppColors)"
metrics:
  duration: "8 min"
  completed: 2026-04-17
requirements: [LOVE-09, LOVE-10, LOVE-12]
---

# Phase 36 Plan 03 : Écran composition Love Note + FAB Écrire + hook foreground Summary

Livre la boucle UX complète de composition : FAB "✏️ Écrire" dans /lovenotes → LoveNoteEditor Modal pageSheet (chips destinataire + body markdown + preview toggle + 4 chips presets temporels + 2 DateInput) → save → `addLoveNote` (retour sourceFile) → `scheduleLoveNoteReveal({...note, sourceFile})` → notification locale programmée. Hook `useRevealOnForeground` branché dans l'écran : bascule auto `pending → revealed` au mount et à chaque retour en foreground.

## Scope

- 1 composant neuf : `LoveNoteEditor.tsx` (Modal pageSheet — 314 lignes dont styles + JSX).
- Barrel `components/lovenotes/index.ts` : réexporte `LoveNoteEditor`.
- `app/(tabs)/lovenotes.tsx` étendu : +imports, +destructuring `addLoveNote`/`updateLoveNoteStatus`, +`useRevealOnForeground`, +state `editorVisible`, +memo `recipientProfiles`, +`handleSave`, +FAB Pressable, +`<LoveNoteEditor>`, +styles `fab`/`fabText`.

## Tasks Executed

| # | Task | Commit |
|---|------|--------|
| 1 | Créer `components/lovenotes/LoveNoteEditor.tsx` + barrel | c90fd99 |
| 2 | Câbler FAB Écrire + LoveNoteEditor + useRevealOnForeground dans lovenotes.tsx | 4df9f6c |

## Files

### Created
- `components/lovenotes/LoveNoteEditor.tsx` — Modal pageSheet composition, 4 chips presets, preview toggle, validation 3 niveaux

### Modified
- `components/lovenotes/index.ts` — +1 export `LoveNoteEditor`
- `app/(tabs)/lovenotes.tsx` — FAB + editor wiring + useRevealOnForeground (ajout ~93 lignes)

## Decisions Made

1. **Preset "Demain matin" par défaut** — useEffect([visible]) appelle `presetTomorrowMorning()` et écrit date+time au mount. Couvre le cas le plus fréquent (surprise au réveil du destinataire) sans friction initiale.
2. **Pas de doublon Haptics côté caller de Chip** — Chip.tsx appelle déjà `Haptics.selectionAsync()` en interne (cf. components/ui/Chip.tsx:28). Les callers (applyPreset, destinataire, preset) n'ajoutent PAS d'appel haptic pour éviter le double-trigger (Pitfall signalé dans le plan).
3. **revealAt composition** — `DateInput mode="time"` retourne `'HH:MM'` (sans secondes, cf. DateInput.toHHMM). `LoveNote.revealAt` est un ISO local sans Z. `handleSave` compose donc `${date}T${time}:00` pour obtenir `YYYY-MM-DDTHH:MM:00` — format respecté par le parser + `isRevealed`.
4. **`primary` (top-level) au lieu de `colors.tint`** — Le plan initial pointait `colors.tint` pour la couleur du bouton preview, mais `tint` est au niveau `ThemeColors` top-level (pas dans `AppColors`). Corrigé en déstructurant `primary` depuis `useThemeColors()` — cohérent avec le pattern Button variant primary.
5. **FAB background = `primary`** — Violet accent cohérent avec la famille d'écrans du dashboard, bon contraste sur `colors.bg` (sable clair) et `#12151A` (dark). Alternative `colors.tint` (`#EDE9FE` light) aurait eu un contraste insuffisant avec `colors.onPrimary = '#FFFFFF'`.
6. **Shadows.md token** — Déjà exporté par `constants/shadows.ts` — pas de fallback inline nécessaire.

## Deviations from Plan

### Rule 1 — Bug — `colors.tint` n'existe pas dans `AppColors`
- **Found during:** Task 1 typecheck
- **Issue:** Le plan spécifiait `colors.tint` pour le bouton toggle preview, mais `tint` est dans le ThemeColors top-level (via `useThemeColors()` déstructure `{ primary, tint, colors, ... }`), pas dans `colors: AppColors`. Accéder `colors.tint` → undefined (silencieux en runtime, violation `useThemeColors()` convention CLAUDE.md).
- **Fix:** Déstructurer `primary` depuis `useThemeColors()` et l'utiliser à la place (cohérent avec le pattern Button primary).
- **Files modified:** `components/lovenotes/LoveNoteEditor.tsx`, `app/(tabs)/lovenotes.tsx`
- **Commit:** c90fd99 (Task 1) et 4df9f6c (Task 2)

### Rule 2 — Missing critical — FAB background
- **Found during:** Task 2 review avant commit
- **Issue:** Le plan suggérait `backgroundColor: colors.tint` pour le FAB. `colors.tint` n'existe pas dans `AppColors` (voir déviation précédente), et même si on utilisait `tint` top-level (`#EDE9FE` light), le contraste avec `colors.onPrimary = '#FFFFFF'` serait illisible (texte blanc sur fond violet très clair).
- **Fix:** `backgroundColor: primary` (violet accent, WCAG AA avec `#FFFFFF`).
- **Files modified:** `app/(tabs)/lovenotes.tsx`
- **Commit:** 4df9f6c

## Deferred Issues

### Pré-existant hors scope (Phase 35, déjà tracé dans 36-01 SUMMARY)
- `app/(tabs)/lovenotes.tsx:125` — `TS2741 Property 'onClose' is missing in type '{ title: string; }' but required in type 'ModalHeaderProps'` sur `<ModalHeader title="Boîte aux lettres" />`. Ligne créée en Phase 35-01 (commit b00abb3), ligne **non touchée** par Plan 36-03 (`handleSave`/FAB/Editor sont ajoutés en fin de composant, les imports en haut). Per SCOPE BOUNDARY, pas fixé ici — à adresser via quick-task ou plan dédié.

## Verification

- [x] `components/lovenotes/LoveNoteEditor.tsx` exporte `LoveNoteEditor` (named export)
- [x] Modal `presentationStyle="pageSheet"` + `animationType="slide"` + `onRequestClose`
- [x] `useEffect([visible])` reset state + préremplit preset `tomorrow`
- [x] 4 chips presets (tomorrow / sunday / month / custom) avec `applyPreset`
- [x] 2 `DateInput` côte-à-côte (mode='date' + mode='time'), `onDateChange`/`onTimeChange` basculent activePreset en 'custom'
- [x] Toggle preview MarkdownText ↔ TextInput
- [x] Validation 3 niveaux (destinataire / body.trim() / revealAt > now+60s) avec Alerts FR
- [x] Garde `noRecipients` désactive bouton + message FR
- [x] `Haptics.notificationAsync(Success)` au save OK — pas de duplication Chip.selectionAsync
- [x] Barrel `components/lovenotes/index.ts` réexporte `LoveNoteEditor`
- [x] `app/(tabs)/lovenotes.tsx` importe `LoveNoteEditor`, `useRevealOnForeground`, `scheduleLoveNoteReveal`, `localIso` — **pas** `loveNotePath`
- [x] `useRevealOnForeground(loveNotes, updateLoveNoteStatus)` appelé dans le composant
- [x] State `editorVisible` + memo `recipientProfiles` (filtre `p.id !== profileId`)
- [x] `handleSave` : `const sourceFile = await addLoveNote(note)` puis `await scheduleLoveNoteReveal({...note, sourceFile})` — zéro reconstruction de chemin
- [x] FAB `position: 'absolute'` bottom-right rendu si `activeProfile` non null, `Haptics.impactAsync(Light)` au tap
- [x] `fabText` utilise `colors.onPrimary` inline (pas de hardcoded `'#fff'`)
- [x] `grep -c "loveNotePath" app/(tabs)/lovenotes.tsx` → 0
- [x] `npx tsc --noEmit` propre sur le scope (seule erreur restante = Phase 35-01 pré-existante à ligne 125)

## Known Stubs

None. Tous les handlers sont câblés (addLoveNote vault write, scheduleLoveNoteReveal notif, updateLoveNoteStatus via useRevealOnForeground). Pas de données hardcodées flow vers le rendu.

## Self-Check: PASSED

Files existence verified :
- FOUND: components/lovenotes/LoveNoteEditor.tsx
- FOUND: components/lovenotes/index.ts (modifié — export LoveNoteEditor ajouté)
- FOUND: app/(tabs)/lovenotes.tsx (étendu — FAB + editor + hook)

Commits existence verified :
- FOUND: c90fd99 (Task 1 — LoveNoteEditor + barrel)
- FOUND: 4df9f6c (Task 2 — wiring lovenotes.tsx)

Patterns verified (grep) :
- FOUND: `useRevealOnForeground(loveNotes, updateLoveNoteStatus)` dans lovenotes.tsx
- FOUND: `const sourceFile = await addLoveNote` dans lovenotes.tsx
- FOUND: `scheduleLoveNoteReveal({ ...note, sourceFile })` dans lovenotes.tsx
- FOUND: 0 occurrences de `loveNotePath` dans lovenotes.tsx
- FOUND: `colors.onPrimary` sur fabText dans lovenotes.tsx
