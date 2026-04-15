import React, { useState, useEffect, useCallback } from 'react';
import type { AppColors } from '../../constants/colors';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NotificationSettings } from '../NotificationSettings';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useVault } from '../../contexts/VaultContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { buildAndSendWeeklySummary } from '../../lib/telegram';
import {
  loadNotifConfig,
  saveNotifConfig,
  requestNotificationPermissions,
  setupAllNotifications,
  NotifScheduleConfig,
  DEFAULT_CONFIG,
  type NotifData,
} from '../../lib/scheduled-notifications';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const JOURS_KEYS = ['', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface SettingsNotificationsProps {
  notifPrefs: any;
  saveNotifPrefs: (prefs: any) => Promise<void>;
  activeProfile: any;
  profiles: any[];
  notifData: NotifData;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface ToggleItemProps {
  emoji: string;
  label: string;
  detail: string;
  enabled: boolean;
  onToggle: () => void;
  colors: AppColors;
  primary: string;
  isLast?: boolean;
}

function ToggleItem({ emoji, label, detail, enabled, onToggle, colors, primary, isLast }: ToggleItemProps) {
  return (
    <View style={[styles.toggleRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
      <Text style={styles.toggleEmoji}>{emoji}</Text>
      <View style={styles.toggleContent}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.toggleDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ true: primary, false: colors.switchOff }}
        thumbColor={colors.onPrimary}
      />
    </View>
  );
}

export function SettingsNotificationsSection({ notifPrefs, saveNotifPrefs, activeProfile, profiles, notifData }: SettingsNotificationsProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const vault = useVault();
  const { showToast } = useToast();
  const JOURS = JOURS_KEYS.map(k => k ? t(`settings.notifications.days.${k}`) : '');
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [config, setConfig] = useState<NotifScheduleConfig | null>(null);
  const [sendingWeekly, setSendingWeekly] = useState(false);

  const handleSendWeeklyNow = useCallback(async () => {
    setSendingWeekly(true);
    try {
      const result = await buildAndSendWeeklySummary({
        tasks: vault.tasks,
        meals: vault.meals,
        moods: vault.moods,
        quotes: vault.quotes,
        defis: vault.defis,
        profiles: vault.profiles,
        stock: vault.stock,
      });
      if (result.sent) {
        showToast(t('settings.notifications.weeklySent'));
      } else {
        showToast(result.error ?? t('settings.notifications.unknownError'), 'error');
      }
    } catch {
      showToast(t('settings.notifications.sendError'), 'error');
    } finally {
      setSendingWeekly(false);
    }
  }, [vault, showToast]);

  useEffect(() => {
    loadNotifConfig().then(setConfig);
  }, []);

  const updateConfig = async (patch: Partial<NotifScheduleConfig>) => {
    const updated = { ...config!, ...patch };
    setConfig(updated);
    await saveNotifConfig(updated);
    const permitted = await requestNotificationPermissions();
    if (permitted) {
      await setupAllNotifications({ ...notifData, hasGrossesse: profiles.some(p => p.statut === 'grossesse' && p.dateTerme) });
    }
  };

  const hasGrossesse = profiles.some(p => p.statut === 'grossesse' && p.dateTerme);
  const activeCount = config ? [
    config.rdvEnabled,
    config.taskEnabled,
    config.menageEnabled,
    config.coursesEnabled,
    config.generalEnabled,
    config.gratitudeEnabled,
    hasGrossesse && config.grossesseEnabled,
    config.weeklyAISummaryEnabled,
  ].filter(Boolean).length : 0;

  return (
    <>
      {/* Notifications locales iOS */}
      {config && (
        <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.notifications.localA11y')}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.notifications.localTitle')}</Text>
          <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              {t('settings.notifications.localHint')}
              {'\n'}{t('settings.notifications.categoriesActive', { count: activeCount })}
            </Text>

            <ToggleItem
              emoji="🏥"
              label={t('settings.notifications.rdvLabel')}
              detail={t('settings.notifications.rdvDetail', { veilleHour: pad(config.rdvVeilleHour), matinHour: pad(config.rdvMatinHour), matinMinute: pad(config.rdvMatinMinute), avantMinutes: config.rdvAvantMinutes })}
              enabled={config.rdvEnabled}
              onToggle={() => updateConfig({ rdvEnabled: !config.rdvEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="📋"
              label={t('settings.notifications.tasksLabel')}
              detail={t('settings.notifications.tasksDetail', { hour: pad(config.taskHour), minute: pad(config.taskMinute), veille: config.taskVeille ? t('settings.notifications.tasksVeille') : '' })}
              enabled={config.taskEnabled}
              onToggle={() => updateConfig({ taskEnabled: !config.taskEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="🧹"
              label={t('settings.notifications.menageLabel')}
              detail={t('settings.notifications.menageDetail', { day: JOURS[config.menageDay], hour: pad(config.menageHour), minute: pad(config.menageMinute) })}
              enabled={config.menageEnabled}
              onToggle={() => updateConfig({ menageEnabled: !config.menageEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="🛒"
              label={t('settings.notifications.coursesLabel')}
              detail={t('settings.notifications.coursesDetail', { hour: pad(config.coursesHour), minute: pad(config.coursesMinute) })}
              enabled={config.coursesEnabled}
              onToggle={() => updateConfig({ coursesEnabled: !config.coursesEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="📱"
              label={t('settings.notifications.generalLabel')}
              detail={t('settings.notifications.generalDetail', { hour: pad(config.generalHour), minute: pad(config.generalMinute) })}
              enabled={config.generalEnabled}
              onToggle={() => updateConfig({ generalEnabled: !config.generalEnabled })}
              colors={colors}
              primary={primary}
              isLast={!hasGrossesse}
            />

            {hasGrossesse && (
              <ToggleItem
                emoji="🤰"
                label={t('settings.notifications.grossesseLabel')}
                detail={t('settings.notifications.grossesseDetail', { day: JOURS[config.grossesseDay], hour: pad(config.grossesseHour), minute: pad(config.grossesseMinute) })}
                enabled={config.grossesseEnabled}
                onToggle={() => updateConfig({ grossesseEnabled: !config.grossesseEnabled })}
                colors={colors}
                primary={primary}
              />
            )}

            <ToggleItem
              emoji="🙏"
              label={t('settings.notifications.gratitudeLabel')}
              detail={t('settings.notifications.gratitudeDetail', { hour: pad(config.gratitudeHour), minute: pad(config.gratitudeMinute) })}
              enabled={config.gratitudeEnabled}
              onToggle={() => updateConfig({ gratitudeEnabled: !config.gratitudeEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="🏅"
              label={t('settings.notifications.defiLabel')}
              detail={t('settings.notifications.defiDetail')}
              enabled={config.defiEnabled}
              onToggle={() => updateConfig({ defiEnabled: !config.defiEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="📬"
              label={t('settings.notifications.weeklyAILabel')}
              detail={t('settings.notifications.weeklyAIDetail', { hour: pad(config.weeklyAISummaryHour), minute: pad(config.weeklyAISummaryMinute) })}
              enabled={config.weeklyAISummaryEnabled}
              onToggle={() => updateConfig({ weeklyAISummaryEnabled: !config.weeklyAISummaryEnabled })}
              colors={colors}
              primary={primary}
            />
            <View style={styles.sendNowRow}>
              <Button
                label={sendingWeekly ? t('settings.notifications.sendNowLoading') : t('settings.notifications.sendNow')}
                onPress={handleSendWeeklyNow}
                variant="secondary"
                size="sm"
                disabled={sendingWeekly}
                icon="📬"
              />
            </View>
          </View>
        </View>
      )}

      {/* Telegram notifications */}
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.notifications.telegramA11y')}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.notifications.telegramTitle')}</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.notifications.telegramLabel')}</Text>
            <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
              {t('settings.notifications.telegramStatus', { active: notifPrefs.notifications.filter((n: any) => n.enabled).length, total: notifPrefs.notifications.length })}
            </Text>
          </View>
          <Button label={t('settings.notifications.configureBtn')} onPress={() => setShowNotifSettings(true)} variant="secondary" size="sm" fullWidth />
        </View>
      </View>

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
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  rowStatus: { fontSize: FontSize.label, fontWeight: FontWeight.medium },
  hint: { fontSize: FontSize.caption, lineHeight: 17, marginBottom: Spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.md },
  toggleEmoji: { fontSize: FontSize.heading },
  toggleContent: { flex: 1 },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  toggleDetail: { fontSize: FontSize.caption, marginTop: 2 },
  sendNowRow: { paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  modalSafe: { flex: 1 },
});
