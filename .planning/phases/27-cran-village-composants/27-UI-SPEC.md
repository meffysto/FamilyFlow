---
phase: 27
slug: ecran-village-composants
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-10
---

# Phase 27 — UI Design Contract

> Visual and interaction contract pour l'écran Place du Village.
> Généré par gsd-ui-researcher, vérifié par gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — React Native custom token system |
| Preset | not applicable |
| Component library | React Native core + Reanimated 4.1 |
| Icon library | Emoji natifs (profils) — pas de bibliothèque d'icônes externe |
| Font | Système iOS/Android par défaut |

Toutes les valeurs numériques utilisent les tokens du projet (`Spacing`, `Radius`, `FontSize`, `FontWeight`, `LineHeight` depuis `constants/`). Les couleurs sont toujours accédées via `useThemeColors()`. Aucune valeur hardcodée.

---

## Spacing Scale

Tokens existants du projet (`constants/spacing.ts`) — base 4px. Phase 27 les réutilise sans exception.

| Token projet | Valeur | Usage dans cette phase |
|-------------|--------|------------------------|
| Spacing.xs | 4px | Gap inline (emoji-nom dans le feed) |
| Spacing.md | 8px | Padding interne badge, gap entre éléments feed |
| Spacing.xl | 12px | Padding interne card, gap entre sections |
| Spacing['2xl'] | 16px | Padding horizontal écran, margin sections |
| Spacing['3xl'] | 20px | Padding vertical sections majeures |
| Spacing['4xl'] | 24px | Margin entre blocs (objectif, feed, indicateurs, historique) |
| Spacing['5xl'] | 32px | Espacement sections majeures dans ScrollView |

Exceptions : touch target FAB = 56px (Radius.full, position absolute bottom:24 right:16). Touch target minimum par membre dans la rangée indicateurs = 44px de hauteur.

---

## Typography

Tokens existants du projet (`constants/typography.ts`). Phase 27 utilise exactement 4 tailles et 2 poids.

| Rôle | Token | Valeur | Poids | LineHeight |
|------|-------|--------|-------|------------|
| Caption / timestamp relatif feed | FontSize.caption | 12px | FontWeight.normal (400) | LineHeight.tight (18) |
| Label / nom profil, montant contribution | FontSize.label | 13px | FontWeight.normal (400) | LineHeight.normal (20) |
| Body / type contribution, résumé semaine | FontSize.body | 15px | FontWeight.semibold (600) | LineHeight.body (22) |
| Heading / titre section (Objectif, Contributions, Historique) | FontSize.heading | 18px | FontWeight.semibold (600) | LineHeight.title (28) |

Poids utilisés : normal (400) pour métadonnées et labels secondaires, semibold (600) pour corps de contenu et titres. Aucun autre poids autorisé dans cette phase.

---

## Color

Source : `constants/colors.ts` via `useThemeColors()`. Split 60/30/10 appliqué au thème village.

| Rôle | Token | Valeur light | Valeur dark | Usage |
|------|-------|-------------|-------------|-------|
| Dominant (60%) | colors.bg | #EDEAE4 | #12151A | Fond écran village, fond ScrollView |
| Secondary (30%) | colors.card | #FFFFFF | #1C1F28 | Cards sections (objectif, feed, indicateurs, historique) |
| Accent village — progression (10%) | colors.success | #10B981 | #34D399 | Barre LiquidXPBar en état normal, indicateur par membre |
| Accent village — objectif atteint | colors.warning | #F59E0B | #FBBF24 | LiquidXPBar en état goal reached, bouton "Réclamer la récompense" |
| Destructive | colors.error | #EF4444 | #F87171 | Aucune action destructive dans cette phase — non utilisé |

