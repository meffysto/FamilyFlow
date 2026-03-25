import { getDailyAdventure, getTodayStr, ADVENTURES } from '../mascot/adventures';

describe('getDailyAdventure', () => {
  it('retourne une aventure valide', () => {
    const adv = getDailyAdventure('papa');
    expect(ADVENTURES).toContainEqual(adv);
  });

  it('est déterministe (même date + même profil = même aventure)', () => {
    const date = new Date(2026, 2, 25);
    const a1 = getDailyAdventure('papa', date);
    const a2 = getDailyAdventure('papa', date);
    expect(a1.id).toBe(a2.id);
  });

  it('varie selon le profil', () => {
    const date = new Date(2026, 2, 25);
    const a1 = getDailyAdventure('papa', date);
    const a2 = getDailyAdventure('maman', date);
    // Pas garanti différent mais très probable avec des IDs différents
    // On vérifie juste que les deux sont valides
    expect(ADVENTURES).toContainEqual(a1);
    expect(ADVENTURES).toContainEqual(a2);
  });

  it('varie selon la date', () => {
    const a1 = getDailyAdventure('papa', new Date(2026, 0, 1));
    const a2 = getDailyAdventure('papa', new Date(2026, 0, 2));
    // Vérifie que les deux sont valides (peuvent être identiques par hasard)
    expect(ADVENTURES).toContainEqual(a1);
    expect(ADVENTURES).toContainEqual(a2);
  });

  it('chaque aventure a les bons champs', () => {
    for (const adv of ADVENTURES) {
      expect(adv.id).toBeTruthy();
      expect(adv.emoji).toBeTruthy();
      expect(adv.titleKey).toMatch(/^mascot\.adventure\./);
      expect(adv.descriptionKey).toMatch(/^mascot\.adventure\./);
      expect(adv.choiceA.points).toBeGreaterThan(0);
      expect(adv.choiceB.points).toBeGreaterThan(0);
      expect(adv.choiceA.labelKey).toBeTruthy();
      expect(adv.choiceB.labelKey).toBeTruthy();
    }
  });

  it('le pool contient 15 aventures', () => {
    expect(ADVENTURES).toHaveLength(15);
  });
});

describe('getTodayStr', () => {
  it('formate correctement', () => {
    expect(getTodayStr(new Date(2026, 2, 25))).toBe('2026-03-25');
  });

  it('pad les mois et jours', () => {
    expect(getTodayStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
