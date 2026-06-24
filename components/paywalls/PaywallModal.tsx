// components/paywalls/PaywallModal.tsx
// Paywall FamilyFlow — Phase 54-04.
//
// Modal pageSheet + drag-to-dismiss (analogue components/pdf/BookExportModal.tsx) :
//   - bénéfices premium en ton chaleureux slice-of-life (FR)
//   - achat lifetime « FamilyFlow à Vie » (non-consommable) + Pack Histoires (consommable)
//   - bouton « Restaurer mes achats » (obligatoire Apple 3.1.1)
//
// Prix TOUJOURS localisés depuis RevenueCat (lifetimePrice/packPrice) — JAMAIS hardcodé
// (CONTEXT Claude's Discretion + convention CLAUDE.md). Offline → affiche « … ».
//
// JAMAIS monté au lancement : ce composant n'est rendu que sur setPaywallVisible(true)
// au point de friction (4e histoire du mois ou tap feature premium — D-10, Piège 4).
//
// Couleurs UNIQUEMENT via useThemeColors() (zéro hardcoded). Styles statiques en bas.

import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useEntitlements } from '../../contexts/EntitlementContext';
import { ModalHeader, Button } from '../ui';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  /** Adapte le sous-titre selon l'origine de la friction. */
  context?: 'story_limit' | 'premium_feature';
}

/** Bénéfices premium (cœur, non-IA) présentés dans le paywall — ton chaleureux FR. */
const PREMIUM_FEATURES: { icon: string; label: string }[] = [
  { icon: '📊', label: 'Budget familial avancé, sans limite' },
  { icon: '🍲', label: 'Repas & recettes illimités' },
  { icon: '📖', label: 'Vos histoires imprimées en vrais livres' },
  { icon: '🌳', label: 'Mascotte, ferme et village avancés' },
  { icon: '🩺', label: 'Carnet santé, courbes & suivi grossesse' },
  { icon: '⚡', label: 'Lightning Wallet familial' },
  { icon: '🔒', label: 'Vos souvenirs restent sur votre téléphone' },
];

export function PaywallModal({ visible, onClose, context = 'story_limit' }: PaywallModalProps) {
  const { primary, colors } = useThemeColors();
  const {
    status,
    isLoadingPurchase,
    lifetimePrice,
    packPrice,
    purchaseLifetime,
    purchaseStoryPack,
    restorePurchases,
  } = useEntitlements();

  const subtitle =
    context === 'story_limit'
      ? 'Vous avez utilisé vos 3 histoires offertes ce mois-ci. Continuez sans limite.'
      : 'Débloquez tout FamilyFlow, pour toujours.';

  const handleLifetime = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await purchaseLifetime();
  }, [purchaseLifetime]);

  const handlePack = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await purchaseStoryPack();
  }, [purchaseStoryPack]);

  const handleRestore = useCallback(async () => {
    Haptics.selectionAsync();
    await restorePurchases();
  }, [restorePurchases]);

  // Achat lifetime réussi → le statut bascule LIFETIME (listener temps réel) → on ferme.
  React.useEffect(() => {
    if (visible && status === 'LIFETIME') {
      onClose();
    }
  }, [visible, status, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title="FamilyFlow à Vie" onClose={onClose} />

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={[styles.featureLabel, { color: colors.text }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {isLoadingPurchase ? (
            <ActivityIndicator color={primary} style={styles.loader} />
          ) : null}

          {/* Bloc lifetime */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.text }]}>
              Payez une fois. Pour toujours.
            </Text>
            <Text style={[styles.price, { color: primary }]}>{lifetimePrice || '…'}</Text>
          </View>
          <Button
            label="Obtenir FamilyFlow à Vie"
            onPress={handleLifetime}
            fullWidth
            size="lg"
            disabled={isLoadingPurchase}
          />

          {/* Bloc Pack Histoires */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textMuted }]}>
              Pack Histoires — 30 histoires
            </Text>
            <Text style={[styles.priceSecondary, { color: colors.textMuted }]}>
              {packPrice || '…'}
            </Text>
          </View>
          <Button
            label="Acheter un Pack Histoires"
            onPress={handlePack}
            variant="secondary"
            fullWidth
            disabled={isLoadingPurchase}
          />

          <Button
            label="Restaurer mes achats"
            onPress={handleRestore}
            variant="ghost"
            fullWidth
            disabled={isLoadingPurchase}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  subtitle: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  featureList: {
    gap: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  featureIcon: {
    fontSize: FontSize.lg,
  },
  featureLabel: {
    fontSize: FontSize.body,
    flex: 1,
  },
  footer: {
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    borderTopWidth: 1,
  },
  loader: {
    marginBottom: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  priceLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  price: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
  },
  priceSecondary: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
