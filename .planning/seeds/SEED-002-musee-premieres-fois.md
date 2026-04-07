---
id: SEED-002
status: dormant
planted: 2026-04-07
planted_during: v1.2 Phase 15 (Confort & Découverte)
trigger_when: "quand on cherche à enrichir la mémoire long terme de l'app, densifier la ferme, ou ajouter du contenu narratif/historique — typiquement v1.3 ou milestone orienté engagement émotionnel"
scope: medium
---

# SEED-002: Musée des premières fois (mémoire durable)

## Why This Matters

La ferme v1.1 est mécaniquement riche mais **n'a aucune mémoire**. Tu peux être
niveau 25 avec des mois de jeu sans aucun souvenir tangible. L'historique
gamification est plafonné à 100 entrées rotatives, donc les plus vieux faits
marquants s'effacent au bout de quelques semaines.

Dans les jeux qui réussissent la "life gamification" et le cozy gaming
(Animal Crossing museum, Stardew collection journal, Spiritfarer souvenirs),
le musée est **le seul endroit où le joueur ressent "j'ai vécu quelque chose"**.
Il transforme la progression en histoire datée.

Le musée devient aussi un **hub cross-feature** : photos, anniversaires,
gratitude, défis peuvent tous y déposer des milestones. Unification narrative.

## When to Surface

**Trigger:** quand on cherche à enrichir la mémoire long terme de l'app,
densifier la ferme, ou ajouter du contenu narratif/historique — typiquement
v1.3 ou milestone orienté engagement émotionnel / rétention long terme.

Ne pas surfacer pour milestones orientés infra, tâches quotidiennes pures,
ou stabilité.

## Scope Estimate

**Medium** — 2 phases découplables :

- **Phase A** : moteur `recordMilestone()` + nouveau fichier vault
  `milestones-{profileId}.md` append-only + hooks dans les 6-8 points
  d'appel (harvest, craft, plant unique, upgrade building, tech unlock,
  rare seed drop, golden crop, repair wear).
- **Phase B** : écran musée (FlatList virtualisé comme codex phase 17)
  + filtres par catégorie/profil/famille + intégration avec SEED-003
  (compagnon commente les milestones via event existant `family_milestone`
  ou `celebration`).

## Découverte clé

**L'historique existant est inadéquat pour faire un musée rétroactif :**

- Format `GamificationEntry` trop pauvre : `action, points, note, timestamp`
- Plafonné à **100 entrées max** (rotatif) → les vieux first times sont
  effacés au bout de quelques semaines
- Ne trace que `task_completed` et `loot_opened` — pas harvest/craft/plant/
  building/tech
- Seul `SkillUnlock.unlockedAt` (types.ts:529-539) stocke un timestamp
  durable pour un achievement (c'est le seul modèle réutilisable)

**Conséquence** : le musée ne peut PAS être rétroactif pour les familles
existantes en v1.1. Il faut tracer à partir du jour où on le lance.
Acceptable : proposer une "carte d'inauguration" narrative ("Le musée
ouvre ses portes le X") plutôt qu'un rattrapage hasardeux.

## Design du fichier

Nouveau fichier vault par profil, **append-only, jamais tronqué** :

```yaml
---
profileId: papa
milestones:
  - id: first_harvest_carotte
    category: first
    label: "Première carotte récoltée"
    date: 2026-04-07T10:30:00Z
    context: "plot 3, golden: false"
  - id: first_craft_pain_epices
    category: first
    label: "Premier pain d'épices"
    date: 2026-04-12T18:22:00Z
  - id: first_golden_mutation
    category: special
    label: "Première mutation dorée (tomate)"
    date: 2026-04-09T14:12:00Z
  - id: record_day_harvest
    category: record
    label: "Record: 14 récoltes en un jour"
    date: 2026-04-15T23:58:00Z
    value: 14
---
```

**Catégories** :
- `first` : première fois par crop, recipe, building, tech, rare_seed,
  golden, wear repair, companion species
- `record` : meilleurs jour/semaine/mois (harvests, crafts, XP, streak)
- `family` : anniversaires fêtés, photo ajoutée, gratitude record,
  événements saisonniers complétés

## Contraintes de design

- **Liste curée** : ne pas logger des "first" triviaux (première ouverture
  d'écran, premier scroll). Liste fermée, explicite, ≤20 types de milestones.
- **isFirstTime() rapide** : lecture en mémoire au mount, pas de scan
  linéaire à chaque action
- **Records agrégés** : le calcul de "meilleur jour" tourne à l'ouverture
  de l'app, pas à chaque complétion (perf)
- **Per-profile ET famille** : affichage filtrable par membre OU
  agrégé famille
- **Jamais punition** : aucun milestone "négatif" (pas de "tu as raté 5
  streaks"). Que du positif.

## Breadcrumbs

- `lib/types.ts:175-181` — `GamificationEntry` actuel (format pauvre)
- `lib/types.ts:529-539` — `SkillUnlock.unlockedAt` (seul modèle daté
  persistant à imiter)
- `lib/parser.ts:794-806` — parsing history gamification
- `lib/parser.ts:873` — cap 100 entrées (cause du problème)
- `lib/parser.ts` (parseFarmProfile, serializeFarmProfile) — pattern
  à suivre pour nouveau fichier `milestones-{id}.md`
- `lib/mascot/badges.ts` — badges existants (seuils sans dates, pas
  équivalent au musée)
- `lib/mascot/farm-engine.ts` (harvestCrop, plantCrop) — call sites
  à instrumenter
- `lib/mascot/craft-engine.ts` — call site pour first craft
- `lib/mascot/tech-engine.ts` — call site pour first tech unlock
- `lib/mascot/wear-engine.ts` — call site pour first repair
- `lib/mascot/companion-types.ts:14-43` — events `celebration`,
  `family_milestone` disponibles pour commenter les milestones
- `constants/` — nouveau `constants/milestoneCatalog.ts` à créer avec
  la liste curée des milestones possibles

## Notes

Idée complémentaire de SEED-001 (couplage sémantique) et SEED-003
(compagnon étendu). Les trois forment une boucle narrative :

1. Tâche réelle → effet ferme (SEED-001)
2. Effet ferme notable → milestone musée (SEED-002)
3. Milestone enregistré → message compagnon archivé (SEED-003)

Le musée est aussi le **complément naturel du codex v1.2** : le codex
explique QUOI existe, le musée raconte CE QUE TU AS VÉCU avec.

Inspirations : Animal Crossing museum (Blathers), Stardew collection
tab, Pokémon Pokédex avec dates de capture, scrapbook familial.
