/**
 * FeedPicker.tsx — Sheet picker crops pour nourrir le compagnon (Phase 42 D-02)
 *
 * Modal pageSheet qui liste toutes les combinaisons (cropId, grade) ayant qty > 0
 * dans l'inventaire du joueur. Affiche un badge d'affinité selon l'espèce du compagnon :
 *   • préférés (❤️) : tri en premier + bordure accentuée (D-04)
 *   • détestés (😖) : opacité 0.55 mais restent sélectionnables — le joueur peut
 *     « gâcher » un crop s'il le souhaite (D-03)
 *
 * Note sur les grades : l'inventaire stocke les grades en français
 * ('ordinaire' | 'beau' | 'superbe' | 'parfait' — cf. lib/mascot/grade-engine).
 * Le moteur de nourrissage (feedCompanion) attend les grades en anglais
 * ('ordinary' | 'good' | 'excellent' | 'perfect' — cf. companion-types).
 * La conversion se fait ici via GRADE_FR_TO_EN avant d'appeler onPick.
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import { CROP_CATALOG, type HarvestInventory } from '../../lib/mascot/types';
import {
  GRADE_ORDER,
  getGradeEmoji,
  getGradeLabelKey,
  type HarvestGrade as HarvestGradeFr,
} from '../../lib/mascot/grade-engine';
import {
  getAffinity,
  type HarvestGrade as HarvestGradeEn,
  type CompanionSpecies,
  type CropAffinity,
} from '../../lib/mascot/companion-types';

// ─────────────────────────────────────────────
// Conversion grades FR (inventaire) → EN (moteur feed)
// ─────────────────────────────────────────────

const GRADE_FR_TO_EN: Record<HarvestGradeFr, HarvestGradeEn> = {
  ordinaire: 'ordinary',
  beau:      'good',
  superbe:   'excellent',
  parfait:   'perfect',
};

/** Ordre d'affichage : du meilleur au moins bon (parfait d'abord dans un crop). */
const GRADE_DISPLAY_ORDER: HarvestGradeFr[] = ['parfait', 'superbe', 'beau', 'ordinaire'];

/** Rang affinité pour tri (préféré → neutre → détesté). */
const AFFINITY_RANK: Record<CropAffinity, number> = {
  preferred: 0,
  neutral:   1,
  hated:     2,
};

// ─────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────

export interface FeedPickerProps {
  visible: boolean;
  onClose: () => void;
  inventory: HarvestInventory;
  companionSpecies: CompanionSpecies;
  /** Callback invoqué avec le cropId et le grade en anglais (compatible feedCompanion). */
  onPick: (cropId: string, grade: HarvestGradeEn) => void;
}

interface Row {
  cropId: string;
  emoji: string;
  labelKey: string;
  gradeFr: HarvestGradeFr;
  gradeEn: HarvestGradeEn;
  qty: number;
  affinity: CropAffinity;
}

// ─────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────

export function FeedPicker({
  visible,
  onClose,
  inventory,
  companionSpecies,
  onPick,
}: FeedPickerProps) {
  const { t } = useTranslation();
  const { colors, primary } = useThemeColors();

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [cropId, entry] of Object.entries(inventory || {})) {
      const def = CROP_CATALOG.find(c => c.id === cropId);
      if (!def) continue;
      // HarvestInventoryEntry : soit `number` legacy (pré-Phase B), soit
      // `Partial<Record<HarvestGrade, number>>` (Phase B).
      const entryRecord: Partial<Record<HarvestGradeFr, number>> =
        typeof entry === 'number'
          ? { ordinaire: entry }
          : ((entry ?? {}) as Partial<Record<HarvestGradeFr, number>>);

      const affinity = getAffinity(companionSpecies, cropId);

      for (const gradeFr of GRADE_DISPLAY_ORDER) {
        const qty = entryRecord[gradeFr] ?? 0;
        if (qty <= 0) continue;
        out.push({
          cropId,
          emoji: def.emoji,
          labelKey: def.labelKey,
          gradeFr,
          gradeEn: GRADE_FR_TO_EN[gradeFr],
          qty,
          affinity,
        });
      }
    }

    // Tri : affinité (préféré d'abord), puis grade desc (parfait d'abord).
    out.sort((a, b) => {
      const rAff = AFFINITY_RANK[a.affinity] - AFFINITY_RANK[b.affinity];
      if (rAff !== 0) return rAff;
      // GRADE_ORDER est croissant (ordinaire → parfait) — on inverse.
      return GRADE_ORDER.indexOf(b.gradeFr) - GRADE_ORDER.indexOf(a.gradeFr);
    });
    return out;
  }, [inventory, companionSpecies]);

  const handlePick = useCallback(
    (row: Row) => {
      Haptics.selectionAsync().catch(() => {
        /* non-critical */
      });
      onPick(row.cropId, row.gradeEn);
      onClose();
    },
    [onPick, onClose],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.bg }]}
        edges={['bottom']}
      >
        <ModalHeader title="Nourrir le compagnon" onClose={onClose} />

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Récoltez quelque chose d'abord pour nourrir votre compagnon.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row, idx) => {
              const isHated = row.affinity === 'hated';
              const isPreferred = row.affinity === 'preferred';
              const cropName = t(row.labelKey);
              const gradeLabel = t(getGradeLabelKey(row.gradeFr));

              return (
                <Pressable
                  key={`${row.cropId}-${row.gradeFr}-${idx}`}
                  onPress={() => handlePick(row)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: colors.card,
                      borderColor: isPreferred ? primary : colors.border,
                      borderWidth: isPreferred ? 2 : 1,
                      opacity: isHated ? 0.55 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={styles.emoji}>{row.emoji}</Text>

                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: colors.text }]}>
                        {cropName}
                      </Text>
                      {isPreferred && (
                        <Text style={styles.affinityBadge} accessibilityLabel="Préféré">
                          ❤️
                        </Text>
                      )}
                      {isHated && (
                        <Text style={styles.affinityBadge} accessibilityLabel="Détesté">
                          😖
                        </Text>
                      )}
                    </View>
                    <View style={styles.gradeRow}>
                      <Text style={styles.gradeEmoji}>{getGradeEmoji(row.gradeFr)}</Text>
                      <Text style={[styles.gradeLabel, { color: colors.textMuted }]}>
                        {gradeLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.qtyBlock}>
                    <Text style={[styles.qty, { color: colors.text }]}>×{row.qty}</Text>
                  </View>
                </Pressable>
              );
            })}

            <Text style={[styles.footerHint, { color: colors.textMuted }]}>
              Astuce : les crops préférés donnent un buff XP renforcé. Les crops
              détestés ne donnent aucun bonus et déclenchent un "beurk".
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  list: {
    padding: Spacing['2xl'],
    gap: Spacing.md,
    paddingBottom: Spacing['4xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    gap: Spacing.xl,
  },
  emoji: {
    fontSize: 32,
  },
  info: {
    flex: 1,
    gap: Spacing.xxs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  affinityBadge: {
    fontSize: FontSize.body,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  gradeEmoji: {
    fontSize: FontSize.sm,
  },
  gradeLabel: {
    fontSize: FontSize.label,
  },
  qtyBlock: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  qty: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['4xl'],
    gap: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerHint: {
    fontSize: FontSize.label,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    lineHeight: 18,
  },
});
