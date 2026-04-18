// lib/codex/cultures.ts — Cultures ferme (source: CROP_CATALOG)
import { CROP_CATALOG } from '../mascot/types';
import { CROP_ICONS } from '../mascot/crop-sprites';
import type { CropEntry } from './types';

export const cropEntries: CropEntry[] = CROP_CATALOG.filter(crop => !crop.expeditionExclusive).map(crop => ({
  id: `crop_${crop.id}`,
  kind: 'crop' as const,
  sourceId: crop.id,
  nameKey: `codex.crop.${crop.id}.name`,
  loreKey: `codex.crop.${crop.id}.lore`,
  iconRef: crop.emoji,
  spriteRef: CROP_ICONS[crop.id],
}));
