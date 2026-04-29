# Phase 43: Auberge — Modèle & moteur visiteurs - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Source:** Conversation design (auto mode)

<domain>
## Phase Boundary

Cette phase livre les **fondations pures et invisibles** du système Auberge :
- Types TypeScript (ActiveVisitor, VisitorReputation, VisitorRequestItem, AubergeState).
- Catalogue de 6 visiteurs (boulanger, lucette, voyageuse, apiculteur, marchand, comtesse).
- Moteur pur sans React (`auberge-engine.ts`) : spawn, deliver, dismiss, expire, canDeliver, réputation.
- Parsers/serializers CSV pour persistance dans le markdown vault.
- Hook React `useAuberge` connecté au VaultContext.
- Tests Jest exhaustifs sur le moteur.

**HORS scope (phases ultérieures) :**
- UI (modal Auberge, carte dashboard, animations).
- Construction du bâtiment Auberge dans le shop.
- Refacto `producesResource` flag.
- Notifications locales expo-notifications.
- Branche tech "social".
- Sprites bâtiment + portraits visiteurs.
- Équilibrage final, badges, polish.

</domain>

<decisions>
## Implementation Decisions

### Modèle de données
- `ActiveVisitor` : `{ visitorId, instanceId (uuid), arrivedAt, deadlineAt, request, status: 'active'|'delivered'|'expired', rewardCoins (snapshot), rewardLootKey? }`
- `VisitorReputation` : `{ visitorId, level (0-5), successCount, failureCount, lastSeenAt }`
- `VisitorRequestItem` : `{ itemId, source: 'building'|'crop'|'crafted', quantity }`
- `AubergeState` : `{ visitors[], reputations[], lastSpawnAt?, totalDeliveries }`
- Tous ces types vivent dans `lib/mascot/types.ts`.

### Catalogue des visiteurs
- Fichier dédié `lib/mascot/visitor-catalog.ts` (mirror du pattern de `BUILDING_CATALOG`).
- 6 visiteurs au lancement :
  - 🧑‍🍳 **Hugo le boulanger** (commun, deadline 48h, multiplier 1.4) — farine + œuf + wheat
  - 👵 **Mémé Lucette** (commun, 48h, 1.4) — lait + chou/patate/betterave
  - 🐝 **Yann l'apiculteur** (uncommon, 60h, 1.6) — miel + farine
  - 🧙 **La Voyageuse** (uncommon, 60h, 1.6) — fruits/herbes saisonniers + items craftés simples
  - 🪙 **Le Marchand ambulant** (uncommon, 60h, 1.6) — items craftés à fort sellValue
  - 👑 **La Comtesse** (rare, 72h, 1.8, `unlockMinReputation: 15`) — items craftés rares ou récoltes golden
- Champs : `id, labelKey, descriptionKey, emoji, deadlineHours, rarity, minTreeStage, unlockMinReputation?, requestPool[], rewardMultiplier, preferredLoot?`
- `requestPool` = templates pondérés ; chaque template liste items avec `quantity: [min, max]`.

### Moteur (auberge-engine.ts)
**Fonctions exposées (toutes pures) :**
- `getEligibleVisitors(state, treeStage, totalReputation): VisitorDefinition[]` — filtre PAR `minTreeStage` ET `unlockMinReputation` UNIQUEMENT. Ne regarde PAS l'inventaire courant.
- `shouldSpawnVisitor(state, now, treeStage): boolean` — vérifie cooldown global + cap actifs.
- `spawnVisitor(state, treeStage, now, totalReputation): ActiveVisitor | null` — tire visiteur+template, instancie quantités random dans [min,max], snapshot reward.
- `canDeliver(visitor, inventory, harvestInv, craftedItems): { ok, missing }` — calcule items manquants par source.
- `getRemainingMinutes(visitor, now): number`
- `getActiveVisitors(state, now): ActiveVisitor[]` — filtre `status === 'active' && now < deadlineAt`.
- `deliverVisitor(state, instanceId, inventories, now): { state, deductedItems, reward: { coins, loot? }, reputationDelta: 1 }`
- `dismissVisitor(state, instanceId, now): { state }` — pas de pénalité réputation, juste cooldown.
- `expireVisitors(state, now): { state, expired: ActiveVisitor[] }` — passe en status='expired', -1 réputation (floor 0).
- `getReputation(state, visitorId): number`
- `getTotalReputation(state): number`
- `isVisitorUnlocked(visitorId, state, treeStage): boolean`

