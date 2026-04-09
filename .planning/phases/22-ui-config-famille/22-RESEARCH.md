# Phase 22: UI config famille - Research

**Researched:** 2026-04-09
**Domain:** React Native Settings UI + SecureStore persistence + Semantic coupling integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Placement écran:**
Nouvelle `SettingsRow` dans la section "Expérience" de `settings.tsx`, placée après "Gamification" et avant "Automations". Emoji 🔗 ou 🌾, titre i18n "Couplage sémantique". Ouvre un modal `pageSheet` avec un nouveau composant `SettingsCoupling`.

**D-02 — Persistance toggles per-catégorie:**
- D-02a: Un seul objet JSON dans SecureStore, clé `semantic-overrides`. Forme : `Record<CategoryId, boolean>`. Clé absente = toutes les catégories activées par défaut.
- D-02b: Le flag global `semantic-coupling-enabled` (Phase 19, D-05) reste le master toggle. Si master OFF → toutes les catégories désactivées quelle que soit la valeur des overrides. Master toggle affiché en haut de l'écran Couplage.
- D-02c: Le dispatcher Phase 20 (`hooks/useGamification.ts`) doit lire `semantic-overrides` APRÈS avoir vérifié `isSemanticCouplingEnabled()`. Si la catégorie est `false` dans les overrides → skip l'effet comme si non-matché.

**D-03 — Preview des effets:**
- D-03a: Chaque catégorie est une carte/row affichant : icône (`EFFECT_TOASTS[catId].icon`), label catégorie (`CATEGORIES[catId].labelFr/En`), description toast (`EFFECT_TOASTS[catId].fr/en`), badge variant coloré (ambient/rare/golden — couleurs de `VARIANT_CONFIG`).
- D-03b: Pas d'animation ni de HarvestBurst preview dans les réglages — données textuelles suffisent.

**D-04 — Stats semaine:**
- D-04a: Compteur dans SecureStore, clé `semantic-stats-week`. Forme : `{ weekKey: string, counts: Record<CategoryId, number> }`. `weekKey` = lundi de la semaine courante (format `YYYY-MM-DD`).
- D-04b: Le dispatcher Phase 20 incrémente `counts[catId]` après chaque effet appliqué avec succès. Reset auto si `weekKey` dépasse la semaine courante.
- D-04c: L'écran affiche un résumé en haut : "X effets cette semaine" (total), et chaque row affiche son propre compteur inline.
- D-04d: Les stats ne persistent pas au-delà d'une semaine — Phase 23 gère la chronologie.

### Claude's Discretion
- Style visuel des cartes catégorie (taille, spacing, ombre) — suivre le pattern SettingsRow ou créer un composant dédié selon la densité d'info
- Ordre d'affichage des 10 catégories (par fréquence d'usage, par variant tier, ou alphabétique)
- Animation du toggle (Switch natif RN ou custom)

### Deferred Ideas (OUT OF SCOPE)
- Chronologie/musée des effets (Phase 23)
- Messages compagnon étendus (Phase 24)
- Catégories dynamiques (Out of Scope)
- Effets négatifs / malus (Out of Scope)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COUPLING-01 | User can access a "Couplage sémantique" screen in Settings | D-01: SettingsRow dans section "Expérience" après "Gamification", modal pageSheet |
| COUPLING-02 | User sees all 10 categories with their mapped effect | CATEGORIES array + EFFECT_TOASTS + CATEGORY_VARIANT disponibles dans lib/semantic/ |
| COUPLING-03 | User can toggle each category on/off individually | Switch natif RN + SecureStore clé `semantic-overrides` (Record<CategoryId, boolean>) |
| COUPLING-04 | User sees a preview of what each effect does | EFFECT_TOASTS[catId].fr/en + icon + subtitle_fr/en déjà structurés pour cela |
| COUPLING-05 | User sees weekly stats (how many effects triggered this week) | SecureStore clé `semantic-stats-week` + logique weekKey lundi + write in useGamification.ts |
| COUPLING-06 | User's toggle state persists across app restarts | SecureStore.setItemAsync/getItemAsync — pattern établi dans flag.ts et tout settings.tsx |
</phase_requirements>

