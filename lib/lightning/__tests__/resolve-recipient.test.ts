/**
 * Tests resolveRecipient — 6 cas SPEC REQ-2 (Phase 53).
 *
 * Cas couverts :
 *   1. Mention unique, profil configuré → destinataire
 *   2. Mention unique, profil non configuré → null
 *   3. 0 mention + activeProfile configuré → destinataire
 *   4. 0 mention + activeProfile non configuré → null
 *   5. 2 mentions → null (ambiguïté)
 *   6. Mention adulte avec wallet → destinataire
 */

import { resolveRecipient } from '../resolve-recipient';
import type { Profile, Task } from '../../types';
import type { MemberWalletMapping } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    text: 'task',
    completed: true,
    mentions: [],
    tags: [],
    sourceFile: 'inbox.md',
    lineIndex: 0,
    ...overrides,
  };
}

function makeProfile(id: string, name: string, role: Profile['role'], avatar: string): Profile {
  // Phase 53 — resolveRecipient n'utilise que id, name, role, avatar.
  // Cast partiel pour éviter de poser tous les champs gamification/farm requis.
  return { id, name, role, avatar } as unknown as Profile;
}

const profiles: Profile[] = [
  makeProfile('lucas-id', 'Lucas', 'enfant', '🧒'),
  makeProfile('emma-id', 'Emma', 'enfant', '👧'),
  makeProfile('gabriel-id', 'Gabriel', 'adulte', '👨'),
  makeProfile('sophie-id', 'Sophie', 'adulte', '👩'),
];

const wallets: MemberWalletMapping[] = [
  { profileId: 'lucas-id', displayName: 'Lucas', invoiceKey: 'lucas-key' },
  { profileId: 'gabriel-id', displayName: 'Gabriel', invoiceKey: 'gabriel-key' },
];

describe('resolveRecipient — REQ-2', () => {
  it('Cas 1 : mention unique configurée → destinataire Lucas', () => {
    const task = makeTask({ mentions: ['lucas'] });
    const result = resolveRecipient(task, profiles, wallets, null);
    expect(result).not.toBeNull();
    expect(result!.profileId).toBe('lucas-id');
    expect(result!.wallet.invoiceKey).toBe('lucas-key');
  });

  it('Cas 2 : mention unique NON configurée (Emma sans wallet) → null', () => {
    const task = makeTask({ mentions: ['emma'] });
    const result = resolveRecipient(task, profiles, wallets, null);
    expect(result).toBeNull();
  });

  it('Cas 2 bis : mention inconnue (profil inexistant) → null', () => {
    const task = makeTask({ mentions: ['inconnu'] });
    const result = resolveRecipient(task, profiles, wallets, null);
    expect(result).toBeNull();
  });

  it('Cas 3 : 0 mention + activeProfile configuré → destinataire active', () => {
    const task = makeTask({ mentions: [] });
    const result = resolveRecipient(task, profiles, wallets, 'lucas-id');
    expect(result).not.toBeNull();
    expect(result!.profileId).toBe('lucas-id');
  });

  it('Cas 4 : 0 mention + activeProfile NON configuré → null', () => {
    const task = makeTask({ mentions: [] });
    const result = resolveRecipient(task, profiles, wallets, 'emma-id');
    expect(result).toBeNull();
  });

  it('Cas 4 bis : 0 mention + activeProfile null → null', () => {
    const task = makeTask({ mentions: [] });
    const result = resolveRecipient(task, profiles, wallets, null);
    expect(result).toBeNull();
  });

  it('Cas 5 : 2 mentions ambiguës → null', () => {
    const task = makeTask({ mentions: ['lucas', 'emma'] });
    const result = resolveRecipient(task, profiles, wallets, 'lucas-id');
    expect(result).toBeNull();
  });

  it('Cas 6 : mention adulte avec wallet (Gabriel) → destinataire Gabriel', () => {
    const task = makeTask({ mentions: ['gabriel'] });
    const result = resolveRecipient(task, profiles, wallets, null);
    expect(result).not.toBeNull();
    expect(result!.profileId).toBe('gabriel-id');
    expect(result!.profile.role).toBe('adulte');
  });
});

describe('resolveRecipient — robustesse case-insensitive et match par id', () => {
  it('match insensible à la casse sur le name', () => {
    const task = makeTask({ mentions: ['LUCAS'] });
    expect(resolveRecipient(task, profiles, wallets, null)?.profileId).toBe('lucas-id');
    const task2 = makeTask({ mentions: ['LuCaS'] });
    expect(resolveRecipient(task2, profiles, wallets, null)?.profileId).toBe('lucas-id');
  });

  it('match insensible à la casse sur l\'id', () => {
    const task = makeTask({ mentions: ['lucas-id'] });
    expect(resolveRecipient(task, profiles, wallets, null)?.profileId).toBe('lucas-id');
  });

  it('match par id quand le name a un casse différent', () => {
    const task = makeTask({ mentions: ['LUCAS-ID'] });
    expect(resolveRecipient(task, profiles, wallets, null)?.profileId).toBe('lucas-id');
  });

  it('pas de fuzzy match (typo = null)', () => {
    const task = makeTask({ mentions: ['lucass'] });
    expect(resolveRecipient(task, profiles, wallets, null)).toBeNull();
  });

  it('task.mentions undefined-safe (jamais task.mentions = null en pratique)', () => {
    const task = { ...makeTask({}), mentions: undefined as unknown as string[] };
    expect(resolveRecipient(task, profiles, wallets, 'lucas-id')?.profileId).toBe('lucas-id');
  });
});
