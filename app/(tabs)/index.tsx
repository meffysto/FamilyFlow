/**
 * index.tsx — Dashboard screen
 *
 * Shows:
 * - Today's date + refresh button
 * - Today's ménage tasks (by day of week)
 * - Overdue tasks
 * - Top 5 shopping items
 * - Upcoming RDVs (7 days)
 * - Baby stock alerts
 * - Mini leaderboard
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { useGamification } from '../../hooks/useGamification';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../../components/DashboardCard';
import { TaskCard } from '../../components/TaskCard';
import { FamilyLeaderboard } from '../../components/FamilyLeaderboard';
import { RDVEditor } from '../../components/RDVEditor';
import RecipeViewer from '../../components/RecipeViewer';
import type { AppRecipe } from '../../lib/cooklang';
import { buildLeaderboard, processActiveRewards, lootProgress, calculateLevel } from '../../lib/gamification';
import { smartSortSections } from '../../lib/smart-sort';
import { computeGratitudeStreak } from './gratitude';
import { LOOT_THRESHOLD, POINTS_PER_TASK } from '../../constants/rewards';
import {
  dispatchNotification,
  buildManualContext,
} from '../../lib/notifications';
import { buildWeeklyRecapText, sendWeeklyRecap } from '../../lib/telegram';
import { Task, RDV, isBabyProfile } from '../../lib/types';
import { formatAmount, categoryDisplay, totalSpent, totalBudget } from '../../lib/budget';
import { aggregateTasksByWeek, getWeekStart } from '../../lib/stats';
import { BarChart } from '../../components/charts';
import { formatDateForDisplay, isRdvUpcoming } from '../../lib/parser';
import { DashboardPrefsModal, SectionPref } from '../../components/DashboardPrefsModal';
import { GlobalSearch } from '../../components/GlobalSearch';
import { useAI } from '../../contexts/AIContext';
import { getTheme } from '../../constants/themes';
import { categorizeIngredient } from '../../lib/cooklang';
import { generateInsights, type InsightInput } from '../../lib/insights';
import { MarkdownText } from '../../components/ui/MarkdownText';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

/** Parse "50g beurre" or "50 g de beurre" into name/qty for merge */
function parseCourseInput(text: string): { name: string; quantity: number | null } {
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:g|kg|ml|cl|dl|l|c\.\s*à\s*[sc]\.?|tasse|pincée)?\s*(?:de\s+|d')?(.+)/i);
  if (m) return { quantity: parseFloat(m[1].replace(',', '.')) || null, name: m[2].trim() };
  return { name: text.trim(), quantity: null };
}

const PREFS_KEY = 'dashboard_prefs_v1';
const SMART_SORT_KEY = 'dashboard_smart_sort';

const ALL_SECTIONS: SectionPref[] = [
  // Essentielles — toujours visibles par défaut
  { id: 'insights',   label: 'Suggestions',             emoji: '💡', visible: true,  priority: 'high' },
  { id: 'vacation',   label: 'Vacances',               emoji: '☀️', visible: true,  priority: 'high' },
  { id: 'overdue',    label: 'En retard',               emoji: '⚠️', visible: true,  priority: 'high' },
  { id: 'menage',     label: 'Ménage du jour',         emoji: '🧹', visible: true,  priority: 'high' },
  { id: 'meals',      label: 'Repas du jour',           emoji: '🍽️', visible: true,  priority: 'high' },
  // Secondaires — visibles par défaut
  { id: 'courses',    label: 'Courses',                 emoji: '🛒', visible: true,  priority: 'medium' },
  { id: 'rdvs',       label: 'Rendez-vous',             emoji: '📅', visible: true,  priority: 'medium' },
  { id: 'photos',     label: 'Photo du jour',           emoji: '📸', visible: true,  priority: 'medium' },
  { id: 'budget',     label: 'Budget',                   emoji: '💰', visible: true,  priority: 'medium' },
  // Gamification — visible par défaut
  { id: 'weeklyStats',  label: 'Stats semaine',            emoji: '📊', visible: true,  priority: 'medium' },
  { id: 'lootProgress', label: 'Progression',            emoji: '🎁', visible: true,  priority: 'medium' },
  { id: 'rewards',    label: 'Récompenses actives',     emoji: '🏆', visible: true,  priority: 'medium' },
  { id: 'defis',      label: 'Défis familiaux',         emoji: '🏅', visible: true,  priority: 'medium' },
  { id: 'gratitude',  label: 'Gratitude',               emoji: '🙏', visible: true,  priority: 'medium' },
  { id: 'wishlist',   label: 'Souhaits',                emoji: '🎁', visible: true,  priority: 'medium' },
  // Optionnelles — masquées par défaut pour les nouveaux utilisateurs
  { id: 'stock',      label: 'Stock & Fournitures',      emoji: '📦', visible: false, priority: 'low' },
  { id: 'quicknotifs',label: 'Notifications rapides',   emoji: '📤', visible: false, priority: 'low' },
  { id: 'recipes',    label: 'Idée recette',             emoji: '📖', visible: false, priority: 'low' },
  { id: 'nightMode',  label: 'Mode nuit bébé',           emoji: '🌙', visible: true,  priority: 'medium' },
  { id: 'leaderboard',label: 'Classement',              emoji: '🥇', visible: false, priority: 'low' },
  // aiAssistant retiré — intégré dans la carte Suggestions
];

/** Sections masquées pour les enfants (outils parentaux) */
const ADULT_ONLY_SECTIONS = new Set(['courses', 'budget', 'stock', 'quicknotifs', 'recipes', 'photos', 'rdvs', 'nightMode']);

/** Sections promues en haute priorité pour les enfants */
const CHILD_PROMOTED: Record<string, { visible: boolean; priority: 'high' | 'medium' | 'low' }> = {
  rewards:     { visible: true, priority: 'high' },
  leaderboard: { visible: true, priority: 'high' },
  defis:       { visible: true, priority: 'high' },
};

function getDefaultSections(role?: string): SectionPref[] {
  if (role === 'enfant' || role === 'ado') {
    return ALL_SECTIONS
      .filter((s) => !ADULT_ONLY_SECTIONS.has(s.id))
      .map((s) => CHILD_PROMOTED[s.id] ? { ...s, ...CHILD_PROMOTED[s.id] } : s);
  }
  return ALL_SECTIONS;
}

/** @deprecated alias for backward compatibility with saved prefs */
const DEFAULT_SECTIONS = ALL_SECTIONS;

