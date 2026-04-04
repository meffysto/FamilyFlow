---
phase: 260404-kbd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mascot/farm-engine.ts
  - components/mascot/FarmPlots.tsx
autonomous: true
requirements: [HYBRID-FARM]
must_haves:
  truths:
    - "Toutes les cultures non-matures avancent a chaque tache completee"
    - "Le plot principal (FIFO le plus ancien non-mature) avance a vitesse pleine"
    - "Les autres plots non-matures avancent a demi-vitesse (seasonBonus * 0.5)"
    - "Un indicateur visuel (border bleue + badge eclair) marque le plot principal"
    - "L'indicateur n'apparait pas sur les plots matures ou vides"
  artifacts:
    - path: "lib/mascot/farm-engine.ts"
      provides: "advanceFarmCrops hybride + getMainPlotIndex + parseFloat dans parseCrops"
      exports: ["advanceFarmCrops", "getMainPlotIndex", "parseCrops", "serializeCrops"]
    - path: "components/mascot/FarmPlots.tsx"
      provides: "Indicateur visuel plot principal (border bleue + badge eclair)"
  key_links:
    - from: "components/mascot/FarmPlots.tsx"
      to: "lib/mascot/farm-engine.ts"
      via: "import getMainPlotIndex"
      pattern: "getMainPlotIndex"
---

<objective>
Systeme hybride ferme : le plot principal (FIFO) avance a vitesse pleine, les autres plots avancent a demi-vitesse. Indicateur visuel sur le plot principal.

Purpose: Actuellement seul le premier crop FIFO avance — les autres stagnent. Ce changement rend la ferme plus dynamique en faisant progresser toutes les cultures simultanement, avec une priorite claire sur l'ancienne.
Output: advanceFarmCrops modifie, getMainPlotIndex exporte, indicateur visuel dans FarmPlots.tsx
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/mascot/farm-engine.ts
@lib/mascot/types.ts
@components/mascot/FarmPlots.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Logique hybride advanceFarmCrops + getMainPlotIndex + parseFloat</name>
  <files>lib/mascot/farm-engine.ts</files>
  <action>
Trois modifications dans farm-engine.ts :

1. **parseCrops** (ligne ~149) : Remplacer `parseInt(tasksCompleted, 10)` par `parseFloat(tasksCompleted)` pour supporter les valeurs decimales (demi-vitesse = +0.5). Le reste (plotIndex, currentStage) reste parseInt. serializeCrops n'a pas besoin de changement — le template string `${c.tasksCompleted}` serialise deja les floats correctement.

2. **advanceFarmCrops** (lignes 74-110) : Remplacer la logique "seul le premier crop avance" par :
   - Trier par date (FIFO, meme tri existant)
   - Identifier le targetIdx = premier non-mature (index dans sorted) — c'est le "plot principal"
   - Boucler sur TOUS les crops non-matures dans sorted :
     - Si c'est le targetIdx (plot principal) : `tasksCompleted += seasonBonus` (inchange, vitesse pleine)
     - Sinon : `tasksCompleted += seasonBonus * 0.5` (demi-vitesse)
   - Pour chaque crop modifie, verifier le seuil effectiveTasksPerStage et avancer de stade si atteint (meme logique existante avec techBonuses)
   - Collecter tous les crops devenus matures dans le tableau matured
   - Retourner { crops: sorted, matured }

3. **Nouvelle fonction exportee getMainPlotIndex** (apres advanceFarmCrops) :
   ```typescript
   export function getMainPlotIndex(crops: PlantedCrop[]): number | null {
     if (crops.length === 0) return null;
     const sorted = [...crops].sort(
       (a, b) => a.plantedAt.localeCompare(b.plantedAt) || a.plotIndex - b.plotIndex,
     );
     const target = sorted.find(c => c.currentStage < 4);
     return target ? target.plotIndex : null;
   }
   ```
   Retourne le plotIndex (pas l'index dans le tableau) du crop le plus ancien non-mature, ou null si tous matures.
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -E "farm-engine|FarmPlots" | head -20</automated>
  </verify>
  <done>advanceFarmCrops avance tous les crops (principal pleine vitesse, autres demi-vitesse), parseCrops utilise parseFloat pour tasksCompleted, getMainPlotIndex est exporte</done>
</task>

<task type="auto">
  <name>Task 2: Indicateur visuel plot principal dans FarmPlots.tsx</name>
  <files>components/mascot/FarmPlots.tsx</files>
  <action>
Modifications dans FarmPlots.tsx :

1. **Import** : Ajouter `getMainPlotIndex` a l'import depuis `../../lib/mascot/farm-engine` (a cote de parseCrops existant).

2. **FarmPlots component** (fonction principale, ligne ~121) : Apres `const crops = parseCrops(farmCropsCSV)`, calculer :
   ```typescript
   const mainPlotIndex = getMainPlotIndex(crops);
   ```

3. **Passer isMainPlot a FarmPlot** : Dans le map, ajouter la prop :
   ```typescript
   isMainPlot={crop !== null && !isMature && crop.plotIndex === mainPlotIndex}
   ```
   (false si pas de crop, false si mature, false si pas le principal)

4. **FarmPlot component** : Ajouter `isMainPlot: boolean` dans les props du composant (ligne ~37).

5. **Rendu indicateur** dans FarmPlot, juste apres le fond terre (Image DIRT_SPRITE) et avant les glows existantes, ajouter :
   ```tsx
   {isMainPlot && (
     <>
       <View style={styles.mainPlotBorder} />
       <Text style={styles.mainPlotBadge}>⚡</Text>
     </>
   )}
   ```

6. **Styles** a ajouter dans le StyleSheet :
   ```typescript
   mainPlotBorder: {
     position: 'absolute',
     width: '100%',
     height: '100%',
     borderRadius: 8,
     borderWidth: 2,
     borderColor: '#60A5FA',
     backgroundColor: 'rgba(96, 165, 250, 0.08)',
   },
   mainPlotBadge: {
     position: 'absolute',
     top: -2,
     right: -2,
     fontSize: 10,
     zIndex: 10,
   },
   ```
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -E "farm-engine|FarmPlots" | head -20</automated>
  </verify>
  <done>Le plot principal affiche une border bleue #60A5FA et un badge eclair en coin superieur droit. L'indicateur n'apparait pas sur les plots matures ou vides.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` ne produit pas de nouvelles erreurs dans farm-engine.ts ou FarmPlots.tsx
- getMainPlotIndex est bien exporte et importe
- advanceFarmCrops modifie tous les crops non-matures (pas juste le premier)
- parseCrops utilise parseFloat pour tasksCompleted
</verification>

<success_criteria>
- Toutes les cultures non-matures progressent a chaque tache completee
- Le plot principal progresse 2x plus vite que les autres
- L'indicateur visuel (border bleue + eclair) identifie clairement le plot principal
- Pas de regression sur les cultures matures, la recolte, la plantation
</success_criteria>

<output>
After completion, create `.planning/quick/260404-kbd-syst-me-hybride-ferme-plot-principal-vit/260404-kbd-SUMMARY.md`
</output>
