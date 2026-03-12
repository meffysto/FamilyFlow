import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Modal } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { testTelegram } from '../../lib/telegram';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const TELEGRAM_TOKEN_KEY = 'telegram_token';
const TELEGRAM_CHAT_KEY = 'telegram_chat_id';

interface SettingsTelegramProps {
  telegramToken: string;
  telegramChatId: string;
  setTelegramToken: (v: string) => void;
  setTelegramChatId: (v: string) => void;
}

export function SettingsTelegram({ telegramToken, telegramChatId, setTelegramToken, setTelegramChatId }: SettingsTelegramProps) {
  const { primary, tint, colors } = useThemeColors();
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const handleTest = useCallback(async () => {
    if (!telegramToken || !telegramChatId) {
      Alert.alert('Paramètres manquants', 'Entrez le token et le chat ID d\'abord.');
      return;
    }
    setIsTesting(true);
    const ok = await testTelegram(telegramToken.trim(), telegramChatId.trim());
    setIsTesting(false);
    Alert.alert(ok ? '✅ Succès !' : '❌ Échec', ok ? 'Message Telegram envoyé avec succès.' : 'Impossible d\'envoyer le message. Vérifiez le token et le chat ID.');
  }, [telegramToken, telegramChatId]);

  const handleSave = useCallback(async () => {
    setIsSavingTelegram(true);
    await SecureStore.setItemAsync(TELEGRAM_TOKEN_KEY, telegramToken.trim());
    await SecureStore.setItemAsync(TELEGRAM_CHAT_KEY, telegramChatId.trim());
    setIsSavingTelegram(false);
    setShowSetup(false);
    Alert.alert('✅ Sauvegardé', 'Les paramètres Telegram ont été sauvegardés.');
  }, [telegramToken, telegramChatId]);

  return (
    <>
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Telegram">
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Telegram</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>📱 Bot Telegram</Text>
            <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
              {telegramToken ? '🟢 Configuré' : '🔴 Non configuré'}
            </Text>
          </View>
          {telegramToken ? (
            <Text style={[styles.tokenHint, { color: colors.textFaint }]}>
              Token : {telegramToken.slice(0, 10)}...
            </Text>
          ) : null}
          <View style={styles.btnRow}>
            <Button label="Configurer" onPress={() => setShowSetup(true)} variant="secondary" size="sm" />
            <Button
              label={isTesting ? '...' : 'Tester'}
              onPress={handleTest}
              variant="secondary"
              size="sm"
              disabled={isTesting}
            />
          </View>
        </View>
      </View>

      {/* Modal configuration Telegram */}
      <Modal visible={showSetup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSetup(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <ModalHeader title="Configuration Telegram" onClose={() => setShowSetup(false)} />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <View style={[styles.setupStep, { borderLeftColor: primary, backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.setupTitle, { color: colors.text }]}>🤖 Étape 1 — Créer le bot</Text>
              <Text style={[styles.setupText, { color: colors.textSub }]}>
                1. Ouvrez Telegram et cherchez <Text style={[styles.bold, { color: colors.text }]}>@BotFather</Text>{'\n'}
                2. Envoyez <Text style={[styles.code, { color: primary, backgroundColor: colors.border }]}>/newbot</Text>{'\n'}
                3. Choisissez un nom (ex: "Family Vault"){'\n'}
                4. Choisissez un username (ex: FamilyVaultBot){'\n'}
                5. BotFather vous donne un <Text style={[styles.bold, { color: colors.text }]}>token</Text> — copiez-le ci-dessous
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSub }]}>Token du bot</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={telegramToken}
              onChangeText={setTelegramToken}
              placeholder="1234567890:AAG..."
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Token du bot Telegram"
            />

            <View style={[styles.setupStep, { borderLeftColor: primary, backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.setupTitle, { color: colors.text }]}>🔑 Étape 2 — Trouver votre Chat ID</Text>
              <Text style={[styles.setupText, { color: colors.textSub }]}>
                1. Sur Telegram, ouvrez la conversation avec votre bot{'\n'}
                2. Envoyez-lui un message (ex: "hello"){'\n'}
                3. Ouvrez cette URL dans un navigateur :{'\n'}
              </Text>
              <Text style={[styles.codeBlock, { backgroundColor: colors.text, color: colors.info }]} selectable>
                {telegramToken.trim()
                  ? `https://api.telegram.org/bot${telegramToken.trim()}/getUpdates`
                  : 'https://api.telegram.org/bot<VOTRE_TOKEN>/getUpdates'}
              </Text>
              <Text style={[styles.setupText, { color: colors.textSub }]}>
                {'\n'}4. Dans le JSON, cherchez <Text style={[styles.code, { color: primary, backgroundColor: colors.border }]}>"chat":{'{'}  "id": 123456789</Text>{'\n'}
                5. Ce nombre est votre <Text style={[styles.bold, { color: colors.text }]}>Chat ID</Text>
              </Text>
            </View>

            <View style={[styles.tip, { backgroundColor: colors.warningBg, borderLeftColor: colors.warning }]}>
              <Text style={[styles.tipText, { color: colors.warningText }]}>
                💡 <Text style={[styles.bold, { color: colors.text }]}>Pour un groupe</Text> : ajoutez le bot au groupe, envoyez un message, puis appelez getUpdates. Le chat ID sera négatif.
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSub }]}>Chat ID</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={telegramChatId}
              onChangeText={setTelegramChatId}
              placeholder="1637148789"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Chat ID Telegram"
            />

            <View style={styles.btnRow}>
              <Button label={isTesting ? '...' : 'Tester'} onPress={handleTest} variant="secondary" size="md" disabled={isTesting} />
              <Button label={isSavingTelegram ? '...' : 'Sauvegarder'} onPress={handleSave} variant="primary" size="md" disabled={isSavingTelegram} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
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
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  rowStatus: { fontSize: FontSize.label, fontWeight: FontWeight.medium },
  tokenHint: { fontSize: FontSize.caption, fontFamily: 'Menlo' },
  btnRow: { flexDirection: 'row', gap: Spacing.md },
  modalSafe: { flex: 1 },
  modalScroll: { flex: 1 },
  modalContent: { padding: Spacing['3xl'], gap: Spacing.xl },
  setupStep: { padding: Spacing.xl, borderRadius: Radius.base, borderLeftWidth: 3 },
  setupTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  setupText: { fontSize: FontSize.sm, lineHeight: 22 },
  bold: { fontWeight: FontWeight.bold },
  code: { fontFamily: 'Courier', paddingHorizontal: 4, borderRadius: 3, fontSize: FontSize.label },
  codeBlock: { fontFamily: 'Courier', fontSize: FontSize.caption, padding: Spacing.lg, borderRadius: Radius.sm, overflow: 'hidden' },
  tip: { padding: Spacing.xl, borderRadius: Radius.md, borderLeftWidth: 3 },
  tipText: { fontSize: FontSize.label, lineHeight: 20 },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: { borderWidth: 1.5, borderRadius: Radius.base, padding: Spacing.xl, fontSize: FontSize.body },
});
