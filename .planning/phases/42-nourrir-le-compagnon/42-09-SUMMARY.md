---
phase: 42-nourrir-le-compagnon
plan: 09
subsystem: mascot-companion-feedback
tags: [companion, feed, message, live-activity, lock-screen, hook]
requirements: [FEED-17, FEED-18]
dependency-graph:
  requires:
    - "Plan 42-07 (feedCompanion hook transaction single-file)"
    - "Plan 42-03 (FeedResult + affinity/newBuff)"
  provides:
    - "buildFeedMessage helper pur (D-21 — 4 variantes)"
    - "MascotteSnapshot.feedBuffActive + buildFeedSpeechBubble override ≤44 chars (D-22/D-23)"
    - "Wiring hook feedCompanion → push message SecureStore + patchMascotte Live Activity (D-24)"
  affects:
    - "lib/mascot/companion-engine.ts — +38 lignes (buildFeedMessage)"
    - "lib/mascotte-live-activity.ts — +25 lignes (feedBuffActive + buildFeedSpeechBubble + override)"
    - "hooks/useVault.ts — +33 lignes (imports + wiring post-écriture)"
    - "lib/__tests__/companion-feed.test.ts — +20 lignes (4 tests buildFeedMessage)"
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget side-effects après écriture vault réussie (try/catch silencieux)"
    - "Option A Live Activity : patchMascotte(Partial<MascotteSnapshot>) accepte feedBuffActive automatiquement — aucune extension signature"
    - "speechBubble override centralisé dans startMascotte + refreshMascotte (cohérence lastSnapshot)"
    - "Message contextualisé par (affinity, grade) avec fallback label depuis labelKey i18n"
key-files:
  created:
    - ".planning/phases/42-nourrir-le-compagnon/42-09-SUMMARY.md"
  modified:
    - "lib/mascot/companion-engine.ts"
    - "lib/mascotte-live-activity.ts"
    - "hooks/useVault.ts"
    - "lib/__tests__/companion-feed.test.ts"
decisions:
  - "Option A locked : patchMascotte signature Partial<MascotteSnapshot> inchangée — feedBuffActive devient acceptée automatiquement par ajout à l'interface (zéro extension signature)"
  - "Wiring centralisé dans hooks/useVault.ts:feedCompanion — tree.tsx ne touche ni au message ni à patchMascotte — élimine overlap Plan 42-08"
  - "speechBubble override appliqué dans startMascotte ET refreshMascotte pour cohérence lastSnapshot (évite bulle stale quand resume depuis background)"
  - "cropLabel fallback via labelKey.replace(/^farm.crop./, '') — évite dépendance i18n dans le hook, lisible en FR sur les crops anglais"
  - "Ring buffer 5 messages géré côté appelant (slice(-5)) + encore côté saveCompanionMessages (D-02) — double garde sans coût"
metrics:
  duration: "~8min"
  completed: "2026-04-22"
  tasks: 3
  commits: 3
  lines_added: 116
---

# Phase 42 Plan 09 : Messages feed + Live Activity speechBubble boost Summary

Dernier maillon de la boucle feed : message contextualisé après feed (D-21, 4 variantes selon affinity+grade) et Live Activity `speechBubble` overridée en "Boosté ! +X% XP ⚡ (Ymin)" quand un buff est actif (D-22/D-23/D-24). Tout le wiring vit dans `hooks/useVault.ts:feedCompanion` — zéro modif tree.tsx, overlap Plan 42-08 éliminé.

## Objectif livré

- **D-21** : `buildFeedMessage({ affinity, grade, cropLabel, cropEmoji })` — 4 variantes (preferred+perfect, preferred, neutral, hated)
- **D-22** : `MascotteSnapshot.feedBuffActive?: { multiplier, expiresAtIso } | null`
- **D-23** : `buildFeedSpeechBubble()` retourne label ≤44 chars format "Boosté ! +15% XP ⚡ (90min)"
- **D-24** : `refreshMascotte` appelé immédiatement via `patchMascotte` dans le hook
- **D-25** : Override via `speechBubble` existante (pas de champ natif dédié v1 — MVP)

## Stratégie Option A locked

La signature existante de `patchMascotte(patch: Partial<MascotteSnapshot>)` L131 accepte déjà toute clé de `MascotteSnapshot`. Ajout de `feedBuffActive` à l'interface (1 ligne) suffit à l'accepter comme patch — **aucune extension de signature nécessaire**. Option B (fallback runtime tree.tsx) supprimée.

## Résolution overlap Plan 42-08 / 42-09

