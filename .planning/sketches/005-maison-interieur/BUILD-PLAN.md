# Plan d'implémentation — Maison du compagnon (sink de feuilles)

> Produit par orchestration multi-agents (design × 4 domaines → vérification adverse × 4), puis
> synthétisé et corrigé contre le vrai codebase. Sketch validé : `005-maison-interieur` (variante L).
> Hors GSD — plan de référence pour la conversation de build.

## Décisions verrouillées
1. **Placement libre** (pas de slots), **duplicatas illimités** → sink bottomless.
2. **Coords fractionnaires 0-1** (clamp strict), rendu `left = x * largeurPièce`.
3. **Pas de rotation, pas de snap, pas d'undo** en v1.
4. **Déblocage maison = 100 000 🍃 one-shot** (gold-sink prestige). Meubles ensuite à 40-95 🍃.

---

## Corrections clés issues de la vérification adverse (à NE PAS rater)

- 🔴 **`preserveFarmFields` (useVaultProfiles.ts:44-59)** ne préserve pas `companionHouse`. Sans correctif,
  toute édition de profil (avatar, prénom…) **vide la maison en mémoire** — même bug que FAM-39.
  → **Tâche 0, bloquante.** En profiter pour vérifier si `companion` (absent de la liste aussi) est un bug latent.
- 🔴 **Duplicatas illimités** : le design "data" proposait "max 1 meuble par furnitureId" — **ça contredit le sink infini**.
  Le stockage doit être une **liste ordonnée** d'instances (répétitions autorisées), identifiées par index runtime.
- 🟠 **Atomicité achat** : un achat écrit `gami-{id}.md` (débit coins) ET `farm-{id}.md` (placement). Ordre recommandé :
  valider solde → écrire `farm` (placement) → écrire `gami` (débit) ; sur échec `gami`, rollback `farm`. Sinon désync.
- 🟠 **Conflit geste/ScrollView** (CLAUDE.md) : la pièce ne doit **jamais** être dans une `ScrollView` verticale.
  Écran intérieur = conteneur plein écran à taille fixe. La boutique = modal `pageSheet` séparée.
- 🟠 **Frontmatter** : clé `companion_house:` (snake_case, comme `farm_buildings`, `mascot_decorations`),
  parsée/sérialisée **après** `companion` dans `parseFarmProfile`/`serializeFarmProfile`.
- 🟠 **i18n** : aucune clé `companionHouse.*` n'existe → à créer dans `locales/fr` (sinon affichage de la clé brute).
- 🟢 **Cache** : `companionHouse` vit dans `farm-{id}.md`, déjà exclu du cache → **pas de bump `CACHE_VERSION`**.
- 🟢 **Sprites** : déjà générés et copiés dans `.planning/sketches/005-maison-interieur/assets/` (7 PNG transparents).
  À déplacer vers `assets/companion-house/`.

---

## Approche retenue pour le déblocage (simplification vérifiée)

**Faire de `companion_house` une entrée `BUILDING_CATALOG` non-productive** (comme l'Auberge, `producesResource:false`)
au coût de **100 000 🍃**. On **réutilise le flux d'achat de bâtiment existant** (`constructBuilding` débite déjà les coins
et place sur une cellule) → pas de fonction `unlockCompanionHouse` séparée, pas de risque de désync coins.

- « Maison débloquée » ≡ le bâtiment existe dans `profile.farmBuildings`.
- Le **tap** sur la cellule maison : si bâtie → `router.push` vers l'intérieur ; si vide → shop bâtiment (déblocage 100k).
- L'état du **meublage** (`companionHouse.placedFurniture`) reste dans `farm-{id}.md`, indépendant du bâtiment.

> Alternative écartée : flag `unlocked` custom + `unlockCompanionHouse()` dédié (double-tap race, désync coins).

---

## Modèle de données

