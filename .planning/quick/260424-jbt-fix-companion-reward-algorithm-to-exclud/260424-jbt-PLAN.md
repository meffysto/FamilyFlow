---
phase: quick-260424-jbt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/gamification/engine.ts
autonomous: true
requirements:
  - QUICK-260424-jbt-01
must_haves:
  truths:
    - "Un compagnon déjà débloqué (présent dans profile.companion.unlockedSpecies) n'est jamais proposé comme récompense de loot box"
    - "Si la récompense initiale tirée est un compagnon déjà possédé, une autre récompense de la même rareté est retirée à la place"
    - "Si TOUTES les récompenses d'une rareté sont des items déjà possédés (compagnons + mascot_deco + mascot_hab), un fallback points/reward générique est utilisé sans crash"
    - "La mécanique s'applique à openLootBox() ET openAgentSecretLootBox() (agent secret)"
  artifacts:
    - path: "lib/gamification/engine.ts"
      provides: "Filtre owned companions dans la re-draw logic des 2 fonctions openLootBox"
      contains: "rewardType === 'companion'"
  key_links:
    - from: "lib/gamification/engine.ts:openLootBox"
      to: "profile.companion.unlockedSpecies"
      via: "check rewardDef.rewardType === 'companion' && unlockedSpecies.includes(mascotItemId)"
      pattern: "companion.*unlockedSpecies"
---

<objective>
Fix le bug où les compagnons déjà débloqués (chat, chien, lapin, renard, hérisson) peuvent être re-proposés comme récompense de loot box.

Purpose: Un compagnon gagné devient l'activeSpecies, mais reste listé dans unlockedSpecies. Aujourd'hui, openLootBox() ne filtre que les items `mascot_deco` et `mascot_hab` via `profile.mascotDecorations`/`profile.mascotInhabitants`, mais PAS les items de type `companion` (qui se vérifient via `profile.companion.unlockedSpecies`). Résultat : un utilisateur peut tomber plusieurs fois sur "Compagnon Chat !" alors qu'il l'a déjà.

Output: Logique de re-draw étendue pour couvrir `rewardType === 'companion'` dans `openLootBox()` ET `openAgentSecretLootBox()`, avec fallback robuste si tous les items de la rareté sont possédés.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@lib/gamification/engine.ts
@lib/gamification/rewards.ts
@lib/mascot/companion-types.ts

<interfaces>
<!-- Key types the executor needs - already extracted, no exploration needed -->

From lib/mascot/companion-types.ts:
```typescript
export type CompanionSpecies = 'chat' | 'chien' | 'lapin' | 'renard' | 'herisson';

export interface CompanionData {
  activeSpecies: CompanionSpecies;
  name: string;
  unlockedSpecies: CompanionSpecies[];  // ← source de vérité des compagnons possédés
  lastEventType?: string;
  lastEventAt?: string;
  lastFedAt?: string;
  feedBuff?: FeedBuff | null;
}
```

From lib/types.ts:
```typescript
// Profile.companion: import('./mascot/companion-types').CompanionData | null;
```

From lib/gamification/rewards.ts (REWARDS pool, companion entries):
```typescript
// rare:
{ emoji: '🐱', rewardType: 'companion', mascotItemId: 'chat' },
{ emoji: '🐶', rewardType: 'companion', mascotItemId: 'chien' },
{ emoji: '🐰', rewardType: 'companion', mascotItemId: 'lapin' },
// épique:
{ emoji: '🦊', rewardType: 'companion', mascotItemId: 'renard' },
{ emoji: '🦔', rewardType: 'companion', mascotItemId: 'herisson' },
```

Current buggy logic — lib/gamification/engine.ts lines 199-208 (openLootBox):
```typescript
if (rewardDef.mascotItemId) {
  const owned = rewardDef.rewardType === 'mascot_deco'
    ? profile.mascotDecorations
    : profile.mascotInhabitants;  // ← BUG: companion tombe dans ce else et check la mauvaise liste
  if (owned.includes(rewardDef.mascotItemId)) {
    const nonMascot = REWARDS[rarity].filter((r) => !r.mascotItemId);
    rewardDef = nonMascot[Math.floor(Math.random() * nonMascot.length)];
  }
}
```

