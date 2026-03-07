/**
 * StockEditor.tsx — Modal form for creating/editing stock items
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { StockItem } from '../lib/types';

interface StockEditorProps {
  item?: StockItem; // if provided, editing mode
  sections: string[]; // available sections
  onSave: (item: Omit<StockItem, 'lineIndex'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function StockEditor({ item, sections, onSave, onDelete, onClose }: StockEditorProps) {
  const { primary, tint } = useThemeColors();
  const isEditing = !!item;

  const [produit, setProduit] = useState(item?.produit ?? '');
  const [detail, setDetail] = useState(item?.detail ?? '');
  const [quantite, setQuantite] = useState(String(item?.quantite ?? 0));
  const [seuil, setSeuil] = useState(String(item?.seuil ?? 1));
  const [qteAchat, setQteAchat] = useState(item?.qteAchat ? String(item.qteAchat) : '');
  const [section, setSection] = useState(item?.section ?? sections[0] ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!produit.trim()) {
      Alert.alert('Champ requis', 'Le nom du produit est obligatoire.');
      return;
    }
    if (!section) {
      Alert.alert('Champ requis', 'Sélectionne une catégorie.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        produit: produit.trim(),
        detail: detail.trim() || undefined,
        quantite: parseInt(quantite, 10) || 0,
        seuil: parseInt(seuil, 10) || 1,
        qteAchat: qteAchat ? parseInt(qteAchat, 10) || undefined : undefined,
        section,
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
      'Supprimer le produit',
      `Supprimer "${produit}" du stock ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerClose}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Modifier le produit' : 'Nouveau produit'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          <Text style={[styles.headerSave, { color: primary }]}>
            {isSaving ? '...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Produit */}
        <Text style={styles.label}>📦 Produit *</Text>
        <TextInput
          style={styles.input}
          value={produit}
          onChangeText={setProduit}
          placeholder="Couches, Lait, Sérum phy..."
          placeholderTextColor="#9CA3AF"
        />

        {/* Détail */}
        <Text style={styles.label}>📝 Détail / Taille</Text>
        <TextInput
          style={styles.input}
          value={detail}
          onChangeText={setDetail}
          placeholder="T5, 400ml, etc."
          placeholderTextColor="#9CA3AF"
        />

        {/* Catégorie */}
        <Text style={styles.label}>🏷️ Catégorie *</Text>
        <View style={styles.chipRow}>
          {sections.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.chip,
                section === s && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setSection(s)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipText,
                section === s && { color: primary, fontWeight: '700' },
              ]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Numeric fields row */}
        <View style={styles.numRow}>
          <View style={styles.numField}>
            <Text style={styles.label}>📊 Quantité</Text>
            <TextInput
              style={styles.input}
              value={quantite}
              onChangeText={setQuantite}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.numField}>
            <Text style={styles.label}>⚠️ Seuil alerte</Text>
            <TextInput
              style={styles.input}
              value={seuil}
              onChangeText={setSeuil}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.numField}>
            <Text style={styles.label}>🛒 Qté/achat</Text>
            <TextInput
              style={styles.input}
              value={qteAchat}
              onChangeText={setQteAchat}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Delete button (edit mode only) */}
        {isEditing && onDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️ Supprimer ce produit</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerClose: { fontSize: 20, color: '#9CA3AF', padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  headerSave: { fontSize: 15, fontWeight: '700', padding: 4 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  numRow: {
    flexDirection: 'row',
    gap: 12,
  },
  numField: {
    flex: 1,
    gap: 6,
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
});
