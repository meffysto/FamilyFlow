/**
 * LootBoxOpener.tsx — Premium animated loot box / booster pack opening UI
 *
 * Built with react-native-reanimated for 60fps animations.
 * Pokémon theme inspired by Pokémon TCG Pocket (booster pack ripping open,
 * golden glow ring on reveal, "INCROYABLE !" banner for high tiers).
 *
 * Phases:
 * 1. Idle — Pack floating with subtle breathing animation + particles
 * 2. Spinning — Pack shakes intensely, light rays burst from center
 * 3. Reveal — Card scales in, rarity glow ring, particles
 * 4. Done — Reward displayed with persistent glow for high tiers
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LootBox, ProfileTheme } from '../lib/types';
import { RARITY_COLORS, RARITY_LABELS, RARITY_EMOJIS } from '../constants/rewards';
import { getTheme } from '../constants/themes';
import { useThemeColors } from '../contexts/ThemeContext';

let ConfettiCannon: any = null;
try {
  ConfettiCannon = require('react-native-confetti-cannon').default;
} catch {
  // Optional dependency
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Particle System ────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

function generateParticles(count: number, colors: string[]): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT * 0.6 + SCREEN_HEIGHT * 0.1,
    size: Math.random() * 6 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 2000,
  }));
}

function FloatingParticle({ particle }: { particle: Particle }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1200 }),
          withTiming(0, { duration: 1200 }),
        ),
        -1,
      ),
    );
    translateY.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(-40, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    scale.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.3, { duration: 1800 }),
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: particle.x,
    top: particle.y,
    width: particle.size,
    height: particle.size,
    borderRadius: particle.size / 2,
    backgroundColor: particle.color,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={style} />;
}

// ─── Light Ray ──────────────────────────────────────────────────────────────

function LightRay({ angle, color, delay }: { angle: number; color: string; delay: number }) {
  const opacity = useSharedValue(0);
  const scaleY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.6, { duration: 300 }),
        withTiming(0.15, { duration: 1500 }),
      ),
    );
    scaleY.value = withDelay(
      delay,
      withSpring(1, { damping: 8, stiffness: 80 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    width: 3,
    height: 160,
    backgroundColor: color,
    opacity: opacity.value,
    borderRadius: 2,
    transform: [
      { rotate: `${angle}deg` },
      { scaleY: scaleY.value },
      { translateY: -80 },
    ],
  }));

  return <Animated.View style={style} />;
}

// ─── Glow Ring (Pokémon TCG Pocket style golden ring) ───────────────────────

function GlowRing({ color, size, pulseSpeed, borderW }: { color: string; size: number; pulseSpeed: number; borderW?: number }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: pulseSpeed }),
        withTiming(0.85, { duration: pulseSpeed }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: pulseSpeed }),
        withTiming(0.15, { duration: pulseSpeed }),
      ),
      -1,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: borderW ?? 3,
    borderColor: color,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style} />;
}

// ─── Sparkle (small star-like particle) ─────────────────────────────────────

function Sparkle({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(1, { damping: 4, stiffness: 100 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
      ),
    );
    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(180, { duration: 1000 }),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y,
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 14, color }}>✦</Text>
    </Animated.View>
  );
}

// ─── Theme Pack Designs ──────────────────────────────────────────────────────
//
// Each theme gets a unique booster pack design drawn in pure RN Views.
// Structure: top seal → body (with emblem + decorations) → bottom seal
// All packs share a common wrapper with theme-specific colors and emblems.

interface PackDesign {
  bodyColor: string;
  sealColor: string;
  emblem: React.ReactNode;
  decorations?: React.ReactNode;
  tearColor: string;
}

function getPackDesign(themeId: string): PackDesign {
  switch (themeId) {
    case 'pokemon':
      return {
        bodyColor: '#E3350D',
        sealColor: '#C4A000',
        tearColor: '#FFD700',
        emblem: (
          <View style={emblemStyles.pokeball}>
            <View style={emblemStyles.pokeballTop} />
            <View style={emblemStyles.pokeballMid}>
              <View style={emblemStyles.pokeballDot} />
            </View>
            <View style={{ flex: 1, backgroundColor: '#E3350D' }} />
          </View>
        ),
      };

    case 'voitures':
      return {
        bodyColor: '#DC2626',
        sealColor: '#1F2937',
        tearColor: '#F59E0B',
        emblem: (
          <View style={emblemStyles.wheel}>
            <View style={emblemStyles.wheelCenter} />
            <View style={[emblemStyles.wheelSpoke, { transform: [{ rotate: '0deg' }] }]} />
            <View style={[emblemStyles.wheelSpoke, { transform: [{ rotate: '60deg' }] }]} />
            <View style={[emblemStyles.wheelSpoke, { transform: [{ rotate: '120deg' }] }]} />
          </View>
        ),
        decorations: (
          <>
            {/* Racing stripes */}
            <View style={[decoStyles.stripe, { top: 12, backgroundColor: '#FFFFFF' }]} />
            <View style={[decoStyles.stripe, { top: 18, backgroundColor: '#1F2937' }]} />
          </>
        ),
      };

    case 'nature':
      return {
        bodyColor: '#059669',
        sealColor: '#065F46',
        tearColor: '#34D399',
        emblem: (
          <View style={emblemStyles.leaf}>
            <View style={emblemStyles.leafBody} />
            <View style={emblemStyles.leafVein} />
            <View style={emblemStyles.leafStem} />
          </View>
        ),
        decorations: (
          <>
            <View style={[decoStyles.dot, { top: 15, left: 12, backgroundColor: '#A7F3D0' }]} />
            <View style={[decoStyles.dot, { top: 65, right: 10, backgroundColor: '#6EE7B7', width: 5, height: 5, borderRadius: 2.5 }]} />
            <View style={[decoStyles.dot, { bottom: 15, left: 20, backgroundColor: '#D1FAE5', width: 4, height: 4, borderRadius: 2 }]} />
          </>
        ),
      };

    case 'pompier':
      return {
        bodyColor: '#EA580C',
        sealColor: '#B91C1C',
        tearColor: '#FDE68A',
        emblem: (
          <View style={emblemStyles.shield}>
            <View style={emblemStyles.shieldInner}>
              <Text style={emblemStyles.shieldCross}>✚</Text>
            </View>
          </View>
        ),
        decorations: (
          <>
            {/* Flame accent */}
            <View style={[decoStyles.flame, { top: 8, right: 14 }]}>
              <Text style={{ fontSize: 14 }}>🔥</Text>
            </View>
            <View style={[decoStyles.stripe, { bottom: 14, backgroundColor: '#FDE68A', height: 2 }]} />
            <View style={[decoStyles.stripe, { bottom: 10, backgroundColor: '#FDE68A', height: 2 }]} />
          </>
        ),
      };

    case 'licorne':
      return {
        bodyColor: '#EC4899',
        sealColor: '#A855F7',
        tearColor: '#F0ABFC',
        emblem: (
          <View style={emblemStyles.gem}>
            <View style={emblemStyles.gemTop} />
            <View style={emblemStyles.gemBottom} />
            <View style={emblemStyles.gemShine} />
          </View>
        ),
        decorations: (
          <>
            <Text style={[decoStyles.starDeco, { top: 10, left: 10 }]}>✦</Text>
            <Text style={[decoStyles.starDeco, { top: 55, right: 8, fontSize: 10 }]}>✦</Text>
            <Text style={[decoStyles.starDeco, { bottom: 12, left: 18, fontSize: 8, color: '#F0ABFC' }]}>✦</Text>
            <Text style={[decoStyles.starDeco, { top: 30, right: 15, fontSize: 6, color: '#FBCFE8' }]}>✦</Text>
          </>
        ),
      };

    case 'espace':
      return {
        bodyColor: '#1E3A5F',
        sealColor: '#2563EB',
        tearColor: '#60A5FA',
        emblem: (
          <View style={emblemStyles.planet}>
            <View style={emblemStyles.planetBody} />
            <View style={emblemStyles.planetRing} />
          </View>
        ),
        decorations: (
          <>
            <View style={[decoStyles.star, { top: 10, left: 12 }]} />
            <View style={[decoStyles.star, { top: 55, right: 8, width: 3, height: 3 }]} />
            <View style={[decoStyles.star, { bottom: 15, left: 22 }]} />
            <View style={[decoStyles.star, { top: 30, right: 20, width: 2, height: 2 }]} />
            <View style={[decoStyles.star, { bottom: 8, right: 16, width: 3, height: 3 }]} />
          </>
        ),
      };

    case 'pirates':
      return {
        bodyColor: '#78350F',
        sealColor: '#92400E',
        tearColor: '#F59E0B',
        emblem: (
          <View style={emblemStyles.skull}>
            <View style={emblemStyles.skullHead}>
              <View style={emblemStyles.skullEyeRow}>
                <View style={emblemStyles.skullEye} />
                <View style={emblemStyles.skullEye} />
              </View>
              <View style={emblemStyles.skullJaw} />
            </View>
            <View style={emblemStyles.crossbones}>
              <View style={[emblemStyles.bone, { transform: [{ rotate: '45deg' }] }]} />
              <View style={[emblemStyles.bone, { transform: [{ rotate: '-45deg' }] }]} />
            </View>
          </View>
        ),
        decorations: (
          <View style={[decoStyles.stripe, { top: 12, backgroundColor: '#FDE68A', height: 3 }]} />
        ),
      };

    case 'dinosaures':
      return {
        bodyColor: '#16A34A',
        sealColor: '#78350F',
        tearColor: '#4ADE80',
        emblem: (
          <View style={emblemStyles.egg}>
            <View style={emblemStyles.eggShell}>
              <View style={emblemStyles.eggCrack} />
              <View style={emblemStyles.eggSpot1} />
              <View style={emblemStyles.eggSpot2} />
            </View>
          </View>
        ),
        decorations: (
          <>
            {/* Claw marks */}
            <View style={[decoStyles.claw, { top: 10, right: 12 }]}>
              <View style={decoStyles.clawMark} />
              <View style={decoStyles.clawMark} />
              <View style={decoStyles.clawMark} />
            </View>
          </>
        ),
      };

    default: // 'default' classique
      return {
        bodyColor: '#7C3AED',
        sealColor: '#6D28D9',
        tearColor: '#C4B5FD',
        emblem: (
          <View style={emblemStyles.giftStar}>
            <Text style={emblemStyles.giftStarText}>★</Text>
          </View>
        ),
        decorations: (
          <>
            <View style={[decoStyles.ribbon, { left: 40 }]} />
            <View style={[decoStyles.ribbonH, { top: 45 }]} />
          </>
        ),
      };
  }
}

