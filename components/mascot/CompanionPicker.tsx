/**
 * CompanionPicker.tsx — Modal pageSheet de choix/switch compagnon
 *
 * Permet le choix initial du compagnon au niveau 5 ou le switch d'espèce.
 * Affiche les 5 espèces avec sprites, descriptions, rareté.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui/ModalHeader';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import {
  COMPANION_SPECIES_CATALOG,
  type CompanionSpecies,
} from '../../lib/mascot/companion-types';

// ── Sprites bebe idle_1 par espèce (pour le picker) ──

const SPECIES_PREVIEW_SPRITES: Record<CompanionSpecies, any> = {
  chat:     require('../../assets/garden/animals/chat/bebe/idle_1.png'),
  chien:    require('../../assets/garden/animals/chien/bebe/idle_1.png'),
  lapin:    require('../../assets/garden/animals/lapin/bebe/idle_1.png'),
  renard:   require('../../assets/garden/animals/renard/bebe/idle_1.png'),
  herisson: require('../../assets/garden/animals/herisson/bebe/idle_1.png'),
};

/** Couleur par rareté */
const RARITY_COLOR: Record<'initial' | 'rare' | 'epique', string> = {
  initial: 'transparent',
  rare:    '#4A90E2',
  epique:  '#9B59B6',
};

// ── Props ─────────────────────────────────────────────

interface CompanionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (species: CompanionSpecies, name: string) => void;
  unlockedSpecies: CompanionSpecies[];
  isInitialChoice: boolean;
}

// ── Composant ─────────────────────────────────────────

export const CompanionPicker = React.memo(function CompanionPicker({
  visible,
  onClose,
  onSelect,
  unlockedSpecies,
  isInitialChoice,
}: CompanionPickerProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();

  const [selectedSpecies, setSelectedSpecies] = useState<CompanionSpecies>('chat');
  const [companionName, setCompanionName] = useState('');

  const canConfirm = companionName.trim().length > 0;

  const handleSpeciesSelect = useCallback((species: CompanionSpecies) => {
    Haptics.selectionAsync();
    setSelectedSpecies(species);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onSelect(selectedSpecies, companionName.trim());
  }, [canConfirm, selectedSpecies, companionName, onSelect]);

  const isSpeciesLocked = useCallback((species: CompanionSpecies): boolean => {
    const info = COMPANION_SPECIES_CATALOG.find(s => s.id === species);
    if (!info) return true;
    // Les espèces initiales sont toujours débloquées
    if (info.rarity === 'initial') return false;
    // Les espèces rares/épiques nécessitent d'être dans unlockedSpecies
    return !unlockedSpecies.includes(species);
  }, [unlockedSpecies]);

  const title = isInitialChoice
    ? t('companion.picker.title')
    : t('companion.picker.switchTitle');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ModalHeader
          title={title}
          onClose={onClose}
          rightLabel={canConfirm ? t('companion.picker.confirm') : undefined}
          onRight={canConfirm ? handleConfirm : undefined}
          rightDisabled={!canConfirm}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sous-titre */}
          {isInitialChoice && (
            <Text style={[styles.subtitle, { color: colors.textFaint }]}>
              {t('companion.picker.subtitle')}
            </Text>
          )}

          {/* Grille des 5 espèces */}
          <View style={styles.grid}>
            {COMPANION_SPECIES_CATALOG.map(speciesInfo => {
              const locked = isSpeciesLocked(speciesInfo.id);
              const isSelected = selectedSpecies === speciesInfo.id;

              return (
                <Pressable
                  key={speciesInfo.id}
                  onPress={() => !locked && handleSpeciesSelect(speciesInfo.id)}
                  style={[
                    styles.speciesCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? primary : colors.border,
                      opacity: locked ? 0.5 : 1,
                    },
                  ]}
                  accessibilityLabel={t(speciesInfo.nameKey)}
                  accessibilityState={{ selected: isSelected, disabled: locked }}
                >
                  {/* Sprite */}
                  <View style={styles.spriteContainer}>
                    <Image
                      source={SPECIES_PREVIEW_SPRITES[speciesInfo.id]}
                      style={styles.sprite}
                      resizeMode="contain"
                    />
                    {locked && (
                      <View style={styles.lockOverlay}>
                        <Text style={styles.lockIcon}>🔒</Text>
                      </View>
                    )}
                  </View>

                  {/* Nom */}
                  <Text style={[styles.speciesName, { color: colors.text }]}>
                    {t(speciesInfo.nameKey)}
                  </Text>

                  {/* Description */}
                  <Text
                    style={[styles.speciesDesc, { color: colors.textFaint }]}
                    numberOfLines={2}
                  >
                    {locked
                      ? t('companion.picker.locked')
                      : t(speciesInfo.descriptionKey)}
                  </Text>

                  {/* Badge rareté */}
                  {speciesInfo.rarity !== 'initial' && (
                    <View
                      style={[
                        styles.rarityBadge,
                        { backgroundColor: RARITY_COLOR[speciesInfo.rarity] },
                      ]}
                    >
                      <Text style={styles.rarityText}>
                        {speciesInfo.rarity === 'rare' ? 'Rare' : 'Épique'}
                      </Text>
                    </View>
                  )}

                  {/* Indicateur de sélection */}
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: primary }]}>
                      <Text style={styles.selectedCheck}>✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Champ nom */}
          <View style={styles.nameSection}>
            <Text style={[styles.nameLabel, { color: colors.text }]}>
              {t('companion.picker.nameLabel')}
            </Text>
            <TextInput
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.card,
                  borderColor: companionName.length > 0 ? primary : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder={t('companion.picker.namePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={companionName}
              onChangeText={text => setCompanionName(text.slice(0, 20))}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={canConfirm ? handleConfirm : undefined}
              autoCorrect={false}
            />
            <Text style={[styles.charCount, { color: colors.textFaint }]}>
              {companionName.length}/20
            </Text>
          </View>

          {/* Bouton confirmer */}
          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            style={[
              styles.confirmButton,
              {
                backgroundColor: canConfirm ? primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.confirmText, { color: canConfirm ? '#FFFFFF' : colors.textFaint }]}>
              {t('companion.picker.confirm')}
            </Text>
          </Pressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </Modal>
  );
});

// ── Styles ────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
  },
  subtitle: {
    fontSize: FontSize.body,
    textAlign: 'center',
    marginBottom: Spacing['3xl'],
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xl,
    justifyContent: 'center',
    marginBottom: Spacing['3xl'],
  },
  speciesCard: {
    width: 130,
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.xl,
    alignItems: 'center',
    position: 'relative',
  },
  spriteContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  sprite: {
    width: 40,
    height: 40,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: Radius.md,
  },
  lockIcon: {
    fontSize: FontSize.title,
  },
  speciesName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xxs,
    textAlign: 'center',
  },
  speciesDesc: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    lineHeight: 16,
  },
  rarityBadge: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  rarityText: {
    color: '#FFFFFF',
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },
  selectedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  nameSection: {
    marginBottom: Spacing['3xl'],
  },
  nameLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    fontSize: FontSize.body,
  },
  charCount: {
    fontSize: FontSize.caption,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  confirmButton: {
    borderRadius: Radius.base,
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  confirmText: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  bottomSpacer: {
    height: Spacing['6xl'],
  },
});
