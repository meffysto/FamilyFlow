/**
 * DashboardAuberge.tsx — Carte dashboard Auberge (Phase 45-03)
 *
 * Visible uniquement si l'auberge est construite (lecture
 * `activeProfile.farmBuildings`). Affiche un aperçu compact (1-2 visiteurs
 * actifs avec timer coloré) et un CTA "Voir l'auberge" qui ouvre
 * `AubergeSheet` via state local.
 *
 * Pulse Reanimated léger si au moins un timer < 2h (urgence).
 *
 * Toutes les couleurs proviennent de `useThemeColors()` ;
 * `TIMER_AMBER` / `TIMER_RED` sont les 2 constantes sémantiques alignées
 * sur `AubergeSheet` (Plan 45-02). Le wrap `SectionErrorBoundary` est
 * appliqué par le parent (`app/(tabs)/index.tsx` ligne 1231).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  useReducedMotion,
} from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAuberge } from '../../hooks/useAuberge';
import { getRemainingMinutes } from '../../lib/mascot/auberge-engine';
import { VISITOR_CATALOG } from '../../lib/mascot/visitor-catalog';
import { DashboardCard } from '../DashboardCard';
import { AubergeSheet } from '../mascot/AubergeSheet';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { DashboardSectionProps } from './types';
import type { ActiveVisitor, PlacedBuilding } from '../../lib/mascot/types';

// ─── Couleurs sémantiques timer (alignées AubergeSheet Plan 45-02) ──────
const TIMER_AMBER = '#F59E0B'; // < 6h
const TIMER_RED = '#EF4444';   // < 2h (urgence)

const URGENT_THRESHOLD_MIN = 120; // 2h
const AMBER_THRESHOLD_MIN = 360;  // 6h

// ─── Lookup map FR pour les 6 PNJ (cohérente avec AubergeSheet) ─────────
const VISITOR_NAMES_FR: Record<string, string> = {
  hugo_boulanger:    'Hugo le boulanger',
  meme_lucette:      'Mémé Lucette',
  yann_apiculteur:   'Yann l’apiculteur',
  voyageuse:         'La Voyageuse',
  marchand_ambulant: 'Le Marchand ambulant',
  comtesse:          'La Comtesse',
};

function formatRemaining(min: number): string {
  if (min <= 0) return 'Expiré';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}min`;
}

function timerColor(min: number, fallback: string): string {
  if (min < URGENT_THRESHOLD_MIN) return TIMER_RED;
  if (min < AMBER_THRESHOLD_MIN) return TIMER_AMBER;
  return fallback;
}

function getVisitorEmoji(visitorId: string): string {
  return VISITOR_CATALOG.find(d => d.id === visitorId)?.emoji ?? '🧑';
}

function getVisitorName(visitorId: string): string {
  return VISITOR_NAMES_FR[visitorId] ?? visitorId;
}

// ─── Sous-composant memo : ligne d'aperçu visiteur ──────────────────────

interface VisitorRowProps {
  visitor: ActiveVisitor;
  remainingMin: number;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  cardBg: string;
}

const VisitorRow = React.memo(function VisitorRow({
  visitor,
  remainingMin,
  textColor,
  mutedColor,
  borderColor,
  cardBg,
}: VisitorRowProps) {
  const tColor = timerColor(remainingMin, mutedColor);
  return (
    <View style={[styles.row, { borderColor, backgroundColor: cardBg }]}>
      <Text style={styles.rowEmoji}>{getVisitorEmoji(visitor.visitorId)}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: textColor }]} numberOfLines={1}>
          {getVisitorName(visitor.visitorId)}
        </Text>
        <Text style={[styles.rowMeta, { color: mutedColor }]} numberOfLines={1}>
          {visitor.request.length} item{visitor.request.length > 1 ? 's' : ''} demandé{visitor.request.length > 1 ? 's' : ''}
        </Text>
      </View>
      <Text style={[styles.rowTimer, { color: tColor }]}>
        ⏱ {formatRemaining(remainingMin)}
      </Text>
    </View>
  );
});

// ─── Composant principal ────────────────────────────────────────────────

function DashboardAubergeInner(_props: DashboardSectionProps) {
  const { activeProfile } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const { activeVisitors, totalReputation } = useAuberge();
  const [sheetOpen, setSheetOpen] = useState(false);

  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  // ── Détection auberge construite (lecture farmBuildings du profil actif)
  const buildings: PlacedBuilding[] = Array.isArray(activeProfile?.farmBuildings)
    ? (activeProfile!.farmBuildings as PlacedBuilding[])
    : [];
  const hasAuberge = buildings.some(b => b.buildingId === 'auberge');

  // ── Tri par urgence + tronquage à 2 ──
  const now = useMemo(() => new Date(), [activeVisitors]);
  const sortedVisitors = useMemo(
    () =>
      [...activeVisitors].sort(
        (a, b) => getRemainingMinutes(a, now) - getRemainingMinutes(b, now),
      ),
    [activeVisitors, now],
  );
  const previewVisitors = useMemo(() => sortedVisitors.slice(0, 2), [sortedVisitors]);
  const remainingForPreview = useMemo(
    () => previewVisitors.map(v => getRemainingMinutes(v, now)),
    [previewVisitors, now],
  );

  const hasUrgent = useMemo(
    () => remainingForPreview.some(m => m < URGENT_THRESHOLD_MIN),
    [remainingForPreview],
  );

  // ── Pulse Reanimated léger si urgence ──
  useEffect(() => {
    if (!hasAuberge || !hasUrgent || reducedMotion) {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 750 }),
        withTiming(1, { duration: 750 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [hasAuberge, hasUrgent, reducedMotion, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const handleOpen = useCallback(() => setSheetOpen(true), []);
  const handleClose = useCallback(() => setSheetOpen(false), []);

  // Auberge non construite → rien à afficher
  if (!hasAuberge) return null;

  const visitorCount = activeVisitors.length;
  const cardColor = colors.catFamille ?? primary;
  const ctaBg = tint;
  const ctaText = primary;

  return (
    <>
      <DashboardCard
        title={`🛖 Auberge${visitorCount > 0 ? ` — ${visitorCount} visiteur${visitorCount > 1 ? 's' : ''}` : ''}`}
        color={cardColor}
        tinted
        collapsible
        cardId="auberge"
      >
        <Animated.View style={animStyle}>
          {previewVisitors.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyEmoji]}>🛖</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                L’auberge est calme... un visiteur arrivera bientôt.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {previewVisitors.map((v, idx) => (
                <VisitorRow
                  key={v.instanceId}
                  visitor={v}
                  remainingMin={remainingForPreview[idx]}
                  textColor={colors.text}
                  mutedColor={colors.textMuted}
                  borderColor={colors.borderLight}
                  cardBg={colors.cardAlt}
                />
              ))}
              {visitorCount > previewVisitors.length && (
                <Text style={[styles.moreLabel, { color: colors.textMuted }]}>
                  + {visitorCount - previewVisitors.length} autre{visitorCount - previewVisitors.length > 1 ? 's' : ''} visiteur{visitorCount - previewVisitors.length > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: ctaBg }]}
            onPress={handleOpen}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Voir l'auberge"
          >
            <Text style={[styles.ctaText, { color: ctaText }]}>
              Voir l’auberge {totalReputation > 0 ? `· ❤ ${totalReputation}` : ''}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </DashboardCard>

      <AubergeSheet visible={sheetOpen} onClose={handleClose} />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  list: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
  rowEmoji: {
    fontSize: 28,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  rowMeta: {
    fontSize: FontSize.micro,
  },
  rowTimer: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  moreLabel: {
    fontSize: FontSize.micro,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  cta: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});

export const DashboardAuberge = React.memo(DashboardAubergeInner);
