/**
 * TreeView.tsx — Rendu SVG animé de l'arbre mascotte
 *
 * Arbre procédural qui grandit avec le niveau du joueur.
 * 5 espèces × 6 stades, animations idle (respiration, balancement),
 * particules pour stades avancés.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
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
  Text as SvgText,
  Image as SvgImage,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useEffect } from 'react';

const AnimatedG = Animated.createAnimatedComponent(G);

import {
  type TreeSpecies,
  type TreeStage,
  SPECIES_INFO,
  DECORATIONS,
  INHABITANTS,
  SCENE_SLOTS,
  ITEM_ILLUSTRATIONS,
} from '../../lib/mascot/types';
import { NativePlacedItems } from './NativePlacedItems';
import { NativePlacementSlots } from './NativePlacementSlots';
import {
  getTreeStage,
  getStageProgress,
  getVisualComplexity,
  getStageIndex,
} from '../../lib/mascot/engine';
import {
  type Season,
  getCurrentSeason,
  getSeasonalPalette,
  SKY_COLORS,
  GROUND_COLORS,
  SEASONAL_PARTICLES,
} from '../../lib/mascot/seasons';

// ── Types ──────────────────────────────────────

interface TreeViewProps {
  species: TreeSpecies;
  level: number;
  size?: number;         // largeur/hauteur du viewport (défaut 200)
  showGround?: boolean;  // afficher le sol (défaut true)
  interactive?: boolean; // animations idle (défaut true)
  decorations?: string[];  // IDs des décorations achetées
  inhabitants?: string[];  // IDs des habitants achetés
  previewMode?: boolean;   // ignorer le stade minimum (aperçu boutique)
  season?: Season;         // forcer une saison (défaut: saison courante)
  placements?: Record<string, string>;  // slotId → itemId (items placés sur la scène)
  placingItem?: string | null;          // itemId en cours de placement (active le mode placement)
  onSlotSelect?: (slotId: string) => void;  // callback quand l'utilisateur tape un slot
}

// ── Constantes géométrie ───────────────────────

const VIEWBOX_W = 200;
const VIEWBOX_H = 240;
const GROUND_Y = 200;
const CENTER_X = 100;

// ── Sprites pixel art Mana Seed ──────────────────

/** Mapping espèce → variété fruit tree */
const SPECIES_TO_FRUIT: Record<TreeSpecies, string> = {
  cerisier: 'peach',
  chene:    'apple_red',
  oranger:  'orange',
  bambou:   'plum',
  palmier:  'pear',
};

/** Mapping stade → taille sprite (1-4). Graine = sprite spécial. */
const STAGE_TO_SIZE: Record<TreeStage, number> = {
  graine:     0, // sprite spécial
  pousse:     1,
  arbuste:    2,
  arbre:      3,
  majestueux: 4,
  legendaire: 4, // même taille + effets
};

/** Mapping saison → clé spritesheet */
const SEASON_TO_KEY: Record<Season, string> = {
  printemps: 'spring',
  ete:       'summer',
  automne:   'autumn',
  hiver:     'winter',
};

/** Sprite graine (commun à toutes les espèces) */
const SEED_SPRITE = require('../../assets/garden/trees/seed.png');

/** Tous les sprites pixel art par espèce, saison et taille */
type PixelSprites = Record<string, Record<string, Record<number, any>>>;
const PIXEL_TREE_SPRITES: PixelSprites = {
  peach: {
    spring:  { 1: require('../../assets/garden/trees/peach/spring_1.png'), 2: require('../../assets/garden/trees/peach/spring_2.png'), 3: require('../../assets/garden/trees/peach/spring_3.png'), 4: require('../../assets/garden/trees/peach/spring_4.png') },
    summer:  { 1: require('../../assets/garden/trees/peach/summer_1.png'), 2: require('../../assets/garden/trees/peach/summer_2.png'), 3: require('../../assets/garden/trees/peach/summer_3.png'), 4: require('../../assets/garden/trees/peach/summer_4.png') },
    autumn:  { 1: require('../../assets/garden/trees/peach/autumn_1.png'), 2: require('../../assets/garden/trees/peach/autumn_2.png'), 3: require('../../assets/garden/trees/peach/autumn_3.png'), 4: require('../../assets/garden/trees/peach/autumn_4.png') },
    winter:  { 1: require('../../assets/garden/trees/peach/winter_1.png'), 2: require('../../assets/garden/trees/peach/winter_2.png'), 3: require('../../assets/garden/trees/peach/winter_3.png'), 4: require('../../assets/garden/trees/peach/winter_4.png') },
    shadow:  { 1: require('../../assets/garden/trees/peach/shadow_1.png'), 2: require('../../assets/garden/trees/peach/shadow_2.png'), 3: require('../../assets/garden/trees/peach/shadow_3.png'), 4: require('../../assets/garden/trees/peach/shadow_4.png') },
  },
  apple_red: {
    spring:  { 1: require('../../assets/garden/trees/apple_red/spring_1.png'), 2: require('../../assets/garden/trees/apple_red/spring_2.png'), 3: require('../../assets/garden/trees/apple_red/spring_3.png'), 4: require('../../assets/garden/trees/apple_red/spring_4.png') },
    summer:  { 1: require('../../assets/garden/trees/apple_red/summer_1.png'), 2: require('../../assets/garden/trees/apple_red/summer_2.png'), 3: require('../../assets/garden/trees/apple_red/summer_3.png'), 4: require('../../assets/garden/trees/apple_red/summer_4.png') },
    autumn:  { 1: require('../../assets/garden/trees/apple_red/autumn_1.png'), 2: require('../../assets/garden/trees/apple_red/autumn_2.png'), 3: require('../../assets/garden/trees/apple_red/autumn_3.png'), 4: require('../../assets/garden/trees/apple_red/autumn_4.png') },
    winter:  { 1: require('../../assets/garden/trees/apple_red/winter_1.png'), 2: require('../../assets/garden/trees/apple_red/winter_2.png'), 3: require('../../assets/garden/trees/apple_red/winter_3.png'), 4: require('../../assets/garden/trees/apple_red/winter_4.png') },
    shadow:  { 1: require('../../assets/garden/trees/apple_red/shadow_1.png'), 2: require('../../assets/garden/trees/apple_red/shadow_2.png'), 3: require('../../assets/garden/trees/apple_red/shadow_3.png'), 4: require('../../assets/garden/trees/apple_red/shadow_4.png') },
  },
  orange: {
    spring:  { 1: require('../../assets/garden/trees/orange/spring_1.png'), 2: require('../../assets/garden/trees/orange/spring_2.png'), 3: require('../../assets/garden/trees/orange/spring_3.png'), 4: require('../../assets/garden/trees/orange/spring_4.png') },
    summer:  { 1: require('../../assets/garden/trees/orange/summer_1.png'), 2: require('../../assets/garden/trees/orange/summer_2.png'), 3: require('../../assets/garden/trees/orange/summer_3.png'), 4: require('../../assets/garden/trees/orange/summer_4.png') },
    autumn:  { 1: require('../../assets/garden/trees/orange/autumn_1.png'), 2: require('../../assets/garden/trees/orange/autumn_2.png'), 3: require('../../assets/garden/trees/orange/autumn_3.png'), 4: require('../../assets/garden/trees/orange/autumn_4.png') },
    winter:  { 1: require('../../assets/garden/trees/orange/winter_1.png'), 2: require('../../assets/garden/trees/orange/winter_2.png'), 3: require('../../assets/garden/trees/orange/winter_3.png'), 4: require('../../assets/garden/trees/orange/winter_4.png') },
    shadow:  { 1: require('../../assets/garden/trees/orange/shadow_1.png'), 2: require('../../assets/garden/trees/orange/shadow_2.png'), 3: require('../../assets/garden/trees/orange/shadow_3.png'), 4: require('../../assets/garden/trees/orange/shadow_4.png') },
  },
  plum: {
    spring:  { 1: require('../../assets/garden/trees/plum/spring_1.png'), 2: require('../../assets/garden/trees/plum/spring_2.png'), 3: require('../../assets/garden/trees/plum/spring_3.png'), 4: require('../../assets/garden/trees/plum/spring_4.png') },
    summer:  { 1: require('../../assets/garden/trees/plum/summer_1.png'), 2: require('../../assets/garden/trees/plum/summer_2.png'), 3: require('../../assets/garden/trees/plum/summer_3.png'), 4: require('../../assets/garden/trees/plum/summer_4.png') },
    autumn:  { 1: require('../../assets/garden/trees/plum/autumn_1.png'), 2: require('../../assets/garden/trees/plum/autumn_2.png'), 3: require('../../assets/garden/trees/plum/autumn_3.png'), 4: require('../../assets/garden/trees/plum/autumn_4.png') },
    winter:  { 1: require('../../assets/garden/trees/plum/winter_1.png'), 2: require('../../assets/garden/trees/plum/winter_2.png'), 3: require('../../assets/garden/trees/plum/winter_3.png'), 4: require('../../assets/garden/trees/plum/winter_4.png') },
    shadow:  { 1: require('../../assets/garden/trees/plum/shadow_1.png'), 2: require('../../assets/garden/trees/plum/shadow_2.png'), 3: require('../../assets/garden/trees/plum/shadow_3.png'), 4: require('../../assets/garden/trees/plum/shadow_4.png') },
  },
  pear: {
    spring:  { 1: require('../../assets/garden/trees/pear/spring_1.png'), 2: require('../../assets/garden/trees/pear/spring_2.png'), 3: require('../../assets/garden/trees/pear/spring_3.png'), 4: require('../../assets/garden/trees/pear/spring_4.png') },
    summer:  { 1: require('../../assets/garden/trees/pear/summer_1.png'), 2: require('../../assets/garden/trees/pear/summer_2.png'), 3: require('../../assets/garden/trees/pear/summer_3.png'), 4: require('../../assets/garden/trees/pear/summer_4.png') },
    autumn:  { 1: require('../../assets/garden/trees/pear/autumn_1.png'), 2: require('../../assets/garden/trees/pear/autumn_2.png'), 3: require('../../assets/garden/trees/pear/autumn_3.png'), 4: require('../../assets/garden/trees/pear/autumn_4.png') },
    winter:  { 1: require('../../assets/garden/trees/pear/winter_1.png'), 2: require('../../assets/garden/trees/pear/winter_2.png'), 3: require('../../assets/garden/trees/pear/winter_3.png'), 4: require('../../assets/garden/trees/pear/winter_4.png') },
    shadow:  { 1: require('../../assets/garden/trees/pear/shadow_1.png'), 2: require('../../assets/garden/trees/pear/shadow_2.png'), 3: require('../../assets/garden/trees/pear/shadow_3.png'), 4: require('../../assets/garden/trees/pear/shadow_4.png') },
  },
};

