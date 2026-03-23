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
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';

import { ModalHeader } from './ui/ModalHeader';
import { StockItem } from '../lib/types';
import { EMPLACEMENTS, SUBCATEGORIES, type EmplacementId } from '../constants/stock';
import { FontSize, FontWeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';

interface StockEditorProps {
  item?: StockItem; // if provided, editing mode
  sections: string[];
  defaultEmplacement?: EmplacementId; // emplacement par défaut pour les nouveaux items
  onSave: (item: Omit<StockItem, 'lineIndex'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function StockEditor({ item, sections, defaultEmplacement, onSave, onDelete, onClose }: StockEditorProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const isEditing = !!item;

  const [produit, setProduit] = useState(item?.produit ?? '');
  const [detail, setDetail] = useState(item?.detail ?? '');
  const [quantite, setQuantite] = useState(String(item?.quantite ?? 0));
  const [seuil, setSeuil] = useState(String(item?.seuil ?? 1));
  const [qteAchat, setQteAchat] = useState(item?.qteAchat ? String(item.qteAchat) : '');
  const [emplacement, setEmplacement] = useState<EmplacementId>(
    (item?.emplacement as EmplacementId) ?? defaultEmplacement ?? 'placards'
  );
  const [section, setSection] = useState(item?.section ?? '');
  const [tracked, setTracked] = useState(item?.tracked !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sous-catégories disponibles pour l'emplacement sélectionné
  const availableSubcategories = SUBCATEGORIES[emplacement] ?? [];
  const sectionRequired = availableSubcategories.length > 0;

  // Quand l'emplacement change, réinitialiser la section
  const handleEmplacementChange = (newEmp: EmplacementId) => {
    setEmplacement(newEmp);
    setSection('');
  };

  const handleSave = async () => {
    setErrorMsg('');
    if (!produit.trim()) {
      setErrorMsg(t('editors.stock.toast.productRequired'));
      return;
    }
    if (sectionRequired && !section) {
      setErrorMsg(t('editors.stock.toast.categoryRequired'));
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
        tracked,
        emplacement,
        section: section || undefined,
      });
      onClose();
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert(
      t('editors.stock.deleteConfirmTitle'),
      t('editors.stock.deleteConfirmMsg', { name: produit }),
      [
        { text: t('editors.cancel'), style: 'cancel' },
        { text: t('editors.delete'), style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]}>
      <ModalHeader
        title={isEditing ? t('editors.stock.titleEdit') : t('editors.stock.titleNew')}
        onClose={onClose}
        rightLabel={isSaving ? '…' : t('editors.save')}
        onRight={handleSave}
        rightDisabled={isSaving}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {errorMsg ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.errorBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Produit */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.stock.productLabel')}</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
          value={produit}
          onChangeText={setProduit}
          placeholder={t('editors.stock.productPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        {/* Détail */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.stock.detailLabel')}</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBg }]}
          value={detail}
          onChangeText={setDetail}
          placeholder={t('editors.stock.detailPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        {/* Emplacement */}
        <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.stock.locationLabel')}</Text>
        <View style={styles.chipRow}>
          {EMPLACEMENTS.map((emp) => (
            <TouchableOpacity
              key={emp.id}
              style={[
                styles.chip,
                { backgroundColor: colors.bg },
                emplacement === emp.id && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => handleEmplacementChange(emp.id)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipText,
                { color: colors.textMuted },
                emplacement === emp.id && { color: primary, fontWeight: FontWeight.bold },
              ]}>
                {emp.emoji} {emp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Catégorie (sous-catégorie de l'emplacement) */}
        {availableSubcategories.length > 0 && (
          <>
            <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.stock.categoryLabel')}</Text>
            <View style={styles.chipRow}>
              {availableSubcategories.map((s) => (
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
                    section === s && { color: primary, fontWeight: FontWeight.bold },
                  ]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Toggle alertes */}
        <View style={[styles.trackRow, { backgroundColor: colors.bg, borderColor: colors.inputBorder }]}>
          <View style={styles.trackInfo}>
            <Text style={[styles.trackLabel, { color: colors.text }]}>{t('editors.stock.trackedLabel')}</Text>
            <Text style={[styles.trackHint, { color: colors.textMuted }]}>{t('editors.stock.trackedHint')}</Text>
          </View>
          <Switch
            value={tracked}
            onValueChange={setTracked}
            trackColor={{ false: colors.border, true: primary }}
          />
        </View>

        {/* Numeric fields row */}
        <View style={[styles.numRow, !tracked && { opacity: 0.4 }]}>
          <View style={styles.numField}>
            <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.stock.quantityLabel')}</Text>
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
            <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.stock.thresholdLabel')}</Text>
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
            <Text style={[styles.label, { color: colors.textSub }]}>{t('editors.stock.purchaseQtyLabel')}</Text>
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
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.errorBg, borderColor: colors.error }]}
            onPress={handleDelete}
          >
            <Text style={[styles.deleteBtnText, { color: colors.error }]}>{t('editors.stock.deleteBtn')}</Text>
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
  errorBanner: {
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: FontSize.body,
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
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  trackHint: {
    fontSize: FontSize.caption,
    marginTop: 2,
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
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
