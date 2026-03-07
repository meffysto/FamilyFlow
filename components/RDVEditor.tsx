/**
 * RDVEditor.tsx — Modal form for creating/editing RDV (medical appointments)
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { RDV } from '../lib/types';
import { formatDateForDisplay, parseDateInput } from '../lib/parser';

const TYPE_OPTIONS = [
  { label: '👨‍⚕️ Pédiatre', value: 'pédiatre' },
  { label: '💉 Vaccin', value: 'vaccin' },
  { label: '🏥 PMI', value: 'pmi' },
  { label: '🦷 Dentiste', value: 'dentiste' },
  { label: '🚑 Urgences', value: 'urgences' },
  { label: '📋 Autre', value: 'autre' },
];

const ENFANT_OPTIONS = ['Maxence', 'Enfant2'];

interface RDVEditorProps {
  rdv?: RDV; // if provided, we're editing
  onSave: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function RDVEditor({ rdv, onSave, onDelete, onClose }: RDVEditorProps) {
  const { primary, tint, colors } = useThemeColors();
  const isEditing = !!rdv;

  // Display in DD/MM/YYYY, store internally as YYYY-MM-DD
  const [dateRdv, setDateRdv] = useState(
    rdv?.date_rdv ? formatDateForDisplay(rdv.date_rdv) : ''
  );
  const [heure, setHeure] = useState(rdv?.heure ?? '');
  const [typeRdv, setTypeRdv] = useState(rdv?.type_rdv ?? 'pédiatre');
  const [enfant, setEnfant] = useState(rdv?.enfant ?? 'Maxence');
  const [médecin, setMédecin] = useState(rdv?.médecin ?? '');
  const [lieu, setLieu] = useState(rdv?.lieu ?? '');
  const [questions, setQuestions] = useState<string[]>(rdv?.questions ?? []);
  const [reponses, setReponses] = useState(rdv?.reponses ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const addQuestion = () => setQuestions((prev) => [...prev, '']);

  const updateQuestion = (index: number, text: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? text : q)));
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!dateRdv) {
      Alert.alert('Champ requis', 'La date est obligatoire.');
      return;
    }
    // Parse DD/MM/YYYY (or YYYY-MM-DD) to YYYY-MM-DD
    const parsedDate = parseDateInput(dateRdv);
    if (!parsedDate) {
      Alert.alert('Format invalide', 'La date doit être au format JJ/MM/AAAA (ex: 06/03/2026).');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        date_rdv: parsedDate,
        heure,
        type_rdv: typeRdv,
        enfant,
        médecin,
        lieu,
        statut: rdv?.statut ?? 'planifié',
        questions: questions.filter((q) => q.trim().length > 0),
        reponses: reponses.trim() || undefined,
      });
      onClose();
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert(
      '🗑️ Supprimer le RDV',
      'Êtes-vous sûr de vouloir supprimer ce rendez-vous ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const inputStyle = [styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }];
  const chipStyle = [styles.chip, { backgroundColor: colors.cardAlt }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]}>
      {/* Drag handle — indicates swipe-down-to-dismiss */}
      <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.headerClose, { color: colors.textFaint }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isEditing ? 'Modifier le RDV' : 'Nouveau RDV'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          <Text style={[styles.headerSave, { color: primary }]}>
            {isSaving ? '...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Date */}
        <Text style={[styles.label, { color: colors.textSub }]}>📅 Date *</Text>
        <TextInput
          style={inputStyle}
          value={dateRdv}
          onChangeText={setDateRdv}
          placeholder="06/03/2026"
          placeholderTextColor={colors.textFaint}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        />

        {/* Heure */}
        <Text style={[styles.label, { color: colors.textSub }]}>🕐 Heure</Text>
        <TextInput
          style={inputStyle}
          value={heure}
          onChangeText={setHeure}
          placeholder="14:30"
          placeholderTextColor={colors.textFaint}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        />

        {/* Type */}
        <Text style={[styles.label, { color: colors.textSub }]}>Type de RDV</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                chipStyle,
                typeRdv === opt.value && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setTypeRdv(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textMuted },
                typeRdv === opt.value && { color: primary, fontWeight: '700' },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Enfant */}
        <Text style={[styles.label, { color: colors.textSub }]}>👶 Enfant</Text>
        <View style={styles.chipRow}>
          {ENFANT_OPTIONS.map((name) => (
            <TouchableOpacity
              key={name}
              style={[
                chipStyle,
                enfant === name && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setEnfant(name)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textMuted },
                enfant === name && { color: primary, fontWeight: '700' },
              ]}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Médecin */}
        <Text style={[styles.label, { color: colors.textSub }]}>👨‍⚕️ Médecin</Text>
        <TextInput
          style={inputStyle}
          value={médecin}
          onChangeText={setMédecin}
          placeholder="Dr. Martin"
          placeholderTextColor={colors.textFaint}
        />

        {/* Lieu */}
        <Text style={[styles.label, { color: colors.textSub }]}>📍 Lieu</Text>
        <TextInput
          style={inputStyle}
          value={lieu}
          onChangeText={setLieu}
          placeholder="Cabinet pédiatrie, 12 rue..."
          placeholderTextColor={colors.textFaint}
          multiline
        />

        {/* Questions à poser */}
        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>❓ Questions à poser au médecin</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          Notez vos questions avant le rendez-vous pour ne rien oublier.
        </Text>

        {questions.map((q, index) => (
          <View key={index} style={styles.questionRow}>
            <TextInput
              style={[inputStyle, styles.questionInput]}
              value={q}
              onChangeText={(text) => updateQuestion(index, text)}
              placeholder={`Question ${index + 1}…`}
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <TouchableOpacity
              style={styles.questionRemoveBtn}
              onPress={() => removeQuestion(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.questionRemoveBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addQuestionBtn, { borderColor: primary }]}
          onPress={addQuestion}
          activeOpacity={0.7}
        >
          <Text style={[styles.addQuestionBtnText, { color: primary }]}>+ Ajouter une question</Text>
        </TouchableOpacity>

        {/* Réponses / Notes post-consultation */}
        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>💬 Réponses du médecin</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          Notez les réponses et recommandations du médecin après la consultation.
        </Text>
        <TextInput
          style={[inputStyle, styles.reponsesInput]}
          value={reponses}
          onChangeText={setReponses}
          placeholder="Réponses, prescriptions, prochaine étape…"
          placeholderTextColor={colors.textFaint}
          multiline
          textAlignVertical="top"
        />

        {/* Delete button (edit mode only) */}
        {isEditing && onDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️ Supprimer ce RDV</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerClose: { fontSize: 20, padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSave: { fontSize: 15, fontWeight: '700', padding: 4 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  sectionDivider: {
    height: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  questionInput: {
    flex: 1,
  },
  questionRemoveBtn: {
    marginTop: 14,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionRemoveBtnText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '700',
  },
  addQuestionBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addQuestionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reponsesInput: {
    minHeight: 110,
    paddingTop: 14,
  },
});
