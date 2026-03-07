/**
 * more.tsx — "Plus" screen with navigation grid
 *
 * Hub for secondary features: RDV, Repas, Stock, Loot, Réglages.
 * Each card navigates to the corresponding hidden tab screen.
 */

import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVault } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';
import { isRdvUpcoming } from '../../lib/parser';

interface GridItem {
  emoji: string;
  label: string;
  route: string;
  badge?: number;
  color: string;
}

export default function MoreScreen() {
  const router = useRouter();
  const { rdvs, stock, gamiData } = useVault();
  const { primary } = useThemeColors();

  const items: GridItem[] = useMemo(() => {
    const upcomingRdvs = rdvs.filter((r) => isRdvUpcoming(r)).length;

    const lowStock = stock.filter((s) => s.quantite <= s.seuil).length;

    const lootBoxes = gamiData?.profiles
      ? gamiData.profiles.reduce((sum, p) => sum + (p.lootBoxesAvailable ?? 0), 0)
      : 0;

    return [
      {
        emoji: '📅',
        label: 'Rendez-vous',
        route: '/(tabs)/rdv',
        badge: upcomingRdvs || undefined,
        color: '#8B5CF6',
      },
      {
        emoji: '📦',
        label: 'Stock bébé',
        route: '/(tabs)/stock',
        badge: lowStock || undefined,
        color: '#F59E0B',
      },
      {
        emoji: '🍽️',
        label: 'Repas',
        route: '/(tabs)/meals',
        color: '#10B981',
      },
      {
        emoji: '🎁',
        label: 'Loot Boxes',
        route: '/(tabs)/loot',
        badge: lootBoxes || undefined,
        color: '#EC4899',
      },
      {
        emoji: '⚙️',
        label: 'Réglages',
        route: '/(tabs)/settings',
        color: '#6B7280',
      },
    ];
  }, [rdvs, stock, gamiData]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Plus</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.card}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.cardLabel}>{item.label}</Text>
              {item.badge ? (
                <View style={[styles.badgeContainer, { backgroundColor: item.color }]}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 10,
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
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  badgeContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