/** Résout le sprite pixel pour une espèce + stade + saison */
function getPixelTreeSprite(species: TreeSpecies, stage: TreeStage, season: Season): any {
  if (stage === 'graine') return SEED_SPRITE;
  const fruit = SPECIES_TO_FRUIT[species];
  const size = STAGE_TO_SIZE[stage];
  const seasonKey = SEASON_TO_KEY[season];
  return PIXEL_TREE_SPRITES[fruit]?.[seasonKey]?.[size] ?? null;
}

/** Résout le sprite ombre correspondant */
function getPixelShadowSprite(species: TreeSpecies, stage: TreeStage): any {
  if (stage === 'graine') return null;
  const fruit = SPECIES_TO_FRUIT[species];
  const size = STAGE_TO_SIZE[stage];
  return PIXEL_TREE_SPRITES[fruit]?.shadow?.[size] ?? null;
}

// ── Composant principal ────────────────────────

function TreeViewInner({ species, level, size = 200, showGround = true, interactive = true, decorations = [], inhabitants = [], previewMode = false, season: seasonProp, placements = {}, placingItem = null, onSlotSelect }: TreeViewProps) {
  const stage = getTreeStage(level);
  const progress = getStageProgress(level);
  const stageIdx = getStageIndex(level);
  const visual = getVisualComplexity(level);
  const currentSeason = useMemo(() => seasonProp ?? getCurrentSeason(), [seasonProp]);
  const sp = useMemo(() => getSeasonalPalette(species, currentSeason), [species, currentSeason]);
  const sky = SKY_COLORS[currentSeason];
  const ground = GROUND_COLORS[currentSeason];
  const seasonParticles = SEASONAL_PARTICLES[currentSeason];
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

  // Style animé pour le mode pixel (vue top-down) : léger pulse, pas de sway
  const pixelAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  // Style pour le conteneur SVG fallback (pas d'animation de transform ici)
  const treeAnimStyle = useAnimatedStyle(() => ({
    transform: [],
  }));

  // Props animées pour le <G> SVG interne — pivot au pied de l'arbre
  const treeGroupProps = useAnimatedProps(() => ({
    transform: `translate(${CENTER_X}, ${GROUND_Y}) rotate(${sway.value * 1.5}) scale(${breathe.value}) translate(${-CENTER_X}, ${-GROUND_Y})`,
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

  // ── Mode pixel art (sprite Mana Seed) ──
  const pixelSprite = useMemo(
    () => getPixelTreeSprite(species, stage, currentSeason),
    [species, stage, currentSeason],
  );
  const shadowSprite = useMemo(
    () => getPixelShadowSprite(species, stage),
    [species, stage],
  );
  const isLegendary = stage === 'legendaire';
  const isSeed = stage === 'graine';

  // IDs des animaux pixel (pour les exclure du rendu statique et les animer separement)
  const pixelAnimalIds = useMemo(() => new Set(Object.keys(ANIMAL_IDLE_FRAMES)), []);

  if (pixelSprite) {
    const imgHeight = size * (VIEWBOX_H / VIEWBOX_W);
    // Graine = petite (30%), autres = proportionnel à la taille
    const imgScale = isSeed ? 0.30 : (0.50 + STAGE_TO_SIZE[stage] * 0.10);
    const scaledW = size * imgScale;
    // Ratio source pixel art = 3:4 (48x64)
    const scaledH = isSeed ? scaledW * 2 : scaledW * (64 / 48);
    const groundRatio = GROUND_Y / VIEWBOX_H;
    const topOffset = (imgHeight * groundRatio) - scaledH;
    return (
      <View style={[styles.container, { width: size, height: imgHeight }]}>
        {/* Pas de SeasonalParticles en mode pixel — elles clashent avec le style */}
        {/* Effets légendaire uniquement : particules dorées */}
        {isLegendary && animate && (
          <FloatingParticles color={sp.particle} count={12} size={size} />
        )}
        {/* Ombre au sol (top-down : centrée sous l'arbre, elliptique) */}
        {shadowSprite && showGround && (
          <Animated.View style={[{
            position: 'absolute',
            top: imgHeight * groundRatio - scaledH * 0.04,
            left: (size - scaledW * 0.7) / 2,
            width: scaledW * 0.7,
            height: scaledH * 0.12,
            opacity: 0.25,
          }, pixelAnimStyle] as any}>
            <Image
              source={shadowSprite}
              style={{ width: '100%', height: '100%' } as any}
            />
          </Animated.View>
        )}
        {/* Arbre pixel — animation pulse top-down */}
        <Animated.View style={[styles.svgWrap, pixelAnimStyle, { position: 'absolute', top: topOffset, left: (size - scaledW) / 2 }]}>
          {isLegendary && (
            <View style={{
              position: 'absolute',
              top: -scaledH * 0.1,
              left: -scaledW * 0.15,
              width: scaledW * 1.3,
              height: scaledH * 1.2,
              borderRadius: scaledW * 0.5,
              backgroundColor: sp.accent,
              opacity: 0.08,
            }} />
          )}
          <Image
            source={pixelSprite}
            style={{ width: scaledW, height: scaledH } as any}
          />
        </Animated.View>
        {/* Overlay natif RN pour items placés + slots de placement */}
        {(Object.keys(placements).length > 0 || placingItem) && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} pointerEvents="box-none">
            {showGround && Object.keys(placements).length > 0 && !placingItem && (
              <NativePlacedItems
                placements={placements}
                containerWidth={size}
                containerHeight={imgHeight}
                skipIds={pixelAnimalIds}
              />
            )}
            {showGround && placingItem && (
              <NativePlacementSlots
                placements={placements}
                placingItemId={placingItem}
                containerWidth={size}
                containerHeight={imgHeight}
                onSelect={onSlotSelect}
              />
            )}
          </View>
        )}
        {/* Animaux pixel animés (cycle idle natif RN, hors SVG) */}
        {animate && (() => {
          // Collecter les animaux pixel — eviter les doublons
          const animalIds: { id: string; fromSlot?: string }[] = [];
          const placedAnimalIds = new Set(
            Object.values(placements).filter(itemId => ANIMAL_IDLE_FRAMES[itemId])
          );
          // Animaux places sur des slots de scene (prioritaire)
          for (const [slotId, itemId] of Object.entries(placements)) {
            if (ANIMAL_IDLE_FRAMES[itemId]) animalIds.push({ id: itemId, fromSlot: slotId });
          }
          // Animaux dans la liste des habitants SEULEMENT s'ils ne sont pas deja places
          for (const id of inhabitants) {
            if (ANIMAL_IDLE_FRAMES[id] && !placedAnimalIds.has(id)) animalIds.push({ id });
          }
          if (animalIds.length === 0) return null;
          return (
            <View style={[StyleSheet.absoluteFill, { zIndex: 3 }]} pointerEvents="none">
              {animalIds.map(({ id, fromSlot }) => {
                const frames = ANIMAL_IDLE_FRAMES[id]!;
                let px: number, py: number, s: number;
                if (fromSlot) {
                  // Placé sur un slot de scène
                  const sceneSlot = SCENE_SLOTS.find(sl => sl.id === fromSlot);
                  if (!sceneSlot) return null;
                  s = 28;
                  px = (sceneSlot.cx / VIEWBOX_W) * size;
                  py = (sceneSlot.cy / VIEWBOX_H) * imgHeight;
                } else {
                  // Position par défaut (HAB_SLOTS)
                  const slot = HAB_SLOTS[id];
                  if (!slot) return null;
                  const pos = getItemPosition(species, stageIdx, slot);
                  s = pos.fontSize * 1.5;
                  px = (pos.x / VIEWBOX_W) * size;
                  py = (pos.y / VIEWBOX_H) * imgHeight;
                }
                return (
                  <AnimatedAnimal
                    key={fromSlot ?? id}
                    frames={frames}
                    x={px - s / 2}
                    y={py - s / 2}
                    size={s}
                    animalId={id}
                    containerWidth={size}
                  />
                );
              })}
            </View>
          );
        })()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size * (VIEWBOX_H / VIEWBOX_W) }]}>
      {/* Particules saisonnières */}
      {animate && (
        <SeasonalParticles particle={seasonParticles} size={size} />
      )}

      {/* Particules animées (stades avancés) */}
      {visual.hasParticles && animate && (
        <FloatingParticles color={sp.particle} count={visual.hasAura ? 12 : 6} size={size} />
      )}

      <Animated.View style={styles.svgWrap}>
        <Svg
          width={size}
          height={size * (VIEWBOX_H / VIEWBOX_W)}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        >
          <Defs>
            {/* Gradient ciel (saisonnier) */}
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={sky.top} stopOpacity={0.3} />
              <Stop offset="1" stopColor={sky.bottom} stopOpacity={0.1} />
            </LinearGradient>
            {/* Gradient sol (saisonnier) */}
            <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={ground.top} />
              <Stop offset="1" stopColor={ground.bottom} />
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

          {/* Sol géré par le conteneur parent (gradient fond) — pas de sol SVG */}
          {showGround && <HabitatLayer stageIdx={stageIdx} season={currentSeason} groundColors={ground} accent={sp.accent} />}

          {/* Arbre + décorations — animés (sway + breathe), pivot au pied */}
          <AnimatedG animatedProps={animate ? treeGroupProps : undefined}>
            {visual.hasAura && (
              <Circle cx={CENTER_X} cy={GROUND_Y - 70} r={80} fill="url(#aura)" />
            )}
            {visual.hasGlow && (
              <Circle cx={CENTER_X} cy={GROUND_Y - 60} r={55} fill={sp.accent} opacity={0.08} />
            )}

            {treeElements}

            {/* Ancien rendu fixe — uniquement en mode preview (boutique) */}
            {previewMode && decorations.length > 0 && (
              <DecorationOverlay decorationIds={decorations} stageIdx={stageIdx} previewMode species={species} />
            )}
            {previewMode && inhabitants.length > 0 && (
              <InhabitantOverlay inhabitantIds={inhabitants} stageIdx={stageIdx} species={species} />
            )}
          </AnimatedG>

          {/* Items placés par l'utilisateur — statiques (pas de sway), rendus seulement en taille réelle */}
          {showGround && size > 100 && Object.keys(placements).length > 0 && !placingItem && (
            <PlacedItems placements={placements} />
          )}

          {/* Mode placement — affiche les 10 slots avec animation pulsante */}
          {showGround && size > 100 && placingItem && (
            <PlacementSlots
              placements={placements}
              placingItemId={placingItem}
              onSelect={onSlotSelect}
            />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

// ── Formes organiques (contours irréguliers) ──

/**
 * Génère un path blob irrégulier autour d'un centre.
 * seed assure la reproductibilité (même blob pour même paramètres).
 * wobble contrôle l'amplitude de la déformation (0 = cercle parfait, 1 = très irrégulier).
 */
function blobPath(cx: number, cy: number, rx: number, ry: number, seed: number = 0, wobble: number = 0.15, points: number = 8): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Pseudo-random offset basé sur seed + index
    const noise = Math.sin(seed * 13.7 + i * 7.3) * wobble + Math.cos(seed * 5.1 + i * 11.9) * wobble * 0.5;
    const r = 1 + noise;
    pts.push([
      cx + Math.cos(angle) * rx * r,
      cy + Math.sin(angle) * ry * r,
    ]);
  }

  // Cubic bezier smooth entre les points
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const nextNext = pts[(i + 2) % pts.length];

    // Catmull-Rom → cubic bezier control points
    const cp1x = curr[0] + (next[0] - prev[0]) / 6;
    const cp1y = curr[1] + (next[1] - prev[1]) / 6;
    const cp2x = next[0] - (nextNext[0] - curr[0]) / 6;
    const cp2y = next[1] - (nextNext[1] - curr[1]) / 6;

    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${next[0].toFixed(1)} ${next[1].toFixed(1)}`;
  }
  d += ' Z';
  return d;
}

/** Couronne organique — remplace Circle/Ellipse par un blob */
function OrganicCrown({ cx, cy, rx, ry, fill, opacity = 1, seed = 0, wobble = 0.12 }: {
  cx: number; cy: number; rx: number; ry: number;
  fill: string; opacity?: number; seed?: number; wobble?: number;
}) {
  const d = useMemo(() => blobPath(cx, cy, rx, ry, seed, wobble, 10), [cx, cy, rx, ry, seed, wobble]);
  return <Path d={d} fill={fill} opacity={opacity} />;
}

/** Texture grain — couches semi-transparentes superposées pour donner du relief */
function CrownTexture({ cx, cy, rx, ry, color, seed = 0 }: {
  cx: number; cy: number; rx: number; ry: number;
  color: string; seed?: number;
}) {
  const spots = useMemo(() => {
    const result: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.sin(seed * 3.7 + i * 5.3) * Math.PI * 2;
      const dist = (0.3 + Math.abs(Math.sin(seed * 2.1 + i * 8.7)) * 0.5);
      result.push({
        x: cx + Math.cos(angle) * rx * dist,
        y: cy + Math.sin(angle) * ry * dist,
        r: rx * (0.08 + Math.abs(Math.cos(seed + i * 3)) * 0.1),
        o: 0.08 + Math.abs(Math.sin(seed + i * 5)) * 0.12,
      });
    }
    return result;
  }, [cx, cy, rx, ry, color, seed]);

  return (
    <G>
      {spots.map((s, i) => (
        <Circle key={`tex-${i}`} cx={s.x} cy={s.y} r={s.r} fill={color} opacity={s.o} />
      ))}
    </G>
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

      {/* Couronne de feuillage (organique) */}
      <OrganicCrown cx={CENTER_X} cy={trunkTop} rx={crownR} ry={crownR} fill="url(#crown)" seed={1} />
      <OrganicCrown cx={CENTER_X - 8} cy={trunkTop - 5} rx={crownR * 0.7} ry={crownR * 0.7} fill={species.leavesLight} opacity={0.3} seed={2} />
      <CrownTexture cx={CENTER_X} cy={trunkTop} rx={crownR} ry={crownR} color={species.leavesDark} seed={3} />

      {/* Petites touffes latérales (organiques) */}
      <OrganicCrown cx={CENTER_X - crownR * 0.6} cy={trunkTop + 8} rx={crownR * 0.5} ry={crownR * 0.4} fill={species.leaves} opacity={0.8} seed={4} />
      <OrganicCrown cx={CENTER_X + crownR * 0.6} cy={trunkTop + 5} rx={crownR * 0.45} ry={crownR * 0.4} fill={species.leavesDark} opacity={0.7} seed={5} />

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

      {/* Couronne principale (organique) */}
      <OrganicCrown cx={CENTER_X} cy={trunkTop - 5} rx={crownR} ry={crownR * 0.85} fill="url(#crown)" seed={10} />

      {/* Sous-couronnes pour volume (organiques) */}
      <OrganicCrown cx={CENTER_X - crownR * 0.4} cy={trunkTop + 5} rx={crownR * 0.6} ry={crownR * 0.5} fill={species.leaves} opacity={0.7} seed={11} />
      <OrganicCrown cx={CENTER_X + crownR * 0.45} cy={trunkTop} rx={crownR * 0.55} ry={crownR * 0.45} fill={species.leavesDark} opacity={0.6} seed={12} />
      <OrganicCrown cx={CENTER_X} cy={trunkTop - crownR * 0.5} rx={crownR * 0.5} ry={crownR * 0.4} fill={species.leavesLight} opacity={0.4} seed={13} />
      <CrownTexture cx={CENTER_X} cy={trunkTop - 5} rx={crownR} ry={crownR * 0.85} color={species.leavesDark} seed={14} />

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

      {/* Couronne volumineuse multicouche (organique) */}
      <OrganicCrown cx={CENTER_X} cy={trunkTop - 8} rx={crownR} ry={crownR * 0.8} fill="url(#crown)" seed={20} wobble={0.14} />
      <OrganicCrown cx={CENTER_X - 20} cy={trunkTop + 5} rx={crownR * 0.55} ry={crownR * 0.45} fill={species.leaves} opacity={0.75} seed={21} />
      <OrganicCrown cx={CENTER_X + 22} cy={trunkTop} rx={crownR * 0.5} ry={crownR * 0.42} fill={species.leavesDark} opacity={0.65} seed={22} />
      <OrganicCrown cx={CENTER_X - 5} cy={trunkTop - crownR * 0.55} rx={crownR * 0.45} ry={crownR * 0.38} fill={species.leavesLight} opacity={0.45} seed={23} />
      <OrganicCrown cx={CENTER_X + 15} cy={trunkTop - crownR * 0.3} rx={crownR * 0.4} ry={crownR * 0.35} fill={species.leavesLight} opacity={0.3} seed={24} />
      <CrownTexture cx={CENTER_X} cy={trunkTop - 8} rx={crownR} ry={crownR * 0.8} color={species.leavesDark} seed={25} />

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

      {/* Couronne dorée luxuriante (organique) */}
      <OrganicCrown cx={CENTER_X} cy={trunkTop - 10} rx={crownR} ry={crownR * 0.82} fill="url(#crown)" seed={30} wobble={0.13} />
      <OrganicCrown cx={CENTER_X - 22} cy={trunkTop + 5} rx={crownR * 0.5} ry={crownR * 0.42} fill={species.leaves} opacity={0.7} seed={31} />
      <OrganicCrown cx={CENTER_X + 24} cy={trunkTop} rx={crownR * 0.48} ry={crownR * 0.4} fill={species.leavesDark} opacity={0.6} seed={32} />
      <OrganicCrown cx={CENTER_X} cy={trunkTop - crownR * 0.55} rx={crownR * 0.5} ry={crownR * 0.42} fill={species.leavesLight} opacity={0.5} seed={33} />
      <CrownTexture cx={CENTER_X} cy={trunkTop - 10} rx={crownR} ry={crownR * 0.82} color={species.leavesDark} seed={34} />

      {/* Reflet doré sur la couronne */}
      <OrganicCrown cx={CENTER_X} cy={trunkTop - 12} rx={crownR * 0.9} ry={crownR * 0.7} fill="#FFD700" opacity={0.1} seed={35} />

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

// ── Habitat (jardin qui grandit) ──────────────

function HabitatLayer({ stageIdx, season, groundColors, accent }: {
  stageIdx: number;
  season: Season;
  groundColors: { top: string; bottom: string };
  accent: string;
}) {
  const isWinter = season === 'hiver';
  const isAutumn = season === 'automne';
  const grassColor = isWinter ? '#90A4AE' : isAutumn ? '#A1887F' : groundColors.top;
  const flowerColors = isWinter
    ? ['#B0BEC5', '#CFD8DC']
    : isAutumn
      ? ['#FF8A65', '#FFB74D', '#D4A373']
      : ['#F48FB1', '#CE93D8', '#FFF176', '#81D4FA'];
  const stoneColor = isWinter ? '#B0BEC5' : '#9E9E9E';

  return (
    <G>
      {/* ── Stade 0 (graine) : terre nue + cailloux ── */}
      {stageIdx >= 0 && (
        <G opacity={0.6}>
          <Circle cx={CENTER_X - 30} cy={GROUND_Y + 8} r={2.5} fill={stoneColor} />
          <Circle cx={CENTER_X + 35} cy={GROUND_Y + 10} r={2} fill={stoneColor} opacity={0.7} />
          <Circle cx={CENTER_X + 22} cy={GROUND_Y + 12} r={1.5} fill={stoneColor} opacity={0.5} />
        </G>
      )}

      {/* ── Stade 1 (pousse) : brins d'herbe + champignon ── */}
      {stageIdx >= 1 && (
        <G>
          {/* Brins d'herbe */}
          {[-45, -35, 40, 50].map((dx, i) => (
            <Path
              key={`grass-${i}`}
              d={`M${CENTER_X + dx} ${GROUND_Y + 3} q${i % 2 === 0 ? 2 : -2} ${-8} ${i % 2 === 0 ? 4 : -3} ${-12}`}
              stroke={grassColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              opacity={0.7}
            />
          ))}
          {/* Champignon */}
          <G opacity={0.8}>
            <Path
              d={`M${CENTER_X + 55} ${GROUND_Y + 5} L${CENTER_X + 55} ${GROUND_Y - 1}`}
              stroke="#D7CCC8"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Ellipse cx={CENTER_X + 55} cy={GROUND_Y - 2} rx={4} ry={3} fill={isWinter ? '#BDBDBD' : '#EF5350'} />
            {!isWinter && <Circle cx={CENTER_X + 54} cy={GROUND_Y - 3} r={1} fill="#FFFFFF" opacity={0.8} />}
            {!isWinter && <Circle cx={CENTER_X + 56.5} cy={GROUND_Y - 1.5} r={0.7} fill="#FFFFFF" opacity={0.6} />}
          </G>
        </G>
      )}

      {/* ── Stade 2 (arbuste) : herbe fournie, fleurs au sol, mousse ── */}
      {stageIdx >= 2 && (
        <G>
          {/* Touffes d'herbe */}
          {[-55, -25, 30, 55].map((dx, i) => (
            <Ellipse
              key={`tuft-${i}`}
              cx={CENTER_X + dx}
              cy={GROUND_Y + 4}
              rx={6}
              ry={3}
              fill={grassColor}
              opacity={0.5}
            />
          ))}
          {/* Petites fleurs au sol */}
          {[-40, -15, 25, 48].map((dx, i) => (
            <Circle
              key={`sflower-${i}`}
              cx={CENTER_X + dx}
              cy={GROUND_Y + 1 + (i % 2) * 3}
              r={2}
              fill={flowerColors[i % flowerColors.length]}
              opacity={0.75}
            />
          ))}
          {/* Mousse sur les côtés */}
          <Ellipse cx={CENTER_X - 60} cy={GROUND_Y + 6} rx={8} ry={3} fill={isWinter ? '#78909C' : '#81C784'} opacity={0.4} />
          <Ellipse cx={CENTER_X + 62} cy={GROUND_Y + 7} rx={7} ry={2.5} fill={isWinter ? '#78909C' : '#66BB6A'} opacity={0.35} />
        </G>
      )}

      {/* ── Stade 3 (arbre) : buissons, chemin de pierres, mare ── */}
      {stageIdx >= 3 && (
        <G>
          {/* Buissons latéraux */}
          <Ellipse cx={CENTER_X - 65} cy={GROUND_Y - 2} rx={12} ry={9} fill={isWinter ? '#78909C' : '#4CAF50'} opacity={0.6} />
          <Ellipse cx={CENTER_X - 63} cy={GROUND_Y - 4} rx={8} ry={6} fill={isWinter ? '#90A4AE' : '#66BB6A'} opacity={0.5} />
          <Ellipse cx={CENTER_X + 68} cy={GROUND_Y - 1} rx={10} ry={8} fill={isWinter ? '#78909C' : '#43A047'} opacity={0.55} />
          <Ellipse cx={CENTER_X + 66} cy={GROUND_Y - 3} rx={7} ry={5.5} fill={isWinter ? '#90A4AE' : '#81C784'} opacity={0.4} />
          {/* Chemin de pierres */}
          {[-20, -8, 5, 18].map((dx, i) => (
            <Ellipse
              key={`stone-${i}`}
              cx={CENTER_X + dx}
              cy={GROUND_Y + 10 + (i % 2) * 3}
              rx={4 + (i % 2)}
              ry={2.5}
              fill={stoneColor}
              opacity={0.45}
            />
          ))}
          {/* Mare d'eau */}
          <Ellipse cx={CENTER_X + 50} cy={GROUND_Y + 14} rx={12} ry={5} fill={isWinter ? '#B0BEC5' : '#4FC3F7'} opacity={0.4} />
          <Ellipse cx={CENTER_X + 48} cy={GROUND_Y + 13} rx={7} ry={3} fill={isWinter ? '#CFD8DC' : '#81D4FA'} opacity={0.3} />
        </G>
      )}

      {/* ── Stade 4 (majestueux) : clôture, banc, jardin fleuri ── */}
      {stageIdx >= 4 && (
        <G>
          {/* Clôture en bois */}
          {[-75, -65, -55, 55, 65, 75].map((dx, i) => (
            <G key={`fence-${i}`}>
              <Rect
                x={CENTER_X + dx - 1.5}
                y={GROUND_Y - 5}
                width={3}
                height={12}
                rx={1}
                fill="#8D6E63"
                opacity={0.6}
              />
            </G>
          ))}
          {/* Traverses clôture */}
          <Path d={`M${CENTER_X - 77} ${GROUND_Y - 1} L${CENTER_X - 53} ${GROUND_Y - 1}`} stroke="#8D6E63" strokeWidth={1.5} opacity={0.5} />
          <Path d={`M${CENTER_X + 53} ${GROUND_Y - 1} L${CENTER_X + 77} ${GROUND_Y - 1}`} stroke="#8D6E63" strokeWidth={1.5} opacity={0.5} />
          {/* Banc */}
          <G opacity={0.7}>
            <Rect x={CENTER_X - 80} y={GROUND_Y - 3} width={14} height={2} rx={1} fill="#A1887F" />
            <Rect x={CENTER_X - 79} y={GROUND_Y - 1} width={2} height={6} fill="#8D6E63" />
            <Rect x={CENTER_X - 68} y={GROUND_Y - 1} width={2} height={6} fill="#8D6E63" />
          </G>
          {/* Jardin fleuri au sol (plus de fleurs, plus grosses) */}
          {[-48, -38, -28, 32, 42, 52].map((dx, i) => (
            <G key={`gflower-${i}`}>
              <Circle
                cx={CENTER_X + dx}
                cy={GROUND_Y - 1 + (i % 3)}
                r={3}
                fill={flowerColors[i % flowerColors.length]}
                opacity={0.8}
              />
              <Circle
                cx={CENTER_X + dx}
                cy={GROUND_Y - 1 + (i % 3)}
                r={1.2}
                fill="#FFF176"
                opacity={0.6}
              />
            </G>
          ))}
        </G>
      )}

      {/* ── Stade 5 (légendaire) : arche, lanternes, ruisseau, pierres lumineuses ── */}
      {stageIdx >= 5 && (
        <G>
          {/* Arche fleurie */}
          <Path
            d={`M${CENTER_X - 30} ${GROUND_Y + 2} Q${CENTER_X - 30} ${GROUND_Y - 25} ${CENTER_X} ${GROUND_Y - 28} Q${CENTER_X + 30} ${GROUND_Y - 25} ${CENTER_X + 30} ${GROUND_Y + 2}`}
            stroke="#8D6E63"
            strokeWidth={2.5}
            fill="none"
            opacity={0.5}
          />
          {/* Fleurs sur l'arche */}
          {[-22, -10, 0, 10, 22].map((dx, i) => (
            <Circle
              key={`aflower-${i}`}
              cx={CENTER_X + dx}
              cy={GROUND_Y - 24 - Math.abs(dx) * 0.1}
              r={2.5}
              fill={flowerColors[i % flowerColors.length]}
              opacity={0.85}
            />
          ))}
          {/* Lanternes */}
          {[-70, 72].map((dx, i) => (
            <G key={`lantern-${i}`} opacity={0.8}>
              <Path
                d={`M${CENTER_X + dx} ${GROUND_Y - 8} L${CENTER_X + dx} ${GROUND_Y + 2}`}
                stroke="#5D4037"
                strokeWidth={1.5}
              />
              <Rect x={CENTER_X + dx - 3} y={GROUND_Y - 13} width={6} height={6} rx={1} fill="#FFE082" opacity={0.9} />
              <Circle cx={CENTER_X + dx} cy={GROUND_Y - 10} r={2} fill="#FFD54F" opacity={0.6} />
            </G>
          ))}
          {/* Ruisseau */}
          <Path
            d={`M${CENTER_X + 80} ${GROUND_Y + 8} Q${CENTER_X + 55} ${GROUND_Y + 15} ${CENTER_X + 30} ${GROUND_Y + 12} Q${CENTER_X + 10} ${GROUND_Y + 10} ${CENTER_X - 10} ${GROUND_Y + 15}`}
            stroke={isWinter ? '#B0BEC5' : '#42A5F5'}
            strokeWidth={3}
            fill="none"
            opacity={0.4}
            strokeLinecap="round"
          />
          <Path
            d={`M${CENTER_X + 75} ${GROUND_Y + 9} Q${CENTER_X + 52} ${GROUND_Y + 15} ${CENTER_X + 30} ${GROUND_Y + 13}`}
            stroke={isWinter ? '#CFD8DC' : '#90CAF9'}
            strokeWidth={1.5}
            fill="none"
            opacity={0.3}
            strokeLinecap="round"
          />
          {/* Pierres lumineuses */}
          {[-55, -20, 15, 45].map((dx, i) => (
            <G key={`glow-stone-${i}`}>
              <Circle cx={CENTER_X + dx} cy={GROUND_Y + 8 + (i % 2) * 4} r={3} fill={stoneColor} opacity={0.5} />
              <Circle cx={CENTER_X + dx} cy={GROUND_Y + 8 + (i % 2) * 4} r={5} fill="#FFD700" opacity={0.12} />
            </G>
          ))}
        </G>
      )}
    </G>
  );
}

// ── Particules saisonnières (Reanimated) ──────

function SeasonalParticles({ particle, size }: { particle: typeof SEASONAL_PARTICLES[Season]; size: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.particleContainer]} pointerEvents="none">
      {Array.from({ length: particle.count }).map((_, i) => (
        <SeasonParticle key={`sp-${i}`} particle={particle} index={i} containerSize={size} />
      ))}
    </View>
  );
}

function SeasonParticle({ particle, index, containerSize }: { particle: typeof SEASONAL_PARTICLES[Season]; index: number; containerSize: number }) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  const startX = useMemo(() => (index * 43 + 17) % containerSize, [index, containerSize]);
  const startY = useMemo(() => {
    if (particle.direction === 'down') return -10; // commencent en haut
    return ((index * 61 + 11) % (containerSize * 0.6)) + containerSize * 0.15;
  }, [index, containerSize, particle.direction]);

  const speedMult = particle.speed === 'slow' ? 1.4 : particle.speed === 'fast' ? 0.7 : 1;
  const duration = useMemo(() => (4000 + (index % 5) * 800) * speedMult, [index, speedMult]);

  useEffect(() => {
    if (reducedMotion) return;
    const delay = index * 600;

    if (particle.direction === 'down') {
      // Chute (neige, feuilles, pétales)
      translateY.value = withDelay(delay, withRepeat(
        withTiming(containerSize * 1.1, { duration, easing: Easing.linear }),
        -1, false,
      ));
      translateX.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(15 + (index % 4) * 5, { duration: duration * 0.4, easing: Easing.inOut(Easing.sin) }),
          withTiming(-15 - (index % 3) * 5, { duration: duration * 0.4, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration * 0.2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, false,
      ));
    } else {
      // Flottement (lucioles été)
      translateY.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(-15 - index * 3, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(10, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      ));
      translateX.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(12 + (index % 3) * 4, { duration: duration * 0.6, easing: Easing.inOut(Easing.sin) }),
          withTiming(-12 - (index % 3) * 4, { duration: duration * 0.6, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      ));
    }

    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.7, { duration: duration * 0.3 }),
        withTiming(0.3, { duration: duration * 0.7 }),
      ),
      -1, true,
    ));

    rotation.value = withDelay(delay, withRepeat(
      withTiming(360, { duration: duration * 2, easing: Easing.linear }),
      -1, false,
    ));
  }, [reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotation.value}deg` },
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
          width: 14,
          height: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animStyle,
      ]}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: particle.color,
        }}
      />
    </Animated.View>
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

