/**
 * skills.tsx — Écran arbre de compétences enfant
 *
 * Graph RPG horizontal par catégorie, validation parent uniquement.
 * 1 fichier par enfant : 08 - Compétences/{enfant}.md
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Chip } from '../../components/ui';
import { SkillTreeGraph } from '../../components/SkillTreeGraph';
import { SkillDetailModal } from '../../components/SkillDetailModal';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import {
  SKILL_CATEGORIES,
  AGE_BRACKETS,
  XP_PER_BRACKET,
  getSkillsForBracket,
  getSkillById,
  getSkillState,
  getPrerequisiteId,
  detectAgeBracket,
  type AgeBracketId,
  type SkillCategoryId,
} from '../../lib/gamification/skill-tree';

export default function SkillsScreen() {
  const headerRef = useRef<View>(null);
  const { profiles, activeProfile, skillTrees, unlockSkill, refresh } = useVault();
  const { primary, colors } = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBracket, setSelectedBracket] = useState<AgeBracketId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SkillCategoryId | 'all'>('all');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const isParent = activeProfile?.role === 'adulte';

  // Trouver les enfants
  const childProfiles = useMemo(() =>
    profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles]
  );

  // Profil enfant sélectionné (le premier par défaut, ou actif si c'est un enfant)
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const selectedChild = useMemo(() => {
    if (activeProfile && (activeProfile.role === 'enfant' || activeProfile.role === 'ado')) {
      return activeProfile;
    }
    if (selectedChildId) return childProfiles.find((p) => p.id === selectedChildId) ?? childProfiles[0] ?? null;
    return childProfiles[0] ?? null;
  }, [activeProfile, selectedChildId, childProfiles]);

  // Tranche d'âge auto-détectée ou sélectionnée
  const detectedBracket = useMemo(() => {
    if (!selectedChild?.birthdate) return '3-5' as AgeBracketId;
    return detectAgeBracket(selectedChild.birthdate);
  }, [selectedChild]);

  const activeBracket = selectedBracket ?? detectedBracket;

  // Compétences pour la tranche active
  const skills = useMemo(() => {
    const all = getSkillsForBracket(activeBracket);
    if (selectedCategory === 'all') return all;
    return all.filter((s) => s.categoryId === selectedCategory);
  }, [activeBracket, selectedCategory]);

  // Compétences débloquées pour cet enfant
  const childTree = useMemo(() =>
    skillTrees.find((t) => t.profileId === selectedChild?.id),
    [skillTrees, selectedChild]
  );
  const unlockedIds = useMemo(() =>
    new Set(childTree?.unlocked.map((u) => u.skillId) ?? []),
    [childTree]
  );

  // Skill sélectionné pour le modal
  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return getSkillById(selectedSkillId) ?? null;
  }, [selectedSkillId]);

  const selectedSkillUnlock = useMemo(() => {
    if (!selectedSkillId || !childTree) return undefined;
    return childTree.unlocked.find((u) => u.skillId === selectedSkillId);
  }, [selectedSkillId, childTree]);

  const selectedSkillState = useMemo(() => {
    if (!selectedSkillId) return 'locked' as const;
    return getSkillState(selectedSkillId, unlockedIds);
  }, [selectedSkillId, unlockedIds]);

  const prerequisiteLabel = useMemo(() => {
    if (selectedSkillState !== 'locked' || !selectedSkill) return undefined;
    const prevId = getPrerequisiteId(selectedSkill);
    if (!prevId) return undefined;
    return getSkillById(prevId)?.label;
  }, [selectedSkillState, selectedSkill]);

  const handleSkillPress = useCallback((skillId: string) => {
    setSelectedSkillId(skillId);
    setModalVisible(true);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!selectedChild || !selectedSkillId) return;
    await unlockSkill(selectedChild.id, selectedSkillId);
    setModalVisible(false);
  }, [selectedChild, selectedSkillId, unlockSkill]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Stats progression (dérivé du memo `skills` quand pas de filtre catégorie)
  const { totalSkills, unlockedCount } = useMemo(() => {
    const allBracket = selectedCategory === 'all' ? skills : getSkillsForBracket(activeBracket);
    return {
      totalSkills: allBracket.length,
      unlockedCount: allBracket.filter((s) => unlockedIds.has(s.id)).length,
    };
  }, [skills, activeBracket, selectedCategory, unlockedIds]);

  if (childProfiles.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Aucun profil enfant configuré.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryForSkill = selectedSkill
    ? SKILL_CATEGORIES.find((c) => c.id === selectedSkill.categoryId)
    : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View ref={headerRef} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {selectedChild?.avatar} Compétences
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          {selectedChild?.name} — {unlockedCount}/{totalSkills} débloquées
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Sélection enfant (si parent avec plusieurs enfants) */}
        {isParent && childProfiles.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip}>
            {childProfiles.map((child) => (
              <Chip
                key={child.id}
                label={`${child.avatar} ${child.name}`}
                selected={child.id === selectedChild?.id}
                onPress={() => setSelectedChildId(child.id)}
              />
            ))}
          </ScrollView>
        )}

        {/* Sélection tranche d'âge */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip}>
          {AGE_BRACKETS.map((bracket) => (
            <Chip
              key={bracket.id}
              label={`${bracket.label} ${bracket.id === detectedBracket ? '(actuel)' : ''}`}
              selected={bracket.id === activeBracket}
              onPress={() => setSelectedBracket(bracket.id)}
            />
          ))}
        </ScrollView>

        {/* Filtre par catégorie */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip}>
          <Chip label="Tout" selected={selectedCategory === 'all'} onPress={() => setSelectedCategory('all')} />
          {SKILL_CATEGORIES.map((cat) => (
            <Chip
              key={cat.id}
              label={`${cat.emoji} ${cat.label}`}
              selected={selectedCategory === cat.id}
              onPress={() => setSelectedCategory(cat.id)}
            />
          ))}
        </ScrollView>

        {/* Graph RPG */}
        <SkillTreeGraph
          skills={skills}
          unlockedIds={unlockedIds}
          categories={SKILL_CATEGORIES.filter((c) =>
            selectedCategory === 'all' || c.id === selectedCategory
          )}
          onSkillPress={handleSkillPress}
        />
      </ScrollView>

      {/* Modal détail */}
      <SkillDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        skill={selectedSkill ? {
          id: selectedSkill.id,
          label: selectedSkill.label,
          categoryEmoji: categoryForSkill?.emoji ?? '',
          categoryLabel: categoryForSkill?.label ?? '',
          ageBracketLabel: AGE_BRACKETS.find((b) => b.id === selectedSkill.ageBracketId)?.label ?? '',
          xp: XP_PER_BRACKET[selectedSkill.ageBracketId],
        } : null}
        state={selectedSkillState}
        unlockedAt={selectedSkillUnlock?.unlockedAt}
        unlockedBy={selectedSkillUnlock ? profiles.find((p) => p.id === selectedSkillUnlock.unlockedBy)?.name ?? selectedSkillUnlock.unlockedBy : undefined}
        onUnlock={isParent && selectedSkillState === 'unlockable' ? handleUnlock : undefined}
        prerequisiteLabel={prerequisiteLabel}
      />

      <ScreenGuide
        screenId="skills"
        targets={[
          { ref: headerRef, ...HELP_CONTENT.skills[0] },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  scroll: { flex: 1 },
  content: {
    paddingBottom: 100,
  },
  chipStrip: {
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
  },
});
