/**
 * RDVEditor.tsx — Modal form for creating/editing RDV (medical appointments)
 *
 * UX :
 *  1. Sélecteur de personne en HAUT (toute la famille — adulte/ado/enfant)
 *  2. Liste des types adaptée selon le rôle (adulte vs enfant/ado)
 *  3. Icônes Lucide (plus d'emojis dans les chips de type)
 *  4. Rappels personnalisés multi-select (1 sem / 3 j / veille / 3 h / 1 h / 30 min)
 */

import { useState, useRef, useMemo, useEffect } from 'react';
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
import {
  Stethoscope,
  Syringe,
  Building2,
  Smile,
  Ambulance,
  Eye,
  MessageCircle,
  HeartPulse,
  Baby,
  Activity,
  GraduationCap,
  Trophy,
  Landmark,
  Users as UsersIcon,
  ClipboardList,
  Briefcase,
  Scissors,
  Bell,
  type LucideIcon,
} from 'lucide-react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useAI } from '../contexts/AIContext';
import { useVault } from '../contexts/VaultContext';
import { Chip } from './ui/Chip';
import { ModalHeader } from './ui/ModalHeader';
import { DictaphoneRecorder } from './DictaphoneRecorder';
import { RDV, Profile } from '../lib/types';
import { generateRDVBriefing } from '../lib/ai-service';
import type { VaultContext as AIVaultContext } from '../lib/ai-service';
import { DateInput } from './ui/DateInput';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';

type PersonRole = 'enfant' | 'adulte';

interface TypeOption {
  key: string;        // i18n key suffix
  value: string;      // valeur stockée dans rdv.type_rdv
  icon: LucideIcon;
  category: 'medical' | 'life';
  /** Disponible pour ce rôle (par défaut: enfant). 'all' = les deux. */
  scope: 'enfant' | 'adulte' | 'all';
}

const TYPE_OPTIONS: TypeOption[] = [
  // ─── Enfant — médical
  { key: 'pediatrician', value: 'pédiatre', icon: Stethoscope, category: 'medical', scope: 'enfant' },
  { key: 'vaccine', value: 'vaccin', icon: Syringe, category: 'medical', scope: 'all' },
  { key: 'pmi', value: 'pmi', icon: Building2, category: 'medical', scope: 'enfant' },
  { key: 'dentist', value: 'dentiste', icon: Smile, category: 'medical', scope: 'all' },
  { key: 'ophthalmo', value: 'ophtalmo', icon: Eye, category: 'medical', scope: 'all' },
  { key: 'speech', value: 'orthophoniste', icon: MessageCircle, category: 'medical', scope: 'enfant' },
  { key: 'emergency', value: 'urgences', icon: Ambulance, category: 'medical', scope: 'all' },
  // ─── Adulte — médical
  { key: 'gp', value: 'médecin', icon: Stethoscope, category: 'medical', scope: 'adulte' },
  { key: 'gyneco', value: 'gynéco', icon: HeartPulse, category: 'medical', scope: 'adulte' },
  { key: 'midwife', value: 'sage-femme', icon: Baby, category: 'medical', scope: 'adulte' },
  { key: 'physio', value: 'kiné', icon: Activity, category: 'medical', scope: 'adulte' },
  { key: 'specialist', value: 'spécialiste', icon: Stethoscope, category: 'medical', scope: 'adulte' },
  // ─── Vie courante — partagés
  { key: 'school', value: 'école', icon: GraduationCap, category: 'life', scope: 'enfant' },
  { key: 'activity', value: 'activité', icon: Trophy, category: 'life', scope: 'enfant' },
  { key: 'work', value: 'travail', icon: Briefcase, category: 'life', scope: 'adulte' },
  { key: 'hairdresser', value: 'coiffeur', icon: Scissors, category: 'life', scope: 'adulte' },
  { key: 'admin', value: 'administratif', icon: Landmark, category: 'life', scope: 'all' },
  { key: 'social', value: 'social', icon: UsersIcon, category: 'life', scope: 'all' },
  { key: 'other', value: 'autre', icon: ClipboardList, category: 'life', scope: 'all' },
];

const MEDICAL_VALUES = new Set(TYPE_OPTIONS.filter((t) => t.category === 'medical').map((t) => t.value));

/** Rappels disponibles — clés alignées avec lib/scheduled-notifications.ts (RDV_RAPPEL_OFFSETS). */
const RAPPEL_OPTIONS: { key: string; labelKey: string }[] = [
  { key: '1w', labelKey: 'editors.rdv.rappels.options.1w' },
  { key: '3d', labelKey: 'editors.rdv.rappels.options.3d' },
  { key: '1d', labelKey: 'editors.rdv.rappels.options.1d' },
  { key: '3h', labelKey: 'editors.rdv.rappels.options.3h' },
  { key: '1h', labelKey: 'editors.rdv.rappels.options.1h' },
  { key: '30m', labelKey: 'editors.rdv.rappels.options.30m' },
];