// ── Placement système — items placés par l'utilisateur sur des slots ─────

/** Résout un itemId en son emoji (cherche dans décorations ET habitants) */
function getItemEmoji(itemId: string): string | null {
  const deco = DECORATIONS.find(d => d.id === itemId);
  if (deco) return deco.emoji;
  const hab = INHABITANTS.find(h => h.id === itemId);
  if (hab) return hab.emoji;
  return null;
}

/** Taille des illustrations placées sur la scène */
const PLACED_ITEM_SIZE = 28;

/** Rendu des items placés sur la scène (mode normal, pas de placement en cours) */
function PlacedItems({ placements }: { placements: Record<string, string> }) {
  return (
    <G>
      {Object.entries(placements).map(([slotId, itemId]) => {
        // Les animaux pixel sont rendus par l'overlay natif animé
        if (ANIMAL_IDLE_FRAMES[itemId]) return null;
        const slot = SCENE_SLOTS.find(s => s.id === slotId);
        const emoji = getItemEmoji(itemId);
        if (!slot || !emoji) return null;
        const illustration = ITEM_ILLUSTRATIONS[itemId];
        if (illustration) {
          return (
            <SvgImage
              key={slotId}
              href={illustration}
              x={slot.cx - PLACED_ITEM_SIZE / 2}
              y={slot.cy - PLACED_ITEM_SIZE / 2}
              width={PLACED_ITEM_SIZE}
              height={PLACED_ITEM_SIZE}
            />
          );
        }
        return (
          <SvgText
            key={slotId}
            x={slot.cx}
            y={slot.cy + 5}
            fontSize={18}
            textAnchor="middle"
          >
            {emoji}
          </SvgText>
        );
      })}
    </G>
  );
}

