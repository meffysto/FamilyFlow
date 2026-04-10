# Phase 23: Musée des effets (SEED-002 lite) - Research

**Researched:** 2026-04-10
**Domain:** Persistance vault markdown + UI SectionList React Native + patterns Phase 17 Codex
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Format persistance**
- D-01a: Nouvelle section `## Musée` en bas de `gami-{id}.md` (après les sections existantes). Format append-only.
- D-01b: Format d'une entrée : `- YYYY-MM-DDTHH:mm:ss | {categoryId} | {icon} {labelFr}` — une ligne par effet déclenché.
- D-01c: Parser : `parseMuseumEntries(content: string): MuseumEntry[]`. Serializer : `appendMuseumEntry(content: string, entry: MuseumEntry): string`.
- D-01d: Type `MuseumEntry = { date: Date; categoryId: CategoryId; icon: string; label: string }`.
- D-01e: Pas de limite de taille — append-only, jamais tronqué.

**D-02 — Structure écran**
- D-02a: Modal `pageSheet` accessible depuis tree.tsx, nouveau bouton dans l'actionBar (emoji 🏛️, label "Musée").
- D-02b: Réutiliser le pattern `FarmCodexModal` : SafeAreaView + header + contenu scrollable.
- D-02c: `SectionList` natif RN groupé par semaine (lundi→dimanche). Header : "Semaine du DD/MM/AAAA". Fallback : "Cette semaine".
- D-02d: Chaque row : icône catégorie + label effet FR/EN + date/heure relative.
- D-02e: Badge variant coloré (ambient/rare/golden) inline comme dans SettingsCoupling.
- D-02f: Empty state : "Aucun effet enregistré — complète des tâches pour remplir le musée !" avec icône 🏛️.
- D-02g: Animations : `FadeInDown` de react-native-reanimated sur chaque row (delay: index * 50).

**D-03 — Point d'enregistrement**
- D-03a: Dans `hooks/useGamification.ts`, dans `completeTask()`, APRÈS le toast/haptic/SecureStore (Phase 21, lignes ~270-285), quand `effectResult?.effectApplied` est truthy.
- D-03b: Appel fire-and-forget avec try/catch silencieux.
- D-03c: Le module `lib/museum/engine.ts` encapsule la logique.

**D-04 — Groupement temporel**
- D-04a: Groupement primaire par semaine (lundi→dimanche) pour la SectionList.
- D-04b: Header : "Semaine du DD/MM/AAAA" (format FR, DD/MM/AAAA per CLAUDE.md).
- D-04c: Pas de groupement par mois dans cette version lite.

### Claude's Discretion
- Taille des rows (compact vs spacieux) — suivre la densité du Codex
- Icône exacte du bouton Musée dans tree.tsx
- Ordre des entrées dans une semaine (chronologique descendant = plus récent en haut)
- Nombre de clés i18n nécessaires

### Deferred Ideas (OUT OF SCOPE)
- Hub cross-feature musée (photos, anniversaires, gratitude) — SEED-002 full
- Groupement par mois avec collapse — future milestone
- Filtrage par catégorie dans le musée — future milestone
- Carte d'inauguration narrative — future milestone
- Rétroactivité des effets passés — impossible techniquement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MUSEUM-01 | User sees every triggered effect recorded in a chronological museum | `lib/museum/engine.ts` appends to `gami-{id}.md ## Musée` section after each `effectApplied` in `completeTask()` |
| MUSEUM-02 | User can open a "Musée" screen showing dated milestones | Modal pageSheet depuis tree.tsx actionBar, pattern FarmCodexModal avec SectionList groupé par semaine |
| MUSEUM-03 | User sees effect events persist across sessions (stored in gami-{id}.md) | Append-only dans gami-{id}.md existant — survit aux restarts, synchronisé iCloud comme le reste |
| MUSEUM-04 | User sees museum entries grouped by week/month | SectionList.sections calculées par `groupEntriesByWeek()` — lundi→dimanche, header DD/MM/AAAA |
| MUSEUM-05 | User sees museum UI consistent with Codex (Phase 17) design patterns | Réutilise SafeAreaView/Modal pageSheet/FadeInDown/Spacing/Radius/FontSize de FarmCodexModal |
</phase_requirements>

---

## Summary

