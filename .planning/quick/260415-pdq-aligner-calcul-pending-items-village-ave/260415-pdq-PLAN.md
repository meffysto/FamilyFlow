---
phase: quick-260415-pdq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/village.tsx
  - components/village/VillageBuildingModal.tsx
autonomous: true
requirements: [BUG-pending-items-mismatch]
must_haves:
  truths:
    - "Le badge pending sur les bâtiments village affiche le même nombre que getPendingItems dans useGarden"
    - "Le modal bâtiment affiche le même nombre de pending items que le badge"
    - "La barre de progression dans le modal utilise le taux effectif (avec multiplier tech)"
  artifacts:
    - path: "app/(tabs)/village.tsx"
      provides: "Calcul pending avec villageTechBonuses.productionRateMultiplier"
      contains: "productionRateMultiplier"
    - path: "components/village/VillageBuildingModal.tsx"
      provides: "Calcul pending + progress avec multiplier tech"
      contains: "productionRateMultiplier"
  key_links:
    - from: "app/(tabs)/village.tsx"
      to: "hooks/useGarden.ts"
      via: "villageTechBonuses destructuré depuis useGarden"
      pattern: "villageTechBonuses"
    - from: "components/village/VillageBuildingModal.tsx"
      to: "app/(tabs)/village.tsx"
      via: "prop techMultiplier passé au modal"
      pattern: "techMultiplier"
---

<objective>
Aligner le calcul des pending items dans village.tsx et VillageBuildingModal.tsx avec la référence correcte dans useGarden.ts getPendingItems.

Purpose: Le badge portail montre des items à collecter (getPendingItems correct) mais la page village montre 0 car elle divise par ratePerItem brut au lieu du taux effectif (ratePerItem * productionRateMultiplier). Le modal a le même bug.

Output: Les 3 endroits qui calculent pending items utilisent la même formule avec villageTechBonuses.productionRateMultiplier.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@hooks/useGarden.ts (lignes 304-315 — formule de référence)
@app/(tabs)/village.tsx (ligne 748 — bug)
@components/village/VillageBuildingModal.tsx (lignes 175-178 — bug)
@lib/village/atelier-engine.ts (VillageTechBonuses type + computeVillageTechBonuses)

<interfaces>
<!-- Formule de référence dans useGarden.ts getPendingItems (lignes 304-315) -->
```typescript
const multiplier = villageTechBonuses.productionRateMultiplier[buildingId] ?? 1;
const effectiveRate = Math.max(1, Math.floor(entry.production.ratePerItem * multiplier));
return Math.floor(available / effectiveRate);
```

<!-- Type VillageTechBonuses depuis lib/village/atelier-engine.ts -->
```typescript
export interface VillageTechBonuses {
  // ...
  productionRateMultiplier: Record<string, number>;
  // ...
}
```

<!-- villageTechBonuses déjà destructuré dans village.tsx ligne 355 -->
```typescript
const { ..., villageTechBonuses, ... } = useGarden();
```

<!-- Props actuelles VillageBuildingModal -->
```typescript
interface VillageBuildingModalProps {
  visible: boolean;
  building: UnlockedBuilding;
  lifetimeContributions: number;
  productionState: BuildingProductionState;
  inventory: VillageInventory;
  onCollect: (buildingId: string) => void;
  onClose: () => void;
  onOpenTrade?: () => void;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tâche 1: Appliquer le multiplier tech dans village.tsx et VillageBuildingModal.tsx</name>
  <files>app/(tabs)/village.tsx, components/village/VillageBuildingModal.tsx</files>
  <action>
**village.tsx — ligne 748 dans le .map(ub => ...):**

Remplacer :
```
const pending = catalogEntry?.production ? Math.floor(available / catalogEntry.production.ratePerItem) : 0;
```
Par (formule identique à getPendingItems dans useGarden.ts) :
```typescript
const multiplier = villageTechBonuses.productionRateMultiplier[ub.buildingId] ?? 1;
const effectiveRate = Math.max(1, Math.floor(catalogEntry.production.ratePerItem * multiplier));
const pending = catalogEntry?.production ? Math.floor(available / effectiveRate) : 0;
```

`villageTechBonuses` est déjà destructuré depuis useGarden() à la ligne 355 — rien d'autre à importer.

**VillageBuildingModal.tsx — ajouter prop + corriger calcul:**

1. Ajouter `techMultiplier?: number` dans VillageBuildingModalProps (optionnel, default 1 pour retrocompat).

2. Destructurer dans le composant : `const techMultiplier = props.techMultiplier ?? 1;`

3. Remplacer les lignes 175-178 :
```typescript
// AVANT (bug):
const pendingItems = Math.floor(available / production.ratePerItem);
const progressInCycle = available % production.ratePerItem;
const progressRatio = production.ratePerItem > 0 ? progressInCycle / production.ratePerItem : 0;
const contribsUntilNext = production.ratePerItem - progressInCycle;

// APRÈS (corrigé):
const effectiveRate = Math.max(1, Math.floor(production.ratePerItem * techMultiplier));
const pendingItems = Math.floor(available / effectiveRate);
const progressInCycle = available % effectiveRate;
const progressRatio = effectiveRate > 0 ? progressInCycle / effectiveRate : 0;
const contribsUntilNext = effectiveRate - progressInCycle;
```

**village.tsx — passer la prop au modal (vers ligne 1020-1040 où VillageBuildingModal est rendu):**

Ajouter `techMultiplier={villageTechBonuses.productionRateMultiplier[selectedBuilding.buildingId] ?? 1}` dans les props du composant VillageBuildingModal.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Les 3 endroits (useGarden.ts, village.tsx, VillageBuildingModal.tsx) utilisent la même formule effectiveRate = Math.max(1, Math.floor(ratePerItem * multiplier)). Le badge et le modal affichent les mêmes valeurs que getPendingItems. tsc passe sans erreur.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — pas d'erreur de types
2. Vérifier visuellement : le badge sur un bâtiment village doit afficher le même nombre que le modal quand on le tape, et le même nombre que le badge portail dans la ferme perso
</verification>

<success_criteria>
- Les pending items village.tsx et VillageBuildingModal.tsx correspondent à getPendingItems de useGarden.ts
- La barre de progression dans le modal utilise effectiveRate
- tsc passe sans erreur
</success_criteria>

<output>
After completion, create `.planning/quick/260415-pdq-aligner-calcul-pending-items-village-ave/260415-pdq-01-SUMMARY.md`
</output>
