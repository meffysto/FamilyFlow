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

export interface SectionPref {
  id: string;
  label: string;
  emoji: string;
  visible: boolean;
}

interface Props {
  sections: SectionPref[];
  onSave: (sections: SectionPref[]) => void;
  onClose: () => void;
}

export function DashboardPrefsModal({ sections: initialSections, onSave, onClose }: Props) {
  const { primary, tint, colors } = useThemeColors();
  const [sections, setSections] = useState<SectionPref[]>(initialSections);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.headerClose, { color: colors.textFaint }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Personnaliser</Text>
        <TouchableOpacity
          onPress={() => { onSave(sections); onClose(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.headerSave, { color: primary }]}>Enregistrer</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.hint, { color: colors.textMuted, borderBottomColor: colors.borderLight }]}>
        Affichez ou masquez des sections, et changez leur ordre d'apparition sur le dashboard.
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {sections.map((section, index) => (
          <View
            key={section.id}
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
        ))}
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
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerClose: { fontSize: 20, padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSave: { fontSize: 15, fontWeight: '700', padding: 4 },
  hint: {
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 14,
    lineHeight: 19,
    borderBottomWidth: 1,
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  rowHidden: {
    opacity: 0.4,
  },
  rowEmoji: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.2,
  },
  arrowText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
