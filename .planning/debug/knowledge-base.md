# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## fleur-lave-visibility — Sprites de cultures 32x64 clippés par overflow:hidden et style 36x44
- **Date:** 2026-05-01
- **Error patterns:** sprite invisible, clippé, overflow hidden, badge masque sprite, fleur de lave, crops, 32x64, 36x44, PlantWagerBadge, WorldGridView
- **Root cause:** Les sprites de cultures (32x64px) sont contraints à 36x44px dans une cellule de 52x52px avec overflow:hidden. Les 20px de hauteur supérieure sont clippés. Le badge sporée (zIndex:12, top-right) masque ensuite le peu de sprite qui reste visible.
- **Fix:** 1. Retiré overflow:hidden de styles.cell (L983) pour permettre débordement vertical 2. Ajusté cropSprite de 36x44 → 32x64 (L1002) pour respecter dimensions réelles des assets 3. Commentaires ajoutés pour expliquer la logique
- **Files changed:** components/mascot/WorldGridView.tsx
---