function ThemePack({ themeId, tearing }: { themeId: string; tearing?: boolean }) {
  const design = getPackDesign(themeId);

  return (
    <View style={packStyles.pack}>
      <View style={[packStyles.wrapper, { borderColor: `${design.sealColor}80` }]}>
        {/* Top seal */}
        <View style={[packStyles.topSeal, { backgroundColor: design.sealColor }]}>
          <View style={packStyles.sealStripe} />
        </View>
        {/* Body */}
        <View style={[packStyles.body, { backgroundColor: design.bodyColor }]}>
          {design.decorations}
          {design.emblem}
          {/* Diagonal shine */}
          <View style={packStyles.shine} />
          {/* Tear effect */}
          {tearing && (
            <View style={packStyles.tear}>
              <View style={[packStyles.tearLine, { backgroundColor: design.tearColor }]} />
              <View style={[packStyles.tearGlow, { backgroundColor: `${design.tearColor}4D` }]} />
            </View>
          )}
        </View>
        {/* Bottom seal */}
        <View style={[packStyles.bottomSeal, { backgroundColor: design.sealColor }]}>
          <View style={packStyles.sealStripe} />
        </View>
      </View>
    </View>
  );
}

const packStyles = StyleSheet.create({
  pack: { width: 90, height: 130, alignItems: 'center', justifyContent: 'center' },
  wrapper: { width: 90, height: 130, borderRadius: 8, overflow: 'hidden', borderWidth: 1.5 },
  topSeal: { height: 16, alignItems: 'center', justifyContent: 'center' },
  sealStripe: { width: '80%', height: 2, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shine: { position: 'absolute', top: -20, right: -10, width: 30, height: 160, backgroundColor: 'rgba(255,255,255,0.1)', transform: [{ rotate: '25deg' }] },
  tear: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  tearLine: { width: '120%', height: 4, transform: [{ rotate: '-5deg' }] },
  tearGlow: { position: 'absolute', width: '120%', height: 20, transform: [{ rotate: '-5deg' }] },
  bottomSeal: { height: 16, alignItems: 'center', justifyContent: 'center' },
});

// ─── Emblem Styles (unique per theme) ───────────────────────────────────────

const emblemStyles = StyleSheet.create({
  // Pokémon — Pokéball
  pokeball: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2.5, borderColor: '#1A1A2E' },
  pokeballTop: { flex: 1, backgroundColor: '#FFFFFF' },
  pokeballMid: { height: 5, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  pokeballDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#1A1A2E', marginTop: -3.5 },

  // Voitures — Steering wheel
  wheel: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  wheelCenter: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  wheelSpoke: { position: 'absolute', width: 2, height: 44, backgroundColor: '#FFFFFF' },

  // Nature — Leaf
  leaf: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  leafBody: { width: 32, height: 40, borderTopLeftRadius: 24, borderTopRightRadius: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 24, backgroundColor: '#A7F3D0', transform: [{ rotate: '-10deg' }] },
  leafVein: { position: 'absolute', width: 2, height: 30, backgroundColor: '#065F46', transform: [{ rotate: '-10deg' }] },
  leafStem: { position: 'absolute', bottom: 0, width: 2, height: 12, backgroundColor: '#065F46', transform: [{ rotate: '10deg' }] },

  // Pompier — Shield
  shield: { width: 40, height: 44, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shieldInner: { width: 32, height: 36, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: '#B91C1C', alignItems: 'center', justifyContent: 'center' },
  shieldCross: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },

  // Licorne — Gem / Crystal
  gem: { width: 36, height: 42, alignItems: 'center', justifyContent: 'center' },
  gemTop: { width: 36, height: 16, backgroundColor: '#F0ABFC', borderTopLeftRadius: 4, borderTopRightRadius: 4, transform: [{ scaleX: 0.7 }] },
  gemBottom: { width: 36, height: 26, backgroundColor: '#D946EF', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, transform: [{ perspective: 100 }, { rotateX: '0deg' }], marginTop: -1 },
  gemShine: { position: 'absolute', top: 4, left: 12, width: 8, height: 12, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2, transform: [{ rotate: '-15deg' }] },

  // Espace — Planet with ring
  planet: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  planetBody: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#60A5FA' },
  planetRing: { position: 'absolute', width: 48, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: '#DBEAFE', transform: [{ rotate: '-20deg' }] },

  // Pirates — Skull & crossbones
  skull: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  skullHead: { width: 30, height: 28, borderRadius: 15, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  skullEyeRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  skullEye: { width: 6, height: 7, borderRadius: 3, backgroundColor: '#78350F' },
  skullJaw: { width: 16, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#FDE68A', marginTop: 2 },
  crossbones: { position: 'absolute', bottom: 2, width: 40, height: 12, alignItems: 'center', justifyContent: 'center' },
  bone: { position: 'absolute', width: 36, height: 4, backgroundColor: '#FDE68A', borderRadius: 2 },

  // Dinosaures — Egg
  egg: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  eggShell: { width: 34, height: 42, borderTopLeftRadius: 17, borderTopRightRadius: 17, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, backgroundColor: '#FEF9C3', alignItems: 'center', overflow: 'hidden' },
  eggCrack: { position: 'absolute', top: 14, width: 28, height: 3, backgroundColor: '#D1D5DB', transform: [{ rotate: '5deg' }], zIndex: 2 },
  eggSpot1: { position: 'absolute', top: 8, left: 6, width: 8, height: 6, borderRadius: 4, backgroundColor: '#BBF7D0' },
  eggSpot2: { position: 'absolute', bottom: 10, right: 6, width: 6, height: 5, borderRadius: 3, backgroundColor: '#BBF7D0' },

  // Default — Star
  giftStar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  giftStarText: { fontSize: 24, color: '#FDE68A' },
});

// ─── Decoration Styles (shared helpers) ─────────────────────────────────────

const decoStyles = StyleSheet.create({
  stripe: { position: 'absolute', left: 8, right: 8, height: 3, borderRadius: 1.5 },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, opacity: 0.6 },
  flame: { position: 'absolute' },
  starDeco: { position: 'absolute', fontSize: 12, color: '#FDE68A' },
  star: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.7 },
  claw: { position: 'absolute', flexDirection: 'row', gap: 3 },
  clawMark: { width: 2, height: 14, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 1, transform: [{ rotate: '-10deg' }] },
  ribbon: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  ribbonH: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ─── Main Component ─────────────────────────────────────────────────────────

interface LootBoxOpenerProps {
  visible: boolean;
  profileName: string;
  profileAvatar: string;
  lootCount: number;
  profileTheme?: ProfileTheme;
  onOpen: () => Promise<LootBox | null>;
  onClose: () => void;
}

type Phase = 'idle' | 'spinning' | 'reveal' | 'done';

export function LootBoxOpener({
  visible,
  profileName,
  profileAvatar,
  lootCount,
  profileTheme,
  onOpen,
  onClose,
}: LootBoxOpenerProps) {
  const { textFaint } = useThemeColors();
  const theme = getTheme(profileTheme);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<LootBox | null>(null);
  const confettiRef = useRef<any>(null);
  const confettiRef2 = useRef<any>(null);

  // ─── Shared values ──────────────────────────────────────────────────────

  const breathe = useSharedValue(0);
  const floatY = useSharedValue(0);

  const shakeX = useSharedValue(0);
  const shakeRotate = useSharedValue(0);
  const spinScale = useSharedValue(1);

  const cardScale = useSharedValue(0);
  const cardScaleX = useSharedValue(0);
  const cardOpacity = useSharedValue(0);

  const flashOpacity = useSharedValue(0);
  const rewardGlow = useSharedValue(0);

  const packScale = useSharedValue(1);
  const packOpacity = useSharedValue(1);

  // Banner animation for "INCROYABLE !"
  const bannerScale = useSharedValue(0);
  const bannerOpacity = useSharedValue(0);

  // ─── Particle data ─────────────────────────────────────────────────────

  const [idleParticles] = useState(() =>
    generateParticles(12, [...theme.confettiColors.slice(0, 3), 'rgba(255,255,255,0.5)']),
  );
  const [revealParticles, setRevealParticles] = useState<Particle[]>([]);

  // ─── Sparkle data for reveal ───────────────────────────────────────────

  const [sparkles] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: SCREEN_WIDTH * 0.15 + Math.random() * SCREEN_WIDTH * 0.7,
      y: SCREEN_HEIGHT * 0.2 + Math.random() * SCREEN_HEIGHT * 0.4,
      delay: Math.random() * 1500,
      color: ['#FFD700', '#FFFFFF', '#FDE68A', '#E3350D'][Math.floor(Math.random() * 4)],
    })),
  );

  // ─── Reset on visibility change ────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setResult(null);
      resetAnimations();
      startIdleAnimations();
    } else {
      stopAllAnimations();
    }
  }, [visible]);

  function resetAnimations() {
    breathe.value = 0;
    floatY.value = 0;
    shakeX.value = 0;
    shakeRotate.value = 0;
    spinScale.value = 1;
    cardScale.value = 0;
    cardScaleX.value = 0;
    cardOpacity.value = 0;
    flashOpacity.value = 0;
    rewardGlow.value = 0;
    packScale.value = 1;
    packOpacity.value = 1;
    bannerScale.value = 0;
    bannerOpacity.value = 0;
  }

  function stopAllAnimations() {
    cancelAnimation(breathe);
    cancelAnimation(floatY);
    cancelAnimation(shakeX);
    cancelAnimation(shakeRotate);
    cancelAnimation(spinScale);
    cancelAnimation(rewardGlow);
    cancelAnimation(bannerScale);
  }

  function startIdleAnimations() {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }

  // ─── Animated styles ──────────────────────────────────────────────────

  const packStyle = useAnimatedStyle(() => {
    const scale = interpolate(breathe.value, [0, 1], [1, 1.06]);
    return {
      transform: [
        { translateY: floatY.value },
        { translateX: shakeX.value },
        { rotate: `${shakeRotate.value}deg` },
        { scale: spinScale.value * scale * packScale.value },
      ],
      opacity: packOpacity.value,
    };
  });

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { scaleX: cardScaleX.value },
    ],
    opacity: cardOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: rewardGlow.value,
    transform: [{ scale: interpolate(rewardGlow.value, [0, 1], [0.8, 1.2]) }],
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ scale: bannerScale.value }],
  }));

  // ─── Open handler ─────────────────────────────────────────────────────

  const handleOpen = useCallback(async () => {
    if (phase !== 'idle' || lootCount <= 0) return;

    setPhase('spinning');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    cancelAnimation(breathe);
    cancelAnimation(floatY);
    floatY.value = withTiming(0, { duration: 200 });

    // Intense shaking — builds up
    shakeX.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 40 }),
        withTiming(-8, { duration: 40 }),
        withTiming(12, { duration: 35 }),
        withTiming(-12, { duration: 35 }),
        withTiming(16, { duration: 30 }),
        withTiming(-16, { duration: 30 }),
      ),
      8,
    );

    shakeRotate.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(10, { duration: 40 }),
        withTiming(-10, { duration: 40 }),
      ),
      6,
    );

    spinScale.value = withSequence(
      withTiming(1.3, { duration: 500, easing: Easing.out(Easing.cubic) }),
      withTiming(1.35, { duration: 400 }),
      withTiming(0.7, { duration: 200, easing: Easing.in(Easing.cubic) }),
    );

    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 500);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 700);

    await new Promise((r) => setTimeout(r, 600));
    const box = await onOpen();
    await new Promise((r) => setTimeout(r, 500));

    if (!box) {
      setPhase('idle');
      resetAnimations();
      startIdleAnimations();
      return;
    }

    setResult(box);

    const boxIsMythique = box.rarity === 'mythique';
    const boxIsLegendaire = box.rarity === 'légendaire';
    const boxIsEpique = box.rarity === 'épique';
    const isHighTier = boxIsMythique || boxIsLegendaire;

    if (boxIsMythique) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((r) => setTimeout(r, 300));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((r) => setTimeout(r, 250));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((r) => setTimeout(r, 200));

      flashOpacity.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
      );
    } else if (boxIsLegendaire) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((r) => setTimeout(r, 200));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      flashOpacity.value = withSequence(
        withTiming(0.5, { duration: 100 }),
        withTiming(0, { duration: 400 }),
      );
    } else if (boxIsEpique) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      flashOpacity.value = withSequence(
        withTiming(0.3, { duration: 80 }),
        withTiming(0, { duration: 300 }),
      );
    }

    // Generate reveal particles
    const rColor = RARITY_COLORS[box.rarity];
    setRevealParticles(
      generateParticles(
        boxIsMythique ? 30 : isHighTier ? 20 : 10,
        boxIsMythique
          ? ['#FFD700', '#EF4444', '#FF6B6B', '#FFFFFF', '#FFA500']
          : [rColor, '#FFFFFF', theme.confettiColors[0]],
      ),
    );

    // Pack disappears
    packScale.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
    packOpacity.value = withTiming(0, { duration: 200 });

    // Card appears
    await new Promise((r) => setTimeout(r, 250));
    setPhase('reveal');

    cardOpacity.value = withTiming(1, { duration: 200 });
    cardScale.value = withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 });
    cardScaleX.value = withSpring(1, { damping: 14, stiffness: 100 });

    // "INCROYABLE !" banner for high tiers
    if (isHighTier) {
      bannerOpacity.value = withDelay(300, withTiming(1, { duration: 200 }));
      bannerScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 120 }));
    }

    // Glow behind card
    if (isHighTier) {
      rewardGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: boxIsMythique ? 800 : 1200 }),
          withTiming(0.3, { duration: boxIsMythique ? 800 : 1200 }),
        ),
        -1,
      );
    } else if (boxIsEpique) {
      rewardGlow.value = withTiming(0.5, { duration: 600 });
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);

    if (confettiRef.current) confettiRef.current.start();
    if (boxIsMythique && confettiRef2.current) {
      setTimeout(() => confettiRef2.current?.start(), 400);
    }
  }, [phase, lootCount, onOpen, theme]);

  // ─── Close handler ────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    stopAllAnimations();
    setPhase('idle');
    setResult(null);
    setRevealParticles([]);
    resetAnimations();
    onClose();
  }, [onClose]);

  // ─── Computed ─────────────────────────────────────────────────────────

  const isMythique = result?.rarity === 'mythique';
  const isLegendaire = result?.rarity === 'légendaire';
  const isHighTier = isMythique || isLegendaire;
  const isEpique = result?.rarity === 'épique';

  const rarityColor = result ? RARITY_COLORS[result.rarity] : theme.primary;
  const rarityEmoji = result ? RARITY_EMOJIS[result.rarity] : '';

  const flashColor = isMythique ? '#FFD700' : isLegendaire ? '#F59E0B' : '#FFFFFF';

  const defaultBg = theme.id === 'default' ? '#1F1035' : theme.secondary;
  const bgColor = isMythique
    ? '#2D0A0A'
    : isLegendaire
    ? '#1F1500'
    : defaultBg;

  // Rarity-based card border color
  const cardBorderColor = result
    ? isHighTier
      ? rarityColor
      : isEpique
      ? `${rarityColor}80`
      : 'rgba(255,255,255,0.15)'
    : 'rgba(255,255,255,0.15)';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Screen flash */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: flashColor, zIndex: 100, pointerEvents: 'none' },
            flashStyle,
          ]}
        />

        {/* Idle floating particles */}
        {phase === 'idle' && idleParticles.map((p) => (
          <FloatingParticle key={p.id} particle={p} />
        ))}

        {/* Reveal particles */}
        {(phase === 'reveal' || phase === 'done') && (
          <>
            {revealParticles.map((p) => (
              <FloatingParticle key={`r${p.id}`} particle={p} />
            ))}
            {isHighTier && sparkles.map((s) => (
              <Sparkle key={`s${s.id}`} x={s.x} y={s.y} delay={s.delay} color={s.color} />
            ))}
          </>
        )}

        {/* Confetti */}
        {ConfettiCannon && (
          <>
            <ConfettiCannon
              ref={confettiRef}
              count={isMythique ? 250 : isLegendaire ? 180 : 120}
              origin={{ x: -10, y: 0 }}
              autoStart={false}
              fadeOut
              explosionSpeed={isMythique ? 400 : 350}
              fallSpeed={isMythique ? 2500 : 3000}
              colors={isMythique
                ? ['#EF4444', '#FFD700', '#FF6B6B', '#FFFFFF', '#FFA500']
                : isLegendaire
                ? ['#F59E0B', '#FFD700', '#FFFFFF', '#FDE68A', theme.primary]
                : theme.confettiColors
              }
            />
            {isMythique && (
              <ConfettiCannon
                ref={confettiRef2}
                count={200}
                origin={{ x: SCREEN_WIDTH + 10, y: 0 }}
                autoStart={false}
                fadeOut
                explosionSpeed={350}
                fallSpeed={2800}
                colors={['#FFD700', '#EF4444', '#FF4500', '#FFFFFF']}
              />
            )}
          </>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.profileInfo}>
            {profileAvatar} {profileName}
          </Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeBtn, { color: textFaint }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* ═══ IDLE PHASE ═══ */}
          {phase === 'idle' && (
            <>
              <Text style={styles.title}>{theme.packLabel}</Text>
              <Text style={[styles.subtitle, { color: theme.primary }]}>
                {lootCount} disponible{lootCount > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={handleOpen} style={styles.chestButton} activeOpacity={0.8}>
                <View style={styles.packContainer}>
                  <View style={[styles.packGlow, { backgroundColor: theme.primary, opacity: 0.15 }]} />
                  <Animated.View style={packStyle}>
                    <ThemePack themeId={theme.id} />
                  </Animated.View>
                </View>
                <Text style={[styles.openText, { color: theme.primary }]}>
                  Appuyer pour ouvrir !
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ═══ SPINNING PHASE ═══ */}
          {phase === 'spinning' && (
            <View style={styles.spinContainer}>
              <View style={styles.raysContainer}>
                {Array.from({ length: 12 }, (_, i) => (
                  <LightRay
                    key={i}
                    angle={i * 30}
                    color={theme.confettiColors[0]}
                    delay={i * 50}
                  />
                ))}
              </View>
              <Animated.View style={packStyle}>
                <ThemePack themeId={theme.id} tearing />
              </Animated.View>
              <Text style={styles.spinText}>Ouverture en cours...</Text>
            </View>
          )}

          {/* ═══ REVEAL PHASE ═══ */}
          {(phase === 'reveal' || phase === 'done') && result && (
            <View style={styles.revealContainer}>
              {/* Glow rings behind card — Pokémon TCG Pocket style */}
              {(isHighTier || isEpique) && (
                <View style={styles.glowCenter}>
                  {/* Inner ring */}
                  <GlowRing
                    color={isMythique ? '#FFD700' : rarityColor}
                    size={220}
                    pulseSpeed={isMythique ? 700 : 1000}
                    borderW={isMythique ? 5 : 3}
                  />
                  {/* Outer ring */}
                  {isHighTier && (
                    <GlowRing
                      color={isMythique ? '#EF4444' : '#FDE68A'}
                      size={300}
                      pulseSpeed={isMythique ? 900 : 1400}
                      borderW={isMythique ? 4 : 2}
                    />
                  )}
                  {/* Third ring for mythique */}
                  {isMythique && (
                    <GlowRing
                      color="#FFA500"
                      size={360}
                      pulseSpeed={1100}
                      borderW={2}
                    />
                  )}
                  {/* Center glow blob */}
                  <Animated.View
                    style={[
                      styles.glowBlob,
                      { backgroundColor: isMythique ? '#FFD700' : rarityColor },
                      glowStyle,
                    ]}
                  />
                </View>
              )}

              {/* "INCROYABLE !" banner for high tiers (Pokémon Pocket style) */}
              {isHighTier && (
                <Animated.View style={[styles.incredibleBanner, bannerStyle]}>
                  <View style={[
                    styles.incredibleBannerInner,
                    { borderColor: isMythique ? '#FFD700' : '#F59E0B' },
                  ]}>
                    <Text style={[
                      styles.incredibleText,
                      isMythique && styles.incredibleTextMythique,
                    ]}>
                      {isMythique ? 'INCROYABLE !' : 'SUPER !'}
                    </Text>
                  </View>
                </Animated.View>
              )}

              {/* Reward Card */}
              <Animated.View style={[
                styles.rewardCard,
                { borderColor: cardBorderColor },
                isHighTier && { borderWidth: 2 },
                isMythique && styles.rewardCardMythique,
                cardStyle,
              ]}>
                {/* Rarity badge */}
                <View
                  style={[
                    styles.rarityBadge,
                    { backgroundColor: rarityColor },
                    isMythique && styles.mythiqueBadge,
                  ]}
                >
                  <Text style={styles.rarityText}>
                    {rarityEmoji} {RARITY_LABELS[result.rarity]}
                  </Text>
                </View>

                {/* Reward emoji */}
                <Text style={[
                  styles.rewardEmoji,
                  isMythique && styles.rewardEmojiMythique,
                  isLegendaire && styles.rewardEmojiLegendaire,
                ]}>
                  {result.emoji}
                </Text>

                {/* Reward text */}
                <Text style={[
                  styles.rewardText,
                  isMythique && styles.rewardTextMythique,
                  isLegendaire && styles.rewardTextLegendaire,
                ]}>
                  {result.reward}
                </Text>

                {/* Bonus points */}
                {result.bonusPoints > 0 && (
                  <View style={[styles.bonusPill, isMythique && { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.bonusText}>+{result.bonusPoints} pts bonus !</Text>
                  </View>
                )}

                {/* Parent approval */}
                {result.requiresParent && (
                  <View style={styles.parentNote}>
                    <Text style={styles.parentNoteText}>
                      👨‍👩‍👧 À valider par un parent !
                    </Text>
                  </View>
                )}

                {/* Special reward descriptions */}
                {result.multiplier && result.multiplier > 1 && (
                  <View style={[styles.specialNote, isMythique && { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>
                      ⚡ Multiplicateur ×{result.multiplier} activé pour {result.multiplierTasks ?? 10} tâches !
                    </Text>
                  </View>
                )}

                {result.rewardType === 'double_loot' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>🎁🎁 +2 loot boxes ajoutées !</Text>
                  </View>
                )}

                {result.rewardType === 'vacation' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>🏖️ 2 jours sans tâches activés !</Text>
                  </View>
                )}

                {result.rewardType === 'crown' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>👑 Tu choisis le menu toute la semaine !</Text>
                  </View>
                )}

                {result.rewardType === 'skip_all' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(245, 158, 11, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>🧹✨ Toutes les tâches de demain sont annulées !</Text>
                  </View>
                )}

                {result.rewardType === 'family_bonus' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(245, 158, 11, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>
                      🌈✨ Toute la famille reçoit +{result.bonusPoints} pts !
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Close button */}
              <TouchableOpacity
                style={[styles.closeRewardBtn, { backgroundColor: isMythique ? '#EF4444' : theme.primary }]}
                onPress={handleClose}
              >
                <Text style={styles.closeRewardText}>
                  {isMythique ? '🔥 Incroyable ! Fermer' : 'Super ! Fermer'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  profileInfo: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  closeBtn: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  // ─── Idle ─────────────────────────────────────────────────────────────
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 48,
  },
  chestButton: {
    alignItems: 'center',
    gap: 20,
  },
  packContainer: {
    width: 140,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  openText: {
    fontSize: 18,
    fontWeight: '600',
  },

  // ─── Spinning ─────────────────────────────────────────────────────────
  spinContainer: {
    alignItems: 'center',
    gap: 24,
  },
  raysContainer: {
    position: 'absolute',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
  },

  // ─── Reveal ───────────────────────────────────────────────────────────
  revealContainer: {
    alignItems: 'center',
    gap: 20,
  },
  glowCenter: {
    position: 'absolute',
    width: 360,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
    top: -20,
  },
  glowBlob: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },

  // ─── "INCROYABLE !" banner ────────────────────────────────────────────
  incredibleBanner: {
    zIndex: 10,
    marginBottom: -8,
  },
  incredibleBannerInner: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  incredibleText: {
    color: '#FDE68A',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  incredibleTextMythique: {
    color: '#FFD700',
    fontSize: 22,
    letterSpacing: 3,
    textShadowColor: '#EF4444',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // ─── Reward Card ──────────────────────────────────────────────────────
  rewardCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 280,
    maxWidth: 320,
  },
  rewardCardMythique: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  rarityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  mythiqueBadge: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  rarityText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rewardEmoji: {
    fontSize: 72,
  },
  rewardEmojiMythique: {
    fontSize: 88,
  },
  rewardEmojiLegendaire: {
    fontSize: 80,
  },
  rewardText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 260,
  },
  rewardTextMythique: {
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: '#EF4444',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  rewardTextLegendaire: {
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: '#F59E0B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  bonusPill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bonusText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  parentNote: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  parentNoteText: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '600',
  },
  specialNote: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  specialNoteText: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeRewardBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  closeRewardText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
