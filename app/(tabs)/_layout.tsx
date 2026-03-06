/**
 * (tabs)/_layout.tsx — Tab bar configuration + profile picker modal
 */

import { Tabs } from 'expo-router';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { useVault } from '../../hooks/useVault';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { profiles, activeProfile, setActiveProfile } = useVault();

  // Show profile picker when profiles are loaded but none is selected
  const showPicker = profiles.length > 0 && !activeProfile;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E7EB',
            borderTopWidth: 1,
            paddingBottom: 4,
            height: 60,
          },
          tabBarActiveTintColor: '#7C3AED',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
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
          name="meals"
          options={{
            title: 'Repas',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🍽️" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="loot"
          options={{
            title: 'Loot',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🎁" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Réglages',
            tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
          }}
        />
      </Tabs>

      {/* Profile picker modal — shown on first launch */}
      <Modal visible={showPicker} animationType="fade" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.card}>
            <Text style={pickerStyles.title}>👋 Qui es-tu ?</Text>
            <Text style={pickerStyles.subtitle}>Choisis ton profil pour commencer</Text>

            <View style={pickerStyles.grid}>
              {profiles.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={pickerStyles.profileBtn}
                  onPress={() => setActiveProfile(p.id)}
                  activeOpacity={0.7}
                >
                  <Text style={pickerStyles.avatar}>{p.avatar}</Text>
                  <Text style={pickerStyles.name}>{p.name}</Text>
                  <Text style={pickerStyles.role}>
                    {p.role === 'adulte' ? '👤 Adulte' : '👶 Enfant'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    backgroundColor: '#FFFFFF',
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
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
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
    backgroundColor: '#F3F4F6',
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
    color: '#111827',
  },
  role: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
