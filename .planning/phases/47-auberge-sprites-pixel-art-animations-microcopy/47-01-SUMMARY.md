---
phase: 47
plan: 47-01
status: complete
completed: 2026-04-29
---

# Plan 47-01 — Sprites bâtiment auberge (3 niveaux) — SUMMARY

## Livré

3 sprites pixel art bâtiment auberge (64×64 PNG, RGBA transparent) générés via API pixellab.ai (`https://api.pixellab.ai/v1/generate-image-pixflux`) :

- `assets/buildings/auberge_lv1.png` — petite cabane chaleureuse en bois, toit de chaume, sourire
- `assets/buildings/auberge_lv2.png` — maison plus étoffée, toit à pignons, fenêtres lumineuses
- `assets/buildings/auberge_lv3.png` — grande auberge prospère, cheminée fumante, plusieurs étages

Registry `BUILDING_SPRITES.auberge` ajoutée dans `lib/mascot/building-sprites.ts` avec `expandSprites(L1, L2, L3)` (les niveaux 4-10 réutilisent L3).

## Décisions

- **Pipeline** : API HTTP pixellab directe (`PIXELLAB_API_KEY` du shell env) car le sub-agent gsd-executor n'avait pas accès au MCP pixellab ni à la variable d'env. L'orchestrateur a généré les sprites via `curl` + `jq` puis copié dans `assets/buildings/`.
- **Endpoint** : `POST /v1/generate-image-pixflux` avec `{ description, image_size: {width:64, height:64}, no_background: true }`.
- **Coût** : 0 USD reporté par l'API (free tier).

## Commits

- `83a890c` — feat(47-01,47-02): sprites pixellab — bâtiment auberge L1/L2/L3 + 6 portraits PNJ visiteurs (commit groupé avec Plan 47-02 car même session, même API call pattern)

## Vérification

- `file assets/buildings/auberge_lv*.png` → tous 64×64 RGBA non-interlaced.
- `npx tsc --noEmit` clean (BUILDING_SPRITES typé correctement).
- Sprites visualisés via Read tool (cohérents avec poulailler/grange/moulin/ruche).

## Notes

Le commit groupe Plan 47-01 et 47-02 car les deux ont utilisé le même pipeline (API pixellab depuis l'orchestrateur) sur la même session, avec la même clé API et le même format. Voir `47-02-SUMMARY.md` pour le détail des 6 portraits PNJ.
