/**
 * WorldGridView.tsx — Rendu de la grille monde unifiee
 *
 * Affiche les cellules de la grille : cultures, batiments, decos.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { AppColors } from '../../constants/colors';
import { View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  useReducedMotion,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import {
  WORLD_GRID,
  CELL_SIZES,
  getUnlockedCropCells,
  BUILDING_CELLS,
  EXPANSION_CROP_CELLS,
  EXPANSION_BUILDING_CELL,
  EXPANSION_LARGE_CROP_CELL,
  type WorldCell,
} from '../../lib/mascot/world-grid';
import { type TechBonuses } from '../../lib/mascot/tech-engine';
import { type PlantedCrop, type TreeStage, type PlacedBuilding, CROP_CATALOG, BUILDING_CATALOG, TREE_STAGES } from '../../lib/mascot/types';
import { BUILDING_SPRITES } from '../../lib/mascot/building-sprites';
import { getPendingResources } from '../../lib/mascot/building-engine';
import { parseCrops, hasCropSeasonalBonus, getMainPlotIndex, getPlotLevel, getPlotUpgradeCost, MAX_PLOT_LEVEL } from '../../lib/mascot/farm-engine';
import { CROP_SPRITES } from '../../lib/mascot/crop-sprites';
import { type WearEffects } from '../../lib/mascot/wear-engine';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { PlantWagerBadge } from './PlantWagerBadge';
import { computePaceLevel, daysBetween } from '../../lib/mascot/wager-ui-helpers';
import { getLocalDateKey } from '../../lib/mascot/sporee-economy';

interface WorldGridViewProps {
  treeStage: TreeStage;
  farmCropsCSV: string;
  ownedBuildings: PlacedBuilding[];
  containerWidth: number;
  containerHeight: number;
  techBonuses?: TechBonuses;
  wearEffects?: WearEffects;
  onCropPlotPress?: (cellId: string, crop: PlantedCrop | null) => void;
  onBuildingCellPress?: (cellId: string, building: PlacedBuilding | null) => void;
  onRepairWeed?: (plotIndex: number) => void;
  onRepairPest?: (cellId: string) => void;
  onRepairFence?: (plotIndex: number) => void;
  /** Niveaux de parcelles (1-5), index = plotIndex */
  plotLevels?: number[];
  /** Long press sur une parcelle → sheet d'amélioration */
  onPlotLongPress?: (plotIndex: number) => void;
  /** Feuilles disponibles du joueur (pour afficher le hint upgrade) */
  playerCoins?: number;
  /** Gèle toutes les animations ambiantes (D-06 tutoriel ferme) */
  paused?: boolean;
}

const DIRT_SPRITES: Record<number, number> = {
  1: require('../../assets/garden/ground/dirt_patch.png'),
  2: require('../../assets/garden/ground/dirt_enriched.png'),
  3: require('../../assets/garden/ground/dirt_fertile.png'),
  4: require('../../assets/garden/ground/dirt_golden.png'),
  5: require('../../assets/garden/ground/dirt_crystal.png'),
};

function getDirtSprite(level: number): number {
  return DIRT_SPRITES[level] ?? DIRT_SPRITES[1];
}

// ── Cellule culture ──

const CROP_WHISPERS = [
  'Je pousse !',
  'Patience...',
  'Bientôt !',
  '💤',
  '☀️',
  '💧',
  '🌱',
];

