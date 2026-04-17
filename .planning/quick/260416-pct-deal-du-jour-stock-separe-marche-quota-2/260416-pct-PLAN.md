---
phase: quick-260416-pct
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/village/market-engine.ts
  - lib/types.ts
  - lib/parser.ts
  - hooks/useGarden.ts
  - components/village/MarketSheet.tsx
  - app/(tabs)/village.tsx
autonomous: true
requirements:
  - DEAL-STOCK-SEP  # Deal du jour = stock indépendant du marché
  - DEAL-QUOTA-2   # Quota 2 achats par profil par jour
  - DEAL-POOL-INIT # Pool basé sur initialStock > 0 (pas stock courant)
  - DEAL-COEXIST   # Item du deal reste dispo au marché au prix normal
must_haves:
  truths:
    - "L'item proposé comme deal est tiré d'un pool stable basé sur initialStock > 0 (exclut tresor_familial/grand_festin)"
    - "Un profil ne peut acheter le deal que 2 fois par jour — le 3ème achat est bloqué (carte disparaît)"
    - "Acheter le deal ne décrémente PAS marketStock — l'item reste achetable au prix normal dans la liste principale"
    - "Acheter le deal déduit unitPrice coins du profil et enregistre une transaction 'buy'"
    - "Le compteur se reset automatiquement à minuit (nouveau dateKey Y-M-D) et quand l'itemId du deal change"
    - "Après redémarrage de l'app, le compteur du deal est restauré depuis farm-{profileId}.md"
  artifacts:
    - path: "lib/village/market-engine.ts"
      provides: "DAILY_DEAL_STOCK_PER_PROFILE, getDailyDeal(marketStock, now, profileDealPurchases?) avec remaining"
      contains: "DAILY_DEAL_STOCK_PER_PROFILE"
    - path: "lib/types.ts"
      provides: "Champ dailyDealPurchases sur FarmProfileData"
      contains: "dailyDealPurchases?:"
    - path: "lib/parser.ts"
      provides: "parseFarmProfile / serializeFarmProfile gèrent daily_deal_purchases"
      contains: "daily_deal_purchases"
    - path: "hooks/useGarden.ts"
      provides: "buyDailyDeal(itemId, unitPrice, profileId) — flux séparé du marché"
      contains: "buyDailyDeal"
    - path: "components/village/MarketSheet.tsx"
      provides: "DailyDealCard utilise onBuyDeal, deal tient compte de profileDealPurchases"
      contains: "onBuyDeal"
  key_links:
    - from: "components/village/MarketSheet.tsx"
      to: "lib/village/market-engine.ts#getDailyDeal"
      via: "getDailyDeal(marketStock, new Date(), profileDealPurchases)"
      pattern: "getDailyDeal\\(marketStock"
    - from: "components/village/MarketSheet.tsx"
      to: "app/(tabs)/village.tsx#onBuyDeal prop"
      via: "handleBuyDeal appelle onBuyDeal au lieu de onBuy"
      pattern: "onBuyDeal"
    - from: "app/(tabs)/village.tsx"
      to: "hooks/useGarden.ts#buyDailyDeal"
      via: "Prop onBuyDeal branchée sur buyDailyDeal"
      pattern: "buyDailyDeal\\("
    - from: "hooks/useGarden.ts#buyDailyDeal"
      to: "lib/parser.ts#serializeFarmProfile"
      via: "Persiste dailyDealPurchases dans farm-{profileId}.md"
      pattern: "dailyDealPurchases"
---

<objective>
Le deal du jour fonctionne comme un stock indépendant du marché, limité à 2 achats par profil par jour. L'item du deal est tiré d'un pool stable (initialStock > 0) donc ne disparaît pas quand le stock marché tombe à 0, et reste parallèlement achetable au prix normal dans la liste principale du marché.

Purpose: Rendre le deal du jour fiable (pool stable), non-épuisable par les autres profils (stock séparé), et limiter le farming via un quota per-profil (FOMO contrôlé).
Output:
- Moteur marché pur (getDailyDeal signature étendue + constante quota)
- Persistance per-profil (dailyDealPurchases dans farm-{id}.md)
- Nouveau flux d'achat isolé (buyDailyDeal dans useGarden)
- UI MarketSheet wired (onBuyDeal prop, DailyDealCard respecte remaining)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/village/market-engine.ts
@lib/village/types.ts
@lib/types.ts
@lib/parser.ts
@components/village/MarketSheet.tsx
@hooks/useGarden.ts
@app/(tabs)/village.tsx

