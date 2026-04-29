/**
 * ParcoursEditorModal — Mon parcours dans <liste>.
 *
 * Réordonne les rayons via boutons ↑/↓ (pas de drag-and-drop V1).
 * Bannière apprentissage (Sparkles) + section réglages.
 *
 * Sauvegarde l'ordre dans le frontmatter de la liste via onSave(newOrder).
 */

import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, RotateCcw, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';

import { ModalHeader } from './ui/ModalHeader';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontFamily, FontWeight } from '../constants/typography';

interface Props {
  visible: boolean;
  listName: string;
  /** Toutes les sections actuellement présentes dans la liste. */
  sections: string[];
  /** Ordre appris déjà sauvegardé (optionnel — sinon ordre alpha). */
  parcours?: string[];
  onClose: () => void;
  onSave: (newOrder: string[]) => void;
}

function mergeOrder(existing: string[] | undefined, sections: string[]): string[] {
  // Reprend l'ordre `existing` mais filtre les rayons obsolètes,
  // puis ajoute les nouveaux rayons (présents dans sections mais pas dans existing).
  const presentSet = new Set(sections);
  const base = existing && existing.length > 0
    ? existing.filter(s => presentSet.has(s))
    : [];
  const baseSet = new Set(base);
  const tail = sections.filter(s => !baseSet.has(s));
  return [...base, ...tail];
}

export function ParcoursEditorModal({
  visible,
  listName,
  sections,
  parcours,
  onClose,
  onSave,
}: Props) {
  const { colors, primary } = useThemeColors();
  const [order, setOrder] = useState<string[]>(() => mergeOrder(parcours, sections));

  // Re-sync à chaque ouverture pour refléter modifs externes.
  useEffect(() => {
    if (visible) setOrder(mergeOrder(parcours, sections));
  }, [visible, parcours, sections]);

  const dirty = useMemo(() => {
    const baseline = mergeOrder(parcours, sections);
    if (baseline.length !== order.length) return true;
    return baseline.some((s, i) => s !== order[i]);
  }, [order, parcours, sections]);

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    Haptics.selectionAsync().catch(() => {});
    const next = [...order];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setOrder(next);
  };

  const handleReset = () => {
    Haptics.selectionAsync().catch(() => {});
    setOrder([...sections].sort((a, b) => a.localeCompare(b, 'fr')));
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSave(order);
  };

  const learnedFromVisits = parcours && parcours.length > 0 ? 'd\'après tes dernières visites' : 'pas encore appris — fais quelques courses pour qu\'il s\'adapte';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <ModalHeader
          title={listName ? `Mon parcours · ${listName}` : 'Mon parcours'}
          onClose={onClose}
          rightLabel="Enregistrer"
          onRight={handleSave}
          rightDisabled={!dirty}
        />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ─── Bannière apprentissage ────────────────────────────── */}
          <View
            style={[
              styles.learnBanner,
              { backgroundColor: primary + '1A', borderColor: primary + '33' },
            ]}
          >
            <Sparkles size={20} color={primary} strokeWidth={2.2} />
            <View style={styles.learnText}>
              <Text style={[styles.learnTitle, { color: colors.text }]}>
                Parcours appris automatiquement
              </Text>
              <Text style={[styles.learnBody, { color: colors.textMuted }]}>
                {learnedFromVisits} · tu peux réordonner les rayons à la main
              </Text>
            </View>
          </View>

          {/* ─── Liste rayons ──────────────────────────────────────── */}
          <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {order.map((section, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === order.length - 1;
              return (
                <View
                  key={section}
                  style={[
                    styles.row,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <View style={[styles.numCircle, { backgroundColor: colors.brand.wash }]}>
                    <Text style={[styles.numText, { color: colors.text }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.sectionName, { color: colors.text }]} numberOfLines={1}>
                    {section}
                  </Text>
                  <View style={styles.arrows}>
                    <TouchableOpacity
                      onPress={() => move(idx, -1)}
                      disabled={isFirst}
                      style={[
                        styles.arrowBtn,
                        { backgroundColor: isFirst ? 'transparent' : primary + '1F' },
                      ]}
                      activeOpacity={0.6}
                      accessibilityLabel={`Monter ${section}`}
                      hitSlop={8}
                    >
                      <ChevronUp
                        size={20}
                        color={isFirst ? colors.textFaint : primary}
                        strokeWidth={2.5}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => move(idx, 1)}
                      disabled={isLast}
                      style={[
                        styles.arrowBtn,
                        { backgroundColor: isLast ? 'transparent' : primary + '1F' },
                      ]}
                      activeOpacity={0.6}
                      accessibilityLabel={`Descendre ${section}`}
                      hitSlop={8}
                    >
                      <ChevronDown
                        size={20}
                        color={isLast ? colors.textFaint : primary}
                        strokeWidth={2.5}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {order.length === 0 && (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                aucun rayon dans cette liste
              </Text>
            )}
          </View>

          {/* ─── Reset alpha ───────────────────────────────────────── */}
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn} activeOpacity={0.6}>
            <RotateCcw size={16} color={colors.textMuted} strokeWidth={2.2} />
            <Text style={[styles.resetText, { color: colors.textMuted }]}>
              Réinitialiser dans l'ordre alphabétique
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    padding: Spacing['2xl'],
  },
  learnBanner: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  learnText: { flex: 1 },
  learnTitle: {
    fontSize: 15,
    fontWeight: FontWeight.semibold,
    marginBottom: 4,
  },
  learnBody: {
    fontFamily: FontFamily.handwrite,
    fontSize: 17,
    lineHeight: 21,
  },
  list: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  numCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontFamily: FontFamily.serif,
    fontSize: 16,
  },
  sectionName: {
    flex: 1,
    fontSize: 15,
    fontWeight: FontWeight.medium,
  },
  arrows: {
    flexDirection: 'row',
    gap: 6,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: Spacing.xl,
    textAlign: 'center',
    fontFamily: FontFamily.handwrite,
    fontSize: 17,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  resetText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
