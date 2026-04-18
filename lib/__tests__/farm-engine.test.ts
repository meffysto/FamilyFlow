/**
 * farm-engine.test.ts — Tests unitaires pour lib/mascot/farm-engine.ts
 * Couvre : plantCrop, advanceFarmCrops, harvestCrop, golden mutation, serializeCrops/parseCrops
 */

import {
  plantCrop,
  advanceFarmCrops,
  harvestCrop,
  serializeCrops,
  parseCrops,
  encodeModifiers,
  decodeModifiers,
  GOLDEN_CROP_CHANCE,
  GOLDEN_HARVEST_MULTIPLIER,
} from '../mascot/farm-engine';
import type { PlantedCrop, WagerModifier, FarmCropModifiers } from '../mascot/types';

// Mock getCurrentSeason pour contrôler les bonus saisonniers
jest.mock('../mascot/seasons', () => ({
  getCurrentSeason: jest.fn().mockReturnValue('hiver'),
}));

import { getCurrentSeason } from '../mascot/seasons';

afterEach(() => {
  jest.restoreAllMocks();
  // Réinitialiser le mock à 'hiver' (sans bonus) après chaque test
  (getCurrentSeason as jest.Mock).mockReturnValue('hiver');
});

// ─── plantCrop ───────────────────────────────────────────────────────────────

