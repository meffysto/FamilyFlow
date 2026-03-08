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

interface Props {
  prefs: NotificationPreferences;
  activeProfile: Profile | null;
  onSave: (prefs: NotificationPreferences) => Promise<void>;
  onClose: () => void;
}

export function NotificationSettings({ prefs, activeProfile, onSave, onClose }: Props) {
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
      Alert.alert('Erreur', 'Le nom est obligatoire.');
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
            {activeCount} active{activeCount > 1 ? 's' : ''} sur {prefs.notifications.length}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.closeBtn, { color: colors.textFaint }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Built-in notifications */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NOTIFICATIONS INTEGRÉES</Text>
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
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom notifications */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NOTIFICATIONS PERSONNALISÉES</Text>
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
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCustom, { backgroundColor: colors.card }]}>
          <Text style={[styles.emptyText, { color: colors.textFaint }]}>Aucune notification personnalisée</Text>
        </View>
      )}

      {/* Add custom button */}
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: tint, borderColor: primary }]}
        onPress={() => setShowNewCustom(true)}
      >
        <Text style={[styles.addBtnText, { color: primary }]}>+ Ajouter une notification</Text>
      </TouchableOpacity>

      {/* New custom modal */}
      <Modal visible={showNewCustom} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nouvelle notification</Text>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Emoji</Text>
              <TextInput
                style={[styles.modalInput, { width: 70, textAlign: 'center', fontSize: 24, borderColor: colors.inputBorder, color: colors.text }]}
                value={newEmoji}
                onChangeText={setNewEmoji}
                maxLength={4}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Nom</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.inputBorder, color: colors.text }]}
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="Ex: Rappel courses"
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
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateBtn, { backgroundColor: primary }]}
                onPress={handleCreateCustom}
              >
                <Text style={styles.modalCreateText}>Créer</Text>
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
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: { fontSize: 22, padding: 4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
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
  notifEmoji: { fontSize: 22 },
  notifLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyCustom: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14 },
  addBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalField: { gap: 6 },
  modalLabel: { fontSize: 13, fontWeight: '600' },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalCreateBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCreateText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
