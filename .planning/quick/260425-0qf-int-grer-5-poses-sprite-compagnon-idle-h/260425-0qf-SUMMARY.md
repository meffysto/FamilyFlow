---
phase: quick-260425-0qf
plan: "01"
subsystem: live-activity
tags: [live-activity, companion, sprites, ios, swift, activitykit]
dependency_graph:
  requires: [Phase 42 mascotte LA câblée]
  provides: [5 poses LA compagnon, ContentState allégé, writeCompanionPoseFile bridge]
  affects: [MascotteLiveActivity.swift, DashboardCompanionDay.tsx, hooks/useVault.ts]
tech_stack:
  added: []
  patterns:
    - "App Group file keyed par pose (companion-sprite-{pose}.png)"
    - "derivePoseFromStage() mapping déterministe stage→pose"
    - "writeCompanionPosesToAppGroup() Promise.all × 5 poses avant start LA"
key_files:
  created: []
  modified:
    - lib/mascot/companion-sprites.ts
    - lib/mascotte-live-activity.ts
    - modules/vault-access/src/index.ts
    - modules/vault-access/ios/VaultAccessModule.swift
    - modules/live-activity-shared/ios/Sources/MascotteActivityAttributes.swift
    - ios/MaJourneeWidget/MascotteLiveActivity.swift
    - hooks/useVault.ts
    - components/dashboard/DashboardCompanionDay.tsx
decisions:
  - "pose: String? optionnel dans ContentState pour Codable additif backward compat"
  - "CompanionSpriteCache keyed par pose name (plus par token) — cache partagé durée LA"
  - "writeCompanionPosesToAppGroup fire-and-forget avant startMascotte (espèce/stade stable)"
  - "Flash happy 2s dans feedCompanion + DashboardCompanionDay via pose String, plus base64"
metrics:
  duration: "~35min"
  completed: "2026-04-24"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 8
---

# Phase quick-260425-0qf Plan 01: 5 poses sprite compagnon Live Activity Summary

**En une ligne :** Migration ContentState base64 (~5-15KB) vers pose String (<500B) avec 5 poses narratives (idle/happy/sleeping/eating/celebrating) écrites dans l'App Group au start de la Live Activity.

## Objectif atteint

La Live Activity mascotte affiche désormais 5 poses sprite distinctes au lieu du couple idle/happy. Le payload ContentState est passé d'un `companionSpriteBase64` lourd (~5-15KB) à un simple champ `pose: String` (<500B). Les 5 PNG sont écrits dans l'App Group au démarrage de la LA et restent stables pour toute sa durée.

## Ce qui a été livré

### Tâche 1 — Couche données (commit ea11048)

**lib/mascot/companion-sprites.ts**
- `CompanionMood` étendu : `'idle' | 'happy' | 'sleeping' | 'eating' | 'celebrating'`
- `COMPANION_SPRITES` étendu : sleeping/eating/celebrating pour les 5 espèces × 3 stades (45 PNG requis existants)
- Les 45 PNG ont été trackés en git (assets/garden/animals/…/{sleeping,eating,celebrating}.png)

**lib/mascotte-live-activity.ts**
- `companionSpriteBase64` retiré de `MascotteSnapshot`
- `pose?: CompanionMood | null` ajouté
- `derivePoseFromStage(stage, tasksDone, tasksTotal)` exportée — mapping déterministe
- `writeCompanionPosesToAppGroup(species, stage)` — 5 écritures parallèles via Promise.all
- `loadCompanionSpriteBase64` étendue pour les 5 moods (`idle` → `idle_1`, autres → clé directe)
- `startMascotte()` / `refreshMascotte()` : dérive la pose si non fournie, passe `effectivePose`

**modules/vault-access/src/index.ts**
- `writeCompanionPoseFile(pose, base64)` ajouté dans l'interface + wrapper exporté
- Signatures `startMascotteActivity` / `updateMascotteActivity` : `companionSpriteBase64` → `pose`

**modules/vault-access/ios/VaultAccessModule.swift**
- `persistCompanionSprite()` remplacé par `writeCompanionPoseFileToDisk(pose:base64:)` qui écrit `companion-sprite-{pose}.png`
- `AsyncFunction("writeCompanionPoseFile")` ajouté
- `startMascotteActivity` / `updateMascotteActivity` : paramètre `companionSpriteBase64` → `pose: String?`
- ContentState construit avec `pose: pose ?? "idle"`

**modules/live-activity-shared/ios/Sources/MascotteActivityAttributes.swift**
- `companionSpriteToken: String?` retiré
- `pose: String?` ajouté (optionnel = Codable additif : ancienne LA sans ce champ → nil, widget fallback emoji)

### Tâche 2 — Widget Swift + triggers TS (commit 3e771b6)

**ios/MaJourneeWidget/MascotteLiveActivity.swift**
- `CompanionSpriteCache` : cache `[String: UIImage]` keyed par pose name
- Méthode `image(for pose: String)` lit `companion-sprite-\(pose).png` depuis App Group
- `companionCompactView()` et `companionAvatar()` : utilisent `state.pose ?? "idle"` au lieu de `state.companionSpriteToken`
- `companionSpriteToken` supprimé de tous les call sites du widget

