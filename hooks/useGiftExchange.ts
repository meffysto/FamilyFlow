/**
 * useGiftExchange.ts — FAM-49 : conversion feuilles 🍃 → cadeau € configurable.
 *
 * Hook isolé (ne touche PAS l'orchestrateur useVault pour minimiser le risque de
 * régression). Les feuilles sont déduites au moment de l'échange (miroir
 * PlotUpgradeSheet) et la demande entre dans une file d'attente parentale persistée
 * dans `cadeaux-en-attente.md` (vault, survit au relaunch). Un refus rembourse.
 */

import { useCallback, useEffect, useState } from 'react';
import { useVault } from '../contexts/VaultContext';
import {
  parseGamification,
  serializeGamification,
  parsePendingGifts,
  serializePendingGifts,
} from '../lib/parser';
import { loadGamiConfig, DEFAULT_GAMI_CONFIG, type GamificationConfig } from '../lib/gamification';
import type { GiftRequest } from '../lib/types';

const PENDING_FILE = 'cadeaux-en-attente.md';

/** Helper : chemin du fichier gamification per-profil (décision [Phase 08.1-01]) */
function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

export function useGiftExchange() {
  const { vault, profiles, refreshGamification } = useVault();
  const [config, setConfig] = useState<GamificationConfig>(DEFAULT_GAMI_CONFIG);

  useEffect(() => {
    loadGamiConfig().then(setConfig).catch(() => {});
  }, []);

  /** Muter les feuilles dans gami-{id}.md (delta < 0 = déduction, > 0 = remboursement) */
  const mutateCoins = useCallback(
    async (profileId: string, delta: number, note: string) => {
      if (!vault || delta === 0) return;
      const file = gamiFile(profileId);
      const gamiContent = await vault.readFile(file).catch(() => '');
      const gami = parseGamification(gamiContent);
      const gamiProfile = gami.profiles.find(
        (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
      );
      if (!gamiProfile) return;

      gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) + delta;
      const newEntry = {
        profileId,
        action: delta > 0 ? `+${delta}` : `${delta}`,
        points: delta,
        note,
        timestamp: new Date().toISOString(),
      };
      const singleData = {
        profiles: [gamiProfile],
        history: [...gami.history.filter((e: any) => e.profileId === profileId), newEntry],
        activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === profileId),
        usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === profileId),
      };
      await vault.writeFile(file, serializeGamification(singleData));
    },
    [vault]
  );

  /** Lit toutes les demandes de cadeau (defensive) */
  const loadAll = useCallback(async (): Promise<GiftRequest[]> => {
    if (!vault) return [];
    return parsePendingGifts(await vault.readFile(PENDING_FILE).catch(() => ''));
  }, [vault]);

  const writeAll = useCallback(
    async (gifts: GiftRequest[]) => {
      if (!vault) return;
      await vault.writeFile(PENDING_FILE, serializePendingGifts(gifts));
    },
    [vault]
  );

  /**
   * Demande d'échange par l'enfant. Re-vérifie enabled ET solde dans le hook
   * AVANT toute déduction (T-04i-01 : ne jamais faire confiance au gating UI seul).
   */
  const requestExchange = useCallback(
    async (profileId: string) => {
      const cfg = await loadGamiConfig();
      if (!cfg.giftExchange.enabled) throw new Error('disabled');

      const file = gamiFile(profileId);
      const gami = parseGamification(await vault!.readFile(file).catch(() => ''));
      const gamiProfile = gami.profiles.find(
        (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
      );
      const solde = gamiProfile?.coins ?? gamiProfile?.points ?? 0;
      if (solde < cfg.giftExchange.leavesCost) throw new Error('insufficient_coins');

      await mutateCoins(profileId, -cfg.giftExchange.leavesCost, '🎁 Échange cadeau');

      const profileName = profiles.find((p) => p.id === profileId)?.name ?? profileId;
      const gift: GiftRequest = {
        id: Date.now().toString(36),
        profileId,
        profileName,
        leavesCost: cfg.giftExchange.leavesCost,
        euroValue: cfg.giftExchange.euroValue,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await writeAll([...(await loadAll()), gift]);
      await refreshGamification();
    },
    [vault, profiles, mutateCoins, loadAll, writeAll, refreshGamification]
  );

  /** Validation parentale : status → approved, AUCUN remboursement (feuilles déjà dépensées) */
  const approveGift = useCallback(
    async (id: string) => {
      const gifts = await loadAll();
      const next = gifts.map((g) =>
        g.id === id ? { ...g, status: 'approved' as const, resolvedAt: new Date().toISOString() } : g
      );
      await writeAll(next);
    },
    [loadAll, writeAll]
  );

  /** Refus parental : status → rejected ET remboursement des feuilles à l'enfant */
  const rejectGift = useCallback(
    async (id: string) => {
      const gifts = await loadAll();
      const gift = gifts.find((g) => g.id === id);
      if (gift && gift.status === 'pending') {
        await mutateCoins(gift.profileId, gift.leavesCost, '🎁 Remboursement cadeau refusé');
      }
      const next = gifts.map((g) =>
        g.id === id ? { ...g, status: 'rejected' as const, resolvedAt: new Date().toISOString() } : g
      );
      await writeAll(next);
      await refreshGamification();
    },
    [loadAll, writeAll, mutateCoins, refreshGamification]
  );

  return { config, requestExchange, approveGift, rejectGift, loadAll };
}
