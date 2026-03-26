// ─────────────────────────────────────────────
// Mascotte Arbre — Ton adaptatif enfant/adulte
// ─────────────────────────────────────────────

import { useVault } from '../../contexts/VaultContext';
import { useMemo } from 'react';

/** Contexte i18n pour le ton adaptatif */
export type ToneContext = 'enfant' | undefined;

/**
 * Hook qui retourne le context i18n adapté au profil actif.
 * - enfant/ado → context 'enfant' (ton fun, exclamatif, tutoiement)
 * - adulte → undefined (ton par défaut, neutre)
 *
 * Usage : t('mascot.evolution.title', { context: tone })
 * → cherche 'mascot.evolution.title_enfant' si enfant, sinon 'mascot.evolution.title'
 */
export function useTone(): ToneContext {
  const { activeProfile } = useVault();
  return useMemo(() => {
    const role = activeProfile?.role;
    if (role === 'enfant' || role === 'ado') return 'enfant';
    return undefined;
  }, [activeProfile?.role]);
}
