/**
 * LockScreen.tsx — Écran de verrouillage biométrie / PIN
 *
 * Affiché en overlay quand l'app est verrouillée.
 * - Tente la biométrie automatiquement au mount
 * - Pavé numérique PIN 4 chiffres en fallback
 * - Animation shake si PIN incorrect (Reanimated)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';

const PIN_LENGTH = 4;

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['bio', '0', 'del'],
] as const;

export const LockScreen = React.memo(function LockScreen() {
  const { primary, colors } = useThemeColors();
  const { authenticate, verifyPin, biometryAvailable, biometryType } = useAuth();
  const reduceMotion = useReducedMotion();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Animation shake
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // Animation dots scale
  const dotScales = [useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1)];

  // Tenter la biométrie au mount
  const biometryAttempted = useRef(false);
  useEffect(() => {
    if (biometryAvailable && !biometryAttempted.current) {
      biometryAttempted.current = true;
      // Petit délai pour laisser le LockScreen s'afficher
      const timer = setTimeout(() => {
        authenticate();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [biometryAvailable, authenticate]);

  const triggerShake = useCallback(() => {
    if (reduceMotion) return;
    shakeX.value = withSequence(
      withTiming(-12, { duration: 50 }),
      withTiming(12, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeX, reduceMotion]);

  const resetPin = useCallback(() => {
    setPin('');
    setError(false);
  }, []);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === 'del') {
        setPin((prev) => prev.slice(0, -1));
        setError(false);
        return;
      }

      if (key === 'bio') {
        if (biometryAvailable) {
          authenticate();
        }
        return;
      }

      setError(false);
      const newPin = pin + key;
      if (newPin.length <= PIN_LENGTH) {
        setPin(newPin);

        // Animer le dot correspondant
        const idx = newPin.length - 1;
        if (idx >= 0 && idx < 4 && !reduceMotion) {
          dotScales[idx].value = withSequence(
            withSpring(1.4, { damping: 6, stiffness: 400 }),
            withSpring(1, { damping: 8, stiffness: 300 }),
          );
        }

        // Vérifier quand le PIN est complet
        if (newPin.length === PIN_LENGTH) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Petit délai pour voir le dernier dot se remplir
          setTimeout(() => {
            const ok = verifyPin(newPin);
            if (ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setError(true);
              setAttempts((prev) => prev + 1);
              triggerShake();
              setTimeout(() => runOnJS(resetPin)(), 600);
            }
          }, 150);
        }
      }
    },
    [pin, biometryAvailable, authenticate, verifyPin, triggerShake, resetPin, dotScales],
  );

  const biometryLabel = biometryType === 'face'
    ? 'Face ID'
    : biometryType === 'fingerprint'
      ? 'Touch ID'
      : 'Biométrie';

  const biometryEmoji = biometryType === 'face' ? '👤' : '👆';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Titre */}
      <View style={styles.header}>
        <Text style={[styles.lockIcon, { color: primary }]}>🔒</Text>
        <Text style={[styles.title, { color: colors.text }]}>Family Vault</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {error ? 'PIN incorrect' : 'Entrez votre PIN'}
        </Text>
      </View>

      {/* Dots PIN */}
      <Animated.View style={[styles.dotsRow, shakeStyle]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const animStyle = useAnimatedStyle(() => ({
            transform: [{ scale: dotScales[i].value }],
          }));
          const filled = i < pin.length;
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                animStyle,
                {
                  backgroundColor: error
                    ? colors.error
                    : filled
                      ? primary
                      : colors.border,
                  borderColor: error
                    ? colors.error
                    : filled
                      ? primary
                      : colors.border,
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Tentatives */}
      {attempts > 2 && (
        <Text style={[styles.attemptsText, { color: colors.error }]}>
          {attempts} tentatives échouées
        </Text>
      )}

      {/* Pavé numérique */}
      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keypadRow}>
            {row.map((key) => {
              if (key === 'bio') {
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.keyBtn, styles.keyBtnSpecial]}
                    onPress={() => handleKeyPress('bio')}
                    activeOpacity={0.6}
                    disabled={!biometryAvailable}
                    accessibilityLabel={biometryLabel}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.keySpecialText, {
                      color: biometryAvailable ? primary : colors.textFaint,
                    }]}>
                      {biometryAvailable ? biometryEmoji : ''}
                    </Text>
                  </TouchableOpacity>
                );
              }

              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.keyBtn, styles.keyBtnSpecial]}
                    onPress={() => handleKeyPress('del')}
                    activeOpacity={0.6}
                    disabled={pin.length === 0}
                    accessibilityLabel="Effacer"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.keySpecialText, {
                      color: pin.length > 0 ? colors.text : colors.textFaint,
                    }]}>
                      ⌫
                    </Text>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.keyBtn, { backgroundColor: colors.card }, Shadows.xs]}
                  onPress={() => handleKeyPress(key)}
                  activeOpacity={0.6}
                  accessibilityLabel={key}
                  accessibilityRole="button"
                >
                  <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Indication biométrie */}
      {biometryAvailable && (
        <TouchableOpacity
          style={styles.biometryHint}
          onPress={() => authenticate()}
          activeOpacity={0.7}
          accessibilityLabel={`Utiliser ${biometryLabel}`}
          accessibilityRole="button"
        >
          <Text style={[styles.biometryHintText, { color: primary }]}>
            Utiliser {biometryLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const KEY_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['4xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['5xl'],
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing['2xl'],
    marginBottom: Spacing['3xl'],
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  attemptsText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xl,
  },
  keypad: {
    gap: Spacing.xl,
    marginTop: Spacing.xl,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: Spacing['2xl'],
    justifyContent: 'center',
  },
  keyBtn: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnSpecial: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.semibold,
  },
  keySpecialText: {
    fontSize: FontSize.title,
  },
  biometryHint: {
    marginTop: Spacing['3xl'],
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
  },
  biometryHintText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