Accent réservé exclusivement à :
1. La barre de progression LiquidXPBar (couleur `success` en progression normale)
2. La barre LiquidXPBar en état objectif atteint (couleur `warning` / dorée)
3. Le bouton "Réclamer la récompense" (background `warning`)
4. Le total de contribution sous chaque avatar dans la rangée indicateurs (texte `success`)

Le FAB sur l'écran ferme (tree.tsx) utilise `colors.catJeux` (#16A34A light / #4ADE80 dark) — couleur catégorie Jeux existante, cohérente avec le thème village/coopération. Radius.full (56×56px).

---

## Composants & Layout

### Structure écran village.tsx

```
SafeAreaView (flex:1, bg: colors.bg)
  ├── Header fixe (hauteur: 44px)
  │     ├── Bouton retour (← "Ferme") — TouchableOpacity, left
  │     └── Titre "Place du Village" — FontSize.heading, semibold, center
  │
  ├── Vue carte tilemap fixe (hauteur: 42% écran via Dimensions.get)
  │     └── TileMapRenderer (mode='village', containerWidth, containerHeight, season)
  │
  └── ScrollView (flex:1, contentContainerStyle: pb Spacing['5xl'])
        ├── Section Objectif collectif
        │     ├── Titre section
        │     ├── LiquidXPBar (color=colors.success | colors.warning si isGoalReached)
        │     └── [Conditionnel] Bouton "Réclamer la récompense" (si isGoalReached && !claimed)
        │
        ├── Section Contributions (cette semaine)
        │     ├── Titre section
        │     ├── Feed items (5 max par défaut)
        │     └── Lien "Voir tout" / "Réduire" (toggle expanded)
        │
        ├── Section Membres
        │     └── Rangée horizontale ScrollView (horizontal, avatars + totaux)
        │
        └── Section Historique
              └── CollapsibleSection × N (une par semaine passée)
```

### Feed item (ligne contribution)

Hauteur fixe: 48px. Layout horizontal:
```
[ReactiveAvatar emoji 28px] [gap 8px] [nom 13px semibold] [gap 4px] [type 13px normal textMuted] [flex:1] [montant 13px semibold success] [gap 8px] [heure 12px textFaint]
```

Séparateur: `colors.borderLight` entre chaque item, pas de card individuelle.

### Indicateur par membre

Rangée horizontale, chaque item (largeur 64px) :
```
[ReactiveAvatar emoji 36px, mood='idle'] centré
[Total contribution — FontSize.label, semibold, colors.success] centré
[Nom — FontSize.caption, normal, colors.textMuted] centré
```

### CollapsibleSection historique (résumé visible)

```
[Semaine du JJ/MM] [spacer] [thème — label] [statut badge]
  → déplié: détail par membre (même layout que indicateurs)
```

Statut badge: "Objectif atteint" (`successBg` + `successText`) ou "En cours" (`warningBg` + `warningText`) ou "Non atteint" (`border` + `textMuted`).

### FAB sur tree.tsx

