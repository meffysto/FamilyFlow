/**
 * TaskCard.tsx — Checkbox task card with tag badges
 * Tap checkbox to toggle completion → triggers gamification points
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Task } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task, completed: boolean) => void;
  onLongPress?: () => void;
  showSource?: boolean;
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

function getSourceLabel(sourceFile: string): string {
  if (sourceFile.includes('Maxence')) return '👶 Maxence';
  if (sourceFile.includes('Enfant2')) return '🍼 Enfant2';
  if (sourceFile.includes('Maison')) return '🏠 Maison';
  if (sourceFile.includes('courses')) return '🛒 Courses';
  return '📋 Tâches';
}

export const TaskCard = React.memo(function TaskCard({
  task,
  onToggle,
  onLongPress,
  showSource = false,
}: TaskCardProps) {
  const { primary, tint } = useThemeColors();
  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(task, !task.completed);
  }, [task, onToggle]);

  const isOverdue =
    !task.completed &&
    task.dueDate &&
    task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <TouchableOpacity
      style={[styles.card, task.completed && styles.completedCard]}
      onLongPress={onLongPress}
      activeOpacity={onLongPress ? 0.7 : 1}
      delayLongPress={500}
    >
      <TouchableOpacity
        style={styles.checkbox}
        onPress={handleToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
      >
        <View style={[styles.checkboxInner, task.completed && { backgroundColor: primary, borderColor: primary }]}>
          {task.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text
          style={[
            styles.taskText,
            task.completed && styles.completedText,
            isOverdue && styles.overdueText,
          ]}
          numberOfLines={2}
        >
          {task.text}
        </Text>

        <View style={styles.meta}>
          {showSource && (
            <View style={styles.badge}>
              <Text style={styles.sourceLabel}>{getSourceLabel(task.sourceFile)}</Text>
            </View>
          )}
          {task.section && !showSource && (
            <View style={[styles.sectionBadge, { backgroundColor: tint }]}>
              <Text style={[styles.sectionLabel, { color: primary }]}>{task.section}</Text>
            </View>
          )}
          {task.dueDate && !task.completed && (
            <View style={[styles.badge, isOverdue && styles.overdueBadgeContainer]}>
              <Text style={[styles.dueDate, isOverdue && styles.overdueBadge]}>
                📅 {task.dueDate}
              </Text>
            </View>
          )}
          {task.recurrence && (
            <View style={styles.badge}>
              <Text style={styles.recurrenceBadge}>🔁</Text>
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
              <View key={mention} style={[styles.tag, styles.mentionTag]}>
                <Text style={styles.mentionText}>@{mention}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  completedCard: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  checkbox: {
    marginTop: 2,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  // checkboxChecked colors moved to inline styles (dynamic theme)
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  taskText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 20,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  overdueText: {
    color: '#EF4444',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueDate: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  overdueBadgeContainer: {
    backgroundColor: '#FEE2E2',
  },
  overdueBadge: {
    color: '#EF4444',
    fontWeight: '700',
  },
  recurrenceBadge: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mentionTag: {
    backgroundColor: '#FEF3C7',
  },
  mentionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
});
