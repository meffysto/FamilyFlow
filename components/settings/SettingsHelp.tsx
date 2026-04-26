/**
 * SettingsHelp.tsx — Section « Aide et découverte » dans les réglages
 *
 * 3 actions : Guide de l'app, Revoir les astuces, Modèles de contenu
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useHelp } from '../../contexts/HelpContext';
import { useVault } from '../../contexts/VaultContext';
import { useToast } from '../../contexts/ToastContext';
import { HelpModal } from '../help/HelpModal';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { TEMPLATE_PACKS } from '../../lib/vault-templates';
import { VaultManager } from '../../lib/vault';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { SectionHeader } from '../ui/SectionHeader';
import { HelpCircle } from 'lucide-react-native';

export function SettingsHelp() {
  const { t } = useTranslation();
  const { colors, primary, tint } = useThemeColors();
  const { resetAllHints, isTemplateInstalled, markTemplateInstalled } = useHelp();
  const { vaultPath, profiles, refresh } = useVault();
  const { showToast } = useToast();
  const [showGuide, setShowGuide] = useState(false);

  const handleResetHints = () => {
    Alert.alert(
      t('settings.help.resetHintsAlertTitle'),
      t('settings.help.resetHintsAlertMessage'),
      [
        { text: t('settings.help.cancel'), style: 'cancel' },
        {
          text: t('settings.help.resetBtn'),
          onPress: async () => {
            await resetAllHints();
            showToast(t('settings.help.resetSuccess'), 'success');
          },
        },
      ]
    );
  };

  const handleInstallPack = (packId: string, packName: string) => {
    Alert.alert(
      t('settings.help.installAlertTitle'),
      t('settings.help.installAlertMessage', { name: packName }),
      [
        { text: t('settings.help.cancel'), style: 'cancel' },
        {
          text: t('settings.help.installBtn'),
          onPress: async () => {
            if (!vaultPath) return;
            try {
              const vault = new VaultManager(vaultPath);
              const parents = profiles
                .filter(p => p.role === 'adulte')
                .map(p => ({ name: p.name, avatar: p.avatar }));
              const children = profiles
                .filter(p => p.role === 'enfant')
                .map(p => ({ name: p.name, avatar: p.avatar, birthdate: p.birthdate || '' }));

              const result = await vault.installTemplates([packId], parents, children);
              await markTemplateInstalled(packId);
              await refresh();
              showToast(t('settings.help.installSuccess', { name: packName, count: result.installed }), 'success');
            } catch (e) {
              showToast(t('settings.help.installError', { error: String(e) }), 'error');
            }
          },
        },
      ]
    );
  };

  const hasChildren = profiles.some(p => p.role === 'enfant');

  const ITEMS = [
    {
      emoji: '❓',
      title: t('settings.help.guideTitle'),
      subtitle: t('settings.help.guideSubtitle'),
      onPress: () => setShowGuide(true),
    },
    {
      emoji: '🔄',
      title: t('settings.help.resetHintsTitle'),
      subtitle: t('settings.help.resetHintsSubtitle'),
      onPress: handleResetHints,
    },
  ];

  const visiblePacks = TEMPLATE_PACKS.filter(
    (p) => !p.requiresChildren || hasChildren
  );

  return (
    <>
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.help.sectionA11y')}>
        <SectionHeader
          title={t('settings.help.sectionTitle')}
          icon={<HelpCircle size={16} strokeWidth={1.75} color={colors.brand.soilMuted} />}
          flush
        />
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          {ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.item,
                index < ITEMS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.separator,
                },
              ]}
              onPress={item.onPress}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} — ${item.subtitle}`}
            >
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSub }]}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textFaint }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Section Modèles de contenu */}
      <CollapsibleSection id="templates" title={t('settings.help.templatesTitle')} defaultCollapsed>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          {visiblePacks.map((pack, index) => {
            const installed = isTemplateInstalled(pack.id);
            return (
              <View
                key={pack.id}
                style={[
                  styles.item,
                  index < visiblePacks.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  },
                ]}
              >
                <Text style={styles.itemEmoji}>{pack.emoji}</Text>
                <View style={styles.itemText}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{pack.name}</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textSub }]}>{pack.description}</Text>
                </View>
                {installed ? (
                  <View style={[styles.installedBadge, { backgroundColor: tint }]}>
                    <Text style={[styles.installedText, { color: primary }]}>{t('settings.help.installed')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.installBtn, { backgroundColor: primary }]}
                    onPress={() => handleInstallPack(pack.id, pack.name)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.help.installA11y', { name: pack.name })}
                  >
                    <Text style={[styles.installBtnText, { color: colors.onPrimary }]}>{t('settings.help.installBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </CollapsibleSection>

      <Modal
        visible={showGuide}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGuide(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
          <HelpModal onClose={() => setShowGuide(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  card: { borderRadius: Radius.xl, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  itemEmoji: { fontSize: FontSize.title },
  itemText: { flex: 1, gap: Spacing.xxs },
  itemTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  itemSubtitle: { fontSize: FontSize.sm },
  chevron: { fontSize: FontSize.title, fontWeight: FontWeight.normal },
  installedBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  installedText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  installBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  installBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
