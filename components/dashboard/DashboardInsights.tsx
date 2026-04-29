/**
 * DashboardInsights.tsx — Section suggestions en 3 zones
 *
 * Pour toi    : tâches/RDV attribués au profil actif (priorité haute)
 * À surveiller: alertes famille (stock, anniv, jalon, défi)
 * Idées       : suggestions douces (repas, photo, gratitude, loot)
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Sparkles, RefreshCw } from 'lucide-react-native';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAI } from '../../contexts/AIContext';
import { DashboardCard } from '../DashboardCard';
import { MarkdownText } from '../ui/MarkdownText';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { categorizeInsights, type Insight, type InsightAudience } from '../../lib/insights';
import type { DashboardSectionProps } from './types';

function DashboardInsightsInner({ insights: insightsProp }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const ai = useAI();
  const {
    tasks, courses, stock, meals, rdvs,
    profiles, activeProfile, addCourseItem,
    memories, defis, wishlistItems, recipes, journalStats, healthRecords,
  } = useVault();

  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const insights = insightsProp ?? [];
  const grouped = useMemo(() => categorizeInsights(insights), [insights]);

  const hasInsights = insights.length > 0;
  const hasAI = ai.isConfigured;
  if (!hasInsights && !hasAI) return null;

  const handlePress = (insight: Insight) => {
    if (insight.action?.type === 'navigate' && insight.action.route) {
      if (insight.action.params) {
        router.push({ pathname: insight.action.route as any, params: insight.action.params });
      } else {
        router.push(insight.action.route as any);
      }
    } else if (insight.action?.type === 'addCourse' && insight.action.payload) {
      const items: { text: string; section?: string }[] = insight.action.payload;
      (async () => {
        for (const item of items) {
          await addCourseItem(item.text, item.section);
        }
        showToast(t('dashboard.insights.addedToCourses', { count: items.length }));
      })();
    }
  };

  const renderRow = (insight: Insight) => {
    const priorityColor = insight.priority === 'high' ? colors.error
      : insight.priority === 'medium' ? colors.warning
      : colors.success;
    const iconColor = insight.audience === 'me' ? primary : priorityColor;
    const iconBg = iconColor + '1F';

    return (
      <TouchableOpacity
        key={insight.id}
        style={styles.row}
        activeOpacity={insight.action ? 0.7 : 1}
        onPress={() => handlePress(insight)}
      >
        <View style={[styles.iconBadge, { backgroundColor: iconBg }]}>
          <insight.Icon size={16} strokeWidth={1.75} color={iconColor} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{insight.title}</Text>
          <Text style={[styles.meta, { color: colors.textSub }]} numberOfLines={1}>{insight.body}</Text>
        </View>
        {insight.action && (
          <Text style={[styles.action, { color: primary }]}>
            {insight.action.type === 'addCourse' ? '+' : '›'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (key: InsightAudience, items: Insight[], showEmpty = false) => {
    if (items.length === 0 && !showEmpty) return null;

    const labelKey = key === 'me' ? 'sectionMe' : key === 'family' ? 'sectionFamily' : 'sectionIdea';
    const dotColor = key === 'me' ? primary
      : key === 'family' ? colors.warning
      : colors.success;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
            {t(`dashboard.insights.${labelKey}`)}
          </Text>
          {key === 'me' && activeProfile && (
            <View style={[styles.mePill, { backgroundColor: primary + '1A' }]}>
              <Text style={[styles.mePillText, { color: primary }]}>@{activeProfile.name}</Text>
            </View>
          )}
        </View>
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {t('dashboard.insights.emptyMe')}
          </Text>
        ) : (
          items.map(renderRow)
        )}
      </View>
    );
  };

  // Si "me" est vide mais qu'on a un profil, on affiche quand même la section vide
  // (sentiment d'apaisement) — sauf si "me" + "family" + "idea" sont tous vides
  const showMeEmpty = grouped.me.length === 0 && (grouped.family.length > 0 || grouped.idea.length > 0);

  return (
    <DashboardCard
      key="insights"
      title={t('dashboard.insights.title')}
      count={hasInsights ? grouped.total : undefined}
      color={colors.brand.soilMuted}
      variant="narrative"
      collapsible
      cardId="insights"
    >
      {renderSection('me', grouped.me, showMeEmpty)}
      {grouped.family.length > 0 && (
        <View style={[styles.divider, { backgroundColor: colors.separator }]} />
      )}
      {renderSection('family', grouped.family)}
      {grouped.idea.length > 0 && (
        <View style={[styles.divider, { backgroundColor: colors.separator }]} />
      )}
      {renderSection('idea', grouped.idea)}

      {hasAI && (
        <>
          {hasInsights && (
            <View style={[styles.aiDivider, { backgroundColor: colors.separator }]} />
          )}
          {aiSuggestions ? (
            <View style={{ gap: Spacing.md }}>
              <MarkdownText style={{ color: colors.text }}>{aiSuggestions}</MarkdownText>
              <TouchableOpacity
                style={[styles.aiBtn, { backgroundColor: primary + '14', borderColor: primary + '33' }]}
                onPress={async () => {
                  setAiLoading(true);
                  const ctx = {
                    tasks, menageTasks: tasks.filter(tk => tk.section != null && tk.section.toLowerCase().includes('ménage')), rdvs, stock, meals, courses,
                    memories, defis, wishlistItems, recipes, profiles, activeProfile,
                    journalStats, healthRecords,
                  };
                  const resp = await ai.getSuggestions(ctx);
                  setAiSuggestions(resp.error || resp.text);
                  setAiLoading(false);
                }}
                disabled={aiLoading}
                activeOpacity={0.7}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <RefreshCw size={16} strokeWidth={2} color={primary} />
                )}
                <Text style={[styles.aiBtnText, { color: primary }]}>
                  {t('dashboard.insights.newSuggestions')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: primary + '14', borderColor: primary + '33' }]}
              onPress={async () => {
                setAiLoading(true);
                const ctx = {
                  tasks, menageTasks: tasks.filter(tk => tk.section != null && tk.section.toLowerCase().includes('ménage')), rdvs, stock, meals, courses,
                  memories, defis, wishlistItems, recipes, profiles, activeProfile,
                  journalStats, healthRecords,
                };
                const resp = await ai.getSuggestions(ctx);
                setAiSuggestions(resp.error || resp.text);
                setAiLoading(false);
              }}
              disabled={aiLoading}
              activeOpacity={0.7}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Sparkles size={16} strokeWidth={2} color={primary} />
              )}
              <Text style={[styles.aiBtnText, { color: primary }]}>
                {aiLoading ? t('dashboard.insights.aiLoading') : t('dashboard.insights.enrichAI')}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </DashboardCard>
  );
}

export const DashboardInsights = React.memo(DashboardInsightsInner);

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.xs,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingHorizontal: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mePill: {
    marginLeft: 'auto',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  mePillText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xxs,
    borderRadius: Radius.xs,
    gap: Spacing.md,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  meta: {
    fontSize: FontSize.micro,
    marginTop: 1,
  },
  action: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    marginLeft: 4,
  },
  empty: {
    fontSize: FontSize.micro,
    fontStyle: 'italic',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  aiDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xl,
  },
  aiBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  aiBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
