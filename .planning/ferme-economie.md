# Économie de la Ferme — Référence Complète

> Fichier de référence pour analyser et équilibrer le système de progression.

---

## Bâtiments (Unlock + Upgrades)

| Bâtiment | Unlock | Stage min | Upgrade L2 | Upgrade L3 | Production de base |
|----------|--------|-----------|------------|------------|--------------------|
| Poulailler | 300 🍃 | Pousse | 500 🍃 | 1 200 🍃 | 1 œuf / 8h |
| Grange | 800 🍃 | Arbuste | 800 🍃 | 2 000 🍃 | 1 lait / 10h |
| Moulin | 1 500 🍃 | Arbre | 1 500 🍃 | 3 000 🍃 | 1 farine / 12h |
| Ruche | 2 000 🍃 | Pousse* | 2 000 🍃 | 4 000 🍃 | 1 miel / 12h |

*Requiert tech `elevage-3`

**Coût total upgrades (tous bâtiments L3) :** 15 000 🍃

### Valeur implicite des ressources (pour calcul recettes)

| Ressource | Valeur de base |
|-----------|---------------|
| Œuf | 80 🍃 |
| Lait | 100 🍃 |
| Farine | 90 🍃 |
| Miel | 120 🍃 |

---

## Cultures (Graines)

### Cultures achetables

| Culture | Stage min | Coût graine | Récompense | Profit | Tasks/stage | Saison bonus |
|---------|-----------|-------------|------------|--------|-------------|--------------|
| Carotte 🥕 | Pousse | 5 🍃 | 25 🍃 | +20 | 1 | Printemps |
| Blé 🌾 | Pousse | 10 🍃 | 40 🍃 | +30 | 1 | — |
| Pomme de terre 🥔 | Pousse | 8 🍃 | 35 🍃 | +27 | 1 | Printemps |
| Betterave 🫜 | Pousse | 6 🍃 | 30 🍃 | +24 | 1 | Automne |
| Tomate 🍅 | Arbuste | 15 🍃 | 80 🍃 | +65 | 2 | Été |
| Chou 🥬 | Arbuste | 12 🍃 | 70 🍃 | +58 | 2 | — |
| Concombre 🥒 | Arbuste | 14 🍃 | 75 🍃 | +61 | 2 | Été |
| Fraise 🍓 | Arbre | 25 🍃 | 120 🍃 | +95 | 2 | Été |
| Maïs 🌽 | Arbre | 30 🍃 | 150 🍃 | +120 | 3 | Été |
| Tournesol 🌻 | Pousse* | 20 🍃 | 100 🍃 | +80 | 2 | — |
| Citrouille 🎃 | Majestueux | 40 🍃 | 200 🍃 | +160 | 3 | Automne |

*Requiert tech `culture-3`

### Graines rares (drop uniquement, non achetables)

| Culture | Stage min | Récompense | Tasks/stage | Chance drop | Source |
|---------|-----------|------------|-------------|-------------|--------|
| Orchidée 🪻 | Arbuste | 300 🍃 | 3 | 8% | Tomate, chou, concombre, maïs, fraise, citrouille, tournesol |
| Rose Dorée 🌹 | Arbre | 500 🍃 | 4 | 8% | Maïs, fraise, citrouille |
| Truffe 🍄 | Majestueux | 800 🍃 | 5 | 8% | Citrouille, tournesol |
| Fruit du Dragon 🐉 | Arbre | 600 🍃 | 4 | 2% | N'importe quelle culture |

### Mécaniques spéciales cultures

- **Culture d'or :** 3% de chance au semis → récompense x5
- **Bonus saisonnier :** +2 tasks/stage quand la culture est de saison
- **Tech culture-2 :** 25% de chance de double récolte
- **Tech culture-4 :** 50% de chance de double récolte

---

## Recettes

### Stage Pousse (niv 3-5)

