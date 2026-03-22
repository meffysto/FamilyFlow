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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAI } from '../contexts/AIContext';
import { searchVaultWithFilters, type SearchResult, type SearchInput, type SearchResultType, type SearchOutput } from '../lib/search';
import type { AIMessage, VaultContext as AIVaultContext } from '../lib/ai-service';
import { useParentalControls } from '../contexts/ParentalControlsContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { MarkdownText } from './ui/MarkdownText';

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
  const { primary, colors } = useThemeColors();
  const vault = useVault();
  const ai = useAI();
  const [query, setQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiHistory, setAiHistory] = useState<AIMessage[]>([]);
  const inputRef = useRef<TextInput>(null);

  const isChildMode = vault.activeProfile?.role === 'enfant' || vault.activeProfile?.role === 'ado';
  const { isAllowed } = useParentalControls();
  const role = vault.activeProfile?.role ?? 'adulte';

  // Filtrer les données de recherche en mode enfant (sauf si autorisé)
  const searchInput: SearchInput = useMemo(() => {
    const nameLower = vault.activeProfile?.name?.toLowerCase() ?? '';
    const profileId = vault.activeProfile?.id ?? '';

    if (!isChildMode || !nameLower || isAllowed('recherche', role as 'enfant' | 'ado')) {
      return {
        tasks: vault.tasks,
        rdvs: vault.rdvs,
        stock: vault.stock,
        meals: vault.meals,
        courses: vault.courses,
        memories: vault.memories,
        defis: vault.defis,
        wishlistItems: vault.wishlistItems,
        recipes: vault.recipes,
        profiles: vault.profiles,
      };
    }

    return {
      tasks: vault.tasks.filter((t) => {
        const f = t.sourceFile.toLowerCase();
        return f.includes(nameLower) || f.includes('maison');
      }),
      rdvs: vault.rdvs.filter((r) => r.enfant.toLowerCase() === nameLower),
      stock: [], // masqué pour les enfants
      meals: vault.meals,
      courses: vault.courses,
      memories: vault.memories.filter((m) => m.enfant.toLowerCase() === nameLower),
      defis: vault.defis.filter((d) =>
        d.participants.length === 0 || d.participants.includes(profileId),
      ),
      wishlistItems: vault.wishlistItems.filter((w) => w.profileName.toLowerCase() === nameLower),
      recipes: vault.recipes,
      profiles: vault.profiles,
    };
  }, [vault.tasks, vault.rdvs, vault.stock, vault.meals,
    vault.courses, vault.memories, vault.defis, vault.wishlistItems, vault.recipes,
    vault.profiles, isChildMode, vault.activeProfile]);

  const searchOutput: SearchOutput = useMemo(() => searchVaultWithFilters(query, searchInput), [query, searchInput]);
  const results = searchOutput.results;
  const activeFilters = searchOutput.filters;

  const aiVaultCtx: AIVaultContext = useMemo(() => ({
    tasks: vault.tasks,
    rdvs: vault.rdvs,
    stock: vault.stock,
    meals: vault.meals,
    courses: vault.courses,
    memories: vault.memories,
    defis: vault.defis,
    wishlistItems: vault.wishlistItems,
    recipes: vault.recipes,
    profiles: vault.profiles,
    activeProfile: vault.activeProfile,
    journalStats: vault.journalStats,
    healthRecords: vault.healthRecords,
  }), [vault.tasks, vault.rdvs, vault.stock, vault.meals,
    vault.courses, vault.memories, vault.defis, vault.wishlistItems, vault.recipes,
    vault.profiles, vault.activeProfile, vault.journalStats, vault.healthRecords]);

  const handleAskAI = useCallback(async () => {
    if (!query.trim() || !ai.isConfigured) return;
    Keyboard.dismiss();
    setAiError('');
    setAiAnswer('');
    const resp = await ai.ask(query, aiVaultCtx, aiHistory);
    if (resp.error) {
      setAiError(resp.error);
    } else {
      setAiAnswer(resp.text);
      setAiHistory((prev) => [
        ...prev,
        { role: 'user' as const, content: query },
        { role: 'assistant' as const, content: resp.text },
      ]);
    }
  }, [query, ai, aiVaultCtx, aiHistory]);

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
    setAiAnswer('');
    setAiError('');
    setAiHistory([]);
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

        {/* Badges filtres actifs */}
        {query.trim().length >= 2 && (activeFilters.dateFilter || activeFilters.personFilter) && (
          <View style={styles.filterRow}>
            {activeFilters.dateFilter && (
              <View style={[styles.filterChip, { backgroundColor: primary + '18', borderColor: primary + '40' }]}>
                <Text style={[styles.filterChipText, { color: primary }]}>
                  📅 {activeFilters.dateFilter.label}
                </Text>
              </View>
            )}
            {activeFilters.personFilter && (
              <View style={[styles.filterChip, { backgroundColor: primary + '18', borderColor: primary + '40' }]}>
                <Text style={[styles.filterChipText, { color: primary }]}>
                  👤 {activeFilters.personFilter.name}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bouton IA en haut (toujours visible si configuré + query) */}
        {ai.isConfigured && query.trim().length >= 2 && (
          <View style={styles.aiSection}>
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: primary + '15', borderColor: primary + '40' }]}
              onPress={handleAskAI}
              disabled={ai.isLoading}
              activeOpacity={0.7}
            >
              {ai.isLoading ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Text style={[styles.aiBtnText, { color: primary }]}>
                  🤖 Demander à l'IA : "{query.length > 30 ? query.slice(0, 30) + '…' : query}"
                </Text>
              )}
            </TouchableOpacity>
            {aiError ? (
              <Text style={[styles.aiError, { color: colors.error }]}>{aiError}</Text>
            ) : null}
            {aiAnswer ? (
              <View style={[styles.aiAnswer, Shadows.sm, { backgroundColor: colors.card }]}>
                <Text style={[styles.aiAnswerLabel, { color: primary }]}>Réponse IA</Text>
                <MarkdownText style={{ color: colors.text }}>{aiAnswer}</MarkdownText>
              </View>
            ) : null}
          </View>
        )}

        {/* Résultats */}
        {query.trim().length < 2 ? (
          <View style={styles.emptyHintContainer}>
            <Text style={[styles.emptyHint, { color: colors.textFaint }]}>
              Tâches, RDV, recettes, stock, repas, courses, souvenirs, défis, souhaits
              {ai.isConfigured ? '\n\nOu posez une question à l\'assistant IA' : ''}
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
              results.length > 0 ? (
                <Text style={[styles.resultCount, { color: colors.textFaint }]}>
                  {results.length} résultat{results.length > 1 ? 's' : ''}
                </Text>
              ) : (
                <View style={styles.noResults}>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Aucun résultat pour "{query}"
                  </Text>
                </View>
              )
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
  emptyHintContainer: {
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing['3xl'],
    alignItems: 'center',
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
  noResults: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  filterChipText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  aiSection: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  aiDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.md,
  },
  aiBtn: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.base,
    borderWidth: 1,
    alignItems: 'center',
  },
  aiBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  aiError: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  aiAnswer: {
    padding: Spacing['2xl'] + 2,
    borderRadius: Radius.xl,
    gap: Spacing.md,
  },
  aiAnswerLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
});
