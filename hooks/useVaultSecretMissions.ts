/**
 * useVaultSecretMissions.ts — Hook dédié au domaine Missions secrètes
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultSecretMissions(vaultRef, profiles).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { Task, Profile } from '../lib/types';
import {
  SECRET_MISSIONS_FILE,
  parseSecretMissions,
  serializeSecretMissions,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultSecretMissions] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultSecretMissionsResult {
  secretMissions: Task[];
  setSecretMissions: (missions: Task[]) => void;
  addSecretMission: (text: string, targetProfileId: string) => Promise<void>;
  completeSecretMission: (missionId: string) => Promise<void>;
  validateSecretMission: (missionId: string) => Promise<void>;
  resetSecretMissions: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultSecretMissions(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  profilesRef: React.MutableRefObject<Profile[]>,
): UseVaultSecretMissionsResult {
  const [secretMissions, setSecretMissions] = useState<Task[]>([]);

  const resetSecretMissions = useCallback(() => {
    setSecretMissions([]);
  }, []);

  const addSecretMission = useCallback(async (text: string, targetProfileId: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    const newMission: Task = {
      id: `${SECRET_MISSIONS_FILE}:-1`,
      text,
      completed: false,
      dueDate: date,
      tags: [],
      mentions: [],
      sourceFile: SECRET_MISSIONS_FILE,
      lineIndex: -1,
      secret: true,
      targetProfileId,
      secretStatus: 'active',
    };
    let existing: Task[] = [];
    try {
      const content = await vaultRef.current.readFile(SECRET_MISSIONS_FILE);
      existing = parseSecretMissions(content);
    } catch (e) { warnUnexpected('addSecretMission-read', e); }
    const updated = [...existing, newMission];
    await vaultRef.current.ensureDir('05 - Famille');
    const serialized = serializeSecretMissions(updated, profilesRef.current);
    await vaultRef.current.writeFile(SECRET_MISSIONS_FILE, serialized);
    setSecretMissions(parseSecretMissions(serialized));
  }, []);

  const completeSecretMission = useCallback(async (missionId: string) => {
    if (!vaultRef.current) return;
    const updated = secretMissions.map((m) =>
      m.id === missionId ? { ...m, secretStatus: 'pending' as const } : m
    );
    setSecretMissions(updated);
    const serialized = serializeSecretMissions(updated, profilesRef.current);
    await vaultRef.current.writeFile(SECRET_MISSIONS_FILE, serialized);
  }, [secretMissions]);

  const validateSecretMission = useCallback(async (missionId: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    const updated = secretMissions.map((m) =>
      m.id === missionId ? { ...m, secretStatus: 'validated' as const, completed: true, completedDate: date } : m
    );
    setSecretMissions(updated);
    const serialized = serializeSecretMissions(updated, profilesRef.current);
    await vaultRef.current.writeFile(SECRET_MISSIONS_FILE, serialized);
  }, [secretMissions]);

  return {
    secretMissions,
    setSecretMissions,
    addSecretMission,
    completeSecretMission,
    validateSecretMission,
    resetSecretMissions,
  };
}
