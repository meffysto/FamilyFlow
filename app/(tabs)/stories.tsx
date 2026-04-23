import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, ScrollView, Pressable,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert, Modal,
  ActionSheetIOS, Platform, useWindowDimensions,
} from 'react-native';
import * as Speech from 'expo-speech';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat,
  cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI } from '../../contexts/AIContext';
import { useStoryVoice } from '../../contexts/StoryVoiceContext';
import { useAnimConfig } from '../../hooks/useAnimConfig';
import StoryBookCard, { BOOK_WIDTH, BOOK_GAP } from '../../components/stories/StoryBookCard';
import StoryPlayer from '../../components/stories/StoryPlayer';
import VoiceRecorder from '../../components/stories/VoiceRecorder';
import { getPersonalVoices } from '../../lib/personal-voice';
import { getCachedStoryAudio } from '../../lib/elevenlabs';
import { getCachedStoryAudioFish } from '../../lib/fish-audio';
import {
  STORY_UNIVERSES, STORY_SUGGESTIONS, ELEVENLABS_FRENCH_VOICES, ELEVENLABS_ENGLISH_VOICES,
  STORY_LENGTHS, STORY_LENGTH_ORDER,
  storyFileName, pickSurpriseUniverse,
} from '../../lib/stories';
import { generateBedtimeStory } from '../../lib/ai-service';
import { buildAnonymizationMap, anonymize, deanonymize } from '../../lib/anonymizer';
import type { BedtimeStory, StoryUniverseId, StoryVoiceConfig, StoryVoiceEngine, StoryLength, Profile, Memory, ChildQuote } from '../../lib/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Types machine à états ──────────────────────────────────────────────────

