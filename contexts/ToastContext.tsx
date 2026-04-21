/**
 * ToastContext.tsx — Système de notifications toast léger
 *
 * Usage :
 *   const { showToast } = useToast();
 *   showToast('Tâche ajoutée !');
 *   showToast('Erreur réseau', 'error');
 *   showToast('Article retiré', 'success', { label: 'Annuler', onPress: undo });
 *   showToast('Récolte !', 'success', undefined, { icon: '🌾', subtitle: '+40 🍂' });
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
import { useThemeColors } from './ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
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
  /** Emoji affiché à gauche — si absent, utilise l'emoji du type */
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
  success: '✅',
  error: '❌',
  info: 'ℹ️',
};

const AUTO_DISMISS_MS = 2500;
const UNDO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { primary, colors } = useThemeColors();
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
    // L'animation de sortie est gérée dans RewardCardToast via la prop visible=false
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
    // Délai pour laisser l'animation de sortie se terminer
    setTimeout(() => {
      setHarvestItems([]);
      setHarvestHasLoot(false);
    }, 400);
  }, []);

  const showHarvestCard = useCallback((item: HarvestItem, hasLoot?: boolean) => {
    // Clear timer précédent
    if (harvestTimerRef.current) {
      clearTimeout(harvestTimerRef.current);
      harvestTimerRef.current = null;
    }

    // Merge items : même emoji = additionner qty, sinon nouveau chip.
    // Préfère le wager du nouvel item (écrase si différent — cas rare mais correct).
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

    // Afficher si pas encore visible
    if (!harvestVisibleRef.current) {
      harvestVisibleRef.current = true;
      setHarvestVisible(true);
    }

    // Incrémenter sparkleKey pour re-trigger sparkles + pulse
    setHarvestSparkleKey(k => k + 1);

    // Reset timer 3s
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

  const getToastColors = (type: ToastType) => {
    switch (type) {
      case 'success': return { bg: colors.successBg, text: colors.successText };
      case 'error':   return { bg: colors.errorBg,   text: colors.errorText };
      case 'info':    return { bg: colors.infoBg,     text: primary };
    }
  };

  const toastColors = toast ? getToastColors(toast.type) : null;
  const icon = toast?.options?.icon ?? (toast ? TYPE_ICON[toast.type] : '');

  return (
    <ToastContext.Provider value={{ showToast, showRewardCard, showHarvestCard }}>
      {children}
      {toast && toastColors && (
        <Animated.View
          pointerEvents={toast.action ? 'box-none' : 'none'}
          style={[
            styles.container,
            { top: insets.top + Spacing.md },
            animatedStyle,
          ]}
        >
          <View
            style={[
              styles.toast,
              { backgroundColor: toastColors.bg, borderColor: toastColors.text + '33' },
            ]}
          >
            <Text style={styles.icon} numberOfLines={1}>{icon}</Text>
            <View style={styles.textCol}>
              <Text style={[styles.message, { color: toastColors.text }]} numberOfLines={2}>
                {toast.message}
              </Text>
              {toast.options?.subtitle && (
                <Text style={[styles.subtitle, { color: toastColors.text }]} numberOfLines={1}>
                  {toast.options.subtitle}
                </Text>
              )}
            </View>
            {toast.action && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: toastColors.text }]}
                onPress={handleActionPress}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.actionText, { color: toastColors.text }]}>
                  {toast.action.label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing['2xl'],
    right: Spacing['2xl'],
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    fontSize: 22,
    lineHeight: 26,
  },
  textCol: {
    flex: 1,
    gap: 1,
  },
  message: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    opacity: 0.8,
  },
  actionBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  actionText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
});
