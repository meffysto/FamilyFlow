---
phase: 35-carte-enveloppe-dashboard-cran-bo-te-aux-lettres
verified: 2026-04-17T12:00:00Z
status: passed
score: 5/5 success criteria verified
---

# Phase 35 — Carte enveloppe dashboard + écran boîte aux lettres — Rapport de vérification

**Phase Goal:** Rendre les love notes visibles et navigables — carte enveloppe distinctive pinned en tête du dashboard quand au moins 1 note à révéler/non lue, plus écran boîte aux lettres complet organisé en 3 segments (reçues / envoyées / archivées) accessible depuis la carte ET depuis une tuile permanente dans `more.tsx`.

**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| #   | Truth                                                                                     | Status     | Evidence                                                                                                       |
| --- | ----------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Carte enveloppe distinctive pinned en haut du dashboard si ≥1 note pending/unread         | ✓ VERIFIED | `app/(tabs)/index.tsx:1048-1059` — `{pendingLoveNotes.length > 0 && activeProfile && (<SectionErrorBoundary><EnvelopeCard count=… />…)}` placée AVANT `sortedSections.filter` (line 1062). Mémo `pendingLoveNotes` line 522 utilise `unreadForProfile(loveNotes, activeProfile.id)`. |
| 2   | Badge compteur sur cachet + stack visuel quand ≥2 notes en attente                        | ✓ VERIFIED | `EnvelopeCard.tsx:66-91` — rend 2 `View.stackBack` (rotations +2°/-3°, opacity 0.7/0.55) si `count >= 2`. `WaxSeal.tsx:89-93` — badge rendu si `count >= 2`. EnvelopeCard passe `count={pendingLoveNotes.length}` à WaxSeal. |
| 3   | Accès `/lovenotes` via carte OU tuile dans more.tsx                                       | ✓ VERIFIED | Carte : `index.tsx:1055` `router.push('/(tabs)/lovenotes' as any)`. Tuile : `more.tsx:154` entry items 'Love Notes' route '/(tabs)/lovenotes' catégorie famille avec badge `loveNoteUnreadCount`. |
| 4   | Écran Boîte aux lettres avec 3 segments + FlatList virtualisée                            | ✓ VERIFIED | `app/(tabs)/lovenotes.tsx` — `SegmentedControl<Segment>` (Reçues/Envoyées/Archivées, line 62-73), `FlatList` avec `initialNumToRender={10}` + `removeClippedSubviews` line 92-100. Trois sélecteurs mémoïsés (received/sent/archived). |
| 5   | Carte disparaît auto quand plus aucune note pending/unread                                | ✓ VERIFIED | Render conditionnel pur `pendingLoveNotes.length > 0 && activeProfile && …` (index.tsx:1048). useMemo réagit aux deps `[loveNotes, activeProfile?.id]` (line 524). |

**Score:** 5/5 success criteria verified

### Required Artifacts

| Artifact                                          | Expected                                              | Status     | Details                                                                            |
| ------------------------------------------------- | ----------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `lib/lovenotes/selectors.ts`                      | 5 sélecteurs purs                                     | ✓ VERIFIED | isRevealed, unreadForProfile, receivedForProfile (3-tier), sentByProfile, archivedForProfile présents et exportés. |
| `lib/lovenotes/index.ts`                          | Barrel                                                | ✓ VERIFIED | `export * from './selectors';`                                                     |
| `lib/__tests__/lovenotes-selectors.test.ts`       | ≥19 tests Jest                                        | ✓ VERIFIED | **19/19 tests passent** (incluant test 3-tier explicite et "préserve la surprise"). |
| `app/(tabs)/lovenotes.tsx`                        | Écran 3 segments + FlatList                           | ✓ VERIFIED | SegmentedControl + 3 FlatList (par segment) + empty state + LoveNoteCard.          |
| `app/(tabs)/_layout.tsx`                          | `Tabs.Screen name="lovenotes" href:null`              | ✓ VERIFIED | Line 278 `<Tabs.Screen name="lovenotes" options={{ href: null }} />` (hidden).     |
| `components/lovenotes/WaxSeal.tsx`                | Pulse Reanimated + size? + cleanup                    | ✓ VERIFIED | `withRepeat(withTiming…)`, `cancelAnimation` cleanup, `size?:number` default 72 scale width/height/borderRadius/fontSize. React.memo. |
| `components/lovenotes/EnvelopeFlap.tsx`           | Polygon SVG + LinearGradient                          | ✓ VERIFIED | Polygon points triangle + LinearGradient stops `#efdcb0 → #d4bc85`.                 |
| `components/lovenotes/EnvelopeCard.tsx`           | Composition Flap+Seal+stack+tilt                      | ✓ VERIFIED | tilt -1.5°, aspectRatio 2/1.15, stack si count≥2, recipientName, Pressable EXTERNE au rotate (Pitfall 8). React.memo. |
| `components/lovenotes/LoveNoteCard.tsx`           | Memo + lookup profil + format JJ/MM/AAAA + WaxSeal mini | ✓ VERIFIED | `formatDateFR` slice(0,10).split('-').reverse().join('/'), `<WaxSeal size={32}…/>`, comparator prevProps/nextProps. |
| `components/lovenotes/index.ts`                   | Barrel 4 composants                                   | ✓ VERIFIED | Réexporte WaxSeal, EnvelopeFlap, EnvelopeCard, LoveNoteCard.                       |
| `app/(tabs)/index.tsx` injection                  | EnvelopeCard pinned + SectionErrorBoundary            | ✓ VERIFIED | Lines 1048-1059, AVANT sortedSections.filter (1062). Wrapping SectionErrorBoundary name="Love Notes". |
| `app/(tabs)/more.tsx` tuile                       | Entry catégorie famille route /lovenotes              | ✓ VERIFIED | Line 154 emoji 💌, badge `loveNoteUnreadCount`, color colors.catFamille, category 'famille'. |

