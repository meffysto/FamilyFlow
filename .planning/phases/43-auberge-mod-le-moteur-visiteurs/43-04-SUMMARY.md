---
phase: 43-auberge-mod-le-moteur-visiteurs
plan: 04
subsystem: hooks/auberge
tags: [auberge, hook, react, orchestration, vault, atomic-write]
dependency_graph:
  requires:
    - "Plan 43-01 (types AubergeState/ActiveVisitor + VISITOR_CATALOG)"
    - "Plan 43-02 (4 chaînes opaques auberge_* dans FarmProfileData + parser)"
    - "Plan 43-03 (moteur pur auberge-engine.ts : 12 fonctions API + serialize/parse)"
  provides:
    - "hooks/useAuberge.ts → hook React autonome (deliverVisitor/dismissVisitor/tickAuberge + 5 lectures dérivées)"
  affects:
    - "Phase 44+ (UI Auberge — AubergeSheet/Dashboard) consommera ce hook directement"
tech_stack:
  added: []
  patterns:
    - "Hook autonome consommant useVault() (pattern useExpeditions.ts)"
    - "Atomic write : 1 seul vault.writeFile par mutation côté ferme"
    - "Coin crediting APRÈS persistance ferme (ordering anti-double-crédit)"
    - "Cascade ordinaire→beau→superbe→parfait pour déduction harvest (pattern useExpeditions/useFarm)"
key_files:
  created:
    - "hooks/useAuberge.ts (323 lignes)"
  modified: []
decisions:
  - "Coin crediting APRÈS vault.writeFile farm (ordering plan-checker note #2) — garantit que la livraison est durable avant la récompense ; en cas de retry, un addCoins répété est moins grave qu'un coin crédité sans livraison"
  - "treeStage dérivé via getTreeStageInfo(profile.level) (pas de champ tree_stage dans FarmProfileData) — pattern uniforme avec useExpeditions/useFarm"
  - "AubergeState dérivé pour useMemo lit depuis activeProfile castée Partial<FarmProfileData> — les champs auberge_* ne sont pas mergés sur Profile (volontaire, ferme exclue du cache), mais le snapshot vault est rafraîchi via refreshFarm après chaque setter"
  - "Setters relisent toujours depuis vault.readFile(farmFile) avant mutation (source de vérité), pas depuis le state mémoïsé — évite race conditions si le hook est consommé hors profil actif"
  - "Aucune modification de VaultContext.tsx, hooks/useVault.ts, ni lib/vault-cache.ts (CACHE_VERSION untouched, ferme exclue du cache)"
  - "deductedItems appliqués in-memory sur farmData (FarmInventory direct, HarvestInventory via removeFromGradedInventory cascade, CraftedItem[] via filter) — 1 seul writeFile final atomique"
  - "Imports inutilisés (serializeHarvestInventory/CraftedItems/Inventory) retirés — la mutation in-place de farmData laisse serializeFarmProfile faire le boulot via applyFarmField → serializers internes"
metrics:
  duration: "~10 min"
  completed_date: "2026-04-29"
  tasks: 1
  files: 1
---

# Phase 43 Plan 04 : Hook useAuberge — Summary

**One-liner :** Hook React autonome `hooks/useAuberge.ts` orchestre le moteur pur Phase 43-03 avec la persistance vault Phase 43-02 ; expose lecture mémoïsée + 3 setters atomiques (deliverVisitor / dismissVisitor / tickAuberge) en pattern useExpeditions.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Créer hooks/useAuberge.ts (pattern useExpeditions autonome) | `035a7df` | hooks/useAuberge.ts |

## API publique exposée

