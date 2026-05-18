/**
 * resolveRecipient — fonction pure d'attribution du destinataire pay-out (REQ-2).
 *
 * Règles SPEC :
 *   - 1 seule mention → profil correspondant (match name OU id case-insensitive)
 *     - si ce profil a un wallet configuré → destinataire
 *     - sinon → null
 *   - mentions multiples → null (ambiguïté, audit log 'attribution_failed' au caller)
 *   - aucune mention → activeProfile fallback
 *     - si activeProfile a un wallet → destinataire
 *     - sinon → null
 *
 * Aucun side-effect : pas de SecureStore, pas de réseau, pas de log.
 * Le caller (Plan 02 listener) décide quoi audit-log après.
 *
 * Pas de fuzzy match (typo = no payout, pas mauvais destinataire — Threat T-53-01-01).
 */

import type { Profile, Task } from '../types';
import type { MemberWalletMapping } from './types';

export interface ResolvedRecipient {
  profileId: string;
  profile: Profile;
  wallet: MemberWalletMapping;
}

export function resolveRecipient(
  task: Task,
  profiles: Profile[],
  memberWallets: MemberWalletMapping[],
  activeProfileId: string | null,
): ResolvedRecipient | null {
  const walletByProfile = new Map<string, MemberWalletMapping>(
    memberWallets.map((m) => [m.profileId, m]),
  );

  const mentions = Array.isArray(task.mentions) ? task.mentions : [];

  // Cas 2 : mentions multiples → ambigu
  if (mentions.length > 1) return null;

  // Cas 1 : 1 seule mention
  if (mentions.length === 1) {
    const mentionName = mentions[0].toLowerCase();
    const found = profiles.find(
      (p) =>
        p.name.toLowerCase() === mentionName || p.id.toLowerCase() === mentionName,
    );
    if (!found) return null;
    const wallet = walletByProfile.get(found.id);
    if (!wallet) return null;
    return { profileId: found.id, profile: found, wallet };
  }

  // Cas 3 : aucune mention → activeProfile fallback
  if (!activeProfileId) return null;
  const active = profiles.find((p) => p.id === activeProfileId);
  if (!active) return null;
  const wallet = walletByProfile.get(active.id);
  if (!wallet) return null;
  return { profileId: active.id, profile: active, wallet };
}
