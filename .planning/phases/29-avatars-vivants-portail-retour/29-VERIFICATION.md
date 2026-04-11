---
phase: 29-avatars-vivants-portail-retour
verified: 2026-04-11T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code) + 3 visual checks pending
re_verification: null
human_verification:
  - test: "Lancer l'app sur device (npx expo run:ios --device), ouvrir l'écran Village via le portail ferme, observer 6 slots avatars sprites pixel art compagnon positionnés sur la carte"
    expected: "Un sprite compagnon par profil actif (hors grossesse) apparaît à un emplacement fixe ; même profil → même slot à chaque ouverture (tri alphabétique stable)"
    why_human: "Rendu visuel pixel art, alignement coordonnées fractionnelles sur la carte, absence de chevauchement avec fountain/stalls/board — non vérifiable par grep"
  - test: "Sur un profil ayant contribué cette semaine, observer le halo vert pulsant derrière son avatar (2s cycle) ; sur un profil inactif, vérifier opacité 0.55 sans halo"
    expected: "Halo colors.success oscillant opacity 0.5↔0.8 sur actifs, sprite à 55% d'opacité sans halo sur inactifs"
    why_human: "Animation temps réel Reanimated — perception visuelle du pulse et différenciation active/inactive"
  - test: "Tap sur un avatar → bulle '[Prénom] — X contributions cette semaine' apparaît au-dessus, puis dismiss automatique après 2.5s ; taper un avatar en bord de carte pour valider le clamp horizontal"
    expected: "Bulle animée (fade+slide 180ms entrée), contenu FR correct (avec pluriel 's' conditionnel), dismiss auto 2.5s, ne déborde jamais du container"
    why_human: "Positionnement dynamique, animation entrée/sortie, clamp Math.max/min au bord d'écran"
  - test: "Tap sur le portail bas-droit (0.85/0.85) du village → fade cross-dissolve 400ms → retour sur la ferme ; tap du portail ferme → retour village → vérifier écran à opacité pleine (useFocusEffect reset P3)"
    expected: "Transition fade symétrique à l'aller Phase 28, haptic selection au tap, glow loop identique des deux côtés, aucun écran invisible après ping-pong"
    why_human: "Durée exacte 400ms, easing perception, symétrie visuelle portails, régression P3 invisible-screen"
  - test: "Header village : vérifier l'absence totale du bouton '‹' — seul le titre 'Place du Village' est visible ; le portail est le seul point de sortie"
    expected: "Pas de backBtn, pas de backArrow, pas de headerSpacer — header minimal avec uniquement le titre centré"
    why_human: "Validation UX D-19 'portail seul point de sortie' — confirmée en code mais à valider visuellement"
---

# Phase 29 : Avatars vivants + portail retour — Verification Report

**Phase Goal:** Peupler la carte village d'avatars par profil actif reflétant l'activité hebdo de chacun et refermer la boucle de navigation avec un portail retour symétrique à celui de la ferme.

**Verified:** 2026-04-11
**Status:** human_needed (code complet et TSC vert, 5 vérifications visuelles sur device requises)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria ROADMAP)