| Recette | Ingrédients | Coût matières* | Vente | Profit brut | Profit/ingrédient |
|---------|-------------|---------------|-------|-------------|-------------------|
| Soupe 🥣 | Carotte ×1, Pomme de terre ×1 | 55 🍃 | 120 🍃 | +65 | +32.5 |
| Bouquet 💐 | Chou ×1, Carotte ×1 | 82 🍃 | 190 🍃 | +108 | +54 |
| Crêpe 🥞 | Œuf ×1, Blé ×1 | 120 🍃 | 240 🍃 | +120 | +60 |

### Stage Arbuste (niv 6-10)

| Recette | Ingrédients | Coût matières* | Vente | Profit brut | Note |
|---------|-------------|---------------|-------|-------------|------|
| **Fromage 🧀** | Lait ×2 | 200 🍃 | 400 🍃 | +200 | ⚠️ Trop rentable (x2 lait simple) |
| Gratin 🫕 | Lait ×1, Pomme de terre ×1, Œuf ×1 | 243 🍃 | 430 🍃 | +187 | OK |
| Omelette 🍳 | Œuf ×2, Tomate ×1 | 255 🍃 | 520 🍃 | +265 | OK |
| Hydromel 🍯 | Miel ×3 | 360 🍃 | 720 🍃 | +360 | OK (x3 ingrédients) |
| Nougat 🍬 | Miel ×1, Œuf ×1, Farine ×1 | 290 🍃 | 580 🍃 | +290 | OK |
| Pain d'Épices 🍪 | Miel ×1, Farine ×2 | 300 🍃 | 600 🍃 | +300 | OK |
| Parfum d'Orchidée 🪻 | Orchidée ×2, Miel ×1 | ~720 🍃 | 1 200 🍃 | +480 | OK (rares) |

*Coût matières = valeur base des ressources bâtiment (pas le temps de production)

### Stage Arbre (niv 11-18)

| Recette | Ingrédients | Vente | Note |
|---------|-------------|-------|------|
| Pain 🍞 | Farine ×2, Blé ×1 | 440 🍃 | OK |
| Confiture 🍓 | Fraise ×2 | 480 🍃 | OK |
| Pop-corn 🍿 | Maïs ×2 | 600 🍃 | OK |
| Huile de Tournesol 🫙 | Tournesol ×2 | 400 🍃 | Sous-évalué (tournesol = 100 chacun → 200 de base) |
| Brioche Tournesol 🥐 | Tournesol ×1, Farine ×1 | 380 🍃 | Sous-évalué |
| Gâteau 🎂 | Farine ×1, Œuf ×1, Fraise ×1 | 580 🍃 | OK |
| Confiture Royale 🌹 | Rose Dorée ×1, Fraise ×1, Miel ×1 | 1 500 🍃 | OK (rare) |

### Stage Majestueux (niv 19+)

| Recette | Ingrédients | Vente | Note |
|---------|-------------|-------|------|
| Soupe Citrouille 🎃 | Citrouille ×1, Lait ×1 | 600 🍃 | OK |
| Tarte Citrouille 🥧 | Citrouille ×1, Farine ×1, Œuf ×1 | 740 🍃 | OK |
| Risotto Truffe 🍄 | Truffe ×1, Farine ×1, Lait ×1 | 2 000 🍃 | OK (truffe rare) |

---

## Arbre Technologique

### Branche Culture

| Tech | Coût | Prérequis | Effet |
|------|------|-----------|-------|
| culture-1 | 750 🍃 | — | -1 task/stage culture |
| culture-2 | 2 000 🍃 | culture-1 | 25% double récolte |
| culture-3 | 4 000 🍃 | culture-2 | Débloque tournesol |
| culture-4 | 7 500 🍃 | culture-3 | 50% double récolte |

### Branche Élevage

| Tech | Coût | Prérequis | Effet |
|------|------|-----------|-------|
| elevage-1 | 750 🍃 | — | -25% temps de production bâtiment |
| elevage-2 | 2 000 🍃 | elevage-1 | ×2 capacité stockage bâtiment (3 → 6) |
| elevage-3 | 5 000 🍃 | elevage-2 | Débloque ruche + miel |

### Branche Expansion

| Tech | Coût | Prérequis | Effet |
|------|------|-----------|-------|
| expansion-1 | 1 000 🍃 | — | +1 cellule bâtiment |
| expansion-2 | 3 000 🍃 | expansion-1 | +5 parcelles culture |
| expansion-3 | 7 500 🍃 | expansion-2 | Débloque grande parcelle |

