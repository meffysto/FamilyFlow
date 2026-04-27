import React, { useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import type { StoryUniverse } from '../../lib/types';
import { STORY_UNIVERSE_SPRITES } from '../../lib/stories';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

export const BOOK_WIDTH = 205;
export const BOOK_HEIGHT = 340;
export const BOOK_GAP = 22;

const SPRING_CONFIG = { damping: 14, stiffness: 160 };

// ── Fond parchemin chaud teinté selon la couleur de l'univers ────────────────
// Mélange 78% crème (#FFF5E0) + 22% accent pour donner une teinte unique
function warmCoverColor(hex: string): string {
  const cream = { r: 255, g: 245, b: 224 };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(cream.r * 0.78 + r * 0.22)},${Math.round(cream.g * 0.78 + g * 0.22)},${Math.round(cream.b * 0.78 + b * 0.22)})`;
}

interface Props {
  universe: StoryUniverse;
  selected: boolean;
  onPress: () => void;
}

function StoryBookCard({ universe, selected, onPress }: Props) {
  const { t } = useTranslation();
  const universeTitle = t(`stories.universes.${universe.id}.titre`, { defaultValue: universe.titre });
  // 0 = non sélectionné, 1 = sélectionné
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, SPRING_CONFIG);
  }, [selected, progress]);

  const animStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [0.92, 1.08]);
    const ty = interpolate(progress.value, [0, 1], [0, -12]);
    return {
      transform: [{ scale: s }, { translateY: ty }],
      shadowOpacity: interpolate(progress.value, [0, 1], [0.08, 0.45]),
    };
  });

  const spriteAnimStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [1, 1.08]);
    return { transform: [{ scale: s }] };
  });

  const coverBg = warmCoverColor(universe.couleurAccent);
  const accent = universe.couleurAccent;

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={universeTitle}
    >
      <Animated.View style={[styles.book, { shadowColor: accent }, animStyle]}>

        {/* ── Tranche (spine) ── */}
        <View style={[styles.spine, { backgroundColor: accent }]}>
          {/* Reflet sur la tranche */}
          <View style={styles.spineHighlight} />
        </View>

        {/* ── Couverture ── */}
        <View style={[styles.cover, { backgroundColor: coverBg }]}>

          {/* Illustration en base — occupe tout l'espace du flex */}
          {STORY_UNIVERSE_SPRITES[universe.id] ? (
            <Animated.View style={[styles.spriteContainer, spriteAnimStyle]}>
              <Image
                source={STORY_UNIVERSE_SPRITES[universe.id]!}
                style={styles.sprite}
                resizeMode="stretch"
              />
            </Animated.View>
          ) : (
            <Text style={styles.emoji}>{universe.emoji}</Text>
          )}

          {/* Overlays positionnés en absolute par-dessus l'image */}

          {/* Grain papier vieilli */}
          <View style={[StyleSheet.absoluteFill, styles.paperGrain]} />

          {/* Cadre décoratif intérieur */}
          <View style={[styles.innerFrame, { borderColor: accent + '55' }]}>
            <View style={[styles.corner, styles.cornerTL, { backgroundColor: accent + '99' }]} />
            <View style={[styles.corner, styles.cornerTR, { backgroundColor: accent + '99' }]} />
            <View style={[styles.corner, styles.cornerBL, { backgroundColor: accent + '99' }]} />
            <View style={[styles.corner, styles.cornerBR, { backgroundColor: accent + '99' }]} />
          </View>

          {/* Bandeau titre style ruban */}
          <View style={[styles.ribbon, { backgroundColor: accent }]}>
            <View style={[styles.ribbonInnerBorder, { borderColor: '#FFFFFF30' }]} />
            <Text style={styles.ribbonText} numberOfLines={2}>{universeTitle}</Text>
          </View>

          {/* Tranche de pages droite */}
          <View style={styles.pageEdge} />

          {/* Pastille ✓ sélection */}
          {selected && (
            <View style={[styles.check, { backgroundColor: accent }]}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          )}
        </View>

      </Animated.View>
    </Pressable>
  );
}

export default React.memo(StoryBookCard);

const RIBBON_H = 56;
const FRAME_INSET = 9;
const CORNER_SIZE = 6;

const styles = StyleSheet.create({
  book: {
    width: BOOK_WIDTH,
    height: BOOK_HEIGHT,
    flexDirection: 'row',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowOffset: { width: 4, height: 8 },
    shadowRadius: 14,
    elevation: 10,
  },

  // ── Tranche ──
  spine: {
    width: 14,
  },
  spineHighlight: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFFFFF35',
  },

  // ── Couverture ──
  cover: {
    flex: 1,
    overflow: 'hidden',
  },

  // Grain parchemin — voile sépia très léger (utilisé avec StyleSheet.absoluteFill)
  paperGrain: {
    backgroundColor: '#7B5E3A0A',
  },

  // Cadre décoratif
  innerFrame: {
    position: 'absolute',
    top: FRAME_INSET,
    left: FRAME_INSET,
    right: FRAME_INSET,
    bottom: RIBBON_H + FRAME_INSET,
    borderWidth: 1.5,
    borderRadius: Radius.md,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderRadius: CORNER_SIZE / 2,
  },
  cornerTL: { top: -CORNER_SIZE / 2, left: -CORNER_SIZE / 2 },
  cornerTR: { top: -CORNER_SIZE / 2, right: -CORNER_SIZE / 2 },
  cornerBL: { bottom: -CORNER_SIZE / 2, left: -CORNER_SIZE / 2 },
  cornerBR: { bottom: -CORNER_SIZE / 2, right: -CORNER_SIZE / 2 },

  // Illustration plein cadre — enfant flex normal, remplit le cover
  spriteContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  sprite: {
    flex: 1,
    width: '100%',
  },
  emoji: {
    fontSize: 72,
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
  },

  // Ruban titre
  ribbon: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: RIBBON_H,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
  },
  ribbonInnerBorder: {
    position: 'absolute',
    top: 3,
    left: 6,
    right: 6,
    bottom: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: Radius.xs,
    borderTopRightRadius: Radius.xs,
  },
  ribbonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: '#00000030',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Tranche de pages droite
  pageEdge: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: RIBBON_H + 8,
    width: 3,
    backgroundColor: '#D4B896',
  },

  // Pastille sélection
  check: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  checkText: {
    color: '#fff',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
});