function CropCell({ cell, crop, cropDef, isMature, isMainPlot, plotIndex, plotLevel, canUpgrade, wearEffects, containerWidth, containerHeight, frameIdx, whisperCellId, paused, sharedMaturePulse, onPress, onLongPress, onRepairWeed, onRepairFence }: {
  cell: WorldCell;
  crop: PlantedCrop | null;
  cropDef: typeof CROP_CATALOG[0] | null;
  isMature: boolean;
  isMainPlot: boolean;
  plotIndex: number;
  plotLevel: number;
  canUpgrade: boolean;
  wearEffects?: WearEffects;
  containerWidth: number;
  containerHeight: number;
  frameIdx: number;
  whisperCellId: string | null;
  paused: boolean;
  sharedMaturePulse: SharedValue<number>;
  onPress: () => void;
  onLongPress?: () => void;
  onRepairWeed?: (plotIndex: number) => void;
  onRepairFence?: (plotIndex: number) => void;
}) {
  const growScaleX = useSharedValue(1);
  const growScaleY = useSharedValue(1);
  const prevStage = React.useRef(crop?.currentStage ?? -1);

  // Bulle whisper derivee depuis le timer global parent
  const bubble = useMemo(() => {
    if (whisperCellId !== cell.id) return null;
    return CROP_WHISPERS[Math.floor(Math.random() * CROP_WHISPERS.length)];
  }, [whisperCellId, cell.id]);

  // Growth wiggle quand le stade change
  useEffect(() => {
    const currentStage = crop?.currentStage ?? -1;
    if (prevStage.current >= 0 && currentStage > prevStage.current && currentStage < 4) {
      // Squash → spring up → settle
      growScaleX.value = withSequence(
        withTiming(1.25, { duration: 100 }),
        withSpring(0.95, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
      growScaleY.value = withSequence(
        withTiming(0.7, { duration: 100 }),
        withSpring(1.1, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
    }
    prevStage.current = currentStage;
  }, [crop?.currentStage]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: isMature ? sharedMaturePulse.value : 1 },
      { scaleX: growScaleX.value },
      { scaleY: growScaleY.value },
    ],
  }));

  // ── Sporée de Régularité (Phase 40) ──
  // Consommation directe wager.totalDays et wager.tasksCompletedToday — persistés par Plan 40-01,
  // aucun recalcul ici (B1/B2 plan-checker). Zéro magic number 7, zéro fallback /7.
  // Les `?? 0` / `?? 1` servent uniquement à la rétro-compatibilité avec paris créés
  // AVANT Plan 40-01 (cas inexistant en pratique — Phase 40 est la première à exposer l'UI).
  const wager = crop?.modifiers?.wager ?? null;
  const showBadge = !!wager; // G6 : visible dès plantation (stage 0)
  const cumulTarget = wager?.cumulTarget ?? 0;
  const cumulCurrent = wager?.cumulCurrent ?? 0;
  const cumulReached = !!wager && cumulTarget > 0 && cumulCurrent >= cumulTarget;
  const showReadyRing = !!wager && isMature && cumulReached;

  // Pace level — B2 : totalDays consommé DIRECTEMENT depuis wager.totalDays (persisté Plan 01).
  const paceLevel = useMemo(() => {
    if (!wager) return 'green' as const;
    const today = getLocalDateKey(new Date());
    const daysElapsed = daysBetween(wager.appliedAt, today);
    const totalDays = wager.totalDays ?? 1; // rétro-compat paris pré-Phase 40 uniquement
    return computePaceLevel(cumulCurrent, cumulTarget, daysElapsed, totalDays);
  }, [wager, cumulCurrent, cumulTarget]);

  // tasksToday — B1 : lu directement depuis wager.tasksCompletedToday (persisté Plan 01).
  const tasksToday = wager?.tasksCompletedToday ?? 0;

  // tasksTargetToday — cadence jour courante, basée sur totalDays persisté (pas magic number).
  const tasksTargetToday = useMemo(() => {
    if (!wager) return 1;
    const today = getLocalDateKey(new Date());
    const daysElapsed = daysBetween(wager.appliedAt, today);
    const totalDays = wager.totalDays ?? 1;
    const daysRemaining = Math.max(1, totalDays - daysElapsed);
    const cumulRemaining = Math.max(0, cumulTarget - cumulCurrent);
    return Math.max(1, Math.ceil(cumulRemaining / daysRemaining));
  }, [wager, cumulCurrent, cumulTarget]);

  const isBlocked = wearEffects?.blockedPlots.includes(plotIndex) ?? false;
  const hasWeeds = wearEffects?.weedyPlots.includes(plotIndex) ?? false;

  const size = CELL_SIZES[cell.size];
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  const handleCropCellPress = () => {
    if (isBlocked && onRepairFence) {
      onRepairFence(plotIndex);
    } else if (hasWeeds && !crop && onRepairWeed) {
      onRepairWeed(plotIndex);
    } else {
      onPress();
    }
  };

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animStyle]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleCropCellPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={styles.cell}
      >
        <Image source={getDirtSprite(plotLevel)} style={styles.dirtBg as any} />
        {isMature && <View style={styles.matureGlow} />}

        {crop && cropDef ? (
          <View style={styles.cropContainer}>
            {(() => {
              const frames = CROP_SPRITES[crop.cropId]?.[crop.currentStage];
              const spriteSource = frames ? frames[frameIdx] : null;
              return spriteSource ? (
                <Image
                  source={spriteSource}
                  style={styles.cropSprite as any}
                />
              ) : (
                <Text style={styles.cropEmoji}>{cropDef.emoji}</Text>
              );
            })()}
            {/* Badge saisonnier masqué — le terrain tileset suffit */}
            <View style={styles.stageRow}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stageDot,
                    i < crop.currentStage
                      ? (isMature ? styles.stageDotMature : (isMainPlot ? styles.stageDotMain : styles.stageDotFilled))
                      : styles.stageDotEmpty,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyPlus}>+</Text>
        )}

        {/* Overlay clôture cassée */}
        {isBlocked && (
          <View style={styles.blockedOverlay}>
            <Text style={styles.blockedIcon}>{'🔨'}</Text>
          </View>
        )}

        {/* Overlay mauvaises herbes — uniquement parcelles vides */}
        {hasWeeds && !isBlocked && !crop && (
          <View style={styles.weedsOverlay}>
            <Text style={styles.weedsIcon}>{'🌿'}</Text>
          </View>
        )}
        {/* Hint upgrade disponible */}
        {canUpgrade && !isBlocked && (
          <Text style={styles.upgradeHint}>{'⬆'}</Text>
        )}
      </TouchableOpacity>
      {/* Bulle whisper auto */}
      {bubble != null && (
        <View style={styles.cropBubble}>
          <Text style={styles.cropBubbleText}>{bubble}</Text>
        </View>
      )}
      {/* Indicateur "prêt à valider" — 🍄 en top-left, symétrique à upgradeHint.
          Double gate mûr + cumul atteint (Phase 40 Plan 03). */}
      {showReadyRing && (
        <Text style={styles.wagerReadyHint} pointerEvents="none">{'🍄'}</Text>
      )}
      {/* Badge Sporée 2-lignes — visible dès stage 0 (G6), Phase 40 Plan 03 */}
      {showBadge && wager && (
        <PlantWagerBadge
          cumulCurrent={cumulCurrent}
          cumulTarget={cumulTarget}
          tasksToday={tasksToday}
          tasksTargetToday={tasksTargetToday}
          paceLevel={paceLevel}
        />
      )}
    </Animated.View>
  );
}

