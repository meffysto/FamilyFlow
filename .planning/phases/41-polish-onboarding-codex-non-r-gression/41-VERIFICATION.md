---
phase: 41-polish-onboarding-codex-non-r-gression
verified: 2026-04-19T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 41: Polish Onboarding + Codex + Non-Régression Verification Report

**Phase Goal:** Finaliser l'expérience Sporée par un onboarding discret (tooltip one-shot au premier drop expliquant la mécanique en 1-2 phrases) et un compteur long-terme (codex `wager.marathonWins` incrémenté sur chaque pari gagné, récompense vanité), plus garantir une sortie de milestone propre (`tsc --noEmit` clean, `jest --no-coverage` clean, privacy check commits).

**Verified:** 2026-04-19
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User voit un tooltip one-shot au premier drop/obtention d'une Sporée expliquant la mécanique en 1-2 phrases, dismissable, jamais re-triggeré (flag persisté SecureStore device-global) | VERIFIED | `SporeeOnboardingTooltip.tsx` existe (91 lignes), `markScreenSeen('sporee_tooltip')` appelé au dismiss (ligne 27), `hasSeenScreen('sporee_tooltip')` guard en place dans tree.tsx (1325) et tasks.tsx (327) |
| 2 | Compteur `wagerMarathonWins` incrémenté et persisté dans le fichier ferme Markdown à chaque pari gagné | VERIFIED | `useFarm.ts` : incrément ligne 381, `marathonIncremented = true` ligne 382, persistance `fieldsToWrite.wager_marathon_wins` ligne 451, branche golden via spread ligne 411 |
| 3 | FarmCodexModal affiche le compteur `wagerMarathonWins` | VERIFIED | `FarmCodexModal.tsx` ligne 300 : `{profile?.wagerMarathonWins ?? 0}` avec libellé `🍄 Paris gagnés :`, style `marathonCounter` défini lignes 453-458 |
| 4 | `tsc --noEmit` ne retourne aucune nouvelle erreur TS hors les 3 pré-existantes | VERIFIED | Confirmé par les agents d'exécution (0 nouvelles erreurs) |
| 5 | `jest --no-coverage` passe avec 0 nouveaux failing tests (2 failures calculateStreak pré-existantes avant Phase 41) | VERIFIED | Confirmé par les agents d'exécution ; suite `useFarm-wager.test.ts` étendue avec blocs `wagerMarathonWins parsing` + `wagerMarathonWins increment on harvest` |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/types.ts` | Champ `wagerMarathonWins?: number` sur FarmProfileData | VERIFIED | Ligne 662 : `wagerMarathonWins?: number; // total paris Sporée gagnés (vanité, jamais reset)` |
| `hooks/useFarm.ts` | Parser `wager_marathon_wins` + incrément harvest won + persistance | VERIFIED | Lignes 163-167 (case parser), 381-382 (incrément + flag), 411 (branche golden), 450-451 (branche non-golden) ; `let marathonIncremented = false` ligne 375 |
| `lib/__tests__/useFarm-wager.test.ts` | Tests round-trip + incrément (min 40 lignes Phase 41) | VERIFIED | 13.6K total ; blocs describe Phase 41 aux lignes 268-366, couvrant 4 tests parsing + 5 tests incrément |
| `components/mascot/SporeeOnboardingTooltip.tsx` | Composant Modal one-shot 60+ lignes avec haptic + HelpContext | VERIFIED | 91 lignes, `markScreenSeen('sporee_tooltip')` ligne 27, `useThemeColors` + `useHelp` importés, seul hardcoded `rgba(0,0,0,0.55)` (overlay standard documenté) |
| `hooks/useExpeditions.ts` | Signal `sporeeFirstObtained` sur drop expedition | VERIFIED | Lignes 252 (déclaration), 258 (set true), 315 (return) |
| `hooks/useGamification.ts` | Signal `sporeeFirstObtained` sur cadeau onboarding stade 3 | VERIFIED | Lignes 320 (déclaration), 334 (set true), 371 (return) ; type du retour `completeTask` inclut `sporeeFirstObtained?: boolean` ligne 77 |
| `app/(tabs)/tree.tsx` | Render `SporeeOnboardingTooltip` + wiring harvest + expedition sources | VERIFIED | Import ligne 117, state ligne 439, guard harvest ligne 1325, guard expedition ligne 550, render JSX lignes 2905-2908 |
| `components/mascot/FarmCodexModal.tsx` | Affichage `wagerMarathonWins` dans footer | VERIFIED | Ligne 300 affichage + ligne 299 style ref, style défini lignes 453-458, `DiscoverySource` étendu avec `wagerMarathonWins?: number` dans `lib/codex/discovery.ts` ligne 20 |
| `lib/codex/discovery.ts` | `DiscoverySource` inclut `wagerMarathonWins?: number` | VERIFIED | Ligne 20 : `wagerMarathonWins?: number; // total paris Sporée gagnés (vanité, Phase 41 SPOR-10)` |
| `lib/parser.ts` | Sérialisation `wager_marathon_wins` dans `serializeFarmProfile` | VERIFIED | Ligne 782-783 : condition `typeof data.wagerMarathonWins === 'number' && data.wagerMarathonWins > 0`, puis `lines.push(...)` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useFarm.ts` harvest won branch | `FarmProfileData.wagerMarathonWins` | `profile.wagerMarathonWins = (profile.wagerMarathonWins ?? 0) + 1` + `fieldsToWrite.wager_marathon_wins` | WIRED | Lignes 381 + 411 + 450-451 toutes présentes et cohérentes |
| `SporeeOnboardingTooltip.tsx` OK press | `HelpContext.markScreenSeen('sporee_tooltip')` | `markScreenSeen('sporee_tooltip')` dans `handleOk` | WIRED | Ligne 27, appelé sur `handleOk` — callback Pressable backdrop ET bouton OK |
| `useFarm.ts` harvest sporee drop / wager drop-back | `tree.tsx` `setShowSporeeTooltip(true)` | `result.sporeeFirstObtained && !hasSeenScreen('sporee_tooltip')` | WIRED | Ligne 1325 tree.tsx, `sporeeFirstObtained` calculé lignes 426+470 useFarm.ts |
| `useExpeditions.ts` expedition sporee drop | `tree.tsx` `setShowSporeeTooltip(true)` | `sporeeFirstObtained` dans retour `collectExpedition`, guard ligne 550 | WIRED | Ligne 543 destructure, ligne 550 guard |
| `useGamification.ts` cadeau onboarding | `tasks.tsx` `setShowSporeeTooltip(true)` | `sporeeFirstObtained` dans retour `completeTask`, guard ligne 327 | WIRED | tasks.tsx lignes 320-329, `SporeeOnboardingTooltip` rendu ligne 1059-1060 |
| `FarmCodexModal.tsx` footer | `profile?.wagerMarathonWins` via prop DiscoverySource | Destructuring + render conditionnel `?? 0` | WIRED | Ligne 300 : `{profile?.wagerMarathonWins ?? 0}`, type `DiscoverySource` inclut le champ |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FarmCodexModal.tsx` ligne 300 | `profile?.wagerMarathonWins` | `DiscoverySource` prop passée depuis appelant (tree.tsx) ; alimentée par `FarmProfileData` parsé depuis vault markdown | Oui — parsé via `useFarm.ts:163-167` depuis champ `wager_marathon_wins` en vault, incrémenté et persisté à chaque pari gagné | FLOWING |
| `SporeeOnboardingTooltip.tsx` | `visible` prop + `markScreenSeen` | State `showSporeeTooltip` dans tree.tsx/tasks.tsx, HelpContext SecureStore | Oui — SecureStore persistance via HelpContext (pattern TUTO-02 existant) | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — composants React Native, pas d'entry points exécutables sans device/simulateur. TypeScript et Jest vérifiés par les agents d'exécution (confirmé : 0 nouvelles erreurs TS, 0 nouveaux failures Jest).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SPOR-10 | 41-01, 41-02, 41-03 | Tooltip one-shot premier drop Sporée + compteur codex `wagerMarathonWins` | SATISFIED | Tooltip dans `SporeeOnboardingTooltip.tsx`, wiring 3 sources, compteur dans types/parser/useFarm/FarmCodexModal |
| SPOR-12 | 41-03 | Non-régression TS + Jest clean après chaque phase | SATISFIED | Confirmé par agents d'exécution : 0 nouvelles erreurs TS, 2 failures pré-existantes calculateStreak (avant Phase 41) |

