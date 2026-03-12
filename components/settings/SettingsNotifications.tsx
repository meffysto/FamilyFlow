import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationSettings } from '../NotificationSettings';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useVault } from '../../contexts/VaultContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { buildAndSendWeeklySummary } from '../../lib/telegram';
import type { VaultContext as AIVaultContext } from '../../lib/ai-service';
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

const JOURS = ['', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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
  colors: any;
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
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export function SettingsNotificationsSection({ notifPrefs, saveNotifPrefs, activeProfile, profiles, notifData }: SettingsNotificationsProps) {
  const { primary, tint, colors } = useThemeColors();
  const vault = useVault();
  const { showToast } = useToast();
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [config, setConfig] = useState<NotifScheduleConfig | null>(null);
  const [sendingWeekly, setSendingWeekly] = useState(false);

  const handleSendWeeklyNow = useCallback(async () => {
    setSendingWeekly(true);
    try {
      const vaultCtx: AIVaultContext = {
        tasks: vault.tasks,
        menageTasks: vault.menageTasks,
        rdvs: vault.rdvs,
        stock: vault.stock,
        meals: vault.meals,
        courses: vault.courses,
        memories: vault.memories,
        defis: vault.defis,
        wishlistItems: vault.wishlistItems,
        recipes: [],
        profiles: vault.profiles,
        activeProfile: vault.activeProfile,
        journalStats: vault.journalStats,
        healthRecords: vault.healthRecords,
      };
      const result = await buildAndSendWeeklySummary(vaultCtx);
      if (result.sent) {
        showToast('Résumé hebdo envoyé sur Telegram');
      } else {
        showToast(result.error ?? 'Erreur inconnue', 'error');
      }
    } catch {
      showToast("Erreur lors de l'envoi", 'error');
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
    hasGrossesse && config.grossesseEnabled,
    config.weeklyAISummaryEnabled,
  ].filter(Boolean).length : 0;

  return (
    <>
      {/* Notifications locales iOS */}
      {config && (
        <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Notifications locales">
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Notifications locales</Text>
          <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              Notifications iOS basées sur tes données. Fonctionnent même quand l'app est fermée.
              {'\n'}{activeCount} catégorie{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}.
            </Text>

            <ToggleItem
              emoji="🏥"
              label="Rendez-vous médicaux"
              detail={`Veille ${pad(config.rdvVeilleHour)}h · Matin ${pad(config.rdvMatinHour)}h${pad(config.rdvMatinMinute)} · ${config.rdvAvantMinutes} min avant`}
              enabled={config.rdvEnabled}
              onToggle={() => updateConfig({ rdvEnabled: !config.rdvEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="📋"
              label="Tâches avec échéance"
              detail={`Jour J à ${pad(config.taskHour)}h${pad(config.taskMinute)}${config.taskVeille ? ' + veille' : ''}`}
              enabled={config.taskEnabled}
              onToggle={() => updateConfig({ taskEnabled: !config.taskEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="🧹"
              label="Ménage hebdomadaire"
              detail={`${JOURS[config.menageDay]} à ${pad(config.menageHour)}h${pad(config.menageMinute)}`}
              enabled={config.menageEnabled}
              onToggle={() => updateConfig({ menageEnabled: !config.menageEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="🛒"
              label="Stock bas / courses"
              detail={`Tous les jours à ${pad(config.coursesHour)}h${pad(config.coursesMinute)} si stock bas`}
              enabled={config.coursesEnabled}
              onToggle={() => updateConfig({ coursesEnabled: !config.coursesEnabled })}
              colors={colors}
              primary={primary}
            />

            <ToggleItem
              emoji="📱"
              label="Rappel quotidien"
              detail={`Tous les jours à ${pad(config.generalHour)}h${pad(config.generalMinute)}`}
              enabled={config.generalEnabled}
              onToggle={() => updateConfig({ generalEnabled: !config.generalEnabled })}
              colors={colors}
              primary={primary}
              isLast={!hasGrossesse}
            />

            {hasGrossesse && (
              <ToggleItem
                emoji="🤰"
                label="Suivi grossesse"
                detail={`${JOURS[config.grossesseDay]} à ${pad(config.grossesseHour)}h${pad(config.grossesseMinute)}`}
                enabled={config.grossesseEnabled}
                onToggle={() => updateConfig({ grossesseEnabled: !config.grossesseEnabled })}
                colors={colors}
                primary={primary}
              />
            )}

            <ToggleItem
              emoji="📬"
              label="Résumé hebdo IA"
              detail={`Dimanche à ${pad(config.weeklyAISummaryHour)}h${pad(config.weeklyAISummaryMinute)} · Telegram · Clé API requise`}
              enabled={config.weeklyAISummaryEnabled}
              onToggle={() => updateConfig({ weeklyAISummaryEnabled: !config.weeklyAISummaryEnabled })}
              colors={colors}
              primary={primary}
            />
            <View style={styles.sendNowRow}>
              <Button
                label={sendingWeekly ? 'Envoi en cours...' : 'Envoyer maintenant'}
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
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Notifications Telegram">
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Notifications Telegram</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>🔔 Notifications Telegram</Text>
            <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
              {notifPrefs.notifications.filter((n: any) => n.enabled).length}/{notifPrefs.notifications.length} actives
            </Text>
          </View>
          <Button label="Configurer" onPress={() => setShowNotifSettings(true)} variant="secondary" size="sm" fullWidth />
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
