/**
 * RDVEditor.tsx — Modal form for creating/editing RDV (medical appointments)
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useAI } from '../contexts/AIContext';
import { useVault } from '../contexts/VaultContext';
import { Chip } from './ui/Chip';
import { ModalHeader } from './ui/ModalHeader';
import { DictaphoneRecorder } from './DictaphoneRecorder';
import { RDV, Profile } from '../lib/types';
import { parseDateInput } from '../lib/parser';
import { generateRDVBriefing } from '../lib/ai-service';
import type { VaultContext as AIVaultContext } from '../lib/ai-service';
import { DateInput } from './ui/DateInput';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';

const TYPE_KEYS: { key: string; value: string; category: 'medical' | 'life' }[] = [
  // Médical
  { key: 'pediatrician', value: 'pédiatre', category: 'medical' },
  { key: 'vaccine', value: 'vaccin', category: 'medical' },
  { key: 'pmi', value: 'pmi', category: 'medical' },
  { key: 'dentist', value: 'dentiste', category: 'medical' },
  { key: 'emergency', value: 'urgences', category: 'medical' },
  // Vie courante
  { key: 'school', value: 'école', category: 'life' },
  { key: 'activity', value: 'activité', category: 'life' },
  { key: 'admin', value: 'administratif', category: 'life' },
  { key: 'social', value: 'social', category: 'life' },
  { key: 'other', value: 'autre', category: 'life' },
];

const MEDICAL_TYPES = new Set(TYPE_KEYS.filter(t => t.category === 'medical').map(t => t.value));

/** Label adaptatif pour le champ "contact" selon le type de RDV */
function getContactLabelKey(type: string): string {
  if (MEDICAL_TYPES.has(type)) return 'editors.rdv.doctorLabel';
  if (type === 'école') return 'editors.rdv.teacherLabel';
  if (type === 'activité') return 'editors.rdv.coachLabel';
  return 'editors.rdv.contactLabel';
}

function getContactPlaceholderKey(type: string): string {
  if (MEDICAL_TYPES.has(type)) return 'editors.rdv.doctorPlaceholder';
  if (type === 'école') return 'editors.rdv.teacherPlaceholder';
  if (type === 'activité') return 'editors.rdv.coachPlaceholder';
  return 'editors.rdv.contactPlaceholder';
}

function getQuestionsLabelKey(type: string): string {
  if (MEDICAL_TYPES.has(type)) return 'editors.rdv.questionsLabel';
  if (type === 'administratif') return 'editors.rdv.questionsLabelAdmin';
  return 'editors.rdv.questionsLabelGeneric';
}

function getQuestionsHintKey(type: string): string {
  if (MEDICAL_TYPES.has(type)) return 'editors.rdv.questionsHint';
  if (type === 'administratif') return 'editors.rdv.questionsHintAdmin';
  return 'editors.rdv.questionsHintGeneric';
}

/** L'IA peut preparer des questions pour ces types */
function canPrepareWithAI(type: string): boolean {
  return type !== 'social';
}

interface RDVEditorProps {
  rdv?: RDV; // if provided, we're editing
  /** Profils enfants pour le sélecteur d'enfant */
  profiles?: Profile[];
  onSave: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function RDVEditor({ rdv, profiles, onSave, onDelete, onClose }: RDVEditorProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const { config: aiConfig, isConfigured: aiConfigured } = useAI();
  const vault = useVault();
  const isEditing = !!rdv;

  // Noms d'enfants dynamiques depuis les profils
  const enfantOptions = (profiles ?? [])
    .filter((p) => p.role === 'enfant' || p.role === 'ado')
    .map((p) => p.name);
  const defaultEnfant = rdv?.enfant ?? enfantOptions[0] ?? '';

  // Stocké en ISO (YYYY-MM-DD), affiché via DateInput natif
  const [dateRdv, setDateRdv] = useState(rdv?.date_rdv ?? '');
  const [heure, setHeure] = useState(rdv?.heure ?? '');
  const [typeRdv, setTypeRdv] = useState(rdv?.type_rdv ?? 'pédiatre');
  const [enfant, setEnfant] = useState(defaultEnfant);
  const [médecin, setMédecin] = useState(rdv?.médecin ?? '');
  const [lieu, setLieu] = useState(rdv?.lieu ?? '');
  const [questions, setQuestions] = useState<string[]>(rdv?.questions ?? []);
  const [reponses, setReponses] = useState(rdv?.reponses ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [dictaphoneVisible, setDictaphoneVisible] = useState(false);
  const dictaphoneResultRef = useRef<string>('');
  const [isBriefing, setIsBriefing] = useState(false);

  const handleBriefing = async () => {
    if (!aiConfig || !enfant) return;
    setIsBriefing(true);
    try {
      const vaultCtx: AIVaultContext = {
        tasks: vault.tasks,
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
        healthRecords: vault.healthRecords,
      };
      const resp = await generateRDVBriefing(aiConfig, { type_rdv: typeRdv, enfant, médecin, date_rdv: dateRdv }, vaultCtx);
      if (resp.error) {
        showToast(resp.error, 'error');
      } else {
        // Parser les questions générées (lignes numérotées)
        const lines = resp.text.split('\n').filter(l => /^\d+[.)]\s/.test(l.trim()));
        const newQuestions = lines.map(l => l.replace(/^\d+[.)]\s*/, '').trim());
        if (newQuestions.length > 0) {
          setQuestions(prev => [...prev, ...newQuestions]);
          showToast(t('editors.rdv.toast.questionsSuggested', { count: newQuestions.length }), 'success');
        } else {
          // Si pas de format numéroté, ajouter le texte brut comme une question
          setQuestions(prev => [...prev, resp.text.trim()]);
          showToast(t('editors.rdv.toast.briefingGenerated'), 'success');
        }
      }
    } catch {
      showToast(t('editors.rdv.toast.briefingError'), 'error');
    } finally {
      setIsBriefing(false);
    }
  };

