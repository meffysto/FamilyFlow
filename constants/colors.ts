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
  // Misc
  overlay:     'rgba(0,0,0,0.5)',
  overlayLight:'rgba(0,0,0,0.4)',
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
  // Misc
  overlay:     'rgba(0,0,0,0.75)',
  overlayLight:'rgba(0,0,0,0.6)',
  switchOff:   '#334155',
};

export type AppColors = typeof LightColors;
