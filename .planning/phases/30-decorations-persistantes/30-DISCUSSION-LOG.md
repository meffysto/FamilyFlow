# Phase 30 : Discussion Log

**Gathered:** 2026-04-11
**Mode:** discuss (interactive Q&A, AskUserQuestion)
**Areas discussed:** Catalogue & sprites / Placement sur la carte / Catalogue UI

Cet audit trail capture les questions posées, les options présentées et les choix faits par l'utilisateur lors de `/gsd:discuss-phase 30`. Pour les décisions normalisées, voir `30-CONTEXT.md`.

---

## Carrying forward from prior phases

**Phase 29 (Avatars vivants + portail retour) :**
- Sprites pixel art (pas emoji) — précédent Phase 29 `VillageAvatar`
- Pipeline pixellab MCP via Bearer token (Phase 29.1 `portail-v2.png`)
- Append-only `jardin-familial.md` via `appendContribution` (Pitfall 4 : insérer avant section suivante)
- `VILLAGE_GRID` coords fractionnelles x/y 0-1
- `VillageRole` union extensible
- `useGarden` source unique d'état
- `useThemeColors()`, Reanimated, tokens `Spacing/Radius/Typography`, FR UI/commits

**CLAUDE.md :**
- Zéro nouvelle dépendance npm (ARCH-05)
- Modals `pageSheet` + drag-to-dismiss
- `expo-haptics` + `expo-secure-store`

---

## Gray Area Selection

**Question :** Quels gray areas tu veux discuter pour Phase 30 ?

Options proposées :
- Catalogue & sprites (les 8 décos)
- Placement sur la carte
- Schéma append-only + déclenchement
- Catalogue UI (VILL-06)

**User selected :** Catalogue & sprites / Placement sur la carte / Catalogue UI

*Note: "Schéma append-only + déclenchement" passé en Claude's Discretion — le pattern `appendContribution` + trigger dans `useGarden` est le chemin évident sans ambiguïté utilisateur.*

---

## Zone 1 — Catalogue & sprites

### Q1.1 : Source des sprites pour les 8 décorations ?
- Réutiliser assets/items/ existants (balancoire, cabane, couronne, cristal, guirlandes, hamac, lanterne, nid)
- Générer via pixellab (nouveaux sprites)
- Mix : existants + générés

**User (Other) :** *"Et si on ne générait pas des décorations mais plutôt des nouveaux batiments comme une forge, un port, une café, un marché ?"*

→ **Scope pivot majeur** accepté : "décoration" → "bâtiment". Claude propose 8 bâtiments + mapping progressif narratif. Tous générés via pixellab (aucun sprite bâtiment dans `assets/items/`).

### Q1.2 : Les 8 décorations finales — quel ensemble ?
- 8 items existants (abandonné via Q1.1)
- Mix thématique 'aboutissement collectif'
- Je te laisse proposer 8 cohérents et progressifs

**User (Other) :** *"Lire ce que je propose dans sprite"* → l'utilisateur valide la liste proposée par Claude.

**Liste proposée et acceptée :**
1. Puits (1 palier)
2. Boulangerie (2e)
3. Marché (3e) — *ex. explicite user*
4. Café (4e) — *ex. explicite user*
5. Forge (5e) — *ex. explicite user*
6. Moulin (6e)
7. Port (7e) — *ex. explicite user*
8. Bibliothèque (8e)

### Q1.3 : Mapping palier → déco : logique de progression ?
- Progressif : petits → grands
- Ordre thématique narratif
- Ordre d'apparition libre

**User selected :** Ordre thématique narratif

### Q1.4 : Comportement si la famille rate une semaine ?
- Décos persistent, streak reset (Recommandé)
- Décos reset aussi
- Décos persistent, streak continue

**User selected :** Décos persistent, streak reset ✓

### Q1.5 : La liste des 8 bâtiments et le mapping palier te va ?
- Validé tel quel
- Modifier un ou plusieurs items
- Inverser certains paliers

**User (Other) :** *"Ok mais pas lié aux semaines. On peut le faire plutôt avec un total de feuilles dépensées dans la famille (facile à calculer)"*

→ **2e scope pivot majeur** : trigger palier-streak-hebdo → palier-feuilles-famille. Claude investigue le système `profile.coins/points` avant de reprendre.

### Q1.6 : Taille de génération cible ?
- 128×128 (Recommandé)
- 192×192
- 96×96

