# Quick Task: Marché Boursier Village

**ID:** 260414-jl2
**Goal:** Transformer le bâtiment Marché en vrai marché boursier avec offre/demande dynamique, FOMO, achat/vente d'items.

## Task Description

Le Marché (palier 700 feuilles) devient un bâtiment spécial avec sa propre interface :
- Stock initial d'items (village + ferme)
- Prix dynamiques formule bourse : `basePrice * (refStock / currentStock) ^ elasticity`
- Spread achat/vente (marché achète à 70% du prix courant)
- Indicateurs FOMO (tendance, niveau de stock, alertes rupture)
- 10 transactions/jour par profil
- Suppression panier_surprise (production + recettes qui l'utilisent)

## Changes

### 1. `lib/village/market-engine.ts` — CREATE
Moteur pur marché boursier :
- MARKET_ITEMS catalog (village items + farm items, prix de base, stock initial)
- calculateBuyPrice / calculateSellPrice (formule O&D)
- getPriceTrend / getStockLevel (indicateurs FOMO)
- canBuyItem / canSellItem (validation)
- executeBuy / executeSell (mutations pures)
- getTransactionsToday (rate limiting 10/jour)
- initializeMarketStock (stock initial)
- Types: MarketStock, MarketTransaction, MarketItemDef, PriceTrend, StockLevel

### 2. `lib/village/types.ts` — EDIT
Ajouter à VillageData :
- `marketStock: MarketStock` (stock du marché)
- `marketTransactions: MarketTransaction[]` (log 50 dernières)

### 3. `lib/village/parser.ts` — EDIT
Parser/serializer sections `## Marché Stock` et `## Marché Log` dans jardin-familial.md

### 4. `lib/village/catalog.ts` — EDIT
Retirer la production du marché (le bâtiment reste débloquable mais n'a plus de production)

### 5. `lib/village/atelier-engine.ts` — EDIT
- Supprimer recettes utilisant panier_surprise : panier_pique_nique, livre_recettes, parchemin_enluminé
- Ajuster coût atelier-2 (remplacer panier_surprise par autre chose)

### 6. `lib/village/index.ts` — EDIT
Ajouter export du market-engine

### 7. `components/village/MarketSheet.tsx` — CREATE
Interface marché (pageSheet modal) :
- Header avec coins du profil + compteur transactions
- Liste items avec prix dynamiques, tendances, niveaux stock
- Onglets Acheter / Vendre
- Sélecteur quantité
- Indicateurs FOMO visuels (couleurs, icônes tendance)

### 8. `hooks/useGarden.ts` — EDIT
Exposer : marketStock, marketTransactions, buyFromMarket(), sellToMarket(), marketTxnsToday

### 9. `app/(tabs)/village.tsx` — EDIT
- Router tap marché vers MarketSheet (pas VillageBuildingModal)
- Ajouter state showMarket + MarketSheet dans le render

## Execution Order

1. market-engine.ts (fondation pure)
2. types.ts + parser.ts (données)
3. catalog.ts + atelier-engine.ts (cleanup panier_surprise)
4. index.ts (barrel)
5. useGarden.ts (hook integration)
6. MarketSheet.tsx (UI)
7. village.tsx (câblage final)
