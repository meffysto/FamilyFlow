import React from 'react';
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
import { formatDateForDisplay } from '../lib/parser';
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
  const { primary, colors } = useThemeColors();

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
              rightLabel="Modifier"
              onRight={onEdit}
            />

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Ligne méta : catégorie + date + lien */}
              <View style={styles.metaRow}>
                <Chip label={note.category} size="sm" />
                <Text style={[styles.date, { color: colors.textSub }]}>
                  {formatDateForDisplay(note.created)}
                </Text>
              </View>

              {note.url ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(note.url!)}
                  accessibilityRole="link"
                  accessibilityLabel="Voir l'article original"
                  style={styles.linkRow}
                >
                  <Text style={[styles.link, { color: primary }]}>
                    Voir l'article original
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
  contentWrap: {
    marginTop: Spacing.sm,
  },
});
