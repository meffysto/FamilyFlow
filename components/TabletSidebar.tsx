/**
 * TabletSidebar.tsx — Barre latérale iPad adaptive
 *
 * Remplace la tab bar + l'écran "Plus" sur tablette.
 * Affiche les 5 onglets principaux + les items du menu catégorisés.
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { isRdvUpcoming } from '../lib/parser';
import { totalSpent, totalBudget } from '../lib/budget';
import { isBabyProfile } from '../lib/types';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import {
  Home,
  ListChecks,
  BookOpen,
  Calendar,
  Repeat,
  CalendarDays,
  UtensilsCrossed,
  Package,
  HeartPulse,
  CloudSun,
  Moon,
  Baby,
  Camera,
  MessageCircle,
  HandHeart,
  Trees,
  Sparkles,
  Award,
  Cake,
  Gift,
  Wallet,
  NotebookPen,
  BarChart3,
  Settings as SettingsIcon,
  ClipboardList,
  Heart as HeartIcon,
  Gamepad2,
  Users as UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';

const SIDEBAR_WIDTH = 260;

type CategoryKey = 'organisation' | 'sante' | 'souvenirs' | 'jeux' | 'famille' | 'systeme';

interface SidebarItem {
  Icon: LucideIcon;
  labelKey: string;
  route: string;
  params?: Record<string, string>;
  badge?: number;
  category?: CategoryKey;
}

const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  organisation: ClipboardList,
  sante: HeartIcon,
  souvenirs: Sparkles,
  jeux: Gamepad2,
  famille: UsersIcon,
  systeme: SettingsIcon,
};

const CATEGORY_ACCENT_KEYS: Record<CategoryKey, 'catOrganisation' | 'catSante' | 'catSouvenirs' | 'catJeux' | 'catFamille' | 'catSysteme'> = {
  organisation: 'catOrganisation',
  sante: 'catSante',
  souvenirs: 'catSouvenirs',
  jeux: 'catJeux',
  famille: 'catFamille',
  systeme: 'catSysteme',
};

export function TabletSidebar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();
  const {
    rdvs, stock, courses, gamiData, budgetEntries, budgetConfig,
    activeProfile, profiles, defis, wishlistItems, anniversaries, notes,
  } = useVault();

  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  // Route active depuis les segments expo-router
  const activeRoute = (segments[1] as string) || 'index';

  // Items du menu secondaire (même logique que more.tsx)
  const menuItems = useMemo(() => {
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
      return Math.round(diff / (1000 * 60 * 60 * 24)) <= 7;
    }).length;

    const items: (SidebarItem & { hidden?: boolean })[] = [
      // Organisation
      { Icon: Repeat, labelKey: 'menu.items.routines', route: 'routines', category: 'organisation' },
      { Icon: CalendarDays, labelKey: 'menu.items.appointments', route: 'rdv', badge: upcomingRdvs || undefined, category: 'organisation' },
      { Icon: UtensilsCrossed, labelKey: 'menu.items.meals', route: 'meals', category: 'organisation' },
      { Icon: Package, labelKey: 'menu.items.stock', route: 'stock', badge: lowStock || undefined, category: 'organisation' },
      // Santé
      { Icon: HeartPulse, labelKey: 'menu.items.health', route: 'health', category: 'sante' },
      { Icon: CloudSun, labelKey: 'menu.items.moods', route: 'moods', category: 'sante' },
      ...(hasBaby ? [{ Icon: Moon, labelKey: 'menu.items.nightMode', route: 'night-mode', category: 'sante' as const }] : []),
      ...(profiles.some(p => p.statut === 'grossesse') ? [{ Icon: Baby, labelKey: 'menu.items.pregnancy', route: 'pregnancy', category: 'sante' as const }] : []),
      // Souvenirs
      { Icon: Camera, labelKey: 'menu.items.photos', route: 'photos', category: 'souvenirs' },
      { Icon: MessageCircle, labelKey: 'menu.items.quotes', route: 'quotes', category: 'souvenirs' },
      { Icon: HandHeart, labelKey: 'menu.items.gratitude', route: 'gratitude', category: 'souvenirs' },
      // Jeux
      { Icon: Trees, labelKey: 'menu.items.skills', route: 'skills', category: 'jeux' },
      { Icon: Sparkles, labelKey: 'menu.items.rewards', route: 'loot', badge: lootBoxes || undefined, category: 'jeux' },
      { Icon: Award, labelKey: 'menu.items.challenges', route: 'defis', badge: activeDefis || undefined, category: 'jeux' },
      // Famille
      { Icon: Cake, labelKey: 'menu.items.birthdays', route: 'anniversaires', badge: upcomingBirthdays || undefined, category: 'famille' },
      { Icon: Gift, labelKey: 'menu.items.wishlist', route: 'wishlist', badge: wishlistUnbought || undefined, category: 'famille' },
      { Icon: Wallet, labelKey: 'menu.items.budget', route: 'budget', badge: totalSpent(budgetEntries) > totalBudget(budgetConfig) ? 1 : undefined, category: 'famille', hidden: isChildMode },
      { Icon: NotebookPen, labelKey: 'menu.items.notes', route: 'notes', badge: notes.length || undefined, category: 'famille', hidden: isChildMode },
      { Icon: BarChart3, labelKey: 'menu.items.stats', route: 'stats', category: 'famille' },
      // Système
      { Icon: SettingsIcon, labelKey: 'menu.items.settings', route: 'settings', category: 'systeme' },
    ];

    return items.filter(i => !i.hidden);
  }, [rdvs, stock, courses, gamiData, budgetEntries, budgetConfig, profiles, defis, wishlistItems, anniversaries, notes, isChildMode]);

  const CATEGORY_LABELS: Record<CategoryKey, string> = {
    organisation: 'menu.categories.organisation',
    sante: 'menu.categories.health',
    souvenirs: 'menu.categories.memories',
    jeux: 'menu.categories.games',
    famille: 'menu.categories.family',
    systeme: 'menu.categories.system',
  };

  const categories: CategoryKey[] = ['organisation', 'sante', 'souvenirs', 'jeux', 'famille', 'systeme'];

  const navigate = (route: string, params?: Record<string, string>) => {
    const path = route === 'index' ? '/(tabs)' : `/(tabs)/${route}`;
    if (params) {
      router.navigate({ pathname: path as any, params });
    } else {
      router.navigate(path as any);
    }
  };

  const renderItem = (
    item: { Icon: LucideIcon; label: string; route: string; badge?: number; params?: Record<string, string> },
    compact?: boolean,
    accentColor?: string,
  ) => {
    const isActive = activeRoute === item.route;
    const iconColor = accentColor ?? (isActive ? primary : colors.textMuted);
    return (
      <TouchableOpacity
        key={item.route + (item.params ? JSON.stringify(item.params) : '')}
        style={[
          styles.item,
          compact && styles.itemCompact,
          isActive && { backgroundColor: primary + '18' },
        ]}
        onPress={() => navigate(item.route, item.params)}
        activeOpacity={0.6}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
      >
        <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
          <item.Icon size={compact ? 20 : 22} strokeWidth={1.75} color={iconColor} />
        </View>
        <Text
          style={[
            styles.itemLabel,
            compact && styles.itemLabelCompact,
            { color: isActive ? primary : colors.text },
            isActive && { fontWeight: FontWeight.bold },
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {item.badge ? (
          <View style={[styles.badge, { backgroundColor: primary }]}>
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{item.badge}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Onglets principaux
  const mainTabs: { Icon: LucideIcon; label: string; route: string }[] = [
    { Icon: Home, label: t('tabs.today'), route: 'index' },
    { Icon: ListChecks, label: t('tabs.tasks'), route: 'tasks' },
    { Icon: BookOpen, label: t('tabs.journal'), route: 'journal' },
    { Icon: Calendar, label: t('tabs.calendar'), route: 'calendar' },
  ];

  return (
    <View style={[
      styles.sidebar,
      {
        backgroundColor: isDark ? colors.card : colors.bg,
        borderRightColor: colors.border,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      },
    ]}>
      {/* Onglets principaux */}
      <View style={styles.mainSection}>
        {mainTabs.map((tab) => renderItem(tab))}
      </View>

      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* Menu catégorisé (scrollable) */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        {categories.map((cat) => {
          const catItems = menuItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          const accentColor = colors[CATEGORY_ACCENT_KEYS[cat]];
          const CatIcon = CATEGORY_ICONS[cat];
          return (
            <View key={cat} style={styles.category}>
              <View style={styles.categoryHeader}>
                <CatIcon size={14} strokeWidth={1.75} color={accentColor} />
                <Text style={[styles.categoryLabel, { color: colors.textMuted }]}>
                  {t(CATEGORY_LABELS[cat])}
                </Text>
              </View>
              {catItems.map((item) =>
                renderItem({ ...item, label: t(item.labelKey) }, true, accentColor)
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export { SIDEBAR_WIDTH };

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  mainSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing['2xl'],
    marginVertical: Spacing.xs,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  category: {
    marginTop: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xxs,
  },
  categoryLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginVertical: 1,
  },
  itemCompact: {
    paddingVertical: Spacing.md,
  },
  iconWrap: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    width: 26,
  },
  itemLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    marginLeft: Spacing.md,
  },
  itemLabelCompact: {
    fontSize: FontSize.sm,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  badgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.heavy,
  },
});
