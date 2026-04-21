---
phase: 260421-obd-phase-b-grades
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mascot/grade-engine.ts
  - lib/mascot/types.ts
  - lib/mascot/craft-engine.ts
  - lib/parser.ts
  - lib/vault-cache.ts
  - lib/village/market-engine.ts
  - hooks/useFarm.ts
  - hooks/useGarden.ts
  - components/mascot/CraftSheet.tsx
  - components/village/MarketSheet.tsx
  - app/(tabs)/tree.tsx
  - locales/fr/common.json
  - locales/en/common.json
  - lib/__tests__/grade-inventory.test.ts
  - lib/__tests__/craft-grade.test.ts
  - lib/__tests__/market-grade.test.ts
autonomous: true
requirements:
  - GRADE-B-01  # Format inventaire par grade (HarvestInventoryEntry itemId+grade+qty) + parser/serializer + compat ascendante (items legacy → 'ordinaire')
  - GRADE-B-02  # Helpers grade-engine : getWeakestGrade, gradeSellMultiplier, addToGradedInventory, removeFromGradedInventory
  - GRADE-B-03  # Harvest remplace bonus coins immédiat par add inventory[grade] (statu quo strict sans tech culture-5)
  - GRADE-B-04  # CraftSheet : picker grade maillon-faible + preview valeur + default min + grisage qty insuffisante
  - GRADE-B-05  # CraftedItem.grade + sellValue × gradeMultiplier
  - GRADE-B-06  # MarketSheet : prix vente par grade avec multiplicateur + achat = grade 'ordinaire' systématique
  - GRADE-B-07  # Bump CACHE_VERSION (shape HarvestInventory change)
  - GRADE-B-08  # Tests Jest : grade-inventory, craft-grade maillon-faible, market-grade multiplier
  - GRADE-B-09  # i18n FR/EN pour étiquettes picker + preview + erreurs craft

must_haves:
  truths:
    - "Les items récoltés sont stockés par combinaison itemId+grade dans harvestInventory ({ itemId, grade, qty }) — une entrée par couple."
    - "Les items récoltés AVANT Phase B (format legacy 'cropId:qty') sont parsés avec grade='ordinaire' au premier boot post-migration — aucune donnée perdue."
    - "Sans tech culture-5 : chaque récolte ajoute l'item avec grade='ordinaire' — statu quo strict (zéro roll, zéro coins bonus immédiat)."
    - "Avec tech culture-5 : chaque récolte roll un grade (Ordinaire 70 / Beau 20 / Superbe 8 / Parfait 2) et AJOUTE à inventory[grade] — PLUS de bonus coins immédiat (le gain se matérialise à la vente ou au craft)."
    - "CraftSheet affiche un bouton compact '[ Grade : ⚪ Ordinaire ▾ ]' au-dessus du sélecteur de quantité ; tap expand inline les grades dispo avec leurs qty ; grades grisés si qty < recette × multiplicateur ; bouton masqué si un seul grade possédé."
    - "Le grade produit par un craft = min des grades des ingrédients (règle maillon faible) ; default sélection = grade le plus bas possédé permettant le craft."
    - "CraftedItem contient .grade ; sa sellValue effective = recipe.sellValue × gradeSellMultiplier(grade) (×1 / ×1.5 / ×2.5 / ×4)."
    - "MarketSheet affiche le prix vente par grade pour chaque item possédé ; vente d'un item grade G crédite getSellPrice(def, stock) × gradeSellMultiplier(G)."
    - "Un achat marché ajoute toujours l'item avec grade='ordinaire' — pas de triche via buy/sell."
    - "CACHE_VERSION bumpé (shape harvestInventory change) — cache rejeté au premier boot post-migration, reload frais depuis vault."
    - "npx tsc --noEmit clean ; npx jest lib/__tests__/grade-inventory.test.ts lib/__tests__/craft-grade.test.ts lib/__tests__/market-grade.test.ts passe."
    - "Phase A reste fonctionnelle : tech culture-5 + rollHarvestGrade + badge grade dans HarvestCardToast conservés ; seul le bonus coins IMMÉDIAT à harvest est supprimé."
  artifacts:
    - path: "lib/mascot/grade-engine.ts"
      provides: "Étendu avec GRADE_ORDER, getWeakestGrade(grades), gradeSellMultiplier=getGradeMultiplier (alias), addToGradedInventory, removeFromGradedInventory, countItemByGrade"
    - path: "lib/mascot/types.ts"
      provides: "HarvestInventory redéfini en Record<cropId, Record<HarvestGrade, number>> ; CraftedItem.grade?: HarvestGrade"
    - path: "lib/mascot/craft-engine.ts"
      provides: "serializeHarvestInventory + parseHarvestInventory en format graded (cropId:grade:qty) avec compat ascendante legacy ; serializeCraftedItems + parseCraftedItems étendus avec grade optionnel"
    - path: "lib/__tests__/grade-inventory.test.ts"
      provides: "Tests : add/remove lignes itemId+grade, fusion qty par combinaison, parse legacy → 'ordinaire', round-trip CSV, compat ascendante stricte"
    - path: "lib/__tests__/craft-grade.test.ts"
      provides: "Tests : getWeakestGrade ordinaire<beau<superbe<parfait, default = min grade possédé, grisage qty insuffisante, grade output = min ingrédients"
    - path: "lib/__tests__/market-grade.test.ts"
      provides: "Tests : prix vente × multiplier exact, achat toujours grade='ordinaire', plusieurs grades = plusieurs lignes UI"
    - path: "components/mascot/CraftSheet.tsx"
      provides: "Picker de grade inline (compact + expand), preview grade output + sellValue, grisage grades non-craftables"
    - path: "components/village/MarketSheet.tsx"
      provides: "Colonne vente éclatée par grade possédé, prix × multiplier"
    - path: "lib/vault-cache.ts"
      provides: "CACHE_VERSION bumpé de 5 → 6"
  key_links:
    - from: "hooks/useFarm.ts:harvest"
      to: "lib/mascot/grade-engine.ts:addToGradedInventory"
      via: "remplace updatedHarvestInv[cropId] += finalQty par addToGradedInventory(inv, cropId, grade ?? 'ordinaire', finalQty) ; SUPPRIME le addCoins bonus (Phase A)"
      pattern: "addToGradedInventory\\("
    - from: "components/mascot/CraftSheet.tsx"
      to: "lib/mascot/grade-engine.ts:getWeakestGrade"
      via: "preview grade output + validation craftable (ingredient.qty par grade >= required)"
      pattern: "getWeakestGrade\\("
    - from: "hooks/useGarden.ts:sellItem"
      to: "lib/mascot/grade-engine.ts:gradeSellMultiplier"
      via: "crédit = getSellPrice(def, stock) × gradeSellMultiplier(grade) × quantity"
      pattern: "gradeSellMultiplier|getGradeMultiplier"
    - from: "lib/parser.ts"
      to: "lib/mascot/craft-engine.ts:parseHarvestInventory"
      via: "format CSV étendu cropId:grade:qty (legacy cropId:qty toléré → grade='ordinaire')"
      pattern: "parseHarvestInventory|serializeHarvestInventory"
