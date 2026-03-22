/**
 * Tests unitaires — Infrastructure i18n et helpers de traduction
 *
 * Vérifie que :
 * - i18next s'initialise correctement avec FR comme fallback
 * - Les helpers retournent le français par défaut
 * - Les helpers retournent l'anglais après changement de langue
 * - Les clés manquantes tombent sur le fallback français
 */

import i18n from '../i18n';
import { getRarityLabel } from '../gamification/rewards';
import {
  getDefiCategoryLabel,
  getDifficultyLabel,
  getDefiTitle,
  getDefiDescription,
} from '../../constants/defiTemplates';
import {
  getMissionText,
  getMissionCategoryLabel,
  MISSION_POOL,
} from '../../constants/secret-missions';
import { getRewardText } from '../gamification/rewards';
import { getCoachMarks, getScreenName } from '../help-content';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

// ─── Initialisation ─────────────────────────────────────────────────────────

describe('i18n initialisation', () => {
  it('est initialisé', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('a le français comme fallback', () => {
    expect(i18n.options.fallbackLng).toEqual(['fr']);
  });

  it('charge les 4 namespaces', () => {
    expect(i18n.options.ns).toContain('common');
    expect(i18n.options.ns).toContain('gamification');
    expect(i18n.options.ns).toContain('help');
    expect(i18n.options.ns).toContain('insights');
  });
});

// ─── getRarityLabel ─────────────────────────────────────────────────────────

describe('getRarityLabel', () => {
  it('retourne les labels français par défaut', () => {
    expect(getRarityLabel('commun')).toBe('Commun');
    expect(getRarityLabel('rare')).toBe('Rare');
    expect(getRarityLabel('épique')).toBe('Épique');
    expect(getRarityLabel('légendaire')).toBe('Légendaire');
    expect(getRarityLabel('mythique')).toBe('MYTHIQUE');
  });

  it('retourne les labels anglais après switch', async () => {
    await i18n.changeLanguage('en');
    expect(getRarityLabel('commun')).toBe('Common');
    expect(getRarityLabel('épique')).toBe('Epic');
    expect(getRarityLabel('légendaire')).toBe('Legendary');
    expect(getRarityLabel('mythique')).toBe('MYTHIC');
  });
});

// ─── getDifficultyLabel ─────────────────────────────────────────────────────

describe('getDifficultyLabel', () => {
  it('retourne les labels français par défaut', () => {
    expect(getDifficultyLabel('facile')).toBe('Facile');
    expect(getDifficultyLabel('moyen')).toBe('Moyen');
    expect(getDifficultyLabel('difficile')).toBe('Difficile');
  });

  it('retourne les labels anglais après switch', async () => {
    await i18n.changeLanguage('en');
    expect(getDifficultyLabel('facile')).toBe('Easy');
    expect(getDifficultyLabel('moyen')).toBe('Medium');
    expect(getDifficultyLabel('difficile')).toBe('Hard');
  });
});

// ─── getDefiCategoryLabel ───────────────────────────────────────────────────

describe('getDefiCategoryLabel', () => {
  it('retourne les labels français par défaut', () => {
    expect(getDefiCategoryLabel('ecrans')).toBe('Écrans');
    expect(getDefiCategoryLabel('cuisine')).toBe('Cuisine');
    expect(getDefiCategoryLabel('menage')).toBe('Ménage');
  });

  it('retourne les labels anglais après switch', async () => {
    await i18n.changeLanguage('en');
    expect(getDefiCategoryLabel('ecrans')).toBe('Screens');
    expect(getDefiCategoryLabel('cuisine')).toBe('Cooking');
    expect(getDefiCategoryLabel('menage')).toBe('Chores');
  });
});

// ─── getDefiTitle / getDefiDescription ──────────────────────────────────────

describe('getDefiTitle / getDefiDescription', () => {
  it('retourne titre et description français par défaut', () => {
    expect(getDefiTitle('ecrans_soiree', 'fallback')).toBe('Soirée sans écran');
    expect(getDefiDescription('cuisine_famille', 'fallback')).toBe('Cuisiner un repas en famille chaque jour');
  });

  it('retourne titre et description anglais après switch', async () => {
    await i18n.changeLanguage('en');
    expect(getDefiTitle('ecrans_soiree', 'fallback')).toBe('Screen-free evening');
    expect(getDefiDescription('cuisine_famille', 'fallback')).toBe('Cook a family meal together every day');
  });

  it('retourne le fallback si la clé est inconnue', () => {
    expect(getDefiTitle('inexistant_xyz', 'Mon fallback')).toBe('Mon fallback');
  });
});

// ─── getMissionText ─────────────────────────────────────────────────────────

describe('getMissionText', () => {
  const mission = MISSION_POOL.find((m) => m.id === 'tendresse_1')!;

  it('retourne le texte français par défaut', () => {
    expect(getMissionText(mission)).toBe('Faire un câlin surprise à quelqu\'un');
  });

  it('retourne le texte anglais après switch', async () => {
    await i18n.changeLanguage('en');
    expect(getMissionText(mission)).toBe('Give someone a surprise hug');
  });
});

// ─── getMissionCategoryLabel ────────────────────────────────────────────────

describe('getMissionCategoryLabel', () => {
  it('retourne les labels français par défaut', () => {
    expect(getMissionCategoryLabel('tendresse')).toBe('Tendresse');
    expect(getMissionCategoryLabel('entraide')).toBe('Entraide');
  });

  it('retourne les labels anglais après switch', async () => {
    await i18n.changeLanguage('en');
    expect(getMissionCategoryLabel('tendresse')).toBe('Affection');
    expect(getMissionCategoryLabel('entraide')).toBe('Helpfulness');
  });
});

// ─── Fallback ───────────────────────────────────────────────────────────────

describe('fallback vers le français', () => {
  it('retourne le français si la langue demandée n\'existe pas', async () => {
    await i18n.changeLanguage('de');
    expect(getRarityLabel('commun')).toBe('Commun');
    expect(getDifficultyLabel('facile')).toBe('Facile');
  });
});

// ─── getRewardText ──────────────────────────────────────────────────────────

describe('getRewardText', () => {
  it('retourne le texte français par défaut', () => {
    expect(getRewardText('commun', 0, 'fallback')).toBe('+5 points bonus');
    expect(getRewardText('mythique', 0, 'fallback')).toBe('2 JOURS SANS TÂCHES !');
  });

  it('retourne le texte anglais après switch', async () => {
    await i18n.changeLanguage('en');
    expect(getRewardText('commun', 0, 'fallback')).toBe('+5 bonus points');
    expect(getRewardText('mythique', 0, 'fallback')).toBe('2 DAYS WITH NO CHORES!');
  });

  it('retourne le fallback si index inconnu', () => {
    expect(getRewardText('commun', 99, 'Mon fallback')).toBe('Mon fallback');
  });
});

// ─── help-content helpers ───────────────────────────────────────────────────

describe('help-content helpers', () => {
  it('getCoachMarks retourne les marks traduits en FR', () => {
    const marks = getCoachMarks('dashboard');
    expect(marks.length).toBe(3);
    expect(marks[0].title).toBe('Votre tableau de bord');
    expect(marks[0].childBody).toBe('Voici ta page principale ! Tout ce qui est important est ici.');
  });

  it('getCoachMarks retourne les marks traduits en EN', async () => {
    await i18n.changeLanguage('en');
    const marks = getCoachMarks('dashboard');
    expect(marks[0].title).toBe('Your dashboard');
    expect(marks[0].childBody).toBe('This is your main page! Everything important is here.');
  });

  it('getScreenName retourne le nom traduit', async () => {
    expect(getScreenName('tasks', 'Tâches')).toBe('Tâches');
    await i18n.changeLanguage('en');
    expect(getScreenName('tasks', 'Tâches')).toBe('Tasks');
  });
});

// ─── Cohérence JSON ─────────────────────────────────────────────────────────

describe('cohérence des fichiers de traduction', () => {
  it('chaque mission du pool a une traduction FR et EN', () => {
    for (const mission of MISSION_POOL) {
      const fr = i18n.t(`gamification:missions.${mission.id}`, { lng: 'fr' });
      const en = i18n.t(`gamification:missions.${mission.id}`, { lng: 'en' });
      expect(fr).not.toBe(`gamification:missions.${mission.id}`);
      expect(en).not.toBe(`gamification:missions.${mission.id}`);
      expect(en).not.toBe(fr); // la traduction EN doit être différente du FR
    }
  });

  it('chaque template de défi a un titre FR et EN', () => {
    const defiIds = [
      'ecrans_soiree', 'ecrans_weekend', 'cuisine_famille', 'cuisine_nouveau',
      'lecture_30min', 'lecture_histoire', 'sport_marche', 'sport_10000',
      'menage_ranger', 'nature_sortie', 'famille_jeu', 'famille_compliment',
    ];
    for (const id of defiIds) {
      const fr = i18n.t(`gamification:defis.${id}.title`, { lng: 'fr' });
      const en = i18n.t(`gamification:defis.${id}.title`, { lng: 'en' });
      expect(fr).toBeTruthy();
      expect(en).toBeTruthy();
      expect(en).not.toBe(fr);
    }
  });
});
