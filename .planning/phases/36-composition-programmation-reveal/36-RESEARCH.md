# Phase 36 : Composition & programmation reveal — Research

**Researched:** 2026-04-17
**Domain:** UI React Native (modal éditeur pageSheet) + Notifications locales (expo-notifications) + Animation 3D unfold (Reanimated rotateX) + lifecycle AppState — boucle complète d'écriture/programmation/révélation d'une love note.
**Confidence:** HIGH (toute la stack est déjà installée et utilisée ailleurs dans le repo, le hook `useVaultLoveNotes` est shipped, les patterns sont visibles dans le codebase — aucune dépendance externe à découvrir).

## Summary

Phase 36 est la dernière brique fonctionnelle des Love Notes : on bascule du mode "lecture seule" (Phases 34/35) au mode complet "écriture + programmation + révélation animée". Aucune nouvelle dépendance npm — `expo-notifications`, `expo-haptics`, `react-native-reanimated`, `@react-native-community/datetimepicker`, et le hook `useVaultLoveNotes.addLoveNote` / `updateLoveNoteStatus` sont tous déjà en place.

Quatre surfaces à livrer :

1. **`LoveNoteEditor.tsx`** — modal `presentationStyle="pageSheet"` (drag-to-dismiss natif iOS hérité de la prop) avec : Chip recipient (filtre `to !== from`), TextInput markdown + preview via `MarkdownText`, presets reveal + custom date+time picker via `DateInput` (mais en mode séparé date/time car `DateInput` n'a pas de mode datetime combiné).
2. **Programmation notif** : extension de `lib/scheduled-notifications.ts` avec `scheduleLoveNoteReveal(note)` + cancel idempotent par identifier `lovenote-reveal-{sourceFile}`. Trigger `DATE` à `revealAt` parsé en heure locale.
3. **Bascule auto pending → revealed** : sélecteur `revealPendingNotes(loveNotes, now)` qui appelle `updateLoveNoteStatus(sourceFile, 'revealed')` pour chaque pending due, branché à un `AppState.addEventListener('change')` au niveau de l'écran `lovenotes.tsx` ET de la carte dashboard (idempotent — la même fonction peut être appelée 2× sans bug).
4. **Animation unfold** au tap sur enveloppe `revealed` : `rotateX` du rabat 0° → 175° (`withTiming` 800ms easing out) + cachet qui saute (`withSequence(withTiming scale 1.4 200ms, withSpring 1)`) + reveal du body (opacity 0→1) + `Haptics.notificationAsync(Success)` au peak. À la fin → `updateLoveNoteStatus(sourceFile, 'read')` injecte `readAt`.

**Pitfall central — `perspective` :** CLAUDE.md interdit `perspective` dans les transform arrays (clipping 3D), mais `rotateX 175°` SANS `perspective` rend juste un flat scaleY animé (pas de profondeur 3D). **Décision recommandée :** accepter le compromis "pas de profondeur 3D photoréaliste" — utiliser `rotateX` seul (RN le rend comme un scaleY visuel) avec `transformOrigin: 'top'`, OU dévier ponctuellement de la règle CLAUDE.md (avec justification dans CONTEXT) en utilisant `perspective: 1000` LOCALEMENT sur le rabat — la règle CLAUDE.md est née d'un cas spécifique (clipping habitants ferme), pas une interdiction théologique. **À trancher au planning.**

**Primary recommendation :** Créer 3 fichiers nouveaux (`components/lovenotes/LoveNoteEditor.tsx`, `components/lovenotes/EnvelopeUnfoldModal.tsx`, `lib/lovenotes/reveal-engine.ts`) + extension `lib/scheduled-notifications.ts` + branchement `AppState` dans `app/(tabs)/lovenotes.tsx` + listener notification response dans `app/_layout.tsx`. FAB "✏️ Écrire" dans `lovenotes.tsx` ouvre l'éditeur. Tap `LoveNoteCard` `revealed` ouvre `EnvelopeUnfoldModal` qui anime puis push `read`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOVE-09 | Composer une nouvelle love note via éditeur modal (`pageSheet` + drag-to-dismiss) : sélection destinataire (chips profil, exclut auteur), zone texte markdown + preview, picker date/heure de révélation | Pattern `Modal presentationStyle="pageSheet" animationType="slide"` (utilisé NoteEditor:195, ExpeditionsSheet:205). Drag-to-dismiss natif iOS automatique avec `pageSheet` (iOS 13+). `Chip` existe (`components/ui/Chip.tsx`) avec props `selected`, `emoji`, `color`, `onPress`. `MarkdownText` (`components/ui/MarkdownText.tsx`) accepte `children: string` pour preview. `DateInput` (`components/ui/DateInput.tsx`) supporte `mode: 'date' \| 'time'` séparément — il faudra 2 `DateInput` côte-à-côte. Profils filtrés via `useVault().profiles.filter(p => p.id !== activeProfile.id)`. Hook : `addLoveNote({from, to, createdAt, revealAt, status:'pending', body})` (signature exacte dans hooks/useVaultLoveNotes.ts:76). |
| LOVE-10 | Presets reveal rapides : "Demain matin", "Dimanche soir", "Dans 1 mois", custom — pré-remplissent le picker sans bloquer le custom | Presets sont des `Chip` qui appellent `setRevealDate(addDays(...))` + `setRevealTime('08:00')` etc. Implémentation pure JS (pas de date-fns nécessaire, mais déjà installé via `MemoryEditor.tsx:21`). Le picker custom reste interactif après preset → user peut surtaper la valeur. Fonctions presets : `tomorrowMorning() → today+1 @ 08:00`, `nextSundayEvening() → next Sunday @ 19:00`, `inOneMonth() → today+30 @ 09:00`. Stockage : `revealAt = ${date}T${time}:00` (ISO local sans Z, cohérent `lib/types.ts:589`). |
| LOVE-11 | Notification locale silencieuse au `revealAt` via `expo-notifications`, tap notif → ouvre `/lovenotes` | `expo-notifications ^0.32.16` (package.json). Pattern existe dans `lib/scheduled-notifications.ts` — utilise `Notifications.scheduleNotificationAsync({ identifier, content, trigger: { type: SchedulableTriggerInputTypes.DATE, date } })`. Permissions déjà demandées via `requestNotificationPermissions()`. Handler global déjà configuré dans `app/_layout.tsx:130` (`configureNotifications()`). **Manquant :** listener `Notifications.addNotificationResponseReceivedListener((response) => router.push('/(tabs)/lovenotes'))` à brancher dans `app/_layout.tsx`. Identifier convention : `lovenote-reveal-${sanitizedSourceFile}` (sanitize : remplacer `/` par `-`). Cancel idempotent dans `addLoveNote` workflow + au boot `loadLoveNotes` pour cancel les notifs orphelines. **"Silencieuse" :** `sound: false` dans content (ou tout simplement pas de sound — par défaut sur iOS elle est silent si non spécifié). Spécification stricte : `content: { title: '💌 Nouvelle love note', body: 'Une note vient d\'arriver dans ta boîte', sound: false, data: { route: '/(tabs)/lovenotes' } }`. |
| LOVE-12 | Bascule auto pending → revealed à chaque retour app foreground (`AppState` change 'active' → `revealPendingNotes()`) | `AppState.addEventListener('change', cb)` est utilisé dans `hooks/useVault.ts:714`, `app/(tabs)/tree.tsx:567`, `app/(tabs)/village.tsx:403`, `contexts/AuthContext.tsx:232` — pattern déjà rodé. À brancher dans `app/(tabs)/lovenotes.tsx` (et idéalement aussi côté carte enveloppe dashboard via un useEffect dans `index.tsx`). Implémentation : `for (const n of loveNotes) if (n.status === 'pending' && isRevealed(n, now)) await updateLoveNoteStatus(n.sourceFile, 'revealed')`. Idempotent — `updateLoveNoteStatus` re-lit le fichier et patch (hooks/useVaultLoveNotes.ts:87). Cleanup : `subscription.remove()` au unmount. **Important :** la bascule doit aussi se faire au montage de l'écran (un user qui ouvre l'app sur `/lovenotes` directement sans state change). |
| LOVE-13 | Animation unfold Reanimated (rotateX rabat ≥175°, cachet saute, contenu dévoilé) au tap enveloppe `revealed` + `Haptics.notificationAsync('success')` → bascule `read` avec `readAt` | `react-native-reanimated ~4.1.1` déjà utilisé partout. Pitfall CLAUDE.md ligne 25 : "Éviter `perspective` dans transform arrays (clipping 3D) — préférer `scaleX` pour les flips". `rotateX` SANS `perspective` rend un effet pseudo-2D acceptable (le rabat semble se "plier" vers le haut sans profondeur réelle). Pattern `withSequence` + `withSpring` validé dans `ExpeditionsSheet.tsx:24-26`. `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` — `expo-haptics ~15.0.8` (package.json). Bascule `read` : `await updateLoveNoteStatus(note.sourceFile, 'read')` (le hook auto-injecte `readAt = new Date().toISOString().slice(0,19)` si non fourni — hooks/useVaultLoveNotes.ts:102). |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

