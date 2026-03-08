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
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useVault, VAULT_PATH_KEY } from '../../hooks/useVault';
import { VaultPicker } from '../../components/VaultPicker';
import { NotificationSettings } from '../../components/NotificationSettings';
import { testTelegram, sendTelegram, buildWeeklyRecapText, sendWeeklyRecap, buildMonthlyRecapText, buildGrossesseUpdateText } from '../../lib/telegram';
import { serializeGamification } from '../../lib/parser';
import { RARITY_LABELS } from '../../constants/rewards';
import { format } from 'date-fns';
import { THEME_LIST, getTheme } from '../../constants/themes';

const CHILD_AVATARS = ['👶', '🧒', '👦', '👧', '🍼', '🐣', '🎒', '👼'];
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  loadNotifConfig,
  saveNotifConfig,
  setupDailyReminders,
  requestNotificationPermissions,
  NotifScheduleConfig,
} from '../../lib/scheduled-notifications';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';
const TELEGRAM_GP_CHAT_KEY = 'telegram_gp_chat_id';

export default function SettingsScreen() {
  const { vaultPath, profiles, activeProfile, vault, setVaultPath, setActiveProfile, refresh, gamiData, notifPrefs, saveNotifPrefs, updateProfileTheme, updateProfile, memories, photoDates, getPhotoUri, vacationConfig, isVacationActive, activateVacation, deactivateVacation, addChild, convertToBorn } = useVault();
  const { primary, tint, setThemeId, colors, darkModePreference, setDarkModePreference } = useThemeColors();

  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [gpChatId, setGpChatId] = useState('');
  const [isSendingRecap, setIsSendingRecap] = useState(false);
  const [isSendingMonthlyRecap, setIsSendingMonthlyRecap] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownAnim = useRef(new Animated.Value(0)).current;

  // Profile editor state
  const [editingProfile, setEditingProfile] = useState<typeof profiles[0] | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBirthdate, setEditBirthdate] = useState('');
  const [editPropre, setEditPropre] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Add child modal
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAvatar, setNewChildAvatar] = useState('👶');
  const [newChildBirthdate, setNewChildBirthdate] = useState('');
  const [newChildPropre, setNewChildPropre] = useState(false);
  const [newChildGrossesse, setNewChildGrossesse] = useState(false);
  const [newChildDateTerme, setNewChildDateTerme] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);

  // Convert to born modal
  const [convertingProfile, setConvertingProfile] = useState<string | null>(null);
  const [bornDate, setBornDate] = useState('');

  // Vacation mode state
  const [showVacationForm, setShowVacationForm] = useState(false);
  const [vacStartDate, setVacStartDate] = useState('');
  const [vacEndDate, setVacEndDate] = useState('');

  // Local notifications config
  const [localNotifConfig, setLocalNotifConfig] = useState<NotifScheduleConfig | null>(null);

  // Load local notif config on mount
  useState(() => {
    (async () => {
      const config = await loadNotifConfig();
      setLocalNotifConfig(config);
    })();
  });

  // Load telegram settings on mount
  useState(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY);
      const chatId = await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY);
      if (token) setTelegramToken(token);
      if (chatId) setTelegramChatId(chatId);
      const gpId = await SecureStore.getItemAsync(TELEGRAM_GP_CHAT_KEY);
      if (gpId) setGpChatId(gpId);
    })();
  });

  const handleSaveGpChatId = useCallback(async () => {
    await SecureStore.setItemAsync(TELEGRAM_GP_CHAT_KEY, gpChatId.trim());
    Alert.alert('✅ Sauvegardé', 'Chat ID grands-parents enregistré.');
  }, [gpChatId]);

  const handleTestGp = useCallback(async () => {
    if (!telegramToken || !gpChatId) {
      Alert.alert('Config manquante', 'Configurez le bot Telegram et le chat ID grands-parents.');
      return;
    }
    const ok = await sendTelegram(
      telegramToken.trim(),
      gpChatId.trim(),
      '✅ <b>Family Vault</b> — Connexion grands-parents réussie ! Vous recevrez les recaps ici. 👴👵'
    );
    Alert.alert(ok ? '✅ Envoyé !' : '❌ Échec', ok ? 'Message test reçu chez les grands-parents.' : 'Vérifiez le chat ID.');
  }, [telegramToken, gpChatId]);

  const handleSendRecap = useCallback(async () => {
    if (!telegramToken || !gpChatId) {
      Alert.alert('Config manquante', 'Configurez le bot Telegram et le chat ID grands-parents.');
      return;
    }
    setIsSendingRecap(true);

    // Get memories and photos from last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;

    const weekMemories = memories.filter((m) => m.date >= weekAgoStr);

    // Collect photo URIs from last 7 days
    const weekPhotoUris: string[] = [];
    const enfantNames = profiles.filter((p) => p.role === 'enfant').map((p) => p.name);
    for (const name of enfantNames) {
      const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      const dates = photoDates[id] ?? [];
      for (const d of dates) {
        if (d >= weekAgoStr) {
          const uri = getPhotoUri(name, d);
          if (uri) weekPhotoUris.push(uri);
        }
      }
    }

    const recapText = buildWeeklyRecapText({
      memories: weekMemories,
      photoCount: weekPhotoUris.length,
      enfantNames,
    });

    try {
      const ok = await sendWeeklyRecap(telegramToken.trim(), gpChatId.trim(), recapText, weekPhotoUris);
      Alert.alert(
        ok ? '✅ Recap envoyé !' : '❌ Échec',
        ok ? `${weekMemories.length} souvenir(s) + ${weekPhotoUris.length} photo(s) envoyé(s).` : 'Erreur lors de l\'envoi.'
      );
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
    setIsSendingRecap(false);
  }, [telegramToken, gpChatId, memories, photoDates, profiles, getPhotoUri]);

  const handleSendMonthlyRecap = useCallback(async () => {
    const token = await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY);
    const gpId = await SecureStore.getItemAsync(TELEGRAM_GP_CHAT_KEY);
    if (!token || !gpId) {
      Alert.alert('Config manquante', 'Configurez le bot Telegram et le chat ID grands-parents.');
      return;
    }
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const monthMemories = memories.filter((m) => m.date >= monthStart);
    const enfantNames = profiles.filter((p) => p.role === 'enfant').map((p) => p.name);
    let photoCount = 0;
    for (const name of enfantNames) {
      const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      photoCount += (photoDates[id] ?? []).filter((d) => d >= monthStart).length;
    }
    setIsSendingMonthlyRecap(true);
    const text = buildMonthlyRecapText({
      profiles,
      memories: monthMemories,
      rdvs: [],
      photoCount,
      completedTasksCount: 0,
      month: monthLabel,
    });
    try {
      const ok = await sendTelegram(token.trim(), gpId.trim(), text);
      Alert.alert(ok ? '✅ Bilan envoyé !' : '❌ Échec', ok ? `Bilan de ${monthLabel} envoyé.` : "Erreur lors de l'envoi.");
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
    setIsSendingMonthlyRecap(false);
  }, [memories, photoDates, profiles]);

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

  const openProfileEditor = useCallback((profile: typeof profiles[0]) => {
    setEditingProfile(profile);
    setEditName(profile.name);
    setEditAvatar(profile.avatar);
    setEditBirthdate(profile.birthdate ?? '');
    setEditPropre(profile.propre ?? false);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!editingProfile) return;
    if (!editName.trim()) {
      Alert.alert('Champ requis', 'Le nom est obligatoire.');
      return;
    }
    if (editBirthdate && !/^\d{4}-\d{2}-\d{2}$/.test(editBirthdate)) {
      Alert.alert('Format invalide', 'La date doit être au format AAAA-MM-JJ.');
      return;
    }
    setIsSavingProfile(true);
    try {
      await updateProfile(editingProfile.id, {
        name: editName.trim(),
        avatar: editAvatar.trim() || '👤',
        birthdate: editBirthdate || undefined,
        ...(editingProfile.role === 'enfant' ? { propre: editPropre } : {}),
      });
      setEditingProfile(null);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setIsSavingProfile(false);
    }
  }, [editingProfile, editName, editAvatar, editBirthdate, editPropre, updateProfile]);

  const handleAddChild = useCallback(async () => {
    if (!newChildName.trim()) {
      Alert.alert('Champ requis', 'Le prénom est obligatoire.');
      return;
    }
    setIsAddingChild(true);
    try {
      await addChild({
        name: newChildName.trim(),
        avatar: newChildAvatar,
        birthdate: newChildGrossesse ? '' : newChildBirthdate,
        propre: newChildPropre,
        ...(newChildGrossesse ? { statut: 'grossesse' as const, dateTerme: newChildDateTerme } : {}),
      });
      setShowAddChild(false);
      setNewChildName('');
      setNewChildAvatar('👶');
      setNewChildBirthdate('');
      setNewChildPropre(false);
      setNewChildGrossesse(false);
      setNewChildDateTerme('');
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setIsAddingChild(false);
    }
  }, [newChildName, newChildAvatar, newChildBirthdate, newChildPropre, newChildGrossesse, newChildDateTerme, addChild]);

  const handleConvertToBorn = useCallback(async () => {
    if (!convertingProfile || !bornDate) {
      Alert.alert('Champ requis', 'La date de naissance est obligatoire.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bornDate)) {
      Alert.alert('Format invalide', 'La date doit être au format AAAA-MM-JJ.');
      return;
    }
    try {
      await convertToBorn(convertingProfile, bornDate);
      setConvertingProfile(null);
      setBornDate('');
      Alert.alert('Bienvenue !', 'Les tâches et jalons ont été mis à jour pour le nouveau bébé.');
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  }, [convertingProfile, bornDate, convertToBorn]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>⚙️ Réglages</Text>

        {/* Vault path */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Vault Obsidian</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textSub }]}>📁 Chemin</Text>
            </View>
            <Text style={[styles.pathText, { color: colors.textSub }]} numberOfLines={3}>
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
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Telegram</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textSub }]}>📱 Bot Telegram</Text>
              <Text style={styles.rowStatus}>
                {telegramToken ? '🟢 Configuré' : '🔴 Non configuré'}
              </Text>
            </View>
            {telegramToken ? (
              <Text style={[styles.tokenHint, { color: colors.textMuted }]}>
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

        {/* Grands-parents */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>👴 Grands-parents</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={styles.notifHint}>
              Envoyez un recap hebdo avec photos et souvenirs aux grands-parents via Telegram.
              Utilisez le même bot, mais un chat ID différent.
            </Text>
            <Text style={styles.inputLabel}>Chat ID grands-parents</Text>
            <TextInput
              style={styles.gpInput}
              value={gpChatId}
              onChangeText={setGpChatId}
              placeholder="Ex: -100123456789"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: primary }]}
                onPress={handleSaveGpChatId}
              >
                <Text style={[styles.secondaryBtnText, { color: primary }]}>Sauver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: primary }]}
                onPress={handleTestGp}
              >
                <Text style={[styles.secondaryBtnText, { color: primary }]}>Tester</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.recapBtn, { backgroundColor: tint }, isSendingRecap && styles.btnDisabled]}
              onPress={handleSendRecap}
              disabled={isSendingRecap}
            >
              {isSendingRecap ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Text style={[styles.recapBtnText, { color: primary }]}>📤 Envoyer le recap de la semaine</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.recapBtn, { backgroundColor: tint }, isSendingMonthlyRecap && styles.btnDisabled]}
              onPress={handleSendMonthlyRecap}
              disabled={isSendingMonthlyRecap}
            >
              {isSendingMonthlyRecap ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Text style={[styles.recapBtnText, { color: primary }]}>📊 Envoyer le bilan du mois</Text>
              )}
            </TouchableOpacity>
            {profiles.some((p) => p.statut === 'grossesse' && p.dateTerme) && (
              <TouchableOpacity
                style={[styles.recapBtn, { backgroundColor: tint }]}
                onPress={async () => {
                  const text = buildGrossesseUpdateText(profiles);
                  if (!text) return;
                  const chatId = telegramChatId.trim() || (await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY) || '');
                  const token = telegramToken.trim() || (await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY) || '');
                  if (!token || !chatId) { Alert.alert('Config manquante', 'Configurez Telegram d\'abord.'); return; }
                  const ok = await sendTelegram(token, chatId, text);
                  Alert.alert(ok ? '✅ Envoyé !' : '❌ Échec', ok ? 'Mise à jour grossesse envoyée.' : "Erreur lors de l'envoi.");
                }}
              >
                <Text style={[styles.recapBtnText, { color: primary }]}>🤰 Envoyer le suivi grossesse</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Notifications</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textSub }]}>🔔 Notifications Telegram</Text>
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

        {/* Local Notifications (Reminders) */}
        {localNotifConfig && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Rappels locaux</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={styles.notifHint}>
                Notifications iOS qui rappellent d'ouvrir l'app. Fonctionnent même quand l'app est fermée.
              </Text>
              {([
                { key: 'morningEnabled' as const, label: '☀️ Matin', hourKey: 'morningHour' as const, minuteKey: 'morningMinute' as const },
                { key: 'middayEnabled' as const, label: '📋 Midi', hourKey: 'middayHour' as const, minuteKey: 'middayMinute' as const },
                { key: 'eveningEnabled' as const, label: '🌙 Soir', hourKey: 'eveningHour' as const, minuteKey: 'eveningMinute' as const },
              ]).map(({ key, label, hourKey, minuteKey }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.notifToggleRow}
                  onPress={async () => {
                    const updated = { ...localNotifConfig, [key]: !localNotifConfig[key] };
                    setLocalNotifConfig(updated);
                    await saveNotifConfig(updated);
                    const permitted = await requestNotificationPermissions();
                    if (permitted) await setupDailyReminders(updated);
                  }}
                >
                  <Text style={styles.notifToggleLabel}>{label}</Text>
                  <Text style={styles.notifToggleTime}>
                    {String(localNotifConfig[hourKey]).padStart(2, '0')}:{String(localNotifConfig[minuteKey]).padStart(2, '0')}
                  </Text>
                  <Text style={styles.notifToggleIcon}>
                    {localNotifConfig[key] ? '✅' : '⬜'}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.notifToggleRow}
                onPress={async () => {
                  const updated = { ...localNotifConfig, rdvAlertEnabled: !localNotifConfig.rdvAlertEnabled };
                  setLocalNotifConfig(updated);
                  await saveNotifConfig(updated);
                }}
              >
                <Text style={styles.notifToggleLabel}>🏥 Alertes RDV</Text>
                <Text style={styles.notifToggleTime}>1h avant</Text>
                <Text style={styles.notifToggleIcon}>
                  {localNotifConfig.rdvAlertEnabled ? '✅' : '⬜'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Apparence */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Apparence</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={styles.settingLabel}>🌙 Mode sombre</Text>
            <View style={styles.darkModeRow}>
              {([
                { value: 'auto',  label: 'Auto',  emoji: '⚙️' },
                { value: 'light', label: 'Clair',  emoji: '☀️' },
                { value: 'dark',  label: 'Sombre', emoji: '🌙' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.darkModeChip,
                    darkModePreference === opt.value && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => setDarkModePreference(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.darkModeChipEmoji}>{opt.emoji}</Text>
                  <Text style={[
                    styles.darkModeChipText,
                    darkModePreference === opt.value && { color: primary, fontWeight: '700' },
                  ]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Mode Vacances */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Mode Vacances</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {isVacationActive && vacationConfig ? (
              <>
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textSub }]}>☀️ Vacances en cours</Text>
                </View>
                <Text style={[styles.vacationDates, { color: colors.text }]}>
                  Du {vacationConfig.startDate.split('-').reverse().join('/')} au {vacationConfig.endDate.split('-').reverse().join('/')}
                </Text>
                <Text style={[styles.vacationCountdown, { color: primary }]}>
                  {(() => {
                    const now = new Date();
                    const end = new Date(vacationConfig.endDate + 'T23:59:59');
                    const start = new Date(vacationConfig.startDate + 'T00:00:00');
                    const todayMs = now.getTime();
                    if (todayMs < start.getTime()) {
                      const days = Math.ceil((start.getTime() - todayMs) / 86400000);
                      return `Départ dans ${days} jour${days > 1 ? 's' : ''}`;
                    }
                    const days = Math.ceil((end.getTime() - todayMs) / 86400000);
                    return `Fin dans ${days} jour${days > 1 ? 's' : ''}`;
                  })()}
                </Text>
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={() => {
                    Alert.alert(
                      'Désactiver le mode vacances ?',
                      'Les tâches normales seront restaurées. La checklist vacances sera conservée.',
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Désactiver', style: 'destructive', onPress: deactivateVacation },
                      ]
                    );
                  }}
                >
                  <Text style={styles.dangerBtnText}>Désactiver le mode vacances</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {!showVacationForm ? (
                  <TouchableOpacity
                    style={[styles.changeBtn, { backgroundColor: tint }]}
                    onPress={() => {
                      setShowVacationForm(true);
                      setVacStartDate('');
                      setVacEndDate('');
                    }}
                  >
                    <Text style={[styles.changeBtnText, { color: primary }]}>☀️ Activer le mode vacances</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={[styles.rowLabel, { color: colors.textSub }]}>📅 Date de début</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={vacStartDate}
                      onChangeText={setVacStartDate}
                      placeholder="10-07-2026"
                      placeholderTextColor="#9CA3AF"
                      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                    />
                    <Text style={[styles.rowLabel, { color: colors.textSub }]}>📅 Date de fin</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={vacEndDate}
                      onChangeText={setVacEndDate}
                      placeholder="24-07-2026"
                      placeholderTextColor="#9CA3AF"
                      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                    />
                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: colors.border }]}
                        onPress={() => setShowVacationForm(false)}
                      >
                        <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: primary }]}
                        onPress={async () => {
                          const ddmmyyyy = /^\d{2}-\d{2}-\d{4}$/;
                          if (!ddmmyyyy.test(vacStartDate) || !ddmmyyyy.test(vacEndDate)) {
                            Alert.alert('Format invalide', 'Les dates doivent être au format JJ-MM-AAAA.');
                            return;
                          }
                          // Convert DD-MM-YYYY → YYYY-MM-DD for storage
                          const [sd, sm, sy] = vacStartDate.split('-');
                          const [ed, em, ey] = vacEndDate.split('-');
                          const startISO = `${sy}-${sm}-${sd}`;
                          const endISO = `${ey}-${em}-${ed}`;
                          if (endISO <= startISO) {
                            Alert.alert('Dates invalides', 'La date de fin doit être après la date de début.');
                            return;
                          }
                          const todayStr = new Date().toISOString().slice(0, 10);
                          if (endISO < todayStr) {
                            Alert.alert('Dates invalides', 'La date de fin doit être aujourd\'hui ou plus tard.');
                            return;
                          }
                          await activateVacation(startISO, endISO);
                          setShowVacationForm(false);
                          Alert.alert('☀️ Mode vacances activé !', 'Rendez-vous dans l\'onglet Tâches pour voir votre checklist.');
                        }}
                      >
                        <Text style={styles.primaryBtnText}>Activer</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </View>

        {/* Active profile */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Mon profil</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {activeProfile ? (
              <View style={styles.activeProfileRow}>
                <Text style={styles.activeAvatar}>{activeProfile.avatar}</Text>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, { color: colors.text }]}>{activeProfile.name}</Text>
                  <Text style={[styles.profileMeta, { color: colors.textMuted }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Profils famille</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {profiles.length === 0 ? (
              <Text style={styles.emptyText}>Aucun profil trouvé dans famille.md</Text>
            ) : (
              profiles.map((profile) => {
                const currentTheme = getTheme(profile.theme);
                return (
                  <View key={profile.id} style={styles.profileBlock}>
                    <TouchableOpacity
                      style={styles.profileRow}
                      onPress={() => openProfileEditor(profile)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.profileAvatar}>{profile.avatar}</Text>
                      <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                        <Text style={[styles.profileMeta, { color: colors.textMuted }]}>
                          {profile.statut === 'grossesse' ? '🤰 Grossesse' : profile.role} · Niv. {profile.level} · {profile.points} pts
                          {profile.statut === 'grossesse' && profile.dateTerme ? ` · Terme: ${profile.dateTerme}` : ''}
                          {profile.statut !== 'grossesse' && profile.birthdate ? ` · 🎂 ${profile.birthdate}` : ''}
                        </Text>
                      </View>
                      {profile.statut === 'grossesse' && (
                        <TouchableOpacity
                          style={[styles.bornBtn, { backgroundColor: primary }]}
                          onPress={() => { setConvertingProfile(profile.id); setBornDate(format(new Date(), 'yyyy-MM-dd')); }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.bornBtnText}>C'est né !</Text>
                        </TouchableOpacity>
                      )}
                      {profile.lootBoxesAvailable > 0 && (
                        <Text style={styles.profileLoot}>🎁 ×{profile.lootBoxesAvailable}</Text>
                      )}
                      <Text style={styles.profileEditIcon}>✏️</Text>
                    </TouchableOpacity>
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
              Tapez sur un profil pour modifier le nom, l'avatar ou la date de naissance.
            </Text>
            <TouchableOpacity
              style={[styles.addChildBtn, { borderColor: primary }]}
              onPress={() => setShowAddChild(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.addChildBtnText, { color: primary }]}>+ Ajouter un enfant</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gamification reset */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Gamification</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>Statistiques globales</Text>
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

      {/* Profile Editor Modal */}
      <Modal
        visible={!!editingProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingProfile(null)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingProfile(null)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Modifier le profil</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={isSavingProfile}>
              <Text style={[styles.profileSaveBtn, { color: primary }]}>
                {isSavingProfile ? '...' : 'Enregistrer'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.inputLabel}>👤 Nom</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Papa"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />

            <Text style={styles.inputLabel}>😀 Avatar (emoji)</Text>
            <TextInput
              style={[styles.input, styles.avatarInput]}
              value={editAvatar}
              onChangeText={(text) => {
                // Keep only the last character/emoji entered
                const chars = [...text];
                setEditAvatar(chars.length > 0 ? chars[chars.length - 1] : '');
              }}
              placeholder="👤"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.avatarPreview}>{editAvatar || '👤'}</Text>

            <Text style={styles.inputLabel}>🎂 Date de naissance (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={editBirthdate}
              onChangeText={setEditBirthdate}
              placeholder="1990-01-15"
              placeholderTextColor="#9CA3AF"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            {editingProfile?.role === 'enfant' && (
              <View style={styles.propreRow}>
                <View style={styles.propreLabel}>
                  <Text style={styles.inputLabel}>🚽 Propre</Text>
                  <Text style={styles.propreHint}>Masque la section couches du journal</Text>
                </View>
                <Switch
                  value={editPropre}
                  onValueChange={setEditPropre}
                  trackColor={{ false: '#D1D5DB', true: primary + '80' }}
                  thumbColor={editPropre ? primary : '#F3F4F6'}
                />
              </View>
            )}
          </ScrollView>
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

      {/* Add Child Modal */}
      <Modal
        visible={showAddChild}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddChild(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddChild(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Ajouter un enfant</Text>
            <TouchableOpacity onPress={handleAddChild} disabled={isAddingChild}>
              <Text style={[styles.profileSaveBtn, { color: primary }]}>
                {isAddingChild ? '...' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.inputLabel}>👤 Prénom</Text>
            <TextInput
              style={styles.input}
              value={newChildName}
              onChangeText={setNewChildName}
              placeholder="Prénom"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />

            <Text style={styles.inputLabel}>😀 Avatar</Text>
            <View style={styles.avatarGrid}>
              {CHILD_AVATARS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.avatarBtn, newChildAvatar === emoji && { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => setNewChildAvatar(emoji)}
                >
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.propreRow}>
              <View style={styles.propreLabel}>
                <Text style={styles.inputLabel}>🤰 Grossesse en cours</Text>
                <Text style={styles.propreHint}>Active le suivi grossesse au lieu des tâches bébé</Text>
              </View>
              <Switch
                value={newChildGrossesse}
                onValueChange={(v) => { setNewChildGrossesse(v); if (v) setNewChildPropre(false); }}
                trackColor={{ false: '#D1D5DB', true: primary + '80' }}
                thumbColor={newChildGrossesse ? primary : '#F3F4F6'}
              />
            </View>

            {newChildGrossesse ? (
              <>
                <Text style={styles.inputLabel}>📅 Date terme prévue</Text>
                <TextInput
                  style={styles.input}
                  value={newChildDateTerme}
                  onChangeText={setNewChildDateTerme}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>🎂 Année ou date de naissance</Text>
                <TextInput
                  style={styles.input}
                  value={newChildBirthdate}
                  onChangeText={setNewChildBirthdate}
                  placeholder="AAAA ou AAAA-MM-JJ"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <Text style={styles.propreHint}>L'année adapte les tâches à l'âge (bébé, enfant, ado)</Text>

                <View style={styles.propreRow}>
                  <View style={styles.propreLabel}>
                    <Text style={styles.inputLabel}>🚽 Propre</Text>
                    <Text style={styles.propreHint}>Masque la section couches du journal</Text>
                  </View>
                  <Switch
                    value={newChildPropre}
                    onValueChange={setNewChildPropre}
                    trackColor={{ false: '#D1D5DB', true: primary + '80' }}
                    thumbColor={newChildPropre ? primary : '#F3F4F6'}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Convert to Born Modal */}
      <Modal
        visible={!!convertingProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setConvertingProfile(null)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setConvertingProfile(null)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Bébé est né !</Text>
            <View />
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.bornEmoji}>🎉</Text>
            <Text style={styles.inputLabel}>📅 Date de naissance</Text>
            <TextInput
              style={styles.input}
              value={bornDate}
              onChangeText={setBornDate}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
            />
            <Text style={styles.propreHint}>Les tâches grossesse seront remplacées par les tâches bébé</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: primary, marginTop: 20 }]}
              onPress={handleConvertToBorn}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryBtnText}>Confirmer la naissance</Text>
            </TouchableOpacity>
          </View>
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
  profileEditIcon: {
    fontSize: 14,
    marginLeft: 4,
  },
  profileSaveBtn: {
    fontSize: 15,
    fontWeight: '700',
    padding: 4,
  },
  avatarInput: {
    fontSize: 32,
    textAlign: 'center',
    paddingVertical: 8,
  },
  propreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
  },
  propreLabel: {
    flex: 1,
    gap: 2,
  },
  propreHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  addChildBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  addChildBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarEmoji: { fontSize: 24 },
  bornBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 4,
  },
  bornBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bornEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  avatarPreview: {
    fontSize: 48,
    textAlign: 'center',
    marginVertical: 4,
  },
  profileHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: 16 },
  notifHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
    lineHeight: 17,
  },
  notifToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  notifToggleLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  notifToggleTime: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  notifToggleIcon: {
    fontSize: 16,
  },
  gamiStats: { gap: 4 },
  statText: { fontSize: 13, color: '#6B7280' },
  vacationDates: {
    fontSize: 15,
    fontWeight: '600',
  },
  vacationCountdown: {
    fontSize: 14,
    fontWeight: '700',
  },
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
  gpInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  recapBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  recapBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  darkModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  darkModeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  darkModeChipEmoji: {
    fontSize: 16,
  },
  darkModeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
});
