/**
 * Tests bus d'événements lightning-events (Phase 53 — Pattern 3 RESEARCH).
 *
 * Couvre :
 *   - onPayoutSuccess + emitPayoutSuccess → listener fire synchroneusement
 *   - unsub retire le listener
 *   - 1 listener qui throw n'empêche pas les autres d'être appelés
 *   - onPayoutFailed + emitPayoutFailed symétrique
 */

import {
  emitPayoutFailed,
  emitPayoutSuccess,
  onPayoutFailed,
  onPayoutSuccess,
  type PayoutSuccessEvent,
} from '../lightning-events';

describe('lightning-events — success bus', () => {
  it('onPayoutSuccess + emit → listener appelé avec l\'event', () => {
    const received: PayoutSuccessEvent[] = [];
    const unsub = onPayoutSuccess((e) => received.push(e));

    const event: PayoutSuccessEvent = {
      profileId: 'lucas',
      profileName: 'Lucas',
      sats: 100,
      taskId: 't1',
    };
    emitPayoutSuccess(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);

    unsub();
  });

  it('unsub retire le listener (plus appelé après)', () => {
    const received: PayoutSuccessEvent[] = [];
    const unsub = onPayoutSuccess((e) => received.push(e));

    emitPayoutSuccess({ profileId: 'p', profileName: 'P', sats: 1, taskId: 't' });
    unsub();
    emitPayoutSuccess({ profileId: 'p', profileName: 'P', sats: 2, taskId: 't2' });

    expect(received).toHaveLength(1);
  });

  it('plusieurs listeners reçoivent l\'event', () => {
    const a: number[] = [];
    const b: number[] = [];
    const unsubA = onPayoutSuccess((e) => a.push(e.sats));
    const unsubB = onPayoutSuccess((e) => b.push(e.sats));

    emitPayoutSuccess({ profileId: 'p', profileName: 'P', sats: 42, taskId: 't' });

    expect(a).toEqual([42]);
    expect(b).toEqual([42]);

    unsubA();
    unsubB();
  });

  it('un listener qui throw n\'empêche pas les autres', () => {
    const received: number[] = [];
    const unsub1 = onPayoutSuccess(() => {
      throw new Error('listener error');
    });
    const unsub2 = onPayoutSuccess((e) => received.push(e.sats));

    expect(() =>
      emitPayoutSuccess({ profileId: 'p', profileName: 'P', sats: 7, taskId: 't' }),
    ).not.toThrow();
    expect(received).toEqual([7]);

    unsub1();
    unsub2();
  });
});

describe('lightning-events — failed bus', () => {
  it('onPayoutFailed + emit → listener appelé', () => {
    const received: string[] = [];
    const unsub = onPayoutFailed((e) => received.push(e.reason));

    emitPayoutFailed({ profileId: 'p', taskId: 't', reason: 'network' });
    emitPayoutFailed({ profileId: 'p', taskId: 't2', reason: 'capped', message: 'cap reached' });

    expect(received).toEqual(['network', 'capped']);

    unsub();
  });
});
