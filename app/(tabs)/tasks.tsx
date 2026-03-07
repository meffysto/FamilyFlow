/**
 * tasks.tsx — Full filterable task list
 *
 * All tasks from vault, grouped by source file + section.
 * Filter chips: Tous | Maxence | Enfant 2 | Maison | Courses | Terminées
 * Toggle task completion → updates vault file + awards points
 */

import { useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVault } from '../../hooks/useVault';
import { useGamification } from '../../hooks/useGamification';
import { useThemeColors } from '../../contexts/ThemeContext';
import { TaskCard } from '../../components/TaskCard';
import {
  dispatchNotificationAsync,
  buildAllTasksDoneContext,
} from '../../lib/notifications';
import { Task, CourseItem, Profile } from '../../lib/types';

interface FilterDef {
  id: string;
  label: string;
  emoji: string;
}

const STATIC_FILTERS: FilterDef[] = [
  { id: 'tous', label: 'Tous', emoji: '📋' },
  { id: 'maison', label: 'Maison', emoji: '🏠' },
  { id: 'courses', label: 'Courses', emoji: '🛒' },
  { id: 'terminées', label: 'Terminées', emoji: '✅' },
];

/** Build dynamic filters from enfant profiles */
function buildFilters(profiles: Profile[]): FilterDef[] {
  const enfants = profiles.filter((p) => p.role === 'enfant');
  const enfantFilters = enfants.map((p) => ({
    id: `enfant:${p.name}`,
    label: p.name,
    emoji: p.avatar,
  }));
  // Insert enfant filters after "Tous"
  return [STATIC_FILTERS[0], ...enfantFilters, ...STATIC_FILTERS.slice(1)];
}

interface TaskSection {
  title: string;
  data: Task[];
}

export default function TasksScreen() {
  const { tasks, menageTasks, courses, vault, profiles, activeProfile, notifPrefs, refresh, isLoading } = useVault();
  const { completeTask } = useGamification({ vault, notifPrefs });
  const { primary, tint } = useThemeColors();

  const filters = useMemo(() => buildFilters(profiles), [profiles]);
  const [filter, setFilter] = useState('tous');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Track whether we already sent the "all done" notification today
  const allDoneSentRef = useRef(false);

  const handleTaskToggle = useCallback(
    async (task: Task, completed: boolean) => {
      if (!vault) return;
      try {
        await vault.toggleTask(task.sourceFile, task.lineIndex, completed);
        if (completed && activeProfile) {
          const { lootAwarded, pointsGained } = await completeTask(activeProfile, task.text);
          if (lootAwarded) {
            Alert.alert('🎁 Loot Box !', `+${pointsGained} pts ! Tu as gagné une loot box ! Va dans l'onglet Loot pour l'ouvrir.`);
          } else {
            Alert.alert('✅ +' + pointsGained + ' pts !', `Bravo ${activeProfile.name} !`, [{ text: 'Super !' }]);
          }

          // Check if all tasks are now done → send "journée terminée" notification
          if (!allDoneSentRef.current) {
            const allItems = [
              ...tasks,
              ...courses.map((c) => ({ ...c, completed: c.completed })),
            ];
            const remaining = allItems.filter((t) => !t.completed && t.id !== task.id).length;
            if (remaining === 0) {
              allDoneSentRef.current = true;
              const totalDone = allItems.filter((t) => t.completed).length + 1;
              dispatchNotificationAsync(
                'all_tasks_done',
                buildAllTasksDoneContext(totalDone, profiles),
                notifPrefs
              );
            }
          }
        }
        await refresh();
      } catch (e) {
        Alert.alert('Erreur', String(e));
      }
    },
    [vault, activeProfile, profiles, tasks, courses, completeTask, refresh, notifPrefs]
  );

  // Convert courses to Task-like objects for display
  const coursesTasks: Task[] = useMemo(
    () =>
      courses.map((c) => ({
        id: c.id,
        text: c.text,
        completed: c.completed,
        tags: ['courses'],
        mentions: [],
        sourceFile: '02 - Maison/Liste de courses.md',
        lineIndex: c.lineIndex,
      })),
    [courses]
  );

  // Filter + search
  const allTasks = useMemo(() => {
    let result: Task[] = [];

    if (filter === 'courses') {
      result = coursesTasks;
    } else {
      result = [
        ...tasks,
        ...menageTasks,
        ...(filter === 'tous' ? coursesTasks : []),
      ];
    }

    // Apply filter
    if (filter.startsWith('enfant:')) {
      const enfantName = filter.slice('enfant:'.length);
      result = result.filter((t) => t.sourceFile.includes(enfantName));
    } else if (filter === 'maison') {
      result = result.filter(
        (t) =>
          t.sourceFile.includes('Maison') ||
          t.sourceFile.includes('courses') ||
          t.sourceFile.includes('Courses')
      );
    } else if (filter === 'terminées') {
      result = result.filter((t) => t.completed);
    } else {
      result = result.filter((t) => !t.completed);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.text.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.section?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [tasks, menageTasks, coursesTasks, filter, search]);

  // Group by source file
  const sections: TaskSection[] = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const task of allTasks) {
      const key = task.sourceFile;
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }

    return Object.entries(groups).map(([file, data]) => ({
      title: getFileLabel(file),
      data,
    }));
  }, [allTasks]);

  const completedCount = [...tasks, ...coursesTasks].filter((t) => t.completed).length;
  const totalCount = [...tasks, ...coursesTasks].length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Tâches</Text>
        <Text style={styles.stats}>
          {completedCount}/{totalCount} terminées
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {filters.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.chip,
                filter === f.id && styles.chipActive,
                filter === f.id && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={styles.chipEmoji}>{f.emoji}</Text>
              <Text style={[
                styles.chipText,
                filter === f.id && { color: primary },
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Task list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard task={item} onToggle={handleTaskToggle} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyText}>Aucune tâche dans cette catégorie !</Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

function getFileLabel(sourceFile: string): string {
  if (sourceFile.includes('Ménage')) return '🧹 Ménage hebdo';
  if (sourceFile.includes('courses') || sourceFile.includes('Courses')) return '🛒 Liste de courses';
  if (sourceFile.includes('Maison')) return '🏠 Maison — Tâches';
  // Extract folder name for enfant tasks (e.g. "01 - Enfants/Maxence/..." → "Maxence")
  const parts = sourceFile.split('/');
  const fileName = parts.pop()?.replace('.md', '') ?? '';
  const folder = parts.length >= 2 ? parts[parts.length - 1] : '';
  if (sourceFile.includes('Enfants') && folder) return `👶 ${folder} — ${fileName}`;
  return `📄 ${fileName || sourceFile}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  stats: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: '#111827',
  },
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    height: 56,
  },
  filterContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    // Colors applied inline via dynamic theme
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
