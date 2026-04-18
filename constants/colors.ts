/**
 * colors.ts — Semantic color palettes for light and dark mode
 *
 * Usage: const { colors } = useThemeColors();
 */

export const LightColors = {
  // Backgrounds — sable clair chaleureux (bon contraste avec cartes blanches)
  bg:          '#EDEAE4',
  card:        '#FFFFFF',
  cardAlt:     '#F9F8F5',
  // Text
  text:        '#1A1A2E',
  textSub:     '#3D3D56',
  textMuted:   '#6B7280',
  textFaint:   '#9CA3AF',
  // Borders & separators
  border:      '#DDD8D0',
  borderLight: '#EDE9E3',
  separator:   '#D0CBC3',
  // Inputs
  inputBg:     '#F9F8F5',
  inputBorder: '#D0CBC3',
  // Tab bar
  tabBar:      '#FFFFFF',
  tabBarBorder:'#DDD8D0',
  tabBarOff:   '#6B7280',
  // Status — error
  error:       '#EF4444',
  errorBg:     '#FEE2E2',
  errorText:   '#991B1B',
  // Status — warning
  warning:     '#F59E0B',
  warningBg:   '#FEF3C7',
  warningText: '#92400E',
  // Status — success
  success:     '#10B981',
  successBg:   '#D1FAE5',
  successText: '#15803D',
  // Status — info
  info:        '#8B5CF6',
  infoBg:      '#EDE9FE',
  // On primary (texte sur fond primary)
  onPrimary:      '#FFFFFF',
  onPrimaryMuted: '#C4B5FD',
  // Tags
  tagMention:     '#FEF3C7',
  tagMentionText: '#D97706',
  // Accent — pink (souvenirs, etc.)
  accentPink:     '#EC4899',
  accentPinkBg:   '#FCE7F3',
  accentPinkText: '#9D174D',
  // Misc
  overlay:     'rgba(0,0,0,0.5)',
  overlayLight:'rgba(0,0,0,0.4)',
  switchOff:   '#E5E7EB',
  // Glass / Liquid Glass
  glassBg:     'rgba(255,255,255,0.65)',
  glassBorder: 'rgba(255,255,255,0.45)',
  glassShadow: 'rgba(0,0,0,0.08)',
  // ── Couleurs d'accent par catégorie (partagées menu + dashboard) ──
  catOrganisation:       '#0D9488',  // teal
  catSante:              '#9333EA',  // violet
  catSouvenirs:          '#E87B35',  // orange doré
  catJeux:               '#16A34A',  // vert
  catFamille:            '#DB2777',  // rose
  catSysteme:            '#6B7280',  // gris neutre
  // Gradients par section (menu)
  gradientOrganisation:  ['#E0F7F4', '#D4F1EC'] as readonly [string, string],
  gradientSante:         ['#F3E8F9', '#EDDFFA'] as readonly [string, string],
  gradientSouvenirs:     ['#FFF0E0', '#FDEBD2'] as readonly [string, string],
  gradientJeux:          ['#E8F5E9', '#DEF0DF'] as readonly [string, string],
  gradientFamille:       ['#FDE8F0', '#FAE0EA'] as readonly [string, string],
  gradientSysteme:       ['#F0EEF6', '#EAE8F2'] as readonly [string, string],
  // Tag colors (badges tâches) — clés sémantiques
  tagColors: {
    bleu:   '#60A5FA',
    vert:   '#34D399',
    jaune:  '#F59E0B',
    rouge:  '#EF4444',
    violet: '#8B5CF6',
  },
  // Market trend colors (O&D marché village)
  trendColors: {
    tres_cher: '#EF4444',
    cher:      '#F97316',
    normal:    '#6B7280',
    bon_prix:  '#10B981',
    brade:     '#3B82F6',
  },
  // Market stock colors (niveau de stock marché)
  stockColors: {
    rupture:  '#EF4444',
    faible:   '#F97316',
    normal:   '#6B7280',
    abondant: '#10B981',
  },
};

