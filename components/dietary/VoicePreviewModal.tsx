/**
 * VoicePreviewModal.tsx — Modale de prévisualisation des extractions IA (PREF-13)
 *
 * Affichée après une dictée vocale. L'utilisateur peut cocher/décocher,
 * modifier chaque extraction, puis confirmer en bulk.
 * Aucun auto-commit silencieux (D-14).
 *
 * Phase 15 — PREF-13
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui/ModalHeader';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import type { DietaryExtraction, DietarySeverity, GuestProfile } from '../../lib/dietary/types';
import type { Profile } from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoicePreviewModalProps {
  visible: boolean;
  extractions: DietaryExtraction[];
  profiles: Profile[];
  guests: GuestProfile[];
  onClose: () => void;
  onConfirm: (confirmedExtractions: DietaryExtraction[]) => void;
}

/** Options de catégories disponibles */
const CATEGORIES: { id: DietarySeverity; label: string }[] = [
  { id: 'allergie', label: 'Allergie' },
  { id: 'intolerance', label: 'Intolérance' },
  { id: 'regime', label: 'Régime' },
  { id: 'aversion', label: 'Aversion' },
];

// ─── Composant interne — ligne d'extraction ───────────────────────────────────

interface ExtractionRowProps {
  index: number;
  extraction: DietaryExtraction;
  selected: boolean;
  profiles: Profile[];
  guests: GuestProfile[];
  onToggle: (index: number) => void;
  onChange: (index: number, updated: DietaryExtraction) => void;
}

