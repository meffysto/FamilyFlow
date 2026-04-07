/**
 * ConvivesPickerModal.tsx — Sélecteur multiselect des convives pour la vérification des conflits
 *
 * Permet de sélectionner quels membres famille et quels invités sont présents
 * pour affiner la détection de conflits alimentaires dans le RecipeViewer.
 *
 * - Volatile : aucune persistance (PREF-FUT-01 respecté)
 * - Modal pageSheet avec drag-to-dismiss natif iOS
 * - Deux sections : Famille + Invités (chips multiselect)
 * - Footer sticky avec bouton "Vérifier les convives"
 *
 * Phase 15 — PREF-08, PREF-10 (Plan 06)
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { Profile } from '../../lib/types';
import type { GuestProfile } from '../../lib/dietary/types';
import { ModalHeader } from '../ui/ModalHeader';
import { Chip } from '../ui/Chip';

export interface ConvivesPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedProfileIds: string[], selectedGuestIds: string[]) => void;
  profiles: Profile[];
  guests: GuestProfile[];
  initialSelectedProfileIds?: string[];
  initialSelectedGuestIds?: string[];
}

export const ConvivesPickerModal = React.memo(function ConvivesPickerModal({
  visible,
  onClose,
  onConfirm,
  profiles,
  guests,
  initialSelectedProfileIds,
  initialSelectedGuestIds,
}: ConvivesPickerModalProps) {
  const { colors, primary } = useThemeColors();

  // État local de sélection — réinitialisé à chaque ouverture
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    () => new Set(initialSelectedProfileIds ?? []),
  );
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(
    () => new Set(initialSelectedGuestIds ?? []),
  );

  // Réinitialiser la sélection quand la modal s'ouvre avec de nouvelles valeurs initiales
  useEffect(() => {
    if (visible) {
      setSelectedProfileIds(new Set(initialSelectedProfileIds ?? []));
      setSelectedGuestIds(new Set(initialSelectedGuestIds ?? []));
    }
  }, [visible, initialSelectedProfileIds, initialSelectedGuestIds]);

  // Bascule sélection d'un profil famille
  const toggleProfile = useCallback((id: string) => {
    setSelectedProfileIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Bascule sélection d'un invité
  const toggleGuest = useCallback((id: string) => {
    setSelectedGuestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Confirmer la sélection et remonter les IDs
  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selectedProfileIds), Array.from(selectedGuestIds));
  }, [onConfirm, selectedProfileIds, selectedGuestIds]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* En-tête avec bouton fermer */}
        <ModalHeader
          title="Vérifier les conflits"
          onClose={onClose}
          closeLeft
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Famille */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Famille</Text>
          {profiles.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Aucun profil famille disponible
            </Text>
          ) : (
            <View style={styles.chipsRow}>
              {profiles.map(p => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={selectedProfileIds.has(p.id)}
                  onPress={() => toggleProfile(p.id)}
                />
              ))}
            </View>
          )}

          {/* Section Invités */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Invités</Text>
          {guests.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Aucun invité récurrent enregistré
            </Text>
          ) : (
            <View style={styles.chipsRow}>
              {guests.map(g => (
                <Chip
                  key={g.id}
                  label={g.name}
                  selected={selectedGuestIds.has(g.id)}
                  onPress={() => toggleGuest(g.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer sticky — bouton principal */}
        <View style={[styles.footer, { borderTopColor: colors.borderLight, backgroundColor: colors.bg }]}>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: primary }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Vérifier les convives"
          >
            <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
              Vérifier les convives
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing['3xl'],
    paddingBottom: Spacing['5xl'],
  },
  sectionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xl,
    marginTop: Spacing['4xl'],
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  emptyHint: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
  },
  footer: {
    padding: Spacing['3xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
