---
phase: 17-codex-ui
plan: 03
type: execute
wave: 2
depends_on:
  - 17-01
  - 17-02
files_modified:
  - components/mascot/FarmCodexModal.tsx
  - components/mascot/CodexEntryDetailModal.tsx
  - app/(tabs)/tree.tsx
autonomous: true
requirements:
  - CODEX-06
  - CODEX-07
  - CODEX-08
  - CODEX-09
  - CODEX-10
must_haves:
  truths:
    - "Un bouton 📖 apparaît comme 5e item du HUD ferme à droite de la saison"
    - "Taper sur 📖 ouvre FarmCodexModal en pageSheet drag-to-dismiss"
    - "Les 10 tabs de catégories sont scrollables horizontalement en haut de la modale"
    - "La FlatList affiche les entrées en grille 2 colonnes (numColumns={2})"
    - "Taper une carte ouvre CodexEntryDetailModal avec lore en haut, stats en bas"
    - "Les entrées dropOnly non découvertes affichent la silhouette '???'"
    - "Recherche avec accents (ex: 'cafe' matche 'Café') fonctionne cross-catégories"
    - "Le bouton 'Rejouer le tutoriel' en footer appelle resetScreen('farm_tutorial') puis onClose"
  artifacts:
    - path: "components/mascot/FarmCodexModal.tsx"
      provides: "Modale principale codex avec tabs + search + grille 2-col + footer tutoriel"
      min_lines: 250
      exports: ["FarmCodexModal"]
    - path: "components/mascot/CodexEntryDetailModal.tsx"
      provides: "Mini-modal détail avec switch exhaustif sur entry.kind"
      min_lines: 120
      exports: ["CodexEntryDetailModal"]
    - path: "app/(tabs)/tree.tsx"
      provides: "5e item HUD + useState showCodex + montage FarmCodexModal"
      contains: "FarmCodexModal"
  key_links:
    - from: "components/mascot/FarmCodexModal.tsx"
      to: "lib/codex/search.ts"
      via: "import { searchCodex, normalize }"
      pattern: "from ['\"].*codex/search"
    - from: "components/mascot/FarmCodexModal.tsx"
      to: "lib/codex/discovery.ts"
      via: "import { computeDiscoveredCodexIds }"
      pattern: "from ['\"].*codex/discovery"
    - from: "components/mascot/FarmCodexModal.tsx"
      to: "lib/codex/content.ts"
      via: "import { CODEX_CONTENT }"
      pattern: "CODEX_CONTENT"
    - from: "components/mascot/FarmCodexModal.tsx"
      to: "contexts/HelpContext.tsx"
      via: "useHelp().resetScreen"
      pattern: "resetScreen\\(['\"]farm_tutorial"
    - from: "app/(tabs)/tree.tsx"
      to: "components/mascot/FarmCodexModal.tsx"
      via: "import FarmCodexModal + <FarmCodexModal visible={showCodex} />"
      pattern: "<FarmCodexModal"
---

<objective>
Construire la modale FarmCodexModal (squelette Modal pageSheet + search bar + tabs horizontaux + FlatList 2-col + footer replay tutoriel) et son mini-modal détail CodexEntryDetailModal (lore + stats via switch exhaustif sur entry.kind), puis l'intégrer dans app/(tabs)/tree.tsx comme 5e item du HUD ferme existant. Consomme les helpers de 17-01 et les clés i18n de 17-02.

Purpose: Livrer la fonctionnalité Phase 17 end-to-end — l'utilisateur peut ouvrir le codex depuis la ferme, naviguer, rechercher, voir le détail, et rejouer le tutoriel.
Output: 2 nouveaux composants + intégration HUD dans tree.tsx, zéro régression tsc.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/17-codex-ui/17-CONTEXT.md
@.planning/phases/17-codex-ui/17-01-SUMMARY.md
@.planning/phases/17-codex-ui/17-02-SUMMARY.md
@lib/codex/types.ts
@lib/codex/content.ts
@lib/codex/stats.ts
@components/mascot/CraftSheet.tsx
@components/mascot/TechTreeSheet.tsx
@components/mascot/BadgesSheet.tsx
@app/(tabs)/tree.tsx
@contexts/HelpContext.tsx

