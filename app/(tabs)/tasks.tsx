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
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, interpolateColor, useDerivedValue } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useGamification } from '../../hooks/useGamification';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { TaskCard } from '../../components/TaskCard';
import { SecretMissionCard } from '../../components/SecretMissionCard';
import { SecretMissionCreator } from '../../components/SecretMissionCreator';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { Chip } from '../../components/ui/Chip';
import { DateInput } from '../../components/ui/DateInput';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { EmptyState } from '../../components/EmptyState';
import { AllDoneOverlay } from '../../components/AllDoneOverlay';
import { getTheme } from '../../constants/themes';
import { POINTS_PER_TASK } from '../../lib/gamification';
import {
  dispatchNotificationAsync,
  buildAllTasksDoneContext,
} from '../../lib/notifications';
import { Task, CourseItem, Profile } from '../../lib/types';
import { formatDateForDisplay } from '../../lib/parser';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';

interface FilterDef {
  id: string;
  label: string;
  emoji: string;
}

// ─── Météo des tâches (profils enfants) ─────────────────────────────────────

const WEATHER_STAGES = [
  { threshold: 0,    emoji: '⛈️', label: 'Orage…',           message: 'Allez, on commence !' },
  { threshold: 0.25, emoji: '🌧️', label: 'Pluie',            message: 'Continue comme ça !' },
  { threshold: 0.50, emoji: '⛅',  label: 'Nuages',           message: 'Le soleil arrive !' },
  { threshold: 0.75, emoji: '☀️', label: 'Soleil',            message: 'Presque fini !' },
  { threshold: 1.00, emoji: '🌈', label: 'Arc-en-ciel !',    message: 'Bravo, tout est fait !' },
];

const WEATHER_COLORS = ['#4B5563', '#6B7280', '#93C5FD', '#FDE68A', '#C4B5FD'];

function getWeatherStage(progress: number) {
  for (let i = WEATHER_STAGES.length - 1; i >= 0; i--) {
    if (progress >= WEATHER_STAGES[i].threshold) return i;
  }
  return 0;
}

/** Bandeau météo animé pour les enfants */
function TaskWeather({ completed, total }: { completed: number; total: number }) {
  const progress = total > 0 ? completed / total : 0;
  const stageIdx = getWeatherStage(progress);
  const stage = WEATHER_STAGES[stageIdx];

  const animProgress = useSharedValue(progress);

  useEffect(() => {
    animProgress.value = withSpring(progress, { damping: 15, stiffness: 90 });
  }, [progress]);

  const bgStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      animProgress.value,
      [0, 0.25, 0.5, 0.75, 1],
      WEATHER_COLORS,
    );
    return { backgroundColor: bg };
  });

  const emojiScale = useDerivedValue(() =>
    withSpring(1 + animProgress.value * 0.3, { damping: 12 }),
  );

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  return (
    <Animated.View style={[weatherStyles.container, bgStyle]}>
      <Animated.Text style={[weatherStyles.emoji, emojiStyle]}>{stage.emoji}</Animated.Text>
      <View style={weatherStyles.textCol}>
        <Text style={weatherStyles.label}>{stage.label}</Text>
        <Text style={weatherStyles.message}>{stage.message}</Text>
      </View>
      <Text style={weatherStyles.count}>{completed}/{total}</Text>
    </Animated.View>
  );
}

const weatherStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
  },
  emoji: {
    fontSize: FontSize.hero,
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1F2937',
  },
  message: {
    fontSize: FontSize.label,
    color: '#374151',
    marginTop: 2,
  },
  count: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    color: '#4B5563',
  },
});