/** Rendu des slots en mode placement — cercles pulsants, emoji si occupé */
function PlacementSlots({
  placements,
  placingItemId,
  onSelect,
}: {
  placements: Record<string, string>;
  placingItemId: string;
  onSelect?: (slotId: string) => void;
}) {
  return (
    <G>
      {SCENE_SLOTS.map(slot => {
        const occupiedItemId = placements[slot.id];
        const emoji = occupiedItemId ? getItemEmoji(occupiedItemId) : null;
        const isEmpty = !emoji;
        return (
          <G key={slot.id} onPress={() => onSelect?.(slot.id)}>
            {/* Cercle de fond — zone tactile + indicateur visuel */}
            <Circle
              cx={slot.cx}
              cy={slot.cy}
              r={14}
              fill={isEmpty ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)'}
              stroke={isEmpty ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.8)'}
              strokeWidth={1.5}
              strokeDasharray={isEmpty ? '4,3' : undefined}
            />
            {/* Item si le slot est occupé — illustration ou emoji */}
            {emoji ? (
              ITEM_ILLUSTRATIONS[occupiedItemId!] ? (
                <SvgImage
                  href={ITEM_ILLUSTRATIONS[occupiedItemId!]}
                  x={slot.cx - 10}
                  y={slot.cy - 10}
                  width={20}
                  height={20}
                />
              ) : (
                <SvgText
                  x={slot.cx}
                  y={slot.cy + 5}
                  fontSize={16}
                  textAnchor="middle"
                >
                  {emoji}
                </SvgText>
              )
            ) : (
              /* Indicateur "+" pour les slots vides */
              <SvgText
                x={slot.cx}
                y={slot.cy + 4}
                fontSize={14}
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontWeight="bold"
              >
                +
              </SvgText>
            )}
          </G>
        );
      })}
    </G>
  );
}

