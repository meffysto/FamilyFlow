/**
 * useVaultDefis.ts — Hook dédié au domaine Défis
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles).
 */

import { useState, useCallback, type SetStateAction, type Dispatch } from 'react';
import type React from 'react';
import type { Defi, DefiDayEntry, GamificationData, Profile } from '../lib/types';
import type { VaultManager } from '../lib/vault';
import { parseDefis, serializeDefis, parseGamification, serializeGamification, parseFamille, mergeProfiles } from '../lib/parser';
import { addPoints } from '../lib/gamification';

// ─── Constantes ──────────────────────────────────────────────────────────────

const DEFIS_FILE = 'defis.md';
const FAMILLE_FILE = 'famille.md';

function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultDefis] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultDefisResult {
  defis: Defi[];
  setDefis: Dispatch<SetStateAction<Defi[]>>;
  createDefi: (defi: Omit<Defi, 'progress' | 'status'>) => Promise<void>;
  checkInDefi: (defiId: string, profileId: string, completed: boolean, value?: number, note?: string) => Promise<void>;
  completeDefi: (defiId: string) => Promise<void>;
  deleteDefi: (defiId: string) => Promise<void>;
  resetDefis: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultDefis(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  gamiDataRef: React.MutableRefObject<GamificationData | null>,
  setGamiData: React.Dispatch<React.SetStateAction<GamificationData | null>>,
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>,
  onQuestProgress?: (profileId: string, type: string, amount: number) => Promise<void>,
): UseVaultDefisResult {
  const [defis, setDefis] = useState<Defi[]>([]);

  const resetDefis = useCallback(() => {
    setDefis([]);
  }, []);

  const createDefi = useCallback(async (defi: Omit<Defi, 'progress' | 'status'>) => {
    if (!vaultRef.current) return;
    const newDefi: Defi = { ...defi, status: 'active', progress: [] };
    let updated: Defi[] = [];
    setDefis(prev => {
      updated = [...prev, newDefi];
      return updated;
    });
    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
  }, []);

  const checkInDefi = useCallback(async (defiId: string, profileId: string, completed: boolean, value?: number, note?: string) => {
    if (!vaultRef.current) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    let updated: Defi[] = [];
    let isNewCheckIn = false;
    let defiTitle = '';
    setDefis(prev => {
      updated = prev.map((d) => {
        if (d.id !== defiId) return d;
        defiTitle = d.title;
        const hasGrace = d.type === 'daily' || d.type === 'abstinence';
        const checkDate = (hasGrace && d.endDate < todayStr && d.status === 'active') ? d.endDate : todayStr;
        const existing = d.progress.find((p) => p.date === checkDate && p.profileId === profileId);
        isNewCheckIn = !existing && completed;
        const filtered = d.progress.filter((p) => !(p.date === checkDate && p.profileId === profileId));
        const entry: DefiDayEntry = { date: checkDate, profileId, completed, value, note };
        const newProgress = [...filtered, entry];
        let newStatus = d.status;
        if (d.type === 'abstinence' && !completed) {
          newStatus = 'failed';
        }
        return { ...d, progress: newProgress, status: newStatus };
      });
      return updated;
    });
    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));

    if (isNewCheckIn && completed) {
      try {
        const file = gamiFile(profileId);
        const gamiContent = await vaultRef.current.readFile(file).catch(() => '');
        const gami = parseGamification(gamiContent);
        const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
        const currentProfiles = mergeProfiles(familleContent, gamiContent);
        const profile = currentProfiles.find((p) => p.id === profileId);
        if (profile) {
          const { profile: updated, entry, activeRewards: updatedRewards } = addPoints(profile, 3, `Défi: ${defiTitle}`, gami.activeRewards);
          const newGami = {
            ...gami,
            profiles: gami.profiles.map((p) => (p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()) ? { ...p, points: updated.points, level: updated.level, multiplierRemaining: updated.multiplierRemaining, multiplier: updated.multiplier } : p),
            history: [...gami.history, entry],
            activeRewards: updatedRewards ?? gami.activeRewards,
          };
          const singleData: GamificationData = {
            profiles: newGami.profiles.filter(p => p.id === profileId || p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()),
            history: newGami.history.filter(e => e.profileId === profileId),
            activeRewards: (newGami.activeRewards ?? []).filter(r => r.profileId === profileId),
            usedLoots: (newGami.usedLoots ?? []).filter(u => u.profileId === profileId),
          };
          await vaultRef.current.writeFile(file, serializeGamification(singleData));
        }
      } catch {}

      // Progression quêtes coopératives (defis)
      if (onQuestProgress) {
        try { await onQuestProgress(profileId, 'defis', 1); } catch { /* Quest — non-critical */ }
      }
    }
  }, [onQuestProgress]);

  const completeDefi = useCallback(async (defiId: string) => {
    if (!vaultRef.current) return;
    let defi: Defi | undefined;
    let updated: Defi[] = [];
    setDefis(prev => {
      defi = prev.find((d) => d.id === defiId);
      updated = prev.map((d) => d.id === defiId ? { ...d, status: 'completed' as const } : d);
      return updated;
    });
    if (!defi) return;

    await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));

    try {
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE);
      const allBaseProfiles = parseFamille(familleContent);
      const participantIds = defi.participants.length > 0
        ? defi.participants
        : allBaseProfiles.map((p) => p.id);

      const updatedGamiByProfile: Record<string, GamificationData> = {};
      for (const pid of participantIds) {
        const file = gamiFile(pid);
        const profContent = await vaultRef.current.readFile(file).catch(() => '');
        const profGami = parseGamification(profContent);
        const matchProfile = allBaseProfiles.find((p) => p.id === pid);
        const gamiName = matchProfile?.name;
        const profile = gamiName
          ? profGami.profiles.find((p) => p.name === gamiName)
          : profGami.profiles.find((p) => p.name.toLowerCase().replace(/\s+/g, '') === pid);
        if (profile) {
          profile.points += defi.rewardPoints;
          profile.lootBoxesAvailable += defi.rewardLootBoxes;
          profGami.history.push({
            profileId: pid,
            action: `+${defi.rewardPoints}`,
            points: defi.rewardPoints,
            note: `Défi: ${defi.title}`,
            timestamp: new Date().toISOString(),
          });
          const singleData: GamificationData = {
            profiles: profGami.profiles,
            history: profGami.history,
            activeRewards: profGami.activeRewards ?? [],
            usedLoots: profGami.usedLoots ?? [],
          };
          await vaultRef.current.writeFile(file, serializeGamification(singleData));
          updatedGamiByProfile[pid] = singleData;
        }
      }

      setGamiData(prev => {
        if (!prev) return prev;
        const newProfiles = prev.profiles.map(p => {
          const updated = updatedGamiByProfile[p.id]?.profiles[0];
          return updated ? { ...p, points: updated.points, lootBoxesAvailable: updated.lootBoxesAvailable } : p;
        });
        const newHistory = [...prev.history];
        for (const pid of participantIds) {
          const added = updatedGamiByProfile[pid]?.history.filter(e => e.profileId === pid && !prev.history.some(h => h.timestamp === e.timestamp)) ?? [];
          newHistory.push(...added);
        }
        return { ...prev, profiles: newProfiles, history: newHistory };
      });
      setProfiles(prev => {
        const parsed = parseFamille(familleContent);
        return parsed.map(base => {
          const existing = prev.find(p => p.id === base.id);
          if (!existing) return { ...base, points: 0, coins: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0 };
          const updatedProf = updatedGamiByProfile[base.id]?.profiles[0];
          return {
            ...base,
            points: updatedProf?.points ?? existing.points,
            coins: updatedProf?.coins ?? updatedProf?.points ?? existing.coins,
            level: updatedProf?.level ?? existing.level,
            streak: existing.streak,
            lootBoxesAvailable: updatedProf?.lootBoxesAvailable ?? existing.lootBoxesAvailable,
            multiplier: existing.multiplier,
            multiplierRemaining: existing.multiplierRemaining,
            pityCounter: existing.pityCounter,
          };
        });
      });
    } catch (e) {
      warnUnexpected('completeDefi-gamification', e);
    }
  }, [setGamiData, setProfiles]);

  const deleteDefi = useCallback(async (defiId: string) => {
    if (!vaultRef.current) return;
    let updated: Defi[] = [];
    setDefis(prev => {
      updated = prev.filter((d) => d.id !== defiId);
      return updated;
    });
    if (updated.length > 0) {
      await vaultRef.current.writeFile(DEFIS_FILE, serializeDefis(updated));
    } else {
      try { await vaultRef.current.deleteFile(DEFIS_FILE); } catch (e) { warnUnexpected('deleteDefi-file', e); }
    }
  }, []);

  return {
    defis,
    setDefis,
    createDefi,
    checkInDefi,
    completeDefi,
    deleteDefi,
    resetDefis,
  };
}
