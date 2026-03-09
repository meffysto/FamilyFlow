import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { formatDateForDisplay } from '../../lib/parser';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { DateInput } from '../ui/DateInput';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface SettingsVacationProps {
  vacationConfig: { startDate: string; endDate: string } | null;
  isVacationActive: boolean;
  activateVacation: (start: string, end: string) => Promise<void>;
  deactivateVacation: () => void;
}

export function SettingsVacation({ vacationConfig, isVacationActive, activateVacation, deactivateVacation }: SettingsVacationProps) {
  const { primary, colors } = useThemeColors();
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleActivate = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Champs requis', 'Les deux dates sont obligatoires.');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('Dates invalides', 'La date de fin doit être après la date de début.');
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (endDate < todayStr) {
      Alert.alert('Dates invalides', 'La date de fin doit être aujourd\'hui ou plus tard.');
      return;
    }
    await activateVacation(startDate, endDate);
    setShowForm(false);
    Alert.alert('☀️ Mode vacances activé !', 'Rendez-vous dans l\'onglet Tâches pour voir votre checklist.');
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Désactiver le mode vacances ?',
      'Les tâches normales seront restaurées. La checklist vacances sera conservée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Désactiver', style: 'destructive', onPress: deactivateVacation },
      ]
    );
  };

  const renderCountdown = () => {
    if (!vacationConfig) return null;
    const now = new Date();
    const end = new Date(vacationConfig.endDate + 'T23:59:59');
    const start = new Date(vacationConfig.startDate + 'T00:00:00');
    const todayMs = now.getTime();
    if (todayMs < start.getTime()) {
      const days = Math.ceil((start.getTime() - todayMs) / 86400000);
      return `Départ dans ${days} jour${days > 1 ? 's' : ''}`;
    }
    const days = Math.ceil((end.getTime() - todayMs) / 86400000);
    return `Fin dans ${days} jour${days > 1 ? 's' : ''}`;
  };

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Mode Vacances">
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Mode Vacances</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        {isVacationActive && vacationConfig ? (
          <>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textSub }]}>☀️ Vacances en cours</Text>
            </View>
            <Text style={[styles.dates, { color: colors.text }]}>
              Du {formatDateForDisplay(vacationConfig.startDate)} au {formatDateForDisplay(vacationConfig.endDate)}
            </Text>
            <Text style={[styles.countdown, { color: primary }]}>{renderCountdown()}</Text>
            <Button label="Désactiver le mode vacances" onPress={handleDeactivate} variant="danger" size="sm" fullWidth />
          </>
        ) : (
          <>
            {!showForm ? (
              <Button label="☀️ Activer le mode vacances" onPress={() => { setShowForm(true); setStartDate(''); setEndDate(''); }} variant="secondary" size="sm" fullWidth />
            ) : (
              <>
                <Text style={[styles.rowLabel, { color: colors.textSub }]}>📅 Date de début</Text>
                <DateInput value={startDate} onChange={setStartDate} placeholder="Date de début" />
                <Text style={[styles.rowLabel, { color: colors.textSub }]}>📅 Date de fin</Text>
                <DateInput value={endDate} onChange={setEndDate} placeholder="Date de fin" />
                <View style={styles.btnRow}>
                  <Button label="Annuler" onPress={() => setShowForm(false)} variant="ghost" size="sm" />
                  <Button label="Activer" onPress={handleActivate} variant="primary" size="sm" />
                </View>
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  dates: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  countdown: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  btnRow: { flexDirection: 'row', gap: Spacing.md },
});
