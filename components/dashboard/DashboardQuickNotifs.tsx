/**
 * DashboardQuickNotifs.tsx — Section notifications rapides
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { dispatchNotification, buildManualContext } from '../../lib/notifications';
import type { DashboardSectionProps } from './types';

function DashboardQuickNotifsInner({ vaultFileExists, activateCardTemplate }: DashboardSectionProps) {
  const { colors } = useThemeColors();
  const { showToast } = useToast();
  const { notifPrefs, activeProfile } = useVault();

  const customNotifs = notifPrefs.notifications.filter(
    (n) => n.isCustom && n.enabled && n.event === 'manual'
  );

  const handleSendCustomNotif = useCallback(
    async (notifId: string) => {
      const context = buildManualContext(activeProfile);
      const ok = await dispatchNotification(notifId, context, notifPrefs);
      if (ok) {
        showToast('Notification envoyée sur Telegram !');
      } else {
        showToast('Envoi impossible — vérifiez la configuration', 'error');
      }
    },
    [activeProfile, notifPrefs]
  );

  return (
    <DashboardCard key="quicknotifs" title="Notifications rapides" icon="📤" color={colors.success}>
      {!vaultFileExists.notifications ? (
        <DashboardEmptyState
          description="Envoyez des notifications rapides à la famille en un tap"
          onActivate={() => activateCardTemplate('quicknotifs')}
          activateLabel="Importer le modèle"
        />
      ) : (
        <View style={styles.quickNotifGrid}>
          {customNotifs.map((notif) => (
            <TouchableOpacity key={notif.id} style={[styles.quickNotifBtn, { backgroundColor: colors.successBg, borderColor: colors.success }]} onPress={() => handleSendCustomNotif(notif.id)}>
              <Text style={styles.quickNotifEmoji}>{notif.emoji}</Text>
              <Text style={[styles.quickNotifLabel, { color: colors.successText }]}>{notif.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </DashboardCard>
  );
}

export const DashboardQuickNotifs = React.memo(DashboardQuickNotifsInner);

const styles = StyleSheet.create({
  quickNotifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
  },
  quickNotifEmoji: { fontSize: 18 },
  quickNotifLabel: { fontSize: 14, fontWeight: '600' },
});
