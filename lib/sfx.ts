/**
 * sfx.ts — Bibliothèque de bruitages bundlés (Mode Spectacle V2).
 *
 * Chaque tag de `StorySfxTag` correspond à un MP3 court bundlé dans
 * `assets/stories/sfx/<tag>.mp3`. Les MP3 sont générés one-shot via
 * `scripts/generate-sfx-library.mjs`, puis activés ici via `require()`.
 *
 * Tant qu'un tag n'a pas son require() activé, il est simplement ignoré
 * par le player (fallback silencieux). Ceci permet de shipper la pipeline
 * sans bloquer sur la génération des 58 fichiers.
 *
 * Architecture :
 * - Le player préload chaque tag UTILISÉ par le script de l'histoire
 *   (pool d'Audio.Sound, max ~10 SFX distincts par histoire)
 * - Lecture déclenchée à l'instant T calculé par découpage paragraphe
 *   (V2.2) ou par alignement word-level (V2.3 — `/with-timestamps`)
 */
import type { ImageSourcePropType } from 'react-native';
import type { StorySfxTag } from './types';

/**
 * Mapping tag → asset MP3 bundlé.
 * Décommenter une ligne au fur et à mesure que le MP3 est généré et commité.
 * Un tag absent = silence, le player saute le beat sans erreur.
 */
export const STORY_SFX_ASSETS: Partial<Record<StorySfxTag, ImageSourcePropType>> = {
  // Portes / portails
  door_creak_slow:      require('../assets/stories/sfx/door_creak_slow.mp3'),
  door_slam:            require('../assets/stories/sfx/door_slam.mp3'),
  door_open_squeak:     require('../assets/stories/sfx/door_open_squeak.mp3'),

  // Pas
  footsteps_wood:       require('../assets/stories/sfx/footsteps_wood.mp3'),
  footsteps_grass:      require('../assets/stories/sfx/footsteps_grass.mp3'),
  footsteps_snow:       require('../assets/stories/sfx/footsteps_snow.mp3'),
  footsteps_stone:      require('../assets/stories/sfx/footsteps_stone.mp3'),

  // Grands animaux
  roar_dragon:          require('../assets/stories/sfx/roar_dragon.mp3'),
  roar_lion:            require('../assets/stories/sfx/roar_lion.mp3'),
  roar_bear:            require('../assets/stories/sfx/roar_bear.mp3'),
  growl_wolf:           require('../assets/stories/sfx/growl_wolf.mp3'),

  // Petits animaux
  meow_cat:             require('../assets/stories/sfx/meow_cat.mp3'),
  bark_dog:             require('../assets/stories/sfx/bark_dog.mp3'),
  hoot_owl:             require('../assets/stories/sfx/hoot_owl.mp3'),
  chirp_bird:           require('../assets/stories/sfx/chirp_bird.mp3'),
  squeak_mouse:         require('../assets/stories/sfx/squeak_mouse.mp3'),
  whimper_puppy:        require('../assets/stories/sfx/whimper_puppy.mp3'),

  // Vent / météo
  wind_soft:            require('../assets/stories/sfx/wind_soft.mp3'),
  wind_storm:           require('../assets/stories/sfx/wind_storm.mp3'),
  rain_light:           require('../assets/stories/sfx/rain_light.mp3'),
  thunder_distant:      require('../assets/stories/sfx/thunder_distant.mp3'),

  // Eau / feu
  fire_crackle:         require('../assets/stories/sfx/fire_crackle.mp3'),
  water_splash:         require('../assets/stories/sfx/water_splash.mp3'),
  water_drip:           require('../assets/stories/sfx/water_drip.mp3'),
  water_stream:         require('../assets/stories/sfx/water_stream.mp3'),

  // Magie
  sparkle_short:        require('../assets/stories/sfx/sparkle_short.mp3'),
  magic_whoosh:         require('../assets/stories/sfx/magic_whoosh.mp3'),
  transform_shimmer:    require('../assets/stories/sfx/transform_shimmer.mp3'),
  spell_zap:            require('../assets/stories/sfx/spell_zap.mp3'),
  magic_chime:          require('../assets/stories/sfx/magic_chime.mp3'),

  // Mécanique
  clock_tick:           require('../assets/stories/sfx/clock_tick.mp3'),
  gear_creak:           require('../assets/stories/sfx/gear_creak.mp3'),
  robot_beep:           require('../assets/stories/sfx/robot_beep.mp3'),
  machine_hum:          require('../assets/stories/sfx/machine_hum.mp3'),

  // Cloches / musique
  bell_small:           require('../assets/stories/sfx/bell_small.mp3'),
  bell_large:           require('../assets/stories/sfx/bell_large.mp3'),
  harp_glissando:       require('../assets/stories/sfx/harp_glissando.mp3'),
  music_box:            require('../assets/stories/sfx/music_box.mp3'),

  // Véhicules
  ship_creak:           require('../assets/stories/sfx/ship_creak.mp3'),
  horse_gallop:         require('../assets/stories/sfx/horse_gallop.mp3'),
  train_whistle:        require('../assets/stories/sfx/train_whistle.mp3'),

  // Réactions humaines
  laugh_child:          require('../assets/stories/sfx/laugh_child.mp3'),
  gasp_surprise:        require('../assets/stories/sfx/gasp_surprise.mp3'),
  sneeze_cute:          require('../assets/stories/sfx/sneeze_cute.mp3'),
  yawn_sleepy:          require('../assets/stories/sfx/yawn_sleepy.mp3'),

  // Trésors
  coin_drop:            require('../assets/stories/sfx/coin_drop.mp3'),
  treasure_chest_open:  require('../assets/stories/sfx/treasure_chest_open.mp3'),
  jingle_keys:          require('../assets/stories/sfx/jingle_keys.mp3'),

  // Mystère
  mysterious_whoosh:    require('../assets/stories/sfx/mysterious_whoosh.mp3'),
  ghost_woo:            require('../assets/stories/sfx/ghost_woo.mp3'),
  creak_floorboard:     require('../assets/stories/sfx/creak_floorboard.mp3'),

  // Petites actions
  book_page_turn:       require('../assets/stories/sfx/book_page_turn.mp3'),
  pop_bubble:           require('../assets/stories/sfx/pop_bubble.mp3'),
  splash_small:         require('../assets/stories/sfx/splash_small.mp3'),
  tap_knock:            require('../assets/stories/sfx/tap_knock.mp3'),

  // Foule
  crowd_cheer:          require('../assets/stories/sfx/crowd_cheer.mp3'),
  crowd_gasp:           require('../assets/stories/sfx/crowd_gasp.mp3'),
};

/** Volume des bruitages one-shot (par-dessus la voix narrée + ambiance) */
export const SFX_VOLUME = 0.7;

/** True si le tag a un MP3 bundlé (sinon le player saute silencieusement) */
export function hasSfxAsset(tag: StorySfxTag): boolean {
  return STORY_SFX_ASSETS[tag] !== undefined;
}

/** Liste des tags actuellement disponibles (utile pour le prompt Claude) */
export function getAvailableSfxTags(): StorySfxTag[] {
  return Object.keys(STORY_SFX_ASSETS) as StorySfxTag[];
}
