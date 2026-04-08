/**
 * HelpContext.tsx — Provider global pour le système d'aide contextuelle
 *
 * Gère l'état vu/pas vu des coach marks par écran + statut templates.
 * Stockage consolidé en 2 clés JSON SecureStore (help_screens_v1, template_packs_v1).
 * Migration automatique depuis les anciennes clés individuelles au premier lancement.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

/** Clés consolidées JSON */
const HELP_SCREENS_KEY = 'help_screens_v1';
const TEMPLATE_PACKS_KEY = 'template_packs_v1';

/** Anciennes clés individuelles (migration) */
const LEGACY_HELP_PREFIX = 'help_seen_';
const LEGACY_TEMPLATE_PREFIX = 'template_installed_';

/** Tous les écrans qui ont des coach marks */
const SCREEN_IDS = [
  'dashboard', 'tasks', 'rdv', 'journal', 'photos',
  'meals', 'stock', 'budget', 'routines', 'loot', 'defis', 'more',
] as const;

/** Tous les packs templates */
const TEMPLATE_PACKS = [
  'courses-essentielles', 'repas-semaine', 'menage-organise',
  'suivi-medical', 'routines-enfants', 'budget-familial',
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
  /** État session du tutoriel ferme — step actif ou null si tutoriel inactif (in-memory, non persisté) */
  activeFarmTutorialStep: number | null;
  /** Setter pour activer/avancer/quitter le tutoriel ferme */
  setActiveFarmTutorialStep: (step: number | null) => void;
}

const DEFAULT_VALUE: HelpContextValue = {
  hasSeenScreen: () => false,
  markScreenSeen: async () => {},
  resetAllHints: async () => {},
  resetScreen: async () => {},
  isLoaded: false,
  isTemplateInstalled: () => false,
  markTemplateInstalled: async () => {},
  activeFarmTutorialStep: null,
  setActiveFarmTutorialStep: () => {},
};

const HelpContext = createContext<HelpContextValue>(DEFAULT_VALUE);

/** Lecture sécurisée d'un objet JSON depuis SecureStore */
async function readJsonKey(key: string): Promise<Record<string, boolean>> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // Clé absente ou JSON invalide → objet vide
  }
  return {};
}

/** Écriture sécurisée d'un objet JSON dans SecureStore */
async function writeJsonKey(key: string, data: Record<string, boolean>): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(data));
}

/**
 * Migration unique : lit les anciennes clés individuelles, consolide en JSON,
 * puis supprime les anciennes clés. Ne s'exécute que si la nouvelle clé n'existe pas.
 */
async function migrateHelpScreens(): Promise<Record<string, boolean>> {
  const existing = await SecureStore.getItemAsync(HELP_SCREENS_KEY);
  if (existing) {
    // Déjà migré → lire et retourner
    try { return JSON.parse(existing); } catch { return {}; }
  }

  // Lire les anciennes clés individuelles
  const data: Record<string, boolean> = {};
  await Promise.all(
    SCREEN_IDS.map(async (id) => {
      try {
        const val = await SecureStore.getItemAsync(`${LEGACY_HELP_PREFIX}${id}`);
        if (val === '1') data[id] = true;
      } catch {
        // Clé manquante ou erreur → ignorer
      }
    })
  );

  // Migration : si l'ancien flag "Premiers pas" est déjà dismiss, marquer dashboard comme vu
  try {
    const oldGuide = await SecureStore.getItemAsync('show_onboarding_guide');
    if (oldGuide !== '1' && !data.dashboard) {
      const hasVault = await SecureStore.getItemAsync('vault_path');
      if (hasVault && oldGuide === null) {
        // Utilisateur existant qui n'a jamais eu le flag → ne pas montrer les coach marks
        data.dashboard = true;
      }
    }
  } catch {
    // Erreur de lecture → ignorer la migration du guide
  }

  // Sauvegarder la nouvelle clé consolidée
  await writeJsonKey(HELP_SCREENS_KEY, data);

  // Supprimer les anciennes clés individuelles (best-effort)
  await Promise.all(
    SCREEN_IDS.map((id) =>
      SecureStore.deleteItemAsync(`${LEGACY_HELP_PREFIX}${id}`).catch(() => {})
    )
  );

  return data;
}