**Coût total arbre tech complet :** 33 500 🍃

---

## Déblocages par stage

| Stage | Niveaux | Parcelles cultures | Slots bâtiments |
|-------|---------|--------------------|-----------------|
| Graine | 1-2 | 0 | 0 |
| Pousse | 3-5 | 3 | 1 |
| Arbuste | 6-10 | 5 | 2 |
| Arbre | 11-18 | 7 | 3 |
| Majestueux | 19-30 | 9 | 4 |
| Légendaire | 31-50 | 12 | 5 |

---

## Décorations & Habitants (coûts)

### Décorations

| Item | Coût | Rareté | Stage min |
|------|------|--------|-----------|
| Guirlandes 🎄 | 150 🍃 | Commun | Pousse |
| Coccinelle 🐞 | 150 🍃 | Commun | Pousse |
| Botte de Foin 🌾 | 150 🍃 | Commun | Pousse |
| Papillons 🦋 | 200 🍃 | Commun | Pousse |
| Balançoire 🪢 | 200 🍃 | Commun | Arbuste |
| Lanterne 🏮 | 300 🍃 | Rare | Arbuste |
| Nid 🪹 | 400 🍃 | Rare | Arbre |
| Cabane 🏠 | 500 🍃 | Rare | Arbre |
| Étal de Fruits 🍎 | 500 🍃 | Épique | Arbre |
| Hamac 🛌 | 600 🍃 | Épique | Arbre |
| Fontaine ⛲ | 1 000 🍃 | Épique | Majestueux |
| Couronne 👑 | 5 000 🍃 | Légendaire | Légendaire |
| Portail 🌀 | 12 000 🍃 | Prestige | Majestueux |
| Cristal 💎 | 15 000 🍃 | Prestige | Légendaire |

### Habitants

| Item | Coût | Rareté | Stage min |
|------|------|--------|-----------|
| Oiseau 🐦 | 100 🍃 | Commun | Arbuste |
| Poussin 🐤 | 150 🍃 | Commun | Pousse |
| Coccinelle 🐞 | 150 🍃 | Commun | Pousse |
| Papillons 🦋 | 200 🍃 | Commun | Pousse |
| Écureuil 🐿️ | 250 🍃 | Commun | Arbuste |
| Poulet 🐔 | 250 🍃 | Commun | Arbuste |
| Canard 🦆 | 300 🍃 | Commun | Arbuste |
| Hibou 🦉 | 400 🍃 | Rare | Arbre |
| Chat 😺 | 500 🍃 | Rare | Arbre |
| Cochon 🐷 | 500 🍃 | Rare | Arbre |
| Vache 🐄 | 800 🍃 | Rare | Arbre |
| Fée 🧚 | 2 000 🍃 | Épique | Majestueux |
| Dragon 🐉 | 10 000 🍃 | Légendaire | Légendaire |
| Phoenix 🔥 | 15 000 🍃 | Prestige | Légendaire |
| Licorne 🦄 | 20 000 🍃 | Prestige | Légendaire |

---

## Usure & Réparations

| Événement | Coût réparation | Trigger | Effet |
|-----------|----------------|---------|-------|
| Clôture cassée | 15 🍃 | 33%/jour | Bloque 1 parcelle culture |
| Toit endommagé | 25 🍃 | 20%/jour | -50% production bâtiment |
| Mauvaises herbes | 0 🍃 | Parcelle vide >48h | Visuel uniquement |
| Nuisibles | 0 🍃 | Bâtiment plein >48h | -1 à -3 ressources/jour |

---

## Production effective par tier

> Modèle "joueur actif" : collecte 2×/jour. Les cadences incluent les upgrades bâtiments et techs typiquement disponibles à chaque stage.

### Tier 1 — Pousse (niv 3-5)
**Setup typique :** Poulailler L1, 0 tech, 3 parcelles, 1 slot bâtiment

| Ressource | Cadence | Max/jour (cap 3) |
|-----------|---------|------------------|
| Œuf | 1 / 8h | 3/jour |

