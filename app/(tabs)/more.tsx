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
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedScrollHandler, useSharedValue, runOnJS } from 'react-native-reanimated';
import { setNavPillAtTop } from '../../lib/nav-pill-bus';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useVault } from '../../contexts/VaultContext';
import { unreadForProfile } from '../../lib/lovenotes/selectors';
import { useThemeColors } from '../../contexts/ThemeContext';
import { PressableScale } from '../../components/ui';
import { ModalHeader } from '../../components/ui/ModalHeader';
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
  Printer,
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
  Search,
  Star,
  Check,
  Pencil,
  type LucideIcon,
} from 'lucide-react-native';

const FAVORITES_PREF_KEY = 'more_favorites_v1';
const MAX_FAVORITES = 4;

// Clé stable basée sur route+params (pas le label traduit) pour persistance.
const itemKey = (route: string, params?: Record<string, string>) =>
  `${route}::${params ? JSON.stringify(params) : ''}`;

const DEFAULT_FAVORITE_KEYS: string[] = [
  itemKey('/(tabs)/meals', { tab: 'courses' }),
  itemKey('/(tabs)/rdv'),
  itemKey('/(tabs)/photos'),
  itemKey('/(tabs)/meals'),
];

interface MenuItem {
  Icon: LucideIcon;
  label: string;
  route: string;
  params?: Record<string, string>;
  badge?: number;
  color: string;
  category: 'organisation' | 'sante' | 'souvenirs' | 'jeux' | 'famille' | 'systeme';
}

