---
sketch: 005
name: maison-interieur
question: "À quoi ressemble « entrer dans la maison du compagnon » + meubler des slots, et est-ce que le compagnon qui réagit procure le kiff ?"
winner: "L"
tags: [farm, gamification, sink, feuilles, companion, cosmetic]
---

# Sketch 005 : Maison du compagnon — sink de feuilles

## Design Question
La feature : une maison pour l'animal de compagnie dans la ferme, qu'on meuble en
dépensant des feuilles (façon Animal Crossing) — un **sink cosmétique** pour absorber
le surplus de feuilles. Question centrale : est-ce que la boucle
**slot vide → achat en feuilles → compagnon qui réagit** procure assez de kiff pour
justifier l'effort, et quelle mise en scène de la pièce la rend la plus lisible ?

## How to View
open .planning/sketches/005-maison-interieur/index.html

Interactif : clique un slot **＋** → catalogue (6 meubles) → « Acheter » retire les
feuilles du portefeuille, pose le meuble, fait monter la barre d'humeur et bondir le
compagnon (cœurs qui flottent). 4 slots remplis = « Aux anges ».

## Variants
- **★ L : Placement libre (Stardew)** — GAGNANT. Vrai décor illustré (`room-bg.png`). Boutique → achat → meuble draggable posé n'importe où. Achats illimités du même meuble. Tap = sélection + ✕ pour enlouver.
- **R : Slots (vraie pièce)** — même décor, 4 emplacements `＋` fixes sur les ancrages de la pièce. Plus simple à coder mais sink plafonné.
- **A : Vue de dessus (CSS)** — tiles CSS façon Stardew, 4 slots. Remplacé par le vrai décor.
- **B : Maison de poupée** — coupe latérale, 2 slots mur + 2 slots sol. Lecture immédiate, peu d'assets.
- **C : Nook à hotspots** — scène cosy, 4 pastilles pulsantes.

## Décision
**Placement libre** retenu. Il gagne sur les **deux** axes qui comptent :
1. **Le kiff** — « c'est mon espace », on agence librement (vs remplir des trous).
2. **Le sink** — *bottomless* : on peut racheter le même meuble à l'infini, donc les feuilles
   se dépensent durablement. Les slots plafonnaient le sink à ~4 achats.

### Décisions de build verrouillées
1. **Coords meubles : fractionnaires 0-1** (survit aux tailles d'écran, précédent `TileMapRenderer.tsx:799-811`).
2. **Pas de rotation en v1** (un champ de moins, pas d'UI de rotation).
3. **Déblocage maison : 100 000 🍃 one-shot** (gold-sink prestige end-game, façon bâtiment Animal Crossing).
   Risque assumé : verrou long pour la plupart des profils → le sink mobilier reste dormant jusqu'au déblocage.

### Faisabilité (investigation codebase, levée)
- **Drag 2D** : part de zéro mais squelette réutilisable `components/SwipeToDelete.tsx:145-187` (`Gesture.Pan` + `useSharedValue` + `useAnimatedStyle`), adapter `onUpdate` X+Y. Seul vrai inconnu → spike code optionnel.
- **Persistance** : étendre `FarmProfileData` + paire `parse/serializeCompanionHouse` (CSV `id:x:y|...` comme `building-engine.ts:33-79`), écrit `farm-{id}.md` via pattern `setCompanion` (`useVault.ts:2571`). Déjà hors cache.
- **Sink feuilles** : copier `buyMascotItem()` (`useVaultProfiles.ts:196-284`) — valide solde, débite `profile.coins` dans `gami-{id}.md` + historique. Anti-négatif géré.
- **Entrée ferme** : `companion_house` dans `BUILDING_CATALOG` (`types.ts:531`, non-productif comme Auberge), écran plein écran `app/companion-house/[houseId].tsx` (calqué `app/story/[id].tsx`), tap dans `handleBuildingCellPress` (`tree.tsx:1865`).

### Coût assumé (pour la phase de build)
- **Drag tactile réel** : `react-native-gesture-handler` + `reanimated` (déjà au stack).
- **Persistance** : position x/y de chaque meuble en frontmatter (fichier maison dans le vault).
- **Art** : chaque meuble = un sprite illustré (pas emoji) pour matcher le décor riche.
- **Allègement v1 possible** : pas de rotation, snap léger sur grille invisible → coords entières,
  persistance plus simple, ~90% du kiff.

## What to Look For
- **Le kiff** : poser/glisser un meuble + le chien qui réagit donne envie de recommencer (= dépenser encore).
- **Le sink se sent-il bien** : solde 🍃 qui baisse + bump portefeuille → satisfaisant, pas punitif.
- **Place dans la ferme** : maison-objet tappable dans la ferme → push cette vue.