```typescript
export function useAuberge(): {
  // Lecture mémoïsée (profil actif)
  visitors: ActiveVisitor[];
  activeVisitors: ActiveVisitor[];
  reputations: VisitorReputation[];
  totalDeliveries: number;
  totalReputation: number;

  // Setters atomiques
  deliverVisitor: (profileId: string, instanceId: string) => Promise<{
    ok: boolean;
    reward?: { coins: number; loot?: string };
    missing?: VisitorRequestItem[];
  }>;
  dismissVisitor: (profileId: string, instanceId: string) => Promise<void>;
  tickAuberge: (profileId: string) => Promise<{
    spawned?: ActiveVisitor;
    expired: ActiveVisitor[];
  }>;
};
```

## API useVault consommée

| Champ | Usage |
|-------|-------|
| `vault` | I/O (readFile/writeFile sur `farm-{id}.md` et `gami-{id}.md`) |
| `profiles` | Lookup nom du profil (`profiles.find(p => p.id === profileId)?.name`) + `level` pour `getTreeStageInfo` |
| `activeProfile` | Source du state Auberge dérivé pour la lecture mémoïsée |
| `refreshFarm(profileId)` | Invalidation après writeFile ferme |
| `refreshGamification()` | Invalidation après addCoins (deliverVisitor uniquement) |

**Aucun champ ajouté à VaultState — pas de modification de VaultContext.tsx ni hooks/useVault.ts.**

## Mode de crédit coins retenu