---

## Summary

Phase 22 est une phase UI pure qui exploite des données de coupling sémantique déjà 100% construites par les phases 19-21. Toutes les données nécessaires à l'affichage existent : `CATEGORIES` (labels FR/EN), `EFFECT_TOASTS` (icon, descriptions FR/EN, type), `CATEGORY_VARIANT` (ambient/rare/golden pour badges colorés), `VARIANT_CONFIG` (couleurs par variant dans HarvestBurst.tsx). La persistance suit le pattern SecureStore établi dans `lib/semantic/flag.ts`.

Le travail se décompose en trois axes : (1) créer le composant `SettingsCoupling` avec master toggle + liste des 10 catégories + stats semaine, (2) câbler settings.tsx (SectionId, SettingsRow, rendu modal), et (3) injecter la logique overrides + stats dans `useGamification.ts` (`completeTask`). Le point d'injection dans `completeTask` est connu précisément : ligne ~225, après `isCapExceeded` et avant `applyTaskEffect`.

La phase ne nécessite aucune nouvelle dépendance npm (ARCH-04). Les patterns de code sont strictement identiques à ceux utilisés dans SettingsZen (Switch natif + async SecureStore) et SettingsGamification (cartes avec données dynamiques).

**Primary recommendation:** Suivre exactement le pattern SettingsZen pour le composant — toggle principal + liste de cards avec Switch par item — en réutilisant EFFECT_TOASTS et CATEGORY_VARIANT comme source de données d'affichage.

---

## Standard Stack

### Core (tous déjà présents dans le projet)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-secure-store | Expo SDK 54 bundled | Persistance `semantic-overrides` + `semantic-stats-week` | Déjà utilisé pour `semantic-coupling-enabled`, tokens, zen config |
| react-native Switch | RN 0.81.5 bundled | Toggle per-catégorie | Natif, déjà utilisé dans SettingsZen et SettingsNotifications |
| react-i18next | Bundled | i18n FR/EN des clés UI | useTranslation() utilisé dans tous les composants Settings |
| useThemeColors | Projet | Couleurs dynamiques | CLAUDE.md: jamais de hardcoded |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Shadows | Projet constants/ | Ombres cartes | `Shadows.sm` sur les cards — pattern SettingsGamification |
| Spacing / Radius | Projet constants/ | Layout tokens | CLAUDE.md: jamais de valeurs numériques hardcodées |
| FontSize / FontWeight | Projet constants/ | Typographie | Parité avec tous les autres Settings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Switch natif RN | Custom animated toggle (Reanimated) | Switch natif suffit — pas d'animation custom requise (D-03b: pas d'animation preview) |
| Record<CategoryId, boolean> SecureStore | Per-key SecureStore (10 clés séparées) | Un seul objet JSON = atomic read/write, moins de latence SecureStore |

---

## Architecture Patterns

### Recommended Project Structure

```
components/settings/
└── SettingsCoupling.tsx        # Nouveau composant (à créer)

hooks/
└── useGamification.ts          # Modifier: injecter overrides check + stats increment

locales/fr/common.json          # Ajouter clés settingsScreen + settings.coupling
locales/en/common.json          # Parité stricte FR/EN

lib/semantic/
└── coupling-overrides.ts       # Nouveau: helpers loadOverrides/saveOverrides/loadWeekStats/saveWeekStats/incrementWeekStat
                                # (OU inliner dans SettingsCoupling — à décider planner)

app/(tabs)/settings.tsx         # Modifier: SectionId, SettingsRow, rendu modal
```

### Pattern 1: SettingsCoupling — structure interne