---

<objective>
Phase B des grades de récolte : transformer le système Phase A (roll + bonus coins immédiat) en véritable économie par grade via inventaire stocké par combinaison itemId+grade, craft utilisant la règle du maillon faible, et vente marché avec multiplicateur appliqué au prix.

Purpose : Concrétiser la valeur des grades au bon moment (vente/craft) au lieu d'un bonus instantané. Crée une boucle stratégique : récolter → stocker par grade → décider quand craft/vendre → optimiser ratio qualité/rareté.

Output : HarvestInventory multi-grade + CraftedItem.grade + UI picker CraftSheet + multiplicateur vente MarketSheet + 3 suites Jest + CACHE_VERSION bumpé + compat ascendante stricte.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/quick/260421-nvj-phase-a-grades-de-r-colte-tech-culture-5/260421-nvj-SUMMARY.md
@lib/mascot/grade-engine.ts
@lib/mascot/types.ts
@lib/mascot/craft-engine.ts
@lib/mascot/farm-engine.ts
@lib/parser.ts
@lib/vault-cache.ts
@lib/village/market-engine.ts
@hooks/useFarm.ts
@hooks/useGarden.ts
@components/mascot/CraftSheet.tsx
@components/village/MarketSheet.tsx
@app/(tabs)/tree.tsx
@contexts/ToastContext.tsx

<interfaces>
<!-- Contrats clés à respecter — extraits du codebase, ne pas re-explorer -->

From lib/mascot/grade-engine.ts (Phase A, étendu par Phase B) :
```typescript
export type HarvestGrade = 'ordinaire' | 'beau' | 'superbe' | 'parfait';
export const GRADE_MULTIPLIERS: Record<HarvestGrade, number>; // ×1/×1.5/×2.5/×4
export function rollHarvestGrade(rng?: () => number): HarvestGrade;
export function getGradeMultiplier(grade: HarvestGrade): number;
export function getGradeEmoji(grade: HarvestGrade): string;
export function getGradeLabelKey(grade: HarvestGrade): string;
// À AJOUTER Phase B :
export const GRADE_ORDER: HarvestGrade[]; // ['ordinaire','beau','superbe','parfait']
export function compareGrades(a: HarvestGrade, b: HarvestGrade): number;
export function getWeakestGrade(grades: HarvestGrade[]): HarvestGrade; // min
export function gradeSellMultiplier(grade: HarvestGrade): number; // = getGradeMultiplier (alias sémantique)
```

From lib/mascot/types.ts (BREAKING — shape change) :
```typescript
// AVANT :
export interface HarvestInventory { [cropId: string]: number; }
// APRÈS :
export type HarvestInventory = {
  [cropId: string]: Partial<Record<HarvestGrade, number>>; // ex: { tomato: { ordinaire: 8, beau: 3, parfait: 1 } }
};
// CraftedItem étendu :
export interface CraftedItem {
  recipeId: string;
  craftedAt: string;
  isGolden?: boolean;
  grade?: HarvestGrade; // NOUVEAU — undefined parsé legacy → traité comme 'ordinaire' par les consommateurs
}
```

From lib/mascot/craft-engine.ts — parseHarvestInventory/serializeHarvestInventory à étendre :
```typescript
// NOUVEAU format CSV : "tomato:ordinaire:8,tomato:beau:3,wheat:ordinaire:5"
// Compat ascendante : une entrée "cropId:qty" (2 parts, qty numérique) → { [cropId]: { ordinaire: qty } }
//                     une entrée "cropId:grade:qty" (3 parts, grade ∈ HarvestGrade) → { [cropId]: { [grade]: qty } }
// Fusion : même cropId+grade additionne les qty (resilience vault pollué)

// CraftedItem CSV : "confiture:2024-01-01:beau,gateau:2024-02-01" (grade optionnel en 3e position)
```