// ── Positions dynamiques des décorations sur l'arbre ─────

/** Géométrie de base par stade (trunkTop, crownY, crownR) */
function getTreeGeometry(stageIdx: number): { trunkTop: number; crownY: number; crownR: number } {
  switch (stageIdx) {
    case 0: return { trunkTop: 195, crownY: 190, crownR: 8 };   // graine
    case 1: return { trunkTop: 170, crownY: 165, crownR: 15 };  // pousse
    case 2: return { trunkTop: 150, crownY: 145, crownR: 32 };  // arbuste
    case 3: return { trunkTop: 120, crownY: 115, crownR: 42 };  // arbre
    case 4: return { trunkTop: 105, crownY: 97,  crownR: 52 };  // majestueux
    case 5: return { trunkTop: 100, crownY: 90,  crownR: 55 };  // légendaire
    default: return { trunkTop: 120, crownY: 115, crownR: 42 };
  }
}

/**
 * Slots sémantiques pour les décorations.
 * Chaque slot est décrit en relatif : offsets par rapport à (CENTER_X, crownY, crownR, GROUND_Y).
 * baseSize = taille de base (sera multipliée par le stade et la rareté).
 */
type SlotDef = {
  dxFactor: number;
  dyFactor: number;
  groundRelY?: number;
  baseSize: number;        // taille de référence en px
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire' | 'prestige';
};

