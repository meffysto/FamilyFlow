// lib/pdf/__tests__/qr-generator.test.ts — Tests Phase 50 Plan 03 (QR-04).
// Valide la génération SVG QR déterministe pour la 4ème de couverture du livre PDF.

import { generateStoryQrSvg } from '../qr-generator';
import { BOOK_PALETTE } from '../constants';

describe('generateStoryQrSvg', () => {
  it('retourne un SVG valide commençant par <svg ou <?xml', async () => {
    const svg = await generateStoryQrSvg('test-story-123', BOOK_PALETTE);
    expect(svg.startsWith('<?xml') || svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox');
  });

  it('encode la couleur palette.ink dans le SVG', async () => {
    const svg = await generateStoryQrSvg('test-story-123', BOOK_PALETTE);
    // qrcode lib injecte la couleur dans path fill ou attribut style — match insensible casse
    expect(svg.toLowerCase()).toContain(BOOK_PALETTE.ink.toLowerCase());
  });

  it('produit un output déterministe pour mêmes inputs (hash stable)', async () => {
    const svg1 = await generateStoryQrSvg('story-abc-123', BOOK_PALETTE);
    const svg2 = await generateStoryQrSvg('story-abc-123', BOOK_PALETTE);
    expect(svg1).toEqual(svg2);
  });

  it('produit un output différent pour ids différents', async () => {
    const svgA = await generateStoryQrSvg('story-aaa', BOOK_PALETTE);
    const svgB = await generateStoryQrSvg('story-bbb', BOOK_PALETTE);
    expect(svgA).not.toEqual(svgB);
  });

  it('throw si storyId absent ou non-string', async () => {
    await expect(generateStoryQrSvg('', BOOK_PALETTE)).rejects.toThrow();
    // @ts-expect-error — runtime safety
    await expect(generateStoryQrSvg(null, BOOK_PALETTE)).rejects.toThrow();
  });

  it('gère les ids avec caractères spéciaux via encodeURIComponent', async () => {
    const svg = await generateStoryQrSvg('id with space/slash', BOOK_PALETTE);
    expect(svg.startsWith('<?xml') || svg.startsWith('<svg')).toBe(true);
  });
});