// ── Animations idle batiments ──

const PENDING_RESOURCE_EMOJI: Record<string, string> = {
  poulailler: '🥚',
  grange: '🥛',
  moulin: '🫓',
  ruche: '🍯',
};

const BuildingIdleAnim = React.memo(function BuildingIdleAnim({ buildingId, pendingCount, paused }: {
  buildingId: string;
  pendingCount: number;
  paused: boolean;
}) {
  const reducedMotion = useReducedMotion();

  // Poulailler — poule qui picore (bob vertical)
  const chickenY = useSharedValue(0);
  // Grange — vache qui remue (rotation)
  const cowRotate = useSharedValue(0);
  // Moulin — ailes qui tournent (rotation continue)
  const millRotate = useSharedValue(0);
  // Ruche — abeilles oscillantes
  const bee1Phase = useSharedValue(0);
  const bee2Phase = useSharedValue(0);
  // Ressource en attente — scintillement
  const pendingOpacity = useSharedValue(0.7);

  useEffect(() => {
    if (reducedMotion || paused) {
      cancelAnimation(chickenY);
      cancelAnimation(cowRotate);
      cancelAnimation(millRotate);
      cancelAnimation(bee1Phase);
      cancelAnimation(bee2Phase);
      chickenY.value = 0;
      cowRotate.value = 0;
      millRotate.value = 0;
      bee1Phase.value = 0;
      bee2Phase.value = 0;
      return;
    }

    if (buildingId === 'poulailler') {
      chickenY.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400 }),
        ),
        -1, false,
      );
    } else if (buildingId === 'grange') {
      cowRotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 750, easing: Easing.inOut(Easing.sin) }),
          withTiming(5, { duration: 750, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 750, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 750 }),
        ),
        -1, false,
      );
    } else if (buildingId === 'moulin') {
      millRotate.value = withRepeat(
        withTiming(360, { duration: 4000, easing: Easing.linear }),
        -1, false,
      );
    } else if (buildingId === 'ruche') {
      bee1Phase.value = withRepeat(
        withTiming(2 * Math.PI, { duration: 3000, easing: Easing.linear }),
        -1, false,
      );
      bee2Phase.value = withRepeat(
        withTiming(2 * Math.PI, { duration: 3500, easing: Easing.linear }),
        -1, false,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, buildingId, paused]);

  // Scintillement ressource en attente
  useEffect(() => {
    if (reducedMotion || paused) {
      cancelAnimation(pendingOpacity);
      pendingOpacity.value = 0.7;
      return;
    }
    if (pendingCount > 0) {
      pendingOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.7, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    } else {
      pendingOpacity.value = 0.7;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, pendingCount > 0, paused]);

  const chickenStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chickenY.value }],
  }));

  const cowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${cowRotate.value}deg` }],
  }));

  const millStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${millRotate.value}deg` }],
  }));

  const bee1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.cos(bee1Phase.value) * 14 },
      { translateY: Math.sin(bee1Phase.value) * 10 },
    ],
  }));

  const bee2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.cos(bee2Phase.value + Math.PI) * 12 },
      { translateY: Math.sin(bee2Phase.value + Math.PI) * 8 },
    ],
  }));

  const pendingStyle = useAnimatedStyle(() => ({
    opacity: pendingOpacity.value,
  }));

  if (reducedMotion) return null;

  const pendingEmoji = PENDING_RESOURCE_EMOJI[buildingId];

  return (
    <>
      {/* Animation idle par type */}
      {buildingId === 'poulailler' && (
        <Animated.Image
          source={require('../../assets/garden/buildings/poulailler/idle_south.png')}
          style={[styles.idleChickenSprite, styles.idlePoulaillerPos, chickenStyle]}
        />
      )}
      {buildingId === 'grange' && (
        <Animated.Image
          source={require('../../assets/garden/animals/vache/idle_1.png')}
          style={[styles.idleVacheSprite, styles.idleGrangePos, cowStyle]}
        />
      )}
      {buildingId === 'moulin' && (
        <Animated.Text style={[styles.idleEmojiMill, styles.idleMoulinPos, millStyle]}>
          ✦
        </Animated.Text>
      )}
      {buildingId === 'ruche' && (
        <>
          <Animated.Image
            source={require('../../assets/garden/animals/abeille/idle_1.png')}
            style={[styles.idleAbeilleSprite, styles.idleRucheCenter, bee1Style]}
          />
          <Animated.Image
            source={require('../../assets/garden/animals/abeille/idle_1.png')}
            style={[styles.idleAbeilleSprite, styles.idleRucheCenter, bee2Style]}
          />
        </>
      )}

      {/* Ressource en attente — scintillement */}
      {pendingCount > 0 && pendingEmoji && (
        <Animated.Text style={[styles.pendingResourceEmoji, pendingStyle]}>
          {pendingEmoji}
        </Animated.Text>
      )}
    </>
  );
});

