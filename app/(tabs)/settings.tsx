/**
 * settings.tsx — Écran de réglages
 *
 * Chaque section est un composant séparé dans components/settings/.
 */

import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useVault, VAULT_PATH_KEY } from '../../contexts/VaultContext';
import { VaultPicker } from '../../components/VaultPicker';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

import { SettingsVault } from '../../components/settings/SettingsVault';
import { SettingsTelegram } from '../../components/settings/SettingsTelegram';
import { SettingsGrandparents } from '../../components/settings/SettingsGrandparents';
import { SettingsNotificationsSection } from '../../components/settings/SettingsNotifications';
import { SettingsAppearance } from '../../components/settings/SettingsAppearance';
import { SettingsVacation } from '../../components/settings/SettingsVacation';
import { SettingsProfiles } from '../../components/settings/SettingsProfiles';
import { SettingsGamification } from '../../components/settings/SettingsGamification';
import { SettingsAI } from '../../components/settings/SettingsAI';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';

export default function SettingsScreen() {
  const {
    vaultPath, profiles, activeProfile, vault, setVaultPath, setActiveProfile,
    refresh, gamiData, notifPrefs, saveNotifPrefs, updateProfileTheme,
    updateProfile, memories, photoDates, getPhotoUri, vacationConfig,
    isVacationActive, activateVacation, deactivateVacation, addChild, convertToBorn,
  } = useVault();
  const { colors } = useThemeColors();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  // Load telegram settings on mount
  useState(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY);
      const chatId = await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY);
      if (token) setTelegramToken(token);
      if (chatId) setTelegramChatId(chatId);
    })();
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>⚙️ Réglages</Text>

        {!isChildMode && (
          <SettingsVault vaultPath={vaultPath} onChangeVault={() => setShowVaultPicker(true)} />
        )}
        {!isChildMode && (
          <SettingsTelegram
            telegramToken={telegramToken} telegramChatId={telegramChatId}
            setTelegramToken={setTelegramToken} setTelegramChatId={setTelegramChatId}
          />
        )}
        {!isChildMode && (
          <SettingsGrandparents
            telegramToken={telegramToken} profiles={profiles}
            memories={memories} photoDates={photoDates} getPhotoUri={getPhotoUri}
          />
        )}
        <SettingsNotificationsSection
          notifPrefs={notifPrefs} saveNotifPrefs={saveNotifPrefs}
          activeProfile={activeProfile} profiles={profiles}
        />
        <SettingsAppearance />
        {!isChildMode && (
          <SettingsVacation
            vacationConfig={vacationConfig} isVacationActive={isVacationActive}
            activateVacation={activateVacation} deactivateVacation={deactivateVacation}
          />
        )}
        <SettingsProfiles
          profiles={profiles} activeProfile={activeProfile}
          setActiveProfile={setActiveProfile} updateProfileTheme={updateProfileTheme}
          updateProfile={updateProfile} addChild={addChild} convertToBorn={convertToBorn}
        />
        <SettingsGamification vault={vault} gamiData={gamiData} refresh={refresh} />
        {!isChildMode && <SettingsAI />}

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>Family Vault v1.0.0</Text>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>Données locales · Pas de tracking · Open source</Text>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>🔒 Privacy-first · Offline-first</Text>
        </View>
      </ScrollView>

      {/* Vault Picker Modal */}
      <Modal visible={showVaultPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowVaultPicker(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader title="Changer de vault" onClose={() => setShowVaultPicker(false)} />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <VaultPicker
              currentPath={vaultPath}
              onPathSelected={async (path) => { await setVaultPath(path); setShowVaultPicker(false); }}
              onCancel={() => setShowVaultPicker(false)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], paddingBottom: Spacing['5xl'] + 8 },
  screenTitle: { fontSize: FontSize.display, fontWeight: FontWeight.heavy, marginBottom: Spacing['3xl'] },
  appInfo: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing['3xl'] },
  appInfoText: { fontSize: FontSize.caption, textAlign: 'center' },
  modalSafe: { flex: 1 },
  modalScroll: { flex: 1 },
  modalContent: { padding: Spacing['3xl'], gap: Spacing.xl },
});
