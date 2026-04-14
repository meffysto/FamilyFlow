# Quick Task 260414-jl2 — Marché Boursier Village

## Résumé

Transformation du bâtiment Marché en vrai marché boursier avec prix dynamiques offre/demande.

## Changements

### Créés
- `lib/village/market-engine.ts` — Moteur pur marché boursier (280 lignes)
  - 11 items échangeables (7 village + 4 ferme)
  - Formule prix O&D : `basePrice × (refStock/stock)^0.7`
  - Spread 30% achat/vente, caps [0.25x, 4x]
  - Indicateurs FOMO (tendance, stock, emojis)
  - Rate limiting 10 txn/jour/profil
  - Stock initial équilibré

- `components/village/MarketSheet.tsx` — Interface marché (450 lignes)
  - Modal pageSheet avec onglets Acheter/Vendre
  - Prix dynamiques colorés par tendance (🔴🟠⚪🟢🔵)
  - Sélecteur quantité + total en temps réel
  - Historique des transactions récentes
  - Barre info solde + transactions restantes
  - Flash animation succès

### Modifiés
- `lib/village/types.ts` — Ajout MarketStock, MarketTransaction + champs VillageData
- `lib/village/parser.ts` — Parse/serialize sections ## Marché Stock et ## Marché Log
- `lib/village/catalog.ts` — production: null sur le Marché (plus de panier_surprise)
- `lib/village/atelier-engine.ts` — Supprimé recette panier_pique_nique, remplacé panier_surprise dans 3 recettes/techs
- `lib/village/trade-engine.ts` — Guards null production
- `lib/village/index.ts` — Export market-engine
- `hooks/useGarden.ts` — buyFromMarket/sellToMarket + marketStock/marketTransactions
- `app/(tabs)/village.tsx` — Routing marché → MarketSheet, bouton Marché dans action card
- `components/village/VillageBuildingModal.tsx` — Guard null production
- `components/village/BuildingSprite.tsx` — Guard null production emoji
- `lib/__tests__/village-parser.test.ts` — Ajout champs market, fix palier port 8000

## Design Économique

| Item | Base 🍃 | Stock init | Stock réf |
|------|---------|-----------|----------|
| Eau fraîche | 3 | 25 | 20 |
| Pain frais | 5 | 20 | 15 |
| Café matin | 12 | 12 | 10 |
| Outil forgé | 25 | 8 | 8 |
| Farine | 18 | 10 | 10 |
| Coffre maritime | 35 | 5 | 5 |
| Parchemin | 50 | 4 | 4 |
| Œufs | 4 | 15 | 12 |
| Lait | 7 | 12 | 10 |
| Farine (ferme) | 6 | 12 | 10 |
| Miel | 10 | 8 | 8 |

## Formule Prix

```
buyPrice = round(basePrice × (refStock / max(1, stock))^0.7)
sellPrice = floor(buyPrice × 0.7)
```

Exemples (Eau fraîche, base=3, ref=20) :
- Stock 20 → Buy 3🍃, Sell 2🍃 (normal)
- Stock 5 → Buy 8🍃, Sell 5🍃 (FOMO!)
- Stock 40 → Buy 2🍃, Sell 1🍃 (bradé)
