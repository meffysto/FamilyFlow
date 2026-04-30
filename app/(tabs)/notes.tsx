// Notes & Articles — import web (defuddle), création/édition, catégories. Adultes only.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius, Layout } from '../../constants/spacing';
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
import { ScreenHeader } from '../../components/ui/ScreenHeader';

type NoteListRow =
  | { type: 'header'; category: string; count: number }
  | { type: 'note'; note: Note };

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList as new () => FlatList<NoteListRow>,
);

interface NoteRowProps {
  note: Note;
  cardBg: string;
  textColor: string;
  textSubColor: string;
  textFaintColor: string;
  primaryColor: string;
  hint: string;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
  onDelete: (note: Note) => void;
}

const NoteRow = React.memo(function NoteRow({
  note,
  cardBg,
  textColor,
  textSubColor,
  textFaintColor,
  primaryColor,
  hint,
  onPress,
  onLongPress,
  onDelete,
}: NoteRowProps) {
  return (
    <SwipeToDelete onDelete={() => onDelete(note)} skipConfirm hintId="notes">
      <TouchableOpacity
        style={[styles.noteCard, { backgroundColor: cardBg }]}
        onPress={() => onPress(note)}
        onLongPress={() => onLongPress(note)}
        activeOpacity={0.7}
        accessibilityLabel={`${note.title}, ${formatDateLocalized(note.created)}${note.url ? ', article web' : ''}`}
        accessibilityRole="button"
        accessibilityHint={hint}
      >
        <View style={styles.noteHeader}>
          <Text style={[styles.noteTitle, { color: textColor }]} numberOfLines={1}>
            {note.title}
          </Text>
          {note.url && (
            <Text style={[styles.urlIndicator, { color: primaryColor }]}>🔗</Text>
          )}
        </View>
        <Text style={[styles.notePreview, { color: textSubColor }]} numberOfLines={2}>
          {note.content.slice(0, 120)}
        </Text>
        <View style={styles.noteMeta}>
          <Text style={[styles.noteDate, { color: textFaintColor }]}>
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
});

const CATEGORY_KEY_MAP: Record<string, string> = {
  '📋 Administratif': 'administratif',
  '🏥 Santé': 'sante',
  '🎓 École': 'ecole',
  '💰 Finances': 'finances',
  '📖 Articles': 'articles',
  '📌 Divers': 'divers',
};

export default function NotesScreen() {
  const { t } = useTranslation();
  const translateCategory = useCallback(
    (cat: string) => {
      const key = CATEGORY_KEY_MAP[cat];
      return key ? t(`notesScreen.categories.${key}`) : cat;
    },
    [t],
  );
  const { notes, addNote, updateNote, deleteNote, activeProfile, refresh } = useVault();
  const { primary, colors, isDark } = useThemeColors();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

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
    const data: NoteListRow[] = [];
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

  // Reset scroll au changement de filtre (évite collapse fantôme)
  useEffect(() => {
    scrollY.value = 0;
  }, [selectedCategory]);

  // Adultes uniquement
  if (isChildMode) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
        <StatusBar style={isDark ? 'light' : 'dark'} translucent />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('notesScreen.childOnly')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const noteHint = t('notesScreen.a11y.noteHint');
  const renderItem = useCallback(
    ({ item }: { item: NoteListRow }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              {translateCategory(item.category)}
            </Text>
            <Text style={[styles.sectionCount, { color: colors.textFaint }]}>
              {item.count}
            </Text>
          </View>
        );
      }
      return (
        <NoteRow
          note={item.note}
          cardBg={colors.card}
          textColor={colors.text}
          textSubColor={colors.textSub}
          textFaintColor={colors.textFaint}
          primaryColor={primary}
          hint={noteHint}
          onPress={openViewer}
          onLongPress={openEditor}
          onDelete={handleDelete}
        />
      );
    },
    [colors, primary, noteHint, handleDelete, openViewer, openEditor, translateCategory],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('notesScreen.title')}
        subtitle={notes.length > 0 ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : undefined}
        actions={
          <TouchableOpacity
            onPress={() => openEditor()}
            style={[styles.addButton, { backgroundColor: primary }]}
            activeOpacity={0.7}
            accessibilityLabel={t('notesScreen.a11y.addNote')}
            accessibilityRole="button"
          >
            <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>+</Text>
          </TouchableOpacity>
        }
        bottom={
          <View>
            <View style={styles.searchRow}>
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
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[null, ...NOTE_CATEGORIES]}
              keyExtractor={(item) => item ?? 'all'}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item: cat }) => (
                <Chip
                  label={cat ? translateCategory(cat) : t('notesScreen.allCategories', { defaultValue: 'All' })}
                  selected={selectedCategory === cat}
                  onPress={() => setSelectedCategory(cat)}
                  size="sm"
                />
              )}
            />
          </View>
        }
        scrollY={scrollY}
      />

      {/* Liste */}
      {listData.length === 0 ? (
        <EmptyState
          emoji="📝"
          title={search || selectedCategory ? t('notesScreen.empty.noResults') : t('notesScreen.empty.noNotes')}
          subtitle={search || selectedCategory
            ? t('notesScreen.empty.tryAnotherFilter')
            : t('notesScreen.empty.captureIdeas')}
          ctaLabel={search || selectedCategory ? undefined : t('notesScreen.empty.createNote')}
          onCta={search || selectedCategory ? undefined : () => openEditor()}
        />
      ) : (
        <AnimatedFlatList
          data={listData}
          keyExtractor={(item) =>
            item.type === 'header' ? `h-${item.category}` : `n-${item.note.sourceFile}`}
          renderItem={renderItem}
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.listContent, Layout.contentContainer]}
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    lineHeight: 18,
  },
  searchRow: {
    paddingVertical: Spacing.xxs,
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
    paddingVertical: Spacing.xs,
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
