/**
 * quotes.tsx — Boîte à mots d'enfants
 *
 * Timeline des perles d'enfants avec saisie rapide.
 * Fichier vault : 06 - Mémoires/Mots d'enfants.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronRight, ChevronDown, Mic, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AvatarIcon } from '../../components/ui/AvatarIcon';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { getDateLocale, formatDateLocalized } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useRefresh } from '../../hooks/useRefresh';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/EmptyState';
import { DictaphoneRecorder } from '../../components/DictaphoneRecorder';
import type { ChildQuote } from '../../lib/types';

export default function QuotesScreen() {
  const { primary, colors, isDark } = useThemeColors();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { profiles, quotes, addQuote, editQuote, deleteQuote, refresh } = useVault();
  const { refreshing, onRefresh } = useRefresh(refresh);

  const [modalVisible, setModalVisible] = useState(false);
  const [citation, setCitation] = useState('');
  const [contexte, setContexte] = useState('');
  const [selectedEnfant, setSelectedEnfant] = useState('');
  const [editingQuote, setEditingQuote] = useState<ChildQuote | null>(null);
  const [modalMode, setModalMode] = useState<'form' | 'dictaphone'>('form');
  const [filterEnfant, setFilterEnfant] = useState<string | null>(null);

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
      return { key, title: title.charAt(0).toUpperCase() + title.slice(1), data, count: data.length };
    });
  }, [quotes]);

  const filteredSections = useMemo(() => {
    if (!filterEnfant) return sections;
    return sections
      .map(s => { const data = s.data.filter(q => q.enfant === filterEnfant); return { ...s, data, count: data.length }; })
      .filter(s => s.count > 0);
  }, [sections, filterEnfant]);

  // Sections repliées par défaut pour les mois passés
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current || sections.length === 0) return;
    hasInitialized.current = true;
    const now = new Date().toISOString().slice(0, 7);
    setCollapsedMonths(new Set(sections.filter(s => s.key < now).map(s => s.key)));
  }, [sections]);

  const toggleMonth = useCallback((key: string) => {
    Haptics.selectionAsync();
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const displaySections = useMemo(
    () => filteredSections.map(s => collapsedMonths.has(s.key) ? { ...s, data: [] as ChildQuote[] } : s),
    [filteredSections, collapsedMonths],
  );

  const openModal = useCallback(() => {
    setCitation('');
    setContexte('');
    setSelectedEnfant(enfants.length === 1 ? enfants[0].name : '');
    setEditingQuote(null);
    setModalMode('form');
    setModalVisible(true);
  }, [enfants]);

  const openEdit = useCallback((quote: ChildQuote) => {
    setCitation(quote.citation);
    setContexte(quote.contexte ?? '');
    setSelectedEnfant(quote.enfant);
    setEditingQuote(quote);
    setModalMode('form');
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!citation.trim() || !selectedEnfant) {
      showToast(t('quotes.toast.fillRequired'), 'error');
      return;
    }
    if (editingQuote) {
      await editQuote(editingQuote.lineIndex, citation.trim(), contexte.trim() || undefined);
      showToast(t('quotes.toast.edited'), 'success');
    } else {
      await addQuote(selectedEnfant, citation.trim(), contexte.trim() || undefined);
      showToast(t('quotes.toast.added'), 'success');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
  }, [citation, contexte, selectedEnfant, editingQuote, addQuote, editQuote, showToast]);

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

  const openDictaphoneMode = useCallback(() => {
    setModalMode('dictaphone');
  }, []);

  const handleDictaphoneResult = useCallback((text: string) => {
    setCitation((prev) => (prev ? prev + ' ' : '') + text);
    setModalMode('form');
  }, []);

  const closeDictaphoneMode = useCallback(() => {
    setModalMode('form');
  }, []);

  const keyExtractor = useCallback(
    (item: ChildQuote, index: number) => `${item.lineIndex}-${index}`,
    [],
  );

  const renderItem = useCallback(({ item }: { item: ChildQuote }) => {
    const avatar = enfants.find(e => e.name === item.enfant)?.avatar ?? 'smile';
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openEdit(item)}
        onLongPress={() => handleDelete(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.enfant} — ${item.citation}`}
        accessibilityHint={t('quotes.deleteHint')}
      >
        <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
          <View style={styles.cardHeader}>
            <AvatarIcon name={avatar} color={primary} size={32} />
            <Text style={[styles.enfant, { color: primary }]} numberOfLines={1}>{item.enfant}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>{formatDateLocalized(item.date)}</Text>
          </View>
          <Text style={[styles.citation, { color: colors.text }]}>« {item.citation} »</Text>
          {!!item.contexte && (
            <Text style={[styles.contexteText, { color: colors.textFaint }]}>{item.contexte}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [colors, primary, handleDelete, openEdit, enfants, t]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('quotes.title')}
        subtitle={quotes.length > 0 ? t('quotes.count', { count: quotes.length }) : undefined}
        scrollY={scrollY}
        actions={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: primary }]}
            onPress={openModal}
            accessibilityLabel={t('quotes.addA11y')}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={18} strokeWidth={2.5} color={colors.onPrimary} />
          </TouchableOpacity>
        }
        bottom={
          enfants.length > 1 ? (
            <View style={styles.filterBar}>
              <Chip
                label={t('quotes.filterAll')}
                selected={!filterEnfant}
                onPress={() => setFilterEnfant(null)}
              />
              {enfants.map(e => (
                <Chip
                  key={e.id}
                  label={e.name}
                  emoji={e.avatar}
                  selected={filterEnfant === e.name}
                  onPress={() => setFilterEnfant(filterEnfant === e.name ? null : e.name)}
                />
              ))}
            </View>
          ) : undefined
        }
      />

      {quotes.length === 0 ? (
        <EmptyState
          emoji="💬"
          title={t('quotes.emptyTitle')}
          subtitle={t('quotes.emptySubtitle')}
          ctaLabel={t('quotes.addBtn')}
          onCta={openModal}
        />
      ) : (
        <AnimatedSectionList
          sections={displaySections as any}
          keyExtractor={keyExtractor as any}
          renderItem={renderItem as any}
          renderSectionHeader={({ section }: any) => {
            const collapsed = collapsedMonths.has(section.key);
            return (
              <TouchableOpacity
                onPress={() => toggleMonth(section.key)}
                style={styles.sectionHeaderRow}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: !collapsed }}
                accessibilityLabel={`${section.title}, ${section.count}`}
              >
                <Text style={[styles.sectionHeader, { color: colors.textSub }]}>{section.title}</Text>
                <Text style={[styles.sectionCount, { color: colors.textFaint }]}>{section.count}</Text>
                {collapsed
                  ? <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.5} />
                  : <ChevronDown size={14} color={colors.textMuted} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={[styles.list, Layout.contentContainer]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
          }
          stickySectionHeadersEnabled={false}
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
        />
      )}

      {/* Modal ajout — bascule entre formulaire et dictaphone via modalMode */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          {modalMode === 'dictaphone' ? (
            <DictaphoneRecorder
              onResult={handleDictaphoneResult}
              onClose={closeDictaphoneMode}
            />
          ) : (
            <>
              <ModalHeader title={editingQuote ? t('quotes.editQuote') : t('quotes.newQuote')} onClose={() => setModalVisible(false)} />
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContainer}
              >
                <View style={styles.modalContent}>
                  {/* Sélecteur enfant — désactivé en mode édition */}
                  <Text style={[styles.label, { color: colors.textSub }]}>{t('quotes.form.child')}</Text>
                  <View style={styles.chipRow}>
                    {enfants.map((e) => (
                      <Chip
                        key={e.id}
                        label={e.name}
                        emoji={e.avatar}
                        selected={selectedEnfant === e.name}
                        onPress={editingQuote ? undefined : () => setSelectedEnfant(e.name)}
                      />
                    ))}
                  </View>

                  {/* Citation */}
                  <View style={styles.citationHeader}>
                    <Text style={[styles.label, { color: colors.textSub }]}>{t('quotes.form.quote')}</Text>
                    <TouchableOpacity
                      onPress={openDictaphoneMode}
                      accessibilityLabel={t('quotes.dictation')}
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Mic size={22} color={primary} strokeWidth={1.75} />
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
                    maxLength={500}
                  />

                  {/* Contexte */}
                  <Text style={[styles.label, { color: colors.textSub }]}>{t('quotes.form.context')}</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
                    placeholder={t('quotes.form.contextPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={contexte}
                    onChangeText={setContexte}
                    maxLength={200}
                  />

                  <View style={styles.saveBtn}>
                    <Button
                      label={editingQuote ? t('quotes.form.update') : t('quotes.form.save')}
                      onPress={handleSave}
                      variant="primary"
                    />
                  </View>
                </View>
              </KeyboardAvoidingView>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textTransform: 'capitalize',
    flex: 1,
  },
  sectionCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardAvatar: {
    fontSize: 22,
  },
  citation: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    fontStyle: 'italic',
    lineHeight: FontSize.body * 1.5,
  },
  contexteText: {
    fontSize: FontSize.caption,
  },
  enfant: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  date: {
    fontSize: FontSize.micro,
    textAlign: 'right',
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
