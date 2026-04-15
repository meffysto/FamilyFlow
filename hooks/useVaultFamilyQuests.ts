/**
 * useVaultFamilyQuests.ts — Hook dédié au domaine Quêtes coopératives familiales
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultFamilyQuests(vaultRef, gamiDataRef, setGamiData, setProfiles).
 *
 * Contraintes :
 * - 1 seule quête active à la fois (startQuest refuse si active)
 * - Seuls les adultes et ados peuvent démarrer une quête (role check)
 * - Expiration détectée au loadVault avec notification locale
 */

import { useState, useCallback, type SetStateAction, type Dispatch } from 'react';
import type React from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { GamificationData, Profile } from '../lib/types';
import type { VaultManager } from '../lib/vault';
import {
  parseFamilyQuests,
  serializeFamilyQuests,
  parseFamilyQuestsMeta,
  FAMILY_QUESTS_FILE,
  parseFamille,
} from '../lib/parser';
import {
  FamilyQuest,
  applyQuestReward,
  createQuestFromTemplate,
} from '../lib/quest-engine';
import { QUEST_TEMPLATES } from '../constants/questTemplates';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Helper : retourne le chemin du fichier gamification per-profil */
function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

const FAMILLE_FILE = 'famille.md';

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultFamilyQuests] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultFamilyQuestsResult {
  familyQuests: FamilyQuest[];
  setFamilyQuests: Dispatch<SetStateAction<FamilyQuest[]>>;
  unlockedRecipes: string[];
  setUnlockedRecipes: Dispatch<SetStateAction<string[]>>;
  startQuest: (templateId: string, profileId: string, profiles: Profile[]) => Promise<void>;
  contribute: (profileId: string, type: string, amount: number) => Promise<void>;
  completeQuest: (questId: string, activeProfileId?: string) => Promise<void>;
  deleteQuest: (questId: string) => Promise<void>;
  resetQuests: () => void;
  checkAndExpireQuests: (quests: FamilyQuest[]) => Promise<FamilyQuest[]>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultFamilyQuests(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  gamiDataRef: React.MutableRefObject<GamificationData | null>,
  setGamiData: React.Dispatch<React.SetStateAction<GamificationData | null>>,
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>,
): UseVaultFamilyQuestsResult {
  const [familyQuests, setFamilyQuests] = useState<FamilyQuest[]>([]);
  const [unlockedRecipes, setUnlockedRecipes] = useState<string[]>([]);

  const resetQuests = useCallback(() => {
    setFamilyQuests([]);
    setUnlockedRecipes([]);
  }, []);

  /**
   * Démarre une quête depuis un template.
   * Contraintes : 1 quête active max, rôle adulte/ado requis.
   */
  const startQuest = useCallback(async (templateId: string, profileId: string, profiles: Profile[]) => {
    if (!vaultRef.current) return;

    // Contrainte 1 : une seule quête active à la fois
    const hasActive = familyQuests.some(q => q.status === 'active');
    if (hasActive) {
      Alert.alert(
        'Quête en cours',
        'La famille a déjà une quête active. Terminez-la ou attendez son expiration avant d\'en lancer une nouvelle.',
      );
      return;
    }

    // Contrainte 2 : rôle adulte ou ado requis
    const profile = profiles.find(p => p.id === profileId);
    if (!profile || (profile.role !== 'adulte' && profile.role !== 'ado')) {
      Alert.alert(
        'Accès restreint',
        'Seuls les adultes et ados peuvent démarrer une quête familiale.',
      );
      return;
    }

    // Trouver le template
    const template = QUEST_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Créer la quête depuis le template
    const newQuest = createQuestFromTemplate(template);

    let updated: FamilyQuest[] = [];
    setFamilyQuests(prev => {
      updated = [...prev, newQuest];
      return updated;
    });

    try {
      await vaultRef.current.writeFile(FAMILY_QUESTS_FILE, serializeFamilyQuests(updated));
    } catch (e) {
      warnUnexpected('startQuest-write', e);
    }
  }, [familyQuests]);

  /**
   * Incrémente la progression de la quête active du bon type.
   * Lit le fichier frais (pas depuis state React) pour éviter les race conditions.
   */
  const contribute = useCallback(async (profileId: string, type: string, amount: number) => {
    if (!vaultRef.current) return;

    try {
      // Lire le fichier frais — evite le pitfall de stale state
      const content = await vaultRef.current.readFile(FAMILY_QUESTS_FILE).catch(() => '');
      const freshQuests = parseFamilyQuests(content);

      let changed = false;
      const updated = freshQuests.map(q => {
        if (q.status !== 'active' || q.type !== type) return q;

        const newContributions = { ...q.contributions };
        newContributions[profileId] = (newContributions[profileId] ?? 0) + amount;
        const newCurrent = q.current + amount;
        // Ne PAS auto-compléter si current >= target — l'utilisateur choisit quand
        changed = true;
        return { ...q, current: newCurrent, contributions: newContributions };
      });

      if (!changed) return;

      await vaultRef.current.writeFile(FAMILY_QUESTS_FILE, serializeFamilyQuests(updated));

      // Mettre à jour le state React avec les nouvelles valeurs
      setFamilyQuests(prev => {
        return prev.map(q => {
          const updatedQ = updated.find(u => u.id === q.id);
          return updatedQ ?? q;
        });
      });
    } catch (e) {
      warnUnexpected('contribute', e);
    }
  }, []);

  /**
   * Complète une quête et applique la récompense ferme à tous les profils.
   * Pattern reward-first : applique AVANT de marquer completed.
   */
  const completeQuest = useCallback(async (questId: string, activeProfileId?: string) => {
    if (!vaultRef.current) return;

    // Trouver la quête
    const quest = familyQuests.find(q => q.id === questId);
    if (!quest || quest.status !== 'active') return;

    try {
      // Lire les profils depuis famille.md pour avoir tous les profileIds
      const familleContent = await vaultRef.current.readFile(FAMILLE_FILE).catch(() => '');
      const allProfiles = parseFamille(familleContent);
      const profileIds = allProfiles.map(p => p.id);

      // Reward-first : appliquer AVANT de marquer completed
      // activeProfileId permet le pattern pending-reward (écriture directe pour le profil local,
      // fichier pending pour les autres — évite les écritures cross-profil stale via iCloud)
      await applyQuestReward(vaultRef.current, profileIds, quest.farmReward, FAMILY_QUESTS_FILE, activeProfileId);

      // Marquer completed
      const completedDate = new Date().toISOString().slice(0, 10);
      let updated: FamilyQuest[] = [];
      setFamilyQuests(prev => {
        updated = prev.map(q =>
          q.id === questId
            ? { ...q, status: 'completed' as const, completedDate }
            : q
        );
        return updated;
      });

      await vaultRef.current.writeFile(FAMILY_QUESTS_FILE, serializeFamilyQuests(updated));
    } catch (e) {
      warnUnexpected('completeQuest', e);
    }
  }, [familyQuests]);

  /**
   * Détecte et expire les quêtes dont endDate < aujourd'hui.
   * Déclenche une notification locale pour chaque quête nouvellement expirée.
   * Appelée depuis loadVault.
   */
  const checkAndExpireQuests = useCallback(async (quests: FamilyQuest[]): Promise<FamilyQuest[]> => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let changed = false;
    const expiredQuests: FamilyQuest[] = [];

    const updated = quests.map(q => {
      if (q.status === 'active' && q.endDate < todayStr) {
        changed = true;
        expiredQuests.push(q);
        return { ...q, status: 'expired' as const };
      }
      return q;
    });

    // Notifications locales pour les quêtes expirées
    for (const quest of expiredQuests) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Quête expirée',
            body: `⏰ La quête "${quest.title}" a expiré ! La famille n'a pas atteint l'objectif — on retente ?`,
          },
          trigger: null, // immédiat
        });
      } catch { /* Quest — non-critical */ }
    }

    // Réécrire le fichier si des quêtes ont été expirées
    if (changed && vaultRef.current) {
      try {
        await vaultRef.current.writeFile(FAMILY_QUESTS_FILE, serializeFamilyQuests(updated));
      } catch (e) {
        warnUnexpected('checkAndExpireQuests-write', e);
      }
    }

    // Charger les recettes débloquées depuis les meta
    if (vaultRef.current) {
      try {
        const content = await vaultRef.current.readFile(FAMILY_QUESTS_FILE).catch(() => '');
        const meta = parseFamilyQuestsMeta(content);
        setUnlockedRecipes(meta.unlockedRecipes);
      } catch { /* Quest — non-critical */ }
    }

    return updated;
  }, []);

  /**
   * Supprime une quête par ID.
   */
  const deleteQuest = useCallback(async (questId: string) => {
    if (!vaultRef.current) return;
    let updated: FamilyQuest[] = [];
    setFamilyQuests(prev => {
      updated = prev.filter(q => q.id !== questId);
      return updated;
    });

    try {
      await vaultRef.current.writeFile(FAMILY_QUESTS_FILE, serializeFamilyQuests(updated));
    } catch (e) {
      warnUnexpected('deleteQuest', e);
    }
  }, []);

  return {
    familyQuests,
    setFamilyQuests,
    unlockedRecipes,
    setUnlockedRecipes,
    startQuest,
    contribute,
    completeQuest,
    deleteQuest,
    resetQuests,
    checkAndExpireQuests,
  };
}