```ts
// lib/mascot/companion-house-types.ts (NOUVEAU)
export interface PlacedFurniture {
  furnitureId: string;   // ref FURNITURE_CATALOG (répétitions autorisées)
  x: number;             // 0-1 (clamp strict au parse)
  y: number;             // 0-1
  placedAt: string;      // ISO
}
export interface CompanionHouseData {
  placedFurniture: PlacedFurniture[];   // liste ordonnée — identité = index runtime
}

export interface FurnitureDefinition {
  id: string; labelKey: string; sprite: number; cost: number; // 40-95
}
export const FURNITURE_CATALOG: FurnitureDefinition[] = [ /* 6 meubles, prix du sketch */ ];
```

```ts
// lib/types.ts — FarmProfileData (~645)
companionHouse?: CompanionHouseData | null;
```

**Sérialisation** (`farm-{id}.md`, clé `companion_house:`), format CSV pipe/colon comme `building-engine.ts:33-79` :
```
companion_house: tapis:0.1500:0.2500:2026-06-15|plante:0.5000:0.6000:2026-06-16
```
Parser : `split('|')` → `split(':')`, `parseFloat` x/y, **rejeter si hors [0,1]**, repimer les invalides.

---

## Phases & tâches (commits atomiques, FR)

### Phase 0 — Fondations data + anti-perte de données  🔴 bloquante
| # | Tâche | Fichiers | Commit |
|---|-------|----------|--------|
| 0.1 | Ajouter `companionHouse` à `preserveFarmFields` (+ auditer `companion`) | `hooks/useVaultProfiles.ts:44` | `fix(farm): préserve companionHouse au merge profil (anti-FAM-39)` |
| 0.2 | Types `companion-house-types.ts` + `FURNITURE_CATALOG` (6 meubles, prix sketch) | `lib/mascot/companion-house-types.ts` (new) | `feat(maison): types + catalogue mobilier` |
| 0.3 | Paire `parse/serializeCompanionHouse` + helpers CSV (clamp 0-1, duplicatas OK) | `lib/parser.ts` (engine: `companion-house-engine.ts`) | `feat(maison): parser companion_house (CSV, clamp coords)` |
| 0.4 | Brancher dans `parseFarmProfile`/`serializeFarmProfile` (après `companion`) | `lib/parser.ts:909, 1137` | `feat(maison): persiste companion_house dans farm-{id}.md` |
| 0.5 | Tests roundtrip parser (vide, 1, N, coords hors-bornes, duplicatas) | `lib/__tests__/parser.test.ts` | `test(maison): roundtrip parser companion_house` |

### Phase 1 — Entrée ferme + déblocage 100k (réutilise bâtiments)
| # | Tâche | Fichiers | Commit |
|---|-------|----------|--------|
| 1.1 | Entrée `companion_house` dans `BUILDING_CATALOG` (cost 100000, `producesResource:false`) | `lib/mascot/types.ts:531` | `feat(maison): bâtiment companion_house (100k, non-productif)` |
| 1.2 | Sprite extérieur maison dans `BUILDING_SPRITES` | `lib/mascot/building-sprites.ts` + `assets/garden/buildings/companion_house/` | `feat(maison): sprite extérieur maison` |
| 1.3 | Tap : si bâtie → `router.push('/companion-house/'+profileId)` ; sinon shop déblocage | `app/(tabs)/tree.tsx:1865` (`handleBuildingCellPress`) | `feat(maison): tap maison → intérieur ou déblocage` |
| 1.4 | UI spéciale "Débloquer 100 000 🍃" dans le shop bâtiment (garde anti double-tap) | `components/mascot/BuildingShopSheet.tsx` | `feat(maison): écran déblocage 100k` |

