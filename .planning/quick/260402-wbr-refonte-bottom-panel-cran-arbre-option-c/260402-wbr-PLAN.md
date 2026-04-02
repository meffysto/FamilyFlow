---
phase: quick
plan: 260402-wbr
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/tree.tsx
  - locales/fr/common.json
  - locales/en/common.json
autonomous: true
requirements: []
must_haves:
  truths:
    - "Le bottom panel affiche 2 cartes separees (Actions + Progression) au lieu d'une seule infoContainer"
    - "Les boutons d'action sont en ligne horizontale avec icone+label, sans fond/border individuel"
    - "La carte Progression affiche emoji stade + label + niveau, barre XP, et ligne evolution"
    - "La logique conditionnelle des boutons (isOwnTree, decos, companion) est preservee"
    - "Les styles inutilises sont supprimes"
  artifacts:
    - path: "app/(tabs)/tree.tsx"
      provides: "Nouveau bottom panel 2 cartes"
    - path: "locales/fr/common.json"
      provides: "Cle mascot.screen.level ajoutee"
    - path: "locales/en/common.json"
      provides: "Cle mascot.screen.level ajoutee"
  key_links:
    - from: "app/(tabs)/tree.tsx"
      to: "locales/*/common.json"
      via: "t('mascot.screen.level')"
      pattern: "mascot\\.screen\\.level"
---

<objective>
Refonte du bottom panel de l'ecran arbre : remplacer la carte unique (infoContainer avec toolbar + xpSection + evoSection) par 2 cartes separees — une carte Actions (boutons en ligne) et une carte Progression (header stade+niveau, barre XP, ligne evolution).

Purpose: Alleger visuellement le bottom panel, separer les preoccupations actions vs progression.
Output: tree.tsx refactore avec 2 cartes propres, styles nettoyes, i18n complete.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/(tabs)/tree.tsx
@locales/fr/common.json
@locales/en/common.json
@constants/spacing.ts
@constants/typography.ts
@constants/shadows.ts
@lib/mascot/types.ts (TreeStage type)

<interfaces>
<!-- Variables deja definies dans TreeScreen, a reutiliser directement -->
From app/(tabs)/tree.tsx (lignes 666-722):
```typescript
const species = profile.treeSpecies || 'cerisier';
const level = calculateLevel(profile.points ?? 0);
const tier = getLevelTier(level);
const stageInfo = getTreeStageInfo(level);  // { stage, labelKey, ... }
const stageProgress = getStageProgress(level);
const nextEvoLevel = getNextEvolutionLevel(level);
const levelsLeft = levelsUntilEvolution(level);
const sp = SPECIES_INFO[species];  // { accent, ... }
const stageIdx = getStageIndex(level);
const xpInLevel = currentXP - prevLevelXP;
const xpNeeded = nextLevelXP - prevLevelXP;
const xpPercent = xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 1;
```

From lib/mascot/types.ts:
```typescript
export type TreeStage = 'graine' | 'pousse' | 'arbuste' | 'arbre' | 'majestueux' | 'legendaire';
export const TREE_STAGES: TreeStageInfo[];
```

Cles i18n existantes (mascot.screen.*):
- xpProgress, nextEvolution, levelsToEvo, maxStage, changeSpecies, chooseSpecies, familyGarden, allStages, stageLevels
- MANQUANTE: `level` (a ajouter)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter cles i18n manquantes</name>
  <files>locales/fr/common.json, locales/en/common.json</files>
  <action>
Dans les 2 fichiers, dans l'objet `mascot.screen`:

1. Ajouter la cle `"level"`:
   - FR: `"niveau"`
   - EN: `"level"`

2. Corriger `"levelsToEvo"` pour utiliser singulier/pluriel i18next:
   - FR: remplacer `"Encore {{count}} niveaux"` par `"encore {{count}} niveau"` (i18next gere le pluriel automatiquement avec `_one`/`_other` mais ici on garde simple car le composant affiche toujours le texte tel quel)
   - EN: remplacer `"{{count}} more levels"` par `"{{count}} level left"` (singulier, meme logique)

Note: ne PAS ajouter de variantes `_one`/`_other` — le texte est utilise tel quel avec `{{ count }}` qui affiche le nombre.
  </action>
  <verify>
    <automated>grep -A2 '"level"' locales/fr/common.json | head -3 && grep '"levelsToEvo"' locales/fr/common.json && grep '"levelsToEvo"' locales/en/common.json</automated>
  </verify>
  <done>Cle `mascot.screen.level` presente dans les 2 locales, `levelsToEvo` corrige au singulier dans les 2 locales.</done>
