/**
 * settings.tsx — Écran de réglages (index navigable)
 *
 * Organisé en 4 catégories : Mon compte, Expérience, Connexions, Avancé.
 * Chaque ligne ouvre un modal pageSheet avec le composant existant.
 */

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ScrollView, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { useVault, VAULT_PATH_KEY } from '../../contexts/VaultContext';
import { VaultPicker } from '../../components/VaultPicker';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Spacing, Layout } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';
import { calculateLevel, levelProgress, xpForLevel } from '../../lib/gamification';
import { useToast } from '../../contexts/ToastContext';
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
import { SettingsGamiAdmin, HarvestCardTest } from '../../components/settings/SettingsGamiAdmin';
import { SettingsCoupling } from '../../components/settings/SettingsCoupling';
import { SettingsElevenLabs } from '../../components/settings/SettingsElevenLabs';
import { SettingsFishAudio } from '../../components/settings/SettingsFishAudio';
import { useStoryVoice } from '../../contexts/StoryVoiceContext';
import { useTranslation } from 'react-i18next';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';
const ZEN_CONFIG_KEY = 'zen_config_v1';

type SectionId =
  | 'profiles' | 'appearance'
  | 'notifications' | 'zen' | 'vacation' | 'gamification' | 'coupling' | 'automations'
  | 'ai' | 'elevenlabs' | 'fish-audio' | 'telegram' | 'grandparents'
  | 'auth' | 'parental' | 'vault' | 'help'
  | 'gami-admin' | 'harvest-test';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    vaultPath, profiles, activeProfile, vault, setVaultPath, setActiveProfile,
    refresh, gamiData, notifPrefs, saveNotifPrefs, updateProfileTheme,
    updateProfile, deleteProfile, memories, photoDates, getPhotoUri, vacationConfig,
    isVacationActive, activateVacation, deactivateVacation, addChild, convertToBorn,
    tasks, rdvs, stock,
  } = useVault();
  const { primary, colors, darkModePreference, isDark } = useThemeColors();

  // Scroll handler pour collapse du ScreenHeader
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { showRewardCard, showHarvestCard } = useToast();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const darkModeLabel = darkModePreference === 'auto' ? t('settingsScreen.labels.auto')
    : darkModePreference === 'dark' ? t('settingsScreen.labels.dark') : t('settingsScreen.labels.light');

  const activeNotifCount = notifPrefs.notifications.filter((n) => n.enabled).length;

  const level = activeProfile ? calculateLevel(activeProfile.points ?? 0) : 0;

  const vaultShort = vaultPath
    ? '.../' + vaultPath.split('/').slice(-2).join('/')
    : t('settingsScreen.labels.notConfigured');

  const telegramStatus = telegramToken ? t('settingsScreen.labels.connected') : t('settingsScreen.labels.notConfigured');

  const { isConfigured: aiConfigured, model: aiModel } = useAI();
  const { isElevenLabsConfigured, isFishAudioConfigured } = useStoryVoice();
  const { isAuthEnabled: authEnabled, biometryType } = useAuth();
  const authSubtitle = authEnabled
    ? (biometryType === 'face' ? t('settingsScreen.rows.authEnabledFace') : biometryType === 'fingerprint' ? t('settingsScreen.rows.authEnabledTouch') : t('settingsScreen.rows.authEnabled'))
    : t('settingsScreen.labels.disabled');

  // Titre du modal selon la section active
  const sectionTitles: Record<SectionId, string> = {
    profiles: t('settingsScreen.modalTitles.profiles'),
    appearance: t('settingsScreen.modalTitles.appearance'),
    notifications: t('settingsScreen.modalTitles.notifications'),
    zen: t('settingsScreen.modalTitles.zen'),
    vacation: t('settingsScreen.modalTitles.vacation'),
    gamification: t('settingsScreen.modalTitles.gamification'),
    coupling: t('settingsScreen.modalTitles.coupling'),
    automations: t('settingsScreen.modalTitles.automations'),
    ai: t('settingsScreen.modalTitles.ai'),
    elevenlabs: 'ElevenLabs',
    'fish-audio': 'Fish Audio',
    telegram: t('settingsScreen.modalTitles.telegram'),
    grandparents: t('settingsScreen.modalTitles.grandparents'),
    auth: t('settingsScreen.modalTitles.auth'),
    parental: t('settingsScreen.modalTitles.parental'),
    vault: t('settingsScreen.modalTitles.vault'),
    help: t('settingsScreen.modalTitles.help'),
    'gami-admin': 'Admin Gamification',
    'harvest-test': 'Tester Harvest Card',
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader title={t('settingsScreen.title')} scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
      >
        {/* ── MON COMPTE ── */}
        <SettingsSectionHeader label={t('settingsScreen.sections.myAccount')} />
        <SettingsRow
          emoji="👤"
          title={t('settingsScreen.rows.profiles')}
          subtitle={activeProfile ? `${activeProfile.avatar} ${activeProfile.name} · ${t('settingsScreen.subtitles.profileCount', { count: profiles.length })}` : t('settingsScreen.subtitles.profileCount', { count: profiles.length })}
          onPress={() => setActiveSection('profiles')}
          isFirst
        />
        <SettingsRow
          emoji="🎨"
          title={t('settingsScreen.rows.appearance')}
          subtitle={darkModeLabel}
          onPress={() => setActiveSection('appearance')}
          isLast
        />

        {/* ── EXPÉRIENCE ── */}
        <SettingsSectionHeader label={t('settingsScreen.sections.experience')} />
        <SettingsRow
          emoji="🔔"
          title={t('settingsScreen.rows.notifications')}
          subtitle={t('settingsScreen.subtitles.notifActive', { count: activeNotifCount })}
          onPress={() => setActiveSection('notifications')}
          isFirst
        />
        {!isChildMode && (
          <SettingsRow
            emoji="🧘"
            title={t('settingsScreen.rows.zen')}
            subtitle={zenConfig.enabled ? t('settingsScreen.labels.enabled') : t('settingsScreen.labels.disabled')}
            onPress={() => setActiveSection('zen')}
          />
        )}
        {!isChildMode && (
          <SettingsRow
            emoji="☀️"
            title={t('settingsScreen.rows.vacation')}
            subtitle={isVacationActive ? t('settingsScreen.subtitles.vacationActive', { date: vacationConfig?.endDate ?? '' }) : t('settingsScreen.labels.inactive')}
            onPress={() => setActiveSection('vacation')}
          />
        )}
        <SettingsRow
          emoji="🏆"
          title={t('settingsScreen.rows.gamification')}
          subtitle={activeProfile ? t('settingsScreen.subtitles.gamificationLevel', { level, xp: activeProfile.points ?? 0 }) : undefined}
          onPress={() => setActiveSection('gamification')}
          isLast={isChildMode}
        />
        {!isChildMode && (
          <SettingsRow
            emoji="🔗"
            title={t('settingsScreen.rows.coupling')}
            subtitle={t('settingsScreen.rows.couplingSubtitle')}
            onPress={() => setActiveSection('coupling')}
          />
        )}
        {!isChildMode && (
          <SettingsRow
            emoji="⚙️"
            title={t('settingsScreen.rows.automations')}
            subtitle={t('settingsScreen.rows.automationsSubtitle')}
            onPress={() => setActiveSection('automations')}
            isLast
          />
        )}

        {/* ── CONNEXIONS (adultes) ── */}
        {!isChildMode && (
          <>
            <SettingsSectionHeader label={t('settingsScreen.sections.connections')} />
            <SettingsRow
              emoji="🤖"
              title={t('settingsScreen.rows.ai')}
              subtitle={aiConfigured ? t('settingsScreen.rows.aiConfigured', { model: aiModel }) : t('settingsScreen.rows.aiNotConfigured')}
              onPress={() => setActiveSection('ai')}
              isFirst
            />
            <SettingsRow
              emoji="🎙️"
              title="ElevenLabs"
              subtitle={isElevenLabsConfigured ? 'Voix premium configurée ✓' : 'Voix premium pour les histoires'}
              onPress={() => setActiveSection('elevenlabs')}
            />
            <SettingsRow
              emoji="🐟"
              title="Fish Audio"
              subtitle={isFishAudioConfigured ? 'Fish Audio configuré ✓' : 'TTS + clonage vocal'}
              onPress={() => setActiveSection('fish-audio')}
            />
            <SettingsRow
              emoji="📲"
              title={t('settingsScreen.rows.telegram')}
              subtitle={telegramStatus}
              onPress={() => setActiveSection('telegram')}
            />
            <SettingsRow
              emoji="👴"
              title={t('settingsScreen.rows.grandparents')}
              subtitle={t('settingsScreen.rows.grandparentsSubtitle')}
              onPress={() => setActiveSection('grandparents')}
              isLast
            />
          </>
        )}

        {/* ── AVANCÉ (adultes) ── */}
        {!isChildMode && (
          <>
            <SettingsSectionHeader label={t('settingsScreen.sections.advanced')} />
            <SettingsRow
              emoji="🛡️"
              title={t('settingsScreen.rows.auth')}
              subtitle={authSubtitle}
              onPress={() => setActiveSection('auth')}
              isFirst
            />
            <SettingsRow
              emoji="🔒"
              title={t('settingsScreen.rows.parental')}
              subtitle={t('settingsScreen.rows.parentalSubtitle')}
              onPress={() => setActiveSection('parental')}
            />
            <SettingsRow
              emoji="📂"
              title={t('settingsScreen.rows.vault')}
              subtitle={vaultShort}
              onPress={() => setActiveSection('vault')}
            />
            <SettingsRow
              emoji="💡"
              title={t('settingsScreen.rows.help')}
              subtitle={t('settingsScreen.rows.helpSubtitle')}
              onPress={() => setActiveSection('help')}
              isLast
            />
          </>
        )}

        {/* Admin caché — tap 5x sur la version */}
        {adminUnlocked && !isChildMode && (
          <>
            <SettingsSectionHeader label="Debug" />
            <SettingsRow
              emoji="🛠️"
              title="Admin Gamification"
              subtitle="Modifier les données brutes"
              onPress={() => setActiveSection('gami-admin')}
              isFirst
            />
            <SettingsRow
              emoji="🔄"
              title="Revoir l'onboarding complet"
              subtitle="Efface les réponses et relance depuis le début"
              onPress={async () => {
                await SecureStore.deleteItemAsync('onboarding_questionnaire_done');
                await SecureStore.deleteItemAsync('onboarding_pains');
                await SecureStore.deleteItemAsync('onboarding_sections');
                router.replace('/onboarding' as any);
              }}
            />
            <SettingsRow
              emoji="⚙️"
              title="Revoir la config vault"
              subtitle="Wizard parents / enfants / templates"
              onPress={() => router.replace('/setup' as any)}
            />
            <SettingsRow
              emoji="🎁"
              title="Tester Reward Card"
              subtitle="Déclenche le toast de validation de tâche"
              onPress={() => {
                const pts = activeProfile?.points ?? 420;
                const lvl = calculateLevel(pts);
                const prog = levelProgress(pts);
                const nextXP = xpForLevel(lvl);
                showRewardCard({
                  profileEmoji: activeProfile?.avatar ?? '🧑',
                  profileName: activeProfile?.name ?? 'Profil test',
                  taskTitle: 'Ranger la cuisine',
                  xpGained: 15,
                  currentXP: pts,
                  levelProgress: prog,
                  level: lvl,
                  xpForNextLevel: nextXP,
                  hasLoot: true,
                });
              }}
            />
            <SettingsRow
              emoji="🌾"
              title="Tester Harvest Card"
              subtitle="Accumulation, grades, wager, combo"
              onPress={() => setActiveSection('harvest-test')}
              isLast
            />
          </>
        )}

        {/* App info */}
        <TouchableOpacity
          style={styles.appInfo}
          activeOpacity={0.8}
          onPress={() => {
            tapCountRef.current += 1;
            if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
            if (tapCountRef.current >= 5) {
              tapCountRef.current = 0;
              setAdminUnlocked(prev => !prev);
            } else {
              tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
            }
          }}
        >
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>{t('settingsScreen.appInfo.line1')}</Text>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>{t('settingsScreen.appInfo.line2')}</Text>
          <Text style={[styles.appInfoText, { color: colors.textFaint }]}>Privacy-first · Offline-first</Text>
        </TouchableOpacity>
      </Animated.ScrollView>

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
            {activeSection === 'coupling' && <SettingsCoupling />}
            {activeSection === 'automations' && <SettingsAutomations />}
            {activeSection === 'ai' && <SettingsAI />}
            {activeSection === 'elevenlabs' && <SettingsElevenLabs />}
            {activeSection === 'fish-audio' && <SettingsFishAudio />}
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
            {activeSection === 'gami-admin' && (
              <SettingsGamiAdmin vault={vault} profiles={profiles} gamiData={gamiData} refresh={refresh} />
            )}
            {activeSection === 'harvest-test' && <HarvestCardTest />}
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
  content: { padding: Spacing['2xl'], paddingTop: Spacing.md, paddingBottom: 90 },
  appInfo: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing['3xl'] },
  appInfoText: { fontSize: FontSize.caption, textAlign: 'center' },
  modalSafe: { flex: 1 },
  modalContent: { padding: Spacing['2xl'], paddingBottom: Spacing['5xl'] },
});
