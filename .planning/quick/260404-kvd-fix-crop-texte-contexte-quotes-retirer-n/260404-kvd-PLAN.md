---
phase: quick
plan: 260404-kvd
type: execute
wave: 1
depends_on: []
files_modified: [app/(tabs)/quotes.tsx]
autonomous: true
requirements: [quick-fix]

must_haves:
  truths:
    - "Le texte date + contexte s'affiche en entier sans troncature dans les cartes citations"
  artifacts:
    - path: "app/(tabs)/quotes.tsx"
      provides: "renderItem sans numberOfLines sur le texte date/contexte"
  key_links: []
---

<objective>
Retirer la prop numberOfLines={2} sur le Text date/contexte dans renderItem de quotes.tsx pour que le contexte s'affiche intégralement.

Purpose: Le texte contexte des citations est tronqué à 2 lignes, empêchant la lecture complète.
Output: quotes.tsx corrigé — contexte visible en entier.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/(tabs)/quotes.tsx
</context>

<tasks>

<task type="auto">
  <name>Tâche 1 : Retirer numberOfLines={2} du texte date/contexte</name>
  <files>app/(tabs)/quotes.tsx</files>
  <action>
    Ligne ~133 dans renderItem : retirer la prop `numberOfLines={2}` du composant Text qui affiche la date et le contexte. Le Text doit garder son style `styles.date` et la couleur `colors.textMuted` — seul numberOfLines est supprimé.

    Avant :
    ```tsx
    <Text style={[styles.date, { color: colors.textMuted }]} numberOfLines={2}>
    ```

    Après :
    ```tsx
    <Text style={[styles.date, { color: colors.textMuted }]}>
    ```
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && grep -n 'numberOfLines' app/\(tabs\)/quotes.tsx | grep -v 'enfant' || echo "OK — aucun numberOfLines restant sur date/contexte"</automated>
  </verify>
  <done>Le Text date/contexte dans renderItem n'a plus de numberOfLines — le contexte s'affiche en entier.</done>
</task>

</tasks>

<verification>
grep numberOfLines quotes.tsx ne retourne plus de match sur la ligne date/contexte (ligne ~133).
</verification>

<success_criteria>
Le texte date + contexte dans les cartes citations s'affiche sans troncature.
</success_criteria>

<output>
After completion, create `.planning/quick/260404-kvd-fix-crop-texte-contexte-quotes-retirer-n/260404-kvd-SUMMARY.md`
</output>
