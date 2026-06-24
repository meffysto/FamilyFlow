---
sketch: 002
name: dashboard-partner-pulse
question: "Quel pattern pour surfacer le pulse du/de la partenaire (multi-domaines) sur le dashboard Aujourd'hui ?"
winner: "A′ (strip)"
tags: [dashboard, social, presence, couple]
related: [001-ferme-presence-partenaire, SEED-004]
---

# Sketch 002 — Dashboard · Partner Pulse

## Pivot

Après réflexion plus profonde, sketch 001 sketchait au mauvais endroit :
la ferme est ton dopamine reward space personnel, pas l'écran de
"présence famille". L'écran qui sert cette fonction est le dashboard
**Aujourd'hui** — celui que tu ouvres en premier dans le loop daily.

Ce sketch explore donc une variante **D élargie** : surface le pulse
partenaire *multi-domaines* (humeur, tâches, ferme, gratitude) sur le
dashboard plutôt que de polluer la ferme.

## Design Question

Quel pattern donne la meilleure "présence partenaire" sur le dashboard
sans pousser le contenu existant dans l'oubli ?

## How to View

```
open .planning/sketches/002-dashboard-partner-pulse/index.html
```

Fond : screenshot réel du dashboard FamilyFlow (`docs/dashboard.png`).
Les variantes se superposent ou remplacent des zones spécifiques.

## Variants

- **A — Carte dédiée "Marie aujourd'hui"** — une seule nouvelle card,
  juste sous le header date, qui agrège 3-4 lignes (humeur, tâches,
  ferme highlight, gratitude). Lit comme les autres cards existantes.

- **B — Pulse rail (avatars)** — rangée horizontale en haut du dashboard
  avec un avatar par membre famille (toi/Marie/enfants), humeur emoji +
  chips condensés sous chaque avatar, pip rouge si nouveauté. People-first.

- **C — Inline dans les sections existantes** — pas de nouveau composant.
  La section Humeur affiche les 2 humeurs côte à côte, Tâches est split
  toi/Marie, Ferme inclut un highlight Marie. Ambient, invisible.

## What to Look For

1. **Quelle hiérarchie ?** A et B mettent le partenaire en haut.
   C garde les sections existantes en tête, partenaire intégré dans
   chacune.

2. **People-first vs domain-first :** B s'ouvre sur les gens, A et C
   s'ouvrent sur les domaines.

3. **Scale famille :** B montre 4 cellules d'avatars. A n'inclut que
   Marie (faut une carte par membre). C montre tout par domaine, pas
   d'unité personne.

4. **Vide/inactif :** que se passe-t-il si Marie n'a rien fait
   aujourd'hui ?
   - A : la carte se vide / se masque
   - B : son avatar est là mais éteint (humeur absente, chips vides)
   - C : ses lignes sont absentes dans chaque section

5. **Émotionnel vs utilitaire :** B a le plus de "présence" (visages),
   A a le plus de "récap", C a le plus de "data".

## Coût d'implémentation

- A : bas (1 composant + 1 hook agrégateur)
- B : moyen (rail + cellules + nav, plus de design surface)
- C : moyen-haut (touche 4-5 composants existants, plus de risque
  régression mais zéro nouveau pattern)

## Related

- Sketch 001 (ferme version, abandonné après pivot)
- Seed SEED-004
- Note stratégique : `.planning/notes/2026-05-13-usage-reel-vs-app-construite.md`
