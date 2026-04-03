/**
 * spacing.ts — Design tokens pour espacement et border radius
 *
 * Échelle sur base 4px. Usage :
 *   import { Spacing, Radius } from '../constants/spacing';
 *   { padding: Spacing.md, borderRadius: Radius.md }
 */

export const Spacing = {
  /** 2px — micro espacement (icône-texte inline) */
  xxs: 2,
  /** 4px — très petit (padding bouton compact, gap inline) */
  xs: 4,
  /** 6px — petit intermédiaire */
  sm: 6,
  /** 8px — petit (padding badge, gap liste) */
  md: 8,
  /** 10px — intermédiaire */
  lg: 10,
  /** 12px — standard (padding card interne, gap sections) */
  xl: 12,
  /** 16px — grand (padding écran horizontal, margin sections) */
  '2xl': 16,
  /** 20px — extra (padding modal, séparations majeures) */
  '3xl': 20,
  /** 24px — double (padding safe area, margin écran) */
  '4xl': 24,
  /** 32px — triple (espacement sections majeures) */
  '5xl': 32,
  /** 48px — quadruple (header, hero spacing) */
  '6xl': 48,
} as const;

export const Radius = {
  /** 2px — minimal (progress bars, dividers) */
  xxs: 2,
  /** 4px — subtil (badges, tags) */
  xs: 4,
  /** 6px — petit (inputs, chips) */
  sm: 6,
  /** 8px — standard (cards, boutons) */
  md: 8,
  /** 10px — intermédiaire (boutons actions, inputs larges) */
  base: 10,
  /** 12px — moyen (modals, cards larges) */
  lg: 12,
  /** 14px — semi-grand (cartes accentuées) */
  'lg+': 14,
  /** 16px — grand (bottom sheet, cartes hero) */
  xl: 16,
  /** 20px — extra (cards proéminentes, FAB actions) */
  '2xl': 20,
  /** 24px — hero (modals plein, picker overlay) */
  '3xl': 24,
  /** 9999px — pill (boutons ronds, avatars) */
  full: 9999,
} as const;

/** Contrainte iPad — invisible sur iPhone, centre le contenu sur tablette */
export const Layout = {
  /** Largeur max du contenu principal (700px) */
  maxContentWidth: 700,
  /** Style à appliquer sur le contentContainerStyle du ScrollView/List principal */
  contentContainer: {
    width: '100%' as const,
    maxWidth: 700,
    alignSelf: 'center' as const,
  },
} as const;

export type SpacingKey = keyof typeof Spacing;
export type RadiusKey = keyof typeof Radius;
