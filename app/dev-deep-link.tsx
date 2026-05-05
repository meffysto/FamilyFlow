/**
 * dev-deep-link.tsx — Écran de test dev-only pour Phase 50 (deep links story)
 *
 * Accessible uniquement en __DEV__. Permet de tester sans simulateur + xcrun :
 *  - happy path : ouvre une histoire existante via deep link → autoplay attendu
 *  - 404 : id inexistant → toast "Histoire introuvable" + retour bibliothèque
 *  - non-régression : import-note + open/meals
 *
 * À supprimer ou cacher derrière un flag avant release App Store.
 */

import { ScrollView, View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { PressableScale } from '../components/ui';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

export default function DevDeepLinkScreen() {
  const router = useRouter();
  const { colors, primary } = useThemeColors();
  const vault = useVault();
  const stories = vault.stories ?? [];

  if (!__DEV__) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          Indisponible en production
        </Text>
      </SafeAreaView>
    );
  }

  const open = (url: string) => {
    Linking.openURL(url).catch((err) => {
      Alert.alert('Erreur', `Impossible d'ouvrir ${url}\n\n${String(err)}`);
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Test deep links (dev)
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Phase 50 — QR audio + deep links
        </Text>

        {/* ── Happy path : histoires existantes ───────────────────────── */}
        <Text style={[styles.section, { color: colors.text }]}>
          1. Histoires existantes (autoplay attendu)
        </Text>
        {stories.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Aucune histoire dans le vault. Génère une histoire d'abord.
          </Text>
        ) : (
          stories.slice(0, 5).map((s) => (
            <PressableScale
              key={s.id}
              onPress={() => open(`family-vault://story/${s.id}`)}
              style={[styles.button, { backgroundColor: primary }]}
            >
              <Text style={[styles.buttonLabel, { color: colors.onPrimary }]} numberOfLines={1}>
                {s.titre}
              </Text>
              <Text style={[styles.buttonHint, { color: colors.onPrimary }]} numberOfLines={1}>
                family-vault://story/{s.id.slice(0, 16)}…
              </Text>
            </PressableScale>
          ))
        )}

        {/* ── 404 fallback ───────────────────────────────────────────── */}
        <Text style={[styles.section, { color: colors.text }]}>
          2. ID inexistant (toast + retour attendu)
        </Text>
        <PressableScale
          onPress={() => open('family-vault://story/inexistant-test-12345')}
          style={[styles.button, { backgroundColor: colors.error }]}
        >
          <Text style={[styles.buttonLabel, { color: '#FFF' }]}>
            Tester id inexistant
          </Text>
          <Text style={[styles.buttonHint, { color: '#FFF' }]}>
            family-vault://story/inexistant-test-12345
          </Text>
        </PressableScale>

        {/* ── Non-régression deep links existants ────────────────────── */}
        <Text style={[styles.section, { color: colors.text }]}>
          3. Non-régression (deep links existants)
        </Text>
        <PressableScale
          onPress={() =>
            open('family-vault://import-note?url=https://example.com/note.md')
          }
          style={[styles.button, { backgroundColor: colors.cardAlt }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.text }]}>
            import-note
          </Text>
          <Text style={[styles.buttonHint, { color: colors.textMuted }]}>
            family-vault://import-note?url=…
          </Text>
        </PressableScale>
        <PressableScale
          onPress={() => open('family-vault://open/meals')}
          style={[styles.button, { backgroundColor: colors.cardAlt }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.text }]}>
            open/meals
          </Text>
          <Text style={[styles.buttonHint, { color: colors.textMuted }]}>
            family-vault://open/meals
          </Text>
        </PressableScale>

        {/* ── Retour ──────────────────────────────────────────────────── */}
        <PressableScale
          onPress={() => router.back()}
          style={[styles.backButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.text }]}>
            Retour
          </Text>
        </PressableScale>

        <Text style={[styles.note, { color: colors.textMuted }]}>
          Note : pour tester un cold start, kill l'app puis ouvre l'URL via Notes.app
          ou Safari. Pour le mode verrouillé, configure un PIN, kill, puis ouvre l'URL.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing['3xl'], paddingBottom: Spacing['5xl'] },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginBottom: Spacing['4xl'],
  },
  section: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing['4xl'],
    marginBottom: Spacing.xl,
  },
  empty: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    paddingVertical: Spacing.xl,
  },
  button: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  buttonLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  buttonHint: {
    fontSize: FontSize.caption,
    marginTop: 2,
    opacity: 0.85,
  },
  backButton: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing['4xl'],
  },
  note: {
    fontSize: FontSize.caption,
    marginTop: Spacing['3xl'],
    lineHeight: 18,
  },
});
