/**
 * FloatingPillNav — Tab bar flottante en pillule (2 états)
 *
 * full    (en haut du scroll)  : pillule large centrée, 5 onglets comme la tab bar
 * compact (scrollé)            : petite pillule ancrée à gauche avec l'icône
 *                                de l'onglet actif. Tap → ré-expand (Bevel-style).
 *
 * Architecture safe (Reanimated 4.1) :
 *   - état lu via useSyncExternalStore depuis nav-pill-bus.ts (variable JS module)
 *   - animations locales (useSharedValue interne) déclenchées par useEffect
 *   - aucun SharedValue cross-component → pas de crash natif iOS
 *   - deux pilules superposées de tailles fixes → BlurView jamais redimensionnée
 *
 * Style : aligné sur la tab bar existante de l'app (colors.glassBg/glassBorder).
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { getNavPillAtTop, setNavPillAtTop, subscribeNavPill } from '../lib/nav-pill-bus';
import { Home, ListChecks, BookOpen, Calendar, LayoutGrid } from 'lucide-react-native';
import { FontWeight, FontFamily } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';

const PILL_H = 56;
const PILL_R = 28;
const COMPACT_W = 64;
const PILL_LEFT = 20;          // marge gauche commune (full + compact)
const PILL_RIGHT_GAP = 84;     // 20 (FAB right) + 56 (FAB diam) + 8 (gap)
const FADE_MS = 200;

const NAV_ITEMS = [
  { id: 'index',    Icon: Home,       label: "Aujourd'hui" },
  { id: 'tasks',    Icon: ListChecks, label: 'Tâches'      },
  { id: 'journal',  Icon: BookOpen,   label: 'Journal'     },
  { id: 'calendar', Icon: Calendar,   label: 'Agenda'      },
  { id: 'more',     Icon: LayoutGrid, label: 'Menu'        },
] as const;

export interface FloatingPillNavProps {
  activeTab?: string;
  onTabPress?: (id: string) => void;
}

export function FloatingPillNav({ activeTab = 'index', onTabPress }: FloatingPillNavProps) {
  const { colors, primary } = useThemeColors();
  const insets = useSafeAreaInsets();
  const pillBg = colors.brand.parchment;
  const pillBorder = colors.brand.bark;

  const isAtTop = useSyncExternalStore(subscribeNavPill, getNavPillAtTop, getNavPillAtTop);

  const fullOpacity = useSharedValue(isAtTop ? 1 : 0);
  const compactOpacity = useSharedValue(isAtTop ? 0 : 1);
  const compactScale = useSharedValue(isAtTop ? 0.85 : 1);

  useEffect(() => {
    fullOpacity.value = withTiming(isAtTop ? 1 : 0, { duration: FADE_MS });
    compactOpacity.value = withTiming(isAtTop ? 0 : 1, { duration: FADE_MS });
    compactScale.value = withTiming(isAtTop ? 0.85 : 1, { duration: FADE_MS });
  }, [isAtTop]);

  const fullStyle = useAnimatedStyle(() => ({ opacity: fullOpacity.value }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: compactOpacity.value,
    transform: [{ scale: compactScale.value }],
  }));

  const handleTabPress = (id: string) => {
    Haptics.selectionAsync();
    onTabPress?.(id);
  };

  const handleCompactPress = () => {
    Haptics.selectionAsync();
    setNavPillAtTop(true);
  };

  // Icône à afficher en compact = onglet actif
  const ActiveIcon =
    NAV_ITEMS.find((item) => item.id === activeTab)?.Icon ?? Home;

  return (
    <View
      style={[styles.container, { bottom: insets.bottom + Spacing.xs }]}
      pointerEvents="box-none"
    >
      {/* ── Pillule plein (centrée, taille fixe) ─────────────────────────── */}
      <Animated.View
        style={[styles.fullPill, fullStyle]}
        pointerEvents={isAtTop ? 'auto' : 'none'}
      >
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: pillBg, borderRadius: PILL_R }]}
        />
        <View
          style={[styles.border, { borderColor: pillBorder, borderRadius: PILL_R }]}
          pointerEvents="none"
        />

        <View style={styles.fullRow}>
          {NAV_ITEMS.map(({ id, Icon, label }) => {
            const active = id === activeTab;
            return (
              <TouchableOpacity
                key={id}
                style={styles.tabItem}
                onPress={() => handleTabPress(id)}
                activeOpacity={0.7}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.75}
                  color={active ? primary : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? primary : colors.textMuted },
                    active && styles.tabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {active && <View style={[styles.activeBar, { backgroundColor: primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* ── Pillule compacte (ancrée à gauche, icône onglet actif) ───────── */}
      <Animated.View
        style={[styles.compactPill, compactStyle]}
        pointerEvents={!isAtTop ? 'auto' : 'none'}
      >
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: pillBg, borderRadius: PILL_R }]}
        />
        <View
          style={[styles.border, { borderColor: pillBorder, borderRadius: PILL_R }]}
          pointerEvents="none"
        />

        <TouchableOpacity
          style={styles.compactBtn}
          onPress={handleCompactPress}
          activeOpacity={0.7}
          accessibilityLabel="Ouvrir la barre de navigation"
        >
          <ActiveIcon size={22} color={primary} strokeWidth={2} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const PILL_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  android: { elevation: 8 },
}) as object;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PILL_H,
    zIndex: 999,
  },
  fullPill: {
    position: 'absolute',
    left: PILL_LEFT,
    right: PILL_RIGHT_GAP,
    height: PILL_H,
    borderRadius: PILL_R,
    ...PILL_SHADOW,
  },
  compactPill: {
    position: 'absolute',
    width: COMPACT_W,
    height: PILL_H,
    left: PILL_LEFT,
    borderRadius: PILL_R,
    ...PILL_SHADOW,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // ── Vue plein ─────────────────────────────────────────────────────────────
  fullRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.handwriteSemibold,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 1,
  },
  tabLabelActive: {
    fontWeight: FontWeight.bold,
  },
  activeBar: {
    position: 'absolute',
    bottom: 2,
    width: 16,
    height: 2,
    borderRadius: Radius.full,
  },
  // ── Vue compacte ──────────────────────────────────────────────────────────
  compactBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
