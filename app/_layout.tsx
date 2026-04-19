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
  tracesSampleRate: 0.02,
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
});

import React, { useEffect, useState } from 'react';
import { Redirect, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { VaultProvider, useVault } from '../contexts/VaultContext';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme, TouchableOpacity, DevSettings, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { configureNotifications } from '../lib/scheduled-notifications';
import { ToastProvider } from '../contexts/ToastContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AIProvider } from '../contexts/AIContext';
import { StoryVoiceProvider } from '../contexts/StoryVoiceContext';
import { ParentalControlsProvider } from '../contexts/ParentalControlsContext';
import { HelpProvider } from '../contexts/HelpContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LockScreen } from '../components/LockScreen';
import i18n, { loadSavedLanguage } from '../lib/i18n';
import { LightColors, DarkColors } from '../constants/colors';
import * as SecureStore from 'expo-secure-store';

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
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('onboarding_questionnaire_done').then((val) => {
      setOnboardingDone(val === '1');
    });
  }, []);

  // Attendre vault + langue + flag onboarding
  if (!langReady || isLoading || onboardingDone === null) return null;
  if (!vaultPath) {
    if (!onboardingDone) return <Redirect href="/onboarding" />;
    return <Redirect href="/setup" />;
  }
  return null;
}

function RootLayout() {
  const [langReady, setLangReady] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    if (__DEV__) {
      DevSettings.addMenuItem('▶ Start Hermes Profiler', () => {
        // @ts-ignore
        const hi = global.HermesInternal;
        console.log('[Profiler] HermesInternal keys:', hi ? Object.keys(hi) : 'N/A');
        // @ts-ignore
        hi?.enableSamplingProfiler?.(true);
        console.log('[Profiler] Started — attends 10-15s puis stoppe');
      });
      DevSettings.addMenuItem('🌱 Start Mascotte (auto stage)', async () => {
        const { startMascotte } = await import('@/lib/mascotte-live-activity');
        const ok = await startMascotte({
          mascotteName: 'Pousse',
          tasksDone: 2,
          tasksTotal: 5,
          xpGained: 15,
          currentMeal: 'Pâtes carbo',
        });
        console.log('[Mascotte] Started:', ok);
      });
      const cycleStages: ('reveil'|'travail'|'midi'|'jeu'|'routine'|'dodo')[] =
        ['reveil', 'travail', 'midi', 'jeu', 'routine', 'dodo'];
      let stageIdx = 0;
      DevSettings.addMenuItem('🔁 Cycle Stage (dev)', async () => {
        const { startMascotte, refreshMascotte, isMascotteActive } = await import('@/lib/mascotte-live-activity');
        const stage = cycleStages[stageIdx % cycleStages.length];
        stageIdx++;
        const snap = {
          mascotteName: 'Pousse',
          tasksDone: stageIdx,
          tasksTotal: 6,
          xpGained: stageIdx * 12,
          currentMeal: 'Pâtes carbo',
          stageOverride: stage,
        } as const;
        const active = await isMascotteActive();
        if (active) await refreshMascotte(snap);
        else await startMascotte(snap);
        console.log('[Mascotte] Stage →', stage);
      });
      DevSettings.addMenuItem('🛑 Stop Mascotte', async () => {
        const { stopMascotte } = await import('@/lib/mascotte-live-activity');
        await stopMascotte();
        console.log('[Mascotte] Stopped');
      });
      DevSettings.addMenuItem('⏹ Stop Hermes Profiler', async () => {
        const path = `${FileSystem.documentDirectory}hermes-${Date.now()}.cpuprofile`;
        const bare = path.replace('file://', '');
        // @ts-ignore
        const hi = global.HermesInternal;
        console.log('[Profiler] Stop — keys:', hi ? Object.keys(hi) : 'N/A');
        try {
          // @ts-ignore
          const r = hi?.dumpSampledTraceToFile?.(bare);
          console.log('[Profiler] dumpSampledTraceToFile returned:', r);
        } catch (e) { console.warn('[Profiler] dump threw', e); }
        // @ts-ignore
        hi?.enableSamplingProfiler?.(false);
        console.log('[Profiler] Dumped to', bare);
        try {
          await new Promise(r => setTimeout(r, 2000));
          const info = await FileSystem.getInfoAsync(path);
          console.log('[Profiler] File info:', JSON.stringify(info));
          if (!info.exists) { console.warn('[Profiler] File not created — did you Start?'); return; }
          const content = await FileSystem.readAsStringAsync(path);
          console.log('[Profiler] Read', content.length, 'chars, uploading…');
          const res = await fetch('http://192.168.1.3:8089/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: content,
          });
          console.log('[Profiler] Upload status:', res.status);
        } catch (e) {
          console.warn('[Profiler] Upload failed:', e);
        }
      });
    }
    configureNotifications();

    // Cold start : récupérer la dernière notif tappée si l'app a été lancée par notif (Pitfall 7)
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        const route = resp?.notification.request.content.data?.route;
        if (typeof route === 'string') {
          // Délai léger pour laisser expo-router monter le Stack
          setTimeout(() => router.push(route as any), 0);
        }
      })
      .catch(() => {
        /* idempotent — silent */
      });

    // Warm start : listener pour notifs reçues pendant que l'app est vivante
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === 'string') {
        router.push(route as any);
      }
    });

    (async () => {
      await loadSavedLanguage();
      setLangReady(true);
    })();

    return () => sub.remove();
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
              <StoryVoiceProvider>
              <HelpProvider>
              <ParentalControlsProvider>
              <ToastProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="setup" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
                <VaultRedirect langReady={langReady} />
                {!langReady && (
                  <View style={[styles.loading, { backgroundColor: systemScheme === 'dark' ? DarkColors.bg : LightColors.cardAlt }]} pointerEvents="auto">
                    <ActivityIndicator size="large" color="#7C3AED" />
                  </View>
                )}
                <AuthLockOverlay />
              </ToastProvider>
              </ParentalControlsProvider>
              </HelpProvider>
              </StoryVoiceProvider>
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
    backgroundColor: LightColors.cardAlt,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: LightColors.textSub,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: LightColors.textMuted,
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
    color: LightColors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
