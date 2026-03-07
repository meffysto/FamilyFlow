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

import { useCallback, useState } from 'react';
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
import { buildLeaderboard, processActiveRewards } from '../../lib/gamification';
import {
  dispatchNotification,
  buildManualContext,
} from '../../lib/notifications';
import { buildWeeklyRecapText, sendWeeklyRecap } from '../../lib/telegram';
import { Task, RDV } from '../../lib/types';
import { formatDateForDisplay, isRdvUpcoming } from '../../lib/parser';

export default function DashboardScreen() {
  const router = useRouter();
  const { primary, tint } = useThemeColors();
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
    clearCompletedCourses,
    refresh,
  } = useVault();

  // Active rewards (filtered for non-expired)
  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);

  const { completeTask } = useGamification({ vault, notifPrefs });

  const [refreshing, setRefreshing] = useState(false);
  const [isSendingRecap, setIsSendingRecap] = useState(false);
  const [rdvEditorVisible, setRdvEditorVisible] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);
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
    [toggleTask, activeProfile, completeTask, refresh]
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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

        {/* Ménage du jour */}
        {pendingMenage.length > 0 && (
          <DashboardCard
            title="Ménage du jour"
            icon="🧹"
            count={pendingMenage.length}
            color="#10B981"
            onPressMore={() => router.push('/(tabs)/tasks')}
          >
            {pendingMenage.slice(0, 4).map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} />
            ))}
          </DashboardCard>
        )}

        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <DashboardCard
            title="En retard"
            icon="⚠️"
            count={overdueTasks.length}
            color="#EF4444"
            onPressMore={() => router.push('/(tabs)/tasks')}
          >
            {overdueTasks.slice(0, 3).map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} showSource />
            ))}
          </DashboardCard>
        )}

        {/* Repas du jour */}
        {todayMeals.length > 0 && (
          <DashboardCard
            title="Repas du jour"
            icon="🍽️"
            count={todayMeals.length}
            color="#EC4899"
            onPressMore={() => router.push('/(tabs)/meals')}
          >
            {todayMeals.map((meal) => (
              <View key={meal.id} style={styles.mealRow}>
                <Text style={styles.mealEmoji}>
                  {meal.mealType === 'Petit-déj' ? '🥐' : meal.mealType === 'Déjeuner' ? '🍽️' : '🌙'}
                </Text>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealType}>{meal.mealType}</Text>
                  <Text style={styles.mealText}>{meal.text}</Text>
                </View>
              </View>
            ))}
          </DashboardCard>
        )}

        {/* Photo du jour */}
        {enfants.length > 0 && (
          <DashboardCard
            title="Photo du jour"
            icon="📸"
            color="#06B6D4"
            onPressMore={() => router.push('/(tabs)/photos')}
          >
            {photoStatus.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.photoStatusRow}
                onPress={() => {
                  if (!e.hasPhoto) {
                    pickPhotoForEnfant(e.name);
                  } else {
                    router.push('/(tabs)/photos');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.photoStatusEmoji}>{e.avatar}</Text>
                <View style={styles.photoStatusInfo}>
                  <Text style={styles.photoStatusName}>{e.name}</Text>
                  {!e.hasPhoto && (
                    <Text style={styles.photoStatusHint}>Appuyer pour ajouter une photo</Text>
                  )}
                </View>
                <Text style={styles.photoStatusIcon}>
                  {e.hasPhoto ? '✅' : '📷'}
                </Text>
              </TouchableOpacity>
            ))}
          </DashboardCard>
        )}

        {/* Courses */}
        {topCourses.length > 0 && (
          <DashboardCard
            title="Courses"
            icon="🛒"
            count={topCourses.length}
            color="#F59E0B"
            onPressMore={() => router.push('/(tabs)/tasks')}
          >
            {topCourses.map((item) => (
              <View key={item.id} style={styles.courseRow}>
                <Text style={styles.courseBullet}>•</Text>
                <Text style={styles.courseText}>{item.text}</Text>
              </View>
            ))}
            {courses.some((c) => c.completed) && (
              <TouchableOpacity
                style={styles.clearCoursesBtn}
                onPress={() => {
                  const count = courses.filter((c) => c.completed).length;
                  Alert.alert(
                    'Vider les cochés',
                    `Supprimer ${count} article${count > 1 ? 's' : ''} coché${count > 1 ? 's' : ''} ?`,
                    [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: clearCompletedCourses },
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.clearCoursesBtnText}>🗑 Vider les cochés</Text>
              </TouchableOpacity>
            )}
          </DashboardCard>
        )}

        {/* RDVs */}
        <DashboardCard title="Rendez-vous" icon="📅" count={upcomingRdvs.length || undefined} color="#8B5CF6">
          {upcomingRdvs.slice(0, 3).map((rdv) => (
            <TouchableOpacity
              key={rdv.sourceFile}
              style={styles.rdvRow}
              onPress={() => {
                setEditingRDV(rdv);
                setRdvEditorVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.rdvDate}>
                {formatDateForDisplay(rdv.date_rdv)} {rdv.heure ? `à ${rdv.heure}` : ''}
              </Text>
              <Text style={styles.rdvTitle}>
                {rdv.type_rdv} — {rdv.enfant}
              </Text>
              {rdv.médecin && <Text style={styles.rdvMeta}>{rdv.médecin}</Text>}
            </TouchableOpacity>
          ))}
          {upcomingRdvs.length === 0 && (
            <Text style={styles.rdvEmpty}>Aucun RDV à venir</Text>
          )}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.rdvAddBtn, { backgroundColor: tint, borderColor: primary }]}
              onPress={() => {
                setEditingRDV(undefined);
                setRdvEditorVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.rdvAddBtnText, { color: primary }]}>+ Nouveau</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/rdv')}
              activeOpacity={0.7}
            >
              <Text style={[styles.seeAllText, { color: primary }]}>Voir tout →</Text>
            </TouchableOpacity>
          </View>
        </DashboardCard>

        {/* Active rewards */}
        {activeRewards.length > 0 && (
          <DashboardCard title="Récompenses actives" icon="🏆" color="#EF4444">
            {activeRewards.map((reward) => {
              const ownerProfile = profiles.find((p) => p.id === reward.profileId);
              const typeColor = reward.type === 'vacation' || reward.type === 'crown' || reward.type === 'multiplier'
                ? '#EF4444'
                : '#F59E0B';
              return (
                <View key={reward.id} style={styles.activeRewardRow}>
                  <Text style={styles.activeRewardEmoji}>{reward.emoji}</Text>
                  <View style={styles.activeRewardInfo}>
                    <Text style={styles.activeRewardLabel}>
                      {ownerProfile?.avatar ?? '👤'} {ownerProfile?.name ?? reward.profileId} — {reward.label}
                    </Text>
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
        )}

        {/* Stock bébé */}
        {stock.length > 0 && (() => {
          const lowCount = stock.filter((s) => s.quantite <= s.seuil).length;
          return (
            <DashboardCard
              title="Stock bébé"
              icon="📦"
              count={lowCount > 0 ? lowCount : undefined}
              color={lowCount > 0 ? '#EF4444' : '#10B981'}
            >
              {stock.filter((s) => s.quantite <= s.seuil + 1).map((item) => {
                const isLow = item.quantite <= item.seuil;
                const statusColor = isLow ? '#EF4444' : '#F59E0B';
                return (
                  <View key={`${item.section}-${item.produit}`} style={styles.stockRow}>
                    <Text style={styles.stockAlertIcon}>
                      {isLow ? '🔴' : '🟡'}
                    </Text>
                    <View style={styles.stockInfo}>
                      <Text style={styles.stockName}>
                        {item.produit}{item.detail ? ` (${item.detail})` : ''}
                      </Text>
                      <Text style={[styles.stockMeta, { color: statusColor }]}>
                        {item.quantite} restant{item.quantite > 1 ? 's' : ''} (seuil: {item.seuil})
                      </Text>
                    </View>
                    <View style={styles.stockBtnGroup}>
                      {isLow && (
                        <TouchableOpacity
                          style={styles.stockCartBtn}
                          onPress={async () => {
                            const itemName = item.detail
                              ? `${item.produit} (${item.detail})`
                              : item.produit;
                            await addCourseItem(itemName, 'Produits bébé');
                            Alert.alert('Ajouté !', `${itemName} ajouté aux courses`);
                          }}
                          activeOpacity={0.6}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                          <Text style={styles.stockCartBtnText}>🛒</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.stockBtn, item.quantite <= 0 && styles.stockBtnDisabled]}
                        onPress={() => updateStockQuantity(item.lineIndex, Math.max(0, item.quantite - 1))}
                        activeOpacity={0.6}
                        disabled={item.quantite <= 0}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Text style={styles.stockBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stockQty}>{item.quantite}</Text>
                      <TouchableOpacity
                        style={styles.stockBtn}
                        onPress={() => updateStockQuantity(item.lineIndex, item.quantite + 1)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Text style={styles.stockBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.seeAllLink}
                onPress={() => router.push('/(tabs)/stock')}
                activeOpacity={0.7}
              >
                <Text style={[styles.seeAllText, { color: primary }]}>Gérer le stock →</Text>
              </TouchableOpacity>
            </DashboardCard>
          );
        })()}

        {/* Custom notification quick-send */}
        {customNotifs.length > 0 && (
          <DashboardCard title="Notifications rapides" icon="📤" color="#10B981">
            <View style={styles.quickNotifGrid}>
              {customNotifs.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={styles.quickNotifBtn}
                  onPress={() => handleSendCustomNotif(notif.id)}
                >
                  <Text style={styles.quickNotifEmoji}>{notif.emoji}</Text>
                  <Text style={styles.quickNotifLabel}>{notif.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </DashboardCard>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <DashboardCard
            title="Classement"
            icon="🏆"
            color={primary}
            onPressMore={() => router.push('/(tabs)/loot')}
          >
            <FamilyLeaderboard profiles={leaderboard} compact />
          </DashboardCard>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
      {/* RDV Editor Modal */}
      <Modal visible={rdvEditorVisible} animationType="slide" presentationStyle="pageSheet">
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
    </SafeAreaView>
  );
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 15,
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
    fontSize: 18,
  },
  headerBtnLabel: {
    fontSize: 9,
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
    fontSize: 14,
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
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  rdvTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  rdvMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  rdvEmpty: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  rdvAddBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  rdvAddBtnText: {
    fontSize: 14,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  stockMeta: {
    fontSize: 11,
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
    width: 36,
    height: 36,
    borderRadius: 8,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 20,
  },
  stockQty: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  clearCoursesBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  clearCoursesBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  welcomeText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 6,
  },
  welcomeSubText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
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
    borderBottomColor: '#F3F4F6',
  },
  activeRewardEmoji: {
    fontSize: 28,
  },
  activeRewardInfo: {
    flex: 1,
    gap: 2,
  },
  activeRewardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  activeRewardMeta: {
    fontSize: 12,
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
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  quickNotifEmoji: { fontSize: 16 },
  quickNotifLabel: { fontSize: 13, fontWeight: '600', color: '#15803D' },
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
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  mealText: {
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  photoStatusHint: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  photoStatusIcon: {
    fontSize: 16,
  },
  bottomPad: {
    height: 20,
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
    fontSize: 13,
    fontWeight: '700',
  },
});