From hooks/useFarm.ts:harvest (à modifier — lignes ~332-453) :
```typescript
// AVANT Phase B (= Phase A) :
updatedHarvestInv[result.harvestedCropId] = (updatedHarvestInv[result.harvestedCropId] ?? 0) + finalQty;
// ...
if (gradeBonusCoins > 0 && grade) {
  await addCoins(profileId, gradeBonusCoins, `✨ Récolte grade ${grade} ×...`);
}

// APRÈS Phase B :
const finalGrade: HarvestGrade = grade ?? 'ordinaire'; // sans tech → ordinaire
addToGradedInventory(updatedHarvestInv, result.harvestedCropId, finalGrade, finalQty);
// SUPPRIMER les 2 appels addCoins bonus (golden + standard) — gradeBonusCoins n'est plus crédité
// Le retour conserve grade + gradeBonusCoins (tree.tsx peut toujours afficher le badge toast informatif
// OU passer à 0 ; décision : garder le badge grade mais gradeBonusCoins = 0 — le toast montre juste la qualité).
// → Simplification : retourner { grade, qty } ; ne plus calculer gradeBonusCoins.
```

From hooks/useGarden.ts:sellItem (à modifier — lignes ~620-720) :
```typescript
// Ajouter un paramètre grade: HarvestGrade à la signature
// profileItemCount pour category==='harvest' = inv[itemId]?.[grade] ?? 0
// totalGain = getSellPrice(def, stock) * quantity * gradeSellMultiplier(grade)
// Décrément : harvestInv[itemId][grade] -= quantity
// MarketSheet appelle sellItem(itemId, quantity, profileId, grade)
```

From lib/village/market-engine.ts:canSellItem/executeSell (à étendre) :
```typescript
export function canSellItem(
  itemId: string,
  quantity: number,
  marketStock: MarketStock,
  profileItemCount: number,
  grade?: HarvestGrade, // NOUVEAU — optionnel, défaut 'ordinaire'
): { canSell: boolean; totalGain: number; reason?: string };
// totalGain intègre le multiplicateur grade

// executeSell : idem ; la transaction log enregistre le grade pour traçabilité
```

From components/mascot/CraftSheet.tsx (CraftSheet existant) :
- Doit afficher pour chaque ingrédient les qty par grade possédées
- Picker compact avant le sélecteur quantité : bouton tap → expand inline grades dispo
- Grade choisi par ingrédient persisté en state local (Record<cropId, HarvestGrade>)
- Validation craftable : pour chaque ingrédient, inv[itemId]?.[selectedGrade] >= required × multiplier
- Preview : grade output = getWeakestGrade(Object.values(selection)) + sellValue × gradeSellMultiplier
- Default : pour chaque ingrédient, premier grade possédé en ordre GRADE_ORDER (le plus bas)
- Picker masqué si un seul grade possédé pour tous les ingrédients

From lib/vault-cache.ts:41 :
```typescript
const CACHE_VERSION = 5; // Phase A — inchangé
// Phase B : bump à 6 (HarvestInventory shape change)
```

