/**
 * CodexEntryDetailModal.tsx — Mini-modal détail d'une entrée codex (Phase 17, per D-02/D-04/D-05)
 *
 * Pattern Stardew wiki : icône + nom en haut, lore narratif, stats brutes en bas.
 * Switch exhaustif sur entry.kind pour afficher les stats spécifiques à chaque variante
 * via les getters anti-drift de lib/codex/stats.ts (D-05).
 *
 * Les getters retournent l'objet catalogue complet (CropDefinition, BuildingDefinition, ...)
 * ou undefined. On sérialise en paires clé/valeur en filtrant les valeurs non primitives
 * (objets imbriqués, arrays) pour rendre une liste lisible.
 *
 * Cas particulier : le kind 'loot' n'a pas de getter dédié dans lib/codex/stats.ts — on
 * affiche un placeholder '—' pour cette catégorie (D-05 : fallback gracieux, pas d'erreur).
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import type { CodexEntry } from '../../lib/codex/types';
import {
  getCropStats,
  getAnimalStats,
  getBuildingStats,
  getCraftStats,
  getTechStats,
  getCompanionStats,
  getSagaStats,
  getQuestStats,
  getSeasonalStats,
} from '../../lib/codex/stats';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface CodexEntryDetailModalProps {
  visible: boolean;
  entry: CodexEntry | null;
  onClose: () => void;
}

/**
 * Convertit un objet catalogue en paires clé/valeur affichables.
 * Ignore les valeurs non primitives (objets, arrays) pour garder un rendu simple et lisible.
 */
function toDisplayRows(
  source: Record<string, unknown> | undefined | null,
): Array<[string, string]> {
  if (!source) return [];
  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(source)) {
    if (value === null || value === undefined) continue;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      rows.push([key, String(value)]);
    }
  }
  return rows;
}

export function CodexEntryDetailModal({
  visible,
  entry,
  onClose,
}: CodexEntryDetailModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  if (!entry) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={onClose}
      >
        <View />
      </Modal>
    );
  }

  // Switch exhaustif pour les stats (D-05) — compilateur enforce la couverture sur CodexKind
  const renderStats = (): React.ReactNode => {
    let rows: Array<[string, string]> = [];
    switch (entry.kind) {
      case 'crop': {
        rows = toDisplayRows(getCropStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'animal': {
        rows = toDisplayRows(getAnimalStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'building': {
        rows = toDisplayRows(getBuildingStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'craft': {
        rows = toDisplayRows(getCraftStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'tech': {
        rows = toDisplayRows(getTechStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'companion': {
        rows = toDisplayRows(getCompanionStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'loot': {
        // Pas de getter dédié pour loot — fallback placeholder (D-05)
        return (
          <Text style={[styles.lorePlaceholder, { color: colors.textMuted }]}>
            —
          </Text>
        );
      }
      case 'seasonal': {
        rows = toDisplayRows(getSeasonalStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'saga': {
        rows = toDisplayRows(getSagaStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      case 'quest': {
        rows = toDisplayRows(getQuestStats(entry) as Record<string, unknown> | undefined);
        break;
      }
      default: {
        // Exhaustiveness check — erreur TS si un CodexKind est oublié
        const _exhaustive: never = entry;
        return _exhaustive;
      }
    }

    if (rows.length === 0) {
      return (
        <Text style={[styles.lorePlaceholder, { color: colors.textMuted }]}>—</Text>
      );
    }

    return <StatsBlock rows={rows} colors={colors} />;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              onClose();
            }}
            style={styles.closeBtn}
            accessibilityLabel={t('codex:detail.close')}
          >
            <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
          </TouchableOpacity>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {t(entry.nameKey)}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Icône + nom */}
          <View style={styles.iconWrap}>
            <Text style={styles.bigIcon}>{entry.iconRef ?? '❓'}</Text>
          </View>

          {/* Lore en haut (D-04) */}
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
            {t('codex:detail.lore')}
          </Text>
          <Text style={[styles.lore, { color: colors.text }]}>
            {t(entry.loreKey)}
          </Text>

          {/* Stats en bas (D-04) */}
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.textSub, marginTop: Spacing['3xl'] },
            ]}
          >
            {t('codex:detail.stats')}
          </Text>
          {renderStats()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Sous-composant StatsBlock — rend une liste clé/valeur.
 * La borderBottomColor est injectée inline depuis useThemeColors() (convention CLAUDE.md :
 * jamais de couleur hardcodée, pattern identique aux autres sheets mascot).
 */
function StatsBlock({
  rows,
  colors,
}: {
  rows: Array<[string, string]>;
  colors: ReturnType<typeof useThemeColors>['colors'];
}) {
  return (
    <View style={styles.statsBlock}>
      {rows.map(([key, value]) => (
        <View
          key={key}
          style={[
            styles.statRow,
            { borderBottomColor: colors.text + '22' },
          ]}
        >
          <Text style={[styles.statKey, { color: colors.textMuted }]}>
            {key}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: Spacing['2xl'],
    paddingBottom: Spacing['5xl'],
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  bigIcon: { fontSize: 72 },
  sectionLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  lore: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  lorePlaceholder: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
    marginTop: Spacing.md,
  },
  statsBlock: { marginTop: Spacing.md },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statKey: {
    fontSize: FontSize.sm,
    opacity: 0.8,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Borders — radius réservé pour cohérence future
  _reserved: {
    borderRadius: Radius.md,
  },
});
