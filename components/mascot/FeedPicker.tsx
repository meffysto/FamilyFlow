/**
 * FeedPicker.tsx — Sheet picker crops pour nourrir le compagnon
 *
 * Design compact : tuiles par crop (pas par grade) + filtre affinité + "Meilleur choix" en tête.
 * Tap sur une tuile ouvre un mini-picker de grade (overlay interne).
 *
 * Style "cozy farm game" aligné sur TreeShop / BuildingShopSheet.
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Farm } from '../../constants/farm-theme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

import { CROP_CATALOG, type HarvestInventory } from '../../lib/mascot/types';
import { CROP_ICONS } from '../../lib/mascot/crop-sprites';
import {
  GRADE_ORDER,
  getGradeEmoji,
  getGradeLabelKey,
  type HarvestGrade as HarvestGradeFr,
} from '../../lib/mascot/grade-engine';
import {
  getAffinity,
  getBuffForCrop,
  GRADE_BUFF_TABLE,
  type HarvestGrade as HarvestGradeEn,
  type CompanionSpecies,
  type CropAffinity,
} from '../../lib/mascot/companion-types';
import { computeFeedXp } from '../../lib/mascot/companion-engine';

// ─────────────────────────────────────────────
// Conversion grades FR (inventaire) → EN (moteur feed)
// ─────────────────────────────────────────────

const GRADE_FR_TO_EN: Record<HarvestGradeFr, HarvestGradeEn> = {
  ordinaire: 'ordinary',
  beau:      'good',
  superbe:   'excellent',
  parfait:   'perfect',
};

// Grades du meilleur au moins bon (pour affichage)
const GRADE_DISPLAY_ORDER: HarvestGradeFr[] = ['parfait', 'superbe', 'beau', 'ordinaire'];

// Format durée buff : "90min" ou "1h30"
function formatBuffDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
}

type FilterKey = 'all' | CropAffinity;

const FILTER_META: Record<FilterKey, { emoji: string; label: string; color: string }> = {
  all:       { emoji: '🌾', label: 'Tous',     color: Farm.brownText },
  preferred: { emoji: '❤️', label: 'Préférés', color: Farm.greenBtn },
  neutral:   { emoji: '😊', label: 'Neutres',  color: Farm.brownTextSub },
  hated:     { emoji: '😖', label: 'Détestés', color: '#C04A3A' },
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
  onDismiss?: () => void;
}

interface CropCard {
  cropId: string;
  emoji: string;
  labelKey: string;
  totalQty: number;
  byGrade: Partial<Record<HarvestGradeFr, number>>;
  affinity: CropAffinity;
  bestGrade: HarvestGradeFr | null;
}

interface BestChoice extends CropCard {
  buffPct: number;
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
  onDismiss,
}: FeedPickerProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);

  // Reset state quand on ouvre/ferme
  useEffect(() => {
    if (!visible) {
      setFilter('all');
      setSelectedCropId(null);
    }
  }, [visible]);

  // Construire les cartes crops (agrégées toutes grades)
  const allCards = useMemo<CropCard[]>(() => {
    const cards: CropCard[] = [];
    for (const [cropId, entry] of Object.entries(inventory || {})) {
      const def = CROP_CATALOG.find(c => c.id === cropId);
      if (!def) continue;
      const entryRecord: Partial<Record<HarvestGradeFr, number>> =
        typeof entry === 'number'
          ? { ordinaire: entry }
          : ((entry ?? {}) as Partial<Record<HarvestGradeFr, number>>);

      let totalQty = 0;
      let bestGrade: HarvestGradeFr | null = null;
      for (const gradeFr of GRADE_DISPLAY_ORDER) {
        const qty = entryRecord[gradeFr] ?? 0;
        if (qty > 0) {
          totalQty += qty;
          if (!bestGrade) bestGrade = gradeFr;
        }
      }
      if (totalQty === 0) continue;

      cards.push({
        cropId,
        emoji: def.emoji,
        labelKey: def.labelKey,
        totalQty,
        byGrade: entryRecord,
        affinity: getAffinity(companionSpecies, cropId),
        bestGrade,
      });
    }
    return cards;
  }, [inventory, companionSpecies]);

  // Meilleur choix : top 3 préférés triés par grade desc
  const bestChoices = useMemo<BestChoice[]>(() => {
    const preferred = allCards.filter(c => c.affinity === 'preferred' && c.bestGrade);
    const sorted = [...preferred].sort((a, b) => {
      const ga = GRADE_ORDER.indexOf(a.bestGrade!);
      const gb = GRADE_ORDER.indexOf(b.bestGrade!);
      if (gb !== ga) return gb - ga;
      return b.totalQty - a.totalQty;
    });
    return sorted.slice(0, 3).map(c => {
      const buff = getBuffForCrop(
        GRADE_FR_TO_EN[c.bestGrade!],
        companionSpecies,
        c.cropId,
      );
      const buffPct = buff ? Math.round((buff.multiplier - 1) * 100) : 0;
      return { ...c, buffPct };
    });
  }, [allCards, companionSpecies]);

  // Cartes filtrées (sans les best choices pour éviter duplication)
  const filteredCards = useMemo<CropCard[]>(() => {
    const bestIds = new Set(bestChoices.map(b => b.cropId));
    const filtered = allCards.filter(c => {
      if (bestIds.has(c.cropId)) return false;
      if (filter === 'all') return true;
      return c.affinity === filter;
    });
    // Tri : préférés > neutres > détestés, puis grade desc, puis qty desc
    const affinityOrder: Record<CropAffinity, number> = { preferred: 0, neutral: 1, hated: 2 };
    return filtered.sort((a, b) => {
      const aa = affinityOrder[a.affinity] - affinityOrder[b.affinity];
      if (aa !== 0) return aa;
      const ga = a.bestGrade ? GRADE_ORDER.indexOf(a.bestGrade) : -1;
      const gb = b.bestGrade ? GRADE_ORDER.indexOf(b.bestGrade) : -1;
      if (gb !== ga) return gb - ga;
      return b.totalQty - a.totalQty;
    });
  }, [allCards, bestChoices, filter]);

  const selectedCard = useMemo(
    () => allCards.find(c => c.cropId === selectedCropId) ?? null,
    [allCards, selectedCropId],
  );

  const handlePickDirect = useCallback(
    (cropId: string, gradeFr: HarvestGradeFr) => {
      Haptics.selectionAsync().catch(() => {});
      onPick(cropId, GRADE_FR_TO_EN[gradeFr]);
      onClose();
    },
    [onPick, onClose],
  );

  const handleTileTap = useCallback((card: CropCard) => {
    Haptics.selectionAsync().catch(() => {});
    // Si 1 seul grade disponible, feed direct
    const availableGrades = GRADE_DISPLAY_ORDER.filter(g => (card.byGrade[g] ?? 0) > 0);
    if (availableGrades.length === 1) {
      handlePickDirect(card.cropId, availableGrades[0]);
      return;
    }
    setSelectedCropId(card.cropId);
  }, [handlePickDirect]);

  const totalCount = allCards.length;
  const counts = useMemo(() => ({
    all:       allCards.length,
    preferred: allCards.filter(c => c.affinity === 'preferred').length,
    neutral:   allCards.filter(c => c.affinity === 'neutral').length,
    hated:     allCards.filter(c => c.affinity === 'hated').length,
  }), [allCards]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
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

              {totalCount === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyText}>
                    Récoltez quelque chose d&apos;abord pour nourrir votre compagnon.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.list}
                  showsVerticalScrollIndicator={false}
                >
                  {/* ── Meilleur choix ─────────────────────── */}
                  {bestChoices.length > 0 && (
                    <View style={styles.bestSection}>
                      <View style={styles.bestHeader}>
                        <Text style={styles.bestHeaderEmoji}>⭐</Text>
                        <Text style={styles.bestHeaderLabel}>Meilleur choix</Text>
                      </View>
                      <View style={styles.bestRow}>
                        {bestChoices.map((b, idx) => (
                          <Animated.View
                            key={b.cropId}
                            entering={FadeInDown.delay(idx * 60).springify().damping(14)}
                            style={styles.bestTileWrap}
                          >
                            <Pressable
                              onPress={() => handlePickDirect(b.cropId, b.bestGrade!)}
                              style={({ pressed }) => [
                                styles.bestTile,
                                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                              ]}
                            >
                              <View style={styles.bestTileHeart}>
                                <Text style={styles.bestTileHeartText}>❤️</Text>
                              </View>
                              {CROP_ICONS[b.cropId] ? (
                                <Image source={CROP_ICONS[b.cropId]} style={styles.bestTileSprite} />
                              ) : (
                                <Text style={styles.bestTileEmoji}>{b.emoji}</Text>
                              )}
                              <Text style={styles.bestTileName} numberOfLines={1}>
                                {t(b.labelKey)}
                              </Text>
                              <View style={styles.bestTileMeta}>
                                <Text style={styles.bestTileGrade}>
                                  {getGradeEmoji(b.bestGrade!)}
                                </Text>
                                <View style={styles.bestTileBuff}>
                                  <Text style={styles.bestTileBuffText}>+{b.buffPct}%</Text>
                                </View>
                              </View>
                              <Text style={styles.bestTileDuration}>
                                ⏱ {formatBuffDuration(GRADE_BUFF_TABLE[GRADE_FR_TO_EN[b.bestGrade!]].durationSec)}
                              </Text>
                            </Pressable>
                          </Animated.View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* ── Filtre segmenté ─────────────────────── */}
                  <View style={styles.filterRow}>
                    {(['all', 'preferred', 'neutral', 'hated'] as FilterKey[]).map(key => {
                      const meta = FILTER_META[key];
                      const isActive = filter === key;
                      const count = counts[key];
                      return (
                        <Pressable
                          key={key}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setFilter(key);
                          }}
                          style={({ pressed }) => [
                            styles.filterBtn,
                            isActive && { backgroundColor: meta.color, borderColor: meta.color },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Text style={styles.filterEmoji}>{meta.emoji}</Text>
                          <Text
                            style={[
                              styles.filterCount,
                              isActive && { color: '#FFFFFF' },
                            ]}
                          >
                            {count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* ── Grille crops ────────────────────────── */}
                  {filteredCards.length === 0 ? (
                    <View style={styles.emptyFilter}>
                      <Text style={styles.emptyFilterText}>
                        Aucun crop dans cette catégorie.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.grid}>
                      {filteredCards.map((card, idx) => {
                        const isHated = card.affinity === 'hated';
                        const isPreferred = card.affinity === 'preferred';
                        const borderColor = isPreferred
                          ? Farm.greenBtn
                          : isHated
                            ? '#C04A3A'
                            : Farm.woodHighlight;
                        const tileXp = card.bestGrade
                          ? computeFeedXp(GRADE_FR_TO_EN[card.bestGrade], card.affinity)
                          : 0;
                        return (
                          <Animated.View
                            key={card.cropId}
                            entering={FadeIn.delay(idx * 25).duration(220)}
                            style={styles.gridItem}
                          >
                            <Pressable
                              onPress={() => handleTileTap(card)}
                              style={({ pressed }) => [
                                styles.tile,
                                { borderColor },
                                isPreferred && styles.tilePreferred,
                                isHated && { opacity: 0.65 },
                                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                              ]}
                            >
                              <View style={styles.tileAffinity}>
                                <Text style={styles.tileAffinityEmoji}>
                                  {FILTER_META[card.affinity].emoji}
                                </Text>
                              </View>
                              {CROP_ICONS[card.cropId] ? (
                                <Image source={CROP_ICONS[card.cropId]} style={styles.tileSprite} />
                              ) : (
                                <Text style={styles.tileEmoji}>{card.emoji}</Text>
                              )}
                              <Text style={styles.tileName} numberOfLines={1}>
                                {t(card.labelKey)}
                              </Text>
                              <View style={styles.tileFooter}>
                                <Text style={styles.tileQty}>×{card.totalQty}</Text>
                                {card.bestGrade && (
                                  <Text style={styles.tileGrade}>
                                    {getGradeEmoji(card.bestGrade)}
                                  </Text>
                                )}
                              </View>
                              {tileXp > 0 && (
                                <View style={styles.tileXpBadge}>
                                  <Text style={styles.tileXpBadgeText}>+{tileXp} XP</Text>
                                </View>
                              )}
                            </Pressable>
                          </Animated.View>
                        );
                      })}
                    </View>
                  )}

                  <Text style={styles.footerHint}>
                    Astuce : nourrir avec un crop préféré + grade parfait donne
                    le buff XP maximal (+19.5% pendant 1h30).
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

            {/* ── Grade picker overlay (sub-sheet) ─── */}
            {selectedCard && (
              <Pressable
                style={styles.gradeOverlay}
                onPress={() => setSelectedCropId(null)}
              >
                <Animated.View
                  entering={FadeIn.duration(160)}
                  style={styles.gradeCard}
                >
                  <Pressable onPress={() => {}} style={styles.gradeCardInner}>
                    <View style={styles.gradeCardHeader}>
                      {CROP_ICONS[selectedCard.cropId] ? (
                        <Image source={CROP_ICONS[selectedCard.cropId]} style={styles.gradeCardSprite} />
                      ) : (
                        <Text style={styles.gradeCardEmoji}>{selectedCard.emoji}</Text>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.gradeCardName}>{t(selectedCard.labelKey)}</Text>
                        <Text style={styles.gradeCardSub}>Choisir un grade</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSelectedCropId(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.gradeCardClose}
                      >
                        <Text style={styles.gradeCardCloseText}>{'✕'}</Text>
                      </TouchableOpacity>
                    </View>

                    {GRADE_DISPLAY_ORDER.map(gradeFr => {
                      const qty = selectedCard.byGrade[gradeFr] ?? 0;
                      if (qty <= 0) return null;
                      const gradeEn = GRADE_FR_TO_EN[gradeFr];
                      const xp = computeFeedXp(gradeEn, selectedCard.affinity);
                      return (
                        <Pressable
                          key={gradeFr}
                          onPress={() => handlePickDirect(selectedCard.cropId, gradeFr)}
                          style={({ pressed }) => [
                            styles.gradeOption,
                            pressed && { opacity: 0.8, backgroundColor: Farm.parchment },
                          ]}
                        >
                          <View style={styles.gradeOptionIconWrap}>
                            {CROP_ICONS[selectedCard.cropId] ? (
                              <Image
                                source={CROP_ICONS[selectedCard.cropId]}
                                style={styles.gradeOptionSprite}
                              />
                            ) : (
                              <Text style={styles.gradeOptionEmoji}>{selectedCard.emoji}</Text>
                            )}
                            <View style={styles.gradeOptionBadge}>
                              <Text style={styles.gradeOptionBadgeText}>
                                {getGradeEmoji(gradeFr)}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gradeOptionLabel}>
                              {t(getGradeLabelKey(gradeFr))}
                            </Text>
                            <Text style={styles.gradeOptionQty}>
                              ×{qty} · ⏱ {formatBuffDuration(GRADE_BUFF_TABLE[gradeEn].durationSec)}
                            </Text>
                          </View>
                          <View style={[
                            styles.gradeOptionBuff,
                            xp > 0 ? styles.gradeOptionBuffPositive : styles.gradeOptionBuffNone,
                          ]}>
                            <Text style={[
                              styles.gradeOptionBuffText,
                              xp > 0 && { color: '#FFFFFF' },
                            ]}>
                              {xp > 0 ? `+${xp} XP` : '0 XP'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </Pressable>
                </Animated.View>
              </Pressable>
            )}
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
    maxHeight: '88%',
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
  awning: { height: 36, overflow: 'hidden' },
  awningStripes: { flexDirection: 'row', height: 28 },
  awningStripe: { flex: 1 },
  awningShadow: { height: 4, backgroundColor: 'rgba(0,0,0,0.12)' },
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
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },

  // ── Meilleur choix ──
  bestSection: {
    gap: Spacing.sm,
  },
  bestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  bestHeaderEmoji: {
    fontSize: 18,
  },
  bestHeaderLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bestRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bestTileWrap: {
    flex: 1,
  },
  bestTile: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Farm.greenBtn,
    backgroundColor: Farm.parchment,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    minHeight: 120,
    ...Shadows.sm,
  },
  bestTileHeart: {
    position: 'absolute',
    top: 4,
    right: 6,
  },
  bestTileHeartText: {
    fontSize: 14,
  },
  bestTileEmoji: {
    fontSize: 32,
  },
  bestTileSprite: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  bestTileName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textAlign: 'center',
  },
  bestTileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bestTileGrade: {
    fontSize: FontSize.sm,
  },
  bestTileBuff: {
    backgroundColor: Farm.greenBtn,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  bestTileBuffText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  bestTileDuration: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },

  // ── Filtre ──
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
  },
  filterEmoji: {
    fontSize: FontSize.body,
  },
  filterCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },

  // ── Grille ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridItem: {
    width: '48.5%',
  },
  tile: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    backgroundColor: Farm.parchmentDark,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    minHeight: 110,
  },
  tilePreferred: {
    backgroundColor: Farm.parchment,
  },
  tileAffinity: {
    position: 'absolute',
    top: 4,
    right: 6,
  },
  tileAffinityEmoji: {
    fontSize: 14,
  },
  tileEmoji: {
    fontSize: 32,
    marginTop: 2,
  },
  tileSprite: {
    width: 44,
    height: 44,
    marginTop: 2,
    resizeMode: 'contain',
  },
  tileName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textAlign: 'center',
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  tileQty: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  tileGrade: {
    fontSize: FontSize.body,
  },
  tileXpBadge: {
    backgroundColor: Farm.greenBtn,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginTop: 2,
  },
  tileXpBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },

  emptyFilter: {
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: FontSize.body,
    color: Farm.brownTextSub,
    fontStyle: 'italic',
  },

  // ── Grade picker overlay ──
  gradeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  gradeCard: {
    width: '100%',
    maxWidth: 360,
  },
  gradeCardInner: {
    backgroundColor: Farm.parchmentDark,
    borderRadius: Radius['2xl'],
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.xl,
  },
  gradeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Farm.woodHighlight,
  },
  gradeCardEmoji: {
    fontSize: 32,
  },
  gradeCardSprite: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  gradeCardName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  gradeCardSub: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
    marginTop: 2,
  },
  gradeCardClose: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeCardCloseText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },
  gradeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
  },
  gradeOptionEmoji: {
    fontSize: 22,
  },
  gradeOptionIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeOptionSprite: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  gradeOptionBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    backgroundColor: Farm.parchment,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeOptionBadgeText: {
    fontSize: 12,
  },
  gradeOptionLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  gradeOptionQty: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
    marginTop: 1,
  },
  gradeOptionBuff: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    minWidth: 56,
    alignItems: 'center',
    borderWidth: 1,
  },
  gradeOptionBuffPositive: {
    backgroundColor: Farm.greenBtn,
    borderColor: Farm.greenBtnShadow,
  },
  gradeOptionBuffNone: {
    backgroundColor: 'rgba(192,74,58,0.12)',
    borderColor: '#C04A3A',
  },
  gradeOptionBuffText: {
    fontSize: FontSize.caption,
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
    marginTop: Spacing.md,
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
