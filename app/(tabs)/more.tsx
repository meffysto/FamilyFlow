/**
 * more.tsx — Menu "Plus" avec toggle liste groupée / grille
 *
 * Hub pour les features secondaires, organisé en sections.
 * L'utilisateur peut basculer entre vue liste (iOS Settings) et vue grille (cartes).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { isRdvUpcoming } from '../../lib/parser';
import { totalSpent, totalBudget } from '../../lib/budget';
import { isBabyProfile } from '../../lib/types';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';

const VIEW_PREF_KEY = 'more_view_mode';
type ViewMode = 'list' | 'grid';

interface MenuItem {
  emoji: string;
  label: string;
  route: string;
  params?: Record<string, string>;
  badge?: number;
  color: string;
  category: 'quotidien' | 'famille' | 'systeme';
}

const CATEGORY_LABELS = {
  quotidien: 'Vie quotidienne',
  famille: 'Famille',
  systeme: 'Système',
} as const;

export default function MoreScreen() {
  const router = useRouter();
  const headerRef = useRef<View>(null);
  const { rdvs, stock, courses, gamiData, budgetEntries, budgetConfig, activeProfile, profiles, defis, wishlistItems, anniversaries, notes } = useVault();
  const { primary, colors } = useThemeColors();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  // Préférence vue liste/grille persistée
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  useEffect(() => {
    SecureStore.getItemAsync(VIEW_PREF_KEY).then((v) => {
      if (v === 'grid' || v === 'list') setViewMode(v);
    });
  }, []);
  const toggleView = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'list' ? 'grid' : 'list';
      SecureStore.setItemAsync(VIEW_PREF_KEY, next);
      return next;
    });
  }, []);

  const items: MenuItem[] = useMemo(() => {
    const upcomingRdvs = rdvs.filter((r) => isRdvUpcoming(r)).length;
    const hasBaby = profiles.some(isBabyProfile);
    const lowStock = stock.filter((s) => s.quantite <= s.seuil).length;
    const lootBoxes = gamiData?.profiles
      ? gamiData.profiles.reduce((sum, p) => sum + (p.lootBoxesAvailable ?? 0), 0)
      : 0;
    const activeDefis = defis.filter((d) => d.status === 'active').length;
    const wishlistUnbought = wishlistItems.filter((w) => !w.bought).length;

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
      { emoji: '📸', label: 'Photos', route: '/(tabs)/photos', color: colors.accentPink, category: 'quotidien' as const },
      { emoji: '🔄', label: 'Routines', route: '/(tabs)/routines', color: colors.info, category: 'quotidien' as const },
      { emoji: '📅', label: 'Rendez-vous', route: '/(tabs)/rdv', badge: upcomingRdvs || undefined, color: colors.info, category: 'quotidien' as const },
      { emoji: '🍽️', label: 'Repas', route: '/(tabs)/meals', color: colors.success, category: 'quotidien' as const },
      { emoji: '🛒', label: 'Courses', route: '/(tabs)/meals', params: { tab: 'courses' }, badge: courses.filter((c) => !c.completed).length || undefined, color: colors.success, category: 'quotidien' as const },
      { emoji: '📦', label: 'Stocks & Fournitures', route: '/(tabs)/stock', badge: lowStock || undefined, color: colors.warning, category: 'quotidien' as const },
      { emoji: '🏥', label: 'Santé', route: '/(tabs)/health', color: colors.error, category: 'quotidien' as const },
      ...(hasBaby ? [{ emoji: '🌙', label: 'Mode nuit', route: '/(tabs)/night-mode', color: '#B8860B', category: 'quotidien' as const }] : []),
      ...(profiles.some(p => p.statut === 'grossesse') ? [{ emoji: '🤰', label: 'Grossesse', route: '/(tabs)/pregnancy' as const, color: '#EC4899', category: 'quotidien' as const }] : []),
      // Famille
      { emoji: '🌳', label: 'Compétences', route: '/(tabs)/skills', color: '#10B981', category: 'famille' as const },
      { emoji: '🎰', label: 'Récompenses', route: '/(tabs)/loot', badge: lootBoxes || undefined, color: '#EC4899', category: 'famille' as const },
      { emoji: '🏅', label: 'Défis', route: '/(tabs)/defis', badge: activeDefis || undefined, color: '#F59E0B', category: 'famille' as const },
      { emoji: '💬', label: 'Mots d\'enfants', route: '/(tabs)/quotes', color: '#06B6D4', category: 'famille' as const },
      { emoji: '🌤️', label: 'Humeurs', route: '/(tabs)/moods', color: '#F59E0B', category: 'famille' as const },
      { emoji: '🙏', label: 'Gratitude', route: '/(tabs)/gratitude', color: '#8B5CF6', category: 'famille' as const },
      { emoji: '🎁', label: 'Souhaits', route: '/(tabs)/wishlist', badge: wishlistUnbought || undefined, color: '#E11D48', category: 'famille' as const },
      { emoji: '🎂', label: 'Anniversaires', route: '/(tabs)/anniversaires', badge: upcomingBirthdays || undefined, color: '#D946EF', category: 'famille' as const },
      { emoji: '💰', label: 'Budget', route: '/(tabs)/budget', badge: totalSpent(budgetEntries) > totalBudget(budgetConfig) ? 1 : undefined, color: '#059669', category: 'famille' as const },
      { emoji: '📝', label: 'Notes', route: '/(tabs)/notes', badge: notes.length || undefined, color: colors.info, category: 'famille' as const },
      { emoji: '📊', label: 'Statistiques', route: '/(tabs)/stats', color: colors.info, category: 'famille' as const },
      // Système
      { emoji: '⚙️', label: 'Réglages', route: '/(tabs)/settings', color: colors.textMuted, category: 'systeme' as const },
    ];
  }, [rdvs, stock, gamiData, budgetEntries, budgetConfig, colors, profiles, defis, wishlistItems, anniversaries]);

  const visibleItems = isChildMode ? items.filter((i) => i.label !== 'Budget' && i.label !== 'Notes') : items;

  const onItemPress = useCallback((item: MenuItem) => {
    if (item.params) {
      router.push({ pathname: item.route as any, params: item.params });
    } else {
      router.push(item.route as any);
    }
  }, [router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View ref={headerRef} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Plus</Text>
        <TouchableOpacity
          style={[styles.viewToggle, { backgroundColor: colors.card }]}
          onPress={toggleView}
          activeOpacity={0.7}
          accessibilityLabel={viewMode === 'list' ? 'Passer en vue grille' : 'Passer en vue liste'}
          accessibilityRole="button"
        >
          <Text style={[
            styles.viewToggleIcon,
            { color: viewMode === 'list' ? primary : colors.textFaint },
          ]}>☰</Text>
          <View style={[styles.viewToggleSep, { backgroundColor: colors.border }]} />
          <Text style={[
            styles.viewToggleIcon,
            { color: viewMode === 'grid' ? primary : colors.textFaint },
          ]}>⊞</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {(['quotidien', 'famille', 'systeme'] as const).map((cat) => {
          const catItems = visibleItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <View key={cat} style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
                {CATEGORY_LABELS[cat]}
              </Text>

              {viewMode === 'list' ? (
                /* ── Vue liste groupée (iOS Settings) ── */
                <View style={[styles.group, { backgroundColor: colors.card }]}>
                  {catItems.map((item, index) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.row,
                        index < catItems.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                      ]}
                      onPress={() => onItemPress(item)}
                      activeOpacity={0.6}
                      accessibilityLabel={`${item.label}${item.badge ? `, ${item.badge} élément${item.badge > 1 ? 's' : ''}` : ''}`}
                      accessibilityRole="button"
                      accessibilityHint={`Ouvrir ${item.label}`}
                    >
                      <View style={[styles.listIcon, { backgroundColor: item.color + '18' }]}>
                        <Text style={styles.listEmoji}>{item.emoji}</Text>
                      </View>
                      <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <View style={styles.rowRight}>
                        {item.badge ? (
                          <View style={[styles.badge, { backgroundColor: item.color }]}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                        <Text style={[styles.chevron, { color: colors.textFaint }]}>›</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                /* ── Vue grille (cartes) ── */
                <View style={styles.grid}>
                  {catItems.map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.card, { backgroundColor: colors.card }]}
                      onPress={() => onItemPress(item)}
                      activeOpacity={0.7}
                      accessibilityLabel={`${item.label}${item.badge ? `, ${item.badge} élément${item.badge > 1 ? 's' : ''}` : ''}`}
                      accessibilityRole="button"
                      accessibilityHint={`Ouvrir ${item.label}`}
                    >
                      <View style={[styles.gridIcon, { backgroundColor: item.color + '20' }]}>
                        <Text style={styles.gridEmoji}>{item.emoji}</Text>
                      </View>
                      <Text style={[styles.cardLabel, { color: colors.textSub }]}>{item.label}</Text>
                      {item.badge ? (
                        <View style={[styles.cardBadge, { backgroundColor: item.color }]}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <ScreenGuide
        screenId="more"
        targets={[
          { ref: headerRef, ...HELP_CONTENT.more[0] },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  viewToggleIcon: {
    fontSize: FontSize.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  viewToggleSep: {
    width: StyleSheet.hairlineWidth,
    height: 18,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  section: {
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  // ── Liste ──
  group: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  listEmoji: { fontSize: FontSize.body },
  rowLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chevron: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.normal,
    marginLeft: Spacing.xs,
  },
  // ── Grille ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    width: '47%',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
    position: 'relative',
  },
  gridIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridEmoji: { fontSize: FontSize.icon },
  cardLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    minWidth: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  // ── Commun ──
  badge: {
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
    color: '#fff',
  },
});
