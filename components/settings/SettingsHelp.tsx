/**
 * SettingsHelp.tsx — Section « Aide et découverte » dans les réglages
 *
 * 3 actions : Guide de l'app, Revoir les astuces, Modèles de contenu
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export function SettingsHelp() {
  const { colors, primary, tint } = useThemeColors();
  const { resetAllHints, isTemplateInstalled, markTemplateInstalled } = useHelp();
  const { vaultPath, profiles, refresh } = useVault();
  const { showToast } = useToast();
  const [showGuide, setShowGuide] = useState(false);

  const handleResetHints = () => {
    Alert.alert(
      'Revoir les astuces',
      'Les bulles d\'aide seront affichées à nouveau sur chaque écran.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          onPress: async () => {
            await resetAllHints();
            showToast('Les astuces seront affichées à nouveau', 'success');
          },
        },
      ]
    );
  };

  const handleInstallPack = (packId: string, packName: string) => {
    Alert.alert(
      'Installer le modèle',
      `Installer « ${packName} » dans votre vault ?\n\nLes fichiers existants ne seront pas écrasés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Installer',
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
              showToast(`${packName} installé (${result.installed} fichier${result.installed > 1 ? 's' : ''})`, 'success');
            } catch (e) {
              showToast(`Erreur : ${e}`, 'error');
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
      title: 'Guide de l\'application',
      subtitle: 'Découvrez toutes les fonctions',
      onPress: () => setShowGuide(true),
    },
    {
      emoji: '🔄',
      title: 'Revoir les astuces',
      subtitle: 'Relancer les bulles d\'aide',
      onPress: handleResetHints,
    },
  ];

  const visiblePacks = TEMPLATE_PACKS.filter(
    (p) => !p.requiresChildren || hasChildren
  );

  return (
    <>
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Aide et découverte">
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Aide et découverte</Text>
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
      <CollapsibleSection id="templates" title="Modèles de contenu" defaultCollapsed>
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
                    <Text style={[styles.installedText, { color: primary }]}>Installé</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.installBtn, { backgroundColor: primary }]}
                    onPress={() => handleInstallPack(pack.id, pack.name)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Installer ${pack.name}`}
                  >
                    <Text style={styles.installBtnText}>Installer</Text>
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
  sectionTitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
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
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
