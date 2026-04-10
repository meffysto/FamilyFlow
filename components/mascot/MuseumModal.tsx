/**
 * MuseumModal.tsx — Musée des effets sémantiques (Phase 23, MUSEUM-02, MUSEUM-04, MUSEUM-05)
 *
 * Modal pageSheet affichant l'historique chronologique des effets sémantiques
 * groupés par semaine avec headers datés.
 *
 * Pattern calqué sur FarmCodexModal.tsx (MUSEUM-05) :
 * - Modal pageSheet + animationType slide + onRequestClose
 * - SafeAreaView englobant
 * - Header maison (View + Text + TouchableOpacity fermer) — PAS ModalHeader
 * - SectionList directement enfant de SafeAreaView (Pitfall 3 RESEARCH.md)
 * - FadeInDown par row (index section-local)
 * - Badges variant inline (pattern SettingsCoupling — variantColor + '33')
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { VaultManager } from '../../lib/vault';
import {
  parseMuseumEntries,
  groupEntriesByWeek,
  formatRelativeTime,
  type MuseumEntry,
} from '../../lib/museum/engine';
import { CATEGORY_VARIANT } from '../../lib/semantic/effect-toasts';
import { VARIANT_CONFIG } from './HarvestBurst';
import type { CategoryId } from '../../lib/semantic/categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MuseumSection {
  title: string;
  data: MuseumEntry[];
}

interface MuseumModalProps {
  visible: boolean;
  onClose: () => void;
  profileId: string | null;
  vault: VaultManager | null;
}

// ---------------------------------------------------------------------------
// MuseumRow — React.memo (per CLAUDE.md)
// ---------------------------------------------------------------------------

interface MuseumRowProps {
  item: MuseumEntry;
  index: number;
}

const MuseumRow = React.memo(function MuseumRow({ item, index }: MuseumRowProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const variant = CATEGORY_VARIANT[item.categoryId as CategoryId];
  const variantConfig = VARIANT_CONFIG[variant];
  const variantColor = variantConfig.particleColor;

  const variantLabelKey =
    variant === 'golden'
      ? 'museum.variant.golden'
      : variant === 'rare'
      ? 'museum.variant.rare'
      : 'museum.variant.ambient';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50)} style={styles.rowWrap}>
      {/* Icône emoji */}
      <Text style={styles.rowIcon}>{item.icon}</Text>

      {/* Colonne label + date */}
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={2}>
          {item.label}
        </Text>
        <Text style={[styles.rowDate, { color: colors.textSub }]}>
          {formatRelativeTime(item.date)}
        </Text>
      </View>

      {/* Badge variant inline (pattern SettingsCoupling — View+Text + variantColor+'33') */}
      <View
        style={[
          styles.variantBadge,
          { backgroundColor: variantColor + '33' },
        ]}
      >
        <Text style={[styles.variantBadgeText, { color: variantColor }]}>
          {t(variantLabelKey)}
        </Text>
      </View>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// MuseumModal — composant principal
// ---------------------------------------------------------------------------

export function MuseumModal({ visible, onClose, profileId, vault }: MuseumModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const [sections, setSections] = useState<MuseumSection[]>([]);

  // Chargement des données quand le modal s'ouvre
  useEffect(() => {
    if (!visible || !profileId || !vault) {
      setSections([]);
      return;
    }

    let cancelled = false;
    const file = `gami-${profileId}.md`;

    vault.readFile(file).then((content) => {
      if (cancelled) return;
      const entries = parseMuseumEntries(content);
      const grouped = groupEntriesByWeek(entries);
      const mapped: MuseumSection[] = grouped.map((g) => ({
        title: g.weekLabel,
        data: g.data,
      }));
      setSections(mapped);
    }).catch(() => {
      if (!cancelled) setSections([]);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, profileId, vault]);

  const handleClose = useCallback(() => {
    Haptics.selectionAsync();
    onClose();
  }, [onClose]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.cardAlt }]}>
        <Text style={[styles.sectionHeaderText, { color: colors.textSub }]}>
          {section.title}
        </Text>
      </View>
    ),
    [colors],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: MuseumEntry; index: number }) => (
      <MuseumRow item={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: MuseumEntry, index: number) => `${item.date.getTime()}-${index}`,
    [],
  );

  const ListEmptyComponent = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{'🏛️'}</Text>
      <Text style={[styles.emptyText, { color: colors.textSub }]}>
        {t('museum.empty', 'Aucun effet enregistré — complète des tâches pour remplir le musée !')}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        {/* Header maison — PAS ModalHeader (per anti-pattern RESEARCH.md) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Text style={[styles.closeIcon, { color: colors.text }]}>{'✕'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('museum.title', 'Musée des effets')}
          </Text>
          {/* Spacer pour centrer le titre */}
          <View style={styles.closeBtn} />
        </View>

        {/* SectionList directement dans SafeAreaView (Pitfall 3 RESEARCH.md : PAS dans ScrollView) */}
        <SectionList
          sections={sections}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles statiques
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    flex: 1,
    textAlign: 'center',
  },
  sectionHeader: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  sectionHeaderText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: Spacing['3xl'],
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  rowIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  rowContent: {
    flex: 1,
    gap: Spacing.xxs,
  },
  rowLabel: {
    fontSize: FontSize.body,
  },
  rowDate: {
    fontSize: FontSize.caption,
  },
  variantBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  variantBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['5xl'],
    paddingHorizontal: Spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
  },
});
