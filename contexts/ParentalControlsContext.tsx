/**
 * ParentalControlsContext.tsx — Contrôle parental
 *
 * Permet aux adultes de configurer rapidement ce que les enfants/ados
 * peuvent voir dans l'app. Persisté dans SecureStore.
 *
 * Par défaut : tout est restreint (sécurité maximale).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Catégories de données contrôlables */
export type ParentalCategory =
  | 'rdv'           // RDV : voir ceux des autres enfants
  | 'budget'        // Budget : accéder à l'écran
  | 'stock'         // Stock : voir les niveaux
  | 'defis'         // Défis : voir ceux des autres
  | 'wishlist'      // Wishlist : voir celles des autres
  | 'souvenirs'     // Souvenirs : voir ceux des autres enfants
  | 'recherche'     // Recherche : résultats non filtrés
  | 'gratitude';    // Gratitude : voir celles des autres

export interface ParentalControls {
  /** true = l'enfant peut voir cette catégorie sans filtre */
  [key: string]: boolean;
  rdv: boolean;
  budget: boolean;
  stock: boolean;
  defis: boolean;
  wishlist: boolean;
  souvenirs: boolean;
  recherche: boolean;
  gratitude: boolean;
}

/** Libellés et descriptions pour l'UI */
export const PARENTAL_CATEGORIES: {
  id: ParentalCategory;
  label: string;
  emoji: string;
  description: string;
}[] = [
  { id: 'rdv', label: 'Rendez-vous', emoji: '📅', description: 'Voir les RDV des autres enfants' },
  { id: 'budget', label: 'Budget', emoji: '💰', description: 'Accéder à l\'écran budget' },
  { id: 'stock', label: 'Stock', emoji: '📦', description: 'Voir les niveaux de stock' },
  { id: 'defis', label: 'Défis', emoji: '🏅', description: 'Voir les défis des autres' },
  { id: 'wishlist', label: 'Souhaits', emoji: '🎁', description: 'Voir les souhaits des autres' },
  { id: 'souvenirs', label: 'Souvenirs', emoji: '📸', description: 'Voir les souvenirs des autres enfants' },
  { id: 'recherche', label: 'Recherche', emoji: '🔍', description: 'Résultats de recherche non filtrés' },
  { id: 'gratitude', label: 'Gratitude', emoji: '🙏', description: 'Voir les gratitudes des autres' },
];

// ─── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_CONTROLS: ParentalControls = {
  rdv: false,
  budget: false,
  stock: false,
  defis: false,
  wishlist: false,
  souvenirs: false,
  recherche: false,
  gratitude: false,
};

const STORAGE_KEY = 'parental_controls';

// ─── Context ────────────────────────────────────────────────────────────────────

interface ParentalControlsState {
  controls: ParentalControls;
  /** Modifier un toggle */
  setControl: (category: ParentalCategory, allowed: boolean) => Promise<void>;
  /** Vérifier si une catégorie est autorisée pour le profil actif */
  isAllowed: (category: ParentalCategory, role: 'adulte' | 'enfant' | 'ado') => boolean;
}

const Ctx = createContext<ParentalControlsState | null>(null);

export function ParentalControlsProvider({ children }: { children: React.ReactNode }) {
  const [controls, setControls] = useState<ParentalControls>(DEFAULT_CONTROLS);

  // Charger au mount
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setControls({ ...DEFAULT_CONTROLS, ...parsed });
        } catch { /* ignore parse errors */ }
      }
    });
  }, []);

  const setControl = useCallback(async (category: ParentalCategory, allowed: boolean) => {
    setControls((prev) => {
      const next = { ...prev, [category]: allowed };
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isAllowed = useCallback(
    (category: ParentalCategory, role: 'adulte' | 'enfant' | 'ado'): boolean => {
      // Adultes voient toujours tout
      if (role === 'adulte') return true;
      // Enfants/ados : selon le toggle
      return controls[category] ?? false;
    },
    [controls],
  );

  const value = useMemo(() => ({ controls, setControl, isAllowed }), [controls, setControl, isAllowed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParentalControls(): ParentalControlsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useParentalControls doit être utilisé dans un ParentalControlsProvider');
  return ctx;
}