describe('plantCrop', () => {
  it('plante une culture sur une parcelle vide', () => {
    const crops = plantCrop([], 0, 'carrot');
    expect(crops).toHaveLength(1);
    expect(crops[0].cropId).toBe('carrot');
    expect(crops[0].plotIndex).toBe(0);
    expect(crops[0].currentStage).toBe(0);
    expect(crops[0].tasksCompleted).toBe(0);
  });

  it('ne plante pas si la parcelle est déjà occupée', () => {
    const crops = plantCrop([], 0, 'carrot');
    const result = plantCrop(crops, 0, 'tomato');
    expect(result).toHaveLength(1);
    expect(result[0].cropId).toBe('carrot'); // pas de remplacement
  });

  it('ne plante pas une culture inexistante dans le catalogue', () => {
    const result = plantCrop([], 0, 'culture_inconnue');
    expect(result).toHaveLength(0);
  });

  it('peut planter sur plusieurs parcelles distinctes', () => {
    let crops = plantCrop([], 0, 'carrot');
    crops = plantCrop(crops, 1, 'wheat');
    crops = plantCrop(crops, 2, 'potato');
    expect(crops).toHaveLength(3);
  });

  it('crée une culture GOLDEN si Math.random < GOLDEN_CROP_CHANCE', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(GOLDEN_CROP_CHANCE - 0.01);
    const crops = plantCrop([], 0, 'carrot');
    expect(crops[0].isGolden).toBe(true);
  });

  it('crée une culture normale si Math.random >= GOLDEN_CROP_CHANCE', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(GOLDEN_CROP_CHANCE + 0.01);
    const crops = plantCrop([], 0, 'carrot');
    expect(crops[0].isGolden).toBeFalsy();
  });

  it('stocke la date de plantation au format YYYY-MM-DD', () => {
    const crops = plantCrop([], 0, 'carrot');
    expect(crops[0].plantedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── advanceFarmCrops ────────────────────────────────────────────────────────

describe('advanceFarmCrops', () => {
  it('retourne le state inchangé si aucune culture', () => {
    const result = advanceFarmCrops([]);
    expect(result.crops).toHaveLength(0);
    expect(result.matured).toHaveLength(0);
  });

  it('avance la première culture non-mature (FIFO) de 1 tache', () => {
    const crops: PlantedCrop[] = [
      { cropId: 'carrot', plotIndex: 0, currentStage: 0, tasksCompleted: 0, plantedAt: '2026-01-01' },
    ];
    const result = advanceFarmCrops(crops);
    // carrot: tasksPerStage=1, donc 1 tache = avance au stade 1
    expect(result.crops[0].currentStage).toBe(1);
    expect(result.crops[0].tasksCompleted).toBe(0);
  });

  it('avance de 2 taches avec bonus saisonnier actif pour culture multi-taches', () => {
    (getCurrentSeason as jest.Mock).mockReturnValue('ete'); // tomato bonus
    const crops: PlantedCrop[] = [
      // tomato: tasksPerStage=2, bonus=2 → tasksCompleted=2 >= 2 → avance au stade 1
      { cropId: 'tomato', plotIndex: 0, currentStage: 0, tasksCompleted: 0, plantedAt: '2026-01-01' },
    ];
    const result = advanceFarmCrops(crops);
    // Avec bonus saisonnier : tasksCompleted += 2, puis 2 >= tasksPerStage(2) → stade 1
    expect(result.crops[0].currentStage).toBe(1);
  });

  it('accumule les taches sans avancer si pas assez pour un stade', () => {
    (getCurrentSeason as jest.Mock).mockReturnValue('hiver'); // pas de bonus
    const crops: PlantedCrop[] = [
      // tomato: tasksPerStage=2, 1 tache → pas assez pour avancer
      { cropId: 'tomato', plotIndex: 0, currentStage: 0, tasksCompleted: 0, plantedAt: '2026-01-01' },
    ];
    const result = advanceFarmCrops(crops);
    expect(result.crops[0].currentStage).toBe(0);
    expect(result.crops[0].tasksCompleted).toBe(1);
  });

  it('ne réavance pas les cultures déjà matures (stage 4)', () => {
    const crops: PlantedCrop[] = [
      { cropId: 'carrot', plotIndex: 0, currentStage: 4, tasksCompleted: 0, plantedAt: '2026-01-01' },
    ];
    const result = advanceFarmCrops(crops);
    expect(result.crops[0].currentStage).toBe(4);
  });

  it('ajoute la culture mature dans matured quand elle atteint le stade 4', () => {
    const crops: PlantedCrop[] = [
      { cropId: 'carrot', plotIndex: 0, currentStage: 3, tasksCompleted: 0, plantedAt: '2026-01-01' },
    ];
    const result = advanceFarmCrops(crops);
    // carrot tasksPerStage=1: 1 tache → stade 4 → mature
    expect(result.matured).toHaveLength(1);
    expect(result.matured[0].plotIndex).toBe(0);
  });
});

// ─── harvestCrop ─────────────────────────────────────────────────────────────

describe('harvestCrop', () => {
  it('récolte une culture mature et retourne le cropId', () => {
    const crops: PlantedCrop[] = [
      { cropId: 'carrot', plotIndex: 0, currentStage: 4, tasksCompleted: 0, plantedAt: '2026-01-01' },
    ];
    const result = harvestCrop(crops, 0);
    expect(result.crops).toHaveLength(0);
    expect(result.harvestedCropId).toBe('carrot');
    expect(result.isGolden).toBe(false);
  });

  it('retourne isGolden=true pour une culture dorée', () => {
    const crops: PlantedCrop[] = [
      { cropId: 'carrot', plotIndex: 0, currentStage: 4, tasksCompleted: 0, plantedAt: '2026-01-01', isGolden: true },
    ];
    const result = harvestCrop(crops, 0);
    expect(result.harvestedCropId).toBe('carrot');
    expect(result.isGolden).toBe(true);
  });

  it('ne récolte pas une culture non-mature (stade < 4)', () => {
    const crops: PlantedCrop[] = [
      { cropId: 'carrot', plotIndex: 0, currentStage: 2, tasksCompleted: 0, plantedAt: '2026-01-01' },
    ];
    const result = harvestCrop(crops, 0);
    expect(result.crops).toHaveLength(1); // culture conservée
    expect(result.harvestedCropId).toBeNull();
  });

  it('retourne harvestedCropId=null si la parcelle est vide', () => {
    const result = harvestCrop([], 0);
    expect(result.harvestedCropId).toBeNull();
  });
});

// ─── serializeCrops / parseCrops ─────────────────────────────────────────────

describe('serializeCrops / parseCrops', () => {
  it('round-trip : parseCrops(serializeCrops(crops)) préserve toutes les propriétés', () => {
    const original: PlantedCrop[] = [
      { cropId: 'carrot', plotIndex: 0, currentStage: 2, tasksCompleted: 1, plantedAt: '2026-01-15' },
      { cropId: 'tomato', plotIndex: 3, currentStage: 1, tasksCompleted: 0, plantedAt: '2026-01-20', isGolden: true },
    ];
    const serialized = serializeCrops(original);
    const parsed = parseCrops(serialized);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].cropId).toBe('carrot');
    expect(parsed[0].plotIndex).toBe(0);
    expect(parsed[0].currentStage).toBe(2);
    expect(parsed[0].tasksCompleted).toBe(1);
    expect(parsed[0].plantedAt).toBe('2026-01-15');
    expect(parsed[1].isGolden).toBe(true);
  });

  it('parseCrops avec goldenFlag=1 retourne isGolden=true', () => {
    const csv = '0:carrot:2:0:2026-01-15:1';
    const crops = parseCrops(csv);
    expect(crops[0].isGolden).toBe(true);
  });

  it('parseCrops sans goldenFlag retourne isGolden=false', () => {
    const csv = '0:carrot:2:0:2026-01-15:';
    const crops = parseCrops(csv);
    expect(crops[0].isGolden).toBe(false);
  });

  it('parseCrops retourne tableau vide pour une chaine vide', () => {
    expect(parseCrops('')).toHaveLength(0);
    expect(parseCrops('  ')).toHaveLength(0);
  });

  it('serializeCrops retourne chaine vide pour tableau vide', () => {
    expect(serializeCrops([])).toBe('');
  });
});

describe('serializeCrops / parseCrops with modifiers (Phase 38 MOD-01)', () => {
  it('round-trip plant legacy sans modifier (6 champs, pas de trailing :)', () => {
    const plant: PlantedCrop = {
      plotIndex: 0,
      cropId: 'carrot',
      currentStage: 2,
      tasksCompleted: 1,
      plantedAt: '2026-04-18',
    };
    const csv = serializeCrops([plant]);
    expect(csv).toBe('0:carrot:2:1:2026-04-18:');
    const parsed = parseCrops(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ ...plant, isGolden: false });
    expect('modifiers' in parsed[0]).toBe(false);
  });

  it('round-trip plant avec wager complet deep-equal', () => {
    const wager: WagerModifier = {
      sporeeId: 'sp-lucas-abc-123',
      duration: 'engage',
      multiplier: 1.7,
      appliedAt: '2026-04-18',
      sealerProfileId: 'parent-lucas',
    };
    const plant: PlantedCrop = {
      plotIndex: 2,
      cropId: 'tomato',
      currentStage: 1,
      tasksCompleted: 0.5,
      plantedAt: '2026-04-18',
      isGolden: false,
      modifiers: { wager },
    };
    const csv = serializeCrops([plant]);
    const parsed = parseCrops(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].modifiers?.wager).toEqual(wager);
  });

  it('parse CSV legacy 6 champs (pré-v1.7) → modifiers undefined', () => {
    const legacyCsv = '0:carrot:2:1:2026-04-18:,1:wheat:0:0:2026-04-17:1';
    const parsed = parseCrops(legacyCsv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].modifiers).toBeUndefined();
    expect('modifiers' in parsed[0]).toBe(false);
    expect(parsed[1].isGolden).toBe(true);
    expect(parsed[1].modifiers).toBeUndefined();
  });

  it('parse 7e fragment vide string → modifiers undefined', () => {
    const csv = '0:carrot:2:1:2026-04-18::';
    const parsed = parseCrops(csv);
    expect(parsed[0].modifiers).toBeUndefined();
  });

  it('round-trip sporeeId avec tirets uuid-style', () => {
    const plant: PlantedCrop = {
      plotIndex: 0,
      cropId: 'corn',
      currentStage: 0,
      tasksCompleted: 0,
      plantedAt: '2026-04-18',
      modifiers: {
        wager: {
          sporeeId: 'sp-emma-d4e5-f678',
          duration: 'sprint',
          multiplier: 2.5,
          appliedAt: '2026-04-18',
          sealerProfileId: 'parent-emma',
        },
      },
    };
    const parsed = parseCrops(serializeCrops([plant]));
    expect(parsed[0].modifiers?.wager?.sporeeId).toBe('sp-emma-d4e5-f678');
  });

  it('mix plants legacy + plants avec wager dans un même CSV', () => {
    const legacy: PlantedCrop = { plotIndex: 0, cropId: 'carrot', currentStage: 1, tasksCompleted: 0, plantedAt: '2026-04-18' };
    const withWager: PlantedCrop = {
      plotIndex: 1, cropId: 'tomato', currentStage: 2, tasksCompleted: 1, plantedAt: '2026-04-18',
      modifiers: { wager: { sporeeId: 'sp-1', duration: 'chill', multiplier: 1.3, appliedAt: '2026-04-18', sealerProfileId: 'parent1' } },
    };
    const parsed = parseCrops(serializeCrops([legacy, withWager]));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].modifiers).toBeUndefined();
    expect(parsed[1].modifiers?.wager?.duration).toBe('chill');
  });

  it('encodeModifiers({}) retourne empty string', () => {
    expect(encodeModifiers({})).toBe('');
    expect(encodeModifiers(undefined)).toBe('');
  });

  it('decodeModifiers defensif sur input invalide', () => {
    expect(decodeModifiers('')).toBeUndefined();
    expect(decodeModifiers(undefined)).toBeUndefined();
    expect(decodeModifiers('{invalide')).toBeUndefined();
  });

  it('JSON modifiers n inclut JAMAIS de "," ni ":" bruts (escape pipe/§)', () => {
    const mods: FarmCropModifiers = {
      wager: { sporeeId: 'sp-x', duration: 'engage', multiplier: 1.7, appliedAt: '2026-04-18', sealerProfileId: 'p1' },
    };
    const encoded = encodeModifiers(mods);
    expect(encoded.includes(',')).toBe(false);
    expect(encoded.includes(':')).toBe(false);
    expect(encoded.includes('|')).toBe(true);
    expect(encoded.includes('§')).toBe(true);
  });
});
