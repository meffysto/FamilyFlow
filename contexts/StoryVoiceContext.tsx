/**
 * StoryVoiceContext.tsx — Configuration voix TTS pour Histoires du soir
 * Pattern: AIContext.tsx (SecureStore + useState)
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { StoryVoiceConfig } from '../lib/types';
import { ELEVENLABS_FRENCH_VOICES } from '../lib/stories';

const VOICE_CONFIG_KEY = 'story_voice_config';
const ELEVENLABS_KEY_STORAGE = 'story_elevenlabs_key';

const DEFAULT_VOICE_CONFIG: StoryVoiceConfig = {
  engine: 'expo-speech',
  language: 'fr',
  elevenLabsVoiceId: ELEVENLABS_FRENCH_VOICES[0].id,
};

interface StoryVoiceState {
  voiceConfig: StoryVoiceConfig;
  elevenLabsKey: string;
  isElevenLabsConfigured: boolean;
  setVoiceConfig: (config: StoryVoiceConfig) => Promise<void>;
  setElevenLabsKey: (key: string) => Promise<void>;
  clearElevenLabsKey: () => Promise<void>;
}

const StoryVoiceContext = createContext<StoryVoiceState | null>(null);

export function StoryVoiceProvider({ children }: { children: React.ReactNode }) {
  const [voiceConfig, setVoiceConfigState] = useState<StoryVoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [elevenLabsKey, setElevenLabsKeyState] = useState('');

  useEffect(() => {
    (async () => {
      const [stored, storedKey] = await Promise.all([
        SecureStore.getItemAsync(VOICE_CONFIG_KEY),
        SecureStore.getItemAsync(ELEVENLABS_KEY_STORAGE),
      ]);
      if (stored) {
        try { setVoiceConfigState(JSON.parse(stored)); } catch { /* ignore */ }
      }
      if (storedKey) setElevenLabsKeyState(storedKey);
    })();
  }, []);

  const setVoiceConfig = useCallback(async (config: StoryVoiceConfig) => {
    await SecureStore.setItemAsync(VOICE_CONFIG_KEY, JSON.stringify(config));
    setVoiceConfigState(config);
  }, []);

  const setElevenLabsKey = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      await SecureStore.setItemAsync(ELEVENLABS_KEY_STORAGE, trimmed);
    } else {
      await SecureStore.deleteItemAsync(ELEVENLABS_KEY_STORAGE);
    }
    setElevenLabsKeyState(trimmed);
  }, []);

  const clearElevenLabsKey = useCallback(async () => {
    await SecureStore.deleteItemAsync(ELEVENLABS_KEY_STORAGE);
    setElevenLabsKeyState('');
  }, []);

  const value: StoryVoiceState = {
    voiceConfig,
    elevenLabsKey,
    isElevenLabsConfigured: elevenLabsKey.length > 0,
    setVoiceConfig,
    setElevenLabsKey,
    clearElevenLabsKey,
  };

  return <StoryVoiceContext.Provider value={value}>{children}</StoryVoiceContext.Provider>;
}

export function useStoryVoice(): StoryVoiceState {
  const ctx = useContext(StoryVoiceContext);
  if (!ctx) throw new Error('useStoryVoice doit être utilisé dans un StoryVoiceProvider');
  return ctx;
}
