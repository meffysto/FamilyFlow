---
phase: quick-260424-exi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/budget.tsx
autonomous: true
requirements:
  - BUD-UI-01
  - BUD-UI-02
  - BUD-UI-03
  - BUD-UI-04
must_haves:
  truths:
    - "La carte totale du Résumé affiche le % utilisé et le nombre total de dépenses"
    - "Les catégories du Résumé sont triées : dépassées > proches (>80%) > reste décroissant, avec % affiché sur chaque card"
    - "Les flèches de navigation mensuelle sont des chevrons stylisés ‹ / ›"
    - "Les chips de filtre catégorie (onglet Liste) affichent le montant dépensé à côté du nom"
    - "L'onglet Liste affiche un total montant de la sélection filtrée en plus du compteur d'entrées"
  artifacts:
    - path: "app/(tabs)/budget.tsx"
      provides: "Écran Budget avec UI enrichie (carte totale, tri catégories, chevrons, chips montants, total filtré)"
  key_links:
    - from: "Carte totale Résumé"
      to: "spent / budgetTotal / budgetEntries.length"
      via: "Math.round((spent/budgetTotal)*100) + budgetEntries.length"
      pattern: "% utilisé.*dépenses"
    - from: "Liste catégories Résumé"
      to: "sumByCategory + cat.limit"
      via: "Array trié par urgence (overBudget > >80% > reste décroissant)"
      pattern: "sort.*overBudget"
    - from: "Chips filtre Liste"
      to: "sortedEntries"
      via: "sumByCategory(sortedEntries, categoryDisplay(cat))"
      pattern: "formatAmount.*chip"
    - from: "Résultat filtré Liste"
      to: "filteredEntries"
      via: "filteredEntries.reduce((s,e)=>s+e.amount, 0)"
      pattern: "filteredTotal"
---

<objective>
Enrichir l'interface Budget (`app/(tabs)/budget.tsx`) sur 4 points : (1) carte totale Résumé avec % utilisé + nb dépenses, (2) tri catégories par urgence + % sur cards, (3) chevrons stylisés ‹ / › pour la navigation mensuelle, (4) montants sur chips filtre + total montant filtré (onglet Liste).

Purpose: Améliorer la lisibilité et la priorisation visuelle du suivi budgétaire familial au quotidien.
Output: Fichier `app/(tabs)/budget.tsx` modifié, compatible tsc, respectant les tokens design et `useThemeColors()`.
</objective>

<context>
@CLAUDE.md
@app/(tabs)/budget.tsx
</context>

<interfaces>
Types et helpers déjà présents dans le fichier (aucun import nouveau requis) :

