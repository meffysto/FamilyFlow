/**
 * FarmCodexModal.tsx — Codex ferme (Phase 17, per D-01 à D-16)
 *
 * Modale pageSheet consommant CODEX_CONTENT de Phase 16.
 * - Tabs horizontaux scrollables pour les 10 catégories (D-01)
 * - Recherche cross-catégories avec normalisation accents (D-08, D-09, D-10)
 * - FlatList 2-col virtualisée (D-01, CODEX-09)
 * - Cards compactes icône + nom, silhouettes pour dropOnly non découvert (D-03, D-06)
 * - Tap carte → CodexEntryDetailModal (D-02)
 * - Footer bouton replay tutoriel (D-15) → resetScreen('farm_tutorial') + onClose
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { useHelp } from '../../contexts/HelpContext';
import { CODEX_CONTENT } from '../../lib/codex/content';
import type { CodexEntry, CodexKind } from '../../lib/codex/types';
import { searchCodex, filterByKind } from '../../lib/codex/search';
import {
  computeDiscoveredCodexIds,
  type DiscoverySource,
} from '../../lib/codex/discovery';
import { CodexEntryDetailModal } from './CodexEntryDetailModal';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

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

interface FarmCodexModalProps {
  visible: boolean;
  onClose: () => void;
  profile: DiscoverySource | null;
}

/** Ordre des tabs aligné sur CodexKind (D-01) */
const TAB_ORDER: CodexKind[] = [
  'crop',
  'animal',
  'building',
  'craft',
  'tech',
  'companion',
  'loot',
  'seasonal',
  'saga',
  'quest',
  'adventure',
];

export function FarmCodexModal({
  visible,
  onClose,
  profile,
}: FarmCodexModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { resetScreen } = useHelp();

  const [activeTab, setActiveTab] = useState<CodexKind>('crop');
  const [query, setQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<CodexEntry | null>(null);

  // D-06 : calcul lazy à l'ouverture — set vide tant que la modale est fermée
  const discoveredIds = useMemo(
    () => (visible ? computeDiscoveredCodexIds(profile) : new Set<string>()),
    [visible, profile],
  );

  // D-08 : si query non vide → override des tabs, liste plate cross-catégories
  const displayedEntries = useMemo(() => {
    if (query.trim().length > 0) {
      return searchCodex(query, t, CODEX_CONTENT);
    }
    return filterByKind(CODEX_CONTENT, activeTab);
  }, [query, activeTab, t]);

  const handleSelectEntry = useCallback((entry: CodexEntry) => {
    Haptics.selectionAsync();
    setSelectedEntry(entry);
  }, []);

  const handleReplayTutorial = useCallback(async () => {
    Haptics.impactAsync();
    await resetScreen('farm_tutorial');
    onClose();
  }, [resetScreen, onClose]);

  const handleTabPress = useCallback((kind: CodexKind) => {
    Haptics.selectionAsync();
    setActiveTab(kind);
  }, []);

  // Carte grille 2-col — narrowing TS : item.kind === 'animal' restreint à AnimalEntry
  // qui expose dropOnly: boolean (lib/codex/types.ts). Pas besoin de cast.
  const renderItem = useCallback(
    ({ item, index }: { item: CodexEntry; index: number }) => {
      const isDropOnly = item.kind === 'animal' && item.dropOnly;
      const isLocked = isDropOnly && !discoveredIds.has(item.sourceId);
      return (
        <Animated.View
          entering={FadeInDown.delay(index * 20)}
          style={styles.cardWrap}
        >
          <Pressable
            onPress={() => handleSelectEntry(item)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
              Shadows.sm,
            ]}
          >
            {!isLocked && item.spriteRef ? (
              <Image
                source={item.spriteRef as ImageSourcePropType}
                style={styles.cardSprite}
                resizeMode="contain"
                fadeDuration={0}
              />
            ) : (
              <Text
                style={[styles.cardIcon, isLocked && styles.cardIconLocked]}
              >
                {isLocked ? '❓' : item.iconRef ?? '❓'}
              </Text>
            )}
            <Text
              style={[styles.cardName, { color: colors.text }]}
              numberOfLines={2}
            >
              {isLocked ? t('codex:card.locked') : t(item.nameKey)}
            </Text>
            {query.trim().length > 0 && (
              <Text style={[styles.cardKind, { color: colors.textSub }]}>
                {t(`codex:tabs.${item.kind}`)}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      );
    },
    [colors, discoveredIds, handleSelectEntry, query, t],
  );

  const keyExtractor = useCallback((item: CodexEntry) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <AwningStripes />
        <View style={styles.parchment}>
        {/* Bouton fermer */}
        <TouchableOpacity
          style={styles.farmCloseBtn}
          onPress={() => { Haptics.selectionAsync(); onClose(); }}
          activeOpacity={0.8}
        >
          <Text style={styles.farmCloseBtnText}>{'✕'}</Text>
        </TouchableOpacity>

        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.farmHeader}>
          <Text style={styles.farmTitle}>
            {t('codex:modal.title')}
          </Text>
        </View>

        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('codex:search.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {/* Tabs horizontaux — masqués si recherche active (D-08) */}
        {query.trim().length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsRow}
          >
            {TAB_ORDER.map((kind) => {
              const isActive = activeTab === kind;
              return (
                <TouchableOpacity
                  key={kind}
                  onPress={() => handleTabPress(kind)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: isActive
                        ? colors.text
                        : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      {
                        color: isActive ? colors.bg : colors.text,
                      },
                    ]}
                  >
                    {t(`codex:tabs.${kind}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* FlatList 2-col (D-01, CODEX-09) */}
        <FlatList
          data={displayedEntries}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptyText, { color: colors.textSub }]}>
                {t('codex:search.empty', { query })}
              </Text>
            </View>
          }
        />

        {/* Footer : bouton replay tutoriel (D-15) */}
        <View
          style={[
            styles.footer,
            { borderTopColor: colors.text + '22' },
          ]}
        >
          <TouchableOpacity
            onPress={handleReplayTutorial}
            style={[
              styles.replayBtn,
              { backgroundColor: colors.text },
            ]}
          >
            <Text style={[styles.replayLabel, { color: colors.bg }]}>
              {t('codex:tutorial.replay')}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </View>

      {/* Mini-modal détail (D-02) */}
      <CodexEntryDetailModal
        visible={selectedEntry !== null}
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </Modal>
  );
}

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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: {
    fontSize: FontSize.lg,
    marginRight: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    paddingVertical: Spacing.xs,
  },
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabsRow: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  tab: {
    height: 36,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  grid: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  cardWrap: {
    flex: 1,
    padding: Spacing.xs,
  },
  card: {
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  cardIconLocked: {
    opacity: 0.3,
  },
  cardSprite: {
    width: 56,
    height: 56,
    marginBottom: Spacing.md,
    // pixel art : rendu net sans interpolation (iOS/Android respectent le flag)
    // @ts-ignore — imageRendering n'est pas dans les types RN mais passe à iOS
    imageRendering: 'pixelated',
  },
  cardName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  cardKind: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  footer: {
    padding: Spacing['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replayBtn: {
    paddingVertical: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  replayLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
