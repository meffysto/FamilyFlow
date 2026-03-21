/**
 * RecipeCookingMode.tsx — Vue plein écran étape par étape pour cuisiner.
 *
 * Fonctionnalités :
 * - Navigation entre étapes avec barre de progression
 * - Tokens colorés (ingrédients, ustensiles, timers)
 * - Timers multiples simultanés avec cercle animé
 * - Notification locale + haptics quand un timer se termine
 * - Toast in-app
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useThemeColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import type { AppRecipe, StepToken } from '../lib/cooklang';
import { formatIngredient, scaleIngredients } from '../lib/cooklang';
import TimerRing from './TimerRing';
import { FontSize, FontWeight } from '../constants/typography';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActiveTimer {
  id: string;
  stepIdx: number;
  label: string;
  remaining: number;
  total: number;
  notificationId?: string;
  paused: boolean;
}

interface RecipeCookingModeProps {
  recipe: AppRecipe;
  scaleFactor: number;
  servings: number;
  onClose: () => void;
  onFinish?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSeconds(duration: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h') || u === 'hour' || u === 'hours' || u === 'heure' || u === 'heures') return duration * 3600;
  if (u.startsWith('min')) return duration * 60;
  return duration;
}

function formatTime(secs: number): string {
  if (secs <= 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RecipeCookingMode({ recipe, scaleFactor, servings, onClose, onFinish }: RecipeCookingModeProps) {
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const timersRef = useRef<ActiveTimer[]>([]);

  const steps = recipe.steps;
  const total = steps.length;
  const step = steps[currentStep];
  const progress = useSharedValue(0);

  const stepIngredients = step?.ingredients
    ? scaleIngredients(step.ingredients, servings, recipe.servings || 1)
    : [];

  // Keep timersRef in sync with state (fix #1 stale closure)
  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  // Progress bar
  useEffect(() => {
    progress.value = withSpring((currentStep + 1) / total, { damping: 15, stiffness: 100 });
  }, [currentStep, total]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach((interval) => clearInterval(interval));
      timersRef.current.forEach((t) => {
        if (t.notificationId) {
          Notifications.cancelScheduledNotificationAsync(t.notificationId).catch(() => {});
        }
      });
    };
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%`,
  }));

  // ─── Navigation ─────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (currentStep < total - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, total]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const toggleStepDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(currentStep)) {
        next.delete(currentStep);
      } else {
        next.add(currentStep);
        if (currentStep < total - 1) {
          setTimeout(() => setCurrentStep((s) => Math.min(s + 1, total - 1)), 400);
        }
      }
      return next;
    });
  }, [currentStep, total]);

  // ─── Timers ─────────────────────────────────────────────────────

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const createTimerInterval = useCallback((id: string) => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const updated = prev.map((t) => {
          if (t.id !== id || t.paused) return t;
          if (t.remaining <= 1) {
            clearInterval(interval);
            intervalsRef.current.delete(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToastRef.current(`⏱️ ${t.label} — Terminé !`, 'success');
            return null;
          }
          return { ...t, remaining: t.remaining - 1 };
        }).filter(Boolean) as ActiveTimer[];
        return updated;
      });
    }, 1000);
    intervalsRef.current.set(id, interval);
    return interval;
  }, []);

  const scheduleNotification = useCallback(async (label: string, stepIdx: number, seconds: number) => {
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏱️ Minuteur terminé !',
          body: `${label} — Étape ${stepIdx + 1} de ${recipe.title}`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
    } catch { return undefined; }
  }, [recipe.title]);

  const startTimer = useCallback(async (stepIdx: number, timerIdx: number, duration: number, unit: string) => {
    const seconds = toSeconds(duration, unit);
    const id = `${stepIdx}-${timerIdx}`;

    if (timersRef.current.find((t) => t.id === id && !t.paused)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const label = `${duration} ${unit}`;
    const notificationId = await scheduleNotification(label, stepIdx, seconds);

    const timer: ActiveTimer = {
      id, stepIdx, label, remaining: seconds, total: seconds, notificationId, paused: false,
    };

    setTimers((prev) => [...prev.filter((t) => t.id !== id), timer]);
    createTimerInterval(id);
  }, [scheduleNotification, createTimerInterval]);

  const pauseTimer = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const interval = intervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(id);
    }
    const timer = timersRef.current.find((t) => t.id === id);
    if (timer?.notificationId) {
      Notifications.cancelScheduledNotificationAsync(timer.notificationId).catch(() => {});
    }
    setTimers((prev) => prev.map((t) => t.id === id ? { ...t, paused: true, notificationId: undefined } : t));
  }, []);

  const resumeTimer = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const timer = timersRef.current.find((t) => t.id === id);
    if (!timer) return;

    const notificationId = await scheduleNotification(timer.label, timer.stepIdx, timer.remaining);
    setTimers((prev) => prev.map((t) => t.id === id ? { ...t, paused: false, notificationId } : t));
    createTimerInterval(id);
  }, [scheduleNotification, createTimerInterval]);

  const stopTimer = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const interval = intervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(id);
    }
    const timer = timersRef.current.find((t) => t.id === id);
    if (timer?.notificationId) {
      Notifications.cancelScheduledNotificationAsync(timer.notificationId).catch(() => {});
    }
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addMinute = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const timer = timersRef.current.find((t) => t.id === id);
    if (timer?.notificationId) {
      Notifications.cancelScheduledNotificationAsync(timer.notificationId).catch(() => {});
    }
    // Use functional updater to get correct remaining value
    let newRemaining = 0;
    setTimers((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      newRemaining = t.remaining + 60;
      return { ...t, remaining: newRemaining, total: t.total + 60 };
    }));
    // Reschedule with correct time from ref (updated after setTimers)
    if (timer && !timer.paused) {
      const notificationId = await scheduleNotification(timer.label, timer.stepIdx, (timer.remaining + 60));
      if (notificationId) {
        setTimers((prev) => prev.map((t) => t.id === id ? { ...t, notificationId } : t));
      }
    }
  }, [scheduleNotification]);

  // Current step timers
  const stepTimers = timers.filter((t) => t.stepIdx === currentStep);
  const otherTimers = timers.filter((t) => t.stepIdx !== currentStep);

  const isStepDone = checkedSteps.has(currentStep);
  const doneCount = checkedSteps.size;

  // ─── Render tokens ──────────────────────────────────────────────

  const renderTokens = (tokens: StepToken[], factor: number) => {
    if (tokens.length === 0) return null;
    return (
      <Text style={[styles.stepText, { color: colors.text }]}>
        {tokens.map((t, i) => {
          if (t.type === 'text') return <Text key={i}>{t.value}</Text>;
          if (t.type === 'ingredient') {
            const qty = t.quantity != null ? Math.round(t.quantity * factor * 100) / 100 : null;
            const label = qty != null && t.unit
              ? `${qty} ${t.unit} ${t.name}`
              : qty != null ? `${qty} ${t.name}` : t.name;
            return (
              <Text key={i} style={[styles.tokenIngredient, { color: primary, backgroundColor: primary + '15' }]}>
                {label}
              </Text>
            );
          }
          if (t.type === 'cookware') {
            return <Text key={i} style={[styles.tokenCookware, { color: tint }]}>{t.name}</Text>;
          }
          if (t.type === 'timer') {
            const timerId = `${currentStep}-${step.timers.findIndex(
              (tm) => tm.duration === t.quantity && tm.unit === t.unit
            )}`;
            const isRunning = timers.some((at) => at.id === timerId);
            return (
              <Text
                key={i}
                style={[styles.tokenTimer, { color: isRunning ? colors.success : colors.warning }]}
                onPress={() => {
                  if (!isRunning && t.quantity != null && t.unit) {
                    const idx = step.timers.findIndex(
                      (tm) => tm.duration === t.quantity && tm.unit === t.unit
                    );
                    if (idx >= 0) startTimer(currentStep, idx, t.quantity, t.unit);
                  }
                }}
              >
                ⏱ {t.quantity} {t.unit}
              </Text>
            );
          }
          return null;
        })}
      </Text>
    );
  };

  // ─── Render timer card ──────────────────────────────────────────

  const renderTimerCard = (timer: ActiveTimer, compact: boolean = false) => {
    const timerProgress = timer.total > 0 ? timer.remaining / timer.total : 0;
    const ringColor = timer.remaining <= 10 ? colors.error : timer.remaining <= 30 ? colors.warning : primary;

    if (compact) {
      return (
        <TouchableOpacity
          key={timer.id}
          style={[styles.miniTimer, { backgroundColor: ringColor + '20', borderColor: ringColor + '40' }]}
          onPress={() => setCurrentStep(timer.stepIdx)}
          activeOpacity={0.7}
        >
          <Text style={[styles.miniTimerText, { color: ringColor }]}>
            ⏱ {formatTime(timer.remaining)}
          </Text>
          <Text style={[styles.miniTimerLabel, { color: colors.textMuted }]}>
            Ét. {timer.stepIdx + 1}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View key={timer.id} style={[styles.timerCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
        <View style={styles.timerCardMain}>
          <TimerRing
            progress={timerProgress}
            remaining={timer.remaining}
            size={80}
            colorNormal={primary}
            colorWarning={colors.warning}
            colorDanger={colors.error}
            trackColor={colors.cardAlt}
            bgColor={colors.card}
          >
            <Text style={[styles.timerTime, { color: ringColor }]}>
              {formatTime(timer.remaining)}
            </Text>
          </TimerRing>

          <View style={styles.timerCardInfo}>
            <Text style={[styles.timerLabel, { color: colors.text }]}>{timer.label}</Text>
            <Text style={[styles.timerStepRef, { color: colors.textMuted }]}>Étape {timer.stepIdx + 1}</Text>
          </View>
        </View>

        <View style={styles.timerActions}>
          <TouchableOpacity
            style={[styles.timerActionBtn, { backgroundColor: timer.paused ? colors.success + '20' : colors.cardAlt }]}
            onPress={() => timer.paused ? resumeTimer(timer.id) : pauseTimer(timer.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.timerActionText, { color: timer.paused ? colors.success : colors.text }]}>
              {timer.paused ? '▶ Reprendre' : '⏸ Pause'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timerActionBtn, { backgroundColor: colors.cardAlt }]}
            onPress={() => addMinute(timer.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.timerActionText, { color: colors.text }]}>+1 min</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timerActionBtn, { backgroundColor: colors.error + '15' }]}
            onPress={() => stopTimer(timer.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.timerActionText, { color: colors.error }]}>⏹ Stop</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {recipe.title}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              {doneCount}/{total} étapes · {servings} pers.
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleStepDone}
            style={[styles.doneBtn, { backgroundColor: isStepDone ? colors.success : colors.cardAlt }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.doneBtnText, { color: isStepDone ? colors.onPrimary : colors.textMuted }]}>
              {isStepDone ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.cardAlt }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: primary }, progressStyle]} />
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
          {/* Step counter */}
          <View style={styles.stepCounter}>
            <View style={[styles.stepBadge, { backgroundColor: primary }]}>
              <Text style={styles.stepBadgeText}>Étape {currentStep + 1}</Text>
            </View>
            <Text style={[styles.stepOf, { color: colors.textMuted }]}>sur {total}</Text>
          </View>

          {/* Step text */}
          <View style={styles.stepBody}>
            {step.tokens.length > 0
              ? renderTokens(step.tokens, scaleFactor)
              : <Text style={[styles.stepText, { color: colors.text }]}>{step.text}</Text>
            }
          </View>

          {/* Step ingredients */}
          {stepIngredients.length > 0 && (
            <View style={[styles.stepIngredients, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <Text style={[styles.stepIngredientsTitle, { color: colors.textMuted }]}>Ingrédients de cette étape</Text>
              {stepIngredients.map((ing, i) => (
                <Text key={i} style={[styles.stepIngredientItem, { color: colors.text }]}>
                  • {formatIngredient(ing)}
                </Text>
              ))}
            </View>
          )}

          {/* Timer launch buttons (for this step) */}
          {step.timers && step.timers.length > 0 && (
            <View style={styles.timerLaunchRow}>
              {step.timers.map((timer, ti) => {
                const id = `${currentStep}-${ti}`;
                const isRunning = timers.some((t) => t.id === id);
                return (
                  <TouchableOpacity
                    key={ti}
                    onPress={() => {
                      if (!isRunning) startTimer(currentStep, ti, timer.duration, timer.unit);
                    }}
                    style={[
                      styles.timerLaunchBtn,
                      {
                        backgroundColor: isRunning ? colors.success + '15' : colors.warning + '15',
                        borderColor: isRunning ? colors.success + '40' : colors.warning + '40',
                      },
                    ]}
                    disabled={isRunning}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timerLaunchEmoji}>{isRunning ? '✓' : '⏱'}</Text>
                    <Text style={[styles.timerLaunchText, { color: isRunning ? colors.success : colors.warning }]}>
                      {timer.duration} {timer.unit}
                    </Text>
                    {!isRunning && (
                      <Text style={[styles.timerLaunchHint, { color: colors.textMuted }]}>Lancer</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Active timers for this step (expanded) */}
          {stepTimers.length > 0 && (
            <View style={styles.activeTimersSection}>
              {stepTimers.map((t) => renderTimerCard(t))}
            </View>
          )}

          {/* Other active timers (compact) */}
          {otherTimers.length > 0 && (
            <View style={styles.otherTimersSection}>
              <Text style={[styles.otherTimersTitle, { color: colors.textMuted }]}>
                Autres minuteurs en cours
              </Text>
              <View style={styles.miniTimerRow}>
                {otherTimers.map((t) => renderTimerCard(t, true))}
              </View>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Navigation */}
        <View style={[styles.navBar, { borderTopColor: colors.borderLight, backgroundColor: colors.card }]}>
          <TouchableOpacity
            onPress={goPrev}
            style={[styles.navBtn, { opacity: currentStep === 0 ? 0.3 : 1 }]}
            disabled={currentStep === 0}
            activeOpacity={0.7}
          >
            <Text style={[styles.navBtnArrow, { color: colors.text }]}>‹</Text>
            <Text style={[styles.navBtnLabel, { color: colors.textSub }]}>Précédent</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleStepDone}
            style={[styles.navDoneBtn, { backgroundColor: isStepDone ? colors.success : primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.navDoneBtnText}>
              {isStepDone ? '✓ Fait' : 'Valider'}
            </Text>
          </TouchableOpacity>

          {currentStep < total - 1 ? (
            <TouchableOpacity onPress={goNext} style={styles.navBtn} activeOpacity={0.7}>
              <Text style={[styles.navBtnArrow, { color: colors.text }]}>›</Text>
              <Text style={[styles.navBtnLabel, { color: colors.textSub }]}>Suivant</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onFinish?.();
                onClose();
              }}
              style={styles.navBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.navBtnArrow, { color: colors.success }]}>✓</Text>
              <Text style={[styles.navBtnLabel, { color: colors.success }]}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  closeText: { fontSize: FontSize.title, fontWeight: FontWeight.semibold },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerSub: { fontSize: FontSize.caption, marginTop: 1 },
  doneBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  // Progress
  progressTrack: { height: 4 },
  progressFill: { height: 4, borderRadius: 2 },
  // Content
  scrollContent: { flex: 1 },
  scrollInner: { paddingHorizontal: 24, paddingTop: 28 },
  stepCounter: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  stepBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  stepBadgeText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  stepOf: { fontSize: FontSize.sm },
  stepBody: { marginBottom: 24 },
  stepText: { fontSize: FontSize.title, lineHeight: 30, fontWeight: FontWeight.normal },
  tokenIngredient: { fontWeight: FontWeight.semibold, borderRadius: 4, overflow: 'hidden' },
  tokenCookware: { fontWeight: FontWeight.semibold, fontStyle: 'italic' },
  tokenTimer: { fontWeight: FontWeight.bold, textDecorationLine: 'underline' },
  // Step ingredients
  stepIngredients: {
    borderRadius: 12, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 16,
  },
  stepIngredientsTitle: {
    fontSize: FontSize.caption, fontWeight: FontWeight.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  stepIngredientItem: { fontSize: FontSize.sm, lineHeight: 22 },
  // Timer launch buttons
  timerLaunchRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16,
  },
  timerLaunchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
  },
  timerLaunchEmoji: { fontSize: FontSize.title },
  timerLaunchText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  timerLaunchHint: { fontSize: FontSize.caption, marginLeft: 4 },
  // Active timer cards
  activeTimersSection: { gap: 12, marginBottom: 16 },
  timerCard: {
    borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, gap: 14,
  },
  timerCardMain: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  timerTime: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy, fontVariant: ['tabular-nums'] },
  timerCardInfo: { flex: 1 },
  timerLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  timerStepRef: { fontSize: FontSize.label, marginTop: 2 },
  timerActions: {
    flexDirection: 'row', gap: 8,
  },
  timerActionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  timerActionText: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  // Other timers (compact)
  otherTimersSection: { marginBottom: 16, gap: 8 },
  otherTimersTitle: {
    fontSize: FontSize.caption, fontWeight: FontWeight.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  miniTimerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniTimer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1,
  },
  miniTimerText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] },
  miniTimerLabel: { fontSize: FontSize.caption },
  // Navigation
  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navBtnArrow: { fontSize: FontSize.display, fontWeight: '300' },
  navBtnLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.medium, marginTop: 2 },
  navDoneBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  navDoneBtnText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
