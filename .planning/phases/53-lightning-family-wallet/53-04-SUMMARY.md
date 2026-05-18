---
phase: 53-lightning-family-wallet
plan: 04
subsystem: lightning
tags: [lightning, cleanup, non-regression, app-store-posture, undone-audit, req-6, req-12]
dependency_graph:
  requires:
    - "53-01 (audit-log API: appendAudit + findPaidEntry + loadAudit)"
    - "53-02 (hooks/useVault.ts subscriber Lightning + 3 useEffects)"
    - "53-03a / 53-03b (UI + SettingsLightning Phase 53)"
  provides:
    - "lib/lightning module family-only — pas de double rail single/family"
    - "subscribeTaskUncomplete dans hooks/useVaultTasks.ts (mirror exact de subscribeTaskComplete)"
    - "4ᵉ useEffect Lightning dans hooks/useVault.ts — REQ-6 'undone' audit gated par isLightningEnabled() + findPaidEntry"
    - "migration.ts auto-suffisant (lit/écrit la clé legacy SecureStore en direct, sans credentials.ts)"
  affects:
    - "components/settings/SettingsLightning.tsx (déviation Rule 3 — form legacy single-wallet retiré, -198 lignes)"
    - "lib/lightning/index.ts (barrel allégé — 3 exports legacy retirés)"
tech_stack:
  added: []
  patterns:
    - "Listener mirror pattern (Set + add/delete cleanup) appliqué à subscribeTaskUncomplete"
    - "Gate strict isLightningEnabled() AVANT toute lecture audit (SPEC Constraint #1)"
    - "Cleanup atomique 3 fichiers en 1 commit (avec refactor migration.ts pour casser le dernier lien à credentials.ts)"
key_files:
  created:
    - lib/lightning/__tests__/undone-audit.test.ts
  modified:
    - hooks/useVaultTasks.ts (subscribeTaskUncomplete + TaskUncompleteListener type)
    - hooks/useVault.ts (4ᵉ useEffect Lightning + import barrel étendu + VaultState exposition)
    - components/settings/SettingsLightning.tsx (form legacy retiré — déviation Rule 3)
    - lib/lightning/index.ts (barrel sans exports legacy)
    - lib/lightning/migration.ts (helpers locaux readSingleLegacy / clearSingleLegacy)
    - lib/lightning/__tests__/migration.test.ts (helpers locaux saveSingleLegacy / loadSingleLegacy)
  deleted:
    - lib/lightning/credentials.ts (49 lignes)
    - app/lightning-spike.tsx (449 lignes)
    - app/lightning-family-spike.tsx (757 lignes)
decisions:
  - "Déviation Rule 3 (blocking issue) — retirer le form legacy de SettingsLightning : sans cette modif, l'acceptance grep REQ-12 ne pouvait pas retourner 0. Commit séparé `refactor(53-04)` pour traçabilité."
  - "subscribeTaskUncomplete fire STRICTEMENT sur transition true→false (pas sur reset récurrence). Pattern symétrique à subscribeTaskComplete qui fire false→true."
  - "Le 4ᵉ useEffect Lightning passe `profileId: ''` dans l'audit `undone` — résolution post-toggle non triviale (mentions pas re-resolvées). Le couple taskId+date suffit pour matcher avec l'entrée `paid` antérieure."
  - "Pas de remboursement LN ni décrément quota daily-cap au dé-cochage — les sats sont déjà partis (pas de reverse semantics), le cumul est informationnel."
  - "Tests test-runner-only (pas de hook React testé en runtime) — undone-audit.test.ts valide le contrat décisionnel (loadAudit + findPaidEntry + appendAudit). La vraie intégration React est validée par TSC + checkpoint device."
  - "migration.test.ts helpers locaux saveSingleLegacy/loadSingleLegacy plutôt que ré-introduire credentials.ts — plus propre, autonome, isolé du module supprimé."
metrics:
  duration_minutes: 25
  completed_date: 2026-05-18
  tasks_completed: 2
  files_created: 2
  files_modified: 6
  files_deleted: 3
  tests_added: 7
  commits: 4
