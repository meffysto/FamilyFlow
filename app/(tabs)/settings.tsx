/**
 * settings.tsx — Écran de réglages (index navigable)
 *
 * Organisé en 4 catégories : Mon compte, Expérience, Connexions, Avancé.
 * Chaque ligne ouvre un modal pageSheet avec le composant existant.
 */

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useVault, VAULT_PATH_KEY } from '../../contexts/VaultContext';
import { VaultPicker } from '../../components/VaultPicker';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { calculateLevel } from '../../lib/gamification';
import { useAI } from '../../contexts/AIContext';

import { SettingsRow, SettingsSectionHeader } from '../../components/settings/SettingsRow';
import { SettingsVault } from '../../components/settings/SettingsVault';
import { SettingsTelegram } from '../../components/settings/SettingsTelegram';
import { SettingsGrandparents } from '../../components/settings/SettingsGrandparents';
import { SettingsNotificationsSection } from '../../components/settings/SettingsNotifications';
import { SettingsAppearance } from '../../components/settings/SettingsAppearance';
import { SettingsVacation } from '../../components/settings/SettingsVacation';
import { SettingsProfiles } from '../../components/settings/SettingsProfiles';
import { SettingsGamification } from '../../components/settings/SettingsGamification';
import { SettingsAI } from '../../components/settings/SettingsAI';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsParentalControls } from '../../components/settings/SettingsParentalControls';
import { SettingsHelp } from '../../components/settings/SettingsHelp';
import { SettingsZen, ZenConfig, DEFAULT_ZEN_CONFIG } from '../../components/settings/SettingsZen';
import { SettingsAuth } from '../../components/settings/SettingsAuth';
import { SettingsAutomations } from '../../components/settings/SettingsAutomations';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';
const ZEN_CONFIG_KEY = 'zen_config_v1';

type SectionId =
  | 'profiles' | 'appearance'
  | 'notifications' | 'zen' | 'vacation' | 'gamification' | 'automations'
  | 'ai' | 'telegram' | 'grandparents'
  | 'auth' | 'parental' | 'vault' | 'help';

