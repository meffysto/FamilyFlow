/**
 * LoveNoteCard.tsx — Item liste mémoïsé de la Boîte aux lettres (Phase 35 Plan 02)
 *
 * Affiche : icône d'état (cachet mini animé si revealed/unread, horloge si
 * pending future, enveloppe sobre si read), expéditeur (lookup profile),
 * preview body 2 lignes (markdown strippé inline), date JJ/MM/AAAA.
 *
 * React.memo + comparateur custom (sourceFile / status / readAt / profiles)
 * pour éviter le re-render cascade lors d'un scroll FlatList (Pitfall 3).
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';
import type { LoveNote, Profile } from '../../lib/types';
import { WaxSeal } from './WaxSeal';

interface LoveNoteCardProps {
  note: LoveNote;
  profiles: Profile[];
  onPress?: (note: LoveNote) => void;
}

/**
 * Format date FR — '2026-04-17T09:07:00' → '17/04/2026'.
 * Préserve la convention LoveNote.* en heure locale ISO sans Z (cf. types.ts:585)
 * sans dépendre de toISOString() qui shifterait en UTC.
 */
function formatDateFR(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

function LoveNoteCardBase({ note, profiles, onPress }: LoveNoteCardProps) {
  const { colors } = useThemeColors();

  const sender = profiles.find((p) => p.id === note.from);
  const senderName = sender?.name ?? 'Famille';

  // Pending programmée future = revealAt > now
  const nowIso = new Date().toISOString().slice(0, 19);
  const isPendingFuture =
    note.status === 'pending' && note.revealAt > nowIso;

  // Preserve la magie : on ne montre le body strippé QUE pour les notes deja lues.
  // revealed (non lue) + pending → teaser uniquement, body cache jusqu'au tap.
  const preview =
    note.status === 'read'
      ? note.body.replace(/[*_`#>]/g, '').trim()
      : note.status === 'revealed'
        ? '✨ Tape pour découvrir…'
        : isPendingFuture
          ? '💌 Scellée jusqu\'à l\'heure dite'
          : '💌 En attente…';

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.(note);
  }, [note, onPress]);

  // Choix icône d'état
  const renderStateIcon = () => {
    if (note.status === 'revealed') {
      // Cachet mini animé (réutilise WaxSeal size=32)
      return <WaxSeal size={32} count={0} pulse={true} initial="✉" />;
    }
    if (isPendingFuture) {
      return (
        <View style={[styles.iconCircle, { backgroundColor: colors.cardAlt }]}>
          <Text style={styles.iconEmoji}>⏳</Text>
        </View>
      );
    }
    // read ou pending (déjà dûe — sans cachet animé)
    return (
      <View style={[styles.iconCircle, { backgroundColor: colors.cardAlt }]}>
        <Text style={[styles.iconEmoji, { opacity: 0.5 }]}>✉️</Text>
      </View>
    );
  };

  const isUnread = note.status === 'revealed';

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.iconSlot}>{renderStateIcon()}</View>

      <View style={styles.content}>
        <Text
          style={[styles.from, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          De {senderName}
        </Text>
        <Text
          style={[
            styles.preview,
            {
              color: colors.text,
              fontStyle: isUnread ? 'italic' : 'normal',
            },
          ]}
          numberOfLines={2}
        >
          {preview}
        </Text>
        {isPendingFuture && (
          <Text style={[styles.scheduled, { color: colors.textMuted }]}>
            🕓 Programmée pour {formatDateFR(note.revealAt)}
          </Text>
        )}
      </View>

      <Text style={[styles.date, { color: colors.textMuted }]}>
        {formatDateFR(note.createdAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    padding: Spacing['2xl'],
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconSlot: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  from: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  preview: {
    fontSize: FontSize.body,
    lineHeight: 20,
  },
  scheduled: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    marginTop: 2,
  },
  date: {
    fontSize: FontSize.caption,
    marginLeft: Spacing.md,
  },
});

export const LoveNoteCard = React.memo(
  LoveNoteCardBase,
  (prevProps, nextProps) =>
    prevProps.note.sourceFile === nextProps.note.sourceFile &&
    prevProps.note.status === nextProps.note.status &&
    prevProps.note.readAt === nextProps.note.readAt &&
    prevProps.profiles === nextProps.profiles &&
    prevProps.onPress === nextProps.onPress,
);