export const DarkColors: typeof LightColors = {
  // Backgrounds — noir chaud (pas de bleu froid)
  bg:          '#12151A',
  card:        '#1C1F28',
  cardAlt:     '#1C1F28',
  text:        '#F0EDE8',
  textSub:     '#C8C4BC',
  textMuted:   '#8A8680',
  textFaint:   '#5C5955',
  border:      '#2A2D35',
  borderLight: '#1C1F28',
  separator:   '#3A3D45',
  inputBg:     '#12151A',
  inputBorder: '#3A3D45',
  tabBar:      '#1C1F28',
  tabBarBorder:'#2A2D35',
  tabBarOff:   '#8A8680',
  // Status — error
  error:       '#F87171',
  errorBg:     '#7F1D1D',
  errorText:   '#FCA5A5',
  // Status — warning
  warning:     '#FBBF24',
  warningBg:   '#78350F',
  warningText: '#FDE68A',
  // Status — success
  success:     '#34D399',
  successBg:   '#064E3B',
  successText: '#A7F3D0',
  // Status — info
  info:        '#A78BFA',
  infoBg:      '#3B0764',
  // On primary
  onPrimary:      '#FFFFFF',
  onPrimaryMuted: '#C4B5FD',
  // Tags
  tagMention:     '#78350F',
  tagMentionText: '#FBBF24',
  // Accent — pink (souvenirs, etc.)
  accentPink:     '#F472B6',
  accentPinkBg:   '#831843',
  accentPinkText: '#FBCFE8',
  // Misc
  overlay:     'rgba(0,0,0,0.75)',
  overlayLight:'rgba(0,0,0,0.6)',
  switchOff:   '#334155',
  // Glass / Liquid Glass
  glassBg:     'rgba(28,31,40,0.65)',
  glassBorder: 'rgba(138,134,128,0.2)',
  glassShadow: 'rgba(0,0,0,0.3)',
  // ── Couleurs d'accent par catégorie (partagées menu + dashboard) ──
  catOrganisation:       '#2DD4BF',  // teal clair
  catSante:              '#A78BFA',  // violet clair
  catSouvenirs:          '#FBBF24',  // doré
  catJeux:               '#4ADE80',  // vert clair
  catFamille:            '#F472B6',  // rose clair
  catSysteme:            '#8A8680',  // gris chaud
  // Gradients par section (menu) — tons assombris chaleureux
  gradientOrganisation:  ['#162A28', '#1A2E2C'] as readonly [string, string],
  gradientSante:         ['#231A2D', '#271E30'] as readonly [string, string],
  gradientSouvenirs:     ['#2A2218', '#2E251A'] as readonly [string, string],
  gradientJeux:          ['#1A2A1C', '#1E2E1F'] as readonly [string, string],
  gradientFamille:       ['#2A1A22', '#2E1E26'] as readonly [string, string],
  gradientSysteme:       ['#1E1E24', '#222228'] as readonly [string, string],
  // Tag colors (badges tâches) — variantes dark plus lumineuses
  tagColors: {
    bleu:   '#93C5FD',
    vert:   '#6EE7B7',
    jaune:  '#FCD34D',
    rouge:  '#FCA5A5',
    violet: '#C4B5FD',
  },
  // Market trend colors — variantes dark plus lumineuses
  trendColors: {
    tres_cher: '#FCA5A5',
    cher:      '#FDBA74',
    normal:    '#9CA3AF',
    bon_prix:  '#6EE7B7',
    brade:     '#93C5FD',
  },
  // Market stock colors — variantes dark plus lumineuses
  stockColors: {
    rupture:  '#FCA5A5',
    faible:   '#FDBA74',
    normal:   '#9CA3AF',
    abondant: '#6EE7B7',
  },
};

export type AppColors = typeof LightColors;
