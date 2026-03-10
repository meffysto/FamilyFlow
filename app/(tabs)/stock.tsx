/**
 * stock.tsx — Dedicated stock management screen
 *
 * Full CRUD for baby stock items: view by section, +/- quantity,
 * add new products, edit thresholds, delete items.
 */

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { StockEditor } from '../../components/StockEditor';
import { EmptyState } from '../../components/EmptyState';
import { StockItem } from '../../lib/types';

export default function StockScreen() {
  const {
    stock,
    stockSections,
    updateStockQuantity,
    addStockItem,
    deleteStockItem,
    updateStockItem,
    addCourseItem,
  } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | undefined>(undefined);

  // Filter by search
  const filteredStock = useMemo(() => {
    if (!search.trim()) return stock;
    const q = search.toLowerCase();
    return stock.filter(
      (item) =>
        item.produit.toLowerCase().includes(q) ||
        (item.section ?? '').toLowerCase().includes(q)
    );
  }, [stock, search]);

  // Group items by section
  const grouped = useMemo(() => {
    const map: Record<string, StockItem[]> = {};
    for (const item of filteredStock) {
      const sec = item.section ?? 'Autre';
      if (!map[sec]) map[sec] = [];
      map[sec].push(item);
    }
    return map;
  }, [filteredStock]);

  const lowStockCount = stock.filter((s) => s.quantite <= s.seuil).length;

  const openCreate = () => {
    setEditingItem(undefined);
    setEditorVisible(true);
  };

  const openEdit = (item: StockItem) => {
    setEditingItem(item);
    setEditorVisible(true);
  };

  const handleAddToCourses = (item: StockItem) => {
    const qty = item.qteAchat ? ` x${item.qteAchat}` : '';
    const detail = item.detail && !/^\d+$/.test(item.detail.trim()) ? ` (${item.detail})` : '';
    addCourseItem(`${item.produit}${detail}${qty}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`${item.produit} ajouté aux courses !`);
  };

  const getStatusColor = (item: StockItem) => {
    if (item.quantite <= item.seuil) return '#EF4444';
    if (item.quantite <= item.seuil + 1) return '#F59E0B';
    return '#10B981';
  };

  const getStatusEmoji = (item: StockItem) => {
    if (item.quantite <= item.seuil) return '🔴';
    if (item.quantite <= item.seuil + 1) return '🟡';
    return '🟢';
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>📦 Stocks & fournitures</Text>
          {lowStockCount > 0 && (
            <Text style={styles.subtitle}>
              ⚠️ {lowStockCount} produit{lowStockCount > 1 ? 's' : ''} en stock bas
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: tint, borderColor: primary }]}
          onPress={openCreate}
        >
          <Text style={[styles.addBtnText, { color: primary }]}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="🔍 Rechercher un produit..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {Object.entries(grouped).map(([sectionName, items]) => (
          <View key={sectionName} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>{sectionName}</Text>
            {items.map((item) => {
              const statusColor = getStatusColor(item);
              const isLow = item.quantite <= item.seuil;
              return (
                <TouchableOpacity
                  key={item.lineIndex}
                  style={[styles.itemCard, { backgroundColor: colors.card }]}
                  onPress={() => openEdit(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.produit}
                      {item.detail ? <Text style={[styles.itemDetail, { color: colors.textMuted }]}> · {item.detail}</Text> : null}
                    </Text>
                    <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                      {getStatusEmoji(item)} {item.quantite} restant{item.quantite > 1 ? 's' : ''} · seuil {item.seuil}
                    </Text>
                    <Text style={[styles.itemEditHint, { color: colors.separator }]}>Appuyer pour modifier</Text>
                  </View>
                  <View style={styles.itemActions}>
                    {isLow && (
                      <TouchableOpacity
                        style={styles.courseBtn}
                        onPress={() => handleAddToCourses(item)}
                      >
                        <Text style={styles.courseBtnText}>🛒</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: colors.bg }, item.quantite <= 0 && styles.qtyBtnDisabled]}
                        onPress={() => { Haptics.selectionAsync(); updateStockQuantity(item.lineIndex, Math.max(0, item.quantite - 1)); }}
                        disabled={item.quantite <= 0}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[styles.qtyBtnText, { color: colors.textSub }]}>−</Text>
                      </TouchableOpacity>
                      <Text style={[styles.qtyValue, { color: colors.text }, isLow && { color: '#EF4444' }]}>
                        {item.quantite}
                      </Text>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: colors.bg }]}
                        onPress={() => { Haptics.selectionAsync(); updateStockQuantity(item.lineIndex, item.quantite + 1); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[styles.qtyBtnText, { color: colors.textSub }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {filteredStock.length === 0 && (
          <EmptyState
            emoji={search.trim() ? '🔍' : '📦'}
            title={search.trim() ? 'Aucun résultat' : 'Aucun produit en stock'}
            subtitle={search.trim() ? 'Essayez un autre terme de recherche' : undefined}
            ctaLabel={search.trim() ? undefined : '+ Ajouter'}
            onCta={search.trim() ? undefined : () => setEditorVisible(true)}
          />
        )}
      </ScrollView>

      {/* Stock Editor Modal */}
      <Modal visible={editorVisible} animationType="slide" presentationStyle="pageSheet">
        <StockEditor
          item={editingItem}
          sections={stockSections}
          onSave={async (data) => {
            if (editingItem) {
              await updateStockItem(editingItem.lineIndex, data);
            } else {
              await addStockItem(data);
            }
          }}
          onDelete={
            editingItem
              ? () => {
                  deleteStockItem(editingItem.lineIndex);
                  setEditorVisible(false);
                  setEditingItem(undefined);
                }
              : undefined
          }
          onClose={() => {
            setEditorVisible(false);
            setEditingItem(undefined);
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, color: '#EF4444', fontWeight: '600', marginTop: 2 },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  addBtnText: { fontSize: 14, fontWeight: '700' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemDetail: {
    fontWeight: '400',
  },
  itemMeta: {
    fontSize: 12,
  },
  itemEditHint: {
    fontSize: 10,
    marginTop: 1,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBtnText: { fontSize: 16 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.3,
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
  },
});
