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
import { Task, RDV } from '../../lib/types';

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
    updateStockQuantity,
    addRDV,
    updateRDV,
    deleteRDV,
    refresh,
  } = useVault();

  // Active rewards (filtered for non-expired)
  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);

  const { completeTask } = useGamification({ vault, notifPrefs });

  const [refreshing, setRefreshing] = useState(false);
  const [rdvEditorVisible, setRdvEditorVisible] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);

  const today = format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr });
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const in7Days = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleTaskToggle = useCallback(
    async (task: Task, completed: boolean) => {
      if (!vault) return;
      try {
        await vault.toggleTask(task.sourceFile, task.lineIndex, completed);
        if (completed && activeProfile) {
          const { lootAwarded, pointsGained } = await completeTask(activeProfile, task.text);
          if (lootAwarded) {
            Alert.alert('🎁 Loot Box !', `+${pointsGained} points ! Tu as gagné une loot box !`);
          }
        }
        await refresh();
      } catch (e) {
        Alert.alert('Erreur', `Impossible de modifier la tâche : ${e}`);
      }
    },
    [vault, activeProfile, completeTask, refresh]
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
        Alert.alert('Erreur', 'Impossible d\'envoyer. Vérifiez la configuration Telegram.');
      }
    },
    [activeProfile, notifPrefs]
  );

  const pickPhotoForEnfant = useCallback(
    async (enfantName: string) => {
      const launchPicker = async (useCamera: boolean) => {
        if (useCamera) {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission requise', "L'accès à la caméra est nécessaire.");
            return;
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission requise', "L'accès à la galerie est nécessaire.");
            return;
          }
        }

        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1] as [number, number],
        };

        const result = useCamera
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

        if (!result.canceled && result.assets?.[0]) {
          try {
            await addPhoto(enfantName, todayStr, result.assets[0].uri);
            await refresh();
          } catch (e) {
            Alert.alert('Erreur', String(e));
          }
        }
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Annuler', '📷 Appareil photo', '🖼 Galerie'],
            cancelButtonIndex: 0,
          },
          async (buttonIndex) => {
            if (buttonIndex === 1) await launchPicker(true);
            if (buttonIndex === 2) await launchPicker(false);
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
    [addPhoto, todayStr, refresh]
  );

  // Overdue tasks
  const overdueTasks = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate < todayStr
  );

  // Upcoming RDVs (7 days)
  const upcomingRdvs = rdvs.filter(
    (r) => r.statut === 'planifié' && r.date_rdv >= todayStr && r.date_rdv <= in7Days
  );

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
        <View>
          <Text style={styles.greeting}>Bonjour 👋</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={styles.refreshBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.refreshIcon}>{isLoading ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
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
          <DashboardCard title="Bienvenue" icon="👋" color={primary}>
            <Text style={styles.debugText}>Aucun vault configuré. Allez dans Réglages pour connecter votre coffre Obsidian.</Text>
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
                <Text style={styles.photoStatusName}>{e.name}</Text>
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
          </DashboardCard>
        )}

        {/* RDVs */}
        <DashboardCard title="Prochains RDV" icon="📅" count={upcomingRdvs.length || undefined} color="#8B5CF6">
          {upcomingRdvs.map((rdv) => (
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
                {rdv.date_rdv} {rdv.heure ? `à ${rdv.heure}` : ''}
              </Text>
              <Text style={styles.rdvTitle}>
                {rdv.type_rdv} — {rdv.enfant}
              </Text>
              {rdv.médecin && <Text style={styles.rdvMeta}>{rdv.médecin}</Text>}
            </TouchableOpacity>
          ))}
          {upcomingRdvs.length === 0 && (
            <Text style={styles.rdvEmpty}>Aucun RDV dans les 7 prochains jours</Text>
          )}
          <TouchableOpacity
            style={[styles.rdvAddBtn, { backgroundColor: tint, borderColor: primary }]}
            onPress={() => {
              setEditingRDV(undefined);
              setRdvEditorVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.rdvAddBtnText, { color: primary }]}>+ Nouveau RDV</Text>
          </TouchableOpacity>
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
              {stock.map((item) => {
                const isLow = item.quantite <= item.seuil;
                const isWarn = !isLow && item.quantite <= item.seuil + 1;
                const statusColor = isLow ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';
                return (
                  <View key={`${item.section}-${item.produit}`} style={styles.stockRow}>
                    <Text style={styles.stockAlertIcon}>
                      {isLow ? '🔴' : isWarn ? '🟡' : '🟢'}
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
                      <TouchableOpacity
                        style={styles.stockBtn}
                        onPress={() => updateStockQuantity(item.lineIndex, item.quantite - 1)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.stockBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stockQty}>{item.quantite}</Text>
                      <TouchableOpacity
                        style={styles.stockBtn}
                        onPress={() => updateStockQuantity(item.lineIndex, item.quantite + 1)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.stockBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 22,
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
  stockBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  debugText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  debugError: {
    fontSize: 11,
    color: '#EF4444',
    fontFamily: 'monospace',
    lineHeight: 16,
    marginTop: 6,
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
  photoStatusName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  photoStatusIcon: {
    fontSize: 16,
  },
  bottomPad: {
    height: 20,
  },
});