**Recettes accessibles :** Crêpe (œuf+blé) → ~1-2/jour → **240–480 🍃/jour**

---

### Tier 2 — Arbuste (niv 6-10)
**Setup typique :** Poulailler L1-L2, Grange L1, elevage-1 possible, 2 slots bâtiments

| Ressource | Sans tech | Avec elevage-1 (-25%) | Max/jour (2× collecte) |
|-----------|-----------|----------------------|------------------------|
| Œuf (L1) | 1 / 8h | 1 / 6h | 3–4/jour |
| Œuf (L2) | 1 / 6h | 1 / 4.5h | 4–5/jour |
| Lait (L1) | 1 / 10h | 1 / 7.5h | 2–3/jour |

**Fromage (Lait ×2) :**

| Scénario | Laits/jour | Fromages/jour | Revenu/jour |
|----------|-----------|---------------|-------------|
| Grange L1, sans tech | 2–3 | 1–1.5 | 400–600 🍃 |
| Grange L1 + elevage-1 | 3 | 1.5 | 600 🍃 |

---

### Tier 3 — Arbre (niv 11-18)
**Setup typique :** Poulailler L2-L3, Grange L2, Moulin L1, elevage-1 + elevage-2 (storage ×2 → cap 6), culture-1

| Ressource | Cadence effective | Max/jour (cap 6, 2× collecte) |
|-----------|------------------|-------------------------------|
| Œuf (L2 + elevage-1) | 1 / 4.5h | ~5/jour |
| Œuf (L3 + elevage-1) | 1 / 3h | 6/jour |
| Lait (L2 + elevage-1) | 1 / 5.25h | ~4–5/jour |
| Farine (L1 + elevage-1) | 1 / 9h | 2–3/jour |

**Fromage (Lait ×2) :**

| Scénario | Laits/jour | Fromages/jour | Revenu/jour |
|----------|-----------|---------------|-------------|
| Grange L2 + elevage-1 | 4–5 | 2–2.5 | 800–1 000 🍃 |

**Omelette (Œuf ×2 + Tomate ×1) :** limitée par les tomates (8 tasks/cycle) → ~1–2/jour → 520–1 040 🍃/jour. Plus complexe à chaîner.

**Impact culture-1 sur cultures médium (−1 task/stage) :**

| Culture | Tasks total base | Tasks total + culture-1 | Accélération |
|---------|-----------------|------------------------|--------------|
| Carotte / Blé / Patate | 4 | 3–4 (min 1/stage) | Faible |
| Tomate / Chou / Concombre | 8 | **4** | **÷2** |
| Fraise / Tournesol | 8 | **4** | **÷2** |
| Maïs | 12 | **8** | ÷1.5 |
| Citrouille | 12 | **8** | ÷1.5 |

→ Les cultures médium (tomate, chou, fraise) deviennent deux fois plus rapides. Pop-corn (maïs ×2, 16 tasks → 8 tasks avec culture-1) devient nettement plus spammable.

---

### Tier 4 — Majestueux (niv 19-30)
**Setup typique :** Tous bâtiments L3, elevage-1 + elevage-2 + elevage-3 (ruche), culture-1 + culture-2

| Ressource | Cadence (L3 + elevage-1) | Max/jour (cap 6 avec elevage-2) |
|-----------|--------------------------|--------------------------------|
| Œuf | 1 / 3h | **6/jour** |
| Lait | 1 / 3.75h | **6/jour** |
| Farine | 1 / 3.75h | **6/jour** |
| Miel | 1 / 3.75h | **6/jour** |

**Rendement recettes en Majestueux :**

| Recette | Ingrédients | Craftables/jour | Revenu/jour |
|---------|-------------|-----------------|-------------|
| Fromage 🧀 | Lait ×2 | **3/jour** | **1 200 🍃** |
| Hydromel 🍯 | Miel ×3 | 2/jour | 1 440 🍃 |
| Nougat 🍬 | Miel+Œuf+Farine | 2/jour | 1 160 🍃 |
| Omelette 🍳 | Œuf ×2, Tomate ×1 | limité tomates | variable |
| Risotto Truffe 🍄 | Truffe+Farine+Lait | rare (8% drop) | ~2 000 🍃 à l'unité |

