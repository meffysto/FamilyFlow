/**
 * FullscreenStoryReader — Modal lecture immersive d'une histoire (mode picture-book).
 *
 * Présente l'histoire plein écran sans chrome (header / tab bar) — uniquement
 * StoryBody scrollable + un StoryPlayer compact en bas pour les contrôles audio.
 * Bouton ✕ overlay top-right pour fermer.
 *
 * Le StoryPlayer monté ici hit le cache disque MP3 (lib/elevenlabs.ts:208) — il
 * NE consomme PAS de crédits ElevenLabs supplémentaires tant que (storyId, voiceId,
 * model) sont identiques au player inline qui a déjà généré l'audio.
 *
 * Le caller doit s'assurer que le player inline reçoit `forceMute=true` pendant
 * que ce modal est ouvert pour éviter la cacophonie audio.
 */
import React from 'react';
import { Modal, View, Pressable, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoryBody } from './StoryBody';
import StoryPlayer from './StoryPlayer';
import type { BedtimeStory, StoryAudioAlignment, StoryVoiceConfig } from '../../lib/types';

const READER_BG = '#F5EFE0'; // cream — couleur de page papier

interface Props {
  histoire: BedtimeStory | null;
  voiceConfig: StoryVoiceConfig;
  elevenLabsKey: string;
  fishAudioKey?: string;
  onClose: () => void;
  /** Persisté par le parent dès que l'alignement TTS est généré côté player */
  onAlignmentReady?: (alignment: StoryAudioAlignment) => void;
}

export function FullscreenStoryReader({
  histoire,
  voiceConfig,
  elevenLabsKey,
  fishAudioKey = '',
  onClose,
  onAlignmentReady,
}: Props) {
  const insets = useSafeAreaInsets();
  const visible = histoire !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Bouton ✕ overlay — au-dessus du contenu pour rester accessible
            quel que soit le scroll position. */}
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer la lecture immersive"
          hitSlop={12}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>

        {histoire && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <StoryBody histoire={histoire} />
            <View style={styles.playerWrap}>
              <StoryPlayer
                histoire={histoire}
                voiceConfig={voiceConfig}
                elevenLabsKey={elevenLabsKey}
                fishAudioKey={fishAudioKey}
                onFinish={onClose}
                autoGenerate={false /* le player inline a déjà généré — on hit le cache disque */}
                onAlignmentReady={onAlignmentReady}
              />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: READER_BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  playerWrap: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(44, 62, 80, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 18,
    color: '#2C3E50',
    fontWeight: '600',
    lineHeight: 18,
  },
});
