import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import type { AppRecipe, AppStep, StepToken, AppIngredient } from '../lib/cooklang';
import { renderStepText, formatIngredient, scaleIngredients } from '../lib/cooklang';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecipeCookingModeProps {
  recipe: AppRecipe;
  scaleFactor: number;
  servings: number;
  onClose: () => void;
}

export default function RecipeCookingMode({ recipe, scaleFactor, servings, onClose }: RecipeCookingModeProps) {
  const { primary, tint, colors } = useThemeColors();
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [activeTimer, setActiveTimer] = useState<{ stepIdx: number; timerIdx: number; remaining: number; total: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = recipe.steps;
  const total = steps.length;
  const step = steps[currentStep];
  const progress = useSharedValue(0);

  // Scale ingredients for current step
  const stepIngredients = step?.ingredients
    ? scaleIngredients(step.ingredients, servings, recipe.servings || 1)
    : [];

  // Progress animation
  useEffect(() => {
    progress.value = withSpring((currentStep + 1) / total, { damping: 15, stiffness: 100 });
  }, [currentStep, total]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%`,
  }));

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
        // Auto-advance après un court délai
        if (currentStep < total - 1) {
          setTimeout(() => setCurrentStep((s) => Math.min(s + 1, total - 1)), 400);
        }
      }
      return next;
    });
  }, [currentStep, total]);

  const startTimer = useCallback((stepIdx: number, timerIdx: number, duration: number, unit: string) => {
    // Convertir en secondes
    let seconds = duration;
    const u = unit.toLowerCase();
    if (u.startsWith('min')) seconds = duration * 60;
    else if (u.startsWith('h') || u === 'hour' || u === 'hours' || u === 'heure' || u === 'heures') seconds = duration * 3600;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Nettoyer timer existant
    if (timerRef.current) clearInterval(timerRef.current);

    setActiveTimer({ stepIdx, timerIdx, remaining: seconds, total: seconds });

    timerRef.current = setInterval(() => {
      setActiveTimer((prev) => {
        if (!prev || prev.remaining <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setActiveTimer(null);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
    return `${s}s`;
  };

  const isStepDone = checkedSteps.has(currentStep);
  const doneCount = checkedSteps.size;

  /** Render step text with highlighted tokens */
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
              : qty != null
                ? `${qty} ${t.name}`
                : t.name;
            return (
              <Text key={i} style={[styles.tokenIngredient, { color: primary, backgroundColor: primary + '15' }]}>
                {label}
              </Text>
            );
          }
          if (t.type === 'cookware') {
            return (
              <Text key={i} style={[styles.tokenCookware, { color: tint }]}>
                {t.name}
              </Text>
            );
          }
          if (t.type === 'timer') {
            return (
              <Text key={i} style={[styles.tokenTimer, { color: '#F59E0B' }]}>
                {t.quantity} {t.unit}
              </Text>
            );
          }
          return null;
        })}
      </Text>
    );
  };

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
            style={[styles.doneBtn, { backgroundColor: isStepDone ? '#22C55E' : colors.cardAlt }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.doneBtnText, { color: isStepDone ? '#FFFFFF' : colors.textMuted }]}>
              {isStepDone ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.cardAlt }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: primary }, progressStyle]} />
        </View>

        {/* Step content */}
        <View style={styles.content}>
          {/* Step counter */}
          <View style={styles.stepCounter}>
            <View style={[styles.stepBadge, { backgroundColor: primary }]}>
              <Text style={styles.stepBadgeText}>Étape {currentStep + 1}</Text>
            </View>
            <Text style={[styles.stepOf, { color: colors.textMuted }]}>sur {total}</Text>
          </View>

          {/* Step text with tokens */}
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

          {/* Timers */}
          {step.timers && step.timers.length > 0 && (
            <View style={styles.timersContainer}>
              {step.timers.map((timer, ti) => {
                const isActive = activeTimer?.stepIdx === currentStep && activeTimer?.timerIdx === ti;
                return (
                  <TouchableOpacity
                    key={ti}
                    onPress={() => {
                      if (isActive) stopTimer();
                      else startTimer(currentStep, ti, timer.duration, timer.unit);
                    }}
                    style={[
                      styles.timerBtn,
                      { backgroundColor: isActive ? '#F59E0B' : colors.card, borderColor: isActive ? '#F59E0B' : colors.borderLight },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timerBtnEmoji]}>
                      {isActive ? '⏸' : '⏱'}
                    </Text>
                    <View>
                      <Text style={[styles.timerBtnText, { color: isActive ? '#FFFFFF' : colors.text }]}>
                        {isActive ? formatTime(activeTimer!.remaining) : `${timer.duration} ${timer.unit}`}
                      </Text>
                      <Text style={[styles.timerBtnHint, { color: isActive ? '#FFFFFF' + 'CC' : colors.textMuted }]}>
                        {isActive ? 'Tap pour arrêter' : 'Tap pour lancer'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Active timer floating (if on different step) */}
          {activeTimer && activeTimer.stepIdx !== currentStep && (
            <TouchableOpacity
              style={[styles.floatingTimer, { backgroundColor: '#F59E0B' }]}
              onPress={() => setCurrentStep(activeTimer.stepIdx)}
              activeOpacity={0.8}
            >
              <Text style={styles.floatingTimerText}>
                ⏱ {formatTime(activeTimer.remaining)} — Étape {activeTimer.stepIdx + 1}
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
            style={[styles.navDoneBtn, { backgroundColor: isStepDone ? '#22C55E' : primary }]}
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
                onClose();
              }}
              style={styles.navBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.navBtnArrow, { color: '#22C55E' }]}>✓</Text>
              <Text style={[styles.navBtnLabel, { color: '#22C55E' }]}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  closeText: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  doneBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Progress
  progressTrack: {
    height: 4,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  // Content
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  stepCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  stepBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepOf: {
    fontSize: 14,
  },
  stepBody: {
    marginBottom: 24,
  },
  stepText: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '400',
  },
  tokenIngredient: {
    fontWeight: '600',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tokenCookware: {
    fontWeight: '600',
    fontStyle: 'italic',
  },
  tokenTimer: {
    fontWeight: '700',
  },
  // Step ingredients
  stepIngredients: {
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  stepIngredientsTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stepIngredientItem: {
    fontSize: 14,
    lineHeight: 22,
  },
  // Timers
  timersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timerBtnEmoji: {
    fontSize: 22,
  },
  timerBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timerBtnHint: {
    fontSize: 11,
    marginTop: 1,
  },
  // Floating timer
  floatingTimer: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  floatingTimerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Navigation
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navBtnArrow: {
    fontSize: 24,
    fontWeight: '300',
  },
  navBtnLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  navDoneBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  navDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
