/**
 * tasks.tsx — Full filterable task list
 *
 * All tasks from vault, grouped by source file + section.
 * Filter chips: Tous | Maxence | Enfant 2 | Maison | Courses | Terminées
 * Toggle task completion → updates vault file + awards points
 */

import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
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
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
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
function buildFilters(profiles: Profile[], activeProfile: Profile | null): FilterDef[] {
  const enfants = profiles.filter((p) => p.role === 'enfant');
  const enfantFilters = enfants.map((p) => ({
    id: `enfant:${p.name}`,
    label: p.name,
    emoji: p.avatar,
  }));
  const mesTaches: FilterDef[] = activeProfile
    ? [{ id: 'mes-taches', label: 'Mes tâches', emoji: activeProfile.avatar }]
    : [];
  return [STATIC_FILTERS[0], ...mesTaches, ...enfantFilters, ...STATIC_FILTERS.slice(1)];
}

interface TaskSection {
  title: string;
  data: Task[];
}

// Target files for adding tasks
const TARGET_FILES = [
  { label: '🏠 Maison', value: '02 - Maison/Tâches récurrentes.md' },
  { label: '🧹 Ménage', value: '02 - Maison/Ménage hebdo.md' },
];

function buildTargetFiles(profiles: Profile[]) {
  const enfants = profiles.filter((p) => p.role === 'enfant');
  return [
    ...enfants.map((p) => ({
      label: `${p.avatar} ${p.name}`,
      value: `01 - Enfants/${p.name}/Tâches récurrentes.md`,
    })),
    ...TARGET_FILES,
  ];
}

