---
phase: 40
phase_name: UI Sporée — seed picker + badge + validation
created: 2026-04-18
requirements: [MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11]
---

# Phase 40 — Contexte de discussion

## Scope verrouillé (ROADMAP)

Rendre la Sporée utilisable bout-en-bout via l'UI : slot "Sceller" inline dans le flow de plantation, choix des 3 durées avec multipliers visibles, badge de progression sur plant scellé, état visuel "prêt à valider", validation à la récolte (reward × multiplier ou fallback).

**Requirements** : MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11
**Dépend de** : Phase 39 (moteur `wager-engine.ts` + primitives data stables — UI pure consommation)

## Décisions implémentation (discussion user)

### 1. Placement du slot "Sceller" — après sélection de la graine
**Décision** : Le slot "Sceller" n'apparaît **PAS** dans la liste du seed picker lui-même. Il apparaît **après** que l'utilisateur ait choisi une graine, dans une étape intermédiaire avant confirmation de plantation, **uniquement si ≥1 Sporée en inventaire**.

**Flow** :
1. User ouvre seed picker → choisit graine (liste inchangée)
2. Si 0 Sporée en stock → plantation directe (comportement actuel)
3. Si ≥1 Sporée en stock → écran/sheet intermédiaire "Sceller cette plantation ?" proposant les 3 durées + skip

**Implication pour researcher/planner** : pas de refonte de la liste seed picker existante (`app/(tabs)/tree.tsx:1752-…`), mais ajout d'une étape après `handleSeedSelect`. Chercher le meilleur pattern (modal secondaire, action sheet, sheet intermédiaire) cohérent avec le design de pageSheet existant.

### 2. 3 durées toujours proposées, durées dérivées de la taille du plant
**Décision (option A confirmée)** : Les 3 modes **Chill ×1.3 / Engagé ×1.7 / Sprint ×2.5** sont toujours offerts à l'utilisateur. Ce qui varie selon la taille du plant (`tasksPerStage × 4`) c'est la **durée en temps/tâches** de chaque mode.

**Principe** : plus le plant est gros (long à mûrir), plus les durées absolues s'allongent mais les multipliers restent identiques. User choisit son profil de risque/récompense parmi les 3.

**À déterminer en research** : le mapping exact (durée = f(taille_plant, mode)). Piste : `Chill = durée_normale`, `Engagé = durée_normale × 0.7`, `Sprint = durée_normale × 0.5` — mais à valider contre `wager-engine.ts` (concept "résolution poids/prorata") et lisibilité gameplay.

### 3. Badge pace sur plant scellé — Claude's Discretion
**Décision** : user fait confiance au designer. Contraintes respectées :
- Affichage `X/Y tâches aujourd'hui • cumul Z/N`
- Code couleur pace (vert/jaune/orange) — seuils à définir proprement (proposition : ≥100% vert / 70-99% jaune / <70% orange)
- **Pas d'animation continue lourde** (pas de pulse/rotation permanente)
- Placement cohérent avec plant sprite existant, lisible sans zoom

**Implication** : planner décide position exacte, typographie, gabarit. Privilégier réutilisation composants `components/ui/` (Badge probablement).

### 4. Anneau "prêt à valider" — effet visuel minimal
**Décision** : halo/anneau vert **statique** (ou animation très discrète, ex: opacity breathing très lent type `withRepeat(withTiming(opacity 0.7→1, 2s))`). Affiché uniquement quand **plant mûr ET cumul atteint** (double condition — distingue clairement la fenêtre de décision).

**Refusé** : pulse rapide, halo rotatif, rainbow, effets chargés.

### 5. Toast victoire — adapté à l'UI actuelle + drop-back inline
**Décision** : utiliser le **`ToastContext` existant** du projet. Le drop-back 15% Sporée, s'il se déclenche, est mentionné **inline dans le toast de victoire** (pas de notification séparée) — ex: `"Victoire ! +30 🍃 (×2.5) · Sporée retrouvée 🎁"`.

**Si pas de drop-back** : toast standard `"Victoire ! +30 🍃 (×2.5)"`.
**Si défaite** (cumul non atteint) : reward normale + toast neutre/bienveillant `"Plant récolté · Sporée consommée"` (jamais de message punitif — pari bienveillant).

**Pattern de ref** : regarder `contexts/ToastContext.tsx` + usages existants dans `hooks/useFarm.ts` (post-harvest).

### 6. Preview prorata théorique — texte simple utile
**Décision** : format texte compact affichant les infos décisionnelles :
```
Sprint ×2.5 · 24h · ~3 tâches/jour requis
```
ou équivalent. Pas de graphique. Pas de "fake math" pédagogique. Juste : **multiplier, durée, cumul cible prorata** (consommé depuis `wager-engine.computeWagerTarget()`).

## Hors scope — différé

| Idée | Notes |
|------|-------|
| Onboarding tooltip premier drop Sporée | **Phase 41** — SPOR-10 |
| Compteur codex `wager.marathonWins` | **Phase 41** — SPOR-12 |
| Animation spectaculaire victoire (overlay plein écran) | Phase 41 / future polish |
| Stats historique Sporées (nb gagnés/perdus) | Backlog |
| Sporées cumulables (plusieurs sur un même plant) | Backlog — scope exclu, 1 Sporée/plant |

## Gotchas identifiés pour le researcher

1. **Badge doit être perf-friendly** — plusieurs plants scellés simultanément possibles, pas de re-render global ni animation par-plant qui bouffe CPU.
2. **Seed picker existant est pageSheet** — l'étape intermédiaire doit être cohérente (nested modal OU remplacer le contenu du pageSheet OU action sheet par-dessus).
3. **Durées dérivées de la taille** — la formule DOIT s'aligner avec `wager-engine.computeWagerTarget()` existant Phase 39, pas réinventer un calcul UI-side.
4. **Drop-back 15%** — RNG à appeler côté hook (useFarm) lors de la récolte, pas dans le composant toast. UI est pure rendu.
5. **Anneau vert** — composant réutilisable (probablement overlay sur `PlantSprite` existant), pas inline dans chaque écran.

## Artefacts en aval (guidance researcher / planner)

- **Researcher** investigue :
  - Pattern intermédiaire après seed select (nested modal vs remplacement contenu pageSheet vs action sheet)
  - Positionnement badge sur plant sprite sans conflit layout ferme
  - Mapping durées × taille plant aligné avec `wager-engine`
  - API ToastContext + format toast cohérent victoire/défaite/drop-back
  - Reanimated pour anneau breathing très subtil si applicable

- **Planner** découpe probablement en 3-4 plans :
  - Data/hook : extension `useFarm` (startWager, validateWager, dropBack RNG)
  - UI Sceller flow : sheet intermédiaire + choix 3 durées + preview prorata
  - UI badge + anneau prêt-à-valider sur plant
  - Récolte + toast victoire/défaite/drop-back

## Next

```
/gsd:plan-phase 40         # Recherche auto + planification des plans
```
