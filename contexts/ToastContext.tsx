/**
 * ToastContext.tsx — Système de notifications toast léger
 *
 * Usage :
 *   const { showToast } = useToast();
 *   showToast('Tâche ajoutée !');
 *   showToast('Erreur réseau', 'error');
 *   showToast('Synchronisation en cours', 'info');
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from './ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

const TOAST_EMOJI: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
};

const AUTO_DISMISS_MS = 2500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { primary, colors } = useThemeColors();

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    translateY.value = withTiming(-120, { duration: 250 });
    opacity.value = withTiming(0, { duration: 250 });
    // Nettoyer le state après l'animation de sortie
    setTimeout(() => setToast(null), 300);
  }, [translateY, opacity]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      // Annuler le timer précédent si un toast est déjà visible
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Remplacer immédiatement le toast courant
      setToast({ message, type });

      // Réinitialiser la position avant d'animer l'entrée
      translateY.value = -120;
      opacity.value = 0;

      // Animer l'entrée avec un spring
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-dismiss après délai
      timerRef.current = setTimeout(() => {
        hide();
        timerRef.current = null;
      }, AUTO_DISMISS_MS);
    },
    [translateY, opacity, hide],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
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

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && toastColors && (
        <Animated.View
          pointerEvents="none"
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
            ]}
          >
            <Text style={[styles.message, { color: toastColors.text }]}>
              {TOAST_EMOJI[toast.type]} {toast.message}
            </Text>
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
  message: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
});
