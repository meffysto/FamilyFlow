/**
 * (tabs)/_layout.tsx — Tab bar configuration + profile picker modal
 */

import { useEffect, useState, useCallback } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { FAB, FABAction } from '../../components/FAB';

import { GlassView } from '../../components/ui/GlassView';
import { FontSize, FontWeight } from '../../constants/typography';

const SPRING_CONFIG = { damping: 10, stiffness: 180 };

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const { tint } = useThemeColors();
  const scale = useSharedValue(focused ? 1 : 0);
  const iconScale = useSharedValue(focused ? 1.15 : 1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0, SPRING_CONFIG);
    iconScale.value = withSpring(focused ? 1.15 : 1, SPRING_CONFIG);
  }, [focused]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { translateY: focused ? -1 : 0 }],
  }));

  return (
    <View style={tabIconStyles.container}>
      <Animated.View style={[tabIconStyles.pill, { backgroundColor: tint }, pillStyle]} />
      <Animated.Text style={[tabIconStyles.emoji, emojiStyle]}>{emoji}</Animated.Text>
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  container: {
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16,
  },
  emoji: {
    fontSize: FontSize.title,
  },
});

interface ThemedTabsContentProps {
  profiles: ReturnType<typeof useVault>['profiles'];
  activeProfile: ReturnType<typeof useVault>['activeProfile'];
  setActiveProfile: ReturnType<typeof useVault>['setActiveProfile'];
}

function VacationBanner({ vacationConfig, isVacationActive }: {
  vacationConfig: ReturnType<typeof useVault>['vacationConfig'];
  isVacationActive: boolean;
}) {
  const { colors } = useThemeColors();
  if (!isVacationActive || !vacationConfig) return null;

  const now = Date.now();
  const end = new Date(vacationConfig.endDate + 'T23:59:59').getTime();
  const start = new Date(vacationConfig.startDate + 'T00:00:00').getTime();
  const daysLeft = now < start
    ? Math.ceil((start - now) / 86400000)
    : Math.ceil((end - now) / 86400000);
  const label = now < start
    ? `Départ dans ${daysLeft}j`
    : daysLeft <= 0 ? 'Dernier jour !' : `Fin dans ${daysLeft}j`;

  return (
    <View style={[bannerStyles.bar, { backgroundColor: colors.warningBg, borderTopColor: colors.warning }]}>
      <Text style={[bannerStyles.text, { color: colors.warningText }]}>☀️ Vacances — {label}</Text>
    </View>
  );
}

