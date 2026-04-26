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
    <DashboardCard key="insights" title={t('dashboard.insights.title')} count={hasInsights ? insights.length : undefined} color={colors.brand.soilMuted} variant="narrative" collapsible cardId="insights">
      {topInsights.map((insight, idx) => {
        const isFirst = idx === 0;
        const priorityColor = insight.priority === 'high' ? colors.error
          : insight.priority === 'medium' ? colors.warning
          : colors.textMuted;

        const handlePress = () => {
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

        if (isFirst) {
          return (
            <TouchableOpacity
              key={insight.id}
              style={styles.insightRowMain}
              activeOpacity={insight.action?.route ? 0.7 : 1}
              onPress={handlePress}
            >
              <View style={[styles.insightIconBadgeMain, { backgroundColor: priorityColor + '18' }]}>
                <insight.Icon size={20} strokeWidth={1.75} color={priorityColor} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitleMain, { color: colors.text }]} numberOfLines={2}>{insight.title}</Text>
                <Text style={[styles.insightBodyMain, { color: colors.textSub }]} numberOfLines={2}>{insight.body}</Text>
              </View>
              {insight.action && (
                <Text style={[styles.insightAction, { color: primary }]}>
                  {insight.action.type === 'addCourse' ? '+' : '›'}
                </Text>
              )}
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={insight.id}
            style={styles.insightRow}
            activeOpacity={insight.action?.route ? 0.7 : 1}
            onPress={handlePress}
          >
            <View style={[styles.insightIconBadge, { backgroundColor: priorityColor + '18' }]}>
              <insight.Icon size={14} strokeWidth={1.75} color={priorityColor} />
            </View>
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: colors.text }]} numberOfLines={1}>{insight.title}</Text>
              <Text style={[styles.insightBody, { color: colors.textSub }]} numberOfLines={1}>{insight.body}</Text>
            </View>
            {insight.action && (
              <Text style={[styles.insightActionSmall, { color: primary }]}>
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
  // Premier insight — gros et visible
  insightRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xs,
    gap: Spacing.md,
  },
  insightIconBadgeMain: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitleMain: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  insightBodyMain: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  // Insights suivants — compacts
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xxs,
    borderRadius: Radius.xs,
    gap: Spacing.md,
  },
  insightIconBadge: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  insightBody: {
    fontSize: FontSize.micro,
    marginTop: 1,
  },
  insightAction: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    marginLeft: 8,
  },
  insightActionSmall: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginLeft: 6,
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
