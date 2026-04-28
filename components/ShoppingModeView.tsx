/**
 * ShoppingModeView — mode focus liste in-place pour usage en magasin.
 *
 * Pas un modal : remplace le contenu de l'onglet courses (header + body)
 * tant que `showShoppingMode` est actif. Empêche la fermeture accidentelle
 * (pas de drag-to-dismiss) et garde l'écran allumé.
 *
 * Layout (option C, validée mockup) :
 *   - Hero warm avec eyebrow handwrite + nom de liste serif + chiffre 3/12
 *     en serif display + barre de progression + caption handwrite
 *     "il te reste lait, beurre, tomates et 6 autres".
 *   - Sections en cards individuelles arrondies (pas de box grise par
 *     section) avec checkbox 56×56 et texte 22pt.
 *   - Confettis "tu as tout pris 🎉" quand done === total.
 */

import { Minimize2 } from 'lucide-react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontFamily, FontWeight } from '../constants/typography';
import type { CourseItem } from '../lib/types';

interface PriceInfo {
  price: number;
  stale: boolean;
}

interface Props {
  listName: string;
  sections: string[];
  itemsBySection: Record<string, CourseItem[]>;
  onToggle: (item: CourseItem) => void;
  onClose: () => void;
  priceByItemId?: Map<string, PriceInfo | null | undefined>;
  remainingEstimate?: number;
  formatPrice?: (n: number) => string;
}

const SPRING_CONFIG = { damping: 18, stiffness: 220 } as const;

