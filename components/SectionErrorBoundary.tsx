/**
 * SectionErrorBoundary — Isole les crashes de sections dashboard.
 *
 * Si un composant enfant plante, affiche un message discret
 * au lieu de crasher toute l'app.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontSize, FontWeight } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';

interface Props {
  name: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends React.Component<Props, State> {
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
      return (
        <View style={styles.container}>
          <Text style={styles.text}>
            Section « {this.props.name} » indisponible
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={styles.retry}
            accessibilityLabel={`Réessayer la section ${this.props.name}`}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
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
    color: '#9CA3AF',
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
    color: '#6B7280',
  },
});
