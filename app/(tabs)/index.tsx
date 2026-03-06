/**
 * index.tsx — Dashboard screen
 *
 * Shows:
 * - Today's date + refresh button
 * - Today's ménage tasks (by day of week)
 * - Overdue tasks
 * - Top 5 shopping items
 * - Upcoming RDVs (7 days)
 * - Loot box progress per profile
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../hooks/useVault';
import { useGamification } from '../../hooks/useGamification';
import { DashboardCard } from '../../components/DashboardCard';
import { TaskCard } from '../../components/TaskCard';
import { FamilyLeaderboard } from '../../components/FamilyLeaderboard';
import { buildLeaderboard, processActiveRewards } from '../../lib/gamification';
import {
  dispatchNotification,
  buildManualContext,
} from '../../lib/notifications';
import { LOOT_THRESHOLD, RARITY_COLORS } from '../../constants/rewards';
import { Task } from '../../lib/types';

export default function DashboardScreen() {
  const router = useRouter();
  const {
    isLoading,
    error,
    vaultPath,
    menageTasks,
    courses,
    meals,
    rdvs,
    profiles,
    activeProfile,
    gamiData,
    notifPrefs,
    vault,
    tasks,
    refresh,
  } = useVault();

  // Active rewards (filtered for non-expired)
  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);

  const { completeTask } = useGamification({ vault, notifPrefs });

  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {/* Welcome card when no vault configured */}
        {!isLoading && !vaultPath && (
          <DashboardCard title="Bienvenue" icon="👋" color="#7C3AED">
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
        {upcomingRdvs.length > 0 && (
          <DashboardCard title="Prochains RDV" icon="📅" count={upcomingRdvs.length} color="#8B5CF6">
            {upcomingRdvs.map((rdv) => (
              <View key={rdv.sourceFile} style={styles.rdvRow}>
                <Text style={styles.rdvDate}>
                  {rdv.date_rdv} {rdv.heure ? `à ${rdv.heure}` : ''}
                </Text>
                <Text style={styles.rdvTitle}>
                  {rdv.type_rdv} — {rdv.enfant}
                </Text>
                {rdv.médecin && <Text style={styles.rdvMeta}>{rdv.médecin}</Text>}
              </View>
            ))}
          </DashboardCard>
        )}

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

        {/* Loot box progress */}
        {profiles.length > 0 && (
          <DashboardCard title="Progression Loot" icon="🎁" color="#F59E0B">
            {profiles.map((profile) => {
              const threshold = LOOT_THRESHOLD[profile.role];
              const current = profile.points % threshold;
              const progress = current / threshold;
              return (
                <View key={profile.id} style={styles.lootProgressRow}>
                  <Text style={styles.lootAvatar}>{profile.avatar}</Text>
                  <View style={styles.lootInfo}>
                    <View style={styles.lootNameRow}>
                      <Text style={styles.lootName}>{profile.name}</Text>
                      {profile.lootBoxesAvailable > 0 && (
                        <TouchableOpacity onPress={() => router.push('/(tabs)/loot')}>
                          <Text style={styles.lootReady}>
                            🎁 ×{profile.lootBoxesAvailable} OUVRIR →
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]}
                      />
                    </View>
                    <Text style={styles.lootProgressText}>
                      {current}/{threshold} pts
                    </Text>
                  </View>
                </View>
              );
            })}
          </DashboardCard>
        )}

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
            color="#7C3AED"
            onPressMore={() => router.push('/(tabs)/loot')}
          >
            <FamilyLeaderboard profiles={leaderboard} compact />
          </DashboardCard>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
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
    backgroundColor: '#7C3AED',
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
  lootProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  lootAvatar: {
    fontSize: 28,
  },
  lootInfo: {
    flex: 1,
    gap: 4,
  },
  lootNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lootName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  lootReady: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  lootProgressText: {
    fontSize: 11,
    color: '#9CA3AF',
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
  bottomPad: {
    height: 20,
  },
});
