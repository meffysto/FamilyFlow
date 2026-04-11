---
phase: quick-260411-te0
plan: 01
subsystem: skills
tags: [i18n, skills, développement-enfant, pédiatrie, modal]
completed: "2026-04-11"
duration: "~20min"
tasks_completed: 3
files_modified: 3
key_files:
  modified:
    - locales/fr/skills.json
    - components/SkillDetailModal.tsx
    - app/(tabs)/skills.tsx
decisions:
  - "skillDescription() intégré dans useSkillt() existant — pas de second useTranslation"
  - "ScrollView remplace View content — préserve le layout, gère les longues descriptions"
  - "Retourne undefined si description vide — rendu conditionnel propre sans section vide"
---

# Quick Task 260411-te0: Descriptions médicales compétences — SUMMARY

**One-liner:** 277 descriptions médicales/développementales en français ajoutées dans skills.json et affichées dans le SkillDetailModal via ScrollView, en citant OMS, Denver II, Brazelton, HAS, PNNS et autres référentiels pédiatriques.

## Résultats

### Descriptions rédigées

- **Nombre exact :** 277 descriptions (1 par clé de `tree` — exhaustif, 0 manquant)
- **Référentiels cités :** OMS, Denver II, Brazelton, HAS, PNNS, Piaget, Wallon, Oller, Baron-Cohen, Meltzoff, Spitz, Parten, Zelazo, Duckworth, Hattie, Salovey & Mayer, MEN (programmes scolaires), UFSBD, Banque de France, B2i, PSC1 (Croix-Rouge)
- **Tonalité :** médical/développemental professionnel, accessible aux parents, sans formulations anxiogènes
- **Format :** 2-3 phrases en français, max ~280 caractères

### Groupes couverts

| Catégorie | Tranches d'âge | Nb |
|-----------|---------------|-----|
| motricite_globale | 0-1, 1-2, 2-3 | 24 |
| motricite_fine | 0-1, 1-2, 2-3 | 19 |
| langage | 0-1, 1-2, 2-3 | 21 |
| social | 0-1, 1-2, 2-3, 3-5, 6-8, 9-11, 12-14, 15+ | 55 |
| cuisine | 0-1, 1-2, 2-3, 3-5, 6-8, 9-11, 12-14, 15+ | 41 |
| proprete | 1-2, 2-3 | 10 |
| menage | 1-2, 2-3, 3-5, 6-8, 9-11, 12-14, 15+ | 36 |
| autonomie | 3-5, 6-8, 9-11, 12-14, 15+ | 25 |
| organisation | 2-3, 3-5, 6-8, 9-11, 12-14, 15+ | 29 |
| responsabilite | 3-5, 6-8, 9-11, 12-14, 15+ | 25 |

### Statut TypeScript

`npx tsc --noEmit` — aucune nouvelle erreur. Les erreurs pré-existantes (TabletSidebar.tsx, video/remotion, MemoryEditor.tsx, cooklang.ts, useVault.ts) sont inchangées.

## Modifications fichiers

### `locales/fr/skills.json`
- Objet `descriptions` ajouté entre `ageBrackets` et `tree`
- 277 entrées, une par clé de `tree`
- JSON valide (`node -e JSON.parse` : OK)

### `components/SkillDetailModal.tsx`
- `ScrollView` importé depuis `react-native`
- `description?: string` ajouté à `SkillDetailModalProps`
- `description` destructuré dans la signature de la fonction
- `View style={styles.content}` remplacé par `ScrollView contentContainerStyle={styles.content}`
- Section description rendue après le XP (rendu conditionnel `{description ? ... : null}`)
- Styles `descriptionSection` + `description` ajoutés avec tokens `Spacing.*` et `FontSize.sm`
- `paddingBottom: Spacing['5xl']` ajouté sur `content`
- Aucune couleur hardcodée — `colors.textSub` via `useThemeColors()`

### `app/(tabs)/skills.tsx`
- `skillDescription(id)` ajouté dans `useSkillt()` — réutilise l'instance `useTranslation('skills')` existante
- Prop `description={selectedSkill ? sk.skillDescription(selectedSkill.id) : undefined}` passée à `<SkillDetailModal>`
- Aucun second `useTranslation` créé

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 840e66a | feat(quick-260411-te0-01): 277 descriptions médicales dans skills.json |
| 2 | 573afe0 | feat(quick-260411-te0-02): prop description + ScrollView SkillDetailModal |
| 3 | ec2924d | feat(quick-260411-te0-03): passer description via i18n dans skills.tsx |

## Deviations from Plan

None - plan exécuté exactement comme spécifié.

## Prochaines étapes éventuelles

- **Traduction anglaise différée :** `locales/en/skills.json` non modifié (non demandé par la spec). Le `defaultValue: ''` dans `t()` assure le fallback propre.
- **CAMSP/orthophonie :** Ajouter des liens vers ressources professionnelles (CAMSP, libhandi) pourrait enrichir la section bilans recommandés à terme.

## Self-Check

Vérifications automatiques :
- [x] `locales/fr/skills.json` — existe et contient 277 descriptions (`missing: 0`)
- [x] `components/SkillDetailModal.tsx` — modifié, `description?: string` présent
- [x] `app/(tabs)/skills.tsx` — modifié, `sk.skillDescription` passé au modal
- [x] 3 commits vérifiés : 840e66a, 573afe0, ec2924d

## Self-Check: PASSED
