// components/settings/SettingsCoupling.tsx
// Ecran Reglages — Couplage semantique.
// Phase 22-02 — UI config famille (COUPLING-01, COUPLING-02, COUPLING-04).
//
// Master toggle + 10 category rows avec icone/label/description/badge variant colore + stats semaine.
// Decisions : D-01 (granular control), D-02 (opt-out pattern), D-03 (display order by variant tier),
// D-04 (stats semaine par categorie), Research Pitfall 3 (disabled hint quand master OFF).

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

import { CATEGORIES } from '../../lib/semantic/categories';
import type { CategoryId } from '../../lib/semantic/categories';
import { EFFECT_TOASTS, CATEGORY_VARIANT } from '../../lib/semantic/effect-toasts';
import { isSemanticCouplingEnabled, setSemanticCouplingEnabled } from '../../lib/semantic/flag';
import { loadOverrides, saveOverrides, loadWeekStats } from '../../lib/semantic/coupling-overrides';
import { VARIANT_CONFIG } from '../mascot/HarvestBurst';
import { SectionHeader } from '../ui/SectionHeader';
import { Link2 } from 'lucide-react-native';

// ── Ordre d'affichage par tier variant (golden > rare > ambient) — D-03, Research Pitfall 1 ──
const DISPLAY_ORDER: CategoryId[] = [
  'bebe_soins', 'rendez_vous',           // golden (2)
  'budget_admin', 'cuisine_repas', 'gratitude_famille',  // rare (3)
  'courses', 'enfants_devoirs', 'enfants_routines', 'menage_hebdo', 'menage_quotidien',  // ambient (5)
];

// ── Lookup rapide label par CategoryId ──
const CATEGORY_LABEL: Record<CategoryId, { fr: string; en: string }> = Object.fromEntries(
  CATEGORIES.map(c => [c.id, { fr: c.labelFr, en: c.labelEn }])
) as Record<CategoryId, { fr: string; en: string }>;

// ── Props ──
interface CategoryRowProps {
  catId: CategoryId;
  masterEnabled: boolean;
  overrides: Record<string, boolean>;
  weekStats: { weekKey: string; counts: Record<string, number> };
  onToggle: (catId: CategoryId, val: boolean) => void;
  isLast?: boolean;
}

const CategoryRow = React.memo(function CategoryRow({
  catId,
  masterEnabled,
  overrides,
  weekStats,
  onToggle,
  isLast,
}: CategoryRowProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();

  const lang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const toast = EFFECT_TOASTS[catId];
  const variant = CATEGORY_VARIANT[catId];
  const variantConfig = VARIANT_CONFIG[variant];
  const variantColor = variantConfig.particleColor;
  const catLabel = CATEGORY_LABEL[catId][lang];
  const catDescription = lang === 'en' ? toast.en : toast.fr;
  const isEnabled = overrides[catId] !== false;
  const count = weekStats.counts[catId] ?? 0;

  const variantLabelKey =
    variant === 'golden'
      ? 'settings.coupling.variantGolden'
      : variant === 'rare'
      ? 'settings.coupling.variantRare'
      : 'settings.coupling.variantAmbient';

  return (
    <View
      style={[
        styles.categoryRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
      ]}
    >
      {/* Icone */}
      <Text style={styles.categoryIcon}>{toast.icon}</Text>

      {/* Label + description + badge */}
      <View style={styles.categoryContent}>
        <View style={styles.categoryTitleRow}>
          <Text style={[styles.categoryLabel, { color: colors.text }]} numberOfLines={1}>
            {catLabel}
          </Text>
          {/* Badge variant colore inline — NE PAS utiliser Badge.tsx (Research anti-pattern) */}
          <View
            style={[
              styles.variantBadge,
              { backgroundColor: variantColor + '33' }, // 20% opacity hex
            ]}
          >
            <Text style={[styles.variantBadgeText, { color: variantColor }]}>
              {t(variantLabelKey)}
            </Text>
          </View>
        </View>
        <Text style={[styles.categoryDesc, { color: colors.textMuted }]} numberOfLines={2}>
          {catDescription}
        </Text>
        {/* Stats semaine par categorie */}
        <Text style={[styles.weekStatCat, { color: colors.textFaint }]}>
          {t('settings.coupling.weekStatsCat', { count })}
        </Text>
      </View>

      {/* Switch */}
      <Switch
        value={isEnabled}
        onValueChange={(val) => onToggle(catId, val)}
        disabled={!masterEnabled}
        trackColor={{ true: primary, false: colors.switchOff }}
        thumbColor={colors.onPrimary}
        accessibilityRole="switch"
        accessibilityLabel={catLabel}
      />
    </View>
  );
});