/** Multiplicateur de taille par rareté — les items rares/épiques/légendaires sont plus gros */
const RARITY_SIZE_MULT: Record<string, number> = {
  commun: 1,
  rare: 1.2,
  'épique': 1.5,
  'légendaire': 2,
  prestige: 2.3,
};

/** Multiplicateur de taille par stade — un arbre plus grand = items plus visibles */
const STAGE_SIZE_MULT: number[] = [
  0.5,   // graine
  0.65,  // pousse
  0.8,   // arbuste
  1,     // arbre
  1.15,  // majestueux
  1.3,   // légendaire
];

const DECO_SLOTS: Record<string, SlotDef> = {
  balancoire:  { dxFactor: 0.85,  dyFactor: 0.5,    baseSize: 18, rarity: 'commun' },     // branche droite basse
  cabane:      { dxFactor: 0.1,   dyFactor: -0.55,  baseSize: 20, rarity: 'rare' },        // dans la couronne haute
  guirlandes:  { dxFactor: 0,     dyFactor: 0.1,    baseSize: 16, rarity: 'commun' },      // milieu couronne
  lanterne:    { dxFactor: -0.75, dyFactor: 0.2,    baseSize: 17, rarity: 'rare' },         // branche gauche
  nid:         { dxFactor: 0.6,   dyFactor: -0.3,   baseSize: 17, rarity: 'rare' },         // branche droite
  hamac:       { dxFactor: -0.5,  dyFactor: 0,       groundRelY: -30, baseSize: 18, rarity: 'épique' },
  fontaine:    { dxFactor: 0.8,   dyFactor: 0,       groundRelY: -8,  baseSize: 20, rarity: 'épique' },
  couronne:    { dxFactor: 0,     dyFactor: -0.85,  baseSize: 22, rarity: 'légendaire' },   // sommet de la couronne
  portail:     { dxFactor: -0.9,  dyFactor: 0,       groundRelY: -15, baseSize: 24, rarity: 'prestige' },  // portail magique à gauche
  cristal:     { dxFactor: 0,     dyFactor: -0.95,  baseSize: 26, rarity: 'prestige' },   // cristal au sommet absolu
  // Nouvelles décos pixel (au sol)
  botte_foin:  { dxFactor: -0.8,  dyFactor: 0,    groundRelY: -6,  baseSize: 22, rarity: 'commun' },
  etal_fruits: { dxFactor: 0.85,  dyFactor: 0,    groundRelY: -10, baseSize: 24, rarity: 'épique' },
};

