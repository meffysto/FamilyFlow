import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  ScrollView,
  Text,
  StyleSheet,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { ModalHeader } from './ui/ModalHeader';
import { MarkdownText } from './ui/MarkdownText';
import { Chip } from './ui/Chip';
import { FocusReader } from './FocusReader';
import { formatDateLocalized } from '../lib/date-locale';
import { useTranslation } from 'react-i18next';
import type { Note } from '../lib/types';

interface NoteViewerProps {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
  onEdit: () => void;
}

export const NoteViewer = React.memo(function NoteViewer({
  visible,
  note,
  onClose,
  onEdit,
}: NoteViewerProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const [showReader, setShowReader] = useState(false);
  const closeReader = useCallback(() => setShowReader(false), []);

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {!note ? null : (
          <>
            <ModalHeader
              title={note.title}
              onClose={onClose}
              rightLabel={t('noteViewer.edit')}
              onRight={onEdit}
            />

            {/* Bouton lecture immersive */}
            {note.content.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => setShowReader(true)}
                activeOpacity={0.7}
                style={[styles.readBtn, { backgroundColor: primary + '15', borderColor: primary + '30' }]}
                accessibilityRole="button"
                accessibilityLabel={t('noteViewer.readingModeA11y')}
              >
                <Text style={[styles.readBtnText, { color: primary }]}>
                  {t('noteViewer.readingMode')}
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Ligne méta : catégorie + date + lien */}
              <View style={styles.metaRow}>
                <Chip label={note.category} size="sm" />
                <Text style={[styles.date, { color: colors.textSub }]}>
                  {formatDateLocalized(note.created)}
                </Text>
              </View>

              {note.url ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(note.url!)}
                  accessibilityRole="link"
                  accessibilityLabel={t('noteViewer.viewOriginalA11y')}
                  style={styles.linkRow}
                >
                  <Text style={[styles.link, { color: primary }]}>
                    {t('noteViewer.viewOriginal')}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Tags */}
              {note.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {note.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="sm" />
                  ))}
                </View>
              ) : null}

              {/* Contenu markdown */}
              <View style={styles.contentWrap}>
                <MarkdownText>{note.content}</MarkdownText>
              </View>
            </ScrollView>

            {/* Lecteur immersif */}
            <FocusReader
              visible={showReader}
              content={note.content}
              title={note.title}
              onClose={closeReader}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing['3xl'],
    paddingBottom: Spacing['6xl'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  date: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.normal,
    lineHeight: LineHeight.body,
  },
  linkRow: {
    marginBottom: Spacing.md,
  },
  link: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    lineHeight: LineHeight.body,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing['2xl'],
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing['3xl'],
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  readBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  contentWrap: {
    marginTop: Spacing.sm,
  },
});
