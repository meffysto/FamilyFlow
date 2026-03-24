/**
 * wishlist.tsx — Écran Souhaits / Idées cadeaux
 *
 * Liste de souhaits par membre de la famille.
 * Les parents peuvent marquer "acheté" en secret (🔒).
 * Fichier vault : 05 - Famille/Souhaits.md
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Chip } from '../../components/ui/Chip';
import { SegmentedControl } from '../../components/ui';
import type { Segment } from '../../components/ui';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { EmptyState } from '../../components/EmptyState';
import type { WishlistItem, WishBudget, WishOccasion } from '../../lib/types';
import { useTranslation } from 'react-i18next';

function getBudgetOptions(t: (key: string) => string): { label: string; value: WishBudget }[] {
  return [
    { label: t('wishlist.editor.budgetNone'), value: '' },
    { label: '💰', value: '💰' },
    { label: '💰💰', value: '💰💰' },
    { label: '💰💰💰', value: '💰💰💰' },
  ];
}

function getOccasionOptions(t: (key: string) => string): { label: string; value: WishOccasion }[] {
  return [
    { label: t('wishlist.editor.occasionGeneral'), value: '' },
    { label: t('wishlist.editor.occasionBirthday'), value: '🎂' },
    { label: t('wishlist.editor.occasionChristmas'), value: '🎄' },
  ];
}

type OccasionFilter = 'tous' | '🎂' | '🎄';

export default function WishlistScreen() {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const {
    profiles,
    activeProfile,
    wishlistItems,
    addWishItem,
    updateWishItem,
    deleteWishItem,
    toggleWishBought,
    refresh,
  } = useVault();
  const params = useLocalSearchParams<{ addNew?: string }>();

  const isAdult = activeProfile?.role === 'adulte';
  const { refreshing, onRefresh } = useRefresh(refresh);

  const [personFilter, setPersonFilter] = useState<string>('tous');
  const [occasionFilter, setOccasionFilter] = useState<OccasionFilter>('tous');
  const [editorVisible, setEditorVisible] = useState(params.addNew === '1');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);

  // Champs éditeur
  const [editText, setEditText] = useState('');
  const [editProfile, setEditProfile] = useState('');
  const [editBudget, setEditBudget] = useState<WishBudget>('');
  const [editOccasion, setEditOccasion] = useState<WishOccasion>('');
  const [editNotes, setEditNotes] = useState('');
  const [editUrl, setEditUrl] = useState('');

  // Segments personne pour SegmentedControl
  const personSegments = useMemo(() => {
    const segs: Segment<string>[] = [{ id: 'tous', label: t('wishlist.all') }];
    const names = new Set(wishlistItems.map((w) => w.profileName));
    for (const name of names) {
      const p = profiles.find((pr) => pr.name === name);
      segs.push({ id: name, label: p ? `${p.avatar} ${name}` : name });
    }
    return segs;
  }, [wishlistItems, profiles, t]);

  // Chips occasion
  const occasionChips: { id: OccasionFilter; label: string }[] = [
    { id: 'tous', label: t('wishlist.all') },
    { id: '🎂', label: t('wishlist.editor.occasionBirthday') },
    { id: '🎄', label: t('wishlist.editor.occasionChristmas') },
  ];

  // Options localisées
  const budgetOptions = useMemo(() => getBudgetOptions(t), [t]);
  const occasionOptions = useMemo(() => getOccasionOptions(t), [t]);

  // Filtrer les items
  const filteredItems = useMemo(() => {
    let items = wishlistItems;

    // Masquer les items achetés pour les enfants (dans leur propre liste)
    if (!isAdult && activeProfile) {
      items = items.filter((w) => {
        if (w.profileName === activeProfile.name && w.bought) return false;
        return true;
      });
    }

    // Filtre personne
    if (personFilter !== 'tous') {
      items = items.filter((w) => w.profileName === personFilter);
    }

    // Filtre occasion
    if (occasionFilter === '🎂') items = items.filter((w) => w.occasion === '🎂');
    if (occasionFilter === '🎄') items = items.filter((w) => w.occasion === '🎄');

    return items;
  }, [wishlistItems, personFilter, occasionFilter, isAdult, activeProfile]);

  // Stats (adultes)
  const totalToGive = useMemo(
    () => wishlistItems.filter((w) => !w.bought).length,
    [wishlistItems],
  );
  const totalBought = useMemo(
    () => wishlistItems.filter((w) => w.bought).length,
    [wishlistItems],
  );

  // Stats par section (adultes)
  const sectionStats = useMemo(() => {
    const map = new Map<string, { total: number; bought: number }>();
    for (const item of wishlistItems) {
      if (!map.has(item.profileName)) {
        map.set(item.profileName, { total: 0, bought: 0 });
      }
      const s = map.get(item.profileName)!;
      s.total++;
      if (item.bought) s.bought++;
    }
    return map;
  }, [wishlistItems]);

  // Sections pour SectionList
  const sections = useMemo(() => {
    const byProfile = new Map<string, WishlistItem[]>();
    const order: string[] = [];
    for (const item of filteredItems) {
      if (!byProfile.has(item.profileName)) {
        order.push(item.profileName);
        byProfile.set(item.profileName, []);
      }
      byProfile.get(item.profileName)!.push(item);
    }
    return order.map((name) => ({
      title: name,
      avatar: profiles.find((p) => p.name === name)?.avatar ?? '👤',
      data: byProfile.get(name)!,
    }));
  }, [filteredItems, profiles]);

  // Ouvrir l'éditeur
  const openEditor = useCallback((item?: WishlistItem) => {
    if (item) {
      setEditingItem(item);
      setEditText(item.text);
      setEditProfile(item.profileName);
      setEditBudget(item.budget);
      setEditOccasion(item.occasion);
      setEditNotes(item.notes);
      setEditUrl(item.url || '');
    } else {
      setEditingItem(null);
      setEditText('');
      setEditProfile(activeProfile?.name ?? profiles[0]?.name ?? '');
      setEditBudget('');
      setEditOccasion('');
      setEditNotes('');
      setEditUrl('');
    }
    setEditorVisible(true);
  }, [activeProfile, profiles]);

  const handleSave = useCallback(async () => {
    if (!editText.trim() || !editProfile) return;
    if (editingItem) {
      await updateWishItem(editingItem, {
        text: editText.trim(),
        profileName: editProfile,
        budget: editBudget,
        occasion: editOccasion,
        notes: editNotes.trim(),
        url: editUrl.trim(),
      });
      showToast(t('wishlist.toast.modified'));
    } else {
      await addWishItem(editText.trim(), editProfile, editBudget, editOccasion, editNotes.trim(), editUrl.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('wishlist.toast.added'));
    }
    setEditorVisible(false);
  }, [editText, editProfile, editBudget, editOccasion, editNotes, editUrl, editingItem, updateWishItem, addWishItem, showToast]);

  const handleDelete = useCallback(async (item: WishlistItem) => {
    Alert.alert(t('wishlist.alert.deleteTitle'), item.text, [
      { text: t('wishlist.alert.cancel'), style: 'cancel' },
      {
        text: t('wishlist.alert.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteWishItem(item);
          showToast(t('wishlist.toast.deleted'));
        },
      },
    ]);
  }, [deleteWishItem, showToast]);

  const handleToggleBought = useCallback(async (item: WishlistItem) => {
    if (!activeProfile) return;
    await toggleWishBought(item, activeProfile.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast(item.bought ? t('wishlist.toast.markedUnbought') : t('wishlist.toast.markedBought'));
  }, [activeProfile, toggleWishBought, showToast]);

  // Icône occasion : bg + emoji
  const getWishIconStyle = (occasion: WishOccasion) => {
    if (occasion === '🎂') return { bg: colors.warningBg, emoji: '🎂' };
    if (occasion === '🎄') return { bg: colors.successBg, emoji: '🎄' };
    return { bg: primary + '15', emoji: '🎁' };
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isAdult ? t('wishlist.title') : t('wishlist.titleChild')}
          </Text>
          {totalToGive > 0 && (
            <View style={[styles.countBadge, { backgroundColor: primary + '20' }]}>
              <Text style={[styles.countText, { color: primary }]}>{totalToGive}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: primary }]}
          onPress={() => openEditor()}
          activeOpacity={0.7}
          accessibilityLabel={t('wishlist.a11y.addWish')}
          accessibilityRole="button"
        >
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>{t('wishlist.addBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* Filtres — SegmentedControl personne */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SegmentedControl
          segments={personSegments}
          value={personFilter}
          onChange={setPersonFilter}
          style={{ marginBottom: Spacing.md }}
        />
        <View style={styles.occasionRow}>
          {occasionChips.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              selected={occasionFilter === chip.id}
              onPress={() => setOccasionFilter(chip.id)}
            />
          ))}
        </View>
      </View>

      {/* Stats bar — adultes uniquement */}
      {isAdult && (
        <View style={styles.statsBar}>
          <View style={[styles.statPill, { backgroundColor: primary + '15' }]}>
            <Text style={[styles.statPillText, { color: primary }]}>{t('wishlist.toGive', { count: totalToGive })}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.successBg }]}>
            <Text style={[styles.statPillText, { color: colors.success }]}>{t('wishlist.bought', { count: totalBought })}</Text>
          </View>
        </View>
      )}

      {sections.length === 0 ? (
        <EmptyState
          emoji="🎁"
          title={t('wishlist.empty.title')}
          subtitle={t('wishlist.empty.subtitle')}
          ctaLabel={t('wishlist.empty.cta')}
          onCta={() => openEditor()}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, Layout.contentContainer]}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
          renderSectionHeader={({ section }) => {
            const stats = sectionStats.get(section.title);
            const bought = stats?.bought ?? 0;
            const total = stats?.total ?? 0;
            const progress = total > 0 ? bought / total : 0;

            return (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionAvatarCircle, { backgroundColor: primary + '15' }]}>
                  <Text style={styles.sectionAvatarEmoji}>{section.avatar}</Text>
                </View>
                <View style={styles.sectionInfo}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                  {isAdult && (
                    <View style={styles.sectionProgressRow}>
                      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressFill, { backgroundColor: colors.success, width: 60 * progress }]} />
                      </View>
                      <Text style={[styles.sectionProgressText, { color: colors.textMuted }]}>
                        {t('wishlist.sectionBought', { count: bought })} / {total}
                      </Text>
                    </View>
                  )}
                </View>
                {!isAdult && (
                  <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
                    {t('wishlist.sectionWish', { count: section.data.filter((d) => !d.bought).length })}
                  </Text>
                )}
              </View>
            );
          }}
          renderItem={({ item }) => {
            const icon = getWishIconStyle(item.occasion);
            return (
              <SwipeToDelete
                onDelete={() => handleDelete(item)}
                skipConfirm
                hintId="wishlist"
              >
                <TouchableOpacity
                  style={[
                    styles.itemCard,
                    { backgroundColor: colors.card },
                    item.bought && {
                      backgroundColor: colors.cardAlt,
                      borderWidth: 1,
                      borderStyle: 'dashed' as const,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => openEditor(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemRow}>
                    {/* Icône occasion */}
                    <View style={[styles.wishIcon, { backgroundColor: icon.bg }]}>
                      <Text style={[styles.wishIconEmoji, item.bought && { opacity: 0.5 }]}>{icon.emoji}</Text>
                    </View>

                    <View style={styles.itemContent}>
                      <View style={styles.itemTextRow}>
                        <Text
                          style={[
                            styles.itemText,
                            { color: colors.text, flex: 1 },
                            item.bought && { textDecorationLine: 'line-through', color: colors.textFaint },
                          ]}
                          numberOfLines={1}
                        >
                          {item.text}
                        </Text>
                        {item.url ? (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              Linking.openURL(item.url);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={t('wishlist.openLink')}
                            accessibilityRole="link"
                          >
                            <Text style={[styles.linkIcon, { color: primary }]}>🔗</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      {item.notes ? (
                        <Text style={[styles.itemNotes, { color: colors.textMuted }]} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.itemBadges}>
                      {item.budget ? (
                        <View style={[styles.budgetPill, { backgroundColor: colors.warningBg }]}>
                          <Text style={[styles.budgetPillText, { color: colors.warningText }]}>{item.budget}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Bouton acheté — adultes seulement */}
                    {isAdult && (
                      <TouchableOpacity
                        style={[
                          styles.boughtBtn,
                          item.bought
                            ? { backgroundColor: colors.success + '20' }
                            : { backgroundColor: colors.inputBg },
                        ]}
                        onPress={() => handleToggleBought(item)}
                        activeOpacity={0.7}
                        accessibilityLabel={item.bought ? t('wishlist.a11y.markUnbought') : t('wishlist.a11y.markBought')}
                        accessibilityRole="button"
                      >
                        <Text style={{ fontSize: 16 }}>{item.bought ? '🔒' : '🛒'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Info acheteur — adultes seulement */}
                  {isAdult && item.bought && item.boughtBy && (
                    <Text style={[styles.boughtInfo, { color: colors.success }]}>
                      {t('wishlist.boughtBy', { name: item.boughtBy })}
                    </Text>
                  )}
                </TouchableOpacity>
              </SwipeToDelete>
            );
          }}
          renderSectionFooter={() => <View style={styles.sectionSep} />}
        />
      )}

      {/* Modal éditeur */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditorVisible(false)}
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
          <ModalHeader
            title={editingItem ? t('wishlist.editor.titleEdit') : t('wishlist.editor.titleNew')}
            onClose={() => setEditorVisible(false)}
            rightLabel={t('wishlist.editor.save')}
            onRight={handleSave}
            rightDisabled={!editText.trim()}
          />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            {/* Texte */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('wishlist.editor.wishLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={editText}
              onChangeText={setEditText}
              placeholder={t('wishlist.editor.wishPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoFocus
            />

            {/* Pour qui */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('wishlist.editor.forWho')}</Text>
            <View style={styles.chipRow}>
              {profiles.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.avatar} ${p.name}`}
                  selected={editProfile === p.name}
                  onPress={() => setEditProfile(p.name)}
                />
              ))}
            </View>

            {/* Budget */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('wishlist.editor.budget')}</Text>
            <View style={styles.chipRow}>
              {budgetOptions.map((opt) => (
                <Chip
                  key={opt.value || 'none'}
                  label={opt.label}
                  selected={editBudget === opt.value}
                  onPress={() => setEditBudget(opt.value)}
                />
              ))}
            </View>

            {/* Occasion */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('wishlist.editor.occasion')}</Text>
            <View style={styles.chipRow}>
              {occasionOptions.map((opt) => (
                <Chip
                  key={opt.value || 'general'}
                  label={opt.label}
                  selected={editOccasion === opt.value}
                  onPress={() => setEditOccasion(opt.value)}
                />
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('wishlist.editor.notesLabel')}</Text>
            <TextInput
              style={[styles.input, styles.notesInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder={t('wishlist.editor.notesPlaceholder')}
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
            />

            {/* URL / Lien */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('wishlist.editor.urlLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={editUrl}
              onChangeText={setEditUrl}
              placeholder={t('wishlist.editor.urlPlaceholder')}
              placeholderTextColor={colors.textFaint}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  countBadge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  countText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  addBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  addBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  // Filtres
  filterSection: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  occasionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  // Stats bar
  statsBar: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  statPillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Liste
  listContent: {
    padding: Spacing['2xl'],
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sectionAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAvatarEmoji: { fontSize: 18 },
  sectionInfo: { flex: 1, gap: Spacing.xs },
  sectionTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy },
  sectionProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBar: {
    width: 60,
    height: 4,
    borderRadius: Radius.xxs,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: Radius.xxs,
  },
  sectionProgressText: { fontSize: FontSize.micro },
  sectionCount: { fontSize: FontSize.sm },
  sectionSep: { height: Spacing.md },
  // Items
  itemCard: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    marginBottom: Spacing.md,
    ...Shadows.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  wishIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishIconEmoji: { fontSize: 20 },
  itemContent: { flex: 1, gap: Spacing.xs },
  itemTextRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  linkIcon: { fontSize: 16 },
  itemNotes: { fontSize: FontSize.sm },
  itemBadges: { flexDirection: 'row', gap: Spacing.sm },
  budgetPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.sm,
  },
  budgetPillText: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.bold,
  },
  boughtBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boughtInfo: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
  },
  // Éditeur
  editorContent: {
    flex: 1,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    fontSize: FontSize.body,
  },
  notesInput: {
    minHeight: 80,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
});
