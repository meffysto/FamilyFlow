/**
 * app/(tabs)/lovenotes.tsx — Écran Boîte aux lettres (Phase 35 Plan 01)
 *
 * Skeleton minimal : 3 segments (Reçues / Envoyées / Archivées) + FlatList
 * virtualisées + empty state textuel. Les cartes d'items sont des stubs
 * remplacés par le vrai LoveNoteCard au Plan 02.
 *
 * Route hidden via href:null dans app/(tabs)/_layout.tsx — accessible
 * uniquement par router.push('/(tabs)/lovenotes').
 */

import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader, SegmentedControl } from '../../components/ui';
import {
  receivedForProfile,
  sentByProfile,
  archivedForProfile,
} from '../../lib/lovenotes/selectors';
import type { LoveNote } from '../../lib/types';
import { Spacing } from '../../constants/spacing';

type Segment = 'received' | 'sent' | 'archived';

export default function LoveNotesScreen() {
  const { loveNotes, activeProfile } = useVault();
  const { colors } = useThemeColors();
  const [segment, setSegment] = useState<Segment>('received');

  const profileId = activeProfile?.id ?? '';

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

  const unreadCount = received.filter((n) => n.status !== 'read').length;
  const data =
    segment === 'received' ? received : segment === 'sent' ? sent : archived;

  const renderItem = useCallback(
    ({ item }: { item: LoveNote }) => (
      <View
        style={{
          padding: Spacing.md,
          backgroundColor: colors.card,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: colors.text }}>{item.body.slice(0, 60)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {item.status}
        </Text>
      </View>
    ),
    [colors],
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
});