**Choix : addCoins inline copié du pattern useExpeditions** (pas d'import de useGamification, qui aurait introduit une dépendance circulaire potentielle hooks→hooks).

**Ordering verrouillé (note plan-checker #2) :**
1. `vault.readFile(farm-{id}.md)` → `parseFarmProfile`
2. `parseAuberge` → `engineDeliver` (moteur pur retourne `state'`, `deductedItems`, `reward`)
3. Application de `deductedItems` sur `FarmInventory`/`HarvestInventory`/`CraftedItem[]` (mutation in-memory)
4. `applyAubergeToFarmData` → écrit les 4 champs `auberge_*` dans `farmData`
5. **`vault.writeFile(farm-{id}.md, serializeFarmProfile(...))` ← persistance ferme atomique**
6. **`addCoins(profileId, reward.coins, note)` ← crédit gami SÉPARÉ et postérieur**
7. `refreshFarm` + `refreshGamification`

**Garantie :** si le step 6 échoue (retry réseau iCloud, etc.), la livraison est déjà persistée — un retry du setter retournera `{ ok: false, missing }` car le visiteur est passé `delivered` côté state. Pire cas : coin manquant mais visiteur livré (acceptable, le coin peut être re-crédité manuellement). À l'inverse, créditer avant write pourrait double-créditer si l'utilisateur retry après crash post-credit / pre-write.

## Confirmation Phase 43 shippable end-to-end

| Brique | Plan | Status |
|--------|------|--------|
| Types (AubergeState, ActiveVisitor, VisitorReputation, VisitorRequestItem) | 43-01 | shipped |
| Catalogue 6 PNJ (VISITOR_CATALOG) | 43-01 | shipped |
| 4 chaînes opaques `auberge_*` dans FarmProfileData + parser/serializer | 43-02 | shipped |
| Moteur pur (12 fonctions API + serializeAuberge/parseAuberge + estimatedSellValue) | 43-03 | shipped |
| Tests Jest moteur (45 tests) | 43-03 | shipped (45/45 verts) |
| Hook React `useAuberge` (orchestrateur) | 43-04 | shipped |

**Verdict :** Phase 43 livre les fondations complètes invisibles. Tout est compilable, testé, prêt pour la phase UI.

## Pointeurs Phase 44 (UI)

- **Câblage tickAuberge cascade boot/launch :** appeler `tickAuberge(activeProfile.id)` dans le `useEffect` de bootstrap de `app/_layout.tsx` ou dans la cascade existante de `tree.tsx` (où `collectPassiveIncome` est déjà appelé). Le hook expose la méthode mais ne l'invoque pas — décision UI.
- **Câblage tickAuberge sur cascade tâche complétée :** voir Phase 39 patterns (subscribeTaskComplete dans VaultState) si l'on veut un spawn potentiel à chaque tâche cochée.
- **Carte dashboard Auberge :** consommer `activeVisitors`, `totalReputation` depuis le hook ; un visiteur visible = `getRemainingMinutes` côté composant pour l'affichage countdown.
- **Modal AubergeSheet :** boutons → `deliverVisitor` (return `{ ok, reward, missing }` pour toast/feedback) et `dismissVisitor` (silent).
- **Reputation visualization :** `reputations.find(r => r.visitorId === id)?.level` pour les jauges 0-5.
- **Construction bâtiment Auberge dans BUILDING_CATALOG :** prérequis Phase 44 (moteur Auberge n'est gating qu'au stade arbre `pousse+` via `CAP_BY_STAGE`, pas un bâtiment construit — choix design Phase 43-CONTEXT).

## Deviations from Plan

**1. [Rule 3 - Blocker] Imports retirés (serializeHarvestInventory/CraftedItems/Inventory)**
- **Found during:** Task 1 (post-write)
- **Issue:** Initialement importés "au cas où" pour la déduction inventaire
- **Fix:** Retirés — la mutation in-place de `farmData.farmInventory/harvestInventory/craftedItems` puis `serializeFarmProfile` (qui dispatche via `applyFarmField` interne au parser) fait le travail. Aucune sérialisation manuelle nécessaire dans le hook.
- **Files modified:** hooks/useAuberge.ts
- **Commit:** `035a7df` (intégré dans le commit Task 1)

**Aucune autre déviation.** Plan exécuté tel qu'écrit.

## Plan-Checker Notes Addressed

| # | Note | Résolution |
|---|------|------------|
| 1 | useVault() API & profile shape — confirmer pattern useExpeditions | Lu intégralement useExpeditions.ts ; consommé `vault, profiles, activeProfile, refreshFarm, refreshGamification` ; aucune modif VaultContext.tsx ni useVault.ts |
| 2 | Coin crediting ordering — addCoins APRÈS writeFile farm | Implémenté ligne par ligne dans deliverVisitor (cf. section "Mode de crédit coins retenu") |
| 3 | tree_stage field name | Pas de `tree_stage` dans FarmProfileData → utilisation de `profile.level` + `getTreeStageInfo(level).stage` (pattern uniforme avec useExpeditions/useFarm) |
| 4 | Atomic write — 1 writeFile pour farm-side state | deliverVisitor : 1 writeFile farm + 1 writeFile gami séparé. dismissVisitor/tickAuberge : 1 writeFile farm seul |
| 5 | tickAuberge — expire puis spawn, pas d'invocation auto | Implémenté ; aucune wiring boot/launch en Phase 43 |
| 6 | AubergeState derivation — useMemo via parseAuberge | Implémenté ligne 79 (cast Partial<FarmProfileData> car auberge_* non mergés sur Profile, volontaire) |
| 7 | No tests for the hook in this phase | OK — pas de tests créés |

## Verification

- `npx tsc --noEmit` : **0 erreur** (baseline 0, post-plan 0)
- `npx jest --no-coverage lib/__tests__/auberge-engine.test.ts` : **45/45 verts** (Plan 03 toujours sain)
- `git diff --name-only contexts/VaultContext.tsx hooks/useVault.ts lib/vault-cache.ts` : **vide** (aucun fichier critique modifié)
- `hooks/useAuberge.ts` exporte `useAuberge` avec 5 lectures + 3 setters (grep confirmé)

## Self-Check: PASSED

- [x] `hooks/useAuberge.ts` créé : FOUND (`export function useAuberge` détecté)
- [x] Commit `035a7df` (Task 1) : FOUND dans git log
- [x] tsc clean (0 erreur, baseline 0)
- [x] Jest auberge-engine 45/45 verts
- [x] VaultContext.tsx UNTOUCHED (git diff vide)
- [x] useVault.ts UNTOUCHED (git diff vide)
- [x] CACHE_VERSION UNTOUCHED (lib/vault-cache.ts:41 inchangé)
