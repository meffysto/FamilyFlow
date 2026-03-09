import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
  color?: string;
  size?: 'sm' | 'md';
}

export const Chip = React.memo(function Chip({
  label,
  selected = false,
  onPress,
  emoji,
  color,
  size = 'md',
}: ChipProps) {
  const { primary, tint, colors } = useThemeColors();
  const accentColor = color || primary;

  const containerStyle: ViewStyle = {
    backgroundColor: selected ? tint : colors.cardAlt,
    borderColor: selected ? accentColor : colors.border,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: size === 'sm' ? Spacing.xs : Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  };

  const textStyle: TextStyle = {
    fontSize: size === 'sm' ? FontSize.label : FontSize.body,
    fontWeight: selected ? FontWeight.bold : FontWeight.normal,
    color: selected ? accentColor : colors.textSub,
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {emoji ? <Text style={styles.emoji}>{emoji} </Text> : null}
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  emoji: {
    fontSize: FontSize.sm,
  },
});
