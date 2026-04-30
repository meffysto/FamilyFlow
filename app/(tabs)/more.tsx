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
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { unreadForProfile } from '../../lib/lovenotes/selectors';
import { useThemeColors } from '../../contexts/ThemeContext';
import { PressableScale } from '../../components/ui';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { isRdvUpcoming } from '../../lib/parser';
import { totalSpent, totalBudget } from '../../lib/budget';
import { isBabyProfile } from '../../lib/types';
import { withAlpha } from '../../lib/colors';
import { useTranslation } from 'react-i18next';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import {
  Repeat,
  CalendarDays,
  UtensilsCrossed,
  ChefHat,
  ShoppingCart,
  Package,
  Salad,
  HeartPulse,
  CloudSun,
  Moon,
  Baby,
  Camera,
  MessageCircle,
  HandHeart,
  BookOpen,
  Sprout,
  Trees,
  Sparkles,
  Award,
  Cake,
  Gift,
  Wallet,
  NotebookPen,
  Mail,
  BarChart3,
  Settings as SettingsIcon,
  ClipboardList,
  Heart as HeartIcon,
  Gamepad2,
  Users as UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';

const VIEW_PREF_KEY = 'more_view_mode';
type ViewMode = 'list' | 'grid';

interface MenuItem {
  Icon: LucideIcon;
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

const CATEGORY_ICONS: Record<'organisation' | 'sante' | 'souvenirs' | 'jeux' | 'famille' | 'systeme', LucideIcon> = {
  organisation: ClipboardList,
  sante: HeartIcon,
  souvenirs: Sparkles,
  jeux: Gamepad2,
  famille: UsersIcon,
  systeme: SettingsIcon,
};

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
  const { rdvs, stock, courses, totalRemainingAllLists, gamiData, budgetEntries, budgetConfig, activeProfile, profiles, defis, wishlistItems, anniversaries, notes, loveNotes } = useVault();
  const { primary, colors, isDark } = useThemeColors();
  const { t } = useTranslation();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

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

  const loveNoteUnreadCount = useMemo(
    () => (activeProfile ? unreadForProfile(loveNotes, activeProfile.id).length : 0),
    [loveNotes, activeProfile?.id]
  );

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
      { Icon: Repeat, label: t('menu.items.routines'), route: '/(tabs)/routines', color: colors.catOrganisation, category: 'organisation' as const },
      { Icon: CalendarDays, label: t('menu.items.appointments'), route: '/(tabs)/rdv', badge: upcomingRdvs || undefined, color: colors.catOrganisation, category: 'organisation' as const },
      { Icon: UtensilsCrossed, label: t('menu.items.meals'), route: '/(tabs)/meals', color: colors.catOrganisation, category: 'organisation' as const },
      { Icon: ChefHat, label: t('menu.items.recipes'), route: '/(tabs)/meals', params: { tab: 'recettes' }, color: colors.catOrganisation, category: 'organisation' as const },
      { Icon: ShoppingCart, label: t('menu.items.shopping'), route: '/(tabs)/meals', params: { tab: 'courses' }, badge: totalRemainingAllLists || undefined, color: colors.catOrganisation, category: 'organisation' as const },
      { Icon: Package, label: t('menu.items.stock'), route: '/(tabs)/stock', badge: lowStock || undefined, color: colors.catOrganisation, category: 'organisation' as const },
      // Santé & Bien-être — violet
      { Icon: Salad, label: t('menu.items.dietary'), route: '/dietary', color: colors.catSante, category: 'sante' as const },
      { Icon: HeartPulse, label: t('menu.items.health'), route: '/(tabs)/health', color: colors.catSante, category: 'sante' as const },
      { Icon: CloudSun, label: t('menu.items.moods'), route: '/(tabs)/moods', color: colors.catSante, category: 'sante' as const },
      ...(hasBaby ? [{ Icon: Moon, label: t('menu.items.nightMode'), route: '/(tabs)/night-mode', color: colors.catSante, category: 'sante' as const }] : []),
      ...(profiles.some(p => p.statut === 'grossesse') ? [{ Icon: Baby, label: t('menu.items.pregnancy'), route: '/(tabs)/pregnancy' as const, color: colors.catSante, category: 'sante' as const }] : []),
      // Souvenirs & Émotions — orange doré
      { Icon: Camera, label: t('menu.items.photos'), route: '/(tabs)/photos', color: colors.catSouvenirs, category: 'souvenirs' as const },
      { Icon: MessageCircle, label: t('menu.items.quotes'), route: '/(tabs)/quotes', color: colors.catSouvenirs, category: 'souvenirs' as const },
      { Icon: HandHeart, label: t('menu.items.gratitude'), route: '/(tabs)/gratitude', color: colors.catSouvenirs, category: 'souvenirs' as const },
      { Icon: BookOpen, label: t('menu.items.bedtimeStories'), route: '/(tabs)/stories', color: colors.catSouvenirs, category: 'souvenirs' as const },
      // Jeux & Progrès — vert
      { Icon: Sprout, label: t('menu.items.skills'), route: '/(tabs)/skills', color: colors.catJeux, category: 'jeux' as const },
      { Icon: Trees, label: activeProfile?.gardenName || t('menu.items.tree'), route: '/(tabs)/tree' as any, color: colors.catJeux, category: 'jeux' as const },
      { Icon: Sparkles, label: t('menu.items.rewards'), route: '/(tabs)/loot', badge: lootBoxes || undefined, color: colors.catJeux, category: 'jeux' as const },
      { Icon: Award, label: t('menu.items.challenges'), route: '/(tabs)/defis', badge: activeDefis || undefined, color: colors.catJeux, category: 'jeux' as const },
      // Vie de famille — rose
      { Icon: Cake, label: t('menu.items.birthdays'), route: '/(tabs)/anniversaires', badge: upcomingBirthdays || undefined, color: colors.catFamille, category: 'famille' as const },
      { Icon: Gift, label: t('menu.items.wishlist'), route: '/(tabs)/wishlist', badge: wishlistUnbought || undefined, color: colors.catFamille, category: 'famille' as const },
      { Icon: Wallet, label: t('menu.items.budget'), route: '/(tabs)/budget', badge: totalSpent(budgetEntries) > totalBudget(budgetConfig) ? 1 : undefined, color: colors.catFamille, category: 'famille' as const },
      { Icon: NotebookPen, label: t('menu.items.notes'), route: '/(tabs)/notes', badge: notes.length || undefined, color: colors.catFamille, category: 'famille' as const },
      { Icon: Mail, label: 'Love Notes', route: '/(tabs)/lovenotes' as any, badge: loveNoteUnreadCount || undefined, color: colors.catFamille, category: 'famille' as const },
      { Icon: BarChart3, label: t('menu.items.stats'), route: '/(tabs)/stats', color: colors.catFamille, category: 'famille' as const },
      // Système — gris
      { Icon: SettingsIcon, label: t('menu.items.settings'), route: '/(tabs)/settings', color: colors.catSysteme, category: 'systeme' as const },
    ];
  }, [rdvs, stock, totalRemainingAllLists, gamiData, budgetEntries, budgetConfig, colors, profiles, defis, wishlistItems, anniversaries, t, loveNoteUnreadCount, notes]);

  const visibleItems = isChildMode ? items.filter((i) => i.route !== '/(tabs)/budget' && i.route !== '/(tabs)/notes') : items;

  const onItemPress = useCallback((item: MenuItem) => {
    if (item.params) {
      router.push({ pathname: item.route as any, params: item.params });
    } else {
      router.push(item.route as any);
    }
  }, [router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <View ref={headerRef}>
        <ScreenHeader
          title={t('more.title')}
          subtitle={t('more.subtitle', { count: visibleItems.length, defaultValue: `${visibleItems.length} raccourcis` })}
          actions={
            <PressableScale
              onPress={toggleView}
              style={[styles.viewToggle, {
                backgroundColor: colors.card,
                borderColor: colors.border,
              }]}
              scaleValue={0.93}
            >
              <View style={styles.viewToggleRow}>
                <Text style={[
                  styles.viewToggleIcon,
                  { color: viewMode === 'list' ? primary : colors.textFaint },
                ]}>☰</Text>
                <View style={[styles.viewToggleSep, { backgroundColor: colors.border }]} />
                <Text style={[
                  styles.viewToggleIcon,
                  { color: viewMode === 'grid' ? primary : colors.textFaint },
                ]}>⊞</Text>
              </View>
            </PressableScale>
          }
          scrollY={scrollY}
        />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
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
                {(() => { const CatIcon = CATEGORY_ICONS[cat]; return <CatIcon size={16} strokeWidth={1.75} color={accentColor} />; })()}
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
                          borderColor: withAlpha(accentColor, isDark ? 0.13 : 0.18),
                        }]}
                        accessibilityLabel={`${item.label}${item.badge ? `, ${item.badge} élément${item.badge > 1 ? 's' : ''}` : ''}`}
                        accessibilityRole="button"
                      >
                        {/* Fond teinté catégorie (comme DashboardCard tinted) */}
                        <View style={[StyleSheet.absoluteFill, {
                          backgroundColor: withAlpha(accentColor, isDark ? 0.10 : 0.12),
                          borderRadius: Radius.xl,
                        }]} />

                        {/* Icône avec teinte plus saturée */}
                        <View style={[styles.listIcon, { backgroundColor: withAlpha(accentColor, isDark ? 0.15 : 0.20) }]}>
                          <item.Icon size={24} strokeWidth={1.75} color={accentColor} />
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
                              <Text style={[styles.badgeText, { color: colors.onAccent }]}>{item.badge}</Text>
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
                        <View style={[styles.gridIcon, { backgroundColor: withAlpha(accentColor, isDark ? 0.08 : 0.16) }]}>
                          <item.Icon size={26} strokeWidth={1.75} color={accentColor} />
                        </View>
                        <Text style={[styles.gridLabel, { color: colors.textSub }]}>{item.label}</Text>
                        {item.badge ? (
                          <View style={[styles.gridBadge, { backgroundColor: accentColor }]}>
                            <Text style={[styles.badgeText, { color: colors.onAccent }]}>{item.badge}</Text>
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
      </Animated.ScrollView>

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

  // ── Toggle vue liste/grille ──
  viewToggle: {
    height: 32,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    ...Shadows.xs,
  },
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
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
    borderRadius: Radius['lg+'],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing['2xl'],
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
  },
});
