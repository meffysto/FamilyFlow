/**
 * PreDepartView — écran "tu fais les courses pour <liste>".
 *
 * Préparation avant le mode magasin :
 *  - Header parchemin (eyebrow handwrite + titre serif)
 *  - Compteur done/total + estimation prix restant
 *  - Liste des sections collapsed (preview rayon par rayon avec compteur)
 *  - Sélecteur de liste si plusieurs listes actives (pills horizontales)
 *  - CTA primaire "Démarrer les courses" + secondaire "Modifier mon parcours"
 *
 * Pas de suggestions intelligentes V1 (cf. README handoff) — pas de
 * tracking de cadence d'achat dans le data model actuel.
 */

import { Maximize2, Minimize2, Plus, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontFamily, FontWeight } from '../constants/typography';
import type { CourseItem } from '../lib/types';
import type { CadenceSuggestion } from '../lib/courses-suggestions';

interface ListPill {
  id: string;
  nom: string;
  remainingCount: number;
}

interface Props {
  listName: string;
  /** Liste de listes pour les pills sélection magasin (optionnel — si 1 seule, hidden). */
  lists?: ListPill[];
  activeListId?: string | null;
  onSwitchList?: (id: string) => void;

  sections: string[];
  itemsBySection: Record<string, CourseItem[]>;
  parcours?: string[];

  remainingEstimate?: number;
  formatPrice?: (n: number) => string;

  /** Suggestions cadence-based (vide si pas d'historique). */
  suggestions?: CadenceSuggestion[];
  /** Ajoute un produit suggéré à la liste. Renvoie une promise pour gérer le loader. */
  onAddSuggestion?: (label: string) => Promise<void> | void;

  onStart: () => void;
  onEditParcours: () => void;
  onClose: () => void;
}

