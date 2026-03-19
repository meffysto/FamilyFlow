/**
 * DashboardQuickNotifs.tsx — Section notifications rapides
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { dispatchNotification, buildManualContext } from '../../lib/notifications';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardQuickNotifsInner({ vaultFileExists, activateCardTemplate }: DashboardSectionProps) {
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const { notifPrefs, activeProfile } = useVault();
  const [pressedLabel, setPressedLabel] = useState<string | null>(null);

  const customNotifs = notifPrefs.notifications.filter(
    (n) => n.isCustom && n.enabled && n.event === 'manual'
  );

  const handleSendCustomNotif = useCallback(
    async (notifId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleLongPress = useCallback((label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPressedLabel(label);
    setTimeout(() => setPressedLabel(null), 1500);
  }, []);

  return (
    <DashboardCard key="quicknotifs" title="Notifications rapides" icon="📤" color={primary}>
      {!vaultFileExists.notifications ? (
        <DashboardEmptyState
          description="Envoyez des notifications rapides à la famille en un tap"
          onActivate={() => activateCardTemplate('quicknotifs')}
          activateLabel="Importer le modèle"
        />
      ) : (
        <View>
          {pressedLabel && (
            <Text style={[styles.tooltip, { color: colors.textMuted }]}>{pressedLabel}</Text>
          )}
          <View style={styles.quickNotifGrid}>
            {customNotifs.map((notif) => (
              <TouchableOpacity
                key={notif.id}
                style={[styles.quickNotifBtn, { backgroundColor: tint, borderColor: primary }]}
                onPress={() => handleSendCustomNotif(notif.id)}
                onLongPress={() => handleLongPress(notif.label)}
                activeOpacity={0.6}
              >
                <Text style={styles.quickNotifEmoji}>{notif.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </DashboardCard>
  );
}

export const DashboardQuickNotifs = React.memo(DashboardQuickNotifsInner);

const styles = StyleSheet.create({
  tooltip: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    marginBottom: 6,
  },
  quickNotifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  quickNotifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  quickNotifEmoji: { fontSize: FontSize.title },
});
