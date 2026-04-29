---
phase: 47-auberge-sprites-pixel-art-animations-microcopy
plan: 02
subsystem: mascot/auberge
tags: [sprites, pixel-art, visitors, assets, registry]
requires:
  - VISITOR_CATALOG (Phase 43) — IDs canoniques des PNJ
provides:
  - VISITOR_SPRITES registry — mapping visitorId → require(PNG)
  - 6 portraits PNJ pixel art 32×32 DB16
affects:
  - assets/visitors/ (nouveau dossier)
  - lib/mascot/visitor-sprites.ts (nouveau)
  - Sera consommé au Plan 03 par AubergeSheet + DashboardAuberge
tech-stack:
  added: []
  patterns:
    - "Registry require() top-level (mirror de building-sprites.ts)"
    - "Pixel art DB16 + lumière top-left (placeholders procéduraux PIL)"
key-files:
  created:
    - assets/visitors/boulanger.png
    - assets/visitors/lucette.png
    - assets/visitors/voyageuse.png
    - assets/visitors/apiculteur.png
    - assets/visitors/marchand.png
    - assets/visitors/comtesse.png
    - lib/mascot/visitor-sprites.ts
  modified: []
decisions:
  - Génération via PIL (placeholders procéduraux) car MCP pixellab/dogsprite et PIXELLAB_API_KEY non disponibles dans cette session — dette documentée pour itération ultérieure
  - Taille uniforme 32×32 (suffisante pour rendu ~64-80px dans AubergeSheet et ~32-40px dans DashboardAuberge)
  - Clés du registry alignées sur les `id` du VISITOR_CATALOG (Phase 43) pour matching strict
metrics:
  duration: ~4 min
  completed: 2026-04-29
  tasks: 2
  files_created: 7
---

# Phase 47 Plan 02 : Portraits PNJ Auberge Summary

> Génération de 6 portraits pixel art 32×32 (palette DB16) pour les visiteurs PNJ de l'Auberge + nouveau registry `lib/mascot/visitor-sprites.ts` consommable au Plan 03.

## Tasks completed

| Task | Name                                        | Commit    | Files                                        |
| ---- | ------------------------------------------- | --------- | -------------------------------------------- |
| 1    | Génération des 6 portraits PNJ              | `9dab5b6` | `assets/visitors/{6 PNG 32×32}`              |
| 2    | Création registry `visitor-sprites.ts`      | `f19c8f5` | `lib/mascot/visitor-sprites.ts`              |

Checkpoint Task 3 (human-verify) auto-approuvé en mode auto.

## Aperçus visuels

| visitorId            | Fichier              | Traits visuels                                                              |
| -------------------- | -------------------- | --------------------------------------------------------------------------- |
| `hugo_boulanger`     | `boulanger.png`      | Toque blanche puffy + tablier blanc + barbe brune + sourire rouge + joues   |
| `meme_lucette`       | `lucette.png`        | Chignon gris + cheveux gris encadrants + châle rouge à pois jaunes          |
| `voyageuse`          | `voyageuse.png`      | Capuche vert foncé + yeux jaunes glow + cape pleine + sangle de sac brune  |
| `yann_apiculteur`    | `apiculteur.png`     | Chapeau de paille jaune + voile maillé + 2 abeilles + costume blanc         |
| `marchand_ambulant`  | `marchand.png`       | Chapeau pointu bleu foncé + monocle cyan + moustache + gilet bleu + boutons |
| `comtesse`           | `comtesse.png`       | Couronne jaune à gemmes + ruff blanc en dentelle + robe rouge + galon doré  |

Tous : 32×32 RGBA, palette DB16 (16 couleurs strictes), lumière top-left, ombres bottom-right via auto-outline, fond transparent.

## Pattern du registry

```ts
// lib/mascot/visitor-sprites.ts
const HUGO = require('../../assets/visitors/boulanger.png');
// ...
export const VISITOR_SPRITES: Record<string, any> = {
  hugo_boulanger:    HUGO,
  meme_lucette:      LUCETTE,
  voyageuse:         VOYAGEUSE,
  yann_apiculteur:   YANN,
  marchand_ambulant: MARCHAND,
  comtesse:          COMTESSE,
};
```

Mirror exact de `building-sprites.ts` (require top-level, lookup direct par id).

## Vérifications

- `ls assets/visitors/*.png | wc -l` → 6 ✅
- `file assets/visitors/*.png` → tous "PNG image data, 32 x 32, 8-bit/color RGBA, non-interlaced" ✅
- `npx tsc --noEmit` → aucune erreur sur `visitor-sprites.ts` ✅ (les erreurs résiduelles MemoryEditor / cooklang / useVault sont pré-existantes — voir CLAUDE.md "ignorer")
- Clés du registry strictement égales aux `id` de `VISITOR_CATALOG` ✅

## Deviations from Plan

### Pipeline de génération (Rule 3 — Blocking issue)

**Found during:** Task 1
**Issue:** Les outils MCP `pixellab` et `dogsprite` ne sont pas exposés à l'agent dans cette session, et `PIXELLAB_API_KEY` n'est pas présent dans `.env` (seul `EXPO_PUBLIC_SENTRY_DSN`).
**Fix:** Génération procédurale via Python PIL avec palette DB16 stricte (16 couleurs hex codées une-à-une), tracé manuel pixel par pixel (toque, châle, capuche, chapeau de paille, monocle, couronne…), shading top-left + auto-outline bottom-right. Chaque portrait dessiné individuellement avec ses traits distinctifs.
**Trade-off:** Le rendu reste basique comparé à pixellab — silhouettes lisibles et différenciées, mais finition moins raffinée (pas d'anti-aliasing optique fin, anatomie simplifiée). Suffisant pour livrer le wiring Plan 03 et tester l'intégration.
**Impact:** Aucun sur la structure / interface attendue par le Plan 03 — le registry expose la même shape que prévu.

## Known Stubs / Dette

### Sprites portraits — itération qualité visuelle

- **Fichiers** : les 6 PNG dans `assets/visitors/`
- **Raison** : générés en placeholders procéduraux faute d'accès pixellab/dogsprite. Lisibles et différenciés mais peuvent gagner en qualité.
- **Résolution** : à itérer dans une Quick task ultérieure quand l'accès pixellab MCP sera disponible OU quand `PIXELLAB_API_KEY` sera ajouté à `.env`. Le registry et les chemins n'auront pas besoin de changer (drop-in replacement des PNG).

## Self-Check: PASSED

- `assets/visitors/boulanger.png` — FOUND
- `assets/visitors/lucette.png` — FOUND
- `assets/visitors/voyageuse.png` — FOUND
- `assets/visitors/apiculteur.png` — FOUND
- `assets/visitors/marchand.png` — FOUND
- `assets/visitors/comtesse.png` — FOUND
- `lib/mascot/visitor-sprites.ts` — FOUND
- Commit `9dab5b6` — FOUND
- Commit `f19c8f5` — FOUND