export function PreDepartView({
  listName,
  lists,
  activeListId,
  onSwitchList,
  sections: rawSections,
  itemsBySection,
  parcours,
  remainingEstimate,
  formatPrice,
  suggestions,
  onAddSuggestion,
  onStart,
  onEditParcours,
  onClose,
}: Props) {
  const { colors, primary, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const handleAddSuggestion = async (sugg: CadenceSuggestion) => {
    if (addedKeys.has(sugg.key)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAddedKeys(prev => new Set(prev).add(sugg.key));
    try { await onAddSuggestion?.(sugg.label); }
    catch {
      // rollback en cas d'échec
      setAddedKeys(prev => {
        const next = new Set(prev);
        next.delete(sugg.key);
        return next;
      });
    }
  };

  const visibleSuggestions = useMemo(
    () => (suggestions ?? []).filter(s => !addedKeys.has(s.key) || addedKeys.has(s.key)),
    // on garde dans la liste même après ajout pour montrer l'état "ajouté"
    [suggestions, addedKeys],
  );

  // Sections triées selon le parcours appris (mêmes règles que ShoppingModeView)
  const sections = useMemo(() => {
    if (!parcours || parcours.length === 0) return rawSections;
    const present = new Set(rawSections);
    const ordered = parcours.filter(s => present.has(s));
    const orderedSet = new Set(ordered);
    const tail = rawSections.filter(s => !orderedSet.has(s));
    return [...ordered, ...tail];
  }, [rawSections, parcours]);

  const { totalCount, doneCount } = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const s of sections) {
      const items = itemsBySection[s] ?? [];
      total += items.length;
      done += items.filter(i => i.completed).length;
    }
    return { totalCount: total, doneCount: done };
  }, [sections, itemsBySection]);

  const heroTopColor = isDark ? 'rgba(232, 200, 88, 0.10)' : colors.brand.miel;
  const showListPills = lists && lists.length > 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />

      {/* ─── Hero parchemin ─────────────────────────────────────── */}
      <LinearGradient
        colors={[heroTopColor, colors.bg]}
        style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroTitleBlock}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              tu fais les courses pour
            </Text>
            <Text
              style={[styles.heroList, { color: colors.text }]}
              numberOfLines={1}
            >
              {listName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClose();
            }}
            style={[styles.heroClose, { backgroundColor: primary + '1F' }]}
            activeOpacity={0.6}
            accessibilityLabel="Fermer"
            accessibilityRole="button"
            hitSlop={10}
          >
            <Minimize2 size={20} color={primary} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressBlock}>
          <Text style={[styles.progressDone, { color: primary }]}>
            {doneCount}
            <Text style={[styles.progressTotal, { color: colors.textMuted }]}>
              {' '}/ {totalCount}
            </Text>
          </Text>
          {remainingEstimate !== undefined && remainingEstimate > 0 && formatPrice && (
            <Text style={[styles.progressEstimate, { color: colors.text }]}>
              ≈ {formatPrice(remainingEstimate)} restants
            </Text>
          )}
        </View>
      </LinearGradient>

      {/* ─── Pills sélecteur de liste ──────────────────────────── */}
      {showListPills && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScroll}
        >
          {lists!.map((l) => {
            const active = l.id === activeListId;
            return (
              <TouchableOpacity
                key={l.id}
                onPress={() => {
                  if (!active) {
                    Haptics.selectionAsync().catch(() => {});
                    onSwitchList?.(l.id);
                  }
                }}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active ? primary : colors.card,
                    borderColor: active ? primary : colors.border,
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: active ? colors.onPrimary : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {l.nom}
                </Text>
                {l.remainingCount > 0 && (
                  <View
                    style={[
                      styles.pillBadge,
                      {
                        backgroundColor: active
                          ? colors.onPrimary + '33'
                          : primary + '1F',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBadgeText,
                        { color: active ? colors.onPrimary : primary },
                      ]}
                    >
                      {l.remainingCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Preview rayons ────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 200 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Suggestions cadence ───────────────────────────────── */}
        {visibleSuggestions.length > 0 && (
          <View style={styles.suggestionsBlock}>
            <View style={styles.suggestionsHeader}>
              <Sparkles size={16} color={primary} strokeWidth={2.4} />
              <Text style={[styles.suggestionsTitle, { color: colors.text }]}>
                tu en achètes souvent
              </Text>
            </View>
            <View style={styles.suggestionsList}>
              {visibleSuggestions.map((s) => {
                const added = addedKeys.has(s.key);
                return (
                  <View
                    key={s.key}
                    style={[
                      styles.suggestionCard,
                      {
                        backgroundColor: added ? primary + '14' : colors.card,
                        borderColor: added ? primary + '55' : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.suggestionTextBlock}>
                      <Text
                        style={[styles.suggestionLabel, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                      <Text
                        style={[styles.suggestionReason, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {s.reason}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleAddSuggestion(s)}
                      disabled={added}
                      style={[
                        styles.suggestionBtn,
                        { backgroundColor: added ? primary + '33' : primary },
                      ]}
                      activeOpacity={0.75}
                      accessibilityLabel={
                        added ? `${s.label} ajouté` : `Ajouter ${s.label} à la liste`
                      }
                      hitSlop={8}
                    >
                      {added ? (
                        <Text style={[styles.suggestionBtnCheck, { color: primary }]}>✓</Text>
                      ) : (
                        <Plus size={18} color={colors.onPrimary} strokeWidth={2.6} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
          ton parcours dans cette liste
        </Text>
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {sections.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              la liste est vide
            </Text>
          ) : (
            sections.map((section, idx) => {
              const items = itemsBySection[section] ?? [];
              if (items.length === 0) return null;
              const sectionDone = items.filter(i => i.completed).length;
              return (
                <View
                  key={section}
                  style={[
                    styles.previewRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <View style={[styles.previewNum, { backgroundColor: colors.brand.wash }]}>
                    <Text style={[styles.previewNumText, { color: colors.text }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.previewSection, { color: colors.text }]} numberOfLines={1}>
                    {section}
                  </Text>
                  <Text style={[styles.previewCount, { color: colors.textMuted }]}>
                    {sectionDone}/{items.length}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ─── CTA sticky ────────────────────────────────────────── */}
      <View
        style={[
          styles.ctaBar,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onStart();
          }}
          disabled={totalCount === 0}
          style={[
            styles.ctaPrimary,
            { backgroundColor: totalCount === 0 ? colors.textFaint : primary },
          ]}
          activeOpacity={0.85}
        >
          <Maximize2 size={20} color={colors.onPrimary} strokeWidth={2.4} />
          <Text style={[styles.ctaPrimaryText, { color: colors.onPrimary }]}>
            Démarrer les courses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onEditParcours();
          }}
          style={styles.ctaSecondary}
          activeOpacity={0.6}
        >
          <Text style={[styles.ctaSecondaryText, { color: primary }]}>
            Modifier mon parcours
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroTitleBlock: { flex: 1, paddingTop: 2 },
  eyebrow: {
    fontFamily: FontFamily.handwrite,
    fontSize: 18,
    lineHeight: 18,
    marginBottom: 2,
  },
  heroList: {
    fontFamily: FontFamily.serif,
    fontSize: 32,
    lineHeight: 38,
  },
  heroClose: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.md,
  },
  progressDone: {
    fontFamily: FontFamily.serif,
    fontSize: 44,
    lineHeight: 48,
    flex: 1,
  },
  progressTotal: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
  },
  progressEstimate: {
    fontFamily: FontFamily.handwrite,
    fontSize: 19,
  },
  pillsScroll: {
    flexGrow: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
  },
  pillText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FontWeight.medium,
    maxWidth: 140,
    paddingVertical: 1,
  },
  pillBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBadgeText: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
  },
  previewLabel: {
    fontFamily: FontFamily.handwrite,
    fontSize: 17,
    marginBottom: 8,
  },
  previewCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  previewNum: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewNumText: {
    fontFamily: FontFamily.serif,
    fontSize: 14,
  },
  previewSection: {
    flex: 1,
    fontSize: 15,
    fontWeight: FontWeight.medium,
  },
  previewCount: {
    fontFamily: FontFamily.handwrite,
    fontSize: 17,
  },
  empty: {
    padding: Spacing.xl,
    textAlign: 'center',
    fontFamily: FontFamily.handwrite,
    fontSize: 17,
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    gap: 8,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: FontWeight.semibold,
  },
  ctaSecondary: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    fontSize: 15,
    fontWeight: FontWeight.medium,
  },
  suggestionsBlock: {
    marginBottom: Spacing.xl,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
  },
  suggestionsList: {
    gap: 8,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: Spacing.md,
  },
  suggestionTextBlock: {
    flex: 1,
  },
  suggestionLabel: {
    fontSize: 15,
    fontWeight: FontWeight.semibold,
  },
  suggestionReason: {
    fontFamily: FontFamily.handwrite,
    fontSize: 16,
    lineHeight: 18,
    marginTop: 2,
  },
  suggestionBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionBtnCheck: {
    fontSize: 18,
    fontWeight: '900',
  },
});
