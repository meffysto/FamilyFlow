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

import { useCallback, useEffect, useState } from 'react';
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
import { useVault } from '../../hooks/useVault';
import { useGamification } from '../../hooks/useGamification';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../../components/DashboardCard';
import { TaskCard } from '../../components/TaskCard';
import { FamilyLeaderboard } from '../../components/FamilyLeaderboard';
import { RDVEditor } from '../../components/RDVEditor';
import RecipeViewer from '../../components/RecipeViewer';
import type { AppRecipe } from '../../lib/cooklang';
import { buildLeaderboard, processActiveRewards } from '../../lib/gamification';
import {
  dispatchNotification,
  buildManualContext,
} from '../../lib/notifications';
import { buildWeeklyRecapText, sendWeeklyRecap } from '../../lib/telegram';
import { Task, RDV } from '../../lib/types';
import { formatDateForDisplay, isRdvUpcoming } from '../../lib/parser';
import { DashboardPrefsModal, SectionPref } from '../../components/DashboardPrefsModal';
import { categorizeIngredient } from '../../lib/cooklang';

/** Parse "50g beurre" or "50 g de beurre" into name/qty for merge */
function parseCourseInput(text: string): { name: string; quantity: number | null } {
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:g|kg|ml|cl|dl|l|c\.\s*à\s*[sc]\.?|tasse|pincée)?\s*(?:de\s+|d')?(.+)/i);
  if (m) return { quantity: parseFloat(m[1].replace(',', '.')) || null, name: m[2].trim() };
  return { name: text.trim(), quantity: null };
}

const PREFS_KEY = 'dashboard_prefs_v1';

