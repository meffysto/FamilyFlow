---
quick_id: 260409-nyw
type: quick
autonomous: true
files_modified:
  - app/(tabs)/tree.tsx
---

<objective>
Ajouter un bouton DEV dans tree.tsx (pattern existant __DEV__) qui ouvre un modal listant les 10 catégories sémantiques. On tap sur une catégorie → déclenche toast + haptic + écrit dans SecureStore (pour compagnon). Permet de tester tout le pipeline Phase 21 sans compléter de vraie tâche.
</objective>

<context>
@./CLAUDE.md
@lib/semantic/effect-toasts.ts
@app/(tabs)/tree.tsx (lignes 1988-1996 — pattern DEV existant)
@hooks/useGamification.ts (lignes 266-280 — feedback dispatch pattern)

Pattern existant dans tree.tsx:
- Il y a déjà un bouton `__DEV__` (🐟) dans la section actionBar (ligne 1988)
- Le tree.tsx importe déjà `useToast`, `SecureStore`, `EFFECT_TOASTS`, etc.

Flow du feedback Phase 21 à reproduire :
1. Toast: `showToast(toastDef.fr, toastDef.type, undefined, toastDef.icon + ' ' + toastDef.subtitle_fr)`
2. Haptic: `CATEGORY_HAPTIC_FN[catId]()`
3. SecureStore: `SecureStore.setItemAsync('last_semantic_category', catId)` → companion le lit au retour sur l'arbre
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter modal dev test effets sémantiques dans tree.tsx</name>
  <files>app/(tabs)/tree.tsx</files>
  <read_first>
    - app/(tabs)/tree.tsx (complet — comprendre imports, state existant, actionBar __DEV__, styles)
    - lib/semantic/effect-toasts.ts (EFFECT_TOASTS, CATEGORY_VARIANT, CATEGORY_HAPTIC_FN)
    - lib/semantic/categories.ts (CategoryId, CATEGORIES pour les labels)
  </read_first>
  <action>
Modifier `app/(tabs)/tree.tsx` pour ajouter un bouton DEV + modal de test :

1. **Imports** — ajouter si pas déjà présents :
```typescript
import { EFFECT_TOASTS, CATEGORY_VARIANT, CATEGORY_HAPTIC_FN } from '../../lib/semantic/effect-toasts';
import type { CategoryId } from '../../lib/semantic/categories';
```

2. **State** — ajouter près du `devEventOverride` existant :
```typescript
const [showDevEffects, setShowDevEffects] = useState(false);
```

3. **Bouton DEV** — ajouter DANS le bloc `{__DEV__ && (...)}` existant (à côté du bouton 🐟), ou juste après :
```typescript
{__DEV__ && (
  <TouchableOpacity
    style={styles.actionItem}
    onPress={() => setShowDevEffects(true)}
    activeOpacity={0.7}
  >
    <Text style={styles.actionItemIcon}>{'⚡'}</Text>
    <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{'Effets'}</Text>
  </TouchableOpacity>
)}
```

4. **Handler de test** — ajouter une fonction dans le composant :
```typescript
const triggerDevEffect = useCallback(async (catId: CategoryId) => {
  // 1. Toast
  const toastDef = EFFECT_TOASTS[catId];
  if (toastDef) {
    showToast(
      toastDef.fr,
      toastDef.type,
      undefined,
      toastDef.icon + ' ' + toastDef.subtitle_fr,
    );
  }
  // 2. Haptic
  const hapticFn = CATEGORY_HAPTIC_FN[catId];
  if (hapticFn) hapticFn();
  // 3. SecureStore bridge (pour compagnon)
  await SecureStore.setItemAsync('last_semantic_category', catId);
  setShowDevEffects(false);
}, [showToast]);
```

5. **Modal** — ajouter avant le closing `</View>` principal, gardé par `__DEV__` :
```tsx
{__DEV__ && showDevEffects && (
  <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDevEffects(false)}>
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>DEV — Test Effets Sémantiques</Text>
        <TouchableOpacity onPress={() => setShowDevEffects(false)}>
          <Text style={{ fontSize: 16, color: colors.primary }}>Fermer</Text>
        </TouchableOpacity>
      </View>
      <ScrollView>
        {(Object.keys(EFFECT_TOASTS) as CategoryId[]).map((catId) => {
          const def = EFFECT_TOASTS[catId];
          const variant = CATEGORY_VARIANT[catId];
          return (
            <TouchableOpacity
              key={catId}
              onPress={() => triggerDevEffect(catId)}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 14,
                marginBottom: 8, borderRadius: 12, backgroundColor: colors.card,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 24, marginRight: 12 }}>{def.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{catId.replace(/_/g, ' ')}</Text>
                <Text style={{ fontSize: 13, color: colors.textSub }}>{def.fr}</Text>
              </View>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                backgroundColor: variant === 'golden' ? '#FFD70033' : variant === 'rare' ? '#A78BFA33' : '#34D39933',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: variant === 'golden' ? '#FFD700' : variant === 'rare' ? '#A78BFA' : '#34D399' }}>
                  {variant}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  </Modal>
)}
```

IMPORTANT :
- Tout le code ajouté doit être gardé par `__DEV__` — rien ne se retrouve en production
- Utiliser `showToast` depuis le hook déjà importé dans tree.tsx
- Vérifier que `SecureStore` est déjà importé (il l'est — Phase 21 l'a ajouté pour le bridge compagnon)
- Utiliser `Modal` de react-native (déjà importé dans tree.tsx)
- Styles inline OK pour du code dev-only — pas besoin de StyleSheet
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Bouton ⚡ Effets dans actionBar (DEV only), modal pageSheet listant les 10 catégories avec badge variant, tap déclenche toast+haptic+SecureStore</done>
</task>

</tasks>

<success_criteria>
- Bouton ⚡ visible uniquement en __DEV__
- Modal liste les 10 catégories avec icône, label, message toast, badge variant
- Tap déclenche : toast FR, haptic pattern, SecureStore write
- TypeScript compile sans erreur
</success_criteria>