**Aucun `CONTEXT.md` présent** pour Phase 36 (pas passé par `/gsd:discuss-phase`). Les contraintes proviennent de :
1. CLAUDE.md (project-wide)
2. ROADMAP.md Phase 36 success criteria
3. STATE.md decisions cumulées
4. Init v1.6 (zéro nouvelle dépendance npm, pattern Phase 35 réutilisé)

### Locked Decisions (dérivées CLAUDE.md + ROADMAP + STATE)

- Stack : React Native 0.81 / Expo SDK 54 / expo-router v6 / reanimated ~4.1 — **immuable**
- `useThemeColors()` obligatoire pour TOUTES les couleurs structurelles — cosmétiques cire/papier acceptables inline (cf Phase 35 pattern WaxSeal/EnvelopeFlap)
- `expo-haptics` obligatoire (selectionAsync au tap chip, impactAsync(Light) au tap card, notificationAsync(Success) au unfold peak)
- Modal : `presentationStyle="pageSheet"` + `animationType="slide"` (drag-to-dismiss iOS natif inclus)
- `react-native-reanimated` SEUL (jamais RN Animated)
- Spring configs en constantes module : `const SPRING_UNFOLD = { damping: 14, stiffness: 120 }`
- Format date affiché JJ/MM/AAAA, stockage ISO local sans Z (`'2026-04-17T09:07:00'`)
- Commits/UI/labels en **français**
- Privacy : noms génériques (Lucas/Emma/Dupont) dans docs/commits — JAMAIS de noms réels
- Pas de nouvelle dépendance npm (`expo-notifications`, `expo-haptics`, `reanimated` déjà installés)
- Backward compat Obsidian vault : aucune modif type `LoveNote`, parser/serializer inchangés (juste consommés)
- `React.memo` sur list items, `useCallback` sur handlers passés en props, `useMemo` dans providers
- `console.warn`/`console.error` uniquement sous `if (__DEV__)`
- Erreurs user-facing : `Alert.alert()` en français
- `npx tsc --noEmit` clean obligatoire avant chaque commit
- Hiérarchie providers `app/_layout.tsx` : SafeAreaProvider > GestureHandler > VaultProvider > Auth > Theme > AI > Story > Help > Parental > Toast — ne pas modifier
- Cache : **PAS** de bump `CACHE_VERSION` Phase 36 (on ne touche pas à `LoveNote` shape ni à `VaultCacheState.loveNotes`)

### Claude's Discretion (à trancher au planning)