const ExtractionRow = React.memo(function ExtractionRow({
  index,
  extraction,
  selected,
  profiles,
  guests,
  onToggle,
  onChange,
}: ExtractionRowProps) {
  const { primary, colors } = useThemeColors();

  const handleToggle = useCallback(() => {
    Haptics.selectionAsync();
    onToggle(index);
  }, [index, onToggle]);

  const handleItemChange = useCallback(
    (text: string) => onChange(index, { ...extraction, item: text }),
    [index, extraction, onChange],
  );

  const handleProfileChange = useCallback(
    (profileId: string | null, profileName: string) => {
      onChange(index, { ...extraction, profileId, profileName });
    },
    [index, extraction, onChange],
  );

  const handleCategoryChange = useCallback(
    (category: DietarySeverity) => {
      onChange(index, { ...extraction, category });
    },
    [index, extraction, onChange],
  );

  // Construit la liste complète des convives disponibles
  const allConvives = useMemo(() => [
    ...profiles.map(p => ({ id: p.id, name: p.name })),
    ...guests.map(g => ({ id: g.id, name: g.name })),
    { id: null as null, name: '(inconnu)' },
  ], [profiles, guests]);

  // Couleur sévérité
  const severityColor: Record<DietarySeverity, string> = {
    allergie: colors.error,
    intolerance: colors.warning,
    regime: colors.tagMentionText ?? colors.info,
    aversion: colors.textMuted,
  };

  return (
    <View style={[styles.row, { borderColor: colors.borderLight, borderBottomWidth: 1 }]}>
      {/* Checkbox */}
      <TouchableOpacity
        style={[
          styles.checkbox,
          {
            borderColor: selected ? primary : colors.border,
            backgroundColor: selected ? primary : 'transparent',
          },
        ]}
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Sélectionner l'extraction ${extraction.item}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {selected && (
          <Text style={[styles.checkmark, { color: colors.onPrimary }]}>✓</Text>
        )}
      </TouchableOpacity>

      <View style={styles.rowContent}>
        {/* Sélecteur profil */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.profileScroll}
          contentContainerStyle={styles.profileScrollContent}
        >
          {allConvives.map(convive => (
            <TouchableOpacity
              key={convive.id ?? '__null__'}
              onPress={() => handleProfileChange(convive.id, convive.name)}
              style={[
                styles.profileChip,
                {
                  backgroundColor:
                    extraction.profileId === convive.id
                      ? primary + '20'
                      : colors.cardAlt,
                  borderColor:
                    extraction.profileId === convive.id ? primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.profileChipText,
                  {
                    color:
                      extraction.profileId === convive.id ? primary : colors.textSub,
                    fontWeight:
                      extraction.profileId === convive.id
                        ? FontWeight.semibold
                        : FontWeight.normal,
                  },
                ]}
              >
                {convive.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sélecteur catégorie */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.profileScrollContent}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => handleCategoryChange(cat.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    extraction.category === cat.id
                      ? severityColor[cat.id] + '20'
                      : colors.cardAlt,
                  borderColor:
                    extraction.category === cat.id
                      ? severityColor[cat.id]
                      : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  {
                    color:
                      extraction.category === cat.id
                        ? severityColor[cat.id]
                        : colors.textSub,
                  },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Item éditable */}
        <TextInput
          style={[
            styles.itemInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.text,
            },
          ]}
          value={extraction.item}
          onChangeText={handleItemChange}
          placeholder="Item alimentaire…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={`Item pour l'extraction ${index + 1}`}
        />

        {/* Badge confiance */}
        <Text style={[styles.confidenceBadge, { color: colors.textFaint }]}>
          {extraction.confidence === 'high'
            ? 'Confiance élevée'
            : extraction.confidence === 'medium'
            ? 'Confiance moyenne'
            : 'Confiance faible'}
        </Text>
      </View>
    </View>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────

export const VoicePreviewModal = React.memo(function VoicePreviewModal({
  visible,
  extractions,
  profiles,
  guests,
  onClose,
  onConfirm,
}: VoicePreviewModalProps) {
  const { colors } = useThemeColors();

  // État local : sélection par index
  const [selected, setSelected] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(extractions.map((_, i) => [i, true])),
  );

  // État local : extractions éditées
  const [edited, setEdited] = useState<DietaryExtraction[]>(extractions);

  // Resynchroniser si les extractions changent (nouvelle ouverture)
  React.useEffect(() => {
    setSelected(Object.fromEntries(extractions.map((_, i) => [i, true])));
    setEdited(extractions);
  }, [extractions]);

  const confirmedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const handleToggle = useCallback((index: number) => {
    setSelected(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleChange = useCallback(
    (index: number, updated: DietaryExtraction) => {
      setEdited(prev => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [],
  );

  const handleDeselectAll = useCallback(() => {
    Haptics.selectionAsync();
    setSelected(Object.fromEntries(extractions.map((_, i) => [i, false])));
  }, [extractions]);

  const handleConfirm = useCallback(() => {
    const confirmed = edited.filter((_, i) => selected[i]);
    onConfirm(confirmed);
  }, [edited, selected, onConfirm]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        {/* En-tête */}
        <ModalHeader
          title="Vérifier les préférences détectées"
          onClose={onClose}
        />

        {/* Sous-titre */}
        <View style={[styles.subtitleContainer, { borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Décochez ou modifiez avant de confirmer.
          </Text>
        </View>

        {/* Liste des extractions */}
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {edited.map((extraction, i) => (
            <ExtractionRow
              key={i}
              index={i}
              extraction={extraction}
              selected={selected[i] ?? true}
              profiles={profiles}
              guests={guests}
              onToggle={handleToggle}
              onChange={handleChange}
            />
          ))}

          {edited.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textFaint }]}>
                Aucune préférence détectée.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer sticky */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <Button
            label="Tout décocher"
            onPress={handleDeselectAll}
            variant="ghost"
            size="md"
          />
          <Button
            label={`Confirmer (${confirmedCount})`}
            onPress={handleConfirm}
            variant="primary"
            size="md"
            disabled={confirmedCount === 0}
          />
        </View>
      </View>
    </Modal>
  );
});

// ─── Styles statiques ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subtitleContainer: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
  },
  subtitle: {
    fontSize: FontSize.label,
    lineHeight: LineHeight.body,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacing['4xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['2xl'],
    gap: Spacing['2xl'],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkmark: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },
  rowContent: {
    flex: 1,
    gap: Spacing.md,
  },
  profileScroll: {
    flexGrow: 0,
  },
  profileScrollContent: {
    gap: Spacing.md,
    flexDirection: 'row',
  },
  profileChip: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  profileChipText: {
    fontSize: FontSize.label,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryChip: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  itemInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
  },
  confidenceBadge: {
    fontSize: FontSize.caption,
  },
  emptyState: {
    paddingVertical: Spacing['5xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['2xl'],
    borderTopWidth: 1,
  },
});
