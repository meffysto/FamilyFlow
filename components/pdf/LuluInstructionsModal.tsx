// components/pdf/LuluInstructionsModal.tsx
// Sub-modal manuel Lulu FR pas-à-pas (5 étapes) + CTA "Ouvrir Lulu Studio".
// Phase 51-03 — ouverte depuis PostExportView quand l'utilisateur tape
// "Commander chez Lulu".
//
// URL hardcodée (pas de string interpolée user-input — threat model T-51-03-01).
// pageSheet drag-to-dismiss pour cohérence avec les autres modals projet.

import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';

const LULU_URL = 'https://www.lulu.com/create/print-books/';
const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

function LuluInstructionsModalImpl({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, primary } = useThemeColors();

  const handleOpen = useCallback(() => {
    Haptics.selectionAsync();
    Linking.openURL(LULU_URL).catch(() => {
      Alert.alert(
        t('impressions:lulu.errorTitle'),
        t('impressions:lulu.errorOpen'),
      );
    });
  }, [t]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top']}
        style={[styles.safe, { backgroundColor: colors.bg }]}
      >
        <ModalHeader
          title={t('impressions:lulu.modalTitle')}
          onClose={onClose}
        />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.intro, { color: colors.text }]}>
            {t('impressions:lulu.intro')}
          </Text>

          {STEPS.map((s) => (
            <View key={s} style={styles.step}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                {t(`impressions:lulu.${s}.title`)}
              </Text>
              <Text style={[styles.stepBody, { color: colors.textMuted }]}>
                {t(`impressions:lulu.${s}.body`)}
              </Text>
            </View>
          ))}

          <Text style={[styles.tip, { color: colors.textMuted }]}>
            {t('impressions:lulu.tip')}
          </Text>

          <Pressable
            onPress={handleOpen}
            style={[styles.cta, { backgroundColor: primary }]}
            accessibilityRole="button"
          >
            <ExternalLink size={18} color={colors.onPrimary} />
            <Text style={[styles.ctaLabel, { color: colors.onPrimary }]}>
              {t('impressions:lulu.openButton')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export const LuluInstructionsModal = React.memo(LuluInstructionsModalImpl);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  body: {
    padding: Spacing['3xl'],
    paddingBottom: Spacing['5xl'],
  },
  intro: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    marginBottom: Spacing['3xl'],
  },
  step: {
    marginBottom: Spacing['3xl'],
  },
  stepTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  stepBody: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
  },
  tip: {
    fontSize: FontSize.label,
    fontStyle: 'italic',
    marginVertical: Spacing['2xl'],
    lineHeight: LineHeight.normal,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    borderRadius: Radius.md,
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  ctaLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