**hooks/useVault.ts**
- `feedCompanion` : double-load base64 (4s) remplacé par `patchMascotte({ pose: 'happy' })` + revert `'idle'` après 2s
- Import `loadCompanionSpriteBase64` retiré (plus utilisé dans ce hook)

**components/dashboard/DashboardCompanionDay.tsx**
- `handleStart` : `writeCompanionPosesToAppGroup(species, stage)` avant `startMascotte()`
- `startMascotte({...})` : `companionSpriteBase64` remplacé par `pose: derivePoseFromStage(...)`
- `subscribeTaskComplete` handler : double-load base64 remplacé par `patchMascotte({ pose: 'happy' })` + revert 2s
- Imports : `writeCompanionPosesToAppGroup` et `derivePoseFromStage` ajoutés

### Tâche 3 — Vérification device (en attente)

**Statut : en attente de vérification manuelle post-build TestFlight.**

La vérification device physique nécessite `npx expo run:ios --device` (build dev-client). Cette étape ne peut pas être automatisée — elle est laissée à la validation visuelle post-déploiement TestFlight.

Critères à vérifier :
- [ ] Lock Screen + DI compact : sprite idle par défaut
- [ ] Cocher une tâche → flash happy ~2s puis retour idle
- [ ] Stage 'midi' → pose eating persistante
- [ ] Stage 'dodo' → pose sleeping
- [ ] Recap + toutes tâches → pose celebrating
- [ ] Payload allégé : updates fluides, plus de freeze/lag
- [ ] Backward compat : vieille LA ne crash pas (fallback emoji si pose nil)

## Architecture — pattern App Group poses

```
JS start():
  writeCompanionPosesToAppGroup(species, stage)   ← Promise.all × 5
    → writeCompanionPoseFile('idle', base64)       → companion-sprite-idle.png
    → writeCompanionPoseFile('happy', base64)      → companion-sprite-happy.png
    → writeCompanionPoseFile('sleeping', base64)   → companion-sprite-sleeping.png
    → writeCompanionPoseFile('eating', base64)     → companion-sprite-eating.png
    → writeCompanionPoseFile('celebrating', base64)→ companion-sprite-celebrating.png
  startMascotteActivity(..., pose: 'idle', ...)

Widget render:
  CompanionSpriteCache.image(for: state.pose ?? "idle")
    → lit companion-sprite-{pose}.png depuis App Group
    → cache mémoire [String: UIImage]
```

## Triggers narratifs

| Stage | Pose | Déclencheur |
|-------|------|-------------|
| dodo | sleeping | `stageOverride === 'dodo'` |
| midi | eating | `stageOverride === 'midi'` |
| recap (100%) | celebrating | `stageOverride === 'recap' && tasksDone >= tasksTotal > 0` |
| autres | idle | défaut |
| cocher tâche | happy (2s) | `patchMascotte({ pose: 'happy' })` → revert |

## Migration base64 → pose

| Avant | Après |
|-------|-------|
| `companionSpriteBase64: string | null` (~5-15KB) | `pose: string` (<20B) |
| `companionSpriteToken: String?` dans ContentState | `pose: String?` dans ContentState |
| Sprite écrit à chaque update | Sprites écrits une fois au start |
| Double-load base64 pour flash happy (4s) | Patch pose String (2s) |

## Décisions prises

1. **`pose: String?` optionnel** (pas `pose: String` non-optionnel) : Codable additif sans custom decoder. Une LA en cours sans le champ décode à `nil`, le widget fallback emoji — acceptable.

2. **Cache keyed par pose name** (ex: "idle") plutôt que par token arbitraire : stable, prévisible, auto-invalidé si l'espèce change au prochain `start`.

3. **`writeCompanionPosesToAppGroup` fire-and-forget** avant `startMascotte` : l'espèce et le stade ne changent pas pendant la LA, donc une seule écriture au start est suffisante.

4. **Flash 2s** (au lieu de 4s) : délai réduit de moitié car plus besoin d'attendre le chargement base64 asynchrone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] DashboardCompanionDay.tsx non mentionné dans le plan**
- **Trouvé pendant :** Tâche 2
- **Issue :** `DashboardCompanionDay` utilisait encore `companionSpriteBase64` dans `startMascotte()` et le handler `subscribeTaskComplete` — deux références directes qui auraient cassé le build TS.
- **Fix :** Mise à jour du composant : `writeCompanionPosesToAppGroup` + `derivePoseFromStage` dans `handleStart`, `pose: 'happy'` dans le handler.
- **Files modified :** `components/dashboard/DashboardCompanionDay.tsx`
- **Commit :** 3e771b6

## Known Stubs

Aucun stub — les 5 poses sont câblées end-to-end. La tâche 3 (vérification device) est marquée "en attente" dans ce SUMMARY mais ne bloque pas le fonctionnement : le code est complet et compilable.

## Self-Check: PASSED

- companion-sprites.ts : FOUND
- mascotte-live-activity.ts : FOUND
- SUMMARY.md : FOUND
- commit ea11048 : FOUND (tâche 1)
- commit 3e771b6 : FOUND (tâche 2)
- tsc --noEmit : 0 nouvelle erreur