</task>

<task type="auto">
  <name>Task 2: Refonte bottom panel — 2 cartes separees + nettoyage styles</name>
  <files>app/(tabs)/tree.tsx</files>
  <action>
**Partie A — Definir STAGE_EMOJI** (avant le composant TreeScreen, apres les constantes existantes ~ligne 136):

```typescript
const STAGE_EMOJI: Record<TreeStage, string> = {
  graine: '🌱', pousse: '🌿', arbuste: '🌿', arbre: '🌳', majestueux: '👑', legendaire: '⭐',
};
```

Importer `TreeStage` depuis `../../lib/mascot/types` (deja importe via la ligne 76 existante — verifier que le type est present dans l'import destructure, sinon l'ajouter).

**Partie B — Remplacer le JSX du bottom panel** (lignes ~1314-1442):

Remplacer tout le bloc `{/* Info profil + stade */}` (de `<Animated.View entering={FadeInDown...} style={styles.infoCard}>` jusqu'a sa fermeture `</Animated.View>`) par :

```tsx
{/* Carte 1 — Actions */}
{isOwnTree && (
<Animated.View entering={FadeInDown.delay(200).duration(400)}>
  <View style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.actionItem} onPress={() => setShowShop(true)} activeOpacity={0.7}>
        <Text style={styles.actionItemIcon}>{'🛒'}</Text>
        <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{t('mascot.shop.shortTitle', 'Boutique')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionItem} onPress={() => setShowCraftSheet(true)} activeOpacity={0.7}>
        <Text style={styles.actionItemIcon}>{'🔨'}</Text>
        <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{t('craft.atelier')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionItem} onPress={() => setShowTechTree(true)} activeOpacity={0.7}>
        <Text style={styles.actionItemIcon}>{'🔬'}</Text>
        <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{'Techs'}</Text>
      </TouchableOpacity>
      {(allDecoIds.length + allHabIds.length) > 0 && !placingItem && (
        <TouchableOpacity style={styles.actionItem} onPress={() => setShowItemPicker(true)} activeOpacity={0.7}>
          <Text style={styles.actionItemIcon}>{'🎨'}</Text>
          <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{t('mascot.shortDecorate', 'Décorer')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.actionItem} onPress={() => setShowBadges(true)} activeOpacity={0.7}>
        <Text style={styles.actionItemIcon}>{'🏅'}</Text>
        <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{'Badges'}</Text>
      </TouchableOpacity>
      {companion && (
        <TouchableOpacity style={styles.actionItem} onPress={() => setShowCompanionPicker(true)} activeOpacity={0.7}>
          <Text style={styles.actionItemIcon}>{'🐾'}</Text>
          <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{companion.name}</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
</Animated.View>
)}

{/* Carte 2 — Progression */}
<Animated.View entering={FadeInDown.delay(300).duration(400)}>
  <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm, isOwnTree ? { marginTop: Spacing.sm } : undefined]}>
    {/* Header : stade + XP */}
    <View style={styles.progressHeader}>
      <Text style={[styles.progressTitle, { color: colors.text }]}>
        {STAGE_EMOJI[stageInfo.stage]} {t(stageInfo.labelKey)} · {t('mascot.screen.level')} {level}
      </Text>
      <Text style={[styles.progressXp, { color: colors.textMuted }]}>
        {xpInLevel} / {xpNeeded} XP
      </Text>
    </View>

    {/* Barre XP */}
    <View style={[styles.progressBar, { backgroundColor: colors.cardAlt }]}>
      <View style={[styles.progressFill, { width: `${Math.round(xpPercent * 100)}%`, backgroundColor: tier.color }]} />
    </View>

    {/* Ligne evolution */}
    {nextEvoLevel !== null ? (
      <View style={styles.evoLine}>
        <Text style={[styles.evoLineText, { color: colors.textSub }]}>
          → {t(TREE_STAGES[stageIdx + 1]?.labelKey || stageInfo.labelKey)}
        </Text>
        <View style={[styles.evoLineBar, { backgroundColor: colors.cardAlt }]}>
          <View style={[styles.evoLineFill, { width: `${Math.round(stageProgress * 100)}%`, backgroundColor: sp.accent }]} />
        </View>
        <Text style={[styles.evoLineHint, { color: colors.textFaint }]}>
          {t('mascot.screen.levelsToEvo', { count: levelsLeft })}
        </Text>
      </View>
    ) : (
      <Text style={{ color: '#FFD700', fontWeight: FontWeight.bold, textAlign: 'center', marginTop: Spacing.xs }}>
        {t('mascot.screen.maxStage')}
      </Text>
    )}
  </View>
</Animated.View>
```

Note: le `marginTop: Spacing.sm` sur progressCard est conditionnel a `isOwnTree` car si on ne voit pas la carte Actions (visiteur), la carte Progression n'a pas besoin de marge haute supplementaire.

**Partie C — Remplacer les styles** dans `StyleSheet.create({...})`:

1. SUPPRIMER ces styles : `infoCard`, `infoContainer`, `toolbar`, `toolBtn`, `toolBtnIcon`, `toolBtnLabel`, `xpSection`, `xpHeader`, `xpLabel`, `xpValue`, `xpBar`, `xpFill`, `evoSection`, `evoTitle`, `evoRow`, `evoStage`, `evoEmoji`, `evoStageName`, `evoArrow`, `evoHint`, `maxStage`

2. AJOUTER ces nouveaux styles (a inserer a la place des styles supprimes, pour garder l'organisation logique) :

```typescript
actionCard: {
  borderRadius: Radius.xl,
  borderWidth: StyleSheet.hairlineWidth,
  paddingVertical: 10,
  paddingHorizontal: 14,
},
actionRow: {
  flexDirection: 'row',
},
actionItem: {
  flex: 1,
  alignItems: 'center',
  paddingVertical: 6,
},
actionItemIcon: {
  fontSize: 22,
  lineHeight: 28,
},
actionItemLabel: {
  fontSize: 10,
  fontWeight: FontWeight.semibold,
},
progressCard: {
  borderRadius: Radius.xl,
  borderWidth: StyleSheet.hairlineWidth,
  padding: 14,
  marginBottom: Spacing['2xl'],
},
progressHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: Spacing.sm,
},
progressTitle: {
  fontSize: FontSize.body,
  fontWeight: FontWeight.bold,
},
progressXp: {
  fontSize: FontSize.caption,
},
progressBar: {
  height: 8,
  borderRadius: Radius.full,
  overflow: 'hidden',
  marginBottom: Spacing.sm,
},
progressFill: {
  height: '100%',
  borderRadius: Radius.full,
},
evoLine: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.sm,
  marginTop: Spacing.xs,
},
evoLineText: {
  fontSize: FontSize.caption,
  flexShrink: 0,
},
evoLineBar: {
  flex: 1,
  height: 4,
  borderRadius: Radius.full,
  overflow: 'hidden',
},
evoLineFill: {
  height: '100%',
},
evoLineHint: {
  fontSize: FontSize.caption,
  flexShrink: 0,
},
```

**Partie D — Verifier que `TreeStage` est importe** : la ligne 76 importe deja depuis `../../lib/mascot/types` mais ne contient peut-etre pas `TreeStage`. Si absent, l'ajouter a l'import destructure existant. Le type est necessaire pour le typage de `STAGE_EMOJI`.

**NE PAS TOUCHER** : tout le reste du fichier (diorama, TreeView principal, sagas, shops, modals, ferme, compagnon, CropTooltip, etc.)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "tree.tsx" || echo "0 errors in tree.tsx"</automated>
  </verify>
  <done>
- Le bottom panel affiche 2 cartes visuellement separees (actionCard + progressCard)
- Les boutons sont en ligne horizontale sans fond/border individuel
- La carte progression affiche emoji+stade+niveau, barre XP, ligne evolution compacte
- Les 21 styles inutilises sont supprimes
- La logique conditionnelle (isOwnTree, decos, companion) est identique
- `npx tsc --noEmit` ne montre pas de nouvelles erreurs dans tree.tsx
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` ne produit pas de nouvelles erreurs dans tree.tsx
- Les cles i18n `mascot.screen.level` existent dans fr et en
- Les styles supprimes ne sont plus references nulle part dans tree.tsx
</verification>

<success_criteria>
- 2 cartes separees rendues dans le bottom panel (Actions + Progression)
- Boutons d'action en ligne horizontale avec flex:1 et sans fond individuel
- Progression: header avec emoji+stade+niveau, barre XP, ligne evolution compacte
- Aucun style orphelin restant (21 styles supprimes)
- Compilation TypeScript OK
</success_criteria>

<output>
After completion, create `.planning/quick/260402-wbr-refonte-bottom-panel-cran-arbre-option-c/260402-wbr-SUMMARY.md`
</output>