const HAB_SLOTS: Record<string, SlotDef> = {
  // Anciens habitants (positionnés dans/sur l'arbre)
  oiseau:      { dxFactor: 0.7,   dyFactor: -0.35,  baseSize: 16, rarity: 'commun' },
  ecureuil:    { dxFactor: 0.15,  dyFactor: 0.6,    baseSize: 17, rarity: 'commun' },
  papillons:   { dxFactor: -0.75, dyFactor: -0.45,  baseSize: 15, rarity: 'commun' },
  coccinelle:  { dxFactor: 0.45,  dyFactor: 0.2,    baseSize: 13, rarity: 'commun' },
  chat:        { dxFactor: -0.6,  dyFactor: 0,       groundRelY: -8,  baseSize: 20, rarity: 'rare' },
  hibou:       { dxFactor: -0.5,  dyFactor: -0.3,   baseSize: 18, rarity: 'rare' },
  fee:         { dxFactor: 0.8,   dyFactor: -0.5,   baseSize: 20, rarity: 'épique' },
  dragon:      { dxFactor: 0,     dyFactor: -0.6,   baseSize: 26, rarity: 'légendaire' },
  phoenix:     { dxFactor: 0.85,  dyFactor: -0.7,   baseSize: 28, rarity: 'prestige' },
  licorne:     { dxFactor: -0.85, dyFactor: 0,       groundRelY: -12, baseSize: 28, rarity: 'prestige' },
  // Nouveaux animaux pixel (au sol, top-down)
  poussin:     { dxFactor: 0.6,   dyFactor: 0,    groundRelY: -5,  baseSize: 16, rarity: 'commun' },
  poulet:      { dxFactor: -0.7,  dyFactor: 0,    groundRelY: -14, baseSize: 28, rarity: 'commun' },
  canard:      { dxFactor: 0.8,   dyFactor: 0,    groundRelY: -12, baseSize: 20, rarity: 'commun' },
  cochon:      { dxFactor: -0.85, dyFactor: 0,    groundRelY: -15, baseSize: 22, rarity: 'rare' },
  vache:       { dxFactor: 0.9,   dyFactor: 0,    groundRelY: -18, baseSize: 26, rarity: 'rare' },
};

/** Ajustements par espèce (offsets additionnels en px) */
const SPECIES_ADJUSTMENTS: Record<TreeSpecies, { dx: number; dy: number; scale: number }> = {
  cerisier: { dx: 0, dy: 0, scale: 1 },
  chene:    { dx: 0, dy: 0, scale: 1.05 },
  bambou:   { dx: 0, dy: 10, scale: 0.7 },   // bambou est plus étroit, décaler vers le bas
  oranger:  { dx: 0, dy: 0, scale: 1 },
  palmier:  { dx: 2, dy: -5, scale: 0.8 },    // palmier décalé légèrement droite, plus serré
};

function getItemPosition(
  species: TreeSpecies,
  stageIdx: number,
  slot: SlotDef,
): { x: number; y: number; fontSize: number } {
  const geo = getTreeGeometry(stageIdx);
  const adj = SPECIES_ADJUSTMENTS[species];

  // Position Y : soit relative au sol, soit relative à la couronne
  let y: number;
  if (slot.groundRelY !== undefined) {
    y = GROUND_Y + slot.groundRelY;
  } else {
    y = geo.crownY + slot.dyFactor * geo.crownR;
  }

  // Position X : relative au centre + rayon couronne
  const x = CENTER_X + adj.dx + slot.dxFactor * geo.crownR * adj.scale;

  // Taille proportionnelle : baseSize × rareté × stade
  const rarityMult = RARITY_SIZE_MULT[slot.rarity] ?? 1;
  const stageMult = STAGE_SIZE_MULT[Math.min(stageIdx, STAGE_SIZE_MULT.length - 1)];
  const fontSize = Math.round(slot.baseSize * rarityMult * stageMult);

  return {
    x: Math.max(10, Math.min(190, x)),   // clamp dans le viewbox
    y: Math.max(20, Math.min(210, y + adj.dy)),
    fontSize,
  };
}

function DecorationOverlay({ decorationIds, stageIdx, previewMode = false, species }: { decorationIds: string[]; stageIdx: number; previewMode?: boolean; species: TreeSpecies }) {
  return (
    <G>
      {decorationIds.map((id) => {
        const deco = DECORATIONS.find((d) => d.id === id);
        if (!deco) return null;
        const slot = DECO_SLOTS[id];
        if (!slot) return null;
        const pos = getItemPosition(species, stageIdx, slot);
        const illustration = ITEM_ILLUSTRATIONS[id];
        if (illustration) {
          const s = pos.fontSize * 1.2;
          return <SvgImage key={id} href={illustration} x={pos.x - s / 2} y={pos.y - s / 2} width={s} height={s} />;
        }
        return (
          <SvgText key={id} x={pos.x} y={pos.y} fontSize={pos.fontSize} textAnchor="middle" alignmentBaseline="central">
            {deco.emoji}
          </SvgText>
        );
      })}
    </G>
  );
}

// ── Animaux pixel animés (cycle idle) ──────────

/** Frames idle par animal pixel (2 frames pour le cycle) */
const ANIMAL_IDLE_FRAMES: Record<string, [any, any]> = {
  poussin: [require('../../assets/garden/animals/poussin/idle_1.png'), require('../../assets/garden/animals/poussin/idle_2.png')],
  poulet:  [require('../../assets/garden/animals/poulet/idle_1.png'),  require('../../assets/garden/animals/poulet/idle_2.png')],
  canard:  [require('../../assets/garden/animals/canard/idle_1.png'),  require('../../assets/garden/animals/canard/idle_2.png')],
  cochon:  [require('../../assets/garden/animals/cochon/idle_1.png'),  require('../../assets/garden/animals/cochon/idle_2.png')],
  vache:   [require('../../assets/garden/animals/vache/idle_1.png'),   require('../../assets/garden/animals/vache/idle_2.png')],
};

/** Walk frames par animal (direction bas) */
const ANIMAL_WALK_FRAMES: Record<string, any[]> = {
  poussin: [
    require('../../assets/garden/animals/poussin/walk_down_1.png'),
    require('../../assets/garden/animals/poussin/walk_down_2.png'),
    require('../../assets/garden/animals/poussin/walk_down_3.png'),
    require('../../assets/garden/animals/poussin/walk_down_4.png'),
    require('../../assets/garden/animals/poussin/walk_down_5.png'),
    require('../../assets/garden/animals/poussin/walk_down_6.png'),
    require('../../assets/garden/animals/poussin/walk_down_7.png'),
    require('../../assets/garden/animals/poussin/walk_down_8.png'),
  ],
  poulet: [
    require('../../assets/garden/animals/poulet/walk_down_1.png'),
    require('../../assets/garden/animals/poulet/walk_down_2.png'),
    require('../../assets/garden/animals/poulet/walk_down_3.png'),
    require('../../assets/garden/animals/poulet/walk_down_4.png'),
    require('../../assets/garden/animals/poulet/walk_down_5.png'),
    require('../../assets/garden/animals/poulet/walk_down_6.png'),
    require('../../assets/garden/animals/poulet/walk_down_7.png'),
    require('../../assets/garden/animals/poulet/walk_down_8.png'),
  ],
  canard: [
    require('../../assets/garden/animals/canard/walk_down_1.png'),
    require('../../assets/garden/animals/canard/walk_down_2.png'),
    require('../../assets/garden/animals/canard/walk_down_3.png'),
    require('../../assets/garden/animals/canard/walk_down_4.png'),
    require('../../assets/garden/animals/canard/walk_down_5.png'),
    require('../../assets/garden/animals/canard/walk_down_6.png'),
  ],
  cochon: [
    require('../../assets/garden/animals/cochon/walk_down_1.png'),
    require('../../assets/garden/animals/cochon/walk_down_2.png'),
    require('../../assets/garden/animals/cochon/walk_down_3.png'),
    require('../../assets/garden/animals/cochon/walk_down_4.png'),
    require('../../assets/garden/animals/cochon/walk_down_5.png'),
    require('../../assets/garden/animals/cochon/walk_down_6.png'),
    require('../../assets/garden/animals/cochon/walk_down_7.png'),
    require('../../assets/garden/animals/cochon/walk_down_8.png'),
  ],
  vache: [
    require('../../assets/garden/animals/vache/walk_down_1.png'),
    require('../../assets/garden/animals/vache/walk_down_2.png'),
    require('../../assets/garden/animals/vache/walk_down_3.png'),
    require('../../assets/garden/animals/vache/walk_down_4.png'),
    require('../../assets/garden/animals/vache/walk_down_5.png'),
    require('../../assets/garden/animals/vache/walk_down_6.png'),
    require('../../assets/garden/animals/vache/walk_down_7.png'),
    require('../../assets/garden/animals/vache/walk_down_8.png'),
  ],
};

