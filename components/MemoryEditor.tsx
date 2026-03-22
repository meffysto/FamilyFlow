/**
 * MemoryEditor.tsx — Modal form for creating souvenirs/premières fois
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { ModalHeader } from './ui/ModalHeader';
import { Memory, MemoryType } from '../lib/types';
import { DateInput } from './ui/DateInput';
import { FontSize, FontWeight } from '../constants/typography';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const TYPE_KEYS: { key: string; value: MemoryType }[] = [
  { key: 'firstTime', value: 'premières-fois' },
  { key: 'highlight', value: 'moment-fort' },
];

interface MemoryEditorProps {
  memory?: Memory;
  enfants: { id: string; name: string }[];
  onSave: (enfant: string, memory: Omit<Memory, 'enfant' | 'enfantId'>) => Promise<void>;
  onClose: () => void;
}

export function MemoryEditor({ memory, enfants, onSave, onClose }: MemoryEditorProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { bg, card, text, textSub, textMuted, textFaint, border, inputBg } = colors;

  const [type, setType] = useState<MemoryType>(memory?.type ?? 'premières-fois');
  const [title, setTitle] = useState(memory?.title ?? '');
  const [description, setDescription] = useState(memory?.description ?? '');
  const [date, setDate] = useState(
    memory?.date ?? format(new Date(), 'yyyy-MM-dd')
  );
  const [enfant, setEnfant] = useState(memory?.enfant ?? enfants[0]?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('editors.memory.toast.titleRequired'), t('editors.memory.toast.titleRequiredMsg'));
      return;
    }
    if (!date) {
      Alert.alert(t('editors.memory.toast.dateRequired'), t('editors.memory.toast.dateRequiredMsg'));
      return;
    }

    setIsSaving(true);
    try {
      await onSave(enfant, {
        date,
        title: title.trim(),
        description: description.trim(),
        type,
      });
      onClose();
    } catch (e) {
      Alert.alert(t('editors.memory.toast.error'), String(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: card }]}>
      <ModalHeader
        title={memory ? t('editors.memory.titleEdit') : t('editors.memory.titleNew')}
        onClose={onClose}
        rightLabel={isSaving ? '…' : t('editors.save')}
        onRight={handleSave}
        rightDisabled={isSaving}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Type */}
        <Text style={[styles.label, { color: textSub }]}>{t('editors.memory.typeLabel')}</Text>
        <View style={styles.chipRow}>
          {TYPE_KEYS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                { borderColor: border, backgroundColor: inputBg },
                type === opt.value && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setType(opt.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: textMuted },
                  type === opt.value && { color: primary, fontWeight: FontWeight.bold },
                ]}
              >
                {t(`editors.memory.typeOptions.${opt.key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Enfant */}
        {enfants.length > 1 && (
          <>
            <Text style={[styles.label, { color: textSub }]}>{t('editors.memory.childLabel')}</Text>
            <View style={styles.chipRow}>
              {enfants.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={[
                    styles.chip,
                    { borderColor: border, backgroundColor: inputBg },
                    enfant === e.name && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => setEnfant(e.name)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: textMuted },
                      enfant === e.name && { color: primary, fontWeight: FontWeight.bold },
                    ]}
                  >
                    {e.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Titre */}
        <Text style={[styles.label, { color: textSub }]}>{t('editors.memory.titleFieldLabel')}</Text>
        <TextInput
          style={[styles.input, { borderColor: border, color: text, backgroundColor: inputBg }]}
          value={title}
          onChangeText={setTitle}
          placeholder={t('editors.memory.titlePlaceholder')}
          placeholderTextColor={textFaint}
        />

        {/* Description */}
        <Text style={[styles.label, { color: textSub }]}>{t('editors.memory.descriptionLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea, { borderColor: border, color: text, backgroundColor: inputBg }]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('editors.memory.descriptionPlaceholder')}
          placeholderTextColor={textFaint}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Date */}
        <Text style={[styles.label, { color: textSub }]}>{t('editors.memory.dateLabel')}</Text>
        <DateInput value={date} onChange={setDate} placeholder={t('editors.memory.datePlaceholder')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  label: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: FontSize.body,
  },
  textArea: {
    minHeight: 80,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: FontSize.sm,
  },
});
