/**
 * ShoppingModeView — mode focus liste in-place pour usage en magasin.
 *
 * Pas un modal : remplace le contenu de l'onglet courses (header + body)
 * tant que `showShoppingMode` est actif. Empêche la fermeture accidentelle
 * (pas de drag-to-dismiss) et garde l'écran allumé.
 *
 * Layout (option C, validée mockup) :
 *   - Hero warm avec eyebrow handwrite + nom de liste serif + chiffre 3/12
 *     en serif display + barre de progression + caption handwrite
 *     "il te reste lait, beurre, tomates et 6 autres".
 *   - Sections en cards individuelles arrondies (pas de box grise par
 *     section) avec checkbox 56×56 et texte 22pt.
 *   - Confettis "tu as tout pris 🎉" quand done === total.
 */

import { ChevronDown, Minimize2 } from 'lucide-react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontFamily, FontWeight } from '../constants/typography';
import type { CourseItem } from '../lib/types';

interface PriceInfo {
  price: number;
  stale: boolean;
}

interface Props {
  listName: string;
  sections: string[];
  itemsBySection: Record<string, CourseItem[]>;
  onToggle: (item: CourseItem) => void;
  onClose: () => void;
  priceByItemId?: Map<string, PriceInfo | null | undefined>;
  remainingEstimate?: number;
  formatPrice?: (n: number) => string;
  /** Ordre appris des sections (parcours magasin). Optionnel — fallback sur `sections`. */
  parcours?: string[];
  /** Callback déclenché quand toutes les cases sont cochées (après délai 700 ms).
   *  Reçoit l'ordre observé (déduit des timestamps de cochage), à utiliser pour le Bilan. */
  onComplete?: (observedOrder: string[]) => void;
  /** Callback "Modifier mon parcours" (pied de liste) — ouvre l'écran Mon parcours. */
  onEditParcours?: () => void;
  /** Pile d'articles cochés pendant la session — affiche un bouton "↶ rétablir". */
  undoStack?: { text: string; section: string }[];
  /** Restaure le dernier article coché. */
  onUndoLast?: () => void;
}

const SPRING_CONFIG = { damping: 18, stiffness: 220 } as const;

