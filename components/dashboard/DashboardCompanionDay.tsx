/**
 * DashboardCompanionDay.tsx — Carte "voix du compagnon" + pont Live Activity
 *
 * 3 états (une seule carte, pas de doublon) :
 * 1. Inactif standard           → phrase 1ʳᵉ personne du stage horaire + CTA "Réveil"
 * 2. Inactif + événement proactif (morning_greeting / weekly_recap) →
 *                                 message proactif (template puis IA si dispo) + CTA "On y va"
 * 3. Actif (LA en cours)        → bulle live + anneau XP + CTA "Dodo"
 *
 * Absorbe le rôle de l'ancien DashboardCompanion : la voix du compagnon n'a
 * plus qu'un seul slot dans le dashboard.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, Platform, Alert, Image } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { Sun, Moon, ArrowRight } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { isFarmEconomyEvent, computeNextRdvText } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';
import { GlassView } from '../ui/GlassView';
import { FontSize, FontFamily } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import {
  startMascotte,
  stopMascotte,
  isMascotteActive,
  loadCompanionSpriteBase64,
  derivePoseFromStage,
  patchMascotte,
  type MascotteStageOverride,
} from '../../lib/mascotte-live-activity';
import {
  getCompanionStage,
  detectProactiveEvent,
  pickCompanionMessage,
  generateCompanionAIMessage,
} from '../../lib/mascot/companion-engine';
import {
  loadCompanionMessages,
  saveCompanionMessages,
  type PersistedCompanionMessage,
} from '../../lib/mascot/companion-storage';
import { loadWeekStats } from '../../lib/semantic/coupling-overrides';
import { generateLABubble, pickLABubbleShort, type LAStage } from '../../lib/mascot/la-bubbles';
import { useAI } from '../../contexts/AIContext';
import { callCompanionMessage } from '../../lib/ai-service';
import { calculateLevel } from '../../lib/gamification';
import type { DashboardSectionProps } from './types';
import type { CompanionEvent } from '../../lib/mascot/companion-types';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const LAST_VISIT_KEY = 'companion_last_visit';

interface StageInfo {
  /** Micro-label en haut de la bulle (caps, tracking) */
  label: (name: string) => string;
  /** Phrase 1ʳᵉ personne du compagnon, mode inactif sans événement proactif */
  idle: (args: { name: string; done: number; total: number; meal: string | null }) => string;
  /** Sub stage actif si pas de bulle IA dispo (fallback compact) */
  fallback: (args: { done: number; total: number; meal: string | null }) => string;
  /** Emoji fallback si pas de sprite */
  emoji: string;
}

function stageForHour(h: number): { key: MascotteStageOverride; info: StageInfo } {
  if (h < 9) return {
    key: 'reveil',
    info: {
      emoji: '🌅',
      label: () => 'Au lever du jour',
      idle: ({ name }) => `Le soleil pointe — ${name} s'étire et t'attend.`,
      fallback: () => 'Prête pour la journée',
    },
  };
  if (h < 12) return {
    key: 'travail',
    info: {
      emoji: '⛏️',
      label: () => 'Au boulot',
      idle: ({ done, total }) =>
        total > 0
          ? `Réveille-moi et je t'accompagne — ${done}/${total} déjà cochées ce matin.`
          : `Réveille-moi, on attaque la matinée ensemble.`,
      fallback: ({ done, total }) => `Tâches : ${done}/${total}`,
    },
  };
  if (h < 14) return {
    key: 'midi',
    info: {
      emoji: '🍽️',
      label: () => 'Pause de midi',
      idle: ({ meal }) =>
        meal
          ? `${meal} au menu — je t'attends pour passer à table.`
          : `Pause méridienne, j'aimerais bien partager ton repas…`,
      fallback: ({ meal }) => meal ? `Au menu : ${meal}` : 'Repas à planifier',
    },
  };
  if (h < 18) return {
    key: 'jeu',
    info: {
      emoji: '🌿',
      label: () => 'Après-midi',
      idle: ({ done, total }) =>
        total > 0
          ? `Je joue dans la clairière — il reste ${Math.max(0, total - done)} tâches à cocher.`
          : `Je joue dans la clairière — réveille-moi pour qu'on avance.`,
      fallback: ({ done, total }) => `Tâches : ${done}/${total}`,
    },
  };
  if (h < 20) return {
    key: 'routine',
    info: {
      emoji: '🛁',
      label: () => 'Routine du soir',
      idle: ({ meal }) =>
        meal
          ? `${meal} ce soir — je commence ma routine, retrouve-moi.`
          : `Le soir tombe, douche-dents-histoire, je suis prête.`,
      fallback: ({ meal }) => meal ? `Dîner : ${meal}` : 'Douche, dents, histoire',
    },
  };
  if (h < 22) return {
    key: 'dodo',
    info: {
      emoji: '🌙',
      label: () => 'Avant le dodo',
      idle: () => `Je pose mes pattes — une petite histoire avant la nuit ?`,
      fallback: () => 'Une petite histoire ?',
    },
  };
  return {
    key: 'recap',
    info: {
      emoji: '🌙',
      label: () => 'Récap de la journée',
      idle: ({ done }) =>
        done > 0
          ? `Belle journée — ${done} tâches cochées. Tu peux dormir tranquille.`
          : `La nuit est calme. Repose-toi, demain est un autre jour.`,
      fallback: ({ done }) => `${done} tâches faites aujourd'hui`,
    },
  };
}

