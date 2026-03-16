/**
 * NoteEditor.tsx — Modal pour créer/éditer des notes et importer des URLs en markdown
 */

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

interface NoteEditorProps {
  visible: boolean;
  note?: Note | null;
  onSave: (note: Omit<Note, 'sourceFile'>) => void;
  onDelete?: (note: Note) => void;
  onClose: () => void;
}

export function NoteEditor({ visible, note, onSave, onDelete, onClose }: NoteEditorProps) {
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
        setUrlInput('');
        setSelectedCategory(NOTE_CATEGORIES[5]);
        setTagsInput('');
        setContent('');
      }
    }
  }, [visible, note]);

  const handleImport = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed.startsWith('http')) {
      Alert.alert('URL invalide', "L'URL doit commencer par http ou https.");
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
      const markdown = await response.text();
      setContent(markdown);

      // Auto-remplir le titre depuis le premier heading
      if (!title.trim()) {
        const headingMatch = markdown.match(/^#\s+(.+)$/m);
        if (headingMatch) {
          setTitle(headingMatch[1].trim());
        }
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur d\'importation',
        `Impossible de récupérer le contenu : ${error.message ?? 'erreur inconnue'}`
      );
    } finally {
      setImporting(false);
    }
  }, [urlInput, title]);

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Veuillez saisir un titre pour la note.');
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
      created: note?.created || new Date().toISOString().split('T')[0],
      tags,
      content,
    });
  }, [title, urlInput, selectedCategory, tagsInput, content, note, onSave]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer la note',
      'Cette action est irréversible. Voulez-vous vraiment supprimer cette note ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => note && onDelete?.(note) },
      ]
    );
  }, [onDelete]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ModalHeader
          title={isEditing ? 'Modifier la note' : 'Nouvelle note'}
          onClose={onClose}
          rightLabel="Enregistrer"
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
              Importer un lien
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
                placeholder="https://exemple.com/article"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="URL à importer"
              />
              <TouchableOpacity
                style={[styles.importBtn, { backgroundColor: primary }]}
                onPress={handleImport}
                disabled={importing}
                accessibilityLabel="Importer le lien"
                accessibilityRole="button"
              >
                {importing ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.importBtnText, { color: colors.onPrimary }]}>
                    Importer
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Titre */}
            <Text style={[styles.label, { color: colors.textSub }]}>
              Titre
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
              placeholder="Titre de la note"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Titre de la note"
            />

            {/* Catégorie */}
            <Text style={[styles.label, { color: colors.textSub }]}>
              Catégorie
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
              Tags
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
              placeholder="santé, important, urgent"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Tags séparés par des virgules"
            />

            {/* Contenu */}
            <View style={styles.contentLabelRow}>
              <Text style={[styles.label, styles.labelNoMarginBottom, { color: colors.textSub }]}>
                Contenu
              </Text>
              <TouchableOpacity
                style={[styles.dictaphoneBtn, { backgroundColor: colors.cardAlt, borderColor: primary }]}
                onPress={() => setDictaphoneVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Dicter le contenu"
                accessibilityRole="button"
              >
                <Text style={styles.dictaphoneBtnEmoji}>🎙️</Text>
                <Text style={[styles.dictaphoneBtnText, { color: primary }]}>Dicter</Text>
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
              placeholder="Contenu de la note..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Contenu de la note"
            />

            {/* Bouton supprimer (mode édition) */}
            {isEditing && onDelete && (
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]}
                onPress={handleDelete}
                accessibilityLabel="Supprimer la note"
                accessibilityRole="button"
              >
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>
                  Supprimer la note
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
              title: title.trim() || 'Nouvelle note',
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
