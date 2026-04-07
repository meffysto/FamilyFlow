---
id: SEED-003
status: dormant
planted: 2026-04-07
planted_during: v1.2 Phase 15 (Confort & Découverte)
trigger_when: "quand on veut densifier le compagnon, améliorer la rétention hebdomadaire, ou ressusciter des événements compagnon dormants — typiquement v1.3 ou milestone orienté engagement/narratif"
scope: medium
---

# SEED-003: Compagnon étendu — journal, events élargis, weekly recap narratif

## Why This Matters

Le compagnon a un moteur **très riche sur le papier** mais **confiné en pratique** :

- **27 types d'événements définis** dans `companion-types.ts:14-43`
- Templates i18n complets pour tous ces events
- IA branchée et fonctionnelle (`generateCompanionAIMessage` appelée dans
  tree.tsx lignes 631, 692, 774)
- Cache intelligent + budget quotidien 15 appels IA opérationnels

**MAIS** :
- Appelé **uniquement dans `app/(tabs)/tree.tsx`** (3 points)
- Les 27 events incluent `gratitude_written`, `photo_added`, `meal_planned`,
  `routine_completed`, `budget_alert`, `defi_completed`, `family_milestone`,
  `weekly_recap`, `morning_greeting`, `gentle_nudge`, `comeback` —
  **jamais déclenchés nulle part**
- **Messages non persistés** : RAM uniquement (`companionRecentMessagesRef`
  détruit au unmount)
- **Weekly recap existe** côté data (`lib/weekly-recap.ts`) + notification
  dimanche 20h déjà programmée, **mais sans le compagnon dedans**
- **Aucune notification push signée compagnon**

Le compagnon est éloquent sur le papier, muet en pratique, confiné à un
seul écran. Le vrai gap : **surface d'apparition et persistance**, pas
moteur (qui est prêt à 95%).

## When to Surface

**Trigger:** quand on veut densifier le compagnon, améliorer la rétention
hebdomadaire, ou ressusciter des événements compagnon dormants — typiquement
v1.3 ou milestone orienté engagement/narratif.

Ne pas surfacer si milestone orienté pure infra, stabilité, ou features
non-ferme/non-gamification.

## Scope Estimate

**Medium** — découpable en 3 axes INDÉPENDANTS (chacun livrable seul) :

### Axe 3a — Archive persistante (petit, 1-2j)

Nouveau fichier `companion-log-{profileId}.md`, append-only, cap 200
messages rotatif.

Format simple :
```
- 2026-04-07T10:30:00Z | event:task_completed | "Bravo pour le ménage, j'ai vu ça d'ici."
```

UI : bouton "Journal de {nom_compagnon}" dans l'écran tree ou dans le
codex v1.2 → affiche timeline des derniers échanges. Rend le compagnon
**tangible** et crée un attachement rétrospectif.

Câblage : 1 hook dans `generateCompanionAIMessage` après render réussi.

### Axe 3b — Élargir les points d'appel (moyen, 2-3j)

Brancher les events dormants aux hooks existants qui les ignorent :

| Event compagnon dormant | Hook à instrumenter |
|---|---|
| `gratitude_written` | `hooks/useGratitude.ts` après save |
| `photo_added` | `hooks/usePhotos.ts` après import |
| `meal_planned` | `hooks/useMeals.ts` après plan week |
| `routine_completed` | `hooks/useRoutines.ts` à la fin |
| `budget_alert` | `hooks/useBudget.ts` sur seuil |
| `family_milestone` | Nouveau hook, déclenché par SEED-002 |
| `comeback` | `AppState.active` après 3+ jours d'absence |
| `gentle_nudge` | Scheduled 21h si 0 tâche cochée aujourd'hui |

Rendu : toast discret avec avatar compagnon (opt-out dans settings) OU
file d'attente affichée à l'ouverture de l'écran tree. Préférence : toast
pour l'immédiateté.

### Axe 3c — Weekly recap compagnonné (petit-moyen, 2-3j)

