/**
 * quotes.tsx — Boîte à mots d'enfants
 *
 * Timeline des perles d'enfants avec saisie rapide.
 * Fichier vault : 06 - Mémoires/Mots d'enfants.md
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { getDateLocale, formatDateLocalized } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useRefresh } from '../../hooks/useRefresh';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { EmptyState } from '../../components/EmptyState';
import { DictaphoneRecorder } from '../../components/DictaphoneRecorder';
import type { ChildQuote } from '../../lib/types';

export default function QuotesScreen() {
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { profiles, quotes, addQuote, deleteQuote, refresh } = useVault();
  const { refreshing, onRefresh } = useRefresh(refresh);

  const [modalVisible, setModalVisible] = useState(false);
  const [citation, setCitation] = useState('');
  const [contexte, setContexte] = useState('');
  const [selectedEnfant, setSelectedEnfant] = useState('');
  const [dictaphoneVisible, setDictaphoneVisible] = useState(false);
  const dictaphoneResultRef = useRef<string>('');

  const enfants = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );

  // Grouper par mois pour la SectionList
  const sections = useMemo(() => {
    const grouped = new Map<string, ChildQuote[]>();
    for (const q of quotes) {
      const monthKey = q.date.slice(0, 7); // YYYY-MM
      if (!grouped.has(monthKey)) grouped.set(monthKey, []);
      grouped.get(monthKey)!.push(q);
    }
    return [...grouped.entries()].map(([key, data]) => {
      const [yyyy, mm] = key.split('-');
      const d = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
      const title = format(d, 'MMMM yyyy', { locale: getDateLocale() });
      return { title: title.charAt(0).toUpperCase() + title.slice(1), data };
    });
  }, [quotes]);

  const openModal = useCallback(() => {
    setCitation('');
    setContexte('');
    setSelectedEnfant(enfants.length === 1 ? enfants[0].name : '');
    setModalVisible(true);
  }, [enfants]);

  const handleSave = useCallback(async () => {
    if (!citation.trim() || !selectedEnfant) {
      showToast(t('quotes.toast.fillRequired'), 'error');
      return;
    }
    await addQuote(selectedEnfant, citation.trim(), contexte.trim() || undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('quotes.toast.added'), 'success');
    setModalVisible(false);
  }, [citation, contexte, selectedEnfant, addQuote, showToast]);

  const handleDelete = useCallback(async (quote: ChildQuote) => {
    Alert.alert(
      t('quotes.deleteTitle'),
      `« ${quote.citation} »`,
      [
        { text: t('quotes.cancel'), style: 'cancel' },
        {
          text: t('quotes.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteQuote(quote.lineIndex);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast(t('quotes.toast.deleted'), 'success');
          },
        },
      ],
    );
  }, [deleteQuote, showToast]);

  const handleDictaphoneResult = useCallback((text: string) => {
    dictaphoneResultRef.current = text;
    setDictaphoneVisible(false);
    setCitation((prev) => (prev ? prev + ' ' : '') + text);
  }, []);

  const keyExtractor = useCallback(
    (item: ChildQuote, index: number) => `${item.lineIndex}-${index}`,
    [],
  );

  const renderItem = useCallback(({ item }: { item: ChildQuote }) => (
    <SwipeToDelete onDelete={() => handleDelete(item)} hintId="quote">
      <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
        <Text style={[styles.citation, { color: colors.text }]}>
          « {item.citation} »
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.enfant, { color: primary }]}>
            {item.enfant}
          </Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>
            {formatDateLocalized(item.date)}
            {item.contexte ? ` · ${item.contexte}` : ''}
          </Text>
        </View>
      </View>
    </SwipeToDelete>
  ), [colors, primary, handleDelete]);

  // Fermer le modal principal avant d'ouvrir le dictaphone (max 1 niveau)
  const openDictaphone = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => setDictaphoneVisible(true), 350);
  }, []);

  const closeDictaphone = useCallback(() => {
    setDictaphoneVisible(false);
    setTimeout(() => setModalVisible(true), 350);
  }, []);

  const handleDictaphoneClose = useCallback((text: string) => {
    dictaphoneResultRef.current = text;
    setDictaphoneVisible(false);
    setCitation((prev) => (prev ? prev + ' ' : '') + text);
    setTimeout(() => setModalVisible(true), 350);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('quotes.title')}</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: primary }]}
          onPress={openModal}
          accessibilityLabel={t('quotes.addA11y')}
          accessibilityRole="button"
        >
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+</Text>
        </TouchableOpacity>
      </View>

      {quotes.length === 0 ? (
        <EmptyState
          emoji="💬"
          title={t('quotes.emptyTitle')}
          subtitle={t('quotes.emptySubtitle')}
          ctaLabel={t('quotes.addBtn')}
          onCta={openModal}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.textSub }]}>
              {section.title}
            </Text>
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Modal ajout */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <ModalHeader title={t('quotes.newQuote')} onClose={() => setModalVisible(false)} />

          <View style={styles.modalContent}>
            {/* Sélecteur enfant */}
            <Text style={[styles.label, { color: colors.textSub }]}>{t('quotes.form.child')}</Text>
            <View style={styles.chipRow}>
              {enfants.map((e) => (
                <Chip
                  key={e.id}
                  label={e.name}
                  emoji={e.avatar}
                  selected={selectedEnfant === e.name}
                  onPress={() => setSelectedEnfant(e.name)}
                />
              ))}
            </View>

            {/* Citation */}
            <View style={styles.citationHeader}>
              <Text style={[styles.label, { color: colors.textSub }]}>{t('quotes.form.quote')}</Text>
              <TouchableOpacity onPress={openDictaphone}>
                <Text style={{ fontSize: FontSize.title }}>🎙️</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.citationInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              placeholder={t('quotes.form.quotePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={citation}
              onChangeText={setCitation}
              multiline
              textAlignVertical="top"
            />

            {/* Contexte */}
            <Text style={[styles.label, { color: colors.textSub }]}>{t('quotes.form.context')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              placeholder={t('quotes.form.contextPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={contexte}
              onChangeText={setContexte}
            />

            <View style={styles.saveBtn}>
              <Button
                label={t('quotes.form.save')}
                onPress={handleSave}
                variant="primary"
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Dictaphone — modal séparé (max 1 niveau) */}
      <Modal visible={dictaphoneVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDictaphone}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <ModalHeader title={t('quotes.dictation')} onClose={closeDictaphone} />
          <DictaphoneRecorder
            onResult={handleDictaphoneClose}
            onClose={closeDictaphone}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.title + 2,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  sectionHeader: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'capitalize',
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  citation: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    fontStyle: 'italic',
    marginBottom: Spacing.xs,
    lineHeight: FontSize.body * 1.5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enfant: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  date: {
    fontSize: FontSize.micro,
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  citationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
  citationInput: {
    minHeight: 80,
  },
  saveBtn: {
    marginTop: Spacing.xl,
  },
});
