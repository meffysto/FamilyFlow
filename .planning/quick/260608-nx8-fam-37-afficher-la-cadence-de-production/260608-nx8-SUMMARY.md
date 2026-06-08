---
quick_id: 260608-nx8
status: complete
date: 2026-06-08
commit: 374fdbf0
---

# Quick Task 260608-nx8 — FAM-37 Cadence de production toujours visible

## Objectif

Afficher la cadence de production des bâtiments de la ferme de façon toujours
visible. Avant ce correctif, le temps de production (« 1 miel toutes les 12h »)
n'apparaissait que comme texte barré (`fromText`) dans la section « NIVEAU
SUIVANT », elle-même affichée uniquement quand `upgradable && nextTier`. À
niveau MAX, cette section est remplacée par `maxCard` qui n'affiche aucune
cadence — une ruche niveau max ne donnait donc aucun moyen de connaître son
temps de production (issue Linear FAM-37).

## Ce qui a été fait

Fichier modifié : `components/mascot/BuildingDetailSheet.tsx`

1. **Ligne cadence dans la hero card** — Ajout d'un bloc
   `<View style={styles.cadenceRow}>` à l'intérieur du bloc `isProductive` de la
   hero card, après la fermeture du `View` `progressMeta` et avant la fermeture
   de l'`Animated.View`. Rendu **inconditionnel** (aucun garde `isFull` ni
   `upgradable`), donc visible à tous les niveaux et quel que soit l'état du
   stockage. Affiche `labels.cycleLabel` à gauche (ex. « 1 miel toutes les ») et
   `formatHours(currentCycleHours / wearMul)` en gras à droite.

2. **Taux normal hors pénalité de dégât** — Utilise `currentCycleHours / wearMul`
   (cohérent avec la ligne d'upgrade existante, ligne 506), de sorte que la
   cadence affichée est le taux normal ; la pénalité de toit endommagé reste
   expliquée par sa propre bannière.

3. **Style `cadenceRow`** — Ajouté dans `makeStyles` après `progressMetaRightBold` :
   `flexDirection: 'row'`, `justifyContent: 'space-between'`, `Spacing.md` pour
   marge/padding, et un séparateur supérieur `borderTopColor: farm.woodHighlight`.
   Aucune valeur ni couleur en dur — l'unique ajout dans la factory couvre les
   thèmes `stylesLight` et `stylesDark`.

## Vérification

- `npx tsc --noEmit` : zéro nouvelle erreur sur `BuildingDetailSheet.tsx`.
- Bâtiments productifs (poulailler, vacherie, ruche, moulin) : la cadence
  s'affiche à chaque niveau, y compris niveau MAX et stockage plein.
- Auberge / bâtiments non productifs : hors périmètre (pas de cadence).

## Commit

- `374fdbf0` — feat(quick-260608-nx8): FAM-37 — cadence de production toujours visible dans la hero card
