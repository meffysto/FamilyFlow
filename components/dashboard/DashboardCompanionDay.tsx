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
import { View, Text, StyleSheet, TouchableOpacity, AppState, Platform, Alert, Image } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { isFarmEconomyEvent, computeNextRdvText } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { FontSize } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import {
  startMascotte,
  stopMascotte,
  isMascotteActive,
  loadCompanionSpriteBase64,
  patchMascotte,
  type MascotteStageOverride,
} from '../../lib/mascotte-live-activity';
import { getCompanionStage } from '../../lib/mascot/companion-engine';
import { generateLABubble, pickLABubbleShort, type LAStage } from '../../lib/mascot/la-bubbles';
import { useAI } from '../../contexts/AIContext';
import { callCompanionMessage } from '../../lib/ai-service';
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
  if (h < 20) return { key: 'routine', info: { emoji: '🛁', title: 'Routine du soir', sub: ({ meal }) => meal ? `Dîner : ${meal}` : 'Douche, dents, histoire' } };
  if (h < 22) return { key: 'dodo', info: { emoji: '🌙', title: `${name} se prépare à dormir`, sub: () => 'Une petite histoire ?' } };
  return { key: 'recap', info: { emoji: '🌙', title: 'Journée accomplie', sub: ({ done }) => `${done} tâches faites aujourd'hui` } };
}

