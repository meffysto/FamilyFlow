---
phase: 36
plan: 01
subsystem: lovenotes
tags: [lovenotes, notifications, hooks, foundations]
requires: [phase-34-lovenotes-foundation, phase-35-lovenotes-ui]
provides:
  - lib/lovenotes/reveal-engine (presets purs + localIso)
  - scheduleLoveNoteReveal + cancelLoveNoteReveal (idempotents)
  - useRevealOnForeground hook AppState
  - addLoveNote Promise<string> (contrat durci)
affects:
  - hooks/useVault.ts (typage VaultContextValue.addLoveNote)
  - hooks/useVaultLoveNotes.ts (signature + garde stricte)
  - lib/scheduled-notifications.ts (+1 categorie CAT_LOVENOTE)
tech_stack:
  added: []
  patterns:
    - "Presets purs avec now injectable (pattern selectors.ts / getCompanionMood)"
    - "Idempotence schedule = cancel avant schedule (pattern cancelByCategory)"
    - "AppState listener + cleanup sub.remove() (pattern useVault.ts:710-720)"
    - "Promise<string> sur writers vault : sourceFile comme source unique de verite"
key_files:
  created:
    - lib/lovenotes/reveal-engine.ts
    - hooks/useRevealOnForeground.ts
  modified:
    - lib/lovenotes/index.ts
    - lib/scheduled-notifications.ts
    - hooks/useVaultLoveNotes.ts
    - hooks/useVault.ts
decisions:
  - "addLoveNote Promise<string> : source unique de verite pour Plan 03, elimine la reconstruction fragile de loveNotePath cote ecran"
  - "Garde !vaultRef.current leve exception (pas return silencieux) pour conserver typage Promise<string> strict"
  - "Presets reveal en JS pur — zero dependance date-fns"
  - "Notif lovenote silencieuse (sound: false) — reveal doit rester une surprise douce, pas un ping bruyant"
  - "Identifier notif sanitize / et . depuis sourceFile — evite collisions scheduler iOS"
metrics:
  duration: "12 min"
  completed: 2026-04-17
requirements: [LOVE-11, LOVE-12]
---

# Phase 36 Plan 01 : Fondations composition + reveal Summary

Livre 4 briques pures/infrastructure consommees par Plans 02-04 : presets reveal testables, scheduler notification idempotent, hook AppState pending->revealed, et signature `addLoveNote` durcie (`Promise<string>` — retourne le sourceFile resolu pour eliminer la duplication fragile de `loveNotePath` cote ecran composition).

## Scope

Zero UI. Fondations consommees par les plans suivants :
- Plan 02 (composition) consommera `presetTomorrowMorning/NextSundayEvening/InOneMonth` + `scheduleLoveNoteReveal` au save.
- Plan 03 (ecran composition) consommera le retour `Promise<string>` de `addLoveNote` pour appeler `scheduleLoveNoteReveal({...note, sourceFile})` sans reconstruire le chemin.
- Plan 04 (reveal + notif) consommera `useRevealOnForeground` dans `app/(tabs)/lovenotes.tsx`.

## Tasks Executed

| # | Task | Commit |
|---|------|--------|
| 1 | Creer `lib/lovenotes/reveal-engine.ts` (presets purs + localIso) + barrel | 71851a4 |
| 2 | Etendre `lib/scheduled-notifications.ts` avec scheduleLoveNoteReveal + cancelLoveNoteReveal | a9daa9c |
| 3 | Creer `hooks/useRevealOnForeground.ts` | 20eb33a |
| 4 | `addLoveNote` -> `Promise<string>` (hooks useVaultLoveNotes + useVault) | 073d1d7 |

## Files

### Created
- `lib/lovenotes/reveal-engine.ts` — 3 presets + helper localIso, zero import externe
- `hooks/useRevealOnForeground.ts` — hook AppState avec cleanup

### Modified
- `lib/lovenotes/index.ts` — reexporte reveal-engine
- `lib/scheduled-notifications.ts` — +1 import type LoveNote, +1 constante CAT_LOVENOTE, +2 exports (scheduleLoveNoteReveal, cancelLoveNoteReveal), +1 helper loveNoteIdentifier
- `hooks/useVaultLoveNotes.ts` — signature Promise<string> + return relPath + garde stricte (throw au lieu de return)
- `hooks/useVault.ts` — VaultContextValue.addLoveNote : Promise<void> -> Promise<string>

