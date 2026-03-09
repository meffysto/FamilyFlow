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
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useGamification } from '../../hooks/useGamification';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { TaskCard } from '../../components/TaskCard';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { Chip } from '../../components/ui/Chip';
import { DateInput } from '../../components/ui/DateInput';
import { EmptyState } from '../../components/EmptyState';
import {
  dispatchNotificationAsync,
  buildAllTasksDoneContext,
} from '../../lib/notifications';
import { Task, CourseItem, Profile } from '../../lib/types';
import { formatDateForDisplay } from '../../lib/parser';

interface FilterDef {
  id: string;
  label: string;
  emoji: string;
}

const STATIC_FILTERS: FilterDef[] = [
  { id: 'tous', label: 'Tous', emoji: '📋' },
  { id: 'maison', label: 'Maison', emoji: '🏠' },
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
  const { tasks, menageTasks, vault, profiles, activeProfile, notifPrefs, toggleTask, addTask, deleteTask, refresh, isLoading, vacationTasks, vacationConfig, isVacationActive, refreshGamification } = useVault();
  const { completeTask } = useGamification({ vault, notifPrefs });
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const { filter: filterParam, addNew } = useLocalSearchParams<{ filter?: string; addNew?: string }>();

  // FAB: ouvrir le modal d'ajout si addNew=1
  useEffect(() => {
    if (addNew === '1') setAddModalVisible(true);
  }, [addNew]);
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
              showToast(`🎁 Récompense ! +${pointsGained} pts`);
            } else {
              showToast(`✅ +${pointsGained} pts !`);
            }
          } catch {
            // Gamification error — non-critical
          }

          // Check if all tasks are now done → send "journée terminée" notification
          if (!allDoneSentRef.current) {
            const remaining = tasks.filter((t) => !t.completed && t.id !== task.id).length;
            if (remaining === 0) {
              allDoneSentRef.current = true;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setTimeout(() => showToast('🎉 Journée terminée ! Toutes les tâches sont faites !'), 300);
              const totalDone = tasks.filter((t) => t.completed).length + 1;
              dispatchNotificationAsync(
                'all_tasks_done',
                buildAllTasksDoneContext(totalDone, profiles),
                notifPrefs
              );
            }
          }
        }
      } catch (e) {
        showToast(String(e), 'error');
        await refresh();
      }
    },
    [toggleTask, activeProfile, profiles, tasks, completeTask, refresh, notifPrefs, refreshGamification, showToast]
  );

  const handleAddTask = useCallback(async () => {
    if (!newTaskText.trim()) {
      showToast('Le texte de la tâche est obligatoire', 'error');
      return;
    }
    if (newTaskDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(newTaskDueDate)) {
      showToast('Date incorrecte (format : 2026-03-15)', 'error');
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
      showToast(String(e), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [newTaskText, newTaskDueDate, newTaskRecurrence, newTaskTarget, addTask, showToast]);

  const handleDeleteTask = useCallback(async (task: Task) => {
    if (activeProfile?.role === 'enfant') {
      showToast('🔒 Seuls les adultes peuvent supprimer des tâches', 'error');
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
      result = [
        ...tasks,
        ...menageTasks,
      ];

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
          (t) => t.sourceFile.includes('Maison')
        );
      } else if (filter === 'terminées') {
        result = result.filter((t) => t.completed);
      } else {
        result = result.filter((t) => !t.completed);
      }
    }

    // Masquer les tâches récurrentes dont la date est dans le futur (déjà validées aujourd'hui)
    if (filter !== 'terminées') {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter((t) => {
        if (t.recurrence && t.dueDate && t.dueDate > today) return false;
        return true;
      });
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
  }, [tasks, menageTasks, vacationTasks, isVacationActive, filter, search]);

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
    : tasks.filter((t) => t.completed).length;
  const totalCount = isVacationActive
    ? vacationTasks.length
    : tasks.length;

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
        <View style={[styles.vacationBanner, { backgroundColor: colors.warningBg, borderBottomColor: colors.warning }]}>
          <Text style={[styles.vacationBannerText, { color: colors.warningText }]}>
            ☀️ Mode Vacances — du {formatDateForDisplay(vacationConfig.startDate)} au {formatDateForDisplay(vacationConfig.endDate)}
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
            <Chip
              key={f.id}
              label={f.label}
              emoji={f.emoji}
              selected={filter === f.id}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Swipe hint */}
      {sections.length > 0 && (
        <View style={[styles.deleteTip, { backgroundColor: colors.warningBg, borderBottomColor: colors.warning }]}>
          <Text style={[styles.deleteTipText, { color: colors.warningText }]}>💡 Glissez une tâche vers la gauche pour la supprimer</Text>
        </View>
      )}

      {/* Task list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeToDelete
            onDelete={() => handleDeleteTask(item)}
            disabled={item.completed}
            hintId="tasks"
          >
            <TaskCard task={item} onToggle={handleTaskToggle} />
          </SwipeToDelete>
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
          filter === 'done'
            ? <EmptyState emoji="🎯" title="Aucune tâche terminée" subtitle="Termine tes premières tâches pour les voir ici" />
            : <EmptyState emoji="✅" title="Bravo, tout est fait !" subtitle="Profite bien de ton temps libre 🎉" />
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
        <Text style={[styles.fabText, { color: colors.onPrimary }]}>+</Text>
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
            <DateInput value={newTaskDueDate} onChange={setNewTaskDueDate} placeholder="Choisir une date" />

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>🔁 Se répète (optionnel)</Text>
            <View style={styles.targetRow}>
              {[
                { label: 'Aucune', value: '' },
                { label: 'Chaque jour', value: 'every day' },
                { label: 'Chaque semaine', value: 'every week' },
                { label: 'Chaque mois', value: 'every month' },
              ].map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={newTaskRecurrence === opt.value}
                  onPress={() => setNewTaskRecurrence(opt.value)}
                  size="sm"
                />
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>📁 Enregistrer pour</Text>
            <View style={styles.targetRow}>
              {targetFiles.map((t) => (
                <Chip
                  key={t.value}
                  label={t.label}
                  selected={newTaskTarget === t.value}
                  onPress={() => setNewTaskTarget(t.value)}
                  size="sm"
                />
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
  vacationBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  vacationBannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteTip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  deleteTipText: {
    fontSize: 12,
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
});
