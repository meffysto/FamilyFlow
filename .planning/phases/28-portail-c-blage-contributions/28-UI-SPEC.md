---
phase: 28
slug: portail-cablage-contributions
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-11
---

# Phase 28 — UI Design Contract

> Contrat visuel et d'interaction pour le portail ferme → village, le câblage auto-contribution, et la récompense collective.
> Généré par gsd-ui-researcher, vérifié par gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native — shadcn non applicable) |
| Preset | not applicable |
| Component library | Composants maison (`components/ui/`) + React Native core |
| Icon library | Emoji natifs (pas de librairie d'icônes externe) |
| Font | Système iOS/Android par défaut |

> Source : CLAUDE.md + absence de `components.json` + `constants/` directory confirmé.

**Token files existants (à utiliser obligatoirement) :**
- `constants/spacing.ts` — `Spacing.*`, `Radius.*`, `Layout.*`
- `constants/typography.ts` — `FontSize.*`, `FontWeight.*`, `LineHeight.*`
- `constants/colors.ts` — `LightColors` / `DarkColors` via `useThemeColors()`
- `constants/themes.ts` — couleurs accent profil via `useThemeColors().primary`
- `constants/shadows.ts` — `Shadows.*`

---

## Spacing Scale

Échelle native du projet (base non strictement 8px — base 4px avec tokens nommés). Utiliser les tokens Spacing.* — jamais de valeurs numériques hardcodées.

| Token | Value | Usage phase 28 |
|-------|-------|----------------|
| `Spacing.xs` | 4px | Gap icône-label dans le toast contribution |
| `Spacing.md` | 8px | Padding interne badge contribution, séparateurs feed |
| `Spacing.xl` | 12px | Padding interne carte récompense collective |
| `Spacing['2xl']` | 16px | Padding horizontal écran village, margin carte activité IRL |
| `Spacing['3xl']` | 20px | Padding modal récompense |
| `Spacing['4xl']` | 24px | Padding safe area, espacement sections |
| `Spacing['5xl']` | 32px | Espacement section majeure (entre carte objectif et feed) |

Exceptions :
- Portail sprite : taille du sprite dictée par la grille TileMapRenderer (cellule existante, pas de token custom)
- Touch target minimum 44×44pt pour le portail interactif (conformité iOS HIG) — implémenté via `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` si le sprite est inférieur à 44pt

> Source : `constants/spacing.ts` lu directement — tokens pré-existants, aucune valeur ajoutée.

---

## Typography

Tokens existants `FontSize.*` + `FontWeight.*` + `LineHeight.*` — pas de valeurs hors de ces tokens.

| Role | Token | Value | Weight | Line Height |
|------|-------|-------|--------|-------------|
| Label toast contribution | `FontSize.sm` | 14px | `FontWeight.normal` (400) | `LineHeight.normal` (20) |
| Body feed / carte activité | `FontSize.body` | 15px | `FontWeight.normal` (400) | `LineHeight.body` (22) |
| Titre section / carte récompense | `FontSize.heading` | 18px | `FontWeight.semibold` (600) | `LineHeight.title` (28) |
| Display récompense collective | `FontSize.title` | 20px | `FontWeight.semibold` (600) | `LineHeight.title` (28) |

Règle : exactement **2 poids** utilisés dans cette phase — `normal (400)` pour le corps, `semibold (600)` pour les titres et labels d'action. Bold (700) réservé aux chiffres de progression si déjà utilisé dans village.tsx.

> Source : `constants/typography.ts` + patterns observés dans `village.tsx`.

---

## Color

Le projet utilise `useThemeColors()` pour toutes les couleurs — aucun hex hardcodé sauf les constantes cosmétiques déclarées comme `const GOLD = '#FFD700'` dans le module (pattern établi dans `village.tsx`).

| Role | Token | Light | Dark | Usage phase 28 |
|------|-------|-------|------|----------------|
| Dominant (60%) | `colors.bg` | `#EDEAE4` | `#12151A` | Fond écran village, fond portail area |
| Secondary (30%) | `colors.card` | `#FFFFFF` | `#1C1F28` | Carte récompense collective, carte activité IRL, toast |
| Accent portail (10%) | `colors.catJeux` | `#16A34A` | `#4ADE80` | Glow portail, badge « +1 Village » — éléments exclusivement listés ci-dessous |
| Succès / objectif atteint | `colors.success` | `#10B981` | `#34D399` | Barre progression 100%, confetti récompense |
| Destructive | `colors.error` | `#EF4444` | `#F87171` | Aucune action destructive dans cette phase — déclaré pour complétude |

**Accent réservé exclusivement à :**
1. Halo / glow du sprite portail (overlay View opacity 0.15, couleur `colors.catJeux`)
2. Badge toast discret « +1 Village 🏡 » (fond `colors.catJeux`, texte `colors.onPrimary`)
3. Bouton « Réclamer » récompense collective (fond `colors.success` quand objectif atteint)

> Justification `catJeux` pour le portail : le FAB temporaire utilisait déjà `colors.catJeux` (ligne 2033 de `tree.tsx`). Cohérence avec l'existant.

> Source : `constants/colors.ts` + `app/(tabs)/village.tsx` ligne 45 + `app/(tabs)/tree.tsx` ligne 2033 + CLAUDE.md convention.

---

## Animations

Toutes les animations utilisent `react-native-reanimated` (obligatoire per CLAUDE.md).

### Portail ferme (MAP-03)

| Élément | Animation | Paramètres |
|---------|-----------|------------|
| Glow portail (idle) | `useSharedValue` opacity 0.4→0.8 loop | `withRepeat(withTiming(0.8, { duration: 1200 }), -1, true)` |
| Transition fade ferme → village | Cross-dissolve `withTiming` | `duration: 400, easing: Easing.out(Easing.ease)` |
| Feedback tap portail | Scale `withSpring` 1→0.92→1 | `const SPRING_PORTAL = { damping: 12, stiffness: 200 }` |

### Toast contribution (COOP-01 / COOP-02)

| Élément | Animation | Paramètres |
|---------|-----------|------------|
| Entrée toast | `FadeInDown` Reanimated | `duration: 250, springify()` |
| Sortie toast | `FadeOutDown` ou `withTiming(0)` | `duration: 200, delay: 2000` |

### Carte récompense (OBJ-03)

| Élément | Animation | Paramètres |
|---------|-----------|------------|
| Apparition carte activité IRL | `FadeInDown.delay(150).duration(350)` | Pattern identique aux cartes village.tsx |
| Dismiss tap | `withTiming` opacity → 0 | `duration: 200` |

> Source : CLAUDE.md conventions animations + patterns observés dans `village.tsx` (SPRING_FEED, FadeInDown).

---

## Copywriting Contract

Langue : **français** (per CLAUDE.md).

| Élément | Copy |
|---------|------|
| Toast contribution récolte | `+1 Village 🏡` (2s, non-bloquant) |
| Toast contribution tâche | `+1 Village 🏡` (même format — per D-04, copy identique) |
| CTA primaire réclamer récompense | `Récupérer la récompense` |
| Titre carte activité IRL | `Activité famille cette semaine` |
| Corps carte activité IRL | `[suggestion activée par saison, ex : "Pique-nique au parc 🌳"]` |
| Dismiss carte activité | `Fermer` (bouton texte secondaire, pas de confirmation) |
| Objectif atteint — titre | `Objectif atteint ! 🎉` |
| Objectif atteint — corps | `Toute la famille a contribué. Récupérez votre récompense collective.` |
| Bonus XP reçu — confirmation | `+[N] XP pour tous les membres` |
| État vide portail (hint one-shot) | Pas d'état vide — le portail est toujours visible dans la ferme |
| Erreur contribution impossible | `Impossible d'ajouter la contribution. Réessaie dans un instant.` (toast `colors.error`) |

> Source : CONTEXT.md D-04 (toast discret non-bloquant), D-06 (carte activité IRL dismiss par tap), D-07 (bonus équitable). Copy en français per CLAUDE.md.

---

## Interactions & États

### Portail interactif (tree.tsx)

| État | Visuel |
|------|--------|
| Idle | Sprite arche pierre pixel art + glow loop subtil (opacity 0.4→0.8) |
| Press | Scale spring 0.92 + haptic `Haptics.selectionAsync()` |
| Post-press | Transition fade cross-dissolve 400ms → navigation `router.push('/(tabs)/village')` |

### Toast contribution

| Propriété | Valeur |
|-----------|--------|
| Position | Bottom de l'écran, au-dessus de la tab bar |
| Durée | 2 secondes auto-dismiss |
| Z-order | Au-dessus du contenu, sous les modals |
| Bloquant | Non — l'action principale (récolte/tâche) conserve son propre feedback |
| Haptic | Aucun (l'action principale a déjà son haptic) |

### Carte activité IRL (village.tsx)

| État | Visuel |
|------|--------|
| Objectif non atteint | Carte masquée |
| Objectif atteint + non claimé | Carte visible avec CTA `Récupérer la récompense` |
| Claimé (flag per-profil) | Carte activité seule sans CTA, message « Récompense réclamée ✓ » |
| Dismiss | Tap n'importe où sur la carte → `withTiming` opacity 0 → masqué en mémoire session |

---

## Composants à créer / modifier

| Composant | Action | Notes |
|-----------|--------|-------|
| `PortalSprite` (inline dans `tree.tsx`) | Créer | Sprite pixel art + glow Reanimated. Peut rester inline si < 80 lignes. |
| `ContributionToast` | Créer ou réutiliser ToastProvider | Vérifier si `ToastProvider` existant suffit pour afficher `+1 Village 🏡`. |
| `RewardCard` (inline dans `village.tsx`) | Créer | Carte activité IRL + CTA récompense, conditionnelle sur `isGoalReached`. |
| `tree.tsx` | Modifier | Remplacer FAB `villageFAB` (ligne 2031) par `PortalSprite`. |
| `village.tsx` | Modifier | Ajouter `RewardCard` après barre progression, conditionnelle. |
| `hooks/useFarm.ts` | Modifier | Injecter `addContribution('harvest', profileId)` après `harvestCrop()` ligne ~287. |
| `hooks/useGamification.ts` | Modifier | Injecter `addContribution('task', profileId)` dans `applyTaskEffect()` ligne ~234. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | aucun (React Native — non applicable) | not required |
| Third-party | aucun | not required |

> Projet React Native : aucune registry shadcn. Zéro nouvelle dépendance npm (per décision ARCH-05 milestone v1.2, réaffirmée).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Traceability

| Décision | Source |
|----------|--------|
| Portail = arche pierre pixel art + glow Reanimated | CONTEXT.md D-01 |
| Fade cross-dissolve 400ms | CONTEXT.md D-02 |
| 1 récolte = 1 point, 1 tâche = 1 point | CONTEXT.md D-03 |
| Toast `+1 Village 🏡` non-bloquant 2s | CONTEXT.md D-04 |
| Points d'insertion contributions | CONTEXT.md D-05 |
| Carte activité IRL dismiss par tap | CONTEXT.md D-06 |
| Bonus XP équitable tous profils | CONTEXT.md D-07 |
| Portail remplace FAB temporaire ligne 2031 | CONTEXT.md D-08 |
| `useThemeColors()` obligatoire / pas de hex hardcodé | CLAUDE.md |
| Animations Reanimated uniquement | CLAUDE.md |
| Langue française | CLAUDE.md |
| `catJeux` pour portail | `tree.tsx` ligne 2033 (cohérence FAB existant) |
| Tokens spacing/typo/couleur | `constants/` lus directement |
