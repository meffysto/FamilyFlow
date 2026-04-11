---
phase: quick-260411-tey
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/CalendarImporter.tsx
autonomous: true
requirements:
  - QUICK-260411-TEY
must_haves:
  truths:
    - "Les anniversaires importés depuis iOS Calendar conservent l'année de naissance quand elle est renseignée (> 1900)"
    - "Les notes iCal (DESCRIPTION) sont importées dans l'objet Anniversary"
    - "Les notes s'affichent comme deuxième ligne dans la liste quand elles existent, tronquées à 60 chars sur 1 ligne"
  artifacts:
    - path: "components/CalendarImporter.tsx"
      provides: "Extraction birthYear + notes depuis event + affichage notes dans la liste"
      contains: "notes?: string"
  key_links:
    - from: "CalendarImporter.tsx (interface CalendarBirthday)"
      to: "Anniversary (lib/types.ts)"
      via: "mapping dans handleImport — notes et birthYear transmis à onImport"
      pattern: "birthYear: b\\.birthYear"
    - from: "event.startDate (expo-calendar)"
      to: "CalendarBirthday.birthYear"
      via: "start.getFullYear() > 1900 ? year : undefined"
      pattern: "getFullYear\\(\\)\\s*>\\s*1900"
---

<objective>
Enrichir CalendarImporter.tsx pour extraire et propager deux champs actuellement ignorés lors de l'import des anniversaires depuis iOS Calendar : l'année de naissance (via startDate) et les notes (via event.notes). Afficher également les notes dans la liste.

Purpose: iOS Birthdays conserve l'année de naissance quand elle est saisie (année 1604 = placeholder). Les notes iCal contiennent souvent du contexte utile (surnom, relation, lieu). Les ignorer perd de l'information structurée déjà présente dans le calendrier.
Output: components/CalendarImporter.tsx modifié — un seul fichier, trois enrichissements atomiques.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@components/CalendarImporter.tsx
@lib/types.ts

<interfaces>
<!-- Types existants (déjà en place, aucune modification requise dans lib/types.ts) -->

From lib/types.ts:
```typescript
export interface Anniversary {
  name: string;
  date: string;           // MM-DD
  birthYear?: number;     // Année de naissance (optionnel) — à remplir depuis startDate
  contactId?: string;
  category?: string;
  notes?: string;         // Notes optionnelles — à remplir depuis event.notes
  sourceFile: string;
}
```

From components/CalendarImporter.tsx (interface locale à enrichir) :
```typescript
interface CalendarBirthday {
  id: string;
  name: string;
  date: string;           // MM-DD
  birthYear?: number;     // Déjà présent, actuellement toujours undefined
  alreadyImported: boolean;
  // À AJOUTER : notes?: string;
}
```

From expo-calendar (Calendar.Event) :
```typescript
interface Event {
  id: string;
  title?: string;
  startDate?: string | Date;
  notes?: string;         // Correspond à DESCRIPTION en iCal
  calendarId: string;
  // ...
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extraire birthYear et notes dans le mapping d'événements + propager à l'import</name>
  <files>components/CalendarImporter.tsx</files>
  <action>
Modifications dans components/CalendarImporter.tsx (un seul fichier, 4 points d'édition) :

1) Interface `CalendarBirthday` (ligne ~36) — ajouter le champ `notes` :
```ts
interface CalendarBirthday {
  id: string;
  name: string;
  date: string;
  birthYear?: number;
  notes?: string;       // NOUVEAU — DESCRIPTION iCal
  alreadyImported: boolean;
}
```

2) Boucle de mapping des événements (dans useEffect, ~ligne 144-187) — extraire birthYear et notes à partir de `event` :

Juste après `const start = new Date(event.startDate);` (ligne ~169), ajouter :
```ts
// iOS Birthdays utilise 1604 comme placeholder quand l'année de naissance
// est inconnue. On ne garde l'année que si elle semble plausible.
const startYear = start.getFullYear();
const birthYear = startYear > 1900 ? startYear : undefined;

