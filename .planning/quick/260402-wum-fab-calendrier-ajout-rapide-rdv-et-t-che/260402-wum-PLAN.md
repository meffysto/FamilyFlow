---
phase: quick-260402-wum
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/RDVEditor.tsx
  - app/(tabs)/calendar.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Un FAB avec 2 actions (RDV et Tache) s'affiche sur l'ecran calendrier"
    - "Cliquer RDV ouvre le RDVEditor en modal avec la date selectionnee pre-remplie"
    - "Sauvegarder un RDV depuis le calendrier le persiste dans le vault"
    - "Cliquer Tache redirige vers l'ecran taches"
  artifacts:
    - path: "components/RDVEditor.tsx"
      provides: "Support initialDate prop optionnelle"
      contains: "initialDate"
    - path: "app/(tabs)/calendar.tsx"
      provides: "FAB + RDVEditor modal integration"
      contains: "FAB"
  key_links:
    - from: "app/(tabs)/calendar.tsx"
      to: "components/RDVEditor.tsx"
      via: "Modal avec RDVEditor, initialDate depuis selectedDate"
      pattern: "initialDate.*selectedDate"
    - from: "app/(tabs)/calendar.tsx"
      to: "components/FAB.tsx"
      via: "FAB actions array"
      pattern: "FAB actions"
---

<objective>
Ajouter un FAB (Floating Action Button) a l'ecran calendrier global pour permettre la creation rapide d'un RDV (via RDVEditor modal) ou d'une tache (redirection vers ecran taches).

Purpose: Permettre l'ajout rapide d'evenements directement depuis le calendrier, sans naviguer ailleurs.
Output: Ecran calendrier avec FAB fonctionnel + RDVEditor pre-rempli avec la date selectionnee.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/FAB.tsx
@components/RDVEditor.tsx
@app/(tabs)/calendar.tsx
@app/(tabs)/rdv.tsx (reference pattern pour RDVEditor usage)

<interfaces>
<!-- FAB component -->
From components/FAB.tsx:
```typescript
export interface FABAction {
  id: string;
  emoji: string;
  label: string;
  onPress: () => void;
}
export interface FABProps {
  actions: FABAction[];
}
export const FAB: React.MemoExoticComponent<typeof FABComponent>;
```

<!-- RDVEditor props actuelles -->
From components/RDVEditor.tsx:
```typescript
interface RDVEditorProps {
  rdv?: RDV;
  profiles?: Profile[];
  onSave: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}
// dateRdv state init (line 109): useState(rdv?.date_rdv ?? '')
```

<!-- useVault exports utilises -->
From hooks/useVault.ts:
```typescript
addRDV: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
deleteRDV: (sourceFile: string) => Promise<void>;
// aussi: refresh, profiles, activeProfile
```

<!-- Types -->
From lib/types.ts:
```typescript
import { RDV, Profile } from '../lib/types';
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter initialDate a RDVEditor + integrer FAB dans calendar.tsx</name>
  <files>components/RDVEditor.tsx, app/(tabs)/calendar.tsx</files>
  <action>
**1. components/RDVEditor.tsx** — ajouter prop `initialDate`:

- Ajouter `initialDate?: string` a `RDVEditorProps` (ligne 85-92)
- Mettre a jour la signature de la fonction `RDVEditor` pour inclure `initialDate`
- Modifier l'init de `dateRdv` state (ligne 109) : `useState(rdv?.date_rdv ?? initialDate ?? '')`

**2. app/(tabs)/calendar.tsx** — ajouter FAB + RDVEditor modal:

Imports a ajouter :
- `{ FAB }` depuis `../../components/FAB`
- `{ RDVEditor }` depuis `../../components/RDVEditor`
- `{ useRouter }` depuis `expo-router`
- `{ Modal }` depuis `react-native` (ajouter a l'import existant)
- `{ RDV }` depuis `../../lib/types`

State a ajouter dans CalendarScreen :
- `const [showRDVEditor, setShowRDVEditor] = useState(false)`
- `const router = useRouter()`
- Extraire `{ addRDV, deleteRDV, profiles, activeProfile }` de useVault() (en plus du `refresh` existant) — modifier la destructuration ligne 43-44

Actions FAB (definir avec useMemo) :
```typescript
const fabActions = useMemo(() => [
  { id: 'rdv', emoji: '📅', label: 'RDV', onPress: () => setShowRDVEditor(true) },
  { id: 'tache', emoji: '✅', label: 'Tâche', onPress: () => router.push('/(tabs)/tasks') },
], [router]);
```

Modifier la structure JSX du return :
- Wrapper racine `<View style={{ flex: 1 }}>` autour de tout
- Le `<SafeAreaView>` existant reste a l'interieur (inchange)
- Apres le `</SafeAreaView>`, ajouter :
  1. `<FAB actions={fabActions} />`
  2. Modal RDVEditor :
```tsx
<Modal
  visible={showRDVEditor}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setShowRDVEditor(false)}
>
  <RDVEditor
    profiles={profiles}
    initialDate={selectedDate ?? undefined}
    onSave={async (data) => {
      await addRDV(data);
      await refresh();
      setShowRDVEditor(false);
    }}
    onClose={() => setShowRDVEditor(false)}
  />
</Modal>
```
- Fermer le wrapper `</View>` a la fin

Note: pas de `onDelete` car c'est un creation-only flow (pas d'editingRDV).
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - RDVEditor accepte initialDate optionnel et pre-remplit la date
    - Ecran calendrier affiche un FAB avec 2 actions (RDV et Tache)
    - Cliquer RDV ouvre RDVEditor en modal pageSheet avec la date selectionnee
    - Sauvegarder persiste le RDV et ferme le modal
    - Cliquer Tache navigue vers l'ecran taches
    - tsc --noEmit passe (hors erreurs pre-existantes connues)
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelles erreurs
- Ouvrir l'ecran calendrier → FAB visible en bas a droite
- Cliquer FAB → 2 options apparaissent (RDV + Tache)
- Cliquer RDV → modal s'ouvre avec la date du jour selectionnee pre-remplie
- Remplir et sauvegarder → RDV cree dans le vault, modal se ferme
- Cliquer Tache → navigation vers l'ecran taches
</verification>

<success_criteria>
FAB fonctionnel sur l'ecran calendrier avec creation rapide de RDV (date pre-remplie) et raccourci vers taches.
</success_criteria>

<output>
After completion, create `.planning/quick/260402-wum-fab-calendrier-ajout-rapide-rdv-et-t-che/260402-wum-SUMMARY.md`
</output>