From app/(tabs)/tree.tsx:handleCropCellPress (le toast grade reste affichable) :
- Le showHarvestCard reçoit toujours grade depuis harvest() retour
- Le badge toast reste (retour visuel de la qualité) mais sans mention "+X 🍃"
- Adapter HarvestCardToast : `grade: { key, emoji }` (sans bonusCoins) OU garder le champ mais passer 0
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 : Étendre grade-engine + types.ts + craft-engine parser/serializer + tests grade-inventory (TDD)</name>
  <files>lib/mascot/grade-engine.ts, lib/mascot/types.ts, lib/mascot/craft-engine.ts, lib/parser.ts, lib/vault-cache.ts, lib/__tests__/grade-inventory.test.ts</files>
  <behavior>
    Tests à écrire AVANT implémentation (RED → GREEN) dans `lib/__tests__/grade-inventory.test.ts` :

    **compareGrades / getWeakestGrade :**
    - compareGrades('ordinaire','beau') < 0, compareGrades('parfait','superbe') > 0, compareGrades('beau','beau') === 0
    - getWeakestGrade(['beau','superbe','parfait']) === 'beau'
    - getWeakestGrade(['ordinaire']) === 'ordinaire'
    - getWeakestGrade([]) throw OU fallback 'ordinaire' (décider : fallback 'ordinaire')
    - GRADE_ORDER = ['ordinaire','beau','superbe','parfait'] (assert exact)

    **gradeSellMultiplier :**
    - gradeSellMultiplier('ordinaire') === 1
    - gradeSellMultiplier('parfait') === 4
    - Alias de getGradeMultiplier (référence fonction identique OU test `expect(gradeSellMultiplier).toBe(getGradeMultiplier)` inapplicable si wrapper — vérifier valeurs suffit)

    **addToGradedInventory / removeFromGradedInventory :**
    - addToGradedInventory({}, 'tomato', 'beau', 3) mute l'inv → { tomato: { beau: 3 } }
    - addToGradedInventory({ tomato: { beau: 2 } }, 'tomato', 'beau', 3) → { tomato: { beau: 5 } }
    - addToGradedInventory({ tomato: { beau: 2 } }, 'tomato', 'ordinaire', 1) → { tomato: { beau: 2, ordinaire: 1 } }
    - removeFromGradedInventory({ tomato: { beau: 5 } }, 'tomato', 'beau', 3) → { tomato: { beau: 2 } }
    - removeFromGradedInventory({ tomato: { beau: 2 } }, 'tomato', 'beau', 5) → { tomato: { beau: 0 } } (floor 0, pas négatif)
    - removeFromGradedInventory clean entries qty=0 ? Décision : laisser 0 (évite churn objet), mais serializer filtre qty>0 (déjà le pattern existant)

    **countItemByGrade :**
    - countItemByGrade(inv, 'tomato', 'beau') === inv.tomato?.beau ?? 0

    **Parser/serializer compat ascendante :**
    - parseHarvestInventory('tomato:5') → { tomato: { ordinaire: 5 } } (format legacy 2-parts numérique)
    - parseHarvestInventory('tomato:beau:3') → { tomato: { beau: 3 } } (format Phase B)
    - parseHarvestInventory('tomato:5,wheat:beau:2') → MIX toléré : { tomato: { ordinaire: 5 }, wheat: { beau: 2 } }
    - parseHarvestInventory('tomato:beau:3,tomato:beau:2') → fusion : { tomato: { beau: 5 } }
    - parseHarvestInventory('') → {}
    - parseHarvestInventory(undefined) → {}
    - parseHarvestInventory('tomato:unknown:3') → entrée ignorée (grade invalide) OU fallback 'ordinaire' — décision : fallback 'ordinaire' (résilience)
    - serializeHarvestInventory({ tomato: { ordinaire: 8, beau: 3 } }) → 'tomato:ordinaire:8,tomato:beau:3' (ordre GRADE_ORDER pour déterminisme)
    - serializeHarvestInventory({ tomato: { beau: 0, parfait: 2 } }) → 'tomato:parfait:2' (filtre qty=0)
    - Round-trip : parse(serialize(inv)) === inv (à qty>0 filtré près)

    **CraftedItem :**
    - parseCraftedItems('confiture:2024-01-01:beau') → [{ recipeId:'confiture', craftedAt:'2024-01-01', grade:'beau' }]
    - parseCraftedItems('confiture:2024-01-01') → [{ recipeId:'confiture', craftedAt:'2024-01-01' }] (legacy, grade undefined)
    - Round-trip preserve grade quand présent, absent quand undefined
  </behavior>
  <action>
    1. **Étendre `lib/mascot/grade-engine.ts`** (ne pas casser l'existant Phase A) :
       ```typescript
       /** Ordre croissant des grades — source de vérité unique pour comparaisons */
       export const GRADE_ORDER: HarvestGrade[] = ['ordinaire', 'beau', 'superbe', 'parfait'];

       /** Comparaison : négatif si a < b, positif si a > b, 0 si égaux */
       export function compareGrades(a: HarvestGrade, b: HarvestGrade): number {
         return GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b);
       }

       /** Grade le plus faible d'une liste (règle maillon faible). Fallback 'ordinaire' si liste vide. */
       export function getWeakestGrade(grades: HarvestGrade[]): HarvestGrade {
         if (grades.length === 0) return 'ordinaire';
         return grades.reduce((min, g) => compareGrades(g, min) < 0 ? g : min, grades[0]);
       }

       /** Alias sémantique : multiplicateur appliqué au prix de vente marché */
       export const gradeSellMultiplier = getGradeMultiplier;

       /** Ajoute qty à inventory[itemId][grade] (mutation in-place). */
       export function addToGradedInventory(
         inv: HarvestInventory,
         itemId: string,
         grade: HarvestGrade,
         qty: number,
       ): HarvestInventory {
         if (qty <= 0) return inv;
         if (!inv[itemId]) inv[itemId] = {};
         inv[itemId]![grade] = (inv[itemId]![grade] ?? 0) + qty;
         return inv;
       }

       /** Retire qty de inventory[itemId][grade] (floor 0). */
       export function removeFromGradedInventory(
         inv: HarvestInventory,
         itemId: string,
         grade: HarvestGrade,
         qty: number,
       ): HarvestInventory {
         if (qty <= 0 || !inv[itemId]) return inv;
         const current = inv[itemId]![grade] ?? 0;
         inv[itemId]![grade] = Math.max(0, current - qty);
         return inv;
       }

       /** Lit la qty d'un itemId pour un grade donné. */
       export function countItemByGrade(
         inv: HarvestInventory,
         itemId: string,
         grade: HarvestGrade,
       ): number {
         return inv[itemId]?.[grade] ?? 0;
       }
       ```

    2. **Modifier `lib/mascot/types.ts`** :
       - Remplacer `HarvestInventory` par la forme graded :
         ```typescript
         // Avant : export interface HarvestInventory { [cropId: string]: number; }
         // Après :
         export type HarvestInventory = {
           [cropId: string]: Partial<Record<HarvestGrade, number>>;
         };
         ```
         (Nécessite import `HarvestGrade` depuis `./grade-engine` → attention au risque de cycle. Si cycle : déplacer `HarvestGrade` en tête de types.ts et faire que grade-engine l'importe depuis types.ts. Recommandé : déplacer le type `HarvestGrade` dans types.ts et ré-exporter depuis grade-engine pour compat.)
       - Étendre `CraftedItem.grade?: HarvestGrade` (optionnel — legacy undefined).

    3. **Modifier `lib/mascot/craft-engine.ts`** :
       - `serializeHarvestInventory` :
         ```typescript
         export function serializeHarvestInventory(inv: HarvestInventory): string {
           const parts: string[] = [];
           for (const cropId of Object.keys(inv).sort()) {
             const gradeMap = inv[cropId] ?? {};
             for (const grade of GRADE_ORDER) { // ordre déterministe
               const qty = gradeMap[grade] ?? 0;
               if (qty > 0) parts.push(`${cropId}:${grade}:${qty}`);
             }
           }
           return parts.join(',');
         }
         ```
       - `parseHarvestInventory` : accepter `cropId:qty` (legacy) ET `cropId:grade:qty` (v2). Détection par nombre de ':' (2 → legacy si 2e part numérique ; 3 → v2). Grade invalide fallback 'ordinaire'. Fusion multi-entrées même clé via `addToGradedInventory`.
       - `serializeCraftedItems` : si item.grade, ajouter `:${item.grade}` ; sinon format legacy 2-parts.
       - `parseCraftedItems` : détecter 3e part = grade ∈ GRADE_ORDER → attacher.

    4. **Vérifier `lib/parser.ts`** (lignes ~725-729) : l'appel `serializeHarvestInventory(data.harvestInventory)` est inchangé ; le nouveau format est émis automatiquement. Rien à modifier ici sauf si un typage explicite de `data.harvestInventory` casse (adapter au nouveau type).

    5. **Bumper CACHE_VERSION** dans `lib/vault-cache.ts:47` : `5 → 6`. Ajouter un commentaire `// v6: HarvestInventory shape change (graded — Phase B grades)`.

    6. **Écrire les tests `lib/__tests__/grade-inventory.test.ts`** selon <behavior>. Import depuis `../mascot/grade-engine` et `../mascot/craft-engine`. Utiliser `describe` blocs par thème (compareGrades, addToGradedInventory, parser, round-trip, legacy).

    7. Valider : `npx jest lib/__tests__/grade-inventory.test.ts --no-coverage` et `npx tsc --noEmit`. Corriger toutes les erreurs TS émergentes (certains endroits typent implicitement inv comme number — les adapter via le type union OU caster avec guard).

    GOTCHAS :
    - Le shape change est **BREAKING pour TypeScript** : tous les endroits qui lisent `farmData.harvestInventory[cropId]` comme `number` vont casser. Les repérer via `tsc --noEmit` et migrer vers `farmData.harvestInventory[cropId]?.ordinaire ?? 0` ou helper approprié.
    - Sites connus à adapter (identifiés via grep) : hooks/useFarm.ts:333,510,541 + hooks/useGarden.ts:579,642,687,816,982,1117. Laisser Task 2 & 3 les gérer fonctionnellement ; ici, juste que `tsc --noEmit` passe — si ça casse trop, CAST temporaire `as any` toléré SEULEMENT dans Task 1 pour isoler ; Tasks suivantes nettoient.
    - NE PAS supprimer les casts `as any` existants dans useGarden.ts — les adapter plutôt.
    - Cycle import grade-engine ↔ types.ts : déplacer `HarvestGrade` dans types.ts (où vivent les autres types) est la solution propre.
  </action>
  <verify>
    <automated>npx jest lib/__tests__/grade-inventory.test.ts --no-coverage && npx tsc --noEmit</automated>
  </verify>
  <done>
    - lib/mascot/grade-engine.ts étendu (GRADE_ORDER, compareGrades, getWeakestGrade, gradeSellMultiplier, add/remove/countGradedInventory)
    - HarvestInventory redéfini en graded + CraftedItem.grade?
    - Parser/serializer HarvestInventory : format v2 `cropId:grade:qty` + compat legacy `cropId:qty` → ordinaire
    - CACHE_VERSION 5 → 6
    - lib/__tests__/grade-inventory.test.ts : ≥15 tests passent (parser legacy, add/remove, round-trip, CraftedItem)
    - npx tsc --noEmit clean (avec éventuels adapteurs minimaux dans useFarm/useGarden pour dé-casser les sites lecteurs — peuvent être de simples `?.ordinaire` en attendant Tasks 2-3)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 : Brancher harvest → inventaire gradé + supprimer bonus coins immédiat Phase A + tests craft-grade</name>
  <files>hooks/useFarm.ts, app/(tabs)/tree.tsx, components/gamification/HarvestCardToast.tsx, components/mascot/CraftSheet.tsx, lib/__tests__/craft-grade.test.ts, locales/fr/common.json, locales/en/common.json</files>
  <behavior>
    Tests `lib/__tests__/craft-grade.test.ts` AVANT implémentation :

    **Maillon faible (getWeakestGrade appliqué au craft) :**
    - Recette confiture (strawberry×2) avec selection { strawberry: 'beau' } → output grade 'beau'
    - Recette gateau (wheat×1, oeuf×1) avec selection { wheat: 'parfait', oeuf: 'ordinaire' } → output 'ordinaire'
    - Recette mono-ingrédient avec selection grade='superbe' → output 'superbe'

    **Default = min grade possédé permettant craft :**
    - Inventory { tomato: { ordinaire: 10, beau: 3 } }, recette demande 2 tomato → default 'ordinaire' (plus bas possédé)
    - Inventory { tomato: { beau: 3, parfait: 1 } }, recette demande 2 tomato → default 'beau'
    - Inventory { tomato: { ordinaire: 1, beau: 3 } }, recette demande 2 tomato → default 'beau' (ordinaire insuffisant)

    **Validation craftable :**
    - canCraftAtGrade(inv, recipe, selection, multiplier=1) retourne true si pour chaque ingredient : inv[itemId]?.[selection[itemId]] >= ingredient.quantity × multiplier
    - Sinon false avec raison "Pas assez de {grade} {itemId}"

    **Multiplicateur craft × qty :**
    - Recette ×2 (double batch) avec strawberry requis 2 → nécessite 4 strawberry de ce grade

    (Ces helpers peuvent vivre dans `lib/mascot/craft-engine.ts` : `getDefaultGradeSelection`, `canCraftAtGrade`, `getCraftOutputGrade`.)
  </behavior>
  <action>
    1. **Modifier `hooks/useFarm.ts:harvest`** (lignes ~332-501) :
       - Import : `import { addToGradedInventory, type HarvestGrade } from '../lib/mascot/grade-engine';`
       - **SUPPRIMER** le calcul `gradeBonusCoins` ET les 2 appels `await addCoins(profileId, gradeBonusCoins, ...)` (golden + standard paths). C'est la rupture core Phase A → Phase B.
       - Le `grade` reste roulé si tech culture-5 débloquée (compat API conservée pour le toast).
       - **REMPLACER** :
         ```typescript
         updatedHarvestInv[result.harvestedCropId] = (updatedHarvestInv[result.harvestedCropId] ?? 0) + finalQty;
         ```
         par :
         ```typescript
         const finalGrade: HarvestGrade = grade ?? 'ordinaire';
         addToGradedInventory(updatedHarvestInv, result.harvestedCropId, finalGrade, finalQty);
         ```
         (Idem dans le recalcul ligne ~403 après wager multiplier.)
       - Le return conserve `grade` (pour toast) mais `gradeBonusCoins` devient toujours 0 (ou supprimer du type — décision : supprimer propre pour signaler le shift sémantique).
       - Adapter tous les autres sites qui lisent `profile.harvestInventory[cropId]` comme number : utiliser `Object.values(inv[cropId] ?? {}).reduce((a,b)=>a+(b??0),0)` pour totaux OU lire par grade spécifique.

    2. **Adapter `app/(tabs)/tree.tsx:handleCropCellPress`** (ligne ~1325) :
       - `showHarvestCard` continue de recevoir `grade` si défini. Retirer `bonusCoins` (ou mettre 0) — le toast montre juste la qualité, plus le bonus.
       - Supprimer Haptics 'parfait' coup-coins si lié au bonus ; OU garder en tant que récompense tactile de rareté (décision : garder, c'est un feedback rareté indépendant du gain monétaire).

    3. **Adapter `components/gamification/HarvestCardToast.tsx`** (HarvestItem.grade) :
       - Simplifier `grade?: { key: string; emoji: string }` (retirer `bonusCoins`) — ou garder le champ optionnel. Décision : retirer, propre cassure propre signalée.
       - Badge affiche juste `{emoji} {t('farm.grade.' + key)}` sans le `+X 🍃`.

    4. **Adapter `components/mascot/CraftSheet.tsx`** — ajouter picker grade :
       - State local : `const [gradeSelection, setGradeSelection] = useState<Record<string, HarvestGrade>>({})` + `const [expanded, setExpanded] = useState(false)`.
       - À l'ouverture : calculer default via `getDefaultGradeSelection(harvestInv, recipe, multiplier)` (nouveau helper dans craft-engine.ts).
       - UI : bouton compact au-dessus du sélecteur qty. Format : `[ Grade : {emoji} {t(labelKey)} ▾ ]` (pour ingrédient unique) OU `[ Grades (maillon faible) : {emojiOutput} {labelOutput} ▾ ]` (pour multi-ingrédients — affiche le grade output calculé).
       - Tap → expand inline : pour chaque ingrédient, chips `[{emoji} {label} ×{qtyPossédée}]` (cliquables si qty >= requis × multiplier, grisées sinon).
       - Masquer le bouton picker si `totalGradesAvailable === 1` pour tous les ingrédients (cas ordinaire seul) — craft classique.
       - Preview live : `Grade output : {emoji} {label}` + `Valeur vente : {recipe.sellValue × gradeSellMultiplier(outputGrade)} 🍃` (au-dessus du bouton "Crafter").
       - Validation craft : bouton Crafter disabled + toast error si `!canCraftAtGrade(inv, recipe, selection, multiplier)`.
       - Au craft : retirer les quantités via `removeFromGradedInventory` par grade sélectionné ; créer CraftedItem avec `grade: getCraftOutputGrade(selection)`.
       - Tous styles via `useThemeColors()` + tokens `Spacing/Radius/FontSize` (jamais hardcoded). Animation expand via reanimated `withSpring`. Commentaires FR.

    5. **Ajouter helpers dans `lib/mascot/craft-engine.ts`** :
       ```typescript
       export function getDefaultGradeSelection(
         inv: HarvestInventory,
         recipe: CraftRecipe,
         multiplier: number = 1,
       ): Record<string, HarvestGrade> {
         const selection: Record<string, HarvestGrade> = {};
         for (const ing of recipe.ingredients) {
           const needed = ing.quantity * multiplier;
           const gradeMap = inv[ing.itemId] ?? {};
           // Premier grade dans GRADE_ORDER ayant qty >= needed
           const found = GRADE_ORDER.find(g => (gradeMap[g] ?? 0) >= needed);
           selection[ing.itemId] = found ?? 'ordinaire';
         }
         return selection;
       }

       export function canCraftAtGrade(
         inv: HarvestInventory,
         recipe: CraftRecipe,
         selection: Record<string, HarvestGrade>,
         multiplier: number = 1,
       ): { canCraft: boolean; missing?: { itemId: string; grade: HarvestGrade; have: number; need: number } } {
         for (const ing of recipe.ingredients) {
           const grade = selection[ing.itemId] ?? 'ordinaire';
           const have = inv[ing.itemId]?.[grade] ?? 0;
           const need = ing.quantity * multiplier;
           if (have < need) return { canCraft: false, missing: { itemId: ing.itemId, grade, have, need } };
         }
         return { canCraft: true };
       }

       export function getCraftOutputGrade(selection: Record<string, HarvestGrade>): HarvestGrade {
         const grades = Object.values(selection);
         return getWeakestGrade(grades);
       }
       ```

    6. **Écrire `lib/__tests__/craft-grade.test.ts`** selon <behavior> (≥10 tests).

    7. **i18n FR** (`locales/fr/common.json`) — ajouter dans `farm` (ou créer sous-objet `craft`) :
       ```json
       "craft": {
         "gradePickerLabel": "Grade",
         "gradeOutputLabel": "Qualité obtenue",
         "sellValueLabel": "Valeur de vente",
         "notEnoughGrade": "Pas assez de {{grade}} {{item}}",
         "weakestLinkHint": "Le grade de l'item crafté = le plus faible des ingrédients"
       }
       ```
    8. **i18n EN** miroir :
       ```json
       "craft": {
         "gradePickerLabel": "Grade",
         "gradeOutputLabel": "Output quality",
         "sellValueLabel": "Sell value",
         "notEnoughGrade": "Not enough {{grade}} {{item}}",
         "weakestLinkHint": "Crafted item grade = weakest ingredient"
       }
       ```

    9. Valider : `npx tsc --noEmit && npx jest lib/__tests__/craft-grade.test.ts --no-coverage`.

    GOTCHAS :
    - Wager flow Phase 40 : `finalQty *= wager.multiplier` ligne ~389 puis `updatedHarvestInv[...] = currentHarvestInv[...] + finalQty` ligne ~403. Remplacer CE deuxième write par `addToGradedInventory` aussi ; ne pas double-compter (le premier write à 351 + override à 403 reste le pattern — juste que maintenant les deux opèrent sur inv graded).
    - Le test Phase A (grade-engine.test.ts) doit continuer à passer sans régression. Run `npx jest lib/__tests__/grade-engine.test.ts` en contrôle.
    - CraftSheet existant est 53K : repérer la section "quantity selector" par grep/read ciblé, injecter le picker juste au-dessus, ne pas réécrire le composant. Animation reanimated obligatoire (CLAUDE.md).
    - `react-native-reanimated` uniquement (pas RN Animated) pour le expand du picker — `useSharedValue` + `useAnimatedStyle` + `withSpring` avec `SPRING_CONFIG` constante module.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx jest lib/__tests__/grade-inventory.test.ts lib/__tests__/craft-grade.test.ts lib/__tests__/grade-engine.test.ts --no-coverage</automated>
  </verify>
  <done>
    - harvest() stocke dans inventaire gradé via addToGradedInventory (plus de bonus coins immédiat)
    - Bloc addCoins gradeBonusCoins SUPPRIMÉ des 2 paths (golden + standard)
    - HarvestCardToast affiche badge grade SANS coins (juste qualité)
    - CraftSheet : picker grade compact + expand, default min possédé, preview output + sellValue, grisage qty insuffisante, masqué si 1 seul grade
    - CraftedItem écrit avec grade = getCraftOutputGrade(selection)
    - Helpers getDefaultGradeSelection + canCraftAtGrade + getCraftOutputGrade dans craft-engine.ts
    - i18n FR/EN complets (farm.craft.*)
    - Tests craft-grade passent (≥10), tests grade-engine Phase A passent toujours, tests grade-inventory Task 1 passent
    - npx tsc --noEmit clean
  </done>
</task>

<task type="auto">
  <name>Task 3 : MarketSheet par grade + market-engine multiplier + tests market-grade + achat = ordinaire</name>
  <files>lib/village/market-engine.ts, hooks/useGarden.ts, components/village/MarketSheet.tsx, lib/__tests__/market-grade.test.ts, locales/fr/common.json, locales/en/common.json</files>
  <action>
    1. **Étendre `lib/village/market-engine.ts`** :
       - `canSellItem` : nouveau paramètre optionnel `grade: HarvestGrade = 'ordinaire'`. `totalGain = unitPrice * quantity * gradeSellMultiplier(grade)` (arrondi final avec `Math.floor`).
       - `executeSell` : idem paramètre + transaction log inclut grade (nouveau champ optionnel dans type transaction).
       - Import `gradeSellMultiplier` + `HarvestGrade` depuis `../mascot/grade-engine`.

    2. **Modifier `hooks/useGarden.ts:sellItem`** (lignes ~620-720) :
       - Signature étendue : `async (itemId: string, quantity: number, profileId: string, grade: HarvestGrade = 'ordinaire')`.
       - Pour `category === 'harvest'` : `profileItemCount = farmData.harvestInventory?.[itemId]?.[grade] ?? 0`.
       - Pour `category === 'crafted'` : filtrer par `c.recipeId === itemId && (c.grade ?? 'ordinaire') === grade` ; `profileItemCount = filtered.length`.
       - Passer `grade` à `canSellItem` + `executeSell` pour qu'ils calculent `totalGain` avec multiplier.
       - Décrément : `removeFromGradedInventory(farmData.harvestInventory, itemId, grade, quantity)` (importé de grade-engine).
       - Pour `crafted` : retirer N items avec `(c.grade ?? 'ordinaire') === grade` (FIFO par craftedAt).
       - Le `buyItem` (non modifié ici) ajoute à harvestInventory avec `grade='ordinaire'` systématique — utiliser `addToGradedInventory(..., 'ordinaire', qty)` dans le bloc d'achat existant (ligne ~982 : `{ ...farmData.harvestInventory, [itemId]: currentQty + payload.quantity }` à remplacer par `addToGradedInventory`).

    3. **Modifier `components/village/MarketSheet.tsx`** (colonne vente) :
       - Pour chaque item possédé catégorie `harvest` : lister les grades possédés (qty > 0) comme lignes distinctes. Chaque ligne affiche :
         - `{emojiGrade} {labelGrade} ×{qty}` + prix vente calculé `getSellPrice(def, stock) × gradeSellMultiplier(grade)`.
         - Bouton "Vendre" appelle `sellItem(itemId, quantity, profileId, grade)`.
       - Pour items de grade unique (`'ordinaire'` uniquement) : UI inchangée (pas de sous-lignes).
       - Pour catégorie `crafted` : idem (groupé par recipeId+grade).
       - Tous styles useThemeColors + tokens. Commentaires FR. Animations existantes préservées.

    4. **Tests `lib/__tests__/market-grade.test.ts`** :
       - `canSellItem(itemId, 1, stock, profileCount=5, 'beau')` → totalGain === Math.floor(getSellPrice(def, stock) × 1 × 1.5)
       - `canSellItem(..., 'parfait')` × 4
       - `canSellItem(..., 'ordinaire')` === prix brut
       - `canSellItem` sans grade (défaut) === comme 'ordinaire'
       - Mock minimal d'un MarketItemDef pour tester sans vault
       - Test buyItem : ajoute à inventory[itemId].ordinaire uniquement (jamais autres grades — via test unitaire d'une fonction pure si possible, ou test d'intégration mocké hook)

    5. **i18n** — ajouter dans FR `market` (ou créer) :
       ```json
       "market": {
         "sellByGrade": "Vendre par qualité",
         "gradeColumnLabel": "Qualité"
       }
       ```
       Miroir EN : `"sellByGrade": "Sell by quality"`, `"gradeColumnLabel": "Quality"`.

    6. Valider final :
       ```
       npx tsc --noEmit
       npx jest lib/__tests__/grade-inventory.test.ts lib/__tests__/craft-grade.test.ts lib/__tests__/market-grade.test.ts lib/__tests__/grade-engine.test.ts --no-coverage
       ```

    GOTCHAS :
    - MarketSheet existant = 36K : repérer la section "sell" par grep, ajouter le fan-out par grade en préservant le reste (deal du jour, trades, etc.).
    - `executeSell` retourne `{ newStock, transaction, totalGain }` : le totalGain DOIT inclure le multiplier (single source of truth — évite double calcul côté hook).
    - Les autres consommateurs de `sellItem` (desktop? routines?) : grep `sellItem\(` pour vérifier qu'aucun appel ne casse (signature optional parameter → compat ascendante).
    - Pour `buyItem` : vérifier qu'aucun code ne tente d'injecter un grade non-ordinaire. C'est une règle design (voir constraints).
    - Stock transaction log : le champ grade est optionnel — les anciennes transactions sans grade restent valides (parser tolérant).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx jest lib/__tests__/grade-inventory.test.ts lib/__tests__/craft-grade.test.ts lib/__tests__/market-grade.test.ts lib/__tests__/grade-engine.test.ts --no-coverage</automated>
  </verify>
  <done>
    - market-engine canSellItem + executeSell acceptent grade + appliquent gradeSellMultiplier
    - useGarden.sellItem signature étendue + décrément inv gradé via removeFromGradedInventory
    - useGarden.buyItem ajoute toujours grade='ordinaire' via addToGradedInventory
    - MarketSheet éclate les items possédés en lignes par grade (qty > 0), affiche prix avec multiplier, bouton vente par grade
    - CraftedItem de grade > ordinaire vendu au marché crédite le multiplier
    - Tests market-grade ≥6 passent
    - TOUTES les suites Jest du périmètre passent (grade-engine Phase A + grade-inventory + craft-grade + market-grade)
    - npx tsc --noEmit clean
    - i18n FR/EN complets (farm.market.*)
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zéro erreur nouvelle (erreurs pré-existantes MemoryEditor.tsx, cooklang.ts, useVault.ts : ignorer comme stipulé CLAUDE.md).
2. `npx jest lib/__tests__/grade-engine.test.ts lib/__tests__/grade-inventory.test.ts lib/__tests__/craft-grade.test.ts lib/__tests__/market-grade.test.ts --no-coverage` — tous tests passent.
3. CACHE_VERSION = 6 dans lib/vault-cache.ts.
4. Smoke manuel (optionnel auto mode) :
   - Sans tech culture-5 : récolter → item ajouté inventaire grade='ordinaire', plus de coins bonus immédiat. Craft → grade output = ordinaire. Vendre → prix × 1.
   - Avec tech culture-5 + récoltes multiples : voir plusieurs grades dans l'inventaire. Ouvrir CraftSheet → picker visible si plusieurs grades, preview output = min. Vendre un item grade 'parfait' → prix × 4.
   - Relancer l'app → cache rejeté (version 5 sur disque) → reload frais, inventaire graded intact.
</verification>

<success_criteria>
- Inventaire multi-grade fonctionnel end-to-end (parser, serializer, add/remove helpers)
- Harvest ne crédite PLUS de coins bonus immédiat — le gain se matérialise à vente/craft
- CraftSheet : picker grade fonctionnel, règle maillon faible appliquée, default = min possédé, grisage qty insuffisante, masqué si 1 grade
- MarketSheet : prix vente × gradeSellMultiplier par grade, achat toujours 'ordinaire'
- 3 suites Jest dédiées : grade-inventory (legacy + round-trip), craft-grade (maillon faible + default), market-grade (multiplier + achat ordinaire)
- Compat ascendante stricte : items legacy cropId:qty parsés en grade='ordinaire', aucune perte
- CACHE_VERSION bumpé (5 → 6)
- Phase A non cassée : rollHarvestGrade + tech culture-5 + badge grade toast conservés
- tsc clean, tous les Jest du périmètre verts, commit final avec message FR /ship-friendly
</success_criteria>

<output>
Après complétion, créer `.planning/quick/260421-obd-phase-b-grades-inventaire-par-grade-pick/260421-obd-SUMMARY.md` résumant :
- Fichiers créés/modifiés
- Décisions techniques (breaking shape HarvestInventory, format CSV cropId:grade:qty, compat legacy cropId:qty → ordinaire, suppression addCoins bonus immédiat Phase A, helpers maillon faible, buyItem toujours ordinaire)
- Nombre de tests ajoutés (grade-inventory + craft-grade + market-grade)
- Points d'attention futurs : migration 100% inventaires en graded vérifiée au premier boot, monitoring erreurs parse, tuning multipliers si feedback joueur
</output>