**Bonus culture-2/4 sur drops rares :**
- culture-2 : 25% double récolte → profit moyen ×1.25 sur toutes cultures
- culture-4 : 50% double récolte → profit moyen ×1.5
- Une Orchidée (8% drop) + culture-4 = fréquence sensiblement augmentée → Parfum d'Orchidée (1 200 🍃) devient moins "rare" qu'attendu

---

## Analyse révisée : déséquilibres par tier

### Fromage 🧀 — le problème s'aggrave avec la progression

| Tier | Laits/jour | Fromages/jour | Revenu Fromage | Comparaison Gratin |
|------|-----------|---------------|---------------|--------------------|
| Arbuste sans tech | 2–3 | 1–1.5 | 400–600 🍃 | Gratin : 430 🍃, 3 ingr. |
| Arbuste + elevage-1 | 3 | 1.5 | 600 🍃 | — |
| Arbre + elevage-1+2 | 4–5 | 2–2.5 | 800–1 000 🍃 | — |
| Majestueux + upgrades | 6 | 3 | **1 200 🍃** | — |

Le Gratin (Lait ×1 + Patate ×1 + Œuf ×1 → 430 🍃) demande 3 ingrédients différents à coordonner, pour seulement 30 🍃 de plus. Même à 300 🍃, un Fromage reste rentable à 900 🍃/jour en late game → **il faut un ingrédient supplémentaire pour freiner le scaling, pas juste réduire le prix**.

**Suggestion :**
- Ajouter **Farine ×1** → Fromage = Lait ×2 + Farine ×1
- Nouveau coût matières : ~280 🍃 → prix juste à **420–450 🍃**
- Ça différencie aussi mieux Fromage / Gratin (le Gratin reste plus simple mais moins rentable)

---

### Pop-corn 🍿 — watchlist avec culture-1

- Base : Maïs ×2 → 600 🍃, 12 tasks (3/stage × 4 stages) par maïs
- Avec culture-1 : 8 tasks par maïs → 2 maïs = 16 tasks au lieu de 24
- Reste dans le domaine "raisonnable" pour stage Arbre si les joueurs ont bien investi 750 🍃 dans culture-1
- À garder à l'œil si culture-2 (double récolte) s'ajoute

---

## Simulation : gains journaliers par profil (base 15 tâches/jour)

### Hypothèses du modèle

- **15 tâches/jour** = cadence joueur actif régulier (famille)
- **Crafting gratuit** : les recettes ne consomment pas de tâches (confirmé dans le code)
- **4 stages par culture** (0→4), min 1 tâche/stage (`Math.max(1, ...)` dans le code)
- **culture-1 n'a aucun effet sur les cultures rapides** (1 task/stage → `Math.max(1, 1-1) = 1` → inchangé)
- **culture-1 réduit les cultures médium** : 2/stage → 1/stage = 4 tâches totales (au lieu de 8)
- **culture-1 réduit les cultures lentes** : 3/stage → 2/stage = 8 tâches totales (au lieu de 12)
- **Collecte bâtiments** : 2×/jour → cadences calculées selon tier
- Les profits cultures = récompense récolte − coût graine
- Les coûts d'investissement (unlock/upgrades/techs) ne sont **pas** inclus

---

### Profils modélisés

| Profil | Stage | Bâtiments | Parcelles | Techs actives |
|--------|-------|-----------|-----------|---------------|
| Débutant | Pousse (niv 3-5) | Poulailler L1 (3 œufs/j) | 3 | Aucune |
| Intermédiaire | Arbuste (niv 6-10) | Poulailler L2 (4 œufs/j), Grange L1+e1 (3 laits/j) | 5 | elevage-1 |
| Avancé | Arbre (niv 11-18) | Poulailler L3 (6 œufs/j), Grange L2 (5 laits/j), Moulin L1+e1 (3 farines/j) | 7 | culture-1, elevage-1+2 |
| Expert | Majestueux (niv 19+) | Tous bâtiments L3+e1+e2+e3 (6 de chaque/j) | 9 | culture-1+4, elevage-1+2+3 |

