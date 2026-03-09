import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface BadgeProps {
  label: string | number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

export const Badge = React.memo(function Badge({
  label,
  variant = 'default',
  size = 'md',
}: BadgeProps) {
  const { colors } = useThemeColors();

  const variantColors: Record<string, { bg: string; text: string }> = {
    default: { bg: colors.cardAlt, text: colors.textMuted },
    success: { bg: colors.successBg, text: colors.successText },
    warning: { bg: colors.warningBg, text: colors.warningText },
    error:   { bg: colors.errorBg,   text: colors.errorText },
    info:    { bg: colors.infoBg,    text: colors.text },
  };

  const { bg, text } = variantColors[variant];

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: Radius.xs,
    paddingHorizontal: size === 'sm' ? Spacing.xs : Spacing.md,
    paddingVertical: size === 'sm' ? Spacing.xxs : Spacing.xs,
    alignSelf: 'flex-start',
  };

  const textStyle: TextStyle = {
    fontSize: size === 'sm' ? FontSize.micro : FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: text,
  };

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
});