Position: `absolute`, bottom: Spacing['4xl'] (24px), right: Spacing['2xl'] (16px).
Taille: 56×56px, Radius.full.
Icône: emoji "🏘️" (16px) ou texte "Village" (caption).
Background: `colors.catJeux` (#16A34A).
Ombre: `{ shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity:0.15, shadowRadius:4, elevation:4 }`.

---

## Animations

Toutes les animations utilisent `react-native-reanimated` (obligatoire per CLAUDE.md). Aucune utilisation de RN Animated.

| Élément | Animation | Config |
|---------|-----------|--------|
| LiquidXPBar — remplissage | `withSpring(pct, { damping:15, stiffness:80 })` | Existant — réutilisé sans modification |
| LiquidXPBar — vague | `withRepeat(withSequence(...withTiming))` | Existant — réutilisé sans modification |
| LiquidXPBar couleur goal | Transition `withTiming(1, {duration:600})` sur interpolateColor success→warning | Déclenché quand `isGoalReached` passe à true |
| Bouton "Réclamer" apparition | `FadeInDown` (Reanimated entering prop, duration:400) | Conditionnel sur `isGoalReached && !claimed` |
| Feed "Voir tout" dépliement | `withSpring(targetHeight, { damping:20, stiffness:200 })` sur hauteur animée | Pas de layout animation automatique |
| Transition vers écran village | Navigation expo-router native (slide iOS / fade Android) | Pas d'animation custom |
| FAB press | `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` | Feedback tactile uniquement |
| Claim récompense | `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` | Feedback tactile notification |

Constantes animation centralisées en haut du fichier village.tsx :
```typescript
const SPRING_FEED = { damping: 20, stiffness: 200 } as const;
const SPRING_BAR_COLOR = { duration: 600 } as const;
```

---

## Copywriting Contract

Langue : français. Format dates : JJ/MM/AAAA. Heures relatives dans le feed.

| Élément | Copie |
|---------|-------|
| Titre écran | "Place du Village" |
| Titre section objectif | "Objectif de la semaine" |
| Label barre progression normale | "Progression collective" |
| Label barre progression objectif atteint | "Objectif atteint ! 🎉" |
| CTA principal (objectif atteint) | "Réclamer la récompense" |
| CTA déjà claimé | "Récompense réclamée" (désactivé, opacity 0.5) |
| Titre section contributions | "Contributions cette semaine" |
| Lien dépliement feed (5 visibles) | "Voir tout (N)" |
| Lien repliement feed | "Réduire" |
| Titre section membres | "Membres actifs" |
| Titre section historique | "Semaines précédentes" |
| État vide feed (aucune contribution) | Titre : "Pas encore de contributions" / Corps : "Les récoltes et tâches complétées cette semaine apparaîtront ici." |
| État vide historique | "L'historique des semaines accomplies s'affichera ici." |
| Erreur chargement données village | "Impossible de charger les données du village. Vérifiez votre connexion iCloud." |
| Type contribution — récolte | "a récolté" |
| Type contribution — tâche | "a complété une tâche" |
| Statut semaine — objectif atteint | "Objectif atteint" |
| Statut semaine — en cours | "En cours" |
| Statut semaine — non atteint | "Non atteint" |
| Format heure relative feed | "il y a 2h", "hier", "lun." (via date-fns/fr) |
| Format résumé semaine CollapsibleSection | "Semaine du JJ/MM — Thème — Total / Cible" |

Aucune action destructive dans cette phase — aucun dialogue de confirmation requis.

---

## States & Interactions

| État | Condition | Rendu |
|------|-----------|-------|
| Loading | `gardenData === null` | ActivityIndicator centré dans la zone ScrollView |
| Vide — feed | `contributions.length === 0` | Empty state avec illustration (emoji "🌱" 48px + copy) |
| Vide — historique | `weekHistory.length === 0` | Empty state inline (copy uniquement, pas d'illustration) |
| Normal | `progress < currentTarget` | LiquidXPBar couleur `success`, pas de bouton claim |
| Objectif atteint (non claimé) | `isGoalReached && !gardenData.claimed` | LiquidXPBar couleur `warning`, bouton "Réclamer la récompense" visible |
| Objectif atteint (déjà claimé) | `isGoalReached && gardenData.claimed` | LiquidXPBar couleur `warning`, bouton "Récompense réclamée" désactivé |
| Feed réduit | par défaut | 5 premières contributions + lien "Voir tout (N)" |
| Feed étendu | après tap "Voir tout" | Toutes les contributions + lien "Réduire" |
| CollapsibleSection repliée | par défaut | Résumé (thème, statut, total/cible) |
| CollapsibleSection dépliée | après tap | Détail par membre (avatars + montants) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| N/A — projet React Native sans shadcn | — | not applicable |

Aucun registre tiers. Aucune nouvelle dépendance npm. Stack 100% existante (voir RESEARCH.md — Standard Stack).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
