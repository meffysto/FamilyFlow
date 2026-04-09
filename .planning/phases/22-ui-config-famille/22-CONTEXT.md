# Phase 22: UI config famille - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Livrer un écran "Couplage sémantique" dans les Réglages permettant à chaque famille d'activer/désactiver les 10 catégories individuellement, avec preview des effets et stats hebdo. Persistance via SecureStore.

**Ce que Phase 22 NE fait PAS :**
- Chronologie/musée des effets (Phase 23)
- Messages compagnon étendus (Phase 24)
- Catégories dynamiques (Out of Scope)
- Effets négatifs / malus (Out of Scope)

</domain>

<decisions>
## Implementation Decisions

### Placement écran (D-01)
- **D-01**: Nouvelle `SettingsRow` dans la section "Expérience" de `settings.tsx`, placée après "Gamification" et avant "Automations". Emoji 🔗 ou 🌾, titre i18n "Couplage sémantique". Ouvre un modal `pageSheet` avec un nouveau composant `SettingsCoupling`.

### Persistance toggles per-catégorie (D-02)
- **D-02a**: Un seul objet JSON dans SecureStore, clé `semantic-overrides`. Forme : `Record<CategoryId, boolean>`. Clé absente = toutes les catégories activées par défaut.
- **D-02b**: Le flag global `semantic-coupling-enabled` (Phase 19, D-05) reste le master toggle. Si master OFF → toutes les catégories sont désactivées quelle que soit la valeur des overrides. Le master toggle est affiché en haut de l'écran Couplage.
- **D-02c**: Le dispatcher Phase 20 (`hooks/useGamification.ts`) doit lire `semantic-overrides` APRÈS avoir vérifié `isSemanticCouplingEnabled()`. Si la catégorie est `false` dans les overrides → skip l'effet comme si non-matché.

### Preview des effets (D-03)
- **D-03a**: Chaque catégorie est une carte/row affichant : icône (`EFFECT_TOASTS[catId].icon`), label catégorie (`CATEGORIES[catId].labelFr/En`), description toast (`EFFECT_TOASTS[catId].fr/en`), badge variant coloré (ambient/rare/golden — couleurs de `VARIANT_CONFIG`).
- **D-03b**: Pas d'animation ni de HarvestBurst preview dans les réglages — les données textuelles suffisent. Le bouton DEV (quick task 260409-nyw) sert pour tester les animations.

### Stats semaine (D-04)
- **D-04a**: Compteur dans SecureStore, clé `semantic-stats-week`. Forme : `{ weekKey: string, counts: Record<CategoryId, number> }`. Le `weekKey` est le lundi de la semaine courante (format `YYYY-MM-DD`).
- **D-04b**: Le dispatcher Phase 20 incrémente `counts[catId]` après chaque effet appliqué avec succès. Si `weekKey` ne correspond plus à la semaine courante → reset automatique.
- **D-04c**: L'écran affiche un résumé en haut : "X effets cette semaine" (total), et chaque row affiche son propre compteur inline.
- **D-04d**: Les stats ne persistent pas au-delà d'une semaine — c'est Phase 23 (Musée) qui gère la chronologie.

### Claude's Discretion
- Style visuel des cartes catégorie (taille, spacing, ombre) — suivre le pattern SettingsRow ou créer un composant dédié selon la densité d'info
- Ordre d'affichage des 10 catégories (par fréquence d'usage, par variant tier, ou alphabétique)
- Animation du toggle (Switch natif RN ou custom)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Semantic coupling engine
- `lib/semantic/categories.ts` — Les 10 CategoryId canoniques + CATEGORIES array avec labelFr/En et patterns
- `lib/semantic/flag.ts` — Master toggle `isSemanticCouplingEnabled()` + `setSemanticCouplingEnabled()`
- `lib/semantic/effect-toasts.ts` — EFFECT_TOASTS (10 defs icon/fr/en/subtitle), CATEGORY_VARIANT, CATEGORY_HAPTIC_FN
- `lib/semantic/effects.ts` — `applyTaskEffect()` dispatcher Phase 20

### Settings UI patterns
- `app/(tabs)/settings.tsx` — Écran index avec SettingsRow + modal pageSheet pattern
- `components/settings/SettingsRow.tsx` — Composant row réutilisable
- `components/settings/SettingsGamification.tsx` — Pattern de sous-écran settings (pour référence)

### Gamification hook
- `hooks/useGamification.ts` — `completeTask()` lignes ~260-280 : dispatch toast/haptic/SecureStore, lieu d'injection des overrides check

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SettingsRow` + `SettingsSectionHeader` : pattern établi pour les rows réglages
- `ModalHeader` : header standard des modals pageSheet avec bouton fermer
- `EFFECT_TOASTS` : toutes les données de preview sont déjà disponibles (icon, fr, en, subtitle, type)
- `CATEGORY_VARIANT` : mapping catégorie → variant pour les badges colorés
- `CATEGORIES` array dans `categories.ts` : labelFr/labelEn pour chaque catégorie
- `Switch` natif React Native : utilisé dans d'autres settings (zen, notifications)

### Established Patterns
- Settings → modal pageSheet pour chaque sous-écran (profiles, appearance, zen, gamification, etc.)
- SecureStore pour persistance légère (tokens, configs, flags)
- `useTranslation()` + fichiers `locales/fr/common.json` et `locales/en/common.json` pour i18n
- `useThemeColors()` pour toutes les couleurs dynamiques

### Integration Points
- `settings.tsx` : ajouter SectionId `'coupling'`, importer `SettingsCoupling`, ajouter SettingsRow
- `hooks/useGamification.ts` : lire `semantic-overrides` dans `completeTask()` pour filter per-catégorie
- `locales/*/common.json` : ajouter clés i18n pour l'écran

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Le pattern Settings est bien établi, il suffit de le suivre.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-ui-config-famille*
*Context gathered: 2026-04-09*
