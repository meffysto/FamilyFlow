/**
 * NotificationSettings.tsx — Notification management modal
 *
 * Lists all notifications (built-in + custom) with toggles.
 * Tap a row → opens NotificationEditor.
 * "+ Ajouter" button → creates a new custom notification.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { NotificationConfig, NotificationPreferences, Profile } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';
import { createCustomNotification } from '../lib/notifications';
import { NotificationEditor } from './NotificationEditor';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { useTranslation } from 'react-i18next';

interface Props {
  prefs: NotificationPreferences;
  activeProfile: Profile | null;
  onSave: (prefs: NotificationPreferences) => Promise<void>;
  onClose: () => void;
}

export function NotificationSettings({ prefs, activeProfile, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const [editingNotif, setEditingNotif] = useState<NotificationConfig | null>(null);
  const [showNewCustom, setShowNewCustom] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newEmoji, setNewEmoji] = useState('📌');

  const builtins = prefs.notifications.filter((n) => !n.isCustom);
  const customs = prefs.notifications.filter((n) => n.isCustom);
  const activeCount = prefs.notifications.filter((n) => n.enabled).length;

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      const updated: NotificationPreferences = {
        ...prefs,
        notifications: prefs.notifications.map((n) =>
          n.id === id ? { ...n, enabled } : n
        ),
      };
      await onSave(updated);
    },
    [prefs, onSave]
  );

  const handleSaveNotif = useCallback(
    async (updated: NotificationConfig) => {
      const newPrefs: NotificationPreferences = {
        ...prefs,
        notifications: prefs.notifications.map((n) =>
          n.id === updated.id ? updated : n
        ),
      };
      await onSave(newPrefs);
    },
    [prefs, onSave]
  );

  const handleDeleteNotif = useCallback(
    async (id: string) => {
      const newPrefs: NotificationPreferences = {
        ...prefs,
        notifications: prefs.notifications.filter((n) => n.id !== id),
      };
      await onSave(newPrefs);
    },
    [prefs, onSave]
  );

  const handleCreateCustom = useCallback(async () => {
    if (!newLabel.trim()) {
      Alert.alert(t('notificationSettings.alert.errorTitle'), t('notificationSettings.alert.nameRequired'));
      return;
    }
    const custom = createCustomNotification(
      newLabel.trim(),
      newEmoji || '📌',
      `${newEmoji || '📌'} <b>${newLabel.trim()}</b>\n\nMessage personnalisé`
    );
    const newPrefs: NotificationPreferences = {
      ...prefs,
      notifications: [...prefs.notifications, custom],
    };
    await onSave(newPrefs);
    setShowNewCustom(false);
    setNewLabel('');
    setNewEmoji('📌');
    // Open editor for the newly created notification
    setEditingNotif(custom);
  }, [prefs, newLabel, newEmoji, onSave]);

  // If editing a notification, show the editor
  if (editingNotif) {
    // Get fresh config from prefs (in case it was just updated)
    const freshConfig = prefs.notifications.find((n) => n.id === editingNotif.id) ?? editingNotif;
    return (
      <NotificationEditor
        config={freshConfig}
        activeProfile={activeProfile}
        onSave={handleSaveNotif}
        onDelete={freshConfig.isCustom ? () => handleDeleteNotif(freshConfig.id) : undefined}
        onClose={() => setEditingNotif(null)}
      />
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('notificationSettings.activeCount', { active: activeCount, plural: activeCount > 1 ? 's' : '', total: prefs.notifications.length })}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.closeBtn, { color: colors.textFaint }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Built-in notifications */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('notificationSettings.builtinSection')}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {builtins.map((notif, idx) => (
          <TouchableOpacity
            key={notif.id}
            style={[styles.notifRow, idx < builtins.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
            onPress={() => setEditingNotif(notif)}
            activeOpacity={0.7}
          >
            <Text style={styles.notifEmoji}>{notif.emoji}</Text>
            <Text style={[styles.notifLabel, { color: colors.textSub }]}>{notif.label}</Text>
            <Switch
              value={notif.enabled}
              onValueChange={(val) => handleToggle(notif.id, val)}
              trackColor={{ true: primary, false: colors.switchOff }}
              thumbColor={colors.onPrimary}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom notifications */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('notificationSettings.customSection')}</Text>
      {customs.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {customs.map((notif, idx) => (
            <TouchableOpacity
              key={notif.id}
              style={[styles.notifRow, idx < customs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
              onPress={() => setEditingNotif(notif)}
              activeOpacity={0.7}
            >
              <Text style={styles.notifEmoji}>{notif.emoji}</Text>
              <Text style={[styles.notifLabel, { color: colors.textSub }]}>{notif.label}</Text>
              <Switch
                value={notif.enabled}
                onValueChange={(val) => handleToggle(notif.id, val)}
                trackColor={{ true: primary, false: colors.switchOff }}
                thumbColor={colors.onPrimary}
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCustom, { backgroundColor: colors.card }]}>
          <Text style={[styles.emptyText, { color: colors.textFaint }]}>{t('notificationSettings.emptyCustom')}</Text>
        </View>
      )}

      {/* Add custom button */}
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: tint, borderColor: primary }]}
        onPress={() => setShowNewCustom(true)}
      >
        <Text style={[styles.addBtnText, { color: primary }]}>{t('notificationSettings.addBtn')}</Text>
      </TouchableOpacity>

      {/* New custom modal */}
      <Modal visible={showNewCustom} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('notificationSettings.newModal.title')}</Text>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{t('notificationSettings.newModal.emoji')}</Text>
              <TextInput
                style={[styles.modalInput, { width: 70, textAlign: 'center', fontSize: FontSize.heading, borderColor: colors.inputBorder, color: colors.text }]}
                value={newEmoji}
                onChangeText={setNewEmoji}
                maxLength={4}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{t('notificationSettings.newModal.name')}</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.inputBorder, color: colors.text }]}
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder={t('notificationSettings.newModal.namePlaceholder')}
                placeholderTextColor={colors.textFaint}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.inputBorder }]}
                onPress={() => {
                  setShowNewCustom(false);
                  setNewLabel('');
                  setNewEmoji('📌');
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>{t('notificationSettings.newModal.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateBtn, { backgroundColor: primary }]}
                onPress={handleCreateCustom}
              >
                <Text style={[styles.modalCreateText, { color: colors.onPrimary }]}>{t('notificationSettings.newModal.create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  subtitle: { fontSize: FontSize.label, marginTop: 2 },
  closeBtn: { fontSize: FontSize.titleLg, padding: 4 },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.md,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  notifRowBorder: {
    borderBottomWidth: 1,
  },
  notifEmoji: { fontSize: FontSize.titleLg },
  notifLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  emptyCustom: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: FontSize.sm },
  addBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  // New custom modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 16,
  },
  modalTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy },
  modalField: { gap: 6 },
  modalLabel: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    fontSize: FontSize.body,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  modalCreateBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCreateText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
