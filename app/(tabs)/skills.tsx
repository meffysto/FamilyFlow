/**
 * skills.tsx — Écran arbre de compétences enfant
 *
 * Graph RPG horizontal par catégorie, validation parent uniquement.
 * 1 fichier par enfant : 08 - Compétences/{enfant}.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Chip } from '../../components/ui';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SkillTreeGraph } from '../../components/SkillTreeGraph';
import { SkillDetailModal } from '../../components/SkillDetailModal';
import { CategoryCompleteOverlay } from '../../components/CategoryCompleteOverlay';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { Spacing, Layout } from '../../constants/spacing';
import { useTranslation } from 'react-i18next';
import { FontSize, FontWeight } from '../../constants/typography';
import {
  SKILL_CATEGORIES,
  AGE_BRACKETS,
  XP_PER_BRACKET,
  getSkillsForBracket,
  getSkillById,
  getSkillState,
  getCategoriesForBracket,
  detectAgeBracket,
  type AgeBracketId,
  type SkillCategoryId,
} from '../../lib/gamification/skill-tree';

const RING_SIZE = 84;
const RING_RADIUS = 35;
const RING_STROKE = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Traduit les labels statiques via le namespace skills */
function useSkillt() {
  const { t } = useTranslation('skills');
  const catLabel = (id: string) => t(`categories.${id}`, { defaultValue: id });
  const bracketLabel = (id: string) => t(`ageBrackets.${id}.label`, { defaultValue: id });
  const bracketSubtitle = (id: string) => t(`ageBrackets.${id}.subtitle`, { defaultValue: '' });
  const skillLabel = (id: string) => t(`tree.${id}`, { defaultValue: id });
  const skillDescription = (id: string): string | undefined => {
    const val = t(`descriptions.${id}`, { defaultValue: '' });
    return val || undefined;
  };
  return { catLabel, bracketLabel, bracketSubtitle, skillLabel, skillDescription };
}

