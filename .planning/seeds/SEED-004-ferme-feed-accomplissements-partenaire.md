---
id: SEED-004
status: dormant
planted: 2026-05-13
planted_during: post-v1.2 (ferme stabilisée — 8 derniers commits dominés par ferme)
trigger_when: "prochaine itération ferme, OU dès que tu sens un re-engagement à pousser sur le loop daily, OU quand tu veux densifier la dimension couple dans l'app"
scope: small-medium
---

# SEED-004: Feed accomplissements partenaire dans la ferme

## Why This Matters

L'exploration du 2026-05-13 a identifié **un seul gap social spontané**
dans l'usage réel : tu vas à ta ferme régulièrement (c'est ton dopamine
reward quotidien), mais tu **ne vois pas ce que ton/ta conjoint·e a fait
dans la sienne**. Les autres domaines partagés (tâches, gratitude, humeur)
ont déjà une visibilité cross-utilisateur ambient. La ferme, non.

Résultat : la ferme est un **single-player game** dans une app qui se
positionne comme couple/famille. Tu pourrais aller voir sa ferme,
mais c'est une destination séparée à atteindre activement — donc
tu ne le fais pas.

**Levier énorme** : c'est le seul écart que tu nommes spontanément,
ET il touche l'écran le plus addictif du loop daily, ET la solution
est probablement petite en code.

## What It Could Look Like

Plusieurs mécanismes possibles, à arbitrer via sketch :

### A. Bandeau ambient en haut de la ferme
"Marie a récolté 12 tomates · planté Étoile du Berger · niveau 14"
→ passif, toujours visible, ne casse pas le flow

### B. Modal "depuis ta dernière visite"
À l'ouverture de la ferme : 1 écran qui résume les accomplissements
du partenaire depuis ton dernier passage → moment de "présence" fort

### C. Avatar partenaire avec bulles d'activité
Petit avatar dans un coin de la ferme, qui flotte avec une bulle
"vient de récolter !" en temps quasi-réel → présence vivante

### D. Mini-feed dans le picker / écran secondaire
Une section "Activité de Marie" dans le picker ferme ou stats →
visible mais non intrusive

### E. Notif push externe
"Marie vient d'éclore un dragon de feu" → tap = saute dans sa ferme
→ crée des micro-moments mais peut spammer

## Events à considérer

Tous ces événements pourraient déclencher un signal partenaire :
- Récolte (seuil : >5 items ou plus, ou récolte rare)
- Plantation (graine épique surtout)
- Niveau franchi
- Recette épique débloquée
- Animal/dragon éclos
- Badge / accomplissement spécial
- Streak quotidienne franchie

Pas tout afficher — choisir ce qui mérite "présence".

## When to Surface

**Trigger explicites** :
- Prochaine itération significative de la ferme
- Si tu sens un retour à pousser sur le loop daily ou la dimension couple
- Si ton/ta conjoint·e exprime que la ferme manque de "vie sociale"

**Anti-trigger** :
- Ne PAS faire si la ferme est en mode maintenance / pas le sujet du moment
- Ne PAS étendre à TOUS les domaines en même temps (over-engineering)
- Ne PAS construire une infra "activity feed" généralisée juste pour ça

## Coût estimé

- Détection événements : déjà loggés dans la gamification
- Visibilité cross-vault : le vault est déjà partagé via iCloud, donc
  le système peut lire la ferme du partenaire
- UI : 1 composant nouveau (le mécanisme retenu) + 1 hook qui agrège
  les events de la ferme du partenaire
- Estimation : **1 phase courte** (1-3 jours), pas un milestone

## Liens

- Exploration : `.planning/notes/2026-05-13-usage-reel-vs-app-construite.md`
- Cross-feature potentiel : SEED-002 (musée mémoire) — si on construit
  un activity log durable, le musée peut s'y brancher

## Update 2026-05-13 — pivot après sketch

Après sketch 001 (ferme) puis pivot via sketch 002 (dashboard), la
direction retenue n'est PAS "présence partenaire dans la ferme" mais
**"partner pulse multi-domaines sur le dashboard"**, sous forme d'une
**strip fine sous le header date** (variante A′ du sketch 002).

Le seed reste valide en tant qu'écart de présence couple identifié,
mais sa résolution est *à l'échelle du dashboard, pas de la ferme*.

Cf. `.planning/sketches/002-dashboard-partner-pulse/` (winner A′).
