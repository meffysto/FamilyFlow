/**
 * DashboardPrefsModal.tsx — Configure dashboard section order and visibility
 *
 * Réordonnement par drag (long-press) ou boutons flèches.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

export interface SectionPref {
  id: string;
  label: string;
  emoji: string;
  visible: boolean;
  priority?: 'high' | 'medium' | 'low';
}

interface Props {
  sections: SectionPref[];
  smartSort: boolean;
  onSave: (result: { sections: SectionPref[]; smartSort: boolean }) => void;
  onClose: () => void;
}

/** Hauteur approximative d'un item (row + gap) pour le calcul de position drag */
const ITEM_H = 72;

// ─── DraggableRow ─────────────────────────────────────────────────────────────

interface DraggableRowProps {
  section: SectionPref;
  index: number;
  totalCount: number;
  draggedIdx: SharedValue<number>;
  dragY: SharedValue<number>;
  isFirst: boolean;
  isLast: boolean;
  onDragStart: () => void;
  onDragEnd: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  colors: any;
  primary: string;
  tint: string;
}

const DraggableRow = React.memo(function DraggableRow({
  section,
  index,
  totalCount,
  draggedIdx,
  dragY,
  isFirst,
  isLast,
  onDragStart,
  onDragEnd,
  onToggle,
  onMoveUp,
  onMoveDown,
  colors,
  primary,
  tint,
}: DraggableRowProps) {
  const animStyle = useAnimatedStyle(() => {
    // Cet item est en cours de drag
    if (draggedIdx.value === index) {
      return {
        transform: [{ translateY: dragY.value }, { scale: 1.04 }],
        zIndex: 100,
        elevation: 10,
        shadowOpacity: 0.2,
        shadowRadius: 12,
      };
    }

    // Pas de drag en cours
    if (draggedIdx.value < 0) {
      return { transform: [{ translateY: withTiming(0, { duration: 200 }) }] };
    }

    // Décalage des items entre la position d'origine et la position survolée
    const from = draggedIdx.value;
    const hoverAt = Math.max(0, Math.min(totalCount - 1, from + Math.round(dragY.value / ITEM_H)));

    if (from < hoverAt && index > from && index <= hoverAt) {
      return { transform: [{ translateY: withTiming(-ITEM_H, { duration: 200 }) }] };
    }
    if (from > hoverAt && index < from && index >= hoverAt) {
      return { transform: [{ translateY: withTiming(ITEM_H, { duration: 200 }) }] };
    }

    return { transform: [{ translateY: withTiming(0, { duration: 200 }) }] };
  });

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      draggedIdx.value = index;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onFinalize(() => {
      const from = draggedIdx.value;
      const hoverAt = Math.max(0, Math.min(totalCount - 1, from + Math.round(dragY.value / ITEM_H)));
      dragY.value = 0;
      draggedIdx.value = -1;
      runOnJS(onDragEnd)(from, hoverAt);
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.row,
          { backgroundColor: colors.card, borderColor: colors.borderLight },
          !section.visible && styles.rowHidden,
          animStyle,
        ]}
        accessibilityHint="Maintenez appuyé pour réordonner"
      >
        <Text style={[styles.dragHandle, { color: colors.textFaint }]}>☰</Text>
        <Text style={styles.rowEmoji}>{section.emoji}</Text>
        <Text
          style={[
            styles.rowLabel,
            { color: colors.text },
            !section.visible && { color: colors.textFaint },
          ]}
          numberOfLines={1}
        >
          {section.label}
        </Text>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.arrowBtn, { backgroundColor: colors.cardAlt }, isFirst && styles.arrowBtnDisabled]}
            onPress={() => onMoveUp(index)}
            disabled={isFirst}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel="Monter"
            accessibilityRole="button"
          >
            <Text style={[styles.arrowText, { color: colors.textSub }]}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowBtn, { backgroundColor: colors.cardAlt }, isLast && styles.arrowBtnDisabled]}
            onPress={() => onMoveDown(index)}
            disabled={isLast}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel="Descendre"
            accessibilityRole="button"
          >
            <Text style={[styles.arrowText, { color: colors.textSub }]}>▼</Text>
          </TouchableOpacity>
          <Switch
            value={section.visible}
            onValueChange={() => onToggle(section.id)}
            trackColor={{ false: colors.switchOff, true: tint }}
            thumbColor={section.visible ? primary : colors.textFaint}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

