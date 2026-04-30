// Modal note : créer/éditer + import URL via defuddle.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import { ModalHeader } from './ui/ModalHeader';
import { Chip } from './ui/Chip';
import { DictaphoneRecorder } from './DictaphoneRecorder';
import { Note, NOTE_CATEGORIES } from '../lib/types';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';

/** Sépare le frontmatter YAML de defuddle (--- delimited) du contenu markdown */
function parseDefuddleResponse(raw: string): { title?: string; content: string } {
  let title: string | undefined;
  let content = raw;

  // Frontmatter YAML : --- ... ---
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    content = fmMatch[2].trim();

    // Extraire le titre du frontmatter
    const titleMatch = frontmatter.match(/^title:\s*"?(.+?)"?\s*$/m);
    if (titleMatch) title = titleMatch[1];
  }

  return { title, content };
}

interface NoteEditorProps {
  visible: boolean;
  note?: Note | null;
  /** URL à importer automatiquement à l'ouverture (deep link) */
  initialUrl?: string;
  onSave: (note: Omit<Note, 'sourceFile'>) => void;
  onDelete?: (note: Note) => void;
  onClose: () => void;
}

export function NoteEditor({ visible, note, initialUrl, onSave, onDelete, onClose }: NoteEditorProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const isEditing = !!note;

  const [title, setTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(NOTE_CATEGORIES[5]);
  const [tagsInput, setTagsInput] = useState('');
  const [content, setContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [dictaphoneVisible, setDictaphoneVisible] = useState(false);
  const dictaphoneResultRef = useRef<string>('');

  // Reset / pré-remplir quand la modal s'ouvre
  useEffect(() => {
    if (visible) {
      if (note) {
        setTitle(note.title);
        setUrlInput(note.url ?? '');
        setSelectedCategory(note.category);
        setTagsInput(note.tags.join(', '));
        setContent(note.content);
      } else {
        setTitle('');
        setUrlInput(initialUrl ?? '');
        setSelectedCategory(initialUrl ? NOTE_CATEGORIES[4] : NOTE_CATEGORIES[5]); // Articles si URL
        setTagsInput('');
        setContent('');
      }
    }
  }, [visible, note, initialUrl]);

  // Import automatique quand initialUrl est fourni (deep link)
  const initialImportDone = useRef(false);
  useEffect(() => {
    if (visible && initialUrl && !initialImportDone.current && !note) {
      initialImportDone.current = true;
      (async () => {
        setImporting(true);
        try {
          const urlWithoutProtocol = initialUrl.replace(/^https?:\/\//, '');
          const response = await fetch(`https://defuddle.md/${urlWithoutProtocol}`);
          if (!response.ok) throw new Error(`Erreur ${response.status}`);
          const raw = await response.text();
          const parsed = parseDefuddleResponse(raw);
          setContent(parsed.content);
          if (parsed.title) {
            setTitle(parsed.title);
          } else {
            const headingMatch = parsed.content.match(/^#\s+(.+)$/m);
            if (headingMatch) setTitle(headingMatch[1].trim());
          }
        } catch (error: any) {
          Alert.alert(t('editors.note.toast.importErrorTitle'), t('editors.note.toast.importErrorMsg', { error: error.message ?? 'unknown' }));
        } finally {
          setImporting(false);
        }
      })();
    }
    if (!visible) initialImportDone.current = false;
  }, [visible, initialUrl, note]);

  const handleImport = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed.startsWith('http')) {
      Alert.alert(t('editors.note.toast.invalidUrl'), t('editors.note.toast.invalidUrlMsg'));
      return;
    }

    setImporting(true);
    try {
      // defuddle.md attend l'URL sans le protocole (ex: defuddle.md/example.com/page)
      const urlWithoutProtocol = trimmed.replace(/^https?:\/\//, '');
      const response = await fetch(
        `https://defuddle.md/${urlWithoutProtocol}`
      );
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      const raw = await response.text();
      const parsed = parseDefuddleResponse(raw);
      setContent(parsed.content);

      // Auto-remplir le titre depuis les métadonnées ou le premier heading
      if (!title.trim()) {
        if (parsed.title) {
          setTitle(parsed.title);
        } else {
          const headingMatch = parsed.content.match(/^#\s+(.+)$/m);
          if (headingMatch) setTitle(headingMatch[1].trim());
        }
      }
    } catch (error: any) {
      Alert.alert(
        t('editors.note.toast.importErrorTitle'),
        t('editors.note.toast.importErrorMsg', { error: error.message ?? 'unknown' })
      );
    } finally {
      setImporting(false);
    }
  }, [urlInput, title, t]);

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert(t('editors.note.toast.titleRequired'), t('editors.note.toast.titleRequiredMsg'));
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      title: title.trim(),
      url: urlInput.trim() || undefined,
      category: selectedCategory,
      created: note?.created || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      tags,
      content,
    });
  }, [title, urlInput, selectedCategory, tagsInput, content, note, onSave, t]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      t('editors.note.deleteConfirmTitle'),
      t('editors.note.deleteConfirmMsg'),
      [
        { text: t('editors.cancel'), style: 'cancel' },
        { text: t('editors.delete'), style: 'destructive', onPress: () => note && onDelete?.(note) },
      ]
    );
  }, [onDelete, note, t]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ModalHeader
          title={isEditing ? t('editors.note.titleEdit') : t('editors.note.titleNew')}
          onClose={onClose}
          rightLabel={t('editors.save')}
          onRight={handleSave}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Section Importer un lien */}
            <Text style={[styles.label, { color: colors.textSub }]}>
              {t('editors.note.importLabel')}
            </Text>
            <View style={styles.importRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.urlInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder={t('editors.note.urlPlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel={t('editors.note.urlA11y')}
              />
              <TouchableOpacity
                style={[styles.importBtn, { backgroundColor: primary }]}
                onPress={handleImport}
                disabled={importing}
                accessibilityLabel={t('editors.note.importA11y')}
                accessibilityRole="button"
              >
                {importing ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.importBtnText, { color: colors.onPrimary }]}>
                    {t('editors.note.importBtn')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Titre */}
            <Text style={[styles.label, { color: colors.textSub }]}>
              {t('editors.note.titleLabel')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder={t('editors.note.titlePlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('editors.note.titleA11y')}
            />

            {/* Catégorie */}
            <Text style={[styles.label, { color: colors.textSub }]}>
              {t('editors.note.categoryLabel')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {NOTE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  selected={selectedCategory === cat}
                  onPress={() => setSelectedCategory(cat)}
                  size="sm"
                />
              ))}
            </ScrollView>

            {/* Tags */}
            <Text style={[styles.label, { color: colors.textSub }]}>
              {t('editors.note.tagsLabel')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder={t('editors.note.tagsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('editors.note.tagsA11y')}
            />

            {/* Contenu */}
            <View style={styles.contentLabelRow}>
              <Text style={[styles.label, styles.labelNoMarginBottom, { color: colors.textSub }]}>
                {t('editors.note.contentLabel')}
              </Text>
              <TouchableOpacity
                style={[styles.dictaphoneBtn, { backgroundColor: colors.cardAlt, borderColor: primary }]}
                onPress={() => setDictaphoneVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel={t('editors.note.dictateA11y')}
                accessibilityRole="button"
              >
                <Text style={styles.dictaphoneBtnEmoji}>🎙️</Text>
                <Text style={[styles.dictaphoneBtnText, { color: primary }]}>{t('editors.note.dictateBtn')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.input,
                styles.contentInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={content}
              onChangeText={setContent}
              placeholder={t('editors.note.contentPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              accessibilityLabel={t('editors.note.contentA11y')}
            />

            {/* Bouton supprimer (mode édition) */}
            {isEditing && onDelete && (
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]}
                onPress={handleDelete}
                accessibilityLabel={t('editors.note.deleteA11y')}
                accessibilityRole="button"
              >
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>
                  {t('editors.note.deleteBtn')}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Dictaphone Modal */}
        <Modal
          visible={dictaphoneVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            const pending = dictaphoneResultRef.current;
            if (pending) {
              setContent((prev) => prev.trim() ? `${prev}\n\n${pending}` : pending);
              dictaphoneResultRef.current = '';
            }
            setDictaphoneVisible(false);
          }}
        >
          <DictaphoneRecorder
            context={{
              title: title.trim() || t('editors.note.titleNew'),
              subtitle: selectedCategory,
            }}
            onResult={(text) => {
              dictaphoneResultRef.current = text;
              setContent((prev) => prev.trim() ? `${prev}\n\n${text}` : text);
            }}
            onClose={() => {
              dictaphoneResultRef.current = '';
              setDictaphoneVisible(false);
            }}
          />
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing['3xl'],
    paddingBottom: Spacing['6xl'],
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  urlInput: {
    flex: 1,
  },
  importBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
    height: 44,
  },
  importBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  chipScroll: {
    marginBottom: Spacing.xs,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  contentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  labelNoMarginBottom: {
    marginTop: 0,
    marginBottom: 0,
  },
  dictaphoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  dictaphoneBtnEmoji: {
    fontSize: FontSize.sm,
  },
  dictaphoneBtnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  contentInput: {
    minHeight: 200,
  },
  deleteBtn: {
    borderRadius: Radius.md,
    padding: Spacing.xl,
    marginTop: Spacing['3xl'],
    marginBottom: Spacing['3xl'],
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