Phase 23 implémente un musée chronologique des effets sémantiques déclenchés. La feature repose sur trois composants distincts : (1) un moteur de persistance `lib/museum/engine.ts` qui append des entrées markdown dans `gami-{id}.md`, (2) un point d'injection dans `hooks/useGamification.ts` après chaque effet appliqué, et (3) un écran modal `components/mascot/MuseumModal.tsx` qui affiche les entrées groupées par semaine.

Toute l'infrastructure de base existe déjà : le fichier `gami-{id}.md` per-profil est lu/écrit par `VaultManager`, le pattern parser/serializer est établi dans `lib/parser.ts`, les données des 10 catégories (icônes, labels, variants) sont dans `lib/semantic/effect-toasts.ts` et `lib/semantic/categories.ts`, et le pattern UI complet (modal pageSheet + FadeInDown + SectionList) est présent dans `FarmCodexModal.tsx`.

Le point de vigilance principal est de ne pas casser le flux d'écriture existant de `gami-{id}.md` : l'append museum doit utiliser le pattern fire-and-forget (non-bloquant) pour ne pas retarder le retour de `completeTask()`. La phase n'introduit aucune nouvelle dépendance npm (conforme ARCH-04).

**Primary recommendation:** Créer `lib/museum/engine.ts` (pure functions, zéro import hook/vault), l'injecter dans `useGamification.ts` comme fire-and-forget, et créer `MuseumModal.tsx` en copiant fidèlement la structure de `FarmCodexModal.tsx` mais avec `SectionList` au lieu de `FlatList`.

---

## Standard Stack

### Core
| Bibliothèque | Version | Usage | Raison |
|-------------|---------|-------|--------|
| React Native `SectionList` | natif RN 0.81.5 | Groupement par semaine | Composant natif — déjà utilisé ailleurs dans le projet, zéro dépendance |
| `react-native-reanimated` | ~4.1 | Animation `FadeInDown` sur chaque row | Obligatoire per CLAUDE.md — déjà en place dans FarmCodexModal |
| `date-fns` | déjà installé | Calcul semaine, formatage DD/MM/AAAA | Déjà utilisé partout (format, startOfWeek, parseISO) |
| `expo-file-system/legacy` | SDK 54 | Lecture/écriture `gami-{id}.md` via VaultManager | Infrastructure existante |

### Supporting
| Bibliothèque | Version | Usage | Quand utiliser |
|-------------|---------|-------|----------------|
| `lib/date-locale.ts` | interne | `getDateLocale()` → locale FR/EN pour date-fns | Pour tous les `format()` avec locale |
| `lib/semantic/effect-toasts.ts` | interne | `EFFECT_TOASTS`, `CATEGORY_VARIANT`, `VARIANT_CONFIG` | Source des icônes, labels, couleurs variant |
| `lib/semantic/caps.ts` | interne | `getWeekStart()` | Calcul du lundi de la semaine courante |
| `components/mascot/HarvestBurst.tsx` | interne | `VARIANT_CONFIG` pour couleurs badge | Couleurs particleColor ambient/rare/golden |

### Zéro nouvelle dépendance npm
Conforme ARCH-04 : toutes les bibliothèques nécessaires sont déjà installées.

---

## Architecture Patterns

### Structure des nouveaux fichiers
```
lib/
└── museum/
    └── engine.ts           # parseMuseumEntries, appendMuseumEntry, groupEntriesByWeek (pure functions)

components/
└── mascot/
    └── MuseumModal.tsx     # Modal pageSheet, SectionList groupée par semaine

locales/
├── fr/common.json          # Nouvelles clés museum.*
└── en/common.json          # Parité FR+EN
```

### Pattern 1: Module pur `lib/museum/engine.ts`

**What:** Fonctions pures sans import vault/hook, consommable partout sans effets de bord.
**When to use:** Même pattern que `lib/semantic/effect-toasts.ts` (Phase 21) et `lib/semantic/coupling-overrides.ts`.

