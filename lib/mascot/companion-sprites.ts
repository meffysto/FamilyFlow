// lib/mascot/companion-sprites.ts
// Mapping partage sprite compagnon par espece x stade x frame.
// Extrait de CompanionSlot.tsx en Phase 29 pour consommation double
// (CompanionSlot dans la ferme + VillageAvatar dans la place du village).

import type { CompanionSpecies, CompanionStage } from './companion-types';

export const COMPANION_SPRITES: Record<CompanionSpecies, Record<CompanionStage, { idle_1: any; idle_2: any; happy: any }>> = {
  chat: {
    bebe:   { idle_1: require('../../assets/garden/animals/chat/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/chat/bebe/idle_2.png'),   happy: require('../../assets/garden/animals/chat/bebe/happy.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/chat/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/chat/jeune/idle_2.png'),  happy: require('../../assets/garden/animals/chat/jeune/happy.png') },
    adulte: { idle_1: require('../../assets/garden/animals/chat/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/chat/adulte/idle_2.png'), happy: require('../../assets/garden/animals/chat/adulte/happy.png') },
  },
  chien: {
    bebe:   { idle_1: require('../../assets/garden/animals/chien/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/chien/bebe/idle_2.png'),   happy: require('../../assets/garden/animals/chien/bebe/happy.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/chien/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/chien/jeune/idle_2.png'),  happy: require('../../assets/garden/animals/chien/jeune/happy.png') },
    adulte: { idle_1: require('../../assets/garden/animals/chien/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/chien/adulte/idle_2.png'), happy: require('../../assets/garden/animals/chien/adulte/happy.png') },
  },
  lapin: {
    bebe:   { idle_1: require('../../assets/garden/animals/lapin/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/lapin/bebe/idle_2.png'),   happy: require('../../assets/garden/animals/lapin/bebe/happy.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/lapin/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/lapin/jeune/idle_2.png'),  happy: require('../../assets/garden/animals/lapin/jeune/happy.png') },
    adulte: { idle_1: require('../../assets/garden/animals/lapin/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/lapin/adulte/idle_2.png'), happy: require('../../assets/garden/animals/lapin/adulte/happy.png') },
  },
  renard: {
    bebe:   { idle_1: require('../../assets/garden/animals/renard/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/renard/bebe/idle_2.png'),   happy: require('../../assets/garden/animals/renard/bebe/happy.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/renard/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/renard/jeune/idle_2.png'),  happy: require('../../assets/garden/animals/renard/jeune/happy.png') },
    adulte: { idle_1: require('../../assets/garden/animals/renard/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/renard/adulte/idle_2.png'), happy: require('../../assets/garden/animals/renard/adulte/happy.png') },
  },
  herisson: {
    bebe:   { idle_1: require('../../assets/garden/animals/herisson/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/herisson/bebe/idle_2.png'),   happy: require('../../assets/garden/animals/herisson/bebe/happy.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/herisson/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/herisson/jeune/idle_2.png'),  happy: require('../../assets/garden/animals/herisson/jeune/happy.png') },
    adulte: { idle_1: require('../../assets/garden/animals/herisson/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/herisson/adulte/idle_2.png'), happy: require('../../assets/garden/animals/herisson/adulte/happy.png') },
  },
};

export type CompanionMood = 'idle' | 'happy';