function ThemedTabsContent({ profiles, activeProfile, setActiveProfile, vacationConfig, isVacationActive }: ThemedTabsContentProps & {
  vacationConfig: ReturnType<typeof useVault>['vacationConfig'];
  isVacationActive: boolean;
}) {
  const { primary, colors, isDark } = useThemeColors();
  const { hasPin, authenticate, verifyPin, biometryAvailable } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
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
      setPinError('PIN incorrect');
      setPinInput('');
    }
  }, [pinInput, verifyPin, pendingProfileId, setActiveProfile]);

  const cancelPinPrompt = useCallback(() => {
    setPendingProfileId(null);
    setPinInput('');
    setPinError('');
  }, []);

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
        { id: 'task', emoji: '\u{1F4CB}', label: 'Tâche', onPress: () => router.push('/tasks?addNew=1') },
      ]
    : [
        { id: 'task', emoji: '\u{1F4CB}', label: 'Tâche', onPress: () => router.push('/tasks?addNew=1') },
        { id: 'rdv', emoji: '\u{1F4C5}', label: 'RDV', onPress: () => router.push('/rdv?addNew=1') },
        { id: 'journal', emoji: '\u{1F4D6}', label: 'Journal', onPress: () => router.push(`/journal?enfant=${lastEnfant}`) },
        { id: 'photo', emoji: '\u{1F4F8}', label: 'Photo', onPress: () => router.push('/photos?addNew=1') },
      ];

  return (
    <View style={{ flex: 1 }}>
      <VacationBanner vacationConfig={vacationConfig} isVacationActive={isVacationActive} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopColor: colors.glassBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingBottom: 6,
            height: 70,
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
            fontSize: FontSize.micro,
            fontWeight: FontWeight.semibold,
            marginBottom: 2,
          },
        }}
      >
        {/* ── 5 visible tabs ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.today'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: t('tabs.tasks'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: t('tabs.journal'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: t('tabs.calendar'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="📆" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('tabs.menu'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="🗂️" focused={focused} />,
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
        <Tabs.Screen name="quotes" options={{ href: null }} />
        <Tabs.Screen name="moods" options={{ href: null }} />
        <Tabs.Screen name="photos" options={{ href: null }} />
        <Tabs.Screen name="pregnancy" options={{ href: null }} />
        <Tabs.Screen name="skills" options={{ href: null }} />
        <Tabs.Screen name="night-mode" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>

      {showFAB && <FAB actions={fabActions} />}

      {/* Profile picker modal — shown on first launch */}
      <Modal visible={showPicker} animationType="fade" transparent statusBarTranslucent>
        <View style={pickerStyles.overlay}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <GlassView style={pickerStyles.card} intensity={50} borderRadius={24}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>👋 Qui es-tu ?</Text>
            <Text style={[pickerStyles.subtitle, { color: colors.textMuted }]}>Choisis ton profil pour commencer</Text>

            <View style={pickerStyles.grid}>
              {profiles.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[pickerStyles.profileBtn, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                  onPress={() => handleProfileSelect(p.id)}
                  activeOpacity={0.7}
                >
                  <Text style={pickerStyles.avatar}>{p.avatar}</Text>
                  <Text style={[pickerStyles.name, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[pickerStyles.role, { color: colors.textFaint }]}>
                    {p.role === 'adulte' ? '👤 Adulte' : '👶 Enfant'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassView>
        </View>
      </Modal>

      {/* PIN prompt modal — enfant → adulte */}
      <Modal visible={!!pendingProfileId} animationType="fade" transparent statusBarTranslucent>
        <View style={pickerStyles.overlay}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <GlassView style={pickerStyles.card} intensity={50} borderRadius={24}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>🔒 PIN parent</Text>
            <Text style={[pickerStyles.subtitle, { color: colors.textMuted }]}>
              Entre le PIN pour accéder au profil adulte
            </Text>

            <TextInput
              style={[pinPromptStyles.input, {
                backgroundColor: colors.inputBg,
                borderColor: pinError ? colors.error : colors.inputBorder,
                color: colors.text,
              }]}
              value={pinInput}
              onChangeText={(t) => {
                setPinError('');
                const cleaned = t.replace(/[^0-9]/g, '').slice(0, 4);
                setPinInput(cleaned);
                // Auto-submit quand 4 chiffres
                if (cleaned.length === 4) {
                  setTimeout(() => {
                    const ok = verifyPin(cleaned);
                    if (ok) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      if (pendingProfileId) setActiveProfile(pendingProfileId);
                      setPendingProfileId(null);
                      setPinInput('');
                      setPinError('');
                    } else {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      setPinError('PIN incorrect');
                      setPinInput('');
                    }
                  }, 100);
                }
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="• • • •"
              placeholderTextColor={colors.textFaint}
              textAlign="center"
              autoFocus
              accessibilityLabel="PIN parent"
            />

            {/* Dots visuels */}
            <View style={pinPromptStyles.dots}>
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

            <TouchableOpacity onPress={cancelPinPrompt} activeOpacity={0.7} style={pinPromptStyles.cancelBtn}>
              <Text style={[pinPromptStyles.cancelText, { color: colors.textMuted }]}>Annuler</Text>
            </TouchableOpacity>
          </GlassView>
        </View>
      </Modal>
    </View>
  );
}

export default function TabsLayout() {
  const { profiles, activeProfile, setActiveProfile, vacationConfig, isVacationActive } = useVault();
  const { setThemeId } = useThemeColors();
  // Sync le thème du profil actif avec le ThemeProvider racine
  useEffect(() => {
    setThemeId(activeProfile?.theme ?? '');
  }, [activeProfile?.theme, setThemeId]);

  return (
    <ThemedTabsContent
      profiles={profiles}
      activeProfile={activeProfile}
      setActiveProfile={setActiveProfile}
      vacationConfig={vacationConfig}
      isVacationActive={isVacationActive}
    />
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.body,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  profileBtn: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    width: 140,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    fontSize: 40,
    marginBottom: 8,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  role: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
});

const pinPromptStyles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 20,
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
    marginTop: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 9999,
    borderWidth: 2,
  },
  error: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});

const bannerStyles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  text: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
