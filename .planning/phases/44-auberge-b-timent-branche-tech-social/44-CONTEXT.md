# Phase 44: Auberge — Bâtiment & branche tech social - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Source:** Conversation design (auto mode)

<domain>
## Phase Boundary

Cette phase **branche** l'Auberge dans le système de bâtiments existant et crée la branche tech "social" qui débloque sa construction. Sans UI dédiée — le bâtiment apparaît dans le shop existant (`BuildingShopSheet`) et le détail dans `BuildingDetailSheet` (qui devra gracefully gérer un bâtiment non-productif).

**IN scope :**
- Refacto `BuildingDefinition` : ajout flag `producesResource: boolean` (default `true` pour rétrocompat).
- Court-circuit dans `building-engine.ts` (`getPendingResources`, `collectBuilding`, `getMinutesUntilNext`) si `producesResource === false`.
- Ajout du bâtiment `auberge` dans `BUILDING_CATALOG` avec `producesResource: false`, `techRequired: 'social-1'`, tiers générés (mais coûts/cycles ignorés côté production).
- Nouveau fichier ou extension `tech-engine.ts` : ajout des 3 nœuds `social-1` / `social-2` / `social-3` avec coûts (300/1500/4000) et bonus (déblocage construction / +1 visiteur actif / +20% reward).
- Branchement minimal côté `BuildingDetailSheet` : si `producesResource === false`, afficher un message simple "Voir l'auberge" au lieu du panneau de production (sans encore router vers le sheet Auberge — c'est Phase 45). Pour cette phase, le tap reste un no-op ou affiche une alerte placeholder.
- Tests Jest non-régression sur les 4 bâtiments existants (poulailler, grange, moulin, ruche) — production toujours fonctionnelle.

**OUT of scope :**
- UI Auberge (`AubergeSheet.tsx`) — Phase 45.
- DashboardAuberge — Phase 45.
- Spawn automatique des visiteurs — Phase 46.
- Notifications locales — Phase 46.
- Sprites bâtiment auberge — Phase 47 (pour cette phase, emoji 🛖 fallback dans `building-sprites.ts` ou pas de sprite enregistré, le `BuildingShopSheet` doit déjà gérer un fallback).
- Wiring effectif de `social-2` (+1 cap) et `social-3` (+20% reward) dans le moteur Auberge — pour cette phase, seul `social-1` est consommé (gating de la construction). Les bonus 2 et 3 sont définis dans le tech tree mais leur impact réel sera branché en Phase 45+.

</domain>

<decisions>
## Implementation Decisions

### Refacto producesResource
- Ajouter `producesResource?: boolean` (optionnel) à `BuildingDefinition` dans `lib/mascot/types.ts`.
- Default-treat `undefined` comme `true` (rétrocompat avec poulailler/grange/moulin/ruche qui n'ont pas le champ).
- Dans `building-engine.ts` :
  - `getPendingResources` : si `def.producesResource === false`, retour `0`.
  - `getMinutesUntilNext` : si `def.producesResource === false`, retour `0`.
  - `collectBuilding` : si `def.producesResource === false`, retour `{ buildings, inventory, collected: 0 }` (no-op).
- `getUpgradeCost` et `canUpgrade` continuent de fonctionner normalement (l'auberge est upgradable même si non-productive).

### Bâtiment Auberge dans BUILDING_CATALOG
```ts
{
  id: 'auberge',
  labelKey: 'farm.building.auberge',
  emoji: '🛖',
  cost: 1800,
  dailyIncome: 0,
  minTreeStage: 'arbuste',
  resourceType: 'oeuf',           // unused mais requis par le type
  producesResource: false,
  techRequired: 'social-1',
  tiers: generateTiers(0, 1500),  // baseHours=0 court-circuité
}
```

### Branche tech "social"
Ajouter 3 nœuds dans `TECH_TREE` (`lib/mascot/tech-engine.ts`) :
- `social-1` : cost 300, requires `null` (pas de prereq), branche `'social'`. Effet : déblocage construction Auberge.
- `social-2` : cost 1500, requires `social-1`. Effet : `aubergeMaxActiveBonus: 1` (champ ajouté à `TechBonuses`, agrégé via `getTechBonuses`). Lecture par `auberge-engine.ts` plus tard (via param optionnel).
- `social-3` : cost 4000, requires `social-2`. Effet : `aubergeRewardMultiplier: 1.2` (champ ajouté à `TechBonuses`).

Les nouveaux champs `TechBonuses.aubergeMaxActiveBonus` et `aubergeRewardMultiplier` doivent avoir des defaults sensibles (0 et 1.0) et n'affecter aucun calcul existant.

### BuildingDetailSheet — gestion gracieuse
- Lire `def.producesResource`. Si `false` :
  - Cacher le panneau de production (timer, pending, bouton Collecte).
  - Afficher un placeholder : *"Ce bâtiment ne produit pas de ressources passives. Voir l'intérieur prochainement."* (sera remplacé en Phase 45 par un CTA vers `AubergeSheet`).
  - Garder le panneau d'upgrade (l'auberge est upgradable).
- Pas d'autre modif sur ce sheet en Phase 44.

### BuildingShopSheet — affichage auberge
- L'auberge doit apparaître dans la liste des bâtiments constructibles dès que `social-1` est débloqué et que stade arbre = `arbuste`+.
- `getAvailableBuildings` (s'il existe) ou la liste filtrée doit déjà gérer `techRequired` — vérifier qu'aucune adaptation n'est nécessaire.
- Coût 1800 feuilles, debit standard via `useFarm.constructBuilding`.

### Tests
- `lib/__tests__/building-engine-non-productive.test.ts` (nouveau) : couvre les 3 fonctions court-circuitées sur un fake building avec `producesResource: false`.
- `lib/__tests__/building-engine.test.ts` (s'il existe, sinon créer) : non-régression sur poulailler/grange/moulin/ruche — production fonctionnelle.
- `lib/__tests__/tech-engine-social.test.ts` (nouveau) : `social-1` débloque, prerequis `social-2 → social-1`, agrégation `aubergeMaxActiveBonus` / `aubergeRewardMultiplier` dans `getTechBonuses`.

### Claude's Discretion
- Format exact du placeholder "Voir l'auberge" dans `BuildingDetailSheet` (i18n key réservée, texte FR direct OK).
- Si `BuildingDetailSheet` n'utilise pas i18n existant pour ses textes, suivre le pattern existant.
- Choix de positionner les nouveaux champs `TechBonuses` (à la fin de l'interface ou groupés par branche).

</decisions>

<canonical_refs>
## Canonical References

### Architecture & conventions
- `CLAUDE.md` — Conventions FR + bonnes pratiques.

### Code à modifier
- `lib/mascot/types.ts:422-432` — interface `BuildingDefinition`.
- `lib/mascot/types.ts:514-556` — `BUILDING_CATALOG`.
- `lib/mascot/building-engine.ts:140-235` — `getPendingResources`, `getMinutesUntilNext`, `collectBuilding`.
- `lib/mascot/tech-engine.ts:35-207` — `TECH_TREE`, `TechBonuses`, `getTechBonuses`.
- `components/mascot/BuildingDetailSheet.tsx` — affichage gracieux non-productif.

### Patterns à imiter
- Pattern de tech existant : voir branche `elevage` dans `tech-engine.ts` (3 nœuds, prereqs chaînés).
- Pattern de tier : `generateTiers` dans `types.ts:447`.
- Pattern d'extension `TechBonuses` : ajouter un champ ne casse rien si default sensible.

### Locales
- `locales/fr/common.json:4255-4336` — clé `farm.building.auberge.{name,description}` à ajouter.

</canonical_refs>

<specifics>
## Specific Ideas

- L'utilisateur doit pouvoir construire l'auberge à la fin de cette phase, mais le bâtiment construit n'a aucune utilité visible (pas de UI). Phase 45 livre le contenu cliquable.
- La rétrocompat est non-négociable : tous les anciens bâtiments doivent continuer à produire.
- Les bonus tech `social-2/3` sont câblés dans `TechBonuses` mais non consommés : Phase 45 (UI) ou Phase 46 (spawn auto) viendra les lire.

</specifics>

<deferred>
## Deferred Ideas

- Phase 45 : UI sheet Auberge + dashboard card + dev spawn button.
- Phase 46 : spawn auto + notifs.
- Phase 47 : sprites + polish.
- Achievements/badges Auberge — phase 48+.

</deferred>

---

*Phase: 44-auberge-b-timent-branche-tech-social*
*Context gathered: 2026-04-29 via design conversation (auto mode)*
