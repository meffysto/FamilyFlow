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
  // Text — teintes warm bois pour cohérence brand, contrastes WCAG AA validés sur bg #EDEAE4
  text:        '#1A1A2E',
  textSub:     '#3D3D56',
  textMuted:   '#5C544A',  // 6.30:1 (warm dark gray)
  textFaint:   '#75695C',  // 4.51:1 (warm faint gray)
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
  // Status — error (warm brick red, brand-aligned, 4.80:1 sur bg light)
  error:       '#B0413A',
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
  overlay:     'rgba(0,0,0,0.5)',     // scrim modal plein
  overlayLight:'rgba(0,0,0,0.05)',    // bordure/ligne fine sur fond clair
  onAccent:    '#FFFFFF',             // texte/icône sur fond accent (toujours blanc)
  switchOff:   '#E5E7EB',
  // Glass / Liquid Glass
  glassBg:     'rgba(255,255,255,0.65)',
  glassBorder: 'rgba(255,255,255,0.45)',
  glassShadow: 'rgba(0,0,0,0.08)',
  // ── Couleurs d'accent par catégorie (partagées menu + dashboard) ──
  // Palette warm brand : mousse / prune / ocre / vert ferme / terracotta / faint warm.
  catOrganisation:       '#5C6F3F',  // mousse foncée (light mode — contraste AA sur bg crème)
  catSante:              '#5E4453',  // prune sourde foncée
  catSouvenirs:          '#9E7A35',  // ocre foncé
  catJeux:               '#3F6C2D',  // vert ferme foncé
  catFamille:            '#8E3F26',  // terracotta foncée
  catSysteme:            '#75695C',  // gris warm
  // Gradients par section (menu) — washes warm sourds, pas Tailwind candy
  gradientOrganisation:  ['#EAEFE0', '#E0E8D2'] as readonly [string, string],
  gradientSante:         ['#EFE6EC', '#E8DCE3'] as readonly [string, string],
  gradientSouvenirs:     ['#FBF2DE', '#F5E8C9'] as readonly [string, string],
  gradientJeux:          ['#E8EFDF', '#DDE8D0'] as readonly [string, string],
  gradientFamille:       ['#F5E2D8', '#EDD3C6'] as readonly [string, string],
  gradientSysteme:       ['#EEEAE2', '#E4DED4'] as readonly [string, string],
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
  // Météo (progression tâches enfants — du sombre au lumineux)
  weather: {
    stormy: '#4B5563',
    cloudy: '#6B7280',
    partly: '#93C5FD',
    sunny:  '#FDE68A',
    bright: '#C4B5FD',
  },
  // Loot box rarities (visuels HarvestBurst)
  loot: {
    golden: '#FFD700',
    rare:   '#A78BFA',
    common: '#34D399',
  },
  // Brand — identité FamilyFlow (bois/parchemin/artisanal)
  // Tokens fixes, indépendants des thèmes de profil enfant
  brand: {
    soil:       '#6B4226',
    soilMuted:  '#A0784C',
    parchment:  '#FFF8EC',
    cardSurface: '#FFF8EC',  // parchemin en light — surface dashboard card
    bark:       'rgba(107,66,38,0.18)',
    wash:       'rgba(107,66,38,0.07)',
    miel:       '#FFF4DA',
    or:         '#E8C858',
    orDeep:     '#C49A4A',
    nuit:       '#1A1A2E',
    nuitSoft:   '#3D3D56',
  },
};

export const DarkColors: typeof LightColors = {
  // Backgrounds — noir chaud (pas de bleu froid)
  bg:          '#12151A',
  card:        '#1C1F28',
  cardAlt:     '#1C1F28',
  text:        '#F0EDE8',
  textSub:     '#C8C4BC',
  textMuted:   '#8A8680',  // 4.99:1 sur bg dark
  textFaint:   '#827E78',  // 4.55:1 sur bg dark
  border:      '#2A2D35',
  borderLight: '#1C1F28',
  separator:   '#3A3D45',
  inputBg:     '#12151A',
  inputBorder: '#3A3D45',
  tabBar:      '#1C1F28',
  tabBarBorder:'#2A2D35',
  tabBarOff:   '#8A8680',
  // Status — error (warm brick red, brand-aligned, 6.08:1 sur bg dark)
  error:       '#E0786E',
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
  overlay:     'rgba(0,0,0,0.7)',     // scrim modal plein
  overlayLight:'rgba(255,255,255,0.08)', // bordure/ligne fine sur fond sombre
  onAccent:    '#FFFFFF',             // texte/icône sur fond accent (toujours blanc)
  switchOff:   '#334155',
  // Glass / Liquid Glass
  glassBg:     'rgba(28,31,40,0.65)',
  glassBorder: 'rgba(138,134,128,0.2)',
  glassShadow: 'rgba(0,0,0,0.3)',
  // ── Couleurs d'accent par catégorie (partagées menu + dashboard) ──
  // Palette warm brand — variantes dark plus claires pour rester lisibles sur bg sombre
  catOrganisation:       '#9DAE7E',  // mousse claire
  catSante:              '#A88DA0',  // prune claire
  catSouvenirs:          '#D9B776',  // ocre clair
  catJeux:               '#8BC470',  // vert ferme clair
  catFamille:            '#D08A6E',  // terracotta claire
  catSysteme:            '#A89C8A',  // warm gris clair
  // Gradients par section (menu) — tons assombris warm (bois/forêt/parchemin)
  gradientOrganisation:  ['#1F261C', '#232B20'] as readonly [string, string],
  gradientSante:         ['#241D22', '#282026'] as readonly [string, string],
  gradientSouvenirs:     ['#2A2218', '#2E261A'] as readonly [string, string],
  gradientJeux:          ['#1F2A1A', '#232E1E'] as readonly [string, string],
  gradientFamille:       ['#2B1F1A', '#2F231E'] as readonly [string, string],
  gradientSysteme:       ['#23211D', '#272521'] as readonly [string, string],
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
  // Météo — gris dark un peu plus clairs pour rester visibles sur fond sombre
  weather: {
    stormy: '#9CA3AF',
    cloudy: '#B0B6BF',
    partly: '#93C5FD',
    sunny:  '#FDE68A',
    bright: '#C4B5FD',
  },
  // Loot box rarities — restent vifs en dark
  loot: {
    golden: '#FFD700',
    rare:   '#C4B5FD',
    common: '#6EE7B7',
  },
  // Brand — identité FamilyFlow (bois/parchemin/artisanal)
  // Tokens fixes, indépendants des thèmes de profil enfant
  brand: {
    soil:       '#8B6238',
    soilMuted:  '#9B7654',
    parchment:  '#F5EFE5',          // reste cream — pour pills/buttons/FAB qui pop sur dark
    cardSurface: '#231F1A',         // warm brown-dark surface — pour grosses cards dashboard
    bark:       'rgba(196,162,101,0.15)',
    wash:       'rgba(196,162,101,0.08)',
    miel:       '#3A3326',          // dark mode : miel fonce → gris-or chaud lisible
    or:         '#E8C858',
    orDeep:     '#C49A4A',
    nuit:       '#0F0F1F',
    nuitSoft:   '#2A2A3D',
  },
};

export type AppColors = typeof LightColors;
