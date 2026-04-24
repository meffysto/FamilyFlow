/**
 * app/(tabs)/lovenotes.tsx — Écran Boîte aux lettres (Phase 35 Plan 01 + Phase 36 Plan 03)
 *
 * Skeleton : 3 segments (Reçues / Envoyées / Archivées) + FlatList
 * virtualisées + empty state textuel. Les cartes d'items sont le vrai
 * LoveNoteCard (Plan 35-02).
 *
 * Phase 36 Plan 03 :
 * - FAB "✏️ Écrire" → ouvre LoveNoteEditor (pageSheet)
 * - handleSave consomme le sourceFile retourné par addLoveNote (Plan 01 Task 4)
 *   puis appelle scheduleLoveNoteReveal({...note, sourceFile}) — zéro reconstruction de chemin
 * - useRevealOnForeground branché : pending → revealed au mount + foreground
 *
 * Route hidden via href:null dans app/(tabs)/_layout.tsx — accessible
 * uniquement par router.push('/(tabs)/lovenotes').
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { PillTabSwitcher, ScreenHeader, type PillTab } from '../../components/ui';
import { LoveNoteCard, LoveNoteEditor, EnvelopeUnfoldModal } from '../../components/lovenotes';
import {
  receivedForProfile,
  sentByProfile,
  archivedForProfile,
  isRevealed,
} from '../../lib/lovenotes/selectors';
import { localIso } from '../../lib/lovenotes/reveal-engine';
import { useRevealOnForeground } from '../../hooks/useRevealOnForeground';
import type { LoveNote, LoveNoteStatus } from '../../lib/types';
import { Spacing } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';

type Segment = 'received' | 'sent' | 'archived';

export default function LoveNotesScreen() {
  const {
    loveNotes,
    activeProfile,
    profiles,
    addLoveNote,
    updateLoveNoteStatus,
  } = useVault();
  const { colors, primary, isDark } = useThemeColors();
  const [segment, setSegment] = useState<Segment>('received');
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  useEffect(() => {
    scrollY.value = 0;
  }, [segment, scrollY]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [unfoldNote, setUnfoldNote] = useState<LoveNote | null>(null);

  const profileId = activeProfile?.id ?? '';

  // Phase 36 Plan 03 — bascule auto pending → revealed (mount + foreground).
  useRevealOnForeground(loveNotes, updateLoveNoteStatus);

  // Sélecteurs mémoïsés — deps explicites (loveNotes, profileId).
  const received = useMemo(
    () => receivedForProfile(loveNotes, profileId),
    [loveNotes, profileId],
  );
  const sent = useMemo(
    () => sentByProfile(loveNotes, profileId),
    [loveNotes, profileId],
  );
  const archived = useMemo(
    () => archivedForProfile(loveNotes, profileId),
    [loveNotes, profileId],
  );

  // Destinataires : tous profils sauf auteur (Pitfall 9).
  // Dev : inclut soi-meme pour test rapide (note a soi-meme).
  const recipientProfiles = useMemo(
    () => (__DEV__ ? profiles : profiles.filter((p) => p.id !== profileId)),
    [profiles, profileId],
  );

  const unreadCount = received.filter((n) => n.status !== 'read').length;
  const data =
    segment === 'received' ? received : segment === 'sent' ? sent : archived;

  // Phase 36 Plan 04 — tap card : ouvre EnvelopeUnfoldModal (revealed direct,
  // pending due → upgrade puis ouvre).
  const handleCardPress = useCallback(
    (note: LoveNote) => {
      if (note.status === 'revealed') {
        setUnfoldNote(note);
        return;
      }
      if (note.status === 'pending' && isRevealed(note)) {
        updateLoveNoteStatus(note.sourceFile, 'revealed')
          .then(() => setUnfoldNote({ ...note, status: 'revealed' }))
          .catch((e) => {
            if (__DEV__) console.warn('[handleCardPress]', e);
          });
        return;
      }
      // pending future / read → noop (future : navigation détail)
    },
    [updateLoveNoteStatus],
  );

  // Phase 36 Plan 04 — patch 'read' APRÈS la fin de l'animation (Pitfall 6).
  const handleUnfoldComplete = useCallback(async () => {
    if (!unfoldNote) return;
    // Dev test note : pas d'écriture vault (sourceFile factice)
    try {
      await updateLoveNoteStatus(unfoldNote.sourceFile, 'read');
    } catch (e) {
      if (__DEV__) console.warn('[handleUnfoldComplete]', e);
    }
  }, [unfoldNote, updateLoveNoteStatus]);

  const handleArchive = useCallback(
    async (note: LoveNote) => {
      const nextStatus: LoveNoteStatus = note.status === 'archived' ? 'read' : 'archived';
      try {
        await updateLoveNoteStatus(note.sourceFile, nextStatus);
      } catch (e) {
        if (__DEV__) console.warn('[handleArchive]', e);
      }
    },
    [updateLoveNoteStatus],
  );

  const renderItem = useCallback(
    ({ item }: { item: LoveNote }) => (
      <LoveNoteCard
        note={item}
        profiles={profiles}
        onPress={handleCardPress}
        onArchive={handleArchive}
        archiveLabel={segment === 'archived' ? 'Désarchiver' : 'Archiver'}
      />
    ),
    [profiles, handleCardPress, handleArchive, segment],
  );

  const segments = useMemo<ReadonlyArray<PillTab<Segment>>>(
    () => [
      { id: 'received', label: 'Reçues', badge: unreadCount || undefined },
      { id: 'sent', label: 'Envoyées' },
      { id: 'archived', label: 'Archivées' },
    ],
    [unreadCount],
  );

  // Phase 36 Plan 03 — save flow : addLoveNote retourne le sourceFile (Plan 01 Task 4).
  // → Pas de reconstruction via loveNotePath côté écran.
  const handleSave = useCallback(
    async (to: string, body: string, revealAt: string) => {
      if (!activeProfile) return;
      const createdAt = localIso(new Date());
      const note = {
        from: activeProfile.id,
        to,
        body,
        revealAt,
        createdAt,
        status: 'pending' as const,
      };
      await addLoveNote(note);
    },
    [activeProfile, addLoveNote],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title="Boîte aux lettres"
        actions={
          activeProfile ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setEditorVisible(true);
              }}
              style={[styles.addBtn, { backgroundColor: primary }]}
              accessibilityRole="button"
              accessibilityLabel="Écrire une love note"
            >
              <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+</Text>
            </Pressable>
          ) : undefined
        }
        bottom={
          <PillTabSwitcher<Segment>
            tabs={segments}
            activeTab={segment}
            onTabChange={setSegment}
            primary={primary}
            colors={colors}
            marginHorizontal={0}
          />
        }
        scrollY={scrollY}
      />
      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>
            Aucune note pour l'instant.
          </Text>
        </View>
      ) : (
        <AnimatedFlatList
          data={data as any}
          keyExtractor={((n: any) => n.sourceFile) as any}
          renderItem={renderItem as any}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          initialNumToRender={10}
          removeClippedSubviews
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
        />
      )}

      {activeProfile && (
        <LoveNoteEditor
          visible={editorVisible}
          fromProfile={activeProfile}
          recipientProfiles={recipientProfiles}
          onSave={handleSave}
          onClose={() => setEditorVisible(false)}
        />
      )}
      {unfoldNote && (
        <EnvelopeUnfoldModal
          visible={!!unfoldNote}
          fromName={profiles.find((p) => p.id === unfoldNote.from)?.name ?? 'Famille'}
          toName={profiles.find((p) => p.id === unfoldNote.to)?.name}
          body={unfoldNote.body}
          onClose={() => setUnfoldNote(null)}
          onUnfoldComplete={handleUnfoldComplete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: {
    padding: Spacing['2xl'],
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    lineHeight: 18,
  },
});