const STATIC_FILTERS: FilterDef[] = [
  { id: 'tous', label: 'Tous', emoji: '📋' },
  { id: 'maison', label: 'Maison', emoji: '🏠' },
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
  const { tasks, menageTasks, vault, profiles, activeProfile, notifPrefs, toggleTask, addTask, editTask, deleteTask, refresh, isLoading, vacationTasks, vacationConfig, isVacationActive, refreshGamification, secretMissions, completeSecretMission, validateSecretMission } = useVault();
  const { completeTask } = useGamification({ vault, notifPrefs });
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const { filter: filterParam, addNew } = useLocalSearchParams<{ filter?: string; addNew?: string }>();

  // Refs pour les coach marks
  const taskListRef = useRef<View>(null);
  const filterRef = useRef<View>(null);

  // FAB: ouvrir le modal d'ajout si addNew=1
  useEffect(() => {
    if (addNew === '1') setAddModalVisible(true);
  }, [addNew]);
  const filters = useMemo(() => {
    if (isVacationActive) {
      return [
        { id: 'tous', label: 'Tous', emoji: '☀️' },
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
  const [missionCreatorVisible, setMissionCreatorVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('');
  const [newTaskTarget, setNewTaskTarget] = useState(targetFiles[0]?.value ?? '');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Edit task modal
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTaskText, setEditTaskText] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskRecurrence, setEditTaskRecurrence] = useState('');
  const [editTaskTarget, setEditTaskTarget] = useState('');
  const [editTaskAssignees, setEditTaskAssignees] = useState<string[]>([]);
  const [isEditSaving, setIsEditSaving] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Track whether we already sent the "all done" notification today
  const allDoneSentRef = useRef(false);
  const [showAllDone, setShowAllDone] = useState(false);

  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
  const isParent = activeProfile?.role === 'adulte';

  // Missions secrètes filtrées selon le mode
  const visibleMissions = useMemo(() => {
    if (!activeProfile) return [];
    if (isChildMode) {
      return secretMissions.filter(
        (m) => m.targetProfileId === activeProfile.id && m.secretStatus !== 'validated',
      );
    }
    // Parent : toutes les missions non validées
    return secretMissions.filter((m) => m.secretStatus !== 'validated');
  }, [secretMissions, activeProfile, isChildMode]);

  const handleTaskToggle = useCallback(
    async (task: Task, completed: boolean) => {
      try {
        // Optimistic toggle — updates state immediately
        await toggleTask(task, completed);

        if (completed && activeProfile) {
          try {
            const { lootAwarded, pointsGained } = await completeTask(activeProfile, task.text);
            await refreshGamification();
            const themeEmoji = getTheme(activeProfile.theme).emoji;
            const name = activeProfile.name;
            const taskShort = task.text.length > 25 ? task.text.slice(0, 25) + '…' : task.text;
            if (lootAwarded) {
              showToast(`${themeEmoji} Bravo ${name} ! ${taskShort} → +${pointsGained} pts + 🎁`);
            } else {
              showToast(`${themeEmoji} Bravo ${name} ! ${taskShort} → +${pointsGained} pts`);
            }
          } catch {
            // Gamification error — non-critical
          }

          // Check if all tasks are now done → show celebration overlay
          if (!allDoneSentRef.current) {
            const remaining = tasks.filter((t) => !t.completed && t.id !== task.id).length;
            if (remaining === 0) {
              allDoneSentRef.current = true;
              const totalDone = tasks.filter((t) => t.completed).length + 1;
              setTimeout(() => setShowAllDone(true), 300);
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
      const mentions = newTaskAssignees.map((n) => `@${n}`).join(' ');
      const fullText = mentions ? `${newTaskText.trim()} ${mentions}` : newTaskText.trim();
      await addTask(fullText, newTaskTarget, newTaskDueDate || undefined, newTaskRecurrence || undefined);
      setNewTaskText('');
      setNewTaskDueDate('');
      setNewTaskRecurrence('');
      setNewTaskAssignees([]);
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

  const handleOpenEdit = useCallback((task: Task) => {
    if (activeProfile?.role === 'enfant') {
      showToast('Seuls les adultes peuvent modifier des tâches', 'error');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingTask(task);
    setEditTaskText(task.text);
    setEditTaskDueDate(task.dueDate ?? '');
    setEditTaskRecurrence(task.recurrence ?? '');
    setEditTaskTarget(task.sourceFile);
    setEditTaskAssignees(task.mentions ?? []);
    setEditModalVisible(true);
  }, [activeProfile, showToast]);

  const handleEditTask = useCallback(async () => {
    if (!editingTask) return;
    if (!editTaskText.trim()) {
      showToast('Le texte de la tâche est obligatoire', 'error');
      return;
    }
    if (editTaskDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(editTaskDueDate)) {
      showToast('Date incorrecte (format : 2026-03-15)', 'error');
      return;
    }
    setIsEditSaving(true);
    try {
      // Retirer les anciennes mentions du texte, puis ajouter les nouvelles
      const cleanText = editTaskText.trim().replace(/@\S+/g, '').trim();
      const mentions = editTaskAssignees.map((n) => `@${n}`).join(' ');
      const fullText = mentions ? `${cleanText} ${mentions}` : cleanText;
      await editTask(editingTask, {
        text: fullText,
        dueDate: editTaskDueDate || undefined,
        recurrence: editTaskRecurrence || undefined,
        targetFile: editTaskTarget || undefined,
      });
      setEditModalVisible(false);
      setEditingTask(null);
      showToast('Tâche modifiée');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setIsEditSaving(false);
    }
  }, [editingTask, editTaskText, editTaskDueDate, editTaskRecurrence, editTaskTarget, editTask, showToast]);

  const handleDeleteFromEdit = useCallback(() => {
    if (!editingTask) return;
    setEditModalVisible(false);
    // Petit délai pour laisser le modal se fermer avant l'alert
    setTimeout(() => handleDeleteTask(editingTask), 300);
  }, [editingTask, handleDeleteTask]);

  const [showCompleted, setShowCompleted] = useState(false);

  // Filter + search
  const { activeTasks, completedTasks } = useMemo(() => {
    let result: Task[] = [];

    if (isVacationActive) {
      result = [...vacationTasks];
    } else {
      result = [...tasks, ...menageTasks];

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
        result = result.filter((t) => t.sourceFile.includes('Maison'));
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

    // Séparer actives / terminées
    const today = new Date().toISOString().slice(0, 10);
    const active = result.filter((t) => {
      if (t.completed) return false;
      // Masquer les récurrentes dont la date est dans le futur (déjà validées aujourd'hui)
      if (t.recurrence && t.dueDate && t.dueDate > today) return false;
      return true;
    });
    const completed = result.filter((t) =>
      t.completed ||
      // Récurrentes validées aujourd'hui (date avancée = dans le futur)
      (t.recurrence && t.dueDate && t.dueDate > today && !t.completed)
    );

    return { activeTasks: active, completedTasks: completed };
  }, [tasks, menageTasks, vacationTasks, isVacationActive, filter, search, activeProfile]);

  // Group by source file
  const sections: TaskSection[] = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const task of activeTasks) {
      const key = task.sourceFile;
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }

    return Object.entries(groups).map(([file, data]) => ({
      title: getFileLabel(file),
      data: data.sort((a, b) => {
        // Récurrentes en priorité
        const aRec = a.recurrence ? 0 : 1;
        const bRec = b.recurrence ? 0 : 1;
        if (aRec !== bRec) return aRec - bRec;
        // Puis par date d'échéance (les plus proches d'abord)
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      }),
    }));
  }, [activeTasks]);

  // Sections terminées groupées par fichier
  const completedSections: TaskSection[] = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const task of completedTasks) {
      const key = task.sourceFile;
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }
    return Object.entries(groups).map(([file, data]) => ({
      title: getFileLabel(file),
      data,
    }));
  }, [completedTasks]);

  const completedCount = isVacationActive
    ? vacationTasks.filter((t) => t.completed).length
    : tasks.filter((t) => t.completed).length;
  const totalCount = isVacationActive
    ? vacationTasks.length
    : tasks.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View ref={taskListRef} style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{isVacationActive ? '☀️ Vacances' : '📋 Tâches'}</Text>
        {(activeProfile?.role !== 'enfant') && (
          <Text style={[styles.stats, { color: colors.textMuted }]}>
            {completedCount}/{totalCount} terminées
          </Text>
        )}
      </View>

      {/* Météo des tâches (enfants uniquement) */}
      {activeProfile?.role === 'enfant' && totalCount > 0 && (
        <TaskWeather completed={completedCount} total={totalCount} />
      )}

      {/* Vacation banner */}
      {isVacationActive && vacationConfig && (
        <View style={[styles.vacationBanner, { backgroundColor: colors.warningBg, borderBottomColor: colors.warning }]}>
          <Text style={[styles.vacationBannerText, { color: colors.warningText }]}>
            ☀️ Mode Vacances — du {formatDateForDisplay(vacationConfig.startDate)} au {formatDateForDisplay(vacationConfig.endDate)}
          </Text>
        </View>
      )}

      {/* Task list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300))}>
            <SwipeToDelete
              onDelete={() => handleDeleteTask(item)}
              disabled={item.completed}
              hintId="tasks"
            >
              <TaskCard task={item} onToggle={handleTaskToggle} onLongPress={() => handleOpenEdit(item)} pointsOnComplete={isChildMode ? POINTS_PER_TASK : undefined} />
            </SwipeToDelete>
          </Animated.View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
            <Text style={[styles.sectionCount, { color: colors.textFaint }]}>{section.data.length}</Text>
          </View>
        )}
        ListHeaderComponent={
          <>
            <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Rechercher..."
                placeholderTextColor={colors.textFaint}
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
                accessibilityLabel="Rechercher une tâche"
                accessibilityRole="search"
              />
            </View>
            <View ref={filterRef} style={[styles.filterWrapper, { backgroundColor: colors.bg }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContainer}
                directionalLockEnabled
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
            {sections.length > 0 && (
              <View style={[styles.deleteTip, { backgroundColor: colors.warningBg, borderBottomColor: colors.warning }]}>
                <Text style={[styles.deleteTipText, { color: colors.warningText }]}>💡 Glissez pour supprimer · Appui long pour modifier</Text>
              </View>
            )}
            {/* Section missions secrètes */}
            {visibleMissions.length > 0 && (
              <View style={styles.secretMissionsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>🕵️ Missions secrètes</Text>
                  <Text style={[styles.sectionCount, { color: colors.textFaint }]}>{visibleMissions.length}</Text>
                </View>
                {visibleMissions.map((mission) => (
                  <SecretMissionCard
                    key={mission.id}
                    mission={mission}
                    isParent={isParent}
                    onComplete={() => completeSecretMission(mission.id)}
                    onValidate={() => validateSecretMission(mission.id)}
                  />
                ))}
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
        ListEmptyComponent={
          <EmptyState emoji="✅" title="Bravo, tout est fait !" subtitle="Profite bien de ton temps libre 🎉" />
        }
        ListFooterComponent={completedTasks.length > 0 ? (
          <View style={styles.completedSection}>
            <TouchableOpacity
              style={[styles.toggleCompletedBtn, { backgroundColor: colors.cardAlt }]}
              onPress={() => setShowCompleted(!showCompleted)}
              activeOpacity={0.7}
              accessibilityLabel={showCompleted ? 'Masquer les terminées' : `Afficher les terminées (${completedTasks.length})`}
              accessibilityRole="button"
            >
              <Text style={[styles.toggleCompletedText, { color: colors.textMuted }]}>
                {showCompleted ? `🔼 Masquer les terminées` : `🔽 Terminées (${completedTasks.length})`}
              </Text>
            </TouchableOpacity>
            {showCompleted && completedSections.map((section) => (
              <View key={section.title}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
                  <Text style={[styles.sectionCount, { color: colors.textFaint }]}>{section.data.length}</Text>
                </View>
                {section.data.map((item) => (
                  <View key={item.id} style={{ opacity: 0.6 }}>
                    <SwipeToDelete
                      onDelete={() => handleDeleteTask(item)}
                      disabled={false}
                      hintId="tasks"
                    >
                      <TaskCard task={item} onToggle={handleTaskToggle} onLongPress={() => handleOpenEdit(item)} pointsOnComplete={isChildMode ? POINTS_PER_TASK : undefined} />
                    </SwipeToDelete>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}
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
        accessibilityLabel="Ajouter une tâche"
        accessibilityRole="button"
      >
        <Text style={[styles.fabText, { color: colors.onPrimary }]}>+</Text>
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddModalVisible(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
          <ModalHeader
            title="Nouvelle tâche"
            onClose={() => setAddModalVisible(false)}
            rightLabel={isSaving ? '…' : 'Ajouter'}
            onRight={handleAddTask}
            rightDisabled={isSaving}
          />

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

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>👤 Attribuer à (optionnel)</Text>
            <View style={styles.targetRow}>
              {profiles.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.avatar} ${p.name}`}
                  selected={newTaskAssignees.includes(p.name)}
                  onPress={() => setNewTaskAssignees((prev) =>
                    prev.includes(p.name) ? prev.filter((n) => n !== p.name) : [...prev, p.name]
                  )}
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
            {!isChildMode && (
              <TouchableOpacity
                style={[styles.secretMissionBtn, { borderColor: colors.warning }]}
                onPress={() => {
                  setAddModalVisible(false);
                  setMissionCreatorVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.secretMissionBtnText, { color: colors.warning }]}>🕵️ Créer une mission secrète</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal création mission secrète */}
      <SecretMissionCreator
        visible={missionCreatorVisible}
        onClose={() => setMissionCreatorVisible(false)}
      />

      {/* Edit Task Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.card }]}>
          <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
          <ModalHeader
            title="Modifier la tâche"
            onClose={() => setEditModalVisible(false)}
            rightLabel={isEditSaving ? '…' : 'Enregistrer'}
            onRight={handleEditTask}
            rightDisabled={isEditSaving}
          />

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalLabel, { color: colors.textSub }]}>Tâche *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={editTaskText}
              onChangeText={setEditTaskText}
              placeholder="Ex: Acheter cadeau anniversaire"
              placeholderTextColor={colors.textFaint}
              autoFocus
              multiline
            />

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>Date d'échéance (optionnel)</Text>
            <DateInput value={editTaskDueDate} onChange={setEditTaskDueDate} placeholder="Choisir une date" />

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>Se répète (optionnel)</Text>
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
                  selected={editTaskRecurrence === opt.value}
                  onPress={() => setEditTaskRecurrence(opt.value)}
                  size="sm"
                />
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>👤 Attribuer à</Text>
            <View style={styles.targetRow}>
              {profiles.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.avatar} ${p.name}`}
                  selected={editTaskAssignees.includes(p.name)}
                  onPress={() => setEditTaskAssignees((prev) =>
                    prev.includes(p.name) ? prev.filter((n) => n !== p.name) : [...prev, p.name]
                  )}
                  size="sm"
                />
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSub }]}>Enregistrer pour</Text>
            <View style={styles.targetRow}>
              {targetFiles.map((t) => (
                <Chip
                  key={t.value}
                  label={t.label}
                  selected={editTaskTarget === t.value}
                  onPress={() => setEditTaskTarget(t.value)}
                  size="sm"
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.errorBg }]}
              onPress={handleDeleteFromEdit}
              accessibilityLabel="Supprimer cette tâche"
              accessibilityRole="button"
            >
              <Text style={[styles.deleteButtonText, { color: colors.error }]}>Supprimer cette tâche</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Célébration journée terminée */}
      <AllDoneOverlay
        visible={showAllDone}
        taskCount={completedCount}
        childName={isChildMode ? activeProfile?.name : undefined}
        onDismiss={() => setShowAllDone(false)}
      />

      {/* Coach marks */}
      <ScreenGuide
        screenId="tasks"
        targets={[
          { ref: taskListRef, ...HELP_CONTENT.tasks[0] },
          { ref: filterRef, ...HELP_CONTENT.tasks[1] },
        ]}
      />
    </SafeAreaView>
  );
}

function getFileLabel(sourceFile: string): string {
  if (sourceFile.includes('Vacances')) return '☀️ Checklist Vacances';
  if (sourceFile.includes('Ménage')) return '🏠 Maison — Ménage hebdo';
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
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['2xl'],
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
  },
  stats: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  searchContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  searchInput: {
    borderRadius: Radius.base,
    padding: Spacing.lg,
    fontSize: FontSize.body,
  },
  filterWrapper: {
    height: 56,
  },
  filterContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
  },
  vacationBanner: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  vacationBannerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  deleteTip: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  deleteTipText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  secretMissionsSection: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
  },
  secretMissionBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  secretMissionBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  listContent: {
    padding: Spacing['2xl'],
    paddingBottom: 90,
    gap: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
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
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing['6xl'],
    gap: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing['3xl'],
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
  fabText: {
    fontSize: FontSize.icon,
    fontWeight: FontWeight.bold,
    lineHeight: 30,
  },
  modalSafe: { flex: 1 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.xs },
  modalScroll: { flex: 1 },
  modalContent: { padding: Spacing['3xl'], gap: Spacing['2xl'], paddingBottom: 40 },
  modalLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Radius['lg+'],
    fontSize: FontSize.body,
  },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  deleteButton: {
    marginTop: Spacing['2xl'],
    paddingVertical: Radius['lg+'],
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  completedSection: {
    marginTop: Spacing.xl,
    paddingBottom: 80,
  },
  toggleCompletedBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing['2xl'],
    borderRadius: Radius.base,
  },
  toggleCompletedText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