/** Walk frames par animal (direction gauche — scaleX: -1 pour droite) */
const ANIMAL_WALK_LEFT_FRAMES: Record<string, any[]> = {
  poussin: [
    require('../../assets/garden/animals/poussin/walk_left_1.png'),
    require('../../assets/garden/animals/poussin/walk_left_2.png'),
    require('../../assets/garden/animals/poussin/walk_left_3.png'),
    require('../../assets/garden/animals/poussin/walk_left_4.png'),
    require('../../assets/garden/animals/poussin/walk_left_5.png'),
    require('../../assets/garden/animals/poussin/walk_left_6.png'),
    require('../../assets/garden/animals/poussin/walk_left_7.png'),
    require('../../assets/garden/animals/poussin/walk_left_8.png'),
  ],
  poulet: [
    require('../../assets/garden/animals/poulet/walk_left_1.png'),
    require('../../assets/garden/animals/poulet/walk_left_2.png'),
    require('../../assets/garden/animals/poulet/walk_left_3.png'),
    require('../../assets/garden/animals/poulet/walk_left_4.png'),
    require('../../assets/garden/animals/poulet/walk_left_5.png'),
    require('../../assets/garden/animals/poulet/walk_left_6.png'),
    require('../../assets/garden/animals/poulet/walk_left_7.png'),
    require('../../assets/garden/animals/poulet/walk_left_8.png'),
  ],
  canard: [
    require('../../assets/garden/animals/canard/walk_left_1.png'),
    require('../../assets/garden/animals/canard/walk_left_2.png'),
    require('../../assets/garden/animals/canard/walk_left_3.png'),
    require('../../assets/garden/animals/canard/walk_left_4.png'),
    require('../../assets/garden/animals/canard/walk_left_5.png'),
    require('../../assets/garden/animals/canard/walk_left_6.png'),
  ],
  cochon: [
    require('../../assets/garden/animals/cochon/walk_left_1.png'),
    require('../../assets/garden/animals/cochon/walk_left_2.png'),
    require('../../assets/garden/animals/cochon/walk_left_3.png'),
    require('../../assets/garden/animals/cochon/walk_left_4.png'),
    require('../../assets/garden/animals/cochon/walk_left_5.png'),
    require('../../assets/garden/animals/cochon/walk_left_6.png'),
    require('../../assets/garden/animals/cochon/walk_left_7.png'),
    require('../../assets/garden/animals/cochon/walk_left_8.png'),
  ],
  vache: [
    require('../../assets/garden/animals/vache/walk_left_1.png'),
    require('../../assets/garden/animals/vache/walk_left_2.png'),
    require('../../assets/garden/animals/vache/walk_left_3.png'),
    require('../../assets/garden/animals/vache/walk_left_4.png'),
    require('../../assets/garden/animals/vache/walk_left_5.png'),
    require('../../assets/garden/animals/vache/walk_left_6.png'),
    require('../../assets/garden/animals/vache/walk_left_7.png'),
    require('../../assets/garden/animals/vache/walk_left_8.png'),
  ],
};

/** Bulles de pensee des animaux */
const THOUGHT_BUBBLES_IDLE = ['ZzZ', '?', '...', '♪', '!', '✨'];
const THOUGHT_BUBBLES_NIGHT = ['💤', '🌙', 'ZzZ'];

/** Animal anime : idle + balade + bulles de pensee */
function AnimatedAnimal({ frames, x, y, size, animalId, containerWidth }: { frames: [any, any]; x: number; y: number; size: number; animalId: string; containerWidth: number }) {
  const [frameIdx, setFrameIdx] = React.useState(0);
  const [isWalking, setIsWalking] = React.useState(false);
  const [bubble, setBubble] = React.useState<string | null>(null);
  const [lastDx, setLastDx] = React.useState(0);
  const [lastDy, setLastDy] = React.useState(0);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const mounted = React.useRef(true);

  // Cycle idle / walk / thought bubbles
  useEffect(() => {
    mounted.current = true;
    const walkFrames = ANIMAL_WALK_FRAMES[animalId];
    let walkInterval: ReturnType<typeof setInterval>;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Idle frame cycle
    const idleInterval = setInterval(() => {
      if (mounted.current) setFrameIdx(f => (f + 1) % 2);
    }, 600);

    // Petite balade toutes les 3-6 secondes
    const startWalk = () => {
      if (!walkFrames || !mounted.current) return;
      const dx = (Math.random() - 0.5) * 20;
      const dy = (Math.random() - 0.5) * 12;
      setLastDx(dx);
      setLastDy(dy);
      setIsWalking(true);
      offsetX.value = withTiming(offsetX.value + dx, { duration: 1500, easing: Easing.inOut(Easing.sin) });
      offsetY.value = withTiming(offsetY.value + dy, { duration: 1500, easing: Easing.inOut(Easing.sin) });
      timeouts.push(setTimeout(() => { if (mounted.current) setIsWalking(false); }, 1500));
    };

    walkInterval = setInterval(startWalk, 3000 + Math.random() * 3000);

    // Thought bubbles toutes les 15-30s
    const bubbleInterval = setInterval(() => {
      if (!mounted.current) return;
      const hour = new Date().getHours();
      const isNight = hour >= 21 || hour < 6;
      const pool = isNight ? THOUGHT_BUBBLES_NIGHT : THOUGHT_BUBBLES_IDLE;
      const content = pool[Math.floor(Math.random() * pool.length)];
      setBubble(content);
      timeouts.push(setTimeout(() => {
        if (mounted.current) setBubble(null);
      }, 3500));
    }, 15000 + Math.random() * 15000);

    return () => {
      mounted.current = false;
      clearInterval(idleInterval);
      clearInterval(walkInterval);
      clearInterval(bubbleInterval);
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [animalId]);

  const walkDownFrames = ANIMAL_WALK_FRAMES[animalId];
  const walkLeftFrames = ANIMAL_WALK_LEFT_FRAMES[animalId];
  const [walkFrameIdx, setWalkFrameIdx] = React.useState(0);
  const isHorizontal = Math.abs(lastDx) > Math.abs(lastDy);
  const activeWalkFrames = isWalking && isHorizontal && walkLeftFrames ? walkLeftFrames : walkDownFrames;
  useEffect(() => {
    if (!isWalking || !activeWalkFrames) return;
    const interval = setInterval(() => setWalkFrameIdx(f => (f + 1) % activeWalkFrames.length), 200);
    return () => clearInterval(interval);
  }, [isWalking, activeWalkFrames]);

  const moveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
    ],
  }));

  const currentFrame = isWalking && activeWalkFrames
    ? activeWalkFrames[walkFrameIdx % activeWalkFrames.length]
    : frames[frameIdx];
  const flipX = isWalking && isHorizontal && lastDx > 0;

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y, width: size, height: size }, moveStyle]}>
      <Image
        source={currentFrame}
        style={[
          { width: size, height: size },
          flipX ? { transform: [{ scaleX: -1 }] } : {},
        ] as any}
      />
      {/* Bulle de pensee */}
      {bubble != null && (
        <View style={{
          position: 'absolute',
          top: -18,
          left: Math.max(-x, Math.min(size / 2 - 14, containerWidth - x - 28)),
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 10,
          paddingHorizontal: 5,
          paddingVertical: 2,
          minWidth: 28,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, textAlign: 'center' }}>{bubble}</Text>
        </View>
      )}
    </Animated.View>
  );
}

function InhabitantOverlay({ inhabitantIds, stageIdx, previewMode = false, species }: { inhabitantIds: string[]; stageIdx: number; previewMode?: boolean; species: TreeSpecies }) {
  return (
    <G>
      {inhabitantIds.map((id) => {
        // Les animaux pixel sont rendus par l'overlay natif animé (AnimatedAnimal), pas ici
        if (ANIMAL_IDLE_FRAMES[id]) return null;
        const hab = INHABITANTS.find((h) => h.id === id);
        if (!hab) return null;
        const slot = HAB_SLOTS[id];
        if (!slot) return null;
        const pos = getItemPosition(species, stageIdx, slot);
        const illustration = ITEM_ILLUSTRATIONS[id];
        if (illustration) {
          const s = pos.fontSize * 1.2;
          return <SvgImage key={id} href={illustration} x={pos.x - s / 2} y={pos.y - s / 2} width={s} height={s} />;
        }
        return (
          <SvgText key={id} x={pos.x} y={pos.y} fontSize={pos.fontSize} textAnchor="middle" alignmentBaseline="central">
            {hab.emoji}
          </SvgText>
        );
      })}
    </G>
  );
}

export const TreeView = React.memo(TreeViewInner);