export default function SkillsScreen() {
  const { t } = useTranslation();
  const sk = useSkillt();
  const headerRef = useRef<View>(null);
  const { profiles, activeProfile, skillTrees, unlockSkill, refresh } = useVault();
  const { primary, colors, isDark } = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);

  // Scroll handler pour collapse du ScreenHeader
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const [selectedBracket, setSelectedBracket] = useState<AgeBracketId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SkillCategoryId | 'all'>('all');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [celebration, setCelebration] = useState<{ emoji: string; label: string } | null>(null);

  const isParent = activeProfile?.role === 'adulte';

  // Trouver les enfants
  const childProfiles = useMemo(() =>
    profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles]
  );

  // Profil enfant sélectionné (le premier par défaut, ou actif si c'est un enfant)
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [bracketPickerVisible, setBracketPickerVisible] = useState(false);
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

  // Reset scroll au changement de filtre (évite collapse fantôme)
  useEffect(() => {
    scrollY.value = 0;
  }, [selectedCategory, activeBracket]);

  // Infos tranche active
  const activeBracketInfo = useMemo(() =>
    AGE_BRACKETS.find((b) => b.id === activeBracket),
    [activeBracket]
  );

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

  const handleSkillPress = useCallback((skillId: string) => {
    setSelectedSkillId(skillId);
    setModalVisible(true);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!selectedChild || !selectedSkillId) return;
    const skill = getSkillById(selectedSkillId);
    await unlockSkill(selectedChild.id, selectedSkillId);
    setModalVisible(false);

    // Vérifier si la catégorie est maintenant complète
    if (skill) {
      const catSkills = getSkillsForBracket(activeBracket).filter(
        (s) => s.categoryId === skill.categoryId,
      );
      const newUnlocked = new Set(unlockedIds);
      newUnlocked.add(selectedSkillId);
      const allDone = catSkills.every((s) => newUnlocked.has(s.id));
      if (allDone) {
        const cat = SKILL_CATEGORIES.find((c) => c.id === skill.categoryId);
        if (cat) {
          // Petit délai pour laisser le modal se fermer
          setTimeout(() => setCelebration({ emoji: cat.emoji, label: sk.catLabel(cat.id) }), 400);
        }
      }
    }
  }, [selectedChild, selectedSkillId, unlockSkill, activeBracket, unlockedIds]);

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

  // XP total et progression
  const totalXp = unlockedCount * XP_PER_BRACKET[activeBracket];
  const progress = totalSkills > 0 ? unlockedCount / totalSkills : 0;
  const progressPercent = Math.round(progress * 100);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  if (childProfiles.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
        <StatusBar style={isDark ? 'light' : 'dark'} translucent />
        <ScreenHeader title={t('skillsScreen.title')} />
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('skillsScreen.emptyNoChild')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryForSkill = selectedSkill
    ? SKILL_CATEGORIES.find((c) => c.id === selectedSkill.categoryId)
    : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <View ref={headerRef}>
        <ScreenHeader
          title={t('skillsScreen.title')}
          subtitle={selectedChild ? `${selectedChild.avatar} ${selectedChild.name}` : undefined}
          actions={
            isParent && childProfiles.length > 1 ? (
              <View style={styles.avatarRow}>
                {childProfiles.map((child) => {
                  const isActive = child.id === selectedChild?.id;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={[
                        styles.avatarBubble,
                        {
                          backgroundColor: isActive ? primary + '20' : colors.card,
                          borderColor: isActive ? primary : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedChildId(child.id)}
                      accessibilityLabel={child.name}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={styles.avatarEmoji}>{child.avatar}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : undefined
          }
          bottom={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStripContent}>
              <Chip label={t('skillsScreen.filterAll')} selected={selectedCategory === 'all'} onPress={() => setSelectedCategory('all')} />
              {getCategoriesForBracket(activeBracket).map((cat) => (
                <Chip
                  key={cat.id}
                  label={`${cat.emoji} ${sk.catLabel(cat.id)}`}
                  selected={selectedCategory === cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                />
              ))}
            </ScrollView>
          }
          scrollY={scrollY}
        />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Carte de progression avec sélecteur de tranche intégré */}
        <View style={[styles.progressSection, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
          <View style={styles.ringContainer}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.cardAlt}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={primary}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                rotation={-90}
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
            </Svg>
            <View style={styles.ringOverlay}>
              <Text style={[styles.ringPercent, { color: colors.text }]}>
                {progressPercent}%
              </Text>
              <Text style={[styles.ringLabel, { color: colors.textMuted }]}>
                {t('skillsScreen.completed')}
              </Text>
            </View>
          </View>

          <View style={styles.progressInfo}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>
              {t('skillsScreen.skillCount', { unlocked: unlockedCount, total: totalSkills })}
            </Text>
            {/* Sélecteur tranche d'âge intégré */}
            <TouchableOpacity
              style={[styles.bracketPill, { backgroundColor: primary + '15' }]}
              onPress={() => setBracketPickerVisible(true)}
              accessibilityLabel={t('skillsScreen.a11y.changeBracket')}
              accessibilityRole="button"
            >
              <Text style={[styles.bracketPillText, { color: primary }]}>
                {sk.bracketLabel(activeBracket)} · {sk.bracketSubtitle(activeBracket)}
              </Text>
              <Text style={[styles.bracketPillArrow, { color: primary }]}> ▾</Text>
            </TouchableOpacity>
            <View style={[styles.xpBadge, { backgroundColor: primary + '26' }]}>
              <Text style={[styles.xpText, { color: primary }]}>
                ⚡ {totalXp} XP gagnés
              </Text>
            </View>
          </View>
        </View>

        {/* Graph RPG */}
        <SkillTreeGraph
          skills={skills}
          unlockedIds={unlockedIds}
          categories={getCategoriesForBracket(activeBracket).filter((c) =>
            selectedCategory === 'all' || c.id === selectedCategory
          )}
          onSkillPress={handleSkillPress}
        />
      </Animated.ScrollView>

      {/* Modal détail */}
      <SkillDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        skill={selectedSkill ? {
          id: selectedSkill.id,
          label: sk.skillLabel(selectedSkill.id),
          categoryEmoji: categoryForSkill?.emoji ?? '',
          categoryLabel: sk.catLabel(categoryForSkill?.id ?? ''),
          ageBracketLabel: sk.bracketLabel(selectedSkill.ageBracketId),
          xp: XP_PER_BRACKET[selectedSkill.ageBracketId],
        } : null}
        state={selectedSkillState}
        unlockedAt={selectedSkillUnlock?.unlockedAt}
        unlockedBy={selectedSkillUnlock ? profiles.find((p) => p.id === selectedSkillUnlock.unlockedBy)?.name ?? selectedSkillUnlock.unlockedBy : undefined}
        onUnlock={isParent && selectedSkillState === 'unlockable' ? handleUnlock : undefined}
        description={selectedSkill ? sk.skillDescription(selectedSkill.id) : undefined}
      />

      <ScreenGuide
        screenId="skills"
        targets={[
          { ref: headerRef, ...HELP_CONTENT.skills[0] },
        ]}
      />

      <CategoryCompleteOverlay
        visible={celebration !== null}
        categoryEmoji={celebration?.emoji ?? ''}
        categoryLabel={celebration?.label ?? ''}
        childName={selectedChild?.name ?? ''}
        onDismiss={() => setCelebration(null)}
      />

      {/* Picker tranche d'âge (bottom sheet style) */}
      <Modal
        visible={bracketPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBracketPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setBracketPickerVisible(false)}
        >
          <View style={[styles.bracketSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.bracketSheetTitle, { color: colors.text }]}>
              {t('skillsScreen.bracketPickerTitle')}
            </Text>
            <FlatList
              data={AGE_BRACKETS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isActive = item.id === activeBracket;
                const isCurrent = item.id === detectedBracket;
                return (
                  <TouchableOpacity
                    style={[
                      styles.bracketOption,
                      {
                        backgroundColor: isActive ? primary + '15' : 'transparent',
                        borderColor: isActive ? primary : colors.borderLight,
                      },
                    ]}
                    onPress={() => {
                      setSelectedBracket(item.id);
                      setBracketPickerVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.bracketOptionText,
                      { color: isActive ? primary : colors.text },
                    ]}>
                      {item.label} — {item.subtitle}
                    </Text>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: primary + '26' }]}>
                        <Text style={[styles.currentBadgeText, { color: primary }]}>{t('skillsScreen.bracketCurrent')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Avatars enfants compacts (slot actions du ScreenHeader)
  avatarRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  avatarBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  // Carte progression
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
  },
  ringLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  progressTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  // Pill tranche d'âge
  bracketPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: 20,
  },
  bracketPillText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  bracketPillArrow: {
    fontSize: FontSize.micro,
  },
  xpBadge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  xpText: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.bold,
  },
  scroll: { flex: 1 },
  content: {
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  chipStripContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FontSize.body,
  },
  // Modal picker tranche d'âge
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bracketSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    paddingHorizontal: Spacing['2xl'],
    maxHeight: '60%',
  },
  bracketSheetTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  bracketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
  },
  bracketOptionText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  currentBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
});