interface UsageShortcut {
  key: string;
  Icon: LucideIcon;
  label: string;
  badge?: number;
  color: string;
  onPress: () => void;
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
  const navPillLocalAtTop = useSharedValue(true);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    const atTop = e.contentOffset.y < 40;
    if (atTop !== navPillLocalAtTop.value) {
      navPillLocalAtTop.value = atTop;
      runOnJS(setNavPillAtTop)(atTop);
    }
  });

  const [toolSearch, setToolSearch] = useState('');
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(DEFAULT_FAVORITE_KEYS);
  const [editFavoritesOpen, setEditFavoritesOpen] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync(FAVORITES_PREF_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')) {
          setFavoriteKeys(parsed);
        }
      } catch {
        /* prefs corrompues — on ignore et garde les défauts */
      }
    });
  }, []);
  const toggleFavorite = useCallback((key: string) => {
    setFavoriteKeys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_FAVORITES ? prev : [...prev, key];
      SecureStore.setItemAsync(FAVORITES_PREF_KEY, JSON.stringify(next)).catch(() => {});
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
      { Icon: Printer, label: t('menu.items.impressions'), route: '/impressions', color: colors.catSouvenirs, category: 'souvenirs' as const },
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

  const makeShortcut = useCallback((item: MenuItem): UsageShortcut => ({
    key: itemKey(item.route, item.params),
    Icon: item.Icon,
    label: item.label,
    badge: item.badge,
    color: item.color,
    onPress: () => onItemPress(item),
  }), [onItemPress]);

  // Index pour résoudre une clé stable → MenuItem (perdu si l'item n'est plus visible).
  const itemsByKey = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const item of visibleItems) map.set(itemKey(item.route, item.params), item);
    return map;
  }, [visibleItems]);

  const favoriteShortcuts = useMemo(() => {
    return favoriteKeys
      .map((key) => itemsByKey.get(key))
      .filter((item): item is MenuItem => Boolean(item))
      .map(makeShortcut);
  }, [favoriteKeys, itemsByKey, makeShortcut]);

  const favoriteKeysSet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);

  const filteredTools = useMemo(() => {
    const q = toolSearch.trim().toLocaleLowerCase();
    if (!q) return visibleItems;
    return visibleItems.filter((item) =>
      item.label.toLocaleLowerCase().includes(q)
      || t(CATEGORY_LABEL_KEYS[item.category]).toLocaleLowerCase().includes(q)
    );
  }, [t, toolSearch, visibleItems]);

  const devGridItems = useMemo(() => {
    if (toolSearch.trim()) return filteredTools;
    return visibleItems.filter((item) => !favoriteKeysSet.has(itemKey(item.route, item.params)));
  }, [favoriteKeysSet, filteredTools, toolSearch, visibleItems]);

  const renderUsageShortcut = (shortcut: UsageShortcut) => (
    <PressableScale
      key={shortcut.key}
      onPress={shortcut.onPress}
      scaleValue={0.95}
      style={styles.devFavoritePressable}
    >
      <View
        style={[
          styles.devFavorite,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(shortcut.color, isDark ? 0.20 : 0.18),
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: withAlpha(shortcut.color, isDark ? 0.10 : 0.10),
          borderRadius: Radius.lg,
        }]} />
        <View style={[styles.devFavoriteIcon, { backgroundColor: withAlpha(shortcut.color, isDark ? 0.20 : 0.20) }]}>
          <shortcut.Icon size={20} strokeWidth={1.85} color={shortcut.color} />
        </View>
        <Text style={[styles.devFavoriteLabel, { color: colors.text }]} numberOfLines={1}>
          {shortcut.label}
        </Text>
        {shortcut.badge ? (
          <View style={[styles.devMiniBadge, { backgroundColor: shortcut.color }]}>
            <Text style={[styles.devMiniBadgeText, { color: colors.onAccent }]}>{shortcut.badge > 99 ? '99+' : shortcut.badge}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );

  const renderDevGridItem = (item: MenuItem) => {
    const accentColor = item.color;
    return (
      <PressableScale
        key={itemKey(item.route, item.params)}
        onPress={() => onItemPress(item)}
        scaleValue={0.95}
        style={styles.devGridPressable}
      >
        <View
          style={[
            styles.devGridCard,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(accentColor, isDark ? 0.16 : 0.20),
            },
          ]}
          accessibilityLabel={`${item.label}${item.badge ? `, ${item.badge} élément${item.badge > 1 ? 's' : ''}` : ''}`}
          accessibilityRole="button"
        >
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: withAlpha(accentColor, isDark ? 0.08 : 0.09),
            borderRadius: Radius.xl,
          }]} />
          <View style={[styles.devGridIcon, { backgroundColor: withAlpha(accentColor, isDark ? 0.18 : 0.20) }]}>
            <item.Icon size={26} strokeWidth={1.75} color={accentColor} />
          </View>
          <Text style={[styles.devGridLabel, { color: colors.text }]} numberOfLines={1}>
            {item.label}
          </Text>
          {item.badge ? (
            <View style={[styles.devGridBadge, { backgroundColor: accentColor }]}>
              <Text style={[styles.badgeText, { color: colors.onAccent }]}>{item.badge > 99 ? '99+' : item.badge}</Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    );
  };

  const showSearchResults = toolSearch.trim().length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <View ref={headerRef}>
        <ScreenHeader
          title={t('more.title')}
          subtitle={t('more.subtitle', { count: visibleItems.length, defaultValue: `${visibleItems.length} raccourcis` })}
          tint={colors.brand.wash}
          scrollY={scrollY}
        />
      </View>

      <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.devContent, Layout.contentContainer]}
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.devSearchBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Search size={18} strokeWidth={1.9} color={colors.textMuted} />
            <TextInput
              style={[styles.devSearchInput, { color: colors.text }]}
              value={toolSearch}
              onChangeText={setToolSearch}
              placeholder="Que cherches-tu ?"
              placeholderTextColor={colors.textFaint}
              clearButtonMode="while-editing"
              accessibilityRole="search"
              accessibilityLabel="Rechercher un raccourci"
            />
          </View>

          {!showSearchResults && (
            <View style={styles.devFavoritesBlock}>
              <View style={styles.devFavoritesHeader}>
                <View style={styles.devSectionTitleRow}>
                  <Star size={15} strokeWidth={1.8} color={primary} />
                  <Text style={[styles.devSectionTitle, { color: colors.textMuted }]}>Favoris</Text>
                </View>
                <PressableScale
                  onPress={() => setEditFavoritesOpen(true)}
                  scaleValue={0.96}
                >
                  <View
                    style={styles.devFavoritesEditLink}
                    accessibilityLabel="Modifier les favoris"
                    accessibilityRole="button"
                  >
                    <Pencil size={13} strokeWidth={2} color={primary} />
                    <Text style={[styles.devFavoritesEditLinkText, { color: primary }]}>Modifier</Text>
                  </View>
                </PressableScale>
              </View>
              <View style={styles.devFavoritesRow}>
                {favoriteShortcuts.map((shortcut) => renderUsageShortcut(shortcut))}
              </View>
            </View>
          )}

          {showSearchResults ? (
            <View style={styles.devSearchResultsBlock}>
              <Text style={[styles.devSearchResultsTitle, { color: colors.text }]}>
                {filteredTools.length} résultat{filteredTools.length > 1 ? 's' : ''}
              </Text>
              <View style={styles.devGrid}>
                {devGridItems.map(renderDevGridItem)}
              </View>
            </View>
          ) : (
            <>
              {(['organisation', 'sante', 'souvenirs', 'jeux', 'famille', 'systeme'] as const).map((cat) => {
                const catItems = devGridItems.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                const accentColor = colors[CATEGORY_ACCENT_KEYS[cat]];
                const CatIcon = CATEGORY_ICONS[cat];
                return (
                  <View key={cat} style={styles.devCategory}>
                    <View style={styles.sectionHeader}>
                      <CatIcon size={15} strokeWidth={1.75} color={accentColor} />
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                        {t(CATEGORY_LABEL_KEYS[cat])}
                      </Text>
                    </View>
                    <View style={styles.devGrid}>
                      {catItems.map(renderDevGridItem)}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </Animated.ScrollView>

        <ScreenGuide
          screenId="more"
          targets={[
            { ref: headerRef, ...HELP_CONTENT.more[0] },
          ]}
        />

        <Modal
          visible={editFavoritesOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditFavoritesOpen(false)}
        >
          <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
            <ModalHeader
              title="Favoris"
              onClose={() => setEditFavoritesOpen(false)}
              closeLeft
            />
            <View style={styles.devEditHintRow}>
              <Text style={[styles.devEditHint, { color: colors.textMuted }]}>
                {favoriteKeys.length} / {MAX_FAVORITES} sélectionnés
              </Text>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.devEditContent, Layout.contentContainer]}
              showsVerticalScrollIndicator={false}
            >
              {(['organisation', 'sante', 'souvenirs', 'jeux', 'famille', 'systeme'] as const).map((cat) => {
                const catItems = visibleItems.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                const accentColor = colors[CATEGORY_ACCENT_KEYS[cat]];
                const CatIcon = CATEGORY_ICONS[cat];
                return (
                  <View key={cat} style={styles.devEditCategory}>
                    <View style={styles.sectionHeader}>
                      <CatIcon size={15} strokeWidth={1.75} color={accentColor} />
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                        {t(CATEGORY_LABEL_KEYS[cat])}
                      </Text>
                    </View>
                    {catItems.map((item) => {
                      const key = itemKey(item.route, item.params);
                      const selected = favoriteKeysSet.has(key);
                      const disabled = !selected && favoriteKeys.length >= MAX_FAVORITES;
                      return (
                        <PressableScale
                          key={key}
                          onPress={() => toggleFavorite(key)}
                          scaleValue={0.97}
                          disabled={disabled}
                        >
                          <View
                            style={[
                              styles.devEditRow,
                              {
                                backgroundColor: colors.card,
                                borderColor: selected ? withAlpha(item.color, 0.35) : colors.border,
                                opacity: disabled ? 0.4 : 1,
                              },
                            ]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected, disabled }}
                            accessibilityLabel={item.label}
                          >
                            <View style={[styles.devEditIcon, { backgroundColor: withAlpha(item.color, isDark ? 0.15 : 0.18) }]}>
                              <item.Icon size={20} strokeWidth={1.75} color={item.color} />
                            </View>
                            <Text style={[styles.devEditLabel, { color: colors.text }]} numberOfLines={1}>
                              {item.label}
                            </Text>
                            <View
                              style={[
                                styles.devEditCheck,
                                {
                                  backgroundColor: selected ? item.color : 'transparent',
                                  borderColor: selected ? item.color : colors.border,
                                },
                              ]}
                            >
                              {selected ? <Check size={14} strokeWidth={2.5} color={colors.onAccent} /> : null}
                            </View>
                          </View>
                        </PressableScale>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  scroll: { flex: 1 },
  devContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xs,
    paddingBottom: 130,
  },
  devSearchBox: {
    minHeight: 48,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  devSearchInput: {
    flex: 1,
    fontSize: FontSize.body,
    paddingVertical: Spacing.md,
  },
  devFavoritesBlock: {
    marginBottom: Spacing['2xl'],
  },
  devFavoritesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  devFavoritesEditLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
  },
  devFavoritesEditLinkText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  devSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  devSectionTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devFavoritesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  devFavoritePressable: {
    flex: 1,
  },
  devFavorite: {
    minHeight: 76,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  devFavoriteIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devFavoriteLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  devMiniBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  devMiniBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.heavy,
  },
  devSearchResultsBlock: {
    marginTop: Spacing.xs,
  },
  devSearchResultsTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xl,
  },
  devCategory: {
    marginTop: Spacing['2xl'],
  },
  devGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  devGridPressable: {
    width: '48%',
  },
  devGridCard: {
    minHeight: 104,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    position: 'relative' as const,
    overflow: 'hidden',
    ...Shadows.md,
  },
  devGridIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devGridLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center' as const,
  },
  devGridBadge: {
    position: 'absolute' as const,
    top: Spacing.sm,
    right: Spacing.sm,
    minWidth: 21,
    height: 21,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Spacing.sm,
  },

  // ── Modale édition favoris ──
  devEditHintRow: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  devEditHint: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  devEditContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
  },
  devEditCategory: {
    marginTop: Spacing['2xl'],
    gap: Spacing.sm,
  },
  devEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.lg,
    minHeight: 56,
  },
  devEditIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devEditLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  devEditCheck: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  badgeText: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.heavy,
  },
});
