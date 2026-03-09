/**
 * (tabs)/_layout.tsx — Tab bar configuration + profile picker modal + ThemeProvider
 */

import { Tabs } from 'expo-router';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { useVault } from '../../hooks/useVault';
import { ThemeProvider, useThemeColors } from '../../contexts/ThemeContext';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

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
  const { primary, colors } = useThemeColors();
  const showPicker = profiles.length > 0 && !activeProfile;

  return (
    <View style={{ flex: 1 }}>
      <VacationBanner vacationConfig={vacationConfig} isVacationActive={isVacationActive} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 1,
            paddingBottom: 6,
            height: 70,
          },
          tabBarActiveTintColor: primary,
          tabBarInactiveTintColor: colors.tabBarOff,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 2,
          },
        }}
      >
        {/* ── 5 visible tabs ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Aujourd'hui",
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tâches',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: 'Journal',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="photos"
          options={{
            title: 'Photos',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📸" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'Menu',
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
      </Tabs>

      {/* Profile picker modal — shown on first launch */}
      <Modal visible={showPicker} animationType="fade" transparent statusBarTranslucent>
        <View style={pickerStyles.overlay}>
          <View style={[pickerStyles.card, { backgroundColor: colors.card }]}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>👋 Qui es-tu ?</Text>
            <Text style={[pickerStyles.subtitle, { color: colors.textMuted }]}>Choisis ton profil pour commencer</Text>

            <View style={pickerStyles.grid}>
              {profiles.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[pickerStyles.profileBtn, { backgroundColor: colors.cardAlt }]}
                  onPress={() => setActiveProfile(p.id)}
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function TabsLayout() {
  const { profiles, activeProfile, setActiveProfile, vacationConfig, isVacationActive } = useVault();

  return (
    <ThemeProvider themeId={activeProfile?.theme}>
      <ThemedTabsContent
        profiles={profiles}
        activeProfile={activeProfile}
        setActiveProfile={setActiveProfile}
        vacationConfig={vacationConfig}
        isVacationActive={isVacationActive}
      />
    </ThemeProvider>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatar: {
    fontSize: 40,
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  role: {
    fontSize: 12,
    marginTop: 2,
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
    fontSize: 13,
    fontWeight: '600',
  },
});
