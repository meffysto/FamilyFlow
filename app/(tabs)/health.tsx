/**
 * health.tsx — Suivi médical & croissance
 *
 * Onglets : Croissance, Vaccins, Infos médicales
 * Un carnet de santé par enfant, stocké dans le vault.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { ModalHeader, DateInput } from '../../components/ui';
import { HealthRecord, GrowthEntry, VaccineEntry } from '../../lib/types';
import { formatDateLocalized } from '../../lib/date-locale';
import { GrowthChart } from '../../components/growth/GrowthChart';
import { GrowthLegend } from '../../components/growth/GrowthLegend';
import { EmptyState } from '../../components/EmptyState';

type TabId = 'croissance' | 'vaccins' | 'infos';

const TAB_IDS: { id: TabId; emoji: string; labelKey: string }[] = [
  { id: 'croissance', emoji: '📏', labelKey: 'health.tabs.growth' },
  { id: 'vaccins', emoji: '💉', labelKey: 'health.tabs.vaccines' },
  { id: 'infos', emoji: '📋', labelKey: 'health.tabs.info' },
];

const formatDateDisplay = formatDateLocalized;

// ─── Formulaire mesure croissance ─────────────────────────────────────────────

function GrowthForm({ onSave, onClose, onDelete, initialEntry }: {
  onSave: (entry: GrowthEntry) => void;
  onClose: () => void;
  onDelete?: () => void;
  initialEntry?: GrowthEntry;
}) {
  const { colors, primary } = useThemeColors();
  const { t } = useTranslation();
  const isEditing = !!initialEntry;
  const [date, setDate] = useState(initialEntry?.date || new Date().toISOString().slice(0, 10));
  const [poids, setPoids] = useState(initialEntry?.poids != null ? String(initialEntry.poids) : '');
  const [taille, setTaille] = useState(initialEntry?.taille != null ? String(initialEntry.taille) : '');
  const [perimetre, setPerimetre] = useState(initialEntry?.perimetre != null ? String(initialEntry.perimetre) : '');
  const [note, setNote] = useState(initialEntry?.note || '');

  const canSave = date && (poids || taille);

  const handleSave = () => {
    onSave({
      date,
      poids: poids ? parseFloat(poids.replace(',', '.')) : undefined,
      taille: taille ? parseFloat(taille.replace(',', '.')) : undefined,
      perimetre: perimetre ? parseFloat(perimetre.replace(',', '.')) : undefined,
      note: note || undefined,
    });
  };

  return (
    <View style={[formStyles.container, { backgroundColor: colors.bg }]}>
      <ModalHeader title={isEditing ? t('health.growthForm.editTitle') : t('health.growthForm.newTitle')} onClose={onClose} rightLabel={t('health.growthForm.save')} onRight={handleSave} rightDisabled={!canSave} />
      <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.growthForm.date')}</Text>
        <DateInput value={date} onChange={setDate} />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.growthForm.weight')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={poids}
          onChangeText={setPoids}
          placeholder={t('health.growthForm.weightPlaceholder')}
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
        />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.growthForm.height')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={taille}
          onChangeText={setTaille}
          placeholder={t('health.growthForm.heightPlaceholder')}
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
        />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.growthForm.headCircumference')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={perimetre}
          onChangeText={setPerimetre}
          placeholder={t('health.growthForm.headPlaceholder')}
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
        />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.growthForm.notes')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('health.growthForm.notesPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        {isEditing && onDelete && (
          <TouchableOpacity
            style={[formStyles.deleteBtn, { backgroundColor: colors.errorBg }]}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Text style={[formStyles.deleteBtnText, { color: colors.error }]}>{t('health.growthForm.deleteBtn')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Formulaire vaccin ────────────────────────────────────────────────────────

const COMMON_VACCINES = [
  'DTP (Diphtérie-Tétanos-Polio)',
  'Coqueluche',
  'Haemophilus influenzae b',
  'Hépatite B',
  'Pneumocoque',
  'Méningocoque C',
  'ROR (Rougeole-Oreillons-Rubéole)',
  'BCG',
  'Varicelle',
  'Grippe',
  'HPV',
];

function VaccineForm({ onSave, onClose }: { onSave: (entry: VaccineEntry) => void; onClose: () => void }) {
  const { colors, primary } = useThemeColors();
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dose, setDose] = useState('');
  const [note, setNote] = useState('');

  const canSave = nom && date;

  const handleSave = () => {
    onSave({
      nom,
      date,
      dose: dose || undefined,
      note: note || undefined,
    });
  };

  return (
    <View style={[formStyles.container, { backgroundColor: colors.bg }]}>
      <ModalHeader title={t('health.vaccineForm.title')} onClose={onClose} rightLabel={t('health.vaccineForm.save')} onRight={handleSave} rightDisabled={!canSave} />
      <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.vaccineForm.vaccine')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={nom}
          onChangeText={setNom}
          placeholder={t('health.vaccineForm.vaccinePlaceholder')}
          placeholderTextColor={colors.textFaint}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={formStyles.chips}>
          {COMMON_VACCINES.map(v => (
            <TouchableOpacity
              key={v}
              style={[formStyles.chip, { backgroundColor: nom === v ? primary + '20' : colors.cardAlt, borderColor: nom === v ? primary : 'transparent' }]}
              onPress={() => setNom(v)}
            >
              <Text style={[formStyles.chipText, { color: nom === v ? primary : colors.textSub }]} numberOfLines={1}>
                {v.length > 20 ? v.slice(0, 20) + '…' : v}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.vaccineForm.date')}</Text>
        <DateInput value={date} onChange={setDate} />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.vaccineForm.dose')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={dose}
          onChangeText={setDose}
          placeholder={t('health.vaccineForm.dosePlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.vaccineForm.notes')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('health.vaccineForm.notesPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />
      </ScrollView>
    </View>
  );
}

// ─── Formulaire info médicale ─────────────────────────────────────────────────

function InfoEditor({
  record,
  onSave,
  onClose,
}: {
  record: HealthRecord;
  onSave: (record: HealthRecord) => void;
  onClose: () => void;
}) {
  const { colors, primary } = useThemeColors();
  const { t } = useTranslation();
  const [groupeSanguin, setGroupeSanguin] = useState(record.groupeSanguin || '');
  const [contactMedecin, setContactMedecin] = useState(record.contactMedecin || '');
  const [contactPediatre, setContactPediatre] = useState(record.contactPediatre || '');
  const [contactUrgences, setContactUrgences] = useState(record.contactUrgences || '');
  const [allergies, setAllergies] = useState(record.allergies.join('\n'));
  const [antecedents, setAntecedents] = useState(record.antecedents.join('\n'));
  const [medicaments, setMedicaments] = useState(record.medicamentsEnCours.join('\n'));

  const handleSave = () => {
    onSave({
      ...record,
      groupeSanguin: groupeSanguin || undefined,
      contactMedecin: contactMedecin || undefined,
      contactPediatre: contactPediatre || undefined,
      contactUrgences: contactUrgences || undefined,
      allergies: allergies.split('\n').map(s => s.trim()).filter(Boolean),
      antecedents: antecedents.split('\n').map(s => s.trim()).filter(Boolean),
      medicamentsEnCours: medicaments.split('\n').map(s => s.trim()).filter(Boolean),
    });
  };

  return (
    <View style={[formStyles.container, { backgroundColor: colors.bg }]}>
      <ModalHeader title={`${t('health.infoEditor.titlePrefix')} — ${record.enfant}`} onClose={onClose} rightLabel={t('health.infoEditor.save')} onRight={handleSave} />
      <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.content}>
        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.infoEditor.bloodType')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={groupeSanguin}
          onChangeText={setGroupeSanguin}
          placeholder={t('health.infoEditor.bloodTypePlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.infoEditor.doctor')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={contactMedecin}
          onChangeText={setContactMedecin}
          placeholder={t('health.infoEditor.doctorPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.infoEditor.pediatrician')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={contactPediatre}
          onChangeText={setContactPediatre}
          placeholder={t('health.infoEditor.pediatricianPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        <Text style={[formStyles.label, { color: colors.textSub }]}>{t('health.infoEditor.emergency')}</Text>
        <TextInput
          style={[formStyles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={contactUrgences}
          onChangeText={setContactUrgences}
          placeholder={t('health.infoEditor.emergencyPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        <Text style={[formStyles.sectionLabel, { color: colors.text }]}>{`⚠️ ${t('health.infoEditor.allergiesSection')}`}</Text>
        <Text style={[formStyles.hint, { color: colors.textFaint }]}>{t('health.infoEditor.allergiesHint')}</Text>
        <TextInput
          style={[formStyles.inputMulti, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={allergies}
          onChangeText={setAllergies}
          placeholder={t('health.infoEditor.allergiesPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
          numberOfLines={3}
        />

        <Text style={[formStyles.sectionLabel, { color: colors.text }]}>{`🏥 ${t('health.infoEditor.historySection')}`}</Text>
        <Text style={[formStyles.hint, { color: colors.textFaint }]}>{t('health.infoEditor.historyHint')}</Text>
        <TextInput
          style={[formStyles.inputMulti, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={antecedents}
          onChangeText={setAntecedents}
          placeholder={t('health.infoEditor.historyPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
          numberOfLines={3}
        />

        <Text style={[formStyles.sectionLabel, { color: colors.text }]}>{`💊 ${t('health.infoEditor.medicationsSection')}`}</Text>
        <Text style={[formStyles.hint, { color: colors.textFaint }]}>{t('health.infoEditor.medicationsHint')}</Text>
        <TextInput
          style={[formStyles.inputMulti, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={medicaments}
          onChangeText={setMedicaments}
          placeholder={t('health.infoEditor.medicationsPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
          numberOfLines={3}
        />
      </ScrollView>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function HealthScreen() {
  const { profiles, healthRecords, saveHealthRecord, addGrowthEntry, updateGrowthEntry, deleteGrowthEntry, addVaccineEntry, refresh } = useVault();
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const enfants = useMemo(() => profiles.filter(p => p.role === 'enfant' || p.role === 'ado'), [profiles]);
  const [selectedEnfantId, setSelectedEnfantId] = useState<string>(enfants[0]?.id || '');
  const [activeTab, setActiveTab] = useState<TabId>('croissance');
  const { refreshing, onRefresh } = useRefresh(refresh);

  // Sync selectedEnfantId quand les profils chargent
  useEffect(() => {
    if (!selectedEnfantId && enfants.length > 0) setSelectedEnfantId(enfants[0].id);
  }, [enfants, selectedEnfantId]);
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [showVaccineForm, setShowVaccineForm] = useState(false);
  const [showInfoEditor, setShowInfoEditor] = useState(false);

  const selectedEnfant = enfants.find(e => e.id === selectedEnfantId);
  const record: HealthRecord = healthRecords.find(r => r.enfantId === selectedEnfantId) || {
    enfant: selectedEnfant?.name || '',
    enfantId: selectedEnfantId,
    allergies: [],
    antecedents: [],
    medicamentsEnCours: [],
    croissance: [],
    vaccins: [],
  };

  const handleAddGrowth = useCallback(async (entry: GrowthEntry) => {
    if (!selectedEnfant) return;
    try {
      await addGrowthEntry(selectedEnfant.name, entry);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('health.toast.measureSaved'), 'success');
      setShowGrowthForm(false);
    } catch {
      showToast(t('health.toast.error'), 'error');
    }
  }, [selectedEnfant, addGrowthEntry, showToast]);

  const handleAddVaccine = useCallback(async (entry: VaccineEntry) => {
    if (!selectedEnfant) return;
    try {
      await addVaccineEntry(selectedEnfant.name, entry);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('health.toast.vaccineSaved'), 'success');
      setShowVaccineForm(false);
    } catch {
      showToast(t('health.toast.error'), 'error');
    }
  }, [selectedEnfant, addVaccineEntry, showToast]);

  const handleSaveInfo = useCallback(async (updated: HealthRecord) => {
    try {
      await saveHealthRecord(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('health.toast.infoSaved'), 'success');
      setShowInfoEditor(false);
    } catch {
      showToast(t('health.toast.error'), 'error');
    }
  }, [saveHealthRecord, showToast]);

  // Édition / suppression mesure croissance
  const [editingEntry, setEditingEntry] = useState<GrowthEntry | null>(null);

  const handleUpdateGrowth = useCallback(async (oldDate: string, newEntry: GrowthEntry) => {
    if (!selectedEnfant) return;
    try {
      await updateGrowthEntry(selectedEnfant.name, oldDate, newEntry);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('health.toast.measureUpdated'), 'success');
      setEditingEntry(null);
    } catch {
      showToast(t('health.toast.error'), 'error');
    }
  }, [selectedEnfant, updateGrowthEntry, showToast]);

  const handleDeleteGrowth = useCallback(async (date: string) => {
    if (!selectedEnfant) return;
    Alert.alert(t('health.alert.deleteMeasureTitle'), t('health.alert.deleteMeasureMsg', { date: formatDateLocalized(date) }), [
      { text: t('health.alert.cancel'), style: 'cancel' },
      { text: t('health.alert.delete'), style: 'destructive', onPress: async () => {
        await deleteGrowthEntry(selectedEnfant.name, date);
        showToast(t('health.toast.measureDeleted'), 'success');
        setEditingEntry(null);
      }},
    ]);
  }, [selectedEnfant, deleteGrowthEntry, showToast]);

  if (enfants.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.bg }]}>
          <Text style={[styles.title, { color: colors.text }]}>{`🏥 ${t('health.screenTitle')}`}</Text>
        </View>
        <EmptyState
          emoji="🏥"
          title={t('health.empty.title')}
          subtitle={t('health.empty.subtitle')}
          ctaLabel={t('health.empty.add')}
          onCta={() => setShowGrowthForm(true)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{`🏥 ${t('health.screenTitle')}`}</Text>
      </View>

      {/* Sélecteur enfant */}
      {enfants.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.enfantPicker} contentContainerStyle={styles.enfantPickerContent}>
          {enfants.map(e => (
            <TouchableOpacity
              key={e.id}
              style={[
                styles.enfantChip,
                { backgroundColor: e.id === selectedEnfantId ? primary + '20' : colors.cardAlt, borderColor: e.id === selectedEnfantId ? primary : 'transparent' },
              ]}
              onPress={() => setSelectedEnfantId(e.id)}
            >
              <Text style={styles.enfantAvatar}>{e.avatar}</Text>
              <Text style={[styles.enfantName, { color: e.id === selectedEnfantId ? primary : colors.textSub }]}>
                {e.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Onglets */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {TAB_IDS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { borderBottomColor: primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab.id ? primary : colors.textMuted }]}>
              {tab.emoji} {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {activeTab === 'croissance' && (
          <CroissanceTab record={record} enfant={selectedEnfant} onAdd={() => setShowGrowthForm(true)} onEditEntry={setEditingEntry} />
        )}
        {activeTab === 'vaccins' && (
          <VaccinsTab record={record} onAdd={() => setShowVaccineForm(true)} />
        )}
        {activeTab === 'infos' && (
          <InfosTab record={record} onEdit={() => setShowInfoEditor(true)} />
        )}
      </ScrollView>

      {/* Modals */}
      <Modal visible={showGrowthForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGrowthForm(false)}>
        <GrowthForm onSave={handleAddGrowth} onClose={() => setShowGrowthForm(false)} />
      </Modal>

      <Modal visible={showVaccineForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowVaccineForm(false)}>
        <VaccineForm onSave={handleAddVaccine} onClose={() => setShowVaccineForm(false)} />
      </Modal>

      <Modal visible={showInfoEditor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInfoEditor(false)}>
        <InfoEditor record={record} onSave={handleSaveInfo} onClose={() => setShowInfoEditor(false)} />
      </Modal>

      <Modal visible={editingEntry !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingEntry(null)}>
        {editingEntry && (
          <GrowthForm
            initialEntry={editingEntry}
            onSave={(newEntry) => handleUpdateGrowth(editingEntry.date, newEntry)}
            onClose={() => setEditingEntry(null)}
            onDelete={() => handleDeleteGrowth(editingEntry.date)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Onglet Croissance ────────────────────────────────────────────────────────

function CroissanceTab({ record, enfant, onAdd, onEditEntry }: { record: HealthRecord; enfant?: import('../../lib/types').Profile; onAdd: () => void; onEditEntry?: (entry: GrowthEntry) => void }) {
  const { primary, tint, colors } = useThemeColors();
  const { t } = useTranslation();
  const entries = [...record.croissance].reverse(); // plus récent en premier
  const [chartMetric, setChartMetric] = useState<'weight' | 'height' | 'head' | 'global'>('weight');

  // Déterminer le sexe depuis le profil (fallback garçon)
  const childSex: 'garçon' | 'fille' = enfant?.gender ?? 'garçon';

  // Âge de l'enfant en mois
  const ageMonths = useMemo(() => {
    if (!enfant?.birthdate) return 0;
    const birth = new Date(enfant.birthdate);
    const now = new Date();
    return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  }, [enfant?.birthdate]);

  // Masquer périmètre crânien si enfant > 3 ans
  const showHead = ageMonths <= 36;

  const metricChips = useMemo(() => {
    const chips: { id: 'weight' | 'height' | 'head' | 'global'; label: string }[] = [
      { id: 'weight', label: t('health.growth.chartWeight') },
      { id: 'height', label: t('health.growth.chartHeight') },
    ];
    if (showHead) chips.push({ id: 'head', label: t('health.growth.chartHead') });
    chips.push({ id: 'global', label: t('health.growth.chartGlobal') });
    return chips;
  }, [showHead, t]);

  // Calculer les deltas
  const getEvolution = (current: number | undefined, previous: number | undefined) => {
    if (current == null || previous == null) return null;
    const diff = current - previous;
    return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  };

  return (
    <View style={styles.tabContent}>
      {/* Sélecteur de courbe */}
      {enfant?.birthdate && (
        <>
          <View style={styles.chipRow}>
            {metricChips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={[
                  styles.metricChip,
                  { backgroundColor: chartMetric === chip.id ? tint : colors.inputBg,
                    borderColor: chartMetric === chip.id ? primary : 'transparent' },
                ]}
                onPress={() => setChartMetric(chip.id)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: chartMetric === chip.id }}
              >
                <Text style={[
                  styles.metricChipText,
                  { color: chartMetric === chip.id ? primary : colors.textSub },
                ]}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Courbe de croissance */}
          {chartMetric === 'global' ? (
            <Animated.View entering={FadeInDown.delay(100)} style={{ gap: Spacing.xl }}>
              <View>
                <Text style={[styles.miniChartLabel, { color: colors.textSub }]}>{t('health.growth.weightUnit')}</Text>
                <GrowthChart entries={record.croissance} sex={childSex} dateNaissance={enfant.birthdate} metric="weight" height={160} />
              </View>
              <View>
                <Text style={[styles.miniChartLabel, { color: colors.textSub }]}>{t('health.growth.heightUnit')}</Text>
                <GrowthChart entries={record.croissance} sex={childSex} dateNaissance={enfant.birthdate} metric="height" height={160} />
              </View>
              {showHead && (
                <View>
                  <Text style={[styles.miniChartLabel, { color: colors.textSub }]}>{t('health.growth.headUnit')}</Text>
                  <GrowthChart entries={record.croissance} sex={childSex} dateNaissance={enfant.birthdate} metric="head" height={160} />
                </View>
              )}
              <GrowthLegend childName={enfant.name} sex={childSex} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(100)}>
              <GrowthChart
                entries={record.croissance}
                sex={childSex}
                dateNaissance={enfant.birthdate}
                metric={chartMetric}
              />
              <GrowthLegend
                childName={enfant.name}
                sex={childSex}
              />
            </Animated.View>
          )}
        </>
      )}

      {/* Résumé dernières mesures */}
      {entries.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200)} style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{t('health.growth.lastMeasure')}</Text>
          <Text style={[styles.summaryDate, { color: colors.textMuted }]}>
            {formatDateDisplay(entries[0].date)}
          </Text>
          <View style={styles.summaryRow}>
            {entries[0].poids != null && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: primary }]}>{entries[0].poids}</Text>
                <Text style={[styles.summaryUnit, { color: colors.textMuted }]}>kg</Text>
                {entries.length > 1 && (
                  <Text style={[styles.summaryDelta, { color: colors.success }]}>
                    {getEvolution(entries[0].poids, entries[1].poids)}
                  </Text>
                )}
              </View>
            )}
            {entries[0].taille != null && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: primary }]}>{entries[0].taille}</Text>
                <Text style={[styles.summaryUnit, { color: colors.textMuted }]}>cm</Text>
                {entries.length > 1 && (
                  <Text style={[styles.summaryDelta, { color: colors.success }]}>
                    {getEvolution(entries[0].taille, entries[1].taille)}
                  </Text>
                )}
              </View>
            )}
            {entries[0].perimetre != null && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: primary }]}>{entries[0].perimetre}</Text>
                <Text style={[styles.summaryUnit, { color: colors.textMuted }]}>cm PC</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* Historique */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('health.growth.history')}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: primary }]} onPress={onAdd} activeOpacity={0.7}>
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>{t('health.growth.addMeasure')}</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
            {t('health.growth.noMeasures')}
          </Text>
        </View>
      ) : (
        <View style={[styles.table, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.tableCell, styles.tableCellHeader, { color: colors.textMuted }]}>{t('health.growth.tableDate')}</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader, { color: colors.textMuted }]}>{t('health.growth.tableWeight')}</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader, { color: colors.textMuted }]}>{t('health.growth.tableHeight')}</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader, { color: colors.textMuted }]}>{t('health.growth.tableHead')}</Text>
          </View>
          {entries.map((entry, i) => (
            <TouchableOpacity
              key={`${entry.date}-${i}`}
              activeOpacity={0.6}
              onPress={() => onEditEntry?.(entry)}
            >
              <Animated.View
                entering={FadeInDown.delay(i * 50)}
                style={[styles.tableRow, i < entries.length - 1 && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <Text style={[styles.tableCell, { color: colors.text }]}>{formatDateDisplay(entry.date)}</Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{entry.poids != null ? `${entry.poids} kg` : '—'}</Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{entry.taille != null ? `${entry.taille} cm` : '—'}</Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{entry.perimetre != null ? `${entry.perimetre}` : '—'}</Text>
              </Animated.View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Onglet Vaccins ───────────────────────────────────────────────────────────

function VaccinsTab({ record, onAdd }: { record: HealthRecord; onAdd: () => void }) {
  const { primary, colors } = useThemeColors();
  const { t } = useTranslation();

  // Grouper par nom de vaccin
  const grouped = useMemo(() => {
    const map = new Map<string, VaccineEntry[]>();
    for (const v of record.vaccins) {
      const key = v.nom;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return Array.from(map.entries());
  }, [record.vaccins]);

  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('health.vaccines.record', { count: record.vaccins.length })}
        </Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: primary }]} onPress={onAdd} activeOpacity={0.7}>
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>{t('health.vaccines.addVaccine')}</Text>
        </TouchableOpacity>
      </View>

      {grouped.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
            {t('health.vaccines.noVaccines')}
          </Text>
        </View>
      ) : (
        grouped.map(([nom, entries], i) => (
          <Animated.View
            key={nom}
            entering={FadeInDown.delay(i * 80)}
            style={[styles.vaccineGroup, { backgroundColor: colors.card }]}
          >
            <View style={styles.vaccineHeader}>
              <Text style={styles.vaccineEmoji}>💉</Text>
              <Text style={[styles.vaccineName, { color: colors.text }]}>{nom}</Text>
              <View style={[styles.doseBadge, { backgroundColor: primary + '20' }]}>
                <Text style={[styles.doseBadgeText, { color: primary }]}>
                  {t('health.vaccines.dose', { count: entries.length })}
                </Text>
              </View>
            </View>
            {entries.map((entry, j) => (
              <View key={j} style={[styles.vaccineRow, j > 0 && { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.vaccineDate, { color: colors.textSub }]}>
                  {formatDateDisplay(entry.date)}
                </Text>
                {entry.dose && (
                  <Text style={[styles.vaccineDose, { color: colors.textMuted }]}>{entry.dose}</Text>
                )}
                {entry.note && (
                  <Text style={[styles.vaccineNote, { color: colors.textFaint }]}>{entry.note}</Text>
                )}
              </View>
            ))}
          </Animated.View>
        ))
      )}
    </View>
  );
}

// ─── Onglet Infos ─────────────────────────────────────────────────────────────

function InfosTab({ record, onEdit }: { record: HealthRecord; onEdit: () => void }) {
  const { primary, colors } = useThemeColors();
  const { t } = useTranslation();

  const InfoRow = ({ emoji, label, value }: { emoji: string; label: string; value?: string }) => (
    <View style={[styles.infoRow, { borderBottomColor: colors.separator }]}>
      <Text style={styles.infoEmoji}>{emoji}</Text>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: value ? colors.text : colors.textFaint }]}>
          {value || t('health.info.notSpecified')}
        </Text>
      </View>
    </View>
  );

  const ListSection = ({ emoji, title, items }: { emoji: string; title: string; items: string[] }) => (
    <View style={[styles.infoSection, { backgroundColor: colors.card }]}>
      <Text style={[styles.infoSectionTitle, { color: colors.text }]}>{emoji} {title}</Text>
      {items.length > 0 ? (
        items.map((item, i) => (
          <View key={i} style={styles.infoListRow}>
            <Text style={[styles.infoListDot, { color: primary }]}>•</Text>
            <Text style={[styles.infoListText, { color: colors.textSub }]}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.infoListEmpty, { color: colors.textFaint }]}>{t('health.info.none')}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('health.info.medicalRecord')}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: primary }]} onPress={onEdit} activeOpacity={0.7}>
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>{t('health.info.edit')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View entering={FadeInDown} style={[styles.infoCard, { backgroundColor: colors.card }]}>
        <InfoRow emoji="🩸" label={t('health.info.bloodType')} value={record.groupeSanguin} />
        <InfoRow emoji="👨‍⚕️" label={t('health.info.doctor')} value={record.contactMedecin} />
        <InfoRow emoji="👶" label={t('health.info.pediatrician')} value={record.contactPediatre} />
        <InfoRow emoji="🚑" label={t('health.info.emergency')} value={record.contactUrgences} />
      </Animated.View>

      <ListSection emoji="⚠️" title={t('health.info.allergies')} items={record.allergies} />
      <ListSection emoji="🏥" title={t('health.info.history')} items={record.antecedents} />
      <ListSection emoji="💊" title={t('health.info.medications')} items={record.medicamentsEnCours} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  scroll: { flex: 1 },
  content: { paddingBottom: 90 },

  // Sélecteur enfant
  enfantPicker: { maxHeight: 56 },
  enfantPickerContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    flexDirection: 'row',
  },
  enfantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  enfantAvatar: { fontSize: FontSize.heading },
  enfantName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Onglets
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Contenu tab
  tabContent: { padding: Spacing.xl, gap: Spacing.xl },

  // Résumé croissance
  summaryCard: {
    borderRadius: 20,
    padding: Spacing['2xl'],
    ...Shadows.md,
  },
  summaryTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  summaryDate: { fontSize: FontSize.caption, marginTop: 2, marginBottom: Spacing.lg },
  summaryRow: { flexDirection: 'row', gap: Spacing['2xl'] },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: FontSize.display, fontWeight: FontWeight.heavy },
  summaryUnit: { fontSize: FontSize.caption },
  summaryDelta: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold, marginTop: 2 },

  // Chips sélecteur de métrique
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  metricChip: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.base,
    borderWidth: 1.5,
  },
  metricChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  // Bouton ajouter
  addBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  addBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // Table croissance
  table: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  tableHeader: {
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  tableCellHeader: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
  },

  // Vaccins
  vaccineGroup: {
    borderRadius: 16,
    padding: Spacing.xl,
  },
  vaccineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  vaccineEmoji: { fontSize: FontSize.title },
  vaccineName: { flex: 1, fontSize: FontSize.body, fontWeight: FontWeight.bold },
  doseBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  doseBadgeText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  vaccineRow: {
    paddingVertical: Spacing.sm,
    paddingLeft: 32,
    gap: 2,
  },
  vaccineDate: { fontSize: FontSize.sm },
  vaccineDose: { fontSize: FontSize.caption },
  vaccineNote: { fontSize: FontSize.caption, fontStyle: 'italic' },

  // Infos
  infoCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.lg,
  },
  infoEmoji: { fontSize: FontSize.titleLg },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FontSize.caption },
  infoValue: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, marginTop: 1 },
  infoSection: {
    borderRadius: 16,
    padding: Spacing.xl,
  },
  infoSectionTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  infoListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: 3,
  },
  infoListDot: { fontSize: FontSize.body, lineHeight: 20 },
  infoListText: { fontSize: FontSize.sm, flex: 1 },
  infoListEmpty: { fontSize: FontSize.sm, fontStyle: 'italic' },

  // Empty states
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing['3xl'] },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptySubtitle: { fontSize: FontSize.sm, textAlign: 'center' },
  emptySection: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
  emptySectionText: { fontSize: FontSize.sm, textAlign: 'center' },
  miniChartLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: Spacing.sm, paddingHorizontal: Spacing['2xl'] },
});

const formStyles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.lg },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.md },
  sectionLabel: { fontSize: FontSize.body, fontWeight: FontWeight.bold, marginTop: Spacing.xl },
  hint: { fontSize: FontSize.caption, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: FontSize.body,
    minHeight: 44,
  },
  inputMulti: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: FontSize.body,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chips: { marginTop: Spacing.sm, maxHeight: 40 },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    marginRight: Spacing.sm,
  },
  chipText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  deleteBtn: {
    marginTop: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.base,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
