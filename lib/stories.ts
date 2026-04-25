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

// Script PVC FR — destiné au clonage Pro (Professional Voice Cloning).
// ~900 mots / ~6 min de lecture posée. Sections étiquetées pour guider la variation
// tonale. Une prise complète = ~6 min ; deux relectures avec tons différents
// suffisent pour atteindre les 12-15 min de matière vocale exploitable.
export const VOICE_CLONE_SCRIPT_FR_PRO = `[Ton calme — voix posée, comme si tu lisais doucement le soir]

Le vent caressait les feuilles du grand chêne pendant que la nuit tombait lentement sur la vallée. Au loin, on entendait seulement le bruit léger d'une rivière qui suivait son chemin entre les pierres rondes. La petite Lila, blottie sous une couverture en laine bleue, respirait doucement et regardait les étoiles à travers la fenêtre entrouverte. Sa chambre sentait la lavande séchée et le bois ciré de son armoire ancienne. Sur la table de nuit, une tasse de tisane fumait encore, projetant de petites volutes argentées dans la lumière de la lampe.

[Voix narrative — rythme naturel, comme un conte de fées]

Il était une fois, dans un royaume oublié des cartes, un vieux jardinier qui parlait aux fleurs. Chaque matin, il leur racontait les nouvelles du village, les naissances et les mariages, les pluies attendues et les saisons qui s'installaient. Et chaque soir, les pétales se refermaient lentement en chuchotant des secrets que personne d'autre n'entendait jamais. On disait que ce jardinier connaissait le langage de tous les êtres vivants : les abeilles, les oiseaux, les pierres elles-mêmes. Quand on lui demandait son secret, il répondait simplement : « Il suffit d'écouter avec son cœur, pas seulement avec ses oreilles. »

[Exclamation joyeuse — voix forte, surprise heureuse]

« Oh ! Regarde ! C'est une étoile filante ! Vite, fais un vœu ! Allez, ferme les yeux, dépêche-toi avant qu'elle ne disparaisse ! Tu l'as vue ? Tu l'as vue passer ? Elle est partie derrière la grande montagne, juste là, tu vois ? Quelle chance incroyable, on en voit presque jamais d'aussi brillantes ! »

[Chuchoté — voix très douce, presque un souffle, comme un secret]

Approche, je vais te dire quelque chose d'important… Promets-moi de garder le secret, d'accord ? Personne, à part toi et moi, ne doit savoir. Au fond du jardin, sous la grande pierre plate couverte de mousse, il y a une petite porte que seuls les enfants peuvent voir. Elle mène à un endroit où le temps s'arrête. Là-bas, les jours durent autant que tu veux, et les rêves prennent forme dès qu'on les imagine. Mais attention : il faut toujours revenir avant que le coq chante, sinon le chemin disparaît pour toujours.

[Suspense — voix tendue, rythme suspendu, presque un murmure]

Soudain, un craquement. Lila se figea. Quelque chose marchait derrière elle… très lentement, très prudemment. Elle ne respirait plus. Une feuille bougea à sa gauche. Puis à sa droite. Son cœur battait si fort qu'elle entendait le sang dans ses oreilles. Devait-elle se retourner ? Ou bien courir, courir aussi vite qu'elle pouvait, sans regarder en arrière ?

[Dialogue — deux voix différentes, animation, échange vif]

« Qui es-tu ? demanda Lila en s'avançant prudemment.
— Je suis le gardien des rêves perdus, répondit la silhouette dans la brume. Et toi, petite voyageuse, qu'est-ce qui t'amène ici à cette heure tardive ?
— Je cherche mon doudou. Il s'est échappé pendant que je dormais.
— Ah ! fit le gardien en souriant. Alors tu es vraiment au bon endroit. Les doudous fuyards passent toujours par ici. Comment s'appelle le tien ?
— Il s'appelle Monsieur Pompon. C'est un lapin gris avec une oreille un peu tordue.
— Monsieur Pompon ? Eh bien, je crois que je l'ai vu il y a quelques minutes, près de la fontaine aux souhaits. Suis-moi, je vais te conduire à lui. »

[Voix grave — comme un grand méchant amusant, théâtral]

Je suis le grand ours des montagnes, et personne, tu m'entends, personne ne traverse mon pont sans répondre à mes trois questions ! Hahaha ! Tremble, petite voyageuse, car nul n'a jamais répondu juste à toutes les trois ! Première question : quel est le poids exact d'un nuage ? Deuxième question : combien d'étoiles dansent quand personne ne regarde ? Troisième question, et la plus difficile : pourquoi les enfants rient quand ils sont heureux ?

[Voix aiguë et joyeuse — comme un personnage de fée, légère et rapide]

Bonjour bonjour ! Je suis Pétale, la fée des coquelicots ! Tu veux danser avec moi dans la prairie ? Il y a tellement de papillons aujourd'hui, on va bien s'amuser ! Regarde celui-là, le bleu, il est si rapide ! Et celui-ci, le doré, on dirait qu'il danse exprès pour nous ! Viens, viens, donne-moi la main, on va faire le tour du grand chêne en chantant !

[Tendresse — voix douce, presque émue]

Tu sais, mon petit cœur, peu importe où tu vas, peu importe combien tu grandis, je serai toujours là pour toi. Quand tu fermes les yeux le soir, pense à moi, et tu sentiras ma présence. Mes bras autour de toi, ma voix qui te raconte des histoires, mon sourire qui te dit que tout va bien. Aucune distance, aucun temps ne pourra effacer ça.

[Question curieuse — ton intrigué, montée d'intonation]

Mais alors, dis-moi, pourquoi est-ce que la lune nous suit toujours quand on marche le soir ? Et pourquoi est-ce qu'on ne voit plus les étoiles quand le soleil se lève ? Comment font les oiseaux pour savoir quel chemin prendre quand ils volent en hiver ? Et toi, qu'est-ce que tu penses ?

[Rire — léger, naturel, amusé]

Hahaha ! Non mais sérieusement, regarde-toi ! Avec ton bonnet de travers et ton écharpe enroulée trois fois autour du cou ! Tu ressembles à un petit pingouin qui a trop chaud ! Allez, viens là, je vais arranger tout ça avant qu'on parte.

[Ton apaisé — pour la fin de l'histoire, voix qui ralentit]

Et c'est ainsi que Lila s'endormit, le sourire aux lèvres, en tenant fermement Monsieur Pompon contre son cœur. Dehors, la lune veillait sur la vallée, et toutes les étoiles, une par une, lui souhaitaient bonne nuit. Demain serait un autre jour, plein de nouvelles aventures, mais pour l'instant, le silence et le sommeil enveloppaient doucement la maison endormie.`;

