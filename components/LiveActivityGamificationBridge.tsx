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
    toggleTask,
    refreshGamification,
    contributeFamilyQuest,
    liveActivityTaskCompleteRef,
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

  return null;
}
