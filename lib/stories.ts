import type { ImageSourcePropType } from 'react-native';
import type { StoryUniverse, StoryUniverseId } from './types';

export const STORIES_DIR = '09 - Histoires';

// Sprites pixel-art pour chaque univers (sauf "surprise" qui garde l'emoji)
export const STORY_UNIVERSE_SPRITES: Partial<Record<StoryUniverseId, ImageSourcePropType>> = {
  espace: require('../assets/stories/themes/espace.png'),
  ocean: require('../assets/stories/themes/ocean.png'),
  foret: require('../assets/stories/themes/foret.png'),
  dinosaures: require('../assets/stories/themes/dinosaures.png'),
  princesse: require('../assets/stories/themes/princesse.png'),
  'super-heros': require('../assets/stories/themes/super-heros.png'),
  pirates: require('../assets/stories/themes/pirates.png'),
  robots: require('../assets/stories/themes/robots.png'),
  surprise: require('../assets/stories/themes/surprise.png'),
};

export const STORY_UNIVERSES: StoryUniverse[] = [
  { id: 'espace',      titre: 'Espace étoilé',        description: 'Voyage parmi les étoiles',     emoji: '🌠', couleurAccent: '#6366F1', couleurGlow: '#6366F180' },
  { id: 'ocean',       titre: 'Océan profond',          description: 'Plongée dans les profondeurs', emoji: '🌊', couleurAccent: '#0EA5E9', couleurGlow: '#0EA5E980' },
  { id: 'foret',       titre: 'Forêt enchantée',        description: 'Magie parmi les arbres',       emoji: '🌲', couleurAccent: '#10B981', couleurGlow: '#10B98180' },
  { id: 'dinosaures',  titre: 'Monde des Dinosaures',   description: 'Aventure préhistorique',       emoji: '🦕', couleurAccent: '#F59E0B', couleurGlow: '#F59E0B80' },
  { id: 'princesse',   titre: 'Château de princesse',   description: 'Magie et royauté',             emoji: '👑', couleurAccent: '#EC4899', couleurGlow: '#EC489980' },
  { id: 'super-heros', titre: 'Univers Super-Héros',    description: 'Pouvoirs et courage',          emoji: '⚡', couleurAccent: '#8B5CF6', couleurGlow: '#8B5CF680' },
  { id: 'pirates',     titre: 'Aventure Pirates',        description: 'Trésors et haute mer',         emoji: '☠️', couleurAccent: '#EF4444', couleurGlow: '#EF444480' },
  { id: 'robots',      titre: 'Planète des Robots',     description: 'Technologie et découverte',    emoji: '🤖', couleurAccent: '#6B7280', couleurGlow: '#6B728080' },
  { id: 'surprise',    titre: 'Surprise !',              description: 'Laisse-moi choisir pour toi', emoji: '✨', couleurAccent: '#F59E0B', couleurGlow: '#F59E0B80' },
];

export const STORY_SUGGESTIONS = [
  "peur des monstres sous le lit",
  "a eu une super journée à l'école",
  "a eu une dispute avec un ami",
  "a perdu une dent",
  "a été très courageux aujourd'hui",
  "rêve de devenir astronaute",
  "a peur du noir",
  "a fait un beau dessin",
];

export const ELEVENLABS_FRENCH_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam — doux et chaleureux' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella — féminin, apaisant' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold — grave, posé' },
];

export const ELEVENLABS_ENGLISH_VOICES = [
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni — storyteller' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli — soft, calm' },
];

export function storyFileName(enfantName: string, date: string, universId: StoryUniverseId): string {
  return `${STORIES_DIR}/${enfantName}/${date}-${universId}.md`;
}

/** Sélectionne un univers aléatoire en évitant les répétitions récentes */
export function pickSurpriseUniverse(recentIds: StoryUniverseId[]): StoryUniverseId {
  const nonSurprise = STORY_UNIVERSES.filter(u => u.id !== 'surprise');
  const notRecent = nonSurprise.filter(u => !recentIds.includes(u.id));
  const pool = notRecent.length > 0 ? notRecent : nonSurprise;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
