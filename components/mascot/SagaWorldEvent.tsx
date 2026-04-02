/**
 * SagaWorldEvent.tsx — Expérience immersive saga dans le diorama de l'écran Arbre
 *
 * Se superpose en absolute au diorama. Affiche :
 * - Vignette sombre animée sur les bords
 * - Esprit narratif (cercle lumineux pulsant avec emoji thématique)
 * - Texte narratif en typewriter
 * - Choix sous forme de cartes flottantes slide-in
 * - Transition cliffhanger ou finale dramatique selon le chapitre
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../../contexts/ThemeContext';
import type { SagaProgress, SagaTrait } from '../../lib/mascot/sagas-types';
import {
  getChapterNarrativeKey,
  getSagaById,
  getSagaCompletionResult,
} from '../../lib/mascot/sagas-engine';
import { Radius, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import type { Profile } from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────

type Phase =
  | 'entering'
  | 'narrative'
  | 'choices'
  | 'chosen'
  | 'cliffhanger'
  | 'finale_reveal'
  | 'dismissing';

export interface SagaWorldEventProps {
  sagaProgress: SagaProgress;
  profile: Profile;
  containerHeight: number;
  onChapterComplete: (
    choiceId: string,
    points: number,
    sagaNote: string,
    rewardItem?: { id: string; type: 'decoration' | 'inhabitant' },
  ) => Promise<void>;
  onDismiss: () => void;
}

// ─── Composant ────────────────────────────────────────────────

export function SagaWorldEvent({
  sagaProgress,
  containerHeight,
  onChapterComplete,
  onDismiss,
}: SagaWorldEventProps) {
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();

  // Dériver les données saga (fait avant tout hook)
  const activeSaga = getSagaById(sagaProgress.sagaId);
  const currentChapter = activeSaga?.chapters.find(ch => ch.id === sagaProgress.currentChapter) ?? null;
  const narrativeKey = activeSaga && currentChapter
    ? getChapterNarrativeKey(currentChapter, sagaProgress.traits, activeSaga.finale.defaultTrait)
    : '';

  // ── Shared values (tous déclarés inconditionnellement) ──────
  const vignetteOpacity = useSharedValue(0);
  const spiritOpacity   = useSharedValue(0);
  const spiritScale     = useSharedValue(0);
  const spiritY         = useSharedValue(0);
  const bubbleOpacity   = useSharedValue(0);
  const bubbleTransY    = useSharedValue(24);

  const traitFlashOpacity = useSharedValue(0);
  const traitFlashScale   = useSharedValue(0.8);

  // 3 cartes de choix (max 3 options)
  const c0TransY = useSharedValue(80);  const c1TransY = useSharedValue(80);  const c2TransY = useSharedValue(80);
  const c0Opacity = useSharedValue(0);  const c1Opacity = useSharedValue(0);  const c2Opacity = useSharedValue(0);
  const c0Scale   = useSharedValue(1);  const c1Scale   = useSharedValue(1);  const c2Scale   = useSharedValue(1);

  // ── Animated styles (tous déclarés inconditionnellement) ────
  const vignetteStyle = useAnimatedStyle(() => ({
    opacity: vignetteOpacity.value,
  }));

  const spiritStyle = useAnimatedStyle(() => ({
    opacity: spiritOpacity.value,
    transform: [
      { scale: spiritScale.value },
      { translateY: spiritY.value },
    ],
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
    transform: [{ translateY: bubbleTransY.value }],
  }));

  const traitStyle = useAnimatedStyle(() => ({
    opacity: traitFlashOpacity.value,
    transform: [{ scale: traitFlashScale.value }],
  }));

  // Styles cartes de choix
  const choice0Style = useAnimatedStyle(() => ({
    opacity: c0Opacity.value,
    transform: [{ translateY: c0TransY.value }, { scale: c0Scale.value }],
  }));
  const choice1Style = useAnimatedStyle(() => ({
    opacity: c1Opacity.value,
    transform: [{ translateY: c1TransY.value }, { scale: c1Scale.value }],
  }));
  const choice2Style = useAnimatedStyle(() => ({
    opacity: c2Opacity.value,
    transform: [{ translateY: c2TransY.value }, { scale: c2Scale.value }],
  }));
  const choiceAnimStyles = [choice0Style, choice1Style, choice2Style];

  // Accesseurs tableaux pour les animations choix
  const choiceTransYs  = [c0TransY,  c1TransY,  c2TransY];
  const choiceOpacities = [c0Opacity, c1Opacity, c2Opacity];
  const choiceScales   = [c0Scale,   c1Scale,   c2Scale];

  // ── State ────────────────────────────────────────────────────
  const [phase, setPhase]                   = useState<Phase>('entering');
  const [revealedChars, setRevealedChars]   = useState(0);
  const [cliffChars, setCliffChars]         = useState(0);
  const [finaleChars, setFinaleChars]       = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting]     = useState(false);

  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTypeTimer = () => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
  };

  // ── Textes dérivés ───────────────────────────────────────────
  const narrativeText   = narrativeKey ? t(narrativeKey) : '';
  const cliffhangerText = currentChapter ? t(currentChapter.cliffhangerKey) : '';
  const isLastChapter   = activeSaga ? sagaProgress.currentChapter >= activeSaga.chapters.length : false;

  // Trait gagné par le choix sélectionné
  const gainedTrait = selectedChoiceId && currentChapter
    ? (Object.entries(
        currentChapter.choices.find(c => c.id === selectedChoiceId)?.traits ?? {}
      ).find(([, v]) => (v ?? 0) > 0)?.[0] as SagaTrait | undefined)
    : undefined;

  // ── Helper : dismiss animé ───────────────────────────────────
  const animateDismiss = useCallback(() => {
    clearTypeTimer();
    vignetteOpacity.value = withTiming(0, { duration: 500 });
    spiritOpacity.value   = withTiming(0, { duration: 500 });
    bubbleOpacity.value   = withTiming(0, { duration: 400 });
    c0Opacity.value = withTiming(0, { duration: 300 });
    c1Opacity.value = withTiming(0, { duration: 300 });
    c2Opacity.value = withTiming(0, { duration: 300 });
    traitFlashOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(onDismiss, 600);
  }, [onDismiss]);

  // ── Helper : typewriter ──────────────────────────────────────
  const startTypewriter = useCallback((
    text: string,
    setChars: (n: number) => void,
    onComplete: () => void,
    charDelay = 22,
  ) => {
    clearTypeTimer();
    let idx = 0;
    setChars(0);
    typeTimerRef.current = setInterval(() => {
      idx += 1;
      setChars(idx);
      if (idx >= text.length) {
        clearTypeTimer();
        onComplete();
      }
    }, charDelay);
  }, []);

  // ── Phase 1 : Entering ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'entering') return;
    vignetteOpacity.value = withTiming(1, { duration: 700 });
    spiritOpacity.value   = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
    spiritScale.value     = withSpring(1, { damping: 12, stiffness: 110 });

    const t1 = setTimeout(() => {
      // Lancer la pulsation une fois l'entrée terminée
      spiritScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.94, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      setPhase('narrative');
    }, 1300);

    return () => clearTimeout(t1);
  }, [phase]);

  // ── Phase 2 : Narrative typewriter ───────────────────────────
  useEffect(() => {
    if (phase !== 'narrative') return;
    if (!narrativeText) return;

    bubbleOpacity.value = withTiming(1, { duration: 400 });
    bubbleTransY.value  = withSpring(0, { damping: 14, stiffness: 180 });

    startTypewriter(narrativeText, setRevealedChars, () => {
      setTimeout(() => setPhase('choices'), 700);
    });

    return clearTypeTimer;
  }, [phase, narrativeText]);

  // ── Phase 3 : Choices slide-in ────────────────────────────────
  useEffect(() => {
    if (phase !== 'choices' || !currentChapter) return;
    currentChapter.choices.forEach((_, idx) => {
      const delay = 150 + idx * 140;
      setTimeout(() => {
        choiceTransYs[idx].value  = withSpring(0, { damping: 14, stiffness: 200 });
        choiceOpacities[idx].value = withTiming(1, { duration: 280 });
      }, delay);
    });
  }, [phase]);

  // ── Handler tap choix ────────────────────────────────────────
  const handleChoicePress = useCallback(async (choiceId: string, idx: number) => {
    if (isCompleting || !currentChapter || !activeSaga) return;
    setIsCompleting(true);

    const choice = currentChapter.choices.find(c => c.id === choiceId);
    if (!choice) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedChoiceId(choiceId);
    setPhase('chosen');

    // Carte sélectionnée : scale-up
    choiceScales[idx].value = withSpring(1.06, { damping: 10, stiffness: 220 });

    // Autres cartes disparaissent
    currentChapter.choices.forEach((_, i) => {
      if (i !== idx) {
        choiceOpacities[i].value = withTiming(0, { duration: 250 });
        choiceTransYs[i].value   = withTiming(50, { duration: 250 });
      }
    });

    // Carte sélectionnée disparaît après 600ms
    setTimeout(() => {
      choiceOpacities[idx].value = withTiming(0, { duration: 350 });
      choiceScales[idx].value    = withTiming(0.85, { duration: 350 });
    }, 600);

    // Flash du trait gagné
    if (Object.values(choice.traits).some(v => (v ?? 0) > 0)) {
      traitFlashOpacity.value = withSequence(
        withTiming(1, { duration: 280 }),
        withTiming(1, { duration: 1100 }),
        withTiming(0, { duration: 380 }),
      );
      traitFlashScale.value = withSequence(
        withSpring(1, { damping: 10, stiffness: 200 }),
        withTiming(0.85, { duration: 380 }),
      );
    }

    // Calculer newTraits pour la complétion finale
    const newTraits = { ...sagaProgress.traits };
    for (const [trait, val] of Object.entries(choice.traits)) {
      newTraits[trait as SagaTrait] = (newTraits[trait as SagaTrait] ?? 0) + (val ?? 0);
    }

    const nextChapterNum = sagaProgress.currentChapter + 1;
    const isFinal = nextChapterNum > activeSaga.chapters.length;

    let rewardItem: { id: string; type: 'decoration' | 'inhabitant' } | undefined;
    let totalPoints = choice.points;
    let sagaNote = `Saga: ${activeSaga.id} ch${currentChapter.id}`;

    if (isFinal) {
      const updatedProgress = {
        ...sagaProgress,
        currentChapter: nextChapterNum,
        choices: { ...sagaProgress.choices, [currentChapter.id]: choiceId },
        traits: newTraits,
        status: 'completed' as const,
      };
      const result = getSagaCompletionResult(activeSaga, updatedProgress);
      totalPoints += result.bonusXP;
      sagaNote = `Saga terminée: ${activeSaga.id} ch${currentChapter.id} (${result.dominantTrait})`;
      rewardItem = {
        id: result.rewardItemId,
        type: result.rewardType === 'mascot_deco' ? 'decoration' : 'inhabitant',
      };
    }

    try {
      await onChapterComplete(choiceId, totalPoints, sagaNote, rewardItem);
    } catch {
      // Non-critique
    }

    // Afficher cliffhanger ou finale
    setTimeout(() => {
      if (isFinal) {
        setPhase('finale_reveal');
      } else {
        setPhase('cliffhanger');
      }
    }, 1100);
  }, [isCompleting, currentChapter, activeSaga, sagaProgress, choiceScales, choiceOpacities, choiceTransYs, onChapterComplete]);

  // ── Phase cliffhanger ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'cliffhanger') return;

    // Reset bulle
    bubbleOpacity.value = 0;
    bubbleTransY.value  = 20;

    const t1 = setTimeout(() => {
      bubbleOpacity.value = withTiming(1, { duration: 350 });
      bubbleTransY.value  = withSpring(0, { damping: 14, stiffness: 180 });

      startTypewriter(cliffhangerText, setCliffChars, () => {
        // Après le cliffhanger, dismiss auto
        setTimeout(animateDismiss, 2200);
      });
    }, 400);

    return () => {
      clearTimeout(t1);
      clearTypeTimer();
    };
  }, [phase, cliffhangerText]);

  // ── Phase finale ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'finale_reveal' || !activeSaga) return;

    // Reset bulle
    bubbleOpacity.value = 0;
    bubbleTransY.value  = 20;

    // L'esprit s'élève et grossit
    spiritY.value     = withSpring(-70, { damping: 9, stiffness: 90 });
    spiritScale.value = withSpring(1.6, { damping: 8, stiffness: 80 });

    // Texte finale après 1.4s
    const t1 = setTimeout(() => {
      bubbleOpacity.value = withTiming(1, { duration: 450 });
      bubbleTransY.value  = withSpring(0, { damping: 14, stiffness: 180 });

      const finaleMsg = t('mascot.saga.complete');
      startTypewriter(finaleMsg, setFinaleChars, () => {
        // Dismiss après lecture
        setTimeout(animateDismiss, 2800);
      });
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTypeTimer();
    };
  }, [phase, activeSaga]);

  // Cleanup
  useEffect(() => () => clearTypeTimer(), []);

  // ── Rendu conditionnel (après tous les hooks) ─────────────────
  if (!activeSaga || !currentChapter) return null;

  // Textes affichés
  const displayNarrative =
    phase === 'narrative'
      ? narrativeText.slice(0, revealedChars)
      : narrativeText;

  const displayCliffhanger =
    phase === 'cliffhanger'
      ? cliffhangerText.slice(0, cliffChars)
      : '';

  const displayFinale =
    phase === 'finale_reveal'
      ? t('mascot.saga.complete').slice(0, finaleChars)
      : '';

  const showNarrativeBubble = phase === 'narrative' || phase === 'choices' || phase === 'chosen';
  const showChoices = phase === 'choices' || phase === 'chosen';

  return (
    <View
      style={[styles.container, { height: containerHeight }]}
      pointerEvents="box-none"
    >
      {/* ── Vignette sombre animée ─────────────────────────────── */}
      <Animated.View style={[styles.vignette, vignetteStyle]} pointerEvents="none" />

      {/* ── Esprit narratif (centré, haut du diorama) ─────────── */}
      <Animated.View style={[styles.spiritWrapper, spiritStyle]} pointerEvents="none">
        <View
          style={[
            styles.spiritGlow,
            {
              borderColor: primary + '70',
              backgroundColor: primary + '18',
              shadowColor: primary,
            },
          ]}
        >
          <Text style={styles.spiritEmoji}>{activeSaga.sceneEmoji}</Text>
        </View>
      </Animated.View>

      {/* ── Bulle narrative / cliffhanger / finale ──────────────── */}
      {(showNarrativeBubble || phase === 'cliffhanger' || phase === 'finale_reveal') && (
        <Animated.View style={[styles.bubbleWrapper, bubbleStyle]} pointerEvents="none">
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: isDark ? colors.card + 'F2' : colors.bg + 'F7',
                borderColor: primary + '38',
              },
              Shadows.md,
            ]}
          >
            {showNarrativeBubble && (
              <>
                <Text style={[styles.chapterLabel, { color: colors.textMuted }]}>
                  {t('mascot.saga.progress', {
                    current: sagaProgress.currentChapter,
                    total: activeSaga.chapters.length,
                  })}
                </Text>
                <Text style={[styles.narrativeText, { color: colors.text }]}>
                  {displayNarrative}
                </Text>
              </>
            )}
            {phase === 'cliffhanger' && (
              <Text style={[styles.narrativeText, { color: colors.textSub, fontStyle: 'italic' }]}>
                {displayCliffhanger}
              </Text>
            )}
            {phase === 'finale_reveal' && (
              <>
                <Text style={[styles.finaleTitle, { color: primary }]}>
                  {displayFinale}
                </Text>
                <Text style={[styles.finaleEmoji]}>{'✨'}</Text>
              </>
            )}
          </View>
        </Animated.View>
      )}

      {/* ── Flash trait gagné ────────────────────────────────────── */}
      {gainedTrait && (
        <Animated.View style={[styles.traitFlashWrapper, traitStyle]} pointerEvents="none">
          <View style={[styles.traitFlashCard, { backgroundColor: primary }]}>
            <Text style={[styles.traitFlashText, { color: colors.onPrimary }]}>
              {`✨ ${t(`mascot.saga.traitLabel.${gainedTrait}`)}`}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Cartes de choix ──────────────────────────────────────── */}
      {showChoices && (
        <View style={styles.choicesWrapper} pointerEvents={phase === 'chosen' ? 'none' : 'box-none'}>
          {currentChapter.choices.map((choice, idx) => {
            const isSelected = selectedChoiceId === choice.id;
            return (
              <Animated.View key={choice.id} style={choiceAnimStyles[idx]}>
                <TouchableOpacity
                  style={[
                    styles.choiceCard,
                    {
                      backgroundColor: isSelected
                        ? primary
                        : isDark
                          ? colors.card + 'F0'
                          : colors.bg + 'F8',
                      borderColor: isSelected ? primary : primary + '40',
                    },
                    Shadows.sm,
                  ]}
                  onPress={() => handleChoicePress(choice.id, idx)}
                  activeOpacity={0.82}
                  disabled={phase === 'chosen'}
                >
                  <Text style={styles.choiceEmoji}>{choice.emoji}</Text>
                  <View style={styles.choiceTextWrap}>
                    <Text
                      style={[
                        styles.choiceLabel,
                        { color: isSelected ? colors.onPrimary : colors.text },
                      ]}
                      numberOfLines={2}
                    >
                      {t(choice.labelKey)}
                    </Text>
                    <Text
                      style={[
                        styles.choicePts,
                        { color: isSelected ? colors.onPrimaryMuted : colors.textMuted },
                      ]}
                    >
                      {`+${choice.points} pts`}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
  },

  // Vignette sombre sur les bords
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 28,
  },

  // Esprit narratif
  spiritWrapper: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  spiritGlow: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  spiritEmoji: {
    fontSize: 36,
  },

  // Bulle narrative
  bubbleWrapper: {
    position: 'absolute',
    top: '38%',
    left: Spacing['2xl'],
    right: Spacing['2xl'],
  },
  bubble: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  chapterLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  narrativeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.normal,
    lineHeight: LineHeight.body,
    textAlign: 'center',
  },
  finaleTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  finaleEmoji: {
    fontSize: FontSize.icon,
    textAlign: 'center',
  },

  // Flash trait
  traitFlashWrapper: {
    position: 'absolute',
    top: '62%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  traitFlashCard: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  traitFlashText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Cartes de choix (bottom)
  choicesWrapper: {
    position: 'absolute',
    bottom: Spacing['3xl'],
    left: Spacing['2xl'],
    right: Spacing['2xl'],
    gap: Spacing.md,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius['lg+'],
    borderWidth: 1,
    gap: Spacing.md,
  },
  choiceEmoji: {
    fontSize: FontSize.title,
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    lineHeight: LineHeight.tight,
  },
  choicePts: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
});