  const addQuestion = () => setQuestions((prev) => [...prev, '']);

  const updateQuestion = (index: number, text: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? text : q)));
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!dateRdv) {
      showToast(t('editors.rdv.toast.dateRequired'), 'error');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        date_rdv: dateRdv,
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
      showToast(String(e), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert(
      t('editors.rdv.deleteConfirmTitle'),
      t('editors.rdv.deleteConfirmMsg'),
      [
        { text: t('editors.cancel'), style: 'cancel' },
        { text: t('editors.delete'), style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const inputStyle = [styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }];
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]}>
      {/* Drag handle — indicates swipe-down-to-dismiss */}
      <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
      <ModalHeader
        title={isEditing ? t('editors.rdv.titleEdit') : t('editors.rdv.titleNew')}
        onClose={onClose}
        rightLabel={isSaving ? '…' : t('editors.save')}
        onRight={handleSave}
        rightDisabled={isSaving}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Date */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.dateLabel')}</Text>
        <DateInput value={dateRdv} onChange={setDateRdv} placeholder={t('editors.rdv.datePlaceholder')} />

        {/* Heure */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.timeLabel')}</Text>
        <DateInput value={heure} onChange={setHeure} mode="time" placeholder={t('editors.rdv.timePlaceholder')} />

        {/* Type */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.typeLabel')}</Text>
        <Text style={[styles.typeCategoryLabel, { color: colors.textMuted }]}>{t('editors.rdv.typeCategoryMedical')}</Text>
        <View style={styles.chipRow}>
          {TYPE_KEYS.filter(tk => tk.category === 'medical').map((opt) => (
            <Chip
              key={opt.value}
              label={t(`editors.rdv.typeOptions.${opt.key}`)}
              selected={typeRdv === opt.value}
              onPress={() => setTypeRdv(opt.value)}
            />
          ))}
        </View>
        <Text style={[styles.typeCategoryLabel, { color: colors.textMuted }]}>{t('editors.rdv.typeCategoryLife')}</Text>
        <View style={styles.chipRow}>
          {TYPE_KEYS.filter(tk => tk.category === 'life').map((opt) => (
            <Chip
              key={opt.value}
              label={t(`editors.rdv.typeOptions.${opt.key}`)}
              selected={typeRdv === opt.value}
              onPress={() => setTypeRdv(opt.value)}
            />
          ))}
        </View>

        {/* Enfant */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.childLabel')}</Text>
        <View style={styles.chipRow}>
          {enfantOptions.map((name) => (
            <Chip
              key={name}
              label={name}
              selected={enfant === name}
              onPress={() => setEnfant(name)}
            />
          ))}
        </View>

        {/* Contact (médecin / enseignant / responsable / contact) */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t(getContactLabelKey(typeRdv))}</Text>
        <TextInput
          style={inputStyle}
          value={médecin}
          onChangeText={setMédecin}
          placeholder={t(getContactPlaceholderKey(typeRdv))}
          placeholderTextColor={colors.textFaint}
        />

        {/* Lieu */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.locationLabel')}</Text>
        <TextInput
          style={inputStyle}
          value={lieu}
          onChangeText={setLieu}
          placeholder={t('editors.rdv.locationPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
        />

        {/* Questions à poser */}
        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>{t(getQuestionsLabelKey(typeRdv))}</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {t(getQuestionsHintKey(typeRdv))}
        </Text>

        {aiConfigured && canPrepareWithAI(typeRdv) && (
          <TouchableOpacity
            style={[styles.briefingBtn, { backgroundColor: tint, borderColor: primary }]}
            onPress={handleBriefing}
            disabled={isBriefing}
            activeOpacity={0.7}
            accessibilityLabel={t('editors.rdv.prepareAIA11y')}
            accessibilityRole="button"
          >
            {isBriefing ? (
              <ActivityIndicator size="small" color={primary} />
            ) : (
              <>
                <Text style={styles.briefingBtnEmoji}>🤖</Text>
                <Text style={[styles.briefingBtnText, { color: primary }]}>{t('editors.rdv.prepareAI')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {questions.map((q, index) => (
          <View key={index} style={styles.questionRow}>
            <TextInput
              style={[inputStyle, styles.questionInput]}
              value={q}
              onChangeText={(text) => updateQuestion(index, text)}
              placeholder={t('editors.rdv.questionPlaceholder', { n: index + 1 })}
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <TouchableOpacity
              style={[styles.questionRemoveBtn, { backgroundColor: colors.errorBg }]}
              onPress={() => removeQuestion(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.questionRemoveBtnText, { color: colors.error }]}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addQuestionBtn, { borderColor: primary }]}
          onPress={addQuestion}
          activeOpacity={0.7}
        >
          <Text style={[styles.addQuestionBtnText, { color: primary }]}>{t('editors.rdv.addQuestion')}</Text>
        </TouchableOpacity>

        {/* Réponses / Notes post-consultation */}
        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
        <View style={styles.reponsesTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: colors.textSub }]}>{t('editors.rdv.answersLabel')}</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              {t('editors.rdv.answersHint')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.dictaphoneBtn, { backgroundColor: tint, borderColor: primary }]}
            onPress={() => setDictaphoneVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel={t('editors.rdv.dictateA11y')}
            accessibilityRole="button"
          >
            <Text style={styles.dictaphoneBtnEmoji}>🎙️</Text>
            <Text style={[styles.dictaphoneBtnText, { color: primary }]}>{t('editors.rdv.dictateBtn')}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[inputStyle, styles.reponsesInput]}
          value={reponses}
          onChangeText={setReponses}
          placeholder={t('editors.rdv.answersPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
          textAlignVertical="top"
        />

        {/* Delete button (edit mode only) */}
        {isEditing && onDelete && (
          <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.errorBg, borderColor: colors.error + '40' }]} onPress={handleDelete}>
            <Text style={[styles.deleteBtnText, { color: colors.error }]}>{t('editors.rdv.deleteBtn')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Dictaphone Modal */}
      <Modal
        visible={dictaphoneVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          // Drag-to-dismiss : sauvegarder le texte transcrit s'il existe
          const pending = dictaphoneResultRef.current;
          if (pending) {
            setReponses((prev) => prev.trim() ? `${prev}\n\n${pending}` : pending);
            dictaphoneResultRef.current = '';
          }
          setDictaphoneVisible(false);
        }}
      >
        <DictaphoneRecorder
          rdv={{
            title: '',
            sourceFile: rdv?.sourceFile ?? '',
            date_rdv: dateRdv,
            heure,
            type_rdv: typeRdv,
            enfant,
            médecin,
            lieu,
            statut: rdv?.statut ?? 'planifié',
            questions,
            reponses,
          }}
          onResult={(text) => {
            dictaphoneResultRef.current = text;
            setReponses((prev) => prev.trim() ? `${prev}\n\n${text}` : text);
          }}
          onClose={() => {
            dictaphoneResultRef.current = '';
            setDictaphoneVisible(false);
          }}
        />
      </Modal>
      </KeyboardAvoidingView>
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
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  scroll: { flex: 1 },
  content: { padding: Spacing['3xl'], gap: Spacing['2xl'], paddingBottom: 40 },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: 14,
    fontSize: FontSize.body,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  typeCategoryLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xs,
  },
  deleteBtn: {
    padding: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  deleteBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  sectionDivider: {
    height: 1,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  sectionHint: {
    fontSize: FontSize.label,
    lineHeight: 18,
    marginTop: Spacing.xxs,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  questionInput: {
    flex: 1,
  },
  questionRemoveBtn: {
    marginTop: 14,
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionRemoveBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  addQuestionBtn: {
    paddingVertical: 13,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addQuestionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  reponsesInput: {
    minHeight: 110,
    paddingTop: 14,
  },
  reponsesTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  briefingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  briefingBtnEmoji: {
    fontSize: FontSize.sm,
  },
  briefingBtnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  dictaphoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  dictaphoneBtnEmoji: {
    fontSize: FontSize.sm,
  },
  dictaphoneBtnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
});
