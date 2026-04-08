/**
 * DashboardPhotos.tsx — Section photo du jour
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActionSheetIOS, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardPhotosInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
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
                t('dashboard.photos.accessDenied'),
                t('dashboard.photos.cameraAccessDenied'),
              );
              return;
            }
          } else {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert(
                t('dashboard.photos.accessDenied'),
                t('dashboard.photos.photoAccessDenied'),
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
          Alert.alert(t('dashboard.photos.error'), t('dashboard.photos.addError', { name: enfantName }));
        }
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [t('dashboard.photos.cancel'), t('dashboard.photos.camera'), t('dashboard.photos.gallery')],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) launchPicker(true);
            if (buttonIndex === 2) launchPicker(false);
          }
        );
      } else {
        Alert.alert(t('dashboard.photos.chooseSource'), t('dashboard.photos.chooseSourceMsg'), [
          { text: t('dashboard.photos.cancel'), style: 'cancel' },
          { text: t('dashboard.photos.camera'), onPress: () => launchPicker(true) },
          { text: t('dashboard.photos.gallery'), onPress: () => launchPicker(false) },
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
    <DashboardCard key="photos" title={t('dashboard.photos.title')} icon="📸" color={colors.catSouvenirs} tinted onPressMore={() => router.push('/(tabs)/photos')} hideMoreLink style={{ flex: 1, marginBottom: 0 }}>
      <View style={styles.avatarRow}>
        {photoStatus.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={styles.avatarItem}
            onPress={() => { if (!e.hasPhoto) { pickPhotoForEnfant(e.name); } else { router.push('/(tabs)/photos'); } }}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarEmoji}>{e.avatar}</Text>
            <Text style={styles.avatarStatus}>{e.hasPhoto ? '✅' : '📷'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </DashboardCard>
  );
}

export const DashboardPhotos = React.memo(DashboardPhotosInner);

const styles = StyleSheet.create({
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  avatarItem: {
    alignItems: 'center',
    gap: 2,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  avatarStatus: {
    fontSize: FontSize.caption,
  },
});