```typescript
// lib/budget (déjà importé)
formatAmount(amount: number): string
categoryDisplay(cat: BudgetCategory): string
sumByCategory(entries: BudgetEntry[], displayName: string): number
totalSpent(entries: BudgetEntry[]): number
totalBudget(config: BudgetConfig): number

// État local déjà présent
budgetEntries: BudgetEntry[]        // toutes les dépenses du mois courant
budgetConfig.categories: BudgetCategory[]  // { name, emoji, limit }
spent: number                       // totalSpent(budgetEntries)
budgetTotal: number                 // totalBudget(budgetConfig)
sortedEntries: BudgetEntry[]        // tri date desc
filteredEntries: BudgetEntry[]      // sortedEntries + filtres

// Tokens design (déjà importés)
Spacing, Radius, FontSize, FontWeight, Shadows
colors.{text,textMuted,textSub,textFaint,error,warning,success,card,border,borderLight,primary,onPrimary}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1 : Enrichir onglet Résumé (carte totale + tri catégories + %)</name>
  <files>app/(tabs)/budget.tsx</files>
  <action>
Dans l'onglet Résumé (bloc `tab === 'resume'`), apporter 3 modifications :

**1a. Carte totale enrichie** (bloc `styles.totalCard`) :
Après le `<View style={styles.totalBar}>...</View>`, ajouter une ligne de stats `styles.totalStats` contenant deux blocs (%utilisé et nb dépenses) séparés par un point médian.
- Calculer `usagePct = budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : 0`
- Calculer `entriesCount = budgetEntries.length`
- Rendu : `{usagePct}% utilisé · {entriesCount} {entriesCount > 1 ? 'dépenses' : 'dépense'}`
- Couleur : `colors.textMuted`, fontSize `FontSize.sm`, fontWeight `FontWeight.semibold`, marginTop `Spacing.md`.
- Ajouter le style `totalStats` dans le `StyleSheet.create`.

**1b. Tri catégories par urgence** :
Remplacer `budgetConfig.categories.map(...)` par un tableau trié. Juste avant le JSX, dans un `useMemo` calé après `priceEvolutions` :

```typescript
const sortedCategories = useMemo(() => {
  return [...budgetConfig.categories]
    .map((cat) => {
      const catSpent = sumByCategory(budgetEntries, categoryDisplay(cat));
      const pct = cat.limit > 0 ? (catSpent / cat.limit) * 100 : 0;
      return { cat, catSpent, pct, overBudget: catSpent > cat.limit };
    })
    .sort((a, b) => {
      // Dépassées en premier
      if (a.overBudget && !b.overBudget) return -1;
      if (!a.overBudget && b.overBudget) return 1;
      // Puis proches (>80%) avant le reste
      const aWarn = a.pct > 80 && !a.overBudget;
      const bWarn = b.pct > 80 && !b.overBudget;
      if (aWarn && !bWarn) return -1;
      if (!aWarn && bWarn) return 1;
      // Enfin, % décroissant
      return b.pct - a.pct;
    });
}, [budgetConfig, budgetEntries]);
```

Puis itérer : `sortedCategories.map(({ cat, catSpent, pct, overBudget }) => (...))`. Supprimer les recalculs `catSpent`/`pct`/`overBudget` internes devenus doublons.

**1c. % affiché sur chaque card catégorie** :
Dans `styles.catHeader`, entre `catName` et `catAmount`, insérer un `Text` affichant `{Math.round(pct)}%`.
- Couleur : `overBudget ? colors.error : pct > 80 ? colors.warning : colors.textMuted`
- Style : nouveau `catPct` avec `fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginHorizontal: Spacing.md`.

Contraintes :
- Aucune couleur hardcodée, tout via `useThemeColors()`.
- Pas de commentaires superflus, uniquement commentaires UI en français si utile.
- Tokens design uniquement (Spacing, FontSize, FontWeight).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
- La carte totale affiche "XX% utilisé · N dépenses" sous la barre de progression.
- Les catégories sont triées : dépassées rouges en premier, puis >80% warning, puis le reste par % décroissant.
- Chaque card catégorie montre le % à côté du nom (coloré selon seuil).
- `npx tsc --noEmit` passe sans nouvelle erreur.
  </done>
</task>

<task type="auto">
  <name>Task 2 : Chevrons stylisés + chips avec montants + total filtré</name>
  <files>app/(tabs)/budget.tsx</files>
  <action>
**2a. Chevrons stylisés (navigation mensuelle)** :
Dans le bloc `monthNav` (lignes ~462-470), remplacer :
- `{'<'}` par `{'‹'}`
- `{'>'}` par `{'›'}`

Mettre à jour le style `monthArrow` pour un look amélioré :
```typescript
monthArrow: {
  fontSize: FontSize.hero,        // plus grand pour le chevron fin
  fontWeight: FontWeight.medium,  // le chevron ‹ est déjà fin, medium suffit
  lineHeight: FontSize.hero,
  paddingHorizontal: Spacing.md,
},
```

**2b. Chips filtre avec montants (onglet Liste)** :
Dans le `ScrollView horizontal` des filtres (bloc `styles.filterChipRow`, lignes ~578-605), modifier le `.map` pour afficher le montant dépensé par catégorie sur les chips.

Avant le `.map`, calculer un lookup via `useMemo` situé près de `filteredEntries` :
```typescript
const categorySpentMap = useMemo(() => {
  const map = new Map<string, number>();
  for (const cat of budgetConfig.categories) {
    const display = categoryDisplay(cat);
    map.set(display, sumByCategory(sortedEntries, display));
  }
  return map;
}, [budgetConfig, sortedEntries]);
```

Dans le rendu du chip, remplacer `{cat.emoji} {cat.name}` par `{cat.emoji} {cat.name} · {formatAmount(catSpent)}` où `catSpent = categorySpentMap.get(catDisplay) ?? 0`.

Attention : ce pattern de chip est aussi utilisé dans la modal d'ajout (bloc `chipRow`) — **ne pas toucher à la modal d'ajout**, les montants doivent apparaître UNIQUEMENT sur les chips de filtre de l'onglet Liste.

**2c. Total montant sur le compteur d'entrées filtrées** :
Dans le bloc `resultCount` (lignes ~607-617), enrichir le texte pour inclure le total montant des `filteredEntries`.

Avant le rendu, calculer :
```typescript
const filteredTotalAmount = useMemo(
  () => filteredEntries.reduce((sum, e) => sum + e.amount, 0),
  [filteredEntries]
);
```

Puis modifier le rendu :
- Si `isFiltered` : `{t('budget.filter.resultFiltered', { filtered, total })} · {formatAmount(filteredTotalAmount)}`
- Sinon : `{t('budget.filter.resultAll', { count })} · {formatAmount(filteredTotalAmount)}`

Format concaténé simple en JSX (`{...} · {...}`), pas de nouvelle clé i18n.

Contraintes :
- Aucune couleur hardcodée.
- Tokens design uniquement.
- Commentaires UI en français, minimaux.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
- Les flèches `<` et `>` de la navigation mensuelle sont remplacées par `‹` et `›` avec un style amélioré.
- Les chips de filtre de l'onglet Liste affichent `{emoji} {nom} · {montant}€`.
- La modal d'ajout (chips catégorie) reste inchangée (pas de montants ajoutés).
- Le compteur sous les chips affiche `N dépenses · montant€` (ou variante filtrée).
- `npx tsc --noEmit` passe sans nouvelle erreur.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — aucune nouvelle erreur TS
2. Lancement visuel (si device disponible) :
   - Onglet Résumé : carte totale avec "X% utilisé · N dépenses", catégories triées (rouges en premier), % sur chaque card
   - Navigation mensuelle : chevrons ‹ / › visibles et stylés
   - Onglet Liste : chips filtre avec montants, compteur avec total montant
3. Aucune couleur hardcodée introduite (`grep -n "#[0-9a-fA-F]\{6\}" app/\(tabs\)/budget.tsx` doit rester au même nombre d'occurrences qu'avant).
</verification>

<success_criteria>
- Les 4 améliorations UI sont toutes visibles et fonctionnelles.
- Aucune régression sur les autres flows (modal d'ajout, scanner ticket, sélection multiple, onglet évolution).
- Type check passe.
- Respect strict CLAUDE.md : `useThemeColors()`, tokens design, français, pas de RN Animated (aucune animation ajoutée de toute façon).
</success_criteria>

<output>
Après complétion, créer `.planning/quick/260424-exi-am-liorer-interface-budget-carte-totale-/260424-exi-SUMMARY.md`.
</output>
