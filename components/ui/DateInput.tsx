/**
 * DateInput — Sélecteur de date natif iOS/Android
 *
 * Remplace les TextInput manuels par un date picker natif.
 * Stocke en interne au format ISO (YYYY-MM-DD), affiche en DD/MM/YYYY.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight } from '../../constants/typography';

interface DateInputProps {
  /** Date au format YYYY-MM-DD (ISO) */
  value: string;
  /** Callback avec la date au format YYYY-MM-DD */
  onChange: (isoDate: string) => void;
  /** Placeholder affiché quand value est vide */
  placeholder?: string;
  /** Mode: 'date' ou 'time' */
  mode?: 'date' | 'time';
  /** Style additionnel pour le bouton */
  style?: object;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseISOtoDate(iso: string): Date {
  if (!iso) return new Date();
  if (iso.includes(':')) {
    // Time format HH:MM
    const [h, m] = iso.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  const [y, mm, dd] = iso.split('-').map(Number);
  return new Date(y, mm - 1, dd);
}

export function DateInput({ value, onChange, placeholder = 'Choisir une date', mode = 'date', style }: DateInputProps) {
  const { colors, primary } = useThemeColors();
  const [showPicker, setShowPicker] = useState(false);

  const displayValue = mode === 'date'
    ? (value ? formatDisplay(value) : '')
    : (value || '');

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (!selectedDate) return;
    onChange(mode === 'date' ? toISO(selectedDate) : toHHMM(selectedDate));
  };

  const handleConfirm = () => {
    setShowPicker(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, style]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.buttonText, { color: value ? colors.text : colors.textFaint }]}>
          {displayValue || placeholder}
        </Text>
        <Text style={styles.icon}>{mode === 'date' ? '📅' : '🕐'}</Text>
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseISOtoDate(value)}
          mode={mode}
          display="default"
          onChange={handleChange}
          locale="fr-FR"
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" statusBarTranslucent>
          <View style={styles.iosOverlay}>
            <View style={[styles.iosSheet, { backgroundColor: colors.card }]}>
              <View style={styles.iosHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={[styles.iosCancel, { color: colors.textMuted }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={[styles.iosConfirm, { color: primary }]}>OK</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={parseISOtoDate(value)}
                mode={mode}
                display="spinner"
                onChange={handleChange}
                locale="fr-FR"
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  buttonText: {
    fontSize: FontSize.body,
    flex: 1,
  },
  icon: {
    fontSize: FontSize.heading,
    marginLeft: 8,
  },
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  iosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iosCancel: {
    fontSize: FontSize.lg,
  },
  iosConfirm: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  iosPicker: {
    height: 200,
  },
});
