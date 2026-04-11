# Phase 29: Avatars vivants + portail retour - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 29-avatars-vivants-portail-retour
**Areas discussed:** Positionnement avatars sur la carte, Bulle tap avatar (VILL-03), Portail retour village → ferme

---

## Gray Areas — Initial Selection

| Area | Description | Selected |
|------|-------------|----------|
| Positionnement avatars sur la carte | Slot déterministe vs hash vs index sequential ? Combien de slots ? Layout relatif fontaine/stalls/board ? Comportement nouveau profil ? | ✓ |
| Indicateur visuel actif/inactif hebdo | Halo vs opacité vs les deux ? Couleur halo ? Définition "actif cette semaine" ? | |
| Bulle tap avatar (VILL-03) | Mécanisme tooltip vs toast vs modal ? Durée dismiss ? Contenu exact ? Animation entrée/sortie ? | ✓ |
| Portail retour village → ferme | Sprite emoji vs pixel art ? Position carte ? Remplacer le bouton header ‹ ? router.push vs replace ? Glow loop ? | ✓ |

**User skipped:** Indicateur visuel actif/inactif (halo/opacité) → reporté en Claude's Discretion dans CONTEXT.md (D-09, D-10).

---

## Zone 1 — Positionnement avatars sur la carte

### Q1: Comment assigner une position fixe à chaque profil sur la carte village ?

| Option | Description | Selected |
|--------|-------------|----------|
| Slots fixes dans VILLAGE_GRID | Ajouter 4-6 entrées `avatar_slot_0..N` avec role 'avatar' dans VILLAGE_GRID, assignées aux profils par ordre déterministe (index trié alphabétique sur profile.id). Déterministe, lisible, testable, extensible. | ✓ |
| Hash déterministe sur profile.id | Calculer hash(profile.id) % N_POSITIONS. Plus robuste à l'ajout/retrait mais moins lisible (collisions possibles). | |
| Ordre d'ajout dans profiles array | Ordre naturel de profiles.filter(...) assigné séquentiellement. Simple mais non-déterministe si l'ordre change. | |

**User's choice:** Slots fixes dans VILLAGE_GRID (Recommandé)

### Q2: Combien de slots avatars prévoir sur la carte ?

| Option | Description | Selected |
|--------|-------------|----------|
| 6 slots — taille famille standard | Couvre 2 parents + jusqu'à 4 enfants. Répartis autour de la fontaine/stalls sans collision. Profils en excès invisibles. | ✓ |
| 4 slots — minimal | Plus simple à placer mais limite la famille à 4 membres actifs. | |
| 8 slots — large marge | Couvre les familles recomposées / invités. Plus dense, risque de surcharge. | |

**User's choice:** 6 slots — taille famille standard (Recommandé)

### Q3: Où placer ces slots par rapport aux éléments existants ?

| Option | Description | Selected |
|--------|-------------|----------|
| Répartis autour de la fontaine centrale | Disposition en cercle/arc autour de fountain (0.5/0.45), entre stalls (0.22 et 0.78) et board (0.15/0.25). Les avatars habitent la place naturellement. | ✓ |
| En bas de la carte (zone piétons) | Ligne horizontale en bas (~y=0.85), comme des passants. Simple mais moins immersif. | |
| Dispersés organiquement sur toute la carte | Positions variées pour impression de vie — un près du stall, un au board, un près de la fontaine. Plus immersif mais plus difficile à équilibrer. | |

**User's choice:** Répartis autour de la fontaine centrale (Recommandé)

### Q4: Que faire si un nouveau profil est ajouté en cours de jeu ?

| Option | Description | Selected |
|--------|-------------|----------|
| Slot attribué automatiquement au prochain libre | Profils triés alphabétiquement par id, chaque nouveau prend le prochain slot libre. Déterministe — même profil = même slot après restart. | ✓ |
| Persistance du mapping profileId → slotId | Stocker explicitement l'assignation dans jardin-familial.md (nouveau champ append-only). Garantit stabilité même si ordre change. Plus de travail parser. | |

**User's choice:** Slot attribué automatiquement au prochain libre (Recommandé)

**Notes zone 1:** Toutes les recommandations ont été acceptées. Décision consolidée : slots fixes statiques dans VILLAGE_GRID + tri alphabétique, sans persistance dans le vault. Edge case "plus de 6 profils actifs" accepté comme rare et non géré visuellement en Phase 29.

---

## Zone 2 — Bulle tap avatar (VILL-03)

