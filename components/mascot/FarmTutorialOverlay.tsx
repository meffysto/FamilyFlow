/**
 * FarmTutorialOverlay.tsx — Orchestrateur du tutoriel ferme (D-07)
 *
 * 5 étapes :
 * - 0 et 4 : cartes narratives plein écran (bienvenue + conclusion)
 * - 1, 2, 3 : coach marks rectangle arrondi (plantation, récolte, HUD XP)
 *
 * - Bouton "Passer" disponible à toutes les étapes → markScreenSeen('farm_tutorial')
 * - Déclenchement automatique au premier affichage (délai 600ms, cohérent ScreenGuide)
 * - Relance via resetScreen('farm_tutorial') depuis FarmCodexModal (hasStarted reset)
 * - Sibling de ScreenGuide — ne modifie pas ScreenGuide (D-08)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Modal, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useHelp } from '../../contexts/HelpContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { CoachMark } from '../help/CoachMark';
import { CoachMarkOverlay } from '../help/CoachMarkOverlay';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm, FarmDarkPalette, useFarmTheme, type FarmPalette } from '../../constants/farm-theme';

type Styles = ReturnType<typeof makeStyles>;

const SCREEN_ID = 'farm_tutorial';
const TRIGGER_DELAY_MS = 600;
const SPRING_CONFIG = { damping: 12, stiffness: 140 };

// Duplication locale depuis TreeView.tsx (D-02, Pitfall 5)
const SPECIES_TO_FRUIT: Record<string, string> = {
  cerisier: 'peach',
  chene: 'apple_red',
  oranger: 'orange',
  bambou: 'plum',
  palmier: 'pear',
};

// Require map statique pour Metro bundler (dynamic require casserait le bundling)
const TREE_SPRITES: Record<string, number> = {
  apple_red: require('../../assets/garden/trees/apple_red/spring_3.png'),
  orange: require('../../assets/garden/trees/orange/spring_3.png'),
  peach: require('../../assets/garden/trees/peach/spring_3.png'),
  plum: require('../../assets/garden/trees/plum/spring_3.png'),
  pear: require('../../assets/garden/trees/pear/spring_3.png'),
};

type TargetRect = { x: number; y: number; width: number; height: number };

interface FarmTutorialOverlayProps {
  profile: { species?: string; tree?: string; [k: string]: any };
  targetRefs?: {
    plantation?: React.RefObject<View | null>;
    harvest?: React.RefObject<View | null>;
    hudXp?: React.RefObject<View | null>;
  };
}

function resolveTreeSprite(profile: { species?: string; tree?: string }): number | null {
  const species = profile?.species ?? profile?.tree ?? '';
  const fruit = SPECIES_TO_FRUIT[species];
  if (!fruit) return null;
  return TREE_SPRITES[fruit] ?? null;
}

export const FarmTutorialOverlay = React.memo(function FarmTutorialOverlay({
  profile,
  targetRefs,
}: FarmTutorialOverlayProps) {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const { farm, isDark } = useFarmTheme();
  const styles = isDark ? stylesDark : stylesLight;
  const {
    hasSeenScreen,
    markScreenSeen,
    isLoaded,
    setActiveFarmTutorialStep,
  } = useHelp();

  const [currentStep, setCurrentStep] = useState<number>(-1); // -1 = inactif
  const [measuredRect, setMeasuredRect] = useState<TargetRect | null>(null);
  // Flag : true si le ref cible du step courant est absent (stage graine, pas de crops)
  // → fallback NarrativeCard plein écran au lieu de coach mark
  const [refMissing, setRefMissing] = useState(false);
  const hasStarted = useRef(false);
  // Guard anti tap-through : le tap qui ferme l'étape N peut remonter sur l'overlay fullscreen
  // de l'étape N+1 qui vient de se monter. On ignore tout tap dans les 350ms après transition.
  const lastStepChangeAt = useRef(0);
  const seen = hasSeenScreen(SCREEN_ID);

  // Pitfall 2 : reset hasStarted quand resetScreen() est appelé depuis codex
  useEffect(() => {
    if (!seen) {
      hasStarted.current = false;
    }
  }, [seen]);

  // Déclenchement initial (délai 600ms, cohérent ScreenGuide)
  useEffect(() => {
    if (!isLoaded || hasStarted.current || seen) return;
    hasStarted.current = true;
    const timer = setTimeout(() => {
      setCurrentStep(0);
      setActiveFarmTutorialStep(0);
    }, TRIGGER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isLoaded, seen, setActiveFarmTutorialStep]);

  // Mesurer la cible pour les étapes coach marks (1, 2, 3)
  const measureForStep = useCallback(
    (step: number) => {
      const refMap: Array<React.RefObject<View | null> | null | undefined> = [
        null,
        targetRefs?.plantation,
        targetRefs?.harvest,
        targetRefs?.hudXp,
        null,
      ];
      const ref = refMap[step];
      if (!ref?.current) {
        // Ref absent → stage graine / pas de crops → on bascule en fallback narratif
        setMeasuredRect(null);
        setRefMissing(true);
        return;
      }
      setRefMissing(false);
      ref.current.measureInWindow((x, y, width, height) => {
        if (width === 0 && height === 0) {
          setMeasuredRect(null);
          setRefMissing(true);
          return;
        }
        setMeasuredRect({ x, y, width, height });
      });
    },
    [targetRefs]
  );

  useEffect(() => {
    if (currentStep >= 1 && currentStep <= 3) {
      measureForStep(currentStep);
    } else {
      setMeasuredRect(null);
      setRefMissing(false);
    }
  }, [currentStep, measureForStep]);

  const handleNext = useCallback(() => {
    // Guard anti tap-through (remount overlay fullscreen)
    if (Date.now() - lastStepChangeAt.current < 350) return;
    Haptics.selectionAsync().catch(() => {});
    if (currentStep >= 4) {
      // Dernière étape : terminé
      markScreenSeen(SCREEN_ID);
      setCurrentStep(-1);
      setActiveFarmTutorialStep(null);
      lastStepChangeAt.current = Date.now();
      return;
    }
    const next = currentStep + 1;
    setCurrentStep(next);
    setActiveFarmTutorialStep(next);
    lastStepChangeAt.current = Date.now();
  }, [currentStep, markScreenSeen, setActiveFarmTutorialStep]);

  const handleSkip = useCallback(() => {
    if (Date.now() - lastStepChangeAt.current < 350) return;
    Haptics.selectionAsync().catch(() => {});
    markScreenSeen(SCREEN_ID);
    setCurrentStep(-1);
    setActiveFarmTutorialStep(null);
    lastStepChangeAt.current = Date.now();
  }, [markScreenSeen, setActiveFarmTutorialStep]);

  if (currentStep < 0) return null;

  // Tout le rendu passe par un Modal pour garantir un contexte de coordonnées au
  // niveau fenêtre (aligné avec measureInWindow). Sans ce Modal, le parent
  // tree.tsx est dans un tab navigator — son origine n'est pas (0,0) fenêtre,
  // et le CoachMarkOverlay absoluteFillObject se retrouve clippé + décalé.
  const stepKey = `help:farm_tutorial.step${currentStep + 1}`;
  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      {/* Étapes narratives plein écran (0 et 4 systématiquement,
          + fallback 1/2/3 si ref absent — stage graine) */}
      {(currentStep === 0 || currentStep === 4 ||
        (currentStep >= 1 && currentStep <= 3 && refMissing)) && (
        <NarrativeCard
          step={currentStep}
          colors={themeColors}
          t={t}
          onNext={handleNext}
          onSkip={handleSkip}
          treeSprite={currentStep === 0 ? resolveTreeSprite(profile) : null}
          farm={farm}
          styles={styles}
        />
      )}

      {/* Étapes 1, 2, 3 : coach marks uniquement si ref disponible */}
      {currentStep >= 1 && currentStep <= 3 && !refMissing && measuredRect && (
        <>
          <CoachMarkOverlay
            targetRect={measuredRect}
            onPress={handleNext}
            padding={8}
            borderRadius={12}
          />
          <CoachMark
            targetRect={measuredRect}
            title={t(`${stepKey}.title`)}
            body={t(`${stepKey}.body`)}
            position="below"
            step={{ current: currentStep + 1, total: 5 }}
            onNext={handleNext}
            onDismiss={handleSkip}
            buttonLabel={t('help:farm_tutorial.next')}
          />
        </>
      )}
    </Modal>
  );
});

