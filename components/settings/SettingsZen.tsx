import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Chip } from '../ui/Chip';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export interface ZenConfig {
  enabled: boolean;
  excludedSections: string[];
}

export const DEFAULT_ZEN_CONFIG: ZenConfig = {
  enabled: true,
  excludedSections: [],
};

interface SettingsZenProps {
  zenConfig: ZenConfig;
  onSave: (config: ZenConfig) => Promise<void>;
}

const ZEN_SECTIONS = [
  { id: 'overdue',   emoji: '⚠️', label: 'Tâches en retard',     detail: 'Aucune tâche en retard' },
  { id: 'menage',    emoji: '🧹',  label: 'Ménage du jour',       detail: 'Toutes les tâches ménage faites' },
  { id: 'photos',    emoji: '📸',  label: 'Photo du jour',        detail: 'Photo prise pour chaque enfant' },
  { id: 'meals',     emoji: '🍽️', label: 'Repas du jour',        detail: 'Au moins un repas planifié' },
  { id: 'recipes',   emoji: '📖',  label: 'Idée recette',         detail: 'Repas du jour déjà planifiés' },
  { id: 'courses',   emoji: '🛒',  label: 'Liste de courses',     detail: 'Liste de courses vide' },
  { id: 'rdvs',      emoji: '📅',  label: 'Rendez-vous',          detail: 'Aucun RDV aujourd\'hui' },
  { id: 'gratitude', emoji: '🙏',  label: 'Gratitude',            detail: 'Gratitude du jour complétée' },
] as const;

export function SettingsZen({ zenConfig, onSave }: SettingsZenProps) {
  const { primary, colors } = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  const handleToggleEnabled = () => {
    onSave({ ...zenConfig, enabled: !zenConfig.enabled });
  };

  const handleToggleSection = (sectionId: string) => {
    const excluded = new Set(zenConfig.excludedSections);
    if (excluded.has(sectionId)) {
      excluded.delete(sectionId);
    } else {
      excluded.add(sectionId);
    }
    onSave({ ...zenConfig, excludedSections: [...excluded] });
  };

  const isSectionRequired = (sectionId: string) => {
    return !zenConfig.excludedSections.includes(sectionId);
  };

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Mode Zen">
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>🧘 Mode zen</Text>

      {/* Card 1 : Description + toggle global */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.description, { color: colors.textSub }]}>
          Quand toutes les conditions sont remplies, le dashboard affiche un espace de calme avec un cercle de respiration et un aperçu de demain.
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleEmoji}>🧘</Text>
          <View style={styles.toggleContent}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Activer le mode zen</Text>
            <Text style={[styles.toggleDetail, { color: colors.textMuted }]}>Cercle de respiration + aperçu de demain</Text>
          </View>
          <Switch
            value={zenConfig.enabled}
            onValueChange={handleToggleEnabled}
            trackColor={{ true: primary, false: colors.switchOff }}
            thumbColor={colors.onPrimary}
            accessibilityRole="switch"
            accessibilityLabel="Activer le mode zen"
          />
        </View>
      </View>

      {/* Card 2 : Toggles par section (collapsible, visible seulement si zen activé) */}
      {zenConfig.enabled && (
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card, marginTop: Spacing.lg }]}>
          <TouchableOpacity
            onPress={() => setExpanded((e) => !e)}
            activeOpacity={0.7}
            style={styles.collapseHeader}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Réduire les sections requises' : 'Afficher les sections requises'}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.subTitle, { color: colors.text }]}>Sections requises</Text>
              <Text style={[styles.description, { color: colors.textSub }]}>
                {expanded
                  ? 'Ces sections doivent être terminées ou vides pour atteindre l\'état zen.'
                  : `${ZEN_SECTIONS.length - zenConfig.excludedSections.length}/${ZEN_SECTIONS.length} sections actives`
                }
              </Text>
            </View>
            <Text style={{ fontSize: FontSize.lg, color: colors.textMuted }}>
              {expanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {expanded && ZEN_SECTIONS.map((s, i) => {
            const isLast = i === ZEN_SECTIONS.length - 1;
            const required = isSectionRequired(s.id);
            return (
              <View
                key={s.id}
                style={[
                  styles.toggleRow,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
              >
                <Text style={styles.toggleEmoji}>{s.emoji}</Text>
                <View style={styles.toggleContent}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>{s.label}</Text>
                    {s.id === 'meals' && (
                      <Chip label="Toujours visible" size="sm" />
                    )}
                  </View>
                  <Text style={[styles.toggleDetail, { color: colors.textMuted }]}>{s.detail}</Text>
                </View>
                <Switch
                  value={required}
                  onValueChange={() => handleToggleSection(s.id)}
                  trackColor={{ true: primary, false: colors.switchOff }}
                  thumbColor={colors.onPrimary}
                  accessibilityRole="switch"
                  accessibilityLabel={`${s.label} requis pour le mode zen`}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.sm },
  description: { fontSize: FontSize.sm, lineHeight: 20 },
  subTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.md },
  toggleEmoji: { fontSize: FontSize.heading },
  toggleContent: { flex: 1 },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  toggleDetail: { fontSize: FontSize.caption, marginTop: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
