import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface ModalHeaderProps {
  title: string;
  /** Optionnel — si absent, aucun bouton close (header simple d'écran). */
  onClose?: () => void;
  /** Bouton droit (ex: "Enregistrer") */
  rightLabel?: string;
  onRight?: () => void;
  rightDisabled?: boolean;
  /** Affiche le close à gauche au lieu de droite */
  closeLeft?: boolean;
}

export const ModalHeader = React.memo(function ModalHeader({
  title,
  onClose,
  rightLabel,
  onRight,
  rightDisabled = false,
  closeLeft = false,
}: ModalHeaderProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();

  const closeButton = onClose ? (
    <TouchableOpacity
      onPress={onClose}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={t('common.close')}
      accessibilityRole="button"
    >
      <Text style={[styles.close, { color: colors.textFaint }]}>✕</Text>
    </TouchableOpacity>
  ) : (
    <View style={styles.placeholder} />
  );

  const rightButton = rightLabel ? (
    <TouchableOpacity
      onPress={onRight}
      disabled={rightDisabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={rightLabel}
      accessibilityRole="button"
      style={rightDisabled ? styles.disabled : undefined}
    >
      <Text style={[styles.rightBtn, { color: primary }]}>
        {rightLabel}
      </Text>
    </TouchableOpacity>
  ) : (
    <View style={styles.placeholder} />
  );

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {closeLeft ? closeButton : rightLabel ? closeButton : <View style={styles.placeholder} />}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {closeLeft ? rightButton : rightLabel ? rightButton : closeButton}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing['3xl'],
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
  },
  close: {
    fontSize: FontSize.title,
  },
  rightBtn: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    padding: Spacing.xs,
  },
  placeholder: {
    width: 28,
  },
  disabled: {
    opacity: 0.5,
  },
});
