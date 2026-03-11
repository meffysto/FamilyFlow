/**
 * CollapsibleSection.tsx — Section réductible avec état persisté
 *
 * Wrap un contenu dans un header cliquable + animation d'ouverture/fermeture.
 * L'état ouvert/fermé est sauvegardé dans SecureStore via la clé `section_collapsed_{id}`.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

const STORE_PREFIX = 'section_collapsed_';

interface CollapsibleSectionProps {
  /** Identifiant unique pour la persistance */
  id: string;
  /** Titre de la section (affiché dans le header) */
  title: string;
  /** Contenu à afficher quand la section est ouverte */
  children: React.ReactNode;
  /** Replié par défaut au premier affichage (défaut: false) */
  defaultCollapsed?: boolean;
}

export function CollapsibleSection({ id, title, children, defaultCollapsed = false }: CollapsibleSectionProps) {
  const { colors } = useThemeColors();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [loaded, setLoaded] = useState(false);
  const rotation = useSharedValue(defaultCollapsed ? -90 : 0);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(`${STORE_PREFIX}${id}`);
      if (stored !== null) {
        const isCollapsed = stored === '1';
        setCollapsed(isCollapsed);
        rotation.value = isCollapsed ? -90 : 0;
      }
      setLoaded(true);
    })();
  }, [id]);

  const toggle = useCallback(async () => {
    const next = !collapsed;
    setCollapsed(next);
    rotation.value = withTiming(next ? -90 : 0, { duration: 200 });
    await SecureStore.setItemAsync(`${STORE_PREFIX}${id}`, next ? '1' : '0');
  }, [collapsed, id]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!loaded) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`${title} — ${collapsed ? 'replié' : 'déplié'}`}
        accessibilityState={{ expanded: !collapsed }}
      >
        <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
        <Animated.Text style={[styles.chevron, { color: colors.textFaint }, chevronStyle]}>
          ›
        </Animated.Text>
      </TouchableOpacity>
      {!collapsed && children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing['3xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: FontSize.title,
  },
});
