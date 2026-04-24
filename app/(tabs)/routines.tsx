/**
 * routines.tsx — Écran Routines matin/soir
 *
 * Séquence d'étapes visuelles avec timer optionnel par étape.
 * Compléter une routine entière = points gamification.
 * Progression quotidienne sauvegardée dans SecureStore.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withSequence,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useGamification } from '../../hooks/useGamification';
import { useGarden } from '../../hooks/useGarden';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { useTranslation } from 'react-i18next';
import { ModalHeader } from '../../components/ui';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Routine, RoutineProgress } from '../../lib/types';
import { format } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { parseRoutines } from '../../lib/parser';
import { RoutineEditor } from '../../components/RoutineEditor';
import { VisualRoutinePlayer } from '../../components/VisualRoutinePlayer';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { EmptyState } from '../../components/EmptyState';

const PROGRESS_KEY_PREFIX = 'routine_progress_';
const DEFAULT_ROUTINES_TEMPLATE = `# Routines

## ☀️ Matin
- Se brosser les dents ~3min
- S'habiller ~5min
- Petit-déjeuner ~15min
- Préparer les affaires ~5min

## 🌙 Soir
- Bain / douche ~15min
- Se brosser les dents ~3min
- Pyjama ~3min
- Histoire ~10min
`;

type DayProgress = Record<string, RoutineProgress>;

function getProgressKey(): string {
  return PROGRESS_KEY_PREFIX + format(new Date(), 'yyyy-MM-dd');
}

async function loadDayProgress(): Promise<DayProgress> {
  try {
    const raw = await SecureStore.getItemAsync(getProgressKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveDayProgress(progress: DayProgress): Promise<void> {
  await SecureStore.setItemAsync(getProgressKey(), JSON.stringify(progress));
}

// ─── Timer component ──────────────────────────────────────────────────────────

function Timer({ durationMinutes, onComplete }: { durationMinutes: number; onComplete: () => void }) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalSeconds = durationMinutes * 60;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0 && isRunning) {
      setIsRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }
  }, [secondsLeft, isRunning, onComplete]);

  const toggle = () => {
    if (isRunning) {
      setIsRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      if (secondsLeft <= 0) return;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(true);
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
    }
  };

  const skip = () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onComplete();
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = 1 - secondsLeft / totalSeconds;

  return (
    <View style={timerStyles.container}>
      <View style={[timerStyles.ring, { borderColor: colors.border }]}>
        <View
          style={[
            timerStyles.ringFill,
            {
              borderColor: primary,
              borderTopColor: progress > 0.25 ? primary : 'transparent',
              borderRightColor: progress > 0.5 ? primary : 'transparent',
              borderBottomColor: progress > 0.75 ? primary : 'transparent',
              transform: [{ rotate: `${progress * 360}deg` }],
            },
          ]}
        />
        <Text style={[timerStyles.time, { color: colors.text }]}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </Text>
      </View>
      <View style={timerStyles.buttons}>
        <TouchableOpacity
          style={[timerStyles.btn, { backgroundColor: isRunning ? colors.warning : primary }]}
          onPress={toggle}
          activeOpacity={0.7}
        >
          <Text style={[timerStyles.btnText, { color: colors.onPrimary }]}>
            {isRunning ? t('routines.timer.pause') : t('routines.timer.start')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[timerStyles.btnSkip, { backgroundColor: colors.cardAlt }]}
          onPress={skip}
          activeOpacity={0.7}
        >
          <Text style={[timerStyles.btnSkipText, { color: colors.textSub }]}>{t('routines.timer.skip')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Routine Player Modal ─────────────────────────────────────────────────────

function RoutinePlayer({
  routine,
  progress,
  onStepComplete,
  onClose,
  onRoutineComplete,
}: {
  routine: Routine;
  progress: RoutineProgress;
  onStepComplete: (stepIndex: number) => void;
  onClose: () => void;
  onRoutineComplete: () => void;
}) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const completedSet = new Set(progress.completedSteps);

  // Trouver la prochaine étape non complétée
  const nextStepIndex = routine.steps.findIndex((_, i) => !completedSet.has(i));
  const [activeStep, setActiveStep] = useState(nextStepIndex >= 0 ? nextStepIndex : 0);
  const allDone = routine.steps.every((_, i) => completedSet.has(i));

  const step = routine.steps[activeStep];
  const isStepDone = completedSet.has(activeStep);
  const doneCount = progress.completedSteps.length;
  const totalSteps = routine.steps.length;
  const progressPct = totalSteps > 0 ? doneCount / totalSteps : 0;

  const scale = useSharedValue(1);
  const checkScale = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleComplete = useCallback(() => {
    if (!isStepDone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scale.value = withSequence(
        withSpring(1.3, { damping: 4 }),
        withSpring(1, { damping: 8 })
      );
      onStepComplete(activeStep);

      // Aller à la prochaine étape après un court délai
      const newDoneSet = new Set(completedSet);
      newDoneSet.add(activeStep);
      setTimeout(() => {
        const next = routine.steps.findIndex((_, i) => i > activeStep && !newDoneSet.has(i));
        if (next >= 0) {
          setActiveStep(next);
        } else if (newDoneSet.size >= totalSteps) {
          onRoutineComplete();
        }
      }, 400);
    }
  }, [activeStep, isStepDone, totalSteps, completedSet, onStepComplete, onRoutineComplete, routine.steps]);

  if (allDone) {
    return (
      <View style={[playerStyles.container, { backgroundColor: colors.bg }]}>
        <ModalHeader title={`${routine.emoji} ${routine.label}`} onClose={onClose} />
        <View style={playerStyles.doneContainer}>
          <Animated.Text entering={FadeInDown.springify()} style={playerStyles.doneEmoji}>🎉</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200)} style={[playerStyles.doneTitle, { color: colors.text }]}>
            {t('routines.player.routineComplete')}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(400)} style={[playerStyles.doneSubtitle, { color: colors.textSub }]}>
            {t('routines.player.allStepsComplete')}
          </Animated.Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[playerStyles.container, { backgroundColor: colors.bg }]}>
      <ModalHeader title={`${routine.emoji} ${routine.label}`} onClose={onClose} />

      {/* Barre de progression */}
      <View style={playerStyles.progressSection}>
        <View style={[playerStyles.progressBar, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              playerStyles.progressFill,
              { backgroundColor: primary, width: `${progressPct * 100}%` },
            ]}
          />
        </View>
        <Text style={[playerStyles.progressText, { color: colors.textMuted }]}>
          {t('routines.player.stepsProgress', { done: doneCount, total: totalSteps })}
        </Text>
      </View>

      {/* Étape courante */}
      <Animated.View
        key={activeStep}
        entering={FadeIn.duration(300)}
        style={[playerStyles.stepCard, { backgroundColor: colors.card }]}
      >
        <Text style={[playerStyles.stepNumber, { color: primary }]}>
          {t('routines.player.stepNumber', { step: activeStep + 1 })}
        </Text>
        <Text style={[playerStyles.stepText, { color: colors.text }]}>
          {step?.text}
        </Text>

        {/* Timer si durée définie */}
        {step?.durationMinutes && !isStepDone ? (
          <Timer durationMinutes={step.durationMinutes} onComplete={handleComplete} />
        ) : (
          <TouchableOpacity
            style={[playerStyles.completeBtn, { backgroundColor: isStepDone ? colors.successBg : primary }]}
            onPress={handleComplete}
            disabled={isStepDone}
            activeOpacity={0.7}
          >
            <Animated.Text style={[checkScale, playerStyles.completeBtnText, { color: isStepDone ? colors.successText : colors.onPrimary }]}>
              {isStepDone ? t('routines.player.stepDone') : t('routines.player.stepFinish')}
            </Animated.Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Liste des étapes (mini) */}
      <ScrollView style={playerStyles.stepList} showsVerticalScrollIndicator={false}>
        {routine.steps.map((s, i) => {
          const done = completedSet.has(i);
          const isCurrent = i === activeStep;
          return (
            <TouchableOpacity
              key={i}
              style={[
                playerStyles.stepRow,
                { backgroundColor: isCurrent ? primary + '15' : 'transparent', borderColor: isCurrent ? primary : colors.border },
              ]}
              onPress={() => !done && setActiveStep(i)}
              activeOpacity={done ? 1 : 0.6}
            >
              <Text style={[playerStyles.stepDot, { color: done ? colors.success : colors.textFaint }]}>
                {done ? '✅' : isCurrent ? '👉' : `${i + 1}`}
              </Text>
              <Text
                style={[
                  playerStyles.stepRowText,
                  { color: done ? colors.textMuted : colors.text },
                  done && playerStyles.stepRowDone,
                ]}
                numberOfLines={1}
              >
                {s.text}
              </Text>
              {s.durationMinutes ? (
                <Text style={[playerStyles.stepDuration, { color: colors.textFaint }]}>
                  {s.durationMinutes}min
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const { routines, saveRoutines, activeProfile, vault, notifPrefs, refresh } = useVault();
  const { addContribution } = useGarden();
  const { completeTask } = useGamification({ vault, notifPrefs, onContribution: addContribution });
  const { primary, colors, isDark } = useThemeColors();
  const { showToast } = useToast();

  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const { refreshing, onRefresh } = useRefresh(refresh);

  const [dayProgress, setDayProgress] = useState<DayProgress>({});
  const [playerRoutine, setPlayerRoutine] = useState<Routine | null>(null);
  const [editorRoutine, setEditorRoutine] = useState<Routine | null | undefined>(undefined);
  // undefined = fermé, null = nouvelle routine, Routine = édition

  // Charger la progression du jour
  useEffect(() => {
    loadDayProgress().then(setDayProgress);
  }, []);

  // Créer le fichier template si aucune routine n'existe
  const templateCreated = useRef(false);
  const routineListRef = useRef<View>(null);
  useEffect(() => {
    if (routines.length === 0 && vault && !templateCreated.current) {
      templateCreated.current = true;
      vault.readFile('02 - Maison/Routines.md').catch(() => {
        vault.writeFile('02 - Maison/Routines.md', DEFAULT_ROUTINES_TEMPLATE).then(() => refresh());
      });
    }
  }, [routines.length, vault]);

  const getProgress = (routineId: string): RoutineProgress => {
    return dayProgress[routineId] || { completedSteps: [] };
  };

  const handleStepComplete = useCallback(async (routineId: string, stepIndex: number) => {
    setDayProgress(prev => {
      const rp = prev[routineId] || { completedSteps: [] };
      if (rp.completedSteps.includes(stepIndex)) return prev;
      const updated = {
        ...prev,
        [routineId]: {
          completedSteps: [...rp.completedSteps, stepIndex],
          startedAt: rp.startedAt || new Date().toISOString(),
        },
      };
      saveDayProgress(updated);
      return updated;
    });
  }, []);

  const handleRoutineComplete = useCallback(async (routine: Routine) => {
    if (!activeProfile) return;

    try {
      const { pointsGained, lootAwarded } = await completeTask(
        activeProfile,
        `Routine: ${routine.emoji} ${routine.label} complétée`
      );

      const profileName = activeProfile.name;
      showToast(
        t('routines.toast.complete', { emoji: routine.emoji, profileName, label: routine.label, points: pointsGained, loot: lootAwarded ? ' 🎁' : '' }),
        'success'
      );

      await refresh();
    } catch (e) {
      showToast(t('routines.toast.pointsError'), 'error');
    }
  }, [activeProfile, completeTask, refresh, showToast]);

  const handleEditorSave = useCallback(async (edited: Routine) => {
    let updated: Routine[];
    if (editorRoutine === null) {
      // Nouvelle routine
      updated = [...routines, edited];
    } else {
      // Modification
      updated = routines.map(r => r.id === editorRoutine?.id ? edited : r);
    }
    await saveRoutines(updated);
    setEditorRoutine(undefined);
    showToast(editorRoutine === null ? t('routines.toast.created') : t('routines.toast.modified'), 'success');
  }, [editorRoutine, routines, saveRoutines, showToast]);

  const handleEditorDelete = useCallback(async () => {
    if (!editorRoutine) return;
    const updated = routines.filter(r => r.id !== editorRoutine.id);
    await saveRoutines(updated);
    setEditorRoutine(undefined);
    showToast(t('routines.toast.deleted'), 'success');
  }, [editorRoutine, routines, saveRoutines, showToast]);

  const handleResetRoutine = useCallback(async (routineId: string) => {
    Alert.alert(
      t('routines.alert.resetTitle'),
      t('routines.alert.resetMsg'),
      [
        { text: t('routines.alert.cancel'), style: 'cancel' },
        {
          text: t('routines.alert.reset'),
          style: 'destructive',
          onPress: async () => {
            setDayProgress(prev => {
              const updated = { ...prev };
              delete updated[routineId];
              saveDayProgress(updated);
              return updated;
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ]
    );
  }, []);

  const todayLabel = format(new Date(), "EEEE d MMMM", { locale: getDateLocale() });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <View ref={routineListRef}>
        <ScreenHeader
          title="Routines"
          subtitle={todayLabel}
          actions={
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: primary }]}
              onPress={() => setEditorRoutine(null)}
              activeOpacity={0.7}
              accessibilityLabel={t('routines.a11y.addRoutine')}
              accessibilityRole="button"
            >
              <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+</Text>
            </TouchableOpacity>
          }
          scrollY={scrollY}
        />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {routines.length === 0 ? (
          <EmptyState
            emoji="⏰"
            title={t('routines.empty.title')}
            subtitle={t('routines.empty.subtitle')}
            ctaLabel={t('routines.empty.cta')}
            onCta={() => setEditorRoutine(null)}
          />
        ) : (
          routines.map((routine) => {
            const progress = getProgress(routine.id);
            const doneCount = progress.completedSteps.length;
            const totalSteps = routine.steps.length;
            const isComplete = doneCount >= totalSteps;
            const pct = totalSteps > 0 ? doneCount / totalSteps : 0;

            return (
              <Animated.View key={routine.id} entering={FadeInDown.delay(100)}>
                <TouchableOpacity
                  style={[styles.routineCard, { backgroundColor: colors.card }]}
                  onPress={() => setPlayerRoutine(routine)}
                  onLongPress={() => handleResetRoutine(routine.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('routines.a11y.routineStatus', { label: routine.label, done: doneCount, total: totalSteps })}
                >
                  <View style={styles.routineHeader}>
                    <Text style={styles.routineEmoji}>{routine.emoji}</Text>
                    <View style={styles.routineInfo}>
                      <Text style={[styles.routineLabel, { color: colors.text }]}>
                        {routine.label}
                      </Text>
                      <Text style={[styles.routineSteps, { color: colors.textMuted }]}>
                        {t('routines.card.steps', { count: totalSteps })}
                        {routine.steps.some(s => s.durationMinutes) &&
                          ` · ~${routine.steps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0)}min`}
                        {routine.isVisual && ` ${t('routines.card.visual')}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.editBtn, { backgroundColor: colors.cardAlt }]}
                      onPress={() => setEditorRoutine(routine)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={t('routines.a11y.editRoutine', { label: routine.label })}
                    >
                      <Text style={[styles.editBtnText, { color: colors.textMuted }]}>✏️</Text>
                    </TouchableOpacity>
                    {isComplete ? (
                      <View style={[styles.doneBadge, { backgroundColor: colors.successBg }]}>
                        <Text style={[styles.doneBadgeText, { color: colors.successText }]}>{t('routines.card.done')}</Text>
                      </View>
                    ) : doneCount > 0 ? (
                      <View style={[styles.doneBadge, { backgroundColor: primary + '20' }]}>
                        <Text style={[styles.doneBadgeText, { color: primary }]}>{doneCount}/{totalSteps}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Barre de progression */}
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: isComplete ? colors.success : primary,
                          width: `${pct * 100}%`,
                        },
                      ]}
                    />
                  </View>

                  {/* Aperçu des étapes */}
                  <View style={styles.stepsPreview}>
                    {routine.steps.map((step, i) => {
                      const done = progress.completedSteps.includes(i);
                      return (
                        <View key={i} style={styles.stepPreviewRow}>
                          <Text style={[styles.stepPreviewDot, { color: done ? colors.success : colors.textFaint }]}>
                            {done ? '✅' : '○'}
                          </Text>
                          <Text
                            style={[
                              styles.stepPreviewText,
                              { color: done ? colors.textMuted : colors.textSub },
                              done && styles.stepPreviewDone,
                            ]}
                            numberOfLines={1}
                          >
                            {step.text}
                          </Text>
                          {step.durationMinutes ? (
                            <Text style={[styles.stepDuration, { color: colors.textFaint }]}>
                              {step.durationMinutes}min
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>

                  {/* Bouton lancer */}
                  {!isComplete && (
                    <TouchableOpacity
                      style={[styles.startBtn, { backgroundColor: primary }]}
                      onPress={() => setPlayerRoutine(routine)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.startBtnText, { color: colors.onPrimary }]}>
                        {doneCount > 0 ? t('routines.continueBtn') : t('routines.startBtn')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.cardAlt }]}>
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            {t('routines.card.hint')}
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Player Modal — mode classique (texte) */}
      <Modal
        visible={!!playerRoutine && !playerRoutine.isVisual}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPlayerRoutine(null)}
      >
        {playerRoutine && !playerRoutine.isVisual && (
          <RoutinePlayer
            routine={playerRoutine}
            progress={getProgress(playerRoutine.id)}
            onStepComplete={(stepIndex) => handleStepComplete(playerRoutine.id, stepIndex)}
            onClose={() => setPlayerRoutine(null)}
            onRoutineComplete={() => handleRoutineComplete(playerRoutine)}
          />
        )}
      </Modal>

      {/* Player Modal — mode visuel (gros emojis pour petits) */}
      {playerRoutine && (
        <VisualRoutinePlayer
          visible={!!playerRoutine?.isVisual}
          routine={playerRoutine}
          progress={getProgress(playerRoutine.id)}
          onStepComplete={(stepIndex) => handleStepComplete(playerRoutine.id, stepIndex)}
          onRoutineComplete={() => handleRoutineComplete(playerRoutine)}
          onClose={() => setPlayerRoutine(null)}
        />
      )}

      {/* Editor Modal */}
      <Modal
        visible={editorRoutine !== undefined}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditorRoutine(undefined)}
      >
        {editorRoutine !== undefined && (
          <RoutineEditor
            routine={editorRoutine || undefined}
            onSave={handleEditorSave}
            onDelete={editorRoutine ? handleEditorDelete : undefined}
            onClose={() => setEditorRoutine(undefined)}
          />
        )}
      </Modal>

      <ScreenGuide
        screenId="routines"
        targets={[
          { ref: routineListRef, ...HELP_CONTENT.routines[0] },
        ]}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], paddingBottom: 90, gap: Spacing.xl },

  // Carte routine
  routineCard: {
    borderRadius: 20,
    padding: Spacing['2xl'],
    ...Shadows.md,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  routineEmoji: { fontSize: 36 },
  routineInfo: { flex: 1 },
  routineLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  routineSteps: { fontSize: FontSize.sm, marginTop: 2 },
  doneBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  doneBadgeText: { fontSize: FontSize.caption, fontWeight: FontWeight.bold },

  // Barre de progression
  progressBar: {
    height: 6,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  // Aperçu étapes
  stepsPreview: { gap: Spacing.sm },
  stepPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 2,
  },
  stepPreviewDot: { fontSize: FontSize.sm, width: 20, textAlign: 'center' },
  stepPreviewText: { flex: 1, fontSize: FontSize.sm },
  stepPreviewDone: { textDecorationLine: 'line-through' },
  stepDuration: { fontSize: FontSize.caption },

  // Bouton commencer
  startBtn: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  startBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },

  // Bouton ajouter (header)
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, lineHeight: 18 },

  // Bouton modifier (carte)
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  editBtnText: { fontSize: FontSize.lg },


  // Info
  infoCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  infoText: { fontSize: FontSize.caption, lineHeight: 18 },
});

const timerStyles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: Spacing['2xl'], gap: Spacing.xl },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringFill: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
  },
  time: { fontSize: FontSize.hero, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: Spacing.lg },
  btn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
  },
  btnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  btnSkip: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
  },
  btnSkipText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
});

const playerStyles = StyleSheet.create({
  container: { flex: 1 },
  progressSection: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  progressText: { fontSize: FontSize.caption, textAlign: 'center' },

  // Étape courante
  stepCard: {
    marginHorizontal: Spacing['2xl'],
    borderRadius: 20,
    padding: Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.xl,
    ...Shadows.md,
  },
  stepNumber: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1 },
  stepText: { fontSize: FontSize.titleLg, fontWeight: FontWeight.bold, textAlign: 'center' },
  completeBtn: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    marginTop: Spacing.lg,
  },
  completeBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  // Liste des étapes
  stepList: {
    flex: 1,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  stepDot: { fontSize: FontSize.sm, width: 24, textAlign: 'center' },
  stepRowText: { flex: 1, fontSize: FontSize.sm },
  stepRowDone: { textDecorationLine: 'line-through' },
  stepDuration: { fontSize: FontSize.caption },

  // Terminé
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  doneEmoji: { fontSize: 80 },
  doneTitle: { fontSize: FontSize.hero, fontWeight: FontWeight.heavy },
  doneSubtitle: { fontSize: FontSize.body },
});