### Key Link Verification

| From                                | To                                                  | Via                                                              | Status  | Details                                                                |
| ----------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `app/(tabs)/lovenotes.tsx`          | `useVault().{loveNotes, activeProfile, profiles}` | useVault() destructuring + useMemo deps                          | ✓ WIRED | Line 31 `const { loveNotes, activeProfile, profiles } = useVault();`   |
| `app/(tabs)/lovenotes.tsx`          | `lib/lovenotes/selectors`                          | import receivedForProfile/sentByProfile/archivedForProfile       | ✓ WIRED | Lines 20-24 + useMemo lines 38-49.                                     |
| `EnvelopeCard.tsx`                  | `WaxSeal + EnvelopeFlap`                            | composition JSX interne                                          | ✓ WIRED | Lines 106 (`<EnvelopeFlap…/>`) et 122 (`<WaxSeal count={count} size={SEAL_SIZE} />`). |
| `LoveNoteCard.tsx`                  | `WaxSeal` (variant mini size=32)                    | `<WaxSeal size={32}…/>`                                          | ✓ WIRED | Line 60 `<WaxSeal size={32} count={0} pulse={true} initial="✉" />`.     |
| `app/(tabs)/lovenotes.tsx`          | `LoveNoteCard`                                      | renderItem useCallback                                           | ✓ WIRED | Lines 55-60 `<LoveNoteCard note={item} profiles={profiles} />`.        |
| `app/(tabs)/index.tsx`              | `EnvelopeCard + unreadForProfile`                   | imports + useMemo `[loveNotes, activeProfile?.id]`               | ✓ WIRED | Lines 56-57 imports, 522-525 memo, 1048-1058 JSX.                      |
| `app/(tabs)/index.tsx`              | `app/(tabs)/lovenotes.tsx`                          | `router.push('/(tabs)/lovenotes' as any)` dans onPress           | ✓ WIRED | Line 1055.                                                              |
| `app/(tabs)/more.tsx`               | `app/(tabs)/lovenotes.tsx`                          | array items entry route '/(tabs)/lovenotes'                      | ✓ WIRED | Line 154.                                                              |
| `EnvelopeCard injection`            | `SectionErrorBoundary`                              | wrapping                                                         | ✓ WIRED | Line 1049 `<SectionErrorBoundary key="lovenotes-envelope" name="Love Notes">`. |
| `WaxSeal.tsx`                       | `react-native-reanimated`                           | useSharedValue + withRepeat + cancelAnimation                    | ✓ WIRED | Lines 13-21 imports, 50-67 effet + cleanup.                            |

### Data-Flow Trace (Level 4)

| Artifact                | Data Variable           | Source                                         | Produces Real Data | Status      |
| ----------------------- | ----------------------- | ---------------------------------------------- | ------------------ | ----------- |
| `app/(tabs)/index.tsx`  | `pendingLoveNotes`      | `useVault().loveNotes` → `unreadForProfile()` | ✓ Yes (Phase 34 useVaultLoveNotes) | ✓ FLOWING |
| `app/(tabs)/lovenotes.tsx` | `received/sent/archived` | `useVault().loveNotes` → 3 sélecteurs purs | ✓ Yes              | ✓ FLOWING   |
| `app/(tabs)/more.tsx`   | `loveNoteUnreadCount`   | `useVault().loveNotes` → `unreadForProfile().length` | ✓ Yes      | ✓ FLOWING   |
| `EnvelopeCard`          | `count, recipientName`  | Props passées depuis index.tsx (count = vrai length, recipientName = activeProfile.name) | ✓ Yes | ✓ FLOWING |
| `LoveNoteCard`          | `note, profiles`        | Props passées depuis FlatList renderItem      | ✓ Yes              | ✓ FLOWING   |