function getContactLabelKey(type: string): string {
  if (MEDICAL_VALUES.has(type)) return 'editors.rdv.doctorLabel';
  if (type === 'école') return 'editors.rdv.teacherLabel';
  if (type === 'activité') return 'editors.rdv.coachLabel';
  return 'editors.rdv.contactLabel';
}

function getContactPlaceholderKey(type: string): string {
  if (MEDICAL_VALUES.has(type)) return 'editors.rdv.doctorPlaceholder';
  if (type === 'école') return 'editors.rdv.teacherPlaceholder';
  if (type === 'activité') return 'editors.rdv.coachPlaceholder';
  return 'editors.rdv.contactPlaceholder';
}

function getQuestionsLabelKey(type: string): string {
  if (MEDICAL_VALUES.has(type)) return 'editors.rdv.questionsLabel';
  if (type === 'administratif') return 'editors.rdv.questionsLabelAdmin';
  return 'editors.rdv.questionsLabelGeneric';
}

function getQuestionsHintKey(type: string): string {
  if (MEDICAL_VALUES.has(type)) return 'editors.rdv.questionsHint';
  if (type === 'administratif') return 'editors.rdv.questionsHintAdmin';
  return 'editors.rdv.questionsHintGeneric';
}

function canPrepareWithAI(type: string): boolean {
  return type !== 'social';
}

function roleOf(profile: Profile | undefined): PersonRole {
  return profile?.role === 'adulte' ? 'adulte' : 'enfant';
}

function defaultTypeForRole(role: PersonRole): string {
  return role === 'adulte' ? 'médecin' : 'pédiatre';
}

