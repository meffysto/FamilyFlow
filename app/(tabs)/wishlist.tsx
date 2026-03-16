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
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Chip } from '../../components/ui/Chip';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import type { WishlistItem, WishBudget, WishOccasion } from '../../lib/types';

type FilterId = 'tous' | '🎂' | '🎄' | string; // string = profileName

const BUDGET_OPTIONS: { label: string; value: WishBudget }[] = [
  { label: 'Aucun', value: '' },
  { label: '💰', value: '💰' },
  { label: '💰💰', value: '💰💰' },
  { label: '💰💰💰', value: '💰💰💰' },
];

const OCCASION_OPTIONS: { label: string; value: WishOccasion }[] = [
  { label: 'Général', value: '' },
  { label: '🎂 Anniversaire', value: '🎂' },
  { label: '🎄 Noël', value: '🎄' },
];

export default function WishlistScreen() {
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

  const [filter, setFilter] = useState<FilterId>('tous');
  const [editorVisible, setEditorVisible] = useState(params.addNew === '1');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);

  // Champs éditeur
  const [editText, setEditText] = useState('');
  const [editProfile, setEditProfile] = useState('');
  const [editBudget, setEditBudget] = useState<WishBudget>('');
  const [editOccasion, setEditOccasion] = useState<WishOccasion>('');
  const [editNotes, setEditNotes] = useState('');

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

    if (filter === '🎂') return items.filter((w) => w.occasion === '🎂');
    if (filter === '🎄') return items.filter((w) => w.occasion === '🎄');
    if (filter !== 'tous') return items.filter((w) => w.profileName === filter);
    return items;
  }, [wishlistItems, filter, isAdult, activeProfile]);

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

  // Chips de filtre
  const filterChips = useMemo(() => {
    const chips: { id: FilterId; label: string }[] = [{ id: 'tous', label: 'Tous' }];
    const names = new Set(wishlistItems.map((w) => w.profileName));
    for (const name of names) {
      const p = profiles.find((pr) => pr.name === name);
      chips.push({ id: name, label: p ? `${p.avatar} ${name}` : name });
    }
    chips.push({ id: '🎂', label: '🎂' });
    chips.push({ id: '🎄', label: '🎄' });
    return chips;
  }, [wishlistItems, profiles]);

  const totalUnbought = useMemo(
    () => wishlistItems.filter((w) => !w.bought).length,
    [wishlistItems],
  );

  // Ouvrir l'éditeur
  const openEditor = useCallback((item?: WishlistItem) => {
    if (item) {
      setEditingItem(item);
      setEditText(item.text);
      setEditProfile(item.profileName);
      setEditBudget(item.budget);
      setEditOccasion(item.occasion);
      setEditNotes(item.notes);
    } else {
      setEditingItem(null);
      setEditText('');
      setEditProfile(activeProfile?.name ?? profiles[0]?.name ?? '');
      setEditBudget('');
      setEditOccasion('');
      setEditNotes('');
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
      });
      showToast('Souhait modifié');
    } else {
      await addWishItem(editText.trim(), editProfile, editBudget, editOccasion, editNotes.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Souhait ajouté');
    }
    setEditorVisible(false);
  }, [editText, editProfile, editBudget, editOccasion, editNotes, editingItem, updateWishItem, addWishItem, showToast]);

  const handleDelete = useCallback(async (item: WishlistItem) => {
    Alert.alert('Supprimer ce souhait ?', item.text, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteWishItem(item);
          showToast('Souhait supprimé');
        },
      },
    ]);
  }, [deleteWishItem, showToast]);

  const handleToggleBought = useCallback(async (item: WishlistItem) => {
    if (!activeProfile) return;
    await toggleWishBought(item, activeProfile.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast(item.bought ? 'Marqué non-acheté' : 'Marqué acheté 🔒');
  }, [activeProfile, toggleWishBought, showToast]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>Souhaits</Text>
          {totalUnbought > 0 && (
            <View style={[styles.countBadge, { backgroundColor: primary + '20' }]}>
              <Text style={[styles.countText, { color: primary }]}>{totalUnbought}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: primary }]}
          onPress={() => openEditor()}
          activeOpacity={0.7}
          accessibilityLabel="Ajouter un souhait"
          accessibilityRole="button"
        >
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Filtres */}
      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {filterChips.map((chip) => (
          <Chip
            key={chip.id}
            label={chip.label}
            selected={filter === chip.id}
            onPress={() => setFilter(chip.id)}
          />
        ))}
      </View>

      {sections.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, margin: Spacing['2xl'] }]}>
          <Text style={styles.emptyEmoji}>🎁</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun souhait</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Ajoutez des idées cadeaux pour chaque membre de la famille !
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionAvatar}>{section.avatar}</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
                {section.data.filter((d) => !d.bought).length} souhait{section.data.filter((d) => !d.bought).length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SwipeToDelete
              onDelete={() => handleDelete(item)}
              skipConfirm
              hintId="wishlist"
            >
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: colors.card }, item.bought && styles.itemBought]}
                onPress={() => openEditor(item)}
                activeOpacity={0.7}
              >
                <View style={styles.itemRow}>
                  <View style={styles.itemContent}>
                    <Text
                      style={[
                        styles.itemText,
                        { color: colors.text },
                        item.bought && { textDecorationLine: 'line-through', color: colors.textFaint },
                      ]}
                      numberOfLines={1}
                    >
                      {item.text}
                    </Text>
                    {item.notes ? (
                      <Text style={[styles.itemNotes, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.notes}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.itemBadges}>
                    {item.budget ? <Text style={styles.badgeText}>{item.budget}</Text> : null}
                    {item.occasion ? <Text style={styles.badgeText}>{item.occasion}</Text> : null}
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
                      accessibilityLabel={item.bought ? 'Marquer non-acheté' : 'Marquer acheté'}
                      accessibilityRole="button"
                    >
                      <Text style={{ fontSize: 16 }}>{item.bought ? '🔒' : '🛒'}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Info acheteur — adultes seulement */}
                {isAdult && item.bought && item.boughtBy && (
                  <Text style={[styles.boughtInfo, { color: colors.success }]}>
                    🔒 Acheté par {item.boughtBy}
                  </Text>
                )}
              </TouchableOpacity>
            </SwipeToDelete>
          )}
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
            title={editingItem ? 'Modifier le souhait' : 'Nouveau souhait'}
            onClose={() => setEditorVisible(false)}
            rightLabel="Enregistrer"
            onRight={handleSave}
            rightDisabled={!editText.trim()}
          />
          <View style={styles.editorContent}>
            {/* Texte */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Souhait</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={editText}
              onChangeText={setEditText}
              placeholder="Ex : Vélo rouge"
              placeholderTextColor={colors.textFaint}
              autoFocus
            />

            {/* Pour qui */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Pour qui</Text>
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
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Budget</Text>
            <View style={styles.chipRow}>
              {BUDGET_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value || 'none'}
                  label={opt.label}
                  selected={editBudget === opt.value}
                  onPress={() => setEditBudget(opt.value)}
                />
              ))}
            </View>

            {/* Occasion */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Occasion</Text>
            <View style={styles.chipRow}>
              {OCCASION_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value || 'general'}
                  label={opt.label}
                  selected={editOccasion === opt.value}
                  onPress={() => setEditOccasion(opt.value)}
                />
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Notes (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.notesInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Ex : Decathlon, taille 24 pouces"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
            />
          </View>
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
    borderBottomWidth: 1,
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
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
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
  sectionAvatar: { fontSize: 28 },
  sectionTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy, flex: 1 },
  sectionCount: { fontSize: FontSize.sm },
  sectionSep: { height: Spacing.md },
  itemCard: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    marginBottom: Spacing.md,
    ...Shadows.xs,
  },
  itemBought: { opacity: 0.7 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  itemContent: { flex: 1, gap: Spacing.xs },
  itemText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  itemNotes: { fontSize: FontSize.sm },
  itemBadges: { flexDirection: 'row', gap: Spacing.sm },
  badgeText: { fontSize: 16 },
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
  // Empty state
  emptyState: {
    padding: Spacing['3xl'],
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy },
  emptyDesc: { fontSize: FontSize.body, textAlign: 'center' },
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
