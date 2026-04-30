/**
 * dietary.tsx — Écran Préférences alimentaires
 *
 * Point d'entrée utilisateur pour saisir et modifier les contraintes alimentaires
 * de tous les membres famille et des invités récurrents.
 *
 * Structure :
 * - Section "Membres de la famille" : liste des profils avec ProfileFoodCard
 * - Section "Invités récurrents" : liste des invités + bouton d'ajout
 * - Bouton micro dans le header → DictaphoneRecorder → VoicePreviewModal (PREF-13)
 *
 * Phase 15 — PREF-02, PREF-04, PREF-06, PREF-07, PREF-13
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAI } from '../contexts/AIContext';
import { ProfileFoodCard } from '../components/dietary/ProfileFoodCard';
import { VoicePreviewModal } from '../components/dietary/VoicePreviewModal';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { Button } from '../components/ui/Button';
import { DictaphoneRecorder } from '../components/DictaphoneRecorder';
import { extractDietaryConstraints } from '../lib/ai-service';
import { Spacing, Layout } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import type { DietaryExtraction, GuestProfile } from '../lib/dietary/types';

// ─── Composant ────────────────────────────────────────────────────────────────

export default function DietaryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profiles, dietary } = useVault();
  const { colors } = useThemeColors();
  const { config } = useAI();

  const { guests, updateFoodPreferences, upsertGuest, deleteGuest } = dietary;

  // ─── État saisie vocale (PREF-13) ───────────────────────────────────────────

  const [recorderVisible, setRecorderVisible] = useState(false);
  const [extractions, setExtractions] = useState<DietaryExtraction[] | null>(null);

  // ─── Handlers saisie vocale (PREF-13) ──────────────────────────────────────

  const handleVoiceTranscript = useCallback(
    async (text: string) => {
      setRecorderVisible(false);
      if (!text.trim()) return; // pitfall 5 : ignore les transcriptions vides
      if (!config) {
        // Pas de config IA — fallback vers l'alerte standard
        Alert.alert(t('dietary.alert.aiDisabledTitle'), t('dietary.alert.aiDisabledMsg'));
        return;
      }
      try {
        const results = await extractDietaryConstraints(config, text, {
          profiles: profiles.map(p => ({ id: p.id, name: p.name })),
          guests: dietary.guests.map(g => ({ id: g.id, name: g.name })),
        });
        if (results.length === 0) {
          // D-15 : aucune extraction — informer sans crash, pas de toast retry
          Alert.alert(t('dietary.alert.noResultsTitle'), t('dietary.alert.noResultsMsg'));
          return;
        }
        setExtractions(results);
      } catch (e) {
        if (__DEV__) console.warn('extractDietaryConstraints failed', e);
        // D-15 : fallback gracieux — pas de toast retry, juste une alerte informative
        Alert.alert(t('dietary.alert.errorTitle'), t('dietary.alert.errorMsg'));
      }
    },
    [config, profiles, dietary.guests, t],
  );

  const handleConfirmVoiceExtractions = useCallback(
    async (confirmed: DietaryExtraction[]) => {
      setExtractions(null);
      for (const ex of confirmed) {
        if (!ex.profileId) continue;
        // Détermine si c'est un profil famille ou un invité
        const isFamily = profiles.some(p => p.id === ex.profileId);
        const categoryKey = ex.category === 'allergie'
          ? 'allergies'
          : ex.category === 'intolerance'
          ? 'intolerances'
          : ex.category === 'regime'
          ? 'regimes'
          : 'aversions';
        if (isFamily) {
          const profile = profiles.find(p => p.id === ex.profileId);
          if (!profile) continue;
          // Récupérer les items existants pour éviter les doublons
          const fieldMap: Record<string, string[]> = {
            allergies: profile.foodAllergies ?? [],
            intolerances: profile.foodIntolerances ?? [],
            regimes: profile.foodRegimes ?? [],
            aversions: profile.foodAversions ?? [],
          };
          const existing = fieldMap[categoryKey] ?? [];
          if (!existing.includes(ex.item)) {
            await updateFoodPreferences(
              ex.profileId,
              categoryKey as 'allergies' | 'intolerances' | 'regimes' | 'aversions',
              [...existing, ex.item],
            );
          }
        } else {
          const guest = dietary.guests.find(g => g.id === ex.profileId);
          if (!guest) continue;
          const guestFieldMap: Record<string, keyof GuestProfile> = {
            allergies: 'foodAllergies',
            intolerances: 'foodIntolerances',
            regimes: 'foodRegimes',
            aversions: 'foodAversions',
          };
          const field = guestFieldMap[categoryKey];
          const existing = (guest[field] as string[]) ?? [];
          if (!existing.includes(ex.item)) {
            await upsertGuest({ ...guest, [field]: [...existing, ex.item] });
          }
        }
      }
    },
    [profiles, dietary.guests, updateFoodPreferences, upsertGuest],
  );

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
      t('dietary.guestPrompt.title'),
      t('dietary.guestPrompt.message'),
      [
        { text: t('dietary.guestPrompt.cancel'), style: 'cancel' },
        {
          text: t('dietary.guestPrompt.confirm'),
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
  }, [upsertGuest, t]);

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
            label={t('dietary.back')}
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
          />
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            {t('dietary.title')}
          </Text>
          {/* Bouton micro — PREF-13 (D-13) : un seul bouton micro dans le header */}
          <TouchableOpacity
            style={styles.micButton}
            onPress={() => setRecorderVisible(true)}
            accessibilityLabel={t('dietary.voiceA11y')}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.micIcon}>🎤</Text>
          </TouchableOpacity>
        </View>

        {/* Section Membres de la famille */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {t('dietary.familySection')}
        </Text>

        <SectionErrorBoundary name={t('dietary.familySection')}>
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
          {t('dietary.guestsSection')}
        </Text>

        <SectionErrorBoundary name={t('dietary.guestsSection')}>
          {guests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.textFaint }]}>
                {t('dietary.guestsEmpty')}
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
            label={t('dietary.addGuest')}
            onPress={handleAddGuest}
            variant="secondary"
            icon="+"
            fullWidth
          />
        </SectionErrorBoundary>

        {/* Espace bas de page */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* DictaphoneRecorder — PREF-13 (D-13) : s'affiche à la demande du bouton micro */}
      {recorderVisible && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setRecorderVisible(false)}
        >
          <DictaphoneRecorder
            context={{ title: t('dietary.voiceTitle'), subtitle: t('dietary.voiceSubtitle') }}
            onResult={handleVoiceTranscript}
            onClose={() => setRecorderVisible(false)}
          />
        </Modal>
      )}

      {/* VoicePreviewModal — PREF-13 (D-14) : modale preview éditable, confirmation obligatoire */}
      <VoicePreviewModal
        visible={extractions !== null}
        extractions={extractions ?? []}
        profiles={profiles}
        guests={dietary.guests}
        onClose={() => setExtractions(null)}
        onConfirm={handleConfirmVoiceExtractions}
      />
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
  micButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: FontSize.title,
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
