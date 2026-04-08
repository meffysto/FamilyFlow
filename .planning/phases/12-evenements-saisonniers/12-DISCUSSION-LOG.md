# Phase 13: Événements Saisonniers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 13-evenements-saisonniers
**Areas discussed:** Pattern d'interaction, Déclenchement, Récompenses, Contenu

---

## Pattern d'interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Sagas-like (visiteur + dialogue) | Réutiliser le pattern Phase 11 — personnage pixel, tap, dialogue interactif | ✓ |
| Quêtes compteur | Objectifs "plante 5 cultures", "complète 3 tâches" — pas de narration | |
| Bandeau + quêtes dashboard | UI dédiée dans le dashboard avec progression | |

**User's choice:** Sagas-like — "comme une saga, sans le texte dans le dashboard, juste on arrive sur la ferme et boom"
**Notes:** L'utilisateur veut exactement le même flow que les sagas immersives mais déclenché par le calendrier. Pas de UI dashboard du tout.

---

## Déclenchement et cycle de vie

| Option | Description | Selected |
|--------|-------------|----------|
| Calendrier auto (SEASONAL_EVENTS) | Utiliser les 8 événements déjà définis avec leurs dates | ✓ |
| Événements manuels | Créer/déclencher des événements depuis les paramètres | |

**User's choice:** Calendrier automatique — s'appuie sur l'infrastructure existante
**Notes:** Pas besoin de redéfinir les dates — tout est déjà dans seasonal-rewards.ts

---

## Récompenses

| Option | Description | Selected |
|--------|-------------|----------|
| Récompense garantie du pool saisonnier | Compléter le dialogue = drop certain (pas 20% aléatoire) | ✓ |
| Points événement + boutique temporaire | Accumuler des points pour acheter dans une boutique | |
| Taux loot box renforcé | Augmenter le % de drop saisonnier pendant l'événement | |

**User's choice:** Récompense garantie — "même genre de récompense" que les loot boxes saisonnières
**Notes:** Les choix dans le dialogue influencent la rareté, comme les traits des sagas influencent le finale

---

## Sprites

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholders d'abord, PixelLab après | Code complet avec sprites temporaires, génération PixelLab ultérieure | ✓ |
| Sprites PixelLab intégrés dans la phase | Générer tous les sprites dans cette phase | |

**User's choice:** Placeholders — "les sprites adaptés mais cela peut être fait après"

---

## Claude's Discretion

- Organisation des fichiers engine (nouveau fichier events-engine.ts vs extension seasonal.ts)
- Position du visiteur événementiel dans la scène (éviter collision avec saga)
- Mécanisme de fallback sprite

## Deferred Ideas

None
