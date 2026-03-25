/**
 * SpeciesPicker.tsx — Sélecteur d'espèce d'arbre
 *
 * Grille des 5 espèces avec prévisualisation de l'arbre.
 * Utilisé dans le modal de l'écran arbre et dans les settings profil.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useThemeColors } from '../../contexts/ThemeContext';
import { TreeView } from './TreeView';
import { ALL_SPECIES, SPECIES_INFO, type TreeSpecies } from '../../lib/mascot/types';
import { ModalHeader } from '../ui';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface SpeciesPickerProps {
  currentSpecies: TreeSpecies;
  level: number;
  onSelect: (species: TreeSpecies) => void;
  onClose: () => void;
}

export function SpeciesPicker({ currentSpecies, level, onSelect, onClose }: SpeciesPickerProps) {
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const [selected, setSelected] = useState<TreeSpecies>(currentSpecies);

  const handleConfirm = () => {
    onSelect(selected);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ModalHeader
        title={t('mascot.picker.title')}
        onClose={onClose}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('mascot.picker.subtitle')}
        </Text>

        {/* Prévisualisation de l'espèce sélectionnée */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[styles.previewContainer, { backgroundColor: isDark ? 'rgba(16,32,48,0.4)' : 'rgba(200,230,255,0.3)' }]}
        >
          <TreeView species={selected} level={Math.max(level, 19)} size={220} interactive />
          <Text style={[styles.previewLabel, { color: colors.text }]}>
            {SPECIES_INFO[selected].emoji} {t(SPECIES_INFO[selected].labelKey)}
          </Text>
        </Animated.View>

        {/* Grille des espèces */}
        <View style={styles.grid}>
          {ALL_SPECIES.map((sp, idx) => {
            const info = SPECIES_INFO[sp];
            const isSelected = sp === selected;
            const isCurrent = sp === currentSpecies;

            return (
              <Animated.View
                key={sp}
                entering={FadeInDown.delay(idx * 80).duration(300)}
              >
                <TouchableOpacity
                  style={[
                    styles.speciesCard,
                    { backgroundColor: colors.card, borderColor: isSelected ? primary : colors.borderLight },
                    isSelected && { borderWidth: 2 },
                    Shadows.sm,
                  ]}
                  onPress={() => setSelected(sp)}
                  activeOpacity={0.7}
                  accessibilityLabel={t(info.labelKey)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <TreeView species={sp} level={8} size={70} showGround={false} interactive={false} />
                  <Text style={[styles.speciesName, { color: isSelected ? primary : colors.text }]}>
                    {info.emoji} {t(info.labelKey)}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: tint }]}>
                      <Text style={[styles.currentText, { color: primary }]}>
                        {t('mascot.picker.current')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Descriptions par espèce */}
        <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
          <Text style={[styles.descTitle, { color: colors.text }]}>
            {SPECIES_INFO[selected].emoji} {t(SPECIES_INFO[selected].labelKey)}
          </Text>
          <Text style={[styles.descText, { color: colors.textMuted }]}>
            {t(`mascot.species.${selected}Desc`)}
          </Text>
        </View>
      </ScrollView>

      {/* Bouton confirmer */}
      <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: primary }]}
          onPress={handleConfirm}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>
            {selected === currentSpecies
              ? t('mascot.picker.keep')
              : t('mascot.picker.confirm', { species: t(SPECIES_INFO[selected].labelKey) })}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: 120,
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  previewContainer: {
    alignItems: 'center',
    borderRadius: Radius['3xl'],
    paddingVertical: Spacing['2xl'],
    marginBottom: Spacing['2xl'],
  },
  previewLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  speciesCard: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    width: 100,
  },
  speciesName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  currentBadge: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.full,
  },
  currentText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
  },
  descCard: {
    padding: Spacing['2xl'],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  descTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  descText: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    paddingVertical: Spacing.xl,
    borderRadius: Radius.base,
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