```
SettingsCoupling
├── Master toggle section
│   ├── Switch isSemanticCouplingEnabled (lecture/écriture flag.ts)
│   └── Sous-titre "X effets cette semaine" (total des counts)
└── Liste ScrollView des 10 catégories (FlatList ou map simple)
    └── CategoryRow × 10
        ├── icon (EFFECT_TOASTS[id].icon)
        ├── label (CATEGORIES[id].labelFr ou labelEn via i18n)
        ├── description (EFFECT_TOASTS[id].fr ou en)
        ├── badge variant coloré (CATEGORY_VARIANT[id] → couleur VARIANT_CONFIG)
        ├── compteur semaine inline (weekStats.counts[id] ?? 0)
        └── Switch (overrides[id] ?? true, disabled si master OFF)
```

### Pattern 2: SecureStore — gestion des overrides

```typescript
// Clé: 'semantic-overrides'
// Valeur: JSON.stringify(Record<CategoryId, boolean>)
// Absence de clé → toutes les catégories true par défaut

async function loadOverrides(): Promise<Record<string, boolean>> {
  try {
    const raw = await SecureStore.getItemAsync('semantic-overrides');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveOverrides(overrides: Record<string, boolean>): Promise<void> {
  await SecureStore.setItemAsync('semantic-overrides', JSON.stringify(overrides));
}
```

### Pattern 3: SecureStore — stats semaine

```typescript
// Clé: 'semantic-stats-week'
// Valeur: JSON.stringify({ weekKey: 'YYYY-MM-DD', counts: Record<CategoryId, number> })
// weekKey = lundi de la semaine courante

function getWeekKey(now = new Date()): string {
  const day = now.getDay(); // 0=dimanche
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // ajuster au lundi
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

async function loadWeekStats(): Promise<{ weekKey: string; counts: Record<string, number> }> {
  try {
    const raw = await SecureStore.getItemAsync('semantic-stats-week');
    if (!raw) return { weekKey: getWeekKey(), counts: {} };
    const parsed = JSON.parse(raw);
    const currentWeek = getWeekKey();
    if (parsed.weekKey !== currentWeek) {
      return { weekKey: currentWeek, counts: {} }; // reset auto
    }
    return parsed;
  } catch { return { weekKey: getWeekKey(), counts: {} }; }
}
```

### Pattern 4: Injection dans useGamification.ts — overrides check

L'injection se fait dans le bloc try "Phase 20" de `completeTask`, après `isSemanticCouplingEnabled()` et avant `applyTaskEffect()`. Le pattern exact :

```typescript
// Après: const enabled = await isSemanticCouplingEnabled();
// Après: if (enabled && taskMeta) { const category = deriveTaskCategory(task); ... }
// AVANT: effectResult = applyTaskEffect(category, farmData);

// Injecter ICI:
const overrides = await loadOverrides(); // depuis lib/semantic/coupling-overrides.ts
if (overrides[category.id] === false) {
  // catégorie désactivée → skip comme si non-matché (D-02c)
  derivedCategory = null;
  // ne pas appeler applyTaskEffect
} else {
  effectResult = applyTaskEffect(category, farmData);
  if (effectResult.effectApplied) {
    // ... logique existante caps etc.
    // NOUVEAU: incrémenter stats semaine
    try {
      await incrementWeekStat(category.id);
    } catch { /* stats — non-critical */ }
  }
}
```

### Pattern 5: Insertion dans settings.tsx

Trois modifications minimales :

1. **SectionId union** (ligne ~46) : ajouter `'coupling'`
2. **sectionTitles** (ligne ~112) : ajouter `coupling: t('settingsScreen.modalTitles.coupling')`
3. **SettingsRow** dans section "Expérience" : insérer après la row `gamification`, avant `automations`
4. **Rendu conditionnel** dans le modal : ajouter `{activeSection === 'coupling' && <SettingsCoupling />}`
5. **Import** : `import { SettingsCoupling } from '../../components/settings/SettingsCoupling';`

