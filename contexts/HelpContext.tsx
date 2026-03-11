/**
 * HelpContext.tsx — Provider global pour le système d'aide contextuelle
 *
 * Gère l'état vu/pas vu des coach marks par écran + statut templates.
 * Charge toutes les clés SecureStore au montage, puis lectures synchrones via Set en mémoire.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const HELP_PREFIX = 'help_seen_';
const TEMPLATE_PREFIX = 'template_installed_';

/** Tous les écrans qui ont des coach marks */
const SCREEN_IDS = [
  'dashboard', 'tasks', 'rdv', 'journal', 'photos',
  'meals', 'stock', 'budget', 'routines', 'loot', 'defis', 'more',
] as const;

export type HelpScreenId = (typeof SCREEN_IDS)[number];

export interface HelpContextValue {
  /** Vérifie si les coach marks d'un écran ont été vus (synchrone) */
  hasSeenScreen: (screenId: string) => boolean;
  /** Marque un écran comme vu */
  markScreenSeen: (screenId: string) => Promise<void>;
  /** Reset tous les flags (revoir les astuces) */
  resetAllHints: () => Promise<void>;
  /** Reset un écran spécifique (relancer depuis le guide) */
  resetScreen: (screenId: string) => Promise<void>;
  /** État de chargement initial terminé */
  isLoaded: boolean;
  /** Vérifie si un pack template est installé (synchrone) */
  isTemplateInstalled: (packId: string) => boolean;
  /** Marque un pack comme installé */
  markTemplateInstalled: (packId: string) => Promise<void>;
}

const DEFAULT_VALUE: HelpContextValue = {
  hasSeenScreen: () => false,
  markScreenSeen: async () => {},
  resetAllHints: async () => {},
  resetScreen: async () => {},
  isLoaded: false,
  isTemplateInstalled: () => false,
  markTemplateInstalled: async () => {},
};

const HelpContext = createContext<HelpContextValue>(DEFAULT_VALUE);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [seenScreens, setSeenScreens] = useState<Set<string>>(new Set());
  const [installedTemplates, setInstalledTemplates] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger toutes les clés au montage
  useEffect(() => {
    (async () => {
      const seen = new Set<string>();
      const templates = new Set<string>();

      // Charger en parallèle tous les flags help_seen_*
      const screenResults = await Promise.all(
        SCREEN_IDS.map(async (id) => {
          const val = await SecureStore.getItemAsync(`${HELP_PREFIX}${id}`);
          return { id, seen: val === '1' };
        })
      );
      for (const { id, seen: wasSeen } of screenResults) {
        if (wasSeen) seen.add(id);
      }

      // Migration : si l'ancien flag "Premiers pas" est déjà dismiss, marquer dashboard comme vu
      const oldGuide = await SecureStore.getItemAsync('show_onboarding_guide');
      if (oldGuide !== '1') {
        // L'utilisateur a déjà dismiss le guide ou n'a jamais eu le flag → dashboard déjà vu
        const hasDashboardFlag = await SecureStore.getItemAsync(`${HELP_PREFIX}dashboard`);
        if (!hasDashboardFlag) {
          // Vérifier si un vault existe (utilisateur existant vs nouveau)
          const hasVault = await SecureStore.getItemAsync('vault_path');
          if (hasVault && oldGuide === null) {
            // Utilisateur existant qui n'a jamais eu le flag → ne pas montrer les coach marks
            seen.add('dashboard');
            await SecureStore.setItemAsync(`${HELP_PREFIX}dashboard`, '1');
          }
        }
      }

      // Charger les templates installés
      const TEMPLATE_PACKS = [
        'courses-essentielles', 'repas-semaine', 'menage-organise',
        'suivi-medical', 'routines-enfants', 'budget-familial',
      ];
      const templateResults = await Promise.all(
        TEMPLATE_PACKS.map(async (id) => {
          const val = await SecureStore.getItemAsync(`${TEMPLATE_PREFIX}${id}`);
          return { id, installed: val === '1' };
        })
      );
      for (const { id, installed } of templateResults) {
        if (installed) templates.add(id);
      }

      setSeenScreens(seen);
      setInstalledTemplates(templates);
      setIsLoaded(true);
    })();
  }, []);

  const hasSeenScreen = useCallback(
    (screenId: string) => seenScreens.has(screenId),
    [seenScreens]
  );

  const markScreenSeen = useCallback(async (screenId: string) => {
    await SecureStore.setItemAsync(`${HELP_PREFIX}${screenId}`, '1');
    setSeenScreens((prev) => new Set(prev).add(screenId));
  }, []);

  const resetAllHints = useCallback(async () => {
    await Promise.all(
      SCREEN_IDS.map((id) => SecureStore.deleteItemAsync(`${HELP_PREFIX}${id}`))
    );
    setSeenScreens(new Set());
  }, []);

  const resetScreen = useCallback(async (screenId: string) => {
    await SecureStore.deleteItemAsync(`${HELP_PREFIX}${screenId}`);
    setSeenScreens((prev) => {
      const next = new Set(prev);
      next.delete(screenId);
      return next;
    });
  }, []);

  const isTemplateInstalled = useCallback(
    (packId: string) => installedTemplates.has(packId),
    [installedTemplates]
  );

  const markTemplateInstalled = useCallback(async (packId: string) => {
    await SecureStore.setItemAsync(`${TEMPLATE_PREFIX}${packId}`, '1');
    setInstalledTemplates((prev) => new Set(prev).add(packId));
  }, []);

  const value = useMemo<HelpContextValue>(
    () => ({
      hasSeenScreen,
      markScreenSeen,
      resetAllHints,
      resetScreen,
      isLoaded,
      isTemplateInstalled,
      markTemplateInstalled,
    }),
    [hasSeenScreen, markScreenSeen, resetAllHints, resetScreen, isLoaded, isTemplateInstalled, markTemplateInstalled]
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp(): HelpContextValue {
  return useContext(HelpContext);
}