- **`perspective` 3D pour le rabat unfold** : (a) refuser strictement la règle CLAUDE.md → rotateX seul = effet 2D plat (le rabat "disparaît" en se pliant), acceptable mais moins photoréaliste ; (b) dévier exceptionnellement → `transform: [{ perspective: 1000 }, { rotateX: '175deg' }]` LOCAL au rabat avec justification (le clipping interdit concerne le clipping de habitants ferme par overflow:hidden, ici le rabat est dans un container `overflow:hidden` mais on assume le clip). **Recommandation : (a) sans perspective, accepter feel 2D** — moins risqué, conforme strict.
- **Picker date+time** : (a) 2 `DateInput` séparés (mode date + mode time) côte-à-côte ; (b) introduire un nouveau `DateTimeInput` combiné (mode='datetime' du natif). DateTimePicker supporte `mode='datetime'` mais il faudrait étendre `components/ui/DateInput.tsx`. **Recommandation : (a) 2 DateInput côte-à-côte** — zéro modif d'un composant partagé, scope minimal.
- **Sélection destinataire** : (a) Chips horizontales scrollables ; (b) Liste verticale avec avatar+nom. **Recommandation : (a) Chips** — plus compact, pattern existant Chip.tsx.
- **Animation unfold : composant inline dans LoveNoteCard ou modal full-screen ?** — (a) inline dans LoveNoteCard (l'enveloppe se déplie sur place) ; (b) modal full-screen `EnvelopeUnfoldModal` avec backdrop. **Recommandation : (b) modal** — plus immersif, isole les transforms 3D, pattern cohérent avec le mockup `.eo-` "État ouvert".
- **AppState branchement** : (a) hook custom `useRevealOnForeground(loveNotes, updateLoveNoteStatus)` ; (b) inline dans `lovenotes.tsx`. **Recommandation : (a) hook** — réutilisable, évite duplication entre dashboard et écran.
- **Permissions notifications** : déjà demandées globalement par `setupAllNotifications()` (lib/scheduled-notifications.ts:558). **Pas de prompt supplémentaire** au premier addLoveNote — juste tenter le schedule, fail silently si refusé.
- **Trigger notif sur preset "Dans 1 mois"** : iOS limite ~64 notifs locales en file. À 1 note/profil/mois × 4 profils on est à ~50/an — OK. Pas de problème scaling.

### Deferred Ideas (OUT OF SCOPE de Phase 36)

- Toggle parental + modérateur enfants → Phase 37
- Empty states illustrés (l'écran lovenotes.tsx a déjà un empty text Phase 35) → Phase 37
- SectionErrorBoundary autour des nouveaux composants → Phase 37 (polish)
- Bibliothèque de templates ("félicitations contrôle", "bravo premier pas") → LOVE-F05
- Capsule audio attachée → LOVE-F02
- Déclencheurs contextuels au lieu de dates (level_up, birthday) → LOVE-F01
- Notifications push distantes → LOVE-F04 (out of scope core value)
- Chaîne de gratitude (répondre à une note) → LOVE-F03
- Tests Jest sur reveal-engine / scheduleLoveNoteReveal → optionnel (nyquist_validation: false dans config.json)
</user_constraints>

## Project Constraints (from CLAUDE.md)

Directives **non-négociables** que le planner doit vérifier explicitement :

| Directive | Phase 36 Impact |
|-----------|-----------------|
| react-native-reanimated ~4.1 obligatoire (PAS RN Animated) | Animation unfold rabat + cachet jump → `useSharedValue` + `useAnimatedStyle` + `withTiming` + `withSpring` + `withSequence` |
| `useThemeColors()` / `colors.*` partout | Backgrounds modal, text colors, border editor → thème. Cosmétiques cire/papier inline acceptables (déjà en Phase 35) |
| `ReanimatedSwipeable` (pas `Swipeable`) si swipe | N/A Phase 36 — pas de swipe prévu (delete via tap action si besoin) |
| Paths `(tabs)` quoter dans bash | Commits toucheront `app/(tabs)/lovenotes.tsx` + `app/_layout.tsx` |
| Format date JJ/MM/AAAA côté UI | Affichage `revealAt` dans presets + recap éditeur ; stockage ISO local sans Z |
| Privacy docs/commits : Lucas/Emma/Dupont | Exemples PLANs/SUMMARYs |
| `React.memo()` sur list items, `useCallback` sur handlers, `useMemo` dans providers | `LoveNoteEditor` → modal pas list item donc pas memo critique mais ses sub-Chips déjà memo (Chip.tsx ligne 17). Handlers `onSave`, `onCancel` en `useCallback`. |
| `console.warn/error` uniquement sous `if (__DEV__)` | Logs debug schedule notif, AppState transitions |
| `SectionErrorBoundary` autour de chaque section dashboard | Carte enveloppe déjà entourée Phase 35 (index.tsx:1049). Phase 36 n'ajoute pas de nouvelle section dashboard. |
| Spring configs comme constante module | `const SPRING_UNFOLD = { damping: 14, stiffness: 120 }`, `const SPRING_SEAL_JUMP = { damping: 8, stiffness: 200 }` au top du fichier |
| **Éviter `perspective` dans transform arrays (clipping 3D) — préférer `scaleX` pour flips** | **Conflit majeur Phase 36** : l'animation unfold idéale demande `perspective + rotateX` pour donner profondeur 3D au rabat. Sans perspective, `rotateX 175°` rend le rabat comme un scaleY animé (le rabat semble s'aplatir et disparaître). Décision recommandée : accepter cet effet "feel 2D" ou justifier dérogation locale (cf Discretion). |
| `expo-haptics` pour feedback tactile | `Haptics.selectionAsync()` chip preset, `Haptics.impactAsync(Light)` tap card, `Haptics.notificationAsync(Success)` peak unfold |
| Tokens design pour valeurs numériques | Tous paddings/margins/radius/fontSize → `Spacing` / `Radius` / `FontSize` / `Shadows` (pas de `16`, `8`, etc.) |
| Erreurs user-facing : `Alert.alert()` en français | Validation : "Choisis un destinataire", "Le message ne peut pas être vide", "La date doit être dans le futur" |
| `npx tsc --noEmit` obligatoire avant commit | Gate CI du planner — toutes nouvelles signatures typées |
| `npx jest --no-coverage` clean | Si tests ajoutés (optionnel — `nyquist_validation: false`) |
| **Cache bump si shape change** | **PAS requis Phase 36** : `LoveNote` shape inchangé, `VaultCacheState.loveNotes` inchangé. Cache version reste 2 (Phase 34). |

## Standard Stack

### Core (déjà installés — zéro nouvelle dépendance)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.81.5 | UI framework | Stack imposé |
| expo | ~54 | Platform | Stack imposé |
| expo-router | v6 | Navigation file-based | `router.push('/(tabs)/lovenotes')` au tap notif |
| react-native-reanimated | ~4.1.1 | Animations UI thread | unfold rabat (`withTiming` + `withSequence`), cachet jump (`withSpring`) |
| react-native-gesture-handler | installé | Gestures | Drag-to-dismiss natif via `pageSheet` |
| expo-haptics | ~15.0.8 | Feedback tactile | `selectionAsync` chip, `impactAsync` card, `notificationAsync` unfold |
| expo-notifications | ^0.32.16 | Notifications locales | `scheduleNotificationAsync` + `addNotificationResponseReceivedListener` |
| @react-native-community/datetimepicker | ^8.4.4 | Date/time picker natif | `DateInput` (`components/ui/DateInput.tsx`) supporte `mode='date' \| 'time'` |
| react-native-svg | installé | SVG natif | Rabat triangulaire (`EnvelopeFlap.tsx` Phase 35 réutilisé pour unfold) |
| date-fns | installé (cf MemoryEditor:21) | Date helpers | Optionnel — `addDays`, `nextSunday`, `addMonths` pour presets ; on peut s'en passer en JS pur |

### Composants UI réutilisables (existants, à consommer)

| Composant | Path | Usage Phase 36 |
|-----------|------|----------------|
| `Chip` | `components/ui/Chip.tsx` | Sélection destinataire + presets reveal (props `selected`, `emoji`, `color`, `onPress`) |
| `MarkdownText` | `components/ui/MarkdownText.tsx` | Preview markdown du body dans l'éditeur (props `children: string`, `style`, `numberOfLines`) |
| `DateInput` | `components/ui/DateInput.tsx` | Picker date custom (mode='date') + picker time custom (mode='time') |
| `ModalHeader` | `components/ui/ModalHeader.tsx` | Header de l'éditeur (titre + close) |
| `Button` | `components/ui/Button.tsx` | CTA "Programmer" + "Annuler" |
| `PressableScale` | `components/ui/PressableScale.tsx` | Wrap de la carte LoveNoteCard "revealed" pour anim scale au tap |
| `EnvelopeFlap` | `components/lovenotes/EnvelopeFlap.tsx` (Phase 35) | Rabat SVG réutilisé dans le modal unfold (avec rotateX animé) |
| `WaxSeal` | `components/lovenotes/WaxSeal.tsx` (Phase 35) | Cachet réutilisé dans le modal unfold (jump sequence) |

### Hook API consommé (Phase 34 shipped + Phase 35 selectors)

```typescript
// Depuis useVault() :
loveNotes: LoveNote[];
addLoveNote: (note: Omit<LoveNote, 'sourceFile'>) => Promise<void>;             // Phase 36 : compose
updateLoveNoteStatus: (sourceFile, status: LoveNoteStatus, readAt?) => Promise<void>;  // Phase 36 : pending→revealed, revealed→read
deleteLoveNote: (sourceFile) => Promise<void>;                                  // Future
profiles: Profile[];                                                            // Pour Chip recipients (filter id !== from)
activeProfile: Profile | null;                                                  // Émetteur par défaut
```

```typescript
// Depuis lib/lovenotes/selectors.ts (Phase 35) :
isRevealed(note, now?: Date): boolean;       // Réutilisé pour reveal-engine LOVE-12
unreadForProfile(notes, profileId, now?);    // Déjà consommé par dashboard
receivedForProfile, sentByProfile, archivedForProfile;  // Déjà consommés écran
```

```typescript
// Depuis lib/scheduled-notifications.ts (à étendre Phase 36) :
configureNotifications(): void;                            // Déjà appelé app/_layout.tsx:130
requestNotificationPermissions(): Promise<boolean>;        // Réutilisable
// À AJOUTER :
scheduleLoveNoteReveal(note: LoveNote): Promise<void>;     // schedule + identifier déterministe
cancelLoveNoteReveal(sourceFile: string): Promise<void>;   // cancel idempotent
```

## Architecture Patterns

### Structure de fichiers recommandée

```
components/lovenotes/                   # Existant Phase 35
├── EnvelopeCard.tsx                    # Phase 35 (dashboard)
├── EnvelopeFlap.tsx                    # Phase 35 (réutilisé Phase 36 unfold)
├── EnvelopeUnfoldModal.tsx             # NOUVEAU Phase 36 — modal full-screen unfold animé
├── LoveNoteCard.tsx                    # Phase 35 (à câbler onPress vers EnvelopeUnfoldModal)
├── LoveNoteEditor.tsx                  # NOUVEAU Phase 36 — éditeur composition
├── WaxSeal.tsx                         # Phase 35 (réutilisé jump unfold)
└── index.ts                            # Barrel — ajouter LoveNoteEditor + EnvelopeUnfoldModal

lib/lovenotes/                          # Existant Phase 35
├── selectors.ts                        # Phase 35 — réutilisé isRevealed
├── reveal-engine.ts                    # NOUVEAU Phase 36 — revealPendingNotes pure function + presets
└── index.ts                            # Barrel à créer si pas existant

lib/scheduled-notifications.ts          # MODIFIÉ Phase 36 — +scheduleLoveNoteReveal, +cancelLoveNoteReveal

hooks/                                  
└── useRevealOnForeground.ts            # NOUVEAU Phase 36 — hook AppState bascule pending→revealed

app/(tabs)/lovenotes.tsx                # MODIFIÉ Phase 36 — FAB "Écrire" + LoveNoteEditor + AppState hook
app/_layout.tsx                         # MODIFIÉ Phase 36 — addNotificationResponseReceivedListener
```

### Pattern 1 : Modal éditeur pageSheet drag-to-dismiss

**What :** `Modal` natif avec `presentationStyle="pageSheet"` + `animationType="slide"` + `onRequestClose`.

**Why :** Pattern utilisé partout (NoteEditor:195, ExpeditionsSheet:205). iOS 13+ rend pageSheet avec drag-to-dismiss natif gratuit. Pas de lib externe.

**Example :**
```tsx
// components/lovenotes/LoveNoteEditor.tsx
import React, { useState, useCallback } from 'react';
import { Modal, View, ScrollView, KeyboardAvoidingView, Platform, TextInput, Alert } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader, Chip, MarkdownText, DateInput, Button } from '../ui';
import { Spacing, Radius } from '../../constants/spacing';
import type { Profile } from '../../lib/types';

interface LoveNoteEditorProps {
  visible: boolean;
  fromProfile: Profile;
  recipientProfiles: Profile[];   // déjà filtrés (excluding author)
  onSave: (to: string, body: string, revealAt: string) => Promise<void>;
  onClose: () => void;
}

export function LoveNoteEditor({ visible, fromProfile, recipientProfiles, onSave, onClose }: LoveNoteEditorProps) {
  const { colors, primary } = useThemeColors();
  const [to, setTo] = useState<string>('');
  const [body, setBody] = useState('');
  const [revealDate, setRevealDate] = useState('');
  const [revealTime, setRevealTime] = useState('08:00');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Validation + save…
  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title="Nouvelle love note" onClose={onClose} />
        <ScrollView contentContainerStyle={{ padding: Spacing['2xl'] }}>
          {/* Recipient chips */}
          {/* Body TextInput / MarkdownText preview */}
          {/* Presets chips + DateInput date + DateInput time */}
          {/* Button "Programmer" */}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

### Pattern 2 : Presets reveal en pure JS (zéro dépendance date-fns optionnelle)

```typescript
// lib/lovenotes/reveal-engine.ts
function pad(n: number): string { return String(n).padStart(2, '0'); }
function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function presetTomorrowMorning(now: Date = new Date()): { date: string; time: string } {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return { date: localIso(d).slice(0, 10), time: '08:00' };
}

export function presetNextSundayEvening(now: Date = new Date()): { date: string; time: string } {
  const d = new Date(now);
  const day = d.getDay();                    // 0=Sun..6=Sat
  const daysUntilSun = (7 - day) % 7 || 7;   // si on est dimanche, viser le prochain
  d.setDate(d.getDate() + daysUntilSun);
  d.setHours(19, 0, 0, 0);
  return { date: localIso(d).slice(0, 10), time: '19:00' };
}

export function presetInOneMonth(now: Date = new Date()): { date: string; time: string } {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 1);
  d.setHours(9, 0, 0, 0);
  return { date: localIso(d).slice(0, 10), time: '09:00' };
}
```

**Tests recommandés** (optionnel — config.json `nyquist_validation: false`) : 4 cas par preset (mardi midi, samedi soir, dimanche matin, 31 mars → 30 avril overflow). Pure functions, idéal pour Jest.

### Pattern 3 : `scheduleLoveNoteReveal` extension de scheduled-notifications.ts

**What :** Ajouter 2 fonctions dans `lib/scheduled-notifications.ts` (catégorie `CAT_LOVENOTE = 'lovenote-reveal'`).

```typescript
// lib/scheduled-notifications.ts (ajout)
import type { LoveNote } from './types';
const CAT_LOVENOTE = 'lovenote-reveal';