Note : `openAgentSecretLootBox` (ligne 434) n'a AUCUN filtre owned — à ajouter aussi.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Filtrer compagnons déjà possédés dans openLootBox + openAgentSecretLootBox</name>
  <files>lib/gamification/engine.ts</files>
  <behavior>
    - Si rewardDef.rewardType === 'companion' et profile.companion?.unlockedSpecies inclut rewardDef.mascotItemId → re-draw
    - Si rewardDef.rewardType === 'mascot_deco' et profile.mascotDecorations inclut mascotItemId → re-draw (préserver comportement actuel)
    - Si rewardDef.rewardType === 'mascot_hab' et profile.mascotInhabitants inclut mascotItemId → re-draw (préserver comportement actuel)
    - Le pool de re-draw filtré exclut tous les items déjà possédés (tous types confondus), pas seulement "non-mascot"
    - Fallback si pool filtré vide : prendre une récompense de type 'points' ou 'reward' de la rareté (jamais crash, jamais re-proposer un owned item)
    - openAgentSecretLootBox : appliquer la même logique de filtrage owned
  </behavior>
  <action>
    1. Dans `lib/gamification/engine.ts`, extraire une fonction helper pure au-dessus de `openLootBox()` :

    ```typescript
    /** Vérifie si une récompense correspond à un item déjà possédé par le profil */
    function isRewardAlreadyOwned(reward: RewardDefinition, profile: Profile): boolean {
      if (!reward.mascotItemId) return false;
      if (reward.rewardType === 'companion') {
        const unlocked = profile.companion?.unlockedSpecies ?? [];
        return unlocked.includes(reward.mascotItemId as any);
      }
      if (reward.rewardType === 'mascot_deco') {
        return profile.mascotDecorations.includes(reward.mascotItemId);
      }
      if (reward.rewardType === 'mascot_hab') {
        return profile.mascotInhabitants.includes(reward.mascotItemId);
      }
      return false;
    }

    /** Tire une récompense de la rareté en évitant les items déjà possédés.
     * Fallback: si tout le pool est possédé, retourne une récompense points/reward (jamais crash). */
    function drawRewardExcludingOwned(
      pool: RewardDefinition[],
      profile: Profile
    ): RewardDefinition {
      const available = pool.filter((r) => !isRewardAlreadyOwned(r, profile));
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      }
      // Fallback : tous possédés → retirer sans mascotItemId (points/reward/badge génériques)
      const generic = pool.filter((r) => !r.mascotItemId);
      if (generic.length > 0) {
        return generic[Math.floor(Math.random() * generic.length)];
      }
      // Ultime fallback : premier item du pool (ne devrait jamais arriver)
      return pool[0];
    }
    ```

    2. Dans `openLootBox()` (ligne ~197), remplacer le bloc actuel lignes 199-208 :

    ```typescript
    // AVANT (buggy) :
    let rewardDef: RewardDefinition = seasonalDraw
      ? seasonalDraw.reward
      : REWARDS[rarity][Math.floor(Math.random() * REWARDS[rarity].length)];

    if (rewardDef.mascotItemId) {
      const owned = rewardDef.rewardType === 'mascot_deco'
        ? profile.mascotDecorations
        : profile.mascotInhabitants;
      if (owned.includes(rewardDef.mascotItemId)) {
        const nonMascot = REWARDS[rarity].filter((r) => !r.mascotItemId);
        rewardDef = nonMascot[Math.floor(Math.random() * nonMascot.length)];
      }
    }

    // APRÈS (corrigé) :
    let rewardDef: RewardDefinition = seasonalDraw
      ? seasonalDraw.reward
      : drawRewardExcludingOwned(REWARDS[rarity], profile);

    // Si seasonal draw propose un item déjà possédé, re-draw depuis le pool normal
    if (seasonalDraw && isRewardAlreadyOwned(rewardDef, profile)) {
      rewardDef = drawRewardExcludingOwned(REWARDS[rarity], profile);
    }
    ```

    3. Dans `openAgentSecretLootBox()` (ligne ~434), remplacer :

    ```typescript
    // AVANT :
    const rewardDef: RewardDefinition = REWARDS[rarity][Math.floor(Math.random() * REWARDS[rarity].length)];

    // APRÈS :
    const rewardDef: RewardDefinition = drawRewardExcludingOwned(REWARDS[rarity], profile);
    ```

    4. Commentaire en FR au-dessus du helper expliquant le bug fix (référence les 3 rewardTypes concernés : companion, mascot_deco, mascot_hab).

    5. Attention : `profile.companion` peut être `null` (pas d'opérateur `?.unlockedSpecies ?? []` requis). Cast `as any` sur `CompanionSpecies` accepté car `mascotItemId` est typé `string`.
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault.ts" | grep "error TS" | head -10 ; echo "---exit---"</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` ne remonte aucune NOUVELLE erreur dans `lib/gamification/engine.ts` (les erreurs pré-existantes MemoryEditor/cooklang/useVault sont à ignorer per CLAUDE.md)
    - `isRewardAlreadyOwned()` et `drawRewardExcludingOwned()` définis dans engine.ts
    - Les 3 rewardTypes `companion`, `mascot_deco`, `mascot_hab` sont tous filtrés via `profile.companion?.unlockedSpecies`, `profile.mascotDecorations`, `profile.mascotInhabitants` respectivement
    - `openLootBox()` et `openAgentSecretLootBox()` utilisent tous deux `drawRewardExcludingOwned()`
    - Fallback points/reward en cas de pool entièrement possédé (jamais crash, jamais double compagnon)
  </done>
</task>

</tasks>

<verification>
Grep final pour confirmer le fix :

```bash
rtk grep "unlockedSpecies" /Users/gabrielwaltio/Documents/family-vault/lib/gamification/engine.ts
# Doit matcher au moins 1 ligne dans isRewardAlreadyOwned

rtk grep "drawRewardExcludingOwned" /Users/gabrielwaltio/Documents/family-vault/lib/gamification/engine.ts
# Doit matcher : 1 définition + 2 appels (openLootBox, openAgentSecretLootBox) + éventuel re-draw seasonal
```

Smoke test manuel (optionnel) : dans l'app, avec un profil ayant déjà chat+chien+lapin dans unlockedSpecies, ouvrir des loot boxes rares plusieurs fois → ne doit jamais proposer "Compagnon Chat/Chien/Lapin" à nouveau.
</verification>

<success_criteria>
- [ ] TypeScript compile sans nouvelle erreur dans engine.ts
- [ ] Helper `isRewardAlreadyOwned()` gère les 3 rewardTypes (companion, mascot_deco, mascot_hab)
- [ ] Helper `drawRewardExcludingOwned()` a un fallback sûr (jamais crash)
- [ ] `openLootBox()` et `openAgentSecretLootBox()` utilisent le helper
- [ ] Les compagnons déjà dans `profile.companion.unlockedSpecies` ne sont plus proposés
- [ ] Le seasonal draw est aussi protégé contre les doublons compagnons
</success_criteria>

<output>
Après completion, créer `.planning/quick/260424-jbt-fix-companion-reward-algorithm-to-exclud/260424-jbt-SUMMARY.md` résumant le fix.
</output>