// ── Cellule batiment ──

function BuildingCell({ cell, placedBuilding, pendingCount, canBuild, wearEffects, containerWidth, containerHeight, paused, onPress, onRepairPest }: {
  cell: WorldCell;
  placedBuilding: PlacedBuilding | null;
  pendingCount: number;
  canBuild: boolean;
  wearEffects?: WearEffects;
  containerWidth: number;
  containerHeight: number;
  paused: boolean;
  onPress: () => void;
  onRepairPest?: (cellId: string) => void;
}) {
  const pulse = useSharedValue(1);
  const borderPulse = useSharedValue(0.4);
  const reducedMotion = useReducedMotion();

  const isDamaged = wearEffects?.damagedBuildings.includes(cell.id) ?? false;
  const hasPests = wearEffects?.pestBuildings.includes(cell.id) ?? false;

  // Animation wiggle pour les nuisibles
  const pestWiggle = useSharedValue(0);
  useEffect(() => {
    if (paused) {
      cancelAnimation(pestWiggle);
      pestWiggle.value = 0;
      return;
    }
    if (hasPests && !reducedMotion) {
      pestWiggle.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 150, easing: Easing.inOut(Easing.sin) }),
          withTiming(2, { duration: 150, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 150, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, false,
      );
    } else {
      pestWiggle.value = withTiming(0, { duration: 100 });
    }
  }, [hasPests, reducedMotion, paused]);

  const pestAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pestWiggle.value }],
  }));

  useEffect(() => {
    if (paused) {
      cancelAnimation(borderPulse);
      borderPulse.value = 0.4;
      return;
    }
    if (!reducedMotion && canBuild) {
      borderPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    } else {
      borderPulse.value = withTiming(0.4, { duration: 300 });
    }
  }, [reducedMotion, canBuild, paused]);

  useEffect(() => {
    if (paused) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    if (!reducedMotion && pendingCount > 0) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, pendingCount > 0, paused]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const canBuildBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(74, 222, 128, ${borderPulse.value})`,
    borderWidth: canBuild ? 2 : 1.5,
  }));

  const size = CELL_SIZES[cell.size];
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  const handleBuildingPress = () => {
    if (hasPests && placedBuilding && onRepairPest) {
      onRepairPest(cell.id);
    } else {
      onPress();
    }
  };

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animStyle]}>
      <Animated.View style={[
        styles.buildingCell,
        placedBuilding && styles.buildingCellPlaced,
        !placedBuilding && canBuildBorderStyle,
      ]}>
      <TouchableOpacity onPress={handleBuildingPress} activeOpacity={0.7} style={styles.buildingCellInner}>
        {placedBuilding ? (
          <>
            <Image
              source={BUILDING_SPRITES[placedBuilding.buildingId]?.[placedBuilding.level]}
              style={styles.buildingSprite}
            />
            <BuildingIdleAnim
              buildingId={placedBuilding.buildingId}
              pendingCount={pendingCount}
              paused={paused}
            />
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
            {/* Badge toit endommagé */}
            {isDamaged && (
              <View style={styles.damagedBadge}>
                <Text style={styles.damagedBadgeIcon}>{'⚠️'}</Text>
                <Text style={styles.damagedBadgeLabel}>{'-50%'}</Text>
              </View>
            )}
            {/* Nuisibles animés */}
            {hasPests && (
              <>
                <Animated.View style={[styles.pestIcon, styles.pestIconTopLeft, pestAnimStyle]}>
                  <Text style={styles.pestEmoji}>{'🐛'}</Text>
                </Animated.View>
                <Animated.View style={[styles.pestIcon, styles.pestIconBottomRight, pestAnimStyle]}>
                  <Text style={styles.pestEmoji}>{'🐛'}</Text>
                </Animated.View>
                <Animated.View style={[styles.pestIcon, styles.pestIconTopRight, pestAnimStyle]}>
                  <Text style={styles.pestEmoji}>{'🐛'}</Text>
                </Animated.View>
              </>
            )}
          </>
        ) : (
          <Text style={styles.emptyBuildingPlus}>{'⚒'}</Text>
        )}
      </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Cellule prochaine extension (un seul slot visible) ──

function NextExpansionCell({ cell, containerWidth, containerHeight, paused }: {
  cell: WorldCell;
  containerWidth: number;
  containerHeight: number;
  paused: boolean;
}) {
  const pulse = useSharedValue(0.6);
  React.useEffect(() => {
    if (paused) {
      cancelAnimation(pulse);
      pulse.value = 0.6;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
  }, [paused]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const size = CELL_SIZES[cell.size];
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animStyle]}>
      <View style={styles.nextExpansionCell}>
        <Text style={styles.nextExpansionPlus}>+</Text>
      </View>
    </Animated.View>
  );
}

// ── Grille monde ──

export function WorldGridView({
  treeStage,
  farmCropsCSV,
  ownedBuildings,
  containerWidth,
  containerHeight,
  techBonuses,
  wearEffects,
  onCropPlotPress,
  onBuildingCellPress,
  onRepairWeed,
  onRepairPest,
  onRepairFence,
  plotLevels,
  onPlotLongPress,
  playerCoins = 0,
  paused = false,
}: WorldGridViewProps) {
  const unlockedCrops = getUnlockedCropCells(treeStage);
  const crops = parseCrops(farmCropsCSV);
  const mainPlotIndex = getMainPlotIndex(crops);

  // Timer global frame swap — 1 seul setInterval au lieu de 2×N
  const reducedMotion = useReducedMotion();
  const [sharedFrameIdx, setSharedFrameIdx] = useState(0);
  useEffect(() => {
    if (reducedMotion || paused) return;
    const timer = setInterval(() => setSharedFrameIdx(i => 1 - i), 800);
    return () => clearInterval(timer);
  }, [reducedMotion, paused]);

  // Pulse global partagé pour toutes les cellules matures (1 seule boucle Reanimated au lieu de N)
  const sharedMaturePulse = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion || paused) {
      cancelAnimation(sharedMaturePulse);
      sharedMaturePulse.value = 1;
      return;
    }
    sharedMaturePulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
  }, [reducedMotion, paused, sharedMaturePulse]);

  // Timer global whisper — 1 seul setInterval pour toutes les crops
  const [whisperCellId, setWhisperCellId] = useState<string | null>(null);
  const allCropCells = useMemo(() => {
    const expansion = techBonuses && techBonuses.extraCropCells > 0
      ? EXPANSION_CROP_CELLS.slice(0, techBonuses.extraCropCells)
      : [];
    return [...unlockedCrops, ...expansion];
  }, [unlockedCrops, techBonuses]);

  const farmCropsCSVRef = React.useRef(farmCropsCSV);
  farmCropsCSVRef.current = farmCropsCSV;

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      const currentCrops = parseCrops(farmCropsCSVRef.current);
      const nonMature = allCropCells.filter((_cell, idx) => {
        const crop = currentCrops.find(c => c.plotIndex === idx);
        return crop && crop.currentStage < 4;
      });
      if (nonMature.length === 0) return;
      const pick = nonMature[Math.floor(Math.random() * nonMature.length)];
      setWhisperCellId(pick.id);
      setTimeout(() => setWhisperCellId(null), 2500);
    }, 18000);
    return () => clearInterval(timer);
  }, [allCropCells, paused]);

  // Peut-on construire un batiment sur une cellule vide ?
  const stageOrder = TREE_STAGES.map(s => s.stage);
  const currentStageIdx = stageOrder.indexOf(treeStage);
  const placedIds = ownedBuildings.map(b => b.buildingId);
  const canBuildOnEmpty = BUILDING_CATALOG.some(def => {
    const requiredIdx = stageOrder.indexOf(def.minTreeStage);
    return requiredIdx <= currentStageIdx && !placedIds.includes(def.id);
  });

  // Calcul des cellules d'expansion
  const expansionCropsUnlocked = techBonuses ? techBonuses.extraCropCells > 0 : false;
  const expansionBuildingUnlocked = techBonuses ? techBonuses.extraBuildingCells > 0 : false;
  const largeCropUnlocked = techBonuses ? techBonuses.hasLargeCropCell : false;

  // Les cellules d'expansion a rendre (debloquees)
  const unlockedExpansionCrops = expansionCropsUnlocked
    ? EXPANSION_CROP_CELLS.slice(0, techBonuses!.extraCropCells)
    : [];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 3 }]} pointerEvents="box-none">
      {/* Cellules de culture debloquees */}
      {unlockedCrops.map(cell => {
        // Mapper l'ancien plotIndex sur le cellId
        const cellIdx = unlockedCrops.indexOf(cell);
        const crop = crops.find(c => c.plotIndex === cellIdx) ?? null;
        const cropDef = crop ? (CROP_CATALOG.find(c => c.id === crop.cropId) ?? null) : null;
        const isMature = !!crop && crop.currentStage >= 4;

        return (
          <CropCell
            key={cell.id}
            cell={cell}
            crop={crop}
            cropDef={cropDef}
            isMature={isMature}
            isMainPlot={!isMature && cellIdx === mainPlotIndex}
            plotIndex={cellIdx}
            plotLevel={getPlotLevel(plotLevels, cellIdx)}
            canUpgrade={getPlotLevel(plotLevels, cellIdx) < MAX_PLOT_LEVEL && (getPlotUpgradeCost(getPlotLevel(plotLevels, cellIdx)) ?? Infinity) <= playerCoins}
            wearEffects={wearEffects}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            frameIdx={sharedFrameIdx}
            whisperCellId={whisperCellId}
            paused={paused}
            sharedMaturePulse={sharedMaturePulse}
            onPress={() => onCropPlotPress?.(cell.id, crop)}
            onLongPress={() => onPlotLongPress?.(cellIdx)}
            onRepairWeed={onRepairWeed}
            onRepairFence={onRepairFence}
          />
        );
      })}

      {/* Cellules d'expansion culture — debloquees */}
      {unlockedExpansionCrops.map(cell => {
        const allExpandedCells = [...unlockedCrops, ...unlockedExpansionCrops];
        const cellIdx = allExpandedCells.indexOf(cell);
        const crop = crops.find(c => c.plotIndex === cellIdx) ?? null;
        const cropDef = crop ? (CROP_CATALOG.find(c => c.id === crop.cropId) ?? null) : null;
        const isMature = !!crop && crop.currentStage >= 4;

        return (
          <CropCell
            key={cell.id}
            cell={cell}
            crop={crop}
            cropDef={cropDef}
            isMature={isMature}
            isMainPlot={!isMature && cellIdx === mainPlotIndex}
            plotIndex={cellIdx}
            plotLevel={getPlotLevel(plotLevels, cellIdx)}
            canUpgrade={getPlotLevel(plotLevels, cellIdx) < MAX_PLOT_LEVEL && (getPlotUpgradeCost(getPlotLevel(plotLevels, cellIdx)) ?? Infinity) <= playerCoins}
            wearEffects={wearEffects}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            frameIdx={sharedFrameIdx}
            whisperCellId={whisperCellId}
            paused={paused}
            sharedMaturePulse={sharedMaturePulse}
            onPress={() => onCropPlotPress?.(cell.id, crop)}
            onLongPress={() => onPlotLongPress?.(cellIdx)}
            onRepairWeed={onRepairWeed}
            onRepairFence={onRepairFence}
          />
        );
      })}

      {/* Prochaine parcelle d'expansion (une seule) */}
      {!expansionCropsUnlocked && techBonuses !== undefined && EXPANSION_CROP_CELLS.length > 0 && (
        <NextExpansionCell
          cell={EXPANSION_CROP_CELLS[0]}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          paused={paused}
        />
      )}

      {/* Parcelle geante — debloquee */}
      {largeCropUnlocked && (() => {
        const cell = EXPANSION_LARGE_CROP_CELL;
        const allExpandedCells = [...unlockedCrops, ...unlockedExpansionCrops, cell];
        const cellIdx = allExpandedCells.indexOf(cell);
        const crop = crops.find(c => c.plotIndex === cellIdx) ?? null;
        const cropDef = crop ? (CROP_CATALOG.find(c => c.id === crop.cropId) ?? null) : null;
        const isMature = !!crop && crop.currentStage >= 4;

        return (
          <View key={cell.id}>
            <CropCell
              cell={cell}
              crop={crop}
              cropDef={cropDef}
              isMature={isMature}
              isMainPlot={!isMature && cellIdx === mainPlotIndex}
              plotIndex={cellIdx}
              plotLevel={getPlotLevel(plotLevels, cellIdx)}
              canUpgrade={getPlotLevel(plotLevels, cellIdx) < MAX_PLOT_LEVEL && (getPlotUpgradeCost(getPlotLevel(plotLevels, cellIdx)) ?? Infinity) <= playerCoins}
              wearEffects={wearEffects}
              containerWidth={containerWidth}
              containerHeight={containerHeight}
              frameIdx={sharedFrameIdx}
              whisperCellId={whisperCellId}
              paused={paused}
              sharedMaturePulse={sharedMaturePulse}
              onPress={() => onCropPlotPress?.(cell.id, crop)}
              onLongPress={() => onPlotLongPress?.(cellIdx)}
              onRepairWeed={onRepairWeed}
              onRepairFence={onRepairFence}
            />
            <View style={[styles.largeBadge, {
              left: cell.x * containerWidth - CELL_SIZES.large / 2 + CELL_SIZES.large - 18,
              top: cell.y * containerHeight - CELL_SIZES.large / 2 - 4,
            }]}>
              <Text style={styles.largeBadgeText}>x2</Text>
            </View>
          </View>
        );
      })()}

      {/* Parcelle géante — masquée tant que non débloquée */}

      {/* Cellules de batiment */}
      {BUILDING_CELLS.map(cell => {
        const placedBuilding = ownedBuildings.find(b => b.cellId === cell.id) ?? null;
        const pendingCount = placedBuilding ? getPendingResources(placedBuilding, new Date(), techBonuses) : 0;
        return (
          <BuildingCell
            key={cell.id}
            cell={cell}
            placedBuilding={placedBuilding}
            pendingCount={pendingCount}
            canBuild={!placedBuilding && canBuildOnEmpty}
            wearEffects={wearEffects}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            paused={paused}
            onPress={() => onBuildingCellPress?.(cell.id, placedBuilding)}
            onRepairPest={onRepairPest}
          />
        );
      })}

      {/* Cellule batiment expansion — debloquee */}
      {expansionBuildingUnlocked && (() => {
        const cell = EXPANSION_BUILDING_CELL;
        const placedBuilding = ownedBuildings.find(b => b.cellId === cell.id) ?? null;
        const pendingCount = placedBuilding ? getPendingResources(placedBuilding, new Date(), techBonuses) : 0;
        return (
          <BuildingCell
            key={cell.id}
            cell={cell}
            placedBuilding={placedBuilding}
            pendingCount={pendingCount}
            canBuild={!placedBuilding && canBuildOnEmpty}
            wearEffects={wearEffects}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            paused={paused}
            onPress={() => onBuildingCellPress?.(cell.id, placedBuilding)}
            onRepairPest={onRepairPest}
          />
        );
      })()}

      {/* Prochain emplacement bâtiment expansion (un seul) */}
      {!expansionBuildingUnlocked && techBonuses !== undefined && (
        <NextExpansionCell
          cell={EXPANSION_BUILDING_CELL}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          paused={paused}
        />
      )}
    </View>
  );
}

/** Compteur ferme (a afficher sous le diorama) */
export function FarmStats({ farmCropsCSV, colors, t }: { farmCropsCSV: string; colors: AppColors; t: (key: string, opts?: any) => string }) {
  const crops = parseCrops(farmCropsCSV);
  if (crops.length === 0) return null;

  const matureCount = crops.filter(c => c.currentStage >= 4).length;
  const growingCount = crops.filter(c => c.currentStage < 4).length;

  return (
    <View style={statsStyles.container}>
      {growingCount > 0 && (
        <Text style={[statsStyles.text, { color: colors.textSub }]}>
          {t('farm.stats.growing', { count: growingCount })}
        </Text>
      )}
      {matureCount > 0 && (
        <Text style={[statsStyles.text, { color: colors.success }]}>
          {t('farm.stats.ready', { count: matureCount })}
        </Text>
      )}
    </View>
  );
}

const statsStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, paddingVertical: Spacing.sm },
  text: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
});

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  dirtBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.8,
    borderRadius: 8,
  },
  matureGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  cropContainer: { alignItems: 'center', justifyContent: 'center' },
  cropSprite: { width: 36, height: 44 },
  cropEmoji: { fontSize: 24, textAlign: 'center' },
  seasonBadge: { fontSize: 8, position: 'absolute', top: -2, right: -4 },
  stageRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  stageDot: { width: 5, height: 5, borderRadius: 3 },
  stageDotFilled: { backgroundColor: '#8B6914' },
  stageDotMain: { backgroundColor: '#60A5FA' },
  stageDotMature: { backgroundColor: '#FFD700' },
  stageDotEmpty: { backgroundColor: 'rgba(255,255,255,0.3)' },
  taskCount: { color: 'rgba(255,255,255,0.8)', fontSize: 8, fontWeight: '600' as const, marginTop: 1, textAlign: 'center' as const },
  emptyPlus: { color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: 'bold' },
  cropBubble: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderCurve: 'continuous',
    minWidth: 40,
    alignItems: 'center' as const,
    zIndex: 15,
  },
  cropBubbleText: { fontSize: 10, textAlign: 'center' as const, color: '#1F2937' },
  buildingCell: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    overflow: 'hidden',
  },
  buildingCellPlaced: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  buildingCellInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buildingEmoji: { fontSize: 28 },
  buildingSprite: { width: 64, height: 64 },
  buildingIncome: { fontSize: 10, color: '#4ADE80', fontWeight: '600', marginTop: 2 },
  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    borderCurve: 'continuous',
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyBuildingPlus: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.7,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  nextExpansionCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  nextExpansionPlus: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.3)',
  },
  largeBadge: {
    position: 'absolute',
    backgroundColor: '#FFD700',
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 10,
  },
  largeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#5D4037',
  },
  // ── Overlays d'usure — CropCell ──
  blockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 165, 0, 0.3)',
    borderRadius: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 165, 0, 0.6)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedIcon: {
    fontSize: FontSize.title,
  },
  weedsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weedsIcon: {
    fontSize: FontSize.subtitle,
  },
  upgradeHint: {
    position: 'absolute',
    top: 1,
    right: 2,
    fontSize: 10,
    opacity: 0.7,
  },
  wagerReadyHint: {
    position: 'absolute',
    top: 1,
    left: 2,
    fontSize: 12,
    zIndex: 13,
  },
  // ── Overlays d'usure — BuildingCell ──
  damagedBadge: {
    position: 'absolute',
    bottom: -Spacing.xs,
    left: -Spacing.xs,
    alignItems: 'center',
    zIndex: 10,
  },
  damagedBadgeIcon: {
    fontSize: FontSize.sm,
  },
  damagedBadgeLabel: {
    fontSize: FontSize.micro,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  pestIcon: {
    position: 'absolute',
    zIndex: 10,
  },
  pestIconTopLeft: {
    top: -Spacing.xs,
    left: -Spacing.sm,
  },
  pestIconBottomRight: {
    bottom: -Spacing.xs,
    right: -Spacing.sm,
  },
  pestIconTopRight: {
    top: Spacing.md,
    right: -Spacing.md,
  },
  pestEmoji: {
    fontSize: FontSize.caption,
  },
  // ── Idle anim styles ──
  idleEmoji: {
    position: 'absolute',
    fontSize: 12,
  },
  idlePoulaillerPos: {
    bottom: 2,
    left: 2,
  },
  idleChickenSprite: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  idleVacheSprite: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  idleGrangePos: {
    bottom: 2,
    right: 2,
  },
  idleEmojiMill: {
    position: 'absolute',
    fontSize: 14,
    color: '#FFD700',
  },
  idleMoulinPos: {
    top: 2,
    alignSelf: 'center',
    left: 24,
  },
  idleAbeilleSprite: {
    position: 'absolute',
    width: 12,
    height: 12,
  },
  idleRucheCenter: {
    top: 20,
    left: 20,
  },
  pendingResourceEmoji: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    fontSize: 16,
    textAlign: 'center' as const,
    left: 22,
  },
});