function DashboardCompanionDayInner(_props: DashboardSectionProps) {
  const { colors, tint, isDark } = useThemeColors();
  const { tasks, meals, tasksCompletedToday, activeProfile, gamiData, rdvs, subscribeTaskComplete } = useVault();
  const { config: aiConfig } = useAI();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentBubble, setCurrentBubble] = useState<string | null>(null);
  const [companionSprite, setCompanionSprite] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);
  const [proactiveEvent, setProactiveEvent] = useState<CompanionEvent | null>(null);

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

    const nextRdvText = computeNextRdvText(rdvs);

    const xpGainedToday = (gamiData?.history ?? [])
      .filter(e =>
        e.profileId === activeProfile?.id &&
        e.timestamp?.slice(0, 10) === todayStr &&
        !isFarmEconomyEvent(e.note)
      )
      .reduce((sum, e) => sum + (e.points || 0), 0);

    const currentPoints = activeProfile?.points ?? 0;
    const currentLevel = calculateLevel(currentPoints);
    const levelBeforeToday = calculateLevel(currentPoints - xpGainedToday);
    const recapBonusText = currentLevel > levelBeforeToday
      ? `⬆️ Niveau ${currentLevel} atteint !`
      : null;

    const stage = stageForHour(hour);
    const uncompletedToday = todayTasks.filter(t => !t.completed);
    const nextTask = uncompletedToday.find(t => t.recurrence) ?? uncompletedToday[0] ?? null;
    const nextTaskText = nextTask?.text ?? null;
    const nextTaskId = nextTask?.id ?? null;
    return { done, total, meal, stage, hour, recapBonusText, xpGainedToday, nextTaskText, nextTaskId, nextRdvText, currentLevel };
  }, [tasks, meals, tasksCompletedToday, gamiData, activeProfile?.id, activeProfile?.points, rdvs]);

  const refreshActive = useCallback(async () => {
    const a = await isMascotteActive();
    setActive(a);
  }, []);

  useEffect(() => { refreshActive(); }, [refreshActive]);
  useFocusEffect(useCallback(() => { refreshActive(); }, [refreshActive]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      refreshActive();
      patchMascotte({}).catch(() => {});
    });
    return () => sub.remove();
  }, [refreshActive]);

  // Flash happy sur tâche cochée
  const happyFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!active) return;
    const unsub = subscribeTaskComplete(async () => {
      try {
        await patchMascotte({ pose: 'happy' });
        if (happyFlashTimerRef.current) clearTimeout(happyFlashTimerRef.current);
        happyFlashTimerRef.current = setTimeout(() => {
          patchMascotte({ pose: 'idle' }).catch(() => {});
        }, 2000);
      } catch { /* silencieux — non critique */ }
    });
    return () => {
      unsub();
      if (happyFlashTimerRef.current) clearTimeout(happyFlashTimerRef.current);
    };
  }, [active, subscribeTaskComplete, activeProfile?.companion, activeProfile?.points]);

  // Précharge du sprite
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

  // ── Détection événement proactif (absorbé depuis l'ancien DashboardCompanion)
  useEffect(() => {
    const companion = activeProfile?.companion;
    if (!companion || !activeProfile?.id) return;

    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const stored = await SecureStore.getItemAsync(LAST_VISIT_KEY);
        const isFirstVisitToday = stored !== today;

        let hoursSinceLastVisit = 0;
        if (companion.lastEventAt) {
          const lastMs = new Date(companion.lastEventAt).getTime();
          hoursSinceLastVisit = (Date.now() - lastMs) / (1000 * 60 * 60);
        }
        const currentHour = new Date().getHours();
        const isWeeklyRecapWindow = new Date().getDay() === 0 && currentHour >= 18 && currentHour < 21;

        const tasksToday = tasks.filter(t => t.dueDate === today && t.completed).length;
        const totalTasksToday = tasks.filter(t => t.dueDate === today).length;

        const evt = detectProactiveEvent({
          hoursSinceLastVisit,
          currentHour,
          tasksToday,
          totalTasksToday,
          streak: activeProfile.streak ?? 0,
          hasGratitudeToday: false,
          hasMealsPlanned: false,
          isFirstVisitToday,
          isWeeklyRecapWindow,
        });

        // Seuls morning_greeting et weekly_recap sont pertinents pour la carte
        if (evt !== 'morning_greeting' && evt !== 'weekly_recap') return;
        if (cancelled) return;

        const level = calculateLevel(activeProfile.points ?? 0);
        const recentMessages: PersistedCompanionMessage[] = await loadCompanionMessages(activeProfile.id);

        const msgContext: import('../../lib/mascot/companion-types').CompanionMessageContext = {
          profileName: activeProfile.name,
          companionName: companion.name,
          companionSpecies: companion.activeSpecies,
          tasksToday,
          streak: activeProfile.streak ?? 0,
          level,
          recentMessages: recentMessages.map(m => m.text),
        };

        if (evt === 'weekly_recap') {
          const weekStats = await loadWeekStats();
          const totalEffects = Object.values(weekStats.counts).reduce((s, n) => s + n, 0);
          const topCategories = Object.entries(weekStats.counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([cat]) => cat);
          msgContext.recentTasks = [
            `Effets sémantiques semaine: ${totalEffects}`,
            ...topCategories.map(c => `Top catégorie: ${c}`),
          ];
        }

        const templateMsg = pickCompanionMessage(evt, msgContext);
        if (cancelled) return;
        setProactiveEvent(evt);
        setProactiveMessage(templateMsg);

        if (aiCall) {
          generateCompanionAIMessage(evt, msgContext, aiCall).then(aiMsg => {
            if (!cancelled && aiMsg) {
              setProactiveMessage(aiMsg);
              const newMsg: PersistedCompanionMessage = {
                text: aiMsg,
                event: evt,
                timestamp: new Date().toISOString(),
              };
              saveCompanionMessages(activeProfile.id, [...recentMessages, newMsg]);
            }
          });
        } else {
          const newMsg: PersistedCompanionMessage = {
            text: templateMsg,
            event: evt,
            timestamp: new Date().toISOString(),
          };
          saveCompanionMessages(activeProfile.id, [...recentMessages, newMsg]);
        }
      } catch {
        // Non-critique — pas d'événement proactif si erreur
      }
    })();

    return () => { cancelled = true; };
    // Une seule détection au mount par profil (D-06)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  const handleStart = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const companion = activeProfile?.companion;
      const companionLevel = calculateLevel(activeProfile?.points ?? 0);
      const companionStage = getCompanionStage(companionLevel);
      if (companion && !companionSprite) {
        loadCompanionSpriteBase64(companion.activeSpecies, companionStage)
          .then(b64 => { if (b64) setCompanionSprite(b64); })
          .catch(() => {});
      }
      const initialPose = derivePoseFromStage(
        todayData.stage.key as MascotteStageOverride,
        todayData.done,
        todayData.total,
      );
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
        pose: initialPose,
        bonusText: todayData.recapBonusText,
        nextTaskText: todayData.nextTaskText,
        nextTaskId: todayData.nextTaskId,
        nextRdvText: todayData.nextRdvText,
        speechBubble,
        companionSpecies: companion?.activeSpecies ?? null,
        companionStage,
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
      /* silencieux — non critique */
    } finally {
      setBusy(false);
    }
  }, [busy, todayData, mascotteName, activeProfile, aiCall, companionSprite, tasks]);

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

  // ── Calcul des slots d'affichage selon l'état ─────────────────────────────
  const progress = todayData.total > 0
    ? Math.min(1, todayData.done / todayData.total)
    : 0;

  // Speech : priorité LA active > proactif > idle
  const speech = active && currentBubble
    ? currentBubble
    : !active && proactiveMessage
      ? proactiveMessage
      : todayData.stage.info.idle({
          name: mascotteName,
          done: todayData.done,
          total: todayData.total,
          meal: todayData.meal,
        });

  // Label micro-meta au-dessus de la bulle
  const stageLabel = active
    ? `${todayData.stage.info.label(mascotteName)} · ${String(todayData.hour).padStart(2, '0')}h${String(new Date().getMinutes()).padStart(2, '0')}${todayData.total > 0 ? ` · ${todayData.done}/${todayData.total}` : ''}`
    : proactiveEvent === 'morning_greeting'
      ? 'Bonjour'
      : proactiveEvent === 'weekly_recap'
        ? 'Bilan de la semaine'
        : todayData.stage.info.label(mascotteName);

  // Footer meta : info contextuelle utile
  const footerMeta = active
    ? (todayData.xpGainedToday > 0
        ? `+${todayData.xpGainedToday} XP aujourd'hui${todayData.nextTaskText ? ` · ${todayData.nextTaskText}` : ''}`
        : todayData.nextTaskText
          ? `Prochain : ${todayData.nextTaskText}`
          : `Niveau ${todayData.currentLevel}`)
    : proactiveEvent
      ? `Streak ${activeProfile?.streak ?? 0} jour${(activeProfile?.streak ?? 0) > 1 ? 's' : ''} · Niveau ${todayData.currentLevel}`
      : todayData.total > 0
        ? `${todayData.done}/${todayData.total} tâche${todayData.total > 1 ? 's' : ''}${todayData.meal ? ` · ${todayData.meal}` : ''}`
        : todayData.meal
          ? todayData.meal
          : `Niveau ${todayData.currentLevel}`;

  // CTA label : adapté à l'état
  const ctaLabel = active
    ? 'Dodo'
    : proactiveEvent
      ? 'On y va'
      : 'Réveil';
  const CtaIcon = active ? Moon : proactiveEvent ? ArrowRight : Sun;

  const ctaBg = active ? colors.brand.soil : colors.brand.or;
  const ctaShadow = active ? colors.brand.soil : colors.brand.orDeep;
  const ctaFg = active ? colors.brand.parchment : colors.brand.soil;

  return (
    <View style={styles.outer}>
      <GlassView
        style={styles.card}
        intensity={28}
        borderRadius={Radius.xl}
        tint={colors.brand.parchment}
        tintOpacity={isDark ? 0.18 : 0.92}
      >
        {/* Coin replié décoratif (dog-ear) */}
        <View pointerEvents="none" style={[styles.dogEar, { backgroundColor: colors.brand.bark }]} />

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
            <Text style={[styles.stageLabel, { color: colors.brand.soilMuted }]} numberOfLines={1}>
              {stageLabel.toUpperCase()}
            </Text>
            <Text
              style={[styles.speech, { color: colors.brand.soil }]}
              numberOfLines={3}
            >
              <Text style={[styles.quote, { color: colors.brand.soilMuted }]}>{'"'}</Text>
              {speech}
            </Text>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.brand.bark }]}>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {footerMeta}
          </Text>
          <TouchableOpacity
            onPress={active ? handleStop : handleStart}
            disabled={busy}
            style={[styles.cta, { backgroundColor: ctaBg, shadowColor: ctaShadow }]}
            accessibilityLabel={active ? `Mettre ${mascotteName} au repos` : `Réveiller ${mascotteName}`}
          >
            <CtaIcon size={14} strokeWidth={2.2} color={ctaFg} />
            <Text style={[styles.ctaText, { color: ctaFg }]}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </GlassView>
    </View>
  );
}

interface SpriteWithRingProps {
  sprite: string | null;
  fallbackEmoji: string;
  progress: number;
  active: boolean;
  ringColor: string;
  cardBg: string;
}
function SpriteWithRing({ sprite, fallbackEmoji, progress, active, ringColor, cardBg }: SpriteWithRingProps) {
  const size = 84;
  const stroke = 4;
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
            style={{ width: 66, height: 66 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: 42 }}>{fallbackEmoji}</Text>
        )}
      </View>
    </View>
  );
}

export const DashboardCompanionDay = React.memo(DashboardCompanionDayInner);

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing['2xl'],
  },
  card: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
  },
  dogEar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    opacity: 0.22,
    borderBottomLeftRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  avatarWrap: {
    position: 'relative',
  },
  spriteInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
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
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  stageLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  speech: {
    fontFamily: FontFamily.handwrite,
    fontSize: 22,
    lineHeight: 28,
  },
  quote: {
    fontSize: 26,
  },
  footer: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  meta: {
    flex: 1,
    fontSize: FontSize.caption,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
