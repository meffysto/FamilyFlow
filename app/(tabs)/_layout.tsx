/**
 * (tabs)/_layout.tsx — Tab bar configuration + profile picker modal
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { FAB, FABAction } from '../../components/FAB';
import { TabletSidebar } from '../../components/TabletSidebar';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

import { GlassView } from '../../components/ui/GlassView';
import { CompanionAvatarMini } from '../../components/mascot/CompanionAvatarMini';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';
import { Layout, Spacing, Radius } from '../../constants/spacing';
import {
  Home,
  ListChecks,
  BookOpen,
  Calendar as CalendarIcon,
  LayoutGrid,
  ClipboardList,
  CalendarPlus,
  Camera,
  type LucideIcon,
} from 'lucide-react-native';

const SPRING_CONFIG = { damping: 10, stiffness: 180 };

type TabBadgeProps = { kind: 'dot' | 'progress'; value?: string };

function TabBadge({ kind, value }: TabBadgeProps) {
  const { primary, colors } = useThemeColors();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (kind !== 'dot') return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [kind]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (kind === 'dot') {
    return (
      <Animated.View style={[tabBadgeStyles.dot, { backgroundColor: primary }, pulseStyle]} />
    );
  }

  return (
    <View style={[tabBadgeStyles.progress, { backgroundColor: primary }]}>
      <Text style={[tabBadgeStyles.progressText, { color: colors.onPrimary }]}>{value}</Text>
    </View>
  );
}

function TabIcon({
  Icon,
  focused,
  badge,
}: {
  Icon: LucideIcon;
  focused: boolean;
  badge?: TabBadgeProps;
}) {
  const { primary, colors } = useThemeColors();
  const iconScale = useSharedValue(focused ? 1.1 : 1);
  const barScaleX = useSharedValue(focused ? 1 : 0);
  const barOpacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    iconScale.value = withSpring(focused ? 1.1 : 1, SPRING_CONFIG);
    barScaleX.value = withSpring(focused ? 1 : 0, SPRING_CONFIG);
    barOpacity.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: barScaleX.value }, { rotate: '-2deg' }],
    opacity: barOpacity.value,
  }));

  return (
    <View style={tabIconStyles.container} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={iconWrapStyle}>
        <Icon
          size={22}
          strokeWidth={focused ? 2 : 1.75}
          color={focused ? primary : colors.textMuted}
        />
        {badge && <TabBadge kind={badge.kind} value={badge.value} />}
      </Animated.View>
      <Animated.View style={[tabIconStyles.bar, { backgroundColor: primary }, barStyle]} />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  container: {
    width: 48,
    height: 36,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    height: 2,
    borderRadius: 2,
  },
});

const tabBadgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -3,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progress: {
    position: 'absolute',
    top: -5,
    right: -8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 99,
    minWidth: 16,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 9,
    fontWeight: '700' as const,
    lineHeight: 11,
  },
});

interface ThemedTabsContentProps {
  profiles: ReturnType<typeof useVault>['profiles'];
  activeProfile: ReturnType<typeof useVault>['activeProfile'];
  setActiveProfile: ReturnType<typeof useVault>['setActiveProfile'];
  taskBadgeCount: number;
  rdvBadgeActive: boolean;
}

function VacationBanner({ vacationConfig, isVacationActive }: {
  vacationConfig: ReturnType<typeof useVault>['vacationConfig'];
  isVacationActive: boolean;
}) {
  const { colors } = useThemeColors();
  const { t } = useTranslation();
  if (!isVacationActive || !vacationConfig) return null;

  const now = Date.now();
  const end = new Date(vacationConfig.endDate + 'T23:59:59').getTime();
  const start = new Date(vacationConfig.startDate + 'T00:00:00').getTime();
  const daysLeft = now < start
    ? Math.ceil((start - now) / 86400000)
    : Math.ceil((end - now) / 86400000);
  const label = now < start
    ? t('tabs.vacation.departIn', { count: daysLeft })
    : daysLeft <= 0 ? t('tabs.vacation.lastDay') : t('tabs.vacation.endsIn', { count: daysLeft });

  return (
    <View style={[bannerStyles.bar, { backgroundColor: colors.warningBg, borderTopColor: colors.warning }]}>
      <Text style={[bannerStyles.text, { color: colors.warningText }]}>{t('tabs.vacation.banner', { label })}</Text>
    </View>
  );
}

function ThemedTabsContent({ profiles, activeProfile, setActiveProfile, vacationConfig, isVacationActive, taskBadgeCount, rdvBadgeActive }: ThemedTabsContentProps & {
  vacationConfig: ReturnType<typeof useVault>['vacationConfig'];
  isVacationActive: boolean;
}) {
  const { primary, colors, isDark } = useThemeColors();
  const { hasPin, authenticate, verifyPin, biometryAvailable } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const { isTablet } = useResponsiveLayout();
  const showPicker = profiles.length > 0 && !activeProfile;

  // ── PIN parent pour changement de profil enfant → adulte ──
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleProfileSelect = useCallback(async (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    const currentIsChild = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
    const targetIsAdult = target?.role === 'adulte';

    // Si un enfant tente d'accéder à un profil adulte ET qu'un PIN est configuré
    if (currentIsChild && targetIsAdult && hasPin) {
      // Tenter la biométrie d'abord
      if (biometryAvailable) {
        const ok = await authenticate();
        if (ok) {
          setActiveProfile(profileId);
          return;
        }
      }
      // Fallback : demander le PIN
      setPendingProfileId(profileId);
      setPinInput('');
      setPinError('');
      return;
    }

    // Sinon : changement direct
    setActiveProfile(profileId);
  }, [profiles, activeProfile, hasPin, biometryAvailable, authenticate, setActiveProfile]);

  const handlePinConfirm = useCallback(() => {
    if (pinInput.length !== 4) return;
    const ok = verifyPin(pinInput);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (pendingProfileId) setActiveProfile(pendingProfileId);
      setPendingProfileId(null);
      setPinInput('');
      setPinError('');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPinError(t('auth.pinIncorrect'));
      setPinInput('');
    }
  }, [pinInput, verifyPin, pendingProfileId, setActiveProfile, t]);

  const cancelPinPrompt = useCallback(() => {
    setPendingProfileId(null);
    setPinInput('');
    setPinError('');
  }, []);

  // Auto-submit PIN une fois 4 chiffres saisis.
  // Délai de 100ms pour que le 4ᵉ point s'affiche avant la vérification (UX).
  useEffect(() => {
    if (pinInput.length !== 4) return;
    const timer = setTimeout(() => {
      handlePinConfirm();
    }, 100);
    return () => clearTimeout(timer);
  }, [pinInput, handlePinConfirm]);

  // FAB uniquement sur le dashboard (évite de bloquer les boutons des autres écrans)
  const activeTab = segments[segments.length - 1];
  const showFAB = !activeTab || activeTab === '(tabs)' || (activeTab as string) === 'index';

  // Dernier enfant pour le journal : profil actif si enfant, sinon premier enfant
  const lastEnfant = activeProfile?.role === 'enfant'
    ? activeProfile.id
    : profiles.find((p) => p.role === 'enfant')?.id ?? '';

  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';


  const fabActions: FABAction[] = isChildMode
    ? [
        { id: 'task', Icon: ClipboardList, label: t('fab.actions.task'), onPress: () => router.push('/tasks?addNew=1') },
      ]
    : [
        { id: 'task', Icon: ClipboardList, label: t('fab.actions.task'), onPress: () => router.push('/tasks?addNew=1') },
        { id: 'rdv', Icon: CalendarPlus, label: t('fab.actions.rdv'), onPress: () => router.push('/rdv?addNew=1') },
        { id: 'journal', Icon: BookOpen, label: t('fab.actions.journal'), onPress: () => router.push(`/journal?enfant=${lastEnfant}`) },
        { id: 'photo', Icon: Camera, label: t('fab.actions.photo'), onPress: () => router.push('/photos?addNew=1') },
      ];

  return (
    <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
      {isTablet && <TabletSidebar />}
      <View style={{ flex: 1 }}>
      <VacationBanner vacationConfig={vacationConfig} isVacationActive={isVacationActive} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: isTablet
            ? { display: 'none' }
            : {
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopColor: colors.glassBorder,
              borderTopWidth: StyleSheet.hairlineWidth,
              paddingBottom: 6,
              height: Layout.tabBarHeight,
              elevation: 0,
            },
          tabBarBackground: () => (
            <BlurView
              intensity={60}
              tint={isDark ? 'dark' : 'light'}
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassBg }]}
            />
          ),
          tabBarActiveTintColor: primary,
          tabBarInactiveTintColor: colors.tabBarOff,
          tabBarLabelStyle: {
            fontFamily: FontFamily.handwriteSemibold,
            fontSize: 14,
            marginBottom: 2,
          },
        }}
      >
        {/* ── 5 visible tabs ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.today'),
            tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: t('tabs.tasks'),
            tabBarIcon: ({ focused }) => (
              <TabIcon
                Icon={ListChecks}
                focused={focused}
                badge={taskBadgeCount > 0 ? { kind: 'progress', value: String(taskBadgeCount) } : undefined}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: t('tabs.journal'),
            tabBarIcon: ({ focused }) => <TabIcon Icon={BookOpen} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: t('tabs.calendar'),
            tabBarIcon: ({ focused }) => (
              <TabIcon
                Icon={CalendarIcon}
                focused={focused}
                badge={rdvBadgeActive ? { kind: 'dot' } : undefined}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('tabs.menu'),
            tabBarIcon: ({ focused }) => <TabIcon Icon={LayoutGrid} focused={focused} />,
          }}
        />
        {/* ── Hidden screens (accessible via router.push) ── */}
        <Tabs.Screen name="meals" options={{ href: null }} />
        <Tabs.Screen name="loot" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="rdv" options={{ href: null }} />
        <Tabs.Screen name="stock" options={{ href: null }} />
        <Tabs.Screen name="budget" options={{ href: null }} />
        <Tabs.Screen name="routines" options={{ href: null }} />
        <Tabs.Screen name="health" options={{ href: null }} />
        <Tabs.Screen name="stats" options={{ href: null }} />
        <Tabs.Screen name="defis" options={{ href: null }} />
        <Tabs.Screen name="gratitude" options={{ href: null }} />
        <Tabs.Screen name="wishlist" options={{ href: null }} />
        <Tabs.Screen name="anniversaires" options={{ href: null }} />
        <Tabs.Screen name="compare" options={{ href: null }} />
        <Tabs.Screen name="notes" options={{ href: null }} />
        <Tabs.Screen name="lovenotes" options={{ href: null }} />
        <Tabs.Screen name="quotes" options={{ href: null }} />
        <Tabs.Screen name="moods" options={{ href: null }} />
        <Tabs.Screen name="photos" options={{ href: null }} />
        <Tabs.Screen name="pregnancy" options={{ href: null }} />
        <Tabs.Screen name="skills" options={{ href: null }} />
        <Tabs.Screen name="tree" options={{ href: null }} />
        <Tabs.Screen name="village" options={{ href: null }} />
        <Tabs.Screen name="night-mode" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="stories" options={{ href: null }} />
      </Tabs>

      {showFAB && <FAB actions={fabActions} />}
      </View>

      {/* Profile picker modal — shown on first launch */}
      <Modal visible={showPicker} animationType="fade" transparent statusBarTranslucent>
        <View style={pickerStyles.overlay}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <GlassView style={pickerStyles.card} intensity={50} borderRadius={24}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>{t('index.profilePicker.title')}</Text>
            <Text style={[pickerStyles.subtitle, { color: colors.textMuted }]}>{t('index.profilePicker.subtitle')}</Text>

            <View style={pickerStyles.grid}>
              {profiles.map((p) => {
                return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    pickerStyles.profileBtn,
                    { width: isTablet ? '30%' : '47%', backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
                  ]}
                  onPress={() => handleProfileSelect(p.id)}
                  activeOpacity={0.7}
                  accessibilityLabel={t('settings.profiles.profileA11y', { name: p.name })}
                  accessibilityRole="button"
                >
                  <CompanionAvatarMini
                    companion={p.companion}
                    level={p.level}
                    fallbackEmoji={p.avatar}
                    size={40}
                  />
                  <Text style={[pickerStyles.name, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[pickerStyles.role, { color: colors.textFaint }]}>
                    {p.role === 'adulte' ? `👤 ${t('index.profilePicker.adult')}` : `👶 ${t('index.profilePicker.child')}`}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </View>
          </GlassView>
        </View>
      </Modal>

      {/* PIN prompt modal — enfant → adulte */}
      <Modal visible={!!pendingProfileId} animationType="fade" transparent statusBarTranslucent>
        <View style={pickerStyles.overlay}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <GlassView style={pickerStyles.card} intensity={50} borderRadius={24}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>{t('index.profilePicker.pinTitle')}</Text>
            <Text style={[pickerStyles.subtitle, { color: colors.textMuted }]}>
              {t('index.profilePicker.pinSubtitle')}
            </Text>

            <TextInput
              style={[pinPromptStyles.input, {
                backgroundColor: colors.inputBg,
                borderColor: pinError ? colors.error : colors.inputBorder,
                color: colors.text,
              }]}
              value={pinInput}
              onChangeText={(value) => {
                setPinError('');
                const cleaned = value.replace(/[^0-9]/g, '').slice(0, 4);
                setPinInput(cleaned);
                // Auto-submit géré par useEffect([pinInput])
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="• • • •"
              placeholderTextColor={colors.textFaint}
              textAlign="center"
              autoFocus
              accessibilityLabel={t('auth.pinParentA11y')}
            />

            {/* Dots visuels */}
            <View
              style={pinPromptStyles.dots}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    pinPromptStyles.dot,
                    {
                      backgroundColor: pinError
                        ? colors.error
                        : i < pinInput.length ? primary : colors.border,
                      borderColor: pinError
                        ? colors.error
                        : i < pinInput.length ? primary : colors.border,
                    },
                  ]}
                />
              ))}
            </View>

            {pinError ? (
              <Text style={[pinPromptStyles.error, { color: colors.error }]}>{pinError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={cancelPinPrompt}
              activeOpacity={0.7}
              style={pinPromptStyles.cancelBtn}
              accessibilityLabel={t('common.cancel')}
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[pinPromptStyles.cancelText, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </GlassView>
        </View>
      </Modal>
    </View>
  );
}

export default function TabsLayout() {
  const { profiles, activeProfile, setActiveProfile, vacationConfig, isVacationActive, tasks, rdvs } = useVault();
  const { setThemeId } = useThemeColors();

  useEffect(() => {
    setThemeId(activeProfile?.theme ?? '');
  }, [activeProfile?.theme, setThemeId]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const taskBadgeCount = useMemo(
    () => tasks.filter(t => !t.completed && t.dueDate === todayStr).length,
    [tasks, todayStr],
  );

  const rdvBadgeActive = useMemo(() => {
    const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return rdvs.some(r => r.date_rdv >= todayStr && r.date_rdv <= weekLater);
  }, [rdvs, todayStr]);

  return (
    <ThemedTabsContent
      profiles={profiles}
      activeProfile={activeProfile}
      setActiveProfile={setActiveProfile}
      vacationConfig={vacationConfig}
      isVacationActive={isVacationActive}
      taskBadgeCount={taskBadgeCount}
      rdvBadgeActive={rdvBadgeActive}
    />
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['4xl'],
  },
  card: {
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center' as const,
  },
  title: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.body,
    marginBottom: Spacing['4xl'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  profileBtn: {
    alignItems: 'center',
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  role: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xxs,
  },
});

const pinPromptStyles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: 14,
    fontSize: FontSize.icon,
    fontWeight: FontWeight.bold,
    letterSpacing: 12,
    width: 180,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 14,
    marginTop: Spacing.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  error: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
  },
  cancelText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});

const bannerStyles = StyleSheet.create({
  bar: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    borderTopWidth: 1,
    alignItems: 'center',
  },
  text: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