function DashboardCompanionDayInner(_props: DashboardSectionProps) {
  const { colors, tint } = useThemeColors();
  const { tasks, meals, tasksCompletedToday, activeProfile, gamiData, rdvs } = useVault();
  const { config: aiConfig } = useAI();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentBubble, setCurrentBubble] = useState<string | null>(null);
  const [companionSprite, setCompanionSprite] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);

  const aiCall = useMemo(() => {
    if (!aiConfig?.apiKey) return null;
    return async (prompt: string): Promise<string> => callCompanionMessage(aiConfig, prompt);
  }, [aiConfig]);

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

    // Récap soir (stage .recap : 22h+) — géré nativement côté widget via l'enum
    const nextRdvText = computeNextRdvText(rdvs);

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
    return { done, total, meal, stage, hour, recapBonusText, xpGainedToday, nextTaskText, nextTaskId, nextRdvText };
  }, [tasks, meals, tasksCompletedToday, mascotteName, gamiData, activeProfile?.id, activeProfile?.points, rdvs]);

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

  // Précharge le sprite compagnon dès que le profil actif est connu, indépendamment
  // de l'état de la LA — permet d'afficher le sprite dans la carte même LA éteinte.
  useEffect(() => {
    let cancelled = false;
    const companion = activeProfile?.companion;
    if (!companion) { setCompanionSprite(null); return; }
    const companionLevel = calculateLevel(activeProfile?.points ?? 0);
    loadCompanionSpriteBase64(companion.activeSpecies, getCompanionStage(companionLevel))
      .then(b64 => { if (!cancelled) setCompanionSprite(b64); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeProfile?.id, activeProfile?.points, activeProfile?.companion]);

  const handleStart = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const companion = activeProfile?.companion;
      const companionLevel = calculateLevel(activeProfile?.points ?? 0);
      const companionSpriteBase64 = companionSprite ?? (companion
        ? await loadCompanionSpriteBase64(companion.activeSpecies, getCompanionStage(companionLevel))
        : null);
      if (companionSpriteBase64 && !companionSprite) setCompanionSprite(companionSpriteBase64);
      // Bulle compagnon : tente IA si aiCall dispo, sinon template court sync.
      const laStage = todayData.stage.key as LAStage;
      const speechBubble = aiCall
        ? await generateLABubble(
            laStage,
            {
              profileName: activeProfile?.name ?? '',
              companionName: mascotteName,
              companionSpecies: companion?.activeSpecies ?? 'chat',
              tasksToday: todayData.done,
              streak: 0,
              level: companionLevel,
              pendingTasks: tasks
                .filter(t => !t.completed && t.dueDate === new Date().toISOString().slice(0, 10))
                .slice(0, 3)
                .map(t => t.text),
              timeOfDay: todayData.hour < 9 ? 'matin'
                : todayData.hour >= 22 ? 'nuit'
                : todayData.hour >= 18 ? 'soir' : 'apres-midi',
            },
            aiCall,
          ).catch(() => pickLABubbleShort(laStage))
        : pickLABubbleShort(laStage);
      const ok = await startMascotte({
        mascotteName,
        tasksDone: todayData.done,
        tasksTotal: todayData.total,
        xpGained: todayData.xpGainedToday,
        currentMeal: todayData.meal,
        companionSpriteBase64,
        bonusText: todayData.recapBonusText,
        nextTaskText: todayData.nextTaskText,
        nextTaskId: todayData.nextTaskId,
        nextRdvText: todayData.nextRdvText,
        speechBubble,
      });
      setCurrentBubble(speechBubble);
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

  const handleRegenerate = useCallback(async () => {
    if (regenBusy) return;
    setRegenBusy(true);
    try {
      Haptics.selectionAsync().catch(() => {});
      const companion = activeProfile?.companion;
      const companionLevel = calculateLevel(activeProfile?.points ?? 0);
      const laStage = todayData.stage.key as LAStage;
      const todayStr = new Date().toISOString().slice(0, 10);
      const bubble = aiCall
        ? await generateLABubble(
            laStage,
            {
              profileName: activeProfile?.name ?? '',
              companionName: mascotteName,
              companionSpecies: companion?.activeSpecies ?? 'chat',
              tasksToday: todayData.done,
              streak: 0,
              level: companionLevel,
              pendingTasks: tasks
                .filter(t => !t.completed && t.dueDate === todayStr)
                .slice(0, 3)
                .map(t => t.text),
              timeOfDay: todayData.hour < 9 ? 'matin'
                : todayData.hour >= 22 ? 'nuit'
                : todayData.hour >= 18 ? 'soir' : 'apres-midi',
            },
            aiCall,
            { skipCache: true },
          ).catch(() => pickLABubbleShort(laStage))
        : pickLABubbleShort(laStage);
      setCurrentBubble(bubble);
      // Propage à la Live Activity si elle tourne
      if (active) {
        await patchMascotte({ speechBubble: bubble });
      }
    } finally {
      setRegenBusy(false);
    }
  }, [regenBusy, aiCall, activeProfile, mascotteName, todayData, tasks, active]);

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

  const progress = todayData.total > 0
    ? Math.min(1, todayData.done / todayData.total)
    : 0;

  const displayBubble = active && currentBubble
    ? currentBubble
    : todayData.stage.info.sub({ done: todayData.done, total: todayData.total, meal: todayData.meal });

  return (
    <DashboardCard key="companionDay" title="La journée de la mascotte" icon="🌱" color={tint} tinted hideMoreLink>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={active ? handleRegenerate : handleStart}
          disabled={busy || regenBusy}
          style={styles.avatarWrap}
          accessibilityLabel={active ? 'Régénérer la phrase' : `Réveiller ${mascotteName}`}
        >
          <SpriteWithRing
            sprite={companionSprite}
            fallbackEmoji={todayData.stage.info.emoji}
            progress={progress}
            active={active}
            ringColor={tint}
            cardBg={colors.cardAlt}
          />
          {active && (
            <View style={[styles.regenBadge, { backgroundColor: colors.card, borderColor: tint }]}>
              <Text style={[styles.regenIcon, { color: tint }]}>{regenBusy ? '⋯' : '↻'}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.body}>
          <Text
            style={[
              active ? styles.stageLabel : styles.titleStrong,
              { color: active ? tint : colors.text },
            ]}
            numberOfLines={1}
          >
            {active ? todayData.stage.info.title : `Réveille ${mascotteName}`}
          </Text>
          {active ? (
            <View style={[styles.bubble, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <Text style={[styles.bubbleText, { color: colors.text }]} numberOfLines={2}>
                « {displayBubble} »
              </Text>
            </View>
          ) : (
            <Text style={[styles.subIntro, { color: colors.textSub }]} numberOfLines={2}>
              Accompagne-la toute la journée, depuis ton écran verrouillé
            </Text>
          )}
        </View>
        {active ? (
          <TouchableOpacity
            onPress={handleStop}
            disabled={busy}
            style={styles.btnDodo}
            accessibilityLabel={`Mettre ${mascotteName} au repos`}
          >
            <Text style={styles.btnDodoEmoji}>🌙</Text>
            <Text style={styles.btnDodoText}>Dodo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStart}
            disabled={busy}
            style={styles.btnReveil}
            accessibilityLabel={`Réveiller ${mascotteName}`}
          >
            <Text style={styles.btnReveilEmoji}>☀️</Text>
            <Text style={styles.btnReveilText}>Réveil</Text>
          </TouchableOpacity>
        )}
      </View>
    </DashboardCard>
  );
}

/**
 * Sprite compagnon (ou emoji fallback) entouré d'un anneau de progression.
 * Anneau caché si aucune tâche du jour (éviter le 0/0 dégueu).
 */
interface SpriteWithRingProps {
  sprite: string | null;
  fallbackEmoji: string;
  progress: number;
  active: boolean;
  ringColor: string;
  cardBg: string;
}
function SpriteWithRing({ sprite, fallbackEmoji, progress, active, ringColor, cardBg }: SpriteWithRingProps) {
  const size = 76;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const showRing = active && progress > 0;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {showRing && (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor + '33'}
            strokeWidth={stroke}
            fill="none"
          />
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference},${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      )}
      <View style={[styles.spriteInner, { backgroundColor: cardBg }]}>
        {sprite ? (
          <Image
            source={{ uri: `data:image/png;base64,${sprite}` }}
            style={{ width: 60, height: 60 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: 40 }}>{fallbackEmoji}</Text>
        )}
      </View>
    </View>
  );
}

export const DashboardCompanionDay = React.memo(DashboardCompanionDayInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  spriteInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regenBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regenIcon: {
    fontSize: 13,
    fontWeight: '700',
  },
  titleStrong: {
    fontSize: FontSize.body,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  stageLabel: {
    fontSize: FontSize.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  bubble: {
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  subIntro: {
    fontSize: FontSize.caption,
    lineHeight: 16,
  },
  btnDodo: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#4C3B8F',
    minWidth: 58,
    shadowColor: '#4C3B8F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDodoEmoji: {
    fontSize: 20,
    marginBottom: 1,
  },
  btnDodoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F5F1FF',
    letterSpacing: 0.3,
  },
  btnReveil: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    minWidth: 58,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  btnReveilEmoji: {
    fontSize: 20,
    marginBottom: 1,
  },
  btnReveilText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  btnText: {
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
});
