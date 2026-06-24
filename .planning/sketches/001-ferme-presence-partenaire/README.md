---
sketch: 001
name: ferme-presence-partenaire
question: "Quel mécanisme surfacer les accomplissements ferme du partenaire dans MA ferme — sans casser le flow ni spammer ?"
winner: null
tags: [farm, social, ambient, couple]
related_seed: SEED-004
---

# Sketch 001 — Ferme · Présence Partenaire

## Design Question

Tu vas régulièrement à TA ferme. Tu rates les accomplissements (récolte,
plantation épique, niveau, animal éclos) de TON/TA conjoint·e qui joue
aussi de son côté. Comment surfacer ces highlights dans ton flow ferme,
sans :
- Forcer une visite séparée à sa ferme
- Spam notification
- Encombrer l'UI ferme déjà dense

## How to View

```
open .planning/sketches/001-ferme-presence-partenaire/index.html
```

Switch entre les 3 variantes via les tabs en haut, ou via le mini-toolbar
en bas à droite.

## Variants

- **A — Bandeau ambient** — bandeau passif en haut de la ferme, ticker
  qui cycle entre les 2-3 derniers événements partenaire. Présence
  permanente, basse friction.

- **B — Modal "depuis ta dernière visite"** — au lancement (si seuil
  d'absence dépassé), modale récap récap+CTA "Voir sa ferme". Moment
  émotionnel fort, friction maîtrisée à 1× par session.

- **C — Avatar in-scene + bulles** — avatar pixel-art du partenaire qui
  flotte DANS la ferme avec speech bubbles sur ses actions, markers
  cerclés autour de ses parcelles. Présence ludique cozy-game.

## What to Look For

1. **Quel niveau de friction te convient ?** Variant A = zéro friction
   (passif), B = 1 friction maîtrisée (modale), C = aucune friction mais
   présence permanente plus encombrante.

2. **Quel niveau d'émotion ?** Variant C est le plus chargé émotionnellement
   (Marie *est* dans ta ferme), A le plus utilitaire, B est l'événement
   "moment de présence".

3. **Tenue dans le temps** : si Marie devient inactive 3 jours, lequel
   gère mieux le vide ?
   - A : bandeau disparaît ou affiche "Marie n'a pas joué" → triste
   - B : pas de modale → invisible / silencieux
   - C : avatar fantôme / absent ? À résoudre

4. **Compatibilité ferme actuelle** : la ferme est déjà dense (parcelles,
   animaux, arbre central, stats). Lequel s'intègre le mieux sans casser
   la composition ?

5. **Coût d'implémentation** :
   - A = bas (1 composant + 1 hook)
   - B = moyen (modal + last-visited + threshold logic)
   - C = haut (avatar animé + bubbles + positioning + states)

## Synthèse possible

Aucune des 3 n'a à être choisie pure — possibilité :
- A en mode "toujours là" pour les events mineurs (récoltes, plantations
  ordinaires)
- B au boot pour les events épiques (graine épique, niveau, animal éclos)
  uniquement, avec seuil d'absence
- C abandonné OU réservé à un moment spécial (visite réelle de sa ferme)

## Related

- Seed source : `.planning/seeds/SEED-004-ferme-feed-accomplissements-partenaire.md`
- Stratégie : `.planning/notes/2026-05-13-usage-reel-vs-app-construite.md`
