/**
 * story-settings.tsx — Préférences durables Histoires du soir (Phase B)
 *
 * Écran modal (pageSheet, drag-to-dismiss) accessible depuis le bouton ⚙️ du
 * header de l'écran Histoires. Permet de configurer par profil enfant les
 * préférences durables (voix, mode audio, multi-voix, langue, longueur par
 * défaut). Stocké dans `Profile.storyDefaults` (frontmatter famille.md).
 *
 * Le wizard quotidien préfille `voiceConfig` à partir de ces valeurs et n'expose
 * plus que les décisions variables (univers, thème, override longueur).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActionSheetIOS,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Spacing } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { STORY_LENGTHS, STORY_LENGTH_ORDER, ELEVENLABS_FRENCH_VOICES, ELEVENLABS_ENGLISH_VOICES } from '../lib/stories';
import type {
  Profile,
  StoryDefaults,
  StoryVoiceEngine,
  StoryAudioMode,
  StoryLength,
} from '../lib/types';

const ENGINE_LABELS: Record<StoryVoiceEngine, string> = {
  'expo-speech': '🆓 Système',
  'elevenlabs': '✨ ElevenLabs',
  'fish-audio': '🐟 Fish Audio',
};

const AUDIO_MODE_OPTIONS: { key: StoryAudioMode; emoji: string; label: string; hint: string }[] = [
  { key: 'off', emoji: '🔇', label: 'Off', hint: 'Voix seule' },
  { key: 'doux', emoji: '🌙', label: 'Doux', hint: 'Ambiance' },
  { key: 'spectacle', emoji: '🎭', label: 'Spectacle', hint: 'Ambiance + SFX' },
];

export default function StorySettingsScreen() {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { profiles, updateStoryDefaults } = useVault();

  const childProfiles = useMemo(
    () => profiles.filter((p: Profile) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );
  const adultProfiles = useMemo(
    () => profiles.filter((p: Profile) => p.role === 'adulte'),
    [profiles],
  );

  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    childProfiles[0]?.id ?? null,
  );

  const selectedChild = useMemo(
    () => childProfiles.find(p => p.id === selectedChildId) ?? null,
    [childProfiles, selectedChildId],
  );

  const defaults: StoryDefaults = selectedChild?.storyDefaults ?? {};

  const persist = useCallback(async (next: StoryDefaults) => {
    if (!selectedChild) return;
    Haptics.selectionAsync();
    const merged: StoryDefaults = { ...defaults, ...next };
    // Nettoyage : champs vides → undefined → seront filtrés à la sérialisation
    const cleaned: StoryDefaults = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    ) as StoryDefaults;
    try {
      await updateStoryDefaults(selectedChild.id, Object.keys(cleaned).length > 0 ? cleaned : null);
    } catch (e) {
      if (__DEV__) console.warn('[story-settings] updateStoryDefaults failed:', e);
    }
  }, [defaults, selectedChild, updateStoryDefaults]);

  const pickEngine = useCallback(() => {
    const engines: { key: StoryVoiceEngine; label: string }[] = [
      { key: 'expo-speech', label: '🆓 Système (gratuit, hors-ligne)' },
      { key: 'elevenlabs', label: '✨ ElevenLabs' },
      { key: 'fish-audio', label: '🐟 Fish Audio' },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...engines.map(e => e.label), 'Annuler'],
          cancelButtonIndex: engines.length,
          title: 'Moteur de voix',
        },
        idx => {
          if (idx < engines.length) {
            persist({ engine: engines[idx].key });
          }
        },
      );
    } else {
      const keys: StoryVoiceEngine[] = ['expo-speech', 'elevenlabs', 'fish-audio'];
      const cur = defaults.engine ?? 'expo-speech';
      const next = keys[(keys.indexOf(cur) + 1) % keys.length];
      persist({ engine: next });
    }
  }, [defaults.engine, persist]);

  const currentEngine: StoryVoiceEngine = defaults.engine ?? 'expo-speech';
  const currentLanguage: 'fr' | 'en' = defaults.language ?? 'fr';
  const currentAudioMode: StoryAudioMode = defaults.audioMode ?? 'off';
  const currentLength: StoryLength = defaults.defaultLength ?? 'moyenne';
  const elevenLabsVoices = currentLanguage === 'fr' ? ELEVENLABS_FRENCH_VOICES : ELEVENLABS_ENGLISH_VOICES;

  if (childProfiles.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
        <ScreenHeader
          title="Paramètres histoires"
          subtitle="Préférences par enfant"
          tint="rgba(126,90,107,0.10)"
          leading={
            <Pressable style={styles.closeBtn} onPress={() => router.back()} accessibilityLabel="Fermer">
              <Text style={[styles.closeText, { color: primary }]}>✕</Text>
            </Pressable>
          }
        />
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Ajoute d'abord un profil enfant pour configurer ses préférences d'histoires.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <ScreenHeader
        title="Paramètres histoires"
        subtitle="Préférences par enfant"
        tint="rgba(126,90,107,0.10)"
        leading={
          <Pressable style={styles.closeBtn} onPress={() => router.back()} accessibilityLabel="Fermer">
            <Text style={[styles.closeText, { color: primary }]}>✕</Text>
          </Pressable>
        }
      />

      {/* Sélecteur enfant */}
      <View style={[styles.childrenWrap, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childrenScroll}
        >
          {childProfiles.map(child => {
            const isSelected = selectedChildId === child.id;
            return (
              <Pressable
                key={child.id}
                style={[
                  styles.childChip,
                  {
                    backgroundColor: isSelected ? primary : colors.card,
                    borderColor: isSelected ? primary : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedChildId(child.id);
                }}
              >
                <Text style={styles.childAvatar}>{child.avatar}</Text>
                <Text style={[styles.childName, { color: isSelected ? '#fff' : colors.text }]}>
                  {child.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Moteur voix */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Moteur de voix</Text>
        <Pressable
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={pickEngine}
        >
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Moteur</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>{ENGINE_LABELS[currentEngine]}</Text>
          <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
        </Pressable>

        {/* Langue */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Langue</Text>
        <View style={styles.chipRow}>
          {(['fr', 'en'] as const).map(lang => {
            const isSelected = currentLanguage === lang;
            return (
              <Pressable
                key={lang}
                style={[
                  styles.choiceChip,
                  {
                    backgroundColor: isSelected ? primary : colors.card,
                    borderColor: isSelected ? primary : colors.border,
                  },
                ]}
                onPress={() => persist({ language: lang })}
              >
                <Text style={[styles.choiceLabel, { color: isSelected ? '#fff' : colors.text }]}>
                  {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Narrateur — adultes (ElevenLabs) */}
        {currentEngine === 'elevenlabs' && adultProfiles.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Narrateur</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[
                  styles.choiceChip,
                  {
                    backgroundColor: !defaults.voiceParentId && !defaults.elevenLabsVoiceId ? primary : colors.card,
                    borderColor: !defaults.voiceParentId && !defaults.elevenLabsVoiceId ? primary : colors.border,
                  },
                ]}
                onPress={() => persist({ voiceParentId: undefined, elevenLabsVoiceId: undefined })}
              >
                <Text style={[styles.choiceLabel, { color: !defaults.voiceParentId && !defaults.elevenLabsVoiceId ? '#fff' : colors.text }]}>
                  Auto
                </Text>
              </Pressable>
              {adultProfiles.map(parent => {
                const isSelected = defaults.voiceParentId === parent.id;
                return (
                  <Pressable
                    key={parent.id}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? primary : colors.card,
                        borderColor: isSelected ? primary : colors.border,
                      },
                    ]}
                    onPress={() => persist({ voiceParentId: parent.id, elevenLabsVoiceId: undefined })}
                  >
                    <Text style={styles.childAvatar}>{parent.avatar}</Text>
                    <Text style={[styles.choiceLabel, { color: isSelected ? '#fff' : colors.text }]}>
                      {parent.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              Voix ElevenLabs par défaut ({currentLanguage === 'fr' ? 'FR' : 'EN'})
            </Text>
            <View style={styles.chipRowWrap}>
              {elevenLabsVoices.map(v => {
                const isSelected = !defaults.voiceParentId && defaults.elevenLabsVoiceId === v.id;
                return (
                  <Pressable
                    key={v.id}
                    style={[
                      styles.voiceOption,
                      {
                        backgroundColor: isSelected ? `${primary}20` : colors.card,
                        borderColor: isSelected ? primary : colors.border,
                      },
                    ]}
                    onPress={() => persist({ elevenLabsVoiceId: v.id, voiceParentId: undefined })}
                  >
                    <Text style={[styles.voiceLabel, { color: colors.text }]} numberOfLines={2}>
                      {v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Narrateur — Fish Audio (parent uniquement) */}
        {currentEngine === 'fish-audio' && adultProfiles.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Narrateur</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[
                  styles.choiceChip,
                  {
                    backgroundColor: !defaults.voiceParentId ? primary : colors.card,
                    borderColor: !defaults.voiceParentId ? primary : colors.border,
                  },
                ]}
                onPress={() => persist({ voiceParentId: undefined })}
              >
                <Text style={[styles.choiceLabel, { color: !defaults.voiceParentId ? '#fff' : colors.text }]}>
                  Voix par défaut Fish
                </Text>
              </Pressable>
              {adultProfiles.filter(p => p.voiceFishAudioId).map(parent => {
                const isSelected = defaults.voiceParentId === parent.id;
                return (
                  <Pressable
                    key={parent.id}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? primary : colors.card,
                        borderColor: isSelected ? primary : colors.border,
                      },
                    ]}
                    onPress={() => persist({ voiceParentId: parent.id })}
                  >
                    <Text style={styles.childAvatar}>{parent.avatar}</Text>
                    <Text style={[styles.choiceLabel, { color: isSelected ? '#fff' : colors.text }]}>
                      {parent.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Mode audio */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Mode audio</Text>
        <View style={styles.audioRow}>
          {AUDIO_MODE_OPTIONS.map(m => {
            const isSelected = currentAudioMode === m.key;
            const disabled = m.key === 'spectacle' && currentEngine === 'expo-speech';
            return (
              <Pressable
                key={m.key}
                disabled={disabled}
                style={[
                  styles.audioChip,
                  {
                    backgroundColor: isSelected ? primary : colors.card,
                    borderColor: isSelected ? primary : colors.border,
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}
                onPress={() => persist({ audioMode: m.key })}
              >
                <Text style={styles.audioEmoji}>{m.emoji}</Text>
                <Text style={[styles.audioLabel, { color: isSelected ? '#fff' : colors.text }]}>
                  {m.label}
                </Text>
                <Text style={[styles.audioHint, { color: isSelected ? '#ffffffcc' : colors.textMuted }]}>
                  {m.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Multi-voix — ElevenLabs uniquement */}
        {currentEngine === 'elevenlabs' && (
          <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.toggleLabelWrap}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Multi-voix</Text>
              <Text style={[styles.toggleHint, { color: colors.textMuted }]}>
                Distribue les dialogues sur des voix de personnages
              </Text>
            </View>
            <Switch
              value={defaults.multiVoice ?? false}
              onValueChange={v => persist({ multiVoice: v })}
              trackColor={{ false: colors.border, true: primary }}
            />
          </View>
        )}

        {/* Longueur par défaut */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Longueur préférée</Text>
        <View style={styles.lengthRow}>
          {STORY_LENGTH_ORDER.map(key => {
            const cfg = STORY_LENGTHS[key];
            const isSelected = currentLength === key;
            return (
              <Pressable
                key={key}
                style={[
                  styles.lengthChip,
                  {
                    backgroundColor: isSelected ? primary : colors.card,
                    borderColor: isSelected ? primary : colors.border,
                  },
                ]}
                onPress={() => persist({ defaultLength: key })}
              >
                <Text style={styles.lengthEmoji}>{cfg.emoji}</Text>
                <Text style={[styles.lengthLabel, { color: isSelected ? '#fff' : colors.text }]}>
                  {cfg.label}
                </Text>
                <Text style={[styles.lengthDuration, { color: isSelected ? '#ffffffaa' : colors.textMuted }]}>
                  {cfg.duration}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Ces préférences préfillent le wizard. Tu pourras toujours ajuster la longueur au moment de lancer une histoire.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, fontWeight: FontWeight.semibold },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'] },
  emptyText: { fontSize: FontSize.body, textAlign: 'center', lineHeight: 22 },

  childrenWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  childrenScroll: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    marginRight: Spacing.sm,
    gap: Spacing.xs,
  },
  childAvatar: { fontSize: 18, marginRight: 4 },
  childName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },

  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowLabel: { fontSize: FontSize.sm },
  rowValue: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium, textAlign: 'right', marginRight: Spacing.sm },
  chevron: { fontSize: 18 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  choiceLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  voiceOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 160,
  },
  voiceLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  audioRow: { flexDirection: 'row', gap: Spacing.sm },
  audioChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
  },
  audioEmoji: { fontSize: 22, marginBottom: 4 },
  audioLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  audioHint: { fontSize: FontSize.micro, marginTop: 2 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.md,
  },
  toggleLabelWrap: { flex: 1 },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  toggleHint: { fontSize: FontSize.micro, marginTop: 2 },

  lengthRow: { flexDirection: 'row', gap: Spacing.sm },
  lengthChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: 14,
    borderWidth: 1,
  },
  lengthEmoji: { fontSize: 18, marginBottom: 4 },
  lengthLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  lengthDuration: { fontSize: FontSize.micro, marginTop: 2 },

  footer: {
    fontSize: FontSize.micro,
    textAlign: 'center',
    marginTop: Spacing['3xl'],
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },
});
