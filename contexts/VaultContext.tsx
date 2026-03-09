/**
 * VaultContext.tsx — Context global pour le vault
 *
 * Encapsule useVaultInternal() dans un Provider pour partager
 * l'état du vault entre tous les écrans (une seule source de vérité).
 *
 * Usage:
 *   import { useVault } from '../contexts/VaultContext';
 *   const { tasks, addTask, ... } = useVault();
 */

import React, { createContext, useContext } from 'react';
import { useVaultInternal, VaultState, VAULT_PATH_KEY, ACTIVE_PROFILE_KEY } from '../hooks/useVault';

// Re-export les constantes pour backward compat
export { VAULT_PATH_KEY, ACTIVE_PROFILE_KEY };
export type { VaultState };

const VaultContext = createContext<VaultState | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const vault = useVaultInternal();
  return (
    <VaultContext.Provider value={vault}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultState {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault doit être utilisé dans un VaultProvider');
  }
  return ctx;
}