## Decisions Made

1. **addLoveNote Promise<string>** — Le Plan 03 doit appeler `scheduleLoveNoteReveal({...note, sourceFile})` apres save. Sans cette modif, le Plan 03 reconstruit `sourceFile` via `loveNotePath(to, createdAt)` cote ecran — si la formule de chemin change dans `addLoveNote`, divergence silencieuse + collision possible. Solution : `addLoveNote` retourne le sourceFile qu'il vient d'ecrire. Source unique de verite.
2. **Throw au lieu de return silencieux** — La garde `if (!vaultRef.current)` leve desormais une exception. Necessaire pour que le type Promise<string> soit honnete (pas Promise<string | undefined>). Cas pathologique (vault non init quand l'editeur est ouvert) acceptable : UI bloquee par activeProfile.
3. **Notif reveal silencieuse** — `content.sound: false` : le reveal doit etre une surprise douce, pas un ping bruyant qui trahit le contenu. L'utilisateur ouvrira l'app pour decouvrir.
4. **Identifier sanitize** — `sourceFile.replace(/[/.]/g, '_')` : iOS n'accepte pas `/` ou `.` dans les identifiers scheduler. Pattern repris de la serialisation defensive existante.
5. **Presets en JS pur** — Pas de date-fns. Usage stricte de Date natif avec setDate/setMonth/setHours : gere automatiquement les overflows (31 mars +1 mois = 30 avril via Date natif).

## Deviations from Plan

None — plan execute exactement comme ecrit.

## Deferred Issues

### Out-of-scope TypeScript error (hors plan 36-01)
`app/(tabs)/lovenotes.tsx:77` — `Property 'onClose' is missing in type '{ title: string; }'` sur `ModalHeaderProps`. Fichier cree en Phase 35 (commit b00abb3), **non touche par ce plan**. Pre-existant : a traiter dans un autre plan ou quick-task dedie. Per SCOPE BOUNDARY, pas fixe ici.

## Verification

- [x] `lib/lovenotes/reveal-engine.ts` exporte `localIso`, `presetTomorrowMorning`, `presetNextSundayEvening`, `presetInOneMonth`
- [x] `lib/lovenotes/index.ts` reexporte selectors + reveal-engine
- [x] `scheduleLoveNoteReveal(note): Promise<boolean>` exporte, idempotent
- [x] `cancelLoveNoteReveal(sourceFile): Promise<void>` exporte, idempotent
- [x] `scheduleLoveNoteReveal` appelle `cancelLoveNoteReveal` avant schedule
- [x] Return false si permission refusee ou revealDate <= now
- [x] `content.sound: false`, `data.route: '/(tabs)/lovenotes'`, `data.sourceFile`
- [x] Trigger DATE avec `Notifications.SchedulableTriggerInputTypes.DATE`
- [x] `useRevealOnForeground(loveNotes, updateStatus)` exporte
- [x] useEffect : reveal au mount + au passage foreground
- [x] Cleanup `sub.remove()` au unmount
- [x] Filtre `n.status === 'pending' && isRevealed(n, now)` strict
- [x] `console.warn` sous `if (__DEV__)`
- [x] `addLoveNote` signature `Promise<string>` dans les deux interfaces (useVaultLoveNotes + useVault)
- [x] `return relPath` apres ecriture confirmee
- [x] `npx tsc --noEmit` clean sur le scope du plan (hors erreurs pre-existantes MemoryEditor.tsx, cooklang.ts, useVault.ts documentees CLAUDE.md + lovenotes.tsx:77 pre-existant Phase 35)

## Known Stubs

None. Fondations pures, zero UI, zero hardcoded data flowing to render.

## Self-Check: PASSED

Files existence verified :
- FOUND: lib/lovenotes/reveal-engine.ts
- FOUND: lib/lovenotes/index.ts (modifie)
- FOUND: lib/scheduled-notifications.ts (modifie — scheduleLoveNoteReveal + cancelLoveNoteReveal presents)
- FOUND: hooks/useRevealOnForeground.ts
- FOUND: hooks/useVaultLoveNotes.ts (signature Promise<string>)
- FOUND: hooks/useVault.ts (typage propage)

Commits existence verified :
- FOUND: 71851a4 (Task 1)
- FOUND: a9daa9c (Task 2)
- FOUND: 20eb33a (Task 3)
- FOUND: 073d1d7 (Task 4)
