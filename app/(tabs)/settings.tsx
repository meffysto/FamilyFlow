/**
 * settings.tsx — Settings screen
 *
 * - Vault path (show + change via VaultPicker)
 * - Telegram Bot Token + Chat ID + test button
 * - Family profiles list (from famille.md)
 * - Reset gamification (with confirmation)
 * - App info
 */

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useVault, VAULT_PATH_KEY } from '../../hooks/useVault';
import { VaultPicker } from '../../components/VaultPicker';
import { NotificationSettings } from '../../components/NotificationSettings';
import { testTelegram } from '../../lib/telegram';
import { serializeGamification } from '../../lib/parser';
import { RARITY_LABELS } from '../../constants/rewards';
import { THEME_LIST, getTheme } from '../../constants/themes';
import { useThemeColors } from '../../contexts/ThemeContext';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';

export default function SettingsScreen() {
  const { vaultPath, profiles, activeProfile, vault, setVaultPath, setActiveProfile, refresh, gamiData, notifPrefs, saveNotifPrefs, updateProfileTheme } = useVault();
  const { primary, tint, setThemeId } = useThemeColors();

  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownAnim = useRef(new Animated.Value(0)).current;

  // Load telegram settings on mount
  useState(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY);
      const chatId = await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY);
      if (token) setTelegramToken(token);
      if (chatId) setTelegramChatId(chatId);
    })();
  });

  const handleSaveTelegram = useCallback(async () => {
    setIsSavingTelegram(true);
    await SecureStore.setItemAsync(TELEGRAM_TOKEN_KEY, telegramToken.trim());
    await SecureStore.setItemAsync(TELEGRAM_CHAT_KEY, telegramChatId.trim());
    setIsSavingTelegram(false);
    setShowTelegramSetup(false);
    Alert.alert('✅ Sauvegardé', 'Les paramètres Telegram ont été sauvegardés.');
  }, [telegramToken, telegramChatId]);

  const handleTestTelegram = useCallback(async () => {
    if (!telegramToken || !telegramChatId) {
      Alert.alert('Paramètres manquants', 'Entrez le token et le chat ID d\'abord.');
      return;
    }
    setIsTesting(true);
    const ok = await testTelegram(telegramToken.trim(), telegramChatId.trim());
    setIsTesting(false);
    if (ok) {
      Alert.alert('✅ Succès !', 'Message Telegram envoyé avec succès.');
    } else {
      Alert.alert('❌ Échec', 'Impossible d\'envoyer le message. Vérifiez le token et le chat ID.');
    }
  }, [telegramToken, telegramChatId]);

  const toggleThemeDropdown = useCallback(() => {
    const toValue = themeDropdownOpen ? 0 : 1;
    setThemeDropdownOpen(!themeDropdownOpen);
    Animated.timing(themeDropdownAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [themeDropdownOpen, themeDropdownAnim]);

  const handleResetGamification = useCallback(() => {
    Alert.alert(
      '⚠️ Réinitialiser la gamification',
      'Tous les points, niveaux, streaks et loot boxes seront remis à zéro. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            if (!vault || !gamiData) return;
            const resetData = {
              profiles: gamiData.profiles.map((p) => ({
                ...p,
                points: 0,
                level: 1,
                streak: 0,
                lootBoxesAvailable: 0,
                multiplier: 1,
                multiplierRemaining: 0,
                pityCounter: 0,
              })),
              history: [],
              activeRewards: [],
            };
            await vault.writeFile('gamification.md', serializeGamification(resetData));
            await refresh();
            Alert.alert('✅', 'Gamification réinitialisée.');
          },
        },
      ]
    );
  }, [vault, gamiData, refresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>⚙️ Réglages</Text>

        {/* Vault path */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vault Obsidian</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>📁 Chemin</Text>
            </View>
            <Text style={styles.pathText} numberOfLines={3}>
              {vaultPath ?? 'Non configuré'}
            </Text>
            <TouchableOpacity
              style={[styles.changeBtn, { backgroundColor: tint }]}
              onPress={() => setShowVaultPicker(true)}
            >
              <Text style={[styles.changeBtnText, { color: primary }]}>Changer le vault</Text>
            </TouchableOpacity>

            <View style={styles.obsidianHint}>
              <Text style={styles.obsidianHintText}>
                ✅ Les données sont stockées en fichiers .md standard, compatibles avec Obsidian.
              </Text>
            </View>
          </View>
        </View>

        {/* Telegram */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Telegram</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>📱 Bot Telegram</Text>
              <Text style={styles.rowStatus}>
                {telegramToken ? '🟢 Configuré' : '🔴 Non configuré'}
              </Text>
            </View>
            {telegramToken ? (
              <Text style={styles.tokenHint}>
                Token : {telegramToken.slice(0, 10)}...
              </Text>
            ) : null}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: primary }]}
                onPress={() => setShowTelegramSetup(true)}
              >
                <Text style={[styles.secondaryBtnText, { color: primary }]}>Configurer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: primary }, isTesting && styles.btnDisabled]}
                onPress={handleTestTelegram}
                disabled={isTesting}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <Text style={[styles.secondaryBtnText, { color: primary }]}>Tester</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>🔔 Notifications Telegram</Text>
              <Text style={styles.rowStatus}>
                {notifPrefs.notifications.filter((n) => n.enabled).length}/{notifPrefs.notifications.length} actives
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.changeBtn, { backgroundColor: tint }]}
              onPress={() => setShowNotifSettings(true)}
            >
              <Text style={[styles.changeBtnText, { color: primary }]}>Configurer les notifications</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon profil</Text>
          <View style={styles.card}>
            {activeProfile ? (
              <View style={styles.activeProfileRow}>
                <Text style={styles.activeAvatar}>{activeProfile.avatar}</Text>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{activeProfile.name}</Text>
                  <Text style={styles.profileMeta}>
                    {activeProfile.role === 'adulte' ? '👤 Adulte' : '👶 Enfant'} · Niv. {activeProfile.level} · {activeProfile.points} pts
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>Aucun profil sélectionné</Text>
            )}
            <View style={styles.profileSwitcher}>
              {profiles.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.switchBtn,
                    activeProfile?.id === p.id && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => setActiveProfile(p.id)}
                >
                  <Text style={styles.switchAvatar}>{p.avatar}</Text>
                  <Text style={[
                    styles.switchName,
                    activeProfile?.id === p.id && { color: primary },
                  ]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Family profiles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profils famille</Text>
          <View style={styles.card}>
            {profiles.length === 0 ? (
              <Text style={styles.emptyText}>Aucun profil trouvé dans famille.md</Text>
            ) : (
              profiles.map((profile) => {
                const currentTheme = getTheme(profile.theme);
                return (
                  <View key={profile.id} style={styles.profileBlock}>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileAvatar}>{profile.avatar}</Text>
                      <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{profile.name}</Text>
                        <Text style={styles.profileMeta}>
                          {profile.role} · Niv. {profile.level} · {profile.points} pts
                        </Text>
                      </View>
                      {profile.lootBoxesAvailable > 0 && (
                        <Text style={styles.profileLoot}>🎁 ×{profile.lootBoxesAvailable}</Text>
                      )}
                    </View>
                    {/* Theme picker dropdown — only for active profile */}
                    {activeProfile?.id === profile.id && (
                    <View style={styles.themeSection}>
                      <TouchableOpacity
                        style={[styles.themeDropdownBtn, { borderColor: primary }]}
                        onPress={toggleThemeDropdown}
                        activeOpacity={0.7}
                      >
                        <View style={styles.themeDropdownLeft}>
                          <View style={[styles.themePreviewDot, { backgroundColor: currentTheme.primary }]} />
                          <Text style={styles.themeDropdownLabel}>
                            {currentTheme.emoji} {currentTheme.label}
                          </Text>
                        </View>
                        <Text style={[styles.themeDropdownArrow, { color: primary }]}>
                          {themeDropdownOpen ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>
                      {themeDropdownOpen && (
                        <Animated.View style={[styles.themeDropdownList, {
                          opacity: themeDropdownAnim,
                        }]}>
                          {THEME_LIST.map((t) => {
                            const isActive = currentTheme.id === t.id;
                            return (
                              <TouchableOpacity
                                key={t.id}
                                style={[
                                  styles.themeDropdownItem,
                                  isActive && { backgroundColor: tint },
                                ]}
                                onPress={() => {
                                  updateProfileTheme(profile.id, t.id);
                                  setThemeId(t.id);
                                  toggleThemeDropdown();
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.themePreviewDot, { backgroundColor: t.primary }]} />
                                <Text style={styles.themeDropdownItemEmoji}>{t.emoji}</Text>
                                <Text style={[
                                  styles.themeDropdownItemLabel,
                                  isActive && { color: primary, fontWeight: '700' },
                                ]}>
                                  {t.label}
                                </Text>
                                {isActive && <Text style={[styles.themeCheckmark, { color: primary }]}>✓</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </Animated.View>
                      )}
                    </View>
                    )}
                  </View>
                );
              })
            )}
            <Text style={styles.profileHint}>
              Éditez famille.md dans votre vault pour modifier les profils.
            </Text>
          </View>
        </View>

        {/* Gamification reset */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gamification</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>Statistiques globales</Text>
            {gamiData && (
              <View style={styles.gamiStats}>
                <Text style={styles.statText}>
                  Total tâches complétées : {gamiData.history.filter((h) => h.action.startsWith('+')).length}
                </Text>
                <Text style={styles.statText}>
                  Total loot boxes ouvertes : {gamiData.history.filter((h) => h.action.startsWith('loot:')).length}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.dangerBtn} onPress={handleResetGamification}>
              <Text style={styles.dangerBtnText}>🗑️ Réinitialiser la gamification</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Family Vault v1.0.0</Text>
          <Text style={styles.appInfoText}>Données locales · Pas de tracking · Open source</Text>
          <Text style={styles.appInfoText}>🔒 Privacy-first · Offline-first</Text>
        </View>
      </ScrollView>

      {/* Vault Picker Modal */}
      <Modal
        visible={showVaultPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVaultPicker(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Changer de vault</Text>
            <TouchableOpacity onPress={() => setShowVaultPicker(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <VaultPicker
              currentPath={vaultPath}
              onPathSelected={async (path) => {
                await setVaultPath(path);
                setShowVaultPicker(false);
              }}
              onCancel={() => setShowVaultPicker(false)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal
        visible={showNotifSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifSettings(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <NotificationSettings
            prefs={notifPrefs}
            activeProfile={activeProfile}
            onSave={saveNotifPrefs}
            onClose={() => setShowNotifSettings(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* Telegram Setup Modal */}
      <Modal
        visible={showTelegramSetup}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTelegramSetup(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Configuration Telegram</Text>
            <TouchableOpacity onPress={() => setShowTelegramSetup(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {/* Step 1 — Create bot */}
            <View style={[styles.setupStep, { borderLeftColor: primary }]}>
              <Text style={styles.setupStepTitle}>🤖 Étape 1 — Créer le bot</Text>
              <Text style={styles.setupStepText}>
                1. Ouvrez Telegram et cherchez <Text style={styles.setupBold}>@BotFather</Text>{'\n'}
                2. Envoyez <Text style={[styles.setupCode, { color: primary }]}>/newbot</Text>{'\n'}
                3. Choisissez un nom (ex: "Family Vault"){'\n'}
                4. Choisissez un username (ex: FamilyVaultBot){'\n'}
                5. BotFather vous donne un <Text style={styles.setupBold}>token</Text> — copiez-le ci-dessous
              </Text>
            </View>

            <Text style={styles.inputLabel}>Token du bot</Text>
            <TextInput
              style={styles.input}
              value={telegramToken}
              onChangeText={setTelegramToken}
              placeholder="1234567890:AAG..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Step 2 — Chat ID */}
            <View style={[styles.setupStep, { borderLeftColor: primary }]}>
              <Text style={styles.setupStepTitle}>🔑 Étape 2 — Trouver votre Chat ID</Text>
              <Text style={styles.setupStepText}>
                1. Sur Telegram, ouvrez la conversation avec votre bot{'\n'}
                2. Envoyez-lui un message (ex: "hello"){'\n'}
                3. Ouvrez cette URL dans un navigateur :{'\n'}
              </Text>
              <Text style={styles.setupCodeBlock} selectable>
                https://api.telegram.org/bot{'<'}VOTRE_TOKEN{'>'}/getUpdates
              </Text>
              <Text style={styles.setupStepText}>
                {'\n'}4. Dans le JSON, cherchez <Text style={[styles.setupCode, { color: primary }]}>"chat":{'{'}  "id": 123456789</Text>{'\n'}
                5. Ce nombre est votre <Text style={styles.setupBold}>Chat ID</Text> — copiez-le ci-dessous
              </Text>
            </View>

            <View style={styles.setupTip}>
              <Text style={styles.setupTipText}>
                💡 <Text style={styles.setupBold}>Pour un groupe</Text> : ajoutez le bot au groupe, envoyez un message dans le groupe, puis appelez getUpdates. Le chat ID sera négatif (ex: -1001234567890).
              </Text>
            </View>

            <Text style={styles.inputLabel}>Chat ID</Text>
            <TextInput
              style={styles.input}
              value={telegramChatId}
              onChangeText={setTelegramChatId}
              placeholder="1637148789"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
            />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: primary }, isTesting && styles.btnDisabled]}
                onPress={handleTestTelegram}
                disabled={isTesting}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <Text style={[styles.secondaryBtnText, { color: primary }]}>Tester</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: primary }, isSavingTelegram && styles.btnDisabled]}
                onPress={handleSaveTelegram}
                disabled={isSavingTelegram}
              >
                {isSavingTelegram ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Sauvegarder</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  rowStatus: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  pathText: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Menlo',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    lineHeight: 18,
  },
  changeBtn: {
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  changeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  obsidianHint: {
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
  },
  obsidianHintText: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 17,
  },
  tokenHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Menlo',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: { opacity: 0.6 },
  activeProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  activeAvatar: { fontSize: 36 },
  profileSwitcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  switchBtn: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 72,
  },
  switchAvatar: { fontSize: 22, marginBottom: 2 },
  switchName: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  profileBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  profileAvatar: { fontSize: 28 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  profileMeta: { fontSize: 12, color: '#6B7280' },
  profileLoot: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
  themeSection: {
    marginTop: 6,
    marginLeft: 38,
  },
  themeDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  themeDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themePreviewDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  themeDropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  themeDropdownArrow: {
    fontSize: 10,
    fontWeight: '700',
  },
  themeDropdownList: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  themeDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  themeDropdownItemEmoji: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  themeDropdownItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  themeCheckmark: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: 16 },
  gamiStats: { gap: 4 },
  statText: { fontSize: 13, color: '#6B7280' },
  dangerBtn: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  appInfo: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
  },
  appInfoText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  // Modal styles
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalClose: { fontSize: 20, color: '#9CA3AF' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, gap: 14 },
  telegramInstructions: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 10,
  },
  setupStep: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  setupStepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  setupStepText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  setupBold: {
    fontWeight: '700',
    color: '#1F2937',
  },
  setupCode: {
    fontFamily: 'Courier',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 4,
    borderRadius: 3,
    fontSize: 13,
  },
  setupCodeBlock: {
    fontFamily: 'Courier',
    backgroundColor: '#1F2937',
    color: '#A5B4FC',
    fontSize: 12,
    padding: 10,
    borderRadius: 6,
    overflow: 'hidden',
  },
  setupTip: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  setupTipText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
});
