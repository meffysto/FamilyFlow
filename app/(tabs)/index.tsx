/**
 * index.tsx — Dashboard screen
 *
 * Orchestrateur : header, scroll, préférences sections, modals.
 * Chaque section est rendue par un composant dédié dans components/dashboard/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { useGamification } from '../../hooks/useGamification';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { LivingGradient } from '../../components/ui/LivingGradient';
import { ReactiveAvatar, getAvatarMood } from '../../components/ui/ReactiveAvatar';
import { SeasonalParticles } from '../../components/ui/SeasonalParticles';
import { DashboardCard } from '../../components/DashboardCard';
import { RDVEditor } from '../../components/RDVEditor';
import RecipeViewer from '../../components/RecipeViewer';
import type { AppRecipe } from '../../lib/cooklang';
import { buildLeaderboard, processActiveRewards } from '../../lib/gamification';
import { smartSortSections } from '../../lib/smart-sort';
import { buildWeeklyRecapText, buildMonthlyRecapText, buildGrossesseUpdateText } from '../../lib/telegram';
import { loadGrandparentContacts, sendViaChannel, CHANNEL_META, type GrandparentContact } from '../../lib/sharing';
import { Task, RDV, isBabyProfile } from '../../lib/types';
import { aggregateTasksByWeek, getWeekStart } from '../../lib/stats';
import { isRdvUpcoming } from '../../lib/parser';
import { DashboardPrefsModal, SectionPref } from '../../components/DashboardPrefsModal';
import { GlobalSearch } from '../../components/GlobalSearch';
import { getTheme } from '../../constants/themes';
import { generateInsights, type InsightInput } from '../../lib/insights';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { getCardTemplate } from '../../lib/card-templates';
import { getFruitForWeek, getSizeForWeek, getFruitLabel } from '../../lib/pregnancy';
import { GlassView } from '../../components/ui/GlassView';
import { SectionErrorBoundary } from '../../components/SectionErrorBoundary';
import { FontSize, FontWeight } from '../../constants/typography';
import { Layout } from '../../constants/spacing';
import type { CardTemplateContext } from '../../lib/card-templates';
import { useTranslation } from 'react-i18next';

// Composants de section dashboard
import {
  DashboardInsights,
  DashboardVacation,
  DashboardMenage,
  DashboardOverdue,
  DashboardMeals,
  DashboardPhotos,
  DashboardCourses,
  DashboardRdvs,
  DashboardLoot,
  DashboardRewards,

  DashboardWeeklyStats,
  DashboardBudget,
  DashboardQuickNotifs,
  DashboardRecipes,
  DashboardNightMode,
  DashboardLeaderboard,
  DashboardDefis,
  DashboardGratitude,
  DashboardWishlist,
  DashboardAnniversaires,
  DashboardOnThisDay,
  DashboardQuotes,
  DashboardMoods,
  DashboardCalendar,
  DashboardZenState,
  DashboardBilanSemaine,
  DashboardSecretMissions,
} from '../../components/dashboard';

const PREFS_KEY = 'dashboard_prefs_v1';
const SMART_SORT_KEY = 'dashboard_smart_sort';
const ZEN_CONFIG_KEY = 'zen_config_v1';

interface ZenConfig {
  enabled: boolean;
  excludedSections: string[];
}

/** Sections TOUJOURS exclues du calcul zen (non configurables par l'utilisateur) */
const ZEN_HARDCODED_EXCLUDED = [
  'wishlist', 'anniversaires', 'onThisDay', 'quotes', 'moods', 'lootProgress', 'rewards',
  'weeklyStats', 'leaderboard', 'defis', 'quicknotifs', 'vacation',
  'nightMode', 'budget', 'insights', 'calendar', 'bilanSemaine', 'secretMissions',
];

