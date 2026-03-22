/**
 * SkillTreeGraph.tsx — Arbre de compétences RPG vertical
 *
 * Branches verticales collapsibles, une par catégorie.
 * Chaque branche est une carte avec un header et des nœuds à l'intérieur.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { SkillNode } from './SkillNode';
import {
  getSkillState,
  XP_PER_BRACKET,
  type SkillDefinition,
  type SkillCategory,
} from '../lib/gamification/skill-tree';

interface SkillTreeGraphProps {
  skills: SkillDefinition[];
  unlockedIds: Set<string>;
  categories: SkillCategory[];
  onSkillPress: (skillId: string) => void;
}

export function SkillTreeGraph({
  skills,
  unlockedIds,
  categories,
  onSkillPress,
}: SkillTreeGraphProps) {
  const { colors } = useThemeColors();
  const { t: ts } = useTranslation('skills');
  const catLabel = (id: string) => ts(`categories.${id}`, { defaultValue: id });
  const skillLabel = (id: string) => ts(`tree.${id}`, { defaultValue: id });

  // Catégories 100% complétées démarrées réduites pour lisibilité
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});

  // Grouper les compétences par catégorie et trier par ordre
  const skillsByCategory = useMemo(() => {
    const map = new Map<string, SkillDefinition[]>();
    for (const skill of skills) {
      const list = map.get(skill.categoryId) ?? [];
      list.push(skill);
      map.set(skill.categoryId, list);
    }
    for (const [key, list] of map) {
      map.set(key, list.sort((a, b) => a.order - b.order));
    }
    return map;
  }, [skills]);

  // Une catégorie est réduite si : override manuel, ou 100% complétée (sans override)
  const isCategoryCollapsed = (catId: string): boolean => {
    if (catId in manualOverrides) return manualOverrides[catId];
    const catSkills = skillsByCategory.get(catId) ?? [];
    return catSkills.length > 0 && catSkills.every((s) => unlockedIds.has(s.id));
  };

  const toggleCategory = (id: string) => {
    setManualOverrides((prev) => ({ ...prev, [id]: !isCategoryCollapsed(id) ? true : false }));
  };

  return (
    <View>
      {categories.map((category) => {
        const categorySkills = skillsByCategory.get(category.id) ?? [];
        const unlockedCount = categorySkills.filter((s) =>
          unlockedIds.has(s.id),
        ).length;
        const totalCount = categorySkills.length;
        const progress = totalCount > 0 ? unlockedCount / totalCount : 0;
        const isCollapsed = isCategoryCollapsed(category.id);

        return (
          <View
            key={category.id}
            style={[
              styles.branchCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Header */}
            <Pressable
              onPress={() => toggleCategory(category.id)}
              style={styles.branchHeader}
              accessibilityRole="button"
              accessibilityLabel={`${catLabel(category.id)}, ${unlockedCount}/${totalCount}`}
            >
              {/* Icône catégorie */}
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: category.color + '26', // 15% opacity
                  },
                ]}
              >
                <Text style={styles.iconEmoji}>{category.emoji}</Text>
              </View>

              {/* Infos */}
              <View style={styles.headerMiddle}>
                <Text
                  style={[styles.categoryName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {catLabel(category.id)}
                </Text>
                <Text
                  style={[styles.categoryCount, { color: colors.textMuted }]}
                >
                  {unlockedCount} / {totalCount} débloquées
                </Text>
                {/* Barre de progression */}
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: colors.borderLight },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: category.color,
                        width: `${Math.round(progress * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Chevron */}
              <Text
                style={[
                  styles.chevron,
                  { color: colors.textMuted },
                  isCollapsed && styles.chevronCollapsed,
                ]}
              >
                ›
              </Text>
            </Pressable>

            {/* Nœuds (visibles quand non collapsé) */}
            {!isCollapsed && categorySkills.length > 0 && (
              <View style={styles.nodesContainer}>
                {categorySkills.map((skill, index) => {
                  const state = getSkillState(skill.id, unlockedIds);
                  const isLast = index === categorySkills.length - 1;
                  const xp = XP_PER_BRACKET[skill.ageBracketId] ?? 0;

                  // Pour la ligne de connexion : vérifier si le nœud actuel ET le suivant sont débloqués
                  const nextSkill = !isLast
                    ? categorySkills[index + 1]
                    : undefined;
                  const bothUnlocked =
                    nextSkill !== undefined &&
                    unlockedIds.has(skill.id) &&
                    unlockedIds.has(nextSkill.id);

                  return (
                    <React.Fragment key={skill.id}>
                      <View style={styles.nodeRow}>
                        <SkillNode
                          label={skillLabel(skill.id)}
                          emoji={category.emoji}
                          categoryColor={category.color}
                          state={state}
                          xp={xp}
                          onPress={() => onSkillPress(skill.id)}
                        />
                      </View>

                      {/* Ligne de connexion verticale */}
                      {!isLast && (
                        <View
                          style={[
                            styles.connectorLine,
                            {
                              backgroundColor: bothUnlocked
                                ? category.color
                                : colors.borderLight,
                            },
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  branchCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: FontSize.titleLg,
  },
  headerMiddle: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs,
  },
  categoryName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as '700',
  },
  categoryCount: {
    fontSize: FontSize.code,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  chevron: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold as '700',
    transform: [{ rotate: '90deg' }],
  },
  chevronCollapsed: {
    transform: [{ rotate: '0deg' }],
  },
  nodesContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  nodeRow: {
    alignItems: 'center',
    marginLeft: Spacing.xxs,
  },
  connectorLine: {
    width: 2,
    height: 28,
    marginLeft: 27, // Centré sous le cercle du nœud (64/2 - 2/2 ≈ 27)
  },
});
