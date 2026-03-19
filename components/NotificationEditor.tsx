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
import { useToast } from '../contexts/ToastContext';
import { renderTemplate, dispatchNotification, buildManualContext } from '../lib/notifications';
import { FontSize, FontWeight } from '../constants/typography';

interface Props {
  config: NotificationConfig;
  activeProfile: Profile | null;
  onSave: (updated: NotificationConfig) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function NotificationEditor({ config, activeProfile, onSave, onDelete, onClose }: Props) {
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
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
        showToast('Notification envoyée sur Telegram !');
      } else {
        showToast('Impossible d\'envoyer la notification', 'error');
      }
    } catch {
      showToast('Échec de l\'envoi', 'error');
    } finally {
      setIsSending(false);
    }
  }, [config, template, activeProfile]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.card }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.backBtn, { color: primary }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{config.emoji} {config.label}</Text>
      </View>

      {/* Enable toggle */}
      <View style={[styles.toggleRow, { backgroundColor: colors.cardAlt }]}>
        <Text style={[styles.toggleLabel, { color: colors.textSub }]}>Activée</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ true: primary, false: colors.switchOff }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Custom notification name + emoji */}
      {config.isCustom && (
        <View style={styles.customFields}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Emoji</Text>
            <TextInput
              style={[styles.fieldInput, { width: 60, textAlign: 'center', borderColor: colors.inputBorder, color: colors.text }]}
              value={emoji}
              onChangeText={setEmoji}
              maxLength={4}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Nom</Text>
            <TextInput
              style={[styles.fieldInput, { flex: 1, borderColor: colors.inputBorder, color: colors.text }]}
              value={label}
              onChangeText={setLabel}
              placeholder="Nom de la notification"
              placeholderTextColor={colors.textFaint}
            />
          </View>
        </View>
      )}

      {/* Template editor */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Message</Text>
      <TextInput
        ref={inputRef}
        style={[styles.templateInput, { borderColor: colors.inputBorder, color: colors.text }]}
        value={template}
        onChangeText={setTemplate}
        multiline
        textAlignVertical="top"
        placeholder="Écrivez votre message ici..."
        placeholderTextColor={colors.textFaint}
      />

      {/* Variable chips */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Variables disponibles</Text>
      <View style={styles.variablesGrid}>
        {config.availableVariables.map((v) => (
          <TouchableOpacity
            key={v.key}
            style={[styles.varChip, { backgroundColor: tint }]}
            onPress={() => handleInsertVariable(v.key)}
          >
            <Text style={[styles.varKey, { color: primary }]}>{`{{${v.key}}}`}</Text>
            <Text style={[styles.varLabel, { color: colors.textMuted }]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Preview */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Aperçu</Text>
      <View style={[styles.previewBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Text style={[styles.previewText, { color: colors.textSub }]}>{preview}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!config.isCustom && (
          <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.separator }]} onPress={handleReset}>
            <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>Réinitialiser</Text>
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
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  header: { gap: 8 },
  backBtn: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.heavy },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
  },
  toggleLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  customFields: { gap: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, width: 50 },
  fieldInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
    fontSize: FontSize.body,
  },
  sectionLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  templateInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: FontSize.sm,
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
  varKey: { fontSize: FontSize.code, fontWeight: FontWeight.bold, fontFamily: 'Menlo' },
  varLabel: { fontSize: FontSize.micro },
  previewBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  previewText: {
    fontSize: FontSize.sm,
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
    alignItems: 'center',
  },
  resetBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  customActions: { gap: 10 },
  sendBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  sendBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  deleteBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#EF4444' },
  btnDisabled: { opacity: 0.6 },
});