### Phase 2 — Assets mobilier
| # | Tâche | Fichiers | Commit |
|---|-------|----------|--------|
| 2.1 | Déplacer les 7 sprites du sketch vers `assets/companion-house/` | `assets/companion-house/*.png` | `chore(maison): assets mobilier (sprites peints)` |
| 2.2 | Câbler `require()` des sprites dans `FURNITURE_CATALOG` | `lib/mascot/companion-house-types.ts` | `feat(maison): branche sprites au catalogue` |
| 2.3 | Clés i18n `companionHouse.furniture.*`, `.unlockCost`, `.buy`, `.delete` | `locales/fr/*.json` | `feat(maison): i18n FR mobilier` |

### Phase 3 — Écran intérieur + drag 2D (cœur)
| # | Tâche | Fichiers | Commit |
|---|-------|----------|--------|
| 3.1 | Route plein écran (calquée `story/[id].tsx`) : HUD 🍃 + pièce + bouton boutique | `app/companion-house/[profileId].tsx` (new) | `feat(maison): écran intérieur plein écran` |
| 3.2 | `DraggableFurniture` : `Gesture.Pan` X+Y (squelette `SwipeToDelete.tsx:145-187`), coords fractionnaires, clamp, haptics, spring | `components/companion-house/DraggableFurniture.tsx` (new) | `feat(maison): meuble draggable (placement libre)` |
| 3.3 | Sélection au tap + bouton supprimer l'instance (par index) | idem | `feat(maison): sélection + suppression meuble` |
| 3.4 | Hook `useCompanionHouse` : `buyFurniture` (copie `buyMascotItem:196-284`, atomicité farm→gami+rollback), `moveFurniture`, `removeFurniture` | `hooks/useVault.ts` ou `useVaultProfiles.ts` | `feat(maison): hook achat/placement mobilier` |
| 3.5 | Boutique `pageSheet` (catalogue + prix + achat, dismiss backdrop) | `components/companion-house/FurnitureShop.tsx` (new) | `feat(maison): boutique mobilier` |

### Phase 4 — Compagnon réactif + polish
| # | Tâche | Fichiers | Commit |
|---|-------|----------|--------|
| 4.1 | Compagnon dans la pièce + humeur/anim qui monte avec le nombre de meubles | écran intérieur | `feat(maison): compagnon réactif au meublage` |
| 4.2 | Empty state (pièce débloquée, 0 meuble) + toasts FR (`Alert.alert` solde insuffisant) | écran + hook | `feat(maison): empty state + feedback FR` |
| 4.3 | `npx tsc --noEmit` + `npx jest` verts | — | (validation, pas de commit) |

---

## Risques résiduels & garde-fous
- **Drag fiable dans la zone bornée** : seul vrai inconnu. Squelette `SwipeToDelete` couvre 80%. Si galère → spike isolé 1h.
- **Atomicité achat** : implémenter le rollback farm→gami dès 3.4 (pas en après-coup).
- **Double-tap déblocage 100k** : désactiver le bouton après 1er tap + garde "déjà bâti".
- **Réactivité HUD 🍃** : après achat, `setProfiles` met à jour `profile.coins` → vérifier que le HUD se rerend sans flicker.
- **Calibrage** : prix meubles 40-95 = 1-3 jours de jeu/meuble (≈30 🍃/jour). Maison 100k = end-game assumé.

## Fichiers analogues de référence
| Besoin | Copier depuis |
|--------|---------------|
| Drag gesture | `components/SwipeToDelete.tsx:145-187` |
| Coords fractionnaires absolues | `components/mascot/TileMapRenderer.tsx:799-811` |
| Achat / débit coins | `hooks/useVaultProfiles.ts:196-284` (`buyMascotItem`) |
| Parser CSV pipe/colon | `lib/mascot/building-engine.ts:33-79` |
| Read-modify-write farm file | `hooks/useVault.ts:2571` (`setCompanion`) |
| Route plein écran dynamique | `app/story/[id].tsx` |
| Bâtiment non-productif | `BUILDING_CATALOG` Auberge (`lib/mascot/types.ts:574`) |
| HUD wallet 🍃 | `app/(tabs)/tree.tsx:3545` |