function getAllSections(t: (key: string) => string): SectionPref[] {
  return [
    // Essentielles — toujours visibles par défaut
    { id: 'insights',   label: t('dashboard.sectionLabels.insights'),        emoji: '💡', visible: true,  priority: 'high' },
    { id: 'vacation',   label: t('dashboard.sectionLabels.vacation'),        emoji: '☀️', visible: true,  priority: 'high' },
    { id: 'overdue',    label: t('dashboard.sectionLabels.overdue'),         emoji: '⚠️', visible: true,  priority: 'high' },
    { id: 'menage',     label: t('dashboard.sectionLabels.menage'),          emoji: '🏠', visible: true,  priority: 'high' },
    { id: 'meals',      label: t('dashboard.sectionLabels.meals'),           emoji: '🍽️', visible: true,  priority: 'high' },
    { id: 'calendar',   label: t('dashboard.sectionLabels.calendar'),        emoji: '📆', visible: true,  priority: 'high' },
    // Secondaires — visibles par défaut
    { id: 'courses',    label: t('dashboard.sectionLabels.courses'),         emoji: '🛒', visible: true,  priority: 'medium' },
    { id: 'rdvs',       label: t('dashboard.sectionLabels.rdvs'),            emoji: '📅', visible: true,  priority: 'medium' },
    { id: 'photos',     label: t('dashboard.sectionLabels.photos'),          emoji: '📸', visible: true,  priority: 'medium' },
    { id: 'budget',     label: t('dashboard.sectionLabels.budget'),          emoji: '💰', visible: true,  priority: 'medium' },
    // Gamification & secondaires — masqués par défaut (découverte progressive)
    { id: 'weeklyStats',  label: t('dashboard.sectionLabels.weeklyStats'),   emoji: '📊', visible: false, priority: 'medium' },
    { id: 'lootProgress', label: t('dashboard.sectionLabels.lootProgress'),  emoji: '🎁', visible: false, priority: 'medium' },
    { id: 'rewards',    label: t('dashboard.sectionLabels.rewards'),         emoji: '🏆', visible: false, priority: 'medium' },
    { id: 'defis',      label: t('dashboard.sectionLabels.defis'),           emoji: '🏅', visible: false, priority: 'medium' },
    { id: 'gratitude',  label: t('dashboard.sectionLabels.gratitude'),       emoji: '🙏', visible: false, priority: 'medium' },
    { id: 'wishlist',   label: t('dashboard.sectionLabels.wishlist'),        emoji: '🎁', visible: false, priority: 'medium' },
    { id: 'anniversaires', label: t('dashboard.sectionLabels.anniversaires'), emoji: '🎂', visible: false, priority: 'medium' },
    { id: 'onThisDay',    label: t('dashboard.sectionLabels.onThisDay'),     emoji: '🕰️', visible: false, priority: 'medium' },
    { id: 'quotes',       label: t('dashboard.sectionLabels.quotes'),        emoji: '💬', visible: false, priority: 'medium' },
    { id: 'moods',        label: t('dashboard.sectionLabels.moods'),         emoji: '🌤️', visible: false, priority: 'medium' },
    { id: 'bilanSemaine', label: t('dashboard.sectionLabels.bilanSemaine'),  emoji: '📝', visible: true,  priority: 'medium' },
    { id: 'secretMissions', label: t('dashboard.sectionLabels.secretMissions'), emoji: '🕵️', visible: true,  priority: 'high' },

    { id: 'quicknotifs',label: t('dashboard.sectionLabels.quicknotifs'),     emoji: '📤', visible: false, priority: 'low' },
    { id: 'recipes',    label: t('dashboard.sectionLabels.recipes'),         emoji: '📖', visible: false, priority: 'low' },
    { id: 'nightMode',  label: t('dashboard.sectionLabels.nightMode'),       emoji: '🌙', visible: false, priority: 'medium' },
    { id: 'leaderboard',label: t('dashboard.sectionLabels.leaderboard'),     emoji: '🥇', visible: false, priority: 'low' },
    // aiAssistant retiré — intégré dans la carte Suggestions
  ];
}

/** Sections masquées pour les enfants (outils parentaux) */
const ADULT_ONLY_SECTIONS = new Set(['courses', 'budget', 'quicknotifs', 'recipes', 'photos', 'rdvs', 'nightMode']);

/** Sections promues en haute priorité pour les enfants */
const CHILD_PROMOTED: Record<string, { visible: boolean; priority: 'high' | 'medium' | 'low' }> = {
  rewards:     { visible: true, priority: 'high' },
  leaderboard: { visible: true, priority: 'high' },
  defis:          { visible: true, priority: 'high' },
  secretMissions: { visible: true, priority: 'high' },
};