export default function DashboardScreen() {
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const ai = useAI();
  const {
    isLoading,
    error,
    vaultPath,
    menageTasks,
    courses,
    stock,
    meals,
    rdvs,
    profiles,
    activeProfile,
    gamiData,
    notifPrefs,
    vault,
    tasks,
    photoDates,
    addPhoto,
    getPhotoUri,
    memories,
    updateStockQuantity,
    toggleTask,
    addRDV,
    updateRDV,
    deleteRDV,
    addCourseItem,
    mergeCourseIngredients,
    removeCourseItem,
    clearCompletedCourses,
    refresh,
    vacationTasks,
    vacationConfig,
    isVacationActive,
    refreshGamification,
    recipes,
    ageUpgrades,
    applyAgeUpgrade,
    dismissAgeUpgrade,
    convertToBorn,
    budgetEntries,
    budgetConfig,
    defis,
    checkInDefi,
    gratitudeDays,
    wishlistItems,
    journalStats,
    healthRecords,
  } = useVault();

  // Active rewards (filtered for non-expired)
  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);

  const { completeTask } = useGamification({ vault, notifPrefs });

  const [refreshing, setRefreshing] = useState(false);
  const [isSendingRecap, setIsSendingRecap] = useState(false);
  const [rdvEditorVisible, setRdvEditorVisible] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);
  const [sectionPrefs, setSectionPrefs] = useState<SectionPref[]>(() => getDefaultSections(activeProfile?.role));
  const [prefsModalVisible, setPrefsModalVisible] = useState(false);
  const [newCourseText, setNewCourseText] = useState('');
  const [dashboardRecipe, setDashboardRecipe] = useState<AppRecipe | null>(null);
  const [smartSort, setSmartSort] = useState(false); // désactivé par défaut (safe pour utilisateurs existants)
  const [searchVisible, setSearchVisible] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Mode enfant : UX simplifiée (gros boutons, vocab simple)
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  // Guide post-onboarding (affiché une seule fois après le setup)
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync('show_onboarding_guide').then((v) => {
      if (v === '1') setShowOnboardingGuide(true);
    });
  }, []);

  // Load persisted section prefs on mount (filtered by profile role)
  const roleDefaults = useMemo(() => getDefaultSections(activeProfile?.role), [activeProfile?.role]);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(PREFS_KEY),
      SecureStore.getItemAsync(SMART_SORT_KEY),
    ]).then(([raw, smartSortVal]) => {
      // Section prefs
      if (raw) {
        try {
          const saved: SectionPref[] = JSON.parse(raw);
          const validIds = new Set(roleDefaults.map((s) => s.id));
          const orderedIds = saved.map((s) => s.id).filter((id) => validIds.has(id));
          const merged: SectionPref[] = [
            ...orderedIds
              .map((id) => {
                const def = roleDefaults.find((s) => s.id === id);
                const sv = saved.find((s) => s.id === id);
                return def ? { ...def, visible: sv?.visible ?? true } : null;
              })
              .filter(Boolean) as SectionPref[],
            ...roleDefaults.filter((s) => !orderedIds.includes(s.id)),
          ];
          setSectionPrefs(merged);
        } catch { setSectionPrefs(roleDefaults); }
      } else {
        setSectionPrefs(roleDefaults);
      }
      // Smart sort toggle
      if (smartSortVal !== null) setSmartSort(smartSortVal === '1');
    });
  }, [roleDefaults]);

  const saveSectionPrefs = useCallback(async ({ sections: prefs, smartSort: newSmartSort }: { sections: SectionPref[]; smartSort: boolean }) => {
    setSectionPrefs(prefs);
    setSmartSort(newSmartSort);
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
    await SecureStore.setItemAsync(SMART_SORT_KEY, newSmartSort ? '1' : '0');
  }, []);
  // showPastRdvs removed — full RDV view is now in /(tabs)/rdv

  const today = format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr });
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const in7Days = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleSendRecap = useCallback(async () => {
    const token = await SecureStore.getItemAsync('telegram_token');
    const gpChatId = await SecureStore.getItemAsync('telegram_gp_chat_id');
    if (!token || !gpChatId) {
      Alert.alert('Configuration manquante', 'Le partage avec les grands-parents n\'est pas encore configuré. Rendez-vous dans Menu > Réglages.');
      return;
    }
    const enfantNames = profiles.filter((p) => p.role === 'enfant').map((p) => p.name);
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Envoyer le récap ?',
        `Un résumé de la semaine avec les photos des enfants va être envoyé aux grands-parents.`,
        [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Envoyer', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;

    setIsSendingRecap(true);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
    const weekMemories = memories.filter((m) => m.date >= weekAgoStr);
    const weekPhotoUris: string[] = [];
    for (const name of enfantNames) {
      const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      const dates = photoDates[id] ?? [];
      for (const d of dates) {
        if (d >= weekAgoStr) {
          const uri = getPhotoUri(name, d);
          if (uri) weekPhotoUris.push(uri);
        }
      }
    }
    const recapText = buildWeeklyRecapText({ memories: weekMemories, photoCount: weekPhotoUris.length, enfantNames });
    try {
      const ok = await sendWeeklyRecap(token.trim(), gpChatId.trim(), recapText, weekPhotoUris);
      if (ok) {
        showToast(`Récap envoyé ! ${weekMemories.length} souvenir(s) + ${weekPhotoUris.length} photo(s)`);
      } else {
        showToast("Erreur lors de l'envoi du récap", 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    }
    setIsSendingRecap(false);
  }, [memories, photoDates, profiles, getPhotoUri]);

  const handleTaskToggle = useCallback(
    async (task: Task, completed: boolean) => {
      try {
        // Optimistic toggle — updates state immediately, file write in background
        await toggleTask(task, completed);
        // Gamification (non-critical)
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
        }
      } catch (e) {
        showToast(`Impossible de modifier la tâche : ${e}`, 'error');
        // Refresh to revert optimistic update on error
        await refresh();
      }
    },
    [toggleTask, activeProfile, completeTask, refresh, refreshGamification]
  );

  const leaderboard = buildLeaderboard(profiles);
  const hasBaby = useMemo(() => profiles.some(isBabyProfile), [profiles]);
  const gratitudeStreak = useMemo(() => computeGratitudeStreak(gratitudeDays, profiles.length), [gratitudeDays, profiles.length]);

  // Custom notifications for quick-send buttons
  const customNotifs = notifPrefs.notifications.filter(
    (n) => n.isCustom && n.enabled && n.event === 'manual'
  );

  const handleSendCustomNotif = useCallback(
    async (notifId: string) => {
      const context = buildManualContext(activeProfile);
      const ok = await dispatchNotification(notifId, context, notifPrefs);
      if (ok) {
        showToast('Notification envoyée sur Telegram !');
      } else {
        showToast('Envoi impossible — vérifiez la configuration', 'error');
      }
    },
    [activeProfile, notifPrefs]
  );

  const pickPhotoForEnfant = useCallback(
    async (enfantName: string) => {
      const launchPicker = async (useCamera: boolean) => {
        try {
          if (useCamera) {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert(
                'Accès refusé',
                `L'application n'a pas accès à votre appareil photo.\n\nAllez dans Réglages > Expo Go > Appareil photo pour l'autoriser.`
              );
              return;
            }
          } else {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert(
                'Accès refusé',
                `L'application n'a pas accès à vos photos.\n\nAllez dans Réglages > Expo Go > Photos pour l'autoriser.`
              );
              return;
            }
          }

          const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: false,
          };

          const result = useCamera
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);

          if (result.canceled || !result.assets?.[0]?.uri) return;

          await addPhoto(enfantName, todayStr, result.assets[0].uri);
        } catch (e: any) {
          const msg = e?.message || String(e);
          Alert.alert('Erreur', `Impossible d'ajouter la photo pour ${enfantName}. Réessayez.`);
        }
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Annuler', '📷 Appareil photo', '🖼 Galerie'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) launchPicker(true);
            if (buttonIndex === 2) launchPicker(false);
          }
        );
      } else {
        Alert.alert('Photo du jour', 'Choisir une source', [
          { text: 'Annuler', style: 'cancel' },
          { text: '📷 Appareil photo', onPress: () => launchPicker(true) },
          { text: '🖼 Galerie', onPress: () => launchPicker(false) },
        ]);
      }
    },
    [addPhoto, todayStr]
  );

  // Overdue tasks
  const overdueTasks = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate < todayStr
  );

  // RDVs: upcoming (planifié + future, time-aware for today)
  const upcomingRdvs = rdvs.filter((r) => isRdvUpcoming(r));
  // pastRdvs/displayedRdvs removed — full RDV view is now in /(tabs)/rdv

  // Top courses — derniers ajoutés en premier
  const topCourses = courses.filter((c) => !c.completed).slice(-5).reverse();

  const pendingMenage = menageTasks.filter((t) => !t.completed);

  // Today's meals
  const todayDayName = (() => {
    const name = format(new Date(), 'EEEE', { locale: fr });
    return name.charAt(0).toUpperCase() + name.slice(1);
  })();
  const todayMeals = meals.filter((m) => m.day === todayDayName && m.text.length > 0);

  // Photo du jour status per enfant
  const enfants = profiles.filter((p) => p.role === 'enfant');
  const photoStatus = enfants.map((e) => ({
    ...e,
    hasPhoto: (photoDates[e.id] ?? []).includes(todayStr),
  }));

  // Stats semaine (mémorisé pour éviter recalcul à chaque render)
  const weeklyStatsData = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const all = [...tasks, ...menageTasks];
    const data = aggregateTasksByWeek(all, weekStart);
    const total = data.reduce((s, d) => s + d.value, 0);
    return { data, total };
  }, [tasks, menageTasks]);

  // Insights locaux (analyse déterministe du vault)
  const insights = useMemo(() => {
    const input: InsightInput = {
      tasks, menageTasks, courses, stock, meals, rdvs,
      profiles, activeProfile, defis, gratitudeDays,
      memories, vacationConfig, isVacationActive,
      gamiData, photoDates,
    };
    return generateInsights(input);
  }, [tasks, menageTasks, courses, stock, meals, rdvs, profiles, activeProfile,
    defis, gratitudeDays, memories, vacationConfig, isVacationActive, gamiData, photoDates]);

  // Tri intelligent mémorisé (évite recalcul à chaque render)
  const sortedSections = useMemo(() => {
    if (!smartSort) return sectionPrefs;
    const activeSections = new Set<string>();
    if (insights.length > 0) activeSections.add('insights');
    if (pendingMenage.length > 0) activeSections.add('menage');
    if (todayMeals.length > 0) activeSections.add('meals');
    if (topCourses.length > 0) activeSections.add('courses');
    if (upcomingRdvs.length > 0) activeSections.add('rdvs');
    if (enfants.length > 0) activeSections.add('photos');
    if (stock.length > 0) activeSections.add('stock');
    if (activeRewards.length > 0) activeSections.add('rewards');
    if (leaderboard.length > 0) activeSections.add('leaderboard');
    if (weeklyStatsData.total > 0) activeSections.add('weeklyStats');
    if (activeProfile) activeSections.add('lootProgress');
    if (recipes.length > 0) activeSections.add('recipes');
    if (customNotifs.length > 0) activeSections.add('quicknotifs');
    if (defis.some((d) => d.status === 'active')) activeSections.add('defis');
    const todayGrat = gratitudeDays.find((d) => d.date === todayStr);
    if (todayGrat && todayGrat.entries.length > 0) activeSections.add('gratitude');
    if (wishlistItems.length > 0) activeSections.add('wishlist');
    return smartSortSections(sectionPrefs, {
      hour: new Date().getHours(),
      hasBaby,
      hasOverdue: overdueTasks.length > 0,
      isVacationActive: !!isVacationActive,
      activeSections,
    });
  }, [smartSort, sectionPrefs, hasBaby, overdueTasks.length, isVacationActive,
    pendingMenage.length, todayMeals.length, topCourses.length, upcomingRdvs.length,
    enfants.length, stock.length, activeRewards.length, leaderboard.length,
    weeklyStatsData.total, activeProfile, recipes.length, customNotifs.length, defis, gratitudeDays, todayStr, wishlistItems]);

  const renderSection = (id: string): React.ReactNode => {
    switch (id) {
      case 'insights': {
        const hasInsights = insights.length > 0;
        const hasAI = ai.isConfigured;
        if (!hasInsights && !hasAI) return null;
        const topInsights = insights.slice(0, 5);
        return (
          <DashboardCard key="insights" title="Suggestions" icon="💡" count={hasInsights ? insights.length : undefined} color={primary} collapsible cardId="insights">
            {topInsights.map((insight) => {
              const priorityColor = insight.priority === 'high' ? colors.error
                : insight.priority === 'medium' ? colors.warning
                : colors.textMuted;
              return (
                <TouchableOpacity
                  key={insight.id}
                  style={[styles.insightRow, { borderLeftColor: priorityColor }]}
                  activeOpacity={insight.action?.route ? 0.7 : 1}
                  onPress={() => {
                    if (insight.action?.type === 'navigate' && insight.action.route) {
                      if (insight.action.params) {
                        router.push({ pathname: insight.action.route as any, params: insight.action.params });
                      } else {
                        router.push(insight.action.route as any);
                      }
                    } else if (insight.action?.type === 'addCourse' && insight.action.payload) {
                      const items: { text: string; section?: string }[] = insight.action.payload;
                      (async () => {
                        for (const item of items) {
                          await addCourseItem(item.text, item.section);
                        }
                        showToast(`${items.length} article${items.length > 1 ? 's' : ''} ajouté${items.length > 1 ? 's' : ''} aux courses`);
                      })();
                    }
                  }}
                >
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <View style={styles.insightContent}>
                    <Text style={[styles.insightTitle, { color: colors.text }]} numberOfLines={1}>{insight.title}</Text>
                    <Text style={[styles.insightBody, { color: colors.textSub }]} numberOfLines={2}>{insight.body}</Text>
                  </View>
                  {insight.action && (
                    <Text style={[styles.insightAction, { color: primary }]}>
                      {insight.action.type === 'addCourse' ? '+' : '›'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {hasAI && (
              <>
                {hasInsights && (
                  <View style={[styles.aiDivider, { backgroundColor: colors.separator }]} />
                )}
                {aiSuggestions ? (
                  <View style={{ gap: Spacing.md }}>
                    <MarkdownText style={{ color: colors.text }}>{aiSuggestions}</MarkdownText>
                    <TouchableOpacity
                      style={[styles.aiRefreshBtn, { borderColor: primary + '40' }]}
                      onPress={async () => {
                        setAiLoading(true);
                        const ctx = {
                          tasks, menageTasks, rdvs, stock, meals, courses,
                          memories, defis, wishlistItems, recipes, profiles, activeProfile,
                          journalStats, healthRecords,
                        };
                        const resp = await ai.getSuggestions(ctx);
                        setAiSuggestions(resp.error || resp.text);
                        setAiLoading(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.aiRefreshBtnText, { color: primary }]}>
                        {aiLoading ? '...' : '🔄 Nouvelles suggestions'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.aiRefreshBtn, { borderColor: primary + '40' }]}
                    onPress={async () => {
                      setAiLoading(true);
                      const ctx = {
                        tasks, menageTasks, rdvs, stock, meals, courses,
                        memories, defis, wishlistItems, recipes, profiles, activeProfile,
                        journalStats, healthRecords,
                      };
                      const resp = await ai.getSuggestions(ctx);
                      setAiSuggestions(resp.error || resp.text);
                      setAiLoading(false);
                    }}
                    disabled={aiLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.aiRefreshBtnText, { color: primary }]}>
                      {aiLoading ? '⏳ Analyse en cours...' : '🤖 Enrichir avec l\'IA'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </DashboardCard>
        );
      }
      case 'vacation': {
        if (!isVacationActive || !vacationConfig) return null;
        const vacCompleted = vacationTasks.filter((t) => t.completed).length;
        const vacTotal = vacationTasks.length;
        const vacIncomplete = vacationTasks.filter((t) => !t.completed).slice(0, 5);
        const now = new Date();
        const start = new Date(vacationConfig.startDate + 'T00:00:00');
        const end = new Date(vacationConfig.endDate + 'T23:59:59');
        let vacCountdown: string;
        if (now < start) {
          const days = Math.ceil((start.getTime() - now.getTime()) / 86400000);
          vacCountdown = `Départ dans ${days} jour${days > 1 ? 's' : ''}`;
        } else if (now <= end) {
          const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
          vacCountdown = days > 0 ? `Retour dans ${days} jour${days > 1 ? 's' : ''}` : 'Dernier jour !';
        } else {
          vacCountdown = 'Terminé';
        }
        const progress = vacTotal > 0 ? vacCompleted / vacTotal : 0;
        return (
          <DashboardCard key="vacation" title="Vacances" icon="☀️" color={colors.warning} onPressMore={() => router.push('/(tabs)/tasks')}>
            <Text style={[styles.vacCountdown, { color: colors.warning }]}>{vacCountdown}</Text>
            <View style={styles.vacProgressRow}>
              <View style={[styles.vacProgressBg, { backgroundColor: colors.borderLight }]}>
                <View style={[styles.vacProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.warning }]} />
              </View>
              <Text style={[styles.vacProgressText, { color: colors.textMuted }]}>{vacCompleted}/{vacTotal}</Text>
            </View>
            {vacIncomplete.map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} />
            ))}
          </DashboardCard>
        );
      }
      case 'menage':
        if (pendingMenage.length === 0) return null;
        return (
          <DashboardCard key="menage" title="Ménage du jour" icon="🧹" count={pendingMenage.length} color={colors.success} onPressMore={() => router.push('/(tabs)/tasks')}>
            {pendingMenage.slice(0, 4).map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} hideSection compact />
            ))}
          </DashboardCard>
        );

      case 'overdue':
        if (overdueTasks.length === 0) return null;
        return (
          <DashboardCard key="overdue" title="En retard" icon="⚠️" count={overdueTasks.length} color={colors.error} onPressMore={() => router.push('/(tabs)/tasks')}>
            {overdueTasks.slice(0, 3).map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} showSource />
            ))}
          </DashboardCard>
        );

      case 'meals':
        if (todayMeals.length === 0) return null;
        return (
          <DashboardCard key="meals" title="Repas du jour" icon="🍽️" count={todayMeals.length} color="#EC4899" onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'repas' } })}>
            {todayMeals.map((meal) => {
              const linkedRecipe = meal.recipeRef ? recipes.find(r => {
                const ref = r.sourceFile.replace('03 - Cuisine/Recettes/', '').replace('.cook', '');
                return ref === meal.recipeRef;
              }) : undefined;
              return (
                <TouchableOpacity
                  key={meal.id}
                  style={styles.mealRow}
                  onPress={linkedRecipe
                    ? () => setDashboardRecipe(linkedRecipe)
                    : () => router.push({ pathname: '/(tabs)/meals', params: { tab: 'repas' } })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.mealEmoji}>
                    {meal.mealType === 'Petit-déj' ? '🥐' : meal.mealType === 'Déjeuner' ? '🍽️' : '🌙'}
                  </Text>
                  <View style={styles.mealInfo}>
                    <Text style={[styles.mealType, { color: colors.textMuted }]}>{meal.mealType}</Text>
                    <Text style={[styles.mealText, { color: colors.text }]}>{meal.text}</Text>
                  </View>
                  {linkedRecipe && (
                    <Text style={{ fontSize: 14, color: primary }}>📖</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </DashboardCard>
        );

      case 'photos':
        if (enfants.length === 0) return null;
        return (
          <DashboardCard key="photos" title="Photo du jour" icon="📸" color="#06B6D4" onPressMore={() => router.push('/(tabs)/photos')}>
            {photoStatus.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.photoStatusRow}
                onPress={() => { if (!e.hasPhoto) { pickPhotoForEnfant(e.name); } else { router.push('/(tabs)/photos'); } }}
                activeOpacity={0.7}
              >
                <Text style={styles.photoStatusEmoji}>{e.avatar}</Text>
                <View style={styles.photoStatusInfo}>
                  <Text style={[styles.photoStatusName, { color: colors.text }]}>{e.name}</Text>
                  {!e.hasPhoto && <Text style={[styles.photoStatusHint, { color: colors.textMuted }]}>Appuyer pour ajouter une photo</Text>}
                </View>
                <Text style={styles.photoStatusIcon}>{e.hasPhoto ? '✅' : '📷'}</Text>
              </TouchableOpacity>
            ))}
          </DashboardCard>
        );

      case 'courses':
        return (
          <DashboardCard key="courses" title="Courses" icon="🛒" count={topCourses.length || undefined} color={colors.warning} onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'courses' } })}>
            {topCourses.map((item) => (
              <View key={item.id} style={styles.courseRow}>
                <Text style={[styles.courseBullet, { color: colors.warning }]}>•</Text>
                <Text style={[styles.courseText, { color: colors.textSub }]}>{item.text}</Text>
                <TouchableOpacity
                  style={[styles.courseCheckBtn, { borderColor: colors.separator, backgroundColor: colors.card }]}
                  onPress={async () => {
                    const itemTextLower = item.text.toLowerCase();
                    const stockMatch = stock.find((s) => itemTextLower.includes(s.produit.toLowerCase()));
                    const addQty = stockMatch?.qteAchat ?? 1;
                    const prevQty = stockMatch?.quantite ?? 0;
                    await removeCourseItem(item.lineIndex);
                    if (stockMatch) {
                      await updateStockQuantity(stockMatch.lineIndex, prevQty + addQty);
                    }
                    const msg = stockMatch ? `${stockMatch.produit} restocké (+${addQty})` : `${item.text} retiré`;
                    showToast(msg, 'success', {
                      label: 'Annuler',
                      onPress: async () => {
                        try {
                          await addCourseItem(item.text, item.section);
                          if (stockMatch) await updateStockQuantity(stockMatch.lineIndex, prevQty);
                        } catch { /* best effort */ }
                      },
                    });
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.courseCheckBtnText, { color: colors.success }]}>✓</Text>
                </TouchableOpacity>
              </View>
            ))}
            {topCourses.length === 0 && (
              <Text style={[styles.courseEmpty, { color: colors.textFaint }]}>Liste vide — ajoutez un article ci-dessous</Text>
            )}
            {/* Champ d'ajout rapide */}
            <View style={[styles.courseAddRow, { borderTopColor: colors.borderLight }]}>
              <TextInput
                style={[styles.courseAddInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={newCourseText}
                onChangeText={setNewCourseText}
                placeholder="Ajouter un article…"
                placeholderTextColor={colors.textFaint}
                returnKeyType="done"
                onSubmitEditing={async () => {
                  const text = newCourseText.trim();
                  if (!text) return;
                  setNewCourseText('');
                  const parsed = parseCourseInput(text);
                  await mergeCourseIngredients([{ text, name: parsed.name, quantity: parsed.quantity, section: categorizeIngredient(parsed.name) }]);
                }}
              />
              <TouchableOpacity
                style={[styles.courseAddBtn, { backgroundColor: colors.warning }]}
                onPress={async () => {
                  const text = newCourseText.trim();
                  if (!text) return;
                  setNewCourseText('');
                  const parsed = parseCourseInput(text);
                  await mergeCourseIngredients([{ text, name: parsed.name, quantity: parsed.quantity, section: categorizeIngredient(parsed.name) }]);
                }}
                activeOpacity={0.7}
                disabled={!newCourseText.trim()}
              >
                <Text style={[styles.courseAddBtnText, { color: colors.onPrimary }]}>+</Text>
              </TouchableOpacity>
            </View>
            {courses.some((c) => c.completed) && (
              <TouchableOpacity
                style={[styles.clearCoursesBtn, { backgroundColor: colors.errorBg }]}
                onPress={() => {
                  const count = courses.filter((c) => c.completed).length;
                  Alert.alert('Vider les cochés', `Supprimer ${count} article${count > 1 ? 's' : ''} coché${count > 1 ? 's' : ''} ?`, [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: clearCompletedCourses },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.clearCoursesBtnText, { color: colors.error }]}>🗑 Vider les cochés</Text>
              </TouchableOpacity>
            )}
          </DashboardCard>
        );

      case 'rdvs':
        if (upcomingRdvs.length === 0) return null;
        return (
          <DashboardCard key="rdvs" title="Rendez-vous" icon="📅" count={upcomingRdvs.length} color={colors.info}>
            {upcomingRdvs.slice(0, 3).map((rdv) => (
              <TouchableOpacity key={rdv.sourceFile} style={[styles.rdvRow, { borderLeftColor: colors.info }]} onPress={() => { setEditingRDV(rdv); setRdvEditorVisible(true); }} activeOpacity={0.7}>
                <Text style={[styles.rdvDate, { color: colors.info }]}>{formatDateForDisplay(rdv.date_rdv)} {rdv.heure ? `à ${rdv.heure}` : ''}</Text>
                <Text style={[styles.rdvTitle, { color: colors.text }]}>{rdv.type_rdv} — {rdv.enfant}</Text>
                {rdv.médecin && <Text style={[styles.rdvMeta, { color: colors.textMuted }]}>{rdv.médecin}</Text>}
              </TouchableOpacity>
            ))}
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => router.push('/(tabs)/rdv')} activeOpacity={0.7}>
                <Text style={[styles.seeAllText, { color: primary }]}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
          </DashboardCard>
        );

      case 'lootProgress': {
        if (!activeProfile) return null;
        const loot = lootProgress(activeProfile);
        const hasBoxes = (activeProfile.lootBoxesAvailable ?? 0) > 0;
        const level = calculateLevel(activeProfile.points ?? 0);
        return (
          <DashboardCard key="lootProgress" title={isChildMode ? 'Tes points !' : 'Progression'} icon="🎁" color={primary}>
            {/* Barre de progression vers prochaine loot box */}
            <View style={styles.lootProgressRow}>
              <Text style={[isChildMode ? styles.lootProgressLabelChild : styles.lootProgressLabel, { color: colors.text }]}>
                {isChildMode
                  ? `${activeProfile.avatar} Niveau ${level} !`
                  : `Nv. ${level} — ${activeProfile.avatar} ${activeProfile.name}`}
              </Text>
              <Text style={[styles.lootProgressPts, { color: colors.textMuted }]}>
                {loot.current}/{loot.threshold} pts
              </Text>
            </View>
            <View style={[isChildMode ? styles.lootProgressBarChild : styles.lootProgressBar, { backgroundColor: colors.cardAlt }]}>
              <View style={[isChildMode ? styles.lootProgressFillChild : styles.lootProgressFill, { width: `${Math.round(loot.progress * 100)}%`, backgroundColor: primary }]} />
            </View>
            {hasBoxes && (
              <TouchableOpacity
                style={[isChildMode ? styles.lootCTAChild : styles.lootCTA, { backgroundColor: tint, borderColor: primary }]}
                onPress={() => router.push('/(tabs)/loot')}
                activeOpacity={0.7}
                accessibilityLabel="Ouvrir les loot boxes"
                accessibilityRole="button"
              >
                <Text style={[isChildMode ? styles.lootCTATextChild : styles.lootCTAText, { color: primary }]}>
                  {isChildMode
                    ? `🎁 Ouvre ton cadeau ! (${activeProfile.lootBoxesAvailable})`
                    : `🎁 Ouvre ta récompense ! (${activeProfile.lootBoxesAvailable} dispo)`}
                </Text>
              </TouchableOpacity>
            )}
            {!hasBoxes && (() => {
              const remaining = Math.max(0, loot.threshold - loot.current);
              const tasksLeft = Math.ceil(remaining / POINTS_PER_TASK);
              return (
                <Text style={[styles.lootHint, { color: colors.textFaint }]}>
                  {isChildMode
                    ? tasksLeft <= 3
                      ? `Presque ! Plus que ${tasksLeft} tâche${tasksLeft > 1 ? 's' : ''} ! 🔥`
                      : `Encore ~${tasksLeft} tâches avant ton cadeau ! 💪`
                    : tasksLeft <= 3
                      ? `Plus que ${tasksLeft} tâche${tasksLeft > 1 ? 's' : ''} avant la loot box ! 🔥`
                      : `~${tasksLeft} tâches avant la prochaine loot box`}
                </Text>
              );
            })()}
          </DashboardCard>
        );
      }

      case 'rewards':
        if (activeRewards.length === 0) return null;
        return (
          <DashboardCard key="rewards" title="Récompenses actives" icon="🏆" color={colors.error}>
            {activeRewards.map((reward) => {
              const ownerProfile = profiles.find((p) => p.id === reward.profileId);
              const typeColor = reward.type === 'vacation' || reward.type === 'crown' || reward.type === 'multiplier' ? colors.error : colors.warning;
              return (
                <View key={reward.id} style={styles.activeRewardRow}>
                  <Text style={styles.activeRewardEmoji}>{reward.emoji}</Text>
                  <View style={styles.activeRewardInfo}>
                    <Text style={[styles.activeRewardLabel, { color: colors.text }]}>{ownerProfile?.avatar ?? '👤'} {ownerProfile?.name ?? reward.profileId} — {reward.label}</Text>
                    <Text style={[styles.activeRewardMeta, { color: typeColor }]}>
                      {reward.remainingDays !== undefined && `${reward.remainingDays}j restant${reward.remainingDays > 1 ? 's' : ''}`}
                      {reward.remainingTasks !== undefined && `${reward.remainingTasks} tâche${reward.remainingTasks > 1 ? 's' : ''} restante${reward.remainingTasks > 1 ? 's' : ''}`}
                      {reward.expiresAt && !reward.remainingDays && !reward.remainingTasks && `expire ${reward.expiresAt}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </DashboardCard>
        );

      case 'stock': {
        if (stock.length === 0) return null;
        const lowCount = stock.filter((s) => s.quantite <= s.seuil).length;
        return (
          <DashboardCard key="stock" title="Stock & Fournitures" icon="📦" count={lowCount > 0 ? lowCount : undefined} color={lowCount > 0 ? colors.error : colors.success} collapsible cardId="stock">
            {stock.filter((s) => s.quantite <= s.seuil + 1).map((item) => {
              const isLow = item.quantite <= item.seuil;
              const statusColor = isLow ? colors.error : colors.warning;
              return (
                <View key={`${item.section}-${item.produit}`} style={styles.stockRow}>
                  <Text style={styles.stockAlertIcon}>{isLow ? '🔴' : '🟡'}</Text>
                  <View style={styles.stockInfo}>
                    <Text style={[styles.stockName, { color: colors.text }]}>{item.produit}{item.detail ? ` (${item.detail})` : ''}</Text>
                    <Text style={[styles.stockMeta, { color: statusColor }]}>{item.quantite} restant{item.quantite > 1 ? 's' : ''} (seuil: {item.seuil})</Text>
                  </View>
                  <View style={styles.stockBtnGroup}>
                    {isLow && (
                      <TouchableOpacity style={[styles.stockCartBtn, { backgroundColor: colors.warningBg, borderColor: colors.warning }]} onPress={async () => { const n = item.detail ? `${item.produit} (${item.detail})` : item.produit; await addCourseItem(n, 'Produits bébé'); Alert.alert('Ajouté !', `${n} ajouté aux courses`); }} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Text style={styles.stockCartBtnText}>🛒</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.stockBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }, item.quantite <= 0 && styles.stockBtnDisabled]} onPress={() => updateStockQuantity(item.lineIndex, Math.max(0, item.quantite - 1))} activeOpacity={0.6} disabled={item.quantite <= 0} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Text style={[styles.stockBtnText, { color: colors.textSub }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stockQty, { color: colors.text }]}>{item.quantite}</Text>
                    <TouchableOpacity style={[styles.stockBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]} onPress={() => updateStockQuantity(item.lineIndex, item.quantite + 1)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Text style={[styles.stockBtnText, { color: colors.textSub }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <TouchableOpacity style={styles.seeAllLink} onPress={() => router.push('/(tabs)/stock')} activeOpacity={0.7}>
              <Text style={[styles.seeAllText, { color: primary }]}>Gérer le stock →</Text>
            </TouchableOpacity>
          </DashboardCard>
        );
      }

      case 'weeklyStats': {
        const { data: weekData, total: weekTotal } = weeklyStatsData;
        if (weekTotal === 0) return null;
        return (
          <DashboardCard
            key="weeklyStats"
            title="Stats semaine"
            icon="📊"
            count={weekTotal}
            color={primary}
            onPressMore={() => router.push('/(tabs)/stats')}
          >
            <BarChart data={weekData} compact showValues={false} barColor={primary} />
            <Text style={[styles.weekStatsSummary, { color: colors.textMuted }]}>
              {weekTotal} tâche{weekTotal !== 1 ? 's' : ''} cette semaine
            </Text>
          </DashboardCard>
        );
      }

      case 'budget': {
        const budgetSpent = totalSpent(budgetEntries);
        const budgetTotal = totalBudget(budgetConfig);
        // Single-pass: build spent-by-category map
        const spentMap = new Map<string, number>();
        for (const e of budgetEntries) {
          spentMap.set(e.category, (spentMap.get(e.category) ?? 0) + e.amount);
        }
        const catStats = budgetConfig.categories
          .map((c) => ({ ...c, spent: spentMap.get(categoryDisplay(c)) ?? 0 }));
        const overCount = catStats.filter((c) => c.spent > c.limit).length;
        const topCats = catStats.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 2);

        return (
          <DashboardCard
            key="budget"
            title="Budget du mois"
            icon="💰"
            count={overCount > 0 ? overCount : undefined}
            color={overCount > 0 ? colors.error : colors.success}
            onPressMore={() => router.push('/(tabs)/budget')}
          >
            <Text style={[styles.budgetTotal, { color: budgetSpent > budgetTotal ? colors.error : colors.text }]}>
              {formatAmount(budgetSpent)} / {formatAmount(budgetTotal)}
            </Text>
            {topCats.map((c) => (
              <View key={c.name} style={styles.budgetCatRow}>
                <Text style={[styles.budgetCatName, { color: colors.textSub }]}>{c.emoji} {c.name}</Text>
                <Text style={[styles.budgetCatAmount, { color: c.spent > c.limit ? colors.error : colors.textMuted }]}>
                  {formatAmount(c.spent)}
                </Text>
              </View>
            ))}
          </DashboardCard>
        );
      }

      case 'quicknotifs':
        if (customNotifs.length === 0) return null;
        return (
          <DashboardCard key="quicknotifs" title="Notifications rapides" icon="📤" color={colors.success}>
            <View style={styles.quickNotifGrid}>
              {customNotifs.map((notif) => (
                <TouchableOpacity key={notif.id} style={[styles.quickNotifBtn, { backgroundColor: colors.successBg, borderColor: colors.success }]} onPress={() => handleSendCustomNotif(notif.id)}>
                  <Text style={styles.quickNotifEmoji}>{notif.emoji}</Text>
                  <Text style={[styles.quickNotifLabel, { color: colors.successText }]}>{notif.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </DashboardCard>
        );

      case 'recipes': {
        if (recipes.length === 0) return null;
        // Pick a random recipe suggestion based on today's date (stable per day)
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const suggestedRecipe = recipes[dayOfYear % recipes.length];
        return (
          <DashboardCard key="recipes" title="Idée recette" icon="📖" count={recipes.length} color={colors.info} onPressMore={() => router.push('/(tabs)/meals')}>
            <TouchableOpacity
              style={[styles.recipeSuggestion, { backgroundColor: colors.cardAlt }]}
              onPress={() => router.push('/(tabs)/meals')}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.recipeSuggestionTitle, { color: colors.text }]} numberOfLines={1}>
                  {suggestedRecipe.title}
                </Text>
                <Text style={[styles.recipeSuggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {suggestedRecipe.category}
                  {suggestedRecipe.servings > 0 ? ` · ${suggestedRecipe.servings} pers.` : ''}
                  {suggestedRecipe.prepTime ? ` · ${suggestedRecipe.prepTime}` : ''}
                </Text>
                {suggestedRecipe.ingredients.length > 0 && (
                  <Text style={[styles.recipeSuggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    🥕 {suggestedRecipe.ingredients.length} ingrédient{suggestedRecipe.ingredients.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 24 }}>🎲</Text>
            </TouchableOpacity>
          </DashboardCard>
        );
      }

      case 'nightMode': {
        if (!hasBaby) return null;
        const hour = new Date().getHours();
        const isNightTime = hour >= 20 || hour < 8;
        if (!isNightTime) return null;
        return (
          <DashboardCard key="nightMode" title="Mode nuit bébé" icon="🌙" color="#B8860B" onPressMore={() => router.push('/(tabs)/night-mode')}>
            <TouchableOpacity
              style={[styles.nightModeBtn, { backgroundColor: colors.cardAlt }]}
              onPress={() => router.push('/(tabs)/night-mode')}
              activeOpacity={0.7}
            >
              <Text style={[styles.nightModeBtnTitle, { color: colors.text }]}>🌙 Ouvrir le mode nuit</Text>
              <Text style={[styles.nightModeBtnSub, { color: colors.textMuted }]}>Écran sombre pour les tétées nocturnes</Text>
            </TouchableOpacity>
          </DashboardCard>
        );
      }

      case 'leaderboard':
        if (leaderboard.length === 0) return null;
        return (
          <DashboardCard key="leaderboard" title="Classement" icon="🏆" color={primary} onPressMore={() => router.push('/(tabs)/loot')}>
            <FamilyLeaderboard profiles={leaderboard} compact gamiHistory={gamiData?.history} />
          </DashboardCard>
        );

      case 'defis': {
        const activeDefis = defis.filter((d) => d.status === 'active');
        if (activeDefis.length === 0) return null;
        const mainDefi = activeDefis[0];
        const uniqueDays = new Set(mainDefi.progress.filter((p) => p.completed).map((p) => p.date)).size;
        const progress = mainDefi.targetDays > 0 ? uniqueDays / mainDefi.targetDays : 0;
        const todayStr2 = new Date().toISOString().slice(0, 10);
        const todayDone = activeProfile ? mainDefi.progress.some((p) => p.date === todayStr2 && p.profileId === activeProfile.id && p.completed) : false;
        return (
          <DashboardCard key="defis" title="Défis familiaux" icon="🏅" count={activeDefis.length} color="#F59E0B" onPressMore={() => router.push('/(tabs)/defis')}>
            <View style={styles.defiRow}>
              <Text style={styles.defiEmoji}>{mainDefi.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.defiTitle, { color: colors.text }]} numberOfLines={1}>{mainDefi.title}</Text>
                <View style={[styles.defiProgressBg, { backgroundColor: colors.cardAlt }]}>
                  <View style={[styles.defiProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: '#F59E0B' }]} />
                </View>
                <Text style={[styles.defiMeta, { color: colors.textMuted }]}>{uniqueDays}/{mainDefi.targetDays} jours</Text>
              </View>
              {!todayDone && activeProfile && (
                <TouchableOpacity
                  style={[styles.defiCheckBtn, { backgroundColor: '#F59E0B' }]}
                  onPress={async () => {
                    await checkInDefi(mainDefi.id, activeProfile.id, true);
                    showToast(`Check-in ${mainDefi.emoji} ${mainDefi.title}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.defiCheckText, { color: colors.onPrimary }]}>✓</Text>
                </TouchableOpacity>
              )}
              {todayDone && <Text style={{ color: colors.success, fontSize: 18 }}>✅</Text>}
            </View>
            {activeDefis.length > 1 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/defis')} activeOpacity={0.7}>
                <Text style={[styles.seeAllText, { color: primary }]}>+{activeDefis.length - 1} autre{activeDefis.length > 2 ? 's' : ''} →</Text>
              </TouchableOpacity>
            )}
          </DashboardCard>
        );
      }

      case 'gratitude': {
        const todayGrat = gratitudeDays.find((d) => d.date === todayStr);
        const todayCount = todayGrat?.entries.length ?? 0;
        return (
          <DashboardCard key="gratitude" title="Gratitude" icon="🙏" color={colors.info} onPressMore={() => router.push('/(tabs)/gratitude')}>
            <Text style={[styles.defiMeta, { color: colors.textSub }]}>
              {todayCount}/{profiles.length} aujourd'hui
              {gratitudeStreak > 0 ? ` · ${gratitudeStreak}j 🔥` : ''}
            </Text>
          </DashboardCard>
        );
      }

      case 'wishlist': {
        const unbought = wishlistItems.filter((w) => !w.bought).length;
        return (
          <DashboardCard key="wishlist" title="Souhaits" icon="🎁" color="#E11D48" onPressMore={() => router.push('/(tabs)/wishlist' as any)}>
            <Text style={[styles.defiMeta, { color: colors.textSub }]}>
              {unbought} idée{unbought !== 1 ? 's' : ''} cadeau
            </Text>
          </DashboardCard>
        );
      }

      // aiAssistant retiré — intégré dans insights ci-dessus

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.separator }]}>
        <View style={styles.headerLeft}>
          <Text style={[
            isChildMode ? styles.greetingChild : styles.greeting,
            { color: colors.textSub },
          ]}>
            {isChildMode
              ? `Salut ${activeProfile?.name ?? ''} ! 🌟`
              : (() => {
                  const h = new Date().getHours();
                  const name = activeProfile?.name ?? '';
                  if (h < 6) return `Bonne nuit${name ? ` ${name}` : ''} 🌙`;
                  if (h < 12) return `Bon matin${name ? ` ${name}` : ''} ☀️`;
                  if (h < 18) return `Bon après-midi${name ? ` ${name}` : ''} 🌤️`;
                  return `Bonsoir${name ? ` ${name}` : ''} 🌙`;
                })()}
          </Text>
          <Text style={[styles.dateText, { color: colors.text }]}>{today}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setSearchVisible(true)}
            style={[styles.headerBtn, { backgroundColor: colors.cardAlt }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Rechercher dans le vault"
            accessibilityRole="search"
          >
            <Text style={styles.headerBtnIcon}>🔍</Text>
            <Text style={[styles.headerBtnLabel, { color: colors.textMuted }]}>Chercher</Text>
          </TouchableOpacity>
          {!isChildMode && (
            <TouchableOpacity
              onPress={handleSendRecap}
              style={[styles.headerBtn, { backgroundColor: colors.cardAlt }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isSendingRecap}
              accessibilityLabel="Envoyer le récap aux grands-parents"
              accessibilityRole="button"
            >
              <Text style={styles.headerBtnIcon}>{isSendingRecap ? '⏳' : '📤'}</Text>
              <Text style={[styles.headerBtnLabel, { color: colors.textMuted }]}>Récap GP</Text>
            </TouchableOpacity>
          )}
          {!isChildMode && (
            <TouchableOpacity
              onPress={() => setPrefsModalVisible(true)}
              style={[styles.headerBtn, { backgroundColor: colors.cardAlt }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Configurer les sections"
              accessibilityRole="button"
            >
              <Text style={styles.headerBtnIcon}>⚙️</Text>
              <Text style={[styles.headerBtnLabel, { color: colors.textMuted }]}>Sections</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Welcome card when no vault configured */}
        {!isLoading && !vaultPath && (
          <DashboardCard title="Bienvenue !" icon="👋" color={primary}>
            <Text style={[styles.welcomeText, { color: colors.textSub }]}>
              L'application n'est pas encore configurée.
            </Text>
            <Text style={[styles.welcomeSubText, { color: colors.textMuted }]}>
              Appuyez sur le bouton ci-dessous pour accéder aux réglages et connecter votre espace familial.
            </Text>
            <TouchableOpacity
              style={[styles.welcomeBtn, { backgroundColor: primary }]}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.8}
            >
              <Text style={[styles.welcomeBtnText, { color: colors.onPrimary }]}>⚙️  Ouvrir les réglages</Text>
            </TouchableOpacity>
          </DashboardCard>
        )}

        {/* Guide post-setup — affiché une seule fois */}
        {showOnboardingGuide && vaultPath && (
          <DashboardCard title="Premiers pas" icon="🚀" color={primary}>
            <Text style={[styles.welcomeText, { color: colors.textSub }]}>
              Votre espace familial est prêt ! Voici comment démarrer :
            </Text>
            <View style={styles.onboardingSteps}>
              <TouchableOpacity
                style={[styles.onboardingStep, { backgroundColor: colors.cardAlt }]}
                onPress={() => router.push('/tasks?addNew=1')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Créer ma première tâche"
              >
                <Text style={styles.onboardingStepEmoji}>📋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.onboardingStepTitle, { color: colors.text }]}>Créer une tâche</Text>
                  <Text style={[styles.onboardingStepDesc, { color: colors.textMuted }]}>Ajoutez votre première tâche familiale</Text>
                </View>
                <Text style={{ color: primary }}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.onboardingStep, { backgroundColor: colors.cardAlt }]}
                onPress={() => router.push('/rdv?addNew=1')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Ajouter un rendez-vous"
              >
                <Text style={styles.onboardingStepEmoji}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.onboardingStepTitle, { color: colors.text }]}>Ajouter un RDV</Text>
                  <Text style={[styles.onboardingStepDesc, { color: colors.textMuted }]}>Planifiez un rendez-vous médical</Text>
                </View>
                <Text style={{ color: primary }}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.onboardingStep, { backgroundColor: colors.cardAlt }]}
                onPress={() => router.push('/(tabs)/settings')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Configurer Telegram"
              >
                <Text style={styles.onboardingStepEmoji}>📱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.onboardingStepTitle, { color: colors.text }]}>Configurer Telegram</Text>
                  <Text style={[styles.onboardingStepDesc, { color: colors.textMuted }]}>Recevez les notifications de la famille</Text>
                </View>
                <Text style={{ color: primary }}>→</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.onboardingDismiss, { backgroundColor: tint }]}
              onPress={async () => {
                setShowOnboardingGuide(false);
                await SecureStore.deleteItemAsync('show_onboarding_guide');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Masquer le guide"
            >
              <Text style={[styles.onboardingDismissText, { color: primary }]}>J'ai compris, merci !</Text>
            </TouchableOpacity>
          </DashboardCard>
        )}

        {profiles.filter((p) => p.statut === 'grossesse' && p.dateTerme).map((p) => {
          const daysLeft = Math.ceil((new Date(p.dateTerme!).getTime() - new Date().getTime()) / 86400000);
          return (
            <View key={p.id} style={[styles.ageUpgradeBanner, { backgroundColor: colors.warningBg, borderColor: primary }]}>
              <Text style={[styles.ageUpgradeTitle, { color: colors.text }]}>
                🤰 {p.name} — {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? "C'est pour aujourd'hui !" : `J+${Math.abs(daysLeft)}`}
              </Text>
              <Text style={[styles.ageUpgradeDesc, { color: colors.textSub }]}>
                Terme prévu le {p.dateTerme}
              </Text>
              <TouchableOpacity
                style={[styles.ageUpgradeBtn, { backgroundColor: primary }]}
                onPress={() => {
                  Alert.prompt
                    ? Alert.prompt('Date de naissance', 'AAAA-MM-JJ', (date) => {
                        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) convertToBorn(p.id, date);
                      }, 'plain-text', format(new Date(), 'yyyy-MM-dd'))
                    : Alert.alert('Bébé est né ?', 'Allez dans Réglages > Profils pour confirmer la naissance.');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.ageUpgradeBtnText, { color: colors.onPrimary }]}>C'est né !</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {ageUpgrades.map((upgrade) => {
          const catLabels: Record<string, string> = { bebe: 'bébé', petit: 'petit enfant', enfant: 'enfant', ado: 'ado' };
          return (
            <View key={upgrade.profileId} style={[styles.ageUpgradeBanner, { backgroundColor: colors.warningBg, borderColor: primary }]}>
              <Text style={[styles.ageUpgradeTitle, { color: colors.text }]}>
                {upgrade.childName} a grandi !
              </Text>
              <Text style={[styles.ageUpgradeDesc, { color: colors.textSub }]}>
                Profil « {catLabels[upgrade.oldCategory]} » → « {catLabels[upgrade.newCategory]} ». Mettre à jour les tâches ?
              </Text>
              <View style={styles.ageUpgradeActions}>
                <TouchableOpacity
                  style={[styles.ageUpgradeBtn, { backgroundColor: primary }]}
                  onPress={() => {
                    Alert.alert(
                      'Mettre à jour les tâches ?',
                      `Les tâches actuelles de ${upgrade.childName} seront remplacées par des tâches adaptées à un profil « ${catLabels[upgrade.newCategory]} ».`,
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Mettre à jour', onPress: () => applyAgeUpgrade(upgrade) },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.ageUpgradeBtnText, { color: colors.onPrimary }]}>Mettre à jour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ageUpgradeDismiss}
                  onPress={() => dismissAgeUpgrade(upgrade.profileId)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.ageUpgradeDismissText, { color: colors.textMuted }]}>Plus tard</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {sortedSections.map((s) => s.visible ? renderSection(s.id) : null)}

        <View style={styles.bottomPad} />
      </ScrollView>
      {/* Dashboard prefs modal */}
      <Modal
        visible={prefsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrefsModalVisible(false)}
      >
        <DashboardPrefsModal
          sections={sectionPrefs}
          smartSort={smartSort}
          onSave={saveSectionPrefs}
          onClose={() => setPrefsModalVisible(false)}
        />
      </Modal>

      {/* RDV Editor Modal */}
      <Modal
        visible={rdvEditorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setRdvEditorVisible(false);
          setEditingRDV(undefined);
        }}
      >
        <RDVEditor
          rdv={editingRDV}
          onSave={async (data) => {
            if (editingRDV) {
              await updateRDV(editingRDV.sourceFile, data);
            } else {
              await addRDV(data);
            }
            // addRDV/updateRDV handle optimistic state update internally
            // No extra refresh() — it would race and overwrite the optimistic update
          }}
          onDelete={
            editingRDV
              ? () => {
                  deleteRDV(editingRDV.sourceFile);
                  setRdvEditorVisible(false);
                  setEditingRDV(undefined);
                }
              : undefined
          }
          onClose={() => {
            setRdvEditorVisible(false);
            setEditingRDV(undefined);
          }}
        />
      </Modal>

      {/* Recipe viewer from dashboard */}
      {dashboardRecipe && (
        <RecipeViewer
          recipe={dashboardRecipe}
          onClose={() => setDashboardRecipe(null)}
          familySize={profiles.length}
        />
      )}

      {/* Recherche globale */}
      <GlobalSearch visible={searchVisible} onClose={() => setSearchVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    borderRadius: 12,
  },
  headerBtnIcon: {
    fontSize: 22,
  },
  headerBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 12,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  courseBullet: {
    fontSize: 16,
  },
  courseText: {
    fontSize: 15,
    flex: 1,
  },
  rdvRow: {
    paddingVertical: 8,
    borderLeftWidth: 3,
    paddingLeft: 10,
    gap: 2,
  },
  rdvDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  rdvTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rdvMeta: {
    fontSize: 13,
  },
  rdvEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  rdvAddBtn: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  rdvAddBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  stockAlertIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  stockInfo: {
    flex: 1,
    gap: 1,
  },
  stockName: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockCartBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 4,
  },
  stockCartBtnText: {
    fontSize: 14,
  },
  stockBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  stockBtnDisabled: {
    opacity: 0.3,
  },
  stockBtnText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  stockQty: {
    fontSize: 17,
    fontWeight: '800',
    minWidth: 26,
    textAlign: 'center',
  },
  courseCheckBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseCheckBtnText: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  courseEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  courseAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  courseAddInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  courseAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseAddBtnText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  clearCoursesBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  clearCoursesBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 6,
  },
  welcomeSubText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  onboardingSteps: { gap: 10, marginTop: 8 },
  onboardingStep: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12 },
  onboardingStepEmoji: { fontSize: 24 },
  onboardingStepTitle: { fontSize: 15, fontWeight: '700' },
  onboardingStepDesc: { fontSize: 13 },
  onboardingDismiss: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  onboardingDismissText: { fontSize: 14, fontWeight: '700' },
  welcomeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  welcomeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  lootProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lootProgressLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  lootProgressPts: {
    fontSize: 13,
    fontWeight: '600',
  },
  lootProgressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  lootProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  lootCTA: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 4,
  },
  lootCTAText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Styles enfant — plus gros, plus lisibles
  greetingChild: {
    fontSize: 20,
    fontWeight: '800',
  },
  lootProgressLabelChild: {
    fontSize: 18,
    fontWeight: '800',
  },
  lootProgressBarChild: {
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  lootProgressFillChild: {
    height: '100%',
    borderRadius: 8,
  },
  lootCTAChild: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  lootCTATextChild: {
    fontSize: 18,
    fontWeight: '800',
  },
  lootHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  activeRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  activeRewardEmoji: {
    fontSize: 28,
  },
  activeRewardInfo: {
    flex: 1,
    gap: 2,
  },
  activeRewardLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  activeRewardMeta: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickNotifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
  },
  quickNotifEmoji: { fontSize: 18 },
  quickNotifLabel: { fontSize: 14, fontWeight: '600' },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  mealEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  mealInfo: {
    flex: 1,
    gap: 1,
  },
  mealType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  mealText: {
    fontSize: 15,
    fontWeight: '500',
  },
  photoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  photoStatusEmoji: {
    fontSize: 20,
  },
  photoStatusInfo: {
    flex: 1,
    gap: 1,
  },
  photoStatusName: {
    fontSize: 15,
    fontWeight: '600',
  },
  photoStatusHint: {
    fontSize: 13,
  },
  photoStatusIcon: {
    fontSize: 20,
  },
  vacCountdown: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  vacProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  vacProgressBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  vacProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  vacProgressText: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekStatsSummary: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  nightModeBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center' as const,
  },
  nightModeBtnTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  nightModeBtnSub: {
    fontSize: 13,
    marginTop: 4,
  },
  bottomPad: {
    height: 20,
  },
  ageUpgradeBanner: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  ageUpgradeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  ageUpgradeDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  ageUpgradeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  ageUpgradeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  ageUpgradeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  ageUpgradeDismiss: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ageUpgradeDismissText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  seeAllLink: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  recipeSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  recipeSuggestionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  recipeSuggestionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  budgetTotal: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  budgetCatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  budgetCatName: {
    fontSize: 14,
  },
  budgetCatAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  defiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defiEmoji: {
    fontSize: 28,
  },
  defiTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  defiProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  defiProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  defiMeta: {
    fontSize: 12,
  },
  defiCheckBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defiCheckText: {
    fontSize: 16,
    fontWeight: '800',
  },
  // Insights
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 6,
    borderRadius: 4,
  },
  insightIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  insightBody: {
    fontSize: 12,
    marginTop: 2,
  },
  insightAction: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  aiDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xl,
  },
  aiRefreshBtn: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.base,
    borderWidth: 1,
    alignItems: 'center' as const,
    marginTop: Spacing.xs,
  },
  aiRefreshBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
