/**
 * DashboardQuickNotifs.tsx — Section notifications rapides
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Heart,
  PartyPopper,
  Trophy,
  Award,
  Gift,
  Cake,
  Star,
  Sparkles,
  MessageCircle,
  Phone,
  Hand,
  Smile,
  ThumbsUp,
  Coffee,
  UtensilsCrossed,
  Home,
  Car,
  Plane,
  Clock,
  AlarmClock,
  CheckCircle2,
  ClipboardList,
  Flame,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react-native';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { dispatchNotification, buildManualContext } from '../../lib/notifications';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

const EMOJI_TO_ICON: Record<string, LucideIcon> = {
  '❤️': Heart, '❤': Heart, '💖': Heart, '💕': Heart, '💗': Heart, '💝': Heart, '💘': Heart, '😍': Heart,
  '🎉': PartyPopper, '🥳': PartyPopper, '🎊': PartyPopper,
  '🏆': Trophy,
  '🏅': Award, '🥇': Award, '🥈': Award, '🥉': Award,
  '🎁': Gift,
  '🎂': Cake, '🧁': Cake,
  '⭐': Star, '🌟': Star, '✨': Sparkles,
  '💬': MessageCircle, '🗨️': MessageCircle,
  '📞': Phone, '☎️': Phone, '📱': Phone,
  '👋': Hand, '🙌': Hand, '🙏': Hand,
  '😀': Smile, '😄': Smile, '😊': Smile, '🙂': Smile, '😘': Smile,
  '👍': ThumbsUp,
  '☕': Coffee, '🍵': Coffee,
  '🍽️': UtensilsCrossed, '🍕': UtensilsCrossed, '🍔': UtensilsCrossed,
  '🏠': Home, '🏡': Home,
  '🚗': Car, '🚙': Car,
  '✈️': Plane,
  '⏰': AlarmClock, '⏱️': Clock, '🕐': Clock,
  '✅': CheckCircle2, '☑️': CheckCircle2,
  '📋': ClipboardList, '📝': ClipboardList,
  '🔥': Flame,
  '☀️': Sun,
  '🌙': Moon,
  '🔔': Bell, '🛎️': Bell,
};

function iconForEmoji(emoji: string): LucideIcon {
  return EMOJI_TO_ICON[emoji] ?? Bell;
}

function DashboardQuickNotifsInner({ vaultFileExists, activateCardTemplate }: DashboardSectionProps) {
  const { t } = useTranslation();
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
        showToast(t('dashboard.quickNotifs.sent'));
      } else {
        showToast(t('dashboard.quickNotifs.sendError'), 'error');
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
    <DashboardCard key="quicknotifs" title={t('dashboard.quickNotifs.title')} color={colors.catSysteme} tinted>
      {!vaultFileExists.notifications ? (
        <DashboardEmptyState
          description={t('dashboard.quickNotifs.emptyDescription')}
          onActivate={() => activateCardTemplate('quicknotifs')}
          activateLabel={t('dashboard.quickNotifs.activateLabel')}
        />
      ) : (
        <View>
          {pressedLabel && (
            <Text style={[styles.tooltip, { color: colors.textMuted }]}>{pressedLabel}</Text>
          )}
          <View style={styles.quickNotifGrid}>
            {customNotifs.map((notif) => {
              const Icon = iconForEmoji(notif.emoji);
              return (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.quickNotifBtn, { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => handleSendCustomNotif(notif.id)}
                  onLongPress={() => handleLongPress(notif.label)}
                  activeOpacity={0.6}
                >
                  <Icon size={20} strokeWidth={1.75} color={primary} />
                </TouchableOpacity>
              );
            })}
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
});
