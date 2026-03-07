/**
 * app/_layout.tsx — Root layout
 *
 * On mount, checks if vault path is configured.
 * If not → redirect to /setup.
 * If yes → proceed to /(tabs)/.
 */

import { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import { VAULT_PATH_KEY } from '../hooks/useVault';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { configureNotifications } from '../lib/scheduled-notifications';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasVault, setHasVault] = useState(false);

  useEffect(() => {
    // Configure notification handler at app startup
    configureNotifications();

    (async () => {
      const stored = await SecureStore.getItemAsync(VAULT_PATH_KEY);
      setHasVault(!!stored);
      setIsReady(true);
    })();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="setup" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {!hasVault && <Redirect href="/setup" />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
});
