import type { ImageSourcePropType } from 'react-native';
import type { StoryUniverse, StoryUniverseId, StoryLength } from './types';

export const STORIES_DIR = '09 - Histoires';

// Configuration des 4 niveaux de taille d'histoire.
// Injecté dans le prompt Claude (paragraphes + mots cibles) et utilisé pour max_tokens.
export interface StoryLengthConfig {
  key: StoryLength;
  label: string;
  emoji: string;
  paragraphs: number;  // nombre de paragraphes cibles
  words: number;       // nombre de mots cibles
  maxTokens: number;   // budget Claude API
  duration: string;    // durée de lecture estimée (affichage UI)
}

export const STORY_LENGTHS: Record<StoryLength, StoryLengthConfig> = {
  'courte': {
    key: 'courte',
    label: 'Courte',
    emoji: '🚀',
    paragraphs: 2,
    words: 100,
    maxTokens: 500,
    duration: '~45 sec',
  },
  'moyenne': {
    key: 'moyenne',
    label: 'Moyenne',
    emoji: '📖',
    paragraphs: 3,
    words: 180,
    maxTokens: 800,
    duration: '~1:30 min',
  },
  'longue': {
    key: 'longue',
    label: 'Longue',
    emoji: '📚',
    paragraphs: 5,
    words: 350,
    maxTokens: 1400,
    duration: '~2:30 min',
  },
  'tres-longue': {
    key: 'tres-longue',
    label: 'Très longue',
    emoji: '📜',
    paragraphs: 7,
    words: 600,
    maxTokens: 2000,
    duration: '~4 min',
  },
};

export const STORY_LENGTH_ORDER: StoryLength[] = ['courte', 'moyenne', 'longue', 'tres-longue'];

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

// Texte de clonage vocal (~180 mots, ~75-90 secondes à voix calme).
// Conçu pour ElevenLabs IVC : extrait d'histoire du soir varié phonétiquement
// (nasales, liquides, voyelles ouvertes/fermées, dialogue pour l'intonation).
export const VOICE_CLONE_SCRIPT_FR = `Ce soir-là, la petite Lila marchait doucement dans la forêt endormie. Les étoiles brillaient au-dessus des grands sapins, et une légère brise faisait frissonner les feuilles argentées. Elle s'arrêta près d'un ruisseau qui chantait entre les pierres rondes.

« Bonjour, petit ruisseau, murmura-t-elle en souriant. Connais-tu le chemin de la lune ? »

Le ruisseau gargouilla joyeusement, comme s'il avait compris. Soudain, un petit renard roux apparut derrière un buisson. Il avait de grands yeux curieux et une queue touffue qui balayait l'herbe humide.

« N'aie pas peur, dit Lila d'une voix calme. Je cherche simplement le pays des rêves. »

Le renard inclina la tête, puis il se mit à trottiner sur un sentier étroit. Lila le suivit, émerveillée. Ensemble, ils traversèrent un champ de fleurs bleues et violettes, grimpèrent une petite colline, et découvrirent un lac immense où se reflétaient mille lumières scintillantes.`;

// English voice cloning script (~180 words, ~75-90 seconds at calm pace).
// Designed for ElevenLabs IVC : bedtime story excerpt with varied phonetics
// (soft and hard consonants, long/short vowels, dialogue for intonation).
export const VOICE_CLONE_SCRIPT_EN = `That night, little Lila wandered gently through the sleeping forest. The stars shimmered above the tall pine trees, and a soft breeze made the silvery leaves whisper. She paused beside a small stream that sang quietly between smooth, round stones.

"Hello there, little stream," she murmured with a smile. "Do you know the way to the moon?"

The stream gurgled cheerfully, as if it had understood her. Suddenly, a small red fox appeared from behind a bush. He had big curious eyes and a bushy tail that brushed against the damp grass.

"Don't be afraid," Lila said in a calm voice. "I'm only searching for the land of dreams."

The fox tilted his head, then began trotting along a narrow path through the ferns. Lila followed, enchanted. Together, they crossed a field of blue and violet flowers, climbed a gentle hill, and discovered a vast lake where a thousand tiny lights were reflected on the water.`;

export function storyFileName(enfantName: string, date: string, universId: StoryUniverseId): string {
  return `${STORIES_DIR}/${enfantName}/${date}-${universId}.md`;
}

/**
 * Calcule le prochain nom de fichier disponible pour la combinaison
 * date+univers+enfant. La 1re histoire du jour pour cet univers garde la base
 * `<date>-<universe>.md` (rétrocompat). Les suivantes deviennent
 * `<date>-<universe>-2.md`, `-3.md`, etc.
 *
 * `existingIds` doit être l'ensemble des `BedtimeStory.id` déjà connus pour
 * cet enfant — on évite ainsi à la fois les collisions disque et les collisions
 * mémoire (histoire optimistic-saved pas encore re-relue).
 */
export function nextStoryFileName(
  enfantName: string,
  date: string,
  universId: StoryUniverseId,
  existingIds: Set<string>,
): { sourceFile: string; id: string } {
  const base = `${date}-${universId}`;
  if (!existingIds.has(base)) {
    return { sourceFile: `${STORIES_DIR}/${enfantName}/${base}.md`, id: base };
  }
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n++;
  const id = `${base}-${n}`;
  return { sourceFile: `${STORIES_DIR}/${enfantName}/${id}.md`, id };
}

/** Extrait l'id (= nom de fichier sans .md) depuis un sourceFile relatif */
export function storyIdFromSourceFile(sourceFile: string): string {
  const file = sourceFile.split('/').pop() ?? '';
  return file.replace(/\.md$/, '');
}

/** Sélectionne un univers aléatoire en évitant les répétitions récentes */
export function pickSurpriseUniverse(recentIds: StoryUniverseId[]): StoryUniverseId {
  const nonSurprise = STORY_UNIVERSES.filter(u => u.id !== 'surprise');
  const notRecent = nonSurprise.filter(u => !recentIds.includes(u.id));
  const pool = notRecent.length > 0 ? notRecent : nonSurprise;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