// ── Sous-composant : carte narrative plein écran ─────────────────

interface NarrativeCardProps {
  step: number;
  colors: ReturnType<typeof useThemeColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onNext: () => void;
  onSkip: () => void;
  treeSprite: number | null;
  farm: FarmPalette;
  styles: Styles;
}

function NarrativeCard({ step, colors, t, onNext, onSkip, treeSprite, farm, styles }: NarrativeCardProps) {
  const { width: SCREEN_W } = useWindowDimensions();
  const cardMaxWidth = Math.min(340, SCREEN_W - Spacing['3xl'] * 2);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [step]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const stepKey = `help:farm_tutorial.step${step + 1}`;
  const isLast = step === 4;
  const nextLabel = isLast ? t('help:farm_tutorial.done') : t('help:farm_tutorial.next');

  return (
    <View style={styles.fullscreen} pointerEvents="auto">
      <View style={styles.backdrop} />
      <Animated.View
        style={[
          styles.woodFrame,
          { width: cardMaxWidth },
          animatedStyle,
          Shadows.xl,
        ]}
      >
        <View style={styles.woodFrameInner}>
          <AwningStripes farm={farm} styles={styles} />

          <View style={styles.parchment}>
            <View style={styles.handle} />

            <View style={styles.illustrationWrap}>
              {step === 0 && treeSprite ? (
                <Image source={treeSprite} style={styles.treeSprite} resizeMode="contain" />
              ) : step === 0 ? (
                <Text style={styles.bigEmoji}>🌳</Text>
              ) : (
                <Text style={styles.bigEmoji}>📖</Text>
              )}
            </View>

            <Text style={styles.title}>{t(`${stepKey}.title`)}</Text>
            <Text style={styles.body}>{t(`${stepKey}.body`)}</Text>

            <View style={styles.footer}>
              <Pressable
                onPress={onSkip}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('help:farm_tutorial.skip')}
              >
                <Text style={styles.skipLabel}>{t('help:farm_tutorial.skip')}</Text>
              </Pressable>

              <View style={styles.rightFooter}>
                <Text style={styles.stepIndicator}>{step + 1}/5</Text>
                <View style={styles.nextBtnWrap}>
                  <FarmButton label={nextLabel} onPress={onNext} farm={farm} styles={styles} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Sous-composants visuels farm ──────────────────────────────

function AwningStripes({ farm, styles }: { farm: FarmPalette; styles: Styles }) {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
      <View style={styles.awningShadow} />
      <View style={styles.awningScallop}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function FarmButton({ label, onPress, farm, styles }: { label: string; onPress?: () => void; farm: FarmPalette; styles: Styles }) {
  const pressedY = useSharedValue(0);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressedY.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressedY.value / 4,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        pressedY.value = withSpring(4, SPRING_CONFIG);
      }}
      onPressOut={() => {
        pressedY.value = withSpring(0, SPRING_CONFIG);
      }}
    >
      <Animated.View
        style={[styles.farmBtnShadow, { backgroundColor: farm.greenBtnShadow }, shadowStyle]}
      />
      <Animated.View
        style={[styles.farmBtnBody, { backgroundColor: farm.greenBtn }, btnStyle]}
      >
        <View style={[styles.farmBtnGloss, { backgroundColor: farm.greenBtnHighlight }]} />
        <Text style={styles.farmBtnText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (farm: FarmPalette) => StyleSheet.create({
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  // ── Cadre bois ──
  woodFrame: {
    borderRadius: Radius['2xl'],
    backgroundColor: farm.woodDark,
    padding: 5,
  },
  woodFrameInner: {
    borderRadius: Radius['2xl'] - 3,
    overflow: 'hidden',
    backgroundColor: farm.woodLight,
  },

  // ── Auvent ──
  awning: {
    height: 36,
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  awningStripe: {
    flex: 1,
  },
  awningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  awningScallop: {
    flexDirection: 'row',
    height: 8,
    marginTop: -4,
  },
  awningScallopDot: {
    flex: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  // ── Parchemin ──
  parchment: {
    backgroundColor: farm.parchmentDark,
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: farm.woodHighlight,
  },

  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    minHeight: 140,
  },
  treeSprite: {
    width: 140,
    height: 140,
  },
  bigEmoji: {
    fontSize: 120,
    textAlign: 'center',
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
    color: farm.brownText,
  },
  body: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    lineHeight: 22,
    marginBottom: Spacing['2xl'],
    textAlign: 'center',
    color: farm.brownTextSub,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: farm.brownTextSub,
    opacity: 0.75,
  },
  rightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepIndicator: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: farm.brownTextSub,
    opacity: 0.65,
  },
  nextBtnWrap: {
    minWidth: 110,
  },

  // ── Bouton farm 3D ──
  farmBtnShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    borderRadius: Radius.lg,
  },
  farmBtnBody: {
    height: 40,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: 4,
    overflow: 'hidden',
  },
  farmBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    opacity: 0.35,
  },
  farmBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

const stylesLight = makeStyles(Farm);
const stylesDark = makeStyles(FarmDarkPalette);