function getDefaultSections(t: (key: string) => string, role?: string): SectionPref[] {
  const allSections = getAllSections(t);
  if (role === 'enfant' || role === 'ado') {
    return allSections
      .filter((s) => !ADULT_ONLY_SECTIONS.has(s.id))
      .map((s) => CHILD_PROMOTED[s.id] ? { ...s, ...CHILD_PROMOTED[s.id] } : s);
  }
  return allSections;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const {
    isLoading,
    error,
    vaultPath,
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
    getPhotoUri,
    memories,
    toggleTask,
    addRDV,
    updateRDV,
    deleteRDV,
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
    gratitudeDays,
    wishlistItems,
    anniversaries,
    skillTrees,
    setActiveProfile,
  } = useVault();

  // Active rewards (filtered for non-expired)
  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);

  const { completeTask } = useGamification({ vault, notifPrefs });
  const auth = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [isSendingRecap, setIsSendingRecap] = useState(false);
  const [rdvEditorVisible, setRdvEditorVisible] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);
  const [sectionPrefs, setSectionPrefs] = useState<SectionPref[]>(() => getDefaultSections(t, activeProfile?.role));
  const [prefsModalVisible, setPrefsModalVisible] = useState(false);
  const [dashboardRecipe, setDashboardRecipe] = useState<AppRecipe | null>(null);
  const [smartSort, setSmartSort] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [profilePickerVisible, setProfilePickerVisible] = useState(false);
  const [zenConfig, setZenConfig] = useState<ZenConfig>({ enabled: true, excludedSections: [] });

  // Fichiers vault qui existent réellement (pour distinguer "fichier absent" de "données vides")
  const [vaultFileExists, setVaultFileExists] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!vault) return;
    (async () => {
      const keys = {
        menage: '02 - Maison/Tâches récurrentes.md',
        meals: '', // vérifié via meals.length ci-dessous
        budget: '05 - Budget/config.md',
        notifications: 'notifications.md',
      };
      const checks: Record<string, boolean> = {};
      await Promise.all(
        Object.entries(keys).map(async ([key, path]) => {
          checks[key] = path ? await vault.exists(path) : false;
        })
      );
      // Fichiers dynamiques : vérifier via les données chargées
      checks.rdvs = rdvs.length > 0;
      checks.meals = meals.length > 0;
      setVaultFileExists(checks);
    })();
  }, [vault, isLoading, rdvs.length, meals.length]);

  // Mode enfant : UX simplifiée (gros boutons, vocab simple)
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  // Refs pour les coach marks
  const headerRef = useRef<View>(null);

  // Load persisted section prefs on mount (filtered by profile role)
  const roleDefaults = useMemo(() => getDefaultSections(t, activeProfile?.role), [t, activeProfile?.role]);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(PREFS_KEY),
      SecureStore.getItemAsync(SMART_SORT_KEY),
      SecureStore.getItemAsync(ZEN_CONFIG_KEY),
    ]).then(([raw, smartSortVal, zenRaw]) => {
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
      // Zen config
      if (zenRaw) {
        try { setZenConfig(JSON.parse(zenRaw)); } catch { /* ignore */ }
      }
    });
  }, [roleDefaults]);

  const saveSectionPrefs = useCallback(async ({ sections: prefs, smartSort: newSmartSort }: { sections: SectionPref[]; smartSort: boolean }) => {
    setSectionPrefs(prefs);
    setSmartSort(newSmartSort);
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
    await SecureStore.setItemAsync(SMART_SORT_KEY, newSmartSort ? '1' : '0');
  }, []);

  const today = format(new Date(), 'EEEE dd MMMM yyyy', { locale: getDateLocale() });
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const buildRecapData = useCallback(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
    const enfantNames = profiles.filter((p) => p.role === 'enfant').map((p) => p.name);
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
    return { enfantNames, weekMemories, weekPhotoUris };
  }, [memories, photoDates, profiles, getPhotoUri]);

  const handleSendRecap = useCallback(async () => {
    const contacts = await loadGrandparentContacts();
    if (contacts.length === 0) {
      Alert.alert(t('index.alert.noContact'), t('index.alert.noContactMsg'));
      return;
    }

    const hasGrossesse = profiles.some((p) => p.statut === 'grossesse' && p.dateTerme);

    // Construire les options
    type RecapAction = { label: string; type: 'recap' | 'monthly' | 'grossesse'; contact?: GrandparentContact };
    const actions: RecapAction[] = [];

    if (contacts.length === 1) {
      actions.push({ label: t('index.recap.weekTo', { name: contacts[0].name }), type: 'recap', contact: contacts[0] });
      actions.push({ label: t('index.recap.monthTo', { name: contacts[0].name }), type: 'monthly', contact: contacts[0] });
      if (hasGrossesse) actions.push({ label: t('index.recap.pregnancyTo', { name: contacts[0].name }), type: 'grossesse', contact: contacts[0] });
    } else {
      // Envoi à tous
      actions.push({ label: t('index.recap.weekAll'), type: 'recap' });
      actions.push({ label: t('index.recap.monthAll'), type: 'monthly' });
      if (hasGrossesse) actions.push({ label: t('index.recap.pregnancyAll'), type: 'grossesse' });
      // Envoi individuel
      for (const c of contacts) {
        const meta = CHANNEL_META[c.channel];
        actions.push({ label: t('index.recap.weekChannel', { emoji: meta.emoji, name: c.name }), type: 'recap', contact: c });
      }
    }

    const buttons = actions.map((a) => ({
      text: a.label,
      onPress: async () => {
        setIsSendingRecap(true);
        const token = await SecureStore.getItemAsync('telegram_token') ?? '';
        const targetContacts = a.contact ? [a.contact] : contacts;

        for (const contact of targetContacts) {
          if (a.type === 'recap') {
            const { weekMemories, weekPhotoUris, enfantNames } = buildRecapData();
            const text = buildWeeklyRecapText({ memories: weekMemories, photoCount: weekPhotoUris.length, enfantNames });
            await sendViaChannel(contact, text, token, weekPhotoUris);
          } else if (a.type === 'monthly') {
            const now = new Date();
            const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const monthLabel = now.toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' });
            const monthMemories = memories.filter((m) => m.date >= monthStart);
            const enfantNames = profiles.filter((p) => p.role === 'enfant').map((p) => p.name);
            let photoCount = 0;
            for (const name of enfantNames) {
              const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
              photoCount += (photoDates[id] ?? []).filter((d) => d >= monthStart).length;
            }
            const text = buildMonthlyRecapText({ profiles, memories: monthMemories, rdvs: [], photoCount, completedTasksCount: 0, month: monthLabel });
            await sendViaChannel(contact, text, token);
          } else if (a.type === 'grossesse') {
            const text = buildGrossesseUpdateText(profiles);
            if (text) await sendViaChannel(contact, text, token);
          }
        }

        showToast(t('index.toast.sendDone'));
        setIsSendingRecap(false);
      },
    }));

    buttons.push({ text: t('index.recap.cancel'), onPress: async () => {} });

    Alert.alert(t('index.alert.shareToGrandparents'), t('index.alert.shareQuestion'), buttons);
  }, [profiles, memories, photoDates, buildRecapData, showToast]);

  const handleTaskToggle = useCallback(
    async (task: Task, completed: boolean) => {
      try {
        await toggleTask(task, completed);
        if (completed && activeProfile) {
          try {
            const { lootAwarded, pointsGained } = await completeTask(activeProfile, task.text);
            await refreshGamification();
            const themeEmoji = getTheme(activeProfile.theme).emoji;
            const name = activeProfile.name;
            const taskShort = task.text.length > 25 ? task.text.slice(0, 25) + '…' : task.text;
            if (lootAwarded) {
              showToast(t('index.toast.taskCompleteLoot', { emoji: themeEmoji, name, task: taskShort, points: pointsGained }));
            } else {
              showToast(t('index.toast.taskComplete', { emoji: themeEmoji, name, task: taskShort, points: pointsGained }));
            }
          } catch {
            // Gamification error — non-critical
          }
        }
      } catch (e) {
        showToast(t('index.toast.taskError', { error: String(e) }), 'error');
        await refresh();
      }
    },
    [toggleTask, activeProfile, completeTask, refresh, refreshGamification]
  );

  const leaderboard = buildLeaderboard(profiles);
  const hasBaby = useMemo(() => profiles.some(isBabyProfile), [profiles]);

  // Custom notifications for quick-send buttons
  const customNotifs = notifPrefs.notifications.filter(
    (n) => n.isCustom && n.enabled && n.event === 'manual'
  );

  // Données dérivées pour le tri intelligent
  const todayForMaison = new Date().toISOString().slice(0, 10);
  const pendingMenage = tasks.filter((t) =>
    t.sourceFile.includes('Maison') && !t.completed && t.dueDate && t.dueDate <= todayForMaison
  );
  const todayDayName = useMemo(() => {
    const name = format(new Date(), 'EEEE', { locale: getDateLocale() });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);
  const todayMeals = meals.filter((m) => m.day === todayDayName && m.text.length > 0);
  const topCourses = courses.filter((c) => !c.completed).slice(-5).reverse();
  const upcomingRdvs = rdvs.filter((r) => isRdvUpcoming(r));
  const enfants = profiles.filter((p) => p.role === 'enfant');
  const overdueTasks = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate < todayStr
  );

  // Contexte pour les templates de cartes vides
  const cardTemplateCtx: CardTemplateContext = useMemo(() => ({
    today: todayStr,
    childrenNames: enfants.map((e) => e.name),
  }), [todayStr, enfants]);

  // Activer une carte vide → crée les fichiers template dans le vault
  const activateCardTemplate = useCallback(async (cardId: string) => {
    if (!vault) return;
    const template = getCardTemplate(cardId);
    if (!template) return;
    const files = template.generateFiles(cardTemplateCtx);
    for (const file of files) {
      await vault.writeFile(file.path, file.content);
    }
    setVaultFileExists(prev => ({ ...prev, [cardId]: true }));
    await refresh();
  }, [vault, cardTemplateCtx, refresh]);

  // Stats semaine (pour tri intelligent)
  const weeklyStatsData = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const data = aggregateTasksByWeek(tasks, weekStart);
    const total = data.reduce((s, d) => s + d.value, 0);
    return { data, total };
  }, [tasks]);

  // Insights locaux (pour tri intelligent)
  const insights = useMemo(() => {
    const input: InsightInput = {
      tasks, courses, stock, meals, rdvs,
      profiles, activeProfile, defis, gratitudeDays,
      memories, vacationConfig, isVacationActive,
      gamiData, photoDates, anniversaries, skillTrees,
    };
    return generateInsights(input);
  }, [tasks, courses, stock, meals, rdvs, profiles, activeProfile,
    defis, gratitudeDays, memories, vacationConfig, isVacationActive, gamiData, photoDates, anniversaries, skillTrees]);

  // Tri intelligent
  const sortedSections = useMemo(() => {
    if (!smartSort) return sectionPrefs;
    const activeSections = new Set<string>();
    if (insights.length > 0) activeSections.add('insights');
    if (pendingMenage.length > 0) activeSections.add('menage');
    if (todayMeals.length > 0) activeSections.add('meals');
    if (topCourses.length > 0) activeSections.add('courses');
    if (upcomingRdvs.length > 0) activeSections.add('rdvs');
    if (enfants.length > 0) activeSections.add('photos');
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
    // Anniversaires : vérifier s'il y en a dans les 7 prochains jours
    if (anniversaries && anniversaries.length > 0) {
      const now = new Date();
      const hasUpcoming = anniversaries.some((a) => {
        const [mm, dd] = a.date.split('-').map(Number);
        if (!mm || !dd) return false;
        const thisYear = new Date(now.getFullYear(), mm - 1, dd);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diff = Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
      });
      if (hasUpcoming) activeSections.add('anniversaires');
    }
    // Minutes avant le prochain RDV d'aujourd'hui
    const now = new Date();
    const todayRdvs = rdvs.filter(
      (r) => r.statut === 'planifié' && r.date_rdv === todayStr && r.heure,
    );
    let rdvMinutesUntilNext: number | undefined;
    if (todayRdvs.length > 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const futureMinutes = todayRdvs
        .map((r) => {
          const [h, m] = r.heure.split(':').map(Number);
          return (h ?? 0) * 60 + (m ?? 0);
        })
        .filter((m) => m > nowMin)
        .sort((a, b) => a - b);
      if (futureMinutes.length > 0) {
        rdvMinutesUntilNext = futureMinutes[0] - nowMin;
      }
    }

    return smartSortSections(sectionPrefs, {
      hour: now.getHours(),
      hasBaby,
      isVacationActive: !!isVacationActive,
      activeSections,
      counts: {
        overdue: overdueTasks.length,
        menagePending: pendingMenage.length,
        coursesRemaining: topCourses.length,
        rdvToday: todayRdvs.length,
        rdvMinutesUntilNext,
        mealsPlanned: todayMeals.length,
        insightsCount: insights.length,
        defisActive: defis.filter((d) => d.status === 'active').length,
        dayOfWeek: now.getDay(),
      },
    });
  }, [smartSort, sectionPrefs, hasBaby, overdueTasks.length, isVacationActive,
    pendingMenage.length, todayMeals.length, topCourses.length, upcomingRdvs.length,
    enfants.length, activeRewards.length, leaderboard.length,
    weeklyStatsData.total, activeProfile, recipes.length, customNotifs.length,
    defis, gratitudeDays, todayStr, wishlistItems, anniversaries, rdvs, insights.length]);

  // === Masquage individuel des sections ===
  const sectionHidden = useMemo(() => {
    if (isLoading) return new Set<string>();
    const hidden = new Set<string>();

    // Tâches en retard — masquer si aucune
    if (overdueTasks.length === 0) hidden.add('overdue');

    // Ménage — masquer si tout est fait
    if (pendingMenage.length === 0) hidden.add('menage');

    // Suggestions — masquer si aucun insight
    if (insights.length === 0) hidden.add('insights');

    // Photos — masquer si toutes les photos du jour sont prises
    const allPhotosTaken = enfants.length > 0 && enfants.every(
      (e) => (photoDates[e.id] ?? []).includes(todayStr)
    );
    if (allPhotosTaken) hidden.add('photos');

    // Recettes — masquer si les repas sont déjà configurés
    if (todayMeals.length > 0) hidden.add('recipes');

    // Courses — masquer si la liste est vide
    if (topCourses.length === 0) hidden.add('courses');

    // RDV — masquer s'il n'y a rien aujourd'hui (demain est rappelé dans l'aperçu zen)
    const hasRdvToday = rdvs.some(
      (r) => r.statut === 'planifié' && r.date_rdv === todayStr
    );
    if (!hasRdvToday) hidden.add('rdvs');

    // Gratitude — masquer si toutes les gratitudes du jour sont faites
    const gratitudeProfiles = profiles.filter(
      (p) => p.statut !== 'grossesse' && !isBabyProfile(p)
    );
    const todayGrat = gratitudeDays.find((d) => d.date === todayStr);
    const allGratitudeDone = gratitudeProfiles.length > 0
      && (todayGrat?.entries.length ?? 0) >= gratitudeProfiles.length;
    if (allGratitudeDone) hidden.add('gratitude');

    // Anniversaires — masquer si aucun dans les 7 prochains jours
    const now = new Date();
    const hasUpcomingAnniv = anniversaries?.some((a) => {
      const [mm, dd] = a.date.split('-').map(Number);
      if (!mm || !dd) return false;
      const thisYear = new Date(now.getFullYear(), mm - 1, dd);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diff = Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    });
    if (!hasUpcomingAnniv) hidden.add('anniversaires');

    // Il y a 1 an — masquer si aucun souvenir/photo à cette date les années passées
    const mmStr = String(now.getMonth() + 1).padStart(2, '0');
    const ddStr = String(now.getDate()).padStart(2, '0');
    const todaySuffix = `-${mmStr}-${ddStr}`;
    const hasMemoryOnThisDay = memories.some(
      (m) => m.date?.endsWith(todaySuffix) && parseInt(m.date.substring(0, 4), 10) < now.getFullYear()
    );
    const hasPhotoOnThisDay = enfants.some(
      (e) => (photoDates[e.id] ?? []).some(
        (d) => d.endsWith(todaySuffix) && parseInt(d.substring(0, 4), 10) < now.getFullYear()
      )
    );
    if (!hasMemoryOnThisDay && !hasPhotoOnThisDay) hidden.add('onThisDay');

    // Souhaits — toujours visible (ne participe pas au masquage)

    // Mode nuit bébé — pas de bébé ou pas la nuit
    const hour = new Date().getHours();
    const isNightTime = hour >= 20 || hour < 8;
    if (!hasBaby || !isNightTime) hidden.add('nightMode');

    // Gamification
    if (!activeProfile) hidden.add('lootProgress');
    if (activeRewards.length === 0) hidden.add('rewards');
    if (weeklyStatsData.total === 0) hidden.add('weeklyStats');
    if (leaderboard.length === 0) hidden.add('leaderboard');
    if (!defis.some((d) => d.status === 'active')) hidden.add('defis');

    // Budget — masquer si pas configuré
    if (!vaultFileExists.budget || budgetEntries.length === 0) hidden.add('budget');

    // Notifications rapides — masquer si pas configuré
    if (!vaultFileExists.notifications) hidden.add('quicknotifs');

    // Vacances — masquer si pas actives (le composant le fait déjà mais cohérence)
    if (!isVacationActive) hidden.add('vacation');

    return hidden;
  }, [isLoading, overdueTasks.length, pendingMenage.length, insights.length,
    enfants, photoDates, todayStr, todayMeals.length, topCourses.length,
    rdvs, profiles, gratitudeDays, anniversaries, wishlistItems, hasBaby,
    activeProfile, activeRewards.length, weeklyStatsData.total,
    leaderboard.length, defis, vaultFileExists, isVacationActive,
    budgetEntries.length, memories]);

  // === Mode zen : TOUTES les sections visibles sont masquées (sauf exceptions) ===
  // Combine les exclusions hardcodées (toujours exclues) + les sections exclues par l'utilisateur
  const ZEN_EXCLUDED = useMemo(() => {
    const set = new Set(ZEN_HARDCODED_EXCLUDED);
    // meals est exclu du filtre sectionHidden (toujours visible) — géré via ZEN_ALWAYS_VISIBLE_CONDITIONS
    set.add('meals');
    // Ajouter les sections que l'utilisateur a exclues du zen
    for (const id of zenConfig.excludedSections) {
      set.add(id);
    }
    return set;
  }, [zenConfig.excludedSections]);

  // Sections toujours visibles mais requises pour le zen (condition vérifiée séparément)
  const ZEN_ALWAYS_VISIBLE_CONDITIONS = useMemo(() => {
    const conditions: Record<string, boolean> = {};
    // meals n'est requis que si l'utilisateur ne l'a pas exclu
    if (!zenConfig.excludedSections.includes('meals')) {
      conditions.meals = todayMeals.length > 0;
    }
    return conditions;
  }, [todayMeals.length, zenConfig.excludedSections]);

  const isDayComplete = useMemo(() => {
    // Le mode zen doit être activé dans les réglages
    if (!zenConfig.enabled) return false;
    if (isLoading) return false;
    // Toutes les sections masquables doivent être masquées
    const allHiddenOk = sortedSections
      .filter((s) => s.visible && !ZEN_EXCLUDED.has(s.id))
      .every((s) => sectionHidden.has(s.id));
    // Les sections toujours visibles doivent remplir leur condition
    const alwaysVisibleOk = Object.values(ZEN_ALWAYS_VISIBLE_CONDITIONS).every(Boolean);
    return allHiddenOk && alwaysVisibleOk;
  }, [zenConfig.enabled, isLoading, sortedSections, sectionHidden, ZEN_EXCLUDED, ZEN_ALWAYS_VISIBLE_CONDITIONS]);

  // Aperçu de demain (uniquement si mode zen actif)
  const tomorrowPreview = useMemo(() => {
    if (!isDayComplete) return undefined;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    const tomorrowDayName = (() => {
      const name = format(tomorrow, 'EEEE', { locale: getDateLocale() });
      return name.charAt(0).toUpperCase() + name.slice(1);
    })();

    const tomorrowTasks = tasks.filter(
      (t) => !t.completed && t.dueDate && t.dueDate === tomorrowStr
    ).length;
    const tomorrowMeals = meals.filter(
      (m) => m.day === tomorrowDayName && m.text.length > 0
    ).length;
    const tomorrowRdvs = rdvs.filter(
      (r) => r.statut === 'planifié' && r.date_rdv === tomorrowStr
    );
    const firstRdv = tomorrowRdvs.length > 0
      ? `${tomorrowRdvs[0].type_rdv} ${tomorrowRdvs[0].enfant}${tomorrowRdvs[0].heure ? ` ${tomorrowRdvs[0].heure}` : ''}`
      : undefined;

    return {
      tasks: tomorrowTasks,
      rdvs: tomorrowRdvs.length,
      meals: tomorrowMeals,
      firstRdv,
    };
  }, [isDayComplete, tasks, meals, rdvs]);

  // Props partagées pour toutes les sections
  const sectionProps = useMemo(() => ({
    isChildMode,
    vaultFileExists,
    activateCardTemplate,
    insights,
  }), [isChildMode, vaultFileExists, activateCardTemplate, insights]);

  const sectionPropsWithToggle = useMemo(() => ({
    ...sectionProps,
    handleTaskToggle,
  }), [sectionProps, handleTaskToggle]);

  // Callbacks pour les modals
  const handleEditRDV = useCallback((rdv?: RDV) => {
    setEditingRDV(rdv);
    setRdvEditorVisible(true);
  }, []);

  const handleViewRecipe = useCallback((recipe: AppRecipe) => {
    setDashboardRecipe(recipe);
  }, []);

  // Mapping section ID → composant React
  const renderSection = (id: string): React.ReactNode => {
    switch (id) {
      case 'insights':     return <DashboardInsights key={id} {...sectionProps} />;
      case 'vacation':     return <DashboardVacation key={id} {...sectionPropsWithToggle} />;
      case 'menage':       return <DashboardMenage key={id} {...sectionPropsWithToggle} />;
      case 'overdue':      return <DashboardOverdue key={id} {...sectionPropsWithToggle} />;
      case 'meals':        return <DashboardMeals key={id} {...sectionProps} onViewRecipe={handleViewRecipe} />;
      case 'photos':       return <DashboardPhotos key={id} {...sectionProps} />;
      case 'courses':      return <DashboardCourses key={id} {...sectionProps} />;
      case 'rdvs':         return <DashboardRdvs key={id} {...sectionProps} onEditRDV={handleEditRDV} />;
      case 'lootProgress': return <DashboardLoot key={id} {...sectionProps} />;
      case 'rewards':      return <DashboardRewards key={id} {...sectionProps} />;

      case 'weeklyStats':  return <DashboardWeeklyStats key={id} {...sectionProps} />;
      case 'budget':       return <DashboardBudget key={id} {...sectionProps} />;
      case 'quicknotifs':  return <DashboardQuickNotifs key={id} {...sectionProps} />;
      case 'recipes':      return <DashboardRecipes key={id} {...sectionProps} onViewRecipe={handleViewRecipe} />;
      case 'nightMode':    return <DashboardNightMode key={id} {...sectionProps} />;
      case 'leaderboard':  return <DashboardLeaderboard key={id} {...sectionProps} />;
      case 'defis':        return <DashboardDefis key={id} {...sectionProps} />;
      case 'gratitude':    return <DashboardGratitude key={id} {...sectionProps} />;
      case 'wishlist':     return <DashboardWishlist key={id} {...sectionProps} />;
      case 'anniversaires': return <DashboardAnniversaires key={id} {...sectionProps} />;
      case 'onThisDay':    return <DashboardOnThisDay key={id} {...sectionProps} />;
      case 'quotes':       return <DashboardQuotes key={id} {...sectionProps} />;
      case 'moods':        return <DashboardMoods key={id} {...sectionProps} />;
      case 'calendar':     return <DashboardCalendar key={id} {...sectionProps} />;
      case 'bilanSemaine': return <DashboardBilanSemaine key={id} {...sectionProps} />;
      case 'secretMissions': return <DashboardSecretMissions key={id} {...sectionProps} />;
      default:             return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <LivingGradient style={[styles.header, { borderBottomColor: colors.separator }]} ref={headerRef}>
        <SeasonalParticles />
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => setProfilePickerVisible(true)}
            style={[styles.avatarBtn, { backgroundColor: tint }]}
            activeOpacity={0.7}
            accessibilityLabel={t('index.a11y.activeProfile', { name: activeProfile?.name ?? 'aucun' })}
            accessibilityRole="button"
          >
            <ReactiveAvatar
              emoji={activeProfile?.avatar ?? '👤'}
              mood={getAvatarMood({
                hour: new Date().getHours(),
                hasLoot: (activeProfile?.lootBoxesAvailable ?? 0) > 0,
                allTasksDone: tasks.length > 0 && tasks.filter(t => t.dueDate === todayStr && !t.completed).length === 0,
                hasOverdue: overdueTasks.length > 0,
              })}
            />
          </TouchableOpacity>
          <View style={styles.headerGreeting}>
            <Text style={[
              isChildMode ? styles.greetingChild : styles.greeting,
              { color: colors.textSub },
            ]}>
              {isChildMode
                ? t('index.greeting.child', { name: activeProfile?.name ?? '' })
                : (() => {
                    const h = new Date().getHours();
                    const name = activeProfile?.name ? ` ${activeProfile.name}` : '';
                    if (h < 6) return t('index.greeting.night', { name });
                    if (h < 12) return t('index.greeting.morning', { name });
                    if (h < 18) return t('index.greeting.afternoon', { name });
                    return t('index.greeting.evening', { name });
                  })()}
            </Text>
            <Text style={[styles.dateText, { color: colors.text }]}>{today}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setSearchVisible(true)}
            style={[styles.headerBtn, { backgroundColor: colors.cardAlt }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('index.a11y.search')}
            accessibilityRole="search"
          >
            <Text style={styles.headerBtnIcon}>🔍</Text>
            <Text style={[styles.headerBtnLabel, { color: colors.textMuted }]}>{t('index.header.search')}</Text>
          </TouchableOpacity>
          {!isChildMode && (
            <TouchableOpacity
              onPress={handleSendRecap}
              style={[styles.headerBtn, { backgroundColor: colors.cardAlt }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isSendingRecap}
              accessibilityLabel={t('index.a11y.sendRecap')}
              accessibilityRole="button"
            >
              <Text style={styles.headerBtnIcon}>{isSendingRecap ? '⏳' : '📤'}</Text>
              <Text style={[styles.headerBtnLabel, { color: colors.textMuted }]}>{t('index.header.recap')}</Text>
            </TouchableOpacity>
          )}
          {!isChildMode && (
            <TouchableOpacity
              onPress={() => setPrefsModalVisible(true)}
              style={[styles.headerBtn, { backgroundColor: colors.cardAlt }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('index.a11y.configureSections')}
              accessibilityRole="button"
            >
              <Text style={styles.headerBtnIcon}>⚙️</Text>
              <Text style={[styles.headerBtnLabel, { color: colors.textMuted }]}>{t('index.header.sections')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </LivingGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Welcome card when no vault configured */}
        {!isLoading && !vaultPath && (
          <DashboardCard title={t('index.welcome.title')} icon="👋" color={primary}>
            <Text style={[styles.welcomeText, { color: colors.textSub }]}>
              {t('index.welcome.text')}
            </Text>
            <Text style={[styles.welcomeSubText, { color: colors.textMuted }]}>
              {t('index.welcome.subText')}
            </Text>
            <TouchableOpacity
              style={[styles.welcomeBtn, { backgroundColor: primary }]}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.8}
            >
              <Text style={[styles.welcomeBtnText, { color: colors.onPrimary }]}>{t('index.welcome.openSettings')}</Text>
            </TouchableOpacity>
          </DashboardCard>
        )}


        {profiles.filter((p) => p.statut === 'grossesse' && p.dateTerme).map((p) => {
          const daysLeft = Math.ceil((new Date(p.dateTerme!).getTime() - new Date().getTime()) / 86400000);
          const totalDays = 287; // 41 SA (convention française)
          const daysElapsed = totalDays - daysLeft;
          const weeksElapsed = Math.max(0, Math.floor(daysElapsed / 7));
          const fruitEmoji = getFruitForWeek(weeksElapsed);
          const fruitLabel = getFruitLabel(weeksElapsed);
          const sizeCm = getSizeForWeek(weeksElapsed);
          const progress = Math.min(1, Math.max(0, daysElapsed / totalDays));
          return (
            <TouchableOpacity key={p.id} onPress={() => router.push('/(tabs)/pregnancy' as any)} activeOpacity={0.8}>
            <GlassView style={styles.pregnancyCard}>
              <View style={styles.pregnancyRow}>
                <Text style={styles.pregnancyFruit}>{fruitEmoji}</Text>
                <View style={styles.pregnancyInfo}>
                  <Text style={[styles.pregnancyTitle, { color: colors.text }]} numberOfLines={1}>
                    {p.name} — {t('index.pregnancy.sa', { weeks: weeksElapsed })}
                  </Text>
                  <Text style={[styles.pregnancySub, { color: colors.textSub }]}>
                    {daysLeft > 0
                      ? `${t('index.pregnancy.daysLeft', { days: daysLeft })} · ${fruitLabel}${sizeCm > 0 ? ` · ${sizeCm} cm` : ''}`
                      : daysLeft === 0
                        ? t('index.pregnancy.today')
                        : t('index.pregnancy.overdue', { days: Math.abs(daysLeft) })}
                  </Text>
                </View>
                {daysLeft <= 28 && (
                  <TouchableOpacity
                    style={[styles.pregnancyCta, { backgroundColor: primary }]}
                    onPress={() => {
                      Alert.prompt
                        ? Alert.prompt(t('index.pregnancy.birthDateTitle'), t('index.pregnancy.birthDatePlaceholder'), (date) => {
                            if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) convertToBorn(p.id, date);
                          }, 'plain-text', format(new Date(), 'yyyy-MM-dd'))
                        : Alert.alert(t('index.alert.babyBorn'), t('index.alert.babyBornMsg'));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pregnancyCtaText, { color: colors.onPrimary }]}>{t('index.pregnancy.born')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.pregnancyBar, { backgroundColor: colors.border }]}>
                <View style={[styles.pregnancyBarFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: primary }]} />
              </View>
            </GlassView>
            </TouchableOpacity>
          );
        })}

        {ageUpgrades.map((upgrade) => {
          const catLabels: Record<string, string> = { bebe: t('index.ageUpgrade.catLabels.bebe'), petit: t('index.ageUpgrade.catLabels.petit'), enfant: t('index.ageUpgrade.catLabels.enfant'), ado: t('index.ageUpgrade.catLabels.ado') };
          return (
            <View key={upgrade.profileId} style={[styles.ageUpgradeBanner, { backgroundColor: colors.warningBg, borderColor: primary }]}>
              <Text style={[styles.ageUpgradeTitle, { color: colors.text }]}>
                {t('index.ageUpgrade.title', { name: upgrade.childName })}
              </Text>
              <Text style={[styles.ageUpgradeDesc, { color: colors.textSub }]}>
                {t('index.ageUpgrade.description', { oldCategory: catLabels[upgrade.oldCategory], newCategory: catLabels[upgrade.newCategory] })}
              </Text>
              <View style={styles.ageUpgradeActions}>
                <TouchableOpacity
                  style={[styles.ageUpgradeBtn, { backgroundColor: primary }]}
                  onPress={() => {
                    Alert.alert(
                      t('index.alert.updateTasks'),
                      t('index.alert.updateTasksMsg', { name: upgrade.childName, category: catLabels[upgrade.newCategory] }),
                      [
                        { text: t('index.alert.cancel'), style: 'cancel' },
                        { text: t('index.alert.update'), onPress: () => applyAgeUpgrade(upgrade) },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.ageUpgradeBtnText, { color: colors.onPrimary }]}>{t('index.ageUpgrade.update')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ageUpgradeDismiss}
                  onPress={() => dismissAgeUpgrade(upgrade.profileId)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.ageUpgradeDismissText, { color: colors.textMuted }]}>{t('index.ageUpgrade.later')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {isDayComplete && vaultPath && (
          <DashboardZenState
            isChildMode={isChildMode}
            tomorrow={tomorrowPreview}
          />
        )}

        {sortedSections.map((s) => {
          if (!s.visible) return null;
          // Le masquage auto ne s'applique que si la section est visible par défaut
          // (sinon l'utilisateur a explicitement activé la section → on la respecte)
          const defaultPref = getAllSections(t).find((d) => d.id === s.id);
          if (sectionHidden.has(s.id) && defaultPref?.visible !== false) return null;
          return (
            <SectionErrorBoundary key={`eb-${s.id}`} name={s.label}>
              {renderSection(s.id)}
            </SectionErrorBoundary>
          );
        })}

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
          profiles={profiles}
          onSave={async (data) => {
            if (editingRDV) {
              await updateRDV(editingRDV.sourceFile, data);
            } else {
              await addRDV(data);
            }
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

      {/* Profile picker rapide */}
      <Modal
        visible={profilePickerVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setProfilePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setProfilePickerVisible(false)}
        >
          <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>{t('index.profilePicker.title')}</Text>
            <View style={styles.pickerGrid}>
              {profiles.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.pickerItem,
                    { backgroundColor: colors.cardAlt },
                    p.id === activeProfile?.id && { borderColor: primary, borderWidth: 2 },
                  ]}
                  onPress={async () => {
                    const currentIsChild = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
                    const targetIsAdult = p.role === 'adulte';
                    if (currentIsChild && targetIsAdult && auth.hasPin) {
                      const ok = await auth.authenticate();
                      if (!ok) return; // PIN sera géré via LockScreen
                    }
                    setActiveProfile(p.id);
                    setProfilePickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerAvatar}>{p.avatar}</Text>
                  <Text style={[styles.pickerName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Coach marks */}
      <ScreenGuide
        screenId="dashboard"
        targets={[
          { ref: headerRef, ...HELP_CONTENT.dashboard[0] },
          { ref: headerRef, title: 'Ajout rapide & navigation', body: 'Utilisez le bouton + en bas à droite pour créer rapidement une tâche, un RDV ou un journal. L\'onglet « Plus » donne accès à toutes les fonctions.', position: 'below' },
        ]}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: FontSize.display,
  },
  headerGreeting: {
    flex: 1,
  },
  greeting: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  greetingChild: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
  },
  dateText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 1,
    borderRadius: 10,
  },
  headerBtnIcon: {
    fontSize: FontSize.title,
  },
  headerBtnLabel: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  welcomeText: {
    fontSize: FontSize.lg,
    lineHeight: 24,
    marginBottom: 6,
  },
  welcomeSubText: {
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginBottom: 16,
  },
  welcomeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  welcomeBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
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
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  ageUpgradeDesc: {
    fontSize: FontSize.sm,
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  ageUpgradeDismiss: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ageUpgradeDismissText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Grossesse — Liquid Glass
  pregnancyCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    gap: 10,
  },
  pregnancyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pregnancyFruit: {
    fontSize: FontSize.hero,
  },
  pregnancyInfo: {
    flex: 1,
    gap: 2,
  },
  pregnancyTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  pregnancySub: {
    fontSize: FontSize.label,
    lineHeight: 18,
  },
  pregnancyCta: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pregnancyCtaText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  pregnancyBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  pregnancyBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Profile picker
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pickerCard: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  pickerTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  pickerItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    minWidth: 80,
    gap: 4,
  },
  pickerAvatar: {
    fontSize: FontSize.icon,
  },
  pickerName: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
