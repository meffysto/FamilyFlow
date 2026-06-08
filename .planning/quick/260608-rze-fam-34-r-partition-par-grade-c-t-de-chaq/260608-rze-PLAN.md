---
phase: quick-260608-rze
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/mascot/CraftSheet.tsx
autonomous: true
requirements: [FAM-34]

must_haves:
  truths:
    - "Chaque récolte de l'onglet Inventaire affiche sa répartition par grade sous le total (ex: 8 ⚪️ 2 🟢 1 🟡)"
    - "Seuls les grades avec une quantité > 0 sont affichés"
    - "Le total existant (x{qty} — {prix} 🍃/vendre) reste inchangé au-dessus"
  artifacts:
    - path: "components/mascot/CraftSheet.tsx"
      provides: "Répartition par grade calculée dans harvestEntries + ligne de rendu sous inventoryQty + style inventoryGrades"
      contains: "inventoryGrades"
  key_links:
    - from: "harvestEntries useMemo"
      to: "countItemByGrade(harvestInventory, cropId, grade)"
      via: "itération GRADE_ORDER"
      pattern: "countItemByGrade"
    - from: "ligne de rendu Récoltes"
      to: "gradeBreakdown"
      via: "Text sous inventoryQty"
      pattern: "inventoryGrades"
---

<objective>
Afficher la répartition par grade (ordinaire/beau/superbe/parfait) sous chaque récolte dans Atelier > Inventaire > Récoltes.

Aujourd'hui une récolte n'affiche que son total (ex: "x11"). On veut une petite ligne dessous montrant la ventilation par grade avec emojis, ex: "8 ⚪️  2 🟢  1 🟡".

Purpose: Donner de la visibilité sur la qualité des récoltes accumulées (FAM-34).
Output: components/mascot/CraftSheet.tsx modifié — pas de nouveau fichier, pas de nouvel import.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md

<interfaces>
<!-- Tout est déjà importé dans CraftSheet.tsx (lignes 42-51) — aucun nouvel import requis. -->

Depuis lib/mascot/grade-engine (déjà importés) :
```typescript
const GRADE_ORDER: HarvestGrade[]; // ['ordinaire','beau','superbe','parfait']
function countItemByGrade(inv: HarvestInventory, itemId: string, grade: HarvestGrade): number;
function getGradeEmoji(grade: HarvestGrade): string; // ⚪/🟢/🟡/🟣
function countItemTotal(inv: HarvestInventory, itemId: string): number;
```

État existant dans CraftSheet.tsx :
- `harvestInventory` : HarvestInventory = Record<cropId, Partial<Record<HarvestGrade, number>>>
- `harvestEntries` (useMemo, ~ligne 796) : Array<{ cropId, qty, cropDef }>
- Style `inventoryQty` (~ligne 1713) : { fontSize: FontSize.caption, color: farm.brownTextSub }
- Le composant utilise le palette `farm.*` via `makeStyles(farm)` — PAS `useThemeColors()`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Calculer la répartition par grade dans harvestEntries</name>
  <files>components/mascot/CraftSheet.tsx</files>
  <action>
Dans le useMemo `harvestEntries` (~ligne 796), pour chaque récolte ajoutée, calculer aussi un `gradeBreakdown` : itérer `GRADE_ORDER`, appeler `countItemByGrade(harvestInventory, cropId, grade)`, et ne conserver que les grades dont la quantité > 0 sous la forme `Array<{ grade: HarvestGrade; count: number; emoji: string }>` (emoji = `getGradeEmoji(grade)`).

Étendre le type des entries pour inclure `gradeBreakdown`. Conserver le champ `qty` (total) existant inchangé. Implémente FAM-34.

Exemple de structure résultante pour une récolte :
`{ cropId: 'rose-doree', qty: 11, cropDef, gradeBreakdown: [{ grade: 'ordinaire', count: 8, emoji: '⚪' }, { grade: 'beau', count: 2, emoji: '🟢' }, { grade: 'superbe', count: 1, emoji: '🟡' }] }`
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v -E 'MemoryEditor\.tsx|cooklang\.ts|useVault\.ts' | grep -E 'CraftSheet\.tsx' ; test $? -ne 0</automated>
  </verify>
  <done>harvestEntries expose gradeBreakdown par récolte ; tsc sans nouvelle erreur dans CraftSheet.tsx</done>
</task>

<task type="auto">
  <name>Task 2: Rendre la ligne de répartition + style</name>
  <files>components/mascot/CraftSheet.tsx</files>
  <action>
Dans la ligne de rendu des récoltes (`harvestEntries.map`, ~ligne 855), sous le `<Text style={styles.inventoryQty}>` du total, ajouter un `<Text style={styles.inventoryGrades}>` qui affiche le breakdown : pour chaque entrée de `gradeBreakdown`, concaténer `{count} {emoji}` séparés par deux espaces (ex: `8 ⚪️  2 🟢  1 🟡`). Ne rendre ce Text que si `gradeBreakdown.length > 0`.

Ajouter le style `inventoryGrades` dans le `makeStyles(farm)` (proche de `inventoryQty`, ~ligne 1713) : `{ fontSize: FontSize.caption, color: farm.brownTextSub, marginTop: 2 }`. Pas de couleur hardcodée — utiliser le palette `farm.*` et les tokens FontSize/Spacing conformément aux conventions du fichier.
  </action>
  <verify>
    <automated>grep -q 'inventoryGrades' components/mascot/CraftSheet.tsx && npx tsc --noEmit 2>&1 | grep -v -E 'MemoryEditor\.tsx|cooklang\.ts|useVault\.ts' | grep -E 'CraftSheet\.tsx' ; test $? -ne 0</automated>
  </verify>
  <done>La ligne de répartition par grade s'affiche sous chaque récolte ; style inventoryGrades défini ; tsc propre</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` ne produit aucune nouvelle erreur dans CraftSheet.tsx (erreurs pré-existantes MemoryEditor/cooklang/useVault ignorées)
- Visuellement : Atelier > Inventaire > Récoltes affiche sous chaque récolte la ligne "{n} {emoji}" par grade présent
- Aucun bump CACHE_VERSION (affichage uniquement, pas de changement de shape de type caché)
</verification>

<success_criteria>
- Chaque récolte affiche sa répartition par grade sous le total
- Seuls les grades de quantité > 0 sont listés
- Total existant inchangé, UI en français, palette farm.*, tokens FontSize
- tsc propre
</success_criteria>

<output>
After completion, create `.planning/quick/260608-rze-fam-34-r-partition-par-grade-c-t-de-chaq/260608-rze-SUMMARY.md`
</output>
