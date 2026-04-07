/**
 * onboarding.tsx — Questionnaire onboarding pré-setup (v2)
 *
 * 10 écrans de questionnaire conversationnel avant setup.tsx.
 * Flag SecureStore : 'onboarding_questionnaire_done' = '1' → skip ce flow
 * À la fin → router.push('/setup')
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as Calendar from 'expo-calendar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../contexts/ThemeContext';
import { useVault } from '../contexts/VaultContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';

// ─── Design constants ─────────────────────────────────────────────────────────

const SPRING_CONFIG = { damping: 14, stiffness: 200 };
const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Nombre d'écrans affiché dans la barre de progression */
const PROGRESS_TOTAL = 10;
/** Dernier step interne (12 = calendrier après mascotte + caméra) */
const LAST_STEP = 11;

// ─── Data ─────────────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  { id: 'meals',  emoji: '🍽️' },
  { id: 'tasks',  emoji: '✅' },
  { id: 'budget', emoji: '💰' },
  { id: 'agenda', emoji: '📅' },
  { id: 'photos', emoji: '📸' },
  { id: 'baby',   emoji: '👶' },
] as const;

type GoalId = typeof GOAL_OPTIONS[number]['id'];

const PAIN_OPTIONS = [
  { id: 'scattered', emoji: '🗂️' },
  { id: 'partner',   emoji: '🤯' },
  { id: 'groceries', emoji: '🛒' },
  { id: 'dinner',    emoji: '🍕' },
  { id: 'budget',    emoji: '💸' },
  { id: 'photolost', emoji: '📱' },
  { id: 'birthdays', emoji: '🎂' },
] as const;

type PainId = typeof PAIN_OPTIONS[number]['id'];


// Assets ferme — scène mini ferme onboarding
const FARM_ASSETS = {
  peach:    require('../assets/garden/trees/peach/summer_2.png'),
  etal:     require('../assets/garden/decos/etal_fruits.png'),
  poulailler: require('../assets/garden/buildings/poulailler/idle_south.png'),
  grange:     require('../assets/buildings/grange_lv1.png'),
  corn:     require('../assets/garden/crops/corn/stage_4.png'),
  lapin:    require('../assets/garden/animals/lapin/jeune/idle_1.png'),
  poussin:  require('../assets/garden/animals/poussin/idle_1.png'),
  chat:     require('../assets/garden/animals/chat/bebe/idle_1.png'),
  renard:   require('../assets/garden/animals/renard/bebe/idle_1.png'),
};

/** Gradient positions par étape — descend et s'atténue au fil de l'onboarding */
const GRADIENT_CONFIG: Record<number, { start: { x: number; y: number }; end: { x: number; y: number }; opacity: number }> = {
  1:  { start: { x: 0.5, y: 0 },    end: { x: 0.5, y: 0.65 }, opacity: 1 },
  2:  { start: { x: 0.3, y: 0 },    end: { x: 0.7, y: 0.55 }, opacity: 0.7 },
  3:  { start: { x: 0.5, y: 0.1 },  end: { x: 0.5, y: 0.6 },  opacity: 0.5 },
  4:  { start: { x: 0.5, y: 0.1 },  end: { x: 0.5, y: 0.6 },  opacity: 0.5 },
  5:  { start: { x: 0.5, y: 0.15 }, end: { x: 0.5, y: 0.55 }, opacity: 0.6 },
  6:  { start: { x: 0.5, y: 0.2 },  end: { x: 0.5, y: 0.5 },  opacity: 0.3 },
  7:  { start: { x: 0.5, y: 0.2 },  end: { x: 0.5, y: 0.5 },  opacity: 0.25 },
  8:  { start: { x: 0.5, y: 0.1 },  end: { x: 0.5, y: 0.7 },  opacity: 0.7 },
  9:  { start: { x: 0.5, y: 0.2 },  end: { x: 0.5, y: 0.6 },  opacity: 0.5 },
  10: { start: { x: 0.5, y: 0.2 },  end: { x: 0.5, y: 0.5 },  opacity: 0.4 },
  11: { start: { x: 0.5, y: 0.3 },  end: { x: 0.5, y: 0.7 },  opacity: 0.4 },
};


const DASHBOARD_SECTIONS = [
  { id: 'meals',    emoji: '🍽️' },
  { id: 'tasks',    emoji: '✅' },
  { id: 'budget',   emoji: '💰' },
  { id: 'agenda',   emoji: '📅' },
  { id: 'photos',   emoji: '📸' },
  { id: 'baby',     emoji: '👶' },
  { id: 'routines', emoji: '🏃' },
  { id: 'health',   emoji: '💊' },
] as const;

type SectionId = typeof DASHBOARD_SECTIONS[number]['id'];


