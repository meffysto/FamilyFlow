---
phase: quick-260424-jhs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/pregnancy.tsx
  - locales/fr/common.json
  - locales/en/common.json
autonomous: true
requirements:
  - QUICK-260424-jhs
must_haves:
  truths:
    - "Un long press sur une carte semaine ouvre le modal d'édition pré-rempli avec les données existantes (poids, symptômes, notes)"
    - "L'enregistrement écrase uniquement la semaine ciblée dans le vault (pas forcément la semaine en cours)"
    - "Le feedback haptique se déclenche au long press"
    - "Le + bouton Cette semaine conserve son comportement actuel (semaine courante)"
  artifacts:
    - path: "app/(tabs)/pregnancy.tsx"
      provides: "Gesture long press + état editingWeek + modal prefill"
    - path: "locales/fr/common.json"
      provides: "Clé pregnancy.form.editTitle et pregnancy.longPressHint"
  key_links:
    - from: "weekCard Pressable onLongPress"
      to: "openEdit(week, entry)"
      via: "prefill formPoids/formSymptomes/formNotes + setEditingWeek"
      pattern: "onLongPress.*openEdit"
    - from: "handleSave"
      to: "entries.filter(e => e.week !== targetWeek)"
      via: "utilise editingWeek ?? pregnancyInfo.currentWeek"
      pattern: "editingWeek \\?\\? pregnancyInfo"
---

<objective>
Ajouter un long press sur chaque carte semaine dans `app/(tabs)/pregnancy.tsx` pour permettre l'édition du poids / symptômes / notes d'une semaine passée (ou en cours), pré-remplie avec les données existantes.

Purpose: Aujourd'hui seule la semaine courante est éditable via le bouton `+ Cette semaine`. L'utilisateur veut pouvoir revenir corriger/compléter une semaine passée.

Output: `TouchableOpacity`/`Pressable` avec `onLongPress` sur chaque `weekCard` → réutilise le modal existant avec prefill + écriture ciblée sur la `week` éditée (pas forcément la courante).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@app/(tabs)/pregnancy.tsx

<interfaces>
Fichier cible : `app/(tabs)/pregnancy.tsx`

État actuel pertinent :
```typescript
// États existants
const [modalVisible, setModalVisible] = useState(false);
const [formPoids, setFormPoids] = useState('');
const [formSymptomes, setFormSymptomes] = useState('');
const [formNotes, setFormNotes] = useState('');

// Fonction actuelle (ligne ~99)
const openAdd = useCallback(() => {
  setFormPoids('');
  setFormSymptomes('');
  setFormNotes('');
  setModalVisible(true);
}, []);

// Save actuel (ligne ~106) — utilise TOUJOURS pregnancyInfo.currentWeek
const handleSave = useCallback(async () => {
  // ...
  const newEntry: PregnancyWeekEntry = {
    week: pregnancyInfo.currentWeek,  // ← à remplacer par editingWeek ?? currentWeek
    // ...
  };
  const filtered = entries.filter(e => e.week !== pregnancyInfo.currentWeek); // ← idem
  // ...
}, [...]);
```

Type `PregnancyWeekEntry` (depuis `lib/types`) :
```typescript
{
  week: number;
  date: string;       // YYYY-MM-DD
  poids?: number;
  symptomes?: string;
  notes?: string;
  sourceFile: string;
  lineIndex: number;
}
```

