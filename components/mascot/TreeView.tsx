/**
 * TreeView.tsx — Rendu SVG animé de l'arbre mascotte
 *
 * Arbre procédural qui grandit avec le niveau du joueur.
 * 5 espèces × 6 stades, animations idle (respiration, balancement),
 * particules pour stades avancés.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Ellipse,
  G,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import {
  type TreeSpecies,
  type TreeStage,
  SPECIES_INFO,
} from '../../lib/mascot/types';
import {
  getTreeStage,
  getStageProgress,
  getVisualComplexity,
  getStageIndex,
} from '../../lib/mascot/engine';

// ── Types ──────────────────────────────────────

interface TreeViewProps {
  species: TreeSpecies;
  level: number;
  size?: number;         // largeur/hauteur du viewport (défaut 200)
  showGround?: boolean;  // afficher le sol (défaut true)
  interactive?: boolean; // animations idle (défaut true)
}

// ── Constantes géométrie ───────────────────────

const VIEWBOX_W = 200;
const VIEWBOX_H = 240;
const GROUND_Y = 200;
const CENTER_X = 100;

// ── Composant principal ────────────────────────

function TreeViewInner({ species, level, size = 200, showGround = true, interactive = true }: TreeViewProps) {
  const stage = getTreeStage(level);
  const progress = getStageProgress(level);
  const stageIdx = getStageIndex(level);
  const visual = getVisualComplexity(level);
  const sp = SPECIES_INFO[species];
  const reducedMotion = useReducedMotion();
  const animate = interactive && !reducedMotion;

  // ── Animations idle ──
  const sway = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (!animate) return;
    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.98, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [animate]);

  const treeAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${sway.value * 1.5}deg` },
      { scaleX: breathe.value },
      { scaleY: breathe.value },
    ],
  }));

  // ── Rendu par stade ──
  const treeElements = useMemo(() => {
    switch (stage) {
      case 'graine':
        return <SeedStage species={sp} progress={progress} />;
      case 'pousse':
        return <SproutStage species={sp} progress={progress} />;
      case 'arbuste':
        return <BushStage species={sp} progress={progress} visual={visual} />;
      case 'arbre':
        return <TreeStageView species={sp} progress={progress} visual={visual} speciesType={species} />;
      case 'majestueux':
        return <MajesticStage species={sp} progress={progress} visual={visual} speciesType={species} />;
      case 'legendaire':
        return <LegendaryStage species={sp} progress={progress} visual={visual} speciesType={species} />;
    }
  }, [stage, species, level]);

  return (
    <View style={[styles.container, { width: size, height: size * (VIEWBOX_H / VIEWBOX_W) }]}>
      {/* Particules animées (stades avancés) */}
      {visual.hasParticles && animate && (
        <FloatingParticles color={sp.particle} count={visual.hasAura ? 12 : 6} size={size} />
      )}

      <Animated.View style={[styles.svgWrap, animate ? treeAnimStyle : undefined]}>
        <Svg
          width={size}
          height={size * (VIEWBOX_H / VIEWBOX_W)}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        >
          <Defs>
            {/* Gradient ciel */}
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#87CEEB" stopOpacity={0.3} />
              <Stop offset="1" stopColor="#E0F7FA" stopOpacity={0.1} />
            </LinearGradient>
            {/* Gradient sol */}
            <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7CB342" />
              <Stop offset="1" stopColor="#558B2F" />
            </LinearGradient>
            {/* Glow doré pour légendaire */}
            <RadialGradient id="aura" cx="50%" cy="40%" r="50%">
              <Stop offset="0" stopColor="#FFD700" stopOpacity={0.4} />
              <Stop offset="0.6" stopColor="#FFD700" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#FFD700" stopOpacity={0} />
            </RadialGradient>
            {/* Gradient tronc */}
            <LinearGradient id="trunk" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={sp.trunkDark} />
              <Stop offset="0.4" stopColor={sp.trunk} />
              <Stop offset="1" stopColor={sp.trunkDark} />
            </LinearGradient>
            {/* Gradient feuillage */}
            <RadialGradient id="crown" cx="50%" cy="40%" r="55%">
              <Stop offset="0" stopColor={sp.leavesLight} />
              <Stop offset="0.6" stopColor={sp.leaves} />
              <Stop offset="1" stopColor={sp.leavesDark} />
            </RadialGradient>
          </Defs>

          {/* Sol */}
          {showGround && (
            <Ellipse
              cx={CENTER_X}
              cy={GROUND_Y + 5}
              rx={85}
              ry={15}
              fill="url(#ground)"
              opacity={0.8}
            />
          )}

          {/* Aura dorée (légendaire) */}
          {visual.hasAura && (
            <Circle cx={CENTER_X} cy={GROUND_Y - 70} r={80} fill="url(#aura)" />
          )}

          {/* Glow (majestueux+) */}
          {visual.hasGlow && (
            <Circle
              cx={CENTER_X}
              cy={GROUND_Y - 60}
              r={55}
              fill={sp.accent}
              opacity={0.08}
            />
          )}

          {treeElements}
        </Svg>
      </Animated.View>
    </View>
  );
}

