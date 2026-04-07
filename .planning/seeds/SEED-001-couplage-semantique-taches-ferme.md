---
id: SEED-001
status: dormant
planted: 2026-04-07
planted_during: v1.2 Phase 15 (Confort & Découverte)
trigger_when: "quand on démarre un milestone qui touche à la ferme, aux tâches ou à la gamification — typiquement v1.3 ou ultérieur orienté engagement/narratif"
scope: large
---

# SEED-001: Couplage sémantique tâche réelle → effet ferme

## Why This Matters

Aujourd'hui **toutes les tâches sont fongibles en XP générique**. Une séance de sport,
les courses, les devoirs, vider le lave-vaisselle → même +10 points, même impact nul
sur la ferme au-delà du compteur. La ferme ne "sait pas" ce que la famille a vraiment fait.

C'est le gap signature de l'app : elle prétend être un miroir de la vie familiale, mais
le miroir est indifférencié. Introduire un couplage sémantique entre catégorie de
tâche réelle et effet ferme transformerait la ferme en **reflet différencié** du quotidien.

Exemple de boucle narrative fermée :
- Tu coches "ménage salon" → tag `#menage` détecté → retire 1 weeds event gratuit dans la ferme
- Tu coches "courses" → +1 ingrédient pantry (craft moins cher)
- Tu coches "devoirs enfants" → boost tech Culture (−1 task/stade) pendant 24h
- Tu coches "sport/marche" → compagnon se déplace, +5% XP

## When to Surface

**Trigger:** quand on démarre un milestone qui touche à la ferme, aux tâches ou
à la gamification — typiquement v1.3 ou ultérieur orienté engagement/narratif.

Ne pas surfacer pour des milestones purement infra (perf, stabilité, accessibilité)
ni pour des milestones orientés confort hors gamification (comme v1.2 actuel).

## Scope Estimate

**Large** — découpable en 2 phases :

- **Phase A (petite)** : moteur pur `deriveTaskCategory(task, filePath, tags)` +
  table de mapping hardcodée (5-6 patterns safe) + hook dans `awardTaskCompletion`.
  Zéro UI. Behavior-gated par un flag pour désactivation rapide.
- **Phase B (moyenne)** : UI de config famille + extension du mapping + toasts
  compagnon dédiés + tests anti-abus + cap journalier/hebdo par effet.

## Découverte clé

**Il n'y a AUCUN champ `type` ou `category` explicit sur les tâches.** Le modèle
est organique :
- Tâches dans des fichiers markdown distribués (ex: `02 - Maison/Tâches récurrentes.md`)
- Regroupées par section H2/H3 à l'intérieur du fichier
- Tags `#tag` parsés depuis le texte via regex
- Mentions `@user` parsées aussi

**C'est une très bonne nouvelle** : la taxonomie existe déjà, créée organiquement
par la famille dans Obsidian. On n'a rien à imposer. Il suffit de la lire via :
1. Chemin du fichier source
2. Section H2/H3
3. Tags existants

Aucune écriture dans les fichiers tâches (Obsidian-respect). Pure lecture.

## Contraintes de design

- **Bornes anti-abus** : chaque effet cappé par jour/semaine pour empêcher
  le farming de tâches bidons
- **Effet jamais négatif** : catégorie inconnue → fallback XP standard,
  aucune régression
- **Visibilité** : toast ou message compagnon à la complétion quand un effet
  est déclenché (event `task_completed` existant peut transporter un sous-type)
- **Configurable par la famille** : écran paramètres montrant
  `fichier X → effet Y` avec désactivation/override possible
- **Pas d'explosion** : garder ≤10 catégories mappées, sinon c'est déjà trop

## Breadcrumbs

Références code à la date de plantation :

- `lib/types.ts:8-24` — interface `Task` (pas de champ category, seulement
  id/text/tags/mentions/section/secret)
- `lib/parser.ts:81-121` — `parseTask()` extrait tags/mentions via regex
- `lib/parser.ts:124-139` — `parseTaskFile()` détecte sections H2/H3
- `lib/gamification/engine.ts:105-128` — `awardTaskCompletion()` : point
  d'injection principal du couplage
- `lib/gamification/engine.ts:111` — tous types = 10 pts base, pas de
  pondération par type
- `hooks/useVaultTasks.ts:57-72` — toggle tâche, appelle gamification
- `hooks/useVaultTasks.ts:106-109` — labels de filtrage implicites
  (Quotidien, Hebdomadaire, Mensuel, Ménage)
- `lib/mascot/wear-engine.ts` — cible des effets "réparation gratuite"
- `lib/mascot/farm-engine.ts` — cible des effets "boost croissance"
- `lib/mascot/companion-engine.ts:114-223` — templates pour messages
  d'effet à la complétion
- `lib/mascot/companion-types.ts:14-43` — event `task_completed`
  disponible pour transporter un sous-type

## Notes

Idée issue d'une analyse approfondie menée pendant v1.2 après observation que
toutes les propositions d'amélioration ferme "génériques" (streaks, widgets,
saisons) étaient déjà implémentées en v1.1. Le seul gap structurel restant
est l'absence de lien entre action réelle et effet virtuel.

Articulation possible avec SEED-002 (musée) et SEED-003 (compagnon étendu) :
chaque effet déclenché par le couplage peut enregistrer un milestone musée
et générer un message compagnon narratif. Boucle narrative fermée.

Inspiration : Habitica (tâches → nourriture → pets), Finch (self-care
→ trips narratives), Forest (couplage réel↔virtuel fort).
