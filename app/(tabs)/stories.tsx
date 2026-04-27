import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, ScrollView, Pressable,
  StyleSheet, ActivityIndicator, Alert, Modal,
  ActionSheetIOS, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat,
  cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI } from '../../contexts/AIContext';
import { useStoryVoice } from '../../contexts/StoryVoiceContext';
import { useAnimConfig } from '../../hooks/useAnimConfig';
import StoryBookCard, { BOOK_WIDTH, BOOK_GAP } from '../../components/stories/StoryBookCard';
import StoryPlayer from '../../components/stories/StoryPlayer';
import VoiceRecorder from '../../components/stories/VoiceRecorder';
import { AvatarIcon } from '../../components/ui/AvatarIcon';
import { getTheme } from '../../constants/themes';
import { getPersonalVoices } from '../../lib/personal-voice';
import { getCachedStoryAudio, stripAllPerformanceTags } from '../../lib/elevenlabs';
import { getCachedStoryAudioFish } from '../../lib/fish-audio';
import {
  STORY_UNIVERSES, STORY_SUGGESTIONS, ELEVENLABS_FRENCH_VOICES, ELEVENLABS_ENGLISH_VOICES,
  STORY_LENGTHS, STORY_LENGTH_ORDER,
  nextStoryFileName, pickSurpriseUniverse,
} from '../../lib/stories';
import { generateBedtimeStory } from '../../lib/ai-service';
import { getAvailableSfxTags } from '../../lib/sfx';
import { parseStoryScript } from '../../lib/story-script';
import { buildAnonymizationMap, anonymize, deanonymize } from '../../lib/anonymizer';
import type { BedtimeStory, StoryUniverseId, StoryVoiceConfig, StoryVoiceEngine, StoryLength, StoryAgeRange, Profile, Memory, ChildQuote } from '../../lib/types';
import { groupStoriesByBook, buildBookContextForPrompt, getNextChapterNumber, slugifyBookTitle, type StoryBook } from '../../lib/story-books';
import { getUniversCasting } from '../../lib/story-characters';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PillTabSwitcher, type PillTab } from '../../components/ui/PillTabSwitcher';
import { Sparkles, Library } from 'lucide-react-native';

// ─── Constantes animation ───────────────────────────────────────────────────

const TAB_SPRING = { damping: 32, stiffness: 200 };

// ─── Types machine à états ──────────────────────────────────────────────────

/** Contexte livre transmis à PersonnaliserStep + GenerationStep pour générer un chapitre N>=2 */
type BookContext = {
  livreId: string;
  livreTitre: string;
  chapitre: number;
  lockedCasting: string[];
  previousChapterFullText: string;
  olderSummaries: Array<{ chapitre: number; titre: string; summary: string }>;
};

type StoryFlowStep =
  | { etape: 'choisir_enfant' }
  | { etape: 'choisir_univers'; enfantId: string; enfantName: string }
  | { etape: 'personnaliser'; enfantId: string; enfantName: string; universId: StoryUniverseId; book?: BookContext; trancheAge?: StoryAgeRange }
  | { etape: 'generation'; enfantId: string; enfantName: string; universId: StoryUniverseId; detail: string; length: StoryLength; book?: BookContext; trancheAge?: StoryAgeRange }
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

/**
 * Tranche d'âge par défaut calculée depuis la date de naissance du profil.
 * - âge < 6 → '3-5'
 * - 6 ≤ âge < 9 → '6-8'
 * - âge ≥ 9 → '9+'
 * - Sans birthdate → '6-8' (médiane safe)
 */
function defaultTrancheAgeFromProfile(birthdate?: string): StoryAgeRange {
  if (!birthdate) return '6-8';
  try {
    const birth = new Date(birthdate + (birthdate.length === 4 ? '-01-01' : ''));
    const now = new Date();
    const ageYears = (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 6) return '3-5';
    if (ageYears < 9) return '6-8';
    return '9+';
  } catch {
    return '6-8';
  }
}

const TRANCHE_AGE_OPTIONS: { key: StoryAgeRange; label: string }[] = [
  { key: '3-5', label: '3-5 ans' },
  { key: '6-8', label: '6-8 ans' },
  { key: '9+',  label: '9+ ans' },
];

// ─── StoryCard ───────────────────────────────────────────────────────────────

interface StoryCardProps {
  story: BedtimeStory;
  showEnfantName: boolean;
  audioAvailable: boolean;
  onPress: (s: BedtimeStory) => void;
  onLongPress?: (s: BedtimeStory) => void;
}