```typescript
// Source: pattern établi par lib/semantic/effect-toasts.ts (Phase 21)

export type MuseumEntry = {
  date: Date;
  categoryId: CategoryId;
  icon: string;
  label: string;
};

/** Parse la section ## Musée d'un gami-{id}.md */
export function parseMuseumEntries(content: string): MuseumEntry[] {
  const lines = content.split('\n');
  const entries: MuseumEntry[] = [];
  let inMuseum = false;

  for (const line of lines) {
    if (line.startsWith('## Musée')) {
      inMuseum = true;
      continue;
    }
    if (inMuseum && line.startsWith('## ')) {
      // Section suivante — sortir du musée
      break;
    }
    if (inMuseum && line.startsWith('- ')) {
      // Format: - YYYY-MM-DDTHH:mm:ss | categoryId | icon label
      const parts = line.slice(2).split(' | ');
      if (parts.length >= 3) {
        try {
          const date = new Date(parts[0].trim());
          const categoryId = parts[1].trim() as CategoryId;
          // parts[2] = "🌟 Soins bébé : récolte dorée ×3"
          const iconAndLabel = parts[2].trim();
          const spaceIdx = iconAndLabel.indexOf(' ');
          const icon = spaceIdx > 0 ? iconAndLabel.slice(0, spaceIdx) : iconAndLabel;
          const label = spaceIdx > 0 ? iconAndLabel.slice(spaceIdx + 1) : '';
          if (!isNaN(date.getTime())) {
            entries.push({ date, categoryId, icon, label });
          }
        } catch { /* malformed line — skip */ }
      }
    }
  }
  return entries;
}

/** Ajoute une entrée en bas de la section ## Musée (crée la section si absente) */
export function appendMuseumEntry(content: string, entry: MuseumEntry): string {
  const timestamp = entry.date.toISOString().replace('Z', '').slice(0, 19);
  const line = `- ${timestamp} | ${entry.categoryId} | ${entry.icon} ${entry.label}`;

  if (content.includes('\n## Musée')) {
    // Section existe — append en fin de fichier (section toujours en dernier)
    return content.trimEnd() + '\n' + line + '\n';
  } else {
    // Créer la section
    return content.trimEnd() + '\n\n## Musée\n' + line + '\n';
  }
}

/** Groupe les entrées par semaine (lundi→dimanche) pour SectionList */
export function groupEntriesByWeek(
  entries: MuseumEntry[]
): Array<{ weekKey: string; weekLabel: string; data: MuseumEntry[] }> {
  // Tri descendant (plus récent en haut)
  const sorted = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime());
  const weeks = new Map<string, MuseumEntry[]>();

  for (const entry of sorted) {
    const weekKey = getWeekStart(entry.date); // YYYY-MM-DD du lundi
    if (!weeks.has(weekKey)) weeks.set(weekKey, []);
    weeks.get(weekKey)!.push(entry);
  }

  return Array.from(weeks.entries()).map(([weekKey, data]) => ({
    weekKey,
    weekLabel: formatWeekLabel(weekKey),
    data,
  }));
}
```

### Pattern 2: Point d'injection dans `useGamification.ts`

**What:** Fire-and-forget après le bloc feedback Phase 21 (lignes ~285-293), conditionnel sur `effectResult?.effectApplied`.
**When to use:** Même pattern que les stats semaine `incrementWeekStat` (Phase 22) — non-critical, silencieux.

```typescript
// Source: pattern établi Phase 22 — lib/semantic/coupling-overrides.ts incrementWeekStat

// Dans completeTask(), APRÈS le bloc feedback Phase 21 (ligne ~293)
// Phase 23 : Musée des effets (MUSEUM-01, MUSEUM-03)
if (effectResult?.effectApplied && derivedCategory) {
  try {
    const catId = derivedCategory.id;
    const toastDef = EFFECT_TOASTS[catId];
    if (toastDef) {
      const lang = i18n.language?.startsWith('en') ? 'en' : 'fr';
      const label = lang === 'en' ? toastDef.en : toastDef.fr;
      const entry: MuseumEntry = {
        date: new Date(),
        categoryId: catId,
        icon: toastDef.icon,
        label,
      };
      // fire-and-forget — non-critical, n'attend pas
      appendMuseumEntryToVault(vault, profile.id, entry).catch(() => {});
    }
  } catch { /* Musée — non-critical */ }
}
```

### Pattern 3: `MuseumModal.tsx` — structure calquée sur `FarmCodexModal.tsx`

**What:** Modal pageSheet avec SafeAreaView, header maison (pas ModalHeader), SectionList au lieu de FlatList 2-col, FadeInDown par row.
**When to use:** Suivre fidèlement FarmCodexModal pour MUSEUM-05.

