# Sketch Manifest

## Design Direction

Surfacer les **accomplissements du partenaire** dans la propre ferme du joueur,
sans le forcer à naviguer vers la ferme du conjoint·e. Esthétique : warm pixel-art
cozy (cohérente avec la ferme actuelle de FamilyFlow — Stardew/Animal-Crossing-like,
parchemin chaud, emoji + tiles, pas Tailwind candy). Émotion cible : présence
douce, pas notification spam.

Inspirations : Animal Crossing visit bubbles, Stardew Valley journal entry,
Spiritfarer "while you were away".

## Reference Points

- `docs/farm-tilemap-mockup.html` — palette + structure phone-frame
- `docs/pixel-garden-final.html` — pixel art aesthetic
- `docs/dashboard-farm-v2.html` — composition cards / overlays
- Animal Crossing : New Horizons (visitor bubbles)
- Stardew Valley (journal "Sebastian sent you…")

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|-----------------|--------|------|
| 001 | ferme-presence-partenaire | Quel mécanisme surfacer les accomplissements partenaire dans la ferme ? | *abandonné — pivot vers dashboard* | farm, social, ambient |
| 002 | dashboard-partner-pulse | Quel pattern pour surfacer le pulse partenaire multi-domaines sur le dashboard ? | **A′ — strip fin sous header** (validation tiède, à vivre avant build) | dashboard, social, presence, couple |
| 005 | maison-interieur | À quoi ressemble meubler la maison du compagnon, et est-ce que le compagnon qui réagit procure le kiff ? (sink de feuilles) | **L — placement libre (Stardew)** sur vrai décor illustré : kiff + sink infini | farm, gamification, sink, feuilles, companion, cosmetic |
