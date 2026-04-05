---
phase: quick
plan: 260403-qoo
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/useGamification.ts
  - hooks/useVault.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Toutes les ecritures famille.md dans completeTask, openLootBox et completeSagaChapter passent par enqueueWrite"
    - "Les ecritures sur gami-*.md et les notifications restent hors de la queue (pas de serialisation inutile)"
    - "Le comportement fonctionnel est identique — seul l'ordre d'execution des writes change"
  artifacts:
    - path: "hooks/useGamification.ts"
      provides: "enqueueWrite wrapping completeTask and openLootBox famille.md writes"
      contains: "enqueueWrite"
    - path: "hooks/useVault.ts"
      provides: "enqueueWrite wrapping completeSagaChapter famille.md writes"
      contains: "enqueueWrite"
  key_links:
    - from: "hooks/useGamification.ts"
      to: "lib/famille-queue.ts"
      via: "import enqueueWrite"
      pattern: "import.*enqueueWrite.*famille-queue"
    - from: "hooks/useVault.ts"
      to: "lib/famille-queue.ts"
      via: "import enqueueWrite (already present)"
      pattern: "import.*enqueueWrite.*famille-queue"
---

<objective>
Wrapper les 3 derniers appels a risque de race condition sur famille.md avec enqueueWrite de lib/famille-queue.

Purpose: completeTask, openLootBox et completeSagaChapter font des read-modify-write sur famille.md sans passer par la queue partagee. Si deux de ces fonctions s'executent en parallele (ex: completeTask declenche un loot qui appelle openLootBox), les ecritures peuvent se chevaucher et corrompre les donnees.

Output: Les 3 fonctions serialisent leurs ecritures famille.md via enqueueWrite, eliminant les race conditions restantes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/famille-queue.ts
@hooks/useGamification.ts
@hooks/useVault.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrapper completeTask et openLootBox dans useGamification.ts</name>
  <files>hooks/useGamification.ts</files>
  <action>
1. Ajouter l'import: `import { enqueueWrite, patchProfileField } from '../lib/famille-queue';`

2. **completeTask** (~ligne 126-148): Le bloc qui ecrit farm_crops dans famille.md (lignes 126-148 environ) fait un read-modify-write sur FAMILLE_FILE. Wrapper UNIQUEMENT ce bloc dans `enqueueWrite(async () => { ... })`. Le bloc commence a `const familleContent = await vault.readFile(FAMILLE_FILE)` (ligne 126) et finit a `await vault.writeFile(FAMILLE_FILE, lines.join('\n'))` (ligne 147). Les ecritures gami-*.md et les notifications restent hors de la queue.

   Bonus: utiliser `patchProfileField(lines, profile.id, 'farm_crops', updatedCropsCSV)` au lieu du code inline de recherche de section (lignes 128-146) pour simplifier — c'est exactement le meme algorithme deja factorise dans famille-queue.ts.

3. **openLootBox** (~lignes 219-246): Le bloc mascot_deco/mascot_hab qui ecrit dans famille.md. Wrapper dans `enqueueWrite(async () => { ... })`. Le bloc commence a `const familleRaw = await vault.readFile(FAMILLE_FILE)` (ligne 221) et finit a `await vault.writeFile(FAMILLE_FILE, lines.join('\n'))` (ligne 245). Le try/catch externe reste.

   Bonus: utiliser `patchProfileField(lines, profile.id, fieldKey, list.join(','))` pour remplacer le code inline.

4. **openLootBox** (~lignes 251-283): Le bloc companion qui ecrit dans famille.md. Wrapper dans `enqueueWrite(async () => { ... })`. Le bloc commence a `const familleRaw = await vault.readFile(FAMILLE_FILE)` (ligne 253) et finit a `await vault.writeFile(FAMILLE_FILE, lines.join('\n'))` (ligne 282). Le try/catch externe reste.

   Bonus: utiliser `patchProfileField(lines, profile.id, 'companion', serializeCompanion(updatedCompanion))` pour remplacer le code inline.

