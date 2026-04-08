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
import type { TFunction } from 'i18next';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import type { CodexEntry, CodexKind } from '../../lib/codex/types';
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

/**
 * Whitelist des champs à afficher par kind — garde uniquement ce qui est
 * compréhensible par un enfant. Les métadonnées techniques (id, labelKey,
 * emoji, techRequired, etc.) sont volontairement exclues.
 */
const STAT_WHITELIST: Record<CodexKind, readonly string[]> = {
  crop: ['cost', 'harvestReward', 'tasksPerStage', 'minTreeStage'],
  animal: ['cost', 'rarity', 'minStage'],
  building: ['cost', 'dailyIncome', 'resourceType', 'minTreeStage'],
  craft: ['sellValue', 'xpBonus', 'minTreeStage'],
  tech: ['branch', 'order', 'cost'],
  companion: ['rarity'],
  loot: [],
  seasonal: [],
  saga: [],
  quest: [],
};

interface CodexEntryDetailModalProps {
  visible: boolean;
  entry: CodexEntry | null;
  onClose: () => void;
}

/**
 * Construit les lignes affichables pour un kind donné en utilisant la whitelist
 * et en traduisant labels + valeurs via i18n. Les champs non whitelistés ou
 * sans traduction de label sont ignorés (évite de dumper du camelCase brut).
 */
function buildDetailRows(
  kind: CodexKind,
  source: Record<string, unknown> | undefined | null,
  t: TFunction,
): Array<[string, string]> {
  if (!source) return [];
  const whitelist = STAT_WHITELIST[kind] ?? [];
  const rows: Array<[string, string]> = [];
  for (const key of whitelist) {
    const raw = source[key];
    if (raw === null || raw === undefined) continue;
    const valType = typeof raw;
    if (valType !== 'string' && valType !== 'number' && valType !== 'boolean') continue;

    const label = t(`codex:stats.${key}`, { defaultValue: '' });
    if (!label) continue;

    // Tente de traduire les valeurs string (enums type 'pousse', 'rare', 'oeuf'...)
    let value = String(raw);
    if (valType === 'string') {
      const translated = t(`codex:values.${value}`, { defaultValue: '' });
      if (translated) value = translated;
    }
    rows.push([label, value]);
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
    let source: Record<string, unknown> | undefined;
    switch (entry.kind) {
      case 'crop':
        source = getCropStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'animal':
        source = getAnimalStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'building':
        source = getBuildingStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'craft':
        source = getCraftStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'tech':
        source = getTechStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'companion':
        source = getCompanionStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'loot':
        // Pas de getter dédié pour loot — whitelist vide, lore suffit
        source = undefined;
        break;
      case 'seasonal':
        source = getSeasonalStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'saga':
        source = getSagaStats(entry) as Record<string, unknown> | undefined;
        break;
      case 'quest':
        source = getQuestStats(entry) as Record<string, unknown> | undefined;
        break;
      default: {
        // Exhaustiveness check — erreur TS si un CodexKind est oublié
        const _exhaustive: never = entry;
        return _exhaustive;
      }
    }

    const rows = buildDetailRows(entry.kind, source, t);
    if (rows.length === 0) {
      return null;
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

          {/* Stats en bas (D-04) — section masquée si aucune stat à afficher */}
          {(() => {
            const statsNode = renderStats();
            if (!statsNode) return null;
            return (
              <>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.textSub, marginTop: Spacing['3xl'] },
                  ]}
                >
                  {t('codex:detail.stats')}
                </Text>
                {statsNode}
              </>
            );
          })()}
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