const StoryCard = React.memo(function StoryCard({ story, showEnfantName, audioAvailable, onPress, onLongPress }: StoryCardProps) {
  const { primary, colors } = useThemeColors();
  // (pas de chaîne traduisible dans cette carte — date + titre/durée viennent du vault)

  const dateFR = React.useMemo(() => {
    try {
      return format(new Date(story.date), 'dd/MM/yyyy');
    } catch {
      return story.date;
    }
  }, [story.date]);

  return (
    <Pressable
      style={[storyCardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress(story)}
      onLongPress={onLongPress ? () => onLongPress(story) : undefined}
      delayLongPress={500}
    >
      {/* Badge audio */}
      {audioAvailable && (
        <View style={[storyCardStyles.audioBadge, { backgroundColor: `${primary}20` }]}>
          <Text style={[storyCardStyles.audioBadgeText, { color: primary }]}>🔊</Text>
        </View>
      )}
      {/* Titre */}
      <Text style={[storyCardStyles.title, { color: colors.text }]} numberOfLines={2}>
        {story.titre}
      </Text>
      {/* Méta : date + durée */}
      <Text style={[storyCardStyles.meta, { color: colors.textMuted }]} numberOfLines={1}>
        {dateFR} · {story.duree_lecture}
      </Text>
      {/* Chip enfant (si multi-enfants) */}
      {showEnfantName && (
        <View style={[storyCardStyles.enfantChip, { backgroundColor: colors.border }]}>
          <Text style={[storyCardStyles.enfantChipText, { color: colors.textMuted }]}>
            {story.enfant}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const storyCardStyles = StyleSheet.create({
  card: {
    padding: Spacing['2xl'],
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  audioBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBadgeText: { fontSize: FontSize.caption },
  title: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
    paddingRight: Spacing['4xl'],
  },
  meta: {
    fontSize: FontSize.caption,
    marginBottom: Spacing.xs,
  },
  enfantChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
  },
  enfantChipText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
});

// ─── BibliothequeView ─────────────────────────────────────────────────────────

interface BibliothequeViewProps {
  stories: BedtimeStory[];
  profiles: Profile[];
  childProfiles: Profile[];
  onStoryPress: (s: BedtimeStory) => void;
  onStoryLongPress: (s: BedtimeStory) => void;
  onCreatePress: () => void;
}

function BibliothequeView({ stories, profiles: _profiles, childProfiles, onStoryPress, onStoryLongPress, onCreatePress }: BibliothequeViewProps) {
  const { primary, colors } = useThemeColors();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'fr') as 'fr' | 'en';

  // Filtre enfant (null = tous)
  const defaultEnfantId = childProfiles.length === 1 ? (childProfiles[0]?.id ?? null) : null;
  const [selectedEnfantId, setSelectedEnfantId] = useState<string | null>(defaultEnfantId);

  // Disponibilité audio (chargée en async)
  const [audioAvailableMap, setAudioAvailableMap] = useState<Record<string, boolean>>({});

  // Collapse par univers
  const [collapsedUnivers, setCollapsedUnivers] = useState<Partial<Record<StoryUniverseId, boolean>>>({});

  // Tri
  type SortOrder = 'date_desc' | 'date_asc' | 'duree_asc' | 'alpha';
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_desc');
  const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
    { key: 'date_desc', label: lang === 'fr' ? 'Récent' : 'Recent' },
    { key: 'date_asc', label: lang === 'fr' ? 'Ancien' : 'Oldest' },
    { key: 'duree_asc', label: lang === 'fr' ? 'Courte' : 'Short' },
    { key: 'alpha', label: 'A→Z' },
  ];

  // Histoires filtrées
  const filteredStories = React.useMemo(
    () => stories.filter(s => !selectedEnfantId || s.enfantId === selectedEnfantId),
    [stories, selectedEnfantId],
  );

  const sortHistoires = useCallback((list: BedtimeStory[]): BedtimeStory[] => {
    switch (sortOrder) {
      case 'date_desc': return [...list].sort((a, b) => b.date.localeCompare(a.date));
      case 'date_asc':  return [...list].sort((a, b) => a.date.localeCompare(b.date));
      case 'duree_asc': return [...list].sort((a, b) => a.duree_lecture - b.duree_lecture);
      case 'alpha':     return [...list].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
    }
  }, [sortOrder]);

  // Regroupage par livre (chaque histoire devient un livre — implicite si pas de livreId)
  const booksAll = React.useMemo(() => groupStoriesByBook(filteredStories), [filteredStories]);

  // Groupes par univers (ordre canonique) — on conserve `histoires` (pour compat tri/audio)
  // et on ajoute `books` filtrés par univers pour le rendu.
  const groupes = React.useMemo(() =>
    STORY_UNIVERSES
      .map(u => ({
        universe: u,
        histoires: sortHistoires(filteredStories.filter(s => s.univers === u.id)),
        books: booksAll.filter(b => b.universId === u.id),
      }))
      .filter(g => g.histoires.length > 0),
    [filteredStories, sortHistoires, booksAll],
  );

  // Chargement audio async (non-bloquant)
  useEffect(() => {
    if (filteredStories.length === 0) {
      setAudioAvailableMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        filteredStories.map(async (s) => {
          try {
            if (s.voice?.engine === 'fish-audio' && s.voice.fishAudioReferenceId) {
              const path = await getCachedStoryAudioFish(s.id, s.voice.fishAudioReferenceId);
              return [s.id, path !== null] as const;
            }
            const voiceId = s.voice?.elevenLabsVoiceId;
            if (!voiceId) return [s.id, false] as const;
            const path = await getCachedStoryAudio(s.id, voiceId);
            return [s.id, path !== null] as const;
          } catch (e) {
            if (__DEV__) console.warn('[BibliothequeView] audio check failed:', e);
            return [s.id, false] as const;
          }
        }),
      );
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      for (const [k, v] of results) map[k] = v;
      setAudioAvailableMap(map);
    })();
    return () => { cancelled = true; };
  }, [filteredStories]);

  const handleStoryPress = useCallback((histoire: BedtimeStory) => {
    Haptics.selectionAsync();
    onStoryPress(histoire);
  }, [onStoryPress]);

  const toggleCollapse = useCallback((universId: StoryUniverseId) => {
    Haptics.selectionAsync();
    setCollapsedUnivers(prev => ({ ...prev, [universId]: !prev[universId] }));
  }, []);

  const showEnfantName = !selectedEnfantId;

  // État vide
  if (groupes.length === 0) {
    return (
      <View style={biblioStyles.emptyContainer}>
        <Text style={biblioStyles.emptyEmoji}>📚</Text>
        <Text style={[biblioStyles.emptyTitle, { color: colors.text }]}>
          {lang === 'fr' ? "Aucune histoire pour l'instant" : 'No stories yet'}
        </Text>
        <Text style={[biblioStyles.emptySubtitle, { color: colors.textMuted }]}>
          {lang === 'fr' ? 'Créez votre première histoire ✨' : 'Create your first story ✨'}
        </Text>
        <Pressable
          style={[biblioStyles.createBtn, { backgroundColor: primary }]}
          onPress={onCreatePress}
        >
          <Text style={biblioStyles.createBtnText}>{lang === 'fr' ? 'Créer une histoire' : 'Create a story'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      {/* Sélecteur enfant (uniquement si plusieurs enfants) */}
      {childProfiles.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={biblioStyles.childFilterScroll}
          contentContainerStyle={biblioStyles.childFilterContent}
        >
          {/* Chip "Tous" */}
          <Pressable
            style={[
              biblioStyles.childChip,
              { borderColor: colors.border, backgroundColor: !selectedEnfantId ? primary : colors.card },
            ]}
            onPress={() => { Haptics.selectionAsync(); setSelectedEnfantId(null); }}
          >
            <Text style={[
              biblioStyles.childChipText,
              { color: !selectedEnfantId ? colors.bg : colors.textMuted },
            ]}>
              {lang === 'fr' ? 'Tous' : 'All'}
            </Text>
          </Pressable>
          {/* Chips enfants */}
          {childProfiles.map(p => (
            <Pressable
              key={p.id}
              style={[
                biblioStyles.childChip,
                { borderColor: colors.border, backgroundColor: selectedEnfantId === p.id ? primary : colors.card },
              ]}
              onPress={() => { Haptics.selectionAsync(); setSelectedEnfantId(p.id); }}
            >
              <AvatarIcon name={p.avatar} color={selectedEnfantId === p.id ? colors.onPrimary : getTheme(p.theme).primary} size={24} />
              <Text style={[
                biblioStyles.childChipText,
                { color: selectedEnfantId === p.id ? colors.bg : colors.textMuted },
              ]}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Chips de tri */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={biblioStyles.sortScroll}
        contentContainerStyle={biblioStyles.sortContent}
      >
        {SORT_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={[
              biblioStyles.sortChip,
              { borderColor: colors.border, backgroundColor: sortOrder === opt.key ? primary : colors.card },
            ]}
            onPress={() => { Haptics.selectionAsync(); setSortOrder(opt.key); }}
          >
            <Text style={[biblioStyles.sortChipText, { color: sortOrder === opt.key ? colors.bg : colors.textMuted }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Groupes par univers */}
      {groupes.map(({ universe, histoires, books }) => (
        <UniversGroupe
          key={universe.id}
          universe={universe}
          histoires={histoires}
          books={books}
          collapsed={collapsedUnivers[universe.id] ?? true}
          showEnfantName={showEnfantName}
          audioAvailableMap={audioAvailableMap}
          onToggle={() => toggleCollapse(universe.id)}
          onStoryPress={handleStoryPress}
          onStoryLongPress={onStoryLongPress}
          colors={colors}
          primary={primary}
        />
      ))}
    </View>
  );
}

// ─── BookCard ─────────────────────────────────────────────────────────────────
// Livre multi-chapitres : header + casting + liste numérotée des chapitres

interface BookCardProps {
  book: StoryBook;
  showEnfantName: boolean;
  audioAvailableMap: Record<string, boolean>;
  onChapterPress: (s: BedtimeStory) => void;
  onChapterLongPress: (s: BedtimeStory) => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
}

const BookCard = React.memo(function BookCard({ book, showEnfantName, audioAvailableMap, onChapterPress, onChapterLongPress, colors, primary }: BookCardProps) {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'fr') as 'fr' | 'en';
  // Résolution des labels casting depuis l'univers (premier mot du label pour rester compact)
  const castingLabels = React.useMemo(() => {
    const universCasting = getUniversCasting(book.universId);
    return book.casting
      .map(slug => universCasting.find(c => c.slug === slug)?.label.split(' ').slice(0, 2).join(' ') ?? slug)
      .slice(0, 4); // limite affichage
  }, [book.casting, book.universId]);

  // Heuristique « dernier écouté » : dernier chapitre dont l'audio est disponible (sinon dernier de la liste)
  const lastListenedId = React.useMemo(() => {
    for (let i = book.chapters.length - 1; i >= 0; i--) {
      const ch = book.chapters[i]!;
      if (audioAvailableMap[ch.id]) return ch.id;
    }
    return book.chapters[book.chapters.length - 1]?.id;
  }, [book.chapters, audioAvailableMap]);

  return (
    <View style={[bookCardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[bookCardStyles.title, { color: colors.text }]} numberOfLines={2}>
        📖 {book.livreTitre}
      </Text>
      <Text style={[bookCardStyles.meta, { color: colors.textMuted }]}>
        {book.chapters.length} {lang === 'fr' ? 'chapitres' : 'chapters'}
        {showEnfantName ? ` · ${book.chapters[0]?.enfant ?? ''}` : ''}
      </Text>
      {castingLabels.length > 0 && (
        <View style={bookCardStyles.castingRow}>
          {castingLabels.map(label => (
            <View key={label} style={[bookCardStyles.castingChip, { backgroundColor: colors.border }]}>
              <Text style={[bookCardStyles.castingChipText, { color: colors.textMuted }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={bookCardStyles.chaptersList}>
        {book.chapters.map((ch, idx) => {
          const isLastListened = ch.id === lastListenedId;
          const num = ch.chapitre ?? idx + 1;
          const titre = ch.chapitreTitre ?? ch.titre;
          return (
            <Pressable
              key={ch.id}
              style={({ pressed }) => [
                bookCardStyles.chapterRow,
                { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={() => onChapterPress(ch)}
              onLongPress={() => onChapterLongPress(ch)}
              delayLongPress={500}
            >
              <Text style={[bookCardStyles.chapterMarker, { color: isLastListened ? primary : colors.textMuted }]}>
                {isLastListened ? '▶' : `${num}.`}
              </Text>
              <Text style={[bookCardStyles.chapterTitle, { color: colors.text }]} numberOfLines={1}>
                {titre}
              </Text>
              {audioAvailableMap[ch.id] && (
                <Text style={[bookCardStyles.chapterAudio, { color: primary }]}>🔊</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const bookCardStyles = StyleSheet.create({
  card: {
    padding: Spacing['2xl'],
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  meta: {
    fontSize: FontSize.caption,
    marginBottom: Spacing.md,
  },
  castingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  castingChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  castingChipText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
  },
  chaptersList: {
    marginTop: Spacing.xs,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  chapterMarker: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    minWidth: 24,
    textAlign: 'center',
  },
  chapterTitle: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  chapterAudio: {
    fontSize: FontSize.caption,
  },
});

// ─── UniversGroupe ────────────────────────────────────────────────────────────

interface UniversGroupeProps {
  universe: typeof STORY_UNIVERSES[0];
  histoires: BedtimeStory[];
  books: StoryBook[];
  collapsed: boolean;
  showEnfantName: boolean;
  audioAvailableMap: Record<string, boolean>;
  onToggle: () => void;
  onStoryPress: (s: BedtimeStory) => void;
  onStoryLongPress: (s: BedtimeStory) => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
}

function UniversGroupe({ universe, histoires, books, collapsed, showEnfantName, audioAvailableMap, onToggle, onStoryPress, onStoryLongPress, colors, primary }: UniversGroupeProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'fr') as 'fr' | 'en';
  const universeTitle = t(`stories.universes.${universe.id}.titre`, { defaultValue: universe.titre });
  const chevronRotation = useSharedValue(collapsed ? 0 : 1);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }],
  }));

  React.useEffect(() => {
    chevronRotation.value = withSpring(collapsed ? 0 : 1, TAB_SPRING);
  }, [collapsed, chevronRotation]);

  return (
    <View style={biblioStyles.universeGroup}>
      {/* En-tête groupe cliquable */}
      <Pressable
        style={[biblioStyles.universeHeader, { borderBottomColor: colors.border }]}
        onPress={onToggle}
      >
        <Text style={biblioStyles.universeEmoji}>{universe.emoji}</Text>
        <Text style={[biblioStyles.universeTitle, { color: colors.text }]}>
          {universeTitle}
        </Text>
        <Text style={[biblioStyles.universeCount, { color: colors.textMuted }]}>
          · {histoires.length}
        </Text>
        <Animated.Text style={[biblioStyles.universeChevron, { color: colors.textMuted }, chevronStyle]}>
          ›
        </Animated.Text>
      </Pressable>
      {/* Cartes (masquées si collapsed) — un livre = une carte (mono ou multi-chapitres) */}
      {!collapsed && books.map(book => {
        if (book.chapters.length >= 2) {
          return (
            <BookCard
              key={book.livreId}
              book={book}
              showEnfantName={showEnfantName}
              audioAvailableMap={audioAvailableMap}
              onChapterPress={onStoryPress}
              onChapterLongPress={onStoryLongPress}
              colors={colors}
              primary={primary}
            />
          );
        }
        // 1 chapitre → carte simple (legacy ou tome 1 isolé)
        const story = book.chapters[0]!;
        return (
          <StoryCard
            key={book.livreId}
            story={story}
            showEnfantName={showEnfantName}
            audioAvailable={audioAvailableMap[story.id] ?? false}
            onPress={onStoryPress}
            onLongPress={onStoryLongPress}
          />
        );
      })}
      {!collapsed && histoires.length > 0 && (
        <Text style={[biblioStyles.deleteHint, { color: colors.textMuted }]}>
          {lang === 'fr' ? 'Maintenir pour supprimer' : 'Hold to delete'}
        </Text>
      )}
    </View>
  );
}

const biblioStyles = StyleSheet.create({
  emptyContainer: { alignItems: 'center', paddingTop: Spacing['6xl'], paddingHorizontal: Spacing['4xl'] },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing['2xl'] },
  emptyTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, textAlign: 'center', marginBottom: Spacing.md },
  emptySubtitle: { fontSize: FontSize.body, textAlign: 'center', marginBottom: Spacing['4xl'] },
  createBtn: { borderRadius: Radius.full, paddingVertical: Spacing['2xl'], paddingHorizontal: Spacing['4xl'], alignItems: 'center' },
  createBtnText: { color: '#fff', fontSize: FontSize.body, fontWeight: FontWeight.bold },
  childFilterScroll: { marginBottom: Spacing['2xl'] },
  sortScroll: { marginBottom: Spacing['2xl'] },
  sortContent: { paddingHorizontal: Spacing['2xl'], gap: Spacing.md },
  sortChip: { borderWidth: 1, borderRadius: Radius.full, paddingVertical: Spacing.sm, paddingHorizontal: Spacing['2xl'] },
  sortChipText: { fontSize: FontSize.caption, fontWeight: FontWeight.medium },
  deleteHint: { fontSize: FontSize.caption, textAlign: 'center', paddingVertical: Spacing.md, paddingBottom: Spacing['2xl'] },
  childFilterContent: { paddingHorizontal: 0, gap: Spacing.md },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  childChipAvatar: { fontSize: 16 },
  childChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  universeGroup: { marginBottom: Spacing['2xl'] },
  universeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  universeEmoji: { fontSize: 22 },
  universeTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  universeCount: { flex: 1, fontSize: FontSize.caption },
  universeChevron: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});

// ─── Composant principal ─────────────────────────────────────────────────────

export default function StoriesScreen() {
  const router = useRouter();
  const { primary, colors, isDark } = useThemeColors();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'fr') as 'fr' | 'en';
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
  const [activeTab, setActiveTab] = useState<'nouvelle' | 'bibliotheque'>('nouvelle');
  const [selectedUniversId, setSelectedUniversId] = useState<StoryUniverseId | null>(null);
  // Note : `detailText` est local à PersonnaliserStep (cf. fix keyboard dismiss).
  // PersonnaliserStep est une fonction nested → un keystroke dans le parent
  // recrée sa référence et React remonte le subtree → TextInput perdu, clavier
  // dismiss. En localisant l'état, le parent ne re-render plus à chaque touche.

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
  // Mode de clonage choisi pour la prochaine ouverture du VoiceRecorder.
  // 'instant' = comportement actuel (1 prise, voix prête immédiatement).
  // 'professional' = multi-prises + training ~3-4h (qualité supérieure, plan Creator+).
  const [voiceCloneMode, setVoiceCloneMode] = useState<'instant' | 'professional'>('instant');

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

  // Mode Spectacle nécessite ElevenLabs ou Fish Audio (timestamps ou ratio script).
  // Si on bascule vers la voix système alors qu'on est en spectacle, retombe automatiquement
  // sur "doux" pour ne pas garder une config silencieusement incompatible.
  useEffect(() => {
    if (localVoiceEngine !== 'expo-speech') return;
    const current = voiceConfig.audioMode ?? (voiceConfig.spectacle ? 'spectacle' : 'off');
    if (current !== 'spectacle') return;
    setVoiceConfig({ ...voiceConfig, audioMode: 'doux', spectacle: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localVoiceEngine]);

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

  // Reset à l'ouverture/refocus de l'écran : si on était bloqué sur fin/replay/generation,
  // repartir d'une étape neutre pour éviter de revenir sur une vieille histoire à la réouverture.
  useFocusEffect(
    useCallback(() => {
      setStep((current) => {
        if (current.etape === 'fin' || current.etape === 'replay' || current.etape === 'generation') {
          return { etape: 'choisir_enfant' };
        }
        return current;
      });
    }, [])
  );

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
        // Retour vers l'onglet d'origine (bibliothèque ou nouvelle)
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
      lang === 'fr' ? 'Supprimer cette histoire ?' : 'Delete this story?',
      lang === 'fr'
        ? `« ${story.titre} » sera supprimée définitivement (fichier markdown + audio en cache).`
        : `"${story.titre}" will be permanently deleted (markdown file + cached audio).`,
      [
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteStory(story.sourceFile).catch((e) => {
              if (__DEV__) console.warn('deleteStory failed:', e);
              Alert.alert(
                lang === 'fr' ? 'Erreur' : 'Error',
                lang === 'fr' ? "Impossible de supprimer l'histoire." : 'Could not delete the story.',
              );
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
    const todayISO = new Date().toISOString().slice(0, 10);

    const lastMoodFor = (profileId: string) =>
      moods.filter(m => m.profileId === profileId).sort((a, b) => b.date.localeCompare(a.date))[0];

    const moodHintFor = (profileId: string): string | null => {
      const mood = moods.find(m => m.profileId === profileId && m.date === todayISO);
      if (!mood) return null;
      if (lang === 'fr') {
        if (mood.level >= 4) return ['🌟 Super journée — parfait pour une grande aventure !', "✨ Belle journée — ce soir on part à l'aventure !"][mood.level - 4] ?? "✨ Belle journée — ce soir on part à l'aventure !";
        if (mood.level <= 2) return mood.level === 1 ? '🌙 Petite journée difficile — une histoire douce ce soir ?' : '💛 Petite tristesse — une histoire réconfortante ?';
        return '🌙 Journée tranquille — quelle histoire ce soir ?';
      }
      if (mood.level >= 4) return ['🌟 Great day — perfect for a big adventure!', "✨ Lovely day — tonight we're off on an adventure!"][mood.level - 4] ?? "✨ Lovely day — tonight we're off on an adventure!";
      if (mood.level <= 2) return mood.level === 1 ? '🌙 Tough little day — a gentle story tonight?' : '💛 A bit blue — a comforting story?';
      return '🌙 Quiet day — what story tonight?';
    };

    if (childProfiles.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👶</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {lang === 'fr' ? "Ajoutez d'abord un profil enfant" : 'Add a child profile first'}
          </Text>
        </View>
      );
    }

    const recentStories = stories.slice(0, 10);

    const { height } = useWindowDimensions();

    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{lang === 'fr' ? 'Des histoires uniques' : 'Unique stories'}</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>{lang === 'fr' ? "Personnalisées par la vie de votre enfant · À écouter avec votre propre voix" : "Personalized by your child's life · Listen with your own voice"}</Text>
        {childProfiles.length === 1 ? (
          // Enfant unique — carte centrée horizontalement et verticalement
          (() => {
            const p = childProfiles[0]!;
            const mood = lastMoodFor(p.id);
            return (
              <View style={{ height: height * 0.6, justifyContent: 'center', alignItems: 'center' }}>
              <Pressable
                style={[styles.profileCardSolo, { backgroundColor: colors.card, borderColor: primary }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedUniversId(null);
                  goTo({ etape: 'choisir_univers', enfantId: p.id, enfantName: p.name });
                }}
              >
                <AvatarIcon name={p.avatar} color={getTheme(p.theme).primary} size={64} />
                <Text style={[styles.profileNameSolo, { color: colors.text }]}>{p.name}</Text>
                {mood && (
                  <Text style={[styles.profileBadge, { color: colors.textMuted }]}>
                    {['😢', '😐', '😊', '😄', '🤩'][mood.level - 1]}
                  </Text>
                )}
                <Text style={[styles.profileReady, { color: colors.textMuted }]}>{lang === 'fr' ? 'Prêt pour dormir ?' : 'Ready for bed?'}</Text>
              </Pressable>
              {(() => { const hint = moodHintFor(p.id); return hint ? <Text style={[styles.moodHint, { color: colors.textMuted }]}>{hint}</Text> : null; })()}
              </View>
            );
          })()
        ) : (
          <FlatList
            data={childProfiles}
            keyExtractor={p => p.id}
            numColumns={2}
            scrollEnabled={false}
            renderItem={({ item: p }) => {
              const mood = lastMoodFor(p.id);
              const hint = moodHintFor(p.id);
              return (
                <View style={{ flex: 1 }}>
                  <Pressable
                    style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedUniversId(null);
                      goTo({ etape: 'choisir_univers', enfantId: p.id, enfantName: p.name });
                    }}
                  >
                    <AvatarIcon name={p.avatar} color={getTheme(p.theme).primary} size={48} />
                    <Text style={[styles.profileName, { color: colors.text }]}>{p.name}</Text>
                    {mood && (
                      <Text style={[styles.profileBadge, { color: colors.textMuted }]}>
                        {['😢', '😐', '😊', '😄', '🤩'][mood.level - 1]}
                      </Text>
                    )}
                    <Text style={[styles.profileReady, { color: colors.textMuted }]}>{lang === 'fr' ? '🌙 Prêt pour dormir ?' : '🌙 Ready for bed?'}</Text>
                  </Pressable>
                  {hint && <Text style={[styles.moodHint, { color: colors.textMuted }]}>{hint}</Text>}
                </View>
              );
            }}
          />
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
          <Text style={styles.primaryButtonText}>{lang === 'fr' ? 'Continuer →' : 'Continue →'}</Text>
        </Pressable>
      </View>
    );
  }

  // ── Étape 3 : Personnaliser ──

  function PersonnaliserStep({ enfantId, enfantName, universId, book, trancheAgeLocked }: { enfantId: string; enfantName: string; universId: StoryUniverseId; book?: BookContext; trancheAgeLocked?: StoryAgeRange }) {
    // Détail libre — local pour éviter les re-renders parent qui démonteraient
    // le subtree (le composant est une fonction nested → ref recrée à chaque
    // render parent → React remonte tout, TextInput perdu, clavier dismiss).
    const [detailText, setDetailText] = useState('');
    // Tranche d'âge : verrouillée par le livre, sinon sélectionnable (default depuis profil)
    const profileForAge = profiles.find(p => p.id === enfantId);
    const defaultTranche = trancheAgeLocked ?? defaultTrancheAgeFromProfile(profileForAge?.birthdate);
    const [selectedTrancheAge, setSelectedTrancheAge] = useState<StoryAgeRange>(defaultTranche);
    const effectiveTrancheAge: StoryAgeRange = book ? (trancheAgeLocked ?? defaultTranche) : selectedTrancheAge;
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
      const audioMode = voiceConfig.audioMode ?? (voiceConfig.spectacle ? 'spectacle' : 'off');
      const spectacle = audioMode === 'spectacle' ? true : undefined;
      const ambienceVolume = voiceConfig.ambienceVolume;
      const length = voiceConfig.length;
      const elevenLabsModel = voiceConfig.elevenLabsModel;
      // Multi-voix : auto-activé en mode doux/spectacle si provider ElevenLabs.
      // Apple/Fish n'ont pas accès à la voice library publique — toggle inopérant.
      const multiVoice = audioMode !== 'off' && localVoiceEngine === 'elevenlabs' ? true : undefined;
      const base = { language: lang, spectacle, audioMode, ambienceVolume, length, elevenLabsModel, multiVoice } as const;
      if (localVoiceEngine === 'elevenlabs') {
        if (voiceSelectedParentId) {
          const parent = adultProfiles.find((p: Profile) => p.id === voiceSelectedParentId);
          if (parent) {
            const BELLA_ID = 'EXAVITQu4vr4xnSDxMaL';
            const ADAM_ID = 'pNInz6obpgDQGcFmaJgB';
            const voiceId = parent.voiceElevenLabsId ?? (parent.gender === 'fille' ? BELLA_ID : ADAM_ID);
            return { engine: 'elevenlabs', elevenLabsVoiceId: voiceId, ...base };
          }
        }
        return { engine: 'elevenlabs', elevenLabsVoiceId: voiceConfig.elevenLabsVoiceId, ...base };
      }
      if (localVoiceEngine === 'fish-audio') {
        if (voiceSelectedParentId) {
          const parent = adultProfiles.find((p: Profile) => p.id === voiceSelectedParentId);
          if (parent?.voiceFishAudioId) {
            return { engine: 'fish-audio', fishAudioReferenceId: parent.voiceFishAudioId, ...base };
          }
        }
        return { engine: 'fish-audio', fishAudioReferenceId: voiceConfig.fishAudioReferenceId, ...base };
      }
      // expo-speech — voix Premium/Enhanced optionnelle (persistee si choisie)
      return {
        engine: 'expo-speech',
        voiceIdentifier: voiceSelectedPersonalVoice?.identifier,
        ...base,
      };
    };

    const currentLength: StoryLength = voiceConfig.length ?? 'moyenne';

    const generate = (detail: string) => {
      if (!aiConfig) {
        Alert.alert(
          lang === 'fr' ? 'Claude non configuré' : 'Claude not configured',
          lang === 'fr' ? 'Configurez votre clé API Claude dans les paramètres.' : 'Set up your Claude API key in settings.',
        );
        return;
      }
      setVoiceConfig(buildFinalVoiceConfig());
      goTo({
        etape: 'generation',
        enfantId,
        enfantName,
        universId,
        detail,
        length: currentLength,
        book,
        trancheAge: effectiveTrancheAge,
      });
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{lang === 'fr' ? "Personnalise l'histoire" : 'Personalize the story'}</Text>

        {/* Bandeau livre (chapitre N>=2) — univers/voix/multi-voix/tranche d'âge verrouillés */}
        {book && (
          <View style={[styles.bookBanner, { backgroundColor: colors.card, borderColor: primary }]}>
            <Text style={[styles.bookBannerTitle, { color: colors.text }]} numberOfLines={2}>
              📖 {book.livreTitre}
            </Text>
            <Text style={[styles.bookBannerSubtitle, { color: colors.textMuted }]}>
              {lang === 'fr' ? 'Chapitre' : 'Chapter'} {book.chapitre}
            </Text>
            <Text style={[styles.bookBannerLockHint, { color: colors.textMuted }]}>
              {lang === 'fr'
                ? "🔒 Univers, voix, multi-voix et tranche d'âge sont verrouillés par le livre"
                : '🔒 Universe, voice, multi-voice and age range are locked by the book'}
            </Text>
          </View>
        )}

        {/* Sélecteur tranche d'âge — uniquement à la création (pas de book) */}
        {!book && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{lang === 'fr' ? "Tranche d'âge" : 'Age range'}</Text>
            <View style={styles.trancheAgeRow}>
              {TRANCHE_AGE_OPTIONS.map(opt => {
                const isSelected = selectedTrancheAge === opt.key;
                const localizedLabel = lang === 'fr' ? opt.label : opt.label.replace(' ans', ' yrs');
                return (
                  <Pressable
                    key={opt.key}
                    style={[
                      styles.trancheAgeChip,
                      {
                        backgroundColor: isSelected ? primary : colors.card,
                        borderColor: isSelected ? primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedTrancheAge(opt.key);
                    }}
                  >
                    <Text style={[styles.trancheAgeLabel, { color: isSelected ? '#fff' : colors.text }]}>
                      {localizedLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Contexte vault — catégories (plus récent coché par défaut, ouvrir pour plus) */}
        {(latestMood || childQuotes.length > 0 || childMemories.length > 0) && (
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {lang === 'fr' ? 'Contexte pris en compte' : 'Context included'}
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
                {lang === 'fr' ? 'Humeur' : 'Mood'} — {lang === 'fr' ? 'niveau' : 'level'} {latestMood.level}/5
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
                  {lang === 'fr' ? 'Perles récentes' : 'Recent quotes'}
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
                    {lang === 'fr'
                      ? `+ Voir ${childQuotes.length - 1} autre${childQuotes.length - 1 > 1 ? 's' : ''}`
                      : `+ Show ${childQuotes.length - 1} more`}
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
                  {lang === 'fr' ? 'Souvenirs récents' : 'Recent memories'}
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
                        {isPremiereFois ? (lang === 'fr' ? '1ʳᵉ fois : ' : '1st time: ') : ''}{m.title}
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
                    {lang === 'fr'
                      ? `+ Voir ${childMemories.length - 1} autre${childMemories.length - 1 > 1 ? 's' : ''}`
                      : `+ Show ${childMemories.length - 1} more`}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })()}

        {/* Chips suggestions */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Un détail pour ce soir ?' : 'A detail for tonight?'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {STORY_SUGGESTIONS.map(s => {
            const localized = lang === 'fr' ? s : ({
              "peur des monstres sous le lit": 'afraid of monsters under the bed',
              "a eu une super journée à l'école": 'had a great day at school',
              "a eu une dispute avec un ami": 'had a fight with a friend',
              "a perdu une dent": 'lost a tooth',
              "a été très courageux aujourd'hui": 'was very brave today',
              "rêve de devenir astronaute": 'dreams of becoming an astronaut',
              "a peur du noir": 'is afraid of the dark',
              "a fait un beau dessin": 'made a lovely drawing',
            } as Record<string, string>)[s] ?? s;
            return (
              <Pressable
                key={s}
                style={[styles.chip, { backgroundColor: detailText === s ? primary : colors.card, borderColor: colors.border }]}
                onPress={() => setDetailText(detailText === s ? '' : s)}
              >
                <Text style={[styles.chipText, { color: detailText === s ? '#fff' : colors.text }]}>{localized}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Input libre */}
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder={lang === 'fr' ? 'Ou écris un détail libre...' : 'Or write your own detail...'}
          placeholderTextColor={colors.textMuted}
          value={detailText}
          onChangeText={setDetailText}
          maxLength={120}
          multiline
        />

        {/* Sélecteur taille histoire */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{lang === 'fr' ? "Durée de l'histoire" : 'Story length'}</Text>
        <View style={styles.lengthRow}>
          {STORY_LENGTH_ORDER.map(key => {
            const cfg = STORY_LENGTHS[key];
            const isSelected = currentLength === key;
            const lengthLabel = lang === 'fr'
              ? cfg.label
              : ({ courte: 'Short', moyenne: 'Medium', longue: 'Long', 'tres-longue': 'Very long' } as Record<string, string>)[key] ?? cfg.label;
            const lengthDuration = lang === 'fr' ? cfg.duration : cfg.duration.replace('sec', 'sec').replace('min', 'min');
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
                  {lengthLabel}
                </Text>
                <Text style={[styles.lengthDuration, { color: isSelected ? '#ffffffaa' : colors.textMuted }]}>
                  {lengthDuration}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Mode audio — 3 paliers : Off (voix seule) / Doux (+ ambiance) / Spectacle (+ SFX) */}
        {(() => {
          const currentMode: import('../../lib/types').StoryAudioMode =
            voiceConfig.audioMode ?? (voiceConfig.spectacle ? 'spectacle' : 'off');
          const ambienceVol = typeof voiceConfig.ambienceVolume === 'number'
            ? voiceConfig.ambienceVolume
            : 0.4;
          // Spectacle (SFX automatiques) marche avec ElevenLabs (synchro mot-à-mot via
          // timestamps) et Fish Audio (synchro ratio basée sur la position dans le script).
          // Indisponible avec la voix système (expo-speech) qui n'expose ni l'un ni l'autre.
          const spectacleAvailable = localVoiceEngine !== 'expo-speech';
          const MODES: { key: import('../../lib/types').StoryAudioMode; emoji: string; label: string; hint: string }[] = lang === 'fr'
            ? [
                { key: 'off',       emoji: '🔇', label: 'Off',       hint: 'Voix seule' },
                { key: 'doux',      emoji: '🌙', label: 'Doux',      hint: 'Ambiance' },
                { key: 'spectacle', emoji: '🎭', label: 'Spectacle', hint: spectacleAvailable ? 'Ambiance + SFX' : 'ElevenLabs ou Fish Audio' },
              ]
            : [
                { key: 'off',       emoji: '🔇', label: 'Off',     hint: 'Voice only' },
                { key: 'doux',      emoji: '🌙', label: 'Soft',    hint: 'Ambience' },
                { key: 'spectacle', emoji: '🎭', label: 'Theater', hint: spectacleAvailable ? 'Ambience + SFX' : 'ElevenLabs or Fish Audio' },
              ];
          const setMode = (mode: import('../../lib/types').StoryAudioMode) => {
            if (mode === 'spectacle' && !spectacleAvailable) return;
            Haptics.selectionAsync();
            setVoiceConfig({
              ...voiceConfig,
              audioMode: mode,
              spectacle: mode === 'spectacle' ? true : undefined,
            });
          };
          const adjustVolume = (delta: number) => {
            Haptics.selectionAsync();
            const next = Math.max(0, Math.min(1, Math.round((ambienceVol + delta) * 10) / 10));
            setVoiceConfig({ ...voiceConfig, ambienceVolume: next });
          };
          return (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Mode audio' : 'Audio mode'}</Text>
              <View style={styles.audioModeRow}>
                {MODES.map(m => {
                  const selected = currentMode === m.key;
                  const disabled = m.key === 'spectacle' && !spectacleAvailable;
                  return (
                    <Pressable
                      key={m.key}
                      disabled={disabled}
                      style={[
                        styles.audioModeChip,
                        {
                          backgroundColor: selected ? primary : colors.card,
                          borderColor: selected ? primary : colors.border,
                          opacity: disabled ? 0.45 : 1,
                        },
                      ]}
                      onPress={() => setMode(m.key)}
                      accessibilityState={{ disabled, selected }}
                      accessibilityHint={disabled ? (lang === 'fr' ? 'Sélectionnez ElevenLabs ou Fish Audio pour activer le mode Spectacle' : 'Select ElevenLabs or Fish Audio to enable Theater mode') : undefined}
                    >
                      <Text style={styles.audioModeEmoji}>{m.emoji}</Text>
                      <Text style={[styles.audioModeLabel, { color: selected ? '#fff' : colors.text }]}>
                        {m.label}
                      </Text>
                      <Text style={[styles.audioModeHint, { color: selected ? '#ffffffcc' : colors.textMuted }]}>
                        {m.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {currentMode !== 'off' && (
                <View style={[styles.volumeRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Text style={[styles.volumeLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Volume ambiance' : 'Ambience volume'}</Text>
                  <Pressable
                    style={[styles.volumeButton, { borderColor: colors.border }]}
                    onPress={() => adjustVolume(-0.1)}
                    disabled={ambienceVol <= 0}
                    accessibilityLabel={lang === 'fr' ? 'Baisser le volume' : 'Lower volume'}
                  >
                    <Text style={[styles.volumeButtonText, { color: colors.text }]}>−</Text>
                  </Pressable>
                  <Text style={[styles.volumeValue, { color: colors.text }]}>{Math.round(ambienceVol * 100)}%</Text>
                  <Pressable
                    style={[styles.volumeButton, { borderColor: colors.border }]}
                    onPress={() => adjustVolume(0.1)}
                    disabled={ambienceVol >= 1}
                    accessibilityLabel={lang === 'fr' ? 'Augmenter le volume' : 'Raise volume'}
                  >
                    <Text style={[styles.volumeButtonText, { color: colors.text }]}>+</Text>
                  </Pressable>
                </View>
              )}
            </>
          );
        })()}

        {/* Sélecteur voix unifié */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Voix de narration' : 'Narration voice'}</Text>

        {/* Sélecteur moteur (tap → ActionSheet) */}
        <Pressable
          style={[styles.voiceEnginePicker, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            const notConfigured = lang === 'fr' ? ' (clé non configurée)' : ' (key not set)';
            const engines: { key: StoryVoiceEngine; label: string }[] = [
              { key: 'expo-speech', label: lang === 'fr' ? '🆓 Système (gratuit, hors-ligne)' : '🆓 System (free, offline)' },
              { key: 'elevenlabs', label: `✨ ElevenLabs${isElevenLabsConfigured ? '' : notConfigured}` },
              { key: 'fish-audio', label: `🐟 Fish Audio${isFishAudioConfigured ? '' : notConfigured}` },
            ];
            if (Platform.OS === 'ios') {
              ActionSheetIOS.showActionSheetWithOptions(
                { options: [...engines.map(e => e.label), lang === 'fr' ? 'Annuler' : 'Cancel'], cancelButtonIndex: engines.length, title: lang === 'fr' ? 'Moteur de voix' : 'Voice engine' },
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
          <Text style={[styles.voiceEnginePickerLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Moteur' : 'Engine'}</Text>
          <Text style={[styles.voiceEnginePickerValue, { color: colors.text }]}>
            {localVoiceEngine === 'expo-speech' ? (lang === 'fr' ? '🆓 Système' : '🆓 System') : localVoiceEngine === 'elevenlabs' ? '✨ ElevenLabs' : '🐟 Fish Audio'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>›</Text>
        </Pressable>

        {/* Langue */}
        <View style={[styles.voiceEngineRow, { marginTop: Spacing.md }]}>
          {(['fr', 'en'] as const).map(voiceLang => (
            <Pressable
              key={voiceLang}
              style={[styles.voiceChip, { backgroundColor: voiceConfig.language === voiceLang ? primary : colors.card, borderColor: colors.border }]}
              onPress={() => setVoiceConfig({ ...voiceConfig, language: voiceLang })}
            >
              <Text style={[styles.chipText, { color: voiceConfig.language === voiceLang ? '#fff' : colors.text }]}>
                {voiceLang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ElevenLabs — profils adultes */}
        {localVoiceEngine === 'elevenlabs' && adultProfiles.length > 0 && (
          <View style={{ marginTop: Spacing.lg }}>
            <Text style={[styles.voiceSubLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Narrateur' : 'Narrator'}</Text>
            <View style={styles.voiceParentRow}>
              {adultProfiles.map((p: Profile) => {
                const BELLA_ID = 'EXAVITQu4vr4xnSDxMaL';
                const ADAM_ID = 'pNInz6obpgDQGcFmaJgB';
                const hasClone = !!p.voiceElevenLabsId;
                const fallbackLabel = lang === 'fr'
                  ? (p.gender === 'fille' ? 'Bella (auto)' : 'Adam (auto)')
                  : (p.gender === 'fille' ? 'Bella (auto)' : 'Adam (auto)');
                const isSelected = voiceSelectedParentId === p.id;
                return (
                  <View key={p.id} style={styles.voiceParentWrap}>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); setVoiceSelectedParentId(isSelected ? null : p.id); }}
                      style={[styles.voiceParentChip, { backgroundColor: isSelected ? primary : colors.card, borderColor: isSelected ? primary : colors.border }]}
                    >
                      <AvatarIcon name={p.avatar} color={getTheme(p.theme).primary} size={32} />
                      <Text style={[styles.voiceParentName, { color: isSelected ? '#fff' : colors.text }]}>{p.name}</Text>
                      <Text style={[styles.voiceParentBadge, { color: isSelected ? '#ffffffaa' : colors.textMuted }]}>
                        {hasClone ? (lang === 'fr' ? '🎙 Clonée' : '🎙 Cloned') : fallbackLabel}
                      </Text>
                    </Pressable>
                    {!hasClone && (
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVoiceRecorderProfileId(p.id); }}
                        style={[styles.voiceAddBtn, { borderColor: colors.border }]}
                        accessibilityLabel={lang === 'fr' ? `Créer la voix clonée de ${p.name}` : `Clone ${p.name}'s voice`}
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

        {/* Sélecteur de modèle ElevenLabs (compromis qualité/coût) */}
        {localVoiceEngine === 'elevenlabs' && (() => {
          const currentModel = voiceConfig.elevenLabsModel ?? 'eleven_v3';
          const MODELS: { key: import('../../lib/types').ElevenLabsModel; label: string; hint: string }[] = lang === 'fr'
            ? [
                { key: 'eleven_v3',              label: 'Cinéma v3',  hint: 'Émotions + tags (chuchotement, rire…)' },
                { key: 'eleven_multilingual_v2', label: 'Premium',    hint: 'Qualité stable — coût standard' },
                { key: 'eleven_turbo_v2_5',      label: 'Économique', hint: '−50% crédits — qualité quasi identique' },
                { key: 'eleven_flash_v2_5',      label: 'Ultra éco',  hint: '−50% crédits — voix plus mécanique' },
              ]
            : [
                { key: 'eleven_v3',              label: 'Cinema v3', hint: 'Emotions + tags (whisper, laugh…)' },
                { key: 'eleven_multilingual_v2', label: 'Premium',   hint: 'Stable quality — standard cost' },
                { key: 'eleven_turbo_v2_5',      label: 'Economy',   hint: '−50% credits — near identical quality' },
                { key: 'eleven_flash_v2_5',      label: 'Ultra-eco', hint: '−50% credits — slightly more robotic' },
              ];
          return (
            <View style={{ marginTop: Spacing.lg }}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Modèle ElevenLabs' : 'ElevenLabs model'}</Text>
              <View style={styles.audioModeRow}>
                {MODELS.map(m => {
                  const selected = currentModel === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      style={[
                        styles.audioModeChip,
                        {
                          backgroundColor: selected ? primary : colors.card,
                          borderColor: selected ? primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setVoiceConfig({ ...voiceConfig, elevenLabsModel: m.key });
                      }}
                    >
                      <Text style={[styles.audioModeLabel, { color: selected ? '#fff' : colors.text }]}>{m.label}</Text>
                      <Text style={[styles.audioModeHint, { color: selected ? '#ffffffcc' : colors.textMuted }]}>{m.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* Fish Audio — profils adultes avec clonage */}
        {localVoiceEngine === 'fish-audio' && adultProfiles.length > 0 && (
          <View style={{ marginTop: Spacing.lg }}>
            <Text style={[styles.voiceSubLabel, { color: colors.textMuted }]}>{lang === 'fr' ? 'Narrateur' : 'Narrator'}</Text>
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
                      <AvatarIcon name={p.avatar} color={getTheme(p.theme).primary} size={32} />
                      <Text style={[styles.voiceParentName, { color: isSelected ? '#fff' : colors.text }]}>{p.name}</Text>
                      <Text style={[styles.voiceParentBadge, { color: isSelected ? '#ffffffaa' : colors.textMuted }]}>
                        {hasClone ? (lang === 'fr' ? '🎙 Clonée' : '🎙 Cloned') : (lang === 'fr' ? 'Voix par défaut' : 'Default voice')}
                      </Text>
                    </Pressable>
                    {!hasClone && (
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVoiceRecorderProfileId(p.id); }}
                        style={[styles.voiceAddBtn, { borderColor: colors.border }]}
                        accessibilityLabel={lang === 'fr' ? `Créer la voix clonée de ${p.name}` : `Clone ${p.name}'s voice`}
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
              {lang === 'fr'
                ? 'Fish Audio utilisera sa voix par défaut. Ajoutez un profil adulte pour cloner votre voix.'
                : 'Fish Audio will use its default voice. Add an adult profile to clone your voice.'}
            </Text>
          </View>
        )}

        {/* Systeme — selecteur voix Enhanced/Premium filtrees par langue */}
        {localVoiceEngine === 'expo-speech' && (
          <View style={{ marginTop: Spacing.lg }}>
            <View style={styles.voicePremiumHeader}>
              <Text style={[styles.voiceSubLabel, { color: colors.textMuted, marginBottom: 0 }]}>
                {lang === 'fr'
                  ? `Voix premium ${voiceConfig.language === 'fr' ? 'françaises' : 'anglaises'}`
                  : `${voiceConfig.language === 'fr' ? 'French' : 'English'} premium voices`}
              </Text>
              <Pressable
                onPress={refreshPersonalVoices}
                hitSlop={8}
                accessibilityLabel={lang === 'fr' ? 'Rafraîchir la liste des voix' : 'Refresh voice list'}
              >
                <Text style={[styles.voiceRefreshText, { color: primary }]}>{lang === 'fr' ? '↻ Rafraîchir' : '↻ Refresh'}</Text>
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
                {lang === 'fr' ? 'Voix par défaut du système' : 'System default voice'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: FontSize.micro }}>
                {lang === 'fr' ? 'Qualité standard · gratuit · hors-ligne' : 'Standard quality · free · offline'}
              </Text>
            </Pressable>

            {voicePersonalLoading ? (
              <ActivityIndicator color={primary} style={{ marginTop: Spacing.lg }} />
            ) : voicePersonalVoices.length === 0 ? (
              <View style={[styles.voiceEmptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.voiceEmptyTitle, { color: colors.text }]}>
                  {lang === 'fr' ? 'Aucune voix premium installée' : 'No premium voice installed'}
                </Text>
                <Text style={[styles.voiceEmptyText, { color: colors.textMuted }]}>
                  {lang === 'fr' ? 'Téléchargez des voix haute qualité dans' : 'Download high-quality voices in'}{'\n'}
                  <Text style={{ fontWeight: FontWeight.bold }}>{lang === 'fr' ? 'Réglages › Accessibilité ›\nContenu énoncé › Voix' : 'Settings › Accessibility ›\nSpoken Content › Voices'}</Text>
                  {'\n\n'}
                  {lang === 'fr' ? <>Cherchez <Text style={{ fontWeight: FontWeight.bold }}>Audrey</Text>, <Text style={{ fontWeight: FontWeight.bold }}>Thomas</Text> ou <Text style={{ fontWeight: FontWeight.bold }}>Aurélie</Text> (Premium), puis revenez ici et appuyez sur Rafraîchir.</> : <>Search for <Text style={{ fontWeight: FontWeight.bold }}>Audrey</Text>, <Text style={{ fontWeight: FontWeight.bold }}>Thomas</Text> or <Text style={{ fontWeight: FontWeight.bold }}>Aurélie</Text> (Premium), then come back and tap Refresh.</>}
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
              <Text style={[styles.voiceModalTitle, { color: colors.text }]}>{lang === 'fr' ? 'Créer votre voix' : 'Create your voice'}</Text>
              <Pressable onPress={() => setVoiceRecorderProfileId(null)}>
                <Text style={[styles.voiceModalClose, { color: primary }]}>{lang === 'fr' ? 'Fermer' : 'Close'}</Text>
              </Pressable>
            </View>
            {/* Sélecteur Standard/Pro — uniquement pour ElevenLabs (Fish Audio n'a pas de PVC) */}
            {localVoiceEngine === 'elevenlabs' && (
              <View style={[styles.cloneModeRow, { borderBottomColor: colors.border }]}>
                <Pressable
                  style={[
                    styles.cloneModeChip,
                    {
                      backgroundColor: voiceCloneMode === 'instant' ? primary : colors.card,
                      borderColor: voiceCloneMode === 'instant' ? primary : colors.border,
                    },
                  ]}
                  onPress={() => setVoiceCloneMode('instant')}
                >
                  <Text style={[
                    styles.cloneModeChipText,
                    { color: voiceCloneMode === 'instant' ? '#fff' : colors.text },
                  ]}>
                    {lang === 'fr' ? 'Standard · 1 prise' : 'Standard · 1 take'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.cloneModeChip,
                    {
                      backgroundColor: voiceCloneMode === 'professional' ? primary : colors.card,
                      borderColor: voiceCloneMode === 'professional' ? primary : colors.border,
                    },
                  ]}
                  onPress={() => setVoiceCloneMode('professional')}
                >
                  <Text style={[
                    styles.cloneModeChipText,
                    { color: voiceCloneMode === 'professional' ? '#fff' : colors.text },
                  ]}>
                    {lang === 'fr' ? 'Pro · multi-prises (~3-4h)' : 'Pro · multi-take (~3-4h)'}
                  </Text>
                </Pressable>
              </View>
            )}
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
                  cloneType={localVoiceEngine === 'elevenlabs' ? voiceCloneMode : 'instant'}
                  onVoiceReady={async (voiceId, source, trainingStatus) => {
                    try {
                      let profileUpdate: Partial<Profile>;
                      if (source === 'fish-audio-cloned') {
                        profileUpdate = {
                          voiceFishAudioId: voiceId,
                          voiceSource: source,
                        };
                      } else if (source === 'elevenlabs-cloned-pro') {
                        // PVC : voix encore en training, on note l'état
                        profileUpdate = {
                          voiceElevenLabsId: voiceId,
                          voiceSource: 'elevenlabs-cloned',
                          voiceCloneType: 'professional',
                          voiceTrainingStatus: trainingStatus === 'training' ? 'training' : 'ready',
                          voiceTrainingStartedAt: new Date().toISOString(),
                        };
                      } else {
                        // IVC standard
                        profileUpdate = {
                          voiceElevenLabsId: voiceId,
                          voiceSource: source,
                          voiceCloneType: 'instant',
                          voiceTrainingStatus: 'ready',
                        };
                      }
                      await updateProfile(target.id, profileUpdate);
                      setVoiceSelectedParentId(target.id);
                      setVoiceRecorderProfileId(null);
                    } catch (e) {
                      if (__DEV__) console.warn('updateProfile voix echoue :', e);
                      Alert.alert(
                        lang === 'fr' ? 'Erreur' : 'Error',
                        lang === 'fr' ? "Impossible d'enregistrer la voix sur le profil." : 'Could not save the voice to the profile.',
                      );
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
          <Text style={styles.primaryButtonText}>{lang === 'fr' ? "✨ Générer l'histoire" : '✨ Generate the story'}</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={() => generate('')}>
          <Text style={[styles.ghostButtonText, { color: colors.textMuted }]}>{lang === 'fr' ? 'Passer cette étape' : 'Skip this step'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Étape 4 : Génération + Player ──

  function GenerationStep({ enfantId, enfantName, universId, detail, length, book, trancheAge }: { enfantId: string; enfantName: string; universId: StoryUniverseId; detail: string; length: StoryLength; book?: BookContext; trancheAge?: StoryAgeRange }) {
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
        setGenError(lang === 'fr' ? 'Claude non configuré. Configurez votre clé API dans les paramètres.' : 'Claude not configured. Set your API key in settings.');
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
        spectacle: (voiceConfig.audioMode ?? (voiceConfig.spectacle ? 'spectacle' : 'off')) === 'spectacle',
        availableSfxTags: (voiceConfig.audioMode ?? (voiceConfig.spectacle ? 'spectacle' : 'off')) === 'spectacle' ? getAvailableSfxTags() : undefined,
        multiVoice: voiceConfig.multiVoice === true,
        // Livre/chapitres — book présent uniquement pour chapitre N>=2
        book: book ? {
          ...book,
          // Anonymise le texte précédent transmis à Claude (les noms y sont déjà déanonymisés à la lecture vault)
          previousChapterFullText: anonymize(book.previousChapterFullText, anonMap),
        } : undefined,
        trancheAge,
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

      let titre = lang === 'fr' ? 'Histoire du soir' : 'Bedtime story';
      let texte = '';
      let memorySummary = '';
      let script: import('../../lib/types').StoryScript | undefined;
      // Parsing robuste : Claude renvoie parfois du JSON avec quotes non échappées
      // (surtout en Mode Spectacle où le script ajoute beaucoup de strings).
      // 1. Tentative parse direct ; 2. tentative repair (smart quotes, trailing commas)
      const tryParseJson = (raw: string): Record<string, unknown> | null => {
        try { return JSON.parse(raw); } catch { /* tombe sur le repair */ }
        try {
          const repaired = raw
            .replace(/[“”]/g, '"')   // guillemets typographiques
            .replace(/[‘’]/g, "'")
            .replace(/,(\s*[}\]])/g, '$1');     // trailing commas
          return JSON.parse(repaired);
        } catch { return null; }
      };

      const parsed = tryParseJson(resp.text);
      if (parsed) {
        if (typeof parsed.titre === 'string') titre = deanonymize(parsed.titre, anonMap);
        if (typeof parsed.texte === 'string') texte = deanonymize(parsed.texte, anonMap);
        if (typeof parsed.memorySummary === 'string') memorySummary = deanonymize(parsed.memorySummary, anonMap);

        // V2 — extrait le script si Claude l'a fourni (Mode Spectacle)
        if (parsed.script) {
          const validated = parseStoryScript(parsed.script);
          if (validated) {
            script = {
              ...validated,
              beats: validated.beats.map(b => {
                if (b.kind === 'narration') return { ...b, text: deanonymize(b.text, anonMap) };
                if (b.kind === 'dialogue') return { ...b, text: deanonymize(b.text, anonMap) };
                return b;
              }),
            };
            if (__DEV__) {
              const counts = script.beats.reduce<Record<string, number>>((acc, b) => {
                acc[b.kind] = (acc[b.kind] ?? 0) + 1;
                return acc;
              }, {});
              const speakers = script.beats
                .filter(b => b.kind === 'dialogue')
                .map(b => (b as { speaker: string }).speaker);
              const uniqueSpeakers = Array.from(new Set(speakers));
              console.log('[stories] script parsé:', {
                totalBeats: script.beats.length,
                breakdown: counts,
                speakers: uniqueSpeakers,
                speakerCounts: uniqueSpeakers.reduce<Record<string, number>>((acc, s) => {
                  acc[s] = speakers.filter(x => x === s).length;
                  return acc;
                }, {}),
              });
            }
          } else if (__DEV__) {
            console.warn('[stories] script présent mais parse échoué — Claude a peut-être renvoyé du JSON cassé');
          }
        } else if (__DEV__ && (voiceConfig.multiVoice || (voiceConfig.audioMode ?? '') === 'spectacle')) {
          console.warn('[stories] multi-voix/spectacle activé mais Claude n\'a pas retourné de script');
        }

        // Si Claude n'a pas fourni `texte` mais qu'on a un script valide,
        // on reconstruit le texte depuis les beats narration/dialogue.
        if (!texte && script) {
          const flat = script.beats
            .filter(b => b.kind === 'narration' || b.kind === 'dialogue')
            .map(b => (b as { text: string }).text)
            .join(' ')
            .trim();
          if (flat) texte = flat;
        }
      }

      // Dernier recours : on n'a pas pu parser proprement → on signale et on
      // n'écrit RIEN dans le vault (évite "texte = JSON brut" affiché à l'écran).
      if (!texte) {
        setGenError(lang === 'fr'
          ? "L'IA a renvoyé une réponse mal formée. Réessaie — ton crédit Claude est consommé mais aucune histoire n'a été enregistrée."
          : 'The AI returned a malformed response. Please try again — your Claude credit was used but no story was saved.');
        if (__DEV__) {
          console.warn('[generate] parse failed, longueur réponse:', resp.text.length);
          console.warn('[generate] début:', resp.text.slice(0, 500));
          console.warn('[generate] fin:', resp.text.slice(-500));
        }
        return;
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

          // Sauvegarder dans le vault — calcule un id unique si une histoire
          // avec même date+univers existe déjà (suffixe -2, -3, etc.)
          const today = format(new Date(), 'yyyy-MM-dd');
          const existingIds = new Set(
            stories.filter(s => s.enfantId === enfantId).map(s => s.id),
          );
          const { sourceFile, id } = nextStoryFileName(enfantName, today, universId, existingIds);
          // ─── Livre/chapitres ─────────────────────────────────────────
          // Si book présent → chapitre N>=2 du livre existant.
          // Sinon → 1er chapitre d'un nouveau livre potentiel (livreId généré depuis le titre).
          const livreId = book ? book.livreId : slugifyBookTitle(titre);
          const livreTitre = book ? book.livreTitre : titre;
          const chapitre = book ? book.chapitre : 1;
          const chapitreTitre = titre;
          // Personnages : extraits des speakers de dialogue uniques (si script présent)
          let personnages: string[] | undefined;
          if (script) {
            const dialogueSpeakers = script.beats
              .filter(b => b.kind === 'dialogue')
              .map(b => (b as { speaker: string }).speaker);
            const unique = Array.from(new Set(dialogueSpeakers));
            if (unique.length > 0) personnages = unique;
          }

          const story: BedtimeStory = {
            id,
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
            spectacle: voiceConfig.spectacle || undefined,
            audioMode: voiceConfig.audioMode,
            ambienceVolume: voiceConfig.ambienceVolume,
            script: script,
            version: 1,
            sourceFile,
            // Livre/chapitres
            livreId,
            livreTitre,
            chapitre,
            chapitreTitre,
            personnages,
            memorySummary: memorySummary.trim() || undefined,
            trancheAge,
          };
          generationCacheRef.current = { titre, texte, story };
          setCurrentStory(story);
          // saveStory fait l'optimistic update en interne (l'histoire apparaît
          // tout de suite dans la bibliothèque). Si la sync vault échoue,
          // l'histoire reste utilisable pour la session — l'audio ElevenLabs
          // est caché à part, donc rien n'est perdu côté crédits.
          saveStory(story).catch((e) => {
            if (__DEV__) console.warn('[stories] vault sync failed (story still in memory):', e);
          });
        }
      }, 18);
    }, [enfantId, enfantName, universId, detail, book, trancheAge]);

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
            <Text style={styles.primaryButtonText}>{lang === 'fr' ? 'Réessayer' : 'Try again'}</Text>
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
            {lang === 'fr' ? `Écriture de l'histoire de ${enfantName}...` : `Writing ${enfantName}'s story...`}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {storyTitle ? (
          <Text style={[styles.storyTitle, { color: colors.text }]}>{storyTitle}</Text>
        ) : null}
        <Text style={[styles.storyText, { color: colors.text }]}>{stripAllPerformanceTags(displayedText)}</Text>
        {showPlayer && currentStory && (
          <StoryPlayer
            histoire={currentStory}
            voiceConfig={voiceConfig}
            elevenLabsKey={elevenLabsKey}
            fishAudioKey={fishAudioKey}
            onFinish={() => goTo({ etape: 'fin', histoire: currentStory })}
            onAlignmentReady={(alignment) => {
              // On évite setCurrentStory ici : ça déclenche un re-render du
              // parent qui remount le StoryPlayer (GenerationStep est un
              // composant inline) et perd son état. Le player a son cache
              // module-level, et saveStory persiste le sidecar pour les
              // ouvertures futures de l'histoire.
              saveStory({ ...currentStory, alignment }).catch(() => { /* non-critique */ });
            }}
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

    /** Lance le wizard chapitre suivant : reconstruit le BookContext depuis les chapitres existants */
    const handleWriteNextChapter = useCallback(() => {
      Haptics.selectionAsync();
      // Filtre tous les chapitres du même livre — fallback si l'histoire n'a pas de livreId (legacy)
      // Dans ce cas, l'histoire elle-même devient le seul chapitre du livre implicite.
      const sameBookStories = histoire.livreId
        ? stories.filter(s => s.livreId === histoire.livreId)
        : [histoire];
      // groupStoriesByBook regroupe et trie par chapitre — on prend l'unique livre résultant
      const books = groupStoriesByBook(sameBookStories);
      const book = books[0];
      if (!book) return;
      const ctx = buildBookContextForPrompt(book);
      goTo({
        etape: 'personnaliser',
        enfantId: histoire.enfantId,
        enfantName: histoire.enfant,
        universId: histoire.univers,
        book: ctx,
        trancheAge: histoire.trancheAge,
      });
    }, [histoire]);

    return (
      <View style={styles.finContainer}>
        <Text style={styles.finEmoji}>🌙</Text>
        <Text style={[styles.finTitle, { color: colors.text }]}>{histoire.titre}</Text>
        <Text style={[styles.finSub, { color: colors.textMuted }]}>{lang === 'fr' ? 'Histoire sauvegardée ✨' : 'Story saved ✨'}</Text>
        <Text style={[styles.finDuree, { color: colors.textMuted }]}>
          ~{Math.ceil(histoire.duree_lecture / 60)} {lang === 'fr' ? 'min de lecture' : 'min read'}
        </Text>

        {showPlayer ? (
          <StoryPlayer
            histoire={histoire}
            voiceConfig={voiceConfig}
            elevenLabsKey={elevenLabsKey}
            fishAudioKey={fishAudioKey}
            onFinish={() => setShowPlayer(false)}
            onAlignmentReady={(alignment) => {
              saveStory({ ...histoire, alignment }).catch(() => { /* non-critique */ });
            }}
          />
        ) : (
          <>
            {/* Bouton chapitre suivant — réutilise univers/voix/multi-voix/tranche d'âge verrouillés */}
            <Pressable style={[styles.primaryButton, { backgroundColor: primary }]} onPress={handleWriteNextChapter}>
              <Text style={styles.primaryButtonText}>{lang === 'fr' ? '📖 Écrire le chapitre suivant' : '📖 Write the next chapter'}</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: primary }]} onPress={() => setShowPlayer(true)}>
              <Text style={[styles.secondaryButtonText, { color: primary }]}>{lang === 'fr' ? '▶ Relire' : '▶ Replay'}</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: primary }]} onPress={() => {
              setSelectedUniversId(null);
              // detailText réinitialisé naturellement au remount de PersonnaliserStep
              goTo({ etape: 'choisir_enfant' });
            }}>
              <Text style={[styles.secondaryButtonText, { color: primary }]}>{lang === 'fr' ? 'Nouvelle histoire' : 'New story'}</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => router.back()}>
              <Text style={[styles.ghostButtonText, { color: colors.textMuted }]}>{lang === 'fr' ? 'Fermer' : 'Close'}</Text>
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
        <Text style={[styles.storyText, { color: colors.text }]}>{stripAllPerformanceTags(histoire.texte)}</Text>
        <StoryPlayer
          histoire={histoire}
          voiceConfig={histoire.voice}
          elevenLabsKey={elevenLabsKey}
          fishAudioKey={fishAudioKey}
          onFinish={() => {
            // Retour tab-aware : si venu de la bibliothèque, y revenir
            goTo({ etape: 'choisir_enfant' });
            // activeTab reste inchangé — si 'bibliotheque', on y revient naturellement
          }}
          autoGenerate={false}
          onAlignmentReady={(alignment) => {
            saveStory({ ...histoire, alignment }).catch(() => { /* non-critique */ });
          }}
        />
      </ScrollView>
    );
  }

  // ── Rendu selon étape ──
  const renderContent = () => {
    // Bibliothèque affichée à l'étape choisir_enfant seulement
    if (step.etape === 'choisir_enfant' && activeTab === 'bibliotheque') {
      return (
        <BibliothequeView
          stories={stories}
          profiles={profiles}
          childProfiles={childProfiles}
          onStoryPress={handleReplayStory}
          onStoryLongPress={handleDeleteStory}
          onCreatePress={() => { Haptics.selectionAsync(); setActiveTab('nouvelle'); }}
        />
      );
    }
    switch (step.etape) {
      case 'choisir_enfant':
        return <ChoisirEnfantStep />;
      case 'choisir_univers':
        return renderChoisirUniversStep({ enfantId: step.enfantId, enfantName: step.enfantName });
      case 'personnaliser':
        return <PersonnaliserStep enfantId={step.enfantId} enfantName={step.enfantName} universId={step.universId} book={step.book} trancheAgeLocked={step.trancheAge} />;
      case 'generation':
        return <GenerationStep enfantId={step.enfantId} enfantName={step.enfantName} universId={step.universId} detail={step.detail} length={step.length} book={step.book} trancheAge={step.trancheAge} />;
      case 'fin':
        return <FinStep histoire={step.histoire} />;
      case 'replay':
        return <ReplayStep histoire={step.histoire} />;
    }
  };

  // ── Rendu global ──

  const STEP_TITLES: Record<string, string> = lang === 'fr'
    ? {
        choisir_enfant: 'Histoires du soir',
        choisir_univers: "Choisir l'univers",
        personnaliser: 'Personnaliser',
        generation: 'Votre histoire',
        fin: 'Bonne nuit ! 🌙',
        replay: 'Relire',
      }
    : {
        choisir_enfant: 'Bedtime stories',
        choisir_univers: 'Choose the world',
        personnaliser: 'Personalize',
        generation: 'Your story',
        fin: 'Good night! 🌙',
        replay: 'Replay',
      };

  const storyTabs: ReadonlyArray<PillTab<'nouvelle' | 'bibliotheque'>> = [
    { id: 'nouvelle', label: lang === 'fr' ? 'Nouvelle' : 'New', Icon: Sparkles },
    { id: 'bibliotheque', label: lang === 'fr' ? 'Bibliothèque' : 'Library', Icon: Library },
  ];

  const showBackBtn = step.etape !== 'choisir_enfant' && step.etape !== 'fin';
  const showStoryTabs = step.etape === 'choisir_enfant';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={STEP_TITLES[step.etape] ?? (lang === 'fr' ? 'Histoires du soir' : 'Bedtime stories')}
        subtitle={lang === 'fr' ? 'il était une fois, ce soir…' : 'once upon a time, tonight…'}
        tint="rgba(126,90,107,0.10)"
        leading={
          showBackBtn ? (
            <Pressable style={styles.backButton} onPress={goBack} accessibilityLabel={lang === 'fr' ? 'Retour' : 'Back'}>
              <Text style={[styles.backText, { color: primary }]}>‹</Text>
            </Pressable>
          ) : undefined
        }
        bottom={
          showStoryTabs ? (
            <View style={styles.tabsWrap}>
              <PillTabSwitcher
                tabs={storyTabs}
                activeTab={activeTab}
                onTabChange={(tab) => {
                  Haptics.selectionAsync();
                  setActiveTab(tab);
                }}
                primary={primary}
                colors={colors}
                marginHorizontal={0}
              />
            </View>
          ) : undefined
        }
      />


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
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, lineHeight: 32 },
  tabsWrap: { paddingVertical: Spacing.xs },
  content: { flex: 1 },
  scrollContent: { padding: Spacing['4xl'], paddingBottom: Spacing['6xl'] },
  stepTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  stepSubtitle: { fontSize: FontSize.sm, marginBottom: Spacing['4xl'] },
  bookCarousel: { marginHorizontal: -Spacing['2xl'], paddingVertical: 40, overflow: 'visible' },
  universCarouselWrapper: { flex: 1, justifyContent: 'center', paddingTop: 80 },
  stepTitleCentered: { textAlign: 'center', paddingHorizontal: Spacing['4xl'] },
  universBottomBar: { paddingHorizontal: Spacing['4xl'], paddingBottom: 120 },
  primaryButtonFull: { width: '100%' },
  emptyState: { alignItems: 'center', paddingTop: Spacing['6xl'] },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing['2xl'] },
  emptyText: { fontSize: FontSize.body, textAlign: 'center' },
  profileCard: { flex: 1, margin: Spacing.md, padding: Spacing['2xl'], borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center', maxWidth: '48%' },
  profileCardSolo: { width: '70%', padding: Spacing['4xl'], borderRadius: Radius.xl, borderWidth: 2, alignItems: 'center' },
  profileAvatar: { fontSize: 40, marginBottom: Spacing.md },
  profileAvatarSolo: { fontSize: 72, marginBottom: Spacing['2xl'] },
  profileName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: Spacing.xs },
  profileNameSolo: { fontSize: FontSize.title, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  profileBadge: { fontSize: 20, marginBottom: Spacing.xs },
  profileReady: { fontSize: FontSize.micro, textAlign: 'center' },
  moodHint: { fontSize: FontSize.micro, textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.md },
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
  spectacleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  spectacleEmoji: { fontSize: 24 },
  spectacleTextWrap: { flex: 1 },
  spectacleLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, marginBottom: 2 },
  spectacleHint: { fontSize: FontSize.caption },
  spectacleCheck: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  audioModeRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  audioModeChip: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  audioModeEmoji: { fontSize: 22, marginBottom: Spacing.xs },
  audioModeLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.bold, marginBottom: 2, textAlign: 'center' },
  audioModeHint: { fontSize: FontSize.micro, textAlign: 'center' },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  volumeLabel: { flex: 1, fontSize: FontSize.caption },
  volumeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeButtonText: { fontSize: 18, fontWeight: FontWeight.bold, lineHeight: 20 },
  volumeValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, minWidth: 44, textAlign: 'center' },
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
  cloneModeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing['4xl'],
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  cloneModeChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  cloneModeChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
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
  // Bandeau livre (chapitre N>=2)
  bookBanner: {
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 2,
    marginBottom: Spacing['2xl'],
  },
  bookBannerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  bookBannerSubtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.md,
  },
  bookBannerLockHint: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
  },
  // Sélecteur tranche d'âge
  trancheAgeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  trancheAgeChip: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  trancheAgeLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
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
