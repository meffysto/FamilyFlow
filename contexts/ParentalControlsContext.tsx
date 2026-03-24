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

/** Catégories pour l'UI — les labels sont des clés i18n */
export const PARENTAL_CATEGORIES: {
  id: ParentalCategory;
  labelKey: string;
  emoji: string;
  descKey: string;
}[] = [
  { id: 'rdv', labelKey: 'parentalControls.categories.rdv.label', emoji: '📅', descKey: 'parentalControls.categories.rdv.desc' },
  { id: 'budget', labelKey: 'parentalControls.categories.budget.label', emoji: '💰', descKey: 'parentalControls.categories.budget.desc' },
  { id: 'stock', labelKey: 'parentalControls.categories.stock.label', emoji: '📦', descKey: 'parentalControls.categories.stock.desc' },
  { id: 'defis', labelKey: 'parentalControls.categories.defis.label', emoji: '🏅', descKey: 'parentalControls.categories.defis.desc' },
  { id: 'wishlist', labelKey: 'parentalControls.categories.wishlist.label', emoji: '🎁', descKey: 'parentalControls.categories.wishlist.desc' },
  { id: 'souvenirs', labelKey: 'parentalControls.categories.souvenirs.label', emoji: '📸', descKey: 'parentalControls.categories.souvenirs.desc' },
  { id: 'recherche', labelKey: 'parentalControls.categories.recherche.label', emoji: '🔍', descKey: 'parentalControls.categories.recherche.desc' },
  { id: 'gratitude', labelKey: 'parentalControls.categories.gratitude.label', emoji: '🙏', descKey: 'parentalControls.categories.gratitude.desc' },
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
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setControls({ ...DEFAULT_CONTROLS, ...parsed });
          } catch { /* ignore parse errors — garde les défauts */ }
        }
      })
      .catch(() => { /* SecureStore indisponible — garde les défauts restrictifs */ });
  }, []);

  const setControl = useCallback(async (category: ParentalCategory, allowed: boolean) => {
    setControls((prev) => {
      const next = { ...prev, [category]: allowed };
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {
        /* Échec silencieux de persistance — le state local reste correct pour la session */
      });
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