function loveNoteIdentifier(sourceFile: string): string {
  // Sanitize / pour identifier sûr (iOS accepte mais sanitize par sécurité)
  return `${CAT_LOVENOTE}-${sourceFile.replace(/\//g, '_')}`;
}

export async function scheduleLoveNoteReveal(note: LoveNote): Promise<boolean> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) return false;

  // Cancel précédente (idempotence)
  await cancelLoveNoteReveal(note.sourceFile);

  // Parse revealAt en heure locale (ISO sans Z)
  const [datePart, timePart] = note.revealAt.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = (timePart ?? '00:00:00').split(':').map(Number);
  const revealDate = new Date(y, m - 1, d, hh, mm, ss);

  if (revealDate.getTime() <= Date.now()) return false; // déjà passé

  await Notifications.scheduleNotificationAsync({
    identifier: loveNoteIdentifier(note.sourceFile),
    content: {
      title: '💌 Nouvelle love note',
      body: 'Une note vient d\'arriver dans ta boîte aux lettres',
      sound: false,                                      // silencieuse (LOVE-11)
      data: { route: '/(tabs)/lovenotes', sourceFile: note.sourceFile },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: revealDate },
  });
  return true;
}

export async function cancelLoveNoteReveal(sourceFile: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(loveNoteIdentifier(sourceFile));
}
```

### Pattern 4 : Listener notification response — branchement `app/_layout.tsx`

```typescript
// app/_layout.tsx — dans RootLayout useEffect existant (ligne 129)
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

useEffect(() => {
  configureNotifications();

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = response.notification.request.content.data?.route;
    if (typeof route === 'string') {
      router.push(route as any);
    }
  });
  return () => sub.remove();

  // (loadSavedLanguage… inchangé)
}, []);
```

**Pitfall :** `addNotificationResponseReceivedListener` callback doit être idempotent — si l'app est tuée et rouverte par notif, le système peut fire plusieurs callbacks. Un `router.push` répété est inoffensif (expo-router déduplique sur même route).

### Pattern 5 : Hook AppState bascule pending → revealed

```typescript
// hooks/useRevealOnForeground.ts
import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { LoveNote, LoveNoteStatus } from '../lib/types';
import { isRevealed } from '../lib/lovenotes/selectors';

export function useRevealOnForeground(
  loveNotes: LoveNote[],
  updateStatus: (sourceFile: string, status: LoveNoteStatus, readAt?: string) => Promise<void>,
) {
  const reveal = useCallback(async () => {
    const now = new Date();
    for (const n of loveNotes) {
      if (n.status === 'pending' && isRevealed(n, now)) {
        try { await updateStatus(n.sourceFile, 'revealed'); }
        catch (e) { if (__DEV__) console.warn('[reveal-on-foreground]', e); }
      }
    }
  }, [loveNotes, updateStatus]);

  useEffect(() => {
    // Mount : reveal immédiat
    reveal();
    // Foreground : reveal au retour
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') reveal();
    });
    return () => sub.remove();
  }, [reveal]);
}
```

**Branchement :**
- `app/(tabs)/lovenotes.tsx` (écran boîte) → ajout `useRevealOnForeground(loveNotes, updateLoveNoteStatus)` après les selectors
- Optionnel : aussi dans `app/(tabs)/index.tsx` pour que la carte enveloppe se mette à jour quand l'app revient au foreground sur le dashboard. Mais `useVault.ts:714` recharge déjà tout le vault au foreground (avec throttle 30s) → la bascule pending→revealed sera observable au prochain reload. Pour réactivité immédiate, brancher le hook aussi dans `index.tsx`.

### Pattern 6 : Animation unfold (sans `perspective` — feel 2D)

```tsx
// components/lovenotes/EnvelopeUnfoldModal.tsx
import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring, runOnJS, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { EnvelopeFlap } from './EnvelopeFlap';
import { WaxSeal } from './WaxSeal';