**Règles spawn :**
- Cooldown global : `lastSpawnAt + 6h` minimum.
- Anti-spam même PNJ : `reputation.lastSeenAt + 24h` minimum.
- Cap actifs simultanés : 1 (`pousse`), 2 (`arbuste`), 3 (`arbre`+).
- Pondération inverse de rareté pour le tirage (commun > uncommon > rare).

**Formule récompense (snapshot à la création) :**
- `baseValue = sum(item.quantity × estimatedSellValue(item))`
- `rewardCoins = round(baseValue × visitor.rewardMultiplier × rarityBonus)`
- `rarityBonus`: common 1.0, uncommon 1.15, rare 1.4
- Chance loot rare : 8% commun / 18% uncommon / 35% rare (calculée à la livraison, pas au spawn).

**Réputation :**
- Livraison réussie : +1 (cap 5 par PNJ).
- Expiration : −1 (floor 0).
- Refus volontaire : 0 (juste cooldown 6h).
- `getTotalReputation` somme les niveaux pour gating des rares.

### Persistance (parser.ts)
- Ajouter à `FarmProfileData` :
  - `auberge_visitors?: string` (CSV des visiteurs actifs/livrés non archivés)
  - `auberge_reputations?: string` (CSV)
  - `auberge_last_spawn?: string` (ISO)
  - `auberge_total_deliveries?: number`
- Format CSV inspiré de `serializeBuildings` (`building-engine.ts:33`) : `|` entre visiteurs, `:` entre champs.
- Si imbrication trop dense, réutiliser le trick d'encoding `,`→`|` / `:`→`§` documenté en `farm-engine.ts:228`.
- Round-trip parse/serialize testé.
- **Pas de bump CACHE_VERSION** (la ferme est exclue du cache, voir `vault-cache.ts:53` et CLAUDE.md).
- Archive auto : visiteurs `delivered`/`expired` depuis +7j ne sont plus persistés (compteur `totalDeliveries` les agrège).

### Hook (useAuberge.ts)
- Fichier dédié dans `hooks/`.
- Dépendances : `useFarm` (inventaires, profileId), `useGamification` (`addCoins`).
- Setters exposés :
  - `deliverVisitor(profileId, instanceId)` — vérifie éligibilité, débite inventaire, crédite coins, persiste en **un seul `writeProfileFields` atomique**.
  - `dismissVisitor(profileId, instanceId)` — persiste l'état.
  - `tickAuberge(profileId)` — appelle `expireVisitors` puis tente `spawnVisitor`. Sera invoqué au launch + dans la cascade de tâches en phase ultérieure.
- Intégration `VaultContext` selon le pattern des autres domaines.

### Tests Jest
- Fichier `lib/__tests__/auberge-engine.test.ts`.
- Couverture obligatoire :
  - Spawn : eligibilité par stade, anti-spam même PNJ, cooldown global, cap actifs.
  - Deliver : déduction correcte des items, reward calculé, réputation +1, gestion items manquants.
  - Dismiss : pas de pénalité, cooldown enregistré.
  - Expire : passe à 'expired', -1 réputation, floor 0.
  - Round-trip parse/serialize avec edge cases (état vide, multiples visiteurs, caractères spéciaux).
  - Réputation totale et gating de la Comtesse à 15.