// ── Composant principal ──

export function SettingsCoupling() {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();

  const [masterEnabled, setMasterEnabled] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [weekStats, setWeekStats] = useState<{ weekKey: string; counts: Record<string, number> }>({
    weekKey: '',
    counts: {},
  });
  const [loading, setLoading] = useState(true);

  // Chargement parallele des 3 sources async
  useEffect(() => {
    let mounted = true;
    Promise.all([
      isSemanticCouplingEnabled(),
      loadOverrides(),
      loadWeekStats(),
    ]).then(([enabled, ovr, stats]) => {
      if (!mounted) return;
      setMasterEnabled(enabled);
      setOverrides(ovr);
      setWeekStats(stats);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleMasterToggle = useCallback((val: boolean) => {
    setMasterEnabled(val);
    void setSemanticCouplingEnabled(val); // fire and forget
  }, []);

  const handleCategoryToggle = useCallback(
    (catId: CategoryId, val: boolean) => {
      const next = { ...overrides, [catId]: val };
      setOverrides(next);
      void saveOverrides(next); // fire and forget
    },
    [overrides]
  );

  // Stats total
  const totalEffects = Object.values(weekStats.counts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  return (
    <View style={styles.section} accessibilityRole="summary">

      {/* ── Master toggle section ── */}
      <SectionHeader
        title={t('settings.coupling.masterTitle')}
        icon={<Link2 size={16} strokeWidth={1.75} color={colors.brand.soilMuted} />}
        flush
      />

      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <View style={styles.masterRow}>
          <View style={styles.masterContent}>
            <Text style={[styles.masterLabel, { color: colors.text }]}>
              {t('settings.coupling.masterTitle')}
            </Text>
            <Text style={[styles.masterSubtitle, { color: colors.textMuted }]}>
              {t('settings.coupling.masterSubtitle')}
            </Text>
          </View>
          <Switch
            value={masterEnabled}
            onValueChange={handleMasterToggle}
            trackColor={{ true: primary, false: colors.switchOff }}
            thumbColor={colors.onPrimary}
            accessibilityRole="switch"
            accessibilityLabel={t('settings.coupling.masterTitle')}
          />
        </View>

        {/* Stats total semaine */}
        <Text style={[styles.weekStatsTotal, { color: colors.textSub }]}>
          {t('settings.coupling.weekStatsTotal', { count: totalEffects })}
        </Text>
      </View>

      {/* ── Hint quand master OFF — Research Pitfall 3 ── */}
      {!masterEnabled && (
        <Text style={[styles.disabledHint, { color: colors.textFaint }]}>
          {t('settings.coupling.disabledHint')}
        </Text>
      )}

      {/* ── Liste des 10 categories ── */}
      <View
        style={[
          styles.categoriesCard,
          Shadows.sm,
          { backgroundColor: colors.card },
          !masterEnabled && styles.categoriesDisabled,
        ]}
        pointerEvents={masterEnabled ? 'auto' : 'none'}
      >
        {DISPLAY_ORDER.map((catId, index) => (
          <CategoryRow
            key={catId}
            catId={catId}
            masterEnabled={masterEnabled}
            overrides={overrides}
            weekStats={weekStats}
            onToggle={handleCategoryToggle}
            isLast={index === DISPLAY_ORDER.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['5xl'],
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  masterContent: { flex: 1 },
  masterLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  masterSubtitle: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xxs,
  },
  weekStatsTotal: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xs,
  },
  disabledHint: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  categoriesCard: {
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  categoriesDisabled: {
    opacity: 0.4,
  },
  // CategoryRow styles
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  categoryIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  categoryContent: {
    flex: 1,
    gap: Spacing.xxs,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  categoryLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  variantBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  variantBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  categoryDesc: {
    fontSize: FontSize.caption,
    lineHeight: 16,
  },
  weekStatCat: {
    fontSize: FontSize.caption,
  },
});