<interfaces>
<!-- Contrats existants que l'executor doit utiliser directement —
     pas besoin d'exploration supplémentaire du codebase. -->

Depuis lib/village/market-engine.ts (ACTUEL) :
```ts
export interface DailyDeal {
  def: MarketItemDef;
  discountedPrice: number;
  originalPrice: number;
  dateKey: string;           // YYYY-MM-DD
}

// Signature actuelle à faire évoluer :
export function getDailyDeal(marketStock: MarketStock, now?: Date): DailyDeal | null;
```

Depuis lib/village/market-engine.ts — constante existante MAX_MARKET_TXN_PER_DAY = 10 (garder intacte).

Depuis lib/types.ts (ACTUEL) — FarmProfileData structure clé/valeur sérialisée ligne par ligne.
Chaque champ optionnel est sérialisé uniquement si non-vide, lu via split sur `: `.

Depuis lib/parser.ts — pattern actuel pour un champ CSV per-profil :
```ts
// Lecture : ligne "trade_sent_today: 3|2026-04-15"
trade_sent_today: props.trade_sent_today || undefined,

// Écriture : un push conditionnel
if (data.trade_sent_today) lines.push(`trade_sent_today: ${data.trade_sent_today}`);
```

Depuis hooks/useGarden.ts — buyFromMarket signature & pattern :
```ts
const buyFromMarket = useCallback(
  async (itemId, quantity, profileId, priceOverride?) =>
    Promise<{ success: boolean; totalCost?: number; error?: string }>,
  [...deps]
);
// Pattern :
// 1. Rate-limit check (canTransactToday)
// 2. canBuyItem(...) → coins OK ?
// 3. executeBuy → newStock + transaction + totalCost
// 4. Serialize jardin-familial.md (marketStock + marketTransactions)
// 5. writeGamiCoins — déduit coins profil via gami-{id}.md
// 6. Distribue l'item (crafted / farm / harvest) → farm-{id}.md
```

Depuis components/village/MarketSheet.tsx — DailyDealCard signature actuelle :
```tsx
<DailyDealCard deal={dailyDeal} onBuy={handleBuyDeal} />
// handleBuyDeal appelle onBuy(itemId, qty, priceOverride=discountedPrice)
// → doit être remplacé par onBuyDeal(itemId, qty, unitPrice)
```

Depuis app/(tabs)/village.tsx — branchement actuel :
```tsx
<MarketSheet
  marketStock={marketStock}
  profileId={activeProfile?.id ?? ''}
  onBuy={async (itemId, qty, priceOverride?) => { ... buyFromMarket(...) ... }}
  ...
/>
```

