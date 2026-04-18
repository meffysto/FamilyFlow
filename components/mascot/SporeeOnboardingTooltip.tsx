/**
 * SporeeOnboardingTooltip.tsx — Phase 41 (SPOR-10)
 *
 * Tooltip one-shot au premier drop/obtention d'une Sporée.
 * Flag 'sporee_tooltip' persisté device-global via HelpContext (pattern TUTO-02).
 * Jamais retriggeré une fois dismissé.
 */
import React, { useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useHelp } from '../../contexts/HelpContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function SporeeOnboardingTooltip({ visible, onDismiss }: Props) {
  const { colors, primary } = useThemeColors();
  const { markScreenSeen } = useHelp();

  const handleOk = useCallback(async () => {
    Haptics.selectionAsync();
    await markScreenSeen('sporee_tooltip');
    onDismiss();
  }, [markScreenSeen, onDismiss]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleOk}>
      <Pressable style={styles.backdrop} onPress={handleOk}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.emoji}>🍄</Text>
          <Text style={[styles.title, { color: colors.text }]}>{'Une Sporée !'}</Text>
          <Text style={[styles.body, { color: colors.textSub }]}>
            {'Applique-la à un plant pour parier sur ta régularité : si tu complètes assez de tâches pendant que le plant pousse, tu gagnes un multiplicateur de récompense. Pari bienveillant — jamais de pénalité.'}
          </Text>
          <Pressable style={[styles.okBtn, { backgroundColor: primary }]} onPress={handleOk}>
            <Text style={[styles.okLabel, { color: colors.bg }]}>{'Compris'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  card: {
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 340,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  okBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  okLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
