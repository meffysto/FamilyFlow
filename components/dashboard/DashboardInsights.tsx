/**
 * DashboardInsights.tsx — Section suggestions (insights locaux + IA optionnelle)
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAI } from '../../contexts/AIContext';
import { DashboardCard } from '../DashboardCard';
import { MarkdownText } from '../ui/MarkdownText';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
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

  const hasInsights = insights.length > 0;
  const hasAI = ai.isConfigured;
  if (!hasInsights && !hasAI) return null;

  const topInsights = insights.slice(0, 5);

  const handleAIRequest = async () => {
    setAiLoading(true);
    const ctx = {
      tasks, menageTasks: tasks.filter(t => t.section != null && t.section.toLowerCase().includes('ménage')), rdvs, stock, meals, courses,
      memories, defis, wishlistItems, recipes, profiles, activeProfile,
      journalStats, healthRecords,
    };
    const resp = await ai.getSuggestions(ctx);
    setAiSuggestions(resp.error || resp.text);
    setAiLoading(false);
  };

  return (
    <DashboardCard key="insights" title={t('dashboard.insights.title')} icon="💡" count={hasInsights ? insights.length : undefined} color={primary} collapsible cardId="insights">
      {topInsights.map((insight) => {
        const priorityColor = insight.priority === 'high' ? colors.error
          : insight.priority === 'medium' ? colors.warning
          : colors.textMuted;
        return (
          <TouchableOpacity
            key={insight.id}
            style={[styles.insightRow, { borderLeftColor: priorityColor }]}
            activeOpacity={insight.action?.route ? 0.7 : 1}
            onPress={() => {
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
            }}
          >
            <Text style={styles.insightIcon}>{insight.icon}</Text>
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: colors.text }]} numberOfLines={1}>{insight.title}</Text>
              <Text style={[styles.insightBody, { color: colors.textSub }]} numberOfLines={2}>{insight.body}</Text>
            </View>
            {insight.action && (
              <Text style={[styles.insightAction, { color: primary }]}>
                {insight.action.type === 'addCourse' ? '+' : '›'}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
      {hasAI && (
        <>
          {hasInsights && (
            <View style={[styles.aiDivider, { backgroundColor: colors.separator }]} />
          )}
          {aiSuggestions ? (
            <View style={{ gap: Spacing.md }}>
              <MarkdownText style={{ color: colors.text }}>{aiSuggestions}</MarkdownText>
              <TouchableOpacity
                style={[styles.aiRefreshBtn, { borderColor: primary + '40' }]}
                onPress={handleAIRequest}
                activeOpacity={0.7}
              >
                <Text style={[styles.aiRefreshBtnText, { color: primary }]}>
                  {aiLoading ? '...' : t('dashboard.insights.newSuggestions')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.aiRefreshBtn, { borderColor: primary + '40' }]}
              onPress={handleAIRequest}
              disabled={aiLoading}
              activeOpacity={0.7}
            >
              <Text style={[styles.aiRefreshBtnText, { color: primary }]}>
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
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 6,
    borderRadius: 4,
  },
  insightIcon: {
    fontSize: FontSize.heading,
    marginRight: 10,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  insightBody: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  insightAction: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    marginLeft: 8,
  },
  aiDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xl,
  },
  aiRefreshBtn: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.base,
    borderWidth: 1,
    alignItems: 'center' as const,
    marginTop: Spacing.xs,
  },
  aiRefreshBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