export function ShoppingModeView({
  listName,
  sections,
  itemsBySection,
  onToggle,
  onClose,
  priceByItemId,
  remainingEstimate,
  formatPrice,
}: Props) {
  const { colors, primary, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  useKeepAwake();

  const { doneCount, totalCount, nextItems, moreCount } = useMemo(() => {
    let done = 0;
    let total = 0;
    const remaining: string[] = [];
    for (const s of sections) {
      const items = itemsBySection[s] ?? [];
      total += items.length;
      for (const it of items) {
        if (it.completed) done++;
        else remaining.push(it.text);
      }
    }
    return {
      doneCount: done,
      totalCount: total,
      nextItems: remaining.slice(0, 3),
      moreCount: Math.max(0, remaining.length - 3),
    };
  }, [sections, itemsBySection]);

  const allDone = totalCount > 0 && doneCount === totalCount;
  const pct = totalCount > 0 ? doneCount / totalCount : 0;

  // Barre de progression animée
  const progressWidth = useSharedValue(pct);
  useEffect(() => {
    progressWidth.value = withSpring(pct, SPRING_CONFIG);
  }, [pct, progressWidth]);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  // Haptic célébration au passage à 100 %
  const wasAllDoneRef = useRef(false);
  useEffect(() => {
    if (allDone && !wasAllDoneRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasAllDoneRef.current = allDone;
  }, [allDone]);

  const handleToggle = (item: CourseItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onToggle(item);
  };

  const handleClose = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
  };

  // Hero gradient : miel chaud → fond, version atténuée en dark mode.
  const heroTopColor = isDark ? 'rgba(232, 200, 88, 0.10)' : colors.brand.miel;
  const heroBottomColor = colors.bg;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={[heroTopColor, heroBottomColor]}
        style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroTitleBlock}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              {allDone ? 'et voilà — tu as tout pris' : 'tu fais les courses pour'}
            </Text>
            <Text
              style={[styles.heroList, { color: colors.text }]}
              numberOfLines={1}
            >
              {allDone ? '🎉' : listName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.heroClose, { backgroundColor: primary + '1F' }]}
            activeOpacity={0.6}
            accessibilityLabel="Quitter le mode shopping"
            accessibilityRole="button"
            hitSlop={10}
          >
            <Minimize2 size={20} color={primary} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressNumbers}>
            <Text style={[styles.progressDone, { color: primary }]}>
              {doneCount}
            </Text>
            <Text style={[styles.progressTotal, { color: colors.textMuted }]}>
              / {totalCount}
            </Text>
            {remainingEstimate !== undefined &&
              remainingEstimate > 0 &&
              formatPrice && (
                <Text
                  style={[styles.progressEstimate, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {`≈ ${formatPrice(remainingEstimate)} restants`}
                </Text>
              )}
          </View>

          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: primary + '24' },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBarFill,
                { backgroundColor: primary },
                progressBarStyle,
              ]}
            />
          </View>

          {!allDone && nextItems.length > 0 && (
            <Text
              style={[styles.caption, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              il te reste{' '}
              <Text style={[styles.captionStrong, { color: colors.text }]}>
                {nextItems.join(', ')}
              </Text>
              {moreCount > 0 && (
                <Text style={{ color: colors.textFaint }}>
                  {' '}et {moreCount} {moreCount > 1 ? 'autres' : 'autre'}
                </Text>
              )}
            </Text>
          )}
          {totalCount === 0 && (
            <Text style={[styles.caption, { color: colors.textMuted }]}>
              la liste est vide
            </Text>
          )}
        </View>
      </LinearGradient>

      {/* ─── Sections ─────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing['5xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => {
          const items = itemsBySection[section];
          if (!items || items.length === 0) return null;
          const sectionDone = items.filter((i) => i.completed).length;
          const sectionAllDone = sectionDone === items.length;
          return (
            <Animated.View
              key={section}
              layout={LinearTransition.springify().damping(18).stiffness(220)}
              style={styles.sectionBlock}
            >
              <View style={styles.sectionHead}>
                <Text
                  style={[styles.sectionTitle, { color: colors.text }]}
                  numberOfLines={1}
                  accessibilityRole="header"
                >
                  {section}
                </Text>
                <Text
                  style={[
                    styles.sectionProgress,
                    { color: sectionAllDone ? primary : colors.textMuted },
                  ]}
                >
                  {sectionDone}/{items.length}
                </Text>
              </View>
              {items.map((item) => {
                const priceInfo = priceByItemId?.get(item.id);
                return (
                  <Animated.View
                    key={item.id}
                    layout={LinearTransition.springify().damping(18).stiffness(220)}
                    exiting={FadeOutLeft.duration(140)}
                  >
                    <TouchableOpacity
                      onPress={() => handleToggle(item)}
                      activeOpacity={0.75}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: colors.card,
                          shadowColor: colors.text,
                        },
                        item.completed && styles.itemCardDone,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.completed }}
                      accessibilityLabel={
                        item.completed
                          ? `${item.text}, acheté`
                          : `${item.text}, à acheter`
                      }
                    >
                      <View
                        style={[
                          styles.checkboxBig,
                          { borderColor: colors.border },
                          item.completed && {
                            backgroundColor: primary,
                            borderColor: primary,
                          },
                        ]}
                      >
                        {item.completed && (
                          <Text style={[styles.checkGlyph, { color: colors.onPrimary }]}>
                            ✓
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.itemText,
                          { color: colors.text },
                          item.completed && {
                            color: colors.textMuted,
                            textDecorationLine: 'line-through',
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.text}
                      </Text>
                      {priceInfo && formatPrice && (
                        <Text
                          style={[
                            styles.itemPrice,
                            {
                              color: priceInfo.stale
                                ? colors.textFaint
                                : colors.textMuted,
                            },
                            item.completed && {
                              textDecorationLine: 'line-through',
                            },
                          ]}
                        >
                          {`≈ ${formatPrice(priceInfo.price)}`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroTitleBlock: {
    flex: 1,
    paddingTop: 2,
  },
  eyebrow: {
    fontFamily: FontFamily.handwrite,
    fontSize: 18,
    lineHeight: 18,
    marginBottom: 2,
  },
  heroList: {
    fontFamily: FontFamily.serif,
    fontSize: 28,
    lineHeight: 32,
  },
  heroClose: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBlock: {
    marginTop: Spacing.lg,
  },
  progressNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  progressDone: {
    fontFamily: FontFamily.serif,
    fontSize: 56,
    lineHeight: 56,
  },
  progressTotal: {
    fontFamily: FontFamily.serif,
    fontSize: 28,
    marginLeft: 8,
  },
  progressEstimate: {
    marginLeft: 'auto',
    fontFamily: FontFamily.handwrite,
    fontSize: 20,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  caption: {
    marginTop: Spacing.md,
    fontFamily: FontFamily.handwrite,
    fontSize: 19,
    lineHeight: 22,
  },
  captionStrong: {
    fontFamily: FontFamily.handwriteSemibold,
  },
  scrollContent: {
    paddingTop: Spacing.lg,
  },
  sectionBlock: {
    marginBottom: Spacing['3xl'],
    paddingHorizontal: Spacing.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: FontFamily.serif,
    fontSize: 22,
  },
  sectionProgress: {
    fontFamily: FontFamily.handwrite,
    fontSize: 18,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: 18,
    marginBottom: Spacing.md,
    minHeight: 84,
    gap: Spacing.lg,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardDone: {
    opacity: 0.55,
  },
  checkboxBig: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: -2,
  },
  itemText: {
    flex: 1,
    fontSize: 22,
    fontWeight: FontWeight.medium,
    lineHeight: 27,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: FontWeight.medium,
  },
});
