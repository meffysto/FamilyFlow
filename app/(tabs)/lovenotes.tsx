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

import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader, SegmentedControl } from '../../components/ui';
import { LoveNoteCard, LoveNoteEditor, EnvelopeUnfoldModal } from '../../components/lovenotes';
import {
  receivedForProfile,
  sentByProfile,
  archivedForProfile,
  isRevealed,
} from '../../lib/lovenotes/selectors';
import { localIso } from '../../lib/lovenotes/reveal-engine';
import { useRevealOnForeground } from '../../hooks/useRevealOnForeground';
import { scheduleLoveNoteReveal } from '../../lib/scheduled-notifications';
import type { LoveNote, LoveNoteStatus } from '../../lib/types';
import { Spacing } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

type Segment = 'received' | 'sent' | 'archived';

export default function LoveNotesScreen() {
  const {
    loveNotes,
    activeProfile,
    profiles,
    addLoveNote,
    updateLoveNoteStatus,
  } = useVault();
  const { colors, primary } = useThemeColors();
  const tabBarHeight = useBottomTabBarHeight();
  const [segment, setSegment] = useState<Segment>('received');
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
    if (__DEV__ && unfoldNote.sourceFile === '__dev_test__') return;
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

  const segments = useMemo(
    () => [
      {
        id: 'received' as Segment,
        label: 'Reçues',
        badge: unreadCount || undefined,
      },
      { id: 'sent' as Segment, label: 'Envoyées' },
      { id: 'archived' as Segment, label: 'Archivées' },
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
      const sourceFile = await addLoveNote(note);
      await scheduleLoveNoteReveal({ ...note, sourceFile });
    },
    [activeProfile, addLoveNote],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ModalHeader title="Boîte aux lettres" />
      <View style={styles.controls}>
        <SegmentedControl<Segment>
          segments={segments}
          value={segment}
          onChange={setSegment}
        />
      </View>
      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>
            Aucune note pour l'instant.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(n) => n.sourceFile}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          initialNumToRender={10}
          removeClippedSubviews
        />
      )}

      {/* FAB Écrire — visible si activeProfile */}
      {activeProfile && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setEditorVisible(true);
          }}
          style={[
            styles.fab,
            { backgroundColor: primary, bottom: tabBarHeight + Spacing['2xl'] },
            Shadows.md,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Écrire une love note"
        >
          <Text style={[styles.fabText, { color: colors.onPrimary }]}>✏️ Écrire</Text>
        </Pressable>
      )}

      {/* DEV only — boutons iteration */}
      {__DEV__ && (
        <>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setUnfoldNote({
                sourceFile: '__dev_test__',
                from: activeProfile?.id ?? 'dev',
                to: activeProfile?.id ?? 'dev',
                body: 'Ceci est une note de test pour itérer sur l\'animation unfold. ✨\n\nBody en **markdown** avec une *seconde ligne* pour voir le rendu complet.',
                revealAt: localIso(new Date()),
                createdAt: localIso(new Date()),
                status: 'revealed',
              });
            }}
            style={[
              styles.fabDev,
              { backgroundColor: colors.cardAlt, bottom: tabBarHeight + Spacing['2xl'] },
              Shadows.md,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Rejouer animation unfold (dev)"
          >
            <Text style={[styles.fabText, { color: colors.text }]}>🧪 Test anim</Text>
          </Pressable>

          {activeProfile && (
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                try {
                  const createdAt = localIso(new Date());
                  const revealAt = localIso(new Date(Date.now() - 60_000));
                  await addLoveNote({
                    from: activeProfile.id,
                    to: activeProfile.id,
                    body: `Note injectée en DEV à ${new Date().toLocaleTimeString('fr-FR')}.\n\nTape la carte pour voir l'animation sur une vraie note.`,
                    revealAt,
                    createdAt,
                    status: 'revealed',
                  });
                } catch (e) {
                  if (__DEV__) console.warn('[dev inject note]', e);
                }
              }}
              style={[
                styles.fabDev2,
                { backgroundColor: colors.cardAlt, bottom: tabBarHeight + Spacing['2xl'] + 56 },
                Shadows.md,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Injecter une note revealed (dev)"
            >
              <Text style={[styles.fabText, { color: colors.text }]}>💌 Inject note</Text>
            </Pressable>
          )}
        </>
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
  controls: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  list: {
    padding: Spacing['2xl'],
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 999,
  },
  fabDev: {
    position: 'absolute',
    left: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 999,
  },
  fabDev2: {
    position: 'absolute',
    left: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 999,
  },
  fabText: {
    // Couleur appliquée inline (colors.onPrimary) — pas de hardcoded ici
    fontWeight: '600',
    fontSize: FontSize.body,
  },
});
