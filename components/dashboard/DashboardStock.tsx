/**
 * DashboardStock.tsx — Section stock & fournitures
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import type { DashboardSectionProps } from './types';

function DashboardStockInner({ vaultFileExists, activateCardTemplate }: DashboardSectionProps) {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { stock, updateStockQuantity, addCourseItem } = useVault();
  const { showToast } = useToast();

  const lowCount = stock.length > 0 ? stock.filter((s) => s.quantite <= s.seuil).length : 0;

  if (!vaultFileExists.stock) return (
    <DashboardCard key="stock" title="Stock & Fournitures" icon="📦" color={colors.success}>
      <DashboardEmptyState
        description="Suivez vos stocks de produits et soyez alerté quand il faut racheter"
        onActivate={() => activateCardTemplate('stock')}
        activateLabel="Importer le modèle"
      />
    </DashboardCard>
  );

  return (
    <DashboardCard key="stock" title="Stock & Fournitures" icon="📦" count={lowCount > 0 ? lowCount : undefined} color={lowCount > 0 ? colors.error : colors.success} collapsible cardId="stock">
      {stock.filter((s) => s.quantite <= s.seuil + 1).map((item) => {
        const isLow = item.quantite <= item.seuil;
        const statusColor = isLow ? colors.error : colors.warning;
        return (
          <View key={`${item.section}-${item.produit}`} style={styles.stockRow}>
            <Text style={styles.stockAlertIcon}>{isLow ? '🔴' : '🟡'}</Text>
            <View style={styles.stockInfo}>
              <Text style={[styles.stockName, { color: colors.text }]}>{item.produit}{item.detail ? ` (${item.detail})` : ''}</Text>
              <Text style={[styles.stockMeta, { color: statusColor }]}>{item.quantite} restant{item.quantite > 1 ? 's' : ''} (seuil: {item.seuil})</Text>
            </View>
            <View style={styles.stockBtnGroup}>
              {isLow && (
                <TouchableOpacity style={[styles.stockCartBtn, { backgroundColor: colors.warningBg, borderColor: colors.warning }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); const detail = item.detail && !/^\d+$/.test(item.detail.trim()) ? ` (${item.detail})` : ''; const qty = item.qteAchat ? ` x${item.qteAchat}` : ''; const n = `${item.produit}${detail}${qty}`; addCourseItem(n, item.section ?? 'Produits bébé'); showToast(`${item.produit} ajouté aux courses`, 'success'); }} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={styles.stockCartBtnText}>🛒</Text>
                  </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.stockBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }, item.quantite <= 0 && styles.stockBtnDisabled]} onPress={() => updateStockQuantity(item.lineIndex, Math.max(0, item.quantite - 1))} activeOpacity={0.6} disabled={item.quantite <= 0} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Text style={[styles.stockBtnText, { color: colors.textSub }]}>−</Text>
                </TouchableOpacity>
              <Text style={[styles.stockQty, { color: colors.text }]}>{item.quantite}</Text>
              <TouchableOpacity style={[styles.stockBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]} onPress={() => updateStockQuantity(item.lineIndex, item.quantite + 1)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Text style={[styles.stockBtnText, { color: colors.textSub }]}>+</Text>
                </TouchableOpacity>
            </View>
          </View>
        );
      })}
      <TouchableOpacity style={styles.seeAllLink} onPress={() => router.push('/(tabs)/stock')} activeOpacity={0.7}>
        <Text style={[styles.seeAllText, { color: primary }]}>Gérer le stock →</Text>
      </TouchableOpacity>
    </DashboardCard>
  );
}

export const DashboardStock = React.memo(DashboardStockInner);

const styles = StyleSheet.create({
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  stockAlertIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  stockInfo: {
    flex: 1,
    gap: 1,
  },
  stockName: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockCartBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 4,
  },
  stockCartBtnText: {
    fontSize: 14,
  },
  stockBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  stockBtnDisabled: {
    opacity: 0.3,
  },
  stockBtnText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  stockQty: {
    fontSize: 17,
    fontWeight: '800',
    minWidth: 26,
    textAlign: 'center',
  },
  seeAllLink: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
