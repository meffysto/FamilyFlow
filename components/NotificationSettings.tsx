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
  const { primary, tint } = useThemeColors();
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {activeCount} active{activeCount > 1 ? 's' : ''} sur {prefs.notifications.length}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Built-in notifications */}
      <Text style={styles.sectionLabel}>NOTIFICATIONS INTEGRÉES</Text>
      <View style={styles.card}>
        {builtins.map((notif, idx) => (
          <TouchableOpacity
            key={notif.id}
            style={[styles.notifRow, idx < builtins.length - 1 && styles.notifRowBorder]}
            onPress={() => setEditingNotif(notif)}
            activeOpacity={0.7}
          >
            <Text style={styles.notifEmoji}>{notif.emoji}</Text>
            <Text style={styles.notifLabel}>{notif.label}</Text>
            <Switch
              value={notif.enabled}
              onValueChange={(val) => handleToggle(notif.id, val)}
              trackColor={{ true: primary, false: '#D1D5DB' }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom notifications */}
      <Text style={styles.sectionLabel}>NOTIFICATIONS PERSONNALISÉES</Text>
      {customs.length > 0 ? (
        <View style={styles.card}>
          {customs.map((notif, idx) => (
            <TouchableOpacity
              key={notif.id}
              style={[styles.notifRow, idx < customs.length - 1 && styles.notifRowBorder]}
              onPress={() => setEditingNotif(notif)}
              activeOpacity={0.7}
            >
              <Text style={styles.notifEmoji}>{notif.emoji}</Text>
              <Text style={styles.notifLabel}>{notif.label}</Text>
              <Switch
                value={notif.enabled}
                onValueChange={(val) => handleToggle(notif.id, val)}
                trackColor={{ true: primary, false: '#D1D5DB' }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCustom}>
          <Text style={styles.emptyText}>Aucune notification personnalisée</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouvelle notification</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Emoji</Text>
              <TextInput
                style={[styles.modalInput, { width: 70, textAlign: 'center', fontSize: 24 }]}
                value={newEmoji}
                onChangeText={setNewEmoji}
                maxLength={4}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Nom</Text>
              <TextInput
                style={styles.modalInput}
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="Ex: Rappel courses"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowNewCustom(false);
                  setNewLabel('');
                  setNewEmoji('📌');
                }}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
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
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  closeBtn: { fontSize: 22, color: '#9CA3AF', padding: 4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#F3F4F6',
  },
  notifEmoji: { fontSize: 22 },
  notifLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  emptyCustom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalField: { gap: 6 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modalCreateBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCreateText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
