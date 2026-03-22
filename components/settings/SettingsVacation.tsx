import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDateLocalized } from '../../lib/date-locale';
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
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleActivate = async () => {
    if (!startDate || !endDate) {
      Alert.alert(t('settings.vacation.fieldsRequired'), t('settings.vacation.fieldsRequiredMsg'));
      return;
    }
    if (endDate <= startDate) {
      Alert.alert(t('settings.vacation.invalidDates'), t('settings.vacation.endAfterStart'));
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (endDate < todayStr) {
      Alert.alert(t('settings.vacation.invalidDates'), t('settings.vacation.endInFuture'));
      return;
    }
    await activateVacation(startDate, endDate);
    setShowForm(false);
    Alert.alert(t('settings.vacation.activatedTitle'), t('settings.vacation.activatedMessage'));
  };

  const handleDeactivate = () => {
    Alert.alert(
      t('settings.vacation.deactivateTitle'),
      t('settings.vacation.deactivateMessage'),
      [
        { text: t('settings.vacation.cancel'), style: 'cancel' },
        { text: t('settings.vacation.deactivateConfirmBtn'), style: 'destructive', onPress: deactivateVacation },
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
      return t('settings.vacation.departureCountdown', { count: days });
    }
    const days = Math.ceil((end.getTime() - todayMs) / 86400000);
    return t('settings.vacation.endCountdown', { count: days });
  };

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.vacation.sectionA11y')}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.vacation.sectionTitle')}</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        {isVacationActive && vacationConfig ? (
          <>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.vacation.activeLabel')}</Text>
            </View>
            <Text style={[styles.dates, { color: colors.text }]}>
              {t('settings.vacation.dateRange', { start: formatDateLocalized(vacationConfig.startDate), end: formatDateLocalized(vacationConfig.endDate) })}
            </Text>
            <Text style={[styles.countdown, { color: primary }]}>{renderCountdown()}</Text>
            <Button label={t('settings.vacation.deactivateBtn')} onPress={handleDeactivate} variant="danger" size="sm" fullWidth />
          </>
        ) : (
          <>
            {!showForm ? (
              <Button label={t('settings.vacation.activateBtn')} onPress={() => { setShowForm(true); setStartDate(''); setEndDate(''); }} variant="secondary" size="sm" fullWidth />
            ) : (
              <>
                <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.vacation.startDateLabel')}</Text>
                <DateInput value={startDate} onChange={setStartDate} placeholder={t('settings.vacation.startDatePlaceholder')} />
                <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.vacation.endDateLabel')}</Text>
                <DateInput value={endDate} onChange={setEndDate} placeholder={t('settings.vacation.endDatePlaceholder')} />
                <View style={styles.btnRow}>
                  <Button label={t('settings.vacation.cancelBtn')} onPress={() => setShowForm(false)} variant="ghost" size="sm" />
                  <Button label={t('settings.vacation.activateConfirmBtn')} onPress={handleActivate} variant="primary" size="sm" />
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