---

### Débutant — Pousse (niv 3-5)

> ⚠️ culture-1 ne réduit PAS les cultures rapides (déjà au minimum de 1 task/stage)

Cultures rapides : 4 tâches/carotte (inchangé avec ou sans culture-1)

| Stratégie | Détail des 15 tâches | Bâtiments | Gain/jour |
|-----------|---------------------|-----------|-----------|
| Cultures seules | 3 carottes (12t) + 3t perdues | — | ~65 🍃 |
| **Recettes (crêpes)** | **1 blé (4t) + 2 carottes (8t) + 3t perdues** | **1 crêpe (œuf+blé) = 230 🍃 net** | **~275 🍃** |

→ Même au stade débutant, coordonner 1 crêpe/jour **×4 le revenu**. Le Poulailler (300 🍃) est rentabilisé en ~2 jours.

---

### Intermédiaire — Arbuste (niv 6-10)

> culture-1 réduit tomate 8 → 4 tâches, mais ce tier n'a probablement pas encore culture-1

Sans culture-1, tomate = 8 tâches/cycle

| Stratégie | Détail des 15 tâches | Bâtiments | Gain/jour |
|-----------|---------------------|-----------|-----------|
| Fromage seul | 3 carottes (12t) + 3t perdues | 1.5 fromages (600 🍃) | ~660 🍃 |
| **Mix omelette + fromage** | **1 tomate (8t) + 1 carotte (4t) + 3t perdues** | **1 omelette (520) + 1.5 fromages (600)** | **~1 140 🍃** |
| Cultures médium seules | 1 tomate (8t) + 1 chou (7t restants → incomplet) | — | ~145 🍃 |

→ La Grange est l'investissement le plus rentable de ce stage : le fromage représente ~53% du revenu total, et le problème de scaling commence déjà à se voir.

---

### Avancé — Arbre (niv 11-18)

> culture-1 actif : tomate 8 → **4 tâches**, fraise 8 → **4 tâches**, maïs 12 → **8 tâches**

| Stratégie | Détail des 15 tâches | Bâtiments | Gain/jour |
|-----------|---------------------|-----------|-----------|
| Fraises + gâteaux | 3 fraises (12t) → 2 gâteaux (limité farines) + 1 fromage | 2 gâteaux (1160) + 1 fromage (400) | ~1 580 🍃 |
| Fraises + confitures | 3 fraises (12t) → 1 confiture + 2 fromages | 1 confiture (480) + 2 fromages (800) | ~1 300 🍃 |
| **Omelettes + fromage** | **3 tomates (12t) + 1 carotte (3t restants)** | **3 omelettes (1560) + 2 fromages (800)** | **~2 380 🍃** |

→ culture-1 est le **tech le plus impactant du jeu** : il double la cadence des cultures médium, ROI de 750 🍃 récupéré en quelques heures de jeu. Les omelettes + fromage dominent clairement.

---

### Expert — Majestueux (niv 19+)

> culture-4 : 50% double récolte → profits cultures ×1.5 en valeur espérée
> Tous bâtiments L3 : 6 œufs + 6 laits + 6 farines + 6 miels / jour

| Stratégie | Détail des 15 tâches | Bâtiments | Gain/jour |
|-----------|---------------------|-----------|-----------|
| Hydromel + omelettes | 3 tomates (12t) → 3 omelettes | 2 hydromels (1440) + 3 omelettes (1560) + 3 fromages (1200) | ~4 200 🍃 |
| Fraises + confitures | 3 fraises (12t) × 1.5 culture-4 = 4.5 | 2 confitures (960) + 6 nougats (3480) | ~4 440 🍃 |
| **Nougat spam + fromages** | **3 fraises (12t) × 1.5 = 4.5 fraises** | **6 nougats (3480) + 3 fromages (1200) + 2 confitures (960)** | **~5 640 🍃** |

→ Le **Nougat** (miel×1 + œuf×1 + farine×1) est **aussi déséquilibré que le Fromage** : il consomme 1 unité de 3 bâtiments différents et donne 580 🍃 × 6 crafts/jour = **3 480 🍃/jour** depuis les bâtiments seuls. C'est le vrai problème late game.