IMPORTANT: Ne PAS wrapper les ecritures vers gami-*.md (fichiers per-profil) — uniquement FAMILLE_FILE.
IMPORTANT: Le `onDataChange` callback lit famille.md APRES les ecritures — il doit rester hors de enqueueWrite pour ne pas bloquer la queue inutilement.
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -E "useGamification|famille-queue" | head -20; echo "---"; grep -c "enqueueWrite" hooks/useGamification.ts</automated>
  </verify>
  <done>useGamification.ts importe enqueueWrite, les 3 blocs read-modify-write sur FAMILLE_FILE sont wrappés dans enqueueWrite, le code compile sans nouvelles erreurs</done>
</task>

<task type="auto">
  <name>Task 2: Wrapper completeSagaChapter dans useVault.ts</name>
  <files>hooks/useVault.ts</files>
  <action>
useVault.ts importe deja enqueueWrite (ligne 100).

1. **completeSagaChapter — bloc saga_items** (~lignes 3462-3495): Le bloc qui ecrit saga_items dans famille.md. Il y a DEUX ecritures famille.md sequentielles dans cette fonction (saga_items puis farm_harvest_inventory). Les wrapper dans un SEUL enqueueWrite pour garantir l'atomicite.

   Wrapper depuis `const lines = familleContent.split('\n')` (ligne 3464, en utilisant le familleContent deja lu juste au-dessus) jusqu'a inclure le second writeFile (ligne 3526). Le enqueueWrite doit englober les deux blocs (saga_items + bonusCropId) en une seule operation atomique.

   Structure cible:
   ```
   await enqueueWrite(async () => {
     const familleContent = await vaultRef.current!.readFile(FAMILLE_FILE);
     
     // Bloc 1: rewardItem → saga_items (lignes 3461-3495)
     // ... code existant avec familleContent ...
     
     // Bloc 2: bonusCropId → farm_harvest_inventory (lignes 3498-3526)  
     // IMPORTANT: relire le fichier APRES le premier writeFile
     // OU mieux: combiner les deux modifications sur le meme tableau lines[] et faire UN SEUL writeFile
     
     await vaultRef.current!.writeFile(FAMILLE_FILE, lines.join('\n'));
   });
   ```

   OPTIMISATION IMPORTANTE: Les deux blocs lisent et ecrivent famille.md separement. Dans le enqueueWrite, combiner les deux modifications sur le meme array `lines[]` et faire UN SEUL writeFile a la fin. Cela evite une lecture inutile et reduit les I/O.

   Le `familleContent` qui est lu en ligne 3447 (avant ces blocs) pour mergeProfiles doit etre sorti du enqueueWrite — il est utilise pour construire le profil, pas pour la mutation. Le enqueueWrite ne doit couvrir que la partie mutation.

2. Les ecritures gami-*.md (ligne 3546) restent hors de la queue.

IMPORTANT: La variable `familleContent` est lue a la ligne 3447 et reutilisee a la ligne 3464 pour construire `lines`. Dans le enqueueWrite, il faut RELIRE famille.md pour avoir la version la plus recente (une autre ecriture en queue pourrait avoir modifie le fichier entre-temps).
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -E "useVault|famille-queue" | head -20; echo "---"; grep -n "enqueueWrite" hooks/useVault.ts | tail -5</automated>
  </verify>
  <done>completeSagaChapter wrape ses ecritures famille.md dans enqueueWrite, les deux mutations (saga_items + farm_harvest_inventory) sont combinees en un seul writeFile atomique, le code compile sans nouvelles erreurs</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` ne montre pas de nouvelles erreurs dans useGamification.ts ou useVault.ts
2. `grep -c "enqueueWrite" hooks/useGamification.ts` retourne au moins 3 (un par bloc wrappé)
3. `grep -c "enqueueWrite" hooks/useVault.ts` montre plus d'occurrences qu'avant (etait 5, devrait etre 6+)
4. Aucun `vault.writeFile(FAMILLE_FILE` ou `vaultRef.current.writeFile(FAMILLE_FILE` en dehors d'un enqueueWrite dans ces deux fichiers
</verification>

<success_criteria>
- Toutes les ecritures famille.md dans completeTask, openLootBox et completeSagaChapter sont serialisees via enqueueWrite
- Les ecritures gami-*.md ne sont PAS dans la queue
- Le code compile (npx tsc --noEmit)
- Zero race condition restante sur famille.md dans les hooks de gamification
</success_criteria>

<output>
After completion, create `.planning/quick/260403-qoo-wrapper-completetask-openlootbox-complet/260403-qoo-SUMMARY.md`
</output>
