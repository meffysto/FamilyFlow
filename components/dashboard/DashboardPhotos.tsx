/**
 * DashboardPhotos.tsx — Section photo du jour
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActionSheetIOS, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardPhotosInner(_props: DashboardSectionProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { profiles, photoDates, addPhoto } = useVault();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const enfants = profiles.filter((p) => p.role === 'enfant');

  const pickPhotoForEnfant = useCallback(
    async (enfantName: string) => {
      const launchPicker = async (useCamera: boolean) => {
        try {
          if (useCamera) {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert(
                'Accès refusé',
                `L'application n'a pas accès à votre appareil photo.\n\nAllez dans Réglages > Expo Go > Appareil photo pour l'autoriser.`
              );
              return;
            }
          } else {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert(
                'Accès refusé',
                `L'application n'a pas accès à vos photos.\n\nAllez dans Réglages > Expo Go > Photos pour l'autoriser.`
              );
              return;
            }
          }

          const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: false,
          };

          const result = useCamera
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);

          if (result.canceled || !result.assets?.[0]?.uri) return;

          await addPhoto(enfantName, todayStr, result.assets[0].uri);
        } catch (e: any) {
          const msg = e?.message || String(e);
          Alert.alert('Erreur', `Impossible d'ajouter la photo pour ${enfantName}. Réessayez.`);
        }
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Annuler', '📷 Appareil photo', '🖼 Galerie'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) launchPicker(true);
            if (buttonIndex === 2) launchPicker(false);
          }
        );
      } else {
        Alert.alert('Photo du jour', 'Choisir une source', [
          { text: 'Annuler', style: 'cancel' },
          { text: '📷 Appareil photo', onPress: () => launchPicker(true) },
          { text: '🖼 Galerie', onPress: () => launchPicker(false) },
        ]);
      }
    },
    [addPhoto, todayStr]
  );

  if (enfants.length === 0) return null;

  const photoStatus = enfants.map((e) => ({
    ...e,
    hasPhoto: (photoDates[e.id] ?? []).includes(todayStr),
  }));

  return (
    <DashboardCard key="photos" title="Photo du jour" icon="📸" color="#06B6D4" onPressMore={() => router.push('/(tabs)/photos')}>
      {photoStatus.map((e) => (
        <TouchableOpacity
          key={e.id}
          style={styles.photoStatusRow}
          onPress={() => { if (!e.hasPhoto) { pickPhotoForEnfant(e.name); } else { router.push('/(tabs)/photos'); } }}
          activeOpacity={0.7}
        >
          <Text style={styles.photoStatusEmoji}>{e.avatar}</Text>
          <View style={styles.photoStatusInfo}>
            <Text style={[styles.photoStatusName, { color: colors.text }]}>{e.name}</Text>
            {!e.hasPhoto && <Text style={[styles.photoStatusHint, { color: colors.textMuted }]}>Appuyer pour ajouter une photo</Text>}
          </View>
          <Text style={styles.photoStatusIcon}>{e.hasPhoto ? '✅' : '📷'}</Text>
        </TouchableOpacity>
      ))}
    </DashboardCard>
  );
}

export const DashboardPhotos = React.memo(DashboardPhotosInner);

const styles = StyleSheet.create({
  photoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  photoStatusEmoji: {
    fontSize: FontSize.title,
  },
  photoStatusInfo: {
    flex: 1,
    gap: 1,
  },
  photoStatusName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  photoStatusHint: {
    fontSize: FontSize.label,
  },
  photoStatusIcon: {
    fontSize: FontSize.title,
  },
});
