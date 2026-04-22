/**
 * FeedPicker.tsx — Sheet picker crops pour nourrir le compagnon (Phase 42 D-02)
 *
 * Style "cozy farm game" aligné sur TreeShop / BuildingShopSheet :
 *   - cadre bois sombre + auvent rayé + parchemin + close bouton rond
 *
 * Liste toutes les combinaisons (cropId, grade) ayant qty > 0 :
 *   • préférés (❤️) : tri en premier + bordure accentuée (D-04)
 *   • détestés (😖) : opacité 0.55 mais sélectionnables (D-03)
 *
 * Conversion grades FR (inventaire) → EN (moteur feed) via GRADE_FR_TO_EN.
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Farm } from '../../constants/farm-theme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

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

const GRADE_DISPLAY_ORDER: HarvestGradeFr[] = ['parfait', 'superbe', 'beau', 'ordinaire'];

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

// ── Auvent rayé ───────────────────────────────

function AwningStripes() {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
      <View style={styles.awningShadow} />
      <View style={styles.awningScallop}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
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

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [cropId, entry] of Object.entries(inventory || {})) {
      const def = CROP_CATALOG.find(c => c.id === cropId);
      if (!def) continue;
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

    out.sort((a, b) => {
      const rAff = AFFINITY_RANK[a.affinity] - AFFINITY_RANK[b.affinity];
      if (rAff !== 0) return rAff;
      return GRADE_ORDER.indexOf(b.gradeFr) - GRADE_ORDER.indexOf(a.gradeFr);
    });
    return out;
  }, [inventory, companionSpecies]);

  const handlePick = useCallback(
    (row: Row) => {
      Haptics.selectionAsync().catch(() => {});
      onPick(row.cropId, row.gradeEn);
      onClose();
    },
    [onPick, onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayBg}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.woodFrame}>
          <View style={styles.woodFrameInner}>
            <AwningStripes />

            <View style={styles.parchment}>
              <View style={styles.handle} />

              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.farmTitle}
              >
                <Text style={styles.farmTitleText}>
                  Nourrir le compagnon
                </Text>
              </Animated.View>

              {rows.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyText}>
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
                      <Animated.View
                        key={`${row.cropId}-${row.gradeFr}-${idx}`}
                        entering={FadeIn.delay(idx * 40).duration(240)}
                      >
                        <Pressable
                          onPress={() => handlePick(row)}
                          style={({ pressed }) => [
                            styles.row,
                            isPreferred && styles.rowPreferred,
                            isHated && styles.rowHated,
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          {/* Emoji rond */}
                          <View style={styles.emojiCircle}>
                            <Text style={styles.emoji}>{row.emoji}</Text>
                          </View>

                          {/* Infos */}
                          <View style={styles.info}>
                            <View style={styles.nameRow}>
                              <Text style={styles.name} numberOfLines={1}>
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
                              <Text style={styles.gradeLabel}>{gradeLabel}</Text>
                            </View>
                          </View>

                          {/* Qty badge */}
                          <View style={styles.qtyBadge}>
                            <Text style={styles.qtyText}>×{row.qty}</Text>
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  })}

                  <Text style={styles.footerHint}>
                    Astuce : les crops préférés donnent un buff XP renforcé. Les
                    crops détestés ne donnent aucun bonus.
                  </Text>
                </ScrollView>
              )}
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Wood frame ──
  woodFrame: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    borderRadius: Radius['2xl'],
    backgroundColor: Farm.woodDark,
    padding: 5,
    ...Shadows.xl,
    maxHeight: '85%',
  },
  woodFrameInner: {
    borderRadius: Radius.xl,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    flexShrink: 1,
  },

  // ── Auvent ──
  awning: {
    height: 36,
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  awningStripe: {
    flex: 1,
  },
  awningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  awningScallop: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
  awningScallopDot: {
    flex: 1,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  // ── Parchemin ──
  parchment: {
    backgroundColor: Farm.parchmentDark,
    flexShrink: 1,
    paddingBottom: Spacing['3xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Farm.woodHighlight,
  },
  farmTitle: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  farmTitleText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },

  // ── Liste ──
  list: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  rowPreferred: {
    borderWidth: 2,
    borderColor: Farm.greenBtn,
    backgroundColor: Farm.parchment,
  },
  rowHated: {
    opacity: 0.55,
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
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
    color: Farm.brownTextSub,
  },
  qtyBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    minWidth: 44,
    alignItems: 'center',
  },
  qtyText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },

  // ── Empty ──
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
    color: Farm.brownTextSub,
  },

  // ── Footer hint ──
  footerHint: {
    fontSize: FontSize.label,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    lineHeight: 18,
    color: Farm.brownTextSub,
  },

  // ── Close button ──
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },
});