Insertion SettingsRow dans JSX (entre gamification et automations) :
```tsx
{!isChildMode && (
  <SettingsRow
    emoji="🔗"
    title={t('settingsScreen.rows.coupling')}
    subtitle={t('settingsScreen.rows.couplingSubtitle')}
    onPress={() => setActiveSection('coupling')}
  />
)}
```
Note : gamification row n'a plus `isLast` quand coupling et automations suivent.

### Pattern 6: Couleurs badge variant

`VARIANT_CONFIG` dans `HarvestBurst.tsx` expose les couleurs par variant. Pour les badges dans SettingsCoupling :

```typescript
import { VARIANT_CONFIG } from '../mascot/HarvestBurst'; // ou réexporter depuis lib/semantic

// CATEGORY_VARIANT[catId] → 'ambient' | 'rare' | 'golden'
// VARIANT_CONFIG[variant].labelColor → couleur du badge texte
// VARIANT_CONFIG[variant].particleColor → couleur fond badge

const variant = CATEGORY_VARIANT[catId]; // ex: 'golden'
const badgeColor = VARIANT_CONFIG[variant].particleColor; // '#FFD700'
const badgeLabelColor = VARIANT_CONFIG[variant].labelColor; // '#FFD700'
```

Créer un badge inline avec `backgroundColor` + `borderRadius` + `Text` plutôt qu'utiliser `<Badge>` (Badge.tsx ne supporte pas variant golden/rare/ambient — ses variants sont default/success/warning/error/info).

### Anti-Patterns to Avoid

