// lib/__tests__/i18n.impressions.test.ts
// Vérifie l'enregistrement du namespace `impressions` (Phase 51-03).

import i18n from '../i18n';

describe('i18n impressions namespace', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  it('charge le namespace impressions FR (titre écran)', () => {
    expect(i18n.t('impressions:screen.title')).toBe('Mes impressions');
  });

  it('expose la clé du manuel Lulu', () => {
    expect(i18n.t('impressions:lulu.openButton')).toBe('Ouvrir Lulu Studio');
  });

  it('expose les étapes de génération', () => {
    expect(i18n.t('impressions:export.modal.generating.step.assets')).toContain(
      'illustrations',
    );
  });

  it('expose les 3 actions post-export', () => {
    expect(i18n.t('impressions:postExport.save.title')).toBe(
      'Sauvegarder le PDF',
    );
    expect(i18n.t('impressions:postExport.preview.title')).toBe('Voir le PDF');
    expect(i18n.t('impressions:postExport.lulu.title')).toBe(
      'Commander chez Lulu',
    );
  });
});