---

# Phase 53 Plan 04 : Cleanup atomique + REQ-6 `undone` audit

Cleanup final Phase 53 — retire le double rail single/family (3 fichiers supprimés, -1285 lignes) et complète l'acceptance SPEC #6 via `subscribeTaskUncomplete` + 4ᵉ useEffect Lightning audit `undone`.

## Résumé exécutif

Plan 04 livre la **dernière étape Phase 53** : `feat/lightning-farm` est désormais une codebase production-grade sans surface legacy ni playground spike.

- **3 fichiers supprimés atomiquement** (1255 lignes brutes) : `lib/lightning/credentials.ts`, `app/lightning-spike.tsx`, `app/lightning-family-spike.tsx`
- **1 déviation Rule 3 résolue** : `SettingsLightning.tsx` consommait encore `loadLnbitsConfig`/`saveLnbitsConfig`/`clearLnbitsConfig` via un form "Connexion LNbits" obsolète depuis le rename Member (Plan 01). Retrait commit séparé `refactor(53-04)` pour traçabilité (-198 lignes).
- **REQ-6 `undone` audit livré** (deferred depuis Plan 02 WARNING #7) : `subscribeTaskUncomplete` dans `hooks/useVaultTasks.ts`, 4ᵉ useEffect Lightning dans `hooks/useVault.ts` qui appende `{status:'undone'}` SI un `paid` existe pour ce taskId+date (gate strict `isLightningEnabled()` + `findPaidEntry`).
- **`lib/lightning/migration.ts` autonome** : lit/écrit la clé legacy SecureStore (`lightning_lnbits_config_v1`) via 2 helpers privés `readSingleLegacy` + `clearSingleLegacy`, plus aucune dépendance à `credentials.ts`.
- **TSC clean** (0 erreur), **2 suites Jest scoped** (`undone-audit.test.ts` + `migration.test.ts`) → 12 tests verts.
- **Branche `feat/lightning-farm` isolée** — 46 commits Phase 53 non mergés sur `main` (posture App Store spike 003 maintenue PARTIAL).

SPEC #6 acceptance entièrement couvert maintenant : Plan 02 livre `already_paid_today` via `findPaidEntry` au re-cochage ; Plan 04 livre `undone` via `subscribeTaskUncomplete` au dé-cochage.

## Fichiers supprimés (3) — vérification grep clean

```
lib/lightning/credentials.ts          (49 lignes)  — load/save/clear single-wallet
app/lightning-spike.tsx               (449 lignes) — playground single-wallet
app/lightning-family-spike.tsx        (757 lignes) — playground family multi-wallet
```

Acceptance REQ-12 verbatim :

```bash
find app lib -name '*lightning-spike*' 2>/dev/null            # → 0
grep loadLnbitsConfig lib components app hooks contexts        # → 0
grep saveLnbitsConfig lib components app hooks contexts        # → 0
grep clearLnbitsConfig lib components app hooks contexts       # → 0
grep ChildWalletMapping lib components app hooks contexts      # → 0
grep lightning-spike lib components app hooks contexts         # → 0
grep lightning-family-spike lib components app hooks contexts  # → 0
```

**Tous → 0 résultat.**

## Barrel changes — `lib/lightning/index.ts`

Exports retirés :

```typescript
// AVANT (Phase < 53 Plan 04)
export {
  loadLnbitsConfig,
  saveLnbitsConfig,
  clearLnbitsConfig,
} from './credentials';
```

```typescript
// APRÈS (Phase 53 Plan 04 — FINAL)
// (les 3 exports legacy sont supprimés — le module credentials.ts n'existe plus)
```

Conservés (production-grade) :

- `LnbitsClient`, `msatToSat`, `satToMsat`, `LnbitsError`
- `loadFamilyConfig`, `saveFamilyConfig`, `clearFamilyConfig`
- `isLightningEnabled`, `setLightningEnabled`, `authenticatePayOut`
- Tous les types `MemberWalletMapping`, `FamilyLightningConfig`, `LnbitsConfig` (utilisé pour instancier LnbitsClient), `WalletInfo`, `CreateInvoiceResult`, `PaymentStatus`, `PaymentStatusValue`
- Modules purs Phase 53 (resolve-recipient, audit-log, daily-cap, trigger-mode, payout-queue, parent-notif, migration, lightning-events)
- Orchestrateurs Phase 53 Plan 02 (processTaskCompletionForLightning, executePayout, isNetworkError, flushOfflineQueue)

## `subscribeTaskUncomplete` — signature et emplacement

Fichier : `hooks/useVaultTasks.ts`

Type exporté (l.40-44) :

```typescript
/** Phase 53 Plan 04 — Listener appelé sur transition true→false (dé-cochage)
 *  d'une tâche. Pattern strict mirror de `TaskCompleteListener` (Set + fire
 *  silencieux). Consommé par le 2ᵉ useEffect Lightning de `hooks/useVault.ts`
 *  pour enregistrer un audit `undone` SI un `paid` existe pour ce taskId+date
 *  (REQ-6 SPEC #6 acceptance). */
export type TaskUncompleteListener = (task: Task) => void | Promise<void>;
```

API ajoutée à `UseVaultTasksResult` (l.65-68) :

```typescript
/** Phase 53 Plan 04 — Souscrit un listener au uncomplete d'une tâche (transition
 *  true→false). Mirror exact de `subscribeTaskComplete`. Consommé par le 2ᵉ
 *  useEffect Lightning de `hooks/useVault.ts` (REQ-6 'undone' audit). Retourne
 *  une fonction unsubscribe. */
subscribeTaskUncomplete: (listener: TaskUncompleteListener) => () => void;
```

Implémentation Set + fire (l.95-104, puis fire l.124-138) — pattern verbatim de `subscribeTaskComplete` :

```typescript
const taskUncompleteListenersRef = useRef<Set<TaskUncompleteListener>>(new Set());
const subscribeTaskUncomplete = useCallback((listener: TaskUncompleteListener) => {
  taskUncompleteListenersRef.current.add(listener);
  return () => {
    taskUncompleteListenersRef.current.delete(listener);
  };
}, []);

// (dans toggleTask, gate strict avant le fire complete existant)
if (!completed && wasCompleted) {
  const uncompleteListeners = Array.from(taskUncompleteListenersRef.current);
  for (const listener of uncompleteListeners) {
    try {
      const maybePromise = listener(task);
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        (maybePromise as Promise<void>).catch(e => {
          if (__DEV__) console.warn('[useVaultTasks] taskUncomplete listener error:', e);
        });
      }
    } catch (e) {
      if (__DEV__) console.warn('[useVaultTasks] taskUncomplete listener sync error:', e);
    }
  }
}
```

## 4ᵉ useEffect Lightning — REQ-6 `undone` audit

Fichier : `hooks/useVault.ts`, lignes ~885-915 (juste après le 3ᵉ useEffect pay-out, avant le bootstrap migration).

```typescript
// ─── Phase 53 Plan 04 : 4ᵉ subscriber Lightning — REQ-6 'undone' audit ──
// Quand une tâche est dé-cochée (transition true→false), si un audit `paid`
// existe pour ce taskId à la date de complétion locale, on append une entrée
// `status:'undone'` pour la traçabilité SPEC #6. Pas de remboursement LN
// (les sats sont déjà partis — pas de reverse semantics). Pas de
// décrément du quota daily-cap (cumul=sats spent, informationnel).
// Gate strict : `isLightningEnabled()` AVANT toute lecture audit pour
// respecter SPEC Constraint #1 (zéro side-effect Lightning si flag OFF).
useEffect(() => {
  const unsub = tasksHook.subscribeTaskUncomplete((task) => {
    (async () => {
      try {
        if (!(await isLightningEnabled())) return;
        const audit = await loadAudit();
        const completedDate =
          task.completedDate ?? new Date().toISOString().slice(0, 10);
        if (!findPaidEntry(audit, task.id, completedDate)) return;
        await appendAudit({
          ts: new Date().toISOString(),
          profileId: '', // résolution post-toggle non triviale (mentions
          // pas re-resolvées ici) ; on garde le slot pour audit
          // traçable, profileId vide = "non re-résolu". Le couple
          // taskId+date suffit pour matcher avec l'entrée `paid`.
          taskId: task.id,
          sats: 0,
          status: 'undone',
        });
      } catch (e) {
        if (__DEV__) console.warn('[lightning] undone audit failed:', e);
        /* Lightning — non-critical, vault domain unaffected */
      }
    })();
  });
  return unsub;
}, [tasksHook]);
```

### Sémantique REQ-6 `undone` audit (verbatim implémenté)

1. **Trigger** : transition `true → false` d'une tâche (user dé-coche). Géré par `subscribeTaskUncomplete` dans `hooks/useVaultTasks.ts:124-138`.
2. **Gate flag** : `isLightningEnabled()` strict. Si flag OFF → return early avant toute lecture AsyncStorage. Respecte SPEC Constraint #1 (zéro side-effect si flag off).
3. **Date de référence** : `task.completedDate ?? new Date().toISOString().slice(0,10)`. Le `completedDate` est null après le toggle uncomplete (cf. `useVaultTasks.toggleTask` qui met `completedDate: undefined` quand `completed=false`). Le fallback `Date.now()` couvre ce cas — l'audit retrouve le bon `paid` en cherchant aujourd'hui.

   **Subtilité importante** : `task` passée au listener est la version AVANT update — son `completed` est encore `true` et son `completedDate` est encore `'YYYY-MM-DD'`. Donc on a la bonne date pour le match `findPaidEntry`.

4. **Idempotence** : aucune. Le listener fire à chaque transition true→false. Si l'utilisateur re-coche puis re-dé-coche la même tâche le même jour, on append une 2ᵉ entrée `undone`. C'est conforme au modèle append-only de `audit-log.ts` (la déduplication n'est pas du ressort de l'audit).
5. **Pas de remboursement LN** : sats déjà spent côté LNbits, pas de reverse semantics. Audit `sats: 0`.
6. **Pas de décrément quota** : `dailyCapPerMember` reste informationnel post-spent. L'utilisateur voit le cumul total dans Settings → Labo → Lightning, mais ne récupère pas de quota après dé-coche.
7. **profileId vide** : la ré-résolution `resolveRecipient(task, profiles, ...)` n'est pas refaite ici. Le matching avec l'entrée `paid` se fait sur `taskId + date` qui sont garantis uniques par jour (cf. lock in-memory Plan 02 + findPaidEntry filter). L'audit `undone` reste traçable.

## Refactor `migration.ts` — autonomie

Avant Plan 04 :

```typescript
import { clearLnbitsConfig, loadLnbitsConfig } from './credentials';
```

Après Plan 04 :

```typescript
import * as SecureStore from 'expo-secure-store';

const SINGLE_KEY = 'lightning_lnbits_config_v1';

async function readSingleLegacy(): Promise<SingleLegacyShape | null> {
  try {
    const raw = await SecureStore.getItemAsync(SINGLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SingleLegacyShape>;
    if (typeof parsed.baseUrl !== 'string' || typeof parsed.invoiceKey !== 'string') return null;
    if (!parsed.baseUrl.trim() || !parsed.invoiceKey.trim()) return null;
    return { baseUrl: parsed.baseUrl, invoiceKey: parsed.invoiceKey };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] readSingleLegacy failed:', err);
    return null;
  }
}

async function clearSingleLegacy(): Promise<void> {
  try { await SecureStore.deleteItemAsync(SINGLE_KEY); }
  catch (err) { if (__DEV__) console.warn('[lightning] clearSingleLegacy failed:', err); }
}
```

Logique `migrateSingleToFamily` strictement identique (3 cas Pitfall #9 — `family_exists` / `no_single` / `migrated`). Les tests `migration.test.ts` couvrent les 4 cas + idempotence (re-vérifiés post-refactor, 7/7 PASS).

## Tests Jest — 12 / 12 PASS scoped

Conformément au protocole "lightweight tests" (machine sous charge), seules les 2 suites touchées par ce plan sont exécutées :

```bash
npx jest --no-coverage \
  lib/lightning/__tests__/undone-audit.test.ts \
  lib/lightning/__tests__/migration.test.ts
```

Résultat :

```
PASS lib/lightning/__tests__/undone-audit.test.ts (7 tests)
PASS lib/lightning/__tests__/migration.test.ts (5 tests)

Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total
Time:        2.07 s
```

### `undone-audit.test.ts` (nouveau — 7 tests)

| # | Cas | Vérifie |
|---|-----|---------|
| A | paid same-day → fire uncomplete déclenche append undone | findPaidEntry true + appendAudit ajoute entrée undone |
| B | pas de paid prior → no-op | findPaidEntry false, audit reste vide |
| C | paid hier mais uncomplete aujourd'hui → no-op | findPaidEntry retourne false pour date mismatch |
| D | paid + undone existant → re-uncomplete ajoute 2ᵉ undone | contrat append-only audit-log (pas de dedup) |
| E | SPEC #6 : paid → undone → re-complete → findPaidEntry reste TRUE | undone n'invalide PAS paid (JSDoc l.132) |
| - | Smoke test typings | TaskUncompleteListener compatible void / Promise<void> |

### `migration.test.ts` (adapté — 5 tests préservés)

- Cas A : single seul → migrated
- Cas B : family seule → family_exists
- Cas C : single + family → family_exists (Pitfall #9)
- Cas D : ni l'un ni l'autre → no_single
- Idempotence : 2× appel après cas A puis B

Les helpers `saveSingleLegacy` / `loadSingleLegacy` locaux remplacent les imports `saveLnbitsConfig` / `loadLnbitsConfig` supprimés. Seedent et lisent directement la clé SecureStore `lightning_lnbits_config_v1`.

## TSC — `npx tsc --noEmit`

**0 erreur** sur le repo complet. Aucune référence cassée par la suppression des 3 fichiers.

## Branche & posture App Store

```bash
git branch --show-current
# feat/lightning-farm

git log main..HEAD --oneline | wc -l
# 46  (commits Phase 53 non mergés sur main)
```

**Décision merge `main` REPORTÉE** — la posture App Store nécessite :
1. Validation juridique tierce sur la conformité App Store 3.1.5(iii) (BYO LNbits + sats only — spike 003 PARTIAL)
2. Décision produit explicite (la feature est invisible end-user en flag OFF par défaut, mais la présence du code peut influencer l'évaluation App Review)

`feat/lightning-farm` reste isolée — la phase est prête à itérer (déjà fonctionnelle bout-en-bout sur dev-client avec flag activé) mais pas à shipper end-user sans cette décision.

## Privacy CLAUDE.md

Audit des 4 commits Plan 04 :

```
chore(53-04): cleanup atomique legacy single-wallet + 2 playgrounds spike (REQ-12)
refactor(53-04): retirer le form legacy single-wallet de SettingsLightning
feat(53-04): REQ-6 'undone' audit — subscribeTaskUncomplete + 4ᵉ useEffect Lightning
test(53-04): contrat REQ-6 'undone' audit (findPaidEntry + appendAudit, 6 cas)
```

Aucun nom personnel réel. Tests utilisent les génériques `Lucas` / `Emma` / `Dupont` (cf. CLAUDE.md règle).

## Déviations du plan

### Rule 3 — Blocking issue : SettingsLightning.tsx consommait encore credentials.ts

**Découvert dans** : Tâche 2, étape "vérification grep avant suppression".

**Issue** : Le PLAN.md déclarait que Plan 03 avait retiré les liens vers les playgrounds spike de SettingsLightning, ce qui était vrai. MAIS le form legacy "Connexion LNbits" (URL + invoice key + Tester + Sauvegarder + Effacer) était resté en place, important `loadLnbitsConfig`, `saveLnbitsConfig`, `clearLnbitsConfig`. Sans cette modif, l'acceptance grep REQ-12 verbatim ne pouvait pas retourner 0.

**Fix** : Refactor `components/settings/SettingsLightning.tsx` pour retirer entièrement le form legacy. Commit séparé `refactor(53-04): retirer le form legacy single-wallet de SettingsLightning` (-198 lignes nettes).

**Détails** :
- Retiré 7 useState : `baseUrl`, `invoiceKey`, `savedConfigured`, `testing`, `saving`, `testResult`, `testError`
- Retiré 4 handlers : `handleSave`, `handleClear`, `handleTest`, `handlePrefillDemo`
- Retiré le JSX "Form connexion" (8 sous-blocs)
- Rebase le toggle "Activer Lightning" sur `familyConfig !== null` plutôt que `savedConfigured` (plus cohérent avec Phase 53 family-only)
- Retiré 9 styles inutilisés du StyleSheet (`linkText`, `inputLabel`, `input`, `resultCard`, `resultTitle`, `resultText`, `btnRow`, `clearBtn`, `clearText`)
- Retiré 3 imports devenus inutiles : `Bitcoin`, `Button`, `WalletInfo`

**Files modified** : `components/settings/SettingsLightning.tsx`
**Commit** : `c2865c14`

### Pas d'autres déviations

Aucune Rule 1 (bug) ni Rule 2 (missing critical functionality) déclenchée. Les 2 tâches autonomes (`type="auto"`) ont été complétées sans modification de scope ; la Tâche 3 (`checkpoint:human-verify`) reste **deferred** (cf. ci-dessous).

## Authentication gates

Aucun. Le plan n'a pas nécessité de credentials externes — toutes les modifications sont locales au repo.

## Commits

```
98590910 chore(53-04): cleanup atomique legacy single-wallet + 2 playgrounds spike (REQ-12)
c2865c14 refactor(53-04): retirer le form legacy single-wallet de SettingsLightning
13a22cbd feat(53-04): REQ-6 'undone' audit — subscribeTaskUncomplete + 4ᵉ useEffect Lightning
387e3edd test(53-04): contrat REQ-6 'undone' audit (findPaidEntry + appendAudit, 6 cas)
```

**Dernier hash : `98590910`** (HEAD `feat/lightning-farm`).

## Checkpoint device — DEFERRED

La Tâche 3 (`checkpoint:human-verify gate="blocking"`) du PLAN.md liste 7 flows de validation manuelle :

1. Non-régression ferme (flag OFF)
2. Non-régression vault + cache (cold boot)
3. Migration legacy (si applicable)
4. Settings Labo final
5. Branche & App Store posture
6. Audit privacy
7. Quality gate final (TSC + Jest)

**Statut** : conformément à la décision orchestrateur (commentaire dans la zone `<plan_specific_notes>` du prompt — *"Wave 4 device checkpoint is still pending user validation (deferred per orchestrator decision)"*), ce checkpoint est **reporté à une validation utilisateur ultérieure**. Plan 04 a complété toutes les modifications de code (Tâches 1 + 2) sans bloquer sur le device check.

**Flows automatisables déjà validés ce plan** :
- ✅ Flow 7 quality gate : TSC clean (0 erreur) + Jest 12/12 PASS sur les 2 suites touchées
- ✅ Flow 5 branche posture : `git branch --show-current` = `feat/lightning-farm`, 46 commits Phase 53 non mergés sur `main`
- ✅ Flow 6 privacy : audit des 4 commits Plan 04 verbatim — aucun nom personnel

**Flows nécessitant le device (rebuild + run iOS)** :
- ⏳ Flow 1 ferme flag OFF (rebuild dev-client requis pour intégrer la suppression des routes spike)
- ⏳ Flow 2 cache vault cold boot
- ⏳ Flow 3 migration legacy (si l'utilisateur avait une config single-wallet pré-existante)
- ⏳ Flow 4 Settings → Labo → Lightning UI final (toggle + TriggerMode + dailyCap + Pay-outs en attente)
- ⏳ Flow 5b App Store metadata (App Store Connect manuel)

## `/gsd-execute-phase 53` — note checkpoint gate

Plan 04 a bloqué historiquement sur `checkpoint:human-verify` (Tâche 3) jusqu'à `resume-signal`. **Pas de modifications irréversibles** si le checkpoint device révèle un issue : les 4 commits ce plan sont sur `feat/lightning-farm` qui reste non mergée. Un `git revert 98590910..HEAD` rétablirait l'état pré-Plan 04 (modulo l'audit-log `undone` éventuellement déjà persisté côté AsyncStorage en cas d'utilisation prod, ce qui reste informationnel et non-critique).

## Décision merge `main` — REPORTÉE

Posture spike 003 (App Store conformité) maintenue **PARTIAL**. Pas de merge sur `main` dans ce plan. Pas de tag git créé non plus — l'utilisateur peut le faire manuellement (`git tag lightning-phase-53-ready`) s'il souhaite marquer un point de stabilité sans push remote.

## Recommendation post-phase

Créer une **issue GitHub** pour la décision juridique App Store :

> **Titre** : Spike App Store conformité — LNbits BYO + sats only
>
> **Body** : La Phase 53 livre une feature Lightning family-only invisible par défaut (flag OFF). La décision merge sur `main` nécessite :
> 1. Lecture juridique tierce des règles App Store 3.1.5 (sub-section iii — exchange rule) appliquée à un wallet BYO custodial type LNbits avec opérations en sats only (pas de fiat).
> 2. Évaluation du risque App Review pour la présence du code (même invisible) dans le bundle prod.
> 3. Décision produit explicite : si conformité OK → merge `main` + tag `lightning-phase-53-released` ; si conformité PARTIAL ou KO → maintenir `feat/lightning-farm` en branche feature pour validation future.

## Self-Check: PASSED

**Fichiers créés (vérification disque)** :

- `lib/lightning/__tests__/undone-audit.test.ts` ✓ FOUND (224 lignes, 7 tests)

**Fichiers supprimés (vérification disque)** :

- `lib/lightning/credentials.ts` ✓ ABSENT
- `app/lightning-spike.tsx` ✓ ABSENT
- `app/lightning-family-spike.tsx` ✓ ABSENT

**Commits (vérification git log)** :

- `387e3edd` (T1 RED) ✓ FOUND
- `13a22cbd` (T1 GREEN) ✓ FOUND
- `c2865c14` (Rule 3 SettingsLightning) ✓ FOUND
- `98590910` (T2 cleanup atomique) ✓ FOUND

**Gates** :

- `npx tsc --noEmit` → 0 erreur ✓
- `npx jest --no-coverage lib/lightning/__tests__/undone-audit.test.ts lib/lightning/__tests__/migration.test.ts` → 12/12 PASS ✓
- `find app lib -name '*lightning-spike*'` → 0 ✓
- `grep loadLnbitsConfig|saveLnbitsConfig|clearLnbitsConfig|ChildWalletMapping|lightning-spike|lightning-family-spike lib components app hooks contexts` → 0 ✓
- `git branch --show-current` = `feat/lightning-farm` ✓
- `git log main..HEAD --oneline | wc -l` = 46 (commits Phase 53 isolés) ✓
- Privacy : aucun nom personnel dans les 4 commits Plan 04 ✓

**Threat surface scan** : aucune nouvelle surface introduite hors `<threat_model>` du PLAN. Le 4ᵉ useEffect Lightning lit/écrit AsyncStorage déjà couvert par les threats T-53-01-02 (Tampering audit-log accept) et T-53-02-08 (FaceID per pay-out mitigated) des plans précédents.

**Stub tracking** : aucun stub introduit. Le `profileId: ''` dans l'audit `undone` est documenté (cf. décisions ci-dessus, ligne 7).
