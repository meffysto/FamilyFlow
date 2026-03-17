/**
 * FocusReader.tsx — Mode lecture immersif inspiré d'Outread
 *
 * Deux modes :
 * - RSVP : mot par mot centré, auto-avance configurable (WPM)
 * - Guide : texte complet avec zone de focus (~2 lignes). Les mots actifs
 *           sont en opacité pleine, le texte avant s'estompe vers le haut,
 *           le texte après est grisé. Auto-scroll pour garder le focus centré.
 *
 * Tap = toggle UI (header + contrôles).
 * Contrôles minimalistes : tortue/lièvre (vitesse), rewind, play/pause, forward.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FocusReaderProps {
  visible: boolean;
  content: string;
  title: string;
  onClose: () => void;
}

type ReadingMode = 'rsvp' | 'guide';
type TextSize = 'small' | 'medium' | 'large';

const WPM_OPTIONS = [150, 200, 250, 300, 400] as const;
type WPM = (typeof WPM_OPTIONS)[number];

/**
 * Nombre de mots dans la fenêtre active du mode Guide.
 * Correspond à ~2 lignes de texte en taille medium.
 */
const GUIDE_WINDOW = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Calcule l'opacité d'un mot en fonction de sa distance au focus.
 * Focus = 1.0, s'estompe progressivement vers 0.15 (passé) ou 0.35 (à venir).
 */