| Fichier                          | Plan 42-08 | Plan 42-09 | Conflit ? |
| -------------------------------- | ---------- | ---------- | --------- |
| `components/mascot/CompanionSlot.tsx` | ✅ (anim eat) | — | Non |
| `app/(tabs)/tree.tsx`                | ✅ (particules) | — | **Non** (09 ne touche pas) |
| `lib/mascot/companion-engine.ts`     | — | ✅ (buildFeedMessage) | Non |
| `lib/mascotte-live-activity.ts`      | — | ✅ (feedBuffActive) | Non |
| `hooks/useVault.ts`                  | — | ✅ (wiring) | Non |

Branches d'édition disjointes → exécution parallèle safe.

## Wiring post-écriture farm-{id}.md

```
feedCompanionEngine → applied ? →
  writeFile(farm-{id}.md) →
  setProfiles(...) →
  try { push companion_messages[feed_{affinity}] } catch {} →
  try { patchMascotte({ feedBuffActive: result.newBuff ? {...} : null }) } catch {} →
  return result
```

Les 2 `try/catch` silencieux garantissent qu'un échec SecureStore ou module natif iOS ne casse pas feedCompanion — la transaction vault (source de vérité) est déjà commit.

## Variantes messages (D-21)

| Affinity | Grade | Template |
|----------|-------|----------|
| preferred | perfect | `{emoji} ✨ Ma {label} préférée en version parfaite ! Je t'adore !` |
| preferred | autre | `{emoji} Mmm ma préférée, merci !` |
| neutral | tout | `{emoji} Merci, c'était bon.` |
| hated | tout | `😖 Berk… je déteste ça.` (pas d'emoji crop — compagnon recule) |

## Format speechBubble (D-23)

```typescript
buildFeedSpeechBubble({ multiplier: 1.495, expiresAtIso: '+90min' })
// → "Boosté ! +50% XP ⚡ (90min)"  (25 chars, <44)
```

Truncate à 44 chars si marge dépassée (sécurité) — le format naturel reste sous la limite pour toutes les combinaisons grades×affinités du mapping D-05/D-06.

## Commits

| # | Hash    | Message                                                                    |
|---|---------|----------------------------------------------------------------------------|
| 1 | cec6d36 | feat(42-09): buildFeedMessage helper contextualisé après feed              |
| 2 | e458d5c | feat(42-09): MascotteSnapshot.feedBuffActive + buildFeedSpeechBubble override |
| 3 | c463416 | feat(42-09): wiring feed message + live activity dans feedCompanion hook   |

## Verification

- `grep -q "export function buildFeedMessage" lib/mascot/companion-engine.ts` — OK
- `grep -q "feedBuffActive" lib/mascotte-live-activity.ts` — OK
- `grep -q "export function buildFeedSpeechBubble" lib/mascotte-live-activity.ts` — OK
- `grep -c "effectiveBubble" lib/mascotte-live-activity.ts` → 4 (startMascotte + refreshMascotte)
- `patchMascotte(patch: Partial<MascotteSnapshot>)` inchangé — 1 match
- `grep -q "buildFeedMessage\|patchMascotte\|saveCompanionMessages\|CROP_CATALOG\|feedBuffActive" hooks/useVault.ts` — OK
- `grep -c "buildFeedMessage\|feedBuffActive" app/(tabs)/tree.tsx` → **0** (wiring PAS dans tree.tsx, overlap évité)
- `npx jest lib/__tests__/companion-feed.test.ts --no-coverage` → **30/30 pass**
- `npx tsc --noEmit` — clean, aucune nouvelle erreur

## Phase 42 — Récap décisions (D-01..D-31)

| Décision | Plan | Task |
|----------|------|------|
| D-01 (2 entry points) | 42-07 | tree.tsx chip + long press |
| D-02 (sheet picker) | 42-06 | FeedPicker component |
| D-03 (hated visible) | 42-06 | FeedPicker mapping affinity |
| D-04 (preferred tri) | 42-06 | FeedPicker sort |
| D-05/D-06 (mul+durée+affinity) | 42-03 | getBuffForCrop |
| D-07 (stacking XP) | 42-03 | getCompanionXpBonus |
| D-08 (XP only) | 42-03 | Portée buff |
| D-09 (1 seul buff) | 42-03 | feedCompanion replace |
| D-10 (cooldown 3h) | 42-03 | getCooldownRemainingMs |
| D-11 (bouton rassasié) | 42-05 | CompanionCard UI |
| D-12 (buff expire avant cooldown) | 42-03 | isBuffActive lazy |
| D-13 (affinités figées) | 42-02 | COMPANION_PREFERENCES |
| D-13-bis (fish/bone deferred) | v1.8+ | — |
| D-14 (1 préféré v1) | 42-02 | mapping |
| D-15 (lastFedAt + feedBuff) | 42-02 | CompanionData shape |
| D-16 (non-cassant) | 42-02 | champs optionnels |
| D-17 (CACHE_VERSION) | 42-01 | vault-cache bump |
| D-18 (anim manger) | 42-08 | CompanionSlot eat frames |
| D-19 (particules) | 42-08 | tree.tsx particules |
| D-20 (haptics) | 42-07 | handleFeedCrop |
| **D-21 (messages)** | **42-09** | **Task 1 buildFeedMessage** |
| **D-22 (feedBuffActive)** | **42-09** | **Task 2 MascotteSnapshot** |
| **D-23 (speechBubble ≤44)** | **42-09** | **Task 2 buildFeedSpeechBubble** |
| **D-24 (refresh immédiat)** | **42-09** | **Task 3 patchMascotte** |
| **D-25 (via speechBubble MVP)** | **42-09** | **Task 2 override** |
| D-26 (CompanionCard) | 42-05 | composant |
| D-27 (SpeciesPicker sous-composant) | 42-05 | refonte |
| D-28 (CompanionCard dans tree) | 42-07 | tree.tsx chip redirect |
| D-29 (tap long sprite) | 42-07 | CompanionSlot onLongPress |
| D-30 (parser étendu) | 42-02 | parseProfile frontmatter |
| D-31 (sérialisation) | 42-02 | serializeProfile |

**31/31 décisions couvertes.**

## Deviations from Plan

Aucune — plan exécuté exactement comme écrit. Option A lock résolue au planning, exécution directe.

## Known Stubs

Aucun — boucle UX Phase 42 complète end-to-end :

1. Bouton "Nourrir" → picker crops (grades + affinités)
2. Tap crop → feedCompanion hook : transaction single-file (companion + harvestInventory)
3. Anim manger + particules + haptics (Plan 08)
4. Message contextualisé push SecureStore (Plan 09)
5. Live Activity lock screen : "Boosté ! +X% XP ⚡ (Ymin)" (Plan 09)

## Phase 42 — Flag shippable

**Phase 42 livrable sur TestFlight** : oui.

- Non-cassant : champs CompanionData optionnels, parser tolérant, pas de migration
- CACHE_VERSION bumpé Plan 42-01 — anciens caches invalidés proprement
- Fire-and-forget sur side-effects non-critiques
- Module natif iOS inchangé (D-25 MVP via speechBubble existante)
- 30/30 tests Jest pass
- `npx tsc --noEmit` clean

## Résultat Jest final Phase 42

```
lib/__tests__/companion-feed.test.ts : 30 tests
  - getAffinity : 3
  - getBuffForCrop : 3
  - isBuffActive : 3
  - getCooldownRemainingMs : 3
  - feedCompanion : 5
  - getActiveFeedBuff : 3
  - getCompanionXpBonus stacking : 6
  - buildFeedMessage (Plan 09) : 4
Total: 30 passed
```

## Liens SUMMARYs précédents

- [Plan 42-01](./42-01-SUMMARY.md) — CompanionData shape + CACHE_VERSION
- [Plan 42-02](./42-02-SUMMARY.md) — parseProfile/serializeProfile feedBuff
- [Plan 42-03](./42-03-SUMMARY.md) — feedCompanion engine pur + buffs
- [Plan 42-04](./42-04-SUMMARY.md) — COMPANION_PREFERENCES mapping
- [Plan 42-05](./42-05-SUMMARY.md) — CompanionCard component
- [Plan 42-06](./42-06-SUMMARY.md) — FeedPicker grades EN↔FR
- [Plan 42-07](./42-07-SUMMARY.md) — useVault feedCompanion transaction
- [Plan 42-08](./42-08-SUMMARY.md) — anim manger + particules tree.tsx
- **Plan 42-09 (this)** — messages + Live Activity

## Self-Check: PASSED

- FOUND: lib/mascot/companion-engine.ts:buildFeedMessage (grep OK)
- FOUND: lib/mascotte-live-activity.ts:feedBuffActive + buildFeedSpeechBubble (grep OK)
- FOUND: hooks/useVault.ts:buildFeedMessage + patchMascotte feedBuffActive (grep OK)
- FOUND: commit cec6d36 (Task 1)
- FOUND: commit e458d5c (Task 2)
- FOUND: commit c463416 (Task 3)
- VERIFIED: tree.tsx INCHANGÉ (grep count 0 pour buildFeedMessage + feedBuffActive)
- VERIFIED: 30/30 Jest pass, npx tsc --noEmit clean
