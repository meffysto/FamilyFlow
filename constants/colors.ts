/**
 * colors.ts — Semantic color palettes for light and dark mode
 *
 * Usage: const { colors } = useThemeColors();
 */

export const LightColors = {
  // Backgrounds
  bg:          '#F3F4F6',
  card:        '#FFFFFF',
  cardAlt:     '#F9FAFB',
  // Text
  text:        '#111827',
  textSub:     '#374151',
  textMuted:   '#6B7280',
  textFaint:   '#9CA3AF',
  // Borders & separators
  border:      '#E5E7EB',
  borderLight: '#F3F4F6',
  separator:   '#D1D5DB',
  // Inputs
  inputBg:     '#F9FAFB',
  inputBorder: '#D1D5DB',
  // Tab bar
  tabBar:      '#FFFFFF',
  tabBarBorder:'#E5E7EB',
  tabBarOff:   '#6B7280',
  // Misc
  overlay:     'rgba(0,0,0,0.5)',
  switchOff:   '#E5E7EB',
};

export const DarkColors: typeof LightColors = {
  bg:          '#0F172A',
  card:        '#1E293B',
  cardAlt:     '#1E293B',
  text:        '#F1F5F9',
  textSub:     '#CBD5E1',
  textMuted:   '#94A3B8',
  textFaint:   '#475569',
  border:      '#334155',
  borderLight: '#1E293B',
  separator:   '#475569',
  inputBg:     '#0F172A',
  inputBorder: '#475569',
  tabBar:      '#1E293B',
  tabBarBorder:'#334155',
  tabBarOff:   '#94A3B8',
  overlay:     'rgba(0,0,0,0.75)',
  switchOff:   '#334155',
};

export type AppColors = typeof LightColors;