MARKET_ITEMS : 59 entrées, 2 items avec initialStock=0 (tresor_familial, grand_festin).
Le filtre doit retourner 57 items éligibles.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Moteur marché — pool stable + quota per-profil (types + parser + engine)</name>
  <files>
    lib/village/market-engine.ts,
    lib/types.ts,
    lib/parser.ts,
    lib/__tests__/market-engine-daily-deal.test.ts
  </files>
  <behavior>
    Tests Jest à écrire AVANT implémentation (fichier lib/__tests__/market-engine-daily-deal.test.ts) :

    Test 1 — Pool stable basé sur initialStock :
      - `getDailyDeal({}, new Date('2026-04-16'))` retourne un DailyDeal (pas null) même avec marketStock vide
      - L'itemId retourné ne doit PAS être 'tresor_familial' ni 'grand_festin' (initialStock=0) — tester en bouclant sur plusieurs dates pour confirmer qu'ils ne sortent jamais

    Test 2 — Signature étendue :
      - `getDailyDeal(marketStock, now, undefined)` → remaining === 2
      - `getDailyDeal(marketStock, now, { dateKey: '2026-04-16', itemId: '<idPicked>', purchased: 1 })` pour la date '2026-04-16' → remaining === 1
      - `getDailyDeal(marketStock, now, { dateKey: '2026-04-16', itemId: '<idPicked>', purchased: 2 })` → null
      - `getDailyDeal(marketStock, now, { dateKey: '2026-04-15', itemId: '<idPicked>', purchased: 2 })` (date d'hier) → remaining === 2 (reset)
      - `getDailyDeal(marketStock, now, { dateKey: '2026-04-16', itemId: 'autre_item', purchased: 2 })` → remaining === 2 (itemId différent = reset)

    Test 3 — Parser round-trip :
      - `parseFarmProfile(serializeFarmProfile('Test', { ...empty, dailyDealPurchases: { dateKey: '2026-04-16', itemId: 'eau_fraiche', purchased: 2 } }))` renvoie dailyDealPurchases identique
      - `parseFarmProfile` d'un fichier sans ligne `daily_deal_purchases:` → dailyDealPurchases === undefined
      - Ligne malformée `daily_deal_purchases: abc|def` (count non-numérique) → undefined (tolérance)
      - `serializeFarmProfile` avec dailyDealPurchases=undefined → PAS de ligne émise
  </behavior>
  <action>
    Implémentation en 3 fichiers (respecter l'ordre pour que `tsc` reste vert à chaque étape) :

    (A) lib/village/market-engine.ts :
      1. Ajouter en tête du bloc "Deal du jour" :
         ```ts
         /** Quota d'achats du deal du jour par profil et par jour */
         export const DAILY_DEAL_STOCK_PER_PROFILE = 2;
         ```
      2. Étendre l'interface DailyDeal :
         ```ts
         export interface DailyDeal {
           def: MarketItemDef;
           discountedPrice: number;
           originalPrice: number;
           dateKey: string;
           remaining: number; // NEW — achats restants pour ce profil aujourd'hui
         }
         ```
      3. Remplacer la fonction `getDailyDeal` :
         ```ts
         export function getDailyDeal(
           marketStock: MarketStock,
           now: Date = new Date(),
           profileDealPurchases?: { dateKey: string; itemId: string; purchased: number },
         ): DailyDeal | null {
           const dateKey = formatDateYMD(now);
           const hash = hashDateString(`deal-${dateKey}`);

           // Pool STABLE basé sur initialStock > 0 (exclut tresor_familial, grand_festin)
           // → l'item du deal ne disparaît pas quand marketStock[item] tombe à 0
           const eligible = MARKET_ITEMS.filter(item => item.initialStock > 0);
           if (eligible.length === 0) return null;

           const picked = eligible[hash % eligible.length];
           // Prix calculé sur le stock marché courant (ou referenceStock si rupture)
           // — pour garder un prix cohérent même si le marché est à 0
           const stockForPrice = Math.max(1, marketStock[picked.itemId] ?? picked.referenceStock);
           const originalPrice = getBuyPrice(picked, stockForPrice);
           const discountedPrice = Math.max(1, Math.round(originalPrice * DAILY_DEAL_DISCOUNT));

           // Calcul du remaining : seulement si même date ET même item
           const purchasedToday =
             profileDealPurchases &&
             profileDealPurchases.dateKey === dateKey &&
             profileDealPurchases.itemId === picked.itemId
               ? profileDealPurchases.purchased
               : 0;
           const remaining = DAILY_DEAL_STOCK_PER_PROFILE - purchasedToday;
           if (remaining <= 0) return null;

           return { def: picked, discountedPrice, originalPrice, dateKey, remaining };
         }
         ```
      4. Ne PAS toucher à executeBuy / canBuyItem / MARKET_ITEMS.

    (B) lib/types.ts :
      Dans `interface FarmProfileData`, ajouter juste après `plotLevels?: number[]` :
      ```ts
      // Deal du jour — quota per-profil (stock séparé du marché)
      dailyDealPurchases?: { dateKey: string; itemId: string; purchased: number };
      ```

    (C) lib/parser.ts :
      1. Dans `parseFarmProfile`, ajouter après la lecture de `plot_levels` (ligne ~679, juste avant le `}` de `return {`) :
         ```ts
         dailyDealPurchases: (() => {
           if (!props.daily_deal_purchases) return undefined;
           const parts = props.daily_deal_purchases.split('|');
           if (parts.length !== 3) return undefined;
           const [dateKey, itemId, countRaw] = parts.map(s => s.trim());
           const purchased = parseInt(countRaw, 10);
           if (!dateKey || !itemId || isNaN(purchased)) return undefined;
           return { dateKey, itemId, purchased };
         })(),
         ```
      2. Dans `serializeFarmProfile`, ajouter juste avant `return lines.join('\n') + '\n';` (après le bloc plot_levels) :
         ```ts
         if (data.dailyDealPurchases) {
           const { dateKey, itemId, purchased } = data.dailyDealPurchases;
           lines.push(`daily_deal_purchases: ${dateKey}|${itemId}|${purchased}`);
         }
         ```

    (D) lib/__tests__/market-engine-daily-deal.test.ts : créer le fichier et y écrire les tests décrits dans <behavior>. Importer depuis '../village/market-engine' et '../parser'. Utiliser `MARKET_ITEMS` pour dériver l'itemId picked pour une date donnée (réutiliser le hash si utile, ou piocher explicitement).

    Conventions :
    - Français pour tous les commentaires
    - Pas de hardcoded couleurs (N/A ici — moteur pur)
    - Pas de modification de executeBuy ni de pruneTransactionLog
    - Ne pas toucher `formatDateYMD` (reste interne)
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx jest lib/__tests__/market-engine-daily-deal.test.ts --no-coverage</automated>
  </verify>
  <done>
    - `DAILY_DEAL_STOCK_PER_PROFILE = 2` exporté
    - `DailyDeal.remaining: number` présent
    - `getDailyDeal` accepte un 3e param optionnel `profileDealPurchases`
    - Pool basé sur `item.initialStock > 0` (57 items éligibles)
    - `tresor_familial` et `grand_festin` jamais tirés
    - `FarmProfileData.dailyDealPurchases` optionnel et sérialisé round-trip
    - Tous les tests Jest Task 1 passent
    - `npx tsc --noEmit` OK
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Flux achat deal séparé — useGarden.buyDailyDeal + MarketSheet wiring</name>
  <files>
    hooks/useGarden.ts,
    components/village/MarketSheet.tsx,
    app/(tabs)/village.tsx
  </files>
  <behavior>
    Pas de test Jest dédié pour cette task (UI + glue code + I/O vault), mais `npx tsc --noEmit` doit passer et les 5 vérifications manuelles de la section <verify> doivent être explicitement testables.

    Contrats pour l'executor :

    - `buyDailyDeal(itemId: string, unitPrice: number, profileId: string)` doit :
      1. Vérifier `canTransactToday(marketTransactions, profileId)` → sinon `{ success: false, error: 'Limite …' }`
      2. Lire le profil actuel → vérifier coins >= unitPrice
      3. Lire farm-{profileId}.md → parseFarmProfile
      4. Calculer le nouveau `dailyDealPurchases` :
         - Si `current?.dateKey === today && current?.itemId === itemId` → `{ ...current, purchased: current.purchased + 1 }`
         - Sinon → `{ dateKey: today, itemId, purchased: 1 }`
      5. Vérifier `purchased <= DAILY_DEAL_STOCK_PER_PROFILE` (défense en profondeur — normalement déjà bloqué côté UI)
      6. Créer une transaction `{ action: 'buy', quantity: 1, unitPrice, totalPrice: unitPrice }` et l'ajouter via pruneTransactionLog à gardenData.marketTransactions (NE PAS toucher marketStock)
      7. Persister jardin-familial.md (marketTransactions uniquement)
      8. Persister farm-{profileId}.md (avec nouveau dailyDealPurchases)
      9. Distribuer l'item selon la catégorie — MÊME logique que `buyFromMarket` (village/village_craft → inventory collectif, farm/harvest → farmInventory/harvestInventory, crafted → craftedItems[])
      10. Déduire unitPrice coins via gami-{id}.md (même pattern `writeGamiCoins`)
      11. refreshGamification + refreshFarm(profileId)
      12. Retourner `{ success: true, totalCost: unitPrice }`

    - `MarketSheet` doit recevoir la prop `onBuyDeal` et la prop optionnelle `profileDealPurchases` (structure de FarmProfileData.dailyDealPurchases). Le useMemo de `dailyDeal` doit passer `profileDealPurchases` à `getDailyDeal`. Le `handleBuyDeal` doit appeler `onBuyDeal(itemId, 1, deal.discountedPrice)`.
  </behavior>
  <action>
    (A) hooks/useGarden.ts :

      1. En haut, étendre l'import engine pour récupérer la constante :
         ```ts
         import {
           // ... existant
           DAILY_DEAL_STOCK_PER_PROFILE,
         } from '../lib/village/market-engine';
         ```

      2. Ajouter `buyDailyDeal` juste après `buyFromMarket` (pattern quasi-identique, mais SANS décrémentation marketStock) :
         ```ts
         const buyDailyDeal = useCallback(
           async (itemId: string, unitPrice: number, profileId: string): Promise<{ success: boolean; totalCost?: number; error?: string }> => {
             if (!vault) return { success: false, error: 'Vault non disponible' };
             if (!canTransactToday(marketTransactions, profileId)) {
               return { success: false, error: 'Limite de 10 transactions/jour atteinte' };
             }
             const profile = profiles.find(p => p.id === profileId);
             if (!profile) return { success: false, error: 'Profil introuvable' };
             if ((profile.coins ?? 0) < unitPrice) {
               return { success: false, error: `Pas assez de 🍃 (${profile.coins ?? 0} / ${unitPrice})` };
             }

             const category = findMarketItemCategory(itemId);
             if (!category) return { success: false, error: 'Article introuvable' };

             // Charger farm profil → calculer nouveau dailyDealPurchases
             const farmPath = `farm-${profileId}.md`;
             const farmRaw = await vault.readFile(farmPath).catch(() => '');
             const farmData = parseFarmProfile(farmRaw);

             const today = formatDateYMD(new Date()); // helper local ci-dessous
             const current = farmData.dailyDealPurchases;
             const nextPurchased =
               current && current.dateKey === today && current.itemId === itemId
                 ? current.purchased + 1
                 : 1;
             if (nextPurchased > DAILY_DEAL_STOCK_PER_PROFILE) {
               return { success: false, error: 'Deal épuisé pour aujourd\'hui' };
             }
             const nextDailyDealPurchases = { dateKey: today, itemId, purchased: nextPurchased };

             // Transaction logée (marketStock INTACT)
             const now = new Date();
             const transaction: MarketTransaction = {
               timestamp: now.toISOString().replace('Z', '').split('.')[0],
               profileId,
               action: 'buy',
               itemId,
               quantity: 1,
               unitPrice,
               totalPrice: unitPrice,
             };
             const updatedTxns = pruneTransactionLog([...marketTransactions, transaction]);

             const isCollective = category === 'village' || category === 'village_craft';
             const updatedData: VillageData = {
               ...gardenData,
               inventory: isCollective
                 ? { ...inventory, [itemId]: (inventory[itemId] ?? 0) + 1 }
                 : inventory,
               // marketStock inchangé — deal séparé
               marketTransactions: updatedTxns,
             };
             const newContent = serializeGardenFile(updatedData);
             await vault.writeFile(VILLAGE_FILE, newContent);
             setGardenRaw(newContent);

             // Déduire coins via gami-{id}.md
             try {
               const gamiPath = `gami-${profileId}.md`;
               const gamiRaw = await vault.readFile(gamiPath).catch(() => '');
               if (gamiRaw) {
                 const gami = parseGamificationForMarket(gamiRaw);
                 if (gami) {
                   gami.coins = Math.max(0, (gami.coins ?? 0) - unitPrice);
                   await writeGamiCoins(vault, gamiPath, gamiRaw, gami.coins);
                 }
               }
               refreshGamification();
             } catch { /* Gamification — non-critical */ }

             // Persister farm-{id}.md : dailyDealPurchases + distribution item (farm/harvest/crafted)
             const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
             let updatedFarm = { ...farmData, dailyDealPurchases: nextDailyDealPurchases };
             if (category === 'farm') {
               const farmInvObj = { ...(farmData.farmInventory ?? {}) } as any;
               farmInvObj[itemId] = (farmInvObj[itemId] ?? 0) + 1;
               updatedFarm = { ...updatedFarm, farmInventory: farmInvObj };
             } else if (category === 'harvest') {
               const harvestInvObj = { ...(farmData.harvestInventory ?? {}) } as any;
               harvestInvObj[itemId] = (harvestInvObj[itemId] ?? 0) + 1;
               updatedFarm = { ...updatedFarm, harvestInventory: harvestInvObj };
             } else if (category === 'crafted') {
               const craftedItems = [...(farmData.craftedItems ?? [])];
               craftedItems.push({ recipeId: itemId, craftedAt: now.toISOString() });
               updatedFarm = { ...updatedFarm, craftedItems };
             }
             try {
               await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarm));
               await refreshFarm(profileId);
             } catch { /* non-critical */ }

             return { success: true, totalCost: unitPrice };
           },
           [vault, gardenData, inventory, marketTransactions, profiles, setGardenRaw, refreshGamification, refreshFarm],
         );
         ```
      3. Helper local dans useGarden.ts (ou réutiliser un helper déjà présent — vérifier) :
         ```ts
         function formatDateYMD(date: Date): string {
           const y = date.getFullYear();
           const m = String(date.getMonth() + 1).padStart(2, '0');
           const d = String(date.getDate()).padStart(2, '0');
           return `${y}-${m}-${d}`;
         }
         ```
         Si un helper équivalent existe déjà dans useGarden.ts (grep rapide), le réutiliser.
      4. Ajouter `buyDailyDeal` au type de retour de `useGarden`, à la structure de l'interface exposée, et dans le `return { … }` final (à placer à côté de `buyFromMarket`, `sellToMarket`).

    (B) components/village/MarketSheet.tsx :

      1. Étendre `MarketSheetProps` :
         ```ts
         onBuyDeal: (itemId: string, qty: number, unitPrice: number) =>
           Promise<{ success: boolean; totalCost?: number; error?: string }>;
         profileDealPurchases?: { dateKey: string; itemId: string; purchased: number };
         ```
         Les rendre obligatoire (`onBuyDeal`) / optionnelle (`profileDealPurchases`). Garder `onBuy` tel quel (flux marché normal).

      2. Déstructurer `onBuyDeal, profileDealPurchases` dans les props.

      3. Remplacer le useMemo `dailyDeal` :
         ```ts
         const dailyDeal = useMemo(
           () => getDailyDeal(marketStock, new Date(), profileDealPurchases),
           [marketStock, profileDealPurchases],
         );
         ```

      4. Remplacer le `handleBuyDeal` :
         ```ts
         const handleBuyDeal = useCallback(async (itemId: string, qty: number) => {
           if (!dailyDeal) return;
           Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
           const result = await onBuyDeal(itemId, qty, dailyDeal.discountedPrice);
           if (result.success) {
             flashOpacity.value = withSequence(
               withTiming(1, { duration: 100 }),
               withTiming(0, { duration: 400 }),
             );
             Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
           } else {
             Alert.alert('Achat impossible', result.error ?? 'Erreur inconnue');
           }
         }, [onBuyDeal, flashOpacity, dailyDeal]);
         ```

      5. Bonus UX (optionnel mais recommandé) : afficher dans la `DailyDealCard` le `deal.remaining` à côté du timer, ex :
         ```tsx
         <Text style={styles.dealTimer}>
           Offre valable aujourd'hui · {deal.remaining}/{DAILY_DEAL_STOCK_PER_PROFILE} restant{deal.remaining > 1 ? 's' : ''}
         </Text>
         ```
         Importer `DAILY_DEAL_STOCK_PER_PROFILE` depuis `../../lib/village/market-engine`. Garder les couleurs existantes via `Farm.*` (pas de `useThemeColors` requis ici, DailyDealCard utilise déjà les Farm tokens).

    (C) app/(tabs)/village.tsx :

      1. Déstructurer `buyDailyDeal` depuis `useGarden()` (à côté de `buyFromMarket` / `sellToMarket`).

      2. Récupérer `profileDealPurchases` depuis le farm profile actif. Il y a déjà un `loadFarmInventories()` qui lit farm-{id}.md via `parseFarmProfile` et set `setFarmInv/setHarvestInv/setCraftedItems`. Étendre ce flux :
         - Ajouter un state `const [dailyDealPurchases, setDailyDealPurchases] = useState<FarmProfileData['dailyDealPurchases']>(undefined);`
         - Dans `loadFarmInventories`, après le `setCraftedItems(...)`, ajouter `setDailyDealPurchases(farmData.dailyDealPurchases);`
         - Importer le type `FarmProfileData` depuis `../../lib/types` si pas déjà fait.

      3. Passer les 2 nouvelles props à `<MarketSheet>` :
         ```tsx
         profileDealPurchases={dailyDealPurchases}
         onBuyDeal={async (itemId, qty, unitPrice) => {
           if (!activeProfile) return { success: false, error: 'Profil introuvable' };
           const result = await buyDailyDeal(itemId, unitPrice, activeProfile.id);
           if (result.success) await loadFarmInventories();
           return result;
         }}
         ```
         Conserver le `onBuy` existant (marché normal — NE PAS le remplacer).

    Conventions :
    - Français pour tous les labels + commentaires + erreurs utilisateur
    - Respecter `useThemeColors()` — mais DailyDealCard utilise déjà `Farm.*` tokens cosmétiques, c'est OK
    - Pas de régression `onBuy` marché principal
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Vérifications manuelles (à exécuter par le dev sur device après build) :
    1. Ouvrir le marché → DailyDealCard visible même si stock du deal item = 0 au marché
    2. Acheter le deal 2 fois → 3ème tentative : la carte disparaît (deal === null car remaining <= 0)
    3. L'item du deal reste dans la liste principale et achetable au prix normal (flux onBuy intact)
    4. Changer de date système (ou attendre minuit) → la carte réapparaît avec remaining=2
    5. Redémarrer l'app après 1 achat → la carte affiche bien remaining=1 (persistance OK)
  </verify>
  <done>
    - `useGarden` expose `buyDailyDeal(itemId, unitPrice, profileId)` qui NE touche PAS marketStock
    - `MarketSheet` a la prop `onBuyDeal` (requise) + `profileDealPurchases` (optionnelle)
    - `DailyDealCard` affiche le compteur restant (bonus UX)
    - `app/(tabs)/village.tsx` branche `onBuyDeal` sur `buyDailyDeal` et passe `profileDealPurchases` lu depuis `loadFarmInventories`
    - Le flux `onBuy` marché normal est INCHANGÉ (onBuy reste obligatoire dans MarketSheetProps)
    - `npx tsc --noEmit` OK
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans erreur (hors erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts — à ignorer per CLAUDE.md)
- `npx jest lib/__tests__/market-engine-daily-deal.test.ts --no-coverage` passe
- Grep `initialStock > 0` dans lib/village/market-engine.ts retourne 1 match (filtre du pool)
- Grep `dailyDealPurchases` dans lib/types.ts + lib/parser.ts + hooks/useGarden.ts retourne au moins 1 match par fichier
- Grep `onBuyDeal` dans components/village/MarketSheet.tsx + app/(tabs)/village.tsx retourne au moins 1 match par fichier
- Grep `marketStock: newStock` dans hooks/useGarden.ts : toujours présent UNIQUEMENT dans buyFromMarket / sellToMarket (pas dans buyDailyDeal — preuve que le stock marché n'est pas muté)
</verification>

<success_criteria>
Le deal du jour :
1. Tire son item depuis un pool stable de 57 items (MARKET_ITEMS filtrés sur initialStock > 0)
2. Reste affiché même quand marketStock[dealItem] === 0
3. Se bloque après 2 achats par profil (carte disparaît au 3ème)
4. Reset automatique à minuit (nouveau dateKey) OU quand l'itemId change
5. Ne décrémente JAMAIS marketStock (l'item reste achetable au prix normal via onBuy)
6. Persiste le compteur dans farm-{profileId}.md (champ daily_deal_purchases: YYYY-MM-DD|itemId|count)
7. Enregistre quand même la transaction dans le log marché (action: 'buy') — cohérence comptable
8. Déduit les coins du profil actuel via gami-{id}.md (pattern identique à buyFromMarket)
</success_criteria>

<output>
After completion, create `.planning/quick/260416-pct-deal-du-jour-stock-separe-marche-quota-2/260416-pct-SUMMARY.md`
</output>