La notif dimanche 20h existe déjà (`scheduled-notifications.ts:522`)
mais ouvre juste le récap brut. La remplacer par :

- Tap sur notif → ouvre l'app sur une modale narrative
- Compagnon résume la semaine en 3-4 phrases (IA) avec input =
  `WeeklyRecapData` agrégé
- Mentionne 1 stat forte + 1 anecdote du musée (SEED-002) + 1
  encouragement pour la semaine suivante
- Persist dans le journal compagnon (3a)
- Ton doux, pas de punition si semaine creuse

Infra 100% prête, reste juste câblage event `weekly_recap` +
modale dédiée.

## Contraintes de design (pièges identifiés)

- **Anti-bruit** : cooldown global 60s existant dans tree.tsx à étendre
  aux nouveaux call sites. Sinon compagnon devient énervant.
- **Priorité events concurrents** : si task_completed + loot_opened en
  même temps, choisir UN seul. Système de priorité :
  `loot_opened > level_up > task_completed > gratitude_written > ...`
- **Budget IA recalibrer** : actuellement 15/jour. Avec 8 call sites en
  plus × N profils, fallback template devient la norme. Acceptable
  (templates de qualité).
- **Opt-out global** : setting "Compagnon discret" qui coupe 3b et
  limite aux événements majeurs (level_up, loot_opened, weekly_recap).
- **Pas de push spam** : les notifications push signées compagnon
  doivent rester rares (max 2/semaine : weekly_recap + éventuel
  comeback).

## Breadcrumbs

- `lib/mascot/companion-types.ts:14-43` — 27 events définis, beaucoup
  dormants
- `lib/mascot/companion-types.ts:69-85` — `CompanionMessageContext`
  (recentMessages RAM only, pas de mémoire durable)
- `lib/mascot/companion-engine.ts:114-223` — templates i18n complets
- `lib/mascot/companion-engine.ts:244` — `buildCompanionPrompt()`
- `lib/mascot/companion-engine.ts:394` — `getRemainingAIBudget()`
- `lib/mascot/companion-engine.ts:438-484` — `generateCompanionAIMessage`
  (point d'injection pour archivage 3a)
- `app/(tabs)/tree.tsx:631` — appel greeting (tap)
- `app/(tabs)/tree.tsx:692` — appel action (harvest/craft/building)
- `app/(tabs)/tree.tsx:774` — appel focus écran
- `app/(tabs)/tree.tsx:349` — `companionRecentMessagesRef` (RAM,
  à migrer vers persistance)
- `lib/weekly-recap.ts` — `WeeklyRecapData` structure d'input pour 3c
- `lib/scheduled-notifications.ts:522-543` —
  `setupWeeklyAISummaryReminder()` déjà programmée, à enrichir pour 3c
- `lib/ai-service.ts:886` — `aiCall` pour compagnon
- `hooks/useGratitude.ts`, `hooks/usePhotos.ts`, `hooks/useMeals.ts`,
  `hooks/useRoutines.ts`, `hooks/useBudget.ts` — call sites pour 3b

## Notes

**Important** : la première analyse avait à tort conclu que l'IA compagnon
n'était jamais branchée. Vérification code : elle l'est, et fonctionne.
Le vrai gap est la **surface d'apparition** et la **persistance**, pas
le moteur.

Les 3 axes sont totalement indépendants et peuvent être livrés séparément :
- 3a (journal) seul = quick win tangible
- 3c (weekly narratif) seul = boost rétention dimanche soir
- 3b (events élargis) seul = compagnon omniprésent mais discret

Articulation avec les autres seeds :
- SEED-001 (couplage sémantique) génère des events à commenter
- SEED-002 (musée) génère des milestones que le compagnon peut raconter
  via event `family_milestone` ou `celebration`

Inspirations : Finch (pet narratif), Animal Crossing (lettres des habitants),
Cozy Grove (compagnons qui racontent des souvenirs datés).
