/**
 * TaskCard.tsx — Checkbox task card with tag badges
 * Tap checkbox to toggle completion → triggers gamification points
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Zap } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { FloatingPoints } from './FloatingPoints';
import * as Haptics from 'expo-haptics';
import { Task, Profile } from '../lib/types';
import { formatDateShort } from '../lib/date-locale';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task, completed: boolean) => void;
  onSkip?: (task: Task) => void;
  onLongPress?: () => void;
  showSource?: boolean;
  hideSection?: boolean;
  compact?: boolean;
  /** Profils pour libellé source dynamique */
  profiles?: Profile[];
  /** Points à afficher en animation flottante quand la tâche est complétée */
  pointsOnComplete?: number;
}

/** Mappe un nom de tag vers une clé sémantique de couleur (cf. colors.tagColors) */
const TAG_COLOR_MAP: Record<string, 'bleu' | 'vert' | 'jaune' | 'rouge' | 'violet'> = {
  maxence: 'bleu',
  maison: 'vert',
  courses: 'jaune',
  urgent: 'rouge',
  rdv: 'violet',
};

function getSourceLabel(sourceFile: string, profiles: Profile[] | undefined, t: (key: string) => string): string {
  // Chercher un profil enfant dont le nom apparaît dans le chemin du fichier
  if (profiles) {
    const match = profiles.find((p) =>
      (p.role === 'enfant' || p.role === 'ado') && sourceFile.includes(p.name),
    );
    if (match) return match.name;
  }
  if (sourceFile.includes('Maison')) return t('taskCard.sourceHome');
  if (sourceFile.includes('courses')) return t('taskCard.sourceShopping');
  return t('taskCard.sourceTasks');
}

