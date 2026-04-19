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
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { FontSize } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import {
  startMascotte,
  stopMascotte,
  isMascotteActive,
  type MascotteStageOverride,
} from '../../lib/mascotte-live-activity';
import type { DashboardSectionProps } from './types';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface StageInfo {
  emoji: string;
  title: string;
  sub: (args: { done: number; total: number; meal: string | null }) => string;
}

function stageForHour(h: number): { key: MascotteStageOverride; info: StageInfo } {
  if (h < 9) return { key: 'reveil', info: { emoji: '🌅', title: 'Pousse s\'étire au soleil', sub: () => 'Prête pour la journée' } };
  if (h < 12) return { key: 'travail', info: { emoji: '⛏️', title: 'Au boulot !', sub: ({ done, total }) => `Tâches : ${done}/${total}` } };
  if (h < 14) return { key: 'midi', info: { emoji: '🍽️', title: 'Pousse déjeune', sub: ({ meal }) => meal ? `Au menu : ${meal}` : 'Repas à planifier' } };
  if (h < 18) return { key: 'jeu', info: { emoji: '🌿', title: 'Pousse joue dans la clairière', sub: ({ done, total }) => `Tâches : ${done}/${total}` } };
  if (h < 21) return { key: 'routine', info: { emoji: '🛁', title: 'Routine du soir', sub: ({ meal }) => meal ? `Dîner : ${meal}` : 'Douche, dents, histoire' } };
  return { key: 'dodo', info: { emoji: '🌙', title: 'Pousse dort paisiblement', sub: ({ done }) => `${done} tâches faites aujourd'hui` } };
}

function DashboardCompanionDayInner(_props: DashboardSectionProps) {
  const { colors, tint } = useThemeColors();
  const { tasks, meals } = useVault();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const todayData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayName = DAYS_FR[now.getDay()];
    const hour = now.getHours();

    const todayTasks = tasks.filter(t => {
      if (t.recurrence) return t.dueDate && t.dueDate <= todayStr;
      return t.dueDate === todayStr;
    });
    const done = todayTasks.filter(t => t.completed).length;
    const total = todayTasks.length;

    const todayMeals = meals.filter(m => m.day === dayName);
    const meal = hour < 14
      ? (todayMeals.find(m => m.mealType === 'Déjeuner')?.text ?? null)
      : (todayMeals.find(m => m.mealType === 'Dîner')?.text ?? null);

    const stage = stageForHour(hour);
    return { done, total, meal, stage, hour };
  }, [tasks, meals]);

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
      const ok = await startMascotte({
        mascotteName: 'Pousse',
        tasksDone: todayData.done,
        tasksTotal: todayData.total,
        xpGained: 0,
        currentMeal: todayData.meal,
      });
      if (!ok) {
        Alert.alert(
          'Live Activities désactivées',
          'Active les Live Activities dans Réglages → FamilyFlow pour accompagner Pousse sur ton Lock Screen.',
        );
      }
      setActive(ok);
    } catch {
      /* silencieux — feature non critique */
    } finally {
      setBusy(false);
    }
  }, [busy, todayData]);

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
            {active ? todayData.stage.info.title : 'Réveille Pousse pour aujourd\'hui'}
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
            accessibilityLabel="Mettre Pousse au repos"
          >
            <Text style={[styles.btnText, { color: colors.text }]}>Dodo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStart}
            disabled={busy}
            style={[styles.btn, { backgroundColor: tint }]}
            accessibilityLabel="Réveiller Pousse"
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