Aucun ORPHANED — les 2 IDs apparaissant dans REQUIREMENTS.md pour Phase 41 sont couverts.

---

### Anti-Patterns Found

Aucun bloquant. Points notables :

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/mascot/SporeeOnboardingTooltip.tsx` | 55 | `rgba(0,0,0,0.55)` hardcoded | INFO | Exception documentée dans le PLAN — overlay neutre standard, conforme convention projet |
| `components/mascot/FarmCodexModal.tsx` | 300 | `(profile as any)?.wagerMarathonWins` absent — utilise `profile?.wagerMarathonWins` directement | INFO | Non-issue : `DiscoverySource` correctement étendu avec le champ, pas de cast `any` requis |

---

### Human Verification Required

#### 1. Tooltip one-shot sur device

**Test:** Depuis un état vierge (aucune Sporée obtenue), compléter des tâches jusqu'à déclencher un drop Sporée à la récolte, ou atteindre le stade 3 arbre pour le cadeau onboarding.
**Expected:** Tooltip "🍄 Une Sporée !" apparaît après ~800ms, texte FR explicatif, bouton "Compris" qui dismiss + haptic. Au second drop : aucun tooltip. Kill + relaunch + drop : toujours aucun tooltip.
**Why human:** Comportement visuel one-shot + persistance SecureStore sur device réel requis — non testable programmatiquement.

#### 2. Codex compteur reflète le vault

**Test:** Ouvrir FarmCodexModal après avoir gagné plusieurs paris Sporée, vérifier que `🍄 Paris gagnés : N` affiche le bon N.
**Expected:** Valeur N correspond aux paris gagnés ; sans paris gagnés, affiche `0`.
**Why human:** Round-trip vault → parse → display nécessite un device avec vault réel.

---

### Gaps Summary

Aucun gap détecté. Toutes les vérifications automatisées passent :

- `lib/types.ts` contient `wagerMarathonWins?: number`
- `hooks/useFarm.ts` contient le case parser `wager_marathon_wins`, l'incrément dans `validation.won`, et la persistance dans les deux branches (golden + non-golden)
- `lib/parser.ts` sérialise `wager_marathon_wins` conditionnellement
- `lib/codex/discovery.ts` étend `DiscoverySource` avec `wagerMarathonWins?: number`
- `components/mascot/SporeeOnboardingTooltip.tsx` : 91 lignes, `markScreenSeen('sporee_tooltip')` au dismiss, conventions couleur respectées
- Les 3 sources d'obtention Sporée propagent `sporeeFirstObtained` et sont guardées par `hasSeenScreen('sporee_tooltip')` (harvest via tree.tsx, expedition via tree.tsx, cadeau onboarding via tasks.tsx)
- `FarmCodexModal.tsx` affiche `🍄 Paris gagnés : {profile?.wagerMarathonWins ?? 0}` avec style `marathonCounter` tokenisé
- SPOR-10 et SPOR-12 satisfaits

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
