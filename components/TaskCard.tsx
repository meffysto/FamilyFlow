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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { FloatingPoints } from './FloatingPoints';
import * as Haptics from 'expo-haptics';
import { Task, Profile } from '../lib/types';
import { formatDateLocalized } from '../lib/date-locale';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';
import { Shadows } from '../constants/shadows';

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

const TAG_COLORS: Record<string, string> = {
  maxence: '#60A5FA',
  maison: '#34D399',
  courses: '#F59E0B',
  urgent: '#EF4444',
  rdv: '#8B5CF6',
  default: '#9CA3AF',
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag.toLowerCase()] ?? TAG_COLORS.default;
}

function getSourceLabel(sourceFile: string, profiles: Profile[] | undefined, t: (key: string) => string): string {
  // Chercher un profil enfant dont le nom apparaît dans le chemin du fichier
  if (profiles) {
    const match = profiles.find((p) =>
      (p.role === 'enfant' || p.role === 'ado') && sourceFile.includes(p.name),
    );
    if (match) return `${match.avatar} ${match.name}`;
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
        { backgroundColor: colors.card },
        task.completed && { backgroundColor: colors.cardAlt, opacity: 0.7 },
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
        >
          <Animated.View style={[
            styles.checkboxInner,
            { borderColor: colors.separator, backgroundColor: colors.card },
            task.completed && { backgroundColor: primary, borderColor: primary },
            checkAnimStyle,
          ]}>
            <Animated.Text style={[styles.checkmark, { color: colors.onPrimary }, checkmarkAnimStyle]}>✓</Animated.Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
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

        <View style={styles.meta}>
          {showSkip && (
            <TouchableOpacity
              onPress={handleSkip}
              style={[styles.skipButton, { backgroundColor: colors.cardAlt }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={t('taskCard.skip')}
              accessibilityRole="button"
            >
              <Text style={[styles.skipButtonText, { color: colors.textMuted }]}>⏭️ {t('taskCard.skip')}</Text>
            </TouchableOpacity>
          )}
          {showSource && (
            <View style={[styles.badge, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.sourceLabel, { color: colors.textMuted }]}>{getSourceLabel(task.sourceFile, profiles, t)}</Text>
            </View>
          )}
          {task.section && !showSource && !hideSection && !task.recurrence && (
            <View style={[styles.sectionBadge, { backgroundColor: tint }]}>
              <Text style={[styles.sectionLabel, { color: primary }]}>{task.section}</Text>
            </View>
          )}
          {task.dueDate && !task.completed && (
            <View style={[styles.badge, { backgroundColor: colors.cardAlt }, isOverdue && { backgroundColor: colors.errorBg }]}>
              <Text style={[styles.dueDate, { color: colors.textMuted }, isOverdue && { color: colors.error, fontWeight: FontWeight.bold }]}>
                📅 {formatDateLocalized(task.dueDate)}
              </Text>
            </View>
          )}
          {task.recurrence && (
            <View style={[styles.badge, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.recurrenceBadge, { color: colors.textFaint }]}>
                🔁 {/every\s+day/i.test(task.recurrence) ? t('taskCard.recurrenceDaily')
                    : /every\s+week/i.test(task.recurrence) ? t('taskCard.recurrenceWeekly')
                    : /every\s+month/i.test(task.recurrence) ? t('taskCard.recurrenceMonthly')
                    : task.recurrence}
              </Text>
            </View>
          )}
        </View>

        {task.tags.length > 0 && (
          <View style={styles.tags}>
            {task.tags.map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: getTagColor(tag) + '33' }]}
              >
                <Text style={[styles.tagText, { color: getTagColor(tag) }]}>
                  #{tag}
                </Text>
              </View>
            ))}
            {task.mentions.map((mention) => (
              <View key={mention} style={[styles.tag, { backgroundColor: colors.tagMention }]}>
                <Text style={[styles.mentionText, { color: colors.tagMentionText }]}>@{mention}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
    gap: Spacing.xl,
  },
  checkboxWrapper: {
    position: 'relative',
  },
  checkbox: {
    marginTop: Spacing.xxs,
  },
  checkboxInner: {
    width: 26,
    height: 26,
    borderRadius: 7,
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
    gap: 5,
  },
  taskText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.body,
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
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  sectionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  sourceLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  sectionLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  dueDate: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  overdueBadgeContainer: {},
  overdueBadge: {},
  recurrenceBadge: {
    fontSize: FontSize.caption,
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
});
