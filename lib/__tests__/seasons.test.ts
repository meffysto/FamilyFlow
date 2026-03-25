import {
  getCurrentSeason,
  getSeasonalPalette,
  SKY_COLORS,
  GROUND_COLORS,
  SEASONAL_PARTICLES,
  SEASON_INFO,
} from '../mascot/seasons';
import { SPECIES_INFO, ALL_SPECIES } from '../mascot/types';

describe('getCurrentSeason', () => {
  it('retourne printemps en mars', () => {
    expect(getCurrentSeason(new Date(2026, 2, 15))).toBe('printemps');
  });

  it('retourne printemps en mai', () => {
    expect(getCurrentSeason(new Date(2026, 4, 1))).toBe('printemps');
  });

  it('retourne ete en juin', () => {
    expect(getCurrentSeason(new Date(2026, 5, 21))).toBe('ete');
  });

  it('retourne ete en août', () => {
    expect(getCurrentSeason(new Date(2026, 7, 15))).toBe('ete');
  });

  it('retourne automne en septembre', () => {
    expect(getCurrentSeason(new Date(2026, 8, 1))).toBe('automne');
  });

  it('retourne automne en novembre', () => {
    expect(getCurrentSeason(new Date(2026, 10, 30))).toBe('automne');
  });

  it('retourne hiver en décembre', () => {
    expect(getCurrentSeason(new Date(2026, 11, 25))).toBe('hiver');
  });

  it('retourne hiver en janvier', () => {
    expect(getCurrentSeason(new Date(2026, 0, 15))).toBe('hiver');
  });

  it('retourne hiver en février', () => {
    expect(getCurrentSeason(new Date(2026, 1, 14))).toBe('hiver');
  });

  it('sans argument, retourne une saison valide', () => {
    const season = getCurrentSeason();
    expect(['printemps', 'ete', 'automne', 'hiver']).toContain(season);
  });
});

describe('getSeasonalPalette', () => {
  it('printemps retourne les couleurs par défaut de SPECIES_INFO', () => {
    for (const species of ALL_SPECIES) {
      const palette = getSeasonalPalette(species, 'printemps');
      expect(palette).toEqual(SPECIES_INFO[species]);
    }
  });

  it('chaque saison retourne un objet SpeciesVisual valide', () => {
    const seasons = ['printemps', 'ete', 'automne', 'hiver'] as const;
    const requiredKeys = ['species', 'labelKey', 'emoji', 'trunk', 'trunkDark', 'leaves', 'leavesDark', 'leavesLight', 'accent', 'accentLight', 'particle'];

    for (const season of seasons) {
      for (const species of ALL_SPECIES) {
        const palette = getSeasonalPalette(species, season);
        for (const key of requiredKeys) {
          expect(palette).toHaveProperty(key);
          expect(typeof (palette as any)[key]).toBe('string');
        }
      }
    }
  });

  it('hiver change les couleurs du cerisier', () => {
    const base = SPECIES_INFO.cerisier;
    const winter = getSeasonalPalette('cerisier', 'hiver');
    expect(winter.leaves).not.toBe(base.leaves);
    expect(winter.species).toBe('cerisier'); // propriétés de base préservées
    expect(winter.trunk).toBe(base.trunk);   // tronc inchangé
  });

  it('automne change les feuilles du chêne', () => {
    const base = SPECIES_INFO.chene;
    const autumn = getSeasonalPalette('chene', 'automne');
    expect(autumn.leaves).not.toBe(base.leaves);
  });

  it('été change les accents de l\'oranger', () => {
    const base = SPECIES_INFO.oranger;
    const summer = getSeasonalPalette('oranger', 'ete');
    expect(summer.accent).not.toBe(base.accent);
  });

  it('bambou reste relativement vert en hiver', () => {
    const winter = getSeasonalPalette('bambou', 'hiver');
    // Le bambou est sempervirent, sa couleur verte ne devrait pas être grise
    expect(winter.leaves).toBe('#4CAF50');
  });
});

describe('constantes saisons', () => {
  it('SKY_COLORS a 4 saisons', () => {
    expect(Object.keys(SKY_COLORS)).toHaveLength(4);
  });

  it('GROUND_COLORS a 4 saisons', () => {
    expect(Object.keys(GROUND_COLORS)).toHaveLength(4);
  });

  it('SEASONAL_PARTICLES a 4 saisons', () => {
    expect(Object.keys(SEASONAL_PARTICLES)).toHaveLength(4);
  });

  it('SEASON_INFO a 4 saisons avec emoji et labelKey', () => {
    const seasons = ['printemps', 'ete', 'automne', 'hiver'] as const;
    for (const s of seasons) {
      expect(SEASON_INFO[s].emoji).toBeTruthy();
      expect(SEASON_INFO[s].labelKey).toMatch(/^mascot\.season\./);
    }
  });

  it('chaque particule saisonnière a les bons champs', () => {
    const seasons = ['printemps', 'ete', 'automne', 'hiver'] as const;
    for (const s of seasons) {
      const p = SEASONAL_PARTICLES[s];
      expect(p.emoji).toBeTruthy();
      expect(p.color).toMatch(/^#/);
      expect(p.count).toBeGreaterThan(0);
      expect(['slow', 'normal', 'fast']).toContain(p.speed);
      expect(['up', 'down', 'float']).toContain(p.direction);
    }
  });
});