<interfaces>
From lib/codex/search.ts (Plan 17-01):
```typescript
export function normalize(input: string): string;
export function searchCodex(query: string, t: (key: string) => string, entries: CodexEntry[]): CodexEntry[];
export function filterByKind(entries: CodexEntry[], kind: CodexEntry['kind']): CodexEntry[];
```

From lib/codex/discovery.ts (Plan 17-01):
```typescript
export interface DiscoverySource {
  farmInventory?: Record<string, number> | null;
  harvestInventory?: Record<string, number> | null;
  farmCrops?: Array<{ cropId?: string } | string> | null;
  farmAnimals?: Array<{ animalId?: string } | string> | null;
  farmBuildings?: Array<{ buildingId?: string } | string> | null;
  completedSagas?: string[] | null;
}
export function computeDiscoveredCodexIds(source: DiscoverySource | null | undefined): Set<string>;
```

From lib/codex/types.ts (Phase 16):
```typescript
export type CodexKind = 'crop'|'animal'|'building'|'craft'|'tech'|'companion'|'loot'|'seasonal'|'saga'|'quest';
export interface CodexEntryBase { id: string; kind: CodexKind; sourceId: string; nameKey: string; loreKey: string; iconRef?: string; }
// Union discriminée CodexEntry avec variants par kind
export interface AnimalEntry extends CodexEntryBase { kind: 'animal'; subgroup: 'farm'|'fantasy'|'saga'; dropOnly: boolean; }
```

From lib/codex/content.ts (Phase 16):
```typescript
export const CODEX_CONTENT: CodexEntry[]; // 110 entrées
```

From lib/codex/stats.ts (Phase 16):
```typescript
// 9 getters anti-drift, ex:
export function getCropStats(sourceId: string): { growthDays: number; sellPrice: number; ... };
export function getBuildingStats(sourceId: string): { ... };
// etc. — lire le fichier pour la signature exacte de chaque getter par kind
```