// event.notes correspond au champ DESCRIPTION en iCal (expo-calendar l'expose
// directement sur l'objet Event). Peut être undefined — on normalise en trim.
const rawNotes = (event as { notes?: string }).notes;
const notes = rawNotes && rawNotes.trim().length > 0 ? rawNotes.trim() : undefined;
```

Puis dans le `seen.set(key, { ... })` (ligne ~180), remplacer :
```ts
seen.set(key, {
  id: `${name}|${dateStr}`,
  name,
  date: dateStr,
  birthYear: undefined,
  alreadyImported,
});
```
par :
```ts
seen.set(key, {
  id: `${name}|${dateStr}`,
  name,
  date: dateStr,
  birthYear,
  notes,
  alreadyImported,
});
```

IMPORTANT — dédup : la clé de dédup reste `${name.toLowerCase()}|${dateStr}`. Si deux événements produisent la même clé, on garde le PREMIER (comportement actuel préservé via `if (seen.has(key)) continue;`). Ne pas modifier cette logique.

3) `handleImport` (ligne ~238-252) — propager `notes` dans les items transmis à `onImport` :

Remplacer :
```ts
.map((b) => ({
  name: b.name,
  date: b.date,
  birthYear: b.birthYear,
  category: 'calendrier',
  contactId: undefined,
  notes: undefined,
}));
```
par :
```ts
.map((b) => ({
  name: b.name,
  date: b.date,
  birthYear: b.birthYear,
  category: 'calendrier',
  contactId: undefined,
  notes: b.notes,
}));
```

4) `renderBirthday` (ligne ~269-322) — afficher les notes comme deuxième ligne dans `contactInfo` si présentes :

Dans le bloc `<View style={styles.contactInfo}>` (ligne ~292), après le `<Text style={[styles.contactDate, ...]}>` qui affiche la date, ajouter CONDITIONNELLEMENT une ligne notes :
```tsx
{item.notes ? (
  <Text
    style={[styles.contactDate, { color: colors.textMuted }]}
    numberOfLines={1}
  >
    {item.notes.length > 60 ? `${item.notes.slice(0, 60)}…` : item.notes}
  </Text>
) : null}
```

Raisons :
- Réutilise le style existant `contactDate` (même taille, même couleur textMuted) — pas de nouveau style à déclarer, respecte « Pas de refactoring hors scope ».
- `numberOfLines={1}` garantit qu'une note très longue ne casse pas la mise en page de la liste.
- Troncature manuelle à 60 chars avec ellipse pour un contrôle déterministe de la longueur (plus fiable que de se reposer uniquement sur numberOfLines).
- Ligne ajoutée APRÈS la date pour conserver la hiérarchie visuelle : nom → date → notes.

NE PAS toucher :
- Aucun style du `StyleSheet.create` (styles existants réutilisés tels quels).
- Aucune logique de permission, toolbar, footer, toggleAll, toggleItem.
- Aucune autre partie du fichier.
- Aucun autre fichier (lib/types.ts a déjà `notes?: string`, rien à ajouter).

Respect des conventions CLAUDE.md :
- `useThemeColors()` déjà utilisé — on réutilise `colors.textMuted`.
- Français dans les commentaires ajoutés.
- Pas de hardcoded color.
- `React.memo` / `useCallback` déjà en place sur renderBirthday — dépendances inchangées (item.notes est lu depuis `item`, qui est déjà passé en argument, aucun nouveau capture externe).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "CalendarImporter\.tsx" || echo "CalendarImporter.tsx: no new errors"</automated>
  </verify>
  <done>
- `npx tsc --noEmit` n'introduit AUCUNE nouvelle erreur dans components/CalendarImporter.tsx (erreurs pré-existantes dans MemoryEditor.tsx/cooklang.ts/useVault.ts ignorées per CLAUDE.md).
- Interface `CalendarBirthday` contient `notes?: string`.
- Mapping event → CalendarBirthday renseigne `birthYear` (startYear > 1900) et `notes` (trim non-vide).
- `handleImport` transmet `notes: b.notes` (non plus `undefined`).
- `renderBirthday` affiche un second `<Text>` avec `numberOfLines={1}` et troncature à 60 chars UNIQUEMENT si `item.notes` est défini.
- Aucun autre fichier modifié.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` ne fait pas apparaître de nouvelle erreur sur CalendarImporter.tsx.
- Lecture manuelle du diff : seul components/CalendarImporter.tsx est touché.
- Les trois enrichissements sont présents : interface, mapping (birthYear + notes), handleImport (notes), rendu (ligne conditionnelle).
</verification>

<success_criteria>
- Un anniversaire avec startDate 1990-05-14 importé depuis iOS Birthdays aboutit à `{ date: "05-14", birthYear: 1990 }` dans l'objet transmis à `onImport`.
- Un anniversaire avec startDate 1604-01-01 (placeholder iOS) aboutit à `{ birthYear: undefined }`.
- Un événement dont `event.notes` contient "Meilleur ami de Lucas" est importé avec `notes: "Meilleur ami de Lucas"` et affiche cette note sur une deuxième ligne dans la liste.
- Un événement sans notes n'affiche PAS de ligne supplémentaire (rendu conditionnel, aucun espace vide).
- Les erreurs TypeScript pré-existantes ne sont pas aggravées.
</success_criteria>

<output>
After completion, create `.planning/quick/260411-tey-enrichir-calendarimporter-ical-birthyear/260411-tey-01-SUMMARY.md`
</output>
