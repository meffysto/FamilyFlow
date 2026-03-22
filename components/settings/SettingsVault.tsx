import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { VAULT_PATH_KEY } from '../../contexts/VaultContext';

interface SettingsVaultProps {
  vaultPath: string | null;
  onChangeVault: () => void;
}

export function SettingsVault({ vaultPath, onChangeVault }: SettingsVaultProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const handleDeleteData = useCallback(() => {
    Alert.alert(
      t('settings.vault.deleteTitle'),
      t('settings.vault.deleteMessage'),
      [
        { text: t('settings.vault.cancel'), style: 'cancel' },
        {
          text: t('settings.vault.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync(VAULT_PATH_KEY);
            await SecureStore.deleteItemAsync('ai_api_key');
            await SecureStore.deleteItemAsync('telegram_token');
            await SecureStore.deleteItemAsync('telegram_chat_id');
            await SecureStore.deleteItemAsync('auth_pin_hash');
            await SecureStore.deleteItemAsync('auth_enabled');
            await SecureStore.deleteItemAsync('zen_config_v1');
            await SecureStore.deleteItemAsync('active_profile_key');
            Alert.alert(t('settings.vault.deletedTitle'), t('settings.vault.deletedMsg'));
          },
        },
      ],
    );
  }, [t]);

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.vault.sectionA11y')}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.vault.sectionTitle')}</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.vault.pathLabel')}</Text>
        </View>
        <Text style={[styles.pathText, { color: colors.textSub, backgroundColor: colors.cardAlt }]} numberOfLines={3}>
          {vaultPath ?? t('settings.vault.notConfigured')}
        </Text>
        <Button label={t('settings.vault.changeVault')} onPress={onChangeVault} variant="secondary" size="sm" fullWidth />
        <View style={[styles.hint, { backgroundColor: colors.successBg }]}>
          <Text style={[styles.hintText, { color: colors.successText }]}>
            {t('settings.vault.compatHint')}
          </Text>
        </View>
        {Platform.OS === 'android' && (
          <View style={[styles.hint, { backgroundColor: colors.infoBg }]}>
            <Text style={[styles.hintText, { color: colors.info }]}>
              {t('settings.vault.syncHint')}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: Spacing['3xl'] }]}>{t('settings.vault.dataSectionTitle')}</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <View style={[styles.hint, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.hintText, { color: colors.warningText }]}>
            {t('settings.vault.deleteWarning')}
          </Text>
        </View>
        <Button label={t('settings.vault.deleteBtn')} onPress={handleDeleteData} variant="danger" size="sm" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  pathText: {
    fontSize: FontSize.label,
    fontFamily: 'Menlo',
    padding: Spacing.lg,
    borderRadius: Radius.md,
    lineHeight: 18,
  },
  hint: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
  },
  hintText: {
    fontSize: FontSize.caption,
    lineHeight: 17,
  },
});