From contexts/HelpContext.tsx:
```typescript
export function useHelp(): {
  resetScreen: (screenId: string) => Promise<void>;
  // ...
};
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Créer components/mascot/CodexEntryDetailModal.tsx (mini-modal détail)</name>
  <files>components/mascot/CodexEntryDetailModal.tsx</files>
  <read_first>
    - components/mascot/CraftSheet.tsx lignes 1-50 (pattern imports + Modal squelette)
    - components/mascot/TechTreeSheet.tsx (pattern Modal pageSheet secondaire + header close/title)
    - lib/codex/types.ts (union discriminée CodexEntry complète)
    - lib/codex/stats.ts (TOUS les getters pour le switch exhaustif)
    - .planning/phases/17-codex-ui/17-CONTEXT.md décisions D-04, D-05
  </read_first>
  <action>
    Créer `components/mascot/CodexEntryDetailModal.tsx` : mini-modal par-dessus FarmCodexModal, affichant le détail d'une entrée.

    Structure attendue :

    ```tsx
    /**
     * CodexEntryDetailModal.tsx — Mini-modal détail d'une entrée codex (Phase 17, per D-02/D-04/D-05)
     *
     * Pattern Stardew wiki : icône + nom en haut, lore narratif, stats brutes en bas.
     * Switch exhaustif sur entry.kind pour afficher les stats spécifiques à chaque variante.
     */

    import React from 'react';
    import { Modal, View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
    import { SafeAreaView } from 'react-native-safe-area-context';
    import { useTranslation } from 'react-i18next';
    import * as Haptics from 'expo-haptics';

    import { useThemeColors } from '../../contexts/ThemeContext';
    import type { CodexEntry } from '../../lib/codex/types';
    import {
      getCropStats,
      getAnimalStats,
      getBuildingStats,
      getCraftStats,
      getTechStats,
      getCompanionStats,
      getLootStats,
      getSeasonalStats,
      getSagaStats,
      getQuestStats,
    } from '../../lib/codex/stats';
    import { Spacing, Radius } from '../../constants/spacing';
    import { FontSize, FontWeight } from '../../constants/typography';
    import { Shadows } from '../../constants/shadows';

    interface CodexEntryDetailModalProps {
      visible: boolean;
      entry: CodexEntry | null;
      onClose: () => void;
    }

    export function CodexEntryDetailModal({ visible, entry, onClose }: CodexEntryDetailModalProps) {
      const { t } = useTranslation();
      const { colors, isDark } = useThemeColors();

      if (!entry) {
        return (
          <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View />
          </Modal>
        );
      }

      // Switch exhaustif pour les stats (D-05) — compilateur enforce la couverture
      const renderStats = (): React.ReactNode => {
        switch (entry.kind) {
          case 'crop': {
            const s = getCropStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'animal': {
            const s = getAnimalStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'building': {
            const s = getBuildingStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'craft': {
            const s = getCraftStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'tech': {
            const s = getTechStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'companion': {
            const s = getCompanionStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'loot': {
            const s = getLootStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'seasonal': {
            const s = getSeasonalStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'saga': {
            const s = getSagaStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          case 'quest': {
            const s = getQuestStats(entry.sourceId);
            return <StatsBlock rows={Object.entries(s)} colors={colors} />;
          }
          default: {
            // Exhaustiveness check
            const _exhaustive: never = entry;
            return null;
          }
        }
      };

      return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
          <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onClose(); }}
                style={styles.closeBtn}
                accessibilityLabel={t('codex.detail.close')}
              >
                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {t(entry.nameKey)}
              </Text>
              <View style={styles.closeBtn} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              {/* Icône + nom */}
              <View style={styles.iconWrap}>
                <Text style={styles.bigIcon}>{entry.iconRef ?? '❓'}</Text>
              </View>

              {/* Lore en haut (D-04) */}
              <Text style={[styles.sectionLabel, { color: colors.tint }]}>
                {t('codex.detail.lore')}
              </Text>
              <Text style={[styles.lore, { color: colors.text }]}>
                {t(entry.loreKey)}
              </Text>

              {/* Stats en bas (D-04) */}
              <Text style={[styles.sectionLabel, { color: colors.tint, marginTop: Spacing.xl }]}>
                {t('codex.detail.stats')}
              </Text>
              {renderStats()}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      );
    }

    // Sous-composant StatsBlock : rend une liste clé/valeur
    // NOTE : la borderBottomColor du statRow DOIT être inline (dérivée du thème), pas dans
    // StyleSheet.create — convention CLAUDE.md « jamais de hardcoded color ». Pattern identique
    // à celui déjà utilisé pour le footer (colors.text + '22').
    function StatsBlock({ rows, colors }: { rows: [string, unknown][]; colors: ReturnType<typeof useThemeColors>['colors'] }) {
      return (
        <View style={styles.statsBlock}>
          {rows.map(([key, value]) => (
            <View key={key} style={[styles.statRow, { borderBottomColor: colors.text + '22' }]}>
              <Text style={[styles.statKey, { color: colors.text }]}>{key}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{String(value)}</Text>
            </View>
          ))}
        </View>
      );
    }

    const styles = StyleSheet.create({
      safe: { flex: 1 },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
      },
      closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
      closeIcon: { fontSize: FontSize.xl, fontWeight: FontWeight.bold as any },
      title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold as any, flex: 1, textAlign: 'center' },
      content: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
      iconWrap: { alignItems: 'center', marginBottom: Spacing.xl },
      bigIcon: { fontSize: 72 },
      sectionLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold as any,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.sm,
      },
      lore: { fontSize: FontSize.md, lineHeight: 22 },
      statsBlock: { marginTop: Spacing.sm },
      statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        // borderBottomColor injecté inline depuis useThemeColors() (cf. StatsBlock)
      },
      statKey: { fontSize: FontSize.sm, opacity: 0.7 },
      statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold as any },
    });
    ```

    Contraintes :
    - TOUS les getters de lib/codex/stats.ts doivent être importés et utilisés dans le switch (D-05)
    - Si la signature réelle des getters diffère (ex: retourne null si sourceId inconnu), adapter avec `?? {}` avant Object.entries
    - Lire lib/codex/stats.ts AVANT d'écrire ce fichier pour adapter les noms exacts des getters
    - useThemeColors obligatoire (pas de couleur hardcodée)
    - Design tokens Spacing/FontSize/FontWeight partout (pas de 16, 20, etc.)
    - Commentaires FR
    - Si un getter n'existe pas encore dans lib/codex/stats.ts → fallback `renderStats` retourne `<Text>{t('codex.detail.stats')}: —</Text>` pour ce kind (ne PAS échouer à compiler)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "CodexEntryDetailModal" ; test -f components/mascot/CodexEntryDetailModal.tsx</automated>
  </verify>
  <acceptance_criteria>
    - Fichier `components/mascot/CodexEntryDetailModal.tsx` existe
    - `grep -q "export function CodexEntryDetailModal" components/mascot/CodexEntryDetailModal.tsx` retourne 0
    - `grep -q "switch (entry.kind)" components/mascot/CodexEntryDetailModal.tsx` retourne 0
    - `grep -qE "case 'crop'" components/mascot/CodexEntryDetailModal.tsx` retourne 0
    - `grep -qE "case 'quest'" components/mascot/CodexEntryDetailModal.tsx` retourne 0
    - `grep -q "useThemeColors" components/mascot/CodexEntryDetailModal.tsx` retourne 0
    - `grep -qE "#[0-9A-Fa-f]{3,8}" components/mascot/CodexEntryDetailModal.tsx` retourne 1 (zéro hex hardcodé — toutes les couleurs viennent de useThemeColors())
    - `grep -q "presentationStyle=\"pageSheet\"" components/mascot/CodexEntryDetailModal.tsx` retourne 0
    - `npx tsc --noEmit` ne produit AUCUNE nouvelle erreur dans ce fichier
  </acceptance_criteria>
  <done>
    Mini-modal créé, switch exhaustif sur 10 kinds, theme colors + design tokens, tsc clean.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Créer components/mascot/FarmCodexModal.tsx (modale principale)</name>
  <files>components/mascot/FarmCodexModal.tsx</files>
  <read_first>
    - components/mascot/CraftSheet.tsx lignes 97-250 (pattern principal sheet : state tabs, ScrollView catégorisé, mini-modal détail)
    - components/mascot/BadgesSheet.tsx (pattern cards compactes + FadeInDown)
    - components/mascot/TechTreeSheet.tsx (pattern Modal pageSheet racine)
    - components/mascot/CodexEntryDetailModal.tsx (créé en Task 1 — sera importé)
    - lib/codex/search.ts (searchCodex, filterByKind, normalize)
    - lib/codex/discovery.ts (computeDiscoveredCodexIds)
    - lib/codex/content.ts (CODEX_CONTENT)
    - lib/codex/types.ts (CodexKind, CodexEntry)
    - contexts/HelpContext.tsx lignes 1-50 + lignes 210-230 (useHelp + resetScreen signature)
    - contexts/VaultContext.tsx (useVault() shape du profil actif)
    - .planning/phases/17-codex-ui/17-CONTEXT.md (TOUTES les décisions D-01 à D-16)
  </read_first>
  <action>
    Créer `components/mascot/FarmCodexModal.tsx` : le composant principal Phase 17.

    Structure attendue (squelette pattern D-14) :

    ```tsx
    /**
     * FarmCodexModal.tsx — Codex ferme (Phase 17, per D-01 à D-16)
     *
     * Modale pageSheet consommant CODEX_CONTENT de Phase 16.
     * - Tabs horizontaux scrollables pour les 10 catégories (D-01)
     * - Recherche cross-catégories avec normalisation accents (D-08, D-09, D-10)
     * - FlatList 2-col virtualisée (D-01, CODEX-09)
     * - Cards compactes icône + nom, silhouettes pour dropOnly non découvert (D-03, D-06)
     * - Tap carte → CodexEntryDetailModal (D-02)
     * - Footer bouton replay tutoriel (D-15)
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
      Platform,
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
    import { computeDiscoveredCodexIds, type DiscoverySource } from '../../lib/codex/discovery';
    import { CodexEntryDetailModal } from './CodexEntryDetailModal';
    import { Spacing, Radius } from '../../constants/spacing';
    import { FontSize, FontWeight } from '../../constants/typography';
    import { Shadows } from '../../constants/shadows';

    interface FarmCodexModalProps {
      visible: boolean;
      onClose: () => void;
      profile: DiscoverySource | null;
    }

    const TAB_ORDER: CodexKind[] = [
      'crop', 'animal', 'building', 'craft', 'tech',
      'companion', 'loot', 'seasonal', 'saga', 'quest',
    ];

    export function FarmCodexModal({ visible, onClose, profile }: FarmCodexModalProps) {
      const { t } = useTranslation();
      const { colors, isDark } = useThemeColors();
      const { resetScreen } = useHelp();

      const [activeTab, setActiveTab] = useState<CodexKind>('crop');
      const [query, setQuery] = useState('');
      const [selectedEntry, setSelectedEntry] = useState<CodexEntry | null>(null);

      // D-06 : calcul lazy à l'ouverture
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

      // Carte grille 2-col
      const renderItem = useCallback(({ item, index }: { item: CodexEntry; index: number }) => {
        // TS narrowing : item.kind === 'animal' restreint item à AnimalEntry,
        // qui expose dropOnly: boolean (lib/codex/types.ts). Pas besoin de cast.
        const isDropOnly = item.kind === 'animal' && item.dropOnly;
        const isLocked = isDropOnly && !discoveredIds.has(item.sourceId);
        return (
          <Animated.View entering={FadeInDown.delay(index * 20)} style={styles.cardWrap}>
            <Pressable
              onPress={() => handleSelectEntry(item)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
                Shadows.sm,
              ]}
            >
              <Text style={[styles.cardIcon, isLocked && styles.cardIconLocked]}>
                {isLocked ? '❓' : (item.iconRef ?? '❓')}
              </Text>
              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
                {isLocked ? t('codex.card.locked') : t(item.nameKey)}
              </Text>
              {query.trim().length > 0 && (
                <Text style={[styles.cardKind, { color: colors.tint }]}>
                  {t(`codex.tabs.${item.kind}`)}
                </Text>
              )}
            </Pressable>
          </Animated.View>
        );
      }, [colors, discoveredIds, handleSelectEntry, query, t]);

      const keyExtractor = useCallback((item: CodexEntry) => item.id, []);

      return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
          <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onClose(); }}
                style={styles.closeBtn}
              >
                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('codex.modal.title')}
              </Text>
              <View style={styles.closeBtn} />
            </View>

            {/* Search bar */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('codex.search.placeholder')}
                placeholderTextColor={colors.text + '88'}
                style={[styles.searchInput, { color: colors.text }]}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Tabs horizontaux (masqués si recherche active — D-08) */}
            {query.trim().length === 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
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
                        { backgroundColor: isActive ? colors.tint : colors.surface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabLabel,
                          { color: isActive ? colors.background : colors.text },
                        ]}
                      >
                        {t(`codex.tabs.${kind}`)}
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
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    {t('codex.search.empty', { query })}
                  </Text>
                </View>
              }
            />

            {/* Footer : bouton replay tutoriel (D-15) */}
            <View style={[styles.footer, { borderTopColor: colors.text + '22' }]}>
              <TouchableOpacity
                onPress={handleReplayTutorial}
                style={[styles.replayBtn, { backgroundColor: colors.tint }]}
              >
                <Text style={[styles.replayLabel, { color: colors.background }]}>
                  {t('codex.tutorial.replay')}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

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
      safe: { flex: 1 },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
      },
      closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
      closeIcon: { fontSize: FontSize.xl, fontWeight: FontWeight.bold as any },
      title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold as any, flex: 1, textAlign: 'center' },
      searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
      },
      searchIcon: { fontSize: FontSize.md, marginRight: Spacing.sm },
      searchInput: { flex: 1, fontSize: FontSize.md, paddingVertical: Spacing.xs },
      tabsRow: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
      },
      tab: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        marginRight: Spacing.xs,
      },
      tabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold as any },
      grid: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
      cardWrap: { flex: 1, padding: Spacing.xs },
      card: {
        borderRadius: Radius.md,
        padding: Spacing.md,
        alignItems: 'center',
        minHeight: 110,
        justifyContent: 'center',
      },
      cardIcon: { fontSize: 40, marginBottom: Spacing.sm },
      cardIconLocked: { opacity: 0.3 },
      cardName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold as any, textAlign: 'center' },
      cardKind: { fontSize: FontSize.xs, marginTop: Spacing.xs, opacity: 0.7 },
      empty: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
      emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
      emptyText: { fontSize: FontSize.md, textAlign: 'center', paddingHorizontal: Spacing.xl },
      footer: {
        padding: Spacing.lg,
        borderTopWidth: StyleSheet.hairlineWidth,
      },
      replayBtn: {
        paddingVertical: Spacing.md,
        borderRadius: Radius.md,
        alignItems: 'center',
      },
      replayLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold as any },
    });
    ```

    Contraintes :
    - Import CODEX_CONTENT depuis lib/codex/content (PAS de duplication)
    - Import searchCodex/filterByKind depuis lib/codex/search (Plan 17-01)
    - Import computeDiscoveredCodexIds depuis lib/codex/discovery (Plan 17-01)
    - Import useHelp pour resetScreen (D-15)
    - FlatList avec numColumns={2} (CODEX-09)
    - Aucune couleur hardcodée (useThemeColors)
    - Design tokens Spacing/Radius/FontSize/FontWeight partout
    - Commentaires FR
    - Si Radius.pill ou Spacing['3xl'] n'existent pas dans les constants → utiliser la valeur disponible la plus proche après avoir lu constants/spacing.ts
    - Vérifier que `colors.surface` existe dans useThemeColors — sinon fallback `colors.card` ou `colors.background`
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "FarmCodexModal\.tsx" ; test -f components/mascot/FarmCodexModal.tsx</automated>
  </verify>
  <acceptance_criteria>
    - Fichier `components/mascot/FarmCodexModal.tsx` existe
    - `grep -q "export function FarmCodexModal" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "numColumns={2}" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "FlatList" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "searchCodex" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "computeDiscoveredCodexIds" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "resetScreen('farm_tutorial')" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "CodexEntryDetailModal" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "presentationStyle=\"pageSheet\"" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "codex.modal.title" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "codex.search.placeholder" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "codex.tutorial.replay" components/mascot/FarmCodexModal.tsx` retourne 0
    - `grep -q "useThemeColors" components/mascot/FarmCodexModal.tsx` retourne 0
    - `npx tsc --noEmit` ne produit AUCUNE nouvelle erreur dans ce fichier
  </acceptance_criteria>
  <done>
    FarmCodexModal créée, consomme helpers 17-01 + clés i18n 17-02, tsc clean.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Intégrer le bouton 📖 dans le HUD de app/(tabs)/tree.tsx</name>
  <files>app/(tabs)/tree.tsx</files>
  <read_first>
    - app/(tabs)/tree.tsx lignes 1-80 (imports existants)
    - app/(tabs)/tree.tsx lignes 2015-2110 (HUD + modals montées)
    - components/mascot/FarmCodexModal.tsx (signature du composant créé en Task 2)
    - .planning/phases/17-codex-ui/17-CONTEXT.md décisions D-12, D-13
  </read_first>
  <action>
    Modifier `app/(tabs)/tree.tsx` pour intégrer FarmCodexModal en trois endroits précis.

    **1. Ajouter l'import** (avec les autres imports de composants mascot, généralement autour des lignes 20-60) :

    ```tsx
    import { FarmCodexModal } from '../../components/mascot/FarmCodexModal';
    ```

    **2. Ajouter le useState** (à proximité des autres useState comme `showCraftSheet`, `showShop`, dans le corps du composant principal) :

    ```tsx
    const [showCodex, setShowCodex] = useState(false);
    ```

    **3. Ajouter le 5e item dans styles.hudContent** (après l'item season, ligne 2047 environ). Remplacer le bloc :

    ```tsx
              <View style={styles.hudItem}>
                <Text style={styles.hudEmoji}>{seasonInfo.emoji}</Text>
                <Text style={[styles.hudValue, { color: colors.text }]}>{t(seasonInfo.labelKey)}</Text>
              </View>
            </View>
          </View>
    ```

    Par :

    ```tsx
              <View style={styles.hudItem}>
                <Text style={styles.hudEmoji}>{seasonInfo.emoji}</Text>
                <Text style={[styles.hudValue, { color: colors.text }]}>{t(seasonInfo.labelKey)}</Text>
              </View>
              <TouchableOpacity
                style={styles.hudItem}
                onPress={() => { Haptics.selectionAsync(); setShowCodex(true); }}
                accessibilityLabel={t('codex.modal.title')}
              >
                <Text style={styles.hudEmoji}>{'📖'}</Text>
              </TouchableOpacity>
            </View>
          </View>
    ```

    **4. Monter la modale** près des autres `<Modal>` (~ligne 2085, après `<CraftSheet ... />`) :

    ```tsx
          {/* Codex ferme (Phase 17) */}
          <FarmCodexModal
            visible={showCodex}
            onClose={() => setShowCodex(false)}
            profile={profile ?? null}
          />
    ```

    Contraintes :
    - Vérifier que TouchableOpacity et Haptics sont déjà importés en haut du fichier (ils le sont très probablement — si absent, ajouter)
    - Réutiliser `styles.hudItem` et `styles.hudEmoji` existants (D-12) — ne PAS créer de nouveau style
    - Emoji 📖 (D-13)
    - Le `profile` passé à FarmCodexModal doit être l'objet profil actif (variable `profile` déjà utilisée autour — vérifier le nom exact dans le fichier)
    - Ne PAS toucher aux autres modals existantes
    - Pas de hardcoded color
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "tree\.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "import { FarmCodexModal }" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -q "showCodex" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -q "setShowCodex(true)" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -q "'📖'" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -q "<FarmCodexModal" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -q "codex.modal.title" "app/(tabs)/tree.tsx"` retourne 0
    - `npx tsc --noEmit` ne produit AUCUNE nouvelle erreur dans tree.tsx (les erreurs pré-existantes dans useVault.ts/MemoryEditor.tsx/cooklang.ts sont à ignorer per CLAUDE.md)
  </acceptance_criteria>
  <done>
    HUD intégré, modale montée, tsc clean sur tree.tsx, l'app peut compiler.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` : zéro nouvelle erreur (ignorer MemoryEditor.tsx, cooklang.ts, useVault.ts pré-existantes)
