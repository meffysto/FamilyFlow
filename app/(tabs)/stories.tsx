import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, ScrollView, Pressable,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert, Modal,
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
import StoryUniverseCard from '../../components/stories/StoryUniverseCard';
import StoryPlayer from '../../components/stories/StoryPlayer';
import VoiceRecorder from '../../components/stories/VoiceRecorder';
import { getPersonalVoices } from '../../lib/personal-voice';
import {
  STORY_UNIVERSES, STORY_SUGGESTIONS, ELEVENLABS_FRENCH_VOICES, ELEVENLABS_ENGLISH_VOICES,
  storyFileName, pickSurpriseUniverse,
} from '../../lib/stories';
import { generateBedtimeStory } from '../../lib/ai-service';
import { buildAnonymizationMap, anonymize, deanonymize } from '../../lib/anonymizer';
import type { BedtimeStory, StoryUniverseId, StoryVoiceConfig, Profile } from '../../lib/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Types machine à états ──────────────────────────────────────────────────

type StoryFlowStep =
  | { etape: 'choisir_enfant' }
  | { etape: 'choisir_univers'; enfantId: string; enfantName: string }
  | { etape: 'personnaliser'; enfantId: string; enfantName: string; universId: StoryUniverseId }
  | { etape: 'generation'; enfantId: string; enfantName: string; universId: StoryUniverseId; detail: string }
  | { etape: 'fin'; histoire: BedtimeStory };

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
  const { config: aiConfig } = useAI();
  const { voiceConfig, elevenLabsKey, isElevenLabsConfigured, setVoiceConfig } = useStoryVoice();
  const { reduceMotion } = useAnimConfig();
  const {
    profiles, moods, quotes, memories, rdvs, healthRecords, tasks, stories, saveStory, updateProfile,
  } = useVault();

  // Profils adultes — narrateurs disponibles
  const adultProfiles = React.useMemo(
    () => profiles.filter((p: Profile) => p.role === 'adulte'),
    [profiles],
  );

  const [step, setStep] = useState<StoryFlowStep>({ etape: 'choisir_enfant' });
  const [selectedUniversId, setSelectedUniversId] = useState<StoryUniverseId | null>(null);
  const [detailText, setDetailText] = useState('');
  const confettiRef = useRef<any>(null);

  // ─── États sélecteur voix (PersonnaliserStep) ────────────────────────────
  // Onglet moteur affiché : 'expo-speech' | 'elevenlabs' | 'ios-personal'
  const [localVoiceEngine, setLocalVoiceEngine] = useState<'expo-speech' | 'elevenlabs' | 'ios-personal'>(
    voiceConfig.voiceIdentifier ? 'ios-personal' : voiceConfig.engine,
  );
  const [voiceSelectedParentId, setVoiceSelectedParentId] = useState<string | null>(null);
  const [voiceSelectedPersonalVoice, setVoiceSelectedPersonalVoice] = useState<Speech.Voice | null>(null);
  const [voicePersonalVoices, setVoicePersonalVoices] = useState<Speech.Voice[]>([]);
  const [voicePersonalLoading, setVoicePersonalLoading] = useState(false);
  const [voiceRecorderProfileId, setVoiceRecorderProfileId] = useState<string | null>(null);

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
      translateY.value = withSpring(0, { damping: 14, stiffness: 180 });
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
      default:
        router.back();
    }
  }, [step, goTo, router]);

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
      </View>
    );
  }

  // ── Étape 2 : Choisir l'univers ──

  function ChoisirUniversStep({ enfantId, enfantName }: { enfantId: string; enfantName: string }) {
    const recentIds = stories
      .filter(s => s.enfantId === enfantId)
      .slice(0, 5)
      .map(s => s.univers);

    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Quel univers pour ce soir ?</Text>
        <FlatList
          data={STORY_UNIVERSES}
          keyExtractor={u => u.id}
          numColumns={2}
          scrollEnabled={false}
          renderItem={({ item: u }) => (
            <StoryUniverseCard
              universe={u}
              selected={selectedUniversId === u.id}
              onPress={() => {
                const realId = u.id === 'surprise' ? pickSurpriseUniverse(recentIds) : u.id;
                setSelectedUniversId(realId);
              }}
            />
          )}
        />
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: selectedUniversId ? primary : colors.border },
          ]}
          disabled={!selectedUniversId}
          onPress={() => {
            if (!selectedUniversId) return;
            goTo({ etape: 'personnaliser', enfantId, enfantName, universId: selectedUniversId });
          }}
        >
          <Text style={styles.primaryButtonText}>Continuer →</Text>
        </Pressable>
      </View>
    );
  }

  // ── Étape 3 : Personnaliser ──

  function PersonnaliserStep({ enfantId, enfantName, universId }: { enfantId: string; enfantName: string; universId: StoryUniverseId }) {
    const childMoods = moods.filter(m => m.profileId === enfantId).slice(0, 1);
    const childQuotes = quotes.filter(q => q.enfant === enfantName).slice(0, 3);

    const voiceOptions = voiceConfig.language === 'fr' ? ELEVENLABS_FRENCH_VOICES : ELEVENLABS_ENGLISH_VOICES;

    const buildFinalVoiceConfig = (): StoryVoiceConfig => {
      const lang = voiceConfig.language;
      if (localVoiceEngine === 'ios-personal' && voiceSelectedPersonalVoice) {
        return { engine: 'expo-speech', language: lang, voiceIdentifier: voiceSelectedPersonalVoice.identifier };
      }
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
      return { engine: 'expo-speech', language: lang };
    };

    const generate = (detail: string) => {
      if (!aiConfig) {
        Alert.alert('Claude non configuré', 'Configurez votre clé API Claude dans les paramètres.');
        return;
      }
      setVoiceConfig(buildFinalVoiceConfig());
      goTo({ etape: 'generation', enfantId, enfantName, universId, detail });
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Personnalise l'histoire</Text>

        {/* Aperçu données vault */}
        <View style={styles.vaultBadgesRow}>
          {childMoods[0] && (
            <View style={[styles.vaultBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.vaultBadgeText, { color: colors.text }]}>
                🌙 Humeur : {['😢', '😐', '😊', '😄', '🤩'][childMoods[0].level - 1]}
              </Text>
            </View>
          )}
          {childQuotes.length > 0 && (
            <View style={[styles.vaultBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.vaultBadgeText, { color: colors.text }]}>
                💬 {childQuotes.length} perle{childQuotes.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

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

        {/* Sélecteur voix unifié */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Voix de narration</Text>

        {/* Onglets moteur */}
        <View style={styles.voiceEngineRow}>
          {([
            { key: 'expo-speech', label: '🆓 Système' },
            { key: 'elevenlabs', label: `✨ ElevenLabs${isElevenLabsConfigured ? '' : ' (clé)'}` },
            { key: 'ios-personal', label: '🍎 iOS' },
          ] as const).map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.voiceChip, { backgroundColor: localVoiceEngine === key ? primary : colors.card, borderColor: colors.border }]}
              onPress={() => {
                setLocalVoiceEngine(key);
                if (key === 'ios-personal' && voicePersonalVoices.length === 0) {
                  setVoicePersonalLoading(true);
                  getPersonalVoices().then(vs => {
                    setVoicePersonalVoices(vs);
                    setVoicePersonalLoading(false);
                  });
                }
              }}
            >
              <Text style={[styles.chipText, { color: localVoiceEngine === key ? '#fff' : colors.text }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

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

        {/* iOS Personal Voice */}
        {localVoiceEngine === 'ios-personal' && (
          <View style={{ marginTop: Spacing.lg }}>
            {voicePersonalLoading ? (
              <ActivityIndicator color={primary} />
            ) : voicePersonalVoices.length === 0 ? (
              <Text style={[styles.voicePersonalEmpty, { color: colors.textMuted }]}>
                Créez une voix dans{'\n'}Réglages › Accessibilité › Voix personnelle
              </Text>
            ) : (
              voicePersonalVoices.map(v => {
                const isSelected = voiceSelectedPersonalVoice?.identifier === v.identifier;
                return (
                  <Pressable
                    key={v.identifier}
                    onPress={() => { Haptics.selectionAsync(); setVoiceSelectedPersonalVoice(isSelected ? null : v); }}
                    style={[styles.voiceOption, { backgroundColor: isSelected ? `${primary}20` : colors.card, borderColor: isSelected ? primary : colors.border }]}
                  >
                    <Text style={{ color: colors.text, fontSize: FontSize.sm }}>{v.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: FontSize.micro }}>{v.language} · {v.quality}</Text>
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
                  apiKey={elevenLabsKey}
                  onVoiceReady={async (voiceId, source) => {
                    try {
                      await updateProfile(target.id, { voiceElevenLabsId: voiceId, voiceSource: source });
                      setVoiceSelectedParentId(target.id);
                      setVoiceRecorderProfileId(null);
                    } catch (e) {
                      if (__DEV__) console.warn('updateProfile voix échoué :', e);
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

  function GenerationStep({ enfantId, enfantName, universId, detail }: { enfantId: string; enfantName: string; universId: StoryUniverseId; detail: string }) {
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
      const childMoods = moods
        .filter(m => m.profileId === enfantId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);
      const childQuotes = quotes
        .filter(q => q.enfant === enfantName)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);
      const childMemories = memories
        .filter(m => m.enfant === enfantName)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 2);

      const anonMap = buildAnonymizationMap(profiles, rdvs, healthRecords, memories, tasks);

      const resp = await generateBedtimeStory(aiConfig, {
        enfantAnon: anonymize(enfantName, anonMap),
        enfantAge: computeAge(profile?.birthdate),
        universId,
        universTitre: STORY_UNIVERSES.find(u => u.id === universId)?.titre ?? universId,
        detail: detail ? anonymize(detail, anonMap) : undefined,
        language: voiceConfig.language,
        context: {
          recentMoods: childMoods.map(m => ({ level: m.level, note: m.note ? anonymize(m.note, anonMap) : undefined, date: m.date })),
          recentQuotes: childQuotes.map(q => ({ citation: anonymize(q.citation, anonMap), contexte: q.contexte ? anonymize(q.contexte, anonMap) : undefined, date: q.date })),
          recentMemories: childMemories.map(m => ({ titre: anonymize(m.title, anonMap), description: m.description ? anonymize(m.description, anonMap) : undefined, date: m.date })),
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

  // ── Rendu selon étape ──
  const renderContent = () => {
    switch (step.etape) {
      case 'choisir_enfant':
        return <ChoisirEnfantStep />;
      case 'choisir_univers':
        return <ChoisirUniversStep enfantId={step.enfantId} enfantName={step.enfantName} />;
      case 'personnaliser':
        return <PersonnaliserStep enfantId={step.enfantId} enfantName={step.enfantName} universId={step.universId} />;
      case 'generation':
        return <GenerationStep enfantId={step.enfantId} enfantName={step.enfantName} universId={step.universId} detail={step.detail} />;
      case 'fin':
        return <FinStep histoire={step.histoire} />;
    }
  };

  // ── Rendu global ──

  const STEP_TITLES: Record<string, string> = {
    choisir_enfant: 'Histoires du soir',
    choisir_univers: "Choisir l'univers",
    personnaliser: 'Personnaliser',
    generation: 'Votre histoire',
    fin: 'Bonne nuit ! 🌙',
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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderContent()}
        </ScrollView>
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
  voiceModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing['4xl'], borderBottomWidth: 1 },
  voiceModalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  voiceModalClose: { fontSize: FontSize.body, fontWeight: FontWeight.medium },
  vaultBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing['2xl'] },
  vaultBadge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  vaultBadgeText: { fontSize: FontSize.caption },
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
