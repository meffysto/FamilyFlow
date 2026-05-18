/**
 * SlotBadge.tsx — Badge slot affiché sur chaque TaskCard en mode Journée
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Variantes :
 * - Explicit (timeSlot verrouillé par l'utilisateur) : icône slot Lucide,
 *   bordure solide, couleur soil.
 * - Auto (placement calculé) : icône Wand2, bordure pointillée, couleur soilMuted.
 *
 * Interactions :
 * - Tap          → ouvre SlotPickerSheet (handler externe)
 * - Long-press   → renvoie au backlog (handler externe)
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Sunrise, Sun, Sunset, Moon, Wand2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Radius } from '../../constants/spacing';
import { SLOT_DEFINITIONS } from '../../lib/time-blocking';
import type { SlotId } from '../../lib/types';

const ICON_MAP = { Sunrise, Sun, Sunset, Moon } as const;

interface SlotBadgeProps {
  slot: SlotId;
  isAuto: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const SlotBadge = React.memo(function SlotBadge({
  slot,
  isAuto,
  onPress,
  onLongPress,
}: SlotBadgeProps) {
  const { colors } = useThemeColors();
  const def = SLOT_DEFINITIONS[slot];
  const Icon = isAuto ? Wand2 : ICON_MAP[def.iconName];

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress();
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={600}
      style={[
        styles.badge,
        {
          borderColor: isAuto ? colors.brand.soilMuted : colors.brand.soil,
          borderStyle: isAuto ? 'dashed' : 'solid',
          backgroundColor: colors.brand.wash,
        },
      ]}
      accessibilityLabel={`${def.label}${isAuto ? ' (placement automatique)' : ''}`}
      accessibilityRole="button"
    >
      <Icon
        size={12}
        color={isAuto ? colors.brand.soilMuted : colors.brand.soil}
        strokeWidth={2.5}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  badge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