- Le bouton 📖 s'affiche comme 5e item du HUD ferme
- Taper le bouton ouvre FarmCodexModal
- Les tabs scrollables affichent les 10 catégories en FR
- Taper une carte ouvre CodexEntryDetailModal
- Rechercher "cafe" matche "Café" (normalisation accents)
- Taper "Rejouer le tutoriel" ferme la modale (effet du tutoriel lui-même sera Phase 18)
</verification>

<success_criteria>
- CODEX-06 : bouton 📖 dans HUD existant, pas de FAB
- CODEX-07 : Modal pageSheet + drag-to-dismiss + tabs catégories
- CODEX-08 : recherche normalisée accents/casse (via searchCodex), pas de Fuse.js
- CODEX-09 : FlatList numColumns={2}, pas de ScrollView pour la liste principale
- CODEX-10 : bouton footer appelle resetScreen + onClose
- Zéro nouvelle erreur tsc
</success_criteria>

<output>
Après complétion, créer `.planning/phases/17-codex-ui/17-03-SUMMARY.md` avec :
- Fichiers créés (FarmCodexModal, CodexEntryDetailModal) et leurs props
- Points d'intégration dans tree.tsx (3 modifications)
- Décisions D-01 à D-16 toutes câblées
- Requirements CODEX-06 à CODEX-10 tous satisfaits
- Notes pour Phase 18 (tutoriel) : le hook resetScreen est déjà branché, il suffit d'implémenter la réaction côté tutoriel
</output>
