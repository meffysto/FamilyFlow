# Phase 43: Auberge — Modèle & moteur visiteurs - Research

**Researched:** 2026-04-29
**Domain:** Pure TS engine (mascot domain) + CSV markdown persistence + React orchestrator hook
**Confidence:** HIGH (codebase entirely internal, mature precedents for every primitive needed)

## Summary

Phase 43 livre les fondations *invisibles* d'un système Auberge : types, catalogue 6 PNJ, moteur pur `auberge-engine.ts`, parsers CSV dans `farm-{profileId}.md`, hook `useAuberge`, suite Jest. Aucune UI, aucun sprite, aucune notif, aucun ajout `BUILDING_CATALOG`. Le projet a déjà construit cinq engines comparables (building/farm/expedition/gift/companion/wear), chacun fournissant un pattern direct à mimer.

**Primary recommendation :** Copier-coller la structure de `expedition-engine.ts` (entité time-bounded avec `startedAt + duration`) + `gift-engine.ts` (compteur per-jour), encoder les visiteurs en CSV avec le trick `farm-engine.ts` (`,`→`|` / `:`→`§`) pour les reputations imbriquées, générer les `instanceId` via le pattern `wear-engine` (`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`), et écrire en un seul `writeProfileFields` atomique depuis le hook (pattern `useFarm.ts:257-267`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modèle de données**
- `ActiveVisitor` : `{ visitorId, instanceId (uuid), arrivedAt, deadlineAt, request, status: 'active'|'delivered'|'expired', rewardCoins (snapshot), rewardLootKey? }`
- `VisitorReputation` : `{ visitorId, level (0-5), successCount, failureCount, lastSeenAt }`
- `VisitorRequestItem` : `{ itemId, source: 'building'|'crop'|'crafted', quantity }`
- `AubergeState` : `{ visitors[], reputations[], lastSpawnAt?, totalDeliveries }`
- Tous ces types vivent dans `lib/mascot/types.ts`.

**Catalogue des visiteurs** (`lib/mascot/visitor-catalog.ts`, mirror de `BUILDING_CATALOG`) — 6 PNJ :
- 🧑‍🍳 Hugo le boulanger (commun, 48h, ×1.4) — farine + œuf + wheat
- 👵 Mémé Lucette (commun, 48h, ×1.4) — lait + chou/patate/betterave
- 🐝 Yann l'apiculteur (uncommon, 60h, ×1.6) — miel + farine
- 🧙 La Voyageuse (uncommon, 60h, ×1.6) — fruits/herbes saisonniers + craftés simples
- 🪙 Le Marchand ambulant (uncommon, 60h, ×1.6) — craftés à fort sellValue
- 👑 La Comtesse (rare, 72h, ×1.8, `unlockMinReputation: 15`) — craftés rares ou récoltes golden

Champs catalogue : `id, labelKey, descriptionKey, emoji, deadlineHours, rarity, minTreeStage, unlockMinReputation?, requestPool[], rewardMultiplier, preferredLoot?`. `requestPool` = templates pondérés ; chaque template liste items avec `quantity: [min, max]`.

**Moteur (auberge-engine.ts)** — Toutes fonctions PURES, signatures verrouillées :
- `getEligibleVisitors(state, treeStage, totalReputation): VisitorDefinition[]`
- `shouldSpawnVisitor(state, now, treeStage): boolean`
- `spawnVisitor(state, treeStage, now, totalReputation): ActiveVisitor | null`
- `canDeliver(visitor, inventory, harvestInv, craftedItems): { ok, missing }`
- `getRemainingMinutes(visitor, now): number`
- `getActiveVisitors(state, now): ActiveVisitor[]` — filtre `status === 'active' && now < deadlineAt`
- `deliverVisitor(state, instanceId, inventories, now): { state, deductedItems, reward: { coins, loot? }, reputationDelta: 1 }`
- `dismissVisitor(state, instanceId, now): { state }` — pas de pénalité, juste cooldown
- `expireVisitors(state, now): { state, expired: ActiveVisitor[] }` — −1 réputation (floor 0)
- `getReputation(state, visitorId): number`
- `getTotalReputation(state): number`
- `isVisitorUnlocked(visitorId, state, treeStage): boolean`

**Règles spawn :** cooldown global `lastSpawnAt + 6h`, anti-spam même PNJ `reputation.lastSeenAt + 24h`, cap actifs simultanés 1/2/3 selon stade pousse/arbuste/arbre+, pondération inverse de rareté.

**Récompense (snapshot à la création) :**
- `baseValue = sum(item.quantity × estimatedSellValue(item))`
- `rewardCoins = round(baseValue × visitor.rewardMultiplier × rarityBonus)`
- `rarityBonus`: common 1.0, uncommon 1.15, rare 1.4
- Loot : 8% / 18% / 35% (rolled à la livraison, pas au spawn).

**Réputation :** delivery +1 (cap 5), expire −1 (floor 0), dismiss 0. `getTotalReputation` somme pour gating Comtesse à 15.

**Persistance — `FarmProfileData` ajoute :**
- `auberge_visitors?: string` (CSV des actifs+livrés non archivés)
- `auberge_reputations?: string` (CSV)
- `auberge_last_spawn?: string` (ISO)
- `auberge_total_deliveries?: number`

Format : `|` entre visiteurs, `:` entre champs, fallback escape `,`→`|` / `:`→`§` si imbrication. **Pas de bump CACHE_VERSION** (ferme exclue du cache). Archive auto : visiteurs `delivered`/`expired` depuis +7j ne sont plus persistés (compteur `totalDeliveries` les agrège).

**Hook (useAuberge.ts) — fichier dédié dans `hooks/`** :
- Dépend de `useFarm` (inventaires, profileId), `useGamification` (`addCoins`).
- Setters : `deliverVisitor`, `dismissVisitor`, `tickAuberge` (expire+spawn).
- **Un seul `writeProfileFields` atomique** par mutation.
- Intégration VaultContext selon pattern des autres domaines.

**Tests Jest :** `lib/__tests__/auberge-engine.test.ts` couvrant spawn (eligibilité/anti-spam/cooldown/cap), deliver (déduction/reward/réputation), dismiss, expire (−1 floor 0), round-trip parse/serialize avec edge cases, gating Comtesse.

### Claude's Discretion

- Choix algo pondération (poids inverses ou table cumulative).
- Valeurs exactes `requestPool[].weight` par visiteur — ajuster pour variété.
- Implémentation UUID (`crypto.randomUUID` si dispo, fallback `Date.now()+Math.random().toString(36)`).
- Format exact CSV (avec ou sans encoding `§|`) selon densité.
- `estimatedSellValue` : `getEffectiveHarvestReward` pour crops, lookup `BUILDING_CATALOG.dailyIncome` ou table custom pour ressources, `CRAFT_RECIPES.sellValue` pour craftés.

### Deferred Ideas (OUT OF SCOPE)

- UI (modal Auberge, carte dashboard, animations).
- Construction Auberge dans le shop / refacto `producesResource` flag.
- Notifications locales expo-notifications.
- Branche tech "social".
- Sprites bâtiment + portraits visiteurs.
- Équilibrage final, badges, polish.
- Visiteur narratif (lien sagas), achievements.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Stack figé** : RN 0.81.5 + Expo SDK 54, react-native-reanimated ~4.1, gray-matter pour frontmatter — aucune nouvelle dépendance npm.
- **Langue UI/commits/commentaires** : français.
- **Couleurs** : `useThemeColors()` uniquement (pas de hardcoded). N/A en Phase 43 (pas d'UI).
- **Type check obligatoire** : `npx tsc --noEmit` avant chaque commit.
- **Tests** : `npx jest --no-coverage` ; erreurs pré-existantes dans MemoryEditor/cooklang/useVault à ignorer.
- **Pas de bump CACHE_VERSION** : la ferme est explicitement exclue du cache (`vault-cache.ts:53`, voir `lib/vault-cache.ts:41` commentaires sur exclusions volontaires).
- **Vault path** : `farm-{profileId}.md` (pattern actuel utilisé par useFarm/useExpeditions).
- **Privacy** : noms génériques dans tests/docs/commits (Lucas, Emma, Sofia, Noah). Les noms PNJ visiteurs (Hugo, Lucette, Yann) sont fictifs et autorisés (personnages de jeu, pas membres réels).
- **Architecture** : moteur pur `lib/mascot/*-engine.ts` 100% sync sans React, hook orchestrateur dans `hooks/use*.ts`, parsers dans `lib/parser.ts`.

## Standard Stack

### Core (déjà installé, pas de nouvelle dépendance)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript strict | tsconfig | Type safety | Convention projet |
| Jest | déjà configuré | Tests engine | Pattern de toutes les phases 33+ |
| date-fns | déjà importé dans gift-engine | Format dates ISO | Utilisé pour `format(now, 'yyyy-MM-dd')` |

Aucune nouvelle dépendance — toute la logique est synchrone et pure.

## Architecture Patterns

### 1. CSV Serialization — Le pattern verrouillé

Trois exemples du codebase, par densité croissante :

**Plat (building-engine.ts:33-36) — pattern recommandé pour `auberge_reputations`** :
```ts
export function serializeBuildings(buildings: PlacedBuilding[]): string {
  return buildings
    .map(b => `${b.buildingId}:${b.cellId}:${b.level}:${b.lastCollectAt}`)
    .join('|');
}
```
ISO date contient `:` → reconstruction `restParts.join(':')` au parse (`building-engine.ts:74-77`).

**Imbriqué avec escape (farm-engine.ts:228-243) — pour `auberge_visitors` si `request[]` reste imbriqué** :
```ts
// `,` → `|`   (séparateur entre plants)
// `:` → `§`   (séparateur entre champs d'un plant)
export function encodeModifiers(modifiers: FarmCropModifiers | undefined): string {
  if (!modifiers || Object.keys(modifiers).length === 0) return '';
  return JSON.stringify(modifiers).replace(/,/g, '|').replace(/:/g, '§');
}

export function decodeModifiers(raw: string | undefined): FarmCropModifiers | undefined {
  if (!raw || raw.trim() === '') return undefined;
  try {
    const restored = raw.replace(/§/g, ':').replace(/\|/g, ',');
    return JSON.parse(restored) as FarmCropModifiers;
  } catch { return undefined; }
}
```

**Inventaire keyed (building-engine.ts:83-98) — pour quick scalar maps** :
```ts
export function serializeInventory(inventory: FarmInventory): string {
  return `oeuf:${inventory.oeuf},lait:${inventory.lait},farine:${inventory.farine},miel:${inventory.miel}`;
}
```

**Recommandation Phase 43** :
- `auberge_reputations` : CSV plat `visitorId:level:successCount:failureCount:lastSeenAt|...` (`|` entre PNJ, `:` entre champs ; ISO contient `:` → join restParts).
- `auberge_visitors` : utiliser le pattern `encodeModifiers` (JSON.stringify + double escape) pour chaque visiteur — `request: VisitorRequestItem[]` est trop imbriqué pour CSV plat ; `|` outer separator entre visiteurs (donc encoder chaque visiteur en `§|`-escapé puis joindre par `||` ou utiliser un séparateur different comme `;`).
- Alternative simple (recommandée) : sérialiser tout `auberge_visitors` en **un seul JSON.stringify** avec escape ; les fields top-level de `farm-{profileId}.md` sont des `key: value` lignes, pas de conflit avec `:` interne tant qu'on encode.

### 2. Time-bounded entity lifecycle (expedition-engine.ts:570-637)

```ts
export function isExpeditionComplete(exp: ActiveExpedition, now: Date = new Date()): boolean {
  const started = new Date(exp.startedAt).getTime();
  const durationMs = exp.durationHours * 60 * 60 * 1000;
  return now.getTime() >= started + durationMs;
}

export function getExpeditionRemainingMinutes(exp: ActiveExpedition, now: Date = new Date()): number {
  if (isExpeditionComplete(exp, now)) return 0;
  const started = new Date(exp.startedAt).getTime();
  const endTime = started + exp.durationHours * 60 * 60 * 1000;
  return Math.ceil((endTime - now.getTime()) / 60000);
}
```

**Convention clé : `now: Date = new Date()` injectable** → tests passent un `now` explicite, prod laisse default. Mimer pour `getRemainingMinutes(visitor, now)`.

Pour `expireVisitors(state, now)` : itérer `state.visitors.filter(v => v.status === 'active' && now.getTime() >= new Date(v.deadlineAt).getTime())` → marquer `expired`, décrémenter rep correspondante. Pattern identique à `isExpeditionComplete`.

### 3. Daily counter / cooldown (gift-engine.ts:120-150)

```ts
// Format "count|YYYY-MM-DD"
export function canSendGiftToday(giftsSentField: string | undefined, now: Date = new Date()): boolean {
  if (!giftsSentField) return true;
  const todayStr = format(now, 'yyyy-MM-dd');
  const parts = giftsSentField.split('|');
  if (parts.length !== 2) return true;
  const [countStr, dateStr] = parts;
  if (dateStr !== todayStr) return true;
  return parseInt(countStr, 10) < MAX_GIFTS_PER_DAY;
}
```

**Auberge** n'a pas de cap journalier mais a deux cooldowns (global 6h, per-NPC 24h). **Pas de helper partagé existant** — chaque engine fait inline. Pour Phase 43 :
- Global cooldown : `(now.getTime() - new Date(state.lastSpawnAt).getTime()) >= 6 * 3600 * 1000`
- Per-NPC : itérer `state.reputations`, vérifier `(now.getTime() - new Date(rep.lastSeenAt).getTime()) >= 24 * 3600 * 1000`

### 4. Pure engine + React hook split (useFarm.ts:247-267)

```ts
const writeProfileField = useCallback(async (profileId: string, fieldKey: string, value: string) => {
  if (!vault) return;
  const file = farmFile(profileId);
  const content = await vault.readFile(file).catch(() => '');
  const farmData = parseFarmProfile(content);
  applyFarmField(farmData, fieldKey, value);
  const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
  await vault.writeFile(file, serializeFarmProfile(profileName, farmData));
}, [vault, profiles]);

const writeProfileFields = useCallback(async (profileId: string, fields: Record<string, string>) => {
  if (!vault) return;
  const file = farmFile(profileId);
  const content = await vault.readFile(file).catch(() => '');
  const farmData = parseFarmProfile(content);
  for (const [fieldKey, value] of Object.entries(fields)) {
    applyFarmField(farmData, fieldKey, value);
  }
  const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
  await vault.writeFile(file, serializeFarmProfile(profileName, farmData));
}, [vault, profiles]);
```

**Pattern reproduit dans `useExpeditions.ts:1-80`** : import direct des fonctions du moteur pur, lecture vault via `useVault()`, écriture via parse → mutate → serialize.

**Recommandation Phase 43** : `useAuberge.ts` n'a pas besoin d'écrire dans la table `applyFarmField` (fonction privée à useFarm). Deux options :
1. **Ajouter les nouveaux champs `auberge_*` à `applyFarmField`** dans useFarm + utiliser `writeProfileFields` exporté (mais `applyFarmField` est dans useFarm.ts en private).
2. **Pattern useExpeditions** : faire son propre cycle `vault.readFile → parseFarmProfile → mutate FarmProfileData direct → serializeFarmProfile → vault.writeFile`. C'est ce que fait useExpeditions et c'est plus propre pour un nouveau domaine.

→ **Décision recommandée** : pattern useExpeditions (auto-suffisant). useAuberge appelle directement `parseFarmProfile`/`serializeFarmProfile` après mutation `farmData.auberge_visitors = serializeVisitors(...)`.

### 5. VaultContext integration

`contexts/VaultContext.tsx` (37 lignes) wrap simplement `useVaultInternal()` :
```ts
export function VaultProvider({ children }: { children: React.ReactNode }) {
  const vault = useVaultInternal();
  return <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>;
}
export function useVault(): VaultState { ... }
```

**Pas d'enregistrement explicite dans VaultContext** : un domain hook (comme `useExpeditions`) appelle juste `useVault()` pour obtenir `{ vault, profiles, activeProfile, refreshFarm }`. Les screens importent directement `useAuberge()` quand ils en auront besoin (en Phase 44+ UI).

**Phase 43 wiring minimal** :
- `useAuberge.ts` consomme `useVault()`, expose `{ visitors, reputations, deliverVisitor, dismissVisitor, tickAuberge }`.
- Aucune ligne à toucher dans `useVault.ts` ni `VaultContext.tsx` pour cette phase.
- `tickAuberge` doit être appelable par le caller (sera invoqué au launch + cascade phase ultérieure).

### 6. UUID generation — convention codebase

**Pattern dominant** (3 occurrences identiques, `wear-engine.ts:60`, `gamification/engine.ts:304,520`, `quest-engine.ts:257`) :
```ts
return `wear_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
```

Pas de `crypto.randomUUID()` dans le codebase. **Recommandation Phase 43** :
```ts
function generateInstanceId(): string {
  return `vis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
```

Préfixe `vis_` (visitor) — collision-safe ms timestamp + 4 chars random ⇒ collision en pratique impossible pour le volume Auberge (< 10 spawns/jour).

### 7. Reward valuation — fonctions à composer pour `estimatedSellValue`

**Crops** (`farm-engine.ts:277-281`) :
```ts
export function getEffectiveHarvestReward(cropId: string): number {
  const cropDef = CROP_CATALOG.find(c => c.id === cropId);
  if (!cropDef) return 0;
  return cropDef.harvestReward;
}
```
`harvestReward: number` est dans `CropDefinition` (`types.ts:296`). Source de vérité directe.

**Building resources** (`craft-engine.ts:25-32`) :
```ts
export const BUILDING_RESOURCE_VALUE: Record<ResourceType, number> = {
  oeuf: 80,  lait: 100,  farine: 90,  miel: 120,
};
```
**Réutiliser cette table directement** (export existant). Pas besoin de retomber sur `BUILDING_CATALOG.dailyIncome` (qui est un débit/jour, pas un prix unitaire).

**Crafted items** (`craft-engine.ts:72+`) : chaque `CraftRecipe` a `sellValue: number` (e.g. soupe 150, bouquet 200, fromage 480, etc.). `craft-engine.ts:751` retourne `recipe.sellValue` directement.

**Recommandation `estimatedSellValue(item: VisitorRequestItem): number`** :
```ts
function estimatedSellValue(item: VisitorRequestItem): number {
  switch (item.source) {
    case 'crop':     return getEffectiveHarvestReward(item.itemId);
    case 'building': return BUILDING_RESOURCE_VALUE[item.itemId as ResourceType] ?? 0;
    case 'crafted':  return CRAFT_RECIPES.find(r => r.id === item.itemId)?.sellValue ?? 0;
  }
}
```

### 8. Weighted random pick (farm-engine.ts:310-317)

Pas de helper partagé dans `lib/mascot/utils.ts`. Pattern inline :
```ts
export function rollHarvestEvent(): HarvestEvent | null {
  if (Math.random() >= HARVEST_EVENT_CHANCE) return null;
  const roll = Math.random();
  if (roll < HARVEST_EVENT_WEIGHTS.insectes) return HARVEST_EVENTS[0];
  if (roll < HARVEST_EVENT_WEIGHTS.insectes + HARVEST_EVENT_WEIGHTS.pluie_doree) return HARVEST_EVENTS[1];
  return HARVEST_EVENTS[2];
}
```

**Pour Phase 43 spawn pondéré inverse de rareté** : implémenter inline dans `auberge-engine.ts`. Suggestion table cumulative générique :
```ts
function pickWeighted<T>(items: T[], weights: number[]): T | null {
  if (items.length === 0) return null;
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1]; // fallback float precision
}
```
Garder cette fonction *privée* au module (pas d'export inutile).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lecture/écriture `farm-{id}.md` | Custom YAML/regex | `parseFarmProfile` / `serializeFarmProfile` | Round-trip déjà testé sur 30+ champs, Pitfall date|`/etc handled |
| Format ISO date manipulation | `new Date().toISOString().split` | `format(now, 'yyyy-MM-dd')` from `date-fns` | Déjà importé par gift-engine, locale-safe |
| Génération id unique | `crypto.randomUUID()` (Hermes-incompatible parfois) | `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` | Pattern verrouillé par 3 modules existants |
| Backward-compat ancien format CSV | Parser custom branché | Imitter `parseBuildings` `if (!csv.includes(':')) { ancien format }` (`building-engine.ts:43-66`) | Migration silencieuse déjà éprouvée |
| Sérialisation conditionnelle (skip si default) | Tout serialiser | `if (typeof data.X === 'number' && data.X > 0) lines.push(...)` (cf. `parser.ts:1019,1022,1036`) | Évite bruit dans markdown lisible Obsidian |
| Lookup catalogue | `for` loop manuel | `BUILDING_CATALOG.find(b => b.id === ...)` / `CRAFT_RECIPES.find(...)` | Pattern partout, perf irrelevante (catalogues < 50 entries) |

## Common Pitfalls

### Pitfall 1 : ISO timestamp dans CSV cassé par `:`
**Symptôme** : `parts = entry.split(':')` casse une ISO date `2026-04-29T10:30:00.000Z` en plusieurs morceaux.
**Prevention** : `const [a, b, c, ...rest] = parts; const isoDate = rest.join(':');` — voir `building-engine.ts:74-77` et notes Phase 33 `STATE.md` :
> `[Phase 33-expéditions]: CSV expedition: slice(2, length-2).join(':') pour ISO date avec ':' — identique building-engine.ts`

### Pitfall 2 : Réputation négative
**Symptôme** : `expireVisitors` décrémente sans clamp → réputation à -1, -2…
**Prevention** : `Math.max(0, rep.failureCount + 1 ; rep.level - 1)`. Décision CONTEXT.md : floor 0.

### Pitfall 3 : Snapshot reward au mauvais moment
**Symptôme** : reward calculé à la livraison change selon catalog updates entre spawn et delivery.
**Prevention** : **`rewardCoins` est snapshot à `spawnVisitor`** (CONTEXT.md verrouille ce point). `deliverVisitor` ne recalcule jamais. La chance loot est rolled à la livraison (CONTEXT.md), donc `rewardLootKey?` reste optionnel et calculé uniquement à `deliverVisitor`.

### Pitfall 4 : Cap actifs vs PNJ déjà actif
**Symptôme** : on tire un visiteur déjà actif et on duplique.
**Prevention** : `getEligibleVisitors` doit aussi filtrer ceux ayant un `ActiveVisitor` en cours (status='active' && now < deadline) pour ce `visitorId`.

### Pitfall 5 : `getActiveVisitors` retourne un visiteur expiré non-tickté
**Symptôme** (CONTEXT.md §specifics) : un visiteur dont la deadline est passée mais que `expireVisitors` n'a pas encore traité s'affiche comme actif → user clique "livrer" → erreur.
**Prevention** : `getActiveVisitors(state, now)` filtre **silencieusement** `status === 'active' && now < new Date(deadlineAt).getTime()`. Le tick `expireVisitors` est lazy.

### Pitfall 6 : Round-trip CSV avec PNJ catalogue retiré plus tard
**Symptôme** : version future du jeu retire un PNJ → données vault contiennent un `visitorId` introuvable → crash.
**Prevention** : parser silencieux qui filtre `visitorDef ?? skip`, comme `parseBuildings` filter `(b): b is PlacedBuilding => b !== null`.

### Pitfall 7 : Test fragile par dépendance à `Date.now()` réel
**Symptôme** : test passe locally à 10h, casse à minuit.
**Prevention** : toujours injecter `now: Date` paramétrable. Voir pattern `companion-feed.test.ts:38-45` :
```ts
const now = Date.now();
const buff = getBuffForCrop('perfect', 'renard', preferred, now);
expect(buff!.multiplier).toBeCloseTo(1.15 * 1.3, 3);
```

### Pitfall 8 : Archive auto +7j incohérente avec compteur `totalDeliveries`
**Symptôme** : on n'archive que les `delivered` → après 7j on perd ; puis on les recompte → double-count.
**Prevention** : `totalDeliveries` incrementé **à `deliverVisitor` time**, jamais déduit du tableau persisté. Le tableau persisté est purement opérationnel (visiteurs récents pour UI/historique court). Documenter ce contrat dans le commentaire JSDoc de `AubergeState`.

### Pitfall 9 : Bumper CACHE_VERSION par erreur
**Symptôme** : (interdit) bump déclenche invalidation cache mais ferme est exclue → pas d'effet visible mais incohérence sémantique.
**Prevention** : ne PAS toucher `lib/vault-cache.ts:41`. Vérifier que farm reste exclu (`vault-cache.ts:53`). CONTEXT.md verrouille explicitement.

## Code Examples

### Pattern : sérialisation conditionnelle dans serializeFarmProfile

À ajouter dans `lib/parser.ts` autour de ligne 1018 (après les blocs sporée/wager) :
```ts
// Phase 43 — Auberge (per-profil)
if (data.auberge_visitors) {
  lines.push(`auberge_visitors: ${data.auberge_visitors}`);
}
if (data.auberge_reputations) {
  lines.push(`auberge_reputations: ${data.auberge_reputations}`);
}
if (data.auberge_last_spawn) {
  lines.push(`auberge_last_spawn: ${data.auberge_last_spawn}`);
}
if (typeof data.auberge_total_deliveries === 'number' && data.auberge_total_deliveries > 0) {
  lines.push(`auberge_total_deliveries: ${data.auberge_total_deliveries}`);
}
```

### Pattern : test Jest engine pur (template à appliquer)

D'après `wager-engine.test.ts:1-80` et `expedition-engine.test.ts:60-90` :
```ts
import {
  spawnVisitor, deliverVisitor, expireVisitors, canDeliver,
  getActiveVisitors, getRemainingMinutes, getEligibleVisitors,
  serializeAubergeState, parseAubergeState,
} from '../mascot/auberge-engine';
import type { AubergeState, ActiveVisitor } from '../mascot/types';

const emptyState = (): AubergeState => ({
  visitors: [], reputations: [], totalDeliveries: 0,
});

describe('shouldSpawnVisitor — cooldown global', () => {
  it('refuse spawn si lastSpawnAt < 6h', () => {
    const now = new Date('2026-04-29T12:00:00Z');
    const state: AubergeState = {
      ...emptyState(),
      lastSpawnAt: '2026-04-29T07:00:00Z', // -5h
    };
    expect(shouldSpawnVisitor(state, now, 'pousse')).toBe(false);
  });
  it('autorise spawn si lastSpawnAt >= 6h', () => {
    const now = new Date('2026-04-29T13:00:00Z');
    const state: AubergeState = {
      ...emptyState(),
      lastSpawnAt: '2026-04-29T07:00:00Z', // -6h
    };
    expect(shouldSpawnVisitor(state, now, 'pousse')).toBe(true);
  });
});
```

### Pattern : structure visitor-catalog.ts

Mirror `BUILDING_CATALOG` (`types.ts:514-556`) :
```ts
import type { TreeStage } from './types';

export interface VisitorRequestTemplate {
  weight: number;
  items: { itemId: string; source: 'building' | 'crop' | 'crafted'; quantity: [number, number] }[];
}

export interface VisitorDefinition {
  id: string;
  labelKey: string;        // i18n key (réservée, pas branchée Phase 43)
  descriptionKey: string;
  emoji: string;
  rarity: 'common' | 'uncommon' | 'rare';
  deadlineHours: number;   // 48 | 60 | 72
  rewardMultiplier: number; // 1.4 | 1.6 | 1.8
  minTreeStage: TreeStage;
  unlockMinReputation?: number; // Comtesse: 15
  requestPool: VisitorRequestTemplate[];
  preferredLoot?: string[]; // ids de loot préféré pour les drops rares
}

export const VISITOR_CATALOG: VisitorDefinition[] = [
  {
    id: 'hugo_boulanger',
    labelKey: 'auberge.visitor.hugo_boulanger.name',
    descriptionKey: 'auberge.visitor.hugo_boulanger.bio',
    emoji: '🧑‍🍳',
    rarity: 'common',
    deadlineHours: 48,
    rewardMultiplier: 1.4,
    minTreeStage: 'pousse',
    requestPool: [
      { weight: 3, items: [
        { itemId: 'farine', source: 'building', quantity: [2, 4] },
        { itemId: 'oeuf',   source: 'building', quantity: [3, 5] },
      ]},
      { weight: 2, items: [
        { itemId: 'wheat', source: 'crop', quantity: [4, 8] },
      ]},
    ],
  },
  // ... 5 autres PNJ
];
```

## Runtime State Inventory

Phase greenfield (nouveau domaine ajouté), pas un rename. Mais quelques points runtime à valider :

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — Phase 43 *crée* le domaine. Aucune donnée existante à migrer. Vault `farm-{profileId}.md` existant n'aura simplement pas les champs `auberge_*` au premier read → `parseFarmProfile` doit retourner `undefined`/`0`/`''` (déjà le pattern, voir `parser.ts:946` for sporeeCount). | Vérifier dans la suite Jest qu'un `farm-{id}.md` sans champs `auberge_*` parse sans erreur. |
| **Live service config** | None — pas de service externe. | None |
| **OS-registered state** | None — pas de Task Scheduler / pm2 / launchd. | None |
| **Secrets/env vars** | None — aucune clé requise. | None |
| **Build artifacts** | Aucun (TS source uniquement). | None |

**Question canonique** : « Après que tous les fichiers du repo soient mis à jour, qu'est-ce qui dans les systèmes runtime a encore l'ancienne version cachée ? » → **Rien**. La phase est pure addition de champs optionnels backward-compatibles.

**Backward-compat critique** : Si un user a un vault sans champs `auberge_*` (= 100% des users à la livraison), `parseFarmProfile` doit produire `auberge_visitors: undefined` et le moteur traiter `undefined` comme empty state. Test Jest obligatoire : `parseFarmProfile('# Farm — Lucas\nfarm_crops: 0:carrot:0:0:2026-04-29:\n')` retourne sans erreur.

## Environment Availability

Skipped — Phase 43 est purement TypeScript (engine + parser + hook + tests Jest). Pas de tool externe, pas de service, pas de runtime additionnel. Stack figé (`Node + Jest + TS strict`) déjà opérationnel sur 49 fichiers de tests existants dans `lib/__tests__/`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Swipeable` from gesture-handler | `ReanimatedSwipeable` | Convention CLAUDE.md | N/A (Phase 43 sans UI) |
| Animated.Value (RN core) | `useSharedValue` (reanimated) | Convention CLAUDE.md | N/A (Phase 43 sans UI) |
| `crypto.randomUUID` | `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` | Codebase convention (Hermes-safe) | Use le pattern du codebase |
| CSV plat | CSV avec escape `,`→`|` / `:`→`§` (Phase 38) | farm-engine.ts:228 | Disponible si imbrication trop dense |

**Deprecated/outdated dans le scope :** rien. Tous les patterns cités sont actifs en `main`.

## Open Questions

1. **Format exact d'`auberge_visitors`** (CSV plat avec escape vs JSON.stringify single-line)
   - Ce que je sais : le projet a les deux patterns disponibles (`encodeModifiers` JSON-escape, `serializeBuildings` CSV plat).
   - Ce qui n'est pas clair : la densité de `request[]` (2-4 items par template) avec `quantity: [min, max]` *snapshotée* à la création (devient `quantity: number` simple → un entier figé après random)…
   - **Recommandation** : décision « Claude's Discretion » → **CSV plat avec `§|`-escape pour `request[]`**. Format : `instanceId:visitorId:arrivedAt:deadlineAt:status:rewardCoins:rewardLootKey:requestEncoded`, séparateur entre visiteurs `||` (double pipe) pour éviter conflit avec `|` interne post-escape. La planner peut trancher autrement ; documenter le choix dans le PLAN.md.

2. **`refreshFarm` vs lecture directe dans `useAuberge.tickAuberge`**
   - Ce que je sais : `useExpeditions.ts:56` lit `currentProfile` (déjà refreshé au boot), `useFarm.ts` appelle `refreshFarm(profileId)` après mutation.
   - Ce qui n'est pas clair : si `tickAuberge` est invoqué au boot (donc avant le first refresh), faut-il `await refreshFarm` avant de lire `state` ?
   - **Recommandation** : `tickAuberge` lit le vault directement (`vault.readFile → parseFarmProfile`) pour avoir une source fraîche, comme `writeProfileFields` fait. Pas de dépendance fragile au state React au boot.

3. **Where exactly to `import type { AubergeState }`**
   - Ce que je sais : `FarmProfileData` actuellement *n'inclut PAS* `auberge_visitors` comme objet structuré — elle stocke la *string* CSV (`auberge_visitors?: string`). Les structures décodées (AubergeState avec `visitors[]: ActiveVisitor[]`) ne sont jamais persistées comme objets ; elles sont rebuilt par `parseAubergeState(csv)` à la demande.
   - Ce qui n'est pas clair : où vit `AubergeState` ? Réponse CONTEXT.md : `lib/mascot/types.ts`. Donc le hook expose `state: AubergeState` rebuilt à chaque render via `useMemo(() => parseAubergeState(profile.auberge_visitors), [profile.auberge_visitors])`.
   - **Recommandation** : pattern useExpeditions identique (`activeExpeditions` est déjà `ActiveExpedition[]` typé dans `FarmProfileData`, mais la sérialisation se fait via `serializeActiveExpeditions`). Phase 43 peut faire pareil : stocker `auberge_visitors?: ActiveVisitor[]` dans `FarmProfileData` (objet décodé), parser/sérialiseur internes. Plus simple côté consommateur.

## Sources

### Primary (HIGH confidence — codebase direct)
- `lib/mascot/building-engine.ts:1-100` — pattern serialize/parse CSV
- `lib/mascot/farm-engine.ts:200-274,310-317` — encodeModifiers escape, weighted random
- `lib/mascot/expedition-engine.ts:570-637` — time-bounded entity, isComplete/getRemaining
- `lib/mascot/gift-engine.ts:1-150` — daily counter, parsePending YAML+JSON fallback
- `lib/mascot/companion-engine.ts:118-191` — `nowMs: number = Date.now()` injectable pattern
- `lib/mascot/types.ts:280-356,510-556` — CropDefinition, BUILDING_CATALOG, FarmCropModifiers
- `lib/mascot/craft-engine.ts:25-32,72-130,751` — BUILDING_RESOURCE_VALUE, CRAFT_RECIPES.sellValue
- `lib/types.ts:627-671` — FarmProfileData shape complète
- `lib/parser.ts:867-1041` — parseFarmProfile / serializeFarmProfile complet
- `hooks/useFarm.ts:1-100,247-267` — writeProfileField/writeProfileFields pattern atomique
- `hooks/useExpeditions.ts:1-80` — pattern hook domaine standalone consommant useVault
- `contexts/VaultContext.tsx:1-37` — wrapper minimal
- `lib/__tests__/expedition-engine.test.ts:1-90` — pattern Jest moteur pur
- `lib/__tests__/wager-engine.test.ts:1-80` — pattern test avec factories `makeProfile`/`makeTask`
- `lib/__tests__/companion-feed.test.ts:38-45` — pattern injection `now`
- `lib/wear-engine.ts:60`, `lib/gamification/engine.ts:304,520`, `lib/quest-engine.ts:257` — pattern UUID `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
- `.planning/STATE.md:259,266,338,367` — décisions architecturales documentées (CSV escape, CACHE_VERSION exclusion farm)
- `.planning/config.json` — `nyquist_validation: false` confirmé

### Secondary
- `CLAUDE.md` — Conventions FR, useThemeColors, vault cache rules

### Tertiary
- N/A (recherche purement codebase, aucune dépendance externe)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — toutes les libs déjà installées et utilisées par 5 engines comparables.
- Architecture: HIGH — patterns expedition/gift/building directement transposables.
- Pitfalls: HIGH — chaque pitfall vu en action dans `STATE.md` (Phase 33 ISO `:`, Phase 38 escape, Phase 30 idempotence).
- CSV format choice (open question): MEDIUM — décision Claude's Discretion, plusieurs solutions viables, le planner devra trancher dans PLAN.md.

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 jours, codebase stable)
