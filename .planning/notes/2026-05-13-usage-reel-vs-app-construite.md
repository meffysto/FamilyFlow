---
date: "2026-05-13"
promoted: false
tags: [strategy, usage, retrospective]
---

# Usage réel vs app construite — explore session 2026-05-13

## Ce que la session a révélé

L'app est marketée et construite comme un **vault familial** (recettes,
journal bébé, histoires enfants, anniversaires, profils enfants gamifiés,
photos, souvenirs, RDV, santé, etc. — ~30 domaines). Mais l'usage réel
quotidien (dev solo, sur 7 jours) tient en **3 actions tap-and-go** :

1. **Cocher des tâches** (entrée du loop, déclenchée par notif après
   action réelle accomplie)
2. **Valider gratitude + humeur** (rituel court)
3. **Récolter à la ferme** (dopamine reward de fin de loop)

Aucune création de contenu (pas de recette ajoutée, pas de souvenir écrit,
pas d'histoire générée, pas de PDF book exporté) dans une semaine type.

## Pattern : habit-loop classique

- **Cue** : notif task reminder
- **Routine** : cocher → valider gratitude/humeur
- **Reward** : ouverture ferme + récolte

Le levier d'amélioration le plus puissant est sur la qualité de ce
chemin (notifs, transitions task→gratitude→ferme, dopamine récolte),
pas sur les 27 autres écrans.

## Couple, pas famille

Deux adultes utilisent activement (toi + conjoint·e). Pas mentionné :
les enfants. L'app pose des profils enfants partout mais les enfants
ne sont pas les utilisateurs daily. **Couple-app avec contenu kid-themed**,
pas family-app collaborative.

## Présence partenaire : ambient, pas ressentie

- Tâches : pile commune, tu vois ce qui disparaît → présence ressentie
- Humeur/gratitude : visibles dans ton app mais ne créent pas de
  "présence" forte (signal ambient non surfacé)
- **Ferme : seul gap nommé spontanément** — tu vas à ta ferme,
  tu ne vois PAS les accomplissements de ton/ta conjoint·e

## Implications pour la roadmap

**Avant de proposer une nouvelle feature, se demander :**

1. Est-ce que ça touche le loop daily (tasks → gratitude → ferme) ?
   Si non, impact minime sur ton usage et probablement celui des
   autres utilisateurs adultes avec un loop similaire.

2. Est-ce que ça densifie un domaine déjà utilisé, ou ça ajoute un
   nouveau domaine au cimetière des écrans non-ouverts ?

3. Pour la dimension couple : améliorer la *visibilité* de l'activité
   partenaire dans les domaines déjà partagés (notamment ferme) avant
   d'inventer de nouveaux mécanismes coop.

## Anti-pattern à éviter

Investir du temps dans :
- Nouveaux domaines (vault déjà saturé, 27+ écrans dormants)
- Features kid-oriented si les enfants n'utilisent pas (audit honnête)
- Refactor de domaines inutilisés "pour la cohérence"
- Polish UI d'écrans secondaires que personne n'ouvre

## À relire avant chaque décision majeure de roadmap
