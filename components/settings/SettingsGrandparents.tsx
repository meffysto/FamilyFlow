import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { sendTelegram, buildWeeklyRecapText, sendWeeklyRecap, buildMonthlyRecapText, buildGrossesseUpdateText } from '../../lib/telegram';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_GP_CHAT_KEY = 'telegram_gp_chat_id';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';

interface SettingsGrandparentsProps {
  telegramToken: string;
  profiles: any[];
  memories: any[];
  photoDates: Record<string, string[]>;
  getPhotoUri: (name: string, date: string) => string | null;
}

export function SettingsGrandparents({ telegramToken, profiles, memories, photoDates, getPhotoUri }: SettingsGrandparentsProps) {
  const { primary, tint, colors } = useThemeColors();
  const [gpChatId, setGpChatId] = useState('');
  const [isSendingRecap, setIsSendingRecap] = useState(false);
  const [isSendingMonthly, setIsSendingMonthly] = useState(false);

  // Load GP chat ID on mount
  useState(() => {
    (async () => {
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
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
    const weekMemories = memories.filter((m) => m.date >= weekAgoStr);
    const enfantNames = profiles.filter((p) => p.role === 'enfant').map((p) => p.name);
    const weekPhotoUris: string[] = [];
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
    const recapText = buildWeeklyRecapText({ memories: weekMemories, photoCount: weekPhotoUris.length, enfantNames });
    try {
      const ok = await sendWeeklyRecap(telegramToken.trim(), gpChatId.trim(), recapText, weekPhotoUris);
      Alert.alert(ok ? '✅ Recap envoyé !' : '❌ Échec', ok ? `${weekMemories.length} souvenir(s) + ${weekPhotoUris.length} photo(s) envoyé(s).` : 'Erreur lors de l\'envoi.');
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
    setIsSendingRecap(false);
  }, [telegramToken, gpChatId, memories, photoDates, profiles, getPhotoUri]);

  const handleSendMonthly = useCallback(async () => {
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
    setIsSendingMonthly(true);
    const text = buildMonthlyRecapText({ profiles, memories: monthMemories, rdvs: [], photoCount, completedTasksCount: 0, month: monthLabel });
    try {
      const ok = await sendTelegram(token.trim(), gpId.trim(), text);
      Alert.alert(ok ? '✅ Bilan envoyé !' : '❌ Échec', ok ? `Bilan de ${monthLabel} envoyé.` : "Erreur lors de l'envoi.");
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
    setIsSendingMonthly(false);
  }, [memories, photoDates, profiles]);

  const handleSendGrossesse = useCallback(async () => {
    const text = buildGrossesseUpdateText(profiles);
    if (!text) return;
    const token = telegramToken.trim() || (await SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY) || '');
    const chatId = await SecureStore.getItemAsync(TELEGRAM_CHAT_KEY) || '';
    if (!token || !chatId) { Alert.alert('Config manquante', 'Configurez Telegram d\'abord.'); return; }
    const ok = await sendTelegram(token, chatId, text);
    Alert.alert(ok ? '✅ Envoyé !' : '❌ Échec', ok ? 'Mise à jour grossesse envoyée.' : "Erreur lors de l'envoi.");
  }, [telegramToken, profiles]);

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Grands-parents">
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>👴 Grands-parents</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.hint, { color: colors.textFaint }]}>
          Envoyez un recap hebdo avec photos et souvenirs aux grands-parents via Telegram.
        </Text>
        <Text style={[styles.inputLabel, { color: colors.textSub }]}>Chat ID grands-parents</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
          value={gpChatId}
          onChangeText={setGpChatId}
          placeholder="Ex: -100123456789"
          placeholderTextColor={colors.textFaint}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Chat ID grands-parents"
        />
        <View style={styles.btnRow}>
          <Button label="Sauver" onPress={handleSaveGpChatId} variant="secondary" size="sm" />
          <Button label="Tester" onPress={handleTestGp} variant="secondary" size="sm" />
        </View>
        <Button
          label={isSendingRecap ? '...' : '📤 Recap de la semaine'}
          onPress={handleSendRecap}
          variant="secondary"
          size="sm"
          disabled={isSendingRecap}
          fullWidth
        />
        <Button
          label={isSendingMonthly ? '...' : '📊 Bilan du mois'}
          onPress={handleSendMonthly}
          variant="secondary"
          size="sm"
          disabled={isSendingMonthly}
          fullWidth
        />
        {profiles.some((p) => p.statut === 'grossesse' && p.dateTerme) && (
          <Button label="🤰 Suivi grossesse" onPress={handleSendGrossesse} variant="secondary" size="sm" fullWidth />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  hint: { fontSize: FontSize.caption, marginBottom: Spacing.md, lineHeight: 17 },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: { borderWidth: 1.5, borderRadius: Radius.base, padding: Spacing.xl, fontSize: FontSize.body, marginBottom: Spacing.xl },
  btnRow: { flexDirection: 'row', gap: Spacing.md },
});