function wordOpacityForIndex(wordIndex: number, focusStart: number, focusEnd: number): number {
  if (wordIndex >= focusStart && wordIndex < focusEnd) return 1;

  if (wordIndex < focusStart) {
    // Passé : chute brutale puis dégradé doux
    return 0.15;
  }

  // À venir : grisé mais lisible, léger dégradé
  const distance = wordIndex - focusEnd;
  const fade = Math.max(0.30, 0.50 - distance * 0.012);
  return fade;
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

const ModeChip = React.memo(function ModeChip({
  label,
  selected,
  onPress,
  colors,
  primary,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? primary : colors.card,
          borderColor: selected ? primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.onPrimary : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/** Bouton contrôle rond (rewind, play, forward) */
const ControlButton = React.memo(function ControlButton({
  icon,
  onPress,
  size,
  bgColor,
  iconColor,
}: {
  icon: string;
  onPress: () => void;
  size: number;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={[styles.controlBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}
    >
      <Text style={{ fontSize: size * 0.4, color: iconColor }}>{icon}</Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export const FocusReader = React.memo(function FocusReader({
  visible,
  content,
  title,
  onClose,
}: FocusReaderProps) {
  const { primary, colors } = useThemeColors();

  // --- State
  const [mode, setMode] = useState<ReadingMode>('guide');
  const [wpm, setWpm] = useState<WPM>(200);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textSize, setTextSize] = useState<TextSize>('medium');
  const [uiVisible, setUiVisible] = useState(true);

  // --- Derived
  const cleanText = useMemo(() => stripMarkdown(content), [content]);
  const words = useMemo(() => splitWords(cleanText), [cleanText]);
  const totalWords = words.length;
  const focusEnd = Math.min(totalWords, currentIndex + GUIDE_WINDOW);
  const progress = totalWords > 0 ? Math.min(1, focusEnd / totalWords) : 0;

  // --- RSVP animation
  const wordOpacity = useSharedValue(1);
  const animatedWordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
  }));

  // --- Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const guideScrollRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const currentPageRef = useRef(0);

  // --- Text size mapping
  const textSizeMap: Record<TextSize, number> = {
    small: FontSize.body,
    medium: FontSize.lg,
    large: FontSize.title,
  };
  const textLineHeightMap: Record<TextSize, number> = {
    small: LineHeight.body,
    medium: LineHeight.loose,
    large: 34,
  };

  // --- Reset on open
  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setPlaying(false);
      setUiVisible(true);
    }
  }, [visible, content]);

  // --- Auto-scroll paginé : quand le focus dépasse le bas de la page visible,
  //     on scrolle d'une page entière
  useEffect(() => {
    if (mode !== 'guide' || !guideScrollRef.current || totalWords === 0) return;
    const contentH = contentHeightRef.current;
    const viewH = scrollViewHeightRef.current;
    if (contentH <= viewH || viewH === 0) return;

    const ratio = currentIndex / totalWords;
    const focusY = ratio * contentH;
    // Déclencher le scroll quand le focus atteint 80% de la page visible
    const targetPage = Math.floor((focusY + viewH * 0.2) / viewH);

    if (targetPage !== currentPageRef.current) {
      currentPageRef.current = targetPage;
      const scrollY = Math.min(contentH - viewH, targetPage * viewH);
      guideScrollRef.current.scrollTo({ y: scrollY, animated: true });
    }
  }, [currentIndex, mode, totalWords]);

  // Reset page quand on revient au début
  useEffect(() => {
    if (currentIndex === 0) {
      currentPageRef.current = 0;
    }
  }, [currentIndex]);

  // --- Auto-advance (both modes)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (playing && totalWords > 0) {
      const msPerWord = 60000 / wpm;

      intervalRef.current = setInterval(() => {
        const next = currentIndexRef.current + 1;
        if (next >= totalWords) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          runOnJS(setPlaying)(false);
          return;
        }

        if (mode === 'rsvp') {
          wordOpacity.value = withTiming(0, { duration: 50, easing: Easing.out(Easing.ease) }, () => {
            runOnJS(setCurrentIndex)(next);
            wordOpacity.value = withTiming(1, { duration: 80, easing: Easing.in(Easing.ease) });
          });
        } else {
          runOnJS(setCurrentIndex)(next);
        }
      }, msPerWord);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playing, mode, wpm, totalWords]);

  // --- Actions
  const togglePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlaying((p) => {
      if (!p && currentIndex >= totalWords - 1) {
        setCurrentIndex(0);
      }
      return !p;
    });
  }, [currentIndex, totalWords]);

  const skipWords = useCallback(
    (delta: number) => {
      setCurrentIndex((prev) => Math.max(0, Math.min(totalWords - 1, prev + delta)));
    },
    [totalWords],
  );

  const handleTap = useCallback(() => {
    setUiVisible((v) => !v);
  }, []);

  // RSVP tap: left = back, right = forward
  const [contentWidth, setContentWidth] = useState(0);
  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    setContentWidth(e.nativeEvent.layout.width);
  }, []);

  const handleRsvpPress = useCallback(
    (evt: { nativeEvent: { locationX: number } }) => {
      const x = evt.nativeEvent.locationX;
      if (x < contentWidth / 2) {
        skipWords(-5);
      } else {
        skipWords(5);
      }
    },
    [contentWidth, skipWords],
  );

  const handleModeChange = useCallback((m: ReadingMode) => {
    Haptics.selectionAsync();
    setMode(m);
    setPlaying(false);
    setCurrentIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    setPlaying(false);
    onClose();
  }, [onClose]);

  const cycleSpeed = useCallback((direction: 'slower' | 'faster') => {
    Haptics.selectionAsync();
    setWpm((prev) => {
      const idx = WPM_OPTIONS.indexOf(prev);
      if (direction === 'slower' && idx > 0) return WPM_OPTIONS[idx - 1];
      if (direction === 'faster' && idx < WPM_OPTIONS.length - 1) return WPM_OPTIONS[idx + 1];
      return prev;
    });
  }, []);

  // --- Rendu RSVP
  const renderRSVP = () => {
    const currentWord = words[currentIndex] ?? '';
    return (
      <Pressable
        style={styles.rsvpContainer}
        onLayout={onContentLayout}
        onPress={handleRsvpPress}
        accessibilityLabel={`Mot ${currentIndex + 1} sur ${totalWords}: ${currentWord}`}
      >
        <Animated.Text
          style={[
            styles.rsvpWord,
            { color: colors.text },
            animatedWordStyle,
          ]}
        >
          {currentWord}
        </Animated.Text>
        <Text style={[styles.wordCounter, { color: colors.textFaint }]}>
          {currentIndex + 1}/{totalWords}
        </Text>
      </Pressable>
    );
  };

  // --- Rendu Guide (dégradé d'opacité comme Outread)
  const renderGuide = () => {
    const fs = textSizeMap[textSize];
    const lh = textLineHeightMap[textSize];

    return (
      <Pressable style={styles.guideOuter} onPress={handleTap}>
        <ScrollView
          ref={guideScrollRef}
          style={styles.guideScroll}
          contentContainerStyle={styles.guideContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!playing}
          onLayout={(e) => { scrollViewHeightRef.current = e.nativeEvent.layout.height; }}
          onContentSizeChange={(_w, h) => { contentHeightRef.current = h; }}
        >
          <Text style={{ fontSize: fs, lineHeight: lh, color: colors.text }}>
            {words.map((word, i) => {
              const opacity = wordOpacityForIndex(i, currentIndex, focusEnd);
              return (
                <Text key={i} style={{ opacity }}>
                  {word}{i < words.length - 1 ? ' ' : ''}
                </Text>
              );
            })}
          </Text>
        </ScrollView>
      </Pressable>
    );
  };

  // --- Controles minimalistes (style Outread)
  const renderControls = () => (
    <View style={[styles.controls, { backgroundColor: colors.bg }]}>
      {/* Taille texte (mode Guide uniquement) */}
      {mode === 'guide' && (
        <View style={styles.sizeRow}>
          {(['small', 'medium', 'large'] as TextSize[]).map((s) => (
            <ModeChip
              key={s}
              label={s === 'small' ? 'Petit' : s === 'medium' ? 'Moyen' : 'Grand'}
              selected={textSize === s}
              onPress={() => { Haptics.selectionAsync(); setTextSize(s); }}
              colors={colors}
              primary={primary}
            />
          ))}
        </View>
      )}

      {/* Contrôles lecture */}
      <View style={styles.transportRow}>
        <ControlButton
          icon="🐢"
          onPress={() => cycleSpeed('slower')}
          size={48}
          bgColor={colors.cardAlt}
          iconColor={colors.text}
        />
        <ControlButton
          icon="⏪"
          onPress={() => skipWords(-10)}
          size={48}
          bgColor={colors.cardAlt}
          iconColor={colors.text}
        />
        <ControlButton
          icon={playing ? '⏸' : '▶️'}
          onPress={togglePlay}
          size={56}
          bgColor={primary}
          iconColor={colors.onPrimary}
        />
        <ControlButton
          icon="⏩"
          onPress={() => skipWords(10)}
          size={48}
          bgColor={colors.cardAlt}
          iconColor={colors.text}
        />
        <ControlButton
          icon="🐇"
          onPress={() => cycleSpeed('faster')}
          size={48}
          bgColor={colors.cardAlt}
          iconColor={colors.text}
        />
      </View>

      {/* Indicateur vitesse discret */}
      <Text style={[styles.speedLabel, { color: colors.textFaint }]}>
        {wpm} mots/min
      </Text>
    </View>
  );

  // -----------------------------------------------------------------------
  // Rendu
  // -----------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* --- Barre de progression fine (toujours visible) --- */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: primary },
            ]}
          />
        </View>

        {/* --- Header (masquable) --- */}
        {uiVisible && (
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={styles.closeButton}
            >
              <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>

            <Text
              numberOfLines={1}
              style={[styles.headerTitle, { color: colors.text }]}
            >
              {title}
            </Text>

            <View style={styles.modeToggle}>
              <ModeChip
                label="Guide"
                selected={mode === 'guide'}
                onPress={() => handleModeChange('guide')}
                colors={colors}
                primary={primary}
              />
              <ModeChip
                label="RSVP"
                selected={mode === 'rsvp'}
                onPress={() => handleModeChange('rsvp')}
                colors={colors}
                primary={primary}
              />
            </View>
          </View>
        )}

        {/* --- Contenu --- */}
        <View style={styles.contentArea}>
          {mode === 'rsvp' ? renderRSVP() : renderGuide()}
        </View>

        {/* --- Controles (masquables) --- */}
        {uiVisible && renderControls()}
      </SafeAreaView>
    </Modal>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Progress bar
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.medium,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },

  // Chips
  chip: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },

  // Content area
  contentArea: {
    flex: 1,
  },

  // RSVP
  rsvpContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['4xl'],
  },
  rsvpWord: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  wordCounter: {
    position: 'absolute',
    bottom: Spacing['3xl'],
    fontSize: FontSize.caption,
    fontWeight: FontWeight.normal,
  },

  // Guide
  guideOuter: {
    flex: 1,
  },
  guideScroll: {
    flex: 1,
  },
  guideContent: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['3xl'],
    paddingBottom: Spacing['6xl'],
  },

  // Controls (Outread style)
  controls: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.normal,
  },

  // Play button
  playButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: FontSize.display,
  },
});

export default FocusReader;