// ─── Modal principal ──────────────────────────────────────────────────────────

export function DashboardPrefsModal({ sections: initialSections, smartSort: initialSmartSort, onSave, onClose }: Props) {
  const { primary, tint, colors } = useThemeColors();
  const [sections, setSections] = useState<SectionPref[]>(initialSections);
  const [smartSort, setSmartSort] = useState(initialSmartSort);
  const [isDragging, setIsDragging] = useState(false);

  // Shared values pour le drag (partagés entre tous les DraggableRow)
  const draggedIdx = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const toggleVisible = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setSections((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setSections((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleDragEnd = useCallback((from: number, to: number) => {
    setIsDragging(false);
    if (from === to) return;
    setSections((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const priorityLabels: Record<string, string> = {
    high: '⭐ Essentielles',
    medium: '📌 Secondaires',
    low: '💤 Optionnelles',
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={[styles.dragHandleBar, { backgroundColor: colors.separator }]} />
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.headerClose, { color: colors.textFaint }]}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Personnaliser</Text>
          <TouchableOpacity
            onPress={() => { onSave({ sections, smartSort }); onClose(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerSave, { color: primary }]}>Enregistrer</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.textMuted, borderBottomColor: colors.borderLight }]}>
          Affichez ou masquez des sections, et changez leur ordre en glissant ou avec les flèches.
        </Text>

        <View style={[styles.smartSortRow, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
          <View style={styles.smartSortInfo}>
            <Text style={[styles.smartSortLabel, { color: colors.text }]}>
              🪄 Tri intelligent
            </Text>
            <Text style={[styles.smartSortDesc, { color: colors.textMuted }]}>
              Réordonne les cartes selon le contexte (heure, urgences, données disponibles)
            </Text>
          </View>
          <Switch
            value={smartSort}
            onValueChange={setSmartSort}
            trackColor={{ false: colors.switchOff, true: tint }}
            thumbColor={smartSort ? primary : colors.textFaint}
          />
        </View>

        {smartSort && (
          <Text style={[styles.smartSortNote, { color: colors.textMuted }]}>
            L'ordre manuel ci-dessous sert de base — le tri intelligent le réajuste selon le contexte.
          </Text>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          scrollEnabled={!isDragging}
        >
          {sections.map((section, index) => {
            const prevPriority = index > 0 ? (sections[index - 1].priority ?? 'medium') : null;
            const curPriority = section.priority ?? 'medium';
            const showHeader = curPriority !== prevPriority;
            return (
              <View key={section.id}>
                {showHeader && (
                  <Text style={[styles.priorityHeader, { color: colors.textMuted }]}>
                    {priorityLabels[curPriority]}
                  </Text>
                )}
                <DraggableRow
                  section={section}
                  index={index}
                  totalCount={sections.length}
                  draggedIdx={draggedIdx}
                  dragY={dragY}
                  isFirst={index === 0}
                  isLast={index === sections.length - 1}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onToggle={toggleVisible}
                  onMoveUp={moveUp}
                  onMoveDown={moveDown}
                  colors={colors}
                  primary={primary}
                  tint={tint}
                />
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerClose: { fontSize: FontSize.title, padding: Spacing.xs },
  headerTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.heavy },
  headerSave: { fontSize: FontSize.body, fontWeight: FontWeight.bold, padding: Spacing.xs },
  hint: {
    fontSize: FontSize.label,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: 14,
    lineHeight: 19,
    borderBottomWidth: 1,
  },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.lg, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing['2xl'],
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: Spacing.xs,
    elevation: 2,
    borderWidth: 1,
  },
  rowHidden: {
    opacity: 0.4,
  },
  dragHandle: {
    fontSize: FontSize.lg,
    width: 20,
    textAlign: 'center',
  },
  rowEmoji: {
    fontSize: FontSize.titleLg,
    width: 28,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.2,
  },
  arrowText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },
  smartSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing['2xl'],
    marginTop: Spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: 14,
    borderWidth: 1,
  },
  smartSortInfo: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  smartSortLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  smartSortDesc: {
    fontSize: FontSize.label,
    marginTop: 2,
    lineHeight: 17,
  },
  smartSortNote: {
    fontSize: FontSize.label,
    fontStyle: 'italic',
    marginHorizontal: Spacing['3xl'],
    marginTop: Spacing.sm,
    lineHeight: 17,
  },
  priorityHeader: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
});
