/**
 * HelpModal.tsx — Guide de l'application (pageSheet)
 *
 * Liste scrollable de toutes les sections, groupées par catégorie.
 * Tap sur un item : ferme le modal, navigue vers l'écran, relance les coach marks.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useHelp } from '../../contexts/HelpContext';
import { HELP_GUIDE_SECTIONS } from '../../lib/help-content';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { resetScreen } = useHelp();
  const router = useRouter();

  const handleItemPress = async (screenId: string, route: string) => {
    await resetScreen(screenId);
    onClose();
    // Petit délai pour laisser le modal se fermer avant la navigation
    setTimeout(() => {
      router.push(route as any);
    }, 300);
  };

  let globalIndex = 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <ModalHeader title={t('helpModal.title')} onClose={onClose} closeLeft />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {HELP_GUIDE_SECTIONS.map((section) => (
          <View key={section.category} style={styles.categoryBlock}>
            <Text style={[styles.categoryTitle, { color: colors.textMuted }]}>
              {section.category}
            </Text>
            <View style={[styles.card, Shadows.sm, { backgroundColor: colors.bg }]}>
              {section.items.map((item, itemIndex) => {
                const idx = globalIndex++;
                return (
                  <Animated.View
                    key={item.screenId}
                    entering={FadeInDown.delay(idx * 50).springify()}
                  >
                    <TouchableOpacity
                      style={[
                        styles.item,
                        itemIndex < section.items.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.separator,
                        },
                      ]}
                      onPress={() => handleItemPress(item.screenId, item.route)}
                      activeOpacity={0.6}
                      accessibilityRole="button"
                      accessibilityLabel={t('helpModal.itemA11y', { name: item.name, description: item.description })}
                    >
                      <Text style={styles.itemEmoji}>{item.emoji}</Text>
                      <View style={styles.itemText}>
                        <Text style={[styles.itemName, { color: colors.text }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.itemDesc, { color: colors.textSub }]}>
                          {item.description}
                        </Text>
                      </View>
                      <Text style={[styles.chevron, { color: colors.textFaint }]}>›</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], paddingBottom: Spacing['5xl'], gap: Spacing['2xl'] },
  categoryBlock: { gap: Spacing.md },
  categoryTitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.xs,
  },
  card: { borderRadius: Radius.xl, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  itemEmoji: { fontSize: FontSize.title },
  itemText: { flex: 1, gap: Spacing.xxs },
  itemName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  itemDesc: { fontSize: FontSize.sm },
  chevron: { fontSize: FontSize.title, fontWeight: FontWeight.normal },
});
