/**
 * useGarden.ts — Hook domaine Village / Jardin Familial (Phase 26, v1.4)
 *
 * Encapsule toute la logique village : parsing, génération de l'objectif
 * hebdomadaire, ajout de contributions, claim de récompense avec anti-double-claim.
 *
 * Pattern D-01 : consomme useVault() directement, sans créer de provider.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { startOfWeek, format } from 'date-fns';
import { useVault } from '../contexts/VaultContext';
import {
  parseGardenFile,
  serializeGardenFile,
  appendContributionToVault,
  appendBuilding,
  VILLAGE_FILE,
  computeWeekTarget,
  computeBuildingsToUnlock,
  OBJECTIVE_TEMPLATES,
} from '../lib/village';
import { parseFarmProfile, serializeFarmProfile } from '../lib/parser';
import type {
  VillageData,
  VillageWeekRecord,
  ContributionType,
  ObjectiveTemplate,
  UnlockedBuilding,
} from '../lib/village';

// ---------------------------------------------------------------------------
// Fonctions utilitaires (hors hook)
// ---------------------------------------------------------------------------

/**
 * Retourne la date du lundi courant au format YYYY-MM-DD.
 * Utilise date-fns startOfWeek avec weekStartsOn:1 (lundi).
 */
function getMondayISO(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Sélectionne le template d'objectif par index rotatif déterministe.
 * Deux profils qui triggent en même temps obtiennent le même template — pas de corruption.
 */
function pickTemplate(weekIndex: number): ObjectiveTemplate {
  return OBJECTIVE_TEMPLATES[weekIndex % OBJECTIVE_TEMPLATES.length];
}

// ---------------------------------------------------------------------------
// useGarden
// ---------------------------------------------------------------------------

export interface UseGardenReturn {
  gardenData: VillageData;
  currentTarget: number;
  progress: number;
  isGoalReached: boolean;
  currentTemplate: ObjectiveTemplate;
  addContribution: (type: ContributionType, profileId: string) => Promise<void>;
  claimReward: (profileId: string) => Promise<boolean>;
  weekHistory: VillageWeekRecord[];
  isLoading: boolean;
  // Phase 30 — bâtiments persistants (VILL-04, VILL-05)
  familyLifetimeLeaves: number;
  unlockedBuildings: UnlockedBuilding[];
}

/**
 * Hook domaine village complet.
 *
 * - Génère automatiquement l'objectif hebdomadaire au premier accès de la semaine.
 * - Archive la semaine précédente dans pastWeeks avant génération.
 * - Expose addContribution pour enregistrer les contributions (récoltes + tâches).
 * - Expose claimReward avec anti-double-claim via village_claimed_week dans gami-{id}.md.
 */
export function useGarden(): UseGardenReturn {
  // Consommation useVault (per D-01 — pas de nouveau provider)
  const { vault, gardenRaw, setGardenRaw, profiles } = useVault();

  // État local chargement
  const [isLoading, setIsLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived state via useMemo
  // ---------------------------------------------------------------------------

  /** Données village parsées depuis le contenu brut */
  const gardenData = useMemo(() => parseGardenFile(gardenRaw), [gardenRaw]);

  /** Nombre de profils actifs (hors grossesse — per Pitfall 6) */
  const activeProfileCount = useMemo(
    () => profiles.filter(p => p.statut !== 'grossesse').length,
    [profiles],
  );

  /**
   * Somme des profile.points sur tous les profils (feuilles lifetime famille).
   * Per D-05 CONTEXT.md. Monotone croissant — `points` est XP lifetime, jamais déduit.
   * `p.points ?? 0` pour profils grossesse / nouvellement créés (Pitfall 7).
   */
  const familyLifetimeLeaves = useMemo(
    () => profiles.reduce((sum, p) => sum + (p.points ?? 0), 0),
    [profiles],
  );

  /** Cible hebdomadaire — calculée dynamiquement selon le nombre de profils */
  const currentTarget = useMemo(
    () => computeWeekTarget(activeProfileCount),
    [activeProfileCount],
  );

  /** Nombre de contributions cette semaine */
  const progress = useMemo(
    () => gardenData.contributions?.length ?? 0,
    [gardenData],
  );

  /** Objectif atteint si progress >= currentTarget */
  const isGoalReached = useMemo(
    () => progress >= currentTarget,
    [progress, currentTarget],
  );

  /** Template actif pour la semaine courante */
  const currentTemplate = useMemo(() => {
    const found = OBJECTIVE_TEMPLATES[gardenData.currentThemeIndex];
    return found ?? pickTemplate(gardenData.pastWeeks?.length ?? 0);
  }, [gardenData]);

  /** Historique des semaines passées */
  const weekHistory = useMemo(
    () => gardenData.pastWeeks ?? [],
    [gardenData],
  );

  /** Bâtiments déjà débloqués (parsés depuis jardin-familial.md) — Phase 30 */
  const unlockedBuildings = useMemo<UnlockedBuilding[]>(
    () => gardenData.unlockedBuildings ?? [],
    [gardenData],
  );

  // ---------------------------------------------------------------------------
  // Génération objectif hebdomadaire (per D-04, D-05, D-06, D-07)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!vault) return;

    const currentMonday = getMondayISO(new Date());

    // Guard anti-boucle infinie + anti-double-génération (per D-07, Pitfall 2).
    // Formule déterministe — si deux profils triggent simultanément, les deux
    // écritures produisent le même résultat. Pas de corruption (iCloud safe, D-06).
    if (gardenData.currentWeekStart === currentMonday) return;

    (async () => {
      setIsLoading(true);
      try {
        // Index de la prochaine semaine (pour la rotation déterministe du template)
        const nextWeekIndex =
          (gardenData.pastWeeks?.length ?? 0) + (gardenData.currentWeekStart ? 1 : 0);
        const nextThemeIndex = nextWeekIndex % OBJECTIVE_TEMPLATES.length;

        // Archiver la semaine passée si elle avait un objectif (D-05)
        const updatedPastWeeks: VillageWeekRecord[] = [...(gardenData.pastWeeks ?? [])];
        if (gardenData.currentWeekStart) {
          // Calculer les contributions par membre avant archivage (HIST-02)
          const byMember: Record<string, number> = {};
          for (const c of gardenData.contributions ?? []) {
            byMember[c.profileId] = (byMember[c.profileId] ?? 0) + c.amount;
          }
          const weekRecord: VillageWeekRecord = {
            weekStart: gardenData.currentWeekStart,
            target: computeWeekTarget(activeProfileCount),
            total: gardenData.contributions?.length ?? 0,
            claimed: gardenData.rewardClaimed,
            contributionsByMember: Object.keys(byMember).length > 0 ? byMember : undefined,
          };
          updatedPastWeeks.push(weekRecord);
        }

        // Construire le nouveau VillageData (contributions vidées pour la nouvelle semaine)
        const newData: VillageData = {
          ...gardenData,
          currentWeekStart: currentMonday,
          currentThemeIndex: nextThemeIndex,
          rewardClaimed: false,
          contributions: [],
          pastWeeks: updatedPastWeeks,
        };

        const newContent = serializeGardenFile(newData);
        await vault.writeFile(VILLAGE_FILE, newContent);
        setGardenRaw(newContent);
      } catch (e) {
        if (__DEV__) console.warn('useGarden — génération objectif:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [vault, gardenRaw, activeProfileCount]);

  // ---------------------------------------------------------------------------
  // Phase 30 — Effet unlock-on-threshold (VILL-04, VILL-05)
  // ---------------------------------------------------------------------------
  // Détecte quand familyLifetimeLeaves franchit un palier catalogue et
  // append le bâtiment correspondant dans jardin-familial.md (append-only).
  //
  // Idempotence stricte : computeBuildingsToUnlock retourne [] si tout est déjà
  // débloqué → early return, pas d'écriture, pas de boucle infinie (Pitfall 1).
  //
  // Multi-paliers simultanés : cascade d'appels appendBuilding sur currentContent
  // local (pur) puis UN SEUL writeFile + setGardenRaw à la fin.
  useEffect(() => {
    if (!vault) return;
    const toUnlock = computeBuildingsToUnlock(familyLifetimeLeaves, unlockedBuildings);
    if (toUnlock.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        let currentContent = await vault.readFile(VILLAGE_FILE).catch(() => '');
        const now = new Date().toISOString();
        for (const entry of toUnlock) {
          const building: UnlockedBuilding = {
            timestamp: now,
            buildingId: entry.id,
            palier: entry.palier,
          };
          currentContent = appendBuilding(currentContent, building);
        }
        if (cancelled) return;
        await vault.writeFile(VILLAGE_FILE, currentContent);
        setGardenRaw(currentContent);
      } catch {
        /* Constructions — non-critical */
      }
    })();

    return () => { cancelled = true; };
  }, [vault, familyLifetimeLeaves, unlockedBuildings, setGardenRaw]);

  // ---------------------------------------------------------------------------
  // addContribution (per D-09)
  // ---------------------------------------------------------------------------

  /**
   * Enregistre une contribution (récolte ferme ou tâche IRL) dans jardin-familial.md.
   * Utilise appendContributionToVault puis relit le fichier pour mettre à jour l'état.
   */
  const addContribution = useCallback(
    async (type: ContributionType, profileId: string): Promise<void> => {
      if (!vault) return;

      const contribution = {
        timestamp: new Date().toISOString(),
        profileId,
        type,
        amount: 1,
      };

      // appendContributionToVault retourne void — relire le fichier après écriture
      await appendContributionToVault(vault, contribution);
      const updated = await vault.readFile(VILLAGE_FILE).catch(() => '');
      setGardenRaw(updated);
    },
    [vault, setGardenRaw],
  );

  // ---------------------------------------------------------------------------
  // claimReward (per D-08, D-09)
  // ---------------------------------------------------------------------------

  /**
   * Réclame la récompense collective si l'objectif est atteint.
   * Guard anti-double-claim : vérifie village_claimed_week dans gami-{id}.md (D-08).
   * Retourne true si le claim a réussi, false si déjà réclamé ou objectif non atteint.
   */
  const claimReward = useCallback(
    async (profileId: string): Promise<boolean> => {
      if (!vault || !isGoalReached) return false;

      // Lire le fichier gami du profil
      const gamiPath = `gami-${profileId}.md`;
      const content = await vault.readFile(gamiPath).catch(() => '');
      const farmData = parseFarmProfile(content);

      // Guard anti-double-claim (D-08) — village_claimed_week persisté par profil
      if (farmData.village_claimed_week === gardenData.currentWeekStart) return false;

      // Écrire le flag anti-double-claim dans gami-{id}.md
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      const updated = { ...farmData, village_claimed_week: gardenData.currentWeekStart };
      await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updated));

      return true;
    },
    [vault, isGoalReached, gardenData, profiles],
  );

  // ---------------------------------------------------------------------------
  // Return API complète (per D-09)
  // ---------------------------------------------------------------------------

  return {
    gardenData,
    currentTarget,
    progress,
    isGoalReached,
    currentTemplate,
    addContribution,
    claimReward,
    weekHistory,
    isLoading,
    // Phase 30
    familyLifetimeLeaves,
    unlockedBuildings,
  };
}