// ── STADE 1 : Graine ──────────────────────────

function SeedStage({ species, progress }: { species: typeof SPECIES_INFO[TreeSpecies]; progress: number }) {
  const moundY = GROUND_Y - 5;
  const sproutHeight = progress * 15;

  return (
    <G>
      {/* Monticule de terre */}
      <Ellipse cx={CENTER_X} cy={moundY} rx={25} ry={10} fill="#8B6914" opacity={0.6} />
      <Ellipse cx={CENTER_X} cy={moundY - 2} rx={20} ry={7} fill="#A0855C" opacity={0.8} />

      {/* Graine visible */}
      <Ellipse
        cx={CENTER_X}
        cy={moundY - 5}
        rx={6}
        ry={4}
        fill="#5D4037"
        stroke="#3E2723"
        strokeWidth={0.5}
      />

      {/* Début de pousse (apparaît avec progress) */}
      {progress > 0.3 && (
        <G opacity={Math.min(1, (progress - 0.3) * 3)}>
          <Path
            d={`M${CENTER_X} ${moundY - 7} Q${CENTER_X + 2} ${moundY - 7 - sproutHeight * 0.5} ${CENTER_X} ${moundY - 7 - sproutHeight}`}
            stroke={species.leaves}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          {progress > 0.6 && (
            <Ellipse
              cx={CENTER_X + 4}
              cy={moundY - 7 - sproutHeight + 3}
              rx={4}
              ry={3}
              fill={species.leaves}
              opacity={Math.min(1, (progress - 0.6) * 4)}
              transform={`rotate(-30 ${CENTER_X + 4} ${moundY - 7 - sproutHeight + 3})`}
            />
          )}
        </G>
      )}
    </G>
  );
}

// ── STADE 2 : Pousse ──────────────────────────

function SproutStage({ species, progress }: { species: typeof SPECIES_INFO[TreeSpecies]; progress: number }) {
  const stemH = 30 + progress * 25;
  const stemTop = GROUND_Y - stemH;
  const leafCount = 2 + Math.floor(progress * 3);

  return (
    <G>
      {/* Tige */}
      <Path
        d={`M${CENTER_X} ${GROUND_Y} Q${CENTER_X + 3} ${GROUND_Y - stemH * 0.6} ${CENTER_X} ${stemTop}`}
        stroke={species.trunk}
        strokeWidth={3 + progress}
        fill="none"
        strokeLinecap="round"
      />

      {/* Feuilles alternées */}
      {Array.from({ length: leafCount }).map((_, i) => {
        const t = (i + 1) / (leafCount + 1);
        const y = GROUND_Y - stemH * t;
        const side = i % 2 === 0 ? 1 : -1;
        const leafSize = 8 + progress * 4;
        const angle = side * (25 + i * 5);
        const lx = CENTER_X + side * 2;
        return (
          <Ellipse
            key={i}
            cx={lx + side * leafSize * 0.5}
            cy={y}
            rx={leafSize}
            ry={leafSize * 0.45}
            fill={i % 3 === 0 ? species.leavesLight : species.leaves}
            opacity={0.85}
            transform={`rotate(${angle} ${lx + side * leafSize * 0.5} ${y})`}
          />
        );
      })}

      {/* Bourgeon au sommet */}
      <Circle cx={CENTER_X} cy={stemTop - 3} r={4 + progress * 2} fill={species.leaves} />
      <Circle cx={CENTER_X - 1} cy={stemTop - 4} r={2} fill={species.leavesLight} opacity={0.6} />
    </G>
  );
}