export const TaskCard = React.memo(function TaskCard({
  task,
  onToggle,
  onSkip,
  onLongPress,
  showSource = false,
  hideSection = false,
  compact = false,
  profiles,
  pointsOnComplete,
}: TaskCardProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const checkScale = useSharedValue(task.completed ? 1 : 0);
  const textOpacity = useSharedValue(task.completed ? 0.7 : 1);
  const [floatingPts, setFloatingPts] = useState<number | null>(null);

  useEffect(() => {
    checkScale.value = withSpring(task.completed ? 1 : 0, { damping: 12, stiffness: 200 });
    textOpacity.value = withTiming(task.completed ? 0.7 : 1, { duration: 200 });
  }, [task.completed]);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + 0.2 * checkScale.value }],
  }));

  const checkmarkAnimStyle = useAnimatedStyle(() => ({
    opacity: checkScale.value,
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!task.completed && pointsOnComplete) {
      setFloatingPts(pointsOnComplete);
    }
    onToggle(task, !task.completed);
  }, [task, onToggle, pointsOnComplete]);

  const handleSkip = useCallback(() => {
    Haptics.selectionAsync();
    onSkip?.(task);
  }, [task, onSkip]);

  const showSkip = !!onSkip && !!task.dueDate && !task.completed;

  const isOverdue =
    !task.completed &&
    task.dueDate &&
    task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        task.completed && { opacity: 0.45 },
        compact && { padding: Spacing.md, marginBottom: Spacing.xs, gap: Spacing.md },
      ]}
      onLongPress={onLongPress}
      activeOpacity={onLongPress ? 0.7 : 1}
      delayLongPress={500}
      accessibilityLabel={t('taskCard.a11y', { text: task.text, completed: task.completed ? t('taskCard.completed') : '', overdue: isOverdue ? t('taskCard.overdue') : '' })}
      accessibilityRole="button"
    >
      <View style={styles.checkboxWrapper}>
        {floatingPts != null && (
          <FloatingPoints
            points={floatingPts}
            visible
            onDone={() => setFloatingPts(null)}
          />
        )}
        <TouchableOpacity
          style={styles.checkbox}
          onPress={handleToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
        >
          <Animated.View style={[
            styles.checkboxInner,
            { borderColor: colors.brand.soilMuted, backgroundColor: 'transparent' },
            task.completed && { backgroundColor: colors.brand.soil, borderColor: colors.brand.soil },
            isOverdue && !task.completed && { borderColor: colors.error },
            checkAnimStyle,
          ]}>
            <Animated.Text style={[styles.checkmark, { color: colors.brand.parchment }, checkmarkAnimStyle]}>✓</Animated.Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.taskRow}>
          <Animated.Text
            style={[
              styles.taskText,
              { color: colors.text },
              task.completed && [styles.completedText, { color: colors.textFaint }],
              isOverdue && { color: colors.error },
              textAnimStyle,
            ]}
            numberOfLines={2}
          >
            {task.text}
          </Animated.Text>
          {task.dueDate && !task.completed && (
            <Text style={[styles.inlineDue, { color: isOverdue ? colors.error : colors.textMuted }, compact && { fontSize: FontSize.micro }]}>
              {formatDateShort(task.dueDate)}
            </Text>
          )}
        </View>

        <View style={[styles.meta, compact && styles.metaCompact]}>
          {showSkip && (
            <TouchableOpacity
              onPress={handleSkip}
              style={[styles.skipButton, { backgroundColor: colors.brand.wash }, compact && styles.badgeCompact]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={t('taskCard.skip')}
              accessibilityRole="button"
            >
              <Text style={[styles.skipButtonText, { color: colors.textMuted }, compact && { fontSize: FontSize.micro }]}>⏭️ {t('taskCard.skip')}</Text>
            </TouchableOpacity>
          )}
          {showSource && (
            <Text style={[styles.metaText, { color: colors.textFaint }, compact && { fontSize: FontSize.micro }]}>{getSourceLabel(task.sourceFile, profiles, t)}</Text>
          )}
          {task.section && !showSource && !hideSection && !task.recurrence && (
            <Text style={[styles.metaText, { color: primary }, compact && { fontSize: FontSize.micro }]}>{task.section}</Text>
          )}
          {task.recurrence && (
            <Text style={[styles.metaText, { color: colors.textFaint }, compact && { fontSize: FontSize.micro }]}>
              🔁 {/every\s+day/i.test(task.recurrence) ? t('taskCard.recurrenceDaily')
                  : /every\s+week/i.test(task.recurrence) ? t('taskCard.recurrenceWeekly')
                  : /every\s+month/i.test(task.recurrence) ? t('taskCard.recurrenceMonthly')
                  : task.recurrence}
            </Text>
          )}
          {!!task.xpOverride && !task.completed && (
            <View style={[
              styles.xpBadge,
              task.xpOverride > 20
                ? { backgroundColor: colors.warningBg }
                : { backgroundColor: colors.brand.wash },
            ]}>
              <Zap
                size={compact ? 9 : 10}
                color={task.xpOverride > 20 ? colors.warningText : colors.textMuted}
                fill={task.xpOverride > 20 ? colors.warningText : colors.textMuted}
              />
              <Text style={[
                styles.xpBadgeText,
                compact && { fontSize: FontSize.micro },
                task.xpOverride > 20
                  ? { color: colors.warningText, fontWeight: FontWeight.semibold }
                  : { color: colors.textMuted },
              ]}>
                {task.xpOverride}
              </Text>
            </View>
          )}
        </View>

        {task.tags.length > 0 && (
          <View style={styles.tags}>
            {task.tags.map((tag) => {
              const semanticKey = TAG_COLOR_MAP[tag.toLowerCase()];
              const tagColor = semanticKey ? colors.tagColors[semanticKey] : colors.textFaint;
              return (
                <View
                  key={tag}
                  style={[styles.tag, { backgroundColor: tagColor + '33' }]}
                >
                  <Text style={[styles.tagText, { color: tagColor }]}>
                    #{tag}
                  </Text>
                </View>
              );
            })}
            {task.mentions.map((mention) => (
              <View key={mention} style={[styles.tag, { backgroundColor: colors.tagMention }]}>
                <Text style={[styles.mentionText, { color: colors.tagMentionText }]}>@{mention}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.separator, { backgroundColor: colors.brand.bark }]} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.xs,
    gap: Spacing.xl,
  },
  checkboxWrapper: {
    position: 'relative',
  },
  checkbox: {
    marginTop: Spacing.xxs,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.md,
  },
  taskText: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.body,
  },
  inlineDue: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    flexShrink: 0,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  overdueText: {},
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginTop: Spacing.xxs,
  },
  metaCompact: {
    gap: Spacing.xs,
    marginTop: 0,
  },
  metaText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  badgeCompact: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xxs,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.xs,
  },
  tagText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  mentionText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  skipButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.sm,
  },
  skipButtonText: {
    fontSize: FontSize.caption,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.xs,
  },
  xpBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.xl,
    right: 0,
    height: 1,
    opacity: 0.6,
  },
});