### Claude's Discretion
- Choix de l'algorithme exact de pondération (poids inverses ou tirage table cumulative).
- Choix de la valeur exacte des `requestPool[].weight` par visiteur — ajuster pour variété.
- Implémentation du UUID (crypto.randomUUID si dispo, fallback Math.random + timestamp).
- Format exact du CSV (avec ou sans encoding §|) selon densité.
- `estimatedSellValue` : peut réutiliser `getEffectiveHarvestReward` pour les crops, lookup direct dans `BUILDING_CATALOG.dailyIncome` ou table custom pour les ressources, et `CRAFT_RECIPES.sellValue` pour les crafted.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & conventions
- `CLAUDE.md` — Conventions projet (FR, useThemeColors, no hardcoded colors, vault cache rules).
- `.planning/PROJECT.md` — Vision & contraintes globales.

### Patterns à imiter
- `lib/mascot/building-engine.ts` — Pattern de moteur pur + serialize/parse CSV (lignes 33-98).
- `lib/mascot/farm-engine.ts` — Pattern d'encoding CSV avec escapement (lignes 228-274), spawn aléatoire pondéré (rollHarvestEvent, lignes 310-317).
- `lib/mascot/expedition-engine.ts` — Pattern de timer & state machine pour entités time-bounded (lignes 570-637).
- `lib/mascot/gift-engine.ts` — Pattern NPC + cooldown journalier (lignes 1-120).
- `lib/mascot/types.ts` — Lieu d'ajout des types Auberge ; voir `BUILDING_CATALOG` (514-556) et `CROP_CATALOG` pour le style des catalogues.

### Persistance
- `lib/parser.ts` — `parseFarmProfile` / `serializeFarmProfile` (867-957) ; `FarmProfileData` (lib/types.ts:627-671).
- `lib/vault-cache.ts:41,53` — `CACHE_VERSION` (NE PAS bumper, ferme exclue).
- `hooks/useFarm.ts` — Pattern `writeProfileField` / `writeProfileFields` (247-267) pour writes atomiques.

### Tests
- `lib/__tests__/` — Pattern Jest existant.

### Catalogues utiles
- `BUILDING_CATALOG` (`lib/mascot/types.ts:514-556`) — Pour `dailyIncome` / valeurs de référence.
- `CROP_CATALOG` (`lib/mascot/types.ts:~330-389`) — Pour `harvestReward` / `estimatedSellValue` des crops.
- `CRAFT_RECIPES` (`lib/mascot/craft-engine.ts:~80-680`) — Pour `sellValue` des items craftés.

</canonical_refs>

<specifics>
## Specific Ideas

- 6 visiteurs nommés explicitement (voir Catalogue ci-dessus). Les `labelKey` suivent le pattern `auberge.visitor.{id}.name` / `.bio` etc. — i18n ajoutée en phase UI ultérieure, mais les clés doivent être réservées dès maintenant dans le catalogue.
- Le moteur doit être **100% testable sans dépendance vault/file system**. Les setters du hook seuls touchent au filesystem.
- `getActiveVisitors` doit aussi filtrer les visiteurs expirés silencieusement (pour ne pas afficher quelqu'un dont la deadline est dépassée mais pas encore "tickée"). Un visiteur affiché → une opportunité de livrer.
- `deliverVisitor` doit retourner `{ state, deductedItems, reward, reputationDelta }` — le hook orchestre l'application sur farm + gamification, pas le moteur.

</specifics>

<deferred>
## Deferred Ideas

- **Phase suivante** : refacto `producesResource: boolean` sur `BuildingDefinition` + ajout du bâtiment 'auberge' dans `BUILDING_CATALOG` + branche tech `social-1/2/3`.
- **Phase suivante encore** : UI `AubergeSheet.tsx` + `DashboardAuberge.tsx` + sprites + animations.
- **Phase finale** : notifications locales + équilibrage + badges + microcopy polish.
- Visiteur narratif (lien avec sagas) — explicitement remis à plus tard.
- Achievements/badges — phase 47+.

</deferred>

---

*Phase: 43-auberge-mod-le-moteur-visiteurs*
*Context gathered: 2026-04-29 via design conversation (auto mode)*