// English voice cloning script (~180 words, ~75-90 seconds at calm pace).
// Designed for ElevenLabs IVC : bedtime story excerpt with varied phonetics
// (soft and hard consonants, long/short vowels, dialogue for intonation).
export const VOICE_CLONE_SCRIPT_EN = `That night, little Lila wandered gently through the sleeping forest. The stars shimmered above the tall pine trees, and a soft breeze made the silvery leaves whisper. She paused beside a small stream that sang quietly between smooth, round stones.

"Hello there, little stream," she murmured with a smile. "Do you know the way to the moon?"

The stream gurgled cheerfully, as if it had understood her. Suddenly, a small red fox appeared from behind a bush. He had big curious eyes and a bushy tail that brushed against the damp grass.

"Don't be afraid," Lila said in a calm voice. "I'm only searching for the land of dreams."

The fox tilted his head, then began trotting along a narrow path through the ferns. Lila followed, enchanted. Together, they crossed a field of blue and violet flowers, climbed a gentle hill, and discovered a vast lake where a thousand tiny lights were reflected on the water.`;

// English PVC script — ~900 words / ~6 min reading. Labelled sections to guide tonal variation.
export const VOICE_CLONE_SCRIPT_EN_PRO = `[Calm tone — soft and slow, like reading at bedtime]

The wind whispered through the leaves of the great oak as night settled slowly over the valley. Far away, only the gentle sound of a river could be heard, finding its way between the round stones. Little Lila, wrapped in a soft blue wool blanket, breathed quietly and watched the stars through the half-open window. Her bedroom smelled of dried lavender and the polished wood of her old wardrobe. On the bedside table, a cup of herbal tea was still steaming, sending tiny silver wisps curling into the lamplight.

[Narrative voice — natural pace, fairy tale]

Once upon a time, in a kingdom forgotten by mapmakers, there lived an old gardener who spoke to flowers. Every morning, he told them news from the village — births and weddings, expected rains, seasons coming and going. And every evening, the petals slowly closed up, whispering secrets no one else would ever hear. People said this gardener understood the language of every living thing: bees, birds, even the stones themselves. When asked his secret, he simply replied, "You only need to listen with your heart, not just your ears."

[Joyful exclamation — louder, happy surprise]

"Oh! Look! A shooting star! Quick, make a wish! Come on, close your eyes, hurry before it disappears! Did you see it? Did you see it pass? It went behind the big mountain, right there, see? What incredible luck — we almost never see one that bright!"

[Whispered — very soft, almost a breath, like a secret]

Come closer, I want to tell you something important… Promise me you'll keep this secret, alright? Nobody, except you and me, must know. At the bottom of the garden, under the great flat stone covered in moss, there is a tiny door only children can see. It leads to a place where time stands still. Down there, days last as long as you wish, and dreams take shape the moment you imagine them. But beware: you must always come back before the rooster crows, or the path disappears forever.

[Suspense — tense voice, suspended rhythm, almost a murmur]

Suddenly, a crack. Lila froze. Something was walking behind her… very slowly, very carefully. She held her breath. A leaf moved to her left. Then to her right. Her heart was beating so loudly she could hear the blood rushing in her ears. Should she turn around? Or run, run as fast as she could, without ever looking back?

[Dialogue — two distinct voices, lively exchange]

"Who are you?" Lila asked, stepping forward carefully.
"I am the keeper of lost dreams," answered the figure in the mist. "And you, little traveler, what brings you here at this late hour?"
"I'm looking for my teddy. He ran away while I was sleeping."
"Ah!" said the keeper, smiling. "Then you've truly come to the right place. Runaway teddies always pass through here. What's yours called?"
"His name is Mister Pompon. He's a grey rabbit with one slightly bent ear."
"Mister Pompon? Well, I think I saw him just a few minutes ago, near the wishing fountain. Follow me, I'll take you to him."

[Deep voice — playful big bad, theatrical]

I am the great mountain bear, and no one, do you hear me, no one crosses my bridge without answering my three questions! Hahaha! Tremble, little traveler, for none has ever answered all three correctly! First question: what is the exact weight of a cloud? Second question: how many stars dance when no one is watching? Third question, and the hardest of all: why do children laugh when they are happy?

[High and cheerful — fairy character, light and quick]

Hello hello! I'm Petal, the poppy fairy! Want to dance with me in the meadow? There are so many butterflies today, we'll have such fun! Look at that one, the blue one, he's so fast! And this one, the golden one, looks like he's dancing just for us! Come on, come on, give me your hand, we'll go around the great oak singing!

[Tenderness — soft voice, almost moved]

You know, my little one, no matter where you go, no matter how much you grow, I will always be there for you. When you close your eyes at night, think of me, and you'll feel my presence. My arms around you, my voice telling you stories, my smile telling you that everything is alright. No distance, no time can ever erase that.

[Curious question — intrigued tone, rising intonation]

But tell me, why does the moon always follow us when we walk at night? And why can't we see the stars anymore once the sun rises? How do birds know which way to go when they fly south for winter? And you, what do you think?

[Laughter — light, natural, amused]

Hahaha! No but seriously, look at you! With your hat all crooked and your scarf wrapped three times around your neck! You look like a little penguin who's a bit too warm! Come on, come here, I'll fix that before we go.

[Soothing tone — story ending, voice slowing down]

And so Lila fell asleep, a smile on her lips, holding Mister Pompon tightly to her heart. Outside, the moon watched over the valley, and all the stars, one by one, wished her goodnight. Tomorrow would be another day, full of new adventures, but for now, silence and sleep gently wrapped around the quiet, dreaming house.`;

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
