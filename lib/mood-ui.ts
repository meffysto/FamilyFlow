/**
 * mood-ui.ts — Mapping UI des niveaux d'humeur (icônes Lucide + teintes sémantiques).
 *
 * MOOD_EMOJIS (lib/types.ts) reste la source de vérité pour la persistance vault.
 * Ce fichier est purement UI : icônes affichées + couleur de teinte par niveau.
 */

import { Frown, Meh, Smile, Laugh, Sparkles } from 'lucide-react-native';
import type { MoodLevel } from './types';
import type { AppColors } from '../constants/colors';

export const MOOD_ICONS = {
  1: Frown,
  2: Meh,
  3: Smile,
  4: Laugh,
  5: Sparkles,
} as const;

export function getMoodIconColor(level: MoodLevel, colors: AppColors): string {
  switch (level) {
    case 1: return colors.error;
    case 2: return colors.textMuted;
    case 3: return colors.catSante;
    case 4: return colors.success;
    case 5: return colors.brand.or;
  }
}
