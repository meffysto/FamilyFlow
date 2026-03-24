/**
 * pregnancy.tsx — Journal de grossesse enrichi
 *
 * Timeline semaine par semaine avec suivi poids + symptômes.
 * Fichier vault : 03 - Journal/Grossesse/{enfant}.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useRefresh } from '../../hooks/useRefresh';
import { getFruitForWeek, getFruitLabel, getSizeForWeek } from '../../lib/pregnancy';
import { pregnancyJournalPath, parsePregnancyJournal, serializePregnancyJournal } from '../../lib/parser';
import { formatDateLocalized } from '../../lib/date-locale';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/EmptyState';
import { DotChart } from '../../components/charts/DotChart';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import type { PregnancyWeekEntry, Profile } from '../../lib/types';
import type { DataPoint } from '../../lib/stats';

const TOTAL_SA = 41;

export default function PregnancyScreen() {
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { profiles, vault, refresh } = useVault();
  const { refreshing, onRefresh } = useRefresh(refresh);

  // Profils en grossesse
  const pregnancies = useMemo(
    () => profiles.filter(p => p.statut === 'grossesse' && p.dateTerme),
    [profiles],
  );

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<PregnancyWeekEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [formPoids, setFormPoids] = useState('');
  const [formSymptomes, setFormSymptomes] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Sélectionner le premier profil grossesse par défaut
  useEffect(() => {
    if (pregnancies.length > 0 && !selectedProfile) {
      setSelectedProfile(pregnancies[0]);
    }
  }, [pregnancies, selectedProfile]);

  // Charger les entrées du journal
  const loadEntries = useCallback(async () => {
    if (!vault || !selectedProfile) return;
    const path = pregnancyJournalPath(selectedProfile.name);
    try {
      const content = await vault.readFile(path);
      setEntries(parsePregnancyJournal(content, path));
    } catch {
      setEntries([]);
    }
  }, [vault, selectedProfile]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Calculs grossesse
  const pregnancyInfo = useMemo(() => {
    if (!selectedProfile?.dateTerme) return null;
    const daysLeft = Math.ceil((new Date(selectedProfile.dateTerme).getTime() - new Date().getTime()) / 86400000);
    const daysElapsed = 287 - daysLeft;
    const currentWeek = Math.min(42, Math.max(0, Math.floor(daysElapsed / 7)));
    const progress = Math.min(1, Math.max(0, daysElapsed / 287));
    return { daysLeft, daysElapsed, currentWeek, progress };
  }, [selectedProfile]);

  // Données pour le graphe poids
  const weightData: DataPoint[] = useMemo(
    () => entries.filter(e => e.poids).map(e => ({ label: `SA${e.week}`, value: e.poids! })),
    [entries],
  );

  // Ouvrir le modal de saisie
  const openAdd = useCallback(() => {
    setFormPoids('');
    setFormSymptomes('');
    setFormNotes('');
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!vault || !selectedProfile || !pregnancyInfo) return;
    const path = pregnancyJournalPath(selectedProfile.name);
    const newEntry: PregnancyWeekEntry = {
      week: pregnancyInfo.currentWeek,
      date: new Date().toISOString().slice(0, 10),
      poids: formPoids ? parseFloat(formPoids) : undefined,
      symptomes: formSymptomes.trim() || undefined,
      notes: formNotes.trim() || undefined,
      sourceFile: path,
      lineIndex: -1,
    };
    // Remplacer l'entrée de la même semaine si elle existe
    const filtered = entries.filter(e => e.week !== pregnancyInfo.currentWeek);
    const updated = [...filtered, newEntry];
    try {
      await vault.ensureDir('03 - Journal/Grossesse');
      const serialized = serializePregnancyJournal(updated, selectedProfile.name);
      await vault.writeFile(path, serialized);
      setEntries(parsePregnancyJournal(serialized, path));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('pregnancy.toast.saved'), 'success');
      setModalVisible(false);
    } catch {
      showToast(t('pregnancy.toast.error'), 'error');
    }
  }, [vault, selectedProfile, pregnancyInfo, entries, formPoids, formSymptomes, formNotes, showToast]);

  if (pregnancies.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('pregnancy.title')}</Text>
        </View>
        <EmptyState
          emoji="🤰"
          title={t('pregnancy.emptyTitle')}
          subtitle={t('pregnancy.emptySubtitle')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('pregnancy.title')}</Text>
        <TouchableOpacity onPress={openAdd}>
          <Text style={[styles.addBtn, { color: primary }]}>+ {t('pregnancy.thisWeek')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, Layout.contentContainer]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Carte résumé */}
        {pregnancyInfo && (
          <View style={[styles.summaryCard, { backgroundColor: colors.card }, Shadows.md]}>
            <View style={styles.summaryRow}>
              <Text style={styles.fruitEmoji}>{getFruitForWeek(pregnancyInfo.currentWeek)}</Text>
              <View style={styles.summaryInfo}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  {selectedProfile?.name} — {t('pregnancy.saPrefix')} {pregnancyInfo.currentWeek}
                </Text>
                <Text style={[styles.summarySub, { color: colors.textSub }]}>
                  {pregnancyInfo.daysLeft > 0
                    ? `${t('pregnancy.daysLeft', { count: pregnancyInfo.daysLeft })} · ${getFruitLabel(pregnancyInfo.currentWeek)} · ${getSizeForWeek(pregnancyInfo.currentWeek)} cm`
                    : pregnancyInfo.daysLeft === 0
                      ? t('pregnancy.dueToday')
                      : `${t('pregnancy.daysOverdue', { count: Math.abs(pregnancyInfo.daysLeft) })} · ${t('pregnancy.overdue')}`}
                </Text>
              </View>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${Math.round(pregnancyInfo.progress * 100)}%`, backgroundColor: primary }]} />
            </View>
          </View>
        )}

        {/* Graphe poids */}
        {weightData.length >= 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pregnancy.weightChart')}</Text>
            <DotChart data={weightData} color={primary} formatValue={(v) => `${v.toFixed(1)} kg`} />
          </View>
        )}

        {/* Timeline semaine par semaine */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pregnancy.weekByWeek')}</Text>

        {Array.from({ length: (pregnancyInfo?.currentWeek ?? 0) + 1 }, (_, i) => (pregnancyInfo?.currentWeek ?? 0) - i).map(week => {
          const entry = entries.find(e => e.week === week);
          const isCurrent = week === pregnancyInfo?.currentWeek;
          return (
            <View
              key={week}
              style={[
                styles.weekCard,
                { backgroundColor: colors.card, borderLeftColor: isCurrent ? primary : colors.border },
                Shadows.sm,
              ]}
            >
              <View style={styles.weekHeader}>
                <Text style={styles.weekFruit}>{getFruitForWeek(week)}</Text>
                <View style={styles.weekInfo}>
                  <Text style={[styles.weekTitle, { color: isCurrent ? primary : colors.text }]}>
                    {t('pregnancy.saPrefix')} {week} — {getFruitLabel(week)}
                  </Text>
                  <Text style={[styles.weekSize, { color: colors.textMuted }]}>
                    {getSizeForWeek(week)} cm
                  </Text>
                </View>
                {isCurrent && (
                  <View style={[styles.currentBadge, { backgroundColor: primary + '20' }]}>
                    <Text style={[styles.currentBadgeText, { color: primary }]}>{t('pregnancy.thisWeek')}</Text>
                  </View>
                )}
              </View>

              {entry ? (
                <View style={styles.weekData}>
                  {entry.poids ? (
                    <Text style={[styles.weekDetail, { color: colors.textSub }]}>
                      ⚖️ {entry.poids} kg
                    </Text>
                  ) : null}
                  {entry.symptomes ? (
                    <Text style={[styles.weekDetail, { color: colors.textSub }]}>
                      🤒 {entry.symptomes}
                    </Text>
                  ) : null}
                  {entry.notes ? (
                    <Text style={[styles.weekDetail, { color: colors.textSub }]}>
                      📝 {entry.notes}
                    </Text>
                  ) : null}
                  <Text style={[styles.weekDate, { color: colors.textMuted }]}>
                    {formatDateLocalized(entry.date)}
                  </Text>
                </View>
              ) : isCurrent ? (
                <TouchableOpacity onPress={openAdd}>
                  <Text style={[styles.weekCta, { color: primary }]}>+ {t('pregnancy.addWeekTracking')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>

      {/* Modal saisie */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <ModalHeader
            title={`${t('pregnancy.saPrefix')} ${pregnancyInfo?.currentWeek ?? '?'} — ${getFruitForWeek(pregnancyInfo?.currentWeek ?? 0)} ${getFruitLabel(pregnancyInfo?.currentWeek ?? 0)}`}
            onClose={() => setModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={[styles.label, { color: colors.textSub }]}>{t('pregnancy.form.weight')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              placeholder={t('pregnancy.form.weightPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={formPoids}
              onChangeText={setFormPoids}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: colors.textSub }]}>{t('pregnancy.form.symptoms')}</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              placeholder={t('pregnancy.form.symptomsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={formSymptomes}
              onChangeText={setFormSymptomes}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.label, { color: colors.textSub }]}>{t('pregnancy.form.notes')}</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              placeholder={t('pregnancy.form.notesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={formNotes}
              onChangeText={setFormNotes}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.saveBtn}>
              <Button label={t('pregnancy.form.save')} onPress={handleSave} variant="primary" />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  addBtn: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  // Carte résumé
  summaryCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  fruitEmoji: { fontSize: 40 },
  summaryInfo: { flex: 1 },
  summaryTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  summarySub: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  // Timeline
  weekCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weekFruit: { fontSize: 24 },
  weekInfo: { flex: 1 },
  weekTitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  weekSize: {
    fontSize: FontSize.micro,
  },
  currentBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.full,
  },
  currentBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },
  weekData: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.xl + Spacing.sm,
  },
  weekDetail: {
    fontSize: FontSize.caption,
    marginBottom: 2,
  },
  weekDate: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
  weekCta: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
    paddingLeft: Spacing.xl + Spacing.sm,
  },
  // Modal
  modalContainer: { flex: 1 },
  modalContent: { padding: Spacing.lg },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
  multilineInput: {
    minHeight: 80,
  },
  saveBtn: {
    marginTop: Spacing.xl,
  },
});
