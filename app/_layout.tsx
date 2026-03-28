/**
 * app/_layout.tsx — Root layout
 *
 * On mount, checks if vault path is configured.
 * If not → redirect to /setup.
 * If yes → proceed to /(tabs)/.
 *
 * Le <Stack> doit TOUJOURS monter dès le premier rendu pour que
 * expo-router puisse appliquer l'initialState des deep links (widget).
 */

import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
});

import React, { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { VaultProvider, useVault } from '../contexts/VaultContext';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from '../lib/scheduled-notifications';
import { ToastProvider } from '../contexts/ToastContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AIProvider } from '../contexts/AIContext';
import { ParentalControlsProvider } from '../contexts/ParentalControlsContext';
import { HelpProvider } from '../contexts/HelpContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LockScreen } from '../components/LockScreen';
import i18n, { loadSavedLanguage } from '../lib/i18n';

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
          <Text style={styles.errorTitle}>{i18n.t('errorBoundary.title')}</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message ?? i18n.t('errorBoundary.unknown')}
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <Text style={styles.errorButtonText}>{i18n.t('errorBoundary.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Auth lock overlay ──────────────────────────────────────────────────────
// Affiché par-dessus tout quand l'app est verrouillée.
// Doit être à l'intérieur de AuthProvider ET ThemeProvider.

function AuthLockOverlay() {
  const { isAuthenticated, isAuthEnabled, isReady } = useAuth();
  if (!isReady || !isAuthEnabled || isAuthenticated) return null;
  return <LockScreen />;
}

// ─── Deep link ──────────────────────────────────────────────────────────────
// expo-router gère les deep links nativement via useLinking.native.js :
// - Cold start : ExpoLinking.getLinkingURL() → initialState sur NavigationContainer
// - Warm start : Linking.addEventListener('url') → subscribe → navigation.dispatch
// Un listener manuel ici CONFLIT avec le handler intégré (double navigation).
// URL format widget : family-vault:///meals → extractExpoPathFromURL → "meals" → (tabs)/meals

// ─── Redirection onboarding ─────────────────────────────────────────────────
// Doit être DANS le VaultProvider pour réagir quand setVaultPath() est appelé
// depuis setup.tsx. Sinon hasVault reste false et Redirect boucle vers /setup.
function VaultRedirect({ langReady }: { langReady: boolean }) {
  const { vaultPath, isLoading } = useVault();
  // Attendre que le vault ait fini son init ET que la langue soit chargée
  if (!langReady || isLoading) return null;
  if (!vaultPath) return <Redirect href="/setup" />;
  return null;
}

function RootLayout() {
  const [langReady, setLangReady] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    configureNotifications();

    (async () => {
      await loadSavedLanguage();
      setLangReady(true);
    })();
  }, []);

  // Le Stack monte TOUJOURS dès le premier rendu pour que
  // expo-router puisse appliquer l'initialState du deep link (widget).
  // Le loading spinner est affiché PAR-DESSUS le Stack via position absolute.
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <VaultProvider>
            <AuthProvider>
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
                <VaultRedirect langReady={langReady} />
                {!langReady && (
                  <View style={[styles.loading, { backgroundColor: systemScheme === 'dark' ? '#0F172A' : '#F9FAFB' }]} pointerEvents="auto">
                    <ActivityIndicator size="large" color="#7C3AED" />
                  </View>
                )}
                <AuthLockOverlay />
              </ToastProvider>
              </ParentalControlsProvider>
              </HelpProvider>
              </AIProvider>
            </ThemeProvider>
            </AuthProvider>
          </VaultProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
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
