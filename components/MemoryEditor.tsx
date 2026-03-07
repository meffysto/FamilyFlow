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
import { Memory, MemoryType } from '../lib/types';
import { formatDateForDisplay, parseDateInput } from '../lib/parser';
import { format } from 'date-fns';

const TYPE_OPTIONS: { label: string; value: MemoryType }[] = [
  { label: '🌟 Première fois', value: 'premières-fois' },
  { label: '💛 Moment fort', value: 'moment-fort' },
];

interface MemoryEditorProps {
  memory?: Memory;
  enfants: { id: string; name: string }[];
  onSave: (enfant: string, memory: Omit<Memory, 'enfant' | 'enfantId'>) => Promise<void>;
  onClose: () => void;
}

export function MemoryEditor({ memory, enfants, onSave, onClose }: MemoryEditorProps) {
  const { primary, tint } = useThemeColors();

  const [type, setType] = useState<MemoryType>(memory?.type ?? 'premières-fois');
  const [title, setTitle] = useState(memory?.title ?? '');
  const [description, setDescription] = useState(memory?.description ?? '');
  const [date, setDate] = useState(
    memory?.date ? formatDateForDisplay(memory.date) : format(new Date(), 'dd/MM/yyyy')
  );
  const [enfant, setEnfant] = useState(memory?.enfant ?? enfants[0]?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Champ requis', 'Le titre est obligatoire.');
      return;
    }
    if (!date) {
      Alert.alert('Champ requis', 'La date est obligatoire.');
      return;
    }

    const parsedDate = parseDateInput(date);
    if (!parsedDate) {
      Alert.alert('Date invalide', 'Format attendu : JJ/MM/AAAA');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(enfant, {
        date: parsedDate,
        title: title.trim(),
        description: description.trim(),
        type,
      });
      onClose();
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {memory ? 'Modifier' : 'Nouveau souvenir'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          <Text style={[styles.saveBtn, { color: primary }]}>
            {isSaving ? '...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Type */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                type === opt.value && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setType(opt.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  type === opt.value && { color: primary, fontWeight: '700' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Enfant */}
        {enfants.length > 1 && (
          <>
            <Text style={styles.label}>Enfant</Text>
            <View style={styles.chipRow}>
              {enfants.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={[
                    styles.chip,
                    enfant === e.name && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => setEnfant(e.name)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      enfant === e.name && { color: primary, fontWeight: '700' },
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
        <Text style={styles.label}>Titre *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Premier sourire, Premier pas..."
          placeholderTextColor="#9CA3AF"
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Raconte ce moment..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="JJ/MM/AAAA"
          placeholderTextColor="#9CA3AF"
          keyboardType="numbers-and-punctuation"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancel: { fontSize: 15, color: '#6B7280' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  saveBtn: { fontSize: 15, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
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
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  chipText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
