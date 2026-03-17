/**
 * more.tsx — "Plus" screen with navigation grid
 *
 * Hub for secondary features: RDV, Repas, Stock, Loot, Réglages.
 * Each card navigates to the corresponding hidden tab screen.
 */

import { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { isRdvUpcoming } from '../../lib/parser';
import { totalSpent, totalBudget } from '../../lib/budget';
import { isBabyProfile } from '../../lib/types';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';

interface GridItem {
  emoji: string;
  label: string;
  route: string;
  params?: Record<string, string>;
  badge?: number;
  color: string;
  category: 'quotidien' | 'famille' | 'systeme';
}

export default function MoreScreen() {
  const router = useRouter();
  const gridRef = useRef<View>(null);
  const { rdvs, stock, courses, gamiData, budgetEntries, budgetConfig, activeProfile, profiles, defis, wishlistItems, anniversaries, notes } = useVault();
  const { colors } = useThemeColors();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const items: GridItem[] = useMemo(() => {
    const upcomingRdvs = rdvs.filter((r) => isRdvUpcoming(r)).length;

    const hasBaby = profiles.some(isBabyProfile);
    const lowStock = stock.filter((s) => s.quantite <= s.seuil).length;

    const lootBoxes = gamiData?.profiles
      ? gamiData.profiles.reduce((sum, p) => sum + (p.lootBoxesAvailable ?? 0), 0)
      : 0;

    const activeDefis = defis.filter((d) => d.status === 'active').length;
    const wishlistUnbought = wishlistItems.filter((w) => !w.bought).length;

    // Anniversaires dans les 7 prochains jours
    const upcomingBirthdays = anniversaries.filter((a) => {
      const [mm, dd] = a.date.split('-').map(Number);
      const today = new Date();
      const thisYear = today.getFullYear();
      let next = new Date(thisYear, mm - 1, dd);
      if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        next = new Date(thisYear + 1, mm - 1, dd);
      }
      const diff = next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const days = Math.round(diff / (1000 * 60 * 60 * 24));
      return days <= 7;
    }).length;

    return [
      // Vie quotidienne
      {
        emoji: '🔄',
        label: 'Routines',
        route: '/(tabs)/routines',
        color: colors.info,
        category: 'quotidien' as const,
      },
      {
        emoji: '📅',
        label: 'Rendez-vous',
        route: '/(tabs)/rdv',
        badge: upcomingRdvs || undefined,
        color: colors.info,
        category: 'quotidien' as const,
      },
      {
        emoji: '🍽️',
        label: 'Repas',
        route: '/(tabs)/meals',
        color: colors.success,
        category: 'quotidien' as const,
      },
      {
        emoji: '🛒',
        label: 'Courses',
        route: '/(tabs)/meals',
        params: { tab: 'courses' },
        badge: courses.filter((c) => !c.completed).length || undefined,
        color: colors.success,
        category: 'quotidien' as const,
      },
      {
        emoji: '📦',
        label: 'Stocks & Fournitures',
        route: '/(tabs)/stock',
        badge: lowStock || undefined,
        color: colors.warning,
        category: 'quotidien' as const,
      },
      {
        emoji: '🏥',
        label: 'Santé',
        route: '/(tabs)/health',
        color: colors.error,
        category: 'quotidien' as const,
      },
      ...(hasBaby ? [{
        emoji: '🌙',
        label: 'Mode nuit',
        route: '/(tabs)/night-mode',
        color: '#B8860B', // NightColors.accentBright
        category: 'quotidien' as const,
      }] : []),
      // Famille
      {
        emoji: '🎰',
        label: 'Récompenses',
        route: '/(tabs)/loot',
        badge: lootBoxes || undefined,
        color: '#EC4899',
        category: 'famille' as const,
      },
      {
        emoji: '🏅',
        label: 'Défis',
        route: '/(tabs)/defis',
        badge: activeDefis || undefined,
        color: '#F59E0B',
        category: 'famille' as const,
      },
      {
        emoji: '🙏',
        label: 'Gratitude',
        route: '/(tabs)/gratitude',
        color: '#8B5CF6',
        category: 'famille' as const,
      },
      {
        emoji: '🎁',
        label: 'Souhaits',
        route: '/(tabs)/wishlist',
        badge: wishlistUnbought || undefined,
        color: '#E11D48',
        category: 'famille' as const,
      },
      {
        emoji: '🎂',
        label: 'Anniversaires',
        route: '/(tabs)/anniversaires',
        badge: upcomingBirthdays || undefined,
        color: '#D946EF',
        category: 'famille' as const,
      },
      {
        emoji: '💰',
        label: 'Budget',
        route: '/(tabs)/budget',
        badge: totalSpent(budgetEntries) > totalBudget(budgetConfig) ? 1 : undefined,
        color: '#059669',
        category: 'famille' as const,
      },
      {
        emoji: '📝',
        label: 'Notes',
        route: '/(tabs)/notes',
        badge: notes.length || undefined,
        color: colors.info,
        category: 'famille' as const,
      },
      {
        emoji: '📊',
        label: 'Statistiques',
        route: '/(tabs)/stats',
        color: colors.info,
        category: 'famille' as const,
      },
      // Système
      {
        emoji: '⚙️',
        label: 'Réglages',
        route: '/(tabs)/settings',
        color: colors.textMuted,
        category: 'systeme' as const,
      },
    ];
  }, [rdvs, stock, gamiData, budgetEntries, budgetConfig, colors, profiles, defis, wishlistItems, anniversaries]);

  const visibleItems = isChildMode ? items.filter((i) => i.label !== 'Budget' && i.label !== 'Notes') : items;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View ref={gridRef} style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>Plus</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {(['quotidien', 'famille', 'systeme'] as const).map((cat) => {
          const catItems = visibleItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          const catLabels = { quotidien: 'Vie quotidienne', famille: 'Famille', systeme: 'Système' };
          return (
            <View key={cat}>
              <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>{catLabels[cat]}</Text>
              <View style={styles.grid}>
                {catItems.map((item) => (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.card, { backgroundColor: colors.card }]}
                    onPress={() => item.params ? router.push({ pathname: item.route as any, params: item.params }) : router.push(item.route as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                      <Text style={styles.emoji}>{item.emoji}</Text>
                    </View>
                    <Text style={[styles.cardLabel, { color: colors.textSub }]}>{item.label}</Text>
                    {item.badge ? (
                      <View style={[styles.badgeContainer, { backgroundColor: item.color }]}>
                        <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <ScreenGuide
        screenId="more"
        targets={[
          { ref: gridRef, ...HELP_CONTENT.more[0] },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], paddingBottom: 90 },
  sectionHeader: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xl,
  },
  card: {
    width: '47%',
    borderRadius: 18,
    padding: Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: 'relative',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: FontSize.icon },
  cardLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  badgeContainer: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    minWidth: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  badgeText: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.heavy,
  },
});
