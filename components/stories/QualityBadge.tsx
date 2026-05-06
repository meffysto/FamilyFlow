/**
 * components/stories/QualityBadge.tsx — Phase 52-03 (EVAL-06)
 *
 * Badge couleur affichant le score qualité de la story (vert ≥7, ambre 4-7, rouge <4).
 * Tap = modal pageSheet avec issues + sous-scores LLM-judge + justification.
 *
 * - Couleurs via useThemeColors() (CLAUDE.md — pas de hex hardcoded).
 * - i18n FR strict.
 * - Si flag off OU quality_score absent ⇒ rend null (zéro footprint UI baseline).
 */

import React, { useState } from 'react';
import { Pressable, View, Text, Modal, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { BedtimeStory } from '../../lib/types';
import { isEvalEnabled } from '../../lib/eval/feature-flag';

interface QualityBadgeProps {
  story: BedtimeStory;
  size?: 'sm' | 'md';
}

type Tier = 'vert' | 'ambre' | 'rouge';

function tierFor(score: number): Tier {
  if (score >= 7) return 'vert';
  if (score >= 4) return 'ambre';
  return 'rouge';
}

export function QualityBadge({ story, size = 'sm' }: QualityBadgeProps) {
  const { colors, primary } = useThemeColors();
  const [open, setOpen] = useState(false);

  if (!isEvalEnabled()) return null;
  if (story.quality_score === undefined || story.quality_score === null) return null;

  const score = story.quality_score;
  const tier = tierFor(score);
  const bg =
    tier === 'vert' ? colors.success : tier === 'ambre' ? colors.warning : colors.error;
  const label = `${score.toFixed(1)}/10`;
  const dot = size === 'sm' ? 8 : 12;

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Score qualité ${label}, voir détails`}
        style={[styles.badge, { backgroundColor: bg }]}
        hitSlop={6}
      >
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: colors.onAccent,
            marginRight: 4,
          }}
        />
        <Text
          style={[
            styles.label,
            { color: colors.onAccent, fontSize: size === 'sm' ? 11 : 13 },
          ]}
        >
          {label}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={{ padding: Spacing['2xl'] }}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>Qualité de l'histoire</Text>
          <Text style={[styles.modalScore, { color: bg }]}>{label}</Text>

          {story.quality_issues && story.quality_issues.length > 0 && (
            <>
              <Text style={[styles.section, { color: colors.text }]}>Avertissements</Text>
              {story.quality_issues.map((issue, i) => (
                <Text key={i} style={[styles.issue, { color: colors.textMuted }]}>
                  {'• '}
                  {issue}
                </Text>
              ))}
            </>
          )}

          {story.llm_judge && (
            <>
              <Text style={[styles.section, { color: colors.text }]}>Évaluation narrative</Text>
              <Text style={[styles.dim, { color: colors.textMuted }]}>
                Rythme : {story.llm_judge.rythme}/10
              </Text>
              <Text style={[styles.dim, { color: colors.textMuted }]}>
                Originalité : {story.llm_judge.originalite}/10
              </Text>
              <Text style={[styles.dim, { color: colors.textMuted }]}>
                Émotion : {story.llm_judge.charge_emotionnelle}/10
              </Text>
              <Text style={[styles.dim, { color: colors.textMuted }]}>
                Fluidité : {story.llm_judge.fluidite}/10
              </Text>
              <Text style={[styles.justification, { color: colors.text }]}>
                «{' '}
                {story.llm_judge.justification}
                {' »'}
              </Text>
            </>
          )}

          {story.quality_retried && (
            <Text style={[styles.retry, { color: colors.textMuted }]}>
              Cette histoire a été régénérée automatiquement pour améliorer sa qualité.
            </Text>
          )}

          <Pressable
            onPress={() => setOpen(false)}
            style={[styles.closeBtn, { backgroundColor: primary }]}
            accessibilityRole="button"
            accessibilityLabel="Fermer le détail qualité"
          >
            <Text style={[styles.closeLabel, { color: colors.onPrimary }]}>Fermer</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
  modalTitle: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  modalScore: {
    fontSize: 48,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xl,
  },
  section: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  issue: {
    fontSize: FontSize.caption,
    lineHeight: 20,
    marginBottom: 4,
  },
  dim: {
    fontSize: FontSize.caption,
    marginBottom: 4,
  },
  justification: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    marginTop: Spacing.md,
    lineHeight: 20,
  },
  retry: {
    fontSize: FontSize.caption,
    marginTop: Spacing.lg,
    fontStyle: 'italic',
  },
  closeBtn: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  closeLabel: {
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.body,
  },
});
