/**
 * SlotPickerSheet.tsx — Modal pageSheet pour verrouiller un slot temporel
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Présenté en pageSheet (drag-to-dismiss natif iOS). 4 options + bouton Annuler
 * via le ModalHeader. Le slot courant est mis en évidence.
 */

import React, { useCallback } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { Sunrise, Sun, Sunset, Moon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SLOT_DEFINITIONS, SLOT_IDS } from '../../lib/time-blocking';
import type { SlotId } from '../../lib/types';

const ICON_MAP = { Sunrise, Sun, Sunset, Moon } as const;

interface SlotPickerSheetProps {
  visible: boolean;
  currentSlot: SlotId | null;
  onClose: () => void;
  onSelect: (slot: SlotId) => void;
}

export function SlotPickerSheet({ visible, currentSlot, onClose, onSelect }: SlotPickerSheetProps) {
  const { colors } = useThemeColors();

  const handleSelect = useCallback(
    (slot: SlotId) => {
      Haptics.selectionAsync();
      onSelect(slot);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View
          style={[styles.dragHandle, { backgroundColor: colors.separator }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <ModalHeader title="Choisir un créneau" onClose={onClose} />
        <View style={styles.list}>
          {SLOT_IDS.map((slotId) => {
            const def = SLOT_DEFINITIONS[slotId];
            const Icon = ICON_MAP[def.iconName];
            const isSelected = currentSlot === slotId;
            return (
              <Pressable
                key={slotId}
                onPress={() => handleSelect(slotId)}
                style={[
                  styles.row,
                  {
                    backgroundColor: isSelected ? colors.brand.wash : 'transparent',
                    borderColor: isSelected ? colors.brand.soil : colors.border,
                  },
                ]}
                accessibilityLabel={`Choisir ${def.label}`}
                accessibilityRole="button"
              >
                <Icon size={20} color={colors.brand.soil} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.text }]}>{def.label}</Text>
                  <Text style={[styles.range, { color: colors.textMuted }]}>
                    {def.timeRangeLabel}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: Radius.xxs,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  list: {
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  label: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  range: {
    fontSize: FontSize.label,
    marginTop: 2,
  },
});
