/**
 * SectionErrorBoundary — Isole les crashes de sections dashboard.
 *
 * Si un composant enfant plante, affiche un message discret
 * au lieu de crasher toute l'app.
 *
 * Classe composant (ErrorBoundary oblige) enveloppée par un wrapper
 * fonctionnel pour accéder aux couleurs du thème.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontSize, FontWeight } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../contexts/ThemeContext';

interface Props {
  name: string;
  children: React.ReactNode;
  /** Couleurs injectées par le wrapper fonctionnel */
  _colors?: ReturnType<typeof useThemeColors>['colors'];
  /** Translation function injectée par le wrapper fonctionnel */
  _t?: (key: string, opts?: any) => string;
}

interface State {
  hasError: boolean;
}

class SectionErrorBoundaryInner extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.warn(`[SectionErrorBoundary] ${this.props.name} :`, error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      const c = this.props._colors;
      const tr = this.props._t;
      return (
        <View style={[styles.container, c && { backgroundColor: c.overlayLight }]}>
          <Text style={[styles.text, c && { color: c.textFaint }]}>
            {tr ? tr('sectionError.unavailable', { name: this.props.name }) : `Section « ${this.props.name} » indisponible`}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={[styles.retry, c && { backgroundColor: c.overlayLight }]}
            accessibilityLabel={tr ? tr('sectionError.retryA11y', { name: this.props.name }) : `Réessayer la section ${this.props.name}`}
            accessibilityRole="button"
          >
            <Text style={[styles.retryText, c && { color: c.textMuted }]}>{tr ? tr('sectionError.retry') : 'Réessayer'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Wrapper fonctionnel pour injecter les couleurs du thème */
export function SectionErrorBoundary({ name, children }: Omit<Props, '_colors' | '_t'>) {
  const { colors } = useThemeColors();
  const { t } = useTranslation();
  return (
    <SectionErrorBoundaryInner name={name} _colors={colors} _t={t}>
      {children}
    </SectionErrorBoundaryInner>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing['2xl'],
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    gap: Spacing.md,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  retry: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.base,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  retryText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
});
