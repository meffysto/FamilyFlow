---
phase: quick-260403-kjz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/tree.tsx
autonomous: true
requirements:
  - CLEANUP-01
must_haves:
  truths:
    - "Le bloc debug saga n'apparaît plus dans tree.tsx"
    - "Les 4 styles sagaPending* sont supprimés du StyleSheet"
    - "Le fichier compile sans erreur (npx tsc --noEmit)"
  artifacts:
    - path: "app/(tabs)/tree.tsx"
      provides: "Fichier nettoyé sans code debug"
  key_links: []
---

<objective>
Supprimer le bloc debug saga (lignes 1625-1647) et les 4 styles orphelins sagaPending* du fichier app/(tabs)/tree.tsx.

Purpose: Nettoyer le code de debug qui ne doit pas rester en production.
Output: tree.tsx sans le bloc `{/* Debug saga — DEV only */}` ni les styles associés.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Supprimer le bloc debug et les styles orphelins</name>
  <files>app/(tabs)/tree.tsx</files>
  <action>
    Deux suppressions dans app/(tabs)/tree.tsx :

    1. Supprimer le bloc JSX debug saga (lignes 1625-1647 actuelles) :
       ```
       {/* Debug saga — DEV only */}
       {__DEV__ && (
         <TouchableOpacity
           ...
         >
           <Text ...>{'🔧 [DEV] Reset saga → relancer visiteur'}</Text>
         </TouchableOpacity>
       )}
       ```
       Ce bloc se trouve entre le bloc WeeklyGoal et le `<View style={{ height: 100 }} />`.

    2. Supprimer les 4 entrées du StyleSheet (lignes ~1916-1935 actuelles) :
       ```
       sagaPendingBtn: { ... },
       sagaPendingTouch: { ... },
       sagaPendingEmoji: { ... },
       sagaPendingText: { ... },
       ```
       Ces styles sont définis mais jamais référencés dans le JSX (le bloc debug utilisait des styles inline).

    Note : ne pas toucher au reste du fichier. Ne pas modifier d'autres styles ou composants.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault" | head -20</automated>
  </verify>
  <done>
    - Le commentaire `{/* Debug saga — DEV only */}` et le bloc TouchableOpacity associé sont absents de tree.tsx
    - Les clés sagaPendingBtn, sagaPendingTouch, sagaPendingEmoji, sagaPendingText sont absentes du StyleSheet
    - `npx tsc --noEmit` ne retourne pas de nouvelles erreurs liées à tree.tsx
  </done>
</task>

</tasks>

<verification>
Vérifier manuellement dans tree.tsx :
- `grep "Debug saga" app/(tabs)/tree.tsx` → aucun résultat
- `grep "sagaPending" app/(tabs)/tree.tsx` → aucun résultat
- `grep "__DEV__.*Reset saga" app/(tabs)/tree.tsx` → aucun résultat
</verification>

<success_criteria>
Le fichier tree.tsx ne contient plus aucune trace du code debug saga ni des styles sagaPending*. La compilation TypeScript passe sans nouvelles erreurs.
</success_criteria>

<output>
Après complétion, créer `.planning/quick/260403-kjz-supprimer-le-code-debug-saga-dans-tree-t/260403-kjz-SUMMARY.md` avec un résumé des suppressions effectuées.
</output>
