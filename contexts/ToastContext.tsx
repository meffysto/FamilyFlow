/**
 * ToastContext.tsx — Système de notifications toast léger
 *
 * Usage :
 *   const { showToast } = useToast();
 *   showToast('Tâche ajoutée !');
 *   showToast('Erreur réseau', 'error');
 *   showToast('Article retiré', 'success', { label: 'Annuler', onPress: undo });
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from './ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastOptions {
  /** Grand emoji affiché à gauche (layout riche) — ex. '🌾' pour une récolte */
  icon?: string;
  /** Sous-titre affiché sous le message (layout riche) — ex. '+40 🍂' */
  subtitle?: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

const TOAST_EMOJI: Record<ToastType, string> = {
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
      // Nettoyer le state après l'animation de sortie
      setTimeout(() => setToast(null), 300);
    }
  }, [translateY, opacity, scale, reduceMotion]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction, options?: ToastOptions) => {
      // Annuler le timer précédent si un toast est déjà visible
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Remplacer immédiatement le toast courant
      setToast({ message, type, action, options });

      // Réinitialiser la position avant d'animer l'entrée
      translateY.value = -120;
      opacity.value = 0;
      scale.value = 0.9;

      // Animer l'entrée (instantané si reduceMotion)
      if (reduceMotion) {
        translateY.value = 0;
        opacity.value = 1;
        scale.value = 1;
      } else {
        translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
        opacity.value = withTiming(1, { duration: 200 });
        // Rebond plus marqué pour les toasts riches (récoltes, etc.)
        scale.value = withSpring(1, { damping: 10, stiffness: 180 });
      }

      // Auto-dismiss (plus long si action undo)
      const delay = action ? UNDO_DISMISS_MS : AUTO_DISMISS_MS;
      timerRef.current = setTimeout(() => {
        hide();
        timerRef.current = null;
      }, delay);
    },
    [translateY, opacity, scale, reduceMotion, hide],
  );

  const handleActionPress = useCallback(() => {
    if (toast?.action) {
      toast.action.onPress();
    }
    // Fermer le toast immédiatement
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
      case 'success':
        return { bg: colors.successBg, text: colors.successText };
      case 'error':
        return { bg: colors.errorBg, text: colors.errorText };
      case 'info':
        return { bg: colors.infoBg, text: primary };
    }
  };

  const toastColors = toast ? getToastColors(toast.type) : null;
  const isRich = !!toast?.options?.icon;

  return (
    <ToastContext.Provider value={{ showToast }}>
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
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: toastColors.bg },
              toast.action && styles.toastWithAction,
              isRich && styles.toastRich,
              isRich && { borderColor: toastColors.text },
            ]}
          >
            {isRich ? (
              <>
                <Text style={styles.richIcon} numberOfLines={1}>
                  {toast.options!.icon}
                </Text>
                <View style={styles.richTextCol}>
                  <Text
                    style={[styles.richTitle, { color: toastColors.text }]}
                    numberOfLines={1}
                  >
                    {toast.message}
                  </Text>
                  {toast.options?.subtitle && (
                    <Text
                      style={[styles.richSubtitle, { color: toastColors.text }]}
                      numberOfLines={1}
                    >
                      {toast.options.subtitle}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <Text
                style={[
                  styles.message,
                  { color: toastColors.text },
                  toast.action && styles.messageWithAction,
                ]}
                numberOfLines={2}
              >
                {TOAST_EMOJI[toast.type]} {toast.message}
              </Text>
            )}
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
          </Animated.View>
        </Animated.View>
      )}
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
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    // Shadow iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // Shadow Android
    elevation: 6,
  },
  toastWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xl,
  },
  toastRich: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderWidth: 1.5,
    // Ombre plus marquée pour effet "célébration"
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  richIcon: {
    fontSize: 36,
    lineHeight: 40,
  },
  richTextCol: {
    flex: 1,
    gap: 2,
  },
  richTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  richSubtitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    opacity: 0.85,
  },
  message: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  messageWithAction: {
    textAlign: 'left',
    flex: 1,
  },
  actionBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  actionText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
});
