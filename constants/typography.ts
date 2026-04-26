/**
 * typography.ts — Design tokens pour tailles de texte et poids
 *
 * Usage :
 *   import { FontSize, FontWeight, LineHeight } from '../constants/typography';
 *   { fontSize: FontSize.body, fontWeight: FontWeight.semibold, lineHeight: LineHeight.body }
 */

export const FontSize = {
  /** 10px — micro (badges compteur, mentions légales) */
  micro: 10,
  /** 11px — code/monospace */
  code: 11,
  /** 12px — caption (metadata, timestamps) */
  caption: 12,
  /** 13px — label (sous-titres, hints, tags) */
  label: 13,
  /** 14px — body small (champs formulaire, boutons secondaires) */
  sm: 14,
  /** 15px — body (texte principal, inputs) */
  body: 15,
  /** 16px — body large (texte card principal) */
  lg: 16,
  /** 17px — sous-titre (header modal) */
  subtitle: 17,
  /** 18px — heading petit (titre section) */
  heading: 18,
  /** 20px — heading (titre modal, titre page) */
  title: 20,
  /** 22px — heading large (titre principal) */
  titleLg: 22,
  /** 24px — display petit */
  display: 24,
  /** 28px — emoji/icône large */
  icon: 28,
  /** 32px — display hero */
  hero: 32,
} as const;

export const FontWeight = {
  normal:   '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
  heavy:    '800' as const,
};

export const LineHeight = {
  tight:  18,
  normal: 20,
  body:   22,
  loose:  26,
  title:  28,
} as const;

export type FontSizeKey = keyof typeof FontSize;

/**
 * FontFamily — fonts brand chargées dans `app/_layout.tsx` via @expo-google-fonts.
 * Fallback système si la charge échoue (ne jamais bloquer le rendu).
 *
 *   serif     → DM Serif Display 400. Titres section, hero, ancres ("Tâches",
 *               "Aujourd'hui", chiffres hero).
 *   handwrite → Caveat 400/600. Voix tendre, sous-titres, footers, empty
 *               states, mascotte ("bonjour Gabriel", "il reste un tiers").
 *   sans      → undefined → laisse le système choisir (San Francisco / Roboto)
 *               pour 95 % du body. Centralisé ici pour swap facile plus tard.
 */
export const FontFamily = {
  serif:             'DMSerifDisplay_400Regular',
  handwrite:         'Caveat_400Regular',
  handwriteSemibold: 'Caveat_600SemiBold',
} as const;
