/**
 * ToastContext.tsx — Système de notifications toast (brand-aligned)
 *
 * Usage :
 *   const { showToast } = useToast();
 *   showToast('Tâche ajoutée !');
 *   showToast('Erreur réseau', 'error');
 *   showToast('Article retiré', 'success', { label: 'Annuler', onPress: undo });
 *   showToast('Récolte !', 'success', undefined, { icon: '🌾', subtitle: '+40 🍂' });
 *
 * Deux variantes visuelles automatiques :
 * - V1 "Tag parchemin" — toasts utilitaires (90% des usages)
 * - V2 "Sceau de cire" — toasts à valeur (icon + subtitle présents : récoltes,
 *   gains XP, niveaux, défis complétés, découvertes rares…)
 *
 * Routage automatique : si options.icon ET options.subtitle sont fournis,
 * la variante V2 est utilisée. Sinon V1.
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from './ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, FontFamily } from '../constants/typography';
import { RewardCardToast } from '../components/gamification/RewardCardToast';
import type { RewardCardData } from '../components/gamification/RewardCardToast';
import { HarvestCardToast } from '../components/gamification/HarvestCardToast';
import type { HarvestItem } from '../components/gamification/HarvestCardToast';

export type { HarvestItem } from '../components/gamification/HarvestCardToast';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastOptions {
  /** Emoji ou symbole affiché à gauche — si absent, utilise l'icône du type */
  icon?: string;
  /** Sous-titre affiché sous le message */
  subtitle?: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction, options?: ToastOptions) => void;
  showRewardCard: (data: RewardCardData) => void;
  showHarvestCard: (item: HarvestItem, hasLoot?: boolean) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {}, showRewardCard: () => {}, showHarvestCard: () => {} });

const TYPE_ICON: Record<ToastType, string> = {
  success: '✓',
  error: '!',
  info: '↺',
};

// ─── Palette toast brand-warmée ───────────────────────────────────────────
// Locales au composant — n'écrase pas les tokens globaux (utilisés ailleurs)
interface ToastPalette {
  bg: string;            // fond V1
  bgGradient: [string, string]; // fond V2 (parchemin → miel teinté)
  strip: string;         // bandeau V1 + sceau V2
  stripDeep: string;     // halo / shadow sceau V2
  iconBg: string;        // disque V1
  iconText: string;      // glyph dans disque
  text: string;          // message principal
  textSub: string;       // subtitle
  actionFg: string;      // pilule action
  actionBorder: string;
}

const LIGHT_PALETTES: Record<ToastType, ToastPalette> = {
  success: {
    bg:          '#FFF8EC',
    bgGradient:  ['#FFF8EC', '#F1E8CC'],
    strip:       '#5B7A4A',  // sapin warm
    stripDeep:   '#3F5A30',
    iconBg:      '#5B7A4A',
    iconText:    '#FFF8EC',
    text:        '#2A1F14',
    textSub:     '#6B5640',
    actionFg:    '#3F5A30',
    actionBorder:'#5B7A4A',
  },
  error: {
    bg:          '#FFF8EC',
    bgGradient:  ['#FFF8EC', '#F7E0D7'],
    strip:       '#B5503D',  // brick brand
    stripDeep:   '#7E2E1F',
    iconBg:      '#B5503D',
    iconText:    '#FFF8EC',
    text:        '#2A1F14',
    textSub:     '#7E2E1F',
    actionFg:    '#7E2E1F',
    actionBorder:'#B5503D',
  },
  info: {
    bg:          '#FFF8EC',
    bgGradient:  ['#FFF8EC', '#FFF4DA'],
    strip:       '#E8C858',  // or
    stripDeep:   '#C49A4A',
    iconBg:      '#E8C858',
    iconText:    '#4A2E1A',
    text:        '#2A1F14',
    textSub:     '#6B5640',
    actionFg:    '#6B4226',
    actionBorder:'#C49A4A',
  },
};

const DARK_PALETTES: Record<ToastType, ToastPalette> = {
  success: {
    bg:          '#1F2419',
    bgGradient:  ['#1F2419', '#2A3322'],
    strip:       '#7AA063',
    stripDeep:   '#5B7A4A',
    iconBg:      '#5B7A4A',
    iconText:    '#E8EFD9',
    text:        '#F0EDE8',
    textSub:     '#C7D8B5',
    actionFg:    '#C7E1A8',
    actionBorder:'#7AA063',
  },
  error: {
    bg:          '#241813',
    bgGradient:  ['#241813', '#3A1F18'],
    strip:       '#D27866',
    stripDeep:   '#B5503D',
    iconBg:      '#B5503D',
    iconText:    '#FFF8EC',
    text:        '#F0EDE8',
    textSub:     '#F0BBAA',
    actionFg:    '#F0BBAA',
    actionBorder:'#D27866',
  },
  info: {
    bg:          '#1F1A12',
    bgGradient:  ['#1F1A12', '#2E2616'],
    strip:       '#E8C858',
    stripDeep:   '#C49A4A',
    iconBg:      '#E8C858',
    iconText:    '#4A2E1A',
    text:        '#F0EDE8',
    textSub:     '#E0CFA0',
    actionFg:    '#F0DA90',
    actionBorder:'#C49A4A',
  },
};