**User selected :** 128×128 ✓

### Q1.7 : Style prompt unifié ?
- Fantasy médiéval chaleureux (Recommandé)
- Studio Ghibli / Stardew Valley
- Contemporain stylisé

**User selected :** Fantasy médiéval chaleureux ✓

### Q1.8 : Métrique exacte pour déclencher les déblocages ?
- Feuilles gagnées lifetime (sum profile.points)
- Feuilles dépensées (sum points - coins)
- Feuilles actuelles (sum coins)

**User selected :** Feuilles gagnées lifetime ✓

### Q1.9 : Ordre de grandeur des 8 paliers ?
- Progression douce (100, 300, 700, 1500, 3000, 6000, 12000, 25000)
- Progression raide (500 à 400000)
- Claude propose au planning

**User selected :** Progression douce (100 → 25000) ✓

---

## Zone 2 — Placement sur la carte

### Q2.1 : Système de placement des 8 bâtiments ?
- 8 slots fixes dédiés dans VILLAGE_GRID (Recommandé)
- Anchors par type / zone thématique
- Placement aléatoire déterministe (hash)

**User selected :** 8 slots fixes dédiés ✓

### Q2.2 : Zone de placement des bâtiments ?
- Périphérie (Recommandé)
- Couronne autour de la fontaine
- Ligne haute (skyline)

**User selected :** Périphérie ✓

### Q2.3 : Gestion des overlaps quand tous débloqués ?
- Slots pré-calculés non-collidants (Recommandé)
- Z-index layering avec léger overlap
- Réduire la taille à 48-56px

**User selected :** Slots pré-calculés non-collidants ✓

### Q2.4 : Tap sur bâtiment = comportement ?
- Tooltip nom + description
- Ouvre le catalogue
- Aucune interaction

**User selected :** Tooltip nom + description ✓

---

## Zone 3 — Catalogue UI (VILL-06)

### Q3.1 : Forme du catalogue ?
- Modal plein écran depuis village (Recommandé)
- Route dédiée /(tabs)/village/constructions
- Bottom sheet

**User selected :** Modal plein écran pageSheet ✓

### Q3.2 : Layout de la liste des 8 bâtiments ?
- Grille 2 colonnes (Recommandé)
- Liste verticale pleine largeur
- Carrousel horizontal

**User selected :** Grille 2 colonnes ✓

### Q3.3 : État visuel des bâtiments verrouillés ?
- Silhouette sombre + palier visible (Recommandé)
- Point d'interrogation mystère
- Sprite visible mais opacity 0.3

**User selected :** Silhouette sombre + palier visible ✓

### Q3.4 : Feedback quand un bâtiment vient de se débloquer ?
- Animation entrée + badge 'Nouveau' (Recommandé)
- Toast popup in-village
- Rien (découverte organique)

**User selected :** Animation entrée + badge 'Nouveau' ✓

---

## Done

**Question :** Autres gray areas à explorer, ou je crée le CONTEXT.md ?

**User selected :** Je suis prêt — crée le CONTEXT.md ✓

---

## Summary of decisions

| # | Décision | Choix |
|---|----------|-------|
| Scope | décoration → bâtiment | 8 bâtiments |
| Scope | streak hebdo → feuilles lifetime famille | sum(profile.points) |
| Sprites | Source | Pixellab générés 128×128 |
| Sprites | Style | cozy medieval fantasy |
| Liste | 8 bâtiments | Puits/Boulangerie/Marché/Café/Forge/Moulin/Port/Bibliothèque |
| Paliers | Ordre grandeur | 100→300→700→1500→3000→6000→12000→25000 feuilles |
| Comportement | Streak rupture | Décos persistent, métrique monotone donc non-applicable |
| Placement | Système | 8 slots fixes VILLAGE_GRID role 'building' |
| Placement | Zone | Périphérie carte |
| Placement | Overlaps | Pré-calculés non-collidants (calibration au plan) |
| Placement | Tap | Tooltip nom + palier |
| UI | Forme | Modal pageSheet depuis header village |
| UI | Layout | Grille 2 colonnes |
| UI | Verrouillés | Silhouette sombre + palier visible |
| UI | Feedback unlock | Badge "Nouveau ✨" + anim entrée |

---

*Log generated: 2026-04-11 via /gsd:discuss-phase 30*