Render loop des semaines (ligne ~198) :
```typescript
Array.from({ length: (pregnancyInfo?.currentWeek ?? 0) + 1 }, (_, i) => ...)
  .map(week => {
    const entry = entries.find(e => e.week === week);
    const isCurrent = week === pregnancyInfo?.currentWeek;
    return (
      <View key={week} style={[styles.weekCard, ...]}>
        {/* ... */}
      </View>
    );
  });
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter long press + modal prefill + save ciblé</name>
  <files>app/(tabs)/pregnancy.tsx</files>
  <action>
Modifier `app/(tabs)/pregnancy.tsx` pour permettre l'édition d'une semaine arbitraire via long press.

**1. Ajouter un état `editingWeek`** (après les 3 useState de formulaire, ~ligne 59) :
```typescript
const [editingWeek, setEditingWeek] = useState<number | null>(null);
```

**2. Ajouter une fonction `openEdit(week, entry?)`** juste après `openAdd` (~ligne 104) :
```typescript
const openEdit = useCallback((week: number, entry?: PregnancyWeekEntry) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  setEditingWeek(week);
  setFormPoids(entry?.poids != null ? String(entry.poids) : '');
  setFormSymptomes(entry?.symptomes ?? '');
  setFormNotes(entry?.notes ?? '');
  setModalVisible(true);
}, []);
```

**3. Modifier `openAdd`** pour reset `editingWeek` à null (le + Cette semaine reste current-week) :
```typescript
const openAdd = useCallback(() => {
  setEditingWeek(null);  // ← AJOUTER cette ligne en premier
  setFormPoids('');
  setFormSymptomes('');
  setFormNotes('');
  setModalVisible(true);
}, []);
```

**4. Modifier `handleSave`** pour cibler `editingWeek ?? pregnancyInfo.currentWeek` au lieu de toujours `pregnancyInfo.currentWeek` :
```typescript
const targetWeek = editingWeek ?? pregnancyInfo.currentWeek;
// Préserver la date existante si on édite une semaine passée, sinon aujourd'hui
const existingEntry = entries.find(e => e.week === targetWeek);
const newEntry: PregnancyWeekEntry = {
  week: targetWeek,
  date: existingEntry?.date ?? new Date().toISOString().slice(0, 10),
  poids: formPoids ? parseFloat(formPoids) : undefined,
  symptomes: formSymptomes.trim() || undefined,
  notes: formNotes.trim() || undefined,
  sourceFile: path,
  lineIndex: -1,
};
const filtered = entries.filter(e => e.week !== targetWeek);
```
Ajouter `editingWeek` dans les dépendances du useCallback.

Après `setModalVisible(false)` dans le success path, ajouter `setEditingWeek(null);`.

**5. Wrapper la `View` weekCard dans un `TouchableOpacity`** (ligne ~202) avec `onLongPress`, conservant tous les props de View actuels :
```typescript
<TouchableOpacity
  key={week}
  activeOpacity={0.7}
  delayLongPress={400}
  onLongPress={() => openEdit(week, entry)}
  style={[
    styles.weekCard,
    { backgroundColor: colors.card, borderColor: isCurrent ? primary : colors.border },
    Shadows.sm,
  ]}
>
  {/* contenu inchangé */}
