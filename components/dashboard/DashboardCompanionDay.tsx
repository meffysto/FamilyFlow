/**
 * DashboardCompanionDay.tsx — Carte "La journée de la mascotte"
 *
 * 2 états :
 * 1. Inactif : CTA pour réveiller la mascotte
 * 2. Actif : aperçu du stage en cours + stats du jour
 *
 * La Live Activity vit sur le Lock Screen + Dynamic Island.
 * Cette carte est le pont dans l'app : découverte + état + contrôle.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, Platform, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { isFarmEconomyEvent } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { FontSize } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import {
  startMascotte,
  stopMascotte,
  isMascotteActive,
  loadCompanionSpriteBase64,
  type MascotteStageOverride,
} from '../../lib/mascotte-live-activity';
import { getCompanionStage } from '../../lib/mascot/companion-engine';
import { calculateLevel } from '../../lib/gamification';
import type { DashboardSectionProps } from './types';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface StageInfo {
  emoji: string;
  title: string;
  sub: (args: { done: number; total: number; meal: string | null }) => string;
}

function stageForHour(h: number, name: string): { key: MascotteStageOverride; info: StageInfo } {
  if (h < 9) return { key: 'reveil', info: { emoji: '🌅', title: `${name} s'étire au soleil`, sub: () => 'Prête pour la journée' } };
  if (h < 12) return { key: 'travail', info: { emoji: '⛏️', title: 'Au boulot !', sub: ({ done, total }) => `Tâches : ${done}/${total}` } };
  if (h < 14) return { key: 'midi', info: { emoji: '🍽️', title: `${name} déjeune`, sub: ({ meal }) => meal ? `Au menu : ${meal}` : 'Repas à planifier' } };
  if (h < 18) return { key: 'jeu', info: { emoji: '🌿', title: `${name} joue dans la clairière`, sub: ({ done, total }) => `Tâches : ${done}/${total}` } };
  if (h < 21) return { key: 'routine', info: { emoji: '🛁', title: 'Routine du soir', sub: ({ meal }) => meal ? `Dîner : ${meal}` : 'Douche, dents, histoire' } };
  return { key: 'dodo', info: { emoji: '🌙', title: `${name} dort paisiblement`, sub: ({ done }) => `${done} tâches faites aujourd'hui` } };
}

function DashboardCompanionDayInner(_props: DashboardSectionProps) {
  const { colors, tint } = useThemeColors();
  const { tasks, meals, tasksCompletedToday, activeProfile, gamiData } = useVault();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const mascotteName = activeProfile?.companion?.name || 'Pousse';

  const todayData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayName = DAYS_FR[now.getDay()];
    const hour = now.getHours();

    const todayTasks = tasks.filter(t => {
      if (t.recurrence) return t.dueDate && t.dueDate <= todayStr;
      return t.dueDate === todayStr;
    });
    const done = tasksCompletedToday;
    const total = Math.max(todayTasks.length, done);

    const todayMeals = meals.filter(m => m.day === dayName);
    const meal = hour < 14
      ? (todayMeals.find(m => m.mealType === 'Déjeuner')?.text ?? null)
      : (todayMeals.find(m => m.mealType === 'Dîner')?.text ?? null);

    // Récap soir (21-23h) : agrégats de la journée complète — dodo narratif reprend à 23h
    const recapMode = hour >= 21 && hour < 23;

    // XP "effort quotidien" du profil actif (tâches, saga, défis, quêtes…)
    // Exclut les gains d'économie ferme (ventes, bonus craft) — cf. isFarmEconomyEvent.
    const xpGainedToday = (gamiData?.history ?? [])
      .filter(e =>
        e.profileId === activeProfile?.id &&
        e.timestamp?.slice(0, 10) === todayStr &&
        !isFarmEconomyEvent(e.note)
      )
      .reduce((sum, e) => sum + (e.points || 0), 0);

    // Level-up du jour : comparaison niveau actuel vs niveau au début de la journée
    const currentPoints = activeProfile?.points ?? 0;
    const currentLevel = calculateLevel(currentPoints);
    const levelBeforeToday = calculateLevel(currentPoints - xpGainedToday);
    const recapBonusText = currentLevel > levelBeforeToday
      ? `⬆️ Niveau ${currentLevel} atteint !`
      : null;

    const stage = stageForHour(hour, mascotteName);
    // Prochaine tâche : récurrente non-cochée d'abord, sinon première non-cochée
    const uncompletedToday = todayTasks.filter(t => !t.completed);
    const nextTask = uncompletedToday.find(t => t.recurrence) ?? uncompletedToday[0] ?? null;
    const nextTaskText = nextTask?.text ?? null;
    const nextTaskId = nextTask?.id ?? null;
    const queue = uncompletedToday.slice(0, 3).map(t => ({ id: t.id, text: t.text }));
    const upcomingTasksJson = queue.length > 0 ? JSON.stringify(queue) : null;
    return { done, total, meal, stage, hour, recapMode, recapBonusText, xpGainedToday, nextTaskText, nextTaskId, upcomingTasksJson };
  }, [tasks, meals, tasksCompletedToday, mascotteName, gamiData, activeProfile?.id, activeProfile?.points]);

  // Re-check actif state on mount, focus, et AppState change
  const refreshActive = useCallback(async () => {
    const a = await isMascotteActive();
    setActive(a);
  }, []);

  useEffect(() => { refreshActive(); }, [refreshActive]);
  useFocusEffect(useCallback(() => { refreshActive(); }, [refreshActive]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshActive();
    });
    return () => sub.remove();
  }, [refreshActive]);

  const handleStart = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const companion = activeProfile?.companion;
      const companionLevel = calculateLevel(activeProfile?.points ?? 0);
      const companionSpriteBase64 = companion
        ? await loadCompanionSpriteBase64(companion.activeSpecies, getCompanionStage(companionLevel))
        : null;
      const ok = await startMascotte({
        mascotteName,
        tasksDone: todayData.done,
        tasksTotal: todayData.total,
        xpGained: todayData.xpGainedToday,
        currentMeal: todayData.meal,
        companionSpriteBase64,
        recapMode: todayData.recapMode,
        bonusText: todayData.recapBonusText,
        nextTaskText: todayData.nextTaskText,
        nextTaskId: todayData.nextTaskId,
        upcomingTasksJson: todayData.upcomingTasksJson,
      });
      if (!ok) {
        Alert.alert(
          'Live Activities désactivées',
          `Active les Live Activities dans Réglages → FamilyFlow pour accompagner ${mascotteName} sur ton Lock Screen.`,
        );
      }
      setActive(ok);
    } catch {
      /* silencieux — feature non critique */
    } finally {
      setBusy(false);
    }
  }, [busy, todayData, mascotteName, activeProfile]);

  const handleStop = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      Haptics.selectionAsync().catch(() => {});
      await stopMascotte();
      setActive(false);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (Platform.OS !== 'ios') return null;

  return (
    <DashboardCard key="companionDay" title="La journée de la mascotte" icon="🌱" color={tint} tinted hideMoreLink>
      <View style={styles.row}>
        <Text style={styles.emoji}>{todayData.stage.info.emoji}</Text>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {active ? todayData.stage.info.title : `Réveille ${mascotteName} pour aujourd'hui`}
          </Text>
          <Text style={[styles.sub, { color: colors.textSub }]} numberOfLines={1}>
            {active
              ? todayData.stage.info.sub({ done: todayData.done, total: todayData.total, meal: todayData.meal })
              : 'Elle vivra ta journée avec toi sur ton Lock Screen'}
          </Text>
        </View>
        {active ? (
          <TouchableOpacity
            onPress={handleStop}
            disabled={busy}
            style={[styles.btn, { backgroundColor: colors.cardAlt }]}
            accessibilityLabel={`Mettre ${mascotteName} au repos`}
          >
            <Text style={[styles.btnText, { color: colors.text }]}>Dodo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStart}
            disabled={busy}
            style={[styles.btn, { backgroundColor: tint }]}
            accessibilityLabel={`Réveiller ${mascotteName}`}
          >
            <Text style={[styles.btnText, { color: '#fff' }]}>Réveiller</Text>
          </TouchableOpacity>
        )}
      </View>
    </DashboardCard>
  );
}

export const DashboardCompanionDay = React.memo(DashboardCompanionDayInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emoji: {
    fontSize: 32,
    width: 42,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: FontSize.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  sub: {
    fontSize: FontSize.caption,
  },
  btn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  btnText: {
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
});