export default function SettingsScreen() {
  const {
    vaultPath, profiles, activeProfile, vault, setVaultPath, setActiveProfile,
    refresh, gamiData, notifPrefs, saveNotifPrefs, updateProfileTheme,
    updateProfile, deleteProfile, memories, photoDates, getPhotoUri, vacationConfig,
    isVacationActive, activateVacation, deactivateVacation, addChild, convertToBorn,
    tasks, rdvs, stock,
  } = useVault();
  const { colors, darkModePreference } = useThemeColors();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [zenConfig, setZenConfig] = useState<ZenConfig>(DEFAULT_ZEN_CONFIG);

  // Load telegram + zen settings on mount
  useState(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY);
      const chatId = await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY);
      if (token) setTelegramToken(token);
      if (chatId) setTelegramChatId(chatId);

      const zenRaw = await SecureStore.getItemAsync(ZEN_CONFIG_KEY);
      if (zenRaw) {
        try { setZenConfig(JSON.parse(zenRaw)); } catch { /* ignore */ }
      }
    })();
  });

  const closeSection = useCallback(() => setActiveSection(null), []);

  // Sous-titres dynamiques
  const darkModeLabel = darkModePreference === 'auto' ? 'Automatique'
    : darkModePreference === 'dark' ? 'Sombre' : 'Clair';

  const activeNotifCount = notifPrefs.notifications.filter((n) => n.enabled).length;

  const level = activeProfile ? calculateLevel(activeProfile.points ?? 0) : 0;

  const vaultShort = vaultPath
    ? '.../' + vaultPath.split('/').slice(-2).join('/')
    : 'Non configuré';

  const telegramStatus = telegramToken ? 'Connecté' : 'Non configuré';

  const { isConfigured: aiConfigured, model: aiModel } = useAI();
  const { isAuthEnabled: authEnabled, biometryType } = useAuth();
  const authSubtitle = authEnabled
    ? `Activé${biometryType === 'face' ? ' · Face ID' : biometryType === 'fingerprint' ? ' · Touch ID' : ''}`
    : 'Désactivé';

  // Titre du modal selon la section active
  const sectionTitles: Record<SectionId, string> = {
    profiles: 'Profils famille',
    appearance: 'Apparence',
    notifications: 'Notifications',
    zen: 'Mode zen',
    vacation: 'Vacances',
    gamification: 'Gamification',
    automations: 'Automatisations',
    ai: 'Intelligence artificielle',
    telegram: 'Telegram',
    grandparents: 'Grands-parents',
    auth: 'Sécurité',
    parental: 'Contrôle parental',
    vault: 'Vault Obsidian',
    help: 'Aide et découverte',
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Réglages</Text>

        {/* ── MON COMPTE ── */}
        <SettingsSectionHeader label="Mon compte" />
        <SettingsRow
          emoji="👤"
          title="Profils famille"
          subtitle={activeProfile ? `${activeProfile.avatar} ${activeProfile.name} · ${profiles.length} profil${profiles.length > 1 ? 's' : ''}` : `${profiles.length} profil${profiles.length > 1 ? 's' : ''}`}
          onPress={() => setActiveSection('profiles')}
          isFirst
        />
        <SettingsRow
          emoji="🎨"
          title="Apparence"
          subtitle={darkModeLabel}
          onPress={() => setActiveSection('appearance')}
          isLast
        />

        {/* ── EXPÉRIENCE ── */}
        <SettingsSectionHeader label="Expérience" />
        <SettingsRow
          emoji="🔔"
          title="Notifications"
          subtitle={`${activeNotifCount} active${activeNotifCount > 1 ? 's' : ''}`}
          onPress={() => setActiveSection('notifications')}
          isFirst
        />
        {!isChildMode && (
          <SettingsRow
            emoji="🧘"
            title="Mode zen"
            subtitle={zenConfig.enabled ? 'Activé' : 'Désactivé'}
            onPress={() => setActiveSection('zen')}
          />
        )}
        {!isChildMode && (
          <SettingsRow
            emoji="☀️"
            title="Vacances"
            subtitle={isVacationActive ? `Actif jusqu'au ${vacationConfig?.endDate ?? ''}` : 'Inactif'}
            onPress={() => setActiveSection('vacation')}
          />
        )}
        <SettingsRow
          emoji="🏆"
          title="Gamification"
          subtitle={activeProfile ? `Niveau ${level} · ${activeProfile.points ?? 0} XP` : undefined}
          onPress={() => setActiveSection('gamification')}
          isLast={isChildMode}
        />
        {!isChildMode && (
          <SettingsRow
            emoji="⚙️"
            title="Automatisations"
            subtitle="Recettes → Courses → Stock"
            onPress={() => setActiveSection('automations')}
            isLast
          />
        )}

        {/* ── CONNEXIONS (adultes) ── */}
        {!isChildMode && (
          <>
            <SettingsSectionHeader label="Connexions" />
            <SettingsRow
              emoji="🤖"
              title="Intelligence artificielle"
              subtitle={aiConfigured ? `Configurée · ${aiModel}` : 'Non configurée'}
              onPress={() => setActiveSection('ai')}
              isFirst
            />
            <SettingsRow
              emoji="📲"
              title="Telegram"
              subtitle={telegramStatus}
              onPress={() => setActiveSection('telegram')}
            />
            <SettingsRow
              emoji="👴"
              title="Grands-parents"
              subtitle="Telegram, WhatsApp, iMessage"
              onPress={() => setActiveSection('grandparents')}
              isLast
            />
          </>
        )}

        {/* ── AVANCÉ (adultes) ── */}
        {!isChildMode && (
          <>
            <SettingsSectionHeader label="Avancé" />
            <SettingsRow
              emoji="🛡️"
              title="Sécurité"
              subtitle={authSubtitle}
              onPress={() => setActiveSection('auth')}
              isFirst
            />
            <SettingsRow
              emoji="🔒"
              title="Contrôle parental"
              subtitle="Visibilité données enfants"
              onPress={() => setActiveSection('parental')}
            />
            <SettingsRow
              emoji="📂"
              title="Vault Obsidian"
              subtitle={vaultShort}
              onPress={() => setActiveSection('vault')}
            />
            <SettingsRow
              emoji="💡"
              title="Aide et découverte"
              subtitle="Guide, astuces, modèles"
              onPress={() => setActiveSection('help')}
              isLast
            />
          </>
        )}

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>Family Flow v1.0.0</Text>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>Données locales · Pas de tracking</Text>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>Privacy-first · Offline-first</Text>
        </View>
      </ScrollView>

      {/* ── Modal unique pour le contenu de la section active ── */}
      <Modal
        visible={!!activeSection}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSection}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.bg }]}>
          <ModalHeader
            title={activeSection ? sectionTitles[activeSection] : ''}
            onClose={closeSection}
          />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {activeSection === 'profiles' && (
              <SettingsProfiles
                profiles={profiles} activeProfile={activeProfile}
                setActiveProfile={setActiveProfile} updateProfileTheme={updateProfileTheme}
                updateProfile={updateProfile} deleteProfile={deleteProfile}
                addChild={addChild} convertToBorn={convertToBorn}
              />
            )}
            {activeSection === 'appearance' && <SettingsAppearance />}
            {activeSection === 'notifications' && (
              <SettingsNotificationsSection
                notifPrefs={notifPrefs} saveNotifPrefs={saveNotifPrefs}
                activeProfile={activeProfile} profiles={profiles}
                notifData={{ rdvs, tasks, stock, hasGrossesse: profiles.some(p => p.statut === 'grossesse' && p.dateTerme) }}
              />
            )}
            {activeSection === 'zen' && (
              <SettingsZen
                zenConfig={zenConfig}
                onSave={async (config) => {
                  setZenConfig(config);
                  await SecureStore.setItemAsync(ZEN_CONFIG_KEY, JSON.stringify(config));
                }}
              />
            )}
            {activeSection === 'vacation' && (
              <SettingsVacation
                vacationConfig={vacationConfig} isVacationActive={isVacationActive}
                activateVacation={activateVacation} deactivateVacation={deactivateVacation}
              />
            )}
            {activeSection === 'gamification' && (
              <SettingsGamification vault={vault} gamiData={gamiData} refresh={refresh} />
            )}
            {activeSection === 'automations' && <SettingsAutomations />}
            {activeSection === 'ai' && <SettingsAI />}
            {activeSection === 'telegram' && (
              <SettingsTelegram
                telegramToken={telegramToken} telegramChatId={telegramChatId}
                setTelegramToken={setTelegramToken} setTelegramChatId={setTelegramChatId}
              />
            )}
            {activeSection === 'grandparents' && (
              <SettingsGrandparents
                telegramToken={telegramToken} profiles={profiles}
                memories={memories} photoDates={photoDates} getPhotoUri={getPhotoUri}
              />
            )}
            {activeSection === 'auth' && <SettingsAuth />}
            {activeSection === 'parental' && <SettingsParentalControls />}
            {activeSection === 'vault' && (
              <SettingsVault vaultPath={vaultPath} onChangeVault={() => {
                closeSection();
                setTimeout(() => setShowVaultPicker(true), 400);
              }} />
            )}
            {activeSection === 'help' && <SettingsHelp />}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Vault Picker Modal */}
      <Modal visible={showVaultPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowVaultPicker(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader title="Changer de vault" onClose={() => setShowVaultPicker(false)} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.modalContent}>
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
  content: { padding: Spacing['2xl'], paddingBottom: 90 },
  screenTitle: { fontSize: FontSize.display, fontWeight: FontWeight.heavy },
  appInfo: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing['3xl'] },
  appInfoText: { fontSize: FontSize.caption, textAlign: 'center' },
  modalSafe: { flex: 1 },
  modalContent: { padding: Spacing['2xl'], paddingBottom: Spacing['5xl'] },
});
