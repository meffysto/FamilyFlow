/**
 * DashboardPrefsModal.tsx — Configure dashboard section order and visibility
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export function DashboardPrefsModal({ sections: initialSections, smartSort: initialSmartSort, onSave, onClose }: Props) {
  const { primary, tint, colors } = useThemeColors();
  const [sections, setSections] = useState<SectionPref[]>(initialSections);
  const [smartSort, setSmartSort] = useState(initialSmartSort);

  const toggleVisible = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setSections((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setSections((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const renderRow = (section: SectionPref, index: number) => (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.borderLight },
        !section.visible && styles.rowHidden,
      ]}
    >
      <Text style={styles.rowEmoji}>{section.emoji}</Text>
      <Text style={[
        styles.rowLabel,
        { color: colors.text },
        !section.visible && { color: colors.textFaint },
      ]}>
        {section.label}
      </Text>
      <View style={styles.rowActions}>
        <TouchableOpacity
          style={[styles.arrowBtn, { backgroundColor: colors.cardAlt }, index === 0 && styles.arrowBtnDisabled]}
          onPress={() => moveUp(index)}
          disabled={index === 0}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Text style={[styles.arrowText, { color: colors.textSub }]}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.arrowBtn, { backgroundColor: colors.cardAlt }, index === sections.length - 1 && styles.arrowBtnDisabled]}
          onPress={() => moveDown(index)}
          disabled={index === sections.length - 1}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Text style={[styles.arrowText, { color: colors.textSub }]}>▼</Text>
        </TouchableOpacity>
        <Switch
          value={section.visible}
          onValueChange={() => toggleVisible(section.id)}
          trackColor={{ false: colors.switchOff, true: tint }}
          thumbColor={section.visible ? primary : colors.textFaint}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
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
        Affichez ou masquez des sections, et changez leur ordre d'apparition sur le dashboard.
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {sections.map((section, index) => {
          // Afficher un header de catégorie si c'est le premier de sa priorité
          const prevPriority = index > 0 ? (sections[index - 1].priority ?? 'medium') : null;
          const curPriority = section.priority ?? 'medium';
          const showHeader = curPriority !== prevPriority;
          const priorityLabels: Record<string, string> = {
            high: '⭐ Essentielles',
            medium: '📌 Secondaires',
            low: '💤 Optionnelles',
          };
          return (
            <View key={section.id}>
              {showHeader && (
                <Text style={[styles.priorityHeader, { color: colors.textMuted }]}>
                  {priorityLabels[curPriority]}
                </Text>
              )}
              {renderRow(section, index)}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  dragHandle: {
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
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.xl,
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
  rowEmoji: {
    fontSize: FontSize.titleLg,
    width: 30,
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
    gap: Spacing.sm,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.2,
  },
  arrowText: {
    fontSize: FontSize.code,
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