type StoryFlowStep =
  | { etape: 'choisir_enfant' }
  | { etape: 'choisir_univers'; enfantId: string; enfantName: string }
  | { etape: 'personnaliser'; enfantId: string; enfantName: string; universId: StoryUniverseId }
  | { etape: 'generation'; enfantId: string; enfantName: string; universId: StoryUniverseId; detail: string; length: StoryLength }
  | { etape: 'fin'; histoire: BedtimeStory }
  | { etape: 'replay'; histoire: BedtimeStory };

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeAge(birthdate?: string): string {
  if (!birthdate) return '6 ans';
  try {
    const birth = new Date(birthdate + (birthdate.length === 4 ? '-01-01' : ''));
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear();
    return `${Math.max(1, age)} ans`;
  } catch {
    return '6 ans';
  }
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function StoriesScreen() {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { config: aiConfig, storyConfig } = useAI();
  const { voiceConfig, elevenLabsKey, isElevenLabsConfigured, fishAudioKey, isFishAudioConfigured, setVoiceConfig } = useStoryVoice();
  const { reduceMotion } = useAnimConfig();
  const { width: screenWidth } = useWindowDimensions();
  const {
    profiles, moods, quotes, memories, rdvs, healthRecords, tasks, stories, saveStory, deleteStory, updateProfile,
  } = useVault();

  // Profils adultes — narrateurs disponibles
  const adultProfiles = React.useMemo(
    () => profiles.filter((p: Profile) => p.role === 'adulte'),
    [profiles],
  );

  const [step, setStep] = useState<StoryFlowStep>({ etape: 'choisir_enfant' });
  const [selectedUniversId, setSelectedUniversId] = useState<StoryUniverseId | null>(null);
  const [detailText, setDetailText] = useState('');

  // ── Carousel livres (ChoisirUniversStep) ────────────────────────────────────
  // Défini ici pour éviter le remount du FlatList quand selectedUniversId change
  const bookListRef = useRef<FlatList>(null);
  const SNAP_INTERVAL = BOOK_WIDTH + BOOK_GAP;
  const bookHorizontalPadding = (screenWidth - BOOK_WIDTH) / 2;

  const handleBookSnap = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    const universe = STORY_UNIVERSES[Math.max(0, Math.min(index, STORY_UNIVERSES.length - 1))];
    if (!universe) return;
    setSelectedUniversId(universe.id);
    Haptics.selectionAsync();
  }, [SNAP_INTERVAL]);

  const handleBookPress = useCallback((u: typeof STORY_UNIVERSES[0]) => {
    setSelectedUniversId(u.id);
    const idx = STORY_UNIVERSES.indexOf(u);
    bookListRef.current?.scrollToOffset({ offset: idx * SNAP_INTERVAL, animated: true });
  }, [SNAP_INTERVAL]);
  const confettiRef = useRef<any>(null);

  // ─── États sélecteur voix (PersonnaliserStep) ────────────────────────────
  // Onglet moteur affiché : 'expo-speech' | 'elevenlabs'
  // Le tab "Système" expose à la fois la voix par défaut et les voix Enhanced/Premium
  // (Audrey, Thomas, Aurélie… en FR), filtrées par langue courante.
  const [localVoiceEngine, setLocalVoiceEngine] = useState<'expo-speech' | 'elevenlabs' | 'fish-audio'>(
    voiceConfig.engine,
  );
  const [voiceSelectedParentId, setVoiceSelectedParentId] = useState<string | null>(null);
  const [voiceSelectedPersonalVoice, setVoiceSelectedPersonalVoice] = useState<Speech.Voice | null>(null);
  const [voicePersonalVoices, setVoicePersonalVoices] = useState<Speech.Voice[]>([]);
  const [voicePersonalLoading, setVoicePersonalLoading] = useState(false);
  const [voiceRecorderProfileId, setVoiceRecorderProfileId] = useState<string | null>(null);

  // Auto-fetch des voix Enhanced/Premium à l'entrée de l'étape personnaliser
  // et à chaque changement de langue. Re-fetch explicite via bouton "Rafraîchir".
  useEffect(() => {
    if (step.etape !== 'personnaliser') return;
    if (localVoiceEngine !== 'expo-speech') return;
    let cancelled = false;
    setVoicePersonalLoading(true);
    getPersonalVoices(voiceConfig.language).then(vs => {
      if (cancelled) return;
      setVoicePersonalVoices(vs);
      setVoicePersonalLoading(false);
    });
    return () => { cancelled = true; };
  }, [step.etape, localVoiceEngine, voiceConfig.language]);

  // Réhydrater la voix sélectionnée depuis le voiceIdentifier persisté
  // une fois la liste chargée.
  useEffect(() => {
    if (!voiceConfig.voiceIdentifier || voicePersonalVoices.length === 0) return;
    const match = voicePersonalVoices.find(v => v.identifier === voiceConfig.voiceIdentifier);
    if (match && match.identifier !== voiceSelectedPersonalVoice?.identifier) {
      setVoiceSelectedPersonalVoice(match);
    }
  }, [voicePersonalVoices, voiceConfig.voiceIdentifier, voiceSelectedPersonalVoice?.identifier]);

  const refreshPersonalVoices = useCallback(async () => {
    Haptics.selectionAsync();
    setVoicePersonalLoading(true);
    const vs = await getPersonalVoices(voiceConfig.language);
    setVoicePersonalVoices(vs);
    setVoicePersonalLoading(false);
  }, [voiceConfig.language]);

  // ─── Sélection contexte (inclusions utilisateur dans PersonnaliserStep) ──
  // Par défaut, seul le plus récent de chaque catégorie est coché.
  // L'utilisateur peut ouvrir une catégorie pour voir et cocher d'autres éléments.
  const [moodIncluded, setMoodIncluded] = useState(true);
  const [selectedQuoteKeys, setSelectedQuoteKeys] = useState<Set<string>>(new Set());
  const [selectedMemoryKeys, setSelectedMemoryKeys] = useState<Set<string>>(new Set());
  const [quotesExpanded, setQuotesExpanded] = useState(false);
  const [memoriesExpanded, setMemoriesExpanded] = useState(false);

  // Helpers clés uniques
  const quoteKey = useCallback((q: ChildQuote) => `${q.sourceFile}#${q.lineIndex}`, []);
  const memoryKey = useCallback((m: Memory) => `${m.enfant}|${m.date}|${m.title}`, []);

  // Init : quand on entre dans PersonnaliserStep, sélectionne automatiquement
  // le plus récent de chaque catégorie et replie les sections.
  const currentEnfantName = step.etape === 'personnaliser' ? step.enfantName : null;
  const currentEnfantId = step.etape === 'personnaliser' ? step.enfantId : null;

  useEffect(() => {
    if (!currentEnfantName || !currentEnfantId) return;

    // Humeur : cochée par défaut
    setMoodIncluded(true);

    // Perle : la plus récente
    const mostRecentQuote = quotes
      .filter(q => q.enfant === currentEnfantName)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    setSelectedQuoteKeys(mostRecentQuote ? new Set([quoteKey(mostRecentQuote)]) : new Set());

    // Souvenir : le plus récent dans la fenêtre 60 jours
    const cutoffDate = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const mostRecentMemory = memories
      .filter(m => m.enfant === currentEnfantName && m.date >= cutoffDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    setSelectedMemoryKeys(mostRecentMemory ? new Set([memoryKey(mostRecentMemory)]) : new Set());

    // Replier les sections
    setQuotesExpanded(false);
    setMemoriesExpanded(false);
  }, [currentEnfantName, currentEnfantId, quotes, memories, quoteKey, memoryKey]);

  // ─── Cache MP3 persistant : badge "🔊" sur les histoires précédentes ──────
  const [audioCacheMap, setAudioCacheMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (stories.length === 0) {
      setAudioCacheMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        stories.map(async (s) => {
          // Verifier le cache selon le moteur de la voix
          if (s.voice.engine === 'fish-audio' && s.voice.fishAudioReferenceId) {
            const cached = await getCachedStoryAudioFish(s.id, s.voice.fishAudioReferenceId);
            return [s.sourceFile, cached !== null] as const;
          }
          const voiceId = s.voice.elevenLabsVoiceId;
          if (!voiceId) return [s.sourceFile, false] as const;
          const cached = await getCachedStoryAudio(s.id, voiceId);
          return [s.sourceFile, cached !== null] as const;
        }),
      );
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      for (const [k, v] of results) map[k] = v;
      setAudioCacheMap(map);
    })();
    return () => { cancelled = true; };
  }, [stories]);

  // Cache de génération — évite de relancer l'IA si GenerationStep se remonte
  // (composant imbriqué redéfini à chaque re-render parent → React le démonte/remonte)
  const generationCacheRef = useRef<{
    titre: string; texte: string; story: BedtimeStory;
  } | null>(null);

  // Vider le cache quand on quitte l'étape génération
  useEffect(() => {
    if (step.etape !== 'generation') {
      generationCacheRef.current = null;
    }
  }, [step.etape]);

  // Transition animation
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  const goTo = useCallback((nextStep: StoryFlowStep) => {
    if (reduceMotion) {
      setStep(nextStep);
      return;
    }
    opacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setStep)(nextStep);
      translateY.value = 20;
      opacity.value = withTiming(1, { duration: 220 });
      translateY.value = withTiming(0, { duration: 220 });
    });
  }, [reduceMotion, opacity, translateY]);

  const goBack = useCallback(() => {
    switch (step.etape) {
      case 'choisir_univers':
        goTo({ etape: 'choisir_enfant' });
        break;
      case 'personnaliser':
        goTo({ etape: 'choisir_univers', enfantId: step.enfantId, enfantName: step.enfantName });
        break;
      case 'replay':
        goTo({ etape: 'choisir_enfant' });
        break;
      default:
        router.back();
    }
  }, [step, goTo, router]);

  const handleReplayStory = useCallback((story: BedtimeStory) => {
    Haptics.selectionAsync();
    goTo({ etape: 'replay', histoire: story });
  }, [goTo]);

  const handleDeleteStory = useCallback((story: BedtimeStory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Supprimer cette histoire ?',
      `« ${story.titre} » sera supprimée définitivement (fichier markdown + audio en cache).`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteStory(story.sourceFile).catch((e) => {
              if (__DEV__) console.warn('deleteStory failed:', e);
              Alert.alert('Erreur', 'Impossible de supprimer l\'histoire.');
            });
          },
        },
      ],
    );
  }, [deleteStory]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // ── Enfants disponibles ──
  const childProfiles = profiles.filter(
    p => (p.role === 'enfant' || p.role === 'ado') && p.statut !== 'grossesse',
  );

  // ── Étape 1 : Choisir l'enfant ──

  function ChoisirEnfantStep() {
    const lastMoodFor = (profileId: string) =>
      moods.filter(m => m.profileId === profileId).sort((a, b) => b.date.localeCompare(a.date))[0];

    if (childProfiles.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👶</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Ajoutez d'abord un profil enfant
          </Text>
        </View>
      );
    }

    const recentStories = stories.slice(0, 10);

    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Pour qui cette histoire ?</Text>
        <FlatList
          data={childProfiles}
          keyExtractor={p => p.id}
          numColumns={2}
          scrollEnabled={false}
          renderItem={({ item: p }) => {
            const mood = lastMoodFor(p.id);
            return (
              <Pressable
                style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedUniversId(null);
                  goTo({ etape: 'choisir_univers', enfantId: p.id, enfantName: p.name });
                }}
              >
                <Text style={styles.profileAvatar}>{p.avatar}</Text>
                <Text style={[styles.profileName, { color: colors.text }]}>{p.name}</Text>
                {mood && (
                  <Text style={[styles.profileBadge, { color: colors.textMuted }]}>
                    {['😢', '😐', '😊', '😄', '🤩'][mood.level - 1]}
                  </Text>
                )}
                <Text style={[styles.profileReady, { color: colors.textMuted }]}>🌙 Prêt pour dormir ?</Text>
              </Pressable>
            );
          }}
        />

        {recentStories.length > 0 && (
          <View style={{ marginTop: Spacing['4xl'] }}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              📚 Histoires précédentes
            </Text>
            {recentStories.map(story => {
              const univers = STORY_UNIVERSES.find(u => u.id === story.univers);
              const hasCachedAudio = audioCacheMap[story.sourceFile] === true;
              const [yyyy, mm, dd] = story.date.split('-');
              const dateFR = (yyyy && mm && dd) ? `${dd}/${mm}/${yyyy}` : story.date;
              return (
                <Pressable
                  key={story.sourceFile}
                  style={[styles.previousStoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleReplayStory(story)}
                  onLongPress={() => handleDeleteStory(story)}
                  delayLongPress={500}
                >
                  <Text style={styles.previousStoryEmoji}>{univers?.emoji ?? '📖'}</Text>
                  <View style={styles.previousStoryBody}>
                    <Text style={[styles.previousStoryTitle, { color: colors.text }]} numberOfLines={1}>
                      {story.titre}
                    </Text>
                    <Text style={[styles.previousStoryMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {story.enfant} · {dateFR}
                    </Text>
                  </View>
                  {hasCachedAudio && (
                    <View style={[styles.previousStoryBadge, { backgroundColor: `${primary}20` }]}>
                      <Text style={[styles.previousStoryBadgeText, { color: primary }]}>🔊</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            <Text style={[styles.previousStoryHint, { color: colors.textMuted }]}>
              Appuyer pour relire · Maintenir pour supprimer
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Étape 2 : Choisir l'univers ──
  // Appelée comme fonction (pas JSX) pour éviter le remount FlatList sur chaque setState

  function renderChoisirUniversStep({ enfantId, enfantName }: { enfantId: string; enfantName: string }) {
    const recentIds = stories
      .filter(s => s.enfantId === enfantId)
      .slice(0, 5)
      .map(s => s.univers);

    return (
      <View style={styles.universCarouselWrapper}>
        <FlatList
          ref={bookListRef}
          data={STORY_UNIVERSES}
          keyExtractor={u => u.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: bookHorizontalPadding }}
          ItemSeparatorComponent={() => <View style={{ width: BOOK_GAP }} />}
          style={styles.bookCarousel}
          onMomentumScrollEnd={handleBookSnap}
          renderItem={({ item: u }) => (
            <StoryBookCard
              universe={u}
              selected={selectedUniversId === u.id}
              onPress={() => handleBookPress(u)}
            />
          )}
        />
      </View>
    );
  }

  // Bouton Continuer spécifique à l'étape choisir_univers (hors ScrollView)
  function renderUniversContinuerButton({ enfantId, enfantName }: { enfantId: string; enfantName: string }) {
    const recentIds = stories
      .filter(s => s.enfantId === enfantId)
      .slice(0, 5)
      .map(s => s.univers);

    return (
      <View style={styles.universBottomBar}>
        <Pressable
          style={[
            styles.primaryButton,
            styles.primaryButtonFull,
            { backgroundColor: selectedUniversId ? primary : colors.border },
          ]}
          disabled={!selectedUniversId}
          onPress={() => {
            if (!selectedUniversId) return;
            const universId = selectedUniversId === 'surprise'
              ? pickSurpriseUniverse(recentIds)
              : selectedUniversId;
            goTo({ etape: 'personnaliser', enfantId, enfantName, universId });
          }}
        >
          <Text style={styles.primaryButtonText}>Continuer →</Text>
        </Pressable>
      </View>
    );
  }

  // ── Étape 3 : Personnaliser ──

  function PersonnaliserStep({ enfantId, enfantName, universId }: { enfantId: string; enfantName: string; universId: StoryUniverseId }) {
    // Doit matcher strictement GenerationStep : 1 humeur récente, 3 perles, 5 souvenirs sur 60j
    const latestMood = moods
      .filter(m => m.profileId === enfantId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const childQuotes = quotes
      .filter(q => q.enfant === enfantName)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    const cutoffDate = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const childMemories = memories
      .filter(m => m.enfant === enfantName && m.date >= cutoffDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    const voiceOptions = voiceConfig.language === 'fr' ? ELEVENLABS_FRENCH_VOICES : ELEVENLABS_ENGLISH_VOICES;

    const buildFinalVoiceConfig = (): StoryVoiceConfig => {
      const lang = voiceConfig.language;
      if (localVoiceEngine === 'elevenlabs') {
        if (voiceSelectedParentId) {
          const parent = adultProfiles.find((p: Profile) => p.id === voiceSelectedParentId);
          if (parent) {
            const BELLA_ID = 'EXAVITQu4vr4xnSDxMaL';
            const ADAM_ID = 'pNInz6obpgDQGcFmaJgB';
            const voiceId = parent.voiceElevenLabsId ?? (parent.gender === 'fille' ? BELLA_ID : ADAM_ID);
            return { engine: 'elevenlabs', language: lang, elevenLabsVoiceId: voiceId };
          }
        }
        return { engine: 'elevenlabs', language: lang, elevenLabsVoiceId: voiceConfig.elevenLabsVoiceId };
      }
      if (localVoiceEngine === 'fish-audio') {
        if (voiceSelectedParentId) {
          const parent = adultProfiles.find((p: Profile) => p.id === voiceSelectedParentId);
          if (parent?.voiceFishAudioId) {
            return { engine: 'fish-audio', language: lang, fishAudioReferenceId: parent.voiceFishAudioId };
          }
        }
        return { engine: 'fish-audio', language: lang, fishAudioReferenceId: voiceConfig.fishAudioReferenceId };
      }
      // expo-speech — voix Premium/Enhanced optionnelle (persistee si choisie)
      return {
        engine: 'expo-speech',
        language: lang,
        voiceIdentifier: voiceSelectedPersonalVoice?.identifier,
      };
    };

    const currentLength: StoryLength = voiceConfig.length ?? 'moyenne';

    const generate = (detail: string) => {
      if (!aiConfig) {
        Alert.alert('Claude non configuré', 'Configurez votre clé API Claude dans les paramètres.');
        return;
      }
      setVoiceConfig(buildFinalVoiceConfig());
      goTo({ etape: 'generation', enfantId, enfantName, universId, detail, length: currentLength });
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Personnalise l'histoire</Text>

        {/* Contexte vault — catégories (plus récent coché par défaut, ouvrir pour plus) */}
        {(latestMood || childQuotes.length > 0 || childMemories.length > 0) && (
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            Contexte pris en compte
          </Text>
        )}

        {/* ── Catégorie Humeur (un seul élément, toujours visible) ── */}
        {latestMood && (
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setMoodIncluded(v => !v); }}
            style={[
              styles.contextCard,
              {
                backgroundColor: colors.card,
                borderColor: moodIncluded ? primary : colors.border,
                borderStyle: moodIncluded ? 'solid' : 'dashed',
                opacity: moodIncluded ? 1 : 0.5,
              },
            ]}
          >
            <Text style={styles.contextCheck}>{moodIncluded ? '☑' : '☐'}</Text>
            <Text style={styles.contextEmoji}>
              {['😢', '😐', '😊', '😄', '🤩'][latestMood.level - 1]}
            </Text>
            <View style={styles.contextBody}>
              <Text style={[styles.contextTitle, { color: colors.text }]}>
                Humeur — niveau {latestMood.level}/5
              </Text>
              {latestMood.note && (
                <Text style={[styles.contextSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
                  « {latestMood.note} »
                </Text>
              )}
            </View>
          </Pressable>
        )}

        {/* ── Catégorie Perles (collapsible) ── */}
        {childQuotes.length > 0 && (() => {
          const visibleQuotes = quotesExpanded ? childQuotes : childQuotes.slice(0, 1);
          return (
            <View style={styles.contextCategory}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setQuotesExpanded(v => !v); }}
                style={[styles.contextCategoryHeader, { borderColor: colors.border }]}
              >
                <Text style={styles.contextCategoryEmoji}>💬</Text>
                <Text style={[styles.contextCategoryTitle, { color: colors.text }]}>
                  Perles récentes
                </Text>
                <Text style={[styles.contextCategoryCount, { color: primary }]}>
                  {selectedQuoteKeys.size}/{childQuotes.length}
                </Text>
                <Text style={[styles.contextCategoryChevron, { color: colors.textMuted }]}>
                  {quotesExpanded ? '▾' : '▸'}
                </Text>
              </Pressable>
              {visibleQuotes.map(q => {
                const key = quoteKey(q);
                const included = selectedQuoteKeys.has(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedQuoteKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      });
                    }}
                    style={[
                      styles.contextCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: included ? primary : colors.border,
                        borderStyle: included ? 'solid' : 'dashed',
                        opacity: included ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Text style={styles.contextCheck}>{included ? '☑' : '☐'}</Text>
                    <View style={styles.contextBody}>
                      <Text style={[styles.contextTitle, { color: colors.text }]} numberOfLines={2}>
                        « {q.citation} »
                      </Text>
                      {q.contexte && (
                        <Text style={[styles.contextSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                          {q.contexte}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
              {!quotesExpanded && childQuotes.length > 1 && (
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setQuotesExpanded(true); }}
                  style={styles.contextMoreLink}
                >
                  <Text style={[styles.contextMoreLinkText, { color: primary }]}>
                    + Voir {childQuotes.length - 1} autre{childQuotes.length - 1 > 1 ? 's' : ''}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })()}

        {/* ── Catégorie Souvenirs (collapsible, premières-fois distinguées) ── */}
        {childMemories.length > 0 && (() => {
          const visibleMemories = memoriesExpanded ? childMemories : childMemories.slice(0, 1);
          return (
            <View style={styles.contextCategory}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setMemoriesExpanded(v => !v); }}
                style={[styles.contextCategoryHeader, { borderColor: colors.border }]}
              >
                <Text style={styles.contextCategoryEmoji}>✨</Text>
                <Text style={[styles.contextCategoryTitle, { color: colors.text }]}>
                  Souvenirs récents
                </Text>
                <Text style={[styles.contextCategoryCount, { color: primary }]}>
                  {selectedMemoryKeys.size}/{childMemories.length}
                </Text>
                <Text style={[styles.contextCategoryChevron, { color: colors.textMuted }]}>
                  {memoriesExpanded ? '▾' : '▸'}
                </Text>
              </Pressable>
              {visibleMemories.map(m => {
                const key = memoryKey(m);
                const included = selectedMemoryKeys.has(key);
                const isPremiereFois = m.type === 'premières-fois';
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedMemoryKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      });
                    }}
                    style={[
                      styles.contextCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: included ? primary : colors.border,
                        borderStyle: included ? 'solid' : 'dashed',
                        opacity: included ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Text style={styles.contextCheck}>{included ? '☑' : '☐'}</Text>
                    <Text style={styles.contextEmoji}>{isPremiereFois ? '✨' : '💫'}</Text>
                    <View style={styles.contextBody}>
                      <Text style={[styles.contextTitle, { color: colors.text }]} numberOfLines={1}>
                        {isPremiereFois ? '1ʳᵉ fois : ' : ''}{m.title}
                      </Text>
                      {m.description && (
                        <Text style={[styles.contextSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
                          {m.description}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
              {!memoriesExpanded && childMemories.length > 1 && (
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setMemoriesExpanded(true); }}
                  style={styles.contextMoreLink}
                >
                  <Text style={[styles.contextMoreLinkText, { color: primary }]}>
                    + Voir {childMemories.length - 1} autre{childMemories.length - 1 > 1 ? 's' : ''}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })()}

        {/* Chips suggestions */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Un détail pour ce soir ?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {STORY_SUGGESTIONS.map(s => (
            <Pressable
              key={s}
              style={[styles.chip, { backgroundColor: detailText === s ? primary : colors.card, borderColor: colors.border }]}
              onPress={() => setDetailText(detailText === s ? '' : s)}
            >
              <Text style={[styles.chipText, { color: detailText === s ? '#fff' : colors.text }]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Input libre */}
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Ou écris un détail libre..."
          placeholderTextColor={colors.textMuted}
          value={detailText}
          onChangeText={setDetailText}
          maxLength={120}
          multiline
        />

        {/* Sélecteur taille histoire */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Durée de l'histoire</Text>
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
                onPress={() => {
                  Haptics.selectionAsync();
                  setVoiceConfig({ ...voiceConfig, length: key });
                }}
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

        {/* Sélecteur voix unifié */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Voix de narration</Text>

        {/* Sélecteur moteur (tap → ActionSheet) */}
        <Pressable
          style={[styles.voiceEnginePicker, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            const engines: { key: StoryVoiceEngine; label: string }[] = [
              { key: 'expo-speech', label: '🆓 Système (gratuit, hors-ligne)' },
              { key: 'elevenlabs', label: `✨ ElevenLabs${isElevenLabsConfigured ? '' : ' (clé non configurée)'}` },
              { key: 'fish-audio', label: `🐟 Fish Audio${isFishAudioConfigured ? '' : ' (clé non configurée)'}` },
            ];
            if (Platform.OS === 'ios') {
              ActionSheetIOS.showActionSheetWithOptions(
                { options: [...engines.map(e => e.label), 'Annuler'], cancelButtonIndex: engines.length, title: 'Moteur de voix' },
                (idx) => { if (idx < engines.length) { Haptics.selectionAsync(); setLocalVoiceEngine(engines[idx].key); } },
              );
            } else {
              // Fallback Android : cycle simple
              const keys: StoryVoiceEngine[] = ['expo-speech', 'elevenlabs', 'fish-audio'];
              const next = keys[(keys.indexOf(localVoiceEngine) + 1) % keys.length];
              Haptics.selectionAsync();
              setLocalVoiceEngine(next);
            }
          }}
        >
          <Text style={[styles.voiceEnginePickerLabel, { color: colors.textMuted }]}>Moteur</Text>
          <Text style={[styles.voiceEnginePickerValue, { color: colors.text }]}>
            {localVoiceEngine === 'expo-speech' ? '🆓 Système' : localVoiceEngine === 'elevenlabs' ? '✨ ElevenLabs' : '🐟 Fish Audio'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>›</Text>
        </Pressable>

        {/* Langue */}
        <View style={[styles.voiceEngineRow, { marginTop: Spacing.md }]}>
          {(['fr', 'en'] as const).map(lang => (
            <Pressable
              key={lang}
              style={[styles.voiceChip, { backgroundColor: voiceConfig.language === lang ? primary : colors.card, borderColor: colors.border }]}
              onPress={() => setVoiceConfig({ ...voiceConfig, language: lang })}
            >
              <Text style={[styles.chipText, { color: voiceConfig.language === lang ? '#fff' : colors.text }]}>
                {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ElevenLabs — profils adultes */}
        {localVoiceEngine === 'elevenlabs' && adultProfiles.length > 0 && (
          <View style={{ marginTop: Spacing.lg }}>
            <Text style={[styles.voiceSubLabel, { color: colors.textMuted }]}>Narrateur</Text>
            <View style={styles.voiceParentRow}>
              {adultProfiles.map((p: Profile) => {
                const BELLA_ID = 'EXAVITQu4vr4xnSDxMaL';
                const ADAM_ID = 'pNInz6obpgDQGcFmaJgB';
                const hasClone = !!p.voiceElevenLabsId;
                const fallbackLabel = p.gender === 'fille' ? 'Bella (auto)' : 'Adam (auto)';
                const isSelected = voiceSelectedParentId === p.id;
                return (
                  <View key={p.id} style={styles.voiceParentWrap}>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); setVoiceSelectedParentId(isSelected ? null : p.id); }}
                      style={[styles.voiceParentChip, { backgroundColor: isSelected ? primary : colors.card, borderColor: isSelected ? primary : colors.border }]}
                    >
                      <Text style={styles.voiceParentAvatar}>{p.avatar}</Text>
                      <Text style={[styles.voiceParentName, { color: isSelected ? '#fff' : colors.text }]}>{p.name}</Text>
                      <Text style={[styles.voiceParentBadge, { color: isSelected ? '#ffffffaa' : colors.textMuted }]}>
                        {hasClone ? '🎙 Clonée' : fallbackLabel}
                      </Text>
                    </Pressable>
                    {!hasClone && (
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVoiceRecorderProfileId(p.id); }}
                        style={[styles.voiceAddBtn, { borderColor: colors.border }]}
                        accessibilityLabel={`Créer la voix clonée de ${p.name}`}
                      >
                        <Text style={[styles.voiceAddBtnText, { color: primary }]}>+</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ElevenLabs — pas de profil adulte → voix génériques */}
        {localVoiceEngine === 'elevenlabs' && adultProfiles.length === 0 && (
          <View style={{ marginTop: Spacing.lg }}>
            {voiceOptions.map(v => (
              <Pressable
                key={v.id}
                style={[styles.voiceOption, { backgroundColor: voiceConfig.elevenLabsVoiceId === v.id ? `${primary}20` : colors.card, borderColor: voiceConfig.elevenLabsVoiceId === v.id ? primary : colors.border }]}
                onPress={() => setVoiceConfig({ ...voiceConfig, elevenLabsVoiceId: v.id })}
              >
                <Text style={{ color: colors.text, fontSize: FontSize.sm }}>{v.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Fish Audio — profils adultes avec clonage */}
        {localVoiceEngine === 'fish-audio' && adultProfiles.length > 0 && (
          <View style={{ marginTop: Spacing.lg }}>
            <Text style={[styles.voiceSubLabel, { color: colors.textMuted }]}>Narrateur</Text>
            <View style={styles.voiceParentRow}>
              {adultProfiles.map((p: Profile) => {
                const hasClone = !!p.voiceFishAudioId;
                const isSelected = voiceSelectedParentId === p.id;
                return (
                  <View key={p.id} style={styles.voiceParentWrap}>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); setVoiceSelectedParentId(isSelected ? null : p.id); }}
                      style={[styles.voiceParentChip, { backgroundColor: isSelected ? primary : colors.card, borderColor: isSelected ? primary : colors.border }]}
                    >
                      <Text style={styles.voiceParentAvatar}>{p.avatar}</Text>
                      <Text style={[styles.voiceParentName, { color: isSelected ? '#fff' : colors.text }]}>{p.name}</Text>
                      <Text style={[styles.voiceParentBadge, { color: isSelected ? '#ffffffaa' : colors.textMuted }]}>
                        {hasClone ? '🎙 Clonee' : 'Voix par defaut'}
                      </Text>
                    </Pressable>
                    {!hasClone && (
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVoiceRecorderProfileId(p.id); }}
                        style={[styles.voiceAddBtn, { borderColor: colors.border }]}
                        accessibilityLabel={`Creer la voix clonee de ${p.name}`}
                      >
                        <Text style={[styles.voiceAddBtnText, { color: primary }]}>+</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Fish Audio — pas de profil adulte → info */}
        {localVoiceEngine === 'fish-audio' && adultProfiles.length === 0 && (
          <View style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.md }}>
            <Text style={[{ color: colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' }]}>
              Fish Audio utilisera sa voix par defaut. Ajoutez un profil adulte pour cloner votre voix.
            </Text>
          </View>
        )}

        {/* Systeme — selecteur voix Enhanced/Premium filtrees par langue */}
        {localVoiceEngine === 'expo-speech' && (
          <View style={{ marginTop: Spacing.lg }}>
            <View style={styles.voicePremiumHeader}>
              <Text style={[styles.voiceSubLabel, { color: colors.textMuted, marginBottom: 0 }]}>
                Voix premium {voiceConfig.language === 'fr' ? 'françaises' : 'anglaises'}
              </Text>
              <Pressable
                onPress={refreshPersonalVoices}
                hitSlop={8}
                accessibilityLabel="Rafraîchir la liste des voix"
              >
                <Text style={[styles.voiceRefreshText, { color: primary }]}>↻ Rafraîchir</Text>
              </Pressable>
            </View>

            {/* Option « voix par défaut » (= laisser iOS choisir) */}
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setVoiceSelectedPersonalVoice(null); }}
              style={[
                styles.voiceOption,
                {
                  backgroundColor: voiceSelectedPersonalVoice === null ? `${primary}20` : colors.card,
                  borderColor: voiceSelectedPersonalVoice === null ? primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>
                Voix par défaut du système
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: FontSize.micro }}>
                Qualité standard · gratuit · hors-ligne
              </Text>
            </Pressable>

            {voicePersonalLoading ? (
              <ActivityIndicator color={primary} style={{ marginTop: Spacing.lg }} />
            ) : voicePersonalVoices.length === 0 ? (
              <View style={[styles.voiceEmptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.voiceEmptyTitle, { color: colors.text }]}>
                  Aucune voix premium installée
                </Text>
                <Text style={[styles.voiceEmptyText, { color: colors.textMuted }]}>
                  Téléchargez des voix haute qualité dans{'\n'}
                  <Text style={{ fontWeight: FontWeight.bold }}>Réglages › Accessibilité ›{'\n'}Contenu énoncé › Voix</Text>
                  {'\n\n'}
                  Cherchez <Text style={{ fontWeight: FontWeight.bold }}>Audrey</Text>, <Text style={{ fontWeight: FontWeight.bold }}>Thomas</Text> ou <Text style={{ fontWeight: FontWeight.bold }}>Aurélie</Text> (Premium), puis revenez ici et appuyez sur Rafraîchir.
                </Text>
              </View>
            ) : (
              voicePersonalVoices.map(v => {
                const isSelected = voiceSelectedPersonalVoice?.identifier === v.identifier;
                return (
                  <Pressable
                    key={v.identifier}
                    onPress={() => { Haptics.selectionAsync(); setVoiceSelectedPersonalVoice(isSelected ? null : v); }}
                    style={[styles.voiceOption, { backgroundColor: isSelected ? `${primary}20` : colors.card, borderColor: isSelected ? primary : colors.border }]}
                  >
                    <Text style={{ color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium }}>{v.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: FontSize.micro }}>
                      {v.language} · {v.quality === 'Enhanced' ? 'Enhanced (HD)' : v.quality}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* Modal VoiceRecorder */}
        <Modal
          visible={voiceRecorderProfileId !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setVoiceRecorderProfileId(null)}
        >
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={[styles.voiceModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.voiceModalTitle, { color: colors.text }]}>Créer votre voix</Text>
              <Pressable onPress={() => setVoiceRecorderProfileId(null)}>
                <Text style={[styles.voiceModalClose, { color: primary }]}>Fermer</Text>
              </Pressable>
            </View>
            {voiceRecorderProfileId !== null && (() => {
              const target = adultProfiles.find((p: Profile) => p.id === voiceRecorderProfileId);
              if (!target) return null;
              return (
                <VoiceRecorder
                  profileId={target.id}
                  profileName={target.name}
                  apiKey={localVoiceEngine === 'fish-audio' ? fishAudioKey : elevenLabsKey}
                  cloneEngine={localVoiceEngine === 'fish-audio' ? 'fish-audio' : 'elevenlabs'}
                  language={voiceConfig.language}
                  onVoiceReady={async (voiceId, source) => {
                    try {
                      const profileUpdate = source === 'fish-audio-cloned'
                        ? { voiceFishAudioId: voiceId, voiceSource: source }
                        : { voiceElevenLabsId: voiceId, voiceSource: source };
                      await updateProfile(target.id, profileUpdate);
                      setVoiceSelectedParentId(target.id);
                      setVoiceRecorderProfileId(null);
                    } catch (e) {
                      if (__DEV__) console.warn('updateProfile voix echoue :', e);
                      Alert.alert('Erreur', "Impossible d'enregistrer la voix sur le profil.");
                    }
                  }}
                />
              );
            })()}
          </View>
        </Modal>

        {/* Boutons */}
        <Pressable
          style={[styles.primaryButton, { backgroundColor: primary, marginTop: Spacing['4xl'] }]}
          onPress={() => generate(detailText.trim())}
        >
          <Text style={styles.primaryButtonText}>✨ Générer l'histoire</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={() => generate('')}>
          <Text style={[styles.ghostButtonText, { color: colors.textMuted }]}>Passer cette étape</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Étape 4 : Génération + Player ──

  function GenerationStep({ enfantId, enfantName, universId, detail, length }: { enfantId: string; enfantName: string; universId: StoryUniverseId; detail: string; length: StoryLength }) {
    const [fullText, setFullText] = useState('');
    const [displayedText, setDisplayedText] = useState('');
    const [storyTitle, setStoryTitle] = useState('');
    const [currentStory, setCurrentStory] = useState<BedtimeStory | null>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [showPlayer, setShowPlayer] = useState(false);

    // Étoiles animées (loading)
    const star1 = useSharedValue(0);
    const star2 = useSharedValue(0);
    const star3 = useSharedValue(0);

    const generate = useCallback(async () => {
      setGenError(null);
      if (!aiConfig) {
        setGenError('Claude non configuré. Configurez votre clé API dans les paramètres.');
        return;
      }

      const profile = profiles.find(p => p.id === enfantId);

      // Filtres alignés avec PersonnaliserStep (fenêtre 60 jours pour souvenirs)
      const cutoffDate = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

      const childMoods = moodIncluded
        ? moods
            .filter(m => m.profileId === enfantId)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 3)
        : [];
      const childQuotes = quotes
        .filter(q => q.enfant === enfantName)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3)
        .filter(q => selectedQuoteKeys.has(quoteKey(q)));
      const childMemories = memories
        .filter(m => m.enfant === enfantName && m.date >= cutoffDate)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .filter(m => selectedMemoryKeys.has(memoryKey(m)));

      const anonMap = buildAnonymizationMap(profiles, rdvs, healthRecords, memories, tasks);

      const resp = await generateBedtimeStory(storyConfig ?? aiConfig, {
        enfantAnon: anonymize(enfantName, anonMap),
        enfantAge: computeAge(profile?.birthdate),
        universId,
        universTitre: STORY_UNIVERSES.find(u => u.id === universId)?.titre ?? universId,
        detail: detail ? anonymize(detail, anonMap) : undefined,
        language: voiceConfig.language,
        length,
        context: {
          recentMoods: childMoods.map(m => ({ level: m.level, note: m.note ? anonymize(m.note, anonMap) : undefined, date: m.date })),
          recentQuotes: childQuotes.map(q => ({ citation: anonymize(q.citation, anonMap), contexte: q.contexte ? anonymize(q.contexte, anonMap) : undefined, date: q.date })),
          recentMemories: childMemories.map(m => ({ titre: anonymize(m.title, anonMap), description: m.description ? anonymize(m.description, anonMap) : undefined, date: m.date, type: m.type })),
          allergies: profile?.foodAllergies ?? [],
          gender: profile?.gender as 'garçon' | 'fille' | undefined,
        },
      });

      if (resp.error) {
        setGenError(resp.error);
        return;
      }

      let titre = 'Histoire du soir';
      let texte = resp.text;
      try {
        const parsed = JSON.parse(resp.text);
        titre = deanonymize(parsed.titre ?? titre, anonMap);
        texte = deanonymize(parsed.texte ?? texte, anonMap);
      } catch {
        texte = deanonymize(resp.text, anonMap);
      }

      setStoryTitle(titre);
      setFullText(texte);

      // Reveal progressif
      let i = 0;
      const timer = setInterval(() => {
        i += 4;
        setDisplayedText(texte.slice(0, i));
        if (i >= texte.length) {
          clearInterval(timer);
          setDisplayedText(texte);
          setShowPlayer(true);

          // Sauvegarder dans le vault
          const today = format(new Date(), 'yyyy-MM-dd');
          const story: BedtimeStory = {
            id: `${today}-${universId}`,
            titre,
            texte,
            enfant: enfantName,
            enfantId,
            univers: universId,
            detail: detail || undefined,
            date: today,
            duree_lecture: Math.round(texte.length / 15),
            voice: voiceConfig,
            length,
            version: 1,
            sourceFile: storyFileName(enfantName, today, universId),
          };
          generationCacheRef.current = { titre, texte, story };
          setCurrentStory(story);
          saveStory(story).catch(() => { /* non-critique */ });
        }
      }, 18);
    }, [enfantId, enfantName, universId, detail]);

    useEffect(() => {
      star1.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
      star2.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
      star3.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);

      // Si une génération existe déjà (remontage du composant), restaurer sans rappel IA
      if (generationCacheRef.current) {
        const cached = generationCacheRef.current;
        cancelAnimation(star1);
        cancelAnimation(star2);
        cancelAnimation(star3);
        setStoryTitle(cached.titre);
        setFullText(cached.texte);
        setDisplayedText(cached.texte);
        setCurrentStory(cached.story);
        setShowPlayer(true);
        return;
      }

      generate();

      return () => {
        cancelAnimation(star1);
        cancelAnimation(star2);
        cancelAnimation(star3);
      };
    }, []);

    const star1Style = useAnimatedStyle(() => ({
      opacity: 0.3 + star1.value * 0.7,
      transform: [{ scale: 0.8 + star1.value * 0.4 }],
    }));
    const star2Style = useAnimatedStyle(() => ({
      opacity: 0.3 + star2.value * 0.7,
      transform: [{ scale: 0.8 + star2.value * 0.3 }],
    }));
    const star3Style = useAnimatedStyle(() => ({
      opacity: 0.3 + star3.value * 0.7,
      transform: [{ scale: 0.8 + star3.value * 0.5 }],
    }));

    if (genError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>😔</Text>
          <Text style={[styles.errorText, { color: colors.text }]}>{genError}</Text>
          <Pressable style={[styles.primaryButton, { backgroundColor: primary }]} onPress={generate}>
            <Text style={styles.primaryButtonText}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }

    if (!fullText) {
      return (
        <View style={styles.loadingContainer}>
          <View style={styles.starsRow}>
            <Animated.Text style={[styles.starEmoji, star1Style]}>⭐</Animated.Text>
            <Animated.Text style={[styles.starEmoji, star2Style]}>✨</Animated.Text>
            <Animated.Text style={[styles.starEmoji, star3Style]}>🌟</Animated.Text>
          </View>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Écriture de l'histoire de {enfantName}...
          </Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {storyTitle ? (
          <Text style={[styles.storyTitle, { color: colors.text }]}>{storyTitle}</Text>
        ) : null}
        <Text style={[styles.storyText, { color: colors.text }]}>{displayedText}</Text>
        {showPlayer && currentStory && (
          <StoryPlayer
            histoire={currentStory}
            voiceConfig={voiceConfig}
            elevenLabsKey={elevenLabsKey}
            fishAudioKey={fishAudioKey}
            onFinish={() => goTo({ etape: 'fin', histoire: currentStory })}
          />
        )}
      </ScrollView>
    );
  }

  // ── Étape 5 : Fin ──

  function FinStep({ histoire }: { histoire: BedtimeStory }) {
    const [showPlayer, setShowPlayer] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => confettiRef.current?.start(), 100);
      return () => clearTimeout(timer);
    }, []);

    return (
      <View style={styles.finContainer}>
        <Text style={styles.finEmoji}>🌙</Text>
        <Text style={[styles.finTitle, { color: colors.text }]}>{histoire.titre}</Text>
        <Text style={[styles.finSub, { color: colors.textMuted }]}>Histoire sauvegardée ✨</Text>
        <Text style={[styles.finDuree, { color: colors.textMuted }]}>
          ~{Math.ceil(histoire.duree_lecture / 60)} min de lecture
        </Text>

        {showPlayer ? (
          <StoryPlayer
            histoire={histoire}
            voiceConfig={voiceConfig}
            elevenLabsKey={elevenLabsKey}
            fishAudioKey={fishAudioKey}
            onFinish={() => setShowPlayer(false)}
          />
        ) : (
          <>
            <Pressable style={[styles.primaryButton, { backgroundColor: primary }]} onPress={() => setShowPlayer(true)}>
              <Text style={styles.primaryButtonText}>▶ Relire</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: primary }]} onPress={() => {
              setSelectedUniversId(null);
              setDetailText('');
              goTo({ etape: 'choisir_enfant' });
            }}>
              <Text style={[styles.secondaryButtonText, { color: primary }]}>Nouvelle histoire</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => router.back()}>
              <Text style={[styles.ghostButtonText, { color: colors.textMuted }]}>Fermer</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  // ── Étape Replay (histoire déjà générée) ──

  function ReplayStep({ histoire }: { histoire: BedtimeStory }) {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.storyTitle, { color: colors.text }]}>{histoire.titre}</Text>
        <Text style={[styles.storyText, { color: colors.text }]}>{histoire.texte}</Text>
        <StoryPlayer
          histoire={histoire}
          voiceConfig={histoire.voice}
          elevenLabsKey={elevenLabsKey}
          fishAudioKey={fishAudioKey}
          onFinish={() => goTo({ etape: 'choisir_enfant' })}
          autoGenerate={false}
        />
      </ScrollView>
    );
  }

  // ── Rendu selon étape ──
  const renderContent = () => {
    switch (step.etape) {
      case 'choisir_enfant':
        return <ChoisirEnfantStep />;
      case 'choisir_univers':
        return renderChoisirUniversStep({ enfantId: step.enfantId, enfantName: step.enfantName });
      case 'personnaliser':
        return <PersonnaliserStep enfantId={step.enfantId} enfantName={step.enfantName} universId={step.universId} />;
      case 'generation':
        return <GenerationStep enfantId={step.enfantId} enfantName={step.enfantName} universId={step.universId} detail={step.detail} length={step.length} />;
      case 'fin':
        return <FinStep histoire={step.histoire} />;
      case 'replay':
        return <ReplayStep histoire={step.histoire} />;
    }
  };

  // ── Rendu global ──

  const STEP_TITLES: Record<string, string> = {
    choisir_enfant: 'Histoires du soir',
    choisir_univers: "Choisir l'univers",
    personnaliser: 'Personnaliser',
    generation: 'Votre histoire',
    fin: 'Bonne nuit ! 🌙',
    replay: 'Relire',
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {step.etape !== 'choisir_enfant' && step.etape !== 'fin' && (
          <Pressable style={styles.backButton} onPress={goBack} accessibilityLabel="Retour">
            <Text style={[styles.backText, { color: primary }]}>‹</Text>
          </Pressable>
        )}
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {STEP_TITLES[step.etape] ?? 'Histoires du soir'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Confettis */}
      <ConfettiCannon
        ref={confettiRef}
        count={120}
        origin={{ x: 200, y: 0 }}
        fadeOut
        autoStart={false}
        explosionSpeed={400}
        fallSpeed={2500}
      />

      {/* Contenu animé */}
      <Animated.View style={[styles.content, animStyle]}>
        {step.etape === 'choisir_univers' ? (
          <>
            {renderChoisirUniversStep({ enfantId: step.enfantId, enfantName: step.enfantName })}
            {renderUniversContinuerButton({ enfantId: step.enfantId, enfantName: step.enfantName })}
          </>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderContent()}
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing['4xl'], paddingVertical: Spacing['2xl'], borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 36, alignItems: 'flex-start' },
  backText: { fontSize: 30, lineHeight: 34 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  headerRight: { width: 36 },
  content: { flex: 1 },
  scrollContent: { padding: Spacing['4xl'], paddingBottom: Spacing['6xl'] },
  stepTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold, marginBottom: Spacing['4xl'] },
  bookCarousel: { marginHorizontal: -Spacing['2xl'], paddingVertical: 40, overflow: 'visible' },
  universCarouselWrapper: { flex: 1, justifyContent: 'center', paddingTop: 80 },
  stepTitleCentered: { textAlign: 'center', paddingHorizontal: Spacing['4xl'] },
  universBottomBar: { paddingHorizontal: Spacing['4xl'], paddingBottom: 72 },
  primaryButtonFull: { width: '100%' },
  emptyState: { alignItems: 'center', paddingTop: Spacing['6xl'] },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing['2xl'] },
  emptyText: { fontSize: FontSize.body, textAlign: 'center' },
  profileCard: { flex: 1, margin: Spacing.md, padding: Spacing['2xl'], borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center', maxWidth: '48%' },
  profileAvatar: { fontSize: 40, marginBottom: Spacing.md },
  profileName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: Spacing.xs },
  profileBadge: { fontSize: 20, marginBottom: Spacing.xs },
  profileReady: { fontSize: FontSize.micro, textAlign: 'center' },
  primaryButton: { borderRadius: Radius.full, paddingVertical: Spacing['2xl'], paddingHorizontal: Spacing['4xl'], alignItems: 'center', marginTop: Spacing['2xl'] },
  primaryButtonText: { color: '#fff', fontSize: FontSize.body, fontWeight: FontWeight.bold },
  secondaryButton: { borderRadius: Radius.full, paddingVertical: Spacing.lg, paddingHorizontal: Spacing['4xl'], alignItems: 'center', marginTop: Spacing.lg, borderWidth: 1.5 },
  secondaryButtonText: { fontSize: FontSize.body, fontWeight: FontWeight.medium },
  ghostButton: { alignItems: 'center', paddingVertical: Spacing.lg, marginTop: Spacing.md },
  ghostButtonText: { fontSize: FontSize.sm },
  sectionLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.medium, marginTop: Spacing['2xl'], marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipsScroll: { marginBottom: Spacing.lg },
  chip: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, borderRadius: Radius.full, borderWidth: 1, marginRight: Spacing.md },
  chipText: { fontSize: FontSize.sm },
  textInput: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing['2xl'], fontSize: FontSize.body, minHeight: 60, marginBottom: Spacing.lg },
  voiceEngineRow: { flexDirection: 'row', gap: Spacing.md },
  voiceChip: { flex: 1, paddingVertical: Spacing.lg, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center' },
  voiceEnginePicker: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing['2xl'], gap: Spacing.md },
  voiceEnginePickerLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.medium },
  voiceEnginePickerValue: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  voiceOption: { padding: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, marginBottom: Spacing.md },
  voiceSubLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.medium, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  voiceParentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  voiceParentWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  voiceParentChip: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', minWidth: 90 },
  voiceParentAvatar: { fontSize: 22, marginBottom: Spacing.xs },
  voiceParentName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  voiceParentBadge: { fontSize: FontSize.micro, marginTop: 2 },
  voiceAddBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  voiceAddBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  voicePersonalEmpty: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22, padding: Spacing['2xl'] },
  voicePremiumHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  voiceRefreshText: { fontSize: FontSize.caption, fontWeight: FontWeight.medium },
  voiceEmptyBox: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing['2xl'], marginTop: Spacing.md, alignItems: 'center' },
  voiceEmptyTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: Spacing.md, textAlign: 'center' },
  voiceEmptyText: { fontSize: FontSize.caption, textAlign: 'center', lineHeight: 20 },
  lengthRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  lengthChip: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  lengthEmoji: { fontSize: 22, marginBottom: Spacing.xs },
  lengthLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.bold, marginBottom: 2, textAlign: 'center' },
  lengthDuration: { fontSize: FontSize.micro, textAlign: 'center' },
  previousStoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing['2xl'],
  },
  previousStoryEmoji: { fontSize: 28 },
  previousStoryBody: { flex: 1 },
  previousStoryTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: 2 },
  previousStoryMeta: { fontSize: FontSize.micro },
  previousStoryBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousStoryBadgeText: { fontSize: FontSize.sm },
  previousStoryHint: {
    fontSize: FontSize.micro,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
  voiceModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing['4xl'], borderBottomWidth: 1 },
  voiceModalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  voiceModalClose: { fontSize: FontSize.body, fontWeight: FontWeight.medium },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  contextCheck: { fontSize: 18 },
  contextEmoji: { fontSize: 22 },
  contextBody: { flex: 1 },
  contextTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 2 },
  contextSubtitle: { fontSize: FontSize.micro, lineHeight: 16 },
  contextCategory: { marginBottom: Spacing.md },
  contextCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  contextCategoryEmoji: { fontSize: 18 },
  contextCategoryTitle: {
    flex: 1,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextCategoryCount: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  contextCategoryChevron: { fontSize: FontSize.sm, width: 16, textAlign: 'center' },
  contextMoreLink: { paddingVertical: Spacing.sm, alignItems: 'center' },
  contextMoreLinkText: { fontSize: FontSize.caption, fontWeight: FontWeight.medium },
  loadingContainer: { alignItems: 'center', paddingTop: Spacing['6xl'] },
  starsRow: { flexDirection: 'row', gap: Spacing['2xl'], marginBottom: Spacing['4xl'] },
  starEmoji: { fontSize: 40 },
  loadingText: { fontSize: FontSize.body, textAlign: 'center' },
  errorContainer: { alignItems: 'center', paddingTop: Spacing['4xl'] },
  errorEmoji: { fontSize: 48, marginBottom: Spacing['2xl'] },
  errorText: { fontSize: FontSize.body, textAlign: 'center', marginBottom: Spacing['4xl'] },
  storyTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, marginBottom: Spacing['2xl'], textAlign: 'center' },
  storyText: { fontSize: FontSize.body, lineHeight: 28, marginBottom: Spacing['4xl'] },
  finContainer: { alignItems: 'center', paddingTop: Spacing['4xl'] },
  finEmoji: { fontSize: 72, marginBottom: Spacing['2xl'] },
  finTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, textAlign: 'center', marginBottom: Spacing.md },
  finSub: { fontSize: FontSize.body, marginBottom: Spacing.md },
  finDuree: { fontSize: FontSize.sm, marginBottom: Spacing['4xl'] },
});