interface RDVEditorProps {
  rdv?: RDV;
  /** Tous les profils famille (enfant, ado, adulte) pour le sélecteur "Pour qui". */
  profiles?: Profile[];
  initialDate?: string;
  onSave: (rdv: Omit<RDV, 'sourceFile' | 'title'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function RDVEditor({ rdv, profiles, initialDate, onSave, onDelete, onClose }: RDVEditorProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const { config: aiConfig, isConfigured: aiConfigured } = useAI();
  const vault = useVault();
  const isEditing = !!rdv;

  // Toute la famille (enfant + ado + adulte). Défaut : profil correspondant au rdv ou premier disponible.
  const familyProfiles = useMemo(
    () => (profiles ?? []).filter((p) => p.role === 'enfant' || p.role === 'ado' || p.role === 'adulte'),
    [profiles]
  );

  const initialPerson = useMemo(() => {
    if (rdv?.enfant) {
      const found = familyProfiles.find((p) => p.name === rdv.enfant);
      if (found) return found;
    }
    return familyProfiles[0];
  }, [rdv?.enfant, familyProfiles]);

  const [enfant, setEnfant] = useState<string>(rdv?.enfant ?? initialPerson?.name ?? '');
  const selectedProfile = familyProfiles.find((p) => p.name === enfant) ?? initialPerson;
  const role: PersonRole = roleOf(selectedProfile);

  const [dateRdv, setDateRdv] = useState(rdv?.date_rdv ?? initialDate ?? '');
  const [heure, setHeure] = useState(rdv?.heure ?? '');
  const [typeRdv, setTypeRdv] = useState(rdv?.type_rdv ?? defaultTypeForRole(role));
  const [médecin, setMédecin] = useState(rdv?.médecin ?? '');
  const [lieu, setLieu] = useState(rdv?.lieu ?? '');
  const [questions, setQuestions] = useState<string[]>(rdv?.questions ?? []);
  const [reponses, setReponses] = useState(rdv?.reponses ?? '');
  const [rappels, setRappels] = useState<string[]>(rdv?.rappels ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [dictaphoneVisible, setDictaphoneVisible] = useState(false);
  const dictaphoneResultRef = useRef<string>('');
  const [isBriefing, setIsBriefing] = useState(false);

  // Quand on change de personne, si le type courant n'existe pas pour ce rôle → reset au type par défaut.
  useEffect(() => {
    const known = TYPE_OPTIONS.find((opt) => opt.value === typeRdv);
    if (!known) return; // type libre saisi à la main : on laisse
    const visible = known.scope === 'all' || known.scope === role;
    if (!visible) setTypeRdv(defaultTypeForRole(role));
  }, [role, typeRdv]);

  const visibleTypes = useMemo(
    () => TYPE_OPTIONS.filter((opt) => opt.scope === 'all' || opt.scope === role),
    [role]
  );
  const medicalTypes = visibleTypes.filter((t) => t.category === 'medical');
  const lifeTypes = visibleTypes.filter((t) => t.category === 'life');

  const toggleRappel = (key: string) => {
    setRappels((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

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
        const lines = resp.text.split('\n').filter((l) => /^\d+[.)]\s/.test(l.trim()));
        const newQuestions = lines.map((l) => l.replace(/^\d+[.)]\s*/, '').trim());
        if (newQuestions.length > 0) {
          setQuestions((prev) => [...prev, ...newQuestions]);
          showToast(t('editors.rdv.toast.questionsSuggested', { count: newQuestions.length }), 'success');
        } else {
          setQuestions((prev) => [...prev, resp.text.trim()]);
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
        rappels: rappels.length > 0 ? rappels : undefined,
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
  const iconColor = (selected: boolean) => (selected ? colors.brand.parchment : colors.textMuted);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]}>
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
          {/* ─── Pour qui (déplacé en haut) ─── */}
          <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.personLabel')}</Text>
          <View style={styles.chipRow}>
            {familyProfiles.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                emoji={p.avatar || undefined}
                selected={enfant === p.name}
                onPress={() => setEnfant(p.name)}
              />
            ))}
          </View>

          {/* Date */}
          <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.dateLabel')}</Text>
          <DateInput value={dateRdv} onChange={setDateRdv} placeholder={t('editors.rdv.datePlaceholder')} />

          {/* Heure */}
          <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.timeLabel')}</Text>
          <DateInput value={heure} onChange={setHeure} mode="time" placeholder={t('editors.rdv.timePlaceholder')} />

          {/* Type — adapté au rôle */}
          <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.rdv.typeLabel')}</Text>
          {medicalTypes.length > 0 && (
            <>
              <Text style={[styles.typeCategoryLabel, { color: colors.textMuted }]}>{t('editors.rdv.typeCategoryMedical')}</Text>
              <View style={styles.chipRow}>
                {medicalTypes.map((opt) => {
                  const Icon = opt.icon;
                  const isSel = typeRdv === opt.value;
                  return (
                    <Chip
                      key={opt.value}
                      label={t(`editors.rdv.typeOptions.${opt.key}`)}
                      icon={<Icon size={14} color={iconColor(isSel)} strokeWidth={2.2} />}
                      selected={isSel}
                      onPress={() => setTypeRdv(opt.value)}
                    />
                  );
                })}
              </View>
            </>
          )}
          {lifeTypes.length > 0 && (
            <>
              <Text style={[styles.typeCategoryLabel, { color: colors.textMuted }]}>{t('editors.rdv.typeCategoryLife')}</Text>
              <View style={styles.chipRow}>
                {lifeTypes.map((opt) => {
                  const Icon = opt.icon;
                  const isSel = typeRdv === opt.value;
                  return (
                    <Chip
                      key={opt.value}
                      label={t(`editors.rdv.typeOptions.${opt.key}`)}
                      icon={<Icon size={14} color={iconColor(isSel)} strokeWidth={2.2} />}
                      selected={isSel}
                      onPress={() => setTypeRdv(opt.value)}
                    />
                  );
                })}
              </View>
            </>
          )}
          <TextInput
            style={inputStyle}
            value={visibleTypes.some((opt) => opt.value === typeRdv) ? '' : typeRdv}
            onChangeText={setTypeRdv}
            placeholder={t('editors.rdv.typeCustomPlaceholder')}
            placeholderTextColor={colors.textFaint}
          />

          {/* Contact */}
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

          {/* ─── Rappels personnalisés ─── */}
          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
          <View style={styles.sectionTitleRow}>
            <Bell size={16} color={colors.textSub} strokeWidth={2.2} />
            <Text style={[styles.sectionLabel, { color: colors.textSub }]}>{t('editors.rdv.rappels.label')}</Text>
          </View>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{t('editors.rdv.rappels.hint')}</Text>
          <View style={styles.chipRow}>
            {RAPPEL_OPTIONS.map((opt) => (
              <Chip
                key={opt.key}
                label={t(opt.labelKey)}
                selected={rappels.includes(opt.key)}
                onPress={() => toggleRappel(opt.key)}
                size="sm"
              />
            ))}
          </View>

          {/* Questions à poser */}
          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>{t(getQuestionsLabelKey(typeRdv))}</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{t(getQuestionsHintKey(typeRdv))}</Text>

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

          <TouchableOpacity style={[styles.addQuestionBtn, { borderColor: primary }]} onPress={addQuestion} activeOpacity={0.7}>
            <Text style={[styles.addQuestionBtnText, { color: primary }]}>{t('editors.rdv.addQuestion')}</Text>
          </TouchableOpacity>

          {/* Réponses / Notes post-consultation */}
          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
          <View style={styles.reponsesTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionLabel, { color: colors.textSub }]}>{t('editors.rdv.answersLabel')}</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{t('editors.rdv.answersHint')}</Text>
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

          {isEditing && onDelete && (
            <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.errorBg, borderColor: colors.error + '40' }]} onPress={handleDelete}>
              <Text style={[styles.deleteBtnText, { color: colors.error }]}>{t('editors.rdv.deleteBtn')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <Modal
          visible={dictaphoneVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            const pending = dictaphoneResultRef.current;
            if (pending) {
              setReponses((prev) => (prev.trim() ? `${prev}\n\n${pending}` : pending));
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
              setReponses((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