export function ShoppingModeView({
  listName,
  sections: rawSections,
  itemsBySection,
  onToggle,
  onClose,
  priceByItemId,
  remainingEstimate,
  formatPrice,
  parcours,
  onComplete,
  onEditParcours,
  undoStack,
  onUndoLast,
}: Props) {
  const { colors, primary, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  useKeepAwake();

  // Sections triées selon le parcours appris : d'abord celles présentes dans
  // `parcours[]` (ordre du parcours), puis celles non listées (nouvelles)
  // dans leur ordre d'origine.
  const sections = useMemo(() => {
    if (!parcours || parcours.length === 0) return rawSections;
    const present = new Set(rawSections);
    const ordered = parcours.filter(s => present.has(s));
    const orderedSet = new Set(ordered);
    const tail = rawSections.filter(s => !orderedSet.has(s));
    return [...ordered, ...tail];
  }, [rawSections, parcours]);

  const { doneCount, totalCount, nextItems, moreCount } = useMemo(() => {
    let done = 0;
    let total = 0;
    const remaining: string[] = [];
    for (const s of sections) {
      const items = itemsBySection[s] ?? [];
      total += items.length;
      for (const it of items) {
        if (it.completed) done++;
        else remaining.push(it.text);
      }
    }
    return {
      doneCount: done,
      totalCount: total,
      nextItems: remaining.slice(0, 3),
      moreCount: Math.max(0, remaining.length - 3),
    };
  }, [sections, itemsBySection]);

  const allDone = totalCount > 0 && doneCount === totalCount;
  const pct = totalCount > 0 ? doneCount / totalCount : 0;

  // Etat par rayon — done/total + flag "tout coché"
  const sectionStats = useMemo(() => {
    return sections
      .map((s) => {
        const items = itemsBySection[s] ?? [];
        const done = items.filter((i) => i.completed).length;
        return { section: s, total: items.length, done, all: items.length > 0 && done === items.length };
      })
      .filter((s) => s.total > 0);
  }, [sections, itemsBySection]);

  // Rayon courant = premier rayon non-terminé (ordre du parcours)
  const currentSection = useMemo(
    () => sectionStats.find((s) => !s.all)?.section ?? null,
    [sectionStats],
  );

  // Replis manuels (override utilisateur) + auto-fold des rayons terminés.
  // `manuallyOpened` permet de ré-ouvrir un rayon coché à 100 % qu'on veut consulter.
  const [manuallyToggled, setManuallyToggled] = useState<Set<string>>(new Set());
  const isCollapsed = useCallback(
    (sectionName: string, all: boolean) => {
      const overridden = manuallyToggled.has(sectionName);
      // auto-fold si tout coché ; toggle manuel inverse l'état auto
      return overridden ? !all : all;
    },
    [manuallyToggled],
  );
  const toggleSectionFold = useCallback((sectionName: string) => {
    Haptics.selectionAsync().catch(() => {});
    setManuallyToggled((prev) => {
      const next = new Set(prev);
      if (next.has(sectionName)) next.delete(sectionName);
      else next.add(sectionName);
      return next;
    });
  }, []);

  // Barre de progression animée
  const progressWidth = useSharedValue(pct);
  useEffect(() => {
    progressWidth.value = withSpring(pct, SPRING_CONFIG);
  }, [pct, progressWidth]);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  // Haptic célébration au passage à 100 %
  const wasAllDoneRef = useRef(false);
  useEffect(() => {
    if (allDone && !wasAllDoneRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasAllDoneRef.current = allDone;
  }, [allDone]);

  // Track ordre de cochage : timestamp par item, pour dériver l'ordre
  // observé des rayons à la fin de la session (Bilan post-courses).
  const checkedAtRef = useRef<Map<string, number>>(new Map());
  const handleToggle = (item: CourseItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!item.completed) {
      // on coche : enregistre le timestamp
      checkedAtRef.current.set(item.id, Date.now());
    } else {
      // on décoche : retire le timestamp (annulation utilisateur)
      checkedAtRef.current.delete(item.id);
    }
    onToggle(item);
  };

  // Déclenchement Bilan : quand allDone passe à true → délai 700 ms → onComplete
  const completedFiredRef = useRef(false);
  useEffect(() => {
    if (!allDone) {
      completedFiredRef.current = false;
      return;
    }
    if (completedFiredRef.current) return;
    completedFiredRef.current = true;

    const timer = setTimeout(() => {
      // Déduit l'ordre observé des rayons à partir des checkedAt timestamps :
      // pour chaque section, on prend le timestamp min de ses items, puis tri.
      const sectionFirstTime = new Map<string, number>();
      for (const s of sections) {
        const items = itemsBySection[s] ?? [];
        let min = Infinity;
        for (const it of items) {
          const t = checkedAtRef.current.get(it.id);
          if (t !== undefined && t < min) min = t;
        }
        if (min !== Infinity) sectionFirstTime.set(s, min);
      }
      const observed = [...sectionFirstTime.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([s]) => s);
      // Sections sans timestamp (cochées avant le mode magasin) → en queue
      const observedSet = new Set(observed);
      const tail = sections.filter(s => !observedSet.has(s) && (itemsBySection[s] ?? []).length > 0);
      onComplete?.([...observed, ...tail]);
    }, 700);

    return () => clearTimeout(timer);
  }, [allDone, sections, itemsBySection, onComplete]);

  const handleClose = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
  };

  // Hero gradient : miel chaud → fond, version atténuée en dark mode.
  const heroTopColor = isDark ? 'rgba(232, 200, 88, 0.10)' : colors.brand.miel;
  const heroBottomColor = colors.bg;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={[heroTopColor, heroBottomColor]}
        style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroTitleBlock}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              {allDone ? 'et voilà — tu as tout pris' : 'tu fais les courses pour'}
            </Text>
            <Text
              style={[styles.heroList, { color: colors.text }]}
              numberOfLines={1}
            >
              {allDone ? '🎉' : listName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.heroClose, { backgroundColor: primary + '1F' }]}
            activeOpacity={0.6}
            accessibilityLabel="Quitter le mode shopping"
            accessibilityRole="button"
            hitSlop={10}
          >
            <Minimize2 size={20} color={primary} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressNumbers}>
            <Text style={[styles.progressDone, { color: primary }]}>
              {doneCount}
            </Text>
            <Text style={[styles.progressTotal, { color: colors.textMuted }]}>
              / {totalCount}
            </Text>
            {remainingEstimate !== undefined &&
              remainingEstimate > 0 &&
              formatPrice && (
                <Text
                  style={[styles.progressEstimate, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {`≈ ${formatPrice(remainingEstimate)} restants`}
                </Text>
              )}
          </View>

          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: primary + '24' },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBarFill,
                { backgroundColor: primary },
                progressBarStyle,
              ]}
            />
          </View>

          {!allDone && nextItems.length > 0 && (
            <Text
              style={[styles.caption, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              il te reste{' '}
              <Text style={[styles.captionStrong, { color: colors.text }]}>
                {nextItems.join(', ')}
              </Text>
              {moreCount > 0 && (
                <Text style={{ color: colors.textFaint }}>
                  {' '}et {moreCount} {moreCount > 1 ? 'autres' : 'autre'}
                </Text>
              )}
            </Text>
          )}
          {totalCount === 0 && (
            <Text style={[styles.caption, { color: colors.textMuted }]}>
              la liste est vide
            </Text>
          )}
        </View>

        {/* ─── Bouton undo discret ─────────────────────────────── */}
        {onUndoLast && undoStack && undoStack.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onUndoLast();
            }}
            style={styles.undoBtn}
            activeOpacity={0.6}
            hitSlop={6}
          >
            <Text style={[styles.undoText, { color: primary }]} numberOfLines={1}>
              ↶ rétablir{' '}
              <Text style={[styles.undoLabel, { color: colors.text }]}>
                {undoStack[undoStack.length - 1].text}
              </Text>
              {undoStack.length > 1 && (
                <Text style={{ color: colors.textFaint }}>
                  {' '}· {undoStack.length - 1} autre{undoStack.length > 2 ? 's' : ''}
                </Text>
              )}
            </Text>
          </TouchableOpacity>
        )}

        {/* ─── Fil d'Ariane : rayons dans l'ordre du parcours ─── */}
        {sectionStats.length > 1 && !allDone && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.breadcrumb}
            style={styles.breadcrumbScroll}
          >
            {sectionStats.map((s, idx) => {
              const isCurrent = s.section === currentSection;
              return (
                <React.Fragment key={s.section}>
                  <View
                    style={[
                      styles.crumb,
                      {
                        backgroundColor: isCurrent
                          ? primary
                          : s.all
                            ? 'transparent'
                            : colors.card,
                        borderColor: isCurrent ? primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.crumbText,
                        {
                          color: isCurrent
                            ? colors.onPrimary
                            : s.all
                              ? colors.textFaint
                              : colors.textSub,
                          textDecorationLine: s.all ? 'line-through' : 'none',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {s.section}
                    </Text>
                  </View>
                  {idx < sectionStats.length - 1 && (
                    <Text style={[styles.crumbArrow, { color: colors.textFaint }]}>
                      →
                    </Text>
                  )}
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      {/* ─── Sections ─────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing['5xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => {
          const items = itemsBySection[section];
          if (!items || items.length === 0) return null;
          const sectionDone = items.filter((i) => i.completed).length;
          const sectionAllDone = sectionDone === items.length;
          const isCurrent = section === currentSection;
          const collapsed = isCollapsed(section, sectionAllDone);
          return (
            <Animated.View
              key={section}
              layout={LinearTransition.duration(220)}
              style={[
                styles.sectionBlock,
                isCurrent && {
                  borderWidth: 2,
                  borderColor: primary,
                  borderRadius: 18,
                  paddingHorizontal: 6,
                  paddingTop: 4,
                  paddingBottom: 2,
                },
                sectionAllDone && !isCurrent && { opacity: 0.55 },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggleSectionFold(section)}
                activeOpacity={0.7}
                style={styles.sectionHead}
                accessibilityRole="button"
                accessibilityLabel={`${section}, ${sectionDone} sur ${items.length}, ${collapsed ? 'replié' : 'déplié'}`}
              >
                <Text
                  style={[styles.sectionTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {section}
                </Text>
                <Text
                  style={[
                    styles.sectionProgress,
                    { color: sectionAllDone ? primary : colors.textMuted },
                  ]}
                >
                  {sectionDone}/{items.length}
                </Text>
                <ChevronCaret collapsed={collapsed} color={colors.textMuted} />
              </TouchableOpacity>
              {collapsed
                ? null
                : items.map((item) => {
                const priceInfo = priceByItemId?.get(item.id);
                return (
                  <Animated.View
                    key={item.id}
                    layout={LinearTransition.duration(220)}
                    exiting={FadeOutLeft.duration(140)}
                  >
                    <TouchableOpacity
                      onPress={() => handleToggle(item)}
                      activeOpacity={0.75}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: colors.card,
                          shadowColor: colors.text,
                        },
                        item.completed && styles.itemCardDone,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.completed }}
                      accessibilityLabel={
                        item.completed
                          ? `${item.text}, acheté`
                          : `${item.text}, à acheter`
                      }
                    >
                      <View
                        style={[
                          styles.checkboxBig,
                          { borderColor: colors.border },
                          item.completed && {
                            backgroundColor: primary,
                            borderColor: primary,
                          },
                        ]}
                      >
                        {item.completed && (
                          <Text style={[styles.checkGlyph, { color: colors.onPrimary }]}>
                            ✓
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.itemText,
                          { color: colors.text },
                          item.completed && {
                            color: colors.textMuted,
                            textDecorationLine: 'line-through',
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.text}
                      </Text>
                      {priceInfo && formatPrice && (
                        <Text
                          style={[
                            styles.itemPrice,
                            {
                              color: priceInfo.stale
                                ? colors.textFaint
                                : colors.textMuted,
                            },
                            item.completed && {
                              textDecorationLine: 'line-through',
                            },
                          ]}
                        >
                          {`≈ ${formatPrice(priceInfo.price)}`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.View>
          );
        })}

        {onEditParcours && totalCount > 0 && (
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onEditParcours();
            }}
            style={styles.editParcoursLink}
            accessibilityRole="button"
          >
            <Text style={[styles.editParcoursText, { color: primary }]}>
              ↳ modifier mon parcours dans {listName}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function ChevronCaret({ collapsed, color }: { collapsed: boolean; color: string }) {
  const rot = useSharedValue(collapsed ? -90 : 0);
  useEffect(() => {
    rot.value = withTiming(collapsed ? -90 : 0, { duration: 200 });
  }, [collapsed, rot]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <Animated.View style={[{ marginLeft: Spacing.xs }, animStyle]}>
      <ChevronDown size={20} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroTitleBlock: {
    flex: 1,
    paddingTop: 2,
  },
  eyebrow: {
    fontFamily: FontFamily.handwrite,
    fontSize: 18,
    lineHeight: 18,
    marginBottom: 2,
  },
  heroList: {
    fontFamily: FontFamily.serif,
    fontSize: 28,
    lineHeight: 32,
  },
  heroClose: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBlock: {
    marginTop: Spacing.lg,
  },
  progressNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  progressDone: {
    fontFamily: FontFamily.serif,
    fontSize: 56,
    lineHeight: 56,
  },
  progressTotal: {
    fontFamily: FontFamily.serif,
    fontSize: 28,
    marginLeft: 8,
  },
  progressEstimate: {
    marginLeft: 'auto',
    fontFamily: FontFamily.handwrite,
    fontSize: 20,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  caption: {
    marginTop: Spacing.md,
    fontFamily: FontFamily.handwrite,
    fontSize: 19,
    lineHeight: 22,
  },
  captionStrong: {
    fontFamily: FontFamily.handwriteSemibold,
  },
  undoBtn: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
  },
  undoText: {
    fontFamily: FontFamily.handwrite,
    fontSize: 17,
    lineHeight: 20,
  },
  undoLabel: {
    fontFamily: FontFamily.handwriteSemibold,
  },
  breadcrumbScroll: {
    marginTop: Spacing.lg,
    marginHorizontal: -Spacing['2xl'],
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing['2xl'],
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  crumbText: {
    fontSize: 13,
    fontWeight: FontWeight.medium,
    maxWidth: 140,
  },
  crumbArrow: {
    fontFamily: FontFamily.handwrite,
    fontSize: 16,
    paddingHorizontal: 2,
  },
  scrollContent: {
    paddingTop: Spacing.lg,
  },
  sectionBlock: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginBottom: 6,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: FontFamily.serif,
    fontSize: 22,
  },
  sectionProgress: {
    fontFamily: FontFamily.handwrite,
    fontSize: 18,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: 18,
    marginBottom: Spacing.md,
    minHeight: 84,
    gap: Spacing.lg,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardDone: {
    opacity: 0.55,
  },
  checkboxBig: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: -2,
  },
  itemText: {
    flex: 1,
    fontSize: 22,
    fontWeight: FontWeight.medium,
    lineHeight: 27,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: FontWeight.medium,
  },
  editParcoursLink: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  editParcoursText: {
    fontFamily: FontFamily.handwriteSemibold,
    fontSize: 18,
  },
});
