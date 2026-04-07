# Phase 13: Événements Saisonniers - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Un personnage visiteur thématique apparaît dans la scène ferme/arbre quand un événement saisonnier est actif (déterminé par le calendrier). Même pattern que les sagas immersives : tap → dialogue interactif → choix → récompenses loot saisonnières. Pas de UI dashboard, pas de quêtes compteur — juste l'événement dans la ferme.

</domain>

<decisions>
## Implementation Decisions

### Pattern d'interaction
- **D-01:** Réutiliser exactement le pattern saga immersive (Phase 11) — VisitorSlot pour l'animation d'arrivée, SagaWorldEvent pour le dialogue, même flow tap → dialogue → choix → récompense
- **D-02:** Pas de bandeau dashboard, pas d'indicateur texte — l'utilisateur découvre le visiteur en allant sur l'écran arbre/ferme naturellement
- **D-03:** Un seul chapitre par événement (pas multi-chapitres comme les sagas) — l'interaction est courte et directe

### Visiteur et sprites
- **D-04:** Chaque événement a son propre personnage visiteur pixel (lapin de Pâques, fantôme Halloween, Père Noël, etc.)
- **D-05:** Les sprites seront faits APRÈS le code — utiliser des placeholders au début, les sprites réels seront générés via PixelLab plus tard
- **D-06:** Animations identiques aux sagas : arrivée, idle, réaction aux choix (joie/surprise), départ

### Déclenchement et cycle
- **D-07:** Utiliser les dates déjà définies dans `SEASONAL_EVENTS` de `seasonal-rewards.ts` — les 8 événements existants (Pâques, Halloween, Noël, etc.)
- **D-08:** Le visiteur apparaît UNE FOIS par événement par profil — une fois l'interaction faite, il disparaît jusqu'au prochain événement
- **D-09:** Le visiteur réapparaît chaque jour pendant la période de l'événement si l'utilisateur n'a pas encore interagi avec (pas de pression — il reste disponible)
- **D-10:** Pas de conflit avec les sagas — si une saga ET un événement sont actifs, les deux visiteurs peuvent coexister (positions différentes dans la scène)

### Récompenses
- **D-11:** Compléter le dialogue donne une récompense GARANTIE du pool saisonnier (pas le 20% aléatoire de `trySeasonalDraw()`) — ça utilise le même pool de récompenses mais la distribution est certaine
- **D-12:** Bonus XP thématique en plus de la récompense loot (comme les sagas donnent XP + item)
- **D-13:** Les choix dans le dialogue influencent la rareté/type de récompense (comme les traits des sagas influencent le finale)

### Contenu narratif
- **D-14:** Chaque événement a 2-3 choix dans son dialogue (même structure que les chapitres de saga)
- **D-15:** Le texte est thématique et court — ambiance festive, pas de récit épique
- **D-16:** Tout le contenu textuel passe par i18n (fr/en)

### Claude's Discretion
- Structure des fichiers engine/types — le développeur choisit comment organiser le code (nouveau fichier vs extension de seasonal.ts)
- Position exacte du visiteur événementiel dans la scène (éviter collision avec visiteur saga)
- Mécanisme de fallback si aucun sprite n'est encore disponible pour un événement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Système saisonnier existant
- `lib/gamification/seasonal.ts` — Logique de détection événement actif (`getActiveEvent()`, `isSeasonalActive()`, `getEasterDate()`)
- `lib/gamification/seasonal-rewards.ts` — 8 événements avec dates, couleurs thème, pools de récompenses par rareté, `trySeasonalDraw()`

### Pattern saga à réutiliser
- `lib/mascot/sagas-engine.ts` — Moteur de progression saga (chapitres, choix, traits, complétion)
- `lib/mascot/sagas-content.ts` — Contenu narratif des sagas (structure des chapitres/choix)
- `lib/mascot/sagas-types.ts` — Types SagaProgress, SagaChapter, SagaCompletionResult
- `lib/mascot/sagas-storage.ts` — Persistance progression saga dans le vault

### Composants visuels à réutiliser
- `components/mascot/VisitorSlot.tsx` — Composant visiteur pixel avec animations arrivée/idle/départ
- Rechercher `SagaWorldEvent` dans `components/mascot/` — Composant dialogue interactif des sagas

### Système de récompenses
- `lib/gamification/engine.ts` — `openLootBox()`, système de points, pity counter
- `lib/gamification/rewards.ts` — Définitions récompenses, `REWARDS`, `DROP_RATES`
- `constants/rewards.ts` — Pool de récompenses configurable

### Intégration scène arbre
- `app/(tabs)/tree.tsx` — Écran arbre/ferme principal, orchestration visiteurs saga

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **VisitorSlot** : Composant prêt à l'emploi pour afficher un visiteur pixel avec animations (arrivée, idle, tap, départ) — créé en Phase 11
- **SagaWorldEvent** : Composant dialogue interactif avec choix et récompenses — le coeur de l'UX à réutiliser
- **SeasonalParticles** : Particules ambiantes saisonnières (Phase 3) — déjà actives par date
- **SEASONAL_EVENTS** : 8 événements pré-configurés avec dates, emoji, couleurs, et pools de récompenses
- **trySeasonalDraw()** : Fonction de tirage saisonnier dans les loot boxes — à transformer en récompense garantie
- **getEasterDate()** : Calcul dynamique de la date de Pâques (algorithme Meeus/Jones/Butcher)

### Established Patterns
- **Sagas** : `SagaProgress` tracke la progression par profil, persistée dans le vault via `sagas-storage.ts`
- **i18n** : Tout le contenu textuel utilise des clés i18n dans `locales/fr/gamification.json` et `locales/en/gamification.json`
- **Rewards** : Toutes les récompenses passent par `constants/rewards.ts` — aucune valeur inline

### Integration Points
- **tree.tsx** : L'écran arbre orchestre les visiteurs saga — ajouter le visiteur événementiel ici
- **useGamification** : Hook qui gère l'état gamification — étendre pour tracker les événements complétés
- **gami-{id}.md** : Fichier par profil pour persister la progression (Phase 8.1)

</code_context>

<specifics>
## Specific Ideas

- "Comme une saga, sans le texte dans le dashboard, juste on arrive sur la ferme et boom, un événement" — l'utilisateur veut la surprise/découverte
- "Lié aux événements loot box avec le même type de texte et même genre de récompense" — réutiliser les pools de récompenses saisonnières existantes
- "Il me faut des sprites adaptés mais cela peut être fait après" — priorité au code, placeholders OK pour les sprites
- "Événements non dépendants entre eux" — architecture modulaire, ajouter un événement = ajouter du contenu
- Pâques est le premier événement cible (arrive bientôt) — prioriser le contenu Easter

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-evenements-saisonniers*
*Context gathered: 2026-04-03*