| # | Truth (REQ) | Status | Evidence |
|---|-------------|--------|----------|
| 1 | User voit un avatar par profil actif à un emplacement fixe (VILL-01) | ✓ VERIFIED (code) / ? HUMAN (visuel) | `lib/village/grid.ts:23-28` — 6 slots `village_avatar_slot_{0..5}` avec `role: 'avatar'`. `app/(tabs)/village.tsx:367-370` — `sortedActiveProfiles` tri `localeCompare` stable. `app/(tabs)/village.tsx:531-546` — render map × 6 avec `avatarSlots[idx]` déterministe |
| 2 | User distingue halo actif vs opacité inactive (VILL-02) | ✓ VERIFIED (code) / ? HUMAN (visuel) | `components/village/VillageAvatar.tsx:53-66` — `withRepeat(withTiming(HALO_MAX, {duration:2000}), -1, true)` sur `colors.success` si `isActive`, sinon `cancelAnimation` + opacity 0. `VillageAvatar.tsx:25,153-155` — `INACTIVE_OPACITY = 0.55`. `village.tsx:542` — `isActive={(weeklyContribs[profile.id] ?? 0) > 0}` |
| 3 | User tap → bulle auto-dismiss 2.5s (VILL-03) | ✓ VERIFIED (code) / ? HUMAN (visuel) | `components/village/AvatarTooltip.tsx:48-67` — entrée 180ms + `setTimeout(DISMISS_MS=2500)` + sortie 150ms avec `runOnJS(onDismiss)`. Copy FR conditionnelle lignes 82-85 avec pluriel. `village.tsx:418-440` — `dismissTimerRef` + cleanup unmount |
| 4 | User revient à la ferme via portail symétrique (VILL-11) | ✓ VERIFIED (code) / ? HUMAN (visuel) | `components/village/PortalSprite.tsx` — composant partagé exportant le même sprite `portail.png` consommé par `tree.tsx:2072` et `village.tsx:562`. `grid.ts:31` — `village_portal_home` à (0.85, 0.85). `village.tsx:494-507` — header sans `backBtn` (portail seul point de sortie per D-19) |
| 5 | User voit fade cross-dissolve Reanimated 400ms symétrique (VILL-12) | ✓ VERIFIED (code) / ? HUMAN (perception) | `village.tsx:391-399` — `withTiming(0, {duration: 400, easing: Easing.out(Easing.ease)})` + `runOnJS(router.replace)('/(tabs)/tree')`. Identique en durée/easing à `tree.tsx:354-362` (aller). `village.tsx:403-407` — `useFocusEffect` reset `screenOpacity.value = 1` (Pitfall P3 mitigé) |