- **N'utiliser pas `<Badge>` de `components/ui/Badge.tsx`** pour les badges variant — ses variants ne correspondent pas à ambient/rare/golden. Créer un badge inline ou un mini-composant `VariantBadge`.
- **Ne pas hardcoder les couleurs** des badges (CLAUDE.md: jamais de #FFFFFF etc.) — utiliser `VARIANT_CONFIG[variant].particleColor` et `VARIANT_CONFIG[variant].labelColor`.
- **Ne pas lire les overrides au montage du Settings principal** — les charger uniquement dans `SettingsCoupling` (lazy load, économie SecureStore).
- **Ne pas rendre `SettingsCoupling` visible en mode enfant** (`isChildMode`) — cohérent avec Gamification, Zen, Automations.
- **Ne pas oublier de retirer `isLast` de la row Gamification** quand la row Coupling est insérée — sinon coin bas-droit ne sera pas arrondi correctement dans le groupe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistance overrides | Système de state management custom | `SecureStore.getItemAsync/setItemAsync` | Pattern établi dans flag.ts, ParentalControls, ZenConfig |
| Calcul weekKey | Librairie date-fns / moment | Calcul inline getWeekKey() (10 lignes) | ARCH-04: zéro nouvelle dépendance. Logique équivalente déjà dans useGamification.ts (getWeekStart) |
| Labels/icons catégories | Constantes dupliquées locales | `CATEGORIES[catId].labelFr/En` + `EFFECT_TOASTS[catId].icon/fr/en` | Source unique de vérité dans lib/semantic/ |
| Badge coloré variant | SVG, Lottie, image asset | View inline + Text (backgroundColor + borderRadius) | Simple, pas de dépendance, cohérent avec le style Settings |
| Master toggle state | Context global, Redux | useState local + SecureStore sync (pattern SettingsZen) | Cohérent avec tous les autres Settings — no context sharing needed |

**Key insight:** Toutes les données d'affichage (labels, icons, descriptions, couleurs) sont déjà compilées dans les modules lib/semantic/. Ce composant est un lecteur de ces données, pas un producteur.

---

## Common Pitfalls

### Pitfall 1: Ordre d'affichage des catégories vs ordre CATEGORIES array
**What goes wrong:** L'ordre dans `CATEGORIES` est une priorité de matching (courses avant bebe_soins), pas un ordre d'affichage logique pour l'utilisateur.
**Why it happens:** `CATEGORIES` est ordonné pour la logique de dérivation (spécifique avant générique), ce qui donne un ordre visuellement incohérent.
**How to avoid:** Définir un ordre d'affichage séparé dans `SettingsCoupling` (par variant tier: golden > rare > ambient, puis alphabétique au sein du tier). Ou utiliser l'ordre CATEGORIES tel quel si le planner décide de ne pas réordonner.
**Warning signs:** Si l'ordre `courses, bebe_soins, enfants_devoirs, menage_quotidien...` semble incohérent à un utilisateur.

### Pitfall 2: isLast/isFirst sur les SettingsRow — coins arrondis cassés
**What goes wrong:** Ajouter la row Coupling entre Gamification et Automations sans retirer `isLast` de Gamification et `isFirst` des rows adjacentes.
**Why it happens:** Le styling des coins arrondis du groupe est géré par `isFirst` / `isLast` sur chaque row.
**How to avoid:** Vérifier que Gamification n'a plus `isLast` quand Coupling est ajoutée, et que la row après Coupling (Automations) n'a pas `isFirst` (elle n'en avait pas de toute façon).
**Warning signs:** Groupe visuellement sans coins arrondis intermédiaires, ou coins aux mauvais endroits.

### Pitfall 3: Switch disabled quand master toggle OFF — accessibilité
**What goes wrong:** Les Switch per-catégorie peuvent paraître interactifs même quand le master est OFF.
**Why it happens:** `disabled` prop sur Switch ne change pas l'opacité visuellement sur iOS sans style additionnel.
**How to avoid:** Appliquer `opacity: 0.4` sur les rows catégories quand master est OFF + passer `disabled={!masterEnabled}` sur chaque Switch.
**Warning signs:** User tente de toggler une catégorie alors que le master est OFF, confusion.

### Pitfall 4: Latence SecureStore lors du montage — flash de contenu
**What goes wrong:** Les overrides et stats chargés en async depuis SecureStore créent un flash (catégories apparaissent toutes activées puis se mettent à jour).
**Why it happens:** SecureStore.getItemAsync est async, le state initial est vide/défaut.
**How to avoid:** Initialiser l'état local avec les valeurs par défaut (toutes actives, stats vides) ET afficher un indicateur de chargement minimal (ActivityIndicator ou opacity 0 pendant 100ms) OU accepter le flash (jugement de valeur — les autres Settings font pareil).
**Warning signs:** Cartes "clignotent" au montage.

### Pitfall 5: getWeekKey timezone — lundi incorrect
**What goes wrong:** Le calcul du lundi dépend du timezone local. En UTC+2, le dimanche soir peut être le lundi en UTC.
**Why it happens:** `new Date()` est local, `.getDay()` dépend du timezone.
**How to avoid:** Utiliser le calcul local (pas UTC) — cohérent avec useGamification.ts `getWeekStart` qui utilise aussi new Date() local. Les deux doivent utiliser la même logique pour que les resets soient synchronisés.
**Warning signs:** Stats se réinitialisent au mauvais moment selon le fuseau.

### Pitfall 6: Injection overrides dans completeTask — lecture async dans hot path
**What goes wrong:** `loadOverrides()` est appelé pour chaque `completeTask()` — latence SecureStore sur chaque tâche complétée.
**Why it happens:** SecureStore.getItemAsync a ~5-15ms de latence sur iOS.
**How to avoid:** Mettre en cache les overrides dans un module-level variable (comme `loadGamiConfig()` utilise un cache synchrone). Invalider le cache quand SettingsCoupling sauvegarde. Alternative: passer les overrides comme argument à `completeTask` depuis l'appelant — mais cela change la signature.
**Warning signs:** `completeTask` perceptiblement plus lent après activation du feature.

---

## Code Examples

### Lecture overrides avec valeur par défaut (D-02a)

```typescript
// lib/semantic/coupling-overrides.ts (nouveau fichier)
import * as SecureStore from 'expo-secure-store';
import type { CategoryId } from './categories';

export const OVERRIDES_KEY = 'semantic-overrides';
export const WEEK_STATS_KEY = 'semantic-stats-week';

// Cache module-level pour éviter latence SecureStore sur hot path
let _overridesCache: Record<string, boolean> | null = null;

export async function loadOverrides(): Promise<Record<string, boolean>> {
  if (_overridesCache !== null) return _overridesCache;
  try {
    const raw = await SecureStore.getItemAsync(OVERRIDES_KEY);
    _overridesCache = raw ? JSON.parse(raw) : {};
    return _overridesCache;
  } catch { return {}; }
}

export async function saveOverrides(overrides: Record<string, boolean>): Promise<void> {
  _overridesCache = overrides; // invalider + mettre à jour le cache
  await SecureStore.setItemAsync(OVERRIDES_KEY, JSON.stringify(overrides));
}

export function isCategoryEnabled(catId: CategoryId, overrides: Record<string, boolean>): boolean {
  // Clé absente = activée par défaut (D-02a)
  return overrides[catId] !== false;
}
```

### Calcul weekKey (D-04a)

```typescript
export function getWeekKey(now = new Date()): string {
  const day = now.getDay(); // 0=dimanche, 1=lundi, ...
  const diff = day === 0 ? -6 : 1 - day; // retour au lundi
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}
```

### Clés i18n à ajouter (FR)

```json
// locales/fr/common.json → settingsScreen.rows
"coupling": "Couplage sémantique",
"couplingSubtitle": "10 catégories, effets personnalisables",

// locales/fr/common.json → settingsScreen.modalTitles
"coupling": "Couplage sémantique",

// locales/fr/common.json → settings.coupling (nouveau namespace)
"settings": {
  "coupling": {
    "sectionA11y": "Paramètres du couplage sémantique",
    "masterTitle": "Couplage sémantique",
    "masterSubtitle": "Les tâches déclenchent des effets ferme",
    "weekStatsTotal_zero": "Aucun effet cette semaine",
    "weekStatsTotal_one": "{{count}} effet cette semaine",
    "weekStatsTotal_other": "{{count}} effets cette semaine",
    "weekStatsCat_zero": "Jamais",
    "weekStatsCat_one": "{{count}} fois",
    "weekStatsCat_other": "{{count}} fois",
    "variantAmbient": "courant",
    "variantRare": "rare",
    "variantGolden": "épique"
  }
}
```

### Clés i18n à ajouter (EN — parité stricte FEEDBACK-05)

```json
// locales/en/common.json → settingsScreen.rows
"coupling": "Semantic coupling",
"couplingSubtitle": "10 categories, customizable effects",

// locales/en/common.json → settingsScreen.modalTitles
"coupling": "Semantic coupling",

// locales/en/common.json → settings.coupling
"settings": {
  "coupling": {
    "sectionA11y": "Semantic coupling settings",
    "masterTitle": "Semantic coupling",
    "masterSubtitle": "Tasks trigger farm effects",
    "weekStatsTotal_zero": "No effects this week",
    "weekStatsTotal_one": "{{count}} effect this week",
    "weekStatsTotal_other": "{{count}} effects this week",
    "weekStatsCat_zero": "Never",
    "weekStatsCat_one": "{{count}} time",
    "weekStatsCat_other": "{{count}} times",
    "variantAmbient": "common",
    "variantRare": "rare",
    "variantGolden": "epic"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Overrides inexistants | `semantic-overrides` SecureStore JSON | Phase 22 (nouveau) | Granularité per-catégorie sans migration |
| Stats non-tracked | `semantic-stats-week` SecureStore auto-reset | Phase 22 (nouveau) | Visibilité semaine, chronologie Phase 23 |
| Switch custom Reanimated | Switch natif React Native | Pattern établi | Pas d'overhead animation, cohérence Settings |

**Deprecated/outdated:**
- Aucun — cette phase est greenfield sur la couche UI.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 22 est une phase code/UI pure. Aucune dépendance externe au-delà de l'Expo SDK déjà installé. expo-secure-store est bundlé dans Expo SDK 54.

---

## Open Questions

1. **Ordre d'affichage des 10 catégories**
   - What we know: CATEGORIES est ordonné pour le matching, pas l'affichage. CATEGORY_VARIANT permet un tri par tier (golden > rare > ambient).
   - What's unclear: Le planner n'a pas de contrainte utilisateur — c'est la discrétion Claude.
   - Recommendation: Trier par variant tier (golden en premier = impression de richesse), puis par fréquence naturelle dans la vie de famille : bebe_soins, rendez_vous (golden), puis cuisine_repas, gratitude_famille, budget_admin (rare), puis les 5 ambient.

2. **Caching des overrides dans useGamification.ts**
   - What we know: SecureStore a ~5-15ms latence. `completeTask` est appelé pour chaque tâche — potentiellement plusieurs fois par session.
   - What's unclear: Impact réel sur la performance. `loadGamiConfig()` utilise un cache module-level — même pattern applicable.
   - Recommendation: Implémenter un cache module-level dans `coupling-overrides.ts` (voir Code Examples). Invalider le cache dans `saveOverrides()`.

3. **Fichier lib/semantic/coupling-overrides.ts vs inline dans SettingsCoupling**
   - What we know: Les helpers doivent être accessibles depuis deux endroits : SettingsCoupling (UI) et useGamification.ts (dispatcher).
   - What's unclear: Le planner doit décider si un nouveau fichier lib/ est créé ou si les helpers sont importés depuis SettingsCoupling.
   - Recommendation: Créer `lib/semantic/coupling-overrides.ts` — évite la dépendance hooks → components, cohérent avec le pattern `lib/semantic/flag.ts`.

---

## Sources

### Primary (HIGH confidence)
- Code source lu directement : `lib/semantic/categories.ts` — 10 CategoryId canoniques + CATEGORIES array
- Code source lu directement : `lib/semantic/effect-toasts.ts` — EFFECT_TOASTS, CATEGORY_VARIANT, CATEGORY_HAPTIC_FN
- Code source lu directement : `lib/semantic/flag.ts` — master toggle pattern SecureStore
- Code source lu directement : `lib/semantic/effects.ts` — applyTaskEffect dispatcher
- Code source lu directement : `hooks/useGamification.ts` — point d'injection lignes 210-286
- Code source lu directement : `app/(tabs)/settings.tsx` — SectionId union, SettingsRow pattern, modal rendering
- Code source lu directement : `components/settings/SettingsGamification.tsx` — pattern carte + données dynamiques
- Code source lu directement : `components/settings/SettingsZen.tsx` — Switch natif + async SecureStore pattern
- Code source lu directement : `components/settings/SettingsRow.tsx` — isFirst/isLast + coins arrondis
- Code source lu directement : `components/mascot/HarvestBurst.tsx` — VARIANT_CONFIG couleurs ambient/rare/golden
- Code source lu directement : `components/ui/Badge.tsx` — variants existants (ne supporte pas ambient/rare/golden)
- Code source lu directement : `locales/fr/common.json` + `locales/en/common.json` — structure clés settingsScreen existantes

### Secondary (MEDIUM confidence)
- N/A — toutes les informations critiques sont HIGH confidence (lues depuis le code source).

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — tous les composants et patterns sont lus depuis le code source existant
- Architecture: HIGH — les patterns Settings sont établis et répétitifs, adaptation directe
- Pitfalls: HIGH — identifiés depuis la lecture de code réel (isLast pattern, Switch disabled, getWeekKey logic)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable — pas de dépendances externes, tout est dans le codebase)