export default function TasksScreen() {
  const { tasks, menageTasks, courses, vault, profiles, activeProfile, notifPrefs, toggleTask, addTask, deleteTask, refresh, isLoading, vacationTasks, vacationConfig, isVacationActive, refreshGamification } = useVault();
  const { completeTask } = useGamification({ vault, notifPrefs });
  const { primary, tint, colors } = useThemeColors();

  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const filters = useMemo(() => {
    if (isVacationActive) {
      return [
        { id: 'tous', label: 'Tous', emoji: '☀️' },
        { id: 'terminées', label: 'Terminées', emoji: '✅' },
      ];
    }
    return buildFilters(profiles, activeProfile);
  }, [profiles, activeProfile, isVacationActive]);
  const targetFiles = useMemo(() => buildTargetFiles(profiles), [profiles]);
  const [filter, setFilter] = useState('tous');

  // Apply filter param when navigating from dashboard
  useEffect(() => {
    if (filterParam) setFilter(filterParam);
  }, [filterParam]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Add task modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('');
  const [newTaskTarget, setNewTaskTarget] = useState(targetFiles[0]?.value ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Track whether we already sent the "all done" notification today
  const allDoneSentRef = useRef(false);

  const handleTaskToggle = useCallback(
    async (task: Task, completed: boolean) => {
      try {
        // Optimistic toggle — updates state immediately
        await toggleTask(task, completed);

        if (completed && activeProfile) {
          try {
            const { lootAwarded, pointsGained } = await completeTask(activeProfile, task.text);
            await refreshGamification();
            if (lootAwarded) {
              Alert.alert('🎁 Récompense !', `+${pointsGained} pts ! Tu as gagné une récompense ! Va dans Menu > Récompenses pour l'ouvrir.`);
            } else {
              Alert.alert('✅ +' + pointsGained + ' pts !', `Bravo ${activeProfile.name} !`, [{ text: 'Super !' }]);
            }
          } catch {
            // Gamification error — non-critical
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
      } catch (e) {
        Alert.alert('Erreur', String(e));
        await refresh();
      }
    },
    [toggleTask, activeProfile, profiles, tasks, courses, completeTask, refresh, notifPrefs, refreshGamification]
  );

  const handleAddTask = useCallback(async () => {
    if (!newTaskText.trim()) {
      Alert.alert('Champ requis', 'Le texte de la tâche est obligatoire.');
      return;
    }
    if (newTaskDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(newTaskDueDate)) {
      Alert.alert('Date incorrecte', 'Veuillez entrer la date au format année-mois-jour.\nExemple : 2026-03-15 pour le 15 mars 2026.');
      return;
    }
    setIsSaving(true);
    try {
      await addTask(newTaskText.trim(), newTaskTarget, newTaskDueDate || undefined, newTaskRecurrence || undefined);
      setNewTaskText('');
      setNewTaskDueDate('');
      setNewTaskRecurrence('');
      setAddModalVisible(false);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setIsSaving(false);
    }
  }, [newTaskText, newTaskDueDate, newTaskRecurrence, newTaskTarget, addTask]);

  const handleDeleteTask = useCallback(async (task: Task) => {
    if (activeProfile?.role === 'enfant') {
      Alert.alert('🔒 Admin requis', 'Seuls les adultes peuvent supprimer des tâches.');
      return;
    }
    Alert.alert(
      '🗑️ Supprimer la tâche',
      `Supprimer « ${task.text} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(task.sourceFile, task.lineIndex);
            } catch (e) {
              Alert.alert('Erreur', String(e));
            }
          },
        },
      ]
    );
  }, [deleteTask, activeProfile]);

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

    if (isVacationActive) {
      result = [...vacationTasks];
      if (filter === 'terminées') {
        result = result.filter((t) => t.completed);
      } else {
        result = result.filter((t) => !t.completed);
      }
    } else {
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
      if (filter === 'mes-taches') {
        if (activeProfile) {
          const nameNorm = activeProfile.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
          result = result.filter((t) =>
            t.mentions.some((m) => m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '') === nameNorm)
          );
        }
      } else if (filter.startsWith('enfant:')) {
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
  }, [tasks, menageTasks, coursesTasks, vacationTasks, isVacationActive, filter, search]);

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

  const completedCount = isVacationActive
    ? vacationTasks.filter((t) => t.completed).length
    : [...tasks, ...coursesTasks].filter((t) => t.completed).length;
  const totalCount = isVacationActive
    ? vacationTasks.length
    : [...tasks, ...coursesTasks].length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{isVacationActive ? '☀️ Vacances' : '📋 Tâches'}</Text>
        <Text style={[styles.stats, { color: colors.textMuted }]}>
          {completedCount}/{totalCount} terminées
        </Text>
      </View>

      {/* Vacation banner */}
      {isVacationActive && vacationConfig && (
        <View style={styles.vacationBanner}>
          <Text style={styles.vacationBannerText}>
            ☀️ Mode Vacances — du {vacationConfig.startDate.split('-').reverse().join('/')} au {vacationConfig.endDate.split('-').reverse().join('/')}
          </Text>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.text }]}
          placeholder="Rechercher..."
          placeholderTextColor={colors.textFaint}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <View style={[styles.filterWrapper, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
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
                { backgroundColor: colors.cardAlt },
                filter === f.id && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={styles.chipEmoji}>{f.emoji}</Text>
              <Text style={[
                styles.chipText,
                { color: colors.textMuted },
                filter === f.id && { color: primary },
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Long-press hint */}
      {sections.length > 0 && (
        <View style={styles.deleteTip}>
          <Text style={styles.deleteTipText}>💡 Appui long sur une tâche pour la supprimer</Text>
        </View>
      )}

      {/* Task list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard task={item} onToggle={handleTaskToggle} onLongPress={() => handleDeleteTask(item)} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
            <Text style={[styles.sectionCount, { color: colors.textFaint }]}>{section.data.length}</Text>
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
            <Text style={[styles.emptyText, { color: colors.textFaint }]}>Aucune tâche dans cette catégorie !</Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primary }]}
        onPress={() => {
          setNewTaskTarget(isVacationActive ? '02 - Maison/Vacances.md' : (targetFiles[0]?.value ?? ''));
          setAddModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={[styles.modalClose, { color: colors.textFaint }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nouvelle tâche</Text>
            <TouchableOpacity onPress={handleAddTask} disabled={isSaving}>
              <Text style={[styles.modalSave, { color: primary }]}>
                {isSaving ? '...' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalLabel, { color: colors.textSub }]}>📝 Tâche *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={newTaskText}
              onChangeText={setNewTaskText}
              placeholder="Ex: Acheter cadeau anniversaire"
              placeholderTextColor={colors.textFaint}
              autoFocus
              multiline
            />

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>📅 Date d'échéance (optionnel)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={newTaskDueDate}
              onChangeText={setNewTaskDueDate}
              placeholder="Format : 2026-03-15 (année-mois-jour)"
              placeholderTextColor={colors.textFaint}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>🔁 Se répète (optionnel)</Text>
            <View style={styles.targetRow}>
              {[
                { label: 'Aucune', value: '' },
                { label: 'Chaque jour', value: 'every day' },
                { label: 'Chaque semaine', value: 'every week' },
                { label: 'Chaque mois', value: 'every month' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.targetChip,
                    { backgroundColor: colors.cardAlt },
                    newTaskRecurrence === opt.value && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => setNewTaskRecurrence(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.targetChipText,
                    { color: colors.textMuted },
                    newTaskRecurrence === opt.value && { color: primary, fontWeight: '700' },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>📁 Enregistrer pour</Text>
            <View style={styles.targetRow}>
              {targetFiles.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.targetChip,
                    { backgroundColor: colors.cardAlt },
                    newTaskTarget === t.value && { backgroundColor: tint, borderColor: primary },
                  ]}
                  onPress={() => setNewTaskTarget(t.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.targetChipText,
                    { color: colors.textMuted },
                    newTaskTarget === t.value && { color: primary, fontWeight: '700' },
                  ]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function getFileLabel(sourceFile: string): string {
  if (sourceFile.includes('Vacances')) return '☀️ Checklist Vacances';
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  stats: {
    fontSize: 13,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
  },
  filterWrapper: {
    borderBottomWidth: 1,
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  vacationBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  vacationBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
  deleteTip: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  deleteTipText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
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
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 30,
  },
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalClose: { fontSize: 20, padding: 4 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSave: { fontSize: 15, fontWeight: '700', padding: 4 },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, gap: 16, paddingBottom: 40 },
  modalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  targetChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
