# Phase 39 : Moteur prorata + calcul famille — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-18
**Phase:** 39-moteur-prorata-calcul-famille
**Areas discussed:** Snapshot persistence, Age brackets, Override mechanism, Edge cases, Catchup recompute, Snapshot trigger

---

## 1. Persistance du snapshot matinal

**User's choice:** "fais ce qui semble cohérent"
**Claude decision:** Append-only dans `jardin-familial.md` section `## Snapshots`, réutilise pattern Phase 25/30. Rétention 14 jours.

## 2. Brackets d'âge

**User's choice:** Bébé 0-2, Jeune enfant 3-5, Enfant 6-12, Ado 13-17, Adulte 18+
**Captured verbatim :** "2 3_6 enfant 6 12 ado 13 - 17 adulte 18 plus"
**Interpretation:** bornes inclusives basses, dérivation via `differenceInYears`.

## 3. Override poids settings profil

**User's choice:** "fais le plus logique"
**Claude decision:** Dropdown 5 presets (catégorie, pas poids numérique), champ vault `weight_override`. Évite valeurs absurdes.

## 4. Edge cases

**User's choice:** "fais le plus logique"
**Claude decision:**
- Divide-by-zero → `cumulTarget = Tasks_pending` (sealeur seul)
- Bébé (poids 0) ne peut pas sceller
- Tasks_pending = 0 → pari auto-gagné
- Pas de birthDate → adulte par défaut

## 5. Catchup recompute

**User's choice:** "fais le plus logique"
**Claude decision:** Un seul recompute au boot, zéro replay jour par jour, état courant fait foi.

## 6. Snapshot trigger

**User's choice:** "pareil"
**Claude decision:** Fenêtre ≥ 23h30 local + `lastRecomputeDate !== today`, `maybeRecompute` au boot gère le fallback.

## Claude's Discretion

- Nom module + structure fichiers
- Signatures types internes (FamilySnapshot, WagerComputeResult)
- Stratégie mock Jest (préférence : injection `now`)
- Structure suite Jest (monofichier ou éclaté)

## Deferred Ideas

- UI dropdown override poids (Phase 40/41 polish)
- Debug menu snapshot viewer
- Réconciliation vault édité manuellement
- Métriques long-terme prorata historique
