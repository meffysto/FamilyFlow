/**
 * LiveActivityGamificationBridge.tsx
 *
 * Composant invisible monté dans la hiérarchie ToastProvider qui câble le
 * handler complet (toggleTask + completeTask + refreshGamification) dans le
 * ref exposé par VaultContext. Le consumer de pending toggles Live Activity
 * (hooks/useVault.ts) appelle ce handler pour obtenir XP/loot/reward card sur
 * les tâches cochées depuis la DI/Lock Screen, exactement comme un tap UI.
 *
 * Retourne null — pas de rendu visuel.
 */

import { useEffect } from 'react';
import { useVault } from '../contexts/VaultContext';
import { useGamification } from '../hooks/useGamification';

export function LiveActivityGamificationBridge() {
  const {
    vault,
    notifPrefs,
    activeProfile,
    profiles,
    toggleTask,
    refreshGamification,
    contributeFamilyQuest,
    liveActivityTaskCompleteRef,
    daybardCreditRef,
    consumeDaybardCompletions,
  } = useVault();

  const { completeTask } = useGamification({
    vault,
    notifPrefs,
    onQuestProgress: contributeFamilyQuest,
  });

  useEffect(() => {
    liveActivityTaskCompleteRef.current = async (task) => {
      await toggleTask(task, true);
      if (!activeProfile) return;
      try {
        await completeTask(activeProfile, task.text, {
          tags: task.tags,
          section: task.section,
          sourceFile: task.sourceFile,
          xpOverride: task.xpOverride,
        });
        await refreshGamification();
      } catch (e) {
        if (__DEV__) console.warn('[LiveActivityBridge] gamification failed:', e);
      }
    };
    return () => {
      liveActivityTaskCompleteRef.current = null;
    };
  }, [toggleTask, completeTask, refreshGamification, activeProfile, liveActivityTaskCompleteRef]);

  // Crédit des complétions Daybard (Mac) : la coche est DÉJÀ écrite dans le .md
  // par Daybard — on ne re-toggle pas, on crédite seulement XP/plantes au profil
  // visé par l'entrée (pas forcément le profil actif — completeTask lit/écrit
  // gami-<id>.md depuis le disque, source de vérité).
  useEffect(() => {
    daybardCreditRef.current = async (profileId, taskText, meta) => {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return; // profil inconnu → entrée ignorée (claim-first assumé)
      await completeTask(profile, taskText, meta);
      await refreshGamification();
    };
    // Rattrapage : consommer ce qui a été déposé pendant que l'app était fermée
    // (et à chaque refresh des profils — la lecture seule est bon marché).
    consumeDaybardCompletions();
    return () => {
      daybardCreditRef.current = null;
    };
  }, [profiles, completeTask, refreshGamification, daybardCreditRef, consumeDaybardCompletions]);

  return null;
}
