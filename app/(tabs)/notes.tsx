/**
 * notes.tsx — Écran Notes & Articles
 *
 * Coffre-fort familial : importer des articles web (defuddle),
 * créer des notes, organiser par catégories. Adultes uniquement.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { useTranslation } from 'react-i18next';
import { Note, NOTE_CATEGORIES } from '../../lib/types';
import { formatDateLocalized } from '../../lib/date-locale';
import { Chip } from '../../components/ui/Chip';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { NoteEditor } from '../../components/NoteEditor';
import { NoteViewer } from '../../components/NoteViewer';
import { EmptyState } from '../../components/EmptyState';

export default function NotesScreen() {
  const { t } = useTranslation();
  const { notes, addNote, updateNote, deleteNote, activeProfile, refresh } = useVault();
  const { primary, colors } = useThemeColors();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const { addNew, importUrl } = useLocalSearchParams<{ addNew?: string; importUrl?: string }>();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const { refreshing, onRefresh } = useRefresh(refresh);

  // Ouvrir l'éditeur si addNew=1 ou importUrl
  const [pendingImportUrl, setPendingImportUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (importUrl) {
      setPendingImportUrl(decodeURIComponent(importUrl));
      setEditingNote(null);
      setEditorVisible(true);
    } else if (addNew === '1') {
      setEditingNote(null);
      setEditorVisible(true);
    }
  }, [addNew, importUrl]);

  // Filtrage par recherche et catégorie
  const filteredNotes = useMemo(() => {
    let result = notes;
    if (selectedCategory) {
      result = result.filter((n) => n.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [notes, search, selectedCategory]);

  // Grouper par catégorie
  const groupedNotes = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    for (const note of filteredNotes) {
      const cat = note.category || '📌 Divers';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(note);
    }
    // Trier les catégories selon l'ordre par défaut
    const catOrder = NOTE_CATEGORIES as readonly string[];
    return Object.entries(groups).sort(([a], [b]) => {
      const ia = catOrder.indexOf(a);
      const ib = catOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [filteredNotes]);

  // Flat list data avec headers
  const listData = useMemo(() => {
    const data: ({ type: 'header'; category: string; count: number } | { type: 'note'; note: Note })[] = [];
    for (const [cat, catNotes] of groupedNotes) {
      data.push({ type: 'header', category: cat, count: catNotes.length });
      for (const note of catNotes) {
        data.push({ type: 'note', note });
      }
    }
    return data;
  }, [groupedNotes]);

  const handleSave = useCallback(
    async (noteData: Omit<Note, 'sourceFile'>) => {
      try {
        if (editingNote) {
          await updateNote(editingNote.sourceFile, noteData);
        } else {
          await addNote(noteData);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEditorVisible(false);
        setEditingNote(null);
      } catch (e: any) {
        Alert.alert(t('notesScreen.alert.error'), e.message || t('notesScreen.alert.saveError'));
      }
    },
    [editingNote, addNote, updateNote]
  );

  const handleDelete = useCallback(
    async (note: Note) => {
      try {
        await deleteNote(note.sourceFile);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setViewerVisible(false);
        setEditorVisible(false);
        setEditingNote(null);
        setViewingNote(null);
      } catch (e: any) {
        Alert.alert(t('notesScreen.alert.error'), e.message || t('notesScreen.alert.deleteError'));
      }
    },
    [deleteNote]
  );

  const openViewer = useCallback((note: Note) => {
    setViewingNote(note);
    setViewerVisible(true);
  }, []);

  const openEditor = useCallback((note?: Note) => {
    setEditingNote(note ?? null);
    setEditorVisible(true);
  }, []);

  // Adultes uniquement
  if (isChildMode) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Cette section est réservée aux adultes
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: typeof listData[number] }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {item.category}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textFaint }]}>
            {item.count}
          </Text>
        </View>
      );
    }

    const note = item.note;
    return (
      <SwipeToDelete
        onDelete={() => handleDelete(note)}
        confirmMessage={`Supprimer « ${note.title} » ?`}
        hintId="notes"
      >
        <TouchableOpacity
          style={[styles.noteCard, { backgroundColor: colors.card }]}
          onPress={() => openViewer(note)}
          onLongPress={() => openEditor(note)}
          activeOpacity={0.7}
          accessibilityLabel={`${note.title}, ${formatDateLocalized(note.created)}${note.url ? ', article web' : ''}`}
          accessibilityRole="button"
          accessibilityHint="Appuyez pour lire, appui long pour modifier"
        >
          <View style={styles.noteHeader}>
            <Text
              style={[styles.noteTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {note.title}
            </Text>
            {note.url && (
              <Text style={[styles.urlIndicator, { color: primary }]}>🔗</Text>
            )}
          </View>
          <Text
            style={[styles.notePreview, { color: colors.textSub }]}
            numberOfLines={2}
          >
            {note.content.slice(0, 120)}
          </Text>
          <View style={styles.noteMeta}>
            <Text style={[styles.noteDate, { color: colors.textFaint }]}>
              {formatDateLocalized(note.created)}
            </Text>
            {note.tags.length > 0 && (
              <View style={styles.tagRow}>
                {note.tags.slice(0, 3).map((tag) => (
                  <Chip key={tag} label={tag} size="sm" />
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </SwipeToDelete>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>Notes & Articles</Text>
          <TouchableOpacity
            onPress={() => openEditor()}
            style={[styles.addButton, { backgroundColor: primary }]}
            accessibilityLabel={t('notesScreen.a11y.addNote')}
            accessibilityRole="button"
          >
            <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Barre de recherche */}
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.text,
            },
          ]}
          placeholder={t('notesScreen.placeholder.search')}
          placeholderTextColor={colors.textFaint}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          accessibilityLabel={t('notesScreen.a11y.searchNote')}
          accessibilityRole="search"
        />

        {/* Filtre catégories */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...NOTE_CATEGORIES]}
          keyExtractor={(item) => item ?? 'all'}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item: cat }) => (
            <Chip
              label={cat ?? 'Toutes'}
              selected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
              size="sm"
            />
          )}
        />
      </View>

      {/* Liste */}
      {listData.length === 0 ? (
        <EmptyState
          emoji="📝"
          title={search || selectedCategory ? 'Aucun résultat' : 'Aucune note'}
          subtitle={search || selectedCategory
            ? 'Essayez un autre filtre'
            : 'Capturez vos idées et informations'}
          ctaLabel={search || selectedCategory ? undefined : 'Créer une note'}
          onCta={search || selectedCategory ? undefined : () => openEditor()}
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) =>
            item.type === 'header' ? `h-${item.category}` : `n-${item.note.sourceFile}`
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        />
      )}

      {/* Modals */}
      <NoteEditor
        visible={editorVisible}
        note={editingNote}
        initialUrl={pendingImportUrl}
        onSave={handleSave}
        onDelete={(noteToDelete) => handleDelete(noteToDelete)}
        onClose={() => {
          setEditorVisible(false);
          setEditingNote(null);
          setPendingImportUrl(undefined);
        }}
      />

      <NoteViewer
        visible={viewerVisible}
        note={viewingNote}
        onClose={() => {
          setViewerVisible(false);
          setViewingNote(null);
        }}
        onEdit={() => {
          setViewerVisible(false);
          if (viewingNote) openEditor(viewingNote);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.heading + 2,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
  chipRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xxs,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  noteCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  noteTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  urlIndicator: {
    fontSize: FontSize.sm,
    marginLeft: Spacing.sm,
  },
  notePreview: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
    marginBottom: Spacing.sm,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteDate: {
    fontSize: FontSize.caption,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.xxs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: LineHeight.loose,
  },
});
