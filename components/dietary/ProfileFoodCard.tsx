/**
 * ProfileFoodCard.tsx — Carte de préférences alimentaires d'un profil
 *
 * Affiche les 4 catégories (Allergies / Intolérances / Régimes / Aversions)
 * en CollapsibleSection avec :
 * - Chips pour les items existants (swipe gauche = supprimer via ReanimatedSwipeable)
 * - DietaryAutocomplete pour l'ajout (catalogue ou texte libre pour aversions)
 *
 * Phase 15 — Préférences alimentaires (PREF-02, PREF-04)
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { DietaryAutocomplete } from './DietaryAutocomplete';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { Profile } from '../../lib/types';
import type { GuestProfile, DietarySeverity } from '../../lib/dietary/types';
import { EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES } from '../../lib/dietary/catalogs';
import { getPresetItemsToAdd, REGIME_PRESET_ITEMS } from '../../lib/dietary/presets';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Structure des 4 catégories alimentaires */
const CATEGORIES: Array<{
  key: 'allergies' | 'intolerances' | 'regimes' | 'aversions';
  label: string;
  severity: DietarySeverity;
  foodField: keyof Pick<Profile, 'foodAllergies' | 'foodIntolerances' | 'foodRegimes' | 'foodAversions'>;
}> = [
  { key: 'allergies', label: 'Allergies', severity: 'allergie', foodField: 'foodAllergies' },
  { key: 'intolerances', label: 'Intolérances', severity: 'intolerance', foodField: 'foodIntolerances' },
  { key: 'regimes', label: 'Régimes alimentaires', severity: 'regime', foodField: 'foodRegimes' },
  { key: 'aversions', label: 'Aversions', severity: 'aversion', foodField: 'foodAversions' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileFoodCardProps {
  profile: Profile | GuestProfile;
  onUpdate: (
    category: 'allergies' | 'intolerances' | 'regimes' | 'aversions',
    items: string[],
  ) => void;
  onDelete?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Résout le libellé affiché d'un item (ID canonique → label catalogue, ou texte libre tel quel) */
function resolveLabel(item: string, severity: DietarySeverity): string {
  const catalogs = { allergie: EU_ALLERGENS, intolerance: COMMON_INTOLERANCES, regime: COMMON_REGIMES, aversion: [] };
  const found = catalogs[severity]?.find((c) => c.id === item);
  return found?.label ?? item;
}

/** Retourne les items alimentaires d'un profil pour une catégorie donnée */
function getItems(profile: Profile | GuestProfile, field: keyof Pick<Profile, 'foodAllergies' | 'foodIntolerances' | 'foodRegimes' | 'foodAversions'>): string[] {
  // GuestProfile a également ces 4 champs (foodAllergies/Intolerances/Regimes/Aversions)
  const val = (profile as GuestProfile)[field as keyof GuestProfile];
  if (Array.isArray(val)) return val as string[];
  return [];
}

// ─── Chip avec animation et swipe ─────────────────────────────────────────────

interface AnimatedChipProps {
  label: string;
  onDelete: () => void;
  profileId: string;
  category: string;
  item: string;
}

const AnimatedChip = React.memo(function AnimatedChip({
  label,
  onDelete,
}: AnimatedChipProps) {
  const { colors } = useThemeColors();

  const renderRightActions = useCallback(() => (
    <TouchableOpacity
      style={[styles.deleteAction, { backgroundColor: colors.error }]}
      onPress={onDelete}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Supprimer cette préférence"
    >
      <Text style={[styles.deleteActionText, { color: colors.onPrimary }]}>Supprimer</Text>
    </TouchableOpacity>
  ), [colors.error, colors.onPrimary, onDelete]);

  return (
    <ReanimatedSwipeable
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <View style={styles.chipWrapper}>
        <Chip label={label} />
      </View>
    </ReanimatedSwipeable>
  );
});

// ─── Section catégorie ────────────────────────────────────────────────────────

interface CategorySectionProps {
  profileId: string;
  category: (typeof CATEGORIES)[number];
  items: string[];
  onUpdate: (category: 'allergies' | 'intolerances' | 'regimes' | 'aversions', items: string[]) => void;
}

const CategorySection = React.memo(function CategorySection({
  profileId,
  category,
  items,
  onUpdate,
}: CategorySectionProps) {
  const { colors } = useThemeColors();
  const [inputValue, setInputValue] = useState('');

  const handleDelete = useCallback((item: string) => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
    onUpdate(category.key, items.filter((i) => i !== item));
  }, [items, category.key, onUpdate]);

  const handleSubmit = useCallback((item: string) => {
    if (!item.trim()) return;
    if (items.includes(item)) return; // éviter les doublons
    onUpdate(category.key, [...items, item]);
    setInputValue('');
  }, [items, category.key, onUpdate]);

  const emptyHint = `Aucune ${category.label.toLowerCase()} enregistrée`;

  return (
    <CollapsibleSection
      id={`dietary-${profileId}-${category.key}`}
      title={category.label}
      defaultCollapsed
    >
      {items.length === 0 ? (
        <Text
          style={[styles.emptyHint, { color: colors.textFaint }]}
          accessibilityLabel={emptyHint}
        >
          {emptyHint} — appuyez + pour ajouter
        </Text>
      ) : (
        <View style={styles.chipsContainer}>
          {items.map((item) => (
            <AnimatedChip
              key={item}
              label={resolveLabel(item, category.severity)}
              onDelete={() => handleDelete(item)}
              profileId={profileId}
              category={category.key}
              item={item}
            />
          ))}
        </View>
      )}

      <View style={styles.addRow}>
        <View style={styles.autocompleteWrapper}>
          <DietaryAutocomplete
            severity={category.severity}
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
          />
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => handleSubmit(inputValue)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Ajouter une préférence alimentaire"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.addButtonText, { color: colors.text }]}>+</Text>
        </TouchableOpacity>
      </View>
    </CollapsibleSection>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────

export const ProfileFoodCard = React.memo(function ProfileFoodCard({
  profile,
  onUpdate,
  onDelete,
}: ProfileFoodCardProps) {
  const { colors } = useThemeColors();

  // Nom affiché : Profile a .name, GuestProfile aussi
  const displayName = profile.name;

  // Intercepte les ajouts de régimes à preset (ex: femme_enceinte)
  // pour proposer l'auto-remplissage des restrictions associées
  // dans la même catégorie Régimes alimentaires.
  const handleCategoryUpdate = useCallback(
    (
      category: 'allergies' | 'intolerances' | 'regimes' | 'aversions',
      items: string[],
    ) => {
      if (category !== 'regimes') {
        onUpdate(category, items);
        return;
      }

      const previous = getItems(profile, 'foodRegimes');
      const newlyAdded = items.find(
        (i) => !previous.includes(i) && REGIME_PRESET_ITEMS[i],
      );
      if (!newlyAdded) {
        onUpdate(category, items);
        return;
      }

      const toAdd = getPresetItemsToAdd(newlyAdded, items);
      if (toAdd.length === 0) {
        onUpdate(category, items);
        return;
      }

      Alert.alert(
        'Ajouter les restrictions associées ?',
        `Le régime « Femme enceinte » s'accompagne de restrictions usuelles (lait cru, charcuterie crue, poisson cru, alcool, etc.). Les ajouter aux régimes ?`,
        [
          {
            text: 'Non, juste le régime',
            style: 'cancel',
            onPress: () => onUpdate(category, items),
          },
          {
            text: 'Ajouter',
            onPress: () => onUpdate(category, [...items, ...toAdd]),
          },
        ],
      );
    },
    [profile, onUpdate],
  );

  // Avatar : uniquement disponible sur Profile (les invités n'en ont pas)
  const avatar = (profile as Profile).avatar ?? null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* En-tête profil */}
      <View style={styles.profileHeader}>
        {avatar ? (
          <Text style={styles.avatar}>{avatar}</Text>
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.cardAlt }]}>
            <Text style={[styles.avatarPlaceholderText, { color: colors.textMuted }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.profileName, { color: colors.text }]}>{displayName}</Text>
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteProfileButton}
            onPress={() =>
              Alert.alert(
                `Supprimer ${displayName} ?`,
                'Cet invité et toutes ses préférences seront supprimés.',
                [
                  { text: 'Ne pas supprimer', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: onDelete },
                ],
              )
            }
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Supprimer l'invité ${displayName}`}
          >
            <Text style={[styles.deleteProfileIcon, { color: colors.error }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 4 sections de préférences */}
      <View style={styles.sectionsContainer}>
        {CATEGORIES.map((cat, index) => (
          // zIndex décroissant : Allergies (4) > Intolérances (3) > Régimes (2) > Aversions (1)
          // Garantit que le dropdown autocomplete d'une section ne passe pas sous la suivante
          <View key={cat.key} style={{ zIndex: CATEGORIES.length - index }}>
            <CategorySection
              profileId={profile.id}
              category={cat}
              items={getItems(profile, cat.foodField)}
              onUpdate={handleCategoryUpdate}
            />
          </View>
        ))}
      </View>
    </View>
  );
});

// ─── Styles statiques ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing['2xl'],
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
  },
  avatar: {
    fontSize: 28,
    marginRight: Spacing.xl,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xl,
  },
  avatarPlaceholderText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },
  profileName: {
    flex: 1,
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },
  deleteProfileButton: {
    padding: Spacing.md,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteProfileIcon: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  sectionsContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },
  chipsContainer: {
    flexDirection: 'column',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  chipWrapper: {
    alignSelf: 'flex-start',
  },
  emptyHint: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.normal,
    fontStyle: 'italic',
    marginBottom: Spacing.xl,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  autocompleteWrapper: {
    flex: 1,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    lineHeight: 24,
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.full,
    marginLeft: Spacing.md,
    minHeight: 44,
    alignSelf: 'center',
  },
  deleteActionText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
