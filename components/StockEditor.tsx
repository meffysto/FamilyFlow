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
import { useToast } from '../contexts/ToastContext';
import { ModalHeader } from './ui/ModalHeader';
import { StockItem } from '../lib/types';

interface StockEditorProps {
  item?: StockItem; // if provided, editing mode
  sections: string[]; // available sections
  onSave: (item: Omit<StockItem, 'lineIndex'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function StockEditor({ item, sections, onSave, onDelete, onClose }: StockEditorProps) {
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
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
      showToast('Le nom du produit est obligatoire', 'error');
      return;
    }
    if (!section) {
      showToast('Sélectionne une catégorie', 'error');
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
      showToast(String(e), 'error');
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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]}>
      <ModalHeader
        title={isEditing ? 'Modifier le produit' : 'Nouveau produit'}
        onClose={onClose}
        rightLabel={isSaving ? '…' : 'Enregistrer'}
        onRight={handleSave}
        rightDisabled={isSaving}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Produit */}
        <Text style={[styles.label, { color: colors.textSub }]}>📦 Produit *</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
          value={produit}
          onChangeText={setProduit}
          placeholder="Couches, Lait, Sérum phy..."
          placeholderTextColor={colors.textFaint}
        />

        {/* Détail */}
        <Text style={[styles.label, { color: colors.textSub }]}>📝 Détail / Taille</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
          value={detail}
          onChangeText={setDetail}
          placeholder="T5, 400ml, etc."
          placeholderTextColor={colors.textFaint}
        />

        {/* Catégorie */}
        <Text style={[styles.label, { color: colors.textSub }]}>🏷️ Catégorie *</Text>
        <View style={styles.chipRow}>
          {sections.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.chip,
                { backgroundColor: colors.bg },
                section === s && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setSection(s)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textMuted },
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
            <Text style={[styles.label, { color: colors.textSub }]}>📊 Quantité</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
              value={quantite}
              onChangeText={setQuantite}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <View style={styles.numField}>
            <Text style={[styles.label, { color: colors.textSub }]}>⚠️ Seuil alerte</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
              value={seuil}
              onChangeText={setSeuil}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <View style={styles.numField}>
            <Text style={[styles.label, { color: colors.textSub }]}>🛒 Qté/achat</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
              value={qteAchat}
              onChangeText={setQteAchat}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.textFaint}
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
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
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
