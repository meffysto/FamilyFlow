import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Radius, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

export type Segment<T extends string = string> = {
  id: T;
  label: string;
  badge?: number;
};

type Props<T extends string = string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: object;
};

export function SegmentedControl<T extends string = string>({ segments, value, onChange, style }: Props<T>) {
  const { colors, primary } = useThemeColors();

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.cardAlt }, style]}>
      {segments.map((seg) => {
        const active = seg.id === value;
        return (
          <TouchableOpacity
            key={seg.id}
            style={[styles.btn, active && [styles.btnActive, { backgroundColor: colors.card }]]}
            onPress={() => onChange(seg.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={seg.label}
          >
            <Text style={[
              styles.text,
              { color: colors.textMuted },
              active && { color: colors.text, fontWeight: FontWeight.bold },
            ]}>
              {seg.label}
            </Text>
            {!!seg.badge && (
              <View style={[styles.badge, { backgroundColor: primary }]}>
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                  {seg.badge > 99 ? '99+' : seg.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    borderRadius: Radius.base,
    padding: 3,
    gap: 2,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.xs,
  },
  btnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  badge: {
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxs,
  },
  badgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },
});
