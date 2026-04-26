/**
 * story-characters.ts — Casting des voix de personnages par univers d'histoire.
 *
 * Mapping fermé : Claude reçoit dans le prompt la liste exacte des slugs
 * disponibles pour l'univers demandé. Slug inconnu → la réplique tombe sur
 * le narrateur (fallback gratuit géré par le player).
 *
 * 15 voix curatées, toutes validées en écoute, toutes "grandes, belles, sûres
 * pour enfants" — aucune voix villain/horror. Bibliothèque publique ElevenLabs.
 */

import type { ElevenLabsModel } from './types';

export type CharacterVoice = {
  /** Slug stable utilisé par Claude dans `script.beats[].speaker` */
  slug: string;
  /** Libellé FR injecté dans le prompt — guide la sémantique narrative */
  label: string;
  /** Voice ID ElevenLabs */
  voiceId: string;
  /** Modèle optimal — v3 partout pour expressivité multilingue (tags + français) */
  model: ElevenLabsModel;
  /** Description courte pour aider Claude à doser le rôle dans l'histoire */
  hint: string;
};

/**
 * Casting fermé par univers. Chaque entrée = personnage que Claude PEUT
 * introduire dans une histoire de cet univers (jamais obligatoire).
 */
export const UNIVERS_CASTING: Record<string, CharacterVoice[]> = {
  princesse: [
    { slug: 'fée',       label: 'la fée (douce, enveloppante, mystérieuse)',       voiceId: 'sssn4wp3AspuK2kvy3Ym', model: 'eleven_v3', hint: 'Voix féminine douce et bienveillante. Idéal pour bénir, guider, rassurer le héros.' },
    { slug: 'dragon',    label: 'le dragon (grave, paisible, ancien)',             voiceId: 'xsiB5fGhEtknnqzudCO6', model: 'eleven_v3', hint: 'Voix masculine grave et lente. Dragon bienveillant et sage, jamais effrayant.' },
    { slug: 'sage',      label: 'le vieux sage du château (rauque, posé)',         voiceId: 'HAvvFKatz0uu0Fv55Riy', model: 'eleven_v3', hint: 'Voix masculine âgée. Mentor, gardien, conseiller — paroles rares mais précieuses.' },
    { slug: 'princesse', label: 'la princesse (jeune, fraîche, curieuse)',         voiceId: 'Z9LM7NBnQ8aOZKIXkd5S', model: 'eleven_v3', hint: 'Voix féminine jeune et lumineuse. Princesse alliée du héros, jamais en détresse.' },
    { slug: 'héros',     label: 'le héros allié (puissant, rassurant)',            voiceId: 'V33LkP9pVLdcjeB2y5Na', model: 'eleven_v3', hint: 'Voix masculine forte et chaleureuse. Champion qui protège, jamais agressif.' },
    { slug: 'magicien',  label: 'le magicien-narrateur (sage, magique)',           voiceId: 'oR4uRy4fHDUGGISL0Rev', model: 'eleven_v3', hint: 'Voix masculine âgée magique. Conteur enchanté qui révèle des secrets doux.' },
  ],

  espace: [
    { slug: 'IA',         label: 'l\'IA bienveillante du vaisseau',                voiceId: 'bAq8AI9QURijOtmeFFqT', model: 'eleven_v3', hint: 'Voix calme et futuriste, presque grand-paternelle. Guide protecteur du héros.' },
    { slug: 'capitaine',  label: 'le capitaine du vaisseau',                       voiceId: 'V33LkP9pVLdcjeB2y5Na', model: 'eleven_v3', hint: 'Voix d\'autorité chaleureuse. Mène l\'expédition avec courage et bienveillance.' },
    { slug: 'robot-ami',  label: 'le robot ami (poli, attentionné)',               voiceId: 'wDsJlOXPqcvIUKdLXjDs', model: 'eleven_v3', hint: 'Voix britannique posée. Compagnon loyal, plein d\'humour discret.' },
    { slug: 'compagnon',  label: 'le petit compagnon spatial',                     voiceId: 'AVYJxaX5Uon5HKPfdVo9', model: 'eleven_v3', hint: 'Voix tendre et mignonne. Petit alien curieux, ami du héros.' },
  ],

  ocean: [
    { slug: 'sirène',     label: 'la sirène (chant doux, marin)',                  voiceId: 'Z9LM7NBnQ8aOZKIXkd5S', model: 'eleven_v3', hint: 'Voix féminine enveloppante. Guide marin, protectrice des profondeurs.' },
    { slug: 'loup-de-mer',label: 'le vieux loup de mer',                           voiceId: '6VgigPFWF0sNZy1BthVg', model: 'eleven_v3', hint: 'Voix masculine rauque et chaleureuse. Pirate retraité qui raconte ses voyages.' },
    { slug: 'créature',   label: 'la grande créature des profondeurs (paisible)',  voiceId: 'xsiB5fGhEtknnqzudCO6', model: 'eleven_v3', hint: 'Voix masculine grave. Géant marin bienveillant, jamais menaçant.' },
  ],

  foret: [
    { slug: 'fée',        label: 'la fée des bois (chuchotante, lumineuse)',       voiceId: 'WUyjxM8OTY6l8LhTmdkq', model: 'eleven_v3', hint: 'Voix féminine chuchotée et magique. Esprit gardien doux de la forêt.' },
    { slug: 'vieux-chêne',label: 'le vieux chêne parlant',                         voiceId: '6sFKzaJr574YWVu4UuJF', model: 'eleven_v3', hint: 'Voix masculine âgée et profonde. Sagesse végétale ancestrale.' },
    { slug: 'habitant',   label: 'le petit habitant de la forêt',                  voiceId: 'AVYJxaX5Uon5HKPfdVo9', model: 'eleven_v3', hint: 'Voix mignonne et curieuse. Lutin, écureuil parlant, petit guide farceur.' },
  ],

  dinosaures: [
    { slug: 'grand-dino', label: 'le grand dinosaure protecteur',                  voiceId: 'xsiB5fGhEtknnqzudCO6', model: 'eleven_v3', hint: 'Voix grave et imposante. Doux malgré sa taille, protège les petits.' },
    { slug: 'mentor',     label: 'le vieux dinosaure sage',                        voiceId: 'oR4uRy4fHDUGGISL0Rev', model: 'eleven_v3', hint: 'Voix âgée paisible. Conte les légendes du temps des grands lézards.' },
    { slug: 'petit-dino', label: 'le petit dinosaure curieux',                     voiceId: 'AVYJxaX5Uon5HKPfdVo9', model: 'eleven_v3', hint: 'Voix joyeuse et innocente. Compagnon d\'aventure du héros.' },
  ],

  'super-heros': [
    { slug: 'mentor',     label: 'le héros mentor',                                voiceId: 'V33LkP9pVLdcjeB2y5Na', model: 'eleven_v3', hint: 'Voix forte et rassurante. Allié principal qui transmet le courage.' },
    { slug: 'sage',       label: 'le sage qui transmet les pouvoirs',              voiceId: '6sFKzaJr574YWVu4UuJF', model: 'eleven_v3', hint: 'Voix âgée majestueuse. Maître mentor, paroles graves et bienveillantes.' },
    { slug: 'compagnon',  label: 'le compagnon enfant du héros',                   voiceId: 'AVYJxaX5Uon5HKPfdVo9', model: 'eleven_v3', hint: 'Voix mignonne et brave. Petit ami fidèle qui suit l\'aventure.' },
  ],

  pirates: [
    { slug: 'capitaine',  label: 'le capitaine pirate (juste, courageux)',         voiceId: 'PPzYpIqttlTYA83688JI', model: 'eleven_v3', hint: 'Voix joviale et aventureuse. Pirate gentleman, jamais menaçant.' },
    { slug: 'loup-de-mer',label: 'le vieux loup de mer (bourru, conteur)',         voiceId: 'Xq2dbIWNPChFB77imiDe', model: 'eleven_v3', hint: 'Voix irlandaise chaleureuse. Conteur de récits anciens des mers.' },
    { slug: 'barbe-noire',label: 'le pirate Barbe-Noire (grave, légendaire)',      voiceId: '6VgigPFWF0sNZy1BthVg', model: 'eleven_v3', hint: 'Voix masculine rauque. Légende redoutée mais loyale envers le héros.' },
    { slug: 'mousse',     label: 'le mousse (jeune marin)',                        voiceId: 'AVYJxaX5Uon5HKPfdVo9', model: 'eleven_v3', hint: 'Voix mignonne et enthousiaste. Petit marin qui apprend.' },
  ],

  robots: [
    { slug: 'mentor',     label: 'le vieux robot mentor',                          voiceId: 'bAq8AI9QURijOtmeFFqT', model: 'eleven_v3', hint: 'Voix calme et futuriste. Robot ancien, gardien de mémoire mécanique.' },
    { slug: 'ami',        label: 'le robot ami du héros',                          voiceId: 'wDsJlOXPqcvIUKdLXjDs', model: 'eleven_v3', hint: 'Voix britannique courtoise. Compagnon loyal et plein d\'humour.' },
    { slug: 'petit-robot',label: 'le petit robot enfant',                          voiceId: '4Bk8kSmfWn7kN1am2GME', model: 'eleven_v3', hint: 'Voix robotique mignonne et magique. Apprenti curieux du héros.' },
  ],
};

