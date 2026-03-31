/**
 * DashboardCard.tsx — Reusable card widget for dashboard sections
 *
 * Supporte collapse/expand optionnel avec animation Reanimated.
 * Props collapsible + cardId pour activer et persister l'état.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  useReducedMotion,
} from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { GlassView } from './ui/GlassView';
import { PressableScale } from './ui/PressableScale';

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgb')) return hex.replace(/[\d.]+\)$/, `${alpha})`);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface DashboardCardProps {
  title: string;
  icon?: string;
  count?: number;
  color?: string;
  onPressMore?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Active le collapse/expand. Requiert cardId. */
  collapsible?: boolean;
  /** Identifiant unique pour persister l'état collapse dans SecureStore. */
  cardId?: string;
  /** État initial si pas de préférence persistée. Default: false (ouvert). */
  defaultCollapsed?: boolean;
  /** Effet Liquid Glass (fond translucide + blur). Default: false */
  glass?: boolean;
  /** Fond subtil coloré basé sur color. Default: false */
  tinted?: boolean;
}

const STORAGE_PREFIX = 'dashboard_collapsed_';
const ANIM_DURATION = 300;
const ANIM_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export function DashboardCard({
  title,
  icon,
  count,
  color,
  onPressMore,
  children,
  style,
  collapsible = false,
  cardId,
  defaultCollapsed = false,
  glass = true,
  tinted = false,
}: DashboardCardProps) {
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();
  const reduceMotion = useReducedMotion();
  const accentColor = color ?? primary;
  const tintBg = tinted && accentColor ? hexToRgba(accentColor, isDark ? 0.10 : 0.06) : undefined;
  const badgeScale = useSharedValue(reduceMotion ? 1 : 0);

  // -- Collapse state --
  const [contentHeight, setContentHeight] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (!collapsible || !cardId) return false;
    const stored = SecureStore.getItem(`${STORAGE_PREFIX}${cardId}`);
    return stored !== null ? stored === '1' : defaultCollapsed;
  });
  const animProgress = useSharedValue(isCollapsed ? 0 : 1);
  const chevronRotation = useSharedValue(isCollapsed ? 0 : 1);

  useEffect(() => {
    if (count !== undefined && count > 0) {
      badgeScale.value = reduceMotion ? 1 : withSpring(1, { damping: 12, stiffness: 200 });
    }
  }, [count]);

  const toggleCollapse = useCallback(() => {
    if (!collapsible) return;
    const next = !isCollapsed;
    setIsCollapsed(next);
    animProgress.value = reduceMotion ? (next ? 0 : 1) : withTiming(next ? 0 : 1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    chevronRotation.value = reduceMotion ? (next ? 0 : 1) : withTiming(next ? 0 : 1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    if (cardId) {
      SecureStore.setItemAsync(`${STORAGE_PREFIX}${cardId}`, next ? '1' : '0');
    }
  }, [collapsible, isCollapsed, cardId]);

  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const bodyAnimStyle = useAnimatedStyle(() => {
    if (!contentHeight) return { opacity: 1 };
    return {
      height: interpolate(animProgress.value, [0, 1], [0, contentHeight]),
      opacity: animProgress.value,
      overflow: 'hidden' as const,
    };
  });

  const chevronAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronRotation.value, [0, 1], [-90, 0])}deg` }],
  }));

  const onContentLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== contentHeight) setContentHeight(h);
  }, [contentHeight]);

  const HeaderWrapper = collapsible ? TouchableOpacity : View;
  const headerProps = collapsible
    ? {
        onPress: toggleCollapse,
        activeOpacity: 0.7,
        accessibilityRole: 'button' as const,
        accessibilityLabel: `${title}, ${isCollapsed ? 'replié' : 'déplié'}. Appuyez pour ${isCollapsed ? 'déplier' : 'replier'}.`,
        accessibilityState: { expanded: !isCollapsed },
      }
    : {};

  const cardContent = (
    <>
      <HeaderWrapper
        style={[styles.header, !collapsible || !isCollapsed ? styles.headerExpanded : undefined]}
        {...headerProps}
      >
        <View style={styles.titleRow}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {count !== undefined && (
            <Animated.View style={[styles.badge, { backgroundColor: accentColor }, badgeAnimStyle]}>
              <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{count}</Text>
            </Animated.View>
          )}
        </View>
        <View style={styles.headerRight}>
          {onPressMore && !isCollapsed && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onPressMore();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`${t('dashboard.seeAll')} ${title}`}
              accessibilityRole="button"
            >
              <Text style={[styles.moreLink, { color: accentColor }]}>{t('dashboard.seeAll')} →</Text>
            </TouchableOpacity>
          )}
          {collapsible && (
            <Animated.Text style={[styles.chevron, { color: colors.textMuted }, chevronAnimStyle]}>
              ▼
            </Animated.Text>
          )}
        </View>
      </HeaderWrapper>

      {collapsible ? (
        <Animated.View style={bodyAnimStyle}>
          <View onLayout={onContentLayout} style={styles.body}>
            {children}
          </View>
        </Animated.View>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </>
  );

  const a11yProps = {
    accessibilityRole: 'summary' as const,
    accessibilityLabel: `Section ${title}${count !== undefined ? `, ${count} éléments` : ''}`,
  };

  if (glass) {
    const glassCard = (
      <GlassView
        style={[styles.card, style]}
        intensity={35}
        borderRadius={Radius.xl}
        {...a11yProps}
      >
        {tintBg && <View style={[StyleSheet.absoluteFill, { backgroundColor: tintBg, borderRadius: Radius.xl }]} />}
        {cardContent}
      </GlassView>
    );
    if (onPressMore) {
      return (
        <PressableScale onPress={onPressMore}>
          {glassCard}
        </PressableScale>
      );
    }
    return glassCard;
  }

  const plainCard = (
    <View
      style={[styles.card, Shadows.md, { backgroundColor: colors.card }, style]}
      {...a11yProps}
    >
      {tintBg && <View style={[StyleSheet.absoluteFill, { backgroundColor: tintBg, borderRadius: Radius.xl }]} />}
      {cardContent}
    </View>
  );

  if (onPressMore) {
    return (
      <PressableScale onPress={onPressMore}>
        {plainCard}
      </PressableScale>
    );
  }
  return plainCard;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'] + 2, // 18px
    marginBottom: Spacing['lg+' as keyof typeof Spacing] ?? 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerExpanded: {
    marginBottom: Spacing.xl + 2, // 14px
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    fontSize: FontSize.subtitle + 3, // 20px
  },
  title: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  badge: {
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  moreLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  chevron: {
    fontSize: FontSize.caption,
  },
  body: {
    gap: Spacing.sm,
  },
});