// Fake data pour le dashboard preview (famille fictive)
const DEMO_SECTION_DATA: Record<SectionId, { lines: string[] }> = {
  meals:    { lines: ['Ce soir : Spaghetti bolognaise 🍝', 'Demain : Poulet rôti 🍗'] },
  tasks:    { lines: ['• Appeler école de Léa ⏰', '• Pharmacie — vitamine D', '• Renouveler carte bleue'] },
  budget:   { lines: ['1 240 € / 2 000 € ce mois', '████████░░  62 %'] },
  agenda:   { lines: ['Demain — Dentiste Léa 14h30', 'Vendredi — Anniversaire grand-mère 🎂'] },
  photos:   { lines: ['📸 Photo du jour — Parc avec Léa', '7 photos cette semaine'] },
  baby:     { lines: ['Léa — 18 mois 👶', 'Dernier poids : 10,8 kg • Taille : 80 cm'] },
  routines: { lines: ['Matin : 🎒 École ✓  🦷 Dents ✓  🛁 Bain ✓', 'Soir : 📖 Histoire ✓  💡 Veilleuse ✓'] },
  health:   { lines: ['Dr Dupont — Lundi prochain 10h', 'Dernier vaccin : il y a 3 mois'] },
};

// ─── Composant : Barre de progression ────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const { primary } = useThemeColors();
  const displayStep = Math.min(step, PROGRESS_TOTAL);
  const progress = displayStep / PROGRESS_TOTAL;

  const animWidth = useSharedValue(0);

  useEffect(() => {
    animWidth.value = withTiming(progress, { duration: 400 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animWidth.value * 100}%` as any,
  }));

  return (
    <View style={s.progressContainer}>
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, { backgroundColor: primary }, barStyle]} />
      </View>
      <Text style={s.progressLabel}>{displayStep} / {PROGRESS_TOTAL}</Text>
    </View>
  );
}

// ─── Composant : Carte Tinder ─────────────────────────────────────────────────

interface TinderCardProps {
  text: string;
  onSwipe: (dir: 'left' | 'right') => void;
  index: number;
  total: number;
}

function TinderCard({ text, onSwipe, index, total }: TinderCardProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swiped = useRef(false);

  // Reset quand la carte change
  useEffect(() => {
    swiped.current = false;
    translateX.value = 0;
    translateY.value = 0;
  }, [text]);

  const handleSwipe = useCallback((dir: 'left' | 'right') => {
    if (swiped.current) return;
    swiped.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSwipe(dir);
  }, [onSwipe]);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.15;
    })
    .onEnd((e) => {
      const threshold = SCREEN_WIDTH * 0.28;
      if (Math.abs(e.translationX) > threshold) {
        const dir = e.translationX > 0 ? 'right' : 'left';
        const targetX = dir === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        translateX.value = withTiming(targetX, { duration: 280 });
        runOnJS(handleSwipe)(dir);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-25, 0, 25],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const yesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 120], [0, 1], Extrapolation.CLAMP),
  }));

  const noStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-120, -20], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[s.tinderCard, { backgroundColor: colors.card, shadowColor: colors.text }, cardStyle]}
      >
        {/* Indicateur OUI */}
        <Animated.View style={[s.tinderBadge, s.tinderBadgeYes, yesStyle]}>
          <Text style={s.tinderBadgeText}>{t('onboarding.tinder.btnYes')}</Text>
        </Animated.View>

        {/* Indicateur NON */}
        <Animated.View style={[s.tinderBadge, s.tinderBadgeNo, noStyle]}>
          <Text style={s.tinderBadgeText}>{t('onboarding.tinder.btnNo')}</Text>
        </Animated.View>

        <Text style={s.tinderQuote}>"</Text>
        <Text style={[s.tinderText, { color: colors.text }]}>{text}</Text>

        {/* Compteur */}
        <Text style={[s.tinderCounter, { color: colors.textMuted }]}>
          {index + 1} / {total}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Composant : Preview section dashboard ────────────────────────────────────

function DemoSectionCard({ sectionId, colors }: { sectionId: SectionId; colors: any }) {
  const { t } = useTranslation();
  const section = DASHBOARD_SECTIONS.find((s) => s.id === sectionId)!;
  const data = DEMO_SECTION_DATA[sectionId];
  return (
    <View style={[s.demoCard, { backgroundColor: colors.card }]}>
      <Text style={s.demoCardEmoji}>{section.emoji}</Text>
      <Text style={[s.demoCardTitle, { color: colors.text }]}>{t(`onboarding.preferences.sections.${sectionId}`)}</Text>
      {data.lines.map((line, i) => (
        <Text key={i} style={[s.demoCardLine, { color: colors.textMuted }]} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const { vaultPath } = useVault();

  // ── Données localisées ──
  const tinderCards = t('onboarding.tinder.cards', { returnObjects: true }) as string[];
  const testimonials = t('onboarding.socialProof.testimonials', { returnObjects: true }) as Array<{ quote: string; name: string; tag: string; badge?: string }>;
  const solutionMap: Record<PainId, { problem: string; solution: string }> = {
    scattered: { problem: t('onboarding.solution.items.scattered.problem'), solution: t('onboarding.solution.items.scattered.solution') },
    partner:   { problem: t('onboarding.solution.items.partner.problem'),   solution: t('onboarding.solution.items.partner.solution') },
    groceries: { problem: t('onboarding.solution.items.groceries.problem'), solution: t('onboarding.solution.items.groceries.solution') },
    dinner:    { problem: t('onboarding.solution.items.dinner.problem'),    solution: t('onboarding.solution.items.dinner.solution') },
    budget:    { problem: t('onboarding.solution.items.budget.problem'),    solution: t('onboarding.solution.items.budget.solution') },
    photolost: { problem: t('onboarding.solution.items.photolost.problem'), solution: t('onboarding.solution.items.photolost.solution') },
    birthdays: { problem: t('onboarding.solution.items.birthdays.problem'), solution: t('onboarding.solution.items.birthdays.solution') },
  };

  // ── État utilisateur ──
  const [step, setStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState<GoalId | null>(null);
  const [selectedPains, setSelectedPains] = useState<Set<PainId>>(new Set());
  const [tinderIndex, setTinderIndex] = useState(0);

  // ── Progress bar animée ──
  const processingAnim = useSharedValue(0);

  // ── Auto-avance écran 8 (Processing) ──
  useEffect(() => {
    if (step !== 8) return;
    processingAnim.value = 0;
    processingAnim.value = withTiming(1, { duration: 2000 });
    const t = setTimeout(() => setStep(9), 2300);
    return () => clearTimeout(t);
  }, [step]);

  const processingBarStyle = useAnimatedStyle(() => ({
    width: `${processingAnim.value * 100}%` as any,
  }));

  // ── Navigation ──
  const goNext = useCallback(() => {
    Haptics.selectionAsync();
    setStep((s) => s + 1);
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => {
      const prev = Math.max(1, s - 1);
      // Retour vers l'écran Tinder → reset les cartes pour les revoir
      if (prev === 6) setTinderIndex(0);
      return prev;
    });
  }, []);

  const finish = useCallback(async () => {
    await SecureStore.setItemAsync('onboarding_questionnaire_done', '1');
    if (selectedPains.size > 0) {
      await SecureStore.setItemAsync('onboarding_pains', JSON.stringify([...selectedPains]));
    }
    // Si vault déjà configuré (dev / re-test) → /(tabs), sinon → setup
    if (vaultPath) {
      router.replace('/(tabs)' as any);
    } else {
      router.replace('/setup' as any);
    }
  }, [selectedPains, vaultPath, router]);

  // ── Helpers ──
  const togglePain = useCallback((id: PainId) => {
    Haptics.selectionAsync();
    setSelectedPains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTinderSwipe = useCallback((_dir: 'left' | 'right') => {
    setTinderIndex((i) => {
      const next = i + 1;
      if (next >= tinderCards.length) {
        // Toutes les cartes vues → laisser le message visible 1,5s avant d'avancer
        setTimeout(() => setStep(7), 1500);
      }
      return next;
    });
  }, [tinderCards.length]);

  // Nombre de solutions à afficher (basé sur pains sélectionnés, max 4)
  const solutionItems = [...selectedPains].slice(0, 4).map((id) => solutionMap[id]);


  // ═══════════════════════════════════════════════════════════════════════════
  // Rendu des écrans
  // ═══════════════════════════════════════════════════════════════════════════

  /** Écran 1 — Welcome */
  const renderWelcome = () => (
    <Animated.View entering={FadeIn.duration(500)} style={s.stepContent}>
      {/* Hero gradient */}
      <LinearGradient
        colors={[primary + '33', 'transparent']}
        style={s.welcomeGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Dashboard preview fictif */}
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[s.welcomePreview, { backgroundColor: colors.card }]}>
        <Text style={[s.welcomePreviewHeader, { color: colors.textMuted }]}>{t('onboarding.welcome.greeting')}</Text>
        <View style={s.welcomePreviewGrid}>
          {(['tasks', 'meals', 'budget', 'agenda'] as SectionId[]).map((id) => {
            const sec = DASHBOARD_SECTIONS.find((s) => s.id === id)!;
            return (
              <View key={id} style={[s.welcomePreviewCell, { backgroundColor: colors.bg }]}>
                <Text style={s.welcomePreviewEmoji}>{sec.emoji}</Text>
                <Text style={[s.welcomePreviewCellLabel, { color: colors.text }]}>{t(`onboarding.preferences.sections.${id}`)}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Texte hero */}
      <Animated.Text
        entering={FadeInDown.delay(400).duration(400)}
        style={[s.welcomeTitle, { color: colors.text }]}
      >
        {t('onboarding.welcome.title')}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(550).duration(400)}
        style={[s.welcomeSubtitle, { color: colors.textMuted }]}
      >
        {t('onboarding.welcome.subtitle')}
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(700).duration(400)} style={s.ctaContainer}>
        <TouchableOpacity
          style={[s.ctaPrimary, { backgroundColor: primary }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={s.ctaPrimaryText}>{t('onboarding.welcome.cta')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  /** Écran 2 — Goal question */
  const renderGoal = () => (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={[s.stepTitle, { color: colors.text }]}>
        {t('onboarding.goal.title')}
      </Animated.Text>

      <Animated.View entering={FadeInUp.delay(250).duration(400)} style={s.optionList}>
        {GOAL_OPTIONS.map((opt, i) => {
          const selected = selectedGoal === opt.id;
          return (
            <Animated.View key={opt.id} entering={FadeInDown.delay(300 + i * 60).duration(300)}>
              <TouchableOpacity
                style={[
                  s.optionRow,
                  { backgroundColor: selected ? tint : colors.card, borderColor: selected ? primary : colors.card },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedGoal(opt.id);
                }}
                activeOpacity={0.75}
              >
                <Text style={s.optionEmoji}>{opt.emoji}</Text>
                <Text style={[s.optionLabel, { color: selected ? primary : colors.text }]}>{t(`onboarding.goal.options.${opt.id}`)}</Text>
                {selected && <Text style={[s.optionCheck, { color: primary }]}>✓</Text>}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </Animated.View>

      {selectedGoal && (
        <Animated.View entering={FadeIn.duration(300)} style={s.ctaContainer}>
          <TouchableOpacity
            style={[s.ctaPrimary, { backgroundColor: primary }]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={s.ctaPrimaryText}>{t('onboarding.goal.cta')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ScrollView>
  );

  /** Écran 3 — Pain points */
  const renderPainPoints = () => (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={[s.stepTitle, { color: colors.text }]}>
        {t('onboarding.painPoints.title')}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(220).duration(400)} style={[s.stepSubtitle, { color: colors.textMuted }]}>
        {t('onboarding.painPoints.subtitle')}
      </Animated.Text>

      <View style={s.optionList}>
        {PAIN_OPTIONS.map((opt, i) => {
          const selected = selectedPains.has(opt.id);
          return (
            <Animated.View key={opt.id} entering={FadeInDown.delay(280 + i * 55).duration(300)}>
              <TouchableOpacity
                style={[
                  s.optionRow,
                  { backgroundColor: selected ? tint : colors.card, borderColor: selected ? primary : colors.card },
                ]}
                onPress={() => togglePain(opt.id)}
                activeOpacity={0.75}
              >
                <Text style={s.optionEmoji}>{opt.emoji}</Text>
                <Text style={[s.optionLabel, { color: selected ? primary : colors.text }]}>{t(`onboarding.painPoints.options.${opt.id}`)}</Text>
                <View style={[s.checkbox, { borderColor: selected ? primary : colors.textMuted, backgroundColor: selected ? primary : 'transparent' }]}>
                  {selected && <Text style={s.checkboxCheck}>✓</Text>}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <View style={s.ctaContainer}>
        <TouchableOpacity
          style={[s.ctaPrimary, { backgroundColor: primary }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={s.ctaPrimaryText}>{t('onboarding.painPoints.cta')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  /** Écran 4 — Social proof */
  const renderSocialProof = () => (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={[s.stepTitle, { color: colors.text }]}>
        {t('onboarding.socialProof.title')}
      </Animated.Text>

      {testimonials.map((testimonial, i) => (
        <Animated.View key={i} entering={FadeInDown.delay(250 + i * 130).duration(400)}>
          <View style={[s.testimonialCard, { backgroundColor: colors.card, borderWidth: testimonial.badge ? 1.5 : 0, borderColor: primary }]}>
            {testimonial.badge && (
              <View style={[s.testimonialBadge, { backgroundColor: primary }]}>
                <Text style={s.testimonialBadgeText}>{testimonial.badge}</Text>
              </View>
            )}
            <Text style={s.testimonialStars}>{'⭐'.repeat(5)}</Text>
            <Text style={[s.testimonialQuote, { color: colors.text }]}>"{testimonial.quote}"</Text>
            <View style={s.testimonialFooter}>
              <Text style={[s.testimonialName, { color: primary }]}>{testimonial.name}</Text>
              <View style={[s.testimonialTag, { backgroundColor: tint }]}>
                <Text style={[s.testimonialTagText, { color: primary }]}>{testimonial.tag}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      ))}

      <Animated.View entering={FadeIn.delay(700).duration(400)} style={s.ctaContainer}>
        <TouchableOpacity
          style={[s.ctaPrimary, { backgroundColor: primary }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={s.ctaPrimaryText}>{t('onboarding.socialProof.cta')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );

  /** Écran 5 — Tinder cards */
  const renderTinderCards = () => {
    const done = tinderIndex >= tinderCards.length;
    return (
      <View style={[s.stepContent, s.tinderContainer]}>
        <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={[s.stepTitle, { color: colors.text }]}>
          {t('onboarding.tinder.title')}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(220).duration(400)} style={[s.stepSubtitle, { color: colors.textMuted }]}>
          {t('onboarding.tinder.subtitle')}
        </Animated.Text>

        {done ? (
          <Animated.View entering={FadeIn.duration(400)} style={s.tinderDone}>
            <Text style={s.tinderDoneEmoji}>✨</Text>
            <Text style={[s.tinderDoneText, { color: colors.text }]}>{t('onboarding.tinder.done')}</Text>
          </Animated.View>
        ) : (
          <View style={s.tinderArea}>
            {/* Carte de fond (suivante) */}
            {tinderIndex + 1 < tinderCards.length && (
              <View style={[s.tinderCard, s.tinderCardBg, { backgroundColor: colors.card }]}>
                <Text style={[s.tinderText, { color: colors.textMuted, opacity: 0.5 }]}>
                  "{tinderCards[tinderIndex + 1]}"
                </Text>
              </View>
            )}
            {/* Carte active */}
            <TinderCard
              key={tinderIndex}
              text={tinderCards[tinderIndex]}
              onSwipe={handleTinderSwipe}
              index={tinderIndex}
              total={tinderCards.length}
            />
          </View>
        )}

        {/* Boutons alternatifs (tap) */}
        {!done && (
          <Animated.View entering={FadeIn.delay(400)} style={s.tinderButtons}>
            <TouchableOpacity
              style={[s.tinderBtn, { borderColor: '#EF4444' }]}
              onPress={() => handleTinderSwipe('left')}
            >
              <Text style={[s.tinderBtnText, { color: '#EF4444' }]}>{t('onboarding.tinder.btnNo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tinderBtn, { borderColor: '#22C55E' }]}
              onPress={() => handleTinderSwipe('right')}
            >
              <Text style={[s.tinderBtnText, { color: '#22C55E' }]}>{t('onboarding.tinder.btnYes')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    );
  };

  /** Écran 6 — Solution personnalisée */
  const renderSolution = () => {
    const items = solutionItems.length > 0 ? solutionItems : [
      solutionMap['scattered'],
      solutionMap['partner'],
      solutionMap['dinner'],
    ];
    return (
      <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
        <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={[s.stepTitle, { color: colors.text }]}>
          {t('onboarding.solution.title')}
        </Animated.Text>

        <View style={s.solutionList}>
          {items.map((item, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(250 + i * 100).duration(400)}>
              <View style={[s.solutionItem, { backgroundColor: colors.card }]}>
                <Text style={[s.solutionProblem, { color: colors.textMuted }]}>{item.problem}</Text>
                <Text style={[s.solutionAnswer, { color: colors.text }]}>→ {item.solution}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeIn.delay(600).duration(400)} style={s.ctaContainer}>
          <TouchableOpacity
            style={[s.ctaPrimary, { backgroundColor: primary }]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={s.ctaPrimaryText}>{t('onboarding.solution.cta')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  };

  /** Écran 8 — Processing (auto-avance) */
  const renderProcessing = () => (
    <View style={[s.stepContent, s.processingCenter]}>
      <Animated.Text entering={FadeIn.delay(200).duration(500)} style={s.processingEmoji}>
        🌱 ✨ 🌳
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(400).duration(400)}
        style={[s.stepTitle, { color: colors.text, textAlign: 'center' }]}
      >
        {t('onboarding.processing.title')}
      </Animated.Text>

      <View style={[s.processingTrack, { backgroundColor: colors.card }]}>
        <Animated.View style={[s.processingFill, { backgroundColor: primary }, processingBarStyle]} />
      </View>

      <Animated.Text
        entering={FadeIn.delay(600).duration(400)}
        style={[s.stepSubtitle, { color: colors.textMuted, textAlign: 'center' }]}
      >
        {t('onboarding.processing.subtitle')}
      </Animated.Text>
    </View>
  );

  /** Écran 9 — Dashboard preview */
  const renderDashboardPreview = () => {
    const sections = (['tasks', 'meals', 'budget', 'agenda'] as SectionId[]);

    return (
      <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
        <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={[s.stepTitle, { color: colors.text }]}>
          {t('onboarding.dashboardPreview.title')}
        </Animated.Text>

        {/* Header dashboard fictif */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[s.demoHeader, { backgroundColor: colors.card }]}>
          <Text style={[s.demoHeaderGreeting, { color: colors.text }]}>{t('onboarding.dashboardPreview.greeting')}</Text>
          <Text style={[s.demoHeaderDate, { color: colors.textMuted }]}>{t('onboarding.dashboardPreview.date')}</Text>
        </Animated.View>

        {/* Grille des sections sélectionnées */}
        <View style={s.demoGrid}>
          {sections.map((id, i) => (
            <Animated.View key={id} entering={FadeInDown.delay(400 + i * 80).duration(350)} style={s.demoGridItem}>
              <DemoSectionCard sectionId={id} colors={colors} />
            </Animated.View>
          ))}
        </View>

        <Animated.Text
          entering={FadeIn.delay(700).duration(400)}
          style={[s.demoNote, { color: colors.textMuted }]}
        >
          {t('onboarding.dashboardPreview.note')}
        </Animated.Text>

        <Animated.View entering={FadeIn.delay(850).duration(400)} style={s.ctaContainer}>
          <TouchableOpacity
            style={[s.ctaPrimary, { backgroundColor: primary }]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={s.ctaPrimaryText}>{t('onboarding.dashboardPreview.cta')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  };

  /** Écran 10a — Permission priming : caméra */
  const renderPermissionCamera = async () => {
    // appelé quand le composant est rendu — la vraie demande se fait au tap
  };

  const handleCameraPermission = useCallback(async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    goNext();
  }, [goNext]);

  const renderPermCamera = () => {
    const bullets = t('onboarding.permCamera.bullets', { returnObjects: true }) as string[];
    return (
      <Animated.View entering={FadeIn.duration(500)} style={[s.stepContent, s.permissionCenter]}>
        <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={s.permissionEmoji}>
          📸
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(280).duration(400)} style={[s.permissionTitle, { color: colors.text }]}>
          {t('onboarding.permCamera.title')}
        </Animated.Text>

        <View style={s.permissionBullets}>
          {bullets.map((line, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(380 + i * 80).duration(300)} style={s.permissionBullet}>
              <Text style={[s.permissionBulletDot, { color: primary }]}>•</Text>
              <Text style={[s.permissionBulletText, { color: colors.textMuted }]}>{line}</Text>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeIn.delay(650).duration(400)} style={s.ctaContainer}>
          <TouchableOpacity
            style={[s.ctaPrimary, { backgroundColor: primary }]}
            onPress={handleCameraPermission}
            activeOpacity={0.85}
          >
            <Text style={s.ctaPrimaryText}>{t('onboarding.permCamera.cta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ctaSecondary} onPress={goNext} activeOpacity={0.6}>
            <Text style={[s.ctaSecondaryText, { color: colors.textMuted }]}>{t('onboarding.permCamera.skip')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  };

  /** Écran 10b (step 11) — Permission priming : calendrier */
  const handleCalendarPermission = useCallback(async () => {
    await Calendar.requestCalendarPermissionsAsync();
    await finish();
  }, [finish]);

  const renderPermCalendar = () => {
    const bullets = t('onboarding.permCalendar.bullets', { returnObjects: true }) as string[];
    return (
      <Animated.View entering={FadeIn.duration(500)} style={[s.stepContent, s.permissionCenter]}>
        <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={s.permissionEmoji}>
          📅
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(280).duration(400)} style={[s.permissionTitle, { color: colors.text }]}>
          {t('onboarding.permCalendar.title')}
        </Animated.Text>

        <View style={s.permissionBullets}>
          {bullets.map((line, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(380 + i * 80).duration(300)} style={s.permissionBullet}>
              <Text style={[s.permissionBulletDot, { color: primary }]}>•</Text>
              <Text style={[s.permissionBulletText, { color: colors.textMuted }]}>{line}</Text>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeIn.delay(650).duration(400)} style={s.ctaContainer}>
          <TouchableOpacity
            style={[s.ctaPrimary, { backgroundColor: primary }]}
            onPress={handleCalendarPermission}
            activeOpacity={0.85}
          >
            <Text style={s.ctaPrimaryText}>{t('onboarding.permCalendar.cta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ctaSecondary} onPress={finish} activeOpacity={0.6}>
            <Text style={[s.ctaSecondaryText, { color: colors.textMuted }]}>{t('onboarding.permCalendar.skip')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  };

  /** Écran 5 — Mascotte arbre */
  const renderMascotSlide = () => (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      {/* Mini ferme — scène 2 plans */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(500).springify()}
        style={s.miniFarmScene}
      >
        {/* Ciel */}
        <View style={s.miniFarmSky} />
        {/* Sol arrière */}
        <View style={s.miniFarmGroundBack} />
        {/* Sol avant */}
        <View style={s.miniFarmGroundFront} />
        {/* Arrière-plan : arbres, décos, bâtiments */}
        <View style={s.miniFarmBackRow}>
          {[
            { src: FARM_ASSETS.lapin,      size: 44 },
            { src: FARM_ASSETS.peach,      size: 72 },
            { src: FARM_ASSETS.poulailler, size: 44 },
            { src: FARM_ASSETS.corn,       size: 36 },
          ].map((item, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(200 + i * 100).duration(400)}>
              <Image source={item.src} style={{ width: item.size, height: item.size }} resizeMode="contain" />
            </Animated.View>
          ))}
        </View>
        {/* Premier plan : animaux */}
        <View style={s.miniFarmFrontRow}>
          {[
            { src: FARM_ASSETS.grange,  size: 56 },
            { src: FARM_ASSETS.poussin, size: 18 },
            { src: FARM_ASSETS.chat,   size: 44 },
            { src: FARM_ASSETS.renard, size: 44 },
          ].map((item, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(500 + i * 80).duration(400)}>
              <Image source={item.src} style={{ width: item.size, height: item.size }} resizeMode="contain" />
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* Titre */}
      <Animated.Text
        entering={FadeInDown.delay(700).duration(400)}
        style={[s.featureSlideTitle, { color: colors.text }]}
      >
        {t('onboarding.mascot.title')}
      </Animated.Text>

      {/* Sous-texte */}
      <Animated.Text
        entering={FadeInDown.delay(800).duration(400)}
        style={[s.featureSlideSubtitle, { color: colors.textMuted }]}
      >
        {t('onboarding.mascot.subtitle')}
      </Animated.Text>

      {/* Mini feature list */}
      <View style={s.slideDetails}>
        {(['grow', 'sagas', 'rewards'] as const).map((key, i) => (
          <Animated.View
            key={key}
            entering={FadeInDown.delay(900 + i * 100).duration(300)}
            style={[s.slideDetailRow, { backgroundColor: tint }]}
          >
            <Text style={s.slideDetailIcon}>
              {key === 'grow' ? '🌿' : key === 'sagas' ? '📖' : '🍃'}
            </Text>
            <Text style={[s.slideDetailText, { color: colors.text }]}>
              {t(`onboarding.mascot.features.${key}`)}
            </Text>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(1200).duration(400)} style={s.ctaContainer}>
        <TouchableOpacity
          style={[s.ctaPrimary, { backgroundColor: primary }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={s.ctaPrimaryText}>{t('onboarding.mascot.cta')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );

  // ── Dispatch des écrans ──
  const renderStep = () => {
    switch (step) {
      case 1:  return renderWelcome();
      case 2:  return renderGoal();
      case 3:  return renderPainPoints();
      case 4:  return renderSocialProof();
      case 5:  return renderMascotSlide();
      case 6:  return renderTinderCards();
      case 7:  return renderSolution();
      case 8:  return renderProcessing();
      case 9:  return renderDashboardPreview();
      case 10: return renderPermCamera();
      case 11: return renderPermCalendar();
      default: return null;
    }
  };

  // ── Afficher bouton back sauf écran 1, 9 (auto), 11, 12 ──
  const showBack = step > 1 && step !== 8 && step !== 10 && step !== 11;

  const gradientCfg = GRADIENT_CONFIG[step] ?? GRADIENT_CONFIG[1];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.bg }]}>
      {/* Gradient d'arrière-plan qui descend/s'atténue au fil des étapes */}
      <LinearGradient
        colors={[tint, primary + '22', 'transparent']}
        start={gradientCfg.start}
        end={gradientCfg.end}
        style={[s.gradientBg, { opacity: gradientCfg.opacity }]}
        pointerEvents="none"
      />
      {/* Header : back + progress */}
      <View style={s.header}>
        {showBack ? (
          <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.6}>
            <Text style={[s.backBtnText, { color: colors.textMuted }]}>{t('setup.nav.back')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}
        <ProgressBar step={step} />
      </View>

      {/* Contenu de l'écran courant */}
      <View style={s.body}>
        {renderStep()}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.xl,
  },
  backBtn: {
    minWidth: 64,
  },
  backBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  progressLabel: {
    fontSize: FontSize.caption,
    color: '#9CA3AF',
    fontWeight: FontWeight.medium,
    minWidth: 32,
    textAlign: 'right',
  },
  body: {
    flex: 1,
  },
  stepContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['5xl'],
  },

  // ── Welcome ──
  welcomeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  welcomePreview: {
    marginTop: Spacing['3xl'],
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: Spacing['4xl'],
  },
  welcomePreviewHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xl,
  },
  welcomePreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  welcomePreviewCell: {
    width: '47%',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  welcomePreviewEmoji: {
    fontSize: FontSize.title,
  },
  welcomePreviewCellLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  welcomeTitle: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    lineHeight: 40, // hero=32 — LineHeight.title (28) est inférieur à la fontSize, ce qui crop les ascendants
    marginBottom: Spacing.xl,
  },
  welcomeSubtitle: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.loose,
    marginBottom: Spacing['5xl'],
  },

  // ── Shared ──
  stepTitle: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    lineHeight: LineHeight.title,
    marginTop: Spacing['3xl'],
    marginBottom: Spacing.xl,
  },
  stepSubtitle: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
    marginBottom: Spacing['3xl'],
  },
  ctaContainer: {
    marginTop: Spacing['3xl'],
    gap: Spacing.xl,
  },
  ctaPrimary: {
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius['2xl'],
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  ctaSecondary: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  ctaSecondaryText: {
    fontSize: FontSize.sm,
  },

  // ── Option rows (goal + pain) ──
  optionList: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: Spacing.xl,
  },
  optionEmoji: {
    fontSize: FontSize.subtitle,
    width: 28,
    textAlign: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.body,
  },
  optionCheck: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radius.xs,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },

  // ── Testimonials ──
  testimonialCard: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'visible',
  },
  testimonialBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  testimonialBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.4,
  },
  testimonialStars: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  testimonialQuote: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
    fontStyle: 'italic',
    marginBottom: Spacing.xl,
  },
  testimonialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  testimonialName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  testimonialTag: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  testimonialTagText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },

  // ── Tinder cards ──
  tinderContainer: {
    alignItems: 'center',
  },
  tinderArea: {
    width: '100%',
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing['3xl'],
  },
  tinderCard: {
    position: 'absolute',
    width: SCREEN_WIDTH - Spacing['2xl'] * 2,
    minHeight: 200,
    borderRadius: Radius['2xl'],
    padding: Spacing['3xl'],
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tinderCardBg: {
    transform: [{ scale: 0.95 }],
    opacity: 0.6,
  },
  tinderBadge: {
    position: 'absolute',
    top: Spacing['2xl'],
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  tinderBadgeYes: {
    right: Spacing['2xl'],
    borderColor: '#22C55E',
    backgroundColor: '#22C55E22',
  },
  tinderBadgeNo: {
    left: Spacing['2xl'],
    borderColor: '#EF4444',
    backgroundColor: '#EF444422',
  },
  tinderBadgeText: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  tinderQuote: {
    fontSize: 48,
    lineHeight: 48,
    color: '#D1D5DB',
    marginBottom: -Spacing.xl,
  },
  tinderText: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.loose,
    fontStyle: 'italic',
  },
  tinderCounter: {
    position: 'absolute',
    bottom: Spacing['2xl'],
    right: Spacing['2xl'],
    fontSize: FontSize.caption,
  },
  tinderButtons: {
    flexDirection: 'row',
    gap: Spacing['2xl'],
    marginTop: Spacing.xl,
  },
  tinderBtn: {
    flex: 1,
    paddingVertical: Spacing['2xl'],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  tinderBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  tinderDone: {
    alignItems: 'center',
    paddingVertical: Spacing['6xl'],
    gap: Spacing.xl,
  },
  tinderDoneEmoji: {
    fontSize: 48,
  },
  tinderDoneText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },

  // ── Solution ──
  solutionList: {
    gap: Spacing.xl,
    marginTop: Spacing.xl,
  },
  solutionItem: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  solutionProblem: {
    fontSize: FontSize.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: FontWeight.medium,
  },
  solutionAnswer: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    lineHeight: LineHeight.body,
  },

  // ── Section grid (écran 7) ──
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xl,
    marginTop: Spacing.xl,
  },
  sectionGridItem: {
    width: '47%',
  },
  sectionChip: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 90,
    justifyContent: 'center',
  },
  sectionChipEmoji: {
    fontSize: FontSize.title,
  },
  sectionChipLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  sectionCheck: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCheckText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  // ── Processing ──
  processingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  processingEmoji: {
    fontSize: 40,
    marginBottom: Spacing['3xl'],
    letterSpacing: 8,
  },
  processingTrack: {
    width: '100%',
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: Spacing['3xl'],
    marginBottom: Spacing.xl,
  },
  processingFill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  // ── Dashboard preview ──
  demoHeader: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  demoHeaderGreeting: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  demoHeaderDate: {
    fontSize: FontSize.sm,
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xl,
  },
  demoGridItem: {
    width: '47%',
  },
  demoCard: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    gap: Spacing.xs,
    minHeight: 90,
  },
  demoCardEmoji: {
    fontSize: FontSize.title,
    marginBottom: Spacing.xs,
  },
  demoCardTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: Spacing.xs,
  },
  demoCardLine: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.normal,
  },
  demoNote: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
    textAlign: 'center',
    marginTop: Spacing['3xl'],
    fontStyle: 'italic',
  },

  // ── Permissions ──
  permissionCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  permissionEmoji: {
    fontSize: 64,
    marginBottom: Spacing['3xl'],
  },
  permissionTitle: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    lineHeight: LineHeight.title,
    textAlign: 'center',
    marginBottom: Spacing['3xl'],
  },
  permissionBullets: {
    width: '100%',
    gap: Spacing.xl,
    marginBottom: Spacing['5xl'],
  },
  permissionBullet: {
    flexDirection: 'row',
    gap: Spacing.xl,
    alignItems: 'flex-start',
  },
  permissionBulletDot: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginTop: 1,
  },
  permissionBulletText: {
    flex: 1,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
  },

  // ── Gradient de fond global ──
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

  // ── Mascot slide — mini ferme ──
  miniFarmScene: {
    width: '100%',
    height: 150,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginTop: Spacing['2xl'],
    marginBottom: Spacing['3xl'],
    position: 'relative',
  },
  miniFarmSky: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '52%',
    backgroundColor: '#b8e4f5',
  },
  miniFarmGroundBack: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '60%',
    backgroundColor: '#7ab648',
  },
  miniFarmGroundFront: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '28%',
    backgroundColor: '#5a9032',
  },
  miniFarmBackRow: {
    position: 'absolute',
    bottom: '42%',
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
  },
  miniFarmFrontRow: {
    position: 'absolute',
    bottom: 12,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
  },
  featureSlideTitle: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    lineHeight: LineHeight.title,
    marginBottom: Spacing.xl,
  },
  featureSlideSubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: LineHeight.body,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
  },
  slideDetails: {
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  slideDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
  },
  slideDetailIcon: {
    fontSize: FontSize.title,
  },
  slideDetailText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
    lineHeight: LineHeight.body,
  },
});
