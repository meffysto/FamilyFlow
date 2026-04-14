/**
 * GiftSenderSheet.tsx — Bottom sheet pour offrir un item d'inventaire a un autre profil
 *
 * Affiche les profils familiaux (sauf l'expediteur), un selecteur de quantite,
 * et un bouton d'envoi.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';
import type { Profile } from '../../lib/types';

// ── AwningStripes ─────────────────────────────────────────────────────────
function AwningStripes() {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View key={i} style={[styles.awningStripe, { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream }]} />
        ))}
      </View>
      <View style={styles.awningScallops}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View key={i} style={styles.awningScallopDot} />
        ))}
      </View>
    </View>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface GiftSenderSheetProps {
  visible: boolean;
  onClose: () => void;
  itemType: 'harvest' | 'rare_seed' | 'crafted' | 'building_resource';
  itemId: string;
  itemName: string;
  maxQuantity: number;
  profiles: Profile[];
  onSend: (recipientId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function GiftSenderSheet({
  visible,
  onClose,
  itemType: _itemType,
  itemId: _itemId,
  itemName,
  maxQuantity,
  profiles,
  onSend,
}: GiftSenderSheetProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);

  const handleSelectRecipient = useCallback((profileId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedRecipientId(profileId);
  }, []);

  const handleDecrement = useCallback(() => {
    setQuantity(prev => Math.max(1, prev - 1));
  }, []);

  const handleIncrement = useCallback(() => {
    setQuantity(prev => Math.min(maxQuantity, prev + 1));
  }, [maxQuantity]);

  const handleSend = useCallback(async () => {
    if (!selectedRecipientId || sending) return;
    setSending(true);
    try {
      const result = await onSend(selectedRecipientId, quantity);
      if (result.success) {
        const recipient = profiles.find(p => p.id === selectedRecipientId);
        showToast(t('gamification:gift_sent_success', { name: recipient?.name ?? '' }));
        // Reinitialiser l'etat et fermer
        setSelectedRecipientId(null);
        setQuantity(1);
        onClose();
      } else if (result.error === 'daily_limit') {
        showToast(t('gamification:gift_sent_limit'), 'error');
      } else if (result.error === 'not_enough') {
        showToast(t('gamification:gift_not_enough', { item: itemName }), 'error');
      } else {
        showToast(t('common.error'), 'error');
      }
    } catch {
      showToast(t('common.error'), 'error');
    }
    setSending(false);
  }, [selectedRecipientId, sending, quantity, onSend, profiles, itemName, showToast, t, onClose]);

  const handleClose = useCallback(() => {
    setSelectedRecipientId(null);
    setQuantity(1);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <AwningStripes />
        <View style={styles.parchment}>
          {/* Bouton fermer */}
          <TouchableOpacity style={styles.farmCloseBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={styles.farmCloseBtnText}>{'✕'}</Text>
          </TouchableOpacity>

          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.farmHeader}>
            <Text style={styles.farmTitle}>
              {'🎁 ' + t('gamification:gift_send_title')}
            </Text>
          </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Item selectionne */}
          <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
            <Text style={styles.itemEmoji}>{'🎁'}</Text>
            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
              {itemName}
            </Text>
            <Text style={[styles.itemQty, { color: colors.textMuted }]}>
              {'x'}{maxQuantity}{' disponible'}
            </Text>
          </View>

          {/* Selecteur de destinataire */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {t('gamification:gift_select_recipient')}
          </Text>

          {profiles.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {'Aucun autre profil disponible'}
            </Text>
          ) : (
            <View style={styles.profileGrid}>
              {profiles.map(p => {
                const selected = selectedRecipientId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.profileCard,
                      { backgroundColor: colors.card, borderColor: colors.borderLight },
                      selected && { borderColor: primary, backgroundColor: tint },
                      Shadows.sm,
                    ]}
                    onPress={() => handleSelectRecipient(p.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.avatarCircle,
                      { backgroundColor: selected ? primary + '20' : colors.cardAlt },
                      selected && { borderColor: primary, borderWidth: 2 },
                    ]}>
                      <Text style={styles.avatarEmoji}>{p.avatar}</Text>
                    </View>
                    <Text
                      style={[styles.profileName, { color: selected ? primary : colors.text }]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Selecteur de quantite */}
          {maxQuantity > 1 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                {t('gamification:gift_select_quantity')}
              </Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={[styles.qtyBtn, { backgroundColor: tint, borderColor: primary }, quantity <= 1 && { opacity: 0.4 }]}
                  onPress={handleDecrement}
                  disabled={quantity <= 1}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.qtyBtnText, { color: primary }]}>{'-'}</Text>
                </TouchableOpacity>

                <Text style={[styles.qtyValue, { color: colors.text }]}>{quantity}</Text>

                <TouchableOpacity
                  style={[styles.qtyBtn, { backgroundColor: tint, borderColor: primary }, quantity >= maxQuantity && { opacity: 0.4 }]}
                  onPress={handleIncrement}
                  disabled={quantity >= maxQuantity}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.qtyBtnText, { color: primary }]}>{'+'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>

        {/* Bouton Envoyer */}
        <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: selectedRecipientId ? primary : colors.cardAlt },
              (!selectedRecipientId || sending) && { opacity: 0.6 },
            ]}
            onPress={handleSend}
            disabled={!selectedRecipientId || sending}
            activeOpacity={0.7}
          >
            <Text style={[styles.sendBtnText, { color: selectedRecipientId ? colors.onPrimary : colors.textMuted }]}>
              {sending ? '...' : t('gamification:gift_send_button')}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Farm.parchmentDark },
  awning: { overflow: 'hidden' },
  awningStripes: { flexDirection: 'row', height: 28 },
  awningStripe: { flex: 1 },
  awningScallops: { flexDirection: 'row', marginTop: -4, paddingHorizontal: 2 },
  awningScallopDot: { flex: 1, height: 8, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: Farm.awningGreen, marginHorizontal: 1 },
  parchment: { flex: 1, backgroundColor: Farm.parchmentDark },
  farmCloseBtn: {
    position: 'absolute', top: Spacing.xl, right: Spacing['2xl'],
    width: 32, height: 32, backgroundColor: Farm.woodDark,
    borderWidth: 2, borderColor: Farm.woodHighlight,
    borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  farmCloseBtnText: { color: Farm.parchment, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Farm.woodHighlight, alignSelf: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  farmHeader: { paddingHorizontal: Spacing['2xl'], marginBottom: Spacing.md, marginRight: 40 },
  farmTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Farm.brownText, textShadowColor: 'rgba(255,255,255,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['3xl'],
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  itemEmoji: {
    fontSize: FontSize.titleLg,
  },
  itemName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  itemQty: {
    fontSize: FontSize.caption,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  profileCard: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 80,
    gap: Spacing.xs,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  profileName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    maxWidth: 72,
    textAlign: 'center',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.sm,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.titleLg,
  },
  qtyValue: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    minWidth: 40,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  sendBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
