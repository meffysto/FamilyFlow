// lib/pdf/qr-generator.ts — Génération QR code SVG inline pour 4ème de couverture (Phase 50, QR-04).
// Encode family-vault://story/<id> → SVG inline injectable directement dans HTML expo-print.
// Output déterministe → hash SHA-256 du PDF reste stable pour mêmes inputs (Phase 49-03).

import QRCode from 'qrcode';
import type { BookPalette } from './types';

const STORY_DEEP_LINK_PREFIX = 'family-vault://story/';

/**
 * Génère un SVG QR code encodant le deep link `family-vault://story/<id>`.
 *
 * Paramètres optimisés pour impression 3×3cm (RESEARCH.md §168-178) :
 * - errorCorrectionLevel 'M' (15%) : compromis taille/robustesse pour scan papier
 * - margin 1 : quiet zone minimale (0 casse les scanners)
 * - width 300 : suffisant en SVG vectoriel pour 3cm @ 300dpi
 *
 * Le caractère déterministe de `qrcode.toString` (encodeur Reed-Solomon pur) garantit
 * un output identique pour le même `storyId` — donc le hash SHA-256 du HTML résultant
 * reste stable d'un export à l'autre (Phase 49-03 PDF-07).
 *
 * @param storyId Identifiant unique de l'histoire (BedtimeStory.id)
 * @param palette Palette livre — `palette.ink` est utilisé comme `color.dark`
 * @returns SVG inline string (déterministe pour mêmes inputs)
 * @throws si `storyId` absent ou non-string
 */
export async function generateStoryQrSvg(
  storyId: string,
  palette: BookPalette,
): Promise<string> {
  if (!storyId || typeof storyId !== 'string') {
    throw new Error('[generateStoryQrSvg] storyId requis');
  }
  const url = `${STORY_DEEP_LINK_PREFIX}${encodeURIComponent(storyId)}`;
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 300,
    color: {
      dark: palette.ink,
      light: '#00000000', // transparent — laisse le fond ivory du livre
    },
  });
  return svg;
}
