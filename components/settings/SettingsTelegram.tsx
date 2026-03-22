import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const handleTest = useCallback(async () => {
    if (!telegramToken || !telegramChatId) {
      Alert.alert(t('settings.telegram.missingParams'), t('settings.telegram.missingParamsMsg'));
      return;
    }
    setIsTesting(true);
    const ok = await testTelegram(telegramToken.trim(), telegramChatId.trim());
    setIsTesting(false);
    Alert.alert(ok ? t('settings.telegram.testSuccess') : t('settings.telegram.testFail'), ok ? t('settings.telegram.testSuccessMsg') : t('settings.telegram.testFailMsg'));
  }, [telegramToken, telegramChatId, t]);

  const handleSave = useCallback(async () => {
    setIsSavingTelegram(true);
    await SecureStore.setItemAsync(TELEGRAM_TOKEN_KEY, telegramToken.trim());
    await SecureStore.setItemAsync(TELEGRAM_CHAT_KEY, telegramChatId.trim());
    setIsSavingTelegram(false);
    setShowSetup(false);
    Alert.alert(t('settings.telegram.savedTitle'), t('settings.telegram.savedMsg'));
  }, [telegramToken, telegramChatId, t]);

  return (
    <>
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.telegram.sectionA11y')}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.telegram.sectionTitle')}</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.telegram.botLabel')}</Text>
            <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
              {telegramToken ? t('settings.telegram.configured') : t('settings.telegram.notConfigured')}
            </Text>
          </View>
          {telegramToken ? (
            <Text style={[styles.tokenHint, { color: colors.textFaint }]}>
              {t('settings.telegram.tokenHint', { token: telegramToken.slice(0, 10) })}
            </Text>
          ) : null}
          <View style={styles.btnRow}>
            <Button label={t('settings.telegram.configureBtn')} onPress={() => setShowSetup(true)} variant="secondary" size="sm" />
            <Button
              label={isTesting ? '...' : t('settings.telegram.testBtn')}
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
          <ModalHeader title={t('settings.telegram.modalTitle')} onClose={() => setShowSetup(false)} />
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <View style={[styles.setupStep, { borderLeftColor: primary, backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.setupTitle, { color: colors.text }]}>🤖 Étape 1 — Créer le bot</Text>
              <Text style={[styles.setupText, { color: colors.textSub }]}>
                1. Ouvrez Telegram et cherchez <Text style={[styles.bold, { color: colors.text }]}>@BotFather</Text>{'\n'}
                2. Envoyez <Text style={[styles.code, { color: primary, backgroundColor: colors.border }]}>/newbot</Text>{'\n'}
                3. Choisissez un nom (ex: "Family Flow"){'\n'}
                4. Choisissez un username (ex: FamilyVaultBot){'\n'}
                5. BotFather vous donne un <Text style={[styles.bold, { color: colors.text }]}>token</Text> — copiez-le ci-dessous
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.telegram.tokenLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={telegramToken}
              onChangeText={setTelegramToken}
              placeholder="1234567890:AAG..."
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('settings.telegram.tokenA11y')}
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
                💡 <Text style={[styles.bold, { color: colors.text }]}>{t('settings.telegram.groupTip')}</Text>
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSub }]}>{t('settings.telegram.chatIdLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
              value={telegramChatId}
              onChangeText={setTelegramChatId}
              placeholder="1637148789"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel={t('settings.telegram.chatIdA11y')}
            />

            <View style={styles.btnRow}>
              <Button label={isTesting ? '...' : t('settings.telegram.testBtn')} onPress={handleTest} variant="secondary" size="md" disabled={isTesting} />
              <Button label={isSavingTelegram ? '...' : t('settings.telegram.saveBtn')} onPress={handleSave} variant="primary" size="md" disabled={isSavingTelegram} />
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