/**
 * Retourne le casting de l'univers. Tableau vide si univers inconnu (ex :
 * `surprise` qui pioche un autre univers à la génération — le casting suit).
 */
export function getUniversCasting(universId: string): CharacterVoice[] {
  return UNIVERS_CASTING[universId] ?? [];
}

/**
 * Lookup d'un personnage par univers + slug. Retourne null si le speaker
 * n'est pas dans le casting de l'univers (le player tombe alors sur le
 * narrateur).
 */
export function getCharacterVoice(universId: string, speakerSlug: string): CharacterVoice | null {
  const casting = getUniversCasting(universId);
  return casting.find(c => c.slug === speakerSlug) ?? null;
}

/**
 * Construit la portion de prompt à injecter dans le system prompt Claude
 * quand `multiVoice` est activé. Liste les personnages disponibles avec leur
 * intention narrative pour guider Claude vers une utilisation cohérente.
 *
 * Renvoie chaîne vide si l'univers n'a pas de casting (ex : surprise non résolu).
 */
export function buildCharactersPromptSection(universId: string): string {
  const casting = getUniversCasting(universId);
  if (casting.length === 0) return '';

  const lines = casting.map(c => `  - "${c.slug}" : ${c.label} — ${c.hint}`).join('\n');

  return `

PERSONNAGES DISPONIBLES (multi-voix activé) :
Tu peux introduire 0 à 2 personnages parmi cette liste fermée. Chaque réplique d'un personnage devient un beat { "kind": "dialogue", "speaker": "<slug>", "text": "..." }.
${lines}

RÈGLES STRICTES MULTI-VOIX :
- N'utilise QUE les slugs ci-dessus dans le champ "speaker" (jamais "narrateur", jamais d'autre nom)
- Histoire courte (1-2¶) : 0 ou 1 personnage maximum
- Histoire moyenne (3¶) : 1 ou 2 personnages
- Histoire longue (5+¶) : 2 personnages maximum
- Si un personnage est introduit, il DOIT prononcer au minimum **2 répliques distinctes** dans l'histoire (jamais une seule). Sinon laisse le narrateur décrire ses paroles indirectement
- Espace les répliques d'un même personnage : ne mets JAMAIS deux dialogues consécutifs du même speaker — toujours au moins une narration entre deux dialogues du même personnage
- Le héros (l'enfant) ne parle JAMAIS — c'est le narrateur qui décrit ses actions et émotions
- Les tags de performance vocale ([whispers] etc.) peuvent apparaître DANS les dialogues — la voix du personnage les rendra
- Reformule la concaténation narration+dialogue pour qu'elle constitue le champ "texte" (cohérence mode Off ↔ Multi-voix)`;
}
