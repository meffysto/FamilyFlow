/**
 * app/_layout.tsx — Root layout
 *
 * On mount, checks if vault path is configured.
 * If not → redirect to /setup.
 * If yes → proceed to /(tabs)/.
 */

import React, { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import { VAULT_PATH_KEY } from '../contexts/VaultContext';
import { VaultProvider } from '../contexts/VaultContext';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from '../lib/scheduled-notifications';
import { ToastProvider } from '../contexts/ToastContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AIProvider } from '../contexts/AIContext';
import { ParentalControlsProvider } from '../contexts/ParentalControlsContext';
import { HelpProvider } from '../contexts/HelpContext';

// ─── Error Boundary ──────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error('ErrorBoundary:', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>😵</Text>
          <Text style={styles.errorTitle}>Oups, quelque chose a planté</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message ?? 'Erreur inconnue'}
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={styles.errorButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

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
    <AppErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <VaultProvider>
            <ThemeProvider>
              <AIProvider>
              <HelpProvider>
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
              </HelpProvider>
              </AIProvider>
            </ThemeProvider>
          </VaultProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
