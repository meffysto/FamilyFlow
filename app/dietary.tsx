/**
 * dietary.tsx — Écran Préférences alimentaires
 *
 * Point d'entrée utilisateur pour saisir et modifier les contraintes alimentaires
 * de tous les membres famille et des invités récurrents.
 *
 * Structure :
 * - Section "Membres de la famille" : liste des profils avec ProfileFoodCard
 * - Section "Invités récurrents" : liste des invités + bouton d'ajout
 *
 * Phase 15 — PREF-02, PREF-04, PREF-06, PREF-07
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { ProfileFoodCard } from '../components/dietary/ProfileFoodCard';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { Button } from '../components/ui/Button';
import { Spacing, Layout } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import type { GuestProfile } from '../lib/dietary/types';

// ─── Composant ────────────────────────────────────────────────────────────────

export default function DietaryScreen() {
  const router = useRouter();
  const { profiles, dietary } = useVault();
  const { colors } = useThemeColors();

  const { guests, updateFoodPreferences, upsertGuest, deleteGuest } = dietary;

  // ─── Handlers membres famille ───────────────────────────────────────────────

  const handleUpdateFamilyMember = useCallback(
    (profileId: string) =>
      (
        category: 'allergies' | 'intolerances' | 'regimes' | 'aversions',
        items: string[],
      ) => {
        updateFoodPreferences(profileId, category, items);
      },
    [updateFoodPreferences],
  );

  // ─── Handlers invités ───────────────────────────────────────────────────────

  const handleUpdateGuest = useCallback(
    (guest: GuestProfile) =>
      (
        category: 'allergies' | 'intolerances' | 'regimes' | 'aversions',
        items: string[],
      ) => {
        const fieldMap: Record<string, keyof GuestProfile> = {
          allergies: 'foodAllergies',
          intolerances: 'foodIntolerances',
          regimes: 'foodRegimes',
          aversions: 'foodAversions',
        };
        upsertGuest({ ...guest, [fieldMap[category]]: items });
      },
    [upsertGuest],
  );

  const handleDeleteGuest = useCallback(
    (guest: GuestProfile) => () => {
      deleteGuest(guest.id);
    },
    [deleteGuest],
  );

  const handleAddGuest = useCallback(() => {
    Alert.prompt(
      'Ajouter un invité',
      'Entrez le prénom de l\'invité récurrent :',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ajouter',
          onPress: (name?: string) => {
            const trimmed = name?.trim();
            if (!trimmed) return;
            // Générer un ID stable à partir du nom
            const id = trimmed
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '');
            const newGuest: GuestProfile = {
              id,
              name: trimmed,
              foodAllergies: [],
              foodIntolerances: [],
              foodRegimes: [],
              foodAversions: [],
            };
            upsertGuest(newGuest);
          },
        },
      ],
      'plain-text',
    );
  }, [upsertGuest]);

  // ─── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={[styles.contentContainer, Layout.contentContainer]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête */}
        <View style={styles.header}>
          <Button
            label="←"
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
          />
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            Préférences alimentaires
          </Text>
          {/* PREF-13 voice input — Plan 07 */}
          <View style={styles.headerRight} />
        </View>

        {/* Section Membres de la famille */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          Membres de la famille
        </Text>

        <SectionErrorBoundary name="Membres de la famille">
          {profiles.map((profile) => (
            <ProfileFoodCard
              key={profile.id}
              profile={profile}
              onUpdate={handleUpdateFamilyMember(profile.id)}
            />
          ))}
        </SectionErrorBoundary>

        {/* Espacement entre sections */}
        <View style={styles.sectionSeparator} />

        {/* Section Invités récurrents */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          Invités récurrents
        </Text>

        <SectionErrorBoundary name="Invités récurrents">
          {guests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.textFaint }]}>
                Aucun invité récurrent enregistré
              </Text>
            </View>
          ) : (
            guests.map((guest) => (
              <ProfileFoodCard
                key={guest.id}
                profile={guest}
                onUpdate={handleUpdateGuest(guest)}
                onDelete={handleDeleteGuest(guest)}
              />
            ))
          )}

          <Button
            label="Ajouter un invité"
            onPress={handleAddGuest}
            variant="secondary"
            icon="+"
            fullWidth
          />
        </SectionErrorBoundary>

        {/* Espace bas de page */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles statiques ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  headerRight: {
    width: 44,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
  },
  sectionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing['2xl'],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSeparator: {
    height: Spacing['4xl'],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  emptyStateText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    marginBottom: Spacing['2xl'],
  },
  bottomSpacer: {
    height: Spacing['4xl'],
  },
});
