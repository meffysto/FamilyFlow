/**
 * ShoppingBilanModal — Bilan post-courses (apparait quand allDone).
 *
 * Affiche l'ordre observé pendant la session, propose 3 actions :
 *  - Appliquer ce parcours    (sauvegarde dans la liste, ferme le mode magasin)
 *  - Ajuster à la main        (ouvre l'écran Mon parcours)
 *  - Garder le parcours actuel (ferme tout, rien ne change)
 *
 * Diff visuelle : pour chaque rayon dans l'ordre observé, indique s'il a remonté,
 * descendu, ou est inchangé par rapport au parcours courant.
 */

import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';

import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontFamily, FontWeight } from '../constants/typography';

interface Props {
  visible: boolean;
  observedOrder: string[];
  currentOrder: string[];
  totalCount: number;
  onApply: (newOrder: string[]) => void;
  onAdjust: () => void;
  onIgnore: () => void;
}

type DiffKind = { kind: 'up'; delta: number } | { kind: 'down'; delta: number } | { kind: 'same' } | { kind: 'new' };

function computeDiff(observed: string[], current: string[]): Map<string, DiffKind> {
  const map = new Map<string, DiffKind>();
  const currentIdx = new Map(current.map((s, i) => [s, i]));
  observed.forEach((section, newIdx) => {
    const oldIdx = currentIdx.get(section);
    if (oldIdx === undefined) {
      map.set(section, { kind: 'new' });
    } else if (oldIdx === newIdx) {
      map.set(section, { kind: 'same' });
    } else if (oldIdx > newIdx) {
      map.set(section, { kind: 'up', delta: oldIdx - newIdx });
    } else {
      map.set(section, { kind: 'down', delta: newIdx - oldIdx });
    }
  });
  return map;
}

export function ShoppingBilanModal({
  visible,
  observedOrder,
  currentOrder,
  totalCount,
  onApply,
  onAdjust,
  onIgnore,
}: Props) {
  const { colors, primary, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();

  const diff = useMemo(() => computeDiff(observedOrder, currentOrder), [observedOrder, currentOrder]);
  const hasChanges = useMemo(
    () => observedOrder.some(s => {
      const d = diff.get(s);
      return d && d.kind !== 'same';
    }),
    [observedOrder, diff],
  );

  const heroTopColor = isDark ? 'rgba(232, 200, 88, 0.10)' : colors.brand.miel;

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onApply(observedOrder);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onIgnore}
    >
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        {/* ─── Hero félicitation ──────────────────────────────────── */}
        <LinearGradient
          colors={[heroTopColor, colors.bg]}
          style={[styles.hero, { paddingTop: Spacing['2xl'] }]}
        >
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
            tu as terminé tes courses
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Bravo !</Text>
          <View style={styles.statsRow}>
            <Text style={[styles.statsBig, { color: primary }]}>
              {totalCount} <Text style={[styles.statsBigMuted, { color: colors.textMuted }]}>/ {totalCount}</Text>
            </Text>
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing['5xl'] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Bannière apprentissage ─────────────────────────────── */}
          {hasChanges && (
            <View
              style={[
                styles.learnBanner,
                { backgroundColor: primary + '1A', borderColor: primary + '33' },
              ]}
            >
              <Sparkles size={20} color={primary} strokeWidth={2.2} />
              <View style={styles.learnBannerText}>
                <Text style={[styles.learnTitle, { color: colors.text }]}>
                  J'ai remarqué quelque chose
                </Text>
                <Text style={[styles.learnBody, { color: colors.textMuted }]}>
                  l'ordre dans lequel tu as fait les rayons est différent de ton parcours actuel.{' '}
                  je l'applique la prochaine fois ?
                </Text>
              </View>
            </View>
          )}
          {!hasChanges && (
            <View
              style={[
                styles.learnBanner,
                { backgroundColor: colors.brand.wash, borderColor: colors.border },
              ]}
            >
              <Sparkles size={20} color={colors.textMuted} strokeWidth={2.2} />
              <Text style={[styles.learnBody, { color: colors.textMuted, flex: 1 }]}>
                tu as suivi ton parcours actuel — rien à changer
              </Text>
            </View>
          )}

          {/* ─── Liste rayons avec diff ─────────────────────────────── */}
          <View style={styles.diffList}>
            {observedOrder.map((section, idx) => {
              const d = diff.get(section);
              const isMoved = d && d.kind !== 'same';
              return (
                <View
                  key={section}
                  style={[
                    styles.diffRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.diffNum,
                      {
                        backgroundColor: isMoved ? primary : colors.brand.wash,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diffNumText,
                        { color: isMoved ? colors.onPrimary : colors.text },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <Text style={[styles.diffSection, { color: colors.text }]} numberOfLines={1}>
                    {section}
                  </Text>
                  <Text
                    style={[
                      styles.diffNote,
                      {
                        color:
                          d?.kind === 'up'
                            ? primary
                            : d?.kind === 'down'
                              ? colors.textFaint
                              : d?.kind === 'new'
                                ? primary
                                : colors.textFaint,
                      },
                    ]}
                  >
                    {d?.kind === 'up' && `↑ remonté de ${d.delta}`}
                    {d?.kind === 'down' && `↓ descendu de ${d.delta}`}
                    {d?.kind === 'same' && 'inchangé'}
                    {d?.kind === 'new' && '✨ nouveau'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ─── 3 boutons ────────────────────────────────────────── */}
          <View style={styles.actions}>
            {hasChanges && (
              <TouchableOpacity
                onPress={handleApply}
                style={[styles.btnPrimary, { backgroundColor: primary }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnPrimaryText, { color: colors.onPrimary }]}>
                  Oui, applique ce parcours
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onAdjust}
              style={[styles.btnSecondary, { borderColor: primary }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnSecondaryText, { color: primary }]}>
                Voir et ajuster à la main
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onIgnore}
              style={styles.btnTertiary}
              activeOpacity={0.6}
            >
              <Text style={[styles.btnTertiaryText, { color: colors.textMuted }]}>
                {hasChanges ? 'non merci, garde le parcours actuel' : 'fermer'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.footnote, { color: colors.textFaint }]}>
            l'app n'a rien changé — c'est toi qui décides ✋
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },
  eyebrow: {
    fontFamily: FontFamily.handwrite,
    fontSize: 18,
    marginBottom: 4,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 36,
    lineHeight: 42,
  },
  statsRow: {
    marginTop: Spacing.md,
  },
  statsBig: {
    fontFamily: FontFamily.serif,
    fontSize: 28,
  },
  statsBigMuted: {
    fontFamily: FontFamily.serif,
    fontSize: 22,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
  },
  learnBanner: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  learnBannerText: { flex: 1 },
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
  diffList: {
    marginBottom: Spacing.xl,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: Spacing.md,
  },
  diffNum: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffNumText: {
    fontFamily: FontFamily.serif,
    fontSize: 16,
  },
  diffSection: {
    flex: 1,
    fontSize: 15,
    fontWeight: FontWeight.medium,
  },
  diffNote: {
    fontFamily: FontFamily.handwrite,
    fontSize: 16,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  btnPrimary: {
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: FontWeight.semibold,
  },
  btnSecondary: {
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: FontWeight.semibold,
  },
  btnTertiary: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  btnTertiaryText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footnote: {
    fontFamily: FontFamily.handwrite,
    fontSize: 16,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
