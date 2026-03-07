/**
 * NotificationEditor.tsx — Edit a single notification
 *
 * Shows:
 * - Enable/disable toggle
 * - Template editor (multiline TextInput)
 * - Variable chips (tap to insert)
 * - Live preview with mock data
 * - Reset to default (built-in) / Delete (custom)
 * - Send now (custom only)
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NotificationConfig, Profile } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';
import { renderTemplate, dispatchNotification, buildManualContext } from '../lib/notifications';

interface Props {
  config: NotificationConfig;
  activeProfile: Profile | null;
  onSave: (updated: NotificationConfig) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function NotificationEditor({ config, activeProfile, onSave, onDelete, onClose }: Props) {
  const { primary, tint } = useThemeColors();
  const [enabled, setEnabled] = useState(config.enabled);
  const [template, setTemplate] = useState(config.template);
  const [label, setLabel] = useState(config.label);
  const [emoji, setEmoji] = useState(config.emoji);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Build mock context for preview
  const mockContext = useMemo(() => {
    const ctx: Record<string, string> = {};
    for (const v of config.availableVariables) {
      ctx[v.key] = v.example;
    }
    return ctx;
  }, [config.availableVariables]);

  const preview = useMemo(() => {
    // Replace \n with actual newlines for preview, then render
    const withNewlines = template.replace(/\\n/g, '\n');
    return renderTemplate(withNewlines, mockContext)
      .replace(/<b>/g, '')
      .replace(/<\/b>/g, '')
      .replace(/<i>/g, '')
      .replace(/<\/i>/g, '');
  }, [template, mockContext]);

  const handleInsertVariable = useCallback((key: string) => {
    setTemplate((prev) => prev + `{{${key}}}`);
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      ...config,
      enabled,
      template,
      label: config.isCustom ? label : config.label,
      emoji: config.isCustom ? emoji : config.emoji,
    });
    onClose();
  }, [config, enabled, template, label, emoji, onSave, onClose]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser',
      'Remettre le message par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          onPress: () => setTemplate(config.defaultTemplate),
        },
      ]
    );
  }, [config.defaultTemplate]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer',
      `Supprimer la notification "${config.label}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            onDelete?.();
            onClose();
          },
        },
      ]
    );
  }, [config.label, onDelete, onClose]);

  const handleSendNow = useCallback(async () => {
    setIsSending(true);
    try {
      const context = buildManualContext(activeProfile);
      const prefs = {
        version: 1 as const,
        notifications: [{ ...config, enabled: true, template }],
      };
      const ok = await dispatchNotification(config.id, context, prefs);
      if (ok) {
        Alert.alert('Envoyé !', 'Notification envoyée sur Telegram.');
      } else {
        Alert.alert('Erreur', 'Impossible d\'envoyer. Vérifiez la configuration Telegram.');
      }
    } catch {
      Alert.alert('Erreur', 'Échec de l\'envoi.');
    } finally {
      setIsSending(false);
    }
  }, [config, template, activeProfile]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.backBtn, { color: primary }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{config.emoji} {config.label}</Text>
      </View>

      {/* Enable toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Activée</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ true: primary, false: '#D1D5DB' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Custom notification name + emoji */}
      {config.isCustom && (
        <View style={styles.customFields}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Emoji</Text>
            <TextInput
              style={[styles.fieldInput, { width: 60, textAlign: 'center' }]}
              value={emoji}
              onChangeText={setEmoji}
              maxLength={4}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput
              style={[styles.fieldInput, { flex: 1 }]}
              value={label}
              onChangeText={setLabel}
              placeholder="Nom de la notification"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
      )}

      {/* Template editor */}
      <Text style={styles.sectionLabel}>Message</Text>
      <TextInput
        ref={inputRef}
        style={styles.templateInput}
        value={template}
        onChangeText={setTemplate}
        multiline
        textAlignVertical="top"
        placeholder="Écrivez votre message ici..."
        placeholderTextColor="#9CA3AF"
      />

      {/* Variable chips */}
      <Text style={styles.sectionLabel}>Variables disponibles</Text>
      <View style={styles.variablesGrid}>
        {config.availableVariables.map((v) => (
          <TouchableOpacity
            key={v.key}
            style={[styles.varChip, { backgroundColor: tint }]}
            onPress={() => handleInsertVariable(v.key)}
          >
            <Text style={[styles.varKey, { color: primary }]}>{`{{${v.key}}}`}</Text>
            <Text style={styles.varLabel}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Preview */}
      <Text style={styles.sectionLabel}>Aperçu</Text>
      <View style={styles.previewBox}>
        <Text style={styles.previewText}>{preview}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!config.isCustom && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primary }]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Sauvegarder</Text>
        </TouchableOpacity>
      </View>

      {/* Custom-only actions */}
      {config.isCustom && (
        <View style={styles.customActions}>
          <TouchableOpacity
            style={[styles.sendBtn, isSending && styles.btnDisabled]}
            onPress={handleSendNow}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendBtnText}>📤 Envoyer maintenant</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  header: { gap: 8 },
  backBtn: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  customFields: { gap: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', width: 50 },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: '#111827',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  templateInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#111827',
    minHeight: 120,
    lineHeight: 20,
    fontFamily: 'Menlo',
  },
  variablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  varChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  varKey: { fontSize: 11, fontWeight: '700', fontFamily: 'Menlo' },
  varLabel: { fontSize: 10, color: '#6B7280' },
  previewBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  customActions: { gap: 10 },
  sendBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  sendBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  deleteBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  btnDisabled: { opacity: 0.6 },
});