```typescript
// Source: components/mascot/FarmCodexModal.tsx (Phase 17)

import { Modal, SectionList, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// SectionList sections type
type MuseumSection = {
  weekKey: string;
  weekLabel: string;
  data: MuseumEntry[];
};

// Row: FadeInDown.delay(index * 50) — pattern Codex
const renderItem = ({ item, index }: { item: MuseumEntry; index: number }) => (
  <Animated.View entering={FadeInDown.delay(index * 50)}>
    {/* icône | label | badge variant | date relative */}
  </Animated.View>
);

// Section header: "Semaine du DD/MM/AAAA"
const renderSectionHeader = ({ section }: { section: MuseumSection }) => (
  <Text>{section.weekLabel}</Text>
);
```

### Pattern 4: Badge variant inline (sans Badge.tsx)

**What:** View+Text avec `variantColor + '33'` pour 20% opacity — exactement comme SettingsCoupling.tsx.
**When to use:** Couleurs semantic (ambient/rare/golden) — ne pas passer par Badge.tsx générique.

```typescript
// Source: components/settings/SettingsCoupling.tsx (Phase 22)
import { CATEGORY_VARIANT } from '../../lib/semantic/effect-toasts';
import { VARIANT_CONFIG } from '../mascot/HarvestBurst';

const variant = CATEGORY_VARIANT[entry.categoryId];       // 'ambient' | 'rare' | 'golden'
const variantColor = VARIANT_CONFIG[variant].particleColor; // '#34D399' | '#A78BFA' | '#FFD700'

<View style={{ backgroundColor: variantColor + '33', borderRadius: Radius.sm, paddingHorizontal: Spacing.md }}>
  <Text style={{ color: variantColor, fontSize: FontSize.caption, fontWeight: FontWeight.semibold }}>
    {variantLabel}   {/* "Épique" | "Rare" | "Ambiant" */}
  </Text>
</View>
```

### Pattern 5: Écriture `gami-{id}.md` via VaultManager

**What:** Lire le contenu existant, appender la ligne musée, réécrire. Utiliser `enqueueWrite` implicitement via `vault.writeFile()`.
**When to use:** Pattern identique à tous les writes gami existants.

```typescript
// Source: pattern lib/vault.ts gamiFile() + writeFile()
// Dans lib/museum/engine.ts (fonction wrapper publique)

export async function appendMuseumEntryToVault(
  vault: VaultManager,
  profileId: string,
  entry: MuseumEntry,
): Promise<void> {
  const path = `gami-${profileId}.md`;
  const content = await vault.readFile(path).catch(() => '');
  const updated = appendMuseumEntry(content, entry);
  await vault.writeFile(path, updated);
}
```

### Anti-Patterns à éviter

- **Bloquer `completeTask()` pour le musée** : l'append museum est non-critical — fire-and-forget obligatoire.
- **Importer vault/hook dans engine.ts** : engine.ts doit rester un module pur (même contrainte que effect-toasts.ts).
- **Tronquer ou limiter les entrées** : le musée est la mémoire long-terme — D-01e interdit tout plafonnement.
- **SectionList avec FlatList imbriqué** : conflit de scroll nested sur iOS — utiliser `renderSectionHeader` + `renderItem` standard.
- **Format date ISO complet dans le label** : le timestamp ISO doit être stocké tel quel, l'affichage relatif ("il y a 2h") se calcule à la lecture.
- **Utiliser `ModalHeader` component** : FarmCodexModal utilise un header maison (View + Text + TouchableOpacity) — rester cohérent.

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser à la place | Pourquoi |
|----------|------------------|---------------------|----------|
| Calcul du lundi d'une semaine | Logique `getDay()` custom | `getWeekStart()` de `lib/semantic/caps.ts` | Déjà testé, timezone-agnostic (Pattern Phase 20-04) |
| Formatage date FR/EN | Switch i18n custom | `format(date, 'dd/MM/yyyy', { locale: getDateLocale() })` | Pattern établi dans `lib/date-locale.ts` |
| Couleurs variant | Constantes hardcodées | `VARIANT_CONFIG[variant].particleColor` depuis `HarvestBurst` | Source unique de vérité — déjà réutilisé par SettingsCoupling |
| Labels effets | Duplication des strings | `EFFECT_TOASTS[catId].fr` / `.en` | Source unique — zéro duplication |
| Lecture/écriture fichier | FileSystem direct | `vault.readFile()` / `vault.writeFile()` via VaultManager | Sécurité path traversal + iCloud coordination déjà gérés |

