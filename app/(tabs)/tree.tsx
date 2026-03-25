/**
 * tree.tsx — Écran dédié arbre mascotte
 *
 * Affiche l'arbre du profil sélectionné en plein écran avec :
 * - Arbre animé grande taille
 * - Barre de progression XP vers prochaine évolution
 * - Infos espèce + stade
 * - Sélecteur d'espèce (si première fois ou via bouton)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { TreeView } from '../../components/mascot/TreeView';
import { SpeciesPicker } from '../../components/mascot/SpeciesPicker';
import { TreeShop } from '../../components/mascot/TreeShop';
import { calculateLevel, xpForLevel, pointsToNextLevel, getLevelTier } from '../../lib/gamification';
import {
  getTreeStage,
  getTreeStageInfo,
  getNextEvolutionLevel,
  levelsUntilEvolution,
  getStageProgress,
  getStageIndex,
  TREE_STAGES,
} from '../../lib/mascot';
import { SPECIES_INFO, ALL_SPECIES, type TreeSpecies } from '../../lib/mascot/types';
import type { Profile } from '../../lib/types';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const { width: SCREEN_W } = Dimensions.get('window');
const TREE_SIZE = Math.min(SCREEN_W * 0.85, 360);

export default function TreeScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const { profiles, activeProfile, updateTreeSpecies, buyMascotItem } = useVault();
  const { showToast } = useToast();

  // Profil affiché : celui passé en param ou le profil actif
  const profile = useMemo(() => {
    if (profileId) return profiles.find((p: Profile) => p.id === profileId) || activeProfile;
    return activeProfile;
  }, [profileId, profiles, activeProfile]);

  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false);
  const [selectedProfileForPicker, setSelectedProfileForPicker] = useState<Profile | null>(null);
  const [showShop, setShowShop] = useState(false);

  if (!profile) return null;

  const species = profile.treeSpecies || 'cerisier';
  const hasChosenSpecies = !!profile.treeSpecies;
  const level = calculateLevel(profile.points ?? 0);
  const tier = getLevelTier(level);
  const stageInfo = getTreeStageInfo(level);
  const stageProgress = getStageProgress(level);
  const nextEvoLevel = getNextEvolutionLevel(level);
  const levelsLeft = levelsUntilEvolution(level);
  const sp = SPECIES_INFO[species];
  const stageIdx = getStageIndex(level);

  // XP progress vers prochain niveau
  const currentXP = profile.points ?? 0;
  const nextLevelXP = xpForLevel(level);
  const prevLevelXP = level > 1 ? xpForLevel(level - 1) : 0;
  const xpInLevel = currentXP - prevLevelXP;
  const xpNeeded = nextLevelXP - prevLevelXP;
  const xpPercent = xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 1;

  const handleSpeciesSelect = useCallback(async (newSpecies: TreeSpecies) => {
    const targetProfile = selectedProfileForPicker || profile;
    if (!targetProfile) return;
    try {
      await updateTreeSpecies(targetProfile.id, newSpecies);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('mascot.speciesChanged', { species: t(SPECIES_INFO[newSpecies].labelKey) }));
    } catch {
      showToast(t('common.error'), 'error');
    }
    setShowSpeciesPicker(false);
    setSelectedProfileForPicker(null);
  }, [profile, selectedProfileForPicker, updateTreeSpecies, showToast, t]);

  const openPickerFor = useCallback((p: Profile) => {
    setSelectedProfileForPicker(p);
    setShowSpeciesPicker(true);
  }, []);

  const handleShopBuy = useCallback(async (itemId: string, itemType: 'decoration' | 'inhabitant') => {
    if (!profile) return;
    await buyMascotItem(profile.id, itemId, itemType);
    const labelKey = itemType === 'decoration'
      ? `mascot.deco.${itemId}`
      : `mascot.hab.${itemId}`;
    showToast(t('mascot.shop.buySuccess', { item: t(labelKey) }));
  }, [profile, buyMascotItem, showToast, t]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, Layout.contentContainer]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: primary }]}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('mascot.screen.title')}
          </Text>
          <View style={styles.backBtn} />
        </View>

        {/* Arbre principal */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.treeContainer}>
          <View style={[styles.treeBg, { backgroundColor: isDark ? 'rgba(16,32,48,0.4)' : 'rgba(200,230,255,0.3)' }]}>
            <TreeView
              species={species}
              level={level}
              size={TREE_SIZE}
              interactive
              decorations={profile.mascotDecorations ?? []}
              inhabitants={profile.mascotInhabitants ?? []}
            />
          </View>
        </Animated.View>

        {/* Info profil + stade */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.infoCard}>
          <View style={[styles.infoContainer, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.md]}>
            {/* Avatar + nom + tier */}
            <View style={styles.profileRow}>
              <Text style={styles.profileAvatar}>{profile.avatar}</Text>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.tierLabel, { color: tier.color }]}>
                  {tier.emoji} {tier.name} — {t('dashboard.loot.level', { level })}
                </Text>
              </View>
            </View>

            {/* Espèce + stade */}
            <View style={[styles.speciesRow, { borderTopColor: colors.borderLight }]}>
              <View style={styles.speciesInfo}>
                <Text style={[styles.speciesLabel, { color: colors.textSub }]}>
                  {sp.emoji} {t(sp.labelKey)}
                </Text>
                <Text style={[styles.stageLabel, { color: colors.text }]}>
                  {t(stageInfo.labelKey)}
                </Text>
                <Text style={[styles.stageDesc, { color: colors.textMuted }]}>
                  {t(stageInfo.descriptionKey)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.changeSpeciesBtn, { backgroundColor: tint }]}
                onPress={() => openPickerFor(profile)}
                activeOpacity={0.7}
              >
                <Text style={[styles.changeSpeciesText, { color: primary }]}>
                  {hasChosenSpecies ? t('mascot.screen.changeSpecies') : t('mascot.screen.chooseSpecies')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bouton boutique */}
            <TouchableOpacity
              style={[styles.shopBtn, { backgroundColor: tint, borderColor: primary }]}
              onPress={() => setShowShop(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.shopBtnText, { color: primary }]}>
                {'🛒 ' + t('mascot.shop.title')}
              </Text>
            </TouchableOpacity>

            {/* Barre XP */}
            <View style={styles.xpSection}>
              <View style={styles.xpHeader}>
                <Text style={[styles.xpLabel, { color: colors.textSub }]}>
                  {t('mascot.screen.xpProgress')}
                </Text>
                <Text style={[styles.xpValue, { color: colors.textMuted }]}>
                  {xpInLevel} / {xpNeeded} XP
                </Text>
              </View>
              <View style={[styles.xpBar, { backgroundColor: colors.cardAlt }]}>
                <View style={[styles.xpFill, { width: `${Math.round(xpPercent * 100)}%`, backgroundColor: tier.color }]} />
              </View>
            </View>

            {/* Progression vers évolution */}
            {nextEvoLevel !== null && (
              <View style={[styles.evoSection, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.evoTitle, { color: colors.textSub }]}>
                  {t('mascot.screen.nextEvolution')}
                </Text>
                <View style={styles.evoRow}>
                  <View style={styles.evoStage}>
                    <TreeView species={species} level={level} size={70} showGround={false} interactive={false} />
                    <Text style={[styles.evoStageName, { color: colors.text }]}>
                      {t(stageInfo.labelKey)}
                    </Text>
                  </View>
                  <Text style={[styles.evoArrow, { color: colors.textFaint }]}>→</Text>
                  <View style={styles.evoStage}>
                    <TreeView species={species} level={nextEvoLevel} size={70} showGround={false} interactive={false} />
                    <Text style={[styles.evoStageName, { color: colors.textMuted }]}>
                      {t(TREE_STAGES[stageIdx + 1]?.labelKey || stageInfo.labelKey)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.evoHint, { color: colors.textFaint }]}>
                  {t('mascot.screen.levelsToEvo', { count: levelsLeft })}
                </Text>
                {/* Barre progression évolution */}
                <View style={[styles.xpBar, { backgroundColor: colors.cardAlt, marginTop: Spacing.sm }]}>
                  <View style={[styles.xpFill, { width: `${Math.round(stageProgress * 100)}%`, backgroundColor: sp.accent }]} />
                </View>
              </View>
            )}

            {/* Stade max atteint */}
            {nextEvoLevel === null && (
              <View style={[styles.evoSection, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.maxStage, { color: '#FFD700' }]}>
                  {t('mascot.screen.maxStage')}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Aperçu des 6 stades */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <Text style={[styles.familyTitle, { color: colors.text }]}>
            {t('mascot.screen.allStages')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stagesScroll}
          >
            {TREE_STAGES.map((s, idx) => {
              const isCurrent = s.stage === stageInfo.stage;
              const isReached = stageIdx >= idx;
              return (
                <View
                  key={s.stage}
                  style={[
                    styles.stageSlot,
                    { backgroundColor: colors.card, borderColor: isCurrent ? sp.accent : colors.borderLight },
                    isCurrent && { borderWidth: 2 },
                  ]}
                >
                  <View style={{ opacity: isReached ? 1 : 0.35 }}>
                    <TreeView species={species} level={s.minLevel} size={65} showGround={false} interactive={false} />
                  </View>
                  <Text style={[styles.stageSlotName, { color: isCurrent ? sp.accent : isReached ? colors.text : colors.textFaint }]}>
                    {t(s.labelKey)}
                  </Text>
                  <Text style={[styles.stageSlotLevels, { color: colors.textMuted }]}>
                    {t('mascot.screen.stageLevels', { min: s.minLevel, max: s.maxLevel })}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.currentDot, { backgroundColor: sp.accent }]} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Tous les arbres de la famille (sauf le profil courant) */}
        {profiles.length > 1 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <Text style={[styles.familyTitle, { color: colors.text }]}>
              {t('mascot.screen.familyGarden')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.familyScroll}
            >
              {profiles
                .filter((p: Profile) => p.id !== profile.id)
                .map((p: Profile) => {
                  const pSpecies = p.treeSpecies || 'cerisier';
                  const pLevel = calculateLevel(p.points ?? 0);
                  const pStage = getTreeStageInfo(pLevel);
                  const pSp = SPECIES_INFO[pSpecies];

                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.familySlot, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}
                      onPress={() => router.push({ pathname: '/(tabs)/tree' as any, params: { profileId: p.id } })}
                      activeOpacity={0.7}
                    >
                      <TreeView species={pSpecies} level={pLevel} size={80} showGround={false} interactive={false} />
                      <Text style={[styles.familyName, { color: colors.text }]}>
                        {p.avatar} {p.name}
                      </Text>
                      <Text style={[styles.familyStage, { color: colors.textMuted }]}>
                        {pSp.emoji} {t(pStage.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal sélecteur d'espèce */}
      <Modal
        visible={showSpeciesPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSpeciesPicker(false)}
      >
        <SpeciesPicker
          currentSpecies={species}
          level={level}
          onSelect={handleSpeciesSelect}
          onClose={() => setShowSpeciesPicker(false)}
        />
      </Modal>

      {/* Modal boutique */}
      <Modal
        visible={showShop}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShop(false)}
      >
        <TreeShop
          species={species}
          level={level}
          points={profile.points ?? 0}
          ownedDecorations={profile.mascotDecorations ?? []}
          ownedInhabitants={profile.mascotInhabitants ?? []}
          onBuy={handleShopBuy}
          onClose={() => setShowShop(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  treeContainer: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  treeBg: {
    borderRadius: Radius['3xl'],
    padding: Spacing.xl,
    alignItems: 'center',
  },
  infoCard: {
    marginBottom: Spacing['2xl'],
  },
  infoContainer: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  profileAvatar: {
    fontSize: FontSize.icon,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  tierLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xxs,
  },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  speciesInfo: {
    flex: 1,
  },
  speciesLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  stageLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xxs,
  },
  stageDesc: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xxs,
  },
  changeSpeciesBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  changeSpeciesText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  shopBtn: {
    alignSelf: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginVertical: Spacing.md,
  },
  shopBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  xpSection: {
    marginBottom: Spacing.lg,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  xpLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  xpValue: {
    fontSize: FontSize.caption,
  },
  xpBar: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  evoSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xl,
  },
  evoTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.md,
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  evoStage: {
    alignItems: 'center',
  },
  evoEmoji: {
    fontSize: FontSize.display,
  },
  evoStageName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xxs,
  },
  evoArrow: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  evoHint: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  maxStage: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  familyTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  familyScroll: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  familySlot: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 110,
  },
  familyName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
  },
  familyStage: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
  stagesScroll: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  stageSlot: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 90,
  },
  stageSlotName: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  stageSlotLevels: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.xs,
  },
});
