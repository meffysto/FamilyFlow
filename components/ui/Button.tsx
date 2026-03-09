import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
}

const SIZE_CONFIG = {
  sm: { paddingH: Spacing.xl, paddingV: Spacing.sm, fontSize: FontSize.sm },
  md: { paddingH: Spacing['2xl'], paddingV: Spacing.lg, fontSize: FontSize.body },
  lg: { paddingH: Spacing['3xl'], paddingV: Spacing.xl, fontSize: FontSize.lg },
} as const;

export const Button = React.memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const { primary, tint, colors } = useThemeColors();

  const variantStyles: Record<string, { bg: string; text: string }> = {
    primary:   { bg: primary,          text: colors.onPrimary },
    secondary: { bg: tint,             text: primary },
    danger:    { bg: colors.errorBg,   text: colors.error },
    ghost:     { bg: 'transparent',    text: colors.textMuted },
  };

  const { bg, text } = variantStyles[variant];
  const sizeConfig = SIZE_CONFIG[size];

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: Radius.md,
    paddingHorizontal: sizeConfig.paddingH,
    paddingVertical: sizeConfig.paddingV,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
    ...(fullWidth ? { width: '100%' } : { alignSelf: 'flex-start' }),
  };

  const textStyle: TextStyle = {
    fontSize: sizeConfig.fontSize,
    fontWeight: FontWeight.semibold,
    color: text,
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      {icon ? <Text style={styles.icon}>{icon} </Text> : null}
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  icon: {
    fontSize: FontSize.body,
  },
});
