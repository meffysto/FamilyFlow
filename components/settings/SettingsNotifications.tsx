import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationSettings } from '../NotificationSettings';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import {
  loadNotifConfig,
  saveNotifConfig,
  setupDailyReminders,
  setupGrossesseWeekly,
  requestNotificationPermissions,
  NotifScheduleConfig,
} from '../../lib/scheduled-notifications';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface SettingsNotificationsProps {
  notifPrefs: any;
  saveNotifPrefs: (prefs: any) => Promise<void>;
  activeProfile: any;
  profiles: any[];
}

export function SettingsNotificationsSection({ notifPrefs, saveNotifPrefs, activeProfile, profiles }: SettingsNotificationsProps) {
  const { primary, tint, colors } = useThemeColors();
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<NotifScheduleConfig | null>(null);

  // Load on mount
  useState(() => {
    (async () => {
      const config = await loadNotifConfig();
      setLocalConfig(config);
    })();
  });

  return (
    <>
      {/* Telegram notifications */}
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Notifications">
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Notifications</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>🔔 Notifications Telegram</Text>
            <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
              {notifPrefs.notifications.filter((n: any) => n.enabled).length}/{notifPrefs.notifications.length} actives
            </Text>
          </View>
          <Button label="Configurer les notifications" onPress={() => setShowNotifSettings(true)} variant="secondary" size="sm" fullWidth />
        </View>
      </View>

      {/* Local reminders */}
      {localConfig && (
        <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Rappels locaux">
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Rappels locaux</Text>
          <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              Notifications iOS qui rappellent d'ouvrir l'app. Fonctionnent même quand l'app est fermée.
            </Text>
            {([
              { key: 'morningEnabled' as const, label: '☀️ Matin', hourKey: 'morningHour' as const, minuteKey: 'morningMinute' as const },
              { key: 'middayEnabled' as const, label: '📋 Midi', hourKey: 'middayHour' as const, minuteKey: 'middayMinute' as const },
              { key: 'eveningEnabled' as const, label: '🌙 Soir', hourKey: 'eveningHour' as const, minuteKey: 'eveningMinute' as const },
            ]).map(({ key, label, hourKey, minuteKey }) => (
              <TouchableOpacity
                key={key}
                style={[styles.toggleRow, { borderTopColor: colors.borderLight }]}
                onPress={async () => {
                  const updated = { ...localConfig, [key]: !localConfig[key] };
                  setLocalConfig(updated);
                  await saveNotifConfig(updated);
                  const permitted = await requestNotificationPermissions();
                  if (permitted) await setupDailyReminders(updated);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: localConfig[key] }}
                accessibilityLabel={`Rappel ${label}`}
              >
                <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.toggleTime, { color: colors.textMuted }]}>
                  {String(localConfig[hourKey]).padStart(2, '0')}:{String(localConfig[minuteKey]).padStart(2, '0')}
                </Text>
                <Text style={styles.toggleIcon}>{localConfig[key] ? '✅' : '⬜'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.toggleRow, { borderTopColor: colors.borderLight }]}
              onPress={async () => {
                const updated = { ...localConfig, rdvAlertEnabled: !localConfig.rdvAlertEnabled };
                setLocalConfig(updated);
                await saveNotifConfig(updated);
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: localConfig.rdvAlertEnabled }}
              accessibilityLabel="Alertes RDV"
            >
              <Text style={[styles.toggleLabel, { color: colors.text }]}>🏥 Alertes RDV</Text>
              <Text style={[styles.toggleTime, { color: colors.textMuted }]}>1h avant</Text>
              <Text style={styles.toggleIcon}>{localConfig.rdvAlertEnabled ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            {profiles.some((p) => p.statut === 'grossesse' && p.dateTerme) && (
              <TouchableOpacity
                style={[styles.toggleRow, { borderTopColor: colors.borderLight }]}
                onPress={async () => {
                  const updated = { ...localConfig, grossesseWeeklyEnabled: !localConfig.grossesseWeeklyEnabled };
                  setLocalConfig(updated);
                  await saveNotifConfig(updated);
                  const permitted = await requestNotificationPermissions();
                  if (permitted) await setupGrossesseWeekly(updated);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: localConfig.grossesseWeeklyEnabled }}
                accessibilityLabel="Rappel grossesse hebdomadaire"
              >
                <Text style={[styles.toggleLabel, { color: colors.text }]}>🤰 Rappel grossesse</Text>
                <Text style={[styles.toggleTime, { color: colors.textMuted }]}>
                  Lundi {String(localConfig.grossesseWeeklyHour).padStart(2, '0')}:{String(localConfig.grossesseWeeklyMinute).padStart(2, '0')}
                </Text>
                <Text style={styles.toggleIcon}>{localConfig.grossesseWeeklyEnabled ? '✅' : '⬜'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Notification Settings Modal */}
      <Modal visible={showNotifSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifSettings(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <NotificationSettings prefs={notifPrefs} activeProfile={activeProfile} onSave={saveNotifPrefs} onClose={() => setShowNotifSettings(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  rowStatus: { fontSize: FontSize.label, fontWeight: FontWeight.medium },
  hint: { fontSize: FontSize.caption, marginBottom: Spacing.md, lineHeight: 17 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, borderTopWidth: 1 },
  toggleLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  toggleTime: { fontSize: FontSize.caption, marginRight: Spacing.md },
  toggleIcon: { fontSize: FontSize.lg },
  modalSafe: { flex: 1 },
});