---

## Common Pitfalls

### Pitfall 1: Race condition sur gami-{id}.md
**What goes wrong:** `appendMuseumEntryToVault` lit puis écrit gami-{id}.md. Si `completeTask()` écrit aussi gami-{id}.md en parallèle, les writes entrent en conflit.
**Why it happens:** `completeTask()` écrit `gami-{id}.md` (via serializeGamification) AVANT le bloc d'injection musée (ligne ~296). Si le musée écrit APRÈS dans un fire-and-forget, il peut lire un état intermédiaire.
**How to avoid:** L'append musée doit lire le fichier APRÈS que `completeTask()` a fini son write principal. Le fire-and-forget positionné après `vault.writeFile(fp, serializeFarmProfile(...))` (ligne ~296) garantit que le fichier farm est déjà écrit — mais gami-{id}.md est écrit par `serializeGamification` plus tôt dans le flow. Vérifier que l'append musée lit bien le fichier APRÈS le write gami principal.
**Warning signs:** Entrées musée manquantes ou sections corrompues dans gami-{id}.md.

### Pitfall 2: parseGamification ne connaît pas la section ## Musée
**What goes wrong:** `parseGamification()` dans `lib/parser.ts` parcourt les sections `## {name}`. La section `## Musée` sera traitée comme un profil nommé "Musée" (flush()) si elle n'est pas dans `RESERVED_SECTIONS`.
**Why it happens:** Le parser actuel utilise `RESERVED_SECTIONS = ['Journal des gains', 'Récompenses actives', 'Récompenses utilisées']` pour éviter de créer des profils fictifs.
**How to avoid:** Ajouter `'Musée'` à `RESERVED_SECTIONS` dans `parseGamification()`. C'est une modification mineure de `lib/parser.ts`.
**Warning signs:** Un profil fictif "musée" apparaît dans la liste des profils gamification.

### Pitfall 3: SectionList et ScrollView imbriqués
**What goes wrong:** `SectionList` imbriqué dans un `ScrollView` cause des conflits de scroll sur iOS — le contenu ne défile pas correctement.
**Why it happens:** React Native interdit les listes virtualisées dans un ScrollView parent (warning VirtualizedLists-inside-ScrollViews).
**How to avoid:** `MuseumModal.tsx` NE doit PAS avoir de ScrollView englobant. Le `SectionList` est directement fils de `SafeAreaView`, comme `FlatList` dans `FarmCodexModal.tsx`. Header et empty state passent via `ListHeaderComponent` / `ListEmptyComponent`.
**Warning signs:** Warning console "VirtualizedLists should never be nested inside plain ScrollViews".

### Pitfall 4: Format timestamp — ISO vs local
**What goes wrong:** Stocker `new Date().toISOString()` donne `2026-04-10T08:30:00.000Z` (UTC). Parser avec `new Date(str)` peut donner des heures décalées selon le fuseau.
**Why it happens:** iCloud synchronise entre devices qui peuvent être dans des fuseaux différents.
**How to avoid:** Stocker le timestamp ISO complet avec décalage : `new Date().toISOString().slice(0, 19)` supprime le Z pour avoir `2026-04-10T08:30:00` — heure locale au moment de l'enregistrement. À la lecture, `new Date(str)` interprétera comme heure locale.
**Warning signs:** Entrées musée classées dans la mauvaise semaine après sync iCloud.

