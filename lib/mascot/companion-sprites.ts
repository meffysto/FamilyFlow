// lib/mascot/companion-sprites.ts
// Mapping partage sprite compagnon par espece x stade x frame.
// Extrait de CompanionSlot.tsx en Phase 29 pour consommation double
// (CompanionSlot dans la ferme + VillageAvatar dans la place du village).
// Phase 260425-0qf : ajout de 3 poses narratives (sleeping/eating/celebrating)
// pour la Live Activity — 5 poses totales.

import type { CompanionSpecies, CompanionStage } from './companion-types';

export const COMPANION_SPRITES: Record<CompanionSpecies, Record<CompanionStage, {
  idle_1: any;
  idle_2: any;
  happy: any;
  sleeping: any;
  eating: any;
  celebrating: any;
}>> = {
  chat: {
    bebe: {
      idle_1:      require('../../assets/garden/animals/chat/bebe/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/chat/bebe/idle_2.png'),
      happy:       require('../../assets/garden/animals/chat/bebe/happy.png'),
      sleeping:    require('../../assets/garden/animals/chat/bebe/sleeping.png'),
      eating:      require('../../assets/garden/animals/chat/bebe/eating.png'),
      celebrating: require('../../assets/garden/animals/chat/bebe/celebrating.png'),
    },
    jeune: {
      idle_1:      require('../../assets/garden/animals/chat/jeune/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/chat/jeune/idle_2.png'),
      happy:       require('../../assets/garden/animals/chat/jeune/happy.png'),
      sleeping:    require('../../assets/garden/animals/chat/jeune/sleeping.png'),
      eating:      require('../../assets/garden/animals/chat/jeune/eating.png'),
      celebrating: require('../../assets/garden/animals/chat/jeune/celebrating.png'),
    },
    adulte: {
      idle_1:      require('../../assets/garden/animals/chat/adulte/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/chat/adulte/idle_2.png'),
      happy:       require('../../assets/garden/animals/chat/adulte/happy.png'),
      sleeping:    require('../../assets/garden/animals/chat/adulte/sleeping.png'),
      eating:      require('../../assets/garden/animals/chat/adulte/eating.png'),
      celebrating: require('../../assets/garden/animals/chat/adulte/celebrating.png'),
    },
  },
  chien: {
    bebe: {
      idle_1:      require('../../assets/garden/animals/chien/bebe/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/chien/bebe/idle_2.png'),
      happy:       require('../../assets/garden/animals/chien/bebe/happy.png'),
      sleeping:    require('../../assets/garden/animals/chien/bebe/sleeping.png'),
      eating:      require('../../assets/garden/animals/chien/bebe/eating.png'),
      celebrating: require('../../assets/garden/animals/chien/bebe/celebrating.png'),
    },
    jeune: {
      idle_1:      require('../../assets/garden/animals/chien/jeune/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/chien/jeune/idle_2.png'),
      happy:       require('../../assets/garden/animals/chien/jeune/happy.png'),
      sleeping:    require('../../assets/garden/animals/chien/jeune/sleeping.png'),
      eating:      require('../../assets/garden/animals/chien/jeune/eating.png'),
      celebrating: require('../../assets/garden/animals/chien/jeune/celebrating.png'),
    },
    adulte: {
      idle_1:      require('../../assets/garden/animals/chien/adulte/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/chien/adulte/idle_2.png'),
      happy:       require('../../assets/garden/animals/chien/adulte/happy.png'),
      sleeping:    require('../../assets/garden/animals/chien/adulte/sleeping.png'),
      eating:      require('../../assets/garden/animals/chien/adulte/eating.png'),
      celebrating: require('../../assets/garden/animals/chien/adulte/celebrating.png'),
    },
  },
  lapin: {
    bebe: {
      idle_1:      require('../../assets/garden/animals/lapin/bebe/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/lapin/bebe/idle_2.png'),
      happy:       require('../../assets/garden/animals/lapin/bebe/happy.png'),
      sleeping:    require('../../assets/garden/animals/lapin/bebe/sleeping.png'),
      eating:      require('../../assets/garden/animals/lapin/bebe/eating.png'),
      celebrating: require('../../assets/garden/animals/lapin/bebe/celebrating.png'),
    },
    jeune: {
      idle_1:      require('../../assets/garden/animals/lapin/jeune/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/lapin/jeune/idle_2.png'),
      happy:       require('../../assets/garden/animals/lapin/jeune/happy.png'),
      sleeping:    require('../../assets/garden/animals/lapin/jeune/sleeping.png'),
      eating:      require('../../assets/garden/animals/lapin/jeune/eating.png'),
      celebrating: require('../../assets/garden/animals/lapin/jeune/celebrating.png'),
    },
    adulte: {
      idle_1:      require('../../assets/garden/animals/lapin/adulte/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/lapin/adulte/idle_2.png'),
      happy:       require('../../assets/garden/animals/lapin/adulte/happy.png'),
      sleeping:    require('../../assets/garden/animals/lapin/adulte/sleeping.png'),
      eating:      require('../../assets/garden/animals/lapin/adulte/eating.png'),
      celebrating: require('../../assets/garden/animals/lapin/adulte/celebrating.png'),
    },
  },
  renard: {
    bebe: {
      idle_1:      require('../../assets/garden/animals/renard/bebe/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/renard/bebe/idle_2.png'),
      happy:       require('../../assets/garden/animals/renard/bebe/happy.png'),
      sleeping:    require('../../assets/garden/animals/renard/bebe/sleeping.png'),
      eating:      require('../../assets/garden/animals/renard/bebe/eating.png'),
      celebrating: require('../../assets/garden/animals/renard/bebe/celebrating.png'),
    },
    jeune: {
      idle_1:      require('../../assets/garden/animals/renard/jeune/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/renard/jeune/idle_2.png'),
      happy:       require('../../assets/garden/animals/renard/jeune/happy.png'),
      sleeping:    require('../../assets/garden/animals/renard/jeune/sleeping.png'),
      eating:      require('../../assets/garden/animals/renard/jeune/eating.png'),
      celebrating: require('../../assets/garden/animals/renard/jeune/celebrating.png'),
    },
    adulte: {
      idle_1:      require('../../assets/garden/animals/renard/adulte/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/renard/adulte/idle_2.png'),
      happy:       require('../../assets/garden/animals/renard/adulte/happy.png'),
      sleeping:    require('../../assets/garden/animals/renard/adulte/sleeping.png'),
      eating:      require('../../assets/garden/animals/renard/adulte/eating.png'),
      celebrating: require('../../assets/garden/animals/renard/adulte/celebrating.png'),
    },
  },
  herisson: {
    bebe: {
      idle_1:      require('../../assets/garden/animals/herisson/bebe/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/herisson/bebe/idle_2.png'),
      happy:       require('../../assets/garden/animals/herisson/bebe/happy.png'),
      sleeping:    require('../../assets/garden/animals/herisson/bebe/sleeping.png'),
      eating:      require('../../assets/garden/animals/herisson/bebe/eating.png'),
      celebrating: require('../../assets/garden/animals/herisson/bebe/celebrating.png'),
    },
    jeune: {
      idle_1:      require('../../assets/garden/animals/herisson/jeune/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/herisson/jeune/idle_2.png'),
      happy:       require('../../assets/garden/animals/herisson/jeune/happy.png'),
      sleeping:    require('../../assets/garden/animals/herisson/jeune/sleeping.png'),
      eating:      require('../../assets/garden/animals/herisson/jeune/eating.png'),
      celebrating: require('../../assets/garden/animals/herisson/jeune/celebrating.png'),
    },
    adulte: {
      idle_1:      require('../../assets/garden/animals/herisson/adulte/idle_1.png'),
      idle_2:      require('../../assets/garden/animals/herisson/adulte/idle_2.png'),
      happy:       require('../../assets/garden/animals/herisson/adulte/happy.png'),
      sleeping:    require('../../assets/garden/animals/herisson/adulte/sleeping.png'),
      eating:      require('../../assets/garden/animals/herisson/adulte/eating.png'),
      celebrating: require('../../assets/garden/animals/herisson/adulte/celebrating.png'),
    },
  },
};

/**
 * Humeur du compagnon — 5 poses pour la Live Activity.
 * 'idle' et 'happy' préexistantes, 3 nouvelles poses narratives ajoutées
 * en Phase 260425-0qf pour alléger le ContentState (plus de base64 lourd).
 */
export type CompanionMood = 'idle' | 'happy' | 'sleeping' | 'eating' | 'celebrating';
