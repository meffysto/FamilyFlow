/**
 * SkillTreeGraph.tsx — Graphe arbre de compétences RPG horizontal
 *
 * 6 lignes (une par catégorie) empilées verticalement,
 * défilement horizontal synchronisé via un ScrollView unique.
 * Connexions entre nœuds en pure View (pas de SVG).
 */

import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { SkillNode } from './SkillNode';
import { getSkillState, type SkillDefinition, type SkillCategory, type SkillState } from '../lib/gamification/skill-tree';

interface SkillTreeGraphProps {
  skills: SkillDefinition[];
  unlockedIds: Set<string>;
  categories: SkillCategory[];
  onSkillPress: (skillId: string) => void;
}

const LANE_HEIGHT = 90;
const NODE_SPACING = 90;
const LABEL_WIDTH = 80;
const NODE_SIZE = 52;

export function SkillTreeGraph({
  skills,
  unlockedIds,
  categories,
  onSkillPress,
}: SkillTreeGraphProps) {
  const { primary, colors } = useThemeColors();

  // Grouper les compétences par catégorie et trier par ordre
  const skillsByCategory = useMemo(() => {
    const map = new Map<string, SkillDefinition[]>();
    for (const skill of skills) {
      const list = map.get(skill.categoryId) ?? [];
      list.push(skill);
      map.set(skill.categoryId, list);
    }
    // Trier chaque catégorie par ordre croissant
    for (const [key, list] of map) {
      map.set(key, list.sort((a, b) => a.order - b.order));
    }
    return map;
  }, [skills]);

  // Largeur maximale pour le scroll horizontal
  const maxSkillsInCategory = useMemo(() => {
    let max = 0;
    for (const list of skillsByCategory.values()) {
      if (list.length > max) max = list.length;
    }
    return max;
  }, [skillsByCategory]);

  const contentWidth = LABEL_WIDTH + maxSkillsInCategory * NODE_SPACING + Spacing['2xl'];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { minWidth: contentWidth }]}
    >
      <View style={styles.container}>
        {categories.map((category) => {
          const categorySkills = skillsByCategory.get(category.id) ?? [];

          return (
            <View key={category.id} style={styles.lane}>
              {/* Étiquette fixe à gauche */}
              <View style={styles.laneLabel}>
                <Text style={styles.laneLabelEmoji}>{category.emoji}</Text>
                <Text
                  style={[styles.laneLabelText, { color: colors.textSub }]}
                  numberOfLines={2}
                >
                  {category.label}
                </Text>
              </View>

              {/* Nœuds de compétences */}
              <View style={styles.nodesRow}>
                {categorySkills.map((skill, index) => {
                  const state = getSkillState(skill.id, unlockedIds);
                  const isLast = index === categorySkills.length - 1;

                  return (
                    <React.Fragment key={skill.id}>
                      <View style={styles.nodeContainer}>
                        <SkillNode
                          label={skill.label}
                          emoji={category.emoji}
                          state={state}
                          onPress={() => onSkillPress(skill.id)}
                        />
                      </View>

                      {/* Ligne de connexion vers le nœud suivant */}
                      {!isLast && (
                        <View style={styles.connectionContainer}>
                          <View
                            style={[
                              styles.connectionLine,
                              {
                                borderBottomColor:
                                  state === 'unlocked' &&
                                  unlockedIds.has(categorySkills[index + 1].id)
                                    ? primary
                                    : colors.borderLight,
                              },
                            ]}
                          />
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingRight: Spacing['2xl'],
  },
  container: {
    flexDirection: 'column',
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LANE_HEIGHT,
  },
  laneLabel: {
    width: LABEL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  laneLabelEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xxs,
  },
  laneLabelText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  nodesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nodeContainer: {
    width: NODE_SIZE,
    alignItems: 'center',
  },
  connectionContainer: {
    width: NODE_SPACING - NODE_SIZE,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxs,
  },
  connectionLine: {
    borderBottomWidth: 2,
    width: '100%',
  },
});