---

### Vue synthétique

| Profil | Strat basique | Strat optimisée | Ratio opt/base |
|--------|:------------:|:---------------:|:--------------:|
| Débutant | 65 🍃/jour | 275 🍃/jour | ×4.2 |
| Intermédiaire | 660 🍃/jour | 1 140 🍃/jour | ×1.7 |
| Avancé | 1 300 🍃/jour | 2 380 🍃/jour | ×1.8 |
| Expert | 4 200 🍃/jour | 5 640 🍃/jour | ×1.3 |

**4 observations clés :**

1. **L'optimisation en early game a l'impact proportionnel le plus fort** (×4.2) — juste en faisant des crêpes au lieu de vendre des carottes
2. **culture-1 ne touche pas les cultures rapides** (carotte, blé, patate) — il n'accélère que medium+ — à noter dans l'UI pour éviter la déception
3. **Le saut Avancé → Expert est de ×2.4** principalement grâce à la Ruche + Nougat spam
4. **Les cultures pures restent toujours sous-optimales** face aux recettes — les bâtiments dominent à tous les stades

---

## Rééquilibrage global — Proposition complète

### Principe de design

Cible : **×2.3–2.5 de gain journalier par tier** (progression régulière).  
Marge par ingrédient selon le stage :

| Stage | Marge / ingrédient | Logique |
|-------|-------------------|---------|
| Pousse | +60 🍃 | Early game, ingrédients faciles |
| Arbuste | +90 🍃 | Bâtiments requis, coordination |
| Arbre | +110 🍃 | culture-1 requis, crops plus longs |
| Majestueux | +130 🍃 | Late game, investissement massif |

Recettes **rares** (ingrédients à drop 8%) : marge ×2–2.5 standard (valeur de collection).  
**Coût implicite** d'une ressource bâtiment = valeur de base (œuf 80, lait 100, farine 90, miel 120).  
**Coût implicite** d'une culture utilisée en ingrédient = son profit net (tomate 65, fraise 95, maïs 120…).

---

### Tableau des changements proposés

#### Stage Pousse

| Recette | Ingrédients | Actuel | Proposé | Δ | Raison |
|---------|-------------|--------|---------|---|--------|
| Soupe 🥣 | Carotte×1 + Patate×1 | 120 🍃 | **150 🍃** | +30 | Trop faible vs Bouquet |
| Bouquet 💐 | Chou×1 + Carotte×1 | 190 🍃 | **200 🍃** | +10 | OK, légère harmonisation |
| Crêpe 🥞 | Œuf×1 + Blé×1 | 240 🍃 | **220 🍃** | −20 | Légèrement trop fort pour le tout début |

#### Stage Arbuste

| Recette | Ingrédients | Actuel | Proposé | Δ | Raison |
|---------|-------------|--------|---------|---|--------|
| **Fromage 🧀** | **Lait×2** | **400 🍃** | **Lait×3 → 480 🍃** | **+1 lait** | Réduit la cadence (2→1.5 craft/j à mid, 3→2 en late). Cohérent culinairement (fromage = beaucoup de lait) |
| Gratin 🫕 | Lait×1 + Patate×1 + Œuf×1 | 430 🍃 | **440 🍃** | +10 | Reste légèrement sous le Fromage pour 3 ingrédients diversifiés |
| **Omelette 🍳** | Œuf×2 + Tomate×1 | 520 🍃 | **440 🍃** | **−80** | Dominait trop en Avancé (1 560 🍃/j à elle seule avec culture-1) |
| Hydromel 🍯 | Miel×3 | 720 🍃 | **660 🍃** | −60 | Ajustement mineur, reste la recette Ruche premium |
| **Nougat 🍬** | **Miel×1 + Œuf×1 + Farine×1** | **580 🍃** | **Miel×2 + Œuf×1 + Farine×1 → 760 🍃** | **+1 miel** | 6 crafts/j → 3 crafts/j (3 480 → 2 280 🍃/j). Miel×2 justifié culinairement |
| Pain d'Épices 🍪 | Miel×1 + Farine×2 | 600 🍃 | **560 🍃** | −40 | Aligne avec la marge cible Arbuste |
| Parfum d'Orchidée 🪻 | Orchidée×2 + Miel×1 | 1 200 🍃 | **1 200 🍃** | — | Rare, valeur de collection, OK |