const DEFAULT_SECTIONS: SectionPref[] = [
  { id: 'vacation',   label: 'Vacances',               emoji: '☀️', visible: true },
  { id: 'menage',     label: 'Ménage du jour',         emoji: '🧹', visible: true },
  { id: 'overdue',    label: 'En retard',               emoji: '⚠️', visible: true },
  { id: 'meals',      label: 'Repas du jour',           emoji: '🍽️', visible: true },
  { id: 'photos',     label: 'Photo du jour',           emoji: '📸', visible: true },
  { id: 'courses',    label: 'Courses',                 emoji: '🛒', visible: true },
  { id: 'rdvs',       label: 'Rendez-vous',             emoji: '📅', visible: true },
  { id: 'rewards',    label: 'Récompenses actives',     emoji: '🏆', visible: true },
  { id: 'stock',      label: 'Alertes stock',            emoji: '📦', visible: true },
  { id: 'quicknotifs',label: 'Notifications rapides',   emoji: '📤', visible: true },
  { id: 'recipes',    label: 'Idée recette',             emoji: '📖', visible: true },
  { id: 'leaderboard',label: 'Classement',              emoji: '🥇', visible: true },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
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
    toggleCourseItem,
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
  } = useVault();

  // Active rewards (filtered for non-expired)
  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);

  const { completeTask } = useGamification({ vault, notifPrefs });

  const [refreshing, setRefreshing] = useState(false);
  const [isSendingRecap, setIsSendingRecap] = useState(false);
  const [rdvEditorVisible, setRdvEditorVisible] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);
  const [sectionPrefs, setSectionPrefs] = useState<SectionPref[]>(DEFAULT_SECTIONS);
  const [prefsModalVisible, setPrefsModalVisible] = useState(false);
  const [newCourseText, setNewCourseText] = useState('');
  const [dashboardRecipe, setDashboardRecipe] = useState<AppRecipe | null>(null);

  // Load persisted section prefs on mount
  useEffect(() => {
    SecureStore.getItemAsync(PREFS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved: SectionPref[] = JSON.parse(raw);
        // Re-order saved sections, then append any new ones from DEFAULT
        const orderedIds = saved.map((s) => s.id);
        const merged: SectionPref[] = [
          ...orderedIds
            .map((id) => {
              const def = DEFAULT_SECTIONS.find((s) => s.id === id);
              const sv = saved.find((s) => s.id === id);
              return def ? { ...def, visible: sv?.visible ?? true } : null;
            })
            .filter(Boolean) as SectionPref[],
          ...DEFAULT_SECTIONS.filter((s) => !orderedIds.includes(s.id)),
        ];
        setSectionPrefs(merged);
      } catch {}
    });
  }, []);

  const saveSectionPrefs = useCallback(async (prefs: SectionPref[]) => {
    setSectionPrefs(prefs);
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
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
      Alert.alert(ok ? '✅ Recap envoyé !' : '❌ Échec', ok ? `${weekMemories.length} souvenir(s) + ${weekPhotoUris.length} photo(s)` : "Erreur lors de l'envoi.");
    } catch (e) {
      Alert.alert('Erreur', String(e));
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
            if (lootAwarded) {
              Alert.alert('🎁 Récompense !', `+${pointsGained} points ! Tu as gagné une récompense ! Va dans Menu > Récompenses pour l'ouvrir.`);
            }
          } catch {
            // Gamification error — non-critical
          }
        }
      } catch (e) {
        Alert.alert('Erreur', `Impossible de modifier la tâche : ${e}`);
        // Refresh to revert optimistic update on error
        await refresh();
      }
    },
    [toggleTask, activeProfile, completeTask, refresh, refreshGamification]
  );

  const leaderboard = buildLeaderboard(profiles);

  // Custom notifications for quick-send buttons
  const customNotifs = notifPrefs.notifications.filter(
    (n) => n.isCustom && n.enabled && n.event === 'manual'
  );

  const handleSendCustomNotif = useCallback(
    async (notifId: string) => {
      const context = buildManualContext(activeProfile);
      const ok = await dispatchNotification(notifId, context, notifPrefs);
      if (ok) {
        Alert.alert('Envoyé !', 'Notification envoyée sur Telegram.');
      } else {
        Alert.alert('Envoi impossible', 'Vérifiez votre connexion internet ou la configuration dans les réglages.');
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

  // Top courses
  const topCourses = courses.filter((c) => !c.completed).slice(0, 5);

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

  const renderSection = (id: string): React.ReactNode => {
    switch (id) {
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
          <DashboardCard key="vacation" title="Vacances" icon="☀️" color="#F59E0B" onPressMore={() => router.push('/(tabs)/tasks')}>
            <Text style={[styles.vacCountdown, { color: '#F59E0B' }]}>{vacCountdown}</Text>
            <View style={styles.vacProgressRow}>
              <View style={styles.vacProgressBg}>
                <View style={[styles.vacProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: '#F59E0B' }]} />
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
          <DashboardCard key="menage" title="Ménage du jour" icon="🧹" count={pendingMenage.length} color="#10B981" onPressMore={() => router.push('/(tabs)/tasks')}>
            {pendingMenage.slice(0, 4).map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} />
            ))}
          </DashboardCard>
        );

      case 'overdue':
        if (overdueTasks.length === 0) return null;
        return (
          <DashboardCard key="overdue" title="En retard" icon="⚠️" count={overdueTasks.length} color="#EF4444" onPressMore={() => router.push('/(tabs)/tasks')}>
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
          <DashboardCard key="courses" title="Courses" icon="🛒" count={topCourses.length || undefined} color="#F59E0B" onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'courses' } })}>
            {topCourses.map((item) => (
              <View key={item.id} style={styles.courseRow}>
                <Text style={styles.courseBullet}>•</Text>
                <Text style={[styles.courseText, { color: colors.textSub }]}>{item.text}</Text>
                <TouchableOpacity
                  style={styles.courseCheckBtn}
                  onPress={() => toggleCourseItem(item, true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.courseCheckBtnText}>✓</Text>
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
                placeholderTextColor="#9CA3AF"
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
                style={[styles.courseAddBtn, { backgroundColor: '#F59E0B' }]}
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
                <Text style={styles.courseAddBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {courses.some((c) => c.completed) && (
              <TouchableOpacity
                style={styles.clearCoursesBtn}
                onPress={() => {
                  const count = courses.filter((c) => c.completed).length;
                  Alert.alert('Vider les cochés', `Supprimer ${count} article${count > 1 ? 's' : ''} coché${count > 1 ? 's' : ''} ?`, [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: clearCompletedCourses },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.clearCoursesBtnText}>🗑 Vider les cochés</Text>
              </TouchableOpacity>
            )}
          </DashboardCard>
        );

      case 'rdvs':
        return (
          <DashboardCard key="rdvs" title="Rendez-vous" icon="📅" count={upcomingRdvs.length || undefined} color="#8B5CF6">
            {upcomingRdvs.slice(0, 3).map((rdv) => (
              <TouchableOpacity key={rdv.sourceFile} style={styles.rdvRow} onPress={() => { setEditingRDV(rdv); setRdvEditorVisible(true); }} activeOpacity={0.7}>
                <Text style={styles.rdvDate}>{formatDateForDisplay(rdv.date_rdv)} {rdv.heure ? `à ${rdv.heure}` : ''}</Text>
                <Text style={[styles.rdvTitle, { color: colors.text }]}>{rdv.type_rdv} — {rdv.enfant}</Text>
                {rdv.médecin && <Text style={[styles.rdvMeta, { color: colors.textMuted }]}>{rdv.médecin}</Text>}
              </TouchableOpacity>
            ))}
            {upcomingRdvs.length === 0 && <Text style={styles.rdvEmpty}>Aucun RDV à venir</Text>}
            <View style={styles.cardActions}>
              <TouchableOpacity style={[styles.rdvAddBtn, { backgroundColor: tint, borderColor: primary }]} onPress={() => { setEditingRDV(undefined); setRdvEditorVisible(true); }} activeOpacity={0.7}>
                <Text style={[styles.rdvAddBtnText, { color: primary }]}>+ Nouveau</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(tabs)/rdv')} activeOpacity={0.7}>
                <Text style={[styles.seeAllText, { color: primary }]}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
          </DashboardCard>
        );

      case 'rewards':
        if (activeRewards.length === 0) return null;
        return (
          <DashboardCard key="rewards" title="Récompenses actives" icon="🏆" color="#EF4444">
            {activeRewards.map((reward) => {
              const ownerProfile = profiles.find((p) => p.id === reward.profileId);
              const typeColor = reward.type === 'vacation' || reward.type === 'crown' || reward.type === 'multiplier' ? '#EF4444' : '#F59E0B';
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
          <DashboardCard key="stock" title="Stock bébé" icon="📦" count={lowCount > 0 ? lowCount : undefined} color={lowCount > 0 ? '#EF4444' : '#10B981'}>
            {stock.filter((s) => s.quantite <= s.seuil + 1).map((item) => {
              const isLow = item.quantite <= item.seuil;
              const statusColor = isLow ? '#EF4444' : '#F59E0B';
              return (
                <View key={`${item.section}-${item.produit}`} style={styles.stockRow}>
                  <Text style={styles.stockAlertIcon}>{isLow ? '🔴' : '🟡'}</Text>
                  <View style={styles.stockInfo}>
                    <Text style={[styles.stockName, { color: colors.text }]}>{item.produit}{item.detail ? ` (${item.detail})` : ''}</Text>
                    <Text style={[styles.stockMeta, { color: statusColor }]}>{item.quantite} restant{item.quantite > 1 ? 's' : ''} (seuil: {item.seuil})</Text>
                  </View>
                  <View style={styles.stockBtnGroup}>
                    {isLow && (
                      <TouchableOpacity style={styles.stockCartBtn} onPress={async () => { const n = item.detail ? `${item.produit} (${item.detail})` : item.produit; await addCourseItem(n, 'Produits bébé'); Alert.alert('Ajouté !', `${n} ajouté aux courses`); }} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
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

      case 'quicknotifs':
        if (customNotifs.length === 0) return null;
        return (
          <DashboardCard key="quicknotifs" title="Notifications rapides" icon="📤" color="#10B981">
            <View style={styles.quickNotifGrid}>
              {customNotifs.map((notif) => (
                <TouchableOpacity key={notif.id} style={styles.quickNotifBtn} onPress={() => handleSendCustomNotif(notif.id)}>
                  <Text style={styles.quickNotifEmoji}>{notif.emoji}</Text>
                  <Text style={styles.quickNotifLabel}>{notif.label}</Text>
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
          <DashboardCard key="recipes" title="Idée recette" icon="📖" count={recipes.length} color="#A855F7" onPressMore={() => router.push('/(tabs)/meals')}>
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

      case 'leaderboard':
        if (leaderboard.length === 0) return null;
        return (
          <DashboardCard key="leaderboard" title="Classement" icon="🏆" color={primary} onPressMore={() => router.push('/(tabs)/loot')}>
            <FamilyLeaderboard profiles={leaderboard} compact gamiHistory={gamiData?.history} />
          </DashboardCard>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Bonjour{activeProfile ? ` ${activeProfile.name}` : ''} 👋</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleSendRecap}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={isSendingRecap}
          >
            <Text style={styles.headerBtnIcon}>{isSendingRecap ? '⏳' : '📤'}</Text>
            <Text style={styles.headerBtnLabel}>Récap GP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerBtnIcon}>{isLoading ? '⏳' : '🔄'}</Text>
            <Text style={styles.headerBtnLabel}>Actualiser</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPrefsModalVisible(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerBtnIcon}>⚙️</Text>
            <Text style={styles.headerBtnLabel}>Sections</Text>
          </TouchableOpacity>
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
            <Text style={styles.welcomeText}>
              L'application n'est pas encore configurée.
            </Text>
            <Text style={styles.welcomeSubText}>
              Appuyez sur le bouton ci-dessous pour accéder aux réglages et connecter votre espace familial.
            </Text>
            <TouchableOpacity
              style={[styles.welcomeBtn, { backgroundColor: primary }]}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.8}
            >
              <Text style={styles.welcomeBtnText}>⚙️  Ouvrir les réglages</Text>
            </TouchableOpacity>
          </DashboardCard>
        )}

        {profiles.filter((p) => p.statut === 'grossesse' && p.dateTerme).map((p) => {
          const daysLeft = Math.ceil((new Date(p.dateTerme!).getTime() - new Date().getTime()) / 86400000);
          return (
            <View key={p.id} style={[styles.ageUpgradeBanner, { borderColor: primary }]}>
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
                <Text style={styles.ageUpgradeBtnText}>C'est né !</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {ageUpgrades.map((upgrade) => {
          const catLabels: Record<string, string> = { bebe: 'bébé', petit: 'petit enfant', enfant: 'enfant', ado: 'ado' };
          return (
            <View key={upgrade.profileId} style={[styles.ageUpgradeBanner, { borderColor: primary }]}>
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
                  <Text style={styles.ageUpgradeBtnText}>Mettre à jour</Text>
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

        {sectionPrefs.map((s) => s.visible ? renderSection(s.id) : null)}

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
    paddingVertical: 10,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 1,
  },
  headerBtnIcon: {
    fontSize: 22,
  },
  headerBtnLabel: {
    fontSize: 11,
    color: '#C4B5FD',
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
    color: '#F59E0B',
  },
  courseText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  rdvRow: {
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    paddingLeft: 10,
    gap: 2,
  },
  rdvDate: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  rdvTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  rdvMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  rdvEmpty: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#111827',
  },
  stockMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockCartBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stockBtnDisabled: {
    opacity: 0.3,
  },
  stockBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 22,
  },
  stockQty: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    minWidth: 26,
    textAlign: 'center',
  },
  courseCheckBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  courseCheckBtnText: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: '800',
    lineHeight: 18,
  },
  courseEmpty: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  courseAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  courseAddInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
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
    color: '#FFFFFF',
    lineHeight: 26,
  },
  clearCoursesBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  clearCoursesBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  welcomeText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 6,
  },
  welcomeSubText: {
    fontSize: 14,
    color: '#6B7280',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
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
    color: '#111827',
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
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  quickNotifEmoji: { fontSize: 18 },
  quickNotifLabel: { fontSize: 14, fontWeight: '600', color: '#15803D' },
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
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  mealText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
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
    color: '#111827',
  },
  photoStatusHint: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#F3F4F6',
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
  bottomPad: {
    height: 20,
  },
  ageUpgradeBanner: {
    backgroundColor: '#FFFBEB',
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
    color: '#FFFFFF',
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
});