### Behavioral Spot-Checks

| Behavior                                    | Command                                               | Result                  | Status |
| ------------------------------------------- | ----------------------------------------------------- | ----------------------- | ------ |
| Tests Jest sélecteurs passent               | `npx jest lib/__tests__/lovenotes-selectors.test.ts`  | 19/19 passed (1.5s)     | ✓ PASS |
| TypeScript clean (hors pré-existants)       | `npx tsc --noEmit | grep -v MemoryEditor/cooklang/useVault | grep "error TS"` | (no output) | ✓ PASS |
| EnvelopeCard injection AVANT sortedSections | line 1048 `pendingLoveNotes` < line 1062 `sortedSections.filter` | Verified | ✓ PASS |
| Route lovenotes hidden via href:null        | grep `<Tabs.Screen name="lovenotes" options={{ href: null }} />` | Found line 278 | ✓ PASS |
| Pas d'antipattern TODO/FIXME/Placeholder    | grep dans components/lovenotes                        | No matches              | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                       | Status      | Evidence                                       |
| ----------- | ----------- | --------------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| LOVE-05     | 35-02, 35-03 | Carte enveloppe distinctive pinned dashboard si ≥1 note non lue/à révéler        | ✓ SATISFIED | EnvelopeCard.tsx + injection index.tsx:1048   |
| LOVE-06     | 35-02, 35-03 | Compteur (badge cachet) + effet stack quand ≥2 notes                              | ✓ SATISFIED | WaxSeal badge count>=2 + EnvelopeCard stackBack count>=2 |
| LOVE-07     | 35-01, 35-03 | Accès écran boîte aux lettres via carte ET tuile more.tsx                         | ✓ SATISFIED | router.push index.tsx:1055 + entry more.tsx:154 |
| LOVE-08     | 35-01, 35-02 | Écran 3 segments (Reçues / Envoyées / Archivées)                                  | ✓ SATISFIED | SegmentedControl lovenotes.tsx:79 + 3 selectors |

Aucune requirement orpheline. REQUIREMENTS.md (lignes 80-83) déclare LOVE-05..08 → Phase 35 = Complete, et chaque ID apparaît bien dans au moins un PLAN frontmatter `requirements:`.

### Anti-Patterns Found

Aucun. Pas de TODO/FIXME/PLACEHOLDER, pas de stub résiduel, pas de hardcoded couleur sur surfaces thémées (les constantes cosmétiques module PAPER/INK/WAX sont autorisées per RESEARCH Open Question 1).

### Human Verification Required

(Recommandées mais non bloquantes — l'app n'a pas de test E2E.)

1. **Test visuel device : EnvelopeCard pinned dashboard**
   - **Test :** Seed 1 love note revealed pour profil actif → relancer app
   - **Expected :** EnvelopeCard apparaît tout en haut du dashboard avec cachet rouge pulse + tilt -1.5°, papier ivoire, rabat triangulaire SVG
   - **Why human :** Rendu visuel + animation Reanimated nécessite œil humain

2. **Test visuel device : badge + stack ≥2 notes**
   - **Test :** Seed 3 love notes revealed pour profil actif
   - **Expected :** Badge "3" sur cachet + 2 enveloppes empilées en fond visibles (rotations -3°/+2°, opacities 0.55/0.70)
   - **Why human :** Cosmétique compositionnelle

3. **Test navigation : carte → écran**
   - **Test :** Tap EnvelopeCard sur dashboard
   - **Expected :** Haptic feedback + navigation vers /lovenotes, écran "Boîte aux lettres" affiché avec 3 segments
   - **Why human :** Haptics + transition router

4. **Test disparition auto carte**
   - **Test :** Marquer la dernière note comme `read` dans le vault
   - **Expected :** EnvelopeCard disparaît du dashboard sans flash après reload
   - **Why human :** Comportement live state propagation

5. **Test tuile more.tsx**
   - **Test :** Naviguer vers `more` (catégorie famille)
   - **Expected :** Tuile 💌 "Love Notes" visible avec badge si notes en attente, tap → /lovenotes
   - **Why human :** Vérification placement + badge dynamique

### Gaps Summary

Aucun gap. Les 5 success criteria du ROADMAP sont satisfaits dans le code, les 4 requirements LOVE-05..08 sont mappés, 19/19 tests Jest passent, TypeScript clean (hors erreurs pré-existantes documentées dans CLAUDE.md), aucun anti-pattern, data-flow trace complet (loveNotes provient de useVault → useVaultLoveNotes Phase 34 shipped). Phase 35 atteint son goal — la carte enveloppe est wired au dashboard, l'écran boîte aux lettres est navigable, la tuile permanente existe dans more.tsx.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
