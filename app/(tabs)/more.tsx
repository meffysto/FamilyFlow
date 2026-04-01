/**
 * more.tsx — Menu "Plus" premium avec toggle liste / grille
 *
 * Design chaleureux harmonisé avec l'écran Aujourd'hui :
 * gradients doux par section, glassmorphism, rows individuels
 * avec relief, PressableScale + haptic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { PressableScale } from '../../components/ui';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { isRdvUpcoming } from '../../lib/parser';
import { totalSpent, totalBudget } from '../../lib/budget';
import { isBabyProfile } from '../../lib/types';
import { useTranslation } from 'react-i18next';
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
  category: 'organisation' | 'sante' | 'souvenirs' | 'jeux' | 'famille' | 'systeme';
}

const CATEGORY_LABEL_KEYS = {
  organisation: 'menu.categories.organisation',
  sante: 'menu.categories.health',
  souvenirs: 'menu.categories.memories',
  jeux: 'menu.categories.games',
  famille: 'menu.categories.family',
  systeme: 'menu.categories.system',
} as const;

const CATEGORY_EMOJIS = {
  organisation: '📋',
  sante: '💜',
  souvenirs: '✨',
  jeux: '🎮',
  famille: '👨‍👩‍👧‍👦',
  systeme: '⚙️',
} as const;

type CategoryKey = keyof typeof CATEGORY_LABEL_KEYS;

const CATEGORY_ACCENT_KEYS: Record<CategoryKey, 'catOrganisation' | 'catSante' | 'catSouvenirs' | 'catJeux' | 'catFamille' | 'catSysteme'> = {
  organisation: 'catOrganisation',
  sante: 'catSante',
  souvenirs: 'catSouvenirs',
  jeux: 'catJeux',
  famille: 'catFamille',
  systeme: 'catSysteme',
};

export default function MoreScreen() {
  const router = useRouter();
  const headerRef = useRef<View>(null);
  const { rdvs, stock, courses, gamiData, budgetEntries, budgetConfig, activeProfile, profiles, defis, wishlistItems, anniversaries, notes } = useVault();
  const { primary, colors, isDark } = useThemeColors();
  const { t } = useTranslation();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

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
    const lowStock = stock.filter((s) => s.tracked !== false && s.seuil > 0 && s.quantite <= s.seuil).length;
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
      // Organisation — teal
      { emoji: '🔄', label: t('menu.items.routines'), route: '/(tabs)/routines', color: colors.catOrganisation, category: 'organisation' as const },
      { emoji: '📅', label: t('menu.items.appointments'), route: '/(tabs)/rdv', badge: upcomingRdvs || undefined, color: colors.catOrganisation, category: 'organisation' as const },
      { emoji: '🍽️', label: t('menu.items.meals'), route: '/(tabs)/meals', color: colors.catOrganisation, category: 'organisation' as const },
      { emoji: '📖', label: t('menu.items.recipes'), route: '/(tabs)/meals', params: { tab: 'recettes' }, color: colors.catOrganisation, category: 'organisation' as const },
      { emoji: '🛒', label: t('menu.items.shopping'), route: '/(tabs)/meals', params: { tab: 'courses' }, badge: courses.filter((c) => !c.completed).length || undefined, color: colors.catOrganisation, category: 'organisation' as const },
      { emoji: '📦', label: t('menu.items.stock'), route: '/(tabs)/stock', badge: lowStock || undefined, color: colors.catOrganisation, category: 'organisation' as const },
      // Santé & Bien-être — violet
      { emoji: '🏥', label: t('menu.items.health'), route: '/(tabs)/health', color: colors.catSante, category: 'sante' as const },
      { emoji: '🌤️', label: t('menu.items.moods'), route: '/(tabs)/moods', color: colors.catSante, category: 'sante' as const },
      ...(hasBaby ? [{ emoji: '🌙', label: t('menu.items.nightMode'), route: '/(tabs)/night-mode', color: colors.catSante, category: 'sante' as const }] : []),
      ...(profiles.some(p => p.statut === 'grossesse') ? [{ emoji: '🤰', label: t('menu.items.pregnancy'), route: '/(tabs)/pregnancy' as const, color: colors.catSante, category: 'sante' as const }] : []),
      // Souvenirs & Émotions — orange doré
      { emoji: '📸', label: t('menu.items.photos'), route: '/(tabs)/photos', color: colors.catSouvenirs, category: 'souvenirs' as const },
      { emoji: '💬', label: t('menu.items.quotes'), route: '/(tabs)/quotes', color: colors.catSouvenirs, category: 'souvenirs' as const },
      { emoji: '🙏', label: t('menu.items.gratitude'), route: '/(tabs)/gratitude', color: colors.catSouvenirs, category: 'souvenirs' as const },
      // Jeux & Progrès — vert
      { emoji: '🌱', label: t('menu.items.skills'), route: '/(tabs)/skills', color: colors.catJeux, category: 'jeux' as const },
      { emoji: '🌳', label: t('menu.items.tree'), route: '/(tabs)/tree' as any, color: colors.catJeux, category: 'jeux' as const },
      { emoji: '🎰', label: t('menu.items.rewards'), route: '/(tabs)/loot', badge: lootBoxes || undefined, color: colors.catJeux, category: 'jeux' as const },
      { emoji: '🏅', label: t('menu.items.challenges'), route: '/(tabs)/defis', badge: activeDefis || undefined, color: colors.catJeux, category: 'jeux' as const },
      // Vie de famille — rose
      { emoji: '🎂', label: t('menu.items.birthdays'), route: '/(tabs)/anniversaires', badge: upcomingBirthdays || undefined, color: colors.catFamille, category: 'famille' as const },
      { emoji: '🎁', label: t('menu.items.wishlist'), route: '/(tabs)/wishlist', badge: wishlistUnbought || undefined, color: colors.catFamille, category: 'famille' as const },
      { emoji: '💰', label: t('menu.items.budget'), route: '/(tabs)/budget', badge: totalSpent(budgetEntries) > totalBudget(budgetConfig) ? 1 : undefined, color: colors.catFamille, category: 'famille' as const },
      { emoji: '📝', label: t('menu.items.notes'), route: '/(tabs)/notes', badge: notes.length || undefined, color: colors.catFamille, category: 'famille' as const },
      { emoji: '📊', label: t('menu.items.stats'), route: '/(tabs)/stats', color: colors.catFamille, category: 'famille' as const },
      // Système — gris
      { emoji: '⚙️', label: t('menu.items.settings'), route: '/(tabs)/settings', color: colors.catSysteme, category: 'systeme' as const },
    ];
  }, [rdvs, stock, gamiData, budgetEntries, budgetConfig, colors, profiles, defis, wishlistItems, anniversaries, t]);

  const visibleItems = isChildMode ? items.filter((i) => i.route !== '/(tabs)/budget' && i.route !== '/(tabs)/notes') : items;

  const onItemPress = useCallback((item: MenuItem) => {
    if (item.params) {
      router.push({ pathname: item.route as any, params: item.params });
    } else {
      router.push(item.route as any);
    }
  }, [router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ── Header ── */}
      <View ref={headerRef} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Menu</Text>
        <PressableScale
          onPress={toggleView}
          style={[styles.viewToggle, {
            backgroundColor: colors.card,
            borderColor: colors.border,
          }]}
          scaleValue={0.93}
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
        </PressableScale>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        showsVerticalScrollIndicator={false}
      >
        {(['organisation', 'sante', 'souvenirs', 'jeux', 'famille', 'systeme'] as const).map((cat) => {
          const catItems = visibleItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          const accentColor = colors[CATEGORY_ACCENT_KEYS[cat]];

          return (
            <View key={cat} style={styles.section}>
              {/* ── Section header simple ── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>{CATEGORY_EMOJIS[cat]}</Text>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  {t(CATEGORY_LABEL_KEYS[cat])}
                </Text>
              </View>

              {viewMode === 'list' ? (
                /* ── Vue liste : rows individuels avec relief ── */
                <View style={styles.listContainer}>
                  {catItems.map((item) => (
                    <PressableScale
                      key={item.label}
                      onPress={() => onItemPress(item)}
                      scaleValue={0.97}
                    >
                      <View
                        style={[styles.row, {
                          backgroundColor: colors.card,
                          borderColor: accentColor + (isDark ? '20' : '18'),
                        }]}
                        accessibilityLabel={`${item.label}${item.badge ? `, ${item.badge} élément${item.badge > 1 ? 's' : ''}` : ''}`}
                        accessibilityRole="button"
                      >
                        {/* Fond teinté catégorie (comme DashboardCard tinted) */}
                        <View style={[StyleSheet.absoluteFill, {
                          backgroundColor: accentColor + (isDark ? '1A' : '0F'),
                          borderRadius: Radius.xl,
                        }]} />

                        {/* Icône avec teinte plus saturée */}
                        <View style={[styles.listIcon, { backgroundColor: accentColor + (isDark ? '25' : '1A') }]}>
                          <Text style={styles.listEmoji}>{item.emoji}</Text>
                        </View>

                        {/* Label */}
                        <View style={styles.labelContainer}>
                          <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                            {item.label}
                          </Text>
                        </View>

                        {/* Badge + chevron */}
                        <View style={styles.rowRight}>
                          {item.badge ? (
                            <View style={[styles.badge, { backgroundColor: accentColor }]}>
                              <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                          ) : null}
                          <Text style={[styles.chevron, { color: colors.textFaint }]}>›</Text>
                        </View>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              ) : (
                /* ── Vue grille ── */
                <View style={styles.grid}>
                  {catItems.map((item) => (
                    <PressableScale
                      key={item.label}
                      onPress={() => onItemPress(item)}
                      scaleValue={0.95}
                      style={styles.gridPressable}
                    >
                      <View
                        style={[styles.gridCard, {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        }]}
                        accessibilityLabel={`${item.label}${item.badge ? `, ${item.badge} élément${item.badge > 1 ? 's' : ''}` : ''}`}
                        accessibilityRole="button"
                      >
                        <View style={[styles.gridIcon, { backgroundColor: accentColor + '15' }]}>
                          <Text style={styles.gridEmoji}>{item.emoji}</Text>
                        </View>
                        <Text style={[styles.gridLabel, { color: colors.textSub }]}>{item.label}</Text>
                        {item.badge ? (
                          <View style={[styles.gridBadge, { backgroundColor: accentColor }]}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                    </PressableScale>
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

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  title: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadows.xs,
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

  // ── Scroll ──
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: 120,
  },

  // ── Section ──
  section: {
    marginTop: Spacing['3xl'],
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  sectionEmoji: {
    fontSize: FontSize.body,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Vue liste : rows individuels ──
  listContainer: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
    overflow: 'hidden',
    ...Shadows.md,
  },
  listIcon: {
    width: 50,
    height: 50,
    borderRadius: Radius['lg+' as keyof typeof Radius] ?? 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing['2xl'],
  },
  listEmoji: {
    fontSize: FontSize.display,
  },
  labelContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  rowLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  chevron: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.normal,
  },

  // ── Vue grille ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xl,
  },
  gridPressable: {
    width: '47%',
  },
  gridCard: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    ...Shadows.md,
    position: 'relative' as const,
  },
  gridIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridEmoji: { fontSize: FontSize.icon },
  gridLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center' as const,
  },
  gridBadge: {
    position: 'absolute' as const,
    top: Spacing.md,
    right: Spacing.md,
    minWidth: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.sm,
  },

  // ── Commun ──
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.sm,
  },
  badgeText: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.heavy,
    color: '#FFFFFF',
  },
});
