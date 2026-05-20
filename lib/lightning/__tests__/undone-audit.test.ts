/**
 * Tests REQ-6 audit `undone` — Phase 53 Plan 04.
 *
 * Le branchement runtime est dans `hooks/useVault.ts` (2ᵉ useEffect Lightning
 * souscrit à `tasksHook.subscribeTaskUncomplete`). Ici on teste la logique
 * pure de décision : SI une entrée `paid` existe AUJOURD'HUI pour le couple
 * taskId+profileId, alors le toggle true→false doit déclencher un append
 * `status:'undone'`. Sinon, no-op.
 *
 * On teste l'invariant via les helpers `findPaidEntry` + `appendAudit` qui
 * sont les blocs effectivement exécutés par le useEffect.
 *
 * Cas couverts (SPEC #6 acceptance + Plan 02 deferred WARNING #7) :
 *   A. paid same-day → uncomplete déclenche append undone
 *   B. pas de paid prior → uncomplete = no-op
 *   C. paid mais date différente → findPaidEntry false → no-op
 *   D. paid + 1 undone existant → re-uncomplete ajoute une 2ᵉ entrée
 *      (idempotence relâchée : c'est le caller `useVault` qui doit
 *      éviter de fire le listener 2× — testé ici pour documenter
 *      le contrat actuel de `findPaidEntry` qui retourne TRUE même
 *      si une `undone` existe déjà). C'est conforme à audit-log.ts
 *      qui n'a pas de notion de "déjà undone".
 *   E. paid + undone-prior même jour → SPEC #6 dit "audit log montre
 *      undone PUIS already_paid_today" : le re-complete pendant la
 *      même journée doit être pris en charge par
 *      `processTaskCompletionForLightning` (Plan 02) — ce test
 *      vérifie juste que `findPaidEntry` retourne toujours TRUE
 *      grâce au `paid` initial, conformément au commentaire JSDoc.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendAudit,
  AUDIT_KEY,
  findPaidEntry,
  loadAudit,
  type AuditEntry,
} from '../audit-log';

const TODAY = '2026-05-18';
const YESTERDAY = '2026-05-17';

function isoAt(date: string, hh = '12', mm = '00'): string {
  return `${date}T${hh}:${mm}:00.000Z`;
}

beforeEach(async () => {
  await AsyncStorage.removeItem(AUDIT_KEY);
});

describe("REQ-6 'undone' audit — décision findPaidEntry + appendAudit", () => {
  it("A. paid same-day → fire uncomplete déclenche append `undone`", async () => {
    // Seed : audit contient 1 entrée `paid` pour T1 / Lucas / aujourd'hui
    const paid: AuditEntry = {
      ts: isoAt(TODAY),
      profileId: 'lucas',
      taskId: 'T1',
      sats: 100,
      status: 'paid',
      paymentHash: 'hash-1',
    };
    await appendAudit(paid);

    // Simulate le useEffect : load audit, check findPaidEntry, si true → append undone
    const audit = await loadAudit();
    const completedDate = TODAY;
    expect(findPaidEntry(audit, 'T1', completedDate)).toBe(true);

    if (findPaidEntry(audit, 'T1', completedDate)) {
      await appendAudit({
        ts: new Date(`${TODAY}T18:30:00.000Z`).toISOString(),
        profileId: 'lucas',
        taskId: 'T1',
        sats: 0,
        status: 'undone',
      });
    }

    const final = await loadAudit();
    expect(final).toHaveLength(2);
    expect(final[0].status).toBe('paid');
    expect(final[1].status).toBe('undone');
    expect(final[1].taskId).toBe('T1');
    expect(final[1].sats).toBe(0);
  });

  it("B. pas de paid prior → uncomplete = no-op (audit reste vide)", async () => {
    // Aucune entrée audit
    const audit = await loadAudit();
    expect(audit).toHaveLength(0);

    // Simule la décision : findPaidEntry false → on n'append PAS undone
    expect(findPaidEntry(audit, 'T2', TODAY)).toBe(false);

    // Le useEffect doit ne RIEN faire
    if (findPaidEntry(audit, 'T2', TODAY)) {
      throw new Error('ne doit jamais atteindre cette branche');
    }

    const final = await loadAudit();
    expect(final).toHaveLength(0);
  });

  it("C. paid mais date HIER → uncomplete aujourd'hui = no-op", async () => {
    // Seed : paid hier
    const paidYesterday: AuditEntry = {
      ts: isoAt(YESTERDAY),
      profileId: 'lucas',
      taskId: 'T3',
      sats: 100,
      status: 'paid',
      paymentHash: 'hash-3',
    };
    await appendAudit(paidYesterday);

    const audit = await loadAudit();
    // Toggle uncomplete fait aujourd'hui — findPaidEntry doit retourner false
    // car la date locale ne match pas.
    expect(findPaidEntry(audit, 'T3', TODAY)).toBe(false);
    // Mais retourne true pour la date d'hier (régression-guard de l'API).
    expect(findPaidEntry(audit, 'T3', YESTERDAY)).toBe(true);

    if (findPaidEntry(audit, 'T3', TODAY)) {
      await appendAudit({
        ts: isoAt(TODAY, '18'),
        profileId: 'lucas',
        taskId: 'T3',
        sats: 0,
        status: 'undone',
      });
    }

    const final = await loadAudit();
    // Aucune entrée undone ajoutée — seule l'entrée paid d'hier subsiste
    expect(final).toHaveLength(1);
    expect(final[0].status).toBe('paid');
  });

  it("D. paid + undone existant → re-uncomplete ajoute une 2ᵉ entrée undone (contrat actuel)", async () => {
    // Seed : paid + undone même jour
    await appendAudit({
      ts: isoAt(TODAY, '10'),
      profileId: 'lucas',
      taskId: 'T4',
      sats: 100,
      status: 'paid',
      paymentHash: 'hash-4',
    });
    await appendAudit({
      ts: isoAt(TODAY, '11'),
      profileId: 'lucas',
      taskId: 'T4',
      sats: 0,
      status: 'undone',
    });

    const audit = await loadAudit();
    // findPaidEntry ne fait PAS de gating "déjà undone" — il regarde paid
    expect(findPaidEntry(audit, 'T4', TODAY)).toBe(true);

    // Le caller useVault accepterait donc d'ajouter une 2ᵉ `undone`.
    // C'est conforme à audit-log.ts (immuable, append-only). La déduplication
    // est de la responsabilité du listener `subscribeTaskUncomplete` qui ne
    // fire qu'sur transition `true → false` réelle — pas une bibliothèque
    // d'idempotence côté audit.
    if (findPaidEntry(audit, 'T4', TODAY)) {
      await appendAudit({
        ts: isoAt(TODAY, '12'),
        profileId: 'lucas',
        taskId: 'T4',
        sats: 0,
        status: 'undone',
      });
    }

    const final = await loadAudit();
    expect(final).toHaveLength(3);
    expect(final.filter((e) => e.status === 'undone')).toHaveLength(2);
  });

  it("E. SPEC #6 : paid → undone → re-complete same-day → findPaidEntry reste TRUE", async () => {
    // SPEC #6 acceptance : "compléter la même tâche après dé-coche → audit
    // log montre `undone` puis `already_paid_today`". Le `already_paid_today`
    // est branché en Plan 02 via `processTaskCompletionForLightning`. Ici on
    // valide juste que la présence d'une entrée `undone` n'invalide PAS le
    // `paid` (cf. JSDoc findPaidEntry l.132).
    await appendAudit({
      ts: isoAt(TODAY, '08'),
      profileId: 'lucas',
      taskId: 'T5',
      sats: 100,
      status: 'paid',
      paymentHash: 'hash-5',
    });
    await appendAudit({
      ts: isoAt(TODAY, '09'),
      profileId: 'lucas',
      taskId: 'T5',
      sats: 0,
      status: 'undone',
    });

    const audit = await loadAudit();
    expect(findPaidEntry(audit, 'T5', TODAY)).toBe(true);
  });
});

describe("subscribeTaskUncomplete — contrat hook (smoke test typings)", () => {
  // Ce test ne charge pas le hook React (besoin de RN runtime), mais valide
  // que le type `(task) => void | Promise<void>` est compatible avec le
  // listener attendu par le 2ᵉ useEffect Lightning de hooks/useVault.ts.
  // La vraie intégration est validée par TSC + checkpoint device.
  it('listener void compatible avec Promise<void>', () => {
    type Listener = (task: { id: string }) => void | Promise<void>;
    const sync: Listener = () => {
      /* no-op */
    };
    const async: Listener = async () => {
      await Promise.resolve();
    };
    expect(typeof sync).toBe('function');
    expect(typeof async).toBe('function');
  });
});
