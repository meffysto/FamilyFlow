/**
 * GlobalSearch.tsx — Recherche globale dans le vault
 *
 * Modal plein écran avec barre de recherche + résultats temps réel.
 * Utilise searchVault() de lib/search.ts (local, pas de debounce).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { searchVault, type SearchResult, type SearchInput, type SearchResultType } from '../lib/search';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

/** Map type → route de navigation détaillée */
const ROUTE_MAP: Record<SearchResultType, string> = {
  task: '/(tabs)/tasks',
  rdv: '/(tabs)/rdv',
  recipe: '/(tabs)/meals',
  stock: '/(tabs)/stock',
  meal: '/(tabs)/meals',
  course: '/(tabs)/meals',
  memory: '/(tabs)/more',
  defi: '/(tabs)/defis',
  wishlist: '/(tabs)/wishlist',
};

/** Params de navigation par type */
const ROUTE_PARAMS: Partial<Record<SearchResultType, Record<string, string>>> = {
  recipe: { tab: 'recettes' },
  meal: { tab: 'repas' },
  course: { tab: 'courses' },
};

/** Labels français par type */
const TYPE_LABELS: Record<SearchResultType, string> = {
  task: 'Tâche',
  rdv: 'Rendez-vous',
  recipe: 'Recette',
  stock: 'Stock',
  meal: 'Repas',
  course: 'Course',
  memory: 'Souvenir',
  defi: 'Défi',
  wishlist: 'Souhait',
};

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

export const GlobalSearch = React.memo(function GlobalSearch({ visible, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const vault = useVault();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const searchInput: SearchInput = useMemo(() => ({
    tasks: vault.tasks,
    menageTasks: vault.menageTasks,
    rdvs: vault.rdvs,
    stock: vault.stock,
    meals: vault.meals,
    courses: vault.courses,
    memories: vault.memories,
    defis: vault.defis,
    wishlistItems: vault.wishlistItems,
    recipes: vault.recipes,
  }), [vault.tasks, vault.menageTasks, vault.rdvs, vault.stock, vault.meals,
    vault.courses, vault.memories, vault.defis, vault.wishlistItems, vault.recipes]);

  const results = useMemo(() => searchVault(query, searchInput), [query, searchInput]);

  const handleSelect = useCallback((result: SearchResult) => {
    Keyboard.dismiss();
    onClose();
    setQuery('');

    const route = ROUTE_MAP[result.type];
    const params = ROUTE_PARAMS[result.type];

    if (params) {
      router.push({ pathname: route as any, params });
    } else {
      router.push(route as any);
    }
  }, [router, onClose]);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  const renderResult = useCallback(({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[styles.resultRow, { borderBottomColor: colors.separator }]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${TYPE_LABELS[item.type]} : ${item.title}`}
    >
      <Text style={styles.resultIcon}>{item.icon}</Text>
      <View style={styles.resultContent}>
        <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.resultSnippet, { color: colors.textMuted }]} numberOfLines={1}>
          {item.snippet}
        </Text>
      </View>
      <View style={[styles.typeBadge, { backgroundColor: colors.cardAlt }]}>
        <Text style={[styles.typeLabel, { color: colors.textSub }]}>
          {TYPE_LABELS[item.type]}
        </Text>
      </View>
    </TouchableOpacity>
  ), [colors, handleSelect]);

  const keyExtractor = useCallback((_: SearchResult, index: number) => `${_.type}-${_.title}-${index}`, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      onShow={() => {
        setTimeout(() => inputRef.current?.focus(), 100);
      }}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        {/* Header avec barre de recherche */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Rechercher partout..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
              accessibilityLabel="Rechercher dans le vault"
              accessibilityRole="search"
            />
          </View>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Fermer la recherche"
            accessibilityRole="button"
          >
            <Text style={[styles.cancelBtn, { color: colors.textSub }]}>Annuler</Text>
          </TouchableOpacity>
        </View>

        {/* Résultats */}
        {query.trim().length < 2 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyIcon]}>🔍</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Tapez au moins 2 caractères pour chercher
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textFaint }]}>
              Tâches, RDV, recettes, stock, repas, courses, souvenirs, défis, souhaits
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤷</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Aucun résultat pour "{query}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderResult}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <Text style={[styles.resultCount, { color: colors.textFaint }]}>
                {results.length} résultat{results.length > 1 ? 's' : ''}
              </Text>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    gap: Spacing.xl,
    borderBottomWidth: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.base,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    height: 42,
  },
  searchIcon: {
    fontSize: FontSize.sm,
    marginRight: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    paddingVertical: 0,
  },
  cancelBtn: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  listContent: {
    paddingBottom: Spacing['6xl'],
  },
  resultCount: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    gap: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: {
    fontSize: FontSize.title,
    width: 32,
    textAlign: 'center',
  },
  resultContent: {
    flex: 1,
    gap: Spacing.xxs,
  },
  resultTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  resultSnippet: {
    fontSize: FontSize.caption,
  },
  typeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  typeLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['5xl'],
    gap: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    lineHeight: 20,
  },
});
