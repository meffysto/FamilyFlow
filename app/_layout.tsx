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
import { VAULT_PATH_KEY } from '../contexts/VaultContext';
import { VaultProvider } from '../contexts/VaultContext';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from '../lib/scheduled-notifications';
import { ToastProvider } from '../contexts/ToastContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AIProvider } from '../contexts/AIContext';
import { ParentalControlsProvider } from '../contexts/ParentalControlsContext';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const systemScheme = useColorScheme();

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
      <View style={[styles.loading, { backgroundColor: systemScheme === 'dark' ? '#0F172A' : '#F9FAFB' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <VaultProvider>
          <ThemeProvider>
            <AIProvider>
            <ParentalControlsProvider>
            <ToastProvider>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="setup" />
                <Stack.Screen name="(tabs)" />
              </Stack>
              {!hasVault && <Redirect href="/setup" />}
            </ToastProvider>
            </ParentalControlsProvider>
            </AIProvider>
          </ThemeProvider>
        </VaultProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
