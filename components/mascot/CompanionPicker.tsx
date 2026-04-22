/**
 * CompanionPicker.tsx — Modal choix/switch compagnon en style parchemin cozy
 *
 * Aligné sur TreeShop / BuildingShopSheet :
 *   - cadre bois + auvent rayé + parchemin + close bouton rond
 *   - cartes espèces avec sprite circulaire parchemin
 *   - input nom avec bordure wood
 *   - bouton confirmer farm 3D glossy vert
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
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Farm } from '../../constants/farm-theme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

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
const RARITY_BG: Record<'initial' | 'rare' | 'epique', string> = {
  initial: 'transparent',
  rare:    '#4A90E2',
  epique:  '#9B59B6',
};

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Auvent rayé ──────────────────────────────────────

function AwningStripes() {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
      <View style={styles.awningShadow} />
      <View style={styles.awningScallop}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Bouton confirmer farm 3D ─────────────────────────

interface FarmButtonProps {
  label: string;
  enabled: boolean;
  onPress?: () => void;
}

function FarmButton({ label, enabled, onPress }: FarmButtonProps) {
  const pressedY = useSharedValue(0);

  const bg = enabled ? Farm.greenBtn : Farm.parchmentDark;
  const shadow = enabled ? Farm.greenBtnShadow : '#D0CBC3';
  const highlight = enabled ? Farm.greenBtnHighlight : Farm.parchment;
  const textColor = enabled ? '#FFFFFF' : Farm.brownTextSub;

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressedY.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressedY.value / 4,
  }));

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      onPressIn={() => {
        if (enabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          pressedY.value = withSpring(4, SPRING_CONFIG);
        }
      }}
      onPressOut={() => {
        pressedY.value = withSpring(0, SPRING_CONFIG);
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Animated.View
        style={[styles.farmBtnShadow, { backgroundColor: shadow }, shadowStyle]}
      />
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: bg }, btnStyle]}>
        <View style={[styles.farmBtnGloss, { backgroundColor: highlight }]} />
        <Text
          style={[
            styles.farmBtnText,
            { color: textColor, textShadowColor: enabled ? 'rgba(0,0,0,0.25)' : 'transparent' },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

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
  const [selectedSpecies, setSelectedSpecies] = useState<CompanionSpecies>('chat');
  const [companionName, setCompanionName] = useState('');

  const canConfirm = companionName.trim().length > 0;

  const handleSpeciesSelect = useCallback((species: CompanionSpecies) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedSpecies(species);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onSelect(selectedSpecies, companionName.trim());
  }, [canConfirm, selectedSpecies, companionName, onSelect]);

  const isSpeciesLocked = useCallback((species: CompanionSpecies): boolean => {
    const info = COMPANION_SPECIES_CATALOG.find(s => s.id === species);
    if (!info) return true;
    if (info.rarity === 'initial') return false;
    return !unlockedSpecies.includes(species);
  }, [unlockedSpecies]);

  const title = isInitialChoice
    ? t('companion.picker.title')
    : t('companion.picker.switchTitle');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayBg}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.woodFrame}>
          <View style={styles.woodFrameInner}>
            <AwningStripes />

            <View style={styles.parchment}>
              <View style={styles.handle} />

              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.farmTitle}
              >
                <Text style={styles.farmTitleText}>{title}</Text>
                {isInitialChoice && (
                  <Text style={styles.farmSubtitle} numberOfLines={2}>
                    {t('companion.picker.subtitle')}
                  </Text>
                )}
              </Animated.View>

              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Grille des 5 espèces */}
                <View style={styles.grid}>
                  {COMPANION_SPECIES_CATALOG.map((speciesInfo, idx) => {
                    const locked = isSpeciesLocked(speciesInfo.id);
                    const isSelected = selectedSpecies === speciesInfo.id;

                    return (
                      <Animated.View
                        key={speciesInfo.id}
                        entering={FadeIn.delay(idx * 60).duration(260)}
                      >
                        <Pressable
                          onPress={() => !locked && handleSpeciesSelect(speciesInfo.id)}
                          style={[
                            styles.speciesCard,
                            isSelected && styles.speciesCardSelected,
                            locked && styles.speciesCardLocked,
                          ]}
                          accessibilityLabel={t(speciesInfo.nameKey)}
                          accessibilityState={{ selected: isSelected, disabled: locked }}
                        >
                          <View style={styles.spriteCircle}>
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

                          <Text style={styles.speciesName} numberOfLines={1}>
                            {t(speciesInfo.nameKey)}
                          </Text>

                          <Text style={styles.speciesDesc} numberOfLines={2}>
                            {locked
                              ? t('companion.picker.locked')
                              : t(speciesInfo.descriptionKey)}
                          </Text>

                          {speciesInfo.rarity !== 'initial' && (
                            <View
                              style={[
                                styles.rarityBadge,
                                { backgroundColor: RARITY_BG[speciesInfo.rarity] },
                              ]}
                            >
                              <Text style={styles.rarityText}>
                                {speciesInfo.rarity === 'rare' ? 'Rare' : 'Épique'}
                              </Text>
                            </View>
                          )}

                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedCheck}>✓</Text>
                            </View>
                          )}
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>

                {/* Champ nom */}
                <View style={styles.nameSection}>
                  <Text style={styles.nameLabel}>
                    {t('companion.picker.nameLabel')}
                  </Text>
                  <TextInput
                    style={[
                      styles.nameInput,
                      companionName.length > 0 && styles.nameInputActive,
                    ]}
                    placeholder={t('companion.picker.namePlaceholder')}
                    placeholderTextColor={Farm.brownTextSub}
                    value={companionName}
                    onChangeText={text => setCompanionName(text.slice(0, 20))}
                    maxLength={20}
                    returnKeyType="done"
                    onSubmitEditing={canConfirm ? handleConfirm : undefined}
                    autoCorrect={false}
                  />
                  <Text style={styles.charCount}>{companionName.length}/20</Text>
                </View>

                {/* Bouton confirmer */}
                <View style={styles.confirmWrap}>
                  <FarmButton
                    label={t('companion.picker.confirm')}
                    enabled={canConfirm}
                    onPress={handleConfirm}
                  />
                </View>
              </ScrollView>
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// ── Styles ────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Wood frame ──
  woodFrame: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    borderRadius: Radius['2xl'],
    backgroundColor: Farm.woodDark,
    padding: 5,
    ...Shadows.xl,
    maxHeight: '88%',
  },
  woodFrameInner: {
    borderRadius: Radius.xl,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    flexShrink: 1,
  },

  // ── Auvent ──
  awning: {
    height: 36,
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  awningStripe: {
    flex: 1,
  },
  awningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  awningScallop: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
  awningScallopDot: {
    flex: 1,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  // ── Parchemin ──
  parchment: {
    backgroundColor: Farm.parchmentDark,
    flexShrink: 1,
    paddingBottom: Spacing['3xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Farm.woodHighlight,
  },
  farmTitle: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.xs,
  },
  farmTitleText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  farmSubtitle: {
    fontSize: FontSize.label,
    textAlign: 'center',
    color: Farm.brownTextSub,
    lineHeight: 18,
  },

  // ── ScrollView ──
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.md,
  },

  // ── Grille espèces ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  speciesCard: {
    width: 130,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    padding: Spacing.lg,
    alignItems: 'center',
    position: 'relative',
    gap: Spacing.xs,
  },
  speciesCardSelected: {
    borderWidth: 2.5,
    borderColor: Farm.greenBtn,
    backgroundColor: Farm.parchment,
  },
  speciesCardLocked: {
    opacity: 0.5,
  },
  spriteCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: Radius.full,
  },
  lockIcon: {
    fontSize: FontSize.title,
  },
  speciesName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    color: Farm.brownText,
  },
  speciesDesc: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    color: Farm.brownTextSub,
    lineHeight: 14,
  },
  rarityBadge: {
    marginTop: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
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
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Farm.greenBtn,
    borderWidth: 2,
    borderColor: Farm.parchment,
  },
  selectedCheck: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },

  // ── Champ nom ──
  nameSection: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  nameLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    color: Farm.brownText,
  },
  nameInput: {
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.lg,
    backgroundColor: Farm.parchment,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    fontSize: FontSize.body,
    color: Farm.brownText,
  },
  nameInputActive: {
    borderColor: Farm.greenBtn,
    borderWidth: 2,
  },
  charCount: {
    fontSize: FontSize.caption,
    textAlign: 'right',
    marginTop: Spacing.xs,
    color: Farm.brownTextSub,
  },

  // ── Confirm button ──
  confirmWrap: {
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.sm,
  },
  farmBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  farmBtnBody: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  farmBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    opacity: 0.3,
  },
  farmBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // ── Close button ──
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },
});
