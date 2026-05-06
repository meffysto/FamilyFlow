/**
 * FloatingPillNav — Pillule de navigation Direction 7 « Bevel-grade »
 *
 * État étendu (en haut du scroll) :
 *   pillule large nav + cellule terracotta « + » (FAB intégré, 6ᵉ cellule)
 *
 * État replié (scrollé > 60px) :
 *   capsule à droite avec [icône + label de l'onglet actif] + [rond « + » 44px]
 *   les onglets inactifs disparaissent (opacity 0).
 *
 * Architecture safe (Reanimated 4.1) :
 *   - état "atTop" lu via useSyncExternalStore depuis nav-pill-bus.ts
 *   - état "addOpen" piloté par le parent (lift de l'open state du FAB)
 *   - animations locales (useSharedValue interne) déclenchées par useEffect
 *   - aucun SharedValue cross-component → pas de crash natif iOS
 *   - deux pilules superposées (extended + compact) cross-fadées
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { getNavPillAtTop, setNavPillAtTop, subscribeNavPill } from '../lib/nav-pill-bus';
import { Home, ListChecks, BookOpen, Calendar, LayoutGrid, Plus, X } from 'lucide-react-native';
import { FontWeight, FontFamily } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';

// ── Dimensions (handoff Direction 7) ───────────────────────────────
const PILL_H = 64;
const PILL_R_EXTENDED = 28;
const CELL_R = 22;
const PILL_PADDING = 5;
// FAB carré = hauteur intérieure de la pill (PILL_H - 2*padding) → cercle parfait avec radius = width/2
const ADD_SIZE = PILL_H - PILL_PADDING * 2;
const PILL_MARGIN_X = 14;
const COMPACT_RIGHT = 14;
const FOLD_DURATION = 450;
const FOLD_EASING = Easing.bezier(0.4, 0, 0.2, 1);

const PARCH_TOP = '#FFFCF3';
const PARCH_BOTTOM = '#FFF8EC';
const TERRACOTTA_TOP = '#B85C3D';
const TERRACOTTA_BOTTOM = '#A24E33';

const NAV_ITEMS = [
  { id: 'index',    Icon: Home,       label: "Aujourd'hui" },
  { id: 'tasks',    Icon: ListChecks, label: 'Tâches'      },
  { id: 'journal',  Icon: BookOpen,   label: 'Journal'     },
  { id: 'calendar', Icon: Calendar,   label: 'Agenda'      },
  { id: 'more',     Icon: LayoutGrid, label: 'Menu'        },
] as const;

// ── Badge ──────────────────────────────────────────────────────────
type TabBadge = { kind: 'dot' | 'progress'; value?: string };

function PillBadge({ kind, value, parchBg }: TabBadge & { parchBg: string }) {
  const { primary, colors } = useThemeColors();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (kind !== 'dot') return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [kind]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (kind === 'dot') {
    return (
      <Animated.View
        style={[
          badgeStyles.dot,
          { backgroundColor: primary, borderColor: parchBg },
          pulseStyle,
        ]}
      />
    );
  }
  return (
    <View style={[badgeStyles.progress, { backgroundColor: primary, borderColor: parchBg }]}>
      <Text style={[badgeStyles.progressText, { color: colors.onPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ── Cellule onglet (étendu) ────────────────────────────────────────
function TabCell({
  Icon,
  label,
  active,
  badge,
  parchBg,
  onPress,
}: {
  Icon: typeof Home;
  label: string;
  active: boolean;
  badge?: TabBadge;
  parchBg: string;
  onPress: () => void;
}) {
  const { primary, colors } = useThemeColors();
  const pressScale = useSharedValue(1);
  const indicatorScale = useSharedValue(active ? 1 : 0);
  const indicatorOpacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    indicatorScale.value = withSpring(active ? 1 : 0, { damping: 14, stiffness: 220 });
    indicatorOpacity.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: indicatorScale.value }, { rotate: '-2deg' }],
    opacity: indicatorOpacity.value,
  }));

  const tintActive = colors.brand.soil;
  const tintInactive = colors.brand.soilMuted;

  return (
    <Pressable
      style={tabStyles.cell}
      onPressIn={() => {
        pressScale.value = withTiming(0.92, { duration: 90 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { damping: 12, stiffness: 280 });
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={[tabStyles.iconWrap, iconWrapStyle]}>
        <Icon
          size={20}
          strokeWidth={1.7}
          color={active ? tintActive : tintInactive}
        />
        {badge && <PillBadge kind={badge.kind} value={badge.value} parchBg={parchBg} />}
      </Animated.View>
      <Text
        style={[
          tabStyles.label,
          {
            color: active ? tintActive : tintInactive,
            fontWeight: (active ? '700' : '600') as '700' | '600',
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Animated.View style={[tabStyles.indicator, { backgroundColor: primary }, indicatorStyle]} />
    </Pressable>
  );
}

// ── Cellule "+" terracotta ─────────────────────────────────────────
function AddCell({
  open,
  onPress,
}: {
  open: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const rotate = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    rotate.value = withTiming(open ? 1 : 0, { duration: 200, easing: FOLD_EASING });
  }, [open]);

  const wrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value * 45}deg` }],
  }));

  const Icon = open ? X : Plus;
  // FAB cercle parfait : carré ADD_SIZE × ADD_SIZE avec radius = ADD_SIZE/2.
  const cornerStyle = { borderRadius: ADD_SIZE / 2 };

  return (
    <Animated.View
      style={[
        addStyles.shadowWrap,
        addStyles.extendedWrap,
        cornerStyle,
        wrapStyle,
      ]}
    >
      {/* View dédié au clipping (overflow:hidden + borderRadius). Le shadow reste sur Animated.View au-dessus. */}
      <View style={[StyleSheet.absoluteFillObject, cornerStyle, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={[TERRACOTTA_TOP, TERRACOTTA_BOTTOM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <Pressable
        onPressIn={() => { pressScale.value = withTiming(0.94, { duration: 90 }); }}
        onPressOut={() => { pressScale.value = withSpring(1, { damping: 12, stiffness: 280 }); }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Fermer le menu de création' : 'Créer'}
        accessibilityState={{ expanded: open }}
        style={[StyleSheet.absoluteFillObject, styles.fillCenter]}
      >
        <Animated.View style={iconStyle}>
          <Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Composant principal ────────────────────────────────────────────
export interface FloatingPillNavProps {
  activeTab?: string;
  onTabPress?: (id: string) => void;
  /** Toggle de la cellule "+" — pilote l'ouverture du FAB (panel/speed-dial). */
  onAddPress?: () => void;
  /** État ouvert du FAB (pour rotation + → ×). */
  addOpen?: boolean;
  /** Badge sur Tâches (compteur en retard). */
  taskBadgeCount?: number;
  /** Badge dot sur Calendar (RDV ≤ 7j). */
  rdvBadgeActive?: boolean;
}

export function FloatingPillNav({
  activeTab = 'index',
  onTabPress,
  onAddPress,
  addOpen = false,
  taskBadgeCount = 0,
  rdvBadgeActive = false,
}: FloatingPillNavProps) {
  const { colors, primary } = useThemeColors();
  const insets = useSafeAreaInsets();
  const isAtTop = useSyncExternalStore(subscribeNavPill, getNavPillAtTop, getNavPillAtTop);

  const fullOpacity = useSharedValue(isAtTop ? 1 : 0);
  const compactOpacity = useSharedValue(isAtTop ? 0 : 1);

  useEffect(() => {
    fullOpacity.value = withTiming(isAtTop ? 1 : 0, { duration: FOLD_DURATION, easing: FOLD_EASING });
    compactOpacity.value = withTiming(isAtTop ? 0 : 1, { duration: FOLD_DURATION, easing: FOLD_EASING });
  }, [isAtTop]);

  const fullStyle = useAnimatedStyle(() => ({ opacity: fullOpacity.value }));
  const compactStyle = useAnimatedStyle(() => ({ opacity: compactOpacity.value }));

  const handleTabPress = (id: string) => {
    Haptics.selectionAsync();
    onTabPress?.(id);
  };
  const handleAddPress = () => {
    Haptics.selectionAsync();
    onAddPress?.();
  };
  const handleCompactExpand = () => {
    Haptics.selectionAsync();
    setNavPillAtTop(true);
  };

  const activeItem = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];
  const ActiveIcon = activeItem.Icon;

  const taskBadge: TabBadge | undefined =
    taskBadgeCount > 0 ? { kind: 'progress', value: String(taskBadgeCount) } : undefined;
  const calBadge: TabBadge | undefined =
    rdvBadgeActive ? { kind: 'dot' } : undefined;

  const badgesById: Record<string, TabBadge | undefined> = {
    tasks: taskBadge,
    calendar: calBadge,
  };

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom - Spacing.md, Spacing.xs) }]}
      pointerEvents="box-none"
    >
      {/* ── État étendu ── */}
      <Animated.View
        style={[styles.fullPill, fullStyle]}
        pointerEvents={isAtTop ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={[PARCH_TOP, PARCH_BOTTOM]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R_EXTENDED }]}
        />
        <View
          style={[styles.border, { borderRadius: PILL_R_EXTENDED, borderColor: colors.brand.bark }]}
          pointerEvents="none"
        />
        <View style={styles.fullRow}>
          {NAV_ITEMS.map(({ id, Icon, label }) => (
            <TabCell
              key={id}
              Icon={Icon}
              label={label}
              active={id === activeTab}
              badge={badgesById[id]}
              parchBg={PARCH_BOTTOM}
              onPress={() => handleTabPress(id)}
            />
          ))}
          <AddCell open={addOpen} onPress={handleAddPress} />
        </View>
      </Animated.View>

      {/* ── État replié — mini-pill identique, juste 1 tab + FAB ── */}
      <Animated.View
        style={[styles.compactPill, compactStyle]}
        pointerEvents={!isAtTop ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={[PARCH_TOP, PARCH_BOTTOM]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R_EXTENDED }]}
        />
        <View
          style={[styles.border, { borderRadius: PILL_R_EXTENDED, borderColor: colors.brand.bark }]}
          pointerEvents="none"
        />
        <View style={styles.fullRow}>
          <View style={styles.compactActiveTabSlot}>
            <TabCell
              Icon={ActiveIcon}
              label={activeItem.label}
              active
              badge={badgesById[activeTab]}
              parchBg={PARCH_BOTTOM}
              onPress={handleCompactExpand}
            />
          </View>
          <AddCell open={addOpen} onPress={handleAddPress} />
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const PILL_SHADOW = Platform.select({
  ios: {
    shadowColor: '#6B4226',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  android: { elevation: 12 },
}) as object;

// Note: pas de shadow sur le FAB — il est à l'intérieur de la pill qui a déjà son shadow,
// et un shadow rectangulaire iOS dessinerait un halo qui masque visuellement les coins arrondis.

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
    left: PILL_MARGIN_X,
    right: PILL_MARGIN_X,
    height: PILL_H,
    borderRadius: PILL_R_EXTENDED,
    padding: PILL_PADDING,
    ...PILL_SHADOW,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fillCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },
  // ── Compact (mini-pill identique, juste plus étroite) ──────────
  compactPill: {
    position: 'absolute',
    right: COMPACT_RIGHT,
    height: PILL_H,
    borderRadius: PILL_R_EXTENDED,
    padding: PILL_PADDING,
    ...PILL_SHADOW,
  },
  compactActiveTabSlot: {
    width: 78,
  },
});

const tabStyles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    gap: 3,
    borderRadius: CELL_R,
    position: 'relative',
  },
  iconWrap: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFamily.handwriteSemibold,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  indicator: {
    position: 'absolute',
    bottom: 5,
    width: 20,
    height: 2,
    borderRadius: 2,
  },
});

const addStyles = StyleSheet.create({
  shadowWrap: {},
  extendedWrap: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    alignSelf: 'center',
  },
});

const badgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  progress: {
    position: 'absolute',
    top: -5,
    right: -8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  progressText: {
    fontSize: 9.5,
    fontWeight: '700' as const,
    lineHeight: 11,
    letterSpacing: 0.2,
  },
});