// ── STADE 3 : Arbuste ─────────────────────────

function BushStage({ species, progress, visual }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  progress: number;
  visual: ReturnType<typeof getVisualComplexity>;
}) {
  const trunkH = 45 + progress * 20;
  const trunkTop = GROUND_Y - trunkH;
  const crownR = 25 + progress * 15;

  return (
    <G>
      {/* Tronc */}
      <Path
        d={`M${CENTER_X - 4} ${GROUND_Y} L${CENTER_X - 3} ${trunkTop + 10} L${CENTER_X + 3} ${trunkTop + 10} L${CENTER_X + 4} ${GROUND_Y} Z`}
        fill="url(#trunk)"
      />

      {/* Branches latérales */}
      {visual.branches > 0 && Array.from({ length: Math.min(visual.branches, 4) }).map((_, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const bY = trunkTop + 15 + i * 8;
        const bLen = 12 + progress * 8;
        return (
          <Path
            key={`br-${i}`}
            d={`M${CENTER_X} ${bY} Q${CENTER_X + side * bLen * 0.6} ${bY - 5} ${CENTER_X + side * bLen} ${bY - 8}`}
            stroke={species.trunk}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}

      {/* Couronne de feuillage */}
      <Circle cx={CENTER_X} cy={trunkTop} r={crownR} fill="url(#crown)" />
      <Circle cx={CENTER_X - 8} cy={trunkTop - 5} r={crownR * 0.7} fill={species.leavesLight} opacity={0.3} />

      {/* Petites touffes latérales */}
      <Ellipse cx={CENTER_X - crownR * 0.6} cy={trunkTop + 8} rx={crownR * 0.5} ry={crownR * 0.4} fill={species.leaves} opacity={0.8} />
      <Ellipse cx={CENTER_X + crownR * 0.6} cy={trunkTop + 5} rx={crownR * 0.45} ry={crownR * 0.4} fill={species.leavesDark} opacity={0.7} />

      {/* Fleurs (apparaissent avec progression) */}
      {visual.hasFlowers && (
        <G opacity={Math.min(1, (progress - 0.5) * 3)}>
          {[
            [CENTER_X - 12, trunkTop - 10],
            [CENTER_X + 15, trunkTop - 5],
            [CENTER_X + 5, trunkTop - 18],
          ].map(([fx, fy], i) => (
            <Circle key={`fl-${i}`} cx={fx} cy={fy} r={3} fill={species.accent} opacity={0.9} />
          ))}
        </G>
      )}
    </G>
  );
}

// ── STADE 4 : Arbre formé ─────────────────────

function TreeStageView({ species, progress, visual, speciesType }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  progress: number;
  visual: ReturnType<typeof getVisualComplexity>;
  speciesType: TreeSpecies;
}) {
  const trunkH = 75 + progress * 15;
  const trunkTop = GROUND_Y - trunkH;
  const crownR = 38 + progress * 8;
  const trunkW = 7 + progress * 2;

  if (speciesType === 'bambou') {
    return <BambooTree species={species} trunkH={trunkH} progress={progress} visual={visual} />;
  }
  if (speciesType === 'palmier') {
    return <PalmTree species={species} trunkH={trunkH} progress={progress} visual={visual} />;
  }

  return (
    <G>
      {/* Racines visibles */}
      <Path
        d={`M${CENTER_X - 8} ${GROUND_Y} Q${CENTER_X - 18} ${GROUND_Y + 3} ${CENTER_X - 22} ${GROUND_Y + 5}`}
        stroke={species.trunkDark}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M${CENTER_X + 8} ${GROUND_Y} Q${CENTER_X + 15} ${GROUND_Y + 4} ${CENTER_X + 20} ${GROUND_Y + 6}`}
        stroke={species.trunkDark}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />

      {/* Tronc */}
      <Path
        d={`M${CENTER_X - trunkW} ${GROUND_Y}
            Q${CENTER_X - trunkW + 1} ${GROUND_Y - trunkH * 0.5} ${CENTER_X - trunkW * 0.5} ${trunkTop + 15}
            L${CENTER_X + trunkW * 0.5} ${trunkTop + 15}
            Q${CENTER_X + trunkW - 1} ${GROUND_Y - trunkH * 0.5} ${CENTER_X + trunkW} ${GROUND_Y} Z`}
        fill="url(#trunk)"
      />

      {/* Branches principales */}
      {Array.from({ length: visual.branches }).map((_, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const bY = trunkTop + 20 + i * 7;
        const bLen = 18 + (visual.branches - i) * 3;
        const angle = side * (15 + i * 8);
        return (
          <Path
            key={`br-${i}`}
            d={`M${CENTER_X} ${bY} Q${CENTER_X + side * bLen * 0.5} ${bY - 8} ${CENTER_X + side * bLen} ${bY - 12 - i * 2}`}
            stroke={species.trunk}
            strokeWidth={Math.max(1.5, 3 - i * 0.3)}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}

      {/* Couronne principale */}
      <Ellipse cx={CENTER_X} cy={trunkTop - 5} rx={crownR} ry={crownR * 0.85} fill="url(#crown)" />

      {/* Sous-couronnes pour volume */}
      <Ellipse cx={CENTER_X - crownR * 0.4} cy={trunkTop + 5} rx={crownR * 0.6} ry={crownR * 0.5} fill={species.leaves} opacity={0.7} />
      <Ellipse cx={CENTER_X + crownR * 0.45} cy={trunkTop} rx={crownR * 0.55} ry={crownR * 0.45} fill={species.leavesDark} opacity={0.6} />
      <Ellipse cx={CENTER_X} cy={trunkTop - crownR * 0.5} rx={crownR * 0.5} ry={crownR * 0.4} fill={species.leavesLight} opacity={0.4} />

      {/* Fleurs/fruits selon espèce */}
      {visual.hasFlowers && <SpeciesAccents species={species} speciesType={speciesType} crownR={crownR} crownY={trunkTop - 5} />}
      {visual.hasFruits && <SpeciesFruits species={species} speciesType={speciesType} crownR={crownR} crownY={trunkTop - 5} />}
    </G>
  );
}

// ── STADE 5 : Majestueux ──────────────────────

function MajesticStage({ species, progress, visual, speciesType }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  progress: number;
  visual: ReturnType<typeof getVisualComplexity>;
  speciesType: TreeSpecies;
}) {
  const trunkH = 95;
  const trunkTop = GROUND_Y - trunkH;
  const crownR = 50 + progress * 5;
  const trunkW = 10;

  if (speciesType === 'bambou') {
    return <BambooTree species={species} trunkH={trunkH} progress={progress} visual={visual} majestic />;
  }
  if (speciesType === 'palmier') {
    return <PalmTree species={species} trunkH={trunkH} progress={progress} visual={visual} majestic />;
  }

  return (
    <G>
      {/* Racines massives */}
      {[-1, 1].map((side) => (
        <Path
          key={`root-${side}`}
          d={`M${CENTER_X + side * 10} ${GROUND_Y} Q${CENTER_X + side * 25} ${GROUND_Y + 5} ${CENTER_X + side * 30} ${GROUND_Y + 8}`}
          stroke={species.trunkDark}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {/* Tronc massif */}
      <Path
        d={`M${CENTER_X - trunkW} ${GROUND_Y}
            Q${CENTER_X - trunkW + 2} ${GROUND_Y - trunkH * 0.4} ${CENTER_X - trunkW * 0.6} ${trunkTop + 20}
            L${CENTER_X + trunkW * 0.6} ${trunkTop + 20}
            Q${CENTER_X + trunkW - 2} ${GROUND_Y - trunkH * 0.4} ${CENTER_X + trunkW} ${GROUND_Y} Z`}
        fill="url(#trunk)"
      />
      {/* Texture écorce */}
      {[0.3, 0.5, 0.7].map((t, i) => (
        <Path
          key={`bark-${i}`}
          d={`M${CENTER_X - trunkW * 0.3} ${GROUND_Y - trunkH * t} q${2} ${-3} ${0} ${-6}`}
          stroke={species.trunkDark}
          strokeWidth={0.8}
          fill="none"
          opacity={0.4}
        />
      ))}

      {/* Branches majeures */}
      {Array.from({ length: 6 }).map((_, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const bY = trunkTop + 22 + i * 6;
        const bLen = 25 + (6 - i) * 4;
        return (
          <Path
            key={`br-${i}`}
            d={`M${CENTER_X} ${bY} Q${CENTER_X + side * bLen * 0.4} ${bY - 10} ${CENTER_X + side * bLen} ${bY - 15 - i}`}
            stroke={species.trunk}
            strokeWidth={Math.max(2, 4 - i * 0.4)}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}

      {/* Couronne volumineuse multicouche */}
      <Ellipse cx={CENTER_X} cy={trunkTop - 8} rx={crownR} ry={crownR * 0.8} fill="url(#crown)" />
      <Ellipse cx={CENTER_X - 20} cy={trunkTop + 5} rx={crownR * 0.55} ry={crownR * 0.45} fill={species.leaves} opacity={0.75} />
      <Ellipse cx={CENTER_X + 22} cy={trunkTop} rx={crownR * 0.5} ry={crownR * 0.42} fill={species.leavesDark} opacity={0.65} />
      <Ellipse cx={CENTER_X - 5} cy={trunkTop - crownR * 0.55} rx={crownR * 0.45} ry={crownR * 0.38} fill={species.leavesLight} opacity={0.45} />
      <Ellipse cx={CENTER_X + 15} cy={trunkTop - crownR * 0.3} rx={crownR * 0.4} ry={crownR * 0.35} fill={species.leavesLight} opacity={0.3} />

      {/* Fleurs + fruits abondants */}
      <SpeciesAccents species={species} speciesType={speciesType} crownR={crownR} crownY={trunkTop - 8} count={8} />
      <SpeciesFruits species={species} speciesType={speciesType} crownR={crownR} crownY={trunkTop - 8} count={6} />

      {/* Oiseaux */}
      <G opacity={0.7}>
        <Path d="M55 80 q-3 -3 -6 0 q3 -3 6 0" stroke="#333" strokeWidth={1} fill="none" />
        <Path d="M140 75 q-3 -3 -6 0 q3 -3 6 0" stroke="#333" strokeWidth={1} fill="none" />
      </G>
    </G>
  );
}

// ── STADE 6 : Légendaire ──────────────────────

function LegendaryStage({ species, progress, visual, speciesType }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  progress: number;
  visual: ReturnType<typeof getVisualComplexity>;
  speciesType: TreeSpecies;
}) {
  const trunkH = 100;
  const trunkTop = GROUND_Y - trunkH;
  const crownR = 55;
  const trunkW = 11;

  if (speciesType === 'bambou') {
    return <BambooTree species={species} trunkH={trunkH} progress={progress} visual={visual} legendary />;
  }
  if (speciesType === 'palmier') {
    return <PalmTree species={species} trunkH={trunkH} progress={progress} visual={visual} legendary />;
  }

  return (
    <G>
      {/* Racines majestueuses */}
      {[-1, -0.5, 0.5, 1].map((side, i) => (
        <Path
          key={`root-${i}`}
          d={`M${CENTER_X + side * 10} ${GROUND_Y} Q${CENTER_X + side * 28} ${GROUND_Y + 6} ${CENTER_X + side * 35} ${GROUND_Y + 10}`}
          stroke={species.trunkDark}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {/* Tronc monumental */}
      <Path
        d={`M${CENTER_X - trunkW} ${GROUND_Y}
            Q${CENTER_X - trunkW + 2} ${GROUND_Y - trunkH * 0.35} ${CENTER_X - trunkW * 0.5} ${trunkTop + 25}
            L${CENTER_X + trunkW * 0.5} ${trunkTop + 25}
            Q${CENTER_X + trunkW - 2} ${GROUND_Y - trunkH * 0.35} ${CENTER_X + trunkW} ${GROUND_Y} Z`}
        fill="url(#trunk)"
      />

      {/* Branches dorées */}
      {Array.from({ length: 7 }).map((_, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const bY = trunkTop + 26 + i * 5;
        const bLen = 28 + (7 - i) * 3;
        return (
          <Path
            key={`br-${i}`}
            d={`M${CENTER_X} ${bY} Q${CENTER_X + side * bLen * 0.4} ${bY - 12} ${CENTER_X + side * bLen} ${bY - 18}`}
            stroke={species.trunk}
            strokeWidth={Math.max(2, 4.5 - i * 0.4)}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}

      {/* Couronne dorée luxuriante */}
      <Ellipse cx={CENTER_X} cy={trunkTop - 10} rx={crownR} ry={crownR * 0.82} fill="url(#crown)" />
      <Ellipse cx={CENTER_X - 22} cy={trunkTop + 5} rx={crownR * 0.5} ry={crownR * 0.42} fill={species.leaves} opacity={0.7} />
      <Ellipse cx={CENTER_X + 24} cy={trunkTop} rx={crownR * 0.48} ry={crownR * 0.4} fill={species.leavesDark} opacity={0.6} />
      <Ellipse cx={CENTER_X} cy={trunkTop - crownR * 0.55} rx={crownR * 0.5} ry={crownR * 0.42} fill={species.leavesLight} opacity={0.5} />

      {/* Reflet doré sur la couronne */}
      <Ellipse cx={CENTER_X} cy={trunkTop - 12} rx={crownR * 0.9} ry={crownR * 0.7} fill="#FFD700" opacity={0.1} />

      {/* Fleurs + fruits dorés */}
      <SpeciesAccents species={species} speciesType={speciesType} crownR={crownR} crownY={trunkTop - 10} count={12} golden />
      <SpeciesFruits species={species} speciesType={speciesType} crownR={crownR} crownY={trunkTop - 10} count={8} />

      {/* Oiseaux + papillons */}
      <G opacity={0.75}>
        <Path d="M45 70 q-4 -4 -8 0 q4 -4 8 0" stroke="#DAA520" strokeWidth={1.2} fill="none" />
        <Path d="M150 65 q-4 -4 -8 0 q4 -4 8 0" stroke="#DAA520" strokeWidth={1.2} fill="none" />
        <Path d="M60 55 q-3 -3 -6 0 q3 -3 6 0" stroke="#DAA520" strokeWidth={1} fill="none" />
      </G>

      {/* Étoiles décoratives */}
      {[
        [CENTER_X - 35, trunkTop - 25],
        [CENTER_X + 30, trunkTop - 30],
        [CENTER_X - 15, trunkTop - crownR * 0.7],
        [CENTER_X + 20, trunkTop - crownR * 0.5],
      ].map(([sx, sy], i) => (
        <Circle key={`star-${i}`} cx={sx} cy={sy} r={2} fill="#FFD700" opacity={0.8} />
      ))}
    </G>
  );
}

// ── Variantes espèces spéciales ───────────────

function BambooTree({ species, trunkH, progress, visual, majestic, legendary }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  trunkH: number;
  progress: number;
  visual: ReturnType<typeof getVisualComplexity>;
  majestic?: boolean;
  legendary?: boolean;
}) {
  const segmentCount = majestic ? 8 : legendary ? 10 : 5 + Math.floor(progress * 3);
  const segH = trunkH / segmentCount;
  const stemCount = legendary ? 5 : majestic ? 4 : 2 + Math.floor(progress);

  return (
    <G>
      {Array.from({ length: stemCount }).map((_, s) => {
        const offsetX = (s - (stemCount - 1) / 2) * 14;
        const sHeight = trunkH * (0.7 + Math.random() * 0.3);

        return (
          <G key={`stem-${s}`}>
            {/* Segments du bambou */}
            {Array.from({ length: segmentCount }).map((_, i) => {
              const y1 = GROUND_Y - i * segH;
              const y2 = y1 - segH + 2;
              return (
                <G key={`seg-${s}-${i}`}>
                  <Rect
                    x={CENTER_X + offsetX - 3}
                    y={y2}
                    width={6}
                    height={segH - 2}
                    rx={3}
                    fill={species.trunk}
                    opacity={0.9}
                  />
                  {/* Noeud */}
                  <Rect
                    x={CENTER_X + offsetX - 4}
                    y={y1 - 1}
                    width={8}
                    height={2}
                    rx={1}
                    fill={species.trunkDark}
                  />
                </G>
              );
            })}

            {/* Feuilles de bambou (longues et fines) */}
            {Array.from({ length: 3 + Math.floor(progress * 2) }).map((_, l) => {
              const side = l % 2 === 0 ? 1 : -1;
              const lY = GROUND_Y - sHeight * 0.4 - l * segH * 1.2;
              const leafLen = 20 + progress * 8;
              return (
                <Path
                  key={`leaf-${s}-${l}`}
                  d={`M${CENTER_X + offsetX} ${lY} Q${CENTER_X + offsetX + side * leafLen * 0.6} ${lY - 5} ${CENTER_X + offsetX + side * leafLen} ${lY + 3}`}
                  stroke={species.leaves}
                  strokeWidth={2.5}
                  fill={species.leavesLight}
                  opacity={0.8}
                />
              );
            })}
          </G>
        );
      })}

      {legendary && (
        <G opacity={0.15}>
          <Circle cx={CENTER_X} cy={GROUND_Y - trunkH * 0.5} r={45} fill="#FFD700" />
        </G>
      )}
    </G>
  );
}

function PalmTree({ species, trunkH, progress, visual, majestic, legendary }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  trunkH: number;
  progress: number;
  visual: ReturnType<typeof getVisualComplexity>;
  majestic?: boolean;
  legendary?: boolean;
}) {
  const trunkTop = GROUND_Y - trunkH;
  const trunkW = legendary ? 9 : majestic ? 8 : 6 + progress;
  const frondCount = legendary ? 10 : majestic ? 8 : 5 + Math.floor(progress * 2);
  const frondLen = legendary ? 50 : majestic ? 45 : 30 + progress * 12;

  return (
    <G>
      {/* Tronc courbé */}
      <Path
        d={`M${CENTER_X - trunkW * 0.8} ${GROUND_Y}
            Q${CENTER_X - 5} ${GROUND_Y - trunkH * 0.4}
            ${CENTER_X + 2} ${trunkTop}
            L${CENTER_X + trunkW * 0.3} ${trunkTop}
            Q${CENTER_X + trunkW * 0.3 - 3} ${GROUND_Y - trunkH * 0.4}
            ${CENTER_X + trunkW * 0.8} ${GROUND_Y} Z`}
        fill={species.trunk}
      />

      {/* Anneaux d'écorce */}
      {Array.from({ length: Math.floor(trunkH / 10) }).map((_, i) => {
        const y = GROUND_Y - (i + 1) * 10;
        const xOff = -3 + (i * 0.5);
        return (
          <Path
            key={`ring-${i}`}
            d={`M${CENTER_X + xOff - trunkW * 0.5} ${y} Q${CENTER_X + xOff} ${y - 2} ${CENTER_X + xOff + trunkW * 0.5} ${y}`}
            stroke={species.trunkDark}
            strokeWidth={0.8}
            fill="none"
            opacity={0.5}
          />
        );
      })}

      {/* Palmes (fronds) */}
      {Array.from({ length: frondCount }).map((_, i) => {
        const angle = (i / frondCount) * 360;
        const rad = (angle * Math.PI) / 180;
        const endX = CENTER_X + 2 + Math.cos(rad) * frondLen;
        const endY = trunkTop - 5 + Math.sin(rad) * frondLen * 0.5 + frondLen * 0.15;
        const cpX = CENTER_X + 2 + Math.cos(rad) * frondLen * 0.6;
        const cpY = trunkTop - 10 + Math.sin(rad) * frondLen * 0.2;

        return (
          <Path
            key={`frond-${i}`}
            d={`M${CENTER_X + 2} ${trunkTop - 3} Q${cpX} ${cpY} ${endX} ${endY}`}
            stroke={species.leavesDark}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}

      {/* Feuilles le long des palmes */}
      {Array.from({ length: frondCount }).map((_, i) => {
        const angle = (i / frondCount) * 360;
        const rad = (angle * Math.PI) / 180;
        const midX = CENTER_X + 2 + Math.cos(rad) * frondLen * 0.65;
        const midY = trunkTop - 8 + Math.sin(rad) * frondLen * 0.3 + frondLen * 0.08;

        return (
          <Ellipse
            key={`pleaf-${i}`}
            cx={midX}
            cy={midY}
            rx={12}
            ry={4}
            fill={species.leaves}
            opacity={0.7}
            transform={`rotate(${angle + 90} ${midX} ${midY})`}
          />
        );
      })}

      {/* Noix de coco (si fruits) */}
      {visual.hasFruits && (
        <G>
          {[[-6, 4], [6, 3], [0, 7]].map(([dx, dy], i) => (
            <Circle
              key={`coco-${i}`}
              cx={CENTER_X + 2 + dx}
              cy={trunkTop + dy}
              r={4}
              fill={species.accent}
            />
          ))}
        </G>
      )}

      {legendary && (
        <G opacity={0.12}>
          <Circle cx={CENTER_X} cy={trunkTop - 10} r={50} fill="#FFD700" />
        </G>
      )}
    </G>
  );
}

// ── Détails fleurs/fruits par espèce ──────────

function SpeciesAccents({ species, speciesType, crownR, crownY, count = 5, golden }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  speciesType: TreeSpecies;
  crownR: number;
  crownY: number;
  count?: number;
  golden?: boolean;
}) {
  // Positions pseudo-aléatoires sur la couronne
  const positions = useMemo(() => {
    const pts: [number, number][] = [];
    const seed = speciesType.length; // déterministe par espèce
    for (let i = 0; i < count; i++) {
      const angle = ((seed + i * 137.5) % 360) * (Math.PI / 180); // golden angle
      const r = crownR * (0.3 + ((i * 31) % 7) / 10);
      pts.push([CENTER_X + Math.cos(angle) * r, crownY + Math.sin(angle) * r * 0.8]);
    }
    return pts;
  }, [speciesType, crownR, crownY, count]);

  const color = golden ? '#FFD700' : species.accent;
  const r = speciesType === 'cerisier' ? 3.5 : 2.5;

  return (
    <G>
      {positions.map(([x, y], i) => (
        <G key={`acc-${i}`}>
          <Circle cx={x} cy={y} r={r} fill={color} opacity={0.85} />
          {speciesType === 'cerisier' && (
            <Circle cx={x} cy={y} r={r * 0.4} fill={golden ? '#FFF8DC' : species.accentLight} opacity={0.6} />
          )}
        </G>
      ))}
    </G>
  );
}

function SpeciesFruits({ species, speciesType, crownR, crownY, count = 4 }: {
  species: typeof SPECIES_INFO[TreeSpecies];
  speciesType: TreeSpecies;
  crownR: number;
  crownY: number;
  count?: number;
}) {
  if (speciesType === 'cerisier' || speciesType === 'bambou' || speciesType === 'palmier') return null;

  const positions = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const angle = ((i * 97 + 42) % 360) * (Math.PI / 180);
      const r = crownR * (0.4 + ((i * 53) % 5) / 12);
      pts.push([CENTER_X + Math.cos(angle) * r, crownY + Math.sin(angle) * r * 0.7 + crownR * 0.2]);
    }
    return pts;
  }, [speciesType, crownR, crownY, count]);

  const r = speciesType === 'oranger' ? 4 : 3; // oranges plus grosses

  return (
    <G>
      {positions.map(([x, y], i) => (
        <G key={`fruit-${i}`}>
          <Circle cx={x} cy={y} r={r} fill={species.accent} />
          <Circle cx={x - 1} cy={y - 1} r={r * 0.35} fill={species.accentLight} opacity={0.5} />
        </G>
      ))}
    </G>
  );
}

// ── Particules flottantes (Reanimated) ────────

function FloatingParticles({ color, count, size }: { color: string; count: number; size: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.particleContainer]} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Particle key={i} color={color} index={i} containerSize={size} />
      ))}
    </View>
  );
}

function Particle({ color, index, containerSize }: { color: string; index: number; containerSize: number }) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  const startX = useMemo(() => (index * 37 + 13) % containerSize, [index, containerSize]);
  const startY = useMemo(() => ((index * 53 + 7) % (containerSize * 0.6)) + containerSize * 0.1, [index, containerSize]);
  const particleSize = useMemo(() => 3 + (index % 3) * 2, [index]);
  const duration = useMemo(() => 3000 + (index % 4) * 1000, [index]);

  useEffect(() => {
    if (reducedMotion) return;
    const delay = index * 400;

    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-20 - index * 5, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    ));
    translateX.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(8 + (index % 3) * 4, { duration: duration * 0.7, easing: Easing.inOut(Easing.sin) }),
        withTiming(-8 - (index % 3) * 4, { duration: duration * 0.7, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    ));
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.8, { duration: duration * 0.5 }),
        withTiming(0.2, { duration: duration * 0.5 }),
      ),
      -1, true,
    ));
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: duration * 0.4 }),
        withTiming(0.5, { duration: duration * 0.6 }),
      ),
      -1, true,
    ));
  }, [reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startX,
          top: startY,
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

// ── Styles ─────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleContainer: {
    overflow: 'visible',
  },
});

export const TreeView = React.memo(TreeViewInner);
