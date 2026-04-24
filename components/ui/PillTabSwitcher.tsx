/**
 * PillTabSwitcher.tsx — Sélecteur d'onglets en pilule animée (N onglets).
 *
 * Indicateur qui glisse entre les segments (spring), pan gesture pour swiper
 * vers l'onglet voisin, badge optionnel par onglet.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { useThemeColors } from '../../contexts/ThemeContext';

export interface PillTab<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface PillTabSwitcherProps<T extends string> {
  tabs: ReadonlyArray<PillTab<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  primary: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
  /** Marges horizontales (défaut Spacing['4xl']). 0 pour coller aux bords. */
  marginHorizontal?: number;
}

const SPRING = { damping: 32, stiffness: 200 };
const DRAG_THRESHOLD = 30;

export function PillTabSwitcher<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  primary,
  colors,
  marginHorizontal,
}: PillTabSwitcherProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const tabCount = tabs.length;
  const tabWidth = tabCount > 0 ? containerWidth / tabCount : 0;
  const activeIdx = Math.max(0, tabs.findIndex((t) => t.id === activeTab));

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const handlePress = useCallback(
    (tab: T, idx: number) => {
      indicatorX.value = withSpring(idx * tabWidth, SPRING);
      onTabChange(tab);
    },
    [tabWidth, onTabChange, indicatorX],
  );

  useEffect(() => {
    if (tabWidth === 0) return;
    indicatorX.value = withSpring(activeIdx * tabWidth, SPRING);
  }, [tabWidth, activeIdx, indicatorX]);

  const goToIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(tabCount - 1, idx));
      const tab = tabs[clamped];
      if (!tab) return;
      Haptics.selectionAsync().catch(() => {});
      onTabChange(tab.id);
    },
    [tabs, tabCount, onTabChange],
  );

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const base = activeIdx * tabWidth;
      const minX = 0;
      const maxX = (tabCount - 1) * tabWidth;
      indicatorX.value = Math.max(minX, Math.min(maxX, base + e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > DRAG_THRESHOLD && activeIdx < tabCount - 1) {
        indicatorX.value = withSpring((activeIdx + 1) * tabWidth, SPRING);
        runOnJS(goToIndex)(activeIdx + 1);
      } else if (e.translationX < -DRAG_THRESHOLD && activeIdx > 0) {
        indicatorX.value = withSpring((activeIdx - 1) * tabWidth, SPRING);
        runOnJS(goToIndex)(activeIdx - 1);
      } else {
        indicatorX.value = withSpring(activeIdx * tabWidth, SPRING);
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            marginHorizontal: marginHorizontal ?? Spacing['4xl'],
          },
        ]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.indicator,
            indicatorStyle,
            { backgroundColor: primary, width: tabWidth },
          ]}
        />
        {tabs.map((tab, idx) => {
          const active = tab.id === activeTab;
          const color = active ? colors.bg : colors.textMuted;
          return (
            <Pressable
              key={tab.id}
              style={styles.tab}
              onPress={() => handlePress(tab.id, idx)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
            >
              <Text style={[styles.tabText, { color }]} numberOfLines={1}>
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge > 0 && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: active ? colors.bg : primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: active ? primary : colors.onPrimary },
                    ]}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    overflow: 'hidden',
    height: 40,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: Radius.full,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },
});
