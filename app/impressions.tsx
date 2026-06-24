// app/impressions.tsx
// Écran "Mes impressions" — Phase 51-02.
//
// - Lit le manifeste vault (`12 - Impressions/manifeste.md`) via parseManifeste
// - Affiche les exports en cards verticales (ExportCard memoïsé)
// - CTA header "Nouveau livre" → ouvre BookExportModal (Phase 51-01)
// - Tap card → Print.printAsync (iOS) / Linking.openURL (Android)
// - Pull-to-refresh + empty state + histoires supprimées (italique)

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { useEntitlements } from '../contexts/EntitlementContext';
import { PaywallModal } from '../components/paywalls';
import {
  parseManifeste,
  MANIFESTE_FILE,
  buildVaultPdfUri,
} from '../lib/pdf';
import type { BookManifestEntry } from '../lib/pdf';
import { BookExportModal, ExportCard } from '../components/pdf';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

export default function ImpressionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { vault, stories } = useVault();
  const { colors, primary } = useThemeColors();
  // Soft-gate premium : la création de livres PDF est réservée au premium.
  // Les livres déjà imprimés restent consultables gratuitement (aperçu).
  const { isPremium, isReady: entitlementsReady } = useEntitlements();
  const [entries, setEntries] = useState<BookManifestEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const loadManifeste = useCallback(async () => {
    if (!vault) return;
    try {
      const raw = await vault.readFile(MANIFESTE_FILE);
      setEntries(parseManifeste(raw));
    } catch {
      // Manifeste absent (jamais d'export encore) → liste vide
      setEntries([]);
    }
  }, [vault]);

  useEffect(() => {
    loadManifeste();
  }, [loadManifeste]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadManifeste();
    setRefreshing(false);
  }, [loadManifeste]);

  const handleOpenPdf = useCallback(
    async (entry: BookManifestEntry) => {
      if (!vault) return;
      Haptics.selectionAsync();
      try {
        const uri = buildVaultPdfUri(vault, entry);
        if (Platform.OS === 'ios') {
          await Print.printAsync({ uri });
        } else {
          await Linking.openURL(uri);
        }
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[impressions] open error', err);
        }
        Alert.alert(
          t('impressions.errors.openTitle', {
            defaultValue: 'Impossible d\'ouvrir le PDF',
          }),
          t('impressions.errors.openBody', {
            defaultValue:
              'Le fichier PDF est introuvable ou inaccessible. Vérifie que ton vault iCloud est bien synchronisé.',
          }),
        );
      }
    },
    [vault, t],
  );

  const handleSuccess = useCallback(() => {
    setModalOpen(false);
    loadManifeste();
  }, [loadManifeste]);

  const openModal = useCallback(() => {
    Haptics.selectionAsync();
    setModalOpen(true);
  }, []);

  // Point de friction : un user non-premium qui tente de créer un livre tombe
  // sur le paywall. isReady évite un faux blocage tant que l'init n'est pas finie.
  const handleNewBook = useCallback(() => {
    if (entitlementsReady && !isPremium) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setPaywallVisible(true);
      return;
    }
    openModal();
  }, [entitlementsReady, isPremium, openModal]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: colors.bg }]}
    >
      <Stack.Screen
        options={{
          title: t('impressions.screen.title', { defaultValue: 'Mes impressions' }),
          headerShown: false,
        }}
      />

      <View
        style={[styles.header, { borderBottomColor: colors.borderLight }]}
      >
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common.actions.back', { defaultValue: 'Retour' })}
            accessibilityRole="button"
          >
            <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('impressions.screen.title', { defaultValue: 'Mes impressions' })}
          </Text>
        </View>
        <Pressable
          onPress={handleNewBook}
          style={[styles.cta, { backgroundColor: primary }]}
          accessibilityRole="button"
        >
          <Plus size={16} color={colors.onPrimary} strokeWidth={2.5} />
          <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
            {t('impressions.screen.newButton', { defaultValue: 'Nouveau livre' })}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
          />
        }
      >
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('impressions.screen.empty.title', {
                defaultValue: 'Aucune impression',
              })}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              {t('impressions.screen.empty.description', {
                defaultValue:
                  'Génère ton premier livre à imprimer chez Lulu pour le retrouver ici.',
              })}
            </Text>
            <Pressable
              onPress={handleNewBook}
              style={[
                styles.cta,
                { backgroundColor: primary, marginTop: Spacing['4xl'] },
              ]}
              accessibilityRole="button"
            >
              <Plus size={16} color={colors.onPrimary} strokeWidth={2.5} />
              <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
                {t('impressions.screen.empty.cta', {
                  defaultValue: 'Nouveau livre',
                })}
              </Text>
            </Pressable>
          </View>
        ) : (
          entries.map((e) => {
            const story = stories.find((s) => s.id === e.id);
            return (
              <ExportCard
                key={`${e.id}-${e.date}-${e.hash.slice(0, 8)}`}
                entry={e}
                storyTitle={story?.titre ?? e.id}
                storyDeleted={!story}
                onPress={handleOpenPdf}
              />
            );
          })
        )}
      </ScrollView>

      <BookExportModal
        visible={modalOpen}
        onClose={closeModal}
        onSuccess={handleSuccess}
      />

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        context="premium_feature"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['4xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexShrink: 1,
  },
  backBtn: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    flexShrink: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
  },
  ctaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  list: {
    padding: Spacing['4xl'],
    paddingBottom: Spacing['6xl'],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing['6xl'],
  },
  emptyTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