#### Stage Arbre

| Recette | Ingrédients | Actuel | Proposé | Δ | Raison |
|---------|-------------|--------|---------|---|--------|
| Pain 🍞 | Farine×2 + Blé×1 | 440 🍃 | **480 🍃** | +40 | Sous-évalué pour 3 ingrédients au stade Arbre |
| Confiture 🍓 | Fraise×2 | 480 🍃 | **460 🍃** | −20 | Harmonisation mineure |
| Pop-corn 🍿 | Maïs×2 | 600 🍃 | **540 🍃** | −60 | Maïs devient trop rapide avec culture-1 (8t), 600 était excessif |
| **Huile Tournesol 🫙** | **Tournesol×2** | **400 🍃** | **500 🍃** | **+100** | Était identique au Fromage alors que tournesol est tech-locked |
| **Brioche Tournesol 🥐** | **Tournesol×1 + Farine×1** | **380 🍃** | **440 🍃** | **+60** | Margin trop faible pour un ingrédient tech-locked |
| Gâteau 🎂 | Farine×1 + Œuf×1 + Fraise×1 | 580 🍃 | **540 🍃** | −40 | Aligne avec marge cible Arbre |
| Confiture Royale 🌹 | Rose Dorée×1 + Fraise×1 + Miel×1 | 1 500 🍃 | **1 500 🍃** | — | Rare (8% drop), valeur prestige justifiée |

#### Stage Majestueux

| Recette | Ingrédients | Actuel | Proposé | Δ | Raison |
|---------|-------------|--------|---------|---|--------|
| Soupe Citrouille 🎃 | Citrouille×1 + Lait×1 | 600 🍃 | **560 🍃** | −40 | Harmonisation |
| Tarte Citrouille 🥧 | Citrouille×1 + Farine×1 + Œuf×1 | 740 🍃 | **700 🍃** | −40 | Harmonisation |
| Risotto Truffe 🍄 | Truffe×1 + Farine×1 + Lait×1 | 2 000 🍃 | **2 000 🍃** | — | Truffe très rare (8%), valeur prestige intacte |

---

### Gains journaliers recalculés (stratégie optimale)

| Profil | Avant | Après | Δ |
|--------|------:|------:|---|
| Débutant | 275 🍃/jour | **250 🍃/jour** | −9% |
| Intermédiaire | 1 140 🍃/jour | **940 🍃/jour** | −18% |
| Avancé | 2 380 🍃/jour | **2 100 🍃/jour** | −12% |
| Expert | 5 640 🍃/jour | **4 800 🍃/jour** | −15% |

#### Ratios de progression

| Palier | Avant | Après | Cible |
|--------|------:|------:|------:|
| Débutant → Intermédiaire | ×4.1 | **×3.8** | ×2.5–3.5 |
| Intermédiaire → Avancé | ×2.1 | **×2.2** | ×2–2.5 |
| Avancé → Expert | ×2.4 | **×2.3** | ×2–2.5 |

> Le ratio Débutant → Intermédiaire reste élevé (×3.8) malgré les ajustements — c'est structurel : passer de 1 bâtiment à 2 bâtiments + elevage-1 est le plus grand saut de gameplay. Il est justifié par l'investissement (~2 050 🍃 pour unlock Grange + Poulailler L2 + elevage-1).

---

### Ce qui reste inchangé

| Raison | Recettes |
|--------|----------|
| Rareté (drop 8%+) → valeur de collection justifiée | Parfum d'Orchidée 🪻, Confiture Royale 🌹, Risotto Truffe 🍄 |
| Recette OK, dans les marges cibles | Bouquet 💐, Gratin 🫕, Pain 🍞 |
| Cultures — profits déjà cohérents avec la progression | Toutes (pas de changement sur les récompenses de récolte) |

---

*Généré le 2026-04-04 — référence personnelle développeur*
