// components/pdf/PostExportView.tsx
// Vue post-export rendue DANS BookExportModal (phase `post-export`).
// 3 actions : Sauvegarder (expo-sharing) / Voir (Print.printAsync iOS) /
// Commander chez Lulu (sub-modal LuluInstructionsModal).
// Phase 51-03 — Haptic Medium au mount (succès génération).
//
// expo-sharing en lazy import (`await import`) avec fallback Linking.openURL
// si module natif absent (rebuild dev-client en cours — RESEARCH Pitfall 1).

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Save, Eye, Printer, BookOpen } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { LuluInstructionsModal } from './LuluInstructionsModal';

interface Props {
  uri: string;
  coverUri: string;
  storyTitle: string;
  onDone: () => void;
}

function PostExportViewImpl({ uri, coverUri, storyTitle, onDone }: Props) {
  const { t } = useTranslation();
  const { colors, primary } = useThemeColors();
  const [luluOpen, setLuluOpen] = useState(false);

  // Haptic Medium au mount (succès génération) — CONTEXT.md
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const sharePdf = useCallback(
    async (pdfUri: string) => {
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: t('impressions:share.dialogTitle', { title: storyTitle }),
          });
        } else {
          Alert.alert(t('impressions:errors.sharingUnavailable'));
          await Linking.openURL(pdfUri);
        }
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[PostExportView] share error', err);
        }
        try {
          await Linking.openURL(pdfUri);
        } catch {
          /* silent */
        }
      }
    },
    [storyTitle, t],
  );

  const handleSave = useCallback(async () => {
    Haptics.selectionAsync();
    await sharePdf(uri);
  }, [uri, sharePdf]);

  const handleSaveCover = useCallback(async () => {
    Haptics.selectionAsync();
    await sharePdf(coverUri);
  }, [coverUri, sharePdf]);

  const handlePreview = useCallback(async () => {
    Haptics.selectionAsync();
    try {
      if (Platform.OS === 'ios') {
        await Print.printAsync({ uri });
      } else {
        await Linking.openURL(uri);
      }
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[PostExportView] preview error', err);
      }
    }
  }, [uri]);

  const handleLulu = useCallback(() => {
    Haptics.selectionAsync();
    setLuluOpen(true);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('impressions:postExport.title')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {t('impressions:postExport.subtitle')}
      </Text>

      <ActionButton
        Icon={Save}
        title={t('impressions:postExport.save.title')}
        description={t('impressions:postExport.save.description')}
        onPress={handleSave}
        bg={colors.card}
        border={colors.border}
        textColor={colors.text}
        mutedColor={colors.textMuted}
        primary={primary}
      />
      <ActionButton
        Icon={BookOpen}
        title={t('impressions:postExport.cover.title')}
        description={t('impressions:postExport.cover.description')}
        onPress={handleSaveCover}
        bg={colors.card}
        border={colors.border}
        textColor={colors.text}
        mutedColor={colors.textMuted}
        primary={primary}
      />
      <ActionButton
        Icon={Eye}
        title={t('impressions:postExport.preview.title')}
        description={t('impressions:postExport.preview.description')}
        onPress={handlePreview}
        bg={colors.card}
        border={colors.border}
        textColor={colors.text}
        mutedColor={colors.textMuted}
        primary={primary}
      />
      <ActionButton
        Icon={Printer}
        title={t('impressions:postExport.lulu.title')}
        description={t('impressions:postExport.lulu.description')}
        onPress={handleLulu}
        bg={colors.card}
        border={colors.border}
        textColor={colors.text}
        mutedColor={colors.textMuted}
        primary={primary}
      />

      <Pressable
        onPress={onDone}
        style={[styles.done, { borderColor: colors.border }]}
        accessibilityRole="button"
      >
        <Text style={[styles.doneLabel, { color: colors.text }]}>
          {t('impressions:postExport.doneBtn')}
        </Text>
      </Pressable>

      <LuluInstructionsModal
        visible={luluOpen}
        onClose={() => setLuluOpen(false)}
      />
    </View>
  );
}

interface ActionButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  title: string;
  description: string;
  onPress: () => void;
  bg: string;
  border: string;
  textColor: string;
  mutedColor: string;
  primary: string;
}

function ActionButton({
  Icon,
  title,
  description,
  onPress,
  bg,
  border,
  textColor,
  mutedColor,
  primary,
}: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, { backgroundColor: bg, borderColor: border }]}
      accessibilityRole="button"
    >
      <Icon size={28} color={primary} />
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.actionDesc, { color: mutedColor }]}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

export const PostExportView = React.memo(PostExportViewImpl);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing['3xl'],
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    marginBottom: Spacing['4xl'],
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing['3xl'],
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  actionText: {
    flex: 1,
    marginLeft: Spacing['2xl'],
  },
  actionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xxs,
  },
  actionDesc: {
    fontSize: FontSize.label,
  },
  done: {
    paddingVertical: Spacing['3xl'],
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing['2xl'],
  },
  doneLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