**Score:** 5/5 truths verified par analyse code statique ; 5 éléments visuels routés vers human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/village/types.ts` | VillageRole étendu avec 'avatar' | ✓ VERIFIED | Ligne 7 : `'fountain' \| 'stall' \| 'board' \| 'portal' \| 'avatar'` — commentaire FR Phase 29 ligne 5 |
| `lib/village/grid.ts` | VILLAGE_GRID 6 slots avatar + portal_home | ✓ VERIFIED | 11 entrées totales : 4 existantes + 6 avatars + 1 portail retour. Slot `village_portal_home` à (0.85, 0.85) ligne 31 |
| `lib/mascot/companion-sprites.ts` | COMPANION_SPRITES mapping partagé | ✓ VERIFIED | 5 espèces × 3 stages × 2 frames = 30 `require()`. Importé dans CompanionSlot.tsx:24 ET VillageAvatar.tsx:17 (DRY consommé double) |
| `components/village/VillageAvatar.tsx` | Sprite + halo + Pressable | ✓ VERIFIED | React.memo, alternance idle_1/idle_2 via setTimeout 500ms, early return si `!profile.companion` (D-03), Pressable + Haptics, hitSlop 8px |
| `components/village/AvatarTooltip.tsx` | Tooltip auto-dismiss 2.5s | ✓ VERIFIED | Reanimated withTiming entrée/sortie, `setTimeout` 2500ms, clamp horizontal `Math.max/min` (Pitfall 6) ligne 74-79 |
| `components/village/PortalSprite.tsx` | Portail partagé glow + spring | ✓ VERIFIED | Mode dual (overlay via x/y OU diorama ferme par fallback `bottom/right`). `require('../../assets/items/portail.png')` ligne 114. SPRING_PORTAL constante module ligne 21 |
| `app/(tabs)/village.tsx` | Overlay + tooltip state + handleReturnPortalPress | ✓ VERIFIED | Imports `VillageAvatar`, `AvatarTooltip`, `PortalSprite`, `useFocusEffect`, `Easing`. `weeklyContribs`/`sortedActiveProfiles`/`avatarSlots`/`portalSlot` memos présents. Root `<Animated.View>` avec fadeStyle |
| `app/(tabs)/tree.tsx` | Import PortalSprite partagé, suppression locale | ✓ VERIFIED | Import ligne 76, usage ligne 2072. Aucune déclaration locale `function PortalSprite`, aucun `portalContainer`/`portalGlow`/`portalEmoji` résiduel (grep 0 match) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `VillageAvatar.tsx` | `companion-sprites.ts` | import COMPANION_SPRITES | ✓ WIRED | Ligne 17 import + ligne 81 usage `COMPANION_SPRITES[species][stage]` |
| `VillageAvatar.tsx` | `companion-engine.ts` | getCompanionStage(profile.level) | ✓ WIRED | Ligne 16 import + ligne 80 usage |
| `village.tsx` | `VillageAvatar.tsx` | import + render × 6 | ✓ WIRED | Ligne 53 import, lignes 531-546 render map `sortedActiveProfiles.slice(0, 6)` |
| `village.tsx` | `useGarden` | gardenData.contributions + currentWeekStart filter | ✓ WIRED | `weeklyContribs` memo lignes 352-364 avec comparaison string ISO `c.timestamp >= weekStart` |
| `PortalSprite.tsx` | `assets/items/portail.png` | require('../../assets/items/portail.png') | ✓ WIRED | Ligne 114 + asset confirmé (178.9 KB) |
| `tree.tsx` | `PortalSprite.tsx` | import partagé | ✓ WIRED | Ligne 76 import + ligne 2072 `<PortalSprite onPress={handlePortalPress} />` (fallback mode ferme diorama) |
| `village.tsx` | `PortalSprite.tsx` | import + render prop x/y slot | ✓ WIRED | Ligne 55 import + ligne 562-567 render avec `portalSlot.x * mapSize.width`, `portalSlot.y * mapSize.height` |
| `village.tsx` | `router.replace` | runOnJS(router.replace) dans withTiming callback | ✓ WIRED | Ligne 396 `if (finished) runOnJS(router.replace)('/(tabs)/tree' as any)` |
| `CompanionSlot.tsx` | `companion-sprites.ts` | import partagé (refactor) | ✓ WIRED | Ligne 24 import + ligne 681 usage (déclaration locale supprimée) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `VillageAvatar.tsx` | `profile.companion` | `sortedActiveProfiles` ← `activeProfiles` ← `profiles` ← `useVault()` | ✓ Oui (VaultContext) | ✓ FLOWING |
| `VillageAvatar.tsx` | `isActive` (boolean) | `weeklyContribs[profile.id] > 0` ← `gardenData.contributions` ← `useGarden()` | ✓ Oui (parser village data) | ✓ FLOWING |
| `VillageAvatar.tsx` | sprite (currentSprite) | `COMPANION_SPRITES[species][stage]` via `profile.companion.activeSpecies` + `getCompanionStage(profile.level)` | ✓ Oui (30 require statiques) | ✓ FLOWING |
| `AvatarTooltip.tsx` | `count` | `weeklyContribs[profile.id] ?? 0` passé via `handleAvatarPress` | ✓ Oui | ✓ FLOWING |
| `PortalSprite.tsx` (village) | `x, y` | `portalSlot.x * mapSize.width`, `portalSlot.y * mapSize.height` ← `VILLAGE_GRID` filter | ✓ Oui (constante + onLayout) | ✓ FLOWING |
| Fade transition | `screenOpacity` | `useSharedValue(1)` + `withTiming(0, 400ms)` → `runOnJS(router.replace)` | ✓ Oui (Reanimated worklet) | ✓ FLOWING |

Aucun artefact HOLLOW détecté. Le flow de données est complet : VaultContext → useVault → profiles → sortedActiveProfiles → slice(0,6).map → VillageAvatar props → sprite rendu.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation pass (no new errors) | `npx tsc --noEmit 2>&1 \| grep -v '(MemoryEditor\|cooklang\|useVault)' \| grep 'error TS'` | Empty output (exit 1 from grep) | ✓ PASS |
| Asset portail.png present | `ls assets/items/portail.png` | 178.9K file found | ✓ PASS |
| 6 avatar slots in VILLAGE_GRID | Read grid.ts lines 23-28 | 6 entries `village_avatar_slot_{0..5}` | ✓ PASS |
| Portal home slot present | Read grid.ts line 31 | `village_portal_home` role `'portal'` | ✓ PASS |
| No RN Animated import (reanimated only) | Grep `Animated` imports in components/village | All imports `from 'react-native-reanimated'` | ✓ PASS |
| No emoji 🏛️ pour portail ferme | Grep `🏛️` in tree.tsx | 1 match ligne 2126 (actionItemIcon non-portail — unrelated) | ✓ PASS |
| No orphaned portal styles in tree.tsx | Grep `portalContainer\|portalGlow\|portalEmoji` | 0 matches | ✓ PASS |
| No backBtn/backArrow in village.tsx | Grep `backBtn\|backArrow\|headerSpacer` | 0 matches | ✓ PASS |
| Running the app in simulator to validate animations | (skipped — requires device) | N/A | ? SKIP (routed to human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VILL-01 | 29-PLAN-01 | Avatar par profil positionné fixe sur carte village | ✓ SATISFIED (code) | 6 slots + tri alphabétique + render map |
| VILL-02 | 29-PLAN-01 | Indicateur visuel contribué cette semaine vs inactif | ✓ SATISFIED (code) | Halo pulse colors.success + opacity 0.55 |
| VILL-03 | 29-PLAN-01 | Tap → bulle "[Prénom] — X contributions cette semaine" auto-dismiss | ✓ SATISFIED (code) | Tooltip FR conditionnel + setTimeout 2.5s + cleanup |
| VILL-11 | 29-PLAN-02 | Portail retour village → ferme visuel symétrique | ✓ SATISFIED (code) | PortalSprite partagé + slot + suppression backBtn |
| VILL-12 | 29-PLAN-02 | Fade cross-dissolve Reanimated ~400ms cohérent avec aller | ✓ SATISFIED (code) | withTiming 400ms Easing.out + useFocusEffect reset + runOnJS |

Tous les REQ-IDs sont cochés dans `REQUIREMENTS.md` (lignes 13-15 et 35-36) et mappés à Phase 29 (lignes 60-62, 70-71). Note : le tableau de mapping lignes 60-71 affiche toujours le status `Pending` — à mettre à jour en `Done` lors du `/ship`. Ce n'est pas un gap verification.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

Aucun anti-pattern détecté dans les fichiers modifiés Phase 29. Scans effectués :
- TODO/FIXME/PLACEHOLDER/"not yet implemented" → 0 matches dans `components/village/`
- `return null` suspicieux → VillageAvatar.tsx:77 est un early return légitime (D-03 skip silencieux profil sans companion), pas un stub
- Empty handlers → 0 détectés
- `Animated` RN (hors reanimated) → 0 détectés
- Hardcoded colors → uniquement `shadowColor: '#000'` dans AvatarTooltip.tsx:122 (exception documentée CLAUDE.md)
- Hex colors hors tokens → aucun
- `rgba(0,0,0,0.55)` et `rgba(255,255,255,0.7)` dans village.tsx:502 → pré-existants header (hors scope Phase 29)

### Pitfalls Mitigation Verification

| Pitfall | Mitigation | Status |
|---------|-----------|--------|
| P1 — Overlay children vs siblings | Avatars + tooltip + portail rendus comme siblings du `TileMapRenderer` (pointerEvents none) dans `styles.mapContainer` | ✓ MITIGATED (village.tsx:522-568) |
| P3 — useFocusEffect reset screenOpacity | `useFocusEffect(useCallback(() => { screenOpacity.value = 1 }, [...]))` ajouté | ✓ MITIGATED (village.tsx:403-407) |
| P4 — dismissTimer cleanup | `dismissTimerRef` avec clearTimeout au nouveau tap ET unmount `useEffect` | ✓ MITIGATED (village.tsx:420-440) |
| P5 — currentWeekStart ISO string comparison | `c.timestamp >= weekStart` lexicographique, zéro parsing Date | ✓ MITIGATED (village.tsx:359) |
| P6 — Tooltip clamp horizontal | `Math.max(Spacing.md, Math.min(containerWidth - MAX_WIDTH - Spacing.md, rawLeft))` | ✓ MITIGATED (AvatarTooltip.tsx:75-79) |
| P7 — portalEmoji cleanup | Styles `portalContainer`/`portalGlow`/`portalEmoji` supprimés de tree.tsx (grep 0) | ✓ MITIGATED |
| P8 — cancelAnimation | `cancelAnimation(haloOpacity)` sur transition active→inactive + cleanup useEffect | ✓ MITIGATED (VillageAvatar.tsx:62,65) |

### Locked Decisions Verification (spot-check)

| Décision | Attendu | Appliqué | Status |
|---|---|---|---|
| D-01 | Sprites pixel art (pas emoji) | `<Animated.Image>` + `COMPANION_SPRITES` | ✓ |
| D-02 | Composant dédié `VillageAvatar` (pas ReactiveAvatar) | `components/village/VillageAvatar.tsx` créé | ✓ |
| D-10 | Halo colors.success pulse ~2s withRepeat | `HALO_DURATION=2000`, `withRepeat(..., -1, true)` | ✓ |
| D-18 | Slot `village_portal_home` role `'portal'` | Ligne 31 grid.ts (0.85, 0.85) | ✓ |
| D-21 | withTiming 400ms Easing.out + runOnJS router.replace | village.tsx:392-398 | ✓ |
| D-22 | useFocusEffect reset screenOpacity | village.tsx:403-407 | ✓ |
| D-23 | router.replace (pas push) côté retour | village.tsx:396 | ✓ |

### Human Verification Required

Voir section YAML frontmatter `human_verification` — 5 tests visuels device requis :
1. Rendu pixel art avatars + positionnement stable déterministe
2. Halo pulse animation colors.success + opacity inactive
3. Bulle tooltip position + clamp horizontal + pluriel FR
4. Fade cross-dissolve 400ms ping-pong ferme ↔ village
5. Header épuré sans backBtn

### Gaps Summary

**Aucun gap bloquant détecté en analyse statique.** Les 5 success criteria (VILL-01/02/03/11/12) sont couverts au niveau code avec :
- Artifacts : 7/7 présents et substantiels
- Key links : 9/9 wired (imports + renders + navigation + data flow)
- Data flow : 6/6 flowing (VaultContext → profiles → sprites)
- TSC : passe sans nouvelle erreur
- Anti-patterns : 0 détectés
- Pitfalls : 7/7 mitigés
- Locked decisions : 7/7 spot-checks conformes

Les 5 vérifications humaines restantes concernent **la perception visuelle** (rendu pixel art, animations temps réel, perception de durée 400ms, symétrie visuelle) qui ne sont pas testables programmatiquement sans exécuter l'app sur device. Ce statut `human_needed` est attendu pour un phase UI-centric comme la 29, et ne constitue pas un blocker de la livraison code.

**Recommandation :** après validation visuelle sur device (`npx expo run:ios --device`), passer le statut VILL-01/02/03/11/12 de `Pending` → `Done` dans REQUIREMENTS.md:60-71 lors du `/ship`.

---

_Verified: 2026-04-11_
_Verifier: Claude (gsd-verifier)_
