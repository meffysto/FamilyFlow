/**
 * ShoppingModeModal — mode plein écran focus liste pour usage en magasin.
 *
 * Chrome minimal (header + back + compteur), pas d'addBar / fréquents / switcher.
 * Checkboxes 56×56, texte 20pt, padding vertical large pour pouvoir cocher
 * facilement avec un téléphone dans une main et un caddie dans l'autre.
 *
 * Garde l'écran allumé via useKeepAwake pendant que le modal est ouvert.
 */

import { Check, X } from 'lucide-react-native';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontSize, FontWeight, FontFamily } from '../constants/typography';
import type { CourseItem } from '../lib/types';

interface PriceInfo {
  price: number;
  stale: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  listName: string;
  sections: string[]; // ordre d'affichage des sections
  itemsBySection: Record<string, CourseItem[]>;
  onToggle: (item: CourseItem) => void;
  priceByItemId?: Map<string, PriceInfo | null | undefined>;
  remainingEstimate?: number;
  formatPrice?: (n: number) => string;
}

export function ShoppingModeModal(props: Props) {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <ShoppingModeContent {...props} />
    </Modal>
  );
}

function ShoppingModeContent({
  onClose,
  listName,
  sections,
  itemsBySection,
  onToggle,
  priceByItemId,
  remainingEstimate,
  formatPrice,
}: Props) {
  const { colors, primary, isDark } = useThemeColors();
  useKeepAwake();

  const { doneCount, totalCount } = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const s of sections) {
      const items = itemsBySection[s] ?? [];
      total += items.length;
      done += items.filter((i) => i.completed).length;
    }
    return { doneCount: done, totalCount: total };
  }, [sections, itemsBySection]);

  const handleToggle = (item: CourseItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onToggle(item);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          activeOpacity={0.6}
          accessibilityLabel="Fermer le mode shopping"
          accessibilityRole="button"
          hitSlop={12}
        >
          <X size={26} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {listName}
          </Text>
          <Text style={[styles.counter, { color: colors.textMuted }]} numberOfLines={1}>
            {doneCount}/{totalCount}
            {remainingEstimate !== undefined && remainingEstimate > 0 && formatPrice ? (
              <Text style={[styles.estimate, { color: colors.text }]}>
                {`  ·  ≈ ${formatPrice(remainingEstimate)}`}
              </Text>
            ) : null}
          </Text>
        </View>
        <View style={styles.closeBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => {
          const items = itemsBySection[section];
          if (!items || items.length === 0) return null;
          return (
            <View key={section} style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: colors.text, backgroundColor: colors.bg }]}
                accessibilityRole="header"
              >
                {section}
              </Text>
              {items.map((item) => (
                <Animated.View
                  key={item.id}
                  layout={LinearTransition.springify().damping(18).stiffness(220)}
                  exiting={FadeOutLeft.duration(140)}
                >
                  <TouchableOpacity
                    style={[
                      styles.row,
                      { backgroundColor: colors.card, borderColor: colors.borderLight },
                      item.completed && { opacity: isDark ? 0.5 : 0.55 },
                    ]}
                    onPress={() => handleToggle(item)}
                    activeOpacity={0.7}
                    accessibilityLabel={
                      item.completed
                        ? `${item.text}, acheté`
                        : `${item.text}, à acheter`
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.completed }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: colors.border },
                        item.completed && {
                          backgroundColor: primary,
                          borderColor: primary,
                        },
                      ]}
                    >
                      {item.completed && (
                        <Check size={32} color={colors.onPrimary} strokeWidth={3.5} />
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
                    {(() => {
                      const info = priceByItemId?.get(item.id);
                      if (!info || !formatPrice) return null;
                      return (
                        <Text
                          style={[
                            styles.price,
                            { color: info.stale ? colors.textFaint : colors.textMuted },
                            item.completed && { textDecorationLine: 'line-through' },
                          ]}
                        >
                          {`≈ ${formatPrice(info.price)}`}
                        </Text>
                      );
                    })()}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          );
        })}
        {totalCount === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              La liste est vide.
            </Text>
          </View>
        )}
        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const CHECKBOX_SIZE = 56;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.titleLg,
    fontFamily: FontFamily.serif,
  },
  counter: {
    fontSize: FontSize.label,
    marginTop: 2,
  },
  scrollContent: {
    paddingTop: Spacing.lg,
  },
  section: {
    marginBottom: Spacing['3xl'],
  },
  sectionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 80,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  itemText: {
    flex: 1,
    fontSize: 20,
    fontWeight: FontWeight.medium,
    lineHeight: 26,
  },
  price: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    marginLeft: Spacing.md,
  },
  estimate: {
    fontSize: FontSize.label,
    fontFamily: FontFamily.handwrite,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing['5xl'],
  },
  emptyText: {
    fontSize: FontSize.body,
  },
});