### Pitfall 5: Ordre des entrées dans la section ## Musée
**What goes wrong:** `appendMuseumEntry()` append en fin de fichier. Si le fichier se termine par une autre section (ex: `## Récompenses utilisées`), la ligne musée sera hors de la section `## Musée`.
**Why it happens:** `serializeGamification()` écrit les sections dans un ordre fixe. Si `## Musée` n'est pas la DERNIÈRE section, appender en fin de fichier est incorrect.
**How to avoid:** La décision D-01a stipule que `## Musée` est "en bas de gami-{id}.md après les sections existantes". L'implémentation doit s'assurer que `appendMuseumEntry()` insère DANS la section `## Musée` existante (pas en fin de fichier absolu si d'autres sections suivent). Parser qui trouve `## Musée` et append juste avant la prochaine section `## `.
**Warning signs:** Lignes musée orphelines en fin de fichier, hors de la section.

### Pitfall 6: `FadeInDown` avec index global vs index de section
**What goes wrong:** `SectionList` passe `index` qui est l'index dans la section courante (pas global). Avec `delay: index * 50`, toutes les premières entrées de chaque section animent en même temps.
**Why it happens:** `SectionList.renderItem` reçoit `{ item, index, section }` où `index` redémarre à 0 pour chaque section.
**How to avoid:** Maintenir un compteur global via `useMemo` calculé sur les sections flattenées, ou accepter le comportement section-local (acceptable visuellement — comme FarmCodexModal).
**Warning signs:** Toutes les lignes de section "semaine 1" et "semaine 2" animent simultanément.

---

## Code Examples

### Calcul du header semaine (format FR)
```typescript
// Source: lib/semantic/caps.ts getWeekStart() + date-fns format()
import { format } from 'date-fns';
import { getDateLocale } from '../date-locale';
import { getWeekStart } from '../semantic/caps';

function formatWeekLabel(weekKeyYYYYMMDD: string): string {
  const monday = new Date(weekKeyYYYYMMDD);
  const now = new Date();
  const currentWeekKey = getWeekStart(now);
  
  if (weekKeyYYYYMMDD === currentWeekKey) {
    return 'Cette semaine'; // i18n: museum.thisWeek
  }
  return `Semaine du ${format(monday, 'dd/MM/yyyy', { locale: getDateLocale() })}`;
}
```

### Date/heure relative pour les rows
```typescript
// Source: pattern project — date-fns formatDistanceToNow
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { getDateLocale } from '../date-locale';

function formatRelativeTime(date: Date): string {
  const locale = getDateLocale();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  
  if (diffH < 24) {
    return formatDistanceToNow(date, { locale, addSuffix: true }); // "il y a 2 heures"
  } else if (isYesterday(date)) {
    return `Hier ${format(date, 'HH:mm')}`;
  } else {
    return format(date, 'EEE HH:mm', { locale }); // "Lun 08:15"
  }
}
```

### Bouton musée dans l'actionBar de tree.tsx
```typescript
// Source: pattern tree.tsx ligne 2034 (BadgesSheet bouton)
// Après le bouton Badges existant
<TouchableOpacity style={styles.actionItem} onPress={() => setShowMuseum(true)} activeOpacity={0.7}>
  <Text style={styles.actionItemIcon}>{'🏛️'}</Text>
  <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>
    {t('museum:modal.title', 'Musée')}
  </Text>
</TouchableOpacity>
```

### Clés i18n nécessaires (minimum)
```json
// locales/fr/common.json — nouvelles clés museum.*
{
  "museum": {
    "modal": { "title": "Musée des effets" },
    "thisWeek": "Cette semaine",
    "weekHeader": "Semaine du {{date}}",
    "empty": {
      "icon": "🏛️",
      "text": "Aucun effet enregistré — complète des tâches pour remplir le musée !"
    },
    "variant": {
      "ambient": "Ambiant",
      "rare": "Rare",
      "golden": "Épique"
    }
  }
}
```

---

## State of the Art

| Ancien approche | Approche actuelle | Depuis | Impact |
|----------------|-------------------|--------|--------|
| `GamificationEntry` (plafonné 100, rotatif) | Section `## Musée` append-only dans gami-{id}.md | Phase 23 | Mémoire long-terme, jamais tronquée |
| Hub cross-feature SEED-002 full (milestones-{id}.md) | Lite : section dans gami-{id}.md existant | Phase 23 décision | Évite nouveau fichier vault, cohérence avec infrastructure existante |

---

## Open Questions

1. **Ordre des sections dans `serializeGamification()`**
   - Ce qu'on sait: `serializeGamification()` dans `lib/parser.ts` sérialise les profils, Journal des gains, Récompenses actives, Récompenses utilisées — dans cet ordre fixe.
   - Ce qui est flou: si on append `## Musée` à la fin du fichier existant, et que `serializeGamification()` réécrit le fichier plus tard (lors d'une prochaine complétion de tâche), la section `## Musée` sera-t-elle préservée ou écrasée ?
   - Recommandation: Vérifier que `serializeGamification()` préserve les sections non connues (actuellement il reconstruit le fichier entier). Si non, modifier `serializeGamification()` pour lire le contenu existant et réappender la section `## Musée` après sérialisation. Alternative: adapter le write pour être un read-modify-write qui préserve `## Musée`.

2. **Nombre de clés i18n — namespace séparé ou common.json**
   - Ce qu'on sait: Les clés Codex utilisent le namespace `codex:` (voir `t('codex:modal.title')`). Les clés `museum.*` iront dans `common.json` ou un namespace dédié.
   - Recommandation: Utiliser `common.json` sous la clé `museum` pour éviter de créer un nouveau fichier de namespace (coût de configuration i18n). 6-8 clés ne justifient pas un fichier séparé.

---

## Environment Availability

Step 2.6 SKIPPED — phase purement code/config, aucune dépendance externe nouvelle. Toutes les dépendances (date-fns, reanimated, expo-secure-store, expo-file-system) sont déjà installées et actives.

---

## Sources

### Primary (HIGH confidence)
- `components/mascot/FarmCodexModal.tsx` — Pattern exact modal pageSheet + FlatList + FadeInDown + SafeAreaView + Spacing/Radius/FontSize
- `lib/semantic/effect-toasts.ts` — EFFECT_TOASTS, CATEGORY_VARIANT, HarvestBurstVariant — source données 10 catégories
- `lib/semantic/categories.ts` — CategoryId type, CATEGORIES array avec labelFr/labelEn
- `lib/semantic/coupling-overrides.ts` — Pattern cache module-level + fire-and-forget SecureStore (réutilisable pour engine.ts)
- `lib/parser.ts` (parseGamification) — Structure actuelle du parser gami-{id}.md, RESERVED_SECTIONS, logique sections `## `
- `hooks/useGamification.ts` lignes ~270-296 — Point d'injection exact après feedback Phase 21
- `lib/vault.ts` — VaultManager.readFile/writeFile, gamiFile() helper, enqueueWrite
- `components/mascot/HarvestBurst.tsx` — VARIANT_CONFIG avec particleColor par variant
- `components/settings/SettingsCoupling.tsx` — Pattern badge variant inline (variantColor + '33')
- `app/(tabs)/tree.tsx` — ActionBar existante, pattern showBadges/showCodex, import structure

### Secondary (MEDIUM confidence)
- `lib/semantic/caps.ts` `getWeekStart()` — calcul lundi de semaine, timezone-agnostic, testé (Phase 20-04)
- `lib/date-locale.ts` `getDateLocale()` — locale FR/EN pour date-fns
- `.planning/seeds/SEED-002-musee-premieres-fois.md` — Vision originale, contraintes d'impossibilité rétroactivité, format fichier alternatif considéré

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tout déjà installé et utilisé dans le projet
- Architecture patterns: HIGH — basé sur lecture directe du code existant (FarmCodexModal, SettingsCoupling, useGamification)
- Pitfalls: HIGH (Pitfall 2 parseGamification RESERVED_SECTIONS) / MEDIUM (Pitfall 4 timestamp timezone) — basés sur analyse du code réel

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stack stable, pas de migration majeure prévue)

## Project Constraints (from CLAUDE.md)

Directives actives applicables à cette phase:
- **Animations**: `react-native-reanimated` obligatoire — `FadeInDown` pour les rows. Pattern: `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming`. Spring configs comme constante module.
- **Couleurs**: TOUJOURS `useThemeColors()` / `colors.*` — jamais de hardcoded. Exception: couleurs cosmétiques variant (`#FFD700`, `#A78BFA`, `#34D399`) définies comme constantes StyleSheet.
- **Format date affiché**: DD/MM/AAAA (per projet).
- **Modals**: présentation `pageSheet` + drag-to-dismiss.
- **Tokens design**: `Spacing['2xl']` etc. — jamais de valeurs numériques hardcodées.
- **React.memo()** sur les list items, `useCallback()` sur handlers passés en props.
- **Erreurs non-critiques silencieuses**: `catch { /* Musée — non-critical */ }`.
- **console.warn/error**: uniquement sous `if (__DEV__)`.
- **Zéro nouvelle dépendance npm** (ARCH-04).
- **Langue UI/commits/commentaires**: français.
- **Type check**: `npx tsc --noEmit` avant chaque commit.
- **Tests**: `npx jest --no-coverage` (si modifié lib/__tests__/).
- **`ReanimatedSwipeable`** (pas `Swipeable`) si besoin de swipe — mais cette phase n'en a pas.
- **Barrel files**: si `lib/museum/` est créé avec plusieurs exports, créer `lib/museum/index.ts`.