const AUTO_DISMISS_MS = 2500;
const UNDO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeColors();
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  const [toast, setToast] = useState<{ message: string; type: ToastType; action?: ToastAction; options?: ToastOptions } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Reward Card ─────────────────────────────────────────────────────────
  const [rewardCard, setRewardCard] = useState<RewardCardData | null>(null);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Harvest Card ─────────────────────────────────────────────────────────
  const [harvestItems, setHarvestItems] = useState<HarvestItem[]>([]);
  const [harvestVisible, setHarvestVisible] = useState(false);
  const [harvestHasLoot, setHarvestHasLoot] = useState(false);
  const [harvestSparkleKey, setHarvestSparkleKey] = useState(0);
  const harvestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const harvestVisibleRef = useRef(false);

  const hide = useCallback(() => {
    if (reduceMotion) {
      translateY.value = -120;
      opacity.value = 0;
      scale.value = 0.9;
      setToast(null);
    } else {
      translateY.value = withTiming(-120, { duration: 250 });
      opacity.value = withTiming(0, { duration: 250 });
      scale.value = withTiming(0.9, { duration: 250 });
      setTimeout(() => setToast(null), 300);
    }
  }, [translateY, opacity, scale, reduceMotion]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction, options?: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setToast({ message, type, action, options });

      translateY.value = -120;
      opacity.value = 0;
      scale.value = 0.9;

      if (reduceMotion) {
        translateY.value = 0;
        opacity.value = 1;
        scale.value = 1;
      } else {
        translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
        opacity.value = withTiming(1, { duration: 200 });
        scale.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      }

      const delay = action ? UNDO_DISMISS_MS : AUTO_DISMISS_MS;
      timerRef.current = setTimeout(() => {
        hide();
        timerRef.current = null;
      }, delay);
    },
    [translateY, opacity, scale, reduceMotion, hide],
  );

  const hideRewardCard = useCallback(() => {
    if (rewardTimerRef.current) {
      clearTimeout(rewardTimerRef.current);
      rewardTimerRef.current = null;
    }
    setTimeout(() => setRewardCard(null), 400);
  }, []);

  const showRewardCard = useCallback((data: RewardCardData) => {
    if (rewardTimerRef.current) {
      clearTimeout(rewardTimerRef.current);
      rewardTimerRef.current = null;
    }
    setRewardCard(data);
    rewardTimerRef.current = setTimeout(() => {
      hideRewardCard();
      rewardTimerRef.current = null;
    }, 3000);
  }, [hideRewardCard]);

  const hideHarvestCard = useCallback(() => {
    if (harvestTimerRef.current) {
      clearTimeout(harvestTimerRef.current);
      harvestTimerRef.current = null;
    }
    harvestVisibleRef.current = false;
    setHarvestVisible(false);
    setTimeout(() => {
      setHarvestItems([]);
      setHarvestHasLoot(false);
    }, 400);
  }, []);

  const showHarvestCard = useCallback((item: HarvestItem, hasLoot?: boolean) => {
    if (harvestTimerRef.current) {
      clearTimeout(harvestTimerRef.current);
      harvestTimerRef.current = null;
    }
    setHarvestItems(prev => {
      const existing = prev.find(i => i.emoji === item.emoji);
      if (existing) {
        return prev.map(i => i.emoji === item.emoji
          ? { ...i, qty: i.qty + item.qty, wager: item.wager ?? i.wager, grade: item.grade ?? i.grade }
          : i);
      }
      return [...prev, item];
    });

    if (hasLoot) setHarvestHasLoot(true);

    if (!harvestVisibleRef.current) {
      harvestVisibleRef.current = true;
      setHarvestVisible(true);
    }

    setHarvestSparkleKey(k => k + 1);

    harvestTimerRef.current = setTimeout(() => {
      hideHarvestCard();
      harvestTimerRef.current = null;
    }, 3000);
  }, [hideHarvestCard]);

  const handleActionPress = useCallback(() => {
    if (toast?.action) {
      toast.action.onPress();
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    hide();
  }, [toast, hide]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const palette = toast
    ? (isDark ? DARK_PALETTES : LIGHT_PALETTES)[toast.type]
    : null;

  // Routage V1 vs V2 : V2 si l'appel a fourni icon ET subtitle (toasts à valeur)
  const isValueToast = !!(toast?.options?.icon && toast?.options?.subtitle);
  const icon = toast?.options?.icon ?? (toast ? TYPE_ICON[toast.type] : '');

  return (
    <ToastContext.Provider value={{ showToast, showRewardCard, showHarvestCard }}>
      {children}
      {toast && palette && (
        <Animated.View
          pointerEvents={toast.action ? 'box-none' : 'none'}
          style={[
            styles.container,
            { top: insets.top + Spacing.md },
            animatedStyle,
          ]}
        >
          {isValueToast
            ? <ToastSeal toast={toast} palette={palette} icon={icon} onAction={handleActionPress} />
            : <ToastTag toast={toast} palette={palette} icon={icon} onAction={handleActionPress} />}
        </Animated.View>
      )}
      <RewardCardToast
        visible={!!rewardCard}
        data={rewardCard}
        onDismiss={hideRewardCard}
      />
      <HarvestCardToast
        visible={harvestVisible}
        items={harvestItems}
        onDismiss={hideHarvestCard}
        hasLoot={harvestHasLoot}
        sparkleKey={harvestSparkleKey}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ─── V1 — Tag parchemin (utilitaire) ──────────────────────────────────────

interface ToastVariantProps {
  toast: { message: string; type: ToastType; action?: ToastAction; options?: ToastOptions };
  palette: ToastPalette;
  icon: string;
  onAction: () => void;
}

function ToastTag({ toast, palette, icon, onAction }: ToastVariantProps) {
  return (
    <View style={[tagStyles.toast, { backgroundColor: palette.bg, borderColor: palette.strip + '33' }]}>
      <View style={[tagStyles.strip, { backgroundColor: palette.strip }]} />
      <View style={[tagStyles.iconDisc, { backgroundColor: palette.iconBg }]}>
        <Text style={[tagStyles.iconText, { color: palette.iconText }]}>{icon}</Text>
      </View>
      <View style={tagStyles.body}>
        <Text style={[tagStyles.message, { color: palette.text }]} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.options?.subtitle && (
          <Text style={[tagStyles.subtitle, { color: palette.textSub }]} numberOfLines={1}>
            {toast.options.subtitle}
          </Text>
        )}
      </View>
      {toast.action && (
        <TouchableOpacity
          style={[tagStyles.actionBtn, { borderColor: palette.actionBorder }]}
          onPress={onAction}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[tagStyles.actionText, { color: palette.actionFg }]}>
            {toast.action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── V2 — Sceau de cire (toasts de valeur) ────────────────────────────────

function ToastSeal({ toast, palette, icon, onAction }: ToastVariantProps) {
  return (
    <View style={sealStyles.wrap}>
      <LinearGradient
        colors={palette.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={sealStyles.gradientFill}
      />
      {/* Fil or au sommet */}
      <View pointerEvents="none" style={sealStyles.topThread}>
        <LinearGradient
          colors={['transparent', palette.strip, palette.stripDeep, palette.strip, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={sealStyles.row}>
        {/* Sceau */}
        <View style={[sealStyles.seal, { backgroundColor: palette.strip, shadowColor: palette.stripDeep }]}>
          <View style={[sealStyles.sealRing, { borderColor: palette.iconText + '70' }]} />
          <Text style={[sealStyles.sealGlyph, { color: palette.iconText }]}>{icon}</Text>
        </View>

        {/* Body */}
        <View style={sealStyles.body}>
          <Text style={[sealStyles.message, { color: palette.text }]} numberOfLines={2}>
            {toast.message}
          </Text>
          {toast.options?.subtitle && (
            <Text style={[sealStyles.subtitle, { color: palette.textSub }]} numberOfLines={1}>
              {toast.options.subtitle}
            </Text>
          )}
        </View>

        {toast.action && (
          <TouchableOpacity
            style={[sealStyles.actionBtn, { backgroundColor: palette.strip, shadowColor: palette.stripDeep }]}
            onPress={onAction}
            activeOpacity={0.85}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[sealStyles.actionText, { color: palette.iconText }]}>
              {toast.action.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing['2xl'],
    right: Spacing['2xl'],
    zIndex: 9999,
    alignItems: 'center',
  },
});

const tagStyles = StyleSheet.create({
  toast: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  strip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  iconDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.lg + 6,
    marginRight: Spacing.md,
  },
  iconText: {
    fontSize: 17,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingRight: Spacing.md,
  },
  message: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  actionBtn: {
    marginRight: Spacing.md,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  actionText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

const sealStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  gradientFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topThread: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  seal: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  sealRing: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 19,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sealGlyph: {
    fontSize: 19,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontFamily: FontFamily.serif,
    fontSize: 16,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: FontFamily.handwriteSemibold,
    fontSize: 16,
    lineHeight: 18,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  actionText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