const SPRING_SEAL_JUMP = { damping: 8, stiffness: 200 } as const;
const UNFOLD_DURATION_MS = 800;

interface EnvelopeUnfoldModalProps {
  visible: boolean;
  fromName: string;
  body: string;
  onClose: () => void;
  onUnfoldComplete: () => void;     // appelle updateLoveNoteStatus(read)
}

export function EnvelopeUnfoldModal({ visible, fromName, body, onClose, onUnfoldComplete }: EnvelopeUnfoldModalProps) {
  const flapRotate = useSharedValue(0);
  const sealScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    // Reset
    flapRotate.value = 0;
    sealScale.value = 1;
    contentOpacity.value = 0;

    // Sequence : seal jump (200ms) → rabat unfold (800ms) → reveal content (400ms)
    sealScale.value = withSequence(
      withTiming(1.4, { duration: 200 }),
      withSpring(0, SPRING_SEAL_JUMP),                // disparaît avec rebond
    );
    flapRotate.value = withTiming(175, {
      duration: UNFOLD_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    contentOpacity.value = withTiming(1, { duration: 400, easing: Easing.linear }, () => {
      runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
      runOnJS(onUnfoldComplete)();
    });
  }, [visible]);

  const flapStyle = useAnimatedStyle(() => ({
    transform: [{ rotateX: `${flapRotate.value}deg` }],
    transformOrigin: 'top',                            // pliage par le haut (RN ~0.78+ supporte transformOrigin)
  }));
  const sealStyle = useAnimatedStyle(() => ({ transform: [{ scale: sealScale.value }] }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.envelope}>
          <Animated.View style={[styles.flap, flapStyle]}><EnvelopeFlap width={300} height={150} /></Animated.View>
          <Animated.View style={[styles.seal, sealStyle]}><WaxSeal count={0} pulse={false} /></Animated.View>
          <Animated.View style={[styles.content, contentStyle]}>
            <Text style={styles.from}>De {fromName}</Text>
            <Text style={styles.body}>{body}</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}
```

**Important sur `transformOrigin`** : disponible nativement dans RN 0.78+ (mais pas universellement supporté en Reanimated worklet — vérifier au runtime, fallback : positionner le rabat avec un pivot via `translateY` avant rotate). Si `transformOrigin` ne fonctionne pas dans le worklet, le rabat tournera autour de son centre → utiliser un container avec `translateY: -height/2` puis `translateY: height/2` autour du `rotateX`.

**Sans `perspective`** : `rotateX 175°` sans perspective rend le rabat comme s'il était écrasé verticalement (effet scaleY). C'est acceptable mais moins immersif. **Si on accepte la dérogation CLAUDE.md** : ajouter `{ perspective: 1000 }` AVANT `{ rotateX: '175deg' }` dans le transform array — résolu.

### Anti-Patterns à éviter

- **Animer `top`/`left` au lieu de `transform`** — perf catastrophique (layout pass JS). Seulement transforms + opacity dans worklets.
- **Schedule notif sans cancel précédent** — accumulation orpheline dans la file iOS (limite 64). Toujours `cancelLoveNoteReveal(sourceFile)` AVANT `scheduleNotificationAsync` (pattern intégré dans `scheduleLoveNoteReveal` ci-dessus).
- **`AppState.addEventListener` sans cleanup** — fuite listener (le hook accumule à chaque mount). Toujours `return () => sub.remove()`.
- **Comparer `revealAt` à `new Date().toISOString()`** — `toISOString()` shift en UTC (ajoute Z), `revealAt` est local sans Z → comparaison string casse en zone non-UTC. Réutiliser `isRevealed(note, now)` de `lib/lovenotes/selectors.ts` (déjà résolu Phase 35).
- **`updateLoveNoteStatus(read)` sans attendre la fin de l'animation** — la note disparaît brutalement de la liste "revealed" pendant l'unfold. Appeler `read` au callback `withTiming(opacity → 1)` PAS au tap initial.
- **Stocker `revealAt` avec `Z` (UTC)** — incohérent avec convention Phase 34. Toujours local sans Z (`'2026-04-17T09:07:00'`).
- **Ouvrir l'éditeur sans clearer le state** — bug classique : ré-ouvrir l'éditeur garde l'ancien body. Pattern NoteEditor.tsx:72 : `useEffect(() => { if (visible && !note) { setBody(''); ... } }, [visible])`.

## Don't Hand-Roll

| Problème | Don't Build | Use Instead | Why |
|----------|-------------|-------------|-----|
| Date/time picker UI | TextInput "JJ/MM/AAAA" + parsing manuel | `DateInput` (`components/ui/DateInput.tsx`) avec `mode='date'` puis `mode='time'` | Composant existant, gère iOS sheet + Android dialog + locale FR |
| Markdown rendering preview | parser regex inline `**bold** → <Text bold>` | `MarkdownText` (`components/ui/MarkdownText.tsx`) | Composant existant supporte gras/italique/listes/checkboxes/wikilinks/blockquotes/code/etc. |
| Modal pageSheet drag-to-dismiss | gesture handler custom | `Modal presentationStyle="pageSheet"` natif iOS | Drag-to-dismiss gratuit iOS 13+, zéro code |
| Notification scheduling | `setTimeout(() => ...)` (mort à l'app close) | `expo-notifications.scheduleNotificationAsync({trigger: {type: DATE, date}})` | Survit à kill app, géré par OS, pattern existant `lib/scheduled-notifications.ts` |
| AppState listener | polling `setInterval(checkActive, 1000)` | `AppState.addEventListener('change', cb)` | Event natif gratuit, déjà utilisé 4× dans le repo |
| Reveal pending notes function | mutation directe state | `updateLoveNoteStatus(sourceFile, 'revealed')` | Hook write-through (re-lit fichier, patch, écrit, sync state) — déjà testé Phase 34 |
| Sélection profil | List custom + radio | `Chip` (`components/ui/Chip.tsx`) avec `selected` | React.memo intégré, haptic, design tokens conformes |
| Permissions notif | `Notifications.requestPermissionsAsync()` direct | `requestNotificationPermissions()` (lib/scheduled-notifications.ts:124) | Wrapper existant qui check existing avant prompt |
| Date local ISO sans Z | `new Date().toISOString()` (shift UTC) | Helper `localIso(d)` ou réutiliser le pattern `pad` de `selectors.ts:25` | Convention Phase 34 — `LoveNote.createdAt`/`revealAt` strict local |
| Routing depuis notif | Linking.addEventListener manuel | `Notifications.addNotificationResponseReceivedListener` | API officielle expo-notifications, gère cold start + warm start |

**Key insight :** ~80% du code Phase 36 est de l'orchestration de composants existants. Le seul code nouveau "logique" est : (1) `scheduleLoveNoteReveal` 30 lignes dans scheduled-notifications.ts, (2) `useRevealOnForeground` hook 25 lignes, (3) presets reveal-engine 30 lignes pure JS, (4) `EnvelopeUnfoldModal` 80 lignes orchestration Reanimated, (5) `LoveNoteEditor` 200 lignes orchestration Chip+TextInput+MarkdownText+DateInput. Total ≈ 365 lignes neuves.

## Common Pitfalls

### Pitfall 1 : `perspective` interdit + `rotateX` sans profondeur 3D
**What goes wrong :** Le requirement LOVE-13 demande "rotation X du rabat ≥175°" ce qui suggère un effet 3D photoréaliste. Sans `perspective`, RN rend `rotateX` comme un scaleY → le rabat s'aplatit verticalement et disparaît (pas de "papier qui se plie en arrière").
**Why it happens :** CLAUDE.md ligne 25 interdit `perspective` à cause d'un cas spécifique de clipping 3D des habitants ferme dans `overflow:hidden` (Phase 11 RESEARCH ligne 336).
**How to avoid :** Deux options à trancher au planning : (a) accepter le feel 2D (rabat s'écrase) ; (b) dérogation locale justifiée — `{ perspective: 1000 }` LOCAL au rabat dans un container SANS `overflow:hidden`. Le clip ne sera pas un problème ici car le rabat sort du modal qui est lui-même dans un Modal full-screen.
**Warning signs :** Au test sur device, le rabat "disparaît" sans tourner visiblement = perspective manquante mais aucune erreur affichée.

### Pitfall 2 : `transformOrigin` non supporté en worklet Reanimated 4.1
**What goes wrong :** Le rabat tourne autour de son centre (au lieu du haut) → effet "porte qui pivote au milieu" au lieu de "papier qui se plie par le haut".
**Why it happens :** `transformOrigin` est une prop nouvelle (RN 0.78+) parfois pas synchronisée avec Reanimated worklets selon la version.
**How to avoid :** Tester `transformOrigin: 'top'` sur device. Si KO → fallback : encapsuler le rabat dans un wrapper qui translate `[-height/2, 0]`, puis rotate, puis translate `[height/2, 0]` (pivot manuel). Pattern : `transform: [{ translateY: -h/2 }, { rotateX: ... }, { translateY: h/2 }]`.
**Warning signs :** Le rabat tourne mais ne se replie pas par le haut — pivot au mauvais endroit.

### Pitfall 3 : Notification non déclenchée si revealAt déjà passé au moment du schedule
**What goes wrong :** User compose une note avec `revealAt = "2026-04-17T08:00"` mais on est `2026-04-17T08:01` (preset "Demain matin" mal calculé ou délai composition). `scheduleNotificationAsync` rejette silently un trigger DATE dans le passé sur iOS.
**Why it happens :** Pas de validation côté schedule.
**How to avoid :** Dans `scheduleLoveNoteReveal`, return early si `revealDate.getTime() <= Date.now()` (déjà inclus dans le pattern ci-dessus). En complément, dans `LoveNoteEditor` : valider `revealAt > now + 1 minute` avant `addLoveNote`. Alert FR : "La date de révélation doit être dans le futur".
**Warning signs :** User programme une note "Demain matin" tard le soir, va se coucher — pas de notif au matin. La note bascule quand même via `useRevealOnForeground` au prochain foreground (filet de sécurité), mais la notif silencieuse manque.

### Pitfall 4 : iOS limite ~64 notifs locales en file
**What goes wrong :** Famille très active → 5 profils × 20 notes/mois = 100 notifs en file → iOS drop les plus anciennes silencieusement.
**Why it happens :** Limite système iOS (Apple docs).
**How to avoid :** Au boot dans `loadVaultData`, scanner toutes les `loveNotes` `pending` et appeler `scheduleLoveNoteReveal` (idempotent — cancel + reschedule). Mais l'idempotence garantit que le total ≤ count(pending). Pour 5 profils × 20/mois c'est ≤ 100 — déjà au-dessus. **Mitigation :** ne schedule que les notes dont `revealAt < now + 30 jours` (au-delà, on s'appuie sur `useRevealOnForeground` au foreground).
**Warning signs :** Notes programmées loin dans le futur ne notif pas → bug rare, identifié au log `Notifications.getAllScheduledNotificationsAsync()`.

### Pitfall 5 : Animation unfold ne se déclenche pas si Modal monte avec `visible=true` initial
**What goes wrong :** Le `useEffect` qui démarre l'animation est lié à `[visible]`. Si le Modal monte directement avec `visible=true`, l'effect tire mais les sharedValues sont déjà initialisées au mount → race possible avec le rendu initial.
**Why it happens :** Reanimated initialise les SharedValues au mount du composant, pas du Modal.
**How to avoid :** Soit (a) toujours mount Modal avec `visible=false` puis flip à `true` (controllé par parent state) ; (b) déclencher l'animation dans un `useEffect` avec `requestAnimationFrame(() => { flapRotate.value = withTiming(...) })` pour garantir que le frame initial est posé.
**Warning signs :** Première ouverture du modal = pas d'animation, ouverture suivante OK.

### Pitfall 6 : `read` patché avant la fin de l'animation → flicker
**What goes wrong :** Au tap sur LoveNoteCard `revealed`, on appelle `updateLoveNoteStatus(read)` immédiatement. La liste `received` re-trier (read passe en tier 2), la card disparaît de "Reçues" pendant que `EnvelopeUnfoldModal` est en train d'animer → expérience cassée.
**Why it happens :** Sync state avant async animation.
**How to avoid :** Patch `read` UNIQUEMENT au callback `withTiming(opacity, ..., () => runOnJS(onUnfoldComplete)())`. Le parent reçoit le callback et appelle `updateLoveNoteStatus(read)` après `await`. Pendant l'animation, la card est masquée par le modal full-screen → pas de flicker visible.
**Warning signs :** User voit la liste se réorganiser pendant le unfold.

### Pitfall 7 : Validation cold-start notification routing
**What goes wrong :** App tuée, notif tap → app cold start → `addNotificationResponseReceivedListener` se monte APRÈS que le système ait fire l'event → callback raté → pas de navigation.
**Why it happens :** Race entre boot RN et delivery event.
**How to avoid :** En cold start, utiliser aussi `Notifications.getLastNotificationResponseAsync()` au mount initial pour récupérer la dernière notif tappée. Pattern :
```typescript
useEffect(() => {
  Notifications.getLastNotificationResponseAsync().then((resp) => {
    const route = resp?.notification.request.content.data?.route;
    if (typeof route === 'string') router.push(route as any);
  });
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    /* warm start */
  });
  return () => sub.remove();
}, []);
```
**Warning signs :** Cold start après tap notif arrive sur le dashboard au lieu de `/lovenotes`.

### Pitfall 8 : Permissions notifications refusées → silent failure
**What goes wrong :** User a refusé les notifs (Phase 35 ou ailleurs) → `scheduleNotificationAsync` ne fait rien, mais `addLoveNote` réussit. Note créée, jamais notifiée. User attend la notif qui ne vient pas.
**Why it happens :** Pas de feedback à l'utilisateur.
**How to avoid :** Au save, si `scheduleLoveNoteReveal` retourne `false` (pas de permission), afficher Alert FR "Note programmée mais notifications désactivées — la note apparaîtra à l'ouverture de l'app". Filet de sécurité : `useRevealOnForeground` bascule la note au foreground même sans notif.
**Warning signs :** User confus : "j'ai pas reçu de notif". Le filet AppState fonctionne mais surprise UX.

### Pitfall 9 : Composer pour soi-même
**What goes wrong :** Le filtre des destinataires Chip n'exclut pas l'auteur → user peut s'écrire à soi-même → message bizarre + carte enveloppe sur son propre dashboard.
**Why it happens :** Oubli filtre `p.id !== fromProfile.id`.
**How to avoid :** Toujours `recipientProfiles = profiles.filter(p => p.id !== activeProfile.id)`. Et si `recipientProfiles.length === 0` (famille 1 personne) → désactiver le bouton "Écrire" + Alert "Tu es seul·e dans ta famille — invite un proche pour utiliser les Love Notes".
**Warning signs :** Note écrite à soi-même apparaît dans "Reçues" de l'auteur — comportement absurde.

### Pitfall 10 : `MarkdownText` numberOfLines sur preview qui tronque mal
**What goes wrong :** Preview body tronque au milieu d'un `**gras**` → rendu cassé.
**Why it happens :** `MarkdownText` parse le markdown puis applique `numberOfLines` sur un `<Text>` parent → la troncation respecte l'inline mais peut couper visuellement maladroitement.
**How to avoid :** Dans l'éditeur, l'utilisateur tape librement, `MarkdownText` rend tout (pas de troncation dans la preview). C'est sur `LoveNoteCard` (Phase 35) que le preview est tronqué — déjà résolu via `replace(/[*_`#>]/g, '')` strip puis `numberOfLines={2}`.
**Warning signs :** N/A Phase 36 (preview éditeur full).

## Code Examples

### Exemple complet — Save flow LoveNoteEditor

```tsx
// Dans LoveNoteEditor.tsx
const handleSave = useCallback(async () => {
  // Validation
  if (!to) { Alert.alert('Choisis un destinataire'); return; }
  if (!body.trim()) { Alert.alert('Le message ne peut pas être vide'); return; }
  if (!revealDate) { Alert.alert('Choisis une date de révélation'); return; }

  const revealAt = `${revealDate}T${revealTime}:00`;     // ISO local sans Z
  const [y, m, d] = revealDate.split('-').map(Number);
  const [hh, mm] = revealTime.split(':').map(Number);
  const revealDt = new Date(y, m - 1, d, hh, mm, 0);
  if (revealDt.getTime() <= Date.now() + 60_000) {
    Alert.alert('La date de révélation doit être dans le futur');
    return;
  }

  setSaving(true);
  try {
    const createdAt = localIso(new Date());                // helper réutilisé
    const note: Omit<LoveNote, 'sourceFile'> = {
      from: fromProfile.id,
      to,
      createdAt,
      revealAt,
      status: 'pending',
      body: body.trim(),
    };
    await onSave(to, body.trim(), revealAt);               // parent appelle addLoveNote + scheduleLoveNoteReveal
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  } catch (e) {
    Alert.alert('Erreur', 'Impossible de programmer la note');
    if (__DEV__) console.error('[LoveNoteEditor] save', e);
  } finally {
    setSaving(false);
  }
}, [to, body, revealDate, revealTime, fromProfile.id, onSave, onClose]);
```

### Exemple — câblage écran lovenotes.tsx (FAB + editor + reveal hook)

```tsx
// app/(tabs)/lovenotes.tsx — additions Phase 36
import { useState, useCallback } from 'react';
import { LoveNoteEditor, EnvelopeUnfoldModal } from '../../components/lovenotes';
import { useRevealOnForeground } from '../../hooks/useRevealOnForeground';
import { scheduleLoveNoteReveal } from '../../lib/scheduled-notifications';

// Dans le composant LoveNotesScreen :
const { loveNotes, addLoveNote, updateLoveNoteStatus, activeProfile, profiles } = useVault();
const [editorVisible, setEditorVisible] = useState(false);
const [unfoldNote, setUnfoldNote] = useState<LoveNote | null>(null);

useRevealOnForeground(loveNotes, updateLoveNoteStatus);

const recipientProfiles = useMemo(
  () => profiles.filter((p) => p.id !== activeProfile?.id),
  [profiles, activeProfile?.id],
);

const handleSave = useCallback(async (to: string, body: string, revealAt: string) => {
  if (!activeProfile) return;
  const note: Omit<LoveNote, 'sourceFile'> = {
    from: activeProfile.id, to, body, revealAt,
    createdAt: localIso(new Date()), status: 'pending',
  };
  await addLoveNote(note);
  // sourceFile généré par le hook — récupérer depuis le state après save
  // Schedule via le sourceFile prévisible (loveNotePath utility) ou re-fetch
  await scheduleLoveNoteReveal({ ...note, sourceFile: loveNotePath(to, note.createdAt) } as LoveNote);
}, [activeProfile, addLoveNote]);

const handleCardPress = useCallback((note: LoveNote) => {
  if (note.status === 'revealed') {
    setUnfoldNote(note);
  } else if (note.status === 'pending' && isRevealed(note)) {
    // pending due → upgrade en revealed puis ouvrir
    updateLoveNoteStatus(note.sourceFile, 'revealed').then(() => setUnfoldNote(note));
  }
  // pending future / read → noop ou navigation détail (out of scope)
}, [updateLoveNoteStatus]);

// Dans le JSX, ajouter FAB + Modal éditeur + Modal unfold
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RN Animated API | react-native-reanimated worklets | RN 0.71+ | Animations 60fps UI thread, obligatoire CLAUDE.md |
| `Notifications.scheduleNotificationAsync({trigger: {seconds: ...}})` (déprécié) | `{trigger: {type: SchedulableTriggerInputTypes.DATE, date: Date}}` | expo-notifications 0.20+ | Pattern utilisé Phase 36, déjà rodé scheduled-notifications.ts |
| `Modal animationType="fade"` + custom drag | `presentationStyle="pageSheet"` natif iOS | iOS 13+ / RN 0.62+ | Drag-to-dismiss gratuit |
| date-fns helpers | JS pur (Date + setHours) | toujours | OK pour presets simples Phase 36 |

**Deprecated/outdated :**
- `Notifications.addNotificationReceivedListener` (notif while in app foreground) ≠ `addNotificationResponseReceivedListener` (notif tappée). Phase 36 a besoin du **Response** listener pour routing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-notifications | LOVE-11 schedule + listener | ✓ | ^0.32.16 | — |
| expo-haptics | LOVE-13 success haptic | ✓ | ~15.0.8 | silent skip si refusé |
| react-native-reanimated | LOVE-13 unfold animation | ✓ | ~4.1.1 | — |
| @react-native-community/datetimepicker | LOVE-09 date+time picker | ✓ | ^8.4.4 | — |
| date-fns | optional presets helpers | ✓ | déjà importé | JS pur (recommandé) |
| react-native-svg | LOVE-13 EnvelopeFlap (réutilisé) | ✓ | installé | — |
| Hook useVaultLoveNotes | LOVE-09 addLoveNote, LOVE-12/13 updateLoveNoteStatus | ✓ | Phase 34 shipped | — |
| `lib/lovenotes/selectors.ts` isRevealed | LOVE-12 reveal logic | ✓ | Phase 35 shipped | — |
| `components/lovenotes/EnvelopeFlap` + `WaxSeal` | LOVE-13 unfold animation | ✓ | Phase 35 shipped | — |
| Permissions notif | LOVE-11 | ✓ requestNotificationPermissions wrapper | scheduled-notifications.ts:124 | Filet AppState (LOVE-12) si refusé |

**Missing dependencies with no fallback:** Aucune.

**Missing dependencies with fallback:** Aucune (toute la stack est en place).

## Open Questions

1. **Faut-il `perspective` pour l'unfold 3D, en dérogation à CLAUDE.md ?**
   - What we know : CLAUDE.md ligne 25 interdit `perspective` (cause clipping 3D habitants ferme). Sans perspective, `rotateX 175°` rend pseudo-2D.
   - What's unclear : le mockup `lovenote-envelope.html:90` UTILISE `perspective: 1000px` pour l'effet ouvert — l'intention design EST 3D.
   - Recommendation : Trancher au planning. Préférence : dérogation LOCALE au rabat avec justification (le clipping interdit était dans `overflow:hidden` farm — ici full-screen modal, pas de clip à craindre). Documenter la décision dans `_layout.tsx` impacted ou directly in EnvelopeUnfoldModal.tsx commentaire.

2. **Schedule notif au moment du save (`addLoveNote`) ou au boot via re-scan ?**
   - What we know : Pattern actuel scheduled-notifications.ts re-scan au boot (RDV/Tasks/Stock).
   - What's unclear : pour love notes, schedule à `addLoveNote` est plus immédiat. Au boot, re-scanner = idempotence garantie mais double appel.
   - Recommendation : **Les deux** — schedule au save (pour réactivité) + re-scan au boot dans `loadVaultData` pour résilience aux scenarios "phone restart entre save et reveal" qui drop la notif iOS file. Idempotence assurée par cancel-then-schedule.

3. **Hook `useRevealOnForeground` : où le brancher exactement ?**
   - What we know : 2 surfaces consomment loveNotes (dashboard `index.tsx` carte enveloppe + écran `lovenotes.tsx`).
   - What's unclear : si on branche dans les deux, le hook fire 2× au foreground → le `for` loop appelle `updateLoveNoteStatus` 2× pour chaque pending due → 2× write disque (idempotent mais I/O double).
   - Recommendation : brancher UNIQUEMENT dans `app/(tabs)/lovenotes.tsx` (l'écran qui a le plus besoin de réactivité). Le dashboard se met à jour via le re-load vault auto (`useVault.ts:714` au foreground avec throttle 30s). Pour le user qui n'ouvre jamais `/lovenotes` mais reste sur dashboard, un peu de retard à la bascule pending→revealed est acceptable (et la notif silencieuse aura déjà alerté).

4. **`EnvelopeUnfoldModal` ouvre-t-il sur tap LoveNoteCard ou est-il un écran navigué ?**
   - What we know : Phase 35 LoveNoteCard a un `onPress?` non câblé.
   - What's unclear : modal full-screen vs route `/lovenotes/{id}`.
   - Recommendation : Modal — moins de boilerplate route, contrôle animation simple, pattern aligné avec le mockup `.eo-` "État ouvert" qui est posé sous le hero envelope.

5. **Quel preset par défaut au mount de l'éditeur ?**
   - What we know : 3 presets prédéfinis ("Demain matin", "Dimanche soir", "Dans 1 mois") + custom.
   - What's unclear : le picker date/time démarre vide ou pré-rempli avec "Demain matin" ?
   - Recommendation : pré-remplir avec **"Demain matin"** par défaut (cas le plus fréquent imaginé : message du soir révélé au matin), avec le chip "Demain matin" visuellement sélectionné. User peut tap autre preset ou modifier directement.

## Validation Architecture

> Skip section — `workflow.nyquist_validation: false` dans `.planning/config.json:19`. Tests Jest optionnels mais recommandés pour `lib/lovenotes/reveal-engine.ts` (presets pure functions) et `lib/scheduled-notifications.ts` (scheduleLoveNoteReveal idempotence). Pattern existant `lib/__tests__/parser-lovenotes.test.ts` (Phase 34, 18 tests) à répliquer si jugé utile au planning.

## Sources

### Primary (HIGH confidence)
- `./CLAUDE.md` — règles projet (perspective, reanimated, useThemeColors, modals pageSheet, haptics, format date)
- `./package.json` — versions stack (expo-notifications ^0.32.16, expo-haptics ~15.0.8, reanimated ~4.1.1, datetimepicker ^8.4.4)
- `lib/types.ts:577-606` — schema LoveNote canonique
- `lib/parser.ts:2755-2830` — parseLoveNote, serializeLoveNote, loveNotePath, LOVENOTES_DIR
- `lib/lovenotes/selectors.ts` — isRevealed, receivedForProfile, sentByProfile, archivedForProfile
- `lib/scheduled-notifications.ts` — pattern complet expo-notifications (configureNotifications, requestNotificationPermissions, scheduleNotificationAsync DATE trigger, cancelByCategory)
- `hooks/useVaultLoveNotes.ts` — API addLoveNote, updateLoveNoteStatus, deleteLoveNote (signatures, comportement write-through)
- `hooks/useVault.ts:714` — pattern AppState.addEventListener('change', cb) avec throttle + cleanup
- `contexts/AuthContext.tsx:232` — pattern AppState avec backgroundTimestamp
- `app/(tabs)/tree.tsx:567`, `app/(tabs)/village.tsx:403` — autres usages AppState
- `components/ui/DateInput.tsx` — DateTimePicker iOS sheet + Android dialog, mode='date'|'time'
- `components/ui/Chip.tsx` — Chip API (selected, emoji, color, onPress, React.memo)
- `components/ui/MarkdownText.tsx` — MarkdownText API (children:string, style, numberOfLines, onLinkPress)
- `components/NoteEditor.tsx:195` — pattern Modal pageSheet animationType=slide onRequestClose
- `components/mascot/ExpeditionsSheet.tsx:205` — autre usage pageSheet + tab pattern
- `components/lovenotes/{EnvelopeFlap,WaxSeal,EnvelopeCard,LoveNoteCard}.tsx` — composants Phase 35 réutilisés
- `app/_layout.tsx` — providers hierarchy + configureNotifications mount point
- `.planning/mockups/lovenote-envelope.html` — design source visuel (variant "État ouvert" .eo-flap rotateX 175deg)
- `.planning/REQUIREMENTS.md` LOVE-09..13 — spec exacte
- `.planning/ROADMAP.md` Phase 36 — success criteria
- `.planning/STATE.md` decisions — convention ISO local sans Z, naming `03 - Famille/LoveNotes/{to}/`, slug base36 deterministe
- `.planning/phases/35-*/35-RESEARCH.md` — patterns Reanimated WaxSeal, anti-patterns dashboard injection
- `.planning/phases/34-*/34-03-SUMMARY.md` — API exacte du hook + Known Stubs résolus

### Secondary (MEDIUM confidence)
- `expo-notifications` docs (https://docs.expo.dev/versions/latest/sdk/notifications/) — `addNotificationResponseReceivedListener`, `getLastNotificationResponseAsync` (cold start handling), `SchedulableTriggerInputTypes.DATE`
- React Native `transformOrigin` (RN 0.78+) — support partiel selon version Reanimated
- iOS notification limit ~64 — Apple official documentation

### Tertiary (LOW confidence)
- Aucune. Toutes les claims Phase 36 sont vérifiables dans le repo ou dans la doc officielle expo-notifications.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — toute la stack est installée et déjà utilisée dans le repo
- Architecture : HIGH — patterns réutilisés (Modal pageSheet, AppState, scheduleNotificationAsync, Reanimated worklets) tous présents dans le codebase
- Pitfalls : HIGH — `perspective` interdiction documentée CLAUDE.md, `transformOrigin` worklet support à valider device, iOS notif limit Apple docs, cold start routing pattern documenté expo
- Hook API : HIGH — signatures vérifiées dans `hooks/useVaultLoveNotes.ts` ligne 76+
- Notification routing cold start : MEDIUM — `getLastNotificationResponseAsync` documenté mais non utilisé dans ce repo, à valider en intégration

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 jours — stack stable, pas de breaking change attendu sur expo-notifications dans cette fenêtre)