/**
 * Migration unique des templates : même logique que pour les écrans.
 */
async function migrateTemplatePacks(): Promise<Record<string, boolean>> {
  const existing = await SecureStore.getItemAsync(TEMPLATE_PACKS_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch { return {}; }
  }

  // Lire les anciennes clés individuelles
  const data: Record<string, boolean> = {};
  await Promise.all(
    TEMPLATE_PACKS.map(async (id) => {
      try {
        const val = await SecureStore.getItemAsync(`${LEGACY_TEMPLATE_PREFIX}${id}`);
        if (val === '1') data[id] = true;
      } catch {
        // Clé manquante ou erreur → ignorer
      }
    })
  );

  // Sauvegarder la nouvelle clé consolidée
  await writeJsonKey(TEMPLATE_PACKS_KEY, data);

  // Supprimer les anciennes clés individuelles (best-effort)
  await Promise.all(
    TEMPLATE_PACKS.map((id) =>
      SecureStore.deleteItemAsync(`${LEGACY_TEMPLATE_PREFIX}${id}`).catch(() => {})
    )
  );

  return data;
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [seenScreens, setSeenScreens] = useState<Set<string>>(new Set());
  const [installedTemplates, setInstalledTemplates] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  // État session du tutoriel ferme — in-memory uniquement, reset au restart (D-09)
  const [activeFarmTutorialStep, setActiveFarmTutorialStep] = useState<number | null>(null);

  // Charger (avec migration si nécessaire) au montage
  useEffect(() => {
    (async () => {
      const [screensData, templatesData] = await Promise.all([
        migrateHelpScreens(),
        migrateTemplatePacks(),
      ]);

      const seen = new Set<string>();
      for (const [id, val] of Object.entries(screensData)) {
        if (val) seen.add(id);
      }

      const templates = new Set<string>();
      for (const [id, val] of Object.entries(templatesData)) {
        if (val) templates.add(id);
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
    // Mise à jour atomique depuis le Set mémoire (évite race condition read-modify-write)
    setSeenScreens((prev) => {
      const next = new Set(prev);
      next.add(screenId);
      // Persister en arrière-plan depuis le state à jour
      const obj: Record<string, boolean> = {};
      next.forEach((id) => { obj[id] = true; });
      writeJsonKey(HELP_SCREENS_KEY, obj);
      return next;
    });
  }, []);

  const resetAllHints = useCallback(async () => {
    // Vider l'objet JSON (écrire un objet vide)
    await writeJsonKey(HELP_SCREENS_KEY, {});
    setSeenScreens(new Set());
  }, []);

  const resetScreen = useCallback(async (screenId: string) => {
    setSeenScreens((prev) => {
      const next = new Set(prev);
      next.delete(screenId);
      const obj: Record<string, boolean> = {};
      next.forEach((id) => { obj[id] = true; });
      writeJsonKey(HELP_SCREENS_KEY, obj);
      return next;
    });
  }, []);

  const isTemplateInstalled = useCallback(
    (packId: string) => installedTemplates.has(packId),
    [installedTemplates]
  );

  const markTemplateInstalled = useCallback(async (packId: string) => {
    setInstalledTemplates((prev) => {
      const next = new Set(prev);
      next.add(packId);
      const obj: Record<string, boolean> = {};
      next.forEach((id) => { obj[id] = true; });
      writeJsonKey(TEMPLATE_PACKS_KEY, obj);
      return next;
    });
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
      activeFarmTutorialStep,
      setActiveFarmTutorialStep,
    }),
    [hasSeenScreen, markScreenSeen, resetAllHints, resetScreen, isLoaded, isTemplateInstalled, markTemplateInstalled, activeFarmTutorialStep]
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