</TouchableOpacity>
```
Attention : remplacer `<View key={week} ...>` par `<TouchableOpacity key={week} ...>` et la fermeture `</View>` correspondante par `</TouchableOpacity>`. Le `TouchableOpacity` est déjà importé en haut du fichier.

**6. Modal title dynamique** — dans `<ModalHeader title={...}>` (ligne ~264), utiliser la semaine éditée :
```typescript
title={`${t('pregnancy.saPrefix')} ${editingWeek ?? pregnancyInfo?.currentWeek ?? '?'} — ${getFruitForWeek(editingWeek ?? pregnancyInfo?.currentWeek ?? 0)} ${getFruitLabel(editingWeek ?? pregnancyInfo?.currentWeek ?? 0)}`}
```

**7. onRequestClose du Modal** — nettoyer aussi `editingWeek` :
```typescript
onRequestClose={() => { setModalVisible(false); setEditingWeek(null); }}
```
Faire pareil pour le `onClose` du `ModalHeader`.

**8. Ajouter un hint visuel discret** sous le titre section "Semaine par semaine" (ligne ~196) :
```typescript
<Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pregnancy.weekByWeek')}</Text>
<Text style={[styles.hint, { color: colors.textMuted }]}>{t('pregnancy.longPressHint')}</Text>
```
Ajouter le style `hint` dans `StyleSheet.create` :
```typescript
hint: {
  fontSize: FontSize.micro,
  marginBottom: Spacing.sm,
  marginTop: -Spacing.xs,
},
```

Pattern CLAUDE.md respectés :
- Pas de swipe en ScrollView (on utilise long press → pas de conflit de geste)
- `useThemeColors()` pour toutes les couleurs (aucun hardcoded)
- `expo-haptics` (`Haptics.impactAsync`) pour feedback tactile
- Langue FR pour les clés i18n
- Modal existant `pageSheet` réutilisé
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | rtk proxy grep -E "pregnancy\.tsx" | head -20</automated>
  </verify>
  <done>
- `npx tsc --noEmit` n'introduit aucune nouvelle erreur dans `pregnancy.tsx`
- Long press sur une carte semaine ouvre le modal pré-rempli avec les données existantes (ou vide si aucune entrée)
- Enregistrer depuis le modal en mode édition remplace uniquement la semaine ciblée, pas la semaine courante
- Le bouton `+ Cette semaine` continue de fonctionner et cible toujours la semaine courante
- Haptic `impactAsync(Medium)` se déclenche au long press
  </done>
</task>

<task type="auto">
  <name>Task 2: Ajouter clés i18n FR + EN</name>
  <files>locales/fr/common.json, locales/en/common.json</files>
  <action>
Ajouter une clé `pregnancy.longPressHint` dans les deux fichiers de locale, au sein du bloc `"pregnancy": { ... }` existant (après `"weekByWeek"`).

**locales/fr/common.json** (vers ligne 2065) :
```json
"weekByWeek": "📅 Semaine par semaine",
"longPressHint": "Appui long sur une semaine pour modifier",
"addWeekTracking": "Ajouter le suivi de cette semaine",
```

**locales/en/common.json** : localiser la même clé dans le bloc `pregnancy` correspondant (localiser d'abord via `rtk proxy grep -n '"pregnancy"' locales/en/common.json` pour trouver la position exacte, puis insérer après la clé équivalente à `weekByWeek`) :
```json
"longPressHint": "Long press on a week to edit"
```

Respecter l'indentation existante (2 espaces) et la virgule JSON.
  </action>
  <verify>
    <automated>node -e "JSON.parse(require('fs').readFileSync('locales/fr/common.json','utf8')); JSON.parse(require('fs').readFileSync('locales/en/common.json','utf8')); console.log('JSON valid')"</automated>
  </verify>
  <done>
- Les deux fichiers JSON parsent sans erreur
- La clé `pregnancy.longPressHint` existe dans FR et EN
- Le hint s'affiche sous le titre "Semaine par semaine" dans l'app
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — aucune nouvelle erreur de types
2. Lancer l'app : `npx expo run:ios --device`
3. Aller dans l'onglet Grossesse (profil avec statut grossesse requis)
4. Appui long (~400ms) sur une carte semaine passée → modal s'ouvre avec données pré-remplies
5. Modifier et enregistrer → toast "Semaine enregistrée !" + carte mise à jour avec les nouvelles données
6. Vérifier que le bouton `+ Cette semaine` continue de cibler la semaine courante
</verification>

<success_criteria>
- Long press fonctionnel sur chaque carte semaine avec feedback haptique
- Modal pré-rempli avec les valeurs existantes de la semaine ciblée
- Enregistrement ciblé : seule la semaine éditée est modifiée dans le vault (`03 - Journal/Grossesse/{enfant}.md`)
- Le bouton `+ Cette semaine` et le CTA `+ Ajouter le suivi de cette semaine` conservent leur comportement (semaine courante)
- Hint UI discret affiché sous "Semaine par semaine"
- Aucune régression `tsc`
</success_criteria>

<output>
After completion, create `.planning/quick/260424-jhs-long-press-sur-une-semaine-dans-le-suivi/260424-jhs-SUMMARY.md`
</output>
