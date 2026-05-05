// app/story/[id].tsx — Route deep link family-vault://story/<id> (Phase 50, QR-02 + QR-03).
// Lookup story dans useVault() avec gate isLoading (race condition cold start).
// Fallback FR + retour bibliothèque si id introuvable.
// Autoplay audio activé pour UX scan QR enfant.
//
// Note : expo-router v6 gère cold + warm start nativement via useLinking.native.js
// (cf. app/_layout.tsx lignes 105-110). Aucun listener manuel requis ici.
// L'AuthLockOverlay (rendu globalement dans _layout.tsx) couvre déjà le cas
// app verrouillée — la route est rendue dessous et reprend après unlock.

import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useVault } from '../../contexts/VaultContext';
import { useStoryVoice } from '../../contexts/StoryVoiceContext';
import { useToast } from '../../contexts/ToastContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FullscreenStoryReader } from '../../components/stories/FullscreenStoryReader';

export default function StoryDeepLinkRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { stories, isLoading } = useVault();
  const { voiceConfig, elevenLabsKey, fishAudioKey } = useStoryVoice();
  const { showToast } = useToast();
  const { colors, primary } = useThemeColors();
  const [hasResolved, setHasResolved] = useState(false);

  const isReady = !isLoading;

  const histoire = useMemo(() => {
    if (!isReady || !id) return null;
    return stories.find((s) => s.id === id) ?? null;
  }, [stories, id, isReady]);

  // Gate isReady : on attend l'hydratation du vault avant de chercher l'histoire
  // (cold start scan QR → route monte avant que stories[] soit peuplé)
  useEffect(() => {
    if (!isReady) return;
    if (hasResolved) return;
    setHasResolved(true);
    if (!histoire) {
      if (__DEV__) console.warn('[story-deep-link] id introuvable :', id);
      showToast('Histoire introuvable', 'error');
      // Retour bibliothèque (les histoires vivent dans l'onglet journal)
      router.replace('/(tabs)/journal');
    }
  }, [isReady, hasResolved, histoire, id, showToast]);

  // Spinner pendant chargement vault OU avant résolution
  if (!isReady || !hasResolved) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }

  // Histoire introuvable : toast déjà émis + redirection en cours
  if (!histoire) return null;

  return (
    <FullscreenStoryReader
      histoire={histoire}
      voiceConfig={voiceConfig}
      elevenLabsKey={elevenLabsKey}
      fishAudioKey={fishAudioKey}
      autoplay
      onClose={() => router.replace('/(tabs)/journal')}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
