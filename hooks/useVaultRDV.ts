/**
 * useVaultRDV.ts — Hook dédié au domaine Rendez-vous
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultRDV(vaultRef, triggerWidgetRefresh).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { RDV } from '../lib/types';
import { serializeRDV, rdvFileName } from '../lib/parser';
import { loadNotifConfig, scheduleRDVAlerts } from '../lib/scheduled-notifications';
import type { VaultManager } from '../lib/vault';

const RDV_DIR = '04 - Rendez-vous';

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultRDVResult {
  rdvs: RDV[];
  setRdvs: (rdvs: RDV[]) => void;
  addRDV: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  updateRDV: (sourceFile: string, rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  deleteRDV: (sourceFile: string) => Promise<void>;
  resetRDV: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultRDV(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  triggerWidgetRefresh: () => void,
): UseVaultRDVResult {
  const [rdvs, setRdvs] = useState<RDV[]>([]);

  const resetRDV = useCallback(() => {
    setRdvs([]);
  }, []);

  const addRDV = useCallback(async (rdv: Omit<RDV, 'sourceFile' | 'title'>) => {
    if (!vaultRef.current) return;
    const fileName = rdvFileName(rdv);
    const relPath = `${RDV_DIR}/${fileName}`;
    const content = serializeRDV(rdv);

    await vaultRef.current.ensureDir(RDV_DIR);
    await vaultRef.current.writeFile(relPath, content);

    const exists = await vaultRef.current.exists(relPath);
    if (!exists) {
      throw new Error(`Échec écriture RDV: le fichier n'existe pas après écriture.\nPath: ${relPath}`);
    }

    const newRDV: RDV = {
      ...rdv,
      title: fileName.replace('.md', ''),
      sourceFile: relPath,
    };
    setRdvs(prev => [...prev, newRDV].sort((a, b) => a.date_rdv.localeCompare(b.date_rdv)));
    setTimeout(triggerWidgetRefresh, 0);

    loadNotifConfig().then(config =>
      scheduleRDVAlerts([...rdvs, newRDV], config)
    ).catch(() => {});
  }, [rdvs, vaultRef, triggerWidgetRefresh]);

  const updateRDV = useCallback(async (sourceFile: string, rdv: Omit<RDV, 'sourceFile' | 'title'>) => {
    if (!vaultRef.current) return;
    const content = serializeRDV(rdv);
    await vaultRef.current.writeFile(sourceFile, content);
    const newFileName = rdvFileName(rdv);
    const newPath = `${RDV_DIR}/${newFileName}`;
    if (newPath !== sourceFile) {
      await vaultRef.current.writeFile(newPath, content);
      await vaultRef.current.deleteFile(sourceFile);
    }

    setRdvs(prev => prev.map(r => {
      if (r.sourceFile !== sourceFile) return r;
      return { ...rdv, title: newFileName.replace('.md', ''), sourceFile: newPath };
    }).sort((a, b) => a.date_rdv.localeCompare(b.date_rdv)));
    setTimeout(triggerWidgetRefresh, 0);
  }, [vaultRef, triggerWidgetRefresh]);

  const deleteRDV = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setRdvs(prev => prev.filter(r => r.sourceFile !== sourceFile));
    setTimeout(triggerWidgetRefresh, 0);
  }, [vaultRef, triggerWidgetRefresh]);

  return {
    rdvs,
    setRdvs,
    addRDV,
    updateRDV,
    deleteRDV,
    resetRDV,
  };
}