### Q1: Quel mécanisme pour afficher la bulle ?

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip absolute flottant au-dessus de l'avatar | Composant local AvatarTooltip absolute-positionné au-dessus de l'avatar tapé, animé en opacity+translateY via Reanimated. State local dans village.tsx. Contextuel à l'avatar, pas de drift UX. | ✓ |
| ToastProvider existant | Réutiliser showToast() déjà présent. Zéro nouveau code. Mais le toast est global (pas contextuel à l'avatar) — perd le lien visuel. | |
| Modal bottomSheet léger | Petit modal en bas d'écran avec plus d'infos. Trop lourd pour dismiss auto — casse la fluidité. | |

**User's choice:** Tooltip absolute flottant au-dessus de l'avatar
**Notes:** "Tooltip absolute c'est très bien par contre il faut bien prendre les compagnions comme avatar, pas d'emojis"

**→ Clarification majeure** : l'user demande des **sprites compagnon pixel art** (`profile.companion.activeSpecies` + `getCompanionStage(level)`) à la place de `ReactiveAvatar` (emoji-only). Cette décision s'applique à tous les avatars de la carte Phase 29, pas seulement au tooltip. Enregistrée comme D-01, D-02, D-03 dans CONTEXT.md.

### Q2: Durée avant dismiss automatique ?

| Option | Description | Selected |
|--------|-------------|----------|
| 2.5 secondes | Assez long pour lire, assez court pour ne pas frustrer si tap plusieurs avatars. Tap extérieur ou autre avatar = dismiss immédiat. | ✓ |
| 2 secondes | Plus punchy, peut être trop rapide pour lire. | |
| 3 secondes | Plus confortable mais pénalise le scan rapide. | |

**User's choice:** 2.5 secondes (Recommandé)

### Q3: Contenu exact de la bulle ?

| Option | Description | Selected |
|--------|-------------|----------|
| '[Prénom] — X contributions cette semaine' | Exact wording du requirement VILL-03. Mono-ligne, pixel art friendly. Si X=0 : '[Prénom] — pas encore contribué'. | ✓ |
| Version riche — prénom + total + rôle (Papa, Enfant) | Plus de contexte mais rallonge la bulle, empiète sur les avatars voisins. Le rôle n'est pas dans VILL-03. | |
| Version rétro — Lucas + icône 🌾 + chiffre | Plus visuel mais perd la clarté textuelle du requirement. | |

**User's choice:** '[Prénom] — X contributions cette semaine' (Recommandé)

### Q4: Animation entrée/sortie de la bulle ?

| Option | Description | Selected |
|--------|-------------|----------|
| Fade + slight translateY | Opacity 0→1 + translateY -4→0 en 180ms (entrée), inverse en 150ms (sortie). Reanimated withTiming. Discret, crédible en pixel art. | ✓ |
| Spring scale 0→1 | Plus bouncy et ludique mais moins crédible pour un petit tooltip info. | |
| Pas d'animation (apparition instantanée) | Plus simple mais rompt avec la fluidité reanimated du reste de l'app. | |

**User's choice:** Fade + slight translateY (Recommandé)

**Notes zone 2:** Décisions consolidées D-11 à D-15. La clarification critique : **tous les avatars de la carte utilisent les sprites compagnon pixel art**, le composant `ReactiveAvatar` actuel (emoji-only) est abandonné pour ce rendu. Nouveau composant `VillageAvatar.tsx` à créer.

---

## Zone 3 — Portail retour village → ferme

### Q1: Quel sprite pour le portail retour village → ferme ?

| Option | Description | Selected |
|--------|-------------|----------|
| 🏡 (maison avec jardin) | Distinct du 🏛️ (temple village) mais cohérent sémantiquement : 'retour chez soi'. | |
| Réutiliser 🏛️ (symétrique pur) | Même sprite des deux côtés. Plus symétrique mais ambigu : 'ça repart au village ?' | |
| 🌾 (épi de blé / ferme) | Rappelle la ferme mais peut se confondre avec décorations agricoles. | |
| 🚪 (porte) | Symbole universel 'sortie'. Très clair mais perd le côté magique. | |

**User's choice (initial):** — redirected
**Notes:** "Je veux un sprite pixel (et il faudrait remplacer l'emoji du portail aller)"

**→ Clarification majeure #2** : l'user veut du **pixel art pour les deux portails**, remplaçant aussi l'emoji 🏛️ existant dans tree.tsx:357. Je suis allé investiguer `assets/items/` et j'ai trouvé deux sprites pixel art pertinents : `portail.png` (spirale magique) et `cabane.png` (maison bois). J'ai ré-ouvert la question avec ces assets.

### Q1-bis: Quel sprite pour les portails maintenant qu'on a les assets pixel art ?

| Option | Description | Selected |
|--------|-------------|----------|
| Les deux portails = portail.png (symétrie) | Même sprite des deux côtés, symbolique 'portail magique' partout. Cohabite parfaitement avec la transition fade 400ms. tree.tsx:357 remplace l'emoji par ce sprite. village.tsx ajoute le même sprite dans VILLAGE_GRID. | ✓ |
| Aller=portail.png, Retour=cabane.png (narratif) | Portail côté ferme mène vers le monde magique (🌀). 'Portail' côté village est en fait la 'cabane' — on rentre chez soi. Plus narratif mais asymétrique. | |
| Réutiliser portail.png côté ferme + nouveau sprite pour le retour | Garder portail.png + créer/chercher un autre. Plus de travail. | |

**User's choice:** Les deux portails = portail.png (symétrie) (Recommandé)

### Q2: Où positionner le portail retour sur la carte village ?

| Option | Description | Selected |
|--------|-------------|----------|
| Dans VILLAGE_GRID avec role 'portal' | Ajouter une entrée `village_portal_home` au grid. Rendu via le même système d'overlay absolute que les avatars. Cohérent avec Phase 25. | ✓ |
| Overlay fixe hors VILLAGE_GRID | Position hardcodée dans village.tsx, comme un sprite UI libre. Simple mais sort du pattern grid. | |
| Centré en bas de la carte (~0.5/0.9) | Position centrale très visible. Risque de bloquer la vue sur la fontaine ou les stalls. | |

**User's choice:** Dans VILLAGE_GRID avec role 'portal' (Recommandé)

### Q3: Que faire du bouton retour '‹' existant dans le header village.tsx:407 ?

| Option | Description | Selected |
|--------|-------------|----------|
| Supprimer le bouton, seul le portail permet le retour | Un seul point d'entrée/sortie, cohérent avec Phase 28 D-08 ("un seul point d'entrée vers le village : le portail"). Principe de symétrie. | ✓ |
| Garder le bouton + ajouter le portail (coexistence) | Double mécanisme : tap rapide en header ou scénique via portail. Redondant et casse la symétrie. | |
| Remplacer le bouton par le portail uniquement si fade animé fiable | Coexistence temporaire. Complique le scope. | |

**User's choice:** Supprimer le bouton, seul le portail permet le retour (Recommandé)

### Q4: Navigation router : push ou replace pour le retour ?

| Option | Description | Selected |
|--------|-------------|----------|
| router.replace('/(tabs)/tree') | Conserve le pattern actuel village.tsx:409. Pas d'empilement stack : ferme → village → ferme ne laisse pas 3 écrans dans le back stack. | ✓ |
| router.push('/(tabs)/tree') | Symétrique à l'aller (push). Mais empile la stack à l'infini sur ping-pong — risque iOS memory pressure. | |
| router.back() | Navigation native 'retour arrière'. Casse si deep link direct. Moins robuste. | |

**User's choice:** router.replace('/(tabs)/tree') (Recommandé)

**Notes zone 3:** La clarification "pixel art pour les deux portails" étend le scope Phase 29 à une modification de `tree.tsx:357` (remplacement emoji → sprite pour le portail aller). C'est capturé en D-17 dans CONTEXT.md comme modification obligatoire pour respecter la symétrie VILL-11. Le sprite `assets/items/portail.png` existe déjà.

---

## Claude's Discretion

- **Indicateur visuel actif/inactif hebdo (VILL-02)** — user a skippé cette gray area. Claude propose halo glow `colors.success` pulsant + opacité réduite pour inactifs (D-09, D-10).
- **Coordonnées fines des 6 slots avatars et du slot portail** — valeurs proposées dans CONTEXT.md (0.35/0.40, etc.), ajustables par le planner (CD-02, CD-03).
- **Couleur/intensité/durée exactes du pulse halo actif** — guidance fournie (CD-01).
- **Mutualisation ou duplication du composant `PortalSprite`** — recommandation forte d'extraction partagée entre tree.tsx et village.tsx (CD-04).
- **Tailles exactes des sprites sur la carte** — ~24-32px compagnons, ~40-56px portails, ajustables (CD-05).

## Deferred Ideas

- Refacto emoji `ReactiveAvatar` — ne touche pas la section "Membres actifs" de village.tsx:524-553 (hors scope Phase 29, reste emoji).
- Nouveau sprite portail dédié par direction — écarté (D-17 symétrique).
- Bulle tap riche (rôle, emoji, icônes) — écarté en zone 2.
- Persistance mapping profileId → slotId dans vault — écarté en zone 1 Q4.
- Interactions inter-avatars, animations marche, personnalisation placement — hors scope v1.5 v1.

---

*Généré le 2026-04-11 via /gsd:discuss-phase 29*
